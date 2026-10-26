# Goops — Upgrades map (F22)
> Every v1 upgrade and active ability: what v1's **code** actually did, what part of the game it touches, what the new shift loop (GDD §4: pressure → cracks → tank integrity → rupture → drain) does to it, and a **PROPOSED** new-loop version. Linked from GDD §5 and `progression.md`.
> **Proposals are taste calls for Muzzy, not decisions.** Upgrades go in later, after the game mostly works; this map exists so the engine is built with every one of them in mind (TDD "Upgrades & abilities", D06).
> Sources: v1 `constants.ts` (UPGRADES), `core/GameEngine.ts`, `core/commands/actions.ts`, `core/CrackManager.ts`, `core/ComplicationManager.ts`, `utils/gameLogic.ts`, `hooks/useInputHandlers.ts`, `components/GameBoard.tsx` on `archive/goops-v1`.

**Touches** key: 🛢 tank/integrity · ⚡ cracks · 💥 rupture/drain · 🌡 pressure · 🧩 pieces/spawn · 🫧 fill/pop · 🏆 scoring · 🎮 controls/input · 🔧 breakdowns (F06) · 🖥 console/UI
**Plugs in as** (TDD D06): **M** = modifier (a number the engine reads at one spot) · **A** = ability (charge + fire + effect) · **F** = feature flag (the UI reads it) · **B** = breakdown modifier (waits for F06)

## Muzzy's two (already wanted)
- **Slower depressurise after a rupture** → modifier `ruptureDrainTimeMult` (× `rupture.drainMs`): more time to zap leftovers before the shift ends. Ready in the engine now.
- **Tougher tank (more cracks before rupture)** → modifier `integrityDrainMult` (× `integrity.drainPerCrackPerSec`): open cracks wear the tank slower. Ready now; the test-only "Sturdy tank" proves it. If the "X of 10 cracks → rupture" fallback is ever used instead, the same upgrade becomes `+N cracks allowed`.

- **Seal venting (Muzzy, F27, 2026-10-18)** → modifier `sealVentMult` (× `cracks.sealRefundMs`): each seal vents more pressure (default 1 s of rise, kept low on purpose so pressure keeps climbing). Ready in the engine now (2 = twice the vent, tested). Name, rank and per-level steps are taste calls.

