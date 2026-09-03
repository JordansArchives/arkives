# Arkives Architecture Audit

**Date:** 2026-09-03
**Scope:** every line of `public/*.js` (9,190 lines), `public/style.css` (7,092 lines), `public/index.html`, `wrangler.jsonc`, and migrations `001` through `019`.
**Lens:** Jordan's daily use (Boards, Scripts, Invoices, Tasks, on desktop and phone) and a stranger signing up, weighted equally.
**Supersedes:** `V1-AUDIT.md` (July 2026). Its items are reconciled in Appendix B.
**Method:** Appendix C. Every finding cites a file and line. "Confirmed" means the code was read and the failure traced; "plausible" means it needs a live test.

Sizes throughout: **S** = under an hour of focused work, **M** = one session, **L** = several sessions.

---

## 1. Verdict

Arkives has a good core and a stale shell around it.

The core is the four tools Jordan uses every day. Boards is the best-built file in the repo: lazy loading, per-item debounced saves, an undo stack, guards against stale async renders, and a correct DOM-based sanitizer. Invoices has a complete lifecycle. Tasks has in-flight guards and honest empty states. Scripts works but has a real data-loss bug in autosave. These four are worth generalizing from, not rewriting.

The shell is the CRM that Arkives started as: Dashboard, Inbox, Revenue, Media Kit, Analytics, Contracts, Calendar, Outreach, Settings. Three of those read data that nothing can write anymore (deals, monthly revenue, social stats). Inbox still calls a backend that was deleted in July. Contracts hardcodes Asterisk LLC and Colorado as defaults for every account. A stranger signing up would see a beautiful dashboard of "TBD" and a mail client with no mail.

Three things need fixing before anything else, in this order:

1. **Two stored-XSS paths from anonymous edit links into the owner's session.** Anyone holding an edit link for a script or board can call the share RPCs directly with crafted content. The editor renders a scene thumbnail, a script title, a YouTube id, and pen-stroke coordinates without escaping or validation. Supabase keeps the session token in localStorage, so opening that script or board as yourself would hand over your login, and with it the bank details loaded into memory at boot. Confirmed by reading the code. Fix is small (Section 4, F1 and F2).
2. **No password reset and no session-expiry handling.** If Jordan forgets his password there is no recovery path. If the phone's refresh token goes stale, every save fails with a toast and the app never returns to the login screen.
3. **The boot sequence loads 17 tables one after another before rendering anything**, and the daily tools need almost none of it. On a phone at 200ms round trips that is three to four seconds of blank shell, and the 8-second timeout can render a view with empty data that a late fetch then silently overwrites.

After those, the biggest wins are all phone-shaped: a layout bug that makes the mobile header 611px tall on short views, no pinch-zoom on the board canvas, no undo on touch, theme that resets to light on every load, a 3MB paper texture on every cold start, and delete buttons that only appear on hover.

The architectural recommendation is not a rewrite. It is: Vite plus native ES modules, no UI framework, keep the template-literal rendering, replace 175 inline `onclick` handlers with event delegation (which is what unlocks a real Content Security Policy), a small per-domain store layer, and a router with `mount` and `unmount` so timers and autosaves have somewhere to die. Each phase ships alone. Section 10 makes the case; Section 11 sequences it.

---

## 2. What is done well

Keep these patterns. They are the reference for everything else.

- **Multi-tenancy is real.** Every table has `user_id` defaulting to `current_profile_id()` server-side, RLS policies on all four verbs `TO authenticated`, and the "claim first unlinked profile" bug is gone with a comment explaining why (`app.js:376-395`). The anon key reads and writes nothing.
- **Share links route through token-gated RPCs instead of loosening RLS.** Write RPCs are gated on `share_mode = 'edit'` and every write is `WHERE id = p AND board_id = v_id`, so a token for board A cannot touch board B (`019:128-129`, `018:124`). All SECURITY DEFINER functions set `search_path`. Tokens are UUIDv4 minted server-side.
- **The board sanitizer is the correct pattern.** `_bdSanitizeHtml` (`boards.js:495-524`) parses into an inert `<template>`, walks the DOM, emits only `<b>`, `<u>`, `<mark>`, `<br>` with no attributes, and re-escapes every text node. Tested mentally against `<img onerror>`, `javascript:` hrefs, attribute injection, and malformed nesting. It runs on save and on render.
- **Boards editor engineering:** load token against stale renders (`boards.js:211-235`), coalesced per-item debounced saves (`716-729`), undo/redo as snapshot ops (`566-601`), orphan images deferred so undo can restore them (`622-640`), client-side downscale to 2400px WebP before upload (`786-824`).
- **Tasks:** in-flight guards against double submit (`app.js:2855, 2887`), prune by deleted ids rather than by flag so a task checked off mid-delete survives (`2944-2947`), local-date due logic with a written rationale (`2649-2652`).
- **Graceful "migration missing" states** instead of crashes for tasks, clients, outreach, and invoicing (`app.js:581-585, 598-602, 614-618`; `invoices.js:148-152`).
- **Invoices:** bill-to is a snapshot so issued invoices never change retroactively (`011` design notes); partial payments accumulate with a half-cent tolerance (`invoices.js:483`); the red template waits on fonts, art, and paper before printing (`1152-1157`).
- **Deploy hygiene:** only `public/` ships (`wrangler.jsonc`); seeds with real deal data never leave the repo.
- **Design tokens exist and charts re-read the theme on render.** Documents are deliberately fixed-light with a comment saying so.
- **No `eval`, no `setInterval`, charts destroyed before recreation, document-level listeners bound once and gated.**

---

## 3. Fix first

Ranked by risk and daily impact against effort. Items 1 through 9 fit in one session.

| # | Item | Where | Size |
|---|---|---|---|
| 1 | Validate share-RPC content server-side and escape at render (thumbnail, title attribute, video id, pen points, stroke width) | `app.js:4359, 4494`; `boards.js:433, 456, 1255, 1455`; new migration `020` | S |
| 2 | Add "Forgot password" plus `onAuthStateChange` handling for `PASSWORD_RECOVERY` and `SIGNED_OUT` | `index.html:40-66`; `app.js:130-137, 273-287` | S |
| 3 | Scripts autosave: keep `_currentScenes` as the source of truth, flush before any rerender or navigation, add a load token | `app.js:4330-4347, 4538-4575, 4576-4590` | S |
| 4 | Boot: `Promise.all` after the profile query, drop the four dead loads, remove the 8-second race, add a real loading state | `app.js:366-668, 4730-4736` | S |
| 5 | Phone layout: `.dashboard { grid-template-rows: auto 1fr }` in the 900px query; `100dvh`; `viewport-fit=cover` and safe-area padding; delete buttons visible when `hover: none` | `style.css:169-175, 3954-3966, 4073-4078, 6574-6579`; `index.html:7` | S |
| 6 | Persist theme choice and respect `prefers-color-scheme` before first paint | `app.js:1002-1008`; `index.html:2` | S |
| 7 | Replace the two 3.2MB and 3.7MB paper PNGs with a tiled 512px WebP | `style.css:162-163, 185-195, 6648` | S |
| 8 | Toast color bug and a single `sbCall()` helper so no Supabase error is swallowed | `app.js:315-342`; 14 call sites listed in Section 6 | S |
| 9 | Mount the calendar and task modals on `<body>`; delete the duplicate `.modal-overlay` rule | `app.js:2535, 2796`; `style.css:734, 5425` | S |
| 10 | `public/_headers`: CSP in report-only mode, `frame-ancestors 'none'`, referrer policy; pin CDN versions with integrity hashes | new file; `index.html:16-18` | S |
| 11 | Migration `020`: `profiles.id` default, record `scripts.share_token` type, drop `analytics_snapshots`, `contract_rules`, `outreach_templates` | `001:14`; `018` header | S |
| 12 | Boards on touch: two-finger pinch zoom, double-tap zoom, undo and redo buttons in the toolbar | `boards.js:1032-1160, 1286-1314` | M |
| 13 | Scripts on phone: stacked scene cards under 640px, pointer-based reorder replacing HTML5 drag-and-drop | `app.js:4465-4520, 4642-4678`; `style.css:4538, 4570` | M |
| 14 | Dashboard and Revenue compute from `INVOICE_DATA`; hide Inbox from the nav until ingestion exists | `app.js:1049-1063, 1216-1222, 2185`; `index.html:96-99` | M |
| 15 | Export includes tasks, scripts, boards, clients, outreach; add account deletion | `app.js:3451-3475` | M |
| 16 | PWA manifest with standalone display and icons so it installs on the home screen | new `public/manifest.webmanifest` | S |

