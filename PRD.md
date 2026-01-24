# Goops - Product Requirements Document

## Overview

**Goops** is a puzzle-action game where players operate as a tank maintenance technician, clearing colorful goop from a cylindrical pressure tank while managing equipment malfunctions. The game combines spatial puzzle-solving with time pressure and multi-tasking.

### Core Fantasy
You're a low-level operator at an industrial facility. Your job: peer through a periscope into a cylindrical tank, drop goop to seal pressure cracks, laser away excess goop, and keep the equipment running. It's mundane. It's stressful. The tank keeps filling. The equipment keeps breaking. You keep playing.

---

## Game Modes

### Console Mode
The main menu and meta-game layer. Players see a retro industrial control console (Homer Simpson at the nuclear plant aesthetic).

**Elements:**
- Operator Rank display with XP bar
- Three complication mini-game panels (Reset Laser, Reset Lights, Reset Controls)
- Status lights and gauges (blinking patterns indicate game state)
- Periscope (physical object that can be pulled down to enter gameplay)
- End Day screen (CRT monitor that drops down on game over)

**Console Light States:**
- **Between sessions (idle):** All orange lights blink randomly at slow, varied speeds
- **During gameplay (no complications):** All lights blink faster, randomly
- **Active complication:** Lights in the affected section go solid (not blinking), indicating action needed. Other sections continue fast blinking.

**Transitions:**
- Pull down periscope → Enter Periscope Mode
- Swipe up during gameplay → Exit to Console Mode (game continues!)
- Game over → End Day screen drops down

### Periscope Mode
The core gameplay. Players look into a cylindrical tank through a viewport showing ~33% of the tank at once.

**Core Loop:**
1. Pressure builds (timer counting down)
2. Cracks appear at the pressure line
3. Goop pieces fall from center of screen
4. Rotate tank to position where goop should land
5. Match colored goop to cracks
6. Laser/pop goop to seal cracks and clean tank
7. Handle complications when they occur (exit to console, fix, return)

---

## Core Mechanics

### The Tank (Cylindrical Grid)

| Property | Value | Notes |
|----------|-------|-------|
| Total Width | 30 columns | Full cylinder circumference |
| Visible Width | 12 columns | ~33% visible at once |
| Visible Height | 16 rows | |
| Total Height | 19 rows | 3-row buffer above visible |
| Grid Type | Cylindrical wrap | X coordinates wrap (0-29) |

The tank is a cylinder. Players see a flat projection of ~33% of its surface. Rotating the tank (A/D keys or drag) changes which section is visible. The cylindrical nature means:
- Goop groups can wrap around the cylinder
- Off-screen events continue happening
- Spatial memory is required

### Goop Pieces

Goop pieces are shapes composed of colored units (similar to puzzle game pieces but with unique identity).

**Properties:**
- Shape: Standard shapes (I, J, L, O, S, T, Z patterns)
- Color: Single color per piece (initially), multi-color possible at higher ranks
- Units: Each cell is a discrete unit for scoring/penalties
- Rotation: Q/E rotates piece while falling

**Multi-Color Pieces (Rank 4+):**
At certain ranks, there's a chance a falling piece will have two colors. Cells [0,1] are colorA, cells [2,3] are colorB.

### Goop Placement (Center Fall)

Goop always falls from the center of the visible screen. The player controls WHERE it lands by rotating the tank underneath it.

**Mechanic:**
- Piece spawns at top center of visible area
- Piece falls straight down (no horizontal movement of piece itself)
- Player rotates the tank (A/D or drag) to position the landing spot
- Piece locks to tank grid on landing, then follows tank rotation
- Ghost piece shows landing position

**Key Insight:** You're not moving the piece — you're spinning the tank underneath it.

### Goop Physics (Sticky Gravity)

When goop lands or goop is removed, physics applies:

1. **Group Detection:** Connected same-color units form a "goop" (group)
2. **Support Check:** A group is supported if ANY unit touches:
   - The floor (bottom row)
   - Another supported group
3. **Falling:** Unsupported groups fall as a unit (sticky gravity)
4. **Merging:** When groups of same color touch, they merge into one goop
5. **Timestamp Reset:** Merged groups get new timestamp (fill animation restarts)

