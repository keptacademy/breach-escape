# Breach Escape — Level Spec: Midnight Blizzard (v2 redesign)

Game format: **Act 1 Investigate (detective board) → Act 2 Defend (tower defense on a cloud map) → Results**
Audience: career changers / juniors (SC-300, SC-200, Security+). Desktop + phone. PWA, no backend in v1.

> Legend used in this spec
> - **[FACT]**: documented in a primary source (Microsoft MSRC / Microsoft Security blog). Nura verifies before ship.
> - **[MAPPING]**: Claude's MITRE ATT&CK mapping. Nura reviews.
> - **[DESIGN]**: game design decision (suggestion, change freely).
> - **[ILLUSTRATIVE]**: recreated for gameplay (e.g. log rows); must be labelled in-game as "recreated for training".

---

## 0. Sources (primary only)

- MSRC, *Microsoft Actions Following Attack by Nation State Actor Midnight Blizzard*, 19 Jan 2024
- Microsoft Security Blog, *Midnight Blizzard: Guidance for responders on nation-state attack*, 25 Jan 2024
- Microsoft SEC Form 8-K, 19 Jan 2024 (timeline)

## 1. What happened (the story the level teaches)

| # | Stage | Source | Notes |
|---|---|---|---|
| 1 | Activity began **late November 2023** | [FACT] 8-K | Briefing screen |
| 2 | **Password spray** against a **legacy, non-production test tenant account with no MFA**, using **residential proxies** and a **low number of attempts** to avoid detection/lockout | [FACT] Jan 25 blog | Entry point |
| 3 | Compromised a **legacy test OAuth application** that had **elevated access to the Microsoft corporate environment** | [FACT] | The pivot |
| 4 | Created **additional malicious OAuth applications** | [FACT] | Persistence |
| 5 | Created a **new user account** to **grant consent** in the corporate environment to the actor-controlled apps | [FACT] — verify exact wording in Jan 25 blog | |
| 6 | Used the legacy test app to grant the **Office 365 Exchange Online `full_access_as_app`** role → access to mailboxes | [FACT] | Impact |
| 7 | Accessed a **small percentage of corporate email accounts** incl. **senior leadership, cybersecurity, legal**; searched for info about Midnight Blizzard itself | [FACT] MSRC Jan 19 | Impact |
| 8 | **Detected 12 Jan 2024**; disclosed 19 Jan 2024 | [FACT] | Debrief |

### MITRE ATT&CK per stage [MAPPING — review]

| Stage | Technique |
|---|---|
| Residential proxies | T1090 Proxy |
| Password spray | T1110.003 Brute Force: Password Spraying |
| Use of the sprayed account | T1078.004 Valid Accounts: Cloud Accounts |
| New user account | T1136.003 Create Account: Cloud Account |
| Granting app roles / consent | T1098.003 Account Manipulation: Additional Cloud Roles |
| Using OAuth apps' tokens | T1550.001 Use Alternate Authentication Material: Application Access Token |
| Reading mailboxes | T1114.002 Email Collection: Remote Email Collection |

---

## 2. Screen flow

```
Briefing → Act 1: Evidence Board → Timeline Reveal → Act 2: Defense Map → Replay Attack → Results → Go Deeper
```

### 2.1 Briefing (30 seconds)
- Text [DESIGN]: "January 12. Your security team just spotted something inside the corporate mail system. You have the logs. Find out how they got in, then make sure it can never happen again."
- Shows: target company (Microsoft, real breach), actor name, two act icons.
- Button: **Open the evidence**.

### 2.2 Act 1: Evidence Board [DESIGN]
Goal: reconstruct the attack. **No multiple choice.**

Layout:
- Left: **evidence cards** (stack/drawer on phone).
- Right: an empty **timeline** with 6 slots, plus a **"Patient zero"** slot.

