---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-06
---

# Project State

## Current Position

Phase: 27.1 Physics-Controlled Active Piece
Plan: MASTER-PLAN complete (9/9 tasks) — ALL BUGS FIXED + getGhostY safety net
Status: Deployed — soft body physics + dev piece picker tool
Last activity: 2026-02-07 - Dev piece picker panel (~) with repeat mode and debug toggles
Branch: `soft-body-experiment` (merged to master for deploy)

Progress: █████████░ ~90% (core physics working, deployed, falling blob tendrils still TODO)

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

1. **Dev piece picker panel** — New `~` key toggles a left-side dev panel showing all 54 pieces organized by Tetra/Penta/Hexa (normal + corrupted), with color selector respecting rank-locked colors.
2. **Random Pieces toggle** — Checkbox (default: on). When unchecked, clicking a piece repeats it every spawn via `engine.devOverrideNextGoop`.
3. **Moved debug checkboxes** — Show Vertices, Freeze Timer, Freeze Falling moved from physics panel (`) to piece picker panel (~).

### Files modified (this session):

- `Game.tsx` — Piece picker panel, state, key handler, moved checkboxes
- `core/GameEngine.ts` — `devOverrideNextGoop` property + override in `spawnGoop()`

### Known Issues

- **Falling blob tendrils not rendered** — tendrils only render for locked blobs, not falling blobs (next task)
- Physics "looseness" could be tuned (blobs are a bit wobbly)

### Decisions Made

- Goo filter defaults: stdDeviation=8, alphaMul=24, alphaOff=-13 (user-tuned)
- All physics params confirmed at defaults (user saved snapshot matches)
- `homeStiffness` is the right param for anchoring against attraction pull (not returnSpeed/viscosity)
- Tendrils must be inside goo filter groups to get the smooth Proto 9 look

---

## Session Continuity

Last session: 2026-02-07
**Version:** 1.1.13
**Branch:** soft-body-experiment (deployed to master)
**Build:** 218

### Resume Command
```
DEPLOYED — Dev piece picker panel + soft body physics live on GitHub Pages.

SESSION ACCOMPLISHMENTS:
- Dev piece picker panel (~ key) with all 54 pieces, color selector, rank-locked colors
- Random Pieces toggle (uncheck = selected piece repeats every spawn)
- Moved debug checkboxes (vertices, freeze timer/falling) from physics to picker panel
- 210 tests, all passing
- Deployed to production

REMAINING WORK:
- Add tendril rendering to falling blobs section in GameBoard.tsx (~line 997-1034)
- Tendrils must go INSIDE the falling blobs' goo filter group
- Filter springs where at least one blob is falling
- Physics looseness tuning

Next: Implement falling blob tendrils in GameBoard.tsx
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