---

## 4. Security

Full findings from a read of every migration and every `innerHTML` site. Severity is impact if exploited; confidence is whether the code was traced end to end.

| ID | Sev | Finding | Where | Evidence | Fix | Conf |
|---|---|---|---|---|---|---|
| F1 | Critical | Stored XSS into owner session via script thumbnail or title from an anonymous edit link | `app.js:4494` (thumbnail), `4359` (title in `value=""` via `_escHtml`, which does not escape quotes); `018:110-124` | `'<img src="' + scene.thumbnail_data + '"'` is unescaped; RPC `patch_shared_scene` checks only `length > 3000000`; `update_shared_script_title` accepts any 300 chars | In `020`: `p_thumbnail_data` must match `^data:image/(jpeg\|png\|webp\|gif);base64,[A-Za-z0-9+/=]+$` or be empty. In JS use `_esc()` for attributes and set `img.src` via DOM | Confirmed |
| F2 | Critical | Stored XSS into owner session via board item `content` from an anonymous edit link | `boards.js:456` (`c.vid` in img src), `1255-1257` and `1455-1457` (`c.vid` in iframe src via `outerHTML`), `433` (`_bdPathD(pts)` and `c.width` in SVG attributes); `019:84-130` | RPCs accept arbitrary `p_content JSONB`, capped only at 500KB. The client validates `vid` as `[\w-]{11}` (`boards.js:827`) but a direct `rpc('add_shared_board_item')` call bypasses it | In `020`: validate per kind (`vid ~ '^[A-Za-z0-9_-]{11}$'` or `^\d+$`, `points` numeric pairs, `width` numeric, `url ~ '^https?://'`, `path` matches `{owner}/{board}/{uuid}.{ext}`). In JS escape `vid`, coerce points with `Number()` | Confirmed |
| F3 | High | Inbox renders email fields unescaped | `app.js:2228-2237, 2294-2304` | `${item.brand}`, `${item.subject}`, `${item.snippet}`, `${item.context}` (full body) | Latent today because nothing writes `inbox_items`. Becomes live stored-XSS from any email sender the day Gmail ingestion returns. Wrap in `_esc()` now | Confirmed |
| F4 | High | No password reset or change-password path | `index.html:40-66`; grep of `app.js` | Only `signInWithPassword`, `signUp`, `signOut`. `detectSessionInUrl: true` would silently consume a recovery link with no UI to set a new password | `resetPasswordForEmail` with redirect; `onAuthStateChange` handler for `PASSWORD_RECOVERY` showing a new-password form | Confirmed |
| F5 | High | No CSP, no `X-Frame-Options`, no `Referrer-Policy` | `wrangler.jsonc` (assets only); no `public/_headers` | Nothing restricts script sources, so F1 through F3 have no second line of defense | Add `public/_headers` (Workers static assets honor it). Start `Content-Security-Policy-Report-Only`; the 175 inline handlers need `'unsafe-inline'` until Phase 2 delegation | Confirmed |
| F6 | Medium | Unpinned CDN scripts, no Subresource Integrity | `index.html:16-18` | `chart.js` floats latest major; `@supabase/supabase-js@2` floats minor and patch | Pin exact versions with `integrity` and `crossorigin`, or move to npm in Phase 1 | Confirmed |
| F7 | Medium | Anonymous edit links have generous abuse ceilings | `018:115, 133`; `019:95, 98`; `019:171-177` | 3MB times 500 scenes per leaked script link; 500KB times 2,000 items per board; no object-count cap on storage inserts | Cap thumbnails at 300KB (client produces 600px JPEG), `p_content` at 64KB except `draw`, add a count check to the storage INSERT policy | Confirmed |
| F8 | Medium | No share-token rotation; a leaked link cannot be revoked without SQL | `017:24`; `boards.js:645-668`; `app.js:4440-4462` | Only `share_mode` toggles; the token survives | "Reset link" that sets `share_token = uuid_generate_v4()` (owner UPDATE is already allowed by RLS) | Confirmed |
| F9 | Medium | Fresh install from `001` cannot create a profile | `001:14` vs `full_migration_v2.sql:15`; `app.js:383-387` | `001` defines `id UUID PRIMARY KEY REFERENCES auth.users(id)` with no default; the app inserts without `id`. Live works only because it was built from v2 | Migration `020`: drop the FK, add `DEFAULT uuid_generate_v4()`; also record `scripts.share_token` as TEXT | Confirmed |
| F10 | Medium | No account deletion path; deleting an auth user orphans everything | `008:126`; `005`, `008:29` | `profiles.auth_user_id` has no FK to `auth.users` | SECURITY DEFINER `delete_my_account()` that deletes the profile (cascades), purges `storage.objects` under `{profile_id}/`, then an Edge Function for `auth.admin.deleteUser` | Confirmed |
| F11 | Medium | Bank account and routing numbers loaded into a global on every login and included in export | `011:99-101`; `app.js:411-414`; `3451-3465` | Any XSS reads `CREATOR.bankRoutingNumber` directly | Fetch bank fields only when rendering an invoice with the payment block on; warn in the export UI | Confirmed |
| F12 | Low | Logout leaves profile, bank details, boards, scripts, and rendered views in memory | `app.js:273-287` | Resets 11 globals but not `CREATOR`, `RATE_CARD`, `AUDIENCE_DATA`, `BOARDS`, `_scriptsCache`; view sections keep prior HTML | Single `resetAllState()`, or `location.reload()` after `signOut()` | Confirmed |
| F13 | Low | No `onAuthStateChange`; a revoked or expired session leaves the app open with stale data | `app.js:136-137` | Writes fail with toasts; no return to login | Subscribe once; `SIGNED_OUT` calls `handleLogout()` | Confirmed |
| F14 | Low | Owner-entered fields rendered unescaped in Dashboard and Contracts | `app.js:1281, 1481, 1510`; `toolkit-views.js:109, 577-585, 755-764` | `${d.brand}`, `${d.contact}`; `toolkit-views.js` uses `_esc` zero times | Wrap in `_esc()` | Confirmed |
| F15 | Low | `REVOKE ... FROM public` may leave Supabase's default grants to `anon` on internal helpers | `008:50-51`; `018:170`; `019:140` | Harmless (helpers return nothing useful to anon) but the lockdown comment overstates | `REVOKE ... FROM public, anon, authenticated` then grant explicitly. Verify with Appendix A | Plausible |
| F16 | Low | `window.open(it.content.url)` with an unvalidated stored URL | `boards.js:1246, 1464` | `noopener` is set; an edit-link visitor can still plant arbitrary links | Enforce `^https?://` in the F2 validation | Confirmed |
| F17 | Low | Board delete storage cleanup is best-effort and non-recursive | `boards.js:85-90` | `.list(folder, { limit: 1000 })`; objects in subfolders orphan | Do cleanup in a trigger or Edge Function on `boards` delete | Confirmed |
| F18 | Info | Dead `API_BASE` fetches inject responses unescaped | `app.js:6, 2343-2370`; `toolkit-views.js:1050-1069` | Unreachable today (SPA fallback returns HTML, JSON parse throws) | Delete the paths | Confirmed |
| F19 | Info | Private seed data lives in the repo | `migrations/003, 004, 014` | Brand contact emails, deal values, notes. Never served | Keep the repo private; consider a git-ignored `seeds/` folder | Confirmed |

