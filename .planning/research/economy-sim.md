# Economy sim: whole careers, rank 0 → the final shift (F51, 2026-10-29)

**Why:** before F52 — Balance pass tunes the ladder, see where it's too steep, too flat, or has upgrades that do nothing.
**Nothing was tuned.** The sim reads the real tuning files and never writes them.
**Results page:** `e2e-shots/sim/index.html` (open the file; raw numbers in `results.json` beside it). Made by the run, stays on this machine (e2e-shots is git-ignored). Re-run: `npm run sim:economy` (~13 min on this PC) · `npm run sim:economy -- --quick` (~20 s, a check — it's in check:full).
**Same seeds = the same numbers** (tested: tests/economySim.test.ts).

## After F75 — Cooperative final shift (full re-run 2026-10-30 20:05, 72 careers, 32,852 shifts, 1,365 s)
**Changed since F52:** the final shift is lost only when the tank breaks; the Veteran's seals are free and he wears by the integrity lost (finalShift.json vet.wearPerIntegrity 3.5) · Goop Dump rains WILD goop, 4 cells a wave (in the final shift into the crack columns) · Slow Cracks slows only spreading in the final shift.
- **Pace:** Focused **61–65**, Sharp **60–62** shifts to the final shift (target 60–80; at 8 wild cells a wave it was 56–60).
- **Final shift with the career's upgrades:** Focused 100%, Sharp 70–80% (no upgrades 85% / 70–75%) — upgrades now help or hold there. With Goop Dump still on: 97% / 55% (was 0–7%).
- **Saved him** (bots:final, no upgrades, seeds 7001–7100): Focused 58%, Sharp 47% — about half, as Muzzy asked. Every loss is the tank (integrity).
- **Still no measurable effect:** Auto-Popper, Capacitor Efficiency, Cooldown Booster, Gear Lubrication, Junk Uniformer, Sealing Bonus, Active Expansion Slot 1 + 2.

## After F52 — Balance pass (full re-run 2026-10-30 10:27, 72 careers, 33,283 shifts, 1,557 s)
**Changed since the findings below:** the rank lock (F74: a rank-up needs a quota met this rank, a met shift's XP ×2) · quota = 1 + colours + rank ÷ 10, minus 6 at ranks 30–39 (`shift.json` `quota.addByRank`; was colours + rank) · the white goop's seals no longer count toward the quota (Muzzy 2026-10-30; the final shift's valve still counts them) · console 75%, Focus Mode 2 levels, the final shift's own console 25% · growing cracks at rank 30 (Muzzy: big changes come on the 0s) · Pressure Control +12% first level · Colorizer 2/3/4 pieces · Goop Dump 8 cells a wave · the bots take Dense Goop back for the final shift. The before/after table is on the planner's "Goops — economy sim" tab (made from `scripts/bots/sim-before.json`).
- **Pace:** shifts to the final shift — Focused **70–76**, Sharp **67–70** (were 42–49 / 31–37). The main chat's own check on fresh seeds (801–806, 12 careers a bot to rank 50): Focused 74 (65–80), Sharp 70 (63–80), longest stall 7. In the 60–80 target — before Muzzy's calibration shifts (F52 task 3), so it gets re-checked then.
- **The quota now matters at every band:** met 82–85% of shifts at ranks 1–9 and 63–71% at 10–49 (was 40–49% and 0–2%); per band on the check: 74–78% · 65–72% · 56–63% · 77–81% (30–39) · 61–75% (40–49).
- **Rank 30** (growing cracks start) takes 1.2–1.3 shifts on average — the band's quota is 6 lower because the bots seal ~4 cracks a shift there at first (grown cracks are hard to cover whole).
- **Casual** (ignores cracks) meets 1% and stays near the start — Muzzy 2026-10-30: fine.
- **Final shift:** with no upgrades Focused 85%, Sharp 70% (back to F51's numbers with its own 25% console). With the career's upgrades Focused 85–100%, Sharp 25–45% — Sharp still does worse with its upgrades than without (Slow Cracks max in Rush; Actives first 25%) — Slow Cracks waits on Muzzy's pick.
- **Still no measurable effect:** Auto-Popper, Capacitor Efficiency, Cooldown Booster, Gear Lubrication, Sealing Bonus, Active Expansion Slot 1 + 2 — the next balance pass's list.

## What it does (plain words)
- **A career** = rank 0 to the final shift (rank 50), played shift after shift on the real game rules. XP, ranks and scraps come from the game's own code. A career stops when it wins the final shift (or after 10 tries).
- **Three bot skills** (the F27 bots): **Casual** drops pieces low and zaps what it sees, ignores cracks · **Focused** steers pieces onto cracks · **Sharp** also vents pressure and keeps the stack low.
- **New for careers:** the bots go to the **console** to repair broken machines, **swap** with a real hold (1.5 s, shorter with Goop Swap), **fire their actives**, and **shop between shifts**.
- **Three buy styles** (every scrap spent, every time): **Spread evenly** (one level at a time into whatever has fewest) · **Rush one band** (the newest band of upgrades first) · **Actives first**. Since 2026-10-29 (Muzzy: "why not?") the bots buy Dense Goop like any other upgrade — the numbers below are from that run.
- **Each upgrade on vs off:** the same seeds with and without one upgrade (level 1, and max level), at the rank it opens, at rank 45, and in the final shift.
- **Run:** 72 careers (3 skills × 3 styles × 8 seeds) + 8,520 on/off shifts + 3,000 final shifts = 15,396 shifts (the careers got shorter), 832 s on 24 threads.

## Words used below
- **Quota** = the cracks a shift asks you to seal. A shift is **won** when the quota is met. A lost shift still earns XP (its score).
- **Stall** = the same rank lost 3+ shifts in a row.
- **"Tank lasts"** = seconds until the tank breaks, on the shift's own clock.
- **Noticeable** = a change bigger than a **placeholder** line (5 s longer, or 5% more shifts won, or 5% more of the quota) AND bigger than twice the seed-to-seed wobble. The line is Muzzy's to set (see Ask Muzzy).

## Can the bots stand in for a real player?
- **No record of Muzzy's own shifts exists** (no playtest log has how long he lasts or how often he meets the quota). So the bots are not calibrated yet; every number below is a **range** — Casual / Focused / Sharp — not one answer.
- Ask Muzzy (SPRINT 24 Notes): play 3 shifts at rank 5 and 3 at rank 25, write down how long the tank lasted and cracks sealed / needed.

## Findings (each with ONE suggested knob for F52 — Balance pass)

**1. Ranks fly by — losing doesn't slow you down.**
- Shifts to reach the final shift: **Sharp 31–37, Focused 42–49, Casual 60–83** (whole career, 50 ranks; with Dense Goop bought every style got a little faster — before: Sharp 33–42, Focused 44–48, Casual 73–88).
- Skilled bots need **under one shift per rank** most of the way (Sharp 0.3–0.8, Focused 0.4–1.4).
- Why: a shift's score (= XP) is 6,000–20,000 for Focused/Sharp; a rank needs 3,500 → 13,750. One good shift often jumps 2+ ranks.
- Knob: `content/tuning/progression.json` → `xpPerRank` (250) **up** — later ranks need more XP, so the climb slows where the content is richest.

**2. From rank 10 on, no bot ever meets the quota.**
- Shifts won: ranks 1–9 **40–49%** (Focused/Sharp), **0%** Casual. Ranks 10–49: **0–2% for every bot and every buy style**, upgrades and all.
- Quota = colours in play + rank: 15 cracks at rank 10, 51 at rank 45. The bots seal 20–50% of it (quota share sealed, ranks 10–49).
- So from rank 10 every shift ends "lost" — the ladder is driven only by XP, never by winning.
- Knob: the quota rule is fixed in code (`src/engine/config.ts` `cracksNeededFor` = colours + rank) — **move it into `content/tuning/shift.json` as a quota-per-rank number and set it below 1** (e.g. 0.3 a rank), so it's tunable.

**3. Where careers stall: only where XP drops to the floor.**
- Focused/Sharp careers barely stall: **0.3–4.3 stalls a career**, almost all at ranks 30–49.
- Casual stalls **11–19 times a career**, ranks 30–49 (2.5–3.1 shifts a rank there, never a win after rank 0 — its longest losing run is the whole career).
- Casual keeps moving only because of the XP floor (100 × rank a shift).
- Knob: `content/tuning/progression.json` → `minXpPerRank` (100) — **up** if a casual player should keep climbing at the same pace late on, **down** if the late ranks should wait for skill.

**4. Goop Dump is an XP farm — and, with Goop Colorizer, a score killer.**
- Goop Dump level 3 (one active) adds **+35,000 to +42,000 score a shift at rank 15** (+16,000 to +24,000 at rank 45): over 4 ranks of XP. One shift with it can jump 5+ ranks (Sharp, rank 24: 54,000–126,000 a shift).
- Goop Dump + Goop Colorizer equipped together: **score 0 in 4 of 6 shifts** (rank 27, Sharp) — every piece one colour plus a rain of that colour fills the tank, and the leftover penalty wipes the score. That's why "Actives first" careers earn only the floor (2,900 XP) at ranks 20–29.
- In the final shift Goop Dump **loses it**: −45% to −60% wins (all goop is one colour; the rain buries the tank). Careers that took it in won **0 of 1,440** final shifts, so the bots now leave it home there (economy.json `finalLeaveOut`).
- Knob: `content/tuning/upgrades.json` → `goopDump` → `cellsPerWave` (18) **down**.

**5. Ten upgrades have no measurable effect for the bots.**
- **Circuit Stabilizer, Capacitor Efficiency, Gear Lubrication, Quick Fix, Focus Mode, Cooldown Booster** (the machine upgrades): no change in tank life, wins or quota at any measured rank. A repair costs the bots ~4 s of their time at the console, where the shift runs at 25% speed — about **1 s of shift time**. Breakdowns are too cheap to be worth protecting against.
- **Auto-Popper**: makes the drain after a rupture 3 s longer — no change to anything else.
- **Sealing Bonus** (measured with Goop Dump equipped): no change.
- **Active Expansion Slot 1 + 2**: no change — the extra active doesn't help (see 4 and 6).
- Junk Uniformer: no clear effect (one small dip, for Casual in the final shift).
- Caveat: the bots repair fast and never miss; a human at the console may be slower, so these could matter more for people. The visor never breaks for bots (they fast-drop all the time).
- Knob: `content/tuning/breakdowns.json` → `consoleTimeScale` (0.25) **up** — time at the console costs more, so repairs (and the 6 machine upgrades) start to matter.

**6. Goop Colorizer makes the bots worse.**
- −4% to −8% of the quota sealed and 2–4 s less tank at rank 25, even fired only when the falling piece matches an open crack. Exactly nothing in the final shift (every piece is black already).
- Knob: `content/tuning/upgrades.json` → `goopColorizer` → `pieces` (6/7/8) **down**, so it's a short burst toward a crack instead of a run of one colour.

**7. The upgrades that clearly work.**
- **Tougher Tank**: +6 s a level, **+36 s at max** (rank 22). Nothing in the final shift.
- **Pressure Control**: +3–4 s a level (not noticeable alone), **+24–28 s and +45% wins at max** (rank 9, Sharp). 8 levels = the biggest scrap sink, and it only pays off near the top.
- **Slow Cracks**: +6–7 s a level, +20–26 s at max — **but −35% to −40% wins in the final shift** (fewer cracks = fewer seals for the valve, the Veteran runs out first).
- **Crack Down**: +5% to +17% of the quota, and **+25% to +40% wins in the final shift** — the best final-shift upgrade.
- **Crack Matcher**: only noticeable at max (+4–7 s).
- Knob: `content/tuning/upgrades.json` → `pressureControl` → `byLevel` — **bigger early steps** (e.g. 1.1 at level 1), so one level is felt.

**8. Scraps: 50 earned, 68 levels on offer — every scrap is spent at once.**
- A career earns 50 scraps; 72 levels are for sale (Dense Goop's 4 included since 2026-10-29). Every bot spends everything every time (0 unspent at every rank).
- At rank 40 every style owns 40 levels spread over all 19 upgrades; at rank 50, 50 levels: Spread ends with 1–5 levels in each; Rush maxes the late bands (Junk Uniformer, Goop Swap, Sealing Bonus, Tougher Tank, Slow Cracks, Crack Matcher at 4) and leaves Pressure Control at 2; Actives first maxes all four actives.
- Real choices exist (18 levels you never get), but with half the upgrades doing nothing (finding 5) many of the 50 are wasted.
- Knob: `content/tuning/progression.json` → `scrapsPerRank` (1) — leave it; fix the dead upgrades first.

**9. The final shift with a real career's upgrades.**
- Focused: **85% / 100% / 90%** won (Spread / Rush / Actives first; no upgrades: 85%). Sharp: **10% / 35% / 30%** (no upgrades: 70%). Casual: 0% always. **New with Dense Goop bought (2026-10-29 re-run): Sharp's final shift fell hard** — Spread evenly 65% → 10%: pieces falling up to 1.5× faster in the busiest shift cost the bot that plays fastest; a player can take it back (free respec) before the final shift, the bots don't. Before Dense Goop: Focused 85 / 85 / 95%, Sharp 65 / 30 / 40%. (Re-run 2026-10-29 after the review: both sides now play the same 20 seeds — the first run compared 10 seeds with 20.)
- Every Focused/Sharp career reached and won the final shift (median 1 try).
- Rush and Actives-first Sharp careers do worse than no upgrades. Rush carries max-level Slow Cracks (finding 7: fewer cracks to seal for the valve); why Actives first loses is not pinned down yet (its loadout: Cooldown Booster, Colorizer, Crack Down at max). Focused with the same loadouts doesn't lose — 8 careers each × 20 seeds, so treat the Sharp gap as a lead, not a fact. The F64 final-shift bot (no swap hold, no actives) gets 75–90% on the same seeds.
- Knob: `content/tuning/upgrades.json` → `slowCracks` → `byLevel` **smaller steps** (it's the upgrade that costs final-shift wins).

## Felt in your hands, not judged by these numbers
- **Dense Goop** (pieces fall faster) and **Goop Swap** (a shorter hold to swap) change how the game feels to play. Numbers: Goop Swap max +3 s / +7% quota for Sharp; Dense Goop max +2–3 s. Muzzy judges these by playing.

## Limits
- The bots plan one piece at a time and fire actives by simple rules (economy.json `fireWhen`). A clever player may use Colorizer and the slots better.
- Repairs: 4 s each, never a mistake (bots.json `consoleRepairSec`).
- The first day is counted as one shift that ends at rank 1 (as the game does).
- 20 seeds a bot per on/off test: small effects (under ~2 s) are within the seed wobble.
