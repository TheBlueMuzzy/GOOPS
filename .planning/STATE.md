---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-08
---

# Project State

## Current Position

Phase: 33 of 38 (Rank 0 Training Sequence)
Plan: 4 of 4 in current phase (IN PROGRESS — UAT checkpoint)
Status: In progress
Last activity: 2026-02-08 - Executing 33-04 checkpoint verification

Progress: ████░░░░░░ 35%

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `feature/tutorial-infrastructure` (Phase 31 complete, Phase 32 complete, Phase 33 in progress)

## Next Steps

33-04 tasks 1-2 complete, checkpoint 3 (human-verify) in progress. Fixing issues found during UAT.

### Decisions Made

- Typography: 18px minimum body, CSS classes with !important, full project sweep
- Journal layout: accordion (single column) over sidebar+content (two column)
- TEXT_MANIFEST.md as editable text source-of-truth
- **Training: scripted 17-step sequence (1 continuous session) over 6 discrete scenarios**
- Training uses COLORS.RED hex values matching engine convention
- Training mode: pendingTrainingPalette interception pattern in enterPeriscope()
- Training tick() gates skip all normal gameplay systems (complications, goals, cracks, heat, lights)
- TRAINING_MESSAGES as separate Record export alongside TUTORIAL_STEPS (Phase 31 system untouched)
- Console idle text shrunk from t-display (36px) to t-heading (24px) to prevent wrapping

### Known Issues

- PiecePreview NEXT/HOLD labels at 18px may be too large for 48px box — revisit layout later
- Some SVG text in Art.tsx (PROMOTION THRESHOLD at 12px, XP at 14px) not yet standardized
- Per-step piece spawning (specific sizes, autoFall, slowFall) not yet implemented — pieces come from palette queue
- Per-step crack spawning and pressure rate changes not yet active
- `goop-merged` event has 4s fallback auto-advance (no direct merge event in engine)

### Roadmap Evolution

- Milestone v1.5 shipped: Soft-body goop rendering, 4 completed phases (2026-02-08)
- Milestone v1.6 created: Progressive Tutorial, 8 phases (Phase 31-38)

---

## Session Continuity

Last session: 2026-02-08
**Version:** 1.1.13
**Branch:** feature/tutorial-infrastructure
**Build:** 237

### Resume Command
```
Phase 33 Plan 04 IN PROGRESS — UAT checkpoint active

WHAT'S DONE THIS SESSION:
- 33-04 Task 1: TrainingHUD component (phase name, dots, step counter) — fee0dd0
- 33-04 Task 2: Highlight system clip-path cutout in TutorialOverlay — e6090c7
- 33-04 Fix: Wired training messages to overlay, step advancement,
  PSI fix, double-periscope fix, pause support — ddee8ae
- Console text shrunk to t-heading to prevent wrapping

CHECKPOINT 3: Human verification of full 17-step training flow
- User testing in progress, fixing issues iteratively
- Dev server: npm run dev -- --host

/gsd:execute-plan .planning/phases/33-rank-0-training-sequence/33-04-PLAN.md
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
