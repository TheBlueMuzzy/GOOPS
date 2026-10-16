# Goops v1 — Review for the Remake

*Written 2026-10-16 during /discover. Sources: v1 docs in `.planning/research/v1/`, GSD history in `.planning/archive/gsd/`, the v1 code (branch `archive/goops-v1`, same as the current folder), 621 commits of git history, and the live build (v1.1.13.338) at https://thebluemuzzy.github.io/GOOPS/. Where docs and code disagree, the code wins.*

Screenshots of the live game (phone size, 390x844) are in `.planning/research/v1/shots/` (paths listed at the end).

---

## 1. What Goops v1 is

Goops is a falling-block puzzle game played inside a **cylindrical tank** you look into through a periscope. Pieces of coloured goop (4-, 5- and 6-cell shapes) always fall down the middle of the screen; you **spin the tank underneath them** to choose where they land. Same-colour goop that touches joins into one blob, slowly "fills", and can then be **tapped to pop**. Cracks appear in the tank wall at the rising **pressure line**; cover a crack with goop of its colour and pop it to seal the crack. Seal enough cracks before pressure hits 100% and you pass the shift. Between and during shifts you are at a retro **control console** where equipment breaks down (laser, lights, controls) and must be fixed with small hands-on repair puzzles while the tank keeps filling. The fiction is a corporate-dystopia job: you are a low-level tank technician climbing 50 ranks (`PRD.md` §Overview, §Narrative Arc).

**Core loop**
- **Moment to moment (seconds):** spin the tank, rotate and fast-drop the piece, merge colours, tap ripe blobs below the pressure line, aim colours at cracks, watch the three meters (laser charge, controls heat, light brightness).
- **Per run (one 75-second "shift"):** pressure is a timer (`tankPressure = 1 - time/maxTime`, `PRD.md` §Pressure). Popping buys time back. Pieces grow from 4 to 5 to 6 cells in thirds of the shift. Win = seal `colours + rank` cracks; then keep going for bonus until pressure tops out. End screen gives score, grade A/B/C/FAILURE, leftover-goop penalty (`components/EndGameScreen.tsx`).
- **Meta (across runs):** score becomes XP 1:1 → ranks 0–50 (`utils/progression.ts`), 1 "scrap" per rank buys one level of 20 upgrades in 4 bands of 10 ranks; new colours, starting junk, multi-colour pieces, growing cracks and wild goop unlock by rank (`constants.ts`, `utils/gameLogic.ts:27`).

---

## 2. Every system and its real status

Line counts are TypeScript in the v1 code (rough, from `wc -l`). Total game code ~20,000 lines + 2,300 lines of tests + **15,000 lines of throwaway soft-body prototypes** (`prototypes/`).

