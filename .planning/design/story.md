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
| **Management** (the company) | The console's **top monitor** — the DOS-style typed screen the machine lessons already use | Clean, cheerful, typed out, corporate. Always "policy", "procedure", "for your comfort". Small slips that suggest they aren't human ("Remember to breathe your mandatory amount of air.") | Never openly cruel. Never explains what the tank is for — or explains it differently every time. |
| **The Veteran** | A **speaker** on the console (a new grille in the art ❓) — his words appear as crackly subtitles beside it | Scratchy, urgent, in fragments, static eats words: "—don't trust the — ── ── they're not—" | Brief and cryptic early; clearer as he trusts you. He's the one who leaves you **scraps** (the upgrade money) — upgrades are his smuggled parts. |
| **The Goop** | **In your head** — words that drift up inside the periscope view, over the tank (wobbly, faint, no frame — unlike the HUD's plain messages) | **Gets better at talking over time** (Muzzy 2026-10-23): feelings and broken sounds first ("…warm…", "…tight…", "…nnn…"), then single words, then broken sentences, then whole sentences and names — and by the end it talks out loud through its mouths | Only you can hear it. Management never mentions it — until very late. |

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

## Debt, wages and fines (the trap)
- Every end-of-shift report adds a **paycheque**: wages in, then lodging, meals and an itemised list of fines out, leaving your **passage debt** at the bottom. The debt is designed to grow slowly whatever you do: "Remaining passage debt: 48,219 cr (+112)".
- **Fines are the joke engine:** small, petty, specific, from your actual shift where possible (❓ how many come from what you really did):
  - Real (from the shift): ruptures ("Unscheduled pressure event"), missed cracks, machine breakdowns ("Unauthorised wear on Company laser"), quitting early.
  - Silly (random): "Excessive blinking", "Unapproved facial expression", "Periscope fingerprints", "Lodging: air (premium)", "Use of the word 'help' near a microphone", "Late (time dilation is not an excuse)".
- **Credits ≠ scraps.** Credits are the Company's money and you never have any. Scraps are the Veteran's parts — the only thing you can spend.
- ❓ **Does the debt touch gameplay?** Claude's pick: **no** — it's story only, shown on the report. The economy stays scraps + XP, so tuning stays simple; the debt just makes every report a little sad and funny.

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
| ❓ Black goop | — | "Residue. Do not engage." | Claude's pick: the oldest goop, pressed so long it's forgotten who it was — it doesn't talk, doesn't merge, and only wild goop can wake it (clear it). The Veteran's own body is down there. |

## The arc, rank by rank
| Ranks | Title band (❓ names) | Beats | Voices |
|---|---|---|---|
| **0** | Probationary Intern (Unpaid) | Your first day (the tutorial). Welcome to G.O.O.P.S. Your contract, your debt, your bunk. Everything is fine. | Monitor only. |
| **1–4** | Junior Tank Associate | Learning the job; the first machines break. First fines on the report. First silly acronym. | Monitor. One whisper you'll doubt ("…cold…"). |
| **5–9** | Tank Associate | **The speaker crackles at rank 5** — the Veteran's first words, and the upgrade store opens: "Found some scraps. Left 'em in your panel. Don't tell the screen." | + Veteran (fragments). |
| **10–19** | Goop Technician → Senior | Eyes appear. Whispers become words ("…don't…", "…heavy…"). The Veteran: "Don't trust everything the screen says." Management "reminds you" there's no such thing as voices. | All three. |
| **20–29** | Pressure Specialist → Lead | Fines go up. Goop holds together. The Veteran tells the station's history: how many operators there have been (a lot), where they "retired" to. The goop says its first name. | All three; Veteran clearer. |
| **30–39** | Containment Supervisor → Senior | The tank falls apart; Management blames you. The goop **asks you to stop zapping it**. The Veteran admits he's never seen the outside. You find your own name in a list of "pending retirements". | Goop sentences; Veteran in full. |
| **40–49** | Assistant to the Department Head → Acting Deputy (Interim) | The full picture: the goop is people; the pressure is Management's power; the debt is how they keep operators coming. **The Veteran's signal is coming from inside the tank** — he's the black goop at the bottom (the v1 "brain in a jar", now literally in the goop). Management slips: it isn't human. | Everything. Mouths open. |
| **50** | **Department Head, G.O.O.P.S.** | The takeover — see **The ending**. | — |

## The ending (rank 50) — save the goop
Muzzy: "we'll need an ending where we save the goop instead of zapping it." Claude's draft:
1. **Promotion.** The monitor congratulates you: Department Head. Your debt is "restructured" (it goes up). You now have the **release valve key**.
2. **The last shift is played backwards** (the same tank, the same controls, new goal): don't zap. Merge goop instead — every colour, every clump — so the goop can hold together. Pressure is no longer the enemy: you let it rise on purpose. Management types faster and faster on the monitor, fining you live ("UNAUTHORISED MERCY: 9,999 cr").
3. **The valve.** When the goop is one big piece, you pull the periscope one last time — but this time it opens the tank. The goop pours out (the console shakes; the screen fills).
4. **The goop speaks** — out loud, through every mouth: thank you, and its names. The Veteran's speaker goes quiet (he's free).
5. **The last line**, on the monitor, back to cheerful: "Position available: G.O.O.P.S. Operator. No experience necessary. Apply today." ❓ — or something kinder.
- ❓ **Is the ending a choice?** Claude's pick: **no choice, one ending.** The whole game earns it; a "stay loyal" ending would undo it. (A second, bleak ending could be a secret later — e.g. finishing the last shift by zapping.)
- ❓ **What happens to you?** Options: you walk away (debt and all) · you stay as the new Veteran for the next operator · you step into the goop and join them. Claude's pick: **you stay at the console, and the last whisper is in your own voice** — ambiguous, as v1 wanted ("you become the boss — but what does that mean?").
- ❓ **After the ending:** endless shifts continue (rank 50+) with the goop free and a new tank? Or the game is done and the console shows the end-game screen (Muzzy already has end-game art in `art/`)?

