# Phone gestures — inventory, collisions, playtest (F10, Sprint 06, task 1)

*Research only, 2026-10-19, written from the code on `dev/m1-core-shift`. Nothing here has been changed in the game.*
*Estimates of "how often a real thumb does this" are **guesses** (no phone data yet). The playtest in §3 replaces them with facts.*

Words used below:
- **Pointer** = one finger (or the mouse, or a pen). The game handles all three with the same code.
- **Dead zone** = a small distance the finger can move without anything happening (so a shaky finger doesn't count as a drag).
- **Axis lock** = once a drag has moved a little, the game decides "this is a sideways drag" or "this is an up/down drag" and sticks with that decision until the finger lifts.
- **Joystick-style drag** = the tank doesn't follow your finger 1:1. Pushing past the dead zone makes it *keep turning* at a steady speed while you hold there, like tilting a joystick.

---

## 1. Every gesture the game listens to

### 1a. In the tank (during a shift) — `src/input/controls.ts`

The listener sits on the **whole game stage** (`.stage`, full screen — `ShiftStage.tsx:236`), not just the tank. So these work anywhere on screen that isn't a button: the tank, the water above it, the side margins, and the machine/integrity panel under the tank (the panel lets touches through: `blocks.css:166`). Only the HUD's top-row **Console** button catches its own taps.

The game only listens while a shift is really running: not under a menu, not during a slide, not when paused (`ShiftStage.tsx:251`). A finger that lands while it's off is ignored for its whole press.

| # | What the finger does | What the game does | Thresholds (where they live) | Where it works |
|---|---|---|---|---|
| T1 | **Drag sideways and hold there** | Turns the tank, joystick-style: one column straight away once past the dead zone, then one more every 100 ms while the finger stays out there. Drag left = goop slides left with the finger. Bring the finger back near where it started = stops. Cross to the other side = turns the other way. With **broken controls** the repeats are 2× slower (first column still instant). | Axis lock after **10 px** in any direction (`controls.ts:28`, hard-coded). Turning starts past **20 px** sideways (`controls.ts:29`, hard-coded). Repeat **100 ms** (`tank.json` → `spinRepeatMs`). Broken slowdown **×2** (`breakdowns.json` → `controls.heldSpinSlowdown`). Note: keys wait `spinFirstDelayMs` (250 ms) before repeating; a drag does **not** — it repeats after 100 ms. | Anywhere on the stage |
| T2 | **Drag down** (slow or fast) | Fast drop, for as long as the finger is below where it started. Lift = stops. | Axis lock 10 px (as above), then "down" = any distance below the start point (`controls.ts:97`). | Anywhere on the stage |
| T3 | **Quick flick down** | Same fast drop while moving, plus a short **150 ms** of extra fast drop after you lift. | Under **300 ms** (`controls.ts:30`), more than **50 px** (`controls.ts:31`), mostly vertical at the moment you lift. The 150 ms is hard-coded (`controls.ts:115`). All hard-coded. | Anywhere on the stage |
| T4 | **Quick flick up** | Opens the console over the tank mid-shift (the shift keeps running at ¼ speed — `breakdowns.json` → `consoleTimeScale` 0.25). | Same as T3: under **300 ms**, over **50 px**, more up than sideways when you lift (`controls.ts:113-114`). A *slow* drag up does nothing at all. | Anywhere on the stage |
| T5 | **Tap empty space** | Rotates the piece: left half of the **screen** = anticlockwise, right half = clockwise (`controls.ts:111-112`). | A tap = moved **less than 10 px** and lifted in **under 250 ms** (`tank.json` → `holdDelayMs`). | Anywhere on the stage that isn't goop (the water, the margins, the panel under the tank). Halves are of the whole screen, not the tank. |
| T6 | **Tap goop that's ready** | Zaps (pops) that group. With a **broken laser**, the first tap only "primes" it (it glows) and a second tap pops it (`shift.ts:480`). | Same tap rules as T5. Which cell = the one you *see* under the curved-TV visor look (`ShiftStage.tsx:217`). | Goop cells inside the tank |
| T7 | **Tap goop that isn't ready** (still filling, or above the pressure line) | Nothing pops — the goop **jiggles** where you poked it and a message says why. **The piece does not rotate.** | Same tap rules. Jiggle strength `goo-jelly.json` → `poke` (1). Reasons: `shift.ts:472-476`. | Goop cells inside the tank |
| T8 | **Press and hold still** | After 0.25 s a "Swap" bar appears in the HUD and fills; at 1.5 s the piece swaps with the held one. Moving more than 10 px at any point cancels it. Lifting between 0.25 s and 1.5 s does **nothing** (not a tap, not a swap). | Bar shows from **250 ms** (`tank.json` → `holdDelayMs`), swap at **1500 ms** (`tank.json` → `holdToSwapMs`), cancel at **10 px** (hard-coded, `controls.ts:28`). | Anywhere on the stage |

Things the tank listener deliberately ignores:
- **A second finger.** While one finger is down, any other finger is ignored completely — its taps, drags and lifts (`controls.ts:81`, `88`, `100`).
- **Hard drop** (instant slam to the floor) — there is none, on purpose (GDD §4).
- **Abilities** — they have no touch control yet (nothing in the UI fires `type: 'ability'`).

### 1b. The HUD top row (during a shift)
| # | Gesture | Does | Notes |
|---|---|---|---|
| H1 | Tap the **Console** button (top right) | Opens the **pause menu** (`App.tsx` → `onPause={() => screens.push('pause')}`), *not* the console. | The button's word is "Console" (`en.json` → `hud.pause`), but a swipe up opens the real console. Two different things answer to "Console". See §5. |

### 1c. The console (main menu, and mid-shift) — `src/ui/Console.tsx`, kit `PullHandle.tsx`, `SnapControl.tsx`
| # | Gesture | Does | Thresholds |
|---|---|---|---|
| C1 | **Pull the periscope down** | Past 60% of its travel and let go → it finishes the pull and starts the shift (or, mid-shift, goes back to the tank). Short of that it springs back. | Travel = **0.566** of its height (`content/ui/art.json` → `console.layers.periscope.travel`); "finish" point **0.6** of the travel (kit default, `PullHandle.tsx:30` — not in content/); only its bottom **0.345** is grabbable (`grip`). Counts as a drag after **0.5 rem ≈ 8 px** (`PullHandle.tsx:28`, hard-coded in the kit). |
| C2 | **Tap the periscope** | Does the whole pull by itself. | Moved under 8 px. |
| C3 | Tap buttons (Settings gear; mid-shift on a phone on its side: "Back to the tank") | As labelled. | Normal buttons. |
| C4 | **Repair panels** mid-shift: drag or tap the sliders and the dial; tap the visor buttons | Repairs (laser sliders, controls dial, visor buttons). | Kit `SnapControl`: tap vs drag split at **0.5 rem ≈ 8 px** (`SnapControl.tsx:34`); dial ignores the middle **20%** of its radius (`SnapControl.tsx:35`). Covered by `e2e/repairs.mjs` with real fingers. |

### 1d. The end-of-shift report — kit `layout.tsx` `useSwipe`
| # | Gesture | Does | Thresholds |
|---|---|---|---|
| E1 | **Swipe up anywhere on the report** | Back to the console (same as "Quit"). | At least **3 rem ≈ 48 px**, and 1.5× more up than sideways (`layout.tsx:86`, `103`). **No time limit** — a slow swipe counts here (unlike T4). Skipped if the report could scroll that way. |
| E2 | Tap "Again" / "Back to the console" | As labelled. | Buttons. |

### 1e. Dev Kit (local dev always; **live builds too while** `content/devkit.json` → `inReleaseBuilds` is `true`, which it is now)
| # | Gesture | Does | Thresholds |
|---|---|---|---|
| D1 | **Triple-tap the top-right corner** | Opens / closes the Dev Kit. | 3 presses within **700 ms** (`DevKit.tsx:83`) inside a **64 px** square in the top-right corner (`DevKit.tsx:82`). It listens *before* the game and does **not** stop the taps reaching the game underneath. |
| D2 | Dev Kit panel: scroll, sliders, waveform drag | Editing. | Its own panel; doesn't reach the game. |

### 1f. The phone itself (not our code, but it shares the screen)
- Page zoom is off (`index.html` viewport `user-scalable=no`) and the stage has `touch-action: none`, so the browser won't scroll or pinch the game.
- **System gestures still win**: swipe up from the very bottom edge (iPhone home / Android home), swipe in from the left or right edge (Android "Back", iOS Safari back), pull down from the top (notifications). Our code can't block these.

---

## 2. Where two gestures can be confused

Ordered roughly by risk (my guess). "Wins today" = what the code actually does.

### C-1. Two thumbs at once — **high risk**
- **What happens:** many phone puzzle players drag with one thumb and tap-rotate with the other. Here the second thumb is ignored completely (`controls.ts:81`). Worse: if the first thumb is resting still, its hold timer keeps charging, so the player can get an unwanted **swap** 1.5 s later while their other thumb's taps did nothing.
- **Wins today:** the first finger, always.
- **How likely:** guess — **common** for anyone who's played Tetris-style phone games; maybe 1 in 3 players try it within the first minute.
- **Possible fixes:**
  1. Let a second finger's quick tap rotate (left/right half) while the first finger drags — natural two-thumb play; a bit more code, and need a rule for "second finger lands on goop".
  2. Cancel the first finger's hold the moment a second finger lands — stops surprise swaps; still ignores the second finger's intent.
  3. Leave it, and teach "one thumb" in the tutorial — no code; fights players' habits.

### C-2. Tap to rotate lands on goop — **high risk, grows as the tank fills**
- **What happens:** "tap left/right half to rotate" only works on *empty* space. A tap that lands on any goop zaps it if ready, or **jiggles it and doesn't rotate** if it isn't (`controls.ts:110`, `ShiftStage.tsx:245-249`). Once the stack is half-way up the tank, half the screen no longer rotates.
- **Wins today:** the goop (zap/poke) always beats rotate.
- **How likely:** guess — **very likely** mid-shift; players aim for "the right side", not "the empty bit of the right side". A lost rotation near the top is often a lost piece.
- **Possible fixes:**
  1. Only zap *ready* goop; a tap on goop that can't pop falls through to rotate (keep a small jiggle) — keeps zapping; loses the "you poked it" message unless it shows anyway.
  2. Rotate-only zones: e.g. taps above the pressure line / near the falling piece always rotate — clear, but the line moves, so the zone moves.
  3. Move rotate to a separate place (e.g. two buttons in the bottom panel) — no ambiguity; costs screen space and changes the GDD's controls.

### C-3. A slow tap is swallowed — **medium-high risk**
- **What happens:** a tap only counts if you lift within **250 ms**. Lift between 0.25 s and 1.5 s and *nothing happens* — no rotate, no zap, no swap (`controls.ts:109`). The Swap bar flashes up briefly, which may read as "something went wrong".
- **Wins today:** neither — the press is thrown away.
- **How likely:** guess — quick tappers rarely (taps are usually 80–150 ms), but careful or tense players press-and-lift at 200–350 ms; maybe **5–15% of taps** for some people, more when stressed late in a shift.
- **Possible fixes:**
  1. Raise `holdDelayMs` to ~350–400 ms (it's in `tank.json` already — no code) — fewer lost taps; the swap bar shows a little later.
  2. Treat any short-ish press that didn't move as a tap up to, say, 600 ms — kind; leaves a smaller "dead" window before swap.
  3. Keep 250 ms but make the swap bar not show until ~500 ms — fixes the "something flashed" feeling only.

### C-4. Holding still to think vs hold-to-swap — **medium risk**
- **What happens:** a thumb resting on the screen (while deciding where to turn) that drifts less than 10 px swaps the piece at 1.5 s (`controls.ts:66-76`).
- **Wins today:** swap. The bar from 0.25 s is the only warning.
- **How likely:** guess — **occasional** (resting thumbs are common on phones; most drift more than 10 px though, which cancels it).
- **Possible fixes:**
  1. Raise `holdToSwapMs` (in content) — fewer accidents; swap feels slower.
  2. Only allow hold-to-swap on a specific spot (e.g. the held-piece preview) — no accidents; a new target to learn.
  3. Make the swap bar much louder (sound + size) so players learn to let go — no logic change.

### C-5. Diagonal drags (down vs sideways) — **medium risk**
- **What happens:** the decision "sideways or up/down" is made after only **10 px** of movement and is kept until you lift (`controls.ts:90-92`). A thumb arcing down-and-across (thumbs move in arcs) may lock to the wrong one: you wanted to turn the tank and got a fast drop, or the reverse. Once locked, the other action is impossible until you lift.
- **Wins today:** whichever direction was bigger in the first 10 px.
- **How likely:** guess — **fairly common** for drags that start near 45°; thumb arcs are rarely straight in the first few millimetres.
- **Possible fixes:**
  1. Decide later (e.g. 20–25 px) and/or require one direction to be clearly bigger (1.5×, like the report's swipe) — fewer wrong locks; a hair more lag before anything moves.
  2. Give sideways the benefit of the doubt (it's undoable, a fast drop isn't) — safer; down-diagonals need to be more vertical.
  3. Allow re-locking if the drag clearly changes direction — most forgiving; more complex and easier to trigger by accident.

### C-6. Drag sideways, then flick up/down at the end — **low-medium risk**
- **What happens:** the quick-flick check at lift (`controls.ts:113`) doesn't look at the axis lock — it looks at the *whole* movement. A quick sideways drag (under 300 ms) that ends with the thumb rising more than it moved sideways **opens the console** (or adds a short fast drop if it fell).
- **Wins today:** the flick, even though the drag was locked "sideways".
- **How likely:** guess — **uncommon**, needs a fast (<0.3 s) mostly-vertical-overall gesture; but thumbs naturally lift upward at the end of a flick.
- **Possible fixes:**
  1. Only count a flick if the drag was locked up/down — one-line rule; removes this case completely.
  2. Also require the flick to be clearly vertical (1.5×) — fewer accidents, still lets odd drags through.

### C-7. Swipe up for the console vs the phone's own swipe-up-from-bottom — **medium risk on iPhone / gesture-nav Android**
- **What happens:** the integrity panel sits at the bottom of the screen. A swipe up that starts in the last ~2 cm hits the phone's home/app-switcher gesture instead (we can't stop that). Also a sideways drag that starts at the very left/right edge can trigger the phone's "Back".
- **Wins today:** the phone.
- **How likely:** guess — **occasional**; people start swipes low with their thumb.
- **Possible fixes:**
  1. Teach "swipe up on the tank" (hint text, tutorial) — no code.
  2. Keep the bottom panel tall enough that natural swipe starts sit above the system strip — layout only.
  3. Add the Console button as the main way and keep swipe as a shortcut — always reachable; the button already exists (see §5 naming).

### C-8. Quick flick up vs fast drop reversing — **low risk**
- **What happens:** dragging down (fast dropping) then flicking back up inside 300 ms with more than 50 px up overall opens the console. Needs the *whole* press under 0.3 s, so a real "drop then change mind" (slower) does nothing.
- **Wins today:** total movement at lift.
- **How likely:** guess — **rare**.
- **Possible fixes:** 1) leave it; 2) only open the console if the drag never went down — removes it entirely.