| System | What it does | Status | Rough size |
|---|---|---|---|
| Tank grid + cylinder wrap | 30 columns around, 12 visible, 21 visible rows + 3 hidden spawn rows (`constants.ts:4-8`) | Shipped & working | part of engine |
| Falling pieces | 54 shapes (Tetra/Penta/Hexa, normal + "corrupted" corner-touching variants), 50% mirroring, size grows with shift time (`core/GameEngine.ts:717-840`) | Shipped & working | engine ~3,100 total (GameEngine 1,565, actions 583, gameLogic 737) |
| Tetris-style feel | 500ms lock delay with move-reset, 10-reset cap, wall kicks, ghost piece (`INVESTIGATIONS.md` §Tetris Movement) | Shipped & working (I-piece bug fixed 2026-03-01, verification never recorded) | in engine |
| Hold / swap + next preview | Hold 1.5s to swap; previews unlocked by upgrades | Shipped & working | ~130 (`PiecePreview.tsx`) |
| Group merge, sticky gravity, loose goop falling | Same-colour 4-way groups; unsupported groups fall | Shipped & working | in engine |
| Fill-then-pop ("solidify") | Fill takes `size × 375ms`; pop only below pressure line | Shipped & working | in engine + renderer |
| Pressure = timer | 75s shift (up to 115s with upgrades); popping refunds time | Shipped & working | in engine |
| Cracks / goals | Spawn at pressure line, max 8, one per colour; two-step seal (plug on land, seal on pop) added late (`Tutorial3.md` §3) | Shipped, rough (seal rules changed 3 times, see §8) | CrackManager 196 + GoalManager 292 |
| Growing cracks (rank 30+) | Cracks branch over time, 8 directions | Shipped, untested by real players | in CrackManager |
| Win burst | All colours spawn cracks when you win early | Shipped | in GoalManager |
| Scoring + grade | Height, off-screen, streak, adjacency bonuses; 5-category grade | Shipped but rough — two grade categories measure the same thing (leftover goop ×2 and ×3, `PRD.md` §Grade) | ~350 |
| Complications (Laser / Lights / Controls) | Meters fill from your own actions; at threshold the system breaks (`complicationConfig.ts`) | Shipped & working; cooldowns rank-scaled | ComplicationManager 178 + config 82 |
| Repair mini-games | Laser = 4 sliders; Lights = slider + Simon-says; Controls = dial alignment (`hooks/use*Minigame.ts`) | Shipped & working | ~2,500 incl. console art (`Art.tsx` 607) |
| Console screen | Retro panel, periscope pull-down to start, rank bar | Shipped & working | ConsoleView 321 + Art 607 |
| Ranks / XP | `3500 + rank×250` per rank, XP floor so no zero runs | Shipped & working | progression 185 |
| 20 upgrades + active abilities | Passive / active / feature; 4 actives charged by time + crack seals (`constants.ts:49-340`) | Shipped; all 20 are wired into code (checked by grep) but **never balance-tested past ~rank 10** | ~1,500 (UpgradePanel 411) |
| Colours by rank | 4 colours, Purple@10, White@30, Black@50 (`utils/gameLogic.ts:27`) — docs disagree (PROJECT.md says Orange@10, Purple@20) | Shipped | tiny |
| Multi-colour pieces (rank 20+), wild goop (rank 40+) | 25% split pieces; 15% wild seals any colour (`GameEngine.ts:812,834`) | Shipped, untested | in engine |
| Soft-body goop rendering | 12-vertex springy blobs, SVG "goo" blur filter, tendrils, droplets, 43 tunable values (`PRD.md` §Soft-Body) | Shipped but rough — locked-goop, pop and polish phases 28–30 **deferred** (`ROADMAP.md`); known "almost hole" fill glitch (`STATE.md` Known Issues) | ~2,300 live (`core/softBody/` + `useSoftBodyPhysics.ts`) + much of GameBoard 1,603 + 15,000 prototype |
| Mobile performance mode | 40fps cap, simpler visuals on phones (`hooks/useGameEngine.ts`) | Shipped & working | small |
| Touch + keyboard input | Drag = spin, tap halves = rotate, drag down = fast drop, swipe up = console | Shipped & working | useInputHandlers 610 |
| Tutorial (rank 0 training) | 13 scripted steps with "static-garbled" intercom text | **Half-built** — third rewrite, UAT never finished; D3 step disabled (`STATE.md` §UAT Round 1) | ~3,600 (useTrainingFlow 1,132 + hooks/tutorial 895 + data 514 + overlay/intercom ~650) |
| Operator Journal (? button) | Pages unlock as you learn | Built (basic) | ~400 |
| Rank-gated UI, complication intros, upgrade onboarding, returning-player logic | Phases 34–38 | **Only planned** (panels greyed until unlocked is the only piece built) | 0 |
| Story: the Veteran, fines, rank titles, brain-in-a-jar reveal, takeover at 50 | `PRD.md` §Narrative Arc | **Only planned** — no code (grep finds nothing) | 0 |
| Rank 40–50 content | Wild@40 and Black@50 exist; no upgrades or band beyond 39 | Only planned | — |
| Audio | Web-Audio synth: pop beeps, optional drone (`utils/audio.ts`) | Placeholder | 251 |
| Save | localStorage, v2→v3 migration (`utils/storage.ts`) | Shipped & working | 108 |
| Dev tools | Backtick debug panel (43 physics sliders), piece picker, "RANK SELECT" visible in the live build | Shipped (dev only, but leaks into live UI) | — |

---

## 3. Fiction, theme, art and feel direction

- **Fiction:** "Modern indentured servitude disguised as career progression" (`PRD.md` §Narrative Arc). The Employer talks only through a crackly intercom — static eats most words, but key terms come through in green (this doubles as the tutorial keyword highlight; see screenshot 01). A Veteran hijacks the radio to slip you contraband upgrades and is eventually revealed to be a brain in a jar. Every new difficulty must have a story reason ("the employer made your job harder"). Rule: the employer is never openly evil — always "policy".
- **Tone ladder:** mundane corporate → unsettling → conspiratorial → dark → revelation → ambiguous takeover at rank 50.
- **Console look:** "Homer Simpson at the nuclear plant" — chunky retro industrial panel, blinking orange lights, CRT end-of-shift monitor that drops from the ceiling, a big goggle-periscope you physically pull down (`PRD.md` §Console Screen; screenshot 04). Built in flat vector SVG: teal/slate panels, orange knobs, pink slider tracks, hand-lettered "GOOPS" logo.
- **Goop feel words** (`SOFTBODY-VISION.md` §The Goop Feel): "stiff gel / jello", "blubber — thick, viscous", "goopy, blobby, curvy, never sharp corners", "almost alive", "gummy". Same-colour blobs should *reach out* to each other with tendrils and share one skin while keeping separate cores — "no jump cut like Suika". The doc calls this "the ultimate polish… it will sell the game."
- **In practice (screenshot 05):** bright flat-colour rounded blobs on a near-black grid, a green "water" band for the pressure zone, minimal HUD. The goop reads as soft rounded squares more than living jelly at phone size.

