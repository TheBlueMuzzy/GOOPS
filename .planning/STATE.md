---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-09
---

# Project State

## Current Position

Phase: 33 of 38 (Rank 0 Training Sequence)
Plan: 4 of 4 in current phase (IN PROGRESS — UAT round 2)
Status: In progress
Last activity: 2026-02-09 - Fixed freeze-falling, periscope pulse, B1B slow comment

Progress: ████░░░░░░ 35%

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `feature/tutorial-infrastructure` (Phase 31 complete, Phase 32 complete, Phase 33 in progress)

## Next Steps

UAT round 2 in progress. User testing through B1→B1B→B2 flow and beyond.

### Decisions Made

- Typography: 18px minimum body, CSS classes with !important, full project sweep
- Journal layout: accordion (single column) over sidebar+content (two column)
- TEXT_MANIFEST.md as editable text source-of-truth
- **Training: 15 steps, 6 phases (A-F) — added B1B "Yeah. It's slow." mid-fall**
- **Garble system: bracket notation `[text]` in fullText for explicit garble control**
- **Garble chars: Unicode block elements (░▒▓█▌▐■▬▮▪), 100% letter replacement, slate-500 color**
- Training uses COLORS.RED hex values matching engine convention
- Training mode: pendingTrainingPalette interception pattern in enterPeriscope()
- Training tick() gates skip all normal gameplay systems
- **freezeFalling used alongside isPaused** — isPaused only stops tick, freezeFalling stops physics
- **Periscope pulse (CSS scale+glow) replaces broken highlight cutout overlay**
- **pauseGame: false steps don't freeze on transition, show message immediately**
- **showWhenPieceBelow: position-gated message display (polls activeGoop.y every 200ms)**
- `goop-merged` advance maps to PIECE_DROPPED (merge happens on landing)
- `game-over` advance maps to GAME_OVER (for F2 practice mode)

### Known Issues

- PiecePreview NEXT/HOLD labels at 18px may be too large for 48px box — revisit layout later
- Some SVG text in Art.tsx (PROMOTION THRESHOLD at 12px, XP at 14px) not yet standardized
- Per-step piece spawning (specific sizes, autoFall, slowFall) not yet implemented — pieces come from palette queue
- Per-step crack spawning not yet active

### Roadmap Evolution

- Milestone v1.5 shipped: Soft-body goop rendering, 4 completed phases (2026-02-08)
- Milestone v1.6 created: Progressive Tutorial, 8 phases (Phase 31-38)

---

## Session Continuity

Last session: 2026-02-09
**Version:** 1.1.13
**Branch:** feature/tutorial-infrastructure
**Build:** 243

### Resume Command
```
Phase 33 Plan 04 IN PROGRESS — UAT round 2

WHAT'S DONE THIS SESSION:
- freezeFalling fix: pieces actually stop during training pauses
- Periscope pulse animation (CSS scale+glow, standalone scale prop)
- B1B "Yeah. It's slow." step: position-gated (showWhenPieceBelow: 12)
- B1 changed to tap advance (player dismisses manually)
- pauseGame-aware transitions (false = don't freeze, show immediately)
- advanceType prop (tap-only ✓ or dismiss-only ✗ buttons)
- Block periscope during briefing, block console exit during training
- HowToPlay → OperatorJournal swap in App.tsx

UAT: User testing B1→B1B→B2 flow. Continue verifying remaining steps.
Dev server: npm run dev -- --host
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
