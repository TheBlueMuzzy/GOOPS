# Goops - Product Requirements Document

## Overview

**Goops** is a puzzle-action game where you operate as a tank maintenance technician, clearing colorful goop from a cylindrical pressure tank while managing equipment malfunctions. The game combines spatial puzzle-solving with time pressure and multi-tasking.

**Platform:** Mobile-first web game (React/TypeScript/Vite)
**Session Length:** 75 seconds per shift

### Core Fantasy

You're a low-level operator at an industrial facility. Your job: peer through a periscope into a cylindrical tank, drop goop to seal pressure cracks, laser away excess goop, and keep the equipment running. It's mundane. It's stressful. The tank keeps filling. The equipment keeps breaking. You keep playing.

### Win/Lose Conditions

**Win:** Seal the required number of cracks before pressure reaches 100%
- Required cracks = number of colors + current rank
- Example: Rank 5 with 4 colors = 9 cracks to seal
- After winning, gameplay continues until pressure hits 100% (bonus opportunity)

**Lose:** Pressure reaches 100% with fewer than required cracks sealed

---

## Game Modes

### Console Mode

The main menu and meta-game layer. A retro industrial control console (think Homer Simpson at the nuclear plant).

**Elements:**
- Operator Rank display with XP bar
- Three complication repair panels (Laser, Lights, Controls)
- Status lights and gauges
- Periscope handle (pull down to enter gameplay)
- End Day screen (CRT monitor that drops down on game over)

**Console Light States:**
- **Idle:** All orange lights blink slowly at varied speeds
- **During gameplay:** All lights blink faster
- **Active complication:** Affected section goes solid (not blinking)

**Mid-Run Display:**
- Alternates between "Cleaning in Progress..." and "Current Pressure: XX%"

### Periscope Mode

The core gameplay. You look into a cylindrical tank through a viewport showing ~33% of the tank surface.

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
- Shift Score (points earned)
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
| Visible Width | 12 columns | ~33% visible through periscope |
| Total Height | 19 rows | |
| Visible Height | 16 rows | |
| Buffer Height | 3 rows | Spawn area above visible |

The tank is cylindrical — coordinates wrap horizontally. Rotating the tank changes which section is visible. Goop groups can wrap around the cylinder.

### Pressure System

Pressure represents time remaining. It builds continuously and determines:
- Which goop can be popped (must be below pressure line)
- Where cracks spawn (at pressure line)
- Game over condition (100% pressure)

**Visual:** Water level rising from bottom. At 0% pressure, only the bottom row is submerged. At 100%, the entire tank is "underwater."

**Formulas:**
```
tankPressure = 1 - (shiftTime / 75000)
pressureRow = 1 + (tankPressure * 15)
```

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

| Zone | Time | Shapes | Cells per Piece |
|------|------|--------|-----------------|
| Tetra | 0-25s | 5 normal + 5 corrupted | 4 |
| Penta | 25-50s | 11 normal + 11 corrupted | 5 |
| Hexa | 50-75s | 11 normal + 11 corrupted | 6 |

**Total:** 54 unique shapes (27 normal + 27 corrupted)

Bigger pieces spawn later because cracks appear higher as pressure rises — taller pieces help reach them.

### Piece Spawning

Goop always falls from the center of the visible screen. The player controls WHERE it lands by rotating the tank underneath it.

**Spawning Mechanics:**
- **Corruption:** 15% chance to spawn corrupted variant (non-contiguous cells)
- **Mirroring:** 50% chance to flip asymmetric pieces horizontally
- **Multi-color:** 25% chance at rank 20+ (cells split between 2 colors)
- **Wild:** 15% chance at rank 40+ (seals any crack color)

**Wild Piece Rules:**
- Only spawn from normal pools (never corrupted)
- Cannot be multi-color
- Seal any crack color on contact
- Convert adjacent goop groups to wild
- When non-wild lands next to wild, entire wild group converts to that color

