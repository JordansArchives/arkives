// Arkives — Hash routing, view switching, theme toggle and mobile nav.
import { state } from './state.js';
import { safeSet } from './lib/storage.js';
import { storesFor } from './stores/index.js';
import { renderAnalytics } from './views/analytics.js';
import { _bdCommitActiveText, _bdFlushPendingSaves, _bdLiveLeave, renderBoardEditor, renderBoards, renderSharedBoard } from './views/boards.js';
import { renderCalendar } from './views/calendar.js';
import { renderContracts } from './views/contracts.js';
import { renderDashboard } from './views/dashboard.js';
import { renderInbox } from './views/inbox.js';
import { renderInvoices, unmountInvoices } from './views/invoices.js';
import { renderMediaKit } from './views/mediakit.js';
import { renderOutreach } from './views/outreach.js';
import { renderRevenue } from './views/revenue.js';
import { _flushScriptSaves, renderScriptEditor, renderScripts, renderSharedScript } from './views/scripts.js';
import { renderSettings } from './views/settings.js';
import { renderTasks, unmountTasks } from './views/tasks.js';




function getHash() {
  return (window.location.hash || "#dashboard").replace("#", "");
}

/* ---- VIEW REGISTRY ----
   One entry per view: how to render it, and (when it holds unsaved work
   or body-mounted UI) how to leave it. The router calls unmount when the
   route changes, subscribes the mounted view to its stores so a store
   write re-renders it, and loads a view's stores before its first paint. */
const VIEWS = {
  dashboard: { render: renderDashboard },
  revenue: { render: renderRevenue },
  mediakit: { render: renderMediaKit },
  analytics: { render: renderAnalytics },
  outreach: { render: renderOutreach },
  inbox: { render: renderInbox },
  calendar: { render: renderCalendar },
  settings: { render: renderSettings },
  scripts: { render: renderScripts },
  boards: { render: renderBoards },
  contracts: { render: renderContracts },
  invoices: { render: renderInvoices, unmount: unmountInvoices }, // render(sub) applies the route; render() keeps the editor
  tasks: { render: renderTasks, unmount: unmountTasks },
};
// Editors and shared-link routes: keyed by the full hash so moving from
// one script to another flushes the first.
const EDITORS = {
  'script/': { unmount: _flushScriptSaves },
  'shared/': { unmount: _flushScriptSaves },
  'board/': { unmount: unmountBoardEditor },
  'bshared/': { unmount: unmountBoardEditor },
};
function unmountBoardEditor() { _bdCommitActiveText(); _bdFlushPendingSaves(); _bdLiveLeave(); }
const SKELETON = '<div style="padding:32px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:200px;border-radius:12px"></div></div>';

let _current = null;   // { key, def, sub, unsubs }
let _navToken = 0;     // a navigate that finishes loading after a newer one started paints nothing

function _leave(nextKey) {
  if (!_current || _current.key === nextKey) return;
  const leaving = _current;
  _current = null;
  leaving.unsubs.forEach((u) => u());
  if (leaving.def && leaving.def.unmount) {
    try { leaving.def.unmount(); } catch (e) { console.error('unmount ' + leaving.key + ' failed', e); }
  }
}
function _enter(key, def, sub, base) {
  if (_current && _current.key === key) { _current.sub = sub; return; }
  const unsubs = base ? storesFor(base).map((s) => s.subscribe(() => { if (_current && _current.key === key) def.render(); })) : [];
  _current = { key, def, sub, unsubs };
}
function currentRoute() { return _current ? { key: _current.key, sub: _current.sub } : null; }

