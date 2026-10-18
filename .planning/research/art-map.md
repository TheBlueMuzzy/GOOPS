# Art map — what each file in `art/` is and where it goes (F19, 2026-10-17)

Every SVG in `art/` drawn with Muzzy's fonts loaded: contact sheet `e2e-shots/art/sheet.png`, one big render each in `e2e-shots/art/files/` (`node e2e/art-sheet.mjs`).
The game serves its art from `public/art/`, made by `node scripts/art-prep.mjs` (re-run it after changing a file in `art/`); which picture goes where on screen is `content/ui/art.json`.

| File | What it is | Where it goes | This sprint |
|---|---|---|---|
| `Background.svg` | Flat navy page (648×1152, 9:16) | Start screen backdrop; later the console's backdrop | **yes** — start screen |
| `Title.svg` | "GOOPS" in green, font *From Where You Are* | Start screen logo; later the bottom of the console (Example1) | **yes** — start screen (words turned into shapes by art-prep) |
| `Btn_Green-Up.svg` / `-Down.svg` | Arcade button, yellow cap on green, up / pushed in | Start screen "Start shift"; end report "Next shift"; later Reset Lights panel | **yes** |
| `Btn_Blue-Up.svg` / `-Down.svg` | Arcade button, pale blue cap on teal | Start screen "Settings"; end report "Back to the console"; later Reset Lights panel | **yes** |
| `Btn_Purple-up.svg` / `-Down.svg` | Arcade button, pink cap on purple | Reset Lights panel (3rd button); spare for a 3rd menu item | later |
| `EndGameScreen.svg` | End-of-shift report mock-up: orange monitor frame + "SYSTEM FAILURE / PRESSURE OVERLOAD", rank + XP meter, final score, unspent power, 4 stat boxes, "SWIPE UP TO END THE DAY" | End-of-shift report | **yes** — its frame only (`public/art/EndGameFrame.svg`), the kit report drawn inside. Its layout (rank meter, 4 stat boxes, swipe up) waits for those systems |
| `Btn_HowToPlay.svg` | Green round "?" button | Console bottom-left corner (Example1 / 3) | later (no How to play yet) |
| `Btn_Settings.svg` | Green round gear button | Console bottom-right corner | later (with the console) |
| `Btn_SystemUpgrade.svg` | Yellow bar "SYSTEM UPGRADES AVAILABLE · 2" | Console, under the panels | later (upgrades) |
| `ConsoleBase.svg` | Console body (teal top, grey front) with footer "Version X.X.X · ARE YOU SURE? · MuzzyMade @ 2026" | The console (main menu) | later |
| `ConsoleTop.svg` | Empty console top panel | The console | later |
| `ConsoleTopLayout.svg` | Console top with Operator Rank meter + RESET LASER sliders | The console; laser breakdown repair | later |
| `OperatorRankMeterXP.svg` | "OPERATOR RANK 2 · 10,347 / 12,500 XP" bar | Console top; end report rank meter | later (ranks/XP) |
| `Periscope.svg` | Green goggles periscope with ⇩ handle | Console: pull it down to start a shift | later (the console) |
| `Dial.svg` | Orange dial with ▲ and rotate arrows | RESET CONTROLS repair | later (breakdowns) |
| `ResetControls.svg` | "RESET CONTROLS" panel with the dial | Controls breakdown repair | later |
| `ResetLights.svg` | "RESET LIGHTS" panel: slider + 3 arcade buttons + lights | Lights breakdown repair | later |
| `Slider-LightsOff.svg` / `SliderHandle.svg` | Pink chevron slider track with lights / its orange handle | RESET LASER sliders | later |
| `Light-On.svg` / `Light-Off.svg` | Orange / dark indicator lamp | Repair panels | later |
| `Arrow.svg` | White double chevron » | Slider ends, "swipe" hints | later |
| `Example1–4.svg` | Full-screen mock-ups of the console-as-menu. 1: the monitor "CLEANING IN PROGRESS…" above the console (periscope, rank + laser sliders, Reset Controls / Reset Lights, upgrades bar, footer "Version · WIPE SAVE DATA · MuzzyMade @ 2026", GOOPS logo, ? and gear corner buttons). 3: during a shift — the monitor slid up to a "CURRENT PRESSURE: 73%" strip, the periscope pulled down over a dimmed console. 2 and 4: the same at other sizes / steps | Reference for the console (main menu) and the in-shift HUD | reference only |
| `Minos.svg` / `minos.ai` | Every piece shape in green, red, blue (3 rows of the 7 + extended sets) | Piece reference for the engine / goo | reference only |
| `wrap_example.png` | Picture of the tank wrapping round | Reference for the cylinder | reference only |
| `goops_icons/`, `goops_icons_transparent/` | App icons, Android + iOS sizes | PWA / store icons (`public/icons/` already has 3) | later (store release) |

## Notes
- **Fonts:** the SVGs use *From Where You Are* (title, report headings) and *Amazon Ember* (all the small labels). A picture can't load fonts, so any art with words is either outlined (Title, by art-prep) or has its words written by the game in the kit's style. Shipping either font in the game needs a licence check first (Amazon Ember is Amazon's own font) — **Ask Muzzy**.
- **Buttons** are word-less arcade buttons: the words sit beside them (kit Button `art`, label `beside`), from `content/text/en.json`. Down art is 11 units shorter than Up (pushed in); the kit draws it bottom-aligned so it sinks into the same base.
- **The end-game frame** is cut nine ways (kit Panel `frame`): its corners are drawn at their own shape, only the plain strips between them grow with the report, so it fits a phone, a phone on its side and a desktop without stretching anything. Cut lines in `content/ui/art.json` (`slice` 102 / 64 / 64 / 64 — the dark screen's rounded corners end there).
