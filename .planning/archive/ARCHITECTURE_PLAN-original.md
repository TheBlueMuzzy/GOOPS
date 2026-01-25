---
title: Original Architecture Plan (Superseded)
type: archive
tags: [historical, superseded, architecture]
status: archived
superseded_by: "[[ARCHITECTURE]]"
note: "This was the original vision document. Actual implementation diverged. See codebase/ARCHITECTURE.md for current state."
---

# Goops Architecture Plan (ARCHIVED)

> **Note:** This document is historical. It was the original vision before v1.0. The actual implementation diverged from this plan. For current architecture, see [[ARCHITECTURE]] in the codebase folder.

This document outlines the phased approach to refactoring Goops from its current monolithic structure to a modular, extensible architecture that supports the full vision (Console Mode, Complications, Periscope transitions).

---

## Current State Assessment

### What Works Well
- **Pure function library** (`utils/gameLogic.ts`) - Grid operations, collision, scoring are already extracted
- **Type definitions** (`types.ts`) - Clear interfaces for game entities
- **Audio system** (`utils/audio.ts`) - Clean singleton pattern
- **Persistence** (`utils/storage.ts`) - Solid save/load with schema migration

### Problems to Solve

1. **Game.tsx Monolith** (~900 lines)
   - 20+ useState hooks
   - Manual `stateRef` synchronization pattern (fragile)
   - All game logic inline in one component
   - Hard to test, hard to extend

2. **No Event System**
   - Audio calls scattered throughout code
   - No way to add complications triggers without touching game logic
   - No analytics hooks

3. **Duplicated Logic**
   - Pressure calculation in Game.tsx AND GameBoard.tsx
   - Goal consumption logic in hardDrop() AND gameLoop()

4. **Not Structured for Console Mode**
   - No game phase state machine
   - No way to pause tank simulation vs. pause everything
   - No transition system

---

## Target Architecture

```
goops/
├── core/                           # Framework-agnostic game engine
│   ├── state/
│   │   ├── GameState.ts            # Root state container
│   │   ├── TankState.ts            # Grid, goop groups
│   │   ├── PieceState.ts           # Falling piece, queue, stored
│   │   ├── PressureState.ts        # Timer, water level
│   │   ├── CrackState.ts           # Goal marks
│   │   ├── ComplicationState.ts    # Active complications, triggers
│   │   └── SessionState.ts         # Score, stats, phase
│   │
│   ├── systems/                    # Pure functions operating on state
│   │   ├── GridSystem.ts           # (migrate from gameLogic.ts)
│   │   ├── PhysicsSystem.ts        # Gravity, falling blocks
│   │   ├── PressureSystem.ts       # Timer tick, water level calc
│   │   ├── CrackSystem.ts          # Spawn, seal, consume
│   │   ├── ScoringSystem.ts        # Points calculation
│   │   └── ComplicationSystem.ts   # Triggers, effects
│   │
│   ├── commands/                   # State mutations (Command pattern)
│   │   ├── Command.ts              # Base interface
│   │   ├── DropPieceCommand.ts
│   │   ├── PopGoopCommand.ts
│   │   ├── RotateTankCommand.ts
│   │   ├── RotatePieceCommand.ts
│   │   ├── SwapPieceCommand.ts
│   │   ├── SlamPieceCommand.ts
│   │   └── ChangePhaseCommand.ts
│   │
│   ├── events/
│   │   ├── EventBus.ts             # Pub/sub for side effects
│   │   └── GameEvents.ts           # Event type definitions
│   │
│   └── GameEngine.ts               # Orchestrator (tick, execute commands)
│
├── react/                          # React-specific bindings
│   ├── hooks/
│   │   ├── useGameEngine.ts        # Main hook
│   │   ├── useAudioSubscription.ts
│   │   └── useComplicationTriggers.ts
│   └── contexts/
│       └── GameContext.tsx
│
├── components/
│   ├── PeriscopeMode/
│   │   ├── TankView.tsx            # Renamed from GameBoard
│   │   ├── FallingPiece.tsx        # Center-falling piece display
│   │   ├── GhostPiece.tsx          # Landing preview
│   │   └── PeriscopeHUD.tsx
│   │
│   ├── ConsoleMode/
│   │   ├── ConsoleView.tsx         # Control panel UI
│   │   ├── PeriscopeHandle.tsx     # Draggable to enter game
│   │   ├── StatusPanel.tsx         # Rank, upgrades display
│   │   ├── EndDayScreen.tsx        # Game over CRT monitor
│   │   └── MiniGames/
│   │       ├── ResetLaser.tsx      # 4-slider alignment
│   │       ├── ResetLights.tsx     # 3-button Lights Out
│   │       └── ResetControls.tsx   # Dial alignment
│   │
│   └── shared/
│       ├── CRTScreen.tsx
│       ├── Vignette.tsx
│       └── TransitionOverlay.tsx
│
├── utils/                          # Keep existing
│   ├── audio.ts
│   ├── storage.ts
│   ├── progression.ts
│   └── coordinates.ts              # Screen ↔ Tank coordinate conversion
│
├── types.ts                        # Expand with new types
├── constants.ts
├── App.tsx
└── Game.tsx                        # Eventually becomes thin shell
```

