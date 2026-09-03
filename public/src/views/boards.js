// Arkives — Boards: Milanote-style canvas editor, sharing and live sync.
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { _args, act } from '../lib/actions.js';
import { _esc, _escHtml } from '../lib/esc.js';
import { SKETCHY_ICONS } from '../lib/icons.js';
import { _shareLinkRowsHtml } from '../lib/share.js';
import { _showSaveError } from '../lib/toast.js';


const BD_STICKY_COLORS = {
  yellow: '#F7E9A9', red: '#F3C8C6', teal: '#C9E0D4', white: '#FFFFFF'
};
const BD_PEN_COLORS = {
  ink: '#1A1714', red: '#C73539', teal: '#2A6B5A'
};
const BD_MIN_ZOOM = 0.1, BD_MAX_ZOOM = 4;
const BD_TEXT_SIZES = ['small', 'body', 'large', 'title'];
const BD_HILITE = '#F7E9A9';
const BD_HILITE_RGB = 'rgb(247, 233, 169)';

/* ---- CONTENT GUARDS ----
   Item content can arrive from a stranger through an edit link (the RPCs
   validate shape too, since 020), so nothing from content goes into markup
   without a check or an escape. */
function _bdNum(v, dflt, min, max) {
  const n = Number(v);
  if (!isFinite(n)) return dflt;
  return Math.min(max === undefined ? Infinity : max, Math.max(min === undefined ? -Infinity : min, n));
}
function _bdValidVid(c) {
  if (!c) return false;
  if (c.provider === 'youtube') return /^[A-Za-z0-9_-]{11}$/.test(String(c.vid || ''));
  if (c.provider === 'vimeo') return /^[0-9]{1,20}$/.test(String(c.vid || ''));
  return false;
}
function _bdSafeUrl(u) {
  return typeof u === 'string' && /^https?:\/\/\S+$/i.test(u) ? u : null;
}
function _bdEmbedSrc(c) {
  if (!_bdValidVid(c)) return null;
  return c.provider === 'youtube'
    ? 'https://www.youtube.com/embed/' + c.vid + '?autoplay=1'
    : 'https://player.vimeo.com/video/' + c.vid + '?autoplay=1';
}

/* ---- BOARD LIST VIEW ---- */

async function renderBoards() {
  _bdFlushPendingSaves();
  _bdLiveLeave();
  state._bdReadOnly = false;
  _bdFlushOrphans();
  const container = document.getElementById('view-boards');
  container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:200px;border-radius:12px"></div></div>';
  state.BOARDS = await db.sbFetchBoards();
  let html = '<div class="boards-page">';
  html += '<div class="boards-header">';
  html += '<div><h2 class="view-title" style="margin:0">Boards</h2><p style="color:var(--text-secondary);margin:4px 0 0;font-size:13px">Storyboards and idea canvases</p></div>';
  html += '<button class="btn btn-primary" data-action="_createNewBoard">+ New Board</button>';
  html += '</div>';

  if (state.BOARDS.length === 0) {
    html += '<div class="boards-empty">';
    html += '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><path d="M3.2 4.1h17.6v13.7H3.2z"/><path d="M8.1 21.2l3.9-3.3 3.9 3.2"/><path d="M6.8 7.9h4.1v3.9H6.8z"/><path d="M13.9 9.6h3.4"/><path d="M13.8 12.4h3.5"/></svg>';
    html += '<p style="color:var(--text-secondary);font-size:15px;margin:12px 0 0">No boards yet. Create your first storyboard.</p>';
    html += '</div>';
  } else {
    html += '<div class="boards-grid">';
    state.BOARDS.forEach(function(b) {
      const date = new Date(b.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      html += '<div class="board-card" data-action="go" data-args="' + _args('board/' + b.id) + '">';
      html += '<div class="board-card-canvas"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4.2 5.1h6.1v5.2H4.2z"/><path d="M13.6 7.2h6.2"/><path d="M13.7 10.1h4.9"/><path d="M5.1 14.3c3.2 2.6 8.9-1.8 13.7 1.9"/></svg></div>';
      html += '<div class="board-card-title">' + _escHtml(b.title) + '</div>';
      const shareLabel = b.share_mode === 'view' ? 'View link' : (b.share_mode === 'edit' ? 'Edit link' : 'Private');
      const shareDot = (b.share_mode === 'view' || b.share_mode === 'edit') ? 'var(--teal)' : 'var(--text-secondary)';
      html += '<div class="board-card-meta"><span>' + date + '</span>';
      html += '<span style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:' + shareDot + ';display:inline-block"></span>' + shareLabel + '</span></div>';
      html += '<button class="board-card-delete" data-action="_deleteBoard" data-args="' + _args(b.id) + '" data-stop title="Delete board">' + SKETCHY_ICONS.trash + '</button>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

async function _createNewBoard() {
  const board = await db.sbCreateBoard('Untitled Board');
  if (board) window.location.hash = 'board/' + board.id;
}

async function _deleteBoard(boardId) {
  if (!confirm('Delete this board and everything on it? Uploaded images are removed too. This cannot be undone.')) return;
  await db.sbDeleteBoard(boardId);
  renderBoards();
}

/* ---- EDITOR: SHELL ---- */

function _bdEditorActive() {
  const el = document.getElementById('view-board-editor');
  return el && el.style.display !== 'none';
}

async function renderBoardEditor(boardId) {
  _bdFlushPendingSaves();
  const token = ++state._bdLoadToken;
  state._bdReadOnly = false;
  state._bdSharedToken = null;
  state._bdSharedOwnerId = null;
  _bdFlushOrphans();
  state._bdUndoStack = []; state._bdRedoStack = [];
  state._bdEditingEl = null;
  const container = document.getElementById('view-board-editor');
  container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:400px;border-radius:12px"></div></div>';

  const boardRes = state._sb ? await state._sb.from('boards').select('*').eq('id', boardId).maybeSingle() : { data: null };
  if (token !== state._bdLoadToken) return; // user navigated away mid-load
  if (!boardRes.data) {
    container.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text-secondary)">Board not found. <a href="#boards">Back to Boards</a></div>';
    return;
  }
  state._bdBoard = boardRes.data;
  state._bdView = { x: state._bdBoard.view_x || 0, y: state._bdBoard.view_y || 0, z: state._bdBoard.view_zoom || 1 };
  state._bdTool = 'select';
  state._bdSelectedId = null;
  state._bdSignedUrls = {};
  state._bdPtr = null; state._bdPenPts = null;

  state._bdItems = await db.sbFetchBoardItems(boardId);
  if (token !== state._bdLoadToken) return;
  state._bdMaxZ = state._bdItems.reduce((m, it) => Math.max(m, it.z || 1), 1);

  container.innerHTML = _bdEditorShellHtml(false);

  _bdApplyView();
  const plane = document.getElementById('bdPlane');
  state._bdItems.slice().sort((a, b) => (a.z || 1) - (b.z || 1)).forEach(it => plane.appendChild(_bdItemEl(it)));
  _bdBindEditor();
  _bdResolveSignedUrls();
  if (state._bdBoard.share_mode === 'view' || state._bdBoard.share_mode === 'edit') _bdLiveJoin(state._bdBoard.id); else _bdLiveLeave();
}

/* The full editor shell, used by the owner editor and by shared EDIT
   sessions (shared=true drops the owner-only pieces: back button,
   editable title, share popover). */
function _bdEditorShellHtml(shared) {
  const penDots = Object.keys(BD_PEN_COLORS).map(c =>
    '<button class="bd-dot' + (c === state._bdPenColor ? ' active' : '') + '" data-pen-color="' + c + '" style="background:' + BD_PEN_COLORS[c] + '" title="' + c + '"></button>').join('');
  const stickyDots = Object.keys(BD_STICKY_COLORS).map(c =>
    '<button class="bd-dot' + (c === state._bdStickyColor ? ' active' : '') + '" data-sticky-color="' + c + '" style="background:' + BD_STICKY_COLORS[c] + '" title="' + c + '"></button>').join('');

  return (
    '<div class="board-editor">' +
      '<div class="board-topbar">' +
      (shared ? '' :
        '<button class="bd-back" data-action="go" data-args="[&quot;boards&quot;]" title="Back to Boards">' + SKETCHY_ICONS.chevronLeft + '</button>') +
        '<div class="bd-title" id="bdTitle" contenteditable="false" spellcheck="false"' + (shared ? ' style="cursor:default"' : '') + '>' + _escHtml(state._bdBoard.title) + '</div>' +
      (shared ? '<span class="bd-shared-tag">Shared board · can edit</span>' : '') +
        '<span class="bd-savestate" id="bdSaveState"></span>' +
      (shared ? '' :
        '<button class="bd-share-btn" id="bdShareBtn">' + SKETCHY_ICONS.share + '<span id="bdShareBtnLabel">' + (state._bdBoard.share_mode === 'none' || !state._bdBoard.share_mode ? 'Share' : 'Shared') + '</span></button>' +
        '<div class="bd-share-popover" id="bdSharePopover" style="display:none">' +
          '<button class="bd-share-opt" data-share="none">Private</button>' +
          '<button class="bd-share-opt" data-share="view">Anyone with the link can view</button>' +
          '<button class="bd-share-opt" data-share="edit">Anyone with the link can edit</button>' +
          '<div id="bdShareLinks"></div>' +
        '</div>') +
        '<div class="bd-zoom">' +
          '<button data-action="_bdZoomBtn" data-args="[-1]" title="Zoom out">−</button>' +
          '<button class="bd-zoom-pct" id="bdZoomPct" data-action="_bdZoomFit" title="Fit to items">' + Math.round(state._bdView.z * 100) + '%</button>' +
          '<button data-action="_bdZoomBtn" data-args="[1]" title="Zoom in">+</button>' +
        '</div>' +
      '</div>' +
      '<div class="board-viewport" id="bdViewport">' +
        '<div class="board-plane" id="bdPlane"></div>' +
        '<svg class="bd-pen-live" id="bdPenLive" width="0" height="0"></svg>' +
        '<div class="board-toolbar" id="bdToolbar">' +
          '<button class="bd-tool active" data-tool="select" title="Select / move (Esc)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.2 3.1l14.7 7.2-6.4 1.9-2.1 6.3z"/></svg></button>' +
          '<button class="bd-tool" data-tool="note" title="Sticky note"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.1 4.2h15.7v10.9l-4.9 4.8H4.2z"/><path d="M14.9 19.9v-4.8h4.9"/></svg></button>' +
          '<button class="bd-tool" data-tool="text" title="Text"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.1 6.2V4.1h15.8v2.1"/><path d="M12 4.2v15.7"/><path d="M9.1 19.9h5.8"/></svg></button>' +
          '<button class="bd-tool" data-tool="pen" title="Pen"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.1 3.2l3.8 3.7L7.2 20.7l-4.1.4.5-4z"/></svg></button>' +
          '<div class="bd-tool-sep"></div>' +
          '<button class="bd-tool" data-cmd="image" title="Add image (or drag & drop / paste)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 4.1h17.6v15.8H3.2z"/><circle cx="8.6" cy="9" r="1.7"/><path d="M20.7 15.2l-4.8-4.9-9.7 9.6"/></svg></button>' +
          '<button class="bd-tool" data-cmd="video" title="Add video link"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 5.1h17.6v13.8H3.2z"/><path d="M10.1 9.1l4.9 2.9-4.9 2.9z"/></svg></button>' +
          '<div class="bd-tool-sep"></div>' +
          '<button class="bd-tool" data-cmd="undo" id="bdUndoBtn" title="Undo (Ctrl+Z)" disabled><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.9 14.1L4.2 9.4l4.7-4.7"/><path d="M4.5 9.4h9.3c3.3 0 6 2.7 6 6s-2.7 6-6 6H8.1"/></svg></button>' +
          '<button class="bd-tool" data-cmd="redo" id="bdRedoBtn" title="Redo (Ctrl+Shift+Z)" disabled><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.1 14.1l4.7-4.7-4.7-4.7"/><path d="M19.5 9.4h-9.3c-3.3 0-6 2.7-6 6s2.7 6 6 6h5.7"/></svg></button>' +
        '</div>' +
        '<div class="bd-tool-options" id="bdPenOptions" style="display:none">' + penDots +
          '<div class="bd-opt-sep"></div>' +
          '<button class="bd-width' + (state._bdPenWidth === 3 ? ' active' : '') + '" data-pen-width="3" title="Thin"><span style="height:2px"></span></button>' +
          '<button class="bd-width' + (state._bdPenWidth === 6 ? ' active' : '') + '" data-pen-width="6" title="Thick"><span style="height:5px"></span></button>' +
        '</div>' +
        '<div class="bd-tool-options" id="bdStickyOptions" style="display:none">' + stickyDots + '</div>' +
        '<div class="bd-video-popover" id="bdVideoPopover" style="display:none">' +
          '<input type="text" id="bdVideoUrl" placeholder="Paste a YouTube, Vimeo, or any link…">' +
          '<button class="btn btn-primary" data-action="_bdAddVideoFromPopover">Add</button>' +
        '</div>' +
        '<input type="file" id="bdFileInput" accept="image/*" multiple style="display:none">' +
        '<div class="bd-format-bar" id="bdFormatBar" style="display:none">' +
          '<button data-fmt="bold" title="Bold"><b>B</b></button>' +
          '<button data-fmt="underline" title="Underline"><u>U</u></button>' +
          '<button data-fmt="hilite" title="Highlight"><span class="bd-fmt-hilite">H</span></button>' +
          '<div class="bd-fmt-sep"></div>' +
          '<button data-size="small" title="Small text">S</button>' +
          '<button data-size="body" title="Normal text">M</button>' +
          '<button data-size="large" title="Large text">L</button>' +
          '<button data-size="title" title="Title text">XL</button>' +
        '</div>' +
        '<div class="bd-drop-hint" id="bdDropHint">Drop images to add them</div>' +
      '</div>' +
    '</div>');
}

// Pointer capture can throw for synthetic or already-released pointers
function _bdCapture(el, e) { try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } }

/* ---- TOUCH: two-finger pan + pinch zoom ----
   Pointer events deliver each finger separately. When a second finger
   lands, whatever single-finger gesture was in progress ends (the caller
   says how) and the pair drives the viewport until one lifts. Capture
   phase, so the single-pointer handlers never see the second finger. */
function _bdBindPinch(vp, cancelSingle) {
  vp.addEventListener('pointerdown', function(e) {
    if (e.pointerType !== 'touch') return;
    state._bdPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state._bdPointers.size >= 2) {
      if (!state._bdPinch && cancelSingle) cancelSingle();
      const pts = [...state._bdPointers.values()].slice(0, 2);
      state._bdPinch = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2 };
      try { _bdCapture(vp, e); } catch (_) { /* not all targets allow capture */ }
      e.stopPropagation();
    }
  }, true);
  vp.addEventListener('pointermove', function(e) {
    if (e.pointerType !== 'touch' || !state._bdPointers.has(e.pointerId)) return;
    state._bdPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!state._bdPinch || state._bdPointers.size < 2) return;
    const pts = [...state._bdPointers.values()].slice(0, 2);
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
    if (state._bdPinch.dist > 0 && dist > 0) _bdZoomAt(mx, my, dist / state._bdPinch.dist);
    state._bdView.x += mx - state._bdPinch.mx;
    state._bdView.y += my - state._bdPinch.my;
    _bdApplyView();
    state._bdPinch = { dist: dist, mx: mx, my: my };
    e.stopPropagation();
  }, true);
  function lift(e) {
    if (e.pointerType !== 'touch') return;
    state._bdPointers.delete(e.pointerId);
    if (state._bdPinch && state._bdPointers.size < 2) {
      // The remaining finger does nothing until it lifts too
      state._bdPinch = null; state._bdPtr = null; state._bdSuppressClick = true;
      e.stopPropagation();
    }
  }
  vp.addEventListener('pointerup', lift, true);
  vp.addEventListener('pointercancel', lift, true);
}

