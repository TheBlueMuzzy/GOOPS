# Goops - Product Requirements Document

## Overview

**Goops** is a puzzle-action game where you operate as a tank maintenance technician, clearing colorful goop from a cylindrical pressure tank while managing equipment malfunctions. The game combines spatial puzzle-solving with time pressure and multi-tasking.

**Platform:** Mobile-first web game (React/TypeScript/Vite)
**Session Length:** 75 seconds per shift (base, upgradeable to 115s max)

### Core Fantasy

You're a low-level operator at an industrial facility. Your job: peer through a periscope into a cylindrical tank, drop goop to seal pressure cracks, laser away excess goop, and keep the equipment running. It's mundane. It's stressful. The tank keeps filling. The equipment keeps breaking. You keep playing.

### Win/Lose Conditions

**Win:** Seal the required number of cracks before pressure reaches 100%
- Required cracks = number of colors in palette + current rank
- Example: Rank 5 with 4 colors = 9 cracks to seal
- After winning, gameplay continues until pressure hits 100% (bonus opportunity)

**Lose:** Pressure reaches 100% with fewer than required cracks sealed

---

## Game Modes

### Console Screen

The main menu and meta-game layer. A retro industrial control console (think Homer Simpson at the nuclear plant).

**Elements:**
- Operator Rank display with XP bar
- Three complication repair panels (Laser, Lights, Controls)
- Status lights and gauges
- Periscope handle (pull down to enter gameplay)
- End Shift screen (CRT monitor that drops down on game over)

**Console Light States:**
- **Idle:** All orange lights blink slowly at varied speeds
- **During gameplay:** All lights blink faster
- **Active complication:** Affected section goes solid (not blinking)

**Mid-Run Display:**
- Alternates between "Cleaning in Progress..." and "Current Pressure: XX%"

### Tank Screen (Periscope Mode)

The core gameplay. You look into a cylindrical tank through a viewport showing ~40% of the tank surface.

**Core Loop:**
1. Pressure builds continuously (75-second timer)
2. Cracks appear at the pressure line
3. Goop pieces fall from center of screen
4. Rotate the tank to position where goop should land
5. Match colored goop to cracks
6. Pop goop to seal cracks and reduce pressure
7. Handle equipment malfunctions when they occur

### End Shift Screen

Displays when the shift ends (pressure reaches 100%).

**Header:** "SHIFT OVER" or "SYSTEM FAILURE"

**Stats Shown:**
- Shift Score (XP earned)
- Operator Rank with XP bar
- Grade (A/B/C/FAILURE)
- Cracks Filled (X/Y)
- Pressure Vented (time recovered)
- Max Mass Purged (largest pop)
- Leftover Goop (penalty count)
- Scraps available for upgrades

---

## The Tank

### Grid Dimensions

| Property | Value | Notes |
|----------|-------|-------|
| Total Width | 30 columns | Full cylinder circumference |
| Visible Width | 12 columns | ~40% visible through periscope |
| Total Height | 24 rows | Including 3-row buffer |
| Visible Height | 21 rows | Rows 3-23 (0-indexed), 9:16 aspect ratio |
| Buffer Height | 3 rows | Spawn area above visible (rows 0-2) |

The tank is cylindrical — coordinates wrap horizontally. Rotating the tank changes which section is visible. Goop groups can wrap around the cylinder.

> **Tech Note:** Buffer rows 0-2 are not visible to the player. Pieces spawn at row 0 and fall into the visible area starting at row 3. `BUFFER_HEIGHT = TANK_HEIGHT - TANK_VIEWPORT_HEIGHT`.

### Pressure System

Pressure represents time remaining. It builds continuously and determines:
- Which goop can be popped (must be below pressure line)
- Where cracks spawn (at pressure line)
- Game over condition (100% pressure)

**Visual:** Water level rising from bottom. At 0% pressure, only the bottom row is submerged. At 100%, the entire tank is "underwater."

**Formulas:**
```
tankPressure = max(0, 1 - (shiftTime / maxTime))
waterHeightBlocks = 1 + (tankPressure * (TANK_VIEWPORT_HEIGHT - 1))   // 1 + (pressure * 20)
pressureLineY = floor(TANK_HEIGHT - waterHeightBlocks)
```

