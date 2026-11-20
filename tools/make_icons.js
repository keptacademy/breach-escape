#!/usr/bin/env node
/* Writes the app icon and brand mark SVGs (shapes only, no fonts, so every renderer
   draws them the same) and renders the PNGs with the pre-installed Chromium.
   Run from the repo root: node tools/make_icons.js   (not deployed) */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BG = '#010603', SILVER = '#E8EDF2', ICE = '#8DB7FF';
const pub = path.join(__dirname, '..', 'public');

// ">K_" on a 512 grid. Content spans about 72..440 so it can be scaled into the maskable safe zone.
function iconContent() {
  const i = 72, L = 96, w = 26, e = 512 - i;
  const br = `<path d="M${i} ${i + L}V${i}H${i + L}M${e - L} ${i}H${e}V${i + L}M${e} ${e - L}V${e}H${e - L}M${i + L} ${e}H${i}V${e - L}" fill="none" stroke="${SILVER}" stroke-width="${w}" stroke-linecap="square"/>`;
  const gt = `<path d="M118 196L178 256L118 316" fill="none" stroke="${ICE}" stroke-width="32" stroke-linecap="square" stroke-linejoin="miter"/>`;
  const k = `<path d="M240 188V324M306 188L254 256L306 324" fill="none" stroke="${SILVER}" stroke-width="32" stroke-linecap="square" stroke-linejoin="miter"/>`;
  const us = `<rect x="338" y="312" width="60" height="28" fill="${ICE}"/>`;
  return br + gt + k + us;
}
function iconSvg(opts) {
  const o = opts || {};
  const bg = o.square ? `<rect width="512" height="512" fill="${BG}"/>` : `<rect width="512" height="512" rx="112" fill="${BG}"/>`;
  const c = o.scale ? `<g transform="translate(256 256) scale(${o.scale}) translate(-256 -256)">${iconContent()}</g>` : iconContent();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Breach Escape">${bg}${c}</svg>\n`;
}

// "KE / PT" block, 1024 grid: silver letters, ice-blue corner brackets, transparent ground.
function brandSvg(withBg) {
  const i = 64, L = 168, w = 44, e = 1024 - i;
  const br = `<path d="M${i} ${i + L}V${i}H${i + L}M${e - L} ${i}H${e}V${i + L}M${e} ${e - L}V${e}H${e - L}M${i + L} ${e}H${i}V${e - L}" fill="none" stroke="${ICE}" stroke-width="${w}" stroke-linecap="square"/>`;
  const s = 'fill="none" stroke="' + SILVER + '" stroke-width="72" stroke-linecap="square" stroke-linejoin="miter"';
  // cells: x 228..484 and 540..796; rows: y 196..460 and 564..828
  const K = `<path d="M264 196V460M448 196L300 328L448 460" ${s}/>`;
  const E = `<path d="M760 196H576V460H760M576 328H728" ${s}/>`;
  const P = `<path d="M264 828V564H372A66 66 0 0 1 372 696H264" ${s}/>`;
  const T = `<path d="M540 564H796M668 564V828" ${s}/>`;
  const bg = withBg ? `<rect width="1024" height="1024" fill="${BG}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="KEPT">${bg}${br}${K}${E}${P}${T}</svg>\n`;
}

const files = {
  'icons/icon.svg': iconSvg(),
  'icons/favicon.svg': iconSvg(),
  'brand/kept-mark.svg': brandSvg(false)
};
for (const [f, s] of Object.entries(files)) fs.writeFileSync(path.join(pub, f), s);

const pngs = [
  ['icons/icon-192.png', iconSvg(), 192], ['icons/icon-512.png', iconSvg(), 512],
  ['icons/maskable-512.png', iconSvg({ square: true, scale: 0.74 }), 512], ['icons/apple-touch-icon.png', iconSvg({ square: true }), 180],
  ['icons/favicon-32.png', iconSvg(), 32], ['brand/kept-mark-1024.png', brandSvg(true), 1024]
];
(async () => {
  const b = await chromium.launch();
  for (const [f, svg, px] of pngs) {
    const p = await b.newPage({ viewport: { width: px, height: px }, deviceScaleFactor: 1 });
    await p.setContent('<html><body style="margin:0;background:transparent">' + svg.replace('<svg ', `<svg width="${px}" height="${px}" `) + '</body></html>');
    await p.locator('svg').screenshot({ path: path.join(pub, f), omitBackground: true });
    await p.close();
  }
  await b.close();
  console.log('wrote', Object.keys(files).length, 'SVGs and', pngs.length, 'PNGs');
})();
