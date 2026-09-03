// Theme before first paint: the saved choice, else the OS preference.
// Loaded synchronously from <head> (no defer) so there is no flash. Kept
// external because the Content-Security-Policy forbids inline scripts.
(function () {
  var t = null;
  try { t = localStorage.getItem('arkives-theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') {
    t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
})();
