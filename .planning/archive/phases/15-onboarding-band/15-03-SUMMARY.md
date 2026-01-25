---
phase: 15-onboarding-band
plan: 03
subsystem: upgrades
tags: [upgrades, passive, pressure, focus, goop, fall-speed, timer]

# Dependency graph
requires:
  - phase: 15-02
    provides: Verified complication upgrade effects working
provides:
  - PRESSURE_CONTROL upgrade extending game time
  - FOCUS_MODE upgrade slowing timer during minigames
  - DENSE_GOOP upgrade increasing fall speed
affects: [15-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Upgrade effects applied in applyUpgrades() for static bonuses"
    - "Upgrade effects applied in tickTimer/tickActivePiece for dynamic modifiers"

key-files:
  created: []
  modified:
    - core/GameEngine.ts

key-decisions:
  - "PRESSURE_CONTROL uses hardcoded 5000ms per level (matches design doc)"
  - "FOCUS_MODE only slows time during COMPLICATION_MINIGAME phase"
  - "DENSE_GOOP affects both normal and soft drop speeds"

patterns-established:
  - "Static upgrades (one-time bonuses) in applyUpgrades()"
  - "Dynamic upgrades (per-tick modifiers) in tick methods"

issues-created: []

# Metrics
duration: 5min
completed: 2026-01-24
---

# Phase 15 Plan 03: Game Mechanics Summary

**Implemented three new passive upgrades: PRESSURE_CONTROL (+time), FOCUS_MODE (minigame slowdown), DENSE_GOOP (faster drops)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-24T00:58:00Z
- **Completed:** 2026-01-24T01:03:00Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- PRESSURE_CONTROL adds +5 seconds per level to starting time (max +40s at level 8)
- FOCUS_MODE slows timer by 10% per level during minigames only (max 40% slower at level 4)
- DENSE_GOOP increases fall speed by 12.5% per level (max 50% faster at level 4)

## Task Commits

Each task was committed atomically:

1. **Task 1: PRESSURE_CONTROL** - `f3514bc` (feat)
2. **Task 2: FOCUS_MODE** - `74b2d3d` (feat)
3. **Task 3: DENSE_GOOP** - `4577648` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `core/GameEngine.ts` - Added all three upgrade effects in appropriate locations

## Decisions Made
- PRESSURE_CONTROL applied in applyUpgrades() since it's a one-time bonus per run
- FOCUS_MODE checks phase in tickTimer() to only activate during minigames
- DENSE_GOOP modifies fall speed before soft drop calculation to affect both modes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness
- All three passive upgrades functional
- Ready for 15-04 (Auto-Popper + Cooldown Booster actives)
- Manual testing available via dev tool rank selector

---
*Phase: 15-onboarding-band*
*Completed: 2026-01-24*
