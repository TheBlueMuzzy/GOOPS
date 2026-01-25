# Phase 1 Summary: Dial Rotation

## Completed: 2026-01-18

## What Was Built

Reset Controls dial now responds to drag input and snaps to 4 corner positions (45°, 135°, 225°, 315°) on release. Works on both PC (mouse) and mobile (touch).

## Key Implementation Details

### SVG Coordinate Conversion
The SVG uses `preserveAspectRatio="xMidYMid slice"` which breaks simple viewBox math. Solution: use a hidden reference element outside rotating groups and `getScreenCTM().inverse()` for coordinate conversion.

```tsx
<circle id="coord-reference" cx={CENTER_X} cy={CENTER_Y} r="1" fill="transparent" />

const screenToSvg = (clientX, clientY) => {
    const refPoint = document.getElementById('coord-reference');
    const ctm = refPoint.getScreenCTM();
    const svgPoint = point.matrixTransform(ctm.inverse());
    return { x: svgPoint.x, y: svgPoint.y };
};
```

### Stale Closure Fix
Event handlers registered in useEffect capture stale state values. Fixed by using refs:
- `currentRotationRef` tracks live rotation value
- Updated in move handler, read in end handler

### Snap Logic
- Finds closest of [45, 135, 225, 315] to normalized rotation
- Then finds equivalent angle closest to actual rotation (handles multi-revolution)
- Instant snap (no CSS transition) to avoid visual fly-away bug

## Files Modified

- `components/Art.tsx` — dial drag handlers, coordinate conversion, snap logic

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| No edge-only drag zone | Works well enough without it, can add later |
| No CSS transition on snap | Transition caused fly-away visual bug |
| Use refs for event handler values | Avoid stale closure issues |

## Deferred

- Edge-only drag zone (optional enhancement)
