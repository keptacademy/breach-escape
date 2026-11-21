# Breach Escape v2 redesign: status and handoff

Last updated: 2026-11-21. Branch `feature/restyle-d`, PR https://github.com/keptacademy/breach-escape/pull/4 (into `main`). PR #1, #2 and #3 are merged.
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
| `public/index.html` | Shell: loads `theme-init.js` (blocking, in `<head>`), `theme.css`, `levels.js`, `app.js`, `case.js`. `<main class="app case">`. |
| `theme-init.js` | Sets `<html data-theme="dark|light">` before the first paint: saved choice (`breach-escape-theme`), else the device setting. |
| `fonts/` | IBM Plex Sans + Mono 400/500/600 (latin woff2, from @fontsource 5.3.0) and `OFL.txt`. |
| `theme.css` | The only stylesheet, design D (round 15). Tokens per colour theme: `--bg --panel --raised --line --text --muted --accent --on-accent --sel-bg`, status `--ok/--ok-bg` (blocked) `--bad/--bad-bg` (breached) `--warn/--warn-bg` (attempted, PROMPTED) `--imp/--imp-bg` (impact), `--term --term-text`, `--case` (case colour from `data-case`), `--sans --mono`. `.c-tsurf` = terminal surface (dark in both themes). Classes prefixed `c-`. One-screen desktop layouts (`.c-fit`, 900px+), pinned bars, phone layouts, Breach Map. `<code>` uses a neutral style; yellow is only for decoys, the test tenant and ATTEMPTED. |
| `app.js` | App shell: Breach Map, progress in localStorage (`breach-escape-progress-v1`), glossary `termify`, shared helpers. Exposes `window.BreachEscape` (h, termify, shuffle, progress, onLeave, leave, renderMap, …). Boots on `DOMContentLoaded` so `case.js` is loaded first. |
| `case.js` | Case engine: case colour (`data-case`) + red edge flash (`BreachCase.backdrop()` is also used by the map), briefing renderer (block types: alert, note, panel, facts, timeline, diagram, glossary, mission), Act 1, Act 2 (`simulate()` then animate), results, shared drag-and-drop (Pointer Events, press-and-hold on touch). Text in backticks is rendered as `<code>`. |
| `levels.js` | `window.LEVELS` (map list; playable levels have `case: 'levels/<id>.json'`) and `window.GLOSSARY` (shared by all cases). |
| `levels/*.json` | All case content and rules. Act 2 stage codes are read from `timeline[].mitre` (single source). Act 2 keys added this pass: `preventedMaxStage`, `lossLabel`, `attemptedNote`, `mapCmd`, `outcomes.{prevented,contained,detected,succeeded}`, `logs.attempted`, `map.stages[].unblockable`. |
| `icons/` | App icon `>K_` in corner brackets on `#0B0E12` (silver brackets and K, ice-blue `>` and `_`): `icon.svg`, `favicon.svg`, PNGs 192/512/maskable 512/Apple 180/favicon 32. Made by `tools/make_icons.js` (shapes only, no fonts). |
| `brand/` | KEPT brand mark (KE / PT): `kept-mark.svg` (silver, ice-blue brackets) for dark, `kept-mark-light.svg` (ink, blue brackets) for light, + 1024 PNG. About header only. |
| `sw.js` | Offline cache, network-first. Currently `v43`; bump on every deploy. Caches all three case files, the icons, both brand marks and the six font files. |
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
- **Full e2e suite:** one run, all passing (allow-list check, sound, splash/reset, bad links, both cases at 1280×720, 1920×1080 and 390×844 under the production CSP, including the new stage 3 build and the reworded Colonial ★★★ build).
- `sw.js` `v24`.

