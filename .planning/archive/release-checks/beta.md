# Release check — beta
<!-- F83: an alpha / beta / 1.0 release is refused until every line for its stage is filled in and ticked.
     Lives at .planning/archive/release-checks/<stage>.md (one per stage — alpha.md, beta.md, 1.0.md).
     Fill the <…> part in plain words, then tick it: "- [x] Devices: iPhone 13 (Safari), Pixel 7 (Chrome), PC (Chrome)".
     A line in brackets [beta+] / [1.0] only counts from that stage on — leave it unticked before then. -->
<!-- 2026-10-29 (auto mode, Muzzy driving): Claude filled what the checks and the files prove. Ticked = true today.
     Unticked = Ask Muzzy (only he knows) or not true yet — releasing with those open is his call (--no-release-check-ok). -->

- [ ] Devices: PC (Chrome) by Muzzy through every sprint, incl. the whole ending (F65) and the final shift (F64); headless Chromium in check:full at 360x780, 390x844, ~1100 wide, 1440x900, 1920x1080 — Ask Muzzy: which real phones (and browsers) has the beta build been played on?
- [x] Phone sizes: Goops is portrait only (Muzzy). 360 and 390 wide upright are checked in every screen's shots, incl. the ending + end-game screen (e2e/ending.mjs) and the valve panel (e2e/final-shift.mjs); sideways shows the "Turn your phone upright" card (e2e/portrait.mjs)
- [ ] First-time player: Ask Muzzy: has a friend played the alpha link (https://thebluemuzzy.github.io/GOOPS/alpha/) for the first time — who, and did they get through the first day without help? (no playtest log in research/playtests/ yet)
- [ ] What they got stuck on: Ask Muzzy — waits for that first play
- [ ] Sound and settings: e2e/sound.mjs (a shift with sound, pause, the Sound tab), e2e/controls.mjs (Wall kick + Audio tab), e2e/lessons.mjs (Replay lessons), e2e/sw-update.mjs (About → Version) — NOT tried yet: Reduce motion through the ending, and sound off on a real phone
- [x] Store page: none for the beta — the link is https://thebluemuzzy.github.io/GOOPS/alpha/ (no itch page yet; the beta goes to the same address)
- [x] Privacy and age rating: TDD §7 — nothing leaves the device (browser storage only, the player's typed name stays on the device; no accounts / analytics / third-party requests); no store page, so no privacy page or age rating yet — due with a store page
- [ ] Credits: content/credits.json lists every asset, but there is still no Credits screen in the game (the Settings row is off; F55 — Credits screen is a 1.0 must)
- [ ] [beta+] No stand-in art: NOT true yet — the 26 sounds are recorded CC0 placeholders (F53 — Final sound, 1.0), ConsoleHatch.svg + NotAFace.svg are Claude's placeholder drawings (Muzzy may redraw), the ending's goop is drawn in CSS; credits.json marks none of them stand-in
- [x] [beta+] Bugs: no open P0, P1 or P2 — 4 open P3s (B001–B004, test flakes under load + small first-day nits), listed in the patch notes' Known issues
