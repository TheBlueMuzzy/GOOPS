# Goo Feel — research for the Goops remake (Discover)

*Written 2026-10-16 for /discover. Question: v1's "goopiness" had good intent — can we get the same (or better) feel more reliably, at 60fps on a phone?*

---

## 1. What v1 was trying to do (the intent)

From `research/v1/SOFTBODY-VISION.md` (Jan 2026), Muzzy's feel words: **stiff gel / jello, blubber, gummy, curvy (never sharp corners), almost alive**. The specific wants:

1. **Jiggle** on move, rotate and landing (overshoot, bounce back, settle).
2. **Reaching**: same-colour goop stretches out toward its neighbours before touching.
3. **Shared skin**: touching same-colour goop shares one membrane — *no jump cut* (explicitly "not Suika").
4. **Alive at rest**: a slow, small undulation (two waves travelling opposite ways round the edge).
5. **Ready-to-pop** pulse; **loose goop** drips away slowly then "rips" free; **droplets** spray on pop.

And the key architecture decision, written in bold: **"Data layer unchanged, soft body is visual-only — low risk, game logic stays stable."**

That intent is good and is worth keeping word-for-word as the remake's goo pillar.

## 2. How v1 actually built it

| Part | What v1 did | Where |
|---|---|---|
| Model | One **blob per goop group** (not per cell): the group's grid outline is traced into a perimeter of Verlet points (plus inner points, holes supported), with ring springs, cross springs, a "home" spring to the grid position, and radial pressure | `core/softBody/blobFactory.ts`, `physics.ts` |
| Reaching | **Attraction springs** between nearby vertices of same-colour blobs, drawn as "tendril" beads | `physics.ts` `updateAttractionSprings` |
| Shared skin | **SVG goo filter** (Gaussian blur + alpha threshold `feColorMatrix`), one filter group per colour | `components/GameBoard.tsx` ~594, 916 |
| Render | React re-renders **SVG `<path>` strings** (Catmull-Rom → Bézier) every frame | `core/softBody/rendering.ts` |
| Motion extras | Outward impulse when full (ready-to-pop), cubic ease-in gravity for loose goop, droplet particles on pop | `physics.ts`, `useSoftBodyPhysics.ts` |
| Phone | Game loop throttled to **40fps**; masks, grid lines, CRT, glow strokes switched off; simplified fill | `hooks/useGameEngine.ts`, `GameBoard.tsx` `isMobile` |
| Tests | 636-line `tests/softBody.test.ts` — physics maths and outline tracing, not feel | |

**History** (`git log`): 9 prototypes in 4 days (Proto-1 single blob → Proto-9 loose goop/cascade), then milestone v1.5 "Soft-Body Integration" (Feb 3–8), then a long tail of fixes: "resolve 3 critical physics bugs", "harden getGhostY with upward retreat for physics overshoot", "restore in-place piece swap with soft-body blob rendering", "per-blob shake", "D2 crack plug".

### The important finding: v1 broke its own rule

Phase **27.1 "physics-controlled active piece"** (Feb 5) made the soft-body physics **own the falling piece's Y position and its "am I touching?" flag** on desktop (`engine.usePhysicsForFalling = !isMobile` in `Game.tsx:125`; `GameEngine.syncActivePieceFromPhysics`). On phones the old grid tick still ran. So:

- The rules had **two different falling code paths** (desktop = physics, phone = grid) — a bug on one wasn't a bug on the other.
- The **I-piece locking bug** (`archive/gsd/FIX-I-PIECE-LOCKING.md`) came straight from this: the physics reported the piece's row from its blob outline, which was 1–2 rows off for vertical I-pieces, so the rules thought the piece was higher, let rotations through, kept resetting the lock timer, and the piece "never locked". The ghost piece needed a patch too ("upward retreat for physics overshoot").
- The physics also had to know about the grid, buffer rows, tank rotation and cylinder wrap — game knowledge leaking into the visuals.

