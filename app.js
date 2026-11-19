/* Breach Escape: app shell. Breach Map, saved progress, glossary terms and the shared helpers case.js uses.
   No external requests; progress stays in this browser only. */
(function () {
  'use strict';

  var LEVELS = window.LEVELS || [];
  var STORE_KEY = 'breach-escape-progress-v1';
  var app = document.getElementById('app');

  /* ---------- progress (local only) ----------
     progress.cases[caseId] = { briefed, act1: {...}, act2: { bestStars, bestBuild, lastStars, runs } }.
     Older saves also hold progress.levels from the retired classic quiz; it is ignored. */
  function loadProgress() {
    try { var p = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); return p && typeof p === 'object' ? p : {}; }
    catch (e) { return {}; }
  }
  function saveProgress(p) { try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) { /* storage unavailable */ } }
  var progress = loadProgress();

  /* ---------- tiny DOM helper (text via textContent only) ---------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, kids) {
    var el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { el.appendChild(c); });
    return el;
  }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function reduceMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---------- glossary: tappable terms; the case screen shows the definition (termSink) ---------- */
  var GLOSSARY = window.GLOSSARY || {};
  var TERMS = Object.keys(GLOSSARY).sort(function (a, b) { return b.length - a.length; });
  var termRe = TERMS.length ? new RegExp('(^|[^A-Za-z0-9_])(' + TERMS.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?![A-Za-z0-9_])', 'gi') : null;
  var termIndex = {}; TERMS.forEach(function (t) { termIndex[t.toLowerCase()] = t; });
  var termSink = null;
  // Build text nodes with tappable <span class="term"> for glossary words. textContent only, never HTML.
  function termify(text, el) {
    el = el || h('span', {});
    if (!termRe || !text) { el.textContent = text || ''; return el; }
    var last = 0, seen = {}, m;
    termRe.lastIndex = 0;
    while ((m = termRe.exec(text))) {
      var key = m[2].toLowerCase(), start = m.index + m[1].length;
      if (seen[key]) continue;          // link only the first occurrence per block
      seen[key] = true;
      el.appendChild(document.createTextNode(text.slice(last, start)));
      el.appendChild(h('span', { class: 'term' + (/_/.test(m[2]) ? ' term-code' : ''), role: 'button', tabindex: '0', 'aria-label': 'Define ' + m[2],
        onclick: termClick(termIndex[key]), onkeydown: termKey(termIndex[key]) }, [m[2]]));
      last = start + m[2].length;
    }
    el.appendChild(document.createTextNode(text.slice(last)));
    return el;
  }
  function defineTerm(term) { if (termSink && GLOSSARY[term]) termSink(term, GLOSSARY[term]); }
  function termClick(term) { return function (e) { e.preventDefault(); e.stopPropagation(); defineTerm(term); }; }
  function termKey(term) { return function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); defineTerm(term); } }; }

  /* ---------- screen changes: run every cleanup registered by the previous screen ---------- */
  var leaveHooks = [];
  function leave() {
    termSink = null;
    var hooks = leaveHooks; leaveHooks = [];
    hooks.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }

  /* ---------- Breach Map ---------- */
  function caseIdOf(L) { return L.case ? L.case.replace(/^.*\//, '').replace(/\.json$/, '') : null; }
  function bestStars(L) {
    var rec = (progress.cases || {})[caseIdOf(L)];
    return rec && rec.act2 && rec.act2.bestStars != null ? rec.act2.bestStars : null;
  }
  function starText(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
  function openLevel(L) { if (L.case && window.BreachCase) window.BreachCase.start(L); }

  function renderMap() {
    leave();
    app.textContent = ''; app.className = 'app case c-mapscreen';
    if (window.BreachCase) window.BreachCase.backdrop();
    var ready = LEVELS.filter(function (L) { return L.status === 'ready' && L.case; });
    var cleared = ready.filter(function (L) { return bestStars(L) > 0; });
    var totalStars = ready.reduce(function (a, L) { return a + (bestStars(L) || 0); }, 0);
    var next = ready.filter(function (L) { return !(bestStars(L) > 0); })[0] || ready[ready.length - 1];

    app.appendChild(h('div', { class: 'c-brandrow' }, [
      h('div', {}, [
        h('div', { class: 'c-eyebrow', text: 'KEPT Academy · Know the Exposure, Patch the Threat' }),
        h('h1', { class: 'c-brand', text: 'Breach Escape' })
      ]),
      h('span', { class: 'c-xp', 'aria-label': totalStars + ' stars earned', text: totalStars + ' ★' })
    ]));

    if (next) {
      var played = bestStars(next) != null;
      app.appendChild(h('div', { class: 'c-panel hl c-next' }, [
        h('div', { class: 'c-eyebrow', text: played ? '> replay' : cleared.length ? '> up next' : '> start here' }),
        h('p', { class: 'c-nextname', text: 'Level ' + next.id + ' · ' + next.name }),
        h('p', { class: 'c-small', text: next.victim + ' · ' + next.year + ' · ' + next.teaser }),
        h('button', { class: 'c-btn', text: played ? '> REOPEN CASE' : '> OPEN CASE FILE', onclick: function () { openLevel(next); } })
      ]));
    }

    var total = LEVELS.length;
    var fill = h('div', { class: 'c-meterfill' });
    app.appendChild(h('div', { class: 'c-hud' }, [
      h('span', { text: '> ls ./season-1   real breaches, replayed' }),
      h('span', { class: 'c-season' }, [
        h('span', { class: 'c-meter', role: 'progressbar', 'aria-label': 'Season progress', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(cleared.length) }, [fill]),
        h('span', { text: cleared.length + '/' + total })
      ])
    ]));
    fill.style.width = Math.round(cleared.length / total * 100) + '%';

    var list = h('ol', { class: 'c-levels' });
    LEVELS.forEach(function (L) {
      var ok = L.status === 'ready' && !!L.case, stars = ok ? bestStars(L) : null, done = stars > 0;
      var isNext = next && L.id === next.id && !done;
      var right = stars != null ? h('span', { class: 'c-lstars', text: starText(stars) })
        : h('span', { class: 'c-pill ' + (ok ? 'g' : 'o'), text: ok ? 'PLAY' : 'SOON' });
      list.appendChild(h('li', {}, [h('button', {
        class: 'c-level' + (isNext ? ' next' : ''), disabled: !ok,
        'aria-label': 'Level ' + L.id + ': ' + L.name + ', ' + L.victim + ' ' + L.year + (ok ? '' : ', coming soon') + (stars != null ? ', ' + stars + ' of 3 stars' : '') + (isNext ? ', up next' : ''),
        onclick: ok ? function () { openLevel(L); } : null
      }, [
        h('span', { class: 'c-lnum' + (done ? ' done' : ''), text: done ? '✓' : String(L.id).length < 2 ? '0' + L.id : String(L.id) }),
        h('span', { class: 'c-lmeta' }, [
          h('span', { class: 'c-lname', text: L.name }),
          h('span', { class: 'c-lsub', text: L.victim + ' · ' + L.year }),
          h('span', { class: 'c-lteaser', text: L.teaser })
        ]),
        right
      ])]));
    });
    app.appendChild(list);

    var lock = svgEl('svg', { viewBox: '0 0 16 16', width: '14', height: '14', 'aria-hidden': 'true' }, [
      svgEl('rect', { x: '3', y: '7', width: '10', height: '7', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }),
      svgEl('path', { d: 'M5.5 7V5a2.5 2.5 0 0 1 5 0v2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' })
    ]);
    app.appendChild(h('p', { class: 'c-small c-privacy' }, [lock, 'Progress is saved only on this device. No account, no tracking.']));
    window.scrollTo(0, 0);
  }

  /* ---------- shared API for case.js (the case engine) ---------- */
  window.BreachEscape = {
    app: app,
    h: h,
    termify: termify,
    shuffle: shuffle,
    reduceMotion: reduceMotion,
    glossary: GLOSSARY,
    progress: function () { return progress; },
    saveProgress: function () { saveProgress(progress); },
    setTermSink: function (fn) { termSink = fn; },
    onLeave: function (fn) { leaveHooks.push(fn); },
    leave: leave,
    renderMap: renderMap
  };

  /* ---------- boot (after case.js has loaded too) ---------- */
  document.addEventListener('DOMContentLoaded', renderMap);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
