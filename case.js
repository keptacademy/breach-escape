/* Breach Escape v2 case engine: Intel briefing -> Act 1 Investigate -> Act 2 Defend -> Results.
   Level content comes from a JSON file (see levels/midnight-blizzard.json), so every breach can reuse this engine.
   CSP-safe: no inline script or style attributes, no innerHTML, text via textContent only, same-origin fetch only. */
(function () {
  'use strict';

  var BE = window.BreachEscape;
  if (!BE) return;
  var h = BE.h, app = BE.app;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var dataCache = {};
  var C = null;   // current case: { L, d }

  /* ---------- small helpers ---------- */
  function svg(paths, size, cls) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size || 12); s.setAttribute('height', size || 12);
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls);
    paths.forEach(function (p) {
      var el = document.createElementNS(SVGNS, p[0]);
      Object.keys(p[1]).forEach(function (k) { el.setAttribute(k, p[1][k]); });
      s.appendChild(el);
    });
    return s;
  }
  var ICON = {
    signin: [['path', { d: 'M4 6h16M4 12h16M4 18h10' }]],
    audit: [['path', { d: 'M4 6h16M4 12h16M4 18h10' }]],
    mail: [['rect', { x: '3', y: '5', width: '18', height: '14' }], ['path', { d: 'M3 7l9 6 9-6' }]],
    alert: [['path', { d: 'M12 3l10 18H2z' }], ['path', { d: 'M12 10v5M12 18v.5' }]],
    check: [['path', { d: 'M5 12l5 5L20 7' }]],
    globe: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18' }]]
  };
  function pad(n, w) { var s = String(Math.max(0, n)); while (s.length < (w || 4)) s = '0' + s; return s; }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function restart(el, cls) { if (!el || BE.reduceMotion()) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  // Text from level JSON: `backticks` mark code (shown in <code>), the rest gets tappable glossary terms.
  // terms=false for text inside buttons (cards, timeline slots), where nested controls are not allowed.
  function rich(text, el, terms) {
    el = el || h('span', {});
    String(text || '').split('`').forEach(function (part, i) {
      if (!part) return;
      if (i % 2) el.appendChild(terms === false ? h('code', { text: part }) : BE.termify(part, h('code', {})));
      else if (terms === false) el.appendChild(document.createTextNode(part));
      else el.appendChild(BE.termify(part, h('span', {})));
    });
    return el;
  }
  function plain(text) { return String(text || '').replace(/`/g, ''); }
  function srcById(id) { return (C.d.sources || []).filter(function (s) { return s.id === id; })[0]; }

  /* ---------- terminal backdrop: code rain + red edge flash ---------- */
  var rain = { cv: null, ctx: null, cols: [], timer: null, red: false };
  var edge = null;
  function sizeRain() {
    if (!rain.cv) return;
    rain.cv.width = window.innerWidth; rain.cv.height = window.innerHeight;
    rain.cols = []; for (var i = 0; i < Math.ceil(rain.cv.width / 16); i++) rain.cols.push(Math.floor(Math.random() * rain.cv.height / 16));
  }
  function tickRain() {
    var c = rain.ctx, cv = rain.cv;
    c.fillStyle = 'rgba(1,6,3,.2)'; c.fillRect(0, 0, cv.width, cv.height);
    c.font = '14px ui-monospace, Menlo, Consolas, monospace';
    rain.cols.forEach(function (y, i) {
      c.fillStyle = rain.red ? '#FF3B4E' : rain.color;
      c.fillText('0123456789abcdef'[Math.floor(Math.random() * 16)], i * 16, y * 16);
      rain.cols[i] = (y * 16 > cv.height && Math.random() > 0.97) ? 0 : y + 1;
    });
  }
  // Case theme: <html data-theme="..."> switches the accent tokens in theme.css. The map and About use the default (green).
  function setTheme(name) {
    var root = document.documentElement;
    if (name && name !== 'green') root.setAttribute('data-theme', name); else root.removeAttribute('data-theme');
    rain.color = getComputedStyle(root).getPropertyValue('--c-rain').trim() || '#39FF7A';
    rain.off = rain.color === 'none';
    if (rain.cv) { rain.cv.hidden = rain.off; if (rain.off) rain.ctx.clearRect(0, 0, rain.cv.width, rain.cv.height); }
  }
  function enterTerminal(theme) {
    setTheme(theme);
    if (!edge) { edge = h('div', { class: 'c-edge', 'aria-hidden': 'true' }); document.body.appendChild(edge); }
    if (!BE.reduceMotion() && !rain.cv) {
      rain.cv = h('canvas', { class: 'c-rain', 'aria-hidden': 'true' });
      rain.ctx = rain.cv.getContext('2d');
      document.body.insertBefore(rain.cv, document.body.firstChild);
      sizeRain(); window.addEventListener('resize', sizeRain);
    }
    if (rain.cv) rain.cv.hidden = rain.off;
    if (rain.cv && !rain.off && !rain.timer) rain.timer = setInterval(tickRain, 110);
  }
  // Runs on every screen change; the next screen re-enters right away (every screen uses the terminal backdrop).
  // The canvas stays in the page so the rain does not restart on each page.
  function leaveTerminal() {
    if (rain.timer) { clearInterval(rain.timer); rain.timer = null; }
  }
  function flash() {
    if (!edge || BE.reduceMotion()) return;
    edge.classList.add('on'); setTimeout(function () { edge.classList.remove('on'); }, 450);
  }

  /* ---------- screen frame ---------- */
  var hud = {};
  function frame(label, opts) {
    opts = opts || {};
    BE.leave();                         // runs the previous screen's cleanups
    app.textContent = ''; app.className = 'app case';
    enterTerminal(C.d && C.d.theme);
    BE.onLeave(leaveTerminal);
    BE.onLeave(endDrag);
    hud.act = h('span', { class: 'c-act', text: label });
    // During the briefing there is no score yet: show a BRIEFING tag instead of the XP badge.
    hud.xp = opts.briefing ? null : h('span', { class: 'c-xp', text: 'XP ' + pad(C.xp) });
    app.appendChild(h('div', { class: 'c-hud' }, [
      h('button', { class: 'c-ghost c-exit', onclick: BE.renderMap }, ['\u2039 exit to map']),
      hud.act, hud.xp || h('span', { class: 'c-tagb', text: 'BRIEFING' })
    ]));
    // Glossary taps on this screen show their definition in a terminal panel.
    defBox = h('div', { class: 'c-def', role: 'status', hidden: true, onclick: function () { defBox.hidden = true; } });
    BE.setTermSink(function (term, text) {
      defBox.textContent = '';
      defBox.appendChild(h('span', { class: 'c-def-k', text: '> man ' + term.toLowerCase().replace(/\s+/g, '-') }));
      defBox.appendChild(h('span', { text: text }));
      defBox.appendChild(h('span', { class: 'c-small', text: 'tap to close' }));
      defBox.hidden = false;
      if (defTimer) clearTimeout(defTimer);
      defTimer = setTimeout(function () { if (defBox) defBox.hidden = true; }, 12000);
    });
    BE.onLeave(function () { if (defTimer) clearTimeout(defTimer); defTimer = null; });
    window.scrollTo(0, 0);
  }
  var defBox = null, defTimer = null;
  function addXP(n) { C.xp = Math.max(0, C.xp + n); if (hud.xp) hud.xp.textContent = 'XP ' + pad(C.xp); }
  function panel(cls, kids) { return h('div', { class: 'c-panel' + (cls ? ' ' + cls : '') }, kids); }
  function eyebrow(t, cls) { return h('div', { class: 'c-eyebrow' + (cls ? ' ' + cls : ''), text: t }); }
  function para(t, cls) { return rich(t, h('p', { class: cls || '' })); }

  /* ---------- SOC LEAD voice ----------
     Short in-world lines on meaningful events, shown in the Act 1 toast, the Act 2 log or the results card (all aria-live polite).
     Lines: level JSON "voice" over the shared window.VOICE. The same line never shows twice in a row. Toggle saved in localStorage. */
  var VOICE_KEY = 'breach-escape-voice';
  var lastVoice = null;
  function voiceOn() { try { return localStorage.getItem(VOICE_KEY) !== 'off'; } catch (e) { return true; } }
  function voiceLine(key) {
    if (!voiceOn() || key === lastVoice) return null;
    var t = (C && C.d && C.d.voice && C.d.voice[key]) || (window.VOICE || {})[key];
    if (!t) return null;
    lastVoice = key;
    return 'SOC LEAD > ' + t;
  }
  function voiceToggle() {
    var b = h('button', { class: 'c-ghost c-voicebtn', 'aria-pressed': String(voiceOn()) });
    function paint() { b.textContent = 'voice: ' + (voiceOn() ? 'on' : 'off'); b.setAttribute('aria-pressed', String(voiceOn())); }
    b.addEventListener('click', function () {
      try { localStorage.setItem(VOICE_KEY, voiceOn() ? 'off' : 'on'); } catch (e) { /* storage unavailable */ }
      paint();
    });
    paint();
    return b;
  }

  /* ---------- load + start ---------- */
  function start(L) {
    C = { L: L, d: null, xp: 0 }; lastVoice = null;
    frame('LOADING');
    app.appendChild(panel('', [h('p', {}, ['> fetching case file', h('span', { class: 'c-blink', text: '_' })])]));
    var url = L.case;
    var p = dataCache[url] ? Promise.resolve(dataCache[url]) : fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
    p.then(function (d) {
      if (!C || C.L !== L) return;
      dataCache[url] = d; C.d = d;
      renderBrief(0);
    }).catch(function () {
      if (!C || C.L !== L) return;
      app.appendChild(panel('danger', [
        eyebrow('Error'),
        h('p', { text: 'Could not open the case file. Check your connection and try again.' }),
        h('button', { class: 'c-btn', text: '> RETRY', onclick: function () { start(L); } }),
        h('button', { class: 'c-ghost c-wide', text: '\u2039 back to the Breach Map', onclick: BE.renderMap })
      ]));
    });
  }

  function caseRec() {
    var p = BE.progress();
    p.cases = p.cases || {};
    p.cases[C.d.id] = p.cases[C.d.id] || {};
    return p.cases[C.d.id];
  }

  /* ---------- Intel briefing ---------- */
  function renderBrief(page) {
    var pages = C.d.briefing.pages;
    frame('INTEL', { briefing: true });
    app.classList.add('c-briefscreen');
    var dots = h('div', { class: 'c-dots', role: 'progressbar', 'aria-label': 'Briefing page', 'aria-valuemin': '1', 'aria-valuemax': String(pages.length), 'aria-valuenow': String(page + 1) });
    pages.forEach(function (_, i) { dots.appendChild(h('i', { class: i <= page ? 'on' : '' })); });
    app.appendChild(h('div', { class: 'c-hud' }, [dots, h('button', { class: 'c-ghost c-skip', text: 'skip intel ›', onclick: finishBrief })]));
    var body = h('div', { class: 'c-stack' });
    pages[page].blocks.forEach(function (b) { body.appendChild(block(b)); });
    app.appendChild(body);
    app.appendChild(defBox);

    // Pinned footer: back, a small sources toggle, NEXT.
    var last = page === pages.length - 1;
    var back = h('button', { class: 'c-ghost', text: '‹ back', onclick: function () { renderBrief(page - 1); } });
    if (!page) { back.disabled = true; back.classList.add('c-invisible'); }
    var srcBox = h('div', { class: 'c-srcbox', id: 'c-sources', hidden: true }, [sourcesLine()]);
    var srcBtn = h('button', { class: 'c-ghost c-srcbtn', 'aria-expanded': 'false', 'aria-controls': 'c-sources', text: 'sources', onclick: function () {
      var open = srcBox.hidden; srcBox.hidden = !open; srcBtn.setAttribute('aria-expanded', String(open));
    } });
    app.appendChild(h('div', { class: 'c-bar c-briefbar' }, [h('div', { class: 'c-bar-in' }, [
      srcBox, back, srcBtn,
      h('button', { class: 'c-btn', text: last ? '> OPEN THE EVIDENCE' : 'NEXT ›', onclick: function () { if (last) finishBrief(); else renderBrief(page + 1); } })
    ])]));
  }
  function finishBrief() {
    caseRec().briefed = true; BE.saveProgress();
    startAct1();
  }
  function tone(el, t) { if (t) el.classList.add('t-' + t); return el; }
  function kvList(kv) {
    var dl = h('dl', { class: 'c-kv' });
    kv.forEach(function (r) {
      dl.appendChild(h('dt', { text: r.k }));
      var dd = tone(rich(r.v, h('dd', {})), r.tone), src = r.source && srcById(r.source);
      if (src) dd.appendChild(h('a', { class: 'c-small c-cite', href: src.url, target: '_blank', rel: 'noopener noreferrer', text: 'source: ' + src.title }));
      dl.appendChild(dd);
    });
    return dl;
  }
  function block(b) {
    var kids = [];
    switch (b.type) {
      case 'alert':
        kids.push(h('div', { class: 'c-classbar' }, b.bar.map(function (t) { return h('span', { text: t }); })));
        kids.push(eyebrow(b.eyebrow));
        kids.push(h('h1', { class: 'c-display', text: b.title || C.d.briefing.opening }));
        kids.push(para(b.text));
        // The threat actor row comes from briefing.threatActor and goes right after the first row (Victim).
        var kv = (b.kv || []).slice(), ta = C.d.briefing.threatActor;
        if (ta) kv.splice(Math.min(1, kv.length), 0, { k: 'Threat actor', v: ta.v, source: ta.source });
        if (kv.length) kids.push(kvList(kv));
        return panel('danger', kids);
      case 'note':
        return para(b.text, 'c-small');
      case 'panel':
        kids.push(eyebrow(b.eyebrow));
        if (b.title) kids.push(h('h2', { class: 'c-h2', text: b.title }));
        if (b.kv) kids.push(kvList(b.kv));
        if (b.text) kids.push(para(b.text));
        return panel('', kids);
      case 'facts':
        kids.push(eyebrow(b.eyebrow));
        b.items.forEach(function (segs) {
          var line = h('span', {});
          segs.forEach(function (s) { line.appendChild(s.tone ? tone(rich(s.t, h('b', {}), false), s.tone) : rich(s.t, null, false)); });
          kids.push(h('div', { class: 'c-fact' }, [svg(ICON.check, 16, 'c-ok'), line]));
        });
        return panel('', kids);
      case 'timeline':
        kids.push(eyebrow(b.eyebrow));
        var tl = h('div', { class: 'c-tl' });
        b.items.forEach(function (it) { tl.appendChild(tone(h('div', {}, [h('b', { text: it.d }), it.t]), it.tone)); });
        kids.push(tl);
        return panel('', kids);
      case 'diagram':
        kids.push(eyebrow(b.eyebrow));
        if (b.text) kids.push(para(b.text));
        b.flow.forEach(function (f) {
          if (f.arrow) kids.push(h('div', { class: 'c-arrow', text: f.arrow }));
          else if (f.teaser) kids.push(h('div', { class: 'c-teaser', text: f.teaser }));
          else if (f.box) kids.push(tone(h('div', { class: 'c-box' }, [svg(ICON.globe, 16), f.box]), f.tone));
          else if (f.zone) {
            var z = tone(h('div', { class: 'c-zone' }, [h('span', { class: 'c-zt', text: f.zone })]), f.tone);
            f.boxes.forEach(function (t) { z.appendChild(h('div', { class: 'c-box', text: t })); });
            kids.push(z);
          }
        });
        return panel('', kids);
      case 'glossary':
        kids.push(eyebrow(b.eyebrow));
        b.terms.forEach(function (t) {
          var code = t.charAt(0) === '`', key = plain(t);
          var def = BE.glossary[key] || BE.glossary[Object.keys(BE.glossary).filter(function (k) { return k.toLowerCase() === key.toLowerCase(); })[0]];
          if (def) kids.push(h('div', { class: 'c-term' }, [code ? h('code', { class: 'c-h3', text: key }) : h('span', { class: 'c-h3', text: cap(key) }), h('p', { text: def })]));
        });
        return panel('', kids);
      case 'mission':
        kids.push(eyebrow(b.eyebrow));
        b.items.forEach(function (it) { kids.push(h('p', {}, [h('b', { class: 't-g', text: it.b }), ' ' + it.t])); });
        if (b.small) kids.push(h('p', { class: 'c-small', text: b.small }));
        return panel('hl', kids);
    }
    return h('div', {});
  }
  function sourcesLine() {
    var p = h('p', { class: 'c-small c-src' }, ['Sources: ']);
    (C.d.sources || []).forEach(function (s, n) {
      if (n) p.appendChild(document.createTextNode(' \u00b7 '));
      p.appendChild(h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title }));
    });
    return p;
  }

  /* ---------- Act 1: Investigate ---------- */
  var A = null, E = {};   // Act 1 state and element refs
  function startAct1() {
    var cards = BE.shuffle(C.d.evidence).map(function (e) { return { e: e, done: false }; });
    A = { cards: cards, next: 1, sel: null, placed: [], phase: 'order', mistakes: 0, hints: 0, hinted: {}, startedAt: Date.now(), xp0: C.xp, collapsed: null };
    renderAct1();
  }
  function total() { return C.d.evidence.filter(function (e) { return e.order; }).length; }

  function renderAct1() {
    var a1 = C.d.act1, rec = caseRec();
    frame('ACT 1');
    app.classList.add('c-a1screen', 'c-fit');   // desktop: one screen, no page scroll
    if (A.collapsed == null) A.collapsed = window.matchMedia('(max-width: 899px)').matches;

    // Compact intro: title, one line, and a "?" button for the full instructions.
    E.title = h('h2', { class: 'c-h2', text: a1.title });
    E.line = para(a1.short || a1.help, 'c-line');
    E.helpBox = h('div', { class: 'c-helpbox', id: 'c-help', hidden: true }, [
      para(a1.help),
      h('p', { class: 'c-small', text: 'Keys: A add to timeline \u00b7 X not related \u00b7 H hint. Tap a dotted word to see what it means.' }),
      voiceToggle()
    ]);
    E.helpBtn = h('button', { class: 'c-ghost c-helpbtn', 'aria-label': 'How to play', 'aria-expanded': 'false', 'aria-controls': 'c-help', text: '?', onclick: function () {
      var open = E.helpBox.hidden; E.helpBox.hidden = !open; E.helpBtn.setAttribute('aria-expanded', String(open));
    } });
    var best = rec.act1 && rec.act1.bestXp != null ? h('span', { class: 'c-small c-best', text: 'best ' + rec.act1.bestXp + ' XP' }) : null;
    var head = panel('c-head', [
      h('div', { class: 'c-headrow' }, [h('div', { class: 'c-headtxt' }, [eyebrow('Act 1 \u00b7 Investigate'), E.title]), best, E.helpBtn]),
      E.line, E.helpBox
    ]);

    // Left: the timeline (collapsible on phones to just the current slot).
    E.count = h('span', {});
    E.fold = h('button', { class: 'c-ghost c-fold', 'aria-controls': 'c-slots', onclick: function () { A.collapsed = !A.collapsed; drawAct1(); } });
    E.slots = h('ol', { class: 'c-slots', id: 'c-slots', 'data-drop': 'timeline', 'aria-label': 'Attack timeline' });
    E.toast = h('div', { class: 'c-toast', role: 'status', 'aria-live': 'polite' });
    var board = h('div', { class: 'c-board' }, [
      h('div', { class: 'c-hud' }, [h('span', {}, ['> timeline ', E.count]), E.fold]),
      E.slots, E.toast, defBox
    ]);

    // Right: the evidence grid scrolls inside its own panel.
    E.left = h('span', {});
    E.grid = h('div', { class: 'c-grid', role: 'group', 'aria-label': 'Evidence cards' });
    E.inspect = h('div', { class: 'c-inspect', hidden: true });
    E.deck = h('div', { class: 'c-deck' }, [
      h('div', { class: 'c-hud' }, [h('span', { text: '> ls ./evidence' }), E.left]),
      h('div', { class: 'c-gridwrap' }, [E.grid]),
      E.inspect
    ]);

    // Bottom bar, pinned: the Not related drop zone plus the actions.
    E.nr = h('button', { class: 'c-ghost c-nr', 'data-drop': 'nr', onclick: function () { dismiss(); } },
      [h('span', { text: '\u2715 not related' }), h('span', { class: 'c-small', text: 'drop red herrings here' })]);
    E.add = h('button', { class: 'c-ghost c-add', 'data-drop': 'timeline', text: '+ add to timeline', onclick: function () { place(); } });
    E.hint = h('button', { class: 'c-ghost c-hintbtn', onclick: askHint });
    E.bar = h('div', { class: 'c-bar', role: 'toolbar', 'aria-label': 'Evidence actions' }, [h('div', { class: 'c-bar-in' }, [E.nr, E.add, E.hint])]);

    E.main = h('div', { class: 'c-a1' }, [board, E.deck]);
    E.done = h('div', { class: 'c-stack c-done', hidden: true });
    app.appendChild(head);
    app.appendChild(E.main);
    app.appendChild(E.done);
    app.appendChild(E.bar);
    drawAct1();
  }

  function drawAct1() {
    // timeline slots
    var folded = A.collapsed && A.phase === 'order';
    E.slots.classList.toggle('c-folded', folded);
    E.fold.hidden = A.phase !== 'order';
    E.fold.textContent = folded ? '\u25be show all' : '\u25b4 current only';
    E.fold.setAttribute('aria-expanded', String(!folded));
    E.count.textContent = A.placed.length + '/' + total();
    E.slots.textContent = '';
    for (var i = 1; i <= total(); i++) {
      var c = A.placed[i - 1], isNext = !c && i === A.next && A.phase === 'order';
      var li = h('li', { class: 'c-slot' + (c ? ' filled' : '') + (isNext ? ' next' : '') });
      li.appendChild(h('span', { class: 'c-n', text: pad(i, 2) }));
      if (c) li.appendChild(rich(c.e.title, h('span', {}), false));
      else if (isNext) li.appendChild(h('span', {}, ['awaiting evidence', h('span', { class: 'c-blink', text: '_' })]));
      else li.appendChild(h('span', { text: '\u2014' }));
      if (c && c.pz) { li.classList.add('pz'); li.appendChild(h('span', { class: 'c-pill r c-tag', text: 'PATIENT ZERO' })); }
      if (c && A.phase === 'pz') {
        var btn = h('button', { class: 'c-slotbtn', 'aria-label': 'Mark step ' + i + ' as patient zero: ' + plain(c.e.title), onclick: pickPZ.bind(null, c) });
        while (li.firstChild) btn.appendChild(li.firstChild);
        li.appendChild(btn); li.classList.add('pickable');
      }
      E.slots.appendChild(li);
    }
    // evidence cards
    E.grid.textContent = '';
    A.cards.forEach(function (c) {
      if (c.done) return;
      var b = h('button', { class: 'c-card' + (A.sel === c ? ' sel' : ''), 'aria-pressed': A.sel === c ? 'true' : 'false' }, [
        h('span', { class: 'c-cardsrc' }, [svg(ICON[c.e.type] || ICON.signin), c.e.src]),
        rich(c.e.title, h('span', {}), false)
      ]);
      c.el = b;
      attachDrag(b, {
        can: function () { return A.phase === 'order'; },
        pick: function () { A.sel = c; },
        click: function () { select(c); },
        targets: function () { return [E.slots, E.add, E.nr]; },
        drop: function (t) {
          A.sel = c;
          var kind = t && t.getAttribute('data-drop');
          if (kind === 'timeline') place();
          else if (kind === 'nr') dismiss();
          else { drawAct1(); restart(c.el, 'c-shake'); }   // dropped nowhere: wobble back, stay selected
        }
      });
      E.grid.appendChild(b);
    });
    var left = A.cards.filter(function (c) { return !c.done; }).length;
    E.left.textContent = left + ' left';
    drawInspect();
    var hk = String(A.next), hasHint = A.phase === 'order' && C.d.act1.hints && C.d.act1.hints[hk];
    E.hint.disabled = !hasHint || !!A.hinted[hk];
    E.hint.textContent = '';
    E.hint.appendChild(h('span', { text: A.hinted[hk] ? 'hint used' : '? hint' }));
    E.hint.appendChild(h('span', { class: 'c-small', text: 'step ' + pad(A.next, 2) + (A.hinted[hk] ? '' : ' \u00b7 ' + C.d.act1.scoring.hint + ' XP') }));
    E.bar.hidden = A.phase !== 'order';
    E.main.classList.toggle('c-solo', A.phase !== 'order');
  }
  function drawInspect() {
    var c = A.sel;
    E.inspect.textContent = '';
    E.inspect.hidden = !c;
    if (!c) return;
    E.inspect.appendChild(h('div', { class: 'c-hud' }, [h('span', { text: '> cat ' + c.e.id.toLowerCase() + '.log' }),
      c.e.illustrative ? h('span', { class: 'c-pill o', text: 'recreated for training' }) : null]));
    var pre = h('div', { class: 'c-rows' });
    (c.e.rows || []).forEach(function (r) { pre.appendChild(h('div', { text: r })); });
    E.inspect.appendChild(pre);
  }
  function select(c) { A.sel = A.sel === c ? null : c; drawAct1(); if (A.sel && A.sel.el) A.sel.el.focus({ preventScroll: true }); }
  function toast(msg, ok, voiceKey) {
    E.toast.textContent = '';
    E.toast.appendChild(h('span', { text: msg }));
    var v = voiceKey && voiceLine(voiceKey);
    if (v) E.toast.appendChild(h('span', { class: 'c-voice', text: v }));
    E.toast.className = 'c-toast ' + (ok ? 'ok' : 'bad') + (v ? ' has-voice' : '');
  }
  function wrong(msg, el) {
    var s = C.d.act1.scoring;
    A.mistakes++; addXP(s.wrong);
    toast(s.wrong + ' \u00b7 ' + msg, false, 'wrong'); flash();
    restart(el || E.slots, 'c-shake');
  }
  function needSel() { if (!A.sel) { toast('Select an evidence card first', false); return true; } return false; }

  function place() {
    if (A.phase !== 'order' || needSel()) return;
    var c = A.sel, s = C.d.act1.scoring, w = C.d.act1.wrongLines;
    if (c.e.order === A.next) {
      c.done = true; A.placed.push(c); A.next++; A.sel = null;
      addXP(s.place); toast('+' + s.place + ' XP \u00b7 sequence valid', true);
      afterMove();
    } else if (!c.e.order) wrong(w.decoy, c.el);
    else wrong(w.early, c.el);
  }
  function dismiss() {
    if (A.phase !== 'order' || needSel()) return;
    var c = A.sel, s = C.d.act1.scoring;
    if (!c.e.order) {
      c.done = true; A.sel = null;
      addXP(s.dismiss); toast('+' + s.dismiss + ' XP \u00b7 red herring dismissed', true);
      afterMove();
    } else wrong(C.d.act1.wrongLines.dismissReal, c.el);
  }
  function askHint() {
    var k = String(A.next), hint = C.d.act1.hints[k];
    if (A.phase !== 'order' || A.hinted[k] || !hint) return;
    A.hinted[k] = true; A.hints++; addXP(C.d.act1.scoring.hint);
    toast('Hint: ' + hint, true, 'hint');
    drawAct1();
  }
  function afterMove() {
    drawAct1();
    if (A.cards.every(function (c) { return c.done; })) {
      A.phase = 'pz';
      E.deck.hidden = true;
      E.title.textContent = C.d.act1.pzTitle;
      E.line.textContent = ''; rich(C.d.act1.pzHelp, E.line);
      drawAct1();
      var first = E.slots.querySelector('.c-slotbtn'); if (first) first.focus({ preventScroll: true });
    }
  }
  function pickPZ(c) {
    if (A.phase !== 'pz') return;
    var s = C.d.act1.scoring;
    if (c.e.id !== C.d.patientZero) { wrong(C.d.act1.wrongLines.pz); return; }
    c.pz = true; A.phase = 'done';
    addXP(s.patientZero); toast('+' + s.patientZero + ' XP \u00b7 patient zero identified', true, 'patientZero');
    E.title.textContent = C.d.act1.doneTitle;
    E.line.textContent = ''; rich(C.d.act1.doneHelp, E.line);
    app.classList.remove('c-fit');   // the debrief is a normal scrolling page
    drawAct1();
    saveAct1();
    renderDebrief();
  }
  function saveAct1() {
    var rec = caseRec(), prev = rec.act1 || {};
    var secs = Math.round((Date.now() - A.startedAt) / 1000), gained = C.xp - A.xp0;
    rec.act1 = {
      done: true,
      bestXp: Math.max(gained, prev.bestXp || 0),
      bestTime: prev.bestTime ? Math.min(prev.bestTime, secs) : secs,
      fewestMistakes: prev.fewestMistakes != null ? Math.min(prev.fewestMistakes, A.mistakes) : A.mistakes
    };
    A.secs = secs; A.gained = gained;
    BE.saveProgress();
  }

  /* ---------- Act 1 debrief: case finding + the real timeline ---------- */
  function renderDebrief() {
    var d = C.d, box = E.done;
    box.textContent = ''; box.hidden = false;
    box.appendChild(panel('danger', [eyebrow('Case finding', 't-red'), para(d.act1.finding)]));
    var mm = Math.floor(A.secs / 60), ss = A.secs % 60;
    box.appendChild(h('div', { class: 'c-stats' }, [
      stat('XP earned', String(A.gained)),
      stat('mistakes', pad(A.mistakes, 2), A.mistakes ? 'y' : ''),
      stat('hints used', pad(A.hints, 2), A.hints ? 'y' : ''),
      stat('time', mm + ':' + (ss < 10 ? '0' : '') + ss)
    ]));
    var tl = h('ol', { class: 'c-reveal' });
    d.timeline.forEach(function (t) {
      var src = srcById(t.source);
      var li = h('li', {}, [
        h('div', { class: 'c-hud' }, [h('b', { text: 'STAGE ' + t.stage + (t.date ? ' \u00b7 ' + t.date.toUpperCase() : '') }),
          h('span', { class: 'c-chips' }, (t.mitre || []).map(function (m) { return h('span', { class: 'c-chip', text: m }); }))]),
        para(t.text),
        h('p', { class: 'c-why' }, [h('span', { class: 't-g', text: 'why it worked: ' }), rich(t.why)])
      ]);
      if (src) li.appendChild(h('a', { class: 'c-small', href: src.url, target: '_blank', rel: 'noopener noreferrer', text: 'source: ' + src.title }));
      tl.appendChild(li);
    });
    box.appendChild(panel('', [eyebrow('The real timeline'), tl]));

    box.appendChild(panel('hl', [eyebrow('Next \u00b7 Act 2'), para(d.rewind)]));
    box.appendChild(h('button', { class: 'c-btn', text: d.act2.rewindButton, onclick: startAct2 }));
    box.appendChild(h('button', { class: 'c-ghost c-wide', text: './replay --act 1', onclick: function () { C.xp = 0; startAct1(); } }));
    box.appendChild(sourcesLine());
    box.scrollIntoView({ behavior: BE.reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  function stat(label, v, t) { return h('div', { class: 'c-stat' }, [h('span', { class: 'c-small', text: label }), tone(h('span', { class: 'c-v', text: v }), t)]); }

  /* ---------- Act 2: Defend (defense map + control deck + replay) ----------
     Everything comes from the level JSON: map zones/stages, controls (cost, stage, effect, friction, why),
     budget, star rules, outcomes, tips and log lines. Effects: block | detect | limit | decoy. */
  var B = null, F = {};   // Act 2 state (the build survives "try another build") and element refs
  function fmt(t, v) { return String(t || '').replace(/\{(\w+)\}/g, function (_, k) { return v && v[k] != null ? v[k] : ''; }); }
  function ctl(id) { return C.d.controls.filter(function (c) { return c.id === id; })[0]; }
  function stageOf(n) { return C.d.map.stages.filter(function (s) { return s.n === n; })[0]; }
  function zoneOf(id) { return C.d.map.zones.filter(function (z) { return z.id === id; })[0]; }
  function ctlZone(c) { return zoneOf(stageOf(c.stage).zone); }
  // ATT&CK codes for a stage: the Act 1 timeline is the single source, so both acts always match.
  function stageCodes(n) {
    var t = (C.d.timeline || []).filter(function (x) { return x.stage === n; })[0];
    return (t && t.mitre) || stageOf(n).mitre || [];
  }
  function deployed() { return C.d.controls.filter(function (c) { return B.on.indexOf(c.id) >= 0; }); }
  function spent() { return deployed().reduce(function (a, c) { return a + c.cost; }, 0); }
  function left() { return C.d.budget - spent(); }

  function startAct2() {
    if (!B) B = { on: [] };
    if (C.xpAct1 == null) C.xpAct1 = C.xp;
    C.xp = C.xpAct1;            // each run scores on its own; Act 1 XP is kept
    B.running = false;
    renderAct2();
  }

  function renderAct2() {
    var a2 = C.d.act2, rec = caseRec();
    frame('ACT 2');
    app.classList.add('c-a2screen', 'c-fit');
    BE.onLeave(stopRun);

    F.title = h('h2', { class: 'c-h2', text: a2.title });
    var helpBox = h('div', { class: 'c-helpbox', id: 'c-help2', hidden: true }, [para(a2.help), voiceToggle()]);
    var helpBtn = h('button', { class: 'c-ghost c-helpbtn', 'aria-label': 'How to play', 'aria-expanded': 'false', 'aria-controls': 'c-help2', text: '?', onclick: function () {
      var open = helpBox.hidden; helpBox.hidden = !open; helpBtn.setAttribute('aria-expanded', String(open));
    } });
    var best = rec.act2 && rec.act2.bestStars != null ? h('span', { class: 'c-small c-best', text: 'best ' + rec.act2.bestStars + '/3 ★' }) : null;
    F.threat = h('div', { class: 'c-meterfill' });
    F.threatTxt = h('span', { class: 'c-small c-threattxt', text: 'idle' });
    F.meter = h('div', { class: 'c-meter', role: 'progressbar', 'aria-label': 'Threat level', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, [F.threat]);
    app.appendChild(panel('c-head', [
      h('div', { class: 'c-headrow' }, [h('div', { class: 'c-headtxt' }, [eyebrow('Act 2 · Defend'), F.title]), best, helpBtn]),
      para(a2.short, 'c-line'), helpBox,
      h('div', { class: 'c-threatrow' }, [h('span', { class: 'c-small', text: 'threat level' }), F.meter, F.threatTxt])
    ]));

    F.map = h('div', { class: 'c-map' });
    F.log = h('div', { class: 'c-log', role: 'log', 'aria-label': 'Attack log', 'aria-live': 'polite' });
    F.deck = h('div', { class: 'c-ctlgrid', role: 'group', 'aria-label': 'Control deck' });
    F.count = h('span', {});
    var mapBox = F.mapBox = h('div', { class: 'c-a2map' }, [h('div', { class: 'c-hud' }, [h('span', { text: a2.mapCmd || '> map ./network' }), h('span', { class: 'c-small', text: 'drop controls on a stage' })]), F.map]);
    var deckBox = h('div', { class: 'c-deck c-a2deck' }, [h('div', { class: 'c-hud' }, [h('span', { text: '> ls ./controls' }), F.count]), h('div', { class: 'c-gridwrap' }, [F.deck])]);
    F.main = h('div', { class: 'c-a2' }, [mapBox, F.log, deckBox]);
    app.appendChild(F.main);
    app.appendChild(defBox);

    // Pinned bar: budget + last message, reset, EXECUTE.
    F.budget = h('span', { class: 'c-budget', 'aria-hidden': 'true' });
    F.left = h('span', { class: 'c-budgetnum' });
    F.msg = h('span', { class: 'c-msg', role: 'status', 'aria-live': 'polite' });
    F.status = h('div', { class: 'c-status' }, [h('div', { class: 'c-budgetrow' }, [F.budget, F.left]), F.msg]);
    F.clear = h('button', { class: 'c-ghost c-clear', text: 'reset build', onclick: function () {
      if (B.running || !B.on.length) return;
      B.on = []; say('k', fmt('[-] build cleared')); drawAct2();
    } });
    F.run = h('button', { class: 'c-btn red c-run', text: '> EXECUTE ATTACK_SIM', onclick: runAttack });
    app.appendChild(h('div', { class: 'c-bar c-a2bar', role: 'toolbar', 'aria-label': 'Build actions' }, [h('div', { class: 'c-bar-in' }, [F.status, F.clear, F.run])]));

    F.log.appendChild(h('div', {}, [a2.logs.idle, h('span', { class: 'c-blink', text: '_' })]));
    threat(0);
    drawAct2();
  }

  function drawAct2() { drawMap(); drawDeck(); drawBudget(); }

  function drawMap() {
    var links = C.d.map.links || {};
    F.map.textContent = ''; F.nodes = {};
    C.d.map.zones.forEach(function (z) {
      var wrap = tone(h('div', { class: 'c-zone c-mzone' }, [h('span', { class: 'c-zt', text: z.name })]), z.tone);
      var list = C.d.map.stages.filter(function (s) { return s.zone === z.id; });
      list.forEach(function (s, i) {
        var chips = deployed().filter(function (c) { return c.stage === s.n; }).map(function (c) { return rich(c.name, h('span', { class: 'c-chip' }), false); });
        var codes = h('span', { class: 'c-chips' }, stageCodes(s.n).map(function (m) { return h('span', { class: 'c-mt', text: m }); }));
        var node = h('div', { class: 'c-node', 'data-drop': 'stage', 'data-n': String(s.n), 'data-zone': z.id }, [
          h('div', { class: 'c-ntop' }, [h('span', { class: 'c-nname' }, [h('b', { class: 'c-nn', text: s.n + ' · ' }), rich(s.name, null, false)]), codes]),
          chips.length ? h('div', { class: 'c-chips c-nchips' }, chips) : null
        ]);
        F.nodes[s.n] = node;
        wrap.appendChild(node);
        if (i < list.length - 1) wrap.appendChild(h('div', { class: 'c-link', 'aria-hidden': 'true' }));
      });
      F.map.appendChild(wrap);
      if (links[z.id]) F.map.appendChild(h('div', { class: 'c-arrow', text: links[z.id] }));
    });
  }
  function bars(n, cls) { var b = h('span', { class: cls || 'c-cost', 'aria-hidden': 'true' }); for (var i = 0; i < n; i++) b.appendChild(h('i', {})); return b; }
  function drawDeck() {
    F.deck.textContent = '';
    C.d.controls.forEach(function (c) {
      var on = B.on.indexOf(c.id) >= 0, z = ctlZone(c);
      var b = h('button', { class: 'c-ctl' + (on ? ' on' : ''), 'aria-pressed': String(on),
        'aria-label': plain(c.name) + '. Protects the ' + (z.short || z.name).toLowerCase() + '. Costs ' + c.cost + '.' }, [
        h('span', { class: 'c-z', text: z.short || z.name }),
        h('span', { class: 'c-cname' }, [on ? '✓ ' : '', rich(c.name, null, false)]),
        h('span', { class: 'c-costrow' }, [bars(c.cost), h('span', { class: 'c-small', text: c.cost + ' energy' })])
      ]);
      attachDrag(b, {
        can: function () { return !B.running; },
        click: function () { toggle(c); },
        targets: function () { return Object.keys(F.nodes || {}).map(function (k) { return F.nodes[k]; }); },
        drop: function (t, el) { dropCtl(c, t, el); }
      });
      F.deck.appendChild(b);
    });
    F.count.textContent = B.on.length + ' deployed';
  }
  function drawBudget() {
    var l = left();
    F.budget.textContent = '';
    for (var i = 0; i < C.d.budget; i++) F.budget.appendChild(h('i', { class: i < l ? '' : 'off' }));
    F.left.textContent = l + ' / ' + C.d.budget + ' energy left';
    F.clear.disabled = B.running || !B.on.length;
    F.run.disabled = B.running;
  }
  function say(cls, text) {
    F.msg.textContent = ''; F.msg.className = 'c-msg t-' + cls; rich(text, F.msg, false);
    logLine(cls, text);
  }
  function logLine(cls, strong, rest) {
    if (F.log.querySelector('.c-blink')) F.log.textContent = '';
    var line = h('div', {}, [rich(strong, h('span', { class: 't-' + cls }), false)]);
    if (rest) { line.appendChild(document.createTextNode(' ')); rich(rest, line, false); }
    F.log.appendChild(line);
    F.log.scrollTop = F.log.scrollHeight;
  }
  function toggle(c) {
    if (B.running) return;
    var logs = C.d.act2.logs, i = B.on.indexOf(c.id);
    if (i >= 0) { B.on.splice(i, 1); say('k', fmt(logs.removed, { name: c.name })); }
    else if (c.cost > left()) { overBudget(c); return; }
    else { B.on.push(c.id); say('k', fmt(logs.deployed, { name: c.name, n: c.stage })); }
    drawAct2();
  }
  function overBudget(c) {
    say('red', fmt(C.d.act2.logs.overBudget, { name: c.name, cost: c.cost, left: left() }));
    flash(); restart(F.status, 'c-shake');
  }
  function dropCtl(c, t, el) {
    if (!t || t.getAttribute('data-drop') !== 'stage') { restart(el, 'c-shake'); return; }
    var z = ctlZone(c);
    if (t.getAttribute('data-zone') !== z.id) {
      say('red', fmt(C.d.act2.logs.wrongZone, { name: c.name, zone: (z.short || z.name).toLowerCase() }));
      restart(t, 'c-shake'); return;
    }
    if (B.on.indexOf(c.id) < 0) toggle(c);
  }
  function threat(p) {
    F.threat.style.width = p + '%';
    var lvl = p > 66 ? 'crit' : p > 33 ? 'elev' : p ? 'low' : '';
    F.threat.className = 'c-meterfill' + (lvl ? ' ' + lvl : '');
    F.threatTxt.textContent = { crit: 'CRITICAL', elev: 'ELEVATED', low: 'LOW' }[lvl] || 'idle';
    F.meter.setAttribute('aria-valuenow', String(p));
  }

  // The attack against the current build, worked out in full before anything animates.
  function simulate() {
    var on = deployed(), out = { steps: [], blocked: 0, detected: false, limited: false };
    C.d.map.stages.forEach(function (s) {
      if (out.blocked) return;
      var here = on.filter(function (c) { return c.stage === s.n; });
      var st = {
        s: s,
        decoys: here.filter(function (c) { return c.effect === 'decoy'; }),
        detect: here.filter(function (c) { return c.effect === 'detect'; })[0],
        limit: here.filter(function (c) { return c.effect === 'limit'; })[0],
        block: here.filter(function (c) { return c.effect === 'block'; })[0]
      };
      if (st.detect) out.detected = true;
      if (st.limit) out.limited = true;
      if (st.block) out.blocked = s.n;
      out.steps.push(st);
    });
    return out;
  }
  function score(res) {
    var a2 = C.d.act2, on = deployed(), total = C.d.map.stages.length, o = a2.outcomes;
    var decoys = on.filter(function (c) { return c.effect === 'decoy'; }).length;
    var fr = on.reduce(function (a, c) { return a + (c.friction || 0); }, 0);
    var r = { decoys: decoys, friction: fr, spent: spent(), total: total };
    // Outcome by where the chain broke: prevented (blocked at stage <= preventedMaxStage), contained (blocked later),
    // detected (only detected or limited), succeeded (not stopped).
    if (res.blocked) {
      r.stars = res.blocked <= a2.threeStarMaxStage && !decoys ? 3 : 2;
      var oc = res.blocked <= a2.preventedMaxStage ? o.prevented : o.contained;
      r.kind = oc === o.prevented ? 'prevented' : 'contained';
      r.title = oc.title; r.sub = fmt(oc.sub, { n: res.blocked, total: total }); r.loss = oc.loss;
    } else if (res.detected || res.limited) {
      r.stars = 1; r.kind = 'detected'; r.title = o.detected.title;
      r.sub = res.detected && res.limited ? o.detected.subBoth : res.detected ? o.detected.subDetected : o.detected.subLimited;
      r.loss = res.detected && res.limited ? o.detected.lossBoth : o.detected.lossOne;
    } else { r.stars = 0; r.kind = 'succeeded'; r.title = o.succeeded.title; r.sub = o.succeeded.sub; r.loss = o.succeeded.loss; }
    r.frictionLabel = fr <= a2.friction.low ? 'LOW' : fr <= a2.friction.medium ? 'MED' : 'HIGH';
    r.rank = C.d.ranks[r.stars];
    return r;
  }

  function runAttack() {
    if (B.running) return;
    var a2 = C.d.act2, res = simulate();
    B.running = true; app.classList.add('c-running'); drawBudget();
    // Reduced motion: no animation. The results screen lists every stage instead.
    if (BE.reduceMotion()) { finishRun(res); return; }
    drawMap();
    F.log.textContent = '';
    say('k', '> ' + fmt(a2.logs.start, { sim: a2.simName }));
    var v = voiceLine('run'); if (v) logLine('k c-voice', v);
    if (window.matchMedia('(max-width: 899px)').matches) F.map.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else F.mapBox.scrollTop = 0;
    var i = 0, total = C.d.map.stages.length;
    (function next() {
      var st = res.steps[i], node = F.nodes[st.s.n];
      node.classList.add('active');
      follow(node);
      B.timer = setTimeout(function () {
        node.classList.remove('active');
        showStep(st, node, total);
        follow(node);
        if (++i >= res.steps.length) { B.timer = setTimeout(function () { finishRun(res); }, 1000); return; }
        next();
      }, a2.stepMs);
    })();
  }
  // Keep the stage under attack visible: scroll the map panel on desktop, the page on phones.
  function follow(node) {
    var box = F.mapBox;
    if (box.scrollHeight > box.clientHeight + 1) {
      var r = node.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 8;
      else if (r.top < b.top) box.scrollTop -= b.top - r.top + 8;
    } else node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function pill(node, cls, text) { node.querySelector('.c-ntop').appendChild(h('span', { class: 'c-pill ' + cls, text: text })); }
  function showStep(st, node, total) {
    var L = C.d.act2.logs, n = st.s.n;
    st.decoys.forEach(function (c) { logLine('y', fmt(L.decoy, { name: c.name }), c.why); });
    if (st.detect) { logLine('k', fmt(L.detect, { n: n }), st.detect.why); pill(node, 'y', '! DETECTED'); }
    if (st.limit) { logLine('k', fmt(L.limit, { n: n }), st.limit.why); pill(node, 'y', '◐ LIMITED'); }
    if (st.block) {
      node.classList.add('block'); pill(node, 'g', '✓ BLOCKED');
      logLine('k', fmt(L.block, { n: n }), st.block.why);
      rain.red = false; threat(Math.round(n / total * 50));
      return;
    }
    // A stage the defender cannot block (e.g. a spray from outside) is shown as attempted, not breached.
    if (st.s.unblockable) {
      node.classList.add('attempt'); pill(node, 'y', '⚠ ATTEMPTED');
      logLine('y', fmt(L.attempted, { n: n, stage: st.s.name }));
      threat(Math.round(n / total * 100));
      return;
    }
    node.classList.add('breach'); pill(node, 'r', '✕ BREACHED');
    logLine('red', fmt(L.breach, { n: n, stage: st.s.name }));
    flash(); restart(node, 'c-glitch'); rain.red = true;
    threat(Math.round(n / total * 100));
  }
  function stopRun() {
    if (B && B.timer) { clearTimeout(B.timer); B.timer = null; }
    if (B) B.running = false;
    rain.red = false;
  }
  function finishRun(res) {
    stopRun();
    var r = score(res), rec = caseRec(), prev = rec.act2 || {};
    C.xp = C.xpAct1 + r.stars * C.d.act2.xpPerStar;
    rec.act2 = {
      bestStars: Math.max(r.stars, prev.bestStars || 0),
      bestBuild: r.stars >= (prev.bestStars || 0) ? B.on.slice() : prev.bestBuild,
      lastStars: r.stars,
      runs: (prev.runs || 0) + 1
    };
    BE.saveProgress();
    renderResults(res, r, prev.bestStars);
  }

  /* ---------- Results ---------- */
  function starRow(n) {
    var row = h('div', { class: 'c-stars', role: 'img', 'aria-label': n + ' of 3 stars' });
    for (var i = 0; i < 3; i++) {
      var s = document.createElementNS(SVGNS, 'svg');
      s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', i < n ? 'on' : '');
      var p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z');
      s.appendChild(p); row.appendChild(s);
    }
    return row;
  }
  function renderResults(res, r, prevBest) {
    var a2 = C.d.act2, d = C.d, total = r.total;
    frame('DEBRIEF');
    app.classList.add('c-resscreen');
    var good = r.stars > 0;
    var newBest = prevBest == null || r.stars > prevBest;
    app.appendChild(panel((good ? 'hl' : 'danger') + ' c-rescard', [
      eyebrow('Case ' + d.caseNo + ' · Debrief'),
      h('h1', { class: 'c-display' + (good ? '' : ' t-red'), text: r.title }),
      para(r.sub),
      voiceP(voiceLine(r.kind === 'prevented' || r.kind === 'contained' ? 'contained' : 'breached')),
      starRow(r.stars),
      h('span', { class: 'c-pill ' + (good ? 'g' : 'r'), text: 'CLEARANCE · ' + r.rank }),
      h('p', { class: 'c-small', text: newBest ? 'New best for this case.' : 'Best so far: ' + caseRec().act2.bestStars + '/3 stars.' })
    ]));
    app.appendChild(h('div', { class: 'c-stats' }, [
      stat(a2.lossLabel, r.loss, r.loss === a2.outcomes.prevented.loss ? '' : 'red'),
      stat('budget used', pad(r.spent, 2) + '/' + d.budget),
      stat('user friction', r.frictionLabel, r.frictionLabel === 'LOW' ? '' : 'y'),
      stat('decoys bought', pad(r.decoys, 2), r.decoys ? 'y' : '')
    ]));

    var tips = [];
    if (r.stars < 3) tips.push(['k', res.blocked && res.blocked <= a2.threeStarMaxStage && r.decoys ? a2.tips.decoyStar : a2.tips.notThree]);
    if (r.decoys) tips.push(['y', fmt(a2.tips.decoys, { n: r.decoys })]);
    if (r.frictionLabel === 'HIGH') tips.push(['y', a2.tips.friction]);
    tips.push(['k', a2.tips.always]);
    var tipBox = h('div', { class: 'c-log c-tips' });
    tips.forEach(function (t) { tipBox.appendChild(h('div', {}, [h('span', { class: 't-' + t[0], text: '> ' }), rich(t[1], null, false)])); });
    app.appendChild(panel('', [eyebrow('Tips'), tipBox]));

    // Stage by stage: the same results the replay animated (and the only view with reduced motion).
    var list = h('ol', { class: 'c-replay' });
    res.steps.forEach(function (st) {
      var n = st.s.n, kind = st.block ? 'block' : st.s.unblockable ? 'attempt' : 'breach';
      var li = h('li', { class: kind }, [
        h('div', { class: 'c-hud' }, [h('b', {}, [n + ' · ', rich(st.s.name, null, false)]),
          h('span', { class: 'c-pill ' + { block: 'g', attempt: 'y', breach: 'r' }[kind], text: { block: '✓ BLOCKED', attempt: '⚠ ATTEMPTED', breach: '✕ BREACHED' }[kind] })])
      ]);
      if (kind === 'attempt' && C.d.act2.attemptedNote) li.appendChild(h('p', { class: 'c-why', text: C.d.act2.attemptedNote }));
      st.decoys.forEach(function (c) { li.appendChild(h('p', { class: 'c-why' }, [h('span', { class: 't-y', text: '[~] ' }), rich(c.name, null, false), ': no effect. ', rich(c.why, null, false)])); });
      [['detect', 'detected'], ['limit', 'limited'], ['block', 'blocked']].forEach(function (k) {
        var c = st[k[0]]; if (c) li.appendChild(h('p', { class: 'c-why' }, [h('span', { class: 't-g', text: '[+] ' + k[1] + ' by ' }), rich(c.name, null, false), ': ', rich(c.why, null, false)]));
      });
      list.appendChild(li);
    });
    if (!res.blocked) list.appendChild(h('li', { class: 'breach' }, [h('p', { class: 'c-why' }, ['Attack completed: all ' + total + ' stages ran.'])]));
    app.appendChild(panel('', [eyebrow('Replay · stage by stage'), list]));

    // The build, with what each control actually did and the lesson behind it.
    var build = h('ul', { class: 'c-buildlist' });
    deployed().forEach(function (c) {
      build.appendChild(h('li', {}, [
        h('div', { class: 'c-hud' }, [rich(c.name, h('b', {}), false), h('span', { class: 'c-pill ' + (c.effect === 'decoy' ? 'y' : 'o'), text: c.effect.toUpperCase() })]),
        h('p', { class: 'c-why' }, [rich(c.why, null, false), c.teach ? ' ' + c.teach : ''])
      ]));
    });
    if (!B.on.length) build.appendChild(h('li', {}, [h('p', { class: 'c-why', text: 'No controls deployed.' })]));
    app.appendChild(panel('', [eyebrow('Your build · ' + B.on.length + ' controls'), build]));

    app.appendChild(h('button', { class: 'c-btn', text: '> TRY ANOTHER BUILD', onclick: startAct2 }));
    app.appendChild(h('button', { class: 'c-ghost c-wide', text: './restart --case ' + d.caseNo, onclick: restartCase }));
    app.appendChild(sourcesLine());
  }
  function voiceP(v) { return v ? h('p', { class: 'c-voice', role: 'status', text: v }) : null; }
  function restartCase() {
    C.xp = 0; C.xpAct1 = null; A = null; B = null;
    renderBrief(0);
  }

  /* ---------- drag and drop (Pointer Events; tap + buttons stay as the fallback) ----------
     attachDrag(el, o): o.can() may start, o.pick() on lift, o.click() on a plain tap,
     o.targets() lists drop zones to highlight, o.drop(zoneOrNull, el) on release. Zones carry data-drop. */
  var D = null;
  function attachDrag(el, o) {
    el.addEventListener('pointerdown', function (e) {
      if (!o.can() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      endDrag();
      D = { o: o, el: el, id: e.pointerId, x: e.clientX, y: e.clientY, on: false, moved: false, type: e.pointerType, hold: null };
      // Touch and pen: a short press-and-hold picks the item up, so normal swipes still scroll the page.
      if (e.pointerType !== 'mouse') D.hold = setTimeout(function () { if (D && !D.moved) beginDrag(e.clientX, e.clientY); }, 260);
    });
    el.addEventListener('click', function (e) {
      if (el._dragged) { el._dragged = false; e.preventDefault(); return; }
      o.click();
    });
  }
  function beginDrag(x, y) {
    if (!D || D.on) return;
    D.on = true;
    try { D.el.setPointerCapture(D.id); } catch (e) { /* not capturable */ }
    if (D.o.pick) D.o.pick();
    var r = D.el.getBoundingClientRect();
    D.ox = x - r.left; D.oy = y - r.top;
    D.ghost = D.el.cloneNode(true);
    D.ghost.classList.add('c-ghostcard', 'sel'); D.ghost.setAttribute('aria-hidden', 'true');
    D.ghost.style.width = r.width + 'px';
    document.body.appendChild(D.ghost);
    D.el.classList.add('c-lifted');
    moveGhost(x, y);
    document.body.classList.add('c-dragging');
  }
  function moveGhost(x, y) {
    D.ghost.style.transform = 'translate(' + Math.round(x - D.ox) + 'px,' + Math.round(y - D.oy) + 'px)';
    var t = dropAt(x, y);
    D.o.targets().forEach(function (z) { if (z) z.classList.toggle('c-over', t === z); });
  }
  function dropAt(x, y) {
    var hit = document.elementFromPoint(x, y);
    return hit && hit.closest ? hit.closest('[data-drop]') : null;
  }
  document.addEventListener('pointermove', function (e) {
    if (!D || e.pointerId !== D.id) return;
    var dx = e.clientX - D.x, dy = e.clientY - D.y, far = dx * dx + dy * dy > 64;
    if (!D.on) {
      if (far) D.moved = true;
      if (D.type === 'mouse' && far) beginDrag(e.clientX, e.clientY);
      else return;
    }
    e.preventDefault();
    moveGhost(e.clientX, e.clientY);
  });
  // While an item is held on a touch screen, stop the page from scrolling under the finger.
  document.addEventListener('touchmove', function (e) { if (D && D.on) e.preventDefault(); }, { passive: false });
  document.addEventListener('pointerup', function (e) {
    if (!D || e.pointerId !== D.id) return;
    if (D.on) {
      var t = dropAt(e.clientX, e.clientY), o = D.o, el = D.el;
      el._dragged = true;
      endDrag();
      o.drop(t, el);
      setTimeout(function () { el._dragged = false; }, 0);
    } else endDrag();
  });
  document.addEventListener('pointercancel', function (e) { if (D && e.pointerId === D.id) endDrag(); });
  function endDrag() {
    if (!D) return;
    if (D.hold) clearTimeout(D.hold);
    if (D.ghost) D.ghost.remove();
    if (D.el) D.el.classList.remove('c-lifted');
    D.o.targets().forEach(function (z) { if (z) z.classList.remove('c-over'); });
    document.body.classList.remove('c-dragging');
    D = null;
  }

  /* ---------- keyboard: A adds, X marks not related, H asks for a hint ---------- */
  document.addEventListener('keydown', function (e) {
    if (!A || !app.classList.contains('c-a1screen') || A.phase !== 'order' || !E.deck || E.deck.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key.toLowerCase();
    if (k === 'a') { e.preventDefault(); place(); }
    else if (k === 'x') { e.preventDefault(); dismiss(); }
    else if (k === 'h') { e.preventDefault(); askHint(); }
    else if (k === 'escape') endDrag();
  });

  window.BreachCase = { start: start, voiceToggle: voiceToggle, backdrop: function () { enterTerminal(); BE.onLeave(leaveTerminal); BE.onLeave(endDrag); } };
})();
