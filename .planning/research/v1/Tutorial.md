# Tutorial Sequence — Complete Reference

> 16 steps across 6 phases. Timing, triggers, and flow for every step.

---

## Phase A — Console Briefing

### A1: Welcome Briefing
| Field | Value |
|-------|-------|
| **Intent** | Introduce the game premise and set expectations |
| **View** | Console (not in tank yet) |
| **Message** | `[Welcome] Operator. [You must complete] training [before your first] shift.` |
| **Keywords** | Operator, shift |
| **Spawns** | None |
| **Pressure** | 0 (frozen) |
| **Controls** | N/A (console view) |
| **Timing** | Message shows immediately, game paused |
| **Advance** | Tap to dismiss |
| **Marks Complete** | `WELCOME` |

---

### A2: Enter the Tank
| Field | Value |
|-------|-------|
| **Intent** | Teach periscope interaction to enter the tank |
| **View** | Console (with periscope highlight) |
| **Message** | `[Use the] periscope [to] look inside [the] tank. Drag [it] down [to] start [your shift].` |
| **Keywords** | periscope, tank |
| **Spawns** | None |
| **Pressure** | N/A |
| **Controls** | Periscope drag only |
| **Timing** | Message shows immediately, game paused |
| **Advance** | Player drags periscope down (fires `GAME_START` event) |
| **Marks Complete** | — |

---

## Phase B — Goop Basics

### B1: Goop Introduction
| Field | Value |
|-------|-------|
| **Intent** | Show goop falling slowly — player watches, no interaction |
| **View** | Tank |
| **Message** | `[The goop] extruder [drops] goop into [the] tank. [The goop] drops slowly.` |
| **Keywords** | goop, tank |
| **Spawns** | Blue T_I piece (horizontal, rotation: 1) |
| **Pressure** | 0 (frozen) |
| **Controls** | ALL disabled (watch only) |
| **Timing** | Game NOT paused. Piece starts falling immediately. Message shows immediately. |
| **Auto-advance** | When piece reaches row 8 (~25% down) → advances to B1B |
| **Advance** | Event: `piece-landed` (backup if position advance misses) |
| **Marks Complete** | — |

> **Flow:** Piece falls → B1 message visible while falling → piece hits row 8 → auto-advance to B1B (piece keeps falling, same piece)

---

### B1B: Slow Comment
| Field | Value |
|-------|-------|
| **Intent** | Acknowledge the slowness — builds rapport |
| **View** | Tank |
| **Message** | `[Yeah.] It's slow.` |
| **Keywords** | slow |
| **Spawns** | None (same piece from B1 still falling) |
| **Pressure** | 0 (frozen) |
| **Controls** | ALL disabled (still watching) |
| **Timing** | Game NOT paused. Message shows immediately. Same piece keeps falling. |
| **Auto-advance** | When piece reaches row 11 (~40% down) → advances to B2 |
| **Advance** | Event: `piece-landed` |
| **Marks Complete** | — |

> **Flow:** Same piece continues falling → hits row 11 → auto-advance to B2 (piece keeps falling)

---

### B2: Fast Fall
| Field | Value |
|-------|-------|
| **Intent** | Teach fast-drop input (first real player action) |
| **View** | Tank |
| **Message** | `Swipe down [or] press S [to] fast-drop. [The] faster [you place it, the] better.` |
| **Keywords** | fast-drop, Swipe, S |
| **Spawns** | None (same piece from B1 still falling) |
| **Pressure** | 0 (frozen) |
| **Controls** | Fast-drop ENABLED. Rotate/tank-rotate disabled. |
| **Timing** | Game NOT paused. Message shows immediately. Player can fast-drop the piece. |
| **Advance** | Event: `piece-landed` (piece lands naturally or via fast-drop) |
| **Marks Complete** | — |

> **Flow:** B1→B1B→B2 all happen during the SAME piece fall. B2 unlocks fast-drop so player can slam it down.

---

