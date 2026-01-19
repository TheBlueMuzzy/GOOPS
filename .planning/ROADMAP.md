# Roadmap: Goops Minigame Controls

## Overview

Complete the minigame control system: make the dial interactive, implement puzzle logic for all three minigames, define complications that trigger during gameplay, and wire everything together so complications can be triggered and resolved.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Dial Rotation** - Implement drag/spin behavior for Reset Controls dial
- [x] **Phase 2: Minigame Logic** - Puzzle rules for all three minigames
- [ ] **Phase 3: Complications** - Define complications and how they trigger during gameplay
- [ ] **Phase 4: Minigame-Complication Integration** - Connect minigame solutions to complications

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
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Dial Rotation | 1/1 | Complete | 2026-01-18 |
| 2. Minigame Logic | 3/3 | Complete | 2026-01-18 |
| 3. Complications | 2/3 | In progress | - |
| 4. Minigame-Complication Integration | 0/TBD | Not started | - |
