---
title: Roadmap
type: roadmap
tags: [milestones, phases, progress]
updated: 2026-01-26
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
- 🚧 **v1.4 Naming Standardization** — Phases 22-24 (in progress)

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

---

### 🚧 v1.4 Naming Standardization (In Progress)

**Milestone Goal:** Clean up terminology inconsistencies and establish official naming conventions throughout the codebase.

#### Phase 22: Audit & Glossary

**Goal**: Catalog all naming inconsistencies across codebase, create official glossary document
**Depends on**: v1.3 complete
**Research**: Unlikely (internal analysis)
**Plans**: TBD

Plans:
- [ ] 22-01: TBD (run /gsd:plan-phase 22 to break down)

#### Phase 23: Code Rename

**Goal**: Apply glossary throughout codebase — rename variables, functions, comments
**Depends on**: Phase 22
**Research**: Unlikely (refactoring, established patterns)
**Plans**: TBD

Plans:
- [ ] 23-01: TBD

#### Phase 24: UI & Documentation

**Goal**: Update user-facing text and documentation to use official terms
**Depends on**: Phase 23
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 24-01: TBD

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
| 22. Audit & Glossary | v1.4 | 0/? | Not started | - |
| 23. Code Rename | v1.4 | 0/? | Not started | - |
| 24. UI & Documentation | v1.4 | 0/? | Not started | - |

## Related

- [[HOME]] - Navigation hub
- [[STATE]] - Current position
- [[PROJECT]] - Project definition
