# Soft Body Goop (SBG) Vision Document

**Created:** 2026-01-30
**Branch:** `soft-body-experiment`
**Status:** Pre-research, vision documented

---

## The Dream

Transform the current flat grid-based goop visuals into physics-responsive soft body goop that:
- Jiggles and responds to movement, rotation, and collision
- Has a goopy outer membrane that "reaches out" to connect with same-colored neighbors
- Merges membranes smoothly when adjacent (not jump-cut like Suika game)
- Feels like stiff jello with a thick, viscous outer layer

**This is the ultimate polish for the game. It will sell the game.**

---

## The Two-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│  DATA LAYER (invisible)                                 │
│  ├── Grid-based positions (unchanged from current game) │
│  ├── Collision detection (cell occupancy)               │
│  ├── Game rules (locking, popping, grouping, etc.)     │
│  └── Acts as "goal position" for render layer          │
│                                                         │
│  Think: The mouse cursor that soft body follows         │
└─────────────────────────────────────────────────────────┘
                          ↓
              Springs toward / follows
                          ↓
┌─────────────────────────────────────────────────────────┐
│  RENDER LAYER (visible SBG)                             │
│  ├── Soft body with physics vertices around perimeter   │
│  ├── Springs toward data layer position                 │
│  ├── Can overshoot, bounce back, squish on collision   │
│  ├── Orientation matches data layer (rotation)          │
│  ├── Vertices attract like-colored neighbor vertices    │
│  └── Smooth curve rendered through vertices             │
└─────────────────────────────────────────────────────────┘
```

**Key insight:** The data layer (current game) stays unchanged. The SBG render layer is purely visual, following the data layer like a soft body follows a mouse cursor in those CodePen demos.

---

## The Goop Feel

### Two Components

1. **Semi-stiff core** — Like firm jello, maintains 99% of volume/shape. This is effectively the data layer cell position.

2. **Goopy outer layer** — Like blubber, thick and viscous. Made of physics vertices connected by springs. This is what jiggles and merges.

### Undulation

The outer layer constantly undulates with:
- Small magnitude, low frequency
- Two waves traveling in opposite directions around the surface
- Random slight changes to mode and magnitude
- Subtle enough to feel alive, not so much it looks like fluid or noisy

### The Feel Words
- Stiff gel / jello
- Blubber — thick, viscous
- Goopy, blobby, curvy (never sharp corners)
- Almost alive
- Gummy (vertices attract each other like sticky surfaces)

---

## Vertex-to-Vertex Attraction System

### The Core Mechanic

Each cell's SBG has **12 vertices** distributed around its perimeter (one every 30°).

When vertices from **same-colored** SBGs get within range (~1/4 to 1/2 cell distance, tweakable):
- A spring forms between them
- Both vertices pull toward each other (mutual attraction)
- Creates the "reaching out" / "stretching to connect" visual

```
Block A (red)              Block B (red)
    ┌───┐                      ┌───┐
    │   │←── SBG vertices ──→  │   │
    └───┘                      └───┘
      v1 ←─── attraction ───→ v2
           spring contracts
           when in range
```

### Dynamic Goal Tracking

As pieces move, vertex attractions shift naturally:
- v1 attracted to v2 (closest same-color vertex)
- Piece moves, v1 now closer to v3
- Attraction naturally shifts (mutual gravity)
- No explicit "goal switching" — it's continuous based on proximity

### Performance Reality

Not as expensive as it sounds:
- Only falling piece checks against locked pieces
- Only same-colored neighbors (usually 2-3 cells max)
- Only within ~1.5-2 cell range
- Only outer vertices (12 per cell)

**Actual math:** 12 vertices × ~3 same-color neighbors × 12 vertices = ~432 checks per frame. Manageable.

Once locked, pieces don't check anymore — they're settled.

---

## Merge Behavior

### The Trigger

Merging is **emergent from physics**, not pre-determined:

1. During fall: vertices from adjacent same-colored cells attract via springs
2. On lock: data layer snaps to grid, SBG follows
3. Attracted vertices naturally slide toward each other
4. When two vertices occupy nearly the same space (within ε threshold) → merge candidates
5. Merge: one vertex remains, shared by both SBG outlines, spring removed

```
Frame N:   A1 ●────────● B1   (spring pulls them together)
Frame N+1: A1 ●──────● B1
Frame N+2: A1 ●────● B1
Frame N+3: A1 ●──● B1
Frame N+4: A1 ●● B1           (within ε threshold)
Frame N+5: A1●B1              (merged into single vertex)
```

### Critical: NO JUMP CUT

The Suika/watermelon game does: two shapes touch → both disappear → new shape appears. **NOT THIS.**

Our merge: vertices slide together smoothly, membrane becomes shared, cores remain distinct inside.

### Edge Case: Vertices Don't Quite Meet

If damping settles vertices just apart from threshold:
- Run "cleanup pass" after motion settles
- Merge any vertices within threshold
- Only happens after motion stops, so not jarring

---

## Rendering Approach

### Smooth Curves Through Physics Vertices

```
Physics vertices:    •    •    •    •    •
                      \  /  \  /  \  /
