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
Status: Deployed — soft body physics, tendril rendering, ghost Y overshoot fix all live
Last activity: 2026-02-07 - getGhostY safety net for physics overshoot piece overwrite bug
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

1. **getGhostY safety net** — Added upward retreat loop so `getGhostY` self-heals when physics overshoot places a piece inside occupied cells. Prevents the piece overwrite bug during fast-drop with physics-controlled falling.
2. **Added 3 new getGhostY tests** — Normal landing, overshoot retreat, and floor landing cases.
3. **Prior sessions:** Tendril goo filter fix, physics param research, debug features, soft body integration.

### Files modified (this session):

- `utils/gameLogic.ts` — `getGhostY` upward retreat safety net
- `tests/gameLogic.test.ts` — 3 new `getGhostY` tests (210 total)

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
**Build:** 215

### Resume Command
```
DEPLOYED — Soft body physics + getGhostY safety net live on GitHub Pages.

SESSION ACCOMPLISHMENTS:
- Added getGhostY upward retreat to prevent piece overwrite on physics overshoot
- 3 new tests (210 total), all passing
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
