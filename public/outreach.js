/* ============================================================
   Arkives — Outreach view (Analytics → Outreach tab)
   Prospecting book: brands / companies / platforms /
   opportunities the user wants to work with. Custom lists rail +
   filterable table + right-side detail drawer with a projects
   (past work) editor.

   State (OUTREACH_TARGETS, OUTREACH_LISTS) and Supabase CRUD
   live in app.js; this file is view logic only. Loaded after
   app.js in index.html.
   ============================================================ */

/* ---- VIEW STATE ---- */
let _outSelectedList = 'all';   // 'all' | list _sbId
let _outTypeFilter = 'all';     // all | brand | company | platform | opportunity
let _outStatusFilter = 'all';   // all | not_contacted | contacted | in_talks | worked_together | passed
let _outSearch = '';            // matches name / website / pitch / notes
let _outSort = { key: 'name', dir: 1 };
let _outDrawerId = null;        // null = closed, '__new' = adding, else target _sbId
let _outDraft = null;           // working copy while the drawer is open
let _outDirty = false;          // unsaved edits in the drawer
let _outAddingList = false;     // inline new-list input open in the rail
let _outListEditingId = null;   // list _sbId being renamed inline

function resetOutreachViewState() {
  _outSelectedList = 'all'; _outTypeFilter = 'all'; _outStatusFilter = 'all';
  _outSearch = ''; _outSort = { key: 'name', dir: 1 };
  _outDrawerId = null; _outDraft = null; _outDirty = false;
  _outAddingList = false; _outListEditingId = null;
  _outSyncDrawer();
}

/* ---- LABELS ---- */
const OUT_TYPES = { brand: 'Brand', company: 'Company', platform: 'Platform', opportunity: 'Opportunity' };
const OUT_STATUSES = {
  not_contacted: 'Not contacted', contacted: 'Contacted', in_talks: 'In talks',
  worked_together: 'Worked together', passed: 'Passed'
};
const OUT_STATUS_ORDER = ['not_contacted', 'contacted', 'in_talks', 'worked_together', 'passed'];
const OUT_INITIATED = { none: '—', us: 'We reached out', them: 'They reached out' };
const OUT_INITIATED_SHORT = { none: '—', us: 'Us', them: 'Them' };

/* ---- HELPERS ---- */
function outMoney(n) {
  const v = Number(n) || 0;
  return (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
}

function outFmtShortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Sum of agreed rates across a target's projects
function outAgreedTotal(t) {
  return (t.projects || []).reduce((s, p) => s + (Number(p.rate) || 0), 0);
}

// Only ever emit http(s) hrefs, normalized so "nike.com" works
function outWebsiteHref(w) {
  const v = String(w || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z]+:/i.test(v)) return '';   // reject javascript:, data:, etc.
  return 'https://' + v;
}

function _outMigrationGuard() {
  if (_outreachMigrationMissing) {
    _showSaveError('Run migrations/012_outreach.sql in Supabase first');
    return true;
  }
  return false;
}

