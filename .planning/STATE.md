---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-05
---

# Project State

## Current Position

Phase: 27.1 Physics-Controlled Active Piece
Plan: REPLANNED - See 27.1-MASTER-PLAN.md
Status: Previous implementation reverted. Comprehensive audit complete. Ready for clean implementation.
Last activity: 2026-02-05 - Created 27.1-MASTER-PLAN.md after failed implementation

Progress: ██████░░░░ ~60% (audit done, implementation pending)

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `soft-body-experiment` — Soft Body Goop (SBG) integration (v1.5 milestone)

## Next Steps

**Completed:** 27.1-01 + 27.1-02 (Physics falling integrated)
**Branch:** `soft-body-experiment`

### 27.1 Status (2026-02-05)

**Previous plans (01, 02, 03) are SUPERSEDED by 27.1-MASTER-PLAN.md**

A 4-hour implementation session failed due to:
- Missing scaling (50px proto → 30px live)
- Coordinate system confusion
- Data flow going wrong direction (game→physics instead of physics→game)

**Comprehensive audit completed covering:**
- All scaling parameters identified (×0.6 factor)
- Data flow architecture documented
- Bug root causes identified
- Complete implementation plan written

### Key Findings

1. `stepActivePieceFalling()` exists and is COMPLETE but NEVER CALLED
2. GameEngine.tickActivePiece() expects physics data but never receives it
3. preStepCallback syncs WRONG direction (game→physics instead of physics→game)
4. Category 1 parameters all need ×0.6 scaling
5. Droplet params were scaled BACKWARDS (should be smaller, not larger)

### Next Steps

1. Read and approve 27.1-MASTER-PLAN.md
2. Execute implementation tasks in order
3. Tune via sliders after implementation

---

## Session Continuity

Last session: 2026-02-05
**Version:** 1.1.13
**Branch:** soft-body-experiment
**Build:** 190

### Resume Command
```
27.1 REPLANNED after failed implementation.

COMPLETED:
- Deep audit of proto vs live differences
- Scaling analysis (50px→30px, ×0.6 factor)
- Data flow architecture documented
- Bug root causes identified
- Comprehensive master plan written

MASTER PLAN LOCATION:
.planning/phases/27.1-physics-controlled-active-piece/27.1-MASTER-PLAN.md

Next: Review master plan, then implement tasks in order
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
