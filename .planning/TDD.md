# Goops — Technical Design Document (TDD)

> How the game is built. Plain English first; code names in `backticks` only where they help.
> Living document — /define writes it, /develop keeps it true, /tdd shows it.
> Last updated: 2026-10-19 (F02 close-out: the goo written up from the real code)

## 1. At a glance
- **Platforms:** web (desktop + phone browsers), installable PWA later (like v1).
- **Stack:** Vite + TypeScript + React for screens/HUD, plus one plain WebGL2 canvas for the tank and goo. Why: the goo lab proved WebGL2 + hand-written physics runs at 60 fps; no 3D, so no R3F.
- **Where it runs online:** GitHub Pages (v1's `gh-pages` stays live until /deliver replaces it).
- **Dev Kit tools used:** Tuning (every `content/tuning/*.json`, goo knobs included — edits show live), ⏸ / ◐ Pause, Snapshots and Bug capture (`src/devkit-game/goopsAdapter.ts`).

## 2. How it fits together
```mermaid
flowchart LR
  Input[Touch / keys] --> Engine[Shift engine: grid rules]
  Engine -- state + events --> Goo[Goo overlay: Jelly or Particle]
  Engine -- state --> HUD[React HUD + screens]
  Data[(content/*.json)] --> Engine
  Data --> Goo
```
- **Shift engine** (`src/engine/`): pure TypeScript, no screen, no timers of its own. Owns the tank grid (30 columns around, 24 rows), pieces, spin, merge, fill, pop, pressure, cracks, score. `tick(ms)` advances it; actions come in (`spin`, `rotate`, `softDrop`, `hold`, `pop`…); events come out (`spawn`, `move`, `rotate`, `lock`, `merge`, `ready`, `pop`, `fall`, `crack`, `reject`…). Seeded random, so a shift can be replayed.
- **Goo overlay** (`src/goo/`): reads the engine's state + events, never writes back. Two interchangeable renderers, Jelly (`src/goo/jelly/`, one soft body per group, the F02 pick, default) and Particle (`src/goo/particle/`), chosen in Settings → Goo style. First ported from the lab sketches `lab-L4-jelly.html` / `lab-L3-particles.html`; the code is now the truth (§2b).
- **Tank view** (`src/view/`): turns tank columns into screen space around the spin (the 12 visible columns of 30), draws the tank, grid lines, pressure water, cracks, ghost piece, fill progress. Shared by both goo renderers.
- **Input** (`src/input/`): v1's controls — drag sideways = spin, tap left/right half = rotate, drag down = fast drop, tap a ready blob = pop; keyboard on desktop.
- **Screens** (`src/ui/`): console-lite start, shift HUD, end-of-shift report, Settings (goo style).

**Golden rules**
- **The grid is the game, the goo is the costume.** Rules are decided by the engine's grid; the goo only shows them. Switching the goo style (or off) changes no result. (v1's I-piece locking bug came from goo physics deciding the falling piece's position.)
- Every tweakable value lives in `content/`, never hardcoded.
- The engine has no `Date.now()`, no `Math.random()` outside its seeded generator, no DOM.

## 2b. Game-specific systems
### The goo (F02 → built in F15)
**The idea:** the grid decides every rule; the goo is only a picture that follows the grid. Pillar "the goo is alive" — it jiggles, sloshes, stretches and sticks — but nothing it does is ever read back by the engine (`src/goo/types.ts`: renderers READ state + events, never write). Switching style mid-shift changes no result.

**Two looks, one plug** (`GooRenderer` in `src/goo/types.ts`: `frame`, `setKnobs`, `dispose`, `motion`):
- **Jelly** (default) — `src/goo/jelly/`. One soft body per same-colour group: a ring of outline points traced round the group's cells (`outline.ts`, rounded by `corner`). Each point is pulled toward "keep my shape" (best rigid fit of its rest shape) and "stay on my grid spot" (`home`), with damping (`viscosity`).
- **Particle** — `src/goo/particle/`. Each cell owns 9 particles on a 3×3 grid, each on a weak spring to its spot. Same colours stick (bonds + pull), other colours push apart a little so seams stay clean.
- Picked by the Settings row **Goo style** (`content/ui/settings.json` → `src/game/gooStyle.ts`); `src/game/gooFactory.ts` makes the renderer. A change rebuilds it on a fresh canvas (the canvas is keyed by style in `ShiftStage.tsx`). Shared parts: `src/goo/shared/` (springs for the falling piece, tank wrap maths, colours, knob files, WebGL helpers).

**One frame** (`src/game/ShiftStage.tsx`):
```mermaid
flowchart LR
  Tick["engine.tick(dt × rules rate)"] --> Ev["engine.takeEvents()"]
  Ev --> Cam["camera glides to state.spin (tank.json cameraSpeed)"]
  Cam --> Tank["drawTank (2D canvas, under)"]
  Cam --> Goo["goo.frame(state, events, view, dt)"]
  Goo --> Bodies["events → goo bodies / particles → physics steps"]
  Bodies --> Draw["WebGL draw (canvas over the tank)"]
```
- Each frame the renderer first copies any Dev Kit edit of its knob file and of `goo-colors.json` (`followFile` in `shared/knobs.ts`), then handles the events, then steps the physics, then draws.
- A frame can carry MANY events (a slow frame, tests fast-forwarding): each event is handled against its own piece, never by adding offsets across pieces (Jelly bug fixed 2026-10-17).
- **View space** (D03): the goo simulates in cells around the camera, so when the tank turns every grid spot moves and the goo sloshes after it for free. The spawn rows above the tank are clipped off (CSS clip-path), and the shaders only draw inside the 12-column tank window (`tankWindow`, `shared/tank.ts`).

**What happens when…**
| Moment | Jelly | Particle |
|---|---|---|
| **Falling piece** | Its own body, placed by the shared piece pose (`shared/piecePose.ts`): placed by `state.spin` so it stays put while the tank slides under it; glides smoothly between rows (`piece.fall`); a rotate lags 90° behind and springs over with a little overshoot; a sideways move lags. Touching a same-colour jelly makes a sticky string (`tension`). | Same piece pose; the 4 clumps are carried with it so a rotate swings them round as one. |
| **Landing** (`lock`) | The piece's wobble is copied into the new grid body; a squash kick on the landed cells, a smaller one on their neighbours. | The clumps are handed to the locked cells by shape; a thump squashes them out and nudges neighbours (`wobble`). |
| **Merging** | Bodies are rebuilt whenever the grid or groups change. A new body copies the wobble of the nearest old points; one made from 2+ old bodies gets a merge kick. A body that split gets a string between its parts that thins and snaps (`tension`), dripping a bead. | No rebuild: same-colour particles that touch bond, so merges just happen. `magnetism` makes nearby same-colour goo reach for each other in both looks. |
| **Filling** | The fill line comes from the engine's group fill (`groupFillLines`, rises from the bottom row); it rides with the body's sag. Not-yet-filled part drawn see-through/darker (`unfilledAlpha`, `unfilledDim`); ready = glow pulse (`readyGlow`, `readyPulse`). | Same, per particle. |
| **Popping** | Placeholder (the laser "explode/harden" look is still open): home springs let go, it swells a touch, shrinks and fades over `popMs`; neighbours get a small inward kick. | Placeholder: particles shrink toward where they were and fade over `popMs`. |
| **Goop falling after a pop** (`fall`) | Cells keep where they were drawn and fall to their new spot under `gravity`, landing with a squash and re-merging. | Clumps move to their new cells and fall there (`gravity`, `landing`, `maxFall`). |
| **Poke** (a zap on goop that can't pop yet: still filling or above the line → engine `reject` with `cell`) | Squash + press-in kick on that jelly, size `poke`. | A ripple from the poked cell through its cluster, weaker further away, size `poke` × `wobble`. |
| **Tank turning** | Locked goo rides `spinCarry` of each turn at once and sloshes behind for the rest (0.5 = half the slosh, Muzzy 2026-10-18). Popping goo and drips ride the whole turn. A body crossing the wrap seam moves with its whole sim; a ring all the way round is rebuilt as the camera moves. | Same `spinCarry` rule; popping particles ride the whole turn; the falling piece isn't on the tank, so it's left alone. |
| **Hold swap** | A different piece without a spawn appears where it is. | The old piece's goo fades; the new one appears. |

**Pause and slow time** — the goo gets the frame's time × the rules clock rate (`ShiftStage.tsx`):
- Playing → normal; at the console mid-shift → slow-motion at `consoleTimeScale`; a menu → stands still.
- Dev Kit ⏸ full pause → the looks clock stops, so the goo freezes.
- Dev Kit ◐ half pause → rules stop; the goo moves only if `content/tuning/pause.json` `halfPauseGooMoves` is on. **It's `false` now**, so the goo stands still in a half pause — its ready glow pulse too (the goo's own clock only runs on the time it's given). The camera glide and the tank view's effects keep moving.

**Performance** (target in §5; `node e2e/perf.mjs` measures fps + worst frame on a 390×844@3× phone size and 1280×800 desktop, both looks, busy tank — reports only, no pass/fail line):
- Pixel ratio capped by `maxDpr` (1.5); the goo is drawn into half-res and quarter-res textures, full res only for the last pass.
- Physics steps at 120 per second. Jelly: frame time capped at 50 ms, split into sub-steps. Particle: fixed steps, at most 4 per frame — a very slow frame makes the goo slow-mo instead of piling up work.
- Particle simulates only columns within `margin` (3) of the screen, with hard caps (9,000 particles, 40,000 bonds) and a spatial hash for neighbours. Jelly simulates every body all the way round the tank and only skips drawing the off-screen ones.
- Phones without float textures fall back to 8-bit ones (both looks).

**Tests:** `tests/goo/` (colours, knob files, piece turn + glide, wrap seam, fill lines); `e2e/poke.mjs` (a click on goop that can't pop yet makes it move, both looks, via the dev hook `gooMotion`); `e2e/perf.mjs`. The dev-only goo lab (`/goo-lab.html`, `src/goo/lab/`, a fake engine) is not in the production build.

**Timers**
| Timer | Length | Owned by | Starts when | On expiry |
|---|---|---|---|---|
| Pressure rise | 0→100% in `pressure.riseMsToFull` (75 s) | engine | shift starts | caps at 100% (cracks at the top rate) |
| Crack spawn | 5 s at 0% → 1 s at 100% (`cracks.everyMsAtEmpty/AtFull`) | engine | shift starts | a crack in an empty cell at/below the pop line |
| Integrity drain | `integrity.drainPerCrackPerSec` per open crack | engine | a crack opens | integrity 0 → rupture |
| Rupture drain | 100%→0 in `rupture.drainMs` (5 s) | engine | integrity 0 or overflow | pressure 0 → shift ends (won if quota met) |
| Piece fall step | v1 speed | engine | piece spawns / steps | piece moves down a row or starts lock delay |
| Lock delay | 500 ms, max 10 resets (v1) | engine | piece touches down | piece locks |
| Fill | 375 ms × group size (v1) | engine | group formed/changed | group ready to pop |
| Pop / seal vent | v1 refund maths, ms ÷ riseMsToFull | engine | zap / seal | pressure drops |
| Visor grace | `visor.graceMs` (5 s) × `visorGraceMult` | engine (F23) | fast drop released (and shift start, repair) | the signal starts fading |
| Visor fade | 1 → `visor.breakAt` (0.10) in `visor.fadeMs` (5 s), from wherever it is | engine | grace over | breaks at 0.10 (snaps to 0.05) |
| Controls cool delay | `controls.coolDelayMs` (200 ms) | engine | each tank turn | heat cools at `coolPerSec` × `controlsCoolMult` |
| Breakdown cooldown | max(8, 20 − (rank − unlock)) s × `breakdownCooldownMult` | engine | a repair | the machine can break again (its meter was kept `cooldown.margin` above the break point) |
| Console time scale | the game ticks the engine at `consoleTimeScale` (0.25) | game | at the console mid-shift | — (the engine is purely dt-driven) |

## 2c. Upgrades & abilities  (F22 — plumbing only; no real upgrade is in the game yet)
Every v1 upgrade has a home: `design/upgrades-map.md`. Three kinds, three plugs — the engine stays pure and seeded, and with no upgrades it plays **exactly** as before (tested: same events, score and tank on seeded shifts).
```mermaid
flowchart LR
  Book[(content/tuning/upgrades.json)] --> Resolve["resolveUpgrades(book, owned, equipped)"]
  Save[(save: owned levels + equipped)] --> Resolve
  Resolve -- modifiers + abilities --> Engine["createShift(config, { modifiers, abilities })"]
  Resolve -- features --> Screens[HUD / console]
```
- **Passive → modifiers.** `Modifiers` (src/engine/upgrades.ts) is a set of named multipliers, 1 = no change, each read at the exact line that uses its tuning value: `integrityDrainMult` (× integrity drain per crack), `ruptureDrainTimeMult` (× rupture drain time), `pressureRiseTimeMult` (× pressure rise time; vents use the same total, they are "ms of rise"), `crackEveryMult` (× time between cracks), `fallSpeedMult` (× fall speed, fast drop too), `leftoverPenaltyMult` (× leftover penalty); breakdowns (F23): `laserDrainMult` (× laser drain per zapped cell — Capacitor Efficiency), `visorGraceMult` (× visor grace — Circuit Stabilizer), `controlsCoolMult` (× controls cooling — Gear Lubrication), `breakdownCooldownMult` (× the cooldown after a repair). Several upgrades on one modifier combine as (1 + sum of `add` values) × product of `mul` values, so JSON order never matters. `clampModifiers` drops unknown names, turns broken numbers back to 1 and clamps to safety rails (never 0 where the engine divides). New passives that need a new hook (Junk Uniformer, Crack Matcher) add a modifier whose neutral value takes **no extra random rolls**, so seeded shifts stay the same.
- **Active → ability hooks.** `createShift({ abilities: AbilitySpec[] })`; `state.abilities = [{ id, effect, charge 0..1, ready }]`. Charge comes from play time (`chargePerSecond`) and seals (`chargePerSeal`), only while the phase is `playing` (not during a rupture). `act({ type: 'ability', id })` fires a ready one: the effect's fire function (src/engine/abilities.ts `ABILITY_EFFECTS`) starts it or says no (→ `reject`, charge kept). Lasting effects live in `state.effects` (e.g. `lowCracks: { id, left, rows }`) and the engine reads them where they bite (crack spawn). Events: `abilityReady`, `ability`, `abilityEnd`.
- **Feature → flags.** `resolveUpgrades(...).features` = flag → level (e.g. next-piece window, hold viewer, ability slots). Screens read them; the engine already exposes next/held pieces.
- **Not the engine's:** hold-to-swap time (input), the broken-controls slow held spin (input), the visor glitch (drawn from `machines.visor.health`), console time scale (Focus Mode → the screen's `tick`).
- **Proof:** two `testOnly` upgrades in upgrades.json — *Sturdy tank (test)* (integrity drain × 0.5) and *Low cracks (test)* (2 seals to charge; the next 3 cracks form in the bottom 4 rows). `playableUpgrades()` never returns test-only ones; nothing in the game reads upgrades.json yet.

## 3. Data the game reads
| File | What's in it | Edited with |
|---|---|---|
| `content/tuning/shift.json` | tank size, shift length, fall speed, lock delay, fill time, refunds, crack rules | Obsidian (Dev Kit later) |
| `content/tuning/breakdowns.json` | the three machines' meters (v1 numbers), unlock ranks, repair cooldown, `consoleTimeScale` (F23) | Obsidian |
| `content/tuning/upgrades.json` | upgrade definitions: type, rank, max level, per-level effects / ability charge + numbers (only the two test-only ones so far) | Obsidian |
| `content/tuning/goo-jelly.json` | Jelly's knobs (started as Muzzy's Preset 2; plain-English help for each under `_help`) | Dev Kit Tuning (live) / Obsidian |
| `content/tuning/goo-particle.json` | Particle's knobs (started as Muzzy's Preset 1; `_help` too) | same |
| `content/tuning/goo-colors.json` | colour name → hex (red, blue, green, yellow, purple, white, black); `shift.json` `colors` sets their order | same — the goo, cracks and ghost change at once |
| `content/tuning/pause.json` | `halfPauseGooMoves` (off) — does the goo keep moving in the Dev Kit's ◐ half pause | Dev Kit Tuning |
| `content/text/en.json` | player-facing words | Obsidian |
| `content/ui/art.json` | which of Muzzy's pictures goes where: the console (layers cut from art/Example1.svg, each at its box in the mock-up's units; the views; periscope travel + grip; where the game writes words), end-report frame + its cut lines, buttons | Obsidian |

