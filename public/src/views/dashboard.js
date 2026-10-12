// Arkives — Dashboard view. Every number is read from the tools:
// money from Invoices, pipeline from Quotes, Tasks, Ideas, Calendar,
// recent Boards and Scripts, followers from the last social scan.
import { state } from '../state.js';
import { _args, act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { formatDate } from '../lib/format.js';
import { db } from '../lib/sb.js';
import { moneySummary, quoteSummary, revenueByMonth, taskSummary } from '../lib/metrics.js';
import { SKETCHY_ICONS } from '../lib/icons.js';
import { followerTrend, lastScanText, loadSocialStats, onSocialUpdate, scanButtonHtml, scanNoteHtml } from './social.js';
import { _localISODate } from './tasks.js';

const RECENT_TTL_MS = 60 * 1000;
const _money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const _plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

/* ---- DASHBOARD ---- */

function renderDashboard() {
  const container = document.getElementById('view-dashboard');
  if (!container) return;
  const today = _localISODate();
  const money = moneySummary(state.INVOICE_DATA, today);
  const quotes = quoteSummary(state.QUOTES);
  const tasks = taskSummary(state.TASKS, today);
  const hasInvoices = (state.INVOICE_DATA || []).some((i) => i.status !== 'draft');

  const statusRows = [
    { href: 'invoices', tone: 'orange', label: 'Outstanding', num: _money(money.outstanding),
      sub: money.outstandingCount ? `${_plural(money.outstandingCount, 'unpaid invoice')}${money.overdueCount ? `, <span class="dash-warn">${_money(money.overdue)} overdue</span>` : ''}` : 'Nothing owed right now' },
    { href: 'quotes', tone: 'teal', label: 'Open quotes', num: _money(quotes.openValue),
      sub: `${_plural(quotes.openCount, 'quote')} waiting on a reply${quotes.winRate != null ? `, ${quotes.winRate}% won` : ''}${quotes.unseen ? `<span class="dash-pill">${_plural(quotes.unseen, 'new reply', 'new replies')}</span>` : ''}` },
    { href: 'tasks', tone: 'blue', label: 'Open tasks', num: String(tasks.openCount),
      sub: tasks.dueToday || tasks.overdue ? `${tasks.dueToday} due today${tasks.overdue ? `, <span class="dash-warn">${tasks.overdue} overdue</span>` : ''}` : 'Nothing due today' },
  ];

  container.innerHTML = `
    <div class="view-header dash-header">
      <div>
        <h1 class="view-title">Dashboard</h1>
        <p class="view-subtitle">${formatDate(new Date())}</p>
      </div>
      <div class="dash-scan" id="dashScan">${_scanHtml()}</div>
    </div>

    <section class="dash-tiles" id="dashTiles" aria-label="Your tools">${_tilesHtml(today)}</section>

    <div class="dash-money">
      <section class="dash-ledger" aria-label="Revenue">
        <div class="dash-ledger-head">
          <a href="#revenue" class="dash-ledger-total">
            <span class="dash-label">Paid this month</span>
            <span class="dash-hero-num">${_money(money.paidMonth)}</span>
            <span class="dash-sub">${_money(money.paidYear)} so far this year</span>
          </a>
          ${hasInvoices ? '<div class="dash-legend"><span class="dash-key dash-key-paid"></span>Paid<span class="dash-key dash-key-inv"></span>Invoiced</div>' : ''}
        </div>
        ${hasInvoices ? `
          <div class="chart-wrap dash-chart"><canvas id="dashboardRevChart" height="180" aria-label="Paid and invoiced by month, last 12 months" role="img"></canvas></div>
        ` : `
          <div class="dash-ledger-empty">
            <p>Your revenue builds up here as you send invoices and mark them paid.</p>
            <a href="#invoices/new" class="btn btn-primary btn-sm">New invoice</a>
          </div>`}
      </section>

      <div class="dash-status">
        ${statusRows.map((r) => `
          <a href="#${r.href}" class="dash-status-row tone-${r.tone}">
            <span class="dash-label">${r.label}</span>
            <span class="dash-status-num">${r.num}</span>
            <span class="dash-sub">${r.sub}</span>
          </a>`).join('')}
      </div>
    </div>

    <section class="dash-social" id="dashAudience" aria-label="Social">${_audienceHtml()}</section>
  `;

  if (hasInvoices) setTimeout(() => renderDashboardRevChart(today), 30);
  _loadRecent();
  if (!state.analyticsData && !state._dashSocialTried && state._authUser) {
    state._dashSocialTried = true;
    loadSocialStats().then(() => _repaintPart('dashAudience', _audienceHtml));
  }
}

function _repaintPart(id, fn) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = fn();
}

