// Arkives — Dashboard view. Every number is read from the tools:
// money from Invoices, pipeline from Quotes, Tasks, Ideas, Calendar,
// recent Boards and Scripts, followers from the last social scan.
import { state } from '../state.js';
import { _esc } from '../lib/esc.js';
import { formatDate } from '../lib/format.js';
import { db } from '../lib/sb.js';
import { moneySummary, quoteSummary, revenueByMonth, taskSummary } from '../lib/metrics.js';
import { SKETCHY_ICONS } from '../lib/icons.js';
import { followerTrend, lastScanText, loadSocialStats, onSocialUpdate, scanButtonHtml } from './social.js';
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

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Dashboard</h1>
        <p class="view-subtitle">${formatDate(new Date())}</p>
      </div>
    </div>

    <section class="dash-tiles" id="dashTiles" aria-label="Quick access">${_tilesHtml(today)}</section>

    <div class="dashboard-kpis">
      <a href="#revenue" class="kpi-card kpi-primary dash-kpi-link">
        <span class="kpi-label">Paid this month</span>
        <span class="kpi-value">${_money(money.paidMonth)}</span>
        <span class="kpi-sub">${_money(money.paidYear)} this year</span>
      </a>
      <a href="#invoices" class="kpi-card dash-kpi-link">
        <span class="kpi-label">Outstanding</span>
        <span class="kpi-value">${_money(money.outstanding)}</span>
        <span class="kpi-sub">${money.outstandingCount ? _plural(money.outstandingCount, 'invoice') + ' unpaid' : 'nothing owed'}${money.overdueCount ? ` · <span class="dash-warn">${_money(money.overdue)} overdue</span>` : ''}</span>
      </a>
      <a href="#quotes" class="kpi-card dash-kpi-link">
        <span class="kpi-label">Open quotes</span>
        <span class="kpi-value">${_money(quotes.openValue)}</span>
        <span class="kpi-sub">${quotes.openCount} awaiting${quotes.winRate != null ? ` · ${quotes.winRate}% win rate` : ''}${quotes.unseen ? ` · <span class="dash-warn">${_plural(quotes.unseen, 'new reply', 'new replies')}</span>` : ''}</span>
      </a>
      <a href="#tasks" class="kpi-card dash-kpi-link">
        <span class="kpi-label">Open tasks</span>
        <span class="kpi-value">${tasks.openCount}</span>
        <span class="kpi-sub">${tasks.dueToday || tasks.overdue ? `${tasks.dueToday} due today${tasks.overdue ? ` · <span class="dash-warn">${tasks.overdue} overdue</span>` : ''}` : 'nothing due today'}</span>
      </a>
    </div>

    <div class="dashboard-row">
      <div class="dashboard-card dashboard-chart-card">
        <div class="dashboard-card-header">
          <h3>Revenue</h3>
          <a href="#revenue" class="dashboard-card-link">Revenue →</a>
        </div>
        ${hasInvoices ? `
          <div class="dash-legend"><span class="dash-key dash-key-paid"></span>Paid <span class="dash-key dash-key-inv"></span>Invoiced</div>
          <div class="chart-wrap"><canvas id="dashboardRevChart" height="180"></canvas></div>
        ` : `
          <div class="dashboard-empty">
            <p>Revenue shows up here as you send and get paid on invoices.</p>
            <a href="#invoices/new" class="btn btn-secondary btn-sm">New invoice</a>
          </div>`}
      </div>

      <div class="dashboard-card" id="dashAudience">${_audienceHtml()}</div>
    </div>

    <div class="dashboard-card dash-activity" id="dashActivity">${_activityHtml(today, tasks)}</div>
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
  _repaintPart('dashActivity', () => _activityHtml(today, taskSummary(state.TASKS, today)));
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