> **Tech Note:** `pressureLineY` ranges from row 23 (bottom, at game start) to row 3 (top, constrained by BUFFER_HEIGHT at game end).

**Pressure Recovery (from popping goop):**
```
unitRecovery = groupSize * 100ms
tierBonus = tier * 250ms (tier = floor((groupSize - 15) / 10), min 0)
infusedBonus = infusedUnitCount * 3000ms
totalRecovery = unitRecovery + tierBonus + infusedBonus
```

Infused goop = goop covering a matching-color crack.

---

## Goop System

### Piece Shapes

Pieces come in three size categories, spawning based on elapsed time:

| Zone | Time Range | Shapes | Cells per Piece |
|------|------------|--------|-----------------|
| Tetra | 0 to maxTime/3 | 5 normal + 5 corrupted | 4 |
| Penta | maxTime/3 to 2×maxTime/3 | 11 normal + 11 corrupted | 5 |
| Hexa | 2×maxTime/3 to maxTime | 11 normal + 11 corrupted | 6 |

**Total:** 54 unique shapes (27 normal + 27 corrupted)

> **Tech Note:** Zone boundaries adjust with PRESSURE_CONTROL upgrade. At base 75s: zones are 0-25s, 25-50s, 50-75s. With max upgrade (115s): zones are 0-38.3s, 38.3-76.7s, 76.7-115s.

Bigger pieces spawn later because cracks appear higher as pressure rises — taller pieces help reach them.

### Piece Spawning

Goop always falls from the center of the visible screen. The player controls WHERE it lands by rotating the tank underneath it.

**Spawning Mechanics:**
- **Corruption:** 15% chance to spawn corrupted variant (non-contiguous cells)
- **Mirroring:** 50% chance to flip asymmetric pieces horizontally
- **Multi-color:** 25% chance at rank 20+ (cells split between 2 colors)
- **Wild:** 15% chance at rank 40+ (seals any crack color)

**Spawn Priority Order:**
1. Check corruption (15%)
2. If corrupted: cannot be wild or multi-color
3. If normal: check wild (15% at rank 40+)
4. If not wild: check multi-color split (25% at rank 20+)
5. Apply mirroring (50% for asymmetric shapes)

**Wild Piece Rules:**
- Only spawn from normal pools (never corrupted)
- Cannot be multi-color
- Seal any crack color on contact
- Convert adjacent goop groups to wild on lock
- When non-wild lands next to wild, entire wild group converts to that color

### Corrupted Pieces

Corrupted pieces have corner-touching cells instead of edge-touching. After locking:
- `updateGroups()` recomputes connectivity — corner-touching cells become separate groups
- Unsupported groups fall as individual loose goop
- Cannot become multi-color (mixed)
- Cannot become wild

> **Tech Note:** The `isCorrupted` flag is set at spawn time in `GoopTemplate`. After merge, `updateGroups()` uses 4-way (orthogonal) connectivity, so corner-connected cells naturally separate.

### Goop Physics

**Groups:** Connected same-color cells form a "goop group" (4-way orthogonal connectivity only)

**Support:** A group is supported if ANY cell touches:
- The floor (bottom row, y = TANK_HEIGHT - 1 = row 18)
- Another supported group (directly below, same column)

**Falling:** Unsupported groups become "loose goop" and fall at 0.03 grid units/ms

**Merging:** When same-color groups touch, they merge into one group with a new timestamp

### Goop Filling

After placement or merge, goop "fills" before it can be popped.

**Formula:** `fillDuration = groupSize * 375ms`

| Group Size | Fill Duration |
|------------|---------------|
| 1 cell | 375ms |
| 4 cells | 1.5s |
| 10 cells | 3.75s |
| 25 cells | 9.375s |

Fill animation progresses row-by-row from bottom to top of the group.

### Goo Filter (SVG Visual Effect)

Soft-body blobs use an SVG goo filter to create the blobby merge effect. The filter pipeline:

1. **Gaussian Blur** (`stdDeviation`) — Blurs all blob shapes. Nearby blobs blur into each other.
2. **Alpha Threshold** — A color matrix sharpens the blurred alpha back to solid edges. Formula: `output = (blurred_alpha × AlphaMul) + AlphaOff`
3. **Composite** — Original sharp color composited back onto the thresholded shape.

