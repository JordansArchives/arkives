// Arkives — Dashboard view.
import { state } from '../state.js';
import { _esc } from '../lib/esc.js';
import { formatCurrency, formatDate, parseValue } from '../lib/format.js';
import { _localISODate } from './tasks.js';


/* ---- DASHBOARD ---- */

function renderDashboard() {
  const container = document.getElementById("view-dashboard");

  // Compute KPIs from DEALS
  const signedRevenue = state.DEALS.filter(d => ["SIGNED", "ACTIVE - In Production", "ACTIVE — In Production", "Completed"].includes(d.status))
    .reduce((s, d) => s + parseValue(d.value), 0);
  const totalPaid = state.DEALS.reduce((s, d) => s + (Number(d.paid) || 0), 0);
  const totalOutstanding = state.DEALS.reduce((s, d) => s + (Number(d.outstanding) || 0), 0);
  const activeDealCount = state.DEALS.filter(d => d.status && !["Declined", "Dead", "Lost"].includes(d.status)).length;
  const valuedDeals = state.DEALS.filter(d => parseValue(d.value) > 0);
  const avgValue = valuedDeals.length ? (valuedDeals.reduce((s, d) => s + parseValue(d.value), 0) / valuedDeals.length) : 0;

  // Upcoming events from CALENDAR_EVENTS
  const today = _localISODate();
  const upcoming = (state.CALENDAR_EVENTS || [])
    .filter(e => e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Dashboard</h1>
        <p class="view-subtitle">${formatDate(new Date())}</p>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="dashboard-kpis">
      <div class="kpi-card kpi-primary">
        <span class="kpi-label">Signed Revenue</span>
        <span class="kpi-value">${formatCurrency(signedRevenue)}</span>
        <span class="kpi-sub">${state.DEALS.filter(d => ["SIGNED","Completed"].includes(d.status)).length} deals closed</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Paid</span>
        <span class="kpi-value">${formatCurrency(totalPaid)}</span>
        <span class="kpi-sub">payments received</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Outstanding</span>
        <span class="kpi-value">${formatCurrency(totalOutstanding)}</span>
        <span class="kpi-sub">awaiting payment</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Active Deals</span>
        <span class="kpi-value">${activeDealCount}</span>
        <span class="kpi-sub">avg ${formatCurrency(avgValue)}</span>
      </div>
    </div>

    <!-- Monthly revenue chart -->
    <div class="dashboard-row">
      <div class="dashboard-card dashboard-chart-card">
        <div class="dashboard-card-header">
          <h3>Monthly Revenue</h3>
          <a href="#revenue" class="dashboard-card-link">View Revenue →</a>
        </div>
        <div class="chart-wrap">
          <canvas id="dashboardRevChart" height="180"></canvas>
        </div>
      </div>

      <!-- Upcoming from calendar -->
      <div class="dashboard-card dashboard-upcoming-card">
        <div class="dashboard-card-header">
          <h3>Upcoming</h3>
          <a href="#calendar" class="dashboard-card-link">Calendar →</a>
        </div>
        <div class="dashboard-upcoming">
          ${upcoming.length === 0 ? `
            <div class="dashboard-empty">
              <p>Nothing scheduled.</p>
              <a href="#calendar" class="btn btn-secondary btn-sm">Add event</a>
            </div>
          ` : upcoming.map(e => `
            <div class="upcoming-item">
              <div class="upcoming-date">
                <span class="upcoming-month">${_shortMonth(e.date)}</span>
                <span class="upcoming-day">${_shortDay(e.date)}</span>
              </div>
              <div class="upcoming-body">
                <div class="upcoming-brand">${_esc(e.brand || 'Event')}</div>
                <div class="upcoming-meta">${_esc(e.type || '')}${e.platform ? ' · ' + _esc(e.platform) : ''}</div>
              </div>
              <span class="upcoming-status status-${_slug(e.status || 'draft')}">${_esc(e.status || 'draft')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Draw the revenue chart
  setTimeout(() => renderDashboardRevChart(), 30);
}

function renderDashboardRevChart() {
  const canvas = document.getElementById('dashboardRevChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const data = state.MONTHLY_REVENUE || [];
  const labels = data.map(m => m.month);
  const values = data.map(m => Number(m.earned) || 0);

  try {
    if (canvas._chartInstance) canvas._chartInstance.destroy();
  } catch (e) {}

  const isDark = document.documentElement.dataset.theme === 'dark';
  const teal = getComputedStyle(document.documentElement).getPropertyValue('--teal').trim() || '#2A6B5A';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#B8B4AC' : '#5C5852';

  canvas._chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Revenue',
        data: values,
        backgroundColor: teal + '80',
        borderColor: teal,
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatCurrency(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 }, callback: v => '$' + (v/1000).toFixed(0) + 'K' },
          beginAtZero: true
        }
      }
    }
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

export { _shortDay, _shortMonth, _slug, renderDashboard, renderDashboardRevChart };
