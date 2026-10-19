# Balance bots: how shifts end today (F27 task 7, 2026-10-18)

**Why:** Muzzy's first shifts ruptured from cracks before pressure reached 100%. Before any number moves: facts.
**Nothing was tuned.** The bots read `content/tuning/*.json` live and never write them.
Charts + every table: `e2e-shots/bots/index.html` (open the file). Raw numbers: `e2e-shots/bots/results.json`. Both are made by the run and stay on this machine (e2e-shots is git-ignored); `npm run bots` remakes them anywhere, same seeds = same numbers.
Re-run: `npm run bots` (about 3½ min on this PC; `npm run bots -- --seeds 10` is quicker).

## The bots (scripts/bots, settings in scripts/bots/bots.json)
They only use a player's actions (turn the tank, rotate, fast drop, swap, zap a cell they can SEE in the 12 visible columns), at a human-ish pace. They never go to the console, so a broken machine stays broken.
- **Idle**: never touches anything. The baseline.
- **Casual** (90 actions a minute, 0.7 s to notice things): drops pieces low and flat near where it's looking, zaps any ready goop it can see, ignores cracks.
- **Focused** (130 a minute, 0.45 s): also steers pieces of a crack's colour onto it, builds up under cracks hanging in the air, swaps when the held piece fits better, and turns the tank to zap a group that would seal a crack.
- **Sharp** (180 a minute, 0.25 s): Focused, plus it waits for big groups (8+), vents on purpose above 55% pressure, keeps the stack low.

**Runs:** 4 bots × ranks 0, 2, 4, 6, 10 × 50 seeds, breakdowns on (as the game plays) and off = 2,000 shifts, plus the sensitivity runs (Focused + Sharp × 6 knobs × ±25% × 5 ranks × 50 seeds = 6,000). **8,000 shifts in 206 s.**
Ranks 0 and 2 give the same numbers: the only difference is the visor, and a bot that fast-drops never lets it fade.

## 1. What ends shifts? Always integrity, always early.
| Bot | Rupture (median, 10–90%) | Ended by integrity | Pressure at rupture | Shift over (median) |
|---|---|---|---|---|
| Idle | 46.6 s (every seed) | 100% | 62% | 49.7 s |
| Casual | 47.2 s (47–50) | 100% | 56% | 50 s |
| Focused | 55–61 s (50–68) | 100% | 47–48% | 58–63 s |
| Sharp | 59–63 s (53–76) | 100% | 45–47% | 61–65 s |

- **Not one of 8,000 shifts reached 100% pressure, and none ended by overflow.** Pressure at rupture is never above 57% (90th percentile). The 100% ceiling needs at least 75 s with no venting at all; the tank breaks first every time.
- Skill buys only about **15 seconds**: the best bot lasts ~62 s against the idle tank's 47 s.
- Rank barely changes this (Sharp: 62 s at rank 0, 59 s at rank 10).

## 2. Can a good player meet the quota?
| Rank (needs) | Casual | Focused | Sharp |
|---|---|---|---|
| 0 (4 cracks) | 2% | 92%, median at 34 s | **100%**, median at 36 s |
| 2 (6) | 0% | 56% at 50 s | 80% at 49 s |
| 4 (8) | 0% | 22% at 61 s | 54% at 56 s |
| 6 (10) | 0% | 6% at 68 s | 18% at 64 s |
| 10 (15) | 0% | 0% | **0%** |

- Every bot sees about the same number of cracks before the rupture: **12–16, whatever its skill** (more sealing = a longer shift = a few more cracks). The quota (colours + rank) grows by one a rank; the cracks you get don't.
- **Rank 10 needs 15 seals, but only ~15 cracks form before the tank breaks** (Sharp: 14–18 a shift at every rank). It can't be met without sealing nearly every crack.
- The quota is usually met in the last 15 seconds before the rupture at ranks 2–6: right at the edge.
- Some wins come *after* the rupture: sealing during the drain still counts (Sharp rank 6: 18% met, 16% before the rupture; Focused rank 6: 6% vs 2%). See Findings.

