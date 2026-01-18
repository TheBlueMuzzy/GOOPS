# Coding Conventions

**Analysis Date:** 2026-01-18

## Naming Patterns

**Files:**
- PascalCase.tsx for React components (`GameBoard.tsx`, `ConsoleView.tsx`)
- camelCase.ts for utilities and logic (`gameLogic.ts`, `coordinates.ts`)
- camelCase.test.ts for test files (`gameLogic.test.ts`)

**Functions:**
- camelCase for all functions (`checkCollision`, `findContiguousGroup`)
- handle* prefix for event handlers (`handleStart`, `handleMove`, `handleEnd`)
- create* prefix for factory functions (`createEmptyGrid`, `createMockPiece`)
- calculate* prefix for computation functions (`calculateHeightBonus`, `calculateMultiplier`)

**Variables:**
- camelCase for variables (`isDragging`, `monitorOffset`)
- UPPER_SNAKE_CASE for constants (`TOTAL_WIDTH`, `INITIAL_TIME_MS`)

**Types:**
- PascalCase for interfaces (`GameState`, `ActivePiece`, `BlockData`)
- PascalCase for enums (`GamePhase`, `PieceType`, `PieceState`)
- No I-prefix for interfaces

## Code Style

**Formatting:**
- 2-space indentation
- Single quotes for strings
- Semicolons required
- No explicit Prettier/ESLint config (follows TypeScript defaults)

**TypeScript:**
- Strict mode enabled (`tsconfig.json`)
- No unused locals/parameters (enforced by tsconfig)
- Explicit typing for function parameters and returns

## Import Organization

**Order (observed pattern):**
1. React imports (`import React, { useState, useRef }`)
2. External packages (`import { ArrowUp } from 'lucide-react'`)
3. Internal modules - types first (`import { GameState, GamePhase } from '../types'`)
4. Internal modules - utils/core (`import { calculateRankDetails } from '../utils/progression'`)
5. Internal modules - components (`import { ConsoleSlider } from './ConsoleSlider'`)

**Grouping:**
- No blank lines between import groups (compact style)
- Related imports on same line when possible

**Path Style:**
- Relative imports (`../types`, `./ConsoleSlider`)
- No path aliases configured

## Error Handling

**Patterns:**
- Minimal error handling (game has no failure modes requiring recovery)
- TypeScript strict mode catches type errors at compile time
- No try/catch blocks (no external I/O)

**Validation:**
- Bounds checking in game logic functions
- Coordinate normalization for cylindrical wrap-around

## Logging

**Framework:**
- console.log for development debugging
- No production logging framework

**Patterns:**
- Temporary console.log for debugging (remove before commit)
- Button click handlers use console.log as placeholder (`console.log('Blue Click')`)

## Comments

**When to Comment:**
- Explain "why" for non-obvious decisions
- Document business logic (e.g., scoring formulas)
- Note mobile optimization reasons

**Style:**
- Single-line `//` comments for most cases
- JSDoc-style not used (TypeScript types provide documentation)

**Examples from codebase:**
```typescript
// Reduced from 20 to make it feel less like a hard drop
const SOFT_DROP_FACTOR = 6;

// Internal state tracking - Public for Commands to access
public maxTime: number = INITIAL_TIME_MS;
```

## Function Design

**Size:**
- Most functions under 50 lines
- GameEngine methods are larger but focused

**Parameters:**
- Object destructuring for props (`{ engine, state, onOpenSettings }`)
- Explicit types for all parameters

**Return Values:**
- Explicit returns preferred
- Early returns for guard clauses

## Module Design

**Exports:**
- Named exports for components (`export const ConsoleView`)
- Named exports for utilities (`export function checkCollision`)
- Class export for GameEngine (`export class GameEngine`)

**Component Structure:**
```typescript
interface ComponentProps {
  // Props definition
}

export const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Hooks first
  const [state, setState] = useState();

  // Event handlers
  const handleEvent = () => {};

  // Render
  return <div>...</div>;
};
```

## React Patterns

**State Management:**
- useState for local component state
- useRef for mutable values that don't trigger re-render
- useEffect for side effects and subscriptions
- Custom hooks for shared logic (`useGameEngine`)

**Event Handling:**
- Inline handlers for simple cases
- Named functions for complex handlers
- Pointer events for cross-platform touch/mouse support

---

*Convention analysis: 2026-01-18*
*Update when patterns change*
