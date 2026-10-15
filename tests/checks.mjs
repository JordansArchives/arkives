// Logic checks: load the real app, stub Supabase at the function boundary,
// and assert the behavior the 2026-09 audit fixed. Fast (one page load).
//
//   npm run test:checks
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { startServer, launchOptions, siteHeaders, ROOT } from './_server.mjs';

// ---- Static guards (source, not runtime) ----
// The Content-Security-Policy has no 'unsafe-inline' for scripts, so an
// inline handler or inline <script> would silently do nothing in
// production. Catch it here, at the point of introduction.
const staticOut = [];
const S = (name, cond, detail) => staticOut.push({ name, pass: !!cond, detail: detail === undefined ? '' : String(detail) });
const SRC = ['index.html', 'theme.js', ...(function ls(d) { return fs.readdirSync(ROOT + d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? ls(d + e.name + '/') : (e.name.endsWith('.js') ? [d + e.name] : [])); })('src/')];
const INLINE_RE = /\son(click|dblclick|input|change|keydown|keyup|keypress|submit|load|error|focus|blur|mouse[a-z]+|pointer[a-z]+|touch[a-z]+|contextmenu|wheel|scroll|paste|drop|drag[a-z]*)\s*=/gi;
const actionNames = new Set();
const inlineHits = [], badArgs = [];
for (const f of SRC) {
  const src = fs.readFileSync(ROOT + f, 'utf8');
  src.split('\n').forEach((ln, i) => {
    for (const m of ln.matchAll(INLINE_RE)) inlineHits.push(f + ':' + (i + 1) + ' on' + m[1]);
    for (const m of ln.matchAll(/data-(action|input|change|keydown|submit)="([^"]*)"/g)) actionNames.add(m[2]);
    // constant args must be a JSON array (dynamic ones go through _args at runtime)
    for (const m of ln.matchAll(/data-(args|input-args|change-args|keydown-args|submit-args)="([^"]*)"/g)) {
      if (/\$\{|' \+/.test(m[2])) continue;
      try { if (!Array.isArray(JSON.parse(m[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&')))) throw 0; } catch (e) { badArgs.push(f + ':' + (i + 1) + ' ' + m[2]); }
    }
  });
}
S('no inline event handlers in public/', inlineHits.length === 0, inlineHits.join(', '));
S('no inline <script> blocks in index.html', !/<script(?![^>]*\ssrc=)[^>]*>/i.test(fs.readFileSync(ROOT + 'index.html', 'utf8')));
S('every constant data-*-args attribute is a JSON array', badArgs.length === 0, badArgs.join(' | '));
S('action names are plain identifiers', [...actionNames].every(n => /^[A-Za-z_$][\w$]*$/.test(n)), [...actionNames].filter(n => !/^[A-Za-z_$][\w$]*$/.test(n)).join(', '));
// A storage policy's subquery runs as the caller. boards and scripts are
// owner-only, so a shared-media policy that reads either directly refuses
// every visitor. The last migration to define each policy must go through
// the SECURITY DEFINER helper (023 for boards, 024 for scripts).
{
  const MIG = ROOT + '../migrations/';
  const files = fs.readdirSync(MIG).filter((n) => /^\d{3}_.*\.sql$/.test(n)).sort();
  for (const [table, prefix] of [['boards', 'board_media'], ['scripts', 'script_media']]) {
    const latest = {};
    for (const f of files) {
      const sql = fs.readFileSync(MIG + f, 'utf8');
      for (const m of sql.matchAll(new RegExp('CREATE POLICY "(' + prefix + '_\\w+_shared)"[\\s\\S]*?;', 'g'))) latest[m[1]] = { file: f, body: m[0] };
    }
    const names = Object.keys(latest);
    const direct = names.filter((n) => new RegExp('FROM\\s+(public\\.)?' + table + '\\b', 'i').test(latest[n].body));
    S('shared-' + table + ' storage policies exist for read, write and delete', names.length === 3, names.join(', '));
    S('shared-' + table + ' storage policies do not query ' + table + ' as the visitor', direct.length === 0, direct.map((n) => n + ' in ' + latest[n].file).join(', '));
  }
}
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const preloads = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);
const moduleFiles = SRC.filter((f) => f.startsWith('src/') && f !== 'src/main.js');
S('every module is preloaded from index.html', moduleFiles.every((f) => preloads.includes(f)), moduleFiles.filter((f) => !preloads.includes(f)).join(', '));
S('every preload points at a real module', preloads.every((p) => moduleFiles.includes(p)), preloads.filter((p) => !moduleFiles.includes(p)).join(', '));
S('index.html loads src/main.js as a module and nothing else', /<script type="module" src="src\/main.js"><\/script>/.test(html) && !/<script defer src="[a-z-]+\.js">/.test(html));
const hdr = siteHeaders();
S('_headers enforces the CSP (not report-only)', !!hdr['content-security-policy'] && !hdr['content-security-policy-report-only']);
S("script-src has no 'unsafe-inline' or 'unsafe-eval'", (() => { const d = (hdr['content-security-policy'] || '').split(';').find(x => x.trim().startsWith('script-src')) || ''; return d && !/unsafe-inline|unsafe-eval/.test(d); })());

// ---- Social scan Worker (worker/scan.js), run in Node with a fake fetch ----
{
  const W = await import('../worker/scan.js');
  S('scan: handle cleanup strips @, URLs and paths', W.cleanHandle('@me.x') === 'me.x' && W.cleanHandle('https://instagram.com/me.x/?hl=en') === 'me.x' && W.cleanHandle('') === '');
  S('scan: no handle = nothing to scan', W.actorInput('instagram', { handle: '' }) === null && W.actorInput('tiktok', null) === null && W.actorInput('twitter', { handle: '' }) === null && W.actorInput('linkedin', null) === null);
  S('scan: X / LinkedIn / Threads inputs', W.actorInput('twitter', { handle: '@me' }).profileUrls[0] === 'https://x.com/me' && W.actorInput('linkedin', { handle: 'me' }).urls[0] === 'https://www.linkedin.com/in/me' && W.actorInput('linkedin', { handle: 'https://www.linkedin.com/in/me/' }).urls[0] === 'https://www.linkedin.com/in/me/' && W.actorInput('threads', { handle: '@me.x' }).usernames[0] === 'me.x');
  const xr = W.parseResult('twitter', [{ followers: 2315, following: 71, tweets_count: 184, status: 'available' }]);
  const lr = W.parseResult('linkedin', [{ followerCount: 481, connectionsCount: 441 }]);
  const tr = W.parseResult('threads', [{ follower_count: 13272 }]);
  S('scan: X / LinkedIn / Threads parse (shapes from live runs 2026-10-12)', xr.followers === 2315 && xr.posts === 184 && lr.followers === 481 && lr.connections === 441 && tr.followers === 13272 && !!W.parseResult('twitter', [{ is_protected: true, followers: 1 }]).error && !!W.parseResult('threads', [{}]).error, JSON.stringify([xr, lr, tr]));
  const m2 = W.mergePayload({}, { twitter: xr, linkedin: lr, threads: tr }, '2026-10-12', 'NOW');
  S('scan: X / LinkedIn / Threads land in the snapshot and detail', m2.snapshots[0].platforms.twitter.followers === 2315 && m2.snapshots[0].platforms.linkedin.connections === 441 && m2.snapshots[0].platforms.threads.followers === 13272 && m2.platforms.twitter.tweets === 184 && m2.platforms.linkedin.connections === 441);
  S('scan: YouTube uses the profile URL, else @handle', W.actorInput('youtube', { handle: 'me', profile_url: 'https://youtube.com/c/Me' }).startUrls[0].url === 'https://youtube.com/c/Me' && W.actorInput('youtube', { handle: '@me' }).startUrls[0].url === 'https://www.youtube.com/@me');
  const ig = W.parseResult('instagram', [{ followersCount: 270000, followsCount: 500, postsCount: 130, latestPosts: [{ likesCount: 9000, commentsCount: 100, isPinned: true }, { likesCount: 2000, commentsCount: 100 }, { likesCount: 4000, commentsCount: 300 }] }]);
  S('scan: Instagram parse skips pinned posts for engagement', ig.followers === 270000 && ig.posts === 130 && ig.averageLikes === 3000 && ig.averageComments === 200 && ig.engagementRate === 1.19, JSON.stringify(ig));
  S('scan: Instagram private / empty / missing are errors', !!W.parseResult('instagram', [{ private: true }]).error && !!W.parseResult('instagram', []).error && !!W.parseResult('instagram', [{}]).error);
  const tt = W.parseResult('tiktok', [{ playCount: 1000, authorMeta: { fans: 32000, heart: 3900000, video: 270, following: 100 } }, { playCount: 3000, authorMeta: { fans: 32000 } }]);
  S('scan: TikTok parse reads authorMeta and average views', tt.followers === 32000 && tt.likes === 3900000 && tt.videos === 270 && tt.averageViews === 2000, JSON.stringify(tt));
  const yt = W.parseResult('youtube', [{ aboutChannelInfo: { numberOfSubscribers: 612, channelTotalVideos: 11, channelTotalViews: 12000 } }]);
  S('scan: YouTube parse reads aboutChannelInfo', yt.followers === 612 && yt.videos === 11 && yt.views === 12000);
  S('scan: platforms row update formats the display count', JSON.stringify(W.platformRowUpdate('tiktok', tt)) === JSON.stringify({ followers: 32000, followers_display: '32K', likes: '3.9M', videos: 270 }));
  const old = { platforms: { instagram: { handle: 'me', grade: 'B+', followers: 1 } }, snapshots: [{ platform: 'instagram', date: '2026-03-01', followers: 1 }, { date: '2026-10-11', platforms: { linkedin: { followers: 9 } } }], last_fetch: 'x' };
  const merged = W.mergePayload(old, { instagram: ig, tiktok: { error: 'nope' }, youtube: yt }, '2026-10-11', '2026-10-11T12:00:00Z');
  S('scan: merge keeps history, replaces the same-day snapshot, skips errors', merged.snapshots.length === 2 && merged.snapshots[1].platforms.linkedin.followers === 9 && merged.snapshots[1].platforms.instagram.followers === 270000 && merged.snapshots[1].platforms.youtube.subscribers === 612 && !merged.snapshots[1].platforms.tiktok && merged.platforms.instagram.grade === 'B+' && merged.platforms.instagram.average_likes === 3000 && merged.last_fetch === '2026-10-11T12:00:00Z' && old.snapshots.length === 2, JSON.stringify(merged.snapshots));
  S('scan: merge with nothing successful leaves last_fetch alone', W.mergePayload(old, { instagram: { error: 'x' } }, '2026-10-12', 'NOW').last_fetch === 'x');

  // handleScan end to end against fake Supabase + Apify
  const calls = [];
  const fakeFetch = (opts) => async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body, auth: (init.headers || {}).Authorization });
    const J = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url.includes('/auth/v1/user')) return opts.authOk ? J({ email: 'me@x.com' }) : J({}, 401);
    if (url.includes('/rest/v1/platforms?select')) return J([{ id: 'pl1', platform: 'instagram', handle: '@me' }, { id: 'pl2', platform: 'tiktok', handle: 'me' }, { id: 'pl3', platform: 'youtube', handle: '' }]);
    if (url.includes('/rest/v1/social_stats?select')) return J(opts.stats ? [opts.stats] : []);
    if (url.includes('instagram-profile-scraper')) return opts.igBusy && opts.igBusy-- ? J({ error: { type: 'actor-memory-limit-exceeded' } }, 402) : J([{ followersCount: 271000, postsCount: 131, latestPosts: [] }]);
    if (url.includes('tiktok-profile-scraper')) return opts.ttFail ? J({ error: 'x' }, 402) : J([{ authorMeta: { fans: 33000 } }]);
    if (init.method === 'PATCH' || init.method === 'POST') return J([], 201);
    return J({}, 404);
  };
  const req = (auth = 'Bearer jwt') => new Request('https://arkives.xyz/api/social-scan', { method: 'POST', headers: auth ? { Authorization: auth } : {}, body: JSON.stringify({ date: '2026-10-11' }) });
  const r401 = await W.handleScan(req(''), { APIFY_TOKEN: 't' }, fakeFetch({ authOk: true }));
  const r401b = await W.handleScan(req(), { APIFY_TOKEN: 't' }, fakeFetch({ authOk: false }));
  const r503 = await W.handleScan(req(), {}, fakeFetch({ authOk: true }));
  const r403 = await W.handleScan(req(), { APIFY_TOKEN: 't', SCAN_ALLOWED_EMAILS: 'boss@x.com' }, fakeFetch({ authOk: true }));
  S('scan: allowlist tolerates quotes, spaces, semicolons and case', JSON.stringify(W.parseAllowList(' "Me@X.com" ; <b@y.com>\n,')) === JSON.stringify(['me@x.com', 'b@y.com']) && W.parseAllowList('').length === 0);
  const r403b = await W.handleScan(req(), { APIFY_TOKEN: 't', SCAN_ALLOWED_EMAILS: '"ME@x.com "' }, fakeFetch({ authOk: true, stats: { id: 's1', payload: { last_fetch: new Date().toISOString() } } }));
  S('scan: a pasted-with-quotes allowlist still admits the owner', r403b.status === 429);
  S('scan: no token / bad session / not allowed / not configured are refused', r401.status === 401 && r401b.status === 401 && r403.status === 403 && (await r403.clone().json()).email === 'me@x.com' && r503.status === 503 && (await r503.json()).error === 'not_configured');
  const r429 = await W.handleScan(req(), { APIFY_TOKEN: 't' }, fakeFetch({ authOk: true, stats: { id: 's1', payload: { last_fetch: new Date(Date.now() - 60000).toISOString() } } }));
  S('scan: a second scan inside 10 minutes is refused (credit guard)', r429.status === 429 && (await r429.json()).retryAfterSec > 0);
  calls.length = 0;
  const ok = await W.handleScan(req(), { APIFY_TOKEN: 't' }, fakeFetch({ authOk: true, ttFail: true, stats: { id: 's1', payload: { last_fetch: '2026-01-01T00:00:00Z', snapshots: [] } } }));
  const okBody = await ok.json();
  const patches = calls.filter((c) => c.method === 'PATCH');
  S('scan: success scans only platforms with handles and reports per-platform errors', ok.status === 200 && okBody.ok && okBody.results.instagram.followers === 271000 && okBody.results.tiktok.error === 'Apify credit used up' && okBody.results.youtube.skipped === true && !calls.some((c) => c.url.includes('youtube-channel-scraper')), JSON.stringify(okBody));
  calls.length = 0;
  const busy = await (await W.handleScan(req(), { APIFY_TOKEN: 't' }, fakeFetch({ authOk: true, igBusy: 1, stats: { id: 's1', payload: { last_fetch: '2026-01-01T00:00:00Z', snapshots: [] } } }))).json();
  const busy2 = await (await W.handleScan(req(), { APIFY_TOKEN: 't' }, fakeFetch({ authOk: true, igBusy: 2, stats: { id: 's1', payload: { last_fetch: '2026-01-01T00:00:00Z', snapshots: [] } } }))).json();
  S('scan: a 402 memory-limit run is retried once after the batch, and named as busy (not credit) if it still fails', busy.results.instagram.followers === 271000 && !('retry' in busy.results.instagram) && busy2.results.instagram.error === 'Apify busy (memory limit), scan again' && !('retry' in busy2.results.instagram), JSON.stringify([busy, busy2]));
  S('scan: success writes the Instagram row and the social_stats snapshot, as the caller', patches.length === 2 && patches.some((c) => c.url.includes('platforms?id=eq.pl1') && JSON.parse(c.body).followers === 271000) && patches.some((c) => c.url.includes('social_stats?id=eq.s1') && JSON.parse(c.body).payload.snapshots[0].date === '2026-10-11') && !patches.some((c) => c.url.includes('pl2')));
  S('scan: Supabase calls carry the caller JWT, only Apify gets the Apify token', calls.filter((c) => c.url.includes('supabase.co')).every((c) => c.auth === 'Bearer jwt') && calls.filter((c) => c.url.includes('api.apify.com')).every((c) => c.auth === 'Bearer t' && !c.url.includes('token=')));
  {
    const tc = [];
    const f = async (url, init = {}) => {
      tc.push({ url: String(url), method: init.method || 'GET', body: init.body });
      const J = (x, status = 200) => new Response(JSON.stringify(x), { status });
      if (url.includes('/auth/v1/user')) return J({ id: 'auth-1', email: 'me@x.com' });
      if (url.includes('/rest/v1/platforms?select')) return J([{ id: 'pl1', user_id: 'prof-1', platform: 'instagram', handle: '@me.x' }]);
      if (url.includes('/rest/v1/social_stats?select')) return J([]);
      if (url.includes('threads-profile-api-scraper')) return J([{ follower_count: 13272 }]);
      if (url.includes('api.apify.com')) return J([], 200);
      return J([], 201);
    };
    const res = await W.handleScan(new Request('https://arkives.xyz/api/social-scan', { method: 'POST', headers: { Authorization: 'Bearer jwt' }, body: '{}' }), { APIFY_TOKEN: 't' }, f);
    const body = await res.json();
    const th = tc.find((c) => c.url.includes('threads-profile-api-scraper'));
    const post = tc.find((c) => c.method === 'POST' && c.url.endsWith('/rest/v1/platforms'));
    S('scan: Threads with no row scans the Instagram handle and creates the row under the profile id', body.results.threads.followers === 13272 && th && JSON.parse(th.body).usernames[0] === 'me.x' && post && JSON.parse(post.body).user_id === 'prof-1' && JSON.parse(post.body).platform === 'threads' && JSON.parse(post.body).followers === 13272 && body.results.twitter.skipped === true, JSON.stringify(body));
  }
  const css = fs.readFileSync(ROOT + 'style.css', 'utf8');
  S('buttons keep a hover footprint so the lift cannot flicker', /\.btn \{ position: relative; \}/.test(css) && /\.btn::after \{ content: ''; position: absolute; inset: -2px -4px -4px -2px; \}/.test(css));
  const wsrc = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  S('wrangler: worker runs first only for /api/*', /"run_worker_first":\s*\["\/api\/\*"\]/.test(wsrc) && /"main":\s*"worker\/index\.js"/.test(wsrc) && /"binding":\s*"ASSETS"/.test(wsrc));
}

// ---- Google connection + inbox Workers (worker/google.js, worker/inbox.js, worker/crypto.js) ----
{
  const C = await import('../worker/crypto.js');
  const G = await import('../worker/google.js');
  const I = await import('../worker/inbox.js');
  const MASTER = Buffer.alloc(32, 7).toString('base64');
  const OTHER = Buffer.alloc(32, 9).toString('base64');
  const sealed = await C.seal(MASTER, 'google-token', 'user-a', 'refresh-123');
  S('crypto: seal/open round-trips for the same user', await C.open(MASTER, 'google-token', 'user-a', sealed) === 'refresh-123' && /^v1\.[\w-]+\.[\w-]+$/.test(sealed));
  S('crypto: a token sealed for one user does not open for another', await C.open(MASTER, 'google-token', 'user-b', sealed) === null);
  S('crypto: wrong purpose or wrong master key fails closed', await C.open(MASTER, 'google-pending', 'user-a', sealed) === null && await C.open(OTHER, 'google-token', 'user-a', sealed) === null);
  const flipped = sealed.slice(0, -2) + (sealed.slice(-2) === 'AA' ? 'AB' : 'AA');
  S('crypto: tampered ciphertext fails closed', await C.open(MASTER, 'google-token', 'user-a', flipped) === null && await C.open(MASTER, 'google-token', 'user-a', 'garbage') === null);
  S('crypto: a short master key is refused', await C.seal('c2hvcnQ=', 'x', 'u', 't').then(() => false, () => true));

  const st = await G.makeState(MASTER, 'user-a', 'nonce-1');
  S('oauth state: valid with the matching nonce cookie', (await G.readState(MASTER, st, 'nonce-1'))?.u === 'user-a');
  S('oauth state: rejected without or with a different nonce cookie (login CSRF)', await G.readState(MASTER, st, '') === null && await G.readState(MASTER, st, 'nonce-2') === null);
  S('oauth state: rejected when expired or signed with another key', await G.readState(MASTER, st, 'nonce-1', Date.now() + 11 * 60 * 1000) === null && await G.readState(OTHER, st, 'nonce-1') === null);
  const [pl, sig] = st.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'victim', n: 'nonce-1', e: Date.now() + 60000 })).toString('base64url') + '.' + sig;
  S('oauth state: a swapped user id breaks the signature', await G.readState(MASTER, forged, 'nonce-1') === null && !!pl);
  S('oauth scopes: calendar only, no Gmail', G.GOOGLE_SCOPES.some((x) => x.endsWith('calendar.events.owned')) && !G.GOOGLE_SCOPES.some((x) => /gmail|mail\.google|drive/.test(x)));
  S('events: only Google https links survive', G.slimEvent({ id: 'a', htmlLink: 'javascript:alert(1)', hangoutLink: 'https://evil.com/x', start: { date: '2026-10-01' }, end: { date: '2026-10-02' } }).link === '' && G.slimEvent({ id: 'a', htmlLink: 'https://www.google.com/calendar/event?eid=1', hangoutLink: 'https://meet.google.com/abc', start: { dateTime: '2026-10-01T10:00:00Z' } }).meet === 'https://meet.google.com/abc');
  S('events: all-day flag and Arkives marker', G.slimEvent({ start: { date: '2026-10-01' }, extendedProperties: { private: { arkives: '1' } } }).allDay === true && G.slimEvent({ start: { date: '2026-10-01' }, extendedProperties: { private: { arkives: '1' } } }).arkives === true && G.nextDay('2026-12-31') === '2027-01-01');

  // handleGoogle end to end against fake Supabase + Google
  const ENV = { GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csec', ARKIVES_MASTER_KEY: MASTER, ARKIVES_DB_KEY: 'k'.repeat(40) };
  const gcalls = [];
  const gfake = (o = {}) => async (url, init = {}) => {
    url = String(url); gcalls.push({ url, method: init.method || 'GET', body: init.body ? String(init.body) : '' });
    const J = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url.includes('/auth/v1/user')) return J({ id: 'user-a', email: 'me@x.com' });
    if (url.endsWith('/rpc/google_conn_token')) return J(o.token === undefined ? null : o.token);
    if (url.includes('/rpc/')) return J(true);
    if (url === 'https://oauth2.googleapis.com/token') return o.invalidGrant ? J({ error: 'invalid_grant' }, 400) : J({ access_token: 'AT', refresh_token: 'RT', scope: o.scope || 'openid email https://www.googleapis.com/auth/calendar.events.owned', id_token: 'x.' + Buffer.from(JSON.stringify({ email: 'me@gmail.com', email_verified: true })).toString('base64url') + '.y' });
    if (url.includes('/calendar/v3/') && (init.method || 'GET') === 'GET' && url.includes('fields=extendedProperties')) return J(o.ownEvent ? { extendedProperties: { private: { arkives: '1' } } } : {});
    if (url.includes('/calendar/v3/') && (init.method || 'GET') === 'GET') return J({ items: [{ id: 'e1', summary: 'Call', start: { dateTime: '2026-10-15T10:00:00Z' }, end: { dateTime: '2026-10-15T11:00:00Z' } }, { id: 'e2', status: 'cancelled', start: { date: '2026-10-16' } }] });
    if (url.includes('/calendar/v3/') && init.method === 'POST') return J({ id: 'newevt' });
    if (url.includes('/calendar/v3/') && init.method === 'DELETE') return new Response(null, { status: 204 });
    if (url.includes('/revoke')) return J({});
    return J({}, 404);
  };
  const req = (path, init = {}) => new Request('https://arkives.xyz' + path, init);
  const authH = { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' };
  let r = await G.handleGoogle(req('/api/google/connect', { method: 'POST', headers: authH }), {}, gfake());
  S('google: 503 when secrets are missing', r.status === 503);
  r = await G.handleGoogle(req('/api/google/events?from=2026-10-01&to=2026-11-01'), ENV, gfake());
  S('google: signed-out calls are refused', r.status === 401);
  r = await G.handleGoogle(req('/api/google/connect', { method: 'POST', headers: authH }), { ...ENV, GOOGLE_ALLOWED_EMAILS: 'someone@else.com' }, gfake());
  S('google: GOOGLE_ALLOWED_EMAILS blocks every other login', r.status === 403 && (await r.json()).error === 'forbidden');
  r = await G.handleGoogle(req('/api/google/connect', { method: 'POST', headers: authH }), { ...ENV, GOOGLE_ALLOWED_EMAILS: 'Me@X.com, other@y.com' }, gfake());
  S('google: an allowlisted login (any case) can connect', r.status === 200);
  r = await G.handleGoogle(req('/api/google/connect', { method: 'POST', headers: authH }), ENV, gfake());
  const cj = await r.json(); const setC = r.headers.get('Set-Cookie') || '';
  const authUrl = new URL(cj.url);
  S('google connect: consent URL with offline access, our scopes, state, and an HttpOnly nonce cookie', authUrl.origin === 'https://accounts.google.com' && authUrl.searchParams.get('access_type') === 'offline' && authUrl.searchParams.get('prompt') === 'consent' && authUrl.searchParams.get('redirect_uri') === 'https://arkives.xyz/api/google/callback' && /calendar\.events\.owned/.test(authUrl.searchParams.get('scope')) && /^ark_g_nonce=[\w-]+; Path=\/api\/google; Max-Age=600; HttpOnly; Secure; SameSite=Lax$/.test(setC));
  const nonce = setC.split(';')[0].split('=')[1];
  const cb = (q, cookieHdr, o) => G.handleGoogle(req('/api/google/callback?' + q, { headers: { Cookie: cookieHdr } }), ENV, gfake(o));
  r = await cb('code=c&state=' + encodeURIComponent(authUrl.searchParams.get('state')), 'ark_g_nonce=wrong');
  S('google callback: a mismatched nonce is refused (no token exchange)', r.status === 303 && /google=error&reason=state/.test(r.headers.get('Location')) && !gcalls.some((c) => c.url === 'https://oauth2.googleapis.com/token' && /authorization_code/.test(c.body)));
  r = await cb('code=c&state=' + encodeURIComponent(authUrl.searchParams.get('state')), 'ark_g_nonce=' + nonce, { scope: 'openid email' });
  S('google callback: calendar box unticked -> revoke and explain', /reason=scope/.test(r.headers.get('Location')) && gcalls.some((c) => c.url.includes('/revoke')));
  r = await cb('code=c&state=' + encodeURIComponent(authUrl.searchParams.get('state')), 'ark_g_nonce=' + nonce);
  const pendingCookie = (r.headers.get('Set-Cookie') || '').split(/,\s*(?=ark_g_)/).find((x) => x.startsWith('ark_g_pending=')) || '';
  const pendingVal = pendingCookie.split(';')[0].slice('ark_g_pending='.length);
  const parked = JSON.parse(await C.open(MASTER, 'google-pending', 'user-a', pendingVal) || '{}');
  S('google callback: parks a sealed token in an HttpOnly cookie, never the raw token', r.status === 303 && /\/\?google=finish#settings$/.test(r.headers.get('Location')) && /HttpOnly; Secure/.test(pendingCookie) && parked.token !== 'RT' && await C.open(MASTER, 'google-token', 'user-a', parked.token) === 'RT' && await C.open(MASTER, 'google-pending', 'user-b', pendingVal) === null);
  gcalls.length = 0;
  r = await G.handleGoogle(req('/api/google/finish', { method: 'POST', headers: { ...authH, Cookie: 'ark_g_pending=' + pendingVal } }), ENV, gfake());
  const put = gcalls.find((c) => c.url.endsWith('/rpc/google_conn_put'));
  const putBody = put ? JSON.parse(put.body) : {};
  S('google finish: stores ciphertext bound to the user, with the DB key, as the user', r.status === 200 && putBody.p_key === ENV.ARKIVES_DB_KEY && putBody.p_email === 'me@gmail.com' && putBody.p_token !== 'RT' && await C.open(MASTER, 'google-token', 'user-a', putBody.p_token) === 'RT');
  const otherUser = async (url, init) => String(url).includes('/auth/v1/user') ? new Response(JSON.stringify({ id: 'user-b' })) : gfake()(url, init);
  r = await G.handleGoogle(req('/api/google/finish', { method: 'POST', headers: { ...authH, Cookie: 'ark_g_pending=' + pendingVal } }), ENV, otherUser);
  S('google finish: a parked token cannot be claimed by a different account', r.status === 400);
  const tok = await C.seal(MASTER, 'google-token', 'user-a', 'RT');
  r = await G.handleGoogle(req('/api/google/events?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z', { headers: authH }), ENV, gfake({ token: tok }));
  const ev = await r.json();
  S('google events: refreshes, lists, drops cancelled', ev.ok && ev.events.length === 1 && ev.events[0].title === 'Call');
  r = await G.handleGoogle(req('/api/google/events?from=2026-01-01&to=2026-12-31', { headers: authH }), ENV, gfake({ token: tok }));
  S('google events: windows over 70 days are refused', r.status === 400);
  r = await G.handleGoogle(req('/api/google/events?from=2026-10-01&to=2026-11-01', { headers: authH }), ENV, gfake({ token: tok, invalidGrant: true }));
  S('google events: a revoked grant marks the connection and asks to reconnect', r.status === 409 && (await r.json()).error === 'reconnect');
  r = await G.handleGoogle(req('/api/google/events?from=2026-10-01&to=2026-11-01', { headers: authH }), ENV, gfake({ token: await C.seal(MASTER, 'google-token', 'user-b', 'RT') }));
  S('google events: another user\'s ciphertext is useless', r.status === 409 && (await r.json()).error === 'not_connected');
  r = await G.handleGoogle(req('/api/google/remove', { method: 'POST', headers: authH, body: JSON.stringify({ id: 'abc123def' }) }), ENV, gfake({ token: tok }));
  S('google remove: refuses to delete events Arkives did not create', r.status === 403);
  gcalls.length = 0;
  r = await G.handleGoogle(req('/api/google/remove', { method: 'POST', headers: authH, body: JSON.stringify({ id: 'abc123def' }) }), ENV, gfake({ token: tok, ownEvent: true }));
  S('google remove: deletes its own events', r.status === 200 && gcalls.some((c) => c.method === 'DELETE'));
  r = await G.handleGoogle(req('/api/google/push', { method: 'POST', headers: authH, body: JSON.stringify({ date: '2026-10-20', title: 'Reel due' }) }), ENV, gfake({ token: tok }));
  const pushed = gcalls.filter((c) => c.method === 'POST' && c.url.includes('/calendar/v3/')).pop();
  S('google push: all-day, marked as Arkives, does not block free/busy', (await r.json()).id === 'newevt' && /"arkives":"1"/.test(pushed.body) && /"transparency":"transparent"/.test(pushed.body) && /"end":\{"date":"2026-10-21"\}/.test(pushed.body));

  // Inbox email handler
  S('inbox: address token parsing', I.addressToken('deals-0123456789abcdef0123456789abcdef@arkives.xyz') === '0123456789abcdef0123456789abcdef' && I.addressToken('hello@arkives.xyz') === null && I.addressToken('deals-x@arkives.xyz') === null);
  S('inbox: brand guess from sender domain', I.brandGuess('Partnerships', 'partners@nike.com') === 'Nike' && I.brandGuess('Jane', 'jane@gmail.com') === 'Jane' && I.brandGuess('', 'a@mail.brand.co.uk') === 'Brand');
  const rawMail = 'From: "Acme Partnerships" <partners@acme.com>\r\nTo: deals-0123456789abcdef0123456789abcdef@arkives.xyz\r\nSubject: =?UTF-8?B?Q29sbGFiIOKcqA==?=\r\nMessage-ID: <abc.123@acme.com>\r\nDate: Wed, 14 Oct 2026 10:00:00 +0000\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><style>p{}</style><p>Hi Jordan,</p><p>Spring campaign &amp; rates?</p><script>x()</script></html>\r\n';
  const sum = await I.summarize(new TextEncoder().encode(rawMail).buffer);
  S('inbox: parses sender, encoded subject, Message-ID; HTML becomes plain text', sum.p_from_email === 'partners@acme.com' && sum.p_brand === 'Acme' && sum.p_subject === 'Collab ✨' && sum.p_message_id === 'abc.123@acme.com' && /Hi Jordan,\s+Spring campaign & rates\?/.test(sum.p_preview) && !/<|script|x\(\)/.test(sum.p_preview), JSON.stringify(sum));
  const mkMsg = (to, size = 100) => { const m = { to, rawSize: size, raw: new Blob([rawMail]).stream(), rejected: '' }; m.setReject = (why) => { m.rejected = why; }; return m; };
  const icalls = [];
  const ifake = (res) => async (url, init) => { icalls.push({ url: String(url), body: JSON.parse(init.body), auth: init.headers.Authorization }); return new Response(JSON.stringify(res)); };
  let m = mkMsg('someone@arkives.xyz'); await I.handleEmail(m, ENV, ifake('ok'));
  S('inbox: mail to a non-deals address is rejected without touching the DB', m.rejected === 'Unknown address' && icalls.length === 0);
  m = mkMsg('deals-0123456789abcdef0123456789abcdef@arkives.xyz', 50 * 1024 * 1024); await I.handleEmail(m, ENV, ifake('ok'));
  S('inbox: oversized mail is rejected', m.rejected === 'Message too large' && icalls.length === 0);
  m = mkMsg('deals-0123456789abcdef0123456789abcdef@arkives.xyz'); await I.handleEmail(m, ENV, ifake('ok'));
  S('inbox: files through inbox_ingest with the DB key and no user session', !m.rejected && icalls[0].url.endsWith('/rpc/inbox_ingest') && icalls[0].body.p_key === ENV.ARKIVES_DB_KEY && icalls[0].body.p_token === '0123456789abcdef0123456789abcdef' && icalls[0].auth === undefined);
  m = mkMsg('deals-ffffffffffffffffffffffffffffffff@arkives.xyz'); await I.handleEmail(m, ENV, ifake('unknown'));
  S('inbox: a token the DB does not know is rejected', m.rejected === 'Unknown address');

  // Migration 029: no direct table access, every token/ingest function gated by the worker key
  const m29 = fs.readFileSync(new URL('../migrations/029_google_and_inbox.sql', import.meta.url), 'utf8');
  S('029: token and address tables have RLS on and no grants or policies', /ALTER TABLE google_connections ENABLE ROW LEVEL SECURITY/.test(m29) && /REVOKE ALL ON google_connections FROM PUBLIC, anon, authenticated/.test(m29) && /REVOKE ALL ON inbox_addresses FROM PUBLIC, anon, authenticated/.test(m29) && !/CREATE POLICY[^;]*(google_connections|inbox_addresses)/.test(m29) && !/GRANT[^;]*ON (TABLE )?(google_connections|inbox_addresses)/.test(m29));
  const fnBody = (n) => (m29.match(new RegExp('FUNCTION public\\.' + n + '\\([\\s\\S]*?\\$\\$;')) || [''])[0];
  S('029: put/token/mark/delete/ingest all require the worker key', ['google_conn_put', 'google_conn_token', 'google_conn_mark', 'google_conn_delete', 'inbox_ingest'].every((n) => /private\.worker_key_ok\(p_key\)/.test(fnBody(n))), ['google_conn_put', 'google_conn_token', 'google_conn_mark', 'google_conn_delete', 'inbox_ingest'].filter((n) => !/worker_key_ok/.test(fnBody(n))).join(','));
  S('029: status never returns the token', !/refresh_token/.test(fnBody('google_conn_status').split('FROM')[0]));
  S('029: only inbox_ingest is callable by anon', (m29.match(/GRANT EXECUTE[^;]*TO anon/g) || []).length === 1 && /GRANT EXECUTE ON FUNCTION public\.inbox_ingest[^;]*TO anon, authenticated/.test(m29));
  const wr = fs.readFileSync(new URL('../worker/google.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('../worker/inbox.js', import.meta.url), 'utf8');
  S('workers never use a Supabase service key', !/service_role|sb_secret|SUPABASE_SERVICE/i.test(wr));
}

const PORT = 8742;
const server = await startServer(PORT);
const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.message)));
const registryWarnings = [];
page.on('console', m => { if (/act: duplicate|No handler registered|Bad data-/.test(m.text())) registryWarnings.push(m.text()); });
await page.goto(`http://localhost:${PORT}/#dashboard`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

// Which store-owned state keys each view module reads (for the VIEW_STORES guard)
const STORE_KEY_RE = /state\.(CREATOR|RATE_CARD|DEALS|CAMPAIGN_RESULTS|CALENDAR_EVENTS|MONTHLY_REVENUE|AUDIENCE_DATA|INBOX_ITEMS|TASKS|_tasksTableMissing|IDEAS|_ideasTableMissing|CLIENTS|_invoicingMigrationMissing|INVOICE_DATA|OUTREACH_LISTS|OUTREACH_TARGETS|_outreachMigrationMissing|QUOTES|QUOTE_SERVICES|_quotesMigrationMissing|TIMELINES|_timelinesMigrationMissing)\b/g;
const VIEW_KEYS = {};
for (const f of SRC.filter((x) => x.startsWith('src/views/'))) {
  const view = f.replace('src/views/', '').replace('.js', '');
  VIEW_KEYS[view] = [...new Set([...fs.readFileSync(ROOT + f, 'utf8').matchAll(STORE_KEY_RE)].map((m) => m[1]))];
}

const results = await page.evaluate(async ({ ACTION_NAMES, VIEW_KEYS }) => {
  const out = [];
  const T = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail === undefined ? '' : String(detail) });

  // Settings > Connections renders every state, escaped
  {
    const st = __arkives.state;
    const keep = [st.GOOGLE, st._googleMissing, st.INBOX_ADDRESS];
    st._googleMissing = false; st.GOOGLE = null; st.INBOX_ADDRESS = '0123456789abcdef0123456789abcdef';
    const off = __arkives.renderConnectionsSettings();
    st.GOOGLE = { email: '<img src=x onerror=1>@x.com', status: 'active', connected_at: '2026-10-01T00:00:00Z' };
    const on = __arkives.renderConnectionsSettings();
    st.GOOGLE = { email: 'a@b.com', status: 'revoked' };
    const rev = __arkives.renderConnectionsSettings();
    st._googleMissing = true;
    const miss = __arkives.renderConnectionsSettings();
    T('connections: connect / connected / reconnect / missing-migration states', /data-action="connectGoogle"[^>]*>Connect Google Calendar/.test(off) && /data-action="disconnectGoogle"/.test(on) && /Reconnect Google Calendar/.test(rev) && /029_google_and_inbox\.sql/.test(miss));
    T('connections: Google email is escaped, address shown', !/<img src=x/.test(on) && /&lt;img/.test(on) && /deals-0123456789abcdef0123456789abcdef@arkives\.xyz/.test(off));
    [st.GOOGLE, st._googleMissing, st.INBOX_ADDRESS] = keep;
    T('calendar: all-day Google events span their days, end exclusive', __arkives._gcalDates({ allDay: true, start: '2026-10-30', end: '2026-11-02' }).join(',') === '2026-10-30,2026-10-31,2026-11-01' && __arkives._gcalDates({ allDay: true, start: '2026-10-30', end: '2026-10-31' }).length === 1);
  }

  // Escaping
  T('_esc escapes quotes and angle brackets', __arkives._esc('a"b<c>&') === 'a&quot;b&lt;c&gt;&amp;');
  T('_safeThumb accepts an image data URL', __arkives._safeThumb('data:image/jpeg;base64,AAAA/+==') === 'data:image/jpeg;base64,AAAA/+==');
  T('_safeThumb rejects attribute injection', __arkives._safeThumb('x" onerror="alert(1)') === '');
  T('_safeThumb rejects svg data URLs', __arkives._safeThumb('data:image/svg+xml;base64,AAAA') === '');

  // Board content guards
  T('YouTube id shape accepted', __arkives._bdValidVid({ provider: 'youtube', vid: 'dQw4w9WgXcQ' }) === true);
  T('YouTube id injection rejected', __arkives._bdValidVid({ provider: 'youtube', vid: '"><img src=x onerror=1>' }) === false);
  T('Vimeo id must be numeric', __arkives._bdValidVid({ provider: 'vimeo', vid: '12345' }) && !__arkives._bdValidVid({ provider: 'vimeo', vid: '12a' }));
  T('embed src is null for a bad id', __arkives._bdEmbedSrc({ provider: 'youtube', vid: 'bad' }) === null);
  T('pen path coerces points to numbers', __arkives._bdPathD([['1', '2'], ['3" onload="x', '4'], [5, 6]]) === 'M1 2 L5 6');
  T('_bdNum clamps and defaults', __arkives._bdNum('"><x', 3, 1, 40) === 3 && __arkives._bdNum(99, 3, 1, 40) === 40 && __arkives._bdNum(2.5, 3, 1, 40) === 2.5);
  T('_bdSafeUrl rejects javascript:', __arkives._bdSafeUrl('javascript:alert(1)') === null && __arkives._bdSafeUrl('https://a.b/c') === 'https://a.b/c');
  T('_bdParseVideoUrl rejects non-http', __arkives._bdParseVideoUrl('javascript:alert(1)') === null && __arkives._bdParseVideoUrl('https://youtu.be/dQw4w9WgXcQ').vid === 'dQw4w9WgXcQ');
  const vEl = __arkives._bdItemEl({ id: 'v1', kind: 'video', x: 0, y: 0, w: 100, h: 60, z: 1, content: { url: 'https://x.y', provider: 'youtube', vid: '"><img src=x onerror=window.__x=1>' } });
  T('video item with a bad id renders as a link card', !vEl.querySelector('img') && !!vEl.querySelector('.bd-link-card'));
  const dEl = __arkives._bdItemEl({ id: 'd1', kind: 'draw', x: 0, y: 0, w: 10, h: 10, z: 1, content: { points: 'nope', width: '"/><script>', color: 'ink' } });
  T('draw item with junk content is inert', dEl.querySelector('path')?.getAttribute('stroke-width') === '3' && !dEl.querySelector('script'));

  // Scripts autosave: dirty-only, ordered, serialized, failure requeues
  const sent = [];
  __arkives.db.sbSaveSceneFields = async (id, fields, tok) => { sent.push({ id, fields: JSON.parse(JSON.stringify(fields)), tok }); await new Promise(r => setTimeout(r, 20)); };
  __arkives.db.sbUpdateScript = async (id, updates, tok) => { sent.push({ id, updates, tok }); return true; };
  __arkives.state._currentScriptId = 'S1'; __arkives.state._sharedScriptToken = null;
  __arkives.state._currentScenes = [{ id: 'a', script_text: '', scene_description: '' }, { id: 'b', script_text: '', scene_description: '' }];
  __arkives.state._sceneDirty = { a: { script_text: 'hello' } }; __arkives.state._titleDirty = 'New title';
  const p1 = __arkives._flushScriptSaves();
  __arkives.state._sceneDirty = { b: { scene_description: 'wide' } };
  const p2 = __arkives._flushScriptSaves();
  await Promise.all([p1, p2]);
  T('flush sends title, then only dirty scene fields, in order', JSON.stringify(sent) === JSON.stringify([
    { id: 'S1', updates: { title: 'New title' }, tok: null },
    { id: 'a', fields: { script_text: 'hello' }, tok: null },
    { id: 'b', fields: { scene_description: 'wide' }, tok: null }
  ]), JSON.stringify(sent));
  T('flush clears the dirty set', Object.keys(__arkives.state._sceneDirty).length === 0 && __arkives.state._titleDirty === null);
  __arkives.db.sbSaveSceneFields = async () => { throw new Error('net'); };
  __arkives.state._sceneDirty = { a: { script_text: 'retry me' } };
  await __arkives._flushScriptSaves();
  T('a failed save is requeued for the next flush', __arkives.state._sceneDirty.a?.script_text === 'retry me');
  __arkives.state._sceneDirty = {};

  // Editor renders from state; input updates state
  const c = document.getElementById('view-script-editor');
  __arkives.state._currentScriptRow = { id: 'S1', title: 'T "q"', share_mode: 'none', share_token: 'tok' };
  __arkives.state._currentScenes = [{ id: 'a', script_text: 'x', scene_description: 'y', thumbnail_data: 'x" onerror="window.__x=1' }];
  __arkives._renderEditorUI(c, __arkives.state._currentScriptRow, __arkives.state._currentScenes, false);
  T('title with quotes survives the value attribute', document.getElementById('scriptTitleInput')?.value === 'T "q"');
  T('crafted thumbnail is not rendered', !c.querySelector('.script-thumb-preview img'));
  const ta = c.querySelector('textarea[data-scene-id="a"][data-field="script_text"]');
  ta.value = 'typed'; ta.dispatchEvent(new Event('input', { bubbles: true }));
  T('typing updates in-memory scenes and the dirty set', __arkives.state._currentScenes[0].script_text === 'typed' && __arkives.state._sceneDirty.a?.script_text === 'typed');
  clearTimeout(__arkives.state._scriptAutoSaveTimer); __arkives.state._sceneDirty = {};

  // Scene blocks (025): legacy fallback, pills, picker, add/move/delete,
  // the scene_description mirror, and the thumbnail list
  {
    const PX = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    // focus needs a visible editor: the shell is still hidden at this point
    const shell = document.getElementById('appShell'), shellDisplay = shell.style.display;
    shell.style.display = ''; const cDisplay = c.style.display; c.style.display = 'block';
    __arkives.state.CREATOR.sceneTagPresets = { light: ['Candle'] };
    __arkives.state._currentScenes = [
      { id: 'a', script_text: '', scene_description: 'legacy text', blocks: null, thumbnail_data: PX, thumbnails: null },
      { id: 'b', script_text: '', scene_description: '', blocks: [{ kind: 'shot', shot: 'Medium', angle: 'Top-down', text: 'first' }, { kind: 'transition', type: 'Match cut', text: 'cut' }], thumbnails: [PX, PX] }
    ];
    __arkives._renderEditorUI(c, __arkives.state._currentScriptRow, __arkives.state._currentScenes, false);
    const q = (sel) => c.querySelector(sel), qa = (sel) => c.querySelectorAll(sel);
    T('a legacy scene renders one untagged shot block with its description', qa('.sc-blocks[data-scene-id="a"] .sc-block').length === 1 && q('.sc-block-text[data-scene-id="a"]').value === 'legacy text' && qa('.sc-blocks[data-scene-id="a"] .sc-tag:not(.sc-tag-ghost)').length === 0);
    T('a legacy scene has no block tools until a second block exists', !q('.sc-blocks[data-scene-id="a"] .sc-block-tools'));
    T('set pills render with kind colour classes, unset ones as ghosts', q('.sc-blocks[data-scene-id="b"] .sc-tag-shot:not(.sc-tag-ghost)')?.textContent.includes('Medium') && q('.sc-blocks[data-scene-id="b"] .sc-tag-light.sc-tag-ghost') && q('.sc-blocks[data-scene-id="b"] .sc-block-transition .sc-tag-transition')?.textContent.includes('Match cut'));
    T('the legacy single thumbnail renders ahead of the list', qa('.script-scene-row[data-scene-id="a"] .script-thumb-preview img').length === 1 && qa('.script-scene-row[data-scene-id="b"] .script-thumb-preview img').length === 2);
    T('the upload control allows several files', q('.script-scene-row[data-scene-id="b"] input[type=file]')?.multiple === true);
    // Paste: an image on the clipboard lands on the focused scene; text-with-image in a text box is left alone
    {
      const realSave = __arkives.db.sbSaveSceneFields, pasted = [];
      __arkives.db.sbSaveSceneFields = async (id, fields) => { pasted.push({ id, n: (fields.thumbnails || []).length }); };
      const cv = document.createElement('canvas'); cv.width = cv.height = 4;
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      const clip = (withText) => { const dt = new DataTransfer(); dt.items.add(new File([blob], 'shot.png', { type: blob.type || 'image/png' })); if (withText) dt.setData('text/plain', 'hello'); return new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); };
      q('.script-scene-row[data-scene-id="a"] .script-col-thumb').focus();
      const ev = clip(false); document.activeElement.dispatchEvent(ev);
      await new Promise((r) => setTimeout(r, 300));
      T('pasting an image adds it to the focused scene thumbnails', ev.defaultPrevented && pasted.length === 1 && pasted[0].id === 'a' && pasted[0].n === 2, JSON.stringify(pasted));
      const ta = c.querySelector('.script-cell-textarea[data-scene-id="b"][data-field="script_text"]'); ta.focus();
      const ev2 = clip(true); ta.dispatchEvent(ev2);
      await new Promise((r) => setTimeout(r, 100));
      T('pasting text that carries an image into a text box stays a text paste', !ev2.defaultPrevented && pasted.length === 1);
      __arkives.db.sbSaveSceneFields = realSave;
      __arkives._renderEditorUI(c, __arkives.state._currentScriptRow, __arkives.state._currentScenes, false);
    }
    // Typing in a block writes blocks + the mirror into state and the dirty set
    const bt = q('.sc-block-text[data-scene-id="a"][data-bi="0"]');
    bt.value = 'edited'; bt.dispatchEvent(new Event('input', { bubbles: true }));
    T('typing in a legacy block creates blocks and mirrors scene_description', __arkives.state._currentScenes[0].blocks?.[0]?.text === 'edited' && __arkives.state._currentScenes[0].scene_description === 'edited' && __arkives.state._sceneDirty.a?.blocks?.[0]?.text === 'edited' && __arkives.state._sceneDirty.a?.scene_description === 'edited');
    clearTimeout(__arkives.state._scriptAutoSaveTimer); __arkives.state._sceneDirty = {};
    T('mirror prefixes tags and transitions', __arkives._blocksMirror([{ kind: 'shot', shot: 'Wide', light: 'Night', text: 'a' }, { kind: 'transition', type: 'Whip pan', text: 'b' }, { kind: 'shot', text: 'c' }]) === '[Wide / Night]\na\n\n[Transition: Whip pan]\nb\n\nc');
    // Picker: opens on body, lists presets + the owner's custom + values in use, sets a value
    q('.sc-blocks[data-scene-id="b"] .sc-tag-light.sc-tag-ghost').click();
    const pick = document.querySelector('#scTagPickHost .sc-pick');
    const opts = [...document.querySelectorAll('#scTagPickHost .sc-pick-grid .sc-tag')].map((b) => b.textContent);
    T('picker opens body-mounted with presets, the owner custom and nothing else', !!pick && opts.includes('Daylight') && opts.includes('Candle') && !opts.includes('Medium'));
    const saved = [];
    __arkives.db.sbSaveSceneFields = async (id, fields) => { saved.push({ id, fields: JSON.parse(JSON.stringify(fields)) }); };
    [...document.querySelectorAll('#scTagPickHost .sc-pick-grid .sc-tag')].find((b) => b.textContent === 'Candle').click();
    await new Promise((r) => setTimeout(r, 30));
    T('picking a value sets it, closes the picker and re-renders the pill', __arkives.state._currentScenes[1].blocks[0].light === 'Candle' && !document.querySelector('#scTagPickHost .sc-pick') && q('.sc-blocks[data-scene-id="b"] .sc-tag-light:not(.sc-tag-ghost)')?.textContent.includes('Candle'));
    __arkives._scSetTag('b', 0, 'light', 'Candle');
    await new Promise((r) => setTimeout(r, 30));
    T('picking the current value again clears it', !__arkives.state._currentScenes[1].blocks[0].light);
    // Add a transition, move it, delete it
    q('.sc-blocks[data-scene-id="a"] .sc-block-add .sc-tag-transition').click();
    await new Promise((r) => setTimeout(r, 30));
    T('+ transition appends a transition block and focuses its text', __arkives.state._currentScenes[0].blocks.length === 2 && __arkives.state._currentScenes[0].blocks[1].kind === 'transition' && document.activeElement === q('.sc-block-text[data-scene-id="a"][data-bi="1"]'));
    q('.sc-blocks[data-scene-id="a"] .sc-block[data-bi="1"] .sc-block-tool[title="Move up"]').click();
    await new Promise((r) => setTimeout(r, 30));
    T('move up swaps block order', __arkives.state._currentScenes[0].blocks[0].kind === 'transition' && __arkives.state._currentScenes[0].blocks[1].text === 'edited');
    q('.sc-blocks[data-scene-id="a"] .sc-block[data-bi="0"] .sc-block-x').click();
    await new Promise((r) => setTimeout(r, 30));
    T('removing an empty block needs no confirm and leaves the rest', __arkives.state._currentScenes[0].blocks.length === 1 && __arkives.state._currentScenes[0].blocks[0].text === 'edited');
    await __arkives._flushScriptSaves();
    T('block edits save blocks + scene_description together', saved.some((x) => x.id === 'a' && Array.isArray(x.fields.blocks) && typeof x.fields.scene_description === 'string'));
    // Thumbnail reorder: arrows on each image when a scene has 2+, saved in the new order
    const PX2 = PX.replace(/.$/, PX.endsWith('=') ? 'A' : '=');
    __arkives.state._currentScenes[1].thumbnails = [PX, PX2];
    __arkives._scriptRerender();
    await new Promise((r) => setTimeout(r, 30));
    const tb = '.script-scene-row[data-scene-id="b"] .script-thumb-preview';
    T('a scene with 2+ images shows move arrows, first up and last down disabled, images draggable', qa(tb + ' .sc-thumb-move-btn').length === 4 && q(tb + '[data-ti="0"] .sc-thumb-move-btn[title="Move image up"]').disabled && q(tb + '[data-ti="1"] .sc-thumb-move-btn[title="Move image down"]').disabled && q(tb + '[data-ti="0"]').getAttribute('draggable') === 'true');
    saved.length = 0;
    q(tb + '[data-ti="0"] .sc-thumb-move-btn[title="Move image down"]').click();
    await new Promise((r) => setTimeout(r, 30));
    T('moving an image down saves the swapped order', saved[0]?.id === 'b' && saved[0].fields.thumbnails[0] === PX2 && saved[0].fields.thumbnails[1] === PX && __arkives.state._currentScenes[1].thumbnails[0] === PX2, JSON.stringify(saved.map((x) => x.id)));
    saved.length = 0;
    await __arkives._moveThumb('b', 0, 5);
    T('an out-of-range move saves nothing', saved.length === 0);
    // Thumbnail removal writes the list and clears the legacy column
    saved.length = 0;
    await __arkives._removeThumb('b', 0);
    T('removing a thumbnail saves the remaining list and clears thumbnail_data', saved[0]?.id === 'b' && saved[0].fields.thumbnails.length === 1 && saved[0].fields.thumbnail_data === '');
    // Read-only render: pills but no ghosts, tools or inputs
    __arkives._renderEditorUI(c, __arkives.state._currentScriptRow, __arkives.state._currentScenes, true);
    T('read-only render shows set pills only, no ghosts or inputs', qa('.sc-tag:not(.sc-tag-ghost)').length >= 2 && qa('.sc-tag-ghost').length === 0 && qa('.sc-block-tools').length === 0 && qa('textarea').length === 0);
    __arkives.state.CREATOR.sceneTagPresets = {};
    c.style.display = cDisplay; shell.style.display = shellDisplay;
    clearTimeout(__arkives.state._scriptAutoSaveTimer); __arkives.state._sceneDirty = {};
  }

  // Contracts: the agreement type swaps the form and the template
  {
    __arkives.renderContracts();
    const cv = document.getElementById('view-contracts');
    const vis = (id) => cv.querySelector('#' + id) && getComputedStyle(cv.querySelector('#' + id)).display !== 'none';
    T('partnership is the default: services fields hidden, partnership fields shown', !vis('dealServices') && vis('dealPartnership') && vis('rightsPartnership'));
    const partnership = __arkives.buildContractSections(__arkives.gatherContractData());
    T('partnership template still runs 1-18 plus signatures', partnership.filter((x) => x.num).map((x) => x.num).join(',') === '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18' && partnership[partnership.length - 1].isSigBlock && partnership[0].title === 'CONTENT CREATOR PARTNERSHIP AGREEMENT');
    cv.querySelector('#cAgreementType').value = 'services';
    cv.querySelector('#cAgreementType').dispatchEvent(new Event('change', { bubbles: true }));
    T('choosing services swaps the deal and rights fields', vis('dealServices') && !vis('dealPartnership') && !vis('rightsPartnership') && getComputedStyle(cv.querySelector('#cKillStd').closest('.form-group')).display === 'none');
    const set = (id, v) => { cv.querySelector('#' + id).value = v; };
    set('cBrandName', 'Acme Inc.'); set('cBrandShort', 'Acme'); set('cCampaign', 'Q4 paid media'); set('cDate', '2026-10-06');
    set('cSvcWork', 'hero video assets, each with a separate hook'); set('cSvcCount', '3'); set('cSvcSpec', '9:16, up to 60s');
    set('cSvcDayRate', '2000'); set('cSvcDaysLow', '6'); set('cSvcDaysHigh', '7'); set('cSvcNte', '14000'); set('cSvcDeposit', '50');
    set('cSvcRevRate', '750'); set('cSvcRevUnit', 'day'); set('cSvcKill', '25'); set('cRevisions', '2');
    const d = __arkives.gatherContractData();
    T('services data gathers the day-rate fields', d.agreementType === 'services' && d.svc.dayRate === 2000 && d.svc.daysLow === 6 && d.svc.daysHigh === 7 && d.svc.nte === 14000 && d.svc.count === 3 && d.svc.revUnit === 'day');
    const secs = __arkives.buildContractSections(d);
    const body = (title) => (secs.find((x) => x.title === title) || {}).body || '';
    T('services template: title, 1-17 plus signatures, no FTC / exclusivity / licensing sections', secs[0].title === 'PRODUCTION SERVICES AGREEMENT' && secs.filter((x) => x.num).map((x) => x.num).join(',') === '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17' && !secs.some((x) => /FTC|EXCLUSIVITY|LICENSING/.test(x.title)) && secs[secs.length - 1].isSigBlock);
    T('scope names the assets, spec and estimate', /3 hero video assets, each with a separate hook/.test(body('SCOPE OF SERVICES')) && /9:16, up to 60s/.test(body('SCOPE OF SERVICES')) && /6 to 7 working days/.test(body('SCOPE OF SERVICES')));
    T('compensation: day rate, $12,000 to $14,000 estimate, $14,000 cap, $6,000 deposit on the low end', /\$2,000 USD per working day/.test(body('COMPENSATION')) && /\$12,000 to \$14,000 USD/.test(body('COMPENSATION')) && /Not-to-Exceed:<\/strong>[^$]*\$14,000 USD/.test(body('COMPENSATION')) && /50% of the estimated fee \(\$6,000 USD, calculated on the low end/.test(body('COMPENSATION')));
    T('revisions: two included, $750 per day beyond, unlimited rounds on those terms', /up to <strong>2 \(two\)<\/strong> rounds/.test(body('REVISIONS & APPROVAL')) && /\$750 USD per working day of editing time/.test(body('REVISIONS & APPROVAL')) && /no limit on the number of additional rounds/.test(body('REVISIONS & APPROVAL')));
    T('ownership: client owns on full payment, creator keeps tools and portfolio rights', /assigns to Client all right, title, and interest/.test(body('OWNERSHIP & USAGE')) && /including paid media, in any territory, without limit of time/.test(body('OWNERSHIP & USAGE')) && /Creator Tools/.test(body('OWNERSHIP & USAGE')) && /portfolio/.test(body('OWNERSHIP & USAGE')));
    T('cancellation: days worked plus 25% of the remaining estimate against the $14,000 high end', /Day Rate for all days worked/.test(body('CANCELLATION')) && /<strong>25%<\/strong> of the remaining estimate/.test(body('CANCELLATION')) && /\$14,000 USD/.test(body('CANCELLATION')));
    T('shared indemnity warranty switches to the client materials', /Client Materials/.test(body('INDEMNIFICATION')) && /the Deliverables/.test(body('INDEPENDENT CONTRACTOR')));
    set('cSvcNte', ''); set('cSvcDaysHigh', '6'); cv.querySelector('#cSvcPortfolio').checked = false;
    const secs2 = __arkives.buildContractSections(__arkives.gatherContractData());
    const body2 = (title) => (secs2.find((x) => x.title === title) || {}).body || '';
    T('blank cap = notify-before-exceeding clause; equal days = single figure; portfolio off = no display', !/Not-to-Exceed/.test(body2('COMPENSATION')) && /notify Client in writing before doing so/.test(body2('COMPENSATION')) && /6 working days/.test(body2('COMPENSATION')) && /\$12,000 USD<\/strong>\./.test(body2('COMPENSATION')) && /shall not display the Deliverables publicly/.test(body2('OWNERSHIP & USAGE')));
    __arkives.generateContract();
    T('services preview renders the services title and numbered sections', /PRODUCTION SERVICES AGREEMENT/.test(cv.querySelector('#contractPreviewContent').textContent) && cv.querySelectorAll('#contractPreviewContent .contract-section').length === 17);
  }

  // Contracts: PDF text runs keep inline bold in the sentence
  {
    const r = __arkives._pdfRuns;
    T('_pdfRuns splits strong tags into inline runs and strips stray tags', JSON.stringify(r('entered into as of <strong>October 6, 2026</strong> ("Effective Date")')) === JSON.stringify([{ text: 'entered into as of ', bold: false }, { text: 'October 6, 2026', bold: true }, { text: ' ("Effective Date")', bold: false }]) && JSON.stringify(r('<strong>Day Rate:</strong> $2,000')) === JSON.stringify([{ text: 'Day Rate:', bold: true }, { text: ' $2,000', bold: false }]) && JSON.stringify(r('plain <em>x</em>')) === JSON.stringify([{ text: 'plain x', bold: false }]) && r('').length === 0);
    // The PDF source: the title comes from the sections, the footer never bleeds into the body, the signer title is the setting
    const src = await (await fetch('/src/views/contracts.js')).text();
    const pdf = src.slice(src.indexOf('function downloadContractPDF'), src.indexOf('act({ contract'));
    T('PDF title is the agreement title, not a hardcoded partnership name', /splitTextToSize\(sections\[0\]\.title/.test(pdf) && !/CONTENT CREATOR PARTNERSHIP AGREEMENT'/.test(pdf));
    T('a page break redraws the footer and then restores the body style', /drawFooter\(\);\s*applyCur\(\);/.test(pdf));
    T('PDF signer title comes from Contract Settings', /creatorName \+ ', ' \+ state\.CONTRACT_DEFAULTS\.creatorTitle/.test(pdf) && !/Managing Member'/.test(pdf));
  }

  // Contracts: the client picker (same list as invoices)
  {
    const sa = __arkives._splitAddress;
    T('address parsing: lines, commas, state+zip alone, unparseable', JSON.stringify(sa('123 Market St, Suite 400\nSan Francisco, CA 94105')) === JSON.stringify({ street: '123 Market St, Suite 400', city: 'San Francisco', state: 'CA', zip: '94105' }) && JSON.stringify(sa('9 Elm Rd, Denver, CO 80202')) === JSON.stringify({ street: '9 Elm Rd', city: 'Denver', state: 'CO', zip: '80202' }) && JSON.stringify(sa('9 Elm Rd\nDenver\nCO 80202')) === JSON.stringify({ street: '9 Elm Rd', city: 'Denver', state: 'CO', zip: '80202' }) && sa('somewhere in the cloud').street === 'somewhere in the cloud' && sa('').street === '');
    __arkives.state.CLIENTS = [{ _sbId: 'c1', name: 'Sarah Johnson', company: 'Acme Inc.', email: 'sarah@acme.com', billingAddress: '123 Market St\nSan Francisco, CA 94105', invoicePrefix: '' }];
    __arkives.state._contractClientId = null;
    __arkives.renderContracts();
    const cv = document.getElementById('view-contracts');
    const sel = cv.querySelector('#cClientSel');
    T('client picker lists the clients and a new-client option, no deal loader without deals', sel && [...sel.options].map((o) => o.value).join(',') === ',c1,__new' && /Sarah Johnson · Acme Inc\./.test(sel.options[1].textContent) && !cv.querySelector('#cLoadDeal'));
    sel.value = 'c1'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    const val = (id) => cv.querySelector('#' + id).value;
    T('picking a client fills the parties', val('cBrandName') === 'Acme Inc.' && val('cBrandShort') === 'Acme Inc.' && val('cContact') === 'Sarah Johnson' && val('cContactEmail') === 'sarah@acme.com' && val('cBrandStreet') === '123 Market St' && val('cBrandCity') === 'San Francisco' && val('cBrandState') === 'CA' && val('cBrandZip') === '94105' && __arkives.state._contractClientId === 'c1');
    sel.value = '__new'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    T('+ New client opens the inline form', getComputedStyle(cv.querySelector('#cNewClient')).display !== 'none');
    cv.querySelector('#cCampaign').value = 'keep me';
    cv.querySelector('#cAgreementType').value = 'services'; cv.querySelector('#cAgreementType').dispatchEvent(new Event('change', { bubbles: true }));
    cv.querySelector('#cSvcDayRate').value = '2500';
    cv.querySelector('#cNcName').value = 'Bo Lee'; cv.querySelector('#cNcCompany').value = 'Lee Films'; cv.querySelector('#cNcEmail').value = 'bo@lee.films'; cv.querySelector('#cNcAddress').value = '1 Pier Ave\nSanta Monica, CA 90401';
    const added = [];
    __arkives.db.sbAddClient = async (data) => { added.push(data); return { id: 'c2' }; };
    await __arkives.contractSaveNewClient();
    T('saving a new client goes through the store and lands in the list', added[0]?.name === 'Bo Lee' && __arkives.state.CLIENTS.some((c) => c._sbId === 'c2' && c.company === 'Lee Films'));
    const sel2 = cv.querySelector('#cClientSel');
    T('the new client is selected and fills the parties', sel2.value === 'c2' && val('cBrandName') === 'Lee Films' && val('cContact') === 'Bo Lee' && val('cBrandCity') === 'Santa Monica' && getComputedStyle(cv.querySelector('#cNewClient')).display === 'none');
    T('typed fields survive the store repaint', val('cCampaign') === 'keep me' && val('cAgreementType') === 'services' && val('cSvcDayRate') === '2500' && getComputedStyle(cv.querySelector('#dealServices')).display !== 'none');
    __arkives.state.CLIENTS = []; __arkives.state._contractClientId = null;
  }

  // ---- Timelines ----
  {
    const A = __arkives;
    const st = (phase, name, days, extra) => Object.assign({ id: name, phase, name, detail: '', days, owner: 'you', cal: false, on: true }, extra || {});
    // Listed out of phase order on purpose: the schedule runs pre, prod, post
    const t = { title: 'Fall, launch; "x"', clientName: 'Acme', fromName: 'Me', kickoffDate: '2026-10-16', shareToken: 'tok', steps: [
      st('post', 'Edit', 3, { cal: true, owner: 'brand' }), st('pre', 'Kickoff', 1, { cal: true }), st('pre', 'Prep', 2), st('pre', 'Skip', 4, { on: false }), st('prod', 'Shoot', 1, { cal: true })] };
    const s = A.tlSchedule(t);
    const at = (n) => s.steps.find((x) => x.name === n);
    T('timeline: steps run pre, prod, post in list order, skipped steps take no days', s.steps.map((x) => x.name).join() === 'Kickoff,Prep,Shoot,Edit' && s.bizDays === 7, JSON.stringify(s.steps.map((x) => [x.name, x.start, x.end])));
    T('timeline: business days skip the weekend (Fri kickoff, 2-day step lands Mon-Tue)', at('Kickoff').start === '2026-10-16' && at('Prep').start === '2026-10-19' && at('Prep').end === '2026-10-20' && at('Shoot').start === '2026-10-21' && at('Edit').start === '2026-10-22' && at('Edit').end === '2026-10-26');
    T('timeline: phases span their steps', s.phases.length === 3 && s.phases[0].start === '2026-10-16' && s.phases[0].end === '2026-10-20' && s.phases[0].bizDays === 3 && s.phases[2].endIdx === 6);
    T('timeline: a weekend kickoff starts Monday; moving the kickoff shifts every date', A.tlSchedule({ ...t, kickoffDate: '2026-10-17' }).start === '2026-10-19' && A.tlSchedule({ ...t, kickoffDate: '2026-11-02' }).end === '2026-11-10');
    T('timeline: status before / during / after', A.tlStatus(s, '2026-10-01').kind === 'before' && A.tlStatus(s, '2026-10-21').step.name === 'Shoot' && A.tlStatus(s, '2026-10-24').step.name === 'Edit' && A.tlStatus(s, '2026-11-01').kind === 'after');
    const g = A.tlGoogleUrl(t, at('Edit'));
    T('timeline: Google Calendar link is an all-day event with an exclusive end date', g.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE') && g.includes('&dates=20261022/20261027') && g.includes(encodeURIComponent('Edit · Fall, launch; "x"')), g);
    const ics = A.tlIcs(t, s);
    T('timeline: .ics has only calendar-checked steps, escaped, CRLF', (ics.match(/BEGIN:VEVENT/g) || []).length === 3 && ics.includes('DTSTART;VALUE=DATE:20261022\r\nDTEND;VALUE=DATE:20261027') && ics.includes('SUMMARY:Kickoff · Fall\\, launch\\; "x"') && !ics.includes('Prep') && ics.endsWith('END:VCALENDAR\r\n'));
    const card = A.renderTimelineCard({ ...t, title: '<img src=x onerror="window.__xss=1">', steps: [st('pre', '<b>bold</b>', 1, { cal: true })] });
    T('timeline: card escapes text, skips nothing it should show, and has no skipped steps', !card.includes('<b>bold') && card.includes('&lt;b&gt;bold') && !card.includes('<img src=x') && !A.renderTimelineCard(t).includes('>Skip<'));
    const cal = A.renderTimelineCard(t, { live: true });
    const segs = (cal.match(/class="tl-cal-seg[^"]*" data-step="([^"]+)"/g) || []).map((x) => x.match(/data-step="([^"]+)"/)[1]);
    T('timeline: calendar runs Mon-Sun over every week touched, a step crossing a weekend splits into two strips', (cal.match(/class="tl-cal-week"/g) || []).length === 3 && segs.join() === 'Kickoff,Prep,Shoot,Edit,Edit' && cal.includes('>October 2026<') && /tl-cal-cont[^>]*data-step="Edit"/.test(cal), segs.join());
    T('timeline: calendar grid places a Friday-only step in column 5 and greys weekends', /data-step="Kickoff" style="grid-column:5 \/ span 1"/.test(cal) && (cal.match(/tl-cal-day tl-cal-we/g) || []).length === 6);
    T('timeline: logos must be image data URLs', !A.renderTimelineCard({ ...t, fromLogo: 'javascript:alert(1)', clientLogo: 'https://evil.example/x.png' }).includes('evil') && A.renderTimelineCard({ ...t, fromLogo: 'data:image/png;base64,iVBORw0KGgo=' }).includes('class="tl-logo" src="data:image/png'));
    const p = A._tlPayload({ ...t, fromLogo: 'https://x/y.png', steps: [{ phase: 'bad', name: ' N ', days: 999, owner: 'boss', on: true }] });
    T('timeline: payload clamps days, fixes bad phase/owner, drops non-data logos', p.steps[0].days === 60 && p.steps[0].phase === 'pre' && p.steps[0].owner === 'you' && p.steps[0].name === 'N' && p.from_logo === '' && !!p.steps[0].id);
    T('timeline: default plan matches the template (11 steps, 27 business days, all on)', A.tlDefaultSteps().length === 11 && A.tlSchedule({ kickoffDate: '2026-10-19', steps: A.tlDefaultSteps() }).bizDays === 27);
  }

  // ---- Quotes ----
  {
    const A = __arkives, st = A.state;
    const mk = (over) => Object.assign({ _sbId: 'q1', clientId: 'c1', invoiceId: null, quoteNumber: 'Q-0007', title: 'Hero <b>film</b>', clientName: 'Jane', clientCompany: 'Acme Inc.', clientEmail: 'j@acme.com', clientAddress: '123 Market St\nSan Francisco, CA 94105', fromName: 'Me LLC', fromEmail: 'me@x.com', fromAddress: '', scope: 'One film', timeline: '', exclusions: '', lineItems: [{ desc: 'Hero film', detail: '', unit: 'flat', qty: 9, rate: 40000 }, { desc: 'Editing', detail: '', unit: 'day', qty: 3, rate: 1500 }], total: 44500, depositPct: 50, balanceTerms: 'NET15', revisionRounds: 3, usageRights: '', notes: '', issueDate: '2026-10-01', validUntil: '2099-01-01', status: 'accepted', shareToken: 'tok', viewedAt: '', respondedAt: '2026-10-03T00:00:00Z', acceptedName: 'Jane Doe', declineReason: '', responseSeen: true }, over || {});
    const q = mk();
    T('quote math: flat ignores qty, day multiplies, deposit is the percent of the total', A.qLineAmount(q.lineItems[0]) === 40000 && A.qLineAmount(q.lineItems[1]) === 4500 && A.qTotal(q) === 44500 && A.qDeposit(q) === 22250);
    T('quote status: expired and viewed are derived from a sent quote', A.qDisplayStatus(mk({ status: 'sent', validUntil: '2020-01-01' })) === 'expired' && A.qDisplayStatus(mk({ status: 'sent', viewedAt: '2026-10-02' })) === 'viewed' && A.qDisplayStatus(mk({ status: 'sent' })) === 'sent' && A.qDisplayStatus(q) === 'accepted');
    st.QUOTES = [mk({ quoteNumber: 'Q-0009' }), mk({ quoteNumber: 'custom' })];
    T('next quote number follows the highest Q- number', A.nextQuoteNumber() === 'Q-0010');
    const pl = A._qPayload(mk({ lineItems: [{ desc: '', detail: '', unit: 'flat', qty: 1, rate: 0 }, { desc: 'Cut', detail: ' d ', unit: 'each', qty: '4', rate: '250' }, { desc: 'Day', unit: 'bogus', qty: 2, rate: 10 }] }));
    T('quote payload drops blank lines, coerces numbers, normalizes units, totals', pl.line_items.length === 2 && pl.line_items[0].qty === 4 && pl.line_items[0].rate === 250 && pl.line_items[0].detail === 'd' && pl.line_items[1].unit === 'flat' && pl.line_items[1].qty === 1 && pl.total === 1010 && pl.balance_terms === 'NET15');
    const docEl = document.createElement('div');
    docEl.innerHTML = A.renderQuoteDoc(mk({ title: '<img src=x onerror="window.__x=1">', scope: 'a\n\nb <i>c</i>' }), '');
    T('quote document escapes client-supplied text', !docEl.querySelector('img') && !docEl.querySelector('i') && docEl.querySelectorAll('.contract-section-body p').length >= 2 && /Q-0007/.test(docEl.textContent) && /\$44,500\.00/.test(docEl.textContent));

    // Accepted quote -> draft deposit invoice, linked back to the quote
    st.QUOTES = [mk()]; st.INVOICE_DATA = []; st._invoicingMigrationMissing = false;
    st.CLIENTS = [{ _sbId: 'c1', name: 'Jane', company: 'Acme Inc.', email: 'j@acme.com', billingAddress: '', invoicePrefix: 'ACME' }];
    const invAdds = [], qUpdates = [];
    A.db.sbAddInvoice = async (p) => { invAdds.push(p); return Object.assign({ id: 'inv9' }, p); };
    A.db.sbUpdateQuote = async (id, u) => { qUpdates.push(u); return true; };
    await A.qDepositInvoice('q1');
    const ip = invAdds[0] || {};
    T('deposit invoice: 50% draft for the client, linked to the quote', ip.amount === 22250 && ip.status === 'draft' && ip.invoice_number === 'ACME-0001' && ip.client_id === 'c1' && /50% deposit/.test(ip.line_items[0].desc) && /Q-0007/.test(ip.line_items[0].desc) && /Balance of \$22,250\.00 due NET 15/.test(ip.notes) && qUpdates[0]?.invoice_id === 'inv9' && st.QUOTES[0].invoiceId === 'inv9' && location.hash === '#invoices/inv9', JSON.stringify(ip));
    invAdds.length = 0;
    await A.qDepositInvoice('q1');
    T('a second click opens the linked invoice instead of making another', invAdds.length === 0 && location.hash === '#invoices/inv9');
    st.QUOTES = [mk({ _sbId: 'q2', depositPct: 0 })]; st.INVOICE_DATA = [];
    await A.qDepositInvoice('q2');
    T('no deposit: the invoice carries the quote lines at the full total', invAdds[0]?.amount === 44500 && invAdds[0].line_items.length === 2 && invAdds[0].line_items[1].type === 'day' && invAdds[0].line_items[1].qty === 3);

    // Accepted quote -> Production Services Agreement, prefilled once
    st.QUOTES = [mk({ title: 'Spring hero film' })];
    A.qToContract('q1');
    A.renderContracts();
    const cv = document.getElementById('view-contracts');
    const cval = (id) => cv.querySelector('#' + id).value;
    T('quote -> contract: services agreement filled from the quote', cval('cAgreementType') === 'services' && cval('cBrandName') === 'Acme Inc.' && cval('cContact') === 'Jane' && cval('cBrandCity') === 'San Francisco' && cval('cCampaign') === 'Spring hero film' && cval('cSvcDayRate') === '1500' && cval('cSvcDaysLow') === '3' && cval('cSvcNte') === '44500' && cval('cSvcBalance') === 'NET15' && cval('cRevisions') === '3' && cval('cSvcCount') === '', JSON.stringify({ t: cval('cAgreementType'), r: cval('cSvcDayRate'), d: cval('cSvcDaysLow') }));
    const prev = cv.querySelector('#contractPreviewContent');
    T('the generated agreement lists the quoted work without a stray count', /PRODUCTION SERVICES AGREEMENT/.test(prev.textContent) && /Deliverables: Hero film; Editing \(3 days\)/.test(prev.textContent) && /"Spring hero film"/.test(prev.textContent));
    T('the prefill is consumed once', st._contractPrefill === null);
    st.CLIENTS = []; st._contractClientId = null; st.QUOTES = []; st.INVOICE_DATA = [];
    location.hash = 'tasks';

    // The client page: logged out, token-gated RPCs, accept needs a name
    const realSb = st._sb;
    const calls = [];
    let shared = mk({ status: 'sent', viewedAt: '' });
    st._sb = Object.create(realSb, { rpc: { value: async (name, args) => {
      calls.push({ name, args });
      if (name === 'get_shared_quote') return { data: args.p_token === 'tok' ? { quote_number: shared.quoteNumber, title: shared.title, client_name: 'Jane', client_company: 'Acme Inc.', from_name: 'Me LLC', line_items: shared.lineItems, deposit_pct: 50, balance_terms: 'NET15', revision_rounds: 3, issue_date: '2026-10-01', valid_until: '2099-01-01', status: shared.status, accepted_name: shared.acceptedName, responded_at: shared.status === 'accepted' ? '2026-10-09T00:00:00Z' : null, expired: false } : null, error: null };
      if (name === 'respond_to_quote') { shared = mk({ status: 'accepted', acceptedName: args.p_name }); return { data: { ok: true, status: 'accepted' }, error: null }; }
      return { data: null, error: null };
    } } });
    await A.navigate('q/tok');
    await new Promise((r) => setTimeout(r, 30));
    const pv = document.getElementById('view-quote-public');
    T('quote link renders the document with no app chrome', pv.classList.contains('active') && /Project Quote/.test(pv.textContent) && /\$44,500\.00/.test(pv.textContent) && document.body.classList.contains('share-quote') && getComputedStyle(document.getElementById('sidebar')).display === 'none' && !pv.querySelector('b') && /Q-0007/.test(document.title));
    A.qPublicAccept();
    await new Promise((r) => setTimeout(r, 10));
    T('accepting without a name asks for one and calls nothing', /Type your full name/.test(pv.textContent) && !calls.some((c) => c.name === 'respond_to_quote'));
    pv.querySelector('#qPubName').value = 'Jane Doe';
    A.qPublicAccept();
    await new Promise((r) => setTimeout(r, 40));
    const resp = calls.find((c) => c.name === 'respond_to_quote');
    T('accepting sends the typed name and shows the accepted state', resp && resp.args.p_token === 'tok' && resp.args.p_accept === true && resp.args.p_name === 'Jane Doe' && /Accepted by Jane Doe/.test(pv.textContent) && !pv.querySelector('#qPubName'));
    await A.navigate('q/nope');
    await new Promise((r) => setTimeout(r, 30));
    T('an inactive link says so', /not active/.test(pv.textContent));
    st._sb = realSb;
    location.hash = 'tasks'; await A.navigate('tasks');
    T('leaving a quote link restores the app', !document.body.classList.contains('share-quote') && !document.body.classList.contains('share-open'));
  }

  // Auth panels
  __arkives._authShow('forgotForm');
  T('forgot-password panel shows alone', document.getElementById('forgotForm').style.display === '' && document.getElementById('loginForm').style.display === 'none');
  __arkives._authShow('recoveryForm');
  T('recovery panel exists', document.getElementById('recoveryForm').style.display === '');
  __arkives._authShow('loginForm');

  // Modals live on <body>
  document.getElementById('loaderOverlay')?.remove();
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appShell').style.display = '';
  __arkives.state.CREATOR._sbId = 'u1';
  __arkives.state.TASKS = [{ _sbId: 't1', title: 'A', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '' }];
  __arkives.renderTasks();
  T('task modal is body-mounted', document.getElementById('taskModalHost')?.parentElement === document.body);
  __arkives.openEditTaskModal('t1');
  T('task modal covers the sidebar', /modal/.test(document.elementFromPoint(60, 300)?.className || ''));
  __arkives.closeEditTaskModal();
  __arkives.renderCalendar();
  T('calendar modal is body-mounted', document.getElementById('calendarModalHost')?.parentElement === document.body);

  // ---- Dashboard + Revenue: numbers come from the tools ----
  {
    const A = __arkives, st = A.state;
    const today = A._localISODate(), month = today.slice(0, 7), year = today.slice(0, 4);
    const lastYear = (Number(year) - 1) + '-06-15';
    const line = (fee) => [{ type: 'flat', desc: 'Edit', qty: 1, rate: 0, fee }];
    const INV = [
      { _sbId: 'i1', invoiceNumber: 'A-1', billToName: 'Acme', status: 'paid', paidAt: new Date().toISOString(), date: month + '-01', lineItems: line(1000), tax: 0, amountPaid: 1000 },
      { _sbId: 'i2', invoiceNumber: 'A-2', billToName: 'Beta', status: 'sent', date: today, dueDate: '2000-01-01', lineItems: line(500), tax: 0, amountPaid: 200 },
      { _sbId: 'i3', invoiceNumber: 'A-3', billToName: '<img src=x onerror="window.__x=1">', status: 'paid', paidAt: lastYear + 'T12:00:00Z', date: lastYear, lineItems: line(9000), tax: 0, amountPaid: 9000 },
      { _sbId: 'i4', invoiceNumber: 'A-4', billToName: 'Draft Co', status: 'draft', date: today, lineItems: line(7777), tax: 0, amountPaid: 0 },
    ];
    const m = A.moneySummary(INV, today);
    T('money: paid this month/year counts paid invoices + partial payments by paid date', m.paidMonth === 1200 && m.paidYear === 1200, JSON.stringify(m));
    T('money: outstanding = unpaid balance of sent invoices; overdue flagged; drafts ignored', m.outstanding === 300 && m.outstandingCount === 1 && m.overdue === 300 && m.overdueCount === 1 && m.draftCount === 1 && m.invoicedYear === 1500, JSON.stringify(m));
    const months = A.revenueByMonth(INV, today, 12);
    T('money: monthly series is 12 months ending this month, last year excluded', months.length === 12 && months[11].key === month && months[11].paid === 1200 && months.reduce((s, x) => s + x.paid, 0) === 1200 + (months.some((x) => x.key === lastYear.slice(0, 7)) ? 9000 : 0), JSON.stringify(months.slice(-2)));
    T('money: paid_at missing falls back to the invoice date', A.paidDay({ status: 'paid', paidAt: '', date: '2026-02-03' }) === '2026-02-03');
    const qs = A.quoteSummary([{ status: 'sent', validUntil: '2999-01-01', lineItems: [{ unit: 'flat', rate: 800, qty: 1 }] }, { status: 'accepted', lineItems: [] }, { status: 'declined', lineItems: [] }, { status: 'sent', validUntil: '2000-01-01', lineItems: [] }]);
    T('quotes: open excludes expired, win rate = accepted / decided', qs.openCount === 1 && qs.openValue === 800 && qs.winRate === 50, JSON.stringify(qs));
    const ts = A.taskSummary([{ completed: false, dueDate: today }, { completed: false, dueDate: '2000-01-01' }, { completed: true, completedAt: new Date().toISOString() }, { completed: true, completedAt: '2000-01-01T00:00:00Z' }], today);
    T('tasks: open, due today, overdue, done in the last 7 days', ts.openCount === 2 && ts.dueToday === 1 && ts.overdue === 1 && ts.doneThisWeek === 1, JSON.stringify(ts));

    const saved = { INVOICE_DATA: st.INVOICE_DATA, QUOTES: st.QUOTES, TASKS: st.TASKS, IDEAS: st.IDEAS, CALENDAR_EVENTS: st.CALENDAR_EVENTS, DEALS: st.DEALS };
    st.INVOICE_DATA = INV; st.TASKS = []; st.IDEAS = [{ title: 'a', archived: false }, { title: 'b', archived: true }];
    st.QUOTES = [{ _sbId: 'q1', status: 'accepted', title: '<b>Hero film</b>', clientName: 'Zed', respondedAt: '2026-10-01', lineItems: [] }];
    st.CALENDAR_EVENTS = [{ date: '2999-01-02', brand: 'Shoot day', type: 'Shoot' }];
    st.DEALS = [{ brand: 'B', status: 'Active', value: 999999, paid: 888888, outstanding: 777777 }];
    st._dashRecent = { at: Date.now(), boards: [{ id: 'b1', title: '<img src=x onerror="window.__x=1">', updated_at: new Date().toISOString() }], scripts: [] };
    A.renderDashboard();
    const dash = document.getElementById('view-dashboard');
    const txt = dash.innerText;
    T('dashboard: money from invoices, never from deal fields', /\$1,200/.test(txt) && /\$300/.test(txt) && !/888,888|777,777|999,999/.test(txt), txt.slice(0, 400));
    T('dashboard: shows no NaN or undefined', !/NaN|undefined/.test(txt));
    T('dashboard: quick access tiles for Boards, Scripts, Contracts, Calendar', ['Boards', 'Scripts', 'Contracts', 'Calendar'].every((n) => [...dash.querySelectorAll('.dash-tile-title')].some((a) => a.textContent === n)));
    T('dashboard: recent board links open the board; titles escaped', !!dash.querySelector('a.dash-tile-row[href="#board/b1"]') && !dash.querySelector('.dash-tile img') && /onerror/.test(dash.querySelector('.dash-tile-name').textContent));
    T('dashboard: accepted quotes link to the quote (contract hand-off), escaped', !!dash.querySelector('a[href="#quotes/q1"]') && !dash.querySelector('.dash-tile b'));
    T('dashboard: New board/script buttons reuse the tools actions', !!dash.querySelector('[data-action="_createNewBoard"]') && !!dash.querySelector('[data-action="_createNewScript"]'));
    T('dashboard: Scan now sits in the header (first screen); audience points at Settings for a missing handle', !!dash.querySelector('.view-header #dashScan [data-action="runSocialScan"]') && !dash.querySelector('#dashAudience [data-action="runSocialScan"]') && !!dash.querySelector('#dashAudience a[href="#settings"]'));
    T('dashboard: social section has a total and one card per platform; no tool stats', dash.querySelectorAll('#dashAudience .dash-soc-card').length === 6 && !!dash.querySelector('#dashAudience .dash-soc-hero') && !dash.querySelector('.dash-stat') && !dash.querySelector('#dashActivity'));
    st.INVOICE_DATA = [];
    A.renderDashboard();
    T('dashboard: no invoices = friendly empty chart state, no NaN', !document.getElementById('dashboardRevChart') && /New invoice/.test(dash.innerText) && !/NaN/.test(dash.innerText));
    st.INVOICE_DATA = INV;
    A.renderRevenue();
    const rev = document.getElementById('view-revenue');
    T('revenue: built from invoices (drafts excluded, links to the invoice)', /\$1,200/.test(rev.innerText) && !!rev.querySelector('a[href="#invoices/i2"]') && !rev.querySelector('a[href="#invoices/i4"]') && /1 draft not counted/.test(rev.innerText) && !/888,888/.test(rev.innerText));
    T('revenue: overdue invoice shows as Overdue, names escaped', /Overdue/.test(rev.innerText) && !rev.querySelector('td img'));
    Object.assign(st, saved); st._dashRecent = null;
  }

  // ---- Social: history, trend, scan results ----
  {
    const A = __arkives, st = A.state;
    const h = A.socialHistory([{ platform: 'instagram', date: '2026-09-01', followers: 100 }, { date: '2026-10-11', platforms: { instagram: { followers: 160 }, youtube: { subscribers: 7 } } }, { date: '2026-09-20', platforms: { instagram: { followers: 130 } } }]);
    T('social: history merges flat + unified snapshots, sorted', h.instagram.map((x) => x.followers).join(',') === '100,130,160' && h.youtube[0].followers === 7);
    const tr = A.followerTrend(h.instagram, 30);
    T('social: 30-day trend uses the newest point at least 30 days back', tr && tr.delta === 60 && tr.since === '2026-09-01' && A.followerTrend(h.youtube, 30) === null, JSON.stringify(tr));
    const ig0 = { ...st.CREATOR.platforms.instagram };
    A.applyScanResults({ instagram: { followers: 271234, engagementRate: 3.2, posts: 140 }, tiktok: { error: 'x' }, youtube: { skipped: true } });
    T('social: a scan updates the media-kit numbers in memory', st.CREATOR.platforms.instagram.followersNum === 271234 && st.CREATOR.platforms.instagram.followers === '271.2K' && st.CREATOR.platforms.instagram.engagement === '3.2%');
    Object.assign(st.CREATOR.platforms.instagram, ig0);
    T('social: scan error copy (cooldown, not configured, unknown)', /Try again in 3 min/.test(A.scanErrorText({ error: 'cooldown', retryAfterSec: 150 })) && /APIFY_TOKEN/.test(A.scanErrorText({ error: 'not_configured' })) && A.scanErrorText(null) === 'Scan failed. Try again.');
    st._scanBusy = true;
    T('social: busy scan button is disabled and says so', /disabled/.test(A.scanButtonHtml()) && /Scanning/.test(A.scanButtonHtml()));
    st._scanBusy = false;
    const realScan = A.db.sbScanSocials; let sent = null;
    A.db.sbScanSocials = async (d) => { sent = d; return { ok: false, error: 'not_configured' }; };
    await A.runSocialScan();
    T('social: runSocialScan sends the local date and clears busy after a refusal', sent === A._localISODate() && st._scanBusy === false);
    T('social: the refusal stays on screen as a status line (not just a 2s toast)', st._scanNote && st._scanNote.type === 'error' && /APIFY_TOKEN/.test(A.scanNoteHtml()) && /role="status"/.test(A.scanNoteHtml()));
    A.db.sbScanSocials = async () => ({ ok: false, error: 'forbidden', email: 'me<b>@x.com' });
    await A.runSocialScan();
    T('social: forbidden names the login to add, escaped', /SCAN_ALLOWED_EMAILS/.test(st._scanNote.text) && /me<b>@x\.com/.test(st._scanNote.text) && !/<b>/.test(A.scanNoteHtml()));
    A.db.sbScanSocials = async () => ({ ok: true, results: { instagram: { followers: 280000 }, tiktok: { error: 'Apify credit used up' }, youtube: { skipped: true } } });
    const ig1 = { ...st.CREATOR.platforms.instagram };
    await A.runSocialScan();
    T('social: partial success is a warning that lists what failed', st._scanNote.type === 'warn' && /Instagram 280K/.test(st._scanNote.text) && /TikTok: Apify credit used up/.test(st._scanNote.text));
    Object.assign(st.CREATOR.platforms.instagram, ig1); st._scanNote = null;
    A.db.sbScanSocials = realScan;
  }

  // Logout reset
  __arkives.state.CREATOR.name = 'X'; __arkives.state.CREATOR.bankAccountNumber = '999'; __arkives.state.INVOICE_DATA = [{ _sbId: 'i' }];
  __arkives.resetAllState();
  T('resetAllState wipes profile, bank details, data, and views', __arkives.state.CREATOR.name === '' && __arkives.state.CREATOR.bankAccountNumber === undefined && __arkives.state.INVOICE_DATA.length === 0 && document.getElementById('view-dashboard').innerHTML === '');

  // Invoice dates are local-calendar
  T('Net 30 lands on the local calendar day', __arkives.invTermDueDate('2026-09-03', 'net30') === '2026-10-03', __arkives.invTermDueDate('2026-09-03', 'net30'));

  // ---- Boards on touch ----
  __arkives.db.sbUpdateBoardItem = async () => true;
  __arkives.db.sbUpdateBoard = async () => true;
  __arkives.state._bdBoard = { id: 'B1', title: 'Board', share_mode: 'none', share_token: 'tk', view_x: 0, view_y: 0, view_zoom: 1 };
  __arkives.state._bdView = { x: 0, y: 0, z: 1 }; __arkives.state._bdItems = []; __arkives.state._bdSelectedId = null; __arkives.state._bdReadOnly = false; __arkives.state._bdSharedToken = null;
  __arkives.state._bdUndoStack = []; __arkives.state._bdRedoStack = [];
  const bc = document.getElementById('view-board-editor');
  bc.style.display = 'block';
  bc.innerHTML = __arkives._bdEditorShellHtml(false);
  __arkives._bdApplyView(); __arkives._bdBindEditor();
  const vp = document.getElementById('bdViewport');
  const rect = vp.getBoundingClientRect();
  const pe = (type, id, x, y) => vp.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: rect.left + x, clientY: rect.top + y, bubbles: true, isPrimary: id === 1 }));
  // Two fingers land 100px apart, spread to 200px: zoom should roughly double
  pe('pointerdown', 1, 100, 100); pe('pointerdown', 2, 200, 100);
  pe('pointermove', 1, 50, 100); pe('pointermove', 2, 250, 100);
  const zAfterSpread = __arkives.state._bdView.z;
  pe('pointerup', 1, 50, 100); pe('pointerup', 2, 250, 100);
  T('pinch spread zooms in', zAfterSpread > 1.8 && zAfterSpread < 2.2, zAfterSpread);
  T('pinch ends cleanly', __arkives.state._bdPinch === null && __arkives.state._bdPointers.size === 0 && __arkives.state._bdPtr === null);
  // Two fingers moving together pan
  __arkives.state._bdView = { x: 0, y: 0, z: 1 }; __arkives._bdApplyView();
  pe('pointerdown', 3, 100, 100); pe('pointerdown', 4, 200, 100);
  pe('pointermove', 3, 130, 140); pe('pointermove', 4, 230, 140);
  pe('pointerup', 3, 130, 140); pe('pointerup', 4, 230, 140);
  T('two-finger drag pans', Math.round(__arkives.state._bdView.x) === 30 && Math.round(__arkives.state._bdView.y) === 40 && Math.abs(__arkives.state._bdView.z - 1) < 0.001, JSON.stringify(__arkives.state._bdView));
  // A single touch still pans (bubble handler untouched)
  __arkives.state._bdView = { x: 0, y: 0, z: 1 }; __arkives._bdApplyView();
  pe('pointerdown', 5, 100, 100); pe('pointermove', 5, 120, 110); pe('pointerup', 5, 120, 110);
  T('single finger still pans', Math.round(__arkives.state._bdView.x) === 20 && Math.round(__arkives.state._bdView.y) === 10, JSON.stringify(__arkives.state._bdView));
  // Undo / redo buttons follow the stacks
  const ub = document.getElementById('bdUndoBtn'), rb = document.getElementById('bdRedoBtn');
  T('undo/redo buttons start disabled', ub && rb && ub.disabled && rb.disabled);
  __arkives.state._bdItems = [{ id: 'n1', board_id: 'B1', kind: 'note', x: 0, y: 0, w: 100, h: 100, z: 1, content: { text: 'a', color: 'yellow' } }];
  document.getElementById('bdPlane').appendChild(__arkives._bdItemEl(__arkives.state._bdItems[0]));
  __arkives._bdPushUndo({ type: 'update', id: 'n1', before: { x: 0 }, after: { x: 50 } });
  T('undo enabled after an op', !ub.disabled && rb.disabled);
  await __arkives._bdUndo();
  T('redo enabled after undo', ub.disabled && !rb.disabled && __arkives.state._bdItems[0].x === 0);
  await __arkives._bdRedo();
  T('redo re-applies', __arkives.state._bdItems[0].x === 50 && !ub.disabled);
  // Remote ops apply to state + DOM, but never over an item being edited
  await __arkives._bdApplyRemoteOp({ board: 'B1', type: 'upsert', item: { id: 'r1', board_id: 'B1', kind: 'text', x: 5, y: 5, w: 200, h: 40, z: 2, content: { text: 'from afar', size: 'body' } } });
  T('remote upsert adds item', __arkives.state._bdItems.some(i => i.id === 'r1') && !!document.querySelector('.bd-item[data-id="r1"]'));
  await __arkives._bdApplyRemoteOp({ board: 'OTHER', type: 'delete', id: 'r1' });
  T('remote op for another board ignored', __arkives.state._bdItems.some(i => i.id === 'r1'));
  const ed = document.querySelector('.bd-item[data-id="r1"] .bd-text-content'); ed.setAttribute('contenteditable', 'true');
  await __arkives._bdApplyRemoteOp({ board: 'B1', type: 'upsert', item: { id: 'r1', board_id: 'B1', kind: 'text', x: 5, y: 5, w: 200, h: 40, z: 2, content: { text: 'clobber', size: 'body' } } });
  T('remote upsert skips an item being edited', __arkives.state._bdItems.find(i => i.id === 'r1').content.text === 'from afar');
  ed.setAttribute('contenteditable', 'false');
  await __arkives._bdApplyRemoteOp({ board: 'B1', type: 'delete', id: 'r1' });
  T('remote delete removes item', !__arkives.state._bdItems.some(i => i.id === 'r1') && !document.querySelector('.bd-item[data-id="r1"]'));

  // ---- Boards: double-click / double-tap to edit, alignment, pen stabilization ----
  // Pointer capture retargets click/dblclick at the viewport, so the handler
  // has to recover the real target from the pointerdown (or a hit test).
  __arkives.db.sbAddBoardItem = async (it) => { window.__bdAdds = (window.__bdAdds || 0) + 1; return Object.assign({ id: 'new' + window.__bdAdds }, it); };
  __arkives.state._bdItems.push({ id: 'i1', board_id: 'B1', kind: 'video', x: 300, y: 300, w: 200, h: 60, z: 3, content: { url: 'https://example.com/p', provider: 'link', vid: null, caption: '' } });
  document.getElementById('bdPlane').appendChild(__arkives._bdItemEl(__arkives.state._bdItems.find(i => i.id === 'i1')));
  const n1Text = document.querySelector('.bd-item[data-id="n1"] .bd-text-content');
  n1Text.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'mouse', button: 0, clientX: rect.left + 20, clientY: rect.top + 20, bubbles: true, isPrimary: true }));
  vp.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'mouse', clientX: rect.left + 20, clientY: rect.top + 20, bubbles: true }));
  vp.dispatchEvent(new MouseEvent('dblclick', { clientX: rect.left + 20, clientY: rect.top + 20, bubbles: true })); // target = viewport, as Chrome does under capture
  T('dblclick retargeted at the viewport still edits the item under the pointer', n1Text.getAttribute('contenteditable') === 'true' && !window.__bdAdds && __arkives.state._bdSelectedId === 'n1');
  n1Text.blur(); n1Text.setAttribute('contenteditable', 'false');
  T('empty-canvas dblclick still makes a quick sticky', (() => { __arkives.state._bdDownTarget = document.getElementById('bdPlane'); vp.dispatchEvent(new MouseEvent('dblclick', { clientX: rect.left + 5, clientY: rect.top + 5, bubbles: true })); return true; })());
  T('dblclick on a media item edits its caption', __arkives._bdEditItem('i1') === true && document.querySelector('.bd-item[data-id="i1"] .bd-caption').getAttribute('contenteditable') === 'true' && !document.querySelector('.bd-item[data-id="i1"] .bd-caption').classList.contains('empty'));
  document.querySelector('.bd-item[data-id="i1"] .bd-caption').blur();
  T('pen strokes have nothing to edit', __arkives._bdEditItem('nope') === false);
  // Typeface + size dropdowns: picking a size never changes the font
  {
    const A = __arkives;
    await new Promise((r) => setTimeout(r, 30)); // let the quick sticky from the dblclick check finish opening
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // and commit it
    A.state._bdItems.push({ id: 'ty1', board_id: 'B1', kind: 'text', x: 600, y: 600, w: 260, h: 40, z: 9, content: { text: 'Big title', size: 'title' } });
    document.getElementById('bdPlane').appendChild(A._bdItemEl(A.state._bdItems[A.state._bdItems.length - 1]));
    const ty = () => A.state._bdItems.find(i => i.id === 'ty1');
    T('a legacy title reads as Instrument Serif 28', A._bdFontOf(ty().content) === 'serif' && A._bdFontSizeOf(ty().content, 'text') === 28);
    A._bdStartTextEdit('ty1');
    const bar = document.getElementById('bdFormatBar');
    T('the bar shows the font and size of the text being edited', document.getElementById('bdFmtFontLabel').textContent === 'Instrument Serif' && document.getElementById('bdFmtSizeLabel').textContent === '28' && bar.style.display === 'flex');
    bar.querySelector('[data-dd-open="size"]').click();
    T('the size menu opens with the standard scale', getComputedStyle(document.getElementById('bdFmtMenu-size')).display !== 'none' && A.BD_FONT_SIZES.join() === '8,9,10,11,12,14,16,18,20,24,28,32,36,48,60,72,96');
    bar.querySelector('[data-font-size="48"]').click();
    const tEl = document.querySelector('.bd-item[data-id="ty1"] .bd-text-content');
    T('picking 48 keeps the serif, sizes the text, closes the menu', ty().content.fontSize === 48 && ty().content.font === 'serif' && tEl.style.fontSize === '48px' && /Instrument Serif/.test(tEl.style.fontFamily) && document.getElementById('bdFmtMenu-size').style.display === 'none');
    bar.querySelector('[data-dd-open="font"]').click();
    bar.querySelector('[data-font="sans"]').click();
    T('switching to General Sans keeps 48', ty().content.font === 'sans' && ty().content.fontSize === 48 && /General Sans/.test(tEl.style.fontFamily));
    T('the pick becomes the default for the next text box', A.state._bdTypeDefaults.text.font === 'sans' && A.state._bdTypeDefaults.text.fontSize === 48);
    T('only brand fonts are offered', Object.keys(A.BD_TEXT_FONTS).join() === 'sans,serif');
    T('a junk font size or font never reaches the style', A._bdTypeStyle({ fontSize: '9;background:url(x)', font: 'x' }) === '' && !/url/.test(A._bdTypeStyle({ fontSize: 500, font: 'serif' })));
    tEl.blur(); // commits the edit (legacy text becomes rich): its own undo step
    await A._bdUndo(); await A._bdUndo();
    T('undo puts the serif back', ty().content.font === 'serif' && ty().content.fontSize === 48 && /Instrument Serif/.test(document.querySelector('.bd-item[data-id="ty1"] .bd-text-content').style.fontFamily), JSON.stringify(ty().content));
    A.state._bdTypeDefaults = {};
  }
  // Straight lines: drag with the line tool, Shift snaps to 45°, ends drag on their own
  {
    const A = __arkives;
    A.state._bdView = { x: 0, y: 0, z: 1 }; A._bdApplyView();
    const r = vp.getBoundingClientRect();
    const mp = (type, x, y, shift) => vp.dispatchEvent(new PointerEvent(type, { pointerId: 21, pointerType: 'mouse', button: 0, clientX: r.left + x, clientY: r.top + y, shiftKey: !!shift, bubbles: true, isPrimary: true }));
    A._bdSetTool('line');
    T('line tool shows colors + widths but not stabilization', getComputedStyle(document.getElementById('bdPenOptions')).display !== 'none' && getComputedStyle(document.querySelector('#bdPenOptions .bd-stab-group')).display === 'none');
    const n0 = A.state._bdItems.length;
    mp('pointerdown', 700, 100); mp('pointermove', 900, 130); mp('pointermove', 1000, 140); mp('pointerup', 1000, 140);
    await new Promise((res) => setTimeout(res, 30));
    const ln = A.state._bdItems[A.state._bdItems.length - 1];
    const ends = ln && A._bdLineEnds(ln);
    T('dragging makes one straight two-point line from press to release', A.state._bdItems.length === n0 + 1 && ln.kind === 'draw' && ln.content.line === true && ln.content.points.length === 2 &&
      Math.abs(ends[0][0] - 700) < 0.2 && Math.abs(ends[0][1] - 100) < 0.2 && Math.abs(ends[1][0] - 1000) < 0.2 && Math.abs(ends[1][1] - 140) < 0.2, JSON.stringify(ln));
    const n1c = A.state._bdItems.length;
    mp('pointerdown', 300, 600); mp('pointermove', 301, 601); mp('pointerup', 301, 601);
    await new Promise((res) => setTimeout(res, 30));
    T('a click without a drag makes no line', A.state._bdItems.length === n1c);
    T('Shift snaps to the nearest 45°', A._bdSnapLine([0, 0], [100, 8], true)[1] === 0 && A._bdSnapLine([0, 0], [100, 8], false)[1] === 8 && Math.abs(A._bdSnapLine([0, 0], [100, 90], true)[0] - A._bdSnapLine([0, 0], [100, 90], true)[1]) < 0.2);
    A._bdSetTool('select');
    A._bdSelect(ln.id);
    const endEl = document.querySelector('.bd-item[data-id="' + ln.id + '"] .bd-line-end[data-end="1"]');
    T('a selected line shows a handle on each end', document.querySelectorAll('.bd-item[data-id="' + ln.id + '"] .bd-line-end').length === 2 && getComputedStyle(endEl).display !== 'none');
    endEl.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 22, pointerType: 'mouse', button: 0, clientX: r.left + 1000, clientY: r.top + 140, bubbles: true, isPrimary: true }));
    vp.dispatchEvent(new PointerEvent('pointermove', { pointerId: 22, pointerType: 'mouse', clientX: r.left + 700, clientY: r.top + 400, bubbles: true }));
    vp.dispatchEvent(new PointerEvent('pointerup', { pointerId: 22, pointerType: 'mouse', clientX: r.left + 700, clientY: r.top + 400, bubbles: true }));
    const e2 = A._bdLineEnds(ln);
    T('dragging an end moves only that end', Math.abs(e2[0][0] - 700) < 0.2 && Math.abs(e2[0][1] - 100) < 0.2 && Math.abs(e2[1][0] - 700) < 0.2 && Math.abs(e2[1][1] - 400) < 0.2 && ln.w === 2, JSON.stringify(e2));
    await A._bdUndo();
    const e3 = A._bdLineEnds(A.state._bdItems.find(i => i.id === ln.id));
    T('undo puts the end back', Math.abs(e3[1][0] - 1000) < 0.2 && Math.abs(e3[1][1] - 140) < 0.2, JSON.stringify(e3));
    A._bdSelect(null);
  }
  // Copy / cut / paste: the copy lands under the cursor as a new item with the same content
  {
    const n1 = __arkives.state._bdItems.find(i => i.id === 'n1');
    n1.content = { text: 'Hook <b>idea</b><br>line two', rich: true, color: 'pink' };
    T('copied note text is plain', __arkives._bdPlainText(n1.content) === 'Hook idea\nline two');
    __arkives._bdSelect('n1');
    await __arkives._bdCopySelected(false);
    vp.dispatchEvent(new PointerEvent('pointermove', { pointerId: 12, pointerType: 'mouse', clientX: rect.left + 300, clientY: rect.top + 200, bubbles: true }));
    const before = __arkives.state._bdItems.length;
    await __arkives._bdPasteItem();
    const pasted = __arkives.state._bdItems[__arkives.state._bdItems.length - 1];
    const at = __arkives._bdScreenToBoard(rect.left + 300, rect.top + 200);
    T('paste adds a new note with the same content, centered under the cursor, and selects it',
      __arkives.state._bdItems.length === before + 1 && pasted.id !== 'n1' && pasted.kind === 'note' && pasted.content.color === 'pink' && pasted.content.text === n1.content.text &&
      Math.abs(pasted.x + pasted.w / 2 - at.x) <= 1 && __arkives.state._bdSelectedId === pasted.id, JSON.stringify(pasted));
    pasted.content.text = 'changed';
    T('the copy is independent of the clipboard', __arkives.state._bdClipboard.content.text !== 'changed');
    await __arkives._bdPasteItem();
    const second = __arkives.state._bdItems[__arkives.state._bdItems.length - 1];
    T('pasting again at the same spot steps the copy over', second.x === pasted.x + 24 && second.y === pasted.y + 24);
    await __arkives._bdUndo(); await __arkives._bdUndo();
    __arkives._bdSelect('n1');
    await __arkives._bdCopySelected(true);
    T('cut removes the item and keeps it to paste', !__arkives.state._bdItems.some(i => i.id === 'n1') && __arkives.state._bdClipboard.kind === 'note');
    await __arkives._bdUndo();
    T('undoing a cut brings the item back', __arkives.state._bdItems.some(i => i.id === 'n1'));
    __arkives.state._bdClipboard = null;
  }
  // Touch: two still taps on the same item inside the window
  const n1El = document.querySelector('.bd-item[data-id="n1"]');
  const n1Body = n1El.querySelector('.bd-text-content'); n1Body.setAttribute('contenteditable', 'false');
  const tap = (id) => { n1El.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, pointerType: 'touch', button: 0, clientX: rect.left + 30, clientY: rect.top + 30, bubbles: true, isPrimary: true })); vp.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, pointerType: 'touch', clientX: rect.left + 31, clientY: rect.top + 30, bubbles: true, isPrimary: true })); };
  tap(11); T('one touch tap only selects', n1Body.getAttribute('contenteditable') !== 'true' && !!__arkives.state._bdLastTap);
  tap(12); T('touch double-tap edits', n1Body.getAttribute('contenteditable') === 'true' && __arkives.state._bdLastTap === null);
  // Alignment: whole-item, allowlisted, undo-able, survives re-render
  __arkives._bdShowFormatBar(n1Body);
  const undoBefore = __arkives.state._bdUndoStack.length;
  document.querySelector('#bdFormatBar [data-align="right"]').click();
  T('align button sets content.align and the class', __arkives.state._bdItems.find(i => i.id === 'n1').content.align === 'right' && n1Body.classList.contains('bd-ta-right') && !n1Body.classList.contains('bd-ta-left') && document.querySelector('#bdFormatBar [data-align="right"]').classList.contains('active') && __arkives.state._bdUndoStack.length === undoBefore + 1);
  document.querySelector('#bdFormatBar [data-align="right"]').click();
  T('re-clicking the active alignment is a no-op', __arkives.state._bdUndoStack.length === undoBefore + 1);
  n1Body.blur(); __arkives._bdHideFormatBar();
  T('alignment survives a re-render', document.querySelector('.bd-item[data-id="n1"] .bd-text-content').classList.contains('bd-ta-right'));
  // Text laid over a sticky takes ink in both themes; text on the canvas and
  // the ink pen follow the theme (both were unreadable in dark mode).
  {
    const mk = (o) => { __arkives.state._bdItems.push(o); document.getElementById('bdPlane').appendChild(__arkives._bdItemEl(o)); };
    mk({ id: 't-on', board_id: 'B1', kind: 'text', x: 10, y: 10, w: 60, h: 24, z: 5, content: { text: 'on the sticky' } });
    mk({ id: 't-off', board_id: 'B1', kind: 'text', x: 900, y: 900, w: 60, h: 24, z: 5, content: { text: 'on the canvas' } });
    mk({ id: 'd-ink', board_id: 'B1', kind: 'draw', x: 600, y: 600, w: 50, h: 50, z: 5, content: { color: 'ink', width: 3, points: [[0, 0], [50, 50]] } });
    mk({ id: 'd-red', board_id: 'B1', kind: 'draw', x: 700, y: 600, w: 50, h: 50, z: 5, content: { color: 'red', width: 3, points: [[0, 0], [50, 50]] } });
    await new Promise((r) => setTimeout(r, 0));
    const prevTheme = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'dark');
    const col = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
    const ink = 'rgb(26, 23, 20)';
    T('dark mode: text on a sticky stays ink', col('.bd-item[data-id="t-on"] .bd-text-content', 'color') === ink, col('.bd-item[data-id="t-on"] .bd-text-content', 'color'));
    T('dark mode: text on the canvas follows the theme', col('.bd-item[data-id="t-off"] .bd-text-content', 'color') !== ink);
    T('dark mode: ink pen strokes follow the theme', col('.bd-item[data-id="d-ink"] path', 'stroke') !== ink, col('.bd-item[data-id="d-ink"] path', 'stroke'));
    T('dark mode: coloured pen strokes keep their colour', col('.bd-item[data-id="d-red"] path', 'stroke') === 'rgb(199, 53, 57)');
    document.documentElement.setAttribute('data-theme', prevTheme || 'light');
    T('light mode: ink pen strokes are ink', col('.bd-item[data-id="d-ink"] path', 'stroke') === ink);
    ['t-on', 't-off', 'd-ink', 'd-red'].forEach((id) => { __arkives.state._bdItems = __arkives.state._bdItems.filter(i => i.id !== id); const e = document.querySelector('.bd-item[data-id="' + id + '"]'); if (e) e.remove(); });
  }
  T('unknown alignment renders as left', __arkives._bdAlignOf({ align: 'justify" onload="x' }) === 'left' && __arkives._bdItemEl({ id: 'z', kind: 'text', x: 0, y: 0, w: 10, h: 10, z: 1, content: { text: 'a', align: '<x>' } }).querySelector('.bd-text-content').classList.contains('bd-ta-left'));
  // Pen stabilization: the follower closes a fraction of the gap; off = raw
  T('stabilization off follows the raw pointer', JSON.stringify(__arkives._bdPenStep([0, 0], 10, 4, 0)) === '[10,4]');
  T('stabilization high trails the pointer', (() => { const f = __arkives._bdPenStep([0, 0], 10, 0, __arkives.BD_PEN_STAB[3]); return f[0] > 0 && f[0] < 1; })());
  T('stabilization levels are ordered and the strip renders them', __arkives.BD_PEN_STAB.every((v, i, a) => i === 0 || v > a[i - 1]) && document.querySelectorAll('#bdPenOptions .bd-stab').length === __arkives.BD_PEN_STAB.length);
  document.querySelector('#bdPenOptions [data-pen-stab="2"]').click();
  T('picking a stabilization level updates state and the active button', __arkives.state._bdPenStab === 2 && document.querySelector('#bdPenOptions [data-pen-stab="2"]').classList.contains('active') && !document.querySelector('#bdPenOptions [data-pen-stab="0"]').classList.contains('active'));
  __arkives.state._bdPenStab = 0;
  T('crafted remote item is rendered inert', (() => { __arkives._bdApplyRemoteOp({ board: 'B1', type: 'upsert', item: { id: 'x1', board_id: 'B1', kind: 'video', x: 0, y: 0, w: 10, h: 10, z: 1, content: { url: 'https://a', provider: 'youtube', vid: '"><img src=x onerror=window.__x=1>' } } }); return !window.__x; })());

  // ---- Scripts: move up/down ----
  const reorders = [];
  __arkives.db.sbReorderScenes = async (scenes) => { reorders.push(scenes.map(s => s.id)); };
  __arkives.state._sceneDirty = {}; __arkives.state._titleDirty = null; // nothing to flush
  __arkives.state._currentScriptId = 'S2'; __arkives.state._sharedScriptToken = null;
  __arkives.state._currentScriptRow = { id: 'S2', title: 'T', share_mode: 'none' };
  __arkives.state._currentScenes = [{ id: 'a', script_text: '', scene_description: '' }, { id: 'b', script_text: '', scene_description: '' }, { id: 'c', script_text: '', scene_description: '' }];
  await __arkives._moveScene('c', -1);
  T('move up reorders and persists', JSON.stringify(reorders[0]) === '["a","c","b"]' && __arkives.state._currentScenes[1].id === 'c', JSON.stringify(reorders));
  await __arkives._moveScene('a', -1);
  T('move up at top is a no-op', reorders.length === 1);
  const rowsHtml = document.getElementById('view-script-editor').innerHTML;
  T('first row has Move up disabled, last has Move down disabled', /title="Move up" disabled/.test(rowsHtml) && /title="Move down" disabled/.test(rowsHtml));

  // ---- Tasks: optimistic toggles + undo-able delete ----
  const taskWrites = [];
  __arkives.db.sbUpdateTask = async (id, u) => { taskWrites.push(u); return !u.__fail; };
  __arkives.db.sbDeleteTasks = async (ids) => { taskWrites.push({ del: ids }); return true; };
  __arkives.state.TASKS = [{ _sbId: 't1', title: 'A', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-01' },
           { _sbId: 't2', title: 'B', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-02' }];
  __arkives.state._taskPendingDeletes = {};
  location.hash = 'tasks'; __arkives.navigate('tasks');
  const p = __arkives.toggleTaskComplete('t1');
  // A completed task leaves the active list and the collapsed Completed count goes up, before the save resolves
  T('complete flips before the save resolves', __arkives.state.TASKS.find(t => t._sbId === 't1').completed === true && !document.querySelector('.task-list:not(.task-list-completed) .task-item[data-id="t1"]') && /Completed \(1\)/.test(document.getElementById('view-tasks').textContent));
  await p;
  T('complete persisted', taskWrites.some(w => w.completed === true));
  __arkives.db.sbUpdateTask = async () => false;
  await __arkives.toggleTaskStar('t2');
  T('failed star save reverts', __arkives.state.TASKS.find(t => t._sbId === 't2').starred === false);
  __arkives.deleteTask('t2');
  T('delete removes immediately with an Undo toast', !__arkives.state.TASKS.some(t => t._sbId === 't2') && document.getElementById('undo-toast')?.classList.contains('show'));
  document.querySelector('#undo-toast .undo-toast-btn').click();
  T('undo restores the task without a DB call', __arkives.state.TASKS.some(t => t._sbId === 't2') && !taskWrites.some(w => w.del) && !__arkives.state._taskPendingDeletes.t2);
  __arkives.deleteTask('t2');
  __arkives._flushTaskDeletes();
  await new Promise(r => setTimeout(r, 10));
  T('flush commits a pending delete', taskWrites.some(w => w.del && w.del[0] === 't2') && !__arkives.state.TASKS.some(t => t._sbId === 't2'));

  // ---- Ideas: a ruled notepad. Capture line, inline edit, store-owned writes ----
  const ideaWrites = [];
  __arkives.db.sbUpdateIdea = async (id, u) => { ideaWrites.push(u); return true; };
  __arkives.db.sbDeleteIdeas = async (ids) => { ideaWrites.push({ del: ids }); return true; };
  __arkives.db.sbAddIdea = async (d) => ({ id: 'new1', title: d.title, notes: d.notes, archived: false, created_at: '2026-09-10T00:00:00Z' });
  __arkives.state.IDEAS = [{ _sbId: 'i1', title: 'Hook: <b>bold</b>', notes: 'line one\nline two', archived: false, archivedAt: '', createdAt: '2026-09-01T00:00:00Z' },
           { _sbId: 'i2', title: 'Second', notes: '', archived: false, archivedAt: '', createdAt: '2026-09-02T00:00:00Z' }];
  __arkives.state._ideaPendingDeletes = {}; __arkives.state._ideasArchivedOpen = false; __arkives.state._editingIdeaId = null; __arkives.state._ideaPadMounted = false;
  const prevCreatorId = __arkives.state.CREATOR._sbId; __arkives.state.CREATOR._sbId = 'u1'; // the add path refuses to write without a profile id
  const tick = () => new Promise(r => setTimeout(r, 20));
  const activeEntries = () => [...document.querySelectorAll('#view-ideas .ideas-sheet:not(.ideas-sheet-archived) .pad-entry')];
  location.hash = 'tasks'; __arkives.navigate('tasks');
  location.hash = 'ideas'; __arkives.navigate('ideas');
  T('ideas render newest first with escaped titles and pre-wrapped notes', (() => { const rows = activeEntries(); return rows.length === 2 && rows[0].dataset.id === 'i2' && /&lt;b&gt;/.test(rows[1].innerHTML) && !rows[1].querySelector('b') && getComputedStyle(rows[1].querySelector('.pad-notes')).whiteSpace === 'pre-wrap'; })());
  T('the capture line is focused on mount and the header has no button', document.activeElement?.id === 'ideaCapture' && !document.querySelector('#view-ideas .view-header button') && !document.querySelector('#view-ideas .view-subtitle'));
  const RULE = parseFloat(getComputedStyle(document.querySelector('#view-ideas .ideas-container')).getPropertyValue('--rule'));
  const onRules = () => [...document.querySelectorAll('#view-ideas .pad-capture, #view-ideas .pad-entry')].every((el) => Math.abs(el.getBoundingClientRect().height % RULE) < 0.5);
  T('every line is a whole number of rules tall (multi-line notes included)', RULE > 0 && onRules(), JSON.stringify({ RULE, hs: [...document.querySelectorAll('#view-ideas .pad-capture, #view-ideas .pad-entry')].map(e => e.getBoundingClientRect().height) }));
  T('each idea ends on an ink rule, so a wrapped title reads as one idea and the next starts under the ink', activeEntries().length > 0 && activeEntries().every((e) => { const cs = getComputedStyle(e); return cs.backgroundImage !== 'none' && cs.backgroundSize === '100% 2px' && cs.backgroundRepeat === 'no-repeat'; }));
  // Capture line: Enter adds through the store, clears, keeps the caret
  const cap = document.getElementById('ideaCapture'); cap.value = 'Fresh';
  cap.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await tick();
  T('Enter on the capture line adds through the store, clears, and keeps focus', __arkives.state.IDEAS[0]._sbId === 'new1' && document.getElementById('ideaCapture').value === '' && document.activeElement?.id === 'ideaCapture' && activeEntries()[0]?.dataset.id === 'new1');
  const emptyBefore = __arkives.state.IDEAS.length;
  document.getElementById('ideaCapture').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await tick();
  T('an empty Enter adds nothing', __arkives.state.IDEAS.length === emptyBefore);
  // Inline edit
  __arkives.openIdeaEdit('i1');
  const et = document.getElementById('ideaEditTitle'), en = document.getElementById('ideaEditNotes');
  T('tapping a line edits it in place with focus on the title, no modal', !!et && document.activeElement === et && et.value === 'Hook: <b>bold</b>' && en?.value === 'line one\nline two' && !document.getElementById('editIdeaModal'));
  T('the date column and the Add button share one right edge, and the actions replace the date in place', (() => {
    const add = document.querySelector('#view-ideas .pad-add').getBoundingClientRect();
    const ends = [...document.querySelectorAll('#view-ideas .ideas-sheet:not(.ideas-sheet-archived) .pad-entry:not(.editing) .pad-end')];
    const dates = [...document.querySelectorAll('#view-ideas .ideas-sheet:not(.ideas-sheet-archived) .pad-entry:not(.editing) .pad-date')];
    return ends.length > 0 && ends.every((e) => Math.abs(e.getBoundingClientRect().right - add.right) < 1) && dates.every((d) => Math.abs(d.getBoundingClientRect().right - add.right) < 1) && ends.every((e) => Math.abs(e.querySelector('.pad-actions').getBoundingClientRect().right - add.right) < 1);
  })());
  T('a focused line has no box, the rule under it turns to ink', getComputedStyle(et).outlineStyle === 'none' && getComputedStyle(et.closest('.pad-line')).backgroundImage !== 'none');
  et.value = 'A much longer idea line that has to wrap onto the next rule of the sheet when it is being edited at this width'; et.dispatchEvent(new Event('input', { bubbles: true }));
  T('a long title wraps onto a second rule while editing and stays on the rules', Math.abs(et.getBoundingClientRect().height - 2 * RULE) < 1 && onRules(), et.getBoundingClientRect().height);
  et.value = 'Hook: <b>bold</b>'; et.dispatchEvent(new Event('input', { bubbles: true }));
  T('the notes textarea grew to its lines and the sheet stays on the rules', Math.abs(en.getBoundingClientRect().height - 2 * RULE) < 1 && onRules(), en.getBoundingClientRect().height);
  en.value = 'line one\nline two\nline three'; en.dispatchEvent(new Event('input', { bubbles: true }));
  T('a new line in notes grows the textarea by one rule', Math.abs(en.getBoundingClientRect().height - 3 * RULE) < 1 && onRules(), en.getBoundingClientRect().height);
  const plain = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); en.dispatchEvent(plain);
  T('Enter in the notes textarea is a newline, not a commit', !plain.defaultPrevented && !!document.getElementById('ideaEditTitle'));
  et.value = 'Edited';
  et.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await tick();
  T('Enter on the title commits through the store and leaves edit mode', __arkives.state.IDEAS.find(i => i._sbId === 'i1').title === 'Edited' && ideaWrites.some(w => w.title === 'Edited' && w.notes === 'line one\nline two\nline three') && !document.getElementById('ideaEditTitle') && /Edited/.test(document.querySelector('#view-ideas .pad-entry[data-id="i1"] .pad-text').textContent));
  let writesBefore = ideaWrites.length;
  __arkives.openIdeaEdit('i2');
  document.getElementById('ideaEditTitle').value = 'Nope';
  document.getElementById('ideaEditTitle').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  T('Escape cancels the edit without a write', !document.getElementById('ideaEditTitle') && ideaWrites.length === writesBefore && __arkives.state.IDEAS.find(i => i._sbId === 'i2').title === 'Second');
  __arkives.openIdeaEdit('i2');
  document.getElementById('ideaEditTitle').value = 'Blurred';
  document.getElementById('ideaCapture').focus();
  await tick();
  T('focus leaving the entry commits the edit', __arkives.state.IDEAS.find(i => i._sbId === 'i2').title === 'Blurred' && ideaWrites.some(w => w.title === 'Blurred') && !document.getElementById('ideaEditTitle'));
  __arkives.openIdeaEdit('i2');
  document.getElementById('ideaEditNotes').focus();
  await tick();
  T('moving from the title to the notes of the same entry does not commit', !!document.getElementById('ideaEditTitle') && __arkives.state._editingIdeaId === 'i2');
  document.getElementById('ideaEditNotes').value = 'n2';
  document.getElementById('ideaEditNotes').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true }));
  await tick();
  T('Cmd/Ctrl+Enter in notes commits', ideaWrites.some(w => w.notes === 'n2') && !document.getElementById('ideaEditTitle') && __arkives.state.IDEAS.find(i => i._sbId === 'i2').notes === 'n2');
  writesBefore = ideaWrites.length;
  __arkives.openIdeaEdit('i2');
  document.getElementById('ideaEditTitle').value = '   ';
  document.getElementById('ideaEditTitle').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await tick();
  T('an emptied line is refused and stays in edit mode', !!document.getElementById('ideaEditTitle') && document.activeElement?.id === 'ideaEditTitle' && ideaWrites.length === writesBefore && __arkives.state.IDEAS.find(i => i._sbId === 'i2').title === 'Blurred');
  __arkives.cancelIdeaEdit();
  __arkives.openIdeaEdit('i2');
  document.getElementById('ideaEditTitle').value = 'Saved on leave';
  location.hash = 'tasks'; __arkives.navigate('tasks');
  await tick();
  T('leaving the view saves an open edit', ideaWrites.some(w => w.title === 'Saved on leave') && __arkives.state._editingIdeaId === null && __arkives.state.IDEAS.find(i => i._sbId === 'i2').title === 'Saved on leave');
  location.hash = 'ideas'; __arkives.navigate('ideas');
  // Archive: optimistic, reverts on failure, archived sheet with Restore
  const pa = __arkives.archiveIdea('i1');
  T('archive leaves the active sheet before the save resolves', __arkives.state.IDEAS.find(i => i._sbId === 'i1').archived === true && !document.querySelector('#view-ideas .ideas-sheet:not(.ideas-sheet-archived) .pad-entry[data-id="i1"]') && /Archived \(1\)/.test(document.getElementById('view-ideas').textContent));
  await pa;
  T('archive persisted with a timestamp', ideaWrites.some(w => w.archived === true && typeof w.archived_at === 'string'));
  __arkives.toggleArchivedIdeas();
  T('archived sheet expands and shows the idea with a Restore action and no edit affordance', !!document.querySelector('#view-ideas .ideas-sheet-archived .pad-entry[data-id="i1"] [data-action="restoreIdea"]') && !document.querySelector('#view-ideas .ideas-sheet-archived .pad-entry[data-id="i1"] [data-action="openIdeaEdit"]'));
  __arkives.db.sbUpdateIdea = async () => false;
  await __arkives.restoreIdea('i1');
  T('failed restore reverts to archived', __arkives.state.IDEAS.find(i => i._sbId === 'i1').archived === true);
  __arkives.db.sbUpdateIdea = async (id, u) => { ideaWrites.push(u); return true; };
  // Delete: immediate, undo-able, committed on unmount
  __arkives.deleteIdea('i2');
  T('idea delete removes immediately with an Undo toast', !__arkives.state.IDEAS.some(i => i._sbId === 'i2') && document.getElementById('undo-toast')?.classList.contains('show'));
  document.querySelector('#undo-toast .undo-toast-btn').click();
  T('undo restores the idea without a DB call', __arkives.state.IDEAS.some(i => i._sbId === 'i2') && !ideaWrites.some(w => w.del) && !__arkives.state._ideaPendingDeletes.i2);
  __arkives.deleteIdea('i2');
  location.hash = 'tasks'; __arkives.navigate('tasks');
  await tick();
  T('leaving Ideas commits the pending delete (unmount)', ideaWrites.some(w => w.del && w.del[0] === 'i2') && !__arkives.state.IDEAS.some(i => i._sbId === 'i2') && __arkives.currentRoute()?.key === 'tasks');
  location.hash = 'ideas'; __arkives.navigate('ideas');
  __arkives.state._ideasTableMissing = true; __arkives.renderIdeas();
  T('ideas view explains the missing table', /022_ideas\.sql/.test(document.getElementById('view-ideas').textContent) && !document.getElementById('ideaCapture'));
  __arkives.state._ideasTableMissing = false; __arkives.state.IDEAS = []; __arkives.state.CREATOR._sbId = prevCreatorId;
  location.hash = 'tasks'; __arkives.navigate('tasks');

  // Saving the edit modal closes it (a re-render alone leaves an open modal open)
  __arkives.db.sbUpdateTask = async () => true;
  __arkives.state.TASKS = [{ _sbId: 't3', title: 'Edit me', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-01' }];
  location.hash = 'tasks'; __arkives.navigate('tasks'); __arkives.openEditTaskModal('t3');
  document.getElementById('etTitle').value = 'Edited'; await __arkives.saveTaskEdits();
  T('saving the task modal updates the row and closes the modal', __arkives.state.TASKS[0].title === 'Edited' && document.getElementById('editTaskModal').style.display === 'none' && __arkives.state._editingTaskId === null);

  // ---- Invoices: routes + row sheet ----
  __arkives.state.INVOICE_DATA = [{ _sbId: 'i1', invoiceNumber: 'ACME-0001', brand: 'Acme', billToName: 'Acme Media', billToAddress: '', date: '2026-08-01', dueDate: '', status: 'sent', lineItems: [{ type: 'flat', desc: 'Reel', qty: 1, rate: 0, fee: 100 }], amount: 100, amountPaid: 0, tax: 0, notes: '', includePaymentInfo: false, paymentTerms: 'none', clientId: null, description: 'Reel' }];
  __arkives.state.CLIENTS = []; __arkives.state._invoicingMigrationMissing = false;
  location.hash = 'invoices/i1'; __arkives.navigate('invoices/i1');
  T('#invoices/{id} opens the editor', __arkives.state._invEditorOpen && __arkives.state._invEditingId === 'i1' && !!document.getElementById('invBillToName'));
  location.hash = 'invoices'; __arkives.navigate('invoices');
  T('#invoices closes the editor', !__arkives.state._invEditorOpen && !!document.getElementById('invTbody'));
  location.hash = 'invoices/new'; __arkives.navigate('invoices/new');
  T('#invoices/new starts a blank invoice', __arkives.state._invEditorOpen && __arkives.state._invEditingId === null && __arkives.state._inv && __arkives.state._inv.status === 'draft');
  location.hash = 'invoices'; __arkives.navigate('invoices');
  __arkives.invOpenRowMenu('i1');
  T('row sheet mounts on body with the status action', document.getElementById('invSheetHost')?.parentElement === document.body && /Record Payment/.test(document.getElementById('invSheetHost').innerHTML));
  __arkives.invCloseRowMenu();
  T('row sheet closes', document.getElementById('invSheetHost').innerHTML === '');
  T('unknown hash falls back to dashboard', (() => { location.hash = 'nope'; __arkives.navigate('nope'); return document.getElementById('view-dashboard').classList.contains('active'); })());
  T('tab bar marks the active tool', (() => { location.hash = 'tasks'; __arkives.navigate('tasks'); return document.querySelector('.tabbar [data-tab="tasks"]').classList.contains('active') && !document.querySelector('.tabbar [data-tab="boards"]').classList.contains('active'); })());
  T('editor routes set editor-open on body', (() => { location.hash = 'script/abc'; __arkives.navigate('script/abc'); const on = document.body.classList.contains('editor-open'); location.hash = 'tasks'; __arkives.navigate('tasks'); return on && !document.body.classList.contains('editor-open'); })());
  __arkives.state._scriptLoadToken++; // abandon the stray editor fetch

  // ---- Modules: wiring, no leaked globals ----
  T('the Supabase client was created in sb.__init', !!__arkives.state._sb && typeof __arkives.state._sb.from === 'function');
  T('boot ran to completion (_booted)', __arkives.state._booted === true);
  T('module scope does not leak into window', typeof window.TASKS === 'undefined' && typeof window.navigate === 'undefined' && typeof window.renderTasks === 'undefined' && typeof window._sb === 'undefined');
  T('__arkives exposes state, db, ACTIONS and views', __arkives.state && __arkives.db && __arkives.ACTIONS && typeof __arkives.renderTasks === 'function' && typeof __arkives.db.sbUpdateTask === 'function');
  location.hash = 'calendar'; window.dispatchEvent(new HashChangeEvent('hashchange'));
  T('hashchange listener routes (router.__init)', document.getElementById('view-calendar').classList.contains('active'));
  location.hash = 'tasks'; __arkives.navigate('tasks');

  // ---- Event delegation: every data-* name in the source has a handler ----
  const unregistered = ACTION_NAMES.filter(n => typeof __arkives.ACTIONS[n] !== 'function');
  T('every data-action/input/change/keydown/submit in the source is registered (' + ACTION_NAMES.length + ' names)', unregistered.length === 0, unregistered.join(', '));

  // ---- Event delegation: dispatcher semantics ----
  const calls = [];
  __arkives.act({
    __t0: function () { calls.push(['t0', arguments.length]); },
    __t1: function (a, b, c, d) { calls.push(['t1', a, b && b.type, c && c.id, d]); },
    __tStop: function (ev) { calls.push(['stop']); ev.stopPropagation(); },
    __tOuter: function () { calls.push(['outer']); },
    __tIn: function (v) { calls.push(['in', v]); },
    __tChk: function (c) { calls.push(['chk', c]); },
    __tKey: function (ev) { calls.push(['key', ev.key]); },
    __tSub: function (ev) { ev.preventDefault(); calls.push(['sub']); },
  });
  const lab = document.createElement('div');
  lab.innerHTML = `
    <div data-action="__tOuter">
      <button id="d0" data-action="__t0">x</button>
      <button id="d1" data-action="__t1" data-args="${__arkives._args('a', '$event', '$el', 7)}">x</button>
      <span data-action="__tStop" data-args="[&quot;$event&quot;]"><button id="dStop">x</button></span>
      <span data-action="__t0" data-stop><button id="dStopAttr">x</button></span>
      <button id="dBad" data-action="__nope">x</button>
      <input id="dIn" data-input="__tIn" data-input-args="[&quot;$value&quot;]">
      <input id="dChk" type="checkbox" data-change="__tChk" data-change-args="[&quot;$checked&quot;]">
      <input id="dKey" data-keydown="__tKey" data-keydown-args="[&quot;$event&quot;]">
      <form id="dForm" data-submit="__tSub" data-submit-args="[&quot;$event&quot;]"><button type="submit">go</button></form>
    </div>`;
  document.body.appendChild(lab);
  let docSeen = 0; const seeDoc = () => docSeen++; document.addEventListener('click', seeDoc);
  document.getElementById('d0').click();
  T('click: handler gets exactly its args and the event bubbles to the outer action', JSON.stringify(calls) === '[["t0",0],["outer"]]', JSON.stringify(calls));
  T('click: later document listeners still run when nothing stops the event', docSeen === 1);
  calls.length = 0; docSeen = 0;
  document.getElementById('d1').click();
  T('$event, $el and literals resolve in order', JSON.stringify(calls[0]) === '["t1","a","click","d1",7]', JSON.stringify(calls[0]));
  calls.length = 0; docSeen = 0;
  document.getElementById('dStop').click();
  T('a handler that stops propagation ends the walk and hides the event from later document listeners', JSON.stringify(calls) === '[["stop"]]' && docSeen === 0, JSON.stringify(calls) + ' docSeen=' + docSeen);
  calls.length = 0; docSeen = 0;
  document.getElementById('dStopAttr').click();
  T('data-stop runs the handler then stops', JSON.stringify(calls) === '[["t0",0]]' && docSeen === 0, JSON.stringify(calls));
  calls.length = 0;
  const errBefore = console.error; let loggedErr = ''; console.error = (m) => { loggedErr += m; };
  document.getElementById('dBad').click();
  console.error = errBefore;
  T('an unregistered action logs an error and does not throw', /__nope/.test(loggedErr) && calls.length === 0, loggedErr);
  const din = document.getElementById('dIn'); din.value = 'hi'; din.dispatchEvent(new Event('input', { bubbles: true }));
  T('data-input passes $value', JSON.stringify(calls) === '[["in","hi"]]', JSON.stringify(calls));
  calls.length = 0;
  document.getElementById('dChk').click();
  T('data-change passes $checked', calls.some(c => c[0] === 'chk' && c[1] === true), JSON.stringify(calls));
  calls.length = 0;
  document.getElementById('dKey').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  T('data-keydown passes the event', JSON.stringify(calls) === '[["key","Enter"]]', JSON.stringify(calls));
  calls.length = 0;
  document.getElementById('dForm').requestSubmit();
  T('data-submit passes the event (and preventDefault holds)', JSON.stringify(calls) === '[["sub"]]' && location.pathname === '/', JSON.stringify(calls));
  document.removeEventListener('click', seeDoc); lab.remove();
  ['__t0', '__t1', '__tStop', '__tOuter', '__tIn', '__tChk', '__tKey', '__tSub'].forEach(n => { delete __arkives.ACTIONS[n]; });

  // ---- Event delegation: the real UI, driven by clicks ----
  // Auth form submits through the dispatcher
  const realLogin = __arkives.ACTIONS.handleLogin; let loginEv = null;
  __arkives.ACTIONS.handleLogin = (ev) => { ev.preventDefault(); loginEv = ev; };
  document.getElementById('loginEmail').value = 't@example.com'; document.getElementById('loginPassword').value = 'pw';
  document.getElementById('loginForm').requestSubmit(); // real path: validation, then the delegated submit
  document.getElementById('loginEmail').value = ''; document.getElementById('loginPassword').value = '';
  __arkives.ACTIONS.handleLogin = realLogin;
  T('login form submit reaches handleLogin with the event', loginEv && loginEv.type === 'submit');
  // Settings tabs (constant args)
  location.hash = 'settings'; __arkives.navigate('settings');
  document.querySelector('.settings-tab[data-tab="ratecard"]').click();
  T('settings tab click switches the panel', document.querySelector('.settings-tab[data-tab="ratecard"]').classList.contains('active') && document.getElementById('settings-panel-ratecard').style.display === '' && document.getElementById('settings-panel-profile').style.display === 'none');
  // Calendar day cell (dynamic args) opens the modal prefilled; backdrop closes it; the card does not
  location.hash = 'calendar'; __arkives.navigate('calendar');
  const cell = document.querySelector('.calendar-cell[data-action="openAddEventModal"]');
  const cellIso = JSON.parse(cell.getAttribute('data-args'))[0];
  cell.click();
  const evModal = document.getElementById('addEventModal');
  T('calendar cell click opens Add Event prefilled with that day', evModal.style.display !== 'none' && document.getElementById('evDate').value === cellIso, document.getElementById('evDate').value + ' vs ' + cellIso);
  evModal.querySelector('.modal-card h3').click();
  T('click inside the event card keeps it open', evModal.style.display !== 'none');
  evModal.click();
  T('click on the event backdrop closes it', evModal.style.display === 'none');
  // Tasks: check button toggles, body opens the editor, backdrop closes it
  __arkives.db.sbUpdateTask = async () => true;
  __arkives.state.TASKS = [{ _sbId: 'k1', title: 'Click me', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-01' }];
  location.hash = 'tasks'; __arkives.navigate('tasks');
  document.querySelector('.task-item[data-id="k1"] .task-body').click();
  const tModal = document.getElementById('editTaskModal');
  T('task body click opens the edit modal for that task', tModal.style.display !== 'none' && __arkives.state._editingTaskId === 'k1' && document.getElementById('etTitle').value === 'Click me');
  tModal.querySelector('.modal-card').click();
  T('click inside the task card keeps it open', tModal.style.display !== 'none');
  tModal.click();
  T('click on the task backdrop closes it', tModal.style.display === 'none' && __arkives.state._editingTaskId === null);
  document.getElementById('etTitle').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); // closed modal: harmless
  document.querySelector('.task-item[data-id="k1"] .task-check').click();
  T('task check click completes the task', __arkives.state.TASKS[0].completed === true);
  // Invoices: row click opens; the actions cell stops the row; the sheet backdrop closes
  __arkives.state.INVOICE_DATA = [{ _sbId: 'i1', invoiceNumber: 'ACME-0001', brand: 'Acme', billToName: 'Acme Media', billToAddress: '', date: '2026-08-01', dueDate: '', status: 'sent', lineItems: [{ type: 'flat', desc: 'Reel', qty: 1, rate: 0, fee: 100 }], amount: 100, amountPaid: 0, tax: 0, notes: '', includePaymentInfo: false, paymentTerms: 'none', clientId: null, description: 'Reel' }];
  location.hash = 'invoices'; __arkives.navigate('invoices');
  document.querySelector('.inv-row td').click();
  T('invoice row click opens that invoice', __arkives.state._invEditorOpen && __arkives.state._invEditingId === 'i1');
  location.hash = 'invoices'; __arkives.navigate('invoices');
  document.querySelector('.inv-row .inv-row-more').click();
  T('row actions click opens the sheet without opening the row', !__arkives.state._invEditorOpen && /Record Payment/.test(document.getElementById('invSheetHost').innerHTML));
  document.querySelector('#invSheetHost .inv-sheet').click();
  T('click inside the sheet keeps it open', document.getElementById('invSheetHost').innerHTML !== '');
  document.querySelector('#invSheetHost .inv-sheet-overlay').click();
  T('click on the sheet backdrop closes it', document.getElementById('invSheetHost').innerHTML === '');
  __arkives.invOpenRowMenu('i1');
  const sheetPick = document.querySelector('#invSheetHost .inv-sheet-btn[data-action="invRowMenuPick"]');
  sheetPick.click();
  T('a sheet action closes the sheet and runs (Open)', document.getElementById('invSheetHost').innerHTML === '' && __arkives.state._invEditorOpen && __arkives.state._invEditingId === 'i1');
  location.hash = 'invoices'; __arkives.navigate('invoices');
  // Outreach rail (dynamic args through a template)
  __arkives.state.OUTREACH_TARGETS = []; __arkives.state.OUTREACH_LISTS = [{ _sbId: 'L1', name: 'Brands' }]; __arkives.state._outSelectedList = 'all';
  location.hash = 'outreach'; __arkives.navigate('outreach');
  document.querySelector('.out-rail-item[data-action="outSelectList"][data-args*="L1"]').click();
  T('outreach list click selects the list', __arkives.state._outSelectedList === 'L1');
  // Card pattern used by Scripts and Boards lists: go() on the card, a stopped delete button inside
  const realDel = __arkives.ACTIONS._deleteBoard; let delId = null; __arkives.ACTIONS._deleteBoard = (id) => { delId = id; };
  const card = document.createElement('div');
  card.innerHTML = '<div class="board-card" data-action="go" data-args="' + __arkives._args('board/zz') + '"><button class="board-card-delete" data-action="_deleteBoard" data-args="' + __arkives._args('zz') + '" data-stop>x</button></div>';
  document.body.appendChild(card);
  location.hash = 'boards';
  card.querySelector('.board-card-delete').click();
  T('card delete button runs and does not open the card', delId === 'zz' && location.hash === '#boards');
  card.querySelector('.board-card').click();
  T('card click navigates', location.hash === '#board/zz');
  __arkives.ACTIONS._deleteBoard = realDel; card.remove(); location.hash = 'tasks'; __arkives.navigate('tasks');
  // Boards zoom buttons in the editor shell
  const zBefore = __arkives.state._bdView.z;
  document.querySelector('#view-board-editor .bd-zoom button[data-args="[1]"]').click();
  T('board zoom-in button zooms', __arkives.state._bdView.z > zBefore, zBefore + ' -> ' + __arkives.state._bdView.z);

  // ---- jsPDF works under the CSP (no unsafe-eval) ----
  T('jsPDF renders under the CSP', (() => { try { const d = new jspdf.jsPDF(); d.text('csp', 10, 10); return /^data:application\/pdf/.test(d.output('datauristring')); } catch (e) { return false; } })());

  // ---- Stores ----
  const S = __arkives.stores;
  T('every view declares stores covering the state keys it reads', (() => {
    const owned = {}; S.ALL_STORES.forEach((st) => st.keys.forEach((k) => { owned[k] = st.name; }));
    const bad = [];
    for (const [view, keys] of Object.entries(VIEW_KEYS)) {
      if (view === 'auth') continue; // resetAllState clears everything by design
      const allowed = new Set([...S.profile.keys, ...(S.VIEW_STORES[view] || []).flatMap((st) => st.keys)]);
      keys.forEach((k) => { if (owned[k] && !allowed.has(k)) bad.push(view + ' reads ' + k + ' (store ' + owned[k] + ')'); });
    }
    if (bad.length) console.error(bad.join('; '));
    return bad.length === 0;
  })());
  T('store.load() is a no-op when signed out', (await S.deals.load()) === false && S.deals.loaded === false);
  {
    const st = __arkives.stores.tasks; const seen = [];
    const off = st.subscribe(() => seen.push(1));
    st.notify(); st.notify(); off(); st.notify();
    T('subscribe/notify/unsubscribe', seen.length === 2);
  }
  T('storesFor: editors load nothing, unknown hash loads the dashboard set, invoices loads invoices+clients', S.storesFor('script/x').length === 0 && S.storesFor('board/x').length === 0 && S.storesFor('nope') === S.VIEW_STORES.dashboard && S.storesFor('invoices/abc').map((s) => s.name).join(',') === 'invoices,clients');
  // ---- Router lifecycle ----
  __arkives.db.sbUpdateTask = async () => true;
  __arkives.db.sbDeleteTasks = async (ids) => { taskWrites.push({ del2: ids }); return true; };
  __arkives.state.TASKS = [{ _sbId: 'u1', title: 'Leaving', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-01' }];
  __arkives.state._taskPendingDeletes = {};
  location.hash = 'tasks'; __arkives.navigate('tasks');
  T('router tracks the mounted view', __arkives.currentRoute()?.key === 'tasks');
  __arkives.deleteTask('u1');
  location.hash = 'calendar'; __arkives.navigate('calendar');
  await new Promise(r => setTimeout(r, 10));
  T('leaving Tasks commits the pending delete (unmount)', taskWrites.some(w => w.del2 && w.del2[0] === 'u1') && !__arkives.state._taskPendingDeletes.u1 && __arkives.currentRoute()?.key === 'calendar');
  __arkives.state.TASKS = [{ _sbId: 'u2', title: 'Before', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-01' }];
  location.hash = 'tasks'; __arkives.navigate('tasks');
  __arkives.state.TASKS[0].title = 'After notify';
  __arkives.stores.tasks.notify();
  T('a store notify re-renders the mounted view', /After notify/.test(document.getElementById('view-tasks').textContent));
  location.hash = 'calendar'; __arkives.navigate('calendar');
  __arkives.state.TASKS[0].title = 'Unmounted';
  __arkives.stores.tasks.notify();
  T('an unmounted view no longer re-renders on notify', !/Unmounted/.test(document.getElementById('view-tasks').textContent));
  __arkives.state.INVOICE_DATA = [{ _sbId: 'i9', invoiceNumber: 'X-1', brand: 'B', billToName: 'B', billToAddress: '', date: '2026-08-01', dueDate: '', status: 'sent', lineItems: [], amount: 1, amountPaid: 0, tax: 0, notes: '', includePaymentInfo: false, paymentTerms: 'none', clientId: null, description: '' }];
  location.hash = 'invoices'; __arkives.navigate('invoices');
  __arkives.invOpenRowMenu('i9');
  location.hash = 'tasks'; __arkives.navigate('tasks');
  T('leaving Invoices closes the body-mounted row sheet (unmount)', document.getElementById('invSheetHost').innerHTML === '' && __arkives.state._invRowMenuId === null);
  {
    const saved = [];
    __arkives.db.sbSaveSceneFields = async (id, fields) => { saved.push(id); };
    __arkives.state._currentScriptId = 'S9'; __arkives.state._sharedScriptToken = null;
    __arkives.state._currentScenes = [{ id: 'z', script_text: '', scene_description: '' }];
    __arkives.state._sceneDirty = { z: { script_text: 'unsaved' } }; __arkives.state._titleDirty = null;
    __arkives.navigate('script/S9');
    __arkives.state._scriptLoadToken++; // abandon the editor fetch
    location.hash = 'tasks'; __arkives.navigate('tasks');
    await new Promise(r => setTimeout(r, 10));
    T('leaving the script editor flushes dirty scene saves (unmount)', saved[0] === 'z' && Object.keys(__arkives.state._sceneDirty).length === 0);
  }
  {
    const before = S.tasks.loaded; S.tasks.loaded = true; S.resetStores();
    T('resetStores marks every store unloaded', S.ALL_STORES.every((st) => st.loaded === false)); S.tasks.loaded = before;
  }

  // ---- Loaders against a fake Supabase client (the code the boot used to run in one function) ----
  {
    const fake = (tables) => ({ from(t) {
      const spec = tables[t] || { data: [] }; const b = { _single: false };
      ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete'].forEach((m) => { b[m] = () => b; });
      b.maybeSingle = () => { b._single = true; return b; }; b.single = b.maybeSingle;
      b.then = (res, rej) => Promise.resolve(b._single ? { data: spec.single === undefined ? null : spec.single, error: spec.error || null } : { data: spec.data || [], error: spec.error || null }).then(res, rej);
      return b;
    } });
    const st = __arkives.state; const realSb = st._sb;
    st._authUser = { id: 'auth-1', email: 'me@x.com' };
    st._sb = fake({
      profiles: { single: { id: 'p1', name: 'Me', email: 'me@x.com', invoice_prefix: 'ME', invoice_template: 'red', mk_interests: ['film'] } },
      platforms: { data: [{ id: 'pl1', platform: 'instagram', handle: '@me', followers: 270000, followers_display: '270K', engagement_rate: 4.2 }] },
      rate_card_settings: { single: { minimum_rate: 15000, pricing_rule: 'flat' } },
      rate_cards: { data: [{ id: 'rc1', item_id: 'r1', name: 'Reel', rate: 15000, category: 'organic' }, { id: 'rc2', item_id: 'r2', name: 'Bogus', rate: 1, category: 'nope' }] },
      deals: { data: [{ id: 'd1', brand: 'Acme', status: 'Active', value: 12000, paid: 6000 }] },
      tasks: { error: { code: 'PGRST205', message: 'missing' } },
      ideas: { data: [{ id: 'id1', title: 'Cold open', notes: 'x', archived: false, created_at: '2026-09-01' }, { id: 'id2', title: 'Old', notes: '', archived: true, archived_at: '2026-09-02', created_at: '2026-08-01' }] },
      clients: { data: [{ id: 'c1', name: 'Zed', invoice_prefix: 'ZED' }, { id: 'c2', name: 'Amy' }] },
      invoices: { data: [{ id: 'i1', invoice_number: 'ME-1', brand: 'Acme', amount: 10, status: 'sent', line_items: [{ type: 'flat', desc: 'Reel', qty: 1, rate: 0, fee: 10 }] }] },
      outreach_lists: { data: [{ id: 'l1', name: 'Brands', sort_order: 1 }] },
      outreach_targets: { data: [{ id: 't1', name: 'Nike', type: 'brand', status: 'new', list_ids: ['l1'], projects: [] }] },
      calendar_events: { data: [{ id: 'e1', date: '2026-09-10', brand: 'Acme', type: 'Post', platform: 'instagram', status: 'scheduled' }] },
      monthly_revenue: { data: [{ id: 'm1', month: 'Aug', year: 2026, amount: 5000 }] },
      campaign_results: { data: [{ id: 'cr1', brand: 'Acme', views: 1000, revenue: 12000 }] },
      audience_data: { data: [{ category: 'gender', data: { Male: 40, Female: 60 } }, { category: 'age', data: { '18-24': 30, '25-34': 50 } }] },
      inbox_items: { data: [{ id: 'ib1', brand: 'Acme', from_name: 'Jane', subject: 'Hi', status: 'new', preview: 'p' }] },
    });
    S.resetStores();
    T('profile loader maps the profile, platforms and rate card', (await S.profile.load()) === true && st.CREATOR._sbId === 'p1' && st.CREATOR.name === 'Me' && st.CREATOR.invoiceTemplate === 'red' && st.CREATOR.platforms.instagram.handle === '@me' && st.CREATOR.platforms.instagram.followers === '270K' && st.CREATOR.platforms.instagram.engagement === '4.2%' && st.RATE_CARD.minimumRate === 15000 && st.RATE_CARD.organic[0].name === 'Reel' && st.RATE_CARD.organic.length === 1, JSON.stringify({ id: st.CREATOR._sbId, ig: st.CREATOR.platforms.instagram, rc: st.RATE_CARD.organic }));
    T('load() is memoized', S.profile.load() === S.profile.load() && S.profile.loaded === true);
    await S.loadFor('tasks');
    T('tasks loader records a missing table instead of failing', S.tasks.loaded === true && st._tasksTableMissing === true && st.TASKS.length === 0);
    await S.loadFor('ideas');
    T('ideas loader maps rows and the archived flag', S.ideas.loaded === true && st._ideasTableMissing === false && st.IDEAS.length === 2 && st.IDEAS[0].title === 'Cold open' && st.IDEAS[0].archived === false && st.IDEAS[1].archived === true && st.IDEAS[1].archivedAt === '2026-09-02', JSON.stringify(st.IDEAS));
    await S.loadFor('invoices/abc');
    T('invoices route loads invoices and clients', S.invoices.loaded && S.clients.loaded && st.INVOICE_DATA[0].invoiceNumber === 'ME-1' && st.INVOICE_DATA[0].lineItems[0].fee === 10 && st.CLIENTS.length === 2 && st.CLIENTS[0].invoicePrefix === 'ZED' && st._invoicingMigrationMissing === false, JSON.stringify(st.INVOICE_DATA[0]));
    await S.loadFor('dashboard');
    T('dashboard route loads calendar, invoices, quotes, tasks and ideas (no deals)', st.CALENDAR_EVENTS[0].date === '2026-09-10' && S.invoices.loaded && S.quotes.loaded && S.tasks.loaded && S.ideas.loaded && !S.deals.loaded && S.VIEW_STORES.revenue.map((x) => x.name).join(',') === 'invoices,quotes');
    await Promise.all([S.deals.load(), S.revenue.load()]);
    T('deals and monthly revenue loaders still map rows', st.DEALS[0].brand === 'Acme' && st.DEALS[0].paid === 6000 && st.MONTHLY_REVENUE[0].month === 'Aug 2026' && st.MONTHLY_REVENUE[0].earned === 5000);
    await S.loadFor('outreach');
    T('outreach loader maps lists and targets', st.OUTREACH_LISTS[0].name === 'Brands' && st.OUTREACH_TARGETS[0].name === 'Nike' && st._outreachMigrationMissing === false);
    await Promise.all([S.audience.load(), S.inbox.load(), S.campaigns.load()]);
    T('audience, inbox and campaign loaders map rows', st.AUDIENCE_DATA.gender.female === 60 && /25-34/.test(st.AUDIENCE_DATA.topAge) && st.AUDIENCE_DATA.interests[0] === 'film' && st.INBOX_ITEMS[0].status === 'new' && st.INBOX_ITEMS[0].id === 'ib1' && st.CAMPAIGN_RESULTS[0].views === 1000, JSON.stringify(st.AUDIENCE_DATA));
    // Signed in, first visit to a view: skeleton, load, render
    S.calendar.reset(); st.CALENDAR_EVENTS = [];
    const navP = __arkives.navigate('calendar');
    const skel = /skeleton/.test(document.getElementById('view-calendar').innerHTML);
    await navP;
    T('navigate loads an unloaded store behind a skeleton, then renders', skel && S.calendar.loaded && st.CALENDAR_EVENTS.length === 1 && !!document.querySelector('#view-calendar .calendar-cell'));
    // A loader that throws leaves the store unloaded (so the next navigate retries) and toasts
    st._sb = fake({ deals: null }); st._sb.from = () => { throw new Error('boom'); };
    S.deals.reset();
    T('a throwing loader leaves the store unloaded', (await S.deals.load()) === false && S.deals.loaded === false);
    st._sb = realSb; st._authUser = null; S.resetStores(); __arkives.resetAllState();
    location.hash = 'tasks'; __arkives.navigate('tasks');
  }

  return { out, xss: !!window.__x };
}, { ACTION_NAMES: [...actionNames], VIEW_KEYS });
await browser.close();
server.close();

let fails = 0;
for (const r of [...staticOut, ...results.out]) {
  if (!r.pass) fails++;
  console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.detail && !r.pass ? '  -> ' + r.detail : ''));
}
console.log(`\n${staticOut.length + results.out.length - fails}/${staticOut.length + results.out.length} passed | injection fired: ${results.xss} | page errors: ${pageErrors.length ? pageErrors.join(' | ') : 'none'} | registry warnings: ${registryWarnings.length ? registryWarnings.join(' | ') : 'none'}`);
process.exit(fails || results.xss || pageErrors.length || registryWarnings.length ? 1 : 0);
