---
phase: 15-onboarding-band
plan: 01
subsystem: upgrades
tags: [upgrades, migration, ui, panel, passive]

# Dependency graph
requires:
  - phase: 14-02
    provides: V1.2 upgrade schema with effectPerLevel values
provides:
  - V1.2 upgrade ID references in game logic (CAPACITOR_EFFICIENCY, CIRCUIT_STABILIZER, GEAR_LUBRICATION)
  - Dynamic UpgradePanel filtering passive upgrades by rank
  - Art.tsx max-level checks using UPGRADES config
affects: [15-02, 15-03, 15-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getUpgradeAccent() function for dynamic upgrade coloring"
    - "Dynamic passive upgrade filtering: Object.values(UPGRADES).filter(u => u.type === 'passive' && u.unlockRank <= rank)"

key-files:
  created: []
  modified:
    - core/GameEngine.ts
    - core/ComplicationManager.ts
    - core/commands/actions.ts
    - complicationConfig.ts
    - components/Art.tsx
    - components/UpgradePanel.tsx

key-decisions:
  - "complicationConfig.ts now imports UPGRADES and uses effectPerLevel values for consistency"
  - "UpgradePanel filters type === 'passive' only (actives will need separate UI)"
  - "Complication-related passives keep complication colors, others get green default"

patterns-established:
  - "Dynamic upgrade filtering by type and rank"
  - "Centralized effectPerLevel values in UPGRADES constant"

issues-created: []

# Metrics
duration: 6min
completed: 2026-01-24
---

# Phase 15 Plan 01: Upgrade ID Migration Summary

**Migrated upgrade IDs from complication names (LASER/LIGHTS/CONTROLS) to v1.2 IDs and updated UpgradePanel for dynamic passive filtering**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-24T00:43:00Z
- **Completed:** 2026-01-24T00:49:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Migrated all upgrade ID references from old complication-based names to v1.2 IDs
- Updated complicationConfig.ts to source effectPerLevel values from UPGRADES constant
- Rewrote UpgradePanel to dynamically filter passive upgrades by player rank
- Updated Art.tsx to use dynamic maxLevel from UPGRADES config

## Task Commits

Each task was committed atomically:

1. **Task 1: Update upgrade ID references in game logic** - `942f2d5` (feat)
2. **Task 2: Update Art.tsx max-level upgrade checks** - `2ccd34d` (feat)
3. **Task 3: Rewrite UpgradePanel for v1.2 passive upgrades** - `c30f617` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `core/GameEngine.ts` - CONTROLS → GEAR_LUBRICATION for heat dissipation
- `core/ComplicationManager.ts` - LIGHTS → CIRCUIT_STABILIZER for trigger chance
- `core/commands/actions.ts` - LASER → CAPACITOR_EFFICIENCY for drain calculation
- `complicationConfig.ts` - Import UPGRADES, use effectPerLevel values
- `components/Art.tsx` - Import UPGRADES, use dynamic maxLevel for minigame effects
- `components/UpgradePanel.tsx` - Dynamic passive filtering, getUpgradeAccent function

## Decisions Made
- complicationConfig.ts now references UPGRADES.effectPerLevel for single source of truth
- UpgradePanel only shows passives (actives need separate equip UI in future phases)
- Empty state message updated: "Reach Rank 2 to unlock your first upgrade"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness
- All game logic uses new v1.2 upgrade IDs
- UpgradePanel ready for additional passives as they unlock
- Foundation ready for 15-02 (complication upgrade effects)

---
*Phase: 15-onboarding-band*
*Completed: 2026-01-24*
