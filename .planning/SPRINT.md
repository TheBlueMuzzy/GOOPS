# Sprint 14 — the end report becomes a payslip
Started 2026-10-23 · Milestone M5 Beta · Features: F41
What changes for Muzzy: the rank meter reads CREDITS / PAYMENT DUE; every shift's report shows gross pay, 3 fines and the net; each rank-up rolls a payday (5 deductions, one line at a time, then the passage debt). Stays the same: XP numbers, rank speed and balance — fines are for show, the net always equals the real XP.

## F41 🎮 Credits, fines and payday on the end report
Done when: the report shows gross → fines → net = the shift's real XP; every rank-up shows a payday (exactly the payment due, in 5 lines, then the passage-debt line); two rank-ups → two paydays; the first day has no fines ("Day one is on us"); fines come from what really happened first, then silly ones gated by rank; the rank meter says CREDITS / PAYMENT DUE; every number in content/; the report card is a fixed size at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080 — portrait only, never landscape).
why: never getting ahead — the Company takes it all, but you still rank up every time (sketch S8, Muzzy: "so good. approved").
Check: unit tests for the payslip maths (net = XP for many scores and ranks, paydays sum to the payment due, double payday, first day) · e2e/payslip.mjs screenshots of a normal report, a payday and a double payday at every portrait size, looked at · check:full
- [x] 🤖 1. The payslip maths: gross, fines, net, paydays, passage debt, first day — src/progress/payslip.ts + content/tuning/payslip.json
- [x] 🤖 2. The fine and payday lines as editable text (fines from the shift's events, silly fines with their starting ranks, payday items, the debt line) — content/text/en.json
- [x] 🤖 3. The rank meter becomes CREDITS / PAYMENT DUE — src/ui/Console.tsx
- [ ] 🤖 4. The end report with the payslip and paydays, lines one at a time, fixed-size card — src/ui/App.tsx
- [ ] 🤖 5. e2e check + screenshots at every portrait size; TDD + GDD updated — e2e/payslip.mjs
- [ ] 🙋 6. Muzzy plays a few shifts through a payday and says how it feels — src/ui/App.tsx

## Notes
- Plan OK (Muzzy 2026-10-23: "ok. /develop"). Sprint picked: "A. fine" (story build first).
- No open P0/P1 bugs (B001–B003 are P3, not in these files).
- Tasks 1–3 (Claude): payslip maths + 9 unit tests (net = XP over 7 ranks × 6 scores × 3 seeds; paydays = the payment due; double payday; first day; debt barely moves < 30, rises after); en.json payslip (9 real fines, 18 silly, 4 payday items + 5 rotating extras); the meter unit XP → PAYMENT DUE ("Operator rank 2 · 3,250 / 4,250 PAYMENT DUE", as S8). Passage debt is worked out from the rank (seeded interest per rank) — nothing new in the save. Report layout: the payslip rows go in the kit report, each payday is its own short screen after it; the rows-one-at-a-time reveal + per-row tone are a kit request → framework F113, UI kit 0.31.0 (with the talking bubble). Until it lands, rows show all at once.