/* Commit whatever sticky/caption is being typed into (tab hidden, app
   switch on a phone): focusout does not always fire in those cases. */
function _bdCommitActiveText() {
  const el = document.activeElement;
  if (el && el.isContentEditable && el.closest && el.closest('.bd-item') &&
      (el.classList.contains('bd-text-content') || el.classList.contains('bd-caption'))) {
    if (el === state._bdEditingEl) _bdHideFormatBar();
    _bdCommitTextEdit(el);
  }
}
function _bdLiveJoin(boardId) {
  _bdLiveLeave();
  if (!state._sb || !boardId || typeof state._sb.channel !== 'function') return;
  try {
    state._bdChannel = state._sb.channel('board:' + boardId, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'op' }, function(msg) { _bdApplyRemoteOp(msg && msg.payload); })
      .subscribe();
  } catch (e) { console.warn('live sync unavailable', e); state._bdChannel = null; }
}
function _bdLiveLeave() {
  if (state._bdChannel && state._sb) { try { state._sb.removeChannel(state._bdChannel); } catch (_) { /* already gone */ } }
  state._bdChannel = null;
}
function _bdLiveSend(op) {
  if (!state._bdChannel || !op || !op.board) return;
  try { state._bdChannel.send({ type: 'broadcast', event: 'op', payload: op }); } catch (_) { /* best effort */ }
}
async function _bdApplyRemoteOp(op) {
  if (!op || !state._bdBoard || op.board !== state._bdBoard.id) return;
  const plane = document.getElementById('bdPlane');
  if (!plane) return;
  if (op.type === 'delete' && op.id) {
    state._bdItems = state._bdItems.filter(i => i.id !== op.id);
    const el = document.querySelector('.bd-item[data-id="' + op.id + '"]');
    if (el) el.remove();
    if (state._bdSelectedId === op.id) state._bdSelectedId = null;
    return;
  }
  if (op.type === 'upsert' && op.item && op.item.id) {
    const it = op.item;
    const idx = state._bdItems.findIndex(i => i.id === it.id);
    if (idx >= 0) {
      // Never clobber text someone here is in the middle of typing
      if (document.querySelector('.bd-item[data-id="' + it.id + '"] [contenteditable="true"]')) return;
      state._bdItems[idx] = it;
      _bdRefreshItem(it.id);
    } else {
      state._bdItems.push(it);
      plane.appendChild(_bdItemEl(it));
    }
    if ((it.z || 1) > state._bdMaxZ) state._bdMaxZ = it.z;
    if (it.kind === 'image' && it.content && it.content.path && !state._bdSignedUrls[it.content.path]) {
      const url = await _bdUrlForPath(it.content.path);
      if (url) { state._bdSignedUrls[it.content.path] = url; _bdRefreshItem(it.id); }
    }
  }
}

/* ---- EDITOR: COORDS & VIEWPORT ---- */

function _bdScreenToBoard(clientX, clientY) {
  const rect = document.getElementById('bdViewport').getBoundingClientRect();
  return {
    x: (clientX - rect.left - state._bdView.x) / state._bdView.z,
    y: (clientY - rect.top - state._bdView.y) / state._bdView.z
  };
}

