# Breach Escape v2 redesign: status and handoff

Last updated: 2026-11-19. Branch `claude/keen-pasteur-o2a3hp`, draft PR https://github.com/keptacademy/breach-escape/pull/1 (into `main`).
Live v1 quiz is saved as tag `v1-quiz` (`e0df885`, main's commit before this work).

## Goal
Turn each level into a "case": **Intel briefing → Act 1 Investigate → Act 2 Defend → Results**, in a dark SOC
terminal look (from `prototype-v2.html`), run by one data-driven engine so every breach is just a JSON file.
Spec: `level-spec-midnight-blizzard.md` (facts win from the spec, look and flow from the prototype).

## What's built (Level 1, Midnight Blizzard)
| Screen | State | Commits |
|---|---|---|
| Level JSON (`levels/midnight-blizzard.json`) | Done: briefing, evidence, timeline, map, controls, scoring, outcomes, tips, logs | `0c01200`, updated in all later commits |
| Intel briefing (5 pages) | Done. Pinned footer (back / sources toggle / NEXT), BRIEFING tag instead of XP, "‹ exit to map" | `0c01200`, `8dcf21a` |
| Act 1 Investigate | Done. Evidence cards → 7-slot timeline (drag or tap + buttons, keys A/X/H), red herrings to Not related, hints (−10 XP), patient zero, debrief with the real timeline and sources | `0c01200`, `53baeb2`, `8dcf21a` |
| Act 2 Defend | Done. 3-zone map with 7 stages, 14-card control deck (budget 10, tap or drag onto a stage), replay ~0.7 s per stage with log | `5126333` |
| Results | Done. Stars, rank, stats, tips, stage-by-stage replay list, build breakdown, Try another build, Restart case | `5126333` |
| Classic screens (map, classic quiz) | Unchanged look (light glass + Klar). Klar now built without innerHTML | `8dcf21a` |
| CI | PR preview deploy + close jobs added; production unchanged | `8dcf21a` |

Tested in headless Chromium under the production CSP header at 1280×720, 1920×1080, 1024×700 and 390×844, plus a run with reduced motion on.
The full flow passes with no console errors, no outside requests, no page scroll on desktop in Act 1 or Act 2, and all text at 4.5:1 or better.

## File map
| File | What it does |
|---|---|
| `index.html` | Shell: loads `styles.css`, `case.css`, `levels.js`, `app.js`, `case.js`. |
| `app.js` | Breach Map, classic quiz (intro/play/end), Klar (SVG via `createElementNS`), glossary `termify`, progress in localStorage (`breach-escape-progress-v1`). Exposes `window.BreachEscape` (h, termify, shuffle, progress, onLeave, …) for case.js. A level with `case:` opens the v2 engine. |
| `case.js` | v2 engine: frame/HUD, code rain + red edge flash, briefing renderer (block types: alert, note, panel, facts, timeline, diagram, glossary, mission), Act 1, Act 2 (`simulate()` then animate), results, shared drag-and-drop (Pointer Events, press-and-hold on touch). Text in backticks is rendered as `<code>`. |
| `case.css` | Terminal theme, scoped to `body.case-mode` / `.app.case` (classes prefixed `c-`). One-screen desktop layouts (`.c-fit`, 900px+), pinned bars, phone layouts. |
| `styles.css` | Classic glass theme (map, classic quiz). `.term-code` styles identifier glossary terms. |
| `levels.js` | `window.LEVELS` (map list; Level 1 has `case: 'levels/midnight-blizzard.json'` plus its old quiz `stages`; Level 2 Colonial is still classic-only) and `window.GLOSSARY` (shared by both engines). |
| `levels/midnight-blizzard.json` | All Level 1 case content and rules. Act 2 stage codes are read from `timeline[].mitre` (single source). |
| `sw.js` | Offline cache, network-first. Currently `v17`; bump on every deploy. Caches case files too. |
| `staticwebapp.config.json` | Strict CSP and security headers; 404 for `/docs/*`, `/*.md`, `/.github/*`. |
| `.github/workflows/deploy.yml` | CodeQL → production deploy (push to main only, `production` environment). PRs: `preview` job deploys an Azure preview environment, and `close_preview` removes it when the PR closes. Fork PRs are skipped. |
| `.github/dependabot.yml` | Weekly updates for the pinned Actions. |
| `docs/redesign/` | Spec, prototype, this file. Not served (404 route). |

Saved progress: `progress.cases['midnight-blizzard'] = { briefed, act1: {done, bestXp, bestTime, fewestMistakes}, act2: {bestStars, bestBuild, lastStars, runs} }`.
Map stars (`progress.levels`) are only written by the classic quiz.

## Decisions made
- **Act 1 scoring:** +50 for each correct placement, +30 per red herring dismissed, −20 per mistake, −10 per hint, +100 for patient zero. XP never goes below 0.
- **Act 2 scoring:** ID Protection is **detect** (no random chance). **3 stars** = blocked at stage ≤ 2 **and** no decoys; **2** = blocked later (or early with decoys); **1** = only detected or limited; **0** = breach succeeded.
  - Each run is worth Act 1 XP + 150 per star; runs don't stack.
  - Mailboxes lost: 0 if blocked, FEW if detected and limited, SOME if only one of the two, MANY if nothing worked.
  - User friction: sum of `friction` values; LOW ≤ 1, MED ≤ 3, otherwise HIGH.
  - Ranks: INTERN, ANALYST, ENGINEER, ARCHITECT.
- **Controls:** a drop must land on a stage in the zone the control protects, and it then goes onto its own stage. Decoys look like other controls until the replay.
  - Decommissioning blocks at stage 2. The spec says stages 2–3; the outcome is the same.
- **ATT&CK codes by stage:**

  | Stage | Codes |
  |---|---|
  | 1 Password spray from residential proxies | T1090, T1110.003 |
  | 2 Guessed password works on the test account | T1078.004 |
  | 3 Use Legacy-Test-App | T1550.001 |
  | 4 Register malicious OAuth apps | T1098.001 |
  | 5 New user, consent to apps | T1136.003 |
  | 6 Grant `full_access_as_app` | T1098.003 |
  | 7 Read leadership mailboxes | T1114.002 |
- **Layout:**
  - Desktop (900px and wider): Act 1 and Act 2 fit on one screen, content capped at 1100px. Panels scroll inside themselves; the page doesn't.
  - Act 2 at 720px high: the map panel scrolls and follows the stage under attack.
  - Briefing pages are 640px wide. Phones stack everything above a pinned bottom bar.
- **Wording and fact corrections:**
  - "a limited number of accounts" (not 412 or hundreds).
  - "a very small percentage" of mailboxes (MSRC).
  - "senior leadership" (not "the CEO").
  - Sponsor attributed by the US and UK governments to Russia's SVR.
  - E3: the legacy test OAuth app with elevated access was used by the attacker, with no claim about how it was compromised.
  - `full_access_as_app` is always lowercase and shown as code.
  - 7 timeline slots; patient zero is picked by tapping a slot.
- **Contrast:**
  - Grey text is `#A9DDBA`; the code rain is at opacity 0.08 and ticks every 110 ms.
  - Red pills, toasts and the EXECUTE button use dark text on red.
- **Sources** (primary only; checked 2026-11-19):
  - MSRC, Jan 19 2024: https://www.microsoft.com/en-us/msrc/blog/2024/01/microsoft-actions-following-attack-by-nation-state-actor-midnight-blizzard
  - Microsoft Security Blog, Jan 25 2024: https://www.microsoft.com/en-us/security/blog/2024/01/25/midnight-blizzard-guidance-for-responders-on-nation-state-attack/
  - SEC 8-K, Jan 19 2024: currently links the EDGAR 8-K filings list for Microsoft (CIK 0000789019).

## Rules that always apply
- Strict CSP, unchanged: no inline `<script>` and no `style=""` attributes (setting styles from JS, e.g. `el.style.width`, is fine). No `innerHTML`; build DOM with `h()` or `createElementNS`, text via `textContent`.
- No outside requests: system monospace fonts, no CDNs or analytics. No new packages without asking.
- Never push to `main`. Work on `claude/keen-pasteur-o2a3hp`; PR #1 is the review vehicle.
- Every fact comes from a primary source; recreated log rows stay labelled "recreated for training".
- Bump `sw.js` `VERSION` on every change that ships.
- Tip for edits: the Write tool stores `‹`-style escapes as the literal characters. Both work in JS, but patterns you search for must match what's actually in the file.

## Known issues and open items
- **The PR preview secret isn't set:** the `preview` jobs need `AZURE_STATIC_WEB_APPS_API_TOKEN` in a GitHub environment called `preview` (or as a repository secret). Until then the PR preview run fails.
- **8-K link:** points to the filings list, not the filing itself. Replace it with the direct document URL once confirmed.
- **Not tested on real devices:** touch drag (press-and-hold) was only checked in an emulator. iOS Safari and Android Chrome still need a real check.
- **Tight fit at 1280×720:** Act 2 uses the inner map scroll; at heights under about 650px, panels get cramped.
- **Phones:** the page scrolls in Act 1 and Act 2 (accepted).
- **Not reviewed:** CodeQL and preview results on PR #1 haven't been looked at.
- **Level 1's old quiz `stages`** in `levels.js` are now only reachable from the case-file loading error screen.

## What's next (in order)
1. Remove Klar and the glass theme completely: drop the Klar SVG code and moods from `app.js`, and the glass and blob styles from `styles.css` and `index.html`.
2. Terminal theme everywhere: rebuild the Breach Map and any shared screens with the case look. `theme-color` and `manifest.webmanifest` colours should become dark.
3. Colonial Pipeline on the case engine (spec build step 5): write `levels/colonial-pipeline.json` from its primary sources (see `levels.js` sources), with briefing, evidence, timeline, map, controls and decoys, and test it the same way.
4. Delete the classic quiz: the play and end screens, `stages`/`options` data, the classic fallback button, and map stars from `progress.levels`. Migrate or ignore old progress.
5. Then: MITRE bonus chips in Act 1, Practice and Challenge modes, Go Deeper (KQL hunting queries), and a fix for the 8-K link.
