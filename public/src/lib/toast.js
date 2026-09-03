// Arkives — Toasts: success, error and the undo toast.
import { state } from '../state.js';


// Toast helper (used by Settings + Contracts)
function showToast(msg, type) {
  if (type === 'error') return _showSaveError(msg);
  var el = document.getElementById('sb-save-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sb-save-toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2A6B5A;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-family:var(--font-body,sans-serif);z-index:10000;opacity:0;transition:opacity 0.3s;pointer-events:none;max-width:90vw;text-align:center;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = '#2A6B5A';
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(function() { el.style.opacity = '0'; }, 2000);
}

/* ---- SAVE STATUS TOAST ---- */
function _showSaveError(msg) {
  var el = document.getElementById('sb-save-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sb-save-toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#C73539;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-family:var(--font-body,sans-serif);z-index:10000;opacity:0;transition:opacity 0.3s;pointer-events:none;max-width:90vw;text-align:center;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = '#C73539';
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(function() { el.style.opacity = '0'; }, 4000);
}
function _showUndoToast(msg, onUndo) {
  var el = document.getElementById('undo-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'undo-toast';
    el.className = 'undo-toast';
    document.body.appendChild(el);
  }
  el.innerHTML = '<span class="undo-toast-msg"></span><button type="button" class="undo-toast-btn">Undo</button>';
  el.querySelector('.undo-toast-msg').textContent = msg;
  el.querySelector('.undo-toast-btn').addEventListener('click', function() {
    clearTimeout(state._undoToastTimer);
    el.classList.remove('show');
    if (onUndo) onUndo();
  });
  el.classList.add('show');
  clearTimeout(state._undoToastTimer);
  state._undoToastTimer = setTimeout(function() { el.classList.remove('show'); }, 5000);
}

function _showSaveSuccess() {
  var el = document.getElementById('sb-save-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sb-save-toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2A6B5A;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-family:var(--font-body,sans-serif);z-index:10000;opacity:0;transition:opacity 0.3s;pointer-events:none;max-width:90vw;text-align:center;';
    document.body.appendChild(el);
  }
  el.textContent = 'Saved';
  el.style.background = '#2A6B5A';
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(function() { el.style.opacity = '0'; }, 1500);
}

export { _showSaveError, _showSaveSuccess, _showUndoToast, showToast };
