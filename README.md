# Arkives — Creator Partnership CRM

A self-contained, Supabase-backed web application for managing brand deals, invoicing, analytics, content planning, and business operations as a creator.

**Owner:** Jordan Watkins ([@jordans.archivess](https://instagram.com/jordans.archivess))  
**Entity:** Asterisk LLC  
**Domain:** [arkives.xyz](https://arkives.xyz)  
**Status:** Live on Cloudflare Pages (auto-deploys from GitHub)

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
archiveboard/
├── index.html              # SPA shell — auth screen, sidebar, view containers
├── app.js                  # ~5900 lines — data layer, auth, CRUD, all view renderers
├── style.css               # ~4900 lines — full design system, all component styles
├── toolkit-views.js        # Content Studio + Contracts views (separate file for size)
├── analytics_cache.json    # Historical platform analytics snapshots (read by chart)
├── paper-bg.png            # Light theme background texture
├── paper-bg-dark.png       # Dark theme background texture
├── migrations/             # Supabase SQL migrations (run in order)
│   ├── full_migration_v2.sql   # COMPLETE schema + seed (run this for fresh setup)
│   ├── 001_full_schema.sql     # Tables only
│   ├── 002_anon_access_policies.sql
│   ├── 003_seed_data.sql       # Jordan's profile, platforms, rate cards, etc.
│   ├── 004_seed_deals.sql      # All 26 deals with negotiation history
│   └── 005_link_auth.sql       # auth_user_id column for profile linking
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
| RLS | Enabled on all tables, anon policies for now |

### Database Tables (25+)

**Core:** profiles, platforms, rate_cards, rate_card_settings  
**Deals:** deals, deal_history, follow_ups, action_items, latest_updates, content_deadlines  
**Finance:** invoices, expenses, subscriptions, net_income, monthly_revenue, labor  
**Content:** campaign_results, outreach_templates, calendar_events, inbox_items  
**Config:** brand_rules, contract_rules, audience_data, user_settings  
**Tasks:** weekly_plans, weekly_tasks, parking_lot  
**Scripts:** scripts, script_scenes  

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
2. **`persistSession: false`** in Supabase config (required for iframe/cross-origin contexts)
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
2. Read `app.js` lines 1-300 for data structures and Supabase config
3. The `sbFetchAllData()` function (~line 575) is the master data loader
4. All render functions follow the pattern: `renderXxx()` reads from global arrays → builds HTML → injects into `#view-xxx`
5. CRUD functions are prefixed with `sb` (e.g., `sbAddDeal`, `sbUpdateDeal`)

### Code Conventions
- Pure vanilla JS — no React, no Vue, no framework
- Template literals for HTML rendering
- `var` in auth functions (broader compat), `const`/`let` elsewhere
- Async/await for all Supabase operations
- Error handling via `_showSaveError()` / `_showSaveSuccess()` toast system

### What NOT to do
- Don't introduce a build step (no webpack, no vite, no npm)
- Don't add framework dependencies
- Don't use `localStorage` directly — use `safeGet()`/`safeSet()`
- Don't hardcode data — everything comes from Supabase

### Key Areas for Future Work
1. **Inline editing** — make every data section (deals, follow-ups, action items, etc.) editable in-place with Supabase persistence
2. **Expense migration** — replace Google Apps Script with direct Supabase `expenses` table
3. **User-scoped RLS** — update policies from `anon` to `auth.uid() = user_id`
4. **Real-time updates** — use Supabase Realtime for live data sync
5. **Multi-user support** — the schema already supports it (user_id FK on all tables)
