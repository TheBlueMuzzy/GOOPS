# Bug Investigations

Reference file for investigated bugs that were either fixed, couldn't reproduce, or are low priority.

---

## Pressure Not Rising Bug

**Status:** Investigated 2026-01-24 — Cannot reproduce, likely fixed in v1.1 architecture refactor

**Symptom:** Sometimes pressure doesn't start rising for a long time after starting a run.

### How Pressure Works

- `pressureRatio = 1 - (timeLeft / maxTime)`
- `tickTimer()` decrements `timeLeft` every frame in `GameEngine.tick()`
- Guard condition: `if (!this.isSessionActive || this.state.gameOver || this.state.isPaused) return`

### Most Likely Cause: Mobile Frame Throttling

In `useGameEngine.ts:76-93`, frames are skipped on mobile:

```typescript
if (isMobile && dt < TARGET_FRAME_TIME) {
    requestRef.current = requestAnimationFrame(loop);
    return;  // NO TICK CALLED - pressure doesn't advance
}
```

First ticks may be skipped waiting for 25ms threshold, causing visible delay at game start.

### Other Possible Causes

| Cause | Likelihood | Notes |
|-------|-----------|-------|
| Mobile frame throttling delay | HIGH | First ticks skipped waiting for 25ms |
| `isSessionActive` race condition | MEDIUM | Set in `startRun()`, tick loop may already be checking |
| Multiple `timeLeft` initializations | LOW | Set in constructor, `applyUpgrades()`, and `startRun()` |

### Suspicious Patterns

1. `isSessionActive` is public property on GameEngine, not part of `GameState`
2. Multiple `timeLeft` init points: Constructor → `applyUpgrades()` → `startRun()`
3. `lastGoalSpawnTime = Date.now()` at start delays first goal spawn

### If Bug Resurfaces

1. Add timestamp logging to `startRun()` and first `tick()` call
2. Test specifically on mobile devices
3. Check if `isSessionActive` is true before first tick runs

---
