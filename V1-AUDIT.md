# Arkives v1 Audit: Punch List

> ## RECONCILIATION NOTE (2026-07-13). Read this first.
>
> This audit was run against a STALE local clone that was missing the
> July-1 "simplification" work (8 commits: cut to 10 core features,
> Settings made interactive, share links fixed, analytics wired to the
> local cache file, legacy files deleted, 11 unused tables dropped via
> migrations/006_simplification_cleanup.sql).
>
> Already resolved by that work BEFORE this audit was written:
> item 4.1 (legacy file deletion), item 4.2 (Content Studio + Brand
> Voice cut), item 1.4 (share links), parts of 2.3 (Settings), and the
> old Expenses view was cut entirely (making 1.1 and 2.6 moot as
> written). The P0 security findings were all still real and are now
> DONE (see Progress Log).
>
> NEXT SESSION: re-audit the actual simplified codebase (10 features,
> 17 tables) against the definition of done and rewrite P1-P3 to match
> reality before building anything.

**Date:** 2026-07-12
**Anchor:** `jordans-archives-repo/decisions/2026-07-12-arkives-productization.md`
**Scope:** Every existing view audited against the v1 definition of done. No new features; this list is only about making what exists fully operational for Jordan AND for a stranger who signs up.

## Definition of Done (per feature)

1. Jordan can use it end to end on his real deal flow
2. A stranger can sign up, get their own empty account, and use it end to end
3. Full CRUD with persistence... nothing view-only, nothing hardcoded
4. Sensible empty states for a fresh account
5. Zero Jordan-specific dependencies

## Executive Verdict

Arkives today is a beautiful, largely read-only dashboard over Jordan's seeded data. The Supabase CRUD layer (`sb*` functions) is built but mostly UNWIRED: of ~20 write functions, only deal creation, invoice creation (write-only), and the Scripts view are actually called from the UI. Tenancy is cosmetic: RLS is anon allow-all, so any visitor with the public anon key can read/write every row, and a stranger signing up can silently claim Jordan's profile via the "link first unlinked profile" fallback. Jordan's private business data (real deal amounts, brand contacts, negotiation notes in `migrations/004`, analytics history, personal expenses) ships to production as public static files. Scripts is the strongest view (full CRUD, autosave); Content Studio and Brand Voice are hardcoded strategy docs, not product.

**The work splits into five phases below. P0 and P1 are the blockers; P2 is the bulk of the build.**

---

## Per-View Status

| View | Status | Blocking gaps |
|---|---|---|
| Dashboard | Display-only widgets | Follow-ups/actions/deadlines CRUD unwired; chart reads Jordan's static JSON |
| Pipeline | Partial CRUD | Create works (app.js:1840); edit/stage-move never persist (sbUpdateDeal: zero call sites) |
| Inbox | Read-only | No ingestion path for new users; sbUpdateInboxStatus: zero call sites |
| Revenue | Display-only | Reads seeded deal columns + seeded monthly_revenue; nothing editable |
| Media Kit | Jordan-only | Screen AND PDF hardcode identity, handles, rates, email (app.js:2387-2536, 4961-5012) |
| Analytics | Dead on hosted deploy | API_BASE placeholder 404s; data source is Jordan's Social Blade handles |
| Scripts | Strongest view | Full CRUD + autosave; needs user scoping (app.js:5415, 5425) + migrations |
| Content Studio | Cut candidate | 100% hardcoded Jordan strategy constants; zero persistence |
| Contracts | Partial | Good 18-section generator + PDF; no save/load; Jordan fallback identity |
| Expenses | BROKEN for everyone | NET_INCOME.ytd crash (app.js:4387); localStorage + Apps Script path, not Supabase |
| Invoices | Write-only | Saved invoices never read back; no edit/paid/overdue/delete |
| Calendar | Read-only | sbAddCalendarEvent/sbDeleteCalendarEvent: zero call sites |
| Settings | Read-only | sbUpdateProfile/sbUpdatePlatform/sbUpdateRateCard: zero call sites |

Empty states: `empty-state` appears zero times in app.js. Effectively none exist anywhere.

---

## P0: Security + Privacy Blockers (before ANY stranger touches it)

