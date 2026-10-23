# Goops — Story
> Living design doc, linked from GDD §1 and §5. **Draft 2 (2026-10-23)** — Claude's write-up of Muzzy's direction (his words below). Everything marked **❓** is open for Muzzy. The v1 PRD's version is kept at the bottom for reference.

## Muzzy's direction (2026-10-23, his words, trimmed)
- "the company's purpose should be obfuscated — we don't know why we're cleaning a pressurized tank of goop… but it feels important. very vague. … maybe the goop is the actual product? maybe it's an invasive species? maybe it's the alien life on this planet and we're being an evil corp killing it all?"
- "we only know we're on the G.O.O.P.S department. There should be some documentation about what the possible acronym is. we can keep making guesses at it in game — using dark/quirky humor."
- "We're clearly sorta like indentured servants … to get off world we get on a ship and work to pay for it … we make credits for working, but we also pay them credits for food and lodging, and they fine us in lots of little ways so we never really pay off our debt."
- "eventually we'll realize the voices we're hearing are the goops themselves … the goops start developing more 'human qualities' like eyeballs … maybe a mouth at some point when it can actually talk to us, near the end."
- "the goops are actually the … primordial slime breakdown of the humans that worked on the ship … every human eventually gets GOOPED when they can't pay back what they owe … goop in the tanks under pressure is actually what causes the cracks. so it's a vicious cycle … maybe the company is actually an alien race using humans … like the Matrix … this almost has a Soylent Green style vibe too."
- "we'll need an ending where we save the goop instead of zapping it. … the game is only the console and the tank, so … all text."
- **Who talks where (2026-10-23):** "the company talks through the top monitor, the veteran talks through a speaker, the goops talk in my head (kinda telepathically)."

## The one-paragraph story
You signed a contract to get off a dying world: free passage to a far-off work colony, paid back by working. You arrive deep in debt and get the worst job on the station: **Operator, Department G.O.O.P.S.** You look through a periscope into a pressurised tank and zap the "semi-sentient" goop that keeps building up, before its pressure cracks the tank. Nobody tells you why the tank exists. Your wages never cover your lodging, your meals and your fines. Then a crackly voice on an old speaker starts slipping you scrap parts, and you start hearing whispers that aren't coming from any speaker. The goop is growing eyes. The goop is the operators who came before you — everyone who couldn't pay off their debt gets "retired" into the tank, and the pressure is what Management is really harvesting. At rank 50 you're handed the keys to the department, and with them the one thing no operator has ever touched: the release valve.

## The three voices (all text — the game is only the console and the tank)
| Voice | Where it shows | How it reads | Rule |
|---|---|---|---|
| **Management** (the company) | The console's **top monitor** — the CRT screen it already "speaks" through (DOS-style typing, as the machine lessons use) | Clean, cheerful, typed out, corporate. Always "policy", "procedure", "for your comfort". Small slips that suggest they aren't human ("Remember to breathe your mandatory amount of air.") | Never openly cruel. Never explains what the tank is for — or explains it differently every time. |
| **The Veteran** | A **speaker** — for now a **speech bubble**: square, whose outline fizzes like a speech wave while he talks — see **The speaker bubble** below (Muzzy 2026-10-23) | Scratchy, urgent, in fragments, static eats words: "—don't trust the — ── ── they're not—" | Brief and cryptic early; clearer as he trusts you. He's the one who leaves you **scraps** (the upgrade money) — upgrades are his smuggled parts. |
| **The Goop** | **In your head** — a **blobby speech bubble** (Muzzy 2026-10-23), the same one for telepathy and, at the end, for its real mouths; it drifts up inside the periscope view, over the tank | **Gets better at talking over time** (Muzzy 2026-10-23): feelings and broken sounds first ("…warm…", "…tight…", "…nnn…"), then single words, then broken sentences, then whole sentences and names — and by the end it talks out loud through its mouths | Only you can hear it. Management never mentions it — until very late. |

