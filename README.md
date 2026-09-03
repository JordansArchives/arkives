# Arkives — Creator Partnership CRM

A self-contained, Supabase-backed web application for managing brand deals, invoicing, analytics, content planning, and business operations as a creator.

**Owner:** Jordan Watkins ([@jordans.archivess](https://instagram.com/jordans.archivess))  
**Entity:** Asterisk LLC  
**Domain:** [arkives.xyz](https://arkives.xyz)  
**Status:** Live on Cloudflare Workers (auto-deploys from GitHub via `npx wrangler deploy`, serves `public/` only)

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend (Static SPA)                       │
│  index.html + app.js + style.css            │
│  toolkit-views.js (Content Studio, Contracts)│
│  Pure vanilla JS — no framework, no build   │
├─────────────────────────────────────────────┤
│  Supabase Backend                            │
│  Project: wqblmehsqcmsdstyweus              │
│  Auth: Email/password (Supabase Auth)       │
│  DB: PostgreSQL with RLS                    │
│  25+ tables, all data loaded on init        │
├─────────────────────────────────────────────┤
│  Hosting Target                              │
│  Cloudflare Pages (static deploy)           │
│  Auto-deploy from GitHub on push            │
│  Custom domain: arkives.creator             │
└─────────────────────────────────────────────┘
```

### Why no framework?
Jordan wants maximum portability and zero build overhead. The app is a single-page application using hash-based routing (`#dashboard`, `#pipeline`, etc.) with no dependencies beyond:
- **Chart.js** (CDN) — charts and data viz
- **jsPDF** (CDN) — PDF export for media kit
- **Supabase JS v2** (CDN) — database + auth client

---

## File Structure

```
arkives/
├── public/                 # DEPLOYED SURFACE — the only folder that ships to arkives.xyz
│   ├── index.html          # SPA shell — auth screen, sidebar, view containers, module preloads
│   ├── theme.js            # the one classic script: applies the saved theme before first paint
│   ├── src/                # the app, as native ES modules (no bundler; the browser resolves imports)
│   │   ├── main.js         # entry: imports every module, runs the __init() hooks in order, exposes window.__arkives, boots
│   │   ├── state.js        # every piece of shared mutable state, as properties of one `state` object
│   │   ├── router.js       # hash routing, view switching, theme toggle, mobile nav
│   │   ├── lib/            # actions (event delegation), sb (Supabase client + `db`), toast, esc, format, icons, storage, share
│   │   └── views/          # one module per view: auth, dashboard, revenue, mediakit, analytics, inbox, calendar, tasks, settings, scripts, invoices, outreach, boards, contracts
│   ├── style.css           # full design system, all component styles
│   ├── _headers            # Cloudflare response headers: enforced CSP (no inline scripts), frame and referrer policies
│   └── (assets)            # manifest.webmanifest, favicon.svg, logo-*.svg/png, paper-tile*.webp, trip-sans-*.woff2, invoice-red-*
├── tests/                  # checks.mjs (logic + static guards), smoke.mjs (13 views x 2 states x 2 widths), live.mjs (Realtime), _server.mjs
├── wrangler.jsonc          # Cloudflare Workers deploy config (assets = ./public)
├── ARCHITECTURE-AUDIT.md   # The audit and its roadmap, with a progress log (V1-AUDIT.md is superseded)
├── migrations/             # Supabase SQL migrations — NEVER deployed (private data in seeds)
│   ├── 001_full_schema.sql     # Original tables
│   ├── 002_anon_access_policies.sql  # DEPRECATED — superseded by 008
│   ├── 003_seed_data.sql       # Jordan's seed — PRIVATE, never run on fresh installs
│   ├── 004_seed_deals.sql      # Jordan's deals — PRIVATE, never run on fresh installs
│   ├── 005_link_auth.sql       # auth_user_id column for profile linking
│   ├── 006_simplification_cleanup.sql  # July-1 simplification: drops unused tables
│   ├── 007_missing_tables.sql  # scripts/scenes + task tables written down (ran as "006" on live)
│   ├── 008_user_scoped_rls.sql # user-scoped RLS, multi-tenancy (ran as "007" on live)
│   ├── 009_redrop_unused_tables.sql  # re-drop shells recreated during drift repair
│   ├── full_migration.sql      # LEGACY — do not use
│   └── full_migration_v2.sql   # LEGACY — contains Jordan seed; do not use
├── api_server.py           # FastAPI backend (unused in static deploy)
├── command-center.js       # Deprecated (command center removed per Jordan)
├── google-apps-script.js   # Google Sheets expense sync (legacy, being replaced)
├── expense_cache_seed.json # Seed data for expenses (legacy)
├── expense_data.json       # Expense entries (legacy)
├── expense-tool-spec.md    # Spec for expense tool (legacy)
├── test-console.html       # Debug/test page
└── eslint.config.mjs       # Linting config
```

---

## Supabase Configuration

| Setting | Value |
|---------|-------|
| Project URL | `https://wqblmehsqcmsdstyweus.supabase.co` |
| Anon Key | `sb_publishable_jYnmjabjsjkfnBvo1Eii0g_c3aKkCf2` |
| Auth | Email/password, `persistSession: true` |
| RLS | User-scoped policies on every table (008). Anon key reads/writes nothing. |

### Database Tables (25+)

**Core:** profiles, platforms, rate_cards, rate_card_settings  
**Deals:** deals, deal_history, follow_ups, action_items, latest_updates, content_deadlines  
**Finance:** invoices, expenses, subscriptions, net_income, monthly_revenue, labor  
**Content:** campaign_results, outreach_templates, calendar_events, inbox_items  
**Config:** brand_rules, contract_rules, audience_data, user_settings  
**Tasks:** weekly_plans, weekly_tasks, parking_lot  
**Scripts:** scripts, script_scenes. Sharing fixed in 018 (closes the accepted 008 gap): `#shared/{token}` and `#shared/{token}/edit` now work logged-out via token-gated RPCs — get_shared_script, get_shared_script_scenes (reads), update_shared_script_title, patch_shared_scene, add_shared_scene, delete_shared_scene, reorder_shared_scenes (writes, edit links only). App routes through RPCs only when `_sharedScriptToken` is set; owners use direct table access. 018 also writes down the `scripts.share_mode` column that existed on live but in no migration.  
**Boards:** boards, board_items (016) + `board-media` private Storage bucket for uploaded images. Sharing (017 + 019): share_token/share_mode ('none'|'view'|'edit') on boards; token-gated read RPCs get_shared_board/get_shared_board_items and write RPCs add/update/delete_shared_board_item (edit links only); storage SELECT for shared boards, INSERT/DELETE scoped to edit-shared boards' own folders. Links: `#bshared/{token}` (view), `#bshared/{token}/edit` (full editor, writes routed via `_bdSharedToken`). Boards and Scripts share one popover UI (bd-share-* classes, `_shareLinkRowsHtml` in app.js).  

---

## Data Flow

### On Login
1. User signs in via Supabase Auth (email/password)
2. `sbFetchAllData()` loads ALL data from Supabase into JS variables
3. Profile is auto-linked to auth user via `auth_user_id` column
4. `navigate()` renders the dashboard with live data

### Data Variables (populated from Supabase)
```
CREATOR         → profiles + platforms
RATE_CARD       → rate_cards + rate_card_settings
DEALS           → deals + deal_history
FOLLOW_UPS      → follow_ups
ACTION_ITEMS    → action_items
LATEST_UPDATES  → latest_updates
CONTENT_DEADLINES → content_deadlines
CAMPAIGN_RESULTS → campaign_results
OUTREACH_TEMPLATES → outreach_templates
CALENDAR_EVENTS → calendar_events
MONTHLY_REVENUE → monthly_revenue
AUDIENCE_DATA   → audience_data
INBOX_ITEMS     → inbox_items
PERSONAL_SUBS   → subscriptions (type='personal')
BUSINESS_SUBS   → subscriptions (type='business')
NET_INCOME      → net_income
LABOR           → labor
BRAND_RULES     → brand_rules
CONTRACT_RULES  → contract_rules
WEEKLY_TASKS    → weekly_tasks
PARKING_LOT     → parking_lot
```

### CRUD Functions Available
Every data type has Supabase-connected CRUD:
- `sbAddDeal()`, `sbUpdateDeal()`, `sbAddDealHistory()`
- `sbAddFollowUp()`, `sbCompleteFollowUp()`, `sbDeleteFollowUp()`
- `sbAddActionItem()`, `sbCompleteActionItem()`, `sbDeleteActionItem()`
- `sbAddContentDeadline()`, `sbDeleteContentDeadline()`
- `sbUpdateInboxStatus()`
- `sbAddSubscription()`, `sbDeleteSubscription()`
- `sbAddCalendarEvent()`, `sbDeleteCalendarEvent()`
- `sbAddInvoice()`
- `sbUpdateProfile()`, `sbUpdatePlatform()`, `sbUpdateRateCard()`

---

## Views / Pages

| Route | Renderer | Description |
|-------|----------|-------------|
| `#dashboard` | `renderDashboard()` | KPIs, platform chart, calendar, deadlines, actions, updates |
| `#pipeline` | `renderPipeline()` | Kanban board + list views for all deals |
| `#inbox` | `renderInbox()` | Email inbox with suggested actions |
| `#revenue` | `renderRevenue()` | Revenue KPIs, monthly chart, payment status, invoice tracker |
| `#mediakit` | `renderMediaKit()` | Exportable media kit with PDF generation |
| `#analytics` | `renderAnalytics()` | Per-platform analytics with growth charts |
| `#scripts` | `renderScripts()` | Script manager with scene-by-scene editor |
| `#boards` / `#board/{id}` | `renderBoards()` / `renderBoardEditor()` | Milanote-style storyboards: pan/zoom canvas, stickies, text, image uploads, video links, pen (boards.js) |
| `#contentstudio` | Content Studio view | Content planning (in toolkit-views.js) |
| `#contracts` | Contracts view | Contract builder (in toolkit-views.js) |
| `#expenses` | `renderExpenses()` | Expense tracking (partially migrated) |
| `#invoices` | `renderInvoices()` | Invoice management |
| `#calendar` | `renderCalendar()` | Content calendar with deal events |
| `#settings` | `renderSettings()` | Rate card, platform stats, brand/contract rules |

---

## Design System

### Theme
- **Light:** `--bg-0: #F5F1ED`, `--bg-1: #FFFFFF`, `--bg-2: #EDE8E2`
- **Dark:** `--bg-0: #141311`, `--bg-1: #1C1B18`, `--bg-2: #252420`
- **Accent:** `--accent: #C73539` (red)
- **Teal:** `--teal: #2A6B5A`
- Paper grid background texture (hand-drawn aesthetic)

### Typography
- **Display:** Instrument Serif (serif)
- **Body:** General Sans (sans-serif)
- Both loaded via Fontshare CDN

### Visual Identity
- Hand-drawn sketch-style SVG icons throughout (sidebar, platforms, UI)
- Paper texture backgrounds
- Soft shadows, rounded cards
- Dark/light theme toggle

---

## Critical Rules (MUST follow)

1. **No `localStorage` literal in app.js** — use the `safeGet()`/`safeSet()` wrapper pattern
2. **`persistSession: true`** in Supabase config (matches the code; the old "false required" note was wrong)
3. **AI tool partnerships reserved exclusively for Higgsfield** — decline all other AI organic deals
4. **Only flat-rate cash deals** — no rev-share models
5. **Minimum rate: $15,000** for organic Instagram Reel
6. **Jordan manages everything himself** — no manager field (removed Shawn@noontide.media)
7. **Hand-drawn sketch-style icons EVERYWHERE** — sidebar, dashboard, platform icons, all UI
8. **All data must be dynamic/editable** — never static. Users can change input at any time
9. **The app is called "Arkives"** (not Archiveboard)
10. **All pricing is flat-rate, NET 30 terms**

---

## Migration Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Complete | Schema design (17 tables after simplification) |
| 2 | ✅ Complete | Seed data (profile, deals, subs, etc.) |
| 3 | ✅ Complete | app.js loads ALL data from Supabase |
| 4 | ✅ Complete | Auth login/signup UI |
| 5 | ✅ Complete | Self-hosted on Cloudflare Pages at arkives.xyz |
| 6 | ✅ Complete | **Simplification pass (Jul 2026): cut Pipeline/Expenses/Content Studio/Voice/Research/Brand Match/Pricing/Proposals. Rewrote Settings as fully interactive. Rewrote Dashboard as clean KPI view. Rewrote Calendar as real month grid.** |
| 7 | ⬜ Future | User-scoped RLS (replace anon policies) |
| 8 | ⬜ Future | Additional features as workflow demands |

-------|--------|-------------|
| 1 | ✅ Complete | Schema design (25 tables) |
| 2 | ✅ Complete | Seed data (profile, deals, subs, etc.) |
| 3 | ✅ Complete | app.js loads ALL data from Supabase |
| 4 | ✅ Complete | Auth login/signup UI |
| 5 | ⬜ Pending | Rewrite daily cron to write to Supabase |
| 6 | ⬜ Pending | Full inline editing UI with persistence |
| 7 | ⬜ Pending | Wire Expenses view to Supabase (replace Apps Script) |
| 8 | ⬜ Pending | Self-host on Cloudflare Pages |
| 9 | ⬜ Pending | User-scoped RLS (replace anon policies) |

---

## Self-Hosting Plan (Cloudflare Pages)

### Prerequisites
Domain `arkives.xyz` is live on Cloudflare Pages, auto-deploying from this repo.

### Supabase Auth Config
Add `https://arkives.xyz` to the allowed redirect URLs in:
[Supabase Auth Settings](https://supabase.com/dashboard/project/wqblmehsqcmsdstyweus/auth/url-configuration)

### Remaining
- Update RLS policies from anon → authenticated user-scoped

---

## For Future AI Agents

### Quick Start
1. Read this README first
2. `public/src/state.js` lists every piece of shared state; `public/src/lib/sb.js` is the Supabase layer (`db.sbFetchAllData()` is the master loader)
3. Views live in `public/src/views/*.js`; each `renderXxx()` reads `state.*` → builds HTML → injects into `#view-xxx`
4. Reads and writes are `db.sbXxx(...)` (e.g. `db.sbAddTask`, `db.sbUpdateInvoice`); views never touch the Supabase client directly
5. `window.__arkives` (state, db, every export of every module) is how the tests and the browser console reach the app

### Code Conventions
- Pure vanilla JS — no React, no Vue, no framework
- Native ES modules under `public/src/`, no bundler. Import what you use; `npm run lint` fails on anything undefined or unused
- Shared mutable state lives on the `state` object (`import { state } from '../state.js'`), never as a module-level `let` another module needs. Module-private constants are `const`, exported
- No side effects at import time. A module that needs listeners exports `__init()`, which `main.js` calls in a fixed order (dispatcher, Supabase client, auth listener, router, then the rest)
- Template literals for HTML rendering
- `var` in auth functions (broader compat), `const`/`let` elsewhere
- Async/await for all Supabase operations
- Error handling via `_showSaveError()` / `_showSaveSuccess()` toast system
- **No inline event handlers.** Markup declares `data-action="fn"` (click), `data-input` / `data-change` / `data-keydown` / `data-submit` for other events, with args as HTML-escaped JSON in `data-args` (build them with `_args(...)` in templates; `"$event"`, `"$el"`, `"$value"`, `"$checked"` resolve at dispatch). Add `data-stop` to stop propagation after the handler. Register every handler in the `act({ ... })` block at the bottom of the file that defines it. The dispatcher lives at the top of `app.js`.

### What NOT to do
- Don't write `onclick="..."` or an inline `<script>`: the Content-Security-Policy forbids inline scripts, so it silently does nothing in production, and `npm test` fails on it
- Don't add a bundler or build step. The app ships as native ES modules straight from `public/src/` (decided 2026-09-04); npm is dev tooling only and nothing in `node_modules` ships
- Don't add framework dependencies
- Don't use `localStorage` directly — use `safeGet()`/`safeSet()`
- Don't hardcode data — everything comes from Supabase

### Key Areas for Future Work
1. **Inline editing** — make every data section (deals, follow-ups, action items, etc.) editable in-place with Supabase persistence
2. **Expense migration** — replace Google Apps Script with direct Supabase `expenses` table
3. **User-scoped RLS** — update policies from `anon` to `auth.uid() = user_id`
4. **Real-time updates** — use Supabase Realtime for live data sync
5. **Multi-user support** — the schema already supports it (user_id FK on all tables)

---

## Fresh Install (schema only, no personal data)

Run in the Supabase SQL Editor, in this order: `001` → `020` → `005` → `007` → `008` → `009` → `010` → `011` → `012` → `013` → `015` → `016` → `017` → `018` → `019`. (`020` early because `001` leaves `profiles.id` without a default; on a fresh database `006` is redundant with `009`.)
Never run `003`, `004`, or the `full_migration` files on a fresh install: they contain Jordan's personal business data.

## Multi-Tenancy Rules (added 2026-07-13)

- Every table is user-scoped via RLS (`008`). Never write queries or policies that assume a single user.
- RLS does the scoping, DB defaults do the stamping: `user_id` columns default to `current_profile_id()`. Inserts should not pass it manually.
- Jordan's PERSONAL business rules (Higgsfield exclusivity, $15K minimum, flat-rate NET 30, no rev-share) are per-tenant DATA in his own rows, not app logic. Do not hardcode them into the product.

---

## Development (added 2026-09-03)

No build step. `public/` is what ships. Tooling lives outside it:

```bash
npm install          # eslint, globals, playwright-core (no browser download; uses installed Chrome)
npm run lint         # regenerates tools/app-globals.json, then ESLint over public/ tools/ tests/
npm test             # tests/checks.mjs (logic, stubbed Supabase) + tests/smoke.mjs (13 views x populated/empty x desktop/phone)
npm run serve        # serves public/ on :8741 with the production headers from public/_headers (CSP enforced)
```

CI (`.github/workflows/ci.yml`) runs lint + test on every push and PR. Screenshots from the smoke run are uploaded as an artifact.

**Modules.** The app is native ES modules with no bundler: `index.html` loads `src/main.js` as a module and preloads every other module so the browser fetches the whole graph at once. Shared mutable state is the `state` object in `src/state.js`; all Supabase I/O is the `db` object in `src/lib/sb.js`; side effects run from `__init()` hooks that `main.js` calls in order. `main.js` also publishes `window.__arkives` (state, db, every export), which is the seam the tests use: `__arkives.state.TASKS = [...]`, `__arkives.db.sbUpdateTask = async () => true`, `__arkives.navigate('tasks')`. Adding a module? Put it under `src/lib/` or `src/views/`, import it from `main.js` so it lands in `__arkives`, and add a `<link rel="modulepreload">` for it in `index.html` (`tests/checks.mjs` fails if a module is missing from the preload list).

**Security headers.** `public/_headers` ships an enforced Content-Security-Policy with no `'unsafe-inline'` for scripts (switched from report-only on 2026-09-04 once the last inline handler was gone). The test server sends the same headers, so the smoke run exercises the app under the real policy, and `tests/checks.mjs` fails on any `on*=` attribute or inline `<script>` in `public/`, on any `data-action` name that has no registered handler, and on any constant `data-args` that is not a JSON array.

**Migrations still run by hand** in the Supabase SQL editor. `migrations/020_share_hardening.sql` must be applied (it is idempotent and safe before or after deploy). `introspect.sql` at the repo root is a read-only schema dump for checking drift.

See `ARCHITECTURE-AUDIT.md` for the roadmap this tooling belongs to.
