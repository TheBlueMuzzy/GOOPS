# Goops — Progression
> Living design doc, linked from GDD §5. Carried over from the v1 PRD (`research/v1/PRD.md` §Progression, §Upgrades, §Active Abilities) and `research/v1/DESIGN_VISION.md`. All of it shipped in v1 except ranks 40–50 content. The numbers get re-checked with a sim at /define; the tuning values will live in `content/`.
> v1 code differs from this table on colours: `utils/gameLogic.ts:27` gives Purple@10, White@30, Black@50 (matches below); v1 PROJECT.md said Orange@10, Purple@20.

## Progression System

### Ranks & XP

**Max Rank:** 50

**XP Formula:**
```
xpForNextRank = 3500 + (currentRank * 250)
cumulativeXpToRankN = N * (3375 + 125 * N)
```

| Rank | XP to Next | Cumulative |
|------|------------|------------|
| 0 | 3,500 | 0 |
| 10 | 6,000 | 46,250 |
| 20 | 8,500 | 117,500 |
| 30 | 11,000 | 213,750 |
| 40 | 13,500 | 335,000 |
| 50 | — | 481,250 |

**Minimum Progress:** Every session grants at least `100 * currentRank` XP (minimum 100).

### The rank lock (F74 — Muzzy, 2026-10-29)

"Quota = key to the rank lock." A rank-up needs **both**:
- the XP goal for this rank, **and**
- a crack quota met during this rank.

How it plays:
- No quota met yet this rank → the XP **stops at the goal**: the meter sits full and says **QUOTA NEEDED**; extra XP is lost.
- A met quota **stays met** until the rank-up — later shifts that miss it don't undo it.
- A shift that meets its quota earns **double its XP** (`progression.json` `quotaXpMult`: 2).
- One quota = one rank-up: a huge shift that unlocks a rank stops full at the next rank's goal.
- The first day (rank 0 → 1) and the final shift (rank 50) work as before.
- The end report's quota row: met → "Met — rank unlocked · XP ×2" · met earlier → "Met earlier — rank unlocked" · missed with a full meter → "Rank locked: meet a quota" · missed → "Missed — the rank-up needs one".
- The first time the lock holds, Management explains it on the monitor (`moments.json` → `events.rankLock`).
- Saves from before the lock count the rank you're in as unlocked (TDD D31).

### Scraps (Currency)

- Earn 1 scrap per rank achieved
- Spend 1 scrap per upgrade level
- Displayed as "SCRAPS: XX" on upgrade screen

### Color Schedule

| Rank | Colors Available |
|------|-----------------|
| 0-9 | Red, Blue, Green, Yellow (4) |
| 10-29 | + Purple (5) |
| 30-39 | + White (6) |
| 40-49 | + Wild (15% spawn chance, seals any color) |
| 50 | + Black (7) |

### Starting Junk (Rank 3+)

Sessions start with junk goop already in the tank:

| Rank | Junk Blocks | Coverage |
|------|-------------|----------|
| 0-2 | 0 | — |
| 3-5 | ~5 blocks | ~15% of bottom row |
| 6-8 | ~8 blocks | ~25% of bottom row |
| 9+ | ~11 blocks | ~35% of bottom row |

Each junk block is an independent group (size 1). Colors are random unless modified by JUNK_UNIFORMER upgrade.

---

## Upgrade System

20 upgrades across 4 rank bands. Types:
- **Passive:** Always active once purchased
- **Active:** Must be equipped, charges during play, manually activated
- **Feature:** Unlocks UI element or capability

### Onboarding Band (Ranks 2-9) — 8 Upgrades

| Upgrade | Type | Rank | Effect per Level | Max |
|---------|------|------|------------------|-----|
| Circuit Stabilizer | Passive | 2 | +0.75s lights grace | 4 |
| Auto-Popper | Passive | 3 | -4% end-game decay | 4 |
| Capacitor Efficiency | Passive | 4 | -6.25% laser drain | 4 |
| Cooldown Booster | Active | 5 | +25%/35%/50% cooldown | 3 |
| Gear Lubrication | Passive | 6 | +12.5% heat dissipation | 4 |
| Focus Mode | Passive | 7 | -10% time speed at console | 4 |
| Dense Goop | Passive | 8 | +12.5% fall speed | 4 |
| Pressure Control | Passive | 9 | +5s shift duration | 8 |

### Junk Band (Ranks 10-18) — 4 Upgrades

| Upgrade | Type | Rank | Effect per Level | Max |
|---------|------|------|------------------|-----|
| Junk Uniformer | Passive | 10 | +10% same-color junk | 4 |
| Goop Swap | Passive | 12 | -0.25s swap time | 4 |
| Goop Dump | Active | 15 | Rain 1/2/3 waves of junk | 3 |
| Sealing Bonus | Passive | 18 | +5% cooldown per seal | 4 |

### Mixer Band (Ranks 20-28) — 4 Upgrades

| Upgrade | Type | Rank | Effect |
|---------|------|------|--------|
| Active Expansion Slot | Feature | 20 | Equip 2 actives |
| Goop Hold Viewer | Feature | 22 | Shows held goop |
| Goop Colorizer | Active | 25 | Next 6/7/8 pieces match color |
| Goop Window | Feature | 28 | Preview next piece |

### Cracked Band (Ranks 30-38) — 4 Upgrades

| Upgrade | Type | Rank | Effect per Level | Max |
|---------|------|------|------------------|-----|
| Slow Cracks | Passive | 30 | -5% growth chance | 4 |
| Crack Matcher | Passive | 32 | +25% color bias to cracks | 4 |
| Crack Down | Active | 35 | Next 3/5/7 cracks spawn low | 3 |
| Active Expansion Slot 2 | Feature | 38 | Equip 3 actives |

---

## Active Abilities

Active abilities are upgrades that can be equipped and manually activated.

### Equipping

- Must purchase AND equip to use
- Default: 1 slot
- Rank 20: 2 slots (Active Expansion Slot)
- Rank 38: 3 slots (Active Expansion Slot 2)

### Charging

| Active | Charge Time | Passive Rate |
|--------|-------------|--------------|
| Cooldown Booster | 20s | 5%/sec |
| Goop Dump | 15s | 6.67%/sec |
| Goop Colorizer | 25s | 4%/sec |
| Crack Down | 30s | 3.33%/sec |

**Bonus:** +25% charge per sealed crack-goop unit (instant on pop)

**Visual:** Grey circle fills with color, glows when ready (100%)

### Ability Effects

**Cooldown Booster:** Extends all active complication cooldowns
- Level 1: +25%
- Level 2: +35%
- Level 3: +50%

**Goop Dump:** Rains same-color junk from top
- Level 1: 1 wave (18 pieces)
- Level 2: 2 waves (36 pieces)
- Level 3: 3 waves (54 pieces)
- Wave delay: 600ms between waves
- Spawn interval: 80ms between pieces

**Goop Colorizer:** Locks next N pieces to current falling piece's color
- Level 1: 6 pieces
- Level 2: 7 pieces
- Level 3: 8 pieces

**Crack Down:** Next N cracks spawn in bottom 4 rows
- Level 1: 3 cracks
- Level 2: 5 cracks
- Level 3: 7 cracks

---

## Rank progression philosophy (v1 DESIGN_VISION)
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
