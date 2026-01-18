# Resume Context: Phase 1 - Dial Rotation

## Session End: 2026-01-18

### Where We Stopped

Task 3 (Human verify dial rotation) - **ROTATION WORKS!**

Debug visualization still in place (green dot, magenta line, cyan center).
Next steps: clean up debug code, add snap functionality, test on mobile.

### What Was Done This Session

**MAJOR FIX: SVG Coordinate Conversion**

The dial rotation wasn't working because `preserveAspectRatio="xMidYMid slice"` on the SVG meant simple coordinate math was wrong. Multiple approaches tried:

1. Manual viewBox math - wrong due to aspect ratio
2. SVG's `getScreenCTM()` on SVG element - didn't include viewBox transform
3. CTM from dial circle - included dial's rotation, caused jitter
4. **SOLUTION**: Hidden reference element (`#coord-reference`) outside dial group

**Key Code (Art.tsx)**

```tsx
// Hidden reference point outside rotating groups
<circle id="coord-reference" cx={DIAL_CENTER_X} cy={DIAL_CENTER_Y} r="1" fill="transparent" />

// Coordinate conversion using non-rotating reference
const refPoint = document.getElementById('coord-reference');
const ctm = refPoint.getScreenCTM();
const svgPoint = point.matrixTransform(ctm.inverse());
```

**Rotation Math (working)**
```tsx
// Vector approach: grab point aims at cursor
grabAngleRef.current = Math.atan2(dy, dx) * (180 / Math.PI);
// newRotation = cursorAngle - grabAngle + rotationAtGrab
const newRotation = cursorAngle - grabAngleRef.current + rotationAtGrabRef.current;
```

### Remaining Tasks for Phase 1

1. **Remove debug visualization** - cyan dot, magenta dot/line, green dot, console.logs
2. **Re-enable snap** - snap to 45°, 135°, 225°, 315° on release
3. **Test on mobile** - verify touch works smoothly
4. **Edge-only drag zone** (optional) - restrict to curved arrow area

### Files Modified

- `components/Art.tsx` - dial rotation handlers, coordinate conversion, debug elements

### Key Learnings

- `preserveAspectRatio="xMidYMid slice"` breaks simple coordinate math
- Use SVG's built-in `getScreenCTM().inverse()` for coordinate conversion
- Reference element must be OUTSIDE any rotating groups
- Using refs instead of React state avoids stale closure issues in event handlers
