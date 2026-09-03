// Arkives — Escaping and validation helpers for HTML rendering.


/* Utility: escape for HTML attribute values */
function _esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Scene thumbnails are data URLs the client made; anything else (a crafted
// value written through a shared edit link) renders as "no thumbnail".
function _safeThumb(v) {
  return (typeof v === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(v)) ? v : '';
}

function _escHtml(str) {
  if (!str) return '';
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export { _esc, _escHtml, _safeThumb };
