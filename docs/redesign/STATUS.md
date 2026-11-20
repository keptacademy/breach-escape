# Breach Escape v2 redesign: status and handoff

Last updated: 2026-11-20. Branch `claude/keen-pasteur-o2a3hp`, draft PR https://github.com/keptacademy/breach-escape/pull/1 (into `main`).
Live v1 quiz is saved as tag `v1-quiz` (`e0df885`, main's commit before this work).

## Goal
Turn each level into a "case": **Intel briefing → Act 1 Investigate → Act 2 Defend → Results**, in a dark SOC
terminal look (from `prototype-v2.html`), run by one data-driven engine so every breach is just a JSON file.
Spec: `level-spec-midnight-blizzard.md` (facts win from the spec, look and flow from the prototype).

## What's built
| Screen | State | Commits |
|---|---|---|
| Level 1 JSON (`levels/midnight-blizzard.json`) | Done: briefing, evidence, timeline, map, controls, scoring, outcomes, tips, logs | `0c01200` and later |
| Level 2 JSON (`levels/colonial-pipeline.json`) | Done (spec build step 5): 5-page briefing, 6 real evidence cards + 2 red herrings, patient zero E2, hints, 4-zone map with 6 stages, 7 controls + 6 decoys, outcomes, tips. Unverified facts carry a `todo` field and are listed in its `verify` array | this pass |
| Intel briefing (5 pages) | Done. Pinned footer (back / sources toggle / NEXT), BRIEFING tag instead of XP, "‹ exit to map" | `0c01200`, `8dcf21a` |
| Act 1 Investigate | Done. Evidence cards → timeline (drag or tap + buttons, keys A/X/H), red herrings to Not related, hints (−10 XP), patient zero, debrief with the real timeline and sources | `0c01200`, `53baeb2`, `8dcf21a` |
| Act 2 Defend | Done. Zone map with stages, control deck (budget 10, tap or drag onto a stage), replay ~0.7 s per stage with log. A stage marked `unblockable` (stage 1 in both cases) shows "⚠ ATTEMPTED" in yellow instead of "✕ BREACHED" | `5126333`, this pass |
| Results | Done. Title by outcome (see Decisions), stars, rank, stats, tips, stage-by-stage replay list, build breakdown, Try another build, Restart case | `5126333`, this pass |
| Breach Map | Terminal theme. Stars per level come from `progress.cases[id].act2.bestStars`; a level counts as cleared at 1 star or more | this pass |
| Old mascot, light theme and classic quiz | **Removed** (code, drawings, icons, CSS, text) | this pass |
| CI | PR preview deploy + close jobs; production unchanged | `8dcf21a` |

Tested in headless Chromium under the production CSP header (served locally over http, so without `upgrade-insecure-requests`) at 1280×720, 1920×1080 and 390×844 (iPhone 13 emulation), both cases end to end:
briefing → Act 1 (first card dragged: mouse on desktop, press-and-hold touch via CDP on the phone) → patient zero → Act 2 (one control dragged onto its stage on desktop) → four builds per case, one per outcome, the first one animated.
No console errors or warnings, no CSP violations, no outside requests, no page scroll on desktop in Act 1 or Act 2, all visible text at 4.5:1 or better.
The Breach Map itself scrolls at 720 px high (it lists 7 levels); that's allowed.

## File map
| File | What it does |
|---|---|
| `public/index.html` | Shell: loads `theme.css`, `levels.js`, `app.js`, `case.js`. `<main class="app case">`. |
| `theme.css` | The only stylesheet: terminal theme for every screen. Colour tokens on `:root` (`--c-*`), classes prefixed `c-`. One-screen desktop layouts (`.c-fit`, 900px+), pinned bars, phone layouts, Breach Map. `<code>` uses a neutral style; yellow is only for decoys, the test tenant and ATTEMPTED. |
| `app.js` | App shell: Breach Map, progress in localStorage (`breach-escape-progress-v1`), glossary `termify`, shared helpers. Exposes `window.BreachEscape` (h, termify, shuffle, progress, onLeave, leave, renderMap, …). Boots on `DOMContentLoaded` so `case.js` is loaded first. |
| `case.js` | Case engine: code rain + red edge flash (`BreachCase.backdrop()` is also used by the map), briefing renderer (block types: alert, note, panel, facts, timeline, diagram, glossary, mission), Act 1, Act 2 (`simulate()` then animate), results, shared drag-and-drop (Pointer Events, press-and-hold on touch). Text in backticks is rendered as `<code>`. |
| `levels.js` | `window.LEVELS` (map list; playable levels have `case: 'levels/<id>.json'`) and `window.GLOSSARY` (shared by all cases). |
| `levels/*.json` | All case content and rules. Act 2 stage codes are read from `timeline[].mitre` (single source). Act 2 keys added this pass: `preventedMaxStage`, `lossLabel`, `attemptedNote`, `mapCmd`, `outcomes.{prevented,contained,detected,succeeded}`, `logs.attempted`, `map.stages[].unblockable`. |
| `icons/` | Terminal-style icons (`>_` in corner brackets), generated offline. |
| `sw.js` | Offline cache, network-first. Currently `v18`; bump on every deploy. Caches both case files. |
| `staticwebapp.config.json` | Strict CSP and security headers; 404 for `/docs/*`, `/*.md`, `/.github/*`. Unchanged. |
| `.github/workflows/deploy.yml` | CodeQL → production deploy (push to main only, `production` environment). PRs: `preview` job deploys an Azure preview environment, and `close_preview` removes it when the PR closes. Fork PRs are skipped. |
| `.github/dependabot.yml` | Weekly updates for the pinned Actions. |
| `docs/redesign/` | Spec, prototype, this file. Not served (404 route). |

Saved progress: `progress.cases[caseId] = { briefed, act1: {done, bestXp, bestTime, fewestMistakes}, act2: {bestStars, bestBuild, lastStars, runs} }`.
Old `progress.levels` (classic quiz stars) is ignored, not migrated.

## Round 3 (2026-11-20)
| Change | Where |
|---|---|
| **Per-case themes.** `theme` field in each level JSON (`green` default, `amber` for Colonial). `case.js` sets `<html data-theme>`; `:root[data-theme="amber"]` in `theme.css` overrides only the accent tokens. Map and About always use the default. | `theme.css`, `case.js`, `levels/*.json` |
| Theme tokens: `--c-g` primary, `--c-g2` soft accent, `--c-g3` border, `--c-g4` dim border/track, `--c-txt` text, `--c-mute` secondary text, `--c-panel` / `--c-panel2` panel fills, `--c-panel-a` / `--c-panel-soft` translucent panels, `--c-wash` selected/blocked tint, `--c-cardsrc` drag-ghost label, `--c-rain` rain glyph colour (`none` = off), `--c-scan` scanline overlay (0/1). Unchanged in every theme: `--c-bg`, `--c-red`, `--c-redbg`, `--c-y`. | `theme.css` |
| Amber: `#FFA630` accent on the same dark base, warm panels, no code rain; a faint scanline overlay (`body::after`) drifts slowly and is static with reduced motion. | `theme.css` |
| Map titles: "The Forgotten Test Account", "The Legacy VPN"; Colonial teaser "One legacy VPN profile, password only." | `levels.js` |
| Briefing alert: opening line from `briefing.opening`, "Threat actor" row from `briefing.threatActor` (inserted after Victim). | `case.js`, `levels/*.json` |
| SOC LEAD voice: `window.VOICE` defaults in `levels.js`, per-case `voice` in the JSON. Shown in the Act 1 toast (patient zero, wrong evidence, hint), the Act 2 log (build executed) and the results card (contained for prevented/contained, breached for detected/succeeded). The same line never shows twice in a row. "voice: on/off" toggle on the map footer and in both "?" help panels, saved as `breach-escape-voice`. | `case.js`, `levels.js`, `levels/*.json` |
| Breach Map intro text and step line; footer with "> about" and the voice toggle. | `app.js` |
| About screen: not affiliated, sources, privacy, who made this with links (`rel="noopener noreferrer"`). Contact email shows only when `window.SITE.contactEmail` is set (empty for now). | `app.js`, `levels.js` |
| Opening splash, ~2 s, once per browser session (`sessionStorage` `breach-escape-splash`), skipped on `#case/<id>` links, any click/tap/key skips it (that tap doesn't reach the map). One `role="img"` label, focus never moves. Reduced motion: static logo and tagline for 0.9 s. | `app.js`, `theme.css` |
| Direct case links: `#case/<case-id>` opens that case's briefing (no splash). | `app.js` |
| `sw.js` `v19`. | `sw.js` |

Checks this round (same harness as before, all passing at 1280×720, 1920×1080, 390×844 under the production CSP): no console errors or CSP violations, no outside requests, no desktop page scroll in Act 1/Act 2, all visible text 4.5:1 or better in both themes (scanline overlay not included in the measurement; it adds at most 4.5% amber over the base), touch drag, theme switch and reset, threat actor row and opening line, SOC LEAD lines and the no-repeat rule, voice toggle persists over a reload, About links, splash once per session and not on direct links, and the bottom 6 pixel rows at the end of the map, About and results pages are the dark base (no blue gradient anywhere; the old glass `body::before` was removed in round 2).
The installed-PWA splash uses `background_color` `#010603` and the green `>_` icon, which matches the in-app splash.


## Round 4 (2026-11-20)
- `CLAUDE.md` added in the repo root: testing rules (one full end-to-end run per round, max two, fix flaky tests instead of rerunning) and the project rules.
- `#case/<id>` links: the id is compared exactly against the known case ids from `LEVELS` before anything loads. A malformed or unknown id is ignored: the Breach Map shows, no case file is fetched, the id is never written to the page, and the hash is removed from the address bar.
- Midnight Blizzard: APT29 `todo` closed. Source added: Microsoft Security Insider, Midnight Blizzard profile (https://www.microsoft.com/security/security-insider/midnight-blizzard), verified by Nura. It also backs the "Also tracked as" row on briefing page 2.
- New test: `#case/../../evil` and `#case/unknown` land on the map with no case fetch and nothing echoed. Full suite: one run, all passing.
- `sw.js` `v20`.


## Round 5 (2026-11-20): sound effects
- Optional sound, **off by default**, synthesized with the Web Audio API in `app.js` (`BE.sound(name)`); no audio files, no CSP change (CSP doesn't cover `AudioContext`, and nothing loads media).
- Sounds: `tick` (briefing pages 2–5), `alert` (SEV 1 alert page), `blip` (correct evidence, red herring dismissed, patient zero, control deployed, sound switched on), `alarm` (first breached stage in a replay), `contained` (blocked stage). With reduced motion the replay is skipped, so the outcome sound plays with the results.
- Nothing plays and no `AudioContext` is created before the first click, tap or key press. Master volume 0.12. Every sound goes with text already on screen.
- The splash typing tick never plays: the splash runs on page load before any gesture, and any gesture ends it.
- "sound: on/off" toggle (saved as `breach-escape-sound`) next to the voice toggle in the map footer and in both "?" help panels, same style.
- Test added: off by default, no `AudioContext` before a gesture, toggle saved over a reload, toggle in the help panel. Full suite: one run, all passing.
- `sw.js` `v21`.


## Round 6 (2026-11-20)
- **Brand theme** `:root[data-theme="brand"]`: soft cyan `#6FE3F5` on the same dark base, cyan code rain. Used by the Breach Map, About and the opening splash (so splash → map is continuous). Cases keep green / amber.
- **Splash** is now a ~5.5 s terminal login (`ssh analyst@kept-soc` → `whoami` → `load ./season-1` → `clear` → KEPT + tagline + cursor → fade). Commands type with 40–72 ms per character; output appears at once. Returning players (any saved case) see `[ok] welcome back · x/N cases closed`; N = ready cases in `LEVELS`. Visible "skip ›" button; any click/tap/key skips; only the click from the skipping tap is swallowed. Reduced motion: the static logo for 1 s. Typing tick sound (`key`) is wired, but browsers block audio before a gesture and any gesture ends the splash, so in practice it is silent.
- **About:** new privacy text (checked: localStorage keys `breach-escape-progress-v1`, `breach-escape-voice`, `breach-escape-sound`, sessionStorage `breach-escape-splash`, no cookies set by the code, no outside requests), "Last updated: 2026-11-20", "KEPT Academy — Know the Exposure, Patch the Threat". "Reset my progress" asks in-page, then removes only those three localStorage keys and returns to the map. The old KEPT expansion appeared only in `app.js`.
- **Act 1:** when the timeline is full and cards remain, the message bar says "Timeline complete. N cards left: mark them Not related to close the case." and Not related gets a red outline (pulses 3 times only without reduced motion). Desktop double-click (two mouse clicks on the same card within 400 ms, timed per card because each click redraws the grid) and Enter on a focused card add it like a drop. Help tip added.
- **Act 2 redesign:**
  - Effects are now `block | detect | recover | reveal | decoy` (`limit` removed). Layers: block = prevent, detect, recover.
  - `map.hidden`: Midnight "Legacy, non-production test tenant account · no MFA" (blog), Colonial "Legacy VPN profile · single-factor" (hearing). Until a `reveal` control is deployed, block controls on that stage are "scoped" and the attack goes through the hidden asset ("entered via an asset not in your inventory"). `needs: "reveal"` controls are locked until then; `coversHidden: true` controls cover it once found (Colonial MFA on the VPN gateway: yes; Midnight production-tenant Conditional Access: no).
  - Midnight (budget 9): Conditional Access MFA (production tenant), Inventory non-production tenants (discovery), Require MFA in the test tenant / Decommission the legacy test tenant (need discovery), ID Protection, Least privilege for apps, Admin consent only, PIM, OAuth app governance, Scope app mailbox access (now block at 7), EWS alert, Rehearsed IR runbook (recover), 5 decoys.
  - Colonial (budget 8): MFA on the VPN gateway (known profiles), Audit remote-access (VPN) profiles (discovery), Disable the legacy VPN profile (needs discovery, 1), EDR, outbound-transfer alerts, incident response plan (detect), Offline, tested backups (recover, 3), Segment IT from OT, 6 decoys.
  - Stars: 1 stopped · 2 + a detect control at a later stage than the stop · 3 + a recover control. Decoys no longer cost a star. Cheapest 3-star builds: Midnight 9/9 (discovery + test-tenant MFA + EWS alert + runbook), Colonial 8/8 (audit + disable + outbound alerts + backups).
  - Damage = what the attacker reached, from `reach`/`severity` on the stages that ran: NONE (stopped at entry) / CONTAINED / SEVERE / CRITICAL; scale and star rules are in the Act 2 "?" panel. Detection and recovery don't change damage.
  - Colonial stage 6 is `impact`: "◆ IMPACT", neutral, with the note that it was Colonial's own decision. Never BREACHED.
  - Results: damage label + reach line, defense layers (prevent / detect / recover), new tips (unknown asset, add detection, add recovery) that never name a winning control.
- **Unverified facts are never shown:** anything with a `todo` (kv rows, timeline items, sources, tips, threat actor) is filtered out by the engine. Colonial now shows only Blount's testimony and the hearing record; its briefing note names only those. The CISA tip, the DarkSide "Model" row, the DOJ timeline row and the CISA/DOJ source links are hidden until verified.
- Tests: splash (brand, load line, returning line, skip, reduced motion), About reset, double-click, Enter, red-herring call-out, locked control, 5 builds per case with expected stars and damage, IMPACT on stage 6, no todo text. `sw.js` `v22`.
- Test runs this round (per CLAUDE.md): full run 1 stopped at the About reset check. App bug: the splash swallowed the next click for 600 ms after "skip ›". Fixed (only the click from the skipping tap is swallowed); that test was rerun alone and passed. Full run 2: one failure at 1280×720 Midnight. Test bug: the dragged control card was below the fold of the deck panel. Fixed (scroll the card into view); rerun alone, passed. A new-screen screenshot then showed the KEPT logo visible during the typing (CSS `display:flex` overrode `hidden`); fixed (`.c-splash [hidden]`), the test now checks visibility, rerun alone (390×844 Midnight), passed. No third full run, per the two-run limit.


## Round 7 (2026-11-20)
- CLAUDE.md: push after every numbered item; one extra clean full run is required before a merge to main.
- About "Last updated" is 2026-11-19 (the local date).
- Sound: game events only (SEV 1 alert when a case opens, evidence placed / patient zero / control deployed, breach alarm, contained). No sound on Next/Back, skip, exit, help or toggles. Typing tick removed everywhere. Tones lowered and softened (alert 392/294 Hz, blip 330→440 Hz, alarm 220/165 Hz, contained 262-330-392 Hz).
- Stars (wording and rules in each level's `stars`): ★ stopped at any stage · ★★ stopped at the entry stage (`act2.preventedMaxStage`, damage NONE), which needs the hidden asset discovered · ★★★ ★★ plus at least one detect and one recover control anywhere in the build. Results show what the next star needs; the "?" panel lists the rules; tips `notEntry` / `needLayers` replace `noDetect` / `noRecover`. Budgets unchanged: cheapest ★★★ is 9/9 (Midnight) and 8/8 (Colonial).
- SOC LEAD results line follows the damage label: NONE → "Prevented. They never got in.", CONTAINED → "Contained. That's the job.", SEVERE/CRITICAL → the breached line. A new attack run may repeat the previous run's line.
- Brand theme (Breach Map, About, splash): silver `#E8EDF2` titles/text, `#9AA4AD` secondary, `#3A424A` borders; ice blue `#8DB7FF` only on buttons (outlined, faint tint on hover), links, stars, selected/hovered card border, focus outline and the progress count. New `--c-title` token (defaults to the case accent, so green and amber cases are unchanged). Splash: silver, with K E P T of the tagline in ice blue.
- Full e2e suite: **one clean run, all passing** (3 sizes, both cases, CSP headers). This is the pre-merge clean run of the gameplay code. `sw.js` `v23`.
- **Deploy check:** `.github/workflows/deploy.yml` deploys the repo root (`app_location: "/"`, `skip_app_build: true`), so every folder is served unless a route blocks it. Added 404 routes for `/tools/*`, `/tests/*` and `/.git/*` (`/docs/*`, `/.github/*`, `/*.md` and `/.gitignore` were already blocked). `sw.js` never caches `tools/`.
- **Toolchain** (Python, standard library only; run from the repo root):
  - `tools/level.schema.json`: JSON Schema (draft 2020-12) for `levels/<id>.json` as both levels use it, plus optional `quote` on sourced facts. `python3 tools/schema_check.py` checks it with no dependencies (both levels pass; also checked with the `jsonschema` package).
  - `tools/new_case <id> "<Title>"`: writes `levels/<id>.json` from a template (placeholders only, every fact marked `todo`; the hidden asset's open question goes in `verify`, since the game always shows its name) and adds the case to `levels.js` as SOON. Refuses to overwrite a file or reuse a case id.
  - `tools/validate [files]`: errors and warnings as listed in its header; exit 1 on errors.
- **Validator report (2026-11-20): 11 errors, 26 warnings.**
  - Colonial Pipeline (ready): 10 errors, all "playable case has a todo": the CISA and DOJ sources, the DarkSide "Model" row, the DOJ timeline row, the CISA tip, and the 5 `verify` entries. The game hides all of them, but the rule says a playable case has none. Options: verify them, delete them, or set the case to SOON.
  - Midnight Blizzard (ready): 1 error: stage 3 "Use Legacy-Test-App" has only a decoy (antivirus upgrade), no real control. Gameplay change needed (not made in this toolchain round).
  - Warnings: every sourced fact lacks a short `quote` (15 Colonial, 11 Midnight). Listed only; no quotes were invented.

## Round 8 (2026-11-20)
- **Allow-list deploy.** Shipped files live in `public/` (index.html, app.js, case.js, levels.js, theme.css, levels/, icons/, manifest, sw.js, staticwebapp.config.json). Both Azure jobs (production and PR preview) use `app_location: "public"`; SWA reads `staticwebapp.config.json` from there. The 404 routes stay as a second layer. Everything else (CLAUDE.md, README, docs/, tools/, tests/, .github/) is never uploaded. All runtime paths were already relative, so `sw.js` paths are unchanged.
- **Tests in the repo:** `tests/serve.js` serves `public/` with the production headers and its 404 routes; `tests/e2e.js` is the suite (Playwright from the dev environment, not a project dependency). New check: repo files and path tricks (`../`, `%2e%2e/`) all return 404 locally.
- **Colonial facts verified** (by Nura, against AA21-131A of May 11, 2021 and the N.D. Cal. DOJ release): DarkSide RaaS row, MFA tip, segmentation + offline backups tip, "June 2021" DOJ seizure row (63.7 of ~75 bitcoin, over $2.3M), corrected source titles and URLs, each with a quote. `verify` list removed; the case has no todos.
  - Outbound control: reworded to **"Block traffic to known-malicious IPs"** (stage 4, block, cost 2) citing AA21-131A; the teach line says it's a game assumption that the destination was on a known-bad list. EDR stays a game control with no citation. Cheapest ★★★: audit + disable + incident response plan + backups (8/8).
- **Midnight Blizzard stage 3:** "Remove unneeded app mailbox permissions (`full_access_as_app`)", cost 2, block, citing the Jan 25, 2024 guidance ("If they are no longer required, they should be removed."). It takes the power away from the legacy app the attacker holds (the bridge at stage 3); "Scope app mailbox access" at stage 7 limits which mailboxes any app can reach. ★★★ path unchanged (9/9).
- **Schema/validator:** quotes may be a list; sources and quotes allowed on briefing timeline items, controls and tips; `tips.always` may be one tip or a list (the engine shows each).
- **new_case:** converts a SOON map entry with the same title instead of adding a duplicate card; refuses if that entry already has a case or isn't SOON.
- **Validator report:** 0 errors on both levels; 25 warnings (sourced facts without a quote: 14 Colonial, 11 Midnight).
- `sw.js` `v24`.

## Decisions made
- **Act 1 scoring:** +50 for each correct placement, +30 per red herring dismissed, −20 per mistake, −10 per hint, +100 for patient zero. XP never goes below 0.
- **Act 2 scoring:** ID Protection is **detect** (no random chance). **3 stars** = blocked at stage ≤ 2 **and** no decoys; **2** = blocked later (or early with decoys); **1** = only detected or limited; **0** = breach succeeded.
  - Results title: blocked at stage ≤ `preventedMaxStage` (2) → "Breach prevented"; blocked later → "Breach contained" (Midnight: "…before the mailboxes", Colonial: "…before the pipeline"); only detected or limited → "Breach detected"; not stopped → "Breach succeeded".
  - Stage 1 in both cases is `unblockable` (it happens outside the defender's network): "⚠ ATTEMPTED" in yellow, no red flash.
  - Each run is worth Act 1 XP + 150 per star; runs don't stack.
  - Loss stat, labelled by `lossLabel`. Midnight "mailboxes lost": 0 if blocked, FEW if detected and limited, SOME if only one, MANY if nothing worked. Colonial "damage": NONE, IT ONLY (contained), REDUCED / SOME (detected), SEVERE.
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
- **Colonial Pipeline content:**
  - Stages: 1 Attacker gets a valid VPN password (outside, unblockable) · 2 Sign in via the legacy VPN profile · 3 Move through IT systems · 4 Copy data off the share drive · 5 Encrypt IT systems · 6 Pipeline shut down to protect OT.
  - Winning builds: MFA on every VPN profile, or Disable unused accounts & VPN profiles (block at 2, 3 stars); Segment IT from OT (block at 6, contained); EDR, outbound-transfer alerts and the incident response plan (detect), offline backups (limit).
  - Decoys: password complexity (Blount: it was already complicated), lockout, geo-block, login banner, disk encryption, cyber insurance.
  - Checked against Blount's written testimony and his answers in the Senate hearing record. Old quiz facts from Mandiant / the House hearing were dropped (not an allowed source), and so were the April 29 entry date, the 75 / 63.7 bitcoin figures and "no failed attempts".
  - The Colonial ATT&CK codes (T1589.001, T1133, T1078, TA0008, T1039, T1486, TA0040) are a mapping to review, like Level 1's.
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
- **Colonial "TODO: verify" facts.** CISA and DOJ refused automated access, so these weren't checked. Each is a `todo` field in the JSON and is listed in its `verify` array:
  1. DarkSide described as ransomware-as-a-service with affiliates (briefing page 2), against AA21-131A.
  2. AA21-131A recommends MFA for remote access to IT and OT (Act 2 tip).
  3. AA21-131A recommends IT/OT segmentation and regular offline backups (Act 2 tip).
  4. AA21-131A wording on endpoint detection (EDR control) and on monitoring outbound traffic (egress control).
  5. DOJ announced on June 7, 2021 that it seized part of the ransom (briefing timeline).
  6. AA21-131A and DOJ titles, dates and URLs.
- **The PR preview secret isn't set:** the `preview` jobs need `AZURE_STATIC_WEB_APPS_API_TOKEN` in a GitHub environment called `preview` (or as a repository secret). Until then the PR preview run fails.
- **8-K link:** points to the filings list, not the filing itself. Replace it with the direct document URL once confirmed.
- **Not tested on real devices:** touch drag (press-and-hold) was only checked in iPhone 13 emulation. iOS Safari and Android Chrome still need a real check.
- **Tight fit at 1280×720:** Act 2 uses the inner map scroll; at heights under about 650px, panels get cramped.
- **Phones:** the page scrolls in Act 1 and Act 2 (accepted).
- **Not reviewed:** CodeQL and preview results on PR #1 haven't been looked at.
- **About contact email:** not set. Add it in `levels.js` (`window.SITE.contactEmail`); the row appears automatically.
- **Not built:** share cards, a settings screen and a separate glossary screen don't exist (the spec mentions a shareable score card). Glossary definitions show in the in-case panel.

## What's next (in order)
0. Add short quotes from the sources for the remaining 25 validator warnings.
1. Verify the Colonial `todo` facts against AA21-131A and the DOJ release, then remove the `todo` fields.
2. Review the Colonial content and ATT&CK mapping (Nura).
3. MITRE bonus chips in Act 1, Practice and Challenge modes, Go Deeper (KQL hunting queries), and a fix for the 8-K link.
4. Share card for results (spec 2.6), if still wanted.