This creates emergent behavior:
- Scaffolding structures can support multiple goop groups
- Removing a key piece causes chain collapses
- Strategic placement enables efficient cleanup

### Goop Filling Animation

After placement or merge, goop "fills" over time before it can be popped.

**Formula:**
```
fillDuration = groupSize * PER_BLOCK_DURATION (375ms per unit)
```

Fill animation progresses row-by-row from bottom to top of the group.

**Gameplay Impact:**
- Larger groups take longer to become poppable
- Strategic timing: place, wait, pop
- Creates tension between building big groups vs. quick cleanup

### Laser/Pop Mechanic

Tapping/clicking a filled goop destroys it.

**Requirements to Pop:**
1. Goop must be fully filled (animation complete)
2. Top of goop must be below pressure line (submerged)
3. Tap/click anywhere on the goop

**Results:**
- All connected same-color units destroyed
- Unsupported goop above falls
- Score awarded based on size, height, combo
- Pressure reduced based on size + tier bonuses
- If goop was covering a matching crack → crack sealed

**"Infused" Goop:**
When goop covers a matching-color crack, those units become "infused" (glowing). Popping infused goop awards bonus time recovery.

### Pressure System

Pressure represents time. It builds continuously and determines:
- Which goop can be popped (must be below pressure line)
- Where cracks spawn (at pressure line)
- Game over condition (100% pressure)

**Visual:** Water level rising from bottom. At 0% pressure, only bottom row is submerged. At 100%, entire tank is "underwater."

**Formula:**
```
pressureRatio = 1 - (timeLeft / maxTime)
waterHeightBlocks = 1 + (pressureRatio * (VISIBLE_HEIGHT - 1))
```

**Pressure Reduction (from popping):**
```
baseRecovery = 0ms (configurable)
unitRecovery = groupSize * 100ms
tierBonus = tier * 250ms (tier starts at 15+ units)
infusedBonus = infusedUnitCount * 3000ms
```

### Cracks (Goal Marks)

Cracks appear on the tank and must be sealed.

**Spawning:**
- Spawn at the current pressure line Y position
- One crack per color active at a time
- Spawn interval: 5000ms
- Random X position (empty cell)

**Sealing a Crack:**
1. Cover crack with matching-color goop
2. Pop the covering goop
3. Crack disappears, counts as sealed

**Uncovering:**
- If goop covering a crack is destroyed by scaffold collapse (not direct pop), crack remains
- Wrong-color goop covering a crack does nothing

**Win Condition Burst:**
When required cracks are sealed AND pressure < 90%:
- All remaining colors spawn cracks simultaneously
- Creates "overtime" bonus opportunity

### Win/Lose Conditions

**Win:** Seal X cracks before pressure reaches 100%
- X = palette.length + operatorRank (scales with progression)
- After winning, gameplay continues until pressure = 100%
- Bonus points for additional cracks sealed

**Lose:** Pressure reaches 100% with fewer than X cracks sealed

**End Game Scoring:**
- All remaining goop units: -50 points each (upgradeable)
- Bonus cracks sealed: +points (TBD)
- Rank bonus (if won): +5000 * operatorRank

---

## Console Mode & Complications

### Complications System

While in Periscope Mode, equipment malfunctions occur based on player actions. Players start at **Rank 0** with no complications, providing a safe learning period.

**Triggers:**

| Complication | Trigger | Rank Unlock | Upgradeable? |
|--------------|---------|-------------|--------------|
| Reset Laser | Capacitor meter empties (drains on pop, refills +10% on piece lock) | Rank 1+ | Yes - slower drain rate |
| Reset Lights | 20% base chance on piece lock when pressure is 3-5 rows above highest goop | Rank 2+ | Yes - lower probability |
| Reset Controls | Heat meter fills to 100% (builds while rotating, drains when stopped) | Rank 3+ | Yes - faster heat dissipation |

**Key Design:** The game does NOT pause when you exit to console. The tank keeps filling, pressure keeps rising. Fix complications fast!