**Two independent filter sets exist:**
- **Locked blobs filter** (`goo-filter`) — For settled goop, rendered per-color to prevent cross-color bleeding
- **Falling blobs filter** (`goo-filter-falling`) — For the active falling piece, rendered separately

**Current Defaults:**

| Parameter | Locked | Falling | Range | Effect |
|-----------|--------|---------|-------|--------|
| Blur (stdDeviation) | **5** | **5** | 1–25 | Merge radius. Higher = fluffier, more merging |
| Alpha Multiplier | **40** | **40** | 1–50 | Edge steepness. Higher = harder/crisper cutoff |
| Alpha Offset | **-11** | **-11** | -30–0 | Edge position. More negative = blobs shrink inward |

**Reference Presets:**

| Preset | Blur | Mul | Off | Notes |
|--------|------|-----|-----|-------|
| Subtle | 3 | 20 | -6 | Minimal merge, soft edges |
| Current | 5 | 40 | -11 | **Active default** — tight merge, crisp edges |
| Fluffy | 8 | 24 | -13 | Wider merge radius, softer edges |
| Aggressive | 12 | 25 | -9 | Maximum fluffiness, heavy merge |

**Key notes:**
- Alpha Mul and Alpha Off both affect the edge but from different angles: Mul adjusts contrast (steepness), Off adjusts position (where the cutoff sits)
- No stroke on blob SVG paths — the filter handles edge definition on its own
- Locked and falling filters are independently tunable via debug panel
- Debug sliders available via backtick (`` ` ``) panel under "Goo Filter" section

### Soft-Body Physics (Rendering System)

Goop blobs are rendered using a Verlet-integration soft-body physics engine. Each grid cell is represented by a physics blob with 12 vertices arranged in a hexagonal ring, connected by springs. This creates organic, blobby motion instead of rigid grid squares.

**Physics Pipeline:**
1. Verlet integration moves vertices based on velocity + gravity
2. Constraint solving (3 iterations): ring springs, cross springs, pressure
3. Home anchoring pulls vertices toward rest shape
4. Attraction springs connect nearby same-color blobs (merge tendrils)
5. Catmull-Rom curves smooth vertices into SVG paths
6. SVG goo filter merges nearby blob shapes into membrane effect

**Core Physics Parameters:**

| Parameter | Default | Purpose |
|-----------|---------|---------|
| damping | 0.98 | Velocity decay per frame |
| stiffness | 10 | Spring constraint strength |
| pressure | 20 | Volume maintenance (gas-law, Shoelace area) |
| iterations | 3 | Constraint solver passes per frame |
| innerHomeStiffness | 0.64 | Core vertex anchoring (prevents collapse) |

**Locked vs Falling Blobs** have independent parameter sets:

| Parameter | Locked | Falling | Effect |
|-----------|--------|---------|--------|
| homeStiffness | 0.35 | 0.35 | Shape retention to rest position |
| returnSpeed | 0.8 | 0.8 | Snap-back speed to home |
| viscosity | 0.7 | 0.7 | Movement dampening |
| gravity | 10 | 10 | Downward acceleration |

**Attraction Springs (Merge Tendrils):**

| Parameter | Default | Effect |
|-----------|---------|--------|
| attractionRadius | 30px | Max distance for blob-to-blob attraction |
| attractionRestLength | 1px | Target gap between attracted vertices |
| attractionStiffness | 0.037 | Spring force strength |

When same-color blobs are within `attractionRadius`, spring forces pull their nearest vertices together, creating visible tendrils that stretch between merging groups.

**Tendril Rendering:**

| Parameter | Default | Effect |
|-----------|---------|--------|
| goopiness | 36 | SVG filter stretch threshold |
| tendrilEndRadius | 1px | Bead size at tendril endpoints |
| tendrilSkinniness | 0.2 | Mid-point taper (0=needle, 1=bulbous) |

> **Tech Note:** Tendrils MUST render inside the goo filter group. Otherwise beads appear as individual dots instead of smooth strands (Proto 9 lesson).

**Droplet Particles (Pop Effect):**

| Parameter | Default | Effect |
|-----------|---------|--------|
| dropletCount | 30 | Particles per pop event |
| dropletSpeed | 60 px/s | Initial scatter velocity |
| dropletLifetime | 3s | Fade-out duration |
| dropletSize | 9px | Droplet radius |
| dropletGravity | 180 | Separate from blob gravity |

Droplets spray outward when goop is popped. They render as simple circles with NO goo filter applied.

**Loose Goop Ease-In:** When locked goop loses support (blocks below popped), gravity ramps from 0 to full over 0.6 seconds using a cubic ease-in curve (t³). This prevents jarring instant-fall.

**Rendering Architecture:**
- Locked blobs: Rendered per-color inside shared goo filter (prevents cross-color bleeding)
- Falling blobs: Rendered separately with independent filter params
- Tendrils: Rendered inside goo filter for smooth membrane merging
- Inner cutouts (fill animation): Rendered OUTSIDE goo filter to prevent dark fringe bleed
- Droplets: Simple circles, no goo filter

> **Tech Note:** All 43 physics parameters are exposed via the backtick (`` ` ``) debug panel for real-time tuning. The "Save Snapshot" button logs current params as JSON to browser console.