---

## 4. MDA read

**Aesthetic the design aimed for** (from `PRD.md` Core Fantasy, `DESIGN_VISION.md`): *mundane stress* — "It's mundane. It's stressful. The tank keeps filling. The equipment keeps breaking. You keep playing." Plus *mastery* (deeper play beats intuitive play), *tactile delight* (squishy goop), and *dark-comedy narrative* climbing a rigged ladder.

**What the rules actually make players do:**
1. **Build tall, then wait.** Pop only works below the pressure line, bigger pops refund more time, height bonus rewards high pops → the dominant pattern is "scaffold, wait for the water to rise, pop big" (`DESIGN_VISION.md` §1 admits this).
2. **The three complications each punish a core verb.** Laser drains when you *pop* (the way you progress). Controls heats when you *spin the tank* (the way you aim). Lights dim unless you *fast-drop* (`complicationConfig.ts` LIGHTS: recovers only while fast dropping). So the player is pushed to pop less, spin less, and slam pieces down fast — the opposite of careful puzzle placement.
3. **Leaving the tank costs time.** The game doesn't pause at the console, so a repair is a tax, not a puzzle you enjoy.
4. **The meta grind is long.** ~481,000 XP to rank 50 with ~75–115s shifts; required cracks grow with rank (`colours + rank`, so ~36+ at rank 30) — each rank asks for more in the same time.

**Where intent and behaviour disagree:**
- *Intent: mastery and calm skill* ("CONTROLS is a hidden skill check for calm players"). *Behaviour:* Lights forces frantic fast-dropping while Controls punishes frantic spinning — the two complications give contradictory instructions about pace.
- *Intent: tactile, satisfying goop.* *Behaviour:* the satisfying action (big pop) is the one the Laser meter punishes, and the one that refunds time — the joy and the penalty sit on the same button.
- *Intent: pressure = a tank filling with goop.* *Behaviour:* pressure is just a countdown clock; how much goop is in the tank doesn't change it. The "SlowMode" idea in `PROJECT.md` (pressure from goop volume, progression = cracks sealed, drop XP) was the designer noticing this.
- *Intent: story-driven ladder.* *Behaviour:* none of the story shipped, so ranks are just numbers and upgrades are a shop list.

---

## 5. Where the time went (git history)

Arc: started 2026-01-09 as a Google AI Studio project ("Celltris" → "Gooptris" → "Goops", `metadata.json` still says *"Goopers: Fix it Fix It Fix It!"*), moved to Claude + GSD on 2026-01-18, intense build to 2026-02-23, one bug fix 2026-03-01, then idle. ~240 of 621 commits are docs/plan/state updates.

