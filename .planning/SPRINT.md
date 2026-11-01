# Sprint 28 — Text size that works everywhere + a lighter first visit
Started 2026-10-31 · Milestone M6 1.0 · Features: F76, F72, F71
What changes for Muzzy: Settings → Text size 125–200% no longer breaks the console (footer words, the rank meter, the monitor, Upgrades over the gear — B005), and the offline copy a phone downloads on its first visit gets smaller (fonts Goops never uses dropped, lighter icons). Stays the same: how the game looks at 100% text, the rules, sound, the live site (nothing deploys — the next deploy is the 1.0 /deliver, with Muzzy).
Planned unattended (Muzzy: "go auto mode. i'm going to a halloween party", 2026-10-31) — F53 — Final sound + music + intercom voice waits for the sounds Muzzy hunts; F73 — Crisp pixel type waits on the UI kit's pixel-grid option.

## F76 🐞 Text size breaks the console
Done when: B005 fixed — at Text size 125 / 150 / 200% the console's words stay inside their spots (footer, rank meter + DUE, monitor text) and Upgrades no longer covers the gear, at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080) · a check guards it (red on the old code) · B005 moved to Fixed with Guarded by.
Check: an e2e run of the console at Text size 100 / 125 / 150 / 200% at every portrait size (words inside their art spots, nothing covering the gear's centre); screenshots looked at by Claude · check:fast
- [x] 🤖 1. Measure B005 on today's code (UI kit 0.37.3): screenshots at 125 / 150 / 200% at every portrait size; list what really breaks now and what's the kit's vs Goops' — src/ui/Console.tsx
- [x] 🤖 2. Fix the console: words drawn on the art take the art's own size (art.json words.*.text), not the root font size; the bottom row (Upgrades + gear) keeps apart — src/ui/Console.tsx
- [ ] 🤖 3. e2e check at every Text size + portrait size (fails on the old code) — e2e/console-shots.mjs
- [ ] 🤖 4. Anything that's the UI kit's own bug → a note for the framework session in STATE (no edits in the kit copy); B005 → Fixed in BUGS.md — .planning/BUGS.md

## F72 ❓ Pinch zoom on or off
Done when: Muzzy picks (Ask Muzzy in Notes), written as a TDD decision; index.html's viewport matches.
why: players who need bigger words get them from Text size instead of pinch zoom — so Text size has to really work first (F76).
- [ ] 🙋 1. Muzzy decides pinch zoom (Ask Muzzy below) → Claude writes the TDD decision (next free D number) and sets index.html — .planning/TDD.md

## F71 🧱 Real-phone performance pass
Done when: the offline copy skips the kit fonts Goops never uses (Goops uses only Nokia Cellphone FC — measure the bytes saved) and the icons are lighter (same look) · offline still works (e2e/sw-update) · a mid + a low Android measured with ?fps through a busy rank-30+ shift, jelly vs particle, result in TDD Key facts.
why: a phone on a slow connection gets into the game sooner, and we know it runs smoothly on real phones before 1.0.
Check: build + the precache list read (before/after sizes) · e2e/sw-update · icons looked at side by side · Muzzy's phone numbers in TDD Key facts
- [ ] 🤖 1. Drop the kit fonts Goops never uses from the offline copy (globIgnores in the PWA settings; nothing loads them) — before/after precache size — vite.config.ts
- [ ] 🤖 2. Shrink the icons (lossless / palette PNG, same pixels look) — before/after sizes — public/icons/icon-512.png
- [ ] 🤖 3. Offline still works: e2e/sw-update + the precache list — e2e/sw-update.mjs
- [ ] 🙋 4. Muzzy: a mid + a low Android, ?fps through a busy rank-30+ shift, jelly and particle — tell Claude the numbers (Claude writes them into TDD Key facts) — .planning/TDD.md

## Notes
- Open bugs: no P0/P1. B005 (P2) = F76. B007 (P3, 390x844) — check if it's in Console.tsx while there.
- Ask Muzzy: (F72) pinch zoom — 1. keep it OFF (Claude's pick: the tank uses drags and swipes, a pinch would fight them; Text size covers bigger words) · 2. turn it ON (WCAG's default; may zoom the page mid-shift).
- NEVER deploy in this sprint (deploy.js publishes the whole site now — the switch is the 1.0 /deliver, with Muzzy).
- F76 task 1 — B005 measured on today's code (2026-10-31, UI kit 0.37.3, `node e2e/text-size.mjs`: 5 portrait sizes × Text size 100/125/150/200% × a rank-0 and a rank-12 save; shots e2e-shots/text-size/, copy in ~/Documents/dev/.scratch/goops-f76/before-shots). 166 of 1400 checks red. What breaks (failures per size, r0 save):
  - 390x844: 100% ok · 125% 5 · 150% 8 · 200% 11 — 360x780: 100% 1 (the gear 1 px from Upgrades — already touching at 100%) · 125% 6 · 150% 9 · 200% 12 — 1100x800: ok · 2 · 6 · 7 — 1440x900: ok · ok · 3 · 6 — 1920x1080: ok · ok · ok · 6
  - Footer (version · RANK SELECT · MuzzyMade): spills its spots from 125% on phones, the three run together at 150%+ (all sizes at 200%).
  - Rank meter: "Operator rank 0 · 0 / 3,500 DUE" past its spot from 150% on phones; at 200% on 390 it ends at 444 px (window 390).
  - Panel labels (Laser / Controls / Visor): Controls spills its spot at 200%.
  - Bottom row: Upgrades and the gear overlap from 125% on phones (390 at 200%: the gear's centre hits Upgrades' badge); the GOOPS title runs under the gear too (it grows with Text size: TitleArt is rem-sized); at 360 they touch even at 100%.
  - Monitor: the hint ("Pull down the periscope") stays on its screen at every size — the toaster grows; the bug's "monitor text spills" didn't reproduce on the hint.
  - Why (the kit's, not Goops'): every art word sits on the kit's floor `max(0.625rem, art size)` (art.css `.kit-art-layer[data-text]`) — 0.625rem is 10 px at 100% but 20 px at 200%, while the spot keeps the art's size; the font px table shows every art word = exactly the floor from 125% on (12.5 / 15 / 20 px) on every size. The meter's words are em of the same layer. RANK SELECT (a kit Button) the same. The gear (`size: s` = 3rem) and title (3.5rem) are rem-sized pictures, so they grow with Text size too, and the kit Screen's bottom row (1fr auto 1fr) lets the gear slide under a centre that's too wide. Goops' part: the console's bottom row puts Upgrades + the gear side by side on a phone with no room for either to grow.
- F76 task 2 — the fix (Claude's calls, Muzzy can overrule):
  - Words drawn on the art (footer, RANK SELECT, rank meter, panel labels; the end-game screen's too) keep the art's own size at every Text size — they're part of the picture and their spot can't grow. Floor = art.json wordsMinPx 10 (px, what 0.625rem was at 100%), set in main.tsx; app.css overrides the kit's art-words rule with that floor (kit gap → STATE note). At 100% nothing changes (font table identical).
  - The monitor's words are reading text: they grow with Text size — at least art.json console.crt.wordsMinRem 0.7rem (100%: the art's own size still wins, 11–19 px; 125% 14 px · 150% 16.8 · 200% 22.4 on every screen). The screen slides down for longer lines as before (lessons.css .crt font-size).
  - The Upgrades button's words grow with Text size (kit button, reading text). The GOOPS title and the gear are pictures: they keep their 100% size (art.json console.bottomRow titlePx 56, gearPx 48 — the kit's 3.5rem / 3rem at 100%). Between shifts the gear now sits beside the title instead of beside Upgrades (app.css) — on a 360 phone they touched even at 100%, and Upgrades at 200% is nearly the screen's width. Ask Muzzy: the gear one row lower (beside GOOPS) at every Text size — OK? (Claude's pick: yes; one layout at every size, no jumping.)
  - Rank meter: art-sized like the rest of the art words (its numbers are also on the report); not grown.
  - B007 (Gameplay tab's Goo style row) is in the kit's Settings row layout, not Console.tsx — left for the framework.
  - After: e2e/text-size.mjs ALL PASS (1540 checks: 5 sizes × 4 Text sizes × rank 0 / rank 12 / a lesson line). check:fast green (2 new check:ui warnings: "restyles kit part .kit-art-layer / .kit-screen" — the kit gap, in the STATE note).