### Mobile Rendering

Mobile devices use conditional rendering to maintain 40fps performance.

| Feature | Desktop | Mobile |
|---------|---------|--------|
| Frame Rate | 60fps (16ms) | 40fps (25ms) |
| Soft-Body Rendering | Full physics | Enabled (simplified) |
| CRT Scanline Effect | Yes | No |
| Grid Lines | Yes | No |
| Viewport Mask | Yes | No |
| Fill Animation | Per-cell bottom-up | Group-level horizontal sweep |

> **Tech Note:** Mobile detection via `isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)`. Do NOT remove `isMobile` checks without understanding why they exist — they prevent severe performance degradation.

### Popping (Laser)

Tapping filled goop destroys it.

**Requirements:**
1. Goop must be fully filled (animation complete)
2. Top of group (`groupMinY`) must be below pressure line
3. Tap anywhere on the goop

**Results:**
- All connected same-color cells destroyed
- Unsupported goop above falls
- Score awarded
- Pressure reduced (time recovered)
- Matching cracks sealed
- Active abilities gain +25% charge per sealed crack-goop unit

---

## Crack System

### Spawning

- **Max active:** 8 crack groups (connected components) at a time
- Spawn at the current pressure line Y position
- Spawn interval: 5000ms between spawn attempts
- Random X position (must be empty cell)
- One crack per color can be "active" (spawning stops when goal target met)

### Sealing

1. Cover crack with matching-color goop (or wild goop)
2. Covered goop becomes "infused" (`isSealingGoop: true`)
3. Pop the covering goop
4. Crack disappears, counts as sealed
5. Active abilities gain +25% charge per sealed unit

**Note:** Wrong-color goop covering a crack does nothing — crack remains visible through the goop. If covering goop is removed by collapse (not direct pop), crack remains.

### Expanding Cracks (Rank 30+)

At rank 30+, unsealed cracks grow over time.

**Growth Check:** 5-10 seconds per crack cell (random: `5000 + random * 5000` ms)

**Spread Chance:**
```
baseChance = 10% + tankPressure (ranges 10% to ~100%)
slowCracksOffset = SLOW_CRACKS level * 5%
effectiveChance = baseChance - slowCracksOffset

// Penalties:
leafPenalty = 50% reduction if crack has no children (×0.5)
distancePenalty = 25% per hop from root crack (min 10% multiplier)

finalChance = effectiveChance * leafMultiplier * distanceMultiplier
```

**Spread Direction:** 8-directional (4 orthogonal + 4 diagonal)

**Merging:** Adjacent same-color cracks merge into one crack structure (parent-child references updated)

### Win Burst

When BOTH conditions are met:
- Required cracks sealed (`goalsCleared >= goalsTarget`)
- Tank not overfilled (`tankPressure < 90%`)

All remaining colors spawn cracks simultaneously above the pressure line — a bonus opportunity to seal more before the shift ends.

> **Tech Note:** If `tankPressure >= 90%` when win condition is met, all goals are cleared instead (`goalMarks = []`), effectively ending the run.

---

## Complication System

Equipment malfunctions occur based on player actions. Players start at Rank 0 with no complications, providing a safe learning period.

