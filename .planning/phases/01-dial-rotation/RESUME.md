# Resume Context: Phase 1 - Dial Rotation

## Session End: 2026-01-18

### Where We Stopped

Executing Plan 01-01-PLAN.md, starting Task 1 (Add dial rotation state and drag handlers).

Files have been read and analyzed:
- `components/Art.tsx` - Main file to modify (595 lines)
- `components/ConsoleView.tsx` - Reference for drag pattern

### What Needs To Be Done

**Task 1: Add dial rotation state and drag handlers**

1. Add local state at top of ConsoleLayoutSVG component (around line 125-131):
```tsx
const [localDialRotation, setLocalDialRotation] = useState(0);
const [isDialDragging, setIsDialDragging] = useState(false);
const dialStartAngle = useRef(0);
const dialStartRotation = useRef(0);
```

2. Add useRef import if not present (already imported on line 2)

3. Add helper function to convert client coords to SVG coords and calculate angle:
```tsx
const getAngleFromPointer = (clientX: number, clientY: number): number | null => {
    const svg = document.querySelector('svg');
    if (!svg) return null;

    const rect = svg.getBoundingClientRect();
    const viewBox = { x: 0, y: 827.84, width: 648, height: 1152 };

    // Convert client coords to SVG coords
    const svgX = ((clientX - rect.left) / rect.width) * viewBox.width + viewBox.x;
    const svgY = ((clientY - rect.top) / rect.height) * viewBox.height + viewBox.y;

    // Dial center in SVG coords
    const dialCenterX = 194.32;
    const dialCenterY = 1586.66;

    const dx = svgX - dialCenterX;
    const dy = svgY - dialCenterY;

    return Math.atan2(dy, dx) * (180 / Math.PI);
};
```

4. Add drag handlers:
```tsx
const handleDialStart = (clientX: number, clientY: number) => {
    const angle = getAngleFromPointer(clientX, clientY);
    if (angle === null) return;

    setIsDialDragging(true);
    dialStartAngle.current = angle;
    dialStartRotation.current = localDialRotation;
};

const handleDialMove = (clientX: number, clientY: number) => {
    if (!isDialDragging) return;

    const angle = getAngleFromPointer(clientX, clientY);
    if (angle === null) return;

    const deltaAngle = angle - dialStartAngle.current;
    setLocalDialRotation(dialStartRotation.current + deltaAngle);
};

const handleDialEnd = () => {
    setIsDialDragging(false);
};
```

5. Add useEffect for global event listeners (similar to periscope in ConsoleView.tsx lines 132-162)

6. Update dial group (lines 455-472):
   - Replace `transform={`rotate(${dialRotation} ...)`}` with `transform={`rotate(${localDialRotation} ...)`}`
   - Replace `onClick={onDialClick}` with drag handlers:
     - `onMouseDown={(e) => handleDialStart(e.clientX, e.clientY)}`
     - `onTouchStart={(e) => handleDialStart(e.touches[0].clientX, e.touches[0].clientY)}`
   - Remove transition style when dragging

### Key Technical Details

- Dial center: (194.32, 1586.66) in SVG coordinates
- Dial radius: 86.84
- SVG viewBox: "0 827.84 648 1152"
- Edge zone (for Task 2): outer 30% = distance >= 60.8 AND <= 86.84

### After Task 1

Run `npm run test:run` to verify tests pass, then proceed to Task 2 (edge-only drag zone).

### Files Modified

None yet - implementation not started.
