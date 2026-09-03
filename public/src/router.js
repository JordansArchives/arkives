// Arkives — Hash routing, view switching, theme toggle and mobile nav.
import { state } from './state.js';
import { safeSet } from './lib/storage.js';
import { renderAnalytics } from './views/analytics.js';
import { _bdFlushPendingSaves, renderBoardEditor, renderBoards, renderSharedBoard } from './views/boards.js';
import { renderCalendar } from './views/calendar.js';
import { renderContracts } from './views/contracts.js';
import { renderDashboard } from './views/dashboard.js';
import { renderInbox } from './views/inbox.js';
import { renderInvoices } from './views/invoices.js';
import { renderMediaKit } from './views/mediakit.js';
import { renderOutreach } from './views/outreach.js';
import { renderRevenue } from './views/revenue.js';
import { _flushScriptSaves, renderScriptEditor, renderScripts, renderSharedScript } from './views/scripts.js';
import { renderSettings } from './views/settings.js';
import { _flushTaskDeletes, renderTasks } from './views/tasks.js';




function getHash() {
  return (window.location.hash || "#dashboard").replace("#", "");
}

function navigate(view) {
  // Leaving an editor: land any debounced saves before the DOM is replaced
  if (typeof _flushScriptSaves === 'function') _flushScriptSaves();
  if (typeof _bdFlushPendingSaves === 'function') _bdFlushPendingSaves();
  if (typeof _flushTaskDeletes === 'function') _flushTaskDeletes();
  /* Handle sub-routes: board/UUID, script/UUID, shared/TOKEN, bshared/TOKEN */
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

  renderView(baseView, sub);
}

function renderView(view, sub) {
  switch (view) {
    case "dashboard": renderDashboard(); break;
    case "revenue": renderRevenue(); break;
    case "mediakit": renderMediaKit(); break;
    case "analytics": renderAnalytics(); break;
    case "outreach": if (typeof renderOutreach === "function") renderOutreach(); break;
    case "inbox": renderInbox(); break;
    case "calendar": renderCalendar(); break;
    case "settings": renderSettings(); break;
    case "scripts": renderScripts(); break;
    case "boards": if (typeof renderBoards === "function") renderBoards(); break;
    case "contracts": renderContracts(); break;
    case "invoices": renderInvoices(sub || ''); break;
    case "tasks": renderTasks(); break;
  }
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

export { getHash, navigate, renderView };
