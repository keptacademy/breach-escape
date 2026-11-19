/* Breach Escape v2 case engine: Intel briefing -> Act 1 Investigate (-> Act 2 Defend, not built yet).
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
      c.fillStyle = rain.red ? '#FF3B4E' : '#39FF7A';
      c.fillText('0123456789abcdef'[Math.floor(Math.random() * 16)], i * 16, y * 16);
      rain.cols[i] = (y * 16 > cv.height && Math.random() > 0.97) ? 0 : y + 1;
    });
  }
  function enterTerminal() {
    document.body.classList.add('case-mode');
    if (!edge) { edge = h('div', { class: 'c-edge', 'aria-hidden': 'true' }); document.body.appendChild(edge); }
    if (!BE.reduceMotion() && !rain.cv) {
      rain.cv = h('canvas', { class: 'c-rain', 'aria-hidden': 'true' });
      rain.ctx = rain.cv.getContext('2d');
      document.body.insertBefore(rain.cv, document.body.firstChild);
      sizeRain(); window.addEventListener('resize', sizeRain);
    }
    if (rain.cv && !rain.timer) rain.timer = setInterval(tickRain, 110);
  }
  // Runs on every screen change; frame() re-enters right away when the next screen is also a case screen.
  // The canvas stays in the page (hidden by CSS outside case mode) so the rain does not restart on each page.
  function leaveTerminal() {
    document.body.classList.remove('case-mode');
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
    BE.leave();                         // stops v1 timers and runs previous cleanups
    app.textContent = ''; app.className = 'app case';
    enterTerminal();
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

  /* ---------- load + start ---------- */
  function start(L) {
    C = { L: L, d: null, xp: 0 };
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
        h('p', { text: 'Could not open the case file. Check your connection and try again, or play the classic version.' }),
        h('button', { class: 'c-btn', text: '> RETRY', onclick: function () { start(L); } }),
        h('button', { class: 'c-ghost c-wide', text: 'Play the classic quiz', onclick: function () { BE.startClassic(L.id); } })
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
        kids.push(h('h1', { class: 'c-display', text: b.title }));
        kids.push(para(b.text));
        if (b.kv) kids.push(kvList(b.kv));
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
      h('p', { class: 'c-small', text: 'Keys: A add to timeline \u00b7 X not related \u00b7 H hint. Tap a dotted word to see what it means.' })
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
      attachDrag(b, c);
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
  function toast(msg, ok) { E.toast.textContent = msg; E.toast.className = 'c-toast ' + (ok ? 'ok' : 'bad'); }
  function wrong(msg, el) {
    var s = C.d.act1.scoring;
    A.mistakes++; addXP(s.wrong);
    toast(s.wrong + ' \u00b7 ' + msg, false); flash();
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
    toast('Hint: ' + hint, true);
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
    addXP(s.patientZero); toast('+' + s.patientZero + ' XP \u00b7 patient zero identified', true);
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

    var act2Ready = d.status && d.status.act2 === 'ready';
    box.appendChild(panel('hl', [eyebrow('Next'), para(d.rewind),
      act2Ready ? null : h('p', { class: 'c-small', text: 'Act 2 (Defend) is still in the lab. Until it ships, you can defend in the classic quiz.' })]));
    box.appendChild(h('button', { class: 'c-btn', disabled: !act2Ready, text: act2Ready ? '> REWIND TO OCTOBER 2023' : '> REWIND TO OCTOBER 2023 \u00b7 SOON' }));
    box.appendChild(h('button', { class: 'c-ghost c-wide', text: '> defend in classic mode', onclick: function () { BE.startClassic(C.L.id); } }));
    box.appendChild(h('button', { class: 'c-ghost c-wide', text: './replay --act 1', onclick: function () { C.xp = 0; startAct1(); } }));
    box.appendChild(sourcesLine());
    box.scrollIntoView({ behavior: BE.reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  function stat(label, v, t) { return h('div', { class: 'c-stat' }, [h('span', { class: 'c-small', text: label }), tone(h('span', { class: 'c-v', text: v }), t)]); }

  /* ---------- drag and drop (Pointer Events; tap-to-select + buttons stay as the fallback) ---------- */
  var D = null;
  function attachDrag(el, c) {
    el.addEventListener('pointerdown', function (e) {
      if (A.phase !== 'order' || (e.pointerType === 'mouse' && e.button !== 0)) return;
      endDrag();
      D = { c: c, el: el, id: e.pointerId, x: e.clientX, y: e.clientY, on: false, moved: false, type: e.pointerType, hold: null };
      // Touch and pen: a short press-and-hold picks the card up, so normal swipes still scroll the page.
      if (e.pointerType !== 'mouse') D.hold = setTimeout(function () { if (D && !D.moved) beginDrag(e.clientX, e.clientY); }, 260);
    });
    el.addEventListener('click', function (e) {
      if (el._dragged) { el._dragged = false; e.preventDefault(); return; }
      select(c);
    });
  }
  function beginDrag(x, y) {
    if (!D || D.on) return;
    D.on = true;
    try { D.el.setPointerCapture(D.id); } catch (e) { /* not capturable */ }
    A.sel = D.c;
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
    [E.slots, E.add, E.nr].forEach(function (z) { z.classList.toggle('c-over', t === z); });
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
  // While a card is held on a touch screen, stop the page from scrolling under the finger.
  document.addEventListener('touchmove', function (e) { if (D && D.on) e.preventDefault(); }, { passive: false });
  document.addEventListener('pointerup', function (e) {
    if (!D || e.pointerId !== D.id) return;
    if (D.on) {
      var t = dropAt(e.clientX, e.clientY), c = D.c, el = D.el;
      el._dragged = true;
      endDrag();
      A.sel = c;
      if (t && t.getAttribute('data-drop') === 'timeline') place();
      else if (t && t.getAttribute('data-drop') === 'nr') dismiss();
      else { drawAct1(); restart(c.el, 'c-shake'); }   // dropped nowhere: wobble back, stay selected
      setTimeout(function () { el._dragged = false; }, 0);
    } else endDrag();
  });
  document.addEventListener('pointercancel', function (e) { if (D && e.pointerId === D.id) endDrag(); });
  function endDrag() {
    if (!D) return;
    if (D.hold) clearTimeout(D.hold);
    if (D.ghost) D.ghost.remove();
    if (D.el) D.el.classList.remove('c-lifted');
    [E.slots, E.add, E.nr].forEach(function (z) { if (z) z.classList.remove('c-over'); });
    document.body.classList.remove('c-dragging');
    D = null;
  }

  /* ---------- keyboard: A adds, X marks not related, H asks for a hint ---------- */
  document.addEventListener('keydown', function (e) {
    if (!A || !app.classList.contains('case') || A.phase !== 'order' || !E.deck || E.deck.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key.toLowerCase();
    if (k === 'a') { e.preventDefault(); place(); }
    else if (k === 'x') { e.preventDefault(); dismiss(); }
    else if (k === 'h') { e.preventDefault(); askHint(); }
    else if (k === 'escape') endDrag();
  });

  window.BreachCase = { start: start };
})();