### C-9. Slow swipe up does nothing — **low-medium risk (a "nothing happened" moment)**
- **What happens:** the console needs a *quick* swipe (under 300 ms). A deliberate, slow swipe up — which works on the end report (E1 has no time limit) — does nothing in the tank.
- **Wins today:** nothing fires.
- **How likely:** guess — **likely the first few times**, especially after the report taught "swipe up" without a time limit.
- **Possible fixes:**
  1. Accept slow drags up too when they go far enough (e.g. 80+ px) — matches the report; small risk of opening it by accident.
  2. Raise `SWIPE_MS` to ~450 ms — gentler; still a time rule.

### C-10. Taps just outside the tank's sides — ✅ fixed by F58 (2026-10-19: only the visible tank takes clicks)
- **What happens:** a tap in the margin beside the tank is turned into a column number that **wraps round the cylinder** (`geometry.ts:52-53`), i.e. a column on the hidden back of the tank. If there's goop at that height back there, the tap zaps or pokes goop the player can't see instead of rotating.
- **Wins today:** the hidden goop.
- **How likely:** guess — **rare on a portrait phone** (the tank is nearly edge to edge); **likely** on a desktop window or tablet.
- **Possible fixes:** 1) a tap outside the visible tank's left/right edges never picks goop (always rotates) — tiny rule; 2) also ignore taps a few px inside the edge — more forgiving.

