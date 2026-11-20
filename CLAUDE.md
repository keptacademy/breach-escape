# Breach Escape: working rules

## Testing rules (keep token use low)
- Run the full end-to-end suite once, at the end of a round of changes.
- If something fails: fix it, rerun only the failing test, then one final full run.
- Max 2 full-suite runs per round. If it still fails, stop and report; don't loop.
- Look at screenshots only for failed tests or new screens, not every run.
- A flaky test is a test bug: fix the test, don't rerun it to see if it passes.
- Exception to the 2-run limit: before a merge to main, one extra clean full run of the final code is required.

## Project rules
- **Primary sources only.** Every fact in a case comes from a primary source listed in its level JSON. A fact that can't be checked gets a `todo` field ("TODO: verify …"); never invent or fill gaps from memory. Recreated log rows are marked `illustrative: true` and shown as "recreated for training".
- **Strict CSP, unchanged.** No `innerHTML` (build DOM with `h()` / `createElementNS`, text via `textContent`), no inline `<script>` or `style=""`, no injected `<style>`, and no outside URLs in code (links to sources in content are fine). No new packages without asking.
- **Never touch `main`.** Work on the session branch (currently `claude/keen-pasteur-o2a3hp`, draft PR #1).
- **Bump `VERSION` in `sw.js`** whenever shipped files change.
- **Update `docs/redesign/STATUS.md`** every round.
- **Commit and push after each numbered item in a prompt,** with a clear message. Never leave more than one item unpushed.
