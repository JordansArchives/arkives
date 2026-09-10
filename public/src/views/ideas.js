// Arkives — Ideas view. A quick-capture list for content, scripts, and
// whatever else: one line in, optional notes, archive it once it has been
// used. Archived ideas stay findable under a collapsed section.
import { state } from '../state.js';
import { ideas } from '../stores/ideas.js';
import { _args, act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { _showSaveError, _showUndoToast } from '../lib/toast.js';


// Timestamps come from Supabase as full ISO strings, unlike task due
// dates, so this reads them as instants and prints the local calendar day.
function _ideaDateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

const ARCHIVE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.3 7.1h17.4v2.8H3.3z"/><path d="M4.6 9.9v9.7c0 .7.5 1.2 1.2 1.2h12.4c.7 0 1.2-.5 1.2-1.2V9.9"/><path d="M9.9 13.6h4.2"/></svg>';
const RESTORE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.3 7.1h17.4v2.8H3.3z"/><path d="M4.6 9.9v9.7c0 .7.5 1.2 1.2 1.2h12.4c.7 0 1.2-.5 1.2-1.2V9.9"/><path d="M12 18.1v-6"/><path d="M9.4 14.6l2.6-2.5 2.6 2.5"/></svg>';

function _ideaRowHTML(it) {
  const when = _ideaDateLabel(it.archived ? it.archivedAt : it.createdAt);
  const meta = it.archived ? (when ? 'Archived ' + when : 'Archived') : when;
  // Two constant action names rather than one computed one: the static
  // guard in tests/checks.mjs reads data-action values from the source.
  const archiveBtn = it.archived
    ? `<button class="idea-archive" data-action="restoreIdea" data-args="${_args(it._sbId)}" title="Restore" aria-label="Restore idea">${RESTORE_SVG}</button>`
    : `<button class="idea-archive" data-action="archiveIdea" data-args="${_args(it._sbId)}" title="Archive" aria-label="Archive idea">${ARCHIVE_SVG}</button>`;
  return `
    <div class="idea-item ${it.archived ? 'archived' : ''}" data-id="${it._sbId}">
      <div class="idea-body" role="button" tabindex="0" data-action="openEditIdeaModal" data-args="${_args(it._sbId)}" data-keydown="ideaRowKey" data-keydown-args="${_args('$event', it._sbId)}">
        <div class="idea-title">${_esc(it.title)}</div>
        ${it.notes ? `<div class="idea-notes">${_esc(it.notes)}</div>` : ''}
        ${meta ? `<span class="idea-meta">${_esc(meta)}</span>` : ''}
      </div>
      <div class="idea-item-actions">
        ${archiveBtn}
        <button class="idea-delete" data-action="deleteIdea" data-args="${_args(it._sbId)}" title="Delete" aria-label="Delete idea">&times;</button>
      </div>
    </div>`;
}

function renderIdeas() {
  const container = document.getElementById('view-ideas');

  // Preserve unsaved composer/modal input across re-renders — every idea
  // mutation rebuilds this view's innerHTML, and typed text must survive
  const prevFocusId = document.activeElement ? document.activeElement.id : '';
  let prevComposer = null;
  if (state._ideaComposerOpen && document.getElementById('ideaNewTitle')) {
    prevComposer = {
      title: document.getElementById('ideaNewTitle').value,
      notes: document.getElementById('ideaNewNotes').value
    };
  }
  let prevModal = null;
  const prevModalEl = document.getElementById('editIdeaModal');
  if (state._editingIdeaId && prevModalEl && prevModalEl.style.display !== 'none') {
    prevModal = {
      title: document.getElementById('eiTitle').value,
      notes: document.getElementById('eiNotes').value
    };
  }

  const header = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Ideas</h1>
        <p class="view-subtitle">Quick captures. Get it down now, sort it out later.</p>
      </div>
      <div class="view-header-actions">
        <button class="btn btn-primary" data-action="openIdeaComposer">+ Add Idea</button>
      </div>
    </div>`;

  if (state._ideasTableMissing) {
    container.innerHTML = header + `
      <div class="ideas-container">
        <div class="tasks-setup-card">
          <h3>One-time setup needed</h3>
          <p>The ideas table doesn't exist in Supabase yet. Run <code>migrations/022_ideas.sql</code> in the Supabase SQL editor, then refresh this page.</p>
        </div>
      </div>`;
    return;
  }

  const active = state.IDEAS.filter(i => !i.archived).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  const archived = state.IDEAS.filter(i => i.archived).sort((a, b) =>
    (b.archivedAt || '').localeCompare(a.archivedAt || '')
  );

  container.innerHTML = header + `
    <div class="ideas-container">
      <div class="ideas-card">
        <div class="idea-composer" id="ideaComposer" style="display:${state._ideaComposerOpen ? 'block' : 'none'}">
          <div class="form-group">
            <label for="ideaNewTitle">Idea</label>
            <input type="text" id="ideaNewTitle" placeholder="What's the idea?" maxlength="500" data-keydown="ideaComposerKey" data-keydown-args="[&quot;$event&quot;]">
          </div>
          <div class="form-group">
            <label for="ideaNewNotes">Notes (optional)</label>
            <textarea id="ideaNewNotes" rows="3" maxlength="5000" placeholder="Hook, angle, reference, whatever you need to remember" data-keydown="ideaComposerKey" data-keydown-args="[&quot;$event&quot;]"></textarea>
          </div>
          <div class="idea-composer-actions">
            <span class="idea-composer-hint">Enter adds it. From notes, &#8984;/Ctrl+Enter.</span>
            <button class="btn btn-secondary btn-sm" data-action="closeIdeaComposer">Cancel</button>
            <button class="btn btn-primary btn-sm" data-action="saveNewIdea">Add Idea</button>
          </div>
        </div>

        ${active.length === 0 && archived.length === 0 ? `
          <div class="dashboard-empty ideas-empty">
            <p>No ideas yet. Next time one hits, get it down before it's gone.</p>
          </div>
        ` : ''}

        <div class="idea-list">
          ${active.map(_ideaRowHTML).join('')}
        </div>

        ${archived.length > 0 ? `
          <div class="ideas-archived">
            <button class="ideas-archived-toggle" data-action="toggleArchivedIdeas" aria-expanded="${state._ideasArchivedOpen}">
              <span class="ideas-archived-chevron ${state._ideasArchivedOpen ? 'open' : ''}">&#8250;</span>
              Archived (${archived.length})
            </button>
            ${state._ideasArchivedOpen ? `
              <div class="idea-list idea-list-archived">
                ${archived.map(_ideaRowHTML).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
  _ensureIdeaModal();

  // Restore preserved input state after the rebuild
  if (prevComposer && state._ideaComposerOpen && document.getElementById('ideaNewTitle')) {
    document.getElementById('ideaNewTitle').value = prevComposer.title;
    document.getElementById('ideaNewNotes').value = prevComposer.notes;
  }
  if (state._editingIdeaId && !state.IDEAS.some(i => i._sbId === state._editingIdeaId)) state._editingIdeaId = null;
  if (prevModal && state._editingIdeaId) {
    document.getElementById('eiTitle').value = prevModal.title;
    document.getElementById('eiNotes').value = prevModal.notes;
    document.getElementById('editIdeaModal').style.display = 'flex';
  }
  if (state._ideaComposerFocusPending) {
    state._ideaComposerFocusPending = false;
    const titleEl = document.getElementById('ideaNewTitle');
    if (titleEl) titleEl.focus();
  } else if (['ideaNewTitle', 'ideaNewNotes', 'eiTitle', 'eiNotes'].indexOf(prevFocusId) !== -1) {
    const el = document.getElementById(prevFocusId);
    if (el) el.focus();
  }
}

// Body-mounted so it stacks above the sidebar (see _ensureTaskModal)
function _ensureIdeaModal() {
  if (document.getElementById('editIdeaModal')) return;
  var host = document.createElement('div');
  host.id = 'ideaModalHost';
  host.innerHTML = `
    <div class="modal-overlay" id="editIdeaModal" style="display:none;" data-action="closeEditIdeaModal" data-args="[&quot;$event&quot;,&quot;$el&quot;]">
      <div class="modal-card" data-action="stop" data-args="[&quot;$event&quot;]">
        <h3>Edit Idea</h3>
        <div class="form-group">
          <label for="eiTitle">Idea</label>
          <input type="text" id="eiTitle" maxlength="500" data-keydown="ideaEditKey" data-keydown-args="[&quot;$event&quot;]">
        </div>
        <div class="form-group">
          <label for="eiNotes">Notes</label>
          <textarea id="eiNotes" rows="6" maxlength="5000" placeholder="Hook, angle, reference, whatever you need to remember" data-keydown="ideaEditKey" data-keydown-args="[&quot;$event&quot;]"></textarea>
        </div>
        <div class="settings-actions">
          <button class="btn btn-secondary" data-action="closeEditIdeaModal">Cancel</button>
          <button class="btn btn-primary" data-action="saveIdeaEdits">Save</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(host);
}

function openIdeaComposer() {
  if (state._ideasTableMissing) { _showSaveError('Run migrations/022_ideas.sql in Supabase first'); return; }
  state._ideaComposerOpen = true;
  state._ideaComposerFocusPending = true;
  renderIdeas();
}

function closeIdeaComposer() {
  state._ideaComposerOpen = false;
  renderIdeas();
}

async function saveNewIdea() {
  if (state._ideaSaving) return; // in-flight guard: double Enter / double click must not duplicate
  if (!state._sb || !state.CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  const title = document.getElementById('ideaNewTitle').value.trim();
  const notes = document.getElementById('ideaNewNotes').value.trim();
  if (!title) { _showSaveError('Idea needs a line'); return; }
  const row = await ideas.add({ title, notes });
  if (!row) return;
  // Clear inputs before re-render (the preserve-state logic would
  // otherwise carry them over), then keep the composer open for
  // rapid entry: ideas tend to arrive in bunches
  document.getElementById('ideaNewTitle').value = '';
  document.getElementById('ideaNewNotes').value = '';
  state._ideaComposerFocusPending = true;
  renderIdeas();
}
// The store owns the write policy (optimistic archive, undo-able delete);
// the mounted view re-renders through its store subscription.
function archiveIdea(sbId) { return ideas.setArchived(sbId, true); }
function restoreIdea(sbId) { return ideas.setArchived(sbId, false); }
function deleteIdea(sbId) {
  const undo = ideas.remove(sbId);
  if (undo) _showUndoToast('Idea deleted', undo);
}
function _flushIdeaDeletes() { ideas.flushDeletes(); }
// Leaving the view: pending deletes commit now instead of five seconds from now.
function unmountIdeas() { ideas.flushDeletes(); }
function toggleArchivedIdeas() {
  state._ideasArchivedOpen = !state._ideasArchivedOpen;
  renderIdeas();
}
function openEditIdeaModal(sbId) {
  const it = ideas.find(sbId);
  if (!it) return;
  state._editingIdeaId = sbId;
  document.getElementById('eiTitle').value = it.title;
  document.getElementById('eiNotes').value = it.notes;
  document.getElementById('editIdeaModal').style.display = 'flex';
}

function closeEditIdeaModal(event, el) {
  if (event && event.target !== (el || event.currentTarget)) return;
  state._editingIdeaId = null;
  const m = document.getElementById('editIdeaModal');
  if (m) m.style.display = 'none';
}

async function saveIdeaEdits() {
  const it = ideas.find(state._editingIdeaId);
  if (!it) { closeEditIdeaModal(); return; }
  if (state._ideaBusyIds[it._sbId]) return;
  const title = document.getElementById('eiTitle').value.trim();
  const notes = document.getElementById('eiNotes').value.trim();
  if (!title) { _showSaveError('Idea needs a line'); return; }
  const ok = await ideas.update(it._sbId, { title, notes });
  if (!ok) return;
  closeEditIdeaModal();
  renderIdeas();
}
/* ---- KEYBOARD HELPERS (delegated) ----
   Enter submits from the one-line field. In a notes textarea Enter is a
   newline, and Cmd/Ctrl+Enter submits. */
function _submitKey(ev) {
  if (ev.key !== 'Enter') return false;
  if (ev.target && ev.target.tagName === 'TEXTAREA' && !(ev.metaKey || ev.ctrlKey)) return false;
  return true;
}
function ideaRowKey(ev, sbId) {
  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openEditIdeaModal(sbId); }
}
function ideaComposerKey(ev) {
  if (_submitKey(ev)) { ev.preventDefault(); saveNewIdea(); }
}
function ideaEditKey(ev) {
  if (_submitKey(ev)) { ev.preventDefault(); saveIdeaEdits(); }
}

/* ---- SIDE EFFECTS ---- Registered from main.js in a fixed order, not at import time. */
export function __init() {
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') _flushIdeaDeletes(); });
  window.addEventListener('pagehide', function() { _flushIdeaDeletes(); });
}

act({ archiveIdea, closeEditIdeaModal, closeIdeaComposer, deleteIdea, ideaComposerKey, ideaEditKey, ideaRowKey, openEditIdeaModal, openIdeaComposer, restoreIdea, saveIdeaEdits, saveNewIdea, toggleArchivedIdeas });

export { _ensureIdeaModal, _flushIdeaDeletes, _ideaDateLabel, _ideaRowHTML, archiveIdea, closeEditIdeaModal, closeIdeaComposer, deleteIdea, ideaComposerKey, ideaEditKey, ideaRowKey, openEditIdeaModal, openIdeaComposer, renderIdeas, restoreIdea, saveIdeaEdits, saveNewIdea, toggleArchivedIdeas, unmountIdeas };
