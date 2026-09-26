/* =============================================================================
   JustProtex — theme-init.js
   Extracted from the original inline <script> at the very top of <head>.

   IMPORTANT: this file must stay a plain, render-blocking <script src="...">
   (no `defer` / `async`) and must load BEFORE the rest of <head>/<body>.
   Its whole job is to add/remove the `dark` class on <html> before the
   browser paints anything, so returning visitors never see a flash of the
   wrong theme. Deferring it or moving it later would reintroduce that flash.
   ============================================================================= */
(function () {
  try {
    var saved = localStorage.getItem('jp-theme');
    var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
