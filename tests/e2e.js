/* Breach Escape end-to-end suite (Playwright, pre-installed in the dev environment; not a project dependency).
   Run:  node tests/serve.js public 8765 &   then   node tests/e2e.js <screenshot-dir>
   Filters: ONLY=<1280x720|1920x1080|390x844|none>  CASE=<case-id>. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:8765/';
const path = require('path');
const REPO = path.join(__dirname, '..', 'public') + '/';   // the deployed folder
const SHOTS = process.argv[2] || require('os').tmpdir();
const CASES = [
  { id: 'midnight-blizzard', level: 1,
    locked: 'testmfa',
    runs: [
      { kind: 'succeeded', ids: ['caprod'], stars: 0, damage: 'SEVERE' },
      { kind: 'prevented', ids: ['inventory', 'testmfa'], stars: 2, damage: 'NONE' },
      { kind: 'prevented', ids: ['inventory', 'testmfa', 'ews', 'runbook'], stars: 3, damage: 'NONE' },
      { kind: 'contained', ids: ['consent', 'ews'], stars: 1, damage: 'CONTAINED' },
      { kind: 'detected', ids: ['idp'], stars: 0, damage: 'SEVERE' },
      { kind: 'contained', ids: ['appperms'], stars: 1, damage: 'CONTAINED' }
    ] },
  { id: 'colonial-pipeline', level: 2,
    locked: 'disable',
    runs: [
      { kind: 'succeeded', ids: ['mfa'], stars: 0, damage: 'CRITICAL' },
      { kind: 'prevented', ids: ['audit', 'disable'], stars: 2, damage: 'NONE' },
      { kind: 'prevented', ids: ['audit', 'disable', 'irp', 'backup'], stars: 3, damage: 'NONE' },
      { kind: 'contained', ids: ['seg'], stars: 1, damage: 'SEVERE' },
      { kind: 'detected', ids: ['irp'], stars: 0, damage: 'CRITICAL' }
    ] },
  { id: 'uber-2022', level: 3,
    locked: 'nmext',
    runs: [
      { kind: 'succeeded', ids: ['nmemp'], stars: 0, damage: 'SEVERE' },
      { kind: 'prevented', ids: ['audit', 'nmext'], stars: 2, damage: 'NONE' },
      { kind: 'prevented', ids: ['audit', 'nmext', 'train', 'rotate'], stars: 3, damage: 'NONE' },
      { kind: 'prevented', ids: ['audit', 'managed', 'mfaalert'], stars: 2, damage: 'NONE', drag: true },
      { kind: 'detected', ids: ['mfaalert'], stars: 0, damage: 'SEVERE' }
    ] }
];
const THEMES = { 'colonial-pipeline': 'amber', 'uber-2022': 'violet' };
const IMPACT_STAGE = { 'colonial-pipeline': 6, 'uber-2022': 7 };
const TITLES = { prevented: 'Breach prevented', contained: 'Breach contained', detected: 'Breach detected', succeeded: 'Breach succeeded' };
const VIEWS = [{ name: '1280x720', vp: { width: 1280, height: 720 } }, { name: '1920x1080', vp: { width: 1920, height: 1080 } }, { name: '390x844', phone: true }];
const problems = [];
let sampler = null;
const bad = (m) => { problems.push(m); console.log('  FAIL', m); };

// Contrast of every visible text node against its first opaque ancestor background.
const CONTRAST = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let b = { r: 1, g: 6, b: 3, a: 1 }; for (let i = layers.length - 1; i >= 0; i--) b = blend(layers[i], b); return b; };
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const t = w.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement, cs = getComputedStyle(el);
    if (el.closest('[hidden],[aria-hidden="true"]') || cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    if (op < 0.5) continue;   // lifted drag source
    const fg = parse(cs.color), bg = bgOf(el), f = blend(fg, bg);
    const L1 = lum(f), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 4.5) out.push(ratio.toFixed(2) + ' "' + t.textContent.trim().slice(0, 40) + '" ' + cs.color + ' on ' + JSON.stringify(bg));
  }
  return out;
};

async function run(view, c, browser) {
  const ctxOpts = view.phone ? { ...devices['iPhone 13'] } : { viewport: view.vp, deviceScaleFactor: 1 };
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const tag = view.name + ' ' + c.id;
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('request', (r) => { if (!r.url().startsWith(BASE)) errors.push('outside request: ' + r.url()); });
  // 1280x720: Math.random() = 0, so the evidence shuffle is deterministic and puts the first real card last, below the
  // evidence panel's fold (the worst case for the drag test). Other sizes keep a real shuffle.
  if (view.name === '1280x720') await page.addInitScript(() => { Math.random = () => 0; });
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  const data = JSON.parse(fs.readFileSync(REPO + 'levels/' + c.id + '.json'));
  const desktop = !view.phone;
  const checkFit = async (where) => {
    const s = await page.evaluate(() => ({ sh: document.scrollingElement.scrollHeight, ih: innerHeight, sw: document.scrollingElement.scrollWidth, iw: innerWidth }));
    if (s.sw > s.iw) bad(tag + ' ' + where + ': horizontal scroll ' + s.sw + '>' + s.iw);
    if (desktop && s.sh > s.ih) bad(tag + ' ' + where + ': page scrolls ' + s.sh + '>' + s.ih);
  };
  const contrast = async (where) => { const f = await page.evaluate(CONTRAST); f.slice(0, 5).forEach((x) => bad(tag + ' ' + where + ' contrast ' + x)); };
  // Scroll to the very end and sample the bottom rows of pixels: they must be the dark base, never the old blue gradient.
  const bottomCheck = async (where) => {
    await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
    await page.waitForTimeout(100);
    const buf = await page.screenshot();
    const px = await sampler.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, img.height - 6, img.width, 6).data; let worst = 0;
      for (let i = 0; i < d.length; i += 4) worst = Math.max(worst, d[i + 2] - Math.max(d[i], d[i + 1]));
      return worst;
    }, buf.toString('base64'));
    if (px > 12) bad(tag + ' ' + where + ' bluish pixels at the bottom (' + px + ')');
    await page.evaluate(() => window.scrollTo(0, 0));
  };
  // The pinned bottom bar never covers content: scrolled to the end, every screen block ends above the bar.
  const barCheck = async (where) => {
    const r = await page.evaluate(() => {
      const bar = [...document.querySelectorAll('#app > .c-bar')].find((b) => !b.hidden); if (!bar) return null;
      window.scrollTo(0, document.scrollingElement.scrollHeight);
      const top = bar.getBoundingClientRect().top;
      const worst = [...document.querySelectorAll('#app > *')].filter((e) => e !== bar && !e.hidden && e.getBoundingClientRect().height)
        .map((e) => [Math.round(e.getBoundingClientRect().bottom - top), e.className]).sort((a, b) => b[0] - a[0])[0];
      window.scrollTo(0, 0);
      return worst;
    });
    if (r && r[0] > 1) bad(tag + ' ' + where + ': bottom bar covers ' + r[1] + ' by ' + r[0] + 'px');
  };
  const theme = async (where) => {
    const t = await page.evaluate(() => ({ a: document.documentElement.getAttribute('data-theme'), rain: (document.querySelector('.c-rain') || {}).hidden }));
    const want = THEMES[c.id] || null;
    if (t.a !== want) bad(tag + ' ' + where + ' theme ' + t.a);
    if (want === 'amber' && t.rain === false) bad(tag + ' amber shows code rain');
  };
  const shot = (n) => page.screenshot({ path: SHOTS + '/' + view.name + '-' + c.id + '-' + n + '.png' });

  await page.goto(BASE);
  await page.waitForSelector('.c-case');
  // splash: terminal login, then K-E-P-T typed one by one, tagline, 3.5 s hold; once per session, one label, skip button
  if (!(await page.locator('.c-splash').count())) bad(tag + ' no splash on first load');
  else {
    const lbl = await page.getAttribute('.c-spl-art', 'aria-label');
    if (lbl !== 'KEPT Academy \u2014 Know the Exposure, Patch the Threat') bad(tag + ' splash label ' + lbl);
    if (!(await page.locator('.c-spl-skip').count())) bad(tag + ' no skip button');
    if ((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) !== 'brand') bad(tag + ' splash not brand theme');
    if (c.level === 1) {
      await page.waitForSelector('.c-spl-out >> text=real breaches loaded', { timeout: 5000 });
      const out = await page.textContent('.c-spl-term');
      if (!out.includes('[ok] 3 real breaches loaded')) bad(tag + ' splash load line: ' + out);
      if (view.name === '1280x720') await contrast('splash');
      if (await page.locator('.c-spl-logo').isVisible()) bad(tag + ' KEPT logo visible while the commands type');
      await shot('0splash');
      await page.waitForSelector('.c-spl-logo:not([hidden])', { timeout: 5000 });
      if (await page.locator('.c-spl-term').isVisible()) bad(tag + ' terminal still visible with the logo');
      // K, E, P, T appear one at a time
      const seen = await page.evaluate(() => new Promise((res) => {
        const el = document.querySelector('.c-spl-kept'), got = [];
        const iv = setInterval(() => { const t = el.textContent; if (got[got.length - 1] !== t) got.push(t); if (t === 'KEPT') { clearInterval(iv); res(got); } }, 30);
        setTimeout(() => { clearInterval(iv); res(got); }, 4000);
      }));
      if (seen[seen.length - 1] !== 'KEPT' || !seen.includes('K') || !seen.includes('KEP')) bad(tag + ' KEPT not typed letter by letter: ' + seen.join('|'));
      await page.waitForSelector('.c-spl-tagrow.on', { timeout: 3000 });
      const shown = Date.now();
      await page.waitForTimeout(600);
      if (view.name === '1280x720') await contrast('splash-final');
      await shot('0splash-logo');
      await page.waitForSelector('.c-splash', { state: 'detached', timeout: 7000 }).catch(() => {});
      const held = Date.now() - shown;
      if (held < 3400) bad(tag + ' final KEPT screen held only ' + held + ' ms');
    } else if (c.level === 2 && view.phone) { await page.click('.c-spl-skip'); }
    else { await page.keyboard.press('Space'); }
    if (await page.locator('.c-splash').count()) bad(tag + ' splash still there');
  }
  const names = await page.$$eval('.c-ctitle', (e) => e.map((x) => x.textContent));
  if (names[0] !== 'The Forgotten Test Account' || names[1] !== 'The Legacy VPN' || names.length !== 7) bad(tag + ' map names ' + names.slice(0, 2));
  // Map: one-line header, hero NEXT CASE = case 01 on a first visit (the only highlight), ALL CASES list
  const head = await page.evaluate(() => ({ h: document.querySelector('.c-maphead').getBoundingClientRect().height, t: document.querySelector('.c-mapscreen .c-brand').getBoundingClientRect().height,
    fs: parseFloat(getComputedStyle(document.querySelector('.c-mapscreen .c-brand')).fontSize), sw: document.querySelector('.c-maphead').scrollWidth, cw: document.querySelector('.c-maphead').clientWidth }));
  if (head.h > 44 || head.t > head.fs * 1.6 || head.sw > head.cw) bad(tag + ' map header wraps: ' + JSON.stringify(head));
  if ((await page.textContent('.c-herolabel')) !== 'NEXT CASE' || (await page.textContent('.c-herotitle')) !== 'The Forgotten Test Account') bad(tag + ' hero on first visit');
  if ((await page.textContent('.c-herobtn')) !== '> OPEN CASE FILE') bad(tag + ' hero button');
  if ((await page.textContent('.c-caseshead .c-count')) !== '3 of 7 playable') bad(tag + ' playable count');
  if ((await page.locator('div.c-case.soon').count()) !== 4 || (await page.locator('button.c-case').count()) !== 3) bad(tag + ' playable/soon rows');
  if (await page.locator('.c-intro').count()) bad(tag + ' intro paragraph still on the map');
  await page.click('.c-maphead .c-helpbtn');
  const help = await page.textContent('.c-maphelp');
  if (!help.includes('Real breaches, replayed. Investigate, then defend.') || !help.includes('01 brief')) bad(tag + ' map help panel: ' + help);
  await page.click('.c-maphead .c-helpbtn');
  if (desktop) {
    await checkFit('map');
    await page.waitForSelector('.c-heroactor:not([hidden])', { timeout: 3000 }).catch(() => bad(tag + ' desktop hero has no threat actor row'));
  } else if (await page.locator('.c-heroactor').isVisible()) bad(tag + ' threat actor row visible on a phone');
  if ((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) !== 'brand') bad(tag + ' map is not the brand theme');
  await bottomCheck('map');
  if (c.level === 1) await shot('0map');
  await page.click('text=> about'); await page.waitForSelector('.c-aboutscreen');
  await contrast('about'); await bottomCheck('about');
  const rels = await page.$$eval('.c-aboutscreen a[target]', (a) => a.map((x) => x.rel));
  if (rels.length < 2 || rels.some((r) => r !== 'noopener noreferrer')) bad(tag + ' about link rel ' + rels);
  if (c.level === 1) await shot('0about');
  await page.click('.c-exit'); await page.waitForSelector('.c-case');
  if (await page.locator('.c-splash').count()) bad(tag + ' splash shown again');
  await page.evaluate(() => 0); await contrast('map');
  if (c.level === 1) await shot('0map');
  await page.click('button.c-case >> nth=' + (c.level - 1));
  // briefing
  for (let i = 0; i < data.briefing.pages.length; i++) {
    await page.waitForSelector('.c-briefbar');
    await contrast('brief' + (i + 1));
    if (i === 0) {
      await theme('brief');
      const kv = await page.textContent('.c-kv');
      if (!kv.includes('Threat actor' + data.briefing.threatActor.v)) bad(tag + ' threat actor row: ' + kv.slice(0, 120));
      if ((await page.textContent('.c-display')) !== data.briefing.opening) bad(tag + ' opening line');
      if (/TODO/.test(await page.textContent('#app'))) bad(tag + ' placeholder or todo text visible in the briefing');
      if (/source:/.test(await page.textContent('#app'))) bad(tag + ' inline "source:" link in the briefing');
      const fns = await page.$$eval('.c-fn', (x) => x.map((b) => [b.textContent, b.getAttribute('aria-label'), b.getBoundingClientRect().height, b.getBoundingClientRect().width]));
      if (!fns.length || fns.some((f) => !/^\[\d+\]$/.test(f[0]) || !/^Source \d+: ./.test(f[1]) || f[2] < 24 || f[3] < 24)) bad(tag + ' briefing footnote markers: ' + JSON.stringify(fns.slice(0, 3)));
      await page.click('.c-fn >> nth=0');
      const n0 = fns[0] && fns[0][0].replace(/\D/g, '');
      if ((await page.evaluate(() => document.activeElement && document.activeElement.id)) !== 'c-src-' + n0 || await page.locator('#c-sources[hidden]').count()) bad(tag + ' marker did not open the sources panel at its source');
      const li = await page.textContent('#c-src-' + n0);
      if (!/open source/.test(li)) bad(tag + ' sources panel item: ' + li);
      await page.click('.c-srcbtn');
    }
    await barCheck('brief' + (i + 1));
    if (i === data.briefing.pages.length - 1) {
      // last page: "Open the evidence" sits in the page after the mission, not in the bar
      const order = await page.evaluate(() => { const b = document.querySelector('.c-briefnext'), m = [...document.querySelectorAll('.c-eyebrow')].find((e) => /mission/i.test(e.textContent));
        return { inBar: !!b.closest('.c-bar'), after: !!(m && (m.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)) }; });
      if (order.inBar || !order.after) bad(tag + ' last briefing page: Open the evidence must follow the mission ' + JSON.stringify(order));
    }
    if (i === 0 || i === 3) await shot('1brief' + (i + 1));
    await page.click('.c-briefnext');
  }
  // Act 1
  await page.waitForSelector('.c-card');
  await checkFit('act1'); await contrast('act1'); await barCheck('act1');
  await shot('2act1');
  const ordered = data.evidence.filter((e) => e.order).sort((a, b) => a.order - b.order);
  // Unordered groups (anyOrder): place them in reverse, which must still count as correct.
  const grouped = ordered.filter((e) => e.anyOrder);
  if (grouped.length > 1) { const i = ordered.indexOf(grouped[0]); ordered.splice(i, grouped.length, ...grouped.slice().reverse()); }
  const herrings = data.evidence.filter((e) => !e.order);
  const cardFor = (e) => page.locator('.c-card', { hasText: e.title.replace(/`/g, '').slice(0, 30) });
  // drag the first card onto the timeline (mouse on desktop, press-and-hold touch on the phone)
  const first = cardFor(ordered[0]);
  if (desktop) {
    // the evidence panel scrolls inside itself; the shuffled card may be below its fold, as for a player
    await first.evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(100);
    const a = await first.boundingBox(), b = await page.locator('.c-slots').boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + 30, a.y + 30, { steps: 4 }); await page.mouse.move(b.x + b.width / 2, b.y + 20, { steps: 8 });
    await page.mouse.up();
  } else {
    await first.evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(100);
    const cdp = await ctx.newCDPSession(page);
    const a = await first.boundingBox();
    const tgt = await page.locator('.c-add').boundingBox();
    const pt = (x, y) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x + a.width / 2, a.y + a.height / 2) });
    await page.waitForTimeout(400);   // press and hold
    for (let k = 1; k <= 10; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a.x + a.width / 2 + (tgt.x + tgt.width / 2 - a.x - a.width / 2) * k / 10, a.y + a.height / 2 + (tgt.y + tgt.height / 2 - a.y - a.height / 2) * k / 10) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await page.waitForTimeout(150);
  if ((await page.locator('.c-slot.filled').count()) !== 1) bad(tag + ' drag to timeline did not place card 1');
  // wrong evidence twice in a row: SOC LEAD line once, then not again
  await cardFor(herrings[0]).click(); await page.click('.c-add');
  const t1 = await page.textContent('.c-toast');
  if (!t1.includes('SOC LEAD > ')) bad(tag + ' no SOC LEAD on wrong evidence: ' + t1);
  await page.click('.c-add');
  if ((await page.textContent('.c-toast')).includes('SOC LEAD')) bad(tag + ' SOC LEAD twice in a row');
  await cardFor(herrings[0]).click();   // deselect
  await theme('act1');
  let rest = ordered.slice(1);
  if (desktop) {
    const before = await page.locator('.c-slot.filled').count();
    await cardFor(rest[0]).dblclick();
    if ((await page.locator('.c-slot.filled').count()) !== before + 1) bad(tag + ' double-click did not add the card');
    await cardFor(rest[1]).focus(); await page.keyboard.press('Enter');
    if ((await page.locator('.c-slot.filled').count()) !== before + 2) bad(tag + ' Enter did not add the card');
    rest = rest.slice(2);
  }
  for (const e of rest) {
    await cardFor(e).click(); await page.click('.c-add');
    if (e.anyOrder && !(await page.textContent('.c-toast')).includes('sequence valid')) bad(tag + ' unordered card ' + e.id + ' rejected out of order');
  }
  const callout = await page.textContent('.c-toast');
  if (!callout.includes('Timeline complete. ' + herrings.length + ' cards left: mark them Not related to close the case.')) bad(tag + ' no timeline-complete message: ' + callout);
  if (!(await page.locator('.c-nr.c-call').count())) bad(tag + ' Not related not highlighted');
  // full timeline: add and hint are off, the step counter never passes the last slot; Not related stays active
  const fullState = await page.evaluate(() => ({ add: document.querySelector('.c-add').disabled, hint: document.querySelector('.c-hintbtn').disabled,
    hintTxt: document.querySelector('.c-hintbtn').textContent, nr: document.querySelector('.c-nr').disabled }));
  if (!fullState.add || !fullState.hint || fullState.nr || /step\s*0?(\d+)/.test(fullState.hintTxt) && +fullState.hintTxt.match(/step\s*0?(\d+)/)[1] > ordered.length) bad(tag + ' full timeline state ' + JSON.stringify(fullState));
  if (c.level === 2) await shot('2act1-herrings');
  for (const e of herrings) { await cardFor(e).click(); await page.click('.c-nr'); }
  await page.waitForSelector('.c-slotbtn');
  await checkFit('act1-pz');
  await page.click('.c-slotbtn >> nth=' + (data.evidence.find((e) => e.id === data.patientZero).order - 1));
  await page.waitForSelector('.c-reveal');
  if (/source:/.test(await page.textContent('#app'))) bad(tag + ' inline "source:" link in the debrief');
  if (!(await page.locator('.c-reveal .c-fn').count())) bad(tag + ' no footnote markers in the debrief timeline');
  if (!(await page.textContent('.c-toast')).includes('SOC LEAD > ' + data.voice.patientZero)) bad(tag + ' no patient zero voice');
  await contrast('debrief');
  const xp = await page.textContent('.c-xp');
  if (!/0430|0460/.test(xp)) console.log('  note', tag, 'act1 xp', xp);
  await page.click('text=' + data.act2.rewindButton);
  // Act 2
  await page.waitForSelector('.c-ctl');
  await checkFit('act2'); await contrast('act2'); await theme('act2'); await barCheck('act2');
  await shot('3act2');
  const ctlBtn = (id) => page.locator('.c-ctl', { hasText: data.controls.find((x) => x.id === id).name.replace(/`/g, '').slice(0, 24) });
  // first run animated: succeeded build, check the ATTEMPTED pill on stage 1
  let firstRun = true;
  await ctlBtn(c.locked).click();
  if ((await ctlBtn(c.locked).getAttribute('class')).includes(' on')) bad(tag + ' locked control deployed before discovery');
  for (const run of c.runs) {
    const kind = run.kind, ids = run.ids;
    if (!(await page.locator('.c-ctl').count())) { await page.click('text=> TRY ANOTHER BUILD'); await page.waitForSelector('.c-ctl'); }
    if (await page.locator('.c-clear:not([disabled])').count()) await page.click('.c-clear');
    for (const id of ids) {
      if (desktop && id === ids[0] && (kind === 'contained' || run.drag)) {
        // drag a control onto its stage
        const ctl = data.controls.find((x) => x.id === id);
        await ctlBtn(id).evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(100);
        const a = await ctlBtn(id).boundingBox(); const node = page.locator('.c-node[data-n="' + ctl.stage + '"]');
        await node.scrollIntoViewIfNeeded(); const b = await node.boundingBox();
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
        await page.mouse.move(a.x + 20, a.y + 20, { steps: 3 }); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await page.mouse.up();
        if (!(await ctlBtn(id).getAttribute('class')).includes(' on')) bad(tag + ' drag control ' + id + ' did not deploy');
      } else await ctlBtn(id).click();
    }
    if (!firstRun) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.click('.c-run');
    if (firstRun) {
      if (!(await page.textContent('.c-log')).includes('SOC LEAD > ' + data.voice.run)) bad(tag + ' no run voice in log');
      await page.waitForSelector('.c-node[data-n="1"] .c-pill');
      const p1 = await page.textContent('.c-node[data-n="1"] .c-pill');
      if (!p1.includes('ATTEMPTED')) bad(tag + ' stage 1 pill is ' + p1);
      await page.waitForTimeout(1200); await checkFit('act2-run'); await shot('4replay');
    }
    await page.waitForSelector('.c-rescard', { timeout: 20000 });
    const title = await page.textContent('.c-rescard .c-display');
    const vline = (await page.locator('.c-rescard .c-voice').count()) ? await page.textContent('.c-rescard .c-voice') : '';
    const wantV = 'SOC LEAD > ' + data.voice[run.damage === 'NONE' ? 'prevented' : run.damage === 'CONTAINED' ? 'contained' : 'breached'];
    if (vline && vline !== wantV) bad(tag + ' results voice ' + vline);
    if (vline !== wantV) bad(tag + ' results voice missing or wrong: ' + vline);
    if (title !== TITLES[kind]) bad(tag + ' ' + kind + ' build ' + ids + ' gave "' + title + '"');
    const lst = await page.textContent('.c-replay li >> nth=0');
    if (!lst.includes('ATTEMPTED')) bad(tag + ' results stage 1 not ATTEMPTED');
    if (kind === 'contained' && c.id === 'midnight-blizzard' && !(await page.textContent('.c-rescard')).includes('before the mailboxes')) bad(tag + ' contained text');
    const stars = await page.locator('.c-rescard .c-stars svg.on').count();
    if (stars !== run.stars) bad(tag + ' ' + ids + ': ' + stars + ' stars, want ' + run.stars);
    const dmg = await page.textContent('.c-stat.c-span2 .c-v');
    if (dmg !== run.damage) bad(tag + ' ' + ids + ': damage ' + dmg + ', want ' + run.damage);
    const page2 = await page.textContent('#app');
    if (/TODO/.test(page2)) bad(tag + ' placeholder or todo text visible on results');
    if (kind === 'succeeded' && !page2.includes('Entered via an asset not in your inventory')) bad(tag + ' no hidden-asset line');
    if (IMPACT_STAGE[c.id] && kind !== 'prevented') {
      const n = IMPACT_STAGE[c.id], s6 = await page.locator('.c-replay li').nth(n - 1).textContent().catch(() => '');
      if (kind !== 'contained' && !s6.includes('IMPACT')) bad(tag + ' stage ' + n + ' not IMPACT: ' + s6.slice(0, 60));
      if (s6.includes('BREACHED')) bad(tag + ' stage ' + n + ' shown as BREACHED');
    }
    if (c.id === 'uber-2022' && run.damage === 'CRITICAL') bad(tag + ' Uber damage must never be CRITICAL');
    // stages marked "neutral" ran but didn't let the attacker in: their own label, a sourced note, never BREACHED
    for (const s of data.map.stages.filter((x) => x.neutral)) {
      const li = page.locator('.c-replay li').nth(s.n - 1), txt = await li.textContent();
      if (!txt.includes('\u26a0 ' + s.neutral.label) || txt.includes('BREACHED') || !txt.includes(s.neutral.note)) bad(tag + ' stage ' + s.n + ' not ' + s.neutral.label + ': ' + txt.slice(0, 80));
      if (s.neutral.source && !(await li.locator('.c-fn').count())) bad(tag + ' stage ' + s.n + ' note has no source marker');
      if (!run.stars) { const nx = await page.locator('.c-replay li').nth(s.n).textContent(); if (!nx.includes('BREACHED')) bad(tag + ' stage ' + (s.n + 1) + ' should be BREACHED: ' + nx.slice(0, 80)); }
    }
    if (!(await page.locator('.c-layers li').count())) bad(tag + ' no defense layers');
    const nxt = (await page.locator('.c-nextstar').count()) ? await page.textContent('.c-nextstar') : '';
    if (run.stars < 3 && !nxt.startsWith('\u2605'.repeat(run.stars + 1) + ':')) bad(tag + ' next-star line: ' + nxt);
    if (run.stars === 3 && nxt) bad(tag + ' next-star line on 3 stars');
    if (run.stars === 2) await shot('8twostar');
    await contrast('results-' + kind);
    await bottomCheck('results-' + kind);
    if (firstRun) await shot('5results');
    if (firstRun && /source:/.test(await page.textContent('#app'))) bad(tag + ' inline "source:" link on the results');
    if (firstRun && !(await page.locator('.c-srclist li').count())) bad(tag + ' no sources panel on the results');
    if (kind === 'contained') await shot('6contained');
    if (run.stars === 3) await shot('7threestar');
    firstRun = false;
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  // code style: neutral, not yellow
  const codeColor = await page.evaluate(() => { const c = document.createElement('code'); document.getElementById('app').appendChild(c); const v = getComputedStyle(c).color; c.remove(); return v; });
  if (codeColor === 'rgb(255, 211, 77)') bad(tag + ' code is yellow');
  await page.click('.c-exit'); await page.waitForSelector('.c-case');
  if ((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) !== 'brand') bad(tag + ' map theme not brand after a case');
  const other = c.id === 'midnight-blizzard' ? 'The Legacy VPN' : 'The Forgotten Test Account';
  if ((await page.textContent('.c-herolabel')) !== 'NEXT CASE' || (await page.textContent('.c-herotitle')) !== other) bad(tag + ' returning hero is not the next unfinished case');
  if (!(await page.textContent('.c-cases')).includes('\u2605')) bad(tag + ' stars not shown in the list after a case');
  if (c.level === 1) await shot('9map-returning');
  await page.click('.c-voicebtn');
  await page.reload(); await page.waitForSelector('.c-voicebtn');
  if ((await page.textContent('.c-voicebtn')) !== 'voice: off') bad(tag + ' voice toggle not saved');
  await page.click('.c-voicebtn');
  const csp = await page.evaluate(() => window.__csp);
  csp.forEach((v) => bad(tag + ' CSP violation ' + v));
  errors.forEach((e) => bad(tag + ' ' + e));
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => sessionStorage.clear());
  await p2.goto(BASE + '#case/' + c.id);
  await p2.waitForSelector('.c-briefbar');
  if (await p2.locator('.c-splash').count()) bad(tag + ' splash on direct case link');
  await p2.close();
  console.log('ok', tag, xp.trim());
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  sampler = await (await browser.newContext()).newPage();
  // Sound: off by default, no AudioContext before a gesture, toggle saved, toggle in the help panel too.
  if (!process.env.CASE) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => { window.__ac = 0; const AC = window.AudioContext; window.AudioContext = function () { window.__ac++; return new AC(); }; });
    const pg = await ctx.newPage(); const errs = [];
    pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto(BASE); await pg.waitForSelector('.c-soundbtn');
    if ((await pg.textContent('.c-foot .c-soundbtn')) !== 'sound: off') bad('sound not off by default');
    await pg.waitForTimeout(2200);
    if (await pg.evaluate(() => window.__ac)) bad('AudioContext created before any gesture');
    await pg.click('.c-foot .c-soundbtn');
    if ((await pg.textContent('.c-foot .c-soundbtn')) !== 'sound: on') bad('sound toggle did not switch on');
    if (await pg.evaluate(() => window.__ac)) bad('the sound toggle made a sound (navigation must be silent)');
    await pg.reload(); await pg.waitForSelector('.c-soundbtn');
    if ((await pg.textContent('.c-foot .c-soundbtn')) !== 'sound: on') bad('sound toggle not saved');
    if (await pg.evaluate(() => window.__ac)) bad('AudioContext created on reload before a gesture');
    await pg.click('button.c-case >> nth=0'); await pg.waitForSelector('.c-briefbar');
    await pg.waitForTimeout(200);
    if ((await pg.evaluate(() => window.__ac)) !== 1) bad('no SEV 1 alert sound when the case opened');
    for (let i = 0; i < 5; i++) await pg.click('.c-briefnext');
    await pg.waitForSelector('.c-card'); await pg.click('.c-helpbtn');
    if ((await pg.locator('.c-helpbox .c-soundbtn').count()) !== 1 || (await pg.locator('.c-helpbox .c-voicebtn').count()) !== 2) bad('help panel toggles missing');
    errs.forEach((e) => bad('sound test: ' + e));
    console.log('ok sound');
    await ctx.close();
  }
  // Splash for a returning player, then reduced motion; About reset clears only this app's keys.
  if (!process.env.CASE) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('breach-escape-progress-v1', JSON.stringify({ cases: { 'midnight-blizzard': { act2: { bestStars: 2 } } } }));
        localStorage.setItem('breach-escape-voice', 'off'); localStorage.setItem('other-app', 'keep');
      }
    });
    const pg = await ctx.newPage();
    await pg.goto(BASE);
    await pg.waitForSelector('.c-spl-out >> text=welcome back', { timeout: 6000 }).catch(() => {});
    const out = await pg.textContent('.c-spl-term').catch(() => '');
    if (!out.includes('[ok] welcome back \u00b7 1/3 cases closed')) bad('returning splash line: ' + out);
    await pg.click('.c-spl-skip');
    await pg.click('text=> about'); await pg.click('.c-resetbtn');
    if (await pg.locator('.c-confirm[hidden]').count()) bad('reset confirm not shown');
    await pg.click('.c-confirm .c-yes'); await pg.waitForSelector('.c-case');
    const ls = await pg.evaluate(() => Object.keys(localStorage).sort().join(','));
    if (ls !== 'other-app') bad('reset left keys: ' + ls);
    if ((await pg.textContent('.c-cases')).includes('\u2605')) bad('stars still on the map after reset');
    await ctx.close();
    const rm = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const p3 = await rm.newPage(); await p3.goto(BASE);
    if (!(await p3.locator('.c-spl-logo:not([hidden])').count()) || (await p3.locator('.c-spl-term .c-spl-line').count())) bad('reduced-motion splash is not the static logo');
    if ((await p3.textContent('.c-spl-kept')) !== 'KEPT' || !(await p3.locator('.c-spl-tagrow.on').count())) bad('reduced-motion splash is not the finished KEPT + tagline screen');
    await p3.waitForTimeout(3000);
    if (!(await p3.locator('.c-splash').count())) bad('reduced-motion splash gone before 3 s');
    await p3.waitForSelector('.c-splash', { state: 'detached', timeout: 2500 }).catch(() => bad('reduced-motion splash longer than ~3.5 s'));
    await rm.close();
    console.log('ok splash/reset');
  }
  // Allow-list deploy: only public/ is served; repo files must be unreachable.
  if (!process.env.CASE) {
    for (const p of ['CLAUDE.md', 'README.md', 'SECURITY.md', 'docs/redesign/STATUS.md', 'docs/', 'tools/validate', 'tools/level.schema.json',
      'tests/e2e.js', '.github/workflows/deploy.yml', '.gitignore', '../CLAUDE.md', '%2e%2e/CLAUDE.md', '..%2fREADME.md']) {
      const st = await new Promise((res) => require('http').get(BASE + p, (r) => { r.resume(); res(r.statusCode); }).on('error', () => res(0)));
      if (st !== 404) bad('repo file reachable from the site: /' + p + ' (' + st + ')');
    }
    console.log('ok allow-list');
  }
  // Symlinks inside the served folder that point outside it must 404 (made in a temp copy, never committed).
  if (!process.env.CASE) {
    const fs = require('fs'), os = require('os'), { spawn } = require('child_process');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'be-symlink-'));
    const pub = path.join(tmp, 'public');
    fs.cpSync(REPO, pub, { recursive: true });
    fs.symlinkSync(path.resolve(REPO, '..', 'CLAUDE.md'), path.join(pub, 'outside.md.txt'));   // file outside
    fs.symlinkSync(path.resolve(REPO, '..'), path.join(pub, 'repo'));                           // directory outside
    fs.symlinkSync(path.join(pub, 'index.html'), path.join(pub, 'alias.html'));               // inside: allowed
    const srv = spawn(process.execPath, [path.join(__dirname, 'serve.js'), pub, '8766'], { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 600));
    const get = (u) => new Promise((res) => require('http').get('http://localhost:8766/' + u, (r) => { r.resume(); res(r.statusCode); }).on('error', () => res(0)));
    for (const u of ['outside.md.txt', 'repo/CLAUDE.md', 'repo/tools/validate', 'repo/public/index.html']) {
      const st = await get(u); if (st !== 404) bad('symlink escape served: /' + u + ' (' + st + ')');
    }
    if ((await get('alias.html')) !== 200) bad('symlink inside the served folder not served');
    if ((await get('index.html')) !== 200) bad('temp server did not serve index.html');
    srv.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('ok symlinks');
  }
  // Every playable case finished: the hero offers the case with the fewest stars.
  if (!process.env.CASE) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => { sessionStorage.setItem('breach-escape-splash', '1');
      localStorage.setItem('breach-escape-progress-v1', JSON.stringify({ cases: { 'midnight-blizzard': { act2: { bestStars: 3 } }, 'colonial-pipeline': { act2: { bestStars: 1 } }, 'uber-2022': { act2: { bestStars: 2 } } } })); });
    const pg = await ctx.newPage(); await pg.goto(BASE); await pg.waitForSelector('.c-hero');
    if ((await pg.textContent('.c-herolabel')) !== 'REPLAY A CASE' || (await pg.textContent('.c-herotitle')) !== 'The Legacy VPN' || (await pg.textContent('.c-herobtn')) !== '> REOPEN CASE') bad('all-finished hero');
    await ctx.close();
    console.log('ok replay hero');
  }
  // Bad #case/ links: land on the map, no case fetch, nothing echoed.
  for (const hash of ['#case/../../evil', '#case/unknown']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const pg = await ctx.newPage(); const reqs = [];
    pg.on('request', (r) => reqs.push(r.url()));
    await pg.goto(BASE + hash); await pg.waitForSelector('.c-case');
    await pg.waitForTimeout(300);
    // The desktop hero may load a known case file for its threat-actor row; anything else is an extra request.
    const extra = reqs.filter((u) => { const x = u.replace(BASE + hash, ''); return /evil|unknown/.test(x) || (/levels\//.test(x) && !/levels\/(midnight-blizzard|colonial-pipeline|uber-2022)\.json$/.test(x)); });
    if (extra.length) bad('bad link ' + hash + ' requested ' + extra);
    const txt = await pg.evaluate(() => document.body.textContent + location.href);
    if (/evil|unknown/.test(txt)) bad('bad link ' + hash + ' echoed on the page or kept in the URL');
    if (await pg.locator('.c-briefbar').count()) bad('bad link ' + hash + ' opened a case');
    console.log('ok bad link', hash);
    await ctx.close();
  }
  for (const v of VIEWS.filter((v) => !process.env.ONLY || v.name === process.env.ONLY)) for (const c of CASES.filter((c) => !process.env.CASE || c.id === process.env.CASE)) { try { await run(v, c, browser); } catch (e) { bad(v.name + ' ' + c.id + ' threw ' + e.message.split('\n')[0]); } }
  await browser.close();
  console.log(problems.length ? problems.length + ' problems' : 'ALL PASS');
})();