Evidence cards [ILLUSTRATIVE, based on FACT stages]:
| ID | Card | Looks like |
|---|---|---|
| E1 | Sign-in log: hundreds of accounts, 1–2 failed attempts each, many different residential IPs | table snippet |
| E2 | Sign-in log: **success** for `svc-test@<legacy-test-tenant>`, MFA: *not required* | single row, highlighted |
| E3 | Audit log: **new credential added** to app "Legacy-Test-App" | audit row |
| E4 | Audit log: **new OAuth apps registered** (2 unknown names) | audit row |
| E5 | Audit log: **new user created** in corporate tenant → **consent granted** to the new apps | 2 rows |
| E6 | Audit log: **app role assigned**: `full_access_as_app` (Office 365 Exchange Online) | audit row |
| E7 | Exchange (EWS) activity: app reading mailboxes of leadership / security / legal | activity row |
| D1 | **Red herring:** malware alert on a marketing laptop (unrelated) | Defender alert |
| D2 | **Red herring:** account lockout for a user who forgot her password | sign-in row |

Player actions:
1. Drag cards into timeline order (6 correct cards; red herrings belong in a **"Not related"** tray).
2. Drag the card that shows the **first successful access** into **Patient zero** (answer: E2).
3. Optional bonus: tap a card → choose its MITRE technique from a short list (chips, not a quiz page).

Feedback:
- A wrong placement **wobbles back** with a one-line hint ("This happened after the attacker already had an app").
- Hints cost points (existing hint system).
- **Glossary taps** on terms (password spray, OAuth, consent, `full_access_as_app`).

Scoring Act 1: accuracy, hints used, time (soft, no hard timer in Practice mode).

### 2.3 Timeline Reveal (debrief)
- The board animates into the **real timeline** (section 1), with dates and sources.
- One line per stage: "What the attacker did → why it worked".
- Transition text: "Now rewind. You're Microsoft's security team in October 2023. Stop it."

### 2.4 Act 2: Defense Map [DESIGN]
Goal: place controls on a cloud map with a **budget of 10**, then replay the attack.

**Map nodes** (terminal panels on the dark theme):
```
[Internet / residential proxies]
        │
[Legacy TEST tenant] ── test account ── Legacy-Test-App ──┐
                                                          │ (elevated access)
[CORPORATE tenant] ── Entra ID (users, admins) ── App registrations / consent
        │
[Exchange Online mailboxes: Leadership · Security · Legal]
```
The **attack path** is a glowing line through: proxies → test account → test app → new apps → new user/consent → `full_access_as_app` → mailboxes.

**Controls** (drag onto a node; each node shows which controls fit):

