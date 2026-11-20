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

  /* ---------- sound effects: synthesized with Web Audio (no audio files), off by default ----------
     Saved as 'breach-escape-sound' ('on' to enable). Nothing plays before the first click, tap or key press,
     and every sound goes with text already on screen, so it never carries information on its own. */
  var SOUND_KEY = 'breach-escape-sound';
  var audio = null, master = null, gestured = false;
  ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, function () { gestured = true; }, true); });
  function soundOn() { try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch (e) { return false; } }
  function note(t, freq, dur, type, peak, freqEnd) {
    var o = audio.createOscillator(), g = audio.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak || 0.5, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var SOUNDS = {
    // Game events only (never navigation), low and soft: no short high chirps.
    alert: function (t) { [392, 294, 392, 294].forEach(function (f, i) { note(t + i * 0.2, f, 0.18, 'triangle', 0.32); }); },
    blip: function (t) { note(t, 330, 0.14, 'sine', 0.3, 440); },
    alarm: function (t) { [220, 165, 220, 165].forEach(function (f, i) { note(t + i * 0.22, f, 0.2, 'triangle', 0.34); }); },
    contained: function (t) { [262, 330, 392].forEach(function (f, i) { note(t + i * 0.14, f, 0.22, 'sine', 0.3); }); }
  };
  function sound(name) {
    if (!soundOn() || !gestured || !SOUNDS[name]) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!audio) { audio = new AC(); master = audio.createGain(); master.gain.value = 0.12; master.connect(audio.destination); }
      if (audio.state === 'suspended') audio.resume();
      SOUNDS[name](audio.currentTime + 0.01);
    } catch (e) { /* audio unavailable: text already shows the event */ }
  }
  function soundToggle() {
    var b = h('button', { class: 'c-ghost c-voicebtn c-soundbtn' });
    function paint() { b.textContent = 'sound: ' + (soundOn() ? 'on' : 'off'); b.setAttribute('aria-pressed', String(soundOn())); }
    b.addEventListener('click', function () {
      try { localStorage.setItem(SOUND_KEY, soundOn() ? 'off' : 'on'); } catch (e) { /* storage unavailable */ }
      paint();
    });
    paint();
    return b;
  }

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
    if (window.BreachCase) window.BreachCase.backdrop('brand');
    var ready = LEVELS.filter(function (L) { return L.status === 'ready' && L.case; });
    var cleared = ready.filter(function (L) { return bestStars(L) > 0; });
    var totalStars = ready.reduce(function (a, L) { return a + (bestStars(L) || 0); }, 0);
    var next = ready.filter(function (L) { return !(bestStars(L) > 0); })[0] || ready[ready.length - 1];

    // Header: one line only (no wrapping at 390px): KEPT ACADEMY on the left, help and stars on the right.
    var helpBox = h('div', { class: 'c-helpbox c-maphelp', id: 'c-maphelp', hidden: true }, [
      h('p', { text: 'Real breaches, replayed. Investigate, then defend.' }),
      h('p', { class: 'c-steps', 'aria-label': 'Each case: 1 brief, 2 investigate, 3 defend' }, [
        h('span', { class: 't-g', text: '01' }), ' brief \u2192 ', h('span', { class: 't-g', text: '02' }), ' investigate \u2192 ', h('span', { class: 't-g', text: '03' }), ' defend'
      ])
    ]);
    var helpBtn = h('button', { class: 'c-ghost c-helpbtn', 'aria-label': 'How it works', 'aria-expanded': 'false', 'aria-controls': 'c-maphelp', text: '?', onclick: function () {
      var open = helpBox.hidden; helpBox.hidden = !open; helpBtn.setAttribute('aria-expanded', String(open));
    } });
    app.appendChild(h('header', { class: 'c-maphead' }, [
      h('span', { class: 'c-keptlabel', text: 'KEPT ACADEMY' }),
      h('span', { class: 'c-headright' }, [helpBtn, h('span', { class: 'c-xp', 'aria-label': totalStars + ' stars earned', text: totalStars + ' \u2605' })])
    ]));
    app.appendChild(h('h1', { class: 'c-brand', text: 'Breach Escape' }));
    app.appendChild(helpBox);

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
        h('span', { class: 'c-count', text: cleared.length + '/' + total })
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
    app.appendChild(h('div', { class: 'c-foot' }, [
      h('button', { class: 'c-ghost', text: '> about', onclick: renderAbout }),
      window.BreachCase ? window.BreachCase.voiceToggle() : null,
      soundToggle()
    ]));
    window.scrollTo(0, 0);
  }

  /* ---------- About ---------- */
  var STORE_KEYS = [STORE_KEY, 'breach-escape-voice', SOUND_KEY];   // every localStorage key this app writes
  var ABOUT_UPDATED = '2026-11-19';
  function extLink(href, text) { return h('a', { href: href, target: '_blank', rel: 'noopener noreferrer', text: text }); }
  function renderAbout() {
    leave();
    app.textContent = ''; app.className = 'app case c-aboutscreen';
    if (window.BreachCase) window.BreachCase.backdrop('brand');
    app.appendChild(h('div', { class: 'c-hud' }, [
      h('button', { class: 'c-ghost c-exit', onclick: renderMap }, ['\u2039 back to map']),
      h('span', { class: 'c-act', text: 'ABOUT' }), h('span', {})
    ]));
    var site = window.SITE || {};
    var panel = function (cls, title, kids) { return h('div', { class: 'c-panel' + (cls ? ' ' + cls : '') }, [h('div', { class: 'c-eyebrow', text: title })].concat(kids)); };
    app.appendChild(panel('hl', '> cat about.txt', [
      h('h1', { class: 'c-h2', text: 'Breach Escape' }),
      h('p', { text: 'Real breaches, replayed from public records. Each case has a briefing, an investigation and a defense round.' })
    ]));
    app.appendChild(panel('', 'Sources', [
      h('p', { text: 'Cases are built only from public primary sources, such as official testimony, government advisories and the company\u2019s own published investigation. Every case cites its sources.' }),
      h('p', { text: 'Log entries shown in the game are recreated for training and are labelled that way.' })
    ]));
    app.appendChild(panel('', 'Not affiliated', [
      h('p', { text: 'Breach Escape is not affiliated with or endorsed by any company or organization named in the cases.' })
    ]));
    // Checked against the code: the only storage is localStorage (keys above) and sessionStorage (splash flag),
    // no cookies are set, and every request goes to this site (CSP connect-src 'self').
    var resetBox = h('div', { class: 'c-confirm', role: 'group', 'aria-label': 'Confirm reset', hidden: true });
    var resetBtn = h('button', { class: 'c-ghost c-resetbtn', 'aria-expanded': 'false', text: '> reset my progress', onclick: function () {
      resetBox.hidden = false; resetBtn.setAttribute('aria-expanded', 'true');
      var yes = resetBox.querySelector('.c-yes'); if (yes) yes.focus();
    } });
    resetBox.appendChild(h('p', { text: 'Delete all saved progress, stars and settings for Breach Escape on this device? This can\u2019t be undone.' }));
    resetBox.appendChild(h('div', { class: 'c-toggles' }, [
      h('button', { class: 'c-btn red c-yes', text: 'Yes, reset', onclick: resetProgress }),
      h('button', { class: 'c-ghost', text: 'Cancel', onclick: function () { resetBox.hidden = true; resetBtn.setAttribute('aria-expanded', 'false'); resetBtn.focus(); } })
    ]));
    app.appendChild(panel('', 'Privacy', [
      h('p', { text: 'Your progress and settings stay in your browser. No account needed. No cookies, ads or tracking, and the game doesn\u2019t send your data anywhere. Like any website, our host keeps standard server logs.' }),
      h('p', { class: 'c-small', text: 'Last updated: ' + ABOUT_UPDATED }),
      resetBtn, resetBox
    ]));
    var who = [
      h('p', { text: 'Built by Nura Avazova, KEPT Academy \u2014 Know the Exposure, Patch the Threat.' }),
      h('p', {}, [extLink('https://keptacademy.com', 'keptacademy.com'), ' \u00b7 ', extLink('https://www.linkedin.com/in/nura-avazova/', 'LinkedIn: Nura Avazova')])
    ];
    if (site.contactEmail) who.push(h('p', {}, ['Corrections and contact: ', h('a', { href: 'mailto:' + site.contactEmail, text: site.contactEmail })]));
    app.appendChild(panel('', 'Who made this', who));
    window.scrollTo(0, 0);
  }
  function resetProgress() {
    STORE_KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } });
    progress = {};
    renderMap();
  }

  /* ---------- opening splash: a short terminal "login", once per browser session, never on a direct case link ----------
     Commands type with slight human-like timing; output appears at once; then the KEPT logo, then a fade into the map (~5.5 s).
     Reduced motion: the logo alone for about 1 s. Any click, tap or key (or the skip button) ends it. */
  var SPLASH_LABEL = 'KEPT Academy \u2014 Know the Exposure, Patch the Threat';
  function splash() {
    try { if (sessionStorage.getItem('breach-escape-splash')) return; sessionStorage.setItem('breach-escape-splash', '1'); } catch (e) { /* storage unavailable: show it */ }
    var ready = LEVELS.filter(function (L) { return L.status === 'ready' && L.case; }), N = ready.length;
    var closed = ready.filter(function (L) { return bestStars(L) > 0; }).length;
    var returning = !!(progress.cases && Object.keys(progress.cases).length);
    var script = [
      { cmd: 'ssh analyst@kept-soc', out: 'connecting... ok' },
      { cmd: 'whoami', out: 'analyst' },
      { cmd: 'load ./season-1', out: returning ? '[ok] welcome back \u00b7 ' + closed + '/' + N + ' cases closed' : '[ok] ' + N + ' real breaches loaded' },
      { cmd: 'clear' }
    ];
    var tag = h('span', { class: 'c-spl-tag' });
    [['K', 1], ['now the ', 0], ['E', 1], ['xposure, ', 0], ['P', 1], ['atch the ', 0], ['T', 1], ['hreat', 0]].forEach(function (p) {
      tag.appendChild(h('span', { class: p[1] ? 'c-spl-k' : 'c-spl-d', text: p[0] }));
    });
    var term = h('div', { class: 'c-spl-term', 'aria-hidden': 'true' });
    var kept = h('span', { class: 'c-spl-kept' });
    var tagrow = h('div', { class: 'c-spl-tagrow' }, [tag]);
    var logo = h('div', { class: 'c-spl-logo', 'aria-hidden': 'true', hidden: true }, [
      h('div', { class: 'c-spl-row' }, [kept, h('span', { class: 'c-spl-cur', text: '_' })]),
      tagrow
    ]);
    var cursor = h('span', { class: 'c-spl-cur', text: '_' });
    var skip = h('button', { class: 'c-ghost c-spl-skip', text: 'skip \u203a' });
    var el = h('div', { class: 'c-splash' }, [h('div', { class: 'c-spl-art', role: 'img', 'aria-label': SPLASH_LABEL }, [term, logo]), skip]);
    document.body.appendChild(el);
    var timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function showLogo() { term.hidden = true; logo.hidden = false; }
    var HOLD = 3500;   // the full KEPT + tagline screen stays this long, so it can be read on a phone
    // Reduced motion: the finished screen at once, held, then a plain cut (no fade, no per-letter typing).
    if (reduceMotion()) { kept.textContent = 'KEPT'; tagrow.classList.add('on'); showLogo(); later(end, HOLD); }
    else {
      var t = 300;
      script.forEach(function (s) {
        var typed = h('span', {});
        var line = h('div', { class: 'c-spl-line' }, [h('span', { class: 'c-spl-p', text: '> ' }), typed]);
        later(function () { term.appendChild(line); line.appendChild(cursor); }, t);
        for (var i = 1; i <= s.cmd.length; i++) {
          t += 40 + Math.round(Math.random() * 32);   // slight human-like variation
          later(typeTo(typed, s.cmd.slice(0, i)), t);
        }
        t += 140;
        if (s.out) { later(outLine(s.out), t); t += 260; }
      });
      // After "clear": the cursor blinks alone, then K, E, P, T appear one at a time like typed keys,
      // then the tagline fades in, the full screen holds, and everything fades into the map.
      t += 100;
      later(showLogo, t);
      t += 500;
      ['K', 'KE', 'KEP', 'KEPT'].forEach(function (txt, i) { later(typeTo(kept, txt), t + i * 300); });
      t += 3 * 300 + 300;
      later(function () { tagrow.classList.add('on'); }, t);
      t += HOLD;
      later(function () { el.classList.add('c-spl-fade'); }, t);
      later(end, t + 300);
    }
    function typeTo(node, text) { return function () { node.textContent = text; }; }
    function outLine(text) { return function () { term.appendChild(h('div', { class: 'c-spl-out', text: text })); }; }
    function end(e) {
      timers.forEach(clearTimeout); timers = [];
      // The tap or key that skips the splash must not also act on the map underneath.
      if (e && e.type === 'keydown') e.preventDefault();
      if (e && e.type === 'pointerdown') {
        var swallow = function (ev) { ev.preventDefault(); ev.stopPropagation(); document.removeEventListener('click', swallow, true); };
        document.addEventListener('click', swallow, true);
        // Only the click from this same tap: it fires right after pointerup, so stop swallowing just after that.
        var release = function () { document.removeEventListener('pointerup', release, true); setTimeout(function () { document.removeEventListener('click', swallow, true); }, 0); };
        document.addEventListener('pointerup', release, true);
      }
      ['pointerdown', 'keydown'].forEach(function (t) { document.removeEventListener(t, end, true); });
      el.remove();
    }
    // Any click, tap or key (including the skip button) ends it. Focus never moves into the splash.
    ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, end, true); });
  }

  /* ---------- direct case links: #case/<case-id> ---------- */
  // The id is checked against the known case ids from the level data (exact match) before anything loads.
  // Anything else, malformed or unknown, is ignored: no fetch, and the id is never written to the page.
  function caseFromHash() {
    var h = location.hash || '';
    if (h.indexOf('#case/') !== 0) return null;
    var id = h.slice(6), known = {};
    LEVELS.forEach(function (L) { if (L.status === 'ready' && L.case) known[caseIdOf(L)] = L; });
    var L = Object.prototype.hasOwnProperty.call(known, id) ? known[id] : null;
    if (!L) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ } }
    return L;
  }
  function boot() {
    var L = caseFromHash();
    if (L) { openLevel(L); return; }
    renderMap();
    splash();
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
    renderMap: renderMap,
    renderAbout: renderAbout,
    sound: sound,
    soundToggle: soundToggle
  };

  /* ---------- boot (after case.js has loaded too) ---------- */
  document.addEventListener('DOMContentLoaded', boot);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
