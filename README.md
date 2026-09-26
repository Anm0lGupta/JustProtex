# JustProtex Website — Multi-Page Expansion (README)

This document explains what changed when the site grew from a single
`index.html` into a 12-page site, why it was built this way, and how it was
tested. It's written so that another person **or another LLM** picking this
up later can understand the codebase and safely make changes.

If you're looking for the earlier single-file → folder split (the one that
produced `css/`, `js/theme-init.js`, `js/tailwind-config.js`, the original
`js/app.js`), that work is unchanged in spirit — this document only covers
what's new. The short version: same stack (Tailwind Play CDN, lucide, AOS,
no build step), same look, now spread across more pages with one shared
header/footer/nav.

---

## 1. What was added

```
justprotex-website/
├── index.html                 # Home — hero, a 6-card services TEASER, why-us teaser, app promo, reviews
├── about.html                 # NEW — company story, certifications, milestones, team
├── shop.html                  # NEW — product catalog with category filter chips, "Enquire" CTAs
├── why-choose-us.html         # NEW — full "why us" content + process + stats
├── contact.html                # NEW — the lead-quote form (moved here) + office info + embedded map
├── css/styles.css             # Extended: nav current-page states, dropdown chevron, shop filter chips
├── js/app.js                  # Extended: shared by all 12 pages (see §3)
├── js/theme-init.js           # Unchanged
├── js/tailwind-config.js      # Unchanged
├── services/
│   ├── index.html             # NEW — "All Services" landing page, all 6 services as full cards
│   ├── access-control.html    # NEW
│   ├── cctv-installation.html # NEW
│   ├── biometric-installation.html  # NEW
│   ├── home-automation.html   # NEW
│   ├── epabx-installation.html      # NEW
│   └── boom-barrier.html      # NEW
└── test/
    ├── smoke-test.js          # Unchanged — still the original single-page jsdom smoke test
    └── site-check.js          # NEW — static consistency check across all 12 pages (see §4)
```

**The lead-quote form moved from the homepage hero to `contact.html`.** The
homepage still has its own hero (image, headline, stats) but the actual
`<form id="lead-form">` now lives at `contact.html#quote`. Every "Get a Free
Quote" link across the site (header, footer, service pages, shop) points at
`contact.html#quote` (or `../contact.html#quote` from inside `services/`).
`js/app.js` checks `document.getElementById('quote')` on load: on
`contact.html` itself (and nowhere else) it rewrites those links to a plain
`#quote` so the button scrolls instead of reloading.

## 2. New global navigation

Every page shares one header:

```
Home | About Us | All Services ▾ | Shop | Why Choose Us | Contact
```

**"All Services" dropdown** lists the six services from the brief (Access
Control System, CCTV Installation, Biometric Installation, Home Automation,
EPABX Installation, Boom Barrier), plus a "View all services" link to
`services/index.html`.