**Lesson → principle candidate #1: the rules never read anything back from the goo.** The grid decides where everything is and when it locks; the goo only *draws* it, a few frames behind, and can be switched off without changing a single game result. (Test for it: run a whole game with goo off and on — same results.)

### Other v1 costs worth naming
- **SVG blur filters are the slow part on phones**, especially Safari: WebKit has reports of SVG filters crashing/stuttering on iPhones and slowing scroll ([WebKit 191197](https://bugs.webkit.org/show_bug.cgi?id=191197), [WebKit 287982](https://bugs.webkit.org/show_bug.cgi?id=287982)); the classic workaround (`filterRes`) is deprecated. v1's 40fps throttle and switched-off effects are the symptom.
- **React rebuilding SVG path strings each frame** is CPU + garbage heavy; it fights the "mutate, don't re-render" rule.
- **Per-vertex physics on every group** (≈ dozens of points × iterations × attraction pair checks) — tuning ~20 sliders (stiffness, viscosity, return speed, goopiness, tendril skinniness…) for locked *and* falling separately. Hard to reason about, easy to break.
- **Goo filter blurs colour into black fringes** — v1 needed separate passes for cutouts, tendrils, falling vs locked.

## 3. The toolbox — what makes things *feel* goopy

Goo feel is really **four separate cues**. Good games get each one cheaply instead of simulating real fluid:

| Cue | What the eye reads | Cheapest reliable way |
|---|---|---|
| **A. Soft silhouette** | No corners; blobs bulge; same colour fuses into one shape with a neck | Distance-field (SDF) blob with **smooth union** in a shader, or metaballs |
| **B. Wet surface** | A tight white highlight, darker rim, slight see-through/glow inside | Fake light from the blob's distance field: highlight + rim + inner gradient |
| **C. Springy motion** | Squash on landing, stretch when falling fast, wobble that settles, overshoot on rotate | **A few springs per piece** (scale X/Y, offset, tilt) — not per-vertex physics |
| **D. Sticky events** | Necks stretch and snap when goop separates; drips; same-colour neighbours "slurp" together; pop = burst + droplets | Animate the **blend radius** and a few extra blobs (droplets, bridges) over time |

### Rendering approaches, judged for Goops

| Approach | Feel | Phone cost | Build / maintain | Verdict |
|---|---|---|---|---|
| **SVG blur + threshold filter** (v1; [CSS-Tricks](https://css-tricks.com/gooey-effect/)) | Good fuse, soft edges; blurs colour, edges a bit mushy | **High** — CPU-ish, Safari-fragile, cost grows with screen area | Easy to start, fiddly to make clean (fringes, per-colour groups) | Don't repeat |
| **Canvas 2D blur + alpha threshold** | Same look as SVG | Medium–high (blur is per frame on CPU/GPU-canvas) | Easy | Fallback only |
| **Metaballs, marching squares** on canvas ([Jamie Wong](https://jamie-wong.com/2014/08/19/metaballs-and-marching-squares)) | Classic blob merge with necks | Medium; CPU contouring every frame | Medium | Good to *understand*, not to ship |
| **SDF smooth-union in a fragment shader** (WebGL2 or R3F full-screen plane; [Quilez smooth-min](https://iquilezles.org/articles/smin/), [2D SDFs](https://iquilezles.org/articles/distfunctions2d/), [Codrops 2D metaballs WebGL2](https://tympanus.net/codrops/2021/01/19/drawing-2d-metaballs-with-webgl2/), [Jamie Wong WebGL](https://jamie-wong.com/2016/07/06/metaballs-and-webgl)) | Crisp edges at any size, controllable neck size (blend radius `k`), free wet shading from the same maths | **Low–medium**: one quad, one pass; cost = pixels × shapes per pixel. Fine with ≤~200 cells if each pixel only checks its nearby cells (grid lookup) and pixel ratio is capped (~1.5) | Medium: one shader file + small data texture; very few knobs | **Best fit** |
| **Rounded-rect per cell + neighbour bridges** (Puyo-style sprite tiles; [connected-blob tiles](https://opengameart.org/node/159474)) | Clean, readable, "toy" goo; little true fusing | Very low | Low | Great fallback / "low power" mode |
| **3D raymarched droplets** ([Codrops 2025](https://tympanus.net/codrops/2025/06/09/how-to-create-interactive-droplet-like-metaballs-with-three-js-and-glsl/)) | Gorgeous, glassy | High on phones | High | Too much for a full tank |

### Motion approaches, judged for Goops

| Approach | Used by | Feel | Cost / risk |
|---|---|---|---|
| **Pressure + spring-mass soft body** | [JellyCar](https://gamedeveloper.com/programming/deep-dive-the-soft-body-physics-of-jelly-car-explained), Gish | Truly squishy; collisions *are* the gameplay | Many points + solver; explodes on big jumps (instant rotate, tank spin, wrap); needs lots of tuning |
| **Shape matching** (springs back to its rest shape) | JellyCar, "Floor is Jelly" | Jello that always recovers | Medium; still per-vertex |
| **Verlet / PBD per-vertex** | v1, World of Goo's strand bridges | Good; stable-ish | Many knobs; v1 spent most of its fix time here |
| **Springs on a few "pose" numbers per piece** (scale X/Y, offset, tilt) ([springs for game feel](https://www.gamedeveloper.com/blogs/instant-game-feel---springs-explained)) | Puyo Puyo landing squash, most mobile "jelly" puzzlers (e.g. [Jelly Field](https://apps.apple.com/us/app/-/id6473256797)) | Squash, stretch, wobble, overshoot — reads instantly at phone size | **Tiny**; can't explode; 3–4 knobs; maps straight onto the Dev Kit feel tiers |
| **Edge ripple** (a sine wobble added to the blob's distance) | Common shader trick | The "alive" undulation from v1's vision | Nearly free in the shader |
| **Animated blend radius** (neck grows/shrinks over time) | Metaball demos, LocoRoco-like split/merge ([LocoRoco design talk](https://www.gamedeveloper.com/game-platforms/develop-uk-i-locoroco-i-s-kouno-talks-innovative-design)) | "Reaching", "slurp together", stringy snap on separation | Free; it's one number per pair/cell |

**Reference-game notes (what to steal):**
- **Puyo Puyo** — the gold standard for *readable* goo in a grid puzzle: blobs connect only orthogonally, connected blobs visibly fuse, landing squash, a little bounce, pop = flash + burst. Proof you don't need physics for goo to feel great.
- **World of Goo** — personality comes from eyes, wobble and the *stretchy strands* between balls, not fluid sim. Bridges between same-colour goop are the "reaching" moment.
- **JellyCar / Gish** — jiggle on impact is the joy; but it's the *core mechanic* there. In Goops the grid is the mechanic, so we only need the look of jiggle.
- **LocoRoco** — split/merge with smooth necks; cute because the outline is always a smooth curve with a highlight.
- **Tetris Effect** — pieces are rigid, but landing/clear feedback (light, particles, sound) makes them feel alive. Juice > simulation.
- **Splatoon / Slime Rancher** — "wet" comes from a sharp specular highlight, rim darkening and a slightly translucent inner glow. Lighting sells wetness more than shape does.
- **Suika** — the jump-cut merge Muzzy explicitly rejected; good counter-example.

## 4. Directions for the remake

All four share **Principle 1: the grid rules never read from the goo.** The goo is a render layer that eases toward what the grid says.

### Direction A — "Goo shader": SDF blobs + springy poses *(recommended)*
- **Player sees/feels:** every cell is a soft rounded blob; same-colour neighbours fuse into one glossy skin with soft necks (blend grows over ~150ms after lock — the "slurp"); the falling piece stretches slightly as it drops, squashes and wobbles on landing, overshoots a touch on rotate; locked goop breathes with a faint ripple; fill/ready-to-pop is a glow + pulse; pops pinch the neck, burst into droplets that are themselves tiny blobs.
- **How it's built:** game logic stays pure grid. Each frame a small typed array lists visible cells (x, y, colour, pose: scaleX, scaleY, offset, wobble, blend). A single WebGL2 full-screen shader (plain WebGL or an R3F plane) draws rounded-box SDFs, smooth-unions same colour only (different colours keep a crisp seam), and shades them wet (highlight from the distance gradient, darker rim, inner glow). Motion is a handful of damped springs per piece/group, kicked by game events (land, rotate, merge, pop) from the event bus — the same feel tiers as the rest of the game. All numbers in `content/goo.json` with a Dev Kit panel.
- **Phone cost:** low; one draw call. Cap pixel ratio, look up only the nearby cells per pixel. Should hold 60fps on mid phones (prove it in the sketch).
- **Build risk:** medium — shader work is new to the project, but it's ~150 lines and has few knobs. No physics solver to destabilise.
- **vs v1:** keeps every v1 cue (reach, shared skin, jiggle, alive, pop), drops the per-vertex solver and the SVG filter, can't touch the rules. Crisper and wetter-looking than v1.

### Direction B — "v1, done right": keep Verlet outlines, render on canvas/WebGL
- **Sees/feels:** closest to v1 — true per-vertex jiggle, real tendrils.
- **Built:** keep the outline-per-group soft body but strictly visual (never sets the piece's row), render outlines to canvas/WebGL instead of SVG+React, replace the blur filter with SDF-of-polygon or plain fill.
- **Cost:** medium (CPU solver on phones). **Risk:** medium-high — rotation/tank-spin/wrap jumps and the ~20 sliders come back.
- **vs v1:** fixes the coupling and the filter cost; keeps the tuning burden.

### Direction C — "Puyo goo": tiles + bridges + juice (no shader)
- **Sees/feels:** chunky, readable, toy-like goo; cells are rounded blobs, same-colour neighbours drawn with filled bridges; squash/stretch springs per piece; drips and droplets as sprites.
- **Built:** canvas 2D or SVG with prebuilt connected shapes (16 neighbour cases), springs on pose numbers.
- **Cost:** very low. **Risk:** low. **vs v1:** much less "blubbery"; the neck/stretch is faked, not continuous. Ideal as the **low-power fallback** for Direction A.

### Direction D — "A + strands" (stretch goal on top of A)
Add a few real springs only where it shows: **goo strands** when a group separates or loose goop starts to fall (a neck that thins and snaps — World of Goo / honey drip), and two-point drips on pops. Still visual-only; strands are just extra SDF capsules whose length/thickness come from a tiny spring sim. Add after A proves itself.

### Principle candidates
1. **Rules never read the goo** (see §2). Goo can lag, overshoot and wobble; it never decides a lock, a collision or a ghost position.
2. **Goo can be turned off** (or swapped to Direction C) with zero gameplay change — gives a free low-power mode and a test.
3. **Same colour fuses, different colour keeps a crisp seam** — readability first; the player must always see which cells are one group.
4. **Goo motion = springs on a few numbers**, kicked by events, sized by the shared feel tiers (small/medium/big) — same intention → same motion.
5. **One draw call for all goo**, no per-frame React re-render; mutate a buffer in the frame loop.
6. **All goo numbers in `content/goo.json`** with a Dev Kit panel: blend radius, roundness, wobble stiffness/damping, ripple size/speed, highlight strength, neck-grow time.

## 5. The cheap sketch to *feel* it (one HTML file, ~250 lines, no build)

**`goo-sketch.html`** — a 12×16 grid on a phone screen, plain WebGL2, no libraries.
- Tap a column to drop a random 4-cell piece in one of 4 colours; swipe to rotate. Pieces fall on a simple grid timer (rules = grid only).
- Shader: rounded-box SDF per cell, smooth union per colour, wet shading (highlight, rim, inner glow), faint edge ripple.
- Springs: landing squash + wobble, stretch while falling fast, overshoot on rotate, neck "slurp" when same colours touch.
- Double-tap a group of 4+ to pop it: neck pinch → burst into droplet blobs; cells above drop with a short drip-then-fall.
- Sliders on screen for 5 knobs (blend radius, wobble stiffness, wobble damping, ripple, highlight) + an **FPS counter** + a toggle to **"Puyo mode"** (Direction C) to compare side by side.
- Test on Muzzy's phone via the LAN/phone link; success = "that feels gooier than v1" **and** a steady 60fps with a full board.

Single file, throwaway, lives in `prototypes/` (or scratch) — it answers "does A feel right and run on a phone?" before any GDD/TDD lock-in.

## Sources
- v1: `.planning/research/v1/SOFTBODY-VISION.md`, `PRD.md` (Goo Filter, Soft-Body Physics, Mobile Rendering), `.planning/archive/gsd/FIX-I-PIECE-LOCKING.md`, `core/softBody/*`, `hooks/useSoftBodyPhysics.ts`, `core/GameEngine.ts` (`syncActivePieceFromPhysics`), `Game.tsx:125`, `prototypes/SoftBodyProto1–9.tsx`.
- Smooth-min / SDFs: [Inigo Quilez — smooth minimum](https://iquilezles.org/articles/smin/), [2D distance functions](https://iquilezles.org/articles/distfunctions2d/), [GameDev.net — smooth SDF blending](https://gamedev.net/shaderlab/28-smooth-sdf-blending/)
- Metaballs: [Jamie Wong — marching squares](https://jamie-wong.com/2014/08/19/metaballs-and-marching-squares), [Jamie Wong — WebGL](https://jamie-wong.com/2016/07/06/metaballs-and-webgl), [Codrops — 2D metaballs in WebGL2](https://tympanus.net/codrops/2021/01/19/drawing-2d-metaballs-with-webgl2/), [Codrops — droplet metaballs (Three.js)](https://tympanus.net/codrops/2025/06/09/how-to-create-interactive-droplet-like-metaballs-with-three-js-and-glsl/), [Varun Vachhar — metaballs](https://varun.ca/metaballs/)
- SVG goo filter + phone problems: [CSS-Tricks gooey effect](https://css-tricks.com/gooey-effect/), [WebKit bug 191197](https://bugs.webkit.org/show_bug.cgi?id=191197), [WebKit bug 287982](https://bugs.webkit.org/show_bug.cgi?id=287982)
- Soft bodies: [JellyCar deep dive](https://gamedeveloper.com/programming/deep-dive-the-soft-body-physics-of-jelly-car-explained), [Soft-body dynamics (Wikipedia)](https://en.wikipedia.org/wiki/Soft-body_dynamics), [lisyarus — 2D soft body](https://lisyarus.github.io/blog/posts/soft-body-physics.html), [LocoRoco design talk](https://www.gamedeveloper.com/game-platforms/develop-uk-i-locoroco-i-s-kouno-talks-innovative-design), [LocoRoco physics discussion](https://www.allegro.cc/forums/print-thread/587860)
- Game feel: [Springs explained (Game Developer)](https://www.gamedeveloper.com/blogs/instant-game-feel---springs-explained), [Juicy simple effects (itch.io)](https://itch.io/blog/1059831/making-a-game-feel-juicy-with-simple-effects)
- Puyo-style connected tiles: [OpenGameArt connected blobs](https://opengameart.org/node/159474); mobile jelly puzzler example: [Jelly Field](https://apps.apple.com/us/app/-/id6473256797)
- World of Goo 2 liquid: [Shacknews preview](https://www.shacknews.com/article/139215/world-of-goo-2-preview-hands-on-impression)
