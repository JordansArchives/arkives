// Arkives — Inbox view.
import { state } from '../state.js';
import { _args, act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';


function renderInbox() {
  const container = document.getElementById("view-inbox");
  const needsReply = state.INBOX_ITEMS.filter(i => i.status === "needs_reply").length;
  const needsAction = state.INBOX_ITEMS.filter(i => i.status === "needs_action").length;
  const priorityColors = { urgent: "var(--error)", high: "var(--accent)", medium: "var(--teal)", low: "var(--text-muted)" };
  const statusLabels = { needs_reply: "Reply Needed", needs_action: "Action Needed", waiting: "Waiting", drafted: "Draft Ready" };

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Inbox</h1>
        <p class="view-subtitle">Brand deal emails</p>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr)">
      <div class="kpi-card">
        <span class="kpi-label">Needs Reply</span>
        <span class="kpi-value" style="color:var(--error)">${needsReply}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Needs Action</span>
        <span class="kpi-value" style="color:var(--accent)">${needsAction}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Total</span>
        <span class="kpi-value">${state.INBOX_ITEMS.length}</span>
      </div>
    </div>

    ${state.INBOX_ITEMS.length === 0 ? `
    <div class="card">
      <div class="dashboard-empty">
        <p>No emails here yet. Inbox connects to your mailbox in a later release; until then, brand emails stay in your email client.</p>
      </div>
    </div>` : `
    <div class="inbox-layout">
      <div class="inbox-list-panel">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Email Queue</span>
            <span class="badge followup">${state.INBOX_ITEMS.length} items</span>
          </div>
          <div class="inbox-list">
            ${state.INBOX_ITEMS.map(item => `
                <div class="inbox-item priority-${_esc(item.priority)}" data-action="selectInboxItem" data-args="${_args(Number(item.id))}" id="inbox-item-${Number(item.id)}">
                  <div class="inbox-item-header">
                    <span class="inbox-brand">${_esc(item.brand)}</span>
                    <span class="inbox-time">${_esc(item.time)}</span>
                  </div>
                  <div class="inbox-subject">${_esc(item.subject)}</div>
                  <div class="inbox-snippet">${_esc(item.snippet)}</div>
                  <div class="inbox-item-footer">
                    <span class="inbox-status-badge" style="color:${priorityColors[item.priority] || 'var(--text-muted)'}">${_esc(statusLabels[item.status] || item.status)}</span>
                    <span class="inbox-contact">${_esc(item.contact)}</span>
                  </div>
                </div>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="inbox-detail-panel" id="inboxDetail">
        <div class="card">
          <div style="padding:40px;text-align:center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
            <p style="color:var(--text-secondary);margin-top:16px">Select an email to view details</p>
          </div>
        </div>
      </div>
    </div>`}
  `;
}

function selectInboxItem(id) {
  const item = state.INBOX_ITEMS.find(i => i.id === id);
  if (!item) return;

  document.querySelectorAll(".inbox-item").forEach(el => el.classList.remove("selected"));
  const el = document.getElementById("inbox-item-" + id);
  if (el) el.classList.add("selected");

  const detailDiv = document.getElementById("inboxDetail");
  if (!detailDiv) return;
  const mailto = /^[^\s@]+@[^\s@]+$/.test(item.email || '')
    ? 'mailto:' + encodeURIComponent(item.email) + '?subject=' + encodeURIComponent('Re: ' + (item.subject || ''))
    : '';
  detailDiv.innerHTML = `
    <div class="card inbox-detail-card">
      <div class="inbox-detail-header">
        <h3>${_esc(item.brand)}</h3>
        <span class="badge ${item.priority === "urgent" ? "followup" : item.priority === "high" ? "negotiating" : "active"}">${_esc(item.priority)}</span>
      </div>
      <div class="inbox-detail-meta">
        <div><strong>From:</strong> ${_esc(item.contact)} &lt;${_esc(item.email)}&gt;</div>
        <div><strong>Subject:</strong> ${_esc(item.subject)}</div>
        <div><strong>Received:</strong> ${_esc(item.time)}</div>
      </div>
      <div class="inbox-detail-context">
        <h4>Preview</h4>
        <p>${_esc(item.context)}</p>
      </div>
      ${mailto ? `<div class="inbox-detail-actions"><a class="btn btn-primary" href="${mailto}">Reply in your email app</a></div>` : ''}
    </div>
  `;
}

act({ selectInboxItem });

export { renderInbox, selectInboxItem };
