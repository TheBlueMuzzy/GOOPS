# Goo lab: Claude's own research notes (2026-10-16)

Written alongside the three helper reports (`videos.md`, `codepens.md`, `techniques.md`). This file is what I found myself, plus the brief for the next sketches.

## Why sketch 1 fell flat (my read)
Sketch 1 drew each cell as its own rounded blob and joined same-colour neighbours with a smooth-union neck that only looked one cell around (3×3). That gives **beads with necks**: every cell keeps its own dome and highlight, and the fuse amount was capped at 0.5 to stop seams. A goo **mass** needs a field that *adds up* across the whole group (metaballs), so the inside lines disappear and a big group gets one big dome and one highlight.

## Muzzy's feel notes so far
- Sketch 1: "wasn't super great".
- On a reference with gravity + viscosity controls: **env gravity 2.0 m/s² and much lower viscosity "kinda felt good"**: floaty, slow to settle, sloshy, not stiff. (Earth is 9.8, so this is about 1/5 gravity.)
- Wants: one continuous body with no visible solid cores (Triboi-Andrei pen), a sticky "absorb each other" merge (his pasted jello), stretch then edge bounce on release (crsten), strings (Techno-Tut), and a possible stiff-jello option (TaminoMartinius).

## Findings
1. **A look target with real knobs.** shaders.com's "Goo" component describes the look we want and names the knobs ([docs](https://shaders.com/docs/components/goo)):
   - `merge` ("low = distinct beads, high = one mass": our exact problem)
   - `threshold` (lower = fatter blobs) and `bulge` (dome height)
   - `translucency` (subsurface glow) and `absorb` (Beer–Lambert: thin areas clear, thick areas saturated)
   - `wetness` (sharp specular + clearcoat rim) and `fresnel`
   - `breathe` and `wobble`

   The lab sketches should expose the same knob set, so Muzzy tunes the look in his own words.
2. **The proven mobile pipeline for blob liquids** (the Box2D/LiquidFun fluid-rendering approach behind games like *Where's My Water*, per [gamedev.net: Fluid Rendering with Box2D](https://gamedev.net/tutorials/programming/general-and-gameplay-programming/fluid-rendering-with-box2d-r4737)):
   1. physics particles
   2. draw each as a soft dot into an offscreen buffer (alpha = "potential field")
   3. blur
   4. threshold with a small smooth window (that window also does the anti-aliasing)

   Removed particles **fade instead of popping**, so the liquid looks like it drains away. That's a good fit for zapping. It's the GPU version of Muzzy's pasted `blur(20px) contrast(30)` trick (the CSS version is slow on phones; the shader version isn't).
3. **2D metaballs on the GPU** ([Codrops, WebGL2 2D metaballs](https://tympanus.net/codrops/2021/01/19/drawing-2d-metaballs-with-webgl2/)): draw an instanced quad per ball with a falloff kernel, add them into a half-float texture, then one full-screen pass thresholds it. To shade it wet, use the field's gradient as the surface normal. That gives specular, rim and fresnel, and field strength = thickness gives Beer–Lambert colour. No 2D tutorial combines all of these, so we combine them ourselves.
4. **Ready-made goo physics: LiquidFun particle flags** ([programmer's guide](https://google.github.io/liquidfun/Programmers-Guide/html/md__chapter11__particles.html)). Google built LiquidFun for phones, and its flags read like a goo wishlist:
   - **viscous** (clingy, oily)
   - **tensile** (surface tension: particles attract and form clusters, the "sticky absorb")
   - **elastic** (deforms and bounces)
   - **spring** (pairs that stretch and snap back: strings and edge bounce)
   - **color-mixing**
   - per-system `gravityScale` (Muzzy's low-gravity feel)

   It exists for JS today as `@box2d/core` (TypeScript Box2D port, includes the LiquidFun particles) and `liquidfun-wasm`. Recency and particle support still need checking before relying on them.
5. **Simple single-file physics recipes:** Ten Minute Physics (Matthias Müller) has self-contained HTML demos of a [PBD soft body](https://matthias-research.github.io/pages/tenMinutePhysics/10-softBodies.html) (squishy, draggable) and a [FLIP fluid](https://matthias-research.github.io/pages/tenMinutePhysics/18-flip.html). Good recipes to learn from when hand-writing a small solver ([index](https://matthias-research.github.io/pages/tenMinutePhysics/index.html)).
6. **Cost reality:** a UE4 study kept 30fps+ with up to 40 raymarched metaball slimes. Full 3D raymarching is the expensive route; 2D field + gradient shading gets most of the look for a fraction of the cost.

## How goo binds to the grid (applies to every lab sketch)
- Each grid cell owns **K particles** (about 6–12), pulled toward the cell's spot by a **home spring**. A weak spring gives slosh (Muzzy's low-gravity feel); a strong one gives jello.
- **Same-colour particles attract** (cohesion, the sticky absorb). Different colours **repel slightly**, so they meet at a clean seam and never mix.
- **A falling piece:** the home spots move with the grid piece, so particles trail behind it and stretch. On landing, the spots stop and the particles overshoot, squash and settle.
- **Zap:** the cell's home springs let go, the particles get a burst, then shrink and fade (the drain look). Cells above drop on the grid, and their particles follow.
- The grid never reads a particle. Switching the goo off changes no game result.

## Lab brief (to finalize after the three reports land)
One "goo lab" page with a switcher between approaches, the same board, the same controls, and the same knob names (merge, threshold, bulge, translucency, absorb, wetness, fresnel, gravity, viscosity, stiffness, wobble). Candidates:
- **L1 Metaball field:** K blobs per cell on springs, a summed field per colour, a threshold, and wet gradient shading. The direct fix for the beads.
- **L2 Particle fluid + blur + levels:** Muzzy's idea and the Where's My Water pipeline. More particles, low gravity, low viscosity, blur → threshold → wet shading, fade on zap.
- **L3 Jello outline (PBD/shape matching):** one soft body per colour group, a stiff jiggle, stretch and snap-back edges. The jello-vibe option.
- **L4 Physics-engine goo:** LiquidFun-style viscous/tensile/elastic particle groups, if a usable JS build checks out. Otherwise skip it and fold the ideas into L2.