function _bdApplyView() {
  const plane = document.getElementById('bdPlane');
  if (plane) plane.style.transform = 'translate(' + state._bdView.x + 'px,' + state._bdView.y + 'px) scale(' + state._bdView.z + ')';
  const live = document.getElementById('bdPenLive');
  if (live) live.style.transform = 'translate(' + state._bdView.x + 'px,' + state._bdView.y + 'px) scale(' + state._bdView.z + ')';
  // The paper texture rides along with the canvas so panning reads as movement
  const vp = document.getElementById('bdViewport');
  if (vp) {
    vp.style.backgroundPosition = state._bdView.x + 'px ' + state._bdView.y + 'px';
    vp.style.backgroundSize = Math.max(120, Math.round(480 * state._bdView.z)) + 'px auto';
  }
  const pct = document.getElementById('bdZoomPct');
  if (pct) pct.textContent = Math.round(state._bdView.z * 100) + '%';
  _bdPositionFormatBar();
  _bdQueueViewSave();
}

function _bdQueueViewSave() {
  if (!state._bdBoard || state._bdSharedToken || state._bdReadOnly) return; // viewport memory belongs to the owner
  // Skip when nothing changed — opening a board shouldn't bump updated_at
  if (state._bdBoard.view_x === state._bdView.x && state._bdBoard.view_y === state._bdView.y && state._bdBoard.view_zoom === state._bdView.z) return;
  clearTimeout(state._bdViewSaveTimer);
  state._bdViewSaveTimer = setTimeout(function() {
    if (!state._bdBoard) return;
    state._bdBoard.view_x = state._bdView.x; state._bdBoard.view_y = state._bdView.y; state._bdBoard.view_zoom = state._bdView.z;
    db.sbUpdateBoard(state._bdBoard.id, { view_x: state._bdView.x, view_y: state._bdView.y, view_zoom: state._bdView.z }, true);
  }, 1000);
}

function _bdZoomAt(clientX, clientY, factor) {
  const rect = document.getElementById('bdViewport').getBoundingClientRect();
  const mx = clientX - rect.left, my = clientY - rect.top;
  const newZ = Math.min(BD_MAX_ZOOM, Math.max(BD_MIN_ZOOM, state._bdView.z * factor));
  state._bdView.x = mx - (mx - state._bdView.x) * (newZ / state._bdView.z);
  state._bdView.y = my - (my - state._bdView.y) * (newZ / state._bdView.z);
  state._bdView.z = newZ;
  _bdApplyView();
}

function _bdZoomBtn(dir) {
  const vp = document.getElementById('bdViewport').getBoundingClientRect();
  _bdZoomAt(vp.left + vp.width / 2, vp.top + vp.height / 2, dir > 0 ? 1.25 : 0.8);
}

function _bdZoomFit() {
  if (!state._bdItems.length) { state._bdView = { x: 0, y: 0, z: 1 }; _bdApplyView(); return; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  state._bdItems.forEach(it => {
    minX = Math.min(minX, it.x); minY = Math.min(minY, it.y);
    maxX = Math.max(maxX, it.x + it.w); maxY = Math.max(maxY, it.y + it.h);
  });
  const vp = document.getElementById('bdViewport').getBoundingClientRect();
  const pad = 60;
  const z = Math.min(BD_MAX_ZOOM, Math.max(BD_MIN_ZOOM, Math.min(
    (vp.width - pad * 2) / Math.max(1, maxX - minX),
    (vp.height - pad * 2) / Math.max(1, maxY - minY), 1.5)));
  state._bdView.z = z;
  state._bdView.x = (vp.width - (maxX - minX) * z) / 2 - minX * z;
  state._bdView.y = (vp.height - (maxY - minY) * z) / 2 - minY * z;
  _bdApplyView();
}

/* ---- EDITOR: ITEM RENDERING ---- */

function _bdRotFor(id) {
  // Deterministic tiny tilt per item so stickies feel hand-placed
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return ((h % 21) - 10) / 12; // -0.83deg .. +0.83deg
}

function _bdItemEl(it) {
  const el = document.createElement('div');
  el.className = 'bd-item bd-kind-' + it.kind + (it.id === state._bdSelectedId ? ' selected' : '');
  el.dataset.id = it.id;
  el.style.left = it.x + 'px';
  el.style.top = it.y + 'px';
  el.style.width = it.w + 'px';
  el.style.zIndex = it.z || 1;
  const c = it.content || {};

  const sizeCls = ' bd-ts-' + (BD_TEXT_SIZES.indexOf(c.size) >= 0 ? c.size : 'body');
  if (it.kind === 'note') {
    el.style.height = it.h + 'px';
    el.style.background = BD_STICKY_COLORS[c.color] || BD_STICKY_COLORS.yellow;
    el.style.transform = 'rotate(' + _bdRotFor(it.id) + 'deg)';
    el.innerHTML = '<div class="bd-text-content' + sizeCls + '" spellcheck="false">' + _bdTextHtml(c) + '</div>' + _bdHandlesHtml(it);
  } else if (it.kind === 'text') {
    el.style.height = 'auto';
    el.innerHTML = '<div class="bd-text-content' + sizeCls + '" spellcheck="false">' + _bdTextHtml(c) + '</div>' + _bdHandlesHtml(it);
  } else if (it.kind === 'image') {
    el.style.height = it.h + 'px';
    const url = state._bdSignedUrls[c.path];
    el.innerHTML =
      '<div class="bd-media-frame">' + (url
        ? '<img src="' + _esc(url) + '" draggable="false" alt="">'
        : '<div class="bd-media-loading">…</div>') + '</div>' +
      _bdCaptionHtml(c.caption) + _bdHandlesHtml(it);
  } else if (it.kind === 'video') {
    el.style.height = it.h + 'px';
    el.innerHTML = '<div class="bd-media-frame">' + _bdVideoInnerHtml(it.id, c) + '</div>' +
      _bdCaptionHtml(c.caption) + _bdHandlesHtml(it);
  } else if (it.kind === 'draw') {
    el.style.height = it.h + 'px';
    const pts = c.points || [];
    el.innerHTML =
      '<svg width="100%" height="100%" viewBox="0 0 ' + Math.max(1, it.w) + ' ' + Math.max(1, it.h) + '" style="overflow:visible;display:block">' +
      '<path d="' + _bdPathD(pts) + '" fill="none" stroke="' + (BD_PEN_COLORS[c.color] || BD_PEN_COLORS.ink) + '" stroke-width="' + _bdNum(c.width, 3, 1, 40) + '" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      _bdHandlesHtml(it);
  }
  return el;
}

function _bdHandlesHtml(it) {
  if (state._bdReadOnly) return '';
  let extras = '';
  if (it.kind === 'video' && it.content && it.content.url) {
    extras += '<button class="bd-item-btn bd-open-link" title="Open link"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg></button>';
  }
  return '<div class="bd-item-actions">' + extras +
    '<button class="bd-item-btn bd-item-delete" title="Delete">' + SKETCHY_ICONS.trash + '</button></div>' +
    '<div class="bd-resize" title="Resize"></div>';
}

function _bdCaptionHtml(caption) {
  return '<div class="bd-caption' + (caption ? '' : ' empty') + '" spellcheck="false" data-placeholder="add label">' + _escHtml(caption || '') + '</div>';
}

function _bdVideoInnerHtml(itemId, c) {
  if (c.provider === 'youtube' && _bdValidVid(c)) {
    return '<div class="bd-video-thumb" data-item="' + _esc(itemId) + '"><img src="https://i.ytimg.com/vi/' + _esc(c.vid) + '/hqdefault.jpg" draggable="false" alt=""><div class="bd-play">▶</div></div>';
  }
  if (c.provider === 'vimeo' && _bdValidVid(c)) {
    return '<div class="bd-video-thumb bd-video-dark" data-item="' + _esc(itemId) + '"><div class="bd-play">▶</div><span class="bd-video-domain">vimeo</span></div>';
  }
  let domain = '';
  try { domain = new URL(c.url).hostname.replace('www.', ''); } catch (e) { domain = c.url; }
  return '<div class="bd-link-card"><span class="bd-link-icon">' + SKETCHY_ICONS.link + '</span><span class="bd-link-domain">' + _escHtml(domain) + '</span></div>';
}

function _bdRefreshItem(id) {
  const it = state._bdItems.find(i => i.id === id);
  const old = document.querySelector('.bd-item[data-id="' + id + '"]');
  if (!it || !old) return;
  old.replaceWith(_bdItemEl(it));
}

function _bdPathD(pts) {
  pts = Array.isArray(pts) ? pts.map(function(p) { return [Number(p && p[0]), Number(p && p[1])]; })
    .filter(function(p) { return isFinite(p[0]) && isFinite(p[1]); }) : [];
  if (pts.length < 2) return '';
  if (pts.length < 3) return 'M' + pts[0][0] + ' ' + pts[0][1] + ' L' + pts[1][0] + ' ' + pts[1][1];
  let d = 'M' + pts[0][0] + ' ' + pts[0][1];
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ' Q' + pts[i][0] + ' ' + pts[i][1] + ' ' + mx + ' ' + my;
  }
  const l = pts[pts.length - 1];
  return d + ' L' + l[0] + ' ' + l[1];
}

/* ---- RICH TEXT ---- */

// Render stored text: rich items carry sanitized HTML, legacy items plain text
function _bdTextHtml(c) {
  return c.rich ? _bdSanitizeHtml(c.text || '') : _escHtml(c.text || '');
}

// Allowlist sanitizer for contenteditable output: keeps b/u/mark and line
// breaks, unwraps everything else, escapes all text. Highlight spans from
// execCommand become <mark>. Runs on both save and render (defense in depth).
function _bdSanitizeHtml(html) {
  const tmpl = document.createElement('template');
  tmpl.innerHTML = html || '';
  return _bdSerializeRich(tmpl.content).replace(/(<br>)+$/, '');
}