| Area | Commits (approx.) | Calendar | Why it was hard | Lesson for the remake |
|---|---|---|---|---|
| **Tutorial (3 versions)** | ~90 (39 on plan 33-04 alone), 11+ UAT rounds on v2 | Feb 8 – Feb 23, unfinished | Written as code before the design was settled: steps went 17 → 14 → 19 → 16 → 15 → 13. One 1,400-line hook with 20+ timers/refs and pause calls in 10+ places (`STATE.md` §Tutorial v3). Each step needed the engine to behave specially ("training mode" switches inside GameEngine). The tutorial also exposed real rule bugs (crack sealing). | Settle the rules first; design onboarding on paper/in a sketch; build a small step-runner (data file of steps) from day 1; keep "training mode" as level setup data, not engine special cases. |
| **Soft-body goop** | ~85 + 15,000 lines of prototypes | Jan 30 – Feb 8 | 9 standalone prototypes, then porting into a grid game. Three "sources of truth" (engine grid, physics target, physics position) caused flicker; the fix (phase 27.1) made **physics own the falling piece** after one failed attempt (archived in `phases/27.1-.../failed-attempt-reference/`). Locked-goop, pop and polish phases deferred. | Decide the look in a cheap sketch, then pick the *simplest* technique that sells it. The visual layer must only *follow* the game rules, never drive them (the vision doc said so; the build broke that rule). |
| **I-piece locking bug** | ~3 commits but weeks of "pieces feel sticky" | fixed Mar 1 | Direct consequence of physics owning the piece: physics reported the piece's row from its top cell, which is wrong for shapes whose cells start above row 0 (all three I-pieces) (`FIX-I-PIECE-LOCKING.md`). Collision checks went lenient, lock timer kept resetting. | One coordinate system and one source of truth for piece position; tests for every shape at every rotation. |
| **Coordinate system** | ~15 + a 170-line transform util with 244 lines of tests | Jan 10 & Feb 3–4 | v1 first drew the tank with a curved "cylindrical projection", then had to flatten it for soft-body (phase 26.1), then re-add seam wrapping (duplicate blobs merged by the goo filter). Separate bugs from hard-coded sizes (pressure bug: `maxTime={60000}` hard-coded, `INVESTIGATIONS.md`). | Decide flat vs curved up front; one "grid ↔ screen" helper; no hard-coded sizes or times in components. |
| **Complications + minigames** | ~80 | Jan 18–20 | Lots of small interaction fixes (tap vs drag on the dial, slider jumps, corner mapping). Lights was redesigned twice (random → probability on lock → brightness you recharge by fast-dropping). | Mini-games are fiddly touch UI — budget for it, use one shared drag/tap component. |
| **Progression (ranks, 20 upgrades, actives)** | ~85 | Jan 23–25 (3 days) | Fast to build, never balanced: no sim, no playtests past early ranks. | Simulate the economy before building 20 upgrades (`/proto`). |
| **Refactor + rename** | ~38 refactor + ~42 rename (v1.1 and v1.4 milestones) | Jan 21, Jan 26–27 | Whole milestones spent shrinking files and renaming 50+ terms across 62 files because names and structure weren't fixed at the start. | Write the glossary first (v1's `GLOSSARY.md` is a ready-made start) and keep files small from day 1. |

---

## 6. Over-built for its value

- **20 upgrades + 4 active abilities + 3 equip slots** before the core shift was proven fun or balanced. Many are tiny percentage tweaks ("-6.25% laser drain") that a player can't feel.
- **54 piece shapes + corruption + mirroring + multi-colour + wild** — a lot of piece variety on top of a game whose core verbs are still being questioned. Corrupted pieces (that split on landing) are clever but add confusion.
- **Five-category grade** where two categories are the same measurement.
- **43 physics sliders** and 9 prototypes for a look that, at phone size, mostly reads as rounded squares.
- **Scoring layers** (height + off-screen + streak + adjacency + drop + leftover penalty + win bonus + XP floor) — hard for a player to read or care about.
- **Process overhead:** ~40% of commits are docs/state/plan updates; the tutorial alone went through 11 UAT rounds before being rewritten.

---

## 7. Keep vs rethink

**Strongest ideas worth keeping (design, not code)**
- **Spin the tank, not the piece.** The piece always falls in the centre and the world turns under it — a fresh twist on falling blocks, and it suits one-thumb phone play.
- **The cylinder.** Things are happening off-screen; off-screen crack arrows; you rotate to check. Good tension, easy to understand.
- **Rising pressure line that decides what you may pop.** Creates the scaffold-then-pop decision — a real strategic tension.
- **Colour-matched cracks as goals.** Gives every piece a purpose ("where does this red go?").
- **Fill-before-pop (ripening).** A small wait that makes merging decisions matter.
- **Garbled intercom with green keywords.** Teaches and tells story in the same breath; strong, cheap, distinctive.
- **The console + periscope fiction** and the physical repair puzzles — great identity and tactile charm.
- **Gooey, merging, "almost alive" goop** as the art pillar — keep the *feeling*, rethink the *technique*.
- **"Every new difficulty has a story reason"** design rule.