| Control | Cost | Node | Effect in replay | Side effect | Teaches |
|---|---|---|---|---|---|
| Enforce MFA on **all** accounts incl. test tenants | 2 | Test account | **Blocks stage 2** | None | Test tenants are real attack surface |
| Decommission legacy test tenant & unused apps | 2 | Test tenant | **Blocks stages 2–3** (no target) | Some dev work lost (−1 friction) | Asset inventory / hygiene |
| Entra ID Protection: risky sign-in policy | 3 | Test account | Detects spray, **slows** stage 2 (50% chance to block) | Some false positives | Detection ≠ prevention |
| Remove high privilege from test app (least privilege for apps) | 2 | Legacy-Test-App | **Blocks stage 6** (can't assign app roles) | None | App permissions are privileges |
| Restrict user consent + admin consent workflow | 2 | Consent | **Blocks stage 5** | Users wait for approval (+1 friction) | Illicit consent grant |
| PIM: no standing admin rights | 3 | Entra ID admins | Makes stage 5 harder (attacker needs activation, triggers alert) | Admins must activate (+1 friction) | Just-in-time access |
| Defender for Cloud Apps / app governance OAuth alerts | 3 | App registrations | **Detects** stage 4 → shortens dwell time | Alert volume | OAuth app monitoring |
| Exchange RBAC for Applications / application access policy (scope mailboxes) | 2 | Mailboxes | **Limits impact** of stage 7 (only scoped mailboxes) | Setup effort | Scope app access |
| Sentinel analytic: unusual EWS mailbox access by an app | 2 | Mailboxes | **Detects** stage 7 early | — | Detection engineering |

**Tempting decoys** (they cost budget and don't stop this attack; replay shows why):

| Decoy | Cost | Why it fails here |
|---|---|---|
| Account lockout after 3 failed attempts | 1 | Spray uses 1–2 attempts per account → never triggers |
| Geo-block Russia | 1 | Residential proxies look like normal local traffic |
| Force password change every 30 days | 1 | Spray targets weak/common passwords, not old ones |
| Endpoint antivirus upgrade | 2 | No malware on endpoints in this attack |
| Perimeter firewall rule | 2 | Attack is all cloud identity, no network perimeter |

Rules [DESIGN]:
- Budget 10 → can't buy everything; forces trade-offs.
- At least **3 different winning builds** must exist (e.g. MFA + least-privilege app + consent restriction; decommission + EWS detection + mailbox scoping; …).
- A build can win by **prevention** (attack stopped) or **containment** (detected fast, little data lost). Both score, prevention scores more.

### 2.5 Replay Attack
- Press **Replay**. The attack path animates stage by stage (≈1.5 s each).
- At each stage, the control on that node reacts:
  - **Blocked:** path shatters at that node, cyan pulse, "Stopped at Stage N".
  - **Detected:** node flashes amber, a "SOC alert" toast appears, the attacker keeps moving but the **dwell-time clock** stops sooner.
  - **Decoy:** control greys out with a one-line "why it didn't help".
  - **Nothing:** path continues, red.
- Ends at mailboxes (red flood showing exposed mailboxes) or at the block point.
- Button: **Try a different build** (free in Practice; limited in Challenge).

### 2.6 Results
Score card (shareable image, existing feature):
- **Stopped at:** Stage N / or "Contained after X days"
- **Mailboxes exposed:** 0 / few / many
- **Budget used:** n/10
- **User friction:** low / medium / high
- **Decoys bought:** n
- Rank [DESIGN]: Intern → Analyst → Engineer → Architect

Then **"What Microsoft recommended"** (from the Jan 25 blog guidance, [FACT], verify list) next to the player's build.

### 2.7 Go Deeper (existing)
- KQL hunting queries (tested in Nura's lab) for: password spray patterns, app credential changes, consent grants, app role assignments, EWS access.
- MITRE technique links.
- Control collection cards unlocked.

---

## 3. Modes
- **Practice:** hints on, unlimited replays, no timer.
- **Challenge:** 1 replay, Act 1 timed, no hints, leaderboard-ready (later).

## 4. Reusable level data (so every breach uses the same engine) [DESIGN]

`levels/midnight-blizzard.json`
```json
{
  "id": "midnight-blizzard",
  "title": "Midnight Blizzard",
  "sources": [{ "title": "...", "url": "..." }],
  "briefing": "...",
  "evidence": [
    { "id": "E1", "type": "signin", "title": "...", "rows": [], "order": 1, "illustrative": true },
    { "id": "D1", "type": "alert", "title": "...", "order": null }
  ],
  "patientZero": "E2",
  "timeline": [{ "stage": 2, "date": "late Nov 2023", "text": "...", "mitre": ["T1110.003"] }],
  "map": {
    "nodes": [{ "id": "test-account", "label": "Test account", "x": 120, "y": 80 }],
    "path": ["proxies", "test-account", "test-app", "new-apps", "consent", "app-role", "mailboxes"]
  },
  "controls": [
    { "id": "mfa-all", "cost": 2, "node": "test-account", "effect": "block", "stage": 2, "friction": 0, "teach": "..." },
    { "id": "lockout", "cost": 1, "node": "test-account", "effect": "decoy", "why": "..." }
  ],
  "budget": 10,
  "glossary": ["password spray", "OAuth", "consent", "full_access_as_app"]
}
```
Effects: `block` | `detect` | `limit` | `slow` (with `chance`) | `decoy`.

## 5. Tech notes [DESIGN]
- Vanilla JS (or the existing stack), terminal-theme panels for the map (theme.css).
- Drag and drop: Pointer Events (works on mouse + touch); tap-to-select, tap-to-place fallback for accessibility.
- Progress in `localStorage` (wrapped in try/catch); no backend in v1.
- Keep the strict CSP (no inline script, self-only).
- `prefers-reduced-motion`: replay shows stage results as a list instead of animation.
- All illustrative log rows carry a visible "recreated for training" label.

## 6. Build order (one pass per step)
1. Level JSON for Midnight Blizzard (content from this spec)
2. Act 1 engine: evidence cards + timeline + patient zero + feedback
3. Act 2 engine: map + control placement + budget
4. Replay animation + results card
5. Port Colonial Pipeline to the same JSON format

## 7. Open questions for Nura
- Budget 10 feels right? (Too high = no trade-off.)
- Keep MITRE chips in Act 1 as a bonus, or move them to Go Deeper?
- Should Challenge mode get a real-time attacker clock in Act 2?
