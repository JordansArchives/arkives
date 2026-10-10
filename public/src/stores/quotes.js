// Arkives — the quotes store. Owns state.QUOTES and state.QUOTE_SERVICES
// (the saved service menu) and every write to them. Pessimistic like the
// invoices store: state changes after Supabase confirmed the write. The
// view keeps the editor draft (state._q) and builds the DB payloads.
import { state } from '../state.js';
import { db, _mapQuoteRow, _mapQuoteServiceRow } from '../lib/sb.js';
import { defineStore } from './_store.js';
import { profile } from './profile.js';

export const quotes = defineStore('quotes', {
  keys: ['QUOTES', 'QUOTE_SERVICES', '_quotesMigrationMissing'],
  deps: [profile],
  fetch: () => db.sbFetchQuotes(),
});

Object.assign(quotes, {
  find(id) { return state.QUOTES.find((q) => q._sbId === id); },
  // payload is the DB-shaped row; editingId null = insert. Resolves to the quote, or null.
  async save(payload, editingId) {
    if (editingId) {
      const ok = await db.sbUpdateQuote(editingId, payload);
      if (!ok) return null;
      const idx = state.QUOTES.findIndex((q) => q._sbId === editingId);
      if (idx === -1) return null;
      const prev = state.QUOTES[idx];
      // The payload carries no lifecycle columns it did not change; keep them
      state.QUOTES[idx] = { ...prev, ..._pick(_mapQuoteRow({ id: editingId, ...payload }), payload) };
      quotes.notify();
      return state.QUOTES[idx];
    }
    const row = await db.sbAddQuote(payload);
    if (!row) return null;
    const q = _mapQuoteRow(row);
    state.QUOTES.unshift(q);
    quotes.notify();
    return q;
  },
  // updates: DB-shaped. silent skips the "Saved" toast (bookkeeping writes).
  async patch(id, updates, silent) {
    const q = quotes.find(id);
    if (!q) return false;
    const ok = await db.sbUpdateQuote(id, updates, silent);
    if (!ok) return false;
    Object.assign(q, _pick(_mapQuoteRow({ id, ...updates }), updates));
    quotes.notify();
    return true;
  },
  async remove(id) {
    const ok = await db.sbDeleteQuote(id);
    if (!ok) return false;
    state.QUOTES = state.QUOTES.filter((q) => q._sbId !== id);
    quotes.notify();
    return true;
  },

  /* ---- the service menu ---- */
  findService(id) { return state.QUOTE_SERVICES.find((s) => s._sbId === id); },
  // data: { name, description, unit, rate (number|null) }
  async addService(data) {
    const sortOrder = state.QUOTE_SERVICES.reduce((m, s) => Math.max(m, s.sortOrder), 0) + 1;
    const row = await db.sbAddQuoteService({ name: data.name, description: data.description || '', unit: data.unit || 'flat', rate: data.rate, sort_order: sortOrder });
    if (!row) return null;
    const svc = _mapQuoteServiceRow(row);
    state.QUOTE_SERVICES.push(svc);
    quotes.notify();
    return svc;
  },
  async updateService(id, data) {
    const ok = await db.sbUpdateQuoteService(id, { name: data.name, description: data.description || '', unit: data.unit || 'flat', rate: data.rate });
    if (!ok) return false;
    const s = quotes.findService(id);
    if (s) Object.assign(s, { name: data.name, description: data.description || '', unit: data.unit || 'flat', rate: data.rate });
    quotes.notify();
    return true;
  },
  async removeService(id) {
    const ok = await db.sbDeleteQuoteService(id);
    if (!ok) return false;
    state.QUOTE_SERVICES = state.QUOTE_SERVICES.filter((s) => s._sbId !== id);
    quotes.notify();
    return true;
  },
});

// The mapped fields whose columns appear in `payload` (so a partial
// update never resets the rest of the quote to mapper defaults)
const COLS = {
  client_id: 'clientId', invoice_id: 'invoiceId', quote_number: 'quoteNumber', title: 'title',
  client_name: 'clientName', client_company: 'clientCompany', client_email: 'clientEmail', client_address: 'clientAddress',
  from_name: 'fromName', from_email: 'fromEmail', from_address: 'fromAddress',
  scope: 'scope', timeline: 'timeline', exclusions: 'exclusions', line_items: 'lineItems', total: 'total',
  deposit_pct: 'depositPct', balance_terms: 'balanceTerms', revision_rounds: 'revisionRounds', usage_rights: 'usageRights',
  notes: 'notes', issue_date: 'issueDate', valid_until: 'validUntil', status: 'status', sent_at: 'sentAt',
  viewed_at: 'viewedAt', responded_at: 'respondedAt', accepted_name: 'acceptedName', decline_reason: 'declineReason',
  response_seen: 'responseSeen',
};
function _pick(mapped, payload) {
  const out = {};
  for (const col of Object.keys(payload)) if (COLS[col]) out[COLS[col]] = mapped[COLS[col]];
  return out;
}
