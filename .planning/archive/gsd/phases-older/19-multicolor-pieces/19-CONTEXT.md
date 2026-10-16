# Phase 19: Multi-Color Pieces - Context

**Gathered:** 2026-01-24
**Status:** Ready for research

<vision>
## How This Should Work

Falling pieces have a 25% chance to be split into 2 colors instead of 1. This happens before the piece spawns — the "next" window shows the multi-colored piece accurately.

When a piece is multi-colored:
- Half the units are one color, half are another (as close to 50/50 as the shape allows)
- Each color forms a **contiguous group** within the piece — like two mini-pieces joined together
- Colors are randomly chosen from the active palette

The split feels intentional and natural, not random scattered units. A multi-color I-piece looks like two dominos stuck together. A multi-color T-piece has 3 units of one color (the stem) and 1 unit of another (the nub).

**Gameplay impact:** It's a double-edged sword. Sometimes helpful (the color you need is in the piece), sometimes harder (splits your goop group planning). Players deal with the complexity of controlling two colors in one piece.

</vision>

<essential>
## What Must Be Nailed

- **Contiguous groups feel natural** — The split looks intentional, like two mini-pieces joined together
- **Works with all future shapes** — Algorithm handles any piece shape, not just tetrominoes (future-proofing for non-tetris pieces)
- **Preview accuracy** — Next window shows correct colors before piece spawns
- **Balanced splits** — Get as close to 50/50 as the shape allows while keeping both groups contiguous

</essential>

<boundaries>
## What's Out of Scope

- **New piece shapes** — Non-tetromino shapes are planned but not part of this phase
- **3+ colors per piece** — Pieces are always 1 or 2 colors, never more
- **Upgrades to modify chance** — The 25% is fixed for now (could be upgrade material later)

</boundaries>

<specifics>
## Specific Ideas

- **T-piece solution:** When 2+2 isn't possible (both groups can't be contiguous), use the largest contiguous group that still leaves a contiguous remainder. For T: 3 units (stem) + 1 unit (nub).
- **Trigger:** Multi-color pieces start at rank 20+ (Mixer Band entrance)
- **25% chance** — Good starting point for balance

</specifics>

<notes>
## Additional Context

The "Mixer" complication was planned for Phase 17 but only the upgrades were implemented (Active Expansion Slot, Goop Hold Viewer, Goop Window, Goop Colorizer). This phase adds the actual complication mechanic.

The user is planning non-tetris pieces in a future phase. Whatever algorithm we use for splitting should work for arbitrary piece shapes, not just the 7 tetrominoes.

</notes>

---

*Phase: 19-multicolor-pieces*
*Context gathered: 2026-01-24*
