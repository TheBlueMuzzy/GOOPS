# Goops — Story
> Living design doc, linked from GDD §1 and §5. **Draft 3 (2026-10-23, Sprint 13)** — Claude's write-up of Muzzy's direction (his words below). Everything marked **❓** is open for Muzzy. The v1 PRD's version is kept at the bottom for reference.

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
- **30–39:** eyes blink and look worried when pressure is high (no relief close on a sealed crack — Muzzy 2026-10-24: "doesn't make sense").
- **40–49:** some clumps grow **mouths**, silent at first: shut most of the time, now and then one opens for a few flaps as if saying something (random, rare). Eyes, brows and mouths show up one clump at a time, at random within ~5 s.
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
| **50** | Acting Deputy Department Head (Interim) | **The final shift** (all galaxy black, the Veteran drops in), then **The ending** — the win title is given by the goop. | Everything. |

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
| 50 | The final shift (the Veteran drops in), then the ending — you beat the game | — |

- **5–29:** the speaker crackles every rank-up; he leaves scraps and warnings, clearer as he trusts you.
- **30: caught.** Mid-sentence the monitor cuts in: "UNAUTHORISED BROADCAST LOCATED. OPERATOR #0001 HAS BEEN SCHEDULED FOR RETIREMENT." The speaker goes dead. That shift's report has a fine for *you*: "Association with a retired employee". From now on you salvage your own scraps — you're the veteran now (report words change; the economy doesn't).
- **31: the white goop.** A single clump in the tank, plain white, with his squint — he stands out (Muzzy). **It IS the Veteran** (Muzzy). In play: never merges or pops, drifts to the most dangerous crack and slowly seals it (the "every difficulty" table).
- **31–39: the goop ramps up** to fill his place: a goop moment every rank-up, getting better at talking each time.
- **~35:** the white goop's first words in your head — him, still him.
- **40: the speaker crackles again** — he got to its wire through the cracks (that's what cracks are for, he says). He teaches the rest of the goop to use it.
- **40–49:** the speaker is shared by him and the goop, breaking up more as the pressure rises.
- **The ending:** when the tank opens, the speaker gives one last clear line in his voice, then goes quiet for good — that's where you finally lose touch with it.

## Story moments, rank by rank (0–50) — Sprint 13 draft
One moment per rank-up, shown at the console before the next shift (not skippable, so each is short: 1–3 lines, tap to move on). It plays in the voice's own place: **MON** = the top monitor (capitals, typed out) · **SPK** = the speaker (the talking bubble; `──` = static) · **HEAD** = in your head (the blobby bubble, lower case). **Look** = the attention call. Rank titles show on the end report when they change ("New title: …"), not in the moment.

| Rank | Voice | Lines | Look |
|---|---|---|---|
| 0 | MON | WELCOME, OPERATOR #4471. YOUR PASSAGE DEBT HAS BEEN PRE-APPROVED. · PLEASE SIGN HERE. · PLEASE KEEP THE TANK FROM EXPLODING. | The monitor flickers on; you sign the contract (type your name — see **Your name**); then the first day's lessons |
| 1 | MON | CONGRATULATIONS ON YOUR FIRST PAYDAY. · A NEXT-PIECE WINDOW HAS BEEN INSTALLED. ITS RENTAL IS ON YOUR BILL. | The next-piece window lights |
| 2 | MON | YOUR PERISCOPE IS ON BACKORDER. ESTIMATED ARRIVAL: SOON. · THE OLD ONE WILL DO. | The visor flickers |
| 3 | MON | SWAPPING PIECES IS NOW PERMITTED. · G.O.O.P.S. = GENERAL OVERFLOW & ORGANIC PRESSURE SERVICES. | The swap key glows |
| 4 | MON | LASER POWER IS NOW RATIONED FOR YOUR SAFETY. · PLEASE ZAP RESPONSIBLY. | The laser meter blinks |
| 5 | SPK | —you the new one? ── scraps in your panel. ── don't tell the screen. | The speaker grille buzzes for the first time; the Upgrades button lights |
| 6 | SPK | Controls run hot. ── goop gets in the gears. ── easy on the turning. | The controls meter blinks |
| 7 | SPK | Screen fine you yet? ── fines everybody. ── pay it no mind. | The report's fines line glows |
| 8 | SPK | You hear it too? ── the cold voice. ── ...thought so. | The tank dims for a beat |
| 9 | SPK | Got you a pressure part. ── fell off a cart. ── don't ask which cart. | The Upgrades button lights |
| 10 | SPK | Look close at the big clumps. ── ...they look back, don't they. | Eyes open in the tank, all at once, then close |
| 11 | SPK | Don't let the eyes get to you. ── zap 'em anyway. ── gotta eat. | One eye follows the falling piece |
| 12 | SPK | Screen says there's no voices. ── screen says a lot of things. | The monitor flickers (it heard that) |
| 13 | SPK | How long you signed for? ── ...yeah. me too. ── long time ago. | — |
| 14 | SPK | Ever count the operators before you? ── don't. ── numbers get big. | — |
| 15 | SPK | Words now, right? ── in your head. ── that's them learning. | The tank dims; a whisper drifts up |
| 16 | SPK | Ask the screen what the tank's for. ── go on. ── different answer every time. | The monitor shows a new acronym |
| 17 | SPK | Found a manual. ── half the pages are fines. ── other half's blank. | — |
| 18 | SPK | Pressure's not a side effect, kid. ── ...forget I said that. | The pressure line glows |
| 19 | SPK | Keep your head down this week. ── they're counting watts. | The monitor flickers |
| 20 | SPK | See 'em clumping? ── different colours, holding on. ── like hands. | A multi-colour piece glows as it falls |
| 21 | SPK | Where'd the last operator go? ── "retired." ── ask where. | — |
| 22 | SPK | Tank's older than the Company says. ── older than me. ── and I'm old. | Cracks glint |
| 23 | SPK | Screen fined me for coughing. ── 40 cr. ── I cough a lot now. | — |
| 24 | SPK | You hear 'em say a name yet? ── ...listen tonight. | Eyes in the tank turn to you |
| 25 | SPK | Nobody pays it off, kid. ── nobody leaves. ── think about where they go. | The speaker crackles longer than usual |
| 26 | SPK | Operator list goes back 900 names. ── every one "retired." ── not one left on a ship. | — |
| 27 | SPK | They tell you names yet? ── write 'em down. ── somebody should. | A whisper: "…Odile…" |
| 28 | SPK | Gonna show you something. ── next shift. ── if the screen don't catch me first. | The monitor flickers |
| 29 | SPK | The goop is us. ── every operator who couldn't pay. ── they don't retire you, they ── | The speaker cuts out mid-word |
| 30 | SPK → MON | ── kid, they're onto ── · UNAUTHORISED BROADCAST LOCATED. OPERATOR #0001 HAS BEEN SCHEDULED FOR RETIREMENT. | The monitor flashes red; the speaker dies in one last squelch. The report fines YOU: "Association with a retired employee" |
| 31 | HEAD | …new… one… white… · …he is… here… | A white clump drops in; every eye turns to it |
| 32 | HEAD | …he helps… · …we help… too… | The white goop drifts to a crack |
| 33 | HEAD | …tight… so tight… · …you feel it… | The pressure line wobbles |
| 34 | HEAD | …we were… operators… · …like you… | Eyes blink, slowly, together |
| 35 | HEAD (him) | …kid… it's me… · …keep working… just… listen… | The white goop looks up at you; its squint |
| 36 | HEAD | …he says… you have… a name… · …what is… your name… | — |
| 37 | HEAD (him) | …it's warm in here… · …warmer than the bunk… | The white goop glows a little |
| 38 | HEAD | …please… not the laser… · …just… hold us… | The laser meter dims |
| 39 | HEAD | …your name… is on a list… · …we saw it… | The report shows "Pending retirements: Operator #4471 — <your name>" |
| 40 | SPK | ── can you hear me? ── got to the wire through a crack. ── that's what cracks are for. | The speaker crackles back to life; mouths appear in the tank |
| 41 | SPK (the goop) | …we… can talk… here too… · …LOUD… | The grille buzzes in time with the mouths |
| 42 | SPK | The pressure's power, kid. ── runs the whole station. ── runs something above it too. | The pressure line glows |
| 43 | SPK (the goop) | …the screen… is not… people… · …we have… seen them… | The monitor flickers |
| 44 | SPK | Ever seen who reads your reports? ── nobody has. ── ask yourself why. | — |
| 45 | MON | CONGRATULATIONS, HUMAN RESOURCE. · *OPERATOR. YOUR MANDATORY AIR ALLOWANCE HAS BEEN ADJUSTED. | The monitor glitches: for one frame, something that isn't a face |
| 46 | SPK | There's a valve. ── under your console. ── they never let anyone near it. | A panel on the console rattles |
| 47 | MON | THERE IS NO RELEASE VALVE. · PLEASE DO NOT LOOK UNDER YOUR CONSOLE. | The same panel rattles again |
| 48 | SPK (the goop) | …when you open it… · …we go… home… | Every mouth in the tank opens at once |
| 49 | SPK | Last stretch, kid. ── they know you know. ── next shift they come at you with everything. | The speaker and the monitor both flicker |
| 50 | MON → him | FINAL PERFORMANCE REVIEW IN PROGRESS. PRESSURE INCREASED 400%. · (a white clump falls) oh! hi! · it's me! · …oof. · glad you're not goop yet. I'll help how I can. | The final shift starts (see **The final shift**); at each valve stage: "valve's open on your console — go!" |

**Built (F45, 2026-10-26): ranks 40–49 play as written** — content/story/moments.json + en.json story.lines; "SPK (the goop)" = voice `goop` (the speaker bubble's place and wave in the goop's colours); 45's glitch and self-correcting slip, 46/47's rattling hatch (it opens in F64), 48's all-mouths-open in the next shift (eyes.json chorus*). Waiting for a piece: 41's grille buzz, 42's glowing pressure line. Rows 0–39 were built in F35 / F40 / F63.

Checks on this table: 51 rows, one voice each; the hand-overs have no gap (5 MON→SPK · 30 SPK→MON cut-in · 31 HEAD at once · 40 SPK back · 50 everything); the machines and twists line up with their unlocks (1 next piece · 2 visor · 3 swap · 4 laser · 5 upgrades · 6 controls · 10 eyes · 20 multi-colour · 30 cracks spread + white · 40 wild goop + mouths).

**In-shift whispers (no tap, the blobby bubble drifts up and fades):** 3 "…cold…" · 8+ one feeling a shift ("…warm…", "…tight…", "…nnn…") · 15+ single words ("…don't…", "…heavy…", "…hold…") · 24+ names ("…Odile…", "…Bram…") · 31+ sentences. **Monitor in-shift:** a new G.O.O.P.S. guess on the report every ~5 ranks; rank 12+: "THERE ARE NO VOICES IN THE TANK. HEARING VOICES IS A FINEABLE OFFENCE." when a whisper shows.

## Fines and payday — the lines (Sprint 13 draft)
**Fines from what really happened** (picked first, when the shift had one):
| Event | Fine line |
|---|---|
| A rupture | Unscheduled pressure event |
| The laser broke | Unauthorised wear on Company laser |
| The visor broke | Periscope misuse |
| The controls overheated | Excessive tank rotation |
| Cracks still open at the end | Hairline fracture negligence |
| Goop left at the end | Goop residue on Company property |
| A long time at the console | Unscheduled console loitering |
| Poking goop that can't pop | Premature zapping |
| (rank 30, once) | Association with a retired employee |

**Silly fines** (top up the rest; some only from a rank on): Excessive blinking · Picking nose on camera · Unapproved facial expression · Periscope fingerprints · Humming · Sighing above approved volume · Unlicensed whistling · Breathing above allowance · Looking at the clock · Leaning · Smiling sarcastically · Unauthorised optimism · Dream overage (bunk) · Excess gravity usage · Thinking on Company time · 12+ Hearing voices · 15+ Talking to the goop · 40+ Talking back to the speaker.

**Payday — the 5 deductions** (shares of the payment due; tunable): Lodging (0.8 m bunk) 40% · Meals (nutrient paste) 30% · Air 15% · Periscope rental 10% · one rotating extra 5%: Uniform laundering (you have no uniform) · Window fee (there is no window) · Dental plan (there is no dentist) · Light rental · Gravity surcharge. Then the story-only line: "Remaining passage debt: 48,219 cr — interest applied" (it barely moves, and at 30+ it goes UP).

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

## Story runs on its own (Muzzy 2026-10-23: "the story continues throughout, so can you do the story without all the other elements…? I think so.")
- Yes. A story moment is words plus an attention call on something that already exists (a light, the monitor, the speaker). When its Look needs a piece that isn't built yet (eyes at 10 = F62, the white goop = F63, mouths at 40), the moment plays its words only, and the look switches on when that piece lands. So the story can be built rank by rank, ahead of the twists.
- What it does need: the talking bubble (F61, being built in the framework now) for the speaker and the goop.

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
  - **The valve mini-game (Muzzy 2026-10-26):** spin a set of **2 wheels** to the right orientation so a **needle on a meter between them moves to the centre**. Details still open (how a wheel spins on a phone / keyboard, how the two wheels move the needle, whether stages 2–3 get fussier) — a /sketch to try it first.
  - **His seals count** toward X / Y / Z (Muzzy 2026-10-23: "yes") — so leaning on him is faster but uses him up. **X / Y / Z start at 6 / 8 / 10** (tuning, in `content/` when built; "i'm sure we'll tune it"). **The valve mini-game:** decided later — "should be just as simple" as the repairs.
- **How it plays as one colour** (Muzzy): you use the tank's **rotation to build separate towers** so you can reach the high cracks; and since every crack is black, one wide clump can seal **several cracks at once** (already true today: a wide red clump seals every red crack it covers).
- ⚠ **To prove:** that "slightly overwhelming" pace — a sketch or a bot run before it's built.

## The ending — save the goop (rewritten 2026-10-23 to follow the final shift)
Muzzy: "we'll need an ending where we save the goop instead of zapping it." The final shift IS the saving (the 3 valve stages); the ending is what plays after the third one. All text, on the console and the tank:
1. **The tank opens.** The console shakes; the goop pours out of the tank and out of every tank on the station (the periscope view fills).
2. **The goop speaks out loud**, through its mouths (the blobby bubble, now from the goop itself): thank you, and its names.
3. **The speaker's last line**, clear for the first time, in the Veteran's voice: "told you you'd make a good veteran, kid." Then it goes quiet for good.
4. **The last payday:** "Remaining passage debt: 0 cr — paid by: 1,312 former employees."
5. **The badge.** The monitor glitches; the goop crosses out your title and writes the win title (see **Rank titles**) — and under it the real acronym: **GRADUAL ONBOARDING OF PERMANENT STAFF.**
6. **You leave** (Muzzy 2026-10-23: "B"). The goop carries you out through the open tank; the last screen is the empty console. (Turned down: staying as the next Veteran; climbing into the goop.)
7. **Then the end-game screen** (Muzzy's art in `art/`), and the new career: a new operator at that empty console — the same game from rank 0 with the console / periscope / vat upgraded (which upgrade: later).
- **One ending, no choice** (Claude's pick kept): the whole game earns it. A secret bleak ending could come later.
- The old draft's "last shift played backwards" is replaced by **The final shift** (Muzzy's design).

## Your name — how the goop knows it (Muzzy 2026-10-23: "how does the goop know your name? do we have a level 0 sign in?")
- **You sign the contract at rank 0.** The first-day monitor says "PLEASE SIGN HERE" and you type a name — no account, no sign-in, saved on the device with the rest of the save. Skip it and you're just Operator #4471.
- The goop learns it from the Veteran (rank 36: "…he says… you have… a name…") and from the list it saw (rank 39: "Pending retirements: Operator #4471 — <your name>"). From 39 the whispers and the ending can use it.
- **Later, maybe a framework profile module** (a name + an avatar, shared by every game). Goops only needs the name. Planned in F66.

## Rank titles — 12, in bands (Muzzy 2026-10-23: "12 titles, but the final title is only given out at the end. make that make sense and the banding should work with it")
How it works:
- **Rank 0 has its own title** (the first day) and **the 12th title isn't a rank at all — it's the win.** The last title you earn by ranking comes at 45 and lasts to 49 (Muzzy: "if 50 no longer gives title, then it has to be 49, right?" — yes). Rank 50 is the final shift itself, played under that same title; the win title appears only when the third valve stage opens.
- **Who gives it:** not Management — the goop. When the tank opens, the monitor glitches and the goop rewrites your badge. Management's titles were all "assistant", "acting", "interim": it never meant to promote anyone — so the win title is NOT a job title (Muzzy 2026-10-23: "need a new title when you beat the game. like. The Freed, or The GOOP, or king of the goops or savior of goopkind, or One Of Us"). The real acronym lands on the same screen (Gradual Onboarding Of Permanent Staff).
- **The end titles** (Muzzy 2026-10-23: "former employee is funny. but I think you get that at lvl 0 of the next game. but when you get to 50, maybe if you lose lvl 50, you get One Of Us, and it's like that until you actually beat it. then you get The Savior of Goopkind"):
  - **Lose the final shift → One Of Us.** It replaces Acting Deputy on your badge and stays until you beat it (Management's interim title is gone; the goop has claimed you).
  - **Beat it → The Savior of Goopkind**, written on your badge by the goop.
  - **The next career's rank 0 → Former Employee** instead of Probationary Intern — it's you, hired back (Muzzy 2026-10-23: "they erase your memories.... idk? who cares about perfect continuity. this is a silly game"). It lasts one rank. The first monitor line slips: "WELCOME BA— …WELCOME, OPERATOR #4471."
- **Every title change lands on a story beat**, so a new title is a moment, not a number.

| Ranks | Title | The beat it lands on |
|---|---|---|
| 0 | Probationary Intern (Unpaid) | Your first day — contract, debt, bunk |
| 1–4 | Junior Tank Associate | Your first payday; the first machines break |
| 5–9 | Tank Associate | The speaker crackles: the Veteran, and the scraps |
| 10–14 | Goop Technician | The goop grows eyes |
| 15–19 | Senior Goop Technician | Whispers become words |
| 20–24 | Pressure Specialist | Goop starts holding together (multi-colour pieces) |
| 25–29 | Lead Pressure Specialist | The Veteran starts telling the truth — it gets him caught |
| 30–34 | Containment Supervisor | The Veteran is caught; white goop arrives; the cracks spread |
| 35–39 | Senior Containment Supervisor | The white goop (him) speaks in your head |
| 40–44 | Assistant to the Department Head | The speaker comes back: him and the goop; mouths open |
| 45–49 | Acting Deputy Department Head (Interim) | Management slips — it isn't human |
| 50 | (same title) → **One Of Us** after a lost final shift | The final shift — One Of Us stays until you win |
| **the win** | **The Savior of Goopkind** | Given by the goop when the valve opens — not a rank, the ending |
| next career, 0 | Former Employee | Your new career's first day |

## Sample lines (tone check)
- Monitor, rank 0: "WELCOME, OPERATOR. YOUR COMFORT IS OUR POLICY. YOUR BUNK IS 0.8 m WIDE. YOUR DEBT HAS BEEN PRE-APPROVED."
- Monitor, rank 12: "THERE ARE NO VOICES IN THE TANK. HEARING VOICES IN THE TANK IS A FINEABLE OFFENCE."
- Speaker, rank 5: "—you the new one? ──── scraps in your panel. ─── don't tell the screen."
- White goop in your head, rank 37: "…it's warm in here… warmer than the bunk…"
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
