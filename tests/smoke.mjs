// Smoke test: drive the real SPA headlessly with stubbed state and assert
// that every view renders without errors at desktop and phone widths, in
// both a populated account and a fresh empty one. Also checks the things
// the 2026-09 audit found broken: escaping, modal stacking, mobile header
// height, theme persistence, horizontal overflow.
//
//   npm run test:smoke          (uses the installed Chrome; see _server.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer, launchOptions } from './_server.mjs';

const PORT = 8741;
const OUTDIR = fileURLToPath(new URL('./.shots/', import.meta.url));
fs.mkdirSync(OUTDIR, { recursive: true });

const VIEWS = ['dashboard', 'inbox', 'revenue', 'mediakit', 'analytics', 'outreach', 'boards', 'scripts', 'contracts', 'invoices', 'calendar', 'tasks', 'settings'];
// Supabase calls fail under anon RLS in tests; that noise is expected.
const NOISE = /supabase|Failed to fetch|net::ERR|fetch|NetworkError|Load failed|401|403|PGRST|JWT|favicon|ERR_INTERNET|ERR_NAME|fontshare/i;

// Stubs run in the page as functions (never eval: the page CSP forbids it).
const POPULATED = () => {
  __arkives.state.CREATOR.name = 'Test Creator'; __arkives.state.CREATOR.brand = 'Test Brand'; __arkives.state.CREATOR.entity = 'Test LLC'; __arkives.state.CREATOR.email = 't@example.com'; __arkives.state.CREATOR._sbId = '00000000-0000-0000-0000-000000000001';
  __arkives.state.CREATOR.businessAddress = '1 Main St\nDenver, CO'; __arkives.state.CREATOR.bankName = 'Bank'; __arkives.state.CREATOR.bankAccountNumber = '123'; __arkives.state.CREATOR.invoiceNumbering = 'per_client'; __arkives.state.CREATOR.invoicePrefix = 'INV'; __arkives.state.CREATOR.invoiceTemplate = 'classic';
  __arkives.state.CREATOR.platforms.instagram.handle = '@test'; __arkives.state.CREATOR.platforms.instagram.followers = '270K'; __arkives.state.CREATOR.platforms.instagram.followersNum = 270000; __arkives.state.CREATOR.platforms.instagram._sbId = 'p1';
  __arkives.state.RATE_CARD.organic = [{ id: 'r1', name: 'Reel', rate: 15000, _sbId: 'rc1' }]; __arkives.state.RATE_CARD.minimumRate = 15000;
  __arkives.state.DEALS = [{ _sbId: 'd1', brand: 'Acme "Quotes" & <Co>', status: 'Active', value: 12000, contact: 'Jane', email: 'j@acme.com', paid: 6000, invoiced: 12000, outstanding: 6000, lastContact: '2026-08-01', negotiationHistory: [] },
           { _sbId: 'd2', brand: 'Beta', status: 'Lead', value: 0, contact: '', email: '', paid: 0, invoiced: 0, outstanding: 0, lastContact: '2026-08-20', negotiationHistory: [] }];
  __arkives.state.TASKS = [{ _sbId: 't1', title: 'Send <b>deck</b>', details: 'x', dueDate: '2026-09-04', starred: true, completed: false, completedAt: '', createdAt: '2026-09-01T00:00:00Z' },
           { _sbId: 't2', title: 'Done thing', details: '', dueDate: '', starred: false, completed: true, completedAt: '2026-09-02T00:00:00Z', createdAt: '2026-09-01T00:00:00Z' }];
  __arkives.state.INVOICE_DATA = [{ _sbId: 'i1', invoiceNumber: 'ACME-0001', brand: 'Acme', billToName: 'Acme Media', billToAddress: '2 St', date: '2026-08-01', dueDate: '2026-08-31', status: 'sent', lineItems: [{ type: 'flat', desc: 'Reel', qty: 1, rate: 0, fee: 12000 }], amount: 12000, amountPaid: 0, tax: 0, notes: '', includePaymentInfo: true, paymentTerms: 'net30', clientId: 'c1', description: 'Reel' },
                  { _sbId: 'i2', invoiceNumber: 'ACME-0002', brand: 'Acme', billToName: 'Acme Media', billToAddress: '', date: '2026-09-01', dueDate: '', status: 'draft', lineItems: [{ type: 'hourly', desc: 'Edit', qty: 3, rate: 100, fee: 0 }], amount: 300, amountPaid: 0, tax: 0, notes: 'n', includePaymentInfo: false, paymentTerms: 'none', clientId: null, description: 'Edit' }];
  __arkives.state.CLIENTS = [{ _sbId: 'c1', name: 'Jane', company: 'Acme Media', email: 'j@acme.com', billingAddress: '2 St', invoicePrefix: 'ACME' }];
  __arkives.state.CALENDAR_EVENTS = [{ _sbId: 'e1', date: new Date().toISOString().slice(0,10), brand: 'Acme', type: 'Post', platform: 'instagram', status: 'scheduled' }];
  __arkives.state.INBOX_ITEMS = [{ _sbId: 'm1', id: 1, brand: '<img src=x onerror="window.__xss=1">', contact: 'Eve', email: 'e@x.com', subject: '<b>Hi</b>', time: 'today', snippet: 's', status: 'needs_reply', priority: 'medium', suggestedAction: 'reply', context: 'body' }];
  __arkives.state.MONTHLY_REVENUE = [{ _sbId: 'm', month: 'Aug 2026', earned: 5000 }];
  __arkives.state.CAMPAIGN_RESULTS = [{ _sbId: 'cr', brand: '<i>Acme</i>', views: 100000, ctr: 1.2, conversion: null, revenue: 12000 }];
  __arkives.state.OUTREACH_TARGETS = []; __arkives.state.OUTREACH_LISTS = [];
};
const EMPTY = () => {
  __arkives.state.CREATOR._sbId = '00000000-0000-0000-0000-000000000001';
  __arkives.state.DEALS = []; __arkives.state.TASKS = []; __arkives.state.INVOICE_DATA = []; __arkives.state.CLIENTS = []; __arkives.state.CALENDAR_EVENTS = []; __arkives.state.INBOX_ITEMS = []; __arkives.state.MONTHLY_REVENUE = []; __arkives.state.CAMPAIGN_RESULTS = [];
  __arkives.state.OUTREACH_TARGETS = []; __arkives.state.OUTREACH_LISTS = [];
};


