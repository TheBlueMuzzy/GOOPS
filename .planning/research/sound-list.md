# Goops sound shopping list (F53 — Final sound)

Written 2026-11-02 from the code (src/game/shiftSounds.ts, content/audio.json, the engine's events). No music and no intercom voice in 1.0 (Muzzy 2026-11-02) — the Veteran, Management and the goop's whisper stay silent.

## How to hand them over
- Drop every file in one folder: `audio-incoming/` in the Goops folder (any format — mp3, wav, ogg; Claude converts). It sits outside `public/` so raw files never ship with the game
- Name each file after its line below (e.g. `goop.pop.wav`; a second take = `goop.pop-2.wav`)
- For each file, note where it came from in `audio-incoming/sources.txt` — one line: `file · site · author · licence · link`
- Licences that work: **CC0** (no credit needed) or **CC-BY** (credit in the Credits screen). Not "non-commercial" (NC).
- Good free places: Kenney.nl (CC0), freesound.org (filter CC0 / Attribution), Sonniss GDC bundles (royalty-free), pixabay.com/sound-effects
- Want to keep today's sound? Write `keep` next to its line in sources.txt — no file needed
- Claude trims silence, evens the loudness and wires it in — rough files are fine

## A. Sounds the game already plays (26) — replace or keep
Today's files are CC0 placeholders (content/credits.json). ☐ = still to pick.

**The goop**
- ☐ `goop.land` — a piece lands and locks (soft, wet thud; 3 takes today)
- ☐ `goop.merge` — same-colour goop joins into one blob (squelch)
- ☐ `goop.ready` — a blob is ready to pop (rising ping; plays higher each time in a row)
- ☐ `goop.pop` — a blob is zapped and pops (the big one — plays lower + louder for big blobs)
- ☐ `goop.poke` — zapping goop that can't pop yet (it jiggles)

**Cracks**
- ☐ `crack.form` — a new crack appears in the tank wall
- ☐ `crack.seal` — popped goop seals a crack

**Controls**
- ☐ `piece.rotate` — turn the falling piece
- ☐ `tank.spin` — spin the tank left/right (very quiet, plays a lot)
- ☐ `piece.swap` — swap the falling piece with the next one
- ☐ `piece.fastDrop` — fast drop starts

**Breakdowns + repairs**
- ☐ `machine.laser.break` — the laser breaks
- ☐ `machine.visor.break` — the visor (lights) breaks
- ☐ `machine.controls.break` — the controls break
- ☐ `ui.repair` — one step of a console repair puzzle done
- ☐ `ui.wrong` — a wrong move in a repair puzzle
- ☐ `machine.fixed` — the machine is repaired (also a valve opening)

**Shift moments**
- ☐ `tank.rupture` — the tank bursts (loudest sound in the game)
- ☐ `shift.quota` — the quota is met mid-shift
- ☐ `shift.won` — the shift ends well
- ☐ `shift.lost` — the shift is lost

**Console + menus**
- ☐ `ui.periscope` — the periscope clunks down
- ☐ `ui.tap` — any button
- ☐ `ui.back` — the ‹ back button
- ☐ `ui.toggle.on` — a switch on
- ☐ `ui.toggle.off` — a switch off

## B. Moments with NO sound today (14) — new
Each one is something the game already does on screen. Claude's pick in **bold** where a moment could also stay silent.

**The goop + the tank**
- ☐ `crack.grow` — a crack spreads into a new cell (ranks 30+)
- ☐ `goop.wild` — a wild (rainbow) clump turns a colour when a piece touches it
- ☐ `goop.dump` — Goop Dump rains goop in from the top (one sound for the whole dump)

**Abilities (the charge buttons)**
- ☐ `ability.ready` — an ability's charge just filled
- ☐ `ability.fire` — an ability is used

**The periscope zoom (F56 — Periscope zoom)**
- ☐ `ui.zoom.in` — the view zooms into the goggles to the tank
- ☐ `ui.zoom.out` — the view zooms back out to the console
- ☐ `ui.goggles.on` — the goggles flicker on like an old CRT as the periscope starts down (**a short electric hum/flicker**)

**The Veteran (the white goop) — sounds only, no voice**
- ☐ `vet.land` — he drops into the tank ('…oof.')
- ☐ `vet.ow` — a zap goes through him (he flinches)
- ☐ `vet.seal` — he seals a crack

**The final shift + the ending**
- ☐ `valve.ready` — a valve stage has its seals and waits at the console
- ☐ `ending.open` — the tank opens at the ending (**one big moment sound — the game's last**)
- ☐ `shift.rankUp` — the end report shows a rank-up (**a short fanfare-ish sting**)

Not on the list on purpose: the zap beam (the pop sound covers it), the Pay up button (it already plays `ui.tap`), the Veteran's last line (silent intercom).

## Done when
- Every ☐ above has a file or `keep`
- Claude ticks each one here as it goes in
