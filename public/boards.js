/* ============================================================
   Arkives — Boards view (Milanote-style storyboards)

   Endless pannable/zoomable canvas per board. Items: sticky
   notes, text blocks, uploaded images (Supabase Storage,
   downscaled client-side), video links (YouTube/Vimeo embeds,
   anything else becomes a link card), and freehand pen strokes.

   Self-contained: state, Supabase CRUD, and all view logic live
   here (boards data is lazy-loaded when the tab opens, same as
   Scripts). Loaded after app.js in index.html. Tables + the
   board-media bucket come from migrations/016_boards.sql.

   Geometry lives in columns (x/y/w/h/z, board coordinates);
   kind-specific payload lives in content JSONB. Pen stroke
   points are stored relative to the item's x/y so moving a
   stroke only updates x/y.
   ============================================================ */

/* ---- STATE ---- */
let BOARDS = [];
let _bdBoard = null;          // current board row
let _bdItems = [];            // current board's items
let _bdView = { x: 0, y: 0, z: 1 };
let _bdTool = 'select';       // select | note | text | pen
let _bdSelectedId = null;
let _bdMaxZ = 1;
let _bdStickyColor = 'yellow';
let _bdPenColor = 'ink';
let _bdPenWidth = 3;
let _bdSignedUrls = {};       // storage path -> signed URL
let _bdPtr = null;            // active pointer gesture
let _bdPenPts = null;         // in-progress stroke points (board coords)
let _bdPendingSaves = {};     // item id -> {updates, timer}
let _bdViewSaveTimer = null;
let _bdListenersBound = false;
let _bdSuppressClick = false; // eat the click that follows a drag gesture
let _bdLoadToken = 0;         // guards against stale async renders

const BD_STICKY_COLORS = {
  yellow: '#F7E9A9', red: '#F3C8C6', teal: '#C9E0D4', white: '#FFFFFF'
};
const BD_PEN_COLORS = {
  ink: '#1A1714', red: '#C73539', teal: '#2A6B5A'
};
const BD_MIN_ZOOM = 0.1, BD_MAX_ZOOM = 4;

/* ---- SUPABASE CRUD ---- */

async function sbFetchBoards() {
  if (!_sb) return [];
  const res = await _sb.from('boards').select('*').order('updated_at', { ascending: false });
  if (res.error) { _showSaveError('Failed to load boards'); console.error(res.error); return []; }
  return res.data || [];
}

async function sbCreateBoard(title) {
  if (!_sb) return null;
  const res = await _sb.from('boards').insert({ title: title || 'Untitled Board' }).select().single();
  if (res.error) { _showSaveError('Failed to create board'); console.error(res.error); return null; }
  return res.data;
}

async function sbUpdateBoard(boardId, updates, silent) {
  if (!_sb) return false;
  const { error } = await _sb.from('boards').update(updates).eq('id', boardId);
  if (error) { _showSaveError('Failed to save board'); console.error(error); return false; }
  if (!silent) _showSaveSuccess();
  return true;
}