| # | Item | Where | Size |
|---|---|---|---|
| 0.1 | Rewrite RLS: replace anon allow-all (`USING true`) with authenticated, auth.uid()-scoped policies on every table; add authenticated-role policies (none exist in any migration) | migrations/002, full_migration_v2.sql:492-511 | L |
| 0.2 | Kill the "link first unlinked profile" signup fallback; resolve strictly by auth_user_id, create-if-missing (ideally a DB trigger on auth.users insert) | app.js:591-597 | S |
| 0.3 | Stop shipping Jordan's private data publicly: exclude migrations/ from Pages deploy (004 has real deal values, contacts, negotiation notes), remove analytics_cache.json + expense_cache_seed.json from deploy | repo root, migrations/004:16-22 | S |
| 0.4 | Remove console logging of deal financials and profile-linking IDs | app.js:881-890, 596-605 | S |
| 0.5 | Fix schema drift: write migrations (with user_id + RLS) for the 5 tables that exist only in the live DB: weekly_plans, weekly_tasks, parking_lot, scripts, script_scenes | migrations/ | M |
| 0.6 | Split full_migration_v2.sql into schema-only vs jordan-seed.sql so fresh installs never get Jordan's account | migrations/full_migration_v2.sql | S |

## P1: Broken for Everyone, Including Jordan

| # | Item | Where | Size |
|---|---|---|---|
| 1.1 | Fix Expenses crash: NET_INCOME.ytd never set (TypeError on render); also BUSINESS_SUBS.mrrMinimum/totalMonthlyCost never populated | app.js:4387, 4418, 843-850 | S |
| 1.2 | Load invoices from Supabase in sbFetchAllData; INVOICE_DATA currently derives from DEALS at parse time when DEALS is still empty, so the list is always empty | app.js:4751-4761, 662 | S |
| 1.3 | Resolve API_BASE = "__PORT_8000__": 7 features (research, analytics refresh, brand-match, proposal, draft-email, caption AI, negotiation notes) fetch a dead URL. Remove the call sites and buttons for v1 (backend can return post-v1) | app.js:6, 1925, 2594, 3207, 3370, 3586; toolkit-views.js:545, 1681 | M |
| 1.4 | Fix script share links: init() shows auth screen before checking #shared/ routes, so recipients hit a login wall; also share modal no-ops on deep link (_scriptsCache empty) | app.js:5931-5933, 5831 | S |
| 1.5 | Fix init race: 8s timeout can render the app with partially loaded data, silently | app.js:5924-5928 | S |

## P2: Wire the CRUD (the bulk of the build)

| # | Item | Where | Size |
|---|---|---|---|
| 2.1 | Deal editing: wire sbUpdateDeal (zero call sites today) into the deal modal... edit fields, move stages, record payments (paid/invoiced/outstanding). This unlocks Revenue as a living view | app.js:923, 1751-1753 | M |
| 2.2 | Dashboard widgets: wire the 8 existing but uncalled functions for follow-ups, action items, content deadlines (add/complete/delete from the UI) | app.js:955-1020 | M |
| 2.3 | Settings editing: wire sbUpdateProfile/sbUpdatePlatform/sbUpdateRateCard so a new user can set name, handles, platforms, stats, rates. Feeds Media Kit + Dashboard | app.js:1080-1104, 4108-4115 | M |
| 2.4 | Calendar: wire sbAddCalendarEvent/sbDeleteCalendarEvent with a simple add/delete UI | app.js:1048-1067 | S |
| 2.5 | Inbox: wire sbUpdateInboxStatus + a manual "add item" path. Decide the multi-user ingestion story later; manual-first is fine for v1 | app.js:1022, 3438-3540 | M |
| 2.6 | Expenses: wire to the Supabase expenses table (exists in schema, zero queries against it); drop the Apps Script + localStorage path; delete the Jordan seed fetch | app.js:4196-4207, 4333-4377 | M |
| 2.7 | Invoice lifecycle: edit, mark paid (sbUpdateInvoice needed), delete, due_date in the form, overdue = past-due && unpaid surfaced in Revenue + Invoices | app.js:4796-4896 | M |
| 2.8 | Monthly revenue: compute from paid deals/invoices by month instead of the seeded monthly_revenue table | app.js:2312-2315, 753-757 | M |
| 2.9 | Scripts multi-user: filter fetch by user, stamp user_id on insert | app.js:5415, 5425 | S |
| 2.10 | Contracts: add a contracts table + save/load per deal; replace Jordan fallback identity (name, Asterisk LLC, Colorado) with CREATOR/profile values | toolkit-views.js:633-648, 1120, 1368-1416 | M |
| 2.11 | Money-flow convergence: deals, invoices, and monthly_revenue are three disconnected sources of truth. Converge on deals -> invoices -> paid as the single flow (2.1 + 2.7 + 2.8 together) | architecture | M |

