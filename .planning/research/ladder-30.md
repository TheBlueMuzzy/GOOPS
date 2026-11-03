# The 30-rank ladder (plan, 2026-11-02)

Muzzy 2026-11-02: "something tells me we could cut the levels in half — offer twice the rewards, and make it so that the gaps are filled in pretty nicely. this would help the game not feel so impossibly long." Then: "let's aim for 30 levels, down from 50" · ~6 ranks where little happens but story, toward the end · scraps can be injected wherever we want (the Veteran's emergency transfer when he's caught, with a note) · still 1 scrap every rank · the Veteran goes silent for a rank or two after he's caught (an "empty" rank) · the takeover gets more than one rank · "ensure the architecture makes pivots like this easier".

Nothing is built yet. This file is the plan; ROADMAP has the features (F78 — One rank ladder file … F82 — Balance on 30 ranks).

## 1. Why (MDA)
- **Mechanic today:** 51 ranks, 21 upgrades on 21 of them, 30 ranks with no upgrade (11, 13, 14, 16, 17, 19, 21, 23, 24, 26, 27, 29, 33, 34, 36, 37, 39–49 …).
- **What players do:** most rank-ups hand over a scrap and nothing new to try; ranks 39–50 give nothing new to buy at all.
- **How it feels:** "impossibly long" — the number 50 looks far, and the empty ranks make the climb feel like a grind.
- **Change:** ~31 ranks (0–30), nearly every rank brings something new; the quiet ranks are story beats on purpose (the Veteran's silence, the takeover).

## 2. The new ladder (draft — every number is a ladder.json value, see §4)
| New | Old | Complication / tank change | Upgrade | Story / scraps |
|---|---|---|---|---|
| 0 | 0 | 4 colours · the first day | — | Management teaches |
| 1 | 1–2 | next-piece window · visor can break | Circuit Stabilizer | |
| 2 | 3 | 5 junk cells · Swap | Auto-Popper | |
| 3 | 4 | laser can break | Capacitor Efficiency | |
| 4 | 5 | the Upgrades shop opens | Cooldown Booster | the Veteran first speaks · **+3 scraps** (a starter grant: ranks 1–3's upgrades are waiting) |
| 5 | 6 | controls can break · junk 8 | Gear Lubrication | |
| 6 | 7 | — | Focus Mode | |
| 7 | 8 | — | Dense Goop | |
| 8 | 9 | junk 11 | Pressure Control | |
| 9 | 10 | — | Junk Uniformer | |
| 10 | 10 | **5th colour** | Goop Swap | |
| 11 | 15 | — | Goop Dump | |
| 12 | 18 | — | Sealing Bonus | |
| 13 | 20 | — | Active Expansion Slot | |
| 14 | 22 | — | Tougher Tank | |
| 15 | 20 | **two-colour pieces** | Goop Colorizer | |
| 16 | 28 | — | Quick Fix | |
| 17 | 30 | **cracks grow** · **6th colour** | Slow Cracks | the Veteran is caught · **his emergency transfer: +8 scraps and a note** |
| 18 | — | — | — | **quiet:** the speaker is silent |
| 19 | — | — | — | **quiet:** still silent (fines go on) |
| 20 | 31 | **the white goop — he's back, gooped** | Focus Mode II | the reveal after the silence |
| 21 | 32 | — | Crack Matcher | |
| 22 | 35 | — | Crack Down | |
| 23 | 38 | — | Active Expansion Slot 2 | |
| 24 | 39 | — | (open: a spot for repair bots, F50 — Repair bots (maybe the rank-40s upgrade band)) | the goop starts speaking to you |
| 25 | 40 | **wild goop** | — | |
| 26 | 41–43 | — | — | takeover · **+2 scraps** (the goop's gift) |
| 27 | 44–45 | — | — | takeover · **+2** |
| 28 | 46–47 | — | — | takeover · the hatch · **+2** |
| 29 | 48–49 | — | — | takeover · the mouths sing together · **+2** |
| 30 | 50 | **7th colour** · **the final shift** | — | |

- Quiet ranks (story only): 18, 19, 26, 27, 28, 29 = the "6 added back" Muzzy asked for.
- Big tank changes land on 10, 15, 17, 20, 25, 30 (today's "on the 0s" rule becomes "on the 5s", with 17 the exception — the capture).

## 3. Scraps (the drip)
- Today: 1 scrap a rank → 50 scraps; maxing every upgrade = **70 levels** (each level costs 1, free take-backs) — so you never own it all; upgrades are a loadout you choose (design/upgrades-map.md, "F33 decisions" 4).
- New, 1 a rank (30) + grants: rank 4 +3 · rank 17 +8 (the Veteran) · ranks 26–29 +2 each (8) = **49** — the same "you choose" squeeze as today.
- Each grant is a ladder.json value (`scraps`), so the drip is edited in one place; the economy sim (F51 — Economy sim) reads it.

## 4. Make pivots easy — the architecture
Today (audit 2026-11-02): nearly every rank rule is already in content/, but in **14 separate fields across 9 files** (progression unlocks + titles, shift colours / junk / quota, breakdowns × 3, twists × 3, whiteGoop, finalShift, payslip × 3, eyes chorus, art hatch, moments by rank number, upgrades × 21); one code file hard-codes ranks (src/goo/shared/faces.ts: 10 / 20 / 30 / 40); **~285 test lines + ~240 e2e lines** restate rank numbers (`?rank=40`, `rank: 31`); the story is keyed by rank number (moments.json "31": …, en.json keys like r0sign).
- **One ladder file** — `content/tuning/ladder.json`: every rank gate is a NAMED beat with one rank (`"grow": 17`, `"wild": 25`, `"veteranCaught": 17`, `"facesOn": 10` …), each rank's scraps grant, titles, the top rank. Every system asks `rankOf('grow')` — no system keeps its own `fromRank`. Moving a beat = one number in one file.
- **Story by beat, not by number** — moments.json keyed by the ladder's rank slots via a beat name or an ordered list, so compressing ranks re-points lines instead of renaming keys.
- **Tests + e2e ask the ladder** — a shared helper (`rankOf('wild')`, `?rank=${rankOf('wild')}`), so a pivot changes no test. A lint rule refuses a bare rank number in tests / e2e / game code (except 0), like the framework lint's no-tuning-numbers.
- **Saves follow the ladder** — the save stores total XP, so rank is worked out; a ladder change ships a save upgrade (saves version + 1) that maps old rank → new rank by beat, with a golden save of every old band.
- **A Dev Kit "Ladder" tab** — the chart above, live from ladder.json: Muzzy drags a beat to another rank and the running game follows (module contract: live).
- **Framework first** — the ladder (beats + rankOf + the chart + the lint rule + the save remap helper) is a framework module piece, so the next game with levels starts with it; BMUZ PROJECT-FILES gets one rule: "level/rank gates live in one ladder file; never a rank number in code or tests".

## 5. Concerns
1. **Story rewrite** — 51 moments → 31: Veteran lines 10–29 (one a rank) squeeze into ranks 9–17; the takeover's 11 ranks into 5 (26–30). Claude drafts the merge, Muzzy picks; titles (11, every 5 ranks) re-space.
2. **Balance** — F52 — Balance pass tuned quota / colours / junk / XP to 50 ranks → a full bot-career rerun (F82 — Balance on 30 ranks), and F49 — Covered cracks drain half? (bot rerun) folds into the same rerun.
3. **XP length** — today ~70 shifts to the top. Target to be set by Muzzy (Claude's pick: ~45–50); the sim finds xpBase / xpPerRank.
4. **Two-colour pieces (15) and growing cracks (17) are 2 ranks apart** — today 10 apart. The sim shows whether the jump is too steep; the fix is one ladder number.
5. **Beta players' saves** — anyone mid-career maps to the new ladder (F81 — Saves follow the ladder).
6. **F73 — Crisp pixel type is in progress** — this plan doesn't touch it; order is Muzzy's call.

## 6. Build order (ROADMAP)
F78 — One rank ladder file (framework + Goops) → F79 — No rank numbers in code or tests → F80 — The 30-rank ladder (content + story + scraps) → F81 — Saves follow the ladder → F82 — Balance on 30 ranks (+ F49 — Covered cracks drain half? (bot rerun)).
