# Roadmap: Goops Complications & Progression

## Overview

Build the complication system, balance it for fair progression, add visual feedback via HUD meters, and implement the upgrade system that lets players tune difficulty over time.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Dial Rotation** - Implement drag/spin behavior for Reset Controls dial
- [x] **Phase 2: Minigame Logic** - Puzzle rules for all three minigames
- [x] **Phase 3: Complications** - Define complications and how they trigger during gameplay
- [x] **Phase 4: Minigame-Complication Integration** - Connect minigame solutions to complications
- [x] **Phase 5: HUD & Balance** - Add complication meters to periscope, rewrite trigger mechanics, tune values
- [x] **Phase 6: Progression System** - XP floor, rank curve tuning, milestone unlocks
- [ ] **Phase 7: System Upgrades** - Upgrade UI, effects, and costs

## Phase Details

### Phase 1: Dial Rotation
**Goal**: Make the Reset Controls dial spin when dragged
**Depends on**: Nothing (first phase)
**Research**: Likely (UX decision on rotation feel)
**Research topics**: Edge-only drag zone (preferred), visual indicator for drag area, normalized rotation as fallback
**Plans**: 1 plan

**Context from user:**
- Edge-only drag preferred — only responds to drags near dial edge for natural arc feel
- May need visual indicator showing acceptable drag area
- Normalized rotation (math adjusts for grab distance) as backup plan
- No click-to-rotate — should require active dragging skill

### Phase 2: Minigame Logic
**Goal**: Implement puzzle rules for all three minigames
**Depends on**: Phase 1
**Research**: Unlikely (internal game logic, rules should be in PRD)
**Plans**: TBD

**Minigames:**
- Reset Laser: 4 sliders + indicator lights
- Reset Lights: 3 buttons + 1 slider + indicator lights (the "all lights on" puzzle)
- Reset Controls: 1 dial + indicator lights

### Phase 3: Complications
**Goal**: Define complications and how they trigger during gameplay
**Depends on**: Phase 2
**Research**: Unlikely (game design)
**Plans**: TBD

**Context from user:**
- Complications are states triggered during gameplay that hinder the player
- Player swipes up (periscope rises) to go to console screen
- Game keeps running (pressure rising, piece falling) — creates tension
- Visual effects indicate which minigame to complete
- Multiple complications can happen simultaneously

### Phase 4: Minigame-Complication Integration
**Goal**: Connect minigame solutions to complications (trigger, random setup, resolution)
**Depends on**: Phase 3
**Research**: Unlikely (wiring existing systems together)
**Plans**: 4 (cleanup done, LIGHTS + CONTROLS rewrites pending)

**Context from user:**
- LASER complication: Complete and approved (two-tap mechanic)
- LIGHTS complication: Needs rewrite with user-specified trigger/effect
- CONTROLS complication: Needs rewrite with user-specified trigger/effect

**LIGHTS Complication (Rank 3+):**
- Trigger: 50% chance when piece locks, IF pressure is 3-5 rows above highest goop
- Effect: Dims to 10%, desaturates to grayscale over 1.5s (periscope only, alert exempt)
- Chance resets to 0% while active, 50% after solved

**CONTROLS Complication (Rank 2+):**
- Trigger: 20 rotation inputs within 3 seconds
- Effect: 2 inputs per move, holding works at half speed

### Phase 5: HUD & Balance
**Goal**: Add visual meters for LASER/CONTROLS, rewrite trigger mechanics, tune complication values
**Depends on**: Phase 4
**Research**: Unlikely (design decisions captured in DESIGN_VISION.md)
**Plans**: 4 (01: Meter State & UI, 02: LASER Meter Logic, 03: CONTROLS Heat Logic, 04: Cooldowns & Rank Unlocks)

**Key changes:**
- Add Laser Capacitor Meter (left side of periscope) — drains as player pops
- Add Controls Heat Meter (right side of periscope) — builds while rotating, drains when stopped
- Rewrite LASER trigger: cumulative pops → capacitor drain meter
- Rewrite CONTROLS trigger: 20 rotations/3s → heat meter at 100%
- Implement complication cooldowns (same-type can't re-trigger for X seconds)
- Shift rank unlocks: LASER → rank 1, LIGHTS → rank 2, CONTROLS → rank 3
- Player starts at rank 0 (no complications)

**HUD Design:**
- Vertical bars on left/right edges of periscope view
- Color gradient: safe → warning → danger (blue→yellow→red for drain, green→yellow→red for heat)
- No meter for LIGHTS (intentionally unpredictable)

### Phase 6: Progression System
**Goal**: Tune XP/rank curve, implement XP floor, prepare for milestone unlocks
**Depends on**: Phase 5
**Research**: Complete (linear delta curve selected)
**Plans**: 2 (01: XP Floor & Curve Retuning, 02: Milestone Infrastructure)

**Key changes:**
- Implement XP floor: `xpGained = max(100 * currentRank, finalScore)`
- New "linear delta" curve: `XP to next rank = 1500 + (rank - 1) * 500`
- Rank 2: 1,500 XP | Rank 5: 9,000 XP | Rank 10: 31,500 XP | Rank 100: 2,574,000 XP
- Milestone infrastructure for ranks 10, 20, 30... (upgrade points)
- No upgrade UI yet (Phase 7)

### Phase 7: System Upgrades
**Goal**: Build upgrade UI and implement upgrade effects
**Depends on**: Phase 6
**Research**: Likely (UI design, effect balance)
**Plans**: TBD

**Key changes:**
- Upgrade UI in console mode
- Per-system upgrades: Laser System, Lights System, Controls System
- Percentage-based effects per level
- Max level special effects (simpler minigames)
- Upgrade costs and point economy

**Upgrade effects (examples):**
- Laser: -5% drain rate per level, max level removes center targets
- Lights: -3% trigger probability per level, max level 3-button sequence
- Controls: +10% heat dissipation per level, max level 3 alignments

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Dial Rotation | 1/1 | Complete | 2026-01-18 |
| 2. Minigame Logic | 3/3 | Complete | 2026-01-18 |
| 3. Complications | 3/3 | Complete | 2026-01-19 |
| 4. Minigame-Complication Integration | 4/4 | Complete | 2026-01-19 |
| 5. HUD & Balance | 4/4 | Complete | 2026-01-20 |
| 6. Progression System | 2/2 | Complete | 2026-01-20 |
| 7. System Upgrades | 1/4 | In Progress | - |
