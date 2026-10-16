# 04-02 Summary: LIGHTS Complication Rewrite

## Status: COMPLETE

## What Changed

### Task 1: LIGHTS Trigger Logic (GameEngine.ts)

**Before:** Cumulative counter trigger
- `totalUnitsAdded >= complicationThresholds.lights` (random 12-24 threshold)
- Checked every 1 second in `checkComplications()`

**After:** Pressure-gap based trigger
- Fires on piece lock (after `mergePiece` in `tick()`)
- Conditions:
  1. Rank >= 3
  2. No LIGHTS complication currently active
  3. Pressure line is 3-5+ rows above highest goop
  4. 50% random chance

**Implementation:**
- Calculate `highestGoopY` by scanning grid for topmost occupied cell
- Calculate `pressureLineY` from `timeLeft/maxTime` ratio
- Generate random gap threshold (3-5 rows)
- If `gap >= threshold`, roll 50% chance to spawn LIGHTS

### Task 2: LIGHTS Effect (GameBoard.tsx)

**Before:** Black overlay with 80% opacity over 3 seconds
- Covered entire game area including alert message
- Used `rgba(0,0,0,0.8)` background color

**After:** CSS filter with dim + grayscale over 1.5 seconds
- `filter: brightness(0.1) grayscale(1)` applied to SVG element
- Alert message remains visible and colored (not affected by filter)
- Effect clears instantly when complication resolved

**Implementation:**
- Added `lightsDimmed` prop to GameBoard component
- Added CSS keyframe animation `lightsDimIn` (1.5s ease-out)
- Applied `.lights-dimmed` class to SVG when prop is true

## Files Modified

- `core/GameEngine.ts`:
  - Added `BUFFER_HEIGHT` import
  - Removed LIGHTS check from `checkComplications()`
  - Added new trigger logic after piece lock in `tick()`
  - Updated `resolveComplication()` to remove counter reset for LIGHTS

- `components/GameBoard.tsx`:
  - Added `lightsDimmed?: boolean` prop
  - Added `lightsDimIn` keyframe animation
  - Added `.lights-dimmed` class application to SVG

- `Game.tsx`:
  - Removed old overlay-based dim effect
  - Pass `lightsDimmed` prop to GameBoard

## Verification

- [x] `npm run test:run` passes all tests (36/36)
- [x] LIGHTS complication triggers based on pressure gap (not counter)
- [x] Visual effect is dim (10%) + grayscale over 1.5s
- [x] Malfunction alert remains visible and colored
- [x] Effect clears instantly on resolution (CSS class removal)
