// Arkives — the ideas store. Owns state.IDEAS and every write to it, with
// the same policy shape as tasks: archive and restore flip now and revert
// on failure, deletes wait five seconds for an Undo, adds and edits wait
// for the row. The view renders and reads inputs; it never touches db.
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { defineStore } from './_store.js';
import { profile } from './profile.js';

export const ideas = defineStore('ideas', {
  keys: ['IDEAS', '_ideasTableMissing'],
  deps: [profile],
  fetch: () => db.sbFetchIdeas(),
});

Object.assign(ideas, {
  find(id) { return state.IDEAS.find((x) => x._sbId === id); },

  // Resolves to the new row, or null when nothing was added.
  async add({ title, notes }) {
    if (state._ideaSaving) return null; // in-flight guard: double Enter / double click must not duplicate
    state._ideaSaving = true;
    try {
      const row = await db.sbAddIdea({ title, notes });
      if (!row) return null;
      state.IDEAS.unshift({
        _sbId: row.id, title: row.title || title, notes: row.notes || notes || '',
        archived: !!row.archived, archivedAt: row.archived_at || '',
        createdAt: row.created_at || new Date().toISOString()
      });
      ideas.notify();
      return row;
    } finally {
      state._ideaSaving = false;
    }
  },

  // Pessimistic: the row changes only after the save succeeded.
  async update(id, { title, notes }) {
    const it = ideas.find(id);
    if (!it || state._ideaBusyIds[id]) return false;
    state._ideaBusyIds[id] = true;
    try {
      const ok = await db.sbUpdateIdea(id, { title: title, notes: notes });
      if (!ok) return false;
      it.title = title;
      it.notes = notes;
      ideas.notify();
      return true;
    } finally {
      delete state._ideaBusyIds[id];
    }
  },

  // Optimistic: the idea moves between Active and Archived now, the save
  // follows; on failure it moves back with the error toast.
  async setArchived(id, archived) {
    const it = ideas.find(id);
    if (!it || state._ideaBusyIds[id] || it.archived === archived) return;
    state._ideaBusyIds[id] = true;
    const before = { archived: it.archived, archivedAt: it.archivedAt };
    const archivedAt = archived ? new Date().toISOString() : null;
    it.archived = archived;
    it.archivedAt = archivedAt || '';
    ideas.notify();
    try {
      const ok = await db.sbUpdateIdea(id, { archived: archived, archived_at: archivedAt });
      if (!ok) { it.archived = before.archived; it.archivedAt = before.archivedAt; ideas.notify(); }
    } finally {
      delete state._ideaBusyIds[id];
    }
  },

  // Removes the idea now and commits the delete five seconds later.
  // Returns an undo() for the toast, or null when nothing was removed.
  remove(id) {
    const it = ideas.find(id);
    if (!it || state._ideaBusyIds[id] || state._ideaPendingDeletes[id]) return null;
    state.IDEAS = state.IDEAS.filter((x) => x._sbId !== id);
    ideas.notify();
    const pending = { idea: it, timer: setTimeout(function () { ideas._commitDelete(id); }, 5000) };
    state._ideaPendingDeletes[id] = pending;
    return function undo() {
      if (!state._ideaPendingDeletes[id]) return;
      clearTimeout(pending.timer);
      delete state._ideaPendingDeletes[id];
      state.IDEAS.push(it);
      ideas.notify();
    };
  },

  async _commitDelete(id) {
    const pending = state._ideaPendingDeletes[id];
    if (!pending) return;
    delete state._ideaPendingDeletes[id];
    const ok = await db.sbDeleteIdeas([id]);
    if (!ok) { state.IDEAS.push(pending.idea); ideas.notify(); }
  },

  // Fire every pending delete now: navigation, tab hidden, page unload.
  flushDeletes() {
    Object.keys(state._ideaPendingDeletes).forEach(function (id) {
      clearTimeout(state._ideaPendingDeletes[id].timer);
      ideas._commitDelete(id);
    });
  },
});
