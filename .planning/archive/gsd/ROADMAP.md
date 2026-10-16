---
title: Roadmap
type: roadmap
tags: [milestones, phases, progress]
updated: 2026-02-03
---

# Roadmap: Goops Complications & Progression

## Overview

Build the complication system, balance it for fair progression, add visual feedback via HUD meters, and implement the upgrade system that lets players tune difficulty over time.

## Domain Expertise

None

## Milestones

- [[v1.0-ROADMAP|v1.0 MVP]] — Phases 1-7 (shipped 2026-01-21)
- [[v1.1-ROADMAP|v1.1 Architecture Refactor]] — Phases 8-13 (shipped 2026-01-21)
- [[v1.2-ROADMAP|v1.2 Progression System]] — Phases 14-20 (shipped 2026-01-25)
- [[v1.3-ROADMAP|v1.3 Shape Changes]] — Phase 21 (shipped 2026-01-26)
- [[v1.4-ROADMAP|v1.4 Naming Standardization]] — Phases 22-24 (shipped 2026-01-27)
- ✅ **v1.5 Soft-Body Integration** — Phases 25-27.1 (shipped 2026-02-08)
- 🚧 **v1.6 Progressive Tutorial** — Phases 31-38 (in progress)

## Experimental Branch: Soft-Body Goop (SBG)

**Branch:** `soft-body-experiment`
**Status:** All prototypes complete, ready for integration planning
**Date:** 2026-01-28 to 2026-02-03

Research spike exploring soft-body physics for goop rendering. Built 5 prototypes testing different mechanics.

### Completed Prototypes

| Proto | Focus | Key Findings |
|-------|-------|--------------|
| 5b | Goo Filter | SVG feGaussianBlur + feColorMatrix = gold standard goo effect |
| 5c | Cell Walls | Inner cutout derived from outer vertices for consistent wobble |
| 6 | Fill/Pour | "Trim" approach - clip inner cutout to reveal fill from bottom |
| 7 | Merge | Dynamic blob generation, viscosity tuning, momentum transfer |
| 8 | Pop | Droplet particles, radial pressure, physics-based ready-to-pop pulse |
| 9 | Loose Goop | Support detection, cascade, corrupted shape splitting |

### Technical Findings

**Physics Parameters (Tuned Defaults):**
| Parameter | Value | Notes |
|-----------|-------|-------|
| Damping | 0.97 | High, preserves momentum |
| Stiffness | 1 | Very low, loose springs |
| Pressure | 5 | Strong volume maintenance |
| Home Stiffness | 0.3 | Shape retention without rigidity |
| Return Speed | 0.5 | Moderate return speed |
| Viscosity | 2.5 | Honey-like feel for locked blobs |

**Key Algorithms:**
- Perimeter tracing for dynamic blob generation from grid cells
- BFS connectivity detection for corrupted shape splitting
- Radial spring pressure (vertex distance from center)
- Momentum dampening (30%) on merge to prevent implosion
- Blob collision only when at least one blob is moving

**Integration Considerations:**
- Rendering layer replacement (SVG paths → soft-body physics)
- Performance budget for mobile (current protos run well)
- State sync between game logic and visual physics
- Animation timing (fill, pop, fall, merge)

---

### 🚧 v1.6 Progressive Tutorial (In Progress)

**Milestone Goal:** Build a progressive tutorial system with narrative-driven onboarding. Intercom transmissions teach mechanics through static-corrupted speech where key terms come through clearly. Multiple constrained training scenarios at rank 0 introduce mechanics one at a time. UI progressively reveals as the player ranks up.

**Narrative Foundation:** See PRD § Narrative Arc. The employer communicates via intercom (tutorial delivery). The veteran character hijacks the radio (upgrade delivery, future milestone). The operator keeps a journal (? button, player reference).

#### Phase 31: Tutorial Infrastructure

**Goal**: Intercom text system (static rendering with clear keywords), TutorialOverlay component, event bus hooks for tutorial triggers, tutorial state machine + localStorage persistence
**Depends on**: v1.5 complete
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [x] 31-01: Tutorial state machine, SaveData persistence, event bus hooks
- [x] 31-02: Intercom text rendering (garble renderer + typewriter display)
- [x] 31-03: TutorialOverlay & Game.tsx integration

