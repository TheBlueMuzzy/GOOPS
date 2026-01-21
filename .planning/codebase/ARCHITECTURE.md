# Architecture

**Analysis Date:** 2026-01-18

## Pattern Overview

**Overall:** Single-Page React Application with Command Pattern Game Engine

**Key Characteristics:**
- Browser-based puzzle game (no backend)
- Centralized game state managed by GameEngine class
- Command pattern for game actions
- Event bus for decoupled communication
- Phase-based UI flow (Console → Periscope → Gameplay)

## Layers

**UI Layer (React Components):**
- Purpose: Render game visuals and handle user input
- Contains: `components/*.tsx`, `App.tsx`, `Game.tsx`
- Depends on: GameEngine (via hooks), game state
- Used by: Browser DOM

**Game Engine Layer:**
- Purpose: Core game logic, state management, game loop
- Contains: `core/GameEngine.ts`
- Depends on: Utility functions, constants, commands
- Used by: React hooks (`useGameEngine.ts`)

**Command Layer:**
- Purpose: Encapsulate discrete game actions
- Contains: `core/commands/*.ts`
- Depends on: GameEngine for execution
- Used by: Components trigger commands, engine executes

**Event Layer:**
- Purpose: Decoupled communication between systems
- Contains: `core/events/EventBus.ts`, `core/events/GameEvents.ts`
- Depends on: Nothing (standalone)
- Used by: GameEngine emits, components subscribe
- Events include: Audio triggers, score events, input events (INPUT_ROTATE, INPUT_DRAG, INPUT_SWAP)

**Coordinate Transform Layer:**
- Purpose: Pure functions for coordinate system conversions
- Contains: `utils/coordinateTransform.ts`, `utils/coordinates.ts`
- Depends on: VIEWBOX constants only
- Used by: GameBoard, input handlers, rendering
- Functions: visXToScreenX, screenXToVisX, clientToSvg, svgToVisual, visualToGrid, gridToPercentage
- Why extracted: Testability, single source of truth for VIEWBOX dimensions

**Configuration Layer:**
- Purpose: Centralized game configuration constants
- Contains: `complicationConfig.ts`
- Depends on: Types only
- Used by: GameEngine, ComplicationManager, minigame hooks
- Exports: COMPLICATION_CONFIG, helper functions for unlock/cooldown calculations
- Why extracted: Remove hard-coded values scattered across files

**Utility Layer:**
- Purpose: Pure functions for game logic calculations
- Contains: `utils/*.ts`
- Depends on: Types and constants only
- Used by: GameEngine, tests

## Data Flow

**Game Loop Execution:**

1. User input captured (keyboard/touch) in `Game.tsx`
2. Input triggers Command creation (`core/commands/actions.ts`)
3. Command executed via `engine.execute(command)`
4. GameEngine updates internal state
5. State change triggers listener notification
6. React re-renders via `useGameEngine` hook
7. Visual update displayed

**Phase Transitions:**

1. Game starts in `GamePhase.CONSOLE` (main menu)
2. User pulls periscope → `GamePhase.PERISCOPE`
3. Periscope animates → gameplay starts
4. Game over → `GamePhase.GAME_OVER`
5. Monitor dismissal → back to `GamePhase.CONSOLE`

**State Management:**
- Single source of truth: `GameEngine.state`
- Immutable-ish updates (state replaced, not mutated)
- Subscribers notified on any state change
- React hook extracts state for rendering

## Key Abstractions

**GameEngine:**
- Purpose: Central game state and logic container
- Location: `core/GameEngine.ts` (~576 lines)
- Pattern: Observer pattern (subscribe/notify)
- Responsibilities: State management, game loop, command execution
- Tick structure: `tick()` delegates to focused sub-methods (tickTimer, tickGoals, tickHeat, tickFallingBlocks, tickActivePiece)
- Implements: GameStateManager interface for type-safe state access

**Command:**
- Purpose: Encapsulate game actions for clean separation
- Location: `core/commands/Command.ts` (interface), `core/commands/actions.ts` (implementations)
- Pattern: Command pattern
- Examples: `MoveCommand`, `RotateCommand`, `StartRunCommand`, `SetPhaseCommand`

**EventBus:**
- Purpose: Decoupled event publication/subscription
- Location: `core/events/EventBus.ts`
- Pattern: Pub/Sub
- Used for: Audio triggers, score events, visual effects, input events

**ComplicationManager:**
- Purpose: Handles complication trigger logic
- Location: `core/ComplicationManager.ts`
- Responsibilities: Check unlock conditions, calculate cooldowns, trigger complications

**GoalManager:**
- Purpose: Manages goal/crack state
- Location: `core/GoalManager.ts`
- Responsibilities: Goal spawning, crack progression, goal completion

**GameStateManager (Interface):**
- Purpose: Type-safe interface for game state access
- Location: `types.ts`
- Used by: Managers that need to read/write game state

**GamePhase:**
- Purpose: Finite state machine for game UI flow
- Location: `types.ts` (enum)
- States: CONSOLE, PERISCOPE, COMPLICATION_MINIGAME, GAME_OVER

## Entry Points

**Application Entry:**
- Location: `index.tsx`
- Triggers: Browser loads page
- Responsibilities: Mount React app to DOM

**Game Entry:**
- Location: `App.tsx` → `Game.tsx`
- Triggers: Route navigation, component mount
- Responsibilities: Initialize GameEngine, set up game loop

**Console Entry:**
- Location: `components/ConsoleView.tsx`
- Triggers: Game phase is CONSOLE
- Responsibilities: Show operator console, handle periscope drag

## Error Handling

**Strategy:** Minimal error handling (game doesn't have failure modes that need recovery)

**Patterns:**
- TypeScript strict mode catches type errors at compile time
- Game state validation happens in utility functions
- No try/catch needed (no external API calls, no I/O)

## Cross-Cutting Concerns

**State Persistence:**
- LocalStorage for save data (`utils/storage.ts`)
- Stores: rank, total score, power-up points, settings

**Audio:**
- Centralized audio manager (`utils/audio.ts`)
- Triggered via EventBus subscriptions
- Volume controlled via saved settings

**Mobile Optimization:**
- Device detection (`utils/device.ts`)
- Conditional rendering paths in `GameBoard.tsx`
- Frame throttling in `useGameEngine.ts`

---

*Architecture analysis: 2026-01-18*
*Updated 2026-01-21 for v1.1 refactor*
