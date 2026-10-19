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
| CRT look (F32 → reusable in F60), worn by the console monitor | DOM panel + its text | CSS | tint, glow, scan lines (static or rolling), wobble, typing + cursor — each switchable per preset | always | src/game/CrtLook.tsx (`<CrtLook preset|place>` + `<TypedText>`), crt.ts, crt.css, content/tuning/crt.json (presets dos · amber · off; `use.monitor`) |
| Visor glitch (F25) | canvas region (the tank) | WebGL post pass | curve + vignette, glitch, pixelate | ramps in while the visor is broken | src/view/visorFx.ts, visorShaders.ts, content/tuning/visor-fx.json |
| X-ray box (F36) | canvas region (a box round a covered crack) | canvas 2D | tint, rolling scan lines | while a crack is covered | src/view/crackBubbles.ts / tankView, content/tuning/cracks-look.json `xray.*` |

**Already a smell:** the three looks above draw scan lines in three separate ways, with three sets of knobs (the visor has its own in the shader). A module would define each layer once, with the same knob names and meaning for every engine. Then "scan lines" means the same thing wherever they're used. **F60 did half of this:** the CRT look now uses the x-ray box's names and meaning — `scanGap` (one line to the next) · `scanWidth` (a line's thickness) · `scanAlpha` (how dark) · `scanSpeed` (roll, units/s; 0 = still). Old crt.json `scanLine` 0.45 (a share of the gap) became `scanWidth` 2.7 (= 0.45 × 6), `scanStrength` became `scanAlpha` — the monitor's pixels are identical. Still to do: the visor shader's scan lines.

### How the CRT look is applied (F60)
```tsx
<CrtLook preset="dos" className="my-panel">   {/* or place="monitor": the preset crt.json use.monitor names */}
  <TypedText text={words} />                   {/* typed + block cursor when the preset's typing is on */}
</CrtLook>
```
- The wrapper is a div that takes any div props (ref, className, data-*, style); its look comes from one data attribute per layer (`data-tint`, `data-glow`, `data-scan`, `data-roll`, `data-wobble`) + CSS variables. Layer off = its rule never matches = no cost.
- `unit` = what the scan-line sizes count in (default 1px; the monitor passes its art unit, so its lines scale with the art).
- A second place = one more `use.<place>` line in crt.json (a Dev Kit dropdown) or a fixed `preset="amber"`.

## Rules learned
- **Quick to apply** (Muzzy, sprint 08 retro): putting a look on something must be one wrapper or class plus a preset name, not a hand-built effect. The CRT took far too long because it was built by hand for one place.
- **Only over its own surface:** the visor look covers only the tank's rectangle, never the HUD (Muzzy, 2026-10-18), so the curve bends at the tank's edges.
- **Off = no cost:** with nothing on, the overlay hides and does nothing (visorFx), so the game looks exactly as it would without it.
- **Same intention → same look:** two "looking through a device" moments (the visor, the x-ray box) share the scan-line feel.
- **Presets pick, places wear** (F60): keep "which preset" (`use.<place>`, a dropdown) apart from "what a preset is" (`presets.<name>.*`). Muzzy switches a place's look in one click; editing a preset changes every place that wears it.
- **Layers are switches inside the preset, not separate presets** (F60): `off` is just a preset with every switch off, so "off" costs nothing new and any layer can come back one tick at a time.
- **A look's CSS motion must follow the looks clock too** (F60): the typing used the looks clock but the wobble/blink kept moving in the Dev Kit's full pause. Fix: the wrapper listens to `onClockPause` and sets `data-paused` → `animation-play-state: paused`. Any CSS-animated look needs this.
- **Reduce-motion rules must out-rank the layer rules** (F60): once a layer's animation sits on `.look[data-wobble] …`, a plain `.look …{ animation: none }` loses on specificity. Write the reduce-motion selectors with the same data attribute.
- **A rolling repeating gradient:** animate a registered `@property` length (`--crt-scan-at`) that offsets the stops by up to one gap — no seam, no oversized layer, and 0 = the static look exactly.
- **Keep the old DOM contract when lifting a look out** (F60): the wrapper kept `.crt`, `data-tag`, `.crt-read`, `.crt-words`, `.crt-cursor`, `data-typing`, so every e2e and the lesson spotlight kept working; before/after shots compared pixel by pixel (Playwright `animations: 'disabled'` freezes the blink/wobble so the shots are exact).
- **Words a look types tell the wrapper "still typing" before the paint** (useLayoutEffect via context): the cursor's "hold still while typing" rule lives on the wrapper, and one painted frame without it would blink.

## Next in Goops
F60 tasks 9–11 done (2026-10-19): the CRT look is `<CrtLook>` + `<TypedText>` with presets dos / amber / off, live in the Dev Kit; scan-line knobs share the x-ray box's names. Task 12 puts it on a second thing (the next-piece window's frame). For the framework: the CRT look is a kit-effect candidate as-is (DOM + CSS, no Goops imports except the looks clock, live tuning and reduceMotion — all framework pieces already).
