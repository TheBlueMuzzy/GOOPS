---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-08
---

# Project State

## Current Position

Phase: 33 of 38 (Rank 0 Training Sequence)
Plan: 3 of 4 in current phase
Status: In progress
Last activity: 2026-02-08 - Completed 33-03-PLAN.md

Progress: ████░░░░░░ 35%

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `feature/tutorial-infrastructure` (Phase 31 complete, Phase 32 complete, Phase 33 in progress)

## Next Steps

Phase 33 plan 3 of 4 complete. Next: 33-04 (Training HUD, highlight system & verification).

### Decisions Made

- Typography: 18px minimum body, CSS classes with !important, full project sweep
- Journal layout: accordion (single column) over sidebar+content (two column)
- TEXT_MANIFEST.md as editable text source-of-truth
- **Training: scripted 17-step sequence (1 continuous session) over 6 discrete scenarios**
- Training uses COLORS.RED hex values matching engine convention
- Training mode: pendingTrainingPalette interception pattern in enterPeriscope()
- Training tick() gates skip all normal gameplay systems (complications, goals, cracks, heat, lights)
- TRAINING_MESSAGES as separate Record export alongside TUTORIAL_STEPS (Phase 31 system untouched)

### Known Issues

- PiecePreview NEXT/HOLD labels at 18px may be too large for 48px box — revisit layout later
- Some SVG text in Art.tsx (PROMOTION THRESHOLD at 12px, XP at 14px) not yet standardized — SVG coordinate space differs from screen pixels

### Roadmap Evolution

- Milestone v1.5 shipped: Soft-body goop rendering, 4 completed phases (2026-02-08)
- Milestone v1.6 created: Progressive Tutorial, 8 phases (Phase 31-38)

---

## Session Continuity

Last session: 2026-02-08
**Version:** 1.1.13
**Branch:** feature/tutorial-infrastructure
**Build:** 236

### Resume Command
```
Phase 33 IN PROGRESS — 3/4 plans complete

WHAT'S DONE:
- Phase 31: Tutorial Infrastructure (3/3 plans)
- Phase 32: Journal System (1/1 plans)
- Phase 33-01: Training data model & configs (COMPLETE)
  - 17-step scripted sequence across 7 phases (A-G)
  - Types: TrainingStep, StepSetup, StepAdvance
  - Data: TRAINING_SEQUENCE + helpers
- Phase 33-02: GameEngine training mode & flow controller (COMPLETE)
  - GameEngine.startTraining() with palette/maxPieceSize constraints
  - useTrainingFlow hook for sequence management
  - pendingTrainingPalette interception in enterPeriscope()
  - TRAINING_SCENARIO_COMPLETE event
- Phase 33-03: Intercom scripts & journal content (COMPLETE)
  - TRAINING_MESSAGES: 17 intercom messages (keywords + fullText)
  - Journal pages updated with practical training content
  - TEXT_MANIFEST.md synced

NEXT: Plan 33-04 (Training HUD, highlight system & verification)

/gsd:execute-plan .planning/phases/33-rank-0-training-sequence/33-04-PLAN.md
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