Behavior (all in `js/app.js`, see the `Desktop "All Services" dropdown`
block — it's heavily commented in place):
- **Desktop, hover-capable devices:** opens on `mouseenter`, closes ~150ms
  after `mouseleave` (small delay so moving the mouse into the panel
  doesn't close it). Clicking while it's open-via-hover "pins" it open;
  clicking again closes it.
- **Touch / no-hover devices:** tap the button to toggle (detected via
  `matchMedia('(hover: hover) and (pointer: fine)')`).
- **Keyboard:** `Enter`/`Space` or `ArrowDown` on the button opens it and
  moves focus to the first item; `ArrowUp`/`ArrowDown` move between items;
  `Home`/`End` jump to the first/last item; `Escape` closes it and returns
  focus to the button; tabbing out of the whole widget closes it.
- **Outside click/tap:** closes it (listens for `pointerdown` on
  `document`, not `click`, so it fires the same way on touch and mouse).
- **On mobile:** there's no flyout — instead, inside the hamburger menu,
  "All Services" is a `<button data-accordion-toggle>` that expands/
  collapses a nested `<ul>` of the same six links. On a service page, the
  accordion starts pre-expanded so the visitor can see where they are.

**Current-page highlighting:** every nav link carries `data-nav="home|
about|services|shop|why|contact"`; service-specific links (in the dropdown,
the accordion, and the footer) carry `data-nav-service="<slug>"`. Each page's
`<body>` declares `data-page="…"` and, on service pages, `data-service-page=
"<slug>"`. On load, `js/app.js` matches these and sets `aria-current` on the
matching link(s); `css/styles.css` styles `[aria-current]` (color + underline
on desktop, a tinted background on mobile/dropdown rows).

## 3. `js/app.js` is now one shared file across all 12 pages

Rather than maintaining 12 near-duplicate scripts, one `js/app.js` (`../js/
app.js` from inside `services/`) is loaded last on every page, exactly as
before. Because different pages have different elements, every
page-specific block is **guarded** — it checks the element exists before
wiring it up:

| Feature | Guard | Present on |
|---|---|---|
| Header, theme toggle, mobile menu, dropdown/accordion, footer year | none (always run) | every page |
| Lead form (validation, submit, WhatsApp fallback) | `if (form)` where `form = $('#lead-form')` | `index.html`, `contact.html` |
| Testimonial carousel | `if (carousel && track)` | `index.html` only |
| Shop category filter | `if (filterBtns.length)` | `shop.html` only |
| Hero clock (`#osd-time`) | `if (osd)` | any page with the camera-feed hero (home + all banners) |

This means **the ids and structure must stay in sync with these guards** —
if you rename `#lead-form` on `contact.html`, the form stops working there,
silently (no error, it just never wires up). `test/site-check.js` checks
that the ids these guards look for exist wherever they're expected to.

**Service/product pre-fill:** clicking a "Get a quote" link that points at
`#quote` on the *same* page pre-fills the requirements textarea directly (as
before). Clicking one that navigates to `contact.html?service=CCTV%20
Installation#quote` (from a service page or the homepage teaser) instead
pre-fills via a URL query param, read by `js/app.js` on `contact.html` load
(`?service=` or `?product=`, the latter used by the shop's "Enquire"
buttons).

## 4. How this was tested

Same sandbox constraint as before: **no outbound network access**, so the
Tailwind/lucide/AOS CDN scripts, Google Fonts, and Unsplash photos can't
load from inside this container, and `npm install jsdom` can't reach the
registry either. Four checks were run instead:

1. **JS syntax validation** — `node --check` on every file in `js/` and
   `test/`.

2. **`test/site-check.js`** (new, no dependencies) — a from-scratch,
   no-dependency static check across all 12 pages:
   - every local `href`/`src` on every page resolves to a real file, and
     every `#fragment` link resolves to a real `id` on its target page
   - the announcement bar + header + footer + floating buttons are
     **byte-identical** across all 12 pages (after normalizing the `../`
     path prefix used inside `services/`) — this is what actually enforces
     "keep the header/footer in sync" now that there's no templating
   - every page has exactly one `<h1>`, a `<main id="main">`, a `data-page`
     attribute, no duplicate ids, and loads the four scripts
     (`theme-init.js` → Tailwind CDN → `tailwind-config.js` → `styles.css`
     → lucide → AOS → `app.js`) in the required order with `app.js` last
   - every page contains the ids that `js/app.js`'s always-on features
     (mobile menu, dropdown) require
   - each of the 6 service pages has a hero, intro, exactly 6 features,
     exactly 6 use cases, a quote CTA, and its own `Service` JSON-LD block
   - the dropdown's 6 labels match the brief exactly, in order, and the
     desktop nav order is Home → About → Services → Shop → Why → Contact
   - the shop has all 13 placeholder products across the 5 filter chips
   - `contact.html` has every id the lead-form code needs

   **Result: 935/935 checks passed.**

   Re-run it yourself: `node test/site-check.js` (no `npm install` needed).

3. **A manual selector cross-reference** — every `#id`, `.class`, and
   `[data-*]` selector `js/app.js` queries via `$()`/`$$()` was extracted
   and confirmed to exist on the pages that need it (the same check §3's
   table documents).

4. **Headless-browser interaction test (Playwright, offline)** — this
   sandbox happens to have Playwright's Chromium already installed, so
   real (non-jsdom) interaction testing was possible after mocking the
   three blocked CDN libraries the same way `test/smoke-test.js` does, and
   blocking the CDN network requests outright so they fail fast instead of
   hanging. This loaded all 12 real pages in a real browser and drove them
   with real mouse/keyboard/touch events:
   - zero uncaught JS errors on any of the 12 pages
   - dropdown: opens on real click, closes on a real outside click; opens
     on `Enter`, moves focus through items with arrow keys, closes on
     `Escape` and returns focus to the button; opens on real mouse hover
     and closes after the mouse moves away
   - mobile (touch viewport): hamburger menu opens, "All Services"
     accordion starts expanded on a service page and toggles closed/open
     on tap, and the current service is marked with `aria-current` inside
     the open mobile menu
   - shop filter: clicking a category chip hides non-matching products and
     updates the "Showing N products" count; "All" restores all 13
     - lead form (tested on both `index.html` and `contact.html`): an
     invalid submit shows all three inline errors; a valid submit with no
     `FORM_ENDPOINT` opens the correct `wa.me` link and reveals the success
     panel
   - every service page's CTA resolves to the correct
     `../contact.html?service=<Name>#quote` link

   This is a genuine (if temporary, mocked-CDN) functional test, not just a
   syntax check — but it's a one-off script run for this change, not part
   of the shipped `test/` folder, since it depends on Playwright being
   available. `test/smoke-test.js` (the original jsdom test) and
   `test/site-check.js` are what's meant to be re-run going forward.

### What this testing does *not* cover
Same as before: real CDN asset loading (actual Tailwind-generated styles,
real font rendering, real Unsplash photos, real lucide icon shapes) and
cross-browser behavior weren't exercised with the real CDN scripts, because
this sandbox can't reach them. Nothing found during any of the four checks
above suggests this would surface further issues. Once you have outbound
internet, `python3 -m http.server 8000` from the project root and click
through the pages — the same natural next step as before, now across 12
pages instead of 1.

## 5. Keeping the header and footer in sync

There's still no templating engine, so the announcement bar, `<header>`,
`<footer>`, and the floating call/WhatsApp buttons are duplicated
byte-for-byte across all 12 files (only the `href="…"` prefix differs:
plain `js/app.js` at the root, `../js/app.js` inside `services/`).
`test/site-check.js` enforces this automatically — if you edit the header
on one page, **copy the exact same edit to all 11 others**, or the check
will fail and tell you exactly which page and which block (header/footer/
floating buttons) drifted.

If that becomes painful, the natural next step is either a static-site
generator/build step (11ty, Astro, plain server-side includes) or moving
header/footer into JS-injected partials — neither was in scope for this
pass, since the brief asked to keep the no-build-step approach.

## 6. Content assumptions made (placeholder — replace before shipping)

Per the brief's open questions, these were built as placeholders so the
structure and interactions could be finished and tested; the copy itself
still needs your input:

- **About Us:** placeholder company story, "20XX" milestone years, and
  four "Name Surname" team cards with generic role descriptions and a
  generic user-icon avatar (no real photos). Every placeholder spot is
  marked with an `<!-- EDIT: … -->` comment in `about.html`.
- **Shop:** built as an **enquiry-only catalog** (no cart/checkout, no
  prices) — 13 placeholder products across 4 categories (Cameras,
  Recorders, Biometric and access, Accessories), each with an "Enquire"
  button that feeds into the same WhatsApp/lead-form flow as the rest of
  the site (via `contact.html?product=<Name>#quote`). This matches the
  simpler of the two options the brief raised; if you want real cart/
  checkout instead, that's a bigger, separate piece of work (payment
  gateway, inventory, order management) — say the word and we can scope it.
  Product names, option lists, and icons are placeholders — marked
  `<!-- EDIT: … -->` in `shop.html`.
- **Why Choose Us:** reuses the homepage's two real "why us" blocks
  verbatim, plus new placeholder content (a 6-reason grid and a 4-step
  "how a project runs" section) written in the site's existing tone.
- **Contact:** the office address/phone/email are the real ones already in
  the original site; the Google Maps embed uses a text-query URL (`?q=707
  A Vipul Business Park Sector 48 Gurgaon`) rather than exact coordinates
  or a Maps API key — swap in a real embed link/API key if you have one.
- **Service pages:** intro copy, feature lists, and "where it's used" lists
  are written specifically for each of the six services (not filler text),
  in the same tone as the original homepage, but are still first-draft
  copy for you to review and edit.

## 7. Known non-changes (carried over from the original site, still true)

- `FORM_ENDPOINT` is still empty by default in `js/app.js` → the lead form
  falls back to opening WhatsApp. Set it once you have a real backend.
- The App Store / Google Play buttons still point to `href="#"`.
- The footer's Privacy Policy / Terms of Service / Warranty links still
  point to `href="#"`.
- Testimonial names/photos on the homepage are still placeholders.
