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

const POPULATED = `
  CREATOR.name = 'Test Creator'; CREATOR.brand = 'Test Brand'; CREATOR.entity = 'Test LLC'; CREATOR.email = 't@example.com'; CREATOR._sbId = '00000000-0000-0000-0000-000000000001';
  CREATOR.businessAddress = '1 Main St\\nDenver, CO'; CREATOR.bankName = 'Bank'; CREATOR.bankAccountNumber = '123'; CREATOR.invoiceNumbering = 'per_client'; CREATOR.invoicePrefix = 'INV'; CREATOR.invoiceTemplate = 'classic';
  CREATOR.platforms.instagram.handle = '@test'; CREATOR.platforms.instagram.followers = '270K'; CREATOR.platforms.instagram.followersNum = 270000; CREATOR.platforms.instagram._sbId = 'p1';
  RATE_CARD.organic = [{ id: 'r1', name: 'Reel', rate: 15000, _sbId: 'rc1' }]; RATE_CARD.minimumRate = 15000;
  DEALS = [{ _sbId: 'd1', brand: 'Acme "Quotes" & <Co>', status: 'Active', value: 12000, contact: 'Jane', email: 'j@acme.com', paid: 6000, invoiced: 12000, outstanding: 6000, lastContact: '2026-08-01', negotiationHistory: [] },
           { _sbId: 'd2', brand: 'Beta', status: 'Lead', value: 0, contact: '', email: '', paid: 0, invoiced: 0, outstanding: 0, lastContact: '2026-08-20', negotiationHistory: [] }];
  TASKS = [{ _sbId: 't1', title: 'Send <b>deck</b>', details: 'x', dueDate: '2026-09-04', starred: true, completed: false, completedAt: '', createdAt: '2026-09-01T00:00:00Z' },
           { _sbId: 't2', title: 'Done thing', details: '', dueDate: '', starred: false, completed: true, completedAt: '2026-09-02T00:00:00Z', createdAt: '2026-09-01T00:00:00Z' }];
  INVOICE_DATA = [{ _sbId: 'i1', invoiceNumber: 'ACME-0001', brand: 'Acme', billToName: 'Acme Media', billToAddress: '2 St', date: '2026-08-01', dueDate: '2026-08-31', status: 'sent', lineItems: [{ type: 'flat', desc: 'Reel', qty: 1, rate: 0, fee: 12000 }], amount: 12000, amountPaid: 0, tax: 0, notes: '', includePaymentInfo: true, paymentTerms: 'net30', clientId: 'c1', description: 'Reel' },
                  { _sbId: 'i2', invoiceNumber: 'ACME-0002', brand: 'Acme', billToName: 'Acme Media', billToAddress: '', date: '2026-09-01', dueDate: '', status: 'draft', lineItems: [{ type: 'hourly', desc: 'Edit', qty: 3, rate: 100, fee: 0 }], amount: 300, amountPaid: 0, tax: 0, notes: 'n', includePaymentInfo: false, paymentTerms: 'none', clientId: null, description: 'Edit' }];
  CLIENTS = [{ _sbId: 'c1', name: 'Jane', company: 'Acme Media', email: 'j@acme.com', billingAddress: '2 St', invoicePrefix: 'ACME' }];
  CALENDAR_EVENTS = [{ _sbId: 'e1', date: new Date().toISOString().slice(0,10), brand: 'Acme', type: 'Post', platform: 'instagram', status: 'scheduled' }];
  INBOX_ITEMS = [{ _sbId: 'm1', id: 1, brand: '<img src=x onerror="window.__xss=1">', contact: 'Eve', email: 'e@x.com', subject: '<b>Hi</b>', time: 'today', snippet: 's', status: 'needs_reply', priority: 'medium', suggestedAction: 'reply', context: 'body' }];
  MONTHLY_REVENUE = [{ _sbId: 'm', month: 'Aug 2026', earned: 5000 }];
  CAMPAIGN_RESULTS = [{ _sbId: 'cr', brand: '<i>Acme</i>', views: 100000, ctr: 1.2, conversion: null, revenue: 12000 }];
  OUTREACH_TARGETS = []; OUTREACH_LISTS = [];
`;
const EMPTY = `
  CREATOR._sbId = '00000000-0000-0000-0000-000000000001';
  DEALS = []; TASKS = []; INVOICE_DATA = []; CLIENTS = []; CALENDAR_EVENTS = []; INBOX_ITEMS = []; MONTHLY_REVENUE = []; CAMPAIGN_RESULTS = [];
  OUTREACH_TARGETS = []; OUTREACH_LISTS = [];
`;

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
    await page.evaluate((stub) => {
      document.getElementById('loaderOverlay')?.remove();
      document.getElementById('authScreen').style.display = 'none';
      document.getElementById('appShell').style.display = '';
      (0, eval)(stub);
    }, state === 'populated' ? POPULATED : EMPTY);

    const flagged = [];
    for (const v of VIEWS) {
      currentView = v;
      await page.evaluate((v) => { location.hash = v; navigate(v); }, v);
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
      if (['dashboard', 'tasks', 'invoices', 'boards'].includes(v)) await page.screenshot({ path: path.join(OUTDIR, `${state}-${vp.name}-${v}.png`) });
    }

    if (state === 'populated' && vp.name === 'desktop') {
      currentView = 'modals';
      const hit = await page.evaluate(() => {
        location.hash = 'tasks'; navigate('tasks'); openEditTaskModal('t1');
        const a = document.elementFromPoint(60, 300)?.className || '';
        closeEditTaskModal();
        location.hash = 'calendar'; navigate('calendar'); openAddEventModal();
        const b = document.elementFromPoint(60, 300)?.className || '';
        closeAddEventModal();
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
