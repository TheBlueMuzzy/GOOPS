# Phase 3: Complications - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<vision>
## How This Should Work

Complications are sudden interruptions that demand immediate attention - alarm bells, not gradual pressure. When one triggers, the player notices right away through both gameplay effects AND a prominent visual alert.

**Center screen alert:**
- "[X] Malfunction" message in title font, two lines
- Red color with fast pulsing transparency (100-0-100-0)
- "Fix at Console" subtitle in regular font, pulses with main message
- Alert disappears when the associated minigame is completed

**Gameplay effects kick in immediately:**
- **Lights Malfunction**: Screen dims to 0 over 3 seconds
- **Controls Malfunction**: Left/right controls randomly flip every 3 seconds
- **Laser Malfunction**: Goops require +1 extra tap to pop

This creates real tension - the player genuinely feels pressure when one triggers. The console visit isn't optional, it's urgent.

</vision>

<essential>
## What Must Be Nailed

- **Creates real tension** - Stakes matter, player feels pressure when complication triggers
- **Forces console visits** - The periscope ↔ console flow actually happens during runs
- **Rewards skilled play** - Good players can handle complications quickly and return to action
- **Noticeable alerts** - Pulsing red center-screen message impossible to miss

</essential>

<boundaries>
## What's Out of Scope

- Balancing/tuning trigger thresholds - get the system working first, tune numbers later
- Visual polish effects (screen shake, dramatic flashing) - basic indicators only for now
- The "click to test" mechanism on minigame panels - removing this, real complications only

</boundaries>

<specifics>
## Specific Ideas

**Console panel behavior changes:**
- Minigame indicator lights only turn ON when there's an active complication for that panel
- Remove the "click on RESET X text to test" mechanism from Phase 2
- Panel text states:
  - "RESET X" in RED when complication active
  - "X FIXED" in GREEN when completed (replaces current solved state)

**Alert timing:**
- Messages appear immediately when complication triggers
- Messages disappear when associated minigame is completed
- Multiple complications can show multiple alerts (stacking TBD)

</specifics>

<notes>
## Additional Context

The three complication types map to the three minigame panels:
- Lights Malfunction → Reset Lights minigame
- Controls Malfunction → Reset Controls minigame
- Laser Malfunction → Reset Laser minigame

Trigger thresholds (from PRD, exact values TBD during balancing):
- Reset Lights: X total goop units added to tank
- Reset Laser: X total goop units popped
- Reset Controls: X tank rotation steps

Effects are designed to be disruptive but not game-ending - player can push through briefly but will want to fix ASAP.

</notes>

---

*Phase: 03-complications*
*Context gathered: 2026-01-19*
