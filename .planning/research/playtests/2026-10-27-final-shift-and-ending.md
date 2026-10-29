# Playtest 2026-10-27 — the final shift (rank 50) and the ending
Compiled by Claude on 2026-10-29 from Muzzy's own words recorded in the sprint notes at the time (archive/sprints/sprint-22.md, sprint-23.md). Nobody watched the console live (no /play watch mode), so there are no console or fps readings.

- **Who:** Muzzy (the designer — not a first-time player).
- **Device:** his PC, Chrome, the dev build (http://localhost:5173), RANK SELECT to reach rank 50.
- **What he played:** the final shift several times (before and after the Veteran was sped up), then the win → the whole ending → the end-game screen → a new career.

## What he said
- The final shift: "looks and functions well" (placeholder art and words kept) · "it was overwhelming in a good way."
- "The veteran isn't strong enough. He needs to seal and move faster by 100%" → done (sealTime 3→1.5, secPerCell 0.5→0.25; shrinkPerSeal 0.08→0.07 so he lasts) → "A" / "it's good now."
- Losing by the pressure rupture "felt normal."
- The ending: "approved"; asked whether it felt like relief and a quiet goodbye → "it's fine as is."
- The goop's words after "thank you" kept for now ("i'll do a script rewrite later"); a title badge between shifts → later, with the art redesign.

## What he tripped on
- Before the fix: a ?rank=50 link played the first day's lessons on top of the boss shift → fixed (RANK SELECT counts earlier ranks' lessons as seen; never send ?rank links).
- Before the fix: the screen froze when a black crack grew → fixed (crackStarPoint).

## Not covered (still open for the beta checklist)
- No real phone, no first-time player, no fps reading — see release-checks/beta.md.
