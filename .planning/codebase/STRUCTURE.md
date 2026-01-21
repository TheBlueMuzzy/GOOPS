# Codebase Structure

**Analysis Date:** 2026-01-18

## Directory Layout

```
Goops2-main/
├── .planning/          # GSD planning documents (this folder)
├── components/         # React UI components
│   └── MiniGames/     # Minigame-specific components
│       ├── ArcadeButton.tsx   # Reusable arcade button component
│       ├── ControlsPanel.tsx  # CONTROLS minigame panel
│       ├── LaserPanel.tsx     # LASER minigame panel
│       └── LightsPanel.tsx    # LIGHTS minigame panel
├── core/              # Game engine and commands
│   ├── commands/      # Command pattern implementations
│   ├── events/        # Event bus system
│   ├── ComplicationManager.ts  # Complication trigger logic
│   └── GoalManager.ts          # Goal/crack state management
├── hooks/             # React custom hooks
│   ├── useAudioSubscription.ts    # Audio event subscription
│   ├── useControlsMinigame.ts     # CONTROLS state machine
│   ├── useGameEngine.ts           # Main engine hook
│   ├── useInputHandlers.ts        # Extracted input handling
│   ├── useLaserMinigame.ts        # LASER state machine
│   └── useLightsMinigame.ts       # LIGHTS state machine
├── tests/             # Unit tests (110 tests across 5 files)
├── types/             # Additional type definitions
│   ├── input.ts       # Input event types
│   └── minigames.ts   # Minigame type definitions
├── utils/             # Pure utility functions
│   ├── audio.ts           # Audio manager
│   ├── coordinates.ts     # Coordinate wrapping
│   ├── coordinateTransform.ts  # SVG coordinate transforms
│   ├── device.ts          # Device detection
│   ├── gameLogic.ts       # Core game logic
│   ├── goopRenderer.ts    # Goop rendering utilities
│   ├── progression.ts     # XP/rank calculations
│   └── storage.ts         # LocalStorage persistence
├── art/               # Static art assets
├── fonts/             # Custom fonts
├── App.tsx            # Root React component
├── Game.tsx           # Main game component
├── complicationConfig.ts   # Complication configuration constants
├── index.tsx          # Application entry point
├── types.ts           # Core TypeScript type definitions
├── constants.ts       # Game constants and config
└── index.html         # HTML entry point
```

## Directory Purposes

**components/**
- Purpose: React UI components for rendering game elements
- Contains: `.tsx` files for each visual component
- Key files: `GameBoard.tsx` (main game view), `ConsoleView.tsx` (operator console), `Art.tsx` (SVG art)
- Subdirectories: `MiniGames/` for complication minigame components

**core/**
- Purpose: Game engine core logic
- Contains: `GameEngine.ts` (~576 lines), `ComplicationManager.ts`, `GoalManager.ts`
- Subdirectories:
  - `commands/` - Command pattern implementations
  - `events/` - EventBus and event type definitions

**hooks/**
- Purpose: React custom hooks for state management
- Contains: `useGameEngine.ts`, `useAudioSubscription.ts`, `useInputHandlers.ts`, minigame hooks
- Key files:
  - `useGameEngine.ts` - main hook connecting React to GameEngine
  - `useInputHandlers.ts` - extracted input handling logic
  - `useLaserMinigame.ts`, `useLightsMinigame.ts`, `useControlsMinigame.ts` - minigame state machines

**tests/**
- Purpose: Unit tests for core game logic (110 tests total)
- Contains: `*.test.ts` files
- Key files:
  - `gameLogic.test.ts` (30 tests) - core game logic
  - `coordinates.test.ts` (6 tests) - coordinate wrapping
  - `coordinateTransform.test.ts` (27 tests) - SVG coordinate transforms
  - `progression.test.ts` (29 tests) - XP/rank calculations
  - `minigameLogic.test.ts` (18 tests) - minigame constants

**utils/**
- Purpose: Pure utility functions (testable, no side effects)
- Contains: Game logic helpers, coordinate math, storage
- Key files:
  - `gameLogic.ts` - core game logic functions
  - `coordinates.ts` - coordinate wrapping
  - `coordinateTransform.ts` - SVG coordinate conversions (VIEWBOX-aware)
  - `progression.ts` - XP curve and rank calculations
  - `goopRenderer.ts` - goop rendering utilities
  - `storage.ts`, `audio.ts`, `device.ts` - infrastructure utilities

## Key File Locations

**Entry Points:**
- `index.tsx` - React app mount point
- `App.tsx` - Root component with routing/state
- `Game.tsx` - Main game component

**Configuration:**
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration
- `vitest.config.ts` - Test runner configuration
- `tailwind.config.js` - Tailwind CSS configuration

**Core Logic:**
- `core/GameEngine.ts` - Central game state and logic (~576 lines)
- `core/ComplicationManager.ts` - Complication trigger logic
- `core/GoalManager.ts` - Goal/crack state management
- `core/commands/actions.ts` - All game commands
- `utils/gameLogic.ts` - Pure game logic functions
- `complicationConfig.ts` - Complication configuration constants

**Types:**
- `types.ts` - All TypeScript interfaces and enums

**Testing:**
- `tests/gameLogic.test.ts` - Game logic tests (30 tests)
- `tests/coordinates.test.ts` - Coordinate system tests (6 tests)
- `tests/coordinateTransform.test.ts` - SVG coordinate tests (27 tests)
- `tests/progression.test.ts` - XP/rank tests (29 tests)
- `tests/minigameLogic.test.ts` - Minigame constants tests (18 tests)

## Naming Conventions

**Files:**
- PascalCase.tsx - React components (`GameBoard.tsx`, `ConsoleView.tsx`)
- camelCase.ts - Utilities and logic (`gameLogic.ts`, `coordinates.ts`)
- camelCase.test.ts - Test files alongside or in `tests/`

**Directories:**
- lowercase - All directories (`components`, `core`, `utils`)
- PascalCase - Component subdirectories (`MiniGames`)

**Special Patterns:**
- `use*.ts` - React hooks (`useGameEngine.ts`)
- `*.test.ts` - Test files
- `CLAUDE.md` - AI context file
- `PRD.md` - Product requirements

## Where to Add New Code

**New UI Component:**
- Implementation: `components/ComponentName.tsx`
- If minigame-related: `components/MiniGames/ComponentName.tsx`

**New Game Command:**
- Implementation: `core/commands/actions.ts` (add to existing file)
- Interface: Already defined in `core/commands/Command.ts`

**New Game Logic:**
- Pure functions: `utils/gameLogic.ts`
- Types: `types.ts`
- Tests: `tests/gameLogic.test.ts`

**New Hook:**
- Implementation: `hooks/useHookName.ts`

**New Utility:**
- Implementation: `utils/utilityName.ts`
- Tests: `tests/utilityName.test.ts`

## Special Directories

**.planning/**
- Purpose: GSD planning and codebase documentation
- Source: Created by GSD workflow
- Committed: Yes

**node_modules/**
- Purpose: npm dependencies
- Source: `npm install`
- Committed: No (in .gitignore)

**dist/**
- Purpose: Production build output
- Source: `npm run build`
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-01-18*
*Updated 2026-01-21 for v1.1 refactor*
