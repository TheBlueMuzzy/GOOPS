# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `complications` — Phase 3 work (awaiting verification)

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.
**Current focus:** Phase 2 COMPLETE - all 3 minigames tested and working!

## Current Position

Phase: 2 of 4 (Minigame Logic) - COMPLETE
Plan: 3 of 3 complete (02-03-SUMMARY.md)
Status: Phase 2 complete, user-tested, ready for Phase 3
Last activity: 2026-01-19 — Bug fixes for Reset Laser after user testing

Progress: ██████████░░░░░░░░░░ 50% (2 of 4 phases complete)

## What's Done

- Dial rotation responds to drag (vector approach)
- SVG coordinate conversion working (uses hidden reference element)
- Snap to 4 corners (45°, 135°, 225°, 315°) on release
- Debug code cleaned up
- Works on both PC and mobile
- Reset Laser minigame logic complete (02-01)
  - Bug fixes (2026-01-19): both lights ON for center target, sliders start in wrong positions
- Reset Lights minigame logic complete (02-02)
  - Redesigned from Lights Out toggle → sequence memory puzzle
  - Flow: slider → watch 4-button sequence → repeat → slider
  - Guaranteed 6 interactions per solve
- Reset Controls minigame logic complete (02-03)
  - Dial alignment puzzle: align to 4 random corners in sequence
  - Drag to rotate, release to snap, tap to confirm
  - Press animation (translate down) on confirm tap
  - Visual feedback: corner lights, PRESS text, shake on wrong press
  - Proper drag vs tap separation

## What's Next

Start Phase 3: Complications
- Define complication triggers during gameplay
- Visual effects indicating which minigame to complete
- Multiple simultaneous complications

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: ~30 min per plan (including bug fixes)
- Total execution time: ~5 hours

## Accumulated Context

### Decisions

- Phase 1: Edge-only drag deferred (rotation works anywhere on dial)
- SVG coordinate conversion requires hidden reference element due to preserveAspectRatio
- No CSS transition on dial snap (causes fly-away visual bug)
- Use refs instead of state for values needed in event handler closures
- Reset Lights: Sequence memory over Lights Out toggle (toggle had null space, 1-press solutions)
- Reset Controls: 15° tolerance for dial alignment, 4 corner sequence
- Reset Controls: Corner angles are 45°=TR, 315°=TL, 225°=BL, 135°=BR

### Key Technical Discovery

**SVG Coordinate Conversion with preserveAspectRatio="xMidYMid slice"**

Simple viewBox math doesn't work. Must use:
```tsx
const refPoint = document.getElementById('coord-reference'); // Outside rotating groups!
const ctm = refPoint.getScreenCTM();
const svgPoint = screenPoint.matrixTransform(ctm.inverse());
```

**Stale Closure Fix for Event Handlers**

When using useEffect to register global event listeners, state values captured in closures become stale. Use refs for values that need to be current:
```tsx
const currentRotationRef = useRef(0);
// In move handler: currentRotationRef.current = newRotation;
// In end handler: use currentRotationRef.current, not state
```

**CSS Transform vs SVG Transform Conflict**

CSS animations with `transform` override inline SVG `transform` attributes. To apply shake animation to a rotating element, use nested groups:
```tsx
<g transform={`rotate(${rotation} ...)`}>  {/* Outer: rotation */}
    <g className={shaking ? 'shake' : ''}>   {/* Inner: shake animation */}
        {/* content */}
    </g>
</g>
```

**Distinguishing Tap from Drag**

Track actual movement with a ref to distinguish simple taps from drags:
```tsx
const hasMovedRef = useRef(false);
// In drag start: hasMovedRef.current = false;
// In drag move: hasMovedRef.current = true;
// In drag end: only set justDraggedRef if hasMovedRef.current
```

**Slider Jump on Drag Start**

When dragging starts, initialize dragOffset to current position before enabling drag mode:
```tsx
const handlePointerDown = (e: React.PointerEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    startValueOffset.current = currentPos;
    setDragOffset(currentPos); // Initialize BEFORE enabling drag
    setIsDragging(true);
};
```

### Deferred Issues

- Edge-only drag zone (optional enhancement for Phase 1)

## Session Continuity

Last session: 2026-01-19
Stopped at: Phase 2 complete, all minigames user-tested and working
Resume with: `/gsd:progress` → will route to `/gsd:plan-phase 3`
Resume file: None needed - clean state
