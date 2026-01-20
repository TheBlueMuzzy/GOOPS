---
phase: 07-system-upgrades
plan: 01
subsystem: progression
tags: [upgrades, constants, types, gameengine]

# Dependency graph
requires:
  - phase: 06-progression-system
    provides: rank/XP infrastructure, powerUpPoints
provides:
  - SYSTEM_UPGRADE_CONFIG with LASER/LIGHTS/CONTROLS definitions
  - Clean GameEngine (no old upgrade effects)
affects: [07-02 effects, 07-03 UI, 07-04 max-level]

# Tech tracking
tech-stack:
  added: []
  patterns: [system-specific upgrades, percentage-based effects, max-level bonuses]

key-files:
  created: []
  modified: [constants.ts, types.ts, core/GameEngine.ts]

key-decisions:
  - "Replace generic upgrades with system-specific upgrades only"
  - "5 levels per upgrade, 1 point cost each (15 total to max all)"
  - "Backwards compatibility alias for UPGRADE_CONFIG"

patterns-established:
  - "System upgrades map 1:1 with complication types (LASER, LIGHTS, CONTROLS)"

issues-created: []

# Metrics
duration: 8min
completed: 2026-01-20
---

# Phase 7 Plan 1: System Upgrade Definitions Summary

**Defined SYSTEM_UPGRADE_CONFIG with three complication-specific upgrade tracks (LASER, LIGHTS, CONTROLS), removed old generic upgrades from GameEngine**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-20T17:03:00Z
- **Completed:** 2026-01-20T17:11:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created SYSTEM_UPGRADE_CONFIG with LASER (Capacitor Efficiency), LIGHTS (Circuit Stabilizer), CONTROLS (Heat Sink Upgrade)
- Each upgrade: 5 levels, 1 point cost, percentage-based effects, max-level bonus text
- Removed TIME_BONUS, STABILITY, SCORE_BOOST from GameEngine
- GameEngine now uses base values (no time/speed/score modifiers)

## Task Commits

All tasks were committed together (logically related changes):

1. **Task 1: Define SYSTEM_UPGRADE_CONFIG** - `3fe82e6` (feat)
2. **Task 2: Update SaveData comments** - `3fe82e6` (included)
3. **Task 3: Remove old upgrade effects** - `3fe82e6` (included)

**Plan metadata:** Pending (this commit)

## Files Created/Modified

- `constants.ts` - SYSTEM_UPGRADE_CONFIG replaces UPGRADE_CONFIG (alias kept for compatibility)
- `types.ts` - SaveData comments clarified for new upgrade structure
- `core/GameEngine.ts` - Removed TIME_BONUS, STABILITY, SCORE_BOOST logic from applyUpgrades(), updateScoreAndStats(), tick()

## Decisions Made

1. **Replace generic upgrades with system-specific only** - Old upgrades (time extension, fall speed, score boost) were game-wide modifiers. New upgrades directly improve specific complication systems.
2. **5 levels per upgrade** - At 1 point per rank, players can max all 3 systems by rank 15.
3. **Keep UPGRADE_CONFIG alias** - Backwards compatibility while transitioning.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- SYSTEM_UPGRADE_CONFIG ready for effects implementation (Plan 07-02)
- GameEngine clean slate for new upgrade effect wiring
- Types already support upgrade storage via existing powerUps Record

---
*Phase: 07-system-upgrades*
*Completed: 2026-01-20*