## G.O.O.P.S. — the acronym nobody agrees on
The department's name is stencilled on everything; what it stands for changes every time it's written. A running gag across the whole game — the monitor, the Veteran and the end-of-shift report each "explain" it.
- Monitor (official, changes every few ranks): General Overflow & Organic Pressure Services · Goop Operations Oversight & Pressure Safety · Gelatinous Organism Observation & Processing Station · Growth, Opportunity, Optimism, Personal Satisfaction · Good Operators Obey Policy, Smile.
- Fine print / typos: "Gross Output Of Pressurised Slurry" (later corrected) · "Get Over Our Pricing Structure".
- The Veteran: "Grievances Of Our Previous Staff" · "Get Out Of Pod Soon".
- The real one (rank 50, the last thing on the monitor): **Gradual Onboarding Of Permanent Staff.**
- ❓ Is there a one-page "Department Handbook" in the Operator Journal that lists the guesses as you collect them? (Claude's pick: yes — it's a collectible list, cheap to build.)

## What the tank is for — the rumours (never answered until the end)
Management, the Veteran and the Goop each hint at a different answer, so players argue about it. All of these get said at some point:
1. **It's the product** — the monitor talks about "yield", "batches" and "quality grades".
2. **It's a pest** — "Goop is an invasive organism. Containment is your civic duty."
3. **It's the planet's native life** — "The Company has completed 98% of its planned land clearing."
4. **It's research** — "Pressure tolerance trials are proceeding on schedule. Thank you, subject." (then: "*operator. Thank you, operator.")
5. **The truth (40s):** the goop is people — former workers, broken down. Under pressure goop gives off energy, and that power is what Management harvests (the Matrix part). The cracks are the goop pushing to get out. Your job keeps them in.

