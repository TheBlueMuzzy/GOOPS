# The shift arc — worked out by maths (F27, 2026-10-18)

Muzzy: "don't do a simulation, do the math this time. figure out the right arc managing all those variables… keep pressure
to 100 timing the same." Goals in his words: lower drain first, gentler crack formation second; the crack rate a "hockey
stick" (flat early, steep in the last 25%, always rising a little); players must GET to 100% pressure and may sit there a
while — integrity is the fail point; seals vent less pressure (an upgrade raises it); seals during the rupture count.

## The model (a rate model on paper, not the engine — `scripts/bots/arc-model.py`)
Every second: cracks form at rate r(p) = r0 + (r1 − r0)·p³ (p = pressure 0..1). A player seals a share f of them, each
after ts seconds; the rest stay open. Integrity falls by d × open cracks per second and rises by s per seal. Pressure rises
1/75 s, minus venting (zaps: popVent seconds of rise per second; seals: sealVent seconds each).
Players (calibrated on the 2026-10-18 bot runs: f = sealed share, ts = time to seal):
idle f 0 · casual f 0.1 / 14 s · good f 0.55 / 11 s / zaps vent 5% · sharp f 0.65 / 10 s / 6%.
Check: with the previous tuning the model gives sharp ≈ 99 s; the bots measured 102–120 s — close enough to steer by.

## Chosen values
| Knob | Was | Now |
|---|---|---|
| integrity.drainPerCrackPerSec | 0.002 | **0.001** |
| integrity.sealRefund | 0.03 | **0.02** (= 20 crack-seconds; a sealed crack costs ~11, so sealing always pays) |
| cracks.everyMsAtEmpty / AtFull | 5000 / 1000 | **6000 / 1333** (10 → 45 cracks a minute) |
| cracks.curve | (straight line in time) | **3** (rate follows pressure³) |
| cracks.sealRefundMs (pressure vent per seal) | 3000 | **1000** (upgrade `sealVentMult` raises it) |
| cracks.band | halfway | **halfwayPerColumn** |
| pressure.riseMsToFull | 75000 | 75000 (unchanged) |

Crack rate: 0% 10/min · 25% 10.5 · 50% 14 · 75% 25 · 90% 35 · 100% 45.

## The arc it predicts
| Player | Reaches 100% | Then holds at 100% | Ruptures |
|---|---|---|---|
| Idle | 75 s | 13 s | 88 s |
| Casual | 80 s | 13 s | 93 s |
| Good | 93 s | 39 s | 132 s |
| Sharp | 98 s | 55 s | 153 s |

Good player, second by second: 15 s 18% pressure, 2 open, 100% tank · 45 s 52%, 5 open, 95% · 75 s 84%, 11 open, 82% ·
90 s 98%, 16 open, 69% · 105 s 100%, 22 open, 51% · 120 s 100%, 27 open, 26% → rupture ~132 s.
Everyone reaches 100%; the climb is calm until ~70% pressure, then the cracks surge; skill shows as how long you hold the
line at 100% (13 s idle → 55 s sharp). Later ranks need more seals (quota) — upgrades help there.

## Limits
A rate model doesn't know reach (cracks off screen, under a piece) — the band + f/ts carry that from the bot runs. Treat
the numbers as the target shape; Muzzy's play (and a bot run, if he wants one) confirms it.
