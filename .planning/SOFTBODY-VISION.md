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

## Next Steps (After /clear)

1. **Deep research** on vertex-to-vertex attraction, soft body merging, spring tuning
2. **Prototype Test A:** Explicit vertex-to-vertex springs
3. **Prototype Test B:** Field-based continuous attraction
4. **Compare results** — which feels more "gummy"?
5. **Iterate rapidly** on the winner

---

## Session Command

After `/clear`, run:
```
Continue soft-body goop research. Read .planning/SOFTBODY-VISION.md for full context.
Branch: soft-body-experiment
```

---

*This document captures the full vision discussion from 2026-01-30. All nuance preserved.*
