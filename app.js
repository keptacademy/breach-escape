/* Breach Escape: app logic. No external requests; progress stays in this browser only. */
(function () {
  'use strict';

  var LEVELS = window.LEVELS || [];
  var STORE_KEY = 'breach-escape-progress-v1';
  var app = document.getElementById('app');
  var timer = null;
  var pathTimer = null;

  /* ---------- progress (local only) ---------- */
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
  function fromMarkup(markup) { var t = document.createElement('template'); t.innerHTML = markup.trim(); return t.content.firstElementChild; }

  /* ---------- Klar ---------- */
  var BLOB = 'M100 30 C 140 30 168 62 168 104 C 168 146 138 176 100 176 C 62 176 32 146 32 104 C 32 62 60 30 100 30 Z';
  var BLOB_ANIM = BLOB + ';M100 26 C 144 32 170 66 166 108 C 162 148 134 178 98 174 C 60 170 30 142 34 100 C 38 60 58 22 100 26 Z;M102 32 C 138 28 172 60 170 102 C 168 144 140 172 102 178 C 64 180 34 150 30 106 C 28 64 64 34 102 32 Z;' + BLOB;
  function liquiInner(p) {
    return '<defs>' +
      '<radialGradient id="' + p + 'body" cx="42%" cy="36%" r="68%"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.6"/><stop offset="0.55" stop-color="#E4F1FB" stop-opacity="0.3"/><stop offset="0.82" stop-color="#B9D8F0" stop-opacity="0.5"/><stop offset="0.95" stop-color="#7FB1DA" stop-opacity="0.78"/><stop offset="1" stop-color="#5E93C4" stop-opacity="0.9"/></radialGradient>' +
      '<radialGradient id="' + p + 'glow" cx="50%" cy="55%" r="50%"><stop data-role="glow" offset="0" stop-color="#CFEFFF" stop-opacity="0.75"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>' +
      '</defs>' +
      '<g class="float"><g data-role="mood" class="m-calm">' +
      '<path d="' + BLOB + '" fill="url(#' + p + 'body)"><animate attributeName="d" dur="6s" repeatCount="indefinite" values="' + BLOB_ANIM + '"/></path>' +
      '<ellipse cx="100" cy="120" rx="52" ry="44" fill="url(#' + p + 'glow)"/>' +
      '<path d="M66 158 Q 100 174 136 154" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.85"/>' +
      '<circle cx="74" cy="140" r="3" fill="none" stroke="#FFFFFF" stroke-width="1.2" opacity="0.9"><animate attributeName="cy" dur="5s" repeatCount="indefinite" values="150;80;150"/></circle>' +
      '<circle cx="128" cy="134" r="2.2" fill="#FFFFFF" opacity="0.85"><animate attributeName="cy" dur="3.6s" repeatCount="indefinite" values="160;90;160"/></circle>' +
      '<g data-role="eyes">' +
      '<g class="blink"><ellipse data-role="eL" cx="85" cy="104" rx="8.5" ry="12.5" fill="#13233A"/><circle data-role="hL" cx="88" cy="99" r="3.6" fill="#FFFFFF"/></g>' +
      '<g class="blink blink2"><ellipse data-role="eR" cx="115" cy="104" rx="8.5" ry="12.5" fill="#13233A"/><circle data-role="hR" cx="118" cy="99" r="3.6" fill="#FFFFFF"/></g>' +
      '</g>' +
      '<g data-role="sweat" opacity="0"><ellipse class="sw1" cx="146" cy="74" rx="3.6" ry="5.4" fill="#DFF2FF" stroke="#7FB1DA" stroke-width="1.2"/><ellipse class="sw2" cx="156" cy="98" rx="3" ry="4.6" fill="#DFF2FF" stroke="#7FB1DA" stroke-width="1.2"/><ellipse class="sw3" cx="48" cy="100" rx="3" ry="4.6" fill="#DFF2FF" stroke="#7FB1DA" stroke-width="1.2"/></g>' +
      '<g data-role="happy" opacity="0"><path d="M76 106 Q 85 94 94 106" fill="none" stroke="#13233A" stroke-width="5" stroke-linecap="round"/><path d="M106 106 Q 115 94 124 106" fill="none" stroke="#13233A" stroke-width="5" stroke-linecap="round"/></g>' +
      '<path d="M58 70 C 64 50 84 38 104 38" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" opacity="0.95"/>' +
      '<circle cx="56" cy="86" r="4" fill="#FFFFFF"/>' +
      '</g></g>';
  }
  var MOODS = {
    calm: { open: 1, rx: 8.5, ry: 12.5, dx: 0, glow: '#CFEFFF' },
    curious: { open: 1, rx: 8, ry: 12, dx: 4, glow: '#DCD6FF' },
    worried: { open: 1, rx: 9.5, ry: 13.5, dx: 2, glow: '#FFE7C2' },
    alarmed: { open: 1, rx: 10.5, ry: 14.5, dx: 0, glow: '#FFCFCB' },
    happy: { open: 0, rx: 8.5, ry: 12.5, dx: 0, glow: '#C9F5D6' }
  };
  function setMood(root, mood) {
    if (!root || root.getAttribute('data-mood') === mood) return;
    var m = MOODS[mood]; root.setAttribute('data-mood', mood);
    var q = function (r) { return root.querySelector('[data-role="' + r + '"]'); };
    q('mood').setAttribute('class', 'm-' + mood);
    q('eyes').setAttribute('opacity', m.open);
    q('happy').setAttribute('opacity', 1 - m.open);
    q('glow').setAttribute('stop-color', m.glow);
    [['eL', 85], ['eR', 115]].forEach(function (e) { var el = q(e[0]); el.setAttribute('cx', e[1] + m.dx); el.setAttribute('rx', m.rx); el.setAttribute('ry', m.ry); });
    q('hL').setAttribute('cx', 88 + m.dx); q('hR').setAttribute('cx', 118 + m.dx);
  }
  function liquiStandalone(label) {
    return fromMarkup('<svg class="liqui" viewBox="0 0 200 200" role="img" aria-label="' + label + '">' + liquiInner('lq') + '</svg>');
  }

  /* ---------- glossary: tap a term, Klar defines it ---------- */
  var GLOSSARY = window.GLOSSARY || {};
  var TERMS = Object.keys(GLOSSARY).sort(function (a, b) { return b.length - a.length; });
  var termRe = TERMS.length ? new RegExp('(^|[^A-Za-z0-9_])(' + TERMS.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?![A-Za-z0-9_])', 'gi') : null;
  var termIndex = {}; TERMS.forEach(function (t) { termIndex[t.toLowerCase()] = t; });
  var currentBubble = null;   // whichever Klar bubble is on screen
  var termTimer = null;
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
      el.appendChild(h('span', { class: 'term', role: 'button', tabindex: '0', 'aria-label': 'Define ' + m[2],
        onclick: termClick(termIndex[key]), onkeydown: termKey(termIndex[key]) }, [m[2]]));
      last = start + m[2].length;
    }
    el.appendChild(document.createTextNode(text.slice(last)));
    return el;
  }
  function termClick(term) { return function (e) { e.preventDefault(); e.stopPropagation(); defineTerm(term); }; }
  function termKey(term) { return function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); defineTerm(term); } }; }
  // The definition is pinned on the bubble (bubble._term) until it times out or the bubble is tapped;
  // the play-screen timer's update() respects the pin instead of repainting over it.
  var termSink = null;   // v2 case screens show definitions in their own panel instead of Klar's bubble
  function defineTerm(term) {
    if (termSink && GLOSSARY[term]) return termSink(term, GLOSSARY[term]);
    if (!currentBubble || !GLOSSARY[term]) return;
    if (termTimer) clearTimeout(termTimer);
    var b = currentBubble;
    if (!b._term) b._before = b._say.textContent;
    b._term = term + ': ' + GLOSSARY[term];
    b._say.textContent = b._term;
    b.classList.add('defining');
    b._who.textContent = 'Klar explains';
    termTimer = setTimeout(function () { endDefine(b); }, 12000);
  }
  function endDefine(b) {
    if (!b || !b._term) return;
    if (termTimer) { clearTimeout(termTimer); termTimer = null; }
    b._term = null;
    b.classList.remove('defining');
    b._who.textContent = 'Klar';
    if (b._before != null) b._say.textContent = b._before;
    b._before = null;
    if (S && app.classList.contains('screen-play') && P.bubble === b) update();
  }

  /* ---------- shared pieces ---------- */
  var TAG_SCHOOL = 'Know \u00b7 Explore \u00b7 Practice \u00b7 Test';
  var TAG_SECURITY = 'Know the Exposure, Patch the Threat';
  function topbar(right) {
    var onMap = app.classList.contains('screen-map');
    return h('div', { class: 'topbar' }, [
      h('div', {}, [
        h('div', { class: 'eyebrow kept', text: 'KEPT ACADEMY' }),
        h('div', { class: 'brand', text: 'Breach Escape' }),
        h('div', { class: 'tagline', text: onMap ? TAG_SCHOOL : TAG_SECURITY })
      ]),
      right
    ]);
  }
  function bubble(text) {
    var say = h('span', { class: 'say', text: text });
    var who = h('span', { class: 'who', text: 'Klar' });
    var b = h('div', { class: 'bubble glass-btn' }, [who, say]);
    b._say = say; b._who = who; currentBubble = b;
    b.addEventListener('click', function () { if (b._term) endDefine(b); });
    return b;
  }
  function starsFor(firstTry) { return firstTry >= 5 ? 3 : firstTry >= 3 ? 2 : 1; }
  function starText(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
    if (pathTimer) { clearTimeout(pathTimer); pathTimer = null; }
    pathState = null;
    window.removeEventListener('resize', onPathResize);
    stopLooking();
    termSink = null;
    var hooks = leaveHooks; leaveHooks = [];
    hooks.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }
  var leaveHooks = [];   // cleanups registered by other screens (case.js), run on every screen change

  // Level 1+ can be a v2 case (Investigate -> Defend), loaded from JSON by case.js. Falls back to the classic quiz.
  function openLevel(L) {
    if (L.case && window.BreachCase) window.BreachCase.start(L);
    else startIntro(L.id);
  }

  /* ---------- screen: Breach Map ---------- */
  function renderMap() {
    stopTimer(); app.textContent = ''; app.className = 'app screen-map';
    var done = Object.keys(progress.levels || {}).length;
    var totalStars = Object.keys(progress.levels || {}).reduce(function (a, k) { return a + (progress.levels[k].stars || 0); }, 0);
    app.appendChild(topbar(h('span', { class: 'pill glass', text: totalStars + ' ★' })));

    var lq = liquiStandalone('Klar, a floating drop of liquid glass');
    setMood(lq, 'calm');
    var readyLevels = LEVELS.filter(function (L) { return L.status === 'ready'; });
    var total = LEVELS.length;
    // The level to point at: first playable one not yet cleared, else the last playable one
    var next = readyLevels.filter(function (L) { return !(progress.levels || {})[L.id]; })[0] || readyLevels[readyLevels.length - 1];
    var line = done === 0 ? 'Hi, I’m Klar. Every level here is a real breach. Want to see how it happened, and stop it?'
      : done >= readyLevels.length ? 'All ' + done + ' live breaches cleared. New ones are on the way, and you can always replay for a better score.'
      : 'Welcome back! ' + done + ' breach' + (done > 1 ? 'es' : '') + ' replayed so far. Ready for the next one?';
    var heroBody = h('div', { class: 'hero-body' }, [bubble(line)]);
    if (next) {
      var nextRec = (progress.levels || {})[next.id];
      heroBody.appendChild(h('button', { class: 'next-card glass-btn', onclick: function () { openLevel(next); } }, [
        h('span', { class: 'next-kicker', text: nextRec ? 'Replay' : done === 0 ? 'Start here' : 'Up next' }),
        h('span', { class: 'next-name', text: 'Level ' + next.id + ' · ' + next.name }),
        h('span', { class: 'next-sub', text: next.victim + ' · ' + next.year + ' · ' + next.teaser }),
        h('span', { class: 'next-go', text: (nextRec ? 'Play again' : 'Play') + ' \u203a' })
      ]));
    }
    app.appendChild(h('div', { class: 'hero glass' }, [lq, heroBody]));

    var pct = Math.round(done / total * 100);
    app.appendChild(h('div', { class: 'season-head' }, [
      h('div', { class: 'section-title', text: 'Season 1 · Real breaches, replayed' }),
      h('div', { class: 'season-progress', role: 'progressbar', 'aria-label': 'Season progress', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(done) }, [
        h('span', { class: 'season-count', text: done + ' / ' + total + ' cleared' }),
        h('span', { class: 'season-bar' }, [h('span', { class: 'season-fill' })])
      ])
    ]));
    var fill = app.querySelector('.season-fill'); if (fill) fill.style.width = pct + '%';

    var list = h('div', { class: 'levels' });
    LEVELS.forEach(function (L) {
      var rec = (progress.levels || {})[L.id];
      var ready = L.status === 'ready';
      var isNext = next && L.id === next.id && !rec;
      var right = rec ? h('span', { class: 'right stars', text: starText(rec.stars) }) : h('span', { class: 'right' + (ready ? ' play' : ''), text: ready ? 'Play' : 'Soon' });
      list.appendChild(h('button', {
        class: 'level glass-btn' + (isNext ? ' next' : '') + (ready ? '' : ' locked'), disabled: !ready,
        'aria-label': 'Level ' + L.id + ': ' + L.name + ', ' + L.victim + ' ' + L.year + (ready ? '' : ', coming soon') + (rec ? ', ' + rec.stars + ' stars' : '') + (isNext ? ', up next' : ''),
        onclick: ready ? function () { openLevel(L); } : null
      }, [
        h('span', { class: 'num' + (rec ? ' done' : ''), text: rec ? '✓' : String(L.id) }),
        h('span', { class: 'meta' }, [
          h('span', { class: 'name', text: L.name }),
          h('span', { class: 'sub', text: L.victim + ' · ' + L.year }),
          h('span', { class: 'teaser', text: L.teaser })
        ]),
        right
      ]));
    });
    app.appendChild(list);
    var lock = fromMarkup('<svg class="lock" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>');
    app.appendChild(h('p', { class: 'facts privacy' }, [lock, 'Your progress is saved only on this device. No account, no tracking.']));
  }

  /* ---------- level state ---------- */
  var S = null;
  function level() { return LEVELS.filter(function (l) { return l.id === S.levelId; })[0]; }

  function stepIcon(d) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '220 106 56 56'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'step-icon');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '4'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path); return svg;
  }

  /* ---------- Klar guides you along the attack path (intro screen) ---------- */
  var pathState = null;
  function placeGuide(animate) {
    if (!pathState) return;
    var ps = pathState, step = ps.steps[ps.at], g = ps.guide;
    var wide = window.matchMedia('(min-width: 900px)').matches;
    var size = g.offsetWidth || 56;
    var x = wide ? step.offsetLeft + step.offsetWidth / 2 - size / 2 : step.offsetLeft + step.offsetWidth - size - 10;
    var y = wide ? step.offsetTop - size + 8 : step.offsetTop + step.offsetHeight / 2 - size / 2;
    var to = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    if (animate && g.animate && !reduceMotion()) {
      g.animate([{ transform: g.style.transform || to }, { transform: to }], { duration: 650, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' });
    }
    g.style.transform = to;
    ps.steps.forEach(function (s, n) {
      s.classList.toggle('lit', n === ps.at); s.classList.toggle('seen', n < ps.at);
      s.setAttribute('aria-pressed', n === ps.at ? 'true' : 'false');
    });
    if (ps.onStep) ps.onStep(ps.at);
  }
  function pickStep(n) {
    if (!pathState) return;
    if (pathTimer) { clearTimeout(pathTimer); pathTimer = null; }
    pathState.manual = true;
    pathState.at = n;
    placeGuide(true);
  }
  function onPathResize() { placeGuide(false); }
  function reduceMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function runGuide() {
    if (!pathState) return;
    placeGuide(true);
    var last = pathState.at === pathState.steps.length - 1;
    pathTimer = setTimeout(function () {
      if (!pathState || pathState.manual || !document.body.contains(pathState.guide)) return;
      pathState.at = last ? 0 : pathState.at + 1;
      runGuide();
    }, last ? 2600 : 1700);
  }
  function startGuide(pathEl, steps, guideEl, onStep) {
    pathState = { path: pathEl, steps: steps, guide: guideEl, onStep: onStep, at: 0, manual: false };
    window.addEventListener('resize', onPathResize);
    requestAnimationFrame(function () {
      placeGuide(false);
      if (!reduceMotion()) pathTimer = setTimeout(function () { if (pathState && !pathState.manual) { pathState.at = 1; runGuide(); } }, 2500);
    });
  }

  function startIntro(id) {
    S = { levelId: id, i: 0, picked: null, wrongs: [], heat: 30, score: 0, firstTry: 0, lost: false, streak: 0, hinted: false, hintsUsed: 0 };
    stopTimer(); app.textContent = ''; app.className = 'app screen-intro';
    var L = level();
    var rec = (progress.levels || {})[L.id];
    app.appendChild(topbar(h('button', { class: 'icon-btn glass-btn', text: '\u2039 Map', onclick: renderMap })));

    var lq = liquiStandalone('Klar'); setMood(lq, 'curious');
    var pvIcon = h('span', { class: 'pv-icon' });
    var pvNum = h('span', { class: 'pv-num' });
    var pvName = h('span', { class: 'pv-name' });
    var pvTech = h('span', { class: 'pv-tech' });
    var preview = h('div', { class: 'step-preview', 'aria-hidden': 'true' }, [
      h('span', { class: 'pv-tile' }, [pvIcon, h('span', { class: 'pv-status', text: 'Under attack' })]),
      h('span', { class: 'pv-meta' }, [pvNum, pvName, pvTech])
    ]);
    var hero = h('div', { class: 'hero intro-hero glass' }, [lq, bubble('Ready? We replay it step by step. Choose fast, it spreads while you think.'), preview]);

    var chips = h('div', { class: 'chips' }, [
      h('span', { class: 'chip', text: L.stages.length + ' alerts' }),
      h('span', { class: 'chip', text: '~5 min' }),
      h('span', { class: 'chip', text: '4 choices each' }),
      rec ? h('span', { class: 'chip chip-star', text: 'Best: ' + starText(rec.stars) }) : null
    ]);

    var steps = h('ol', { class: 'path', 'aria-label': 'The attack path you will replay. Choose a step to see what happened.' });
    var stepEls = [];
    L.stages.forEach(function (st, n) {
      stepEls[n] = h('button', { class: 'path-step glass-btn', 'aria-pressed': 'false', 'aria-controls': 'path-detail',
        'aria-label': 'Step ' + (n + 1) + ': ' + st.tile, onclick: function () { pickStep(n); } }, [
        h('span', { class: 'path-num', text: String(n + 1) }),
        stepIcon(st.icon),
        h('span', { class: 'path-name', text: st.tile })
      ]);
      steps.appendChild(h('li', { class: 'path-item' }, [stepEls[n]]));
    });
    var guide = fromMarkup('<svg class="path-guide" viewBox="0 0 200 200" aria-hidden="true">' + liquiInner('pg') + '</svg>');
    setMood(guide, 'curious');
    steps.appendChild(guide);

    // Step detail panel: what happened, the ATT&CK technique, and what defenders could watch for
    var dTitle = h('div', { class: 'pd-title' }), dTech = h('span', { class: 'pd-tech' });
    var dHappened = h('p', { class: 'pd-text' }), dWatch = h('p', { class: 'pd-text' });
    var dHint = h('div', { class: 'pd-hint', text: 'Tap any step to explore it.' });
    var detail = h('div', { class: 'path-detail glass-btn', id: 'path-detail', 'aria-live': 'polite' }, [
      h('div', { class: 'pd-head' }, [dTitle, dTech]),
      h('div', { class: 'pd-label', text: 'What happened' }), dHappened,
      h('div', { class: 'pd-label', text: 'What defenders could watch for' }), dWatch,
      dHint
    ]);
    var heroSay = hero.querySelector('.say'); currentBubble = hero.querySelector('.bubble');
    function onStep(n) {
      var st = L.stages[n], m = st.mitre || {};
      pvIcon.textContent = ''; pvIcon.appendChild(stepIcon(st.icon));
      pvNum.textContent = 'Step ' + (n + 1) + ' of ' + L.stages.length;
      pvName.textContent = st.tile;
      pvTech.textContent = m.id ? m.id : (m.tactic || '');
      preview.classList.remove('pv-in'); void preview.offsetWidth; preview.classList.add('pv-in');
      dTitle.textContent = 'Step ' + (n + 1) + ' \u00b7 ' + st.title;
      dTech.textContent = m.id ? 'ATT&CK ' + m.id + (m.name ? ' \u00b7 ' + m.name : '') : (m.tactic || '');
      dTech.hidden = !dTech.textContent;
      dHappened.textContent = ''; termify(st.happened || st.scenario, dHappened);
      dWatch.textContent = ''; termify(st.watch || '', dWatch);
      dHint.hidden = pathState && pathState.manual;
      if (pathState && pathState.manual && heroSay) { if (currentBubble && currentBubble._term) currentBubble._before = st.say; else heroSay.textContent = st.say; }
    }

    var src = h('p', { class: 'facts' }, ['Based on: ']);
    L.sources.forEach(function (s, n) {
      if (n) src.appendChild(document.createTextNode('; '));
      src.appendChild(h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title }));
    });

    var brief = h('div', { class: 'brief' }, [
      h('div', { class: 'intro' }, [
        h('span', { class: 'kicker', text: 'Level ' + L.id + ' \u00b7 ' + L.name + ' \u00b7 ' + L.victim + ' ' + L.year }),
        h('h1', { text: 'Keep the grid clear.' }),
        h('p', { text: L.intro })
      ]),
      chips,
      h('div', { class: 'section-title', text: 'The attack path' }),
      steps,
      detail,
      h('button', { class: 'primary', text: 'Begin', onclick: function () { renderPlay(); } }),
      src
    ]);
    app.appendChild(h('div', { class: 'intro-grid' }, [hero, brief]));
    startGuide(steps, stepEls, guide, onStep);
  }

  /* ---------- screen: play ---------- */
  var P = {}; // live element refs for the play screen

  function stageMarkup() {
    return '<svg class="stage" viewBox="0 0 354 280" role="img" aria-label="Attack scene">' +
      '<defs>' +
      '<radialGradient id="stDrop" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="0.7" stop-color="#D6EAF8" stop-opacity="0.5"/><stop offset="1" stop-color="#6E9FCC" stop-opacity="0.85"/></radialGradient>' +
      '<radialGradient id="stHalo" cx="50%" cy="50%" r="50%"><stop data-role="haloStop" offset="0" stop-color="#FF453A" stop-opacity="0.45"/><stop data-role="haloStop2" offset="1" stop-color="#FF453A" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="stTile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0.55"/></linearGradient>' +
      '<filter id="stBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>' +
      '<filter id="stShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#1E2846" flood-opacity="0.14"/></filter>' +
      '</defs>' +
      '<ellipse data-role="halo" cx="248" cy="134" rx="60" ry="60" fill="url(#stHalo)"/>' +
      '<g data-role="ripples"><circle class="rp1" cx="248" cy="134" r="52" fill="none" stroke="#FF453A" stroke-width="1.5"/><circle class="rp2" cx="248" cy="134" r="52" fill="none" stroke="#FF453A" stroke-width="1.5"/></g>' +
      '<g class="hover">' +
      '<rect x="204" y="90" width="88" height="88" rx="24" fill="url(#stTile)" stroke="#FFFFFF" stroke-width="1.5" filter="url(#stShadow)"/>' +
      '<rect data-role="tint" x="204" y="90" width="88" height="88" rx="24" fill="#FF453A" opacity="0"/>' +
      '<rect x="216" y="97" width="44" height="7" rx="3.5" fill="#FFFFFF" opacity="0.9"/>' +
      '<path data-role="icon" d="" fill="none" stroke="#0A84FF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<g data-role="badge" opacity="0"><g class="pop"><circle cx="286" cy="96" r="14" fill="#30D158" stroke="#FFFFFF" stroke-width="3"/><path d="M279 96 l5 5 l9 -10" fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></g></g>' +
      '</g>' +
      '<text data-role="tileName" x="248" y="210" text-anchor="middle" font-family="-apple-system, Segoe UI, Inter, sans-serif" font-weight="600" font-size="11" fill="#3A3A3C"></text>' +
      '<text data-role="tileStatus" x="248" y="226" text-anchor="middle" font-family="-apple-system, Segoe UI, Inter, sans-serif" font-weight="600" font-size="10" fill="#D70015"></text>' +
      '<g data-role="beam" opacity="0"><circle class="bm1" cx="108" cy="160" r="6" fill="url(#stDrop)"/><circle class="bm2" cx="108" cy="160" r="5" fill="url(#stDrop)"/><circle class="bm3" cx="108" cy="160" r="6.5" fill="url(#stDrop)"/></g>' +
      '<ellipse cx="87" cy="252" rx="38" ry="6" fill="#1E2846" opacity="0.16" filter="url(#stBlur)"/>' +
      '<g data-role="liquiWrap" class="klar-wrap">' +
      '<svg data-role="liqui" x="26" y="116" width="122" height="122" viewBox="0 0 200 200">' + liquiInner('sq') + '</svg>' +
      '<g class="burst" aria-hidden="true">' +
        '<circle class="b-1" cx="87" cy="170" r="5" fill="url(#stDrop)"/><circle class="b-2" cx="87" cy="170" r="4" fill="url(#stDrop)"/>' +
        '<circle class="b-3" cx="87" cy="170" r="5.5" fill="url(#stDrop)"/><circle class="b-4" cx="87" cy="170" r="3.5" fill="url(#stDrop)"/>' +
        '<circle class="b-5" cx="87" cy="170" r="4.5" fill="url(#stDrop)"/><circle class="b-6" cx="87" cy="170" r="3" fill="url(#stDrop)"/>' +
      '</g></g>' +
      '</svg>';
  }

  /* ---------- Klar's voice: varied lines, never the same twice in a row ---------- */
  var LINES = {
    win: ['Splash! First try!', 'Washed clean. Nice call.', 'Boom. That door is shut.', 'Textbook! The {tile} is safe again.', 'Clear as glass. They never saw it coming.', 'You read that one perfectly.', 'Ha! Right where it hurts them.'],
    streak: ['{n} in a row! You’re on a roll.', 'Streak of {n}! Keep it flowing.', '{n} for {n}. The attackers are sweating now.', 'That’s {n} straight. Are you sure you’re a junior?'],
    retry: ['Got it on the rebound!', 'There it is. Second time’s the charm.', 'Nice recovery. Fixed!', 'See? Mistakes are how we learn. Cleared!'],
    wrong: ['Hmm, not that one. Read the note.', 'Close, but they slipped past it.', 'Ouch! That didn’t hold.', 'Nope, still spreading. Look closer.', 'They’re still in. Try another angle.', 'Good thought, wrong step for it.'],
    hot: ['It’s spreading fast!', 'Hurry, hurry, hurry!', 'I’m getting nervous here…', 'Tick tock! Pick one!'],
    nudge: ['Take your time… but not too much.', 'Think: what stops this exact step?', 'Read the question one more time.', 'Which one would really work here?'],
    lost: ['It spread too far. Let’s run it back.', 'Too slow! Deep breath, try again.', 'Whoosh, it got away. One more time!'],
    again: ['Okay, round two!', 'Fresh eyes. Go!', 'Let’s try that again.']
  };
  // Shuffle-bag per kind: every line is used once before any repeats
  var bags = {};
  function line(kind, vars) {
    if (!bags[kind] || !bags[kind].length) {
      bags[kind] = LINES[kind].slice();
      for (var i = bags[kind].length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = bags[kind][i]; bags[kind][i] = bags[kind][j]; bags[kind][j] = tmp; }
    }
    return bags[kind].pop().replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] != null ? vars[k] : ''; });
  }
  // One-shot animation on Klar (restarts if triggered again)
  function fx(name) {
    if (!P.liquiWrap) return;
    P.liquiWrap.classList.remove('fx-celebrate', 'fx-squish');
    void P.liquiWrap.getBoundingClientRect();
    P.liquiWrap.classList.add(name);
  }
  // Klar's eyes follow the pointer while you play
  var lookHandler = null;
  function startLooking() {
    stopLooking();
    lookHandler = function (e) {
      if (!P.liqui || !P.eyes) return;
      var r = P.liqui.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      P.eyes.setAttribute('transform', 'translate(' + (dx / d * 5).toFixed(1) + ' ' + (dy / d * 4).toFixed(1) + ')');
    };
    document.addEventListener('pointermove', lookHandler);
  }
  function stopLooking() { if (lookHandler) { document.removeEventListener('pointermove', lookHandler); lookHandler = null; } }

  // Shuffle the answer choices each time a stage is played (Fisher-Yates, crypto RNG)
  function shuffle(list) {
    var a = list.slice(), r = new Uint32Array(a.length);
    (window.crypto || window.msCrypto).getRandomValues(r);
    for (var i = a.length - 1; i > 0; i--) { var j = r[i] % (i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function renderPlay() {
    stopTimer(); app.textContent = ''; app.className = 'app screen-play';
    var L = level(), st = L.stages[S.i];
    S.opts = shuffle(st.options);
    P.coins = h('span', { class: 'pill glass', text: S.score + ' points' });
    app.appendChild(topbar(P.coins));

    P.alarm = h('span', { class: 'muted', text: 'Alert ' + (S.i + 1) + ' of ' + L.stages.length });
    P.heatLabel = h('span', {});
    P.fill = h('div', { class: 'progress-fill' });
    var bar = h('div', { class: 'progress glass', role: 'progressbar', 'aria-label': 'Breach spread', 'aria-valuemin': '0', 'aria-valuemax': '100' }, [P.fill]);
    P.bar = bar;
    app.appendChild(h('div', {}, [h('div', { class: 'progress-head' }, [P.alarm, P.heatLabel]), bar]));
    P.alarm.style.color = 'var(--muted)';

    var scene = h('div', { class: 'scene glass' });
    P.stage = fromMarkup(stageMarkup());
    scene.appendChild(P.stage);
    P.bubble = bubble(st.say);
    scene.appendChild(P.bubble);
    P.stage.style.setProperty('--heat', '0');
    var grid = h('div', { class: 'play-grid' }, [scene]);
    app.appendChild(grid);
    var q = function (r) { return P.stage.querySelector('[data-role="' + r + '"]'); };
    ['halo', 'haloStop', 'haloStop2', 'ripples', 'tint', 'icon', 'badge', 'tileName', 'tileStatus', 'beam', 'liqui', 'liquiWrap'].forEach(function (r) { P[r] = q(r); });
    P.eyes = P.liqui.querySelector('[data-role="eyes"]');
    P.sweat = P.liqui.querySelector('[data-role="sweat"]');
    // Tap Klar for a hint (costs spread). Keyboard users get the Hint chip under the choices.
    P.liquiWrap.setAttribute('tabindex', '-1');
    P.liquiWrap.addEventListener('click', askHint);
    S.line = st.say; S.hotSaid = false; S.idle = 0;
    startLooking();
    P.icon.setAttribute('d', st.icon);
    P.tileName.textContent = st.tile;
    P.stage.setAttribute('aria-label', 'Klar beside the ' + st.tile + ' tile');

    P.card = h('div', { class: 'card glass' });
    grid.appendChild(P.card);
    renderCard();
    update();

    timer = setInterval(function () {
      var opt = S.picked == null ? null : S.opts[S.picked];
      if (S.lost || (opt && opt.ok)) return;
      S.heat = Math.min(100, S.heat + 1);
      S.idle++;
      if (S.heat >= 100) { S.lost = true; S.picked = null; S.streak = 0; S.line = line('lost'); fx('fx-squish'); renderCard(); }
      else if (S.heat >= 75 && !S.hotSaid) { S.hotSaid = true; S.line = line('hot'); }
      else if (S.idle === 15 && S.picked == null) { S.line = line('nudge'); }
      update();
    }, 1000);
  }

  function renderCard() {
    var L = level(), st = L.stages[S.i];
    var opt = S.picked == null ? null : S.opts[S.picked];
    var ok = !!(opt && opt.ok);
    P.card.textContent = '';
    P.card.appendChild(h('h2', { text: st.title }));
    P.card.appendChild(termify(st.scenario, h('p', {})));
    if (!opt && !S.lost) {
      var opts = h('div', { class: 'options' });
      S.opts.forEach(function (o, j) {
        var wrong = S.wrongs.indexOf(j) >= 0;
        opts.appendChild(h('button', { class: 'opt glass-btn' + (wrong ? ' wrong' : ''), 'aria-keyshortcuts': String(j + 1), onclick: function () { pick(j); } }, [h('span', { class: 'key', text: String(j + 1) }), termify(o.t)]));
      });
      P.card.appendChild(opts);
      if (st.hint) {
        P.hintBtn = h('button', { class: 'hint-btn glass-btn', 'aria-keyshortcuts': 'h', disabled: S.hinted,
          text: S.hinted ? 'Hint used' : 'Ask Klar for a hint \u00b7 +10% spread', onclick: askHint });
        P.card.appendChild(P.hintBtn);
      }
    } else {
      var title = S.lost ? 'It spread' : ok ? (S.wrongs.length === 0 ? 'Cleared · +100' : 'Cleared · +50') : 'Not quite';
      var text = S.lost ? 'Out of time on this alert. Think about which control stops this exact step.' : opt.w;
      P.card.appendChild(h('div', { class: 'result ' + (ok ? 'ok' : 'bad') }, [h('div', { class: 'rt', text: title }), termify(text, h('div', { class: 'rx' }))]));
      P.card.appendChild(h('div', { class: 'spacer' }));
      var label = S.lost ? 'Retry alert' : ok ? (S.i === L.stages.length - 1 ? 'See results' : 'Next alert') : 'Try again';
      var btn = h('button', { class: 'primary', text: label, onclick: next });
      P.card.appendChild(btn);
      btn.focus({ preventScroll: true });
    }
  }

  function askHint() {
    var st = level().stages[S.i];
    if (!S || S.lost || S.picked != null || S.hinted || !st.hint) return;
    S.hinted = true; S.hintsUsed++; S.idle = 0;
    S.heat = Math.min(99, S.heat + 10);
    S.line = 'Psst. ' + st.hint;
    fx('fx-squish');
    if (P.hintBtn) { P.hintBtn.disabled = true; P.hintBtn.textContent = 'Hint used'; }
    update();
  }

  function pick(j) {
    var st = level().stages[S.i], o = S.opts[j];
    if (S.lost) return;
    S.picked = j;
    S.idle = 0;
    if (o.ok) {
      var first = S.wrongs.length === 0;
      S.score += first ? 100 : 50;
      if (first) { S.firstTry++; S.streak = (S.streak || 0) + 1; } else { S.streak = 0; }
      S.line = !first ? line('retry') : S.streak >= 2 ? line('streak', { n: S.streak }) : line('win', { tile: st.tile.toLowerCase() });
      fx('fx-celebrate');
    } else {
      S.wrongs.push(j); S.streak = 0; S.heat = Math.min(100, S.heat + 25);
      if (S.heat >= 100) { S.lost = true; S.picked = null; S.line = line('lost'); } else { S.line = o.k || line('wrong'); }
      fx('fx-squish');
    }
    renderCard(); update();
  }

  function next() {
    var L = level(), st = L.stages[S.i];
    var opt = S.picked == null ? null : S.opts[S.picked];
    if (S.lost) { S.lost = false; S.heat = 30; S.picked = null; S.wrongs = []; S.hotSaid = false; S.idle = 0; S.line = line('again'); renderCard(); update(); return; }
    if (opt && opt.ok) {
      if (S.i === L.stages.length - 1) return renderEnd();
      S.i++; S.picked = null; S.wrongs = []; S.heat = 30; S.hinted = false; return renderPlay();
    }
    S.picked = null; S.idle = 0; S.line = line('again'); renderCard(); update();
  }

  function update() {
    var st = level().stages[S.i];
    var opt = S.picked == null ? null : S.opts[S.picked];
    var ok = !!(opt && opt.ok);
    var k = ok ? 0 : S.heat / 100;
    var color = ok ? 'var(--green)' : S.heat >= 70 ? 'var(--red)' : S.heat >= 45 ? 'var(--amber)' : 'var(--blue)';
    P.heatLabel.textContent = ok ? 'Cleared' : S.heat + '% spread';
    P.heatLabel.style.color = color;
    P.fill.style.width = (ok ? 100 : S.heat) + '%';
    P.fill.style.background = color;
    P.bar.setAttribute('aria-valuenow', String(ok ? 0 : S.heat));
    P.coins.textContent = S.score + ' points';

    var hc = ok ? '#30D158' : '#FF453A';
    P.haloStop.setAttribute('stop-color', hc); P.haloStop2.setAttribute('stop-color', hc);
    var r = ok ? 70 : Math.round(40 + k * 80); P.halo.setAttribute('rx', r); P.halo.setAttribute('ry', r);
    P.ripples.setAttribute('opacity', ok ? 0 : (0.3 + k * 0.7).toFixed(2));
    P.tint.setAttribute('opacity', (k * 0.22).toFixed(2));
    P.icon.setAttribute('stroke', ok ? '#30D158' : S.heat >= 70 ? '#FF453A' : '#0A84FF');
    P.badge.setAttribute('opacity', ok ? 1 : 0);
    P.beam.setAttribute('opacity', ok ? 1 : 0);
    P.tileStatus.textContent = ok ? 'Cleared' : 'Under attack';
    P.tileStatus.setAttribute('fill', ok ? '#248A3D' : '#D70015');

    var mood = ok ? 'happy' : (S.lost || opt || S.heat >= 70) ? 'alarmed' : S.heat >= 45 ? 'worried' : 'curious';
    setMood(P.liqui, mood);
    P.stage.style.setProperty('--heat', k.toFixed(2));
    if (P.sweat) P.sweat.setAttribute('opacity', !ok && S.heat >= 60 ? Math.min(1, (S.heat - 50) / 30).toFixed(2) : 0);
    var say = P.bubble._term || S.line || st.say;
    if (P.bubble._term) P.bubble._before = S.line || st.say;   // remember the latest game line for when the definition ends
    if (P.bubble._say.textContent !== say) P.bubble._say.textContent = say;
  }

  /* ---------- screen: end ---------- */
  function renderEnd() {
    stopTimer(); app.textContent = ''; app.className = 'app screen-end';
    var L = level(), stars = starsFor(S.firstTry);
    progress.levels = progress.levels || {};
    var prev = progress.levels[L.id];
    if (!prev || stars > prev.stars || S.score > (prev.best || 0)) {
      progress.levels[L.id] = { stars: Math.max(stars, prev ? prev.stars : 0), best: Math.max(S.score, prev ? prev.best || 0 : 0) };
      saveProgress(progress);
    }
    var ranks = ['Trainee', 'Trainee', 'Analyst', 'Engineer', 'Lead', 'Guardian'];
    app.appendChild(topbar(h('span', { class: 'pill glass', text: S.score + ' points' })));
    var lq = liquiStandalone('Klar, celebrating'); setMood(lq, 'happy');
    app.appendChild(h('div', { class: 'hero glass' }, [lq, bubble('All clear! You replayed ' + L.name + ' and stopped every step.')]));
    var src = h('p', { class: 'facts' }, ['Facts from: ']);
    L.sources.forEach(function (s, n) {
      if (n) src.appendChild(document.createTextNode('; '));
      src.appendChild(h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title }));
    });
    app.appendChild(h('div', { class: 'card glass' }, [
      h('span', { class: 'eyebrow', text: 'Level ' + L.id + ' complete' }),
      h('h2', { text: starText(stars) + '  ' + ranks[S.firstTry] }),
      h('p', { text: 'You cleared all ' + L.stages.length + ' alerts with ' + S.score + ' points (' + S.firstTry + ' of ' + L.stages.length + ' on the first try' + (S.hintsUsed ? ', ' + S.hintsUsed + ' hint' + (S.hintsUsed > 1 ? 's' : '') : '') + '). ' + L.endNote })
    ]));
    app.appendChild(src);
    app.appendChild(h('div', { class: 'spacer' }));
    app.appendChild(h('button', { class: 'primary', text: 'Back to the Breach Map', onclick: renderMap }));
  }

  /* ---------- keyboard (desktop): 1-4 pick an answer, Enter continues ---------- */
  document.addEventListener('keydown', function (e) {
    if (!S || !app.classList.contains('screen-play') || e.altKey || e.ctrlKey || e.metaKey) return;
    var st = level().stages[S.i];
    var opt = S.picked == null ? null : S.opts[S.picked];
    var n = parseInt(e.key, 10);
    if (!opt && !S.lost && n >= 1 && n <= S.opts.length) { e.preventDefault(); pick(n - 1); }
    if (!opt && !S.lost && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); askHint(); }
  });

  /* ---------- shared API for case.js (the v2 Investigate/Defend engine) ---------- */
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
    leave: stopTimer,
    renderMap: renderMap,
    startClassic: function (id) { startIntro(id); }
  };

  /* ---------- boot ---------- */
  renderMap();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