**Goo knobs Muzzy can change live** (Dev Kit → Tuning; the renderer picks up a changed value on the next frame — `followFile` in `src/goo/shared/knobs.ts`). Both files share most names:
- `stiffness` — how hard the goo springs back to its grid shape (Jelly 700, Particle 189). High = firm, fast jiggle.
- `viscosity` — damping / thickness (Jelly 6.5, Particle 0.21). Low = jiggles keep going.
- `wobble` — size of the kicks on land, rotate, merge, pop (Particle: also the idle wiggle).
- `gravity` — how fast loose goo falls after a pop (m/s²).
- `magnetism` — same-colour goo reaching for each other (reach 0.25 + 0.5 × this cells).
- `tension` — sticky strings: how far they stretch before they snap (0.35 + 0.75 × this cells; 0 = none).
- `spinCarry` — how much of a tank turn locked goo rides at once (0 = full slosh, 0.5 now, 1 = none).
- `poke` — how hard goop jiggles when zapped before it can pop (0 = off, 1 = gentle, 2 = big jolt).
- `translucency`, `wetness` — see-through and shine.
- `unfilledAlpha`, `unfilledDim` — how the not-yet-filled part looks; `readyGlow`, `readyPulse` — the ready-to-pop glow.
- `popMs` — pop fade length (Jelly 600, Particle 350; placeholder until the laser look is designed).
- `maxDpr` — pixel-ratio cap (performance).
- Jelly only: `home` (grid pull as a share of stiffness — also how much spinning sloshes), `corner` (outline rounding), `skin` (off).
- Particle only: `threshold` (fatter ↔ beadier edge), `blur`, `dome`, `splat`, `snap`, `landing`, `maxFall`, `margin` (columns simulated past the screen), plus `bulge`, `absorb`, `fresnel` (shading; no `_help` line yet).