## Credits, payday and fines (the trap) — worked out 2026-10-23
> Play it: sketch `research/sketches/credits-payday.html` (the planner's Sketches tab, "S8: Credits & payday"). **Approved by Muzzy 2026-10-23: "so good. approved"** — defaults kept (fines 8% over 3 lines, payday bill in 5 items).
Muzzy's worry: fines mustn't hold players back from ranking up. His idea: credits fill up to a cap, then the Company takes nearly all of it for lodging, food "and other funny things" — that's why the meter starts over each rank. Small fines every shift; one big payment at each rank-up; the credits line goes up and down instead of just climbing.

**The trick: credits ARE the XP we already have — the Company just puts on a show around it.**
- **Credits = XP.** A shift's score already becomes XP 1:1, and the rank meter already empties at each rank-up (`xpToNext(rank)` = 3,500 + 250 × rank). We only rename it: the rank meter becomes **CREDITS**, and its cap becomes **PAYMENT DUE**. No numbers change, so the balance work so far stays true.
- **Fines are theatre, never a loss.** Each shift's report shows a made-up *gross* a bit higher than what you earned, then the fines that bring it down — and the *net* always lands exactly on the XP the shift really gives. So fines never slow you down, but they're always there.
  - Fine total = a small share of the shift (start at ~8%, tunable in `content/tuning/` ❓ file name at build time), split over 2–4 lines, rounded to whole credits.
  - Fines picked from what really happened when possible (a rupture → "Unscheduled pressure event", a broken laser → "Unauthorised wear on Company laser"), topped up with silly ones ("Excessive blinking", "Picking nose on camera", "Unapproved facial expression", "Periscope fingerprints").
- **Payday = the rank-up.** When your credits reach PAYMENT DUE, the report rolls a **payday**: the Company takes exactly the payment due, itemised (lodging, meals, air, bunk rental, periscope rental, "uniform laundering (you have no uniform)"…). Anything left over carries into the new rank. Then RANK UP.
  - So the credits line climbs over a few shifts, crashes to almost nothing on payday, and starts climbing again — exactly the "never get ahead" feeling, while you DO rank up every time.
- **Passage debt** is a separate story-only line on payday: it barely moves ("Remaining passage debt: 48,219 cr — interest applied"). Never affects play.
- **Credits ≠ scraps.** Credits are the Company's and you never keep them. Scraps are the Veteran's parts — the only thing you can spend.

**Worked example — rank 3 (payment due 4,250 cr):**
| | Shift A | Shift B |
|---|---|---|
| The shift's score (= real XP) | 1,800 | 2,900 |
| Report: gross pay | 1,950 | 3,140 |
| Report: fines | −150 (Excessive blinking 12 · Unscheduled pressure event 95 · Periscope fingerprints 43) | −240 (…) |
| Report: net | **+1,800** | **+2,900** |
| Credits | 1,800 / 4,250 | 4,700 → **PAYDAY** |
| Payday | — | Lodging 2,100 · Meals 1,400 · Air 600 · Bunk rental 150 = −4,250 |
| After | rank 3 | **rank 4**, credits 450 / 4,500 |

**Edge cases:** two rank-ups in one shift (early ranks, a huge score) → two paydays in a row on the report. Rank 50 → the last payday is the "debt restructuring" of the ending. The first day (tutorial) has no fines — "Day one is on us. (Day one will be billed later.)"

## The Goop changes (the visual story)
The tank is half of the whole game, so the goop itself tells the story, rank by rank (looks work for the goo look module; ranges ❓):
- **0–9:** plain goop. The occasional bubble looks like it blinked (players will doubt it).
- **10–19:** a few **tiny eyes** open in big clumps, close when zapped.
- **20–29:** eyes in most clumps, and they **follow the falling piece** / your laser.
- **30–39:** eyes blink, look worried when pressure is high, close in relief when a crack is sealed.
- **40–49:** some clumps grow **mouths**, silent at first.
- **The ending:** the mouths speak (the whispers move from "in your head" to the goop itself).

## Every difficulty has a story reason
| When | What gets harder | Management says | The truth |
|---|---|---|---|
| Rank 2 | The visor breaks down | "Your periscope is on backorder. Estimated arrival: soon." | Cheapest parts on the station. |
| Rank 4 | The laser breaks down | "Laser power is now rationed for your safety." | Every watt goes to Management. |
| Rank 6 | The controls overheat | "Please do not turn the tank so enthusiastically." | Goop has got into the gears — they're reaching out. |
| Rank 20 | Multi-colour pieces | "Increased goop clumping is normal and expected." | The goop has started **holding together** (each other's hands). |
| Rank 30 | Cracks spread | "Hairline fractures are within policy tolerance. You will be fined for them." | The goop is pushing harder — it's waking up. The tank is older than anyone says. |
| Rank 40 | Wild goop (seals any crack) | "Report any goop that seems helpful. Goop is not helpful." | Goop that has heard you **is helping you**. |
| Rank 31: white goop | One clump in the tank, plain white, with his squint | "Residue. Do not engage." | **It's the Veteran** (Muzzy 2026-10-23: first "galaxy goop", then: "the veteran being white goop might be really brilliant then. he'll stand out"). In play: it never merges or pops (the laser passes through: "ow"), drifts toward the crack in most danger and sits on it, sealing it slowly — he's still helping. White, the 6th normal colour, joins at rank 30 — **because he's been retired** (Muzzy 2026-10-23: "i like that white turns up after he 'retires'. that's great."). |
| Rank 50: the final shift | **All the goop is galaxy black** — black with shimmering stars (a star shader) | — | The final boss of a level (Muzzy 2026-10-23: "the last game lvl 50 - our final boss of a level - is all galaxy black"). Black, the 7th colour, arrives here and only here. See **The final shift** below. |

## The arc, rank by rank
| Ranks | Title band (❓ names) | Beats | Voices |
|---|---|---|---|
| **0** | Probationary Intern (Unpaid) | Your first day (the tutorial). Welcome to G.O.O.P.S. Your contract, your debt, your bunk. Everything is fine. | Monitor only. |
| **1–4** | Junior Tank Associate | Learning the job; the first machines break. First fines on the report. First silly acronym. | Monitor. One whisper you'll doubt ("…cold…"). |
| **5–9** | Tank Associate | **The speaker crackles at rank 5** — the Veteran's first words, and the upgrade store opens: "Found some scraps. Left 'em in your panel. Don't tell the screen." | + Veteran (fragments). |
| **10–19** | Goop Technician → Senior | Eyes appear. Whispers become words ("…don't…", "…heavy…"). The Veteran: "Don't trust everything the screen says." Management "reminds you" there's no such thing as voices. | All three. |
| **20–29** | Pressure Specialist → Lead | Fines go up. Goop holds together. The Veteran tells the station's history: how many operators there have been (a lot), where they "retired" to. The goop says its first name. | All three; Veteran clearer. |
| **30–39** | Containment Supervisor → Senior | The tank falls apart; Management blames you. The goop **asks you to stop zapping it**. **The Veteran gets caught at 30** and the speaker goes dead; you're the veteran now. **The goop takes over at once** (a moment every rank); the white goop (him) is in the tank from 31 and speaks in your head at ~35. You find your own name in a list of "pending retirements". | Goop sentences; the white goop. |
| **40–49** | Assistant to the Department Head → Acting Deputy (Interim) | The full picture: the goop is people; the pressure is Management's power; the debt is how they keep operators coming. **The speaker crackles again — the Veteran, from inside the tank** (caught and gooped at 30; see The Veteran's arc). Management slips: it isn't human. | Everything. Mouths open. |
| **50** | **Department Head, G.O.O.P.S.** | The takeover — see **The ending**. | — |

## The Veteran's arc — he gets caught (Muzzy 2026-10-23)
Muzzy: "it'd be funny if the veteran who was helping us gets caught and turned into goop at some later level … when we become high enough level, we don't need a veteran anymore… we're the veteran. but I don't want to lose touch with the speaker … we can lose touch with it much later."
**Pacing (Muzzy 2026-10-23: "why rank 32? 33–39 = 7 levels of nothing … the goop themselves [must] ramp up at the time the veteran is 'retired' so we don't have a weird gap"; "the black goop IS the veteran" → galaxy goop → then white goop, so he stands out; the final shift is all galaxy black).** Rule: **every rank-up has exactly one story moment**, and the voice that carries it hands over with no gap:

| Ranks | Who carries the rank-up moment | In-shift (no tap) |
|---|---|---|
| 0–4 | Management (monitor) | — · first whisper at 3 |
| 5–29 | **The Veteran** (speaker), one line every rank — 25 lines, cryptic → clear | whispers grow: feelings → words |
| **30** | **Caught.** The rank-30 moment IS his capture (same rank as the cracks-spread twist — the crackdown after his leak) | — |
| 31–39 | **The goop** (in your head) takes over at once: one moment every rank, broken sentences → whole sentences. The **white goop** is in the tank from 31 — it's him | the white goop's eyes follow you |
| ~35 | **The white goop speaks in your head** — his voice, from inside, learning to talk like goop | — |
| 40–49 | **The speaker crackles again**: he's reached its wire through the cracks and teaches the goop to use it — the speaker carries him + the goop, the monitor carries Management slipping | mouths open |
| 50 | The ending — you beat the game | — |

- **5–29:** the speaker crackles every rank-up; he leaves scraps and warnings, clearer as he trusts you.
- **30: caught.** Mid-sentence the monitor cuts in: "UNAUTHORISED BROADCAST LOCATED. OPERATOR #0001 HAS BEEN SCHEDULED FOR RETIREMENT." The speaker goes dead. That shift's report has a fine for *you*: "Association with a retired employee". From now on you salvage your own scraps — you're the veteran now (report words change; the economy doesn't).
- **31: the white goop.** A single clump in the tank, plain white, with his squint — he stands out (Muzzy). **It IS the Veteran** (Muzzy). In play: never merges or pops, drifts to the most dangerous crack and slowly seals it (the "every difficulty" table).
- **31–39: the goop ramps up** to fill his place: a goop moment every rank-up, getting better at talking each time.
- **~35:** the white goop's first words in your head — him, still him.
- **40: the speaker crackles again** — he got to its wire through the cracks (that's what cracks are for, he says). He teaches the rest of the goop to use it.
- **40–49:** the speaker is shared by him and the goop, breaking up more as the pressure rises.
- **The ending:** when the tank opens, the speaker gives one last clear line in his voice, then goes quiet for good — that's where you finally lose touch with it.

## The speaker bubble (the Veteran) — Muzzy 2026-10-23, likely a framework piece
Muzzy: "it has an outline - it's a static outline, doesn't move. then while the text is 'typing out' in the speech bubble, the outline 'frizzes' like a spikey signwave, and does small scale pops to mimic words or syllables … a spikey sign wave that acts like a speech wave to indicate speaker static and talking." Reference strip: `.planning/design/refs/speaker-bubble-strip.png`.
- **Opens:** the bubble grows from small to full size, tail (the arrow) included.
- **Then the text types out.** While it types, part of the outline becomes a **spiky sine wave** — a speech wave. It fluctuates with the letters and does **small scale pops** for words / syllables.
- **Pauses:** between sentences, at "…" and after some words, the wave **relaxes** back to the flat outline.
- **Done, waiting for you to confirm:** the outline now and then **squelches** — a burst of static wave — to say it's a speaker with a shoddy connection.
- **How much of the border:** his strip shows the wave on a stretch of the top edge; "it could also be the entirety of the bubble" → **two knobs: where the wave starts and where it ends** along the outline (Muzzy: "that way I can adjust the length and placement by changing the starting/ending point"). Set to go all the way round, the two ends **meet seamlessly** — the wave's length is fitted to a whole number of waves round the outline, and it fades to flat at a start/end that isn't a full loop.
- **The other two voices:** the goop gets a **blobby** bubble (telepathy and, later, mouths); Management speaks on its CRT monitor.
- **Approved in sketch S9** (Muzzy 2026-10-23: "approved"): `.planning/research/sketches/speaker-bubble.html`, values in `.planning/research/speaker-bubble/picks.json` — the wave runs along the first third of the outline from the top-left (0 → 0.34), spikes ~19 px apart and up to 51 px tall, fairly sharp (roundness 3 of 10), uneven spacing (0.45); 2.5% outline pop per syllable (text stays still); 22 letters/s; 380 ms rest at sentence ends; a squelch every 2.5 s ± 1.5 s while waiting. Sent to the framework as a "talking bubble" kit request.
- **Where it's built:** a general "talking bubble" piece (open / type / talk wave / pauses / idle squelch) belongs in the framework UI kit, so other games get it; Goops gives it the spiky-wave style. Sketch it first in Goops (S9), then hand the picks to the framework.

## How story moments play (Muzzy 2026-10-23: "short cut scenes — just text and attention calling in the console/tank, not actual cut scenes")
- A story moment = text in one of the three places (monitor · speaker subtitles · words in the tank) plus **attention calling** on the console or tank: a light blinks, the monitor flickers, the speaker grille buzzes, eyes in the goop all turn to look, the visor dims for a beat. The same spotlight/outline the lessons already use.
- **Not skippable — short instead** (Muzzy 2026-10-23: "not skippable. if they're short. they'll be over soon."): a few lines, tap to move on; never mid-shift unless it's a whisper that needs no tap.
- Built on the lesson runner (F30) — a story beat is a lesson step with a different voice.

## The final shift (rank 50) — the boss level (Muzzy 2026-10-23, riffing)
Muzzy: "i removed colors because this final rush is more intense, less methodical. it's a 'boss' level … the goal is to overwhelm (slightly) the player."
- **The Veteran drops in first.** A white clump with eyes and a mouth: "oh! Hi!" "It's me!" It falls like a normal piece, lands — "oof" — then more talk: glad you're not goop yet; he'll help however he can.
- **Management knows you know.** It ramps up the pressure and the goop: an onslaught. **It's trying to explode the tank.**
- **All goop is black (galaxy black), all cracks are black** → every piece merges with every other and any goop seals any crack. No colour sorting: a different kind of challenge.
- **Faster and more often:** goop falls more often and falls faster than any rank before.
- **You:** place and pop, place and pop, getting overrun.
- **The Veteran:** goops around the tank sealing the cracks **you can't reach**. He's efficient, but **he loses a little of himself with every crack he seals** — he's sacrificing himself for you (he shrinks).
- **You lose if:** the Veteran is used up completely · the goop goes over the top of the tank · integrity drains to 0.
- **How you win — 3 valve stages** (Muzzy 2026-10-23): seal **X** cracks → the Veteran tells you to head to the console: a **new panel** has popped up, a mini-game that opens the release valve one stage. The shift keeps going while you're there, and **crack seals stop counting until you've done the current stage**. Then **Y** cracks → stage 2, then **Z** cracks → stage 3. The third release opens it entirely and **releases all the goop from their tanks** → victory → **The ending**.
  - The release valve is new to the player here: it's the panel Management never let you see. Its first stage is the first time it's named.
  - It works like the machine repairs you already do at the console mid-shift (`content/tuning/breakdowns.json`: the shift runs slower there, `consoleTimeScale`) — same intention, same motion.
  - **His seals count** toward X / Y / Z (Muzzy 2026-10-23: "yes") — so leaning on him is faster but uses him up. **X / Y / Z start at 6 / 8 / 10** (tuning, in `content/` when built; "i'm sure we'll tune it"). **The valve mini-game:** decided later — "should be just as simple" as the repairs.
- **How it plays as one colour** (Muzzy): you use the tank's **rotation to build separate towers** so you can reach the high cracks; and since every crack is black, one wide clump can seal **several cracks at once** (already true today: a wide red clump seals every red crack it covers).
- ⚠ **To prove:** that "slightly overwhelming" pace — a sketch or a bot run before it's built.

## The ending (rank 50) — save the goop
Muzzy: "we'll need an ending where we save the goop instead of zapping it." Claude's draft:
1. **Promotion.** The monitor congratulates you: Department Head. Your debt is "restructured" (it goes up). You now have the **release valve key**.
2. **The last shift is played backwards** (the same tank, the same controls, new goal): don't zap. Merge goop instead — every colour, every clump — so the goop can hold together. Pressure is no longer the enemy: you let it rise on purpose. Management types faster and faster on the monitor, fining you live ("UNAUTHORISED MERCY: 9,999 cr").
3. **The valve.** When the goop is one big piece, you pull the periscope one last time — but this time it opens the tank. The goop pours out (the console shakes; the screen fills).
4. **The goop speaks** — out loud, through every mouth: thank you, and its names. The Veteran's speaker goes quiet (he's free).
5. **The last line**, on the monitor, back to cheerful: "Position available: G.O.O.P.S. Operator. No experience necessary. Apply today." ❓ — or something kinder.
- ❓ **Is the ending a choice?** Claude's pick: **no choice, one ending.** The whole game earns it; a "stay loyal" ending would undo it. (A second, bleak ending could be a secret later — e.g. finishing the last shift by zapping.)
- **What happens to you: later** (Muzzy 2026-10-23: "let's cross that bridge after the story is built and we discuss the final levels"). Options so far: you walk away (debt and all) · you stay as the new Veteran for the next operator · you step into the goop and join them. Claude's pick: **you stay at the console, and the last whisper is in your own voice** — ambiguous, as v1 wanted ("you become the boss — but what does that mean?").
- **Rank 50 = you beat the game** (Muzzy 2026-10-23: "you can beat this game. level 50 is beating the game."). After the ending the console shows the end-game screen (Muzzy's end-game art in `art/`). **Afterwards: a new career** (Muzzy: "sure. same exact flow, but with a visual upgrade to the console/periscope/vat or something. we can sort that out much later") — the same game from rank 0, with a changed-looking console / periscope / vat to show you've won. Which upgrade: later.

## Rank titles — 12, in bands (Muzzy 2026-10-23: "12 titles, but the final title is only given out at the end. make that make sense and the banding should work with it")
How it works:
- **Rank 0 has its own title** (the first day) and **the 12th title isn't a rank at all — it's the win.** Rank 50 (the final shift) still carries the 45–50 title; **Department Head** appears only when the third valve stage opens.
- **Who gives it:** not Management — the goop. When the tank opens, the monitor glitches and the goop rewrites your badge. Management's titles were all "assistant", "acting", "interim": it never meant to promote anyone. The real acronym lands on the same screen (Gradual Onboarding Of Permanent Staff).
- **Every title change lands on a story beat**, so a new title is a moment, not a number.

| Ranks | Title | The beat it lands on |
|---|---|---|
| 0 | Probationary Intern (Unpaid) | Your first day — contract, debt, bunk |
| 1–4 | Junior Tank Associate | Your first payday; the first machines break |
| 5–9 | Tank Associate | The speaker crackles: the Veteran, and the scraps |
| 10–14 | Goop Technician | The goop grows eyes |
| 15–19 | Senior Goop Technician | Whispers become words |
| 20–24 | Pressure Specialist | Goop starts holding together (multi-colour pieces) |
| 25–29 | Lead Pressure Specialist | The Veteran tells you what the goop is |
| 30–34 | Containment Supervisor | The Veteran is caught; white goop arrives; the cracks spread |
| 35–39 | Senior Containment Supervisor | The white goop (him) speaks in your head |
| 40–44 | Assistant to the Department Head | The speaker comes back: him and the goop; mouths open |
| 45–50 | Acting Deputy Department Head (Interim) | Management slips — it isn't human; rank 50 = the final shift |
| **the win** | **Department Head, G.O.O.P.S.** | Given by the goop when the valve opens — not a rank, the ending |

## Sample lines (tone check)
- Monitor, rank 0: "WELCOME, OPERATOR. YOUR COMFORT IS OUR POLICY. YOUR BUNK IS 0.8 m WIDE. YOUR DEBT HAS BEEN PRE-APPROVED."
- Monitor, rank 12: "THERE ARE NO VOICES IN THE TANK. HEARING VOICES IN THE TANK IS A FINEABLE OFFENCE."
- Speaker, rank 5: "—you the new one? ──── scraps in your panel. ─── don't tell the screen."
- Speaker, rank 33: "I been here… a long time. Never seen a window. Don't think there are any."
- In your head, rank 3: "…cold…"
- In your head, rank 27: "…we had names… do you have a name…"
- In your head, rank 38: "…please… not the laser… just… hold us…"
- End report fine, any rank: "Excessive blinking: 3 cr."

## Design rules for the story
- Management never seems evil directly — always "policy", "procedure", "for your comfort".
- The Veteran starts brief and cryptic and becomes clearer as trust builds.
- The goop's voice is the only one without a box or frame — it's in your head.
- Story moments are short and **not skippable** — over before they're in the way (Muzzy 2026-10-23); one per rank-up, never a gap in who's talking.
- Every new difficulty has a story reason (Management making your job harder, never "the game gets harder").
- The tank's purpose is never stated outright before the 40s; the rumours contradict each other on purpose.

---

## Earlier version (v1 PRD, kept for reference)
- **Theme:** modern indentured servitude disguised as career progression.
- **Characters:** the Employer (intercom, "policy"), the Veteran (radio hijacks, upgrades, eventually revealed as a brain in liquid), the Operator (silent, reaches rank 50 and takes over).
- **Delivery:** garbled intercom that highlights key words; Operator Journal; rank-up beats (complications = employer, upgrades = veteran's contraband).
- **Arc:** 0 onboarding · 1–9 learning, first hints · 10–19 the Veteran interrupts · 20–29 harder, fines up · 30–39 the facility falls apart, the employer blames you · 40–49 the full picture · 50 the takeover, ambiguous.
- **Titles (placeholder):** Trainee → Junior Operator → Operator → Senior Operator → Supervisor → Director → Executive.
