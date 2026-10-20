# "Your first day" — the tutorial step list (F12, Sprint 08 task 1)

*Written 2026-10-19 from v1's Tutorial v3 (`research/v1/Tutorial3.md`), the new rules (GDD §4–§5) and the code on `dev/m1-core-shift`. The lesson runner (F30) is built from this list; the first day itself is F31; the breakdown lessons are F32. **Built 2026-10-20: §10 has the day as it runs now and what changed from this plan.***

**Decided (Muzzy, 2026-10-19):** v1 style, fully scripted. A staged day: every step is set up for you, you can't fail (if you do something unexpected, the tutorial handles it), and it ends in free play. Plain how-to-play for alpha: no story voice, no garbled intercom (that layers on in beta — see §7). Taught on PC first: every message has a **Keys** and a **Mouse** wording; the **Phone** wording is a marked slot until the phone check (F10, `research/gestures.md`).

**Words used here**
- **Spin** = turn the tank left or right under the falling piece (the piece always falls down the middle).
- **Fast drop** = make the piece fall faster while you hold it. There is no hard drop (an instant slam to the floor).
- **Zap** = click goop to pop it with the laser.
- **Pressure line** = the line that rises with pressure. Goop can be zapped once its **top** is at or under the line. At 0% the line sits on the floor row; every 5% lifts it one row.
- **Fill** = fresh goop fills up after it lands (375 ms per cell); it can't be zapped until it's full.
- **Plugged** = a crack covered by goop of its own colour. Zapping that goop **seals** the crack.
- **Quota** = the cracks to seal today (`CRACKS n / 4` at rank 0: 4 colours + rank 0).
- **Integrity** = the tank's health bar. Open cracks wear it down; each seal gives 2% back.
- **Rupture** = the tank breaks: pressure drains to 0, you zap what you can, the day ends.
- **Pointer** = the lesson's arrow or ring pointing at one thing (a tank cell, a HUD bar, a console part).
- **Paused / running / held** = the shift's clock is stopped / runs normally / runs but the step holds a value still (e.g. pressure held at 15%).
- Rows are counted **from the floor**: row 1 = the floor row.

---

## 1. What the first day must leave you knowing

1. **The console is home.** Pull the periscope down to start a shift.
2. **Spin the tank, not the piece.** A / D or ← / → turns the tank. Q / E turns the piece. S / ↓ fast-drops.
3. **Same colours join** into one blob, and fresh goop **fills** before it can be zapped.
4. **Pressure rises.** You can zap goop once it's under the pressure line. Zapping lets a little pressure out.
5. **Cracks:** cover a crack with goop of its colour, then zap that goop to seal it. They can form up high (build up to reach them) and around the back of the tank (arrows point to them).
6. **Open cracks wear down the tank.** Seal the quota; every crack after it is a bonus.
7. **A rupture ends the day:** pressure drains, zap what you can, then clock out.

Not taught on day one (on purpose): swap (hold to swap the piece — see Q2), the wall kick setting, the pause menu, the machines (they come at ranks 2, 4, 6 — §5).

---

## 2. What changed since v1's Tutorial v3

