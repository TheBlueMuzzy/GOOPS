---
title: Testing Patterns
type: architecture
tags: [tests, vitest, coverage]
updated: 2026-01-25
---

# Testing Patterns

**Analysis Date:** 2026-01-18

## Test Framework

**Runner:**
- Vitest 4.0.17
- Config: `vitest.config.ts` in project root

**Assertion Library:**
- Vitest built-in expect
- Matchers: `toBe`, `toEqual`, `toContain`, `toHaveLength`

**Run Commands:**
```bash
npm run test:run          # Run all tests once (150 tests)
npm test                  # Watch mode
npm test -- path/to/file  # Single file
```

## Test File Organization

**Location:**
- Dedicated `tests/` directory (not co-located)
- All test files in `tests/*.test.ts`

**Naming:**
- `{module}.test.ts` format
- `gameLogic.test.ts` - Game logic utilities
- `coordinates.test.ts` - Coordinate system
- `coordinateTransform.test.ts` - SVG coordinate transforms
- `progression.test.ts` - Rank/XP calculations
- `minigameLogic.test.ts` - Minigame constants and logic

**Structure:**
```
tests/
  coordinates.test.ts          # 6 tests - coordinate wrapping
  coordinateTransform.test.ts  # 27 tests - SVG coordinate transforms
  crackSystem.test.ts          # 17 tests - crack spreading logic
  gameLogic.test.ts            # 32 tests - core game logic
  minigameLogic.test.ts        # 18 tests - minigame constants
  pieceUtils.test.ts           # 21 tests - piece utilities
  progression.test.ts          # 29 tests - rank/XP calculations
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';

describe('ModuleName', () => {
  describe('functionName', () => {
    it('should handle specific case', () => {
      // arrange
      const input = createTestData();

      // act
      const result = functionName(input);

      // assert
      expect(result).toEqual(expected);
    });
  });
});
```

**Patterns:**
- Nested describe blocks for grouping related tests
- Helper functions for test data creation (`createEmptyGrid`, `createMockPiece`)
- No beforeEach/afterEach (tests are independent)
- Descriptive test names that explain the scenario

## Test Helpers

**Factory Functions:**
```typescript
// Helper to create an empty grid
const createEmptyGrid = (): GridCell[][] => {
  return Array(TOTAL_HEIGHT).fill(null).map(() => Array(TOTAL_WIDTH).fill(null));
};

// Helper to create a mock piece
const createMockPiece = (x: number, y: number, cells: { x: number; y: number }[]): ActivePiece => ({
  definition: { type: PieceType.T, color: COLORS.RED, cells },
  x,
  y,
  screenX: x,
  rotation: 0,
  cells,
  spawnTimestamp: Date.now(),
  startSpawnY: 0,
  state: PieceState.FALLING,
});

// Helper to place a cell on the grid
const placeCell = (grid, x, y, color, groupId) => {
  grid[y][x] = { /* cell data */ };
};
```

**Location:**
- Helper functions defined at top of test file
- Not shared between test files (each file self-contained)

## Coverage

**Requirements:**
- No enforced coverage target
- Focus on testing pure functions (game logic, coordinates)

**Current Coverage:**
- `utils/gameLogic.ts` - Well tested (collision, groups, scoring)
- `utils/coordinates.ts` - Tested (cylindrical wrapping)
- `utils/coordinateTransform.ts` - Well tested (SVG coordinate conversions)
- `utils/progression.ts` - Well tested (XP curve, rank calculations)
- `complicationConfig.ts` - Tested (minigame constants and unlock logic)
- React components - Not unit tested (manual visual testing)
- GameEngine - Indirectly tested through utility functions

## Test Types

**Unit Tests:**
- Scope: Single pure function in isolation
- Mocking: None needed (pure functions)
- Examples: `getRotatedCells`, `checkCollision`, `findContiguousGroup`

**What's Tested (from `gameLogic.test.ts`):**
- Piece rotation in all orientations
- Color palette generation by rank
- Collision detection (boundaries, existing blocks, wrapping)
- Contiguous group finding (flood fill algorithm)
- Floating block detection (gravity)
- Score calculations (height, off-screen, multiplier, adjacency)

**What's Tested (from `coordinates.test.ts`):**
- Grid coordinate normalization
- Cylindrical wrapping at boundaries
- Edge cases at grid limits

**What's Tested (from `coordinateTransform.test.ts`):**
- VIEWBOX dimensions and constants
- visXToScreenX/screenXToVisX conversions
- clientToSvg coordinate transforms
- svgToVisual coordinate transforms
- visualToGrid coordinate transforms
- gridToPercentage calculations
- Edge cases at grid boundaries and wrap points

**What's Tested (from `progression.test.ts`):**
- XP curve calculations by rank
- XP delta progression
- Rank determination from total XP
- XP floor calculations
- Milestone thresholds
- Edge cases for rank boundaries

**What's Tested (from `minigameLogic.test.ts`):**
- Complication config structure
- Unlock rank requirements (LASER@1, LIGHTS@2, CONTROLS@3)
- Cooldown calculations
- Duration calculations
- Score multipliers
- Configuration consistency

**What's Tested (from `pieceUtils.test.ts`):**
- Piece cell transformations
- Multi-color piece handling
- Piece rotation utilities
- Color assignment logic

**What's Tested (from `crackSystem.test.ts`):**
- Crack cell data structure
- Crack spreading logic
- Connected component counting
- Merge behavior
- SLOW_CRACKS effect

**Integration Tests:**
- Not currently used
- GameEngine tested indirectly through utility function tests

**E2E Tests:**
- Not currently used
- Visual/gameplay testing done manually by user

## Pre-commit Hook

**Configuration:**
- Husky runs `npm run test:run` before each commit
- Commit blocked if tests fail

**Purpose:**
- Catch regressions before code is committed
- Ensure all tests pass after every change

## Common Patterns

**Testing Pure Functions:**
```typescript
it('should return correct cells after 90-degree rotation', () => {
  const original = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  const rotated = getRotatedCells(original, 1);
  expect(rotated).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }]);
});
```

**Testing Edge Cases:**
```typescript
it('should wrap collision check at grid boundaries', () => {
  const grid = createEmptyGrid();
  const piece = createMockPiece(TOTAL_WIDTH - 1, 5, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  // Piece extends past right edge, should wrap to left
  expect(checkCollision(grid, piece)).toBe(false);
});
```

**Testing with Grid State:**
```typescript
it('should find group across wrapped boundary', () => {
  const grid = createEmptyGrid();
  placeCell(grid, 0, 5, 'red', 'g1');
  placeCell(grid, TOTAL_WIDTH - 1, 5, 'red', 'g1');
  const group = findContiguousGroup(grid, 0, 5);
  expect(group).toHaveLength(2);
});
```

---

*Testing analysis: 2026-01-18*
*Updated 2026-01-21 for v1.1 refactor*
*Updated 2026-01-25: 150 tests across 7 files (added crackSystem.test.ts, pieceUtils.test.ts)*
