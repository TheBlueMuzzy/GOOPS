# Sprint 19 — all four active abilities, up to three at once
Started 2026-10-26 · Milestone M5 Beta · Features: F42
What changes for Muzzy: three new actives in the Upgrades screen (Goop Dump 15, Goop Colorizer 25, Crack Down 35), two Expansion Slot upgrades (20, 38) to equip a 2nd and 3rd, and one charge button per equipped active while playing (layout picked in a sketch). Stays the same: Cooldown Booster, the passive upgrades, the story, ranks 0–39. The other rank 10–38 passives are F43 (next).

## F42 🎮 Active abilities: equip slots + one charge button per equipped active — sketch first for the button layout
Done when: Goop Dump, Goop Colorizer and Crack Down work in real shifts as v1 (PRD:594-676, upgrades-map), seeded, each refusing without losing its charge when it can't act (no falling piece / a rupture); Active Expansion Slot (rank 20) and Slot 2 (rank 38) are bought with scraps and raise the slots to 2 / 3, Respec unequips what no longer fits, old saves load; the HUD shows one charge button per equipped active (own icon, charging / ready) in the layout Muzzy picks in the sketch, fired by tap, keys 1 / 2 / 3 (F + Numpad . stay on the first); every number in content/ JSON, live in the Dev Kit; GDD / TDD / upgrades-map updated; screenshots at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080 — portrait only).
why: actives are the tools the player chooses to bring — three at once makes the loadout a real choice, and each one fixes a different bad moment (wrong colours, cracks out of reach, machines about to break).
Check: unit tests (each effect, refusals keep charge, slot count, respec, save upgrade) · e2e/upgrades.mjs (3 actives equipped, each fires, buttons fit at every portrait size) with shots looked at · check:full
- [ ] 🤖 1. Button-layout sketch: 1–3 charge buttons at 360 / 390 / 1440 — A small rings in the top row · B a column beside the tank · C in the bottom panel; knobs + presets + Copy values — .planning/research/sketches/ability-buttons.html
- [ ] 🙋 2. Pick the button layout in the sketch, press Copy values — .planning/research/sketches/ability-buttons.html
- [ ] 🤖 3. Goop Dump, Goop Colorizer, Crack Down: effects (seeded; refused = charge kept), in content/tuning/upgrades.json; unit tests — src/engine/abilities.ts
- [ ] 🤖 4. Active Expansion Slot (20) + Slot 2 (38): bought with scraps, slots 1 → 2 → 3, Respec unequips what no longer fits, save upgrade step + golden save; tests — src/progress/upgradeShop.ts
- [ ] 🤖 5. HUD: one charge button per equipped active (own icon) in the picked layout (all 3 layouts behind a content/ value until Muzzy picks), keys 1 / 2 / 3 — src/ui/App.tsx
- [ ] 🤖 6. e2e: 3 actives equipped, each fires, buttons fit and don't overlap at every portrait size, in check:full — e2e/upgrades.mjs
- [ ] 🤖 7. Update GDD §5 upgrades, TDD §2c + D19, upgrades-map — .planning/design/upgrades-map.md
- [ ] 🤖 8. (tuning) Charge speeds from v1 (Dump 15 s, Colorizer 25 s, Crack Down 30 s, +25 % a seal); Muzzy judges by playing — content/tuning/upgrades.json

## Notes
- Muzzy 2026-10-26 "go auto" on the plan: all three missing actives come in now (Claude's pick — a 2nd slot can't be tested in a real game without a 2nd real active); slots 2 and 3 are bought as upgrades at 20 / 38 like v1 (Claude's pick); F47 cut (duplicate of F67, done).
- Claude's calls: keys 1 / 2 / 3 per slot (v1's code has no ability keys); F / Numpad . keep firing slot 1 (TDD D19). The other rank 10–38 passives stay in F43.
- Auto run: the sketch is built first and published; the rules (tasks 3–4) go ahead in a helper meanwhile; the HUD (task 5) builds all 3 layouts behind a content/ value with Claude's pick as the stand-in, and switches to Muzzy's pick when he copies values.
- Known: the kit's TimerRing has one size and always prints its number (framework request, sprint-12 Notes) — the sketch shows what each layout needs from it.
