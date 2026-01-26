---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-01-25
---

# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- None — v1.2 complete, ready for bug fix work

## Next Steps

**Current:** Phase 21 discussion complete
**Status:** Ready to plan Phase 21

Run `/gsd:plan-phase 21` to create execution plan with all decisions below.

## Future Plans

- **Title unlock system** — unlock titles as progression rewards
- **Piece shape changes** — different goop shapes for faster stacking
- **Tutorial system** — guided onboarding for new players
- **Naming standardization** — audit and standardize game element terminology in code:
  - piece vs goop (used interchangeably)
  - unit vs cell (used interchangeably)
  - soft drop → fast drop (vestigial name from old hard drop)
  - Create glossary of official terms for designer reference
  - Make this part of the pipeline going forward

---

## Project Reference

See: [[PROJECT]] (updated 2026-01-24)

**Core value:** The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.
**Current focus:** v1.2 shipped — bug fixes and testing before next milestone

## Current Position

Phase: 21 (Piece Shapes)
Plan: Not started
Status: Ready to plan
Last activity: 2026-01-26 — Milestone v1.3 created

Progress: ░░░░░░░░░░░░░░░░░░░░░ 0/? plans (v1.3)

## What's Done

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

Last session: 2026-01-26
**Version:** 1.1.13
**Branch:** master
**Milestone:** v1.3 Shape Changes (Phase 21)

### This Session Summary (2026-01-26)

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
