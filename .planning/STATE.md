---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-08
---

# Project State

## Current Position

Phase: 31 of 38 (Tutorial Infrastructure)
Plan: Not started
Status: Ready to plan
Last activity: 2026-02-08 - Milestone v1.6 Progressive Tutorial created

Progress: ░░░░░░░░░░ 0%

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- None (v1.5 shipped to master)

## Next Steps

### What was done THIS session:

1. **v1.5 shipped as-is** — Soft-body integration shipped with phases 25-27.1 complete. Phases 28-30 deferred to future milestone.
2. **v1.6 milestone created** — Progressive Tutorial, 8 phases (31-38)
3. **PRD narrative section added** — Full story arc documented: employer exploitation theme, intercom system, veteran character, brain-in-liquid reveal, rank titles
4. **Research completed** — Progressive tutorial design patterns, cross-game analysis (Candy Crush, Hades, Into the Breach, The Witness, Puyo Puyo, Baba Is You, Tetris Effect), visual style direction (Lethal Company + Uncle Chop's Rocket Shop)

### Key Design Decisions (v1.6):

- **Intercom system** — employer speaks through static-corrupted PA. Key tutorial terms come through clearly, flavor words are garbled. Brilliant dual-purpose: teaches mechanics AND establishes grungy world.
- **Multiple rank 0 training levels** — 0TA, 0TB, 0TC, etc. As many as needed. Each teaches one concept through constrained play.
- **The aha moment** — pop timing tension (pop too early = lose scaffolding to reach cracks; pop too late = pressure maxes). NOT the cylinder wrap.
- **Journal (? button)** — living reference that grows. Player writes down what they learn from transmissions.
- **Rank-gated UI** — console elements hidden until their unlock rank. Glow when new.
- **Multi-modal delivery** — intercom pop-ups, HUD hints, console glow, journal entries
- **8 words max per instruction** — keep it brief
- **Max 1 tooltip per game** — non-blocking during gameplay
- **Rank IS the tutorial gate** — no separate tutorial progression

### Known Issues

- None currently

### Decisions Made

- v1.5 shipped with deferred phases (28-30 can be a future milestone)
- Tutorial visual style: grungy low-tech (Lethal Company meets Uncle Chop), not scan-lines (performance issues). "Maintenance order" tooltip style.
- Story theme: modern indentured servitude, employer appears benign but is exploitative
- The veteran character provides upgrades (radio hijack system, content TBD)
- Full story arc is PRD-documented but most content is future milestone scope

### Roadmap Evolution

- Milestone v1.5 shipped: Soft-body goop rendering, 4 completed phases (2026-02-08)
- Milestone v1.6 created: Progressive Tutorial, 8 phases (Phase 31-38)

---

## Session Continuity

Last session: 2026-02-08
**Version:** 1.1.13
**Branch:** master
**Build:** 224

### Resume Command
```
v1.6 MILESTONE CREATED — Progressive Tutorial (8 phases, 31-38)

RESEARCH COMPLETED:
- Progressive tutorial patterns (cross-game analysis)
- Player flow & trigger points (codebase analysis)
- Visual style direction (Lethal Company + Uncle Chop)
- PRD narrative arc documented

NEXT: /gsd:plan-phase 31 (Tutorial Infrastructure)
- Intercom text system with static rendering
- TutorialOverlay component
- Tutorial state machine + localStorage
- Event bus hooks for triggers

/clear first → fresh context window
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
