// Arkives — Google Calendar connection (server side).
//
// Every Arkives user connects THEIR OWN Google account from Settings.
// Nothing here is shared between accounts: tokens are per user, sealed
// to that user's id, and only ever read back with that user's own
// Supabase session.
//
// Security model (decisions/2026-10-15-arkives-scheduling-architecture.md):
//   * No Supabase service key. Every DB call runs AS THE USER (their JWT,
//     so RLS applies) through SECURITY DEFINER RPCs that also demand
//     ARKIVES_DB_KEY, so a stolen browser session cannot read tokens.
//   * The refresh token is AES-256-GCM sealed in the Worker
//     (ARKIVES_MASTER_KEY, bound to the user id). The database only ever
//     holds ciphertext; the browser never sees a Google token at all.
//   * OAuth state is HMAC-signed, expires in 10 minutes, and must match
//     an HttpOnly nonce cookie set in the same browser (no login CSRF).
//   * Scopes are the minimum: read/write events on calendars the user
//     owns + free/busy (for scheduling links later). No Gmail scopes.
//
// Routes (all JSON except the callback redirect):
//   POST /api/google/connect     -> { url } to send the browser to Google
//   GET  /api/google/callback    <- Google redirects here; parks the sealed
//                                   token in an HttpOnly cookie, then
//                                   redirects to /?google=finish#settings
//   POST /api/google/finish      -> stores the parked token as the user
//   POST /api/google/disconnect  -> revokes at Google, deletes the row
//   GET  /api/google/events?from&to -> the user's events in a window
//   POST /api/google/push        -> creates an all-day event (Arkives-made)
//   POST /api/google/remove      -> deletes an Arkives-made event only
//
// Secrets (Cloudflare dashboard): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
// ARKIVES_MASTER_KEY, ARKIVES_DB_KEY. Missing any -> 503 not_configured.
// Optional GOOGLE_ALLOWED_EMAILS: comma-separated Arkives logins allowed to
// connect Google; when set, every other account gets 403 forbidden.

import { SUPABASE_URL, SUPABASE_ANON, parseAllowList } from './scan.js';
import { seal, open, sign, verify, randomToken, readCookie, cookie, b64url, unb64url } from './crypto.js';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.freebusy',
];
const REQUIRED_SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned';
const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_WINDOW_MS = 70 * 24 * 3600 * 1000;
const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

const _json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
});

export function configured(env) {
  return !!(env && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.ARKIVES_MASTER_KEY && env.ARKIVES_DB_KEY);
}

export function redirectUri(env, reqUrl) {
  return (env.PUBLIC_ORIGIN || new URL(reqUrl).origin) + '/api/google/callback';
}

// ---- OAuth state: payload.signature, payload = {u: auth uid, n: nonce, e: expiry ms} ----
export async function makeState(master, uid, nonce, now = Date.now()) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ u: uid, n: nonce, e: now + STATE_TTL_MS })));
  return payload + '.' + await sign(master, 'google-state', payload);
}

export async function readState(master, state, nonceCookie, now = Date.now()) {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig || !(await verify(master, 'google-state', payload, sig))) return null;
  let s;
  try { s = JSON.parse(new TextDecoder().decode(unb64url(payload))); } catch { return null; }
  if (!s || typeof s.u !== 'string' || typeof s.n !== 'string' || !(s.e > now)) return null;
  if (!nonceCookie || nonceCookie !== s.n) return null;
  return s;
}

// The id_token comes straight from Google's token endpoint over TLS, so
// its payload can be read without re-verifying the signature (Google's
// own guidance for tokens received directly from the token endpoint).
export function idTokenEmail(idToken) {
  try {
    const p = JSON.parse(new TextDecoder().decode(unb64url(String(idToken).split('.')[1])));
    return p && p.email_verified !== false && typeof p.email === 'string' ? p.email.slice(0, 200) : '';
  } catch { return ''; }
}

export function slimEvent(e) {
  const start = (e.start && (e.start.dateTime || e.start.date)) || '';
  const end = (e.end && (e.end.dateTime || e.end.date)) || '';
  const priv = (e.extendedProperties && e.extendedProperties.private) || {};
  return {
    id: String(e.id || ''),
    title: String(e.summary || '(No title)').slice(0, 300),
    start, end,
    allDay: !!(e.start && e.start.date && !e.start.dateTime),
    link: /^https:\/\/(www\.)?google\.com\/calendar\//.test(e.htmlLink || '') ? e.htmlLink : '',
    meet: /^https:\/\/meet\.google\.com\//.test(e.hangoutLink || '') ? e.hangoutLink : '',
    arkives: priv.arkives === '1',
  };
}

