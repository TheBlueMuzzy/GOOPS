# Visor glitch — research (F25 task 11, 2026-10-18)

**The question:** what does the periscope visor look like as it breaks? One `amount` 0..1 (the visor signal loss) drives it; at ~0.95 it's "broken" but still playable. A full-screen pixel filter will stack on top later.

Muzzy (2026-10-18): "the visor you're looking through gets more and more glitchy… I think we'll have to work on that shader — I can get reference, but you can also look up reference via research. The other thing, we'll eventually want to put a pixelated filter over the whole thing, so we should keep that in mind."

Sketch: `sketches/visor-glitch.html` (planner → Sketches → "Visor glitch"). Shots: `sketches/shots/visor-glitch/`.

## References

| # | Reference | What it looks like | Why it might fit a cheap corporate periscope visor failing | Phone cost |
|---|---|---|---|---|
| 1 | **Metroid Prime — visor static** near Pulse/Scatter Bombu and Metroid Prime's Particle Wave ([Pulse Bombu wiki](https://breezewiki.discard.no/metroid/wiki/Pulse_Bombu), [Particle Wave Projector](https://metroid.fandom.com/wiki/Particle_Wave_Projector)) | Snow and electric interference over the helmet view; you can still play through it. | The closest game precedent: a visor you look *through* that degrades, and play goes on. Static over the view, not a black screen. | Snow is one hash per pixel: cheap. |
| 2 | **Duskers — drone camera feeds** ([review](https://indiegamereviewer.com/review-duskers/), [Giant Bomb](https://www.giantbomb.com/games/3030-50650/)) | Remote camera feeds full of static and glitches; a hit kills the feed ("lost video signal"). | Same fiction: you only see the world through a cheap remote camera. Dropout moments come from here. | Full-screen one-pass effects. |
| 3 | **Iron Lung — the sub's camera** ([review](https://bloody-disgusting.com/video-games/3707036/iron-lung-review/), [itch](https://mattro843.itch.io/iron-lung)) | Grainy, low-res, delayed pictures from a sealed sub's camera. | A sealed tank you watch through bad equipment = Goops. Supports the pixel filter + grain combo. | Low-res is *cheaper*, not dearer. |
| 4 | **KinoGlitch (Keijiro, Unity)** ([GitHub](https://github.com/keijiro/KinoGlitch)) | Analog: scan-line jitter, colour drift, vertical jump, horizontal shake. Digital: block damage. | The cleanest split of the vocabulary; our knobs map to it (tear/jitter, rgb, roll, block). | Designed as single cheap passes. |
| 5 | **FMS_Cat VCR distortion** (Shadertoy MdffD7), Godot port ([VHS Post Processing, CC0](https://godotshaders.com/shader/vhs-post-processing)) | Tape wave, tape crease, bottom switching noise, chroma smear (YIQ), white crease streaks, AC beat brightness band. | The "VHS tape" look; the streak rows and rolling brightness band come from here. | Chroma smear takes several taps: we skipped it and use a 3-tap RGB split. Shadertoy original is CC BY-NC-SA unless stated; the Godot port is CC0. |
| 6 | **Godot "VHS Scanline Glitch"** ([CC0](https://godotshaders.com/shader/vhs-scanline-glitch/)) and **Compose VHS glitch write-up** ([ProAndroidDev](https://proandroiddev.com/vhs-glitch-shader-for-compose-from-zero-to-production-3139d74c48e8)) | Random horizontal jitter per line + RGB split + thin scanlines. | Minimal "tracking" look in one pass; the mobile write-up confirms it runs in production on phones. | ~3 taps. |
| 7 | **Datamosh shader (Minecraft)** ([Modrinth](https://modrinth.com/shader/datamosh)) and **Codrops real-time datamosh** ([Three.js, 2026-09](https://tympanus.net/codrops/2026/09/02/breaking-the-frame-building-a-real-time-datamosh-effect-with-three-js/)) | 8×8 macroblocks, each on its own timer, sometimes sampling from an offset spot; ringing at block edges. True datamosh re-uses the previous frame (feedback buffer). | "Digital datamosh" look: the visor's video codec failing. We use the per-block timers + offset + edge ringing, **no feedback buffer** (one less target, and smears would hide goo). | Block maths is cheap; a feedback buffer would add a full-screen target + copy. |
| 8 | **CRT shaders: crt-geom, CRT-Lottes, "Lightweight CRT Effect"** ([libretro docs](https://docs.libretro.com/shader/crt/), [Godot lightweight CRT](https://godotshaders.com/shader/lightweight-crt-effect/), [fast CRT thread](https://forums.libretro.com/t/another-fast-crt-shader/13192)) | Curvature, scanlines, vignette, phosphor mask, halation glow. | The "Analog CRT static" look; curvature + vignette read as "glass you look through" (the visor). | Curvature/vignette/scanlines are cheap maths; masks and halation (extra passes/taps) are what cost on phones: skipped. |
| 9 | **WCAG 2.3.1 Three Flashes** ([Stark](https://www.getstark.co/wcag-explained/operable/seizures-and-physical-reactions/three-flashes)) | Rule: no big bright flashes more than 3 times a second. | A glitch effect must not become a seizure risk. | n/a |

## What we took from it (rules for this effect)

- **Colour is the rule in Goops**, so the glitch never changes a goo's hue: no channel swaps, no hue shifts, no colour-inverting blocks. RGB split only fringes the edges; blocks show the wrong *place*, never the wrong *colour*.
- **Readable at 1.0:** the big displacements are intermittent (tears and blocks re-roll 12× / 6× a second, each only a few % of the screen at once); constant damage (snow, scanlines, vignette) is capped (snow ≤ 45%, vignette ≤ 70% at the corners only).
- **Safe flashing:** flicker and dropout only ever *darken* (no white flashes), flicker is small (≤ 22%) and the scene is dark; dropout happens at most ~once a second and never goes fully black. Reduce-motion setting later should scale tears/blocks/slips down.
- **Late damage arrives late:** dropout only above ~0.4, blocks scale with amount^1.5, slips with amount², so 0.3 reads as "a bit off" and only 0.8+ reads as "broken".
- **HUD stays clean:** the score text gets mangled by the glitch (see shots); the game's HUD is DOM above the canvases, so it stays readable. Ask Muzzy if he wants the HUD to glitch too.

## Performance (measured 2026-10-18, Playwright bundled Chromium, 390×844 @3x = 1170×2532)

- Glitch pass (worst look, CRT static at 1.0): **0.083 ms** per frame on the PC GPU (RTX 4080, ANGLE D3D11). Pixel pass: 0.016 ms. Scene draw + upload of the 2D canvas: 0.19 ms (0.24 ms with CPU 4× throttled). fps pinned at the refresh cap in every case (60 headless, 120 headed).
- The pass is ALU-bound (hashes) with only **3 texture reads** per pixel. A mid phone GPU is very roughly 50–100× slower than a 4080 → an estimated 4–8 ms at full 3× resolution: OK, but it's the number to watch. Cheap wins for the game, in order:
  1. **Skip the pass at amount 0** (the normal case): zero cost when the visor is fine.
  2. The game already caps dpr at 2 (2.1 MP instead of 3 MP): ~30% less.
  3. **When the pixel filter is on, run the glitch at the pixel grid's size** (e.g. 1/4 × 1/4 = 1/16 of the pixels) into a small target and upscale it with NEAREST: the pixelate pass becomes free and the glitch gets 16× cheaper. That's the strongest argument for glitch → pixels order.
- Phone check still needed on a real device (Muzzy's phone) once it's in the game.

## How the chain ports into the game (task 13)

Today: `ShiftStage` draws the tank on a 2D canvas, and the goo renderer draws on a separate transparent WebGL2 canvas on top (CSS layered). A post effect needs both in one picture, so:

1. **Scene into a texture.** In the goo renderer's WebGL2 context, the final goo pass draws into an offscreen target (`makeTarget` in `src/goo/shared/gl.ts`) instead of the screen, and the tank canvas is uploaded as a texture (`texImage2D(tankCanvas)`, ~0.2 ms measured) — or, later, the tank is drawn in WebGL too. A tiny composite (tank tex, then goo tex over it) is the "scene".
2. **`glitch(srcTex, dst, amount, knobs, grain)`** — this sketch's `FS_GLITCH`, unchanged: one fullscreen triangle, 3 reads. `grain` = pixel-filter size when the pixel filter comes after (scanlines + snow line up with its pixels), else ~1.5 px.
3. **`pixelate(srcTex, dst, size)`** — `FS_PIX`, one read (or fold it into step 2's small target, see perf win 3).
4. Each step reads a texture and writes a target or the screen, so steps can be added, removed or reordered (`[glitch, pixelate]`); a step with nothing to do is skipped (amount 0 → no glitch pass; pixel filter off → no pixel pass).
5. Knobs → `content/` JSON (one block per look + the picked look), `amount` comes from the visor signal meter (F23/F24 engine ↔ console contract).

## Open questions for Muzzy
- Which look (or mix)? Copy values back from the sketch.
- At amount 0, should the visor already have a faint "you're looking through glass" frame (slight vignette/curve), or be perfectly clean?
- Should the HUD (score, pressure) glitch with the visor, or stay clean on top? (Plan: stays clean.)
- Pixel filter size taste (it makes in-canvas text unreadable at 4 px; fine if text stays in the DOM HUD).
