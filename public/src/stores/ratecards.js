// Arkives — the rate cards store. Owns state.RATE_CARDS (brand cards,
// freelance role presets, freelance terms; migration 031) and every write
// to them. Pessimistic like quotes: state changes after Supabase confirmed
// the write. The view keeps the editor draft (state._rc).
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { defineStore } from './_store.js';
import { profile } from './profile.js';

export const ratecards = defineStore('ratecards', {
  keys: ['RATE_CARDS', '_rateCardsMigrationMissing'],
  deps: [profile],
  fetch: () => db.sbFetchRateCards(),
});

const _clone = (o) => JSON.parse(JSON.stringify(o || {}));

Object.assign(ratecards, {
  find(id) { return state.RATE_CARDS.find((r) => r._sbId === id); },
  ofKind(kind) { return state.RATE_CARDS.filter((r) => r.kind === kind); },

  // data: { kind, name, role, content }. Resolves to the new preset, or null.
  async add(data) {
    if (state._rcSaving) return null; // double click must not duplicate
    state._rcSaving = true;
    try {
      const sortOrder = state.RATE_CARDS.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
      const row = await db.sbAddRateCard({ kind: data.kind, name: data.name, role: data.role || null, content: _clone(data.content), sortOrder });
      if (!row) return null;
      const rc = {
        _sbId: row.id, kind: row.kind, name: row.name, role: row.role || null,
        content: row.content && typeof row.content === 'object' ? row.content : _clone(data.content),
        sortOrder: row.sort_order || sortOrder, updatedAt: row.updated_at || new Date().toISOString()
      };
      state.RATE_CARDS.push(rc);
      ratecards.notify();
      return rc;
    } finally {
      state._rcSaving = false;
    }
  },

  // data: { name, content }. silent skips the "Saved" toast.
  async save(id, data, silent) {
    const rc = ratecards.find(id);
    if (!rc) return false;
    const updates = { name: data.name, content: _clone(data.content) };
    const ok = await db.sbUpdateRateCard(id, updates, silent);
    if (!ok) return false;
    rc.name = updates.name;
    rc.content = updates.content;
    rc.updatedAt = new Date().toISOString();
    ratecards.notify();
    return true;
  },

  async remove(id) {
    const ok = await db.sbDeleteRateCard(id);
    if (!ok) return false;
    state.RATE_CARDS = state.RATE_CARDS.filter((r) => r._sbId !== id);
    ratecards.notify();
    return true;
  },
});