**Key Design:** The game does NOT pause when you exit to console. The tank keeps filling. Fix complications fast!

### Complication Overview

| Complication | Trigger | Unlock | Effect When Active |
|--------------|---------|--------|-------------------|
| Laser | Capacitor empties (0%) | Rank 4 | Two-tap to pop (prime, then pop) |
| Lights | Brightness falls below 10% | Rank 2 | Dims to 5% + grayscale |
| Controls | Heat reaches 100% | Rank 6 | 2 inputs per move, 50% held speed |

### Laser Complication

**Capacitor Meter (left side of screen):**
- Starts at 100%
- Drains 4% per goop unit popped (reduced by CAPACITOR_EFFICIENCY)
- Refills +10% on piece lock (only when no active malfunction)
- Color: Blue → Yellow → Red as it empties

**Drain with upgrade:**
```
drainMultiplier = 1 - (CAPACITOR_EFFICIENCY level * 0.0625)
drainAmount = groupSize * 4 * drainMultiplier
```

**When active:** First tap primes the group (restarts fill animation), second tap pops it.

**Repair Mini-Game (4 Sliders):**
- 4 horizontal sliders with 3 positions each (Left, Center, Right)
- Each slider has 2 indicator lights (left and right)
- Match slider position to lit indicators:
  - Left light only → slide left
  - Right light only → slide right
  - Both lights → slide center
- At max CAPACITOR_EFFICIENCY: only 2 positions (no center)

### Lights Complication

**Brightness System:**
- Starts at 100%
- Grace period: 5 seconds base (+0.75s per CIRCUIT_STABILIZER level) before dimming begins
- Dims over 5 seconds from 100% to 10% when not fast dropping
- Recovers at 400%/sec while fast dropping (0.25s to full)
- Flickers at end of grace period as warning (dips to 70% for 80ms)

**When active:** Screen dims to 5% brightness with grayscale filter.

**Repair Mini-Game (Sequence Memory):**
1. Move slider to indicated position (up or down)
2. Watch 3-4 button sequence flash (200ms on, 100ms gap)
3. Repeat the sequence by pressing buttons
4. Move slider to opposite position
- At max CIRCUIT_STABILIZER: 3 buttons instead of 4

### Controls Complication

**Heat Meter (right side of screen):**
- Starts at 0%
- Gains 5% per tank rotation
- Drains 50%/sec when idle (after 200ms threshold)
- Drain boosted by GEAR_LUBRICATION: `50 * (1 + 0.125 * level)` per second
- Color: Green → Yellow → Red as it fills

**When active:** Requires 2 inputs per action, repeat rate doubled to 200ms.

**Repair Mini-Game (Dial Alignment):**
- Circular dial with arrow pointer
- 4 target positions at corners (45°, 135°, 225°, 315°)
- Align arrow within 15° of lit corner, tap to confirm
- Repeat 4 times (3 times at max GEAR_LUBRICATION)

### Cooldown

After resolving a complication, it cannot trigger again for a cooldown period:

```
cooldownSeconds = max(8, 20 - (currentRank - unlockRank))
```

Example: At rank 10, Laser (unlocks rank 4) has cooldown of max(8, 20 - 6) = 14 seconds.

---

## Progression System

### Ranks & XP

**Max Rank:** 50

**XP Formula:**
```
xpForNextRank = 3500 + (currentRank * 250)
cumulativeXpToRankN = N * (3375 + 125 * N)
```

| Rank | XP to Next | Cumulative |
|------|------------|------------|
| 0 | 3,500 | 0 |
| 10 | 6,000 | 46,250 |
| 20 | 8,500 | 117,500 |
| 30 | 11,000 | 213,750 |
| 40 | 13,500 | 335,000 |
| 50 | — | 481,250 |

**Minimum Progress:** Every session grants at least `100 * currentRank` XP (minimum 100).

### Scraps (Currency)

- Earn 1 scrap per rank achieved
- Spend 1 scrap per upgrade level
- Displayed as "SCRAPS: XX" on upgrade screen

### Color Schedule

| Rank | Colors Available |
|------|-----------------|
| 0-9 | Red, Blue, Green, Yellow (4) |
| 10-29 | + Purple (5) |
| 30-39 | + White (6) |
| 40-49 | + Wild (15% spawn chance, seals any color) |
| 50 | + Black (7) |