| v1 step | Now | Why |
|---|---|---|
| A1 drag the periscope | **Kept** (A1) | Same console, same periscope. Also ↓ / Enter or a click on PC. |
| B1 goop falls · B2 fast drop | **Kept** (B1, B2) | Same piece carries over, as v1. |
| B3 rotation | **Kept** (B3) | Q / E, or click left / right of the goop. |
| B4 "do it again" practice | **Cut** | Its blue piece now arrives in C2 with a purpose (it merges). |
| C1 pressure · C2 pop | **Merged** (C1) | One rule now: zap goop once its top is under the line. The step lets you try early: the game's own "Above the pressure line" message teaches it. |
| C3 merge / fill / vent | **Changed** (C2 + C3) | Merge and fill are shown on a real merge. **Venting is tiny with the real numbers** (a 6-cell blob lets out under 1%), so it's said, not shown. |
| C4 practice pop | **Merged** into C3 | — |
| D1 crack | **Changed** (D1) | Adds the integrity bar. The crack now has bubbles; covered, it shows through an x-ray box (F36). |
| D2 spin the tank + retry | **Kept** (D2) | Retry with piling-up cracks, as v1. The landing shadow and chevrons help aim. |
| (D2's seal half) | **Split out** (D3) | Plug → zap → seal is two actions; the hint differs. Adds the quota counter. |
| D3 off-screen cracks | **Kept** (D4), with a sure trigger | v1's was never finished. Now: if it hasn't fired by free play, the runner puts one crack just out of view. 12 of 30 columns show (40%, not v1's "1/3"). |
| E1 seal a high crack | **Kept** (E1) | The crack hill puts cracks halfway up anyway. Adds the **red X** (wrong colour covering a crack). |
| E2 "cracks spawn higher" | **Folded** into F1 | New wording: higher pressure = cracks come faster. |
| F1 free play, 95% pressure cap, "swipe up to leave", overflow = game over | **Replaced** (F1, F2, F3) | No 75 s timer and no overflow game over any more. Free play runs to the quota with safety rails, then to a **real rupture + drain**, then the end report → console → rank 1. |
| — | **New:** integrity bar, quota counter, rupture + drain, red X, x-ray box, bubbles | New rules and new readability cues (F27, F36). |
| — | **Gone:** hard drop, the 75 s timer, "don't let it pile too high" (overflow now just causes a rupture) | GDD §4. |

---

## 3. The step list (15 steps)

How to read each step:
- **Set up** — what the runner puts in place: pieces, cracks, pressure, which controls work, and whether the shift is paused, running or held.
- **Says** — the message. Keys / Mouse wordings; Phone = ⟨slot, after F10⟩. Max ~15 words.
- **To move on** — what the player must do.
- **Hint** — wait-then-hint: if they haven't done it after the wait, this shows (and the shift pauses or holds).
- **If they do something else** — how the step copes.
- **Pattern** — v1's names (Tutorial3 §6): P1 Pause-show-dismiss · P2 Run-act-advance · P3 Wait-then-hint · P4 Position-gated · P5 Pressure-gated · P6 Continuous spawn · P7 Retry with piling-up cracks · P8 Discovery interrupt. Two new ones: **P9 Safety rails** (the runner holds values so you can't lose) · **P10 First-time lesson** (fires the first time something happens, remembered on the device).

**Rules for every step**
- A paused message goes on with a click, Space or Enter. While it's up, clicks and keys don't reach the tank.
- Controls not taught yet are **off** (no "nope" sound). Swap stays off until its rank (F59: rank 3 — free play doesn't turn it on).
- The game's own short messages ("Still filling", "Above the pressure line") still show — they teach. They hide while a lesson message is up.
- Natural cracks are off, machines are locked (rank 0), and piece size stays at 4 cells for the whole day (§6: the size clock would reach 6-cell pieces by free play otherwise).
- Leaving mid-day (End shift, closing the page): the day isn't done. Next time it restarts **at the start of the phase** you were in. So each phase sets up its own tank from scratch.
- Swiping up / W to the console mid-day: the shift pauses while you're there (no machines yet), the step waits, and carries on when you come back.

### Phase A — Clock in

#### A1 · Pull the periscope
- **Set up:** the console at rank 0. Pointer on the periscope. Nothing else lit.
- **Says:** Keys: "Your first day. Press ↓ or Enter to pull the periscope." · Mouse: "Your first day. Drag the periscope down to start." · Phone: ⟨slot⟩
- **To move on:** pull the periscope → the shift starts.
- **Hint (6 s):** the pointer pulses; "Pull the periscope all the way down." (Mouse: "…or just click it.")
- **If they do something else:** Settings opens and closes as normal; the step waits.
- **Pattern:** P2 (on the console).

### Phase B — Moving goop

#### B1 · Goop falls
- **Set up:** empty tank. Pressure held at 0%. No cracks. All controls off. One **blue I, lying flat**, falls on its own. Running.
- **Says:** "Goop drops into the tank from the top." (same for every input)
- **To move on:** the piece passes row 14 (about a third of the way down) → B2, same piece still falling.
- **Hint:** none (nothing to do).
- **If they do something else:** controls are off.
- **Pattern:** P4 + P2.

#### B2 · Fast drop
- **Set up:** the same blue I keeps falling. Only fast drop on. Running.
- **Says:** Keys: "Slow, right? Hold S or ↓ to fast drop." · Mouse: "Slow, right? Drag down to fast drop." · Phone: ⟨slot⟩
- **To move on:** the piece lands (it lies flat on the floor row).
- **Hint (3 s without fast-dropping):** "Hold S or ↓ — it falls faster while you hold." (Mouse: "Drag down and hold.")
- **If they do something else:** if they never fast-drop, it lands anyway (~10 s) and the step moves on. Fast drop gets used again all day.
- **Pattern:** P2 + P3.

#### B3 · Turn the piece
- **Set up:** a **yellow T** spawns in the middle. Rotate + fast drop on. Runs 1.2 s, then pauses for the message, then runs.
- **Says:** Keys: "Q or E turns the piece. Turn it, then drop it." · Mouse: "Click left or right of the goop to turn the piece." · Phone: ⟨slot⟩
- **To move on:** the piece lands (on top of the blue).
- **Hint (piece halfway down and not turned yet):** "Press Q or E to turn it." (Mouse: "Click beside the piece to turn it.")
- **If they do something else:** it lands unturned → still moves on (no failing). Whatever way up it lands works for C1.
- **Pattern:** P1 (delayed pause) → P2 + P3.

### Phase C — Pressure and zapping

#### C1 · The pressure line
- **Set up:** blue on the floor, yellow on top. Pointer on the PSI readout. Paused for the message; then pressure rises **fast** (×4, about a row a second). Zap on, **yellow only**.
- **Says:** "Pressure rises over time. Goop under the line can be zapped." Then, when the yellow is ready: Mouse/Keys: "Now click the yellow goop to zap it." · Phone: ⟨slot⟩
- **To move on:** the line passes the top of the yellow (it glows ready) → pressure **holds** there → the player zaps the yellow.
- **Hint (3 s after it's ready):** pointer on the yellow; "Click the yellow goop." Pressure stays held.
- **If they do something else:** clicking the yellow too early → the game's own "Above the pressure line" + the goop jiggles (that IS the lesson). Clicking the blue → nothing (yellow only). The blue was zappable from the start (at 0% the line is on the floor row) — that's fine, it's kept for C2.
- **Pattern:** P1 → P5 → P2 + P3.

#### C2 · Same colours join
- **Set up:** pressure held (at least 15%, line on row 4). A **blue O** spawns. Fast drop + rotate on (spin still off, so it lands on the blue I). Running.
- **Says** (paused, as soon as it lands and merges): "Same colours join into one blob. Fresh goop fills up first." Pointer on the blob.
- **To move on:** dismiss.
- **Hint:** none.
- **If they do something else:** nothing else is possible (spin is off, so it always lands on the blue).
- **Pattern:** P2 (wait for land + merge) → P1.

#### C3 · Zap the blob
- **Set up:** pressure held. Zap on, **blue only**. Running (the blob is still filling).
- **Says:** "Zap the blue blob once it's full." Then, after the zap, paused, pointer on the PSI readout: "Zapping lets out a little pressure. Big blobs let out more."
- **To move on:** zap the blob, then dismiss.
- **Hint (3 s after it's full):** pointer on the blob; "Click the blue blob."
- **If they do something else:** clicking while it fills → the game's own "Still filling" + jiggle (teaches fill).
- **Pattern:** P2 + P3 → P1.

### Phase D — Cracks

#### D1 · A crack
- **Set up:** the tank is empty. Pressure held at 15% (line on row 4). A **green crack** is placed on the floor row, 3 columns right of the middle (in view, bubbling). Integrity drain switches on (real rate — tiny). Runs 1.5 s so the bubbles show, then pauses.
- **Says** (two pages):
  1. Pointer on the crack: "A crack! Cover it with goop of the same colour."
  2. Pointer on INTEGRITY: "Open cracks wear down the tank. This bar is its health."
- **To move on:** dismiss both.
- **Hint:** none.
- **If they do something else:** —
- **Pattern:** P1 (two pages).

#### D2 · Spin the tank
- **Set up:** a **green O** spawns. All movement on (spin, rotate, fast drop); zap off. Pauses for the message when the piece reaches row 14.
- **Says:** Keys: "The piece always falls down the middle. A / D or ← / → spins the tank." · Mouse: "The piece falls down the middle. Drag sideways to spin the tank." · Phone: ⟨slot⟩
- **To move on:** the green covers the crack (it's **plugged**: the x-ray box appears).
- **Hint (3 s without spinning):** pointer on the crack; "Spin until the landing shadow sits over the crack."
- **If they do something else — miss:** the old crack stays; a new green crack is added on the floor, in view; a new green O comes; "Try again. Spin until the shadow is over the crack." Cracks pile up until a miss is nearly impossible. (No cracks on sealed spots or under goop — the runner picks an empty floor cell.)
- **Pattern:** P4 (delayed pause) → P2 + P3 + **P7**. Arms D4.

#### D3 · Seal it
- **Set up:** pressure held. Zap on (any goop). Running.
- **Says:** "The crack shows through the goop. Zap that goop to seal it." Then, after the seal, paused, pointer on `CRACKS 1 / 4`: "Sealed! Seal 4 cracks a day to meet your quota."
- **To move on:** a zap that seals the crack, then dismiss.
- **Hint (3 s after the goop is full):** pointer on the x-ray box; "Click the green goop on the crack."
- **If they do something else:** zapping a missed green from D2 → fine, nothing happens to the step. More than one crack sealed (piled-up retries) → the counter just shows more; the words use the real numbers.
- **Pattern:** P2 + P3 → P1.

#### D4 · Cracks out of view (discovery)
- **Set up:** none of its own. Armed from D2 to the end of the day.
- **Fires when:** an open crack is outside the 12 visible columns for the first time (its arrow shows on the tank edge). If it still hasn't happened when free play starts, F1's first crack is placed just out of view, which fires it.
- **Says** (paused, pointer on the arrow): "You only see part of the tank. Arrows point to cracks out of view."
- **To move on:** dismiss → back to whatever step was running, exactly where it was.
- **Hint:** none.
- **If they do something else:** fires once ever.
- **Pattern:** **P8**.

### Phase E — Building up

#### E1 · A high crack
- **Set up:** pressure held at 35% (line on row 8). A **green crack on row 5**, in an empty column 2 left of the middle (in view). Pieces come one after another: **blue I (upright)**, then **green O**; after that, green O's — with a blue I first if the column is still too low. All controls on. Pauses for the message as the crack appears.
- **Says:** pointer on the crack: "Cracks form up high too. Stack goop under them to reach."
  Then, once plugged: "Now zap the green goop to seal it."
- **To move on:** plug the crack, then a zap that seals it.
- **Hint:** before plugging, 8 s after the second piece lands: "Build under the crack, then drop green on it." After plugging: the D3 hint.
- **If they do something else:**
  - Wrong colour covers the crack → the **red X** shows through; paused, pointer on it: "Wrong colour — see the red X? Zap that goop to uncover it."
  - Green lands somewhere else → the next green comes (P6 keeps going).
  - The stack nears the line → fine; the line is 3 rows above the crack.
- **Pattern:** P1 → P6 + P2 + P3.

### Phase F — The rest of the day

#### F1 · Work to the quota
- **Set up:** the real rank-0 shift from here on: random 4-cell pieces in 4 colours, natural cracks on (the crack hill), pressure rises at the real speed, integrity drains for real, swap still off (it unlocks at rank 3, F59). **Safety rails** until the quota is met: pressure can't pass 90%; the tank can't rupture (integrity stops at 20%; if a piece has no room at the top, the runner clears the top goop instead). If D4 hasn't fired, the first crack goes just out of view.
- **Says** (paused, as free play starts): "Cracks come faster as pressure rises. Zap goop to keep it down." Then: "Seal {left} more to meet the quota."
- **To move on:** the quota is met → the game's own banner, "Quota met! Every crack now is a bonus." (same banner as every shift).
- **Hint (20 s without a seal):** pointer on the nearest open crack; "Cover a crack with its colour, then zap it."
- **If they do something else:** the overflow rail clears goop with "Too full — I've cleared some. Zap more often." Pressure at the 90% cap → "Zap goop to let pressure out."
- **Pattern:** P6 + P3 + **P9**.

#### F2 · Rupture
- **Set up:** the rails come off. Real rules. If no rupture comes within 60 s of the quota, pressure starts rising ×3 (the flood of cracks then breaks the tank by itself). The drain after the rupture runs at half speed on day one (10 s instead of 5 s).
- **Says** (paused, when the rupture happens; the game's own "Rupture!" line shows first): "The tank broke. Zap all the goop you can before pressure hits zero."
- **To move on:** pressure reaches 0 → the shift ends.
- **Hint:** none (it ends on its own).
- **If they do something else:** nothing to handle — any rupture (cracks or overflow) works.
- **Pattern:** P2 (wait for the event) → P1.

#### F3 · Clock out
- **Set up:** the end-of-shift report (always "Shift complete" — the quota was met).
- **Says:** pointer on "Back to the console": "Day one done! Back to the console to clock out."
- **To move on:** back to the console → the rank meter fills to **rank 1** (only if you were at rank 0) and the first day is remembered. "Next shift" also counts (it starts a rank-1 shift).
- **Hint (6 s):** the pointer pulses.
- **If they do something else:** —
- **Pattern:** P2.

---

## 4. Step outline

| # | Step | Teaches | Ends when |
|---|---|---|---|
| A1 | Pull the periscope | console = home | shift starts |
| B1 | Goop falls | what goop is | piece passes row 14 |
| B2 | Fast drop | S / ↓, drag down | piece lands |
| B3 | Turn the piece | Q / E, click beside | piece lands |
| C1 | The pressure line | line rises; zap under it | yellow zapped |
| C2 | Same colours join | merge + fill | dismissed |
| C3 | Zap the blob | fill wait; zapping vents | blob zapped |
| D1 | A crack | crack + integrity | dismissed |
| D2 | Spin the tank | A / D, ← / →, drag sideways | crack plugged |
| D3 | Seal it | plug → zap → seal; quota | crack sealed |
| D4 | Out of view | arrows, the back of the tank | dismissed (once) |
| E1 | A high crack | build up; red X | crack sealed |
| F1 | Work to the quota | the real shift | quota met |
| F2 | Rupture | drain, zap leftovers | pressure 0 |
| F3 | Clock out | report → console, rank 1 | back at the console |

---

## 5. First-breakdown lessons (F32)

Each fires the **first time** that machine breaks in a real shift (visor from rank 2, laser 4, controls 6), once per device, replayable from Settings. 4 steps each; step 2 and the "back to the tank" step are shared. They use **P10** (first-time lesson).

How it works today (code): a machine breaks when its meter empties (`breakdown` event) → the game says "<Machine> broken — swipe up to fix" → W / ↑ / a quick flick up opens the console over the tank; mid-shift the tank runs at 25% speed there, and nothing moves toward breaking → the machine's repair panel lights up (a new puzzle each break; wrong moves only shake) → solved = `repaired` event → pull the periscope (or ↓ / Enter) back to the tank. **Careful:** the HUD's top-right "Console" button opens the **pause menu**, not the console (`research/gestures.md` §5), so the lessons say W / ↑ or flick up.

Rules for all three: the lesson message replaces the game's own "broken" message. If a second machine breaks during a lesson, its lesson waits until this one ends. If the player goes to the console or repairs before being told to, the lesson skips ahead. Leaving the shift before the repair → the lesson isn't marked seen.

### Visor (rank 2+)
| | Set up | Says | To move on | Hint / else | Pattern |
|---|---|---|---|---|---|
| V1 | The visor just broke. Paused. Pointer on the flashing VISOR bar. | "Your visor broke. The view will glitch until you fix it." | dismiss | — | P10 + P1 |
| V2 *(shared: go to the console)* | Running (the glitch starts building). | Keys: "Press W or ↑ for the console." · Mouse: "Flick up for the console." · Phone: "Flick up for the console." | console opens | Hint 3 s: pointer pulses. Clicked the HUD "Console" button → pause menu: "That's the pause menu. Use W or ↑ for the console." | P2 + P3 |
| V3 | At the console. **The tank is frozen** for this first repair (Q4). Pointer on the visor panel's blinking top light. | "Follow the lights: slide up, press the lit buttons, slide down." | `repaired` | Hint 5 s: the pointer moves to whatever is lit now. Wrong button = the panel shakes, nothing resets. | P2 + P3 |
| V4 *(shared: back to the tank)* | At the console. Paused. | "Fixed! Fast drops keep the visor charged. Pull the periscope to go back." | back in the tank → lesson seen | Hint 3 s: pointer on the periscope. | P1 → P2 |

### Laser (rank 4+)
| | Set up | Says | To move on | Hint / else | Pattern |
|---|---|---|---|---|---|
| L1 | The laser just broke. Paused. Pointer on the flashing LASER bar. | "Your laser broke. Each zap now takes two clicks: prime, then zap." (Phone: "…two taps…") | dismiss | — | P10 + P1 |
| L2 | = V2 | | | | |
| L3 | At the console, tank frozen. Pointer on the first lit slider. | "Slide each lit slider to its blinking light." | `repaired` | Hint 5 s: pointer on the next unsolved slider. | P2 + P3 |
| L4 | = V4, with: "Fixed! Zapping drains the laser; every landed piece recharges it." | | | | P1 → P2 |

### Controls (rank 6+)
| | Set up | Says | To move on | Hint / else | Pattern |
|---|---|---|---|---|---|
| K1 | The controls just broke. Paused. Pointer on the flashing CONTROLS bar. | "Your controls overheated. Held spins now turn the tank slowly." | dismiss | — | P10 + P1 |
| K2 | = V2 | | | | |
| K3 | At the console, tank frozen. Pointer on the blinking corner light. | "Turn the dial to the blinking light. Keep going until none blink." | `repaired` | Hint 5 s: pointer on the corner that's blinking now. | P2 + P3 |
| K4 | = V4, with: "Fixed! Every spin heats the controls; short rests cool them." | | | | P1 → P2 |

After the first repair of each machine, the console is back to normal (the tank runs at 25% while you're there).

**Muzzy, 2026-10-19 (answers):** the lessons are progressive — the bar is on screen from its rank, but nothing calls attention to it until the machine fails; then the game pauses and goes on rails: what broke, how to fix it, how to prevent it. The **very first** breakdown lesson (whichever machine breaks first) also says, at the console: "The game is fully paused for this moment. Normally it keeps running at 25% speed while you're here." · Going to the console mid-shift (W / ↑ / flick up — straight to the console): the **first 5 times** (outside a lesson), one line: "The tank keeps running at 25% speed while you're here."

---

## 6. What the lesson runner must be able to do

The check-list for F30 (the runner being built in parallel from v1's patterns). Engine hooks first, then runner, then screen.

**Engine (training hooks — level set-up data, not special engine modes)**
- Start a shift with a **given grid** (each phase starts cold; `startGrid` exists) or empty, no starting junk.
- **Choose the next pieces**: shape, colour and which way up, as a queue — plus a fallback rule when the queue runs out ("green O; blue I first if the column is too low"), then back to random.
- **Hold the piece size** at 4 cells (the size zones run on shift play time: 25 s → 5 cells, 50 s → 6 cells; day one would hit 6-cell pieces before free play).
- Let a piece **fall on its own** with all input off (B1).
- **Place a crack**: colour, row from the floor, column counted from the middle of the view (or "first empty column just out of view"), only in an empty, unsealed cell. Remove cracks.
- **Natural cracks off / on.**
- **Pressure**: set it, hold it (no rise), rise faster (×N), cap it (max 90%).
- **Integrity**: drain off / on, a floor (can't go under 20%), rupture allowed or not.
- **Overflow rail**: when a piece has no room, clear goop at the top instead of a rupture.
- **Rupture drain speed** (×0.5 on day one).
- **Zap filter**: only a given colour or group can be zapped.
- Report everything as events (most exist: `spawn`, `lock`, `merge`, `ready`, `pop` + `sealed`, `plug`, `quotaMet`, `rupture`, `end`, `breakdown`, `repaired`, `reject` + reason).

**Runner (src/game/lessons/)**
- Steps from data files (`content/lessons/*.json`), each with: set-up, message(s), advance condition, hint (delay + words + pointer), "if something else" reactions, pause/hold settings, named timings.
- **Allowed inputs per step**: spin, rotate, fast drop, zap, swap, console, pause button. Off = silent.
- **Pause vs slow vs freeze**: pause the rules clock while a message shows; freeze the tank at the console for a first repair; otherwise leave the console's 25% alone.
- **Wait for**: any engine event (with a filter, e.g. `plug` with plugged = true, `pop` that sealed ≥ 1, `ready` for a given group); screen events (console opened / closed, periscope pulled, shift started, report closed, pause menu opened); piece row ≥ N; pressure ≥ N; a group under the line; time passed; **a crack out of view** (`isOnScreen` in `tank.ts` — the arrow is drawn only, there is no event); **a crack covered by the wrong colour** (grid colour ≠ crack colour).
- **Wait-then-hint** timers, cancelled by doing the thing.
- **Retry** with a counter (D2's piling-up cracks).
- **A discovery listener** that lives across steps and fires once (D4), resuming the step it interrupted exactly where it was.
- **Lessons queue** (two breakdowns at once) and **skip-ahead** when the player is already past a step.
- **Hide the game's own messages** while a lesson message is up.
- **Input-aware wording**: the message picks its Keys / Mouse / Phone wording from the input used last.
- **Words with numbers**: `{left}`, `{total}` filled from the live state.
- **Remember** on the device: first day done, each breakdown lesson seen, the D4 discovery seen. "Replay lessons" in Settings.
- **Finishing day one**: rank 0 → rank 1 (top up XP to the first rank-up; never on a replay), then back to the console.
- **Restart at the phase start** after leaving mid-day; the Dev Kit can jump to any step (F30 task 4).

**Screen (the lesson look, F30 task 3)**
- A message box (kit) that can be paused-and-dismissed or just shown.
- A **pointer** at: a tank cell (a crack, a group, the x-ray box, the red X), an off-screen arrow, a HUD item (PSI readout, INTEGRITY, `CRACKS n / 4`, a machine bar), a console part (periscope, a repair panel's lamp, slider, button or dial), a report button. Tank pointers follow the tank as it spins.

---

## 7. Where the intercom voice joins (beta, F35)

Alpha is plain words. In beta the same steps get the Employer's static-garbled intercom (key words in green), the same runner, no new steps. The natural places: A1 (welcome to the job), D1 (cracks are "policy"), F1 (the quota as a company target), F3 (clock out), and V1 / L1 / K1 (the Employer blaming you for faulty machines). Each step keeps its plain line as the green key words.

---

## 8. Open questions for Muzzy (taste calls)

**Answered by Muzzy, 2026-10-19:** Q1 = a (a real rupture — "we need to explain that system and trigger: integrity ends it, cracks drain integrity, last chance to pop as pressure fast drains") · Q2 = swap is locked behind a rank: reaching it tells you it's unlocked — one of ~3 small feature unlocks at sequential ranks (F59) · Q3 = progressive: taught when the machine first fails (pause → guided: fix it, prevent it) · Q4 = a (frozen: "a tutorial on rails") · the console keys go straight to the console; the first 5 visits say the game runs at 25% there.

**Q1 — How does day one end?**
a) A real rupture after the quota, with a nudge (pressure rises faster) if it hasn't come within 60 s. *(my pick: it shows the end of every shift once, safely.)*
b) v1's way: pressure stops at 90% and you leave whenever you like.
c) End right at the quota; the first real shift teaches the rupture.

**Q2 — Swap (hold still 1.5 s to swap the piece)?** Note: the held and next pieces aren't drawn anywhere yet, so you can't see what you'd swap to.
a) Not on day one; it's on (untaught) in free play; teach it once the held piece is drawn. *(my pick)*
b) A step in phase B.
c) A one-line first-time lesson when the Swap bar first appears.

**Q3 — Breakdown lessons: when do they teach the meter?**
a) At the first break; the "how to keep it up" line comes after the fix. *(my pick: you see the break and the fix once.)*
b) When the bar first turns red (but then you may never see a break or a repair).
c) Both.

**Q4 — The tank during the first repair of each machine?**
a) Frozen for that first repair, then one line that it keeps running slowly. *(my pick: learning a panel under time pressure feels bad.)*
b) The real 25% speed from the start.