/* ---- MAIN RENDER ---- */
function renderOutreach() {
  const container = document.getElementById('view-outreach');

  const total = OUTREACH_TARGETS.length;
  const inTalks = OUTREACH_TARGETS.filter(t => t.status === 'in_talks').length;
  const worked = OUTREACH_TARGETS.filter(t => t.status === 'worked_together').length;
  const projectCount = OUTREACH_TARGETS.reduce((s, t) => s + (t.projects || []).length, 0);
  const agreedTotal = OUTREACH_TARGETS.reduce((s, t) => s + outAgreedTotal(t), 0);

  const setupCard = _outreachMigrationMissing ? `
    <div class="tasks-setup-card" style="margin-bottom:20px">
      <h3>One-time setup needed</h3>
      <p>The Outreach tables aren't in Supabase yet. Run <code>migrations/012_outreach.sql</code> in the Supabase SQL editor, then refresh this page.</p>
    </div>` : '';

  container.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="view-title">Outreach</h1>
        <p class="view-subtitle">Who you want to work with, and where it stands.</p>
      </div>
      <button class="btn btn-primary" onclick="outNew()">+ New Target</button>
    </div>

    ${setupCard}

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Targets</span>
        <span class="kpi-value">${total}</span>
        <span class="kpi-delta">${OUTREACH_LISTS.length} list${OUTREACH_LISTS.length === 1 ? '' : 's'}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">In Talks</span>
        <span class="kpi-value">${inTalks}</span>
        <span class="kpi-delta">${OUTREACH_TARGETS.filter(t => t.status === 'contacted').length} contacted</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Worked With</span>
        <span class="kpi-value">${worked}</span>
        <span class="kpi-delta up">${projectCount} project${projectCount === 1 ? '' : 's'}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Agreed Value</span>
        <span class="kpi-value">${outMoney(agreedTotal)}</span>
        <span class="kpi-delta">sum of agreed rates</span>
      </div>
    </div>

    <div class="out-layout">
      <aside class="out-rail card">${_outRailHTML()}</aside>
      <div class="out-main card">
        <div class="out-controls">
          <div class="out-chips">${_outChipsHTML()}</div>
          <div class="out-controls-right">
            <select class="out-status-filter" onchange="outSetStatusFilter(this.value)">
              <option value="all" ${_outStatusFilter === 'all' ? 'selected' : ''}>All statuses</option>
              ${OUT_STATUS_ORDER.map(s => `<option value="${s}" ${_outStatusFilter === s ? 'selected' : ''}>${OUT_STATUSES[s]}</option>`).join('')}
            </select>
            <input type="search" class="out-search" id="outSearch" placeholder="Search targets" value="${_esc(_outSearch)}" oninput="outSearchInput(this.value)">
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                ${_outThHTML('name', 'Name')}
                ${_outThHTML('type', 'Type')}
                ${_outThHTML('status', 'Status')}
                <th>Initiated</th>
                <th>Projects</th>
                ${_outThHTML('agreed', 'Agreed')}
                ${_outThHTML('updated', 'Updated')}
              </tr>
            </thead>
            <tbody id="outTbody">${_outRowsHTML()}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  _outSyncDrawer();
}

function _outThHTML(key, label) {
  const active = _outSort.key === key;
  const arrow = active ? (_outSort.dir === 1 ? ' ▲' : ' ▼') : '';
  return `<th class="out-th-sort ${active ? 'active' : ''}" onclick="outSortBy('${key}')">${label}<span class="out-sort-arrow">${arrow}</span></th>`;
}

/* ---- LISTS RAIL ---- */
function _outRailHTML() {
  const listRow = (l) => {
    if (_outListEditingId === l._sbId) {
      return `
        <div class="out-rail-item editing">
          <input type="text" id="outListRename" maxlength="100" value="${_esc(l.name)}"
            onkeydown="outRenameListKey(event, '${l._sbId}')" onclick="event.stopPropagation()">
          <button class="btn btn-sm" onclick="event.stopPropagation();outRenameList('${l._sbId}')">Save</button>
          <button class="btn btn-sm" onclick="event.stopPropagation();outCancelListEdit()">&times;</button>
        </div>`;
    }
    const count = OUTREACH_TARGETS.filter(t => (t.listIds || []).includes(l._sbId)).length;
    return `
      <div class="out-rail-item ${_outSelectedList === l._sbId ? 'active' : ''}" onclick="outSelectList('${l._sbId}')">
        <span class="out-rail-name">${_esc(l.name)}</span>
        <span class="out-rail-count">${count}</span>
        <span class="out-rail-actions" onclick="event.stopPropagation()">
          <button title="Rename list" onclick="outEditList('${l._sbId}')">✎</button>
          <button title="Delete list" onclick="outDeleteList('${l._sbId}')">${SKETCHY_ICONS.trash}</button>
        </span>
      </div>`;
  };

  return `
    <div class="out-rail-title">Lists</div>
    <div class="out-rail-item ${_outSelectedList === 'all' ? 'active' : ''}" onclick="outSelectList('all')">
      <span class="out-rail-name">All targets</span>
      <span class="out-rail-count">${OUTREACH_TARGETS.length}</span>
    </div>
    ${OUTREACH_LISTS.map(listRow).join('')}
    ${_outAddingList ? `
      <div class="out-rail-item editing">
        <input type="text" id="outNewListName" maxlength="100" placeholder="List name"
          onkeydown="outAddListKey(event)" onclick="event.stopPropagation()">
        <button class="btn btn-sm" onclick="outAddList()">Add</button>
        <button class="btn btn-sm" onclick="outHideAddList()">&times;</button>
      </div>` : `
      <button class="out-rail-add" onclick="outShowAddList()">${SKETCHY_ICONS.plus} New list</button>`}
  `;
}

