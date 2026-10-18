# Goops — Upgrades map (F22)
> Every v1 upgrade and active ability: what v1's **code** actually did, what part of the game it touches, what the new shift loop (GDD §4: pressure → cracks → tank integrity → rupture → drain) does to it, and a **PROPOSED** new-loop version. Linked from GDD §5 and `progression.md`.
> **Proposals are taste calls for Muzzy, not decisions.** Upgrades go in later, after the game mostly works; this map exists so the engine is built with every one of them in mind (TDD "Upgrades & abilities", D06).
> Sources: v1 `constants.ts` (UPGRADES), `core/GameEngine.ts`, `core/commands/actions.ts`, `core/CrackManager.ts`, `core/ComplicationManager.ts`, `utils/gameLogic.ts`, `hooks/useInputHandlers.ts`, `components/GameBoard.tsx` on `archive/goops-v1`.

**Touches** key: 🛢 tank/integrity · ⚡ cracks · 💥 rupture/drain · 🌡 pressure · 🧩 pieces/spawn · 🫧 fill/pop · 🏆 scoring · 🎮 controls/input · 🔧 breakdowns (F06) · 🖥 console/UI
**Plugs in as** (TDD D06): **M** = modifier (a number the engine reads at one spot) · **A** = ability (charge + fire + effect) · **F** = feature flag (the UI reads it) · **B** = breakdown modifier (waits for F06)

## Muzzy's two (already wanted)
- **Slower depressurise after a rupture** → modifier `ruptureDrainTimeMult` (× `rupture.drainMs`): more time to zap leftovers before the shift ends. Ready in the engine now.
- **Tougher tank (more cracks before rupture)** → modifier `integrityDrainMult` (× `integrity.drainPerCrackPerSec`): open cracks wear the tank slower. Ready now; the test-only "Sturdy tank" proves it. If the "X of 10 cracks → rupture" fallback is ever used instead, the same upgrade becomes `+N cracks allowed`.

## Onboarding band (ranks 2–9)
| Upgrade (type · rank · max) | What v1's code did | Touches | New loop | PROPOSAL (new loop) | Plugs in |
|---|---|---|---|---|---|
| **Circuit Stabilizer** (passive · 2 · 4) | Lights grace before dimming = 5 s + 0.75 s/level. Max level: lights repair uses 3 buttons, not 4. | 🔧 | Unchanged, but breakdowns aren't designed yet | Keep: lights breakdown starts later; max level = easier repair. | B · needs F06 |
| **Auto-Popper** (passive · 3 · 4) | At the very end, each leftover cell is removed with chance 1 − (0.20 − 0.04 × level) **before** the 50-pt/cell penalty (`Math.random`, not seeded). Level 0 = none, so level 1 jumps straight to 84 % removed. | 🏆 💥 | Changed: the rupture drain already gives a "zap what's left" window, so leftovers matter more | **A:** becomes Muzzy's "slower depressurise": rupture drain lasts +X % per level (`ruptureDrainTimeMult`). **B (alt):** keep the name, make it deterministic: leftover penalty −X % per level (`leftoverPenaltyMult`, seeded, no jump at level 1). | M (both ready) |
| **Capacitor Efficiency** (passive · 4 · 4) | Laser drain per popped cell × (1 − 0.0625 × level). Max: laser repair has 2 slider positions, not 3. | 🔧 🫧 | Unchanged (breakdown). Watch-out from GDD §2: a laser that drains on pop punishes your best move | Keep, but its shape follows whatever F06 makes the laser breakdown. | B · needs F06 |
| **Cooldown Booster** (active · 5 · 3) | On fire: every breakdown cooldown still running gets +25 / 35 / 50 % of its remaining time. Charges in 20 s. | 🔧 | Unchanged (breakdown) | Keep: "buys calm" — no breakdowns for a while. | A · needs F06 |
| **Gear Lubrication** (passive · 6 · 4) | Controls heat drains 50 %/s × (1 + 0.125 × level) when idle. Max: dial repair 3 turns, not 4. | 🔧 🎮 | Unchanged (breakdown) | Keep with F06. | B · needs F06 |
| **Focus Mode** (passive · 7 · 4) | While in a repair minigame, the shift clock runs at 1 − 0.1 × level speed. | 🔧 🖥 🌡 | Changed: there is no shift clock; the console currently pauses the shift (Sprint 03 note) | If F06 keeps the shift running at the console: pressure, cracks and integrity all run at (1 − 0.1 × level) while you're at the console — one `timeScale` the screen passes to `tick`. If the console pauses: obsolete → replace. | M (screen-side) · needs F06 |
| **Dense Goop** (passive · 8 · 4) | Fall speed × (1 + 0.125 × level) (msPerRow ÷ that). Can be respecced (a self-chosen difficulty: faster pieces, more drops per shift). | 🧩 🎮 | Unchanged. Faster pieces = more goop per shift = more chances to seal before the tank wears out | Keep as a risk/reward choice: `fallSpeedMult`. | M (ready) |
| **Pressure Control** (passive · 9 · 8) | +5 s shift length per level (max +40 s). Also stretched the piece-size zones (each = shift length ÷ 3). | 🌡 🧩 | **Obsolete as written** — no shift clock | **A:** pressure rises slower: `pressureRiseTimeMult` (+X % per level) → cracks come slower too, since they follow pressure. **B:** becomes Muzzy's "tougher tank" (`integrityDrainMult`). | M (both ready) |