**Complication Cooldown:**
After resolving a complication, the same type cannot trigger again for a cooldown period:
- Base cooldown: 20 seconds (at unlock rank)
- Cooldown decreases by ~1 second per rank above unlock
- Minimum cooldown: 8 seconds
- Upgrades can increase cooldown duration

**Complication Effects (while unfixed):**
- Reset Lights: Dims to 10% brightness + grayscale over 1.5s (periscope only, alert exempt)
- Reset Laser: Two-tap mechanic (first tap primes group and restarts fill animation, second tap pops)
- Reset Controls: Requires 2 inputs per move, held keys move at half speed

**Ignoring Complications:**
- Player can choose to not fix immediately
- Effect persists until fixed
- Some complications (laser, controls) severely hamper gameplay

**Stacking:**
Multiple complications can be active simultaneously.

### Complication HUD Elements (Periscope Mode)

Visual meters show complication buildup, helping players anticipate malfunctions:

**Laser Capacitor Meter** (left side of screen)
- Vertical bar that starts full and drains as player pops goop
- Drains proportionally to units popped
- When empty → LASER complication triggers
- Refills after complication resolved
- Color: Blue → Yellow → Red as it empties

**Controls Heat Meter** (right side of screen)
- Vertical bar that fills as player rotates the tank
- Builds up while rotating (continuous increase)
- Drains quickly when rotation stops (returns to 0 over ~2 seconds)
- When full (100%) → CONTROLS complication triggers
- Player must "juggle" rotation speed to avoid overheating
- Color: Green → Yellow → Red as it fills

**Lights Complication** (no meter)
- No HUD indicator — triggers feel random/unpredictable to player
- This is intentional: creates tension without player control

### Console Mini-Games

Each complication has a corresponding mini-game on the console.

#### Reset Laser (4 Sliders)

**Setup:**
- 4 horizontal sliders, each with 3 positions: Left, Center, Right
- Each slider has 2 indicator lights: one on left, one on right
- Goal: Match each slider position to its lit indicator

**Mechanic:**
- If left light is lit → slide to left position
- If right light is lit → slide to right position
- If BOTH lights are lit → slide to center position

**On Complication Trigger:**
- Sliders are set to random incorrect positions
- Lights are set randomly (but never matching current slider positions)

**Completion:** All 4 sliders in correct positions → complication cleared

**Target Moves:** ~4 (one per slider)

**Upgrade Effect (max level):** No center targets — removes "both lights" positions, making puzzle simpler

#### Reset Lights (Sequence Memory)

**Setup:**
- 1 vertical slider with 2 positions (up/down)
- 3 arcade buttons (blue, green, purple)
- 3 indicator lights above buttons
- 1 indicator light above/below slider
- Goal: Complete a slider-sequence-slider flow

**Flow:**
1. **Slider 1:** One indicator light shows target position. Move slider to match.
2. **Watch:** After correct slider position, a 4-button sequence plays (lights flash in order)
3. **Repeat:** Player must press buttons in the same order as the sequence
4. **Slider 2:** Another indicator light shows opposite position. Move slider to match.

**Sequence Rules:**
- 4 buttons in sequence
- Each button (blue/green/purple) appears max 2 times
- Buttons flash for 400ms with 200ms gaps

**On Complication Trigger:**
- Slider resets to center
- Random slider target generated
- Random 4-button sequence generated

**Completion:** Correct slider → correct sequence → correct slider → complication cleared

**Target Interactions:** ~8 (slider + 4 buttons + slider, with potential mistakes)

**Upgrade Effect (max level):** 3-button sequence instead of 4

#### Reset Controls (Dial Alignment)

**Setup:**
- Circular dial with an arrow/pointer
- 4 light positions at corners (45°, 135°, 225°, 315°)
- Goal: Align arrow to each lit position in sequence, then tap to confirm

**Mechanic:**
1. A corner light illuminates
2. Player spins dial until arrow points at the lit corner
3. Player taps dial to confirm alignment
4. If correct: light turns off, new corner light illuminates
5. If wrong: dial shakes, player must realign
6. Repeat 4 times total
7. After 4th successful alignment → complete

**On Complication Trigger:**
- Dial arrow at random starting position
- First target corner light illuminates

