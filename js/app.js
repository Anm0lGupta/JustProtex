/* =============================================================================
   JustProtex — app.js  (shared by every page)

   IMPORTANT: this file must be loaded LAST on every page, after:
     1. https://unpkg.com/lucide@latest   (window.lucide)
     2. https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.js  (window.AOS)
   because it calls lucide.createIcons() and AOS.init() on load and queries DOM
   elements that must already exist, so keep the <script src="js/app.js"> tag
   just before </body>. (Pages inside services/ use ../js/app.js.)

   Because one script now serves twelve different pages, every page-specific
   feature below is guarded: it runs only if its elements exist on the current
   page (lead form, testimonial carousel, hero clock, shop filter…). The shared
   pieces (header, theme toggle, mobile menu, dropdown, footer year) exist on
   every page.

   Page hooks read from the HTML:
     <body data-page="home|about|services|shop|why|contact">
     <body data-service-page="access-control|…|index">   (services/ pages only)
     [data-nav="…"] and [data-nav-service="…"] on header links
   ============================================================================= */
(() => {
  'use strict';

  /* ------------------------------------------------------------------
     CONFIG
     Set FORM_ENDPOINT to a form backend (Formspree, Getform, your own API…)
     and the lead form will POST JSON there. While it is empty, a valid
     submission opens WhatsApp with the details pre-filled so the lead
     still reaches your team.
     ------------------------------------------------------------------ */
  const FORM_ENDPOINT = '';
  const WHATSAPP_NUMBER = '919802737371';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Icons ---------- */
  if (window.lucide) window.lucide.createIcons();

  /* ---------- Scroll animations (AOS) ---------- */
  if (window.AOS) {
    window.AOS.init({
      duration: 800,
      easing: 'ease-out-cubic',
      once: true,
      offset: 80,
      disable: () => reduceMotion
    });
  } else {
    // If the AOS script failed to load, don't leave content invisible
    $$('[data-aos]').forEach((el) => el.removeAttribute('data-aos'));
  }

  /* ---------- Image fallback: hide a broken photo so the gradient behind it shows ---------- */
  $$('img[data-fallback]').forEach((img) => {
    const hide = () => img.classList.add('opacity-0');
    img.addEventListener('error', hide);
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) hide();
  });

  /* ---------- Footer year ---------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Light / dark theme ---------- */
  const root = document.documentElement;
  const themeBtn = $('#theme-toggle');
  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', String(root.classList.contains('dark')));
    themeBtn.addEventListener('click', () => {
      const dark = !root.classList.contains('dark');
      root.classList.toggle('dark', dark);
      themeBtn.setAttribute('aria-pressed', String(dark));
      try { localStorage.setItem('jp-theme', dark ? 'dark' : 'light'); } catch (e) {}
    });
  }

  /* ---------- Current page marker (aria-current) ----------
     Header links carry data-nav="home|about|services|shop|why|contact"; the
     dropdown / accordion service links carry data-nav-service="<slug>|index".
     The styles for [aria-current] live in css/styles.css. */
  const pageKey = document.body.dataset.page;
  const serviceKey = document.body.dataset.servicePage;
  $$('[data-nav]').forEach((el) => {
    if (el.dataset.nav === pageKey) el.setAttribute('aria-current', el.tagName === 'A' ? 'page' : 'true');
  });
  if (serviceKey) {
    $$('[data-nav-service]').forEach((el) => {
      if (el.dataset.navService === serviceKey) el.setAttribute('aria-current', 'page');
    });
  }

  /* ---------- Quote links: on a page that has the form, scroll to it ---------- */
  if ($('#quote')) {
    $$('[data-quote-link]').forEach((a) => a.setAttribute('href', '#quote'));
  }

  /* ---------- Mobile navigation ---------- */
  const menuBtn = $('#menu-btn');
  const menu = $('#mobile-menu');
  const setMenu = (open) => {
    menu.classList.toggle('hidden', !open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    $$('.menu-open', menuBtn).forEach((el) => el.classList.toggle('hidden', open));
    $$('.menu-close', menuBtn).forEach((el) => el.classList.toggle('hidden', !open));
  };
  menuBtn.addEventListener('click', () => setMenu(menu.classList.contains('hidden')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.classList.contains('hidden')) { setMenu(false); menuBtn.focus(); }
  });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- Mobile accordion ("All Services" inside the hamburger menu) ---------- */
  $$('[data-accordion-toggle]').forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    const setAcc = (open) => {
      panel.classList.toggle('hidden', !open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', () => setAcc(panel.classList.contains('hidden')));
    // Start expanded on service pages so the visitor sees where they are
    if (pageKey === 'services') setAcc(true);
  });

  /* ---------- Desktop "All Services" dropdown ----------
     - Mouse (hover-capable devices): opens on hover, closes when the pointer leaves.
       Clicking while it is hover-open "pins" it; clicking again closes it.
     - Touch / no hover: tap toggles.
     - Keyboard: Enter/Space or ArrowDown opens and moves into the list; Arrow keys,
       Home and End move between items; Escape closes and returns focus to the button;
       tabbing out closes it.
     - Clicking or tapping anywhere outside closes it. */
  const dd = $('[data-dropdown]');
  if (dd) {
    const ddBtn = $('[data-dropdown-toggle]', dd);
    const ddPanel = document.getElementById(ddBtn.getAttribute('aria-controls'));
    const items = () => $$('a', ddPanel);
    const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let pinned = false;
    let closeTimer = null;

    const isOpen = () => !ddPanel.classList.contains('hidden');
    const setDd = (open) => {
      clearTimeout(closeTimer);
      ddPanel.classList.toggle('hidden', !open);
      ddBtn.setAttribute('aria-expanded', String(open));
      if (!open) pinned = false;
    };
    const focusItem = (i) => {
      const list = items();
      if (list.length) list[(i + list.length) % list.length].focus();
    };

    ddBtn.addEventListener('click', (e) => {
      if (!isOpen()) {
        setDd(true);
        pinned = true;
        if (e.detail === 0) focusItem(0); // keyboard-initiated (Enter / Space)
      } else if (!pinned) {
        pinned = true;                    // it was open from hover: keep it open
      } else {
        setDd(false);
      }
    });

    dd.addEventListener('mouseenter', () => { if (canHover()) setDd(true); });
    dd.addEventListener('mouseleave', () => {
      if (canHover() && !pinned) closeTimer = setTimeout(() => setDd(false), 150);
    });

    dd.addEventListener('keydown', (e) => {
      const list = items();
      const at = list.indexOf(document.activeElement);
      switch (e.key) {
        case 'Escape':
          if (isOpen()) { e.preventDefault(); setDd(false); ddBtn.focus(); }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen()) { setDd(true); pinned = true; focusItem(0); }
          else focusItem(at + 1);          // from the button (at = -1) this lands on item 0
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!isOpen()) { setDd(true); pinned = true; focusItem(-1); }
          else focusItem(at === -1 ? -1 : at - 1);
          break;
        case 'Home':
          if (at !== -1) { e.preventDefault(); focusItem(0); }
          break;
        case 'End':
          if (at !== -1) { e.preventDefault(); focusItem(-1); }
          break;
      }
    });

    // Tabbing (or shift-tabbing) out of the dropdown closes it
    dd.addEventListener('focusout', (e) => {
      if (e.relatedTarget && !dd.contains(e.relatedTarget)) setDd(false);
    });

    // Pointer down outside closes it (pointerdown, not click, so taps on iOS count too)
    document.addEventListener('pointerdown', (e) => {
      if (isOpen() && !dd.contains(e.target)) setDd(false);
    });

    // Leaving desktop width hides the whole bar, so reset
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (!e.matches) setDd(false); });
  }

  /* ---------- Hero camera clock (decorative) ---------- */
  const osd = $('#osd-time');
  if (osd) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const tick = () => { osd.textContent = fmt.format(new Date()).replace(',', '').toUpperCase(); };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Lead form (homepage hero and contact page) ---------- */
  const form = $('#lead-form');
  if (form) {
    const wrap = $('#lead-form-wrap');
    const success = $('#lead-success');
    const successMsg = $('#lead-success-msg');
    const submitBtn = $('#submit-btn');
    const submitLabel = $('#submit-label');
    const formError = $('#form-error');

    /* Pre-fill the requirements box:
       - from a service card on this page (href="#quote" + data-service), or
       - from the URL: contact.html?service=CCTV%20Installation  /  ?product=IP%20Bullet%20Camera
         (service pages and the shop link here). */
    const clip = (v) => String(v || '').trim().slice(0, 120);
    const params = new URLSearchParams(window.location.search);
    const reqBox = $('#f-req');
    if (reqBox && !reqBox.value.trim()) {
      const svc = clip(params.get('service'));
      const prod = clip(params.get('product'));
      if (svc) reqBox.value = `I'm interested in ${svc}.`;
      else if (prod) reqBox.value = `I'd like to enquire about ${prod}.`;
    }

    $$('[data-service]').forEach((link) => {
      if (!(link.getAttribute('href') || '').startsWith('#')) return;
      link.addEventListener('click', () => {
        const req = $('#f-req');
        if (req && !req.value.trim()) req.value = `I'm interested in ${link.dataset.service}.`;
        setTimeout(() => $('#f-name').focus({ preventScroll: true }), 500);
      });
    });

    const setError = (field, message) => {
      const input = $(`#f-${field}`);
      const out = $(`#err-${field}`);
      if (!input || !out) return;
      out.textContent = message || '';
      out.classList.toggle('hidden', !message);
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      input.classList.toggle('border-rose-400', Boolean(message));
    };

    const validate = (data) => {
      let ok = true;
      const name = data.name.trim();
      const digits = data.phone.replace(/\D/g, '');
      const phoneOk = /^(91|0)?[6-9]\d{9}$/.test(digits);
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim());

      setError('name', name.length < 2 ? 'Enter your name.' : ''); if (name.length < 2) ok = false;
      setError('phone', phoneOk ? '' : 'Enter a valid 10-digit mobile number.'); if (!phoneOk) ok = false;
      setError('email', emailOk ? '' : 'Enter a valid email address, like you@company.com.'); if (!emailOk) ok = false;
      return ok;
    };

    const showSuccess = (data, sent) => {
      const first = data.name.trim().split(/\s+/)[0] || 'there';
      successMsg.textContent = sent
        ? `Thank you, ${first}. Our team will call you on ${data.phone.trim()} shortly.`
        : `Thanks, ${first}. WhatsApp has opened with your details. Tap Send there to reach our team.`;
      wrap.classList.add('hidden');
      success.classList.remove('hidden');
      success.focus();
      form.reset();
      submitBtn.disabled = false;
      submitLabel.textContent = 'Request my free quote';
      ['name', 'phone', 'email'].forEach((f) => setError(f, ''));
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formError.classList.add('hidden');
      const fd = new FormData(form);
      const data = {
        name: String(fd.get('name') || ''),
        phone: String(fd.get('phone') || ''),
        email: String(fd.get('email') || ''),
        requirements: String(fd.get('requirements') || '').trim()
      };

      // Bots fill the hidden field; pretend success and drop the request
      if (fd.get('website')) return showSuccess(data, true);

      if (!validate(data)) {
        const firstBad = $('[aria-invalid="true"]', form);
        if (firstBad) firstBad.focus();
        return;
      }

      submitBtn.disabled = true;
      submitLabel.textContent = 'Sending…';

      if (FORM_ENDPOINT) {
        try {
          const res = await fetch(FORM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(data)
          });
          if (!res.ok) throw new Error('Request failed');
          showSuccess(data, true);
        } catch (err) {
          submitBtn.disabled = false;
          submitLabel.textContent = 'Request my free quote';
          formError.textContent = 'We couldn’t send your request. Please try again or call +91 9802737371.';
          formError.classList.remove('hidden');
        }
      } else {
        // No backend configured: hand the lead to WhatsApp, pre-filled
        const text = [
          'Hi JustProtex, I’d like a free security quote.',
          `Name: ${data.name.trim()}`,
          `Phone: ${data.phone.trim()}`,
          `Email: ${data.email.trim()}`,
          data.requirements ? `Requirements: ${data.requirements}` : ''
        ].filter(Boolean).join('\n');
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        showSuccess(data, false);
      }
    });

    $('#lead-reset').addEventListener('click', () => {
      success.classList.add('hidden');
      wrap.classList.remove('hidden');
      $('#f-name').focus();
    });
  }

  /* ---------- Shop: filter products by category ---------- */
  const filterBtns = $$('[data-filter]');
  if (filterBtns.length) {
    const products = $$('[data-category]');
    const count = $('#shop-count');
    const applyFilter = (cat) => {
      let shown = 0;
      filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === cat)));
      products.forEach((p) => {
        const show = cat === 'all' || p.dataset.category === cat;
        p.classList.toggle('hidden', !show);
        if (show) shown += 1;
      });
      if (count) count.textContent = `Showing ${shown} product${shown === 1 ? '' : 's'}`;
    };
    filterBtns.forEach((b) => b.addEventListener('click', () => applyFilter(b.dataset.filter)));
  }

  /* ---------- Testimonial carousel (homepage) ---------- */
  const carousel = $('#t-carousel');
  const track = $('#t-track');
  if (carousel && track) {
    const slides = Array.from(track.children);
    const dots = $$('.t-dot');
    let index = 0;
    let timer = null;

    const paintDots = () => {
      dots.forEach((dot, i) => {
        const active = i === index;
        dot.classList.toggle('w-8', active);
        dot.classList.toggle('w-2.5', !active);
        dot.classList.toggle('bg-blue-700', active);
        dot.classList.toggle('dark:bg-cyan-400', active);
        dot.classList.toggle('bg-slate-300', !active);
        dot.classList.toggle('dark:bg-slate-600', !active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
    };

    const goTo = (i) => {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      slides.forEach((s, n) => s.setAttribute('aria-hidden', n === index ? 'false' : 'true'));
      paintDots();
    };

    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => {
      if (reduceMotion || timer) return;
      timer = setInterval(() => goTo(index + 1), 7000);
    };

    $('#t-prev').addEventListener('click', () => { goTo(index - 1); stop(); });
    $('#t-next').addEventListener('click', () => { goTo(index + 1); stop(); });
    dots.forEach((dot) => dot.addEventListener('click', () => { goTo(Number(dot.dataset.index)); stop(); }));

    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    carousel.addEventListener('focusin', stop);
    carousel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { goTo(index - 1); stop(); }
      if (e.key === 'ArrowRight') { goTo(index + 1); stop(); }
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    // Swipe on touch screens
    let startX = null;
    carousel.addEventListener('pointerdown', (e) => { startX = e.clientX; });
    carousel.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 50) { goTo(index + (dx < 0 ? 1 : -1)); stop(); }
      startX = null;
    });

    goTo(0);
    start();
  }
})();
