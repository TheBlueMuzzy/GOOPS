# Tutorial v2 — Redesigned Flow

> **Design goal:** Teach everything a rank 0 player needs to survive in as few steps as possible, with the right safety nets, in the voice of a bored shift supervisor reading from a manual he's memorized against his will.

---

## Design Principles

1. **Show, then name, then do.** The player sees the thing happen before being told what it is. Then they do it themselves.
2. **One concept per step.** Never two new things at once.
3. **Under 20 words per message.** The boss doesn't lecture.
4. **The player is always doing something within 3 seconds of reading.**
5. **Safety nets catch failure without patronizing.** Retry systems, reshows, auto-skips — but no hand-holding text.
6. **Controls unlock with motivation.** You don't learn to spin the tank "because you can." You learn because the crack is over there.
7. **Pressure is honest.** Pressure only rises when relevant to the current task. Popping goop lowers it (same as real game). Pressure never reaches 100% during training — caps at 95%. If the player isn't actively doing something, pressure should be 0 or frozen.

---

## What We Teach (and What We Don't)

**Taught at rank 0:**
- Goop falls, you place it (fast-drop, rotation)
- The tank is a cylinder (wraps around, only see 1/3)
- Pressure rises over time — pop goop below the pressure line to vent it
- Same-color goop merges (bigger = more pressure vented)
- Fresh goop needs time to solidify before it can be popped
- Cracks form in the tank wall — drop matching-color goop on them to seal
- Stack goop to reach higher cracks
- Game ends when goop stacks too high (next piece can't spawn)

**NOT taught (rank 1+ complications):**
- LASER (two-tap popping) — rank 4
- LIGHTS (visibility) — rank 2
- CONTROLS (input restriction) — rank 6
- Score, XP, combos, piece preview

---

## The Full Sequence — 14 Steps

### Phase A — Enter the Tank (1 step)

#### A1: Welcome
|                 |                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Message**     | `[Your] Operator training [begins now]. Drag [the] periscope down [to] start.`                                                                                |
| **Keywords**    | training, Operator, periscope                                                                                                                                 |
| **Intent**      | World-building + first action in one beat. The intercom crackle IS the introduction.                                                                          |
| **View**        | Console. Periscope highlighted.                                                                                                                               |
| **Timing**      | Immediate. Game paused.                                                                                                                                       |
| **Advance**     | Player drags periscope (fires `GAME_START`)                                                                                                                   |
| **Controls**    | Periscope drag only                                                                                                                                           |
| **Why 1 step?** | The old A1 ("Welcome Operator") was pure text with no action. A2 had the action. Merged: the welcome IS the instruction. Player reads and acts in one moment. |

---

### Phase B — Goop Basics (4 steps, 2 piece falls)

#### B1: Goop Falls
|              |                                                              |
| ------------ | ------------------------------------------------------------ |
| **Message**  | `[The] extruder drops goop into [the] tank.`                 |
| **Keywords** | goop, tank                                                   |
| **Intent**   | Player watches their first piece fall. Pure observation.     |
| **Spawns**   | Blue T_I (horizontal, rotation: 1)                           |
| **Pressure** | 0                                                            |
| **Controls** | ALL disabled (watch only)                                    |
| **Timing**   | Game running. Message shows immediately. Piece falls slowly. |
| **Advance**  | Auto-advance at row 8 (~25% down viewport)                   |

#### B2: Fast-Drop
|                 |                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Message**     | `[Yeah.] It's slow. Drag down or [press] S [to] fast-drop.`                                                                                                                                                                     |
| **Keywords**    | slow, Swipe, S, fast-drop                                                                                                                                                                                                       |
| **Intent**      | Acknowledge the slowness (character moment) + teach fast-drop in one breath. The boss isn't going to waste two messages on this.                                                                                                |
| **Spawns**      | None (same piece from B1 still falling)                                                                                                                                                                                         |
| **Pressure**    | 0                                                                                                                                                                                                                               |
| **Controls**    | Fast-drop ENABLED                                                                                                                                                                                                               |
| **Timing**      | Game running. Message shows immediately. Same piece keeps falling.                                                                                                                                                              |
| **Advance**     | Piece lands (natural fall or fast-drop)                                                                                                                                                                                         |
| **Why merged?** | Old B1B ("Yeah. It's slow.") and B2 ("Swipe down to fast-drop") were separate steps during the same piece fall. The personality beat and the teaching beat work better as one: acknowledge the problem, then give the solution. |

> **B1→B2 flow:** One piece, two messages. B1 names the thing. B2 gives you control over it. The piece is still falling when B2 appears — player can immediately fast-drop.

#### B3: Rotation
|                |                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Message**    | `Rotate [with] Q/E or tap [the] left/right [side of the] tank.`                                                                     |
| **Keywords**   | Rotate, Q/E, tap, left/right, tank                                                                                                  |
| **Intent**     | Second control unlock. New piece, new skill.                                                                                        |
| **Spawns**     | Yellow T_T piece                                                                                                                    |
| **Pressure**   | 0                                                                                                                                   |
| **Controls**   | Fast-drop + rotate ENABLED                                                                                                          |
| **Timing**     | Piece spawns and falls. **After 1.2s** → game pauses, message shows. Player sees the piece moving, then it freezes while they read. |
| **Advance**    | Piece lands (dismiss → piece resumes → player rotates and drops)                                                                    |
| **PauseDelay** | 1200ms                                                                                                                              |

#### B4: Practice
|                  |                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Message**      | `[Do it] again.`                                                                                                          |
| **Keywords**     | —                                                                                                                         |
| **Intent**       | Third rep. Boss tosses another piece at you without ceremony. Confidence builder with a simple shape.                     |
| **Spawns**       | Blue T_O (2x2 square)                                                                                                     |
| **Pressure**     | 0                                                                                                                         |
| **Controls**     | Fast-drop + rotate ENABLED                                                                                                |
| **Timing**       | Game paused. Message shows immediately. Dismiss → piece falls.                                                            |
| **Advance**      | Piece lands                                                                                                               |
| **Why keep it?** | Two pieces isn't enough reps. The 2x2 is simple (no rotation needed) so it's a breather before C-phase introduces threat. |

---

### Phase C — Pressure & Popping (4 steps)

#### C1: Pressure Rises
| | |
|---|---|
| **Message** | `Pressure [builds] over time.` |
| **Keywords** | Pressure |
| **Intent** | Introduce the threat. Four words. The rising pressure line IS the lesson — the player watches it climb toward their goop stack. |
| **Spawns** | None |
| **Pressure** | 2.5 rate (fast — reaches goop in ~3 seconds, then freezes for C2) |
| **Controls** | ALL disabled (watch only) |
| **Timing** | Game paused. Message shows. Dismiss → pressure starts rising fast. |
| **Advance** | Auto-advance when pressure line passes the highest yellow goop (`advanceWhenPressureAbovePieces: true`, `advancePressureAboveColor: YELLOW`) |
| **Fallback** | Auto-advance after 10s |
| **Why one step?** | Old design used C1 (intro) + C1B (watch it rise past goop) as separate steps. The dramatic moment of pressure passing the goop IS the introduction. One message, one observation. |

> **Player experience:** Dismiss → pressure rises fast → hits their goop in ~3 seconds → auto-advance to C2. Quick, dramatic, no dead time.

#### C2: Pop
|               |                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Message**   | `Tap goop below [the] pressure [line] to pop [it].`                                                                 |
| **Keywords**  | Tap, goop, pressure, pop                                                                                            |
| **Intent**    | The player's first pop. Core action of the game.                                                                    |
| **Spawns**    | None                                                                                                                |
| **Pressure**  | 0 (frozen — focus on learning to pop, not managing pressure)                                                        |
| **Controls**  | Pop enabled via highlight system                                                                                    |
| **Highlight** | Yellow goop pulses                                                                                                  |
| **Timing**    | Game NOT paused. Player can pop while reading.                                                                      |
| **Advance**   | Action: `pop-goop`                                                                                                  |
| **Reshow**    | After 3s, re-shows as non-dismissible (can't close — must pop to clear). Pressure stays frozen, game stays running. |

#### C3: Merge & Solidify
|                             |                                                                                                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Message**                 | `Same-color goop merges. Bigger [blobs] vent more. [Fresh goop] needs a moment to set.`                                                                                                                                                |
| **Keywords**                | goop, merges, Bigger, vent, set                                                                                                                                                                                                        |
| **Intent**                  | After popping yellow, the remaining blue pieces merge. This message names what just happened AND warns about fill timing. Two concepts, one message — they're both "goop behavior."                                                    |
| **Spawns**                  | None                                                                                                                                                                                                                                   |
| **Pressure**                | 0.3125 rate (moderate — needs to reach top of merged blue)                                                                                                                                                                             |
| **Controls**                | Fast-drop + rotate ENABLED                                                                                                                                                                                                             |
| **Timing**                  | **1.5s delay** after pop (`pauseDelay: 1500`). Lets pop droplets fade and merge animation play. Then pauses and shows message.                                                                                                         |
| **Advance**                 | Tap to dismiss                                                                                                                                                                                                                         |
| **Why merge two concepts?** | Merge and solidify are both "things goop does on its own." Teaching them separately (old C2 + C3) created a step where the player just reads about solidifying without experiencing it. Here, they'll experience it immediately in C4. |

#### C4: Practice Pop
|              |                                                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Message**  | `Pop [it].`                                                                                                                                                                                              |
| **Keywords** | Pop                                                                                                                                                                                                      |
| **Intent**   | Second pop rep. The merged blue is visible, fill timer is running. The player waits for solidify (experiencing C3's lesson) then pops.                                                                   |
| **Spawns**   | None                                                                                                                                                                                                     |
| **Pressure** | 0 (frozen — focus on pop timing, not pressure management)                                                                                                                                                |
| **Controls** | Fast-drop + rotate ENABLED. Pop enabled.                                                                                                                                                                 |
| **Highlight** | Blue goop pulses (restrict popping to blue only)                                                                                                                                                        |
| **Timing**   | Game NOT paused. Fill timer runs. Message after 2s delay.                                                                                                                                                |
| **Advance**  | Action: `pop-goop`                                                                                                                                                                                       |
| **Why?**     | One pop isn't muscle memory. The player needs to pop twice (yellow, then blue) before moving on. This rep also tests their understanding of the fill timer — they can't pop the merged blue immediately. |

> **C-phase experience:** Pressure rises fast (~3s) → pop yellow (instant) → blues merge (1s) → read about it → pressure frozen, blue pulses, fill timer (~1.5s) → pop blue. Total: ~15-20 seconds. No dead time.

---

### Phase D — Cracks & Tank Rotation (3 steps)

#### D1: Crack Appears
|              |                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Message**  | `Cracks [form in the] tank [wall]. Drop matching [color] goop [on them] to seal.`                                            |
| **Keywords** | Cracks, tank, goop, seal                                                                                                     |
| **Intent**   | Introduce cracks. Player sees one for the first time. No mention of "laser" — sealing is automatic when matching goop lands. |
| **Spawns**   | Green crack (near-stack, right side viewport, row 22)                                                                        |
| **Pressure** | 0 (frozen — player is just reading about cracks, not actively playing)                                                       |
| **Controls** | Fast-drop + rotate ENABLED. Tank-rotate disabled (not taught yet).                                                           |
| **Timing**   | **2.5s delay** after C4's pop. Lets droplets fade, crack spawns and becomes visible, then message shows.                     |
| **Advance**  | Tap to dismiss                                                                                                               |

#### D2: Tank Rotation
| | |
|---|---|
| **Message** | `Swipe left/right [or] A/D [to] spin [the] tank.` |
| **Keywords** | Swipe, left/right, A/D, spin, tank |
| **Intent** | Unlock tank rotation WITH motivation — the crack is there, the piece is falling, spin to align. |
| **Spawns** | Green T_O (2x2) piece |
| **Pressure** | 0.46875 rate |
| **Controls** | ALL ENABLED (tank-rotate unlocked) |
| **Timing** | Game running. Piece falls. Message appears when piece reaches row 8 (~25% down). Game pauses on message. |
| **Advance** | Event: `crack-sealed` |

**D2 Retry (if piece lands without sealing):**

| Phase   | Delay | What Happens                                                                           |
| ------- | ----- | -------------------------------------------------------------------------------------- |
| Unpause | +0s   | Game unpauses. Pressure frozen. Piece locks and fill begins naturally.                 |
| Pop     | +2s   | All goop pops with droplet animation. Board cleared.                                   |
| Retry   | +2s   | New green crack near stack. "Try again" message. New green piece spawned (frozen).     |

**Retry message:** `Try again! Spin [the] tank [to] align [the] goop with [the] crack.`
**On dismiss:** Pressure restores. Piece falls. Player retries.

> **Why these timings?** The player needs to see their piece lock, fill, and land naturally. Then the pop is dramatic (all goop explodes). Then 2 seconds for droplets to fade before the retry message appears. Total: ~4s, feels intentional not janky.

#### D3: Offscreen Cracks (Discovery)
|                       |                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Message**           | `[You] only see 1/3 [of the] tank. Cracks [can] spawn anywhere.`                                                                                                                                                                                             |
| **Keywords**          | tank, Cracks                                                                                                                                                                                                                                                 |
| **Intent**            | Teach cylindrical awareness. This is a DISCOVERY moment — only triggers if the player naturally spins a crack offscreen.                                                                                                                                     |
| **Spawns**            | Green crack (near-stack, visible)                                                                                                                                                                                                                            |
| **Pressure**          | 0.46875 rate                                                                                                                                                                                                                                                 |
| **Controls**          | ALL ENABLED                                                                                                                                                                                                                                                  |
| **Timing**            | Game running. Message hidden. Triggers when ANY crack is rotated offscreen (matches arrow indicator threshold).                                                                                                                                              |
| **Advance**           | Tap to dismiss                                                                                                                                                                                                                                               |
| **Auto-skip**         | If player never rotates a crack offscreen → auto-advance after 15s                                                                                                                                                                                           |
| **Persistent arming** | If auto-skipped, the discovery trigger should stay armed through E and F phases. First time a crack goes offscreen at ANY point during the rest of training → show this message as a one-time interrupt. The lesson happens when the player is ready for it. |

> **Why persistent?** A 15s auto-skip means the lesson might never happen. With persistent arming, the player discovers cylindrical wrapping organically — maybe during E1 when they're spinning the tank to find a high crack, or during F1 when they're playing freely. The message fires once, wherever it's most relevant.

---

### Phase E — Scaffolding (1 step)

#### E1: Stack to Reach
|                         |                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Message**             | `Cracks [spawn] higher as [the] Pressure builds. Stack goop [to] reach [them].`                                                                                |
| **Keywords**            | Cracks, pressure, goop, reach                                                                                                                                  |
| **Intent**              | The final concept: vertical strategy. Crack spawns at the pressure line — as pressure rises, cracks naturally appear higher, requiring stacking.               |
| **Spawns**              | Green crack at pressure line (uses same formula as real game). Pieces spawn continuously (each piece-landed triggers next spawn).                               |
| **Pressure**            | 0.46875 rate                                                                                                                                                   |
| **Controls**            | ALL ENABLED                                                                                                                                                    |
| **Timing**              | Game paused. Message shows immediately. Shows AFTER crack has spawned and is visible (player sees the high crack, then reads about stacking).                  |
| **Advance**             | Event: `crack-sealed`                                                                                                                                          |
| **Safety net**          | Auto-advance after 90s (if player truly can't figure out stacking, move to graduation rather than soft-locking)                                                |
| **Continuous spawning** | New feature required: `continuousSpawn: true` — after each piece lands, a new piece spawns automatically. This simulates real gameplay within a training step. |

> **Why this works:** The player has sealed a ground-level crack in D2. Now, with pressure rising, the crack spawns at the pressure line — naturally higher than before. The message confirms: stack up to it. The continuous piece supply lets them experiment. The crack is green (matching pieces available), and the board has existing goop from D-phase to build on. No forced positioning — the pressure-line formula means cracks are exactly where they'd be in real gameplay.

---

### Phase F — Graduation (1 step)

#### F1: Graduation
|                    |                                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Message**        | `[That] covers [the] basics. Don't [let the] goop [pile] too high.`                                                                                                                                                         |
| **Keywords**       | basics, goop, high                                                                                                                                                                                                          |
| **Intent**         | The boss is done. You're on your own. Free play with all mechanics. Pressure = time (same bar). Popping buys time back. Ends when pressure caps or goop overflows. |
| **Spawns**         | Pieces spawn continuously. Crack every ~20s to keep all mechanics in play.                                                                                                                                                  |
| **Pressure**       | 0.2 rate (gentle). Popping goop lowers pressure (same as real game). **Caps at 95%.** |
| **Controls**       | ALL ENABLED                                                                                                                                                                                                                 |
| **Timing**         | Game paused. Message shows. Dismiss → free play begins.                                                                                                                                                                     |

**F1 Ending Conditions:**

| Condition | What Happens |
|-----------|--------------|
| Pressure reaches 95% | Pressure freezes. Message: `[I've] stopped [the] pressure [so you can] practice. Swipe up [to] leave training.` Keywords: **Swipe up, leave training**. Player swipes up → return to console. No end-game screen. |
| Stack overflow (piece can't spawn) | Message: `Training [is] over. Swipe up [to] end.` Keywords: **Swipe up, end**. Player swipes up → return to console. No end-game screen. |

> **Why this works:** Pressure IS time — they're the same bar. In real gameplay, popping goop vents pressure (buys time). F1 respects this: pressure rises, player pops to fight it, but it caps at 95% so training never kills you. The player practices freely, then swipe-up teaches the exit gesture. If they overflow first, the message teaches the same exit. Either way: swipe up = back to console. No fake end-game screen during training.
>
> **Why swipe-up?** This is how players leave the tank view in real gameplay. Teaching it here means they already know the gesture when they start rank 1. The console IS the hub — training should always return there.

---

## Step Count Comparison

| Phase | Old (v1) | New (v2) | Change |
|-------|----------|----------|--------|
| A | 2 (briefing + periscope) | 1 (merged) | -1 |
| B | 5 (watch, slow, fast-drop, rotate, practice) | 4 (watch, slow+fast-drop, rotate, practice) | -1 |
| C | 6 (pressure, rising, pop, merge, solidify, hint) | 4 (pressure, pop, merge+solidify, practice pop) | -2 |
| D | 3 (crack, rotate, offscreen) | 3 (same structure, better messages) | 0 |
| E | 1 (bare message, no spawns) | 1 (hands-on with high crack + continuous spawn) | 0 |
| F | 2 (clear goop, practice overflow) | 1 (real graduation game) | -1 |
| **Total** | **19** | **14** | **-5** |

---

## New Features Required

### 1. Continuous Piece Spawning (`continuousSpawn: true`)
**Used by:** E1, F1
**Behavior:** After each `PIECE_DROPPED` event within this step, automatically spawn the next piece (using the step's `spawnPiece` config or random from palette).
**Why:** E1 and F1 need real gameplay within a training step. The player needs multiple pieces to stack (E1) or to play freely (F1). Without this, training mode only spawns one piece per step.

### 2. Persistent Discovery Trigger
**Used by:** D3
**Behavior:** If D3 auto-skips, the offscreen-crack trigger stays armed through subsequent steps. First time any crack is offscreen during E or F → show D3's message as a one-time interrupt (doesn't change current step, just overlays the message).
**Why:** The cylindrical awareness lesson should happen when the player is ready, not be lost to a timer.

### 3. Periodic Crack Spawning (for F1)
**Used by:** F1
**Behavior:** Spawn a crack every ~20s during the graduation game.
**Why:** The player should practice everything, including crack sealing. Without periodic cracks, F1 is just a Tetris game.

### 4. Pressure Cap at 95% (`pressureCap: 0.95`)
**Used by:** F1 (and implicitly all training — pressure should never reach 100%)
**Behavior:** When pressure reaches 95%, it freezes. In F1, this triggers the practice/exit message.
**Why:** If pressure reaches 100% during training and nothing happens, it teaches the wrong thing. Pressure = time in real gameplay. Capping at 95% means the player never sees a "full bar with no consequence."

### 5. Swipe-Up Training Exit
**Used by:** F1
**Behavior:** "Swipe up" gesture during F1's end messages returns player to console view. No end-game screen, no score screen, no XP — just back to the console. Training is complete.
**Why:** Swipe-up is how players leave the tank in real gameplay. Teaching it here means they already know the gesture at rank 1. The console is the hub — training should always return there.

### 6. Pop Lowers Pressure During Training
**Used by:** All steps with pressure > 0 and pop enabled (C2, C4, D2, E1, F1)
**Behavior:** Popping goop lowers the pressure bar, same as in real gameplay.
**Why:** Pressure = time. Popping = buying time. If this doesn't work during training, the player learns the wrong mental model. This is foundational.

---

## Message Voice Guide

The boss is a shift supervisor who's given this training 500 times. He reads from a manual. He's not mean — just spent. Every word costs him energy he doesn't have.

**Rules:**
- Never say "please" or "try to" or "you should"
- Imperative mood: "Drag the periscope." not "You can drag the periscope."
- Maximum one sentence of explanation, one sentence of instruction
- Personality comes from brevity, not jokes (exception: "Yeah. It's slow." — the ONE character beat)
- Garble system adds the "broken intercom" flavor. The boss's actual words are flat and direct.

**Message length targets:**

| Step | Words | Message |
|------|-------|---------|
| A1 | 9 | Welcome to training, Operator. Drag the periscope down to start. |
| B1 | 7 | The extruder drops goop into the tank. |
| B2 | 11 | Yeah. It's slow. Swipe down or press S to fast-drop. |
| B3 | 10 | Rotate with Q/E or tap the left/right side of the tank. |
| B4 | 2 | One more. |
| C1 | 4 | Pressure builds over time. |
| C2 | 8 | Tap goop below the pressure line to pop it. |
| C3 | 12 | Same-color goop merges. Bigger blobs vent more. Fresh goop needs a moment to set. |
| C4 | 2 | Pop it. |
| D1 | 10 | Cracks form in the tank wall. Drop matching color goop on them to seal. |
| D2 | 8 | Swipe left/right or A/D to spin the tank. |
| D3 | 10 | You only see 1/3 of the tank. Cracks can be anywhere. |
| E1 | 10 | Cracks form higher as pressure builds. Stack goop to reach them. |
| F1 | 9 | That covers the basics. Don't let the goop pile too high. |
| F1 (95%) | 10 | I've stopped the pressure so you can practice. Swipe up to leave training. |
| F1 (overflow) | 6 | Training is over. Swipe up to end. |

**Average: 7.6 words per message.**

---

## Safety Nets Summary

| Step | Risk | Safety Net |
|------|------|------------|
| B2 | Player doesn't fast-drop | Piece lands naturally → advance anyway |
| B3 | Player doesn't rotate | Piece lands in any orientation → advance anyway |
| C1 | Pressure never reaches goop | Auto-advance after 10s |
| C2 | Player can't figure out popping | Reshow after 3s (non-dismissible). Highlight pulses on target. |
| C4 | Player tries to pop before goop solidifies | Shake rejection provides feedback. Fill animation shows progress. |
| D2 | Player lands piece without sealing | Retry: unpause → fill naturally (2s) → pop all (2s for droplets) → retry message + new crack + new piece |
| D3 | Player never rotates crack offscreen | Auto-skip after 15s. Trigger stays armed through E/F. |
| E1 | Player can't figure out stacking | Auto-advance after 90s (move to graduation rather than soft-lock) |
| F1 | Pressure reaches 95% | Pressure freezes. Practice message + "Swipe up to leave training." |
| F1 | Stack overflow | "Training is over. Swipe up to end." No end-game screen. |

---

## Timing Flow Diagram

```
A1 ──tap──→ [ENTER TANK]

B1 ──row 8──→ B2 ──piece lands──→ B3 ──1.2s delay──→ [pause+msg]
              (same piece)           (new piece)         ──piece lands──→ B4 ──piece lands──→

C1 ──dismiss──→ [pressure rises fast ~3s] ──pressure > goop──→
C2 ──pop yellow──→ [1s delay] ──→
C3 ──tap──→
C4 ──pop blue──→

D1 ──[2.5s delay]──→ [msg] ──tap──→
D2 ──[piece at row 8]──→ [msg] ──dismiss──→ ──crack-sealed──→ (or retry loop)
D3 ──[any crack offscreen]──→ [msg] ──tap──→ (or 15s auto-skip)

E1 ──dismiss──→ [continuous pieces] ──crack-sealed──→ (or 90s auto-skip)

F1 ──dismiss──→ [free play, pressure rising] ──pressure 95%──→ [practice msg] ──swipe up──→ CONSOLE
                                              ──overflow──→ [end msg] ──swipe up──→ CONSOLE
```

**Estimated total time:** 3-5 minutes for a focused player. Up to 8-10 minutes if exploring / retrying.

---

## Controls Unlock Progression

```
A1:  [nothing]
B1:  [nothing]           ← watch only
B2:  [FAST-DROP]         ← first input
B3:  [fast-drop, ROTATE] ← second input
B4:  [fast-drop, rotate] ← practice
C1:  [nothing]           ← watch pressure
C2:  [POP]               ← third input (via highlight)
C3:  [fast-drop, rotate] ← merge context
C4:  [fast-drop, rotate, pop] ← practice pop
D1:  [fast-drop, rotate] ← see crack (no tank-rotate yet)
D2:  [fast-drop, rotate, TANK-ROTATE, pop] ← fourth input
D3:  [all]               ← exploration
E1:  [all]               ← scaffolding
F1:  [all]               ← free play
```

Each new input gets its own moment. Never two unlocks at once.

---

## Pressure Progression

```
A-B:  0       ← no threat, learn controls
C1:   2.5     ← fast rise, reaches goop in ~3s
C2:   0       ← frozen for pop lesson
C3:   0.3125  ← moderate, post-pop
C4:   0       ← frozen, focus on pop timing
D1:   0       ← frozen, just introducing cracks
D2-3: 0.46875 ← real urgency (player is active)
E1:   0.46875 ← same
F1:   0.2     ← gentle graduation, caps at 95%
```

---

## Changes from v1

| What | v1 | v2 | Why |
|------|----|----|-----|
| A-phase | 2 steps (briefing + periscope) | 1 step (merged) | Briefing had no action |
| B1B + B2 | Separate steps ("It's slow" / "Fast-drop") | One step | Same piece, same moment, same breath |
| C1 + C1B | Separate steps (intro / watch rise) | One step (watch it rise IS the intro) | The dramatic visual teaches more than text |
| C2 + C3 | Separate steps (merge / solidify) | One step (both are "goop behavior") | Related concepts, one message |
| D1 message | "Seal them with the laser" | "Drop matching goop to seal" | Sealing is automatic. Laser is a rank 4 complication. |
| E1 | Bare message, no spawns | Pressure-line crack + continuous piece spawning | Player must actually practice scaffolding |
| F1 + F2 | "Clear goop" + "Overflow on purpose" | Graduation: free play, pressure caps at 95%, swipe-up exit | Pressure = time. Teach the exit gesture. No fake game-over. |
| D3 auto-skip | Lost forever | Persistent through E/F | The lesson finds the player |
| Total steps | 19 | 14 | 5 fewer steps, better E/F phases |

---

## Implementation Notes (from UAT)

### PIECE_DROPPED Event Timing
The engine emits `PIECE_DROPPED` at line 1413 of `lockActivePiece()` **before** setting the training-mode auto-pause at lines 1426-1429. Event listeners fire synchronously during emit, so any state changes (like `isPaused = false`) get immediately overwritten by the engine's subsequent pause. **All PIECE_DROPPED handlers must defer with `setTimeout(0)`** to run after the engine finishes its lock sequence.

### PIECE_DROPPED Dual Source
`tickLooseGoop()` (line 1197) **also** emits `PIECE_DROPPED` when loose goop settles after a pop. Continuous spawn and D2 retry handlers must guard with `if (gameEngine.state.activeGoop) return` — if a piece is still actively falling, the event came from loose goop, not a real piece lock.

### Crack Positioning
All training cracks use the same pressure-line formula as the real game (`spawnGoalMark()` in `utils/gameLogic.ts`). X coordinates are constrained to the visible viewport (12 of 30 columns). No forced rows — cracks appear where they naturally would based on current pressure.

### F1 Pressure Continuity
F1 does NOT reset pressure. It continues from whatever pressure accumulated during D and E phases. This means F1 may reach 95% cap faster if the player took a long time in D/E.

### F1 Overflow Detection
Stack overflow is detected via polling (checks row 3 every 500ms) in addition to the GAME_OVER event listener, since GAME_OVER may not fire reliably from `tickTimer()` in training mode but CAN fire from `spawnNewPiece()` collision checks.