**RLS coverage:** every table the JS touches has a migration, RLS enabled, and all four policy verbs scoped by `current_profile_id()`. The one intentional gap is no DELETE on `profiles`. Two tables have RLS but are never queried (`analytics_snapshots`, `expenses`). Storage: owner policies by folder, anon SELECT for shared boards, anon INSERT and DELETE scoped to the shared board's own folder under its owner's folder, no anon UPDATE (so overwrite-by-upsert is blocked), bucket enforces 10MB and image MIME types.

---

## 5. The four daily tools

These are the surfaces that matter most and where the UX recommendations are most specific.

### Boards (`boards.js`, 1,485 lines)

**What works:** everything in Section 2. The pointer-event gesture model is right for touch. `touch-action: none` on the viewport (`style.css:6650`) keeps the browser from hijacking drags.

**What does not work on the phone:**

- **No pinch-zoom.** The gesture code handles one pointer (`_bdPtr` is a single object, `boards.js:1032-1085`). A second finger's `pointerdown` overwrites the first gesture. Zoom on touch is the plus and minus buttons only. Two-finger pan and pinch is the canonical interaction for a canvas and its absence is felt every time the board opens on a phone. Fix: track active pointers in a `Map`; when two are down, compute distance and midpoint deltas and call `_bdZoomAt` plus pan. Add double-tap to zoom to 100% or fit. (M)
- **No undo on touch.** Undo and redo exist only as `Ctrl-Z` and `Ctrl-Shift-Z` (`boards.js:1293-1302`). On a phone there is no keyboard. Add undo and redo buttons to the toolbar, shown always, enabled by stack length. (S)
- **Delete buttons on the board card list appear only on hover** (`style.css:6574-6579`). On touch they are invisible. Tasks already solved this at 640px (`style.css:5673`); Boards and Scripts did not. (S)
- **The toolbar moves to `bottom: 14px` at 768px** (`style.css:6917-6921`), which is the iPhone home-indicator zone, and the editor is `calc(100vh - 120px)` where `100vh` on iOS is the tallest viewport. Use `100dvh` and `env(safe-area-inset-bottom)`. (S)
- **Format bar under the keyboard.** `_bdPositionFormatBar` places the bar 44px above the item (`boards.js:546-558`). With the keyboard up on a phone, the item is often scrolled under the keyboard and the bar with it. Anchor the format bar to the top of the viewport while editing on narrow screens. (S)
- **Text commit on `focusout`** (`boards.js:1183-1188`). Switching apps on iOS does not always fire `focusout`, so a sticky's text can be lost. Also commit on `visibilitychange` and `pagehide`. (S)

**Data and consistency:**

- **Optimistic updates with no rollback.** Move, resize, recolor, and text edits mutate `_bdItems` and debounce a PATCH; on failure a toast fires but the local state keeps the new value (`boards.js:136-138, 716-729`). The `before` snapshot is already computed for undo (`1077`); revert to it when `sbUpdateBoardItem` returns false. (S)
- **Pending saves are not flushed on navigation.** `_bdPendingSaves` timers (500ms) and `_bdViewSaveTimer` (1s) survive `navigate()`; only orphan cleanup runs on `beforeunload` (`boards.js:1315`). A drag followed by Back within half a second can lose the position. (S, part of the `unmount` lifecycle in Section 10)
- **Content validation belongs in the RPCs** (Section 4, F2). The client's `_bdParseVideoUrl` and image path construction are the spec; encode them as CHECK-style validation in `add_shared_board_item` and `update_shared_board_item`.

**The feature Boards is missing for how Jordan uses it:** boards are handed to brands as edit links. Two people on the same board today do not see each other's changes until reload. Supabase Realtime Broadcast on a `board:{id}` channel, where each client publishes the item op it just saved and applies ops it receives, gives live collaboration without new tables or policy changes. Presence (who is on the board) comes with it. This is the single highest-value board feature and it is medium effort. (M)

### Scripts (`app.js:4090-4720`)

**The data-loss bug.** Typed text lives only in the DOM; the save is an 800ms timer (`_scheduleAutoSave`, `app.js:4538-4543`). Adding a scene, deleting a scene, uploading a thumbnail, or drag-reordering calls `_scriptRerender()` which calls `renderScriptEditor()`, which **re-fetches scenes from the database and rebuilds the DOM** (`4330-4347`). If the timer has not fired yet, the rebuilt textareas hold the database's stale text, and when the timer fires it reads those stale textareas and "saves" them. The typed text is gone. Navigating to another script has the same effect. Confirmed by reading. Fix: update `_currentScenes` on every `input` event so state is the source of truth, `await` a flush before any rerender or navigation, and flush on `beforeunload` and `visibilitychange`. (S)

**Second bug in the same area:** `renderScriptEditor` has no load token. Open script A on a slow connection, tap Back, open script B fast: A's fetch can resolve after B's and paint A into B's route while `_currentScriptId === B`. The next autosave writes A's title onto B (`4549-4551`). Boards solved this with two lines (`boards.js:211, 222`). (S)

**Autosave is wasteful.** `_saveAllSceneData` sends every scene's two text fields on every pause in typing, not the changed ones (`4545-4575`). With 30 scenes that is 30 PATCH requests per pause, or 30 RPC calls in a shared session. Diff against the last-saved snapshot. No in-flight guard either, so two saves can overlap and the earlier one can land last. Serialize saves per scene. (S)

**Title save failures show "Saved."** `sbUpdateScript` catches internally and never rethrows (`4195-4207`), so `_saveAllSceneData`'s catch never sees a title failure and the indicator turns green. Same class as the `sbCall` fix in Section 6. (S)

**Thumbnails are base64 in the database.** `script_scenes.thumbnail_data TEXT` (`007:79`) holds a JPEG data URL per scene. Every script open downloads every thumbnail inline in the scenes query; the shared-edit RPC allows 3MB each. Boards already have the right pattern: Storage bucket, signed URLs, client downscale. Move thumbnails to a `script-media` bucket with the `016` and `019` policy shapes and migrate existing rows with a one-off script. This also removes the F1 vector by construction. (M)

**On the phone:**

- The scene row is a five-column grid that shrinks to `32px 1fr 1fr 90px 28px` at 560px (`style.css:4570`). On a 390px screen the two text columns are about 110px each. Writing a script in a 110px-wide textarea is the worst part of the mobile experience. Under 640px, stack each scene as a card: number and drag handle in a header row, script text full width, scene description full width, thumbnail and actions in a footer row. (M)
- **Reordering uses HTML5 drag-and-drop** (`draggable="true"`, `dragstart`, `dragover`, `drop`, `app.js:4642-4678`). iOS Safari's support for HTML5 DnD on touch is partial and requires a long press with no visual affordance. Replace with pointer-based reorder (the same event model Boards uses) or, cheaper, up and down buttons visible on touch. (S for buttons, M for pointer reorder)
- **Delete on the script card is hover-only** (`style.css:4073-4078`). Same fix as Boards.

### Invoices (`invoices.js`, 1,255 lines)

The most complete feature. Findings are small and precise.

