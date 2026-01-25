# Summary 08-01: Quick Wins & Memory Fixes

## Status: COMPLETE

## What Was Done

### Task 1: Fixed rotationTimestamps Memory Leak
- Added `ROTATION_BUFFER_SIZE = 30` constant
- Replaced unbounded array with circular buffer using `shift()` instead of `filter()`
- Eliminates ~6000 allocations per session from previous filter approach

### Task 2: Created complicationConfig.ts
- Centralized all complication configuration:
  - Unlock ranks (LASER@1, LIGHTS@2, CONTROLS@3)
  - LASER: capacitorMax, drainPerUnit, drainUpgradeEffect
  - LIGHTS: triggerChanceBase, triggerUpgradeEffect, pressureGapMin/Max
  - CONTROLS: heatMax, heatPerRotation, dissipationBase, dissipationUpgradeEffect, idleThresholdMs
  - Cooldown config: minSeconds, maxSeconds
- Added helper functions: `calculateCooldownMs()`, `getUnlockRank()`, `isComplicationUnlocked()`
- Updated GameEngine.ts and actions.ts to use config values

### Task 3: Moved viewBox to Module-Level Constants
- Initially used `useMemo` with empty deps (incorrect pattern for true constants)
- **Refactored:** Now imports `VIEWBOX` from `coordinateTransform.ts`
- Replaced local `getScreenX`/`getGridXFromScreen` with imported `visXToScreenX`/`screenXToVisX`
- Simplified `getScreenPercentCoords` dependency array (only `boardOffset` changes)
- Follows React best practice: constants at module level, not in hooks

### Task 4: Extracted Coordinate Transform Utilities
- Created `utils/coordinateTransform.ts` with pure functions:
  - `VIEWBOX` - precomputed viewBox dimensions
  - `visXToScreenX()` / `screenXToVisX()` - cylindrical projection
  - `clientToSvg()` - browser coords to SVG coords
  - `svgToVisual()` - SVG coords to visual grid coords
  - `visualToGrid()` - visual coords to game grid coords
  - `gridToPercentage()` - grid coords to percentage for overlays
  - `isInVisibleRange()` - bounds checking
- Created 16 unit tests in `tests/coordinateTransform.test.ts`

## Files Changed

| File | Change |
|------|--------|
| `constants.ts` | Added ROTATION_BUFFER_SIZE, ROTATION_WINDOW_MS |
| `complicationConfig.ts` | New - centralized complication config |
| `core/GameEngine.ts` | Use complicationConfig values |
| `core/commands/actions.ts` | Use complicationConfig values, circular buffer |
| `components/GameBoard.tsx` | Import VIEWBOX and coordinate functions from utils |
| `utils/coordinateTransform.ts` | Export BLOCK_SIZE, ANGLE_PER_COL, CYL_RADIUS |
| `tests/coordinateTransform.test.ts` | New - 16 tests |

## Test Results

- All 81 tests passing (65 original + 16 new)
- No regressions

## React Best Practices Applied

- **Module-level constants**: VIEWBOX, BLOCK_SIZE, ANGLE_PER_COL, CYL_RADIUS computed once at import
- **No useMemo for constants**: Removed useMemo with empty deps (unnecessary overhead)
- **Pure utility functions**: visXToScreenX, screenXToVisX are stateless, no hooks needed
- **Minimal hook dependencies**: getScreenPercentCoords only depends on boardOffset

## Commits

1. `docs: create Phase 8 plan` (2ee2f88)
2. `refactor: complete Phase 8 quick wins` (afb18f7)
3. `docs: complete Phase 8 documentation` (f60caab)
4. `refactor: use module-level constants for viewBox` (pending)