async function sbDeleteBoard(boardId) {
  if (!_sb) return false;
  // Best-effort storage cleanup first (items cascade with the row)
  try {
    const folder = CREATOR._sbId + '/' + boardId;
    const listing = await _sb.storage.from('board-media').list(folder, { limit: 1000 });
    if (listing.data && listing.data.length) {
      await _sb.storage.from('board-media').remove(listing.data.map(f => folder + '/' + f.name));
    }
  } catch (e) { console.warn('Board media cleanup failed', e); }
  const { error } = await _sb.from('boards').delete().eq('id', boardId);
  if (error) { _showSaveError('Failed to delete board'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbFetchBoardItems(boardId) {
  if (!_sb) return [];
  const res = await _sb.from('board_items').select('*').eq('board_id', boardId);
  if (res.error) { _showSaveError('Failed to load board'); console.error(res.error); return []; }
  return res.data || [];
}

async function sbAddBoardItem(item) {
  if (!_sb) return null;
  // user_id is stamped by the DB default (current_profile_id) per the
  // multi-tenancy rules — never pass it manually.
  const res = await _sb.from('board_items').insert(item).select().single();
  if (res.error) { _showSaveError('Failed to add to board'); console.error(res.error); return null; }
  return res.data;
}

async function sbUpdateBoardItem(itemId, updates) {
  if (!_sb) return false;
  const { error } = await _sb.from('board_items').update(updates).eq('id', itemId);
  if (error) { _showSaveError('Failed to save changes'); console.error(error); return false; }
  return true;
}

async function sbDeleteBoardItem(itemId) {
  if (!_sb) return false;
  const { error } = await _sb.from('board_items').delete().eq('id', itemId);
  if (error) { _showSaveError('Failed to delete'); console.error(error); return false; }
  return true;
}

/* ---- BOARD LIST VIEW ---- */

async function renderBoards() {
  const container = document.getElementById('view-boards');
  container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:200px;border-radius:12px"></div></div>';
  BOARDS = await sbFetchBoards();
  let html = '<div class="boards-page">';
  html += '<div class="boards-header">';
  html += '<div><h2 class="view-title" style="margin:0">Boards</h2><p style="color:var(--text-secondary);margin:4px 0 0;font-size:13px">Storyboards and idea canvases</p></div>';
  html += '<button class="btn btn-primary" onclick="_createNewBoard()">+ New Board</button>';
  html += '</div>';

  if (BOARDS.length === 0) {
    html += '<div class="boards-empty">';
    html += '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><path d="M3.2 4.1h17.6v13.7H3.2z"/><path d="M8.1 21.2l3.9-3.3 3.9 3.2"/><path d="M6.8 7.9h4.1v3.9H6.8z"/><path d="M13.9 9.6h3.4"/><path d="M13.8 12.4h3.5"/></svg>';
    html += '<p style="color:var(--text-secondary);font-size:15px;margin:12px 0 0">No boards yet. Create your first storyboard.</p>';
    html += '</div>';
  } else {
    html += '<div class="boards-grid">';
    BOARDS.forEach(function(b) {
      const date = new Date(b.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      html += '<div class="board-card" onclick="window.location.hash=\'board/' + b.id + '\';">';
      html += '<div class="board-card-canvas"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4.2 5.1h6.1v5.2H4.2z"/><path d="M13.6 7.2h6.2"/><path d="M13.7 10.1h4.9"/><path d="M5.1 14.3c3.2 2.6 8.9-1.8 13.7 1.9"/></svg></div>';
      html += '<div class="board-card-title">' + _escHtml(b.title) + '</div>';
      html += '<div class="board-card-meta">' + date + '</div>';
      html += '<button class="board-card-delete" onclick="event.stopPropagation(); _deleteBoard(\'' + b.id + '\')" title="Delete board">' + SKETCHY_ICONS.trash + '</button>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

async function _createNewBoard() {
  const board = await sbCreateBoard('Untitled Board');
  if (board) window.location.hash = 'board/' + board.id;
}

async function _deleteBoard(boardId) {
  if (!confirm('Delete this board and everything on it? Uploaded images are removed too. This cannot be undone.')) return;
  await sbDeleteBoard(boardId);
  renderBoards();
}

/* ---- EDITOR: SHELL ---- */

function _bdEditorActive() {
  const el = document.getElementById('view-board-editor');
  return el && el.style.display !== 'none';
}

async function renderBoardEditor(boardId) {
  const token = ++_bdLoadToken;
  const container = document.getElementById('view-board-editor');
  container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:400px;border-radius:12px"></div></div>';

  const boardRes = _sb ? await _sb.from('boards').select('*').eq('id', boardId).maybeSingle() : { data: null };
  if (token !== _bdLoadToken) return; // user navigated away mid-load
  if (!boardRes.data) {
    container.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text-secondary)">Board not found. <a href="#boards">Back to Boards</a></div>';
    return;
  }
  _bdBoard = boardRes.data;
  _bdView = { x: _bdBoard.view_x || 0, y: _bdBoard.view_y || 0, z: _bdBoard.view_zoom || 1 };
  _bdTool = 'select';
  _bdSelectedId = null;
  _bdSignedUrls = {};
  _bdPtr = null; _bdPenPts = null;

  _bdItems = await sbFetchBoardItems(boardId);
  if (token !== _bdLoadToken) return;
  _bdMaxZ = _bdItems.reduce((m, it) => Math.max(m, it.z || 1), 1);

  const penDots = Object.keys(BD_PEN_COLORS).map(c =>
    '<button class="bd-dot' + (c === _bdPenColor ? ' active' : '') + '" data-pen-color="' + c + '" style="background:' + BD_PEN_COLORS[c] + '" title="' + c + '"></button>').join('');
  const stickyDots = Object.keys(BD_STICKY_COLORS).map(c =>
    '<button class="bd-dot' + (c === _bdStickyColor ? ' active' : '') + '" data-sticky-color="' + c + '" style="background:' + BD_STICKY_COLORS[c] + '" title="' + c + '"></button>').join('');

  container.innerHTML =
    '<div class="board-editor">' +
      '<div class="board-topbar">' +
        '<button class="bd-back" onclick="window.location.hash=\'boards\'" title="Back to Boards">' + SKETCHY_ICONS.chevronLeft + '</button>' +
        '<div class="bd-title" id="bdTitle" contenteditable="false" spellcheck="false">' + _escHtml(_bdBoard.title) + '</div>' +
        '<span class="bd-savestate" id="bdSaveState"></span>' +
        '<div class="bd-zoom">' +
          '<button onclick="_bdZoomBtn(-1)" title="Zoom out">−</button>' +
          '<button class="bd-zoom-pct" id="bdZoomPct" onclick="_bdZoomFit()" title="Fit to items">' + Math.round(_bdView.z * 100) + '%</button>' +
          '<button onclick="_bdZoomBtn(1)" title="Zoom in">+</button>' +
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
          '<button class="bd-tool" data-action="image" title="Add image (or drag & drop / paste)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 4.1h17.6v15.8H3.2z"/><circle cx="8.6" cy="9" r="1.7"/><path d="M20.7 15.2l-4.8-4.9-9.7 9.6"/></svg></button>' +
          '<button class="bd-tool" data-action="video" title="Add video link"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 5.1h17.6v13.8H3.2z"/><path d="M10.1 9.1l4.9 2.9-4.9 2.9z"/></svg></button>' +
        '</div>' +
        '<div class="bd-tool-options" id="bdPenOptions" style="display:none">' + penDots +
          '<div class="bd-opt-sep"></div>' +
          '<button class="bd-width' + (_bdPenWidth === 3 ? ' active' : '') + '" data-pen-width="3" title="Thin"><span style="height:2px"></span></button>' +
          '<button class="bd-width' + (_bdPenWidth === 6 ? ' active' : '') + '" data-pen-width="6" title="Thick"><span style="height:5px"></span></button>' +
        '</div>' +
        '<div class="bd-tool-options" id="bdStickyOptions" style="display:none">' + stickyDots + '</div>' +
        '<div class="bd-video-popover" id="bdVideoPopover" style="display:none">' +
          '<input type="text" id="bdVideoUrl" placeholder="Paste a YouTube, Vimeo, or any link…">' +
          '<button class="btn btn-primary" onclick="_bdAddVideoFromPopover()">Add</button>' +
        '</div>' +
        '<input type="file" id="bdFileInput" accept="image/*" multiple style="display:none">' +
        '<div class="bd-drop-hint" id="bdDropHint">Drop images to add them</div>' +
      '</div>' +
    '</div>';

  _bdApplyView();
  const plane = document.getElementById('bdPlane');
  _bdItems.slice().sort((a, b) => (a.z || 1) - (b.z || 1)).forEach(it => plane.appendChild(_bdItemEl(it)));
  _bdBindEditor();
  _bdResolveSignedUrls();
}

/* ---- EDITOR: COORDS & VIEWPORT ---- */

function _bdScreenToBoard(clientX, clientY) {
  const rect = document.getElementById('bdViewport').getBoundingClientRect();
  return {
    x: (clientX - rect.left - _bdView.x) / _bdView.z,
    y: (clientY - rect.top - _bdView.y) / _bdView.z
  };
}

function _bdApplyView() {
  const plane = document.getElementById('bdPlane');
  if (plane) plane.style.transform = 'translate(' + _bdView.x + 'px,' + _bdView.y + 'px) scale(' + _bdView.z + ')';
  const live = document.getElementById('bdPenLive');
  if (live) live.style.transform = 'translate(' + _bdView.x + 'px,' + _bdView.y + 'px) scale(' + _bdView.z + ')';
  const pct = document.getElementById('bdZoomPct');
  if (pct) pct.textContent = Math.round(_bdView.z * 100) + '%';
  _bdQueueViewSave();
}

function _bdQueueViewSave() {
  if (!_bdBoard) return;
  // Skip when nothing changed — opening a board shouldn't bump updated_at
  if (_bdBoard.view_x === _bdView.x && _bdBoard.view_y === _bdView.y && _bdBoard.view_zoom === _bdView.z) return;
  clearTimeout(_bdViewSaveTimer);
  _bdViewSaveTimer = setTimeout(function() {
    if (!_bdBoard) return;
    _bdBoard.view_x = _bdView.x; _bdBoard.view_y = _bdView.y; _bdBoard.view_zoom = _bdView.z;
    sbUpdateBoard(_bdBoard.id, { view_x: _bdView.x, view_y: _bdView.y, view_zoom: _bdView.z }, true);
  }, 1000);
}

function _bdZoomAt(clientX, clientY, factor) {
  const rect = document.getElementById('bdViewport').getBoundingClientRect();
  const mx = clientX - rect.left, my = clientY - rect.top;
  const newZ = Math.min(BD_MAX_ZOOM, Math.max(BD_MIN_ZOOM, _bdView.z * factor));
  _bdView.x = mx - (mx - _bdView.x) * (newZ / _bdView.z);
  _bdView.y = my - (my - _bdView.y) * (newZ / _bdView.z);
  _bdView.z = newZ;
  _bdApplyView();
}

function _bdZoomBtn(dir) {
  const vp = document.getElementById('bdViewport').getBoundingClientRect();
  _bdZoomAt(vp.left + vp.width / 2, vp.top + vp.height / 2, dir > 0 ? 1.25 : 0.8);
}

function _bdZoomFit() {
  if (!_bdItems.length) { _bdView = { x: 0, y: 0, z: 1 }; _bdApplyView(); return; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  _bdItems.forEach(it => {
    minX = Math.min(minX, it.x); minY = Math.min(minY, it.y);
    maxX = Math.max(maxX, it.x + it.w); maxY = Math.max(maxY, it.y + it.h);
  });
  const vp = document.getElementById('bdViewport').getBoundingClientRect();
  const pad = 60;
  const z = Math.min(BD_MAX_ZOOM, Math.max(BD_MIN_ZOOM, Math.min(
    (vp.width - pad * 2) / Math.max(1, maxX - minX),
    (vp.height - pad * 2) / Math.max(1, maxY - minY), 1.5)));
  _bdView.z = z;
  _bdView.x = (vp.width - (maxX - minX) * z) / 2 - minX * z;
  _bdView.y = (vp.height - (maxY - minY) * z) / 2 - minY * z;
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
  el.className = 'bd-item bd-kind-' + it.kind + (it.id === _bdSelectedId ? ' selected' : '');
  el.dataset.id = it.id;
  el.style.left = it.x + 'px';
  el.style.top = it.y + 'px';
  el.style.width = it.w + 'px';
  el.style.zIndex = it.z || 1;
  const c = it.content || {};

  if (it.kind === 'note') {
    el.style.height = it.h + 'px';
    el.style.background = BD_STICKY_COLORS[c.color] || BD_STICKY_COLORS.yellow;
    el.style.transform = 'rotate(' + _bdRotFor(it.id) + 'deg)';
    el.innerHTML = '<div class="bd-text-content" spellcheck="false">' + _escHtml(c.text || '') + '</div>' + _bdHandlesHtml(it);
  } else if (it.kind === 'text') {
    el.style.height = 'auto';
    el.innerHTML = '<div class="bd-text-content bd-text-' + (c.size === 'title' ? 'title' : 'body') + '" spellcheck="false">' + _escHtml(c.text || '') + '</div>' + _bdHandlesHtml(it);
  } else if (it.kind === 'image') {
    el.style.height = it.h + 'px';
    const url = _bdSignedUrls[c.path];
    el.innerHTML =
      '<div class="bd-media-frame">' + (url
        ? '<img src="' + url + '" draggable="false" alt="">'
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
      '<path d="' + _bdPathD(pts) + '" fill="none" stroke="' + (BD_PEN_COLORS[c.color] || BD_PEN_COLORS.ink) + '" stroke-width="' + (c.width || 3) + '" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      _bdHandlesHtml(it);
  }
  return el;
}

function _bdHandlesHtml(it) {
  let extras = '';
  if (it.kind === 'text') {
    extras += '<button class="bd-item-btn bd-size-toggle" title="Toggle title / body text"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7V5h16v2"/><path d="M12 5v14"/></svg></button>';
  }
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
  if (c.provider === 'youtube') {
    return '<div class="bd-video-thumb" data-item="' + itemId + '"><img src="https://i.ytimg.com/vi/' + c.vid + '/hqdefault.jpg" draggable="false" alt=""><div class="bd-play">▶</div></div>';
  }
  if (c.provider === 'vimeo') {
    return '<div class="bd-video-thumb bd-video-dark" data-item="' + itemId + '"><div class="bd-play">▶</div><span class="bd-video-domain">vimeo</span></div>';
  }
  let domain = '';
  try { domain = new URL(c.url).hostname.replace('www.', ''); } catch (e) { domain = c.url; }
  return '<div class="bd-link-card"><span class="bd-link-icon">' + SKETCHY_ICONS.link + '</span><span class="bd-link-domain">' + _escHtml(domain) + '</span></div>';
}

function _bdRefreshItem(id) {
  const it = _bdItems.find(i => i.id === id);
  const old = document.querySelector('.bd-item[data-id="' + id + '"]');
  if (!it || !old) return;
  old.replaceWith(_bdItemEl(it));
}

function _bdPathD(pts) {
  if (!pts || pts.length < 2) return '';
  if (pts.length < 3) return 'M' + pts[0][0] + ' ' + pts[0][1] + ' L' + pts[1][0] + ' ' + pts[1][1];
  let d = 'M' + pts[0][0] + ' ' + pts[0][1];
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ' Q' + pts[i][0] + ' ' + pts[i][1] + ' ' + mx + ' ' + my;
  }
  const l = pts[pts.length - 1];
  return d + ' L' + l[0] + ' ' + l[1];
}

/* ---- EDITOR: SIGNED URLS ---- */

async function _bdResolveSignedUrls() {
  const paths = _bdItems.filter(i => i.kind === 'image' && i.content && i.content.path && !_bdSignedUrls[i.content.path])
    .map(i => i.content.path);
  if (!paths.length || !_sb) return;
  const res = await _sb.storage.from('board-media').createSignedUrls(paths, 60 * 60 * 12);
  if (res.error || !res.data) { console.error('Signed URL batch failed', res.error); return; }
  res.data.forEach(function(entry, idx) {
    if (entry.signedUrl) _bdSignedUrls[paths[idx]] = entry.signedUrl;
  });
  _bdItems.forEach(function(it) {
    if (it.kind === 'image' && it.content && _bdSignedUrls[it.content.path]) _bdRefreshItem(it.id);
  });
}

/* ---- EDITOR: SAVE PLUMBING ---- */

function _bdSetSaveState(state) {
  const el = document.getElementById('bdSaveState');
  if (!el) return;
  el.textContent = state === 'saving' ? 'Saving…' : (state === 'saved' ? 'Saved' : '');
  if (state === 'saved') {
    clearTimeout(el._t);
    el._t = setTimeout(function() { if (el.textContent === 'Saved') el.textContent = ''; }, 1600);
  }
}

function _bdQueueItemSave(id, updates) {
  const pending = _bdPendingSaves[id] || { updates: {} };
  Object.assign(pending.updates, updates);
  clearTimeout(pending.timer);
  pending.timer = setTimeout(async function() {
    delete _bdPendingSaves[id];
    _bdSetSaveState('saving');
    const ok = await sbUpdateBoardItem(id, pending.updates);
    if (ok) _bdSetSaveState('saved');
  }, 500);
  _bdPendingSaves[id] = pending;
}

/* ---- EDITOR: ITEM CREATION ---- */

async function _bdCreateItem(kind, x, y, w, h, content) {
  const row = await sbAddBoardItem({
    board_id: _bdBoard.id, kind: kind,
    x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h),
    z: ++_bdMaxZ, content: content
  });
  if (!row) return null;
  _bdItems.push(row);
  document.getElementById('bdPlane').appendChild(_bdItemEl(row));
  return row;
}

async function _bdAddNoteAt(bx, by) {
  const row = await _bdCreateItem('note', bx - 90, by - 90, 180, 180, { text: '', color: _bdStickyColor });
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
      const path = CREATOR._sbId + '/' + _bdBoard.id + '/' + crypto.randomUUID() + '.' + prepped.ext;
      const up = await _sb.storage.from('board-media').upload(path, prepped.blob, { contentType: prepped.type });
      if (up.error) { _showSaveError('Upload failed: ' + (up.error.message || 'unknown error')); console.error(up.error); continue; }
      const signed = await _sb.storage.from('board-media').createSignedUrl(path, 60 * 60 * 12);
      if (signed.data && signed.data.signedUrl) _bdSignedUrls[path] = signed.data.signedUrl;
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
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { url: url, provider: 'youtube', vid: yt[1], caption: '' };
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return { url: url, provider: 'vimeo', vid: vm[1], caption: '' };
  return { url: url, provider: 'link', vid: null, caption: '' };
}

async function _bdAddVideoAt(url, bx, by) {
  const content = _bdParseVideoUrl(url.trim());
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
  if (_bdSelectedId === id) return;
  const prev = document.querySelector('.bd-item.selected');
  if (prev) prev.classList.remove('selected');
  _bdSelectedId = id;
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
  const it = _bdItems.find(i => i.id === id);
  if (!it) return;
  const text = target.innerText.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trimEnd();
  if (target.classList.contains('bd-caption')) {
    if ((it.content.caption || '') !== text) {
      it.content = Object.assign({}, it.content, { caption: text });
      _bdQueueItemSave(id, { content: it.content });
    }
    target.classList.toggle('empty', !text);
  } else {
    if ((it.content.text || '') !== text) {
      it.content = Object.assign({}, it.content, { text: text });
      _bdQueueItemSave(id, { content: it.content });
    }
    // Empty brand-new note/text left empty: remove it
    if (!text && it.kind === 'text') _bdDeleteItem(id);
  }
}

async function _bdDeleteItem(id) {
  const it = _bdItems.find(i => i.id === id);
  if (!it) return;
  _bdItems = _bdItems.filter(i => i.id !== id);
  const el = document.querySelector('.bd-item[data-id="' + id + '"]');
  if (el) el.remove();
  if (_bdSelectedId === id) _bdSelectedId = null;
  await sbDeleteBoardItem(id);
  if (it.kind === 'image' && it.content && it.content.path) {
    try { await _sb.storage.from('board-media').remove([it.content.path]); }
    catch (e) { console.warn('Storage cleanup failed', e); }
  }
}

function _bdSetTool(tool) {
  _bdTool = tool;
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
  _bdSetTool(_bdTool); // sync data-tool + toolbar state on fresh DOM

  /* Toolbar */
  toolbar.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.tool) { _bdSetTool(btn.dataset.tool); return; }
    if (btn.dataset.action === 'image') { document.getElementById('bdFileInput').click(); return; }
    if (btn.dataset.action === 'video') {
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
        _bdPenColor = btn.dataset.penColor;
        btn.parentElement.querySelectorAll('.bd-dot').forEach(d => d.classList.toggle('active', d === btn));
      }
      if (btn.dataset.penWidth) {
        _bdPenWidth = Number(btn.dataset.penWidth);
        btn.parentElement.querySelectorAll('.bd-width').forEach(d => d.classList.toggle('active', d === btn));
      }
      if (btn.dataset.stickyColor) {
        _bdStickyColor = btn.dataset.stickyColor;
        btn.parentElement.querySelectorAll('.bd-dot').forEach(d => d.classList.toggle('active', d === btn));
        // Recolor the selected sticky too, if one is selected
        const it = _bdItems.find(i => i.id === _bdSelectedId && i.kind === 'note');
        if (it) {
          it.content = Object.assign({}, it.content, { color: _bdStickyColor });
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

  /* Board title */
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
    if (_bdBoard && t !== _bdBoard.title) {
      _bdBoard.title = t;
      sbUpdateBoard(_bdBoard.id, { title: t }, true);
    }
  });

  /* Wheel: pan by default, zoom with ctrl/cmd (covers trackpad pinch) */
  vp.addEventListener('wheel', function(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      _bdZoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
    } else {
      _bdView.x -= e.deltaX;
      _bdView.y -= e.deltaY;
      _bdApplyView();
    }
  }, { passive: false });

  /* Pointer gestures */
  vp.addEventListener('pointerdown', function(e) {
    if (e.target.closest('.board-toolbar, .bd-tool-options, .bd-video-popover, .bd-zoom')) return;
    if (e.target.isContentEditable) return; // typing, leave it alone
    const itemEl = e.target.closest('.bd-item');

    // Item action buttons act on pointerdown's click, not as gestures
    if (e.target.closest('.bd-item-btn')) return;

    if (e.button === 1 || (_bdTool === 'select' && !itemEl)) {
      _bdPtr = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: _bdView.x, vy: _bdView.y };
      if (_bdTool === 'select' && !e.target.closest('.bd-item')) _bdSelect(null);
      vp.setPointerCapture(e.pointerId);
      return;
    }

    if (_bdTool === 'pen') {
      const p = _bdScreenToBoard(e.clientX, e.clientY);
      _bdPenPts = [[p.x, p.y]];
      _bdPtr = { mode: 'pen' };
      const live = document.getElementById('bdPenLive');
      live.innerHTML = '<path d="" fill="none" stroke="' + BD_PEN_COLORS[_bdPenColor] + '" stroke-width="' + _bdPenWidth + '" stroke-linecap="round" stroke-linejoin="round"/>';
      vp.setPointerCapture(e.pointerId);
      return;
    }

    if (_bdTool === 'note' || _bdTool === 'text') {
      const p = _bdScreenToBoard(e.clientX, e.clientY);
      if (_bdTool === 'note') _bdAddNoteAt(p.x, p.y); else _bdAddTextAt(p.x, p.y);
      return;
    }

    if (itemEl) {
      const id = itemEl.dataset.id;
      const it = _bdItems.find(i => i.id === id);
      if (!it) return;
      _bdSelect(id);
      // Bring to front
      if ((it.z || 1) < _bdMaxZ) {
        it.z = ++_bdMaxZ;
        itemEl.style.zIndex = it.z;
        _bdQueueItemSave(id, { z: it.z });
      }
      const p = _bdScreenToBoard(e.clientX, e.clientY);
      if (e.target.closest('.bd-resize')) {
        _bdPtr = { mode: 'resize', id: id, sx: p.x, sy: p.y, w: it.w, h: it.h };
      } else {
        _bdPtr = { mode: 'drag', id: id, dx: p.x - it.x, dy: p.y - it.y, moved: false };
      }
      vp.setPointerCapture(e.pointerId);
    }
  });

  vp.addEventListener('pointermove', function(e) {
    if (!_bdPtr) return;
    if (_bdPtr.mode === 'pan') {
      _bdView.x = _bdPtr.vx + (e.clientX - _bdPtr.sx);
      _bdView.y = _bdPtr.vy + (e.clientY - _bdPtr.sy);
      _bdApplyView();
      return;
    }
    const p = _bdScreenToBoard(e.clientX, e.clientY);
    if (_bdPtr.mode === 'pen') {
      const last = _bdPenPts[_bdPenPts.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) > 2 / _bdView.z) {
        _bdPenPts.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
        const path = document.querySelector('#bdPenLive path');
        if (path) path.setAttribute('d', _bdPathD(_bdPenPts));
      }
      return;
    }
    const it = _bdItems.find(i => i.id === _bdPtr.id);
    const el = document.querySelector('.bd-item[data-id="' + _bdPtr.id + '"]');
    if (!it || !el) return;
    if (_bdPtr.mode === 'drag') {
      it.x = p.x - _bdPtr.dx;
      it.y = p.y - _bdPtr.dy;
      el.style.left = it.x + 'px';
      el.style.top = it.y + 'px';
      _bdPtr.moved = true;
    } else if (_bdPtr.mode === 'resize') {
      const minW = it.kind === 'note' ? 100 : 60;
      let w = Math.max(minW, _bdPtr.w + (p.x - _bdPtr.sx));
      let h = Math.max(40, _bdPtr.h + (p.y - _bdPtr.sy));
      if (it.kind === 'image' && it.content.natW && it.content.natH) {
        h = w * (it.content.natH / it.content.natW); // images keep their aspect
      } else if (it.kind === 'video' && it.content.provider !== 'link') {
        h = w * 9 / 16;
      }
      it.w = w; it.h = h;
      el.style.width = w + 'px';
      if (it.kind !== 'text') el.style.height = h + 'px';
      _bdPtr.moved = true;
    }
  });

  function endGesture(e) {
    if (!_bdPtr) return;
    const g = _bdPtr; _bdPtr = null;
    if (g.mode === 'pen' && _bdPenPts) {
      _bdSuppressClick = true; // stroke ending over a video shouldn't play it
      const pts = _bdPenPts; _bdPenPts = null;
      document.getElementById('bdPenLive').innerHTML = '';
      if (pts.length > 1) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pts.forEach(pt => {
          minX = Math.min(minX, pt[0]); minY = Math.min(minY, pt[1]);
          maxX = Math.max(maxX, pt[0]); maxY = Math.max(maxY, pt[1]);
        });
        const rel = pts.map(pt => [Math.round((pt[0] - minX) * 10) / 10, Math.round((pt[1] - minY) * 10) / 10]);
        _bdCreateItem('draw', minX, minY, Math.max(2, maxX - minX), Math.max(2, maxY - minY),
          { points: rel, color: _bdPenColor, width: _bdPenWidth });
      }
      return;
    }
    if ((g.mode === 'drag' || g.mode === 'resize') && g.moved) {
      _bdSuppressClick = true; // the click after a drag shouldn't trigger video play etc.
      const it = _bdItems.find(i => i.id === g.id);
      if (it) _bdQueueItemSave(g.id, { x: Math.round(it.x), y: Math.round(it.y), w: Math.round(it.w), h: Math.round(it.h) });
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
    if (!e.target.closest('.bd-item') && _bdTool === 'select') {
      const p = _bdScreenToBoard(e.clientX, e.clientY);
      _bdAddNoteAt(p.x, p.y);
    }
  });

  /* Blur commits text edits */
  vp.addEventListener('focusout', function(e) {
    if (e.target.classList && (e.target.classList.contains('bd-text-content') || e.target.classList.contains('bd-caption'))) {
      _bdCommitTextEdit(e.target);
    }
  });

  /* Item action buttons + video play (click, since pointerdown skips them) */
  vp.addEventListener('click', function(e) {
    if (_bdSuppressClick) { _bdSuppressClick = false; return; }
    const del = e.target.closest('.bd-item-delete');
    if (del) {
      const id = del.closest('.bd-item').dataset.id;
      _bdDeleteItem(id);
      return;
    }
    const sizeToggle = e.target.closest('.bd-size-toggle');
    if (sizeToggle) {
      const id = sizeToggle.closest('.bd-item').dataset.id;
      const it = _bdItems.find(i => i.id === id);
      if (it) {
        it.content = Object.assign({}, it.content, { size: it.content.size === 'title' ? 'body' : 'title' });
        _bdRefreshItem(id);
        _bdSelect(id);
        _bdQueueItemSave(id, { content: it.content });
      }
      return;
    }
    const openLink = e.target.closest('.bd-open-link');
    if (openLink) {
      const id = openLink.closest('.bd-item').dataset.id;
      const it = _bdItems.find(i => i.id === id);
      if (it && it.content.url) window.open(it.content.url, '_blank', 'noopener');
      return;
    }
    const thumb = e.target.closest('.bd-video-thumb');
    if (thumb) {
      const id = thumb.dataset.item;
      const it = _bdItems.find(i => i.id === id);
      if (!it) return;
      const src = it.content.provider === 'youtube'
        ? 'https://www.youtube.com/embed/' + it.content.vid + '?autoplay=1'
        : 'https://player.vimeo.com/video/' + it.content.vid + '?autoplay=1';
      thumb.outerHTML = '<iframe src="' + src + '" frameborder="0" allow="autoplay; fullscreen" allowfullscreen style="width:100%;height:100%;display:block"></iframe>';
    }
    const linkCard = e.target.closest('.bd-link-card');
    if (linkCard && _bdTool === 'select') {
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
  if (!_bdListenersBound) {
    _bdListenersBound = true;
    document.addEventListener('keydown', function(e) {
      if (!_bdEditorActive()) return;
      if (e.target.isContentEditable || /INPUT|TEXTAREA/.test(e.target.tagName)) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && _bdSelectedId) {
        e.preventDefault();
        _bdDeleteItem(_bdSelectedId);
      } else if (e.key === 'Escape') {
        if (_bdTool !== 'select') _bdSetTool('select');
        else _bdSelect(null);
        const pop = document.getElementById('bdVideoPopover');
        if (pop) pop.style.display = 'none';
      }
    });
    document.addEventListener('paste', async function(e) {
      if (!_bdEditorActive()) return;
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