function _bdSerializeRich(node) {
  let out = '';
  node.childNodes.forEach(function(n) {
    if (n.nodeType === 3) { out += _escHtml(n.nodeValue); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|SVG)$/.test(tag)) return;
    if (tag === 'BR') { out += '<br>'; return; }
    const inner = _bdSerializeRich(n);
    if (tag === 'B' || tag === 'STRONG') out += '<b>' + inner + '</b>';
    else if (tag === 'U') out += '<u>' + inner + '</u>';
    else if (tag === 'MARK') out += '<mark>' + inner + '</mark>';
    else if (tag === 'SPAN' || tag === 'FONT') {
      const bg = (n.style && n.style.backgroundColor) || '';
      out += (bg && bg !== 'transparent') ? '<mark>' + inner + '</mark>' : inner;
    }
    else if (tag === 'DIV' || tag === 'P') {
      if (out && !out.endsWith('<br>')) out += '<br>';
      out += inner + '<br>';
    }
    else out += inner;
  });
  return out;
}

/* ---- FORMAT BAR ---- */

function _bdShowFormatBar(el) {
  state._bdEditingEl = el;
  const bar = document.getElementById('bdFormatBar');
  if (!bar) return;
  const itemEl = el.closest('.bd-item');
  const it = itemEl && state._bdItems.find(i => i.id === itemEl.dataset.id);
  const size = (it && BD_TEXT_SIZES.indexOf(it.content.size) >= 0) ? it.content.size : 'body';
  bar.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('active', b.dataset.size === size));
  bar.style.display = 'flex';
  _bdPositionFormatBar();
}

function _bdHideFormatBar() {
  state._bdEditingEl = null;
  const bar = document.getElementById('bdFormatBar');
  if (bar) bar.style.display = 'none';
}

function _bdPositionFormatBar() {
  if (!state._bdEditingEl) return;
  const bar = document.getElementById('bdFormatBar');
  const vp = document.getElementById('bdViewport');
  const itemEl = state._bdEditingEl.closest('.bd-item');
  if (!bar || !vp || !itemEl) return;
  if (window.innerWidth < 640) {
    // Phone: the item is often under the keyboard; pin the bar to the top
    bar.style.left = '8px'; bar.style.right = '8px'; bar.style.top = '8px';
    return;
  }
  bar.style.right = '';
  const vpRect = vp.getBoundingClientRect();
  const r = itemEl.getBoundingClientRect();
  const x = Math.max(8, Math.min(r.left - vpRect.left, vpRect.width - 260));
  const y = Math.max(8, r.top - vpRect.top - 44);
  bar.style.left = x + 'px';
  bar.style.top = y + 'px';
}

/* ---- UNDO / REDO ---- */
/* Ops: {type:'create', item} | {type:'delete', item} | {type:'update', id, before, after}
   where before/after hold the changed columns (geometry and/or content). */

function _bdClone(v) { return JSON.parse(JSON.stringify(v)); }

function _bdPushUndo(op) {
  state._bdUndoStack.push(op);
  if (state._bdUndoStack.length > 100) state._bdUndoStack.shift();
  state._bdRedoStack.length = 0;
  _bdSyncUndoButtons();
}

function _bdSyncUndoButtons() {
  const u = document.getElementById('bdUndoBtn'), r = document.getElementById('bdRedoBtn');
  if (u) u.disabled = !state._bdUndoStack.length;
  if (r) r.disabled = !state._bdRedoStack.length;
}

async function _bdApplyOp(op, reverse) {
  if (op.type === 'create') {
    if (reverse) await _bdRemoveItemLocal(op.item.id);
    else await _bdRestoreItem(op.item);
  } else if (op.type === 'delete') {
    if (reverse) await _bdRestoreItem(op.item);
    else await _bdRemoveItemLocal(op.item.id);
  } else if (op.type === 'update') {
    const vals = _bdClone(reverse ? op.before : op.after);
    const it = state._bdItems.find(i => i.id === op.id);
    if (!it) return;
    Object.assign(it, vals);
    _bdRefreshItem(op.id);
    _bdQueueItemSave(op.id, vals);
  }
}

async function _bdUndo() {
  const op = state._bdUndoStack.pop();
  if (!op) return;
  await _bdApplyOp(op, true);
  state._bdRedoStack.push(op);
  _bdSyncUndoButtons();
}

async function _bdRedo() {
  const op = state._bdRedoStack.pop();
  if (!op) return;
  await _bdApplyOp(op, false);
  state._bdUndoStack.push(op);
  _bdSyncUndoButtons();
}

// Re-insert a deleted/undone item with its original id. Routes through
// sbAddBoardItem so shared-edit sessions restore via the RPC (p_id).
async function _bdRestoreItem(item) {
  if (!state._sb) return;
  const row = _bdClone(item);
  const restored = await db.sbAddBoardItem({
    id: row.id, board_id: row.board_id, kind: row.kind,
    x: row.x, y: row.y, w: row.w, h: row.h, z: row.z, content: row.content
  });
  if (!restored) { _showSaveError('Undo failed'); return; }
  state._bdItems.push(restored);
  _bdLiveSend({ board: state._bdBoard && state._bdBoard.id, type: 'upsert', item: restored });
  if ((restored.z || 1) > state._bdMaxZ) state._bdMaxZ = restored.z;
  const plane = document.getElementById('bdPlane');
  if (plane) plane.appendChild(_bdItemEl(restored));
  if (row.kind === 'image' && row.content && row.content.path) {
    state._bdOrphanPaths = state._bdOrphanPaths.filter(p => p !== row.content.path);
  }
}

// Remove from state/DOM/DB without touching the undo stack. Image files are
// NOT deleted yet (undo needs them) — they go to the orphan list, purged
// when the board is exited.
async function _bdRemoveItemLocal(id) {
  const it = state._bdItems.find(i => i.id === id);
  if (!it) return;
  state._bdItems = state._bdItems.filter(i => i.id !== id);
  const el = document.querySelector('.bd-item[data-id="' + id + '"]');
  if (el) el.remove();
  if (state._bdSelectedId === id) state._bdSelectedId = null;
  await db.sbDeleteBoardItem(id);
  _bdLiveSend({ board: state._bdBoard && state._bdBoard.id, type: 'delete', id: id });
  if (it.kind === 'image' && it.content && it.content.path) state._bdOrphanPaths.push(it.content.path);
}

function _bdFlushOrphans() {
  if (!state._bdOrphanPaths.length || !state._sb) return;
  const paths = state._bdOrphanPaths.splice(0);
  state._sb.storage.from('board-media').remove(paths).catch(function(e) { console.warn('Orphan cleanup failed', e); });
}

/* ---- SHARING ---- */

function _bdShareLink() {
  return location.origin + location.pathname + '#bshared/' + state._bdBoard.share_token;
}

function _bdSyncSharePopover() {
  const pop = document.getElementById('bdSharePopover');
  if (!pop || !state._bdBoard) return;
  const mode = (state._bdBoard.share_mode === 'view' || state._bdBoard.share_mode === 'edit') ? state._bdBoard.share_mode : 'none';
  pop.querySelectorAll('.bd-share-opt').forEach(b => b.classList.toggle('active', b.dataset.share === mode));
  const links = document.getElementById('bdShareLinks');
  if (links) links.innerHTML = mode === 'none' ? '' : _shareLinkRowsHtml(mode, _bdShareLink(), _bdShareLink() + '/edit');
  const label = document.getElementById('bdShareBtnLabel');
  if (label) label.textContent = mode === 'none' ? 'Share' : 'Shared';
}

async function _bdSetBoardShare(mode) {
  if (mode !== 'none' && !state._bdBoard.share_token) {
    _showSaveError('Sharing needs migration 017 — run it in Supabase first');
    return;
  }
  const ok = await db.sbUpdateBoard(state._bdBoard.id, { share_mode: mode }, true);
  if (!ok) return;
  state._bdBoard.share_mode = mode;
  _bdSyncSharePopover();
  if (mode === 'none') _bdLiveLeave(); else _bdLiveJoin(state._bdBoard.id);
}

/* ---- EDITOR: SIGNED URLS ---- */

// One image URL, right for the session: owners mint signed URLs; shared
// sessions (view or edit) download the blob under the shared-board
// storage policy and use an object URL.
async function _bdUrlForPath(path) {
  if (!state._sb) return null;
  if (state._bdSharedToken || state._bdReadOnly) {
    const res = await state._sb.storage.from('board-media').download(path);
    return res.data ? URL.createObjectURL(res.data) : null;
  }
  const res = await state._sb.storage.from('board-media').createSignedUrl(path, 60 * 60 * 12);
  return (res.data && res.data.signedUrl) || null;
}

async function _bdResolveSignedUrls() {
  const paths = state._bdItems.filter(i => i.kind === 'image' && i.content && i.content.path && !state._bdSignedUrls[i.content.path])
    .map(i => i.content.path);
  if (!paths.length || !state._sb) return;
  if (state._bdSharedToken || state._bdReadOnly) {
    await Promise.all(paths.map(async function(p) {
      const url = await _bdUrlForPath(p);
      if (url) state._bdSignedUrls[p] = url;
    }));
  } else {
    const res = await state._sb.storage.from('board-media').createSignedUrls(paths, 60 * 60 * 12);
    if (res.error || !res.data) { console.error('Signed URL batch failed', res.error); return; }
    res.data.forEach(function(entry, idx) {
      if (entry.signedUrl) state._bdSignedUrls[paths[idx]] = entry.signedUrl;
    });
  }
  state._bdItems.forEach(function(it) {
    if (it.kind === 'image' && it.content && state._bdSignedUrls[it.content.path]) _bdRefreshItem(it.id);
  });
}

/* ---- EDITOR: SAVE PLUMBING ---- */