**Completion:** 4 successful alignments → complication cleared

**Target Moves:** 4 dial spins + 4 taps

**Upgrade Effect (max level):** 3 alignments instead of 4

---

## Screen Transitions

### Console → Periscope (Pull Down)

1. Player drags periscope handle downward
2. Screen behind periscope dims dramatically
3. Goggles viewport acts as a mask showing miniaturized gameplay (zoomed out)
4. As periscope reaches bottom, entire view zooms in (leaning into viewport)
5. Mask scales up, revealing full periscope gameplay layer
6. Transition complete → Periscope Mode active

### Periscope → Console (Swipe Up)

1. Player swipes up (touch) or presses designated key
2. View zooms out while mask shrinks (unzooming)
3. Periscope moves up by itself, out of the way
4. Console fully visible
5. **Game continues running in background!**
6. Player must drag periscope back down to return

### End Day Screen (Game Over)

1. Run ends (pressure 100% or win condition met)
2. CRT monitor graphic slides down from top, covering console
3. Background dims dramatically
4. Monitor displays:
   - "SYSTEM FAILURE" or "SHIFT COMPLETE" header
   - Operator Rank with XP bar
   - Final Score
   - Unspent Power (upgrade points)
   - Stats: Cracks Filled (X/Y), Pressure Vented (bonus time earned), Max Mass Purged, Leftover Goop (penalty)
5. "END THE DAY" button at bottom

### End Day → New Run

1. Player swipes up on End Day screen
2. Monitor slides up (edge still visible at top)
3. Message changes to "Pull Down to Start"
4. Console visible with idle light state (slow random blinking)
5. Player drags periscope down → new run begins

### During Run (Console View)

When player exits periscope mid-run (no game over):
- End Day screen hangs slightly visible at top
- Alternating message: "Cleaning in Progress..." / "Current Pressure: XX%"
- Console lights blinking fast
- Active complication sections have solid (non-blinking) lights

---

## Controls

### PC Controls

| Input | Action |
|-------|--------|
| A / Left Arrow | Rotate tank left (hold for continuous) |
| D / Right Arrow | Rotate tank right (hold for continuous) |
| Q | Rotate falling piece counter-clockwise |
| E | Rotate falling piece clockwise |
| W | Swap piece with storage |
| Space | Hard drop (slam) |
| Mouse Click | Pop goop (laser) |
| W (or Swipe Up) | Exit periscope to console |
| Mouse Drag Down | Pull periscope down (enter gameplay) |

### Touch Controls (Mobile)

| Gesture | Action |
|---------|--------|
| Drag left/right | Rotate tank (follows finger) |
| Tap left half of screen | Rotate piece counter-clockwise |
| Tap right half of screen | Rotate piece clockwise |
| Swipe up | Exit periscope to console / swap piece (context-dependent) |
| Drag down on periscope | Enter periscope mode |
| Tap on goop | Pop goop (laser) |

---

## Scoring

### Base Scoring (Pop)

```
perUnit = 10 + heightBonus + offscreenBonus
heightBonus = (TOTAL_HEIGHT - y) * 10
offscreenBonus = 50 (if unit is outside visible area)
comboMultiplier = 1 + (combo * 0.1)
adjacencyBonus = neighborCount * 5

totalScore = (sum of perUnit * comboMultiplier) + adjacencyBonus
```

### Drop Scoring

```
hardDropScore = distanceDropped * 2
```

### End Game

```
goopPenalty = remainingUnits * -50 (min 0 total)
winBonus = operatorRank * 5000 (if won)
bonusCracks = additionalCracksSealed * TBD
```

### Score → XP

Score from each run is added to the player's XP. XP fills the rank meter toward the next Operator Rank.

**XP Floor (Minimum Progress):**
Every completed session grants minimum XP to ensure progression:
```
minimumXP = 100 * currentRank (minimum 100)
xpGained = max(minimumXP, finalScore)
```

This ensures even bad sessions contribute to progression, preventing frustration loops.

---

## Rank Band System

Progression is organized into **bands** of 10 ranks each. Each band follows a consistent pattern:

- **First 5 ranks (X0-X4):** Introduce and ramp up a new mechanic
- **Last 5 ranks (X5-X9):** Consolidation period for mastery

Players can spend upgrade points at any rank. The consolidation period lets players feel the effects of upgrades + skill mitigating the new difficulty.

### Band Overview

| Band | Ranks | New Mechanic | New Color | Status |
|------|-------|--------------|-----------|--------|
| Onboarding | 0-9 | Complications | - | **Complete** |
| Junk | 10-19 | Starting Junk | Orange @10 | Planned (Phase 16) |
| Mixer | 20-29 | Multi-color Pieces | Purple @20 | Planned (Phase 17) |
| Cracked | 30-39 | Expanding Cracks | White @30 | Planned (Phase 18) |
| Band 4+ | 40-99 | TBD | TBD | Future |

**Colors:** 7 total planned (Red, Blue, Green, Yellow, Orange, Purple, White). New color unlocks at ranks 10, 20, 30.

---

### Onboarding Band (Ranks 0-9) — **COMPLETE**

**Focus:** Learn core loop, complications introduced gradually, 8 upgrades unlock

| Rank | What Unlocks |
|------|--------------|
| 0 | Base game, 4 colors (Red, Blue, Green, Yellow), no complications |
| 1 | LASER complication |
| 2 | LIGHTS complication + **Circuit Stabilizer** upgrade |
| 3 | CONTROLS complication + **Auto-Popper** upgrade |
| 4 | **Capacitor Efficiency** upgrade |
| 5 | **Cooldown Booster** active ability |
| 6 | **Gear Lubrication** upgrade |
| 7 | **Focus Mode** upgrade |
| 8 | **Dense Goop** upgrade |
| 9 | **Pressure Control** upgrade |

**Upgrades (8 total):**

| Upgrade | Type | Effect per Level | Max Level |
|---------|------|------------------|-----------|
| Circuit Stabilizer | passive | -7.5% trigger chance | 4 (+ 3-button sequence) |
| Auto-Popper | passive | -4% end-game decay | 4 |
| Capacitor Efficiency | passive | -6.25% drain rate | 4 (+ no center targets) |
| Cooldown Booster | active | +25% cooldown extension | 1 |
| Gear Lubrication | passive | +12.5% heat dissipation | 4 (+ 3 alignments) |
| Focus Mode | passive | -10% time speed at console | 4 |
| Dense Goop | passive | +12.5% fall speed | 4 |
| Pressure Control | passive | +5 seconds game time | 8 |

---

### Junk Band (Ranks 10-19) — Phase 16

**Focus:** Sessions start with "junk goop" already in the tank. Junk Goop complication triggers based on junk interactions.

| Rank | What Unlocks |
|------|--------------|
| 10 | +Orange color (5 total), **Junk Uniformer** upgrade |
| 12 | **Goop Swap** upgrade |
| 15 | **Goop Dump** active ability |
| 18 | **Sealing Bonus** upgrade |

**Upgrades (4 total):**

| Upgrade | Type | Effect per Level | Max Level |
|---------|------|------------------|-----------|
| Junk Uniformer | passive | +10% same-color junk | 4 |
| Goop Swap | passive | -0.25s swap time (1.5s → 0.5s) | 4 |
| Goop Dump | active | Drops matching junk across board | 1 |
| Sealing Bonus | passive | +5% cooldown reduction per seal (10% base) | 4 |

---

### Mixer Band (Ranks 20-29) — Phase 17

**Focus:** Goop Mix complication — falling pieces can have two colors (cells [0,1] = colorA, cells [2,3] = colorB)

| Rank | What Unlocks |
|------|--------------|
| 20 | +Purple color (6 total), **Active Expansion Slot** (2nd active slot) |
| 22 | **Goop Hold Viewer** feature |
| 25 | **Goop Colorizer** active ability |
| 28 | **Goop Window** feature (next piece preview) |

**Upgrades (4 total):**

| Upgrade | Type | Effect | Max Level |
|---------|------|--------|-----------|
| Active Expansion Slot | feature | Equip 2 actives simultaneously | 1 |
| Goop Hold Viewer | feature | Shows held goop piece | 1 |
| Goop Colorizer | active | Next 5 goop match current color | 1 |
| Goop Window | feature | Preview next goop piece | 1 |

