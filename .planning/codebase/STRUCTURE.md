# Codebase Structure

**Analysis Date:** 2026-01-18

## Directory Layout

```
Goops2-main/
├── .planning/          # GSD planning documents (this folder)
├── components/         # React UI components
│   └── MiniGames/     # Minigame-specific components
├── core/              # Game engine and commands
│   ├── commands/      # Command pattern implementations
│   └── events/        # Event bus system
├── hooks/             # React custom hooks
├── tests/             # Unit tests
├── utils/             # Pure utility functions
├── art/               # Static art assets
├── fonts/             # Custom fonts
├── App.tsx            # Root React component
├── Game.tsx           # Main game component
├── index.tsx          # Application entry point
├── types.ts           # TypeScript type definitions
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
- Contains: `GameEngine.ts` (main engine class)
- Subdirectories:
  - `commands/` - Command pattern implementations
  - `events/` - EventBus and event type definitions

**hooks/**
- Purpose: React custom hooks for state management
- Contains: `useGameEngine.ts` (engine state hook), `useAudioSubscription.ts`
- Key files: `useGameEngine.ts` - main hook connecting React to GameEngine

**tests/**
- Purpose: Unit tests for core game logic
- Contains: `*.test.ts` files
- Key files: `gameLogic.test.ts` (30 tests), `coordinates.test.ts` (6 tests)

**utils/**
- Purpose: Pure utility functions (testable, no side effects)
- Contains: Game logic helpers, coordinate math, storage
- Key files: `gameLogic.ts`, `coordinates.ts`, `storage.ts`, `audio.ts`, `device.ts`, `progression.ts`

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
- `core/GameEngine.ts` - Central game state and logic (~465 lines)
- `core/commands/actions.ts` - All game commands
- `utils/gameLogic.ts` - Pure game logic functions

**Types:**
- `types.ts` - All TypeScript interfaces and enums

**Testing:**
- `tests/gameLogic.test.ts` - Game logic tests
- `tests/coordinates.test.ts` - Coordinate system tests

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
*Update when directory structure changes*