// Boards and Scripts have no store; the dashboard reads them on entry
// (at most once a minute) and repaints just the parts that use them
async function _loadRecent() {
  const r = state._dashRecent;
  if (!state._sb || !state._authUser || (r && Date.now() - r.at < RECENT_TTL_MS)) return;
  state._dashRecent = { at: Date.now(), boards: r ? r.boards : null, scripts: r ? r.scripts : null };
  const [boards, scripts] = await Promise.all([db.sbFetchBoards(), db.sbFetchScripts()]);
  state._dashRecent = { at: Date.now(), boards: boards || [], scripts: scripts || [] };
  const today = _localISODate();
  _repaintPart('dashTiles', () => _tilesHtml(today));
}

/* ---- QUICK ACCESS ---- */

function _ago(iso) {
  const t = Date.parse(iso || '');
  if (!t) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.round(hrs / 24);
  return days < 30 ? days + 'd ago' : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function _recentList(items, hrefPrefix, emptyText) {
  if (items == null) return '<div class="dash-tile-empty">Loading…</div>';
  if (!items.length) return `<div class="dash-tile-empty">${emptyText}</div>`;
  return items.slice(0, 3).map((x) => `
    <a class="dash-tile-row" href="#${hrefPrefix}/${encodeURIComponent(x.id)}">
      <span class="dash-tile-name">${_esc(x.title || 'Untitled')}</span>
      <span class="dash-tile-meta">${_ago(x.updated_at)}</span>
    </a>`).join('');
}

const TILE_ICONS = {
  boards: '<path d="M3.2 4.1h17.6v13.7H3.2z"/><path d="M8.1 21.2l3.9-3.3 3.9 3.2"/><path d="M6.8 7.9h4.1v3.9H6.8z"/><path d="M13.9 9.6h3.4"/><path d="M13.8 12.4h3.5"/>',
  scripts: '<path d="M4.1 3.2h11.8l4 4.1v13.5c0 .6-.5 1.1-1.1 1.1H4.1c-.6 0-1.1-.5-1.1-1.1V4.3c0-.6.5-1.1 1.1-1.1z"/><path d="M7.2 8.1h5.8"/><path d="M7.2 12h9.6"/><path d="M7.2 15.9h9.6"/><path d="M14.1 3.2v5h5"/>',
  contracts: '<path d="M14.1 2.2H6.2c-1.2 0-2.1.9-2.1 2v15.8c0 1.1.9 2 2.1 2h11.6c1.2 0 2.1-.9 2.1-2V8.1z"/><path d="M14 2.2v5.9h5.9"/><path d="M9.1 15.1l2 1.9 3.8-3.9"/>',
  calendar: '<path d="M3.2 4.2h17.6c.6 0 1.1.5 1.1 1.1v14.5c0 .6-.5 1.1-1.1 1.1H3.2c-.6 0-1.1-.5-1.1-1.1V5.3c0-.6.5-1.1 1.1-1.1z"/><path d="M16.1 2.1v4.1"/><path d="M8 2.1v4.1"/><path d="M2.1 10.1h19.8"/>',
};

function _tileHead(key, title, newHtml) {
  return `<div class="dash-tile-head">
    <a href="#${key}" class="dash-tile-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TILE_ICONS[key]}</svg>${title}</a>
    ${newHtml}
  </div>`;
}

function _tilesHtml(today) {
  const r = state._dashRecent || {};
  const accepted = (state.QUOTES || []).filter((q) => q.status === 'accepted')
    .sort((a, b) => (b.respondedAt || '').localeCompare(a.respondedAt || '')).slice(0, 3);
  const upcoming = (state.CALENDAR_EVENTS || []).filter((e) => e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  return `
    <div class="dash-tile tile-boards">
      ${_tileHead('boards', 'Boards', '<button class="dash-tile-new" data-action="_createNewBoard" aria-label="New board">+ New</button>')}
      ${_recentList(r.boards, 'board', 'Start a moodboard for your next shoot.')}
    </div>
    <div class="dash-tile tile-scripts">
      ${_tileHead('scripts', 'Scripts', '<button class="dash-tile-new" data-action="_createNewScript" aria-label="New script">+ New</button>')}
      ${_recentList(r.scripts, 'script', 'Write the first scene of a script.')}
    </div>
    <div class="dash-tile tile-contracts">
      ${_tileHead('contracts', 'Contracts', '<a href="#contracts" class="dash-tile-new" aria-label="New contract">+ New</a>')}
      ${accepted.length ? `<div class="dash-tile-hint">Accepted quotes, ready for a contract</div>` + accepted.map((q) => `
        <a class="dash-tile-row" href="#quotes/${encodeURIComponent(q._sbId)}">
          <span class="dash-tile-name">${_esc(q.title || q.quoteNumber)}</span>
          <span class="dash-tile-meta">${_esc(q.clientCompany || q.clientName || '')}</span>
        </a>`).join('') : '<div class="dash-tile-empty">When a client accepts a quote, it lands here ready to turn into a contract.</div>'}
    </div>
    <div class="dash-tile tile-calendar">
      ${_tileHead('calendar', 'Calendar', '<a href="#calendar" class="dash-tile-new" aria-label="Add event">+ Add</a>')}
      ${upcoming.length ? upcoming.map((e) => `
        <a class="dash-tile-row" href="#calendar">
          <span class="dash-tile-name"><span class="dash-tile-date">${_shortMonth(e.date)} ${_shortDay(e.date)}</span>${_esc(e.brand || 'Event')}</span>
          <span class="dash-tile-meta">${_esc(e.type || '')}</span>
        </a>`).join('') : '<div class="dash-tile-empty">Nothing scheduled. Add a shoot or a posting date.</div>'}
    </div>`;
}

/* ---- SOCIAL (last social scan) ---- */

const AUD_PLATFORMS = [
  { key: 'instagram', cls: 'ig', icon: 'instagramSmall', label: 'Instagram', tone: 'pink' },
  { key: 'tiktok', cls: 'tt', icon: 'tiktokSmall', label: 'TikTok', tone: 'teal' },
  { key: 'youtube', cls: 'yt', icon: 'youtubeSmall', label: 'YouTube', tone: 'orange' },
  { key: 'twitter', cls: 'tw', icon: 'twitterSmall', label: 'X', tone: 'ink' },
  { key: 'linkedin', cls: 'li', icon: 'linkedinSmall', label: 'LinkedIn', tone: 'blue' },
  { key: 'threads', cls: 'th', icon: 'threadsSmall', label: 'Threads', tone: 'yellow' },
];

// One supporting number per platform, from the profile rows the scan writes
function _platformDetail(key, p) {
  const n = (v) => _compact(Number(v) || 0);
  if (key === 'instagram') return p.engagement && p.engagement !== '0%' ? `${_esc(p.engagement)} engagement` : '';
  if (key === 'tiktok') return p.likes && p.likes !== '0' ? `${_esc(p.likes)} likes` : '';
  if (key === 'youtube') return p.videos ? `${n(p.videos)} videos` : '';
  if (key === 'twitter') return p.posts ? `${n(p.posts)} posts` : '';
  if (key === 'linkedin') return p.connections ? `${n(p.connections)} connections` : '';
  const h = String(p.handle || '').replace(/^https?:\/\/[^/]+\/(in\/)?/i, '').replace(/^@/, '').replace(/\/.*$/, '');
  return h ? '@' + _esc(h) : '';
}

function _trendHtml(trend) {
  if (!trend) return '<span class="dash-soc-trend">No trend yet</span>';
  const d = trend.delta;
  return `<span class="dash-soc-trend ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : d < 0 ? '−' : ''}${_compact(Math.abs(d))} this month</span>`;
}

function _audienceHtml() {
  const hist = (state.analyticsData && state.analyticsData.history) || {};
  const cards = AUD_PLATFORMS.map((d) => {
    const p = state.CREATOR.platforms[d.key] || {};
    const has = !!(p.handle || p.followersNum);
    const trend = followerTrend(hist[d.key], 30);
    const head = `<span class="dash-soc-name"><span class="platform-icon ${d.cls}">${SKETCHY_ICONS[d.icon] || ''}</span>${d.label}</span>`;
    if (!has) {
      // Threads is scanned from the Instagram handle, so it only needs a scan
      const viaIg = d.key === 'threads' && (state.CREATOR.platforms.instagram || {}).handle;
      return `<a href="#settings" class="dash-soc-card is-empty tone-${d.tone}">${head}
        <span class="dash-soc-add">${viaIg ? 'Fills in on your next scan' : 'Add your handle'}</span></a>`;
    }
    const detail = _platformDetail(d.key, p);
    return `<a href="#analytics" class="dash-soc-card tone-${d.tone}" data-action="_dashOpenPlatform" data-args="${_args(d.key)}">${head}
        <span class="dash-soc-num">${_esc(p.followers || '0')}</span>
        ${_trendHtml(trend)}
        <span class="dash-soc-detail">${detail || '&nbsp;'}</span>
      </a>`;
  }).join('');
  // Total across every platform; the month change sums the platforms whose history reaches back 30 days
  const total = AUD_PLATFORMS.reduce((n, d) => n + (Number((state.CREATOR.platforms[d.key] || {}).followersNum) || 0), 0);
  const trends = AUD_PLATFORMS.map((d) => followerTrend(hist[d.key], 30)).filter(Boolean);
  const totalDelta = trends.reduce((n, t) => n + t.delta, 0);
  const totalSub = trends.length
    ? `<span class="dash-soc-trend ${totalDelta > 0 ? 'up' : totalDelta < 0 ? 'down' : ''}">${totalDelta > 0 ? '+' : totalDelta < 0 ? '−' : ''}${_compact(Math.abs(totalDelta))} this month</span><span class="dash-sub"> · ${lastScanText()}</span>`
    : `<span class="dash-sub">${lastScanText()}</span>`;
  return `
    <div class="dash-soc-head">
      <a href="#analytics" class="dash-soc-total">
        <span class="dash-label">Total followers</span>
        <span class="dash-soc-hero">${total.toLocaleString('en-US')}</span>
        <span class="dash-soc-sub">${totalSub}</span>
      </a>
      <a href="#analytics" class="dash-soc-link">Open analytics</a>
    </div>
    <div class="dash-soc-grid">${cards}</div>`;
}

function _dashOpenPlatform(key) { state.analyticsPlatform = key; }
act({ _dashOpenPlatform });

function _scanHtml() {
  return `<div class="dash-scan-row"><span class="dash-scan-last">${lastScanText()}</span>${scanButtonHtml()}</div>${scanNoteHtml()}`;
}

function _compact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}

/* ---- CHART ---- */

function renderDashboardRevChart(today) {
  const canvas = document.getElementById('dashboardRevChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const months = revenueByMonth(state.INVOICE_DATA, today || _localISODate(), 12);
  try { if (canvas._chartInstance) canvas._chartInstance.destroy(); } catch (e) {}

  const isDark = document.documentElement.dataset.theme === 'dark';
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#C73539';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#B8B4AC' : '#5C5852';

  canvas._chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        { label: 'Paid', data: months.map((m) => m.paid), backgroundColor: ink, borderRadius: 1, barPercentage: 0.7, categoryPercentage: 0.7 },
        { label: 'Invoiced', data: months.map((m) => m.invoiced), backgroundColor: ink + '1F', borderColor: ink + '99', borderWidth: 1.5, borderRadius: 1, barPercentage: 0.7, categoryPercentage: 0.7 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + _money(ctx.parsed.y) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 10 } },
        y: { grid: { color: gridColor }, beginAtZero: true, ticks: { color: textColor, font: { size: 11 }, callback: (v) => (v >= 1000 ? '$' + (v / 1000).toFixed(0) + 'K' : '$' + v) } },
      },
    },
  });
}

function _shortMonth(iso) {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleString('en-US', { month: 'short' });
  } catch { return ''; }
}
function _shortDay(iso) {
  try {
    return new Date(iso + 'T00:00:00').getDate();
  } catch { return ''; }
}
function _slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function __init() {
  onSocialUpdate(() => {
    if ((location.hash || '#dashboard').slice(1) !== 'dashboard') return;
    _repaintPart('dashAudience', _audienceHtml);
    _repaintPart('dashScan', _scanHtml);
  });
}

export { _shortDay, _shortMonth, _slug, renderDashboard, renderDashboardRevChart };