function _bdSetSaveState(mode) {
  const el = document.getElementById('bdSaveState');
  if (!el) return;
  el.textContent = mode === 'saving' ? 'Saving…' : (mode === 'saved' ? 'Saved' : '');
  if (state === 'saved') {
    clearTimeout(el._t);
    el._t = setTimeout(function() { if (el.textContent === 'Saved') el.textContent = ''; }, 1600);
  }
}

function _bdQueueItemSave(id, updates, isRetry) {
  const pending = state._bdPendingSaves[id] || { updates: {} };
  Object.assign(pending.updates, updates);
  if (isRetry) pending.retried = true;
  clearTimeout(pending.timer);
  pending.timer = setTimeout(async function() {
    delete state._bdPendingSaves[id];
    _bdSetSaveState('saving');
    const ok = await db.sbUpdateBoardItem(id, pending.updates);
    if (ok) {
      _bdSetSaveState('saved');
      const it = state._bdItems.find(i => i.id === id);
      if (it) _bdLiveSend({ board: state._bdBoard && state._bdBoard.id, type: 'upsert', item: it });
      return;
    }
    // One retry after a pause (flaky mobile networks); the toast already fired
    if (!pending.retried) setTimeout(function() { _bdQueueItemSave(id, pending.updates, true); }, 3000);
  }, 500);
  state._bdPendingSaves[id] = pending;
}

// Fire every debounced save now: navigation, tab hidden, page unload.
function _bdFlushPendingSaves() {
  Object.keys(state._bdPendingSaves).forEach(function(id) {
    const pending = state._bdPendingSaves[id];
    clearTimeout(pending.timer);
    delete state._bdPendingSaves[id];
    db.sbUpdateBoardItem(id, pending.updates);
  });
  if (state._bdViewSaveTimer) {
    clearTimeout(state._bdViewSaveTimer); state._bdViewSaveTimer = null;
    if (state._bdBoard && !state._bdSharedToken && (state._bdBoard.view_x !== state._bdView.x || state._bdBoard.view_y !== state._bdView.y || state._bdBoard.view_zoom !== state._bdView.z)) {
      state._bdBoard.view_x = state._bdView.x; state._bdBoard.view_y = state._bdView.y; state._bdBoard.view_zoom = state._bdView.z;
      db.sbUpdateBoard(state._bdBoard.id, { view_x: state._bdView.x, view_y: state._bdView.y, view_zoom: state._bdView.z }, true);
    }
  }
}

/* ---- EDITOR: ITEM CREATION ---- */

async function _bdCreateItem(kind, x, y, w, h, content) {
  const row = await db.sbAddBoardItem({
    board_id: state._bdBoard.id, kind: kind,
    x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h),
    z: ++state._bdMaxZ, content: content
  });
  if (!row) return null;
  state._bdItems.push(row);
  document.getElementById('bdPlane').appendChild(_bdItemEl(row));
  _bdPushUndo({ type: 'create', item: _bdClone(row) });
  _bdLiveSend({ board: state._bdBoard.id, type: 'upsert', item: row });
  return row;
}

async function _bdAddNoteAt(bx, by) {
  const row = await _bdCreateItem('note', bx - 90, by - 90, 180, 180, { text: '', color: state._bdStickyColor });
  _bdSetTool('select');
  if (row) { _bdSelect(row.id); _bdStartTextEdit(row.id); }
}

async function _bdAddTextAt(bx, by) {
  const row = await _bdCreateItem('text', bx, by - 14, 260, 40, { text: '', size: 'body' });
  _bdSetTool('select');
  if (row) { _bdSelect(row.id); _bdStartTextEdit(row.id); }
}

async function _bdAddImageFiles(files, bx, by) {
  let offset = 0;
  for (const file of files) {
    if (!file.type || file.type.indexOf('image/') !== 0) { _showSaveError('Not an image: ' + file.name); continue; }
    _bdSetSaveState('saving');
    try {
      const prepped = await _bdPrepareImage(file);
      const ownerId = state._bdSharedOwnerId || state.CREATOR._sbId;
      const path = ownerId + '/' + state._bdBoard.id + '/' + crypto.randomUUID() + '.' + prepped.ext;
      const up = await state._sb.storage.from('board-media').upload(path, prepped.blob, { contentType: prepped.type });
      if (up.error) { _showSaveError('Upload failed: ' + (up.error.message || 'unknown error')); console.error(up.error); continue; }
      const url = await _bdUrlForPath(path);
      if (url) state._bdSignedUrls[path] = url;
      const w = 320, h = Math.round(w * (prepped.natH / prepped.natW));
      await _bdCreateItem('image', bx - w / 2 + offset, by - h / 2 + offset, w, h,
        { path: path, caption: '', natW: prepped.natW, natH: prepped.natH });
      offset += 28;
      _bdSetSaveState('saved');
    } catch (e) {
      console.error(e);
      _showSaveError('Could not process image');
    }
  }
}

