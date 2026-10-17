# shift.json — what each number does

All values are v1's as shipped (from the v1 code, which wins over the v1 docs). Times are in milliseconds.

**tank**
- `width` 30 — columns around the cylinder. `height` 24 — rows including the hidden spawn rows.
- `bufferRows` 3 — hidden rows on top where pieces appear. `visibleWidth` 12 — columns on screen at once.

**colors** — colour names in the order v1 unlocks them. Goop colour 1 = the first name. (Hex values live in `goo-colors.json`.)
**colorsByRank** — how many colours are in play from each rank: 4, purple at 10, white at 30, black at 50.
**junkByRank** — single goop cells on the floor at shift start: 5 from rank 3, 8 from 6, 11 from 9.

**shiftMs** 75000 — the shift timer. Pressure = time used ÷ this. 100% pressure ends the shift.

**fall** — `msPerRow` 780: normal fall speed. `softDropFactor` 8: holding fast drop falls 8× faster.

**lock** — `delayMs` 500: how long a piece can rest on something before it sticks. `softDropDelayMs` 50: the same while fast-dropping. `maxResets` 10: spins/turns while resting restart that timer, but only this many times per piece.

**fill** — `msPerCell` 375: a group takes 375 ms per cell to fill after it changes; only full goop can pop.

**pop** — time given back when you pop: `refundMsPerCell` 100 per cell, plus `refundTierMs` 250 for each "tier" — the first tier at `refundTierFromSize` 15 cells, then one more every `refundTierStep` 10 cells.

**cracks**
- `spawnEveryMs` 5000 — a new crack tries to appear this often (one per colour, on the pressure row) until you've sealed enough.
- `spawnTries` 20 — random columns tried before giving up until next time.
- `sealRefundMs` 3000 — time given back per crack sealed.
- `burstBelowPressure` 0.9 — after the goal, each seal spawns one crack of every colour above the line (the "win burst") — unless pressure is past 90%, then all cracks clear.

**score**
- Each popped cell: `perCell` 10 + `heightPerRow` 10 × rows from the floor (the floor row counts 1) + `offscreenPerCell` 50 if it's off screen; all × (1 + `comboStep` 0.1 × pops since the last piece landed, counting this one).
- `adjacentPerSide` 5 — per side of the popped group touching other goop.
- `hardDropPerRow` 2 — per row a hard drop skips (v1 had this in an unused hard-drop command).
- `leftoverPerCell` 50 — taken off at the end for every goop cell still in the tank.

**pieces**
- `corruptChance` 0.15 — chance a piece is a "corrupted" one (cells touch only at corners; parts fall apart when it lands).
- `mirrorChance` 0.5 — chance a piece is flipped left↔right.
- `zones` — piece size by equal thirds of the shift timer: 4-cell, then 5-cell, then 6-cell. (Popping gives time back, which can move you back a zone.)
- `kicks` — `[sideways, up]` nudges tried in order when a turn is blocked (negative up = higher).
- `tetra` / `penta` / `hexa` — the 54 v1 shapes, as `[x, y]` cells (y grows downward). `noRotate` = squares, which v1 doesn't turn.
