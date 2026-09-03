---
name: verify
description: Verify Arkives frontend changes by driving the real SPA headlessly. Use after changing public/*.js, index.html, or style.css.
---

# Verifying Arkives

Arkives is a vanilla-JS SPA in `public/`, served static (Cloudflare Workers), backed by Supabase. There is no build step.

## Launch

```bash
python3 -m http.server 8741 --directory public &
```

## Drive

The claude-in-chrome extension is often not connected on this machine — go straight to Playwright with the installed Chrome (no browser download needed):

```bash
cd <scratchpad> && npm install playwright
# chromium.launch({ channel: 'chrome', headless: true })
```

**Auth bypass for UI verification** (Supabase login isn't scriptable here; RLS blocks anon writes anyway). In `page.evaluate`:

```js
document.getElementById('loaderOverlay')?.remove();
document.getElementById('authScreen').style.display = 'none';
document.getElementById('appShell').style.display = '';
// stub state (assign on window.__arkives.state): CREATOR (+ fields), CLIENTS, INVOICE_DATA, DEALS, TASKS...
location.hash = '#invoices'; navigate('invoices');
```

All views render from `__arkives.state` (the app is native ES modules; nothing is a bare global anymore): `__arkives.navigate('<view>')` after stubbing state exercises the real render path. Settings tabs: `__arkives.switchSettingsTab('<tab>')`. Override I/O with `__arkives.db.sbXxx = async () => ...`.

## Gotchas

- `html, body { overflow: hidden }` — Playwright `fullPage` screenshots clip; screenshot the element (`page.locator('.inv-doc').screenshot()`) or the viewport instead.
- Supabase fetch errors in console are expected noise when stubbed — filter them before judging console cleanliness.
- Print/PDF paths: stub `window.print`, call the export fn, then `page.emulateMedia({media:'print'})` + `page.pdf()` renders through the real print CSS.
- Save/write paths can't be verified without a logged-in session AND the relevant migration applied in Supabase — verify the guard behavior (`_showSaveError` toast, setup cards) instead, and say so in the report.

## Worked example

`scratchpad/verify-invoices.js` pattern (2026-07-21, invoice builder): stub state → assert list KPIs/badges → click through editor → assert live preview text (exact money strings) → probe (toggle off, remove line, hostile prefixes, missing-migration guard) → element screenshot + page.pdf.