## Onboarding band (ranks 2–9)
| Upgrade (type · rank · max) | What v1's code did | Touches | New loop | PROPOSAL (new loop) | Plugs in |
|---|---|---|---|---|---|
| **Circuit Stabilizer** (passive · 2 · 4) | Lights grace before dimming = 5 s + 0.75 s/level. Max level: lights repair uses 3 buttons, not 4. | 🔧 | Unchanged, but breakdowns aren't designed yet | Keep: lights breakdown starts later; max level = easier repair. | M ready (F23): `visorGraceMult` × `visor.graceMs` (v1 +0.75 s/level ≈ +15 %/level); easier repair = F24 |
| **Auto-Popper** (passive · 3 · 4) | At the very end, each leftover cell is removed with chance 1 − (0.20 − 0.04 × level) **before** the 50-pt/cell penalty (`Math.random`, not seeded). Level 0 = none, so level 1 jumps straight to 84 % removed. | 🏆 💥 | Changed: the rupture drain already gives a "zap what's left" window, so leftovers matter more | **A:** becomes Muzzy's "slower depressurise": rupture drain lasts +X % per level (`ruptureDrainTimeMult`). **B (alt):** keep the name, make it deterministic: leftover penalty −X % per level (`leftoverPenaltyMult`, seeded, no jump at level 1). | M (both ready) |
| **Capacitor Efficiency** (passive · 4 · 4) | Laser drain per popped cell × (1 − 0.0625 × level). Max: laser repair has 2 slider positions, not 3. | 🔧 🫧 | Unchanged (breakdown). Watch-out from GDD §2: a laser that drains on pop punishes your best move | Keep (F06 kept v1's laser meter). | M ready (F23): `laserDrainMult` × `laser.drainPerCell` (v1 × (1 − 0.0625 × level)); 2-position repair = F24 |
| **Cooldown Booster** (active · 5 · 3) | On fire: every breakdown cooldown still running gets +25 / 35 / 50 % of its remaining time. Charges in 20 s. | 🔧 | Unchanged (breakdown) | Keep: "buys calm" — no breakdowns for a while. | A · needs its effect (running cooldowns are `state.machines[id].cooldownMs`); passive alt ready: `breakdownCooldownMult` × every repair's cooldown |
| **Gear Lubrication** (passive · 6 · 4) | Controls heat drains 50 %/s × (1 + 0.125 × level) when idle. Max: dial repair 3 turns, not 4. | 🔧 🎮 | Unchanged (breakdown) | Keep. | M ready (F23): `controlsCoolMult` × `controls.coolPerSec`; 3-turn repair = F24 |
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
| ~~**Goop Hold Viewer**~~ (feature · 22 · 1) | Shows the held piece. | 🖥 | **Retired by F59 (Muzzy, 2026-10-19):** there is no held piece any more — swap trades with the next piece, and the next-piece window is free from rank 1 | **Slot 22 to refill in beta** with a new upgrade for the new pacing. | — |
| **Goop Colorizer** (active · 25 · 3) | On fire: the next 6/7/8 pieces take the falling piece's colour (the preview too). No falling piece → charge wasted. Charges in 25 s. | 🧩 | Unchanged | Keep; fire is rejected (charge kept) when there's no falling piece. | A |
| ~~**Goop Window**~~ (feature · 28 · 1) | Shows the next piece. | 🖥 | **Retired by F59 (Muzzy, 2026-10-19):** the next-piece window is a rank-1 unlock (progression.json `unlocks.nextPiece`), not an upgrade | **Slot 28 to refill in beta** with a new upgrade for the new pacing. | — |

## Cracked band (ranks 30–38)
| Upgrade | What v1's code did | Touches | New loop | PROPOSAL | Plugs in |
|---|---|---|---|---|---|
| **Slow Cracks** (passive · 30 · 4) | Only affected crack **growth** (rank 30+ expanding cracks): spread chance −5 %/level. | ⚡ | v1's version came back with F39 (growing cracks from rank 30, built 2026-10-25) | New cracks come less often: `crackEveryMult` (+X % time between cracks per level) — and **it also slows growth** (F39): the same multiplier stretches each crack cell's 5–10 s growth roll (twists.ts rollDelay), so a level is both fewer new cracks and slower-spreading ones. | M (ready) |
| **Crack Matcher** (passive · 32 · 4) | When the next piece is made, its colour = the lowest crack's colour with chance 0.25 × level. | 🧩 ⚡ | Unchanged | Keep: `crackColorBias` (needs the piece maker to read it — one extra rng call only when > 0). | M (spot named, not built) |
| **Crack Down** (active · 35 · 3) | On fire: the next 3/5/7 cracks spawn in the bottom 4 rows (ignoring the pressure line). Charges in 30 s. | ⚡ | Unchanged; useless during a rupture (no new cracks) | Keep — the test-only "Low cracks" is exactly this. Fire rejected during a rupture. | A (proven by the test upgrade) |
| **Active Expansion Slot 2** (feature · 38 · 1) | 3 abilities equipped. | 🖥 | Unchanged | Keep. | F |

## Active abilities (all four)
- **v1 charging (code):** each equipped ability charged on its own clock (Cooldown Booster 20 s, Goop Dump 15 s, Colorizer 25 s, Crack Down 30 s to full) **plus +25 % per sealed crack cell**. Fire only at 100 %, then back to 0. v1 charged even while you sat at the console.
- **New loop (built):** each ability has `chargePerSecond` and `chargePerSeal` in `content/tuning/upgrades.json`; charge is 0..1. **PROPOSAL:** charging pauses during a rupture (built that way — the rupture is the "last zaps" window).
- **Needs new UI:** an ability button/circle per slot (v1: grey circle fills with colour, glows when ready), and an equip screen at the console (F21 has "no upgrades bar yet").

## Needs other work first
- **Quick Fix (future, Muzzy 2026-10-18):** every console repair is about 4 steps (laser 4 sliders · visor slide + 3 buttons + slide · controls 4 corners), so an upgrade can take steps off: −1 at level 1, −2 at level 2 ("awesome for later game runs"). **The hook exists:** upgrades.json effects named `laserRepairFewerSteps` / `visorRepairFewerSteps` / `controlsRepairFewerSteps` (op `add`, e.g. `byLevel: [1, 2]`) → `resolveUpgrades().fewerRepairSteps` → the console's `midShift.fewerRepairSteps` → `repairSteps(machine, fewer)` in src/game/repairs.ts = max(1, tuning − fewer). One per machine or one for all three is a taste call. It could also be what the max levels of Circuit Stabilizer / Capacitor Efficiency / Gear Lubrication give (v1's "easier repair at max").
- **Breakdowns (F06 decided, F23 built in the engine):** Circuit Stabilizer, Capacitor Efficiency and Gear Lubrication plug in now (modifiers above); `breakdownCooldownMult` is ready for a cooldown upgrade. Still waiting: Cooldown Booster's fire effect, Focus Mode (the game's console time scale, `consoleTimeScale` in breakdowns.json × its level), the easier repairs at max level (F24).
- **New UI:** Active Expansion Slots (ability bar), every active (charge circle), the console's upgrade/equip screen (F59 built its door: the Upgrades button + an empty screen that opens from rank 5). (Goop Hold Viewer and Goop Window are retired — F59 — two slots, 22 and 28, to refill in beta.)
- **Ready in the engine today:** Muzzy's two, Dense Goop, Pressure Control (either version), Auto-Popper (either version), Slow Cracks, Crack Down (as the test ability).