## 3. What drives the integrity loss?
**The tank is a budget of 250 crack-seconds** (1 ÷ 0.004 drain). Every shift for every bot ends when the open cracks have added up to 250 crack-seconds (measured: 249.8–249.9 in every group; integrity lost per open-crack-second = exactly 0.004). So the only question is how fast crack-seconds pile up.
| Bot (rank 0) | A crack every | Sealed | Time to seal (median) | Crack-seconds from never-sealed cracks |
|---|---|---|---|---|
| Idle | 3.6 s | 0% | – | 100% |
| Casual | 3.9 s | 4% | 16 s | 97% |
| Focused | 4.0 s | 40% | 11 s | 65% |
| Sharp | 4.0 s | 49% | 11 s | 57% |

- **The unsealed cracks do the damage.** An unsealed crack drains forever, so open cracks climb in a straight line (Sharp, rank 0: 2 open at 10 s, 4 at 30 s, 7 at 50 s) and the drain speeds up every few seconds. Even the Sharp bot leaves half the cracks unsealed, and those make well over half the loss.
- **Most cracks form where they're hard to reach:**
  - **76–82% form in mid-air.** The pop line sits about 5–6 rows up while the stack is 2–4 rows high, and cracks may form in any empty cell below the line. Air cracks get sealed far less often (Sharp: 42% of air cracks vs 75% of surface cracks), because you have to build a column under one first.
  - **About 60% form off screen** (40% inside the 12 visible columns, which is just their share of the 30). Off-screen cracks still get sealed about as often by Focused/Sharp, who turn the tank to them, but that turning costs time.
  - Under goop (buried): under 1%, so not a factor.
- A sealed crack still costs ~11 s of drain (place a matching piece, wait for it to fill at 375 ms a cell, zap). A crack every ~4 s × 11 s means ~3 cracks are open at once even with perfect sealing.

## 4. Pressure ramp or drain per crack?
**The drain per crack is the main squeeze; the pressure ramp is a small one.**
- Pressure averages only **26–31%** before the rupture, so cracks come every 3.6–4.0 s instead of 5 s: the ramp adds about 25% more cracks. Almost no crack forms above 60% pressure (none above 80%).
- In the sensitivity runs, `everyMsAtFull` (the 100% end of the ramp) does **nothing** (under 1 s either way): play never gets there.
- Pressure matters mostly through the pop line: it decides how high cracks can form (into the air) and what you can zap.

## 5. Sensitivity (each knob ±25% on its own; rupture = average of the rank medians)
| Knob (today) | Focused −25% / +25% | Sharp −25% / +25% | Quota, Sharp rank 4 (today 54%) −25% / +25% |
|---|---|---|---|
| `integrity.drainPerCrackPerSec` (0.004) | **+8.1 s / −5.9 s** | **+9.1 s / −6.2 s** | 74% / 36% |
| `cracks.everyMsAtEmpty` (5000) | −6.6 s / +5.8 s | −7.9 s / +5.6 s | 60% / 46% |
| `pressure.riseMsToFull` (75000) | −4.4 s / +4.7 s | −4.5 s / +2.4 s | 42% / 62% |
| `cracks.sealRefundMs` (3000) | −1.3 s / +0.7 s | −1.5 s / +1.7 s | 48% / 54% |
| `pop.refundMsPerCell` (100) | −0.5 s / +0.3 s | −0.1 s / +0.5 s | 54% / 60% |
| `cracks.everyMsAtFull` (1000) | −0.2 s / +0.5 s | −0.2 s / +0.2 s | 54% / 56% |

- **Drain per crack** is the strongest knob for both time and quota.
- **Crack timing at 0% pressure** works both ways: more cracks = an earlier rupture, but also more cracks to seal, so the quota rate barely drops (fewer cracks, +25%, actually *lowers* the quota rate at ranks 4–6). It changes how long a shift lasts more than whether you win it.
- **Pressure rise** is the third lever; the two vent refunds and `everyMsAtFull` hardly matter at today's pressures.
- Per-rank cells for every knob: the results page, section "Sensitivity".
This is data for task 9, not a recommendation.

