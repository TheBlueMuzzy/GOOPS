# Look-back — Goops M5 Beta (2026-10-29, v0.2.0)
Read: sprints 08–24 (retros' change lines + Notes) · bugs: B004–B007 found, B006 fixed · 320 commits since v0.1.0 (22 with "fix")
BMUZ / framework files belong to the other session (two-session rule), so their items land as dated requests in the framework ROADMAP's Ideas (Muzzy 2026-10-29: "send that note to BMUZ documentation… I'll handle it in another cli").

## Went wrong
- e2e checks that read the look at a wall-clock moment, or cap a game-clock wait in wall seconds, failed under check:full load in 5 sprints (18, 20, 21, 23, B004) — each fixed one file at a time → check (requested): ~/Documents/dev/framework/.planning/ROADMAP.md (Ideas 2026-10-29 (a): a lint rule for wall-clock gates in e2e/ + an untilGameTime helper)
- The one file still sampling by wall clock (zap.mjs) → game: .planning/BUGS.md (B004 says what's left)
- A /save during check:full bumped version.json and restarted the dev servers mid-check (sprints 16, 17) → script (requested): ~/Documents/dev/framework/.planning/ROADMAP.md (Ideas 2026-10-29 (b): check-all lock file, save.mjs + release.mjs refuse while it exists)
- A ?rank link put the tutorial on top of the boss shift (sprints 15, 22) → game: .planning/STATE.md (Key facts: never send ?rank links, testers use RANK SELECT — built as F70 — Rank select)
- Named helpers stayed listed as "working" after their reports; Muzzy saw "2 agents still working" → hook (requested): ~/Documents/dev/framework/.planning/ROADMAP.md (Ideas 2026-10-29 "From the Goops session" (1))
- The planner-republish check didn't see a publish through the claude-artifacts tools, so the turn kept bouncing → hook (requested): ~/Documents/dev/framework/.planning/ROADMAP.md (Ideas 2026-10-29 "From the Goops session" (2))
- The shift quota (colours + rank) is fixed in code, not content — the sim showed no bot meets it from rank 10 → game: .planning/ROADMAP.md (F52 — Balance pass: move it into shift.json, finding 2)

## Done more than once
- Helper briefs kept missing a line a retro then added (the next free TDD decision number, wait on the game's clock, read every dated RESUME HERE line — the F51 — Economy sim helper needed Muzzy's answers mid-build) → script (requested): ~/Documents/dev/framework/.planning/ROADMAP.md (Ideas 2026-10-29 (c): one helper-brief template the develop skill fills)
- "Check a screen at phone size before building all of it" (sprints 09, 14) → checklist (requested): ~/Documents/dev/framework/.planning/ROADMAP.md (③ a layout call — nothing can check a mock-up before it exists; one line in the develop skill, with (c))

## Built for one game, others need it
- The career sim (whole careers on the real engine, buy styles, upgrade on/off on the same seeds, a "noticeable" line = threshold AND > 2× seed wobble, results page, a quick mode for check:full) → module (requested): ~/Documents/dev/framework/.planning/ROADMAP.md (Ideas 2026-10-29 (d))
- Pixel-font readability (sizes snapped to the font's grid, research/pixel-type.md) → module (requested): ~/Documents/dev/framework/.planning/ROADMAP.md (Ideas 2026-10-29 "From the Goops session" (4)); Goops picks the look first in F73 — Crisp pixel type
- Words placed on art growing with Text size while their spot doesn't (B005 — Text size breaks the console) → module (requested): ~/Documents/dev/framework/.planning/ROADMAP.md (Ideas 2026-10-29 "From the Goops session" (3))

## Muzzy
- (asked at hand-off: one thing to keep doing, or stop doing, next time)
