---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-03
---

# Project State

## Current Position

Phase: 25 of 30 (Physics Foundation)
Plan: Not started
Status: Ready to plan
Last activity: 2026-02-03 - Milestone v1.5 Soft-Body Integration created

Progress: ░░░░░░░░░░ 0%

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `soft-body-experiment` — Soft Body Goop (SBG) integration (v1.5 milestone)

## Next Steps

**Current:** Phase 25 - Physics Foundation
**Status:** Ready to plan
**Branch:** `soft-body-experiment`

### v1.5 Soft-Body Integration Overview

Port soft-body physics visuals from completed prototypes (5b-9) into main game rendering.

| Phase | Name | Goal |
|-------|------|------|
| 25 | Physics Foundation | Port Verlet engine, adapt to game coordinates |
| 26 | Perimeter & Blob System | Replace rect rendering with perimeter-traced blobs |
| 27 | Active Piece Physics | Falling pieces use soft-body (snappy) |
| 28 | Locked Goop Behavior | Viscosity, fill, ready-to-pop, attraction |
| 29 | Pop & Cascade | Droplets, support detection, loose goop |
| 30 | Polish & Performance | Mobile optimization, parameter tuning |

### Key Integration Considerations

From codebase audits:

**Main Game Architecture:**
- SVG-based rendering with cylindrical projection (`visXToScreenX`)
- Grid-centric: cells grouped by `goopGroupId`
- Fill animation: row-by-row timing based on timestamps
- No physics: positions are grid-snapped

**Prototype Architecture:**
- Verlet physics with springs, pressure, damping
- Perimeter tracing converts grid cells → vertex loop
- SVG goo filter for merging effect
- Cell wall: dual-layer (outer + inner cutout)

**Key Decision Point:** Cylindrical projection
- Main game uses cylindrical transform for 3D effect
- Prototypes work in flat 2D space
- Phase 25 must resolve: apply physics in cylinder space, or flatten rendering?

---

## Prototype Reference (Complete)

All prototypes (5b-9) are complete and documented. Key findings preserved in ROADMAP.md.

| Proto | URL | Focus |
|-------|-----|-------|
| 5b | `?proto=5b` | Goo filter, attraction springs |
| 5c | `?proto=5c` | Cell wall dual-layer |
| 6 | `?proto=6` | Fill/pour trim approach |
| 7 | `?proto=7` | Merge, viscosity, perimeter tracing |
| 8 | `?proto=8` | Pop, droplets, radial pressure |
| 9 | `?proto=9` | Loose goop, cascade, splitting |

**Tuned Physics Parameters:**
| Parameter | Value | Notes |
|-----------|-------|-------|
| Damping | 0.97 | High, preserves momentum |
| Stiffness | 1 | Very low, loose springs |
| Pressure | 5 | Strong volume maintenance |
| Home Stiffness | 0.3 | Shape retention |
| Return Speed | 0.5 | Moderate |
| Viscosity | 2.5 | Honey-like for locked blobs |

---

## Session Continuity

Last session: 2026-02-03
**Version:** 1.1.13
**Branch:** soft-body-experiment
**Build:** 117

### Resume Command
```
Milestone v1.5 created. Branch: soft-body-experiment

COMPLETED THIS SESSION:
- Audited main game rendering architecture
- Audited all prototype code (5b-9)
- Created v1.5 Soft-Body Integration milestone (6 phases)
- Phase directories created (25-30)

NEXT: /gsd:plan-phase 25 (Physics Foundation)
```

---

## Roadmap Evolution

- Milestone v1.5 created: Soft-body integration, 6 phases (Phase 25-30)

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