function outSelectList(id) { _outSelectedList = id; renderOutreach(); }

function outShowAddList() {
  if (_outMigrationGuard()) return;
  _outAddingList = true;
  renderOutreach();
  const input = document.getElementById('outNewListName');
  if (input) input.focus();
}

function outHideAddList() { _outAddingList = false; renderOutreach(); }

function outAddListKey(e) {
  if (e.key === 'Enter') outAddList();
  if (e.key === 'Escape') outHideAddList();
}

async function outAddList() {
  const input = document.getElementById('outNewListName');
  const name = input ? input.value.trim() : '';
  if (!name) { _showSaveError('List needs a name'); return; }
  const row = await sbAddOutreachList(name, OUTREACH_LISTS.length);
  if (!row) return;
  OUTREACH_LISTS.push({ _sbId: row.id, name: row.name, sortOrder: row.sort_order || 0 });
  _outAddingList = false;
  renderOutreach();
}

function outEditList(id) {
  _outListEditingId = id;
  renderOutreach();
  const input = document.getElementById('outListRename');
  if (input) { input.focus(); input.select(); }
}

function outCancelListEdit() { _outListEditingId = null; renderOutreach(); }

function outRenameListKey(e, id) {
  if (e.key === 'Enter') outRenameList(id);
  if (e.key === 'Escape') outCancelListEdit();
}

async function outRenameList(id) {
  const input = document.getElementById('outListRename');
  const name = input ? input.value.trim() : '';
  if (!name) { _showSaveError('List needs a name'); return; }
  const ok = await sbUpdateOutreachList(id, { name: name });
  if (!ok) return;
  const l = OUTREACH_LISTS.find(x => x._sbId === id);
  if (l) l.name = name;
  _outListEditingId = null;
  renderOutreach();
}

async function outDeleteList(id) {
  const l = OUTREACH_LISTS.find(x => x._sbId === id);
  if (!l) return;
  const count = OUTREACH_TARGETS.filter(t => (t.listIds || []).includes(id)).length;
  if (!confirm('Delete list "' + l.name + '"? Its ' + count + ' target' + (count === 1 ? '' : 's') + ' stay in your book.')) return;
  const ok = await sbDeleteOutreachList(id);
  if (!ok) return;
  OUTREACH_LISTS = OUTREACH_LISTS.filter(x => x._sbId !== id);
  // Sweep membership off targets (DB rows keep a stale id otherwise)
  const affected = OUTREACH_TARGETS.filter(t => (t.listIds || []).includes(id));
  for (const t of affected) {
    t.listIds = t.listIds.filter(x => x !== id);
    sbUpdateOutreachTarget(t._sbId, { list_ids: t.listIds });
  }
  if (_outSelectedList === id) _outSelectedList = 'all';
  renderOutreach();
}

/* ---- FILTERS / TABLE ---- */
function _outChipsHTML() {
  const inList = _outSelectedList === 'all'
    ? OUTREACH_TARGETS
    : OUTREACH_TARGETS.filter(t => (t.listIds || []).includes(_outSelectedList));
  const plurals = { brand: 'Brands', company: 'Companies', platform: 'Platforms', opportunity: 'Opportunities' };
  const chips = [['all', 'All']].concat(Object.keys(OUT_TYPES).map(k => [k, plurals[k]]));
  return chips.map(([k, label]) => {
    const count = k === 'all' ? inList.length : inList.filter(t => t.type === k).length;
    return `<button class="out-chip ${_outTypeFilter === k ? 'active' : ''}" onclick="outSetType('${k}')">${label} <em>${count}</em></button>`;
  }).join('');
}

