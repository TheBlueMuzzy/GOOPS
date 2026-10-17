# Goo look — the CodePens Muzzy sent (study notes)

*Written 2026-10-16 for /discover (goo look). Every pen was opened in a private test browser, poked (drag / click / hover) and screenshotted; all source code was read in full. Screenshots are in `pens/`.*

> **⚠ Open question: the "env grav 2.0 m/s² + much lower viscosity" pen is not in this list.**
> Muzzy said that on "that last thing", setting *env grav* to 2.0 m/s² and viscosity much lower "kinda felt good". I read the full source of all 10 pens below **and** `refs/viscous-jello-muzzy.html`: **none has an environment-gravity control in m/s²**. The only things close:
> - **TaminoMartinius "Fluid Business Card"** has *viscosity* sliders (one per layer: 0.15–0.8) but no gravity at all.
> - **viscous-jello-muzzy.html** has `GRAVITY = 0.15` (pixels per frame², not m/s²) and `VISCOSITY = 0.98`, hard-coded, no sliders.
> - **BadPinkChicken cloth** has `gravity: 0.2` hard-coded, no slider.
>
> So "that last thing" is probably a page Muzzy opened from one of these (e.g. a related pen, or chenglou's Pretext demos linked from the cloth pen). **Ask Muzzy: paste the link of the one with "env grav"** and it gets the same treatment (defaults vs grav 2.0 + low viscosity, side-by-side shots).
>
> What his note already tells us, whatever the pen: **less gravity + less damping = goo that drifts and keeps moving longer** — slower, floatier, more "alive", less "dead weight". In Goops terms that's one knob each for the *visual* layer: how hard the skin sags toward the grid position, and how quickly its wobble dies out.

**Licence:** CodePen's own docs say *"Public pens are automatically MIT licensed."* (blog.codepen.io/documentation/licensing). We will re-build the ideas in our own code, not paste pens in; credit authors in the TDD when an idea is used.

**Our first sketch, for comparison** (`sketches/goo-sketch.html`): SDF rounded cells + smooth-union necks + springs → reads as *beads on a string*. The pens below show why, and what to do instead (see "What to combine" at the end).

---

## 1. Triboi-Andrei — "Neon Fluid Simulation · Metaball Physics"
- **Link:** https://codepen.io/editor/Triboi-Andrei/pen/019f5e4c-ff66-7870-b241-e9546850e75f
- **Muzzy:** "this one, but without the obviously solid cores visible"
- **Shots:** [01 settled pool](pens/Triboi-Andrei-01.jpg) · [02 after 6 clicks](pens/Triboi-Andrei-02.jpg) · [03 new drops falling](pens/Triboi-Andrei-03.jpg)
- **What it does:** ~24 neon drops fall, bounce and pool at the bottom into one glowing lake. Click adds drops, hover pulls them.
- **How (the recipe):** plain canvas 2D, no library. Each drop is a dot with a radius. Every frame, for every pixel of a **low-res grid** (screen ÷ 4–5) it adds up each drop's "pull" `r² / distance²` (a classic **metaball field**). Where the sum ≥ 1 it's inside the goo; colour = the drops' colours averaged by their pull. Then the small image is stretched up to full screen with smoothing.
  ```js
  // Triboi-Andrei (MIT) — metaball field, per low-res pixel
  const inf = (b.r * b.r) / (dx*dx + dy*dy + 0.01);
  sum += inf;  wr += b.col[0] * inf; ...
  if (sum >= 1.0) {
    if      (sum < 1.8) glow = 1.75 - (sum - 1.0) * 0.94; // bright rim
    else if (sum < 5.0) glow = 1.05;
    else                glow = 0.80;                      // "dark core"  ← the solid cores
  } else if (sum >= 0.20) { /* soft neon aura outside the edge */ }
  ```
  Physics is minimal: gravity `0.014`, air drag `0.999`, wall bounce `0.55`. **Drops never push each other** — they just overlap, so the pool stays "one liquid".
- **Why it feels gooey:** the field makes one continuous surface — no seams, no necks to fake. The bright rim (`sum 1.0–1.8`) reads as surface tension.
- **The "solid cores" Muzzy dislikes** are exactly the **hard brightness steps** at sum = 1.8 and 5.0: wherever a drop's centre is, the sum shoots past 5 and you get a darker disc with a hard edge — you can literally see each drop's skeleton. **Fix:** make brightness a *smooth* curve of the field (e.g. `smoothstep`), or shade from the field's *slope* (fake 3D light) instead of its height, so the inside is one even body.
- **Phone cost:** CPU loop = pixels × drops. Fine at 24 drops on a tiny grid, but it's blocky (visible pixel stairs in shot 01) and grows fast. The same maths in a **WebGL fragment shader** costs nothing on a phone and is smooth.
- **Fit for Goops:** **High.** A field per colour, fed from the grid's cells, *is* "one continuous living goo". Colours must not blend (Goops' groups are per colour), so run one field per colour rather than averaging colours.

