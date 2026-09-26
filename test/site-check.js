/**
 * Static consistency check for the multi-page JustProtex site. No dependencies.
 *   node test/site-check.js
 *
 * Verifies, for every .html page:
 *   1. every local href/src points at a file that exists (and #fragments exist in the target page)
 *   2. the announcement bar + header + footer are identical on every page (after normalising
 *      the ../ prefix used inside services/)
 *   3. required structure: one <h1>, <main id="main">, data-page, unique ids, script load order
 *   4. each service page has hero, intro, features, use cases and a quote CTA
 *   5. every service linked from the dropdown exists and marks itself as current
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (['node_modules', 'test'].includes(e.name) ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
const pages = walk(ROOT).filter((f) => f.endsWith('.html')).sort();

let passed = 0, failed = 0;
const check = (label, cond, detail = '') => {
  if (cond) { passed++; } else { failed++; console.log(`  FAIL - ${label}${detail ? '\n         ' + detail : ''}`); }
};
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const src = Object.fromEntries(pages.map((p) => [rel(p), fs.readFileSync(p, 'utf8')]));
const idsOf = (h) => [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

console.log(`Checking ${pages.length} pages...\n`);
check('12 pages exist (5 top-level + services index + 6 services)', pages.length === 12, `found ${pages.length}`);

// ---- 1. links and anchors ----
for (const [name, html] of Object.entries(src)) {
  const dir = path.dirname(path.join(ROOT, name));
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:)/.test(url)) continue;
    const [file, frag] = url.split('#');
    let targetName = name, targetHtml = html;
    if (file) {
      const target = path.join(dir, file.split('?')[0]);
      check(`${name}: "${url}" resolves to a file`, fs.existsSync(target));
      if (!fs.existsSync(target)) continue;
      targetName = rel(target);
      targetHtml = fs.readFileSync(target, 'utf8');
    }
    if (frag) {
      check(`${name}: "${url}" points at an existing id in ${targetName}`, idsOf(targetHtml).includes(frag) || targetName.endsWith('.js'));
    }
  }
}

// ---- 2. shared chrome identical everywhere ----
const chrome = (html, isSub) => {
  const start = html.indexOf('<div class="bg-slate-950 text-xs text-slate-300">');
  const end = html.indexOf('</header>') + '</header>'.length;
  const fs_ = html.indexOf('<footer');
  const fe = html.indexOf('</footer>') + '</footer>'.length;
  const fl = html.indexOf('<div class="fixed bottom-5 right-4');
  const fle = html.indexOf('</div>\n  </div>', fl);
  let parts = [html.slice(start, end), html.slice(fs_, fe), html.slice(fl, fle)];
  if (isSub) parts = parts.map((p) => p.replace(/(href|src)="\.\.\//g, '$1="'));
  return parts;
};
const baseline = chrome(src['index.html'], false);
['header', 'footer', 'floating buttons'].forEach((n, i) => check(`baseline ${n} was extracted`, baseline[i].length > 500 || n === 'floating buttons' && baseline[i].length > 200));
for (const [name, html] of Object.entries(src)) {
  const parts = chrome(html, name.startsWith('services/'));
  ['announcement bar + header', 'footer', 'floating call/WhatsApp buttons'].forEach((n, i) =>
    check(`${name}: ${n} identical to index.html`, parts[i] === baseline[i]));
}

// ---- 3. structure ----
for (const [name, html] of Object.entries(src)) {
  const sub = name.startsWith('services/');
  check(`${name}: exactly one <h1>`, (html.match(/<h1[\s>]/g) || []).length === 1);
  check(`${name}: has <main id="main">`, html.includes('<main id="main">'));
  check(`${name}: <body> has data-page`, /<body[^>]*data-page="[a-z]+"/.test(html));
  const ids = idsOf(html);
  const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
  check(`${name}: no duplicate ids`, dupes.length === 0, dupes.join(', '));
  const prefix = sub ? '../' : '';
  const order = [`<script src="${prefix}js/theme-init.js">`, 'cdn.tailwindcss.com', `<script src="${prefix}js/tailwind-config.js">`, `${prefix}css/styles.css`,
                 'unpkg.com/lucide', 'aos.js', `<script src="${prefix}js/app.js">`].map((s) => html.indexOf(s));
  check(`${name}: scripts load in the required order`, order.every((n, i) => n > -1 && (i === 0 || n > order[i - 1])), order.join(','));
  check(`${name}: app.js is the last script`, html.lastIndexOf('<script') === html.indexOf(`<script src="${prefix}js/app.js">`));
  check(`${name}: needs no ids app.js hard-requires missing`, ['menu-btn', 'mobile-menu', 'theme-toggle', 'services-toggle', 'services-menu', 'm-services'].every((id) => ids.includes(id)));
}

// ---- 4 + 5. service pages and the dropdown ----
const dropdownSlugs = [...src['index.html'].matchAll(/data-nav-service="([a-z-]+)"/g)].map((m) => m[1]);
const services = [...new Set(dropdownSlugs)].filter((s) => s !== 'index');
check('dropdown lists the six services', services.length === 6, services.join(', '));
const names = [...src['index.html'].matchAll(/<span class="block text-sm font-semibold">([^<]+)<\/span>/g)].map((m) => m[1]);
check('dropdown labels match the brief', JSON.stringify(names) === JSON.stringify(['Access Control System', 'CCTV Installation', 'Biometric Installation', 'Home Automation', 'EPABX Installation', 'Boom Barrier']), names.join(' | '));
const navOrder = [...src['index.html'].slice(src['index.html'].indexOf('<ul class="hidden items-center gap-8')).matchAll(/data-nav="([a-z]+)"/g)].map((m) => m[1]).slice(0, 6);
check('desktop nav order is Home, About, Services, Shop, Why, Contact', JSON.stringify(navOrder) === JSON.stringify(['home', 'about', 'services', 'shop', 'why', 'contact']), navOrder.join(','));
for (const slug of services) {
  const n = `services/${slug}.html`;
  const h = src[n];
  check(`${n}: exists`, !!h);
  if (!h) continue;
  check(`${n}: body marks itself with data-service-page="${slug}"`, h.includes(`data-service-page="${slug}"`));
  check(`${n}: hero banner`, h.includes('viewfinder') || h.includes('Viewfinder corners'));
  check(`${n}: intro, features, use cases sections`, h.includes("What's included") && h.includes('Features and benefits') && h.includes("Where it's used"));
  check(`${n}: 6 features and 6 use cases`, (h.match(/rounded-2xl bg-white p-6 shadow-sm/g) || []).length === 6 && (h.split("Where it's used")[1].match(/<li class="flex gap-4">/g) || []).length === 6);
  check(`${n}: CTA links to the quote form`, h.includes(`contact.html?service=`) && /Get a free quote/.test(h));
  check(`${n}: Service JSON-LD present`, h.includes('"@type": "Service"'));
}
check('services/index.html shows all six service cards', (src['services/index.html'].match(/data-service="/g) || []).length === 6);
check('index.html teaser shows all six service cards linking to services/', services.every((s) => src['index.html'].includes(`href="services/${s}.html"`)));
check('shop has 13 products and 5 filter chips', (src['shop.html'].match(/data-category="/g) || []).length === 13 && (src['shop.html'].match(/data-filter="/g) || []).length === 5);
check('contact.html contains the lead form with the same ids as the homepage', ['lead-form', 'f-name', 'f-phone', 'f-email', 'f-req', 'err-name', 'err-phone', 'err-email', 'lead-success', 'lead-reset', 'submit-btn', 'submit-label', 'form-error', 'quote'].every((id) => idsOf(src['contact.html']).includes(id)));

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed ? 1 : 0);
