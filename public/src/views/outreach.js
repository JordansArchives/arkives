// Arkives — Outreach: prospecting targets and lists.
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { _args, act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { SKETCHY_ICONS } from '../lib/icons.js';
import { _mapOutreachRow } from '../lib/sb.js';
import { _showSaveError } from '../lib/toast.js';


function resetOutreachViewState() {
  state._outSelectedList = 'all'; state._outTypeFilter = 'all'; state._outStatusFilter = 'all';
  state._outSearch = ''; state._outSort = { key: 'name', dir: 1 };
  state._outDrawerId = null; state._outDraft = null; state._outDirty = false;
  state._outAddingList = false; state._outListEditingId = null;
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
  if (state._outreachMigrationMissing) {
    _showSaveError('Run migrations/012_outreach.sql in Supabase first');
    return true;
  }
  return false;
}

/* ---- MAIN RENDER ---- */
function renderOutreach() {
  const container = document.getElementById('view-outreach');

  const total = state.OUTREACH_TARGETS.length;
  const inTalks = state.OUTREACH_TARGETS.filter(t => t.status === 'in_talks').length;
  const worked = state.OUTREACH_TARGETS.filter(t => t.status === 'worked_together').length;
  const projectCount = state.OUTREACH_TARGETS.reduce((s, t) => s + (t.projects || []).length, 0);
  const agreedTotal = state.OUTREACH_TARGETS.reduce((s, t) => s + outAgreedTotal(t), 0);

  const setupCard = state._outreachMigrationMissing ? `
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
      <button class="btn btn-primary" data-action="outNew">+ New Target</button>
    </div>

    ${setupCard}

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Targets</span>
        <span class="kpi-value">${total}</span>
        <span class="kpi-delta">${state.OUTREACH_LISTS.length} list${state.OUTREACH_LISTS.length === 1 ? '' : 's'}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">In Talks</span>
        <span class="kpi-value">${inTalks}</span>
        <span class="kpi-delta">${state.OUTREACH_TARGETS.filter(t => t.status === 'contacted').length} contacted</span>
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
            <select class="out-status-filter" data-change="outSetStatusFilter" data-change-args="[&quot;$value&quot;]">
              <option value="all" ${state._outStatusFilter === 'all' ? 'selected' : ''}>All statuses</option>
              ${OUT_STATUS_ORDER.map(s => `<option value="${s}" ${state._outStatusFilter === s ? 'selected' : ''}>${OUT_STATUSES[s]}</option>`).join('')}
            </select>
            <input type="search" class="out-search" id="outSearch" placeholder="Search targets" value="${_esc(state._outSearch)}" data-input="outSearchInput" data-input-args="[&quot;$value&quot;]">
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
  const active = state._outSort.key === key;
  const arrow = active ? (state._outSort.dir === 1 ? ' ▲' : ' ▼') : '';
  return `<th class="out-th-sort ${active ? 'active' : ''}" data-action="outSortBy" data-args="${_args(key)}">${label}<span class="out-sort-arrow">${arrow}</span></th>`;
}

/* ---- LISTS RAIL ---- */
function _outRailHTML() {
  const listRow = (l) => {
    if (state._outListEditingId === l._sbId) {
      return `
        <div class="out-rail-item editing">
          <input type="text" id="outListRename" maxlength="100" value="${_esc(l.name)}"
            data-keydown="outRenameListKey" data-keydown-args="${_args('$event', l._sbId)}" data-action="stop" data-args="[&quot;$event&quot;]">
          <button class="btn btn-sm" data-action="outRenameList" data-args="${_args(l._sbId)}" data-stop>Save</button>
          <button class="btn btn-sm" data-action="outCancelListEdit" data-stop>&times;</button>
        </div>`;
    }
    const count = state.OUTREACH_TARGETS.filter(t => (t.listIds || []).includes(l._sbId)).length;
    return `
      <div class="out-rail-item ${state._outSelectedList === l._sbId ? 'active' : ''}" data-action="outSelectList" data-args="${_args(l._sbId)}">
        <span class="out-rail-name">${_esc(l.name)}</span>
        <span class="out-rail-count">${count}</span>
        <span class="out-rail-actions" data-action="stop" data-args="[&quot;$event&quot;]">
          <button title="Rename list" data-action="outEditList" data-args="${_args(l._sbId)}">✎</button>
          <button title="Delete list" data-action="outDeleteList" data-args="${_args(l._sbId)}">${SKETCHY_ICONS.trash}</button>
        </span>
      </div>`;
  };

  return `
    <div class="out-rail-title">Lists</div>
    <div class="out-rail-item ${state._outSelectedList === 'all' ? 'active' : ''}" data-action="outSelectList" data-args="[&quot;all&quot;]">
      <span class="out-rail-name">All targets</span>
      <span class="out-rail-count">${state.OUTREACH_TARGETS.length}</span>
    </div>
    ${state.OUTREACH_LISTS.map(listRow).join('')}
    ${state._outAddingList ? `
      <div class="out-rail-item editing">
        <input type="text" id="outNewListName" maxlength="100" placeholder="List name"
          data-keydown="outAddListKey" data-keydown-args="[&quot;$event&quot;]" data-action="stop" data-args="[&quot;$event&quot;]">
        <button class="btn btn-sm" data-action="outAddList">Add</button>
        <button class="btn btn-sm" data-action="outHideAddList">&times;</button>
      </div>` : `
      <button class="out-rail-add" data-action="outShowAddList">${SKETCHY_ICONS.plus} New list</button>`}
  `;
}

function outSelectList(id) { state._outSelectedList = id; renderOutreach(); }

function outShowAddList() {
  if (_outMigrationGuard()) return;
  state._outAddingList = true;
  renderOutreach();
  const input = document.getElementById('outNewListName');
  if (input) input.focus();
}

function outHideAddList() { state._outAddingList = false; renderOutreach(); }

function outAddListKey(e) {
  if (e.key === 'Enter') outAddList();
  if (e.key === 'Escape') outHideAddList();
}

async function outAddList() {
  const input = document.getElementById('outNewListName');
  const name = input ? input.value.trim() : '';
  if (!name) { _showSaveError('List needs a name'); return; }
  const row = await db.sbAddOutreachList(name, state.OUTREACH_LISTS.length);
  if (!row) return;
  state.OUTREACH_LISTS.push({ _sbId: row.id, name: row.name, sortOrder: row.sort_order || 0 });
  state._outAddingList = false;
  renderOutreach();
}

function outEditList(id) {
  state._outListEditingId = id;
  renderOutreach();
  const input = document.getElementById('outListRename');
  if (input) { input.focus(); input.select(); }
}

function outCancelListEdit() { state._outListEditingId = null; renderOutreach(); }

function outRenameListKey(e, id) {
  if (e.key === 'Enter') outRenameList(id);
  if (e.key === 'Escape') outCancelListEdit();
}

async function outRenameList(id) {
  const input = document.getElementById('outListRename');
  const name = input ? input.value.trim() : '';
  if (!name) { _showSaveError('List needs a name'); return; }
  const ok = await db.sbUpdateOutreachList(id, { name: name });
  if (!ok) return;
  const l = state.OUTREACH_LISTS.find(x => x._sbId === id);
  if (l) l.name = name;
  state._outListEditingId = null;
  renderOutreach();
}

async function outDeleteList(id) {
  const l = state.OUTREACH_LISTS.find(x => x._sbId === id);
  if (!l) return;
  const count = state.OUTREACH_TARGETS.filter(t => (t.listIds || []).includes(id)).length;
  if (!confirm('Delete list "' + l.name + '"? Its ' + count + ' target' + (count === 1 ? '' : 's') + ' stay in your book.')) return;
  const ok = await db.sbDeleteOutreachList(id);
  if (!ok) return;
  state.OUTREACH_LISTS = state.OUTREACH_LISTS.filter(x => x._sbId !== id);
  // Sweep membership off targets (DB rows keep a stale id otherwise)
  const affected = state.OUTREACH_TARGETS.filter(t => (t.listIds || []).includes(id));
  for (const t of affected) {
    t.listIds = t.listIds.filter(x => x !== id);
    db.sbUpdateOutreachTarget(t._sbId, { list_ids: t.listIds });
  }
  if (state._outSelectedList === id) state._outSelectedList = 'all';
  renderOutreach();
}

/* ---- FILTERS / TABLE ---- */
function _outChipsHTML() {
  const inList = state._outSelectedList === 'all'
    ? state.OUTREACH_TARGETS
    : state.OUTREACH_TARGETS.filter(t => (t.listIds || []).includes(state._outSelectedList));
  const plurals = { brand: 'Brands', company: 'Companies', platform: 'Platforms', opportunity: 'Opportunities' };
  const chips = [['all', 'All']].concat(Object.keys(OUT_TYPES).map(k => [k, plurals[k]]));
  return chips.map(([k, label]) => {
    const count = k === 'all' ? inList.length : inList.filter(t => t.type === k).length;
    return `<button class="out-chip ${state._outTypeFilter === k ? 'active' : ''}" data-action="outSetType" data-args="${_args(k)}">${label} <em>${count}</em></button>`;
  }).join('');
}

function _outFilteredRows() {
  let rows = state.OUTREACH_TARGETS;
  if (state._outSelectedList !== 'all') rows = rows.filter(t => (t.listIds || []).includes(state._outSelectedList));
  if (state._outTypeFilter !== 'all') rows = rows.filter(t => t.type === state._outTypeFilter);
  if (state._outStatusFilter !== 'all') rows = rows.filter(t => t.status === state._outStatusFilter);
  const q = state._outSearch.trim().toLowerCase();
  if (q) {
    rows = rows.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.website.toLowerCase().includes(q) ||
      t.pitch.toLowerCase().includes(q) ||
      t.notes.toLowerCase().includes(q));
  }
  const dir = state._outSort.dir;
  const key = state._outSort.key;
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
    const msg = state.OUTREACH_TARGETS.length
      ? 'No targets match this view.'
      : 'No targets yet. Click "+ New Target" to add the first brand you want to work with.';
    return `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">${msg}</td></tr>`;
  }
  return rows.map(t => {
    const href = outWebsiteHref(t.website);
    const agreed = outAgreedTotal(t);
    return `
      <tr class="out-row" data-action="outOpen" data-args="${_args(t._sbId)}">
        <td class="out-name-cell">
          <span style="font-weight:600">${_esc(t.name)}</span>
          ${href ? `<a class="out-link" href="${_esc(href)}" target="_blank" rel="noopener noreferrer" title="${_esc(href)}" data-action="stop" data-args="[&quot;$event&quot;]">${SKETCHY_ICONS.link}</a>` : ''}
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

function outSetType(k) { state._outTypeFilter = k; renderOutreach(); }
function outSetStatusFilter(v) { state._outStatusFilter = v; renderOutreach(); }

function outSortBy(key) {
  if (state._outSort.key === key) state._outSort.dir = -state._outSort.dir;
  else state._outSort = { key: key, dir: 1 };
  renderOutreach();
}

// Only the tbody re-renders on search input so the field keeps focus
function outSearchInput(v) {
  state._outSearch = v;
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
    if (!state._outDrawerId) return;
    host = document.createElement('div');
    host.id = 'outDrawerHost';
    document.body.appendChild(host);
  }
  host.innerHTML = state._outDrawerId ? _outDrawerHTML() : '';
}

function outNew() {
  if (_outMigrationGuard()) return;
  state._outDrawerId = '__new';
  state._outDraft = {
    name: '', type: state._outTypeFilter === 'all' ? 'brand' : state._outTypeFilter,
    website: '', pitch: '', status: 'not_contacted', initiatedBy: 'none',
    projects: [], notes: '',
    listIds: state._outSelectedList === 'all' ? [] : [state._outSelectedList]
  };
  state._outDirty = false;
  _outSyncDrawer();
  const el = document.getElementById('outFieldName');
  if (el) el.focus();
}

function outOpen(sbId) {
  const t = state.OUTREACH_TARGETS.find(x => x._sbId === sbId);
  if (!t) return;
  state._outDrawerId = sbId;
  state._outDraft = {
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
  state._outDirty = false;
  _outSyncDrawer();
}

function outClose() {
  if (state._outDirty && !confirm('Discard unsaved changes?')) return;
  state._outDrawerId = null; state._outDraft = null; state._outDirty = false;
  _outSyncDrawer();
}

function _outDrawerHTML() {
  const d = state._outDraft;
  const isNew = state._outDrawerId === '__new';
  const href = outWebsiteHref(d.website);
  return `
    <div class="out-drawer-backdrop" data-action="outClose"></div>
    <aside class="out-drawer">
      <div class="out-drawer-head">
        <h2>${isNew ? 'New Target' : 'Edit Target'}</h2>
        <button class="out-drawer-close" data-action="outClose" title="Close">&times;</button>
      </div>
      <div class="out-drawer-body">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="outFieldName" maxlength="200" placeholder="Nike" value="${_esc(d.name)}" data-input="outDraftField" data-input-args="[&quot;name&quot;,&quot;$value&quot;]">
        </div>
        <div class="out-field-row">
          <div class="form-group">
            <label>Type</label>
            <select data-change="outDraftField" data-change-args="[&quot;type&quot;,&quot;$value&quot;]">
              ${Object.entries(OUT_TYPES).map(([k, v]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select data-change="outDraftField" data-change-args="[&quot;status&quot;,&quot;$value&quot;]">
              ${OUT_STATUS_ORDER.map(s => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${OUT_STATUSES[s]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Website</label>
          <div class="out-site-row">
            <input type="text" maxlength="500" placeholder="nike.com" value="${_esc(d.website)}" data-input="outDraftField" data-input-args="[&quot;website&quot;,&quot;$value&quot;]">
            ${href ? `<a class="btn btn-sm" href="${_esc(href)}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}
          </div>
        </div>
        <div class="form-group">
          <label>Who initiated?</label>
          <div class="out-seg">
            ${['none', 'us', 'them'].map(k => `
              <button class="out-seg-btn ${d.initiatedBy === k ? 'active' : ''}" data-action="outDraftInitiated" data-args="${_args(k)}">${OUT_INITIATED[k]}</button>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>What I want to work on with them</label>
          <textarea rows="3" maxlength="2000" placeholder="AI-animated launch spot for their spring campaign..." data-input="outDraftField" data-input-args="[&quot;pitch&quot;,&quot;$value&quot;]">${_esc(d.pitch)}</textarea>
        </div>
        <div class="form-group">
          <label>Lists</label>
          ${state.OUTREACH_LISTS.length ? `
            <div class="out-list-checks">
              ${state.OUTREACH_LISTS.map(l => `
                <label class="out-check">
                  <input type="checkbox" ${d.listIds.includes(l._sbId) ? 'checked' : ''} data-change="outDraftListToggle" data-change-args="${_args(l._sbId, '$checked')}">
                  <span>${_esc(l.name)}</span>
                </label>`).join('')}
            </div>` : `<p class="out-hint">No lists yet — create one from the rail on the left.</p>`}
        </div>
        <div class="form-group">
          <label>Projects &amp; rates</label>
          <div class="out-projects">
            ${d.projects.map((p, i) => `
              <div class="out-proj-row">
                <input type="text" maxlength="200" placeholder="Project name" value="${_esc(p.name)}" data-input="outDraftProject" data-input-args="${_args(i, 'name', '$value')}">
                <input type="number" step="any" min="0" placeholder="Budget" value="${_esc(p.budget)}" data-input="outDraftProject" data-input-args="${_args(i, 'budget', '$value')}">
                <input type="number" step="any" min="0" placeholder="Agreed rate" value="${_esc(p.rate)}" data-input="outDraftProject" data-input-args="${_args(i, 'rate', '$value')}">
                <button class="out-proj-remove" title="Remove project" data-action="outRemoveProject" data-args="${_args(i)}">${SKETCHY_ICONS.trash}</button>
                <input type="text" class="out-proj-notes" maxlength="500" placeholder="Notes (deliverables, timing...)" value="${_esc(p.notes)}" data-input="outDraftProject" data-input-args="${_args(i, 'notes', '$value')}">
              </div>`).join('')}
            <button class="btn btn-sm" data-action="outAddProject">${SKETCHY_ICONS.plus} Add project</button>
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea rows="3" maxlength="5000" placeholder="Contacts, context, anything else..." data-input="outDraftField" data-input-args="[&quot;notes&quot;,&quot;$value&quot;]">${_esc(d.notes)}</textarea>
        </div>
      </div>
      <div class="out-drawer-foot">
        ${isNew ? '<span></span>' : `<button class="btn out-delete-btn" data-action="outDelete">Delete</button>`}
        <div class="gap-row">
          <button class="btn" data-action="outClose">Cancel</button>
          <button class="btn btn-primary" data-action="outSave">${isNew ? 'Add Target' : 'Save'}</button>
        </div>
      </div>
    </aside>`;
}

/* ---- DRAWER FIELD HANDLERS ---- */
function outDraftField(key, val) {
  if (!state._outDraft) return;
  state._outDraft[key] = val;
  state._outDirty = true;
}

function outDraftInitiated(k) {
  if (!state._outDraft) return;
  state._outDraft.initiatedBy = k;
  state._outDirty = true;
  _outSyncDrawer();
}

function outDraftListToggle(listId, checked) {
  if (!state._outDraft) return;
  if (checked && !state._outDraft.listIds.includes(listId)) state._outDraft.listIds.push(listId);
  if (!checked) state._outDraft.listIds = state._outDraft.listIds.filter(x => x !== listId);
  state._outDirty = true;
}

function outDraftProject(i, key, val) {
  if (!state._outDraft || !state._outDraft.projects[i]) return;
  state._outDraft.projects[i][key] = val;
  state._outDirty = true;
}

function outAddProject() {
  if (!state._outDraft) return;
  state._outDraft.projects.push({ name: '', budget: '', rate: '', notes: '' });
  state._outDirty = true;
  _outSyncDrawer();
}

function outRemoveProject(i) {
  if (!state._outDraft) return;
  state._outDraft.projects.splice(i, 1);
  state._outDirty = true;
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
  if (_outMigrationGuard() || !state._outDraft) return;
  const name = state._outDraft.name.trim();
  if (!name) { _showSaveError('Target needs a name'); return; }

  const payload = {
    name: name,
    type: state._outDraft.type,
    website: state._outDraft.website.trim(),
    pitch: state._outDraft.pitch,
    status: state._outDraft.status,
    initiated_by: state._outDraft.initiatedBy,
    projects: _outCleanProjects(state._outDraft.projects),
    notes: state._outDraft.notes,
    list_ids: state._outDraft.listIds
  };

  if (state._outDrawerId === '__new') {
    const row = await db.sbAddOutreachTarget(payload);
    if (!row) return;
    state.OUTREACH_TARGETS.push(_mapOutreachRow(row));
  } else {
    const ok = await db.sbUpdateOutreachTarget(state._outDrawerId, payload);
    if (!ok) return;
    const t = state.OUTREACH_TARGETS.find(x => x._sbId === state._outDrawerId);
    if (t) {
      t.name = payload.name; t.type = payload.type; t.website = payload.website;
      t.pitch = payload.pitch; t.status = payload.status; t.initiatedBy = payload.initiated_by;
      t.projects = payload.projects; t.notes = payload.notes; t.listIds = payload.list_ids.slice();
      t.updatedAt = new Date().toISOString();
    }
  }
  state._outDrawerId = null; state._outDraft = null; state._outDirty = false;
  renderOutreach();
}

async function outDelete() {
  if (!state._outDrawerId || state._outDrawerId === '__new') return;
  const t = state.OUTREACH_TARGETS.find(x => x._sbId === state._outDrawerId);
  if (!t) return;
  if (!confirm('Delete "' + t.name + '" from your outreach book? This can\'t be undone.')) return;
  const ok = await db.sbDeleteOutreachTarget(t._sbId);
  if (!ok) return;
  state.OUTREACH_TARGETS = state.OUTREACH_TARGETS.filter(x => x._sbId !== t._sbId);
  state._outDrawerId = null; state._outDraft = null; state._outDirty = false;
  renderOutreach();
}

act({ outAddList, outAddListKey, outAddProject, outCancelListEdit, outClose, outDelete, outDeleteList, outDraftField, outDraftInitiated, outDraftListToggle, outDraftProject, outEditList, outHideAddList, outNew, outOpen, outRemoveProject, outRenameList, outRenameListKey, outSave, outSearchInput, outSelectList, outSetStatusFilter, outSetType, outShowAddList, outSortBy });

export { OUT_INITIATED, OUT_INITIATED_SHORT, OUT_STATUSES, OUT_STATUS_ORDER, OUT_TYPES, _outChipsHTML, _outCleanProjects, _outDrawerHTML, _outFilteredRows, _outMigrationGuard, _outNumOrNull, _outRailHTML, _outRowsHTML, _outSyncDrawer, _outThHTML, outAddList, outAddListKey, outAddProject, outAgreedTotal, outCancelListEdit, outClose, outDelete, outDeleteList, outDraftField, outDraftInitiated, outDraftListToggle, outDraftProject, outEditList, outFmtShortDate, outHideAddList, outMoney, outNew, outOpen, outRemoveProject, outRenameList, outRenameListKey, outSave, outSearchInput, outSelectList, outSetStatusFilter, outSetType, outShowAddList, outSortBy, outWebsiteHref, renderOutreach, resetOutreachViewState };