---

### Cracked Band (Ranks 30-39) — Phase 18

**Focus:** Expanding Cracks complication — cracks grow over time if not sealed quickly

**Mechanic:** Cracks grow every 5s from inception. Growth chance = current pressure percentage. Upgrade offsets that chance.

| Rank | What Unlocks |
|------|--------------|
| 30 | +White color (7 total), **Slow Cracks** upgrade |
| 32 | **Crack Matcher** upgrade |
| 35 | **Crack Down** active ability |
| 38 | **Active Expansion Slot 2** (3rd active slot) |

**Upgrades (4 total):**

| Upgrade | Type | Effect per Level | Max Level |
|---------|------|------------------|-----------|
| Slow Cracks | passive | -5% growth chance offset | 4 |
| Crack Matcher | passive | +25% color bias toward lowest crack | 4 |
| Crack Down | active | New cracks spawn on bottom row | 1 |
| Active Expansion Slot 2 | feature | Equip 3 actives simultaneously | 1 |

---

### Future Bands (Ranks 40-99)

**Status:** Future design. Mechanics TBD.

**Design Principles:**
- Each band introduces ONE new complication/mechanic
- Upgrades unlock throughout the band (not all at X0)
- Colors capped at 7 (may add more if needed)

---

### Scoring & Economy Notes

**End-Game Penalty:**
- Remaining goop: -50 points per unit
- AUTO_POPPER upgrade: Probabilistically auto-pops remaining goop before penalty
  - Base decay: 20% (keeps penalty). Per level: -4% decay.
  - Level 4: Only 4% decay (most goop auto-pops)

**Upgrade Economy:**
- 1 point per rank gained
- 17 upgrades total across ranks 0-39
- Passives have 4-8 levels, actives have 1 level
- Features have 1 level (unlock only)

---

## Active Ability System

Active abilities are upgrades that can be equipped and manually activated during gameplay.

### Equipping
- Actives must be purchased AND equipped to use
- Default: 1 active slot (can equip 1 at a time)
- Rank 20: Active Expansion Slot unlocks 2nd slot
- Rank 38: Active Expansion Slot 2 unlocks 3rd slot

### Charging
- Passive: 1% charge per second (100 seconds to full)
- Crack-goop seal: +25% charge per sealed crack
- Visual: Grey circle fills with color, glows when ready

### Activation
- Tap the ability circle when fully charged (100%)
- Effect triggers immediately
- Charge resets to 0%

### Current Actives

| Active | Rank | Effect |
|--------|------|--------|
| Cooldown Booster | 5 | +25% extension to all complication cooldowns |
| Goop Dump | 15 | Drops matching junk across the board |
| Goop Colorizer | 25 | Next 5 goop match current falling goop color |
| Crack Down | 35 | New cracks spawn on bottom row for a duration |

---

## Technical Architecture

### Current State

```
├── App.tsx              # View routing, save data management
├── Game.tsx             # Core game logic
├── types.ts             # Type definitions
├── constants.ts         # Game constants
├── components/
│   ├── GameBoard.tsx    # Rendering + input
│   ├── Controls.tsx     # HUD + game over
│   └── ...              # Menu screens
└── utils/
    ├── gameLogic.ts     # Pure functions
    ├── audio.ts         # Web Audio wrapper
    ├── progression.ts   # Rank calculation
    └── storage.ts       # LocalStorage
```

### Target Architecture

