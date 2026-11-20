# Breach Escape by KEPT Academy

**KEPT: Know the Exposure, Patch the Threat.** The school side uses "Know · Explore · Practice · Test".

An installable web app (PWA) in a SOC-terminal look that replays real, documented breaches as cases: an intel briefing, Act 1 Investigate (rebuild the attack timeline from evidence and find patient zero), Act 2 Defend (deploy controls on a budget and replay the real attack against them) and a debrief.

## What's in this folder

| File | What it does |
|---|---|
| `index.html` | The page shell. Loads the theme, level list and app code. |
| `theme.css` | The terminal theme for every screen, with colour tokens on `:root`. |
| `levels.js` | The Breach Map list (one entry per breach, `case: 'levels/<id>.json'` for playable ones) and the shared glossary. |
| `app.js` | App shell: Breach Map, saved progress, glossary terms, shared helpers. |
| `case.js` | **Case engine:** Intel briefing, Act 1 Investigate (evidence board, timeline, patient zero), Act 2 Defend (defense map, control deck on a budget, attack replay) and Results. Reads a level JSON file. |
| `levels/*.json` | **The content.** One file per breach: briefing, evidence, timeline, map, controls, scoring, outcomes, tips, sources. |
| `docs/redesign/` | v2 spec and prototype. Not served: blocked with a 404 route in `staticwebapp.config.json`. |
| `manifest.webmanifest` | Makes it installable ("Add to Home Screen"), with name, colors and icons. |
| `sw.js` | Service worker: caches the app so it works offline. |
| `icons/` | App icons (192, 512, maskable, Apple touch icon). |
| `staticwebapp.config.json` | Azure Static Web Apps settings, including the security headers. |

## Security choices

- **No backend, no accounts, no tracking.** Progress is stored only in the player's own browser (`localStorage`).
- **No third-party code.** No CDNs, fonts, analytics or trackers; every file is served from your own domain.
- **Strict Content Security Policy** in `staticwebapp.config.json`: only same-origin scripts and styles, no inline scripts or inline styles, no framing (clickjacking), no form posts, no plugins.
- **Other headers:** HSTS, `nosniff`, a strict referrer policy, a Permissions-Policy that turns off camera, mic, location and payment, and COOP.
- **Safe rendering:** all text is inserted with `textContent`, never as HTML.
- The service worker only caches same-origin `GET` requests.

When player accounts are added later, use Microsoft Entra External ID rather than building your own login.

## Run it locally

Service workers need `https` or `localhost`:

```bash
cd breach-escape-app
python3 -m http.server 8080
# open http://localhost:8080
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
2. In `sw.js`, bump `VERSION` (for example `v1` → `v2`) so installed copies pick up the change.
3. Push to GitHub; Azure deploys automatically.
4. Pull requests to `main` get their own Azure preview environment (URL posted on the PR), removed when the PR closes. Production only deploys on push to `main`. The preview jobs run in a GitHub environment called `preview` and need the same `AZURE_STATIC_WEB_APPS_API_TOKEN` secret available there (or as a repository secret).

## Add a new level

Copy `levels/midnight-blizzard.json` to `levels/<id>.json` and fill it in: briefing pages, evidence cards (the real ones with `order`, red herrings with `order: null`), `patientZero`, hints, timeline (with ATT&CK codes and a source per stage), the Act 2 map (zones and stages; mark a stage the defender can't block with `unblockable: true`), controls and decoys, outcomes and tips. Optional: `theme` (`green` or `amber`), `briefing.opening` (the alert headline), `briefing.threatActor`, and `voice` (SOC LEAD lines; defaults are `window.VOICE` in `levels.js`). Then in `levels.js` set the level's `status` to `'ready'` and add `case: 'levels/<id>.json'`, and add the file to `FILES` in `sw.js`.

Build every level only from primary sources: the company's own post-mortem, official testimony or a government report. List them in `sources`. Label recreated log rows with `illustrative: true` (shown as "recreated for training"), and mark anything not yet checked with a `todo` field.

## License

© 2026 KEPT Academy. All rights reserved. This repository is public for transparency and security review; it is not open source. Breach scenarios are based on the public primary sources listed in each level.

To report a security issue, see [SECURITY.md](SECURITY.md).