## P3: De-Jordanize + New-User Experience

| # | Item | Where | Size |
|---|---|---|---|
| 3.1 | Media Kit from user data: name/handle/niche/email/avatar from CREATOR, platform links from platforms.profile_url, rates from RATE_CARD (screen currently hardcodes $15,000/$10,000/$5,000/$3,500 while RATE_CARD sits unused); mirror in PDF export (author, filename, footer) | app.js:2387-2536, 4961-5012, 5288+ | M |
| 3.2 | Analytics rebuild for hosted: per-user snapshots table + manual "log my numbers" form as v1; dashboard chart reads it instead of analytics_cache.json | app.js:1419, 2594 | M |
| 3.3 | Identity string sweep: sidebar "JW / Jordan Watkins" defaults, quote/proposal exports (jordanss.archives@gmail.com), $15K copy, 6%-of-followers rate assumption, toolkit contract defaults | index.html:187-190; app.js:20-23, 646, 1889-1893, 2180-2197, 3432 | S |
| 3.4 | Empty states for every view (none exist today) | all render functions | M |
| 3.5 | Signup onboarding: minimal wizard (brand name, handles, platforms, minimum rate) writing to profiles/platforms/rate_card_settings so a fresh dashboard is not a dead shell | new | M |

## P4: Cleanup + Cut Decisions

| # | Item | Size |
|---|---|---|
| 4.1 | Delete dead files: command-center.js, expense_data.json, expense-tool-spec.md, test-console.html, google-apps-script.js, api_server.py (all verified unreferenced) | S |
| 4.2 | DECIDED 2026-07-13: cut Content Studio and Brand Voice views from v1 (remove routes + nav + toolkit-views sections). Their useful kernel (brand identity, rates, alignment rules) folds into editable Settings (P2.3) pre-filled by the 5-field onboarding (P3.5). Content planning stays out of v1; revisit post-launch only if users ask | S |
| 4.3 | README fixes: persistSession contradiction (code uses true), move Jordan's brand rules (Higgsfield, $15K minimum) out of app "Critical Rules"... they are per-tenant DB rows now | S |
| 4.4 | Theme toggle never persists choice | S |

---

## Progress Log

**2026-07-13 (P0 session):**
- DONE 0.2: signup profile-claim bug fixed in app.js (strict auth_user_id resolution)
- DONE 0.4: financial/ID console logging removed
- DONE 0.6: fresh-install path is now 001 + 006 + 007, schema only (README rewritten; seeds marked private)
- DONE 4.2: Content Studio + Brand Voice cut (nav, routes, containers, ~620 lines of toolkit-views.js; showToast kept for Contracts). toolkit-views.js: 1700 -> 1089 lines
- WRITTEN, pending DB run: 0.1 (migrations/007_user_scoped_rls.sql) and 0.5 (migrations/006_missing_tables.sql). Jordan runs 006 then 007 in Supabase SQL Editor
- DONE repo-side, pending dashboard flip: 0.3 deploy restructure (site now in public/; Jordan sets Pages build output dir to `public`, then push deploys)
- Post-deploy checks: login works with own data; arkives.xyz/migrations/004_seed_deals.sql returns 404; anon-policy count query returns 0

## Suggested Build Order

1. **P1.1 + P1.2** (one session): Expenses uncrashed, invoices readable... immediate wins Jordan feels
2. **P0 complete** (the multi-tenancy milestone): RLS rewrite, signup fix, schema migrations, deploy hygiene. After this a stranger can safely exist in the system
3. **P2.1 + 2.2 + 2.3** (the daily-use core): deals editable, dashboard widgets live, settings editable
4. **P2 remainder + P3** (feature completeness + new-user experience)
5. **P4** (cleanup) can be sprinkled into any session

Estimated total: P0 is the only L-heavy phase; everything else is S/M items that vanilla JS + existing sb* functions make fast.
