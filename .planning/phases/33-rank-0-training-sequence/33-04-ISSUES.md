# UAT Issues: Phase 33 Plan 04

**Tested:** 2026-02-08
**Source:** .planning/phases/33-rank-0-training-sequence/33-04-PLAN.md
**Tester:** User via /gsd:verify-work

## Open Issues

### UAT-001: Intercom garble too heavy — messages unclear

**Discovered:** 2026-02-08
**Phase/Plan:** 33-04
**Severity:** Blocker
**Feature:** Intercom message display
**Description:** The garble renderer obscures too much text. Only 2-3 keywords come through clearly (e.g., "operator", "shift" for A1; "Periscope", "tank", "Drag" for A2). Players can't understand what they need to do. Messages should be mostly readable with some garbled letters/words for thematic flavor — not entire words replaced.
**Expected:** Messages are comprehensible with light static corruption (garbled letters within words, occasional fuzzed non-essential words). Player can read and understand the instruction.
**Actual:** Most of the message is garbled/hidden. Only tagged keywords are readable. Feels like a redacted document rather than a corrupted radio transmission.

### UAT-002: No control gating — all controls available from start

**Discovered:** 2026-02-08
**Phase/Plan:** 33-04
**Severity:** Blocker
**Feature:** Progressive control introduction
**Description:** Fast-drop and rotation controls are available from the first tank entry (B1), before they're taught. Players can accidentally use controls they haven't learned yet, which defeats the purpose of progressive teaching.
**Expected:** Controls should unlock progressively: B1 = watch only (no input), B2 = fast-drop enabled, B3 = rotation enabled. Each new control becomes available only when its training step begins.
**Actual:** All controls (rotate, fast-drop) are available as soon as you enter the tank.

### UAT-003: Game doesn't pause between training steps

**Discovered:** 2026-02-08
**Phase/Plan:** 33-04
**Severity:** Major
**Feature:** Training flow pacing
**Description:** When a training step completes, the game continues running while the next intercom message plays. Pieces keep falling. There should be a freeze/pause so the player can read the message and understand the next instruction before gameplay resumes. The dev kit already has freeze-falling functionality that could be leveraged.
**Expected:** After each step completes: pause falling → show intercom message → player acknowledges → resume gameplay.
**Actual:** Gameplay continues uninterrupted. New pieces fall and lock while the player is trying to read the intercom message.

### UAT-004: Active piece invisible while falling

**Discovered:** 2026-02-08
**Phase/Plan:** 33-04
**Severity:** Major
**Feature:** Piece rendering during training
**Description:** The falling piece is not visible during training. Only the ghost (landing preview) shows. The piece suddenly appears when it locks into place. This may be related to the soft-body rendering pipeline not activating in training mode.
**Expected:** Falling piece is clearly visible as it descends, same as normal gameplay.
**Actual:** Ghost outline visible but actual piece invisible until lock.

### UAT-005: Intercom window too tall and narrow, poor positioning

**Discovered:** 2026-02-08
**Phase/Plan:** 33-04
**Severity:** Major
**Feature:** Intercom message UI layout
**Description:** The intercom message window is very tall and narrow when it could use more horizontal space. Position should be contextual — for the first message (console briefing), it should sit between the Operator Rank/XP bar and the Rank Select area, not floating over gameplay. Position should guide the player's eye to relevant UI areas.
**Expected:** Wider intercom window. Vertical position contextual to the step (console area for console steps, tank area for gameplay steps).
**Actual:** Tall narrow window with fixed positioning that doesn't relate to the content being taught.

### UAT-006: Highlight cutout oversized and mispositioned

**Discovered:** 2026-02-08
**Phase/Plan:** 33-04
**Severity:** Major
**Feature:** Highlight system (clip-path cutout)
**Description:** The highlight lightbox on step A2 (periscope) is approximately 2x the console width. It starts just below the Operator Rank text and extends down to the Repair Lights button. Way too large — should tightly frame just the periscope drag area.
**Expected:** Highlight rectangle tightly framing the periscope drag area on the console.
**Actual:** Oversized rectangle covering most of the console and beyond.

### UAT-007: Training HUD not visible

**Discovered:** 2026-02-08
**Phase/Plan:** 33-04
**Severity:** Minor
**Feature:** Training HUD (phase name, dots, step counter)
**Description:** The Training HUD (phase name, progress dots, step counter) is either not rendering or is hidden behind other elements. If it were visible at the top, it would conflict with the "To start shift, pull down periscope" text. User suggests integrating progress info into the intercom title bar instead of a separate overlay.
**Expected:** Training progress visible somewhere during training.
**Actual:** Not visible. Better approach: integrate into intercom message UI rather than a separate top-of-screen overlay.

### UAT-008: Intercom messages don't explain HOW to perform actions

**Discovered:** 2026-02-08
**Phase/Plan:** 33-04
**Severity:** Major
**Feature:** Intercom message content
**Description:** Messages tell the player WHAT to do but not HOW. B2 says "drop" but doesn't mention swiping down or pressing W. New players won't know the controls if the training doesn't teach them.
**Expected:** Messages include the control instruction: "Swipe down to fast-drop" or "Press W to fast-drop" (context-aware for touch vs keyboard).
**Actual:** Just says keyword like "drop" with no control instruction.

### UAT-009: Pressure meter doesn't move during training

**Discovered:** 2026-02-08
**Phase/Plan:** 33-04
**Severity:** Minor
**Feature:** PSI/Pressure display during training
**Description:** The pressure meter stays flat during training. While training disables complications, the pressure system should still function so the player can see cause and effect (pieces landing = pressure rises).
**Expected:** Pressure rises when pieces lock, giving visual feedback.
**Actual:** Pressure stays at 0/flat.

## Resolved Issues

[None yet]

---

*Phase: 33-rank-0-training-sequence*
*Plan: 04*
*Tested: 2026-02-08*