### C-11. Rotating fast in the top-right corner vs the Dev Kit — **low risk, but in live builds**
- **What happens:** three taps within 0.7 s in the top-right 64 px square open the Dev Kit — and the taps also reach whatever is underneath (the Console/pause button, or the tank). The Dev Kit is on in live builds right now (`devkit.json`).
- **How likely:** guess — **rare**; that corner is mostly the Console button. A player mashing the Console button could open the Dev Kit.
- **Possible fixes:** 1) leave it until `/deliver` 1.0 turns it off; 2) need 4–5 taps, or a long-press; 3) move the secret corner to top-left.

### Not a conflict, but a feel risk: the joystick-style drag
Players used to "drag and the thing follows my finger" will overshoot: holding the finger still past 20 px keeps the tank turning at 10 columns a second. To stop you must bring the finger back to where it started. This is v1's behaviour and the GDD keeps it — but it's the most likely thing a first-time player calls "too slippery". Worth watching in the playtest (line 2).

### Tap right after a drag
No problem found: each press starts fresh, and a lifted drag leaves no cooldown. A tap immediately after a drag works normally.

---

## 3. 10-minute phone playtest (refreshed 2026-10-20 for Sprint 10)

**Open on your phone:** http://192.168.1.152:5173/?rank=3 (same Wi-Fi as the PC). Rank 3 = the next-piece window and swap are on, the visor can break. A fresh phone shows two short unlock lessons at the first shift starts ("next piece", then "swap") — just press Got it. If the visor breaks mid-test, follow its lesson; that's fine.

