/* Breach Escape: sets the colour theme before the first paint, so the page never flashes the wrong theme.
   Loaded as a normal (blocking) script in <head>, before the stylesheet. The saved choice ('breach-escape-theme')
   wins; otherwise the device setting (prefers-color-scheme) decides. app.js handles the toggle. */
(function () {
  var t = null;
  try { t = localStorage.getItem('breach-escape-theme'); } catch (e) { /* storage unavailable */ }
  if (t !== 'light' && t !== 'dark') t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
})();
