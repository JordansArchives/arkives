// Arkives — Tasks view.
import { state } from '../state.js';
import { tasks } from '../stores/tasks.js';
import { _args, act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { fmtDate } from '../lib/format.js';
import { _showSaveError, _showUndoToast } from '../lib/toast.js';


// Local-calendar date, unlike todayISO() which is UTC — due dates come
// from <input type="date"> in the user's local calendar, so "Today"/
// overdue must compare in local time or they flip early every evening
function _localISODate(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _taskDueLabel(iso) {
  if (!iso) return '';
  const today = _localISODate();
  const t = new Date();
  t.setDate(t.getDate() + 1);
  const tomorrow = _localISODate(t);
  if (iso === today) return 'Today';
  if (iso === tomorrow) return 'Tomorrow';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  if (d.getFullYear() === new Date().getFullYear()) return fmtDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _taskRowHTML(t) {
  const dueLabel = _taskDueLabel(t.dueDate);
  const overdue = t.dueDate && !t.completed && t.dueDate < _localISODate();
  const starSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (t.starred ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.2l3 6.1 6.8 1-4.9 4.8 1.2 6.7-6.1-3.2-6.1 3.2 1.2-6.7-4.9-4.8 6.8-1z"/></svg>';
  const checkSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 12.3l5 5.2 10.6-11"/></svg>';
  const dueSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 4.2h17.6c.6 0 1.1.5 1.1 1.1v14.5c0 .6-.5 1.1-1.1 1.1H3.2c-.6 0-1.1-.5-1.1-1.1V5.3c0-.6.5-1.1 1.1-1.1z"/><path d="M16.1 2.1v4.1"/><path d="M8 2.1v4.1"/><path d="M2.1 10.1h19.8"/></svg>';
  return `
    <div class="task-item ${t.completed ? 'completed' : ''}" data-id="${t._sbId}">
      <button class="task-check" data-action="toggleTaskComplete" data-args="${_args(t._sbId)}" title="${t.completed ? 'Mark incomplete' : 'Mark complete'}" aria-label="${t.completed ? 'Mark incomplete' : 'Mark complete'}">${checkSvg}</button>
      <div class="task-body" role="button" tabindex="0" data-action="openEditTaskModal" data-args="${_args(t._sbId)}" data-keydown="taskRowKey" data-keydown-args="${_args('$event', t._sbId)}">
        <div class="task-title">${_esc(t.title)}</div>
        ${t.details ? `<div class="task-details">${_esc(t.details)}</div>` : ''}
        ${dueLabel ? `<span class="task-due ${overdue ? 'overdue' : ''}">${dueSvg} ${dueLabel}</span>` : ''}
      </div>
      <div class="task-item-actions">
        <button class="task-star ${t.starred ? 'active' : ''}" data-action="toggleTaskStar" data-args="${_args(t._sbId)}" title="${t.starred ? 'Unstar' : 'Star'}" aria-label="${t.starred ? 'Unstar' : 'Star'}">${starSvg}</button>
        <button class="task-delete" data-action="deleteTask" data-args="${_args(t._sbId)}" title="Delete" aria-label="Delete task">&times;</button>
      </div>
    </div>`;
}

function renderTasks() {
  const container = document.getElementById('view-tasks');

  // Preserve unsaved composer/modal input across re-renders — every task
  // mutation rebuilds this view's innerHTML, and typed text must survive
  const prevFocusId = document.activeElement ? document.activeElement.id : '';
  let prevComposer = null;
  if (state._taskComposerOpen && document.getElementById('taskNewTitle')) {
    prevComposer = {
      title: document.getElementById('taskNewTitle').value,
      details: document.getElementById('taskNewDetails').value,
      due: document.getElementById('taskNewDue').value
    };
  }
  let prevModal = null;
  const prevModalEl = document.getElementById('editTaskModal');
  if (state._editingTaskId && prevModalEl && prevModalEl.style.display !== 'none') {
    prevModal = {
      title: document.getElementById('etTitle').value,
      details: document.getElementById('etDetails').value,
      due: document.getElementById('etDue').value
    };
  }

  const header = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Tasks</h1>
        <p class="view-subtitle">Quick to-dos. Add it, check it off, move on.</p>
      </div>
      <div class="view-header-actions">
        <button class="btn btn-primary" data-action="openTaskComposer">+ Add Task</button>
      </div>
    </div>`;

  if (state._tasksTableMissing) {
    container.innerHTML = header + `
      <div class="tasks-container">
        <div class="tasks-setup-card">
          <h3>One-time setup needed</h3>
          <p>The tasks table doesn't exist in Supabase yet. Run <code>migrations/010_tasks.sql</code> in the Supabase SQL editor, then refresh this page.</p>
        </div>
      </div>`;
    return;
  }

  const active = state.TASKS.filter(t => !t.completed).sort((a, b) =>
    (b.starred - a.starred) ||
    ((a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')) ||
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  const done = state.TASKS.filter(t => t.completed).sort((a, b) =>
    (b.completedAt || '').localeCompare(a.completedAt || '')
  );

  container.innerHTML = header + `
    <div class="tasks-container">
      <div class="tasks-card">
        <div class="task-composer" id="taskComposer" style="display:${state._taskComposerOpen ? 'block' : 'none'}">
          <div class="form-group">
            <label for="taskNewTitle">Task</label>
            <input type="text" id="taskNewTitle" placeholder="What needs doing?" maxlength="500" data-keydown="taskComposerKey" data-keydown-args="[&quot;$event&quot;]">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="taskNewDetails">Details (optional)</label>
              <input type="text" id="taskNewDetails" placeholder="Any extra context" maxlength="2000" data-keydown="taskComposerKey" data-keydown-args="[&quot;$event&quot;]">
            </div>
            <div class="form-group">
              <label for="taskNewDue">Due date (optional)</label>
              <input type="date" id="taskNewDue" min="1900-01-01" max="9999-12-31">
            </div>
          </div>
          <div class="task-composer-actions">
            <button class="btn btn-secondary btn-sm" data-action="closeTaskComposer">Cancel</button>
            <button class="btn btn-primary btn-sm" data-action="saveNewTask">Add Task</button>
          </div>
        </div>

        ${active.length === 0 && done.length === 0 ? `
          <div class="dashboard-empty tasks-empty">
            <p>No tasks yet. Hit "+ Add Task" and get the first one down.</p>
          </div>
        ` : ''}

        <div class="task-list">
          ${active.map(_taskRowHTML).join('')}
        </div>

        ${done.length > 0 ? `
          <div class="tasks-completed">
            <button class="tasks-completed-toggle" data-action="toggleCompletedTasks" aria-expanded="${state._tasksCompletedOpen}">
              <span class="tasks-completed-chevron ${state._tasksCompletedOpen ? 'open' : ''}">&#8250;</span>
              Completed (${done.length})
            </button>
            ${state._tasksCompletedOpen ? `
              <button class="btn btn-ghost btn-sm tasks-clear-btn" data-action="clearCompletedTasks">Clear all</button>
              <div class="task-list task-list-completed">
                ${done.map(_taskRowHTML).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
  _ensureTaskModal();

  // Restore preserved input state after the rebuild
  if (prevComposer && state._taskComposerOpen && document.getElementById('taskNewTitle')) {
    document.getElementById('taskNewTitle').value = prevComposer.title;
    document.getElementById('taskNewDetails').value = prevComposer.details;
    document.getElementById('taskNewDue').value = prevComposer.due;
  }
  if (state._editingTaskId && !state.TASKS.some(t => t._sbId === state._editingTaskId)) state._editingTaskId = null;
  if (prevModal && state._editingTaskId) {
    document.getElementById('etTitle').value = prevModal.title;
    document.getElementById('etDetails').value = prevModal.details;
    document.getElementById('etDue').value = prevModal.due;
    document.getElementById('editTaskModal').style.display = 'flex';
  }
  if (state._taskComposerFocusPending) {
    state._taskComposerFocusPending = false;
    const titleEl = document.getElementById('taskNewTitle');
    if (titleEl) titleEl.focus();
  } else if (['taskNewTitle', 'taskNewDetails', 'taskNewDue', 'etTitle', 'etDetails', 'etDue'].indexOf(prevFocusId) !== -1) {
    const el = document.getElementById(prevFocusId);
    if (el) el.focus();
  }
}

// Body-mounted so it stacks above the sidebar (see _ensureCalendarModal)
function _ensureTaskModal() {
  if (document.getElementById('editTaskModal')) return;
  var host = document.createElement('div');
  host.id = 'taskModalHost';
  host.innerHTML = `
    <div class="modal-overlay" id="editTaskModal" style="display:none;" data-action="closeEditTaskModal" data-args="[&quot;$event&quot;,&quot;$el&quot;]">
      <div class="modal-card" data-action="stop" data-args="[&quot;$event&quot;]">
        <h3>Edit Task</h3>
        <div class="form-group">
          <label for="etTitle">Task</label>
          <input type="text" id="etTitle" maxlength="500" data-keydown="taskEditKey" data-keydown-args="[&quot;$event&quot;]">
        </div>
        <div class="form-group">
          <label for="etDetails">Details</label>
          <textarea id="etDetails" rows="3" maxlength="2000" placeholder="Any extra context"></textarea>
        </div>
        <div class="form-group">
          <label for="etDue">Due date</label>
          <input type="date" id="etDue" min="1900-01-01" max="9999-12-31">
        </div>
        <div class="settings-actions">
          <button class="btn btn-secondary" data-action="closeEditTaskModal">Cancel</button>
          <button class="btn btn-primary" data-action="saveTaskEdits">Save</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(host);
}

function openTaskComposer() {
  if (state._tasksTableMissing) { _showSaveError('Run migrations/010_tasks.sql in Supabase first'); return; }
  state._taskComposerOpen = true;
  state._taskComposerFocusPending = true;
  renderTasks();
}

function closeTaskComposer() {
  state._taskComposerOpen = false;
  renderTasks();
}

async function saveNewTask() {
  if (state._taskSaving) return; // in-flight guard: double Enter / double click must not duplicate
  if (!state._sb || !state.CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  const title = document.getElementById('taskNewTitle').value.trim();
  const details = document.getElementById('taskNewDetails').value.trim();
  const dueDate = document.getElementById('taskNewDue').value;
  if (!title) { _showSaveError('Task needs a title'); return; }
  const row = await tasks.add({ title, details, dueDate });
  if (!row) return;
  // Clear inputs before re-render (the preserve-state logic would
  // otherwise carry them over), then keep the composer open for
  // rapid entry, Google Tasks style
  document.getElementById('taskNewTitle').value = '';
  document.getElementById('taskNewDetails').value = '';
  document.getElementById('taskNewDue').value = '';
  state._taskComposerFocusPending = true;
  renderTasks();
}
// The store owns the write policy (optimistic toggles, undo-able delete);
// the mounted view re-renders through its store subscription.
function toggleTaskComplete(sbId) { return tasks.toggleComplete(sbId); }
function toggleTaskStar(sbId) { return tasks.toggleStar(sbId); }
function deleteTask(sbId) {
  const undo = tasks.remove(sbId);
  if (undo) _showUndoToast('Task deleted', undo);
}
function _flushTaskDeletes() { tasks.flushDeletes(); }
// Leaving the view: pending deletes commit now instead of five seconds from now.
function unmountTasks() { tasks.flushDeletes(); }
function toggleCompletedTasks() {
  state._tasksCompletedOpen = !state._tasksCompletedOpen;
  renderTasks();
}
async function clearCompletedTasks() {
  if (state._taskSaving) return;
  const ids = state.TASKS.filter(t => t.completed).map(t => t._sbId);
  if (!ids.length) return;
  if (!confirm('Delete all ' + ids.length + ' completed task' + (ids.length === 1 ? '' : 's') + '?')) return;
  await tasks.removeMany(ids);
}
function openEditTaskModal(sbId) {
  const t = state.TASKS.find(x => x._sbId === sbId);
  if (!t) return;
  state._editingTaskId = sbId;
  document.getElementById('etTitle').value = t.title;
  document.getElementById('etDetails').value = t.details;
  document.getElementById('etDue').value = t.dueDate || '';
  document.getElementById('editTaskModal').style.display = 'flex';
}

function closeEditTaskModal(event, el) {
  if (event && event.target !== (el || event.currentTarget)) return;
  state._editingTaskId = null;
  const m = document.getElementById('editTaskModal');
  if (m) m.style.display = 'none';
}

async function saveTaskEdits() {
  const t = tasks.find(state._editingTaskId);
  if (!t) { closeEditTaskModal(); return; }
  if (state._taskBusyIds[t._sbId]) return;
  const title = document.getElementById('etTitle').value.trim();
  const details = document.getElementById('etDetails').value.trim();
  const dueDate = document.getElementById('etDue').value;
  if (!title) { _showSaveError('Task needs a title'); return; }
  const ok = await tasks.update(t._sbId, { title, details, dueDate });
  if (!ok) return;
  state._editingTaskId = null;
  renderTasks();
}
/* ---- KEYBOARD HELPERS (delegated) ---- */
function taskRowKey(ev, sbId) {
  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openEditTaskModal(sbId); }
}
function taskComposerKey(ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); saveNewTask(); }
}
function taskEditKey(ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); saveTaskEdits(); }
}

/* ---- SIDE EFFECTS ---- Registered from main.js in a fixed order, not at import time. */
export function __init() {
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') _flushTaskDeletes(); });
  window.addEventListener('pagehide', function() { _flushTaskDeletes(); });
}

act({ clearCompletedTasks, closeEditTaskModal, closeTaskComposer, deleteTask, openEditTaskModal, openTaskComposer, saveNewTask, saveTaskEdits, taskComposerKey, taskEditKey, taskRowKey, toggleCompletedTasks, toggleTaskComplete, toggleTaskStar });

export { _ensureTaskModal, _flushTaskDeletes, _localISODate, _taskDueLabel, _taskRowHTML, clearCompletedTasks, closeEditTaskModal, closeTaskComposer, deleteTask, openEditTaskModal, openTaskComposer, renderTasks, saveNewTask, saveTaskEdits, taskComposerKey, taskEditKey, taskRowKey, toggleCompletedTasks, toggleTaskComplete, toggleTaskStar, unmountTasks };
