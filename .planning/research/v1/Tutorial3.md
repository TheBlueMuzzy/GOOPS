# Tutorial v3 — Rewrite Brief

**Date:** 2026-02-19
**Source:** Exhaustive code audit of Tutorial v2 + designer review
**Status:** All questions resolved. Ready for GSD planning.

---

## Table of Contents

1. [Design Intent](#1-design-intent)
2. [Confirmed Decisions](#2-confirmed-decisions)
3. [Engine Prerequisites](#3-engine-prerequisites)
4. [Architecture Direction](#4-architecture-direction)
5. [Step-by-Step Specification](#5-step-by-step-specification)
6. [Reusable Patterns](#6-reusable-patterns)
7. [D3 Discovery System](#7-d3-discovery-system)
8. [Engine Coupling Map](#8-engine-coupling-map)
9. [What Changes from v2](#9-what-changes-from-v2)

---

## 1. Design Intent

The tutorial is an **intentionally crafted, staged experience**. The player is NOT playing a real game — these are scripted events with specific happenings and interactions, fully guided so they can't make mistakes. If they do, the tutorial knows how to handle it.

The tutorial system must be:
- **Easy to edit** — changing a timing, color, or pause state should be trivial and non-destructive
- **Future-proofed** — new tutorials will be added at higher ranks when new concepts unlock
- **Modular** — patterns are reusable, custom logic is isolated
- **Garbled** — bracket notation `[text]` = garbled, keywords = green, no brackets = clear

---

## 2. Confirmed Decisions

| Decision | Confirmed |
|----------|-----------|
| Use state machine pattern | Yes |
| Phase A (console drag) | Keep — still needed |
| B1→B2 piece continuity | Keep — teaches slow→fast-drop on same piece |
| C3 three-concept message | Keep — clean progressive teaching (merge → fill time → vent) |
| D2 retries | Infinite — accumulate cracks (never remove old ones, add new near bottom row 1-2) |
| D3 persistent discovery | Keep — triggered by offscreen arrow appearing (simplified trigger) |
| E1→E2 skip → eliminated | E2 absorbed into E1 using standard "wait-then-hint" pattern |
| E-phase renumbered | E1 (seal+pop), E2 (scaffolding message) |
| F1 free play | Ends on swipe-up, only after pressure cap (95%) or overflow |
| F1 exit destination | Console screen, set rank to 1 (only if rank is 0) |
| Garble system | Keep exactly as-is |
| Tutorial teaches | Basics only — future tutorials at higher ranks for new concepts |
| Editable config | Yes — timings, colors, pause states should be easy to change |

---

## 3. Engine Prerequisites

### Bug Fix: Crack Sealing is Two-Step

**Current behavior (buggy):** Crack disappears when goop covers it (piece lock over matching crack).

**Correct behavior:** Crack sealing is a two-step process:
1. **Plug:** Matching goop covers the crack. Crack is "plugged" but still visible through the goop. The goop over the crack glows/outlines to indicate it's ready to seal.
2. **Seal:** Player pops the goop. The crack hardens and seals. The goop disintegrates. Crack disappears.

**Why this matters:** If the player covers a crack high up, then pops the bottom of the stack, the goop falls and the crack becomes uncovered — it was never sealed. Currently the engine removes the crack on lock, which is wrong.

**Engine changes needed:**
- `lockActivePiece`: When goop covers a matching crack, mark it as "plugged" (NOT consumed/removed)
- Plugged cracks should be visible through goop (rendered differently)
- Goop over a plugged crack should glow/outline to indicate "ready to seal"
- `GOOP_POPPED`: When goop over a plugged crack is popped → crack is sealed (removed) + GOAL_CAPTURED fires
- If plugged goop falls away (stack collapse), crack reverts to "unplugged"

**This is a core gameplay fix, not just a tutorial concern.** It affects normal gameplay too.

### Offscreen Crack Arrows

**Current implementation:** SVG triangles in GameBoard.tsx (lines 698-717). Rendered per-frame from `goalMarks` positions. No event system — purely visual.

**For D3 trigger:** Need to detect when an arrow FIRST appears (goalMark transitions from onscreen to offscreen). Options:
- a) Add a `CRACK_OFFSCREEN` event to the event bus (cleanest)
- b) Keep polling but check for arrow visibility (current approach, messier)

Recommendation: Add `CRACK_OFFSCREEN` event. Fires once when any goalMark moves from visible to offscreen. D3 listens for this single event.

---

## 4. Architecture Direction

### State Machine (Confirmed)

Each step goes through a lifecycle:
```
ENTERING → WAITING_FOR_TRIGGER → MESSAGE_VISIBLE → ARMED → ADVANCING
```

- **ENTERING:** Cleanup previous step, set engine state, spawn pieces/cracks
- **WAITING_FOR_TRIGGER:** Game may be running. Waiting for condition (position, pressure, event, timer)
- **MESSAGE_VISIBLE:** Message is showing. May be paused or running.
- **ARMED:** Player can trigger advance (action, event, tap)
- **ADVANCING:** Transition to next step

Pause/unpause is a PROPERTY of the state, not a scattered action. Each state knows whether the game should be paused.

### Handler Registry

Steps with custom behavior register handlers, NOT embedded in the main effect:
```
standardHandler    → used by most steps
retryHandler       → D2 (accumulating cracks on retry)
discoveryHandler   → D3 (persistent arrow listener)
continuousHandler  → E1, F1 (continuous spawn + event-driven flow)
freePlayHandler    → F1 (pressure cap cycle, overflow, swipe-up exit)
```

### Timeout Pool

One central manager. All timeouts registered with names:
```
pool.set('message-delay', callback, 2000)
pool.set('arm-advance', callback, 150)
pool.clearAll()  // On step change — guaranteed cleanup
```
No generation counters, no scattered refs.

### Editable Config

Step configs remain TypeScript (for type safety + IDE autocomplete) but designed so that:
- All timings are explicit named fields (not magic numbers in handlers)
- All colors are in config (not hardcoded in handlers)
- All pause/unpause decisions are in config (not scattered in code)
- Custom handlers read config values, not hardcoded constants

---

## 5. Step-by-Step Specification

### Phase A: Enter the Tank (1 step)

#### A1_WELCOME
**Purpose:** Teach console-to-tank transition via periscope drag
**Flow:**
1. Console screen visible, periscope highlighted
2. Message: "[Your] Operator training [begins now]. Drag [the] periscope down [to] start."
3. Player drags periscope → GAME_START → advance to B1
**Config:** `view: console`, `pauseGame: true`, `advance: drag-periscope`
**Journal:** Unlocks WELCOME

---

### Phase B: Goop Basics (4 steps)

#### B1_GOOP_FALLS
**Purpose:** Show what goop is — a piece falls from the extruder
**Flow:**
1. Blue I-piece spawns (horizontal, autoFall, all controls disabled)
2. Message: "[The] extruder drops goop into [the] tank."
3. Piece falls on its own, player watches
4. When piece reaches ~25% down → advance to B2 (piece still falling)
**Config:** `pauseGame: false`, `spawnPiece: blue T_I rotation:1 autoFall`, `advanceAtRow: 8`, all controls disabled

#### B2_FAST_DROP
**Purpose:** Teach fast-drop — same piece is still slowly falling
**Flow:**
1. Same piece from B1 continues falling (no new spawn)
2. Message: "[Yeah.] It's slow. Swipe down or [press] S [to] fast-drop."
3. Only fast-drop enabled
4. Player fast-drops → piece lands → advance to B3
**Config:** `pauseGame: false`, `advance: piece-landed`, fastDrop only

#### B3_ROTATION
**Purpose:** Teach piece rotation
**Flow:**
1. Yellow T-piece spawns, game runs
2. After 1200ms, game pauses + message about rotation
3. Player dismisses, rotates and drops
4. Piece lands → advance to B4
**Config:** `pauseGame: true`, `pauseDelay: 1200`, `spawnPiece: yellow T_T`, `advance: piece-landed`, fastDrop + rotate enabled
**Journal:** Unlocks DROP_INTRO

#### B4_PRACTICE
**Purpose:** Free practice rep — drop a simple piece
**Flow:**
1. Blue 2x2 spawns, pauses immediately
2. Message: "[Do it] again."
3. Player dismisses, drops piece
4. Piece lands → advance to C1
**Config:** `pauseGame: true`, `spawnPiece: blue T_O`, `advance: piece-landed`, fastDrop + rotate enabled

---

### Phase C: Pressure & Popping (4 steps)

#### C1_PRESSURE
**Purpose:** Show pressure rising — water covers their goop
**Flow:**
1. Pauses, message: "Pressure [builds] over time."
2. Player dismisses → pressure rises fast (2.5x)
3. When water line covers the yellow goop from B3 → advance to C2
**Config:** `pauseGame: true`, `pressureRate: 2.5`, `advanceWhenPressureAbovePieces: true`, `advancePressureAboveColor: yellow`, `autoSkipMs: 10000`, all controls disabled

#### C2_POP
**Purpose:** First pop lesson — tap highlighted goop to pop it
**Flow:**
1. Game running, pressure frozen
2. Yellow goop pulses, message: "Tap goop below [the] pressure [line] to pop [it]."
3. Player taps yellow goop → pop → advance to C3
4. **Hint safety net:** If player dismisses but doesn't pop within 3s → reshow message (non-dismissible), pause pressure
**Config:** `pauseGame: false`, `pressureRate: 0`, `highlightGoopColor: yellow`, `advance: pop-goop`, `hintDelay: 3000`, pop only
**Journal:** (none — POP_TIMING unlocked at C3)

#### C3_MERGE_SOLIDIFY
**Purpose:** Teach merge + fill time + vent size (three concepts from one pop)
**Flow:**
1. Game runs 1500ms (C2's pop animation plays out — merge visible)
2. Pauses + message: "Same-color goop merges. Bigger [blobs] vent more. [Fresh goop] needs a moment to set."
3. Player acknowledges → advance to C4
**Config:** `pauseGame: true`, `pauseDelay: 1500`, `advance: tap`
**Journal:** Unlocks POP_TIMING

#### C4_PRACTICE_POP
**Purpose:** Second pop rep targeting blue
**Flow:**
1. Game running, pressure frozen
2. Message hidden for 2s (player explores freely)
3. After 2s → "Pop [it]." appears, blue goop pulses
4. Player pops blue → advance to D1
5. **Hint safety net:** Same as C2 — reshow after 3s if not popped
**Config:** `pauseGame: false`, `pressureRate: 0`, `highlightGoopColor: blue`, `messageDelay: 2000`, `hintDelay: 3000`, `advance: pop-goop`, `popLowersPressure: true`, all controls except tank-rotate

---

### Phase D: Cracks & Tank Rotation (3 steps)

#### D1_CRACK
**Purpose:** Introduce cracks — what they are and how to seal them
**Flow:**
1. Green crack spawns at bottom (row 22, near existing goop)
2. Game runs 2500ms (C4 aftermath clears, crack appears)
3. Pauses + message: "Cracks [form in the] tank [wall]. Drop matching [color] goop [on them] to seal."
4. Player acknowledges → advance to D2
**Config:** `pauseGame: true`, `pauseDelay: 2500`, `spawnCrack: green near-stack row:22`, `advance: tap`, `pressureRate: 0`
**Journal:** Unlocks CRACK_INTRO

#### D2_TANK_ROTATION
**Purpose:** Teach tank rotation to reach and seal a crack
**Flow:**
1. Green 2x2 spawns, game runs
2. When piece reaches row 8 → pause + message: "Swipe left/right [or] A/D [to] spin [the] tank."
3. Player dismisses → rotates tank + drops green on crack
4. **On GOAL_CAPTURED (crack plugged):** Wait for pop to seal (uses standard hint pattern)
5. **If piece lands WITHOUT plugging crack → RETRY:**
   - Don't remove old cracks
   - Spawn additional green crack near bottom (row 1-2), visible
   - Spawn new green 2x2
   - Show retry message: "Try again! Spin [the] tank [to] align [the] goop with [the] crack."
   - Accumulating cracks make success eventually inevitable
6. On crack sealed (popped) → advance to D3
**Config:** `pauseGame: true (delayed)`, `showWhenPieceBelow: 8`, `spawnPiece: green T_O`, `pressureRate: 0.46875`, `advance: crack-sealed`, all controls enabled, `retryOnPieceLand` with accumulating cracks
**Journal:** Unlocks ROTATE_INTRO

**Note on retry:** Old cracks stay. New cracks spawn near bottom. Eventually the bottom is full of cracks and the player can't miss. Retry delays should be configurable.

#### D3_OFFSCREEN
**Purpose:** Teach cylindrical awareness — cracks can be offscreen
**Trigger:** D3 is a **discovery step**. It fires when an offscreen crack arrow first appears.

**Flow:**
1. During D2 and beyond, a listener watches for the `CRACK_OFFSCREEN` event (arrow appears)
2. When triggered: pause + message: "[You] only see 1/3 [of the] tank. Cracks [can] spawn anywhere."
3. Player acknowledges → D3 complete
4. **If D3 never triggers during D2:** It stays armed through E1, E2, F1
5. During F1 free play, cracks naturally spawn (some offscreen) → arrow appears → D3 fires
6. D3 fires ONCE ever. After it fires, the listener is removed permanently.

**Simplified trigger (vs v2):** Instead of polling crack positions, listen for a single `CRACK_OFFSCREEN` event that fires when an arrow first appears in the UI. One event, one handler, one message.
**Journal:** Unlocks WRAP_INTRO

---

### Phase E: Scaffolding (2 steps) *(renumbered from v2's 3 steps)*

#### E1_SEAL_CRACK
**Purpose:** Teach building up to reach a high crack, then sealing it (plug + pop)
**Flow:**
1. Green crack spawns at pressure line (high up)
2. Green 2x2 spawns, continuous spawn active
3. Player stacks goop to reach the high crack
4. When goop covers the crack (GOAL_CAPTURED = plugged):
   - Suppress continuous spawn (no more pieces)
   - Freeze falling pieces
   - Goop over crack glows (engine: plugged crack indicator)
   - **Standard hint pattern:** Wait 3s. If player pops before 3s → skip message. If 3s passes → show "Pop [the] goop [to] seal the crack." (non-dismissible), pause pressure, green highlight
   - Player pops → crack sealed → advance to E2
5. Safety: `autoSkipMs: 90000`
**Config:** `pauseGame: false`, `continuousSpawn: true`, `spawnPiece: green T_O`, `spawnCrack: green at-pressure-line`, `pressureRate: 0.46875`, all controls enabled, `advance: pop-goop` (after GOAL_CAPTURED), `hintDelay: 3000`

**Key insight:** The "wait 3s then hint" is the SAME pattern as C2/C4. When the hint shows, pressure pauses. Standard behavior.

#### E2_SCAFFOLDING *(was E3 in v2)*
**Purpose:** Name the scaffolding strategy
**Flow:**
1. Wait 1500ms for pop animation
2. Pause + message: "Cracks [spawn] higher as [the] pressure builds. Stack goop [to] reach [them]."
3. Player acknowledges → advance to F1
**Config:** `pauseGame: true`, `pauseDelay: 1500`, `advance: tap`

---

### Phase F: Graduation (1 step)

#### F1_GRADUATION
**Purpose:** Free play with all mechanics, graceful exit to console
**Flow:**
1. 2000ms breathing room, then pause + graduation message
2. Message: "[That] covers [the] basics. Don't [let the] goop [pile] too high."
3. Player dismisses → **FREE PLAY:**
   - Continuous pieces spawn
   - Cracks spawn every 10s
   - Pressure rises at normal rate (0.5)
   - All controls enabled
   - `popLowersPressure: true`

4. **ENDING 1 — Pressure Cap (95%):**
   - Pressure hits 95% → freeze pressure
   - Non-dismissible message: "[I've] stopped [the] pressure [so you can] practice. Swipe up [to] leave training."
   - Swipe-up enabled
   - **If player pops enough to drop below 95%:** Resume pressure, stop showing message
   - **If pressure re-caps at 95%:** Show same message again (re-cap cycle)
   - Player swipes up → exit

5. **ENDING 2 — Overflow:**
   - Stack reaches top → GAME_OVER
   - Everything freezes
   - Non-dismissible message: "[You] overflowed [the] tank! Training [is] over. Swipe up [to] end."
   - Player swipes up → exit

6. **On exit (either ending):**
   - Return to console screen (NOT game-over screen)
   - If current rank is 0 → set rank to 1
   - If current rank > 0 (replay) → do NOT change rank

**Config:** `pauseGame: true`, `pauseDelay: 2000`, `continuousSpawn: true`, `pressureCap: 0.95`, `periodicCrackIntervalMs: 10000`, `pressureRate: 0.5`, all controls enabled, `advance: swipe-up` (gated on ending)
**Journal:** Unlocks FIRST_SHIFT

---

## 6. Reusable Patterns

### Pattern 1: Pause-Show-Dismiss-Unpause
**Used by:** A1, B3, B4, C1, C3, D1, E2, F1 (entry message)
**Config:** `pauseGame: true`, optional `pauseDelay`
**State machine:** ENTERING → MESSAGE_VISIBLE (paused) → ARMED → player taps → ADVANCING

### Pattern 2: Run-Act-Advance
**Used by:** B1, B2, C2, C4, E1 (after GOAL_CAPTURED)
**Config:** `pauseGame: false`, `advance: { action | event }`
**State machine:** ENTERING → ARMED (running) → player acts → ADVANCING

### Pattern 3: Hint Safety Net (Wait-Then-Remind)
**Used by:** C2, C4, E1 (after crack plugged)
**How it works:**
- Player should perform action X
- After N seconds of inaction → show hint message, pause pressure
- If player acts before N seconds → skip message entirely
- If message is showing and player acts → close message, continue
**Config:** `hintDelay: 3000` (or whatever ms), `highlightGoopColor`, `nonDismissible: true`
**This is the standardized version of what v2 did with reshowAfterMs + custom E1 handler.**

### Pattern 4: Position-Gated
**Used by:** B1 (advanceAtRow), D2 (showWhenPieceBelow)
**How it works:** Poll piece Y, trigger at threshold

### Pattern 5: Pressure-Gated
**Used by:** C1 (advanceWhenPressureAbovePieces)
**How it works:** Poll PSI, trigger at threshold

### Pattern 6: Continuous Spawn
**Used by:** E1, F1
**How it works:** After each piece locks, spawn next after delay

### Pattern 7: Retry with Accumulating Cracks
**Used by:** D2
**How it works:** Miss → keep old cracks, add new one near bottom, re-spawn piece, retry message

### Pattern 8: Discovery Interrupt
**Used by:** D3
**How it works:** Persistent listener across steps. Fires once on CRACK_OFFSCREEN event. Pauses, shows message, marks complete. Doesn't affect current step progression.

---

## 7. D3 Discovery System

The D3 discovery system is architecturally unique — it crosses step boundaries. Here's the simplified design:

### Trigger
Listen for `CRACK_OFFSCREEN` event (new event — fires when any goalMark transitions from onscreen to offscreen in the viewport). This replaces the v2 approach of polling crack positions every 200ms.

### Lifecycle
1. **Armed during:** D2, E1, E2, F1 (any step after D1 that has cracks)
2. **Fires when:** An offscreen arrow first appears (crack moves or spawns offscreen)
3. **On fire:** Interrupt current step → pause → show D3 message → player acknowledges
4. **After acknowledge:** Resume current step exactly where it was. D3 marked complete permanently.
5. **Never fires again:** One-time discovery. Stored in completedSteps (persisted).

### Why It Must Persist
- During D2: Player might seal the crack on their first try without rotating far enough to push any crack offscreen. D3 never triggers.
- During E1/E2: Cracks are spawned at pressure line. If continuous spawn pushes the view, a crack might go offscreen.
- During F1: Periodic cracks spawn randomly. Some will be offscreen naturally. This is the guaranteed fallback.
- If the player completes training without D3 triggering, they still learn it early in normal gameplay.

### Simplification from v2
- **v2:** 200ms polling interval checking `isAnyCrackOffscreen()` + persistent ref that skips cleanup + discoveryInterruptRef + d3MessageShownRef
- **v3:** Single `CRACK_OFFSCREEN` event listener. Check `completedSteps.includes('D3_OFFSCREEN')`. If not complete, fire. One listener, one check.

---

## 8. Engine Coupling Map

### Properties Tutorial Sets on GameEngine
| Property | Purpose |
|----------|---------|
| `isTrainingMode` | Master flag — changes tick, spawn, lock, timer behavior |
| `pendingTrainingPalette` | Queue training start before entering tank |
| `trainingAllowedControls` | Per-step input gates (rotate, pop, fastDrop, tankRotate) |
| `trainingPressureRate` | PSI speed (0 = frozen, 0.5 = normal, 2.5 = fast) |
| `trainingHighlightColor` | Pop color restriction + CSS pulse |
| `freezeFalling` | Stop piece fall speed |

### Recommendation: Bundle into `trainingConfig`
```typescript
engine.trainingConfig = {
  allowedControls: AllowedControls | null,
  pressureRate: number,
  highlightColor: string | null,
  freezeFalling: boolean,
}
// Single cleanup: engine.trainingConfig = null
```

### Engine Behaviors in Training Mode
| Feature | Normal | Training |
|---------|--------|----------|
| Grid init | Pre-filled junk | Empty |
| Piece pool | All shapes + corrupted | Tetra only, clean |
| Piece spawn after lock | Auto | Paused — flow controls |
| Timer at 0 | Game over | Clamp (game continues) |
| Tick systems | All (goals, cracks, complications, heat, lights, charges) | All skipped — flow manages |
| Collision on spawn | finalizeGame() | Emit GAME_OVER only |
| Crack sealing | (Currently: remove on lock — BUGGY) | Should be: plug on lock, seal on pop |

---

## 9. What Changes from v2

### Steps: 15 total (was 16)
- E2_POP_SEALED eliminated (absorbed into E1 via standard hint pattern)
- E3_SCAFFOLDING renumbered to E2_SCAFFOLDING
- All other steps remain

### Architecture: State machine (was effect chains)
- Step lifecycle: ENTERING → WAITING → MESSAGE_VISIBLE → ARMED → ADVANCING
- Pause/unpause tied to state transitions, not scattered calls
- Timeout pool replaces 20+ individual refs
- Handler registry replaces if-chains in main effect

### D2 Retry: Accumulating cracks (was pop-all reset)
- v2: Pop ALL goop, clean slate, respawn one crack
- v3: Keep all existing cracks, add new one near bottom. Tank fills with cracks until success is inevitable.

### D3 Trigger: Event-based (was polling)
- v2: Poll every 200ms for offscreen crack positions
- v3: Listen for single CRACK_OFFSCREEN event

### E1 Post-Seal: Standard hint pattern (was 65-line custom handler)
- v2: Custom GOAL_CAPTURED handler with suppressRef, skip mechanic, cross-step E2 marking
- v3: Same "wait-then-hint" pattern as C2/C4. Wait 3s, show if no pop, pause pressure.

### Engine: Crack sealing fix (was instant removal)
- v2: Crack disappears on piece lock
- v3: Crack "plugged" on lock, "sealed" on pop. Glow indicator when plugged.

### Config: Easy editing (was fragile)
- All timings as named config fields
- All colors in config
- All pause decisions in config
- Custom handlers read config, not hardcoded constants

---

## Summary

| Phase | Steps | Teaches |
|-------|-------|---------|
| A | 1 (A1) | Console → tank transition |
| B | 4 (B1-B4) | Goop falling, fast-drop, rotation, practice |
| C | 4 (C1-C4) | Pressure, popping, merge/solidify, practice pop |
| D | 3 (D1-D3) | Cracks, tank rotation + retry, offscreen discovery |
| E | 2 (E1-E2) | Seal high crack (plug+pop), scaffolding strategy |
| F | 1 (F1) | Free play, pressure cap cycle, graceful exit |
| **Total** | **15 steps** | |

Ready for GSD plan creation. Use this document as the source of truth.