- **Net-terms due dates use UTC.** `invTermDueDate` builds a local-midnight date, adds days, then calls `toISOString()` (`invoices.js:65-72`). In any positive-offset timezone (Europe) local midnight is the previous day in UTC, so Net 30 lands one day early. `invIsOverdue` compares against `todayISO()`, which is also UTC (`app.js:101-104`), so an invoice due today reads "overdue" from 6pm Mountain time. Tasks got this right with `_localISODate` (`app.js:2649`). Use it in both places. (S)
- **Five inline action buttons per row on the phone.** `_renderInvRows` emits up to five `.btn-sm` per row (`invoices.js:252-258`) at roughly 34px tall inside a horizontally scrolling table. On 390px that is a row of tiny targets. Collapse to one primary action (Mark Sent, Record Payment, or nothing) plus an overflow menu under 640px. (S)
- **Editor sub-state is not in the URL.** `_invEditorOpen` persists across routes (`invoices.js:13-20`); Back from an open invoice leaves the Invoices route entirely, and returning shows the editor still open. Use `#invoices/{id}` and `#invoices/new`. (S)
- **Invoice numbering is client-side.** `nextInvoiceNumber` scans `INVOICE_DATA` (`invoices.js:119-135`). Two devices can mint the same number. Fine for one user; for a consumer, a per-profile sequence in the database. (Consumer gate)
- **Bank details** are rendered on the document by design, but they are also loaded at boot and included in the JSON export (Section 4, F11).
- **The red template is excellent engineering** and fragile by nature: pt-absolute positioning (`style.css:6050`) means any font fallback shifts layout. The wait-for-fonts logic protects it. Leave it alone; note the constraint in the code.
- **Two PDF pipelines** exist: print-to-PDF for invoices and jsPDF for the media kit and contracts. jsPDF loads for every user on every page load (`index.html:17`). Lazy-load it on first export. (S)

### Tasks (`app.js:2649-2993`)

Tight and correct. Two things would make it feel instant on the phone.

- **Every mutation is pessimistic.** Checking a task waits for the network before the checkbox changes (`toggleTaskComplete`, `2885-2900`). On a phone this reads as lag on the most frequent action in the app. Flip the local state first, render, then save; revert and toast on failure. The `_taskBusyIds` guard already prevents double-fire. (S)
- **Every mutation rebuilds the whole view with `innerHTML`**, which is why `renderTasks` carries 30 lines of focus and composer preservation (`2692-2711, 2818-2836`). That code is correct but it is a symptom: the view has no way to update one row. Section 10's per-view render with targeted row updates removes the need. Until then it is fine.
- **The edit modal renders inside the view** (`2796-2817`) and sits under the sidebar on desktop (Section 7, F3). Mount on `<body>` like Invoices does.
- **Delete uses `confirm()`** (`2920`). An in-app undo toast (delete immediately, offer Undo for five seconds) is the pattern that feels good on touch and it removes the modal dialog. (S)
- **Due date uses local dates correctly.** Invoices should copy this.
- **Tap targets:** `.task-check` is 22px and `.task-delete` about 24px (`style.css:5525, 5620-5628`). Extend the hit area to 44px with padding or a pseudo-element. (S)

---

## 6. Boot, data, and state

### The boot sequence

`sbFetchAllData` (`app.js:366-668`) issues 17 PostgREST queries in series, plus one insert on first login. Every one is `await`ed before the next starts. There is no `Promise.all`. All are `select('*')` with no `limit` except profiles and rate-card settings.

| # | Query | Table | Consumed by | Verdict |
|---|---|---|---|---|
| 1 | `app.js:381` | profiles | sidebar, media kit, settings, invoice doc, boards upload path | needed at boot |
| 2 | `428` | platforms | media kit, settings, analytics | route-scoped |
| 3 | `449` | rate_card_settings | settings, media kit PDF | route-scoped |
| 4 | `458` | rate_cards | media kit, settings, contracts | route-scoped |
| 5 | `466` | deals with embedded `deal_history` | dashboard, revenue | history is **never read** by any view |
| 6 | `494` | campaign_results | media kit | route-scoped |
| 7 | `503` | outreach_templates | nothing (export only) | **dead load** |
| 8 | `513` | calendar_events | dashboard, calendar | route-scoped |
| 9 | `522` | monthly_revenue | dashboard, revenue | nothing writes it |
| 10 | `531` | audience_data | media kit, settings | route-scoped |
| 11 | `559` | inbox_items with full `body` | inbox | multi-MB for a real inbox; feeds a dead feature |
| 12 | `573` | contract_rules | nothing | **dead load** |
| 13 | `580` | tasks including completed | tasks | needed for Tasks |
| 14 | `597` | clients | invoices | needed for Invoices |
| 15 | `613` | outreach_lists | outreach | route-scoped |
| 16 | `624` | outreach_targets | outreach | route-scoped |
| 17 | `640` | invoices with `line_items` JSONB | invoices | needed for Invoices |

Boards and Scripts load their own data when their tab opens and need only `CREATOR._sbId` from boot. The daily tools are the lazy ones; the eager set is the low-traffic CRM. A hard refresh at `#board/abc` on a phone waits for all 17 queries, then two more for the board, then signed URLs.

**The 8-second race** (`app.js:4730-4736`): `Promise.race([sbFetchAllData(), 8s])` then `navigate()`. If the fetch is slower, the view renders with empty globals, and the fetch keeps running and reassigns `TASKS`, `INVOICE_DATA`, and the rest without re-rendering. A task added in that window with `TASKS.unshift` vanishes from the UI when the late `TASKS = ...` lands. The loader references `#sb-loading-overlay` (`374, 664`), which does not exist in `index.html`, so there is no loading state; the logo overlay is removed after 300ms regardless (`4753-4759`).

**Fix in place (S):** after the profile query, run the rest in `Promise.all`; delete loads 7 and 12 and the `deal_history` embed; drop the race; show a skeleton per view until its data is present. **Fix properly (Phase 2):** boot loads the profile only; each route pulls its own stores.

### Write paths

Style differs by file. Tasks, Calendar, Settings, and Invoices are pessimistic (await, then mutate, then render). Boards is optimistic for updates and deletes with no rollback. Scripts uses the DOM as state with a debounced autosave. Outreach's list-delete sweep fires one update per target without awaiting or rolling back (`outreach.js:276-279`). No retry, no offline queue, no conflict handling anywhere; `updated_at` is set by triggers but never used for anything except sorting.

### Errors that never reach the user

supabase-js does not throw on PostgREST errors; it returns `{ data, error }`. Fourteen call sites ignore `error` and show success or nothing:

`app.js:721-722` (inbox status), `739-740` (calendar delete), `3273`, `3288-3290` (rate card), `3426-3434` (audience upsert inside a try/catch that can never catch a DB error), `4183`, `4191`, `4201`, `4205` (script create, delete, update), `4236`, `4239`, `4247`, `4254` (scene delete, reorder); `toolkit-views.js:58-66` (contract defaults upsert, same try/catch pattern).

Seventeen of 41 `catch` blocks are console-only. Transient fetch failures at boot set `TASKS = []` and the UI shows "No tasks yet" with no retry (`581-585`).

**The toast bug:** `_showSaveError` and `_showSaveSuccess` share one element. Success sets `background = '#2A6B5A'` on every call (`339`); error sets its red only at element creation (`319`). After the first "Saved," every error toast is green. (S)

**Fix:** one `sbCall(promise, label)` helper that checks `error`, toasts with the right color, and returns a boolean. Use it everywhere. (S)

### Routing

Hash routes, full `innerHTML` rebuild on every navigate, no listener leaks found (viewport listeners die with their DOM; document listeners are bound once). Gaps: an unknown hash renders a blank main area (`976-991`); editor sub-state is not in the URL (invoices, outreach drawer, settings tab); `hashchange` is live during boot so a hash change mid-load renders twice.

### Dead CRUD and dead backend

Nine `sb*` functions have zero callers: `sbAddDeal`, `sbUpdateDeal`, `sbAddDealHistory`, `sbUpdateInboxStatus`, `sbAddCalendarEvent`, `sbDeleteCalendarEvent`, `sbUpdatePlatform`, `sbUpdateRateCard`, `sbUpsertScene`. Calendar and Settings re-implement the same inserts inline. There is no deal editor anywhere in the app, so `deals` is read-only seed data that Dashboard and Revenue present as live KPIs.