## 6. Breakdowns (on vs off)
Small effect: Sharp at rank 6 ruptures 1.6 s earlier with breakdowns on and meets the quota 18% vs 28% of the time; Focused at rank 6: 2.9 s earlier, 6% vs 12%. Elsewhere under 1.5 s.
- **Laser** breaks about once a shift from rank 4, usually late (median 40–53 s). Then every zap takes two taps.
- **Controls** (rank 6+): Focused overheats them early (first break at a median 5.5 s) because it turns the tank up to 15 columns in one go: 20 turns in a row at the 100 ms key repeat is a full heat bar. Sharp breaks them later (28–34 s).
- **Visor** only breaks if you never fast-drop (Idle: at 10 s). Its effect is a visual glitch, which bots can't feel: **the bots can't measure the visor's real cost**, and the controls' cost is only the slower held turn.

## Findings (nothing fixed: engine rules stay as they are)
1. **Rank 10's quota can't be met at today's numbers.** Steps: `npm run bots`, rank 10 row: every bot 0%; cracks formed before the rupture (median 15) = quota 15. Ranks 6+ are very hard (Sharp 18%).
2. **Most cracks form in mid-air**, above a low stack (76–82%). That follows the rule "any empty cell at or below the pop line"; it's probably the "cracks I can't fix" feeling. Steps: any run; results page → "Where the integrity goes", "Formed … in air".
3. **The quota can be met after the rupture.** Sealing a plugged crack during the drain still counts: 2–6% of Focused/Sharp shifts at ranks 0–6 only reached the quota in the drain (results.json `quotaRate` vs `quotaBeforeRupture`). That fits "you can still zap", but the GDD doesn't say whether seals then count. Ask Muzzy: is that intended?
4. **A failed crack spawn skips a whole interval** (`growCracks` in src/engine/shift.ts sets the timer to 0 *before* `spawnCrack`; when there's no free cell it returns null and the comment says "try again next time", but the next try is a full interval later). Only matters when every cell below the line is full: never happened in these runs. Steps: a tank full up to the pop line → no crack for a full `crackEveryMs`.
5. No crack ever formed somewhere it could never be sealed: buried cracks were under 1%, and cracks left above the pop line after venting were under 1% of crack-seconds.

## Limits of the bots
They read the board perfectly but plan one piece at a time. A strong human may seal a bit more than Sharp (better colour juggling, standing pieces up into air cracks). Even so, the shape holds: at 4 s a crack and ~11 s a seal, ~250 crack-seconds run out in about a minute unless nearly every crack is sealed. XP = the final score (floor: 100, or 100 × rank): Sharp's median at rank 0 is 3,007, about 0.9 of a rank (3,500 needed).

# Rerun after Muzzy's changes (F27 task 10, 2026-10-18)
**What changed:** drain 0.004 → 0.002 (Lever B), 3% integrity back per seal (`integrity.sealRefund` 0.03, Lever C, number = Claude's pick), and Muzzy's crack band (`cracks.band`, Lever A: cracks only up to halfway between the top goop and the pop line). Also fixed finding 4 (a crack with nowhere to go now retries next step). Crack timing (`everyMsAtEmpty`/`everyMsAtFull`) untouched.
**Runs:** 4 tunings × 4 bots × 5 ranks × 50 seeds + breakdowns-off + `riseMsToFull` ±25% = 6,000 shifts in 188 s. `npm run bots` (`--variants base` = the file only). Page: https://claude.ai/artifact/94yNKpzjvFNXxVzJoM75R7 (section "Before / after").
The "before" rows reproduce the first run exactly (same seeds), so the band code leaves the old rule untouched.

| Tuning | Idle rupture | Sharp rupture (rank 0 → 10) | Sharp quota (rank 0/2/4/6/10) | Focused quota | Peak pressure, Sharp (median / 90%) | Cracks a shift (Sharp) | Rows above the goop (Sharp avg) | Sealed (Sharp) |
|---|---|---|---|---|---|---|---|---|
| Before | 47 s | 62 → 59 s | 100/80/54/18/0% | 92/56/22/6/0% | 48% / 53% | 16 | 2.3 | 48% |
| New + band none | 62 s | 96 → 91 s | 100/98/94/82/4% | 100/96/78/44/2% | 66% / 72% | 28 | 3.4 | 43% |
| **New + halfway (default)** | 62 s | 120 → 102 s | 100/100/100/86/40% | 100/98/98/80/16% | 62% / 70% | 32 | 2.1 | 54% |
| New + per column | 62 s | 134 → 110 s | 100/100/98/96/68% | 100/100/100/96/32% | 61% / 67% | 33 | 1.5 | 61% |

- **Skill now matters:** the gap between Idle and Sharp grew from ~15 s to ~40–60 s. Casual barely gains (63–66 s): it ignores cracks, so it only gets the lower drain.
- **Still nobody reaches 100% pressure** (0 of 6,000 shifts), and no skilled shift ends by overflow; every bot shift that moves ends by integrity. Idle (who never moves) now overflows 5% of the time.
- **Cracks:** ~30 a shift for Focused/Sharp (was 15). Most form at 20–60% pressure; under 1 a shift above 80%.
- **Where they form:** the band brings cracks down (average 3.4 rows above the goop under them with no band → 2.1 halfway → 1.5 per column; 90th percentile 8 → 5 → 4 rows). They still count as "in the air" ~70–75% of the time, because one empty row under a crack is already "air"; the gap is the better measure. Air cracks sealed: Sharp 35% (none) → 46% (halfway) → 52% (per column).
- **Without the band, the lower drain makes the air problem worse** (85% air, 3.4 rows up): with more time, pressure climbs higher and the line drags cracks up with it. The band is what keeps them reachable.
- **Per column is a little kinder than halfway** (+8–14 s, rank 10 quota 68% vs 40%): it closes the "one tall column lets cracks float over low ones" gap.
- **Quota:** ranks 0–4 are now near-certain for Focused/Sharp; rank 6 is 80–86%; rank 10 is 16–40% (was 0%).
- **Sensitivity, `pressure.riseMsToFull` ±25% (75 s):** −25% (56 s) → shifts ~10–25 s shorter (Sharp 93 → 86 s), peak pressure ~80% median / ~86–90% p90, quota at rank 10 falls to 2–16%, rank 6 to 66–72%. +25% (94 s) → shifts 7–13 s longer, peak ~53–55%, rank 10 quota 44–62%. Still no shift reached 100% either way.

# Rerun: half drain + top bias (F27, 2026-10-19)
**Why:** Muzzy played the new arc: "cracks are forming pretty low over time and i have no reason to build upwards … i just drop, wait, pop … there's no interesting puzzle/decision point." His fix: halve the drain (0.001 → 0.0005) and lean crack spawns toward the top of the band (`cracks.topBias`, new: each spot counts by rows above the goop in its column, to that power).
**Runs:** 5 tunings × 4 bots × 5 ranks × 30 seeds = 4,200 shifts in 195 s (`npm run bots -- --seeds 30`).

| Tuning | Sharp shift | Sharp quota (rank 0/2/4/6/10) | Focused quota | Casual quota r0 | Rows above the goop (avg) | Sealed (Sharp) |
|---|---|---|---|---|---|---|
| Played 10-18 (drain 0.001, bias 0) | 125 → 118 s | 100/100/100/100/40% | 100/100/100/97/33% | 27% | 3.5 | 33% |
| Half drain, bias 0 | 157 → 150 s | 100/100/100/100/83% | 100/100/100/100/83% | 57% | 3.9 | 29% |
| Half drain, bias 1 | 148 → 140 s | 100/100/100/97/10% | 100/100/100/97/10% | 10% | 5.2 | 21% |
| **Half drain, bias 2 (the file)** | 142 → 138 s | 100/100/90/63/0% | 100/100/77/53/3% | 0% | 5.9 | 17% |
| Half drain, bias 3 | 139 → 136 s | 100/100/83/53/3% | 100/97/80/40/0% | 3% | 6.4 | 15% |

- **Half drain alone makes it easier and changes nothing about where cracks are** (gap 3.5 → 3.9; rank 10 quota 40 → 83%): more time, same drop-and-pop. It only works together with the bias.
- **The bias is what breaks drop-wait-pop:** Casual (ignores cracks, keeps low) meets no quota at bias 2 (27% at rank 0 before). Cracks float ~6 rows above the goop instead of ~3.5.
- Every shift now reaches 100% pressure and ends by integrity (Idle by overflow). Shifts ~140 s.
- Bots plan one piece at a time and only build toward a crack weakly (`underCrack` 4), so they are the drop-and-pop player: their falling quota is the point. A player who builds up should do better than Sharp here.
- Finding 3 above (seals during the rupture drain count): **answered by Muzzy — yes, they count** (2026-10-18, again 2026-10-19). Not a question any more.
