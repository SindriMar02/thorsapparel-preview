/* Thor's Apparel concept v2: interactions + motion. In the Shopify build the cart, variant and drawer
   logic come from Dawn's JS (cart-drawer.js, product-form.js, facets.js); this file stands in for them
   in the static concept and carries the motion layer unchanged. Spec: _docs/thorsapparel-2026-11-04/MOTION.md */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const touch = matchMedia('(hover: none) and (pointer: coarse)');
  const phoneMQ = matchMedia('(max-width: 900px)');
  const eur = (n) => '€' + n.toFixed(2).replace('.', ',');
  const hasGsap = () => !!(window.gsap && window.ScrollTrigger);
  const crossDocVT = 'onpagereveal' in window;

  /* ---------- Lenis (desktop fine pointer only; never on touch) ---------- */
  let lenis = null;
  function mountLenis() {
    if (lenis || reduce.matches || touch.matches || !window.Lenis || !hasGsap()) return;
    lenis = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis && lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  function killLenis() { if (lenis) { lenis.destroy(); lenis = null; } }
  const barH = () => ($('.bar')?.offsetHeight || 0);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a || a.getAttribute('href').length < 2) return;
    const t = document.getElementById(a.getAttribute('href').slice(1)); if (!t) return;
    e.preventDefault();
    const y = t.getBoundingClientRect().top + scrollY - barH() + 1;
    lenis ? lenis.scrollTo(y, { duration: 1.2 }) : scrollTo({ top: y, behavior: reduce.matches ? 'auto' : 'smooth' });
  });

  /* ---------- scroll lock: Lenis stop on desktop, fixed body on touch ---------- */
  let lockY = 0, locks = 0;
  const lock = () => { if (locks++) return; if (lenis) { lenis.stop(); return; } lockY = scrollY; Object.assign(document.body.style, { position: 'fixed', top: `-${lockY}px`, left: 0, right: 0 }); };
  const unlock = () => { if (--locks > 0) return; locks = 0; if (lenis) { lenis.start(); return; } if (document.body.style.position === 'fixed') { Object.assign(document.body.style, { position: '', top: '', left: '', right: '' }); scrollTo(0, lockY); } };

  /* ---------- overlays: drawers, menu, dialogs ---------- */
  const scrim = $('.scrim');
  let openEl = null, opener = null;
  function openOverlay(el, trigger, e) {
    if (openEl === el) return;
    if (openEl) closeOverlay(false);
    openEl = el; opener = trigger || document.activeElement;
    el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false');
    if (el.classList.contains('drawer')) scrim.classList.add('is-on');
    if (trigger && trigger.setAttribute) trigger.setAttribute('aria-expanded', 'true');
    lock();
    const viaKey = !e || e.detail === 0;
    const first = $('[data-first], a, button, input', el);
    requestAnimationFrame(() => (viaKey && first ? first : el).focus({ preventScroll: true }));
  }
  function closeOverlay(restore = true) {
    if (!openEl) return;
    const el = openEl; openEl = null;
    el.classList.remove('is-open'); el.setAttribute('aria-hidden', 'true');
    scrim.classList.remove('is-on');
    if (opener && opener.setAttribute) opener.setAttribute('aria-expanded', 'false');
    if (el.id === 'video') setTimeout(() => { if (!el.classList.contains('is-open')) $('.vdialog__frame', el).innerHTML = ''; }, 220);
    unlock();
    if (restore && opener && opener.focus) opener.focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open]');
    if (t) { e.preventDefault(); const el = document.getElementById(t.dataset.open); if (el) { if (el.id === 'video') loadVideo(t.dataset.yt); if (el.id === 'zoom') loadZoom(t); if (openEl === el) closeOverlay(); else openOverlay(el, t, e); } return; }
    if (e.target.closest('[data-close]') || e.target === scrim || e.target.classList.contains('vdialog') || e.target.classList.contains('zoom')) closeOverlay();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeOverlay(); closeQuick(); } });
  // A link inside an open overlay (the phone menu's categories): release the page lock before leaving, under the full-screen menu,
  // so Safari stores the real scroll position and Back returns to where you were, not to the top (iOS pass 5 Nov).
  document.addEventListener('click', (e) => { const a = e.target.closest('a[href]'); if (a && openEl && openEl.contains(a) && !a.target && document.body.style.position === 'fixed') unlock(); }, true);
  function loadVideo(id) {
    const f = $('#video .vdialog__frame'); if (!f || !id) return;
    f.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="510kg / 1,124lb WORLD RECORD Deadlift, Hafthor Bjornsson on YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  }
  /* zoom: the image grows from where it was tapped (FLIP) and shrinks back */
  function loadZoom(t) {
    const z = $('#zoom'), img = $('img', z), src = t.dataset.src || $('img', t)?.src; if (!src) return;
    img.src = src; img.alt = t.dataset.alt || '';
    const from = ($('img', t) || t).getBoundingClientRect();
    if (!hasGsap() || reduce.matches) return;
    requestAnimationFrame(() => { const to = img.getBoundingClientRect(); if (!to.width) return;
      gsap.fromTo(img, { x: from.left + from.width / 2 - (to.left + to.width / 2), y: from.top + from.height / 2 - (to.top + to.height / 2), scale: from.width / to.width },
        { x: 0, y: 0, scale: 1, duration: 0.7, ease: 'expo.out', overwrite: true }); });
  }

  /* ---------- toast ---------- */
  const toast = $('.toast'); let tt;
  const say = (msg) => { if (!toast) return; toast.textContent = msg; toast.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('is-on'), 2400); };
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-concept]'); if (b) { e.preventDefault(); say(b.dataset.concept); } });

  /* ---------- cart ---------- */
  const KEY = 'ta-cart';
  let cart = [];
  try { cart = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (_) { cart = []; }
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(cart)); } catch (_) {} };
  function renderCart(pulse) {
    const n = cart.reduce((a, l) => a + l.q, 0);
    $$('.cart-count').forEach((c) => { c.textContent = n; c.dataset.n = n; if (pulse) { c.classList.remove('is-pulse'); void c.offsetWidth; c.classList.add('is-pulse'); } });
    const list = $('#cart-lines'); if (!list) return;
    $('#cart-sub').textContent = eur(cart.reduce((a, l) => a + l.q * l.p, 0));
    $('#cart-title').textContent = `Cart (${n})`;
    list.innerHTML = cart.length ? cart.map((l, i) => `<li class="line-item" data-i="${i}"><img src="assets/img/${l.img}" alt="" width="84" height="84" style="object-fit:contain"><div><p class="h3">${l.t}</p><p class="mono">${l.v}</p><div class="qty"><button aria-label="One fewer" data-q="${i}" data-d="-1">−</button><span>${l.q}</span><button aria-label="One more" data-q="${i}" data-d="1">+</button></div></div><p class="mono"><b>${eur(l.p * l.q)}</b></p></li>`).join('')
      : `<li class="empty"><p class="h2">Nothing loaded yet.</p><p class="mono" style="margin-top:12px">Pick a size to start.</p></li>`;
  }
  $('#cart-lines')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    const i = +b.dataset.q, l = cart[i]; l.q += +b.dataset.d;
    if (l.q <= 0) {
      const li = b.closest('.line-item');
      const done = () => { cart.splice(i, 1); save(); renderCart(false); };
      if (hasGsap() && !reduce.matches) gsap.to(li, { height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, duration: 0.35, ease: 'power2.in', onComplete: done }); else done();
      return;
    }
    save(); renderCart(false);
  });
  function fly(fromEl, imgSrc, done) {
    const icon = $('.bar [data-open="cart"]');
    if (!fromEl || !icon || !hasGsap() || reduce.matches) return done();
    const a = fromEl.getBoundingClientRect(), b = icon.getBoundingClientRect();
    const f = document.createElement('img'); f.className = 'flyer'; f.src = imgSrc; f.alt = ''; document.body.appendChild(f);
    const w = Math.min(a.width, 260);
    gsap.set(f, { left: a.left + a.width / 2 - w / 2, top: a.top + a.height / 2 - w / 2, width: w });
    gsap.timeline({ onComplete: () => { f.remove(); done(); } })
      .to(f, { left: b.left + b.width / 2 - 12, duration: 0.7, ease: 'power2.inOut' }, 0)
      .to(f, { top: b.top + b.height / 2 - 12, duration: 0.7, ease: 'back.in(1.4)' }, 0)
      .to(f, { width: 24, rotate: -12, duration: 0.7, ease: 'power2.in' }, 0)
      .to(f, { opacity: 0, duration: 0.12 }, 0.6);
  }
  function add(item, trigger, e, flyFrom) {
    const hit = cart.find((l) => l.h === item.h && l.v === item.v);
    hit ? hit.q++ : cart.push({ ...item, q: 1 });
    save();
    fly(flyFrom, 'assets/img/' + item.img, () => { renderCart(true); openOverlay($('#cart'), trigger, e); });
  }
  renderCart(false);

  /* ---------- quick add on cards ---------- */
  let quickCard = null;
  function closeQuick() { if (quickCard) { quickCard.classList.remove('is-quick'); $('.quick', quickCard)?.setAttribute('aria-expanded', 'false'); quickCard = null; } }
  document.addEventListener('click', (e) => {
    const q = e.target.closest('.quick');
    if (q) { e.preventDefault(); const c = q.closest('.card'); if (quickCard === c) { closeQuick(); return; } closeQuick(); quickCard = c; c.classList.add('is-quick'); q.setAttribute('aria-expanded', 'true'); if (e.detail === 0) $('.sizes-row button', c)?.focus(); return; }
    const s = e.target.closest('.sizes-row button');
    if (s) { e.preventDefault(); const c = s.closest('.card'); const d = c.dataset; add({ h: d.h, t: d.t, p: +d.p, img: d.img, v: 'Size ' + s.textContent }, s, e, $('.card__cut, .card__media img', c)); closeQuick(); return; }
    if (quickCard && !e.target.closest('.card.is-quick')) closeQuick();
  });

  /* ---------- product page ---------- */
  const pdp = $('[data-pdp]');
  if (pdp) {
    let size = $('.sizegrid button[aria-pressed="true"]', pdp)?.textContent || null;
    const grid = $('.sizegrid', pdp), main = $('#add-main'), bar = $('.buybar'), barSize = $('#bar-size');
    grid?.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', grid).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      size = b.textContent; $('#size-picked').textContent = 'Size ' + size; if (barSize) barSize.textContent = 'Size ' + size;
    });
    const doAdd = (btn, e) => {
      if (!size) { say('Pick a size first'); grid.querySelector('button').focus({ preventScroll: true }); const y = grid.getBoundingClientRect().top + scrollY - innerHeight / 2; lenis ? lenis.scrollTo(y) : scrollTo({ top: y, behavior: reduce.matches ? 'auto' : 'smooth' }); return; }
      const d = pdp.dataset; btn.classList.add('is-added'); const old = btn.innerHTML; btn.textContent = 'Added';
      setTimeout(() => { btn.classList.remove('is-added'); btn.innerHTML = old; }, 1200);
      add({ h: d.h, t: d.t, p: +d.p, img: d.img, v: [size === 'One size' ? size : 'Size ' + size, d.color].filter(Boolean).join(' · ') }, btn, e, $('.pdp2__cut'));
    };
    main?.addEventListener('click', (e) => doAdd(main, e));
    $('#add-bar')?.addEventListener('click', (e) => doAdd($('#add-bar'), e));
    if (bar && main && 'IntersectionObserver' in window) new IntersectionObserver(([en]) => bar.classList.toggle('is-on', !en.isIntersecting)).observe(main);
  }
  $$('.unit-toggle button').forEach((b) => b.addEventListener('click', () => {
    $$('.unit-toggle button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $$('[data-cm]').forEach((td) => { td.textContent = b.dataset.unit === 'cm' ? td.dataset.cm : td.dataset.in; });
  }));

  /* ---------- accordions (expand AND collapse) ---------- */
  document.addEventListener('click', (e) => { const b = e.target.closest('.acc__btn'); if (b) b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true')); });

  /* ---------- expanding panels (Shop by) ---------- */
  // From 901 px: columns (hover, focus or a tap widens one; a tap on the open one goes to the collection). Up to 900 px Shop by is
  // a tile grid (v2.css v3.0, Sindri 5 Nov: "mobile tapping on categories ... moves the screen weirdly"): nothing changes size and
  // one tap goes, so the page never moves under the finger. The old phone rows opened on a first tap and scrolled the page for
  // 760 ms to hold the tapped row still, which fought the finger and the momentum on iOS.
  const panels = $$('.panel');
  let lastPtr = '';
  const openPanel = (p) => { if (p.classList.contains('is-open')) return; panels.forEach((x) => { x.classList.toggle('is-open', x === p); x.setAttribute('aria-expanded', String(x === p)); }); };
  panels.forEach((p) => {
    p.addEventListener('pointerdown', (e) => { lastPtr = e.pointerType; });
    p.addEventListener('touchstart', () => {}, { passive: true }); // lets iOS Safari paint :active (the press feedback on a tile)
    p.addEventListener('pointerenter', () => { if (fine.matches && !phoneMQ.matches) openPanel(p); });
    p.addEventListener('focus', () => { if (!phoneMQ.matches && p.matches(':focus-visible')) openPanel(p); });
    // a touch/pen tap on a closed column opens it first; tiles (phones), mouse, keyboard and assistive tech (detail 0) follow the link
    p.addEventListener('click', (e) => { const tap = e.detail > 0 && (lastPtr === 'touch' || lastPtr === 'pen'); lastPtr = '';
      if (tap && !phoneMQ.matches && !p.classList.contains('is-open')) { e.preventDefault(); openPanel(p); } });
  });

  /* ---------- drop rail: native scroller + drag + buttons + progress (no scroll-jacking) ---------- */
  const rvp = $('.rail__viewport');
  if (rvp) {
    const tees = $$('.tee', rvp), bar = $('.rail__progress i'), prev = $('[data-rail="prev"]'), next = $('[data-rail="next"]');
    const step = () => { const t = tees[0]; return t ? t.offsetWidth + (parseFloat(getComputedStyle($('.rail__track')).columnGap) || 0) : rvp.clientWidth * 0.8; };
    const weigh = () => { const c = innerWidth / 2; tees.forEach((t) => { const r = t.getBoundingClientRect(); const d = Math.min(Math.abs(r.left + r.width / 2 - c) / (innerWidth * 0.5), 1); t.style.setProperty('--w', Math.round(800 - d * 600)); }); };
    const update = () => { const max = rvp.scrollWidth - rvp.clientWidth; if (bar) bar.style.transform = `scaleX(${max > 0 ? rvp.scrollLeft / max : 0})`; if (prev) prev.disabled = rvp.scrollLeft < 4; if (next) next.disabled = rvp.scrollLeft > max - 4; weigh(); };
    rvp.addEventListener('scroll', update, { passive: true }); addEventListener('resize', update); update();
    $$('[data-rail]').forEach((b) => b.addEventListener('click', () => rvp.scrollBy({ left: (b.dataset.rail === 'next' ? 1 : -1) * step(), behavior: reduce.matches ? 'auto' : 'smooth' })));
    let down = false, sx = 0, sl = 0, moved = 0, vx = 0, lx = 0, lt = 0;
    rvp.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; sx = lx = e.clientX; sl = rvp.scrollLeft; moved = 0; vx = 0; lt = performance.now(); });
    addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); if (moved > 5) rvp.classList.add('is-dragging'); rvp.scrollLeft = sl - dx; const now = performance.now(); vx = (e.clientX - lx) / Math.max(now - lt, 1); lx = e.clientX; lt = now; });
    addEventListener('pointerup', () => { if (!down) return; down = false; if (!rvp.classList.contains('is-dragging')) return;
      rvp.classList.remove('is-dragging'); const w = step(); rvp.scrollTo({ left: Math.round((rvp.scrollLeft - vx * 220) / w) * w, behavior: reduce.matches ? 'auto' : 'smooth' }); });
    rvp.addEventListener('click', (e) => { if (moved > 5) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
    rvp.addEventListener('dragstart', (e) => e.preventDefault());
  }

  /* ---------- marquee (port of 21st.dev #35200): CSS loop, off-screen pause, drag seeks the animation ---------- */
  $$('.marq').forEach((m) => {
    const track = $('.marq__track', m);
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => m.toggleAttribute('data-off', !en.isIntersecting), { rootMargin: '100px' }).observe(m);
    const anim = () => track.getAnimations ? track.getAnimations().find((a) => (a.animationName || '').startsWith('ta-marq')) : null;
    // data-speed = px per second (phones 75 %), so the loop runs at one speed at every width; keeps its place when it retimes
    if (m.dataset.speed) { const g = $('.marq__group', m);
      const retime = () => { const w = g.getBoundingClientRect().width; if (!w) return; const a = anim(), p = a ? a.effect.getComputedTiming().progress || 0 : 0;
        const sec = w / (+m.dataset.speed * (innerWidth < 768 ? 0.75 : 1)); m.style.setProperty('--marq-dur', sec.toFixed(2) + 's');
        getComputedStyle(track).animationDuration; const b = anim(); if (b) b.currentTime = p * sec * 1000; };
      retime(); if (document.fonts) document.fonts.ready.then(retime); let rt, mw = innerWidth; addEventListener('resize', () => { if (innerWidth === mw) return; mw = innerWidth; clearTimeout(rt); rt = setTimeout(retime, 150); }, { passive: true }); }
    const seek = (dist) => { const a = anim(); if (!a) return; const len = track.getBoundingClientRect().width / 2; const per = Number(a.effect.getComputedTiming().duration); if (!len || !per) return;
      const rev = m.dataset.dir === 'right'; const t = Number(a.currentTime || 0) + (dist / len) * per * (rev ? 1 : -1); a.currentTime = ((t % per) + per) % per; };
    let d = null, dragged = false;
    m.addEventListener('pointerdown', (e) => { dragged = false; if (e.button !== 0 || d) return; d = { id: e.pointerId, start: e.clientX, last: e.clientX, moving: false }; });
    m.addEventListener('pointermove', (e) => { if (!d || d.id !== e.pointerId) return; if (!d.moving) { if (Math.abs(e.clientX - d.start) < 5) return; d.moving = true; m.setPointerCapture(e.pointerId); m.setAttribute('data-dragging', ''); }
      seek(e.clientX - d.last); d.last = e.clientX; });
    const end = (e, cancel) => { if (!d || d.id !== e.pointerId) return; const was = d.moving; d = null; if (!was) return; if (m.hasPointerCapture(e.pointerId)) m.releasePointerCapture(e.pointerId); m.removeAttribute('data-dragging'); dragged = !cancel; };
    m.addEventListener('pointerup', (e) => end(e, false)); m.addEventListener('pointercancel', (e) => end(e, true));
    m.addEventListener('click', (e) => { if (dragged) { dragged = false; e.preventDefault(); e.stopPropagation(); } }, true);
    m.addEventListener('dragstart', (e) => e.preventDefault());
  });

  /* ---------- FLIP helper (grid density, load more) ---------- */
  function flip(els, change) {
    if (!hasGsap() || reduce.matches) { change(); return; }
    const first = new Map(els.map((el) => [el, el.getBoundingClientRect()]));
    change();
    els.forEach((el) => { const a = first.get(el), b = el.getBoundingClientRect(); if (!b.width) return;
      gsap.fromTo(el, { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / b.width, scaleY: a.height / b.height, transformOrigin: '0 0' },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.7, ease: 'expo.out', overwrite: true, clearProps: 'transform' }); });
  }
  /* collection: filters panel, chips, sort, density, load more */
  const fx = $('[data-facets]');
  if (fx) {
    const gridEl = $('[data-grid]'), cards = $$('.card[data-fit]', gridEl);
    const fBtn = $('#filters-btn'), fPanel = $('#filters');
    fBtn?.addEventListener('click', () => { const open = !fPanel.classList.contains('is-open'); fPanel.classList.toggle('is-open', open); fBtn.setAttribute('aria-expanded', String(open)); });
    const apply = () => {
      const fits = $$('.chip[data-fit][aria-pressed="true"]').map((c) => c.dataset.fit);
      const shown = [];
      flip(cards.concat($$('.tile-ed', gridEl)), () => {
        cards.forEach((c) => { const ok = (!fits.length || fits.includes(c.dataset.fit)) && !c.classList.contains('is-later'); c.classList.toggle('is-hidden', !ok); if (ok) shown.push(c); });
        const sort = $('#sort').value;
        if (sort !== 'featured') [...shown].sort((a, b) => (sort === 'low' ? 1 : -1) * (+a.dataset.p - +b.dataset.p)).forEach((c) => gridEl.appendChild(c));
      });
      $('#shown').textContent = cards.filter((c) => !c.classList.contains('is-hidden')).length;
      const n = fits.length; if (fBtn) $('span', fBtn).textContent = n ? `Filters (${n})` : 'Filters';
    };
    $$('.chip[data-fit]').forEach((c) => c.addEventListener('click', () => { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); apply(); }));
    $$('.chip[data-demo]').forEach((c) => c.addEventListener('click', () => c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'))));
    $('#sort').addEventListener('change', apply);
    $$('.density button').forEach((b) => b.addEventListener('click', () => {
      $$('.density button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      flip($$('.card:not(.is-hidden), .tile-ed', gridEl), () => gridEl.classList.toggle('grid--big', b.dataset.cols === '2'));
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }));
    $('#load-more')?.addEventListener('click', (e) => {
      const later = cards.filter((c) => c.classList.contains('is-later')); later.forEach((c) => c.classList.remove('is-later'));
      apply(); if (hasGsap() && !reduce.matches) gsap.fromTo(later, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.06 });
      $('.more__bar i').style.transform = `scaleX(${(cards.length / 32).toFixed(3)})`;
      e.currentTarget.textContent = 'Concept: the next 22 load from Shopify'; e.currentTarget.disabled = true;
    });
  }

  /* ---------- page transitions ---------- */
  // Shared element: the tee you clicked becomes the product hero (cross-document View Transitions).
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href$="product.html"], a[href^="p-"]'); if (!a) return;
    const img = $('.tee__img, .card__cut', a.closest('.tee, .card') || a);
    $$('[style*="view-transition-name"]').forEach((el) => { if (el !== img && !el.classList.contains('pdp2__cut')) el.style.viewTransitionName = ''; });
    if (img && crossDocVT) img.style.viewTransitionName = 'tee';
  }, true);
  addEventListener('pageshow', (e) => { $$('.tee__img, .card__cut').forEach((el) => (el.style.viewTransitionName = '')); $('.curtain')?.classList.remove('is-cover'); if (e.persisted) closeOverlay(false); });
  const quiet = (vt) => { if (!vt) return; ['ready', 'finished', 'updateCallbackDone'].forEach((k) => vt[k] && vt[k].catch(() => {})); };
  addEventListener('pagereveal', (e) => quiet(e.viewTransition));
  addEventListener('pageswap', (e) => quiet(e.viewTransition));
  // Fallback for browsers without cross-document transitions: iron curtain covers, then the next page lifts it.
  if (!crossDocVT && !reduce.matches) {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || a.target) return;
      const u = new URL(a.href, location.href); if (u.origin !== location.origin || u.pathname === location.pathname) return;
      e.preventDefault(); const c = $('.curtain'); c.classList.add('is-cover');
      try { sessionStorage.setItem('ta-nav', '1'); } catch (_) {}
      setTimeout(() => (location.href = a.href), 460);
    });
  }

  /* ---------- chalk burst at the record ---------- */
  function chalkBurst(canvas) {
    if (!canvas || reduce.matches) return;
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const bar = $('.record__bar').getBoundingClientRect(); const ox = bar.left - r.left + bar.width * 0.5, oy = bar.top - r.top;
    const P = Array.from({ length: 160 }, () => ({ x: ox + (Math.random() - 0.5) * bar.width * 0.9, y: oy, vx: (Math.random() - 0.5) * 3.2, vy: -Math.random() * 5 - 1.2, s: Math.random() * 2.4 + 0.6, a: 0.9 }));
    let t0 = performance.now();
    (function frame(now) {
      const k = Math.min((now - t0) / 1600, 1); ctx.clearRect(0, 0, r.width, r.height);
      P.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.985; ctx.globalAlpha = p.a * (1 - k); ctx.fillStyle = '#F2EFEA'; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill(); });
      if (k < 1) requestAnimationFrame(frame); else ctx.clearRect(0, 0, r.width, r.height);
    })(t0);
  }

  /* ---------- hero callout: a line from the print on his top to that tee (Sindri 5 Nov) ----------
     The dot sits on the fabric just right of the print (60% across, 42.5% down the photo, measured on hero-power-base.jpg) and follows the photo
     through the intro and the pointer depth; the path goes from the dot to the card. Layout only runs while something
     moves (intro, pointer, resize), then stops. Transform owners: the loop owns .callout__dot (translate), GSAP owns its <i>
     (scale) and the card (y). */
  const co = $('[data-callout]');
  let coUntil = 0, coRaf = 0;
  const coLayout = () => {
    // Hanging tag (Sindri 5 Nov: "make the line pointing to the tee and text a bit better and more minimalistic"): the tag is
    // placed so its tee thumbnail sits straight below the dot, and one plumb hairline drops from the dot to the thumbnail. If the
    // tag has to be pushed in from an edge, the line steps across just above the thumbnail.
    const stg = co.parentElement, man = $('.h2o__man'), card = $('.callout__card', co), img = $('img', card), dot = $('.callout__dot', co), svg = $('svg', co), path = $('path', svg);
    const S = stg.getBoundingClientRect(), M = man.getBoundingClientRect();
    if (!S.width || !M.width) return;
    const ax = M.left - S.left + M.width * 0.6, ay = M.top - S.top + M.height * 0.425;
    dot.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
    svg.setAttribute('viewBox', `0 0 ${S.width.toFixed(0)} ${S.height.toFixed(0)}`);
    const edge = phoneMQ.matches ? 10 : 24, want = ax - (img.offsetLeft + img.offsetWidth / 2);
    const left = Math.max(edge, Math.min(want, S.width - card.offsetWidth - edge));
    card.style.left = `${left.toFixed(1)}px`; card.style.right = 'auto';
    const I = img.getBoundingClientRect(), cx = I.left - S.left + I.width / 2, top = I.top - S.top - 6;
    const d = Math.abs(cx - ax) < 1.5 ? `M${ax.toFixed(1)} ${ay.toFixed(1)}V${top.toFixed(1)}`
      : `M${ax.toFixed(1)} ${ay.toFixed(1)}V${(top - 18).toFixed(1)}H${cx.toFixed(1)}V${top.toFixed(1)}`;
    path.setAttribute('d', d);
  };
  const coTick = (t) => { coLayout(); coRaf = t < coUntil ? requestAnimationFrame(coTick) : 0; };
  const coKick = (ms) => { if (!co) return; coUntil = Math.max(coUntil, performance.now() + ms); if (!coRaf) coRaf = requestAnimationFrame(coTick); };
  if (co) { coKick(600); let cw = innerWidth; addEventListener('resize', () => { if (innerWidth === cw && co.parentElement.getBoundingClientRect().bottom < 0) return; cw = innerWidth; coKick(400); }, { passive: true }); addEventListener('load', () => coKick(400)); document.fonts?.ready.then(() => coKick(300)); }

  /* ---------- motion ---------- */
  let ctx = null, tickers = [], heroPtr = null;
  function setupMotion() {
    if (ctx) { ctx.revert(); ctx = null; }
    heroPtr?.abort(); heroPtr = null;
    tickers.forEach((f) => gsap.ticker.remove(f)); tickers = [];
    if (!hasGsap() || reduce.matches) { killLenis(); root.classList.remove('js-motion'); return; }
    gsap.registerPlugin(ScrollTrigger);
    mountLenis();
    const phone = phoneMQ.matches;
    ctx = gsap.context(() => {
      /* hero v2: ÞÓR rises from the floor, the man steps forward, depth on scroll + pointer */
      const h = $('.h2o');
      if (h) {
        const letters = $$('.h2o__word span', h);
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
        tl.fromTo(letters, { yPercent: 105, y: 0, '--w': 200 }, { yPercent: 0, y: 0, '--w': 800, duration: 1.1, stagger: 0.09 }, 0)
          .fromTo('.h2o__man, .h2o__base', { opacity: 0, yPercent: 6, scale: 1.05 }, { opacity: 1, yPercent: 0, scale: 1, duration: 1.3 }, 0.25)
          .fromTo('.h2o [data-fade]', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out' }, 0.75);
        if (co) {
          tl.call(() => coKick(3200), null, 0)
            .fromTo('.callout__dot i', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' }, 1.45)
            .fromTo('.callout__line path', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 1.7)
            .fromTo('.callout__card', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', clearProps: 'transform' }, 2.45);
        }
        window.__heroPlay = () => tl.play();
        if (!root.classList.contains('is-loading')) tl.play();
        // Pointer depth (mouse only; never touch, never reduced motion): ÞÓR drifts against the pointer, Hafþór (cutout +
        // photo together, so they never split) drifts with it. Capped at ±11 px / ±15 px, eased, back to rest on leave.
        // Channels: x/y only. The intro owns yPercent/scale/opacity on the photo and yPercent on the letters (4 Nov jump fix).
        if (fine.matches) {
          const word = $('.h2o__word', h), man = $$('.h2o__man, .h2o__base', h);
          const wx = gsap.quickTo(word, 'x', { duration: 1.1, ease: 'power3.out' }), wy = gsap.quickTo(word, 'y', { duration: 1.1, ease: 'power3.out' });
          const mx = gsap.quickTo(man, 'x', { duration: 1.1, ease: 'power3.out' });
          const clamp = (v) => Math.max(-0.5, Math.min(0.5, v));
          heroPtr = new AbortController();
          h.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = h.getBoundingClientRect();
            const dx = clamp((e.clientX - r.left) / r.width - 0.5), dy = clamp((e.clientY - r.top) / r.height - 0.5);
            wx(-dx * 22); wy(-dy * 10); mx(dx * 30); coKick(1300); }, { signal: heroPtr.signal, passive: true });
          h.addEventListener('pointerleave', () => { wx(0); wy(0); mx(0); coKick(1300); }, { signal: heroPtr.signal });
        }
      } else if ($('[data-fade]')) gsap.set('[data-fade]', { opacity: 1 });

      /* weight scrubs */

      /* drop rail: scrolled by hand; names gain weight at the centre; tees settle as the rail arrives */
      const rail = $('.rail');
      if (rail) {
        const tees = $$('.tee', rail);
        gsap.fromTo(tees, { rotate: (i) => (i % 2 ? 4 : -4) }, { rotate: 0, ease: 'none', scrollTrigger: { trigger: rail, start: 'top bottom', end: 'top 30%', scrub: true } });
      }

      /* reveals (once) */
      // grids and copy: a longer, softer rise; transforms are cleared afterwards so CSS hover/tilt takes over again
      $$('[data-reveal]').forEach((g) => {
        const items = $$(g.dataset.reveal, g); if (!items.length) return;
        gsap.fromTo(items, { y: +(g.dataset.y || 16), opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: +(g.dataset.stagger || 0.05),
          clearProps: 'transform,translate,rotate,scale,opacity', scrollTrigger: { trigger: g, start: 'top 86%', once: true } });
      });
      // the footer signature writes itself once: each pen stroke's real length (getTotalLength, so no pathLength reliance in
      // Safari) is hidden, then drawn in writing order at an even pen speed, ~2.4 s for the whole autograph
      $$('[data-sign]').forEach((svg) => {
        const pens = $$('.sig__pen path', svg); if (!pens.length) return;
        const L = pens.map((q) => q.getTotalLength()), total = L.reduce((a, b) => a + b, 0) || 1;
        pens.forEach((q, i) => { q.style.strokeDasharray = `${L[i]} ${L[i]}`; q.style.strokeDashoffset = L[i]; });
        const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 92%', once: true } });
        pens.forEach((q, i) => tl.to(q, { strokeDashoffset: 0, duration: Math.max(0.02, 2.4 * L[i] / total), ease: 'none' }, i ? '>-0.005' : 0));
      });
      // editorial photos (home: the record still and the story photo): the frame opens upward once while the picture settles
      // from 1.08x. clip-path never moves the trigger box; transforms are cleared after so the CSS hover push-in takes over.
      $$('[data-img-reveal]').forEach((f) => {
        const img = $('img', f);
        gsap.timeline({ scrollTrigger: { trigger: f, start: 'top 85%', once: true } })
          .fromTo(f, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out', clearProps: 'clipPath' })
          .fromTo(img, { scale: 1.08 }, { scale: 1, duration: 1.4, ease: 'expo.out', clearProps: 'transform,scale' }, 0);
      });
      // story timeline: drawn to scale; each milestone appears as the line reaches its year
      const tline = $('.tline');
      if (tline) {
        const t2 = gsap.timeline({ scrollTrigger: { trigger: tline, start: 'top 88%', end: 'top 40%', scrub: 0.6 } });
        t2.fromTo('.tline__fill', { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: 1 }, 0);
        $$('li', tline).forEach((li) => t2.fromTo(li, { opacity: 0, y: 10 }, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.18 }, Math.max(0, +getComputedStyle(li).getPropertyValue('--x') * 0.92 - 0.02)));
      }

      /* record v3: the bar loads to 510 kg, plate by plate (nine 25 kg + one 20 kg a side on a 20 kg bar).
         The total starts at the bar and adds each pair as it lands, so the number is the plates, not a free counter. */
      const bb = $('.bbell');
      if (bb) {
        const num = $('.js-load'), L = $$('.bbell__side--l .plate', bb), Rr = $$('.bbell__side--r .plate', bb);
        let total = 20; num.textContent = '20';
        const tl = gsap.timeline({ paused: true });
        L.forEach((l, i) => {
          const kg = +l.dataset.kg;
          tl.fromTo([l, Rr[i]], { x: (n) => (n === 0 ? -48 : 48), opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'power3.out',
            onStart: () => { total = 20 + 2 * L.slice(0, i + 1).reduce((s, p) => s + +p.dataset.kg, 0); num.textContent = total; } }, i * 0.11);
        });
        tl.fromTo('.record2__lb, .record2__math', { opacity: 0 }, { opacity: 1, duration: 0.4 }, '>-0.1');
        ScrollTrigger.create({ trigger: bb, start: 'top 78%', once: true, onEnter: () => tl.play() });
      }

      /* story: the photo opens from a narrow column to its full frame */
      $$('[data-open-frame]').forEach((fr) => gsap.fromTo(fr, { clipPath: 'inset(0% 32% 0% 32%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: fr, start: 'top 90%', end: 'top 35%', scrub: 0.6 } }));
      if (!phone) $$('[data-drift]').forEach((img) => gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));

      /* page titles arrive */
      $$('[data-arrive]').forEach((t) => {
        gsap.fromTo($$('.line > span', t), { yPercent: 100, y: 0 }, { yPercent: 0, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.08, delay: 0.1 });
        gsap.fromTo(t, { '--w': 300 }, { '--w': +(t.dataset.to || 800), duration: 0.7, ease: 'power2.out', delay: 0.35 });
      });
      /* product stage: the tee settles, the word behind it gains weight */
      if ($('.pdp2__stage')) {
        gsap.fromTo('.pdp2__word', { '--w': 200, yPercent: 20, opacity: 0 }, { '--w': 800, yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', delay: 0.1 });
        gsap.to('.pdp2__cut', { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '.pdp2__stage', start: 'top top', end: 'bottom top', scrub: true } });
      }
    });
    root.classList.add('js-motion');
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  /* ---------- loader: flat mark, one hairline, the slate lifts ---------- */
  function runLoader() {
    const L = $('.loader');
    if (!root.classList.contains('is-loading') || !L) { L && L.remove(); return; }
    requestAnimationFrame(() => L.classList.add('is-in'));
    const imgs = $$('.h2o img, .loader img'); let done = 0;
    const tick = () => { done++; L.style.setProperty('--p', Math.min(done / Math.max(imgs.length, 1), 1)); };
    const ready = Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => {})).then(tick)));
    const minT = new Promise((r) => setTimeout(r, 1100)), maxT = new Promise((r) => setTimeout(r, 2400));
    Promise.race([Promise.all([ready, minT, document.fonts ? document.fonts.ready : 0]), maxT]).then(() => {
      L.style.setProperty('--p', 1);
      setTimeout(() => {
        L.classList.add('is-lifting');            // keeps display:grid while the clip-path transition runs
        root.classList.remove('is-loading');
        try { sessionStorage.setItem('ta-seen', '1'); } catch (_) {}
        window.__heroPlay && window.__heroPlay();
        setTimeout(() => L.remove(), 1100);
      }, 380);
    });
  }

  function navIn() { if (!root.classList.contains('nav-in')) return; const c = $('.curtain'); try { sessionStorage.removeItem('ta-nav'); } catch (_) {}
    requestAnimationFrame(() => requestAnimationFrame(() => { c.classList.add('is-lift'); root.classList.remove('nav-in'); setTimeout(() => c.classList.remove('is-lift'), 900); })); }
  const start = () => { navIn(); try { setupMotion(); } catch (err) { root.classList.remove('js-motion'); console.warn('motion off', err); } runLoader(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  phoneMQ.addEventListener?.('change', () => { try { setupMotion(); } catch (_) {} });
  reduce.addEventListener?.('change', () => { if (ctx) { ctx.revert(); ctx = null; } $$('.js-count, .js-load').forEach((n) => (n.textContent = n.dataset.to)); try { setupMotion(); } catch (_) {} });
  setTimeout(() => { if (!window.gsap) { root.classList.remove('js-motion'); root.classList.remove('is-loading'); $('.loader')?.remove(); } }, 3000);
})();
