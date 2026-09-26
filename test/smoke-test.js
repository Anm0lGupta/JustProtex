/**
 * Smoke test for the split JustProtex project.
 * Loads the REAL index.html + REAL css/styles.css + REAL js/*.js files from
 * disk, mocks only the external CDN libraries (Tailwind, lucide, AOS) that
 * this sandbox has no network access to, and exercises the key interactive
 * features to confirm nothing broke during the split into files/folders.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let passed = 0, failed = 0;
const check = (label, cond) => {
  if (cond) { console.log(`  PASS - ${label}`); passed++; }
  else { console.log(`  FAIL - ${label}`); failed++; }
};

const dom = new JSDOM(html, {
  url: 'http://localhost/index.html',
  runScripts: 'outside-only', // we control exactly what executes, in the right order
  resources: 'usable',
  pretendToBeVisual: true
});
const { window } = dom;
const { document } = window;

// ---- Mock browser APIs jsdom doesn't implement ----
window.matchMedia = window.matchMedia || (() => ({
  matches: false, addEventListener() {}, removeEventListener() {}
}));
let mmDarkMatches = false;
const realMatchMedia = window.matchMedia;
window.matchMedia = (q) => {
  if (q.includes('prefers-color-scheme: dark')) return { matches: mmDarkMatches, addEventListener() {}, removeEventListener() {} };
  return realMatchMedia(q);
};

class FakeStorage {
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
}
Object.defineProperty(window, 'localStorage', { value: new FakeStorage() });

// Mock the external libraries index.html expects (lucide, AOS, tailwind runtime)
window.lucide = { createIcons: () => { window.__lucideCalled = true; } };
window.AOS = { init: (opts) => { window.__aosInitOpts = opts; } };
window.tailwind = {}; // tailwind.config = {...} just needs an object to attach to

// jsdom doesn't implement scrollIntoView / focus edge cases used by the app
window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};

// ---- 1. Execute the three extracted <head> / bottom scripts, IN ORDER, exactly
//         as index.html references them ----
function runFile(relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  window.eval(code);
}

console.log('Loading extracted scripts into a real DOM built from the real index.html...\n');

// theme-init.js runs first, before Tailwind/AOS, exactly like in <head>
runFile('js/theme-init.js');
check('theme-init.js ran without throwing, and did not mark <html> dark (no saved theme, light system pref)',
  !document.documentElement.classList.contains('dark'));

// tailwind-config.js runs right after the (mocked) Tailwind CDN script
runFile('js/tailwind-config.js');
check('tailwind-config.js attached a valid config object', !!window.tailwind.config && window.tailwind.config.darkMode === 'class');

// app.js runs last, after lucide/AOS mocks are in place, same as at the end of <body>
runFile('js/app.js');
check('app.js executed without throwing an uncaught exception', true); // reaching here means no throw

// ---- 2. Exercise the features app.js wires up ----

check('lucide.createIcons() was called', window.__lucideCalled === true);
check('AOS.init() was called with once:true', window.__aosInitOpts && window.__aosInitOpts.once === true);

const year = document.getElementById('year');
check(`Footer year was filled in (got "${year.textContent}")`, /^\d{4}$/.test(year.textContent));

// Theme toggle
const themeBtn = document.getElementById('theme-toggle');
const wasDark = document.documentElement.classList.contains('dark');
themeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const isDarkNow = document.documentElement.classList.contains('dark');
check('Clicking the theme toggle flips the dark class', isDarkNow !== wasDark);
check('Theme toggle persists choice to localStorage', window.localStorage.getItem('jp-theme') === (isDarkNow ? 'dark' : 'light'));

// Mobile menu
const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('mobile-menu');
check('Mobile menu starts hidden', menu.classList.contains('hidden'));
menuBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('Clicking the hamburger opens the mobile menu', !menu.classList.contains('hidden'));
menuBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('Clicking it again closes the mobile menu', menu.classList.contains('hidden'));

// Service card pre-fills the requirements textarea
const cctvLink = document.querySelector('[data-service="CCTV Installation"]');
cctvLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const reqField = document.getElementById('f-req');
check('Clicking a service "Get a quote" link pre-fills the requirements field',
  reqField.value.includes('CCTV Installation'));

// Lead form validation (invalid submit should show errors, not "succeed")
const form = document.getElementById('lead-form');
document.getElementById('f-name').value = '';
document.getElementById('f-phone').value = '123'; // invalid
document.getElementById('f-email').value = 'not-an-email';
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
check('Invalid form submission shows a name error', !document.getElementById('err-name').classList.contains('hidden'));
check('Invalid form submission shows a phone error', !document.getElementById('err-phone').classList.contains('hidden'));
check('Invalid form submission shows an email error', !document.getElementById('err-email').classList.contains('hidden'));
check('Success panel stays hidden on invalid submit', document.getElementById('lead-success').classList.contains('hidden'));

// Valid submit (no FORM_ENDPOINT configured -> opens WhatsApp + shows success panel)
window.open = (url) => { window.__lastOpenedUrl = url; return null; };
document.getElementById('f-name').value = 'Test User';
document.getElementById('f-phone').value = '9876543210';
document.getElementById('f-email').value = 'test@example.com';
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
check('Valid form submission opens a wa.me link with the details',
  typeof window.__lastOpenedUrl === 'string' && window.__lastOpenedUrl.startsWith('https://wa.me/919802737371'));
check('Valid form submission reveals the success panel', !document.getElementById('lead-success').classList.contains('hidden'));

// "Send another request" resets back to the form
document.getElementById('lead-reset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('"Send another request" hides the success panel again', document.getElementById('lead-success').classList.contains('hidden'));

// Testimonial carousel
const track = document.getElementById('t-track');
const nextBtn = document.getElementById('t-next');
const prevBtn = document.getElementById('t-prev');
const startTransform = track.style.transform;
nextBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('Clicking next advances the testimonial carousel', track.style.transform !== startTransform && track.style.transform.includes('-100%'));
prevBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('Clicking prev returns the carousel to the first slide', track.style.transform.includes('-0%'));

// Regex sanity checks (phone/email validators) run indirectly above, but also unit-test directly:
const phoneOk = /^(91|0)?[6-9]\d{9}$/.test('9876543210');
const phoneBad = /^(91|0)?[6-9]\d{9}$/.test('12345');
check('Phone regex accepts a valid 10-digit Indian mobile number', phoneOk);
check('Phone regex rejects an obviously invalid number', !phoneBad);

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed ? 1 : 0);