#### Phase 32: Journal System

**Goal**: The ? button becomes a living "Operator Journal" — records learned mechanics from intercom transmissions. Pages unlock as player progresses. Replaces static HowToPlay
**Depends on**: Phase 31
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [x] 32-01: Journal data layer & OperatorJournal component

#### Phase 33: Rank 0 Training Sequence

**Goal**: Multiple constrained training scenarios (0TA through 0T?) with intercom-guided progression. Each teaches one concept: rotation, dropping, crack sealing, pop timing tension (scaffolding vs pressure), cylindrical wrapping, first real shift. As many levels as needed to prove out core mechanics before rank 1
**Depends on**: Phase 32 (journal records what's learned)
**Research**: Unlikely (gameplay constraints, needs design iteration)
**Plans**: 7

Plans:
- [x] 33-01: Training scenario data model & configs
- [x] 33-02: GameEngine training mode & flow controller
- [x] 33-03: Intercom scripts & journal content
- [x] 33-04: Training HUD, highlight system & verification
- [x] 33-05: Engine prerequisites (two-step crack sealing + CRACK_OFFSCREEN)
- [x] 33-06: Tutorial framework + step configs (state machine, timeout pool, handler registry)
- [ ] 33-07: Custom handlers + integration + UAT

#### Phase 34: Rank-Gated UI

**Goal**: Console panels, complication indicators, upgrade slots, ability circles — hidden until their unlock rank. Console elements glow to guide player when new things appear
**Depends on**: Phase 31 (tutorial state drives visibility)
**Research**: Unlikely (conditional rendering)
**Plans**: TBD

Plans:
- [ ] 34-01: TBD

#### Phase 35: Complication Introductions

**Goal**: Intercom warnings when LIGHTS (rank 2), LASER (rank 4), CONTROLS (rank 6) first fire. Non-blocking during gameplay. Mini-game first-time walkthrough with HUD element teaching
**Depends on**: Phase 34 (rank-gated UI reveals complication panels)
**Research**: Unlikely (reuses Phase 31 overlay)
**Plans**: TBD

Plans:
- [ ] 35-01: TBD

#### Phase 36: Upgrade & Progression Onboarding

**Goal**: First upgrade spotlight, active ability explanation, scraps introduction. Infrastructure for the veteran's radio hijack system (content TBD, delivery system built)
**Depends on**: Phase 35
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 36-01: TBD

#### Phase 37: Post-10 Progressive Hints

**Goal**: Rank-up narrative beat infrastructure. New colors (Purple@10, White@30), multi-color pieces@20, wild goop@40 — intercom + journal entries at each unlock rank. Extensible system for full 0-50 story arc
**Depends on**: Phase 36
**Research**: Unlikely (reuses overlay + journal)
**Plans**: TBD

Plans:
- [ ] 37-01: TBD

#### Phase 38: Returning Player, Polish & Testing

**Goal**: Rank-based competence inference (rank 10+ = skip basics), handle localStorage clears, "How to Play" replay in settings, skip button, edge cases (multi-rank jumps), mobile performance, test coverage
**Depends on**: Phase 37
**Research**: Unlikely (internal logic)
**Plans**: TBD

Plans:
- [ ] 38-01: TBD

---

## Completed Milestones

<details>
<summary>✅ v1.5 Soft-Body Integration (Phases 25-27.1) — SHIPPED 2026-02-08</summary>

- [x] Phase 25: Physics Foundation (2/2 plans) — completed 2026-02-03
- [x] Phase 26: Perimeter & Blob System (1/3 plans completed, 2 deferred)
- [x] Phase 26.1: Flatten Coordinate System (3/3 plans) — completed 2026-02-04
- [x] Phase 27: Active Piece Physics (1/2 plans completed, 1 deferred)
- [x] Phase 27.1: Physics-Controlled Active Piece (2/2 plans) — completed 2026-02-05

**Key accomplishments:**
- Verlet physics engine ported to game coordinate system
- Perimeter tracing and goo filter integration
- Cylindrical projection removed, flat 2D coordinate system
- Cylindrical wrapping added to physics (seam visual merge)
- Physics-controlled falling pieces (smooth, no flicker)
- Donut hole support (compound SVG paths + evenodd fill)
- Loose goop gravity ease-in (cubic ramp)
- 210 tests passing

**Deferred to future:** Phases 28-30 (locked goop behavior, pop & cascade, polish) — remaining SBG visual work can resume in a future milestone.

</details>

<details>
<summary>v1.0 MVP (Phases 1-7) — SHIPPED 2026-01-21</summary>

- [x] Phase 1: Dial Rotation (1/1 plans) — completed 2026-01-18
- [x] Phase 2: Minigame Logic (3/3 plans) — completed 2026-01-18
- [x] Phase 3: Complications (3/3 plans) — completed 2026-01-19
- [x] Phase 4: Minigame-Complication Integration (4/4 plans) — completed 2026-01-19
- [x] Phase 5: HUD & Balance (4/4 plans) — completed 2026-01-20
- [x] Phase 6: Progression System (2/2 plans) — completed 2026-01-20
- [x] Phase 7: System Upgrades (4/4 plans) — completed 2026-01-20

**Total:** 7 phases, 22 plans, 65 tests

See [[v1.0-ROADMAP]] for full details.

</details>

<details>
<summary>v1.1 Architecture Refactor (Phases 8-13) — SHIPPED 2026-01-21</summary>

- [x] Phase 8: Quick Wins & Memory Fixes (1/1 plans) — completed 2026-01-21
- [x] Phase 9: Art.tsx Decomposition (3/3 plans) — completed 2026-01-21
- [x] Phase 10: GameBoard.tsx Decomposition (3/3 plans) — completed 2026-01-21
- [x] Phase 11: GameEngine Refactor (2/2 plans) — completed 2026-01-21
- [x] Phase 12: State Management & Events (2/2 plans) — completed 2026-01-21
- [x] Phase 13: Testing & Documentation (2/2 plans) — completed 2026-01-21

**Total:** 6 phases, 13 plans, 110 tests

**Key accomplishments:**
- Art.tsx: 1,478 → 581 lines (61% reduction)
- GameBoard.tsx: 1,031 → 604 lines (41% reduction)
- GameEngine.tick(): 159 → 22 lines (86% reduction)
- Tests: 65 → 110 (69% increase)

See [[v1.1-ROADMAP]] for full details.

</details>

<details>
<summary>v1.2 Progression System (Phases 14-20) — SHIPPED 2026-01-25</summary>

- [x] Phase 14: Data Architecture (2/2 plans) — completed 2026-01-24
- [x] Phase 15: Onboarding Band (4/4 plans) — completed 2026-01-24
- [x] Phase 16: Junk Band (3/3 plans) — completed 2026-01-24
- [x] Phase 17: Mixer Band (3/3 plans) — completed 2026-01-24
- [x] Phase 18: Cracked Band (2/2 plans) — completed 2026-01-24
- [x] Phase 19: Multi-Color Pieces (3/3 plans) — completed 2026-01-24
- [x] Phase 20: Expanding Cracks Overhaul (1/1 plans) — completed 2026-01-25

**Total:** 7 phases, 18 plans, 150 tests

**Key accomplishments:**
- 20 upgrades across 4 bands (Onboarding, Junk, Mixer, Cracked)
- Active ability system with per-ability charge times
- 3 new colors: Orange@10, Purple@20, White@30
- Lights malfunction rework (player-controlled brightness)
- Multi-color pieces (different colors per cell)
- Expanding cracks overhaul (connected structures, organic growth)

See [[v1.2-ROADMAP]] for full details.

</details>

<details>
<summary>v1.3 Shape Changes (Phase 21) — SHIPPED 2026-01-26</summary>

- [x] Phase 21: Piece Shapes (3/3 plans) — completed 2026-01-26

**Total:** 1 phase, 3 plans, 10 tasks

**Key accomplishments:**
- Extended game to 75 seconds with 3 time zones
- 54 new polyomino pieces (Tetra/Penta/Hexa)
- Zone-based spawning, corruption, and mirroring

See [[v1.3-ROADMAP]] for full details.

</details>

<details>
<summary>v1.4 Naming Standardization (Phases 22-24) — SHIPPED 2026-01-27</summary>

- [x] Phase 22: Audit & Glossary (1/1 plans) — completed 2026-01-27
- [x] Phase 23: Code Rename (7/7 plans) — completed 2026-01-27
- [x] Phase 24: UI & Documentation (1/1 plans) — completed 2026-01-27

**Total:** 3 phases, 9 plans, 43 commits

**Key accomplishments:**
- Official terminology glossary with 9 core categories
- 50+ variable/type/function renames across 62 files
- Tank, Goop, Operator terminology standardization
- All UI text aligned with official terms

See [[v1.4-ROADMAP]] for full details.

</details>

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Dial Rotation | v1.0 | 1/1 | Complete | 2026-01-18 |
| 2. Minigame Logic | v1.0 | 3/3 | Complete | 2026-01-18 |
| 3. Complications | v1.0 | 3/3 | Complete | 2026-01-19 |
| 4. Minigame-Complication Integration | v1.0 | 4/4 | Complete | 2026-01-19 |
| 5. HUD & Balance | v1.0 | 4/4 | Complete | 2026-01-20 |
| 6. Progression System | v1.0 | 2/2 | Complete | 2026-01-20 |
| 7. System Upgrades | v1.0 | 4/4 | Complete | 2026-01-20 |
| 8. Quick Wins & Memory Fixes | v1.1 | 1/1 | Complete | 2026-01-21 |
| 9. Art.tsx Decomposition | v1.1 | 3/3 | Complete | 2026-01-21 |
| 10. GameBoard.tsx Decomposition | v1.1 | 3/3 | Complete | 2026-01-21 |
| 11. GameEngine Refactor | v1.1 | 2/2 | Complete | 2026-01-21 |
| 12. State Management & Events | v1.1 | 2/2 | Complete | 2026-01-21 |
| 13. Testing & Documentation | v1.1 | 2/2 | Complete | 2026-01-21 |
| 14. Data Architecture | v1.2 | 2/2 | Complete | 2026-01-24 |
| 15. Onboarding Band | v1.2 | 4/4 | Complete | 2026-01-24 |
| 16. Junk Band | v1.2 | 3/3 | Complete | 2026-01-24 |
| 17. Mixer Band | v1.2 | 3/3 | Complete | 2026-01-24 |
| 18. Cracked Band | v1.2 | 2/2 | Complete | 2026-01-24 |
| 19. Multi-Color Pieces | v1.2 | 3/3 | Complete | 2026-01-24 |
| 20. Expanding Cracks Overhaul | v1.2 | 1/1 | Complete | 2026-01-25 |
| 21. Piece Shapes | v1.3 | 3/3 | Shipped | 2026-01-26 |
| 22. Audit & Glossary | v1.4 | 1/1 | Shipped | 2026-01-27 |
| 23. Code Rename | v1.4 | 7/7 | Shipped | 2026-01-27 |
| 24. UI & Documentation | v1.4 | 1/1 | Shipped | 2026-01-27 |
| 25. Physics Foundation | v1.5 | 2/2 | Complete | 2026-02-03 |
| 26. Perimeter & Blob System | v1.5 | 1/3 | Shipped (2 deferred) | 2026-02-08 |
| 26.1 Flatten Coordinate System | v1.5 | 3/3 | Complete | 2026-02-04 |
| 27. Active Piece Physics | v1.5 | 1/2 | Shipped (1 deferred) | 2026-02-05 |
| 27.1 Physics-Controlled Active Piece | v1.5 | 2/2 | Complete | 2026-02-05 |
| 28-30. Locked Goop / Pop / Polish | v1.5 | — | Deferred | - |
| 31. Tutorial Infrastructure | v1.6 | 3/3 | Complete | 2026-02-08 |
| 32. Journal System | v1.6 | 1/1 | Complete | 2026-02-08 |
| 33. Rank 0 Training Sequence | v1.6 | 6/7 | In progress | - |
| 34. Rank-Gated UI | v1.6 | 0/? | Not started | - |
| 35. Complication Introductions | v1.6 | 0/? | Not started | - |
| 36. Upgrade & Progression Onboarding | v1.6 | 0/? | Not started | - |
| 37. Post-10 Progressive Hints | v1.6 | 0/? | Not started | - |
| 38. Returning Player, Polish & Testing | v1.6 | 0/? | Not started | - |

## Related

- [[HOME]] - Navigation hub
- [[STATE]] - Current position
- [[PROJECT]] - Project definition
