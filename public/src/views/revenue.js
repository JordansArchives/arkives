// Arkives — Revenue tracker view.
import { state } from '../state.js';
import { _esc } from '../lib/esc.js';
import { formatCurrency, mapStatus, parseValue } from '../lib/format.js';


function renderRevenue() {
  const container = document.getElementById("view-revenue");
  const totalPaid = state.DEALS.reduce((s, d) => s + (d.paid || 0), 0);
  const totalOutstanding = state.DEALS.reduce((s, d) => s + (d.outstanding || 0), 0);
  const totalInvoiced = state.DEALS.reduce((s, d) => s + (d.invoiced || 0), 0);
  const projectedPipeline = state.DEALS.filter(d => !["Declined", "Completed", "Cold"].includes(mapStatus(d.status))).reduce((s, d) => s + parseValue(d.value), 0);
  const invoicedDeals = state.DEALS.filter(d => (d.invoiced || 0) > 0);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Revenue</h1>
        <p class="view-subtitle">Track earnings, invoices, and financial performance</p>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total Earned</span>
        <span class="kpi-value" style="color:var(--green)">${formatCurrency(totalPaid)}</span>
        <span class="kpi-delta up">Payments received</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Outstanding</span>
        <span class="kpi-value" style="color:var(--accent)">${formatCurrency(totalOutstanding)}</span>
        <span class="kpi-delta neutral">Awaiting payment</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Total Invoiced</span>
        <span class="kpi-value">${formatCurrency(totalInvoiced)}</span>
        <span class="kpi-delta neutral">All time</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Pipeline Value</span>
        <span class="kpi-value" style="color:var(--teal)">${formatCurrency(projectedPipeline)}</span>
        <span class="kpi-delta up">Active deals</span>
      </div>
    </div>

    <div class="chart-row">
      <div class="card">
        <div class="card-header"><span class="card-title">Monthly Revenue</span></div>
        <div class="chart-container"><canvas id="chartMonthlyRevenue"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Payment Status</span></div>
        <div class="chart-container"><canvas id="chartPaymentStatus"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Invoice Tracker</span>
        <span class="badge active">${invoicedDeals.length} invoiced</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Brand</th><th>Invoice Amount</th><th>Paid</th><th>Outstanding</th><th>Status</th><th>Contract</th></tr></thead>
          <tbody>
            ${invoicedDeals.map(d => {
              let payStatus = "Unpaid";
              let payClass = "followup";
              if ((d.paid || 0) >= (d.invoiced || 0) && (d.invoiced || 0) > 0) { payStatus = "Paid"; payClass = "active"; }
              else if ((d.paid || 0) > 0) { payStatus = "Partial"; payClass = "negotiating"; }
              return `<tr>
                <td style="font-weight:600;color:var(--text-primary)">${_esc(d.brand)}</td>
                <td style="font-variant-numeric:tabular-nums">${formatCurrency(d.invoiced || 0)}</td>
                <td style="font-variant-numeric:tabular-nums;color:var(--green)">${formatCurrency(d.paid || 0)}</td>
                <td style="font-variant-numeric:tabular-nums;color:${(d.outstanding || 0) > 0 ? "var(--accent)" : "var(--text-muted)"}">${formatCurrency(d.outstanding || 0)}</td>
                <td><span class="badge ${payClass}">${payStatus}</span></td>
                <td style="color:var(--text-secondary)">${_esc(d.contractStatus || "N/A")}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
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

  renderRevenueCharts(totalPaid, totalOutstanding, projectedPipeline - totalInvoiced);
}

function renderRevenueCharts(paid, outstanding, projected) {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const textColor = isDark ? "#a8a29e" : "#5a5550";

  if (state.chartsRendered.monthlyRev) state.chartsRendered.monthlyRev.destroy();
  if (state.chartsRendered.payStatus) state.chartsRendered.payStatus.destroy();

  const ctx1 = document.getElementById("chartMonthlyRevenue");
  if (ctx1) {
    state.chartsRendered.monthlyRev = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: state.MONTHLY_REVENUE.map(m => m.month),
        datasets: [{
          data: state.MONTHLY_REVENUE.map(m => m.earned),
          backgroundColor: state.MONTHLY_REVENUE.map(m => m.earned > 0 ? "#4f98a3" : "rgba(79,152,163,0.2)"),
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: "'General Sans'", size: 11 }, callback: function(v) { return "$" + (v / 1000) + "K"; } }
          },
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: "'General Sans'", size: 11 } }
          }
        }
      }
    });
  }

  const ctx2 = document.getElementById("chartPaymentStatus");
  if (ctx2) {
    state.chartsRendered.payStatus = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: ["Paid", "Outstanding", "Projected"],
        datasets: [{
          data: [paid, outstanding, Math.max(0, projected)],
          backgroundColor: ["#5db87a", "#d4a853", "rgba(79,152,163,0.4)"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: { position: "right", labels: { color: textColor, font: { family: "'General Sans'", size: 11 }, padding: 8, boxWidth: 12 } }
        }
      }
    });
  }
}

export { renderRevenue, renderRevenueCharts };