### Corrupted Pieces

Corrupted pieces have corner-touching cells instead of edge-touching. After locking:
- Corner-connected cells become separate groups
- Floating cells fall as individual loose goop
- Cannot become multi-color (mixed)
- Cannot become wild

### Goop Physics

**Groups:** Connected same-color cells form a "goop group"

**Support:** A group is supported if ANY cell touches:
- The floor (bottom row)
- Another supported group

**Falling:** Unsupported groups fall as a unit (sticky gravity)

**Merging:** When same-color groups touch, they merge into one group with a new timestamp

### Goop Filling

After placement or merge, goop "fills" before it can be popped.

**Formula:** `fillDuration = groupSize * 375ms`

Fill animation progresses row-by-row from bottom to top of the group.

### Popping (Laser)

Tapping filled goop destroys it.

**Requirements:**
1. Goop must be fully filled (animation complete)
2. Top of goop must be below pressure line (submerged)
3. Tap anywhere on the goop

**Results:**
- All connected same-color cells destroyed
- Unsupported goop above falls
- Score awarded
- Pressure reduced
- Matching cracks sealed

---

## Crack System

### Spawning

- One crack per color can be active at a time
- Spawn at the current pressure line Y position
- Spawn interval: 5000ms
- Random X position (must be empty cell)

### Sealing

1. Cover crack with matching-color goop
2. Covered goop becomes "infused" (glowing)
3. Pop the covering goop
4. Crack disappears, counts as sealed
5. Active abilities gain +25% charge per seal

**Note:** Wrong-color goop covering a crack does nothing. If goop is removed by collapse (not direct pop), crack remains.

### Expanding Cracks (Rank 30+)

At rank 30+, unsealed cracks grow over time.

**Growth Check:** Every 5000ms per crack

**Spread Chance:**
```
baseChance = 10% + tankPressure
leafPenalty = 50% reduction if crack has no children
distancePenalty = 25% per hop from root crack
upgradeOffset = SLOW_CRACKS level * 5%
finalChance = baseChance - leafPenalty - distancePenalty - upgradeOffset
```

**Spread Direction:** 8-directional (orthogonal + diagonal)

**Merging:** Adjacent same-color cracks merge into one crack structure

### Win Burst

When both conditions are met:
- Required cracks sealed
- Pressure < 90%

All remaining colors spawn cracks simultaneously — a bonus opportunity to seal more before the shift ends.

---

## Complication System

Equipment malfunctions occur based on player actions. Players start at Rank 0 with no complications, providing a safe learning period.

**Key Design:** The game does NOT pause when you exit to console. The tank keeps filling. Fix complications fast!

### Complication Overview

| Complication | Trigger | Unlock | Effect When Active |
|--------------|---------|--------|-------------------|
| Laser | Capacitor empties | Rank 4 | Two-tap to pop (prime, then pop) |
| Lights | Brightness falls below 10% | Rank 2 | Dims to 5% + grayscale |
| Controls | Heat reaches 100% | Rank 6 | 2 inputs per move, 50% held speed |

### Laser Complication

**Capacitor Meter (left side of screen):**
- Starts at 100%
- Drains 4% per unit popped
- Refills +10% on piece lock
- Color: Blue → Yellow → Red as it empties

**When active:** First tap primes the group (restarts fill animation), second tap pops it.

**Upgrade:** CAPACITOR_EFFICIENCY reduces drain by 6.25% per level

### Lights Complication

**Brightness System:**
- Starts at 100%
- Grace period: 5 seconds of fast dropping before dimming begins
- Dims over 5 seconds from 100% to 10% when not fast dropping
- Recovers at 400%/sec while fast dropping (0.25s to full)
- Flickers at 70% as warning

**When active:** Screen dims to 5% brightness with grayscale filter.

**Upgrade:** CIRCUIT_STABILIZER adds +0.75s grace per level

### Controls Complication