`API_BASE = "__PORT_8000__"` (`app.js:6`) is still wired to live buttons: Inbox "Draft response" and "Regenerate" (`2303-2305, 2359`) and Contracts "AI Negotiation Notes" (`toolkit-views.js:400`). They fetch `https://arkives.xyz/__PORT_8000__/api/...`, the SPA fallback returns HTML, and `res.json()` throws "Unexpected token <". `runBrandMatch` is called at `app.js:2180` and defined nowhere.

---

## 7. Phone and design system

The CSS agent verified the layout claims below in headless Chrome at 390 by 844.

| ID | Sev | Finding | Where | Fix | Size |
|---|---|---|---|---|---|
| C1 | High | **Mobile header balloons on short views.** `.dashboard { grid-template-rows: 1fr }` is never overridden at 900px; the sidebar goes `position: fixed`, so header and main become the two grid rows and the header takes the `1fr`. Measured: header 611px, main 146px on a short view | `style.css:169-175, 3954-3966` | `.dashboard { grid-template-rows: auto 1fr }` inside the 900px query | S |
| C2 | High | Theme is not persisted and not read from the OS. `<html data-theme="light">` is hardcoded; the toggle only sets the attribute; `localStorage` has zero uses | `index.html:2`; `app.js:1002-1008` | Inline `<script>` in `<head>` reads storage or `matchMedia` and stamps `data-theme` before CSS; persist on toggle | S |
| C3 | High | Calendar and Tasks modals render inside the view and sit under the sidebar. `.main > * { z-index: 1 }` makes each view a stacking context; `.modal-overlay` is declared twice and the second (z=100) wins over the first (z=1000) | `style.css:197, 734, 5425-5428`; `app.js:2535, 2796` | Mount on `<body>` (pattern in `invoices.js:29-38`); delete the duplicate rule | S |
| C4 | High | Paper textures are 3.17MB and 3.74MB PNGs at 1536 by 1024, applied `background-size: cover` on a `position: fixed` pseudo-element on every view | `style.css:162-163, 185-195, 6648` | A 512px seamless tile as WebP (30 to 60KB), tiled everywhere the way Boards already does at 480px | S |
| C5 | High | Dead CSS: 381 of 896 classes unreferenced; 2,408 lines belong to rules whose every class is dead (kanban, pricing, research, brand-match, command-center, expenses, tasks v1, voice) | `style.css:567-680, 1022-1300, 1694-2160, 2432-2725, 3048-3400, 3497-3950` | Delete the sections | M |
| C6 | Medium | Seven uses of `100vh`, none of `dvh`. With `html, body { overflow: hidden }` iOS never collapses the address bar, so the bottom of every view sits under Safari's bar; the 80px bottom padding is the band-aid | `style.css:151, 173, 205, 4085, 4481, 4591, 6585, 6928` | `100dvh` with a `100vh` fallback; `max-height: 85dvh` on sheets | S |
| C7 | Medium | No safe-area handling; viewport meta lacks `viewport-fit=cover` | `index.html:7`; `style.css:6917-6921` | Add the meta; pad main, toolbar, and sidebar with `env(safe-area-inset-*)` | S |
| C8 | Medium | Hover-only delete buttons on Scripts and Boards cards | `style.css:4073-4078, 6574-6579` | `@media (hover: none) { opacity: 1 }` | S |
| C9 | Medium | Tap targets under 44px: `.btn-sm` about 34px, `.task-delete` 24px, `.bd-item-btn`, `.sidebar-logout` 24px, `.task-check` 22px, scene delete in a 28px column | `style.css:5083, 5620-5628, 6696, 4800, 5525, 4573` | 44px hit areas; collapse invoice row actions on mobile | M |
| C10 | Medium | Modals are fixed-size desktop dialogs (`500px`, `380px`, `480px`); only the outreach drawer is full-width | `style.css:740-749, 5430-5437, 6175-6180, 4363-4370` | One `.sheet` component: bottom sheet under 640px, centered dialog above | M |
| C11 | Medium | Token drift: radius tokens are 1 to 2px but literals are 6, 8, 10, 12px; eight soft shadows alongside hard-offset tokens; no spacing or type-scale tokens | `style.css:93-100` | Define radius, shadow, space, and type tokens and replace literals | M |
| C12 | Medium | 142 hardcoded color literals in CSS outside token blocks; 163 `style=""` attributes and 36 hex literals in JS; 14 light-theme accent and teal tints used in dark mode; toast colors in `cssText` | `colors.py` census; `style.css:4681, 4722, 4811, 4888, 4996, 5081, 5121, 5258, 5263, 5267, 5356, 5386, 5391`; `app.js:91, 320, 334` | `--accent-dim`, `--teal-dim` tokens; `.toast` class | M |
| C13 | Medium | `--text-muted` fails AA: `#8A8580` on `#F5F1ED` is 3.25:1, used for 10 to 12px table headers and labels. Accent on dark `bg-1` is 4.13:1 | `style.css:67, 118, 545` | Darken muted to about `#6E6963` light and `#8C8680` dark; micro-labels to 11 to 12px | S |
| C14 | Medium | No `role="dialog"`, focus trap, or Escape on the main modals; focus never returns | `outreach.js:225, 250`; `boards.js:952, 1289` are the only Escape handlers | One `openSheet()` helper | M |
| C15 | Medium | 22 `outline: none`, one `:focus-visible` rule in the file; `.btn` has no focus style | `style.css:680-691, 808-809` and others | Global `:focus-visible` ring; stop nulling outlines | S |
| C16 | Low | No `prefers-reduced-motion`; 8 keyframes, 3 infinite spinners, 23 `transition: all` | `style.css:44, 226, 2869-2883, 4930` | Wrap animations; name transition properties | S |
| C17 | Low | Render-blocking scripts in `<head>`; jsPDF loads for everyone | `index.html:14-18` | `defer` all; lazy-load jsPDF | S |
| C18 | Low | Inputs are 14px, so iOS zooms the page on focus | `style.css:805, 835, 4248, 4669` | 16px inputs under 640px | S |
| C19 | Low | Icon-only buttons without labels; font-weight 800 used but not loaded | `app.js:1425, 1681`; `toolkit-views.js:396, 408, 412` | Add `aria-label`; use 700 | S |

**Component sprawl:** 29 button class definitions, 10 modal or overlay implementations, about 20 root card variants, 6 empty-state styles, 4 toast implementations of which 3 are dead and the live one is inline `cssText` copied three times. Section 10 proposes the consolidated set.

**Print CSS** is well isolated (`#invPrintHost` hidden except under `body.printing-invoice`) and the red template's fragility is inherent to pt-exact layout. No change recommended.

---

## 8. The other nine views

Rated for a fresh account. "Complete" means full CRUD, empty states, no owner-specific constants.

