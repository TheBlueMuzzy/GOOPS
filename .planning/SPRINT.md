# Sprint 15 — the story starts: ranks 0–9
Started 2026-10-24 · Milestone M5 Beta · Features: F35
What changes for Muzzy: each rank-up from 0 to 9 plays its short story moment back at the console — Management types on the monitor (0–4), then the Veteran talks in his spiky bubble over the same monitor area (5–9); your rank title shows on the meter and the payday's rank-up line; the first whispers drift up in the tank (3, 8–9). Stays the same: shifts, balance, the payslip, the tutorial lessons. Moments are short, tap to move on, once per device.

## F35 🎮 Story moments + ranks 0–9
Done when: every rank 0–9 has its moment from design/story.md "Story moments, rank by rank" (voice · lines · attention call), played once per device at the console after reaching that rank (rank 0 = the first day's first console visit, after the first-day lesson), never mid-shift; MON lines type on the monitor CRT; the Veteran's lines show in the kit TalkingBubble (wave outline, S9 feel from content/tuning/talk.json) over the monitor area, and Management can interrupt him (his bubble vanishes, the monitor talks); tap / Enter moves on, not skippable; Settings → Replay lessons replays them; 12 rank titles (story.md "Rank titles") on the meter and the payday rank-up line; whispers at rank 3 and 8–9 in the tank need no tap; every word in en.json, every number in content/; screenshots at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080 — portrait only, never landscape).
why: the console starts to feel inhabited — a cold company voice, then a friendly crackle that's on your side.
Check: e2e/story.mjs plays every moment 0–9 (right voice, right words, once only, replay works, the upgrades lesson still comes after rank 5's moment) with shots at every portrait size, looked at · unit tests for which moment is due · check:full
- [ ] 🤖 1. The talking bubble's feel (S9 picks) and a monitor-area target for the Veteran's bubble (Muzzy: "his messages show up in the same area where the company's messages show up, but his in his cool speechbubble") — content/tuning/talk.json
- [ ] 🤖 2. The 10 moments as data: voice, lines, attention target; words in en.json story — content/lessons/story.json
- [ ] 🤖 3. Which moment is due + playing it at the console after a rank-up, once per device, before the rank-5 upgrades lesson; Replay lessons brings them back — src/game/lessons/storyMoments.ts
- [ ] 🤖 4. The two voices: MON on the monitor CRT, the Veteran's TalkingBubble over the monitor area; Management can interrupt him; tap / Enter moves on — src/ui/Console.tsx
- [ ] 🤖 5. 12 rank titles on the meter and the payday rank-up line (bands in content, words in en.json) — content/tuning/progression.json
- [ ] 🤖 6. In-shift whispers at rank 3 and 8–9 (drift up and fade, no tap) — src/game/ShiftStage.tsx
- [ ] 🤖 7. e2e/story.mjs: every moment 0–9, shots at every portrait size; GDD updated — e2e/story.mjs
- [ ] 🙋 8. Muzzy plays ranks 0–9 (?rank=N) and says how the moments feel — content/lessons/story.json

## Notes
- Plan OK (Muzzy 2026-10-24: "build"). Speaker placement (Muzzy): "his messages show up in the same area where the company's messages show up, but his in his cool speechbubble. and it can be 'interrupted' by disappearing and the company talks through the monitor at the top. this will work well. I can do art later." → no separate speaker grille; the Veteran's bubble points at the monitor area.
- No open P0/P1 bugs (B001–B003 are P3, not in these files).
- Extraction queue (framework v0.15.0) is live; nothing queued yet — the lesson runner is what this sprint extends (queueing would freeze it to bug fixes).
