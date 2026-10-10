// Arkives — Quotes: list, editor, service menu, the client-facing quote
// page (#q/TOKEN), and the hand-offs to Invoices (deposit) and Contracts.
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { quotes } from '../stores/quotes.js';
import { clients, invoices } from '../stores/invoices.js';
import { _args, act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { _showSaveError, showToast } from '../lib/toast.js';
import { _localISODate } from './tasks.js';
import { fmtDocDate, fmtMoney, nextInvoiceNumber } from './invoices.js';


/* ---- CONSTANTS / HELPERS ---- */
const Q_UNITS = { flat: 'Flat fee', day: 'Per day', hour: 'Per hour', each: 'Each' };
const Q_BALANCE = {
  delivery: 'on delivery of the final deliverables',
  NET15: 'NET 15 from delivery of the final deliverables',
  NET30: 'NET 30 from delivery of the final deliverables'
};
const Q_VALID_DAYS = 30;
const Q_MIGRATION_MSG = 'Run migrations/026_quotes.sql in Supabase first';

function _qAddDays(iso, n) {
  const d = new Date((iso || _localISODate()) + 'T00:00:00');
  if (isNaN(d)) return '';
  d.setDate(d.getDate() + n);
  return _localISODate(d);
}

function qLineAmount(li) {
  const rate = Number(li.rate) || 0;
  return (li.unit || 'flat') === 'flat' ? rate : (Number(li.qty) || 0) * rate;
}
function qTotal(q) { return (q.lineItems || []).reduce((s, li) => s + qLineAmount(li), 0); }
function qDeposit(q) { return Math.round(qTotal(q) * (Number(q.depositPct) || 0)) / 100; }

// "Expired" and "Viewed" are derived, never stored
function qIsExpired(q) { return q.status === 'sent' && !!q.validUntil && q.validUntil < _localISODate(); }
function qDisplayStatus(q) {
  if (q.status !== 'sent') return q.status || 'draft';
  if (qIsExpired(q)) return 'expired';
  return q.viewedAt ? 'viewed' : 'sent';
}
const Q_STATUS_LABEL = { draft: 'Draft', sent: 'Sent', viewed: 'Viewed', accepted: 'Accepted', declined: 'Declined', expired: 'Expired' };

function qShareUrl(q) { return location.origin + location.pathname + '#q/' + q.shareToken; }

function nextQuoteNumber() {
  let max = 0;
  (state.QUOTES || []).forEach(q => {
    const m = String(q.quoteNumber || '').match(/^Q-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'Q-' + String(max + 1).padStart(4, '0');
}

// Plain text -> escaped paragraphs (blank line = new paragraph)
function _qText(s) {
  return String(s || '').trim().split(/\n{2,}/).filter(Boolean)
    .map(p => '<p>' + _esc(p).replace(/\n/g, '<br>') + '</p>').join('');
}

function _qLineSub(li) {
  const unit = li.unit || 'flat';
  const rate = Number(li.rate) || 0;
  if (unit === 'flat') return rate ? 'Flat fee' : 'Price to be confirmed';
  const qty = Number(li.qty) || 0;
  const word = unit === 'day' ? (qty === 1 ? 'day' : 'days') : unit === 'hour' ? (qty === 1 ? 'hr' : 'hrs') : '';
  return (word ? qty + ' ' + word : qty + ' ×') + (word ? ' × ' : ' ') + (rate ? fmtMoney(rate) : 'TBD');
}

/* ============================================================
   THE DOCUMENT
   Shared by the editor preview, the PDF and the client page.
   Built on the contract document's styles: numbered sections,
   accent numerals, a rule-topped closing block.
   ============================================================ */
function renderQuoteDoc(q, closing) {
  const total = qTotal(q);
  const dep = qDeposit(q);
  const pct = Number(q.depositPct) || 0;
  const items = (q.lineItems || []).filter(li => (li.desc || '').trim() || Number(li.rate));
  const clientOrg = q.clientCompany || q.clientName;
  const addr = s => String(s || '').split('\n').filter(Boolean).map(l => `<span>${_esc(l)}</span>`).join('');
  let n = 0;
  const section = (title, body) => body ? `
    <div class="contract-section">
      <h3 class="contract-section-heading"><span class="contract-section-num">${++n}.</span> ${title}</h3>
      <div class="contract-section-body">${body}</div>
    </div>` : '';

  const scopeBody = _qText(q.scope) + (q.timeline ? `<p><strong>Timeline:</strong> ${_esc(q.timeline)}</p>` : '');
  const rows = items.length ? items.map(li => `
        <div class="quote-row">
          <div class="quote-row-desc"><strong>${_esc(li.desc || 'Item')}</strong>${li.detail ? `<small>${_esc(li.detail)}</small>` : ''}</div>
          <div class="quote-row-calc">${_esc(_qLineSub(li))}</div>
          <div class="quote-row-amt">${qLineAmount(li) ? fmtMoney(qLineAmount(li)) : 'TBD'}</div>
        </div>`).join('') : '<div class="quote-row"><div class="quote-row-desc">No line items yet</div><div></div><div></div></div>';
  const investment = `
      <div class="quote-table">${rows}
        <div class="quote-row quote-total"><div>Total</div><div></div><div>${fmtMoney(total)}</div></div>
      </div>`;
  const payment = total ? (pct > 0
    ? `<p><strong>Deposit:</strong> ${pct}% (${fmtMoney(dep)}) is due on acceptance and books the project dates.${pct < 100 ? ` <strong>Balance:</strong> ${fmtMoney(total - dep)} is due ${Q_BALANCE[q.balanceTerms] || Q_BALANCE.delivery}.` : ''}</p>`
    : `<p>The full amount (${fmtMoney(total)}) is due ${Q_BALANCE[q.balanceTerms] || Q_BALANCE.delivery}.</p>`) : '';
  const rounds = Number(q.revisionRounds) || 0;
  const revisions = `<p>${rounds ? `Includes <strong>${rounds} round${rounds === 1 ? '' : 's'} of revisions</strong> per deliverable. A round is one consolidated set of notes on a cut. Further rounds are quoted separately.` : 'No revision rounds are included; any revisions are quoted separately.'}</p>` +
    (q.usageRights ? `<p><strong>Usage:</strong> ${_esc(q.usageRights).replace(/\n/g, '<br>')}</p>` : '');

  return `
  <div class="contract-document quote-doc">
    <div class="quote-doc-head">
      <div class="quote-doc-from">
        <strong>${_esc(q.fromName || '')}</strong>
        ${addr(q.fromAddress)}
        ${q.fromEmail ? `<span>${_esc(q.fromEmail)}</span>` : ''}
      </div>
      <div class="quote-doc-meta">
        <div><span>Quote</span><span>${_esc(q.quoteNumber || '—')}</span></div>
        <div><span>Date</span><span>${_esc(fmtDocDate(q.issueDate)) || '—'}</span></div>
        ${q.validUntil ? `<div><span>Valid until</span><span>${_esc(fmtDocDate(q.validUntil))}</span></div>` : ''}
      </div>
    </div>
    <h2 class="contract-doc-title">Project Quote</h2>
    ${q.title ? `<p class="quote-doc-title">${_esc(q.title)}</p>` : ''}
    <div class="contract-section-body quote-doc-for">
      <p>Prepared for <strong>${_esc(clientOrg || 'Client')}</strong>${q.clientCompany && q.clientName ? `, attention ${_esc(q.clientName)}` : ''}${q.clientEmail ? ` (${_esc(q.clientEmail)})` : ''}</p>
      ${q.clientAddress ? `<p class="quote-doc-addr">${addr(q.clientAddress)}</p>` : ''}
    </div>
    ${section('SCOPE &amp; DELIVERABLES', scopeBody)}
    ${section('INVESTMENT', investment)}
    ${section('PAYMENT', payment)}
    ${section('REVISIONS &amp; USAGE', revisions)}
    ${section('NOT INCLUDED', _qText(q.exclusions))}
    ${section('NOTES', _qText(q.notes))}
    ${closing || ''}
  </div>`;
}

// The closing block as it prints / previews (the live page swaps in the form)
function _qClosingStatic(q) {
  let line;
  if (q.status === 'accepted') line = `Accepted by <strong>${_esc(q.acceptedName)}</strong>${q.respondedAt ? ' on ' + _esc(fmtDocDate(String(q.respondedAt).slice(0, 10))) : ''}.`;
  else if (q.status === 'declined') line = `Declined${q.respondedAt ? ' on ' + _esc(fmtDocDate(String(q.respondedAt).slice(0, 10))) : ''}.`;
  else line = `To accept, open the quote link and confirm with your full name${q.validUntil ? ` by <strong>${_esc(fmtDocDate(q.validUntil))}</strong>` : ''}.`;
  return `<div class="contract-sig-block quote-closing"><p class="quote-closing-title">Acceptance</p><p>${line}</p></div>`;
}

/* ============================================================
   LIST VIEW
   ============================================================ */
// sub: '' = list, 'new' = new-quote editor, '<id>' = edit that quote
function renderQuotes(sub) {
  if (typeof sub === 'string') _qApplyRoute(sub);
  _qSyncBadge();
  if (state._qEditorOpen) { renderQuoteEditor(); return; }
  const container = document.getElementById('view-quotes');
  const Q = state.QUOTES;
  const open = Q.filter(q => q.status === 'sent' && !qIsExpired(q));
  const won = Q.filter(q => q.status === 'accepted');
  const lost = Q.filter(q => q.status === 'declined');
  const decided = won.length + lost.length;

  const setupCard = state._quotesMigrationMissing ? `
    <div class="tasks-setup-card" style="margin-bottom:20px">
      <h3>One-time setup needed</h3>
      <p>Quotes aren't in Supabase yet. Run <code>migrations/026_quotes.sql</code> in the Supabase SQL editor, then refresh this page.</p>
    </div>` : '';

  const linkQ = state._qLinkFor && quotes.find(state._qLinkFor);
  const linkBanner = linkQ && linkQ.status !== 'draft' ? `
    <div class="card quote-link-banner">
      <div>
        <strong>${_esc(linkQ.quoteNumber)} is live.</strong>
        <span>Send this link to ${_esc(linkQ.clientName || linkQ.clientCompany || 'your client')}. They can read it, download a PDF, and accept or decline.</span>
      </div>
      <div class="bd-share-linkrow">
        <input type="text" readonly value="${_esc(qShareUrl(linkQ))}">
        <button class="btn btn-primary" data-action="qCopyLink" data-args="${_args(linkQ._sbId)}">Copy</button>
        <button class="btn" data-action="qDismissLink" aria-label="Dismiss">Done</button>
      </div>
    </div>` : '';

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Quotes</h1>
        <p class="view-subtitle">Price the project, send the link, get the yes.</p>
      </div>
      <div class="gap-row">
        <button class="btn btn-primary" data-action="qNew">+ New Quote</button>
      </div>
    </div>

    ${setupCard}
    ${linkBanner}

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Open</span>
        <span class="kpi-value">${fmtMoney(open.reduce((s, q) => s + qTotal(q), 0))}</span>
        <span class="kpi-delta">${open.length} awaiting a reply</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Accepted</span>
        <span class="kpi-value">${fmtMoney(won.reduce((s, q) => s + qTotal(q), 0))}</span>
        <span class="kpi-delta up">${won.length} won</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Win rate</span>
        <span class="kpi-value">${decided ? Math.round(won.length / decided * 100) + '%' : '—'}</span>
        <span class="kpi-delta">${decided ? `${won.length} of ${decided} decided` : 'no replies yet'}</span>
      </div>
    </div>

    <div class="card">
      <div class="inv-list-controls">
        <div class="inv-chips">
          ${['all', 'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'].map(f => {
            const count = f === 'all' ? Q.length : Q.filter(q => qDisplayStatus(q) === f).length;
            return `<button class="inv-chip ${state._qFilter === f ? 'active' : ''}" data-action="qSetFilter" data-args="${_args(f)}">${f === 'all' ? 'All' : Q_STATUS_LABEL[f]} <em>${count}</em></button>`;
          }).join('')}
        </div>
        <input type="search" class="inv-search" placeholder="Search number, client or project" value="${_esc(state._qSearch)}" data-input="qSearchInput" data-input-args="[&quot;$value&quot;]">
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th style="white-space:nowrap">Quote #</th><th>Client</th><th>Project</th><th>Total</th><th style="white-space:nowrap">Valid until</th><th>Status</th><th></th></tr>
          </thead>
          <tbody id="qTbody">${_renderQuoteRows()}</tbody>
        </table>
      </div>
    </div>

    ${renderServiceMenuCard()}
  `;
  _qSyncRowMenu();
}

function _qApplyRoute(sub) {
  if (!sub) { state._qEditorOpen = false; state._qEditingId = null; state._q = null; state._qNewClientOpen = false; return; }
  if (sub === 'new') {
    // Duplicate sets up _q before changing the hash; keep it
    if (state._qEditorOpen && state._qEditingId === null && state._q) return;
    _qStartNew();
    return;
  }
  if (state._qEditorOpen && state._qEditingId === sub && state._q) return;
  if (!_qStartEdit(sub)) { state._qEditorOpen = false; state._q = null; }
}

function _qBlank() {
  const today = _localISODate();
  return {
    _sbId: null, clientId: null, invoiceId: null,
    quoteNumber: nextQuoteNumber(), title: '',
    clientName: '', clientCompany: '', clientEmail: '', clientAddress: '',
    scope: '', timeline: '', exclusions: '',
    lineItems: [{ desc: '', detail: '', unit: 'flat', qty: 1, rate: 0 }],
    depositPct: 50, balanceTerms: 'delivery', revisionRounds: 2, usageRights: '', notes: '',
    issueDate: today, validUntil: _qAddDays(today, Q_VALID_DAYS),
    status: 'draft', shareToken: '', viewedAt: '', respondedAt: '', acceptedName: '', declineReason: '', responseSeen: true
  };
}

function _qStartNew() {
  state._q = _qBlank();
  state._qEditingId = null; state._qEditorOpen = true; state._qNewClientOpen = false;
}

function _qStartEdit(sbId) {
  const src = quotes.find(sbId);
  if (!src) return false;
  state._q = JSON.parse(JSON.stringify(src));
  if (!state._q.lineItems.length) state._q.lineItems = [{ desc: '', detail: '', unit: 'flat', qty: 1, rate: 0 }];
  state._qEditingId = sbId; state._qEditorOpen = true; state._qNewClientOpen = false;
  // Opening a fresh client response clears it from the badge
  if (!src.responseSeen) quotes.patch(sbId, { response_seen: true }, true).then(_qSyncBadge);
  return true;
}

function _qFilteredRows() {
  let rows = state.QUOTES;
  if (state._qFilter !== 'all') rows = rows.filter(q => qDisplayStatus(q) === state._qFilter);
  const s = state._qSearch.trim().toLowerCase();
  if (s) rows = rows.filter(q => [q.quoteNumber, q.clientName, q.clientCompany, q.title].some(v => String(v || '').toLowerCase().includes(s)));
  return rows;
}

// The row's actions, as [kind, label] pairs (inline buttons and the phone sheet share them)
function _qRowActions(q) {
  const out = [];
  if (q.status !== 'draft') out.push(['link', 'Copy link']);
  if (q.status === 'accepted') {
    const inv = q.invoiceId && invoices.find(q.invoiceId);
    out.push(inv ? ['invoice', 'View invoice'] : ['invoice', 'Deposit invoice']);
    out.push(['contract', 'Contract']);
  }
  out.push(['duplicate', 'Duplicate'], ['pdf', 'PDF'], ['delete', 'Delete']);
  return out;
}

function _renderQuoteRows() {
  const rows = _qFilteredRows();
  if (!rows.length) {
    const msg = state.QUOTES.length ? 'No quotes match this filter.' : 'No quotes yet. Click "+ New Quote" to price your first project.';
    return `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">${msg}</td></tr>`;
  }
  return rows.map(q => {
    const st = qDisplayStatus(q);
    return `
      <tr class="inv-row" data-action="qOpen" data-args="${_args(q._sbId)}">
        <td style="font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap">${_esc(q.quoteNumber)}</td>
        <td>${_esc(q.clientCompany || q.clientName || '—')}</td>
        <td>${_esc(q.title || '—')}</td>
        <td style="font-variant-numeric:tabular-nums">${fmtMoney(qTotal(q))}</td>
        <td style="white-space:nowrap">${_esc(q.validUntil || '—')}</td>
        <td><span class="invoice-status quote-status-${st}">${Q_STATUS_LABEL[st]}</span>${q.responseSeen ? '' : ' <span class="quote-new">New</span>'}</td>
        <td class="inv-row-actions" data-action="stop" data-args="[&quot;$event&quot;]">
          <span class="inv-row-inline">
            ${_qRowActions(q).slice(0, 2).map(([k, label]) => `<button class="btn btn-sm" data-action="qRowAction" data-args="${_args(k, q._sbId)}">${label}</button>`).join('')}
          </span>
          <button class="btn btn-sm quote-row-more" data-action="qOpenRowMenu" data-args="${_args(q._sbId)}" aria-label="More actions" title="More actions">&#8943;</button>
        </td>
      </tr>`;
  }).join('');
}

function qSetFilter(f) { state._qFilter = f; renderQuotes(); }
// Only the tbody re-renders on search so the field keeps focus
function qSearchInput(v) {
  state._qSearch = v;
  const tb = document.getElementById('qTbody');
  if (tb) tb.innerHTML = _renderQuoteRows();
}

/* ---- ROW ACTIONS SHEET (phone), mounted on <body> like the invoices one ---- */
function qOpenRowMenu(id) { state._qRowMenuId = id; _qSyncRowMenu(); }
function qCloseRowMenu() { state._qRowMenuId = null; _qSyncRowMenu(); }
function qCloseRowMenuBackdrop(ev, el) { if (ev.target === el) qCloseRowMenu(); }
function _qSyncRowMenu() {
  let host = document.getElementById('qSheetHost');
  if (!host) {
    if (!state._qRowMenuId) return;
    host = document.createElement('div');
    host.id = 'qSheetHost';
    document.body.appendChild(host);
  }
  const q = state._qRowMenuId && quotes.find(state._qRowMenuId);
  if (!q) { host.innerHTML = ''; return; }
  host.innerHTML = `
    <div class="inv-sheet-overlay quote-sheet-overlay" data-action="qCloseRowMenuBackdrop" data-args="[&quot;$event&quot;,&quot;$el&quot;]">
      <div class="inv-sheet" role="dialog" aria-modal="true" aria-label="Quote actions">
        <div class="inv-sheet-title">${_esc(q.quoteNumber)} · ${_esc(q.clientCompany || q.clientName)}</div>
        <button class="inv-sheet-btn" data-action="qRowAction" data-args="${_args('open', q._sbId)}">Open</button>
        ${_qRowActions(q).map(([k, label]) => `<button class="inv-sheet-btn${k === 'delete' ? ' inv-sheet-danger' : ''}" data-action="qRowAction" data-args="${_args(k, q._sbId)}">${label}</button>`).join('')}
        <button class="inv-sheet-btn inv-sheet-cancel" data-action="qCloseRowMenu">Cancel</button>
      </div>
    </div>`;
}
function unmountQuotes() { qCloseRowMenu(); }

function qRowAction(kind, id) {
  qCloseRowMenu();
  const q = quotes.find(id);
  if (!q) return;
  if (kind === 'open') qOpen(id);
  else if (kind === 'link') qCopyLink(id);
  else if (kind === 'invoice') qDepositInvoice(id);
  else if (kind === 'contract') qToContract(id);
  else if (kind === 'duplicate') qDuplicate(id);
  else if (kind === 'pdf') qPrintDoc(q);
  else if (kind === 'delete') qDeleteQuote(id);
}

function qCopyLink(id) {
  const q = quotes.find(id);
  if (!q || q.status === 'draft') return;
  const url = qShareUrl(q);
  navigator.clipboard.writeText(url).then(() => showToast('Quote link copied'), () => {
    state._qLinkFor = id; renderQuotes();
  });
}
function qDismissLink() { state._qLinkFor = null; renderQuotes(); }

async function qDeleteQuote(id) {
  const q = quotes.find(id);
  if (!q) return;
  const live = q.status === 'sent' ? ' The client link stops working.' : '';
  if (!confirm('Delete quote ' + q.quoteNumber + '?' + live + ' This can\'t be undone.')) return;
  if (await quotes.remove(id)) {
    if (state._qLinkFor === id) state._qLinkFor = null;
    if (state._qEditingId === id) qBack(); else renderQuotes();
  }
}

/* ---- SERVICE MENU (card on the list view) ---- */
function renderServiceMenuCard() {
  const editing = state._qServiceEditingId;
  const svc = editing && editing !== '__new' ? quotes.findService(editing) : null;
  const form = editing ? `
    <div class="inv-client-form">
      <div class="form-row">
        <div class="form-group"><label>Service</label><input type="text" id="qsName" value="${_esc(svc ? svc.name : '')}" placeholder="Editing day"></div>
        <div class="form-group">
          <label>Priced</label>
          <select id="qsUnit">${Object.keys(Q_UNITS).map(u => `<option value="${u}" ${(svc ? svc.unit : 'flat') === u ? 'selected' : ''}>${Q_UNITS[u]}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Rate ($)</label><input type="number" id="qsRate" step="0.01" min="0" value="${svc && svc.rate != null ? svc.rate : ''}" placeholder="leave blank to price per quote"></div>
        <div class="form-group"><label>Description</label><input type="text" id="qsDesc" value="${_esc(svc ? svc.description : '')}" placeholder="Shows under the line on the quote"></div>
      </div>
      <div class="gap-row">
        <button class="btn btn-primary" data-action="qSaveService">${svc ? 'Save Service' : 'Add Service'}</button>
        <button class="btn" data-action="qCancelService">Cancel</button>
      </div>
    </div>` : '';
  const S = state.QUOTE_SERVICES;
  return `
    <div class="card" style="margin-top:20px">
      <div class="inv-clients-head">
        <div>
          <h3 style="margin:0;font-family:var(--font-display);font-size:1.1rem">Service menu</h3>
          <p style="margin:2px 0 0;color:var(--text-muted);font-size:0.85rem">Your services and rates. Pick from these in the editor, then adjust per quote.</p>
        </div>
        ${editing ? '' : `<button class="btn btn-sm" data-action="qEditService" data-args="${_args('__new')}">+ Add Service</button>`}
      </div>
      ${form}
      ${S.length ? `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Service</th><th>Priced</th><th>Rate</th><th>Description</th><th></th></tr></thead>
          <tbody>
            ${S.map(s => `
              <tr>
                <td style="font-weight:600">${_esc(s.name)}</td>
                <td>${Q_UNITS[s.unit] || s.unit}</td>
                <td style="font-variant-numeric:tabular-nums">${s.rate != null ? fmtMoney(s.rate) : '<span class="quote-unpriced">Set a rate</span>'}</td>
                <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted)">${_esc(s.description || '—')}</td>
                <td class="inv-row-actions">
                  <button class="btn btn-sm" data-action="qEditService" data-args="${_args(s._sbId)}">Edit</button>
                  <button class="btn btn-sm" data-action="qDeleteService" data-args="${_args(s._sbId)}">Delete</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : (editing ? '' : '<p style="color:var(--text-muted);padding:16px 20px;margin:0;font-size:0.85rem">No services yet. Add the work you sell: edit days, director days, cuts, crew pass-throughs.</p>')}
    </div>`;
}

function qEditService(id) {
  if (state._quotesMigrationMissing) { _showSaveError(Q_MIGRATION_MSG); return; }
  state._qServiceEditingId = id; renderQuotes();
}
function qCancelService() { state._qServiceEditingId = null; renderQuotes(); }
async function qSaveService() {
  const name = document.getElementById('qsName').value.trim();
  if (!name) { _showSaveError('Service needs a name'); return; }
  const rateRaw = document.getElementById('qsRate').value.trim();
  const data = {
    name,
    unit: document.getElementById('qsUnit').value,
    rate: rateRaw === '' ? null : Math.max(0, parseFloat(rateRaw) || 0),
    description: document.getElementById('qsDesc').value.trim()
  };
  const ok = state._qServiceEditingId === '__new' ? await quotes.addService(data) : await quotes.updateService(state._qServiceEditingId, data);
  if (!ok) return;
  state._qServiceEditingId = null;
  renderQuotes();
}
async function qDeleteService(id) {
  const s = quotes.findService(id);
  if (!s || !confirm('Remove "' + s.name + '" from the menu? Quotes that already use it keep their lines.')) return;
  if (await quotes.removeService(id)) renderQuotes();
}

/* ============================================================
   EDITOR (#quotes/new, #quotes/{id})
   ============================================================ */
function qNew() {
  if (state._quotesMigrationMissing) { _showSaveError(Q_MIGRATION_MSG); return; }
  _qStartNew();
  if (location.hash !== '#quotes/new') location.hash = 'quotes/new';
  else renderQuoteEditor();
}
function qOpen(id) {
  if (!_qStartEdit(id)) return;
  if (location.hash !== '#quotes/' + id) location.hash = 'quotes/' + id;
  else renderQuoteEditor();
}
function qBack() {
  state._qEditorOpen = false; state._qEditingId = null; state._q = null;
  if (location.hash !== '#quotes') location.hash = 'quotes';
  else renderQuotes();
}

// Responded quotes are a record of what the client agreed to: read-only
function _qLocked(q) { return q.status === 'accepted' || q.status === 'declined'; }

function renderQuoteEditor() {
  const container = document.getElementById('view-quotes');
  const q = state._q;
  const locked = _qLocked(q);
  const dis = locked ? 'disabled' : '';
  const st = qDisplayStatus(q);

  const clientOptions = [
    `<option value="">— Select a client —</option>`,
    ...state.CLIENTS.map(c => `<option value="${_esc(c._sbId)}" ${q.clientId === c._sbId ? 'selected' : ''}>${_esc(c.name)}${c.company ? ' · ' + _esc(c.company) : ''}</option>`),
    `<option value="__new">+ New client…</option>`
  ].join('');
  const newClientForm = state._qNewClientOpen ? `
    <div class="inv-client-form">
      <div class="form-group"><label>Contact Name</label><input type="text" id="qNcName" placeholder="Jane Smith"></div>
      <div class="form-group"><label>Company</label><input type="text" id="qNcCompany" placeholder="Acme Media LLC"></div>
      <div class="form-group"><label>Email</label><input type="email" id="qNcEmail" placeholder="jane@acme.com"></div>
      <div class="form-group"><label>Billing Address</label><textarea id="qNcAddress" rows="3" placeholder="Company&#10;Street&#10;City, ST ZIP"></textarea></div>
      <div class="gap-row">
        <button class="btn btn-primary btn-sm" data-action="qSaveNewClient">Save Client</button>
        <button class="btn btn-sm" data-action="qCancelNewClient">Cancel</button>
      </div>
    </div>` : '';

  const services = state.QUOTE_SERVICES;
  const menuSelect = services.length ? `
    <select class="quote-menu-pick" data-change="qAddService" data-change-args="[&quot;$value&quot;]" ${dis}>
      <option value="">+ Add from service menu…</option>
      ${services.map(s => `<option value="${_esc(s._sbId)}">${_esc(s.name)}${s.rate != null ? ' · ' + fmtMoney(s.rate) + (s.unit === 'day' ? '/day' : s.unit === 'hour' ? '/hr' : '') : ' · no rate yet'}</option>`).join('')}
    </select>` : '<p class="inv-help">Add services to the menu on the Quotes page and they show up here.</p>';

  let banner = '';
  if (q.status === 'accepted') banner = `<div class="quote-banner quote-banner-ok"><strong>Accepted by ${_esc(q.acceptedName)}</strong>${q.respondedAt ? ' on ' + _esc(fmtDocDate(String(q.respondedAt).slice(0, 10))) : ''}. The quote is locked as agreed; duplicate it to revise.</div>`;
  else if (q.status === 'declined') banner = `<div class="quote-banner quote-banner-no"><strong>Declined</strong>${q.respondedAt ? ' on ' + _esc(fmtDocDate(String(q.respondedAt).slice(0, 10))) : ''}${q.declineReason ? `: "${_esc(q.declineReason)}"` : '.'} Duplicate it to send a revised quote.</div>`;
  else if (q.status === 'sent') banner = `
    <div class="quote-banner">
      <div><strong>${st === 'expired' ? 'Expired' : st === 'viewed' ? 'Sent and viewed' : 'Sent'}.</strong> Edits you save show on the client's link right away.${st === 'expired' ? ' Move the valid-until date forward and save to reopen it.' : ''}</div>
      <div class="bd-share-linkrow">
        <input type="text" readonly value="${_esc(qShareUrl(q))}">
        <button class="btn btn-primary" data-action="qCopyLink" data-args="${_args(q._sbId)}">Copy</button>
        <button class="btn" data-action="qUnsend">Back to draft</button>
      </div>
    </div>`;

  const actions = locked ? `
        <button class="btn" data-action="qDownloadPDF">Download PDF</button>
        ${q.status === 'accepted' ? `<button class="btn" data-action="qToContract" data-args="${_args(q._sbId)}">Contract</button>
        <button class="btn btn-primary" data-action="qDepositInvoice" data-args="${_args(q._sbId)}">${q.invoiceId && invoices.find(q.invoiceId) ? 'View invoice' : 'Deposit invoice'}</button>` : ''}
        <button class="btn" data-action="qDuplicate" data-args="${_args(q._sbId)}">Duplicate</button>` : `
        <button class="btn" data-action="qDownloadPDF">Download PDF</button>
        <button class="btn" data-action="qSaveDraft">${q.status === 'sent' ? 'Save' : 'Save Draft'}</button>
        ${q.status === 'draft' ? '<button class="btn btn-primary" data-action="qSend">Send to client</button>' : ''}`;

  container.innerHTML = `
    <div class="view-header">
      <div>
        <button class="btn btn-sm" data-action="qBack" style="margin-bottom:8px">← Quotes</button>
        <h1 class="view-title">${state._qEditingId ? _esc(q.quoteNumber) : 'New Quote'} <span class="invoice-status quote-status-${st}" style="vertical-align:middle">${Q_STATUS_LABEL[st]}</span></h1>
      </div>
      <div class="gap-row">${actions}</div>
    </div>
    ${banner}

    <div class="inv-editor">
      <div class="inv-form-panel">
        <fieldset class="quote-fieldset" ${dis}>
        <div class="inv-section-label">Client</div>
        <div class="form-group">
          <label>Client</label>
          <select data-change="qPickClient" data-change-args="[&quot;$value&quot;]">${clientOptions}</select>
        </div>
        ${newClientForm}
        <div class="form-row">
          <div class="form-group"><label>Contact Name</label><input type="text" value="${_esc(q.clientName)}" placeholder="Jane Smith" data-input="qField" data-input-args="[&quot;clientName&quot;,&quot;$value&quot;]"></div>
          <div class="form-group"><label>Company</label><input type="text" value="${_esc(q.clientCompany)}" placeholder="Acme Media" data-input="qField" data-input-args="[&quot;clientCompany&quot;,&quot;$value&quot;]"></div>
        </div>
        <div class="form-group"><label>Email</label><input type="email" value="${_esc(q.clientEmail)}" placeholder="jane@acme.com" data-input="qField" data-input-args="[&quot;clientEmail&quot;,&quot;$value&quot;]"></div>
        <div class="form-group"><label>Address</label><textarea rows="2" placeholder="Street&#10;City, ST ZIP" data-input="qField" data-input-args="[&quot;clientAddress&quot;,&quot;$value&quot;]">${_esc(q.clientAddress)}</textarea></div>
        <p class="inv-help">Picking a client fills these. Editing here never changes the saved client.</p>

        <div class="inv-section-label">Project</div>
        <div class="form-row">
          <div class="form-group" style="max-width:130px"><label>Quote #</label><input type="text" value="${_esc(q.quoteNumber)}" data-input="qField" data-input-args="[&quot;quoteNumber&quot;,&quot;$value&quot;]"></div>
          <div class="form-group"><label>Project Title</label><input type="text" value="${_esc(q.title)}" placeholder="Spring campaign hero film" data-input="qField" data-input-args="[&quot;title&quot;,&quot;$value&quot;]"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Date</label><input type="date" value="${_esc(q.issueDate)}" data-change="qField" data-change-args="[&quot;issueDate&quot;,&quot;$value&quot;]"></div>
          <div class="form-group"><label>Valid Until</label><input type="date" value="${_esc(q.validUntil)}" data-change="qField" data-change-args="[&quot;validUntil&quot;,&quot;$value&quot;]"></div>
        </div>

        <div class="inv-section-label">Scope</div>
        <div class="form-group"><label>Scope &amp; Deliverables</label><textarea rows="6" placeholder="What you'll make, how many, which formats.&#10;&#10;e.g. One 60s hero film plus eight 15-30s vertical cuts for Reels and TikTok, color-graded and captioned." data-input="qField" data-input-args="[&quot;scope&quot;,&quot;$value&quot;]">${_esc(q.scope)}</textarea></div>
        <div class="form-group"><label>Timeline</label><input type="text" value="${_esc(q.timeline)}" placeholder="2-day shoot in May, first cuts within 10 business days" data-input="qField" data-input-args="[&quot;timeline&quot;,&quot;$value&quot;]"></div>
        <div class="form-group"><label>Not Included</label><textarea rows="3" placeholder="Talent fees, travel, licensed music, paid media spend" data-input="qField" data-input-args="[&quot;exclusions&quot;,&quot;$value&quot;]">${_esc(q.exclusions)}</textarea></div>

        <div class="inv-section-label">Line Items</div>
        <div id="qLineItems">${_renderQuoteLines()}</div>
        <div class="gap-row quote-line-adds">
          ${menuSelect}
          <button class="btn" data-action="qAddLine" ${dis}>+ Custom line</button>
        </div>
        <div class="quote-editor-total">Total <strong id="qEdTotal">${fmtMoney(qTotal(q))}</strong></div>

        <div class="inv-section-label">Terms</div>
        <div class="form-row">
          <div class="form-group"><label>Deposit (%)</label><input type="number" min="0" max="100" step="5" value="${q.depositPct}" data-input="qField" data-input-args="[&quot;depositPct&quot;,&quot;$value&quot;]"></div>
          <div class="form-group">
            <label>Balance Due</label>
            <select data-change="qField" data-change-args="[&quot;balanceTerms&quot;,&quot;$value&quot;]">
              <option value="delivery" ${q.balanceTerms === 'delivery' ? 'selected' : ''}>On delivery</option>
              <option value="NET15" ${q.balanceTerms === 'NET15' ? 'selected' : ''}>NET 15 from delivery</option>
              <option value="NET30" ${q.balanceTerms === 'NET30' ? 'selected' : ''}>NET 30 from delivery</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="max-width:160px"><label>Revision Rounds</label><input type="number" min="0" max="20" value="${q.revisionRounds}" data-input="qField" data-input-args="[&quot;revisionRounds&quot;,&quot;$value&quot;]"></div>
        <div class="form-group"><label>Usage Rights</label><textarea rows="2" placeholder="e.g. Client owns the final deliverables on full payment; 6 months paid usage included" data-input="qField" data-input-args="[&quot;usageRights&quot;,&quot;$value&quot;]">${_esc(q.usageRights)}</textarea></div>

        <div class="inv-section-label">Notes</div>
        <div class="form-group"><textarea rows="3" placeholder="Optional note to the client" data-input="qField" data-input-args="[&quot;notes&quot;,&quot;$value&quot;]">${_esc(q.notes)}</textarea></div>
        </fieldset>

        ${state._qEditingId ? `<button class="btn inv-delete-btn" data-action="qDeleteQuote" data-args="${_args(state._qEditingId)}">Delete Quote</button>` : ''}
      </div>

      <div class="inv-preview-pane">
        <div id="qDocPreview">${renderQuoteDoc(_qPreviewModel(q), _qClosingStatic(q))}</div>
      </div>
    </div>`;
}

// The preview reads "from" the profile until the quote is saved (then the snapshot)
function _qPreviewModel(q) {
  if (_qLocked(q)) return q;
  const c = state.CREATOR || {};
  return { ...q, fromName: c.entity || c.brand || c.name || '', fromEmail: c.email || '', fromAddress: c.businessAddress || '' };
}

function _renderQuoteLines() {
  const q = state._q;
  return q.lineItems.map((li, i) => {
    const unit = li.unit || 'flat';
    const unpriced = !(Number(li.rate) > 0) && (li.desc || '').trim();
    return `
    <div class="inv-li${unpriced ? ' quote-li-unpriced' : ''}">
      <div class="inv-li-top">
        <select class="quote-li-unit" data-change="qLiField" data-change-args="${_args(i, 'unit', '$value')}">
          ${Object.keys(Q_UNITS).map(u => `<option value="${u}" ${unit === u ? 'selected' : ''}>${Q_UNITS[u]}</option>`).join('')}
        </select>
        ${q.lineItems.length > 1 ? `<button class="inv-li-remove" data-action="qRemoveLine" data-args="${_args(i)}" title="Remove">×</button>` : ''}
      </div>
      <div class="form-group"><input type="text" placeholder="Description" value="${_esc(li.desc)}" data-input="qLiField" data-input-args="${_args(i, 'desc', '$value')}"></div>
      <div class="form-group"><input type="text" placeholder="Detail (optional)" value="${_esc(li.detail)}" data-input="qLiField" data-input-args="${_args(i, 'detail', '$value')}"></div>
      ${unit === 'flat' ? `
      <div class="form-group"><label>Price</label><input type="number" step="0.01" min="0" value="${li.rate || ''}" placeholder="0.00" data-input="qLiField" data-input-args="${_args(i, 'rate', '$value')}"></div>` : `
      <div class="form-row">
        <div class="form-group"><label>${unit === 'day' ? 'Days' : unit === 'hour' ? 'Hours' : 'Qty'}</label><input type="number" step="${unit === 'each' ? '1' : '0.5'}" min="0" value="${li.qty || ''}" placeholder="0" data-input="qLiField" data-input-args="${_args(i, 'qty', '$value')}"></div>
        <div class="form-group"><label>${unit === 'day' ? 'Rate / day' : unit === 'hour' ? 'Rate / hr' : 'Price each'}</label><input type="number" step="0.01" min="0" value="${li.rate || ''}" placeholder="0.00" data-input="qLiField" data-input-args="${_args(i, 'rate', '$value')}"></div>
      </div>`}
      <div class="inv-li-amount">${unpriced ? '<span class="quote-unpriced">No price yet</span> ' : ''}= <span id="qLiAmt-${i}">${fmtMoney(qLineAmount(li))}</span></div>
    </div>`;
  }).join('');
}

/* ---- EDITOR FIELD HANDLERS ---- */
function qField(key, val) {
  if (!state._q || _qLocked(state._q)) return;
  if (key === 'depositPct') val = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
  if (key === 'revisionRounds') val = Math.min(20, Math.max(0, parseInt(val, 10) || 0));
  state._q[key] = val;
  _qUpdatePreview();
}

function qLiField(i, key, val) {
  const li = state._q && state._q.lineItems[i];
  if (!li || _qLocked(state._q)) return;
  if (key === 'qty' || key === 'rate') val = Math.max(0, parseFloat(val) || 0);
  li[key] = val;
  if (key === 'unit') {
    if (val !== 'flat' && !(Number(li.qty) > 0)) li.qty = 1;
    document.getElementById('qLineItems').innerHTML = _renderQuoteLines();
  } else {
    const amt = document.getElementById('qLiAmt-' + i);
    if (amt) amt.textContent = fmtMoney(qLineAmount(li));
  }
  _qUpdatePreview();
}

function _qAppendLine(line) {
  const lines = state._q.lineItems;
  // Replace the untouched starter line instead of stacking under it
  if (lines.length === 1 && !(lines[0].desc || '').trim() && !Number(lines[0].rate)) lines.pop();
  lines.push(line);
  document.getElementById('qLineItems').innerHTML = _renderQuoteLines();
  _qUpdatePreview();
}
function qAddLine() { if (!_qLocked(state._q)) _qAppendLine({ desc: '', detail: '', unit: 'flat', qty: 1, rate: 0 }); }
function qAddService(id) {
  const s = id && quotes.findService(id);
  if (!s || _qLocked(state._q)) return;
  _qAppendLine({ desc: s.name, detail: s.description || '', unit: s.unit, qty: 1, rate: s.rate || 0 });
  const sel = document.querySelector('#view-quotes .quote-menu-pick');
  if (sel) sel.value = '';
  if (s.rate == null) showToast('"' + s.name + '" has no rate yet. Set the price on the line.');
}
function qRemoveLine(i) {
  if (_qLocked(state._q)) return;
  state._q.lineItems.splice(i, 1);
  document.getElementById('qLineItems').innerHTML = _renderQuoteLines();
  _qUpdatePreview();
}

function _qUpdatePreview() {
  const el = document.getElementById('qDocPreview');
  if (el && state._q) el.innerHTML = renderQuoteDoc(_qPreviewModel(state._q), _qClosingStatic(state._q));
  const t = document.getElementById('qEdTotal');
  if (t && state._q) t.textContent = fmtMoney(qTotal(state._q));
}

/* ---- CLIENT PICKING ---- */
function qPickClient(val) {
  if (val === '__new') { state._qNewClientOpen = true; renderQuoteEditor(); return; }
  state._qNewClientOpen = false;
  if (!val) { state._q.clientId = null; renderQuoteEditor(); return; }
  const c = clients.find(val);
  if (!c) return;
  Object.assign(state._q, { clientId: c._sbId, clientName: c.name || '', clientCompany: c.company || '', clientEmail: c.email || '', clientAddress: c.billingAddress || '' });
  renderQuoteEditor();
}
function qCancelNewClient() { state._qNewClientOpen = false; renderQuoteEditor(); }
async function qSaveNewClient() {
  const name = document.getElementById('qNcName').value.trim();
  if (!name) { _showSaveError('Client needs a name'); return; }
  const client = await clients.add({
    name,
    company: document.getElementById('qNcCompany').value.trim(),
    email: document.getElementById('qNcEmail').value.trim(),
    invoicePrefix: '',
    billingAddress: document.getElementById('qNcAddress').value.trim()
  });
  if (!client) return;
  state._qNewClientOpen = false;
  qPickClient(client._sbId);
}

/* ---- SAVE / SEND ---- */
function _qPayload(q) {
  const c = state.CREATOR || {};
  const lines = q.lineItems
    .filter(li => (li.desc || '').trim() || Number(li.rate))
    .map(li => {
      const unit = Q_UNITS[li.unit] ? li.unit : 'flat';
      return { desc: String(li.desc || '').trim(), detail: String(li.detail || '').trim(), unit, qty: unit === 'flat' ? 1 : (Number(li.qty) || 0), rate: Number(li.rate) || 0 };
    });
  return {
    client_id: q.clientId || null,
    quote_number: String(q.quoteNumber || '').trim(),
    title: String(q.title || '').trim(),
    client_name: String(q.clientName || '').trim(),
    client_company: String(q.clientCompany || '').trim(),
    client_email: String(q.clientEmail || '').trim(),
    client_address: String(q.clientAddress || '').trim(),
    from_name: c.entity || c.brand || c.name || '',
    from_email: c.email || '',
    from_address: c.businessAddress || '',
    scope: q.scope || '',
    timeline: String(q.timeline || '').trim(),
    exclusions: q.exclusions || '',
    line_items: lines,
    total: lines.reduce((s, li) => s + qLineAmount(li), 0),
    deposit_pct: Number(q.depositPct) || 0,
    balance_terms: Q_BALANCE[q.balanceTerms] ? q.balanceTerms : 'delivery',
    revision_rounds: Number(q.revisionRounds) || 0,
    usage_rights: q.usageRights || '',
    notes: q.notes || '',
    issue_date: q.issueDate || _localISODate(),
    valid_until: q.validUntil || null
  };
}

async function _qWrite(extra) {
  const q = state._q;
  if (!String(q.quoteNumber || '').trim()) { _showSaveError('Quote needs a number'); return null; }
  if (!(q.clientName || q.clientCompany).trim()) { _showSaveError('Quote needs a client'); return null; }
  return quotes.save({ ..._qPayload(q), ...extra }, state._qEditingId);
}

async function qSaveDraft() {
  if (state._quotesMigrationMissing) { _showSaveError(Q_MIGRATION_MSG); return; }
  if (_qLocked(state._q)) return;
  if (state._q.status === 'sent' && state._q.validUntil && state._q.validUntil < _localISODate() && !confirm('The valid-until date has passed, so the client can no longer accept. Save anyway?')) return;
  const saved = await _qWrite({});
  if (saved) qBack();
}

async function qSend() {
  if (state._quotesMigrationMissing) { _showSaveError(Q_MIGRATION_MSG); return; }
  const q = state._q;
  if (!q || q.status !== 'draft') return;
  if (!String(q.title || '').trim()) { _showSaveError('Give the project a title'); return; }
  if (!(qTotal(q) > 0)) { _showSaveError('Add at least one priced line'); return; }
  if (q.validUntil && q.validUntil < _localISODate()) { _showSaveError('Valid-until is in the past'); return; }
  const unpriced = q.lineItems.filter(li => (li.desc || '').trim() && !(Number(li.rate) > 0)).length;
  if (unpriced && !confirm(unpriced + ' line' + (unpriced === 1 ? ' has' : 's have') + ' no price and will show as TBD. Send anyway?')) return;
  const saved = await _qWrite({ status: 'sent', sent_at: new Date().toISOString() });
  if (!saved) return;
  state._qLinkFor = saved._sbId;
  try { await navigator.clipboard.writeText(qShareUrl(saved)); showToast('Quote sent. Link copied.'); } catch (e) { /* the banner shows it */ }
  qBack();
}

// Takes the link down; the token survives so re-sending restores the same URL
async function qUnsend() {
  const q = state._q;
  if (!q || q.status !== 'sent' || !state._qEditingId) return;
  if (!confirm('Move ' + q.quoteNumber + ' back to draft? The client link stops working until you send it again.')) return;
  if (await quotes.patch(state._qEditingId, { status: 'draft' })) {
    q.status = 'draft';
    if (state._qLinkFor === state._qEditingId) state._qLinkFor = null;
    renderQuoteEditor();
  }
}

function qDuplicate(id) {
  if (state._quotesMigrationMissing) { _showSaveError(Q_MIGRATION_MSG); return; }
  const src = quotes.find(id);
  if (!src) return;
  const today = _localISODate();
  state._q = { ..._qBlank(), ...JSON.parse(JSON.stringify(src)),
    _sbId: null, invoiceId: null, quoteNumber: nextQuoteNumber(), status: 'draft', shareToken: '',
    issueDate: today, validUntil: _qAddDays(today, Q_VALID_DAYS),
    viewedAt: '', respondedAt: '', acceptedName: '', declineReason: '', responseSeen: true };
  if (!state._q.lineItems.length) state._q.lineItems = [{ desc: '', detail: '', unit: 'flat', qty: 1, rate: 0 }];
  state._qEditingId = null; state._qEditorOpen = true; state._qNewClientOpen = false;
  if (location.hash !== '#quotes/new') location.hash = 'quotes/new';
  else renderQuoteEditor();
}

/* ============================================================
   HAND-OFFS: deposit invoice, services agreement
   ============================================================ */
// Accepted quote -> a draft invoice for the deposit (or the whole
// amount when the quote asks no deposit), opened for review.
async function qDepositInvoice(id) {
  const q = quotes.find(id);
  if (!q || q.status !== 'accepted') return;
  if (q.invoiceId && invoices.find(q.invoiceId)) { location.hash = 'invoices/' + q.invoiceId; return; }
  if (state._invoicingMigrationMissing) { _showSaveError('Run migrations/011_invoicing.sql in Supabase first'); return; }
  const client = q.clientId ? clients.find(q.clientId) : null;
  const total = qTotal(q);
  const pct = Number(q.depositPct) || 0;
  const billTo = q.clientCompany || q.clientName;
  const terms = Q_BALANCE[q.balanceTerms] || Q_BALANCE.delivery;
  let lineItems, amount, notes;
  if (pct > 0) {
    amount = qDeposit(q);
    lineItems = [{ type: 'flat', desc: `${pct}% deposit: ${q.title || 'Project'} (Quote ${q.quoteNumber})`, qty: 1, rate: 0, fee: amount }];
    notes = `Deposit to book the project per Quote ${q.quoteNumber}, accepted by ${q.acceptedName}. Project total ${fmtMoney(total)}.` + (pct < 100 ? ` Balance of ${fmtMoney(total - amount)} due ${terms}.` : '');
  } else {
    amount = total;
    lineItems = q.lineItems.map(li => li.unit === 'day' ? { type: 'day', desc: li.desc, qty: li.qty, rate: li.rate, fee: 0 }
      : li.unit === 'hour' ? { type: 'hourly', desc: li.desc, qty: li.qty, rate: li.rate, fee: 0 }
      : { type: 'flat', desc: li.unit === 'each' && Number(li.qty) !== 1 ? `${li.desc} (${li.qty} × ${fmtMoney(li.rate)})` : li.desc, qty: 1, rate: 0, fee: qLineAmount(li) });
    notes = `Per Quote ${q.quoteNumber}, accepted by ${q.acceptedName}.`;
  }
  const today = _localISODate();
  const saved = await invoices.save({
    invoice_number: nextInvoiceNumber(client),
    brand: billTo,
    client_id: q.clientId || null,
    bill_to_name: billTo,
    bill_to_address: q.clientAddress || '',
    line_items: lineItems,
    amount,
    amount_paid: 0,
    date: today,
    due_date: pct > 0 ? today : null,
    status: 'draft',
    description: lineItems.map(li => li.desc).join(', '),
    payment_terms: 'none',
    notes,
    include_payment_info: true
  }, null);
  if (!saved || !saved._sbId) return;
  await quotes.patch(id, { invoice_id: saved._sbId }, true);
  showToast('Draft invoice ' + saved.invoiceNumber + ' created. Review it and send.');
  location.hash = 'invoices/' + saved._sbId;
}

// Accepted quote -> the Contract Builder's Production Services
// Agreement, prefilled. Contracts consumes state._contractPrefill on
// its next render.
function qToContract(id) {
  const q = quotes.find(id);
  if (!q) return;
  const dayLines = q.lineItems.filter(li => li.unit === 'day' && Number(li.rate) > 0);
  const work = q.lineItems.map(li => li.desc + (li.unit === 'each' && Number(li.qty) > 1 ? ` (×${li.qty})` : li.unit === 'day' ? ` (${li.qty} day${Number(li.qty) === 1 ? '' : 's'})` : '')).filter(Boolean).join('; ');
  state._contractPrefill = {
    number: q.quoteNumber,
    clientId: q.clientId,
    brand: q.clientCompany || q.clientName,
    contact: q.clientName,
    email: q.clientEmail,
    address: q.clientAddress,
    campaign: q.title,
    work,
    dayRate: dayLines.length ? Number(dayLines[0].rate) : 0,
    days: dayLines.reduce((s, li) => s + (Number(li.qty) || 0), 0),
    nte: qTotal(q),
    deposit: Number(q.depositPct) || 0,
    balance: q.balanceTerms,
    revisions: Number(q.revisionRounds) || 0
  };
  location.hash = 'contracts';
}

/* ============================================================
   PDF (browser print -> Save as PDF), owner and client alike
   ============================================================ */
function qPrintDoc(q) {
  let host = document.getElementById('quotePrintHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'quotePrintHost';
    document.body.appendChild(host);
  }
  host.innerHTML = renderQuoteDoc(q._sbId || q.fromName ? q : _qPreviewModel(q), _qClosingStatic(q));
  document.body.classList.add('printing-quote');
  const done = () => { document.body.classList.remove('printing-quote'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}
function qDownloadPDF() { if (state._q) qPrintDoc(_qPreviewModel(state._q)); }

/* ============================================================
   SIDEBAR BADGE: client responses not opened yet
   ============================================================ */
function _qSyncBadge() {
  const n = quotes.loaded ? state.QUOTES.filter(q => !q.responseSeen).length : state._quoteBadge;
  state._quoteBadge = n;
  const el = document.getElementById('quoteNavBadge');
  if (!el) return;
  el.textContent = n > 9 ? '9+' : String(n);
  el.hidden = !n;
  el.setAttribute('aria-label', n + ' new quote response' + (n === 1 ? '' : 's'));
}
// Before the store loads (boot, tab refocus) the badge asks for a count;
// once loaded, a refocus reloads the quotes so new responses land.
async function refreshQuoteBadge() {
  if (!state._authUser || !state.CREATOR._sbId) return;
  if (quotes.loaded) {
    await quotes.reload();
    if (!state._qEditorOpen) quotes.notify(); // never repaint over an open editor
    _qSyncBadge();
    return;
  }
  state._quoteBadge = await db.sbFetchQuoteBadge();
  _qSyncBadge();
}

/* ============================================================
   THE CLIENT PAGE (#q/TOKEN, public, no login)
   ============================================================ */
async function renderPublicQuote(token) {
  const el = document.getElementById('view-quote-public');
  if (!el) return;
  const fresh = state._qPublicToken !== token;
  state._qPublicToken = token;
  if (fresh) { state._qPublic = null; state._qPublicMode = 'idle'; state._qPublicError = ''; }
  el.innerHTML = '<div class="quote-public"><div class="skeleton" style="height:420px"></div></div>';
  const data = await db.sbFetchSharedQuote(token);
  if (state._qPublicToken !== token) return; // navigated away meanwhile
  state._qPublic = data;
  _paintPublicQuote();
}

function _paintPublicQuote() {
  const el = document.getElementById('view-quote-public');
  if (!el) return;
  const q = state._qPublic;
  if (!q || q._error) {
    document.title = 'Quote · Arkives';
    el.innerHTML = `
      <div class="quote-public">
        <div class="contract-document quote-doc quote-missing">
          <h2 class="contract-doc-title">Quote unavailable</h2>
          <p>${q && q._error ? 'This quote could not load. Check your connection and refresh the page.' : 'This quote link is not active. It may have been withdrawn or replaced; ask the sender for the current link.'}</p>
        </div>
      </div>`;
    return;
  }
  document.title = 'Quote ' + q.quoteNumber + (q.fromName ? ' · ' + q.fromName : '');
  el.innerHTML = `
    <div class="quote-public">
      <div class="quote-public-bar">
        <span>${_esc(q.fromName || 'Quote')}</span>
        <button class="btn btn-sm" data-action="qPublicPDF">Download PDF</button>
      </div>
      ${renderQuoteDoc(q, _qPublicClosing(q))}
    </div>`;
}

function _qPublicClosing(q) {
  const from = _esc(q.fromName || 'the sender');
  const date = q.respondedAt ? ' on ' + _esc(fmtDocDate(String(q.respondedAt).slice(0, 10))) : '';
  let inner;
  if (q.status === 'accepted') {
    inner = `<p class="quote-closing-done">Accepted by <strong>${_esc(q.acceptedName)}</strong>${date}.</p>
      <p>Thank you. ${from} will follow up with the deposit invoice to book the dates.</p>`;
  } else if (q.status === 'declined') {
    inner = `<p class="quote-closing-done">This quote was declined${date}.</p><p>Need something different? Reply to ${from} and they can send a revised quote.</p>`;
  } else if (q.expired) {
    inner = `<p class="quote-closing-done">This quote expired on ${_esc(fmtDocDate(q.validUntil))}.</p><p>Ask ${from}${q.fromEmail ? ` (<a href="mailto:${_esc(q.fromEmail)}">${_esc(q.fromEmail)}</a>)` : ''} for an updated quote.</p>`;
  } else if (state._qPublicMode === 'declining') {
    inner = `
      <p>Let ${from} know why, if you like (optional).</p>
      <div class="form-group"><textarea id="qPubReason" rows="3" maxlength="1000" placeholder="Budget, timing, scope…"></textarea></div>
      ${state._qPublicError ? `<p class="quote-public-error">${_esc(state._qPublicError)}</p>` : ''}
      <div class="gap-row">
        <button class="btn" data-action="qPublicDecline">Decline quote</button>
        <button class="btn btn-sm" data-action="qPublicMode" data-args="[&quot;idle&quot;]">Back</button>
      </div>`;
  } else {
    const total = qTotal(q);
    const pct = Number(q.depositPct) || 0;
    inner = `
      <p>To accept this quote${total ? ` (${fmtMoney(total)})` : ''}, type your full name below.${pct > 0 && total ? ` The ${pct}% deposit (${fmtMoney(qDeposit(q))}) is invoiced next.` : ''}</p>
      <div class="quote-accept-row">
        <input type="text" id="qPubName" maxlength="120" autocomplete="name" placeholder="Full name" aria-label="Full name">
        <button class="btn btn-primary" data-action="qPublicAccept" ${state._qPublicMode === 'busy' ? 'disabled' : ''}>Accept quote</button>
      </div>
      ${state._qPublicError ? `<p class="quote-public-error">${_esc(state._qPublicError)}</p>` : ''}
      <p class="quote-closing-fine">Typing your name and clicking Accept confirms you agree to this quote${q.validUntil ? `, valid until ${_esc(fmtDocDate(q.validUntil))}` : ''}. <button class="quote-link-btn" data-action="qPublicMode" data-args="[&quot;declining&quot;]">Decline instead</button></p>`;
  }
  return `<div class="contract-sig-block quote-closing"><p class="quote-closing-title">Acceptance</p>${inner}</div>`;
}

const Q_PUBLIC_ERRORS = {
  name_required: 'Type your full name to accept.',
  expired: 'This quote has expired.',
  already_responded: 'This quote already has a response.',
  not_found: 'This quote link is no longer active.',
  network: 'Something went wrong. Check your connection and try again.',
  offline: 'Something went wrong. Check your connection and try again.'
};

async function _qPublicRespond(accept) {
  const token = state._qPublicToken;
  if (!token || state._qPublicMode === 'busy') return;
  const name = (document.getElementById('qPubName')?.value || '').trim();
  const reason = (document.getElementById('qPubReason')?.value || '').trim();
  if (accept && name.length < 2) { state._qPublicError = Q_PUBLIC_ERRORS.name_required; _paintPublicQuote(); return; }
  const prevMode = state._qPublicMode;
  state._qPublicMode = 'busy'; state._qPublicError = '';
  const res = await db.sbRespondToQuote(token, accept, accept ? name : '', reason);
  if (state._qPublicToken !== token) return;
  if (!res || !res.ok) {
    state._qPublicMode = prevMode === 'busy' ? 'idle' : prevMode;
    state._qPublicError = Q_PUBLIC_ERRORS[res && res.error] || Q_PUBLIC_ERRORS.network;
    if (res && (res.error === 'already_responded' || res.error === 'expired')) { await renderPublicQuote(token); return; }
    _paintPublicQuote();
    return;
  }
  state._qPublicMode = 'idle';
  await renderPublicQuote(token);
}
function qPublicAccept() { _qPublicRespond(true); }
function qPublicDecline() { _qPublicRespond(false); }
function qPublicMode(mode) { state._qPublicMode = mode; state._qPublicError = ''; _paintPublicQuote(); }
function qPublicPDF() { if (state._qPublic && !state._qPublic._error) qPrintDoc(state._qPublic); }

/* ---- SIDE EFFECTS ---- Registered from main.js in a fixed order, not at import time. */
export function __init() {
  // Coming back to the tab is when a client's answer has most likely landed
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && state._booted && state._authUser) refreshQuoteBadge();
  });
}

act({ qAddLine, qAddService, qBack, qCancelNewClient, qCancelService, qCloseRowMenu, qCloseRowMenuBackdrop, qCopyLink, qDeleteQuote, qDeleteService, qDepositInvoice, qDismissLink, qDownloadPDF, qDuplicate, qEditService, qField, qLiField, qNew, qOpen, qOpenRowMenu, qPickClient, qPublicAccept, qPublicDecline, qPublicMode, qPublicPDF, qRemoveLine, qRowAction, qSaveDraft, qSaveNewClient, qSaveService, qSearchInput, qSend, qSetFilter, qToContract, qUnsend });

export { _qApplyRoute, _qFilteredRows, _qPayload, _qStartEdit, _qStartNew, _qSyncBadge, nextQuoteNumber, qDeposit, qDepositInvoice, qDisplayStatus, qIsExpired, qLineAmount, qPrintDoc, qPublicAccept, qPublicDecline, qToContract, qShareUrl, qTotal, refreshQuoteBadge, renderPublicQuote, renderQuoteDoc, renderQuoteEditor, renderQuotes, unmountQuotes };