function _outFilteredRows() {
  let rows = OUTREACH_TARGETS;
  if (_outSelectedList !== 'all') rows = rows.filter(t => (t.listIds || []).includes(_outSelectedList));
  if (_outTypeFilter !== 'all') rows = rows.filter(t => t.type === _outTypeFilter);
  if (_outStatusFilter !== 'all') rows = rows.filter(t => t.status === _outStatusFilter);
  const q = _outSearch.trim().toLowerCase();
  if (q) {
    rows = rows.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.website.toLowerCase().includes(q) ||
      t.pitch.toLowerCase().includes(q) ||
      t.notes.toLowerCase().includes(q));
  }
  const dir = _outSort.dir;
  const key = _outSort.key;
  return rows.slice().sort((a, b) => {
    let cmp = 0;
    if (key === 'name') cmp = a.name.localeCompare(b.name);
    else if (key === 'type') cmp = a.type.localeCompare(b.type);
    else if (key === 'status') cmp = OUT_STATUS_ORDER.indexOf(a.status) - OUT_STATUS_ORDER.indexOf(b.status);
    else if (key === 'agreed') cmp = outAgreedTotal(a) - outAgreedTotal(b);
    else if (key === 'updated') cmp = String(a.updatedAt).localeCompare(String(b.updatedAt));
    return cmp * dir || a.name.localeCompare(b.name);
  });
}

function _outRowsHTML() {
  const rows = _outFilteredRows();
  if (!rows.length) {
    const msg = OUTREACH_TARGETS.length
      ? 'No targets match this view.'
      : 'No targets yet. Click "+ New Target" to add the first brand you want to work with.';
    return `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">${msg}</td></tr>`;
  }
  return rows.map(t => {
    const href = outWebsiteHref(t.website);
    const agreed = outAgreedTotal(t);
    return `
      <tr class="out-row" onclick="outOpen('${t._sbId}')">
        <td class="out-name-cell">
          <span style="font-weight:600">${_esc(t.name)}</span>
          ${href ? `<a class="out-link" href="${_esc(href)}" target="_blank" rel="noopener noreferrer" title="${_esc(href)}" onclick="event.stopPropagation()">${SKETCHY_ICONS.link}</a>` : ''}
        </td>
        <td>${OUT_TYPES[t.type] || t.type}</td>
        <td><span class="out-status ${t.status}">${OUT_STATUSES[t.status] || t.status}</span></td>
        <td>${OUT_INITIATED_SHORT[t.initiatedBy] || '—'}</td>
        <td>${(t.projects || []).length || '—'}</td>
        <td style="font-variant-numeric:tabular-nums">${agreed ? outMoney(agreed) : '—'}</td>
        <td style="color:var(--text-muted)">${outFmtShortDate(t.updatedAt)}</td>
      </tr>`;
  }).join('');
}

function outSetType(k) { _outTypeFilter = k; renderOutreach(); }
function outSetStatusFilter(v) { _outStatusFilter = v; renderOutreach(); }

function outSortBy(key) {
  if (_outSort.key === key) _outSort.dir = -_outSort.dir;
  else _outSort = { key: key, dir: 1 };
  renderOutreach();
}

// Only the tbody re-renders on search input so the field keeps focus
function outSearchInput(v) {
  _outSearch = v;
  const tb = document.getElementById('outTbody');
  if (tb) tb.innerHTML = _outRowsHTML();
}

/* ---- DETAIL DRAWER ----
   Mounts on <body>, not inside .main — .main is a lower stacking
   context than the sidebar, so overlays rendered in the view can
   never cover it regardless of z-index (same as the pay modal). */
function _outSyncDrawer() {
  let host = document.getElementById('outDrawerHost');
  if (!host) {
    if (!_outDrawerId) return;
    host = document.createElement('div');
    host.id = 'outDrawerHost';
    document.body.appendChild(host);
  }
  host.innerHTML = _outDrawerId ? _outDrawerHTML() : '';
}

function outNew() {
  if (_outMigrationGuard()) return;
  _outDrawerId = '__new';
  _outDraft = {
    name: '', type: _outTypeFilter === 'all' ? 'brand' : _outTypeFilter,
    website: '', pitch: '', status: 'not_contacted', initiatedBy: 'none',
    projects: [], notes: '',
    listIds: _outSelectedList === 'all' ? [] : [_outSelectedList]
  };
  _outDirty = false;
  _outSyncDrawer();
  const el = document.getElementById('outFieldName');
  if (el) el.focus();
}

