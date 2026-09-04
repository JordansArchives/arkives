// Logic checks: load the real app, stub Supabase at the function boundary,
// and assert the behavior the 2026-09 audit fixed. Fast (one page load).
//
//   npm run test:checks
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { startServer, launchOptions, siteHeaders, ROOT } from './_server.mjs';

// ---- Static guards (source, not runtime) ----
// The Content-Security-Policy has no 'unsafe-inline' for scripts, so an
// inline handler or inline <script> would silently do nothing in
// production. Catch it here, at the point of introduction.
const staticOut = [];
const S = (name, cond, detail) => staticOut.push({ name, pass: !!cond, detail: detail === undefined ? '' : String(detail) });
const SRC = ['index.html', 'theme.js', ...(function ls(d) { return fs.readdirSync(ROOT + d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? ls(d + e.name + '/') : (e.name.endsWith('.js') ? [d + e.name] : [])); })('src/')];
const INLINE_RE = /\son(click|dblclick|input|change|keydown|keyup|keypress|submit|load|error|focus|blur|mouse[a-z]+|pointer[a-z]+|touch[a-z]+|contextmenu|wheel|scroll|paste|drop|drag[a-z]*)\s*=/gi;
const actionNames = new Set();
const inlineHits = [], badArgs = [];
for (const f of SRC) {
  const src = fs.readFileSync(ROOT + f, 'utf8');
  src.split('\n').forEach((ln, i) => {
    for (const m of ln.matchAll(INLINE_RE)) inlineHits.push(f + ':' + (i + 1) + ' on' + m[1]);
    for (const m of ln.matchAll(/data-(action|input|change|keydown|submit)="([^"]*)"/g)) actionNames.add(m[2]);
    // constant args must be a JSON array (dynamic ones go through _args at runtime)
    for (const m of ln.matchAll(/data-(args|input-args|change-args|keydown-args|submit-args)="([^"]*)"/g)) {
      if (/\$\{|' \+/.test(m[2])) continue;
      try { if (!Array.isArray(JSON.parse(m[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&')))) throw 0; } catch (e) { badArgs.push(f + ':' + (i + 1) + ' ' + m[2]); }
    }
  });
}
S('no inline event handlers in public/', inlineHits.length === 0, inlineHits.join(', '));
S('no inline <script> blocks in index.html', !/<script(?![^>]*\ssrc=)[^>]*>/i.test(fs.readFileSync(ROOT + 'index.html', 'utf8')));
S('every constant data-*-args attribute is a JSON array', badArgs.length === 0, badArgs.join(' | '));
S('action names are plain identifiers', [...actionNames].every(n => /^[A-Za-z_$][\w$]*$/.test(n)), [...actionNames].filter(n => !/^[A-Za-z_$][\w$]*$/.test(n)).join(', '));
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const preloads = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);
const moduleFiles = SRC.filter((f) => f.startsWith('src/') && f !== 'src/main.js');
S('every module is preloaded from index.html', moduleFiles.every((f) => preloads.includes(f)), moduleFiles.filter((f) => !preloads.includes(f)).join(', '));
S('every preload points at a real module', preloads.every((p) => moduleFiles.includes(p)), preloads.filter((p) => !moduleFiles.includes(p)).join(', '));
S('index.html loads src/main.js as a module and nothing else', /<script type="module" src="src\/main.js"><\/script>/.test(html) && !/<script defer src="[a-z-]+\.js">/.test(html));
const hdr = siteHeaders();
S('_headers enforces the CSP (not report-only)', !!hdr['content-security-policy'] && !hdr['content-security-policy-report-only']);
S("script-src has no 'unsafe-inline' or 'unsafe-eval'", (() => { const d = (hdr['content-security-policy'] || '').split(';').find(x => x.trim().startsWith('script-src')) || ''; return d && !/unsafe-inline|unsafe-eval/.test(d); })());

const PORT = 8742;
const server = await startServer(PORT);
const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.message)));
const registryWarnings = [];
page.on('console', m => { if (/act: duplicate|No handler registered|Bad data-/.test(m.text())) registryWarnings.push(m.text()); });
await page.goto(`http://localhost:${PORT}/#dashboard`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

// Which store-owned state keys each view module reads (for the VIEW_STORES guard)
const STORE_KEY_RE = /state\.(CREATOR|RATE_CARD|DEALS|CAMPAIGN_RESULTS|CALENDAR_EVENTS|MONTHLY_REVENUE|AUDIENCE_DATA|INBOX_ITEMS|TASKS|_tasksTableMissing|CLIENTS|_invoicingMigrationMissing|INVOICE_DATA|OUTREACH_LISTS|OUTREACH_TARGETS|_outreachMigrationMissing)\b/g;
const VIEW_KEYS = {};
for (const f of SRC.filter((x) => x.startsWith('src/views/'))) {
  const view = f.replace('src/views/', '').replace('.js', '');
  VIEW_KEYS[view] = [...new Set([...fs.readFileSync(ROOT + f, 'utf8').matchAll(STORE_KEY_RE)].map((m) => m[1]))];
}

const results = await page.evaluate(async ({ ACTION_NAMES, VIEW_KEYS }) => {
  const out = [];
  const T = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail === undefined ? '' : String(detail) });

  // Escaping
  T('_esc escapes quotes and angle brackets', __arkives._esc('a"b<c>&') === 'a&quot;b&lt;c&gt;&amp;');
  T('_safeThumb accepts an image data URL', __arkives._safeThumb('data:image/jpeg;base64,AAAA/+==') === 'data:image/jpeg;base64,AAAA/+==');
  T('_safeThumb rejects attribute injection', __arkives._safeThumb('x" onerror="alert(1)') === '');
  T('_safeThumb rejects svg data URLs', __arkives._safeThumb('data:image/svg+xml;base64,AAAA') === '');

  // Board content guards
  T('YouTube id shape accepted', __arkives._bdValidVid({ provider: 'youtube', vid: 'dQw4w9WgXcQ' }) === true);
  T('YouTube id injection rejected', __arkives._bdValidVid({ provider: 'youtube', vid: '"><img src=x onerror=1>' }) === false);
  T('Vimeo id must be numeric', __arkives._bdValidVid({ provider: 'vimeo', vid: '12345' }) && !__arkives._bdValidVid({ provider: 'vimeo', vid: '12a' }));
  T('embed src is null for a bad id', __arkives._bdEmbedSrc({ provider: 'youtube', vid: 'bad' }) === null);
  T('pen path coerces points to numbers', __arkives._bdPathD([['1', '2'], ['3" onload="x', '4'], [5, 6]]) === 'M1 2 L5 6');
  T('_bdNum clamps and defaults', __arkives._bdNum('"><x', 3, 1, 40) === 3 && __arkives._bdNum(99, 3, 1, 40) === 40 && __arkives._bdNum(2.5, 3, 1, 40) === 2.5);
  T('_bdSafeUrl rejects javascript:', __arkives._bdSafeUrl('javascript:alert(1)') === null && __arkives._bdSafeUrl('https://a.b/c') === 'https://a.b/c');
  T('_bdParseVideoUrl rejects non-http', __arkives._bdParseVideoUrl('javascript:alert(1)') === null && __arkives._bdParseVideoUrl('https://youtu.be/dQw4w9WgXcQ').vid === 'dQw4w9WgXcQ');
  const vEl = __arkives._bdItemEl({ id: 'v1', kind: 'video', x: 0, y: 0, w: 100, h: 60, z: 1, content: { url: 'https://x.y', provider: 'youtube', vid: '"><img src=x onerror=window.__x=1>' } });
  T('video item with a bad id renders as a link card', !vEl.querySelector('img') && !!vEl.querySelector('.bd-link-card'));
  const dEl = __arkives._bdItemEl({ id: 'd1', kind: 'draw', x: 0, y: 0, w: 10, h: 10, z: 1, content: { points: 'nope', width: '"/><script>', color: 'ink' } });
  T('draw item with junk content is inert', dEl.querySelector('path')?.getAttribute('stroke-width') === '3' && !dEl.querySelector('script'));

  // Scripts autosave: dirty-only, ordered, serialized, failure requeues
  const sent = [];
  __arkives.db.sbSaveSceneFields = async (id, fields, tok) => { sent.push({ id, fields: JSON.parse(JSON.stringify(fields)), tok }); await new Promise(r => setTimeout(r, 20)); };
  __arkives.db.sbUpdateScript = async (id, updates, tok) => { sent.push({ id, updates, tok }); return true; };
  __arkives.state._currentScriptId = 'S1'; __arkives.state._sharedScriptToken = null;
  __arkives.state._currentScenes = [{ id: 'a', script_text: '', scene_description: '' }, { id: 'b', script_text: '', scene_description: '' }];
  __arkives.state._sceneDirty = { a: { script_text: 'hello' } }; __arkives.state._titleDirty = 'New title';
  const p1 = __arkives._flushScriptSaves();
  __arkives.state._sceneDirty = { b: { scene_description: 'wide' } };
  const p2 = __arkives._flushScriptSaves();
  await Promise.all([p1, p2]);
  T('flush sends title, then only dirty scene fields, in order', JSON.stringify(sent) === JSON.stringify([
    { id: 'S1', updates: { title: 'New title' }, tok: null },
    { id: 'a', fields: { script_text: 'hello' }, tok: null },
    { id: 'b', fields: { scene_description: 'wide' }, tok: null }
  ]), JSON.stringify(sent));
  T('flush clears the dirty set', Object.keys(__arkives.state._sceneDirty).length === 0 && __arkives.state._titleDirty === null);
  __arkives.db.sbSaveSceneFields = async () => { throw new Error('net'); };
  __arkives.state._sceneDirty = { a: { script_text: 'retry me' } };
  await __arkives._flushScriptSaves();
  T('a failed save is requeued for the next flush', __arkives.state._sceneDirty.a?.script_text === 'retry me');
  __arkives.state._sceneDirty = {};

  // Editor renders from state; input updates state
  const c = document.getElementById('view-script-editor');
  __arkives.state._currentScriptRow = { id: 'S1', title: 'T "q"', share_mode: 'none', share_token: 'tok' };
  __arkives.state._currentScenes = [{ id: 'a', script_text: 'x', scene_description: 'y', thumbnail_data: 'x" onerror="window.__x=1' }];
  __arkives._renderEditorUI(c, __arkives.state._currentScriptRow, __arkives.state._currentScenes, false);
  T('title with quotes survives the value attribute', document.getElementById('scriptTitleInput')?.value === 'T "q"');
  T('crafted thumbnail is not rendered', !c.querySelector('.script-thumb-preview img'));
  const ta = c.querySelector('textarea[data-scene-id="a"][data-field="script_text"]');
  ta.value = 'typed'; ta.dispatchEvent(new Event('input', { bubbles: true }));
  T('typing updates in-memory scenes and the dirty set', __arkives.state._currentScenes[0].script_text === 'typed' && __arkives.state._sceneDirty.a?.script_text === 'typed');
  clearTimeout(__arkives.state._scriptAutoSaveTimer); __arkives.state._sceneDirty = {};

  // Auth panels
  __arkives._authShow('forgotForm');
  T('forgot-password panel shows alone', document.getElementById('forgotForm').style.display === '' && document.getElementById('loginForm').style.display === 'none');
  __arkives._authShow('recoveryForm');
  T('recovery panel exists', document.getElementById('recoveryForm').style.display === '');
  __arkives._authShow('loginForm');

  // Modals live on <body>
  document.getElementById('loaderOverlay')?.remove();
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appShell').style.display = '';
  __arkives.state.CREATOR._sbId = 'u1';
  __arkives.state.TASKS = [{ _sbId: 't1', title: 'A', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '' }];
  __arkives.renderTasks();
  T('task modal is body-mounted', document.getElementById('taskModalHost')?.parentElement === document.body);
  __arkives.openEditTaskModal('t1');
  T('task modal covers the sidebar', /modal/.test(document.elementFromPoint(60, 300)?.className || ''));
  __arkives.closeEditTaskModal();
  __arkives.renderCalendar();
  T('calendar modal is body-mounted', document.getElementById('calendarModalHost')?.parentElement === document.body);

  // Dashboard with valueless deals
  __arkives.state.DEALS = [{ _sbId: 'd', brand: 'B', status: 'Active', value: 0, paid: 0, outstanding: 0, invoiced: 0 }];
  __arkives.renderDashboard();
  T('dashboard shows no NaN', !/NaN/.test(document.getElementById('view-dashboard').innerText));

  // Logout reset
  __arkives.state.CREATOR.name = 'X'; __arkives.state.CREATOR.bankAccountNumber = '999'; __arkives.state.INVOICE_DATA = [{ _sbId: 'i' }];
  __arkives.resetAllState();
  T('resetAllState wipes profile, bank details, data, and views', __arkives.state.CREATOR.name === '' && __arkives.state.CREATOR.bankAccountNumber === undefined && __arkives.state.INVOICE_DATA.length === 0 && document.getElementById('view-dashboard').innerHTML === '');

  // Invoice dates are local-calendar
  T('Net 30 lands on the local calendar day', __arkives.invTermDueDate('2026-09-03', 'net30') === '2026-10-03', __arkives.invTermDueDate('2026-09-03', 'net30'));

  // ---- Boards on touch ----
  __arkives.db.sbUpdateBoardItem = async () => true;
  __arkives.db.sbUpdateBoard = async () => true;
  __arkives.state._bdBoard = { id: 'B1', title: 'Board', share_mode: 'none', share_token: 'tk', view_x: 0, view_y: 0, view_zoom: 1 };
  __arkives.state._bdView = { x: 0, y: 0, z: 1 }; __arkives.state._bdItems = []; __arkives.state._bdSelectedId = null; __arkives.state._bdReadOnly = false; __arkives.state._bdSharedToken = null;
  __arkives.state._bdUndoStack = []; __arkives.state._bdRedoStack = [];
  const bc = document.getElementById('view-board-editor');
  bc.style.display = 'block';
  bc.innerHTML = __arkives._bdEditorShellHtml(false);
  __arkives._bdApplyView(); __arkives._bdBindEditor();
  const vp = document.getElementById('bdViewport');
  const rect = vp.getBoundingClientRect();
  const pe = (type, id, x, y) => vp.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: rect.left + x, clientY: rect.top + y, bubbles: true, isPrimary: id === 1 }));
  // Two fingers land 100px apart, spread to 200px: zoom should roughly double
  pe('pointerdown', 1, 100, 100); pe('pointerdown', 2, 200, 100);
  pe('pointermove', 1, 50, 100); pe('pointermove', 2, 250, 100);
  const zAfterSpread = __arkives.state._bdView.z;
  pe('pointerup', 1, 50, 100); pe('pointerup', 2, 250, 100);
  T('pinch spread zooms in', zAfterSpread > 1.8 && zAfterSpread < 2.2, zAfterSpread);
  T('pinch ends cleanly', __arkives.state._bdPinch === null && __arkives.state._bdPointers.size === 0 && __arkives.state._bdPtr === null);
  // Two fingers moving together pan
  __arkives.state._bdView = { x: 0, y: 0, z: 1 }; __arkives._bdApplyView();
  pe('pointerdown', 3, 100, 100); pe('pointerdown', 4, 200, 100);
  pe('pointermove', 3, 130, 140); pe('pointermove', 4, 230, 140);
  pe('pointerup', 3, 130, 140); pe('pointerup', 4, 230, 140);
  T('two-finger drag pans', Math.round(__arkives.state._bdView.x) === 30 && Math.round(__arkives.state._bdView.y) === 40 && Math.abs(__arkives.state._bdView.z - 1) < 0.001, JSON.stringify(__arkives.state._bdView));
  // A single touch still pans (bubble handler untouched)
  __arkives.state._bdView = { x: 0, y: 0, z: 1 }; __arkives._bdApplyView();
  pe('pointerdown', 5, 100, 100); pe('pointermove', 5, 120, 110); pe('pointerup', 5, 120, 110);
  T('single finger still pans', Math.round(__arkives.state._bdView.x) === 20 && Math.round(__arkives.state._bdView.y) === 10, JSON.stringify(__arkives.state._bdView));
  // Undo / redo buttons follow the stacks
  const ub = document.getElementById('bdUndoBtn'), rb = document.getElementById('bdRedoBtn');
  T('undo/redo buttons start disabled', ub && rb && ub.disabled && rb.disabled);
  __arkives.state._bdItems = [{ id: 'n1', board_id: 'B1', kind: 'note', x: 0, y: 0, w: 100, h: 100, z: 1, content: { text: 'a', color: 'yellow' } }];
  document.getElementById('bdPlane').appendChild(__arkives._bdItemEl(__arkives.state._bdItems[0]));
  __arkives._bdPushUndo({ type: 'update', id: 'n1', before: { x: 0 }, after: { x: 50 } });
  T('undo enabled after an op', !ub.disabled && rb.disabled);
  await __arkives._bdUndo();
  T('redo enabled after undo', ub.disabled && !rb.disabled && __arkives.state._bdItems[0].x === 0);
  await __arkives._bdRedo();
  T('redo re-applies', __arkives.state._bdItems[0].x === 50 && !ub.disabled);
  // Remote ops apply to state + DOM, but never over an item being edited
  await __arkives._bdApplyRemoteOp({ board: 'B1', type: 'upsert', item: { id: 'r1', board_id: 'B1', kind: 'text', x: 5, y: 5, w: 200, h: 40, z: 2, content: { text: 'from afar', size: 'body' } } });
  T('remote upsert adds item', __arkives.state._bdItems.some(i => i.id === 'r1') && !!document.querySelector('.bd-item[data-id="r1"]'));
  await __arkives._bdApplyRemoteOp({ board: 'OTHER', type: 'delete', id: 'r1' });
  T('remote op for another board ignored', __arkives.state._bdItems.some(i => i.id === 'r1'));
  const ed = document.querySelector('.bd-item[data-id="r1"] .bd-text-content'); ed.setAttribute('contenteditable', 'true');
  await __arkives._bdApplyRemoteOp({ board: 'B1', type: 'upsert', item: { id: 'r1', board_id: 'B1', kind: 'text', x: 5, y: 5, w: 200, h: 40, z: 2, content: { text: 'clobber', size: 'body' } } });
  T('remote upsert skips an item being edited', __arkives.state._bdItems.find(i => i.id === 'r1').content.text === 'from afar');
  ed.setAttribute('contenteditable', 'false');
  await __arkives._bdApplyRemoteOp({ board: 'B1', type: 'delete', id: 'r1' });
  T('remote delete removes item', !__arkives.state._bdItems.some(i => i.id === 'r1') && !document.querySelector('.bd-item[data-id="r1"]'));
  T('crafted remote item is rendered inert', (() => { __arkives._bdApplyRemoteOp({ board: 'B1', type: 'upsert', item: { id: 'x1', board_id: 'B1', kind: 'video', x: 0, y: 0, w: 10, h: 10, z: 1, content: { url: 'https://a', provider: 'youtube', vid: '"><img src=x onerror=window.__x=1>' } } }); return !window.__x; })());

  // ---- Scripts: move up/down ----
  const reorders = [];
  __arkives.db.sbReorderScenes = async (scenes) => { reorders.push(scenes.map(s => s.id)); };
  __arkives.state._sceneDirty = {}; __arkives.state._titleDirty = null; // nothing to flush
  __arkives.state._currentScriptId = 'S2'; __arkives.state._sharedScriptToken = null;
  __arkives.state._currentScriptRow = { id: 'S2', title: 'T', share_mode: 'none' };
  __arkives.state._currentScenes = [{ id: 'a', script_text: '', scene_description: '' }, { id: 'b', script_text: '', scene_description: '' }, { id: 'c', script_text: '', scene_description: '' }];
  await __arkives._moveScene('c', -1);
  T('move up reorders and persists', JSON.stringify(reorders[0]) === '["a","c","b"]' && __arkives.state._currentScenes[1].id === 'c', JSON.stringify(reorders));
  await __arkives._moveScene('a', -1);
  T('move up at top is a no-op', reorders.length === 1);
  const rowsHtml = document.getElementById('view-script-editor').innerHTML;
  T('first row has Move up disabled, last has Move down disabled', /title="Move up" disabled/.test(rowsHtml) && /title="Move down" disabled/.test(rowsHtml));

  // ---- Tasks: optimistic toggles + undo-able delete ----
  const taskWrites = [];
  __arkives.db.sbUpdateTask = async (id, u) => { taskWrites.push(u); return !u.__fail; };
  __arkives.db.sbDeleteTasks = async (ids) => { taskWrites.push({ del: ids }); return true; };
  __arkives.state.TASKS = [{ _sbId: 't1', title: 'A', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-01' },
           { _sbId: 't2', title: 'B', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-02' }];
  __arkives.state._taskPendingDeletes = {};
  location.hash = 'tasks'; __arkives.navigate('tasks');
  const p = __arkives.toggleTaskComplete('t1');
  // A completed task leaves the active list and the collapsed Completed count goes up, before the save resolves
  T('complete flips before the save resolves', __arkives.state.TASKS.find(t => t._sbId === 't1').completed === true && !document.querySelector('.task-list:not(.task-list-completed) .task-item[data-id="t1"]') && /Completed \(1\)/.test(document.getElementById('view-tasks').textContent));
  await p;
  T('complete persisted', taskWrites.some(w => w.completed === true));
  __arkives.db.sbUpdateTask = async () => false;
  await __arkives.toggleTaskStar('t2');
  T('failed star save reverts', __arkives.state.TASKS.find(t => t._sbId === 't2').starred === false);
  __arkives.deleteTask('t2');
  T('delete removes immediately with an Undo toast', !__arkives.state.TASKS.some(t => t._sbId === 't2') && document.getElementById('undo-toast')?.classList.contains('show'));
  document.querySelector('#undo-toast .undo-toast-btn').click();
  T('undo restores the task without a DB call', __arkives.state.TASKS.some(t => t._sbId === 't2') && !taskWrites.some(w => w.del) && !__arkives.state._taskPendingDeletes.t2);
  __arkives.deleteTask('t2');
  __arkives._flushTaskDeletes();
  await new Promise(r => setTimeout(r, 10));
  T('flush commits a pending delete', taskWrites.some(w => w.del && w.del[0] === 't2') && !__arkives.state.TASKS.some(t => t._sbId === 't2'));

  // ---- Invoices: routes + row sheet ----
  __arkives.state.INVOICE_DATA = [{ _sbId: 'i1', invoiceNumber: 'ACME-0001', brand: 'Acme', billToName: 'Acme Media', billToAddress: '', date: '2026-08-01', dueDate: '', status: 'sent', lineItems: [{ type: 'flat', desc: 'Reel', qty: 1, rate: 0, fee: 100 }], amount: 100, amountPaid: 0, tax: 0, notes: '', includePaymentInfo: false, paymentTerms: 'none', clientId: null, description: 'Reel' }];
  __arkives.state.CLIENTS = []; __arkives.state._invoicingMigrationMissing = false;
  location.hash = 'invoices/i1'; __arkives.navigate('invoices/i1');
  T('#invoices/{id} opens the editor', __arkives.state._invEditorOpen && __arkives.state._invEditingId === 'i1' && !!document.getElementById('invBillToName'));
  location.hash = 'invoices'; __arkives.navigate('invoices');
  T('#invoices closes the editor', !__arkives.state._invEditorOpen && !!document.getElementById('invTbody'));
  location.hash = 'invoices/new'; __arkives.navigate('invoices/new');
  T('#invoices/new starts a blank invoice', __arkives.state._invEditorOpen && __arkives.state._invEditingId === null && __arkives.state._inv && __arkives.state._inv.status === 'draft');
  location.hash = 'invoices'; __arkives.navigate('invoices');
  __arkives.invOpenRowMenu('i1');
  T('row sheet mounts on body with the status action', document.getElementById('invSheetHost')?.parentElement === document.body && /Record Payment/.test(document.getElementById('invSheetHost').innerHTML));
  __arkives.invCloseRowMenu();
  T('row sheet closes', document.getElementById('invSheetHost').innerHTML === '');
  T('unknown hash falls back to dashboard', (() => { location.hash = 'nope'; __arkives.navigate('nope'); return document.getElementById('view-dashboard').classList.contains('active'); })());
  T('tab bar marks the active tool', (() => { location.hash = 'tasks'; __arkives.navigate('tasks'); return document.querySelector('.tabbar [data-tab="tasks"]').classList.contains('active') && !document.querySelector('.tabbar [data-tab="boards"]').classList.contains('active'); })());
  T('editor routes set editor-open on body', (() => { location.hash = 'script/abc'; __arkives.navigate('script/abc'); const on = document.body.classList.contains('editor-open'); location.hash = 'tasks'; __arkives.navigate('tasks'); return on && !document.body.classList.contains('editor-open'); })());
  __arkives.state._scriptLoadToken++; // abandon the stray editor fetch

  // ---- Modules: wiring, no leaked globals ----
  T('the Supabase client was created in sb.__init', !!__arkives.state._sb && typeof __arkives.state._sb.from === 'function');
  T('boot ran to completion (_booted)', __arkives.state._booted === true);
  T('module scope does not leak into window', typeof window.TASKS === 'undefined' && typeof window.navigate === 'undefined' && typeof window.renderTasks === 'undefined' && typeof window._sb === 'undefined');
  T('__arkives exposes state, db, ACTIONS and views', __arkives.state && __arkives.db && __arkives.ACTIONS && typeof __arkives.renderTasks === 'function' && typeof __arkives.db.sbUpdateTask === 'function');
  location.hash = 'calendar'; window.dispatchEvent(new HashChangeEvent('hashchange'));
  T('hashchange listener routes (router.__init)', document.getElementById('view-calendar').classList.contains('active'));
  location.hash = 'tasks'; __arkives.navigate('tasks');

  // ---- Event delegation: every data-* name in the source has a handler ----
  const unregistered = ACTION_NAMES.filter(n => typeof __arkives.ACTIONS[n] !== 'function');
  T('every data-action/input/change/keydown/submit in the source is registered (' + ACTION_NAMES.length + ' names)', unregistered.length === 0, unregistered.join(', '));

  // ---- Event delegation: dispatcher semantics ----
  const calls = [];
  __arkives.act({
    __t0: function () { calls.push(['t0', arguments.length]); },
    __t1: function (a, b, c, d) { calls.push(['t1', a, b && b.type, c && c.id, d]); },
    __tStop: function (ev) { calls.push(['stop']); ev.stopPropagation(); },
    __tOuter: function () { calls.push(['outer']); },
    __tIn: function (v) { calls.push(['in', v]); },
    __tChk: function (c) { calls.push(['chk', c]); },
    __tKey: function (ev) { calls.push(['key', ev.key]); },
    __tSub: function (ev) { ev.preventDefault(); calls.push(['sub']); },
  });
  const lab = document.createElement('div');
  lab.innerHTML = `
    <div data-action="__tOuter">
      <button id="d0" data-action="__t0">x</button>
      <button id="d1" data-action="__t1" data-args="${__arkives._args('a', '$event', '$el', 7)}">x</button>
      <span data-action="__tStop" data-args="[&quot;$event&quot;]"><button id="dStop">x</button></span>
      <span data-action="__t0" data-stop><button id="dStopAttr">x</button></span>
      <button id="dBad" data-action="__nope">x</button>
      <input id="dIn" data-input="__tIn" data-input-args="[&quot;$value&quot;]">
      <input id="dChk" type="checkbox" data-change="__tChk" data-change-args="[&quot;$checked&quot;]">
      <input id="dKey" data-keydown="__tKey" data-keydown-args="[&quot;$event&quot;]">
      <form id="dForm" data-submit="__tSub" data-submit-args="[&quot;$event&quot;]"><button type="submit">go</button></form>
    </div>`;
  document.body.appendChild(lab);
  let docSeen = 0; const seeDoc = () => docSeen++; document.addEventListener('click', seeDoc);
  document.getElementById('d0').click();
  T('click: handler gets exactly its args and the event bubbles to the outer action', JSON.stringify(calls) === '[["t0",0],["outer"]]', JSON.stringify(calls));
  T('click: later document listeners still run when nothing stops the event', docSeen === 1);
  calls.length = 0; docSeen = 0;
  document.getElementById('d1').click();
  T('$event, $el and literals resolve in order', JSON.stringify(calls[0]) === '["t1","a","click","d1",7]', JSON.stringify(calls[0]));
  calls.length = 0; docSeen = 0;
  document.getElementById('dStop').click();
  T('a handler that stops propagation ends the walk and hides the event from later document listeners', JSON.stringify(calls) === '[["stop"]]' && docSeen === 0, JSON.stringify(calls) + ' docSeen=' + docSeen);
  calls.length = 0; docSeen = 0;
  document.getElementById('dStopAttr').click();
  T('data-stop runs the handler then stops', JSON.stringify(calls) === '[["t0",0]]' && docSeen === 0, JSON.stringify(calls));
  calls.length = 0;
  const errBefore = console.error; let loggedErr = ''; console.error = (m) => { loggedErr += m; };
  document.getElementById('dBad').click();
  console.error = errBefore;
  T('an unregistered action logs an error and does not throw', /__nope/.test(loggedErr) && calls.length === 0, loggedErr);
  const din = document.getElementById('dIn'); din.value = 'hi'; din.dispatchEvent(new Event('input', { bubbles: true }));
  T('data-input passes $value', JSON.stringify(calls) === '[["in","hi"]]', JSON.stringify(calls));
  calls.length = 0;
  document.getElementById('dChk').click();
  T('data-change passes $checked', calls.some(c => c[0] === 'chk' && c[1] === true), JSON.stringify(calls));
  calls.length = 0;
  document.getElementById('dKey').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  T('data-keydown passes the event', JSON.stringify(calls) === '[["key","Enter"]]', JSON.stringify(calls));
  calls.length = 0;
  document.getElementById('dForm').requestSubmit();
  T('data-submit passes the event (and preventDefault holds)', JSON.stringify(calls) === '[["sub"]]' && location.pathname === '/', JSON.stringify(calls));
  document.removeEventListener('click', seeDoc); lab.remove();
  ['__t0', '__t1', '__tStop', '__tOuter', '__tIn', '__tChk', '__tKey', '__tSub'].forEach(n => { delete __arkives.ACTIONS[n]; });

  // ---- Event delegation: the real UI, driven by clicks ----
  // Auth form submits through the dispatcher
  const realLogin = __arkives.ACTIONS.handleLogin; let loginEv = null;
  __arkives.ACTIONS.handleLogin = (ev) => { ev.preventDefault(); loginEv = ev; };
  document.getElementById('loginEmail').value = 't@example.com'; document.getElementById('loginPassword').value = 'pw';
  document.getElementById('loginForm').requestSubmit(); // real path: validation, then the delegated submit
  document.getElementById('loginEmail').value = ''; document.getElementById('loginPassword').value = '';
  __arkives.ACTIONS.handleLogin = realLogin;
  T('login form submit reaches handleLogin with the event', loginEv && loginEv.type === 'submit');
  // Settings tabs (constant args)
  location.hash = 'settings'; __arkives.navigate('settings');
  document.querySelector('.settings-tab[data-tab="ratecard"]').click();
  T('settings tab click switches the panel', document.querySelector('.settings-tab[data-tab="ratecard"]').classList.contains('active') && document.getElementById('settings-panel-ratecard').style.display === '' && document.getElementById('settings-panel-profile').style.display === 'none');
  // Calendar day cell (dynamic args) opens the modal prefilled; backdrop closes it; the card does not
  location.hash = 'calendar'; __arkives.navigate('calendar');
  const cell = document.querySelector('.calendar-cell[data-action="openAddEventModal"]');
  const cellIso = JSON.parse(cell.getAttribute('data-args'))[0];
  cell.click();
  const evModal = document.getElementById('addEventModal');
  T('calendar cell click opens Add Event prefilled with that day', evModal.style.display !== 'none' && document.getElementById('evDate').value === cellIso, document.getElementById('evDate').value + ' vs ' + cellIso);
  evModal.querySelector('.modal-card h3').click();
  T('click inside the event card keeps it open', evModal.style.display !== 'none');
  evModal.click();
  T('click on the event backdrop closes it', evModal.style.display === 'none');
  // Tasks: check button toggles, body opens the editor, backdrop closes it
  __arkives.db.sbUpdateTask = async () => true;
  __arkives.state.TASKS = [{ _sbId: 'k1', title: 'Click me', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-01' }];
  location.hash = 'tasks'; __arkives.navigate('tasks');
  document.querySelector('.task-item[data-id="k1"] .task-body').click();
  const tModal = document.getElementById('editTaskModal');
  T('task body click opens the edit modal for that task', tModal.style.display !== 'none' && __arkives.state._editingTaskId === 'k1' && document.getElementById('etTitle').value === 'Click me');
  tModal.querySelector('.modal-card').click();
  T('click inside the task card keeps it open', tModal.style.display !== 'none');
  tModal.click();
  T('click on the task backdrop closes it', tModal.style.display === 'none' && __arkives.state._editingTaskId === null);
  document.getElementById('etTitle').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); // closed modal: harmless
  document.querySelector('.task-item[data-id="k1"] .task-check').click();
  T('task check click completes the task', __arkives.state.TASKS[0].completed === true);
  // Invoices: row click opens; the actions cell stops the row; the sheet backdrop closes
  __arkives.state.INVOICE_DATA = [{ _sbId: 'i1', invoiceNumber: 'ACME-0001', brand: 'Acme', billToName: 'Acme Media', billToAddress: '', date: '2026-08-01', dueDate: '', status: 'sent', lineItems: [{ type: 'flat', desc: 'Reel', qty: 1, rate: 0, fee: 100 }], amount: 100, amountPaid: 0, tax: 0, notes: '', includePaymentInfo: false, paymentTerms: 'none', clientId: null, description: 'Reel' }];
  location.hash = 'invoices'; __arkives.navigate('invoices');
  document.querySelector('.inv-row td').click();
  T('invoice row click opens that invoice', __arkives.state._invEditorOpen && __arkives.state._invEditingId === 'i1');
  location.hash = 'invoices'; __arkives.navigate('invoices');
  document.querySelector('.inv-row .inv-row-more').click();
  T('row actions click opens the sheet without opening the row', !__arkives.state._invEditorOpen && /Record Payment/.test(document.getElementById('invSheetHost').innerHTML));
  document.querySelector('#invSheetHost .inv-sheet').click();
  T('click inside the sheet keeps it open', document.getElementById('invSheetHost').innerHTML !== '');
  document.querySelector('#invSheetHost .inv-sheet-overlay').click();
  T('click on the sheet backdrop closes it', document.getElementById('invSheetHost').innerHTML === '');
  __arkives.invOpenRowMenu('i1');
  const sheetPick = document.querySelector('#invSheetHost .inv-sheet-btn[data-action="invRowMenuPick"]');
  sheetPick.click();
  T('a sheet action closes the sheet and runs (Open)', document.getElementById('invSheetHost').innerHTML === '' && __arkives.state._invEditorOpen && __arkives.state._invEditingId === 'i1');
  location.hash = 'invoices'; __arkives.navigate('invoices');
  // Outreach rail (dynamic args through a template)
  __arkives.state.OUTREACH_TARGETS = []; __arkives.state.OUTREACH_LISTS = [{ _sbId: 'L1', name: 'Brands' }]; __arkives.state._outSelectedList = 'all';
  location.hash = 'outreach'; __arkives.navigate('outreach');
  document.querySelector('.out-rail-item[data-action="outSelectList"][data-args*="L1"]').click();
  T('outreach list click selects the list', __arkives.state._outSelectedList === 'L1');
  // Card pattern used by Scripts and Boards lists: go() on the card, a stopped delete button inside
  const realDel = __arkives.ACTIONS._deleteBoard; let delId = null; __arkives.ACTIONS._deleteBoard = (id) => { delId = id; };
  const card = document.createElement('div');
  card.innerHTML = '<div class="board-card" data-action="go" data-args="' + __arkives._args('board/zz') + '"><button class="board-card-delete" data-action="_deleteBoard" data-args="' + __arkives._args('zz') + '" data-stop>x</button></div>';
  document.body.appendChild(card);
  location.hash = 'boards';
  card.querySelector('.board-card-delete').click();
  T('card delete button runs and does not open the card', delId === 'zz' && location.hash === '#boards');
  card.querySelector('.board-card').click();
  T('card click navigates', location.hash === '#board/zz');
  __arkives.ACTIONS._deleteBoard = realDel; card.remove(); location.hash = 'tasks'; __arkives.navigate('tasks');
  // Boards zoom buttons in the editor shell
  const zBefore = __arkives.state._bdView.z;
  document.querySelector('#view-board-editor .bd-zoom button[data-args="[1]"]').click();
  T('board zoom-in button zooms', __arkives.state._bdView.z > zBefore, zBefore + ' -> ' + __arkives.state._bdView.z);

  // ---- jsPDF works under the CSP (no unsafe-eval) ----
  T('jsPDF renders under the CSP', (() => { try { const d = new jspdf.jsPDF(); d.text('csp', 10, 10); return /^data:application\/pdf/.test(d.output('datauristring')); } catch (e) { return false; } })());

  // ---- Stores ----
  const S = __arkives.stores;
  T('every view declares stores covering the state keys it reads', (() => {
    const owned = {}; S.ALL_STORES.forEach((st) => st.keys.forEach((k) => { owned[k] = st.name; }));
    const bad = [];
    for (const [view, keys] of Object.entries(VIEW_KEYS)) {
      if (view === 'auth') continue; // resetAllState clears everything by design
      const allowed = new Set([...S.profile.keys, ...(S.VIEW_STORES[view] || []).flatMap((st) => st.keys)]);
      keys.forEach((k) => { if (owned[k] && !allowed.has(k)) bad.push(view + ' reads ' + k + ' (store ' + owned[k] + ')'); });
    }
    if (bad.length) console.error(bad.join('; '));
    return bad.length === 0;
  })());
  T('store.load() is a no-op when signed out', (await S.deals.load()) === false && S.deals.loaded === false);
  {
    const st = __arkives.stores.tasks; const seen = [];
    const off = st.subscribe(() => seen.push(1));
    st.notify(); st.notify(); off(); st.notify();
    T('subscribe/notify/unsubscribe', seen.length === 2);
  }
  T('storesFor: editors load nothing, unknown hash loads the dashboard set, invoices loads invoices+clients', S.storesFor('script/x').length === 0 && S.storesFor('board/x').length === 0 && S.storesFor('nope') === S.VIEW_STORES.dashboard && S.storesFor('invoices/abc').map((s) => s.name).join(',') === 'invoices,clients');
  // ---- Router lifecycle ----
  __arkives.db.sbUpdateTask = async () => true;
  __arkives.db.sbDeleteTasks = async (ids) => { taskWrites.push({ del2: ids }); return true; };
  __arkives.state.TASKS = [{ _sbId: 'u1', title: 'Leaving', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-01' }];
  __arkives.state._taskPendingDeletes = {};
  location.hash = 'tasks'; __arkives.navigate('tasks');
  T('router tracks the mounted view', __arkives.currentRoute()?.key === 'tasks');
  __arkives.deleteTask('u1');
  location.hash = 'calendar'; __arkives.navigate('calendar');
  await new Promise(r => setTimeout(r, 10));
  T('leaving Tasks commits the pending delete (unmount)', taskWrites.some(w => w.del2 && w.del2[0] === 'u1') && !__arkives.state._taskPendingDeletes.u1 && __arkives.currentRoute()?.key === 'calendar');
  __arkives.state.TASKS = [{ _sbId: 'u2', title: 'Before', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-01' }];
  location.hash = 'tasks'; __arkives.navigate('tasks');
  __arkives.state.TASKS[0].title = 'After notify';
  __arkives.stores.tasks.notify();
  T('a store notify re-renders the mounted view', /After notify/.test(document.getElementById('view-tasks').textContent));
  location.hash = 'calendar'; __arkives.navigate('calendar');
  __arkives.state.TASKS[0].title = 'Unmounted';
  __arkives.stores.tasks.notify();
  T('an unmounted view no longer re-renders on notify', !/Unmounted/.test(document.getElementById('view-tasks').textContent));
  __arkives.state.INVOICE_DATA = [{ _sbId: 'i9', invoiceNumber: 'X-1', brand: 'B', billToName: 'B', billToAddress: '', date: '2026-08-01', dueDate: '', status: 'sent', lineItems: [], amount: 1, amountPaid: 0, tax: 0, notes: '', includePaymentInfo: false, paymentTerms: 'none', clientId: null, description: '' }];
  location.hash = 'invoices'; __arkives.navigate('invoices');
  __arkives.invOpenRowMenu('i9');
  location.hash = 'tasks'; __arkives.navigate('tasks');
  T('leaving Invoices closes the body-mounted row sheet (unmount)', document.getElementById('invSheetHost').innerHTML === '' && __arkives.state._invRowMenuId === null);
  {
    const saved = [];
    __arkives.db.sbSaveSceneFields = async (id, fields) => { saved.push(id); };
    __arkives.state._currentScriptId = 'S9'; __arkives.state._sharedScriptToken = null;
    __arkives.state._currentScenes = [{ id: 'z', script_text: '', scene_description: '' }];
    __arkives.state._sceneDirty = { z: { script_text: 'unsaved' } }; __arkives.state._titleDirty = null;
    __arkives.navigate('script/S9');
    __arkives.state._scriptLoadToken++; // abandon the editor fetch
    location.hash = 'tasks'; __arkives.navigate('tasks');
    await new Promise(r => setTimeout(r, 10));
    T('leaving the script editor flushes dirty scene saves (unmount)', saved[0] === 'z' && Object.keys(__arkives.state._sceneDirty).length === 0);
  }
  {
    const before = S.tasks.loaded; S.tasks.loaded = true; S.resetStores();
    T('resetStores marks every store unloaded', S.ALL_STORES.every((st) => st.loaded === false)); S.tasks.loaded = before;
  }

  // ---- Loaders against a fake Supabase client (the code the boot used to run in one function) ----
  {
    const fake = (tables) => ({ from(t) {
      const spec = tables[t] || { data: [] }; const b = { _single: false };
      ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete'].forEach((m) => { b[m] = () => b; });
      b.maybeSingle = () => { b._single = true; return b; }; b.single = b.maybeSingle;
      b.then = (res, rej) => Promise.resolve(b._single ? { data: spec.single === undefined ? null : spec.single, error: spec.error || null } : { data: spec.data || [], error: spec.error || null }).then(res, rej);
      return b;
    } });
    const st = __arkives.state; const realSb = st._sb;
    st._authUser = { id: 'auth-1', email: 'me@x.com' };
    st._sb = fake({
      profiles: { single: { id: 'p1', name: 'Me', email: 'me@x.com', invoice_prefix: 'ME', invoice_template: 'red', mk_interests: ['film'] } },
      platforms: { data: [{ id: 'pl1', platform: 'instagram', handle: '@me', followers: 270000, followers_display: '270K', engagement_rate: 4.2 }] },
      rate_card_settings: { single: { minimum_rate: 15000, pricing_rule: 'flat' } },
      rate_cards: { data: [{ id: 'rc1', item_id: 'r1', name: 'Reel', rate: 15000, category: 'organic' }, { id: 'rc2', item_id: 'r2', name: 'Bogus', rate: 1, category: 'nope' }] },
      deals: { data: [{ id: 'd1', brand: 'Acme', status: 'Active', value: 12000, paid: 6000 }] },
      tasks: { error: { code: 'PGRST205', message: 'missing' } },
      clients: { data: [{ id: 'c1', name: 'Zed', invoice_prefix: 'ZED' }, { id: 'c2', name: 'Amy' }] },
      invoices: { data: [{ id: 'i1', invoice_number: 'ME-1', brand: 'Acme', amount: 10, status: 'sent', line_items: [{ type: 'flat', desc: 'Reel', qty: 1, rate: 0, fee: 10 }] }] },
      outreach_lists: { data: [{ id: 'l1', name: 'Brands', sort_order: 1 }] },
      outreach_targets: { data: [{ id: 't1', name: 'Nike', type: 'brand', status: 'new', list_ids: ['l1'], projects: [] }] },
      calendar_events: { data: [{ id: 'e1', date: '2026-09-10', brand: 'Acme', type: 'Post', platform: 'instagram', status: 'scheduled' }] },
      monthly_revenue: { data: [{ id: 'm1', month: 'Aug', year: 2026, amount: 5000 }] },
      campaign_results: { data: [{ id: 'cr1', brand: 'Acme', views: 1000, revenue: 12000 }] },
      audience_data: { data: [{ category: 'gender', data: { Male: 40, Female: 60 } }, { category: 'age', data: { '18-24': 30, '25-34': 50 } }] },
      inbox_items: { data: [{ id: 'ib1', brand: 'Acme', from_name: 'Jane', subject: 'Hi', status: 'new', preview: 'p' }] },
    });
    S.resetStores();
    T('profile loader maps the profile, platforms and rate card', (await S.profile.load()) === true && st.CREATOR._sbId === 'p1' && st.CREATOR.name === 'Me' && st.CREATOR.invoiceTemplate === 'red' && st.CREATOR.platforms.instagram.handle === '@me' && st.CREATOR.platforms.instagram.followers === '270K' && st.CREATOR.platforms.instagram.engagement === '4.2%' && st.RATE_CARD.minimumRate === 15000 && st.RATE_CARD.organic[0].name === 'Reel' && st.RATE_CARD.organic.length === 1, JSON.stringify({ id: st.CREATOR._sbId, ig: st.CREATOR.platforms.instagram, rc: st.RATE_CARD.organic }));
    T('load() is memoized', S.profile.load() === S.profile.load() && S.profile.loaded === true);
    await S.loadFor('tasks');
    T('tasks loader records a missing table instead of failing', S.tasks.loaded === true && st._tasksTableMissing === true && st.TASKS.length === 0);
    await S.loadFor('invoices/abc');
    T('invoices route loads invoices and clients', S.invoices.loaded && S.clients.loaded && st.INVOICE_DATA[0].invoiceNumber === 'ME-1' && st.INVOICE_DATA[0].lineItems[0].fee === 10 && st.CLIENTS.length === 2 && st.CLIENTS[0].invoicePrefix === 'ZED' && st._invoicingMigrationMissing === false, JSON.stringify(st.INVOICE_DATA[0]));
    await S.loadFor('dashboard');
    T('dashboard route loads deals, calendar and revenue', st.DEALS[0].brand === 'Acme' && st.DEALS[0].paid === 6000 && st.CALENDAR_EVENTS[0].date === '2026-09-10' && st.MONTHLY_REVENUE[0].month === 'Aug 2026' && st.MONTHLY_REVENUE[0].earned === 5000);
    await S.loadFor('outreach');
    T('outreach loader maps lists and targets', st.OUTREACH_LISTS[0].name === 'Brands' && st.OUTREACH_TARGETS[0].name === 'Nike' && st._outreachMigrationMissing === false);
    await Promise.all([S.audience.load(), S.inbox.load(), S.campaigns.load()]);
    T('audience, inbox and campaign loaders map rows', st.AUDIENCE_DATA.gender.female === 60 && /25-34/.test(st.AUDIENCE_DATA.topAge) && st.AUDIENCE_DATA.interests[0] === 'film' && st.INBOX_ITEMS[0].status === 'needs_reply' && st.CAMPAIGN_RESULTS[0].views === 1000, JSON.stringify(st.AUDIENCE_DATA));
    // Signed in, first visit to a view: skeleton, load, render
    S.calendar.reset(); st.CALENDAR_EVENTS = [];
    const navP = __arkives.navigate('calendar');
    const skel = /skeleton/.test(document.getElementById('view-calendar').innerHTML);
    await navP;
    T('navigate loads an unloaded store behind a skeleton, then renders', skel && S.calendar.loaded && st.CALENDAR_EVENTS.length === 1 && !!document.querySelector('#view-calendar .calendar-cell'));
    // A loader that throws leaves the store unloaded (so the next navigate retries) and toasts
    st._sb = fake({ deals: null }); st._sb.from = () => { throw new Error('boom'); };
    S.deals.reset();
    T('a throwing loader leaves the store unloaded', (await S.deals.load()) === false && S.deals.loaded === false);
    st._sb = realSb; st._authUser = null; S.resetStores(); __arkives.resetAllState();
    location.hash = 'tasks'; __arkives.navigate('tasks');
  }

  return { out, xss: !!window.__x };
}, { ACTION_NAMES: [...actionNames], VIEW_KEYS });
await browser.close();
server.close();

let fails = 0;
for (const r of [...staticOut, ...results.out]) {
  if (!r.pass) fails++;
  console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.detail && !r.pass ? '  -> ' + r.detail : ''));
}
console.log(`\n${staticOut.length + results.out.length - fails}/${staticOut.length + results.out.length} passed | injection fired: ${results.xss} | page errors: ${pageErrors.length ? pageErrors.join(' | ') : 'none'} | registry warnings: ${registryWarnings.length ? registryWarnings.join(' | ') : 'none'}`);
process.exit(fails || results.xss || pageErrors.length || registryWarnings.length ? 1 : 0);
