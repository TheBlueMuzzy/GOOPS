---
title: Design Vision
type: reference
tags: [design, balance, philosophy]
updated: 2026-01-25
---

# Goops Design Vision

This document captures the high-level design philosophy and balance considerations for Goops. Use this as context when making balance decisions or planning new features.

---

## Core Design Tensions

### 1. Scaffolding vs. Popping

**The obvious play pattern:**
```
Build scaffolding → Wait for pressure → Pop big groups → Repeat
```

**The problem:** Big pops drain the laser capacitor faster, triggering LASER complication right when the player NEEDS to pop. This punishes intuitive play.

**The solution:** This is actually good design — it teaches deeper play. But players must survive long enough to learn. Early ranks (0-5) should be forgiving enough to allow this learning.

### 2. Negative Score vs. Progression Feel

**Tension:** Leftover goop penalty can zero out a session's score, making players feel like they made no progress.

**Solution:** XP floor guarantees minimum progress per session. Bad sessions still contribute to rank progression.

### 3. Skill Expression vs. Accessibility

| Complication | Player Control | Design Intent |
|--------------|---------------|---------------|
| LASER | Inevitable (popping = progress) | Teaches patience, smaller pops |
| CONTROLS | Avoidable (calm rotation) | Rewards skilled play, hidden mastery |
| LIGHTS | Semi-random | Creates tension, unpredictable |

---

## Rank Progression Philosophy

### Tutorial Phase (Ranks 0-5)
- Rank 0: No complications — learn core loop
- Ranks 1-5: Complications introduced gradually
- Fast rank-ups to maintain engagement
- Forgiving thresholds

### Learning Phase (Ranks 6-10)
- All complications active
- Standard difficulty
- Player develops strategies

### Mastery Phase (Ranks 11+)
- New mechanics every 10 ranks
- Upgrades make previous mechanics easier
- Difficulty spikes with new content, then eases as player upgrades

---

## Difficulty Scaling Model

**Key insight:** Don't scale difficulty linearly with rank. Instead:

1. **New mechanics spike difficulty** at milestone ranks (10, 20, 30...)
2. **Upgrades counter previous mechanics** — the mechanics from ranks 1-10 become easier as you upgrade them during ranks 10-20
3. **Probability-based activation** ensures variety without overwhelming

```
Rank 1-10:  Complications introduced, base difficulty
Rank 10:    Multi-color pieces unlock (difficulty spike)
Rank 11-20: Upgrade complication systems, multi-color becomes easier
Rank 20:    Viscous fluid events unlock (difficulty spike)
Rank 21-30: Upgrade previous systems, viscous becomes easier
...and so on
```

---

## Complication Balance Framework

### Target Feel Per Session

| Rank Range | Expected Complications | Session Feel |
|------------|----------------------|--------------|
| 0 | 0 | Learning, safe |
| 1-3 | 0-1 | Building confidence |
| 4-6 | 1-2 | Challenge ramps |
| 7+ | 2-3 | Mastery required |

### Cooldown System

After resolving a complication, same type cannot trigger for a cooldown period:
- Prevents rapid-fire frustration
- Gives breathing room at low ranks
- Becomes upgrade-able (increase cooldown duration)

**Formula:**
```
cooldown = max(8, 20 - (rank - unlockRank))
```

### LASER (Capacitor Drain)

**Mechanic:** Meter drains as player pops goop. When empty, complication triggers.

**Balance levers:**
- Drain rate per unit popped
- Starting meter capacity
- Refill amount after resolution
- Upgrade: slower drain rate

**Design notes:**
- Most common complication (popping is core gameplay)
- Teaches players to pop smaller groups more frequently
- HUD meter visible — player can anticipate and plan

### CONTROLS (Heat Meter)

**Mechanic:** Meter builds while rotating, drains when stopped. At 100%, complication triggers.

**Balance levers:**
- Heat buildup rate while rotating
- Heat dissipation rate when stopped (~2 seconds to zero)
- Threshold to trigger (100%)
- Upgrade: faster heat dissipation

**Design notes:**
- Avoidable by skilled/calm players
- Frantic players trigger it naturally
- "Hidden skill check" — never explicitly explained
- HUD meter visible — creates interesting rotation pacing decisions

### LIGHTS (Pressure Gap)

**Mechanic:** Probability-based trigger when pressure is far from goop.

**Balance levers:**
- Probability per piece lock (15% at unlock, scaling to 50%)
- Gap threshold (3-5 rows)
- Upgrade: lower probability

**Design notes:**
- Most time-consuming minigame
- Should be rare
- No HUD indicator — feels unpredictable
- Triggers when player is "doing well" (pressure far from goop)

---

## Upgrade Philosophy

### General Principles

1. **Upgrades make the game easier, not different** — mechanics stay the same, just more forgiving
2. **Percentage-based effects** — "+10% cooldown duration", "-5% drain rate"
3. **Max level special effects** — Only at max upgrade level, minigames become simpler

### Upgrade Effects at Max Level

| System | Max Level Effect |
|--------|------------------|
| Laser System | No center targets in minigame |
| Lights System | 3-button sequence instead of 4 |
| Controls System | 3 alignments instead of 4 |

### Future Upgrade Ideas

- Junk goop: "10% chance all junk is same color" → "20% chance" → etc.
- Pressure: "5% slower pressure buildup" per level
- Scoring: "5% bonus XP" per level

---

## Open Questions for Future Sessions

1. **Exact meter values** — What drain rate feels right for LASER? What heat rate for CONTROLS?
2. **Rank XP curve** — How much XP between ranks? Should it be linear or exponential?
3. **Upgrade costs** — How many points to upgrade each system?
4. **Rank 40-100 features** — What new mechanics for later milestones?
5. **Themed session probability tuning** — 10% and 15% feel right, or adjust?

---

## Implementation Status

All design systems implemented as of v1.2:
- **Phases 1-7:** Core gameplay, complications, HUD meters, progression, upgrades
- **Phases 8-13:** Architecture refactor, manager extraction, event system
- **Phases 14-20:** Full 40-rank progression, 4 bands, 20 upgrades, active abilities

**XP Curve (Updated v1.1.51):**
- Formula: `3500 + (rank * 250)` per rank
- Rank 1: 3,500 XP | Rank 10: 38,125 XP total | Rank 40: 336,000 XP total
- Much flatter than original exponential curve

---

*Last Updated: 2026-01-25 (validated against master)*
