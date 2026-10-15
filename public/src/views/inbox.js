// Arkives — Inbox: a triage board for brand-deal emails. Mail arrives by
// Gmail forwarding to the user's deals-<token> address (worker/inbox.js);
// Arkives never reads the mailbox itself. Each email moves through
// New -> Needs reply -> Waiting -> Done; replies happen in Gmail.
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { _args, act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { _showSaveError } from '../lib/toast.js';
import { inboxAddress } from './connections.js';

const STATUS = [
  ['new', 'New'],
  ['needs_reply', 'Needs reply'],
  ['waiting', 'Waiting'],
  ['done', 'Done'],
];
const FILTERS = [['open', 'Open'], ...STATUS];
const LABEL = Object.fromEntries(STATUS);

function _when(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}

// Opens the original thread in Gmail by Message-ID (works for the account
// the mail was forwarded from)
function _gmailUrl(item) {
  return item.messageId ? 'https://mail.google.com/mail/u/0/#search/' + encodeURIComponent('rfc822msgid:' + item.messageId) : '';
}

function _mailto(item) {
  return /^[^\s@<>"]+@[^\s@<>"]+$/.test(item.fromEmail || '')
    ? 'mailto:' + encodeURIComponent(item.fromEmail) + '?subject=' + encodeURIComponent('Re: ' + (item.subject || ''))
    : '';
}

function _visible() {
  const f = state._inboxFilter;
  return state.INBOX_ITEMS.filter(i => f === 'open' ? i.status !== 'done' : i.status === f);
}

function _detail(item) {
  if (!item) {
    return `<div class="inbox-empty-detail"><p>Select an email to triage it.</p></div>`;
  }
  const gmail = _gmailUrl(item);
  const mailto = _mailto(item);
  return `
    <div class="inbox-detail-head">
      <div class="inbox-detail-brand">${_esc(item.brand || item.fromName)}</div>
      <h3 class="inbox-detail-subject">${_esc(item.subject)}</h3>
      <div class="inbox-detail-from">${_esc(item.fromName)}${item.fromEmail ? ` &lt;${_esc(item.fromEmail)}&gt;` : ''} · ${_esc(_when(item.receivedAt))}</div>
    </div>
    <div class="inbox-triage" role="group" aria-label="Status">
      ${STATUS.map(([k, label]) => `<button class="inbox-triage-btn ${item.status === k ? 'active' : ''}" data-action="setInboxStatus" data-args="${_args(item.id, k)}">${label}</button>`).join('')}
    </div>
    <div class="inbox-preview">${_esc(item.preview || '(No text)')}</div>
    <div class="inbox-detail-actions">
      ${gmail ? `<a class="btn btn-primary" href="${_esc(gmail)}" target="_blank" rel="noopener">Open in Gmail</a>` : ''}
      ${mailto ? `<a class="btn btn-secondary" href="${_esc(mailto)}">Reply</a>` : ''}
      <button class="btn btn-secondary btn-danger-text" data-action="deleteInboxItem" data-args="${_args(item.id)}">Delete</button>
    </div>`;
}

function renderInbox() {
  const container = document.getElementById('view-inbox');
  const count = (k) => state.INBOX_ITEMS.filter(i => k === 'open' ? i.status !== 'done' : i.status === k).length;
  const list = _visible();
  if (state._inboxSelected && !state.INBOX_ITEMS.some(i => i.id === state._inboxSelected)) state._inboxSelected = null;
  const selected = state.INBOX_ITEMS.find(i => i.id === state._inboxSelected) || null;
  const addr = inboxAddress();

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Inbox</h1>
        <p class="view-subtitle">Brand deal emails, forwarded from Gmail</p>
      </div>
    </div>

    <div class="inbox-filters" role="tablist">
      ${FILTERS.map(([k, label]) => `<button class="inbox-filter ${state._inboxFilter === k ? 'active' : ''}" role="tab" aria-selected="${state._inboxFilter === k}" data-action="setInboxFilter" data-args="${_args(k)}">${label}<span class="inbox-filter-count">${count(k)}</span></button>`).join('')}
    </div>

    ${state.INBOX_ITEMS.length === 0 ? `
    <div class="card">
      <div class="dashboard-empty">
        <p>No brand emails yet. Set up Gmail forwarding in <a href="#settings" data-action="openInboxSetup">Settings › Connections</a>${addr ? ` to <code>${_esc(addr)}</code>` : ''}, and new brand emails will land here.</p>
      </div>
    </div>` : `
    <div class="inbox-layout ${selected ? 'has-selection' : ''}">
      <div class="card inbox-list">
        ${list.length === 0 ? `<div class="dashboard-empty"><p>Nothing here.</p></div>` : list.map(item => `
          <button class="inbox-item ${item.id === state._inboxSelected ? 'selected' : ''} ${item.status === 'new' ? 'is-new' : ''}" data-action="selectInboxItem" data-args="${_args(item.id)}">
            <span class="inbox-item-header">
              <span class="inbox-brand">${_esc(item.brand || item.fromName)}</span>
              <span class="inbox-time">${_esc(_when(item.receivedAt))}</span>
            </span>
            <span class="inbox-subject">${_esc(item.subject)}</span>
            <span class="inbox-snippet">${_esc((item.preview || '').slice(0, 140))}</span>
            <span class="inbox-status-badge status-${_esc(item.status)}">${_esc(LABEL[item.status] || item.status)}</span>
          </button>
        `).join('')}
      </div>
      <div class="card inbox-detail" id="inboxDetail">
        ${selected ? `<button class="btn-link inbox-back" data-action="selectInboxItem" data-args="${_args(null)}">‹ Back</button>` : ''}
        ${_detail(selected)}
      </div>
    </div>`}
  `;
}

function selectInboxItem(id) {
  state._inboxSelected = id || null;
  renderInbox();
}

function setInboxFilter(f) {
  if (!FILTERS.some(([k]) => k === f)) return;
  state._inboxFilter = f;
  renderInbox();
}

async function setInboxStatus(id, status) {
  const item = state.INBOX_ITEMS.find(i => i.id === id);
  if (!item || !LABEL[status] || item.status === status) return;
  const prev = item.status;
  item.status = status; // optimistic
  renderInbox();
  if (!(await db.sbUpdateInboxStatus(id, status))) {
    item.status = prev;
    renderInbox();
    _showSaveError('Could not update the email. Try again.');
  }
}

async function deleteInboxItem(id) {
  if (!confirm('Remove this email from Arkives? It stays in Gmail.')) return;
  if (!(await db.sbDeleteInboxItem(id))) { _showSaveError('Could not delete. Try again.'); return; }
  state.INBOX_ITEMS = state.INBOX_ITEMS.filter(i => i.id !== id);
  if (state._inboxSelected === id) state._inboxSelected = null;
  renderInbox();
}

function openInboxSetup() {
  state._settingsTabNext = 'connections';
}

act({ deleteInboxItem, openInboxSetup, selectInboxItem, setInboxFilter, setInboxStatus });

export { deleteInboxItem, openInboxSetup, renderInbox, selectInboxItem, setInboxFilter, setInboxStatus };
