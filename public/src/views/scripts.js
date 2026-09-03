// Arkives — Scripts: list, editor, scenes, thumbnails, sharing.
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { _args, act } from '../lib/actions.js';
import { _esc, _escHtml, _safeThumb } from '../lib/esc.js';
import { SKETCHY_ICONS } from '../lib/icons.js';
import { _shareLinkRowsHtml } from '../lib/share.js';
import { _showSaveError } from '../lib/toast.js';


// Repaint the editor from in-memory state (no refetch). Pending edits are
// flushed first so a repaint can never resurrect stale text.
async function _scriptRerender() {
  await _flushScriptSaves();
  if (!state._currentScriptRow) return;
  if (state._sharedScriptToken) _paintSharedEditor();
  else _renderEditorUI(document.getElementById('view-script-editor'), state._currentScriptRow, state._currentScenes, false);
}

/* ---- SCRIPTS LIST VIEW ---- */
async function renderScripts() {
  var container = document.getElementById('view-scripts');
  container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:200px;border-radius:12px"></div></div>';
  var scripts = await db.sbFetchScripts();
  var html = '<div class="scripts-page">';
  html += '<div class="scripts-header">';
  html += '<div><h2 class="view-title" style="margin:0">Scripts</h2><p style="color:var(--text-secondary);margin:4px 0 0;font-size:13px">Storyboards and video scripts</p></div>';
  html += '<button class="btn btn-primary" data-action="_createNewScript">+ New Script</button>';
  html += '</div>';

  if (scripts.length === 0) {
    html += '<div class="scripts-empty">';
    html += '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><path d="M4 3h12l4 4v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M7 8h6"/><path d="M7 12h10"/><path d="M7 16h10"/></svg>';
    html += '<p style="color:var(--text-secondary);font-size:15px;margin:12px 0 0">No scripts yet. Create your first storyboard.</p>';
    html += '</div>';
  } else {
    html += '<div class="scripts-grid">';
    scripts.forEach(function(s) {
      var date = new Date(s.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      var shareLabel = s.share_mode === 'none' ? 'Private' : (s.share_mode === 'view' ? 'View link' : 'Edit link');
      var shareDot = s.share_mode === 'none' ? 'var(--text-secondary)' : 'var(--teal)';
      html += '<div class="script-card" data-action="go" data-args="' + _args('script/' + s.id) + '">';
      html += '<div class="script-card-title">' + _escHtml(s.title) + '</div>';
      html += '<div class="script-card-meta">';
      html += '<span>' + date + '</span>';
      html += '<span style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:' + shareDot + ';display:inline-block"></span>' + shareLabel + '</span>';
      html += '</div>';
      html += '<button class="script-card-delete" data-action="_deleteScript" data-args="' + _args(s.id) + '" data-stop title="Delete script">' + SKETCHY_ICONS.trash + '</button>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

async function _createNewScript() {
  var script = await db.sbCreateScript('Untitled Script');
  if (script) {
    window.location.hash = 'script/' + script.id;
  }
}

async function _deleteScript(scriptId) {
  if (!confirm('Delete this script and all its scenes? This cannot be undone.')) return;
  var ok = await db.sbDeleteScript(scriptId);
  if (ok) renderScripts();
}

/* ---- SCRIPT EDITOR VIEW ---- */
async function renderScriptEditor(scriptId) {
  await _flushScriptSaves();            // the previous script's pending edits
  var token = ++state._scriptLoadToken;
  state._sharedScriptToken = null;
  state._currentScriptId = scriptId;
  state._currentScriptRow = null;
  var container = document.getElementById('view-script-editor');
  container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:300px;border-radius:12px"></div></div>';

  /* Fetch script + scenes */
  var scriptRes = await state._sb.from('scripts').select('*').eq('id', scriptId).single();
  if (token !== state._scriptLoadToken) return;   // user moved on mid-load
  if (scriptRes.error || !scriptRes.data) {
    container.innerHTML = '<div style="padding:48px;text-align:center"><p>Script not found.</p><a href="#scripts" style="color:var(--accent)">Back to Scripts</a></div>';
    return;
  }
  var script = scriptRes.data;
  var scenes = await db.sbFetchScenes(scriptId);
  if (token !== state._scriptLoadToken) return;
  state._currentScriptRow = script;
  state._currentScenes = scenes;

  _renderEditorUI(container, script, state._currentScenes, false);
}

function _renderEditorUI(container, script, scenes, readOnly) {
  var html = '<div class="script-editor">';

  /* Top bar. In a shared session the owner controls (Back into the app,
     the Share modal) are hidden — visitors only get the editing surface. */
  var isSharedSession = !!state._sharedScriptToken;
  html += '<div class="script-editor-topbar">';
  if (!readOnly && !isSharedSession) {
    html += '<a href="#scripts" class="script-back-btn">' + SKETCHY_ICONS.chevronLeft + ' Back</a>';
  }
  html += '<input type="text" class="script-title-input" id="scriptTitleInput" value="' + _esc(script.title) + '" ' + (readOnly ? 'disabled' : '') + ' placeholder="Script title..." />';
  if (!readOnly) {
    html += '<div class="script-topbar-actions">';
    if (!isSharedSession) {
      html += '<button class="bd-share-btn" id="scShareBtn">' + SKETCHY_ICONS.share + '<span id="scShareBtnLabel">' + (!script.share_mode || script.share_mode === 'none' ? 'Share' : 'Shared') + '</span></button>';
    } else {
      html += '<span class="script-readonly-badge">Shared — can edit</span>';
    }
    html += '<span class="script-save-indicator" id="scriptSaveIndicator">Saved</span>';
    html += '</div>';
  } else {
    html += '<span class="script-readonly-badge">View Only</span>';
  }
  if (!readOnly && !isSharedSession) {
    /* Same share popover as Boards (shared CSS classes + link-row builder) */
    html += '<div class="bd-share-popover" id="scSharePopover" style="display:none;right:16px">' +
      '<button class="bd-share-opt" data-share="none">Private</button>' +
      '<button class="bd-share-opt" data-share="view">Anyone with the link can view</button>' +
      '<button class="bd-share-opt" data-share="edit">Anyone with the link can edit</button>' +
      '<div id="scShareLinks"></div>' +
      '</div>';
  }
  html += '</div>';

  /* Scenes table */
  html += '<div class="script-scenes-wrapper">';
  html += '<div class="script-scenes-table">';
  /* Header row */
  html += '<div class="script-scene-header">';
  html += '<div class="script-col-num">#</div>';
  html += '<div class="script-col-script">SCRIPT</div>';
  html += '<div class="script-col-scene">SCENE</div>';
  html += '<div class="script-col-thumb">THUMBNAIL</div>';
  if (!readOnly) html += '<div class="script-col-actions"></div>';
  html += '</div>';

  /* Scene rows */
  if (scenes.length === 0 && !readOnly) {
    html += '<div style="padding:48px 24px;text-align:center;color:var(--text-secondary)">No scenes yet. Click "Add Scene" below.</div>';
  }
  scenes.forEach(function(scene, idx) {
    html += _renderSceneRow(scene, idx, readOnly);
  });

  html += '</div>'; /* end table */

  /* Add scene button */
  if (!readOnly) {
    html += '<button class="script-add-scene-btn" data-action="_addScene">+ Add Scene</button>';
  }
  html += '</div>'; /* end wrapper */
  html += '</div>'; /* end editor */

  container.innerHTML = html;

  /* Bind events */
  if (!readOnly) {
    var titleInput = document.getElementById('scriptTitleInput');
    if (titleInput) {
      titleInput.addEventListener('input', function() {
        state._titleDirty = titleInput.value;
        if (state._currentScriptRow) state._currentScriptRow.title = titleInput.value;
        _scheduleAutoSave();
      });
    }
    _bindSceneEvents();
    _bindDragDrop();
    var scShareBtn = document.getElementById('scShareBtn');
    if (scShareBtn) {
      scShareBtn.addEventListener('click', function() {
        var pop = document.getElementById('scSharePopover');
        _scSyncSharePopover();
        pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
      });
      document.getElementById('scSharePopover').addEventListener('click', function(e) {
        var opt = e.target.closest('.bd-share-opt');
        if (opt) _scSetShareMode(opt.dataset.share);
      });
    }
  }
}

function _scShareLink() {
  return window.location.origin + window.location.pathname + '#shared/' + state._currentScriptRow.share_token;
}

function _scSyncSharePopover() {
  var pop = document.getElementById('scSharePopover');
  if (!pop || !state._currentScriptRow) return;
  var mode = (state._currentScriptRow.share_mode === 'view' || state._currentScriptRow.share_mode === 'edit') ? state._currentScriptRow.share_mode : 'none';
  pop.querySelectorAll('.bd-share-opt').forEach(function(b) { b.classList.toggle('active', b.dataset.share === mode); });
  var links = document.getElementById('scShareLinks');
  if (links) links.innerHTML = mode === 'none' ? '' : _shareLinkRowsHtml(mode, _scShareLink(), _scShareLink() + '/edit');
  var label = document.getElementById('scShareBtnLabel');
  if (label) label.textContent = mode === 'none' ? 'Share' : 'Shared';
}

async function _scSetShareMode(mode) {
  if (mode !== 'none' && !state._currentScriptRow.share_token) {
    _showSaveError('Sharing needs migration 018 — run it in Supabase first');
    return;
  }
  var ok = await db.sbUpdateScript(state._currentScriptId, { share_mode: mode });
  if (!ok) { _showSaveError('Could not change sharing'); return; }
  state._currentScriptRow.share_mode = mode;
  state._scriptsCache.forEach(function(s) { if (s.id === state._currentScriptId) s.share_mode = mode; });
  _scSyncSharePopover();
}

function _renderSceneRow(scene, idx, readOnly) {
  var html = '<div class="script-scene-row" data-scene-id="' + scene.id + '" data-idx="' + idx + '" ' + (readOnly ? '' : 'draggable="true"') + '>';
  html += '<div class="script-col-num">';
  if (!readOnly) html += '<span class="script-drag-handle" title="Drag to reorder">&#x2630;</span>';
  html += '<span class="script-scene-num">' + (idx + 1) + '</span>';
  html += '</div>';

  /* Script text */
  html += '<div class="script-col-script">';
  if (readOnly) {
    html += '<div class="script-cell-readonly">' + (_escHtml(scene.script_text) || '<span style="color:var(--text-secondary);font-style:italic">No script text</span>') + '</div>';
  } else {
    html += '<textarea class="script-cell-textarea" data-field="script_text" data-scene-id="' + scene.id + '" placeholder="Write your script here..." rows="4">' + _escHtml(scene.script_text) + '</textarea>';
  }
  html += '</div>';

  /* Scene description */
  html += '<div class="script-col-scene">';
  if (readOnly) {
    html += '<div class="script-cell-readonly">' + (_escHtml(scene.scene_description) || '<span style="color:var(--text-secondary);font-style:italic">No description</span>') + '</div>';
  } else {
    html += '<textarea class="script-cell-textarea" data-field="scene_description" data-scene-id="' + scene.id + '" placeholder="Describe the scene..." rows="4">' + _escHtml(scene.scene_description) + '</textarea>';
  }
  html += '</div>';

  /* Thumbnail */
  html += '<div class="script-col-thumb">';
  var thumb = _safeThumb(scene.thumbnail_data);
  if (thumb) {
    html += '<div class="script-thumb-preview">';
    html += '<img src="' + _esc(thumb) + '" alt="Scene thumbnail" />';
    if (!readOnly) {
      html += '<button class="script-thumb-remove" data-action="_removeThumb" data-args="' + _args(scene.id) + '" title="Remove thumbnail">&times;</button>';
    }
    html += '</div>';
  } else if (!readOnly) {
    html += '<label class="script-thumb-upload" for="thumbInput_' + scene.id + '">';
    html += '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    html += '<span>Upload image</span>';
    html += '<input type="file" id="thumbInput_' + scene.id + '" accept="image/*" style="display:none" data-change="_handleThumbUpload" data-change-args="' + _args('$el', scene.id) + '" />';
    html += '</label>';
  } else {
    html += '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:16px">No thumbnail</div>';
  }
  html += '</div>';

  /* Actions */
  if (!readOnly) {
    var last = idx >= state._currentScenes.length - 1;
    html += '<div class="script-col-actions">';
    html += '<button class="script-row-action script-row-move" data-action="_moveScene" data-args="' + _args(scene.id, -1) + '" title="Move up"' + (idx === 0 ? ' disabled' : '') + '>' + SKETCHY_ICONS.arrowUp + '</button>';
    html += '<button class="script-row-action script-row-move" data-action="_moveScene" data-args="' + _args(scene.id, 1) + '" title="Move down"' + (last ? ' disabled' : '') + '>' + SKETCHY_ICONS.arrowDown + '</button>';
    html += '<button class="script-row-action" data-action="_deleteSceneRow" data-args="' + _args(scene.id) + '" title="Delete scene">' + SKETCHY_ICONS.trash + '</button>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/* ---- SCENE EVENTS ---- */
function _bindSceneEvents() {
  document.querySelectorAll('.script-cell-textarea').forEach(function(ta) {
    ta.addEventListener('input', function() {
      // State is the source of truth; the DOM is a view of it
      var sceneId = ta.getAttribute('data-scene-id');
      var field = ta.getAttribute('data-field');
      var scene = state._currentScenes.find(function(s) { return s.id === sceneId; });
      if (scene) scene[field] = ta.value;
      if (!state._sceneDirty[sceneId]) state._sceneDirty[sceneId] = {};
      state._sceneDirty[sceneId][field] = ta.value;
      _scheduleAutoSave();
    });
    /* Auto-resize */
    ta.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });
    /* Initial resize */
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  });
}

function _scheduleAutoSave() {
  var indicator = document.getElementById('scriptSaveIndicator');
  if (indicator) { indicator.textContent = 'Saving...'; indicator.style.color = 'var(--amber)'; }
  clearTimeout(state._scriptAutoSaveTimer);
  state._scriptAutoSaveTimer = setTimeout(function() { _flushScriptSaves(); }, 800);
}

// Save only what changed, one batch after another. Returns a promise that
// settles when this batch (and every earlier one) has landed, so callers
// await it before repainting or navigating away.
function _flushScriptSaves() {
  clearTimeout(state._scriptAutoSaveTimer);
  var scriptId = state._currentScriptId;
  var sharedTok = state._sharedScriptToken;
  var title = state._titleDirty; state._titleDirty = null;
  var dirty = state._sceneDirty; state._sceneDirty = {};
  var sceneIds = Object.keys(dirty);
  if (!scriptId || (title === null && !sceneIds.length)) return state._scriptSaveChain;
  state._scriptSaveChain = state._scriptSaveChain.then(async function() {
    var failed = false;
    if (title !== null) {
      var okT = await db.sbUpdateScript(scriptId, { title: title || 'Untitled Script' }, sharedTok);
      if (!okT) { failed = true; if (state._titleDirty === null) state._titleDirty = title; }
    }
    for (var i = 0; i < sceneIds.length; i++) {
      try { await db.sbSaveSceneFields(sceneIds[i], dirty[sceneIds[i]], sharedTok); }
      catch (e) {
        failed = true;
        // Put it back so the next flush retries it (newer edits win)
        state._sceneDirty[sceneIds[i]] = Object.assign({}, dirty[sceneIds[i]], state._sceneDirty[sceneIds[i]] || {});
      }
    }
    var ind = document.getElementById('scriptSaveIndicator');
    if (ind) {
      if (failed) { ind.textContent = 'Error saving'; ind.style.color = 'var(--accent)'; }
      else { ind.textContent = 'Saved'; ind.style.color = 'var(--teal)'; }
    }
  });
  return state._scriptSaveChain;
}

/* ---- ADD / DELETE SCENES ---- */
async function _addScene() {
  var newOrder = state._currentScenes.length;
  var res;
  if (state._sharedScriptToken) {
    var rpcRes = await state._sb.rpc('add_shared_scene', { p_token: state._sharedScriptToken, p_sort_order: newOrder });
    res = { data: rpcRes.data && rpcRes.data[0], error: rpcRes.error };
  } else {
    res = await state._sb.from('script_scenes').insert({ script_id: state._currentScriptId, sort_order: newOrder, script_text: '', scene_description: '', thumbnail_data: '' }).select().single();
  }
  if (res.data) {
    state._currentScenes.push(res.data);
    _scriptRerender();
  } else if (res.error) {
    console.error('add scene err:', res.error);
    _showSaveError('Could not add scene');
  }
}

// Up/down reordering: works on touch, where HTML5 drag-and-drop does not
async function _moveScene(sceneId, dir) {
  var i = state._currentScenes.findIndex(function(s) { return s.id === sceneId; });
  var j = i + dir;
  if (i < 0 || j < 0 || j >= state._currentScenes.length) return;
  await _flushScriptSaves();
  var moved = state._currentScenes.splice(i, 1)[0];
  state._currentScenes.splice(j, 0, moved);
  await db.sbReorderScenes(state._currentScenes);
  _scriptRerender();
}

async function _deleteSceneRow(sceneId) {
  var ok = await db.sbDeleteScene(sceneId);
  if (!ok) return;
  delete state._sceneDirty[sceneId];
  state._currentScenes = state._currentScenes.filter(function(s) { return s.id !== sceneId; });
  /* Reorder remaining */
  await db.sbReorderScenes(state._currentScenes);
  _scriptRerender();
}

/* ---- THUMBNAIL UPLOAD ---- */
function _handleThumbUpload(input, sceneId) {
  var file = input.files && input.files[0];
  if (!file) return;
  /* Limit to 2MB */
  if (file.size > 2 * 1024 * 1024) {
    _showSaveError('Image too large. Max 2MB.');
    return;
  }
  var reader = new FileReader();
  reader.onload = async function(e) {
    var dataUrl = e.target.result;
    /* Resize to max 600px wide for storage efficiency */
    var img = new Image();
    img.onload = async function() {
      var maxW = 600;
      var w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var compressed = canvas.toDataURL('image/jpeg', 0.8);
      await db.sbSaveSceneFields(sceneId, { thumbnail_data: compressed });
      /* Update local cache */
      state._currentScenes.forEach(function(s) { if (s.id === sceneId) s.thumbnail_data = compressed; });
      _scriptRerender();
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

async function _removeThumb(sceneId) {
  await db.sbSaveSceneFields(sceneId, { thumbnail_data: '' });
  state._currentScenes.forEach(function(s) { if (s.id === sceneId) s.thumbnail_data = ''; });
  _scriptRerender();
}

/* ---- DRAG & DROP REORDER ---- */
function _bindDragDrop() {
  var rows = document.querySelectorAll('.script-scene-row[draggable="true"]');
  rows.forEach(function(row) {
    row.addEventListener('dragstart', function(e) {
      state._dragSrcIdx = parseInt(row.getAttribute('data-idx'));
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('script-row-dragging');
    });
    row.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('script-row-dragover');
    });
    row.addEventListener('dragleave', function() {
      row.classList.remove('script-row-dragover');
    });
    row.addEventListener('drop', async function(e) {
      e.preventDefault();
      row.classList.remove('script-row-dragover');
      var targetIdx = parseInt(row.getAttribute('data-idx'));
      if (state._dragSrcIdx === null || state._dragSrcIdx === targetIdx) return;
      /* Reorder array */
      var moved = state._currentScenes.splice(state._dragSrcIdx, 1)[0];
      state._currentScenes.splice(targetIdx, 0, moved);
      await db.sbReorderScenes(state._currentScenes);
      _scriptRerender();
    });
    row.addEventListener('dragend', function() {
      row.classList.remove('script-row-dragging');
      state._dragSrcIdx = null;
    });
  });
}

/* ---- SHARE MODAL ---- */
/* (Old share modal removed — replaced by the board-style popover above) */

/* ---- SHARED SCRIPT VIEWER ---- */
async function renderSharedScript(token, mode) {
  var loadToken = ++state._scriptLoadToken;
  var container = document.getElementById('view-shared-script');
  container.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:300px;border-radius:12px"></div></div>';

  var script = await db.sbFetchScriptByToken(token);
  if (loadToken !== state._scriptLoadToken) return;
  if (!script) {
    // The RPC returns nothing for bad tokens AND for private scripts
    container.innerHTML = '<div style="padding:48px;text-align:center"><h2>Script Not Found</h2><p style="color:var(--text-secondary)">This link is invalid, the script was deleted, or sharing was turned off.</p></div>';
    return;
  }
  var isEdit = mode === 'edit' && script.share_mode === 'edit';
  /* All reads/writes below route through the token-gated RPCs */
  state._sharedScriptToken = String(token).split('?')[0].split('&')[0].trim();
  state._sharedScriptMode = isEdit ? 'edit' : 'view';
  state._currentScriptId = script.id;
  state._currentScriptRow = script;
  var scenes = await db.sbFetchScenes(script.id);
  if (loadToken !== state._scriptLoadToken) return;
  state._currentScenes = scenes;
  _paintSharedEditor();
}

// Paint (or repaint) the shared editor from state
function _paintSharedEditor() {
  var container = document.getElementById('view-shared-script');
  var isEdit = state._sharedScriptMode === 'edit';
  _renderEditorUI(container, state._currentScriptRow, state._currentScenes, !isEdit);

  /* Mark container for edit-mode grid (5 cols) vs read-only (4 cols) */
  if (isEdit) container.classList.add('shared-edit-mode');
  else container.classList.remove('shared-edit-mode');

  /* Add a branded header for shared view */
  var topbar = container.querySelector('.script-editor-topbar');
  if (topbar) {
    var badge = document.createElement('div');
    badge.className = 'script-shared-badge';
    badge.innerHTML = '<svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h17l7 7v17H4z"/><path d="M10 12h6"/><path d="M10 17h12"/><path d="M10 22h12"/></svg> Shared via Arkives';
    topbar.insertBefore(badge, topbar.firstChild);
  }
}

/* ---- SIDE EFFECTS ---- Registered from main.js in a fixed order, not at import time. */
export function __init() {
  // Leaving the page or backgrounding the tab (phones do this constantly)
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') _flushScriptSaves(); });
  window.addEventListener('pagehide', function() { _flushScriptSaves(); });
}

act({ _addScene, _createNewScript, _deleteSceneRow, _deleteScript, _handleThumbUpload, _moveScene, _removeThumb });

export { _addScene, _bindDragDrop, _bindSceneEvents, _createNewScript, _deleteSceneRow, _deleteScript, _flushScriptSaves, _handleThumbUpload, _moveScene, _paintSharedEditor, _removeThumb, _renderEditorUI, _renderSceneRow, _scSetShareMode, _scShareLink, _scSyncSharePopover, _scheduleAutoSave, _scriptRerender, renderScriptEditor, renderScripts, renderSharedScript };