---

## 9. Runner check (Sprint 10 spike)

*2026-10-20, F31 task 9. §6 line by line against the code on `dev/m1-core-shift`, then each of the 15 steps against the lesson format. ✅ have = already there · 🔨 built now = added in this spike (unit tests in `tests/engine/training.test.ts`, `tests/lessons/runner.test.ts`, `tests/lessons/goopsDay.test.ts`) · ⏳ missing = still to do, and where.*

### §6, line by line

| §6 needs | | Where / what |
|---|---|---|
| Start with a given grid or empty | ✅ | A training shift starts empty, no junk (`shift.ts:138`, `startGrid` `shift.ts:37`); `"clear"` + `"goop"` set-ups |
| Choose the next pieces (shape, colour, which way up) | ✅ | `"pieces"` → engine `queue` (`training.ts` PieceChoice `turns`) |
| …plus a fallback rule, then back to random | 🔨 | `"then": { "pieces", "buildUp" }` → `PieceFallback` + `columnTooLow` (`training.ts:73`), decided again as each piece comes in (`shift.ts:607` fallbackChoice) — a new queue without `then` = random again |
| Hold the piece size at 4 | ✅ / 🔨 | rule `zone: "tetra"` (`training.ts:21`, on from the start of a training shift). 🔨 `"play": "normal"` now runs **before** `"rules"`, so F1 can say "normal play + zone tetra + rails" in one set-up (before, normal play wiped the rails and the size lock) |
| A piece falls on its own, all input off | ✅ | `allow: []` + `falling` (`training.ts:18`) |
| Place a crack (colour, row, column from the middle) · remove cracks | ✅ | `"cracks"` / `"removeCracks"` (`shift.ts:656`, `:669`); refused on goop, a crack or a sealed spot |
| …"first empty column just out of view" | 🔨 | `"cracks": [["outOfView", row, colour]]` / `["inView", …]` → `freeCrack` (`training.ts:84` freeCrackSpot: in view from the middle out; out of view just past the edges, nearest first) |
| Natural cracks off / on | ✅ | rule `cracks` (`training.ts:15`) |
| Pressure: set, hold, ×N, cap | ✅ | `"pressure"`; rules `pressureRise`, `pressureCap` (`training.ts:14`, `:22`) |
| Integrity: drain on/off, floor, rupture allowed | ✅ | rules `integrity`, `integrityFloor`, `rupture` (`training.ts:16`, `:23`, `:24`) |
| Overflow rail | ✅ / 🔨 | rule `overflowRail` (`training.ts:25`). 🔨 it now sends an `overflowRail` event (`shift.ts:728`) so F1's "Too full — I've cleared some" can react to it |
| Rupture drain speed | ✅ | rule `ruptureDrainSpeed` (`training.ts:26`) |
| Zap filter by colour | ✅ | rule `zapColors`, colour names (`training.ts:27`). By group: not needed on day one |
| Everything as events | ✅ | all engine events reach the runner (`goopsLessons.ts` session.listen); `ready` carries only a group id → 🔨 colour gates below |
| Steps from data (set-up, messages, advance, hint, reactions, pause, timings) | ✅ | `lessonTypes.ts` |
| Allowed inputs: spin, rotate, fast drop, zap, swap | ✅ | `allow` (`goopsLessons.ts:215` — a blocked control isn't even heard) |
| …console and pause button | ⏳ | the engine always lets `console` through and the pause button is App's — **task 11** (App: the console / pause switch per step) |
| Pause vs slow vs freeze | ✅ | `while` (`runner.ts:100`), `"console": "frozen"` (`goopsLessons.ts:133`) |
| Wait for an engine event with a filter | ✅ | `where` (e.g. `plug` `{ "plugged": true }`, `pop` `{ "sealed": 1 }`) |
| …only while something holds (D2's miss = a landing while the crack is open) | 🔨 | `{ "on": "event", …, "if": <gate> }` (`runner.ts:157`) |
| Screen events: console opened/closed, pause menu, shift started | ✅ | `lessonPlay.screen` + `shiftStarted` |
| …periscope pulled at A1, report closed at F3 | ⏳ | **task 11** (App: A1 ends on the shift starting; the report's "Back to the console" needs a screen event) |
| Piece row ≥ N · pressure ≥ N · time | ✅ | gates `position`, `pressure`; `{ "on": "time" }` |
| A group under the line / ready / full, by colour | 🔨 | gates `underLine:<colour>`, `ready:<colour>`, `full:<colour>` (`goopsGates.ts:24`) |
| A crack out of view · covered by the wrong colour | ✅ | gates `cracksOutOfView`, `wrongCover` (F30 built them; §6's "there is no event" is answered by a polled gate). 🔨 also `plugged`, `openCracks` |
| Wait-then-hint, cancelled by doing the thing | 🔨 | before: only the step moving on cancelled a hint. Now hint `from` (start the wait on an event / gate), `unless` (doing it = no hint, one that's up goes and the step's words come back), `again` (start over: "20 s without a seal") (`runner.ts:178`) |
| Retry with a counter | ✅ | `retry` + `{tries}` (`runner.ts:270`) |
| A discovery listener across steps, once, resuming the step | ✅ | `interrupts` (`runner.ts:317`) |
| …armed from D2 to the end; only during E1 | 🔨 | interrupt `from` / `to` step ids (`runner.ts:312`) |
| …"if it hasn't fired by free play, put a crack out of view" | 🔨 | step `ensure: { interrupt, setup }` (`runner.ts:223`) — skipped when it fired or was seen on this device |
| Lessons queue · skip-ahead | ✅ | `queue` (`runner.ts:357`), `skipIf` |
| Hide the game's own messages under a lesson message | ✅ | `App.tsx:80` (see the C1 / C3 note below) |
| Input-aware wording incl. Phone | ✅ | `{ keys, mouse, phone }` words (`goopsLessons.ts:276`), last input from keydown / pointer type (`:181`) — touch = phone. The day's words are task 10 |
| Words with numbers | ✅ | `{left}` `{total}` `{sealed}` … (`goopsLessons.ts:262`) |
| Remember: breakdown lessons, the D4 discovery | ✅ | kit tips memory (`lessonSeen`, interrupt `remember`) |
| …first day done · rank 0 → 1 (never on a replay) | ⏳ | **task 11** (App + progress) |
| Restart at the phase start | ✅ / ⏳ | runner side ✅: `checkpoint` + `restartPoint` (`runner.ts:379`); saving the step reached and starting there next time ⏳ **task 11**. Dev Kit jump ✅ |
| Message box: paused-and-dismissed or just shown | ✅ | LessonView |
| Pointer: a tank cell, following the spin | ✅ | `{ "cell" }`, `{ "piece" }` |
| …a crack / the x-ray box / the red X / an off-screen arrow / a group | 🔨 | `{ "crack": "open" \| "plugged" \| "wrongCover" \| "outOfView" }` (nearest; out of view = the edge cell where its arrow is) and `{ "goop": "<colour>" }` (biggest group) (`goopsGates.ts:47`, `goopsLessons.ts:407`) |
| …HUD: PSI readout, machine bars, INTEGRITY | ✅ / 🔨 | tags `readout`, `bar-<machine>`; 🔨 `bar-integrity` (`goopsLessons.ts:302`) |
| …HUD `CRACKS n / 4` · the report's button | ⏳ | neither has a data-tag (`App.tsx:337`; the report screen) — **task 11** (one `data-tag` each) |
| …console parts (periscope, panels) | ✅ | F32 tags |

### The 15 steps against the format

| Step | Set-up | Advance | Hint | Retry / "if something else" | |
|---|---|---|---|---|---|
| A1 | none (console) | `shiftStarted` | `time` 6 s, pointer `periscope` | Settings: nothing to do | ✅ + ⏳ App: start A1 at the console (`startAtConsole`), then on the pull start the training shift at **B1** (`lessonPlay.start(id, "B1")`) — today a new shift stops a console lesson (`App.tsx:132`) |
| B1 | clear, allow [], pressureRise 0, autoSpawn off, blue I `turns: 1`, spawn | gate `position` | — | controls off | ✅ |
| B2 | allow [softDrop] | `lock` | 3 s `unless` softDrop | lands anyway | ✅ (🔨 unless) |
| B3 | yellow T, spawn, allow [rotate, softDrop]; `showAfter` 1.2, pause | `lock` | `from` position ≥ half, after 0, `unless` rotate | lands unturned: moves on | ✅ (🔨 from / unless) |
| C1 | 3 steps: paused line (pointer `readout`) → pressureRise 4, zapColors [yellow], allow [pop], **no message** → pressureRise 0 + "Now click the yellow" | gate `ready:yellow` ≥ 1, then `pop` | 3 s, pointer `{ "goop": "yellow" }` | early click: the game's own "Above the pressure line" | ✅ (🔨 gate, pointer) — the middle step must have no message: App hides the game's messages while ANY lesson message (even pointer-only) is up |
| C2 | pressure 15, blue O, allow [softDrop, rotate] | `merge`, then a paused line | — | — | ✅ (pointer `{ "goop": "blue" }` 🔨) |
| C3 | zapColors [blue], allow [pop] | `pop`, then paused line on `readout` | `from` gate `ready:blue`, 3 s | "Still filling": a **reaction** on `reject` `{ "reason": "filling" }` until `ready:blue` (the step's message is up, so the game's own toast is hidden) | ✅ (🔨 from) |
| D1 | clear, pressure 15, crack [3, 0, green], integrity on; `showAfter` 1.5 pause; 2nd page pointer `bar-integrity` | dismiss × 2 | — | — | ✅ (🔨 tag) |
| D2 | green O + `then` green O's, spawn, allow spin/rotate/softDrop; a no-message step to row 14, then the paused line | `plug` `{ "plugged": true }` | 3 s `unless` spin, pointer `{ "crack": "open" }` | retry on `lock` `if` `plugged` ≤ 0 → `"cracks": [["inView", 0, "green"]]` + "Try again" | ✅ (🔨 if, freeCrack, then, unless) |
| D3 | zapColors null, allow + pop | `pop` `{ "sealed": 1 }`, then paused line on CRACKS | `from` `ready:green`, 3 s, pointer `{ "crack": "plugged" }` | extra seals just count | ✅ + ⏳ CRACKS tag |
| D4 | interrupt, `from: "D2"`, gate `cracksOutOfView` ≥ 1, `remember`, pointer `{ "crack": "outOfView" }` | dismiss → the step resumes | — | once ever | ✅ (🔨 from, pointer) |
| E1 | clear, pressure 35, crack [-2, 4, green], blue I + green O, `then` green O's with `buildUp` blue I under [-2, 4] | `plug`, then `pop` `{ "sealed": 1 }` | `from` `lock` count 2, after 8 | red X: interrupt `from`/`to` E1's steps, gate `wrongCover` ≥ 1, pointer `{ "crack": "wrongCover" }` | ✅ (🔨 fallback, from, interrupt range) |
| F1 | `play: normal` + rules { zone tetra, pressureCap 0.9, integrityFloor 0.2, rupture false, overflowRail true }; `ensure` d4 → `[["outOfView", 0, colour]]` | `quotaMet` | 20 s, `again` `pop` `{ "sealed": 1 }`, pointer `{ "crack": "open" }` | reactions: `overflowRail` event → "Too full…"; gate pressure ≥ 90 until ≤ 89 | ✅ (🔨 play order, ensure, again, event) — check in task 12 that the game's "Quota met!" banner isn't hidden by F1's own line going at the same moment |
| F2 | rails off, ruptureDrainSpeed 0.5 | `rupture` → paused line (`showAfter` ~1 s so "Rupture!" shows first) → `end` | — | 60 s nudge: `retry` `when` time 60 → pressureRise 3, no message | ✅ — a training shift's rupture doesn't drop the lesson (`firstBreakdowns.ts:37` only drops in real shifts) |
| F3 | none (the report) | ⏳ a screen event for "Back to the console" / "Next shift" | 6 s pulse | — | ⏳ task 11: the event, the report button's tag, rank 0 → 1, the lesson running with no engine after the shift ended (the F59 console lessons already prove the runner needs none) |

**Still missing, and why it waits:** all of it is App wiring, which is task 11 — per-step console / pause switches, A1 → B1 across the periscope, the report's screen event + tag, the CRACKS tag, "first day done" + rank 0 → 1, and saving the reached checkpoint. Nothing missing in the engine or the runner.

---

## 10. Built (F31, Sprint 10 tasks 10–12, 2026-10-20)

*The day as it runs now: `content/lessons/first-day.json` (words: `content/text/en.json` → lessons.first-day), wired by `src/game/lessons/firstDay.ts` + `src/ui/App.tsx` (TDD D16), proven end to end by `e2e/first-day.mjs` (keys A1→F3, a real finger A–D, leaving mid-phase, shots at 390x844 · 360x780 · 1440x900 in `e2e-shots/first-day/`). A design step can be 2–3 runner steps (a no-message wait, then the line) — their ids are shown.*

| Step | Built | Says (Keys · Phone, where they differ) | Moves on when |
|---|---|---|---|
| A1 | ✅ on the console's monitor | "Your first day! Press ↓ or Enter to pull the periscope." · "…Pull the periscope down to start." (Mouse: "Drag the periscope down to start."); hint 6 s | the pull (drag, tap, ↓ / Enter) — the day's shift starts at the phase reached |
| B1 | ✅ | "Goop drops into the tank from the top." | the piece is 7 rows in (a third of the way) |
| B2 | ✅ | "Slow, right? Hold S or ↓ to fast drop." · "…Drag down on the tank to fast drop."; hint 3 s unless fast-dropping | it lands |
| B3 | ✅ paused line after 1.2 s | "Q or E turns the piece. Turn it, then drop it." · "Tap left or right of the piece to turn it."; hint when halfway down, unless turned | it lands |
| C1 · C1-rise · C1-zap | ✅ | "Pressure rises over time. Goop under the line can be zapped." (paused, on the PSI readout) → no line (×4 rise; the game's own "Above the pressure line" on an early zap) → "Now click the yellow goop to zap it." · "Now tap…" (pressure held; hint 3 s) | the yellow is zapped |
| C2 · C2-join | ✅ | (blue O lands) → "Same colours join into one blob. Fresh goop fills up first." (paused, on the blob) | Got it |
| C3 · C3-vent | ✅ | "Zap the blue blob once it's full." (a zap while it fills: "Still filling. Wait until it's full.") → "Zapping lets out a little pressure. Big blobs let out more." (paused, on the readout) | the zap, then Got it |
| D1 · D1-integrity | ✅ | "A crack! Cover it with goop of the same colour." → "Open cracks wear down the tank. This bar is its health." (on INTEGRITY) | Got it × 2 |
| D2 · D2-spin | ✅ | (a third of the way down, paused) "The piece always falls down the middle. A / D or ← / → spins the tank." · "The piece falls down the middle. Drag sideways to spin the tank."; hint 3 s unless spinning; a miss: another crack + "Try again. Spin until the shadow is over the crack." | the crack is plugged |
| D3 · D3-sealed | ✅ | "The crack shows through the goop. Zap that goop to seal it." → "Sealed! Seal 4 cracks a day to meet your quota." (on CRACKS n / 4) | the seal, then Got it |
| D4 | ✅ interrupt, from D2, once per device | "You only see part of the tank. Arrows point to cracks out of view." (on the arrow) | Got it → back where it was |
| E1 · E1-build · E1-seal | ✅ | "Cracks form up high too. Stack goop under them to reach." → (blue I, green O, then green O's with a blue I first while too low; hint 8 s after the 2nd landing) → "Now zap the green goop to seal it."; red X: "Wrong colour. See the red X? Zap that goop to uncover it." | plugged, then sealed |
| F1 · F1-quota · F1-work | ✅ | "Cracks come faster as pressure rises. Zap goop to keep it down." → "Seal {left} more to meet the quota." (on CRACKS) → free play: hint 20 s without a seal; "Too full! I've cleared some. Zap more often." (the overflow rail); "Zap goop to let pressure out." (at the 90 % cap) | the quota is met (the game's own "Quota met!" shows) |
| F2 · F2-drain · F2-end | ✅ | (the game's own "Rupture!") → "The tank broke! Zap all the goop you can before pressure hits zero." (paused, 1 s after) | the shift ends |
| F3 | ✅ on the report | "Day one done! Back to the console to clock out." (under the button) | Back to the console / Next shift / the swipe up → the day remembered, rank 1 |

**What changed from the plan (§3), and why**
- **Phone words** written for every input-dependent line (§3 had slots), from GDD §4's touch. A phone shows its Phone words from the very first line (a touch screen with no mouse counts as a phone before anything is touched).
- **A1's keys are true now:** ↓ / Enter pull the periscope from anywhere on the console between shifts (before, only once the grip had the keyboard's focus — a Tab away).
- **The console and the pause button per step:** the pause button works the whole day (it's the way out: End shift = leaving mid-day); W / ↑ / flick up only from free play — there the tank stands still while you're at the console (§3's rule).
- **C2 moves on when the O lands** (its join happens in the same moment), not on the merge event alone — can't get stuck if it somehow doesn't touch the blue.
- **C3's "Still filling" is the lesson's own reaction:** the step's line is up, which keeps the game's own messages quiet (the spike's note).
- **D2 has a most-tries (8):** after 8 misses it moves on; D3 and its "Sealed!" line skip themselves when nothing is plugged (E1 teaches the seal again). Not stuck, ever.
- **E1-seal stops the pieces and lets pressure rise** (found by the e2e): pieces kept landing on the plugged green, the group grew over the held line and could never be zapped — stuck. Now no more pieces come once it's plugged, and the line rises at the normal rate until the goop is under it.
- **F1's quota line shows once (Got it), then free play runs with no line up** — a line up for the whole of free play would hide the game's own warnings ("Tank weak", "Pressure near max") all the time. The quota counts as met by the event OR the count (seals piled up in D could meet it early → its steps skip).
- **F2's end waits on "the shift is over", not only on its event** — a short drain (an overflow at low pressure) can end the shift before the waiting step starts. Its line skips itself if the drain already ended.
- **F3:** no 6 s pulse hint (the outline already pulses). The line sits under the button — above it, it covered "Next shift" and the rank-up on the report.
- **Rank 1 comes with the report, not on the console:** the shift's XP is topped up to the first rank-up when the day's shift ends, so the report already says "Rank up! 1 · New: next piece" and the console's meter fills on the way back. Closing the page on the report still leaves rank 1.
- **The rails:** pressure capped at 90 %, integrity floor 20 %, no rupture, the overflow rail clears the top — proven by 10 minutes of sped-up free play in the e2e.

**Logged, not changed:** the bubble is see-through glass (the kit's Callout look): where it sits over the pressure line, the PSI readout and the dashed line show through its words (D1, E1 at 1440). A taste call for Muzzy (see SPRINT Notes).
