# Goops — project notes for Claude

Goops is being **remade from scratch with BMUZ 2** (started 2026-10-16). Planning lives in `.planning/` (STATE, GDD, TDD, ROADMAP); start from `.planning/STATE.md` ▶ RESUME HERE.

- **Old version (v1):** branch `archive/goops-v1`. Its design docs are in `.planning/research/v1/` and its GSD history is in `.planning/archive/gsd/`. Use them as a reference, not as the plan.
- Until /develop clears it, the code in this folder is still v1. Don't build new features on top of it.
- `<save>` → use `/save`. Commands are the BMUZ verbs (`/bmuz`).

## v1 lessons worth remembering (carried over until the TDD replaces them)
- Mobile was throttled to 40fps with simplified rendering (`isMobile` checks in `hooks/useGameEngine.ts`, `components/GameBoard.tsx`).
- Cross-system events went through `gameEventBus` (`core/events.ts`).
