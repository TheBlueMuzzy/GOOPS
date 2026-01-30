---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-01-30
---

# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `soft-body-experiment` — Soft Body Goop (SBG) visual overhaul (RESEARCH COMPLETE)

## Next Steps

**Current:** Soft Body Goop prototype implementation
**Status:** RESEARCH COMPLETE — Ready for Phase 1 prototyping
**Branch:** `soft-body-experiment`

**Vision + Research document:** `.planning/SOFTBODY-VISION.md` — READ THIS FIRST!

### Research Findings Summary (2026-01-30)

**Physics:**
- Verlet integration + mass-spring system
- Damping ratio ζ=0.6 for gummy feel
- 12 vertices per cell, ring + cross springs + pressure

**Rendering:**
- Catmull-Rom → Bezier conversion for smooth curves
- SVG gooey filter for membrane merge effect
- Formula: `cp1 = P1 + (P2-P0)/6`, `cp2 = P2 - (P3-P1)/6`

**Attraction (SPRINGS WIN over fields):**
- Explicit vertex-to-vertex springs for "reaching" effect
- Spatial hashing for performance (432 vertices)
- Rest length ~10px for "merged" appearance

### Implementation Roadmap

1. **Phase 1:** Single cell — 12 Verlet vertices, springs, pressure, Catmull-Rom rendering
2. **Phase 2:** Cell follows data layer — spring to "home" position, test rotation/collision
3. **Phase 3:** Inter-cell attraction — spatial hashing, same-color springs
4. **Phase 4:** Visual polish — goo filter, undulation, ghost piece mode

**Resume command:**
```
Start soft-body prototype. Read .planning/SOFTBODY-VISION.md for full research.
Branch: soft-body-experiment
Phase: 1 — Single cell with 12 Verlet vertices
```

**Previous work (2026-01-28):**
- Win bonus rework complete, deployed to master

## Future Plans

See **`.planning/PRD.md` → Future Ideas** for the full list of planned features.

Current priorities:
- Pressure venting visual (visual polish)
- Tutorial system (onboarding)

---

## Project Reference

See: [[PROJECT]] (updated 2026-01-27)

**Core value:** The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.
**Current focus:** v1.4 shipped — ready for next milestone planning

## Current Position

Phase: 28 of 28 (Dynamic Text Updates) — SHIPPED
Plan: All plans complete
Status: v1.5 MILESTONE SHIPPED
Last activity: 2026-01-27 — Deployed v1.5

Progress: ██████████ 100% (v1.5 Visual Terminology & Grade System) — SHIPPED

## What's Done

### v1.4 Naming Standardization (Shipped 2026-01-27)

Codebase terminology cleanup with official glossary.

Key features:
- Official GLOSSARY.md with 9 core term categories
- 50+ variable/type/function renames across 62 files
- Core: GoopShape, GoopTemplate, TankCell, tankRotation
- Progression: sessionXP, operatorRank, scraps
- All UI text aligned with official terminology

See [[v1.4-ROADMAP]] for full details.

### v1.3 Shape Changes (Shipped 2026-01-26)

Extended game with progressive piece sizes and 54 new polyomino shapes.

Key features:
- 75-second game with 3 zones (Tetra → Penta → Hexa)
- 54 pieces: 10 Tetra + 22 Penta + 22 Hexa
- 15% corruption, 50% mirror for variety
- Zone-based spawning by elapsed time

See [[v1.3-ROADMAP]] for full details.

### v1.2 Progression System (Shipped 2026-01-24)

Full ranks 0-39 progression with 4 bands, 20 upgrades, and 3 new colors.

Key features:
- 20 upgrades across passive/active/feature types
- Active ability system with per-ability charge times
- Lights malfunction rework (player-controlled brightness)
- Expanding cracks mechanic
- Colors: Purple@10, White@30, Black@50, Wild@40+ (Orange removed)

See [[v1.2-ROADMAP]] for full details.

### v1.1 Architecture Refactor (Shipped 2026-01-21)

All 6 phases (8-13) complete. See [[v1.1-ROADMAP]] for full details.

### v1.0 MVP (Shipped 2026-01-21)

All 7 phases complete. See [[v1.0-ROADMAP]] for full details.

## Accumulated Context

### Balance Summary (Current v1.2.0)

