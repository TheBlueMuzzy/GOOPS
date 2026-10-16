# Goops — Game Design Document (GDD)
> What the game is, how it plays, how it should feel. Aim for ~150 lines — detail lives in `design/` docs linked from here.
> Current phase: Discover   ·   Engineering plan: TDD.md (made at /define)   ·   Milestones, ideas, known issues: ROADMAP.md (made at /define)
> **Remake** of Goops v1 (branch `archive/goops-v1`, live 1.1.13). v1 review: `research/v1-review.md` · goo research: `research/goo-feel.md` · discovery notes: `research/discovery.md` · v1 design docs: `research/v1/`

## 1. Pitch
- **One line (rough):** A falling-goop puzzle game where you spin a cylindrical tank under the falling piece, merge and pop living goop to seal cracks before the pressure blows, and keep a crumbling console running for a faceless employer, one rank at a time.
- **Platform:** web, phone first (portrait, one thumb), desktop too   **Audience:** general (not made for kids). Short-session puzzle players who like mastery and dark office comedy.
- **References:** Tetris (lock delay, ghost, kicks: the movement feel) · Puyo Puyo (same-colour merge and pop, readable goo) · World of Goo / LocoRoco (goo that feels alive) · Papers, Please (a mundane job under a faceless employer) · Keep Talking and Nobody Explodes (hands-on console repairs). Deeper breakdown: `research/discovery.md`.
- **Remake brief (Muzzy, 2026-10-16):** "the remake should really keep everything, but I want it more optimized, and better overall … using all of the things we learned from updating the framework and BMUZ." Must keep: **the story, the goopiness, the controls, and the menu that is part of the game** (the console is the main menu; pulling down the periscope drops you into play). Must improve: **the goopiness** ("the intent of the system I created was good … research and come up with something better") and **the tutorial** (to be readdressed).

## 2. Experience targets  (MDA, rough; /define locks them)
| | Target | In players' words | We'll know when… (watchable) | Seen? |
|---|---|---|---|---|
| Primary | Mundane stress → mastery | "It's my crappy job and I'm weirdly good at it" | they start another shift without being asked; their shifts get cleaner over time | — |
| Secondary | Tactile delight | "The goop is so satisfying to squish and pop" | they pop just to watch it, and mention the goop unprompted | — |
| Secondary | Dark-comedy discovery | "What is this company?! What did the intercom just say?" | they read the intercom and want the next rank to see what changes | — |
| Not this game | Panic twitch arcade | — | — | — |
**Key moments** (rough): the first time the console turns into the tank (periscope pull) · a big same-colour merge popping and sealing a crack · a breakdown mid-shift that you fix just in time · a rank-up that changes your job (a new rule with a story reason).
**Watch-outs:** the breakdowns punishing your best moves (v1: laser drains on pop, controls heat on spin, lights dim unless you fast-drop, so you get pushed to play badly) · pressure feeling like a plain countdown · repairs feeling like a tax · a tutorial that blocks instead of teaching at the moment of action.

## 3. Pillars  (draft, from the remake brief)
- **The job is the menu.** No separate title screen game: the console *is* the game's home, and every menu is a piece of equipment.
- **The goo is alive.** Goop always looks and moves like living goo, and that never changes a rule. Rules are decided by the grid; the goo only shows them.
- **Spin the world, not the piece.** The piece always falls down the middle and the tank turns under it, so one thumb can play.
- **Every difficulty has a story reason.** Nothing gets harder "just because": the employer's policy, a broken machine or the Veteran explains it.

## 4. How it plays  (v1 as it shipped; /define confirms or tunes)
- **Core loop:** spin the tank → drop the piece → merge same colours → wait for goop to fill → pop it below the pressure line → seal colour-matched cracks → finish the shift → rank up at the console.
- Full v1 rules and systems: `research/v1-review.md` §1–2 and `research/v1/PRD.md`.

## 5. Systems
Carried over from v1 (all kept): ranks 0–50 · 20 upgrades + active abilities · three breakdowns (laser, lights, controls) with console repair puzzles · colour and piece unlocks by rank · the garbled intercom · Operator Journal · save. Story (the Employer, the Veteran, fines, rank titles, the reveal, the takeover at rank 50) was **designed but never built in v1**; the remake builds it.

## 6. Look & sound
Retro corporate console (periscope, sliders, dials, buttons) over a dark tank of bright, wet, living goop. The intercom is mostly static, with key words coming through in green. v1 audio was placeholder synth beeps; the remake uses the framework audio module. Goo look directions: `research/goo-feel.md` §4.

## 7. Scope
*(Filled at /define. Starting rule: everything in v1 is a must; the story is new must work.)*

## 8. Product
- **Release path:** web (GitHub Pages, installable PWA like v1) first.   **Business:** none yet.
- **Success looks like (rough):** it plays smoothly on a phone, people come back for "one more shift", and the remake proves the framework works for a real-time game.

## 9. Open questions  (each becomes a ❓ in ROADMAP at /define)
1. **The goo technique:** A shader blobs + springs (recommended) / B v1 soft-body, but visual-only / C Puyo-style tiles + bridges / D A plus strands. A phone sketch should decide it (`research/goo-feel.md` §5).
2. **How a crack gets sealed:** v1 changed it three times (cover + pop → auto on landing → plug on land, seal on pop). What does a wrong-colour cover do?
3. **What pressure is:** a timer (v1) or how full the tank is (v1's own "SlowMode" note)?
4. **Breakdowns:** keep all three, but tune them so each creates a choice instead of punishing a core action. Should all three ever be active at once?
5. **Does the game pause at the console during a repair?**
6. **Progression:** XP from score, or cracks sealed? How long is the climb to rank 50 (v1: ~481,000 XP)?
7. **Shift length:** a snack (75 s) or a sit-down (up to 115 s with upgrades)?
8. **Story as mechanics:** the Veteran, fines, rank titles, ranks 40–50, and what "taking over" at rank 50 means.
9. **Tutorial:** how the new one teaches. Built late, as data, on the framework's teaching tools (callouts, tips) and the intercom.
10. **Phone gestures:** swipe up (back to the console) vs hold (swap) vs drag (spin / fast drop).
11. **Colour schedule:** which colour unlocks at which rank. v1's docs and code disagree.
