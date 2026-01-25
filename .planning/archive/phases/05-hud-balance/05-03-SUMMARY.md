# Plan 05-03 Summary: CONTROLS Heat Logic

**Status:** Complete
**Date:** 2026-01-20

## What Changed

### Heat Buildup (actions.ts)
- MoveBoardCommand now adds +5 heat per rotation input
- Only applies at rank 3+ (CONTROLS unlock rank)

### Heat Dissipation (GameEngine.ts)
- tick() drains heat at 50/sec when idle for 200ms
- 2 seconds to drain from 100 to 0

### Trigger Logic (GameEngine.ts)
- Changed from `rotationTimestamps.length >= 20` to `controlsHeat >= 100`
- Rank requirement shifted from 2 to 3
- Resolution sets `controlsHeat = 0`

## Files Modified
- `core/commands/actions.ts` - Heat buildup on rotation
- `core/GameEngine.ts` - Heat drain, trigger, resolution

## Verification
- [x] All tests pass
- [x] Heat meter visible in HUD (from 05-01)
- [x] Heat builds on rotation
- [x] Heat drains when idle
- [x] CONTROLS triggers at 100
- [x] Resolution cools heat to 0

## Next
Plan 05-04: Cooldowns & Rank Unlocks
