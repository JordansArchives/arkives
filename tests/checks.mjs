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
const SRC = ['index.html', 'app.js', 'invoices.js', 'outreach.js', 'boards.js', 'toolkit-views.js', 'theme.js'];
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
const hdr = siteHeaders();
S('_headers enforces the CSP (not report-only)', !!hdr['content-security-policy'] && !hdr['content-security-policy-report-only']);
S("script-src has no 'unsafe-inline' or 'unsafe-eval'", (() => { const d = (hdr['content-security-policy'] || '').split(';').find(x => x.trim().startsWith('script-src')) || ''; return d && !/unsafe-inline|unsafe-eval/.test(d); })());

const PORT = 8742;
const server = await startServer(PORT);
const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.message)));
await page.goto(`http://localhost:${PORT}/#dashboard`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

const results = await page.evaluate(async (ACTION_NAMES) => {
  const out = [];
  const T = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail === undefined ? '' : String(detail) });

  // Escaping
  T('_esc escapes quotes and angle brackets', _esc('a"b<c>&') === 'a&quot;b&lt;c&gt;&amp;');
  T('_safeThumb accepts an image data URL', _safeThumb('data:image/jpeg;base64,AAAA/+==') === 'data:image/jpeg;base64,AAAA/+==');
  T('_safeThumb rejects attribute injection', _safeThumb('x" onerror="alert(1)') === '');
  T('_safeThumb rejects svg data URLs', _safeThumb('data:image/svg+xml;base64,AAAA') === '');

  // Board content guards
  T('YouTube id shape accepted', _bdValidVid({ provider: 'youtube', vid: 'dQw4w9WgXcQ' }) === true);
  T('YouTube id injection rejected', _bdValidVid({ provider: 'youtube', vid: '"><img src=x onerror=1>' }) === false);
  T('Vimeo id must be numeric', _bdValidVid({ provider: 'vimeo', vid: '12345' }) && !_bdValidVid({ provider: 'vimeo', vid: '12a' }));
  T('embed src is null for a bad id', _bdEmbedSrc({ provider: 'youtube', vid: 'bad' }) === null);
  T('pen path coerces points to numbers', _bdPathD([['1', '2'], ['3" onload="x', '4'], [5, 6]]) === 'M1 2 L5 6');
  T('_bdNum clamps and defaults', _bdNum('"><x', 3, 1, 40) === 3 && _bdNum(99, 3, 1, 40) === 40 && _bdNum(2.5, 3, 1, 40) === 2.5);
  T('_bdSafeUrl rejects javascript:', _bdSafeUrl('javascript:alert(1)') === null && _bdSafeUrl('https://a.b/c') === 'https://a.b/c');
  T('_bdParseVideoUrl rejects non-http', _bdParseVideoUrl('javascript:alert(1)') === null && _bdParseVideoUrl('https://youtu.be/dQw4w9WgXcQ').vid === 'dQw4w9WgXcQ');
  const vEl = _bdItemEl({ id: 'v1', kind: 'video', x: 0, y: 0, w: 100, h: 60, z: 1, content: { url: 'https://x.y', provider: 'youtube', vid: '"><img src=x onerror=window.__x=1>' } });
  T('video item with a bad id renders as a link card', !vEl.querySelector('img') && !!vEl.querySelector('.bd-link-card'));
  const dEl = _bdItemEl({ id: 'd1', kind: 'draw', x: 0, y: 0, w: 10, h: 10, z: 1, content: { points: 'nope', width: '"/><script>', color: 'ink' } });
  T('draw item with junk content is inert', dEl.querySelector('path')?.getAttribute('stroke-width') === '3' && !dEl.querySelector('script'));

  // Scripts autosave: dirty-only, ordered, serialized, failure requeues
  const sent = [];
  window._saveSceneFields = async (id, fields, tok) => { sent.push({ id, fields: JSON.parse(JSON.stringify(fields)), tok }); await new Promise(r => setTimeout(r, 20)); };
  window.sbUpdateScript = async (id, updates, tok) => { sent.push({ id, updates, tok }); return true; };
  _currentScriptId = 'S1'; _sharedScriptToken = null;
  _currentScenes = [{ id: 'a', script_text: '', scene_description: '' }, { id: 'b', script_text: '', scene_description: '' }];
  _sceneDirty = { a: { script_text: 'hello' } }; _titleDirty = 'New title';
  const p1 = _flushScriptSaves();
  _sceneDirty = { b: { scene_description: 'wide' } };
  const p2 = _flushScriptSaves();
  await Promise.all([p1, p2]);
  T('flush sends title, then only dirty scene fields, in order', JSON.stringify(sent) === JSON.stringify([
    { id: 'S1', updates: { title: 'New title' }, tok: null },
    { id: 'a', fields: { script_text: 'hello' }, tok: null },
    { id: 'b', fields: { scene_description: 'wide' }, tok: null }
  ]), JSON.stringify(sent));
  T('flush clears the dirty set', Object.keys(_sceneDirty).length === 0 && _titleDirty === null);
  window._saveSceneFields = async () => { throw new Error('net'); };
  _sceneDirty = { a: { script_text: 'retry me' } };
  await _flushScriptSaves();
  T('a failed save is requeued for the next flush', _sceneDirty.a?.script_text === 'retry me');
  _sceneDirty = {};

  // Editor renders from state; input updates state
  const c = document.getElementById('view-script-editor');
  _currentScriptRow = { id: 'S1', title: 'T "q"', share_mode: 'none', share_token: 'tok' };
  _currentScenes = [{ id: 'a', script_text: 'x', scene_description: 'y', thumbnail_data: 'x" onerror="window.__x=1' }];
  _renderEditorUI(c, _currentScriptRow, _currentScenes, false);
  T('title with quotes survives the value attribute', document.getElementById('scriptTitleInput')?.value === 'T "q"');
  T('crafted thumbnail is not rendered', !c.querySelector('.script-thumb-preview img'));
  const ta = c.querySelector('textarea[data-scene-id="a"][data-field="script_text"]');
  ta.value = 'typed'; ta.dispatchEvent(new Event('input', { bubbles: true }));
  T('typing updates in-memory scenes and the dirty set', _currentScenes[0].script_text === 'typed' && _sceneDirty.a?.script_text === 'typed');
  clearTimeout(_scriptAutoSaveTimer); _sceneDirty = {};

  // Auth panels
  _authShow('forgotForm');
  T('forgot-password panel shows alone', document.getElementById('forgotForm').style.display === '' && document.getElementById('loginForm').style.display === 'none');
  _authShow('recoveryForm');
  T('recovery panel exists', document.getElementById('recoveryForm').style.display === '');
  _authShow('loginForm');

  // Modals live on <body>
  document.getElementById('loaderOverlay')?.remove();
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appShell').style.display = '';
  CREATOR._sbId = 'u1';
  TASKS = [{ _sbId: 't1', title: 'A', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '' }];
  renderTasks();
  T('task modal is body-mounted', document.getElementById('taskModalHost')?.parentElement === document.body);
  openEditTaskModal('t1');
  T('task modal covers the sidebar', /modal/.test(document.elementFromPoint(60, 300)?.className || ''));
  closeEditTaskModal();
  renderCalendar();
  T('calendar modal is body-mounted', document.getElementById('calendarModalHost')?.parentElement === document.body);

  // Dashboard with valueless deals
  DEALS = [{ _sbId: 'd', brand: 'B', status: 'Active', value: 0, paid: 0, outstanding: 0, invoiced: 0 }];
  renderDashboard();
  T('dashboard shows no NaN', !/NaN/.test(document.getElementById('view-dashboard').innerText));

  // Logout reset
  CREATOR.name = 'X'; CREATOR.bankAccountNumber = '999'; INVOICE_DATA = [{ _sbId: 'i' }];
  resetAllState();
  T('resetAllState wipes profile, bank details, data, and views', CREATOR.name === '' && CREATOR.bankAccountNumber === undefined && INVOICE_DATA.length === 0 && document.getElementById('view-dashboard').innerHTML === '');

  // Invoice dates are local-calendar
  T('Net 30 lands on the local calendar day', invTermDueDate('2026-09-03', 'net30') === '2026-10-03', invTermDueDate('2026-09-03', 'net30'));

  // ---- Boards on touch ----
  window.sbUpdateBoardItem = async () => true;
  window.sbUpdateBoard = async () => true;
  _bdBoard = { id: 'B1', title: 'Board', share_mode: 'none', share_token: 'tk', view_x: 0, view_y: 0, view_zoom: 1 };
  _bdView = { x: 0, y: 0, z: 1 }; _bdItems = []; _bdSelectedId = null; _bdReadOnly = false; _bdSharedToken = null;
  _bdUndoStack = []; _bdRedoStack = [];
  const bc = document.getElementById('view-board-editor');
  bc.style.display = 'block';
  bc.innerHTML = _bdEditorShellHtml(false);
  _bdApplyView(); _bdBindEditor();
  const vp = document.getElementById('bdViewport');
  const rect = vp.getBoundingClientRect();
  const pe = (type, id, x, y) => vp.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: rect.left + x, clientY: rect.top + y, bubbles: true, isPrimary: id === 1 }));
  // Two fingers land 100px apart, spread to 200px: zoom should roughly double
  pe('pointerdown', 1, 100, 100); pe('pointerdown', 2, 200, 100);
  pe('pointermove', 1, 50, 100); pe('pointermove', 2, 250, 100);
  const zAfterSpread = _bdView.z;
  pe('pointerup', 1, 50, 100); pe('pointerup', 2, 250, 100);
  T('pinch spread zooms in', zAfterSpread > 1.8 && zAfterSpread < 2.2, zAfterSpread);
  T('pinch ends cleanly', _bdPinch === null && _bdPointers.size === 0 && _bdPtr === null);
  // Two fingers moving together pan
  _bdView = { x: 0, y: 0, z: 1 }; _bdApplyView();
  pe('pointerdown', 3, 100, 100); pe('pointerdown', 4, 200, 100);
  pe('pointermove', 3, 130, 140); pe('pointermove', 4, 230, 140);
  pe('pointerup', 3, 130, 140); pe('pointerup', 4, 230, 140);
  T('two-finger drag pans', Math.round(_bdView.x) === 30 && Math.round(_bdView.y) === 40 && Math.abs(_bdView.z - 1) < 0.001, JSON.stringify(_bdView));
  // A single touch still pans (bubble handler untouched)
  _bdView = { x: 0, y: 0, z: 1 }; _bdApplyView();
  pe('pointerdown', 5, 100, 100); pe('pointermove', 5, 120, 110); pe('pointerup', 5, 120, 110);
  T('single finger still pans', Math.round(_bdView.x) === 20 && Math.round(_bdView.y) === 10, JSON.stringify(_bdView));
  // Undo / redo buttons follow the stacks
  const ub = document.getElementById('bdUndoBtn'), rb = document.getElementById('bdRedoBtn');
  T('undo/redo buttons start disabled', ub && rb && ub.disabled && rb.disabled);
  _bdItems = [{ id: 'n1', board_id: 'B1', kind: 'note', x: 0, y: 0, w: 100, h: 100, z: 1, content: { text: 'a', color: 'yellow' } }];
  document.getElementById('bdPlane').appendChild(_bdItemEl(_bdItems[0]));
  _bdPushUndo({ type: 'update', id: 'n1', before: { x: 0 }, after: { x: 50 } });
  T('undo enabled after an op', !ub.disabled && rb.disabled);
  await _bdUndo();
  T('redo enabled after undo', ub.disabled && !rb.disabled && _bdItems[0].x === 0);
  await _bdRedo();
  T('redo re-applies', _bdItems[0].x === 50 && !ub.disabled);
  // Remote ops apply to state + DOM, but never over an item being edited
  await _bdApplyRemoteOp({ board: 'B1', type: 'upsert', item: { id: 'r1', board_id: 'B1', kind: 'text', x: 5, y: 5, w: 200, h: 40, z: 2, content: { text: 'from afar', size: 'body' } } });
  T('remote upsert adds item', _bdItems.some(i => i.id === 'r1') && !!document.querySelector('.bd-item[data-id="r1"]'));
  await _bdApplyRemoteOp({ board: 'OTHER', type: 'delete', id: 'r1' });
  T('remote op for another board ignored', _bdItems.some(i => i.id === 'r1'));
  const ed = document.querySelector('.bd-item[data-id="r1"] .bd-text-content'); ed.setAttribute('contenteditable', 'true');
  await _bdApplyRemoteOp({ board: 'B1', type: 'upsert', item: { id: 'r1', board_id: 'B1', kind: 'text', x: 5, y: 5, w: 200, h: 40, z: 2, content: { text: 'clobber', size: 'body' } } });
  T('remote upsert skips an item being edited', _bdItems.find(i => i.id === 'r1').content.text === 'from afar');
  ed.setAttribute('contenteditable', 'false');
  await _bdApplyRemoteOp({ board: 'B1', type: 'delete', id: 'r1' });
  T('remote delete removes item', !_bdItems.some(i => i.id === 'r1') && !document.querySelector('.bd-item[data-id="r1"]'));
  T('crafted remote item is rendered inert', (() => { _bdApplyRemoteOp({ board: 'B1', type: 'upsert', item: { id: 'x1', board_id: 'B1', kind: 'video', x: 0, y: 0, w: 10, h: 10, z: 1, content: { url: 'https://a', provider: 'youtube', vid: '"><img src=x onerror=window.__x=1>' } } }); return !window.__x; })());

  // ---- Scripts: move up/down ----
  const reorders = [];
  window.sbReorderScenes = async (scenes) => { reorders.push(scenes.map(s => s.id)); };
  window._flushScriptSaves = async () => {};
  _currentScriptId = 'S2'; _sharedScriptToken = null;
  _currentScriptRow = { id: 'S2', title: 'T', share_mode: 'none' };
  _currentScenes = [{ id: 'a', script_text: '', scene_description: '' }, { id: 'b', script_text: '', scene_description: '' }, { id: 'c', script_text: '', scene_description: '' }];
  await _moveScene('c', -1);
  T('move up reorders and persists', JSON.stringify(reorders[0]) === '["a","c","b"]' && _currentScenes[1].id === 'c', JSON.stringify(reorders));
  await _moveScene('a', -1);
  T('move up at top is a no-op', reorders.length === 1);
  const rowsHtml = document.getElementById('view-script-editor').innerHTML;
  T('first row has Move up disabled, last has Move down disabled', /title="Move up" disabled/.test(rowsHtml) && /title="Move down" disabled/.test(rowsHtml));

  // ---- Tasks: optimistic toggles + undo-able delete ----
  const taskWrites = [];
  window.sbUpdateTask = async (id, u) => { taskWrites.push(u); return !u.__fail; };
  window.sbDeleteTasks = async (ids) => { taskWrites.push({ del: ids }); return true; };
  TASKS = [{ _sbId: 't1', title: 'A', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-01' },
           { _sbId: 't2', title: 'B', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-02' }];
  _taskPendingDeletes = {};
  location.hash = 'tasks'; navigate('tasks');
  const p = toggleTaskComplete('t1');
  // A completed task leaves the active list and the collapsed Completed count goes up, before the save resolves
  T('complete flips before the save resolves', TASKS.find(t => t._sbId === 't1').completed === true && !document.querySelector('.task-list:not(.task-list-completed) .task-item[data-id="t1"]') && /Completed \(1\)/.test(document.getElementById('view-tasks').textContent));
  await p;
  T('complete persisted', taskWrites.some(w => w.completed === true));
  window.sbUpdateTask = async () => false;
  await toggleTaskStar('t2');
  T('failed star save reverts', TASKS.find(t => t._sbId === 't2').starred === false);
  deleteTask('t2');
  T('delete removes immediately with an Undo toast', !TASKS.some(t => t._sbId === 't2') && document.getElementById('undo-toast')?.classList.contains('show'));
  document.querySelector('#undo-toast .undo-toast-btn').click();
  T('undo restores the task without a DB call', TASKS.some(t => t._sbId === 't2') && !taskWrites.some(w => w.del) && !_taskPendingDeletes.t2);
  deleteTask('t2');
  _flushTaskDeletes();
  await new Promise(r => setTimeout(r, 10));
  T('flush commits a pending delete', taskWrites.some(w => w.del && w.del[0] === 't2') && !TASKS.some(t => t._sbId === 't2'));

  // ---- Invoices: routes + row sheet ----
  INVOICE_DATA = [{ _sbId: 'i1', invoiceNumber: 'ACME-0001', brand: 'Acme', billToName: 'Acme Media', billToAddress: '', date: '2026-08-01', dueDate: '', status: 'sent', lineItems: [{ type: 'flat', desc: 'Reel', qty: 1, rate: 0, fee: 100 }], amount: 100, amountPaid: 0, tax: 0, notes: '', includePaymentInfo: false, paymentTerms: 'none', clientId: null, description: 'Reel' }];
  CLIENTS = []; _invoicingMigrationMissing = false;
  location.hash = 'invoices/i1'; navigate('invoices/i1');
  T('#invoices/{id} opens the editor', _invEditorOpen && _invEditingId === 'i1' && !!document.getElementById('invBillToName'));
  location.hash = 'invoices'; navigate('invoices');
  T('#invoices closes the editor', !_invEditorOpen && !!document.getElementById('invTbody'));
  location.hash = 'invoices/new'; navigate('invoices/new');
  T('#invoices/new starts a blank invoice', _invEditorOpen && _invEditingId === null && _inv && _inv.status === 'draft');
  location.hash = 'invoices'; navigate('invoices');
  invOpenRowMenu('i1');
  T('row sheet mounts on body with the status action', document.getElementById('invSheetHost')?.parentElement === document.body && /Record Payment/.test(document.getElementById('invSheetHost').innerHTML));
  invCloseRowMenu();
  T('row sheet closes', document.getElementById('invSheetHost').innerHTML === '');
  T('unknown hash falls back to dashboard', (() => { location.hash = 'nope'; navigate('nope'); return document.getElementById('view-dashboard').classList.contains('active'); })());
  T('tab bar marks the active tool', (() => { location.hash = 'tasks'; navigate('tasks'); return document.querySelector('.tabbar [data-tab="tasks"]').classList.contains('active') && !document.querySelector('.tabbar [data-tab="boards"]').classList.contains('active'); })());
  T('editor routes set editor-open on body', (() => { location.hash = 'script/abc'; navigate('script/abc'); const on = document.body.classList.contains('editor-open'); location.hash = 'tasks'; navigate('tasks'); return on && !document.body.classList.contains('editor-open'); })());
  _scriptLoadToken++; // abandon the stray editor fetch

  // ---- Event delegation: every data-* name in the source has a handler ----
  const unregistered = ACTION_NAMES.filter(n => typeof ACTIONS[n] !== 'function');
  T('every data-action/input/change/keydown/submit in the source is registered (' + ACTION_NAMES.length + ' names)', unregistered.length === 0, unregistered.join(', '));

  // ---- Event delegation: dispatcher semantics ----
  const calls = [];
  act({
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
      <button id="d1" data-action="__t1" data-args="${_args('a', '$event', '$el', 7)}">x</button>
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
  ['__t0', '__t1', '__tStop', '__tOuter', '__tIn', '__tChk', '__tKey', '__tSub'].forEach(n => { delete ACTIONS[n]; });

  // ---- Event delegation: the real UI, driven by clicks ----
  // Auth form submits through the dispatcher
  const realLogin = ACTIONS.handleLogin; let loginEv = null;
  ACTIONS.handleLogin = (ev) => { ev.preventDefault(); loginEv = ev; };
  document.getElementById('loginEmail').value = 't@example.com'; document.getElementById('loginPassword').value = 'pw';
  document.getElementById('loginForm').requestSubmit(); // real path: validation, then the delegated submit
  document.getElementById('loginEmail').value = ''; document.getElementById('loginPassword').value = '';
  ACTIONS.handleLogin = realLogin;
  T('login form submit reaches handleLogin with the event', loginEv && loginEv.type === 'submit');
  // Settings tabs (constant args)
  location.hash = 'settings'; navigate('settings');
  document.querySelector('.settings-tab[data-tab="ratecard"]').click();
  T('settings tab click switches the panel', document.querySelector('.settings-tab[data-tab="ratecard"]').classList.contains('active') && document.getElementById('settings-panel-ratecard').style.display === '' && document.getElementById('settings-panel-profile').style.display === 'none');
  // Calendar day cell (dynamic args) opens the modal prefilled; backdrop closes it; the card does not
  location.hash = 'calendar'; navigate('calendar');
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
  window.sbUpdateTask = async () => true;
  TASKS = [{ _sbId: 'k1', title: 'Click me', details: '', dueDate: '', starred: false, completed: false, completedAt: '', createdAt: '2026-09-01' }];
  location.hash = 'tasks'; navigate('tasks');
  document.querySelector('.task-item[data-id="k1"] .task-body').click();
  const tModal = document.getElementById('editTaskModal');
  T('task body click opens the edit modal for that task', tModal.style.display !== 'none' && _editingTaskId === 'k1' && document.getElementById('etTitle').value === 'Click me');
  tModal.querySelector('.modal-card').click();
  T('click inside the task card keeps it open', tModal.style.display !== 'none');
  tModal.click();
  T('click on the task backdrop closes it', tModal.style.display === 'none' && _editingTaskId === null);
  document.getElementById('etTitle').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); // closed modal: harmless
  document.querySelector('.task-item[data-id="k1"] .task-check').click();
  T('task check click completes the task', TASKS[0].completed === true);
  // Invoices: row click opens; the actions cell stops the row; the sheet backdrop closes
  INVOICE_DATA = [{ _sbId: 'i1', invoiceNumber: 'ACME-0001', brand: 'Acme', billToName: 'Acme Media', billToAddress: '', date: '2026-08-01', dueDate: '', status: 'sent', lineItems: [{ type: 'flat', desc: 'Reel', qty: 1, rate: 0, fee: 100 }], amount: 100, amountPaid: 0, tax: 0, notes: '', includePaymentInfo: false, paymentTerms: 'none', clientId: null, description: 'Reel' }];
  location.hash = 'invoices'; navigate('invoices');
  document.querySelector('.inv-row td').click();
  T('invoice row click opens that invoice', _invEditorOpen && _invEditingId === 'i1');
  location.hash = 'invoices'; navigate('invoices');
  document.querySelector('.inv-row .inv-row-more').click();
  T('row actions click opens the sheet without opening the row', !_invEditorOpen && /Record Payment/.test(document.getElementById('invSheetHost').innerHTML));
  document.querySelector('#invSheetHost .inv-sheet').click();
  T('click inside the sheet keeps it open', document.getElementById('invSheetHost').innerHTML !== '');
  document.querySelector('#invSheetHost .inv-sheet-overlay').click();
  T('click on the sheet backdrop closes it', document.getElementById('invSheetHost').innerHTML === '');
  invOpenRowMenu('i1');
  const sheetPick = document.querySelector('#invSheetHost .inv-sheet-btn[data-action="invRowMenuPick"]');
  sheetPick.click();
  T('a sheet action closes the sheet and runs (Open)', document.getElementById('invSheetHost').innerHTML === '' && _invEditorOpen && _invEditingId === 'i1');
  location.hash = 'invoices'; navigate('invoices');
  // Outreach rail (dynamic args through a template)
  OUTREACH_TARGETS = []; OUTREACH_LISTS = [{ _sbId: 'L1', name: 'Brands' }]; _outSelectedList = 'all';
  location.hash = 'outreach'; navigate('outreach');
  document.querySelector('.out-rail-item[data-action="outSelectList"][data-args*="L1"]').click();
  T('outreach list click selects the list', _outSelectedList === 'L1');
  // Card pattern used by Scripts and Boards lists: go() on the card, a stopped delete button inside
  const realDel = ACTIONS._deleteBoard; let delId = null; ACTIONS._deleteBoard = (id) => { delId = id; };
  const card = document.createElement('div');
  card.innerHTML = '<div class="board-card" data-action="go" data-args="' + _args('board/zz') + '"><button class="board-card-delete" data-action="_deleteBoard" data-args="' + _args('zz') + '" data-stop>x</button></div>';
  document.body.appendChild(card);
  location.hash = 'boards';
  card.querySelector('.board-card-delete').click();
  T('card delete button runs and does not open the card', delId === 'zz' && location.hash === '#boards');
  card.querySelector('.board-card').click();
  T('card click navigates', location.hash === '#board/zz');
  ACTIONS._deleteBoard = realDel; card.remove(); location.hash = 'tasks'; navigate('tasks');
  // Boards zoom buttons in the editor shell
  const zBefore = _bdView.z;
  document.querySelector('#view-board-editor .bd-zoom button[data-args="[1]"]').click();
  T('board zoom-in button zooms', _bdView.z > zBefore, zBefore + ' -> ' + _bdView.z);

  // ---- jsPDF works under the CSP (no unsafe-eval) ----
  T('jsPDF renders under the CSP', (() => { try { const d = new jspdf.jsPDF(); d.text('csp', 10, 10); return /^data:application\/pdf/.test(d.output('datauristring')); } catch (e) { return false; } })());

  return { out, xss: !!window.__x };
}, [...actionNames]);
await browser.close();
server.close();

let fails = 0;
for (const r of [...staticOut, ...results.out]) {
  if (!r.pass) fails++;
  console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.detail && !r.pass ? '  -> ' + r.detail : ''));
}
console.log(`\n${staticOut.length + results.out.length - fails}/${staticOut.length + results.out.length} passed | injection fired: ${results.xss} | page errors: ${pageErrors.length ? pageErrors.join(' | ') : 'none'}`);
process.exit(fails || results.xss || pageErrors.length ? 1 : 0);