| Complication | Trigger | Player Mitigation |
|--------------|---------|-------------------|
| Laser | Capacitor drains on pop | +10% refill on piece lock |
| Controls | Heat builds on rotate | Heat dissipates when idle |
| Lights | Brightness dims when not soft dropping | Soft drop to recharge |

All three complications have player-driven triggers AND mitigations.

### Active Abilities (v1.2.0)

| Active | Charge Time | Level 1 | Level 2 | Level 3 |
|--------|-------------|---------|---------|---------|
| Cooldown Booster | 20s | +25% cooldown | +35% | +50% |
| Goop Dump | 15s | 1 wave (18 pcs) | 2 waves | 3 waves |
| Goop Colorizer | 25s | 6 match | 7 match | 8 match |
| Crack Down | 30s | 3 cracks low | 5 cracks | 7 cracks |

## Known Issues

**Bugs:**
- None currently tracked

**Tech Debt:**
- None currently tracked

## Phase 21 Decisions (Piece Shapes)

### Timing & Speed Changes

| Constant | Current | New | Location |
|----------|---------|-----|----------|
| `INITIAL_TIME_MS` | 60000 | **75000** | `constants.ts` |
| `INITIAL_SPEED` | 800 | **780** | `GameEngine.ts` |
| `SOFT_DROP_FACTOR` | 6 | **8** | `GameEngine.ts` |

**Rationale:** 75 sec game with 25 sec per size zone. Target 5-6 pieces per zone at 70% fast drop usage. Snappier fast drop (8x vs 6x).

### Piece Size Progression

| Zone | Time | Pressure Row | Pieces Spawning |
|------|------|--------------|-----------------|
| Tetra | 0-25s | Start → row 13 | Tetrominoes only |
| Penta | 25-50s | Row 13 → row 8 | Pentominoes only |
| Hexa | 50-75s | Row 8 → end | Hexominoes only |

**Logic:** Cracks spawn near pressure line. Higher pressure = need taller pieces to reach cracks. Tetra max 4 tall, Penta max 5, Hexa max 6.

### Piece Definitions (from art/minos.svg)

| Category | Normal | Corrupted | Total |
|----------|--------|-----------|-------|
| Tetrominoes | 5 | 5 | 10 |
| Pentominoes | 11 | 11 | 22 |
| Hexominoes | 11 | 11 | 22 |
| **Total** | 27 | 27 | **54 base** |

### Spawn Mechanics

1. **Corruption:** 15% chance per spawn → use corrupted variant
2. **Mirrors:** If piece is asymmetric → 50% chance to flip
3. **Exclusive spawning:** Only one size active at a time (no mixing)

### Non-Contiguous Pieces

"Corrupted" pieces have corner-touching cells instead of edge-touching. Example: the current T piece (diagonal floater off 3-unit L). These enable:
- Selective popping (pop one part, keep other)
- Gap filling (straddle existing goop)
- Unique coverage patterns

### Key Files to Modify

- `constants.ts` — INITIAL_TIME_MS, new PIECES arrays
- `GameEngine.ts` — INITIAL_SPEED, SOFT_DROP_FACTOR, spawn logic for pressure-based size selection
- `types.ts` — New PieceType enum values
- `art/minos.svg` — Source of truth for piece shapes (parsed for coordinates)

---

## Session Continuity

Last session: 2026-01-30
**Version:** 1.1.13
**Branch:** soft-body-experiment
**Current work:** SBG Research → Implementation

### This Session Summary (2026-01-30)

**Soft Body Goop Research — COMPLETE**

Comprehensive deep-dive research on soft body physics for the visual overhaul:

**1. Physics Deep-Dive:**
- Verlet integration preferred (stable, implicit velocity)
- Damping ratio ζ=0.5-0.7 for "gummy" feel
- 12 vertices per cell with ring + cross springs + pressure
- Concrete parameter values documented

**2. Rendering Deep-Dive:**
- Catmull-Rom splines pass through physics vertices (unlike Bezier)
- Simple conversion formula: `cp1 = P1 + (P2-P0)/6`
- SVG gooey filter for membrane merge between same-color cells
- Centripetal (α=0.5) prevents cusps, but uniform is fine for even spacing

**3. Field vs Spring Comparison:**
- **SPRINGS WIN** — gummy, stretchy feel (World of Goo uses this)
- Fields = floaty, magnetic feel (good for water, not goop)
- Springs create "reaching" effect; fields create "magnet snap"
- Spatial hashing required for 432 vertices

