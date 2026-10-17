# Goo techniques: how to make one living goo, judged for Goops

*Written 2026-10-16 for the goo lab. This is a helper report; `claude-notes.md` holds the lab brief. It uses the same knob names (merge, threshold, bulge, translucency, absorb, wetness, fresnel, gravity, viscosity, stiffness, wobble).*

**The question:** sketch 1 (`sketches/goo-sketch.html`, shot `04-full-board.png`) reads as **beads on a string**. How do other people get **one continuous, living goo**, and which way fits a phone-browser grid puzzle?

**Ground rules from the brief:**
- Phone browser, WebGL2, 60fps.
- 10×19 grid, up to ~190 cells, 5–8 colours, plus a falling piece.
- The grid decides everything. The goo only draws it: it may lag, wobble, stretch and drip, but it never feeds back into the rules.

---

## 0. Why sketch 1 looks like beads (first-hand, from its shader)

Four things in the code each push toward "separate balls":

1. **Every cell is its own shape.** Each cell is a rounded box at `size 0.92` with `roundness 0.75`. That's nearly a circle, and it's smaller than its cell. Smooth-min with `fuse 0.32` only partly fills the pinch between two circles, so you get a **neck**, not a shared body.
2. **Every cell has its own dome.** The surface normal is built from `dh`, the sum of one dome per cell. So each cell gets its own highlight dot and its own shading lump. Your eye counts the highlights, and it counts beads. *This is the biggest cause.*
3. **The bevel is very thin** (`0.12` cells). The group's edge rounds over in a narrow band and the inside is flat. You never see the whole group bulge as one pillow.
4. **Each cell wobbles on its own.** The squash spring is per cell, and `kickNear` alternates the sign in a checkerboard. Neighbours squash in opposite directions, which reads as "many little things", not "one jelly".

**Fix principle for every technique below:** the **shape**, the **height (bulge)** and the **motion** must come from the *group*, not from each cell.
- **Shape:** a field that adds up across the whole group, or one distance-to-edge for the group.
- **Bulge:** taken from how deep inside the group a point is.
- **Motion:** neighbours pulled along with each other, not alternating.

---

## 1. 2D metaballs done well

### How it works
Every blob gives off an invisible "glow" that fades with distance (the **kernel**). Add all the glows together to get the **field**. Wherever the field is above a **threshold**, paint goo. Where two blobs come near each other, their glows add up in the gap and the gap fills in. That's the merge.

**Kernels** (the shape of the glow):

| Kernel | Formula (r = distance, R = reach) | Character |
|---|---|---|
| **Wyvill / "soft object"** | `(1 - r²/R²)³`, zero beyond R | **Best default.** Smooth, no square root, and it stops at R, so each pixel only adds nearby blobs. Cheap. |
| Inverse-square (Blinn-style) | `R² / r²` | Infinite reach. Everything leans toward everything, giving long stringy bridges. Needs clamping near 0 and is costly (every blob touches every pixel). |
| Gaussian | `exp(-r²/R²)` | Very soft and blobby. Effectively infinite reach. Same thing you get from "dot + blur". |
| Polynomial `(1 - r²/R²)²` | | A bit tighter than Wyvill, so a slightly crisper merge. |

**The merge look is set by kernel reach ÷ blob spacing, plus the threshold.**
- **Lower threshold or bigger reach:** fatter goo, fuller merge ("one mass").
- **Higher threshold:** tighter blobs with necks ("beads").

This is the `merge` / `threshold` pair from shaders.com's Goo component ([docs](https://shaders.com/docs/components/goo)).

### Shading it so it looks wet and 3D
Treat the field as a **height map**, as if the goo were a pillow seen from above.

1. **Height:** `h = smoothstep(threshold, threshold + bulgeWidth, field)`. Use `sqrt` instead of smoothstep for steeper, droplet-like edges.
   - A big group's field piles up in the middle. **That alone gives one big dome per group.** This is the cure for item 2 above.