// Downscale + re-encode before upload: storage is a per-user cost.
// Max 2400px on the long edge, WebP q0.85 (JPEG fallback). GIFs pass
// through untouched to keep animation. Bucket enforces the 10MB cap.
function _bdPrepareImage(file) {
  return new Promise(function(resolve, reject) {
    if (file.type === 'image/gif') {
      if (file.size > 10 * 1024 * 1024) return reject(new Error('GIF over 10MB'));
      const img0 = new Image();
      const u0 = URL.createObjectURL(file);
      img0.onload = function() { URL.revokeObjectURL(u0); resolve({ blob: file, ext: 'gif', type: 'image/gif', natW: img0.naturalWidth, natH: img0.naturalHeight }); };
      img0.onerror = function() { URL.revokeObjectURL(u0); reject(new Error('Bad GIF')); };
      img0.src = u0;
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function() {
      URL.revokeObjectURL(url);
      const natW = img.naturalWidth, natH = img.naturalHeight;
      const scale = Math.min(1, 2400 / Math.max(natW, natH));
      const cw = Math.round(natW * scale), ch = Math.round(natH * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(function(blob) {
        // Browsers without WebP encode fall back to PNG — trust blob.type
        const outType = (blob && blob.type) || 'image/png';
        const outExt = outType === 'image/webp' ? 'webp' : (outType.split('/')[1] || 'png').replace('jpeg', 'jpg');
        if (blob && blob.size < file.size) return resolve({ blob: blob, ext: outExt, type: outType, natW: cw, natH: ch });
        // Re-encode didn't help (or failed) — use the original if it fits
        if (file.size <= 10 * 1024 * 1024 && scale === 1) {
          const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
          return resolve({ blob: file, ext: ext, type: file.type, natW: natW, natH: natH });
        }
        if (blob) return resolve({ blob: blob, ext: outExt, type: outType, natW: cw, natH: ch });
        reject(new Error('Could not encode image'));
      }, 'image/webp', 0.85);
    };
    img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

function _bdParseVideoUrl(url) {
  if (!_bdSafeUrl(url)) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { url: url, provider: 'youtube', vid: yt[1], caption: '' };
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return { url: url, provider: 'vimeo', vid: vm[1], caption: '' };
  return { url: url, provider: 'link', vid: null, caption: '' };
}

async function _bdAddVideoAt(url, bx, by) {
  const content = _bdParseVideoUrl(String(url || '').trim());
  if (!content) { _showSaveError('Paste a link that starts with http:// or https://'); return; }
  const w = content.provider === 'link' ? 260 : 340;
  const h = content.provider === 'link' ? 64 : Math.round(340 * 9 / 16);
  const row = await _bdCreateItem('video', bx - w / 2, by - h / 2, w, h, content);
  if (row) _bdSelect(row.id);
}

async function _bdAddVideoFromPopover() {
  const input = document.getElementById('bdVideoUrl');
  const url = (input.value || '').trim();
  if (!url) return;
  document.getElementById('bdVideoPopover').style.display = 'none';
  input.value = '';
  const vp = document.getElementById('bdViewport').getBoundingClientRect();
  const center = _bdScreenToBoard(vp.left + vp.width / 2, vp.top + vp.height / 2);
  await _bdAddVideoAt(url, center.x, center.y);
}

/* ---- EDITOR: SELECTION & EDITING ---- */

function _bdSelect(id) {
  if (state._bdSelectedId === id) return;
  const prev = document.querySelector('.bd-item.selected');
  if (prev) prev.classList.remove('selected');
  state._bdSelectedId = id;
  if (id) {
    const el = document.querySelector('.bd-item[data-id="' + id + '"]');
    if (el) el.classList.add('selected');
  }
}

function _bdStartTextEdit(id) {
  const el = document.querySelector('.bd-item[data-id="' + id + '"] .bd-text-content');
  if (!el) return;
  el.setAttribute('contenteditable', 'true');
  el.focus();
  // Cursor to end
  const range = document.createRange();
  range.selectNodeContents(el); range.collapse(false);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
}

function _bdCommitTextEdit(target) {
  const itemEl = target.closest('.bd-item');
  if (!itemEl) return;
  target.setAttribute('contenteditable', 'false');
  const id = itemEl.dataset.id;
  const it = state._bdItems.find(i => i.id === id);
  if (!it) return;
  const plain = target.innerText.replace(/\u00a0/g, ' ').trim();
  if (target.classList.contains('bd-caption')) {
    // Captions stay plain text
    const text = target.innerText.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trimEnd();
    if ((it.content.caption || '') !== text) {
      const before = _bdClone(it.content);
      it.content = Object.assign({}, it.content, { caption: text });
      _bdPushUndo({ type: 'update', id: id, before: { content: before }, after: { content: _bdClone(it.content) } });
      _bdQueueItemSave(id, { content: it.content });
    }
    target.classList.toggle('empty', !text);
  } else {
    // Empty text block left empty: remove it (one clean undo step)
    if (!plain && it.kind === 'text') { _bdDeleteItem(id); return; }
    const html = _bdSanitizeHtml(target.innerHTML);
    if ((it.content.text || '') !== html || !it.content.rich) {
      const before = _bdClone(it.content);
      it.content = Object.assign({}, it.content, { text: html, rich: true });
      _bdPushUndo({ type: 'update', id: id, before: { content: before }, after: { content: _bdClone(it.content) } });
      _bdQueueItemSave(id, { content: it.content });
    }
    // Re-render through the sanitizer so what stays on screen = what was saved
    _bdRefreshItem(id);
  }
}


async function _bdDeleteItem(id) {
  const it = state._bdItems.find(i => i.id === id);
  if (!it) return;
  _bdPushUndo({ type: 'delete', item: _bdClone(it) });
  await _bdRemoveItemLocal(id);
}

function _bdSetTool(tool) {
  state._bdTool = tool;
  document.querySelectorAll('#bdToolbar .bd-tool[data-tool]').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  const penOpts = document.getElementById('bdPenOptions');
  const stickyOpts = document.getElementById('bdStickyOptions');
  if (penOpts) penOpts.style.display = tool === 'pen' ? 'flex' : 'none';
  if (stickyOpts) stickyOpts.style.display = tool === 'note' ? 'flex' : 'none';
  const vp = document.getElementById('bdViewport');
  if (vp) vp.dataset.tool = tool;
}

/* ---- EDITOR: EVENT WIRING ---- */

function _bdBindEditor() {
  const vp = document.getElementById('bdViewport');
  const toolbar = document.getElementById('bdToolbar');
  _bdSetTool(state._bdTool); // sync data-tool + toolbar state on fresh DOM
  _bdSyncUndoButtons();

  /* Two fingers: a pen stroke in progress is discarded, a drag/resize is
     committed where it is, a pan just stops. */
  _bdBindPinch(vp, function() {
    if (state._bdPtr && state._bdPtr.mode === 'pen') {
      state._bdPtr = null; state._bdPenPts = null;
      const live = document.getElementById('bdPenLive');
      if (live) live.innerHTML = '';
    } else if (state._bdPtr) {
      endGesture();
    }
  });

  /* Toolbar */
  toolbar.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.tool) { _bdSetTool(btn.dataset.tool); return; }
    if (btn.dataset.cmd === 'undo') { _bdUndo(); return; }
    if (btn.dataset.cmd === 'redo') { _bdRedo(); return; }
    if (btn.dataset.cmd === 'image') { document.getElementById('bdFileInput').click(); return; }
    if (btn.dataset.cmd === 'video') {
      const pop = document.getElementById('bdVideoPopover');
      pop.style.display = pop.style.display === 'none' ? 'flex' : 'none';
      if (pop.style.display === 'flex') document.getElementById('bdVideoUrl').focus();
    }
  });
  document.getElementById('bdVideoUrl').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); _bdAddVideoFromPopover(); }
    if (e.key === 'Escape') { document.getElementById('bdVideoPopover').style.display = 'none'; }
    e.stopPropagation();
  });

  /* Tool option strips */
  ['bdPenOptions', 'bdStickyOptions'].forEach(function(id) {
    document.getElementById(id).addEventListener('click', function(e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.penColor) {
        state._bdPenColor = btn.dataset.penColor;
        btn.parentElement.querySelectorAll('.bd-dot').forEach(d => d.classList.toggle('active', d === btn));
      }
      if (btn.dataset.penWidth) {
        state._bdPenWidth = Number(btn.dataset.penWidth);
        btn.parentElement.querySelectorAll('.bd-width').forEach(d => d.classList.toggle('active', d === btn));
      }
      if (btn.dataset.stickyColor) {
        state._bdStickyColor = btn.dataset.stickyColor;
        btn.parentElement.querySelectorAll('.bd-dot').forEach(d => d.classList.toggle('active', d === btn));
        // Recolor the selected sticky too, if one is selected
        const it = state._bdItems.find(i => i.id === state._bdSelectedId && i.kind === 'note');
        if (it) {
          const before = _bdClone(it.content);
          it.content = Object.assign({}, it.content, { color: state._bdStickyColor });
          _bdPushUndo({ type: 'update', id: it.id, before: { content: before }, after: { content: _bdClone(it.content) } });
          _bdRefreshItem(it.id);
          _bdQueueItemSave(it.id, { content: it.content });
        }
      }
    });
  });

  /* File input */
  document.getElementById('bdFileInput').addEventListener('change', async function(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const rect = vp.getBoundingClientRect();
    const center = _bdScreenToBoard(rect.left + rect.width / 2, rect.top + rect.height / 2);
    await _bdAddImageFiles(files, center.x, center.y);
  });

  /* Board title — renaming is owner-only */
  if (!state._bdSharedToken) {
    const titleEl = document.getElementById('bdTitle');
    titleEl.addEventListener('click', function() {
      if (titleEl.getAttribute('contenteditable') !== 'true') {
        titleEl.setAttribute('contenteditable', 'true');
        titleEl.focus();
      }
    });
    titleEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
      e.stopPropagation();
    });
    titleEl.addEventListener('blur', function() {
      titleEl.setAttribute('contenteditable', 'false');
      const t = titleEl.textContent.trim() || 'Untitled Board';
      titleEl.textContent = t;
      if (state._bdBoard && t !== state._bdBoard.title) {
        state._bdBoard.title = t;
        db.sbUpdateBoard(state._bdBoard.id, { title: t }, true);
      }
    });
  }

  /* Wheel: pan by default, zoom with ctrl/cmd (covers trackpad pinch) */
  vp.addEventListener('wheel', function(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      _bdZoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
    } else {
      state._bdView.x -= e.deltaX;
      state._bdView.y -= e.deltaY;
      _bdApplyView();
    }
  }, { passive: false });

  /* Pointer gestures */
  vp.addEventListener('pointerdown', function(e) {
    const sharePop = document.getElementById('bdSharePopover');
    if (sharePop) sharePop.style.display = 'none';
    if (e.target.closest('.board-toolbar, .bd-tool-options, .bd-video-popover, .bd-format-bar, .bd-zoom')) return;
    if (e.target.isContentEditable) return; // typing, leave it alone
    const itemEl = e.target.closest('.bd-item');

    // Item action buttons act on pointerdown's click, not as gestures
    if (e.target.closest('.bd-item-btn')) return;

    if (e.button === 1 || (state._bdTool === 'select' && !itemEl)) {
      state._bdPtr = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: state._bdView.x, vy: state._bdView.y };
      if (state._bdTool === 'select' && !e.target.closest('.bd-item')) _bdSelect(null);
      _bdCapture(vp, e);
      return;
    }

    if (state._bdTool === 'pen') {
      const p = _bdScreenToBoard(e.clientX, e.clientY);
      state._bdPenPts = [[p.x, p.y]];
      state._bdPtr = { mode: 'pen' };
      const live = document.getElementById('bdPenLive');
      live.innerHTML = '<path d="" fill="none" stroke="' + BD_PEN_COLORS[state._bdPenColor] + '" stroke-width="' + state._bdPenWidth + '" stroke-linecap="round" stroke-linejoin="round"/>';
      _bdCapture(vp, e);
      return;
    }

    if (state._bdTool === 'note' || state._bdTool === 'text') {
      const p = _bdScreenToBoard(e.clientX, e.clientY);
      if (state._bdTool === 'note') _bdAddNoteAt(p.x, p.y); else _bdAddTextAt(p.x, p.y);
      return;
    }

    if (itemEl) {
      const id = itemEl.dataset.id;
      const it = state._bdItems.find(i => i.id === id);
      if (!it) return;
      _bdSelect(id);
      // Bring to front
      if ((it.z || 1) < state._bdMaxZ) {
        it.z = ++state._bdMaxZ;
        itemEl.style.zIndex = it.z;
        _bdQueueItemSave(id, { z: it.z });
      }
      const p = _bdScreenToBoard(e.clientX, e.clientY);
      const before = { x: it.x, y: it.y, w: it.w, h: it.h };
      if (e.target.closest('.bd-resize')) {
        state._bdPtr = { mode: 'resize', id: id, sx: p.x, sy: p.y, w: it.w, h: it.h, before: before };
      } else {
        state._bdPtr = { mode: 'drag', id: id, dx: p.x - it.x, dy: p.y - it.y, moved: false, before: before };
      }
      _bdCapture(vp, e);
    }
  });

  vp.addEventListener('pointermove', function(e) {
    if (!state._bdPtr) return;
    if (state._bdPtr.mode === 'pan') {
      state._bdView.x = state._bdPtr.vx + (e.clientX - state._bdPtr.sx);
      state._bdView.y = state._bdPtr.vy + (e.clientY - state._bdPtr.sy);
      _bdApplyView();
      return;
    }
    const p = _bdScreenToBoard(e.clientX, e.clientY);
    if (state._bdPtr.mode === 'pen') {
      const last = state._bdPenPts[state._bdPenPts.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) > 2 / state._bdView.z) {
        state._bdPenPts.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
        const path = document.querySelector('#bdPenLive path');
        if (path) path.setAttribute('d', _bdPathD(state._bdPenPts));
      }
      return;
    }
    const it = state._bdItems.find(i => i.id === state._bdPtr.id);
    const el = document.querySelector('.bd-item[data-id="' + state._bdPtr.id + '"]');
    if (!it || !el) return;
    if (state._bdPtr.mode === 'drag') {
      it.x = p.x - state._bdPtr.dx;
      it.y = p.y - state._bdPtr.dy;
      el.style.left = it.x + 'px';
      el.style.top = it.y + 'px';
      state._bdPtr.moved = true;
    } else if (state._bdPtr.mode === 'resize') {
      const minW = it.kind === 'note' ? 100 : 60;
      let w = Math.max(minW, state._bdPtr.w + (p.x - state._bdPtr.sx));
      let h = Math.max(40, state._bdPtr.h + (p.y - state._bdPtr.sy));
      if (it.kind === 'image' && it.content.natW && it.content.natH) {
        h = w * (it.content.natH / it.content.natW); // images keep their aspect
      } else if (it.kind === 'video' && it.content.provider !== 'link') {
        h = w * 9 / 16;
      }
      it.w = w; it.h = h;
      el.style.width = w + 'px';
      if (it.kind !== 'text') el.style.height = h + 'px';
      state._bdPtr.moved = true;
    }
  });

  function endGesture(e) {
    if (!state._bdPtr) return;
    const g = state._bdPtr; state._bdPtr = null;
    if (g.mode === 'pen' && state._bdPenPts) {
      state._bdSuppressClick = true; // stroke ending over a video shouldn't play it
      const pts = state._bdPenPts; state._bdPenPts = null;
      document.getElementById('bdPenLive').innerHTML = '';
      if (pts.length > 1) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pts.forEach(pt => {
          minX = Math.min(minX, pt[0]); minY = Math.min(minY, pt[1]);
          maxX = Math.max(maxX, pt[0]); maxY = Math.max(maxY, pt[1]);
        });
        const rel = pts.map(pt => [Math.round((pt[0] - minX) * 10) / 10, Math.round((pt[1] - minY) * 10) / 10]);
        _bdCreateItem('draw', minX, minY, Math.max(2, maxX - minX), Math.max(2, maxY - minY),
          { points: rel, color: state._bdPenColor, width: state._bdPenWidth });
      }
      return;
    }
    if ((g.mode === 'drag' || g.mode === 'resize') && g.moved) {
      state._bdSuppressClick = true; // the click after a drag shouldn't trigger video play etc.
      const it = state._bdItems.find(i => i.id === g.id);
      if (it) {
        const after = { x: Math.round(it.x), y: Math.round(it.y), w: Math.round(it.w), h: Math.round(it.h) };
        if (g.before) _bdPushUndo({ type: 'update', id: g.id, before: g.before, after: after });
        _bdQueueItemSave(g.id, after);
      }
    }
  }
  vp.addEventListener('pointerup', endGesture);
  vp.addEventListener('pointercancel', endGesture);

  /* Double-click: edit text / captions */
  vp.addEventListener('dblclick', function(e) {
    const textEl = e.target.closest('.bd-text-content, .bd-caption');
    if (textEl) {
      textEl.setAttribute('contenteditable', 'true');
      textEl.focus();
      return;
    }
    // Double-click on empty canvas = quick sticky (Milanote habit)
    if (!e.target.closest('.bd-item') && state._bdTool === 'select') {
      const p = _bdScreenToBoard(e.clientX, e.clientY);
      _bdAddNoteAt(p.x, p.y);
    }
  });

  /* Focus in/out: format bar follows text editing; blur commits */
  vp.addEventListener('focusin', function(e) {
    if (e.target.classList && e.target.classList.contains('bd-text-content') && e.target.isContentEditable) {
      _bdShowFormatBar(e.target);
    }
  });
  vp.addEventListener('focusout', function(e) {
    if (e.target.classList && (e.target.classList.contains('bd-text-content') || e.target.classList.contains('bd-caption'))) {
      if (e.target === state._bdEditingEl) _bdHideFormatBar();
      _bdCommitTextEdit(e.target);
    }
  });

  /* Format bar: mousedown is swallowed so the text selection survives */
  const fmtBar = document.getElementById('bdFormatBar');
  fmtBar.addEventListener('mousedown', function(e) { e.preventDefault(); });
  fmtBar.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!btn || !state._bdEditingEl) return;
    if (btn.dataset.fmt === 'bold') document.execCommand('bold');
    else if (btn.dataset.fmt === 'underline') document.execCommand('underline');
    else if (btn.dataset.fmt === 'hilite') {
      document.execCommand('styleWithCSS', false, true);
      const cur = document.queryCommandValue('hiliteColor');
      document.execCommand('hiliteColor', false, cur === BD_HILITE_RGB ? 'transparent' : BD_HILITE);
      document.execCommand('styleWithCSS', false, false);
    } else if (btn.dataset.size) {
      const itemEl = state._bdEditingEl.closest('.bd-item');
      const it = itemEl && state._bdItems.find(i => i.id === itemEl.dataset.id);
      if (!it) return;
      const before = _bdClone(it.content);
      it.content = Object.assign({}, it.content, { size: btn.dataset.size });
      BD_TEXT_SIZES.forEach(s => state._bdEditingEl.classList.remove('bd-ts-' + s));
      state._bdEditingEl.classList.add('bd-ts-' + btn.dataset.size);
      fmtBar.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('active', b === btn));
      _bdPushUndo({ type: 'update', id: it.id, before: { content: before }, after: { content: _bdClone(it.content) } });
      _bdQueueItemSave(it.id, { content: it.content });
      _bdPositionFormatBar();
    }
  });

  /* Share popover — owner sessions only (shared shell has no share UI).
     Copy buttons are handled by the global .bd-share-copy listener. */
  const shareBtn = document.getElementById('bdShareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function() {
      const pop = document.getElementById('bdSharePopover');
      _bdSyncSharePopover();
      pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('bdSharePopover').addEventListener('click', function(e) {
      const opt = e.target.closest('.bd-share-opt');
      if (opt) _bdSetBoardShare(opt.dataset.share);
    });
  }

  /* Item action buttons + video play (click, since pointerdown skips them) */
  vp.addEventListener('click', function(e) {
    if (state._bdSuppressClick) { state._bdSuppressClick = false; return; }
    const del = e.target.closest('.bd-item-delete');
    if (del) {
      const id = del.closest('.bd-item').dataset.id;
      _bdDeleteItem(id);
      return;
    }
    const openLink = e.target.closest('.bd-open-link');
    if (openLink) {
      const id = openLink.closest('.bd-item').dataset.id;
      const it = state._bdItems.find(i => i.id === id);
      if (it && _bdSafeUrl(it.content.url)) window.open(it.content.url, '_blank', 'noopener');
      return;
    }
    const thumb = e.target.closest('.bd-video-thumb');
    if (thumb) {
      const id = thumb.dataset.item;
      const it = state._bdItems.find(i => i.id === id);
      if (!it) return;
      const src = _bdEmbedSrc(it.content);
      if (!src) return;
      thumb.outerHTML = '<iframe src="' + _esc(src) + '" frameborder="0" allow="autoplay; fullscreen" allowfullscreen style="width:100%;height:100%;display:block"></iframe>';
    }
    const linkCard = e.target.closest('.bd-link-card');
    if (linkCard && state._bdTool === 'select') {
      // Single click selects (handled on pointerdown); open via the ↗ button
    }
  });

  /* Drag & drop image files */
  vp.addEventListener('dragover', function(e) {
    e.preventDefault();
    document.getElementById('bdDropHint').classList.add('show');
  });
  vp.addEventListener('dragleave', function(e) {
    if (e.target === vp) document.getElementById('bdDropHint').classList.remove('show');
  });
  vp.addEventListener('drop', async function(e) {
    e.preventDefault();
    document.getElementById('bdDropHint').classList.remove('show');
    const p = _bdScreenToBoard(e.clientX, e.clientY);
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.indexOf('image/') === 0);
    if (files.length) { await _bdAddImageFiles(files, p.x, p.y); return; }
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && /^https?:\/\//.test(url.trim())) await _bdAddVideoAt(url, p.x, p.y);
  });

  /* Document-level: keyboard + paste (bound once, guarded by view visibility) */
  if (!state._bdListenersBound) {
    state._bdListenersBound = true;
    document.addEventListener('keydown', function(e) {
      if (!_bdEditorActive()) return;
      if (e.target.isContentEditable || /INPUT|TEXTAREA/.test(e.target.tagName)) {
        if (e.key === 'Escape') e.target.blur();
        return; // native text-editing undo applies while typing
      }
      if (state._bdReadOnly) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) _bdRedo(); else _bdUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        _bdRedo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && state._bdSelectedId) {
        e.preventDefault();
        _bdDeleteItem(state._bdSelectedId);
      } else if (e.key === 'Escape') {
        if (state._bdTool !== 'select') _bdSetTool('select');
        else _bdSelect(null);
        const pop = document.getElementById('bdVideoPopover');
        if (pop) pop.style.display = 'none';
        const sharePop = document.getElementById('bdSharePopover');
        if (sharePop) sharePop.style.display = 'none';
      }
    });
    window.addEventListener('beforeunload', function() { _bdFlushPendingSaves(); _bdFlushOrphans(); });
    document.addEventListener('paste', async function(e) {
      if (!_bdEditorActive() || state._bdReadOnly) return;
      if (e.target.isContentEditable || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const vpEl = document.getElementById('bdViewport');
      if (!vpEl) return;
      const rect = vpEl.getBoundingClientRect();
      const center = _bdScreenToBoard(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const files = Array.from(e.clipboardData.files || []).filter(f => f.type.indexOf('image/') === 0);
      if (files.length) { e.preventDefault(); await _bdAddImageFiles(files, center.x, center.y); return; }
      const text = e.clipboardData.getData('text/plain').trim();
      if (/^https?:\/\/\S+$/.test(text)) { e.preventDefault(); await _bdAddVideoAt(text, center.x, center.y); }
      else if (text) { e.preventDefault(); await _bdCreateItem('text', center.x - 130, center.y - 14, 260, 40, { text: text, size: 'body' }); }
    });
  }
}

