// Arkives — the invoices and clients stores. Own state.INVOICE_DATA and
// state.CLIENTS and every write to them. Writes are pessimistic: the row
// changes after Supabase confirmed it. The view keeps the editor draft
// (state._inv), computes totals, and decides what to send.
import { state } from '../state.js';
import { db, _mapInvoiceRow } from '../lib/sb.js';
import { defineStore } from './_store.js';
import { profile } from './profile.js';

export const clients = defineStore('clients', {
  keys: ['CLIENTS', '_invoicingMigrationMissing'],
  deps: [profile],
  fetch: () => db.sbFetchClients(),
});

export const invoices = defineStore('invoices', {
  keys: ['INVOICE_DATA'],
  deps: [profile],
  fetch: () => db.sbFetchInvoices(),
});

Object.assign(clients, {
  find(id) { return state.CLIENTS.find((x) => x._sbId === id); },
  _sort() { state.CLIENTS.sort((a, b) => a.name.localeCompare(b.name)); },
  // data: { name, company, email, invoicePrefix, billingAddress }. Resolves to the client, or null.
  async add(data) {
    const row = await db.sbAddClient(data);
    if (!row) return null;
    const client = { _sbId: row.id, ...data };
    state.CLIENTS.push(client);
    clients._sort();
    clients.notify();
    return client;
  },
  async update(id, data) {
    const ok = await db.sbUpdateClient(id, {
      name: data.name, company: data.company, email: data.email,
      invoice_prefix: data.invoicePrefix, billing_address: data.billingAddress
    });
    if (!ok) return false;
    const c = clients.find(id);
    if (c) Object.assign(c, data);
    clients._sort();
    clients.notify();
    return true;
  },
  async remove(id) {
    const ok = await db.sbDeleteClient(id);
    if (!ok) return false;
    state.CLIENTS = state.CLIENTS.filter((x) => x._sbId !== id);
    clients.notify();
    return true;
  },
});

Object.assign(invoices, {
  find(id) { return state.INVOICE_DATA.find((i) => i._sbId === id); },
  async setStatus(id, status) {
    const inv = invoices.find(id);
    if (!inv) return false;
    const ok = await db.sbUpdateInvoice(id, { status });
    if (!ok) return false;
    inv.status = status;
    _stampPaid(inv);
    invoices.notify();
    return true;
  },
  // The view decides whether this payment settles the invoice (it knows the total).
  async recordPayment(id, newPaid, settled) {
    const inv = invoices.find(id);
    if (!inv) return false;
    const updates = { amount_paid: newPaid };
    if (settled) updates.status = 'paid';
    const ok = await db.sbUpdateInvoice(id, updates);
    if (!ok) return false;
    inv.amountPaid = newPaid;
    if (settled) inv.status = 'paid';
    _stampPaid(inv);
    invoices.notify();
    return true;
  },
  // payload is the DB-shaped row the editor built; editingId null = insert.
  // Resolves to the saved invoice (truthy), or false.
  async save(payload, editingId) {
    let inv;
    if (editingId) {
      const ok = await db.sbUpdateInvoice(editingId, payload);
      if (!ok) return false;
      const idx = state.INVOICE_DATA.findIndex((i) => i._sbId === editingId);
      if (idx !== -1) {
        const prev = state.INVOICE_DATA[idx];
        inv = state.INVOICE_DATA[idx] = { ...prev, ..._mapInvoiceRow({ id: editingId, ...payload }), paidAt: prev.paidAt };
        _stampPaid(inv);
      }
    } else {
      const row = await db.sbAddInvoice(payload);
      if (!row) return false;
      inv = _mapInvoiceRow(row);
      state.INVOICE_DATA.unshift(inv);
    }
    invoices.notify();
    return inv || true;
  },
  async remove(id) {
    const ok = await db.sbDeleteInvoice(id);
    if (!ok) return false;
    state.INVOICE_DATA = state.INVOICE_DATA.filter((i) => i._sbId !== id);
    invoices.notify();
    return true;
  },
});

// Mirrors the 027 trigger locally so the dashboard is right before the
// next fetch: entering 'paid' stamps now, leaving it clears.
function _stampPaid(inv) {
  if (inv.status === 'paid') { if (!inv.paidAt) inv.paidAt = new Date().toISOString(); }
  else inv.paidAt = '';
}