| View | Status | What is wrong | To complete |
|---|---|---|---|
| Dashboard | Read-only | KPIs read `deals.paid` and `deals.outstanding`, which have no editor, so they are frozen seed data while Invoices is live. `avgValue` divides by the count of deals with a value and prints `$NaN` when that is zero (`app.js:1058`). Status literals from Jordan's seed (`1053, 1082`); `STATUS_MAP` still has "Pointed to Shawn" (`39`) | Compute from invoices and tasks. Better: make Dashboard the "today" screen for the daily tools (tasks due, overdue invoices, recent boards and scripts) |
| Inbox | Broken | No ingestion path; the three draft buttons call the deleted backend; "Last scan: today" is fabricated (`2196`); `approveDraft` alerts "would send via Gmail API" (`2402`); no empty state; email fields unescaped (F3) | Hide from nav until Gmail ingest exists. When it does, ingest via a Worker or Edge Function with the user's OAuth token, never a shared key |
| Revenue | Read-only | Reads deals and seeded `monthly_revenue`; ignores `INVOICE_DATA` entirely; "Coming Soon" expenses card (`1281-1291`); `new Chart` unguarded if the CDN is blocked (`1321`) | Paid and outstanding from invoices; monthly from invoice paid dates; expenses inside Revenue per the V1 bar |
| Media Kit | Complete for display | Engagement, likes, and videos cannot be edited in Settings (`3181` writes handle and followers only), so a fresh kit shows "0% Engagement"; PDF hardcodes "New Account" for Twitter (`3742`) | Editable platform stats; a live shareable web version alongside PDF |
| Analytics | Read-only | Reads `social_stats.payload`; nothing in the app writes it (only seed `014`). Copy claims "Live data via Social Blade" and "Each time you refresh, new data points are saved" (`1679, 1852`), both false. Prints "undefined" if payload keys are missing (`1826, 1830`) | A manual "log my numbers" form writing `social_stats`, then a scheduled fetch later |
| Outreach | Complete | None found | Done |
| Contracts | Partial | `CONTRACT_DEFAULTS` hardcodes Asterisk LLC, Managing Member, Colorado (`toolkit-views.js:5-9`); `loadContractDefaults` runs only from `renderContracts` (`84`), so Settings shows Jordan's values for any account that has not visited Contracts, and saving from there persists them into a stranger's `user_settings`. Fallback deliverables at $15,000 (`98-102`); `cGovLaw` fixed to Colorado (`373`); no contracts table, so nothing is saved per deal | Blank defaults; load at boot; a `contracts` table; drop the AI button |
| Calendar | Complete for add and delete | No edit of existing events; duplicate inline CRUD instead of the `sb*` functions | Edit; per-user ICS feed per the V1 bar |
| Settings | Mostly complete | `minRate \|\| 15000` silently writes Jordan's floor when blank (`3283`); audience age range and top age set in memory but never persisted (`3415-3436`); `addOns` rate category loaded but not shown (`3212-3218`) | Remove the fallback; persist all audience fields |

**A structural recommendation.** The product Jordan uses is a creator studio (Boards, Scripts, Invoices, Tasks) with a half-alive CRM around it. For both lenses, every visible view should work. Three moves: make Dashboard and Revenue truthful by reading invoices (M); hide Inbox until it has a data source (S); keep Media Kit, Analytics, Contracts, Calendar, Outreach as a secondary group. On the phone, a bottom tab bar with the four daily tools and a "More" tab for the rest replaces the hamburger drawer for the 90 percent case (Section 10).

---

## 9. Dead code, schema drift, documentation

### Dead functions (zero callers across all JS and HTML)

`daysSince` (`app.js:64`), `daysClass` (`106`), `sbAddDeal` (`670`), `sbUpdateDeal` (`687`), `sbAddDealHistory` (`712`), `sbUpdateInboxStatus` (`719`), `sbAddCalendarEvent` (`726`), `sbDeleteCalendarEvent` (`737`), `sbUpdatePlatform` (`890`), `sbUpdateRateCard` (`899`), `quickBrandMatch` (`2168`, calls undefined `runBrandMatch`), `safeGet` and `safeSet` (`3485, 3489`, mandated by README rule 1 and used by nothing), `sbUpsertScene` (`4223`).

Unread globals: `PIPELINE_STATUSES` (`25`), `CONTRACT_RULES` (`308`, assigned at `574`, never read), `_sbReady` (`312`), `_memStore` (`3483`), `OUTREACH_TEMPLATES` (`123`, export only). `SKETCHY_ICONS.chevron` (`349`) is unused. The `#sb-loading-overlay` element is referenced twice and does not exist.

### Schema drift

| Item | Code | Migration | Note |
|---|---|---|---|
| `profiles.id` default | insert omits `id` (`app.js:383`) | `001:14` FK to `auth.users`, no default | Live has v2's `DEFAULT uuid_generate_v4()`. Fresh-install blocker |
| `scripts.share_token` | RPCs take TEXT and cast (`018`) | `007:65` UUID | Live is TEXT with an unrecorded default |
| `deals.mapped_status` | never read (JS calls `mapStatus()`) | `001:132` | Dead column |
| `platforms.tier, posts, likes, videos, connections, verified, status, profile_url` | read at `428-440`, never written | `001` | Unreachable from UI |
| `rate_cards.rate_range, pct, platform` | read at `455`, never written | `001` | Unreachable |
| `audience_data` categories `age`, `topCountries`, `topCities` | read `532-549`, only `gender` is ever written (`3428`) | `001:431` | Half-wired |
| `inbox_items.category, classification, deal_id`; `invoices.deal_id`; `calendar_events.deal_id`; `profiles.avatar_url` | never touched | `001` | Dead columns |
| `user_id` passed explicitly | `2618, 3186, 3290, 3311, 3428`; `toolkit-views.js:60` | `008:158` default | Harmless; contradicts README line 287 |

Tables never queried by JS: `analytics_snapshots`, `expenses` (the V1 bar says keep it), and load-only `contract_rules`, `outreach_templates`. Drop candidates: `analytics_snapshots`, `contract_rules`, `outreach_templates`.

Migration numbering: `007` ran live as "006" and `008` as "007" (documented in their footers). `001` was re-run live on 2026-07-13 and resurrected 11 dropped tables, which `009` re-drops. Table-count comments disagree across `006`, `009`, `010`, `011`, `012`; the actual count is 26.

**Fresh-install order that would actually work:** `001`, then a new `020` (profiles id default, drop the FK, record `scripts.share_token` as TEXT, content validation for the share RPCs, drop the three dead tables), then `005`, `007`, `008`, `009`, `010`, `011`, `012`, `013`, `015`, `016`, `017`, `018`, `019`. Never `002`, `003`, `004`, `014`, or the `full_migration*` files.

**Why drift keeps happening.** There is no mechanical check between the repo and the live database. Every migration was applied by hand in the SQL editor and the repo was updated afterward, sometimes under a different number. This audit's own findings (F9, the share_token type, share_mode) are all the same failure class. Two fixes, either is enough: adopt the Supabase CLI with `supabase db diff` and `supabase db push` so the repo is the source of truth, or commit the output of Appendix A as `schema-snapshot.json` after every migration and diff it in CI. The CLAUDE.md principle applies: mechanical enforcement over good intentions.

### README

Stale or wrong: Workers vs "Cloudflare Pages" (lines 28, 216, 234-237); domain "arkives.creator" (30); file tree lists `analytics_cache.json`, `api_server.py`, `command-center.js`, `google-apps-script.js`, `expense_*`, `test-console.html`, none of which are tracked, and omits `invoices.js`, `outreach.js`, the invoice assets, fonts, and the verify skill; "25+ tables" and a table list that names 12 dropped tables and omits 7 live ones (90-97); the `#pipeline` route (35); the data-variables list names 11 globals with zero occurrences in any JS (111-134); the CRUD list names 11 functions that do not exist (136-146); the views table lists three cut views and omits five live routes (150-168); "Critical Rules" mixes product rules with Jordan's personal business rules, contradicted by line 288 (193-204); two contradictory Migration Status tables, the second headerless (208-231); "Remaining: RLS anon to user-scoped" is done (243-244); `sbFetchAllData` "~line 575" is at 366 (253); the fresh-install order omits `005`, `010` through `013`, `015` through `019` and the profiles fix (281).

Recommendation: rewrite the README to under 150 lines with the corrected file tree, the corrected views table, the fresh-install order above, and the multi-tenancy rules. Move Jordan's business rules to the business repo where they already live.

### Tooling

No tests, no CI, no `package.json`. `npx eslint public/` fails because the `globals` package is not installed, and even with it the config declares CDN globals for libraries the app does not use (d3, gsap, THREE) while omitting `supabase` and `jspdf` and every cross-file global, so it would drown in false `no-undef` errors. The Playwright recipe in `.claude/skills/verify/SKILL.md` is the seed of a smoke test.

