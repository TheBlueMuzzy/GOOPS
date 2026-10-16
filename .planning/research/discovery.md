# Goops remake — discovery notes (2026-10-16)

Inputs: `v1-review.md` (what v1 is, what's really built, where the time went) · `goo-feel.md` (goo techniques + directions) · v1 docs in `v1/` · screenshots in `v1/shots/`.

## The brief
A full remake, not a redesign. Keep every v1 feature and the fiction. Make it optimized (smooth on phones without a 40fps throttle) and better overall. Build it the BMUZ 2 way with the framework. Rethink the goo technique and the tutorial.

## References (MDA, short)
| Game | Players feel → do → because of which rule | Take | Avoid |
|---|---|---|---|
| Tetris | flow, mastery → fast confident placements → lock delay, ghost, kicks, preview | v1's movement feel (already matched) | — |
| Puyo Puyo | satisfaction, planning → build same-colour groups, set up chains → 4-to-pop + gravity | readable, squishy pops; merge "snap" | chain complexity that hides the goo |
| World of Goo / LocoRoco | delight → poke things to watch them wobble → cheap springs + soft skins, not full fluids | goo that reacts to everything | physics that decides outcomes |
| Papers, Please | dark comedy, mundane dread → follow rising rules from a faceless authority → each day adds a rule with a story reason | "every difficulty has a story reason"; story told through the job | — |
| Keep Talking and Nobody Explodes | frantic tactile fun → fiddle with physical panels under time pressure → hands-on puzzle UIs | the console repairs | repairs as a pure tax on the main game |

## Directions
**Goo** (full detail in `goo-feel.md` §4): A shader blobs + springs (recommended: cheap on phones, can't break rules, all knobs in `content/goo.json`) · B v1 soft-body made visual-only · C Puyo tiles + bridges (also A's low-power fallback) · D A + stretchy strands later.
Next step: a throwaway phone sketch of A with a Puyo-mode toggle (`goo-feel.md` §5).

**Tutorial** (redo): the BMUZ plan says "Tutorial = its own module: point at things, wait for an action, explain at the point of action, never block." Goops builds it: a step list in `content/` run by a small step-runner, using the UI kit's `Callout` + `useTips`, with the garbled intercom as its voice. Built after the rules settle (v1 spent ~90 commits rebuilding it around changing rules).

**Breakdowns** (tune, don't cut): rough takes for /define. (1) Each meter rises from *time or tank state*, not from your best actions. (2) Each breakdown creates a trade-off ("fix it now and lose the tank view, or play blind a bit longer"). (3) The console pauses or slows pressure during repairs.

## Framework fit
| Part | Use in Goops |
|---|---|
| UI kit | settings, pause, dialogs, results, Callout/tips for the tutorial; the console home stays custom |
| Dev Kit | goo + gameplay tuning sliders, Snapshots (save "tank almost full"), bug capture, Moments (pop, merge, crack sealed, breakdown) |
| Audio | squelch / pop / alarm / intercom by moment name |
| Table / Rooms | not needed: single-player, real-time |
**New for the framework:** Goops is the first real-time game. It proves a fixed-step game loop + clock (pause / slow in one place), input for touch gestures, and a phone frame budget. It also proves the tutorial module.

## BMUZ learnings to collect (first video game)
Watch for gaps BMUZ 2 has for real-time games and add them as one checklist line each, where they belong: frame budget + phone perf checks in Fast/Full checks · game-feel tuning of moment-to-moment input · deterministic replays (seeded runs) for testing real-time rules · playtests that record inputs.