2. **Normal** (which way the surface faces): take the slope of `h` with `dFdx/dFdy`, or sample the neighbouring pixels. Then `n = normalize(vec3(-slope * bulge, 1))`.
3. **Light:**
   - **diffuse:** `dot(n, L)`
   - **wet specular:** Blinn-Phong `pow(dot(n, H), 60–150)`. Add a second, broader, weaker lobe for "clearcoat".
   - **rim / fresnel:** `pow(1 - n.z, 3)`, which brightens or darkens the edge.
   - **wetness** = how sharp and bright the specular is.
4. **Matcap (artist-friendly shortcut):** look up a small painted sphere image using `n.xy`. You can paint "what goo looks like" in Photoshop and swap it live. Very cheap, and it's how a lot of mobile games get glossy materials.
5. **Thickness → translucency** (Beer–Lambert, the `absorb` knob): `colour = mix(light tint, deep saturated colour, 1 - exp(-absorb * thickness))`, with thickness = the field. Thin edges and strings look clear and bright. Thick middles look rich and dark. **This is what sells "jelly" rather than "plastic".**
6. **Fake subsurface glow** (`translucency`): sample the field a few pixels *toward* the light. Where the goo is thin on the far side, add a soft glow of the base colour. It looks like light passing through.
7. **Refraction:** shift the background lookup by `n.xy * h * strength`, so the tank grid bends behind the goo. Cheap and very convincing. It needs the background drawn into a texture first.

### GPU recipe (splat → shade)
- **Pass 1, splat:** for every blob, draw one small square (instanced) into an offscreen **half-resolution** texture. Its fragment shader writes the kernel value with **additive blending**.
  - **Colour separation:** each colour writes into its own channel.
    - **RGBA = 4 colours per texture.**
    - **5–8 colours = 2 textures written in the same pass** (WebGL2 multiple render targets via `drawBuffers`). Each blob writes 0 into the channels that aren't its colour.
- **Pass 2, shade (full screen):** for each pixel, read the 4–8 colour fields.
  - **Winner = the colour with the biggest field** ("max-field-wins").
  - Threshold and shade using that colour's field only.

**Keeping colours separate.** Three options, best first:

| Option | How it works | Result |
|---|---|---|
| **Per-colour fields + max wins** | As above. Where red and blue meet, the boundary sits where their fields are equal. | A **flattened contact face**, like soap bubbles pressed together. Same colours fuse; different colours press against each other with a **clean seam**. Add a dark line where the top two fields are close (`f1 - f2 < seamWidth`), or subtract a bit of the rival field (`f1 - gap * f2`) for a visible gap. **Recommended.** |
| One field + colour-weighted average | | Colours **blend into each other** (purple between red and blue). Wrong for a match-colour game. |
| ID tricks (pack the colour ID into low bits and use MAX blending) | | Saves memory but loses the additive merge. Not worth it at our size. |

**Float textures on phones:** additive splats want `RGBA16F`. In WebGL2 that needs `EXT_color_buffer_float`, or `EXT_color_buffer_half_float`. Modern iOS Safari and Android Chrome generally have it, but **check at start-up**. The fallback is `RGBA8` with a kernel peak around 0.25. That works, but shading can show banding.