Rendered curve:        ╲╱    ╲╱    ╲╱
                       smooth bezier/catmull-rom spline
```

**Why this approach:**
- Vertices respond to physics (jiggle, attraction, collision)
- Curve gives smooth visual (no jagged polygon edges)
- Can render as **outline only** (ghost piece)
- Can render as **filled** (normal piece, locked goop)
- Can add **glow/effects** (ready-to-pop state)
- Works with all current game features (wild rainbow, split-color, etc.)

**Not using metaball math** — metaballs aren't physical objects, just mathematical surfaces. We need physics-responsive vertices.

---

## Rotation Handling

### The Challenge

Current game: pieces rotate 90° instantly.
Soft bodies: moving too fast breaks springs, causes explosion.

### The Solution

```
Each vertex has:
├── homeOffset: fixed angle relative to core center (e.g., 0°, 30°, 60°...)
├── actualPosition: current physics position
└── Spring: actualPosition → homePosition (derived from homeOffset + core position)

On 90° rotation:
├── homeOffset rotates instantly with data layer
├── actualPosition springs toward new home
└── Creates brief squish/lag effect
```

### Spam Prevention

If user spams rotate while spring still settling:
- Option A: Spring stiff enough to catch up within ~100-150ms
- Option B: Snap actualPosition to homeOffset before applying new rotation (resets lag)

**Goal:** Each rotation gets brief squish, but lag doesn't accumulate infinitely.

---

## Collision Jiggle

### The Vision

When falling piece hits locked goop or ground:
- Doesn't stop dead
- Has carrythrough (goes slightly further)
- Bounces back (spring response)
- Settles with damping

Like two jiggly things colliding.

### Implementation

Data layer: stops at grid position (normal collision)
Render layer: SBG overshoots, springs back to data position

```
Data position:     ────────●──────────
                           │
SBG position:      ────────┼──●←─●──── (overshoot, spring back, settle)
                           │