Minimal CI (S): `package.json` with `eslint`, `globals`, `playwright`; a corrected ESLint config; a workflow that lints, serves `public/`, and runs a Playwright script that stubs state, calls `navigate()` for all 13 views with both populated and empty globals, and asserts no uncaught errors. The empty-globals pass would have caught `$NaN`, "undefined", and the blank Inbox.

---

## 10. Target architecture

Jordan's constraints: lighter is better, features must be useful, the result must be beautiful, big moves are welcome, server-side code needs a reason.

### Recommendation

**Vite plus native ES modules, no UI framework.** Keep template literals and `innerHTML` rendering; they are fast at this scale and 9,000 lines already work that way. Replace the 175 inline `onclick` handlers (app.js 61, invoices.js 48, outreach.js 40, boards.js 11, toolkit-views.js 9, index.html 6) with one delegated listener per view keyed on `data-action`. That single change is what makes a strict Content Security Policy possible, which is the durable answer to the XSS class.

Why not a framework: Preact, Lit, or Svelte would mean rewriting every view for a benefit (DOM diffing) the app needs in exactly two places (Tasks and Invoices rerender-preserve-focus code), and the Boards editor already does its own per-node DOM updates and would fight a virtual DOM. Why Vite and not import maps: unpinned CDN dependencies (F6), no minification, no hashed assets, and a worse dev loop. Vite costs one `package.json` and changes `assets.directory` in `wrangler.jsonc` to `./dist`. The output is still plain static files on Workers. If a later view genuinely wants a reactive renderer, Preact with `htm` is 4KB and can live next to this without a build change; do not mix paradigms inside one view.

**Optional and recommended: `// @ts-check` with JSDoc types**, added file by file, plus `supabase gen types` for the database. The drift class in Section 9 (renamed columns, half-wired shapes) is exactly what types catch, and JSDoc gets most of the benefit without a rewrite.

### Module shape

```
src/
  lib/        sb.js (client + sbCall), toast.js, esc.js, format.js (money, dates in local time), icons.js
  stores/     profile.js, tasks.js, invoices.js, clients.js, boards.js, scripts.js, outreach.js, calendar.js
  views/      tasks.js, invoices.js, boards.js, board-editor.js, scripts.js, script-editor.js, ...
  router.js   routes map with lazy imports; each view exports mount(el, params) and unmount()
  main.js     boot: getSession, profile.load(), mount the route
```

A store is small: `load()` (idempotent, memoized promise), `get()`, `subscribe(fn)`, and domain writes that own the optimistic or pessimistic policy and rollback. Views subscribe in `mount` and unsubscribe in `unmount`. `unmount` is where autosaves flush and timers die; that one lifecycle hook fixes the Scripts data loss, the Boards pending-save leak, and the invoice sub-state bug at once.

Boot becomes: session, profile, mount the route. The route pulls only its stores. A deep link to a board loads the profile and the board, nothing else.

### Design system

Tokens (one PR): keep the 31 existing color pairs; add `--accent-dim`, `--teal-dim`, `--overlay`, `--shadow-soft`; fix `--text-muted` contrast; add `--space-1` through `--space-8` (4 to 40px), `--radius-sm|md|lg` (4, 8, 12), `--text-xs` through `--text-display` with `clamp()` on display.

Components, folding the sprawl: `.btn` with variants (29 classes fold in), `.card` with `--kpi` and `--clickable`, `.sheet` (bottom sheet under 640px, centered dialog above, mounted on body, `role="dialog"`, Escape, focus trap, focus return), `.popover`, `.row` (leading control, body, trailing 44px actions; Tasks, Invoices, Outreach, Scripts rows), `.empty`, `.toast`, `.field` (label, 16px input on mobile, hint, focus ring).

**Phone navigation:** a bottom tab bar with Boards, Scripts, Invoices, Tasks, and More. The drawer stays for the secondary views. This is the one structural UX move that changes how the app feels in the hand, and it follows directly from the usage map.

**Paper texture** as a tiled WebP; hand-drawn icons unchanged; Instrument Serif and General Sans unchanged.

### Platform pieces

