# Breach Escape by KEPT Academy

**KEPT: Know the Exposure, Patch the Threat.** The school side uses "Know · Explore · Practice · Test".

An installable web app (PWA) in a SOC-terminal look that replays real, documented breaches as cases: an intel briefing, Act 1 Investigate (rebuild the attack timeline from evidence and find patient zero), Act 2 Defend (deploy controls on a budget and replay the real attack against them) and a debrief.

## What's in this folder

Only `public/` is deployed (an allow-list): the Azure workflow uses `app_location: "public"`, so nothing else in the repo is ever served. The 404 routes in `public/staticwebapp.config.json` stay as a second layer.

| File | What it does |
|---|---|
| `public/index.html` | The page shell. Loads the theme, level list and app code. |
| `public/theme.css` | Design D for every screen: one token set per colour theme (`<html data-theme="dark|light">`), fixed status colours, the case colour as an accent only (`data-case`). |
| `public/theme-init.js` | Sets the dark or light theme before the first paint (saved choice, else the device setting). |
| `public/fonts/` | Self-hosted IBM Plex Sans and Mono (400/500/600, latin woff2) and their licence, `OFL.txt`. |
| `public/levels.js` | The Breach Map list (one entry per breach, `case: 'levels/<id>.json'` for playable ones) and the shared glossary. |
| `public/app.js` | App shell: Breach Map, saved progress, glossary terms, shared helpers. |
| `public/case.js` | **Case engine:** Intel briefing, Act 1 Investigate, Act 2 Defend and Results. Reads a level JSON file. |
| `public/levels/*.json` | **The content.** One file per breach: briefing, evidence, timeline, map, controls, scoring, outcomes, tips, sources. |
| `public/manifest.webmanifest` | Makes it installable ("Add to Home Screen"), with name, colors and icons. |
| `public/sw.js` | Service worker: caches the app so it works offline. |
| `public/icons/` | App icon `>K_`: SVG source and favicon, PNGs 192, 512, maskable 512, Apple touch 180, favicon 32. Made by `tools/make_icons.js`. |
| `public/brand/` | KEPT brand mark (KE / PT block): dark and light SVGs and a 1024 PNG. Shown on the About page. |
| `public/staticwebapp.config.json` | Azure Static Web Apps settings: security headers and 404 routes. SWA reads it from `app_location`. |
| `tools/` | Level tooling (Python, standard library): `level.schema.json`, `schema_check.py`, `validate`, `new_case`. Not deployed. |
| `tests/` | `serve.js` (local server with the production headers) and `e2e.js` (Playwright end-to-end suite). Not deployed. |
| `docs/redesign/` | Spec, prototype and STATUS. Not deployed. |

## Security choices

- **No backend, no accounts, no tracking.** Progress is stored only in the player's own browser (`localStorage`).
- **No third-party code.** No CDNs, analytics or trackers; every file is served from your own domain. The IBM Plex fonts are self-hosted in `public/fonts/` (SIL Open Font License), so CSP `font-src 'self'` holds.
- **Strict Content Security Policy** in `staticwebapp.config.json`: only same-origin scripts and styles, no inline scripts or inline styles, no framing (clickjacking), no form posts, no plugins.
- **Other headers:** HSTS, `nosniff`, a strict referrer policy, a Permissions-Policy that turns off camera, mic, location and payment, and COOP.
- **Safe rendering:** all text is inserted with `textContent`, never as HTML.
- The service worker only caches same-origin `GET` requests.

When player accounts are added later, use Microsoft Entra External ID rather than building your own login.

## Run it locally

Service workers need `https` or `localhost`. Serve the deployed folder, `public/`:

```bash
node tests/serve.js public 8765
# open http://localhost:8765 (served from public/ with the production CSP and headers)
```

## Deploy (Azure Static Web Apps, Free plan)

1. The code lives in the private repo `keptacademy/breach-escape`.
2. In the Azure portal: **Create a resource → Static Web App**. Plan type **Free**, source **GitHub**, pick the repo and the `main` branch.
3. Build presets: **Custom**. App location `/`, API location empty, output location empty.
4. Azure adds a GitHub Actions workflow to the repo and deploys on every push.
5. **Custom domain:** in the Static Web App, open Custom domains, add `play.keptacademy.com`, and create the CNAME record it shows you in Cloudflare DNS. Set it to **DNS only (grey cloud)** so Azure can validate the domain. Azure issues the TLS certificate for you.
6. Open the site on your phone, then **Share → Add to Home Screen** (iPhone) or **Install app** (Android).

## Ship an update

1. Edit the files (usually a level JSON in `levels/`).
2. In `public/sw.js`, bump `VERSION` (for example `v1` → `v2`) so installed copies pick up the change.
3. Push to GitHub; Azure deploys automatically.
4. Pull requests to `main` get their own Azure preview environment (URL posted on the PR), removed when the PR closes. Production only deploys on push to `main`. The preview jobs run in a GitHub environment called `preview` and need the same `AZURE_STATIC_WEB_APPS_API_TOKEN` secret available there (or as a repository secret).

## Add a new level

Run `tools/new_case <id> "<Title>"` (or copy `public/levels/midnight-blizzard.json` to `public/levels/<id>.json`) and fill it in: briefing pages, evidence cards (the real ones with `order`, red herrings with `order: null`), `patientZero`, hints, timeline (with ATT&CK codes and a source per stage; only an `impact` stage may have no code), the Act 2 map (zones and stages; mark a stage the defender can't block with `unblockable: true`), controls and decoys, outcomes and tips. Act 2: `map.hidden` (the asset not in the defender's inventory), controls with `effect` block / detect / recover / reveal / decoy, `needs: "reveal"` and `coversHidden`, and `reach` / `severity` / `impact` / `neutral` (`{label, note, source}`: a stage that ran without letting the attacker in, shown as a neutral "⚠ LABEL" pill) on stages. Evidence cards that share `anyOrder` may be placed in either order. Anything with a `todo` is never shown. Optional: `theme` (`green`, `amber` or `violet`; the map uses `brand`), `briefing.opening` (the alert headline), `briefing.threatActor`, and `voice` (SOC LEAD lines; defaults are `window.VOICE` in `levels.js`). Run `tools/validate` until it reports 0 errors. Then in `public/levels.js` set the level's `status` to `'ready'` and add `case: 'levels/<id>.json'`, and add the file to `FILES` in `public/sw.js`.

Build every level only from primary sources: the company's own post-mortem, official testimony or a government report. List them in `sources`. Label recreated log rows with `illustrative: true` (shown as "recreated for training"), and mark anything not yet checked with a `todo` field.

## License

© 2026 KEPT Academy. All rights reserved. This repository is public for transparency and security review; it is not open source. Breach scenarios are based on the public primary sources listed in each level.

To report a security issue, see [SECURITY.md](SECURITY.md).
