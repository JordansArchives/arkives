// Arkives — social numbers: the stored history (social_stats) and the
// "Scan now" button that refreshes it through the Worker
// (worker/scan.js). Shared by the dashboard and the Analytics view;
// the media kit reads the platforms rows the scan updates.
import { state } from '../state.js';
import { act } from '../lib/actions.js';
import { db } from '../lib/sb.js';
import { showToast } from '../lib/toast.js';
import { _localISODate } from './tasks.js';

const HISTORY_KEYS = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'];
export const SCAN_PLATFORMS = ['instagram', 'tiktok', 'youtube'];
const LABEL = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };

// Views repaint themselves after a scan (registered from their __init)
const _listeners = new Set();
export function onSocialUpdate(fn) { _listeners.add(fn); }
function _emit() { _listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

// social_stats payload -> state.analyticsData ({ platforms, snapshots,
// last_fetch, history }). No row / no table = stays null, never throws.
export async function loadSocialStats() {
  try {
    if (!state._sb || !state.CREATOR._sbId) return;
    const res = await state._sb.from('social_stats').select('payload').eq('user_id', state.CREATOR._sbId).limit(1).maybeSingle();
    if (res.error) {
      const missing = (res.error.code === '42P01' || res.error.code === 'PGRST205');
      if (!missing) console.error('social_stats fetch error:', res.error);
      return;
    }
    const cache = res.data && res.data.payload;
    if (!cache || !cache.platforms) return;
    state.analyticsData = { ...cache, history: socialHistory(cache.snapshots) };
    state.analyticsLastFetch = cache.last_fetch || null;
  } catch (e) {
    console.error('Analytics fetch error:', e);
  }
}

// Snapshots (old flat rows and unified per-date rows) -> per-platform
// history sorted by date: { instagram: [{date, followers}], ... }
export function socialHistory(snapshots) {
  const history = Object.fromEntries(HISTORY_KEYS.map((k) => [k, []]));
  (snapshots || []).forEach((snap) => {
    if (snap.platform && snap.date) {
      if (history[snap.platform]) history[snap.platform].push(snap);
    } else if (snap.platforms && snap.date) {
      Object.entries(snap.platforms).forEach(([plat, d]) => {
        if (history[plat]) history[plat].push({ date: snap.date, followers: d.followers || d.subscribers || d.connections || 0 });
      });
    }
  });
  Object.keys(history).forEach((p) => history[p].sort((a, b) => (a.date || '').localeCompare(b.date || '')));
  return history;
}

// Change over the last `days` of history: latest minus the newest point
// at least `days` older. null when history doesn't reach back that far.
export function followerTrend(history, days = 30) {
  const h = (history || []).filter((x) => x && x.date && (x.followers || x.subscribers) != null);
  if (h.length < 2) return null;
  const last = h[h.length - 1];
  const cut = new Date(last.date + 'T00:00:00');
  cut.setDate(cut.getDate() - days);
  const cutIso = cut.toISOString().slice(0, 10);
  let base = null;
  for (const x of h) if (x.date <= cutIso) base = x;
  if (!base) return null;
  const val = (x) => Number(x.followers ?? x.subscribers) || 0;
  return { delta: val(last) - val(base), since: base.date };
}

/* ---- SCAN ---- */
const SCAN_ERRORS = {
  not_configured: 'Scanner isn\'t switched on yet: add APIFY_TOKEN in Cloudflare (see the setup note).',
  not_deployed: 'Scanner isn\'t deployed yet. Try again after the next deploy.',
  signin: 'Sign in again to scan.',
  forbidden: 'This account isn\'t allowed to run scans.',
  read_failed: 'Couldn\'t read your platform handles. Try again.',
  network: 'Couldn\'t reach the scanner. Check your connection.',
};

export function scanErrorText(out) {
  if (out && out.error === 'cooldown') {
    const mins = Math.max(1, Math.ceil((out.retryAfterSec || 60) / 60));
    return `Scanned a few minutes ago. Try again in ${mins} min.`;
  }
  return SCAN_ERRORS[out && out.error] || 'Scan failed. Try again.';
}

// Apply a successful scan to the in-memory profile (media kit reads these)
export function applyScanResults(results) {
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(n));
  for (const plat of SCAN_PLATFORMS) {
    const r = results && results[plat];
    const p = state.CREATOR.platforms[plat];
    if (!r || r.error || r.skipped || !p) continue;
    p.followersNum = r.followers;
    p.followers = fmt(r.followers);
    if (plat === 'instagram') {
      if (r.engagementRate != null) p.engagement = r.engagementRate + '%';
      if (r.posts != null) p.posts = r.posts;
    }
    if (plat === 'tiktok' && r.likes != null) p.likes = fmt(r.likes);
    if ((plat === 'tiktok' || plat === 'youtube') && r.videos != null) p.videos = r.videos;
  }
}

export function scanSummary(results) {
  const ok = [], bad = [];
  for (const plat of SCAN_PLATFORMS) {
    const r = results && results[plat];
    if (!r || r.skipped) continue;
    if (r.error) bad.push(`${LABEL[plat]}: ${r.error}`);
    else ok.push(`${LABEL[plat]} ${state.CREATOR.platforms[plat]?.followers || r.followers}`);
  }
  return { ok, bad };
}

async function runSocialScan() {
  if (state._scanBusy) return;
  state._scanBusy = true;
  _emit();
  const out = await db.sbScanSocials(_localISODate());
  if (out && out.ok) {
    applyScanResults(out.results);
    await loadSocialStats();
    const { ok, bad } = scanSummary(out.results);
    if (!ok.length && !bad.length) showToast('Nothing to scan: add your handles in Settings → Platforms.', 'error');
    else if (bad.length && !ok.length) showToast('Scan failed. ' + bad.join(' · '), 'error');
    else showToast('Updated: ' + ok.join(' · ') + (bad.length ? '. Not updated: ' + bad.join(' · ') : ''), bad.length || out.writeFailed ? 'error' : 'success');
  } else {
    showToast(scanErrorText(out), 'error');
  }
  state._scanBusy = false;
  _emit();
}

// The button both views render; the label says what is happening
export function scanButtonHtml(extraClass = '') {
  const busy = !!state._scanBusy;
  return `<button class="btn btn-primary btn-sm scan-btn ${extraClass}" data-action="runSocialScan" ${busy ? 'disabled aria-busy="true"' : ''}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${busy ? 'scan-spin' : ''}" aria-hidden="true"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
    ${busy ? 'Scanning… about a minute' : 'Scan now'}
  </button>`;
}

export function lastScanText() {
  if (!state.analyticsLastFetch) return 'Never scanned';
  const d = new Date(state.analyticsLastFetch);
  if (isNaN(d)) return 'Never scanned';
  return 'Last scanned ' + d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

act({ runSocialScan });

export { runSocialScan };
