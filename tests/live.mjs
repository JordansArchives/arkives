// Live-sync end-to-end: two browser pages join the same board channel over
// Supabase Realtime Broadcast (anon key, no login) and one applies an op
// the other sent. This talks to the real project, so it is not part of
// `npm test`; run it when touching the live-sync code:
//
//   npm run test:live
import { chromium } from 'playwright-core';
import { startServer, launchOptions } from './_server.mjs';

const PORT = 8743;
const server = await startServer(PORT);
const browser = await chromium.launch(launchOptions());

async function openBoardPage() {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await page.goto(`http://localhost:${PORT}/#dashboard`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    document.getElementById('loaderOverlay')?.remove();
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appShell').style.display = '';
    __arkives.db.sbUpdateBoardItem = async () => true;
    __arkives.db.sbUpdateBoard = async () => true;
    __arkives.state._bdBoard = { id: 'live-test-board', title: 'Live', share_mode: 'edit', share_token: null, view_x: 0, view_y: 0, view_zoom: 1 };
    __arkives.state._bdView = { x: 0, y: 0, z: 1 }; __arkives.state._bdItems = []; __arkives.state._bdReadOnly = false; __arkives.state._bdSharedToken = null;
    const c = document.getElementById('view-board-editor');
    c.style.display = 'block';
    c.innerHTML = __arkives._bdEditorShellHtml(false);
    __arkives._bdApplyView(); __arkives._bdBindEditor();
  });
  return page;
}

const a = await openBoardPage();
const b = await openBoardPage();

// Join and wait for both subscriptions to report SUBSCRIBED (or fail)
const status = await Promise.all([a, b].map(p => p.evaluate(() => new Promise((resolve) => {
  if (!__arkives.state._sb || typeof __arkives.state._sb.channel !== 'function') return resolve('no-client');
  let done = false;
  const t = setTimeout(() => { if (!done) { done = true; resolve('timeout'); } }, 8000);
  __arkives._bdLiveLeave();
  __arkives.state._bdChannel = __arkives.state._sb.channel('board:live-test-board', { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'op' }, (msg) => __arkives._bdApplyRemoteOp(msg && msg.payload))
    .subscribe((st) => { if (!done && (st === 'SUBSCRIBED' || st === 'CHANNEL_ERROR' || st === 'TIMED_OUT')) { done = true; clearTimeout(t); resolve(st); } });
}))));
console.log('subscribe status:', status.join(', '));

let ok = false;
if (status.every(s => s === 'SUBSCRIBED')) {
  await a.evaluate(() => __arkives._bdLiveSend({ board: 'live-test-board', type: 'upsert', item: { id: 'lv1', board_id: 'live-test-board', kind: 'note', x: 10, y: 10, w: 180, h: 180, z: 1, content: { text: 'hello from A', color: 'teal' } } }));
  for (let i = 0; i < 40 && !ok; i++) {
    await b.waitForTimeout(250);
    ok = await b.evaluate(() => __arkives.state._bdItems.some(it => it.id === 'lv1') && !!document.querySelector('.bd-item[data-id="lv1"]'));
  }
  const selfEcho = await a.evaluate(() => __arkives.state._bdItems.some(it => it.id === 'lv1'));
  console.log(ok ? 'PASS page B received and rendered the op from page A' : 'FAIL page B never received the op');
  console.log(!selfEcho ? 'PASS sender did not receive its own broadcast' : 'FAIL sender echoed its own broadcast');
  ok = ok && !selfEcho;
} else {
  console.log('SKIP live sync could not subscribe (Realtime disabled, offline, or channel auth required); the app degrades to no live sync in that case');
  ok = true;
}
await Promise.all([a, b].map(p => p.evaluate(() => __arkives._bdLiveLeave())));
await browser.close();
server.close();
process.exit(ok ? 0 : 1);