### B3: Piece Rotation
| Field | Value |
|-------|-------|
| **Intent** | Teach rotation controls |
| **View** | Tank |
| **Message** | `Rotate [the] goop [with] Q/E or tap [the] left/right side [of the] tank.` |
| **Keywords** | Rotate, goop, Q/E, tap, left/right, tank |
| **Spawns** | Yellow T_T piece |
| **Pressure** | 0 (frozen) |
| **Controls** | Fast-drop + rotate ENABLED. Tank-rotate disabled. |
| **Timing** | Piece spawns and starts falling immediately. **After 1.2s delay** → game pauses, message shows (piece frozen mid-fall). |
| **Advance** | Event: `piece-landed` (dismiss message → piece resumes → player rotates and lands it) |
| **Marks Complete** | `DROP_INTRO` |

> **Timing detail:** `pauseDelay: 1200` — piece falls for 1.2 seconds before message appears. Player sees the piece moving, then it freezes and the message explains rotation.

---

### B4: Practice Drop
| Field | Value |
|-------|-------|
| **Intent** | Free practice with fast-drop + rotation |
| **View** | Tank |
| **Message** | `Practice [what you've] learned [with] another goop.` |
| **Keywords** | Practice, goop |
| **Spawns** | Blue T_O piece (2x2 square) |
| **Pressure** | 0 (frozen) |
| **Controls** | Fast-drop + rotate ENABLED. Tank-rotate disabled. |
| **Timing** | Game paused. Message shows immediately. Dismiss → piece falls, player practices. |
| **Advance** | Event: `piece-landed` |
| **Marks Complete** | — |

---

## Phase C — Pressure & Popping

### C1: Pressure & Laser
| Field | Value |
|-------|-------|
| **Intent** | Introduce the pressure mechanic |
| **View** | Tank |
| **Message** | `Pressure [increases] over time. [Use the] laser [to] pop goop [to] vent [some of the] pressure.` |
| **Keywords** | Pressure, laser, goop, pressure |
| **Spawns** | None |
| **Pressure** | 0.625 rate (starts rising) |
| **Controls** | ALL disabled including pop |
| **Timing** | Game paused. Message shows immediately. Dismiss → pressure starts rising. |
| **Advance** | When PSI reaches 5% (`advanceAtPressure: 5`). Fallback: auto-advance after 60s. |
| **Marks Complete** | — |

> **Flow:** Dismiss → pressure rises → hits 5% → auto-advance to C1B. Player just watches pressure build.

---

### C1B: Pressure Rising
| Field | Value |
|-------|-------|
| **Intent** | Dramatic moment — pressure passing the goop stack |
| **View** | Tank |
| **Message** | `[The] Pressure rises slowly... but [it's always] faster than you think.` |
| **Keywords** | Pressure |
| **Spawns** | None |
| **Pressure** | 0.625 rate (still rising) |
| **Controls** | ALL disabled including pop |
| **Timing** | Game NOT paused. Message shows immediately. Pressure keeps rising behind the message. |
| **Advance** | When pressure line passes highest YELLOW goop (`advanceWhenPressureAbovePieces: true`, `advancePressureAboveColor: YELLOW`). Fallback: auto-advance after 60s. |
| **Marks Complete** | — |

> **Why yellow filter?** Grid has blue pieces from B-phase stacked below yellow. We want to advance when pressure covers the yellow T — not wait for it to pass all the blues below.

---

### C1C: Pop Instruction
| Field | Value |
|-------|-------|
| **Intent** | Player's first pop — teaches tapping goop to vent |
| **View** | Tank |
| **Message** | `[The] Pressure [is] high enough [now]. Tap [to] pop [the] goop below [the Pressure] line.` |
| **Keywords** | Pressure, pop, goop, Tap |
| **Spawns** | None |
| **Pressure** | **0 (frozen)** — focus on learning to pop, not pressure stress |
| **Controls** | Fast-drop/rotate/tank-rotate disabled. Pop enabled (via highlight system). |
| **Highlight** | Yellow goop pulses (`highlightGoopColor: YELLOW`) |
| **Timing** | Game NOT paused (`pauseGame: false`). Player can pop while reading. |
| **Reshow** | If not popped within 3s of dismiss → message re-shows as **non-dismissible** (no close button, pressure frozen, game still running) |
| **Advance** | Action: `pop-goop` (player taps yellow goop) |
| **Marks Complete** | — |