Time →
```

---

## Corrupted Pieces & Loose Goop

### Corrupted Pieces

Corner-connected cells (not edge-connected). Currently render as one piece.

**SBG approach:**
- All cells wrapped in one SBG membrane (connected by goopy outer layer)
- On lock, if cells separate (corner connection breaks):
  - SBG must "tear" at the connection
  - Each fragment becomes its own SBG
  - Fragments fall as loose goop

### Loose Goop

Individual cells that fall after breaking apart.

**SBG approach:**
- Each loose cell is its own small SBG
- Falls with jiggle
- Merges with same-colored locked goop on landing
- Same vertex attraction system applies

---

## Current Game Features to Preserve

| Feature | SBG Implication |
|---------|-----------------|
| Ghost piece (outline) | Render SBG curve as outline only, no fill |
| Ready-to-pop glow | Add glow effect to SBG fill |
| Wild rainbow cycling | Color cycles applied to SBG fill |
| Split-color pieces | Different fill colors per cell within same piece SBG |
| Lock delay | Visual feedback during countdown (maybe pulse?) |
| Sealing goop glow | isSealingGoop flag triggers glow on that cell's SBG |

---

## Alternative Approach: Field-Based Attraction

Instead of explicit vertex-to-vertex springs, use continuous attraction fields.

```
Each same-colored block emits an "attraction field"
Field strength falls off with distance (inverse square)
SBG vertices feel combined field from all nearby same-colored blocks
Vertices pulled toward field sources
```

**Pros:**
- No discrete spring creation/destruction
- Multiple influences blend naturally (continuous)
- Less bookkeeping
- Might feel more "organic"

**Cons:**
- Less direct control over which vertices connect
- Might not create the sharp "reaching" effect
- Could feel floaty instead of gummy

**Plan:** Test both approaches, compare results.

---

## Decisions Made

| Aspect | Decision | Reasoning |
|--------|----------|-----------|
| Vertices per cell | 12 | One every 30°, smooth enough for curves |
| Rendering | Smooth curve through vertices | Allows outline/fill modes, physics-responsive |
| Attraction range | ~1/4 cell distance (tweakable) | Close enough to feel like reaching |
| Merge detection | Emergent from physics | Vertices that end up close = merge candidates |
| Merge behavior | Slide together (Option B) | Smooth, no jump cut |
| Rotation | Home position rotates instantly, actual springs to follow | Brief squish effect |
| Rotation spam | Stiff spring or snap-reset | Prevents lag accumulation |
| Architecture | Data layer unchanged, SBG is visual-only | Low risk, game logic stays stable |

---

## CodePen Examples (User Found)

These show various soft-body techniques but none do the full merge vision:

1. **https://codepen.io/TC5550/pen/mdeqpOV** — Pressure-based soft body with springs
2. **https://codepen.io/mraak/pen/QaLdgQ** — Matter.js soft body with sprites
3. **https://codepen.io/Soul-energy/pen/poQXRRP** — Shape-matching soft body (SoftBox)
4. **https://codepen.io/Gioda34/pen/raVbLGb** — Matter.js connected soft bodies

User also shared source code for these in conversation — reference if needed.

---

## Research Directions

Before implementation, investigate:

1. **Soft body vertex-to-vertex attraction** — water droplet simulations, gummy/sticky physics
2. **CSS/SVG blob merging effects** — the "reaching" visual as shapes approach
3. **Field-based attraction** — continuous field vs discrete springs
4. **Smooth curve rendering** — bezier vs catmull-rom through physics points
5. **Mobile-portable physics** — what works on APK/iOS, not just browser
6. **Spring parameter tuning** — stiffness/damping for "gummy" feel
7. **JellyCar techniques** — shape matching, collision response

---

## Visual References

| Reference | What It Shows | Relevance |
|-----------|---------------|-----------|
| [Varun Vachhar Metaballs](https://varun.ca/metaballs/) | Membrane "reaching" as circles approach | Best visual match for merge effect |
| [Inigo Quilez smooth-min](https://iquilezles.org/articles/smin/) | Math for controlling blend softness | Parameter tuning reference |
| [Blob Family Demo](https://slsdo.github.io/blob-family/) | Physics + blob rendering combined | Interactive reference |
| [JellyCar Deep Dive](https://www.gamedeveloper.com/programming/deep-dive-the-soft-body-physics-of-jelly-car-explained) | Collision jiggle, shape matching | Physics techniques |
| LocoRoco (PSP game) | Split/merge blob mechanics | Inspiration (but does full merge, not shared membrane) |

---

## What Doesn't Exist (The Gap)

After extensive research, no existing implementation does:
- Separate rigid cores with shared continuous membrane
- Multiple distinct entities enclosed in one organic skin
- The "conjoined organisms" effect

**This is novel.** We're building something new.

---

## Mobile Considerations

Game will eventually be APK/iOS app.

**Implications:**
- Avoid browser-specific APIs
- Core physics logic should be portable (or easily rewritten)
- Canvas/WebGL likely better than SVG for performance
- Consider: physics logic in portable language, rendering platform-specific

---

---

# RESEARCH FINDINGS (2026-01-30)

## 1. Physics Deep-Dive: Blob Physics & Spring Parameters

### Core Architecture: Mass-Spring + Verlet Integration

**Best approach for Goops:**
- **12 Verlet particles** per goop cell (matches vision)
- **Verlet integration** preferred over Euler (stable, implicit velocity, easy constraints)
- **Pressure-based** volume preservation using gas law (smaller area = higher outward force)

**Verlet Integration Formula:**
```
newPosition = currentPosition + (currentPosition - previousPosition) + acceleration * dt²
previousPosition = currentPosition
currentPosition = newPosition
```

**Why Verlet:** When a constraint is violated, just move the particle back. Velocity auto-adjusts because it's derived from position difference.

### The Gummy Feel: Damping Ratio (ζ)

The damping ratio controls everything:

| Zeta (ζ) | Feel |
|----------|------|
| 0.3-0.5 | Bouncy jelly, lots of wobble |
| **0.5-0.7** | **Gummy/jelly with some jiggle** ← TARGET |
| 0.7-0.9 | Firm gummy, minimal overshoot |
| 1.0 | No oscillation (critically damped) |

**Concrete starting values:**
```typescript
const DAMPING_RATIO = 0.6;        // ζ - controls wobble
const SPRING_STIFFNESS = 100-150; // k - resistance to deformation
const MASS = 1.0;                 // m - uniform for all vertices
const VERLET_DAMPING = 0.99;      // velocity retention per frame
const CONSTRAINT_ITERATIONS = 4;  // shape retention passes
```

**Critical damping formula:**
```
b_critical = 2 * sqrt(m * k)
b = ζ * b_critical
```

### Key Physics Formulas

```typescript
// Spring force (Hooke's Law + damping)
F = -k * (length - restLength) - b * velocity

