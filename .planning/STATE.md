# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- None — all work complete on master

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.
**Current focus:** Phase 5 - HUD meters and complication balance

## Current Position

Phase: 5 of 7 (HUD & Balance) - IN PROGRESS
Plan: 1 of 4 (Meter State & UI) - complete
Status: HUD meters visible, meter logic pending
Last activity: 2026-01-20 — Plan 05-01 complete, meters render in periscope

Progress: ████████████████░░░░ 5/7 phases (Plan 1/4 of Phase 5)

## What's Done

### Phase 1: Dial Rotation - COMPLETE
- Dial rotation responds to drag (vector approach)
- SVG coordinate conversion working (uses hidden reference element)
- Snap to 4 corners (45°, 135°, 225°, 315°) on release
- Debug code cleaned up
- Works on both PC and mobile

### Phase 2: Minigame Logic - COMPLETE
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

### Phase 3: Complications - COMPLETE
- 03-01: Complication Types & Triggers
  - ComplicationType enum: LIGHTS, CONTROLS, LASER
  - Progressive rank unlock: LASER@rank1, CONTROLS@rank2, LIGHTS@rank3
- 03-02: Gameplay Effects (now rewritten)
- 03-03: UI & Console Updates
  - Pulsing red "[X] Malfunction / Fix at Console" center alerts
  - Console panels: lights only ON when complication active
  - Text states: RESET X (teal) → RESET X (red) → X FIXED (green)
  - Full minigame integration with resolve callbacks

### Phase 4: Minigame-Complication Integration - COMPLETE
- 04-01: Final Cleanup
  - Bug fix: Complications now cleared in finalizeGame() (no carry-over between sessions)
  - Dead code removal: BlownFuse component and LAYER 5 overlay removed
- 04-02: LIGHTS Complication Rewrite
  - Trigger: 50% chance on piece lock when pressure 3-5 rows above highest goop (rank 3+)
  - Effect: Dims to 10% brightness + grayscale over 1.5s (alert exempt)
  - Replaced cumulative counter with pressure-gap based trigger
  - Replaced overlay with CSS filter on SVG
- 04-03: CONTROLS Complication Rewrite
  - Trigger: 20 rotation inputs within 3 seconds (rank 2+)
  - Effect: Requires 2 inputs per move, held keys at half speed
  - Replaced cumulative counter with timestamped tracking
  - Removed flip controls effect, added double-tap requirement
- 04-04: Documentation Updates
  - PRD updated with correct complication specs
  - STATE.md updated to reflect completion
- UAT Bug Fixes (2026-01-20):
  - CONTROLS minigame not activating: was setting targetCorner to angle (45/315/225/135) instead of index (0/1/2/3)
  - Multiple complications couldn't trigger: checkComplications() blocked all spawns if any active
  - Complication counters stopped accumulating when any complication active (totalUnitsPopped, rotationTimestamps)
  - Alarm text now stacks vertically (oldest on top) when multiple complications active

## Approved Complication Specifications

| Complication | Trigger | Effect | Rank |
|--------------|---------|--------|------|
| LASER | Cumulative units popped (12-24 range) | Two-tap mechanic (prime then pop) | 1+ |
| CONTROLS | 20 rotations in 3 seconds | 2 inputs per move, half hold speed | 2+ |
| LIGHTS | 50% on piece lock when pressure gap >= 3-5 rows | 10% brightness + grayscale over 1.5s | 3+ |

## Performance Metrics

**Velocity:**
- Total plans completed: 12 (across all 4 phases)
- Average duration: ~30 min per plan (including bug fixes)
- Total execution time: ~8 hours

## Accumulated Context

### Decisions

- Phase 1: Rotation works anywhere on dial (edge-only approach not needed)
- SVG coordinate conversion requires hidden reference element due to preserveAspectRatio
- No CSS transition on dial snap (causes fly-away visual bug)
- Use refs instead of state for values needed in event handler closures
- Reset Lights: Sequence memory over Lights Out toggle (toggle had null space, 1-press solutions)
- Reset Controls: 15° tolerance for dial alignment, 4 corner sequence
- Reset Controls: Corner angles are 45°=TR, 315°=TL, 225°=BL, 135°=BR
- LIGHTS effect: CSS filter on SVG instead of overlay (keeps alert visible)
- CONTROLS effect: Double-tap + half speed instead of flip toggle

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

**CSS Filter for Selective Dimming**

Apply filter to game content only, keeping alerts exempt:
```tsx
<svg className={lightsDimmed ? 'lights-dimmed' : ''}>
// .lights-dimmed { animation: lightsDimIn 1.5s ease-out forwards; }
// @keyframes lightsDimIn { to { filter: brightness(0.1) grayscale(1); } }
```

### Deferred Issues

None

## Session Continuity

Last session: 2026-01-20
Stopped at: Phase 4 - core bugs fixed, value tweaking needed
Resume with: Tweak complication trigger thresholds and effects
Resume file: None needed - clean state