## 2. TaminoMartinius — "Fluid Business Card"
- **Link:** https://codepen.io/TaminoMartinius/pen/ogBYMxm
- **Muzzy:** "stiff jiggliness that is interesting if we go the more jello-vibe"
- **Shots:** [01](pens/TaminoMartinius-01.jpg) · [02 cursor pushing left edge](pens/TaminoMartinius-02.jpg) · [03 poke](pens/TaminoMartinius-03.jpg) · [04 snapped back](pens/TaminoMartinius-04.jpg)
- **What it does:** a business card whose edge is a liquid skin; the cursor pushes dents into it and it wobbles back. Three coloured layers sit on top of each other with different stiffness, so a dent shows grey/white "under-layers" peeking out.
- **How:** Konva.js (canvas) + dat.gui sliders. The outline is a ring of points **every 2 px** around a rounded rectangle. Each point has a **home** (its rest spot); every frame it's pulled home, pushed by the cursor, then its speed is multiplied by "viscosity" (really a damping factor). Drawn as one closed smooth curve (`tension 0.4`).
  ```js
  // TaminoMartinius (MIT) — per outline point, per frame
  const f = d * this.forceFactor;            // spring to home, forceFactor = 0.2
  point.vx += f * (dx / d);   point.vy += f * (dy / d);
  // + cursor push: mouseForce / distance, clamped to ±forceLimit
  point.vx *= layer.viscosity;               // 0.15 / 0.35 / 0.5 / 0.65 / 0.8 per layer
  point.vy *= layer.viscosity;
  point.x += point.vx;  point.y += point.vy;
  ```
  Defaults: `gap 2, radius 12, tension 0.4, forceFactor 0.2, hoverFactor 0`; layers (viscosity / mouseForce / forceLimit): 0.5/100/2, 0.65/150/3, 0.8/200/4.
- **Why it feels stiff-jello:** points **don't talk to each other** — no springs between neighbours, only "go home". With strong home pull and heavy damping (low "viscosity" number), dents are local and snap back fast with one small overshoot = *stiff gel*. Higher number (0.8) = slower, wobblier. Stacked layers with different numbers give a cheap "depth" wobble.
- **Phone cost:** very low (a few hundred points, simple maths). Could use fewer points (gap 4–6).
- **Fit for Goops:** **High** for the jello direction. Each goop group's outline = traced from the grid (v1 already traced outlines); every outline point's home = the grid edge. Land/rotate/move = an impulse to the points. "viscosity" + "forceFactor" = exactly the two tweakables for `content/`.

## 3. PavelDoGreat — "WebGL Fluid Simulation"
- **Link:** https://codepen.io/PavelDoGreat/pen/zdWzEL
- **Muzzy:** "GORGEOUS and super impressive, maybe there's something to learn"
- **Shots:** [01 idle](pens/PavelDoGreat-01.jpg) · [02 mid-drag](pens/PavelDoGreat-02.jpg) · [03 fading](pens/PavelDoGreat-03.jpg) *(headless browser = software WebGL, so colours look duller than on a real GPU)*
- **What it does:** real smoke/ink fluid; dragging injects colourful swirls that curl and fade.
- **How:** WebGL, everything on the GPU. Classic **"stable fluids"** (Jos Stam): a velocity texture and a dye texture; every frame: move stuff along the flow (advect) → add swirliness ("curl"/vorticity) → solve pressure (25 passes) so the fluid doesn't compress → subtract. Mouse = "splat" a blob of colour + push.
  ```js
  // PavelDoGreat (MIT) — the knobs
  DENSITY_DISSIPATION: 0.98, VELOCITY_DISSIPATION: 0.99,
  PRESSURE_DISSIPATION: 0.8, PRESSURE_ITERATIONS: 25,
  CURL: 30, SPLAT_RADIUS: 0.005
  ```
