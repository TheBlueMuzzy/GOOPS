---
title: "Plan 23-07 Summary: Remaining Goop Terms"
type: summary
phase: 23
plan: 7
completed: 2026-01-27
---

# Plan 23-07 Summary: Remaining Goop Terms

## Accomplishments

Renamed the final set of legacy "piece" terminology to Goop equivalents, completing Phase 23 (Code Rename).

### Task 1: Storage/Preview Terms
- `storedPiece` → `storedGoop` (GameState, Engine, props)
- `nextPiece` → `nextGoop` (GameState, Engine, props)
- Note: `ghost` variable didn't exist - code already used descriptive `ghostY`/`getGhostY`

**Files:** types.ts, core/GameEngine.ts, core/commands/actions.ts, Game.tsx, components/GameBoard.tsx

**Commit:** `9373e5a refactor(23-07): rename storedPiece/nextPiece to storedGoop/nextGoop`

### Task 2: Block/Falling Terms
- `BlockData` → `GoopBlock` (type definition)
- `FallingBlock` → `LooseGoop` (type definition)
- `isGlowing` → `isSealingGoop` (visual flag for crack-sealing goop)
- `fallingBlocks` → `looseGoop` (state array)
- `updateFallingBlocks` → `updateLooseGoop` (function)
- `tickFallingBlocks` → `tickLooseGoop` (engine method)

**Files:** types.ts, utils/goopRenderer.ts, utils/gameLogic.ts, core/GameEngine.ts, core/commands/actions.ts, components/GameBoard.tsx, tests/gameLogic.test.ts

**Commit:** `1c5020f refactor(23-07): rename FallingBlock/BlockData/isGlowing to LooseGoop/GoopBlock/isSealingGoop`

### Task 3: Pressure Terms
- `pressureRatio` → `tankPressure` (all calculation and display contexts)
- Note: Plan specified `pressure` but actual variable was `pressureRatio`

**Files:** core/commands/actions.ts, core/CrackManager.ts, utils/gameLogic.ts, hooks/useInputHandlers.ts, components/Controls.tsx, components/GameBoard.tsx

**Commit:** `6cbf903 refactor(23-07): rename pressureRatio to tankPressure`

## Test Results

All 151 tests pass. TypeScript compiles clean.

## Phase 23 Complete

This plan completes Phase 23 (Code Rename) - all 7 plans executed:
- 23-01: softDrop → fastDrop
- 23-02: Core Goop lifecycle
- 23-03: Tank dimensions & coordinates
- 23-04: TankSystem & actions
- 23-05: Progression variables & persistence
- 23-06: Screen/Phase types & Cracks
- 23-07: Remaining Goop terms (this plan)

## Next Steps

Phase 24 (UI & Documentation) is the final phase of v1.4 Naming Standardization.
