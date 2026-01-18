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

### Active

- [ ] Buttons toggle on/off (blue, green, purple arcade buttons)
- [ ] Dial spins when dragged/clicked (Reset Controls dial)
- [ ] Visual feedback for control states (lit indicators, position memory)

### Out of Scope

- Minigame logic (how controls affect gameplay) — separate phase
- Control state persistence (save/load between sessions) — not needed for v1
- Multi-color pieces — needs piece redesign first
- Action-based complication triggers — depends on minigame logic

## Context

**Current state:** Minigame UI is built but non-functional. Sliders work (snap to 3 positions), but:
- Arcade buttons have press animation but no toggle state
- Dial is hardcoded to `dialRotation={0}`, no spin logic
- Button clicks just `console.log()` as placeholders

**Key files:**
- `components/Art.tsx` — Contains `ArcadeButton` component, dial SVG, slider positions
- `components/ConsoleView.tsx` — Parent component, passes handlers to Art.tsx
- `components/ConsoleSlider.tsx` — Working slider implementation (good reference)

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
*Last updated: 2026-01-18 after initialization*