Keep a note open. **For any line that doesn't do what it says, write the line number + what happened instead** (e.g. "6 — opened the console instead of turning"). Nothing to write for the lines that work.

What changed since the first version of this list: taps beside the tank no longer zap hidden goop (F58, fixed); swap now **trades the falling piece with the one in the next-piece window** (no held piece); the bottom panel now holds the next-piece window, the machine bars and the integrity bar.

1. **Tap** the empty water above the goop, left side then right side, 5 times each. → Every tap turns the piece (left = anticlockwise, right = clockwise).
2. **Drag sideways** ~1 cm and hold for 2 s, then slide back to where you started. → The tank keeps turning while you hold and stops when you come back. Note if it felt too fast / slippery.
3. **Drag down** and hold. → The piece falls fast until you lift.
4. **Hold your thumb still** on the water for 2 s. → A Swap bar fills at the top; at 1.5 s the falling piece trades places with the one in the next-piece window.
5. **Press firmly and lift** after about half a second (count "one-and"). → *Today nothing happens* (the Swap bar flashes). Note whether that felt like a missed turn.
6. **Diagonal drags:** 5 drags down-and-to-the-side at about 45°, the way your thumb naturally arcs. → Note how many turned the tank vs fast-dropped, and which you meant.
7. **Quick flick up** from the middle of the tank. → The console slides over the tank. Pull the periscope down (or tap it) to go back.
8. **Slow swipe up** from the middle (about 1 s). → *Today nothing happens.* Note if you expected the console.
9. **Swipe up starting on the bottom panel** (the next-piece window / the bars), then starting right at the screen's bottom edge. → The first should open the console; the second is the phone's own gesture. Note which happened.
10. **Two thumbs:** drag sideways with your left thumb and, while holding, tap the right side with your right thumb. → *Today the right thumb is ignored* (and the left one may swap). Note if you naturally wanted this.
11. When the goop is half-way up: **tap the right half where there's goop** (not ready yet). → *Today it jiggles and does NOT turn the piece.* Note if that cost you.
12. **Fast sideways flick** that ends with your thumb lifting upward. → It should only turn the tank. Note if the console opened.
13. **Tap ready goop** (under the pressure line, finished filling), including a one-cell bit near the tank's edge. → It zaps the group you tapped.
14. **Drag the periscope** down slowly on the console (not a tap), let go halfway once, then all the way. → Halfway springs back; all the way starts the shift.
15. At the end report, **swipe up slowly**. → Back to the console. (Compare with line 8.)

