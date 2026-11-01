# Sprint 29 — Look into the periscope
Started 2026-11-01 · Milestone M6 1.0 · Features: F56
What changes for Muzzy: pulling the periscope down zooms the view into the periscope's goggles and the shift is playing in there; going back zooms out to the console. Stays the same: the rules, the controls, reduce motion (no zoom — the switch is instant, as today), the live site (nothing deploys before the 1.0 /deliver).

## F56 ✨ Periscope zoom
Done when: the look Muzzy picks in the sketch is in the game — pulling the periscope (between shifts, and back to the tank mid-shift) zooms into the goggles to the tank; going back (a flick up mid-shift, the end of a shift) zooms out to the console · the zoom amount + timings in content/tuning/periscope.json, live in the Dev Kit's Tuning · reduce motion = no zoom · controls answer right after the switch · every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080) · a check guards it.
why: Muzzy 2026-10-18: "like you're actually looking directly into the periscope visor" — the tank is something you look INTO from the console, not a page that slides past.
Check: e2e/periscope-zoom.mjs (both ways, the mid-shift peek both ways, every portrait size, a control works right after, reduce motion, no console errors) · screenshots mid-zoom looked at by Claude · check:full
- [x] 🤖 1. Sketch S13 (one HTML file, the real console + periscope art): A zoom into the goggles · B A + the tank small in the goggles at the console · C today's slide; knobs (zoom, timing, easing, when the glass fades to the tank), 3 presets, "Copy values for Claude" — .planning/research/sketches/periscope-zoom.html
- [ ] 🙋 2. Muzzy plays the sketch, picks one, copies its values to Claude — .planning/research/sketches/periscope-zoom.html
- [ ] 🤖 3. The zoom in on a pull (between shifts: leaving; mid-shift: peekOut) — src/App.tsx
- [ ] 🤖 4. The zoom out going back (arriving, peekIn) — src/ui/Console.tsx
- [ ] 🤖 5. Zoom + timings in a tuning file, read live (the rules/looks clock contract); TDD names the file — content/tuning/shift.json
- [ ] 🤖 6. Only if Muzzy picks B: the tank small in the goggles at the console — src/ui/Console.tsx
- [ ] 🤖 7. e2e: both ways, the peek both ways, every portrait size, a control right after, reduce motion; add to check:full — scripts/check-all.mjs
- [ ] 🤖 8. (tuning) feel pass with Muzzy — content/tuning/shift.json

## Notes
- Open bugs: no P0/P1.
- Today (code map 2026-11-01): App.tsx Mode console/leaving/shift/arriving/peekIn/peek/peekOut; the switch is the kit Screen's slide (slideEdge bottom, --motion-normal, kit.css kit-slide-in/out) — no timing in content/; ShiftStage is mounted for every mode but 'console', under the console's ScreenStack; the periscope = art.json console.layers.periscope (ConsolePeriscope.svg, its glass is painted — no see-through hole); reduce motion already skips the slide (layout.tsx onSlideEnd at once). e2e scripts that drive the switch: lessons, visor, upgrades, repairs, first-day, day, ending, story, final-shift, gestures and more — the zoom must not slow them (reduce motion or the same total time).
- Task 5's file: a new content/tuning/periscope.json if the knobs don't belong in shift.json — decided when building.
- NEVER deploy (the next deploy is the 1.0 /deliver).
- Task 1: sketch S13 built by a helper (ec74045): the real console art inlined, a stand-in tank, looks A / B / C on the style knob, 8 knobs (style, zoom, glassFade, lensTank, pullMs, zoomMs, backMs, ease), presets "A zoom" / "B lens" / "C slide", default B. Lens measured in ConsolePeriscope.svg: outer glass x 181.25–463.30, y 931.91–1074.50, centre (322.3, 1003.2); the zoom aims above the nose (y 988) so the nose never covers the tank. Re-shot by Claude at 390x844 + 1280x800 (console, mid-zoom, tank): no console errors, 55–60 fps.
