// Arkives — the timelines store. Owns state.TIMELINES and every write to
// it. Pessimistic like quotes: state changes after Supabase confirmed the
// write. The view keeps the editor draft (state._tl) and builds payloads.
import { state } from '../state.js';
import { db, _mapTimelineRow } from '../lib/sb.js';
import { defineStore } from './_store.js';
import { profile } from './profile.js';

export const timelines = defineStore('timelines', {
  keys: ['TIMELINES', '_timelinesMigrationMissing'],
  deps: [profile],
  fetch: () => db.sbFetchTimelines(),
});

Object.assign(timelines, {
  find(id) { return state.TIMELINES.find((t) => t._sbId === id); },
  // payload is the DB-shaped row; editingId null = insert. Resolves to the timeline, or null.
  async save(payload, editingId, silent) {
    if (editingId) {
      const ok = await db.sbUpdateTimeline(editingId, payload, silent);
      if (!ok) return null;
      const idx = state.TIMELINES.findIndex((t) => t._sbId === editingId);
      if (idx === -1) return null;
      const prev = state.TIMELINES[idx];
      state.TIMELINES[idx] = { ...prev, ..._pick(_mapTimelineRow({ id: editingId, ...payload }), payload) };
      timelines.notify();
      return state.TIMELINES[idx];
    }
    const row = await db.sbAddTimeline(payload);
    if (!row) return null;
    const t = _mapTimelineRow(row);
    state.TIMELINES.unshift(t);
    timelines.notify();
    return t;
  },
  async remove(id) {
    const ok = await db.sbDeleteTimeline(id);
    if (!ok) return false;
    state.TIMELINES = state.TIMELINES.filter((t) => t._sbId !== id);
    timelines.notify();
    return true;
  },
});

// Only the mapped fields whose DB column was in the payload
const COLS = {
  title: 'title', client_name: 'clientName', client_logo: 'clientLogo', from_name: 'fromName',
  from_logo: 'fromLogo', kickoff_date: 'kickoffDate', steps: 'steps', notes: 'notes', status: 'status',
};
function _pick(mapped, payload) {
  const out = { _sbId: mapped._sbId };
  Object.keys(payload).forEach((k) => { if (COLS[k]) out[COLS[k]] = mapped[COLS[k]]; });
  return out;
}