## Round 9 (2026-11-20): pre-merge fixes
- **CodeQL (tests/serve.js):** the request path is resolved with `fs.realpathSync` (symlinks followed) and served only if the real path stays inside the served root; files are opened once, checked as regular files with `fstat` on the same handle, read and closed (no exists/stat-then-read). The 404 route list stays. New test: symlinks in a temp copy of `public/` that point outside it (a file and a directory) return 404; one pointing inside is served. Nothing under `public/` changed for this.
- **Source links (verified by Nura, not fetched):** MSRC blog now `msrc.microsoft.com/blog/2024/01/...` and the 8-K now links the filing itself (filed Jan 19, 2024; date of report Jan 17, 2024). Both carry `"verified"` (new optional schema field). Briefing text "Disclosed 19 Jan 2024 (SEC 8-K)" unchanged. Removed from the PR's "Review before merging" list; the MITRE stages 4–6 item stays.
- Validator: 0 errors, 25 warnings (quotes). One-off e2e checks rerun (sound, splash/reset, allow-list, symlinks, bad links): all pass. No full run, since no game behaviour changed. `sw.js` `v25` (a level file changed).

## Round 10 (2026-11-20): splash ending, ready for review
- **Splash ending:** after `clear` the cursor blinks alone (0.5 s), then K, E, P, T appear one at a time 300 ms apart (`textContent`), the tagline fades in (0.4 s) with K E P T in ice blue, the full screen holds **3.5 s**, then a 0.3 s fade to the map. The whole splash is about 10 s. Reduced motion: the finished KEPT + tagline screen at once, held 3.5 s, then a cut (no fade, no per-letter typing). Tap, key or "skip ›" still skips at any moment; the screen-reader label is unchanged.
- Tests: KEPT must appear letter by letter, the final screen must hold at least 3.4 s, and the reduced-motion screen must still be up at 3 s and gone by about 5.5 s.
- **Full e2e suite: one run, all passing** (3 sizes, both cases, production CSP, allow-list, symlinks, sound, splash/reset, bad links). This is the clean pre-merge run of the final code.
- Validator: 0 errors, 25 warnings (quotes). `sw.js` `v26`.
- PR #1 marked ready for review; merge left to Nura.

## Round 11 (2026-11-20): Breach Map redesign, source footnotes
- **Map header:** one line, never wraps: "KEPT ACADEMY" left; "?" help and stars right. Title "Breach Escape". The tagline stays on the splash and About only. "Real breaches, replayed. Investigate, then defend." and the 01/02/03 step line live in the map's "?" panel.
- **Hero card (option B):** one large ice-blue card, label "NEXT CASE": the first playable case without stars yet (case 01 on a first visit), with title, victim · year, teaser and "> OPEN CASE FILE". When every playable case has stars: "REPLAY A CASE", the case with the fewest stars, "> REOPEN CASE". It is the only highlighted element.
- **ALL CASES:** heading with "<n> of 7 playable"; compact rows (number, title, stars if any, "›"). Playable rows are whole-row buttons; SOON rows are plain divs, dimmer (`#9AA4AD`, about 8:1), not tappable, no lock icons.
- **Layout:** phones one column; 600–899px one column, max 720px; 900px+ hero ~60% | cases ~40%, top-aligned, max 1100px. The desktop hero adds the threat actor and year, read from the case briefing via `BreachCase.caseData` (fetched only at 900px+; a fact with a todo is never shown). No page scroll on the map at 1280×720.
- **Source footnotes:** inline "source: …" links are gone from the briefing, debrief timeline, tips and build list. Each sourced fact has a dim `[n]` button (numbered per case by first use: briefing, debrief timeline, tips, controls; same source = same number), 24×24px tap target with negative margins so lines don't grow, `aria-label` "Source n: title". It opens the numbered sources panel (the briefing's "sources" button, or the list at the end of the debrief and results) scrolled to and focused on that source: title, publisher, date, link (`rel="noopener noreferrer"`). Sources gained `publisher` and `date` fields (schema and the new-case template too); titles were split accordingly.
- Tests: map header, hero (first visit, returning player, all finished), case counts and rows, help panel, desktop actor row, no map scroll on desktop, footnote markers (format, label, size, opening the panel), no inline "source:" on briefing/debrief/results. The bad-link test now allows the hero's fetch of a known case file but nothing else.
- **Full e2e suite: one run, all passing** (sound, splash/reset, allow-list, symlinks, replay hero, bad links, both cases at 1280×720, 1920×1080 and 390×844 under the production CSP).
- Validator: 0 errors, 25 warnings. `sw.js` `v27`.