> **Key mechanic:** Non-dismissible reshow keeps the game running (so player can still tap goop) but hides the close button. Message only clears when the pop action fires.

---

### C2: Color Merging
| Field | Value |
|-------|-------|
| **Intent** | Show that same-color goop merges (happens from C1C's pop clearing yellow, leaving blues to merge) |
| **View** | Tank |
| **Message** | `Same color goop merges [together into] bigger [goop]. Popping bigger [goops] vents more [pressure].` |
| **Keywords** | goop, merges |
| **Spawns** | None |
| **Pressure** | 0.3125 rate |
| **Controls** | Fast-drop + rotate ENABLED. Tank-rotate disabled. |
| **Timing** | **1s delay** after pop (`pauseDelay: 1000`) — lets pop droplets fade, then pauses and shows message. |
| **Advance** | Tap to dismiss |
| **Marks Complete** | — |

> **Flow:** C1C pop fires → 1 second passes (droplets fade) → game pauses → merge message shows.

---

### C3: Solidify Timing
| Field | Value |
|-------|-------|
| **Intent** | Teach that fresh goop needs time to solidify before it can be popped |
| **View** | Tank |
| **Message** | `Fresh goop needs [time to] solidify before [it can be] popped. [The] pressure must [be] high [enough] as well.` |
| **Keywords** | goop, pressure |
| **Spawns** | None |
| **Pressure** | 0.3125 rate |
| **Controls** | Fast-drop + rotate ENABLED. Tank-rotate disabled. |
| **Timing** | Game paused. Message shows immediately after C2 advance. |
| **Advance** | Tap to dismiss |
| **Marks Complete** | `POP_TIMING` |

---

### C3B: Pop Prompt
| Field | Value |
|-------|-------|
| **Intent** | Nudge player to pop the merged blue goop — practice popping |
| **View** | Tank |
| **Message** | `Pop [the] goop.` |
| **Keywords** | Pop, goop |
| **Spawns** | None |
| **Pressure** | 0.3125 rate (must reach the merged blue goop for pop to work) |
| **Controls** | Fast-drop + rotate ENABLED. Tank-rotate disabled. |
| **Timing** | Game NOT paused. **2s delay** before message appears (`messageDelay: 2000`). If player taps/interacts before 2s → message shows instantly (`showOnInput: true`). |
| **Advance** | Action: `pop-goop` |
| **Marks Complete** | — |

> **Pressure must reach the blue goop.** Rate 0.3125 is slow enough for the player to read but fast enough that pressure eventually covers the merged blue blob.

---

## Phase D — Cracks & Sealing

### D1: Crack + Seal (Introduction)
| Field | Value |
|-------|-------|
| **Intent** | Introduce cracks — player sees one for the first time |
| **View** | Tank |
| **Message** | `You [have] one job! Cracks form in [the] tank [wall]. Cover [them with matching] color goop. [Then] seal [them] with [the] laser.` |
| **Keywords** | Cracks, tank, goop, laser |
| **Spawns** | Green crack (`near-stack` — right side viewport, row 22) |
| **Pressure** | 0.46875 rate |
| **Controls** | Fast-drop + rotate ENABLED. **Tank-rotate disabled** (not taught yet). |
| **Timing** | **2.5s delay** (`pauseDelay: 2500`) — lets C3B pop droplets fade AND crack appear visually before message shows. |
| **Advance** | Tap to dismiss |
| **Marks Complete** | `CRACK_INTRO` |

> **Flow:** C3B pop fires → D1 starts → crack spawns + pressure runs for 2.5s → game pauses → message shows. Player sees the crack before reading about it.

---

### D2: Tank Rotation
| Field | Value |
|-------|-------|
| **Intent** | Teach tank rotation — align falling goop with crack |
| **View** | Tank |
| **Message** | `Swipe left/right [or use] A/D [to] spin [the] tank. [This will] align [the falling] goop [with the] crack.` |
| **Keywords** | tank, goop, crack, Swipe, left/right, A/D, spin |
| **Spawns** | Green T_O piece (2x2 square) |
| **Pressure** | 0.46875 rate |
| **Controls** | ALL ENABLED (fast-drop, rotate, **tank-rotate unlocked**) |
| **Timing** | Game starts UNPAUSED. Piece falls. **Message appears when piece reaches row 8** (~25% down, `showWhenPieceBelow: 8`). Game pauses when message shows. |
| **Advance** | Event: `crack-sealed` (goop covers crack + laser seals it) |
| **Marks Complete** | `ROTATE_INTRO` |

#### D2 Retry (if piece lands without sealing)

| Phase | Timing | What Happens |
|-------|--------|--------------|
| **1. Freeze** | Immediate | Pressure freezes. Falling freezes. Landed piece sits visible. |
| **2. Pop** | +1 second | All goop on board pops with droplet animation. |
| **3. Retry** | +1.5 seconds | Extra green crack spawns (bottom 2 rows). Retry message shows. New green T_O piece spawned (frozen). |

**Retry message:** `Try again! Spin [the] tank [with] A/D or [by] dragging left/right so that [the] goop covers [the] crack.`

> **On dismiss:** Pressure restores to 0.46875. Game unpauses. New piece falls. Player tries again.

---

### D3: Offscreen Cracks (Discovery)
| Field | Value |
|-------|-------|
| **Intent** | Teach cylindrical awareness — cracks exist beyond the visible 1/3 |
| **View** | Tank |
| **Message** | `[You] only see 1/3 [of the] tank [at a time]. Cracks [can] form anywhere. Spin [the] tank [to] find [the next] crack.` |
| **Keywords** | tank, Cracks |
| **Spawns** | Green crack (`near-stack` — visible on screen) |
| **Pressure** | 0.46875 rate |
| **Controls** | ALL ENABLED |
| **Timing** | Game starts UNPAUSED. Message is hidden. |
| **Trigger** | **Discovery:** Message appears when ANY crack is rotated offscreen (arrow indicator appears). Matches arrow threshold: `distance >= VIEWPORT_WIDTH / 2` from center. |
| **Auto-skip** | If player never rotates a crack offscreen → **auto-advance after 15 seconds** (skip silently) |
| **Advance** | Tap to dismiss |
| **Marks Complete** | `WRAP_INTRO` |

> **This is optional learning.** If the player naturally spins the tank and pushes a crack offscreen, they discover the message. If they don't explore, it auto-skips and they'll figure it out during real gameplay.

---

## Phase E — Scaffolding

### E1: Build Scaffolding
| Field | Value |
|-------|-------|
| **Intent** | Teach stacking goop to reach higher cracks |
| **View** | Tank |
| **Message** | `Cracks [form] higher [as the] pressure increases. Stack goop [to] reach higher cracks.` |
| **Keywords** | Cracks, pressure, goop, cracks |
| **Spawns** | None (uses whatever is on the board) |
| **Pressure** | 0.46875 rate |
| **Controls** | ALL ENABLED |
| **Timing** | Game paused. Message shows immediately. |
| **Advance** | Event: `crack-sealed` (player must seal a crack to prove they understand) |
| **Marks Complete** | — |

---

## Phase F — Endgame

### F1: Clear Residual
| Field | Value |
|-------|-------|
| **Intent** | Teach end-of-shift cleanup |
| **View** | Tank |
| **Message** | `Clear [as much] residual goop [as possible] before [the] shift end. Don't let [the] goop overflow [the top of] the tank!` |
| **Keywords** | goop, shift, tank |
| **Spawns** | None |
| **Pressure** | **0 (frozen)** |
| **Controls** | ALL ENABLED |
| **Timing** | Game paused. Message shows immediately. |
| **Advance** | Tap to dismiss |
| **Marks Complete** | — |

---

### F2: Practice Mode
| Field | Value |
|-------|-------|
| **Intent** | Free practice until player is ready — overflow to end |
| **View** | Tank |
| **Message** | `We'll turn [the] pressure off [so you can] practice. When [you're] done practicing, [just let the goop] overflow [the] tank.` |
| **Keywords** | pressure, tank |
| **Spawns** | None |
| **Pressure** | **0 (frozen)** |
| **Controls** | ALL ENABLED |
| **Timing** | Game paused. Message shows immediately. Dismiss → free play until overflow. |
| **Advance** | Event: `game-over` (goop overflows the tank) |
| **Marks Complete** | `FIRST_SHIFT` |

> **Training complete!** After overflow, `TRAINING_SCENARIO_COMPLETE` event fires. Player moves to rank 1.

---

## Timing Reference

### Message Visibility Strategies

| Strategy | How Message Appears | Used By |
|----------|-------------------|---------|
| **Immediate** | Shows on step start, game paused | A1, A2, B4, C1, C3, E1, F1, F2 |
| **Non-pausing immediate** | Shows on step start, game running | B1, B1B, B2, C1B |
| **pauseDelay** | Hidden → delay → pause + show | B3 (1.2s), C2 (1s), D1 (2.5s) |
| **showWhenPieceBelow** | Hidden → piece reaches row → pause + show | D2 (row 8) |
| **showWhenCracksOffscreen** | Hidden → any crack rotated offscreen → pause + show | D3 (discovery) |
| **messageDelay + showOnInput** | Hidden → show on input OR after delay | C3B (2s / on input) |
| **Non-pausing + reshow** | Shows, dismissible, re-shows non-dismissible if action not taken | C1C (reshow after 3s) |

### Key Delays

| Constant | Value | Context |
|----------|-------|---------|
| B3 pauseDelay | 1200ms | Let piece fall before explaining rotation |
| C2 pauseDelay | 1000ms | Let pop droplets fade before merge message |
| D1 pauseDelay | 2500ms | Let pop droplets + crack spawn settle |
| D2 showWhenPieceBelow | Row 8 | ~25% down viewport |
| C3B messageDelay | 2000ms | Wait before showing pop hint |
| C1C reshowAfterMs | 3000ms | Re-remind if goop not popped |
| D2 retry phase 1→2 | 1000ms | Piece sits before popping |
| D2 retry phase 2→3 | 1500ms | Droplets settle before message |
| D3 auto-skip | 15000ms | Skip discovery if never triggered |
| Advance arm delay | 150ms | Prevent dismiss-tap from triggering action |
| Position poll | 200ms | Check piece Y / cracks offscreen |
| Pressure poll | 250ms | Check PSI thresholds |

### Advance Conditions

| Type | How It Works | Used By |
|------|-------------|---------|
| `tap` | Player taps dismiss button | A1, C2, C3, D1, D3, F1 |
| `action: drag-periscope` | Player drags periscope (GAME_START) | A2 |
| `action: pop-goop` | Player pops goop (GOOP_POPPED) | C1C, C3B |
| `event: piece-landed` | Piece locks into grid (PIECE_DROPPED) | B1, B1B, B2, B3, B4 |
| `event: crack-sealed` | Goop seals a crack (GOAL_CAPTURED) | D2, E1 |
| `event: game-over` | Goop overflows tank (GAME_OVER) | F2 |
| `auto` (with delay) | Timer fires (fallback) | C1 (60s), C1B (60s) |
| `advanceAtRow` | Piece reaches Y threshold | B1 (row 8), B1B (row 11) |
| `advanceAtPressure` | PSI reaches threshold | C1 (5%) |
| `advanceWhenPressureAbovePieces` | Pressure line passes highest goop | C1B (yellow filter) |

---

## Controls Progression

| Step | Fast-Drop | Rotate | Tank-Rotate | Pop |
|------|-----------|--------|-------------|-----|
| A1, A2 | - | - | - | - |
| B1, B1B | off | off | off | off |
| B2 | **ON** | off | off | off |
| B3, B4 | on | **ON** | off | off |
| C1, C1B | off | off | off | off |
| C1C | off | off | off | **ON** (via highlight) |
| C2, C3, C3B | on | on | off | on |
| D1 | on | on | off | on |
| D2+ | on | on | **ON** | on |

---

## Pressure Progression

| Step | Rate | Notes |
|------|------|-------|
| A1–B4 | 0 | Frozen — learning basics |
| C1–C1B | 0.625 | Rising — demonstrates pressure mechanic |
| C1C | 0 | Frozen — focus on learning to pop |
| C2–C3B | 0.3125 | Moderate — needs to reach blue goop |
| D1–D3 | 0.46875 | Higher — approaching real gameplay speed |
| E1 | 0.46875 | Same as D-phase |
| F1–F2 | 0 | Frozen — free practice |

---

## Garble System

Text in `[brackets]` is garbled (full-word replacement with static). Text without brackets is clear. **Keywords** render in green. No partial character corruption.

Example: `Swipe down [or] press S [to] fast-drop.`
- "Swipe", "down", "press", "S", "fast-drop" = clear/green
- "[or]", "[to]" = garbled static

---

## Piece Spawns

| Step | Color | Shape | Rotation | Notes |
|------|-------|-------|----------|-------|
| B1 | Blue | T_I | 1 (horizontal) | First piece — watch it fall |
| B3 | Yellow | T_T | — | Rotation practice |
| B4 | Blue | T_O (2x2) | — | Free practice |
| D2 | Green | T_O (2x2) | — | Cover the crack |

## Crack Spawns

| Step | Color | Placement | Notes |
|------|-------|-----------|-------|
| D1 | Green | near-stack | Right side viewport, row 22 |
| D2 retry | Green | near-stack | Extra crack on each retry, bottom 2 rows |
| D3 | Green | near-stack | Visible — player rotates it offscreen to trigger discovery |

---

## Design Audit (2026-02-15)

### What Works Well
- **Watch → Learn → Do** rhythm is strong through A-D. Every mechanic gets three beats.
- **Controls unlock in a clean staircase**: nothing → fast-drop → rotate → pop → tank-rotate.
- **Timing matches cognitive load**: B has no pressure, C introduces it gently, D has real urgency.
- **B1→B1B→B2 same-piece flow** is elegant — three steps during one fall, zero wasted time.
- **D2 retry system** is thorough with staged timing (freeze → pop → message).
- **D3 discovery pattern** is organic — triggers on natural exploration, auto-skips if not found.

### What Needs Improvement

| Priority | Issue | Details |
|----------|-------|---------|
| **High** | E1 has no spawns | Says "stack goop to reach higher cracks" but spawns no crack and no piece. Player can't practice scaffolding. |
| **High** | D1 says "seal with the laser" | Sealing is automatic (matching goop + landing = sealed). Laser mention is misleading. |
| **High** | F-phase is a placeholder | F1 says "clear goop" at 0 pressure (no motivation). F2 says "overflow on purpose" (first game-over is intentional, not organic). |
| **Medium** | C-phase has 6 steps for 2 concepts | Pressure + popping could be taught in 3-4 steps. C1→C1B is two steps of watching; C3→C3B is two steps of "pop the goop." |
| **Medium** | D3 auto-skip loses the lesson entirely | If skipped, player never learns about cylindrical wrapping until real gameplay. Consider keeping it armed through E/F. |
| **Medium** | C1C pressure freeze is abrupt | Pressure goes from 0.625 → 0 → 0.3125. The dramatic tension vanishes for the pop lesson. |
| **Low** | No wrong-answer feedback in C1C | Player might tap wrong goop, tap below pressure, tap background. Only gets generic shake. |
| **Low** | 19 steps total is high | B-phase alone has 5 steps. C-phase has 6. Several could be combined. |

### Key Decisions
- Crack sealing IS automatic — goop lands on matching crack → sealed. No separate laser action.
- Engine does NOT auto-spawn pieces or cracks in training mode. Every spawn must be explicit per-step config.
- Current step count: 19 (A:2, B:5, C:6, D:3, E:1, F:2).
- D3 discovery check now uses `some()` (any crack offscreen) not `every()` (all cracks). Matches arrow threshold.
- Offscreen arrow threshold fixed: `>=` not `>` (shows at 1 column past viewport, not 2).