**Heat Meter (right side of screen):**
- Starts at 0%
- Gains 5% per tank rotation
- Drains 50%/sec when idle (after 200ms threshold)
- Color: Green → Yellow → Red as it fills

**When active:** Requires 2 inputs per action, held keys move at 50% speed.

**Upgrade:** GEAR_LUBRICATION adds +12.5% heat dissipation per level

### Cooldown

After resolving a complication, it cannot trigger again for a cooldown period:

```
cooldownSeconds = max(8, 20 - (currentRank - unlockRank))
```

Example: At rank 10, Laser (unlocks rank 4) has cooldown of max(8, 20 - 6) = 14 seconds.

### Console Repair Mini-Games

#### Repair Laser (4 Sliders)

- 4 horizontal sliders with 3 positions each (Left, Center, Right)
- Each slider has 2 indicator lights (left and right)
- Match slider position to lit indicators:
  - Left light → slide left
  - Right light → slide right
  - Both lights → slide center

**Completion:** All 4 sliders correct → complication cleared

#### Repair Lights (Sequence Memory)

1. Move slider to indicated position (up or down)
2. Watch 4-button sequence flash (blue, green, purple buttons)
3. Repeat the sequence by pressing buttons
4. Move slider to opposite position

**Sequence Rules:**
- 4 buttons in sequence
- Each button appears max 2 times
- 400ms flash, 200ms gaps

**Completion:** Correct slider → correct sequence → correct slider

#### Repair Controls (Dial Alignment)

- Circular dial with arrow pointer
- 4 target positions at corners (45°, 135°, 225°, 315°)
- Align arrow to lit corner, tap to confirm
- Repeat 4 times

**Completion:** 4 successful alignments → complication cleared

---

## Progression System

### Ranks & XP

**Max Rank:** 50

**XP Formula:**
```
xpForNextRank = 3500 + (currentRank * 250)
```

**Cumulative XP to reach rank N:**
```
totalXP = N * (3375 + 125 * N)
```

**Minimum Progress:** Every session grants at least `100 * currentRank` XP (minimum 100).

### Scraps (Currency)

- Earn 1 scrap per rank achieved
- Spend scraps to purchase and level upgrades
- Displayed as "SCRAPS: XX" on upgrade screen

### Color Schedule

| Rank | Colors Available |
|------|-----------------|
| 0-9 | Red, Blue, Green, Yellow (4) |
| 10-29 | + Purple (5) |
| 30-49 | + White (6) |
| 50 | + Black (7) |

### Starting Junk (Rank 3+)

Sessions start with junk goop already in the tank:

| Rank | Junk Blocks | Coverage |
|------|-------------|----------|
| 3-5 | ~5 blocks | ~15% of bottom row |
| 6-8 | ~8 blocks | ~25% of bottom row |
| 9+ | ~11 blocks | ~35% of bottom row |

Each junk block is an independent group (size 1).

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

- Passive: ~3% per second (varies by ability)
- Crack seal: +25% per sealed crack
- Visual: Grey circle fills with color, glows when ready

### Charge Times

| Active | Charge Time | Passive Rate |
|--------|-------------|--------------|
| Cooldown Booster | 20s | 5%/sec |
| Goop Dump | 15s | 6.67%/sec |
| Goop Colorizer | 25s | 4%/sec |
| Crack Down | 30s | 3.33%/sec |

### Ability Effects

**Cooldown Booster:** Extends all active complication cooldowns
- Level 1: +25%
- Level 2: +35%
- Level 3: +50%

**Goop Dump:** Rains same-color junk from top
- Level 1: 1 wave (18 pieces)
- Level 2: 2 waves (36 pieces)
- Level 3: 3 waves (54 pieces)

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
perUnit = 10 + heightBonus + offscreenBonus
heightBonus = (19 - y) * 10
offscreenBonus = 50 (if unit outside visible area)
popStreakMultiplier = 1 + (popStreak * 0.1)
adjacencyBonus = neighborCount * 5

