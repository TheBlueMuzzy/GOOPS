---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-10
---

# Project State

## Current Position

Phase: 33 of 38 (Rank 0 Training Sequence)
Plan: 4 of 4 in current phase — FIX plan, UAT round 4 in progress
Status: In progress — fixing UAT issues from round 3
Last activity: 2026-02-10 - UAT round 3 partial (steps 1-9 pass, step 10+ fixing)

Progress: ████░░░░░░ 35%

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `feature/tutorial-infrastructure` (Phase 31 complete, Phase 32 complete, Phase 33 in progress)

## Next Steps

UAT round 3 found issues. Fixes applied (uncommitted). Need UAT round 4 verification:
- Steps 1-9 already passed
- Step 10+ needs re-testing (B2 fast-drop advance was firing immediately on dismiss)
- Also fixed: training piece spawning, garble renderer, interaction blocking

After full verification: commit fixes, create SUMMARY, update ROADMAP, metadata commit.

### Decisions Made

- Typography: 18px minimum body, CSS classes with !important, full project sweep
- Journal layout: accordion (single column) over sidebar+content (two column)
- TEXT_MANIFEST.md as editable text source-of-truth
- **Training: 15 steps, 6 phases (A-F) — B1B now post-landing tap step (not mid-fall)**
- **Garble system: bracket notation `[text]` = full-word garble, no brackets = clear, keywords = green. NO partial/random corruption.**
- **Garble chars: Unicode block elements (░▒▓█▌▐■▬▮▪), slate-500 color**
- Training uses COLORS.RED hex values matching engine convention
- Training mode: pendingTrainingPalette interception pattern in enterPeriscope()
- Training tick() gates skip all normal gameplay systems
- **freezeFalling used alongside isPaused** — isPaused only stops tick, freezeFalling stops physics
- **Periscope pulse (CSS scale+glow) replaces broken highlight cutout overlay**
- **Training piece spawning: engine does NOT auto-spawn in training mode. Each step's spawnPiece config triggers explicit spawn via useTrainingFlow.**
- **Advance arming: event listeners disarmed until message dismissed (prevents dismiss-tap from triggering advance)**
- **Overlay blockInteraction: pauseGame:true steps show dark scrim + block all touches until message closed**
- `goop-merged` advance maps to PIECE_DROPPED (merge happens on landing)
- `game-over` advance maps to GAME_OVER (for F2 practice mode)

### Known Issues

- PiecePreview NEXT/HOLD labels at 18px may be too large for 48px box — revisit layout later
- Some SVG text in Art.tsx (PROMOTION THRESHOLD at 12px, XP at 14px) not yet standardized
- Per-step crack spawning not yet active

### Roadmap Evolution

- Milestone v1.5 shipped: Soft-body goop rendering, 4 completed phases (2026-02-08)
- Milestone v1.6 created: Progressive Tutorial, 8 phases (Phase 31-38)

---

## Session Continuity

Last session: 2026-02-10
**Version:** 1.1.13
**Branch:** feature/tutorial-infrastructure
**Build:** 244

### Resume Command
```
Phase 33 Plan 04-FIX — UAT round 4 needed

EXECUTE: /gsd:execute-plan .planning/phases/33-rank-0-training-sequence/33-04-FIX.md

CHANGES THIS SESSION (uncommitted, 7 files modified):
- IntercomText.tsx: Garble fixed — brackets = full garble, removed 70/15/15 random model
- useTrainingFlow.ts: Advance arming (disarmed until dismiss), explicit piece spawning from step setup
- TutorialOverlay.tsx: blockInteraction prop — dark scrim + pointer-events-auto for paused steps
- IntercomMessage.tsx: Dismiss button green outline when in dismiss-only mode
- GameEngine.ts: lockActivePiece() no auto-spawn in training, startTraining() no initial spawn
- trainingScenarios.ts: B1 advance=piece-landed, B1B=pauseGame:true+tap (was mid-fall event)
- Game.tsx: Pass blockInteraction prop to TutorialOverlay

UAT ROUND 3 STATUS:
- Steps 1-9: PASSED
- Step 10+: Needs re-testing after fixes

WHAT TO DO:
1. Start dev server: npm run dev -- --host
2. Clear localStorage, reload at rank 0
3. Verify steps 1-9 still pass (no regression)
4. Verify step 10+ (B2 dismiss doesn't auto-advance, B-phase piece flow works)
5. Continue through rest of UAT checklist
6. After approval: commit all fixes, SUMMARY, ROADMAP update, metadata commit
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
