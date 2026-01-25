# Plan 05-04 Summary: Cooldowns & Rank Unlocks

**Status:** Complete
**Date:** 2026-01-20

## What Changed

### Cooldown System (GameEngine.ts, types.ts)
- Added `complicationCooldowns: Record<ComplicationType, number>` to GameState
- Cooldown formula: `max(8, 20 - (rank - unlockRank))` seconds
- At unlock rank: 20s cooldown, at rank 10+: 8s minimum
- Cooldowns set on complication resolution, checked before triggering

### Rank Unlock Shifts
- LASER: rank 1+ (unchanged)
- LIGHTS: rank 2+ (was rank 3)
- CONTROLS: rank 3+ (was rank 2)

### Starting Rank Fix
- All complication rank checks now use `initialTotalScore` (starting rank)
- Prevents complications from unlocking mid-run when score crosses rank threshold
- Applied to: checkComplications(), tick(), heat buildup, heat drain, capacitor drain

### HUD Meter Visibility
- Laser capacitor meter: visible at rank 1+ only
- Controls heat meter: visible at rank 3+ only
- Added cooldown timer text above meters (white, monospace, shows remaining seconds)

### Game Over Screen Fix
- Operator rank selector disabled during game over
- Rank dropdown hidden during game over
- Only swipe-up gesture is interactable on end game screen

## Files Modified
- `types.ts` - Added complicationCooldowns to GameState
- `core/GameEngine.ts` - Cooldown logic, starting rank checks, rank unlock shifts
- `core/commands/actions.ts` - Starting rank checks for meter buildup/drain
- `components/GameBoard.tsx` - Conditional meter visibility, cooldown timers
- `components/Art.tsx` - Disabled rank selector during game over
- `Game.tsx` - Pass cooldowns prop to GameBoard

## Verification
- [x] All tests pass
- [x] Cooldowns prevent same-type re-trigger
- [x] LASER unlocks at rank 1
- [x] LIGHTS unlocks at rank 2
- [x] CONTROLS unlocks at rank 3
- [x] Meters only visible at appropriate rank
- [x] Cooldown timers display above meters
- [x] Rank selector disabled during game over
- [x] Human verified

## Phase 5 Complete
All 4 plans executed successfully:
- 05-01: Meter State & UI
- 05-02: LASER Meter Logic
- 05-03: CONTROLS Heat Logic
- 05-04: Cooldowns & Rank Unlocks