**Candidates to cut or rethink**
- **Complications that punish the core verbs** — rethink so each breakdown creates an interesting choice instead of telling you to stop playing well.
- **Leaving the tank to repair while time runs** — consider repairs inside the tank view, or pausing pressure, or making repair a deliberate trade.
- **Pressure as a pure timer** — explore pressure driven by goop in the tank (v1's own "SlowMode" note).
- **Score/XP/grade stack** — consider progression by cracks sealed, one clear number.
- **The 20-upgrade shop** — far fewer, felt upgrades, ideally ones that change *how* you play.
- **Corrupted, multi-colour and wild pieces** — keep at most one as a later twist.
- **Full Verlet soft-body** — test cheaper ways (goo filter on simple shapes, squash-and-stretch tweens) first.

---

## 8. Open design questions v1 never settled

1. **How exactly does a crack get sealed?** It flipped: cover + pop (`PRD.md`), "sealing IS automatic on landing" (`Tutorial.md` audit 2026-02-15), then plug-on-land + seal-on-pop (`Tutorial3.md` 2026-02-19). What should a wrong-colour cover do?
2. **What is pressure?** Time, or how full the tank is? (`PROJECT.md` SlowMode.)
3. **What is progression?** XP from score, or cracks sealed?
4. **How do the three complications feel together**, and should they ever all be active at once? Exact meter values were an open question in `DESIGN_VISION.md` and Lights was redesigned twice.
5. **Should the game pause at the console?** v1 says no by design; never playtested at higher ranks.
6. **Ranks 40–50 content** and what "taking over the company" means at rank 50 (`PRD.md`: "Ambiguous").
7. **The Veteran, fines, rank titles** — written as story beats, never designed as mechanics.
8. **Mobile gesture conflicts** — swipe up (exit) vs hold (swap) vs drag (spin/fast drop) (`SYSTEM-INVENTORY.md` Open Questions).
9. **Offscreen cracks lesson** — the tutorial's D3 "discovery" step was disabled and never re-integrated.
10. **Colour schedule** — docs and code disagree about which colour unlocks when.
11. **Bonus crack scoring after a win** — "TBD formula".
12. **Session length** — 75s base vs the upgraded 115s; is a shift meant to be a snack or a sit-down?

---

## 9. Engineering lessons for the remake (cheaper if designed in from day 1)

1. **One source of truth for game state.** Rules live in a plain game model (grid, piece, cracks, pressure). Visuals only *read* it and animate toward it — physics never feeds positions back. (This one decision would have prevented the flicker work, the 27.1 rewrite and the I-piece bug.)
2. **One coordinate helper**, flat grid with wrap-around, settled before any art. Test every piece shape at every rotation against the floor, walls and the seam.
3. **All tuning numbers in `content/` JSON** (pressure speed, fill time, meter rates, piece odds, upgrade values) — v1 had them spread over `constants.ts`, `complicationConfig.ts`, and hard-coded props (the 60,000ms pressure bug).
4. **Tutorial = data.** A step list file (message, what spawns, what's allowed, what ends the step) run by a small, generic step-runner; level setups instead of engine "training mode" switches. Build it after the rules are frozen.
5. **Prove the look cheaply** before building a physics engine: a one-day sketch comparing goo-filter-on-simple-shapes vs squash/stretch vs full soft-body on a real phone.
6. **Simulate the economy** (ranks, upgrades, crack targets) with `/proto` before building upgrades.
7. **Phone-first layout.** In the live build the tank stops ~80% down the phone screen, leaving a dead band under it (screenshot 05); design the board to the 9:16 safe area from the start.
8. **Fixed names from day 1** — reuse v1's `GLOSSARY.md` vocabulary (goop, tank, crack, pressure, operator, scraps) so no rename milestone is needed.
9. **Pause/time control in one place** (v1 had pause/unpause in 10+ places). One game clock that the console, tutorial and repairs all ask to pause or slow.
10. **Small files and events from the start** (v1 spent a whole milestone splitting 1,000+ line files and replacing callback props with an event bus).
11. **Dev tools behind a flag** — v1's "RANK SELECT" and debug panel ship in the live build.
12. **Tests on rules, not just helpers** — crack sealing, pressure, lock delay and wrap-around are the rules that broke; each should have a test from day 1.

---

## Screenshots (live v1, 390x844)

All in `C:\Users\Muzzy\AppData\Local\Temp\claude\C--Users-Muzzy-Documents-dev-games\8c2e46d8-7b20-4a69-b931-3c57384eb5ae\scratchpad\v1-shots\` (temporary folder; copy into the repo if worth keeping):
- `01-first-load.png` — first launch, tutorial intercom with garbled text and green keywords over the console
- `02-console-rank0.png` — the console at rank 0
- `03-tutorial-tank.png` — inside the tank, tutorial step B1, ghost piece at the floor
- `04-console-rank12.png` — the console at rank 12: periscope, rank bar, laser sliders, controls dial, lights panel, upgrades button
- `05-gameplay-rank12.png` — a real shift at rank 12: soft blobs, starting junk, pressure band, off-screen crack arrow, dead space under the board
