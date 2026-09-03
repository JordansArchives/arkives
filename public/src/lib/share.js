// Arkives — Share popover plumbing shared by Boards and Scripts.


/* ---- SHARE POPOVER PLUMBING (shared by Boards and Scripts) ---- */

/* Link rows for a share popover: one row when mode=view, labeled
   view + edit rows when mode=edit. Copy handled by the global
   .bd-share-copy listener below. */
function _shareLinkRowsHtml(mode, viewLink, editLink) {
  function row(link) {
    return '<div class="bd-share-linkrow"><input type="text" readonly value="' + link + '">' +
      '<button class="btn btn-primary bd-share-copy" data-link="' + link + '">Copy</button></div>';
  }
  if (mode === 'edit') {
    return '<div class="bd-share-linklabel">View link</div>' + row(viewLink) +
           '<div class="bd-share-linklabel">Edit link</div>' + row(editLink);
  }
  return row(viewLink);
}

/* ---- SIDE EFFECTS ---- Registered from main.js in a fixed order, not at import time. */
export function __init() {
  document.addEventListener('click', function(e) {
    /* Click outside a share popover closes it (both Boards and Scripts) */
    ['scSharePopover', 'bdSharePopover'].forEach(function(id) {
      var pop = document.getElementById(id);
      if (pop && pop.style.display !== 'none' &&
          !e.target.closest('#' + id + ', #scShareBtn, #bdShareBtn')) {
        pop.style.display = 'none';
      }
    });
    var btn = e.target.closest('.bd-share-copy');
    if (!btn) return;
    var link = btn.getAttribute('data-link');
    navigator.clipboard.writeText(link).then(function() {
      btn.textContent = 'Copied';
      setTimeout(function() { btn.textContent = 'Copy'; }, 1400);
    }).catch(function() {
      var input = btn.parentElement.querySelector('input');
      if (input) { input.select(); document.execCommand('copy'); }
    });
  });
}

export { _shareLinkRowsHtml };