/* ---- SHARED VIEW (#bshared/TOKEN) ---- */
/* Read-only board for anyone with the link — no account needed. Data comes
   through the token-gated SECURITY DEFINER RPCs (migration 017); images are
   downloaded with the anon key under the shared-board storage policy. */

async function renderSharedBoard(token, mode) {
  _bdFlushPendingSaves();
  const loadToken = ++state._bdLoadToken;
  const cleanToken = String(token).split('?')[0].split('&')[0].trim();
  state._bdReadOnly = true;
  state._bdBoard = null;
  state._bdSharedToken = null;
  state._bdSharedOwnerId = null;
  state._bdSelectedId = null;
  state._bdSignedUrls = {};
  state._bdPtr = null;
  state._bdUndoStack = []; state._bdRedoStack = [];
  state._bdEditingEl = null;
  const container = document.getElementById('view-board-editor');
  container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:400px;border-radius:12px"></div></div>';

  let board = null, items = [];
  if (state._sb) {
    const bRes = await state._sb.rpc('get_shared_board', { p_token: cleanToken });
    board = bRes.data && bRes.data[0];
    if (board) {
      const iRes = await state._sb.rpc('get_shared_board_items', { p_token: cleanToken });
      items = iRes.data || [];
    }
  }
  if (loadToken !== state._bdLoadToken) return;
  if (!board) {
    container.innerHTML =
      '<div style="padding:64px 24px;text-align:center;color:var(--text-secondary)">' +
      '<p style="font-family:var(--font-display);font-size:22px;color:var(--text-primary);margin:0 0 8px">This board isn\'t shared</p>' +
      '<p style="font-size:14px;margin:0">The link is invalid or sharing was turned off.</p></div>';
    return;
  }

  state._bdItems = items;
  state._bdView = { x: board.view_x || 0, y: board.view_y || 0, z: board.view_zoom || 1 };
  state._bdMaxZ = state._bdItems.reduce((m, it) => Math.max(m, it.z || 1), 1);

  /* Edit link on an edit-shared board: run the real editor, with every
     write routed through the token-gated RPCs */
  if (mode === 'edit' && board.share_mode === 'edit') {
    state._bdReadOnly = false;
    state._bdSharedToken = cleanToken;
    state._bdSharedOwnerId = board.user_id;
    state._bdTool = 'select';
    state._bdBoard = { id: board.id, title: board.title, share_mode: 'edit', share_token: null,
                 view_x: board.view_x, view_y: board.view_y, view_zoom: board.view_zoom };
    container.innerHTML = _bdEditorShellHtml(true);
    _bdApplyView();
    const editPlane = document.getElementById('bdPlane');
    state._bdItems.slice().sort((a, b) => (a.z || 1) - (b.z || 1)).forEach(it => editPlane.appendChild(_bdItemEl(it)));
    _bdBindEditor();
    _bdResolveSignedUrls();
    _bdLiveJoin(board.id);
    return;
  }

  container.innerHTML =
    '<div class="board-editor bd-ro">' +
      '<div class="board-topbar">' +
        '<div class="bd-title" style="cursor:default">' + _escHtml(board.title) + '</div>' +
        '<span class="bd-shared-tag">Shared board · view only</span>' +
        '<div class="bd-zoom" style="margin-left:auto">' +
          '<button data-action="_bdZoomBtn" data-args="[-1]" title="Zoom out">−</button>' +
          '<button class="bd-zoom-pct" id="bdZoomPct" data-action="_bdZoomFit" title="Fit to items">' + Math.round(state._bdView.z * 100) + '%</button>' +
          '<button data-action="_bdZoomBtn" data-args="[1]" title="Zoom in">+</button>' +
        '</div>' +
      '</div>' +
      '<div class="board-viewport" id="bdViewport">' +
        '<div class="board-plane" id="bdPlane"></div>' +
      '</div>' +
    '</div>';

  // Read-only sessions still hold the board row so live ops can be matched
  state._bdBoard = { id: board.id, title: board.title, share_mode: board.share_mode, share_token: null,
               view_x: board.view_x, view_y: board.view_y, view_zoom: board.view_zoom };
  _bdApplyView();
  const plane = document.getElementById('bdPlane');
  state._bdItems.slice().sort((a, b) => (a.z || 1) - (b.z || 1)).forEach(it => plane.appendChild(_bdItemEl(it)));
  _bdBindShared();
  _bdResolveSharedImages(loadToken);
  _bdLiveJoin(board.id);
}

