# Pixel type for Goops — making an all-pixel type system readable

Research, 2026-10-29. Muzzy: "make it all Nokia… body font should always be more readable… see how to make this all work well."
Words used once: **native size** = the size a pixel font was drawn at (Nokia = 8 px); **whole multiple** = 2×, 3×, 4× of it (16, 24, 32 px), the only sizes where every font pixel becomes the same number of screen pixels; **x-height** = how tall the small letters (a, e, o) are; **DPR** (device pixel ratio) = how many real screen dots a phone packs into one CSS pixel (2–3 on phones, 1 on most monitors).

## 0. What's wrong today (read in the code)
- Every role is Nokia Cellphone FC (native 8 px; its readme: "use at 8 or multiples (16, 24, 32)").
- Kit sizes are body 18 px × a 1.25 scale → **18 / 22.5 / 28.1 / 35.2 px** (`src/ui/kit/style/applyStyle.ts:10,41-44`). **None is a multiple of 8.**
  - At 18 px one font pixel = 2.25 CSS px → on a DPR-3 phone 6.75 dots → some strokes 6 dots wide, some 7, soft edges. That unevenness is a big part of "pixel body is hard to read".
- Text size setting (100/125/150/200 %) changes the page's rem → multiplies those fractional sizes again (`Settings.tsx:102`).
- Console words scale with the art via `cqw` (`art.css:102`) → always fractional (e.g. art size 17 on a 390-wide phone ≈ 11.4 px).
- Body line-height 1.4 (`kit.css:18`) → 25.2 px lines → baselines land between pixels; alternate lines blur.
- Art words use `font-weight: 600` (`art.css:130`); Nokia has one weight, `font-synthesis: none` stops faux bold, so the 600 does nothing — harmless, but it's not the "weight" it looks like.
- **Fix the sizes first; it's free and may solve most of the problem without changing font.**

## 1. How pixel games make an all-pixel type system readable
**Hierarchy with one typeface (the "all Nokia" way)**
- Size steps at whole multiples only: 1× labels (rare), 2× body, 3× headings, 4×+ titles. Big jumps, so fewer levels — 3 is plenty.
- Caps vs mixed case: CAPS for titles, labels, Management's monitor voice; **mixed case for anything you read as a sentence** (word shapes read faster). Goops already does this (Management caps, Veteran lowercase) — keep it.
- Letter-spacing in whole font pixels: +1 font px (`0.125em` on an 8 px font) on CAPS headings; body at 0.
- "Weight" without a bold: colour/tone (primary/accent/muted), a 1-font-pixel hard drop shadow (`text-shadow: 0.125em 0.125em 0 <dark>`), or a 1-px outline (4 hard shadows). Classic console trick; never blur in shadows.
- Line height in whole font pixels: 8 px font → 12 font px line = **1.5** (24 px at 16 px). 1.25 for tight 2-line labels.
**Pairing (display font + reading font)**
- Common in pixel games: a chunky/caps display font for titles + a pixel font *designed for small reading* (taller x-height, wider round letters, more space between letters) for body. Both are on the same pixel grid, so it still looks all-pixel.
- Good reading pixel fonts have an x-height of 5+ px and letters 5–6 px wide; tiny caps fonts (Tiny5, Silkscreen, Press Start 2P) are titles-only.