## 4. Standards
- **Folders:** `src/engine` rules · `src/goo` renderers · `src/view` tank drawing · `src/input` controls · `src/ui` screens · `content/` data · `tests/` unit tests · `e2e/` Playwright checks.
- **Naming:** files `camelCase.ts`, components `PascalCase.tsx`, JSON keys camelCase.
- **Readable code:** plain names, small files, a one-line comment on anything non-obvious.
- **Tests:** engine rules get unit tests (ported from v1's tests where the rule is the same); key flows get a Playwright smoke check. Feel is judged by Muzzy.

## 5. Budgets
| | Target | How it's checked |
|---|---|---|
| Frame rate | 60 fps on a mid-range phone, full tank, either goo style | fps counter + Playwright |
| First load | < 3 s on 4G | /deliver quick check |

## 6. Security & fairness
- Single-player, no server. Nothing to cheat against yet.

## 8. Decisions log
```
D08 · 2026-10-18 · Breakdowns live in the engine as three meters (F23)
  Proposed by: Claude (shape) from Muzzy's F06 calls   Options: the game tracks the meters / the engine does
  Chose: the engine (src/engine/machines.ts) — the meters respond to engine actions (zap, land, spin, fast drop), so
  they stay pure, seeded and testable. createShift({ breakdowns: breakdowns.json }) switches them on; without it every
  machine stays locked (old shifts unchanged). state.machines[id] = { unlocked, health 0..1, broken, cooldownMs };
  events breakdown / repaired / prime; act({ type: 'repair', machine }) (not broken → reject). Only the laser's effect
  is a rule (first zap primes, second pops; no fill restart, unlike v1 — softer); the visor glitch is drawn by the
  game from health; the slow held spin is the input layer's. A rupture freezes the meters (repairs still work). During
  a cooldown a meter stays `cooldown.margin` (0.05) above its break point, so it can't break the instant the cooldown
  ends (v1 could). The visor fades from wherever it is (v1 recomputed from 100% and could jump up).
D07 · 2026-10-18 · The console = the main menu, cut from Muzzy's mock-up (F21)
  Proposed by: Claude   Options: rebuild it from the separate part files (ConsoleBase, Periscope…) / cut it from Example1.svg
  Chose: cut named groups out of Example1.svg (art-prep), each cropped to its box in art.json and placed at that same box
  (kit 0.12.0 ArtStage — picture units, never stretched), so it lines up exactly as he drew it. Words stripped and written
  by the game (fonts can't ship). Periscope pulled → the shift is made (paused) under the console, which slides away;
  back = the console slides up over the tank and the meter plays the XP since it last showed (meterSteps), so several
  "Next shift"s in a row all show. Kit also got PullHandle (drag or tap), LevelMeter, Screen column / swipe / slide
D06 · 2026-10-17 · Upgrades plug in as modifiers, ability hooks and feature flags (F22)
  Proposed by: Muzzy ("be coding with their interactions in mind") + Claude (shape)
  Options: v1-style upgrade-id checks scattered through the engine / named modifiers + ability registry
  Chose: one pure resolveUpgrades() turns owned levels into (a) clamped multipliers the engine reads at each tuning
  value, (b) ability specs (charge from time/seals, fire via act, effects in a registry, lasting state in
  state.effects), (c) feature flags for screens. The engine never sees an upgrade id or level; all numbers live in
  upgrades.json; no upgrades = identical shift (tested). Charging pauses during a rupture.
D05 · 2026-10-17 · Muzzy's art served from public/art/, made by scripts/art-prep.mjs (F19)
  Proposed by: Claude   Options: import from art/ via Vite / copy into public/art/ with a prep script
  Chose: prep script → public/art/ (committed) — two files need changing anyway (Title's words outlined so no font
  ships; EndGameScreen cut to its frame), art.json picks them by path, art/ stays Muzzy's source. Kit 0.11.0 got
  generic art skins (Button art up/down, Screen backdrop, Panel frame nine-way cut) — corners never stretch
D04 · 2026-10-17 · Shift loop = pressure → integrity → rupture (GDD §4)
  Proposed by: Muzzy ("I can make pressure and cracks make sense")
  Chose: no shift clock; open cracks drain tank integrity; rupture drains pressure, then the shift ends. Wall kick is a setting (Rotate vat / Shunt piece); no hard drop.
D03 · 2026-10-17 · Goo simulates in view space around the spin
  Proposed by: Claude   Options: simulate in tank space and wrap at draw / view space
  Chose: view space — spinning the tank moves every home spot, so the goo sloshes for free; the wrap seam sits off-screen
D02 · 2026-10-17 · Both goo styles kept, switchable in Settings
  Proposed by: Muzzy ("since they are just 'overlaying' the grid below")
  Chose: one overlay interface, two renderers (Jelly default)
D01 · 2026-10-17 · Plain WebGL2 + React, no R3F / no game engine
  Proposed by: Claude   Options: R3F / Pixi / plain WebGL2
  Chose: plain WebGL2 — the goo lab already runs at 60 fps this way; nothing is 3D
```

## 9. Third-party stuff
| What | Used for | License | OK for commercial? |
|---|---|---|---|
| React, Vite, Vitest, Playwright | app, build, tests | MIT / Apache-2.0 | yes |
| opentype.js (dev only) | outlines the title's words in scripts/art-prep.mjs | MIT | yes |

## 10. Risks & open questions
- Goo across the wrap seam (a group spanning column 29 → 0): handled — groups are unwrapped into one piece (`unwrapCells`, tested in `tests/goo/tank.test.ts`); a ring all the way round is cut on the far side.
- Particle goo on a full tank: already simulates only near the screen (`margin`) with caps (9,000 particles); past the cap, new cells quietly get fewer particles.
- Jelly simulates every body all the way round the tank, even off-screen ones; a very full tank on a slow phone is the case to watch (`node e2e/perf.mjs`; no pass/fail line yet).
- The pop look is a placeholder in both styles until the laser "explode/harden" look is designed.