**All research documented in `.planning/SOFTBODY-VISION.md`**

Ready for Phase 1 prototype: single cell with physics + rendering.

---

### Previous Session Summary (2026-01-28)

**Win Bonus Rework — COMPLETE**

Redesigned win bonus to prevent multi-rank skipping and improve pacing:
- **Problem:** Old `rank × 5000` win bonus caused players to skip 5-10 ranks, missing unlocks
- **New system:** Win = guaranteed +1 rank, max +2 ranks per shift total
- **Implementation:**
  - Added `calculateCappedProgression()` in progression.ts
  - Updated App.tsx to use capped progression for saving
  - Updated ConsoleView.tsx to show correct capped rank on End Screen
  - Fixed idle console to use saved career score (not calculation)
- **Testing:** 10 new test cases covering all scenarios

6 files modified, 161 tests pass.

### Previous Session Summary (2026-01-28)

**PRD.md Comprehensive Update — COMPLETE**

Deep codebase analysis to update PRD.md v6.0 with accurate implementation details:
- **8 parallel agents:** Analyzed constants, goop system, cracks, complications, progression, scoring, controls, actives
- **Formula corrections:** Crack growth 7-12s random (not fixed 5s), win burst requires <90% pressure
- **Tech notes added:** Buffer rows, zone boundaries with upgrades, iOS touch handling, lock delay reduction
- **Scoring clarification:** Adjacency bonus NOT multiplied by combo (important detail)
- **New tables:** Cumulative XP, fill duration examples, Goop Dump constants
- **Upgrade interactions:** Documented all upgrade effects on base constants

1 file modified (PRD.md), 151 tests pass.

### Previous Session Summary (2026-01-28)

**Corrupted Piece Mechanics — COMPLETE**

Implemented proper behavior for corrupted (corner-connected) pieces:
- **isCorrupted flag:** Added to GoopTemplate to track corrupted pieces at spawn
- **No Mixed:** Corrupted pieces can't become multi-color split pieces
- **No Wild:** Corrupted pieces can't become wild pieces; wild always uses normal pool
- **LooseGoop on lock:** Added getFloatingBlocks() check after every piece locks
- **Corner-connected cells split:** updateGroups() already splits them, now they fall properly

2 files modified (types.ts, GameEngine.ts), 151 tests pass.

### Previous Session Summary (2026-01-27)

**v1.5 Visual Terminology & Grade System — COMPLETE**

Implemented Shift/Career terminology and grade system:
- **Variable renames:** sessionXP→shiftScore, sessionTime→shiftTime, operatorXP→careerScore
- **Storage migration:** v2→v3 with backward compatibility
- **UI text overhaul:** SHIFT OVER, GRADE: A/B/C, SHIFT SCORE, Scraps, STORED
- **Grade system:** 5 categories (Crack, Tank, System, Pressure, Score) averaged for letter grade
- **Dynamic text:** Floating pressure %, periscope alternation, REPAIR titles
- **Bug fix:** Loose goop now removes cracks from both goalMarks AND crackCells
- **UI polish:** UPGRADES button (centered, resized), SCRAPS: XX format, text alignment
- **Vented text:** Changed floating % to just "Vented" (percentage was meaningless at 1-2%)

27 files modified, 151 tests pass.

**Previous: 24-01 UI Text Updates Complete — v1.4 MILESTONE COMPLETE**

Updated all user-facing text to official terminology:
- HowToPlay.tsx: Hold Piece → Held Goop, Points → XP, Power Points → Scraps
- Upgrades.tsx: POWER UPS → UPGRADES, Level → Rank
- constants.ts: points → scraps, grammar fixes

3 files modified, 151 tests pass, TypeScript compiles clean.

**23-07 Remaining Goop Terms Complete — PHASE 23 COMPLETE**

Renamed final piece terminology to Goop equivalents:
- storedPiece → storedGoop, nextPiece → nextGoop (storage/preview)
- BlockData → GoopBlock, FallingBlock → LooseGoop (types)
- isGlowing → isSealingGoop, fallingBlocks → looseGoop (state)
- pressureRatio → tankPressure (calculation variable)

7 files modified, 151 tests pass, TypeScript compiles clean.