---

## Implementation Phases

### Phase 0: Stabilization (No Architecture Changes)

**Goal:** Fix critical bugs without restructuring.

**Decision Made:** Option B - Piece should move WITH the tank when board rotates.

**Rationale:** "Set and forget" style - once goop is in the tank, it's part of the tank world. When the tank rotates, everything inside (including falling pieces) rotates with it.

#### Task 0.1: Fix Piece/Board Coupling

**Current Behavior (Bug):**
- When tank rotates, `moveBoard()` updates BOTH `boardOffset` AND `activePiece.x`
- This makes piece stay at same screen column while tank rotates underneath
- Result: Piece appears to "slide" against tank rotation

**Desired Behavior:**
- When tank rotates, ONLY `boardOffset` changes
- `activePiece.x` stays constant (its tank coordinate)
- Result: Piece visually moves WITH the tank (always falls center-screen relative to tank)

**File:** `Game.tsx`

**Function:** `moveBoard()` (approximately lines 265-286)

**Fixed Code:**
```typescript
const moveBoard = useCallback((dir: number) => {
  const { gameOver, isPaused, activePiece, countdown, boardOffset, grid } = stateRef.current;
  if (gameOver || isPaused || !activePiece || countdown !== null) return;

  const newOffset = normalizeX(boardOffset + dir);

  // Piece stays at same tank coordinate - only board offset changes
  if (!checkCollision(grid, activePiece, newOffset)) {
    audio.playMove();
    setBoardOffset(newOffset);
    // NOTE: activePiece is NOT updated - it stays at same tank coordinate

    stateRef.current = {
        ...stateRef.current,
        boardOffset: newOffset
    };
  }
}, []);
```

**Key Changes:**
1. Remove `newPieceX` calculation
2. Remove `tempPiece` creation
3. Use `activePiece` directly in collision check
4. Remove `setActivePiece(tempPiece)` call
5. Remove `activePiece` from stateRef sync

#### Task 0.2: Test Gameplay

**Manual Test Checklist:**
- [ ] Rotate tank left (A key) - piece should visually move right with tank
- [ ] Rotate tank right (D key) - piece should visually move left with tank
- [ ] Ghost piece moves with tank rotation
- [ ] Hard drop still works after tank rotation
- [ ] Stored piece (W swap) still works correctly

---

### Phase 1: Event Bus + Command Pattern

**Goal:** Decouple side effects from game logic.

**Tasks:**
1. Create `core/events/EventBus.ts`
   ```typescript
   type Listener<T> = (payload: T) => void;

   class EventBus {
     private listeners = new Map<string, Set<Listener<any>>>();

     on<T>(event: string, listener: Listener<T>): () => void;
     emit<T>(event: string, payload: T): void;
   }
   ```

