---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-10
---

# Project State

## Current Position

Phase: 33 of 38 (Rank 0 Training Sequence)
Plan: 4 of 4 in current phase — FIX plan, UAT round 5 in progress
Status: In progress — A & B approved, C-phase mostly approved (C1/C1B/C1C), testing C2+ and D-F
Last activity: 2026-02-10 - Major C-phase overhaul: pressure color filter, per-blob shake, piece shape system

Progress: █████░░░░░ 50%

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `feature/tutorial-infrastructure` (Phase 31 complete, Phase 32 complete, Phase 33 in progress)

## Next Steps

UAT round 5: Continue testing C-F phases.
- A-phase (A1, A2): APPROVED
- B-phase (B1, B1B, B2, B3, B4): APPROVED — single-fall flow, shape system, practice step
- C-phase (C1, C1B, C1C): APPROVED — pressure flow, yellow highlight/pulse, per-blob shake, pop gating
- C-phase (C2, C3): NEEDS TESTING — merge message (1s delay), fill timing
- D-phase (D1, D2, D3): NEEDS TESTING
- E-phase (E1): NEEDS TESTING
- F-phase (F1, F2): NEEDS TESTING

After full verification: create 33-04-FIX SUMMARY, update ROADMAP, metadata commit.

### Key Technical Changes This Session

**PieceSpawn Refactor (types/training.ts, useTrainingFlow.ts)**
- Replaced `size: number` with `shape: GoopShape` + optional `rotation: number`
- Spawn logic now finds actual shape templates from TETRA_NORMAL/PENTA_NORMAL/HEXA_NORMAL
- Applies rotation via `getRotatedCells()` for initial orientation
- B1: blue T_I horizontal (rotation:1), B3: yellow T_T, B4: blue T_O (2x2), D2: green T_O

**Per-Blob Shake (GameBoard.tsx)**
- Removed per-color-group shake (was shaking ALL blobs of same color)
- Added `isBlobShaking = blob.id === shakingGroupId` check on each blob's `<g>` in both goo-filter and cutout sections
- Each blob shakes independently when rejected

**Training Input Gating (useInputHandlers.ts, GameBoard.tsx, Game.tsx)**
- `disableSwap`: Skips hold interval entirely (no radial graphic, no swap event)
- `disablePop`: All goop taps trigger shake+rejection when `AllowedControls.pop===false`
- `trainingHighlightColor`: Wrong-color taps trigger shake+rejection
- All three passed as props: Game.tsx → GameBoard → useInputHandlers

**Pressure Color Filter (useTrainingFlow.ts, types/training.ts)**
- New `advancePressureAboveColor` StepSetup field
- When set, pressure-above-pieces poll only checks cells of that color
- C1B uses `COLORS.YELLOW` — triggers when pressure covers yellow T, not all blues

**Highlight System (GameEngine.ts, useTrainingFlow.ts, GameBoard.tsx, actions.ts)**
- `trainingHighlightColor` on GameEngine + returned from useTrainingFlow
- CSS `training-pulse` animation: scale 1→1.06 with `transform-box: fill-box`
- Pop color restriction in PopGoopCommand: rejects pops of non-matching color
- C1C highlights YELLOW (pop yellow → C2 shows blue merge + solidify timing)

**B-Phase Single-Fall Flow (trainingScenarios.ts)**
- All 3 messages during SAME first piece fall: B1 (goop intro) → B1B at 25% → B2 at 40%
- B2: no separate piece spawn, no reshow, pauseGame:false, fast-drop enabled mid-fall
- B4_PRACTICE: new step after B3, spawns blue 2x2, "Practice what you've learned"
- 16 total steps across 6 phases

### Decisions Made

- Typography: 18px minimum body, CSS classes with !important, full project sweep
- Journal layout: accordion (single column) over sidebar+content (two column)
- TEXT_MANIFEST.md as editable text source-of-truth
- Garble system: bracket notation, no partial corruption
- Training mode: pendingTrainingPalette interception, tick gates, freezeFalling
- Advance arming prevents dismiss-tap from triggering advance
- B2 keywords: "down" and "press" are white, not green
- C-phase: pop yellow (not blue) → demonstrates merge + solidify timing with blue-on-blue

### Known Issues

- PiecePreview NEXT/HOLD labels at 18px may be too large for 48px box
- Some SVG text in Art.tsx not yet standardized
- Per-step crack spawning not yet active

### Roadmap Evolution

- Milestone v1.5 shipped: Soft-body goop rendering, 4 completed phases (2026-02-08)
- Milestone v1.6 created: Progressive Tutorial, 8 phases (Phase 31-38)

---

## Session Continuity

Last session: 2026-02-10
**Version:** 1.1.13
**Branch:** feature/tutorial-infrastructure
**Build:** 250

### Resume Command
```
Phase 33 Plan 04-FIX — UAT round 5

A & B phases APPROVED. C1/C1B/C1C APPROVED. Testing C2+ and D-F.

KEY SYSTEMS IMPLEMENTED:
- PieceSpawn uses GoopShape templates (not size). Rotation supported.
- Per-blob shake (not per-color). disableSwap, disablePop, highlightColor gating.
- advancePressureAboveColor filters pressure check by goop color.
- 16 steps across 6 phases (B4_PRACTICE added).

WHAT TO DO:
1. Start dev server: npm run dev -- --host
2. Clear localStorage, reload at rank 0
3. Test C2 (merge after popping yellow, 1s delay), C3 (fill timing)
4. Test D-phase: D1 (crack), D2 (tank rotation), D3 (offscreen)
5. Test E-phase: E1 (scaffolding)
6. Test F-phase: F1 (cleanup), F2 (practice until game over)
7. After full approval: 33-04-FIX SUMMARY, ROADMAP, metadata commit
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
