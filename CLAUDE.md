# Claude Code Context for Goops

## About the User
- **Not a professional engineer** — good with logic, not abstract coding patterns
- Prefers **human-readable, paragraph-style code** over clever abstractions
- Uses **Google AI Studio** for some development (tends to make unwanted changes)
- Values **targeted, minimal changes** — don't refactor beyond what's asked
- **Creative, not a coder** — always provide terminal commands ready to copy/paste

## Code Reuse Guideline
**Always reuse existing patterns and utilities before creating new ones.** This saves time/tokens and keeps the codebase consistent.

| Need | Existing Solution | Location |
|------|-------------------|----------|
| Shake animation | `className="shake-anim"` | `GameBoard.css` |
| Fill from bottom-to-top | See goop group rendering | `GameBoard.tsx:239-280` |
| Stop pointer events | `e.stopPropagation(); e.preventDefault();` on `onPointerDown` | Common pattern |
| Event bus communication | `gameEventBus.emit()` | `core/events.ts` |

When implementing new UI elements, check how similar elements work first.

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

### Version Numbers
Version displayed in main menu footer (`components/MainMenu.tsx`). Format: **X.Y.Z.B**

| Segment | When to increment | Example |
|---------|-------------------|---------|
| **B** (build) | AUTOMATIC on every dev/build | 1.1.13.4 → 1.1.13.5 |
| **Z** (patch) | Meaningful code changes | 1.1.13 → 1.1.14 |
| **Y** (minor) | Major milestone completion | 1.1.14 → 1.2.0 |
| **X** (major) | Release to friends | 1.2.0 → 2.0.0 |

**Build Number (B):** Auto-increments via Vite plugin every time dev server starts or build runs. Stored in `.build-number` (gitignored). User sees it in the app footer to verify they're testing the right code.

**CRITICAL: When changes are ready for testing**, Claude MUST:
1. Read `.build-number` to get the current build number
2. Tell the user: **"Ready to test. Look for build #X in the footer."**

This replaces manual version bumping. The build number proves the user is seeing fresh code.

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

## Quick Commands

User can type these shortcuts and Claude will execute:

| Command | Action |
|---------|--------|
| `<commands>` | Show this command list |
| `<npm>` | Run `npm run dev -- --host` (dev server, mobile accessible) |
| `<test>` | Run `npm run test:run` |
| `<commit>` | Update STATE.md + relevant docs, git add + commit + push |
| `<merge>` | Merge current branch to master, push both |
| `<status>` | Show git status + current project position from STATE.md |
| `<handoff>` | Full context handoff (see checklist below), ends with `/clear` instruction |
| `<deploy>` | Build, copy fonts, fix paths, deploy to https://thebluemuzzy.github.io/GOOPS/ |

### Handoff Checklist (`<handoff>`)

When user types `<handoff>`, Claude MUST capture ALL of the following before telling user to `/clear`:

1. **Current task state** — What was I working on? What's done vs pending?
2. **Uncommitted changes** — List all modified files and what each change does
3. **Bugs/blockers** — Any issues found, root cause analysis, attempted fixes
4. **Decisions made** — Anything discussed verbally that affects future work
5. **Next steps** — Exactly what to do when resuming

**Write to STATE.md Session Continuity section**, then:
- `git add` all planning docs
- `git commit -m "docs: handoff - [brief description]"`
- `git push`
- Kill any background processes (dev server, etc.)
- End with: **"Handoff complete. Run `/clear` then tell me what to work on."**

The goal: Next session can read STATE.md and have 100% of the context needed to continue.

## Terminal Commands
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
- **v1.0 MVP** (Phases 1-7): Core gameplay, complications, minigames, HUD meters
- **v1.1 Architecture** (Phases 8-13): File decomposition, memory fixes, event-based input
- **v1.2 Progression** (Phases 14-20): Full 40-rank progression, 4 bands, 20 upgrades, multi-color pieces, expanding cracks

### Stats
- **Version:** 1.1.13 (build number auto-increments)
- **Tests:** 150 across 7 test files
- **Upgrades:** 20 total across 4 bands

### Key Systems
- **Complications**: LASER@rank4, LIGHTS@rank2, CONTROLS@rank6
- **HUD Meters**: Laser capacitor (drains on pop), Controls heat (builds on rotate)
- **Upgrades**: 20 total (8 Onboarding + 4 Junk + 4 Mixer + 4 Cracked)
- **Active Abilities**: Equip + charge (1%/sec + 10%/crack) + tap to activate
- **XP Curve**: `3500 + (rank * 250)` per rank — flatter progression
- **XP Floor**: `max(100 * rank, score)` prevents zero-gain runs

### Key Documents
- `.planning/STATE.md` — Current position and session continuity
- `.planning/ROADMAP.md` — Phase overview and progress (20 phases total)
- `.planning/PROJECT.md` — Requirements and key decisions
- `PRD.md` — Full product requirements
- `constants.ts` — UPGRADES configuration (20 upgrades)

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
**GameEngine is now ~1177 lines** (grew with crack system in Phase 20). Consider extracting CrackManager if it grows further.
**GameBoard.tsx is ~758 lines** — manageable but watch for growth.
