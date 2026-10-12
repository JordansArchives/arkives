// Arkives — Revenue view. Built from Invoices only (paid = paid
// invoices plus partial payments, outstanding = unpaid balances on sent
// invoices); deal fields and the old monthly_revenue table no longer
// feed it. Open quotes show what is still in play.
import { state } from '../state.js';
import { _esc } from '../lib/esc.js';
import { moneySummary, paidDay, quoteSummary, received, revenueByMonth } from '../lib/metrics.js';
import { invBalance, invDisplayStatus, invTotal } from './invoices.js';
import { _localISODate } from './tasks.js';

const _money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const STATUS_LABEL = { sent: 'Sent', paid: 'Paid', overdue: 'Overdue' };
const STATUS_BADGE = { sent: 'negotiating', paid: 'active', overdue: 'followup' };

function renderRevenue() {
  const container = document.getElementById('view-revenue');
  if (!container) return;
  const today = _localISODate();
  const money = moneySummary(state.INVOICE_DATA, today);
  const quotes = quoteSummary(state.QUOTES);
  const issued = (state.INVOICE_DATA || []).filter((i) => i.status !== 'draft')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Revenue</h1>
        <p class="view-subtitle">From your invoices${money.draftCount ? ` · ${money.draftCount} draft${money.draftCount === 1 ? '' : 's'} not counted` : ''}</p>
      </div>
      <a href="#invoices/new" class="btn btn-primary">+ New Invoice</a>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Paid this year</span>
        <span class="kpi-value" style="color:var(--green)">${_money(money.paidYear)}</span>
        <span class="kpi-delta up">${_money(money.paidMonth)} this month</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Outstanding</span>
        <span class="kpi-value" style="color:var(--accent)">${_money(money.outstanding)}</span>
        <span class="kpi-delta ${money.overdueCount ? 'down' : 'neutral'}">${money.overdueCount ? _money(money.overdue) + ' overdue' : 'nothing overdue'}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Invoiced this year</span>
        <span class="kpi-value">${_money(money.invoicedYear)}</span>
        <span class="kpi-delta neutral">${money.paidCount} paid in full, all time</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Open quotes</span>
        <span class="kpi-value" style="color:var(--teal)">${_money(quotes.openValue)}</span>
        <span class="kpi-delta neutral">${quotes.openCount} awaiting a reply</span>
      </div>
    </div>

    <div class="chart-row">
      <div class="card">
        <div class="card-header"><span class="card-title">Paid by month</span></div>
        <div class="chart-container"><canvas id="chartMonthlyRevenue"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Where the money is</span></div>
        <div class="chart-container"><canvas id="chartPaymentStatus"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Invoices</span>
        <span class="badge active">${issued.length} issued</span>
      </div>
      ${issued.length ? `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Invoice</th><th>Client</th><th>Date</th><th>Total</th><th>Received</th><th>Balance</th><th>Status</th></tr></thead>
          <tbody>
            ${issued.map((inv) => {
              const st = invDisplayStatus(inv);
              const bal = inv.status === 'paid' ? 0 : Math.max(0, invBalance(inv));
              return `<tr>
                <td><a href="#invoices/${encodeURIComponent(inv._sbId)}" class="rev-inv-link">${_esc(inv.invoiceNumber || '—')}</a></td>
                <td style="font-weight:600;color:var(--text-primary)">${_esc(inv.billToName || inv.brand || '')}</td>
                <td style="white-space:nowrap">${_esc(inv.status === 'paid' ? 'Paid ' + paidDay(inv) : inv.date || '')}</td>
                <td style="font-variant-numeric:tabular-nums">${_money(invTotal(inv))}</td>
                <td style="font-variant-numeric:tabular-nums;color:var(--green)">${_money(received(inv))}</td>
                <td style="font-variant-numeric:tabular-nums;color:${bal > 0 ? 'var(--accent)' : 'var(--text-muted)'}">${bal > 0 ? _money(bal) : '—'}</td>
                <td><span class="badge ${STATUS_BADGE[st] || ''}">${STATUS_LABEL[st] || _esc(st)}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : `
      <div class="dashboard-empty">
        <p>No invoices sent yet. Revenue fills in as you send invoices and mark them paid.</p>
        <a href="#invoices/new" class="btn btn-secondary btn-sm">New invoice</a>
      </div>`}
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Expense Tracking</span>
        <span class="badge" style="background:var(--purple-dim);color:var(--purple)">Coming Soon</span>
      </div>
      <div class="expense-placeholder">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
        <p style="color:var(--text-secondary);margin-top:12px">Track production costs, software subscriptions, and calculate net profit</p>
        <p style="color:var(--text-muted);font-size:12px;margin-top:4px">Automatically categorize expenses for tax-ready reporting</p>
      </div>
    </div>
  `;

  renderRevenueCharts(revenueByMonth(state.INVOICE_DATA, today, 12), money, quotes);
}

function renderRevenueCharts(months, money, quotes) {
  if (typeof Chart === 'undefined') return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? '#a8a29e' : '#5a5550';

  if (state.chartsRendered.monthlyRev) state.chartsRendered.monthlyRev.destroy();
  if (state.chartsRendered.payStatus) state.chartsRendered.payStatus.destroy();

  const ctx1 = document.getElementById('chartMonthlyRevenue');
  if (ctx1) {
    state.chartsRendered.monthlyRev = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: months.map((m) => m.label),
        datasets: [{
          label: 'Paid',
          data: months.map((m) => m.paid),
          backgroundColor: months.map((m) => (m.paid > 0 ? '#4f98a3' : 'rgba(79,152,163,0.2)')),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => _money(c.parsed.y) } } },
        scales: {
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: "'General Sans'", size: 11 }, callback: (v) => (v >= 1000 ? '$' + v / 1000 + 'K' : '$' + v) } },
          x: { grid: { display: false }, ticks: { color: textColor, font: { family: "'General Sans'", size: 11 } } },
        },
      },
    });
  }

  const ctx2 = document.getElementById('chartPaymentStatus');
  if (ctx2) {
    state.chartsRendered.payStatus = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Paid this year', 'Outstanding', 'Open quotes'],
        datasets: [{
          data: [money.paidYear, money.outstanding, quotes.openValue],
          backgroundColor: ['#5db87a', '#d4a853', 'rgba(79,152,163,0.4)'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'right', labels: { color: textColor, font: { family: "'General Sans'", size: 11 }, padding: 8, boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => c.label + ': ' + _money(c.parsed) } },
        },
      },
    });
  }
}

export { renderRevenue, renderRevenueCharts };
