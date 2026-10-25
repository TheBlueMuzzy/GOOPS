# Sprint 17 — the goop finds its voice: ranks 31–39
Started 2026-10-25 · Milestone M5 Beta · Features: F66, F63
What changes for Muzzy: on the first day you sign your name on the monitor (or skip it and stay Operator #4471); from rank 31 a white clump with the Veteran's squint is in the tank — it never merges or pops, drifts to the worst crack and slowly seals it; each rank-up from 31 to 39 plays a moment where the goop speaks in your head (the whisper bubble over the monitor area), asking your name at 36 and showing it on the report's "Pending retirements" at 39. Stays the same: shifts, balance, ranks 0–30.

## F66 🎮 Your name (was ❓: the decision is task 1 — the rest builds it)
Done when: the decision is logged (the name lives in Goops' save; a framework profile module waits until a second game needs it); the first day's monitor shows "PLEASE SIGN HERE" with a name box (12 letters max, Muzzy 2026-10-25), skip = Operator #4471; the name is saved on the device with the progress and RANK SELECT 0 wipes it; every word in en.json, the limit in content/; screenshots at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080 — portrait only).
why: the goop learning your name is the turn from "a job" to "they know me" — it only lands if you gave it.
Check: e2e/first-day.mjs (sign, skip, the limit, RANK SELECT 0 wipes it) with shots looked at · unit tests (save keeps the name) · check:full
- [ ] 🤖 1. Decide and log: the name in Goops' save; a framework profile module later — .planning/TDD.md
- [ ] 🤖 2. First day: "PLEASE SIGN HERE" + a name box on the monitor (kit text input), skip = Operator #4471 — src/ui/Console.tsx
- [ ] 🤖 3. Saved with the progress; RANK SELECT 0 wipes it — src/progress/save.ts
- [ ] 🤖 4. e2e: sign, skip, the limit, the wipe; shots at every portrait size — e2e/first-day.mjs

## F63 🎮 The goop's voice (ranks 31–39) + the Veteran in the tank — sketch first
Done when: the white clump's movement is picked in a sketch (Muzzy tunes it); from rank 31 one white clump with his squint is in the tank: it never merges or pops (the laser passes through: "ow"), drifts toward the crack in most danger and seals it slowly, eyes always open; ranks 31–39 each play their moment from design/story.md in the goop's voice (the whisper bubble over the monitor area — Muzzy 2026-10-25), 36 and 39 use your name (F66); rank 39's report shows "Pending retirements: Operator #4471 — <your name>"; every number in content/, every word in en.json; GDD updated; screenshots at every portrait size.
why: losing the Veteran should hurt, then turn — he's still here, still helping, and the goop is starting to talk to you.
Check: unit tests (white clump rules) · e2e/story.mjs (moments 31–39, the name, the report line) · shots of the white clump at every portrait size · check:full
- [ ] 🤖 1. White-goop sketch: how he drifts to the worst crack and seals it (speed, path, the laser passing through with an "ow"), knobs + presets + Copy values — .planning/research/sketches/white-goop.html
- [ ] 🙋 2. Muzzy tunes the sketch and copies the values — .planning/research/sketches/white-goop.html
- [ ] 🤖 3. Rules: the white clump never merges or pops, drifts, seals slowly; numbers in content/tuning; unit tests — src/engine/shift.ts
- [ ] 🤖 4. His look: white, his squint, eyes always open — src/goo/shared/faces.ts
- [ ] 🤖 5. Moments 31–39 + lines (the goop's voice = the whisper bubble at the console; 36 and 39 use the name) — content/story/moments.json
- [ ] 🤖 6. Rank 39's report: "Pending retirements: Operator #4471 — <your name>" — src/progress/payslip.ts
- [ ] 🤖 7. e2e: moments 31–39, the name, the report line, white clump shots at every portrait size — e2e/story.mjs
- [ ] 🤖 8. Update GDD §5 (ranks 31–39) — .planning/GDD.md

## Notes
- Plan OK (Muzzy 2026-10-25: "go" = Claude's picks: the goop's voice at the console = the whisper bubble over the monitor area; name box 12 letters).
- No open P0/P1 bugs (B001–B003 are P3, not in these files).
- Order: F66 and the F63 sketch run side by side; F63 tasks 3–8 wait on Muzzy's sketch values and F66's name.
