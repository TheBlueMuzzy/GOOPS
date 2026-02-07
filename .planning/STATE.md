---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-06
---

# Project State

## Current Position

Phase: 27.1 Physics-Controlled Active Piece
Plan: MASTER-PLAN complete (9/9 tasks) — ALL BUGS FIXED
Status: Tendril rendering partially fixed, falling blob tendrils still TODO
Last activity: 2026-02-06 - Tendril goo filter fix + physics param research
Branch: `soft-body-experiment`

Progress: ████████░░ ~85% (core physics working, tendril polish in progress)

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `soft-body-experiment` — Soft Body Goop (SBG) integration (v1.5 milestone)

## Next Steps

### TODO: Add tendrils to falling blobs

**The problem:** Tendrils (attraction spring beads) only render for locked blobs, not falling blobs.

**Root cause:** In `GameBoard.tsx`, `blobsByColor` is built with `if (blob.isFalling) continue;`, so falling blobs don't get a per-color goo filter group. Tendrils are rendered inside these per-color groups, so falling blob tendrils are invisible.

**What needs to happen:**
- In the falling blobs rendering section (~line 997-1034 of GameBoard.tsx), add tendril rendering for springs that involve falling blobs
- Tendrils must be INSIDE the `<g filter="url(#goo-filter)">` group so the goo filter merges the bead dots into smooth strands
- Filter springs where at least one blob is falling AND matches the color being rendered
- The tendril bead code is identical to what's in the locked blob section (lines ~878-912)

**Physics note:** `updateAttractionSprings()` in `core/softBody/physics.ts` does NOT filter by isFalling — springs CAN connect falling↔locked and falling↔falling blobs. The rendering just doesn't show them.

**Reference:** Proto 9 (`prototypes/SoftBodyProto9.tsx`) rendered everything in ONE goo filter group. Current code splits by locked/falling. Need tendrils in both.

### What was done THIS session:

1. **Fixed tendril rendering** — Moved tendrils from outside goo filter to INSIDE per-color goo filter groups (matching Proto 9). Tendrils now blur together into smooth gooey strands instead of showing as individual dots.
2. **Researched physics params** — `homeStiffness` (0.01) is the correct param for anchoring blobs against attraction spring pull, not returnSpeed/viscosity. User's current param values match all defaults.
3. **Added debug features (prior session)** — freezeTimer, freezeFalling checkboxes, save params snapshot button in Game.tsx
4. **Exposed attractionSprings + params** from useSoftBodyPhysics hook for rendering

### Files modified (uncommitted on soft-body-experiment):

- `Game.tsx` — Debug panel: freeze checkboxes, save snapshot button, goo filter sliders
- `components/GameBoard.tsx` — Tendril rendering moved inside goo filter groups (THE KEY FIX)
- `core/GameEngine.ts` — freezeTimer/freezeFalling debug flags
- `core/softBody/types.ts` — wallThickness: 4.8 → 8
- `hooks/useSoftBodyPhysics.ts` — Exposed attractionSprings + params from hook return
- `tests/softBody.test.ts` — Updated wallThickness expectation to 8

### Known Issues

- **Falling blob tendrils not rendered** (described above — next task)
- Physics "looseness" could be tuned (blobs are a bit wobbly)

### Decisions Made

- Goo filter defaults: stdDeviation=8, alphaMul=24, alphaOff=-13 (user-tuned)
- All physics params confirmed at defaults (user saved snapshot matches)
- `homeStiffness` is the right param for anchoring against attraction pull (not returnSpeed/viscosity)
- Tendrils must be inside goo filter groups to get the smooth Proto 9 look

---

## Session Continuity

Last session: 2026-02-06
**Version:** 1.1.13
**Branch:** soft-body-experiment
**Build:** 208

### Resume Command
```
TENDRIL FIX IN PROGRESS — Locked blob tendrils fixed, falling blob tendrils TODO.

SESSION ACCOMPLISHMENTS:
- Moved tendril rendering inside per-color goo filter groups (Proto 9 style)
- Removed standalone unfiltered tendril block
- Researched homeStiffness vs returnSpeed/viscosity for blob anchoring
- All physics params confirmed matching defaults

REMAINING WORK:
- Add tendril rendering to falling blobs section in GameBoard.tsx (~line 997-1034)
- Tendrils must go INSIDE the falling blobs' goo filter group
- Filter springs where at least one blob is falling
- Use same bead rendering code as locked blob tendrils

FILES MODIFIED (uncommitted):
- Game.tsx (debug panel enhancements)
- components/GameBoard.tsx (tendril goo filter fix — KEY FILE)
- core/GameEngine.ts (freeze debug flags)
- core/softBody/types.ts (wallThickness 4.8→8)
- hooks/useSoftBodyPhysics.ts (exposed attractionSprings + params)
- tests/softBody.test.ts (wallThickness expectation)

Next: Implement falling blob tendrils in GameBoard.tsx
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