- **`public/_headers`** for CSP, frame, and referrer headers. No Worker code needed; Workers static assets honor the file.
- **PWA manifest** (`display: standalone`, icons, theme color) so Arkives installs on the home screen and opens without Safari chrome. No service worker required for that; add one later for shell caching if wanted. (S)
- **Supabase Realtime Broadcast** for shared boards: a `board:{id}` channel; clients publish item ops after saving and apply incoming ops. Presence for free. No new tables, no policy changes. (M)
- **`script-media` Storage bucket** for scene thumbnails, with `016` and `019` policy shapes. (M)
- **Migration `020`** for content validation in the share RPCs, the profiles drift, token rotation, and abuse caps.
- **Worker code only when a feature needs it:** OpenGraph previews for shared links (so a board link pasted into a brand's Slack shows a title), a per-user ICS feed, Gmail ingest. Each is a small handler on the existing Worker. An Edge Function for account deletion because it needs the service role.
- **CI:** lint plus the Playwright smoke test, and a schema-snapshot diff.

---

## 11. Roadmap

Each phase ships on its own. Order is by risk. Nothing requires a rewrite freeze.

**Phase 0: safety and phone hotfixes (one session).** Section 3 items 1 through 11. Migration `020` first, then the JS escaping, password reset, auth state listener, autosave flush and load token, `Promise.all` boot with dead loads removed, the grid-rows fix, theme persistence, `dvh` and safe-area, hover-only buttons, paper tile, toast fix and `sbCall`, body-mounted modals, `_headers` in report-only, pinned CDN with integrity. Every item is S and Jordan feels most of them on the phone the same day.

**Phase 1: tooling and CI (one session).** *Reordered 2026-09-03: the five classic scripts share reassignable globals, which ES modules cannot do, so the Vite conversion moves to Phase 2 where the store layer gives modules something to import. Phase 1 as shipped: package.json with pinned devDependencies, ESLint that runs with mechanically generated app globals, the smoke and logic checks as repo tests, GitHub Actions CI.* Original plan follows. `package.json`, Vite with `index.html` as the entry, the five files become modules that end with `Object.assign(window, { ...handlers })` so inline handlers keep working, `supabase-js` and `chart.js` from npm, jsPDF lazy-loaded, `wrangler.jsonc` pointed at `dist/`, ESLint fixed, the Playwright smoke test on both populated and empty state, schema snapshot committed.

**Phase 2: structure (one to two sessions).** Extract `lib/`; add `sbCall` everywhere; stores for tasks, clients, invoices, profile; router with `mount` and `unmount` and lazy imports; boot loads profile only; convert inline handlers to delegation view by view; switch CSP from report-only to enforced once the last inline handler is gone.

**Phase 3: the daily tools (one session each, as daily use demands).**
- Boards: pinch and double-tap zoom, undo and redo buttons, rollback on failed save, commit text on `visibilitychange`, Realtime Broadcast for shared boards.
- Scripts: state-as-truth autosave with per-scene diff and serialized saves, thumbnails to Storage, stacked scene cards under 640px, pointer-based reorder.
- Invoices: local-date terms, row overflow menu on mobile, `#invoices/{id}` routes.
- Tasks: optimistic toggles with rollback, undo toast instead of `confirm()`, 44px targets.
- PWA manifest.

**Phase 4: design system (one to two sessions).** Delete the 2,400 dead lines; tokens; `:focus-visible` and reduced motion; components in the order empty, toast, button, popover, card, field, sheet, row; bottom tab bar on mobile; contrast fixes.

**Phase 5: the consumer gate (when a real consumer moment arrives).** Account deletion; onboarding (name, entity, one platform, minimum rate); token rotation and abuse caps; blank contract defaults loaded at boot; Dashboard and Revenue from invoices; Inbox hidden or connected; Analytics manual entry; Media Kit editable stats; server-side invoice numbering; README rewrite; per-user cost model including board and script media.

---

## Appendix A: live schema check

`introspect.sql` at the repo root is a single read-only SELECT. Paste the whole file into the Supabase SQL Editor and run it. It returns one row per section (tables with sizes and row counts, columns, policies, storage policies and usage, functions with grants, indexes, triggers, constraints, auth summary, scene-thumbnail totals, share state) with the payload as JSON. Copy the result as JSON and hand it back; it answers F15, confirms the F9 and share_token drift on live, and shows how much of `script_scenes` is thumbnail bytes. Commit the output as `schema-snapshot.json` after every migration and the drift class in Section 9 becomes a diff in CI.

## Appendix B: V1-AUDIT reconciliation

| Item | Status | Evidence |
|---|---|---|
| 0.1 RLS | Done | `008:128-164` |
| 0.2 profile claim | Done | `app.js:379-395` |
| 0.3 private data deploy | Done | `wrangler.jsonc` |
| 0.4 console logging | Done | `app.js:651-659` logs counts only |
| 0.5 drift migrations | Done | `007` |
| 0.6 seed split | Done, docs stale | README line 281 incomplete |
| 1.1 Expenses crash | Moot | view cut |
| 1.2 load invoices | Done | `app.js:639-645` |
| 1.3 API_BASE | Open | `app.js:2329`; `toolkit-views.js:1053` |
| 1.4 share links | Done | `018`, init checks `shared/` first |
| 1.5 init race | Open | `app.js:4735-4738` |
| 2.1 deal editing | Open, and worse | no deal UI exists at all |
| 2.2 dashboard widgets | Moot | tables dropped |
| 2.3 settings | Done | `app.js:3111-3436` |
| 2.4 calendar | Done | `app.js:2609-2647` |
| 2.5 inbox | Open | no write path |
| 2.6 expenses | Moot | placeholder |
| 2.7 invoice lifecycle | Done | `invoices.js:390-492, 856` |
| 2.8 monthly from paid | Open | reads seeded `monthly_revenue` |
| 2.9 scripts multi-user | Done | `008` default |
| 2.10 contracts | Partial | defaults persist; no contracts table; Jordan fallbacks |
| 2.11 money convergence | Open | Revenue never reads `INVOICE_DATA` |
| 3.1 media kit | Done | `app.js:1379-1390` |
| 3.2 analytics | Partial | per-user table, no entry form, false copy |
| 3.3 identity sweep | Partial | `app.js:39, 3283`; `toolkit-views.js:6-9, 98-102, 299, 373, 539, 552`; `001:88-89` |
| 3.4 empty states | Partial | missing on Inbox, Revenue, Dashboard KPIs |
| 3.5 onboarding | Open | profile auto-created from email prefix |
| 4.1 dead files | Done | six tracked root files |
| 4.2 cut CS/BV | Done | `toolkit-views.js` is 1,071 lines |
| 4.3 README | Partial | see Section 9 |
| 4.4 theme persist | Open | `app.js:1002-1008` |

## Appendix C: method and confidence

Read directly by the lead: `app.js` lines 1-1050 (client, auth, loader, CRUD, routing), 2649-2995 (Tasks), 4090-4762 (Scripts, init); `boards.js` and `invoices.js` in full; `index.html`; migrations `008`, `010`, `011`, `016`, `017`, `018`, `019`; the `_esc` and `_escHtml` implementations; the relevant CSS rules for touch, viewport, and breakpoints.

Four parallel read-only audits covered security (all migrations, every `innerHTML` site, auth flow, headers, storage policies), CSS and mobile (token census, dead-CSS script, breakpoint map, headless Chrome at 390 by 844 for the layout claims, contrast ratios computed), the data layer (query census, call graph of `sb*` functions, write-path policy per file, per-file dependency list), and views plus dead code plus docs (call graph of 341 functions, schema-vs-code column diff, README claim by claim, V1-AUDIT reconciliation). Their headline claims were re-verified by the lead against the source before inclusion.

Not done: no live database access (no service-role key was stored; Appendix A covers it), no accounts created on production, no real-device testing (the CSS claims are headless Chrome at phone dimensions, which does not reproduce iOS Safari's dynamic viewport; those items are marked by reasoning from the CSS, not by measurement).

---

## Progress log

**2026-09-03, same day as the audit.** Phases 0, 1, 3, and the mechanical half of 4 shipped as local commits on `main` (not pushed; pushing deploys). Every commit was verified with the repo's own harness: `npm run lint`, `npm test` (58 logic checks with Supabase stubbed, plus a smoke run of 13 views in populated and empty state at desktop and phone width), and `npm run test:live` for Realtime.

| Commit | Phase | What shipped |
|---|---|---|
| `9371112` | 0 | Migration `020` (share-RPC content validation, thumbnail validation, per-board upload cap, profiles drift). Render-side escaping for every path in F1 through F3. Forgot-password flow and `onAuthStateChange`. Boot in one round trip, no 8s race, four dead loads gone. Scripts autosave rebuilt on state with flush-before-repaint and a load token. Error toast color, Supabase errors checked in 14 places. Local-date invoice terms. Mobile header fix, theme persistence, `100dvh` and safe areas, body-mounted modals, touch-visible delete buttons, paper texture 7MB to 180KB, `_headers` with report-only CSP, pinned CDN scripts with integrity hashes, PWA manifest. |
| `302cdb7` | 1 | `package.json`, ESLint that runs (app globals generated mechanically), `tests/checks.mjs`, `tests/smoke.mjs`, GitHub Actions CI, README development section and corrected fresh-install order. Vite deferred to Phase 2 (see the note in Section 11). |
| `03d2a70` | 3a | Boards: two-finger pan and pinch zoom, undo and redo buttons, format bar placement on phones, text commit on tab hide, live sync for shared boards over Realtime Broadcast (verified end to end). Scripts: stacked scene cards under 640px, move up and down buttons. |
| `3277072` | 3b | Invoices: `#invoices/new` and `#invoices/{id}` routes, row actions as a bottom sheet on phones. Tasks: optimistic toggles with revert, delete with Undo toast, 44px targets. Focus ring, reduced motion, muted-text contrast, 16px inputs on phones, bottom tab bar for the four daily tools. |
| `31b269e` | 4a | Dead CSS purge: 506 rules, 2,303 lines, pixel-verified across 53 screenshots. |

**Not done, in recommended order:**
1. **Jordan:** run `migrations/020_share_hardening.sql` in the Supabase SQL editor, then push `main` (push deploys). Confirm `https://arkives.xyz` is the Site URL in Supabase Auth so the password-reset redirect lands. Delete the three test auth users. Optionally paste `introspect.sql` and hand back the JSON.
2. **Phase 2 (modules):** Vite plus native ES modules, `lib/` extraction, per-domain stores, router with `mount` and `unmount`, inline handlers to delegation view by view, then flip the CSP from report-only to enforced. This is the one change that can break the whole app if half-done; do it in a dedicated session with the harness green at every step.
3. **Phase 3 leftovers:** script thumbnails to a Storage bucket (migration `021` mirroring `016` and `019`), pointer-based scene reorder, board rollback on failed save (retry is in place).
4. **Phase 4 remainder:** tokens for space, radius, shadow, and type; the component set (`.sheet`, `.row`, `.btn` variants, `.card`, `.toast`, `.empty`, `.field`); modal accessibility (`role="dialog"`, focus trap, Escape).
5. **Phase 5 (consumer gate):** account deletion, onboarding, share-token rotation, contract defaults blanked and loaded at boot, Dashboard and Revenue from invoices, Inbox hidden or connected, Analytics manual entry, server-side invoice numbering, README rewrite, cost model.
