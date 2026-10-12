// Arkives — social follower scan (server side).
// POST /api/social-scan runs Apify scrapers for the caller's Instagram,
// TikTok, YouTube, X, LinkedIn and Threads handles (from their
// `platforms` rows), then writes the numbers back through Supabase AS
// THE CALLER (their JWT, so RLS applies): the platforms rows (media kit)
// and a dated snapshot in social_stats (analytics history). Threads
// accounts are Instagram accounts, so with no Threads row the Instagram
// handle is scanned and a Threads row is created from it.
//
// Pure helpers are exported so tests/checks.mjs can run them in Node
// with a fake fetch; nothing here touches the network at import time.

export const SUPABASE_URL = 'https://wqblmehsqcmsdstyweus.supabase.co';
// The public (publishable) key the browser already ships with
export const SUPABASE_ANON = 'sb_publishable_jYnmjabjsjkfnBvo1Eii0g_c3aKkCf2';

export const SCAN_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'threads'];
export const SCAN_COOLDOWN_MS = 10 * 60 * 1000; // each scan spends Apify credit
const ACTORS = {
  instagram: 'apify~instagram-profile-scraper',
  tiktok: 'clockworks~tiktok-profile-scraper',
  youtube: 'streamers~youtube-channel-scraper',
  twitter: 'clappi~x-twitter-profile-scraper',
  linkedin: 'harvestapi~linkedin-profile-scraper',
  threads: 'apify~threads-profile-api-scraper',
};

