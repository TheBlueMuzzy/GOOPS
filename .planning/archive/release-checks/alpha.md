# Release check — alpha
<!-- F83: an alpha / beta / 1.0 release is refused until every line for its stage is filled in and ticked.
     Lives at .planning/archive/release-checks/<stage>.md (one per stage — alpha.md, beta.md, 1.0.md).
     Fill the <…> part in plain words, then tick it: "- [x] Devices: iPhone 13 (Safari), Pixel 7 (Chrome), PC (Chrome)".
     A line in brackets [beta+] / [1.0] only counts from that stage on — leave it unticked before then. -->
<!-- 2026-10-20 (/deliver v0.1.0): Muzzy chose "Release now" — the alpha IS the friends test, so the friends' first
     plays become the playtest log and fill the open lines; released with --no-playtest-ok + --no-release-check-ok
     (written into the release commit). Ticked = true today; unticked = what the friends' plays must answer. -->

- [ ] Devices: PC (Chrome) by Muzzy through the sprints; headless Chromium in the checks at 360x780, 390x844, 1440x900 — no real phone on the release build yet: Muzzy installs the live alpha on two phones right after the deploy (fps + install)
- [x] Phone sizes: Goops is portrait only (Muzzy). 360 and 390 wide upright checked in every screen's shots (console, tank, HUD, lessons, first day, report); sideways shows the "Turn your phone upright" card (e2e/portrait.mjs)
- [ ] First-time player: nobody new has played yet — the friends who get the alpha link are the first; their first day is the test
- [ ] What they got stuck on: waits for those first plays
- [ ] Sound and settings: e2e/sound.mjs plays a shift with sound, pauses it and uses the Sound tab; Wall kick + the Audio tab (e2e/controls.mjs), Replay lessons (e2e/lessons.mjs), About → Version (e2e/sw-update.mjs) — NOT tried yet: Reduce motion, and sound off on a real phone
- [x] Store page: none for the alpha — the link is https://thebluemuzzy.github.io/GOOPS/alpha/ (no itch page yet)
- [x] Privacy and age rating: TDD §7 — nothing leaves the device (browser storage only, no accounts / analytics / third-party requests); no privacy page or age rating needed for a friends link — due before a store page
- [ ] Credits: content/credits.json lists every asset, but there is no Credits screen in the game yet (the Settings row is off) — before beta
