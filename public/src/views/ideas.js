// Arkives — Ideas view: a ruled notepad. The capture line is always ready
// at the top (Enter adds), every idea sits on its own rule, and editing
// happens in place on the line. No composer, no modal. Every line of text
// is exactly one rule tall (see .ideas-sheet in style.css), which is what
// keeps the text on the lines however much is written.
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

function _padActionsHTML(it) {
  // Two constant action names rather than one computed one: the static
  // guard in tests/checks.mjs reads data-action values from the source.
  const archiveBtn = it.archived
    ? `<button class="pad-archive" data-action="restoreIdea" data-args="${_args(it._sbId)}" title="Restore" aria-label="Restore idea">${RESTORE_SVG}</button>`
    : `<button class="pad-archive" data-action="archiveIdea" data-args="${_args(it._sbId)}" title="Archive" aria-label="Archive idea">${ARCHIVE_SVG}</button>`;
  return `<div class="pad-actions">${archiveBtn}<button class="pad-delete" data-action="deleteIdea" data-args="${_args(it._sbId)}" title="Delete" aria-label="Delete idea">&times;</button></div>`;
}

// The right end of a line: the date at rest, the actions on hover, focus
// or edit, in the same cell so nothing shifts and the column lines up
// with the Add button above it.
function _padEndHTML(it, meta) {
  return `<div class="pad-end">${meta ? `<span class="pad-date">${_esc(meta)}</span>` : ''}${_padActionsHTML(it)}</div>`;
}

function _padEntryHTML(it) {
  if (state._editingIdeaId === it._sbId && !it.archived) {
    return `
    <div class="pad-entry editing" data-id="${it._sbId}">
      <div class="pad-line">
        <textarea class="pad-input pad-edit-title" id="ideaEditTitle" rows="1" maxlength="500" aria-label="Idea" data-input="ideaEditGrow" data-input-args="[&quot;$el&quot;]" data-keydown="ideaEditKey" data-keydown-args="${_args('$event', it._sbId)}">${_esc(it.title)}</textarea>
        ${_padEndHTML(it, '')}
      </div>
      <div class="pad-notes-edit">
        <textarea class="pad-input pad-edit-notes" id="ideaEditNotes" rows="1" maxlength="5000" placeholder="Add notes" aria-label="Notes" data-input="ideaEditGrow" data-input-args="[&quot;$el&quot;]" data-keydown="ideaEditKey" data-keydown-args="${_args('$event', it._sbId)}">${_esc(it.notes)}</textarea>
      </div>
    </div>`;
  }
  const when = _ideaDateLabel(it.archived ? it.archivedAt : it.createdAt);
  const meta = it.archived ? (when ? 'Archived ' + when : 'Archived') : when;
  const editAttrs = it.archived ? '' : ` role="button" tabindex="0" data-action="openIdeaEdit" data-args="${_args(it._sbId)}" data-keydown="ideaLineKey" data-keydown-args="${_args('$event', it._sbId)}"`;
  const notesAttrs = it.archived ? '' : ` data-action="openIdeaEdit" data-args="${_args(it._sbId)}"`;
  return `
    <div class="pad-entry ${it.archived ? 'archived' : ''}" data-id="${it._sbId}">
      <div class="pad-line">
        <div class="pad-text"${editAttrs}>${_esc(it.title)}</div>
        ${_padEndHTML(it, meta)}
      </div>
      ${it.notes ? `<div class="pad-notes"${notesAttrs}>${_esc(it.notes)}</div>` : ''}
    </div>`;
}

