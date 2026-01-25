---
title: System Inventory
type: reference
tags: [systems, features, mechanics]
updated: 2026-01-25
---

# System Inventory

A comprehensive list of every system, mechanic, and element in Goops. Use this for brainstorming improvements, identifying polish opportunities, or planning future work.

## Core Gameplay

### Tank & Grid
- Cylindrical grid (30 columns, wraps horizontally)
- Visible viewport (~12 columns, ~33% of tank)
- Tank rotation (A/D keys, touch drag)
- 19 rows total (16 visible + 3 buffer)

### Goop Pieces
- Shape library (I, J, L, O, S, T, Z patterns)
- Single-color pieces (currently)
- Piece rotation (Q/E keys)
- Center-fall mechanic (piece falls center, tank rotates underneath)
- Ghost piece (landing preview)
- Hard drop (Space key)

### Goop Physics
- Sticky gravity (groups fall as units)
- Group detection (flood fill for connected same-color)
- Support checking (floor or supported group)
- Chain collapse (removing support causes falls)
- Group merging (same-color groups combine on contact)

### Filling Animation
- Row-by-row fill from bottom to top
- Duration = groupSize * 375ms
- Timestamp resets on merge (fill restarts)

### Laser/Pop Mechanic
- Tap to pop filled goop
- Must be below pressure line
- Destroys all connected same-color units
- Triggers physics (unsupported goop falls)

### Pressure System
- Visual water level rising
- Determines poppable zone
- Game over at 100%
- Time-based (countdown timer)
- Pressure reduction from popping

### Cracks (Goals)
- Spawn at pressure line
- One per color active at a time
- Spawn interval: 5000ms
- Seal by covering + popping matching color
- "Infused" goop (glowing) when covering crack

### Win/Lose Conditions
- Win: Seal X cracks before pressure 100%
- Lose: Pressure 100% with fewer than X sealed
- Post-win: Continue playing for bonus cracks

---

## Scoring

### Pop Scoring
- Base: 10 per unit
- Height bonus: (TOTAL_HEIGHT - y) * 10
- Off-screen bonus: +50 per unit
- Combo multiplier: 1 + (combo * 0.1)
- Adjacency bonus: neighborCount * 5

### Drop Scoring
- Hard drop: distanceDropped * 2

### End Game Scoring
- Goop penalty: remainingUnits * -50
- Win bonus: operatorRank * 5000
- Bonus cracks: TBD formula

### XP System
- Score → XP (1:1)
- XP floor: max(100 * rank, score)
- Rank curve: 3500 + (rank * 250) per rank (flatter progression)

---

## Progression

### Rank System
- Ranks 0-100+
- Band structure (10 ranks each)
- Unlock gates for mechanics/colors

### Milestones
- Every 10 ranks (10, 20, 30...)
- MILESTONE_REACHED event (for future celebrations)
- Tracked in SaveData

### Upgrade Points
- 1 point per rank gained
- Spent on system upgrades

---

## Complications

### LASER Complication
- Trigger: Capacitor drains to 0
- Effect: Two-tap mechanic (prime + pop)
- Unlock: Rank 1+
- Meter: Laser capacitor (drains on pop)

### LIGHTS Complication
- Trigger: 50% on piece lock (pressure gap 3-5 rows)
- Effect: 10% brightness + grayscale
- Unlock: Rank 2+
- No meter (intentionally unpredictable)

### CONTROLS Complication
- Trigger: Heat meter reaches 100
- Effect: 2 inputs per move, half hold speed
- Unlock: Rank 3+
- Meter: Controls heat (builds on rotate, drains idle)

### Cooldown System
- Formula: max(8, 20 - (rank - unlockRank)) seconds
- Same-type can't re-trigger during cooldown

---

## Minigames (Console Mode)

### Reset Laser
- 4 horizontal sliders (Left/Center/Right)
- Match slider positions to indicator lights
- Both lights lit = center position
- ~4 moves to solve

### Reset Lights
- Sequence memory puzzle
- Flow: slider → watch 4-button sequence → repeat → slider
- ~8 interactions to solve

### Reset Controls
- Dial alignment puzzle
- Spin dial to lit corner, tap to confirm
- 4 alignments to complete
- ~8 moves to solve

---

## System Upgrades

### LASER Upgrade (Capacitor Efficiency)
- -5% drain rate per level
- Max level: No center targets in minigame

### LIGHTS Upgrade (Circuit Stabilizer)
- -6% trigger chance per level
- Max level: 3-button sequence instead of 4

### CONTROLS Upgrade (Heat Sink)
- +10% heat dissipation per level
- Max level: 3 alignments instead of 4

---

## UI/UX

### Console Mode
- Retro industrial aesthetic
- Three minigame panels
- Periscope (pull down to enter gameplay)
- Status lights (blinking patterns)
- Operator rank display

### Periscope Mode
- Tank viewport
- HUD meters (laser capacitor, controls heat)
- Cooldown timers above meters
- Malfunction alerts (pulsing red center text)
- Ghost piece preview

### End Day Screen
- CRT monitor drop-down
- Score display, rank, XP bar
- Stats summary
- System Upgrades button
- Swipe up to dismiss

### Screen Transitions
- Console → Periscope (pull down animation)
- Periscope → Console (swipe up, game continues!)
- End Day drop-down on game over

---

## Controls

### PC Controls
- A/D or Arrow keys: Tank rotation
- Q/E: Piece rotation
- W: Swap piece (planned?)
- Space: Hard drop
- Mouse click: Pop goop
- W or Swipe up: Exit periscope

### Touch Controls (Mobile)
- Drag left/right: Tank rotation
- Tap left/right half: Piece rotation
- Swipe up: Exit periscope
- Drag down periscope: Enter gameplay
- Tap goop: Pop

---

## Technical

### Performance Optimization
- 40fps throttle on mobile
- Simplified rendering (skip SVG masks)
- Opacity-based fill animation
- Skip grid lines on mobile

### State Management
- GameEngine class (core logic)
- React state for UI
- LocalStorage for persistence
- SaveData structure

### Testing
- 150 tests total across 7 test files
- Progression tests (29)
- Coordinate tests (6)
- Coordinate transform tests (27)
- Game logic tests (32)
- Minigame logic tests (18)
- Piece utils tests (21)
- Crack system tests (17)
- Pre-commit hooks

### Events
- EventBus for game events
- MILESTONE_REACHED event
- Various game state events

---

## Not Yet Implemented

### Planned (PRD)
- Storage/swap piece (hold feature implemented)
- Win condition burst (all colors spawn cracks)
- Console light blinking patterns (idle/active/complication)
- Sound design

### Implemented Since v1.2
- ✓ Multi-color pieces (Phase 19)
- ✓ Growing/Expanding cracks (Phase 18, 20)
- ✓ Starting junk mechanic (Junk Band)
- ✓ Architecture refactor (v1.1)

### Future Vision
- Soft-body shader rendering
- Power-up system expansion
- C# / Unity port
- SlowMode concept (pressure from goop volume)

### Open Questions
- Bonus crack scoring formula
- Mobile swipe up conflict (swap vs exit)
- Difficulty curve scaling

---

*Last updated: 2026-01-25 (validated against master)*
