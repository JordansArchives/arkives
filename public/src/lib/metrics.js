// Arkives — numbers derived from the tools (dashboard + revenue).
// Pure functions over store arrays; `today` is a local YYYY-MM-DD so the
// tests can pin it. Money comes from invoices only: deal fields and the
// hand-typed monthly_revenue table no longer feed any total.
import { invBalance, invIsOverdue, invTotal } from '../views/invoices.js';
import { qIsExpired, qTotal } from '../views/quotes.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The day an invoice's money counts: paid_at (027) when stamped, else
// the invoice date (pre-027 rows, partial payments on sent invoices)
function paidDay(inv) {
  return (inv.paidAt ? _localDay(inv.paidAt) : '') || inv.date || '';
}
function _localDay(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// What each invoice has actually brought in: a paid invoice its total,
// a sent one any partial payment recorded on it
function received(inv) {
  if (inv.status === 'paid') return invTotal(inv);
  if (inv.status === 'sent') return Math.max(0, Number(inv.amountPaid) || 0);
  return 0;
}

function moneySummary(invoices, today) {
  const year = today.slice(0, 4), month = today.slice(0, 7);
  const out = { paidYear: 0, paidMonth: 0, outstanding: 0, outstandingCount: 0, overdue: 0, overdueCount: 0, draftCount: 0, invoicedYear: 0, paidCount: 0 };
  for (const inv of invoices || []) {
    if (inv.status === 'draft') { out.draftCount++; continue; }
    const got = received(inv), day = paidDay(inv);
    if (got > 0 && day.startsWith(year)) out.paidYear += got;
    if (got > 0 && day.startsWith(month)) out.paidMonth += got;
    if (inv.status === 'paid') out.paidCount++;
    if ((inv.date || '').startsWith(year)) out.invoicedYear += invTotal(inv);
    if (inv.status === 'sent') {
      const bal = Math.max(0, invBalance(inv));
      if (bal > 0) { out.outstanding += bal; out.outstandingCount++; }
      if (invIsOverdue(inv) && bal > 0) { out.overdue += bal; out.overdueCount++; }
    }
  }
  return out;
}

// Last `count` months ending with today's month, oldest first
function revenueByMonth(invoices, today, count = 12) {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)) - 1;
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - i, 1);
    months.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: MONTHS[d.getMonth()], paid: 0, invoiced: 0 });
  }
  const byKey = Object.fromEntries(months.map((x) => [x.key, x]));
  for (const inv of invoices || []) {
    if (inv.status === 'draft') continue;
    const got = received(inv);
    const pm = byKey[paidDay(inv).slice(0, 7)];
    if (pm && got > 0) pm.paid += got;
    const im = byKey[(inv.date || '').slice(0, 7)];
    if (im) im.invoiced += invTotal(inv);
  }
  return months;
}

function quoteSummary(quotes) {
  const Q = quotes || [];
  const open = Q.filter((q) => q.status === 'sent' && !qIsExpired(q));
  const won = Q.filter((q) => q.status === 'accepted');
  const lost = Q.filter((q) => q.status === 'declined');
  const decided = won.length + lost.length;
  return {
    openCount: open.length, openValue: open.reduce((s, q) => s + qTotal(q), 0),
    wonCount: won.length, wonValue: won.reduce((s, q) => s + qTotal(q), 0),
    winRate: decided ? Math.round((won.length / decided) * 100) : null, decided,
    draftCount: Q.filter((q) => q.status === 'draft').length,
    unseen: Q.filter((q) => q.responseSeen === false).length,
  };
}

function taskSummary(tasks, today) {
  const T = tasks || [];
  const weekAgo = _addDays(today, -6);
  const open = T.filter((t) => !t.completed);
  return {
    openCount: open.length,
    dueToday: open.filter((t) => t.dueDate === today).length,
    overdue: open.filter((t) => t.dueDate && t.dueDate < today).length,
    doneThisWeek: T.filter((t) => t.completed && t.completedAt && _localDay(t.completedAt) >= weekAgo).length,
  };
}
function _addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return _localDay(d.toISOString());
}

export { moneySummary, paidDay, quoteSummary, received, revenueByMonth, taskSummary };