2. Create `core/events/GameEvents.ts`
   ```typescript
   enum GameEventType {
     PIECE_DROPPED = 'PIECE_DROPPED',
     GOOP_POPPED = 'GOOP_POPPED',
     CRACK_SEALED = 'CRACK_SEALED',
     CRACK_SPAWNED = 'CRACK_SPAWNED',
     PRESSURE_CHANGED = 'PRESSURE_CHANGED',
     PHASE_CHANGED = 'PHASE_CHANGED',
     TANK_ROTATED = 'TANK_ROTATED',
     GOOP_ADDED = 'GOOP_ADDED',
     // Complication triggers
     COMPLICATION_TRIGGERED = 'COMPLICATION_TRIGGERED',
     COMPLICATION_RESOLVED = 'COMPLICATION_RESOLVED',
   }
   ```

3. Create `core/commands/Command.ts`
   ```typescript
   interface Command {
     type: string;
     execute(state: GameState, eventBus: EventBus): GameState;
   }
   ```

4. Move audio calls to event subscriptions
   - Game logic emits events
   - Audio system subscribes to events
   - No audio imports in Game.tsx

**Verification:** Game plays identically, but audio is now event-driven.

---

### Phase 2: Extract Core State

**Goal:** Separate game state from React state.

**Tasks:**
1. Create `core/state/GameState.ts`
   ```typescript
   interface CoreGameState {
     tank: TankState;
     piece: PieceState;
     pressure: PressureState;
     cracks: CrackState;
     complications: ComplicationState;
     session: SessionState;
     phase: GamePhase;
   }

   type GamePhase =
     | 'CONSOLE_IDLE'
     | 'PERISCOPE_ENTERING'
     | 'PERISCOPE_ACTIVE'
     | 'PERISCOPE_EXITING'
     | 'COMPLICATION_MINIGAME'
     | 'GAME_OVER_RECAP';
   ```

2. Create `core/state/ComplicationState.ts`
   ```typescript
   interface ComplicationState {
     // Cumulative counters (reset each run)
     totalGoopAdded: number;      // Triggers: Reset Lights
     totalGoopPopped: number;     // Triggers: Reset Laser
     totalTankRotations: number;  // Triggers: Reset Controls
     
     // Active complications
     active: {
       lights: boolean;
       laser: boolean;
       controls: boolean;
     };
     
     // Thresholds (from upgrades)
     thresholds: {
       lights: number;
       laser: number;
       controls: number;
     };
   }
   ```

3. Create `core/GameEngine.ts`
   ```typescript
   class GameEngine {
     private state: CoreGameState;
     private eventBus: EventBus;

     tick(deltaMs: number): void;
     execute(command: Command): void;
     getState(): CoreGameState;
     subscribe(listener: (state: CoreGameState) => void): () => void;
   }
   ```

4. Create `react/hooks/useGameEngine.ts`
   ```typescript
   function useGameEngine(config: GameConfig): {
     state: CoreGameState;
     dispatch: (command: Command) => void;
   }
   ```

5. Refactor Game.tsx to use `useGameEngine`
   - Remove 20+ useState hooks
   - Remove stateRef pattern
   - Component becomes thin UI shell

**Verification:** Game plays identically, but state is managed by GameEngine.

---

### Phase 3: Console Mode Shell

**Goal:** Build console interface and transitions.

**Tasks:**
1. Create ConsoleView component with:
   - Operator Rank display
   - Three mini-game panels (Reset Laser, Reset Lights, Reset Controls)
   - Light indicators with blinking states
   - Periscope handle

2. Implement periscope interaction:
   - Drag down to enter Periscope Mode
   - Swipe/key up to exit to Console Mode

3. Implement transition animations:
   - Console → Periscope: Zoom into goggles viewport
   - Periscope → Console: Zoom out, periscope rises

4. Tank simulation continues during CONSOLE phase
   - Only piece controls paused
   - Timer keeps running
   - Goop keeps falling? (TBD - might pause piece spawning)

**Verification:**
- Can transition between phases
- Tank keeps running during console mode
- Transitions are animated

---

### Phase 4: Complications System

**Goal:** Implement equipment malfunctions and mini-games.

**Tasks:**

