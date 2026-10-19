# Looks ("render shaders") — notes for a framework module

Muzzy, 2026-10-19: "'render shaders' (looks like the crt look that's reusable) should be a category of component we want to get better at."
Same deal as `lesson-module.md`: every look Goops builds or changes adds what it learned here, so the framework session can lift a **looks module** later. This Goops session never edits the framework.

## What a look is
A look changes how something already on screen is drawn. It never changes a rule. Every look is a combination of five independent choices:

| Choice | Options |
|---|---|
| **Surface:** where it draws | DOM text · DOM panel (box + contents) · canvas region (a rectangle of the game view) · whole screen |
| **Engine:** how it draws | CSS (filters, gradients, text-shadow) · WebGL post pass (shader over a cut-out of the canvases) · canvas 2D overlay |
| **Layers:** what it adds, stacked | glow · scan lines (static or rolling) · curve + vignette (old TV) · wobble / phase distortion · glitch (tears, colour split) · pixelate · tint · typing + block cursor (text only) |
| **When:** what turns it on | always · while a state lasts (machine broken) · ramps in over time (visor `rampMs`) · on an event, then fades |
| **Clock:** what time it follows | looks clock (stops on full pause, not half) · rules clock · none (static) |

Shared by every look:
- **Presets:** each look has named presets (green DOS, amber, off), with every knob live in the Dev Kit.
- **Reduce motion:** wobble and rolling or typing stop; the look stays.
- **Accessibility:** a text look keeps the real words readable (`.crt-read` holds the full text; `.crt-words` is the aria-hidden typed copy).

## Goops looks so far

| Look | Surface | Engine | Layers | When | Files |
|---|---|---|---|---|---|
| Console monitor (F32) | DOM text | CSS | glow, scan lines, wobble, typing + cursor | always | src/game/crt.ts, crt.css, content/tuning/crt.json |
| Visor glitch (F25) | canvas region (the tank) | WebGL post pass | curve + vignette, glitch, pixelate | ramps in while the visor is broken | src/view/visorFx.ts, visorShaders.ts, content/tuning/visor-fx.json |
| X-ray box (F36) | canvas region (a box round a covered crack) | canvas 2D | tint, rolling scan lines | while a crack is covered | src/view/crackBubbles.ts / tankView, content/tuning/cracks-look.json `xray.*` |

**Already a smell:** the three looks above draw scan lines in three separate ways, with three sets of knobs (`scanGap` / `scanLine` / `scanStrength` in crt.json; `xray.scanGap` / `scanWidth` / `scanAlpha` / `scanSpeed` in cracks-look.json; the visor has its own in the shader). A module would define each layer once, with the same knob names and meaning for every engine. Then "scan lines" means the same thing wherever they're used.

## Rules learned
- **Quick to apply** (Muzzy, sprint 08 retro): putting a look on something must be one wrapper or class plus a preset name, not a hand-built effect. The CRT took far too long because it was built by hand for one place.
- **Only over its own surface:** the visor look covers only the tank's rectangle, never the HUD (Muzzy, 2026-10-18), so the curve bends at the tank's edges.
- **Off = no cost:** with nothing on, the overlay hides and does nothing (visorFx), so the game looks exactly as it would without it.
- **Same intention → same look:** two "looking through a device" moments (the visor, the x-ray box) share the scan-line feel.

## Next in Goops
F60 (sprint 09) makes the CRT look a reusable piece with presets and puts it on a second thing (the next-piece window's frame). Worth doing in the same pass: give its scan-line knobs the same names as the x-ray box's, so the layer has one vocabulary.