## Junk band (ranks 10–18)
| Upgrade | What v1's code did | Touches | New loop | PROPOSAL | Plugs in |
|---|---|---|---|---|---|
| **Junk Uniformer** (passive · 10 · 4) | First junk cell picks a random colour; each later junk cell copies it with chance 0.10 × level. | 🧩 🛢 | Unchanged (starting junk is the same) | Keep: `junkSameColorChance` (needs the engine's junk placement to read it — one rng call per cell, only when > 0, so no-upgrade shifts don't change). | M (spot named, not built) |
| **Goop Swap** (passive · 12 · 4) | Hold-to-swap time 1.5 s − 0.25 s/level (min 0.5 s). Input layer, not the engine. | 🎮 | Unchanged (same 1.5 s hold, `content/tuning/tank.json holdToSwapMs`) | Keep: `swapHoldTimeMult` read by `src/input`, not the engine. | M (input-side) |
| **Goop Dump** (active · 15 · 3) | On fire: 1/2/3 waves of 18 single cells of the falling piece's colour, random columns, 80 ms apart, waves 600 ms apart. Charges in 15 s. Not seeded. | 🧩 🛢 🫧 | Mostly unchanged; dumped goop left in the tank at the end costs points, and dumping during a rupture can block spawns | Keep; seeded; the engine owns a "dump queue" (effect state) that drops cells over time. Can't fire during a rupture (proposal). | A |
| **Sealing Bonus** (passive · 18 · 4) | Each sealed crack cell cuts every running **breakdown** cooldown by (10 % + 5 % × level) of what's left. ⚠ That makes breakdowns come back **sooner** — the opposite of a bonus. The text ("reduces active cooldowns more") reads like it meant **ability** charge. Likely a v1 bug. | 🔧 ⚡ | Changed: fix the intent | Each seal adds extra **ability charge**: `abilityChargePerSealMult` (+X % per level). No F06 needed. | M (ability side) |

## Mixer band (ranks 20–28)
| Upgrade | What v1's code did | Touches | New loop | PROPOSAL | Plugs in |
|---|---|---|---|---|---|
| **Active Expansion Slot** (feature · 20 · 1) | 2 abilities equipped. | 🖥 | Unchanged | Keep: `features.abilitySlots`. | F |
| **Goop Hold Viewer** (feature · 22 · 1) | Shows the held piece. | 🖥 | Unchanged — the engine already exposes `held`/`heldCells`; the remake's HUD shows neither yet | Keep. | F · needs hold viewer UI |
| **Goop Colorizer** (active · 25 · 3) | On fire: the next 6/7/8 pieces take the falling piece's colour (the preview too). No falling piece → charge wasted. Charges in 25 s. | 🧩 | Unchanged | Keep; fire is rejected (charge kept) when there's no falling piece. | A |
| **Goop Window** (feature · 28 · 1) | Shows the next piece. | 🖥 | Unchanged — engine exposes `next`/`nextCells` | Keep. | F · needs next-piece window UI |

## Cracked band (ranks 30–38)
| Upgrade | What v1's code did | Touches | New loop | PROPOSAL | Plugs in |
|---|---|---|---|---|---|
| **Slow Cracks** (passive · 30 · 4) | Only affected crack **growth** (rank 30+ expanding cracks): spread chance −5 %/level. | ⚡ | **Obsolete as written** — the remake has no expanding cracks (yet) | New cracks come less often: `crackEveryMult` (+X % time between cracks per level). If expanding cracks return at rank 30, it also slows their spread. | M (ready) |
| **Crack Matcher** (passive · 32 · 4) | When the next piece is made, its colour = the lowest crack's colour with chance 0.25 × level. | 🧩 ⚡ | Unchanged | Keep: `crackColorBias` (needs the piece maker to read it — one extra rng call only when > 0). | M (spot named, not built) |
| **Crack Down** (active · 35 · 3) | On fire: the next 3/5/7 cracks spawn in the bottom 4 rows (ignoring the pressure line). Charges in 30 s. | ⚡ | Unchanged; useless during a rupture (no new cracks) | Keep — the test-only "Low cracks" is exactly this. Fire rejected during a rupture. | A (proven by the test upgrade) |
| **Active Expansion Slot 2** (feature · 38 · 1) | 3 abilities equipped. | 🖥 | Unchanged | Keep. | F |

## Active abilities (all four)
- **v1 charging (code):** each equipped ability charged on its own clock (Cooldown Booster 20 s, Goop Dump 15 s, Colorizer 25 s, Crack Down 30 s to full) **plus +25 % per sealed crack cell**. Fire only at 100 %, then back to 0. v1 charged even while you sat at the console.
- **New loop (built):** each ability has `chargePerSecond` and `chargePerSeal` in `content/tuning/upgrades.json`; charge is 0..1. **PROPOSAL:** charging pauses during a rupture (built that way — the rupture is the "last zaps" window).
- **Needs new UI:** an ability button/circle per slot (v1: grey circle fills with colour, glows when ready), and an equip screen at the console (F21 has "no upgrades bar yet").

## Needs other work first
- **Breakdowns (F06, not designed):** Circuit Stabilizer, Capacitor Efficiency, Gear Lubrication, Cooldown Booster, Focus Mode (and Sealing Bonus as v1 wrote it).
- **New UI:** Goop Hold Viewer (held piece), Goop Window (next piece), Active Expansion Slots (ability bar), every active (charge circle), the console's upgrade/equip screen.
- **Ready in the engine today:** Muzzy's two, Dense Goop, Pressure Control (either version), Auto-Popper (either version), Slow Cracks, Crack Down (as the test ability).