- **Why it's gorgeous:** the curl term keeps tiny whirls alive; dye is smeared, never has a hard edge. That's *smoke/ink*, not goo — there's no surface.
- **Phone cost:** high (≈30 full-screen GPU passes per frame); doable at reduced resolution, but a lot for a puzzle game.
- **Fit for Goops:** **Low as the goo itself** (no edges, colours mix, can't keep per-colour groups crisp). **What to learn:** (a) do the heavy lifting in a shader on low-res textures, (b) a **pop/clear burst** could splat into a small fluid layer *behind* the board for a gorgeous effect, (c) "dissipation" numbers are a nice, artist-readable way to say "how long motion lingers".

## 4. BadPinkChicken — "Pretext Demo" (cloth / obstacle / magnet)
- **Link:** https://codepen.io/editor/BadPinkChicken/pen/019dde05-dad1-7c89-8d49-769e3d56c80e (based on chenglou's Pretext)
- **Muzzy:** "interesting, more for cloth"
- **Shots:** [01 rest](pens/BadPinkChicken-01.jpg) · [02 dragging a letter](pens/BadPinkChicken-02.jpg) · [03 released, sagging back](pens/BadPinkChicken-03.jpg)
- **What it does:** a page of blackletter text hangs like cloth; drag any letter and the sheet stretches, folds, and drops back.
- **How:** a 32 × 26 grid of **Verlet** particles (position + previous position; velocity is implied) with links between neighbours. Each link only acts when it's **too short (below 45%) or too long (above 102%)** — in between it's slack. 6 solver passes per frame.
  ```js
  // BadPinkChicken (MIT) — a "slack" link: only corrects outside a band
  if (distSq < this.minLengthSq)      target = this.minLength;   // length * 0.45
  else if (distSq > this.maxLengthSq) target = this.maxLength;   // length * 1.02
  else return;                                                   // slack: do nothing
  const percent = (target - dist) / dist / 2;  // move both ends half-way
  ```
  Defaults: `gravity 0.2, damping 0.99, iterationsPerFrame 6`.
- **Why it feels like cloth:** links barely stretch (1.02) but crumple freely (0.45) — that asymmetric band is what cloth is. Goo is the opposite (stretches a lot, resists squash).
- **Phone cost:** low (~800 points × 6 passes).
- **Fit for Goops:** **Low–medium.** The *slack band* idea is useful though: a goo link that does nothing near rest and only pulls back when stretched far gives **lazy, saggy stretch** (good for "loose goop drips then rips": rip when stretch passes a max).

## 5. ElisNz — "Liquid"
- **Link:** https://codepen.io/ElisNz/pen/yyaOaNM
- **Muzzy:** "maybe something?"
- **Shots:** [01](pens/ElisNz-01.jpg) · [02 hovering orange](pens/ElisNz-02.jpg) · [03 later](pens/ElisNz-03.jpg)
- **What it does:** four blobby splats (orange, teal, purple, gold), each made of 12 bubbles that slowly morph; hover repels bubbles and they jiggle.
- **How:** no canvas — plain HTML divs inside **one SVG "goo" filter per colour**. Each bubble animates its own `border-radius` (organic lumpy shape) and a squash-and-stretch "wobbleSettle" keyframe on hover. The filter blurs everything and then cranks the alpha so only the blurred middle survives = shapes fuse.
  ```html
  <!-- ElisNz (MIT) — the goo filter, one per colour container -->
  <feGaussianBlur in="SourceGraphic" stdDeviation="10"/>
  <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 40 -9"/>
  <!-- new alpha = 40·A − 9 → anything above ~22% alpha becomes solid -->
  ```
  ```css
  /* wobbleSettle: decaying squash & stretch, 0.5s */
  20% {scaleX(1.1) scaleY(0.9)} 40% {scaleX(.95) scaleY(1.05)} 60% {scaleX(1.03) scaleY(.97)} 80% {scaleX(.99) scaleY(1.01)}
  ```
- **Why it feels gooey:** blur + hard threshold = surface tension (pieces merge with clean fillets, small drops cling then split). The **"light"** variant adds a radial-gradient highlight per bubble *under* the filter — a soft fake-3D sheen that survives the threshold. Very pretty.
- **Phone cost:** low-medium. SVG filters over small, separate areas are fine; over a whole animating board they can drop frames (especially iPhone Safari). Canvas/WebGL version of the same maths is safer.
- **Fit for Goops:** **High as a reference look** — this is roughly what v1 did, and it shows the **one-filter-per-colour** rule that keeps colours from fusing. The decaying squash keyframe is a ready-made "landing jiggle" curve.

## 6. Mamboleoo — "Portal gel"
- **Link:** https://codepen.io/Mamboleoo/pen/adjGom
- **Muzzy:** "the way these circles overlap and share a border and the internal overlapped lines go away"
- **Shots:** [01](pens/Mamboleoo-01.jpg) · [02 lots overlapping while moving the mouse](pens/Mamboleoo-02.jpg)
- **What it does:** outlined white circles float up; where they overlap there's only one outer outline — the inner lines vanish.
- **How:** a 3-line trick, no blur. Canvas blend mode **`"screen"`**: in screen mode, white wins over everything and black changes nothing. Each circle is filled white then stroked black (10 px). A later circle's white fill erases any earlier black line under it, and its own black line can't darken earlier white. So only the outline of the **union** survives.
  ```js
  // Mamboleoo (MIT)
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "white"; ctx.strokeStyle = "black"; ctx.lineWidth = 10;
  // per circle: ctx.arc(...); ctx.fill(); ctx.stroke();
  ```
- **Why it reads as gel:** one continuous ink outline around any cluster = "they're one thing now". The joins are still sharp V-notches (no fillet) — it's a *shared border*, not a merged *shape*.
- **Phone cost:** tiny.
- **Fit for Goops:** **Medium–high as a rule, not as code**: whatever we draw, **outline the union, never the parts**. In a field/threshold renderer this comes free: draw the outline as a thin band of the field (e.g. field between 1.0 and 1.15) so it automatically wraps the whole group. Only white-on-black works with the exact screen trick, so we'd use the field band.

## 7. q51 — "Loopy Goopy Shapes"
- **Link:** https://codepen.io/q51/pen/KKLybZ
- **Muzzy:** "maybe does a better job of that"
- **Shots:** [01 three circles stacked](pens/q51-01.jpg) · [02 dragged two together](pens/q51-02.jpg) · [03 pushed closer](pens/q51-03.jpg)
- **What it does:** three draggable white circles on black; as they near each other a smooth neck grows between them and they fuse into one peanut.
- **How:** pure CSS, the oldest goo trick: each circle has a big soft glow (`box-shadow: 0 0 50px 10px white`), and the **parent** has `filter: contrast(30)` on a black background. Contrast turns the soft glow into a hard edge; where two glows overlap they add up and cross the threshold sooner → a neck.
  ```css
  /* q51 (MIT) */
  .a { filter: contrast(30); background: black; }
  .b { border-radius: 50%; background: white; box-shadow: 0 0 50px 10px white; }
  ```
- **Why it's better at "sharing a border":** compare shots 02/03 with Mamboleoo — the join is a **smooth curved fillet** and the cluster really is one shape. The neck's thickness depends on distance → "reaching" for free.
- **Phone cost:** low for small areas; same SVG/CSS-filter caveat as ElisNz.
- **Fit for Goops:** **High as the idea** (= threshold of a soft field). The CSS contrast version only works with black backgrounds and wrecks colours (everything goes pure); the colour-safe version is the ElisNz/Techno `feColorMatrix` alpha threshold, or a shader.

## 8. satchmorun — "Just playing around"
- **Link:** https://codepen.io/satchmorun/pen/zxGYaG
- **Muzzy:** "stretchy quality, but it isn't great"
- **Shots:** [01](pens/satchmorun-01.jpg) · [02](pens/satchmorun-02.jpg) · [03](pens/satchmorun-03.jpg)
- **What it does:** 10 yellow balls bounce around; when two are at a middle distance (60–141 px apart) a pinched bridge is drawn between them, with motion trails.
- **How:** geometry, no blur: from each ball find the two **tangent points** toward the midpoint, then fill a shape made of two curves that pinch at the midpoint.
  ```js
  // satchmorun (MIT) — bridge between circles a and b
  const ta = a.tangentPoints(mx, my), tb = b.tangentPoints(mx, my);
  ctx.moveTo(ta[0].x, ta[0].y);
  ctx.quadraticCurveTo(mx, my, tb[1].x, tb[1].y);
  ctx.lineTo(tb[0].x, tb[0].y);
  ctx.quadraticCurveTo(mx, my, ta[1].x, ta[1].y);
  ```
- **Why "isn't great":** the bridge **pops on and off** at fixed distances, is the same thickness however far apart, and goes to a zero-width point — it reads as a drawn ribbon, not a material. That's also exactly why our sketch looked like beads: necks drawn between fixed bodies.
- **Phone cost:** tiny.
- **Fit for Goops:** **Low–medium.** Lesson: a stretch must **thin smoothly with distance** and **snap** with a little recoil, never pop in. Could be used only for long "loose goop" strings, with thickness = f(distance).

## 9. Techno-Tut — "gooey letter"
- **Link:** https://codepen.io/Techno-Tut/pen/NgMWYV
- **Muzzy:** "stringiness"
- **Shots:** [01 "I"](pens/Techno-Tut-01.jpg) · [02 morphing, a strand pinching off at the crossbar](pens/Techno-Tut-02.jpg) · [03 "A"](pens/Techno-Tut-03.jpg) · [04 back to "I"](pens/Techno-Tut-04.jpg)
- **What it does:** a white "I" splits into an "A" and back, with gooey strands forming and pinching off at the joins.
- **How:** CSS-animated white bars (rotate the legs ±21°, grow a crossbar) under the goo filter, **plus one trick**: `feBlend ... operator="atop"` lays the **original crisp shapes back on top** of the gooey version, so straight edges stay crisp and goo only shows at junctions and in the gaps. A second filter uses `feTurbulence` + `feDisplacementMap` (scale 100) to make a wobbly, noisy strand.
  ```html
  <!-- Techno-Tut (MIT) -->
  <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="a"/>
  <feColorMatrix in="a" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 33 -8" result="a"/>
  <feBlend in="SourceGraphic" in2="a" operator="atop"/>  <!-- crisp shape over goo -->
  ```
  Leg motion uses an overshooting ease `cubic-bezier(0.3, 1.65, 0.75, 0.84)`.
- **Why it's stringy:** when parts separate, the blurred field between them stays above threshold a little longer → a strand that thins and snaps. The overshoot ease adds springiness.
- **Phone cost:** low (small element). Same SVG filter caveat at board size.
- **Fit for Goops:** **High as an idea**: "crisp body + goo only where pieces meet or part" is a direct cure for both *beads-on-a-string* (bumpy straight runs) and *mush* (everything blurred). In a shader: straight runs come from the cell squares themselves; the field only adds fillets/strands.

## 10. crsten — "It's jello time"
- **Link:** https://codepen.io/crsten/pen/jbyQqZ
- **Muzzy:** "edge bounciness after being released from stretch"
- **Shots:** [01 rest](pens/crsten-01.jpg) · [02 pulled up](pens/crsten-02.jpg) · [03 140 ms after release — overshoots down](pens/crsten-03.jpg) · [04 settling](pens/crsten-04.jpg)
- **What it does:** drag the top of an orange jelly surface up into a peak; let go and it twangs back with an elastic overshoot.
- **How:** Snap.svg. The surface is one SVG path whose middle control point follows the pointer; on release, Snap animates the path back to flat over **1000 ms with `mina.elastic`** (an overshoot-and-ring easing). No physics at all.
  ```js
  // crsten (MIT)
  p.animate({ d: flatPathAtX }, 1000, mina.elastic);
  ```
- **Why it feels bouncy:** the elastic curve undershoots past rest (shot 03), comes back, and rings out — the classic damped spring. The shape is one smooth curve, so the whole edge moves as a single skin.
- **Phone cost:** tiny.
- **Fit for Goops:** **Medium–high as feel**: the landing/rotate "boing" = a damped-spring curve on the skin. We get the same with springs (Tamino) — this pen is a good *target* to tune against: ~1 s settle, one big overshoot, 2–3 small rings.

## Bonus — refs/viscous-jello-muzzy.html ("they absorb each other, and feel sticky")
Canvas circles with `GRAVITY 0.15`, damping `0.98`, bounce, all inside a wrapper with CSS `filter: blur(20px) contrast(30)` on a dark background (same family as q51). The *sticky absorbing* look is the blur-threshold field again; the bigger blur (20 px) means drops start reaching for each other from further away. (Note in file: `this.vy *= VISVISCOSITY = 0.99` is a typo that creates a stray global; harmless.)

---

## Ranking for Goops

| # | Pen | Technique | What Goops takes from it | Phone | Usefulness |
|---|---|---|---|---|---|
| 1 | Triboi-Andrei | metaball field + threshold (CPU) | **one continuous goo per colour**; rim light; *remove the stepped "core" bands* → smooth shading | low in a shader | ★★★★★ |
| 2 | TaminoMartinius | outline points + spring-to-home + damping | **stiff-jello jiggle** of the skin; two clear knobs (stiffness, damping) | very low | ★★★★★ |
| 3 | Techno-Tut | goo filter + crisp shape "atop" + noise strands | **crisp body, goo only at joins/partings** → cures beads-on-a-string; stringy pinch-off | low | ★★★★ |
| 4 | ElisNz | per-colour SVG goo filter + squash keyframes + sheen | look reference, **one filter per colour**, landing wobble curve, highlight sheen | low–med | ★★★★ |
| 5 | q51 | soft glow + contrast threshold | smooth fillet joins; neck thickness grows with closeness ("reaching") | low | ★★★½ |
| 6 | crsten | elastic easing on a path | target curve for **release/landing boing** (~1 s, one overshoot, 2–3 rings) | tiny | ★★★ |
| 7 | Mamboleoo | screen-blend union outline | rule: **outline the union, never the parts** | tiny | ★★★ |
| 8 | PavelDoGreat | GPU stable fluids | shader thinking; maybe a pop-burst ink layer behind the board | high | ★★ |
| 9 | BadPinkChicken | Verlet cloth with slack links | slack band idea for drips that sag then rip | low | ★★ |
| 10 | satchmorun | tangent-point bridges | what *not* to do: necks that pop on/off with no thinning | tiny | ★½ |

## What to combine (the 4 techniques worth stacking)

1. **Per-colour field + threshold, in one WebGL shader** (Triboi, q51, ElisNz). Each colour gets its own field from the grid cells; inside = goo, rim = bright edge band, outside = nothing. Colours never mix because each is its own field. Shade the inside **smoothly** (field slope → fake light + ElisNz-style sheen) — no hard steps, so **no visible cores**.
2. **Crisp cells as the field source, goo only at joins** (Techno-Tut). Feed the field with *rounded squares* that tile flat, not circles per cell — straight runs stay straight, and the threshold adds fillets at corners and strands where pieces part. This is the direct fix for our sketch's beads-on-a-string.
3. **Spring-to-home skin points for jiggle** (TaminoMartinius, tuned toward crsten's curve). The shader's shape is *displaced* by a small set of points per group that spring to their grid home with damping. Two `content/` knobs: **stiffness** (forceFactor ~0.2) and **damping** (Tamino's "viscosity" 0.35–0.8). Muzzy's "env grav 2.0 + lower viscosity" note points at the floaty/alive end of these knobs.
4. **Stretch that thins, then snaps** (q51 + Techno-Tut, with BadPink's slack band for long drips). Same-colour goop near each other grows a neck whose thickness falls with distance; parting goop leaves a strand that thins and pinches off with a little recoil — never a bridge that pops on/off (satchmorun).
5. *(Optional polish)* **Union outline** as a thin field band (Mamboleoo's rule) if the art style wants ink lines, and a **fluid splat burst** behind the board on big pops (Pavel) if the budget allows.

All of this stays **visual only**: the grid owns positions and rules; the goo layer reads the grid and wobbles around it.