### Starting Junk (Rank 3+)

Sessions start with junk goop already in the tank:

| Rank | Junk Blocks | Coverage |
|------|-------------|----------|
| 0-2 | 0 | — |
| 3-5 | ~5 blocks | ~15% of bottom row |
| 6-8 | ~8 blocks | ~25% of bottom row |
| 9+ | ~11 blocks | ~35% of bottom row |

Each junk block is an independent group (size 1). Colors are random unless modified by JUNK_UNIFORMER upgrade.

---

## Upgrade System

20 upgrades across 4 rank bands. Types:
- **Passive:** Always active once purchased
- **Active:** Must be equipped, charges during play, manually activated
- **Feature:** Unlocks UI element or capability

### Onboarding Band (Ranks 2-9) — 8 Upgrades

| Upgrade | Type | Rank | Effect per Level | Max |
|---------|------|------|------------------|-----|
| Circuit Stabilizer | Passive | 2 | +0.75s lights grace | 4 |
| Auto-Popper | Passive | 3 | -4% end-game decay | 4 |
| Capacitor Efficiency | Passive | 4 | -6.25% laser drain | 4 |
| Cooldown Booster | Active | 5 | +25%/35%/50% cooldown | 3 |
| Gear Lubrication | Passive | 6 | +12.5% heat dissipation | 4 |
| Focus Mode | Passive | 7 | -10% time speed at console | 4 |
| Dense Goop | Passive | 8 | +12.5% fall speed | 4 |
| Pressure Control | Passive | 9 | +5s shift duration | 8 |

### Junk Band (Ranks 10-18) — 4 Upgrades

| Upgrade | Type | Rank | Effect per Level | Max |
|---------|------|------|------------------|-----|
| Junk Uniformer | Passive | 10 | +10% same-color junk | 4 |
| Goop Swap | Passive | 12 | -0.25s swap time | 4 |
| Goop Dump | Active | 15 | Rain 1/2/3 waves of junk | 3 |
| Sealing Bonus | Passive | 18 | +5% cooldown per seal | 4 |

### Mixer Band (Ranks 20-28) — 4 Upgrades

| Upgrade | Type | Rank | Effect |
|---------|------|------|--------|
| Active Expansion Slot | Feature | 20 | Equip 2 actives |
| Goop Hold Viewer | Feature | 22 | Shows held goop |
| Goop Colorizer | Active | 25 | Next 6/7/8 pieces match color |
| Goop Window | Feature | 28 | Preview next piece |

### Cracked Band (Ranks 30-38) — 4 Upgrades

| Upgrade | Type | Rank | Effect per Level | Max |
|---------|------|------|------------------|-----|
| Slow Cracks | Passive | 30 | -5% growth chance | 4 |
| Crack Matcher | Passive | 32 | +25% color bias to cracks | 4 |
| Crack Down | Active | 35 | Next 3/5/7 cracks spawn low | 3 |
| Active Expansion Slot 2 | Feature | 38 | Equip 3 actives |

---

## Active Abilities

Active abilities are upgrades that can be equipped and manually activated.

### Equipping

- Must purchase AND equip to use
- Default: 1 slot
- Rank 20: 2 slots (Active Expansion Slot)
- Rank 38: 3 slots (Active Expansion Slot 2)

### Charging

| Active | Charge Time | Passive Rate |
|--------|-------------|--------------|
| Cooldown Booster | 20s | 5%/sec |
| Goop Dump | 15s | 6.67%/sec |
| Goop Colorizer | 25s | 4%/sec |
| Crack Down | 30s | 3.33%/sec |

**Bonus:** +25% charge per sealed crack-goop unit (instant on pop)

**Visual:** Grey circle fills with color, glows when ready (100%)

### Ability Effects

**Cooldown Booster:** Extends all active complication cooldowns
- Level 1: +25%
- Level 2: +35%
- Level 3: +50%

**Goop Dump:** Rains same-color junk from top
- Level 1: 1 wave (18 pieces)
- Level 2: 2 waves (36 pieces)
- Level 3: 3 waves (54 pieces)
- Wave delay: 600ms between waves
- Spawn interval: 80ms between pieces

