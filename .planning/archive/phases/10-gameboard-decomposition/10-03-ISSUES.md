# Plan 10-03 UAT Issues

## Summary

Found during human verification of Plan 10-03 (CSS extraction and final cleanup).

| ID | Severity | Status | Title |
|----|----------|--------|-------|
| UAT-001 | Major | Fixing | Shake animation not working on invalid pop |
| UAT-002 | Major | Fixing | Early swap release triggers rotate |
| UAT-003 | Major | Fixing | Controls dial click broken after drag |

**Root Cause**: Release after hold/drag should NOT trigger tap/click. Currently it does.

---

## UAT-001: Shake animation not working on invalid pop

**Severity:** Major
**Status:** Fixing
**File:** `components/GameBoard.css`

### Description
When tapping on a block that cannot be popped (above pressure line or still filling), the shake animation does not play. The shakingGroupId logic is correct in useInputHandlers.ts (class IS being applied), but the CSS animation doesn't work on SVG `<g>` elements.

### Steps to Reproduce
1. Run `npm run dev -- --host`
2. Start game at rank 0
3. Tap on a goop block that is above the pressure line (invalid pop)
4. Observe: No shake animation plays (should shake left-right)

### Expected Behavior
Block group should shake horizontally for ~300ms to indicate invalid action.

### Acceptance Criteria
- [ ] Invalid pop attempts show visible shake animation
- [ ] Shake works on both desktop and mobile

---

## UAT-002: Early swap release triggers rotate

**Severity:** Major
**Status:** Fixing
**File:** `hooks/useInputHandlers.ts`

### Description
When starting hold-to-swap but releasing early (before 1s completes), the release falls through to tap logic and triggers a rotate action.

### Steps to Reproduce
1. Run `npm run dev -- --host`
2. Touch and hold on empty game board area
3. Release after ~500ms (before swap completes)
4. Observe: Cylinder rotates (should do nothing)

### Expected Behavior
If hold was "engaged" (past HOLD_DELAY of 250ms), release should do nothing - not trigger rotate.

### Root Cause
`handlePointerUp` only checks `actionConsumed` (swap completed) and `isDragLocked` (moved). Needs to also check if hold was engaged (time > HOLD_DELAY).

### Fix Applied
Added `if (dt >= HOLD_DELAY) return;` before tap logic in handlePointerUp.

### Acceptance Criteria
- [ ] Hold-then-release (without drag) does NOT trigger rotate
- [ ] Quick taps (< 250ms) still rotate correctly
- [ ] Completed swaps (hold 1s) still work

---

## UAT-003: Controls dial click broken after drag

**Severity:** Major
**Status:** Fixing
**Files:** `components/MiniGames/ControlsPanel.tsx`, `hooks/useControlsMinigame.ts`

### Description
Same root cause as UAT-002. When dragging the controls dial to rotate it, the release event fires a click that triggers `handleDialPress`, causing unintended behavior.

### Steps to Reproduce
1. Run `npm run dev -- --host`
2. Trigger CONTROLS complication (reach heat 100)
3. Drag dial to rotate it to a lit corner
4. Release drag
5. Observe: Click fires immediately, often triggering misalignment feedback

### Root Cause
Mouse/touch up after drag fires both the "end drag" handler and a "click" event. The click handler was firing before it could know drag just ended.

### Fix Applied
1. Removed broken local fix from ControlsPanel.tsx (was tracking isDialDragging state changes during render)
2. Added `justFinishedDraggingRef` in useControlsMinigame.ts hook
3. Set it true in `handleDialEnd` when movement occurred
4. Check it in `handleDialPress` to block clicks
5. Clear after 100ms timeout

### Acceptance Criteria
- [ ] Dragging dial and releasing does NOT trigger click
- [ ] Direct taps on dial still register as clicks
- [ ] Dial alignment puzzle is fully playable