function _tilesHtml(today) {
  const r = state._dashRecent || {};
  const accepted = (state.QUOTES || []).filter((q) => q.status === 'accepted')
    .sort((a, b) => (b.respondedAt || '').localeCompare(a.respondedAt || '')).slice(0, 3);
  const upcoming = (state.CALENDAR_EVENTS || []).filter((e) => e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  return `
    <div class="dash-tile">
      <div class="dash-tile-head"><a href="#boards" class="dash-tile-title">Boards</a><button class="btn btn-secondary btn-sm" data-action="_createNewBoard">+ New</button></div>
      ${_recentList(r.boards, 'board', 'No boards yet.')}
    </div>
    <div class="dash-tile">
      <div class="dash-tile-head"><a href="#scripts" class="dash-tile-title">Scripts</a><button class="btn btn-secondary btn-sm" data-action="_createNewScript">+ New</button></div>
      ${_recentList(r.scripts, 'script', 'No scripts yet.')}
    </div>
    <div class="dash-tile">
      <div class="dash-tile-head"><a href="#contracts" class="dash-tile-title">Contracts</a><a href="#contracts" class="btn btn-secondary btn-sm">+ New</a></div>
      ${accepted.length ? `<div class="dash-tile-hint">Accepted quotes, ready for a contract</div>` + accepted.map((q) => `
        <a class="dash-tile-row" href="#quotes/${encodeURIComponent(q._sbId)}">
          <span class="dash-tile-name">${_esc(q.title || q.quoteNumber)}</span>
          <span class="dash-tile-meta">${_esc(q.clientCompany || q.clientName || '')}</span>
        </a>`).join('') : '<div class="dash-tile-empty">Accepted quotes show up here, ready to turn into a contract.</div>'}
    </div>
    <div class="dash-tile">
      <div class="dash-tile-head"><a href="#calendar" class="dash-tile-title">Calendar</a><a href="#calendar" class="btn btn-secondary btn-sm">+ Add</a></div>
      ${upcoming.length ? upcoming.map((e) => `
        <a class="dash-tile-row" href="#calendar">
          <span class="dash-tile-name"><span class="dash-tile-date">${_shortMonth(e.date)} ${_shortDay(e.date)}</span>${_esc(e.brand || 'Event')}</span>
          <span class="dash-tile-meta">${_esc(e.type || '')}</span>
        </a>`).join('') : '<div class="dash-tile-empty">Nothing scheduled.</div>'}
    </div>`;
}

/* ---- AUDIENCE (last social scan) ---- */

const AUD_PLATFORMS = [
  { key: 'instagram', cls: 'ig', icon: 'instagramSmall', label: 'Instagram' },
  { key: 'tiktok', cls: 'tt', icon: 'tiktokSmall', label: 'TikTok' },
  { key: 'youtube', cls: 'yt', icon: 'youtubeSmall', label: 'YouTube' },
];

function _audienceHtml() {
  const hist = (state.analyticsData && state.analyticsData.history) || {};
  const rows = AUD_PLATFORMS.map((d) => {
    const p = state.CREATOR.platforms[d.key] || {};
    const trend = followerTrend(hist[d.key], 30);
    const trendHtml = trend ? `<span class="dash-aud-trend ${trend.delta >= 0 ? 'up' : 'down'}">${trend.delta >= 0 ? '+' : '−'}${_compact(Math.abs(trend.delta))} in 30 days</span>` : '';
    return `
      <div class="dash-aud-row">
        <span class="platform-icon ${d.cls}" style="width:28px;height:28px">${SKETCHY_ICONS[d.icon] || ''}</span>
        <span class="dash-aud-name">${d.label}</span>
        ${p.handle || p.followersNum ? `<span class="dash-aud-num">${_esc(p.followers || '0')}</span>${trendHtml}` : '<a href="#settings" class="dash-aud-add">Add handle</a>'}
      </div>`;
  }).join('');
  return `
    <div class="dashboard-card-header">
      <h3>Audience</h3>
      <a href="#analytics" class="dashboard-card-link">Analytics →</a>
    </div>
    <div class="dash-aud">${rows}</div>
    <div class="dash-aud-foot">
      <span class="dash-aud-last">${lastScanText()}</span>
      ${scanButtonHtml()}
    </div>`;
}

function _compact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}

/* ---- TOOL ACTIVITY ---- */

function _activityHtml(today, tasks) {
  const month = today.slice(0, 7);
  const r = state._dashRecent || {};
  const quotesSent = (state.QUOTES || []).filter((q) => (q.sentAt || '').slice(0, 7) === month).length;
  const invoicesSent = (state.INVOICE_DATA || []).filter((i) => i.status !== 'draft' && (i.date || '').slice(0, 7) === month).length;
  const ideasOpen = (state.IDEAS || []).filter((i) => !i.archived).length;
  const editedThisWeek = (xs) => (xs || []).filter((x) => Date.now() - Date.parse(x.updated_at || 0) < 7 * 864e5).length;
  const stat = (href, value, label) => `<a href="#${href}" class="dash-stat"><span class="dash-stat-num">${value}</span><span class="dash-stat-label">${label}</span></a>`;
  return `
    <div class="dashboard-card-header"><h3>Tool activity</h3></div>
    <div class="dash-stats">
      ${stat('tasks', tasks.doneThisWeek, 'tasks done, last 7 days')}
      ${stat('quotes', quotesSent, 'quotes sent this month')}
      ${stat('invoices', invoicesSent, 'invoices issued this month')}
      ${stat('boards', r.boards ? editedThisWeek(r.boards) : '–', 'boards edited this week')}
      ${stat('scripts', r.scripts ? editedThisWeek(r.scripts) : '–', 'scripts edited this week')}
      ${stat('ideas', ideasOpen, 'ideas on the list')}
    </div>`;
}

/* ---- CHART ---- */

function renderDashboardRevChart(today) {
  const canvas = document.getElementById('dashboardRevChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const months = revenueByMonth(state.INVOICE_DATA, today || _localISODate(), 12);
  try { if (canvas._chartInstance) canvas._chartInstance.destroy(); } catch (e) {}

  const isDark = document.documentElement.dataset.theme === 'dark';
  const teal = getComputedStyle(document.documentElement).getPropertyValue('--teal').trim() || '#2A6B5A';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#B8B4AC' : '#5C5852';

  canvas._chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        { label: 'Paid', data: months.map((m) => m.paid), backgroundColor: teal, borderRadius: 4 },
        { label: 'Invoiced', data: months.map((m) => m.invoiced), backgroundColor: teal + '33', borderColor: teal + '80', borderWidth: 1, borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + _money(ctx.parsed.y) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
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
    if ((location.hash || '#dashboard').slice(1) === 'dashboard') _repaintPart('dashAudience', _audienceHtml);
  });
}

export { _shortDay, _shortMonth, _slug, renderDashboard, renderDashboardRevChart };
