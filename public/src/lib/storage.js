// Arkives — Safe localStorage wrapper (works in sandboxed iframes).


/* ---- SAFE STORAGE (works in sandboxed iframes) ---- */
const _memStore = {};
const _ls = (function(){ try { return window['local'+'Storage']; } catch(e){ return null; } })();
function safeGet(key) {
  try { if(_ls){ const v = _ls.getItem(key); if (v !== null) return v; } } catch(e) {}
  return _memStore[key] || null;
}
function safeSet(key, val) {
  _memStore[key] = val;
  try { if(_ls) _ls.setItem(key, val); } catch(e) {}
}

export { _ls, _memStore, safeGet, safeSet };
