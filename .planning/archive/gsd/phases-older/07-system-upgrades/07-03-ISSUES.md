# UAT Issues: 07-03 Upgrade UI Panel

Found during manual verification on 2026-01-20.

## Issues

### UAT-001: Upgrade panel shows all upgrades regardless of rank
**Severity:** Major
**Description:** The upgrade panel displays all 3 system upgrades (LASER, LIGHTS, CONTROLS) regardless of the player's current rank. Each upgrade has an `unlockRank` property (LASER@1, LIGHTS@2, CONTROLS@3) that should determine when it becomes visible.
**Steps to reproduce:**
1. Start a fresh game (rank 0)
2. Open the upgrade panel
3. Observe: All 3 upgrades are visible
**Expected:** Only upgrades where player rank >= unlockRank should appear
**Affected files:** `components/UpgradePanel.tsx`

### UAT-002: Upgrade button visible at rank 0 when no upgrades available
**Severity:** Minor
**Description:** At rank 0, the "SYSTEMS" button that opens the upgrade panel is still visible, but there are no upgrades available (LASER unlocks at rank 1). This creates a confusing experience.
**Steps to reproduce:**
1. Start a fresh game (rank 0)
2. Observe: SYSTEMS button is visible on console
3. Click it: Empty panel with no upgrades
**Expected:** Either hide the button at rank 0, or show a message like "No upgrades available yet"
**Affected files:** `components/UpgradePanel.tsx`, `components/ConsoleView.tsx` (if hiding button)

### UAT-003: Dev rank selector doesn't reset powerUps
**Severity:** Major
**Description:** When using the dev rank selector to change rank, the `powerUps` (purchased upgrade levels) are not reset. This means changing rank gives fresh points but keeps existing upgrades, leading to inconsistent state.
**Steps to reproduce:**
1. Play to rank 5, buy some upgrades
2. Use dev selector to set rank to 2
3. Observe: Upgrade levels remain, but you now have rank=2 worth of points
**Expected:** Changing rank should wipe powerUps and give fresh points equal to the new rank (simulating a player who just reached that rank with no purchases yet)
**Affected files:** `App.tsx` (handleSetRank function)

### UAT-004: Panel styling doesn't match end-game screen aesthetic
**Severity:** Minor
**Description:** The upgrade panel uses Tailwind CSS styling (slate backgrounds, emerald accents) while the end-game screen uses the game's SVG design system with specific colors (#1f1f38 dark blue, #6acbda cyan, #f2a743 orange, Amazon Ember font). The panel should match for visual consistency.
**Steps to reproduce:**
1. Complete a run to see end-game screen
2. Close and open upgrade panel
3. Compare: Different visual language (Tailwind vs SVG art)
**Expected:** Panel should use similar colors, fonts, and grid/rectangle structures as end-game screen
**Affected files:** `components/UpgradePanel.tsx`