totalScore = (sum of perUnit * popStreakMultiplier) + adjacencyBonus
```

### Drop Scoring

```
hardDropScore = distanceDropped * 2
```

### End Game

```
goopPenalty = remainingUnits * -50 (min 0 total)
winBonus = operatorRank * 5000 (if won)
```

**Auto-Popper Effect:** Probabilistically auto-pops remaining goop before penalty
- Base survival: 20%
- Per level: +4% survival (so 24%, 28%, 32%, 36% at levels 1-4)

### Grade System

Five performance categories averaged for letter grade:

| Category | Formula |
|----------|---------|
| Crack Performance | (cracksFilled / cracksTarget) * 100 |
| Tank Efficiency | 100 - (residualGoop * 2) |
| System Control | 100 - (residualGoop * 3) |
| Pressure Management | (pressureVented / maxTime) * 100 |
| Score Bonus | min(100, shiftScore / 100) |

**Grade Thresholds:**
| Grade | Average | Color |
|-------|---------|-------|
| A | ≥ 80 | Green |
| B | ≥ 60 | Cyan |
| C | ≥ 40 | Yellow |
| FAILURE | < 40 or didn't win | Red |

---

## Controls

### PC Controls

| Input | Action |
|-------|--------|
| A / Left Arrow | Rotate tank left |
| D / Right Arrow | Rotate tank right |
| Q | Rotate piece counter-clockwise |
| E | Rotate piece clockwise |
| W | Swap piece with held goop |
| Space | Hard drop |
| S / Down | Fast drop (hold) |
| Mouse Click | Pop goop |
| Swipe Up | Exit periscope to console |

### Touch Controls (Mobile)

| Gesture | Action |
|---------|--------|
| Drag left/right | Rotate tank |
| Tap left screen half | Rotate piece counter-clockwise |
| Tap right screen half | Rotate piece clockwise |
| Drag down | Fast drop |
| Swipe up | Exit to console / swap piece |
| Tap on goop | Pop goop |

---

## Screen Transitions

### Console → Periscope

1. Drag periscope handle downward
2. Goggles viewport shows miniaturized gameplay
3. As periscope reaches bottom, view zooms in
4. Full periscope gameplay visible

### Periscope → Console

1. Swipe up
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

| Constant | Value |
|----------|-------|
| Shift Duration | 75,000ms |
| Piece Fall Speed | 780ms/row |
| Fast Drop Multiplier | 8x |
| Lock Delay | 500ms |
| Fill Duration | groupSize * 375ms |
| Crack Spawn Interval | 5,000ms |
| Crack Growth Interval | 5,000ms |

### Grid

| Constant | Value |
|----------|-------|
| Total Width | 30 |
| Visible Width | 12 |
| Total Height | 19 |
| Visible Height | 16 |
| Buffer Height | 3 |

### Spawning

| Constant | Value |
|----------|-------|
| Corruption Chance | 15% |
| Mirror Chance | 50% |
| Multi-color Chance (rank 20+) | 25% |
| Wild Chance (rank 40+) | 15% |

### Complications

| Constant | Value |
|----------|-------|
| Laser Drain | 4% per unit |
| Laser Refill | 10% per lock |
| Lights Grace | 5s base |
| Lights Dim Duration | 5s |
| Lights Recovery | 400%/sec |
| Heat Gain | 5% per rotation |
| Heat Drain | 50%/sec |
| Cooldown Min | 8s |
| Cooldown Max | 20s |

---

## Future Ideas

**Visual Polish:**
- **Pressure venting visual** — animated graphic flies from pop location to pressure meter, reinforcing "venting pressure" concept
- Soft-body shader rendering for goop

**Progression:**
- Additional bands (ranks 40+)

**Onboarding:**
- **Tutorial system** — guided onboarding for new players

**Platform:**
- C# / Unity port

---

*Document Version: 5.0*
*Game Version: 1.5*
*Last Updated: January 2026*
