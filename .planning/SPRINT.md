# Sprint 06 — know what alpha is, and phone controls that never misread you
Started 2026-10-19 · Milestone M0 Design decided · Features: F10, F07
What changes for Muzzy: decisions and docs (what alpha / beta / 1.0 need; the build milestones after M0; which touch gestures misfire). Stays the same: goo, the approved balance, HUD, console.
Decided at planning (Muzzy, 2026-10-19): the goo-lab checks are moot — Jelly is already in the real game → F02 ✅ (its last bit, the TDD goo write-up from the real code, is a docs job done alongside). F09 Story in play waits for its own sprint. Gesture fixes become their own feature once F10 says what misfires. Message timing playtest (F26 task 6): Muzzy, whenever (STATE).

## F10 ❓ Phone gestures without conflicts
- [ ] 🤖 1. List every touch gesture, where they can collide, and a phone checklist — src/input/controls.ts → .planning/research/gestures.md
- [ ] 🙋 2. Phone playtest with the checklist — note every misread; then pick a fix per conflict (2–3 options each)

## F07 ❓ Releases: what alpha, beta and 1.0 must have
- [ ] 🤖 3. Draft the must-haves per release + the build milestones after M0 (GDD, v1, parking lot, what's built) — .planning/research/release-scope.md
- [ ] 🙋 4. Edit + approve → Claude writes them into ROADMAP + GDD §7

## Notes
- Done 2026-10-19 (F02 close-out, helper): TDD §1/§2/§2b/§3/§10 rewritten from the real goo code (the TDD listed a `drop` action + `crackSeal` event that don't exist, "Dev Kit tools: none yet", Particle "may need" view culling it already has). Fixed alongside: pause.json help said the ready glow keeps moving in half pause — it doesn't (the goo gets 0 time, ShiftStage.tsx:167). **Later (not this sprint):** goo numbers hard-coded in code that belong in content/ (Jelly kick sizes, piece spring K=260, Particle KREP/SEP/cohK, caps 9,000/40,000, 120 Hz step); dead hard-drop code in both renderers (`case 'drop'`, Particle thump flag); Particle `bulge` / `absorb` / `fresnel` have no `_help`; `src/goo/flat/` unused; e2e/perf.mjs has no pass/fail line vs 60 fps; Jelly simulates off-screen bodies.
