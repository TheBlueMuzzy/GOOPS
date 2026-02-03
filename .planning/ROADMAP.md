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
- 🚧 **v1.5 Soft-Body Integration** — Phases 25-30 (in progress)

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

### 🚧 v1.5 Soft-Body Integration (In Progress)

**Milestone Goal:** Port soft-body physics visuals from prototypes into main game rendering, replacing static grid cells with deformable, gooey blobs.

#### Phase 25: Physics Foundation

**Goal**: Port Verlet physics engine and adapt to game coordinate system
**Depends on**: Prototype research complete
**Research**: Likely (cylindrical projection implications)
**Research topics**: How to apply cylindrical transform to physics vertices, or whether to flatten rendering
**Plans**: TBD

Plans:
- [x] 25-01: Physics types and Verlet engine (completed 2026-02-03)
- [x] 25-02: Blob factory and integration hook (completed 2026-02-03)

#### Phase 26: Perimeter & Blob System

**Goal**: Replace goopGroupId rect rendering with perimeter-traced soft-body blobs
**Depends on**: Phase 25
**Research**: Unlikely (Proto-7 has perimeter tracing algorithm)
**Plans**: TBD

Plans:
- [ ] 26-01: TBD

#### Phase 27: Active Piece Physics

**Goal**: Falling pieces use soft-body physics (snappy, no viscosity)
**Depends on**: Phase 26
**Research**: Unlikely (Proto-7 solved falling piece physics)
**Plans**: TBD

Plans:
- [ ] 27-01: TBD

#### Phase 28: Locked Goop Behavior

**Goal**: Viscosity, fill animation, ready-to-pop impulse, attraction springs
**Depends on**: Phase 27
**Research**: Unlikely (Protos 6-8 have all mechanics)
**Plans**: TBD

Plans:
- [ ] 28-01: TBD

#### Phase 29: Pop & Cascade

**Goal**: Pop effects with droplets, support detection, loose goop, corrupted splitting
**Depends on**: Phase 28
**Research**: Unlikely (Protos 8-9 have all mechanics)
**Plans**: TBD

Plans:
- [ ] 29-01: TBD

#### Phase 30: Polish & Performance

**Goal**: Mobile optimization, parameter tuning, edge case handling
**Depends on**: Phase 29
**Research**: Likely (mobile profiling, edge cases with dump pieces/wild goop/cracks)
**Research topics**: React performance profiling, requestAnimationFrame timing, mobile throttling
**Plans**: TBD

Plans:
- [ ] 30-01: TBD

---

## Completed Milestones

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
| 26. Perimeter & Blob System | v1.5 | 0/? | Not started | - |
| 27. Active Piece Physics | v1.5 | 0/? | Not started | - |
| 28. Locked Goop Behavior | v1.5 | 0/? | Not started | - |
| 29. Pop & Cascade | v1.5 | 0/? | Not started | - |
| 30. Polish & Performance | v1.5 | 0/? | Not started | - |

## Related

- [[HOME]] - Navigation hub
- [[STATE]] - Current position
- [[PROJECT]] - Project definition
