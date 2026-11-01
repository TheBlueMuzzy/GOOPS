# Sprint 28 — Text size that works everywhere + a lighter first visit
Started 2026-10-31 · Milestone M6 1.0 · Features: F76, F72, F71
What changes for Muzzy: Settings → Text size 125–200% no longer breaks the console (footer words, the rank meter, the monitor, Upgrades over the gear — B005), and the offline copy a phone downloads on its first visit gets smaller (fonts Goops never uses dropped, lighter icons). Stays the same: how the game looks at 100% text, the rules, sound, the live site (nothing deploys — the next deploy is the 1.0 /deliver, with Muzzy).
Planned unattended (Muzzy: "go auto mode. i'm going to a halloween party", 2026-10-31) — F53 — Final sound + music + intercom voice waits for the sounds Muzzy hunts; F73 — Crisp pixel type waits on the UI kit's pixel-grid option.

## F76 🐞 Text size breaks the console
Done when: B005 fixed — at Text size 125 / 150 / 200% the console's words stay inside their spots (footer, rank meter + DUE, monitor text) and Upgrades no longer covers the gear, at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080) · a check guards it (red on the old code) · B005 moved to Fixed with Guarded by.
Check: an e2e run of the console at Text size 100 / 125 / 150 / 200% at every portrait size (words inside their art spots, nothing covering the gear's centre); screenshots looked at by Claude · check:fast
- [ ] 🤖 1. Measure B005 on today's code (UI kit 0.37.3): screenshots at 125 / 150 / 200% at every portrait size; list what really breaks now and what's the kit's vs Goops' — src/ui/Console.tsx
- [ ] 🤖 2. Fix the console: words drawn on the art take the art's own size (art.json words.*.text), not the root font size; the bottom row (Upgrades + gear) keeps apart — src/ui/Console.tsx
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
- [x] 🤖 1. Drop the kit fonts Goops never uses from the offline copy (globIgnores in the PWA settings; nothing loads them) — before/after precache size — vite.config.ts
- [x] 🤖 2. Shrink the icons (lossless / palette PNG, same pixels look) — before/after sizes — public/icons/icon-512.png
- [ ] 🤖 3. Offline still works: e2e/sw-update + the precache list — e2e/sw-update.mjs
- [ ] 🙋 4. Muzzy: a mid + a low Android, ?fps through a busy rank-30+ shift, jelly and particle — tell Claude the numbers (Claude writes them into TDD Key facts) — .planning/TDD.md

## Notes
- Open bugs: no P0/P1. B005 (P2) = F76. B007 (P3, 390x844) — check if it's in Console.tsx while there.
- Ask Muzzy: (F72) pinch zoom — 1. keep it OFF (Claude's pick: the tank uses drags and swipes, a pinch would fight them; Text size covers bigger words) · 2. turn it ON (WCAG's default; may zoom the page mid-shift).
- NEVER deploy in this sprint (deploy.js publishes the whole site now — the switch is the 1.0 /deliver, with Muzzy).
- F71 task 1: a probe on the built game (console + Settings + Upgrades, 390 and 1440 wide) loaded only `Nokia Cellphone FC` (nokiafc22.ttf) — none of the 9 kit woff2 files, not 6 as the roadmap guessed (every role in style.json is Nokia). → globIgnores `assets/*.woff2`: precache 83 entries 2038.96 KiB → 74 entries 1817.21 KiB (−222 KiB). The files stay in the build (fetched online if ever used). Guard: tests/offlineFonts.test.ts — red if a style.json font role names anything but a fonts.json font.
- F71 task 2: icons → palette PNGs (sharp/libimagequant, quality 100, dithered; script in .scratch/goops-f71/squash.mjs): 357.8 KB → 130.3 KB (icon-512 177.6 → 61.9 KB, maskable-512 89.3 → 35.1 KB, 192s ~2.5× smaller). Looked at by Claude side by side + 2× zoom: only a fine dither grain at 2×, same look at real size. Pillow's own 256-colour try (no libimagequant) banded the goo — not used. Precache now 1595.11 KiB (from 2038.96 at sprint start, −22%).