function _bdBindShared() {
  const vp = document.getElementById('bdViewport');
  _bdBindPinch(vp, function() { state._bdPtr = null; });

  vp.addEventListener('wheel', function(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      _bdZoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
    } else {
      state._bdView.x -= e.deltaX;
      state._bdView.y -= e.deltaY;
      _bdApplyView();
    }
  }, { passive: false });

  vp.addEventListener('pointerdown', function(e) {
    state._bdPtr = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: state._bdView.x, vy: state._bdView.y, moved: false };
    _bdCapture(vp, e);
  });
  vp.addEventListener('pointermove', function(e) {
    if (!state._bdPtr || state._bdPtr.mode !== 'pan') return;
    state._bdView.x = state._bdPtr.vx + (e.clientX - state._bdPtr.sx);
    state._bdView.y = state._bdPtr.vy + (e.clientY - state._bdPtr.sy);
    if (Math.hypot(e.clientX - state._bdPtr.sx, e.clientY - state._bdPtr.sy) > 4) state._bdPtr.moved = true;
    _bdApplyView();
  });
  function endPan() {
    if (state._bdPtr && state._bdPtr.moved) state._bdSuppressClick = true;
    state._bdPtr = null;
  }
  vp.addEventListener('pointerup', endPan);
  vp.addEventListener('pointercancel', endPan);

  // Videos stay playable in the shared view
  vp.addEventListener('click', function(e) {
    if (state._bdSuppressClick) { state._bdSuppressClick = false; return; }
    const thumb = e.target.closest('.bd-video-thumb');
    if (thumb) {
      const it = state._bdItems.find(i => i.id === thumb.dataset.item);
      if (!it) return;
      const src = _bdEmbedSrc(it.content);
      if (!src) return;
      thumb.outerHTML = '<iframe src="' + _esc(src) + '" frameborder="0" allow="autoplay; fullscreen" allowfullscreen style="width:100%;height:100%;display:block"></iframe>';
      return;
    }
    const linkCard = e.target.closest('.bd-link-card');
    if (linkCard) {
      const itemEl = linkCard.closest('.bd-item');
      const it = itemEl && state._bdItems.find(i => i.id === itemEl.dataset.id);
      if (it && _bdSafeUrl(it.content.url)) window.open(it.content.url, '_blank', 'noopener');
    }
  });
}

// Anon visitors can't mint signed URLs the owner path uses; they download
// the blobs directly (allowed by the shared-board storage policy) and
// render object URLs.
async function _bdResolveSharedImages(loadToken) {
  if (!state._sb) return;
  const imgs = state._bdItems.filter(i => i.kind === 'image' && i.content && i.content.path);
  await Promise.all(imgs.map(async function(it) {
    try {
      const res = await state._sb.storage.from('board-media').download(it.content.path);
      if (res.data && loadToken === state._bdLoadToken) {
        state._bdSignedUrls[it.content.path] = URL.createObjectURL(res.data);
        _bdRefreshItem(it.id);
      }
    } catch (e) { console.warn('Shared image load failed', e); }
  }));
}

/* ---- SIDE EFFECTS ---- Registered from main.js in a fixed order, not at import time. */
export function __init() {
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') { _bdCommitActiveText(); _bdFlushPendingSaves(); } });
}

act({ _bdAddVideoFromPopover, _bdZoomBtn, _bdZoomFit, _createNewBoard, _deleteBoard });

export { BD_HILITE, BD_HILITE_RGB, BD_MAX_ZOOM, BD_MIN_ZOOM, BD_PEN_COLORS, BD_STICKY_COLORS, BD_TEXT_SIZES, _bdAddImageFiles, _bdAddNoteAt, _bdAddTextAt, _bdAddVideoAt, _bdAddVideoFromPopover, _bdApplyOp, _bdApplyRemoteOp, _bdApplyView, _bdBindEditor, _bdBindPinch, _bdBindShared, _bdCaptionHtml, _bdCapture, _bdClone, _bdCommitActiveText, _bdCommitTextEdit, _bdCreateItem, _bdDeleteItem, _bdEditorActive, _bdEditorShellHtml, _bdEmbedSrc, _bdFlushOrphans, _bdFlushPendingSaves, _bdHandlesHtml, _bdHideFormatBar, _bdItemEl, _bdLiveJoin, _bdLiveLeave, _bdLiveSend, _bdNum, _bdParseVideoUrl, _bdPathD, _bdPositionFormatBar, _bdPrepareImage, _bdPushUndo, _bdQueueItemSave, _bdQueueViewSave, _bdRedo, _bdRefreshItem, _bdRemoveItemLocal, _bdResolveSharedImages, _bdResolveSignedUrls, _bdRestoreItem, _bdRotFor, _bdSafeUrl, _bdSanitizeHtml, _bdScreenToBoard, _bdSelect, _bdSerializeRich, _bdSetBoardShare, _bdSetSaveState, _bdSetTool, _bdShareLink, _bdShowFormatBar, _bdStartTextEdit, _bdSyncSharePopover, _bdSyncUndoButtons, _bdTextHtml, _bdUndo, _bdUrlForPath, _bdValidVid, _bdVideoInnerHtml, _bdZoomAt, _bdZoomBtn, _bdZoomFit, _createNewBoard, _deleteBoard, renderBoardEditor, renderBoards, renderSharedBoard };
