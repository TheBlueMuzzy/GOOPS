# shift.json — what each number does

All values are v1's as shipped (from the v1 code, which wins over the v1 docs) unless marked as the new shift loop (pressure, integrity, rupture, crack timing — F17). Times are in milliseconds.

**tank**
- `width` 30 — columns around the cylinder. `height` 24 — rows including the hidden spawn rows.
- `bufferRows` 3 — hidden rows on top where pieces appear. `visibleWidth` 12 — columns on screen at once.

**colors** — colour names in the order v1 unlocks them. Goop colour 1 = the first name. (Hex values live in `goo-colors.json`.)
**colorsByRank** — how many colours are in play from each rank: 4, purple at 10, white at 30, black at 50.
**junkByRank** — single goop cells on the floor at shift start: 5 from rank 3, 8 from 6, 11 from 9.

**pressure** — `riseMsToFull` 75000: pressure climbs from 0% to 100% in this long if nothing vents it. The pop line rises with it. Zapping and sealing vent it (see `pop` and `cracks.sealRefundMs`, counted in ms of this rise). Caps at 100%.

**integrity** — `drainPerCrackPerSec` 0.004: every open (unsealed) crack wears the tank down 0.4% per second. It never refills. At 0 the tank ruptures. (Measured: an untouched tank, nobody sealing, ruptures at about 47 s with 13 cracks open and pressure at 60%.)

**rupture** — `drainMs` 5000: after a rupture, pressure drains from 100% to 0 in this long (the pop line sinks with it). Pieces keep coming and you can still zap; no new cracks. At 0 the shift ends — won if the quota was met. A piece with no room to spawn also ruptures the tank (and ends the shift at once if it has already ruptured).

**fall** — `msPerRow` 780: normal fall speed. `softDropFactor` 8: holding fast drop falls 8× faster.

**lock** — `delayMs` 500: how long a piece can rest on something before it sticks. `softDropDelayMs` 50: the same while fast-dropping. `maxResets` 10: spins/turns while resting restart that timer, but only this many times per piece.

**fill** — `msPerCell` 375: a group takes 375 ms per cell to fill after it changes; only full goop can pop.

**pop** — pressure vented when you pop (in ms of pressure rise; v1 gave it back as shift time): `refundMsPerCell` 100 per cell, plus `refundTierMs` 250 for each "tier" — the first tier at `refundTierFromSize` 15 cells, then one more every `refundTierStep` 10 cells.

**cracks**
- `everyMsAtEmpty` 5000 / `everyMsAtFull` 1000 — time between cracks at 0% pressure and at 100% (a straight line in between). They keep coming after the quota is met.
- Cracks only appear where they can be sealed right now: an empty cell (no goop) at or below the pop line.
- `sealRefundMs` 3000 — pressure vented per crack sealed (ms of rise).
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
