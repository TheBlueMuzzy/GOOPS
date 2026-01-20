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
**Current focus:** Phase 6 in progress - Plan 06-02 (Milestone Infrastructure) pending

## Current Position

Phase: 6 of 7 (Progression System) - IN PROGRESS
Plan: 1 of 2 - 06-01 complete
Status: XP curve retuned, XP floor implemented
Last activity: 2026-01-20 — Plan 06-01 complete

Progress: █████████████████████ 5.5/7 phases complete

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
  - Progressive rank unlock: LASER@rank1, LIGHTS@rank2, CONTROLS@rank3
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
  - Trigger: 50% chance on piece lock when pressure 3-5 rows above highest goop (rank 2+)
  - Effect: Dims to 10% brightness + grayscale over 1.5s (alert exempt)
  - Replaced cumulative counter with pressure-gap based trigger
  - Replaced overlay with CSS filter on SVG
- 04-03: CONTROLS Complication Rewrite
  - Trigger: Heat meter reaches 100 (rank 3+)
  - Effect: Requires 2 inputs per move, held keys at half speed
  - Heat builds +5 per rotation, drains at 50/sec when idle
- 04-04: Documentation Updates
  - PRD updated with correct complication specs
  - STATE.md updated to reflect completion

### Phase 5: HUD & Balance - COMPLETE
- 05-01: Meter State & UI
  - Added laserCapacitor and controlsHeat to GameState
  - Created HudMeter component with color gradients
  - Meters positioned at top of periscope view
- 05-02: LASER Meter Logic
  - Capacitor drains 4 per unit popped (rank 1+)
  - LASER triggers when capacitor hits 0
  - Resolution refills capacitor to 100
- 05-03: CONTROLS Heat Logic
  - Heat builds +5 per rotation (rank 3+)
  - Heat drains at 50/sec when idle for 200ms
  - CONTROLS triggers when heat reaches 100
  - Resolution resets heat to 0
- 05-04: Cooldowns & Rank Unlocks
  - Cooldown formula: max(8, 20 - (rank - unlockRank)) seconds
  - Rank unlocks: LASER@1, LIGHTS@2, CONTROLS@3
  - Meters only visible at appropriate rank
  - Cooldown timers above meters
  - Rank selector disabled during game over
- Bug fixes:
  - All rank checks use starting rank (not mid-run rank)
  - Operator rank selector disabled during game over screen

### Phase 6: Progression System - IN PROGRESS
- 06-01: XP Floor & Curve Retuning - COMPLETE
  - New linear delta curve: `(rank-1) * (1000 + 250*rank)`
  - Rank 2: 1,500 XP (was 5,000) — much smoother tutorial
  - Rank 10: 31,500 XP | Rank 100: 2,574,000 XP
  - XP floor: `max(100 * rank, score)` prevents zero-gain runs
  - 15 progression tests (including rank 0)
- Bug fix: Rank 0 now works correctly
  - `calculateRankDetails` returns rank 0 for totalScore <= 0
  - Upgrade count text centered in button

## Approved Complication Specifications

| Complication | Trigger | Effect | Rank |
|--------------|---------|--------|------|
| LASER | Capacitor drains to 0 (4 per unit popped) | Two-tap mechanic (prime then pop) | 1+ |
| LIGHTS | 50% on piece lock when pressure gap >= 3-5 rows | 10% brightness + grayscale over 1.5s | 2+ |
| CONTROLS | Heat meter reaches 100 (+5 per rotation) | 2 inputs per move, half hold speed | 3+ |

## Performance Metrics

**Velocity:**
- Total plans completed: 17 (across 6 phases)
- Total tests: 50 (14 progression, 6 coordinates, 30 game logic)
- Average duration: ~30 min per plan (including bug fixes)

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
- Complication unlocks based on starting rank, not mid-run rank
- HUD meters only visible when complication can trigger (rank-gated)

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
Stopped at: Phase 6 Plan 06-01 complete + rank 0 bug fix
Resume with: Execute Plan 06-02 (Milestone Infrastructure)
Resume file: `.planning/phases/06-progression/06-02-PLAN.md`

**Bug fix this session:** Rank 0 now displays correctly and means "no complications"
- Rank 0: No complications (tutorial)
- Rank 1+: LASER
- Rank 2+: LASER + LIGHTS
- Rank 3+: All three

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<commit>`, `<merge>`, `<status>`, `<handoff>`