function outOpen(sbId) {
  const t = OUTREACH_TARGETS.find(x => x._sbId === sbId);
  if (!t) return;
  _outDrawerId = sbId;
  _outDraft = {
    name: t.name, type: t.type, website: t.website, pitch: t.pitch,
    status: t.status, initiatedBy: t.initiatedBy,
    projects: (t.projects || []).map(p => ({
      name: p.name || '',
      budget: (p.budget === null || p.budget === undefined) ? '' : String(p.budget),
      rate: (p.rate === null || p.rate === undefined) ? '' : String(p.rate),
      notes: p.notes || ''
    })),
    notes: t.notes, listIds: (t.listIds || []).slice()
  };
  _outDirty = false;
  _outSyncDrawer();
}

function outClose() {
  if (_outDirty && !confirm('Discard unsaved changes?')) return;
  _outDrawerId = null; _outDraft = null; _outDirty = false;
  _outSyncDrawer();
}

function _outDrawerHTML() {
  const d = _outDraft;
  const isNew = _outDrawerId === '__new';
  const href = outWebsiteHref(d.website);
  return `
    <div class="out-drawer-backdrop" onclick="outClose()"></div>
    <aside class="out-drawer">
      <div class="out-drawer-head">
        <h2>${isNew ? 'New Target' : 'Edit Target'}</h2>
        <button class="out-drawer-close" onclick="outClose()" title="Close">&times;</button>
      </div>
      <div class="out-drawer-body">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="outFieldName" maxlength="200" placeholder="Nike" value="${_esc(d.name)}" oninput="outDraftField('name', this.value)">
        </div>
        <div class="out-field-row">
          <div class="form-group">
            <label>Type</label>
            <select onchange="outDraftField('type', this.value)">
              ${Object.entries(OUT_TYPES).map(([k, v]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select onchange="outDraftField('status', this.value)">
              ${OUT_STATUS_ORDER.map(s => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${OUT_STATUSES[s]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Website</label>
          <div class="out-site-row">
            <input type="text" maxlength="500" placeholder="nike.com" value="${_esc(d.website)}" oninput="outDraftField('website', this.value)">
            ${href ? `<a class="btn btn-sm" href="${_esc(href)}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}
          </div>
        </div>
        <div class="form-group">
          <label>Who initiated?</label>
          <div class="out-seg">
            ${['none', 'us', 'them'].map(k => `
              <button class="out-seg-btn ${d.initiatedBy === k ? 'active' : ''}" onclick="outDraftInitiated('${k}')">${OUT_INITIATED[k]}</button>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>What I want to work on with them</label>
          <textarea rows="3" maxlength="2000" placeholder="AI-animated launch spot for their spring campaign..." oninput="outDraftField('pitch', this.value)">${_esc(d.pitch)}</textarea>
        </div>
        <div class="form-group">
          <label>Lists</label>
          ${OUTREACH_LISTS.length ? `
            <div class="out-list-checks">
              ${OUTREACH_LISTS.map(l => `
                <label class="out-check">
                  <input type="checkbox" ${d.listIds.includes(l._sbId) ? 'checked' : ''} onchange="outDraftListToggle('${l._sbId}', this.checked)">
                  <span>${_esc(l.name)}</span>
                </label>`).join('')}
            </div>` : `<p class="out-hint">No lists yet — create one from the rail on the left.</p>`}
        </div>
        <div class="form-group">
          <label>Projects &amp; rates</label>
          <div class="out-projects">
            ${d.projects.map((p, i) => `
              <div class="out-proj-row">
                <input type="text" maxlength="200" placeholder="Project name" value="${_esc(p.name)}" oninput="outDraftProject(${i}, 'name', this.value)">
                <input type="number" step="any" min="0" placeholder="Budget" value="${_esc(p.budget)}" oninput="outDraftProject(${i}, 'budget', this.value)">
                <input type="number" step="any" min="0" placeholder="Agreed rate" value="${_esc(p.rate)}" oninput="outDraftProject(${i}, 'rate', this.value)">
                <button class="out-proj-remove" title="Remove project" onclick="outRemoveProject(${i})">${SKETCHY_ICONS.trash}</button>
                <input type="text" class="out-proj-notes" maxlength="500" placeholder="Notes (deliverables, timing...)" value="${_esc(p.notes)}" oninput="outDraftProject(${i}, 'notes', this.value)">
              </div>`).join('')}
            <button class="btn btn-sm" onclick="outAddProject()">${SKETCHY_ICONS.plus} Add project</button>
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea rows="3" maxlength="5000" placeholder="Contacts, context, anything else..." oninput="outDraftField('notes', this.value)">${_esc(d.notes)}</textarea>
        </div>
      </div>
      <div class="out-drawer-foot">
        ${isNew ? '<span></span>' : `<button class="btn out-delete-btn" onclick="outDelete()">Delete</button>`}
        <div class="gap-row">
          <button class="btn" onclick="outClose()">Cancel</button>
          <button class="btn btn-primary" onclick="outSave()">${isNew ? 'Add Target' : 'Save'}</button>
        </div>
      </div>
    </aside>`;
}

/* ---- DRAWER FIELD HANDLERS ---- */
function outDraftField(key, val) {
  if (!_outDraft) return;
  _outDraft[key] = val;
  _outDirty = true;
}

function outDraftInitiated(k) {
  if (!_outDraft) return;
  _outDraft.initiatedBy = k;
  _outDirty = true;
  _outSyncDrawer();
}

function outDraftListToggle(listId, checked) {
  if (!_outDraft) return;
  if (checked && !_outDraft.listIds.includes(listId)) _outDraft.listIds.push(listId);
  if (!checked) _outDraft.listIds = _outDraft.listIds.filter(x => x !== listId);
  _outDirty = true;
}

function outDraftProject(i, key, val) {
  if (!_outDraft || !_outDraft.projects[i]) return;
  _outDraft.projects[i][key] = val;
  _outDirty = true;
}

function outAddProject() {
  if (!_outDraft) return;
  _outDraft.projects.push({ name: '', budget: '', rate: '', notes: '' });
  _outDirty = true;
  _outSyncDrawer();
}

function outRemoveProject(i) {
  if (!_outDraft) return;
  _outDraft.projects.splice(i, 1);
  _outDirty = true;
  _outSyncDrawer();
}

/* ---- SAVE / DELETE ---- */
function _outNumOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function _outCleanProjects(projects) {
  return projects
    .filter(p => p.name.trim() || p.notes.trim() || p.budget !== '' || p.rate !== '')
    .map(p => ({
      name: p.name.trim(),
      budget: _outNumOrNull(p.budget),
      rate: _outNumOrNull(p.rate),
      notes: p.notes.trim()
    }));
}

async function outSave() {
  if (_outMigrationGuard() || !_outDraft) return;
  const name = _outDraft.name.trim();
  if (!name) { _showSaveError('Target needs a name'); return; }

  const payload = {
    name: name,
    type: _outDraft.type,
    website: _outDraft.website.trim(),
    pitch: _outDraft.pitch,
    status: _outDraft.status,
    initiated_by: _outDraft.initiatedBy,
    projects: _outCleanProjects(_outDraft.projects),
    notes: _outDraft.notes,
    list_ids: _outDraft.listIds
  };

  if (_outDrawerId === '__new') {
    const row = await sbAddOutreachTarget(payload);
    if (!row) return;
    OUTREACH_TARGETS.push(_mapOutreachRow(row));
  } else {
    const ok = await sbUpdateOutreachTarget(_outDrawerId, payload);
    if (!ok) return;
    const t = OUTREACH_TARGETS.find(x => x._sbId === _outDrawerId);
    if (t) {
      t.name = payload.name; t.type = payload.type; t.website = payload.website;
      t.pitch = payload.pitch; t.status = payload.status; t.initiatedBy = payload.initiated_by;
      t.projects = payload.projects; t.notes = payload.notes; t.listIds = payload.list_ids.slice();
      t.updatedAt = new Date().toISOString();
    }
  }
  _outDrawerId = null; _outDraft = null; _outDirty = false;
  renderOutreach();
}

async function outDelete() {
  if (!_outDrawerId || _outDrawerId === '__new') return;
  const t = OUTREACH_TARGETS.find(x => x._sbId === _outDrawerId);
  if (!t) return;
  if (!confirm('Delete "' + t.name + '" from your outreach book? This can\'t be undone.')) return;
  const ok = await sbDeleteOutreachTarget(t._sbId);
  if (!ok) return;
  OUTREACH_TARGETS = OUTREACH_TARGETS.filter(x => x._sbId !== t._sbId);
  _outDrawerId = null; _outDraft = null; _outDirty = false;
  renderOutreach();
}
