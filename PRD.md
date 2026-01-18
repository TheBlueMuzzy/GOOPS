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

While in Periscope Mode, equipment malfunctions occur based on player actions.

**Triggers:**

| Complication | Trigger | Upgradeable? |
|--------------|---------|--------------|
| Reset Lights | X total goop units added to tank (cumulative, even popped ones) | Yes - higher threshold |
| Reset Laser | X total goop units popped (cumulative) | Yes - higher threshold |
| Reset Controls | X tank rotation steps (cumulative) | Yes - higher threshold |

**Key Design:** The game does NOT pause when you exit to console. The tank keeps filling, pressure keeps rising. Fix complications fast!

**Complication Effects (while unfixed):**
- Reset Lights: TBD visual impairment
- Reset Laser: Laser disabled (can't pop goop)
- Reset Controls: Tank rotation disabled

**Ignoring Complications:**
- Player can choose to not fix immediately
- Effect persists until fixed
- Some complications (laser, controls) severely hamper gameplay

**Stacking:**
Multiple complications can be active simultaneously.

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
- If neither light is lit → slide to center position

**On Complication Trigger:**
- Sliders are set to random incorrect positions
- Lights are set randomly (but never matching current slider positions)

**Completion:** All 4 sliders in correct positions → complication cleared

**Target Moves:** ~4 (one per slider)

#### Reset Lights (3-Button Lights Out)

**Setup:**
- 3 buttons in a row
- 3 lights in a row (above or near buttons)
- Goal: Turn all 3 lights ON simultaneously

**Toggle Pattern:**

| Button | Toggles Lights |
|--------|----------------|
| B1 | Lights 1 and 2 |
| B2 | Lights 2 and 3 |
| B3 | Lights 1 and 3 |

**Starting States (hard only, for ~4 move target):**
Only spawn these states: 000, 011, 101, 110
- These require 2-3 optimal moves
- With 1 mistake: ~4 moves total

**Solution Reference:**

| Start (L1 L2 L3) | Optimal Path | Moves |
|------------------|--------------|-------|
| 000 (all off) | B1 → B2 → B3 | 3 |
| 011 | B3 → B2 | 2 |
| 101 | B2 → B1 | 2 |
| 110 | B2 → B3 | 2 |

**On Complication Trigger:**
- Slider is pushed down (covers buttons until pulled up?)
- Lights set to one of the hard starting states
- Button positions randomized

**Completion:** All 3 lights ON → complication cleared

**Target Moves:** ~4 (2-3 optimal + 1 mistake)

#### Reset Controls (Dial Alignment)

**Setup:**
- Circular dial with an arrow/pointer
- Multiple light positions around the dial perimeter
- Goal: Align arrow to each lit position in sequence

**Mechanic:**
1. A light illuminates at one position on the dial
2. Player spins dial until arrow points at the light
3. Light turns off, new light illuminates at different position
4. Repeat 4 times total
5. After 4th alignment, all lights flash → complete

**On Complication Trigger:**
- Dial arrow at random starting position
- First target light illuminates

**Completion:** 4 successful alignments → complication cleared

**Target Moves:** 4 dial spins

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

Score from each run is added directly to the player's XP. XP fills the rank meter toward the next Operator Rank.

---

## Rank-Based Difficulty Scaling

As the player's Operator Rank increases, the game automatically introduces new challenges.

### Color Palette

| Rank | Colors Available | New Color |
|------|------------------|-----------|
| 1 | Red, Blue, Green, Yellow | (Base) |
| 2 | + Teal | +Teal (5 total) |
| 5 | + White | +White (6 total) |
| 8 | + Orange | +Orange (7 total) |

Reserved for Rank 11+: Purple, Pink, Grey

### Starting Junk

| Rank | Junk Coverage | Approx. Globs |
|------|---------------|---------------|
| 3 | 15% of bottom row | ~5 globs |
| 6 | 25% of bottom row | ~8 globs |
| 9 | 35% of bottom row | ~11 globs |

### Two-Color Drops

| Rank | Two-Color Chance |
|------|------------------|
| 4 | 25% |
| 7 | 35% |
| 10 | 45% |

Color split: Cells [0,1] = colorA, cells [2,3] = colorB

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

## Implementation Phases

### Phase 0: Bug Fixes & Stabilization
- [x] Fix piece/board coupling
- [ ] Stabilize existing gameplay

### Phase 1: Architecture Refactor
- [ ] Extract pure game state from Game.tsx
- [ ] Implement event bus
- [ ] Create command pattern for inputs
- [ ] Move all game logic to core/

### Phase 2: Console Mode Shell
- [ ] Create ConsoleView component
- [ ] Implement periscope pull-down interaction
- [ ] Add game phase state machine
- [ ] Tank simulation continues during console mode
- [ ] Transition animations

### Phase 3: Complications System
- [ ] Define complication types and triggers
- [ ] Implement Reset Laser mini-game
- [ ] Implement Reset Lights mini-game (Lights Out)
- [ ] Implement Reset Controls mini-game
- [ ] Wire up complication → console → mini-game flow

### Phase 4: End Day Screen
- [ ] CRT monitor drop-down animation
- [ ] Stats display
- [ ] Swipe up to dismiss
- [ ] "Pull Down to Start" idle state

### Phase 5: Polish & Balance
- [ ] Console visual design refinement
- [ ] Light blinking patterns
- [ ] Sound design for console mode
- [ ] Complication threshold balancing
- [ ] Mobile touch controls

### Phase 6: Future (Post-MVP)
- [ ] Soft-body shader rendering for goop
- [ ] Additional complications
- [ ] Power-up system expansion
- [ ] C# / Unity port

---

## Open Questions

1. **Complication effects** - What visual/gameplay impairments for unfixed complications?
2. **Bonus crack scoring** - How many points per bonus crack?
3. **Complication thresholds** - Starting values for triggers?
4. **Mobile controls** - Swipe up for swap vs exit periscope conflict?
5. **Difficulty curve** - How aggressively do complication thresholds scale with rank?

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

*Document Version: 2.0*
*Last Updated: January 2026*
