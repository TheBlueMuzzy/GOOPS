# shift.json — what each number does

All values are v1's as shipped (from the v1 code, which wins over the v1 docs) unless marked as the new shift loop (pressure, integrity, rupture, crack timing — F17). Times are in milliseconds.

**tank**
- `width` 30 — columns around the cylinder. `height` 24 — rows including the hidden spawn rows.
- `bufferRows` 3 — hidden rows on top where pieces appear. `visibleWidth` 12 — columns on screen at once.

**colors** — colour names in the order v1 unlocks them. Goop colour 1 = the first name. (Hex values live in `goo-colors.json`.)
**colorsByRank** — how many colours are in play from each rank: 4, purple at 10, white at 30, black at 50.
**junkByRank** — single goop cells on the floor at shift start: 5 from rank 3, 8 from 6, 11 from 9.

**pressure** — `riseMsToFull` 75000: pressure climbs from 0% to 100% in this long if nothing vents it. The pop line rises with it. Zapping and sealing vent it (see `pop` and `cracks.sealRefundMs`, counted in ms of this rise). Caps at 100%.

**integrity** — the arc (Muzzy, 2026-10-18: lower drain + gentler cracks, pressure must reach 100%, integrity is the fail point; worked out by maths, not a sim — `.planning/research/balance-arc.md`)
- `drainPerCrackPerSec` 0.0005: every open (unsealed) crack wears the tank down 0.05% per second. At 0 the tank ruptures. (0.004 → 0.002 → 0.001 → 0.0005, Muzzy 2026-10-18: "I want drain to be lower so players have more time to reach the cracks up high"; halved again 2026-10-19 together with `cracks.topBias` — cracks now float higher, so reaching them takes longer.)
- `sealRefund` 0.02: sealing a crack gives 2% integrity back, never past 100%. Nothing comes back during a rupture (the seal still counts for the quota). At 0.0005 drain, 2% = 40 crack-seconds — more than a sealed crack costs while it's open, so sealing always pays.

**rupture** — `drainMs` 5000: after a rupture, pressure drains from 100% to 0 in this long (the pop line sinks with it). Pieces keep coming and you can still zap; no new cracks. At 0 the shift ends — won if the quota was met. A piece with no room to spawn also ruptures the tank (and ends the shift at once if it has already ruptured).

**fall** — `msPerRow` 780: normal fall speed. `softDropFactor` 8: holding fast drop falls 8× faster.

**lock** — `delayMs` 500: how long a piece can rest on something before it sticks. `softDropDelayMs` 50: the same while fast-dropping. `maxResets` 10: spins/turns while resting restart that timer, but only this many times per piece.

**fill** — `msPerCell` 375: a group takes 375 ms per cell to fill after it changes; only full goop can pop.

**pop** — pressure vented when you pop (in ms of pressure rise; v1 gave it back as shift time): `refundMsPerCell` 100 per cell, plus `refundTierMs` 250 for each "tier" — the first tier at `refundTierFromSize` 15 cells, then one more every `refundTierStep` 10 cells.

**cracks**
- `everyMsAtEmpty` 6000 / `everyMsAtFull` 1333 / `curve` 3 — a crack every 6 s at 0% pressure, every 1.3 s at 100%; the RATE between follows pressure³ (Muzzy: "hockey stick style … but still always rising slightly"). Without `curve` it's v1's straight line in time. They keep coming after the quota is met.
- Cracks only appear where they can be sealed right now: an empty cell (no goop) at or below the pop line.
- `band` "halfwayPerColumn" — how high cracks may form (Muzzy, 2026-10-18; the bots found 3 in 4 cracks formed in mid-air, out of reach). Rows counted from the floor up (floor = 0):
  - `"halfway"` (Muzzy's rule, tank-wide): cracks only from the floor up to row X, halfway between the highest goop anywhere in the tank and the pop line, rounded down. Example: top goop at row 12, line at 16 → (16 − 12) ÷ 2 = 2 → cracks up to row 14, in any column. Goop at or above the line → X = the line. Empty tank → the floor counts as the top goop.
  - `"halfwayPerColumn"` (the default since 2026-10-18 — Muzzy's rule applied column by column; it did better in every bot measure): the same, but each column uses its own goop (the floor if it's empty). Stops one tall column letting cracks float high over the low columns next to it.
  - `"none"`: the old rule, anywhere up to the pop line. Kept for comparison.
- `topBias` 2 — WHERE in the band (Muzzy, 2026-10-19: "so many near the floor that I don't need to stack to meet quota … drop, wait, pop"). Each empty spot counts by how many rows it floats above the goop in its own column (the rows you'd have to build to reach it), to the power `topBias`. 0 = every spot equally (before) · 1 = a spot 4 rows up is 4× as likely as one sitting on goop · 2 = 16× · 3 = 64×. Cracks never leave the band, so they stay reachable. Empty tank at bias 2: ~2 in 3 cracks land in the band's top third, ~1 in 300 on the floor. Bots (2026-10-19, research/balance-bots.md): the average crack floats 6 rows up (3.5 before); the bot that ignores cracks no longer meets any quota (27% at rank 0 before).
- **Crack curve** (6000 → 1333 ms, curve 3):

  | Pressure | 0% | 25% | 50% | 75% | 90% | 100% |
  |---|---|---|---|---|---|---|
  | Seconds between cracks | 6.0 | 5.7 | 4.2 | 2.4 | 1.7 | 1.3 |
  | Cracks per minute | 10 | 10.5 | 14 | 25 | 35 | 45 |

  Pressure still takes `pressure.riseMsToFull` 75 s to go 0 → 100% with no venting (Muzzy: keep that timing).
- If there's nowhere for a crack when it's due, the game tries again every step until there is (it used to wait a whole interval).
- `sealRefundMs` 1000 — pressure vented per crack sealed (ms of rise). Lowered from 3000 (Muzzy, 2026-10-18) so players actually reach 100%; an upgrade raises it (`sealVentMult` modifier).
- `onePerColour` false — true = v1's rule: at most one open crack per colour (caps how many can be open, so caps the integrity drain).

**score**
- Each popped cell: `perCell` 10 + `heightPerRow` 10 × rows from the floor (the floor row counts 1) + `offscreenPerCell` 50 if it's off screen; all × (1 + `comboStep` 0.1 × pops since the last piece landed, counting this one).
- `adjacentPerSide` 5 — per side of the popped group touching other goop.
- `leftoverPerCell` 50 — taken off at the end for every goop cell still in the tank.

**pieces**
- `corruptChance` 0.15 — chance a piece is a "corrupted" one (cells touch only at corners; parts fall apart when it lands).
- `mirrorChance` 0.5 — chance a piece is flipped left↔right.
- `zones` — piece sizes as the shift goes on: 4-cell, then 5-cell, then 6-cell. `zoneEveryMs` 25000 — play time in each zone (the last one stays).
- `kicks` — `[sideways, up]` nudges tried in order when a turn is blocked (negative up = higher). A sideways kick either turns the tank (Wall kick: Rotate vat, the default) or slides the piece over (Shunt piece, v1) — same tank cells either way.
- `tetra` / `penta` / `hexa` — the 54 v1 shapes, as `[x, y]` cells (y grows downward). `noRotate` = squares, which v1 doesn't turn.