export function cleanHandle(h) {
  return String(h || '').trim().replace(/^https?:\/\/[^/]+\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
}

export function formatCount(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return String(Math.round(n));
}

const _avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const _num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

// Apify input per platform; null = nothing to scan
export function actorInput(platform, row) {
  const handle = cleanHandle(row && row.handle);
  if (platform === 'instagram') return handle ? { usernames: [handle] } : null;
  if (platform === 'tiktok') return handle ? { profiles: [handle], resultsPerPage: 12, profileScrapeSections: ['videos'], excludePinnedPosts: true } : null;
  if (platform === 'youtube') {
    const url = (row && row.profile_url && /youtube\.com/i.test(row.profile_url)) ? row.profile_url : (handle ? `https://www.youtube.com/@${handle}` : '');
    return url ? { startUrls: [{ url }], maxResults: 1, maxResultsShorts: 0, maxResultStreams: 0 } : null;
  }
  if (platform === 'twitter') return handle ? { profileUrls: [`https://x.com/${handle}`] } : null;
  if (platform === 'linkedin') {
    // A pasted profile URL is used as is: cleanHandle would keep only "in"
    const url = (row && row.profile_url && /linkedin\.com\/in\//i.test(row.profile_url)) ? row.profile_url
      : /linkedin\.com\/in\//i.test(String(row && row.handle)) ? String(row.handle).trim()
      : (handle ? `https://www.linkedin.com/in/${handle}` : '');
    return url ? { urls: [url], profileScraperMode: 'Profile details no email ($4 per 1k)' } : null;
  }
  if (platform === 'threads') return handle ? { usernames: [handle] } : null;
  return null;
}

// Dataset items -> normalised numbers, or { error }
export function parseResult(platform, items) {
  if (!Array.isArray(items) || !items.length) return { error: 'No data returned (check the handle)' };
  if (platform === 'instagram') {
    const it = items[0];
    if (it.error || it.private) return { error: it.private ? 'Account is private' : String(it.error) };
    const followers = _num(it.followersCount);
    if (followers == null) return { error: 'Follower count missing' };
    const posts = (it.latestPosts || []).filter((p) => !p.isPinned).slice(0, 12);
    const avgLikes = Math.round(_avg(posts.map((p) => Math.max(0, Number(p.likesCount) || 0))));
    const avgComments = Math.round(_avg(posts.map((p) => Math.max(0, Number(p.commentsCount) || 0))));
    const er = followers > 0 && posts.length ? Math.round(((avgLikes + avgComments) / followers) * 10000) / 100 : null;
    return { followers, following: _num(it.followsCount), posts: _num(it.postsCount), averageLikes: avgLikes, averageComments: avgComments, engagementRate: er };
  }
  if (platform === 'tiktok') {
    const a = (items.find((x) => x && x.authorMeta) || {}).authorMeta;
    if (!a || _num(a.fans) == null) return { error: 'Follower count missing' };
    const vids = items.filter((x) => _num(x.playCount) != null);
    return { followers: a.fans, following: _num(a.following), likes: _num(a.heart), videos: _num(a.video), averageViews: vids.length ? Math.round(_avg(vids.map((v) => v.playCount))) : null };
  }
  if (platform === 'youtube') {
    const it = items.find((x) => x && (x.aboutChannelInfo || x.numberOfSubscribers != null)) || items[0];
    const about = it.aboutChannelInfo || {};
    const subs = _num(about.numberOfSubscribers) ?? _num(it.numberOfSubscribers);
    if (subs == null) return { error: it.error ? String(it.error) : 'Subscriber count missing' };
    return { followers: subs, videos: _num(about.channelTotalVideos) ?? _num(it.channelTotalVideos), views: _num(about.channelTotalViews) ?? _num(it.channelTotalViews) };
  }
  if (platform === 'twitter') {
    const it = items[0];
    if (it.is_protected) return { error: 'Account is protected' };
    if (it.status && it.status !== 'available') return { error: `Account ${it.status}` };
    if (_num(it.followers) == null) return { error: 'Follower count missing' };
    return { followers: it.followers, following: _num(it.following), posts: _num(it.tweets_count) };
  }
  if (platform === 'linkedin') {
    const it = items[0];
    if (_num(it.followerCount) == null) return { error: it.error ? String(it.error) : 'Follower count missing' };
    return { followers: it.followerCount, connections: _num(it.connectionsCount) };
  }
  if (platform === 'threads') {
    const it = items[0];
    if (it.is_private || it.text_post_app_is_private) return { error: 'Account is private' };
    if (_num(it.follower_count) == null) return { error: it.error ? String(it.error) : 'Follower count missing' };
    return { followers: it.follower_count };
  }
  return { error: 'Unsupported platform' };
}

// platforms-table columns for one result
export function platformRowUpdate(platform, r) {
  const u = { followers: r.followers, followers_display: formatCount(r.followers) };
  if (platform === 'instagram') {
    if (r.posts != null) u.posts = r.posts;
    if (r.engagementRate != null) u.engagement_rate = r.engagementRate;
  }
  if (platform === 'tiktok') {
    if (r.likes != null) u.likes = formatCount(r.likes);
    if (r.videos != null) u.videos = r.videos;
  }
  if (platform === 'youtube' && r.videos != null) u.videos = r.videos;
  if (platform === 'twitter' && r.posts != null) u.posts = r.posts;
  if (platform === 'linkedin' && r.connections != null) u.connections = r.connections;
  return u;
}

// Merge results into the social_stats payload: one unified snapshot per
// date (a re-scan on the same day replaces it), latest detail per
// platform, last_fetch. Never drops existing history.
export function mergePayload(payload, results, date, nowIso) {
  const p = (payload && typeof payload === 'object') ? payload : {};
  const out = { ...p, platforms: { ...(p.platforms || {}) }, snapshots: Array.isArray(p.snapshots) ? p.snapshots.slice() : [] };
  const snapPlats = {};
  for (const [plat, r] of Object.entries(results)) {
    if (!r || r.error) continue;
    const prev = out.platforms[plat] || {};
    if (plat === 'instagram') {
      out.platforms.instagram = { ...prev, followers: r.followers, following: r.following ?? prev.following, media_count: r.posts ?? prev.media_count,
        engagement_rate: r.engagementRate ?? prev.engagement_rate, average_likes: r.averageLikes, average_comments: r.averageComments };
      snapPlats.instagram = { followers: r.followers, engagement: r.engagementRate != null ? r.engagementRate + '%' : undefined, posts: r.posts ?? undefined };
    } else if (plat === 'tiktok') {
      out.platforms.tiktok = { ...prev, followers: r.followers, following: r.following ?? prev.following, likes: r.likes ?? prev.likes, videos: r.videos ?? prev.videos, average_views: r.averageViews ?? prev.average_views };
      snapPlats.tiktok = { followers: r.followers, likes: r.likes != null ? formatCount(r.likes) : undefined };
    } else if (plat === 'youtube') {
      out.platforms.youtube = { ...prev, subscribers: r.followers, videos: r.videos ?? prev.videos, views: r.views ?? prev.views };
      snapPlats.youtube = { subscribers: r.followers, videos: r.videos ?? undefined };
    } else if (plat === 'twitter') {
      out.platforms.twitter = { ...prev, followers: r.followers, following: r.following ?? prev.following, tweets: r.posts ?? prev.tweets };
      snapPlats.twitter = { followers: r.followers, posts: r.posts ?? undefined };
    } else if (plat === 'linkedin') {
      out.platforms.linkedin = { ...prev, followers: r.followers, connections: r.connections ?? prev.connections };
      snapPlats.linkedin = { followers: r.followers, connections: r.connections ?? undefined };
    } else if (plat === 'threads') {
      out.platforms.threads = { ...prev, followers: r.followers };
      snapPlats.threads = { followers: r.followers };
    }
  }
  if (Object.keys(snapPlats).length) {
    const i = out.snapshots.findIndex((s) => s && s.date === date && s.platforms);
    const merged = { date, platforms: { ...(i >= 0 ? out.snapshots[i].platforms : {}), ...snapPlats } };
    if (i >= 0) out.snapshots[i] = merged; else out.snapshots.push(merged);
    out.last_fetch = nowIso;
  }
  return out;
}

// "a@x.com, b@y.com" -> ['a@x.com','b@y.com']; tolerates quotes,
// semicolons, newlines and stray spaces pasted into the dashboard
export function parseAllowList(v) {
  return String(v || '').split(/[,;\s]+/).map((x) => x.replace(/^["'<]+|["'>]+$/g, '').trim().toLowerCase()).filter((x) => x.includes('@'));
}

const _json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export async function handleScan(req, env, fetchImpl = fetch) {
  if (req.method !== 'POST') return _json({ ok: false, error: 'method' }, 405);
  const auth = req.headers.get('Authorization') || '';
  if (!/^Bearer \S+$/.test(auth)) return _json({ ok: false, error: 'signin' }, 401);
  const sbHeaders = { apikey: SUPABASE_ANON, Authorization: auth, 'Content-Type': 'application/json' };
  const rest = (path, init = {}) => fetchImpl(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...sbHeaders, ...(init.headers || {}) } });

  // Who is asking (Supabase validates the JWT)
  const userRes = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, { headers: sbHeaders });
  if (!userRes.ok) return _json({ ok: false, error: 'signin' }, 401);
  const user = await userRes.json();
  const allow = parseAllowList(env.SCAN_ALLOWED_EMAILS);
  const email = String(user.email || '').trim().toLowerCase();
  // The caller's own login email comes back so the message can say what to add
  if (allow.length && !allow.includes(email)) return _json({ ok: false, error: 'forbidden', email }, 403);
  if (!env.APIFY_TOKEN) return _json({ ok: false, error: 'not_configured' }, 503);

  let body = {};
  try { body = await req.json(); } catch { body = {}; }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : new Date().toISOString().slice(0, 10);

  const [platRes, statsRes] = await Promise.all([
    rest('platforms?select=id,user_id,platform,handle,profile_url'),
    rest('social_stats?select=id,payload&limit=1'),
  ]);
  if (!platRes.ok) return _json({ ok: false, error: 'read_failed' }, 502);
  const rows = await platRes.json();
  const statsRows = statsRes.ok ? await statsRes.json() : [];
  const stats = statsRows[0] || null;
  const last = stats && stats.payload && stats.payload.last_fetch ? Date.parse(stats.payload.last_fetch) : 0;
  if (last && Date.now() - last < SCAN_COOLDOWN_MS) {
    return _json({ ok: false, error: 'cooldown', retryAfterSec: Math.ceil((SCAN_COOLDOWN_MS - (Date.now() - last)) / 1000) }, 429);
  }

  const jobs = SCAN_PLATFORMS.map((plat) => {
    const row = rows.find((r) => r.platform === plat);
    // Threads logs in with Instagram: same username unless set separately
    const ig = rows.find((r) => r.platform === 'instagram');
    const input = actorInput(plat, plat === 'threads' && !(row && cleanHandle(row.handle)) ? ig : row);
    return { plat, row, input };
  });
  const results = {};
  await Promise.all(jobs.map(async ({ plat, input }) => {
    if (!input) { results[plat] = { skipped: true }; return; }
    try {
      const res = await fetchImpl(`https://api.apify.com/v2/acts/${ACTORS[plat]}/run-sync-get-dataset-items?timeout=150&clean=true`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.APIFY_TOKEN}` }, body: JSON.stringify(input),
      });
      if (!res.ok) { results[plat] = { error: res.status === 402 ? 'Apify credit used up' : `Scraper failed (${res.status})` }; return; }
      results[plat] = parseResult(plat, await res.json());
    } catch (e) {
      results[plat] = { error: 'Scraper unreachable' };
    }
  }));

  // Write back as the caller
  const writes = [];
  for (const { plat, row } of jobs) {
    const r = results[plat];
    if (!r || r.error || r.skipped) continue;
    if (row) {
      writes.push(rest(`platforms?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify(platformRowUpdate(plat, r)) }));
    } else if (plat === 'threads') {
      // platforms.user_id is the profile id (not the auth id): reuse the Instagram row's
      const ig = rows.find((x) => x.platform === 'instagram');
      if (ig && ig.user_id) writes.push(rest('platforms', { method: 'POST', body: JSON.stringify({ user_id: ig.user_id, platform: 'threads', handle: cleanHandle(ig.handle), ...platformRowUpdate(plat, r) }) }));
    }
  }
  const scannedAt = new Date().toISOString();
  const payload = mergePayload(stats && stats.payload, results, date, scannedAt);
  if (payload.last_fetch === scannedAt) {
    writes.push(stats
      ? rest(`social_stats?id=eq.${encodeURIComponent(stats.id)}`, { method: 'PATCH', body: JSON.stringify({ payload }) })
      : rest('social_stats', { method: 'POST', body: JSON.stringify({ payload }) }));
  }
  const wr = await Promise.all(writes);
  const writeFailed = wr.some((r) => !r.ok);

  return _json({ ok: true, scannedAt, date, results, writeFailed });
}