## Round 12 (2026-11-20): CI fix, brand icons, Uber 2022 case
- **CI:** the merge of PR #1 started a push run (#45) and a PR-closed run (#46) in the same concurrency group (`Scan and deploy-refs/heads/main`); #46 cancelled #45, so production never deployed. Group is now `github.event.pull_request.number || github.ref`, and `cancel-in-progress` is true only for `pull_request` events (runs on main queue, never cancel). Production has since deployed PR #1 (workflow #45 was re-run manually).
- **Brand icons:** `>K_` app icon replaces the green `>_` everywhere (manifest incl. SVG, `<link rel="icon">` SVG + 32 PNG, apple-touch-icon). KE / PT brand mark in the About header (160px, 120px on phones). `tests/serve.js` serves `.svg`.
- **Uber 2022 "MFA Fatigue"** (map #03, now playable). Sources: S1 Uber Newsroom "Security update" (Sept 15/16/19, 2022), S2 CISA "Implementing Number Matching in MFA Applications" (Oct 2022). Facts verified by Claude in chat on 2026-11-19 and used as given (nothing fetched). S2 facts carry quotes; S1 quote fields are empty (24 validator warnings, expected).
  - New `violet` case theme (`#B98CFF` accent, violet code rain; text 10:1+, accent 7.5:1+).
  - Act 1: 6 evidence cards + 2 red herrings, patient zero = the MFA log (requests, then one approved). Slack post before the OpenDNS change is the game's order; S1 doesn't give it (noted on the card).
  - Act 2: budget 7; 7 stages (1 unblockable, 3 = entry, `preventedMaxStage` 3, 7 = IMPACT "Uber takes internal tools down as a precaution"). Hidden asset at stage 3. Damage SEVERE at stages 5–6, never CRITICAL. No block control after stage 3, so "contained" can't happen in this case.
  - Recover controls: rotate keys (stage 5), lock codebase (stage 6), re-authenticate (stage 7), so every stage has a real control (validator rule).
  - Cheapest ★★★: audit (2) + number matching for contractors (2) + train staff (1) + rotate keys (2) = 7/7.
  - **Format change:** a timeline entry may have no ATT&CK code only if its map stage is `impact` (schema `minItems` removed; `tools/validate` checks it).
- **Validator:** 0 errors; 49 warnings (sourced facts without a quote: 14 Colonial, 11 Midnight, 24 Uber, all S1).
- **Tests:** Uber added to the suite (5 builds, violet theme, IMPACT on stage 7, never CRITICAL, desktop drag of the discovery control); map counts now 3 of 7 playable; returning splash `1/3 cases closed`. Full run 1: one failure, a test bug (the returning-splash test hard-coded `1/2`); fixed, rerun alone (ONLY=none), passed. Full run 2: **all passing** (sound, splash/reset, allow-list, symlinks, replay hero, bad links, all three cases at 1280×720, 1920×1080 and 390×844 under the production CSP).
- `sw.js` `v32`.

## Round 13 (2026-11-20): small fixes on PR #2
- **Unordered evidence (`anyOrder`):** real evidence cards that share an `anyOrder` value (consecutive orders) may fill each other's slots in either order, and both orders score as correct (`fitsNext()` in `case.js`). Uber E5 (Slack post) and E6 (OpenDNS change) share `stage-6`, since S1 gives no order. Schema field; `tools/validate` checks each group is 2+ real cards with consecutive orders.
- **Neutral stage (`neutral: {label, note, source}`):** a stage the attack passes without getting in yet. Shown as "⚠ LABEL" in the neutral (impact) style in the replay, log and results, with the note and a [n] source marker. Never BREACHED, no alarm or red flash. Uber stage 2: "⚠ PROMPTED", "The approval requests at first blocked access." [1]; the first BREACHED stage is now 3. Counted as a sourced fact by the validator (one more S1 quote warning).
- Production deployed PR #1 (workflow #45 re-run manually); that to-do is gone.
- Tests: the e2e places an `anyOrder` group in reverse and expects it valid; it checks neutral stages (label, note, marker, never BREACHED, and the next stage BREACHED when nothing blocks). Affected tests (Uber at 1280×720 and 390×844) passed; **one full run, all passing**.
- Validator: 0 errors, 50 warnings (Uber 25, all S1). `sw.js` `v34`.

## Round 14 (2026-11-20): desktop polish (PR #3, `feature/desktop-polish`)
On desktop (~1100–1440px) the game looked like a phone layout in the middle of a big screen. Phone layouts are unchanged except where an item asked for it (results tiles).
1. **Text size:** every font size in `theme.css` is rem. At 1024px+ the root is 18px and two tokens set floors: `--fs-l` 13px (labels: eyebrows, tags, pills, zone labels, chips, small print) and `--fs-b` 16px (body: paragraphs, briefing rows, glossary, timelines, evidence cards, map stages, log). Both are 0 below 1024px, so phones keep their sizes. Label columns (briefing kv, damage scale, sources) widen with the root, so "Threat actor" fits on one line.
2. **Widths:** reading screens 800px, work screens up to 1100px (see Layout below). Act 1 adds `c-readscreen` once the timeline phase ends; the briefing bar's inner row lines up with the column.
3. **Act 2 deck (900px+):** the deck takes the whole right column in 4 columns; zone label and cost share the card's top row; card titles use the label size (13px), not body size. The attack log is hidden until the sim runs and then takes the deck's place (the bar keeps the last message). The threat meter sits beside the title; under 820px high the intro line is left to the "?" panel. Every control card is visible without scrolling at 1024×768, 1280×720, 1366×768 and 1920×1080 in all three cases. Panels that scroll inside themselves (Act 2 map, Act 1 evidence, the deck if ever needed) show a thin scrollbar and a "more … ↓" cue (`scrollCue()`; click scrolls). Phones keep the stacked card, cost row and log, and their deck never scrolls inside itself (the page scrolls).
4. **Scoped controls:** new optional control field `scope` (schema too). The card label names it instead of the zone: Midnight "PRODUCTION TENANT · SCOPED", Colonial "KNOWN VPN PROFILES · SCOPED", Uber "EMPLOYEE ACCOUNTS · SCOPED". The aria-label says "Scoped to … only; goes on stage n", and a drop on the wrong zone uses the new `logs.wrongZoneScoped`. Placement and simulation unchanged.
5. **Bottom bar:** `pinBar()` keeps each screen's bottom padding equal to its pinned bar's real height + 12px (briefing, Act 1, Act 2; a hidden bar falls back to the CSS default). Last briefing page: "> OPEN THE EVIDENCE" is in the page right after the Your mission card; the bar keeps back and sources. The next button has class `c-briefnext` on every page.
6. **Act 1 full timeline:** "+ add to timeline" and the hint are disabled (also the A key and drops on the timeline); the hint reads "timeline complete" instead of "step 08". Not related stays active.
7. **Stat tiles:** Act 1 debrief 2×2 on phones, 4 across from 600px. Results: damage on its own row and the other three across under it; 900px+ one row with damage twice as wide.
8. **Splash:** checked with no input at 1280×720 and on iPhone 13: 7 login lines (4 commands, 3 outputs) → K, E, P, T 300 ms apart → tagline → 3.5 s hold → 0.3 s fade → map, about 10 s. No step skipped; no change needed.
- **Act 1 log preview (found by full run 1):** with the bigger desktop cards, the first click of a double-click opened the log preview under the evidence grid, the grid shrank, and the second click hit the preview. On desktop the preview now sits under the timeline (it scrolls that column only), so the evidence grid never resizes under the pointer. Phones keep it under the grid.
9. Tests: new `barCheck` (no screen block ends below the bar, scrolled to the end) on every briefing page, Act 1 and Act 2; last-page order check (button after the mission, not in the bar); full-timeline state check. The briefing next button is `.c-briefnext`.
- At 1280×720 the e2e sets `Math.random()` to 0, so the evidence shuffle is deterministic and puts the first real card last, below the evidence panel's fold (worst case for the drag test). Other sizes keep a real shuffle.
- **Test runs this round (per CLAUDE.md):** full run 1: one failure, 1280×720 Midnight (the double-click bug above, an app bug); fixed, that test rerun alone: passed. Full run 2: one failure, 1280×720 Midnight again, a test bug: the desktop drag grabbed the shuffled first card without scrolling it into view, so when the shuffle put it below the evidence panel's fold the press missed (the knock-on failures followed). Fixed (scroll into view, like the phone branch) and made deterministic (above); checked that the pinned order fails without the fix (7 failures) and passes with it (rerun alone). Every other test passed in both full runs (sound, splash/reset, allow-list, symlinks, replay hero, bad links, all three cases at 1920×1080 and 390×844, Colonial and Uber at 1280×720). No third full run, per the two-run limit. **Before merging, one clean full run of the final code is still required.**
- Screenshots (1280×720, Midnight Blizzard): `docs/redesign/screenshots/round14/` (briefing alert, briefing mission, Act 1, Act 1 timeline full, debrief, Act 2 with discovery deployed, results). Not deployed.
- Validator: 0 errors, 50 warnings (quotes, unchanged). `sw.js` `v42`.

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
  - Reading screens (briefing, About, Act 1 patient zero + debrief, results) share one 800px column at 900px+ (640px below); work screens (map, Act 1 board, Act 2) go up to 1100px. Phones stack everything above a pinned bottom bar whose height is the screen's bottom padding.
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
- **Uber 2022 ATT&CK codes (user's mapping, for review):** 1 T1597.002 · 2 T1621 · 3 T1078 · 4 T1078, TA0004 · 5 T1213 · 6 T1491.001 · 7 none (impact: Uber's precaution).
- **Sources** (primary only; checked 2026-11-19):
  - MSRC Blog, Jan 19 2024: https://msrc.microsoft.com/blog/2024/01/microsoft-actions-following-attack-by-nation-state-actor-midnight-blizzard/ (verified by Nura, 2026-11-20)
  - Microsoft Security Blog, Jan 25 2024: https://www.microsoft.com/en-us/security/blog/2024/01/25/midnight-blizzard-guidance-for-responders-on-nation-state-attack/
  - SEC Form 8-K, filed Jan 19 2024 (date of report Jan 17 2024): https://www.sec.gov/Archives/edgar/data/789019/000119312524011295/d708866d8k.htm (verified by Nura, 2026-11-20)

## Rules that always apply
- Strict CSP, unchanged: no inline `<script>` and no `style=""` attributes (setting styles from JS, e.g. `el.style.width`, is fine). No `innerHTML`; build DOM with `h()` or `createElementNS`, text via `textContent`.
- No outside requests: self-hosted IBM Plex only (`font-src 'self'`), no CDNs or analytics. No new packages without asking.
- Never push to `main`. Work on `feature/restyle-d`; PR #4 is the review vehicle.
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
- **Not tested on real devices:** touch drag (press-and-hold) was only checked in iPhone 13 emulation. iOS Safari and Android Chrome still need a real check.
- **Tight fit at 1280×720:** every Act 2 control fits with 0–25px to spare (Midnight's 18 controls are the tightest); the map scrolls in its column. Under about 700px high the deck needs its own scroll (the "more controls ↓" cue shows). A case with more or longer controls must be rechecked at 1280×720.
- **Phones:** the page scrolls in Act 1 and Act 2 (accepted).
- **Not reviewed:** CodeQL and preview results on PR #1 haven't been looked at.
- **About contact email:** not set. Add it in `levels.js` (`window.SITE.contactEmail`); the row appears automatically.
- **Not built:** share cards, a settings screen and a separate glossary screen don't exist (the spec mentions a shareable score card). Glossary definitions show in the in-case panel.

## What's next (in order)
0. Add short quotes from the sources for the remaining validator warnings (25 Midnight/Colonial, 24 Uber S1).
0b. Review the Uber 2022 ATT&CK mapping and case design (Nura).
1. Verify the Colonial `todo` facts against AA21-131A and the DOJ release, then remove the `todo` fields.
2. Review the Colonial content and ATT&CK mapping (Nura).
3. MITRE bonus chips in Act 1, Practice and Challenge modes, Go Deeper (KQL hunting queries), 
4. Share card for results (spec 2.6), if still wanted.