// Pressure force (gas law for volume preservation)
pressure = targetPressure * (restArea / currentArea)
F_pressure = pressure * edgeLength * outwardNormal
```

### Spring Topology for Stability

For each blob cell:
1. **Ring springs:** Connect adjacent vertices (structural)
2. **Cross springs:** Connect opposite vertices (prevents collapse)
3. **Pressure:** Maintains volume when squished

### Research Sources
- [Gaffer on Games - Spring Physics](https://gafferongames.com/post/spring_physics/)
- [lisyarus blog - 2D Soft Body](https://lisyarus.github.io/blog/posts/soft-body-physics.html)
- [Blob Family Demo](https://slsdo.github.io/blob-family/)
- [JellyCar Deep Dive](https://www.gamedeveloper.com/programming/deep-dive-the-soft-body-physics-of-jelly-car-explained)

---

## 2. Rendering Deep-Dive: Smooth Curves & Membrane

### Winner: Catmull-Rom → Bezier Conversion

**Why Catmull-Rom for blobs:**
- Curve **passes through** every physics vertex (unlike Bezier which is pulled toward)
- Handles closed loops naturally
- Physics vertices = control points directly (no derivation needed)

**Why convert to Bezier:**
- Canvas/SVG only natively support `bezierCurveTo()`
- GPU accelerated rendering
- One-time cheap conversion

### The Conversion Formula (Core Implementation)

```typescript
// For segment P1→P2, given 4 consecutive points P0,P1,P2,P3
function catmullRomToBezier(p0, p1, p2, p3) {
  return {
    start: p1,
    cp1: {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6
    },
    cp2: {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6
    },
    end: p2
  };
}
```

### Complete Blob Outline Renderer

```typescript
function renderBlobOutline(ctx: CanvasRenderingContext2D, vertices: Point[]): void {
  const n = vertices.length;
  if (n < 3) return;

  ctx.beginPath();
  ctx.moveTo(vertices[0].x, vertices[0].y);

  for (let i = 0; i < n; i++) {
    // Wrap indices for closed loop
    const p0 = vertices[(i - 1 + n) % n];
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];
    const p3 = vertices[(i + 2) % n];

    // Catmull-Rom to Bezier control points
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
```

### Alpha Parameter (Centripetal vs Uniform)

| Alpha | Name | Use Case |
|-------|------|----------|
| 0 | Uniform | Fast, good for evenly-spaced points |
| **0.5** | **Centripetal** | No cusps, best for organic shapes |
| 1 | Chordal | Very tight to points |

**For 12 evenly-spaced blob vertices:** Uniform (α=0) is fine and faster.
**If deformation causes artifacts:** Switch to centripetal (α=0.5).

### Metaball-Style Membrane: SVG Gooey Filter

**Recommended for visual merging between same-color goops:**

```html
<svg style="position: absolute; width: 0; height: 0;">
  <defs>
    <filter id="goo">
      <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
      <feColorMatrix in="blur" mode="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 19 -9" result="goo"/>
      <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
    </filter>
  </defs>
</svg>
```

**Apply per-color group:**
```jsx
<div style={{ filter: 'url(#goo)' }}>
  {samColorCells.map(cell => <BlobCell />)}
</div>
```

**Tuning:**
- `stdDeviation`: Blur radius (5-12 for merge distance)
- Matrix `19 -9`: Alpha threshold (higher first number = sharper, lower second = more merge)

### Research Sources
- [Catmull-Rom Wikipedia](https://en.wikipedia.org/wiki/Catmull%E2%80%93Rom_spline)
- [Catmull-Rom to Bezier paper](https://arxiv.org/pdf/2011.08232)
- [Varun.ca Metaballs](https://varun.ca/metaballs/)
- [CSS-Tricks Gooey Effect](https://css-tricks.com/gooey-effect/)

---

## 3. Field vs Spring Comparison: SPRINGS WIN

### The Verdict

| Aspect | Springs | Fields |
|--------|---------|--------|
| **Feel** | Gummy, stretchy | Floaty, magnetic |
| **Force behavior** | Increases when stretched | Decreases when closer |
| **Rest state** | Natural equilibrium | Particles want to merge completely |
| **"Reaching" effect** | Excellent — visible stretch | Poor — magnet snap |
| **Used by** | World of Goo, Gish | SPH fluids, n-body gravity |

**Key insight:** Springs = solid-like soft bodies (gummy). Fields = liquid-like (water).

**World of Goo literally uses springs** — confirmed in forum posts.

### Recommended Inter-Cell Attraction Implementation

```typescript
interface AttractionSpring {
  fromVertex: number;    // Vertex index on cell A
  toVertex: number;      // Vertex index on same-color cell B
  restLength: number;    // Small (5-10% cell radius) for "touching" look
  stiffness: number;     // 0.2-0.5
  damping: number;       // ~0.9 of critical
}

// Tuning values for "gummy reaching"
const ATTRACTION_RADIUS = 50;    // Detection range (pixels)
const REST_LENGTH = 10;          // Target gap when "merged"
const SPRING_STIFFNESS = 0.3;
const DAMPING_RATIO = 0.9;       // Slightly under-critical
const BREAK_DISTANCE = 80;       // Spring releases beyond this
```

### Spatial Hashing Required

For 432 vertices (36 cells × 12), need spatial hashing to avoid O(n²):

```typescript
const CELL_SIZE = ATTRACTION_RADIUS * 1.2;  // ~60 units
const BUCKET_COUNT = 256;                    // Power of 2

function hashPosition(x: number, y: number): number {
  const cx = Math.floor(x / CELL_SIZE);
  const cy = Math.floor(y / CELL_SIZE);
  return ((cx * 1640531513) ^ (cy * 2654435789)) & 0xFF;
}
```

### Optional Hybrid: Springs + Weak Field

```typescript
// Strong springs for connected pairs
// + Weak field for "awareness" of nearby unconnected goop
if (!springConnected && distance < awarenessRadius) {
  fieldForce = awarenessStrength / (distance + softening);
  // Very weak — just visual hint of future attraction
}
```

### Research Sources
- [World of Goo Forums](http://goofans.com/forum/world-of-goo/strategy/2165)
- [Spatial Hashing](https://www.gorillasun.de/blog/particle-system-optimization-grid-lookup-spatial-hashing/)
- [XPBD Paper](https://matthias-research.github.io/pages/publications/XPBD.pdf)

---

## 4. Summary: Implementation Roadmap

### Phase 1: Single Cell Physics
1. Create 12 Verlet vertices in a circle
2. Add ring springs + cross springs
3. Add pressure-based volume preservation
4. Tune ζ=0.6 for gummy feel
5. Render with Catmull-Rom → Bezier

### Phase 2: Cell Follows Data Layer
1. Each vertex has "home position" (data layer grid + angle offset)
2. Spring pulls vertex toward home
3. Test rotation: home rotates instantly, vertex springs to follow
4. Test collision: data stops, vertex overshoots then settles

### Phase 3: Inter-Cell Attraction
1. Implement spatial hashing
2. For same-color neighbors within range: create attraction spring
3. Tune rest length small (~10px) for "touching" look
4. Break springs beyond break distance

### Phase 4: Visual Polish
1. Apply SVG goo filter per color group
2. Test membrane merge appearance
3. Add subtle undulation (two opposing waves)
4. Handle ghost piece (outline only mode)

---

## Next Steps (After /clear)

1. **Build Phase 1 prototype** — single cell with physics + rendering
2. Tune until it feels gummy (ζ≈0.6, stiffness≈100)
3. Add Phase 2 — cell follows data position
4. Iterate from there

---

## Session Command

After `/clear`, run:
```
Start soft-body prototype implementation. Read .planning/SOFTBODY-VISION.md for full research context.
Branch: soft-body-experiment
Phase: 1 — Single cell with 12 Verlet vertices, springs, pressure, Catmull-Rom rendering
```

---

# Prototype Roadmap

Each prototype answers a specific question. Build in order — if one fails, tune before moving on.

## Proto-1: Single Blob Physics

**Question:** Does Verlet + springs + pressure + Catmull-Rom actually feel/look right?

**Implementation:**
- 12 vertices in a circle
- Ring springs + cross springs + pressure
- Click/drag to poke it, watch it jiggle and recover
- Interactive sliders: damping (ζ), stiffness (k), pressure strength
- Tune until it feels "gummy" vs "bouncy" vs "dead"

**Proves:** Core physics engine works, parameter sweet spot found

---

## Proto-2: Blob Follows Cursor

**Question:** Does "render layer follows data layer" actually work?

**Implementation:**
- Same blob from Proto-1
- Blob's "home position" = cursor position
- Spring pulls blob toward cursor
- Move slowly = blob follows smoothly
- Move fast/jump = blob overshoots, bounces back, settles

**Proves:** The two-layer architecture (data drives render) is viable

---

## Proto-3: Rotation Response

**Question:** What happens when we rotate 90° instantly?

**Implementation:**
- Blob attached to a grid cell position
- Button to rotate 90° (simulates piece rotation)
- Home positions jump instantly, blob springs to catch up
- Spam the button — does lag accumulate or does it handle it?

**Proves:** Rotation won't look broken during gameplay

---

## Proto-4: Two Blobs Attraction

**Question:** Do vertex-to-vertex springs create the "reaching" effect?

**Implementation:**
- Two blobs, same color
- Drag one around
- When close: springs form, vertices stretch toward each other
- When far: springs break, blobs independent
- Sliders: attraction radius, rest length, spring stiffness

**Proves:** Inter-cell attraction looks like "reaching" not "magnet snap"

---

## Proto-5: Goo Filter Variations

**Question:** What filter settings create the best membrane merge look?

**Implementation:**
- Two or three same-color blobs, overlapping
- Side-by-side or toggle between filter settings
- Variables: stdDeviation (blur), alpha matrix values
- Compare: no filter vs subtle vs aggressive

**Proves:** We can get smooth membrane merge without metaball math

---

## Proto-6: Multi-Cell Piece

**Question:** Does a piece made of 4 blobs behave as one unit?

**Implementation:**
- T-piece shape (4 cells)
- All cells share physics, move together
- Drag piece around, rotate it
- Cells maintain relative positions but each jiggles individually

**Proves:** Pieces work as cohesive units

---

## Proto-7: Landing and Locked Goop

**Question:** Does collision jiggle look right? Does attraction to locked goop work?

**Implementation:**
- Floor with some locked goop cells
- Falling piece lands on them
- See: overshoot, bounce, settle
- See: attraction springs form to same-color locked cells

**Proves:** The full gameplay loop (fall → land → attract → settle) works

---

## Proto-8: Performance Stress Test

**Question:** Can we run 36 cells × 12 vertices at 40+ FPS?

**Implementation:**
- Full grid of 36 cells, all with active physics
- FPS counter
- Toggle spatial hashing on/off
- Mobile throttle simulation (requestAnimationFrame at 40fps)

**Proves:** This won't kill mobile performance

---

## Prototype Summary

| ID | Name | Core Question |
|----|------|---------------|
| [[#Proto-1: Single Blob Physics]] | Single Blob Physics | Does the physics feel right? |
| [[#Proto-2: Blob Follows Cursor]] | Blob Follows Cursor | Does data→render separation work? |
| [[#Proto-3: Rotation Response]] | Rotation Response | Can we handle instant 90° rotation? |
| [[#Proto-4: Two Blobs Attraction]] | Two Blobs Attraction | Does "reaching" effect look good? |
| [[#Proto-5: Goo Filter Variations]] | Goo Filter Variations | What filter settings look best? |
| [[#Proto-6: Multi-Cell Piece]] | Multi-Cell Piece | Do pieces work as units? |
| [[#Proto-7: Landing and Locked Goop]] | Landing + Locked | Does full landing sequence work? |
| [[#Proto-8: Performance Stress Test]] | Performance Test | Can mobile handle it? |

---

*Vision + Research + Prototype Roadmap documented 2026-01-30. Ready for implementation.*
