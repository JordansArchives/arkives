// Arkives — the tasks store. Owns state.TASKS and every write to it, with
// the policy each write needs: optimistic toggles that revert on failure,
// deletes that wait five seconds for an Undo, adds and edits that wait for
// the row. The view renders and reads inputs; it never touches db directly.
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { defineStore } from './_store.js';
import { profile } from './profile.js';

export const tasks = defineStore('tasks', {
  keys: ['TASKS', '_tasksTableMissing'],
  deps: [profile],
  fetch: () => db.sbFetchTasks(),
});

Object.assign(tasks, {
  find(id) { return state.TASKS.find((x) => x._sbId === id); },

  // Resolves to the new row, or null when nothing was added.
  async add({ title, details, dueDate }) {
    if (state._taskSaving) return null; // in-flight guard: double Enter / double click must not duplicate
    state._taskSaving = true;
    try {
      const row = await db.sbAddTask({ title, details, dueDate });
      if (!row) return null;
      state.TASKS.unshift({
        _sbId: row.id, title: row.title || title, details: row.details || '',
        dueDate: row.due_date || '', starred: !!row.starred, completed: !!row.completed,
        completedAt: row.completed_at || '',
        createdAt: row.created_at || new Date().toISOString()
      });
      tasks.notify();
      return row;
    } finally {
      state._taskSaving = false;
    }
  },

  // Pessimistic: the row changes only after the save succeeded.
  async update(id, { title, details, dueDate }) {
    const t = tasks.find(id);
    if (!t || state._taskBusyIds[id]) return false;
    state._taskBusyIds[id] = true;
    try {
      const ok = await db.sbUpdateTask(id, { title: title, details: details, due_date: dueDate || null });
      if (!ok) return false;
      t.title = title;
      t.details = details;
      t.dueDate = dueDate || '';
      tasks.notify();
      return true;
    } finally {
      delete state._taskBusyIds[id];
    }
  },

  // Optimistic: the checkbox flips now, the save follows; on failure it
  // flips back with the error toast. On a phone this is the difference
  // between "instant" and "laggy" for the most frequent action in the app.
  async toggleComplete(id) {
    const t = tasks.find(id);
    if (!t || state._taskBusyIds[id]) return;
    state._taskBusyIds[id] = true;
    const before = { completed: t.completed, completedAt: t.completedAt };
    const completed = !t.completed;
    const completedAt = completed ? new Date().toISOString() : null;
    t.completed = completed;
    t.completedAt = completedAt || '';
    tasks.notify();
    try {
      const ok = await db.sbUpdateTask(id, { completed: completed, completed_at: completedAt });
      if (!ok) { t.completed = before.completed; t.completedAt = before.completedAt; tasks.notify(); }
    } finally {
      delete state._taskBusyIds[id];
    }
  },

  async toggleStar(id) {
    const t = tasks.find(id);
    if (!t || state._taskBusyIds[id]) return;
    state._taskBusyIds[id] = true;
    const before = t.starred;
    t.starred = !t.starred;
    tasks.notify();
    try {
      const ok = await db.sbUpdateTask(id, { starred: t.starred });
      if (!ok) { t.starred = before; tasks.notify(); }
    } finally {
      delete state._taskBusyIds[id];
    }
  },

  // Removes the task now and commits the delete five seconds later.
  // Returns an undo() for the toast, or null when nothing was removed.
  remove(id) {
    const t = tasks.find(id);
    if (!t || state._taskBusyIds[id] || state._taskPendingDeletes[id]) return null;
    state.TASKS = state.TASKS.filter((x) => x._sbId !== id);
    tasks.notify();
    const pending = { task: t, timer: setTimeout(function () { tasks._commitDelete(id); }, 5000) };
    state._taskPendingDeletes[id] = pending;
    return function undo() {
      if (!state._taskPendingDeletes[id]) return;
      clearTimeout(pending.timer);
      delete state._taskPendingDeletes[id];
      state.TASKS.push(t);
      tasks.notify();
    };
  },

  async _commitDelete(id) {
    const pending = state._taskPendingDeletes[id];
    if (!pending) return;
    delete state._taskPendingDeletes[id];
    const ok = await db.sbDeleteTasks([id]);
    if (!ok) { state.TASKS.push(pending.task); tasks.notify(); }
  },

  // Fire every pending delete now: navigation, tab hidden, page unload.
  flushDeletes() {
    Object.keys(state._taskPendingDeletes).forEach(function (id) {
      clearTimeout(state._taskPendingDeletes[id].timer);
      tasks._commitDelete(id);
    });
  },

  async removeMany(ids) {
    if (state._taskSaving || !ids.length) return false;
    state._taskSaving = true;
    try {
      const ok = await db.sbDeleteTasks(ids);
      if (!ok) return false;
      // Prune by the ids actually deleted, not by completed-flag — a task
      // checked off while the delete was in flight must stay
      state.TASKS = state.TASKS.filter((t) => ids.indexOf(t._sbId) === -1);
      tasks.notify();
      return true;
    } finally {
      state._taskSaving = false;
    }
  },
});