**23-06 Screen/Phase Types & Cracks Complete**

Renamed screen state and crack terminology to glossary terms:
- GamePhase → ScreenType (CONSOLE→ConsoleScreen, PERISCOPE→TankScreen, GAME_OVER→EndGameScreen)
- CrackCell → Crack
- parentIds → originCrackId (kept as array for merge support)
- childIds → branchCrackIds
- growthInterval → crackBranchInterval

10 files modified, 151 tests pass, TypeScript compiles clean.

**23-05 Progression Variables & Persistence Complete**

Renamed all scoring/progression variables to glossary terms:
- score → sessionXP, combo → popStreak, timeLeft → sessionTime
- totalScore → operatorXP, rank → operatorRank
- powerUpPoints → scraps
- INITIAL_TIME_MS → SESSION_DURATION, INITIAL_SPEED → ACTIVE_GOOP_SPEED
- Storage key v1 → v2 (INTENTIONAL SAVE RESET - old saves ignored)

18 files modified, 151 tests pass, TypeScript compiles clean.

**23-04 TankSystem and Actions Complete**

Renamed complication system and action commands to glossary terminology:
- ComplicationType → TankSystem (79 refs across 10 files)
- laserCapacitor → laserCharge (12 refs)
- primedGroups → prePoppedGoopGroups (10 refs)
- groupId → goopGroupId (62 refs across 7 files)
- MoveBoardCommand → SpinTankCommand
- RotatePieceCommand → RotateGoopCommand
- BlockTapCommand → PopGoopCommand

All 151 tests pass, TypeScript compiles clean.

**23-03 Tank Dimensions & Coordinates Complete**

Renamed dimension constants and coordinate system to Tank terminology:
- TOTAL_WIDTH/HEIGHT → TANK_WIDTH/HEIGHT
- VISIBLE_WIDTH/HEIGHT → TANK_VIEWPORT_WIDTH/HEIGHT
- boardOffset → tankRotation
- GridCell → TankCell

All 151 tests pass, TypeScript compiles clean.

**23-02 Core Goop Lifecycle Complete**

Renamed core piece terminology to Goop equivalents:
- PieceType → GoopShape (78 refs across 7 files)
- PieceDefinition → GoopTemplate (23 refs across 9 files)
- PieceState → GoopState (13 refs)
- activePiece → activeGoop (51 refs across 4 files)

All 151 tests pass, TypeScript compiles clean.

**Previous Session (2026-01-26)**

**Comprehensive Terminology Review & GLOSSARY v2.0**

User-driven review of ALL game terminology. Key decisions:
- Player = "Operator" (operates the tank)
- Piece = "Goop" with states: ActiveGoop, LockedGoop, GoopBlock, GoopGroup
- Grid = "Tank" with: tankGrid, TankCell, tankRotation
- Complications = "TankSystem" with TankSystemMalfunction
- Currency = "Scraps" (was powerUpPoints)
- Screen architecture: ConsoleScreen, TankScreen, EndGameScreen + TutorialModal overlay

60+ terms documented in GLOSSARY.md v2.0 with migration table.

**23-01 Executed:** softDrop → fastDrop (3 commits, still valid)

---

**Previous Session Summary**

**Phase 21 Discussion Complete**

Extensive `/gsd:discuss-phase 21` session defining piece shape changes:

1. **Core insight:** Goal is sealing cracks, not making lines. Cracks spawn higher as pressure rises. BIGGER pieces help reach cracks, not smaller.

2. **Piece progression designed:**
   - Tetra (4-cell) → Penta (5-cell) → Hexa (6-cell) based on pressure height
   - Exclusive spawning (one size at a time)
   - Thresholds: row 13 for penta, row 8 for hexa

3. **Timing balanced:**
   - Extended game to 75 seconds (from 60)
   - Adjusted base fall (780ms) and fast drop (8x factor)
   - Target: 5-6 pieces per 25-second zone

4. **Custom pieces designed:**
   - User created `art/minos.svg` with all piece shapes
   - 54 base pieces: 27 normal + 27 corrupted
   - Corrupted = non-contiguous (corner-touching cells)
   - 15% corruption chance, 50% mirror chance for asymmetric

5. **Pieces trimmed from standard sets:**
   - Hexominoes: removed #3, 4, 9, 18, 21, 23, 27
   - Pentominoes: removed N piece
   - Custom designs replace standard polyominoes