export function nextDay(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function handleGoogle(req, env, fetchImpl = fetch) {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/google\/?/, '');
  if (!configured(env)) {
    if (route === 'callback') return Response.redirect(new URL('/?google=error&reason=not_configured#settings', url).toString(), 303);
    return _json({ ok: false, error: 'not_configured' }, 503);
  }
  const master = env.ARKIVES_MASTER_KEY;

  // ---- Google redirect (no Supabase session on a top-level navigation) ----
  if (route === 'callback') {
    const back = (q) => {
      const h = new Headers({ Location: new URL('/?google=' + q + '#settings', url).toString(), 'Cache-Control': 'no-store' });
      h.append('Set-Cookie', cookie('ark_g_nonce', '', 0));
      return h;
    };
    if (req.method !== 'GET') return _json({ ok: false, error: 'method' }, 405);
    if (url.searchParams.get('error')) return new Response(null, { status: 303, headers: back('error&reason=denied') });
    const st = await readState(master, url.searchParams.get('state'), readCookie(req, 'ark_g_nonce'));
    if (!st) return new Response(null, { status: 303, headers: back('error&reason=state') });
    const code = url.searchParams.get('code') || '';
    const tokRes = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(env, req.url), grant_type: 'authorization_code' }),
    });
    const tok = tokRes.ok ? await tokRes.json().catch(() => null) : null;
    if (!tok || !tok.refresh_token) return new Response(null, { status: 303, headers: back('error&reason=exchange') });
    const scopes = String(tok.scope || '').split(/\s+/).filter(Boolean);
    if (!scopes.includes(REQUIRED_SCOPE)) {
      // The user unticked calendar access on Google's screen: give the grant back
      await fetchImpl('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tok.refresh_token }) }).catch(() => {});
      return new Response(null, { status: 303, headers: back('error&reason=scope') });
    }
    const sealedToken = await seal(master, 'google-token', st.u, tok.refresh_token);
    const pending = await seal(master, 'google-pending', st.u, JSON.stringify({ email: idTokenEmail(tok.id_token), scopes: scopes.join(' '), token: sealedToken }));
    const h = back('finish');
    h.append('Set-Cookie', cookie('ark_g_pending', pending, 600));
    return new Response(null, { status: 303, headers: h });
  }

  // ---- Everything else: signed-in Arkives user only ----
  if (route === 'events' ? req.method !== 'GET' : req.method !== 'POST') return _json({ ok: false, error: 'method' }, 405);
  const auth = req.headers.get('Authorization') || '';
  if (!/^Bearer \S+$/.test(auth)) return _json({ ok: false, error: 'signin' }, 401);
  const sbHeaders = { apikey: SUPABASE_ANON, Authorization: auth, 'Content-Type': 'application/json' };
  const userRes = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, { headers: sbHeaders });
  if (!userRes.ok) return _json({ ok: false, error: 'signin' }, 401);
  const user = await userRes.json();
  if (!user || typeof user.id !== 'string') return _json({ ok: false, error: 'signin' }, 401);
  const allow = parseAllowList(env.GOOGLE_ALLOWED_EMAILS);
  if (allow.length && !allow.includes(String(user.email || '').trim().toLowerCase())) return _json({ ok: false, error: 'forbidden' }, 403);
  const rpc = async (fn, args) => {
    const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: sbHeaders, body: JSON.stringify({ p_key: env.ARKIVES_DB_KEY, ...args }) });
    return { ok: r.ok, data: r.ok ? await r.json().catch(() => null) : null };
  };

  if (route === 'connect') {
    const nonce = randomToken(16);
    const q = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri(env, req.url),
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: await makeState(master, user.id, nonce),
    });
    if (user.email) q.set('login_hint', String(user.email));
    return _json({ ok: true, url: 'https://accounts.google.com/o/oauth2/v2/auth?' + q }, 200, { 'Set-Cookie': cookie('ark_g_nonce', nonce, 600) });
  }

  if (route === 'finish') {
    const clear = { 'Set-Cookie': cookie('ark_g_pending', '', 0) };
    const raw = await open(master, 'google-pending', user.id, readCookie(req, 'ark_g_pending'));
    if (!raw) return _json({ ok: false, error: 'expired' }, 400, clear);
    const p = JSON.parse(raw);
    const put = await rpc('google_conn_put', { p_email: p.email, p_scopes: p.scopes, p_token: p.token });
    if (!put.ok) return _json({ ok: false, error: 'save_failed' }, 502, clear);
    return _json({ ok: true, email: p.email }, 200, clear);
  }

  // Routes below need the stored token
  const tokRow = await rpc('google_conn_token', {});
  const refresh = tokRow.ok && typeof tokRow.data === 'string' ? await open(master, 'google-token', user.id, tokRow.data) : null;

  if (route === 'disconnect') {
    if (refresh) {
      await fetchImpl('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refresh }) }).catch(() => {});
    }
    const del = await rpc('google_conn_delete', {});
    return _json({ ok: del.ok }, del.ok ? 200 : 502);
  }

  if (!refresh) return _json({ ok: false, error: 'not_connected' }, 409);
  const tr = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  const at = tr.ok ? await tr.json().catch(() => null) : null;
  if (!at || !at.access_token) {
    const body = tr.ok ? null : await tr.json().catch(() => null);
    if (body && body.error === 'invalid_grant') {
      // Revoked at Google, expired, or password reset: show "Reconnect"
      await rpc('google_conn_mark', { p_status: 'revoked' });
      return _json({ ok: false, error: 'reconnect' }, 409);
    }
    return _json({ ok: false, error: 'google_unavailable' }, 502);
  }
  const gh = { Authorization: 'Bearer ' + at.access_token, 'Content-Type': 'application/json' };

  if (route === 'events') {
    const from = Date.parse(url.searchParams.get('from') || '');
    const to = Date.parse(url.searchParams.get('to') || '');
    if (!(from && to && to > from && to - from <= MAX_WINDOW_MS)) return _json({ ok: false, error: 'range' }, 400);
    const q = new URLSearchParams({
      timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(),
      singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
      fields: 'items(id,status,summary,start,end,htmlLink,hangoutLink,extendedProperties/private)',
    });
    const r = await fetchImpl(CAL + '?' + q, { headers: gh });
    if (!r.ok) return _json({ ok: false, error: 'google_' + r.status }, 502);
    const data = await r.json();
    const events = (data.items || []).filter((e) => e.status !== 'cancelled').map(slimEvent);
    return _json({ ok: true, events });
  }

  let body = {};
  try { body = await req.json(); } catch { body = {}; }

  if (route === 'push') {
    const date = String(body.date || '');
    const title = String(body.title || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title || title.length > 200) return _json({ ok: false, error: 'invalid' }, 400);
    const ev = {
      summary: title,
      description: String(body.details || '').slice(0, 2000),
      start: { date }, end: { date: nextDay(date) },
      transparency: 'transparent', // a deadline, not a meeting: does not block free/busy
      extendedProperties: { private: { arkives: '1' } },
    };
    const r = await fetchImpl(CAL + '?sendUpdates=none', { method: 'POST', headers: gh, body: JSON.stringify(ev) });
    if (!r.ok) return _json({ ok: false, error: 'google_' + r.status }, 502);
    const made = await r.json();
    return _json({ ok: true, id: String(made.id || '') });
  }

  if (route === 'remove') {
    const id = String(body.id || '');
    if (!/^[a-v0-9_]{5,1024}$/.test(id)) return _json({ ok: false, error: 'invalid' }, 400);
    // Only ever delete events Arkives created, never the user's own
    const g = await fetchImpl(CAL + '/' + id + '?fields=extendedProperties/private', { headers: gh });
    if (g.status === 404 || g.status === 410) return _json({ ok: true, gone: true });
    if (!g.ok) return _json({ ok: false, error: 'google_' + g.status }, 502);
    const ev = await g.json();
    if (!(ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.arkives === '1')) return _json({ ok: false, error: 'not_arkives' }, 403);
    const d = await fetchImpl(CAL + '/' + id + '?sendUpdates=none', { method: 'DELETE', headers: gh });
    return _json({ ok: d.ok || d.status === 410 }, d.ok || d.status === 410 ? 200 : 502);
  }

  return _json({ ok: false, error: 'not_found' }, 404);
}
