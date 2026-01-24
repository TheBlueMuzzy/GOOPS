# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- None — ready for Phase 16/17 work

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.
**Current focus:** v1.2 progression system — ranks 0-39 with new upgrades and mechanics

## Current Position

Phase: 17 of 18 (Mixer Band)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-01-24 - Completed 17-01-PLAN.md

Progress: █████░░░░░ 35%

## What's Done

### Lights Malfunction Rework (Completed 2026-01-24)

Replaced random trigger with player-controlled brightness system:
- **Soft dropping** (S key or drag down) charges the lights
- **Not soft dropping** starts grace period, then dims, then triggers malfunction
- CIRCUIT_STABILIZER now extends grace period (+0.75s per level, max 8s at level 4)

Timing:
- Grace period: 5s base
- Dim duration: 5s (100% → 10%)
- Recovery: ~0.25s at 400%/sec
- Overflare: 110% peak for visual feedback

Also removed crack color pool UI from top of screen (freeing space for hold/next piece).

### v1.1 Architecture Refactor (Shipped 2026-01-21)

All 6 phases (8-13) complete. See [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full details.

### v1.0 MVP (Shipped 2026-01-21)

All 7 phases complete. See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

## Accumulated Context

### Key Technical Discovery

**SVG Coordinate Conversion with preserveAspectRatio="xMidYMid slice"**

Simple viewBox math doesn't work. Must use:
```tsx
const refPoint = document.getElementById('coord-reference');
const ctm = refPoint.getScreenCTM();
const svgPoint = screenPoint.matrixTransform(ctm.inverse());
```

### Balance Summary (Current v1.1.16)

| Complication | Trigger | Player Mitigation |
|--------------|---------|-------------------|
| Laser | Capacitor drains on pop | +10% refill on piece lock |
| Controls | Heat builds on rotate | Heat dissipates when idle |
| Lights | Brightness dims when not soft dropping | Soft drop to recharge |

All three complications now have player-driven triggers AND mitigations.

## Session Continuity

Last session: 2026-01-24
Stopped at: Completed 17-01-PLAN.md (Purple color + Active Expansion Slot)
Resume command: `/gsd:execute-plan .planning/phases/17-mixer-band/17-02-PLAN.md`
Phase 17 Status: 1/3 plans complete

### This Session Summary (2026-01-24)

**What was done:**
1. Implemented lights brightness system (player-controlled via soft drop)
2. Added grace period (5s base + 0.75s per CIRCUIT_STABILIZER level)
3. Added warning flicker at end of grace period
4. Added 5-second dim from 100% → 10%, then malfunction
5. Added overflare (110% peak) visual feedback on recovery
6. Updated CIRCUIT_STABILIZER to extend grace period instead of reduce trigger chance
7. Removed crack color pool UI from top of screen
8. Removed old random trigger logic entirely
9. Fixed minigame completion to restart grace period

**Version:** 1.1.16

**Files changed:** 9 files
- types.ts (added lightsBrightness, lightsGraceStart, lightsFlickered to GameState)
- core/GameEngine.ts (added tickLightsBrightness, removed checkLightsTrigger)
- core/ComplicationManager.ts (updated resolveComplication, removed checkLightsTrigger)
- core/events/GameEvents.ts (added LIGHTS_FLICKER event)
- complicationConfig.ts (replaced random trigger config with brightness config)
- constants.ts (updated CIRCUIT_STABILIZER description and effect)
- components/GameBoard.tsx (inline brightness filter, removed crack color pool UI)
- Game.tsx (pass lightsBrightness instead of lightsDimmed)
- components/Art.tsx (version bump)

### Next Steps

1. Continue Phase 16 (Junk Band) — Junk Goop, GOOP_DUMP, SEALING_BONUS
2. Or proceed to Phase 17 (Mixer Band) if Phase 16 is considered complete
3. Full playtest of progression Rank 0 → 39

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<commit>`, `<merge>`, `<status>`, `<handoff>`
