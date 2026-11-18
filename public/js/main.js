(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.remove('no-js');

  // ---- nav, progress, scroll spy --------------------------------------
  var nav = $('#nav'), bar = $('#progress');
  function onScroll() {
    var y = window.scrollY || 0;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
    nav.classList.toggle('scrolled', y > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var burger = $('#burger');
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('#links a').forEach(function (a) {
    a.addEventListener('click', function () { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); });
  });

  var spyLinks = $$('#links a');
  var spyMap = {};
  spyLinks.forEach(function (a) { spyMap[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        spyLinks.forEach(function (a) { a.classList.remove('on'); });
        var a = spyMap[e.target.id];
        if (a) a.classList.add('on');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(spyMap).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
  }

  // ---- reveal + count up ----------------------------------------------
  function countUp(el) {
    var end = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(end) || end === 0 || reduce) { el.textContent = String(end); return; }
    var t0 = null, dur = 1100;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      el.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        $$('[data-count]', e.target).forEach(countUp);
        if (e.target.hasAttribute('data-count')) countUp(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // ---- hero parallax (mouse only) -------------------------------------
  var stage = $('#stage');
  if (stage && !reduce && window.matchMedia('(hover: hover)').matches) {
    var raf = 0;
    window.addEventListener('mousemove', function (e) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var r = stage.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        var y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
        stage.style.setProperty('--mx', (x * 2).toFixed(3));
        stage.style.setProperty('--my', (y * 2).toFixed(3));
      });
    });
  }

  // ---- live file info + download buttons ------------------------------
  var dlBtns = $$('[data-dl]');
  var statusEl = $('#status');
  var copyBtn = $('#copy');
  var available = true;

  function setAll(key, text) { $$('[data-info="' + key + '"]').forEach(function (el) { el.textContent = text; }); }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return iso; }
  }

  fetch('/api/info', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      setAll('version', d.version || '');
      setAll('file', d.file || 'HydraTools.apk');
      if (!d.available) {
        available = false;
        setAll('size', 'n/a'); setAll('updated', 'n/a'); setAll('sha', 'n/a');
        $$('.sz').forEach(function (s) { s.textContent = ''; });
        dlBtns.forEach(function (a) { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('download'); });
        if (statusEl) statusEl.textContent = 'The APK is not uploaded yet. Check back soon.';
        return;
      }
      setAll('size', d.sizeHuman);
      setAll('updated', fmtDate(d.updatedAt));
      setAll('sha', d.sha256 || 'n/a');
      if (d.sha256 && copyBtn) {
        copyBtn.hidden = false;
        copyBtn.addEventListener('click', function () {
          if (!navigator.clipboard) return;
          navigator.clipboard.writeText(d.sha256).then(function () {
            copyBtn.textContent = 'Copied';
            setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1600);
          });
        });
      }
    })
    .catch(function () { setAll('size', 'n/a'); setAll('updated', 'n/a'); setAll('sha', 'n/a'); });

  dlBtns.forEach(function (btn) {
    var lbl = $('.lbl', btn), original = lbl ? lbl.textContent : '';
    btn.addEventListener('click', function () {
      if (!available || btn.classList.contains('busy')) return;
      btn.classList.add('busy');
      if (lbl) lbl.textContent = 'Starting download';
      if (statusEl) statusEl.textContent = 'Your download is starting.';
      setTimeout(function () {
        btn.classList.remove('busy');
        if (lbl) lbl.textContent = 'Download started';
        if (statusEl) statusEl.textContent = 'If nothing happened, check your browser\u2019s downloads.';
      }, 2200);
      setTimeout(function () { if (lbl) lbl.textContent = original; }, 7000);
    });
  });

  // ---- screens rail ---------------------------------------------------
  var rail = $('#rail');
  var slides = $$('.slide', rail);
  var tabs = $$('.tab');

  function applyFilter(f) {
    slides.forEach(function (s) { s.hidden = !(f === 'all' || s.getAttribute('data-group') === f); });
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-filter') === f;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', String(on));
    });
    rail.scrollTo({ left: 0, behavior: reduce ? 'auto' : 'smooth' });
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { applyFilter(t.getAttribute('data-filter')); }); });

  function nudge(dir) { rail.scrollBy({ left: dir * Math.min(rail.clientWidth * 0.8, 520), behavior: reduce ? 'auto' : 'smooth' }); }
  $('#s-prev').addEventListener('click', function () { nudge(-1); });
  $('#s-next').addEventListener('click', function () { nudge(1); });

  // drag to scroll (mouse), without breaking clicks
  var down = false, startX = 0, startL = 0, moved = 0;
  rail.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse') return;
    down = true; moved = 0; startX = e.clientX; startL = rail.scrollLeft;
  });
  window.addEventListener('pointermove', function (e) {
    if (!down) return;
    var dx = e.clientX - startX; moved = Math.max(moved, Math.abs(dx));
    if (moved > 4) { rail.classList.add('drag'); rail.scrollLeft = startL - dx; }
  });
  window.addEventListener('pointerup', function () { down = false; rail.classList.remove('drag'); });

  // ---- viewer ---------------------------------------------------------
  var lb = $('#lb'), lbImg = $('#lb-img'), lbCap = $('#lb-cap'), idx = 0;
  function visible() { return slides.filter(function (s) { return !s.hidden; }); }
  function show(i) {
    var list = visible(); if (!list.length) return;
    idx = (i + list.length) % list.length;
    var fig = list[idx], img = $('img', fig);
    lbImg.src = img.getAttribute('src');
    lbImg.alt = img.getAttribute('alt');
    lbCap.textContent = (idx + 1) + ' / ' + list.length + '   ' + $('b', fig).textContent;
  }
  function open(fig) {
    idx = visible().indexOf(fig); show(idx);
    if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
  }
  function close() { if (typeof lb.close === 'function') lb.close(); else lb.removeAttribute('open'); }

  slides.forEach(function (fig) {
    $('.device', fig).addEventListener('click', function (e) {
      if (moved > 4) { e.preventDefault(); moved = 0; return; }
      open(fig);
    });
  });
  $('#lb-close').addEventListener('click', close);
  $('#lb-prev').addEventListener('click', function () { show(idx - 1); });
  $('#lb-next').addEventListener('click', function () { show(idx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.hasAttribute('open')) return;
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
})();