**Previous Session (same day)**

**iOS Touch Controls Fix (Build 24-29)**

Fixed swipe/drag controls not working on iPhone Chrome/Safari/DuckDuckGo:

1. **Root cause:** iOS WebKit has incomplete Pointer Events support
2. **Initial attempts that failed:**
   - Synthetic PointerEvents from TouchEvents (iOS ignores synthetic currentTarget)
   - useEffect-based window listeners (too slow for fast swipes)
   - User agent detection (missed DuckDuckGo and other browsers)
3. **Final fix (multiple parts):**
   - Added Touch Events handlers alongside Pointer Events
   - Window listeners added SYNCHRONOUSLY in touchstart (not via async useEffect)
   - Fixed vertical drag threshold (was 20px, now 0px for soft drop)
   - Added `pointer-events: none` to SVG so touches pass through to parent div
4. **Verified working** on iPhone Chrome and DuckDuckGo by external tester

**Previous Session (same day)**

**Color Schedule Rework + Wild Pieces**

1. **Color schedule restructured:**
   - Purple now unlocks at rank 10 (was 20)
   - Orange removed from palette (kept for save compatibility)
   - Black unlocks at rank 50 (new max rank color)
   - Rank 20: Multi-color pieces only (no new color)

2. **Max rank reduced** from 100 to 50

3. **Wild pieces implemented** (rank 40+, 15% spawn chance):
   - Rainbow wave visual: color cycles through palette left-to-right
   - Seals ANY crack color on landing
   - Spreads wild to ENTIRE adjacent goop group
   - When non-wild lands next to wild: converts ENTIRE wild group

4. **P0 bug fixed:** Board disappeared when wild piece spawned
   - Root cause: negative modulo in `getWildColorAtX` caused undefined palette access
   - Fix: use `Math.abs(screenX)` and fallback colors

5. **P0 bug fixed:** Board disappeared when wild piece locked
   - Root cause: `minX` used before `let` declaration in `GameBoard.tsx:355`
   - JavaScript temporal dead zone caused ReferenceError when `hasWildCells` was true
   - Fix: moved bounds calculation before `fillColor` assignment

6. **CLAUDE.md updated** with mandatory Handoff Block format
   - After code changes: tests → restart server → build # → handoff block
   - User was wasting tokens correcting missed steps

**Previous Session (same day)**

- CrackManager extraction, command updates, build number process clarification

**Previous Session (same day)**

- Added Core Rules checklists (CLAUDE.md)
- Added PostToolUse auto-test hook
- Added context compaction preservation rules
- Researched power user Claude Code techniques

**Earlier Session (same day)**

- SessionStart hook implemented
- Added `<research>` and `<askme>` commands
- Consolidated Known Issues tracking

**Previous Session (SOP & Workflow Overhaul)**

1. **Distance penalty increased to 25%** (v1.1.46)
   - `core/GameEngine.ts:1198` — changed from 0.15 to 0.25
   - Cracks now limited to ~3 cells instead of ~4-6

2. **Ghost piece visibility improved** (v1.1.46-48)
   - Added transparent color fill (20% opacity) behind dashed outline
   - Fixed: `getContourPath` creates disconnected lines (unfillable), switched to `<rect>`
   - Outline opacity increased to 75%
   - Helps distinguish orange vs red, and split-color pieces

3. **O piece rotation fixed for split-colors** (v1.1.49-50)
   - Previously skipped rotation entirely (optimization for single-color)
   - v1.1.49: Enabled rotation but piece jumped (rotated around 0,0)
   - v1.1.50: Fixed — rotates `cellColors` array instead of cell positions
   - Shape stays in place, colors rotate visually around center

4. **XP curve flattened** (v1.1.51)
   - Old: `(rank+2) * (1750 + 250*rank)` — ~7M to rank 40
   - New: `3500 + (rank * 250)` per rank — ~336K to rank 40
   - Much more achievable progression

**Future ideas captured:**
- `SlowMode` concept in [[PROJECT]] (pressure from goop volume, crack-based leveling)
- `GoopPieceRework` branch created for next milestone (different goop shapes)

**Next session:** Start GoopPieceRework milestone — different piece shapes to facilitate faster stacking

**All deployed to:** https://thebluemuzzy.github.io/GOOPS/

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
