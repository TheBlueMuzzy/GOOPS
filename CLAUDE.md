# Claude Code Context for Goops

## About the User
- **Not a professional engineer** — good with logic, not abstract coding patterns
- Prefers **human-readable, paragraph-style code** over clever abstractions
- Uses **Google AI Studio** for some development (tends to make unwanted changes)
- Values **targeted, minimal changes** — don't refactor beyond what's asked
- **Creative, not a coder** — always provide terminal commands ready to copy/paste

## Project Overview
Goops (Gooptris) is a puzzle-action game built with React/TypeScript/Vite. Player operates as a tank maintenance technician clearing colored goop from a cylindrical pressure tank.

## Key Files
- `PRD.md` — Full product requirements
- `ARCHITECTURE_PLAN.md` — Phased refactoring plan (partially complete)
- `tests/` — Unit tests for core logic (run before committing!)

## Development Workflow
1. **After ANY code change**, run `npm run test:run`
2. If tests fail, **fix immediately** without asking user
3. If tests pass, **commit to git** with a clear message
4. Then tell user it's ready for manual testing
5. Pre-commit hook also runs tests automatically

### Git Workflow
- Commit after each working feature/fix (not at end of session)
- Use descriptive commit messages that capture WHAT and WHY
- Push regularly so work isn't lost

### When to Suggest GSD
Offer `/gsd:progress` or other GSD commands at natural breakpoints:
- Starting a new feature or phase
- After completing a milestone
- When returning to work after a break
- When the scope feels unclear or needs planning

## Commands
- `npm run dev -- --host` — Dev server (accessible from phone at local IP)
- `npm run test:run` — Run tests once
- `npm test` — Watch mode
- `git status` — See what's changed
- `git add .` — Stage all changes
- `git commit -m "message"` — Commit with message
- `git push` — Push to remote

## Mobile Performance
Mobile rendering is heavily optimized (40fps, simplified rendering). Key optimizations in:
- `hooks/useGameEngine.ts` — Frame throttling
- `components/GameBoard.tsx` — Conditional rendering for `isMobile`

Do NOT remove the `isMobile` checks without understanding why they exist.

## Current Status (as of Jan 2026)
### Complete
- Core gameplay loop
- Mobile performance optimization
- Unit test infrastructure (36 tests)
- Pre-commit hooks

### In Progress
- Minigame UI (Reset Laser, Reset Lights, Reset Controls)
  - Sliders partially working
  - Buttons click but don't toggle
  - Dial doesn't spin yet

### Not Started
- Minigame logic
- Multi-color pieces (needs piece redesign first)
- Action-based complication triggers

## Testing Philosophy
- Tests cover core game logic (collision, gravity, scoring, coordinates)
- User handles visual/gameplay testing manually
- Run tests after EVERY change to catch regressions

## Key Decisions & Why

### Mobile Optimization (Jan 2026)
**Problem:** 1.5-2 second input lag on phone
**Root cause:** 60fps rendering with SVG masks, complex fill animations
**Solution:**
- Throttle to 40fps on mobile (`useGameEngine.ts`)
- Skip SVG masks entirely on mobile (very expensive)
- Simplified fill animation (opacity-based instead of per-row)
- Skip grid lines on mobile
**Why not split into systems?** Wasn't needed for performance — the SVG rendering was the bottleneck, not the game logic architecture.

### Test Infrastructure (Jan 2026)
**Why Vitest?** Works seamlessly with Vite, fast, good TypeScript support
**Why these specific tests?** Cover the pure functions that are most likely to regress: coordinate wrapping, collision detection, group finding (flood fill), sticky gravity, scoring calculations
**Why pre-commit hook?** User's main frustration is AI tools breaking things — catch regressions before they're committed

### File Organization
**Why NOT split GameEngine into 6 systems?** Over-engineering for current scope. The 465-line class is manageable. Only split if actively struggling with complexity.
**Why NOT split GameBoard.tsx?** Same reason. Smaller files help constrain AI tools (Google AI Studio) from touching too much, but the refactor cost isn't worth it yet.
