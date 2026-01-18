# Codebase Concerns

**Analysis Date:** 2026-01-18

## Tech Debt

**Minigame UI incomplete:**
- Issue: Buttons and dial don't function, only visually present
- Files: `components/Art.tsx`, `components/ConsoleView.tsx`
- Why: Development in progress, UI built before logic
- Impact: Players can see controls but can't interact meaningfully
- Fix approach: Implement toggle state for buttons, drag-to-rotate for dial

**Console.log placeholders in button handlers:**
- Issue: Button clicks just log to console instead of triggering game logic
- Files: `components/ConsoleView.tsx:248-250`
- Why: Placeholder during UI development
- Impact: No actual functionality yet
- Fix approach: Replace with actual game state updates when minigame logic is built

**Large GameEngine class:**
- Issue: `core/GameEngine.ts` is ~465 lines
- Files: `core/GameEngine.ts`
- Why: Manageable for current scope, intentionally not split
- Impact: Could become harder to navigate as features grow
- Fix approach: Only split if actively struggling with complexity (per CLAUDE.md guidance)

## Known Bugs

**None currently documented.**

The test suite (36 tests) covers core game logic. Visual/gameplay bugs are tracked through manual testing.

## Security Considerations

**LocalStorage data:**
- Risk: Save data can be manually edited to cheat (modify score, unlock upgrades)
- Files: `utils/storage.ts`
- Current mitigation: None (single-player game, cheating only affects self)
- Recommendations: Not a priority for single-player game; would need server validation for leaderboards

**No sensitive data:**
- No user accounts, no passwords, no API keys
- Game is entirely client-side with no external communication

## Performance Bottlenecks

**Mobile SVG rendering:**
- Problem: Complex SVG masks cause input lag on mobile devices
- Files: `components/GameBoard.tsx`, `hooks/useGameEngine.ts`
- Measurement: Was 1.5-2 second input lag before optimization
- Cause: 60fps rendering with expensive SVG mask operations
- Current mitigation:
  - Throttle to 40fps on mobile (`useGameEngine.ts`)
  - Skip SVG masks entirely on mobile
  - Simplified fill animation (opacity-based)
  - Skip grid lines on mobile
- Status: **Resolved** - optimizations in place per CLAUDE.md

## Fragile Areas

**Mobile rendering conditionals:**
- Files: `components/GameBoard.tsx`, `hooks/useGameEngine.ts`
- Why fragile: `isMobile` checks scattered through rendering code
- Common failures: Removing checks causes mobile performance regression
- Safe modification: Do NOT remove `isMobile` checks without understanding performance implications
- Test coverage: No automated tests (manual mobile testing required)

**Periscope/Monitor drag interactions:**
- Files: `components/ConsoleView.tsx`
- Why fragile: Complex drag state management with multiple coordinate transforms
- Common failures: Breaking drag thresholds, animation timing
- Safe modification: Test thoroughly on both desktop and mobile after changes
- Test coverage: No automated tests (visual/interaction testing)

## Test Coverage Gaps

**React components:**
- What's not tested: All components in `components/` directory
- Risk: Visual regressions, interaction bugs
- Priority: Low (manual testing adequate for current scope)
- Difficulty to test: Would need React Testing Library setup

**GameEngine integration:**
- What's not tested: Full game loop, command execution flow
- Risk: State management bugs, command interactions
- Priority: Medium (utility functions are tested, engine methods indirectly covered)
- Difficulty to test: Would need to mock time, test state transitions

**Minigame components:**
- What's not tested: `components/MiniGames/*`, slider/button interactions
- Risk: Interaction bugs when minigame logic is added
- Priority: Low until minigame logic is implemented
- Difficulty to test: Need to test drag behavior, state transitions

## Missing Critical Features

**Minigame logic:**
- Problem: Minigame UI exists but has no game logic
- Current workaround: Players see controls but they don't affect gameplay
- Blocks: Full gameplay loop with complications
- Implementation complexity: Medium - need to connect UI state to game engine

**Multi-color pieces:**
- Problem: Piece design only supports single-color blocks
- Current workaround: None (feature not started)
- Blocks: Advanced gameplay variety
- Implementation complexity: High - needs piece type redesign

## Dependencies at Risk

**None identified.**

Dependencies are minimal and well-maintained:
- React 18 - Actively maintained
- Vite 4 - Actively maintained
- Vitest 4 - Actively maintained
- Tailwind CSS 3 - Actively maintained
- lucide-react - Actively maintained

---

*Concerns audit: 2026-01-18*
*Update as issues are fixed or new ones discovered*
