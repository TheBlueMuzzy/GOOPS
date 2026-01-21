# Roadmap: Goops Complications & Progression

## Overview

Build the complication system, balance it for fair progression, add visual feedback via HUD meters, and implement the upgrade system that lets players tune difficulty over time.

## Domain Expertise

None

## Milestones

- ✅ [v1.0 MVP](milestones/v1.0-ROADMAP.md) — Phases 1-7 (shipped 2026-01-21)
- 🚧 **v1.1 Architecture Refactor** — Phases 8-13 (in progress)

## Completed Milestones

<details>
<summary>v1.0 MVP (Phases 1-7) — SHIPPED 2026-01-21</summary>

- [x] Phase 1: Dial Rotation (1/1 plans) — completed 2026-01-18
- [x] Phase 2: Minigame Logic (3/3 plans) — completed 2026-01-18
- [x] Phase 3: Complications (3/3 plans) — completed 2026-01-19
- [x] Phase 4: Minigame-Complication Integration (4/4 plans) — completed 2026-01-19
- [x] Phase 5: HUD & Balance (4/4 plans) — completed 2026-01-20
- [x] Phase 6: Progression System (2/2 plans) — completed 2026-01-20
- [x] Phase 7: System Upgrades (4/4 plans) — completed 2026-01-20

**Total:** 7 phases, 22 plans, 65 tests

See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

</details>

---

### 🚧 v1.1 Architecture Refactor (In Progress)

**Milestone Goal:** Solidify codebase foundation before adding new gameplay features. Fix memory leaks, split large files, centralize state management, expand test coverage.

**Constraints:**
- Must maintain all 65 existing tests passing throughout refactor
- Mobile performance optimizations must be preserved
- No gameplay changes - purely structural refactor
- Each phase should be independently deployable

**Success Criteria:**
- No files over 400 lines
- All hard-coded values in constants.ts
- GameEngine.tick() under 50 lines
- Test coverage for coordinate transforms and minigames
- Event-based communication replaces prop drilling

#### Phase 8: Quick Wins & Memory Fixes ✅

**Goal**: Fix critical issues with minimal risk - memory leaks, hard-coded values, memoization
**Depends on**: v1.0 complete
**Research**: Unlikely (internal patterns)
**Plans**: 1/1 complete

Tasks:
- ✅ Extract hard-coded values to constants.ts
- ✅ Fix rotationTimestamps memory leak (circular buffer)
- ✅ Create complicationConfig.ts (single source of truth)
- ✅ Fix vbX/vbY/vbW/vbH memoization
- ✅ Create coordinateTransform.ts (testable functions)

Plans:
- [x] 08-01: Quick Wins & Memory Fixes (all tasks in single plan)

#### Phase 9: Art.tsx Decomposition

**Goal**: Split 1,478-line Art.tsx into focused minigame components
**Depends on**: Phase 8
**Research**: Unlikely (internal refactor)
**Plans**: TBD

Tasks:
- Extract LaserMinigame.tsx
- Extract LightsMinigame.tsx
- Extract ControlsMinigame.tsx
- Create ConsoleLayout.tsx (remaining SVG structure)
- Extract useMinigameState() hooks

Plans:
- [ ] 09-01: TBD

#### Phase 10: GameBoard.tsx Decomposition

**Goal**: Split 1,052-line GameBoard.tsx into focused modules
**Depends on**: Phase 9
**Research**: Unlikely (internal refactor)
**Plans**: TBD

Tasks:
- Extract useInputHandlers.ts hook
- Extract coordinateTransform.ts utilities
- Extract rendering helpers (useGroupRenderer.ts)
- Simplify main GameBoard component

Plans:
- [ ] 10-01: TBD

#### Phase 11: GameEngine Refactor

**Goal**: Split GameEngine.tick() and extract focused managers
**Depends on**: Phase 10
**Research**: Unlikely (internal refactor)
**Plans**: TBD

Tasks:
- Split tick() into tickGoals(), tickComplications(), tickHeat(), tickFallingBlocks(), tickActivePiece()
- Extract ComplicationManager
- Extract GoalManager
- Encapsulate public properties with setter methods

Plans:
- [ ] 11-01: TBD

#### Phase 12: State Management & Events

**Goal**: Centralize state and expand event system to reduce prop drilling
**Depends on**: Phase 11
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Tasks:
- Create GameStateManager interface
- Centralize state updates
- Expand GameEventBus with input events
- Remove prop drilling from Game.tsx → GameBoard

Plans:
- [ ] 12-01: TBD

#### Phase 13: Testing & Documentation

**Goal**: Add test coverage for refactored code and update docs
**Depends on**: Phase 12
**Research**: Unlikely (internal work)
**Plans**: TBD

Tasks:
- Coordinate transform edge case tests
- Minigame state machine tests
- Command execution order tests
- Update architecture documentation

Plans:
- [ ] 13-01: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Dial Rotation | v1.0 | 1/1 | Complete | 2026-01-18 |
| 2. Minigame Logic | v1.0 | 3/3 | Complete | 2026-01-18 |
| 3. Complications | v1.0 | 3/3 | Complete | 2026-01-19 |
| 4. Minigame-Complication Integration | v1.0 | 4/4 | Complete | 2026-01-19 |
| 5. HUD & Balance | v1.0 | 4/4 | Complete | 2026-01-20 |
| 6. Progression System | v1.0 | 2/2 | Complete | 2026-01-20 |
| 7. System Upgrades | v1.0 | 4/4 | Complete | 2026-01-20 |
| 8. Quick Wins & Memory Fixes | v1.1 | 1/1 | Complete | 2026-01-21 |
| 9. Art.tsx Decomposition | v1.1 | 0/? | Not started | - |
| 10. GameBoard.tsx Decomposition | v1.1 | 0/? | Not started | - |
| 11. GameEngine Refactor | v1.1 | 0/? | Not started | - |
| 12. State Management & Events | v1.1 | 0/? | Not started | - |
| 13. Testing & Documentation | v1.1 | 0/? | Not started | - |
