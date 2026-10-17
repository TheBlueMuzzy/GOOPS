# Goo lab: shared brief for sketches L1–L4 (2026-10-16)

Every lab sketch follows this brief, so Muzzy compares **only the goo**. Read first: `claude-notes.md`, `techniques.md`, `videos.md`, `codepens.md` (this folder). Starting point for board and controls: `../sketches/goo-sketch.html` (sketch 1), whose grid logic, input and layout are fine. Its *goo* is what failed: "wasn't super great", beads on a string.

## Why sketch 1 failed (fix this in every sketch)
- **Shape, bulge, shine and wobble all came per cell**, not from the group: one highlight dome per cell, 0.92-size near-round cells, a fuse that only made necks, and per-cell checkerboard wobble.
- **Every sketch must take shape, bulge, shine and motion from the whole same-colour group.** A big group = one mass, one dome, one shine, with no internal lines and no visible cores.

## Same in every sketch
- **One self-contained file** in `.planning/research/sketches/` (plain WebGL2 + JS, no libraries, no build). Name: `lab-L<n>-<slug>.html`.
- **Head:** `<title>L<n>: <name></title>` and `<meta name="description" content="<one sentence: the technique and what to look for>">`. The planner's Sketches tab uses these.
- **Rules = a plain grid, unchanged from sketch 1:** 10 wide, rows fill the screen, 5 colours (red, blue, green, yellow, purple), falling tetrominoes, tap a same-colour group of 4+ to zap it, cells above fall.
  - The goo layer reads the grid plus events (spawn, move, rotate, lock, zap, fall) and **never writes back**.
  - Keep sketch 1's controls: tap the piece to rotate, tap a side to move, swipe down / ▼ to drop, the ◀ ⟳ ▼ ▶ buttons, the keyboard, and Fill / Reset in the top bar.
- **Layout:** phone portrait first with no dead band, a 16px side gutter, safe areas respected, and desktop centred. Dark tank background (`#05070d`-ish).
- **Knobs panel** (top-bar "Knobs" button, collapsible, over the board). All values sit in one `const GOO = {...}` at the top of the script. Use **these names** where they apply (5–8 sliders max per sketch):
  - Look: `merge` (beads ↔ one mass), `threshold` (fatter ↔ thinner), `bulge` (dome height), `translucency`, `absorb` (thin clear ↔ thick saturated), `wetness` (shine + rim), `fresnel`
  - Motion: `gravity` (m/s², default **2.0**: Muzzy liked low gravity), `viscosity` (default **low**: Muzzy liked it much lower), `stiffness`, `wobble`
- **Colours stay separate:** same colours fuse, and different colours meet at a clean seam. Never blend or mix colours.
- **Zap:** goo drains or fades away (shrinks + fades, maybe droplets). Never an instant pop.
- **FPS counter** at top left (one-second average). Target 60 on a phone with a full board.
- **Verify before reporting:** Playwright with its bundled Chromium (`require('C:/Users/Muzzy/Documents/dev/games/roll-better/node_modules/playwright-core')`; never the user's own Chrome; close only browsers you start). At 390×844, capture empty, a few pieces, a full board, mid-zap, after the zap, the Knobs panel, and desktop 1280×800, into `.planning/research/sketches/shots/L<n>-*.png`. **Look at every screenshot yourself** and fix what reads wrong:
  - visible beads
  - seams inside a group
  - colours bleeding into each other
  - black screen
  - UI touching edges

  Report the headless FPS (real GPU) and the console errors (must be none).
- Don't commit. Don't edit any other file.

## The four sketches
- **L1 Pillow SDF:** sketch 1 done right. Full-size cells; a group distance field (or a larger, order-independent smooth-min) so the group's *outline* is rounded rather than each cell; bulge measured from the group's edge inward (one pillow per group); one highlight per group; group-level wobble (the whole group squashes as one). Question it answers: was it just the shading? Knobs: merge, bulge, wetness, fresnel, stiffness, wobble.
- **L2 Splat goo (metaballs):** each cell (and each falling-piece cell) splats a soft kernel (plus Splatoon-style **capsules between same-colour neighbours**, so no inner dimples) into a half-res float texture, one channel per colour (RGBA = 4 colours + a second texture, or 2 passes). A full-res pass applies a `smoothstep` threshold and "strongest colour wins" (clean seams). The field gradient is the normal, giving a wet specular, a fresnel rim, and translucency/absorb from field strength = thickness; smooth inside shading, so **no cores**. Splat positions ride springs (squash on land, slurp on merge, drain on zap). Knobs: merge, threshold, bulge, translucency, absorb, wetness, fresnel, wobble.
- **L3 Particle goo:** Muzzy's idea. Each grid cell owns ~8 particles on a weak **home spring** to its cell spot. Same-colour particles have cohesion (sticky absorb); other colours repel slightly.
  - **Motion:** gravity 2.0 m/s² and low viscosity, so it's floaty and sloshy.
  - **Falling piece:** particles trail the piece and stretch.
  - **Landing:** they overshoot, squash and settle.
  - **Zap:** home springs release, then a burst, then the goo drains or fades. Use Frank's drip rule: hanging goo ignores gravity until it has stretched about 2 radii, then lets go.
  - **Render:** with L2's field renderer (splat particles → blur/threshold → wet shading), capsules between bonded particles become strings that thin and snap.

  Knobs: gravity, viscosity, stiffness (home spring), merge (cohesion), threshold, wetness, wobble.
- **L4 Jelly:** the stiff-jello vibe (Tamino pen; INSYDIUM springs). Each same-colour group is one soft body.
  - **Body:** an outline ring of points around the group's shape with shape matching (spring back to the rest shape = the grid shape, plus home springs), so it jiggles as one.
  - **Look:** gentle, edge-glossy jelly with translucency.
  - **Release:** crsten's elastic ease when stretch is released.
  - **Merge:** merging two groups re-forms one body with a wobble.

  Knobs: stiffness, viscosity (damping), wobble, gravity, translucency, wetness.
