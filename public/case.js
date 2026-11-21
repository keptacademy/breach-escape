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
  // Anything in the level JSON that carries a "todo" (an unverified fact) is never shown to players.
  function shown(x) { return !(x && typeof x === 'object' && x.todo); }
  function tipText(x) { return !x || !shown(x) ? null : typeof x === 'object' ? x.t : x; }
  function srcById(id) { return (C.d.sources || []).filter(function (s) { return s.id === id && shown(s); })[0]; }

  /* ---------- sources: numbered footnote markers [n] + one numbered sources panel ----------
     Numbers are per case, in order of first use on the player-facing screens (briefing, debrief timeline, tips,
     controls); the same source keeps its number. Sources nobody cites yet are listed after them. */
  function numberSources(d) {
    var order = [], seen = {};
    function use(id) { if (id && !seen[id] && srcByIdIn(d, id)) { seen[id] = true; order.push(id); } }
    var ta = d.briefing && d.briefing.threatActor;
    (d.briefing.pages || []).forEach(function (pg) {
      pg.blocks.forEach(function (b) {
        var kv = (b.kv || []).filter(shown).slice();
        if (b.type === 'alert' && ta && shown(ta)) kv.splice(Math.min(1, kv.length), 0, ta);
        kv.forEach(function (r) { use(r.source); });
        if (b.type === 'timeline') b.items.filter(shown).forEach(function (it) { use(it.source); });
      });
    });
    (d.timeline || []).filter(shown).forEach(function (t) { use(t.source); });
    [].concat((d.act2 && d.act2.tips && d.act2.tips.always) || []).forEach(function (x) { if (x && typeof x === 'object' && shown(x)) use(x.source); });
    (d.controls || []).forEach(function (c) { use(c.source); });
    ((d.map && d.map.stages) || []).forEach(function (s) { if (s.neutral) use(s.neutral.source); });
    (d.sources || []).filter(shown).forEach(function (x) { use(x.id); });
    var n = {}; order.forEach(function (id, i) { n[id] = i + 1; });
    return { order: order, n: n };
  }
  function srcByIdIn(d, id) { return (d.sources || []).filter(function (x) { return x.id === id && shown(x); })[0]; }
  // A small dim [n] button after a sourced fact. Opens the sources panel at that source.
  function fn(id) {
    var src = id && srcById(id), n = src && C.fn && C.fn.n[id];
    if (!n) return null;
    return h('button', { class: 'c-fn', type: 'button', 'aria-label': 'Source ' + n + ': ' + src.title, text: '[' + n + ']',
      onclick: function (e) { e.preventDefault(); e.stopPropagation(); openSource(n); } });
  }
  function withFn(el, id) { var m = fn(id); if (m) { el.appendChild(document.createTextNode(' ')); el.appendChild(m); } return el; }
  // The numbered list: title, publisher, date, link. Each item can be scrolled to and focused.
  function sourcesPanel() {
    var ol = h('ol', { class: 'c-srclist' });
    (C.fn ? C.fn.order : []).forEach(function (id, i) {
      var s = srcById(id), n = i + 1;
      ol.appendChild(h('li', { id: 'c-src-' + n, tabindex: '-1' }, [
        h('span', { class: 'c-srcn', text: '[' + n + ']' }),
        h('span', { class: 'c-srcbody' }, [
          h('span', { class: 'c-srct', text: s.title }),
          (s.publisher || s.date) ? h('span', { class: 'c-small', text: [s.publisher, s.date].filter(Boolean).join(' \u00b7 ') }) : null,
          h('a', { class: 'c-small', href: s.url, target: '_blank', rel: 'noopener noreferrer', text: 'open source \u2197' })
        ])
      ]));
    });
    return h('div', { class: 'c-sources' }, [h('div', { class: 'c-eyebrow', text: 'Sources' }), ol]);
  }
  var openSourcesHook = null;   // the briefing's footer panel registers how to open itself
  function openSource(n) {
    if (openSourcesHook) openSourcesHook();
    var li = document.getElementById('c-src-' + n);
    if (!li) return;
    li.scrollIntoView({ block: 'nearest', behavior: BE.reduceMotion() ? 'auto' : 'smooth' });
    li.focus({ preventScroll: true });
    restart(li, 'c-hit');
  }

  /* ---------- case colour + red edge flash ---------- */
  var edge = null;
  // Case colour: <html data-case="green|amber|violet"> sets the case accent (top stripe, breadcrumb marker) in theme.css.
  // It never changes the light/dark theme (data-theme). The map and About have no case colour.
  function setCase(name) {
    var root = document.documentElement;
    if (name && name !== 'brand') root.setAttribute('data-case', name); else root.removeAttribute('data-case');
  }
  function enterTerminal(theme) {
    setCase(theme);
    if (!edge) { edge = h('div', { class: 'c-edge', 'aria-hidden': 'true' }); document.body.appendChild(edge); }
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
    enterTerminal(C.d && (C.d.theme || 'green'));
    BE.onLeave(endDrag);
    hud.act = h('span', { class: 'c-act', text: label });
    // During the briefing there is no score yet: show a BRIEFING tag instead of the XP badge.
    hud.xp = opts.briefing ? null : h('span', { class: 'c-xp', text: 'XP ' + pad(C.xp) });
    app.appendChild(h('div', { class: 'c-hud' }, [
      h('button', { class: 'c-ghost c-exit', onclick: BE.renderMap }, ['\u2039 exit to map']),
      hud.act, h('span', { class: 'c-headright' }, [BE.themeToggle(true), hud.xp || h('span', { class: 'c-tagb', text: 'BRIEFING' })])
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
  // Pinned bottom bar: the screen's bottom padding always equals the bar's real height (plus a gap), so the bar never
  // covers content, whatever the bar's height (phone two-row bar, open sources list, safe area). Hidden bar: CSS default.
  function pinBar(bar) {
    function upd() { app.style.paddingBottom = bar.hidden || !bar.isConnected ? '' : (bar.offsetHeight + 12) + 'px'; }
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(upd); ro.observe(bar);
      BE.onLeave(function () { ro.disconnect(); app.style.paddingBottom = ''; });
    }
    setTimeout(upd, 0);
    return bar;
  }
  // A "more ↓" line under a panel that scrolls inside itself; shown only while there is more below. Click scrolls it.
  function scrollCue(box, label) {
    var cue = h('div', { class: 'c-morecue', 'aria-hidden': 'true', hidden: true, text: label + ' \u2193', onclick: function () {
      box.scrollBy({ top: Math.round(box.clientHeight * 0.8), behavior: BE.reduceMotion() ? 'auto' : 'smooth' });
    } });
    function upd() { cue.hidden = box.scrollHeight - box.clientHeight - box.scrollTop < 4; }
    box.addEventListener('scroll', upd, { passive: true });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(upd); ro.observe(box);
      Array.prototype.forEach.call(box.children, function (c) { ro.observe(c); });
      BE.onLeave(function () { ro.disconnect(); });
    }
    setTimeout(upd, 0);
    return cue;
  }

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
  // Same-origin case file, cached for the session (also used by the Breach Map's hero card).
  function loadCase(url) {
    if (dataCache[url]) return Promise.resolve(dataCache[url]);
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) { dataCache[url] = d; return d; });
  }
  function start(L) {
    C = { L: L, d: null, xp: 0 }; lastVoice = null;
    frame('LOADING');
    app.appendChild(panel('', [h('p', {}, ['> fetching case file', h('span', { class: 'c-blink', text: '_' })])]));
    var url = L.case;
    var p = loadCase(url);
    p.then(function (d) {
      if (!C || C.L !== L) return;
      dataCache[url] = d; C.d = d; C.fn = numberSources(d);
      renderBrief(0, true);
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
  function renderBrief(page, alert) {
    var pages = C.d.briefing.pages;
    frame('INTEL', { briefing: true });
    app.classList.add('c-briefscreen');
    if (alert) BE.sound('alert');   // SEV 1 tone when the case opens (not on page navigation)
    var dots = h('div', { class: 'c-dots', role: 'progressbar', 'aria-label': 'Briefing page', 'aria-valuemin': '1', 'aria-valuemax': String(pages.length), 'aria-valuenow': String(page + 1) });
    pages.forEach(function (_, i) { dots.appendChild(h('i', { class: i <= page ? 'on' : '' })); });
    app.appendChild(h('div', { class: 'c-hud' }, [dots, h('button', { class: 'c-ghost c-skip', text: 'skip intel ›', onclick: finishBrief })]));
    var body = h('div', { class: 'c-stack' });
    pages[page].blocks.forEach(function (b) { body.appendChild(block(b)); });
    app.appendChild(body);
    var last = page === pages.length - 1;
    var next = h('button', { class: 'c-btn c-briefnext', text: last ? '> OPEN THE EVIDENCE' : 'NEXT \u203a', onclick: function () { if (last) finishBrief(); else renderBrief(page + 1); } });
    // Last page: the button follows the mission in the page, so it never sits on top of the mission text.
    if (last) body.appendChild(next);
    app.appendChild(defBox);

    // Pinned footer: back, a small sources toggle, NEXT (on the last page, back and sources only).
    var back = h('button', { class: 'c-ghost', text: '‹ back', onclick: function () { renderBrief(page - 1); } });
    if (!page) { back.disabled = true; back.classList.add('c-invisible'); }
    var srcBox = h('div', { class: 'c-srcbox', id: 'c-sources', hidden: true }, [sourcesPanel()]);
    var srcBtn = h('button', { class: 'c-ghost c-srcbtn', 'aria-expanded': 'false', 'aria-controls': 'c-sources', text: 'sources', onclick: function () {
      var open = srcBox.hidden; srcBox.hidden = !open; srcBtn.setAttribute('aria-expanded', String(open));
    } });
    openSourcesHook = function () { srcBox.hidden = false; srcBtn.setAttribute('aria-expanded', 'true'); };
    BE.onLeave(function () { openSourcesHook = null; });
    app.appendChild(pinBar(h('div', { class: 'c-bar c-briefbar' }, [h('div', { class: 'c-bar-in' }, [
      srcBox, back, srcBtn, last ? null : next
    ])])));
  }
  function finishBrief() {
    caseRec().briefed = true; BE.saveProgress();
    startAct1();
  }
  function tone(el, t) { if (t) el.classList.add('t-' + t); return el; }
  function kvList(kv) {
    var dl = h('dl', { class: 'c-kv' });
    kv.forEach(function (r) {
      if (!shown(r)) return;
      dl.appendChild(h('dt', { text: r.k }));
      var dd = withFn(tone(rich(r.v, h('dd', {})), r.tone), r.source);
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
        if (ta && shown(ta)) kv.splice(Math.min(1, kv.length), 0, { k: 'Threat actor', v: ta.v, source: ta.source });
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
        b.items.filter(shown).forEach(function (it) { tl.appendChild(tone(withFn(h('div', {}, [h('b', { text: it.d }), it.t]), it.source), it.tone)); });
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

  /* ---------- Act 1: Investigate ---------- */
  var A = null, E = {};   // Act 1 state and element refs
  function startAct1() {
    var cards = BE.shuffle(C.d.evidence).map(function (e) { return { e: e, done: false }; });
    A = { cards: cards, next: 1, sel: null, placed: [], phase: 'order', mistakes: 0, hints: 0, hinted: {}, startedAt: Date.now(), xp0: C.xp, collapsed: null };
    renderAct1();
  }
  function total() { return C.d.evidence.filter(function (e) { return e.order; }).length; }
  // Unordered group ("anyOrder" on evidence): cards that share a group may fill each other's slots, in either order,
  // because the sources don't say which came first. Members have consecutive orders (tools/validate checks).
  function fitsNext(e) {
    if (e.order === A.next) return true;
    var want = C.d.evidence.filter(function (x) { return x.order === A.next; })[0];
    return !!(e.order && e.anyOrder && want && want.anyOrder === e.anyOrder);
  }

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
      h('p', { class: 'c-small', text: 'Tip: double-click a card (or press Enter) to add it to the timeline.' }),
      h('p', { class: 'c-small', text: 'Keys: A add to timeline \u00b7 X not related \u00b7 H hint. Tap a dotted word to see what it means.' }),
      h('div', { class: 'c-toggles' }, [voiceToggle(), BE.soundToggle(), BE.themeToggle(false)])
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
    E.inspectSlot = h('div', { class: 'c-inspectslot' });
    var board = h('div', { class: 'c-board' }, [
      h('div', { class: 'c-hud' }, [h('span', {}, ['> timeline ', E.count]), E.fold]),
      E.slots, E.toast, E.inspectSlot, defBox
    ]);

    // Right: the evidence grid scrolls inside its own panel.
    E.left = h('span', {});
    E.grid = h('div', { class: 'c-grid', role: 'group', 'aria-label': 'Evidence cards' });
    E.inspect = h('div', { class: 'c-inspect c-tsurf', hidden: true });
    var gridWrap = h('div', { class: 'c-gridwrap' }, [E.grid]);
    E.deck = h('div', { class: 'c-deck' }, [
      h('div', { class: 'c-hud' }, [h('span', { text: '> ls ./evidence' }), E.left]),
      gridWrap, scrollCue(gridWrap, 'more evidence'),
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
    app.appendChild(pinBar(E.bar));
    // The log preview: under the evidence on phones; on desktop in the timeline column, so opening it never resizes the
    // evidence grid under the pointer (a double-click then lands on the same card twice).
    var wideMq = window.matchMedia('(min-width: 900px)');
    function placeInspect() { (wideMq.matches ? E.inspectSlot : E.deck).appendChild(E.inspect); }
    placeInspect();
    if (wideMq.addEventListener) { wideMq.addEventListener('change', placeInspect); BE.onLeave(function () { wideMq.removeEventListener('change', placeInspect); }); }
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
        click: function () {
          // Desktop double-click: two mouse clicks on the same card within 400 ms add it, exactly like a drop on the timeline.
          // (Timed per card, because each click redraws the grid.) Touch keeps tap-to-select + "add to timeline".
          var now = Date.now();
          if (lastPointer === 'mouse' && dbl.id === c.e.id && now - dbl.t < 400) { dbl = {}; A.sel = c; place(); refocus(c); return; }
          dbl = { id: c.e.id, t: now };
          select(c);
        },
        targets: function () { return [E.slots, E.add, E.nr]; },
        drop: function (t) {
          A.sel = c;
          var kind = t && t.getAttribute('data-drop');
          if (kind === 'timeline' && A.placed.length < total()) place();
          else if (kind === 'nr') dismiss();
          else { drawAct1(); restart(c.el, 'c-shake'); }   // dropped nowhere: wobble back, stay selected
        }
      });
      b.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || A.phase !== 'order' || e.altKey || e.ctrlKey || e.metaKey) return;
        e.preventDefault();          // Enter adds the card (Space still just selects it)
        A.sel = c; place(); refocus(c);
      });
      E.grid.appendChild(b);
    });
    var left = A.cards.filter(function (c) { return !c.done; }).length;
    E.left.textContent = left + ' left';
    drawInspect();
    // Timeline full: only Not related stays active while cards remain; add and hint are off and the step counter stops.
    var full = A.placed.length >= total();
    var hk = String(A.next), hasHint = A.phase === 'order' && !full && C.d.act1.hints && C.d.act1.hints[hk];
    E.add.disabled = A.phase === 'order' && full;
    E.hint.disabled = !hasHint || !!A.hinted[hk];
    E.hint.textContent = '';
    E.hint.appendChild(h('span', { text: full ? '? hint' : A.hinted[hk] ? 'hint used' : '? hint' }));
    E.hint.appendChild(h('span', { class: 'c-small', text: full ? 'timeline complete' : 'step ' + pad(A.next, 2) + (A.hinted[hk] ? '' : ' \u00b7 ' + C.d.act1.scoring.hint + ' XP') }));
    E.bar.hidden = A.phase !== 'order';
    // Highlight Not related once the timeline is full and only red herrings are left.
    E.nr.classList.toggle('c-call', A.phase === 'order' && A.placed.length === total() && A.cards.some(function (c) { return !c.done; }));
    E.main.classList.toggle('c-solo', A.phase !== 'order');
    app.classList.toggle('c-readscreen', A.phase !== 'order');   // patient zero + debrief: the reading width
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
    if (E.inspect.parentNode === E.inspectSlot) E.inspect.scrollIntoView({ block: 'nearest' });   // desktop: scrolls the timeline column only
  }
  var dbl = {}, lastPointer = 'mouse';
  document.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType || 'mouse'; }, true);
  // After a keyboard or double-click add, keep focus in the evidence grid.
  function refocus(c) {
    if (A.phase !== 'order') return;
    var el = c.el && c.el.isConnected && !c.done ? c.el : E.grid.querySelector('.c-card');
    if (el) el.focus({ preventScroll: true });
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
    if (A.phase !== 'order' || A.placed.length >= total()) return;   // full timeline: only Not related is left
    if (needSel()) return;
    var c = A.sel, s = C.d.act1.scoring, w = C.d.act1.wrongLines;
    if (fitsNext(c.e)) {
      c.done = true; A.placed.push(c); A.next++; A.sel = null;
      addXP(s.place); BE.sound('blip'); toast('+' + s.place + ' XP \u00b7 sequence valid', true);
      afterMove();
    } else if (!c.e.order) wrong(w.decoy, c.el);
    else wrong(w.early, c.el);
  }
  function dismiss() {
    if (A.phase !== 'order' || needSel()) return;
    var c = A.sel, s = C.d.act1.scoring;
    if (!c.e.order) {
      c.done = true; A.sel = null;
      addXP(s.dismiss); BE.sound('blip'); toast('+' + s.dismiss + ' XP \u00b7 red herring dismissed', true);
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
    var leftN = A.cards.filter(function (c) { return !c.done; }).length;
    if (A.placed.length === total() && leftN) {
      E.toast.appendChild(h('span', { class: 'c-voice c-callmsg', text: fmt(C.d.act1.herringsLeft || 'Timeline complete. {n} {cards} left: mark {them} Not related to close the case.',
        { n: leftN, cards: leftN > 1 ? 'cards' : 'card', them: leftN > 1 ? 'them' : 'it' }) }));
    }
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
    addXP(s.patientZero); BE.sound('blip'); toast('+' + s.patientZero + ' XP \u00b7 patient zero identified', true, 'patientZero');
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
    box.appendChild(h('div', { class: 'c-stats c-a1stats' }, [
      stat('XP earned', String(A.gained)),
      stat('mistakes', pad(A.mistakes, 2), A.mistakes ? 'y' : ''),
      stat('hints used', pad(A.hints, 2), A.hints ? 'y' : ''),
      stat('time', mm + ':' + (ss < 10 ? '0' : '') + ss)
    ]));
    var tl = h('ol', { class: 'c-reveal' });
    d.timeline.filter(shown).forEach(function (t) {
      var li = h('li', {}, [
        h('div', { class: 'c-hud' }, [h('b', { text: 'STAGE ' + t.stage + (t.date ? ' \u00b7 ' + t.date.toUpperCase() : '') }),
          h('span', { class: 'c-chips' }, (t.mitre || []).map(function (m) { return h('span', { class: 'c-chip', text: m }); }))]),
        withFn(para(t.text), t.source),
        h('p', { class: 'c-why' }, [h('span', { class: 't-g', text: 'why it worked: ' }), rich(t.why)])
      ]);
      tl.appendChild(li);
    });
    box.appendChild(panel('', [eyebrow('The real timeline'), tl]));

    box.appendChild(panel('hl', [eyebrow('Next \u00b7 Act 2'), para(d.rewind)]));
    box.appendChild(h('button', { class: 'c-btn', text: d.act2.rewindButton, onclick: startAct2 }));
    box.appendChild(h('button', { class: 'c-ghost c-wide', text: './replay --act 1', onclick: function () { C.xp = 0; startAct1(); } }));
    box.appendChild(sourcesPanel());
    box.scrollIntoView({ behavior: BE.reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  function stat(label, v, t) { return h('div', { class: 'c-stat' }, [h('span', { class: 'c-small', text: label }), tone(h('span', { class: 'c-v', text: v }), t)]); }

  /* ---------- Act 2: Defend (defense map + control deck + replay) ----------
     Everything comes from the level JSON: map zones and stages, the hidden asset, controls (cost, stage, effect, friction, why),
     budget, outcomes, tips and log lines.
     Effects: block | detect | recover | reveal | decoy. Layers: block = prevent, detect = detect, recover = recover.
     Hidden asset (map.hidden): the door the real attack uses at its stage. It isn't in the defender's inventory until a
     "reveal" (discovery) control is deployed. A block control on that stage stops the attack only if it covers the asset:
     controls with needs:"reveal" always do (they can only be deployed once it's found); others only with coversHidden:true
     once the asset is revealed. Anything else there is "scoped": it covers known assets only.
     Stages can be "unblockable" (it happens outside the defender's network: ATTEMPTED) or "impact" (the victim's own
     defensive decision, e.g. a shutdown: IMPACT, never BREACHED). "reach" and "severity" on a stage build the damage line. */
  var B = null, F = {};   // Act 2 state (the build survives "try another build") and element refs
  var SEV = ['none', 'contained', 'severe', 'critical'];
  var DAMAGE_SCALE = [
    ['NONE', 'stopped at entry'],
    ['CONTAINED', 'in, but stopped before data or systems were hit'],
    ['SEVERE', 'data stolen or systems encrypted'],
    ['CRITICAL', 'operations halted']
  ];
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
  function hidden() { return C.d.map.hidden || null; }
  function revealed() { return deployed().some(function (c) { return c.effect === 'reveal'; }); }
  function locked(c) { return c.needs === 'reveal' && !revealed(); }
  function layerOf(c) { return { block: 'prevent', detect: 'detect', recover: 'recover', reveal: 'discovery', decoy: 'decoy' }[c.effect] || c.effect; }

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
    var helpBox = h('div', { class: 'c-helpbox', id: 'c-help2', hidden: true }, [para(a2.help), scaleHelp(), h('div', { class: 'c-toggles' }, [voiceToggle(), BE.soundToggle(), BE.themeToggle(false)])]);
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
    F.log = h('div', { class: 'c-log c-tsurf', role: 'log', 'aria-label': 'Attack log', 'aria-live': 'polite' });
    F.deck = h('div', { class: 'c-ctlgrid', role: 'group', 'aria-label': 'Control deck' });
    F.count = h('span', {});
    var mapBox = F.mapBox = h('div', { class: 'c-a2map' }, [h('div', { class: 'c-hud' }, [h('span', { text: a2.mapCmd || '> map ./network' }), h('span', { class: 'c-small', text: 'drop controls on a stage' })]), F.map]);
    var deckWrap = h('div', { class: 'c-gridwrap' }, [F.deck]);
    var deckBox = h('div', { class: 'c-deck c-a2deck' }, [h('div', { class: 'c-hud' }, [h('span', { text: '> ls ./controls' }), F.count]), deckWrap, scrollCue(deckWrap, 'more controls')]);
    var mapCol = h('div', { class: 'c-a2mapcol' }, [mapBox, scrollCue(mapBox, 'more stages')]);
    F.main = h('div', { class: 'c-a2' }, [mapCol, F.log, deckBox]);
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
    app.appendChild(pinBar(h('div', { class: 'c-bar c-a2bar', role: 'toolbar', 'aria-label': 'Build actions' }, [h('div', { class: 'c-bar-in' }, [F.status, F.clear, F.run])])));

    F.log.appendChild(h('div', {}, [a2.logs.idle, h('span', { class: 'c-blink', text: '_' })]));
    threat(0);
    drawAct2();
  }

  // "?" panel: how stars work and what each damage label means.
  function scaleHelp() {
    var st = C.d.stars || {};
    var dl = h('dl', { class: 'c-kv c-scale' });
    DAMAGE_SCALE.forEach(function (d) { dl.appendChild(h('dt', { text: d[0] })); dl.appendChild(h('dd', { text: d[1] })); });
    return h('div', { class: 'c-stack' }, [
      h('p', { class: 'c-small', text: 'Stars:' }),
      h('ul', { class: 'c-starrules' }, [['\u2605', st.one], ['\u2605\u2605', st.two], ['\u2605\u2605\u2605', st.three]].map(function (x) {
        return h('li', { class: 'c-small' }, [h('span', { class: 't-g', text: x[0] + ' ' }), x[1] || '']);
      })),
      h('p', { class: 'c-small', text: 'Damage scale (what the attacker reached):' }),
      dl
    ]);
  }

  function drawAct2() { drawMap(); drawDeck(); drawBudget(); }

  function drawMap() {
    var links = C.d.map.links || {}, hid = hidden(), rev = revealed();
    F.map.textContent = ''; F.nodes = {};
    C.d.map.zones.forEach(function (z) {
      var wrap = tone(h('div', { class: 'c-zone c-mzone' }, [h('span', { class: 'c-zt', text: z.name })]), z.tone);
      var list = C.d.map.stages.filter(function (s) { return s.zone === z.id; });
      list.forEach(function (s, i) {
        var chips = deployed().filter(function (c) { return c.stage === s.n && c.effect !== 'reveal'; }).map(function (c) { return rich(c.name, h('span', { class: 'c-chip' }), false); });
        var codes = h('span', { class: 'c-chips' }, stageCodes(s.n).map(function (m) { return h('span', { class: 'c-mt', text: m }); }));
        var node = h('div', { class: 'c-node', 'data-drop': 'stage', 'data-n': String(s.n), 'data-zone': z.id }, [
          h('div', { class: 'c-ntop' }, [h('span', { class: 'c-nname' }, [h('b', { class: 'c-nn', text: s.n + ' · ' }), rich(s.name, null, false)]), codes]),
          chips.length ? h('div', { class: 'c-chips c-nchips' }, chips) : null
        ]);
        F.nodes[s.n] = node;
        wrap.appendChild(node);
        // A discovered asset appears under its stage.
        if (hid && rev && s.n === hid.stage) wrap.appendChild(h('div', { class: 'c-asset' }, [h('span', { class: 'c-pill o', text: 'FOUND' }), rich(hid.name, h('span', {}), false)]));
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
      var on = B.on.indexOf(c.id) >= 0, z = ctlZone(c), lock = locked(c);
      var b = h('button', { class: 'c-ctl' + (on ? ' on' : '') + (lock ? ' locked' : ''), 'aria-pressed': String(on),
        'aria-label': plain(c.name) + '. ' + (c.scope ? 'Scoped to ' + c.scope + ' only; goes on stage ' + c.stage + '.' : 'Protects the ' + (z.short || z.name).toLowerCase() + '.') +
          ' Costs ' + c.cost + '.' + (lock ? ' Needs discovery first.' : '') }, [
        // Desktop: zone label and cost share the top row (the cost row below is hidden) so the whole deck fits on one screen.
        h('span', { class: 'c-ztop' }, [h('span', { class: 'c-z', text: zoneLabel(c, z) }),
          h('span', { class: 'c-costtop', 'aria-hidden': 'true' }, [bars(c.cost), h('span', { class: 'c-small', text: String(c.cost) })])]),
        h('span', { class: 'c-cname' }, [on ? '✓ ' : '', rich(c.name, null, false)]),
        lock ? h('span', { class: 'c-small', text: 'needs discovery first' }) : null,
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
  // Card label: the zone the control protects. A scoped control (scope in the JSON) names its real scope instead,
  // e.g. "PRODUCTION TENANT · SCOPED", so the trap reads as a policy boundary, not a typo. Placement rules are unchanged.
  function zoneLabel(c, z) {
    if (c.scope) return c.scope.toUpperCase() + ' \u00b7 SCOPED';
    return (z.short || z.name) + (c.effect === 'reveal' ? ' \u00b7 DISCOVERY' : '');
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
    return line;
  }
  function toggle(c) {
    if (B.running) return;
    var logs = C.d.act2.logs, i = B.on.indexOf(c.id), hid = hidden();
    if (i >= 0) {
      B.on.splice(i, 1); say('k', fmt(logs.removed, { name: c.name }));
      // Losing the last discovery control also drops the controls that depend on it.
      if (c.effect === 'reveal' && !revealed()) {
        deployed().filter(function (d) { return d.needs === 'reveal'; }).forEach(function (d) {
          B.on.splice(B.on.indexOf(d.id), 1); logLine('k', fmt(logs.removed, { name: d.name }), logs.removedDeps);
        });
      }
    }
    else if (locked(c)) { say('red', fmt(logs.locked, { name: c.name })); restart(F.status, 'c-shake'); return; }
    else if (c.cost > left()) { overBudget(c); return; }
    else {
      var wasRevealed = revealed();
      B.on.push(c.id); BE.sound('blip');
      say('k', fmt(c.effect === 'reveal' ? logs.deployedReveal : logs.deployed, { name: c.name, n: c.stage }));
      if (c.effect === 'reveal' && !wasRevealed && hid) logLine('k', fmt(logs.revealed, { asset: hid.name }), c.why);
    }
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
      var lg = C.d.act2.logs;
      say('red', c.scope && lg.wrongZoneScoped ? fmt(lg.wrongZoneScoped, { name: c.name, scope: c.scope, n: c.stage })
        : fmt(lg.wrongZone, { name: c.name, zone: (z.short || z.name).toLowerCase() }));
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
    var on = deployed(), hid = hidden(), rev = revealed();
    var out = { steps: [], blocked: 0, detected: false, viaHidden: false, unknown: false };
    C.d.map.stages.forEach(function (s) {
      if (out.blocked) return;
      var here = on.filter(function (c) { return c.stage === s.n; });
      var blocks = here.filter(function (c) { return c.effect === 'block'; });
      var st = {
        s: s, scoped: [],
        decoys: here.filter(function (c) { return c.effect === 'decoy'; }),
        detect: here.filter(function (c) { return c.effect === 'detect'; })[0],
        recover: here.filter(function (c) { return c.effect === 'recover'; })[0],
        block: blocks[0] || null
      };
      if (hid && s.n === hid.stage) {
        var cover = blocks.filter(function (c) { return c.needs === 'reveal' || (rev && c.coversHidden); });
        st.block = cover[0] || null;
        st.scoped = blocks.filter(function (c) { return cover.indexOf(c) < 0; });
        if (!st.block) { st.viaHidden = true; st.unknown = !rev; out.viaHidden = true; out.unknown = !rev; }
      }
      if (st.detect) out.detected = true;
      if (st.block) out.blocked = s.n;
      out.steps.push(st);
    });
    return out;
  }
  // Stars (rules and wording in the level JSON "stars"): 1 = stopped at any stage; 2 = stopped at the entry stage
  // (act2.preventedMaxStage, damage NONE), which needs the hidden asset discovered; 3 = 2 plus a detect and a recover control.
  // Damage comes only from what the attacker actually reached (detection and recovery don't reduce it).
  function score(res) {
    var a2 = C.d.act2, on = deployed(), total = C.d.map.stages.length, o = a2.outcomes;
    var decoys = on.filter(function (c) { return c.effect === 'decoy'; }).length;
    var fr = on.reduce(function (a, c) { return a + (c.friction || 0); }, 0);
    var r = { decoys: decoys, friction: fr, spent: spent(), total: total };
    var stopper = res.blocked ? res.steps[res.steps.length - 1].block : null;
    var det = on.filter(function (c) { return c.effect === 'detect'; });
    var rec = on.filter(function (c) { return c.effect === 'recover'; });
    r.layers = { prevent: stopper ? [stopper] : [], detect: det, recover: rec };
    r.entry = !!res.blocked && res.blocked <= a2.preventedMaxStage;
    r.stars = !res.blocked ? 0 : !r.entry ? 1 : det.length && rec.length ? 3 : 2;
    if (res.blocked) {
      var oc = res.blocked <= a2.preventedMaxStage ? o.prevented : o.contained;
      r.kind = oc === o.prevented ? 'prevented' : 'contained';
      r.title = oc.title; r.sub = fmt(oc.sub, { n: res.blocked, total: total });
    } else if (res.detected) { r.kind = 'detected'; r.title = o.detected.title; r.sub = o.detected.sub; }
    else { r.kind = 'succeeded'; r.title = o.succeeded.title; r.sub = o.succeeded.sub; }
    var ran = res.steps.filter(function (st) { return !st.block; });
    if (res.blocked && res.blocked <= a2.preventedMaxStage) { r.damage = 'NONE'; r.reach = 'stopped at entry'; }
    else {
      var sev = 1;
      ran.forEach(function (st) { sev = Math.max(sev, Math.max(0, SEV.indexOf(st.s.severity || 'contained'))); });
      r.damage = SEV[sev].toUpperCase();
      r.reach = ran.map(function (st) { return st.s.reach; }).filter(Boolean).join(' · ') || 'inside, nothing reached';
    }
    r.frictionLabel = fr <= a2.friction.low ? 'LOW' : fr <= a2.friction.medium ? 'MED' : 'HIGH';
    r.rank = C.d.ranks[r.stars];
    return r;
  }

  function runAttack() {
    if (B.running) return;
    var a2 = C.d.act2, res = simulate();
    B.running = true; B.alarmed = false; app.classList.add('c-running'); drawBudget();
    lastVoice = null;   // each run is a new outcome, so its results line may repeat the previous run's
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
    st.scoped.forEach(function (c) { logLine('y', fmt(L.scoped, { name: c.name }), c.whyScoped); });
    if (st.detect) { logLine('k', fmt(L.detect, { n: n }), st.detect.why); pill(node, 'y', '! DETECTED'); }
    if (st.recover) logLine('k', fmt(L.recover, { n: n }), st.recover.why);
    if (st.block) {
      node.classList.add('block'); pill(node, 'g', '✓ BLOCKED'); BE.sound('contained');
      logLine('k', fmt(L.block, { n: n }), st.block.why);
      threat(Math.round(n / total * 50));
      return;
    }
    // A stage the defender cannot block (e.g. a spray from outside) is shown as attempted, not breached.
    if (st.s.unblockable) {
      node.classList.add('attempt'); pill(node, 'y', '⚠ ATTEMPTED');
      logLine('y', fmt(L.attempted, { n: n, stage: st.s.name }));
      threat(Math.round(n / total * 100));
      return;
    }
    // The victim's own defensive decision (e.g. shutting operations down): IMPACT, neutral, never BREACHED.
    if (st.s.impact) {
      node.classList.add('impact'); pill(node, 'o', '◆ IMPACT');
      logLine('b', fmt(L.impact, { n: n, stage: st.s.name }), st.s.impactNote);
      threat(Math.round(n / total * 100));
      return;
    }
    // A stage that ran but didn't let the attacker in yet (map stage "neutral", e.g. Uber's approval requests, which at
    // first blocked access): neutral pill with the stage's own label and sourced note, never BREACHED.
    if (st.s.neutral) {
      node.classList.add('neutral'); pill(node, 'y', '\u26a0 ' + st.s.neutral.label);
      withFn(logLine('b', '[~] stage ' + n + ' \u00b7 ' + st.s.name + ':', st.s.neutral.note), st.s.neutral.source);
      threat(Math.round(n / total * 100));
      return;
    }
    if (st.viaHidden) logLine('red', st.unknown ? L.viaUnknown : L.viaKnown);
    node.classList.add('breach'); pill(node, 'r', '✕ BREACHED');
    if (!B.alarmed) { B.alarmed = true; BE.sound('alarm'); }   // once per run
    logLine('red', fmt(L.breach, { n: n, stage: st.s.name }));
    flash(); restart(node, 'c-glitch');
    threat(Math.round(n / total * 100));
  }
  function stopRun() {
    if (B && B.timer) { clearTimeout(B.timer); B.timer = null; }
    if (B) B.running = false;
  }
  function finishRun(res) {
    stopRun();
    var r = score(res), rec = caseRec(), prev = rec.act2 || {};
    // Reduced motion skips the replay, so the outcome sound plays with the results instead.
    if (BE.reduceMotion()) BE.sound(res.blocked ? 'contained' : 'alarm');
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
    var a2 = C.d.act2, d = C.d, total = r.total, hid = hidden(), T = a2.tips;
    frame('DEBRIEF');
    app.classList.add('c-resscreen');
    var good = !!res.blocked;
    var newBest = prevBest == null || r.stars > prevBest;
    app.appendChild(panel((good ? 'hl' : 'danger') + ' c-rescard', [
      eyebrow('Case ' + d.caseNo + ' · Debrief'),
      h('h1', { class: 'c-display' + (good ? '' : ' t-red'), text: r.title }),
      para(r.sub),
      voiceP(voiceLine(r.damage === 'NONE' ? 'prevented' : r.damage === 'CONTAINED' ? 'contained' : 'breached')),   // matches the damage label
      starRow(r.stars),
      r.stars < 3 ? h('p', { class: 'c-small c-nextstar', text: (d.stars || {})[['nextOne', 'nextTwo', 'nextThree'][r.stars]] || '' }) : null,
      h('span', { class: 'c-pill ' + (good ? 'g' : 'r'), text: 'CLEARANCE · ' + r.rank }),
      h('p', { class: 'c-small', text: newBest ? 'New best for this case.' : 'Best so far: ' + caseRec().act2.bestStars + '/3 stars.' })
    ]));
    var dmgTone = r.damage === 'NONE' ? '' : r.damage === 'CONTAINED' ? 'b' : 'red';
    app.appendChild(h('div', { class: 'c-stats c-resstats' }, [
      h('div', { class: 'c-stat c-span2' }, [h('span', { class: 'c-small', text: 'damage' }), tone(h('span', { class: 'c-v', text: r.damage }), dmgTone),
        h('span', { class: 'c-small c-reach', text: r.reach })]),
      stat('budget used', pad(r.spent, 2) + '/' + d.budget),
      stat('user friction', r.frictionLabel, r.frictionLabel === 'LOW' ? '' : 'y'),
      stat('decoys bought', pad(r.decoys, 2), r.decoys ? 'y' : '')
    ]));

    // Defense layers the build had: prevent / detect / recover.
    var layers = h('ul', { class: 'c-buildlist c-layers' });
    [['prevent', 'stops the attack'], ['detect', 'notices the attack if prevention fails'], ['recover', 'a way back after an attack']].forEach(function (ly) {
      var list = r.layers[ly[0]], has = list.length > 0;
      layers.appendChild(h('li', { class: has ? 'on' : '' }, [
        h('div', { class: 'c-hud' }, [h('b', { text: ly[0].toUpperCase() }), h('span', { class: 'c-pill ' + (has ? 'g' : 'm'), text: has ? '✓ IN BUILD' : '— MISSING' })]),
        h('p', { class: 'c-why' }, has ? [list.map(function (c) { return plain(c.name) + ' (stage ' + c.stage + ')'; }).join(' · ')] : [ly[1]])
      ]));
    });
    app.appendChild(panel('', [eyebrow('Defense layers'), layers]));

    var tips = [];
    if (!res.blocked) tips.push(['k', tipText(T.notStopped)]);
    if (res.unknown) tips.push(['k', tipText(T.unknownAsset)]);
    if (res.blocked && !r.entry) tips.push(['k', tipText(T.notEntry)]);
    if (r.stars === 2) tips.push(['k', tipText(T.needLayers)]);
    if (r.decoys) tips.push(['y', fmt(tipText(T.decoys), { n: r.decoys })]);
    if (r.frictionLabel === 'HIGH') tips.push(['y', tipText(T.friction)]);
    [].concat(T.always || []).forEach(function (x) { tips.push(['k', tipText(x), x && x.source]); });   // one tip or a list
    var tipBox = h('div', { class: 'c-log c-tips' });
    tips.filter(function (t) { return t[1]; }).forEach(function (t) { tipBox.appendChild(withFn(h('div', {}, [h('span', { class: 't-' + t[0], text: '> ' }), rich(t[1], null, false)]), t[2])); });
    app.appendChild(panel('', [eyebrow('Tips'), tipBox]));

    // Stage by stage: the same results the replay animated (and the only view with reduced motion).
    var list = h('ol', { class: 'c-replay' });
    res.steps.forEach(function (st) {
      var n = st.s.n, kind = st.block ? 'block' : st.s.unblockable ? 'attempt' : st.s.impact ? 'impact' : st.s.neutral ? 'neutral' : 'breach';
      var li = h('li', { class: kind }, [
        h('div', { class: 'c-hud' }, [h('b', {}, [n + ' · ', rich(st.s.name, null, false)]),
          h('span', { class: 'c-pill ' + { block: 'g', attempt: 'y', impact: 'o', neutral: 'y', breach: 'r' }[kind],
            text: { block: '✓ BLOCKED', attempt: '⚠ ATTEMPTED', impact: '◆ IMPACT', neutral: '\u26a0 ' + (st.s.neutral && st.s.neutral.label), breach: '✕ BREACHED' }[kind] })])
      ]);
      if (kind === 'neutral') li.appendChild(withFn(h('p', { class: 'c-why', text: st.s.neutral.note }), st.s.neutral.source));
      if (kind === 'attempt' && a2.attemptedNote) li.appendChild(h('p', { class: 'c-why', text: a2.attemptedNote }));
      if (kind === 'impact' && st.s.impactNote) li.appendChild(h('p', { class: 'c-why', text: st.s.impactNote }));
      st.decoys.forEach(function (c) { li.appendChild(h('p', { class: 'c-why' }, [h('span', { class: 't-y', text: '[~] ' }), rich(c.name, null, false), ': no effect. ', rich(c.why, null, false)])); });
      st.scoped.forEach(function (c) { li.appendChild(h('p', { class: 'c-why' }, [h('span', { class: 't-y', text: '[~] ' }), rich(c.name, null, false), ': ', rich(c.whyScoped, null, false)])); });
      if (st.viaHidden && hid) li.appendChild(h('p', { class: 'c-why' }, [h('span', { class: 't-red', text: '[!] ' }),
        (st.unknown ? 'Entered via an asset not in your inventory: ' : 'Entered via a known but unprotected asset: '), rich(hid.name, null, false), '.']));
      [['detect', 'detected at stage ' + n + ' by '], ['recover', 'recovery ready at stage ' + n + ': '], ['block', 'blocked by ']].forEach(function (k) {
        var c = st[k[0]]; if (c) li.appendChild(h('p', { class: 'c-why' }, [h('span', { class: 't-g', text: '[+] ' + k[1] }), rich(c.name, null, false), ': ', rich(c.why, null, false)]));
      });
      list.appendChild(li);
    });
    if (!res.blocked) list.appendChild(h('li', { class: 'breach' }, [h('p', { class: 'c-why' }, ['Attack completed: all ' + total + ' stages ran.'])]));
    app.appendChild(panel('', [eyebrow('Replay · stage by stage'), list]));

    // The build, with what each control actually did and the lesson behind it.
    var build = h('ul', { class: 'c-buildlist' });
    deployed().forEach(function (c) {
      build.appendChild(h('li', {}, [
        h('div', { class: 'c-hud' }, [rich(c.name, h('b', {}), false), h('span', { class: 'c-pill ' + (c.effect === 'decoy' ? 'y' : 'o'), text: layerOf(c).toUpperCase() })]),
        withFn(h('p', { class: 'c-why' }, [rich(c.why, null, false), c.teach ? ' ' + c.teach : '']), c.source)
      ]));
    });
    if (!B.on.length) build.appendChild(h('li', {}, [h('p', { class: 'c-why', text: 'No controls deployed.' })]));
    app.appendChild(panel('', [eyebrow('Your build · ' + B.on.length + ' controls'), build]));

    app.appendChild(h('button', { class: 'c-btn', text: '> TRY ANOTHER BUILD', onclick: startAct2 }));
    app.appendChild(h('button', { class: 'c-ghost c-wide', text: './restart --case ' + d.caseNo, onclick: restartCase }));
    app.appendChild(sourcesPanel());
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

  window.BreachCase = { start: start, caseData: loadCase, voiceToggle: voiceToggle, backdrop: function (theme) { enterTerminal(theme); BE.onLeave(endDrag); } };
})();
