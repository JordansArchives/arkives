// Arkives — Scripts: list, editor, scenes, thumbnails, sharing.
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { _args, act } from '../lib/actions.js';
import { _esc, _escHtml, _safeThumb } from '../lib/esc.js';
import { SKETCHY_ICONS } from '../lib/icons.js';
import { _shareLinkRowsHtml } from '../lib/share.js';
import { _showSaveError } from '../lib/toast.js';

/* ---- SCENE BLOCKS (025) ----
   The SCENE cell is an ordered list of blocks: a shot (size, angle,
   light, text) or a transition (type, text). A scene saved before 025
   has blocks = null and renders its scene_description as one untagged
   shot block; the first edit writes blocks. scene_description is kept
   as a plain-text mirror so anything reading it still works. */
const SCENE_TAG_LABEL = { shot: 'shot', angle: 'angle', light: 'light', transition: 'transition' };
const SCENE_TAG_PRESETS = {
  shot: ['Extreme wide', 'Wide', 'Medium', 'Medium close-up', 'Close-up', 'Extreme close-up', 'Insert', 'Two-shot'],
  angle: ['Eye level', 'Low', 'High', 'Top-down', 'Dutch', 'Over the shoulder', 'POV', 'Profile'],
  light: ['Daylight', 'Golden hour', 'Overcast', 'Night', 'Practical', 'Key + fill', 'Backlit', 'Silhouette', 'Neon'],
  transition: ['Cut', 'Match cut', 'Smash cut', 'Whip pan', 'J-cut', 'L-cut', 'Dissolve', 'Fade to black', 'Fade from black', 'Hidden cut', 'Speed ramp', 'Zoom']
};
const SCENE_BLOCKS_MAX = 50, SCENE_THUMBS_MAX = 8, SCENE_TAG_MAX = 60;

function _blockTagKey(kind) { return kind === 'transition' ? 'type' : kind; }

// Normalised blocks for a scene (never mutates a legacy scene)
function _sceneBlocks(scene) {
  if (Array.isArray(scene.blocks) && scene.blocks.length) {
    return scene.blocks.map(function(b) {
      var kind = b && b.kind === 'transition' ? 'transition' : 'shot';
      var out = { kind: kind, text: (b && typeof b.text === 'string') ? b.text : '' };
      ['shot', 'angle', 'light', 'type'].forEach(function(k) { if (b && typeof b[k] === 'string' && b[k]) out[k] = b[k].slice(0, SCENE_TAG_MAX); });
      return out;
    });
  }
  return [{ kind: 'shot', text: scene.scene_description || '' }];
}

function _blockTagsText(b) {
  var keys = b.kind === 'transition' ? ['type'] : ['shot', 'angle', 'light'];
  return keys.map(function(k) { return b[k]; }).filter(Boolean).join(' / ');
}

// Plain-text mirror written to scene_description alongside blocks
function _blocksMirror(blocks) {
  return blocks.map(function(b) {
    var tags = _blockTagsText(b);
    var head = b.kind === 'transition' ? ('[Transition' + (tags ? ': ' + tags : '') + ']') : (tags ? '[' + tags + ']' : '');
    return (head ? head + '\n' : '') + (b.text || '');
  }).join('\n\n').trim();
}

// Replace a scene's blocks: state first, dirty-tracked, autosaved
function _sceneSetBlocks(scene, blocks) {
  scene.blocks = blocks;
  scene.scene_description = _blocksMirror(blocks);
  if (!state._sceneDirty[scene.id]) state._sceneDirty[scene.id] = {};
  state._sceneDirty[scene.id].blocks = blocks;
  state._sceneDirty[scene.id].scene_description = scene.scene_description;
  _scheduleAutoSave();
}

// Thumbnails for a scene: the 025 list, else the legacy single column
function _sceneThumbs(scene) {
  if (Array.isArray(scene.thumbnails)) return scene.thumbnails.map(_safeThumb).filter(Boolean);
  var one = _safeThumb(scene.thumbnail_data);
  return one ? [one] : [];
}

// Pill options for a kind: presets, the owner's customs, and anything
// already used in this script (so a collaborator's custom shows too)
function _tagOptions(kind) {
  var out = SCENE_TAG_PRESETS[kind].slice();
  var custom = state.CREATOR && state.CREATOR.sceneTagPresets && state.CREATOR.sceneTagPresets[kind];
  if (Array.isArray(custom)) custom.forEach(function(v) { if (typeof v === 'string' && v && out.indexOf(v) < 0) out.push(v); });
  var key = _blockTagKey(kind);
  (state._currentScenes || []).forEach(function(sc) {
    _sceneBlocks(sc).forEach(function(b) { if (b[key] && out.indexOf(b[key]) < 0) out.push(b[key]); });
  });
  return out;
}


