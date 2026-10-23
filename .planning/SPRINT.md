# Sprint 13 — settle the whole story on paper, so the story features can be built
Started 2026-10-23 · Milestone M5 Beta · Features: F09
What changes for Muzzy: `.planning/design/story.md` becomes the finished story (titles, one moment per rank 0–50, fines, the ending), and the planner shows the story split into buildable features with their dependencies. Built: only the framework update (newest released UI kit + Dev Kit). Stays the same: the game itself — it looks and plays the same after the kit update.

## F09 ❓ Story in play
Done when: story.md has the 12 rank titles with their bands, one story moment for every rank 0–50 (voice · line · attention call) following the agreed pacing, a pool of fines and the 5 payday lines, the ending (what happens to you) picked by Muzzy, and ROADMAP has the story's build features with needs; Muzzy reads it and says "approved".
Before the tasks (a kit update, not a feature): bring the UI kit 0.27.0 and Dev Kit 0.23.1 up to framework v0.13.0 (released 2026-10-23: UI kit 0.30.0; the framework session proved Goops' check:framework gives the same results on it); dry run, install, check:full. Goops doesn't use crashes / emotes / ai.
Check: plan-lint green · the per-rank table has 51 rows, each with one voice, and the voice hand-overs have no gap (5, 30, 31, 40, 50) · every line is ≤ 2 short sentences (story moments are short, not skippable) · the framework update: dry run, install, check:full
- [ ] 🤖 1. Finish the story on paper: rank titles in 12 bands (done: the final one only at the end, Muzzy 2026-10-23) · one story moment per rank 0–50 (voice · line · attention call) on the agreed pacing (Management 0–4 · the Veteran 5–29 · caught at 30 · the goop 31–39 · the shared speaker 40–49 · the final shift 50) · ~25 silly fines + the 5 payday lines · 2–3 ending options (what happens to you) · then the story as buildable features in ROADMAP (credits + payday report, story-moment runner, the white goop, the final shift + 3 valve stages, the ending; needs the framework talking bubble), GDD §4/§9, F09's black-goop question closed — .planning/design/story.md
- [ ] 🙋 2. Muzzy picks the ending and reads story.md → "approved" — .planning/design/story.md

## Notes
- Muzzy 2026-10-23 on titles: "12 titles, but the final title is only given out at the end. make that make sense and the banding should work with it." → task 1 (written into story.md: 0 and 50 are single-rank titles, ten bands of 4–5 in between, each title change lands on a story beat; Department Head is given by the goop when the valve opens, not by Management).
- Muzzy 2026-10-23: plan OK ("yes").
- Plan calls (Claude): F09 alone — a decision sprint; F42 + F48 (both 🟢) make Sprint 14 "more upgrades". The talking bubble is a framework request (logged in framework ROADMAP Ideas 2026-10-23), so the story-moment runner's feature needs it. No open P0/P1 bugs (B001–B003 are P3, not in these files).