## The patterns v1 followed (read from v1's code, 2026-10-21, for F33)
> Source: `archive/goops-v1` @ 63a44e7 — constants.ts:51-330, complicationConfig.ts, App.tsx:58-187, UpgradePanel.tsx, GameEngine.ts, progression.ts.
- **Problem and answer arrive on the same rank (even ranks):** lights + Circuit Stabilizer at 2, laser + Capacitor Efficiency at 4, controls + Gear Lubrication at 6. You meet the problem and are handed the fix in the same rank-up.
- **Odd onboarding ranks = general tools:** 3 Auto-Popper (with the first starting junk), 5 the first active (Cooldown Booster), 7 Focus Mode (once all three machines exist), 9 Pressure Control (with the junk bump). Dense Goop at 8 is the odd one out: a self-chosen speed-up, not a counter.
- **After rank 10 every band uses the same slots +0 / +2 / +5 / +8:** +0 = the counter to the band's new threat, +5 = always an active (15, 25, 35), +8 = a closer (feature / slot / system). 8 upgrades in ranks 2–9, then 4 per band. Each band opens with a threat (10 purple · 20 split pieces · 30 white + expanding cracks · 40 wild pieces) that its upgrades soften ("spike, then ease").
- **Shapes by type:** passives 4 levels of +N % · actives 3 levels with hand-picked steps · features on/off · Pressure Control 8 levels (the scrap sink). Only the 3 machine counters get a different-in-kind bonus at max level: an easier repair (one fewer step).
- **Money:** 1 scrap per rank gained, every level costs 1 (no price scaling). Maxing everything = 68 levels; you have 38 scraps at rank 38 and 50 at rank 50, so you can never own it all → you choose.
- **Free, unlimited respec:** "−" refunds the scrap. Upgrades are a loadout you re-shape between shifts, not permanent picks (why Dense Goop advertises respec).
- **Flow:** shift ends → SHIFT OVER report → scraps added → drag up → idle console → UPGRADES [n] button (between shifts only) → +/− and equip → pull the periscope down for the next shift. Store tabs open by rank (SYSTEMS 2 · UTILITY 3 · TOOLS 5 · FEATURES 20).
- **Never built in v1:** announcing a new upgrade (intro lessons, journal pages, the Veteran's contraband were all stubs) · ranks 40–50 upgrades · nothing on ranks 11, 13, 14, 16, 17, 19 (and the same gaps in later bands).
- **v1 bugs not to copy:** purchases likely reached the engine only after a page reload · Sealing Bonus brought breakdowns back *sooner* · Auto-Popper jumped from 0 % to 84 % at level 1 (and wasn't seeded) · active cards always showed the level-1 numbers.
- **Remake check (2026-10-21):** Focus Mode is NOT obsolete — the shift still runs at 0.25 speed at the console mid-shift (`breakdowns.json consoleTimeScale`), so it can slow that further.

## F33 decisions (Muzzy, 2026-10-22)
1. **Store stays at rank 5, shelf ready:** the Upgrades button still opens at 5 (F59). When it opens, Circuit Stabilizer (lights, 2) and Capacitor Efficiency (laser, 4) are already on the shelf with 4 scraps banked — a "finally, relief" moment. From rank 6 on, problem + fix arrive together again (controls + Gear Lubrication).
2. **Rank 9 Pressure Control = pressure rises slower** (`pressureRiseTimeMult`, + per level, cracks follow pressure so they slow too). Keeps 8 levels as the scrap sink.
3. **Rank 3 Auto-Popper = slower depressurise** (Muzzy's idea, `ruptureDrainTimeMult`): after a rupture the drain lasts longer, more time to zap leftovers. Same role as v1: forgiveness at the end of a shift. (Bought from rank 5, like everything.)
4. **Money stays v1's:** every level costs 1 scrap, 1 scrap per rank, free unlimited take-backs (a loadout). The bots check later whether it feels tight (F51).
5. **Easier repairs, both ways:** max level of each machine fix (Circuit Stabilizer, Capacitor Efficiency, Gear Lubrication) = that repair takes 1 fewer step (v1). Quick Fix (F48) comes later at a 30s+ rank and takes 1 step off all three.
6. **Tougher tank → rank 22** (`integrityDrainMult`): fills a slot freed by F59; arrives with split two-colour pieces (20).
7. **Dense Goop stays at rank 8:** a self-chosen speed-up you can take back; pressure climbs with time, so faster pieces = more sealing chances.

### Ranks 2–9 as decided (F33 ✅)
| Rank | Upgrade | Type · max | New-loop version | Engine |
|---|---|---|---|---|
| 2 | Circuit Stabilizer | passive · 4 | visor (lights) breaks later; max = 1 fewer repair step | `visorGraceMult` ready |
| 3 | Auto-Popper | passive · 4 | slower depressurise after a rupture | `ruptureDrainTimeMult` ready |
| 4 | Capacitor Efficiency | passive · 4 | laser drains less per pop; max = 1 fewer repair step | `laserDrainMult` ready |
| 5 | Cooldown Booster | active · 3 | on fire, every machine's calm time +25/35/50 % | fire effect to build (F34) |
| 6 | Gear Lubrication | passive · 4 | controls cool faster; max = 1 fewer repair step | `controlsCoolMult` ready |
| 7 | Focus Mode | passive · 4 | shift runs slower while you're at the console (× `consoleTimeScale`) | screen-side, to build (F34) |
| 8 | Dense Goop | passive · 4 | pieces fall faster (self-chosen challenge) | `fallSpeedMult` ready |
| 9 | Pressure Control | passive · 8 | pressure rises slower | `pressureRiseTimeMult` ready |
All bought from rank 5 (the store opens then). Per-level steps start at v1's (≈ +12.5–15 % a level) and get checked by the bots/economy sim (F51) — tuning, not taste. Claude's calls (change any): actives keep charging at the console's slowed speed (same clock as the shift) and stop during a rupture (already built).

### Built (F34, 2026-10-22)
All 8 ranks 2–9 upgrades are in `content/tuning/upgrades.json` (players' words in en.json `upgrades.items`) and measured in a real shift (e2e/upgrades.mjs, level 4 vs none): Pressure Control pressure rise ×1/1.2 · Dense Goop fall ×1.5 faster · Auto-Popper rupture drain ×1.6 longer · Circuit Stabilizer visor grace 5.05 → 8.05 s · Capacitor Efficiency laser drain ×0.75 · Gear Lubrication cooling ×1.5 · Focus Mode console speed 0.25 → 0.15 · max machine fixes: repairs 4/3/4 → 3/2/3 steps · Cooldown Booster 3: a visor calm time 7.3 → 10.9 s on fire. Save + shop: TDD D18; the active's button: TDD D19. Still to build: Focus Mode-style console hooks for later upgrades.

### Built (F42, 2026-10-26)
- **Goop Dump** (`goopDump`, rank 15, 15 s, +0.25 a seal): 1/2/3 waves of 18 single cells, 80 ms apart, then 600 ms quiet (v1's code overlapped its waves; the PRD's meaning kept). **Seeded** (the shift's random numbers). Cells only fall into columns whose hidden top rows are clear, so a dump never blocks the next spawn (no free column → that cell is skipped). Refused (charge kept): no falling piece, a wild one, a rupture, or the last dump still raining; a rupture ends a running dump.
- **Goop Colorizer** (`goopColorizer`, 25, 25 s): the next 6/7/8 pieces become the falling piece's main colour (most cells; tie → its first), whole (a two-colour or wild piece becomes one colour, shape and corruption kept). The piece already in the next window counts as #1, so the preview shows it. Refused: no falling piece or a wild one. Fired again → restarts in the new colour.
- **Crack Down** (`crackDown`, 35, 30 s): the existing `lowCracks` effect, 3/5/7 cracks in the bottom 4 rows; refused in a rupture. (*Low cracks (test)* stays as a test-only fixture.)
- **Active Expansion Slot / Slot 2** (`activeSlot` 20, `activeSlot2` 38): features on the flag `abilitySlots`; features on one flag now **add up**, so each owned slot is +1 (even Slot 2 alone). Slots = progression.json `activeSlots` (1) + owned. Taking a slot back unequips the longest-equipped active that no longer fits. Save stays v3 (slots are owned ids).
- Shop cards: `cardNumber: "count"` shows a count ("2 → 3 waves") instead of a percent.