// Repaint the editor from in-memory state (no refetch). Pending edits are
// flushed first so a repaint can never resurrect stale text. The scenes
// list scrolls inside .script-scenes-wrapper, which the repaint replaces,
// so its scroll (and any scrolling ancestor's) is carried across.
async function _scriptRerender() {
  await _flushScriptSaves();
  if (!state._currentScriptRow) return;
  var container = document.getElementById(state._sharedScriptToken ? 'view-shared-script' : 'view-script-editor');
  var oldWrap = container && container.querySelector('.script-scenes-wrapper');
  var innerTop = oldWrap ? oldWrap.scrollTop : 0;
  var outer = [];
  for (var el = container; el; el = el.parentElement) { if (el.scrollTop) outer.push([el, el.scrollTop]); }
  if (state._sharedScriptToken) _paintSharedEditor();
  else _renderEditorUI(container, state._currentScriptRow, state._currentScenes, false);
  var newWrap = container && container.querySelector('.script-scenes-wrapper');
  if (newWrap) newWrap.scrollTop = innerTop;
  outer.forEach(function(p) { p[0].scrollTop = p[1]; });
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
    _bindThumbDrop();
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

  /* Scene blocks */
  html += '<div class="script-col-scene">' + _renderSceneBlocks(scene, readOnly) + '</div>';

  /* Thumbnails */
  html += '<div class="script-col-thumb"' + (readOnly ? '' : ' tabindex="0" aria-label="Scene ' + (idx + 1) + ' images: click, then paste an image"') + '>' + _renderSceneThumbs(scene, readOnly) + '</div>';

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

function _tagPillHtml(scene, bi, kind, value, readOnly) {
  var cls = 'sc-tag sc-tag-' + kind;
  if (!value) {
    if (readOnly) return '';
    return '<button type="button" class="' + cls + ' sc-tag-ghost" data-action="_scPickTag" data-args="' + _args(scene.id, bi, kind, '$el') + '">' + SCENE_TAG_LABEL[kind] + '</button>';
  }
  var inner = '<span class="sc-tag-k">' + SCENE_TAG_LABEL[kind] + '</span>' + _escHtml(value);
  if (readOnly) return '<span class="' + cls + '">' + inner + '</span>';
  return '<button type="button" class="' + cls + '" data-action="_scPickTag" data-args="' + _args(scene.id, bi, kind, '$el') + '">' + inner +
    '<span class="sc-tag-x" data-action="_scClearTag" data-args="' + _args(scene.id, bi, kind) + '" data-stop title="Clear">&times;</span></button>';
}

function _renderSceneBlocks(scene, readOnly) {
  var blocks = _sceneBlocks(scene);
  var html = '<div class="sc-blocks" data-scene-id="' + scene.id + '">';
  blocks.forEach(function(b, bi) {
    html += '<div class="sc-block sc-block-' + b.kind + '" data-bi="' + bi + '">';
    html += '<div class="sc-tags">';
    if (b.kind === 'transition') {
      html += _tagPillHtml(scene, bi, 'transition', b.type, readOnly) || '<span class="sc-tag sc-tag-transition"><span class="sc-tag-k">transition</span></span>';
    } else {
      html += _tagPillHtml(scene, bi, 'shot', b.shot, readOnly) + _tagPillHtml(scene, bi, 'angle', b.angle, readOnly) + _tagPillHtml(scene, bi, 'light', b.light, readOnly);
    }
    if (!readOnly && (blocks.length > 1 || b.kind === 'transition')) {
      html += '<span class="sc-block-tools">';
      html += '<button type="button" class="sc-block-tool" data-action="_scMoveBlock" data-args="' + _args(scene.id, bi, -1) + '" title="Move up"' + (bi === 0 ? ' disabled' : '') + '>' + SKETCHY_ICONS.arrowUp + '</button>';
      html += '<button type="button" class="sc-block-tool" data-action="_scMoveBlock" data-args="' + _args(scene.id, bi, 1) + '" title="Move down"' + (bi === blocks.length - 1 ? ' disabled' : '') + '>' + SKETCHY_ICONS.arrowDown + '</button>';
      html += '<button type="button" class="sc-block-tool sc-block-x" data-action="_scDeleteBlock" data-args="' + _args(scene.id, bi) + '" title="Remove block">&times;</button>';
      html += '</span>';
    }
    html += '</div>';
    var ph = b.kind === 'transition' ? 'Describe the transition...' : 'Describe the scene...';
    if (readOnly) {
      html += '<div class="script-cell-readonly">' + (_escHtml(b.text) || (bi === 0 && blocks.length === 1 ? '<span style="color:var(--text-secondary);font-style:italic">No description</span>' : '')) + '</div>';
    } else {
      html += '<textarea class="script-cell-textarea sc-block-text" data-field="block" data-scene-id="' + scene.id + '" data-bi="' + bi + '" placeholder="' + ph + '" rows="2">' + _escHtml(b.text) + '</textarea>';
    }
    html += '</div>';
  });
  if (!readOnly && blocks.length < SCENE_BLOCKS_MAX) {
    html += '<div class="sc-block-add">';
    html += '<button type="button" class="sc-tag sc-tag-ghost sc-tag-shot" data-action="_scAddBlock" data-args="' + _args(scene.id, 'shot') + '">shot</button>';
    html += '<button type="button" class="sc-tag sc-tag-ghost sc-tag-transition" data-action="_scAddBlock" data-args="' + _args(scene.id, 'transition') + '">transition</button>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function _renderSceneThumbs(scene, readOnly) {
  var thumbs = _sceneThumbs(scene);
  var html = '<div class="sc-thumbs">';
  thumbs.forEach(function(t, ti) {
    html += '<div class="script-thumb-preview">';
    html += '<img src="' + _esc(t) + '" alt="Scene thumbnail ' + (ti + 1) + '" />';
    if (!readOnly) {
      html += '<button class="script-thumb-remove" data-action="_removeThumb" data-args="' + _args(scene.id, ti) + '" title="Remove thumbnail">&times;</button>';
    }
    html += '</div>';
  });
  if (!readOnly && thumbs.length < SCENE_THUMBS_MAX) {
    html += '<label class="script-thumb-upload' + (thumbs.length ? ' sc-thumb-more' : '') + '" for="thumbInput_' + scene.id + '">';
    html += '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    html += '<span>' + (thumbs.length ? 'Add image' : 'Upload, drop or paste') + '</span>';
    html += '<input type="file" id="thumbInput_' + scene.id + '" accept="image/*" multiple style="display:none" data-change="_handleThumbUpload" data-change-args="' + _args('$el', scene.id) + '" />';
    html += '</label>';
  } else if (!thumbs.length) {
    html += '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:16px">No thumbnail</div>';
  }
  html += '</div>';
  return html;
}

/* ---- BLOCK ACTIONS ---- */
function _sceneById(sceneId) { return state._currentScenes.find(function(s) { return s.id === sceneId; }); }

function _scAddBlock(sceneId, kind) {
  var scene = _sceneById(sceneId); if (!scene) return;
  var blocks = _sceneBlocks(scene);
  if (blocks.length >= SCENE_BLOCKS_MAX) return;
  blocks.push({ kind: kind === 'transition' ? 'transition' : 'shot', text: '' });
  _sceneSetBlocks(scene, blocks);
  _scriptRerender().then(function() {
    var ta = document.querySelector('.sc-block-text[data-scene-id="' + sceneId + '"][data-bi="' + (blocks.length - 1) + '"]');
    if (ta) ta.focus();
  });
}

function _scDeleteBlock(sceneId, bi) {
  var scene = _sceneById(sceneId); if (!scene) return;
  var blocks = _sceneBlocks(scene);
  if (blocks[bi] && blocks[bi].text && !confirm('Remove this block and its text?')) return;
  blocks.splice(bi, 1);
  if (!blocks.length) blocks.push({ kind: 'shot', text: '' });
  _sceneSetBlocks(scene, blocks);
  _scriptRerender();
}

function _scMoveBlock(sceneId, bi, dir) {
  var scene = _sceneById(sceneId); if (!scene) return;
  var blocks = _sceneBlocks(scene);
  var j = bi + dir;
  if (bi < 0 || j < 0 || j >= blocks.length) return;
  var moved = blocks.splice(bi, 1)[0];
  blocks.splice(j, 0, moved);
  _sceneSetBlocks(scene, blocks);
  _scriptRerender();
}

function _scSetTag(sceneId, bi, kind, value) {
  var scene = _sceneById(sceneId); if (!scene) return;
  var blocks = _sceneBlocks(scene);
  var b = blocks[bi]; if (!b) return;
  var key = _blockTagKey(kind);
  value = (value || '').trim().slice(0, SCENE_TAG_MAX);
  if (!value || b[key] === value) delete b[key]; else b[key] = value;
  _sceneSetBlocks(scene, blocks);
  _scCloseTagPicker();
  _scriptRerender();
}

function _scClearTag(sceneId, bi, kind) { _scSetTag(sceneId, bi, kind, ''); }

// A custom value: applied to the block, and remembered on the owner's
// profile so it shows in the picker next time. Shared editors cannot
// write the profile; their custom stays on the scene (and still shows
// in this script's picker via _tagOptions).
async function _scSetTagCustom(sceneId, bi, kind, value) {
  value = (value || '').trim().slice(0, SCENE_TAG_MAX);
  if (!value) return;
  if (!state._sharedScriptToken && state.CREATOR && state.CREATOR._sbId && SCENE_TAG_PRESETS[kind].indexOf(value) < 0) {
    var presets = Object.assign({}, state.CREATOR.sceneTagPresets || {});
    var list = Array.isArray(presets[kind]) ? presets[kind].slice() : [];
    if (list.indexOf(value) < 0) {
      list.push(value);
      presets[kind] = list.slice(-100);
      state.CREATOR.sceneTagPresets = presets;
      db.sbUpdateProfile({ scene_tag_presets: presets });
    }
  }
  _scSetTag(sceneId, bi, kind, value);
}

function _scCustomKeydown(ev, sceneId, bi, kind, el) {
  if (ev.key === 'Enter') { ev.preventDefault(); _scSetTagCustom(sceneId, bi, kind, el.value); }
  else if (ev.key === 'Escape') { ev.preventDefault(); _scCloseTagPicker(); }
}

/* ---- TAG PICKER ---- Body-mounted (stacking context), one at a time.
   Desktop: a popover under the pill. Phone: a bottom sheet (CSS). */
function _scPickTag(sceneId, bi, kind, el) {
  var scene = _sceneById(sceneId); if (!scene) return;
  var b = _sceneBlocks(scene)[bi]; if (!b) return;
  var current = b[_blockTagKey(kind)] || '';
  var host = document.getElementById('scTagPickHost');
  if (!host) { host = document.createElement('div'); host.id = 'scTagPickHost'; document.body.appendChild(host); }
  var html = '<div class="sc-pick-overlay" data-action="_scPickBackdrop" data-args="' + _args('$event', '$el') + '">';
  html += '<div class="sc-pick sc-pick-' + kind + '" role="dialog" aria-modal="true" aria-label="' + SCENE_TAG_LABEL[kind] + '">';
  html += '<div class="sc-pick-h"><span>' + (kind === 'transition' ? 'Transition' : (kind === 'shot' ? 'Shot size' : (kind === 'angle' ? 'Camera angle' : 'Lighting'))) + '</span><span>' + (current ? 'click again to clear' : 'one per block') + '</span></div>';
  html += '<div class="sc-pick-grid">';
  _tagOptions(kind).forEach(function(v) {
    html += '<button type="button" class="sc-tag sc-tag-' + kind + (v === current ? ' on' : '') + '" data-action="_scSetTag" data-args="' + _args(sceneId, bi, kind, v) + '">' + _escHtml(v) + '</button>';
  });
  html += '</div>';
  html += '<div class="sc-pick-custom"><span>custom</span><input type="text" maxlength="' + SCENE_TAG_MAX + '" placeholder="type and press Enter" data-keydown="_scCustomKeydown" data-keydown-args="' + _args('$event', sceneId, bi, kind, '$el') + '">';
  html += '<button type="button" class="btn btn-sm" data-action="_scCustomAdd" data-args="' + _args(sceneId, bi, kind, '$el') + '">Add</button></div>';
  html += '<button type="button" class="sc-pick-cancel" data-action="_scCloseTagPicker">Cancel</button>';
  html += '</div></div>';
  host.innerHTML = html;
  // Anchor under the pill on wide screens; the sheet CSS ignores this
  var pop = host.querySelector('.sc-pick');
  if (el && el.getBoundingClientRect && window.innerWidth > 640) {
    var r = el.getBoundingClientRect();
    var left = Math.max(8, Math.min(r.left, window.innerWidth - 332));
    pop.style.left = left + 'px';
    var below = r.bottom + 6;
    pop.style.top = below + 'px';
    requestAnimationFrame(function() {
      var h = pop.offsetHeight;
      if (below + h > window.innerHeight - 8) pop.style.top = Math.max(8, r.top - 6 - h) + 'px';
    });
  }
  var input = host.querySelector('.sc-pick-custom input');
  if (input && window.innerWidth > 640) input.focus();
}

function _scCustomAdd(sceneId, bi, kind, el) {
  var input = el.parentElement.querySelector('input');
  _scSetTagCustom(sceneId, bi, kind, input ? input.value : '');
}

function _scCloseTagPicker() {
  var host = document.getElementById('scTagPickHost');
  if (host) host.innerHTML = '';
}

function _scPickBackdrop(ev, el) { if (ev.target === el) _scCloseTagPicker(); }

/* ---- SCENE EVENTS ---- */
function _bindSceneEvents() {
  document.querySelectorAll('.script-cell-textarea').forEach(function(ta) {
    ta.addEventListener('input', function() {
      // State is the source of truth; the DOM is a view of it
      var sceneId = ta.getAttribute('data-scene-id');
      var field = ta.getAttribute('data-field');
      var scene = state._currentScenes.find(function(s) { return s.id === sceneId; });
      if (field === 'block') {
        // One block's text changed: rewrite the scene's block list + mirror
        if (!scene) return;
        var blocks = _sceneBlocks(scene);
        var b = blocks[parseInt(ta.getAttribute('data-bi'), 10)];
        if (!b) return;
        b.text = ta.value;
        _sceneSetBlocks(scene, blocks);
        return;
      }
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

/* ---- THUMBNAILS ---- A scene holds up to SCENE_THUMBS_MAX images
   (025). Saving writes the list and clears the legacy single column so
   an image never renders twice. */
function _readThumbFile(file) {
  return new Promise(function(resolve) {
    // Every image is shrunk to 600px wide below, so the input cap only guards memory
    if (!file || file.size > 20 * 1024 * 1024) { _showSaveError('Image too large. Max 20MB.'); return resolve(''); }
    var reader = new FileReader();
    reader.onload = function(e) {
      /* Resize to max 600px wide for storage efficiency */
      var img = new Image();
      img.onload = function() {
        var maxW = 600;
        var w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = function() { _showSaveError('Could not read that image'); resolve(''); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function _saveThumbs(sceneId, thumbs) {
  try { await db.sbSaveSceneFields(sceneId, { thumbnails: thumbs, thumbnail_data: '' }); }
  catch (e) { _showSaveError('Could not save thumbnails'); return false; }
  state._currentScenes.forEach(function(s) { if (s.id === sceneId) { s.thumbnails = thumbs; s.thumbnail_data = ''; } });
  return true;
}

async function _handleThumbUpload(input, sceneId) {
  var files = Array.prototype.slice.call(input.files || []);
  input.value = '';
  await _addThumbFiles(sceneId, files);
}

// Shared by the file picker and drag & drop: non-images are ignored
async function _addThumbFiles(sceneId, files) {
  var scene = _sceneById(sceneId); if (!scene) return;
  files = files.filter(function(f) { return f && /^image\//.test(f.type); });
  if (!files.length) return;
  var thumbs = _sceneThumbs(scene);
  var room = SCENE_THUMBS_MAX - thumbs.length;
  if (files.length > room) _showSaveError('Up to ' + SCENE_THUMBS_MAX + ' images per scene');
  for (var i = 0; i < Math.min(files.length, room); i++) {
    var t = await _readThumbFile(files[i]);
    if (t) thumbs.push(t);
  }
  if (await _saveThumbs(sceneId, thumbs)) _scriptRerender();
}

async function _removeThumb(sceneId, ti) {
  var scene = _sceneById(sceneId); if (!scene) return;
  var thumbs = _sceneThumbs(scene);
  thumbs.splice(typeof ti === 'number' ? ti : 0, 1);
  if (await _saveThumbs(sceneId, thumbs)) _scriptRerender();
}

/* ---- DRAG & DROP IMAGES ---- Dropping image files on a scene's
   thumbnail cell adds them. Row reordering drags carry no files and
   pass through to the row handlers below. */
function _hasFiles(e) { return !!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0); }

function _bindThumbDrop() {
  document.querySelectorAll('.script-scene-row .script-col-thumb').forEach(function(cell) {
    var row = cell.closest('.script-scene-row');
    var sceneId = row && row.getAttribute('data-scene-id');
    if (!sceneId) return;
    cell.addEventListener('dragover', function(e) {
      if (!_hasFiles(e)) return;
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      cell.classList.add('sc-thumb-dropover');
    });
    cell.addEventListener('dragleave', function(e) {
      if (!cell.contains(e.relatedTarget)) cell.classList.remove('sc-thumb-dropover');
    });
    cell.addEventListener('drop', function(e) {
      if (!_hasFiles(e)) return;
      e.preventDefault(); e.stopPropagation();
      cell.classList.remove('sc-thumb-dropover');
      var files = Array.prototype.slice.call(e.dataTransfer.files || []);
      if (!files.some(function(f) { return /^image\//.test(f.type); })) { _showSaveError('Drop an image file'); return; }
      _addThumbFiles(sceneId, files);
    });
  });
}

/* ---- PASTE IMAGES ---- An image on the clipboard goes to the scene
   whose thumbnail cell is focused or hovered, else the scene whose text
   is being edited. Text pastes are never touched. */
function _clipboardImages(e) {
  var items = (e.clipboardData && e.clipboardData.items) || [];
  var out = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].kind === 'file' && /^image\//.test(items[i].type)) { var f = items[i].getAsFile(); if (f) out.push(f); }
  }
  return out;
}

function _pasteTargetScene() {
  var editable = function(row) { return row && row.getAttribute('draggable') === 'true' ? row.getAttribute('data-scene-id') : null; };
  var active = document.activeElement;
  var fromFocus = active && active.closest && editable(active.closest('.script-scene-row'));
  if (fromFocus) return fromFocus;
  var hovered = document.querySelector('.script-scene-row .script-col-thumb:hover');
  return hovered ? editable(hovered.closest('.script-scene-row')) : null;
}

function _onScriptPaste(e) {
  if (!state._currentScriptRow) return;
  var files = _clipboardImages(e);
  if (!files.length) return;
  // Clipboard text alongside the image (e.g. copied from a web page) still pastes into a text box
  var active = document.activeElement;
  var hasText = e.clipboardData && e.clipboardData.getData('text/plain');
  if (hasText && active && /^(TEXTAREA|INPUT)$/.test(active.tagName)) return;
  var sceneId = _pasteTargetScene();
  if (!sceneId) return;
  e.preventDefault();
  var cell = document.querySelector('.script-scene-row[data-scene-id="' + sceneId + '"] .script-col-thumb');
  if (cell) { cell.classList.add('sc-thumb-dropover'); setTimeout(function() { cell.classList.remove('sc-thumb-dropover'); }, 400); }
  _addThumbFiles(sceneId, files);
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
      e.preventDefault(); // also stops a file dropped off-target from opening in the tab
      if (state._dragSrcIdx === null || state._dragSrcIdx === undefined) { e.dataTransfer.dropEffect = 'none'; return; }
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
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') _scCloseTagPicker(); });
  document.addEventListener('paste', _onScriptPaste);
  // Leaving the page or backgrounding the tab (phones do this constantly)
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') _flushScriptSaves(); });
  window.addEventListener('pagehide', function() { _flushScriptSaves(); });
}

act({ _addScene, _createNewScript, _deleteSceneRow, _deleteScript, _handleThumbUpload, _moveScene, _removeThumb,
  _scAddBlock, _scClearTag, _scCloseTagPicker, _scCustomAdd, _scCustomKeydown, _scDeleteBlock, _scMoveBlock, _scPickBackdrop, _scPickTag, _scSetTag });

export { SCENE_TAG_PRESETS, _addThumbFiles, _onScriptPaste, _pasteTargetScene, _blocksMirror, _sceneBlocks, _sceneThumbs, _scCloseTagPicker, _scPickTag, _scSetTag, _tagOptions, _addScene, _bindDragDrop, _bindSceneEvents, _createNewScript, _deleteSceneRow, _deleteScript, _flushScriptSaves, _handleThumbUpload, _moveScene, _paintSharedEditor, _removeThumb, _renderEditorUI, _renderSceneRow, _scSetShareMode, _scShareLink, _scSyncSharePopover, _scheduleAutoSave, _scriptRerender, renderScriptEditor, renderScripts, renderSharedScript };
