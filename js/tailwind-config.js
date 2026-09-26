/* =============================================================================
   JustProtex — tailwind-config.js
   Extracted from the original inline <script> that followed the Tailwind
   CDN <script src="https://cdn.tailwindcss.com"> tag.

   IMPORTANT: in index.html this file MUST be loaded with a plain
   <script src="js/tailwind-config.js"></script> tag placed immediately
   after the Tailwind CDN script tag, and before any markup that depends on
   the custom "ink" colors or the "sans" font stack. The Tailwind Play CDN
   reads `window.tailwind.config` synchronously right after its own script
   runs, so the order (CDN script → this file) must not change.
   ============================================================================= */
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      colors: {
        ink: { 900: '#0B192C', 950: '#07111F' }
      }
    }
  }
};