**Goop Colorizer:** Locks next N pieces to current falling piece's color
- Level 1: 6 pieces
- Level 2: 7 pieces
- Level 3: 8 pieces

**Crack Down:** Next N cracks spawn in bottom 4 rows
- Level 1: 3 cracks
- Level 2: 5 cracks
- Level 3: 7 cracks

---

## Scoring System

### Pop Scoring

```
perUnit = baseScore + heightBonus + offscreenBonus
baseScore = 10
heightBonus = max(0, (TANK_HEIGHT - y) * 10)   // 10-210 for visible rows (y=3 to y=23)
offscreenBonus = 50                              // if distance from viewport center > 6

popStreakMultiplier = 1 + (popStreak * 0.1)

// Per-unit scores are multiplied, then summed
unitTotal = sum of (perUnit * popStreakMultiplier)

// Adjacency is added flat (NOT multiplied)
adjacencyBonus = neighborGroupCount * 5

totalScore = unitTotal + adjacencyBonus
```

### Drop Scoring

```
fastDropScore = distanceDropped * 2
```

### End Game

```
goopPenalty = remainingUnits * 50
winBonus = startingRank * 5000 (if won)
xpFloor = 100 * startingRank (minimum XP)

finalScore = max(xpFloor, score + winBonus - goopPenalty)
```

**Auto-Popper Effect:** Probabilistically auto-pops remaining goop before penalty
- Base decay: 20% (80% auto-pop chance)
- Per level: -4% decay (+4% auto-pop)
- Level 4: 4% decay (96% auto-pop chance)

### Grade System

Five performance categories averaged for letter grade:

| Category | Formula |
|----------|---------|
| Crack Performance | min(100, (cracksFilled / cracksTarget) * 100) |
| Tank Efficiency | max(0, 100 - (residualGoop * 2)) |
| System Control | max(0, 100 - (residualGoop * 3)) |
| Pressure Management | min(100, (totalVented / maxTime) * 100) |
| Score Bonus | min(100, shiftScore / 100) |

**Grade Thresholds:**
| Grade | Average | Color |
|-------|---------|-------|
| A | >= 80 | Green |
| B | >= 60 | Cyan |
| C | >= 40 | Yellow |
| FAILURE | < 40 or didn't win | Red |

---

## Controls

### PC Controls

| Input | Action |
|-------|--------|
| A / Left Arrow | Rotate tank left |
| D / Right Arrow | Rotate tank right |
| Q / Mouse Wheel Up | Rotate piece counter-clockwise |
| E / Mouse Wheel Down | Rotate piece clockwise |
| R (hold 1.5s) | Swap piece with held goop |
| S (hold) | Fast drop |
| W / Space | Exit periscope to console |
| Backspace | Exit to console (anytime) |
| Mouse Click | Pop goop |

> **Tech Note:** Tank rotation has 100ms repeat rate (200ms with Controls complication). Initial delay of 250ms before repeat starts. Max 10 lock resets per piece (prevents infinite spin).

### Touch Controls (Mobile)

| Gesture | Action |
|---------|--------|
| Drag left/right | Rotate tank (20px threshold) |
| Tap left screen half | Rotate piece counter-clockwise |
| Tap right screen half | Rotate piece clockwise |
| Drag down | Fast drop (continuous) |
| Hold on screen (1.5s) | Swap piece with held goop |
| Swipe up (quick) | Exit to console |
| Tap on goop | Pop goop |