const server = await startServer(PORT);
const browser = await chromium.launch(launchOptions());
const failures = [];
const note = (s) => console.log(s);

for (const state of ['populated', 'empty']) {
  for (const vp of [{ w: 1280, h: 800, name: 'desktop' }, { w: 390, h: 844, name: 'phone' }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.name === 'phone', isMobile: vp.name === 'phone' });
    const page = await ctx.newPage();
    const errors = [];
    let currentView = 'boot';
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(`${currentView}: ${m.text().slice(0, 200)}`); });
    page.on('pageerror', e => errors.push(`${currentView}: PAGEERROR ${String(e.message).slice(0, 200)}`));
    await page.goto(`http://localhost:${PORT}/#dashboard`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      document.getElementById('loaderOverlay')?.remove();
      document.getElementById('authScreen').style.display = 'none';
      document.getElementById('appShell').style.display = '';
    });
    await page.evaluate(state === 'populated' ? POPULATED : EMPTY);

    const flagged = [];
    for (const v of VIEWS) {
      currentView = v;
      await page.evaluate((v) => { location.hash = v; __arkives.navigate(v); }, v);
      await page.waitForTimeout(v === 'boards' || v === 'scripts' ? 1200 : 300);
      const m = await page.evaluate(() => {
        const hdr = document.querySelector('.mobile-header');
        const view = document.querySelector('.view.active');
        const txt = (view && view.innerText) || '';
        return {
          headerH: hdr ? Math.round(hdr.getBoundingClientRect().height) : null,
          nan: /\$NaN|\bundefined\b|\[object Object\]/.test(txt),
          xss: !!window.__xss,
          scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });
      if (m.nan) flagged.push(`${v}: NaN/undefined in text`);
      if (m.xss) flagged.push(`${v}: injection stub executed`);
      if (m.scrollX) flagged.push(`${v}: horizontal page overflow`);
      if (vp.name === 'phone' && m.headerH > 80) flagged.push(`${v}: mobile header ${m.headerH}px`);
      await page.screenshot({ path: path.join(OUTDIR, `${state}-${vp.name}-${v}.png`), animations: 'disabled' });
      if (vp.name === 'phone') {
        const t = await page.evaluate(() => ({
          tabbar: getComputedStyle(document.getElementById('tabbar')).display,
          tabH: Math.round(document.getElementById('tabbar').getBoundingClientRect().height),
          more: document.querySelector('.inv-row-more') ? getComputedStyle(document.querySelector('.inv-row-more')).display : 'n/a',
          inline: document.querySelector('.inv-row-inline') ? getComputedStyle(document.querySelector('.inv-row-inline')).display : 'n/a',
        }));
        if (t.tabbar === 'none') flagged.push(`${v}: tab bar hidden on phone`);
        if (t.tabH < 48) flagged.push(`${v}: tab bar only ${t.tabH}px tall`);
        if (v === 'invoices' && state === 'populated' && (t.more !== 'inline-flex' || t.inline !== 'none')) flagged.push(`invoices: row actions not collapsed on phone (more=${t.more}, inline=${t.inline})`);
      }
    }

    if (state === 'populated' && vp.name === 'phone') {
      // Script editor at phone width: rows stack as cards, header hidden
      currentView = 'script-editor-phone';
      const m = await page.evaluate(() => {
        const c = document.getElementById('view-script-editor');
        document.querySelectorAll('.view').forEach(v => { v.style.display = 'none'; });
        c.style.display = 'block';
        __arkives.state._currentScriptId = 'S1'; __arkives.state._sharedScriptToken = null;
        __arkives.state._currentScriptRow = { id: 'S1', title: 'Phone script', share_mode: 'none', share_token: 't' };
        __arkives.state._currentScenes = [{ id: 'a', script_text: 'Open on the journal', scene_description: 'Overhead, warm key light', thumbnail_data: '' },
                          { id: 'b', script_text: 'Match cut to iPad', scene_description: 'Medium shot', thumbnail_data: '' }];
        __arkives._renderEditorUI(c, __arkives.state._currentScriptRow, __arkives.state._currentScenes, false);
        const row = c.querySelector('.script-scene-row');
        const cols = getComputedStyle(row).gridTemplateColumns.split(' ').length;
        const hdr = getComputedStyle(c.querySelector('.script-scene-header')).display;
        const ta = c.querySelector('.script-cell-textarea');
        return { cols, hdr, taWidth: Math.round(ta.getBoundingClientRect().width), vw: window.innerWidth };
      });
      if (m.cols !== 1) flagged.push(`script rows not stacked on phone (${m.cols} columns)`);
      if (m.hdr !== 'none') flagged.push('script column header visible on phone');
      if (m.taWidth < m.vw * 0.7) flagged.push(`script textarea only ${m.taWidth}px wide on a ${m.vw}px phone`);
      await page.screenshot({ path: path.join(OUTDIR, `${state}-${vp.name}-script-editor.png`), animations: 'disabled' });
    }
    if (state === 'populated' && vp.name === 'desktop') {
      currentView = 'modals';
      const hit = await page.evaluate(() => {
        location.hash = 'tasks'; __arkives.navigate('tasks'); __arkives.openEditTaskModal('t1');
        const a = document.elementFromPoint(60, 300)?.className || '';
        __arkives.closeEditTaskModal();
        location.hash = 'calendar'; __arkives.navigate('calendar'); __arkives.openAddEventModal();
        const b = document.elementFromPoint(60, 300)?.className || '';
        __arkives.closeAddEventModal();
        return { a, b };
      });
      if (!/modal/.test(hit.a)) flagged.push(`task modal does not cover sidebar (hit: ${hit.a})`);
      if (!/modal/.test(hit.b)) flagged.push(`calendar modal does not cover sidebar (hit: ${hit.b})`);
    }
    if (state === 'empty' && vp.name === 'desktop') {
      currentView = 'theme';
      await page.evaluate(() => document.getElementById('themeToggle').click());
      const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      if (before !== after) flagged.push(`theme not persisted (${before} -> ${after})`);
      await page.evaluate(() => { try { localStorage.removeItem('arkives-theme'); } catch (e) {} });
    }

    const label = `[${state}/${vp.name}]`;
    note(`${label} errors=${errors.length} flagged=${flagged.length}`);
    errors.forEach(e => note('   ERR ' + e));
    flagged.forEach(f => note('   FLAG ' + f));
    failures.push(...errors.map(e => label + ' ' + e), ...flagged.map(f => label + ' ' + f));
    await ctx.close();
  }
}
await browser.close();
server.close();
if (failures.length) { console.log(`\nSMOKE FAILED: ${failures.length} problem(s)`); process.exit(1); }
console.log('\nSMOKE OK');
