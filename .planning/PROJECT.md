# Goops

## What This Is

A puzzle-action game where players operate as tank maintenance technicians clearing colored goop from a cylindrical pressure tank. Built with React/TypeScript/Vite. Mobile-optimized with touch controls.

## Core Value

The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.

## Requirements

### Validated

- ✓ Core gameplay loop (piece falling, rotation, collision, clearing) — existing
- ✓ Cylindrical grid wrapping — existing
- ✓ Scoring system with bonuses (height, off-screen, adjacency, speed) — existing
- ✓ Goal/objective system (crack marks to fill) — existing
- ✓ Rank progression (XP, levels, color unlocks) — existing
- ✓ Upgrade system (time bonus, stability) — existing
- ✓ Mobile performance optimization (40fps, simplified rendering) — existing
- ✓ Console/Periscope phase UI — existing
- ✓ Minigame sliders (Reset Laser, Reset Lights) — existing
- ✓ Unit test infrastructure (36 tests, pre-commit hooks) — existing
- ✓ Dial spins when dragged (Reset Controls dial) — snaps to 4 corners
- ✓ Reset Laser puzzle logic (4 sliders match indicator lights)
- ✓ Reset Lights puzzle logic (sequence memory: slider → watch → repeat → slider)
- ✓ Reset Controls puzzle logic (dial alignment: 4 corners in sequence)

### Active

- [ ] Complications — what triggers minigames during gameplay
- [ ] Minigame-Complication integration — wire puzzle solutions to resolve complications

### Out of Scope

- Control state persistence (save/load between sessions) — not needed for v1
- Multi-color pieces — needs piece redesign first

## Context

**Current state:** All 3 minigame puzzles are complete and tested:
- **Reset Laser**: 4 sliders match indicator lights (left/right/both-on=center)
- **Reset Lights**: Sequence memory (slider → watch 4 buttons → repeat → slider)
- **Reset Controls**: Dial alignment (rotate to 4 lit corners in sequence, tap to confirm)

Click minigame title text to toggle each puzzle for testing.

**Key files:**
- `components/Art.tsx` — All minigame state machines, puzzle logic, visual feedback
- `components/ConsoleSlider.tsx` — Slider component with drag, snap, shake animation
- `components/GameBoard.tsx` — Contains @keyframes shake definition

**User preferences:**
- Not a professional engineer, prefers readable code over abstractions
- Targeted minimal changes, don't refactor beyond what's asked
- Run tests after every change

## Constraints

- **Mobile-first**: Controls must work well on touch devices
- **Existing patterns**: Follow the slider implementation pattern for consistency
- **Test requirement**: Run `npm run test:run` after changes, fix failures immediately

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Sliders use local state in Art.tsx | Simple, self-contained, no game logic coupling | ✓ Good |
| Buttons/dial should follow same pattern | Consistency, keep UI state separate from game state | — Pending |

---
*Last updated: 2026-01-19 — Phase 2 complete, all minigames tested*
