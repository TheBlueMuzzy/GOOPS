---
phase: 14-data-architecture
plan: 01
subsystem: data
tags: [upgrades, types, constants, progression]

# Dependency graph
requires:
  - phase: 13
    provides: tested architecture foundation
provides:
  - v1.2 upgrade schema with 20 upgrades
  - feature upgrade type
  - getFeatureUpgrades helper
affects: [15-onboarding-band, 16-junk-band, 17-mixer-band, 18-cracked-band]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Upgrade bands: Onboarding (0-9), Junk (10-19), Mixer (20-29), Cracked (30-39)"
    - "Three upgrade types: passive, active, feature"

key-files:
  created: []
  modified:
    - types.ts
    - constants.ts

key-decisions:
  - "20 upgrades total (plan said 17, code block defined 20)"
  - "effectPerLevel stores raw multiplier values"
  - "formatEffect functions handle display formatting"
  - "chargeCost retained for backwards compat, will be replaced by cooldown system"

patterns-established:
  - "Upgrade bands organized by rank ranges with comments"
  - "Feature type for unlockable gameplay features"

issues-created: []

# Metrics
duration: 3min
completed: 2026-01-23
---

# Phase 14 Plan 01: Upgrade System Overhaul Summary

**Restructured upgrade data from 8 upgrades to 20 upgrades with new 'feature' type, organized into 4 progression bands (Onboarding, Junk, Mixer, Cracked)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-23T~18:00Z
- **Completed:** 2026-01-23T~18:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added 'feature' to UpgradeType union (passive | active | feature)
- Replaced 8-upgrade UPGRADES object with 20-upgrade v1.2 schema
- Organized upgrades into 4 bands with rank-based unlocks
- Added getFeatureUpgrades() helper function
- All 110 tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Update UpgradeType to include 'feature'** - `e7d5d9a` (feat)
2. **Task 2: Rewrite UPGRADES with v1.2 schema** - `a7c4049` (feat)

## Files Created/Modified

- `types.ts` - Added 'feature' to UpgradeType union (line 190)
- `constants.ts` - Replaced UPGRADES object with 20 v1.2 upgrades, added getFeatureUpgrades helper

## Decisions Made

- Plan objective said "17 upgrades" but code block defined 20 — implemented the code block (authoritative source)
- Retained `chargeCost` property on actives for backwards compatibility (will be replaced by cooldown system in later phases)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Upgrade Summary

| Band | Rank Range | Upgrades |
|------|------------|----------|
| Onboarding | 0-9 | 8 (CIRCUIT_STABILIZER, AUTO_POPPER, CAPACITOR_EFFICIENCY, COOLDOWN_BOOSTER, GEAR_LUBRICATION, FOCUS_MODE, DENSE_GOOP, PRESSURE_CONTROL) |
| Junk | 10-19 | 4 (JUNK_UNIFORMER, GOOP_SWAP, GOOP_DUMP, SEALING_BONUS) |
| Mixer | 20-29 | 4 (ACTIVE_EXPANSION_SLOT, GOOP_HOLD_VIEWER, GOOP_COLORIZER, GOOP_WINDOW) |
| Cracked | 30-39 | 4 (SLOW_CRACKS, CRACK_MATCHER, CRACK_DOWN, ACTIVE_EXPANSION_SLOT_2) |

**By type:** 12 passive, 4 active, 4 feature

## Next Phase Readiness

- Types and constants ready for Phase 14 Plan 02 (complication & color config)
- Upgrade schema complete — implementation phases can reference these configs

---
*Phase: 14-data-architecture*
*Completed: 2026-01-23*
