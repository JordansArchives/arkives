/* ============================================================
   Arkives — Invoices view
   List + clients book + two-pane editor (form left, live
   document preview right). The document is Arkives-branded and
   exports to PDF through the browser print dialog.

   State (INVOICE_DATA, CLIENTS, CREATOR) and Supabase CRUD live
   in app.js; this file is view + document logic only. Loaded
   after app.js in index.html.
   ============================================================ */

/* ---- VIEW STATE ---- */
let _invEditorOpen = false;
let _invEditingId = null;      // _sbId of the invoice being edited; null = new
let _inv = null;               // working copy while the editor is open
let _invNewClientOpen = false; // inline new-client form inside the editor
let _invClientEditingId = null; // clients card: null = closed, '__new' = adding, else _sbId
let _invFilter = 'all';        // all | draft | sent | overdue | paid
let _invSearch = '';           // matches invoice number / bill-to
let _invPayingId = null;       // invoice _sbId with the payment modal open

function resetInvoiceViewState() {
  _invEditorOpen = false; _invEditingId = null; _inv = null;
  _invNewClientOpen = false; _invClientEditingId = null;
  _invFilter = 'all'; _invSearch = ''; _invPayingId = null;
  _invSyncPayModal();
}

// The modal mounts on <body>, not inside .main — .main is a lower
// stacking context than the sidebar, so overlays rendered in the
// view can never cover it regardless of z-index
function _invSyncPayModal() {
  let host = document.getElementById('invModalHost');
  if (!host) {
    if (!_invPayingId) return;
    host = document.createElement('div');
    host.id = 'invModalHost';
    document.body.appendChild(host);
  }
  host.innerHTML = _invPayingId ? renderPayModal() : '';
}