```
├── core/                    # Framework-agnostic game engine
│   ├── state/
│   │   ├── TankState.ts
│   │   ├── PieceState.ts
│   │   ├── PressureState.ts
│   │   ├── ComplicationState.ts
│   │   └── SessionState.ts
│   ├── systems/
│   │   ├── GridSystem.ts
│   │   ├── PhysicsSystem.ts
│   │   ├── PressureSystem.ts
│   │   ├── CrackSystem.ts
│   │   ├── ComplicationSystem.ts
│   │   └── ScoringSystem.ts
│   ├── commands/
│   │   ├── DropPiece.ts
│   │   ├── PopGoop.ts
│   │   ├── RotateTank.ts
│   │   └── RotatePiece.ts
│   ├── events/
│   │   ├── EventBus.ts
│   │   └── GameEvents.ts
│   └── GameEngine.ts
├── react/
│   ├── hooks/
│   │   └── useGameEngine.ts
│   └── contexts/
│       └── GameContext.tsx
├── components/
│   ├── PeriscopeMode/
│   │   ├── TankView.tsx
│   │   └── PeriscopeHUD.tsx
│   ├── ConsoleMode/
│   │   ├── ConsoleView.tsx
│   │   ├── Periscope.tsx
│   │   ├── StatusPanel.tsx
│   │   └── MiniGames/
│   │       ├── ResetLaser.tsx
│   │       ├── ResetLights.tsx
│   │       └── ResetControls.tsx
│   └── shared/
│       ├── CRTScreen.tsx
│       └── EndDayScreen.tsx
└── utils/
```

---

## Implementation Status

### Shipped Milestones

**v1.0 MVP** (Jan 2026) — Phases 1-7
- Core gameplay loop with complications
- Three minigame puzzles (Reset Laser, Reset Lights, Reset Controls)
- HUD meters, progression system, system upgrades
- 65 tests, pre-commit hooks

**v1.1 Architecture Refactor** (Jan 2026) — Phases 8-13
- Memory leak fixes, file decomposition
- Art.tsx: 1,478 → 581 lines
- GameBoard.tsx: 1,031 → 604 lines
- GameEngine.tick(): 159 → 22 lines
- Event-based input, 110 tests

### Current Milestone: v1.2 Progression System

**Phase 14: Data Architecture** — Complete
- Upgrade system overhaul (17 upgrades with level effects)
- Complication & color config (unlock ranks, color schedule)

**Phase 15: Onboarding Band** — Complete
- 8 upgrades implemented (ranks 2-9)
- Active ability system (equip, charge, activate)
- AUTO_POPPER end-game mechanic

**Phase 16: Junk Band** — Planned
- Junk Goop complication, starting junk mechanic
- Orange color unlock at rank 10
- 4 upgrades (Junk Uniformer, Goop Swap, Goop Dump, Sealing Bonus)

**Phase 17: Mixer Band** — Planned
- Goop Mix complication (multi-color pieces)
- Purple color unlock at rank 20
- 4 upgrades including 2nd active slot

**Phase 18: Cracked Band** — Planned
- Expanding Cracks complication
- White color unlock at rank 30
- 4 upgrades including 3rd active slot

### Future
- Soft-body shader rendering for goop
- Additional bands (40+)
- C# / Unity port

---

## Open Questions

1. **Junk Goop mechanics** - How does starting junk spawn? How does the Junk complication trigger?
2. **Multi-color piece frequency** - How often do mixed-color pieces appear in Mixer Band?
3. **Crack growth formula** - Exact timing and probability for expanding cracks

---

## Appendix: Current Constants

```typescript
// Grid
VISIBLE_WIDTH = 12
TOTAL_WIDTH = 30
VISIBLE_HEIGHT = 16
TOTAL_HEIGHT = 19
BUFFER_HEIGHT = 3

// Timing
INITIAL_TIME_MS = 60000
PER_BLOCK_DURATION = 375
LOCK_DELAY_MS = 500
GOAL_SPAWN_INTERVAL = 5000

// Scoring
COMBO_BONUS = 50

// Pressure Recovery
PRESSURE_RECOVERY_BASE_MS = 0
PRESSURE_RECOVERY_PER_UNIT_MS = 100
PRESSURE_TIER_THRESHOLD = 15
PRESSURE_TIER_STEP = 10
PRESSURE_TIER_BONUS_MS = 250

// Speeds
INITIAL_SPEED = 800 (ms per row)
MIN_SPEED = 100
SOFT_DROP_FACTOR = 20
```

---

*Document Version: 4.0*
*Last Updated: January 2026*
*Changes: Updated band system (Onboarding/Junk/Mixer/Cracked), added 17 upgrades, active ability system, implementation status*