**Candidates** (licence checked on the maker's page where possible)

| Font | Role | Native px (crisp at) | Licence | Commercial game? | Credit |
|---|---|---|---|---|---|
| Nokia Cellphone FC (Zeh Fernando) | all / display | 8 (16, 24, 32) | free, OK in games, don't sell the font | ✅ | nice, not required |
| PixeloidSans (GGBotNet) — has a real **Bold** | body / heading | 9 (**18**, 36) | SIL OFL 1.1 | ✅ | include licence file |
| m6x11plus (Daniel Linssen) | body | 18 multiples (**18**, 36) | "free with attribution" | ✅ | **yes** (credits screen) |
| m6x11 / m5x7 (Daniel Linssen) | body | 16 multiples (16, 32) | m6x11: attribution · m5x7: CC0 | ✅ | m6x11 yes, m5x7 appreciated |
| Pixel Operator (Jayvee Enaguas) — regular, bold, mono, small-caps | body / numbers | 16 grid (16, 32) | CC0 (author's readme; one mirror says OFL — check the zip) | ✅ | no |
| Departure Mono (Helena Zhang) — monospace | numbers ("0 / 3,500 DUE") | 11 (22, 33) | SIL OFL 1.1 | ✅ | include licence file |
| Monogram (datagoblin) — monospace | body / numbers | small grid — check readme before use | CC0 | ✅ | no |
| Tiny5 (Stefan Schmidt) | title only (5 px caps) | 8 steps | SIL OFL 1.1 | ✅ | include licence file |
| Silkscreen (Jason Kottke) | title / labels only | 8 (16, 24) — unconfirmed | SIL OFL 1.1 | ✅ | include licence file |
| Press Start 2P (CodeMan38) | title only (very wide) | 8 (16, 24) | SIL OFL 1.1 | ✅ | include licence file |

- Lucky fit: **PixeloidSans and m6x11plus are native 18** → 1× = the kit's 18 px body floor exactly; no rule bending.

## 2. Crisp rendering on the web
- Crisp = font size is a whole multiple of native **in real screen dots**. On DPR 1 that means 8/16/24 CSS px. On DPR 3 any multiple of 8⁄3 ≈ 2.67 CSS px is crisp (each font pixel = a whole number of dots) — so phones allow many more crisp sizes than desktops.
- Fractional sizes → uneven stroke widths + grey half-pixels on edges. Worse on DPR 1 desktops, subtle-but-real on phones.
- These pixel fonts are outline (TTF) fonts drawn on a grid; at whole multiples their edges sit on pixel lines, so the browser's smoothing has nothing to blur. That's why sizing matters more than any CSS flag.
- CSS flags:
  - `font-synthesis: none` — already on (kit.css). Stops fake bold/italic smearing. Keep.
  - `-webkit-font-smoothing: none` / `font-smooth` — **macOS desktop only**; ignored on iOS, Android, Windows. Optional, not a fix.
  - `text-rendering` — no reliable effect on pixel fonts; leave default (test `geometricPrecision` only if a size looks jittery).
  - Use `font-weight: 400` on one-weight fonts (drop the 600 in art.css) so nothing ever tries to embolden.
  - Line-height and padding in whole font pixels too (see §1), or baselines land between dots.
- **Snapping while honouring Text size** — CSS `round()` (Baseline 2024: Chrome 125, Safari 15.4+, Firefox 118+):
  - `font-size: calc(var(--raw));` then `font-size: round(nearest, var(--raw), var(--px-step));` — older browsers skip the second line and keep the first. Always write all three arguments (an old Safari bug needed them).
  - `--px-step` = native ÷ DPR, set from JS (`applyStyle` already writes variables; add `--px-step: calc(8px / <devicePixelRatio>)` and update on resize/zoom). Desktop → 8 px steps; DPR-3 phone → 2.67 px steps (smooth scaling, still pixel-perfect).
  - Works for console words too: wrap the `cqw` formula in `round(nearest, …, var(--px-step))` → words still grow with the art, but always land on crisp sizes.
  - This is a **kit change** (framework, not just Goops): a style token like `"font-pixel-grid": 8` in `style.json` that turns snapping on for pixel styles. Fits the kit's "one structure, many styles" idea.

## 3. Minimum readable sizes on a phone
- Body: **2× native at least**; aim for cap height ≥ ~10 CSS px and x-height ≥ ~8 CSS px. Nokia at 16 px ≈ PixeloidSans/m6x11plus at 18 px ≈ comfortable. 1× (8–9 px) is labels-only, never sentences.
- Line length on a 390-wide phone: 30–40 characters. Nokia at 16 px fits ~30 per line inside console padding — OK; at 24 px only ~20 → speech lines wrap to 3–4 lines (this is B005's crowding).
- Line height 1.5 for body (whole font pixels), 1.25 for headings/labels; one blank line (= one line-height) between paragraphs.
- Keep sentences short (the Veteran's "──" beats already help) — pixel text punishes long paragraphs more than smooth fonts.
- Text size for a pixel game: map the steps to whole multiples — e.g. Normal = 2×, Large = 3× (125 % and 150 % both snap to one of these). Fewer, crisper steps; and console words should cap (kit's `hudCap` idea) so 200 % doesn't break the console.

## 4. Recommendation for Goops
**A (my pick) — All Nokia, fixed sizes.** Honours "make it all Nokia"; removes the blur first, cheapest change.
- Sizes at 390 wide, Text size 100 %: body 16 · heading 24 (CAPS, +1 font px spacing) · title 32 · display 48 · numbers 24.
- Emphasis: tone colour + 1-font-pixel hard shadow on titles/headings; mixed case body, CAPS for Management.
- Changes: kit snapping token (`"font-pixel-grid": 8` in `content/ui/style.json` tweaks → applyStyle sets `--px-step`, text sizes and art words use `round()`); body line-height 1.5; `font-weight: 400` for art words; the kit's 18 px body floor gets a pixel-font rule ("≥ 2× native") instead.
- Risk: Nokia's small letters are short, so long speech lines stay a bit tiring — that's what B covers.

**B — Nokia for show, a reading pixel font for body.** Most readable while still all-pixel.
- Title / heading / numbers: Nokia (24 / 32 / 48). Body: **PixeloidSans 18** (has a real Bold for emphasis); same snapping, `--px-step` per font (9 for body, 8 for the rest).
- Changes: add PixeloidSans to `public/fonts/pixeloid/` with its OFL file; `fonts.json` entry (`pixelSize: 9`, licence `commercial-ok`); `style.json` `"font-body": "'PixeloidSans', 'Nokia Cellphone FC', system-ui"`.
- Variant B2: m6x11plus 18 instead (warmer, more game-y; needs a credits line).

**C — Nokia + monospace numbers.** A or B, plus Departure Mono (22) for counters/DUE so digits don't jiggle when values change.

**What Muzzy should look at — a /sketch, side by side on the real console words**
- Columns: A (Nokia 16/24/32) · B (Nokia + PixeloidSans 18) · B2 (Nokia + m6x11plus 18) · today (18/22.5/28.1, unsnapped) as the "before".
- Knobs: Text size 100–200 %, snapping on/off, line-height, shadow on/off, letter-spacing; phone width 390; "Copy values for Claude".
- Sample lines:
  - `OPERATOR RANK` · `Start shift` · `0 / 3,500 DUE` · `Payday`
  - Management: `CONGRATULATIONS ON YOUR FIRST PAYDAY.` · `A NEXT-PIECE WINDOW HAS BEEN INSTALLED. ITS RENTAL IS ON YOUR BILL.`
  - Payday line: `Payment due: 3,500 cr. Thank you for your continued employment.`
  - Veteran: `Controls run hot. ── goop gets in the gears. ── easy on the turning.` · `Ever count the operators before you? ── don't. ── numbers get big.`
  - Title: `Shift failed` · heading `Rupture! · Cracks 3 / 10` · numbers `99999`
- View it on the real phone too (DPR 3) — crispness differs from the desktop.

## Sources
- Nokia Cellphone FC readme — `public/fonts/nokia_cellphone/nokiafc22.txt` (8 px and multiples)
- m6x11 / m6x11plus — https://managore.itch.io/m6x11 (sizes 16/32/48; plus 18/36/54; "free to use with attribution")
- m5x7 — https://managore.itch.io/m5x7 (CC0)
- PixeloidSans — https://ggbot.itch.io/pixeloid-font (SIL OFL 1.1; sizes 9, 18, 36…)
- Pixel Operator — https://www.dafont.com/pixel-operator.font (CC0 1.0, 16 px grid)
- Departure Mono — https://departuremono.com/ · https://uiuxshowcase.com/resources/departure-mono-pixel-style/ (OFL, 11 px multiples)
- Monogram — https://datagoblin.itch.io/monogram (CC0)
- Tiny5 — https://github.com/Gissio/font_tiny5 · https://fonts.google.com/specimen/Tiny5/about (OFL, 8 px steps)
- Silkscreen — https://fonts.google.com/specimen/Silkscreen/about (OFL)
- CSS round() — https://developer.mozilla.org/docs/Web/CSS/round · https://web.dev/blog/css-stepped-value-functions · https://caniuse.com/mdn-css_types_round · https://bugs.webkit.org/show_bug.cgi?id=278852
- Rounding to whole device pixels to avoid blur — https://reactnative.dev/docs/pixelratio