### Marching squares (the alternative)
- **How:** sample the field on a fine grid on the CPU (e.g. 4×4 samples per cell, so 40×76 points), then trace the threshold line into polygons. Classic explainer: [Jamie Wong](https://jamie-wong.com/2014/08/19/metaballs-and-marching-squares); also [varun.ca/metaballs](https://varun.ca/metaballs/).
- **Gives:** crisp vector outlines, good for an ink outline style or a physics outline.
- **But:** it gives no shading by itself, it costs CPU every frame, and it's the same field either way.
- **Verdict:** only if we want a drawn-outline art style. The shader threshold does the same job for free.

### Cost (phone)
The board is about 380×720 CSS px. At a 1.5 pixel ratio that's ~570×1080 = 0.6 M px, and the half-res field is ~0.15 M px.
- **Splat pass:** 190 cells, each covering ~3×3 cells of field, is ~1.5 M additive pixel writes. Under 1 ms on a mid phone.
- **Shade pass:** 0.6 M px reading 2 textures plus a few neighbour taps. About 1–2 ms.
- **Total:** comfortably inside the 16 ms frame. **Cost depends on screen size, not on how many cells**, so a full board costs the same as an empty one.

**Links:**
- [Codrops: 2D metaballs with WebGL2](https://tympanus.net/codrops/2021/01/19/drawing-2d-metaballs-with-webgl2/) (instanced splats into a texture, then threshold: exactly this recipe)
- [Jamie Wong: metaballs + WebGL](https://jamie-wong.com/2016/07/06/metaballs-and-webgl)
- [GPU Gems 3 ch. 7: point-based metaballs](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch07.html)
- [shaders.com Goo knobs](https://shaders.com/docs/components/goo)

**Build risk:** low–medium. Two shaders and one offscreen texture.

**Grid binding:** one blob (or 2–4) per cell, placed at the cell's *visual* position, which springs toward the grid position. The falling piece and droplets are more blobs. Group height comes for free from the summed field.

---

## 2. Particle fluid + blur + levels (Muzzy's idea; the CSS `blur(20px) contrast(30)` trick)

### How it works
It's the same pipeline as metaballs, just with **many small blobs** that **move on their own**, and an extra **blur** step.

1. Draw each particle as a small soft dot into an offscreen texture (per-colour channels, as in §1).
2. **Blur** it: a separable Gaussian, horizontal then vertical, done at half or quarter resolution. A "dual Kawase" blur (downsample, then upsample) is the phone-friendly way to get a wide blur cheaply.
3. **Levels:** `smoothstep(threshold - softness, threshold + softness, blurred)`. This is exactly what CSS `contrast(30)` does, but in your control. A narrow window gives crisp edges; a wider window gives softer edges. The window is also the anti-aliasing.
4. **Shade from the blurred value** as a height, as in §1. **The blur is what makes a big group into one mass**: it smears all the particles' dots into one smooth hill, so the highlight sweeps across the whole group.

**Why the CSS version isn't enough:**
- It blurs **colour**, so red and blue smear into a muddy fringe (v1's black fringes).
- It can't shade.
- Its cost grows with screen area on the phone's compositor, and Safari is especially fragile there.

The shader version keeps each colour in its own channel and adds lighting.

**Proven in shipped mobile games:** the Box2D/LiquidFun fluid-rendering write-up ([gamedev.net](https://gamedev.net/tutorials/programming/general-and-gameplay-programming/fluid-rendering-with-box2d-r4737)) uses this exact recipe:
- draw particles **bigger than their physics size**
- additive alpha as the "potential"
- threshold with a small smooth window
- fade removed particles out instead of popping them

Also see [Defold forum: 2D metaball fluid](https://forum.defold.com/t/fluid-simulation-2d-metaballs/47371) and the screen-space fluid idea from [van der Laan et al. 2009](https://www.win.tue.nl/~wstahw/edu/2IV05/andrei/particle_rendering/provided/p91-van_der_laan.pdf).

### Making the particles move (cheapest first)

| Model | What it does | Feel |
|---|---|---|
| **Anchor springs + cohesion** (our own, simplest) | Each particle has a **home** (its cell's spot plus a fixed offset) and a spring pulls it there. Same-colour particles within a radius pull gently together. Different colours push apart. Everything has damping. | Sloshes, settles, overshoots. Stiff spring = jello; weak spring = soup. |
| **+ breakable sticky springs** (Clavet-style) | When two same-colour particles get close, link them with a spring. If it's stretched past `breakLength`, it snaps. Rest length slowly creeps toward the current length ("plasticity"). | **Strings** that stretch and snap, drips, taffy. This is the **viscoelastic** model from [Clavet, Beaudoin & Poulin 2005](https://diglib.eg.org/handle/10.2312/SCA.SCA05.219-228): springs between neighbours plus "double density relaxation". Drops and filaments come out naturally. |
| **SPH / PBF** (real fluid pressure) | Particles push to keep an even density, i.e. real liquid. | Watery, splashy. Too liquid for "gel" unless viscosity is high. |
| **LiquidFun flags** ([guide](https://google.github.io/liquidfun/Programmers-Guide/html/md__chapter11__particles.html)) | Ready-made `viscous` / `tensile` (surface tension) / `elastic` / `spring` particle groups. JS: [`@box2d/core`](https://www.npmjs.com/package/@box2d/core) plus its particles package (TypeScript port; pre-1.0, "will change a lot"). | Good, but a dependency on an early-stage port. Fine to *copy ideas from*. |

### Binding to the grid
Each cell owns **K particles**, about 6–12 laid out in a small cluster.
- **Home** = the cell's visual position + offset. The visual position springs toward the grid position, so the falling piece's particles **trail and stretch** as it steps down, and **overshoot and squash** when it lands.
- **Cohesion** between same-colour particles is what makes a 2×3 group **one body that sloshes together** instead of six cells wobbling on their own.
- **Pop:** release the home springs and give an outward kick. Particles then fall under (low) gravity, still sticky with each other, so they **drip and string** as they leave, then shrink and fade.
- **Cells drop after a pop:** the homes jump down a row. The particles follow with lag, which gives a natural "drip, then fall".
- **Merging** (a piece lands next to the same colour): cohesion pulls the edges together, giving the **sticky absorb** from Muzzy's pasted reference.
- Low gravity (~2 m/s², which Muzzy liked) and low damping give the floaty, sloshy feel.

### Phone cost
- **CPU (plain JS):** 190 cells × 10 = **~2,000 particles**. With a spatial hash (bucket particles by grid cell, check the 3×3 nearby buckets) and 2 sub-steps, that's roughly **2–4 ms** on a mid phone. Fine. Plan for **≤ 4,000 particles on CPU**.
- **GPU:** particles stored in textures and updated in a shader. 10–50k is easy, but **finding neighbours on the GPU is hard in WebGL2** (no compute shaders, no atomics). Not needed at our size.
- **Render:** same as §1 plus the blur (two passes at quarter res, ≈ 0.5 ms).

**Build risk:** medium. The physics is ~150 lines, but tuning is where v1 lost time. Keep it to ~6 knobs.

**References:**
- [Sebastian Lague: Coding Adventure, Simulating Fluids](https://github.com/SebLague/Fluid-Sim). An SPH particle fluid with great explanations, in Unity; the ideas carry over.
- [Ten Minute Physics index](https://matthias-research.github.io/pages/tenMinutePhysics/index.html). Single-file HTML demos.

---

## 3. PBD / XPBD soft bodies, shape matching, and MPM

### Position-based dynamics (PBD / XPBD)
**How:** move the points freely, then repeatedly nudge them back to satisfy rules ("keep this distance", "keep this area"). XPBD adds a proper stiffness value that doesn't change with the number of iterations.

**Looks like:** stable jelly, cloth and ropes. It can't explode the way plain springs can.

**References:**
- [Ten Minute Physics 10: soft bodies](https://matthias-research.github.io/pages/tenMinutePhysics/10-softBodies.html)
- [episode 05: PBD intro](https://matthias-research.github.io/pages/tenMinutePhysics/index.html)
- [lisyarus: 2D soft body](https://lisyarus.github.io/blog/posts/soft-body-physics.html)

### Shape matching (Müller et al. 2005, "Meshless deformations based on shape matching")
**How:** remember a group's rest shape. Each frame, find the best rigid fit of that rest shape to where the points currently are, then pull every point toward its fitted spot. `stiffness` (0–1) controls how hard it pulls.

**Looks like:** **stiff jello** that always recovers its shape. The whole group wobbles **as one body**. This is the JellyCar / "Floor is Jelly" look.

**Why it fits Goops well:**
- One point per cell (or 4 per cell) = 190–760 points. Trivially cheap.
- It directly fixes "each cell wobbles on its own".
- The rest shape **is** the grid shape, so it can never drift from the rules.
- Rebuild a group's rest shape whenever the grid changes it (lock, pop, drop).

**Risk:** low–medium. The fitting maths (a 2×2 polar decomposition) is ~20 lines in 2D.

### MPM / MLS-MPM (Material Point Method)
**How:** particles carry the material. Each step they splat their momentum onto a background grid, the grid does the force maths, and the particles read velocities back. The same code does fluid, jelly, snow and sand by swapping the "material" formula. MLS-MPM is the compact modern version (Taichi's famous "mpm88" is 88 lines).

**Looks like:** the most real goo there is. Gooey stretching, folding, jelly that splits.

**Phone browser in 2026:**
- **WebGPU is now on both phone platforms.**
  - **iOS/iPadOS 26 Safari** has it ([web.dev](https://web.dev/blog/webgpu-supported-major-browsers), [AppDeveloperMagazine](https://appdevelopermagazine.com/webgpu-in-ios-26/)).
  - **Android Chrome** has it since 121, on Android 12+ with Qualcomm/ARM GPUs. Older and budget Android phones still don't.
- **Particle counts:**
  - The Codrops WebGPU MLS-MPM article runs **~100k particles on a laptop integrated GPU** and targets an older iPad Air ([Codrops 2025](https://tympanus.net/codrops/2025/02/26/webgpu-fluid-simulations-high-performance-real-time-rendering/)).
  - [WebGPUMPM](https://github.com/chetan-parthiban/WebGPUMPM) reports 200k on desktop.
  - luma.gl ships an [experimental 2D MLS-MPM](https://luma.gl/docs/api-reference/experimental/mls-mpm-fluid-simulation).
  - No published phone benchmarks. My estimate is that **5–20k particles in 2D is realistic on a recent phone**, which is plenty for our board.
- **WebGL2-only MPM** is possible (splatting with additive blending stands in for atomic adds) but awkward.

**Verdict:** a beautiful showpiece, but it needs a WebGPU path plus a WebGL2 fallback, and it's hard to bind to grid cells exactly. **Not for the lab's first round.** Revisit only if §2's particles feel too fake.

---

## 4. Raymarched SDFs in 2D / 2.5D (what sketch 1 used), done right

### How it works
Each shape is described by a **signed distance**: how far a point is from the shape's edge (negative inside). Shapes are combined with **smooth-min**, which blends edges within a radius `k` ([Inigo Quilez: smooth minimum](https://iquilezles.org/articles/smin/), [2D distance functions](https://iquilezles.org/articles/distfunctions2d/)).

### How to make it read as one mass instead of beads
1. **Cells at full size (1.0), not 0.92.** Same-colour squares then tile into the exact group outline with no pinch. **Round the group, not the cells:**
   - Inflate the union by a radius to round convex corners (`d_group - r` on boxes shrunk by `r`).
   - Use smooth-min with a **large k (0.6–1.0 cells)** to fillet the inside corners.
   - Keep gaps **only between different colours**: shrink a cell's edge only on the sides that touch another colour.
2. **Use a smooth-min that doesn't care about order.** Quadratic smin gives slightly different results depending on which cell is added first, which can show as seams. IQ's exponential or "root" smin is order-independent and blends many shapes evenly.
3. **Height from the group, not the cell.** Use `h = profile(-d_group / bevelWidth)` with a **wide bevel (0.5–1.0 cells)** and a circular profile (`sqrt(1 - (1-x)²)`). Drop the per-cell domes entirely.
   - One group = one pillow = **one highlight sweeping along its edge**.
   - Bigger groups get a broader flat top. A 1-cell blob is a round dome; a 10-cell group is a long glossy slab.
4. **The lookup-radius catch.** Sketch 1 only checks the 3×3 nearby cells, so "distance to the group edge" is only right within ~1 cell. A bevel up to ~1 cell works. For deeper "fatter in the middle" bulge, either:
   - **Jump Flood:** compute a true distance field of each colour's mask with the Jump Flood Algorithm. That's ~9 cheap full-screen passes at half res, a well-known GPU trick. It gives the exact distance to the edge anywhere. You can even inflate along the **medial axis** (the group's "spine") so thin arms stay thin and blobs bulge.
   - Or **just blur the group mask** (§2). The blurred value is a fine stand-in for distance-to-edge.
5. **Low-frequency term:** add a slow, large noise or sine to the distance *per group*, not per cell, so the whole edge breathes together ("alive" without wiggly beads).

**Looks like:** the crispest edges of all the options, resolution-independent, very controllable. But it's "smart plastic" unless you add translucency/absorb (§1 shading applies unchanged).

**Cost:** low (one pass). Cost grows with the cells checked per pixel, so keep the 3×3 lookup.

**Risk:** low. It's a revision of sketch 1, not a new build.

**Binding:** exactly like sketch 1. The grid gives cells; pose springs give offsets.

**Weakness:** drips, strings and sloshing have to be faked with extra capsule/circle shapes. It can't truly flow.

---

## 5. "Sticky absorb", stringy separation, edge wobble

- **Absorb (two blobs pull into each other and merge):**
  - **Particles:** same-colour attraction within a range (`cohesion`), plus the summed field. As they approach, the field bridges the gap *before* they touch. That's the "reaching". Then the bridge thickens as they pull together, and the blobs settle into one (Muzzy's jello reference does this with plain circles + blur/contrast).
  - **No particles:** animate the merge amount (`k`, or the kernel reach) from 0 up to full over ~150–300 ms after the touch, with a slight overshoot spring.
- **Stringy separation (a bridge that thins and snaps):**
  - **Field version:** two wide-reach kernels moving apart naturally produce a neck that thins, then snaps at the threshold. Wider reach or a lower threshold gives longer strings.
  - **Stronger strings:**
    - **breakable springs** between particles (Clavet, §2): stretch → thin → snap, then each end springs back
    - or an explicit **bridge capsule** between the two parts whose thickness = `base * (1 - stretch / breakLength)`, removed at 0, with a little drip blob spawned on each end
- **Edge wobble after release:** give each body 2–3 wobble modes (an oval stretch, a triangle, a square), each a small damped spring. Kick them on events. Add them to the body's radius/distance as `a2·cos(2θ) + a3·cos(3θ)`. That's cheap jelly bounce for the SDF/metaball versions. With particles or shape matching the wobble comes out on its own.

---

## 6. Reference implementations and games

| Reference | What it is | What to take for Goops |
|---|---|---|
| [Codrops WebGL2 2D metaballs](https://tympanus.net/codrops/2021/01/19/drawing-2d-metaballs-with-webgl2/) | Instanced kernel splats into a texture, then threshold | Our L2/L3 render pipeline, near-verbatim |
| [Inigo Quilez: smin](https://iquilezles.org/articles/smin/), [2D SDFs](https://iquilezles.org/articles/distfunctions2d/) | The smooth-min family, order-independent variants | L1 fix |
| [PavelDoGreat WebGL Fluid](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) | Grid ("Eulerian") ink/smoke fluid; famous; runs on phones | Not goo (no surface). Useful as **reference code for phone-safe WebGL2 float textures, framebuffer ping-pong and bloom** |
| [Sebastian Lague Fluid-Sim](https://github.com/SebLague/Fluid-Sim) | SPH particles with superb explanations | Spatial-hash neighbour search, viscosity, pressure ideas |
| [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) | Single-file HTML PBD, soft-body and FLIP demos | Shape matching / PBD recipe for L4 |
| [LiquidFun](https://google.github.io/liquidfun/Programmers-Guide/html/md__chapter11__particles.html) / [@box2d/core](https://www.npmjs.com/package/@box2d/core) | Google's mobile particle fluid with goo-like flags | The flag list as a feel vocabulary; maybe the library later |
| [Clavet et al. 2005](https://diglib.eg.org/handle/10.2312/SCA.SCA05.219-228) | Viscoelastic particle fluid | Breakable sticky springs = strings + drips |
| [Codrops WebGPU MLS-MPM](https://tympanus.net/codrops/2025/02/26/webgpu-fluid-simulations-high-performance-real-time-rendering/) | 100k-particle MPM + screen-space fluid rendering | Future showpiece only |
| [three.js marching cubes example](https://threejs.org/examples/#webgl_marchingcubes) | 3D metaballs on the CPU | Not needed (we're 2D) |
| CSS/SVG "gooey effect" ([CSS-Tricks](https://css-tricks.com/gooey-effect/)) | blur + contrast | Proof of the look; too slow, colour-muddy, unshaded on phones (v1's problem) |
| *Where's My Water?* | 2D particle water on mobile | Widely described as particles + metaball-style rendering. I found no first-party write-up, so treat it as plausible, not confirmed. The gamedev.net Box2D article is the documented version of that recipe |
| *Gish* | One ring of spring-linked points with a pressure term, textured | Proof that a single soft outline reads as "alive" (the v1 approach) |
| *Slime Rancher* | 3D slimes: vertex jiggle + glossy/translucent shader | Wetness comes from **specular + translucency**, not from shape |
| *LocoRoco* | Spline outline soft bodies that split and merge | One smooth outline + one highlight = cute goo |
| *World of Goo 2* | Adds liquid that flows | I couldn't find a technical source, so not claimed |
| *Puddle*, *Fluidity* | Particle liquids on console/mobile | Same family as §2. No verified rendering details |
| *Tasty Planet* | Sprite-based "goo" | Juice over simulation |
| "Hue Goo" | Couldn't verify this title exists | Skipped |

---

## 7. Comparison for Goops

| Family | One mass? | Wet look | Moves like | Phone cost | Build risk | Grid binding |
|---|---|---|---|---|---|---|
| **SDF, group-based** (§4) | Yes, once the per-cell domes are gone | Good (+ absorb) | Pose springs only; drips faked | Lowest | Low | Exact, trivial |
| **Metaball splat** (§1), 1–4 blobs/cell | Yes, naturally | Very good | Pose springs; merges/necks for free | Low | Low–med | Easy |
| **Particles + blur + levels** (§2) | Yes, strongly | Very good | **Real slosh, drips, strings, absorb** | Low–med (≤4k particles on CPU) | Medium (tuning) | Anchor springs per cell |
| **Shape matching** (§3) | Yes (moves as one) | Uses §1/§4 render | **Stiff jello** wobble | Lowest | Low–med | Rest shape = grid shape |
| **MPM** (§3) | Yes | Very good | Most real | High; WebGPU only | High | Hard |
| CSS blur/contrast | Yes | No | Whatever drives it | High on Safari | Low | n/a |

---

## 8. Goo-lab sketch proposals (each one page, plain WebGL2/JS, no build)

All four share the same board, controls, FPS counter, "fill board" and "pop" buttons, and the same knob names. The **grid logic from sketch 1 is reused unchanged** (rules never read the goo). Each runs on a phone via the LAN link.

**Suggested order:** L1 → L2 → L3 → L4. L1 is a 1–2 hour test of the diagnosis. L2 is the likely look. L3 adds the motion Muzzy described. L4 is the jello alternative to L3's slosh. L2, L3 and L4 share the L2 renderer, so later ones are cheap.

### L1: "Pillow SDF" (fix sketch 1, prove it was the shading)
**Recipe:**
- Sketch 1's shader with four changes:
  - full-size cells (1.0)
  - only colour-to-colour edges inset
  - order-independent smooth-min with large k
  - height from the **group** distance with a wide circular bevel; delete the per-cell `dome` term
- Shading: §1 absorb + matcap-style highlight.
- Motion: per-cell pose springs replaced by **per-group** springs (all cells of a group share one squash/wobble value; no checkerboard sign flip). Ripple per group.

**Sliders:** `merge` (smooth-min k, 0–1.2 cells) · `bulge` (bevel width, 0.1–1.2 cells) · `wetness` (specular sharpness/strength) · `absorb` (thin clear ↔ thick saturated) · `seam` (gap/dark line between colours) · `wobble` (group spring stiffness).

**Answers:** "Was it just the shading?" If L1 already reads as one mass, the cheap path is alive.

### L2: "Splat goo" (metaball field, per-colour channels, wet shading)
**Recipe:**
- Each cell = 4 kernel blobs (a 2×2 cluster, so a lone cell is soft-square, not a ball), Wyvill kernel.
- Splat into 2× `RGBA16F` half-res textures (8 colour channels, one pass via `drawBuffers`).
- Optional separable blur.
- Full-screen pass:
  - max-field-wins colour pick, with seam where the top two fields are close
  - `h = smoothstep(threshold, threshold + bulgeWidth, field)`
  - normal from slope, Blinn spec + clearcoat + fresnel rim
  - Beer–Lambert absorb from field thickness, fake subsurface toward light
  - optional background refraction
- Motion: group pose springs (as L1); falling piece / droplets are extra blobs; merge animated by growing the newcomer's kernel reach.

**Sliders:** `merge` (kernel reach) · `threshold` · `bulge` · `translucency` · `absorb` · `wetness`/`fresnel` (as one or two).

**Answers:** "Is a summed field the goo look?" It also sets the renderer L3 and L4 reuse.

### L3: "Grid-bound particle goo" (Muzzy's idea, living motion)
**Recipe:**
- L2's renderer, fed by particles instead of fixed blobs. Each cell spawns K particles (default 8) around its home.
- Per step (2 sub-steps, CPU, spatial hash):
  - **home spring** → visual cell position
  - **cohesion** to same-colour neighbours within radius
  - **repulsion** from other colours
  - **sticky links** formed between close same-colour particles, broken past `breakLength`, rest length creeping (plasticity)
  - **gravity** (default 2 m/s²-equivalent)
  - **viscosity** (damping of relative velocity)
- Blur on (the blur is what fuses many dots into one hill).
- Pop: release homes + outward kick, particles drip/string, then shrink and fade.
- Falling piece: homes move with the grid piece, particles trail and squash on landing.

**Sliders:** `stiffness` (home spring: soup ↔ jello) · `viscosity` · `gravity` · `sticky` (cohesion strength) · `strings` (breakLength) · `particles per cell` (4–16, also a perf test). The look sliders from L2 stay in a second tab.

**Answers:** "Do slosh, drips, strings and the sticky absorb make it feel alive?" Watch the FPS with a full board at 16 particles/cell.

### L4: "Shape-matched jelly" (stiff jello alternative)
**Recipe:**
- L2's renderer. Each cell = 4 corner particles.
- Each same-colour group is a **shape-matching cluster** (Müller 2005): fit the rest shape (= grid layout), pull particles toward fitted goals by `stiffness`, plus damping.
- Rest shape rebuilt on lock/pop/drop.
- Landing / rotate / neighbour-pop push an impulse into the particles, so **the whole group jiggles as one body**.
- Optional "plasticity" lets a group keep a slight sag after a hard landing.

**Sliders:** `stiffness` (shape-match alpha, 0.05–1) · `damping` · `impact` (impulse size on events, tied to the small/medium/big feel tiers) · `squash` (allow area change) · `sag` (plasticity) · `gravity`.

**Answers:** "Does Muzzy prefer jello (L4) or slosh (L3)?" These could also blend: L4 for locked groups, L3 particles only for drips and pops.

---

## Sources
- Sketch 1 code: `.planning/research/sketches/goo-sketch.html` (shader lines ~272–345; GOO values ~47–60; per-cell springs/kicks ~148–180)
- Lab notes: `.planning/research/goo-lab/claude-notes.md`, `refs/viscous-jello-muzzy.html`
- Links inline above. Main ones:
  - [Quilez smin](https://iquilezles.org/articles/smin/)
  - [Codrops WebGL2 metaballs](https://tympanus.net/codrops/2021/01/19/drawing-2d-metaballs-with-webgl2/)
  - [gamedev.net Box2D fluid rendering](https://gamedev.net/tutorials/programming/general-and-gameplay-programming/fluid-rendering-with-box2d-r4737)
  - [Clavet 2005](https://diglib.eg.org/handle/10.2312/SCA.SCA05.219-228)
  - [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html)
  - [LiquidFun particles](https://google.github.io/liquidfun/Programmers-Guide/html/md__chapter11__particles.html)
  - [Codrops WebGPU MPM](https://tympanus.net/codrops/2025/02/26/webgpu-fluid-simulations-high-performance-real-time-rendering/)
  - [web.dev WebGPU support](https://web.dev/blog/webgpu-supported-major-browsers)
  - [shaders.com Goo](https://shaders.com/docs/components/goo)
  - [Defold metaball fluid](https://forum.defold.com/t/fluid-simulation-2d-metaballs/47371)
  - [van der Laan 2009](https://www.win.tue.nl/~wstahw/edu/2IV05/andrei/particle_rendering/provided/p91-van_der_laan.pdf)
- Unverified / estimated (flagged):
  - phone timings in §1/§2 are my estimates from pixel and particle counts, not measurements. The lab FPS counter should confirm them.
  - Where's My Water / World of Goo 2 / Puddle internals are not confirmed by a primary source.
