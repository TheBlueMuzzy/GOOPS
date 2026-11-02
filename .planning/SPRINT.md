# Sprint 31 — Sharp pixel letters everywhere
Started 2026-11-02 · Milestone M6 1.0 · Features: F73
What changes for Muzzy: the reading text becomes Pixel Operator 8 at 16 screen px (Nokia stays for titles, headings and numbers), and every text size lands exactly on its font's pixel grid, so letters stay sharp on any screen, zoom and Text size. Stays the same: the art, the layout, the rules — words get a little smaller and sharper.

## F73 🎮 Crisp pixel type
Done when: Muzzy's sketch S12 pick B is in the game (.planning/research/pixel-type/picks.json): Nokia for titles (32), headings (24) and numbers; Pixel Operator 8 for reading text at 16 screen px; line height 1.2; no shadow, no tracking · every size snapped to its font's 8 px grid ÷ devicePixelRatio (the sketch's rule: size = max(step, round(raw / step) × step), step = 8 / dpr; line height rounded to whole device pixels), re-snapped on zoom / resize / Text size · the UI kit does the snapping (a framework module piece, not Goops CSS) · every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080), Text size 100–200% · Pixel Operator's licence checked from its own zip and credited
why: Muzzy 2026-10-29: "make it all nokia… body font should always be more readable" — pixel letters that blur look broken; sharp ones look made on purpose.
Check: the kit's own tests (snap at dpr 1 / 2 / 3, Text size 100–200%) · e2e/text-size.mjs: every word's computed size × dpr is a whole multiple of its font's grid, at dpr 1, 2, 3 and Text size 100–200%, every portrait size · check:framework · screenshots of every screen looked at by Claude · check:full
- [ ] 🤖 1. UI kit (framework): snap each text role's size to its font's pixel grid ÷ devicePixelRatio (fonts.json pixelSize — today it's documentation only), line heights to whole device pixels; re-snap on zoom / resize / Text size; kit tests + gallery; new kit version — ~/Documents/dev/framework/ui-kit/kit/style/applyStyle.ts
- [ ] 🤖 2. Catch Goops up on the UI kit (0.37.3 → the new one, incl. 0.38's look change: a scroll list keeps room for two rows, a too-wide menu title drops a size); every screen checked at every size — src/ui/kit/
- [ ] 🤖 3. Pixel Operator 8: download it, read the licence inside its zip (CC0 or OFL — either is fine), credit it — content/credits.json
- [ ] 🤖 4. Goops: the font + sizes (body 16 · heading 24 · title 32, line height 1.2, Nokia for title / heading / numbers) — content/ui/style.json
- [ ] 🤖 5. The check: every word on its font's grid at dpr 1 / 2 / 3, Text size 100–200%, every portrait size — e2e/text-size.mjs
- [ ] 🤖 6. Screenshots of every screen at every size looked at; check:full — e2e/fonts-shots.mjs
- [ ] 🙋 7. Muzzy looks on his phone + PC

## Notes
- Measured 2026-11-02 before planning (helper + Claude): the kit (framework 0.39.0) has no font snapping — fonts.json `pixelSize` is documentation only (ui-kit/kit/fonts/gameFonts.ts); the type scale is body = 18 px floor × Text size, × font-scale 1.25 per step (applyStyle.ts). Goops: kit 0.37.3, only Nokia installed (all four roles Nokia), F76's art-words floor in app.css + main.tsx. Pixel Operator 8 isn't on disk (the sketch embeds it as base64). The research (pixel-type.md, picks.json, the S12 sketch) is on this branch.
- Muzzy 2026-11-02 (Sprint 31 plan): "1. yes".
