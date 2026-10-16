# Goops — Game Design Document (GDD)
> What the game is, how it plays, how it should feel. Aim for ~150 lines — detail lives in `design/` docs linked from here.
> Current phase: Discover   ·   Engineering plan: TDD.md (made at /define)   ·   Milestones, ideas, known issues: ROADMAP.md (made at /define)
> **Remake** of Goops v1 (branch `archive/goops-v1`, live 1.1.13). v1 review: `research/v1-review.md` · goo research: `research/goo-feel.md` · discovery notes: `research/discovery.md` · v1 design docs: `research/v1/`

## 1. Pitch
- **One line (rough):** A falling-goop puzzle game where you spin a cylindrical tank under the falling piece, merge and pop living goop to seal cracks before the pressure blows, and keep a crumbling console running for a faceless employer, one rank at a time.
- **Platform:** web, phone first (portrait, one thumb), desktop too   **Audience:** general (not made for kids). Short-session puzzle players who like mastery and dark office comedy.
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
- Full v1 rules and systems: `research/v1-review.md` §1–2 and `research/v1/PRD.md`.

## 5. Systems
Carried over from v1 (all kept): ranks 0–50 · 20 upgrades + active abilities · three breakdowns (laser, lights, controls) with console repair puzzles · colour and piece unlocks by rank · the garbled intercom · Operator Journal · save.
- **Story:** `design/story.md`: the Employer (intercom, always "policy"), the Veteran (radio hijacks, smuggled upgrades, a brain in a jar), fines, rank titles, beats per rank band, the takeover at 50. Designed in v1 but never built; the remake builds it.
- **Progression:** `design/progression.md`: ranks and XP, scraps, colour schedule, starting junk, 20 upgrades in 4 bands, active abilities, the rank philosophy.

## 6. Look & sound
Retro corporate console (periscope, sliders, dials, buttons) over a dark tank of bright, wet, living goop. The intercom is mostly static, with key words coming through in green. v1 audio was placeholder synth beeps; the remake uses the framework audio module. Goo look directions: `research/goo-feel.md` §4.

## 7. Scope
*(Filled at /define. Starting rule: everything in v1 is a must; the story is new must work.)*

## 8. Product
- **Release path:** web (GitHub Pages, installable PWA like v1) first.   **Business:** none yet.
- **Success looks like (rough):** it plays smoothly on a phone, people come back for "one more shift", and the remake proves the framework works for a real-time game.

## 9. Gap walk  (/define walks these one at a time, in this order; answers go into the sections above)
**Already settled (no questions):** the tank (cylinder, spin the world), the controls (v1 PRD §Controls), pieces + lock feel, merge → fill → zap, console-as-menu + periscope, the story arc (`design/story.md`), progression + upgrades as designed (`design/progression.md`, numbers sim-checked later), web + PWA, colour schedule (v1 code and PRD agree: Purple@10, White@30, Black@50).

| # | Gap | State | Blocks |
|---|---|---|---|
| 1 | ~~Feel targets~~ ✅ all three, one per time scale (§2) | settled | everything (it's the judge for every other call) |
| 2 | **Goo technique**: A / B / C / D (`research/goo-feel.md`) | needs the sketch | the TDD's rendering plan |
| 3 | **Crack sealing**: zap goop covering a crack (settled); must the colour match? What does a wrong colour do? | open | core rules |
| 4 | **Pressure**: a timer (v1) or how full the tank is (v1's SlowMode note)? | open | core rules, shift length |
| 5 | **Shift length**: snack (75 s) or sit-down (up to 115 s)? | open | pacing, progression |
| 6 | **Breakdowns**: keep all three, tune so each is a choice not a punishment; pause or slow at the console? | open | complications, upgrades |
| 7 | **Scope + releases**: what the alpha must have vs beta / 1.0 (everything stays in, but in what order) | open | the roadmap |
| 8 | **Progression**: XP from score or from cracks sealed? How long is the climb to 50? | drafted (v1) | upgrades, sim |
| 9 | **Story in play**: how fines and rank titles show up, ranks 40–50 content, what the takeover at 50 means | open | rank content |
| 10 | **Phone gestures**: swipe up vs hold vs drag conflicts | open | input |
| 11 | **Look & sound**: keep the v1 console art and palette, or a refresh? Audio mood | open | art tasks |
| 12 | **Tutorial**: "your first day", taught at the moment of action (last: it teaches the settled rules) | open | onboarding |
