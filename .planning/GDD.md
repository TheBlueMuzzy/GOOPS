# Goops — Game Design Document (GDD)
> What the game is, how it plays, how it should feel. Aim for ~150 lines — detail lives in `design/` docs linked from here.
> Current phase: Discover   ·   Engineering plan: TDD.md (made at /define)   ·   Milestones, ideas, known issues: ROADMAP.md (made at /define)
> **Remake** of Goops v1 (branch `archive/goops-v1`, live 1.1.13). v1 review: `research/v1-review.md` · goo research: `research/goo-feel.md` · discovery notes: `research/discovery.md` · v1 design docs: `research/v1/`

## 1. Pitch
- **One line (rough):** A falling-goop puzzle game where you spin a cylindrical tank under the falling piece, merge and pop living goop to seal cracks before the pressure blows, and keep a crumbling console running for a faceless employer, one rank at a time.
- **Platform:** web, phone first — **portrait only** (Muzzy 2026-10-18: "the phone shouldn't ever go on its side in this game"), one thumb; desktop too   **Audience:** general (not made for kids). Short-session puzzle players who like mastery and dark office comedy.
- **References:** Tetris (lock delay, ghost, kicks: the movement feel) · Puyo Puyo (same-colour merge and pop, readable goo) · World of Goo / LocoRoco (goo that feels alive) · Papers, Please (a mundane job under a faceless employer) · Keep Talking and Nobody Explodes (hands-on console repairs). Deeper breakdown: `research/discovery.md`.
- **The story (Muzzy, 2026-10-16, his words):** "this is a new job. your first day. your job is to clear the tank of the semi-sentient goop that builds up inside of it. there are cracks that will form because the tank is pressurized, so you have to use the goop to seal the cracks by zapping them with your laser when they cover the cracks. this company and job is not a good one. the machines are faulty and unreliable, the only way to move up is to do a good job, but moving up just means running into more issues/problems."
  - So: popping = **zapping goop with the laser**; a crack is sealed by zapping goop **that covers it**. The tutorial is **your first day**. Breakdowns are **faulty machines**. Ranks are **promotions that bring more problems**. The goop is **semi-sentient** (feeds the "goo is alive" pillar).
- **Remake brief (Muzzy, 2026-10-16):** "the remake should really keep everything, but I want it more optimized, and better overall … using all of the things we learned from updating the framework and BMUZ." Must keep: **the story, the goopiness, the controls, and the menu that is part of the game** (the console is the main menu; pulling down the periscope drops you into play). Must improve: **the goopiness** ("the intent of the system I created was good … research and come up with something better") and **the tutorial** (to be readdressed).

## 2. Experience targets  (MDA; gap 1 settled 2026-10-16: Muzzy wants all three, so each owns a time scale)
| Time scale | Target | In players' words | We'll know when… (watchable) | Seen? |
|---|---|---|---|---|
| Every second | Tactile goo delight | "The goop is so satisfying to squish and zap" | they zap just to watch it, and mention the goop unprompted | — |
| Every shift | Stress → mastery | "It's my crappy job and I'm weirdly good at it" | they start another shift without being asked; their shifts get cleaner over time | — |
| Across ranks | Dark-comedy discovery | "What IS this company? What did the intercom just say?" | they read the intercom and want the next rank to see what changes | — |
| Not this game | Panic twitch arcade | — | — | — |
**Tie-breaker:** when ideas clash, ask which time scale the change touches; that scale's feeling wins (e.g. a breakdown that makes zapping feel bad breaks the every-second delight).
**Key moments** (rough): the first time the console turns into the tank (periscope pull) · a big same-colour merge popping and sealing a crack · a breakdown mid-shift that you fix just in time · a rank-up that changes your job (a new rule with a story reason).
**Watch-outs:** the breakdowns punishing your best moves (v1: laser drains on pop, controls heat on spin, lights dim unless you fast-drop, so you get pushed to play badly) · pressure feeling like a plain countdown · repairs feeling like a tax · a tutorial that blocks instead of teaching at the moment of action.

## 3. Pillars  (draft, from the remake brief)
- **The job is the menu.** No separate title screen game: the console *is* the game's home, and every menu is a piece of equipment.
- **The goo is alive.** Goop always looks and moves like living goo, and that never changes a rule. Rules are decided by the grid; the goo only shows them.
- **Spin the world, not the piece.** The piece always falls down the middle and the tank turns under it, so one thumb can play.
- **Every difficulty has a story reason.** Nothing gets harder "just because": the employer's policy, a broken machine or the Veteran explains it.