> **Tech Note:** Touch handling uses synchronous window event listeners (not React's onPointer) for iOS compatibility. Drag locks to axis after 10px movement. Swap time reduced by GOOP_SWAP upgrade (min 0.5s at level 4).

---

## Screen Transitions

### Console → Tank Screen

1. Drag periscope handle downward
2. Goggles viewport shows miniaturized gameplay
3. As periscope reaches bottom, view zooms in
4. Full periscope gameplay visible

### Tank Screen → Console

1. Swipe up (or press W/Space/Backspace)
2. View zooms out, periscope moves up
3. Console fully visible
4. **Game continues running!**

### End Shift

1. Pressure reaches 100%
2. CRT monitor slides down from top
3. Stats displayed
4. "END THE DAY" button
5. Swipe up to dismiss, pull periscope for new shift

---

## Constants Reference

### Timing

| Constant | Value | Upgradeable |
|----------|-------|-------------|
| Shift Duration | 75,000ms | +5s per PRESSURE_CONTROL level (max +40s) |
| Piece Fall Speed | 780ms/row | +12.5% per DENSE_GOOP level |
| Fast Drop Multiplier | 8x | — |
| Lock Delay | 500ms (50ms when fast dropping) | — |
| Fill Duration | groupSize * 375ms | — |
| Crack Spawn Interval | 5,000ms | — |
| Crack Growth Interval | 5,000-10,000ms per cell | — |
| Swap Hold Duration | 1,500ms | -250ms per GOOP_SWAP level (min 500ms) |

### Grid

| Constant | Value |
|----------|-------|
| Total Width (TANK_WIDTH) | 30 |
| Visible Width (TANK_VIEWPORT_WIDTH) | 12 |
| Total Height (TANK_HEIGHT) | 24 |
| Visible Height (TANK_VIEWPORT_HEIGHT) | 21 |
| Buffer Height | 3 |

### Spawning

| Constant | Value |
|----------|-------|
| Corruption Chance | 15% |
| Mirror Chance | 50% |
| Multi-color Chance (rank 20+) | 25% |
| Wild Chance (rank 40+) | 15% |

### Complications

| Constant | Value | Upgradeable |
|----------|-------|-------------|
| Laser Drain | 4% per unit | -6.25% per CAPACITOR_EFFICIENCY level |
| Laser Refill | 10% per lock | — |
| Lights Grace | 5s base | +0.75s per CIRCUIT_STABILIZER level |
| Lights Dim Duration | 5s | — |
| Lights Recovery | 400%/sec | — |
| Heat Gain | 5% per rotation | — |
| Heat Drain | 50%/sec | +12.5% per GEAR_LUBRICATION level |
| Cooldown Min | 8s | — |
| Cooldown Max | 20s | — |

### Goop Dump (Active)

| Constant | Value |
|----------|-------|
| Pieces per Wave | 18 |
| Spawn Interval | 80ms between pieces |
| Wave Delay | 600ms between waves |
| Fall Speed | 0.03 grid units/ms |

### Soft-Body Physics

| Constant | Value | Notes |
|----------|-------|-------|
| Vertices per Blob | 12 | Hexagonal ring |
| Damping | 0.98 | Per-frame velocity decay |
| Stiffness | 10 | Spring constraint strength |
| Pressure | 20 | Volume maintenance |
| Solver Iterations | 3 | Per frame |
| Home Stiffness (locked) | 0.35 | Shape retention |
| Home Stiffness (falling) | 0.35 | Shape retention |
| Gravity (locked/falling) | 10 | Downward acceleration |
| Attraction Radius | 30px | Merge tendril range |
| Attraction Stiffness | 0.037 | Tendril spring force |
| Loose Goop Ease-In | 0.6s | Cubic (t³) gravity ramp |
| Droplet Count | 30 | Per pop event |
| Droplet Speed | 60 px/s | Initial scatter velocity |
| Droplet Lifetime | 3s | Fade-out duration |
| Frame Rate (desktop) | 60fps (16ms) | — |
| Frame Rate (mobile) | 40fps (25ms) | Throttled |

### Pressure Recovery

| Constant | Value |
|----------|-------|
| Base Recovery | 0ms |
| Per-Unit Recovery | 100ms per unit |
| Tier Threshold | 15 units (tier bonus starts) |
| Tier Step | 10 units per additional tier |
| Tier Bonus | 250ms per tier |
| Infused Bonus | 3,000ms per infused unit |

---

## Future Ideas

**Visual Polish:**
- **Pressure venting visual** — animated graphic flies from pop location to pressure meter, reinforcing "venting pressure" concept
- **Undulation effect** — two waves traveling around blob perimeter for idle organic motion
- **Advanced merge visualization** — smooth membrane slide as blobs merge (animated tendril shortening, contour deformation)

**Progression:**
- Additional bands (ranks 40+)
- More active abilities

**Onboarding:**
- **Tutorial system** — guided onboarding for new players

**Platform:**
- C# / Unity port

---

*Document Version: 7.0*
*Game Version: 1.1.13*
*Last Updated: February 2026*