// A textarea with no padding and a line-height of one rule grows in whole
// rules, so the sheet under it stays aligned. The title is a textarea too
// (not an input) so a long line wraps onto the next rule while editing,
// the way it does when it is not being edited; Enter still commits.
function _growTextarea(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function renderIdeas() {
  const container = document.getElementById('view-ideas');
  const firstPaint = !state._ideaPadMounted;
  state._ideaPadMounted = true;

  // Preserve typed text across re-renders: every store change rebuilds
  // this view's innerHTML, and what is on the capture line or in an open
  // edit must survive.
  const prevFocusId = document.activeElement ? document.activeElement.id : '';
  const prevCaptureEl = document.getElementById('ideaCapture');
  const prevCapture = prevCaptureEl ? prevCaptureEl.value : '';
  let prevEdit = null;
  if (state._editingIdeaId && document.getElementById('ideaEditTitle')) {
    prevEdit = {
      title: document.getElementById('ideaEditTitle').value,
      notes: document.getElementById('ideaEditNotes') ? document.getElementById('ideaEditNotes').value : ''
    };
  }

  const header = `
    <div class="view-header">
      <div><h1 class="view-title">Ideas</h1></div>
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

  // An edit in progress on an idea that is gone or archived ends now
  if (state._editingIdeaId) {
    const editing = ideas.find(state._editingIdeaId);
    if (!editing || editing.archived) state._editingIdeaId = null;
  }

  const active = state.IDEAS.filter(i => !i.archived).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  const archived = state.IDEAS.filter(i => i.archived).sort((a, b) =>
    (b.archivedAt || '').localeCompare(a.archivedAt || '')
  );

  container.innerHTML = header + `
    <div class="ideas-container">
      <div class="ideas-sheet">
        <div class="pad-capture">
          <input type="text" class="pad-input" id="ideaCapture" placeholder="What's the idea?" maxlength="500" autocomplete="off" aria-label="New idea" data-keydown="ideaCaptureKey" data-keydown-args="[&quot;$event&quot;]">
          <button class="pad-add" data-action="saveNewIdea" aria-label="Add idea">Add</button>
        </div>
        ${active.map(_padEntryHTML).join('')}
      </div>

      ${archived.length > 0 ? `
        <div class="ideas-archived">
          <button class="ideas-archived-toggle" data-action="toggleArchivedIdeas" aria-expanded="${state._ideasArchivedOpen}">
            <span class="ideas-archived-chevron ${state._ideasArchivedOpen ? 'open' : ''}">&#8250;</span>
            Archived (${archived.length})
          </button>
          ${state._ideasArchivedOpen ? `
            <div class="ideas-sheet ideas-sheet-archived">
              ${archived.map(_padEntryHTML).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;

  // Restore preserved input state after the rebuild
  const captureEl = document.getElementById('ideaCapture');
  if (captureEl && prevCapture) captureEl.value = prevCapture;
  const editTitleEl = document.getElementById('ideaEditTitle');
  const editNotesEl = document.getElementById('ideaEditNotes');
  if (prevEdit && editTitleEl) {
    editTitleEl.value = prevEdit.title;
    if (editNotesEl) editNotesEl.value = prevEdit.notes;
  }
  if (editTitleEl) _growTextarea(editTitleEl);
  if (editNotesEl) _growTextarea(editNotesEl);

  // Focus: an explicit request (after an add, opening an edit) wins; the
  // first paint focuses the capture line on pointer devices (a phone would
  // pop its keyboard over the list); otherwise put focus back where it was.
  let focusEl = null;
  if (state._ideaFocusPending) {
    focusEl = document.getElementById(state._ideaFocusPending);
    state._ideaFocusPending = null;
  } else if (firstPaint && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    focusEl = captureEl;
  } else if (['ideaCapture', 'ideaEditTitle', 'ideaEditNotes'].indexOf(prevFocusId) !== -1) {
    focusEl = document.getElementById(prevFocusId);
  }
  if (focusEl) {
    focusEl.focus();
    if (typeof focusEl.setSelectionRange === 'function') {
      const n = focusEl.value.length;
      try { focusEl.setSelectionRange(n, n); } catch (e) {}
    }
  }
}

/* ---- CAPTURE LINE ---- */
function ideaCaptureKey(ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); saveNewIdea(); }
}

async function saveNewIdea() {
  if (state._ideaSaving) return; // in-flight guard: double Enter / double click must not duplicate
  if (state._ideasTableMissing) { _showSaveError('Run migrations/022_ideas.sql in Supabase first'); return; }
  if (!state._sb || !state.CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  const input = document.getElementById('ideaCapture');
  if (!input) return;
  const title = input.value.trim();
  if (!title) { input.focus(); return; } // an empty Enter just keeps the caret on the line
  const row = await ideas.add({ title, notes: '' });
  if (!row) return;
  // Clear before re-render (the preserve logic would otherwise carry the
  // text over), then keep the caret on the line: ideas arrive in bunches
  const again = document.getElementById('ideaCapture');
  if (again) again.value = '';
  state._ideaFocusPending = 'ideaCapture';
  renderIdeas();
}

/* ---- INLINE EDIT ---- */
function openIdeaEdit(sbId) {
  if (state._ideaCommitting) return;
  const it = ideas.find(sbId);
  if (!it || it.archived) return;
  if (state._editingIdeaId && state._editingIdeaId !== sbId) _commitEditNow(state._editingIdeaId);
  state._editingIdeaId = sbId;
  state._ideaFocusPending = 'ideaEditTitle';
  renderIdeas();
}

function cancelIdeaEdit() {
  state._editingIdeaId = null;
  renderIdeas();
}

function _readEdit() {
  const t = document.getElementById('ideaEditTitle');
  const n = document.getElementById('ideaEditNotes');
  if (!t) return null;
  // The title is one line: a pasted newline becomes a space
  return { title: t.value.replace(/\s*\n\s*/g, ' ').trim(), notes: (n ? n.value : '').trim() };
}

// Commit on Enter, Cmd/Ctrl+Enter, or when focus leaves the entry.
async function commitIdeaEdit(sbId) {
  if (state._ideaCommitting || state._editingIdeaId !== sbId) return;
  const it = ideas.find(sbId);
  const edit = _readEdit();
  if (!it || !edit) { state._editingIdeaId = null; renderIdeas(); return; }
  if (!edit.title) {
    _showSaveError('Idea needs a line');
    state._ideaFocusPending = 'ideaEditTitle';
    renderIdeas();
    return;
  }
  if (edit.title === it.title && edit.notes === it.notes) { state._editingIdeaId = null; renderIdeas(); return; }
  state._ideaCommitting = true;
  try {
    const ok = await ideas.update(sbId, edit);
    if (ok) state._editingIdeaId = null;
  } finally {
    state._ideaCommitting = false;
  }
  renderIdeas();
}

// Fire-and-forget commit for the moments that cannot wait: leaving the
// view, or opening a second edit. An emptied line is dropped, not saved.
function _commitEditNow(sbId) {
  const it = ideas.find(sbId);
  const edit = _readEdit();
  state._editingIdeaId = null;
  if (!it || !edit || !edit.title) return;
  if (edit.title === it.title && edit.notes === it.notes) return;
  ideas.update(sbId, edit);
}

function ideaEditGrow(el) { _growTextarea(el); }

/* ---- ROW ACTIONS ---- The store owns the write policy (optimistic
   archive, undo-able delete); the mounted view re-renders through its
   store subscription. */
async function archiveIdea(sbId) {
  if (state._editingIdeaId === sbId) await commitIdeaEdit(sbId);
  return ideas.setArchived(sbId, true);
}
function restoreIdea(sbId) { return ideas.setArchived(sbId, false); }
function deleteIdea(sbId) {
  if (state._editingIdeaId === sbId) state._editingIdeaId = null;
  const undo = ideas.remove(sbId);
  if (undo) _showUndoToast('Idea deleted', undo);
}
function _flushIdeaDeletes() { ideas.flushDeletes(); }
// Leaving the view: an open edit is saved, pending deletes commit now.
function unmountIdeas() {
  if (state._editingIdeaId) _commitEditNow(state._editingIdeaId);
  ideas.flushDeletes();
  state._ideaPadMounted = false;
}
function toggleArchivedIdeas() {
  state._ideasArchivedOpen = !state._ideasArchivedOpen;
  renderIdeas();
}

/* ---- KEYBOARD HELPERS (delegated) ---- */
function ideaLineKey(ev, sbId) {
  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openIdeaEdit(sbId); }
}
// Enter commits from the title line. In the notes textarea Enter is a
// newline and Cmd/Ctrl+Enter commits. Escape cancels from either.
function ideaEditKey(ev, sbId) {
  if (ev.key === 'Escape') { ev.preventDefault(); cancelIdeaEdit(); return; }
  if (ev.key !== 'Enter') return;
  if (ev.target && ev.target.id === 'ideaEditNotes' && !(ev.metaKey || ev.ctrlKey)) return;
  ev.preventDefault();
  commitIdeaEdit(sbId);
}

/* ---- SIDE EFFECTS ---- Registered from main.js in a fixed order, not at import time. */
export function __init() {
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') _flushIdeaDeletes(); });
  window.addEventListener('pagehide', function() { _flushIdeaDeletes(); });
  // Focus leaving an entry being edited commits it (a tap elsewhere, Tab
  // away, the Add button). Moving between the title and the notes of the
  // same entry does not. Checked a tick later so the new focus is known.
  document.addEventListener('focusout', function(ev) {
    if (!state._editingIdeaId || state._ideaCommitting) return;
    const t = ev.target;
    if (!(t instanceof Element) || !t.closest('.pad-entry.editing')) return;
    setTimeout(function() {
      if (!state._editingIdeaId || state._ideaCommitting) return;
      const entry = document.querySelector('.pad-entry.editing');
      const cur = document.activeElement;
      if (entry && cur && entry.contains(cur)) return;
      commitIdeaEdit(state._editingIdeaId);
    }, 0);
  });
}

act({ archiveIdea, cancelIdeaEdit, commitIdeaEdit, deleteIdea, ideaCaptureKey, ideaEditGrow, ideaEditKey, ideaLineKey, openIdeaEdit, restoreIdea, saveNewIdea, toggleArchivedIdeas });

export { _flushIdeaDeletes, _ideaDateLabel, _padEntryHTML, archiveIdea, cancelIdeaEdit, commitIdeaEdit, deleteIdea, ideaCaptureKey, ideaEditGrow, ideaEditKey, ideaLineKey, openIdeaEdit, renderIdeas, restoreIdea, saveNewIdea, toggleArchivedIdeas, unmountIdeas };