async function navigate(view) {
  const token = ++_navToken;
  /* Handle sub-routes: board/UUID, script/UUID, shared/TOKEN, bshared/TOKEN */
  if (/^(bshared|board|script|shared)\//.test(view)) _leave(view);
  if (view.startsWith('bshared/')) {
    // Public shared-board link — works logged out, sidebar hidden
    document.body.classList.add('editor-open');
    var bsClean = view.split('?')[0];
    var bsToken = bsClean.split('/')[1];
    var bsMode = bsClean.split('/')[2] || 'view';
    document.querySelectorAll('.view').forEach(function(v) { v.style.display = 'none'; v.classList.remove('active'); });
    var bsEl = document.getElementById('view-board-editor');
    if (bsEl) { bsEl.style.display = 'block'; bsEl.classList.add('active'); }
    document.getElementById('sidebar').style.display = 'none';
    var bsMc = document.querySelector('.main') || document.getElementById('mainContent');
    if (bsMc) bsMc.style.marginLeft = '0';
    if (typeof renderSharedBoard === 'function') renderSharedBoard(bsToken, bsMode);
    _enter(view, EDITORS['bshared/'], '', null);
    return;
  }
  if (view.startsWith('board/')) {
    document.body.classList.add('editor-open');
    var boardId = view.split('/')[1];
    document.querySelectorAll('.view').forEach(function(v) { v.style.display = 'none'; v.classList.remove('active'); });
    var bdEl = document.getElementById('view-board-editor');
    if (bdEl) { bdEl.style.display = 'block'; bdEl.classList.add('active'); }
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    var navB = document.querySelector('[data-view="boards"]');
    if (navB) navB.classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    var ovB = document.querySelector('.sidebar-overlay'); if (ovB) ovB.classList.remove('open');
    if (typeof renderBoardEditor === 'function') renderBoardEditor(boardId);
    _enter(view, EDITORS['board/'], '', null);
    return;
  }
  if (view.startsWith('script/')) {
    document.body.classList.add('editor-open');
    var scriptId = view.split('/')[1];
    document.querySelectorAll('.view').forEach(function(v) { v.style.display = 'none'; v.classList.remove('active'); });
    var edEl = document.getElementById('view-script-editor');
    if (edEl) { edEl.style.display = 'block'; edEl.classList.add('active'); }
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    var navS = document.querySelector('[data-view="scripts"]');
    if (navS) navS.classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    var ov = document.querySelector('.sidebar-overlay'); if (ov) ov.classList.remove('open');
    renderScriptEditor(scriptId);
    _enter(view, EDITORS['script/'], '', null);
    return;
  }
  if (view.startsWith('shared/')) {
    document.body.classList.add('editor-open');
    // Strip any query string that may have gotten into the hash
    var cleanView = view.split('?')[0];
    var shareToken = cleanView.split('/')[1];
    var shareMode = (cleanView.split('/')[2]) || 'view';
    document.querySelectorAll('.view').forEach(function(v) { v.style.display = 'none'; v.classList.remove('active'); });
    var shEl = document.getElementById('view-shared-script');
    if (shEl) { shEl.style.display = 'block'; shEl.classList.add('active'); }
    document.getElementById('sidebar').style.display = 'none';
    var mc = document.querySelector('.main') || document.getElementById('mainContent');
    if (mc) mc.style.marginLeft = '0';
    renderSharedScript(shareToken, shareMode);
    _enter(view, EDITORS['shared/'], '', null);
    return;
  }
  /* Restore sidebar if it was hidden by shared view */
  document.getElementById('sidebar').style.display = '';
  var mc2 = document.querySelector('.main') || document.getElementById('mainContent');
  if (mc2) mc2.style.marginLeft = '';

  document.body.classList.remove('editor-open');

  // "invoices/abc" = the invoices view with a sub-route (an open editor)
  var parts = view.split('/');
  var baseView = parts[0];
  var sub = parts.length > 1 ? parts.slice(1).join('/') : '';
  let el = document.getElementById("view-" + baseView);
  if (!el) { baseView = 'dashboard'; sub = ''; el = document.getElementById('view-dashboard'); }
  _leave(baseView);

  document.querySelectorAll(".view").forEach(v => {
    v.style.display = "none";
    v.classList.remove("active");
  });
  if (el) {
    el.style.display = "block";
    el.classList.add("active");
  }
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const navEl = document.querySelector('.nav-item[data-view="' + baseView + '"]');
  if (navEl) navEl.classList.add("active");
  document.querySelectorAll('.tabbar [data-tab]').forEach(t => t.classList.toggle('active', t.dataset.tab === baseView));

  // Close mobile sidebar
  document.getElementById("sidebar").classList.remove("open");
  const overlay = document.querySelector(".sidebar-overlay");
  if (overlay) overlay.classList.remove("open");

  // First visit to a view this session: load its stores behind a skeleton.
  // Signed out (tests, shared links) there is nothing to load and this is synchronous.
  const pending = state._authUser ? storesFor(baseView).filter((s) => !s.loaded) : [];
  if (pending.length) {
    el.innerHTML = SKELETON;
    await Promise.all(pending.map((s) => s.load()));
    if (token !== _navToken) return;
  }
  _enter(baseView, VIEWS[baseView], sub, baseView);
  renderView(baseView, sub);
}

function renderView(view, sub) {
  const def = VIEWS[view];
  if (def) def.render(sub || '');
}

/* ---- SIDE EFFECTS ---- Registered from main.js in a fixed order, not at import time. */
export function __init() {
  window.addEventListener("hashchange", function() {
    if (!state._booted) return; // init paints the first view itself
    // Only navigate if the app shell is visible (user is authenticated)
    var appEl = document.getElementById('appShell');
    if (appEl && appEl.style.display !== 'none') navigate(getHash());
  });
  /* ---- THEME ---- */
  document.getElementById("themeToggle").addEventListener("click", () => {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    var next = isDark ? "light" : "dark";
    html.setAttribute("data-theme", next);
    safeSet('arkives-theme', next);
    // Charts bake theme colors in at render time
    if (getHash() === "dashboard") renderDashboard();
    else if (getHash() === "revenue") renderRevenue();
  });
  /* ---- MOBILE NAV ---- */
  (function initMobileNav() {
    const overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    document.body.appendChild(overlay);

    document.getElementById("menuToggle").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
      overlay.classList.toggle("open");
    });
    const moreBtn = document.getElementById("tabMore");
    if (moreBtn) moreBtn.addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
      overlay.classList.toggle("open");
    });
    overlay.addEventListener("click", () => {
      document.getElementById("sidebar").classList.remove("open");
      overlay.classList.remove("open");
    });
  })();
}

export { VIEWS, currentRoute, getHash, navigate, renderView };