1. Implement complication triggers in ComplicationSystem:
   ```typescript
   function checkTriggers(state: ComplicationState): ComplicationType | null {
     if (state.totalGoopAdded >= state.thresholds.lights && !state.active.lights) {
       return 'LIGHTS';
     }
     if (state.totalGoopPopped >= state.thresholds.laser && !state.active.laser) {
       return 'LASER';
     }
     if (state.totalTankRotations >= state.thresholds.controls && !state.active.controls) {
       return 'CONTROLS';
     }
     return null;
   }
   ```

2. Create Reset Laser mini-game:
   - 4 sliders × 3 positions
   - 2 indicator lights per slider
   - Match slider to lit indicator
   - ~4 moves to complete

3. Create Reset Lights mini-game (Lights Out):
   - 3 buttons, 3 lights
   - Toggle pattern: B1→L1+L2, B2→L2+L3, B3→L1+L3
   - Spawn only hard states (000, 011, 101, 110)
   - ~4 moves to complete

4. Create Reset Controls mini-game:
   - Circular dial with pointer
   - Lights around perimeter
   - Align to 4 sequential targets
   - ~4 dial spins to complete

5. Wire up flow:
   - Event triggers complication
   - Visual indicator on console (solid lights)
   - Player exits to console
   - Completes mini-game
   - Complication resolved, counter resets

**Verification:**
- Complications trigger at thresholds
- Mini-games completable
- Effects cleared on resolution

---

### Phase 5: End Day Screen

**Goal:** Implement game over flow.

**Tasks:**
1. Create EndDayScreen component (CRT monitor style)
2. Implement drop-down animation on game over
3. Display stats:
   - Final Score
   - Operator Rank + XP bar
   - Unspent Power (upgrade points)
   - Cracks Filled (X/Y)
   - Pressure Vented (total bonus time)
   - Max Mass Purged
   - Leftover Goop (penalty)
4. "End the Day" button
5. Swipe up to dismiss → "Pull Down to Start"
6. Idle state with slow blinking lights

---

### Phase 6: Polish & Balance

**Goal:** Refine experience.

**Tasks:**
- Console visual design (industrial retro aesthetic)
- Light blinking patterns and speeds
- Sound design for console interactions
- Complication threshold balancing
- Mobile touch control refinement
- Performance optimization

---

### Phase 7: Future (Post-MVP)

- Soft-body shader rendering for goop
- Additional complication types
- Power-up system expansion
- Multi-colored goop pieces
- C# / Unity port

---

## Testing Strategy

### Unit Tests (core/)
- All systems are pure functions → easy to test
- Commands are deterministic → test state transitions
- No React, no DOM dependencies

### Integration Tests
- GameEngine tick behavior
- Event emission sequences
- Command execution order
- Complication trigger logic

### Manual Testing Checklist
After each phase:
- [ ] Piece collision works
- [ ] Ghost displays correctly
- [ ] Goop merging works
- [ ] Sticky gravity works
- [ ] Popping works (timing, pressure gate)
- [ ] Cracks spawn and seal correctly
- [ ] Score calculates correctly
- [ ] Pressure/timer works
- [ ] Win/lose conditions work
- [ ] Audio plays at right times
- [ ] Transitions animate correctly
- [ ] Complications trigger and resolve

---

## Risk Mitigation

1. **Regression Risk**
   - Keep original Game.tsx until new architecture is verified
   - Feature flag to switch between old/new
   - Automated tests for critical paths

2. **Scope Creep**
   - Each phase is a complete, working state
   - Don't move to next phase until current phase verified
   - PRD defines scope boundaries

3. **Performance**
   - Profile after Phase 2 (state extraction)
   - Event bus is synchronous (no async overhead)
   - React re-renders minimized by proper memoization

---

## Open Questions

1. **Phase 3:** Does piece spawning pause when in Console Mode, or just piece controls?
2. **Phase 4:** Starting threshold values for each complication type?
3. **Phase 5:** Animation duration for End Day screen drop?
4. **Phase 6:** Mobile swipe-up conflict - swap piece vs exit periscope?

---

*Document Version: 2.0*
*Last Updated: January 2026*