/* ---- MONEY / DATE / TERMS HELPERS ---- */
function fmtMoney(n) {
  const v = Number(n) || 0;
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function fmtDocDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const INV_TERM_DAYS = { net15: 15, net30: 30, net45: 45, net60: 60 };

function invTermLabel(t) {
  const days = INV_TERM_DAYS[t];
  return days ? 'Net ' + days : 'No terms';
}

function invTermDueDate(dateStr, terms) {
  const days = INV_TERM_DAYS[terms];
  if (!days || !dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/* ---- AMOUNT MATH ---- */
function invLineAmount(li) {
  if ((li.type || 'flat') === 'flat') return Number(li.fee) || 0;
  return (Number(li.qty) || 0) * (Number(li.rate) || 0);
}

// Legacy invoices (pre-011) have no line items, just a stored amount
function invTotal(inv) {
  const items = inv.lineItems || [];
  return items.length ? items.reduce((s, li) => s + invLineAmount(li), 0) : (Number(inv.amount) || 0);
}

function invBalance(inv) {
  return invTotal(inv) - (Number(inv.amountPaid) || 0);
}

function invIsOverdue(inv) {
  return inv.status === 'sent' && inv.dueDate && inv.dueDate < todayISO();
}

function invDisplayStatus(inv) {
  return invIsOverdue(inv) ? 'overdue' : (inv.status || 'draft');
}

/* ---- INVOICE NUMBERING ----
   per_client: prefix from the client's book entry (auto-suggested
   from their name), counter scoped to that prefix → ACME-0001.
   global: one running sequence under the profile prefix → INV-2025002.
   Both suggestions are editable on the invoice before saving. */
function invSuggestPrefix(name) {
  // 12-char cap matches the clients.invoice_prefix column constraint
  const word = String(name || '').trim().split(/\s+/)[0] || '';
  return word.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'INV';
}

function nextInvoiceNumber(client) {
  const mode = CREATOR.invoiceNumbering || 'per_client';
  let prefix;
  if (mode === 'global' || !client) {
    prefix = (CREATOR.invoicePrefix || 'INV').toUpperCase();
  } else {
    prefix = client.invoicePrefix || invSuggestPrefix(client.company || client.name);
  }
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + escaped + '-(\\d+)$');
  let max = 0;
  (INVOICE_DATA || []).forEach(inv => {
    const m = String(inv.invoiceNumber || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return prefix + '-' + String(max + 1).padStart(4, '0');
}

/* ============================================================
   LIST VIEW
   ============================================================ */
function renderInvoices() {
  if (_invEditorOpen) { renderInvoiceEditor(); return; }
  const container = document.getElementById('view-invoices');

  const outstanding = INVOICE_DATA.filter(i => i.status === 'sent').reduce((s, i) => s + invBalance(i), 0);
  const paidTotal = INVOICE_DATA.filter(i => i.status === 'paid').reduce((s, i) => s + invTotal(i), 0);
  const overdueCount = INVOICE_DATA.filter(invIsOverdue).length;
  const draftCount = INVOICE_DATA.filter(i => i.status === 'draft').length;

  const setupCard = _invoicingMigrationMissing ? `
    <div class="tasks-setup-card" style="margin-bottom:20px">
      <h3>One-time setup needed</h3>
      <p>The invoicing upgrade isn't in Supabase yet. Run <code>migrations/011_invoicing.sql</code> in the Supabase SQL editor, then refresh this page. Existing invoices below are read-only until then.</p>
    </div>` : '';

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Invoices</h1>
        <p class="view-subtitle">Build it, send it, get paid.</p>
      </div>
      <div class="gap-row">
        <button class="btn" onclick="invExportCSV()">Export CSV</button>
        <button class="btn btn-primary" onclick="invNew()">+ New Invoice</button>
      </div>
    </div>

    ${setupCard}

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Outstanding</span>
        <span class="kpi-value">${fmtMoney(outstanding)}</span>
        ${overdueCount ? `<span class="kpi-delta" style="color:var(--red)">${overdueCount} overdue</span>` : `<span class="kpi-delta">${INVOICE_DATA.filter(i => i.status === 'sent').length} sent</span>`}
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Collected</span>
        <span class="kpi-value">${fmtMoney(paidTotal)}</span>
        <span class="kpi-delta up">${INVOICE_DATA.filter(i => i.status === 'paid').length} paid</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Drafts</span>
        <span class="kpi-value">${draftCount}</span>
        <span class="kpi-delta">not sent yet</span>
      </div>
    </div>

    <div class="card">
      <div class="inv-list-controls">
        <div class="inv-chips">
          ${['all', 'draft', 'sent', 'overdue', 'paid'].map(f => {
            const count = f === 'all' ? INVOICE_DATA.length : INVOICE_DATA.filter(i => invDisplayStatus(i) === f).length;
            const label = f.charAt(0).toUpperCase() + f.slice(1);
            return `<button class="inv-chip ${_invFilter === f ? 'active' : ''}" onclick="invSetFilter('${f}')">${label} <em>${count}</em></button>`;
          }).join('')}
        </div>
        <input type="search" class="inv-search" id="invSearch" placeholder="Search number or client" value="${_esc(_invSearch)}" oninput="invSearchInput(this.value)">
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Bill To</th>
              <th>Total</th>
              <th>Balance</th>
              <th>Date</th>
              <th>Due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="invTbody">${_renderInvRows()}</tbody>
        </table>
      </div>
    </div>

    ${renderClientsCard()}
  `;
  _invSyncPayModal();
}

function _invFilteredRows() {
  let rows = INVOICE_DATA;
  if (_invFilter !== 'all') rows = rows.filter(i => invDisplayStatus(i) === _invFilter);
  const q = _invSearch.trim().toLowerCase();
  if (q) rows = rows.filter(i =>
    String(i.invoiceNumber).toLowerCase().includes(q) ||
    String(i.billToName || i.brand).toLowerCase().includes(q));
  return rows;
}

function _renderInvRows() {
  const rows = _invFilteredRows();
  if (!rows.length) {
    const msg = INVOICE_DATA.length
      ? 'No invoices match this filter.'
      : 'No invoices yet. Click "+ New Invoice" to build your first one.';
    return `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:40px">${msg}</td></tr>`;
  }
  return rows.map(inv => {
    const st = invDisplayStatus(inv);
    const balance = invBalance(inv);
    return `
      <tr class="inv-row" onclick="invOpen('${inv._sbId}')">
        <td style="font-weight:600;font-variant-numeric:tabular-nums">${_esc(inv.invoiceNumber)}</td>
        <td>${_esc(inv.billToName || inv.brand)}</td>
        <td style="font-variant-numeric:tabular-nums">${fmtMoney(invTotal(inv))}</td>
        <td style="font-variant-numeric:tabular-nums">${inv.status === 'paid' ? '—' : fmtMoney(balance)}</td>
        <td>${_esc(inv.date)}</td>
        <td>${_esc(inv.dueDate || '—')}</td>
        <td><span class="invoice-status ${st}">${st.charAt(0).toUpperCase() + st.slice(1)}</span></td>
        <td class="inv-row-actions" onclick="event.stopPropagation()">
          ${inv.status === 'draft' ? `<button class="btn btn-sm" onclick="invQuickStatus('${inv._sbId}','sent')">Mark Sent</button>` : ''}
          ${inv.status === 'sent' ? `<button class="btn btn-sm" onclick="invOpenPay('${inv._sbId}')">Record Payment</button>` : ''}
          ${inv.status !== 'draft' ? `<button class="btn btn-sm" onclick="invUndoStatus('${inv._sbId}')" title="${inv.status === 'paid' ? 'Back to Sent' : 'Back to Draft'}">Undo</button>` : ''}
          <button class="btn btn-sm" onclick="invDuplicate('${inv._sbId}')">Duplicate</button>
          <button class="btn btn-sm" onclick="invRowPDF('${inv._sbId}')">PDF</button>
          <button class="btn btn-sm inv-row-delete" onclick="invRowDelete('${inv._sbId}')" title="Delete invoice">Delete</button>
        </td>
      </tr>`;
  }).join('');
}

function invSetFilter(f) { _invFilter = f; renderInvoices(); }

// Only the tbody re-renders on search input so the field keeps focus
function invSearchInput(v) {
  _invSearch = v;
  const tb = document.getElementById('invTbody');
  if (tb) tb.innerHTML = _renderInvRows();
}

/* ---- CLIENTS BOOK (card on the list view) ---- */
function renderClientsCard() {
  const editing = _invClientEditingId;
  const editingClient = editing && editing !== '__new'
    ? CLIENTS.find(c => c._sbId === editing) : null;

  const form = editing ? `
    <div class="inv-client-form" id="invClientForm">
      <div class="form-row">
        <div class="form-group">
          <label>Client Name</label>
          <input type="text" id="clName" value="${_esc(editingClient ? editingClient.name : '')}" placeholder="Jane Smith">
        </div>
        <div class="form-group">
          <label>Company</label>
          <input type="text" id="clCompany" value="${_esc(editingClient ? editingClient.company : '')}" placeholder="Acme Media LLC">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="clEmail" value="${_esc(editingClient ? editingClient.email : '')}" placeholder="billing@company.com">
        </div>
        <div class="form-group">
          <label>Invoice Prefix</label>
          <input type="text" id="clPrefix" value="${_esc(editingClient ? editingClient.invoicePrefix : '')}" placeholder="auto from name">
        </div>
      </div>
      <div class="form-group">
        <label>Billing Address</label>
        <textarea id="clAddress" rows="3" placeholder="Company&#10;Street&#10;City, ST ZIP">${_esc(editingClient ? editingClient.billingAddress : '')}</textarea>
      </div>
      <div class="gap-row">
        <button class="btn btn-primary" onclick="invSaveClient()">${editingClient ? 'Save Client' : 'Add Client'}</button>
        <button class="btn" onclick="invCancelClientForm()">Cancel</button>
      </div>
    </div>` : '';

  return `
    <div class="card" style="margin-top:20px">
      <div class="inv-clients-head">
        <div>
          <h3 style="margin:0;font-family:var(--font-display);font-size:1.1rem">Clients</h3>
          <p style="margin:2px 0 0;color:var(--text-muted);font-size:0.85rem">Saved billing details. Picking one in the editor fills the invoice.</p>
        </div>
        ${editing ? '' : `<button class="btn btn-sm" onclick="invAddClientFromCard()">+ Add Client</button>`}
      </div>
      ${form}
      ${CLIENTS.length ? `
      <div class="table-wrap" style="margin-top:12px">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Company</th><th>Prefix</th><th>Address</th><th></th></tr></thead>
          <tbody>
            ${CLIENTS.map(c => `
              <tr>
                <td style="font-weight:600">${_esc(c.name)}</td>
                <td>${_esc(c.company || '—')}</td>
                <td style="font-variant-numeric:tabular-nums">${_esc(c.invoicePrefix || invSuggestPrefix(c.company || c.name))}</td>
                <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc((c.billingAddress || '').replace(/\n/g, ', '))}</td>
                <td class="inv-row-actions">
                  <button class="btn btn-sm" onclick="invEditClient('${c._sbId}')">Edit</button>
                  <button class="btn btn-sm" onclick="invDeleteClient('${c._sbId}')">Delete</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : (editing ? '' : '<p style="color:var(--text-muted);padding:12px 0 0;font-size:0.85rem">No clients saved yet.</p>')}
    </div>`;
}

function invAddClientFromCard() {
  if (_invoicingMigrationMissing) { _showSaveError('Run migrations/011_invoicing.sql in Supabase first'); return; }
  _invClientEditingId = '__new'; renderInvoices();
}
function invEditClient(id) { _invClientEditingId = id; renderInvoices(); }
function invCancelClientForm() { _invClientEditingId = null; renderInvoices(); }

async function invSaveClient() {
  const name = document.getElementById('clName').value.trim();
  if (!name) { _showSaveError('Client needs a name'); return; }
  const data = {
    name,
    company: document.getElementById('clCompany').value.trim(),
    email: document.getElementById('clEmail').value.trim(),
    invoicePrefix: document.getElementById('clPrefix').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
    billingAddress: document.getElementById('clAddress').value.trim()
  };
  if (_invClientEditingId === '__new') {
    const row = await sbAddClient(data);
    if (row) CLIENTS.push({ _sbId: row.id, ...data });
  } else {
    const ok = await sbUpdateClient(_invClientEditingId, {
      name: data.name, company: data.company, email: data.email,
      invoice_prefix: data.invoicePrefix, billing_address: data.billingAddress
    });
    if (ok) {
      const c = CLIENTS.find(x => x._sbId === _invClientEditingId);
      if (c) Object.assign(c, data);
    }
  }
  CLIENTS.sort((a, b) => a.name.localeCompare(b.name));
  _invClientEditingId = null;
  renderInvoices();
}

async function invDeleteClient(id) {
  const c = CLIENTS.find(x => x._sbId === id);
  if (!c) return;
  if (!confirm('Delete client "' + c.name + '"? Existing invoices keep their billing snapshot.')) return;
  const ok = await sbDeleteClient(id);
  if (ok) {
    CLIENTS = CLIENTS.filter(x => x._sbId !== id);
    renderInvoices();
  }
}

/* ---- LIST ACTIONS ---- */
async function invQuickStatus(sbId, status) {
  const inv = INVOICE_DATA.find(i => i._sbId === sbId);
  if (!inv) return;
  const ok = await sbUpdateInvoice(sbId, { status });
  if (ok) { inv.status = status; renderInvoices(); }
}

function invRowPDF(sbId) {
  const inv = INVOICE_DATA.find(i => i._sbId === sbId);
  if (inv) invPrintDoc(inv);
}

async function invRowDelete(sbId) {
  const inv = INVOICE_DATA.find(i => i._sbId === sbId);
  if (!inv) return;
  if (!confirm('Delete invoice ' + inv.invoiceNumber + '? This can\'t be undone.')) return;
  const ok = await sbDeleteInvoice(sbId);
  if (ok) {
    INVOICE_DATA = INVOICE_DATA.filter(i => i._sbId !== sbId);
    renderInvoices();
  }
}

// Steps status back one: paid → sent, sent → draft
async function invUndoStatus(sbId) {
  const inv = INVOICE_DATA.find(i => i._sbId === sbId);
  if (!inv) return;
  const prev = inv.status === 'paid' ? 'sent' : 'draft';
  const ok = await sbUpdateInvoice(sbId, { status: prev });
  if (ok) { inv.status = prev; renderInvoices(); }
}

// Opens the editor as a NEW invoice pre-filled from the source —
// nothing is written until Save
function invDuplicate(sbId) {
  if (_invoicingMigrationMissing) { _showSaveError('Run migrations/011_invoicing.sql in Supabase first'); return; }
  const src = INVOICE_DATA.find(i => i._sbId === sbId);
  if (!src) return;
  _inv = JSON.parse(JSON.stringify(src));
  _inv._sbId = null;
  const client = CLIENTS.find(c => c._sbId === _inv.clientId) || null;
  _inv.invoiceNumber = nextInvoiceNumber(client);
  _inv.date = todayISO();
  _inv.dueDate = INV_TERM_DAYS[_inv.paymentTerms] ? invTermDueDate(_inv.date, _inv.paymentTerms) : '';
  _inv.status = 'draft';
  _inv.amountPaid = 0;
  if (!_inv.lineItems || !_inv.lineItems.length) {
    _inv.lineItems = [{ type: 'flat', desc: _inv.description || '', qty: 1, rate: 0, fee: Number(_inv.amount) || 0 }];
  }
  _invEditingId = null; _invEditorOpen = true; _invNewClientOpen = false;
  renderInvoiceEditor();
}

/* ---- PAYMENT RECORDING ---- */
function renderPayModal() {
  const inv = INVOICE_DATA.find(i => i._sbId === _invPayingId);
  if (!inv) return '';
  const balance = invBalance(inv);
  return `
    <div class="inv-modal-overlay" onclick="if(event.target===this)invClosePay()">
      <div class="inv-modal">
        <h3>Record Payment</h3>
        <p class="inv-modal-sub">${_esc(inv.invoiceNumber)} · ${_esc(inv.billToName || inv.brand)}<br>
        Balance due: <strong>${fmtMoney(balance)}</strong>${Number(inv.amountPaid) > 0 ? ` (${fmtMoney(inv.amountPaid)} already paid)` : ''}</p>
        <div class="form-group">
          <label>Amount Received</label>
          <input type="number" id="invPayAmount" step="0.01" min="0" value="${balance > 0 ? balance.toFixed(2) : ''}" placeholder="0.00">
        </div>
        <p class="inv-help">Partial payments accumulate. The invoice flips to Paid when the balance hits zero.</p>
        <div class="gap-row">
          <button class="btn btn-primary" onclick="invRecordPayment()">Record</button>
          <button class="btn" onclick="invClosePay()">Cancel</button>
        </div>
      </div>
    </div>`;
}

function invOpenPay(sbId) {
  _invPayingId = sbId;
  renderInvoices();
  const el = document.getElementById('invPayAmount');
  if (el) { el.focus(); el.select(); }
}

function invClosePay() { _invPayingId = null; renderInvoices(); }

async function invRecordPayment() {
  const inv = INVOICE_DATA.find(i => i._sbId === _invPayingId);
  if (!inv) { invClosePay(); return; }
  const amt = parseFloat(document.getElementById('invPayAmount').value) || 0;
  if (amt <= 0) { _showSaveError('Enter an amount above zero'); return; }
  const newPaid = (Number(inv.amountPaid) || 0) + amt;
  // half-cent tolerance so float math can't strand a paid invoice at Sent
  const settled = newPaid >= invTotal(inv) - 0.005;
  const updates = { amount_paid: newPaid };
  if (settled) updates.status = 'paid';
  const ok = await sbUpdateInvoice(inv._sbId, updates);
  if (!ok) return;
  inv.amountPaid = newPaid;
  if (settled) inv.status = 'paid';
  invClosePay();
}

/* ---- CSV EXPORT (all invoices, for bookkeeping) ---- */
function _invCsvString() {
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const header = ['Invoice #', 'Bill To', 'Date', 'Due Date', 'Status', 'Total', 'Amount Paid', 'Balance', 'Terms', 'Notes'];
  const lines = [header.map(esc).join(',')];
  INVOICE_DATA.forEach(inv => {
    const st = invDisplayStatus(inv);
    lines.push([
      inv.invoiceNumber, inv.billToName || inv.brand, inv.date, inv.dueDate || '',
      st.charAt(0).toUpperCase() + st.slice(1), invTotal(inv).toFixed(2), (Number(inv.amountPaid) || 0).toFixed(2),
      invBalance(inv).toFixed(2), invTermLabel(inv.paymentTerms), inv.notes || ''
    ].map(esc).join(','));
  });
  return lines.join('\n');
}

function invExportCSV() {
  if (!INVOICE_DATA.length) { _showSaveError('No invoices to export'); return; }
  const blob = new Blob([_invCsvString()], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'arkives-invoices-' + todayISO() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  _showSaveSuccess();
}

/* ============================================================
   EDITOR
   ============================================================ */
function invNew() {
  if (_invoicingMigrationMissing) { _showSaveError('Run migrations/011_invoicing.sql in Supabase first'); return; }
  _inv = {
    _sbId: null, clientId: null,
    invoiceNumber: nextInvoiceNumber(null),
    billToName: '', billToAddress: '',
    date: todayISO(), paymentTerms: 'none', dueDate: '',
    lineItems: [{ type: 'flat', desc: '', qty: 1, rate: 0, fee: 0 }],
    amountPaid: 0, notes: '', includePaymentInfo: true,
    status: 'draft'
  };
  _invEditingId = null; _invEditorOpen = true; _invNewClientOpen = false;
  renderInvoiceEditor();
}

function invOpen(sbId) {
  const src = INVOICE_DATA.find(i => i._sbId === sbId);
  if (!src) return;
  _inv = JSON.parse(JSON.stringify(src));
  // Legacy row (pre-builder): surface the stored amount as one flat line
  if (!_inv.lineItems || !_inv.lineItems.length) {
    _inv.lineItems = [{ type: 'flat', desc: _inv.description || 'Creator partnership', qty: 1, rate: 0, fee: Number(_inv.amount) || 0 }];
  }
  if (!_inv.billToName) _inv.billToName = _inv.brand || '';
  _invEditingId = sbId; _invEditorOpen = true; _invNewClientOpen = false;
  renderInvoiceEditor();
}

function invBack() {
  _invEditorOpen = false; _invEditingId = null; _inv = null;
  renderInvoices();
}

function renderInvoiceEditor() {
  const container = document.getElementById('view-invoices');
  const inv = _inv;
  const netLocked = !!INV_TERM_DAYS[inv.paymentTerms];
  const hasBank = !!(CREATOR.bankName || CREATOR.bankAccountNumber);

  const clientOptions = [
    `<option value="">— Select a client —</option>`,
    ...CLIENTS.map(c => `<option value="${c._sbId}" ${inv.clientId === c._sbId ? 'selected' : ''}>${_esc(c.name)}${c.company ? ' · ' + _esc(c.company) : ''}</option>`),
    `<option value="__new">+ New client…</option>`
  ].join('');

  const newClientForm = _invNewClientOpen ? `
    <div class="inv-client-form">
      <div class="form-group"><label>Client Name</label><input type="text" id="invNcName" placeholder="Jane Smith"></div>
      <div class="form-group"><label>Company</label><input type="text" id="invNcCompany" placeholder="Acme Media LLC"></div>
      <div class="form-group"><label>Billing Address</label><textarea id="invNcAddress" rows="3" placeholder="Company&#10;Street&#10;City, ST ZIP"></textarea></div>
      <div class="gap-row">
        <button class="btn btn-primary btn-sm" onclick="invSaveNewClient()">Save Client</button>
        <button class="btn btn-sm" onclick="_invNewClientOpen=false;renderInvoiceEditor()">Cancel</button>
      </div>
    </div>` : '';

  container.innerHTML = `
    <div class="view-header">
      <div>
        <button class="btn btn-sm" onclick="invBack()" style="margin-bottom:8px">← Invoices</button>
        <h1 class="view-title">${_invEditingId ? 'Edit Invoice' : 'New Invoice'}</h1>
      </div>
      <div class="gap-row">
        <button class="btn" onclick="invDownloadPDF()">Download PDF</button>
        <button class="btn btn-primary" onclick="invSave()">Save Invoice</button>
      </div>
    </div>

    <div class="inv-editor">
      <div class="inv-form-panel">

        <div class="inv-section-label">Bill To</div>
        <div class="form-group">
          <label>Client</label>
          <select id="invClientSel" onchange="invPickClient(this.value)">${clientOptions}</select>
        </div>
        ${newClientForm}
        <div class="form-group">
          <label>Name / Company</label>
          <input type="text" id="invBillToName" value="${_esc(inv.billToName)}" placeholder="Client or company name" oninput="invField('billToName', this.value)">
        </div>
        <div class="form-group">
          <label>Billing Address</label>
          <textarea id="invBillToAddress" rows="3" placeholder="Company&#10;Street&#10;City, ST ZIP" oninput="invField('billToAddress', this.value)">${_esc(inv.billToAddress)}</textarea>
        </div>
        <p class="inv-help">Picking a client fills this and sets the next invoice number. Editing here never changes the saved client.</p>

        <div class="inv-section-label">Details</div>
        <div class="form-group">
          <label>Invoice Number</label>
          <input type="text" id="invNumber" value="${_esc(inv.invoiceNumber)}" oninput="invField('invoiceNumber', this.value)">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date</label>
            <input type="date" id="invDate" value="${_esc(inv.date)}" onchange="invField('date', this.value)">
          </div>
          <div class="form-group">
            <label>Payment Terms</label>
            <select id="invTerms" onchange="invField('paymentTerms', this.value)">
              <option value="none" ${inv.paymentTerms === 'none' ? 'selected' : ''}>No terms</option>
              <option value="net15" ${inv.paymentTerms === 'net15' ? 'selected' : ''}>Net 15</option>
              <option value="net30" ${inv.paymentTerms === 'net30' ? 'selected' : ''}>Net 30</option>
              <option value="net45" ${inv.paymentTerms === 'net45' ? 'selected' : ''}>Net 45</option>
              <option value="net60" ${inv.paymentTerms === 'net60' ? 'selected' : ''}>Net 60</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Due Date</label>
          <input type="date" id="invDue" value="${_esc(inv.dueDate)}" ${netLocked ? 'disabled' : ''} onchange="invField('dueDate', this.value)">
        </div>
        <p class="inv-help">Net terms set the due date automatically and lock it. With no terms, enter any date you like. Leave it blank and no due date shows.</p>
        <div class="form-group">
          <label>Status</label>
          <select id="invStatus" onchange="invField('status', this.value)">
            <option value="draft" ${inv.status === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="sent" ${inv.status === 'sent' ? 'selected' : ''}>Sent</option>
            <option value="paid" ${inv.status === 'paid' ? 'selected' : ''}>Paid</option>
          </select>
        </div>

        <div class="inv-section-label">Line Items</div>
        <div id="invLineItems">${_renderInvLineItems()}</div>
        <button class="btn inv-add-line" onclick="invAddLine()">+ Add line item</button>

        <div class="inv-section-label">Payment</div>
        <div class="form-group">
          <label>Amount Already Paid</label>
          <input type="number" id="invAmountPaid" step="0.01" min="0" value="${inv.amountPaid || ''}" placeholder="0.00" oninput="invField('amountPaid', this.value)">
        </div>
        <label class="inv-check">
          <input type="checkbox" id="invIncPay" ${inv.includePaymentInfo ? 'checked' : ''} onchange="invField('includePaymentInfo', this.checked)">
          <span>Include payment info block</span>
        </label>
        ${!hasBank ? '<p class="inv-help">No bank details saved yet. Add them in Settings → Invoicing and they\'ll appear on the invoice.</p>' : ''}

        <div class="inv-section-label">Notes</div>
        <div class="form-group">
          <textarea id="invNotes" rows="3" placeholder="Optional note to the client" oninput="invField('notes', this.value)">${_esc(inv.notes)}</textarea>
        </div>

        ${_invEditingId ? `<button class="btn inv-delete-btn" onclick="invDelete()">Delete Invoice</button>` : ''}
      </div>

      <div class="inv-preview-pane">
        <div id="invDocPreview">${renderInvoiceDoc(inv)}</div>
      </div>
    </div>
  `;
}

function _renderInvLineItems() {
  return _inv.lineItems.map((li, i) => {
    const type = li.type || 'flat';
    const qtyLabel = type === 'hourly' ? 'Hours' : 'Days';
    const rateLabel = type === 'hourly' ? 'Rate / hr' : 'Rate / day';
    return `
    <div class="inv-li">
      <div class="inv-li-top">
        <div class="inv-li-types">
          <button class="inv-li-type ${type === 'flat' ? 'active' : ''}" onclick="invLiType(${i},'flat')">Flat</button>
          <button class="inv-li-type ${type === 'hourly' ? 'active' : ''}" onclick="invLiType(${i},'hourly')">Hourly</button>
          <button class="inv-li-type ${type === 'day' ? 'active' : ''}" onclick="invLiType(${i},'day')">Day</button>
        </div>
        ${_inv.lineItems.length > 1 ? `<button class="inv-li-remove" onclick="invRemoveLine(${i})" title="Remove">×</button>` : ''}
      </div>
      <div class="form-group">
        <input type="text" placeholder="Description" value="${_esc(li.desc)}" oninput="invLiField(${i},'desc',this.value)">
      </div>
      ${type === 'flat' ? `
      <div class="form-group">
        <label>Fee</label>
        <input type="number" step="0.01" min="0" value="${li.fee || ''}" placeholder="0.00" oninput="invLiField(${i},'fee',this.value)">
      </div>` : `
      <div class="form-row">
        <div class="form-group">
          <label>${qtyLabel}</label>
          <input type="number" step="0.25" min="0" value="${li.qty || ''}" placeholder="0" oninput="invLiField(${i},'qty',this.value)">
        </div>
        <div class="form-group">
          <label>${rateLabel}</label>
          <input type="number" step="0.01" min="0" value="${li.rate || ''}" placeholder="0.00" oninput="invLiField(${i},'rate',this.value)">
        </div>
      </div>`}
      <div class="inv-li-amount">= <span id="invLiAmt-${i}">${fmtMoney(invLineAmount(li))}</span></div>
    </div>`;
  }).join('');
}

/* ---- EDITOR FIELD HANDLERS ---- */
function invField(key, val) {
  if (key === 'amountPaid') val = parseFloat(val) || 0;
  _inv[key] = val;
  if (key === 'paymentTerms') {
    _inv.dueDate = INV_TERM_DAYS[val] ? invTermDueDate(_inv.date, val) : _inv.dueDate;
    renderInvoiceEditor();
    return;
  }
  if (key === 'date' && INV_TERM_DAYS[_inv.paymentTerms]) {
    _inv.dueDate = invTermDueDate(val, _inv.paymentTerms);
    const due = document.getElementById('invDue');
    if (due) due.value = _inv.dueDate;
  }
  _invUpdatePreview();
}

function invLiField(i, key, val) {
  if (key !== 'desc') val = parseFloat(val) || 0;
  _inv.lineItems[i][key] = val;
  const amtEl = document.getElementById('invLiAmt-' + i);
  if (amtEl) amtEl.textContent = fmtMoney(invLineAmount(_inv.lineItems[i]));
  _invUpdatePreview();
}

function invLiType(i, type) {
  _inv.lineItems[i].type = type;
  document.getElementById('invLineItems').innerHTML = _renderInvLineItems();
  _invUpdatePreview();
}

function invAddLine() {
  _inv.lineItems.push({ type: 'flat', desc: '', qty: 1, rate: 0, fee: 0 });
  document.getElementById('invLineItems').innerHTML = _renderInvLineItems();
  _invUpdatePreview();
}

function invRemoveLine(i) {
  _inv.lineItems.splice(i, 1);
  document.getElementById('invLineItems').innerHTML = _renderInvLineItems();
  _invUpdatePreview();
}

function _invUpdatePreview() {
  const el = document.getElementById('invDocPreview');
  if (el && _inv) el.innerHTML = renderInvoiceDoc(_inv);
}

/* ---- CLIENT PICKING (inside editor) ---- */
function invPickClient(val) {
  if (val === '__new') { _invNewClientOpen = true; renderInvoiceEditor(); return; }
  _invNewClientOpen = false;
  if (!val) { _inv.clientId = null; renderInvoiceEditor(); return; }
  const c = CLIENTS.find(x => x._sbId === val);
  if (!c) return;
  _inv.clientId = c._sbId;
  _inv.billToName = c.company || c.name;
  _inv.billToAddress = c.billingAddress || '';
  // Only auto-number unsaved invoices — an issued number never changes
  if (!_invEditingId) _inv.invoiceNumber = nextInvoiceNumber(c);
  renderInvoiceEditor();
}

async function invSaveNewClient() {
  const name = document.getElementById('invNcName').value.trim();
  if (!name) { _showSaveError('Client needs a name'); return; }
  const data = {
    name,
    company: document.getElementById('invNcCompany').value.trim(),
    email: '',
    invoicePrefix: '',
    billingAddress: document.getElementById('invNcAddress').value.trim()
  };
  const row = await sbAddClient(data);
  if (!row) return;
  const client = { _sbId: row.id, ...data };
  CLIENTS.push(client);
  CLIENTS.sort((a, b) => a.name.localeCompare(b.name));
  _invNewClientOpen = false;
  invPickClient(client._sbId);
}

/* ---- SAVE / DELETE ---- */
async function invSave() {
  if (_invoicingMigrationMissing) { _showSaveError('Run migrations/011_invoicing.sql in Supabase first'); return; }
  const inv = _inv;
  if (!inv.invoiceNumber.trim()) { _showSaveError('Invoice needs a number'); return; }
  if (!inv.billToName.trim()) { _showSaveError('Invoice needs a Bill To'); return; }

  const summary = inv.lineItems.map(li => li.desc).filter(Boolean).join(', ');
  const payload = {
    invoice_number: inv.invoiceNumber.trim(),
    brand: inv.billToName.trim(),
    client_id: inv.clientId || null,
    bill_to_name: inv.billToName.trim(),
    bill_to_address: inv.billToAddress,
    line_items: inv.lineItems,
    amount: invTotal(inv),
    amount_paid: Number(inv.amountPaid) || 0,
    date: inv.date || todayISO(),
    due_date: inv.dueDate || null,
    status: inv.status || 'draft',
    description: summary,
    payment_terms: inv.paymentTerms || 'none',
    notes: inv.notes || '',
    include_payment_info: !!inv.includePaymentInfo
  };

  if (_invEditingId) {
    const ok = await sbUpdateInvoice(_invEditingId, payload);
    if (!ok) return;
    const idx = INVOICE_DATA.findIndex(i => i._sbId === _invEditingId);
    if (idx !== -1) INVOICE_DATA[idx] = { ...INVOICE_DATA[idx], ..._mapInvoiceRow({ id: _invEditingId, ...payload }) };
  } else {
    const row = await sbAddInvoice(payload);
    if (!row) return;
    INVOICE_DATA.unshift(_mapInvoiceRow(row));
  }
  invBack();
}

async function invDelete() {
  if (!_invEditingId) return;
  if (!confirm('Delete invoice ' + _inv.invoiceNumber + '? This can\'t be undone.')) return;
  const ok = await sbDeleteInvoice(_invEditingId);
  if (ok) {
    INVOICE_DATA = INVOICE_DATA.filter(i => i._sbId !== _invEditingId);
    invBack();
  }
}

/* ============================================================
   THE DOCUMENT
   Arkives-branded invoice. Fixed light "paper" palette on
   purpose — a document doesn't theme-switch, and print output
   must match the preview exactly.
   ============================================================ */
function _invAddrLines(addr) {
  return String(addr || '').split('\n').filter(Boolean)
    .map(l => `<span>${_esc(l)}</span>`).join('');
}

function _invLineSub(li) {
  const type = li.type || 'flat';
  if (type === 'flat') return '';
  const qty = Number(li.qty) || 0;
  const unit = type === 'hourly' ? (qty === 1 ? 'hr' : 'hrs') : (qty === 1 ? 'day' : 'days');
  const per = type === 'hourly' ? 'hr' : 'day';
  return `${qty} ${unit} @ ${fmtMoney(li.rate)}/${per}`;
}

const INV_ORNAMENT_SVG = `<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
  <path d="M4.5 7.2c.1-.3.4-.5.8-.5h21.5c.4 0 .7.2.8.5l2.2 5.8c.1.2.1.4 0 .6-.2.3-.4.4-.7.4H3c-.3 0-.6-.2-.7-.4-.1-.2-.1-.4 0-.6L4.5 7.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5.2 14v12.5c0 .5.3.9.8.9h20c.5 0 .8-.4.8-.9V14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12.5 20.5h7c.4 0 .7.3.7.7v2.1c0 .4-.3.7-.7.7h-7c-.4 0-.7-.3-.7-.7v-2.1c0-.4.3-.7.7-.7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M13.8 7.5L16 3.5l2.2 4" fill="none" stroke="#C73539" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function renderInvoiceDoc(inv) {
  const fromName = CREATOR.entity || CREATOR.brand || CREATOR.name || '';
  const brandMark = CREATOR.brand || fromName || 'Arkives';
  const total = invTotal(inv);
  const paid = Number(inv.amountPaid) || 0;
  const balance = total - paid;
  const hasBank = !!(CREATOR.bankName || CREATOR.bankAccountNumber);
  const showPay = inv.includePaymentInfo && hasBank;
  const hasTerms = !!INV_TERM_DAYS[inv.paymentTerms];

  const itemRows = (inv.lineItems || []).length ? inv.lineItems.map(li => {
    const sub = _invLineSub(li);
    return `
      <div class="inv-doc-item">
        <div class="inv-doc-item-desc">
          <span>${_esc(li.desc || '—')}</span>
          ${sub ? `<small>${_esc(sub)}</small>` : ''}
        </div>
        <div class="inv-doc-item-amt">${fmtMoney(invLineAmount(li))}</div>
      </div>`;
  }).join('') : `
      <div class="inv-doc-item">
        <div class="inv-doc-item-desc"><span></span></div>
        <div class="inv-doc-item-amt">${fmtMoney(0)}</div>
      </div>`;

  const payBlock = showPay ? `
      <div class="inv-doc-pay">
        <div class="inv-doc-label">Payment Information</div>
        ${CREATOR.bankName ? `<div class="inv-doc-pay-row"><span>Bank name</span><span>${_esc(CREATOR.bankName)}</span></div>` : ''}
        ${CREATOR.bankAccountHolder ? `<div class="inv-doc-pay-row"><span>Account holder name</span><span>${_esc(CREATOR.bankAccountHolder)}</span></div>` : ''}
        ${CREATOR.bankAccountNumber ? `<div class="inv-doc-pay-row"><span>Account number</span><span>${_esc(CREATOR.bankAccountNumber)}</span></div>` : ''}
        ${CREATOR.bankRoutingNumber ? `<div class="inv-doc-pay-row"><span>Routing number</span><span>${_esc(CREATOR.bankRoutingNumber)}</span></div>` : ''}
        ${CREATOR.bankAccountType ? `<div class="inv-doc-pay-row"><span>Account type</span><span>${_esc(CREATOR.bankAccountType)}</span></div>` : ''}
      </div>` : '<div></div>';

  return `
  <div class="inv-doc">
    <div class="inv-doc-head">
      <span class="inv-doc-brand">${_esc(brandMark)}</span>
      <div class="inv-doc-title-wrap">
        <span class="inv-doc-title">Invoice</span>
        <span class="inv-doc-num"># ${_esc(inv.invoiceNumber || '—')}</span>
      </div>
    </div>
    <div class="inv-doc-rule"></div>

    <div class="inv-doc-meta">
      <div class="inv-doc-parties">
        <div class="inv-doc-label">From</div>
        <div class="inv-doc-party">
          <strong>${_esc(fromName)}</strong>
          ${_invAddrLines(CREATOR.businessAddress)}
        </div>
        <div class="inv-doc-label" style="margin-top:22px">Bill To</div>
        <div class="inv-doc-party">
          <strong>${_esc(inv.billToName)}</strong>
          ${_invAddrLines(inv.billToAddress)}
        </div>
      </div>
      <div class="inv-doc-dates">
        <div><span>Date</span><span>${fmtDocDate(inv.date)}</span></div>
        ${hasTerms ? `<div><span>Terms</span><span>${invTermLabel(inv.paymentTerms)}</span></div>` : ''}
        ${inv.dueDate ? `<div><span>Due</span><span>${fmtDocDate(inv.dueDate)}</span></div>` : ''}
      </div>
    </div>

    <div class="inv-doc-items">
      <div class="inv-doc-items-head">
        <span class="inv-doc-label">Item</span>
        <span class="inv-doc-label">Amount</span>
      </div>
      ${itemRows}
    </div>

    <div class="inv-doc-bottom">
      ${payBlock}
      <div class="inv-doc-totals">
        <div class="inv-doc-total-row"><span>Subtotal</span><span>${fmtMoney(total)}</span></div>
        ${paid > 0 ? `<div class="inv-doc-total-row"><span>Amount Paid</span><span>${fmtMoney(-paid)}</span></div>` : ''}
        <div class="inv-doc-balance"><span>Balance Due</span><span>${fmtMoney(balance)}</span></div>
      </div>
    </div>

    ${inv.notes ? `
    <div class="inv-doc-notes">
      <div class="inv-doc-label">Notes</div>
      <p>${_esc(inv.notes)}</p>
    </div>` : ''}

    <div class="inv-doc-ornament"><span></span>${INV_ORNAMENT_SVG}<span></span></div>
  </div>`;
}

/* ---- PRINT / PDF EXPORT ----
   Renders the document into a print-only host and opens the
   browser print dialog — "Save as PDF" gives a pixel-exact copy
   of the preview, real fonts included. */
function invPrintDoc(inv) {
  let host = document.getElementById('invPrintHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'invPrintHost';
    document.body.appendChild(host);
  }
  host.innerHTML = renderInvoiceDoc(inv);
  document.body.classList.add('printing-invoice');
  const done = () => {
    document.body.classList.remove('printing-invoice');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

function invDownloadPDF() {
  if (_inv) invPrintDoc(_inv);
}

/* ============================================================
   SETTINGS → INVOICING PANEL
   Rendered inside renderSettings() (app.js).
   ============================================================ */
function renderInvoicingSettings() {
  const c = CREATOR || {};
  return `
    <div class="settings-card">
      <h3>Invoice Numbering</h3>
      <p class="settings-help">Per client gives each client its own sequence (ACME-0001). Global runs one sequence for everything (INV-2025001). Numbers are always editable before saving an invoice.</p>
      <div class="form-row">
        <div class="form-group">
          <label>Numbering Style</label>
          <select id="setInvNumbering">
            <option value="per_client" ${c.invoiceNumbering !== 'global' ? 'selected' : ''}>Per client (ACME-0001)</option>
            <option value="global" ${c.invoiceNumbering === 'global' ? 'selected' : ''}>Global sequence (INV-2025001)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Global Prefix</label>
          <input type="text" id="setInvPrefix" value="${_esc(c.invoicePrefix || 'INV')}" placeholder="INV">
        </div>
      </div>
    </div>

    <div class="settings-card">
      <h3>Business Address</h3>
      <p class="settings-help">Appears in the FROM block on invoices, under your legal entity (set on the Profile tab).</p>
      <div class="form-group">
        <label>Address</label>
        <textarea id="setInvBizAddress" rows="4" placeholder="123 Main St&#10;Suite 400&#10;Austin, TX 78701">${_esc(c.businessAddress)}</textarea>
      </div>
    </div>

    <div class="settings-card">
      <h3>Payment Information</h3>
      <p class="settings-help">Shown on invoices when "Include payment info block" is on. Stored on your account — only you can see it.</p>
      <div class="form-row">
        <div class="form-group">
          <label>Bank Name</label>
          <input type="text" id="setInvBankName" value="${_esc(c.bankName)}" placeholder="First National Bank">
        </div>
        <div class="form-group">
          <label>Account Holder Name</label>
          <input type="text" id="setInvBankHolder" value="${_esc(c.bankAccountHolder)}" placeholder="Your Business LLC">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Account Number</label>
          <input type="text" id="setInvBankAccount" value="${_esc(c.bankAccountNumber)}" placeholder="000123456789">
        </div>
        <div class="form-group">
          <label>Routing Number</label>
          <input type="text" id="setInvBankRouting" value="${_esc(c.bankRoutingNumber)}" placeholder="123456789">
        </div>
      </div>
      <div class="form-group">
        <label>Account Type</label>
        <input type="text" id="setInvBankType" value="${_esc(c.bankAccountType)}" placeholder="Business Checking">
      </div>
      <div class="settings-actions">
        <button class="btn btn-primary" onclick="saveInvoicingSettings()">Save Invoicing Settings</button>
      </div>
    </div>
  `;
}

async function saveInvoicingSettings() {
  if (_invoicingMigrationMissing) { _showSaveError('Run migrations/011_invoicing.sql in Supabase first'); return; }
  const updates = {
    invoice_numbering: document.getElementById('setInvNumbering').value,
    invoice_prefix: (document.getElementById('setInvPrefix').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)) || 'INV',
    business_address: document.getElementById('setInvBizAddress').value.trim(),
    bank_name: document.getElementById('setInvBankName').value.trim(),
    bank_account_holder: document.getElementById('setInvBankHolder').value.trim(),
    bank_account_number: document.getElementById('setInvBankAccount').value.trim(),
    bank_routing_number: document.getElementById('setInvBankRouting').value.trim(),
    bank_account_type: document.getElementById('setInvBankType').value.trim()
  };
  const ok = await sbUpdateProfile(updates);
  if (!ok) return;
  CREATOR.invoiceNumbering = updates.invoice_numbering;
  CREATOR.invoicePrefix = updates.invoice_prefix;
  CREATOR.businessAddress = updates.business_address;
  CREATOR.bankName = updates.bank_name;
  CREATOR.bankAccountHolder = updates.bank_account_holder;
  CREATOR.bankAccountNumber = updates.bank_account_number;
  CREATOR.bankRoutingNumber = updates.bank_routing_number;
  CREATOR.bankAccountType = updates.bank_account_type;
}
