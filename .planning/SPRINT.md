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