## Rank titles (draft — ❓ Muzzy's call)
| Ranks | Title |
|---|---|
| 0 | Probationary Intern (Unpaid) |
| 1–4 | Junior Tank Associate |
| 5–9 | Tank Associate |
| 10–14 | Goop Technician |
| 15–19 | Senior Goop Technician |
| 20–24 | Pressure Specialist |
| 25–29 | Lead Pressure Specialist |
| 30–34 | Containment Supervisor |
| 35–39 | Senior Containment Supervisor |
| 40–44 | Assistant to the Department Head |
| 45–49 | Acting Deputy Department Head (Interim) |
| 50 | Department Head, G.O.O.P.S. |

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
- The story is additive and never blocks play — skippable, but good enough that players want to read it.
- Every new difficulty has a story reason (Management making your job harder, never "the game gets harder").
- The tank's purpose is never stated outright before the 40s; the rumours contradict each other on purpose.

---

## Earlier version (v1 PRD, kept for reference)
- **Theme:** modern indentured servitude disguised as career progression.
- **Characters:** the Employer (intercom, "policy"), the Veteran (radio hijacks, upgrades, eventually revealed as a brain in liquid), the Operator (silent, reaches rank 50 and takes over).
- **Delivery:** garbled intercom that highlights key words; Operator Journal; rank-up beats (complications = employer, upgrades = veteran's contraband).
- **Arc:** 0 onboarding · 1–9 learning, first hints · 10–19 the Veteran interrupts · 20–29 harder, fines up · 30–39 the facility falls apart, the employer blames you · 40–49 the full picture · 50 the takeover, ambiguous.
- **Titles (placeholder):** Trainee → Junior Operator → Operator → Senior Operator → Supervisor → Director → Executive.
