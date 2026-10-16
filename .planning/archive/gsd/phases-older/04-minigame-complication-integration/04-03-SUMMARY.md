# 04-03 Summary: CONTROLS Complication Rewrite

## Status: COMPLETE

## What Changed

### Task 1: CONTROLS Trigger Logic

**Before:** Cumulative counter trigger
- `totalRotations >= complicationThresholds.controls` (random 12-24 threshold)
- Checked every 1 second in `checkComplications()`

**After:** Time-windowed rotation speed trigger
- Fires when 20+ rotations happen within 3 seconds
- Timestamps tracked in `rotationTimestamps: number[]`
- Automatic pruning of old timestamps (>3s)

**Implementation:**
- Added `rotationTimestamps` field to GameState (types.ts)
- Updated MoveBoardCommand to push timestamps and prune old ones
- Changed checkComplications() to check `rotationTimestamps.length >= 20`
- Clear timestamps on trigger and on resolution

### Task 2: CONTROLS Effect

**Before:** Flipped controls effect
- Left/right controls flip direction every 3 seconds
- Used `controlsFlipped` state with setInterval

**After:** Sluggish controls effect
- Requires 2 inputs to move 1 space
- Held keys move at half speed (200ms vs 100ms repeat rate)
- Removed flip toggle entirely

**Implementation:**
- Removed `controlsFlipped` state and flip interval
- Added `controlsInputCountRef` to track pending inputs
- Modified movement loop:
  - When CONTROLS active: increment count, only execute on count >= 2, then reset
  - When CONTROLS active: use 200ms repeat rate instead of 100ms
- Reset input count when complication resolved

## Files Modified

- `types.ts`:
  - Added `rotationTimestamps: number[]` to GameState

- `core/GameEngine.ts`:
  - Initialize `rotationTimestamps: []` in constructor and startRun()
  - Changed CONTROLS trigger to check timestamp array length
  - Clear timestamps in resolveComplication() for CONTROLS

- `core/commands/actions.ts`:
  - MoveBoardCommand now pushes timestamps and prunes old ones

- `Game.tsx`:
  - Removed `useState` import, `controlsFlipped` state, and flip interval
  - Added `controlsInputCountRef` for double-tap tracking
  - Modified movement loop with CONTROLS-aware input counting and repeat rate

## Verification

- [x] `npm run test:run` passes all tests (36/36)
- [x] CONTROLS triggers on rapid rotation (20 in 3s)
- [x] Movement requires 2 inputs per tank move when active
- [x] Held movement is half speed when active
- [x] Effect clears on resolution (input count reset)