Phone model + browser: ______  Left- or right-handed: ______  One thumb or two? ______

**Then two calls (task 2), now that you've felt them:**
- **Two thumbs (line 10, C-1):** a) a second thumb's tap turns the piece while the first drags · b) a second thumb just cancels the first thumb's swap charge · c) leave it, one thumb only.
- **Tapping goop that isn't ready (line 11, C-2):** a) the tap falls through and turns the piece (the goop still jiggles + says why) · b) keep today's way (jiggle, no turn) · c) turning moves to its own buttons.

## 4. Fix ideas at a glance
The fixes for each collision are listed under it in §2. The cheapest ones that need **no code**, just `content/` changes: raise `tank.json` → `holdDelayMs` (C-3) and/or `holdToSwapMs` (C-4). The biggest win per line of code is probably C-6 fix 1 (only flick when locked up/down) and C-10 fix 1 (taps outside the tank never pick goop). The biggest design calls are C-1 (two thumbs) and C-2 (tap on goop vs rotate) — those are Muzzy's.

---

## 5. Surprises found on the way
- **Hard-coded touch numbers** (not in `content/`, so the Dev Kit can't tune them): axis lock 10 px, sideways dead zone 20 px, flick time 300 ms, flick distance 50 px, quick-flick fast drop 150 ms (all `src/input/controls.ts:28-31`, `115`); the periscope's finish point 0.6 (kit default). Also these are in **screen pixels**, so they feel different on a small vs large / high-density phone.
- **Two "Consoles":** the HUD's top-right button is labelled "Console" but opens the **pause menu**; a swipe up opens the **real console**. Not a gesture bug, but players will mix them up.
- **Drag doesn't wait before repeating like keys do:** keys wait 250 ms (`spinFirstDelayMs`) before repeating; a sideways drag repeats after 100 ms. GDD §4 says "same timing on every input".
- **Slow swipe up works on the report but not in the tank** (different code: the kit's `useSwipe` has no time limit; the tank's needs under 300 ms).
- **Swipe up was never tested with a finger or mouse** — only with the W / ↑ keys (see §6).
- **Abilities have no touch control** yet.

---

## 6. What the automated checks already cover
`e2e/controls.mjs` runs with a **mouse** (`hasTouch: false`), on a 390×844 phone-sized window:
- ✓ drag left spins the tank at ~1 column per 100 ms
- ✓ tap on the right half rotates clockwise
- ✓ tap a ready group pops it; a click picks the cell you see under the curved visor
- ✓ every key in the GDD table (spin, rotate, swap after 1.5 s but not at 0.6 s, console on W / ↑)
- ✓ typing in the Dev Kit doesn't reach the game

Elsewhere: `e2e/poke.mjs` (mouse click on not-ready goop jiggles it), `e2e/repairs.mjs` (repair sliders/dial/buttons with real **fingers** and mouse), `e2e/day.mjs` (finger tap on the periscope).

**Gaps** (nothing checks these today):
- No tank gesture is tested with a **finger** (touch events) at all.
- Not tested with pointer at all: **tap left half**, **drag down = fast drop**, **quick flick down**, **flick up = console**, **hold 1.5 s = swap** (only the keys are), **lift between 0.25 and 1.5 s = nothing**.
- No test for **second finger** behaviour, **diagonal** lock, the **flick-at-end-of-sideways-drag** case (C-6), **tap on not-ready goop doesn't rotate** (poke.mjs checks the jiggle, not the missing rotation), or **taps outside the tank's sides** (C-10).
- No test of the periscope **drag** (only taps).
