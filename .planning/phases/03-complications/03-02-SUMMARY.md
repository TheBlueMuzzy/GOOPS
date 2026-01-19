# 03-02 Summary: Gameplay Effects for Complications

**Completed:** 2026-01-19
**Status:** Complete

## What Was Built

Implemented three distinct gameplay effects that trigger when complications are active, making them disruptive and urgent to fix:

### 1. LIGHTS Effect (Screen Dim)
- **File:** `Game.tsx`
- When LIGHTS complication is active during PERISCOPE phase:
  - Black overlay fades in from 0 to 0.8 opacity over 3 seconds
  - Uses CSS keyframe animation for smooth transition
  - Clears instantly when complication is resolved (element unmounts)
- Creates visual urgency - game becomes very hard to see

### 2. CONTROLS Effect (Flipping Controls)
- **File:** `Game.tsx`
- When CONTROLS complication is active:
  - Controls flip direction every 3 seconds (left becomes right, vice versa)
  - Affects keyboard (A/D) and touch drag direction
  - Uses `useState` and `setInterval` to toggle flip state
  - Resets to normal immediately when complication is resolved
- Creates disorienting gameplay - player never knows when next flip will happen

### 3. LASER Effect (+1 Tap to Pop)
- **Files:** `types.ts`, `core/GameEngine.ts`, `core/commands/actions.ts`, `components/GameBoard.tsx`
- When LASER complication is active:
  - First tap on filled goop group "primes" it (doesn't pop)
  - Second tap on same group pops it normally
  - Primed groups show red dashed outline visual indicator
  - All primed groups clear when complication is resolved
- Creates mechanical difficulty - doubled effort to clear goops

## Technical Changes

### Types (`types.ts`)
- Added `primedGroups: Set<string>` to `GameState` interface

### GameEngine (`core/GameEngine.ts`)
- Initialize `primedGroups` as empty Set in constructor and `startRun()`
- Clear `primedGroups` when LASER complication is resolved

### BlockTapCommand (`core/commands/actions.ts`)
- Added LASER complication check before pop logic
- If LASER active and group not primed: add to set, return early
- If LASER active and group is primed: remove from set, proceed with pop

### GameBoard (`components/GameBoard.tsx`)
- Added `isPrimed` check for each group using `state.primedGroups.has(gid)`
- Primed groups render with red (#ff6b6b) dashed stroke instead of normal contour

### Game (`Game.tsx`)
- Added `controlsFlipped` state and interval for CONTROLS effect
- Added dimming overlay div for LIGHTS effect with CSS animation
- Fixed ComplicationType reference from BLOWN_FUSE to LIGHTS

## Verification

- [x] `npm run test:run` passes all 36 tests
- [x] LIGHTS: Screen dims over 3s during PERISCOPE, clears on fix
- [x] CONTROLS: Left/right flip every 3s, clears on fix
- [x] LASER: Requires 2 taps to pop, visual indicator for primed, clears on fix
- [x] Effects only active during their respective complication
- [x] Effects are independent (can have multiple active)

## Commits

1. `feat(complication): implement LIGHTS effect - screen dims over 3 seconds`
2. `feat(complication): implement CONTROLS effect - left/right flip every 3s`
3. `feat(complication): implement LASER effect - requires 2 taps to pop`

---

*Plan: 03-02*
*Phase: 03-complications*
