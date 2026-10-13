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

const VIEWS = ['dashboard', 'inbox', 'revenue', 'mediakit', 'analytics', 'outreach', 'boards', 'scripts', 'ideas', 'quotes', 'timelines', 'contracts', 'invoices', 'calendar', 'tasks', 'settings'];
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
  __arkives.state.IDEAS = [{ _sbId: 'id1', title: 'Hook: <img src=x onerror="window.__xss=1">', notes: 'line one\nline two <b>x</b>', archived: false, archivedAt: '', createdAt: '2026-09-01T00:00:00Z' },
           { _sbId: 'id2', title: 'Used one', notes: '', archived: true, archivedAt: '2026-09-02T00:00:00Z', createdAt: '2026-08-01T00:00:00Z' }];
  __arkives.state._ideasArchivedOpen = true;
  __arkives.state.INVOICE_DATA = [{ _sbId: 'i1', invoiceNumber: 'ACME-0001', brand: 'Acme', billToName: 'Acme Media', billToAddress: '2 St', date: '2026-08-01', dueDate: '2026-08-31', status: 'sent', lineItems: [{ type: 'flat', desc: 'Reel', qty: 1, rate: 0, fee: 12000 }], amount: 12000, amountPaid: 0, tax: 0, notes: '', includePaymentInfo: true, paymentTerms: 'net30', clientId: 'c1', description: 'Reel' },
                  { _sbId: 'i2', invoiceNumber: 'ACME-0002', brand: 'Acme', billToName: 'Acme Media', billToAddress: '', date: '2026-09-01', dueDate: '', status: 'draft', lineItems: [{ type: 'hourly', desc: 'Edit', qty: 3, rate: 100, fee: 0 }], amount: 300, amountPaid: 0, tax: 0, notes: 'n', includePaymentInfo: false, paymentTerms: 'none', clientId: null, description: 'Edit' }];
  __arkives.state.CLIENTS = [{ _sbId: 'c1', name: 'Jane', company: 'Acme Media', email: 'j@acme.com', billingAddress: '2 St', invoicePrefix: 'ACME' }];
  __arkives.state.CALENDAR_EVENTS = [{ _sbId: 'e1', date: new Date().toISOString().slice(0,10), brand: 'Acme', type: 'Post', platform: 'instagram', status: 'scheduled' }];
  __arkives.state.INVOICE_DATA.push({ _sbId: 'i9', invoiceNumber: 'ACME-0002', brand: 'Acme', billToName: 'Acme Media', date: new Date().toISOString().slice(0,10), status: 'paid', paidAt: new Date().toISOString(), lineItems: [{ type: 'flat', desc: 'Hero film edit', qty: 1, rate: 0, fee: 8500 }], amount: 8500, amountPaid: 8500, tax: 0 });
  __arkives.state._dashRecent = { at: Date.now(), boards: [{ id: 'b1', title: 'Dropbox campaign moodboard with a very long title that should truncate', updated_at: new Date(Date.now() - 3600e3).toISOString() }, { id: 'b2', title: 'Spring lookbook', updated_at: new Date(Date.now() - 2 * 864e5).toISOString() }], scripts: [{ id: 's1', title: 'UGC 30s: coffee', updated_at: new Date().toISOString() }] };
  Object.assign(__arkives.state.CREATOR.platforms.youtube, { handle: 'test', followers: '612', followersNum: 612, videos: 11 });
  Object.assign(__arkives.state.CREATOR.platforms.twitter, { handle: 'test', followers: '2.3K', followersNum: 2315, posts: 184 });
  Object.assign(__arkives.state.CREATOR.platforms.linkedin, { handle: 'test', followers: '481', followersNum: 481, connections: 441 });
  Object.assign(__arkives.state.CREATOR.platforms.instagram, { engagement: '11.85%' });
  __arkives.state.CREATOR.platforms.tiktok.likes = '3.8M';
  __arkives.state.CREATOR.platforms.tiktok.handle = 'test'; __arkives.state.CREATOR.platforms.tiktok.followers = '32.1K'; __arkives.state.CREATOR.platforms.tiktok.followersNum = 32100;
  __arkives.state.analyticsLastFetch = new Date().toISOString();
  __arkives.state.INBOX_ITEMS = [{ _sbId: 'm1', id: 1, brand: '<img src=x onerror="window.__xss=1">', contact: 'Eve', email: 'e@x.com', subject: '<b>Hi</b>', time: 'today', snippet: 's', status: 'needs_reply', priority: 'medium', suggestedAction: 'reply', context: 'body' }];
  __arkives.state.MONTHLY_REVENUE = [{ _sbId: 'm', month: 'Aug 2026', earned: 5000 }];
  __arkives.state.CAMPAIGN_RESULTS = [{ _sbId: 'cr', brand: '<i>Acme</i>', views: 100000, ctr: 1.2, conversion: null, revenue: 12000 }];
  __arkives.state.OUTREACH_TARGETS = []; __arkives.state.OUTREACH_LISTS = [];
  __arkives.state.QUOTE_SERVICES = [{ _sbId: 's1', name: 'Editing day', description: 'Post', unit: 'day', rate: null, sortOrder: 1 }, { _sbId: 's2', name: 'Hero <b>film</b>', description: '', unit: 'flat', rate: 40000, sortOrder: 2 }];
  __arkives.state.QUOTES = [
    { _sbId: 'q1', clientId: 'c1', invoiceId: null, quoteNumber: 'Q-0001', title: 'Spring <img src=x onerror="window.__xss=1">', clientName: 'Jane', clientCompany: 'Acme Media', clientEmail: 'j@acme.com', clientAddress: '2 St', fromName: 'Test LLC', fromEmail: 't@example.com', fromAddress: '1 Main St', scope: 'One hero film\n\nEight cuts', timeline: 'May', exclusions: 'Talent', lineItems: [{ desc: 'Hero film', detail: 'Shoot + post', unit: 'flat', qty: 1, rate: 40000 }, { desc: 'Editing', detail: '', unit: 'day', qty: 3, rate: 1500 }], total: 44500, depositPct: 50, balanceTerms: 'delivery', revisionRounds: 2, usageRights: '6 months paid', notes: '', issueDate: '2026-10-01', validUntil: '2099-01-01', status: 'accepted', shareToken: 'tok1', viewedAt: '2026-10-02', respondedAt: '2026-10-03T00:00:00Z', acceptedName: 'Jane Doe', declineReason: '', responseSeen: false },
    { _sbId: 'q2', clientId: null, invoiceId: null, quoteNumber: 'Q-0002', title: 'UGC set', clientName: 'Bo', clientCompany: '', clientEmail: '', clientAddress: '', fromName: 'Test LLC', fromEmail: '', fromAddress: '', scope: '', timeline: '', exclusions: '', lineItems: [{ desc: 'UGC cut', detail: '', unit: 'each', qty: 4, rate: 0 }], total: 0, depositPct: 0, balanceTerms: 'NET30', revisionRounds: 0, usageRights: '', notes: 'n', issueDate: '2026-10-01', validUntil: '2026-01-01', status: 'sent', shareToken: 'tok2', viewedAt: '', respondedAt: '', acceptedName: '', declineReason: '', responseSeen: true }];
  __arkives.state.TIMELINES = [{ _sbId: 'tl1', title: 'Fall launch <img src=x onerror="window.__xss=1">', clientName: 'Acme "Co"', clientLogo: '', fromName: 'Test LLC', fromLogo: '', kickoffDate: new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10), notes: 'Product ships Oct 20.', status: 'shared', shareToken: 'ttok', viewedAt: '', createdAt: '2026-10-01',
    steps: [['pre', 'Kickoff <b>call</b>', 1, 'both', true, true], ['pre', 'Shot list & prep', 5, 'you', false, true], ['pre', 'Skipped step', 2, 'you', false, false], ['prod', 'Shoot day', 1, 'you', true, true], ['post', 'First cut', 3, 'you', false, true], ['post', 'Brand review', 2, 'brand', true, true], ['post', 'Full edit with a long descriptive name that wraps', 6, 'you', false, true], ['post', 'Final delivery', 1, 'you', true, true]]
      .map(([phase, name, days, owner, cal, on], i) => ({ id: 's' + i, phase, name, detail: i === 1 ? 'Script, locations, <img src=x onerror="window.__xss=1">' : '', days, owner, cal, on })) },
    { _sbId: 'tl2', title: '', clientName: '', clientLogo: '', fromName: '', fromLogo: '', kickoffDate: '', notes: '', status: 'draft', shareToken: 't2', viewedAt: '', createdAt: '2026-10-01', steps: [] }];
};
const EMPTY = () => {
  __arkives.state.CREATOR._sbId = '00000000-0000-0000-0000-000000000001';
  __arkives.state.DEALS = []; __arkives.state.TASKS = []; __arkives.state.IDEAS = []; __arkives.state.INVOICE_DATA = []; __arkives.state.CLIENTS = []; __arkives.state.CALENDAR_EVENTS = []; __arkives.state.INBOX_ITEMS = []; __arkives.state.MONTHLY_REVENUE = []; __arkives.state.CAMPAIGN_RESULTS = [];
  __arkives.state.OUTREACH_TARGETS = []; __arkives.state.OUTREACH_LISTS = [];
  __arkives.state.QUOTES = []; __arkives.state.QUOTE_SERVICES = []; __arkives.state.TIMELINES = [];
  __arkives.state._dashRecent = { at: Date.now(), boards: [], scripts: [] }; __arkives.state.analyticsData = null; __arkives.state.analyticsLastFetch = null;
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

    if (state === 'populated') {
      // Public shared board (#bshared/TOKEN): fills the window, fits its
      // items to this screen, shows no app chrome, and hands the app back.
      currentView = 'shared-board';
      await page.evaluate(() => {
        const st = __arkives.state;
        window.__realSb = st._sb;
        const board = { id: 'SB1', title: 'Campaign <b>board</b>', share_mode: 'view', user_id: 'U1', view_x: 900, view_y: -700, view_zoom: 1.4 };
        const items = [
          { id: 'i1', board_id: 'SB1', kind: 'note', x: -400, y: 200, w: 300, h: 200, z: 1, content: { text: '', color: 'yellow' } },
          { id: 'i2', board_id: 'SB1', kind: 'text', x: 300, y: 300, w: 300, h: 40, z: 2, content: { text: 'Hero concept', size: 'body' } },
          { id: 'i3', board_id: 'SB1', kind: 'image', x: 700, y: 900, w: 300, h: 300, z: 3, content: { path: 'U1/SB1/missing.webp' } },
        ];
        // Only the two calls a shared board makes are stubbed; everything
        // else (a fetch another view still has in flight) reaches the real client
        st._sb = Object.create(window.__realSb || null, {
          rpc: { value: async (name) => ({ data: name === 'get_shared_board' ? [board] : items }) },
          storage: { value: { from: () => ({ download: async () => ({ data: null, error: { message: 'Object not found' } }) }) } },
          channel: { value: undefined },
        });
        location.hash = 'bshared/tok'; __arkives.navigate('bshared/tok');
      });
      await page.waitForTimeout(500);
      const sh = await page.evaluate(() => {
        const vpEl = document.getElementById('bdViewport');
        const r = vpEl ? vpEl.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0, width: 0 };
        const rects = [...document.querySelectorAll('.bd-item')].map(e => e.getBoundingClientRect());
        const tb = document.querySelector('.board-topbar');
        const shown = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
        return {
          vw: window.innerWidth, vh: window.innerHeight, w: Math.round(r.width), bottom: Math.round(r.bottom),
          items: rects.length,
          inside: rects.filter(b => b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1).length,
          topbarClipped: !!tb && [...tb.children].some(c => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().right > window.innerWidth + 1),
          chrome: ['#sidebar', '.mobile-header', '#tabbar'].filter(shown),
          title: document.title, injected: !!document.querySelector('.bd-title b'),
          missing: document.querySelectorAll('.bd-media-missing').length,
          placeholder: getComputedStyle(document.querySelector('.bd-kind-note .bd-text-content'), '::before').content,
          scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });
      if (sh.w < sh.vw - 2) flagged.push(`shared board is ${sh.w}px wide in a ${sh.vw}px window`);
      if (sh.bottom < sh.vh - 2) flagged.push(`shared board stops at ${sh.bottom}px in a ${sh.vh}px window`);
      if (sh.items !== 3 || sh.inside !== 3) flagged.push(`shared board opens with ${sh.inside}/${sh.items} items in view`);
      if (sh.topbarClipped) flagged.push('shared board top bar runs off the screen');
      if (sh.chrome.length) flagged.push(`shared board shows app chrome: ${sh.chrome.join(', ')}`);
      if (sh.title !== 'Campaign <b>board</b> · Arkives') flagged.push(`shared board tab title is "${sh.title}"`);
      if (sh.injected) flagged.push('shared board title rendered as HTML');
      if (sh.missing !== 1) flagged.push('an image that failed to load is not marked unavailable');
      if (!/none|normal/.test(sh.placeholder)) flagged.push(`empty sticky shows a placeholder to viewers (${sh.placeholder})`);
      if (sh.scrollX) flagged.push('shared board: horizontal page overflow');
      await page.screenshot({ path: path.join(OUTDIR, `${state}-${vp.name}-shared-board.png`), animations: 'disabled' });
      const back = await page.evaluate(() => {
        __arkives.state._sb = window.__realSb;
        location.hash = 'dashboard'; __arkives.navigate('dashboard');
        const sb = document.getElementById('sidebar');
        return { cls: document.body.className, sidebar: getComputedStyle(sb).display, title: document.title,
                 mainW: Math.round(document.querySelector('.main').getBoundingClientRect().width), vw: window.innerWidth };
      });
      if (/share-/.test(back.cls)) flagged.push(`shared chrome left on after leaving (${back.cls})`);
      if (back.sidebar === 'none') flagged.push('sidebar still hidden after leaving a shared board');
      if (/Campaign/.test(back.title)) flagged.push('tab title not restored after leaving a shared board');
      if (vp.name === 'desktop' && back.mainW > back.vw - 200) flagged.push(`app layout not restored after a shared board (main ${back.mainW}px)`);
    }
    if (state === 'populated') {
      // Quote editor (a new draft with a menu service added) and the
      // client's quote page (#q/TOKEN) at this width
      currentView = 'quote-editor';
      await page.evaluate(() => {
        location.hash = 'quotes/new'; __arkives.navigate('quotes/new');
        const q = __arkives.state._q;
        Object.assign(q, { clientId: 'c1', clientName: 'Jane', clientCompany: 'Acme Media', clientEmail: 'j@acme.com', title: 'Spring hero film', scope: 'One 60s hero film plus eight vertical cuts.\n\nColor-graded and captioned.', timeline: '2-day shoot in May', exclusions: 'Talent, travel, licensed music' });
        __arkives.renderQuoteEditor();
        __arkives.ACTIONS.qAddService('s2'); __arkives.ACTIONS.qAddService('s1');
      });
      await page.waitForTimeout(200);
      const qe = await page.evaluate(() => {
        const v = document.getElementById('view-quotes');
        return { lines: v.querySelectorAll('.inv-li').length, unpriced: v.querySelectorAll('.quote-li-unpriced').length, injected: !!v.querySelector('#qDocPreview b'),
                 scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
      });
      if (qe.lines !== 2) flagged.push(`quote editor: adding two menu services gave ${qe.lines} lines`);
      if (qe.unpriced !== 1) flagged.push('quote editor: an unpriced menu service is not flagged');
      if (qe.injected) flagged.push('quote editor: service name rendered as HTML');
      if (qe.scrollX) flagged.push('quote editor: horizontal page overflow');
      await page.screenshot({ path: path.join(OUTDIR, `${state}-${vp.name}-quote-editor.png`), animations: 'disabled', fullPage: true });

      currentView = 'quote-public';
      await page.evaluate(() => {
        const st = __arkives.state;
        window.__realSb = st._sb;
        const row = { quote_number: 'Q-0001', title: 'Spring hero film', client_name: 'Jane', client_company: 'Acme Media', client_email: 'j@acme.com', client_address: '2 St\nDenver, CO 80202', from_name: 'Test LLC', from_email: 't@example.com', from_address: '1 Main St\nDenver, CO', scope: 'One 60s hero film plus eight vertical cuts.\n\nColor-graded and captioned.', timeline: '2-day shoot in May', exclusions: 'Talent, travel, licensed music', line_items: [{ desc: 'Hero film', detail: 'Pre-production, 2-day shoot, post', unit: 'flat', qty: 1, rate: 40000 }, { desc: 'Editing day', detail: '', unit: 'day', qty: 3, rate: 1500 }, { desc: 'UGC cut, 30s', detail: 'Native vertical', unit: 'each', qty: 8, rate: 0 }], deposit_pct: 50, balance_terms: 'delivery', revision_rounds: 2, usage_rights: 'Client owns the final deliverables on full payment.', notes: '', issue_date: '2026-10-01', valid_until: '2099-01-01', status: 'sent', expired: false };
        st._sb = Object.create(window.__realSb || null, { rpc: { value: async () => ({ data: row, error: null }) } });
        location.hash = 'q/tok'; __arkives.navigate('q/tok');
      });
      await page.waitForTimeout(300);
      const qp = await page.evaluate(() => {
        const shown = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
        return { doc: !!document.querySelector('#view-quote-public .quote-doc'), accept: !!document.getElementById('qPubName'),
                 chrome: ['#sidebar', '.mobile-header', '#tabbar'].filter(shown),
                 scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
      });
      if (!qp.doc || !qp.accept) flagged.push('quote page: document or accept form missing');
      if (qp.chrome.length) flagged.push(`quote page shows app chrome: ${qp.chrome.join(', ')}`);
      if (qp.scrollX) flagged.push('quote page: horizontal page overflow');
      await page.screenshot({ path: path.join(OUTDIR, `${state}-${vp.name}-quote-public.png`), animations: 'disabled', fullPage: true });
      await page.evaluate(() => { __arkives.state._sb = window.__realSb; location.hash = 'dashboard'; __arkives.navigate('dashboard'); });

      // Timeline editor and the brand's timeline page (#t/TOKEN) at this width
      currentView = 'timeline-editor';
      await page.evaluate(() => { location.hash = 'timelines/tl1'; __arkives.navigate('timelines/tl1'); });
      await page.waitForTimeout(250);
      const te = await page.evaluate(() => {
        const v = document.getElementById('view-timelines');
        return { switches: v.querySelectorAll('.tl-switch').length, bars: v.querySelectorAll('#tlPreview .tl-g-bar').length, injected: !!v.querySelector('#tlPreview b, #tlPreview img[src="x"]'),
                 scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
      });
      if (te.switches !== 8) flagged.push(`timeline editor: ${te.switches} step switches, expected 8`);
      if (te.bars !== 7) flagged.push(`timeline editor: ${te.bars} bars in the preview, expected 7 (one step skipped)`);
      if (te.injected) flagged.push('timeline editor: step or title rendered as HTML');
      if (te.scrollX) flagged.push('timeline editor: horizontal page overflow');
      await page.screenshot({ path: path.join(OUTDIR, `${state}-${vp.name}-timeline-editor.png`), animations: 'disabled', fullPage: true });

      currentView = 'timeline-public';
      await page.evaluate(() => {
        const st = __arkives.state;
        window.__realSb = st._sb;
        const t = st.TIMELINES[0];
        const row = { title: 'Fall launch: 3 hero videos', client_name: 'Acme', client_logo: '', from_name: 'Test LLC', from_logo: '', kickoff_date: t.kickoffDate, notes: t.notes, status: 'shared', steps: t.steps.filter((s) => s.on) };
        st._sb = Object.create(window.__realSb || null, { rpc: { value: async () => ({ data: row, error: null }) } });
        location.hash = 't/ttok'; __arkives.navigate('t/ttok');
      });
      await page.waitForTimeout(300);
      const tp = await page.evaluate(() => {
        const shown = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
        return { card: !!document.querySelector('#view-timeline-public .tl-card'), today: !!document.querySelector('#view-timeline-public .tl-g-today'),
                 gcal: document.querySelectorAll('#view-timeline-public .tl-gcal').length, ics: !!document.querySelector('[data-action="tlPublicIcs"]'),
                 chrome: ['#sidebar', '.mobile-header', '#tabbar'].filter(shown),
                 scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
      });
      if (!tp.card) flagged.push('timeline page: card missing');
      if (!tp.today) flagged.push('timeline page: no today marker on a running project');
      if (tp.gcal !== 4 || !tp.ics) flagged.push(`timeline page: ${tp.gcal} Google Calendar links (expected 4) or no calendar file button`);
      if (tp.chrome.length) flagged.push(`timeline page shows app chrome: ${tp.chrome.join(', ')}`);
      if (tp.scrollX) flagged.push('timeline page: horizontal page overflow');
      await page.screenshot({ path: path.join(OUTDIR, `${state}-${vp.name}-timeline-public.png`), animations: 'disabled', fullPage: true });
      await page.evaluate(() => { __arkives.state._sb = window.__realSb; location.hash = 'dashboard'; __arkives.navigate('dashboard'); });
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
