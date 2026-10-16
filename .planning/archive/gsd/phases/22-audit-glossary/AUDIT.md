---
title: Naming Audit - Phase 23 Rename Targets
type: checklist
tags: [audit, naming, refactor]
created: 2026-01-27
---

# Naming Audit for Phase 23

This document lists all code locations requiring renaming to match the official GLOSSARY.md terminology.

**Reference:** See `.planning/GLOSSARY.md` for official term definitions.

---

## Priority 1: softDrop -> fastDrop

**Rationale:** "Soft drop" is vestigial terminology from Tetris. Our game has no "hard drop" — the acceleration is simply "fast drop."

### Constants & Types (Rename First)

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `core/events/GameEvents.ts` | 37 | `INPUT_SOFT_DROP = 'INPUT_SOFT_DROP'` | `INPUT_FAST_DROP = 'INPUT_FAST_DROP'` |
| `core/GameEngine.ts` | 33 | `const SOFT_DROP_FACTOR = 8` | `const FAST_DROP_FACTOR = 8` |

### Type References (Update After Constants)

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `core/commands/actions.ts` | 152 | `type = 'SET_SOFT_DROP'` | `type = 'SET_FAST_DROP'` |

### Usage in Code

| File | Lines | Description |
|------|-------|-------------|
| `hooks/useInputHandlers.ts` | 237, 260, 262, 281, 327, 330, 449, 471, 474, 493, 530, 533 | Event emits using `INPUT_SOFT_DROP` |
| `Game.tsx` | 283 | Event subscription using `INPUT_SOFT_DROP` |
| `core/GameEngine.ts` | 1169 | Usage of `SOFT_DROP_FACTOR` |

### Comments to Update

| File | Lines | Current Wording |
|------|-------|-----------------|
| `types.ts` | 261, 263 | "soft drop" in comments |
| `complicationConfig.ts` | 23, 27 | "soft drop" in comments |
| `hooks/useInputHandlers.ts` | 6, 260 | "soft drop" in comments |
| `core/ComplicationManager.ts` | 129 | "soft drop" in comment |
| `core/GameEngine.ts` | 144, 293, 860, 861, 896, 905, 956, 1298 | "soft drop" in comments |
| `Game.tsx` | 306, 333 | "soft drop" in comments |

### Checklist

- [ ] Rename `INPUT_SOFT_DROP` to `INPUT_FAST_DROP` in GameEvents.ts
- [ ] Rename `SOFT_DROP_FACTOR` to `FAST_DROP_FACTOR` in GameEngine.ts
- [ ] Rename `SET_SOFT_DROP` to `SET_FAST_DROP` in actions.ts
- [ ] Update all `gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, ...)` calls
- [ ] Update event subscription in Game.tsx
- [ ] Update usage of SOFT_DROP_FACTOR in GameEngine.ts
- [ ] Update all comments containing "soft drop" to "fast drop"
- [ ] Run tests: `npm run test:run`
- [ ] Verify TypeScript compiles: `npx tsc --noEmit`

**Estimated changes:** ~30 code changes across 7 files

---

## Priority 2: totalUnits -> totalBlocks

**Rationale:** Per GLOSSARY.md, "unit" is not an official term. Use "block" for the content of cells.

### Type Definitions

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `types.ts` | 242 | `totalUnitsAdded: number` | `totalBlocksAdded: number` |
| `types.ts` | 243 | `totalUnitsPopped: number` | `totalBlocksPopped: number` |

### Initializations

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `core/GameEngine.ts` | 131 | `totalUnitsAdded: 0` | `totalBlocksAdded: 0` |
| `core/GameEngine.ts` | 132 | `totalUnitsPopped: 0` | `totalBlocksPopped: 0` |
| `core/GameEngine.ts` | 280 | `totalUnitsAdded: 0` | `totalBlocksAdded: 0` |
| `core/GameEngine.ts` | 281 | `totalUnitsPopped: 0` | `totalBlocksPopped: 0` |

### Usage

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `core/commands/actions.ts` | 178 | `engine.state.totalUnitsAdded +=` | `engine.state.totalBlocksAdded +=` |
| `core/commands/actions.ts` | 308 | `engine.state.totalUnitsPopped +=` | `engine.state.totalBlocksPopped +=` |

### Checklist

- [ ] Rename `totalUnitsAdded` to `totalBlocksAdded` in types.ts
- [ ] Rename `totalUnitsPopped` to `totalBlocksPopped` in types.ts
- [ ] Update initialization in GameEngine.ts (CONSOLE phase, lines 131-132)
- [ ] Update initialization in GameEngine.ts (PERISCOPE phase, lines 280-281)
- [ ] Update increment in actions.ts (HardDropCommand, line 178)
- [ ] Update increment in actions.ts (BlockTapCommand, line 308)
- [ ] Run tests: `npm run test:run`

**Estimated changes:** 8 code changes across 3 files

---

## Priority 3: Documentation Updates (Post-Code)

After code changes are complete, update these planning/documentation files:

### Planning Files

| File | Action |
|------|--------|
| `.planning/STATE.md` | Update terminology references |
| `.planning/PROJECT.md` | Update complication table |
| `.planning/codebase/CONVENTIONS.md` | Update code examples |
| `.planning/MILESTONES.md` | Update milestone descriptions |
| `PRD.md` | Update game mechanics descriptions |

### Archive Files (Optional)

Archive files document historical decisions and don't need updates for code correctness. Consider updating for clarity if time permits.

---

## No Changes Needed

### BlockData Interface

The `BlockData` interface in `types.ts` is **correctly named**:
- "Block" = content of a cell (per GLOSSARY.md)
- Properties like `groupId`, `color`, `timestamp` accurately describe block data
- No rename needed

### piece/goop Usage Pattern

Current code correctly uses:
- `piece` for falling/active objects (`ActivePiece`, `PieceDefinition`)
- `block` for settled content (`BlockData`, `FallingBlock`)

"Goop" should be used in:
- User-facing UI text
- Upgrade names (e.g., "Goop Dump", "Goop Colorizer")
- Comments describing the player's mental model

**No systematic code rename needed** — just maintain this pattern going forward.

---

## Execution Order for Phase 23

1. **Create feature branch:** `git checkout -b naming-standardization`
2. **Priority 1:** softDrop -> fastDrop (constants first, then usages)
3. **Priority 2:** totalUnits -> totalBlocks
4. **Run full test suite:** `npm run test:run`
5. **Verify build:** `npm run build`
6. **Priority 3:** Documentation updates
7. **Commit and merge**

---

## Verification Commands

```bash
# After all renames, verify no old terms remain in active code:
grep -r "softDrop\|SOFT_DROP\|soft_drop" --include="*.ts" --include="*.tsx" | grep -v "node_modules\|dist"
grep -r "totalUnits" --include="*.ts" --include="*.tsx" | grep -v "node_modules\|dist"

# Run tests
npm run test:run

# Type check
npx tsc --noEmit
```

---

*Created: 2026-01-27*
*Phase: 22-audit-glossary*
*For: Phase 23 execution*
