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

## 7. Muzzy's answers (2026-11-02)
- **Story:** streamline it, or let some ranks carry a little more story than normal (more than one moment on a rank is fine).
- **Two-colour (15) → growing cracks (17):** growing cracks become less of a jump by working differently → **F83 — Growing cracks take a new crack's place**: when a new crack would form, an X% chance it extends an existing crack that isn't covered yet, only from its uncovered cells. Same crack cells appear; the difficulty is covering the whole crack. Today's timer growth goes; Slow Cracks needs a new meaning (Claude's pick: it lowers X).
- **The Veteran's +8:** "yeah that's fun. feels right."
- **Saves:** "we don't care about this. there are no beta players right now. just me." → F81 cut; the save-remap helper is out of F78. A fresh career after the switch is fine (Muzzy's own save can use RANK SELECT).
- **Order:** the ladder before F73 — Crisp pixel type.
- **Length:** ~45–50 shifts to the top (F82 — Balance on 30 ranks finds the XP numbers).

Build order now: F78 — One rank ladder file → F79 — No rank numbers in code or tests → F80 — The 30-rank ladder + F83 — Growing cracks take a new crack's place → F82 — Balance on 30 ranks (+ F49 — Covered cracks drain half? (bot rerun)) → F73 — Crisp pixel type.

## 8. Story mapping (draft — Muzzy may move any)
Built in F80 (2026-11-03). Each moment's rank is one number in `content/tuning/ladder.json` → `story` (the moment id = the old rank it was written for). Words unchanged; **no joining lines were needed** — every shared rank reads in order (checked pair by pair below). Rules kept: the story's order (a test refuses a later moment at an earlier rank), the Veteran's old 10–29 on new 9–17, the capture on 17, **18–19 silent** (a test: no moment between veteranCaught and whiteGoop; fines and paydays go on), the white goop on 20, the goop's voice from 24, the takeover 26–29, the ending at 30. A rank-up now plays every moment of its own rank (moments.json catchUp counts ranks — F80).

20 Veteran moments (old 10–29) on 8 ranks can't be "two a rank": four ranks carry three (14, 15, 16, 23) — each is one short bubble, so a three-moment visit is ~6 taps.

| Old | New | Id | What's said (one line) | Why there |
|---|---|---|---|---|
| 0 | 0 | 0 | MON: welcome, sign here, keep the tank from exploding | the first day |
| 1 | 1 | 1 | MON: first payday; next-piece window installed (rental billed) | nextPiece 1 |
| 2 | 1 | 2 | MON: periscope on backorder; the old one will do | visorBreaks 1 (old 2 merged into 1) |
| 3 | 2 | 3 | MON: swapping permitted; G.O.O.P.S. acronym #1 | swap 2 |
| 4 | 3 | 4 | MON: laser power rationed; zap responsibly | laserBreaks 3 |
| 5 | 4 | 5 | SPK: "you the new one? scraps in your panel. don't tell the screen" | upgradesShop 4 (+3 scraps: the "scraps in your panel") |
| 6 | 5 | 6 | SPK: controls run hot | controlsBreak 5 |
| 7 | 6 | 7 | SPK: screen fine you yet? | one a rank, in order |
| 8 | 7 | 8 | SPK: you hear it too? the cold voice | whispersFeelings 7 (the whispers start every shift) |
| 9 | 8 | 9 | SPK: got you a pressure part (look: Upgrades) | pressureControl 8 |
| 10 | 9 | 10 | SPK: look close at the big clumps… they look back | facesOn 9 |
| 11 | 9 | 11 | SPK: don't let the eyes get to you, zap 'em anyway | follows 10 (eyes) |
| 12 | 10 | 12 | SPK: screen says there's no voices (monitor flickers) | noVoices 10 · 5th colour |
| 13 | 10 | 13 | SPK: how long you signed for? …me too | follows 12 |
| 14 | 11 | 14 | SPK: ever count the operators before you? | in order |
| 15 | 11 | 15 | SPK: words now, right? that's them learning | whispersWords 11 |
| 16 | 12 | 16 | SPK: ask the screen what the tank's for | in order |
| 17 | 12 | 17 | SPK: found a manual — half fines, half blank | in order |
| 18 | 13 | 18 | SPK: pressure's not a side effect… forget I said that | then 19 reads as him backing off |
| 19 | 13 | 19 | SPK: keep your head down this week, they're counting watts | follows 18 |
| 20 | 14 | 20 | SPK: see 'em clumping? different colours, holding on, like hands | the slot before two-colour pieces (15) — see Ask Muzzy |
| 21 | 14 | 21 | SPK: where'd the last operator go? "retired." ask where | in order |
| 22 | 14 | 22 | SPK: tank's older than the Company says | in order |
| 23 | 15 | 23 | SPK: screen fined me for coughing | in order |
| 24 | 15 | 24 | SPK: you hear 'em say a name yet? | whispersNames 15 |
| 25 | 15 | 25 | SPK: nobody pays it off, nobody leaves | in order |
| 26 | 16 | 26 | SPK: operator list goes back 900 names | in order |
| 27 | 16 | 27 | SPK: they tell you names yet? write 'em down | in order |
| 28 | 16 | 28 | SPK: gonna show you something, next shift | the rank before the capture ("next shift" = 17) |
| 29 | 17 | 29 | SPK: the goop is us… they don't retire you, they ── (cut) | runs straight into 30 — the cut-off now lands on the capture itself |
| 30 | 17 | 30 | SPK cut + MON alarm: OPERATOR #0001 SCHEDULED FOR RETIREMENT | veteranCaught 17 (+8 scraps, his note on that payday) |
| — | 18 | — | (silence) | quiet: the speaker is gone |
| — | 19 | — | (silence) | quiet: still gone |
| 31 | 20 | 31 | HEAD: …new… one… white… he is… here… | whiteGoop 20 |
| 32 | 20 | 32 | HEAD: …he helps… we help… too… | follows 31 |
| 33 | 21 | 33 | HEAD: …tight… you feel it… | in order |
| 34 | 21 | 34 | HEAD: …we were… operators… like you… | in order |
| 35 | 22 | 35 | HEAD (him): …kid… it's me… keep working… | in order |
| 36 | 22 | 36 | HEAD: …he says… you have… a name… {name} | follows 35 (he told them) |
| 37 | 23 | 37 | HEAD (him): …it's warm in here… | in order |
| 38 | 23 | 38 | HEAD: …please… not the laser… | in order |
| 39 | 23 | 39 | HEAD: …your name… is on a list… | pendingRetirement 23 |
| 40 | 24 | 40 | SPK: can you hear me? got to the wire through a crack | the speaker's back the rank the goop speaks |
| 41 | 24 | 41 | GOOP: …we… can talk… here too… LOUD… | the goop's voice from 24 (right after him: they followed him onto the wire) |
| 42 | 25 | 42 | SPK: the pressure's power, kid | wildGoop 25 · mouths |
| 43 | 26 | 43 | GOOP: …the screen… is not… people… | takeover 1 (+2) |
| 44 | 26 | 44 | SPK: ever seen who reads your reports? | follows 43 — both about who's behind the screen |
| 45 | 27 | 45 | MON: CONGRATULATIONS, HUMAN RESOURCE. *OPERATOR (glitch) | takeover 2 (+2) |
| 46 | 28 | 46 | SPK: there's a valve under your console (hatch rattles) | hatch 28 · takeover 3 (+2) |
| 47 | 28 | 47 | MON: THERE IS NO RELEASE VALVE. DO NOT LOOK UNDER YOUR CONSOLE | Management answers 46 at once |
| 48 | 29 | 48 | GOOP: …when you open it… we go… home… | eyesChorus 29 · takeover 4 (+2) |
| 49 | 29 | 49 | SPK: last stretch, kid… next shift they come at you with everything | the rank before the final shift |
| 50 | 30 | 50 | MON: FINAL PERFORMANCE REVIEW. PRESSURE INCREASED 400% | finalShift 30 · 7th colour |

- Ask Muzzy: moment 20 ("different colours, holding on — like hands") now plays at 14, one rank BEFORE two-colour pieces arrive (15). Keep it as a foreshadow, or move it to 15 (then 15 carries four: 20, 23, 24, 25)?
- Ask Muzzy: 26 and 27 carry one moment each, 28 and 29 two — the takeover is thinnest at its start. Fine as a slow build, or pull 42 (wild goop, rank 25) onto 26?
