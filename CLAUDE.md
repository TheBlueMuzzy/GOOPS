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
- `.planning/PROJECT.md` — GSD project definition and requirements
- `.planning/codebase/` — 7 architecture/structure documents

## Development Workflow
1. **After ANY code change**, run `npm run test:run`
2. If tests fail, **fix immediately** without asking user
3. If tests pass, **commit to git** with a clear message
4. Then tell user it's ready for manual testing
5. Pre-commit hook also runs tests automatically

### Git Workflow
- **Feature branches**: All new work happens on feature branches, not master
  - `master` = stable, tested code only
  - Feature branches (e.g., `complications`, `multicolor`) = work in progress
  - Merge to master only after human verification/testing passes
- Commit after each working feature/fix (not at end of session)
- Use descriptive commit messages that capture WHAT and WHY
- Push regularly so work isn't lost (push feature branches too!)

### Branch Commands Reference
```bash
# Check current branch
git branch

# Switch to existing branch
git checkout <branch-name>

# Create new feature branch from master
git checkout master
git checkout -b <new-branch-name>

# Push feature branch to remote
git push -u origin <branch-name>

# Merge feature branch to master (after testing passes)
git checkout master
git merge <branch-name>
git push origin master

# Delete feature branch after merge
git branch -d <branch-name>
git push origin --delete <branch-name>
```

### Claude Code Permissions
Permissions are set to **bypass mode** (`.claude/settings.local.json`) so Claude runs without stopping for approval prompts. This is committed to the repo as standard procedure.

### When to Suggest GSD
Offer `/gsd:progress` or other GSD commands at natural breakpoints:
- Starting a new feature or phase
- After completing a milestone
- When returning to work after a break
- When the scope feels unclear or needs planning

### Context Window Management
**At 8% context remaining or below**, stop current work and:
1. Update all relevant `.md` files with current progress/status
2. Update `CLAUDE.md` "Current Status" section if needed
3. Update `.planning/PROJECT.md` if requirements changed
4. Commit and push all changes to git
5. Tell user to start a fresh terminal chat

This avoids auto-compaction which loses context. User prefers clean handoffs between sessions.

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
- GSD project initialization (`.planning/PROJECT.md`, codebase map)
- Phase 1: Dial rotation (drag to spin, snap to 4 corners)
- Phase 2: All 3 minigame puzzles working:
  - **Reset Laser**: 4 sliders match indicator lights (left/right/both-on for center)
  - **Reset Lights**: Sequence memory (slider → watch 4-button sequence → repeat → slider)
  - **Reset Controls**: Dial alignment (align to 4 lit corners in sequence, tap to confirm)

### Next Up
- Phase 3: Complications — define what triggers minigames during gameplay
- Phase 4: Integration — wire minigame solutions to resolve complications

### Not Started
- Multi-color pieces (needs piece redesign first)

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
