// Arkives — the stores, and which ones each view needs.
// Boot loads the profile and the first route's stores, nothing else; every
// later navigate loads what its view needs (memoized, so a store loads
// once per session). A view's list must cover every state key it reads;
// tests/checks.mjs verifies that against the source.
import { db } from '../lib/sb.js';
import { defineStore } from './_store.js';
import { profile } from './profile.js';
import { tasks } from './tasks.js';
import { clients, invoices } from './invoices.js';

const simple = (name, keys, fetch) => defineStore(name, { keys, deps: [profile], fetch });
export const deals = simple('deals', ['DEALS'], () => db.sbFetchDeals());
export const campaigns = simple('campaigns', ['CAMPAIGN_RESULTS'], () => db.sbFetchCampaignResults());
export const calendar = simple('calendar', ['CALENDAR_EVENTS'], () => db.sbFetchCalendarEvents());
export const revenue = simple('revenue', ['MONTHLY_REVENUE'], () => db.sbFetchMonthlyRevenue());
export const audience = simple('audience', ['AUDIENCE_DATA'], () => db.sbFetchAudienceData());
export const inbox = simple('inbox', ['INBOX_ITEMS'], () => db.sbFetchInboxItems());
export const outreach = simple('outreach', ['OUTREACH_LISTS', 'OUTREACH_TARGETS', '_outreachMigrationMissing'], () => db.sbFetchOutreach());
export { profile, tasks, clients, invoices };

export const ALL_STORES = [profile, deals, campaigns, calendar, revenue, audience, inbox, tasks, clients, invoices, outreach];

// profile is implied for every view (boot loads it before the first paint).
// Boards and Scripts fetch their own rows when they open.
export const VIEW_STORES = {
  dashboard: [deals, calendar, revenue],
  revenue: [deals, revenue],
  mediakit: [audience, campaigns],
  analytics: [],
  inbox: [inbox],
  calendar: [calendar],
  tasks: [tasks],
  settings: [audience, calendar, campaigns, deals, inbox, invoices, revenue],
  scripts: [],
  boards: [],
  contracts: [deals],
  invoices: [invoices, clients],
  outreach: [outreach],
};
const EDITOR_PREFIXES = ['script/', 'shared/', 'board/', 'bshared/'];

export function storesFor(view) {
  if (EDITOR_PREFIXES.some((p) => view.startsWith(p))) return [];
  const base = view.split('/')[0];
  return VIEW_STORES[base] || VIEW_STORES.dashboard; // unknown hash lands on the dashboard
}
export function loadFor(view) {
  return Promise.all(storesFor(view).map((s) => s.load()));
}
export function loadAll() {
  return Promise.all(ALL_STORES.map((s) => s.load()));
}
// Logout: the next sign-in must fetch everything again.
export function resetStores() {
  ALL_STORES.forEach((s) => s.reset());
}
