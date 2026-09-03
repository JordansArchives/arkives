// Logic checks: load the real app, stub Supabase at the function boundary,
// and assert the behavior the 2026-09 audit fixed. Fast (one page load).
//
//   npm run test:checks
import { chromium } from 'playwright-core';
import { startServer, launchOptions } from './_server.mjs';

const PORT = 8742;
const server = await startServer(PORT);
const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.message)));
await page.goto(`http://localhost:${PORT}/#dashboard`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

const results = await page.evaluate(async () => {
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

  return { out, xss: !!window.__x };
});
await browser.close();
server.close();

let fails = 0;
for (const r of results.out) {
  if (!r.pass) fails++;
  console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.detail && !r.pass ? '  -> ' + r.detail : ''));
}
console.log(`\n${results.out.length - fails}/${results.out.length} passed | injection fired: ${results.xss} | page errors: ${pageErrors.length ? pageErrors.join(' | ') : 'none'}`);
process.exit(fails || results.xss || pageErrors.length ? 1 : 0);
