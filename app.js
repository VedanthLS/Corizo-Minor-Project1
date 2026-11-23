/* Asha's Kitchen — web app.
 * Business details live in BIZ below: fill them in and every button (WhatsApp, DoorDash, call, directions) uses them.
 */
(function () {
  'use strict';

  // ================= business details (placeholders until the owner sends the real ones) =================
  var BIZ = {
    name: "Asha's Kitchen",
    phone: '+1 (669) 237-2249',  // also the WhatsApp number
    whatsapp: '16692372249',     // digits only with country code
    doordash: '',              // your DoorDash store link, e.g. 'https://www.doordash.com/store/ashas-kitchen-...'
    address: '4035 Evergreen Village Square #20, San Jose, CA 95135',
    onlineOrders: false,       // owner, 16 Nov: orders only at the counter; catering by phone; tables by phone or email
    email: 'ashaskitchensj@gmail.com',
    instagram: 'https://www.instagram.com/ashas.kitchenn/', igHandle: '@ashas.kitchenn',
    comingSoon: true,          // true until the opening: the top bar says "Opening soon" instead of open/closed
    taxRate: 0.0825,           // estimated sales tax (set your local rate)
    prepMinutes: 20,
    // opening hours by weekday (0 = Sunday): [open, close] in 24 h decimal hours (sample)
    // opening hours by weekday (0 = Sunday): list of [open, close] shifts in 24 h decimal hours; [] = closed
    hours: { 0: [[8, 14.5], [17, 22]], 1: [[8, 14.5], [17, 22]], 2: [], 3: [[8, 14.5], [17, 22]], 4: [[8, 14.5], [17, 22]], 5: [[8, 14.5], [17, 22]], 6: [[8, 14.5], [17, 22]] },
  };

  // ================= table QR: a guest who scans the code on a table orders from that table =================
  var TABLE = null, _tableOff = (function () {
    var q = new URLSearchParams(location.search).get('table');
    if (q && /^[A-Za-z0-9-]{1,6}$/.test(q)) { try { sessionStorage.setItem('ak-table', q); } catch (e) {} return q; }
    try { return sessionStorage.getItem('ak-table'); } catch (e) { return null; }
  })();
  var TABLE_FRESH = false;

  // ================= helpers =================
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = function (n) { return '$' + (Math.round(n * 100) / 100).toFixed(2); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isPhone = function () { return window.innerWidth <= 820; };
  var PHOTO = {};
  var IMG = function (k, w, q) {
    if (!k) return '';
    var u = /^(https?:|img\/|intro\/|data:)/.test(k) ? k : (PHOTO[k] || 'img/p/' + k + '.webp');
    return /cdn\.sanity\.io/.test(u) ? u + (u.indexOf('?') < 0 ? '?' : '&') + 'w=' + (w || 1100) + '&fit=max&auto=format&q=' + (q || 82) : u;
  };
  var HEAT = ['Mild', 'Medium', 'Andhra Hot'];
  var DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var icon = function (id, s) { return '<svg width="' + (s || 18) + '" height="' + (s || 18) + '"><use href="#i-' + id + '"/></svg>'; };
  var fmtTime = function (h) { var hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh++; mm = 0; } var ap = hh >= 12 && hh < 24 ? 'PM' : 'AM', h12 = ((hh + 11) % 12) + 1; return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap; };

  // ================= state =================
  var MENU = null, BYID = {}, BYIMG = {}, INGR = null;
  var bag = store.get('ak-bag', []);           // [{id, qty, heat, note}]
  var favs = store.get('ak-fav', []);
  var heatPref = store.get('ak-heat', 1);
  var filters = { q: '', veg: false, vegan: false, gf: false, nf: false, saved: false };
  var scanStream = null, scanTimer = 0;
  var lenis = null;

  // ================= smooth scroll =================
  function initScroll() {
    if (!reduce && window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    var hd = $('#hd'), last = 0;
    var onScroll = function () {
      var y = window.scrollY;
      hd.classList.toggle('hide', y > 260 && y > last + 2 && !document.body.classList.contains('locked'));
      if (y < last - 2 || y < 260) hd.classList.remove('hide');
      last = y;
      parallax();
      updateJourney();
      if (annaArmed && y > innerHeight * .55) annaMaybe();
      var hz = document.getElementById('top'); if (hz) hz.style.setProperty('--sy', Math.min(1.5, y / Math.max(1, hz.offsetHeight)).toFixed(3));
      var sp = $('#sprog'); if (sp) sp.style.transform = 'scaleX(' + Math.min(1, y / Math.max(1, document.documentElement.scrollHeight - innerHeight)).toFixed(4) + ')';
    };
    if (lenis) lenis.on('scroll', onScroll); else window.addEventListener('scroll', onScroll, { passive: true });
  }
  function scrollToId(id) {
    var t = document.getElementById(id); if (!t) return;
    var off = id.indexOf('cat-') === 0 ? -150 : (id === 'top' ? 0 : -70);
    if (lenis) lenis.scrollTo(t, { offset: off, duration: 1.3 });
    else window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY + off, behavior: 'smooth' });
  }
  function lock(on) {
    on = on || (typeof mpOpen !== 'undefined' && mpOpen);
    document.body.classList.toggle('locked', on);
    if (lenis) { if (on) lenis.stop(); else lenis.start(); }
    document.documentElement.style.overflow = on ? 'hidden' : '';
  }

  // ================= soft fades, parallax, tilt, glow =================
  var io = null;
  function reveal(root) {
    var els = $$('.fx:not(.in)', root);
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    if (!io) io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
  }
  var parEls = [];
  function parallax() {
    if (reduce) return;
    var vh = window.innerHeight;
    parEls.forEach(function (e) {
      var r = e.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
      var k = parseFloat(e.getAttribute('data-par')), c = (r.top + r.height / 2 - vh / 2);
      e.style.transform = (e.dataset.base || '') + ' translate3d(0,' + (c * k).toFixed(1) + 'px,0)';
    });
  }
  function tilt(el) {
    if (reduce || matchMedia('(hover: none)').matches) return;
    el.addEventListener('pointermove', function (e) {
      if (el.classList.contains('fx') && !el.classList.contains('in')) return;
      el.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1), opacity 1s, filter 1s';
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = 'perspective(1100px) rotateY(' + (x * 5).toFixed(2) + 'deg) rotateX(' + (-y * 5).toFixed(2) + 'deg)';
    });
    el.addEventListener('pointerleave', function () { el.style.transform = ''; });
  }
  document.addEventListener('pointermove', function (e) {
    var b = e.target.closest && e.target.closest('.btn'); if (!b) return;
    var r = b.getBoundingClientRect(); b.style.setProperty('--mx', (e.clientX - r.left) + 'px'); b.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });

  document.addEventListener('pointermove', function (e) {
    var c = e.target.closest && e.target.closest('.item, .tile, .way, .spice, .jr-step, .mp-photo .pf, .ghee-art, .spot-card, .sr-row, .mp-nx'); if (!c) return;
    var r = c.getBoundingClientRect(); c.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); c.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  }, { passive: true });
  (function () {
    var hero = document.getElementById('top'); if (!hero || reduce) return;
    hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); hero.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5).toFixed(3)); hero.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5).toFixed(3)); }, { passive: true });
    hero.addEventListener('pointerleave', function () { hero.style.setProperty('--px', 0); hero.style.setProperty('--py', 0); });
  })();
  // bees drift around the ghee jars and scatter from the pointer
  (function () {
    var box = document.getElementById('bees'); if (!box || reduce) return;
    var art = box.parentElement, bees = $$('.bee', box), vis = false, px = -9, py = -9, t0 = performance.now();
    var P = [[.30, .40, .17, .13, .9, 1.3, 0], [.58, .26, .2, .1, 1.1, .8, 2], [.74, .58, .14, .16, .7, 1.1, 4], [.46, .72, .2, .09, 1.25, .9, 1]];
    var st = bees.map(function () { return { x: .5, y: .5, ox: 0, oy: 0, a: 0 }; });
    art.addEventListener('pointermove', function (e) { var r = art.getBoundingClientRect(); px = (e.clientX - r.left) / r.width; py = (e.clientY - r.top) / r.height; });
    art.addEventListener('pointerleave', function () { px = py = -9; });
    new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis) requestAnimationFrame(fly); }).observe(art);
    function fly(now) {
      if (!vis) return;
      var t = (now - t0) / 1000, W = art.clientWidth, H = art.clientHeight;
      bees.forEach(function (b, i) {
        var p = P[i], s = st[i];
        var x = p[0] + p[2] * Math.sin(t * p[4] * .6 + p[6]) + .035 * Math.sin(t * 3.1 * p[4] + p[6]);
        var y = p[1] + p[3] * Math.sin(t * p[5] * .6 + p[6] * 1.3) + .03 * Math.cos(t * 2.7 + p[6]);
        var dx = x + s.ox - px, dy = y + s.oy - py, d = Math.sqrt(dx * dx + dy * dy);
        if (d < .16) { s.ox += dx / (d + .001) * .02; s.oy += dy / (d + .001) * .02; }
        s.ox *= .965; s.oy *= .965;
        var nx = x + s.ox, ny = y + s.oy, vx = nx - s.x, vy = ny - s.y;
        if (Math.abs(vx) + Math.abs(vy) > .0004) s.a = Math.atan2(vy * H, vx * W);
        s.x = nx; s.y = ny;
        var left = Math.cos(s.a) < 0, ang = left ? s.a - Math.PI : s.a;
        b.style.transform = 'translate3d(' + (s.x * W).toFixed(1) + 'px,' + (s.y * H).toFixed(1) + 'px,0) rotate(' + (ang * 57.3 * .35).toFixed(1) + 'deg) scaleX(' + (left ? -1 : 1) + ')';
      });
      requestAnimationFrame(fly);
    }
  })();
  // the map stays a calm preview until tapped, so it never traps page scrolling
  (function () {
    var box = document.getElementById('mapbox'), sh = document.getElementById('mapShield'); if (!box || !sh) return;
    sh.addEventListener('click', function () { box.classList.add('live'); });
    box.addEventListener('mouseleave', function () { box.classList.remove('live'); });
    document.addEventListener('touchstart', function (e) { if (!box.contains(e.target)) box.classList.remove('live'); }, { passive: true });
  })();
  function splitWordmark() {
    var w = $('#wordmark'); if (!w || w.dataset.split) return; w.dataset.split = 1;
    w.innerHTML = w.textContent.split('').map(function (ch, i) { return ch === ' ' ? '<span class="sp"> </span>' : '<span style="--i:' + i + '">' + esc(ch) + '</span>'; }).join('');
  }

  // ================= hours =================
  function hoursToday(d) { return BIZ.hours[d.getDay()] || []; }
  function nowHour(d) { return d.getHours() + d.getMinutes() / 60; }
  function isOpen(d) { var t = nowHour(d); return hoursToday(d).some(function (r) { return t >= r[0] && t < r[1]; }); }
  function fmtShifts(rs) { return rs && rs.length ? rs.map(function (r) { return fmtTime(r[0]) + ' – ' + fmtTime(r[1]); }).join(', ') : 'Closed'; }
  function nextOpening(now) {
    var t = nowHour(now);
    for (var k = 0; k < 8; k++) {
      var d = new Date(now); d.setDate(d.getDate() + k);
      var rs = BIZ.hours[d.getDay()] || [];
      for (var j = 0; j < rs.length; j++) if (k > 0 || rs[j][0] > t) return 'Opens ' + (k === 0 ? fmtTime(rs[j][0]) + ' today' : k === 1 ? 'tomorrow ' + fmtTime(rs[j][0]) : DAY[d.getDay()] + ' ' + fmtTime(rs[j][0]));
    }
    return '';
  }
  function renderHours() {
    var now = new Date(), open = isOpen(now), rows = '';
    for (var i = 1; i <= 7; i++) { var d = i % 7, x = BIZ.hours[d] || []; rows += '<div class="' + (d === now.getDay() ? 'on' : '') + (x.length ? '' : ' shut') + '"><span>' + (d === now.getDay() ? 'Today, ' : '') + DAY[d] + '</span><span>' + (x.length ? x.map(function (r) { return '<em>' + fmtTime(r[0]) + ' – ' + fmtTime(r[1]) + '</em>'; }).join('') : 'Closed') + '</span></div>'; }
    $('#hours').innerHTML = rows;
    if (BIZ.comingSoon) { $('#openNow').textContent = 'Opening soon'; $('#liveDot').classList.add('soon'); $('#todayHours').textContent = (CONTENT && CONTENT.settings && CONTENT.settings.comingSoonLine) || 'Opening soon'; return; }
    $('#openNow').textContent = open ? 'Open now' : 'Closed now';
    $('#liveDot').classList.toggle('off', !open);
    var cur = hoursToday(now).filter(function (r) { var t = nowHour(now); return t >= r[0] && t < r[1]; })[0];
    $('#todayHours').textContent = open ? 'Until ' + fmtTime(cur[1]) + ' today' : nextOpening(now);
  }

  // ================= business links =================
  function waUrl(text) { return 'https://wa.me/' + (BIZ.whatsapp || '') + '?text=' + encodeURIComponent(text || ("Hi Asha's Kitchen! ")); }
  function ddUrl() { return BIZ.doordash || 'https://www.doordash.com/search/store/' + encodeURIComponent(BIZ.name) + '/'; }
  function telHref() { return 'tel:' + BIZ.phone.replace(/[^+\d]/g, ''); }
  function mailHref(subject, body) { return 'mailto:' + BIZ.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body); }
  function wireBiz() {
    var q = encodeURIComponent(BIZ.address);
    $('#dirLink').href = 'https://www.google.com/maps/dir/?api=1&destination=' + q;
    var gm = $('#gmap'); if (gm) gm.src = 'https://www.google.com/maps?q=' + q + '&z=17&output=embed';
    $('#addr').textContent = BIZ.address; $('#addr').classList.remove('ph'); $('#tbAddr').textContent = (CONTENT && CONTENT.settings && CONTENT.settings.shortAddress) || BIZ.address; $('#tbAddr').classList.remove('ph');
    var t = $('#tel'); t.textContent = BIZ.phone; t.href = telHref(); t.classList.remove('ph');
    var m = $('#mail'); m.textContent = BIZ.email; m.href = 'mailto:' + BIZ.email; m.classList.remove('ph');
    $('#yr').textContent = new Date().getFullYear();
    var dd = $('#ddLink'); if (dd) { if (BIZ.doordash) { dd.href = BIZ.doordash; dd.target = '_blank'; dd.rel = 'noopener'; dd.textContent = 'Order on DoorDash'; } else dd.classList.add('soon'); }
    $$('.js-dd').forEach(function (a) { if (BIZ.doordash) { a.href = BIZ.doordash; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'DoorDash delivery'; } });
    if (BIZ.instagram) $$('.js-ig').forEach(function (a) { a.href = BIZ.instagram; a.target = '_blank'; a.rel = 'noopener'; if (a.dataset.handle != null) a.textContent = BIZ.igHandle; a.classList.remove('ph'); });
    $$('.js-dir').forEach(function (a) { a.href = $('#dirLink').href; });
    $$('.js-apple').forEach(function (a) { a.href = 'https://maps.apple.com/?daddr=' + q; });
    $$('.js-addr').forEach(function (a) { a.textContent = BIZ.address; a.classList.remove('ph'); });
    $$('.js-call').forEach(function (a) { a.href = telHref(); });
    $$('.hd .btn.js-call').forEach(function (a) { a.textContent = 'Call ' + BIZ.phone.replace('+1 ', ''); });
    $$('.js-tel').forEach(function (a) { a.textContent = BIZ.phone; a.href = telHref(); a.classList.remove('ph'); });
    $$('.js-mail').forEach(function (a) { a.textContent = BIZ.email; a.href = 'mailto:' + BIZ.email; a.classList.remove('ph'); });
    $$('.js-mail-banquet').forEach(function (a) { a.href = mailHref("Banquet hall enquiry", "Hi Asha's Kitchen,\n\nI'd like to ask about the banquet hall.\n\nOccasion:\nDate:\nNumber of guests:\nDécor needed (yes/no):\nCatering needed (yes/no):\n\nName:\nPhone:\n"); });
    var mo = $('#mapOpen'); if (mo) mo.textContent = BIZ.comingSoon ? 'Opening soon' : (isOpen(new Date()) ? 'Open now' : nextOpening(new Date()));
  }

  // ================= rendering =================
  function card(it, cls, delay) {
    var tags = it.tags.map(function (t) { return t === 'V' ? '<span class="tag V">' + icon('leaf', 11) + 'VEGAN</span>' : '<span class="tag ' + t + '">' + ({ VG: 'VEG', GF: 'GF', N: 'NUTS' })[t] + '</span>'; }).join('');
    if (it.weekend) tags = '<span class="tag wk">WEEKEND</span>' + tags; else if (it.signature) tags = '<span class="tag sig">ASHA\'S</span>' + tags;
    return '<article class="item fx ' + (it.vegan ? 'is-vegan ' : '') + (cls || '') + '"' + (delay ? ' style="--d:' + delay + 's"' : '') + ' data-id="' + it.id + '" tabindex="0">' +
      '<div class="im"><img src="' + IMG(it.img) + '" alt="' + esc(it.name) + '" loading="lazy" decoding="async"><div class="tags">' + tags + '</div></div>' +
      '<div class="it-b">' + (it.from ? '<p class="from">' + esc(it.from) + '</p>' : '') +
      '<div class="nm"><h4>' + esc(it.name) + '</h4><button class="fav' + (favs.indexOf(it.id) >= 0 ? ' on' : '') + '" data-fav="' + it.id + '" aria-label="Save">' + icon('heart', 18) + '</button></div>' +
      '<p>' + esc(it.desc) + '</p><span class="new">' + esc(it.explain) + '</span>' +
      '<div class="pline"><b>' + money(it.price) + '</b><span>Details ' + icon('arrow', 14) + '</span></div></div></article>';
  }
  function renderAll() {
    var items = MENU.items;
    $('#itemCount').textContent = items.length;
    // ticker
    var words = TICKER;
    var t = words.map(function (w) { return w + '<i>✦</i>'; }).join('');
    $('#ticker').innerHTML = t + t;
    // specials
    var spec = SPEC;
    $('#rail').innerHTML = spec.map(function (k, i) { var it = BYIMG[k]; return it ? card(it, '', (i * .06).toFixed(2)) : ''; }).join('');
    renderDay();
    // ghee shop
    $('#prods').innerHTML = PRODS.map(function (k) { return BYIMG[k] ? card(BYIMG[k]) : ''; }).join('');
    $$('.hot').forEach(function (h) { var it = BYID[h.dataset.dish]; if (it) $('b', h).textContent = money(it.price); });
    $$('.pc[data-dish]').forEach(function (h) { var it = BYID[h.dataset.dish]; if (it) { $('em', h).textContent = shortName(it.name); $('b', h).textContent = money(it.price); h.setAttribute('aria-label', it.name); } });
    renderMap(); renderSpices(); renderTrivia(); renderJourney(); splitWordmark();
  }

  // ================= menu as separate pages, one per moment of the day =================
  var ORDER = ['drinks', 'tiffins', 'starters', 'curries', 'biryani', 'breads', 'desserts', 'ghee'];
  var MOM = {
    morning: { name: 'Morning', when: 'Breakfast', clock: 8, cats: ['drinks', 'tiffins'], line: 'Filter coffee first, then the tiffins: soft idlis, crisp vadas and golden dosas.' },
    lunch: { name: 'Lunch & dinner', when: 'The meal', clock: 13, cats: ['starters', 'curries', 'biryani', 'breads'], line: 'Appetizers first, then Andhra curries, biryani sealed on dum, and bread and rice to mop up every drop.' },
    evening: { name: 'Something sweet', when: 'To finish', clock: 21, cats: ['desserts'], line: 'Gulab jamun, rasmalai and kesari: the traditional way to end the meal.' },
    pantry: { name: 'Take home', when: 'Any time', clock: null, cats: ['ghee'], line: "Sowaka ghee, fresh batter and today's curry for your own table." }
  };
  var KICK = { drinks: 'Good morning · Coffee & chai first', tiffins: 'Good morning · Tiffin time', biryani: 'Lunch is on · Sealed on dum', curries: 'Lunch & dinner · From the pot', starters: 'Lunch & dinner · Appetizers', vegan: 'Plant-based · No dairy, no ghee', breads: 'Lunch & dinner · On the side', desserts: 'To finish · Something sweet', ghee: 'Take the kitchen home' };
  var CAT = {};
  function momentOf(id) { for (var k in MOM) if (MOM[k].cats.indexOf(id) >= 0) return k; return 'lunch'; }
  function clock(h) {
    var t = ''; for (var i = 0; i < 12; i++) t += '<line x1="20" y1="3.6" x2="20" y2="' + (i % 3 ? 5.4 : 7) + '" transform="rotate(' + i * 30 + ' 20 20)"/>';
    return '<svg class="clock" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.4"/><g class="tk">' + t + '</g><line class="hh" x1="20" y1="20" x2="20" y2="11" style="--a:' + ((h % 12) * 30) + 'deg"/><line class="mh" x1="20" y1="20" x2="20" y2="6.6" style="--a:0deg"/><circle class="cd" cx="20" cy="20" r="1.9"/></svg>';
  }
  var JAR = '<svg class="clock" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.4"/><path d="M14 13h12v3l2 3v11a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V19l2-3z" fill="none" stroke-width="1.6"/><path d="M13 22h14" stroke-width="1.4"/></svg>';
  function tileHtml(c, i) {
    return '<div class="tile fx" style="--d:' + (i * .07).toFixed(2) + 's" data-go="cat-' + c.id + '"><img src="' + IMG(c.img, 900) + '" alt="" loading="lazy"><div class="tt"><h3>' + esc(c.name) + '</h3></div><span class="count">' + c.count + ' ' + (c.id === 'drinks' ? 'drinks' : c.id === 'ghee' ? 'items' : 'dishes') + ' &nbsp;→</span></div>';
  }
  function renderDay() {
    MENU.categories.forEach(function (c) { CAT[c.id] = c; });
    var vg = MENU.items.filter(function (it) { return it.vegan; });
    CAT.vegan = { id: 'vegan', name: 'Vegan menu', blurb: vg.length + ' dishes with no dairy and no ghee, from vegan chai to Andhra curries.', img: 'kara-dosa', count: vg.length };
    var vn = $('#veganN'); if (vn) vn.textContent = vg.length;
    $('#day').innerHTML = Object.keys(MOM).map(function (k) {
      var M = MOM[k];
      return '<div class="moment" data-m="' + k + '"><div class="mlabel fx"><div class="mwhen">' + (M.clock != null ? clock(M.clock) : JAR) + '<span>' + (M.clock != null ? fmtTime(M.clock) + ' · ' : '') + esc(M.when) + '</span></div><h3>' + esc(M.name) + '</h3><p>' + esc(M.line) + '</p></div>' +
        '<div class="mtiles n' + M.cats.length + '">' + M.cats.map(function (id, i) { return tileHtml(CAT[id], i); }).join('') + '</div></div>';
    }).join('');
  }
  function scene(m) {
    var h = '<div class="sky"></div><div class="sun"></div><div class="rays"></div>', i;
    if (m === 'morning') {
      [[16, 30, -6, 1], [24, 37, -17, .78], [12, 44, -29, .62]].forEach(function (b) { h += '<span class="bird" style="--y:' + b[0] + '%;--t:' + b[1] + 's;--dl:' + b[2] + 's;--s:' + b[3] + '"><svg viewBox="0 0 24 10"><path d="M1 7 Q6 1 12 7 Q18 1 23 7"/></svg></span>'; });
      h += '<div class="mist"></div>';
    }
    if (m === 'lunch') h += '<svg class="leaf l1" viewBox="0 0 120 300"><path d="M60 300 C 6 220, -4 110, 60 0 C 124 110, 114 220, 60 300Z"/><path class="rib" d="M60 296 L60 8"/></svg><svg class="leaf l2" viewBox="0 0 120 300"><path d="M60 300 C 6 220, -4 110, 60 0 C 124 110, 114 220, 60 300Z"/><path class="rib" d="M60 296 L60 8"/></svg>';
    if (m === 'evening') {
      var pts = [], bulbs = '';
      for (i = 0; i <= 40; i++) { var x = i / 40, f = x < .5 ? x / .5 : (x - .5) / .5; pts.push((x * 1000).toFixed(0) + ',' + (10 + 50 * Math.sin(Math.PI * f)).toFixed(1)); }
      for (i = 1; i < 20; i++) { var x2 = i / 20, f2 = x2 < .5 ? x2 / .5 : (x2 - .5) / .5; bulbs += '<i style="left:' + (x2 * 100).toFixed(1) + '%;top:' + (10 + 50 * Math.sin(Math.PI * f2) + 2).toFixed(1) + 'px;--dl:' + (-(i * .53) % 2.4).toFixed(2) + 's"></i>'; }
      h += '<div class="lights"><svg viewBox="0 0 1000 80" preserveAspectRatio="none"><polyline points="' + pts.join(' ') + '"/></svg>' + bulbs + '</div>';
      var seed = 7; for (i = 0; i < 28; i++) { seed = (seed * 9301 + 49297) % 233280; var a = seed / 233280; seed = (seed * 9301 + 49297) % 233280; var b2 = seed / 233280; h += '<i class="star" style="left:' + (a * 100).toFixed(1) + '%;top:' + (16 + b2 * 34).toFixed(1) + '%;--dl:' + (-(a * 3)).toFixed(2) + 's"></i>'; }
    }
    if (m === 'pantry') h += '<div class="window"></div>';
    return h + '<div class="haze"></div>';
  }
  var STEAM = '<svg class="steam" viewBox="0 0 120 140" aria-hidden="true"><path d="M40 140 C 26 110, 54 92, 40 64 S 50 24, 40 0"/><path d="M62 140 C 48 112, 76 90, 62 60 S 72 22, 62 0"/><path d="M84 140 C 70 108, 98 92, 84 66 S 94 26, 84 2"/></svg>';
  function renderCat(id) {
    var c = CAT[id], m = momentOf(id), M = id === 'vegan' ? { clock: null, line: VEGAN_LINE } : MOM[m];
    var list = id === 'vegan' ? MENU.items.filter(function (it) { return it.vegan; }).map(function (it) { return Object.assign({}, it, { sub: CAT[it.cat].name }); }) : MENU.items.filter(function (it) { return it.cat === id; }), subs = [];
    list.forEach(function (it) { if (subs.indexOf(it.sub) < 0) subs.push(it.sub); });
    var vegN = list.filter(function (it) { return it.veg; }).length, min = Math.min.apply(null, list.map(function (it) { return it.price; }));
    var star = list.filter(function (it) { return it.signature || it.weekend; })[0] || list[0];
    var f = [['veg', 'Vegetarian'], ['vegan', 'Vegan'], ['gf', 'Gluten-free'], ['nf', 'Nut-free'], ['saved', '♥ Saved']], ex = document.body.classList.contains('explain');
    var k = ORDER.indexOf(id), nx = ORDER[(k + 1) % ORDER.length], pv = ORDER[(k + ORDER.length - 1) % ORDER.length];
    return '<section class="mp-hero play" id="mpHero" data-m="' + m + '"><div class="scene">' + scene(m) + '</div>' +
      '<div class="mp-in"><div class="mp-txt">' +
        '<div class="mp-when">' + (M.clock != null ? clock(M.clock) + '<span><b>' + fmtTime(M.clock) + '</b>' : (id === 'vegan' ? '<span class="leafc">' + icon('leaf', 22) + '</span>' : JAR) + '<span><b>' + (id === 'vegan' ? '100% vegan' : 'Any time') + '</b>') + esc(KICK[id]) + '</span></div>' +
        '<h2>' + esc(c.name) + '</h2><p>' + esc(c.blurb) + ' ' + esc(M.line) + '</p>' +
        '<div class="mp-meta"><span>' + list.length + (id === 'drinks' ? ' drinks' : id === 'ghee' ? ' items' : ' dishes') + '</span>' + (vegN && id !== 'drinks' && id !== 'ghee' && id !== 'vegan' ? '<span>' + vegN + ' vegetarian</span>' : '') + '<span>From ' + money(min) + '</span></div>' +
      '</div><div class="mp-photo"><div class="pf"><img src="' + IMG(c.img, 1100) + '" alt="' + esc(c.name) + '">' + STEAM + '</div>' +
        (star ? '<button class="mp-loved" data-dish="' + star.id + '"><img src="' + IMG(star.img) + '" alt=""><span><small>' + (star.weekend ? 'WEEKEND SPECIAL' : star.signature ? 'ASHA\'S FAVOURITE' : 'TRY FIRST') + '</small><b>' + esc(star.name) + '</b><em>' + money(star.price) + '</em></span></button>' : '') +
      '</div></div></section>' +
      '<div class="mp-bar"><div class="mp-pills">' + ORDER.concat(['vegan']).map(function (o) { return '<button class="mp-pill' + (o === id ? ' on' : '') + '" data-cat="' + o + '"><i class="dot" data-m="' + (o === 'vegan' ? 'vegan' : momentOf(o)) + '"></i>' + esc(CAT[o].name) + '</button>'; }).join('') + '</div>' +
        '<div class="mp-tools">' + f.map(function (x) { return '<button class="chip' + (filters[x[0]] ? ' on' : '') + '" data-filter="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
        '<button class="toggle' + (ex ? ' on' : '') + '" id="explainT" aria-pressed="' + ex + '"><span>New to Indian food? Explain dishes</span><i></i></button></div></div>' +
      '<div class="mp-body" id="mpBody">' + subs.map(function (sb) {
        var l = list.filter(function (it) { return it.sub === sb; });
        return (sb ? '<p class="mgroup-sub">' + esc(sb) + '</p>' : '') + '<div class="grid">' + l.map(function (it, n) { return card(it, '', (n % 4 * .06).toFixed(2)); }).join('') + '</div>';
      }).join('') + '<p class="empty" id="empty">Nothing on this page matches those filters.</p></div>' +
      '<div class="mp-next"><button class="mp-prev" data-cat="' + pv + '">' + icon('arrow', 16) + '<span>' + esc(CAT[pv].name) + '</span></button>' +
        '<button class="mp-nx" data-cat="' + nx + '" data-m="' + momentOf(nx) + '"><img src="' + IMG(CAT[nx].img, 300) + '" alt=""><span><small>Next up · ' + esc(MOM[momentOf(nx)].name) + '</small><b>' + esc(CAT[nx].name) + '</b></span>' + icon('arrow', 22) + '</button></div>';
  }
  var mpOpen = false, mpCat = null, mpN = 0;
  function openCat(id, push) {
    if (!CAT[id]) return;
    var pg = $('#mpage'), first = !mpOpen;
    if (layer) closeLayer(true, true);
    $('#scrim').classList.remove('on');
    var draw = function () {
      mpCat = id; $('#mpView').innerHTML = renderCat(id);
      pg.dataset.m = momentOf(id); pg.scrollTop = 0;
      applyFilters(); reveal($('#mpView')); bindScene(); annaOnCat(id);
      requestAnimationFrame(function () { pg.classList.remove('swap'); });
    };
    if (first) { mpOpen = true; lock(true); draw(); pg.classList.add('on'); }
    else { pg.classList.add('swap'); setTimeout(draw, reduce ? 0 : 300); }
    if (push !== false) {
      var g = history.state && history.state.g ? { g: 1 } : {};
      if (layerH) { layerH = false; mpN = first ? 1 : mpN + 1; history.replaceState(Object.assign(g, { cat: id, mp: mpN }), '', '#menu-' + id); }
      else if (first) { mpN = 1; history.pushState(Object.assign(g, { cat: id, mp: 1 }), '', '#menu-' + id); }
      else history.replaceState(Object.assign(g, { cat: id, mp: mpN }), '', '#menu-' + id);
    }
  }
  function closeMp(viaPop) {
    if (!mpOpen) return;
    if (!viaPop) {
      var n = layerH ? 1 : 0;
      if (layer) closeLayer(true, true);
      layerH = false;
      if (mpN) { history.go(-(n + mpN)); return; }
      if (n) { popSkip++; history.back(); }
    }
    mpOpen = false; mpN = 0; $('#mpage').classList.remove('on');
    if (!layer) lock(false);
    if (location.hash.indexOf('#menu-') === 0) history.replaceState(history.state && history.state.g ? { g: 1 } : null, '', location.pathname + location.search);
  }
  // phones: one stray edge swipe on the home page shows a hint instead of leaving
  var guardOn = false, touchy = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  document.addEventListener('click', function () {
    if (!touchy || guardOn || mpOpen || layer) return;
    var s = history.state; if (s && (s.g || s.cat || s.layer)) return;
    history.pushState({ g: 1 }, '', location.href); guardOn = true;
  }, true);
  window.addEventListener('popstate', function () {
    if (popSkip) { popSkip--; return; }
    var st = history.state || {};
    if (layer && !st.layer) { layerH = false; closeLayer(false, true); }
    var mm = location.hash.match(/^#menu-([a-z]+)/);
    if (mm) { if (!mpOpen || mpCat !== mm[1]) openCat(mm[1], false); mpN = st.mp || 0; return; }
    if (mpOpen) { closeMp(true); return; }
    if (guardOn && !st.g && !st.layer) { guardOn = false; toast('<span>Swipe back again to leave Asha’s Kitchen</span>'); }
  });
  function bindScene() {
    var hero = $('#mpHero'); if (!hero || reduce) return;
    hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); hero.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5).toFixed(3)); hero.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5).toFixed(3)); });
    hero.addEventListener('pointerleave', function () { hero.style.setProperty('--px', 0); hero.style.setProperty('--py', 0); });
    var ph = $('.mp-photo .pf', hero); if (ph) tilt(ph);
  }
  $('#mpage').addEventListener('scroll', function () { var h = $('#mpHero'); if (h) h.style.setProperty('--sy', Math.min(1, this.scrollTop / 600).toFixed(3)); }, { passive: true });

  // ================= filters (inside a menu page) + search (home) =================
  function applyFilters() {
    var body = $('#mpBody'), any = 0; if (!body) return;
    $$('.item', body).forEach(function (el) {
      var it = BYID[el.dataset.id], ok = true;
      if (filters.veg) ok = it.veg;
      if (ok && filters.vegan) ok = it.vegan;
      if (ok && filters.gf) ok = it.tags.indexOf('GF') >= 0;
      if (ok && filters.nf) ok = it.tags.indexOf('N') < 0;
      if (ok && filters.saved) ok = favs.indexOf(it.id) >= 0;
      el.style.display = ok ? '' : 'none'; if (ok) any++;
    });
    $$('.grid', body).forEach(function (gr) { var v = $$('.item', gr).some(function (e) { return e.style.display !== 'none'; }); gr.style.display = v ? '' : 'none'; var sb = gr.previousElementSibling; if (sb && sb.classList.contains('mgroup-sub')) sb.style.display = v ? '' : 'none'; });
    var em = $('#empty', body); if (em) em.style.display = any ? 'none' : 'block';
  }
  function renderSearch(q) {
    var box = $('#sres'); q = (q || '').trim().toLowerCase();
    if (q.length < 2) { box.classList.remove('on'); box.innerHTML = ''; return; }
    var hits = MENU.items.filter(function (it) { return (it.name + ' ' + it.desc + ' ' + it.from + ' ' + (it.vegan ? 'vegan ' : '') + (it.veg ? 'vegetarian veg ' : '') + CAT[it.cat].name).toLowerCase().indexOf(q) >= 0; });
    box.innerHTML = hits.length
      ? '<p class="sres-hd">' + hits.length + (hits.length === 1 ? ' dish' : ' dishes') + '</p>' + hits.slice(0, 8).map(function (it) { return '<button class="sr-row" data-dish="' + it.id + '"><img src="' + IMG(it.img) + '" alt=""><span><b>' + esc(it.name) + '</b><small>' + esc(CAT[it.cat].name) + '</small></span><em>' + money(it.price) + '</em></button>'; }).join('') + (hits.length > 8 ? '<p class="sres-more">Keep typing to narrow it down</p>' : '')
      : '<p class="sres-hd">Nothing matches that yet. Try “dosa”, “paneer” or “vegan”.</p>';
    box.classList.add('on');
  }
  function spy() {}

  // ================= dish sheet =================
  var PAIR = { biryani: ['lassi', 'jamun'], curries: ['parotta', 'rice'], dosas: ['coffee', 'side-sambar'], tiffins: ['coffee', 'chutneys'], starters: ['lime-soda', 'lassi'], drinks: ['osmania', 'bun-maska'], desserts: ['coffee', 'masala-chai'], breads: ['butter', 'gongura'], ghee: ['dosa-batter', 'roti-pack'] };
  var sheetState = null;
  function openDish(id) {
    var it = BYID[id]; if (!it) return;
    sheetState = { id: id, qty: 1, heat: heatPref, note: '' };
    var pairs = (PAIR[it.cat] || []).map(function (k) { return BYIMG[k]; }).filter(function (p) { return p && p.id !== id; });
    var tags = it.tags.map(function (t) { return '<span class="tag ' + t + '">' + ({ V: 'VEGAN', VG: 'VEGETARIAN', GF: 'GLUTEN-FREE', N: 'CONTAINS NUTS' })[t] + '</span>'; }).join(' ');
    $('#sheet').innerHTML =
      '<button class="icon-btn close" data-close aria-label="Close">' + icon('x') + '</button>' +
      '<div class="mcol">' + ingrHtml(id) + '<div class="media" data-tilt><img src="' + IMG(it.img) + '" alt="' + esc(it.name) + '"></div></div>' +
      '<div class="body">' +
        (it.from ? '<p class="kicker">' + esc(it.from) + '</p>' : '') +
        '<h3>' + esc(it.name) + '</h3><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="price">' + money(it.price) + '</span>' + tags + (it.weekend ? ' <span class="tag wk">WEEKENDS ONLY</span>' : '') + '</div>' +
        '<p class="desc">' + esc(it.desc) + '</p>' +
        '<p class="new"><b>New to it?</b> ' + esc(it.explain) + '</p>' +
        (it.heat ? '<span class="label">Spice levels</span><div class="heat3">' + HEAT.map(function (h, i) { return '<span class="h' + i + '">' + h + '</span>'; }).join('') + '</div><p class="hnote">Tell us your level when you order.</p>' : '') +
        (pairs.length ? '<span class="label">Goes well with</span><div class="upsell">' + pairs.map(function (p) { return '<button data-dish="' + p.id + '"><img src="' + IMG(p.img) + '" alt="">' + esc(p.name) + ' · ' + money(p.price) + ' ' + icon('arrow', 14) + '</button>'; }).join('') + '</div>' : '') +
        '<div class="howto"><span>' + icon('bag', 20) + '</span><p><b>Order at the counter.</b> Tell us about allergies or your spice level when you order.</p><a class="icon-btn js-call" href="' + telHref() + '" aria-label="Call">' + icon('phone', 18) + '</a></div>' +
      '</div>';
    tilt($('#sheet .media'));
    openLayer('sheet');
    if (Date.now() - (ANNA.sheetCheer || 0) > 40000) { ANNA.sheetCheer = Date.now(); setTimeout(function () { annaCheer($('#sheet .media')); }, 650); }
    segPos($('#sSeg'));
  }
  function ingrHtml(id) {
    var keys = (INGR && INGR.dishes[id]) || []; if (!keys.length) return '';
    return '<div class="ingr" style="--n:' + keys.length + '"><p class="ingr-hd">What\'s in it <span>· tap to learn</span></p><div class="ingr-row">' + keys.map(function (k, i) {
      var g = INGR.ingredients[k];
      return '<button class="ig ' + (i % 2 ? 'dn' : 'up') + '" data-ig="' + k + '" style="--i:' + i + '"><span class="lb">' + esc(g.name) + '</span><i class="ln"></i><img src="' + IMG(g.img || 'img/ing/' + k + '.webp', 240) + '" alt=""></button>';
    }).join('') + '</div><div class="ingr-note" id="igNote"><p>New to these? Tap any ingredient and we\'ll tell you what it is.</p></div></div>';
  }
  function ingrNote(k, btn) {
    var g = INGR && INGR.ingredients[k]; if (!g) return;
    $$('#sheet .ig').forEach(function (b) { b.classList.toggle('on', b === btn); });
    var also = Object.keys(INGR.dishes).filter(function (d) { return d !== (sheetState && sheetState.id) && INGR.dishes[d].indexOf(k) >= 0 && BYID[d]; });
    var n = $('#igNote');
    n.innerHTML = '<p><b>' + esc(g.name) + '.</b> ' + esc(g.note) + '</p>' + (also.length ? '<div class="ig-also"><span>Also in ' + also.length + (also.length === 1 ? ' dish' : ' dishes') + '</span>' + also.slice(0, 3).map(function (d) { return '<button data-dish="' + d + '">' + esc(shortName(BYID[d].name)) + '</button>'; }).join('') + '</div>' : '');
    n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
  }
  function segPos(seg) {
    if (!seg) return; var on = $('button.on', seg), bg = $('.seg-bg', seg); if (!on) return;
    bg.style.left = on.offsetLeft + 'px'; bg.style.width = on.offsetWidth + 'px';
  }

  // ================= bag =================
  function bagCount() { return bag.reduce(function (s, l) { return s + l.qty; }, 0); }
  function subtotal() { return bag.reduce(function (s, l) { var it = BYID[l.id]; return s + (it ? it.price * l.qty : 0); }, 0); }
  function saveBag() {
    store.set('ak-bag', bag);
    var n = bagCount();
    ['#bagCount', '#bagCount2', '#bagCount3'].forEach(function (s) { var b = $(s); if (!b) return; b.textContent = n; b.classList.toggle('on', n > 0); b.classList.remove('bump'); void b.offsetWidth; if (n) b.classList.add('bump'); });
  }
  function addToBag(id, qty, heat, note, fromEl) {
    var it = BYID[id]; if (!it) return;
    heat = it.heat ? (heat == null ? heatPref : heat) : null;
    var line = bag.filter(function (l) { return l.id === id && l.heat === heat && (l.note || '') === (note || ''); })[0];
    if (line) line.qty += qty; else bag.push({ id: id, qty: qty, heat: heat, note: note || '' });
    saveBag();
    if (fromEl) fly(fromEl);
    var src = fromEl && fromEl.closest ? (fromEl.closest('.anna-bubble') ? null : (fromEl.closest('.item, .sp-card, .pop, .upsell button') || fromEl)) : null;
    var cheered = src ? annaCheer(src) : false;
    setTimeout(function () { annaOnAdd(it, cheered); }, 500);
    toast('<span>Added ' + esc(it.name) + (heat != null ? ' · ' + HEAT[heat] : '') + '</span><button data-open="bag">View order</button>');
  }
  function fly(img) {
    if (reduce || !img) return;
    var target = isPhone() ? $('#tabbar .mid') : (mpOpen ? $('#mpBag') : $('#bagBtn')); if (!target) return;
    var a = img.getBoundingClientRect(), b = target.getBoundingClientRect();
    var f = img.cloneNode(); f.className = 'fly'; f.removeAttribute('loading');
    f.style.cssText += ';left:' + a.left + 'px;top:' + a.top + 'px;width:' + a.width + 'px;height:' + a.height + 'px;object-fit:contain';
    document.body.appendChild(f);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      var s = 34 / Math.max(a.width, 1);
      f.style.transform = 'translate(' + (b.left + b.width / 2 - a.left - a.width / 2) + 'px,' + (b.top + b.height / 2 - a.top - a.height / 2) + 'px) scale(' + s + ') rotate(-25deg)';
      f.style.opacity = '.2';
    }); });
    setTimeout(function () { f.remove(); }, 850);
  }
  var toastT = 0;
  function toast(html) {
    var t = $('#toast'); t.innerHTML = html; t.classList.toggle('top', document.body.classList.contains('locked')); t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2800);
  }

  // ================= drawer flows: bag → how → details → pay → done; reserve; catering; more =================
  var flow = { name: 'bag', step: 'bag', how: 'pickup', time: null, tip: 0.15, pay: 'counter', form: {} };
  function slots() {
    var out = [], now = new Date(), ready = nowHour(now) + BIZ.prepMinutes / 60;
    for (var k = 0; k < 8 && out.length < 8; k++) {
      var d = new Date(now); d.setDate(d.getDate() + k);
      (BIZ.hours[d.getDay()] || []).forEach(function (r) {
        var start = Math.ceil((k === 0 ? Math.max(r[0] + .25, ready) : r[0] + .25) * 4) / 4;
        for (var t = start; t <= r[1] - .25 && out.length < 8; t += .25) out.push({ label: (k === 0 ? '' : k === 1 ? 'Tomorrow ' : DAY[d.getDay()].slice(0, 3) + ' ') + fmtTime(t), day: k });
      });
    }
    if (isOpen(now)) out.unshift({ label: 'ASAP · about ' + BIZ.prepMinutes + ' min', day: 0, asap: true });
    return out;
  }
  function tableTimes() {
    var rs = [], out = [];
    for (var k = 0; k < 7 && !rs.length; k++) rs = BIZ.hours[k] && BIZ.hours[k].length ? BIZ.hours[k] : rs;
    rs.forEach(function (r) { for (var t = r[0] + .5; t <= r[1] - 1; t += .5) out.push(fmtTime(t)); });
    return out;
  }
  function orderText(extra) {
    var lines = bag.map(function (l) { var it = BYID[l.id]; return '• ' + l.qty + ' × ' + it.name + (l.heat != null ? ' (' + HEAT[l.heat] + ')' : '') + (l.note ? ' [' + l.note + ']' : '') + ' — ' + money(it.price * l.qty); });
    return "Hi Asha's Kitchen! I'd like to order:\n" + lines.join('\n') + '\nSubtotal: ' + money(subtotal()) + (extra ? '\n' + extra : '');
  }
  var lastStep = '';
  function renderDrawer() {
    if (flow.name + flow.step !== lastStep) { lastStep = flow.name + flow.step; clearTimeout(toastT); $('#toast').classList.remove('on'); }
    var d = $('#drawer'), s = flow.step, h = '', ft = '', title = 'Your order', steps = null, back = null;
    if (flow.name === 'bag') {
      var idx = { bag: 0, how: 1, details: 2, pay: 3, done: 4, dd: 2, wa: 2 }[s];
      steps = '<div class="steps">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i <= idx ? 'on' : '') + '"></i>'; }).join('') + '</div>';
      if (s !== 'bag' && s !== 'done') back = s === 'how' ? 'bag' : s === 'pay' ? 'details' : 'how';
      if (s === 'bag') {
        if (!bag.length) {
          h = '<div class="empty-bag"><img src="img/p/c-tiffins.webp" alt=""><p style="font:600 26px var(--serif);color:var(--green)">Your order is empty</p><p style="margin-top:8px">Pick something from the menu and it will wait for you here.</p><button class="btn" style="margin-top:20px" data-go="menu" data-close>Browse the menu</button></div>';
        } else {
          h = bag.map(function (l, i) { var it = BYID[l.id]; return '<div class="line"><img src="' + IMG(it.img) + '" alt=""><div><h5>' + esc(it.name) + '</h5><small>' + (l.heat != null ? HEAT[l.heat] + ' · ' : '') + money(it.price) + (l.note ? ' · “' + esc(l.note) + '”' : '') + '</small><div class="qty"><button data-lq="' + i + '" data-d="-1" aria-label="Less">−</button><span>' + l.qty + '</span><button data-lq="' + i + '" data-d="1" aria-label="More">+</button></div></div><div class="pr">' + money(it.price * l.qty) + '</div></div>'; }).join('');
          var have = bag.map(function (l) { return BYID[l.id].cat; });
          var ups = ['coffee', 'lassi', 'jamun', 'parotta', 'masala-chai', 'osmania'].map(function (k) { return BYIMG[k]; }).filter(function (u) { return u && !bag.some(function (l) { return l.id === u.id; }); }).slice(0, 4);
          if (have.indexOf('drinks') < 0 || have.indexOf('desserts') < 0) h += '<span class="label">Complete your meal</span><div class="upsell">' + ups.map(function (p) { return '<button data-add="' + p.id + '"><img src="' + IMG(p.img) + '" alt="">' + esc(p.name) + ' · ' + money(p.price) + ' ' + icon('plus', 14) + '</button>'; }).join('') + '</div>';
          ft = sumHtml(false) + '<button class="btn btn--block" data-step="how" style="margin-top:16px">Checkout · ' + money(subtotal()) + '</button>';
        }
      } else if (s === 'how') {
        title = 'How would you like it?';
        h = '<span class="label" style="margin-top:2px">Here at the restaurant</span><div class="opts">' +
          (TABLE ? opt('table', 'cloche', 'At my table · Table ' + esc(TABLE), 'We bring everything to your table. Pay at the table when you are done.') : '') +
          opt('counter', 'counter', 'Order at the counter', 'Order here, pay at the counter, and collect it when we call your name.') +
          '</div><span class="label">Take it away</span><div class="opts">' +
          opt('pickup', 'bag', 'Pickup', 'Ready in about ' + BIZ.prepMinutes + ' minutes. Pay at the counter or online.') +
          opt('delivery', 'moto', 'Delivery by DoorDash', 'Delivered to your door through our DoorDash store.') +
          opt('whatsapp', 'wa', 'Order on WhatsApp', 'Send this order to us in a WhatsApp message; we confirm by reply.') +
          '</div>';
        ft = '<button class="btn btn--block" data-step="' + (flow.how === 'pickup' || flow.how === 'table' || flow.how === 'counter' ? 'details' : flow.how === 'delivery' ? 'dd' : 'wa') + '">Continue</button>';
      } else if (s === 'details' && flow.how === 'counter') {
        title = 'Order at the counter';
        h = '<div class="opt on" style="cursor:default"><span class="oi">' + icon('counter', 22) + '</span><span><b>Collect at the counter</b><small>We start cooking as soon as you place it, and call your name when it is ready.</small></span></div>' +
          inp('name', 'Your name', 'text', 'We call this name at the counter') + inp('notes', 'Notes for the kitchen', 'textarea', 'Allergies, spice level, for here or to go…');
        ft = sumHtml(true) + '<button class="btn btn--block" data-step="pay" style="margin-top:16px">Continue</button>';
      } else if (s === 'details' && flow.how === 'table') {
        title = 'Table ' + esc(TABLE);
        h = '<div class="opt on" style="cursor:default"><span class="oi">' + icon('cloche', 22) + '</span><span><b>Dine-in at table ' + esc(TABLE) + '</b><small>Your order goes straight to the kitchen and we bring it to you.</small></span></div>' +
          inp('name', 'Your name', 'text', 'So we know who ordered') + inp('notes', 'Notes for the kitchen', 'textarea', 'Allergies, spice level, share plates…');
        ft = sumHtml(true) + '<button class="btn btn--block" data-step="pay" style="margin-top:16px">Continue</button>';
      } else if (s === 'details' || s === 'wa') {
        title = s === 'wa' ? 'Order on WhatsApp' : 'Pickup details';
        var sl = slots(); if (!flow.time) flow.time = sl[0] && sl[0].label;
        h = '<span class="label" style="margin-top:4px">Pickup time</span><div class="slots">' + sl.map(function (x) { return '<button data-slot="' + esc(x.label) + '"' + (x.label === flow.time ? ' class="on"' : '') + '>' + esc(x.label) + '</button>'; }).join('') + '</div>' +
          inp('name', 'Your name', 'text', 'First and last name') + '<div class="row2">' + inp('phone', 'Mobile', 'tel', 'For order updates') + inp('email', 'Email (optional)', 'email', 'For your receipt') + '</div>' +
          inp('notes', 'Notes for the kitchen', 'textarea', 'Allergies, extra chutney, cutlery…');
        ft = sumHtml(true) + (s === 'wa' ? '<a class="btn btn--wa btn--block" id="sendWa" target="_blank" rel="noopener" style="margin-top:16px">' + icon('wa') + ' Send order on WhatsApp</a>' : '<button class="btn btn--block" data-step="pay" style="margin-top:16px">Continue to payment</button>');
      } else if (s === 'dd') {
        title = 'Delivery by DoorDash';
        h = '<div class="opt on" style="cursor:default"><span class="oi" style="background:#fde3de;color:#e3311c">' + icon('moto', 24) + '</span><span><b>Your order is saved</b><small>Open our DoorDash store, add the same dishes and check out there. DoorDash handles the driver, tracking and payment.</small></span></div>' +
          '<div class="line" style="border:0;grid-template-columns:1fr"><pre style="white-space:pre-wrap;font:13px/1.55 var(--sans);color:#4b4840;background:#fff;border-radius:14px;padding:14px;box-shadow:inset 0 0 0 1px var(--line)">' + esc(orderText()) + '</pre></div>' +
          '<p class="note-demo">Want DoorDash to deliver orders placed right here, without leaving this site? That is DoorDash Drive; we can switch it on with your DoorDash business account.</p>';
        ft = '<a class="btn btn--dd btn--block" href="' + ddUrl() + '" target="_blank" rel="noopener">Open our DoorDash store</a><button class="btn btn--line btn--block" id="copyOrder" style="margin-top:10px">Copy my order</button>';
      } else if (s === 'pay') {
        title = 'Payment';
        h = '<div class="opts">' + payOpt('counter', 'bag', flow.how === 'table' ? 'Pay at the table' : flow.how === 'counter' ? 'Pay at the counter' : 'Pay at pickup', flow.how === 'table' ? 'Card or cash when you are done.' : flow.how === 'counter' ? 'Card or cash when you collect.' : 'Card or cash at the counter.') + payOpt('card', 'check', 'Pay now by card', 'Secure card payment.') + '</div>' +
          (flow.pay === 'card' ? '<div style="margin-top:6px">' + inp('card', 'Card number', 'text', '•••• •••• •••• ••••') + '<div class="row2">' + inp('exp', 'Expiry', 'text', 'MM / YY') + inp('cvc', 'CVC', 'text', '•••') + '</div></div><p class="note-demo">Preview only: card payment will run through Square, Stripe or Toast once your account is connected. Nothing is charged here.</p>' : '') +
          '<span class="label">Add a tip for the kitchen</span><div class="slots">' + [0, .1, .15, .18].map(function (p) { return '<button data-tip="' + p + '"' + (p === flow.tip ? ' class="on"' : '') + '>' + (p ? Math.round(p * 100) + '%' : 'No tip') + '</button>'; }).join('') + '</div>';
        ft = sumHtml(true) + '<button class="btn btn--block" id="placeOrder" style="margin-top:16px">' + (flow.how === 'table' ? 'Send to the kitchen · ' : flow.how === 'counter' ? 'Place order · ' : 'Place pickup order · ') + money(total()) + '</button>';
      } else if (s === 'done') {
        title = 'Thank you!';
        var o = store.get('ak-last', {});
        h = '<div class="done"><div class="tick">' + icon('check', 40) + '</div><h4>Order ' + esc(o.no || '') + ' is in!</h4><p>' + esc(o.name ? o.name.split(' ')[0] + ', w' : 'W') + 'e\'re cooking it now. ' + (o.table ? 'We\'ll bring it to <b>table ' + esc(o.table) + '</b>.' : o.counter ? 'Show this number at the counter; we\'ll call your name when it\'s ready.' : 'Pickup: <b>' + esc(o.time || '') + '</b>.') + '</p>' + (o.counter ? '<div class="ono">' + esc(o.no || '') + '</div>' : '') +
          '<div class="track"><div class="on"><i></i>Received</div><div class="on now"><i></i>Cooking</div><div><i></i>Ready</div></div>' +
          '<p class="note-demo">Preview: on the live site this confirmation also arrives by text and email, and the kitchen sees it on its tablet.</p></div>';
        ft = '<a class="btn btn--wa btn--block" target="_blank" rel="noopener" href="' + waUrl('Hi! Just placed order ' + (o.no || '') + ' for pickup at ' + (o.time || '') + '.') + '">' + icon('wa') + ' Message us about this order</a><button class="btn btn--line btn--block" data-close style="margin-top:10px">Back to the menu</button>';
      }
    } else if (flow.name === 'reserve') {
      title = 'Book a table';
      h = '<p class="ct-lead">Call us, or send an email with the date, time and number of guests. We reply to confirm your table.</p>' +
        '<a class="ct-row" href="' + telHref() + '"><span>' + icon('phone', 22) + '</span><span><b>Call us</b><small>' + esc(BIZ.phone) + '</small></span>' + icon('arrow', 18) + '</a>' +
        '<a class="ct-row" href="' + mailHref('Table booking', "Hi Asha's Kitchen,\n\nI'd like to book a table.\n\nDate:\nTime:\nNumber of guests:\nOccasion (optional):\n\nName:\nPhone:\n") + '"><span>' + icon('mail', 22) + '</span><span><b>Email us</b><small>' + esc(BIZ.email) + '</small></span>' + icon('arrow', 18) + '</a>' +
        '<div class="ct-hours"><b>Hours</b>' + [1, 3, 0].map(function (d) { return ''; }).join('') + '<p>Monday, Wednesday–Sunday<br>8:00 AM – 2:30 PM · 5:00 PM – 10:00 PM<br>Closed Tuesday</p></div>';
      ft = '<a class="btn btn--block" href="' + telHref() + '">' + icon('phone', 16) + ' Call ' + esc(BIZ.phone) + '</a>';
    } else if (flow.name === 'catering') {
      title = 'Catering';
      h = '<p class="ct-lead">Office lunches, weddings, festivals and family parties: biryani by the tray, curries by the pan, chai for everyone. Call us with the date and headcount and we\'ll plan the menu with you.</p>' +
        '<a class="ct-row" href="' + telHref() + '"><span>' + icon('phone', 22) + '</span><span><b>Call for catering</b><small>' + esc(BIZ.phone) + '</small></span>' + icon('arrow', 18) + '</a>' +
        '<button class="ct-row" data-go="banquet" data-close><span>' + icon('cloche', 22) + '</span><span><b>Banquet hall &amp; décor</b><small>Host it with us; we cook and decorate</small></span>' + icon('arrow', 18) + '</button>';
      ft = '<a class="btn btn--gold btn--block" href="' + telHref() + '">' + icon('phone', 16) + ' Call ' + esc(BIZ.phone) + '</a>';
    } else if (flow.name === 'more') {
      title = 'More';
      h = '<div class="opts">' + [['reserve', 'cal', 'Book a table', 'Call or email us'], ['catering', 'cloche', 'Catering', 'Call us with the date and headcount'], ['go:banquet', 'heart', 'Banquet hall & décor', 'Celebrate with us'], ['go:cat-vegan', 'leaf', 'Vegan menu', 'Dishes with no dairy or ghee'], ['go:shop', 'bag', 'Sowaka Ghee', 'Ghee, batters and take-home'], ['go:story', 'heart', 'Our story', 'The hope in every plate'], ['go:visit', 'pin', 'Visit & hours', 'Map, hours, directions']].map(function (x) { return '<button class="opt" data-more="' + x[0] + '"><span class="oi">' + icon(x[1], 22) + '</span><span><b>' + x[2] + '</b><small>' + x[3] + '</small></span></button>'; }).join('') + '</div>';
      ft = '<a class="btn btn--block" href="' + telHref() + '">' + icon('phone', 16) + ' Call ' + esc(BIZ.phone) + '</a>';
    }
    d.innerHTML = '<div class="dr-hd">' + (back ? '<button class="icon-btn" data-step="' + back + '" aria-label="Back">' + icon('back') + '</button>' : '<span></span>') + '<h3>' + title + '</h3><button class="icon-btn" data-close aria-label="Close">' + icon('x') + '</button></div>' + (steps || '') + '<div class="dr-body">' + h + '</div>' + (ft ? '<div class="dr-ft">' + ft + '</div>' : '');
    $$('.inp input, .inp textarea, .inp select', d).forEach(function (e) { if (flow.form[e.name] != null) e.value = flow.form[e.name]; e.addEventListener('input', function () { flow.form[e.name] = e.value; e.closest('.inp').classList.remove('bad'); }); });
    var sw = $('#sendWa', d); if (sw) sw.addEventListener('click', function (e) {
      if (!valid(['name'])) { e.preventDefault(); return; }
      sw.href = waUrl(orderText('Pickup: ' + flow.time + '\nName: ' + (flow.form.name || '') + (flow.form.phone ? '\nPhone: ' + flow.form.phone : '') + (flow.form.notes ? '\nNotes: ' + flow.form.notes : '')));
    });
  }
  function opt(v, ic, b, s) { return '<button class="opt' + (flow.how === v ? ' on' : '') + '" data-how="' + v + '"><span class="oi">' + icon(ic, 22) + '</span><span><b>' + b + '</b><small>' + s + '</small></span></button>'; }
  function payOpt(v, ic, b, s) { return '<button class="opt' + (flow.pay === v ? ' on' : '') + '" data-pay="' + v + '"><span class="oi">' + icon(ic, 22) + '</span><span><b>' + b + '</b><small>' + s + '</small></span></button>'; }
  function inp(name, label, type, ph) {
    var f = type === 'textarea' ? '<textarea name="' + name + '" placeholder="' + esc(ph) + '"></textarea>' : type === 'select' ? '<select name="' + name + '"><option>Pickup trays</option><option>Delivered</option><option>Party at the restaurant</option></select>' : '<input name="' + name + '" type="' + type + '" placeholder="' + esc(ph) + '">';
    return '<div class="inp"><label>' + label + '</label>' + f + '</div>';
  }
  function total() { var s = subtotal(); return s + s * BIZ.taxRate + (flow.step === 'pay' || flow.step === 'done' ? s * flow.tip : 0); }
  function sumHtml(full) {
    var s = subtotal(), tax = s * BIZ.taxRate, tip = full && (flow.step === 'pay') ? s * flow.tip : 0;
    return '<div class="sum"><div><span>Subtotal (' + bagCount() + (bagCount() === 1 ? ' item)' : ' items)') + '</span><span>' + money(s) + '</span></div>' + (full ? '<div><span>Estimated tax</span><span>' + money(tax) + '</span></div>' + (tip ? '<div><span>Tip</span><span>' + money(tip) + '</span></div>' : '') + '<div class="tot"><span>Total</span><span>' + money(s + tax + tip) + '</span></div>' : '') + '</div>';
  }
  function valid(fields) {
    var ok = true, d = $('#drawer');
    fields.forEach(function (n) { var e = $('[name="' + n + '"]', d); if (e && !String(e.value).trim()) { e.closest('.inp').classList.add('bad'); ok = false; } });
    if (!ok) toast('<span>Please fill in the highlighted fields</span>');
    return ok;
  }
  function openFlow(name, step) {
    flow.name = name; flow.step = step || (name === 'bag' ? 'bag' : 'form');
    if (name === 'bag' && TABLE && step === 'bag' && flow.how === 'pickup') flow.how = 'table';
    renderDrawer(); openLayer('drawer');
    if (name === 'scan') startScan();
  }
  function tableUI() {
    document.body.classList.toggle('at-table', !!TABLE);
    $$('.tchip').forEach(function (c) { c.remove(); });
    if (!TABLE) return;
    var chip = '<button class="tchip" data-open="table">' + icon('qr', 15) + '<span>Table ' + esc(TABLE) + '</span></button>';
    $('#hd .act').insertAdjacentHTML('afterbegin', chip); $('.mp-top').insertAdjacentHTML('beforeend', chip);
    $('#tbAddr').textContent = 'Dine-in at table ' + TABLE + ': order here, we bring it to you'; $('#tbAddr').classList.remove('ph');
    flow.how = 'table';
  }
  function leaveTable() {
    TABLE = null; try { sessionStorage.removeItem('ak-table'); } catch (e) {}
    if (flow.how === 'table') flow.how = 'pickup';
    tableUI(); closeLayer();
    history.replaceState(history.state, '', location.pathname + location.hash);
    toast('<span>Table mode is off. Pickup and delivery are back.</span>');
  }
  function useScan(text) {
    var m = String(text).match(/[?&]table=([A-Za-z0-9-]{1,6})/);
    if (!m) { var msg = $('#scanMsg'); if (msg) msg.textContent = 'That code is not one of our table codes. Try the one on your table.'; return false; }
    stopScan(); TABLE = m[1]; try { sessionStorage.setItem('ak-table', TABLE); } catch (e) {}
    tableUI(); openFlow('table'); return true;
  }
  function startScan() {
    var msg = function (t) { var e = $('#scanMsg'); if (e) e.textContent = t; };
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg('This browser cannot scan here. Use your camera app instead (see below).'); return; }
    var det = new window.BarcodeDetector({ formats: ['qr_code'] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (st) {
      scanStream = st; var v = $('#scanVid'); if (!v) { stopScan(); return; }
      v.srcObject = st; v.play(); msg('Point at the code on your table');
      var tick = function () {
        if (!scanStream || layer !== 'drawer' || flow.name !== 'scan') { stopScan(); return; }
        det.detect(v).then(function (r) { if (r[0] && useScan(r[0].rawValue)) return; scanTimer = setTimeout(tick, 250); }).catch(function () { scanTimer = setTimeout(tick, 400); });
      };
      tick();
    }).catch(function () { msg('Camera permission was not given. Use your camera app instead (see below).'); });
  }
  function stopScan() { clearTimeout(scanTimer); if (scanStream) { scanStream.getTracks().forEach(function (t) { t.stop(); }); scanStream = null; } }

  // ================= layers =================
  // every open panel owns one history step, so the phone's back gesture closes it instead of leaving the site
  var layer = null, layerH = false, popSkip = 0;
  function openLayer(which) {
    if (layer && layer !== which) closeLayer(true, true);
    if (!layerH) { history.pushState(Object.assign({}, history.state, { layer: 1 }), '', location.href); layerH = true; }
    layer = which; lock(true);
    $('#scrim').classList.add('on'); $('#' + which).classList.add('on');
  }
  function closeLayer(keepLock, keepHist) {
    if (!layer) return;
    stopScan();
    $('#' + layer).classList.remove('on');
    if (!keepLock) { $('#scrim').classList.remove('on'); lock(false); }
    layer = null;
    if (layerH && !keepHist) { layerH = false; popSkip++; history.back(); }
  }

  // ================= spice map =================
  var PLACES = [
    ['AMRITSAR', 31.63, 74.87, 'samosa', 'L'], ['DELHI', 28.61, 77.21, 'butter', 'L'], ['KOLKATA', 22.57, 88.36, 'chili-chicken', 'R'],
    ['HYDERABAD', 17.39, 78.49, 'biryani', 'L'], ['VIJAYAWADA', 16.51, 80.65, 'vj-chicken-biryani', 'R'], ['CHENNAI', 13.08, 80.27, 'coffee', 'R'],
    ['MYSURU', 12.30, 76.64, 'dosa', 'L'], ['MADURAI', 9.93, 78.12, 'mutton-pepper-fry', 'R'], ['KERALA', 9.50, 76.34, 'fish', 'L'],
  ];
  var TASTE = { biryani: 'a fragrant, spiced rice bake. Rich, not fiery.', butter: 'creamy, mild and smoky. A great first curry.', 'chili-chicken': 'sweet, sour and spicy, like your favourite takeout with an Indian kick.', samosa: 'a flaky, savory hand pie with spiced potato.', 'vj-chicken-biryani': 'bold and hot: biryani for spice lovers.', coffee: 'like a strong, frothy latte, sweet and chicory-rich.', dosa: 'crisp like a crepe, with a garlicky chili kick.', 'mutton-pepper-fry': 'peppery and smoky, a dry roast with no gravy.', fish: 'gentle and tangy, a coconut milk curry.' };
  var placeOn = 3, PAIRX = {};
  function renderMap() {
    var art = $('#mapArt'), L = '';
    $$('.pin, .plbl', art).forEach(function (e) { e.remove(); });
    PLACES.forEach(function (p, i) {
      var x = (p[2] - 68.1) / 29.3 * 100 * .96 + 2, y = (37.1 - p[1]) / 29.1 * 100 * .97 + 1.5, it = BYIMG[p[3]];
      var pin = document.createElement('button'); pin.className = 'pin' + (i === placeOn ? ' on' : ''); pin.style.left = x + '%'; pin.style.top = y + '%'; pin.dataset.place = i; pin.setAttribute('aria-label', p[0]); art.appendChild(pin);
      var lx = p[4] === 'L' ? -14 : 114;
      var lb = document.createElement('button'); lb.className = 'plbl' + (i === placeOn ? ' on' : ''); lb.style.left = lx + '%'; lb.style.top = y + '%'; lb.dataset.place = i;
      lb.innerHTML = '<small>' + p[0] + '</small>' + esc(it ? shortName(it.name) : ''); art.appendChild(lb);
      L += '<path d="M' + x + ' ' + y + ' L ' + (p[4] === 'L' ? lx + 8 : lx - 8) + ' ' + y + '" stroke="' + (i === placeOn ? '#e4bb67' : 'rgba(228,187,103,.5)') + '" stroke-width="' + (i === placeOn ? 2 : 1.2) + '" vector-effect="non-scaling-stroke" fill="none"/>';
    });
    $('#mapLines').innerHTML = L;
    var mc = $('#mapCities') || (function () { var d = document.createElement('div'); d.className = 'mcities'; d.id = 'mapCities'; art.appendChild(d); return d; })();
    mc.innerHTML = PLACES.map(function (pl, i) { return '<button data-place="' + i + '"' + (i === placeOn ? ' class="on"' : '') + '>' + pl[0].charAt(0) + pl[0].slice(1).toLowerCase() + '</button>'; }).join('');
    renderPop();
  }
  function shortName(n) { return n.replace(/^(Hyderabadi |Classic |Royal |Coconut |Punjabi |Indo-Chinese |Madurai |Spicy |Madras )/, '').replace(' Chicken Dum Biryani', ' Biryani'); }
  function renderPop() {
    var p = PLACES[placeOn], it = BYIMG[p[3]], pop = $('#pop'); if (!it) return;
    pop.classList.add('swap');
    setTimeout(function () {
      pop.innerHTML = '<img src="' + IMG(it.img) + '" alt=""><p class="kicker">' + esc(p[0].charAt(0) + p[0].slice(1).toLowerCase()) + (it.from && it.from.toUpperCase() !== p[0] ? ' · ' + esc(it.from) : '') + '</p><h4>' + esc(it.name) + '</h4><p>' + esc(it.desc) + '</p><p style="margin-top:10px;color:#8a5a17"><b>Tastes like:</b> ' + esc(TASTE[p[3]] || it.explain) + '</p><div class="bar"><b>' + money(it.price) + '</b><span style="display:flex;gap:8px"><button class="btn btn--sm" data-dish="' + it.id + '">Details</button></span></div>';
      pop.classList.remove('swap');
    }, reduce ? 0 : 220);
  }
  // ================= why Asha's: a journey from point A to point B, driven by scroll =================
  var JR = [
    ['r-spices', 'Point A · every morning', 'Whole spices, ground fresh', 'Cumin, cardamom, Guntur chilli and black pepper are roasted and crushed in our kitchen, never poured from a packet.'],
    ['r-batter', 'Overnight', 'Batter, stone-ground', 'Rice and lentils soak overnight, turn slowly on a stone grinder, then ferment the traditional way.'],
    ['r-ghee', 'Low and slow', 'Only pure ghee', 'Golden, grass-fed Sowaka ghee goes into our curries, and the same jars are on our shelf to take home.'],
    ['r-tawa', 'When you order', 'Cooked to order', 'Your dosa meets the hot tawa when your order comes in; biryani is sealed and finished on dum.'],
    ['r-packed', 'Minutes later', 'Packed to travel', 'Vented boxes keep dosas crisp and curries hot, tied up with a sprig of curry leaves.'],
    ['table-feast', 'Point B · your table', 'Hot, at your table', 'At your table, at the counter or at your door: every plate, from its own home.']
  ];
  var jrLen = 0, jrAt = [], jrTravel = 0, jrScroll = 1, jrLast = -1;
  function renderJourney() {
    var track = $('#jrTrack'); if (!track) return;
    track.innerHTML = '<svg class="jr-line" id="jrSvg" aria-hidden="true"><path class="base"/><path class="draw"/></svg>' + JR.map(function (st, i) {
      return '<article class="jr-step fx ' + (i % 2 ? 'lo' : 'hi') + '" data-jr="' + i + '"><span class="jr-n">' + (i === 0 ? 'A' : i === JR.length - 1 ? 'B' : '0' + (i + 1)) + '</span><div class="jr-pic"><img src="' + IMG(st[0], 900) + '" alt="' + esc(st[2]) + '" loading="lazy"></div><small>' + esc(st[1]) + '</small><h3>' + esc(st[2]) + '</h3><p>' + esc(st[3]) + '</p></article>';
    }).join('') + '<div class="jr-mark" id="jrMark" aria-hidden="true"><span id="jrWhen"></span><i></i></div>';
    $('#jrDots').innerHTML = JR.map(function (st, i) { return '<button data-jr="' + i + '" aria-label="' + esc(st[2]) + '"></button>'; }).join('');
    layoutJourney();
    window.addEventListener('resize', layoutJourney);
    $$('#jrTrack img').forEach(function (im) { im.addEventListener('load', layoutJourney, { once: true }); });
  }
  function layoutJourney() {
    var sec = $('#why'), track = $('#jrTrack'), stage = $('#jrStage'); if (!track || !stage) return;
    var pts = $$('.jr-step', track).map(function (st) { return [st.offsetLeft + st.offsetWidth / 2, st.offsetTop - 30]; });
    var d = 'M' + (pts[0][0] - 160) + ' ' + pts[0][1] + ' L' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2; d += ' C' + mx + ' ' + a[1] + ' ' + mx + ' ' + b[1] + ' ' + b[0] + ' ' + b[1]; }
    d += ' L' + (pts[pts.length - 1][0] + 160) + ' ' + pts[pts.length - 1][1];
    var svg = $('#jrSvg'); svg.setAttribute('width', track.scrollWidth); svg.setAttribute('height', track.offsetHeight);
    $$('path', svg).forEach(function (pa) { pa.setAttribute('d', d); });
    var draw = $('path.draw', svg); jrLen = draw.getTotalLength(); draw.style.strokeDasharray = jrLen + ' ' + jrLen;
    jrAt = pts.map(function (pt) { var lo = 0, hi = jrLen; for (var k = 0; k < 26; k++) { var m = (lo + hi) / 2; if (draw.getPointAtLength(m).x < pt[0]) lo = m; else hi = m; } return lo; });
    jrTravel = Math.max(0, track.scrollWidth - stage.clientWidth);
    jrScroll = Math.max(jrTravel * 1.1, innerHeight * 2.4);
    sec.style.height = (innerHeight + jrScroll) + 'px';
    jrLast = -1; updateJourney();
  }
  function updateJourney() {
    var sec = $('#why'); if (!sec || !jrLen) return;
    var r = sec.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) return;
    var p = Math.min(1, Math.max(0, -r.top / jrScroll)), L = jrAt[0] + (jrAt[jrAt.length - 1] - jrAt[0]) * p;
    var draw = $('#jrSvg path.draw'), pt = draw.getPointAtLength(L);
    draw.style.strokeDashoffset = (jrLen - L).toFixed(1);
    var tx = Math.min(0, Math.max(-jrTravel, $('#jrStage').clientWidth * .38 - pt.x));
    $('#jrTrack').style.transform = 'translate3d(' + tx.toFixed(1) + 'px,0,0)';
    $('#jrMark').style.transform = 'translate3d(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px,0)';
    var on = 0; for (var k = 0; k < jrAt.length; k++) if (L >= jrAt[k] - 60) on = k;
    if (on === jrLast) return; jrLast = on;
    $$('#jrTrack .jr-step').forEach(function (st, k) { st.classList.toggle('on', k === on); st.classList.toggle('done', k < on); });
    $$('#jrDots button').forEach(function (b, k) { b.classList.toggle('on', k === on); b.classList.toggle('done', k < on); });
    $('#jrNo').textContent = on === 0 ? 'A' : on === JR.length - 1 ? 'B' : '0' + (on + 1);
    var w = $('#jrWhen'); w.textContent = JR[on][1].replace(/^Point [AB] · /, ''); w.classList.remove('pop'); void w.offsetWidth; w.classList.add('pop');
  }
  function goJourney(i) {
    var sec = $('#why'), frac = (jrAt[i] - jrAt[0]) / Math.max(1, jrAt[jrAt.length - 1] - jrAt[0]);
    var y = sec.getBoundingClientRect().top + window.scrollY + frac * jrScroll + 2;
    if (lenis) lenis.scrollTo(y, { duration: 1.4 }); else window.scrollTo({ top: y, behavior: 'smooth' });
  }

  var SPICES = [
    ['turmeric', 'Turmeric', 'Earthy and warm. Gives our curries their gold.', ['masala-dosa', 'sambar', 'dal-tadka', 'quinoa-upma', 'veg-chettinadu', 'special-chicken-curry']],
    ['curryleaf', 'Curry leaves', 'Citrusy and nutty; nothing like curry powder. Crackled in hot oil to start a dish.', ['c65', 'mutton-pepper-fry', 'quinoa-upma', 'medu-vada', 'fish', 'chettinadu-chicken']],
    ['chilli', 'Guntur chilli', "Andhra's famous heat, behind our Kara Dosa and Gongura curries.", ['kara-dosa', 'dosa', 'gongura', 'vj-chicken-biryani', 'podi-dosa', 'c65']],
    ['pepper', 'Black pepper', "Native to Kerala's Malabar coast. The bold heat in Chettinad pepper fry.", ['chicken-pepper-fry', 'mutton-pepper-fry', 'millet-pongal', 'medu-vada', 'chettinadu-mutton']],
    ['cardamom', 'Cardamom', 'Floral and sweet. Perfumes our biryani, chai and gulab jamun.', ['biryani', 'masala-chai', 'jamun', 'special-mutton-biryani', 'kesari']],
    ['gongura', 'Gongura', "Tangy sorrel leaves, like a lemony spinach: Andhra's pride.", ['gongura', 'gongura-mutton', 'gongura-chicken-biryani', 'gongura-cashew-chicken', 'veg-gongura-biryani', 'gongura-paneer-biryani']],
  ];
  var spiceOn = 0;
  function renderSpices() {
    $('#spices').innerHTML = SPICES.map(function (s, i) { return '<button class="spice fx' + (i === spiceOn ? ' on' : '') + '" style="--d:' + (i * .06) + 's" data-spice="' + i + '"><img src="' + IMG(s[0], 300) + '" alt="" loading="lazy"><b>' + s[1] + '</b><p>' + s[2] + '</p></button>'; }).join('');
    renderInDishes();
  }
  function renderInDishes() {
    var s = SPICES[spiceOn];
    $('#inDishes').innerHTML = '<span style="font:600 11px/38px var(--sans);letter-spacing:.2em;color:var(--gold-l);margin-right:6px">' + s[1].toUpperCase() + ' IS IN</span>' + s[3].map(function (k) { var it = BYIMG[k]; return it ? '<button data-dish="' + it.id + '">' + esc(it.name) + '</button>' : ''; }).join('');
  }

  // ================= trivia =================
  var FACTS = [
    'Our dosa and idli batter is fermented overnight. That is what makes them light, a little tangy, naturally gluten-free and full of good bacteria.',
    'South Indian filter coffee is "pulled": poured from a height between the tumbler and the dabara to cool it and whip up the froth.',
    '"Dum" means breath. The biryani pot is sealed so the rice and meat cook slowly in their own steam.',
    'Curry leaves have nothing to do with curry powder. They come from a small tree in the citrus family, which is why they smell a little like lime.',
    'Black pepper grows wild on the Malabar coast of Kerala. It was once so valuable that it was traded like gold.',
    'Gongura, a tangy sorrel leaf, is so loved in Andhra Pradesh that a jar of gongura pickle travels in almost every Telugu suitcase.',
    'Nobody agrees why Chicken 65 is called 65. The most told story: a Chennai hotel first served it in 1965.',
    'Ghee is butter cooked slowly until the milk solids turn golden. That is where the nutty smell comes from, and why it can take high heat.',
  ];
  var factOn = 0, factT = 0;
  function renderTrivia() {
    $('#tDots').innerHTML = FACTS.map(function (f, i) { return '<i data-fact="' + i + '"' + (i === factOn ? ' class="on"' : '') + '></i>'; }).join('');
    $('#tq').textContent = FACTS[factOn];
  }
  function showFact(i) {
    factOn = (i + FACTS.length) % FACTS.length; var q = $('#tq');
    q.classList.add('swap');
    setTimeout(function () { q.textContent = FACTS[factOn]; q.classList.remove('swap'); $$('#tDots i').forEach(function (d, k) { d.classList.toggle('on', k === factOn); }); }, reduce ? 0 : 320);
    clearInterval(factT); factT = setInterval(function () { showFact(factOn + 1); }, 7000);
  }

  // ================= modes (hero) =================
  function setMode(m, go) {
    var b = $('#modes [data-mode="' + m + '"]'), bg = $('#modes .pill-bg'); if (!b) return;
    $$('#modes button').forEach(function (x) { x.classList.toggle('on', x === b); });
    bg.style.left = b.offsetLeft + 'px'; bg.style.width = b.offsetWidth + 'px';
    var cta = $('#heroCta');
    cta.innerHTML = ({ pickup: 'Start your order', delivery: 'Deliver with DoorDash', catering: 'Plan catering', reserve: 'Book a table' })[m] + ' ' + icon('arrow', 16);
    cta.dataset.mode = m;
    if (go) runMode(m);
  }
  function runMode(m) {
    if (m === 'pickup') { flow.how = 'pickup'; scrollToId('menu'); }
    else if (m === 'delivery') { flow.how = 'delivery'; if (bag.length) openFlow('bag', 'dd'); else window.open(ddUrl(), '_blank', 'noopener'); }
    else openFlow(m);
  }

  // hero hotspots: show each label once in turn so guests know the photo is tappable
  function h0intro() { var h = document.documentElement; return h.classList.contains('ak-on') || h.classList.contains('ak-wait'); }
  function heroPeek() {
    if (reduce || isPhone()) return;
    var hs = $$('#h3Table .pc[data-dish]'), k = 0;
    setTimeout(function step() {
      hs.forEach(function (h) { h.classList.remove('peek'); });
      if (k >= hs.length) return;
      hs[k++].classList.add('peek'); setTimeout(step, 1700);
    }, 3200);
  }

  // ================= Anna: the host who suggests what to eat =================
  var ANNA = { on: false, pose: 'wave', last: 0, mute: false, shown: [], adds: 0, cur: null };
  var POSES = ['wave', 'namaste', 'point', 'thumbs', 'plate', 'think'];
  try { ANNA.mute = sessionStorage.getItem('ak-anna') === 'off'; } catch (e) {}
  function annaPose(p) {
    var f = $('#annaFig'); if (!f) return;
    var a = $('.a1', f), b = $('.a2', f), front = f.classList.contains('flip') ? b : a, back = front === a ? b : a;
    if (front.getAttribute('src') === 'img/anna/' + p + '.webp') return;
    back.src = 'img/anna/' + p + '.webp'; f.classList.toggle('flip'); f.dataset.pose = p; ANNA.pose = p;
  }
  function annaPick(kind) {
    var hr = new Date().getHours(), inBag = function (it) { return bag.some(function (l) { return l.id === it.id; }); };
    var pool = MENU.items.filter(function (it) { return it.cat !== 'ghee' && !inBag(it) && ANNA.shown.indexOf(it.id) < 0; });
    var by = {
      veg: function (it) { return it.veg && ['drinks', 'ghee', 'desserts', 'breads'].indexOf(it.cat) < 0; },
      spicy: function (it) { return it.heat && /kara|gongura|vijayawada|chettin|pepper|65|chilli|chili|andhra/i.test(it.name); },
      sweet: function (it) { return it.cat === 'desserts' || /lassi|rose milk|chocolate|sweet/i.test(it.name); },
      popular: function (it) { return it.signature || it.weekend; },
      surprise: function (it) { var c = hr < 11 ? ['tiffins', 'drinks'] : hr < 16 ? ['biryani', 'curries', 'tiffins'] : hr < 19 ? ['starters', 'drinks', 'desserts', 'tiffins'] : ['biryani', 'curries', 'starters']; return c.indexOf(it.cat) >= 0; }
    }[kind] || function () { return true; };
    var list = pool.filter(by); if (!list.length) { ANNA.shown = []; list = MENU.items.filter(function (it) { return it.cat !== 'ghee' && by(it); }); }
    var it = list[Math.floor(Math.random() * list.length)]; if (it) ANNA.shown.push(it.id); return it;
  }
  var ANNA_LINE = {
    veg: ['No meat, full flavour. Try this one:', 'Vegetarian and super tasty, this one:'],
    spicy: ['You like heat? This one has proper Andhra fire:', 'Spicy, you said? Then this. Keep water close!'],
    sweet: ['Something sweet to finish? This one, definitely:', 'Sweet tooth? My favourite is this:'],
    popular: ['Everybody orders this. It will be super good:', 'Most loved at Asha\'s:'],
    surprise: ['Let me surprise you. This will be good:', 'Trust me on this one:']
  };
  function annaCard(it, line) {
    return '<p class="anna-say">' + esc(line) + ' <button class="anna-dish" data-dish="' + it.id + '">' + esc(shortName(it.name)) + '</button>' +
      '</p>';
  }
  function annaSay(html, pose, opts) {
    var a = $('#anna'); if (!a || !MENU) return;
    opts = opts || {};
    if (ANNA.mute && !opts.force) return;
    annaPose(pose || 'point');
    var bub = $('#annaBubble');
    bub.innerHTML = html;
    a.classList.add('on', 'talk'); bub.classList.remove('pop'); void bub.offsetWidth; bub.classList.add('pop');
    ANNA.mode = opts.mode || '';
    ANNA.on = true; ANNA.last = Date.now();
    clearTimeout(ANNA.t); ANNA.t = setTimeout(annaQuiet, opts.ms || 6500);
  }
  function annaQuiet() { var a = $('#anna'); if (a) a.classList.remove('talk'); }
  var KINDS = ['popular', 'surprise', 'veg', 'spicy', 'sweet'], kindAt = 0;
  function annaMenu() { annaSuggest(KINDS[kindAt++ % KINDS.length]); }
  function annaSuggest(kind) {
    var it = annaPick(kind); if (!it) return; ANNA.kind = kind;
    var L = { veg: 'Veggie pick:', spicy: 'Want real heat? Try', sweet: 'Something sweet?', popular: 'Everybody loves the', surprise: 'Trust me on this one:' }[kind] || 'Try the';
    annaSay(annaCard(it, L), kind === 'popular' || kind === 'surprise' ? 'plate' : 'point', { force: true, ms: 7000 });
  }
  function annaHello() {
    if (ANNA.mute) { $('#anna').classList.add('on'); return; }
    annaSay('<p class="anna-say">' + (TABLE ? 'Namaskaram, table ' + esc(TABLE) + '! ' : 'Namaskaram! ') + 'I\'m Anna. Tap me any time for a suggestion.</p>', 'wave', { ms: 5500 });
  }
  var annaArmed = true;
  function annaMaybe() { if (!annaArmed || !MENU) return; annaArmed = false; annaHello(); }
  function annaOnCat(id) {
    if (ANNA.mute || ANNA.mode === 'menu') return;
    var list = MENU.items.filter(function (it) { return id === 'vegan' ? it.vegan && it.cat === 'drinks' : it.cat === id; }), it = list.filter(function (x) { return x.signature || x.weekend; })[0] || list[0];
    if (!it) return; ANNA.shown.push(it.id);
    var L = { drinks: 'Coffee first! Try the', tiffins: 'Good morning! Try the', biryani: 'My favourite here:', curries: 'Start with the', starters: 'Something crispy?', breads: 'To scoop the curry:', desserts: 'Sweet ending?', ghee: 'Take home the', vegan: 'Vegan and still creamy:' }[id] || 'Try the';
    setTimeout(function () { annaSay(annaCard(it, L), 'point'); }, 1200);
  }
  var PAIRX_OLD = { biryani: ['lassi', 'jamun'], curries: ['parotta', 'rice'], dosas: ['coffee', 'side-sambar'], tiffins: ['coffee', 'chutneys'], starters: ['lime-soda', 'lassi'], drinks: ['osmania', 'bun-maska'], desserts: ['coffee', 'masala-chai'], breads: ['butter', 'gongura'] };
  function annaCheer(el) {
    var c = $('#cheer'); if (!c || !el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) return false;
    var lines = ['Wow, super! A right choice.', 'Super choice! You\'ll love it.', 'Wah! Very good choice.', 'Excellent pick, super tasty!'];
    $('p', c).textContent = lines[ANNA.adds % lines.length];
    var W = isPhone() ? 190 : 270, H = isPhone() ? 120 : 150, right = r.right + W - 40 < innerWidth;
    var x = right ? r.right - 40 : r.left - W + 40, y = Math.max(70, Math.min(innerHeight - H - (isPhone() ? 100 : 20), r.top + r.height * .35 - H / 2));
    x = Math.max(8, Math.min(innerWidth - W - 8, x));
    c.style.left = x + 'px'; c.style.top = y + 'px'; c.classList.toggle('flip', !right);
    c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
    clearTimeout(c._t); c._t = setTimeout(function () { c.classList.remove('on'); }, 2400);
    return true;
  }
  function annaOnAdd(it, cheered) {
    ANNA.adds++;
    if (ANNA.mute) return;
    if (cheered) {
      var pr = (PAIRX[it.cat] || []).map(function (k) { return BYIMG[k]; }).filter(function (x) { return x && !bag.some(function (l) { return l.id === x.id; }); })[0];
      if (pr && ANNA.adds % 2 === 1) setTimeout(function () { annaSay(annaCard(pr, 'Goes great with that:'), 'point'); }, 2300);
      return;
    }
    var pair = (PAIRX[it.cat] || []).map(function (k) { return BYIMG[k]; }).filter(function (x) { return x && !bag.some(function (l) { return l.id === x.id; }); })[0];
    if (pair && ANNA.adds % 2 === 1) annaSay(annaCard(pair, 'Super choice! Add a'), 'thumbs');
    else annaSay('<p class="anna-say">' + ['Super choice!', 'Very good, very good!', 'You know your food!', 'Ah, that one is lovely.'][ANNA.adds % 4] + '</p>', 'thumbs', { ms: 3200 });
  }

  // ================= events =================
  document.addEventListener('click', function (e) {
    var t = e.target;
    var go = t.closest('[data-go]'), add = t.closest('[data-add]'), fav = t.closest('[data-fav]'), dish = t.closest('[data-dish]'), open = t.closest('[data-open]');
    if (fav) { e.preventDefault(); e.stopPropagation(); var id = fav.dataset.fav, k = favs.indexOf(id); if (k >= 0) favs.splice(k, 1); else favs.push(id); store.set('ak-fav', favs); $$('[data-fav="' + id + '"]').forEach(function (f) { f.classList.toggle('on', k < 0); }); if (k < 0) { ANNA.adds++; annaCheer(fav.closest('.item') || fav); } if (filters.saved) applyFilters(); return; }
    var an = t.closest('[data-anna]');
    if (an) { e.preventDefault(); var av = an.dataset.anna;
      if (av === 'close') { $('#anna').classList.remove('talk'); clearTimeout(ANNA.t); }
      else if (av === 'mute') { ANNA.mute = true; try { sessionStorage.setItem('ak-anna', 'off'); } catch (er) {} $('#anna').classList.remove('talk'); }
      else if (av === 'menu') annaMenu();
      else if (av === 'again') annaSuggest(ANNA.kind || 'surprise');
      else { ANNA.mute = false; try { sessionStorage.removeItem('ak-anna'); } catch (er) {} annaSuggest(av); }
      return; }
    if (t.closest('#annaFig')) { annaMenu(); return; }
    if (t.closest('.anna-bubble') && !t.closest('button')) { annaQuiet(); return; }
    if (add) { e.preventDefault(); e.stopPropagation(); if (add.classList.contains('addline')) { add.classList.add('done'); setTimeout(function () { add.classList.remove('done'); }, 1200); } var src = add.closest('.item, .sp-card, .pop, .upsell button') || add.closest('.anna-bubble'); addToBag(add.dataset.add, 1, null, '', src ? $('img', src) : null); if (layer === 'drawer') renderDrawer(); return; }
    if (t.closest('[data-close]') && !go) { closeLayer(); return; }
    if (go && go.dataset.go.indexOf('cat-') === 0) { e.preventDefault(); openCat(go.dataset.go.slice(4)); return; }
    if (t.closest('[data-mp-close]')) { closeMp(); return; }
    if (!t.closest('.msearch')) { var sr = $('#sres'); if (sr) sr.classList.remove('on'); }
    if (go) { e.preventDefault(); var g = go.dataset.go; if (mpOpen) closeMp(); closeLayer(); setTimeout(function () { scrollToId(g === 'cat-ghee' ? 'cat-ghee' : g); }, layer ? 300 : 0); $$('#tabbar a').forEach(function (a) { a.classList.toggle('on', a.dataset.go === g); }); return; }
    if (open) { e.preventDefault(); var o = open.dataset.open; if (o === 'bag') openFlow('bag', 'bag'); else openFlow(o); return; }
    if (dish) { e.preventDefault(); openDish(dish.dataset.dish); return; }
    var itemEl = t.closest('.item, .sp-card'); if (itemEl && itemEl.dataset.id) { openDish(itemEl.dataset.id); return; }
    if (t === $('#scrim')) { closeLayer(); return; }
    var jy = t.closest('[data-jr]'); if (jy) { goJourney(+jy.dataset.jr); return; }
    // hero modes
    var mode = t.closest('[data-mode]'); if (mode) { setMode(mode.dataset.mode, false); return; }
    if (t.closest('#heroCta')) { runMode($('#heroCta').dataset.mode || 'pickup'); return; }
    // heat demo
    var lv = t.closest('#heatDemo .lv'); if (lv) { heatPref = +lv.dataset.h; store.set('ak-heat', heatPref); $$('#heatDemo .lv').forEach(function (x) { x.classList.toggle('on', x === lv); }); toast('<span>' + HEAT[heatPref] + ' it is. Tell us when you order.</span>'); if (heatPref === 2 && BYIMG.lassi) annaSay(annaCard(BYIMG.lassi, 'Andhra Hot? Brave! Keep this close:'), 'think'); return; }
    // menu chips
    var fc = t.closest('[data-filter]'); if (fc) { var k2 = fc.dataset.filter; filters[k2] = !filters[k2]; fc.classList.toggle('on', filters[k2]); applyFilters(); return; }
    var cc = t.closest('[data-cat]'); if (cc && cc.tagName === 'BUTTON') { openCat(cc.dataset.cat); return; }
    if (t.closest('#explainT')) { var on = !document.body.classList.contains('explain'); document.body.classList.toggle('explain', on); $('#explainT').classList.toggle('on', on); $('#explainT').setAttribute('aria-pressed', on); return; }
    // map + spices + trivia
    var pl = t.closest('[data-place]'); if (pl) { placeOn = +pl.dataset.place; $$('#mapArt .pin, #mapArt .plbl, #mapCities button').forEach(function (x) { x.classList.toggle('on', +x.dataset.place === placeOn); }); var paths = $$('#mapLines path'); paths.forEach(function (p, i) { p.setAttribute('stroke', i === placeOn ? '#e4bb67' : 'rgba(228,187,103,.5)'); p.setAttribute('stroke-width', i === placeOn ? 2 : 1.2); }); renderPop(); return; }
    var sp = t.closest('[data-spice]'); if (sp) { spiceOn = +sp.dataset.spice; $$('#spices .spice').forEach(function (x, i) { x.classList.toggle('on', i === spiceOn); }); renderInDishes(); return; }
    if (t.closest('#tNext')) { showFact(factOn + 1); return; }
    if (t.closest('#tPrev')) { showFact(factOn - 1); return; }
    var fd = t.closest('[data-fact]'); if (fd) { showFact(+fd.dataset.fact); return; }
    // dish sheet
    if (layer === 'sheet') {
      var ig = t.closest('[data-ig]'); if (ig) { ingrNote(ig.dataset.ig, ig); return; }
      var q = t.closest('[data-q]'); if (q) { sheetState.qty = Math.max(1, sheetState.qty + +q.dataset.q); $('#sQty').textContent = sheetState.qty; $('#sAdd').textContent = 'Add to order · ' + money(BYID[sheetState.id].price * sheetState.qty); return; }
      var hb = t.closest('#sSeg [data-h]'); if (hb) { sheetState.heat = +hb.dataset.h; $$('#sSeg button').forEach(function (x) { x.classList.toggle('on', x === hb); }); segPos($('#sSeg')); return; }
      if (t.closest('#sAdd')) { addToBag(sheetState.id, sheetState.qty, sheetState.heat, ($('#sNote').value || '').trim(), $('#sheet .media img')); closeLayer(); return; }
    }
    // drawer
    if (layer === 'drawer') {
      var st = t.closest('[data-step]'); if (st) { flow.step = st.dataset.step; if (flow.step === 'pay' && !valid(flow.how === 'table' || flow.how === 'counter' ? ['name'] : ['name', 'phone'])) { flow.step = 'details'; return; } renderDrawer(); return; }
      var lq = t.closest('[data-lq]'); if (lq) { var line = bag[+lq.dataset.lq]; line.qty += +lq.dataset.d; if (line.qty <= 0) bag.splice(+lq.dataset.lq, 1); saveBag(); renderDrawer(); return; }
      var how = t.closest('[data-how]'); if (how) { flow.how = how.dataset.how; renderDrawer(); return; }
      var pay = t.closest('[data-pay]'); if (pay) { flow.pay = pay.dataset.pay; renderDrawer(); return; }
      var slot = t.closest('[data-slot]'); if (slot) { flow.time = slot.dataset.slot; $$('[data-slot]').forEach(function (x) { x.classList.toggle('on', x === slot); }); return; }
      var tip = t.closest('[data-tip]'); if (tip) { flow.tip = +tip.dataset.tip; renderDrawer(); return; }
      if (t.closest('#placeOrder')) {
        if (flow.pay === 'card' && !valid(['card', 'exp', 'cvc'])) return;
        var no = 'AK-' + (1000 + Math.floor(Math.random() * 9000));
        store.set('ak-last', { no: no, time: flow.time, name: flow.form.name, total: total(), items: bag, table: flow.how === 'table' ? TABLE : null, counter: flow.how === 'counter' });
        bag = []; saveBag(); flow.step = 'done'; renderDrawer(); setTimeout(function () { annaSay('<p class="anna-say">Thank you! Enjoy your food.</p>', 'namaste', { ms: 4500 }); }, 900); return;
      }
      if (t.closest('#leaveTable')) { leaveTable(); return; }
      if (t.closest('#copyOrder')) { try { navigator.clipboard.writeText(orderText()); toast('<span>Order copied. Paste it into DoorDash notes if you like.</span>'); } catch (err) {} return; }
      var dy = t.closest('[data-day]'); if (dy) { flow.day = dy.dataset.day; renderDrawer(); return; }
      var rt = t.closest('[data-rtime]'); if (rt) { flow.rtime = rt.dataset.rtime; renderDrawer(); return; }
      var pt = t.closest('[data-party]'); if (pt) { flow.party = Math.min(20, Math.max(1, flow.party + +pt.dataset.party)); renderDrawer(); return; }
      if (t.closest('#bookTable')) { if (!valid(['name', 'phone'])) return; flow.step = 'done'; renderDrawer(); return; }
      var lk = t.closest('[data-like]'); if (lk) { var x = lk.dataset.like, i2 = flow.likes.indexOf(x); if (i2 >= 0) flow.likes.splice(i2, 1); else flow.likes.push(x); lk.classList.toggle('on'); return; }
      if (t.closest('#sendCatering')) { if (!valid(['name', 'phone', 'date'])) return; flow.step = 'done'; renderDrawer(); return; }
      var mr = t.closest('[data-more]'); if (mr) { var v = mr.dataset.more; if (v.indexOf('go:cat-') === 0) { openCat(v.slice(7)); } else if (v.indexOf('go:') === 0) { closeLayer(); scrollToId(v.slice(3)); } else openFlow(v); return; }
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'q') renderSearch(e.target.value);
    if (e.target.id === 'guests') { flow.guests = +e.target.value; $('#gOut').textContent = flow.guests; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (layer) closeLayer(); else closeMp(); }
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('item')) openDish(e.target.dataset.id);
  });
  window.addEventListener('resize', function () { var on = $('#modes button.on'); if (on) setMode(on.dataset.mode, false); segPos($('#sSeg')); });

  // ================= start =================
  // ================= content: Sanity CMS, with the built-in copy as a backup =================
  var CMS = { projectId: 'zkafsmgg', dataset: 'production', api: 'v2025-02-19' };
  var TICKER = [], SPEC = [], PRODS = [], VEGAN_LINE = '', CONTENT = null;
  var IMGQ = '"img": img.asset->url';
  var QUERY = '{"settings": *[_id == "siteSettings"][0]{name, phone, email, address, shortAddress, instagram, igHandle, doordash, comingSoon, comingSoonLine, visitNote, topbarNote, footerTagline, seoTitle, seoDescription, hours[]{day, closed, shifts[]{open, close}}},' +
    '"home": *[_id == "homePage"][0]{' +
    'hero{kicker, title, lede, orderNote, hint, ticker, pieces[]{' + IMGQ + ', "dish": dish->id.current, x, y, w, rot, depth, spin}},' +
    'specials{kicker, title, lede, "dishes": dishes[]->id.current},' +
    'spotlight{kicker, title, text, button, "dish": dish->id.current, ' + IMGQ + ', heatTitle, levels[]{name, text}, heatNote},' +
    'menu{kicker, title, lede, moments[]{key, name, when, clock, line, "cats": cats[]->id.current}, veganLabel, veganTitle, veganText, "veganImgs": veganImgs[].asset->url, veganPageText},' +
    'map{kicker, title, lede, ' + IMGQ + ', places[]{city, lat, lon, "dish": dish->id.current, side, taste}, guideTitle, guideLede, spices[]{name, text, ' + IMGQ + ', "dishes": dishes[]->id.current}},' +
    'journey{kicker, title, lede, steps[]{' + IMGQ + ', when, title, text}},' +
    'shop{kicker, title, lede, button, ' + IMGQ + ', hotspots[]{"dish": dish->id.current, label, x, y}, "products": products[]->id.current},' +
    'banquet{kicker, title, lede, caption, callButton, emailButton, ' + IMGQ + ', features[]{title, text}},' +
    'ways{kicker, title, qrTitle, qrText' + ['counter', 'doordash', 'catering', 'table', 'banquet'].map(function (k) { return ', ' + k + '{small, title, text, button, ' + IMGQ + '}'; }).join('') + '},' +
    'trivia{kicker, facts}, story{kicker, title, text, meaningWord, meaningText, ' + IMGQ + '}, reviews{show, kicker, quote, note, cards[]{text, name}, newsletterTitle, newsletterText}, visit{kicker, title}},' +
    '"categories": *[_type == "category"] | order(order asc){"id": id.current, name, blurb, kicker, ' + IMGQ + ', "pairs": pairs[]->id.current},' +
    '"items": *[_type == "menuItem" && hidden != true] | order(order asc){"id": id.current, key, "cat": category->id.current, sub, order, name, desc, explain, price, from, vegan, veg, gf, nuts, heat, signature, weekend, "img": photo.asset->url, "ingredients": ingredients[]->key.current},' +
    '"ingredients": *[_type == "ingredient"]{"key": key.current, name, note, ' + IMGQ + '}}';
  function loadContent() {
    // the built-in copy may fail on a bad connection; Sanity alone is then enough, and the reverse
    var local = fetch('data/content.json').then(function (r) { if (!r.ok) throw new Error('built-in ' + r.status); return r.json(); }).catch(function (e) { console.warn('Built-in copy failed:', e.message); return null; });
    if (!CMS.projectId || /[?&]local\b/.test(location.search)) return local.then(function (c) { if (!c) throw new Error('no content'); return c; });
    // ?fresh skips Sanity's 60-second cache, for checking an edit right after publishing
    var fresh = /[?&]fresh\b/.test(location.search);
    var url = 'https://' + CMS.projectId + (fresh ? '.api' : '.apicdn') + '.sanity.io/' + CMS.api + '/data/query/' + CMS.dataset + '?query=' + encodeURIComponent(QUERY);
    var live = Promise.race([
      fetch(url, fresh ? { cache: 'no-store' } : undefined).then(function (r) { if (!r.ok) throw new Error('cms ' + r.status); return r.json(); }).then(function (j) { if (!j.result || !j.result.items || !j.result.items.length) throw new Error('cms empty'); return j.result; }),
      new Promise(function (res, rej) { setTimeout(function () { rej(new Error('cms timeout')); }, 4000); })
    ]);
    return Promise.all([local, live.catch(function (e) { console.warn('Using the built-in copy:', e.message); return null; })]).then(function (r) { if (!r[0] && !r[1]) throw new Error('no content'); return r[1] ? merge(r[0], r[1]) : r[0]; });
  }
  // anything missing in the CMS falls back to the built-in copy, field by field
  function merge(base, over) {
    if (over == null) return base;
    if (Array.isArray(over) || typeof over !== 'object' || base == null || typeof base !== 'object' || Array.isArray(base)) return over;
    var out = {}; Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(over).forEach(function (k) { out[k] = merge(base[k], over[k]); });
    return out;
  }
  function pick(o, path) { return path.split('.').reduce(function (v, k) { return v == null ? v : v[k]; }, o); }
  function rich(v) { return esc(String(v)).replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>'); }
  function hrs(t) { var m = String(t || '').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] + m[2] / 60 : 0; }
  function useContent(C) {
    CONTENT = C; var H = C.home || {}, S = C.settings || {};
    // business details
    ['name', 'phone', 'email', 'address', 'instagram', 'igHandle', 'doordash', 'comingSoon'].forEach(function (k) { if (S[k] != null) BIZ[k] = S[k]; });
    if (S.hours && S.hours.length) { BIZ.hours = {}; for (var d = 0; d < 7; d++) BIZ.hours[d] = []; S.hours.forEach(function (h) { BIZ.hours[h.day] = h.closed ? [] : (h.shifts || []).map(function (x) { return [hrs(x.open), hrs(x.close)]; }); }); }
    if (S.seoTitle) document.title = S.seoTitle;
    var md = document.querySelector('meta[name="description"]'); if (md && S.seoDescription) md.setAttribute('content', S.seoDescription);
    // menu
    var cats = (C.categories || []).filter(function (c) { return c && c.id; });
    var items = (C.items || []).filter(function (it) { return it && it.id && it.cat; }).map(function (it) {
      var key = it.key || it.id, tags = [];
      if (it.vegan) tags.push('V'); else if (it.veg) tags.push('VG'); if (it.gf) tags.push('GF'); if (it.nuts) tags.push('N');
      PHOTO[key] = it.img || PHOTO[key];
      return { id: it.id, cat: it.cat, sub: it.sub || '', name: it.name || '', desc: it.desc || '', explain: it.explain || '', price: +it.price || 0, from: it.from || '', tags: tags, img: key, veg: !!(it.veg || it.vegan), vegan: !!it.vegan, heat: !!it.heat, signature: !!it.signature, weekend: !!it.weekend, ingredients: it.ingredients || [] };
    });
    MENU = { categories: cats.map(function (c) { return { id: c.id, name: c.name, blurb: c.blurb || '', img: c.img, count: items.filter(function (i) { return i.cat === c.id; }).length }; }), items: items };
    BYID = {}; BYIMG = {}; items.forEach(function (i) { BYID[i.id] = i; if (!BYIMG[i.img]) BYIMG[i.img] = i; });
    var key = function (id) { return BYID[id] ? BYID[id].img : null; }, keys = function (l) { return (l || []).map(key).filter(Boolean); };
    INGR = { ingredients: {}, dishes: {} };
    (C.ingredients || []).forEach(function (g) { if (g && g.key) INGR.ingredients[g.key] = { name: g.name, note: g.note || '', img: g.img }; });
    items.forEach(function (i) { INGR.dishes[i.id] = i.ingredients.filter(function (k) { return INGR.ingredients[k]; }); });
    ORDER = cats.map(function (c) { return c.id; });
    KICK = { vegan: 'Plant-based · No dairy, no ghee' }; PAIR = {};
    cats.forEach(function (c) { if (c.kicker) KICK[c.id] = c.kicker; PAIR[c.id] = keys(c.pairs); });
    PAIRX = PAIR;
    // sections
    var hero = H.hero || {}, mn = H.menu || {}, mp = H.map || {}, sh = H.shop || {};
    TICKER = hero.ticker || [];
    SPEC = keys((H.specials || {}).dishes);
    PRODS = keys(sh.products);
    VEGAN_LINE = mn.veganPageText || '';
    if (mn.moments && mn.moments.length) { MOM = {}; mn.moments.forEach(function (m) { MOM[m.key || m.name] = { name: m.name, when: m.when, clock: m.clock == null ? null : +m.clock, cats: (m.cats || []).filter(function (c) { return ORDER.indexOf(c) >= 0; }), line: m.line || '' }; }); }
    PLACES = (mp.places || []).filter(function (pl) { return key(pl.dish); }).map(function (pl) { return [String(pl.city || '').toUpperCase(), +pl.lat, +pl.lon, key(pl.dish), pl.side === 'R' ? 'R' : 'L']; });
    TASTE = {}; (mp.places || []).forEach(function (pl) { if (key(pl.dish)) TASTE[key(pl.dish)] = pl.taste || ''; });
    if (placeOn >= PLACES.length) placeOn = 0;
    SPICES = (mp.spices || []).map(function (sp) { return [sp.img, sp.name, sp.text, keys(sp.dishes)]; });
    JR = ((H.journey || {}).steps || []).map(function (st) { return [st.img, st.when, st.title, st.text]; });
    FACTS = ((H.trivia || {}).facts || []).filter(Boolean);
    if (!FACTS.length) FACTS = [''];
    // text and images marked in the page
    $$('[data-cms]').forEach(function (el) { var v = pick(C, el.dataset.cms); if (v != null && v !== '') el.innerHTML = rich(v); });
    $$('[data-cms-src]').forEach(function (el) { var v = pick(C, el.dataset.cmsSrc); if (v) el.src = IMG(v, +el.dataset.w || 1400); });
    // hero table
    var tb = $('#h3Table');
    if (tb && hero.pieces) tb.innerHTML = hero.pieces.map(function (pc, i) {
      var st = '--x:' + (+pc.x) + '%;--y:' + (+pc.y) + '%;--w:' + (+pc.w) + '%;--r:' + (+pc.rot || 0) + 'deg;--z:' + (pc.depth == null ? 1 : +pc.depth) + ';--spin:' + (+pc.spin || 0) + ';--d:' + (.05 + i * .093).toFixed(2) + 's';
      var img = '<img src="' + IMG(pc.img, 1400, 92) + '" alt="">';
      return pc.dish && BYID[pc.dish] ? '<button class="pc" data-dish="' + esc(pc.dish) + '" style="' + st + '">' + img + '<span class="pl"><em></em><b></b></span></button>' : '<i class="pc g" style="' + st + '">' + img + '</i>';
    }).join('');
    // spotlight
    var spt = H.spotlight || {}, sd = BYID[spt.dish];
    var sb = $('#spotlight [data-dish]'); if (sb && sd) sb.dataset.dish = sd.id;
    var spr = $('#spotPrice'); if (spr && sd) spr.innerHTML = money(sd.price) + ' ' + sd.tags.map(function (t) { return '<span class="tag ' + t + '">' + ({ V: 'VEGAN', VG: 'VEGETARIAN', GF: 'GLUTEN-FREE', N: 'CONTAINS NUTS' })[t] + '</span>'; }).join('');
    // ghee hotspots
    var ga = $('#gheeArt'); if (ga && sh.hotspots) { $$('.hot', ga).forEach(function (h) { h.remove(); }); ga.insertAdjacentHTML('beforeend', sh.hotspots.filter(function (h) { return BYID[h.dish]; }).map(function (h) { return '<button class="hot' + (+h.x > 70 ? ' l' : '') + '" style="left:' + (+h.x) + '%;top:' + (+h.y) + '%" data-dish="' + esc(h.dish) + '"><i></i><span>' + esc(h.label || BYID[h.dish].name) + '<b></b></span></button>'; }).join('')); }
    // banquet features + reviews
    var bf = $('#bqList'), bq = H.banquet || {}; if (bf && bq.features) bf.innerHTML = bq.features.map(function (f, i) { return '<div class="bq-it fx" style="--d:' + (.16 + i * .06).toFixed(2) + 's"><span>' + ('0' + (i + 1)).slice(-2) + '</span><b>' + esc(f.title || '') + '</b><p>' + esc(f.text || '') + '</p></div>'; }).join('');
    var rs = $('#reviews'), showRv = !!(H.reviews || {}).show; if (rs) { rs.classList.toggle('solo', !showRv); rs.firstElementChild.hidden = !showRv; }
    var rc = $('#rvCards'), rv = H.reviews || {}; if (rc && rv.cards) rc.innerHTML = rv.cards.map(function (c, i) { return '<div class="rc fx" style="--d:' + (i * .08).toFixed(2) + 's"><div class="stars" style="font-size:14px">★★★★★</div><p>' + esc(c.text || '') + '</p><span>— ' + esc(c.name || '') + '</span></div>'; }).join('');
    // counts that follow the menu
    var q = $('#q'); if (q) q.placeholder = 'Search all ' + items.length + ' dishes: dosa, biryani, vegan…';
    var jc = $('#jrCountText'); if (jc) jc.textContent = 'Point A to point B · ' + JR.length + ' steps';
  }
  function start(retry) {
    loadContent().catch(function (e) {
      if (!retry) return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { start(true); return null; });
      document.documentElement.classList.remove('ak-wait');
      toast('<span>The menu could not load. Check your connection and refresh.</span>'); clearTimeout(toastT);
      throw e;
    }).then(function (C) {
      if (!C) return;
      useContent(C);
      bag = bag.filter(function (l) { return BYID[l.id]; });
      renderAll(); saveBag(); wireBiz(); renderHours(); setMode('pickup', false);
      $$('.js-today').forEach(function (a) { a.textContent = BIZ.comingSoon ? 'Opening soon · follow ' + BIZ.igHandle : $('#todayHours').textContent; });
      var tl = $('#todayHours'); if (BIZ.comingSoon && tl && CONTENT.settings && CONTENT.settings.comingSoonLine) tl.textContent = CONTENT.settings.comingSoonLine;
      if (h0intro()) { var tb = $('#h3Table'); if (tb) tb.classList.add('in', 'no-land'); }
      heroPeek();
      annaPose('wave'); $('#anna').classList.add('ready', 'tip-label'); setTimeout(function () { $('#anna').classList.remove('tip-label'); }, 9000);
      setTimeout(annaMaybe, h0intro() ? 20000 : 14000);
      tableUI();
      if (/[?&](counter|table)/.test(location.search)) { setTimeout(function () { scrollToId('menu'); }, 400); }
      if (false) { setTimeout(function () { toast('<span>Order here and collect it at the counter</span><button data-go="menu">Menu</button>'); }, 600); }
      var sq = $('#scanQr'); if (sq && window.AshaQR) sq.innerHTML = AshaQR.svg(location.origin + location.pathname + '?counter', { color: '#173212', margin: 2, label: 'QR code for this menu' });
      if (TABLE && TABLE_FRESH) setTimeout(function () { openFlow('table'); }, 500);
      var hm = location.hash.match(/^#menu-([a-z]+)/); if (hm && CAT[hm[1]]) openCat(hm[1], false);
      parEls = $$('[data-par]'); parEls.forEach(function (e) { e.dataset.base = e.style.transform || ''; });
      $$('[data-tilt]').forEach(tilt);
      initScroll();
      // fades start once the logo intro opens onto the page
      var h = document.documentElement, go = function () { reveal(document); };
      if (h.classList.contains('ak-on') || h.classList.contains('ak-wait')) {
        var t = setTimeout(go, ((window.AshaIntro && window.AshaIntro.OPEN) || 4.9) * 1000 - 300);
        if (window.AshaIntroDone) window.AshaIntroDone.then(function () { clearTimeout(t); go(); });
      } else go();
      factT = setInterval(function () { showFact(factOn + 1); }, 7000);
      document.documentElement.classList.add('app-ready');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { start(); }); else start();
  window.AshaApp = { table: function () { return TABLE; }, useScan: function (t) { return useScan(t); }, BIZ: BIZ, open: openDish, flow: function (n, s) { openFlow(n, s); }, bag: function () { return bag; }, jump: function (id) { var t = document.getElementById(id); if (!t) return; var y = t.getBoundingClientRect().top + window.scrollY - 70; if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); } };
})();
