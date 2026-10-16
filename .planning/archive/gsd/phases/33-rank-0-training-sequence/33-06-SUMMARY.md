---
phase: 33-rank-0-training-sequence
plan: 06
subsystem: tutorial
tags: [state-machine, tutorial, training, handler-registry]
requires:
  - phase: 33-05
    provides: two-step crack sealing, CRACK_OFFSCREEN event
provides:
  - Tutorial v3 state machine framework
  - 15 step configs matching Tutorial3.md spec
  - Handler registry with standard + custom stubs
  - Timeout pool for centralized timer management
affects: [33-07-custom-handlers]
tech-stack:
  added: []
  patterns: [state-machine-lifecycle, handler-registry, timeout-pool, named-timeouts]
key-files:
  created: [hooks/tutorial/stateMachine.ts, hooks/tutorial/timeoutPool.ts, hooks/tutorial/handlers.ts]
  modified: [types/training.ts, hooks/useTrainingFlow.ts, data/trainingScenarios.ts, data/tutorialSteps.ts]
key-decisions:
  - "Standard handler logic lives in orchestrator (useTrainingFlow) since it needs React state access; handler registry provides the routing mechanism"
  - "Removed reshowAfterMs/reshowNonDismissible/reshowAtRow/reshowUntilAction/showOnInput/showWhenCracksOffscreen — replaced by hintDelay"
  - "E2_POP_SEALED eliminated, E3_SCAFFOLDING renumbered to E2_SCAFFOLDING (15 steps total)"
  - "Helper functions (addCrackToGrid, findCrackPosition, spawnPieceFromConfig, etc.) kept in useTrainingFlow.ts rather than extracted to separate module"
patterns-established:
  - "State machine lifecycle: ENTERING -> WAITING_FOR_TRIGGER -> MESSAGE_VISIBLE -> ARMED -> ADVANCING"
  - "Named timeout pool with clearAll on step change — replaces 20+ individual refs from v2"
  - "Handler registry: getHandler(handlerType) returns standard/retry/discovery/continuous/freeplay"
  - "hintDelay pattern: wait N ms after dismiss, if no action reshow non-dismissible + pause pressure"
issues-created: []
duration: 11min
completed: 2026-02-23
---

# Phase 33 Plan 06: Tutorial Framework + Step Configs Summary

**Replaced 1400-line monolithic useTrainingFlow with modular state machine architecture and updated all 15 step configs to match Tutorial3.md spec.**

## Performance
- **Duration:** 11 minutes
- **Started:** 2026-02-23T06:29:31Z
- **Completed:** 2026-02-23T06:40:28Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

1. **State machine framework** — Step lifecycle with 5 explicit states (ENTERING, WAITING_FOR_TRIGGER, MESSAGE_VISIBLE, ARMED, ADVANCING). Each state has derived properties (isPaused, isFrozen, messageShown).

2. **Timeout pool** — Centralized named timeout/interval manager. `set()`, `setInterval()`, `clear()`, `clearAll()`. Replaces 20+ individual refs from v2. `clearAll()` called on every step change guarantees no leaked timers.

3. **Handler registry** — `getHandler(handlerType)` returns the correct handler. Standard handler implemented (covers patterns 1-5). Stubs for retry (D2), discovery (D3), continuous (E1), and freeplay (F1) — implementation in plan 33-07.

4. **Types updated** — 15 step IDs (removed E2_POP_SEALED, renamed E3 to E2). Added `handlerType` field to TrainingStep. Added `hintDelay` to StepSetup. Added state machine types (StepLifecycleState, StepStateProperties).

5. **useTrainingFlow rewritten** — Thin orchestrator using timeout pool and state machine. Same external interface preserved for Game.tsx. All v2 functionality maintained through the pool-based timer management.

6. **15 step configs** — All configs matching Tutorial3.md Section 5. Each step has handlerType assigned. hintDelay replaces reshowAfterMs for C2, C4, E1.

7. **Messages updated** — All 15 messages with correct garble brackets and keywords. F1 ending messages and D2 retry message preserved.

## Task Commits
1. **Task 1: Framework** - `ef26d1d` (feat) — state machine, timeout pool, handler registry, types, orchestrator rewrite
2. **Task 2: Step configs** - `c3ec712` (feat) — 15 step configs + messages matching Tutorial3.md

## Files Created/Modified

**Created:**
- `hooks/tutorial/stateMachine.ts` — Step lifecycle state machine hook
- `hooks/tutorial/timeoutPool.ts` — Centralized timeout/interval pool hook
- `hooks/tutorial/handlers.ts` — Handler registry + standard handler + custom stubs

**Modified:**
- `types/training.ts` — Updated types (15 step IDs, handlerType, hintDelay, state machine types)
- `hooks/useTrainingFlow.ts` — Rewritten as thin orchestrator (pool-based timers, state machine)
- `data/trainingScenarios.ts` — 15 step configs with handlerType assignments
- `data/tutorialSteps.ts` — 15 messages with garble brackets, F1 endings, D2 retry

## Decisions Made

1. **Standard handler logic in orchestrator** — The standard handler's setup logic lives in useTrainingFlow.ts because it needs direct access to React state setters (setMessageVisible, setCanDismiss, etc.) and the game engine. Custom handlers (plan 33-07) will override specific behaviors. The handler registry provides the routing mechanism.

2. **Helper functions not extracted** — addCrackToGrid, findCrackPosition, spawnPieceFromConfig, spawnRandomCrack, isAnyCrackOffscreen kept in useTrainingFlow.ts rather than extracted to a utility module. They're tightly coupled to the training flow and extracting them adds complexity without clear benefit at this stage.

3. **Preserved v2 D3/E1/F1 logic** — The orchestrator retains the v2 implementation for D3 discovery, E1 GOAL_CAPTURED handler, and F1 endings. Plan 33-07 will refactor these into proper custom handlers.

## Deviations from Plan

- Removed `showWhenCracksOffscreen` from StepSetup and D3 config — v3 D3 uses CRACK_OFFSCREEN event listener (from plan 33-05), not polling. The D3 step config no longer needs this field. The existing D3 discovery polling code is preserved in the orchestrator for now (plan 33-07 will refactor to event-based).

## Issues Encountered

None. Tests (210) and TypeScript compilation passed on both tasks.

## Next Phase Readiness

- Ready for plan 33-07: Custom handlers + integration + UAT
- All standard patterns implemented in orchestrator
- Custom handler stubs in place for D2 retry, D3 discovery, E1 continuous, F1 freeplay
- No blockers

---
*Phase: 33-rank-0-training-sequence*
*Completed: 2026-02-23*