## 4. How it plays  (v1 as it shipped; /define confirms or tunes)
- **Core loop:** spin the tank → drop the piece → merge same colours → wait for goop to fill → pop it below the pressure line → seal colour-matched cracks → finish the shift → rank up at the console.
- **Shift loop — redesign (Muzzy, 2026-10-17, F04):** "pressure and cracks make sense" — the tank fails because of cracks, not a timer.
  - **Pressure** rises slowly over time; the pop line rises with it (more goop you can zap). **Zapping goop lowers pressure** (goop is material in the tank; removing it vents — v1's refund maths). **Each seal vents 1 s of rise** (`cracks.sealRefundMs` 1000, was 3000 — F27, 2026-10-18: low by default so pressure keeps climbing; an upgrade raises it via `sealVentMult`). Caps at 100%.
  - **Cracks** form in empty cells below the pressure line, **faster the higher the pressure**; at 100% they come at a rate nobody can keep up with, so the shift ends.
    - **Hockey-stick crack curve (Muzzy, F27, 2026-10-18: "hockey stick style … but still always rising slightly"):** the crack *rate* follows pressure³ (`cracks.curve` 3) from 1 every 6 s at 0% to 1 every 1.33 s at 100% — nearly flat early, steep in the last quarter. Maths: `research/balance-arc.md`.
      | Pressure | 0% | 25% | 50% | 75% | 90% | 100% |
      |---|---|---|---|---|---|---|
      | Time between cracks | 6.0 s | 5.7 s | 4.2 s | 2.4 s | 1.7 s | 1.33 s |
      | Cracks a minute | 10 | 10.5 | 14 | 25 | 36 | 45 |
    - **Crack hill (Muzzy, 2026-10-19, F27 — the default, `cracks.band` "hill"):** "the 50% is just a biased row, but things can spawn above it, but never above the pressure line." In each column the most likely crack row is **halfway from that column's goop (or the floor) to the pressure line**; cracks thin out above and below it, anywhere up to the line. **Cracks follow your building:** an empty column borrows height from stacks up to 4 columns away (fading). **High cracks drain less, unseen:** a crack formed more than 75% of the way up drains at half (later, repair-bot upgrades handle them). Why: the halfway band made cracks guide players to build up ("it was guiding me to build higher"), but its hard ceiling drew a visible band with nothing above it; and before the band, cracks sat so low in empty columns that drop-wait-pop met the quota with no reason to build. Numbers: `content/tuning/shift.notes.md`.
    - **Crack band (Muzzy, 2026-10-18, F27 — replaced by the hill, kept as a setting):** cracks only form from the floor up to **halfway between the top of the goop and the pressure line** (rounded down; goop at or above the line → up to the line). E.g. top goop 12, line 16 → cracks up to row 14. **Default: per column** (`cracks.band` "halfwayPerColumn" — each column uses its own goop top); "halfway" (whole tank) and "none" stay as settings. Why: the bots found 3 in 4 cracks formed in mid-air, out of reach.
  - **Tank integrity** meter: every open crack drains **0.05% a second** (`integrity.drainPerCrackPerSec` 0.0005 — lowered twice on 2026-10-18 and halved again 2026-10-19 with the higher cracks; Muzzy: "I want drain to be lower so players have more time to reach the cracks up high"). **Sealing a crack gives 2% back** (= 40 crack-seconds, so sealing always pays; capped at full, nothing during a rupture). Fallback if pacing stays wrong = "X of 10 cracks open → rupture".
  - **Rupture** (integrity 0, or a piece has no room to spawn): pressure drains fast; pieces keep coming; you zap what you can before it hits 0 (the pop line sinks with it) → shift over. Leftover goop costs points. **Seals during the rupture still count** toward the quota and the score (Muzzy: "the day isn't over until the pressure drops to 0 after a rupture") — they just don't vent or patch the tank.
  - **Success = the quota** (seal X cracks). A "Quota met" banner, then play on to the rupture; each crack sealed after it = bonus. **Score = how well you did** (big colonies, little left behind, fast-drop multipliers).
  - Upgrades this opens: slower depressurising (more time at the end), tougher tank (more cracks before rupture), repair bots (Ideas).
- **Wall kick** (a rotation blocked by goop): a Settings toggle to test both — **Rotate vat** (the tank turns a column, the piece stays centred) or **Shunt piece** (v1: the piece slides over). **No hard drop** (touch or keys), as v1.
- **Controls (Muzzy, 2026-10-17): one set, same timing on every input, no duplicates.**
  | Action | Touch | Left hand | Right hand |
  |---|---|---|---|
  | Move | drag sideways | A / D | ← / → |
  | Rotate ccw / cw | tap left / right half | Q / E | Right Ctrl / Numpad 0 |
  | Fast drop | drag down | S | ↓ |
  | Swap (from rank 3) | hold 1.5 s | hold R 1.5 s | hold Right Shift 1.5 s |
  | Console | swipe up | W | ↑ |
  Swap is **off until rank 3** (F59): before that, holding does nothing — no charging bar, no swap, no "nope".
- **Swap = trade with the next piece (Muzzy, 2026-10-19, F59: the held piece is "basically just the 'next piece' now"):** holding swap trades the falling piece with the NEXT one: the next piece comes in where the falling one was (no room there: refused, as before) and the falling piece becomes the next one, so swapping again trades them back. There is no held piece any more, and nothing is held at the start of a shift. Still the 1.5 s hold (`tank.holdToSwapMs`). Lesson shifts keep it off.
- **What each rank unlocks (Muzzy, 2026-10-19, F59)** — `content/tuning/progression.json` → `unlocks` (machines: `breakdowns.json` → `unlockRank`):
  | Rank | Unlocks |
  |---|---|
  | 1 | the **next-piece window**: top centre, over where the goop drops in |
  | 2 | the visor (can break) |
  | 3 | **swap** (trade the falling piece with the next one) |
  | 4 | the laser (can break) |
  | 5 | **upgrading**: the console's Upgrades button opens (scraps bank from rank 1; before rank 5 the button is grey with the count). Alpha has no upgrades yet — it says the first ones arrive in the next update |
  | 6 | the controls (can break) |
  The end report's rank-up line names what the new rank unlocked ("Rank up! 3 · New: swap"). The first shift after each tank unlock starts with a one-line lesson that pauses it (window, then swap — one per shift start); upgrading's lesson is at the console: its line on the monitor, the Upgrades button outlined. Once per device each; Settings → Replay lessons plays them again.
- Full v1 rules and systems: `research/v1-review.md` §1–2 and `research/v1/PRD.md`.

## 5. Systems
Carried over from v1 (all kept): ranks 0–50 · 20 upgrades + active abilities · three breakdowns (laser, lights, controls) with console repair puzzles · colour and piece unlocks by rank · the garbled intercom · Operator Journal · save.
- **Breakdowns (Muzzy, 2026-10-18, F06):** three machines, v1's meters, softer effects, simpler repairs. The tank SLOWS (25%) while you're at the console mid-shift; the pause menu (gear) fully pauses. At the console nothing moves toward breaking (Muzzy, 2026-10-18: "something could break while i'm fixing something and that's not a good feeling"): no visor fade, no heat, no drain, repair cooldowns stand still; cooling and refills keep going.
  | Machine | Meter (v1) | Broken | Repair at the console | Unlock |
  |---|---|---|---|---|
  | Laser | drains per zapped cell, refills per landed piece | two taps to zap (prime, then pop) | all 4 sliders light up, each randomly wanting left or right → flick each there | rank 4 |
  | Visor (was "lights") | holds for a grace, fades unless you fast-drop | the periscope view glitches — nothing until the meter runs out, then it builds up over `rampMs` (4 s, visor-fx.json) and stays at full until repaired (Muzzy 2026-10-18: only the visor ramps — "visibility is sooo key"; the laser and controls switch straight to their broken effect) | top light → slide up → 3 button flashes in order (never the same twice running) → bottom light → slide down | rank 2 |
  | Controls | heat per tank turn, cools when idle | held spin at half speed; single presses/swipes normal | turn the dial to the blinking corner (locks by itself), 4 times; each corner random, never the one the dial is on (an earlier one can come back) | rank 6 |
  Every repair is about 4 clicks (Muzzy, 2026-10-18); the counts are `repairSliders` / `repairCorners` in `content/tuning/breakdowns.json`.
  Muzzy chose v1's meters knowing they respond to your own moves; the softer effects keep play going. Cooldown after a repair as v1: max(8, 20 − (rank − unlock rank)) s.
  Built (F23): several machines can be broken at once; a rupture freezes the meters (repairs still work); a primed group does not refill (v1 restarted its fill); during a cooldown a meter stays a little (0.05) above its break point, so it can't break the instant the cooldown ends. Numbers: `content/tuning/breakdowns.json`.
- **Tutorial — "your first day" (F12, Muzzy 2026-10-19):** v1 style, fully scripted: a staged rank-0 day where every step is set up for you and you can't fail, ending in free play → a real rupture → clock out → rank 1. Plain how-to-play in alpha (the intercom voice joins in beta). Taught on PC first (keys + mouse wording; phone wording after F10). 15 steps in 6 phases (clock in · moving goop · pressure and zapping · cracks · building up · the rest of the day), plus a 4-step lesson the first time each machine breaks. Step list, runner check-list and open questions: `research/tutorial.md`.
- **Story:** `design/story.md`: the Employer (intercom, always "policy"), the Veteran (radio hijacks, smuggled upgrades, a brain in a jar), fines, rank titles, beats per rank band, the takeover at 50. Designed in v1 but never built; the remake builds it.
- **Progression:** `design/progression.md`: ranks and XP, scraps, colour schedule, starting junk, 20 upgrades in 4 bands, active abilities, the rank philosophy.
- **Upgrades (F22):** `design/upgrades-map.md`: every v1 upgrade and active ability, what v1 really did, what the new loop changes (Pressure Control and Slow Cracks are obsolete as written; Auto-Popper and Sealing Bonus need rethinking) and a proposed new version of each. Upgrades go in after the game mostly works; the engine is already built to take them (passives = tuning multipliers, actives = charge-and-fire abilities, features = screen flags; TDD §2c).

## 6. Look & sound
Retro corporate console (periscope, sliders, dials, buttons) over a dark tank of bright, wet, living goop. The intercom is mostly static, with key words coming through in green. v1 audio was placeholder synth beeps; the remake uses the framework audio module. Goo look directions: `research/goo-feel.md` §4.
- **Goo (F02, 2026-10-17): L4 Jelly.** Each same-colour group is one glossy, translucent soft body that springs back to its grid shape and jiggles as one; the piece glides down smoothly (no per-cell lurch). The goo follows the grid (F02b = A): it's the costume, never the rules. Muzzy's values: `research/goo-lab/picks.json` (sketch: `research/sketches/lab-L4-jelly.html`).
- **Art (Muzzy):** use his console art in `art/` (background, title, buttons up/down, dial, lights, slider, periscope, rank meter, end-game screen). Kit Neon only for small bits with no art.
- **Zap (open):** the laser should explode/harden the goo, not pop it (Muzzy, 2026-10-17). To design later.
- **HUD (F26, Muzzy's mock-up 2026-10-18):** everything sits where the eyes are, around the tank. One top row: score (top left) · the next-piece window (from rank 1, centred over the tank's top edge where the goop drops in — F59) · Console button. The tank goes nearly edge to edge, down to a solid panel under it (~12% of a phone's height): LASER · CONTROLS · VISOR bars with big names above (only unlocked machines; one centred, two or three evenly spaced), then the INTEGRITY bar with its name inside (shorter since F59) with CRACKS n / total to its right, always there. Every bar reads full = good (controls = room before it overheats); below 30% a bar turns red and pulses, a broken machine flashes. No pressure meter: a thin white line rises from the pressure line to a white "NN% PSI" readout on top of everything (Settings: slide it along the line, or mirror it: text first, line down to it). Faint chevrons under the falling piece down to its landing shadow light up in a wave running downward, like landing lights, faster on fast drop; passed ones vanish. Messages are plain glowing words just above the goop (and above the readout). (Portrait only: the old phone-on-its-side layout, the panel as a column beside the tank, is no longer a target.) Numbers: `content/tuning/hud.json`.

## 7. Scope
Decided 2026-10-19 (F07; detail + every item: `research/release-scope.md`; build order: ROADMAP M4–M6). Starting rule kept: everything in v1 is a must — by 1.0.
- **Alpha — the playable game** (Muzzy: "alpha is playable game"): Muzzy + a few friends, from a private link (v1 stays live). Everything built so far + gesture fixes + "your first day" how-to-play (`research/tutorial.md`) + first-breakdown lessons + placeholder sound + an installable app with a version number. The Dev Kit stays on so friends can send bug files. **No upgrades, no story** in alpha. Readable cracks = should.
- **Beta — the whole job:** the story ("story is beta" — rank titles, the Employer, the Veteran, fines, ranks 40–50, the takeover), upgrades + active abilities, and **all three v1 rank twists, kept** (multi-colour pieces at 20, expanding cracks at 30, wild goop at 40 — each with a story reason). Numbers can be rough.
- **1.0 — polished:** balanced 0–50, final sound + music, works offline, credits, replaces v1 at the old address; Dev Kit off.
- Claude's calls (change any): sound placeholders are an alpha must (the goo can't be judged silent); the tutorial is in alpha as plain how-to-play (the story voice joins in beta); remake versions stay 0.x until it replaces v1 (F37 settles).

## 8. Product
- **Release path:** web (GitHub Pages, installable PWA like v1) first.   **Business:** none yet.
- **Success looks like (rough):** it plays smoothly on a phone, people come back for "one more shift", and the remake proves the framework works for a real-time game.

## 9. Open questions
They live in ROADMAP **M0 — Design decided** (F01–F12, ❓ items), in the order they're answered; each answer is written into the section above it belongs to.
**Already settled (no questions):** the tank (cylinder, spin the world), the controls (v1 PRD §Controls), pieces + lock feel, merge → fill → zap, console-as-menu + periscope, the story arc (`design/story.md`), progression + upgrades as designed (`design/progression.md`, numbers sim-checked later), web + PWA, colour schedule (v1 code and PRD agree: Purple@10, White@30, Black@50).
