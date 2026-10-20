# Lesson module: design notes for the framework

What Goops is teaching us about tutorials, organised so the framework session can build a shared **lesson module** from it. It covers Muzzy's message kinds (2026-10-19), the F32 playtest rules and the research.

**Keep it growing:** every lesson finding in Goops (and later Glyphtender, Roll Better) goes into this file, in the section it belongs to. Goops is the test bed; the framework gets the result.

Goops code it starts from: `src/game/lessons/`, where `runner.ts` has no Goops code, `goopsLessons.ts` is the adapter and `LessonView.tsx` draws on the kit Callout. Lessons are data in `content/lessons/*.json`.

---

## 1. The model: a lesson = steps, each built from 5 choices

A **lesson** is a short sequence of **steps** (one step can be a whole lesson). Each step picks one option from each of these five, which is how a few parts cover every pattern in §2.

### A. Strength: how hard it holds the player (only two)
- **Progressive:** doesn't interrupt. It shows while play goes on, with or without a Got it button. If it closes itself, it stays up long enough to read (§3).
- **Interrupt:** on rails. The game pauses, the spotlight dims everything else, and only the one action being taught works.
- **They can chain.** A progressive step can escalate into an interrupt when it's ignored, after X seconds or when a game condition is met. It keeps the same message and adds pause + spotlight + one allowed action. Goops: "go to the console" escalates about 4 s after the visor glitch is fully bad.

### B. Surface: where the words show
- **Bubble:** a message box pointing at something. Goops: the kit Callout in the tank.
- **Game panel:** the words show on one of the game's own screens (in-world). If the text needs more room, a toaster slides down out of the screen and back. Goops: the console's CRT monitor. Rule: when a game panel exists, use it there and no bubbles.
- **Card:** a full-screen takeover with text + images, GIFs or video, a confirm, and back/next controls for a sequence.
- **Prompt:** a tiny label on a thing that can be used right now ("Tap to open"). It goes away when the thing can't be used.
- **Badge:** a dot or NEW tag on a button until the player opens it. A parent button shows a dot if any child is unseen.
- **Tip line:** one rotating line on a loading, matchmaking or results screen.
- **None:** the step only highlights, or only shapes the level, because something else already says it (§3 "say it in one place").

### C. Focus: what draws the eye (combine freely)
- **Highlight:** an outline that wraps the WHOLE target. One outline can join several parts into one target, e.g. a light + its slider.
- **Spotlight:** a dim layer with cut-outs. The message and the target stay bright. It always comes with an interrupt, and it can be used on its own.
- **Ghost hand:** a see-through finger acts out the gesture (drag, swipe, hold) on the real control, on a loop, until the player starts it. With reduce motion on, it becomes a still arrow.
- **Outcome preview:** before the player commits, a faded "ghost" shows what will happen (where a piece lands, what breaks). It's one shared ghost style for every game.

### D. Trigger: when it starts
| Trigger | Starts when… | Game hook it needs |
|---|---|---|
| First time | the thing is first met or first useful | `isFirstEncounter(id)` / a game event (Goops: first machine break) |
| Idle | no useful move for N seconds | an idle timer the game resets; `suggestTarget()` |
| Struggle | N failures at one spot (help is offered, never forced; never in ranked play) | `failCount(spotId)` |
| Fail | a loss: one line on why it happened, only the first 1–2 times per cause | `onFail(causeId)` |
| Leaving | the player moves on with something unused (stops after being ignored N times) | `pendingThings()` |
| Unlock | something new opens; queued (saved) until a calm moment | `isUnlocked(id)`, `isCalm()` |
| Can use now | the player can use a thing right now (for prompts) | `showPrompt(target, action)` / `hidePrompt` |
| First launch | "New to <game>?" sets an experience level (new / some / expert) | — |
| Back after a break | the player returns after N days | "last played" date |
| On request | the player asks: hint button, Help, Replay lessons | — |

### E. Ending and memory: how it finishes and what's remembered
- **Advance:** on the taught action, on Got it, or when a condition is met. Steps the player is already past are skipped.
- **Cheer:** a quick warm "that was it" (sound, pop, a word) using the game's existing feel tiers, never a new effect.
- **Seen, per device:** it counts as seen when its key action is done, not when it was shown. **Proven = learned:** if the player does the action before the lesson starts, the lesson is marked seen and never shows.
- **Replay and skip:** "Replay lessons" in Settings. Skipped lessons count as seen but stay replayable and in the Help pages.
- **Experience level:** each lesson has a level tag, and the first-launch answer filters out lessons below the player's level.

### Collections built on the above
- **Tour:** 3 steps or fewer of highlight + bubble on a new menu screen, with next/back. It's a lesson made of bubble steps.
- **Hint ladder:** hints on request, from a nudge to clearer to the answer (Professor Layton).
- **Help pages (codex):** a page for each thing the player has met. Pages are added as lessons are seen, get NEW badges, and share text with hold-to-explain, so each is written once.
- **Starter goals:** a short checklist of first goals ("Rank up once", "Seal 10 cracks") with progress saved and a reward hook (Stardew's early quests).
- **Tip pool:** rotated, no repeats, with "only after X is unlocked" conditions.
- **Practice:** a no-fail mode a lesson can launch (`startPractice(scenarioId)`) with no score and no saving. Goops already has one: training mode, `createShift({ training })`.
- **Hold-to-explain** belongs to the planned Inspect module ("?" + Select). The lesson module only teaches it once ("hold any part to learn more").

---

## 2. Named patterns, as combinations
Each well-known pattern is just a mix of the choices in §1, so the module needs no special code for each.

| Pattern | Strength | Surface | Focus | Trigger | Example |
|---|---|---|---|---|---|
| Floating tip | progressive | bubble | highlight | first time | Goops: the 25%-speed note on the first 5 console visits |
| Escalating instruction | progressive → interrupt | bubble | highlight → spotlight | first time | Goops: go to the console |
| On-rails step | interrupt | bubble / game panel | spotlight + highlight | first time | Goops: the first repair, step by step |
| Gesture demo | progressive | none | ghost hand | first time / idle | Candy Crush's first swipes |
| Idle nudge | progressive | none | highlight / ghost hand | idle | Candy Crush wiggles a possible match |
| Safe first meeting | — (level design) | none | — | first time | Mario 1-1's first Goomba; Portal |
| Device-aware words | any | any | — | — | Celeste swaps keys and buttons live |
| Unlock announcement | interrupt (at a calm moment) | card | — | unlock | Clash Royale's new-card reveal → Goops F59 |
| Gradual reveal + NEW | — | badge | — | unlock | Clash Royale |
| Failure explainer | progressive | bubble / card | — | fail | League of Legends' death recap → Goops: why the tank ruptured |
| Struggle help | progressive (an offer) | card | — | struggle | NSMB Wii's Super Guide; Celeste's Assist Mode |
| "You left something" | progressive | prompt / highlight | highlight | leaving | Hearthstone's End Turn button stays yellow |
| Contextual prompt | progressive | prompt | — | can use now | Zelda: BotW's "A Open" |
| Story pages / how to play | interrupt | card | — | first launch / on request | — |
| Welcome back | progressive (an offer) | card | — | back after a break | Duolingo |
| Between-round tip | progressive | tip line | — | — | Clash Royale while it searches for a battle (example not checked) |

---

## 3. Rules
**Teaching**
- **One new thing at a time.** Space new mechanics out over levels and sessions.
- **Say → do → cheer.** The player acts right after being told, then gets the cheer. Never two lessons before the player has had a turn.
- **Show before telling.** A ghost hand, a preview or a safe first meeting beats a sentence; add words only for what a picture can't show.
- **Teach at the moment of need,** not in an up-front list.
- **Let them try first.** Wait a few seconds before a hint, so players who figure it out feel smart.
- **Then test it, then twist it.** After the safe first meeting, use the thing in a real moment, then later in a new combination.
- **Words say what to do.** "Drag the slider toward the light", not "do what the blinking light asks". An alert light alerts; it doesn't instruct. Verb first, about 12 words or fewer.
- **Teach a control the way it really works.** A drag is taught as a drag, and the control itself must not accept a tap-teleport.

**Presentation**
- **Spotlight, not layering.** "It's about showcasing what we want": cut-outs keep the message and the target bright.
- **Fixed size from the first frame.** The text and its button appear together; a box that reshapes looks broken.
- **One text at a time** in one box.
- **Inside the play area.** A phone-made game is a column on desktop, and messages never sit outside it or cover their target.
- **The outline wraps the WHOLE target:** the whole screen, not its words; the light AND its control.
- **Say it in one place only.** If the game's own screen already says it, the lesson adds focus, not a second message (Goops: "Pull the periscope to go back" is already on the monitor).
- **Use the game's own screens where they exist** (the game panel surface).
- **Wrong input gets the same feedback everywhere.** Goops: touching the slider at the button stage shakes it like a wrong button does.
- **Same look and motion in every game.** Spotlight, ghost hand, cheer and badge are module parts, styled through the UI kit.

**Flow and safety**
- **One lesson at a time, with priority.** A queue, a short gap between lessons, and none during danger (`isCalm()`).
- **A lesson never freezes a fail state.** Goops: a rupture mid-lesson drops the lesson, and it plays again next time.
- **The dismiss tap never hits the game** behind the message.
- **Never time-limit text that matters.** A self-closing message lasts a base time plus time per word (values in content/), pauses while touched or hovered, and anything important waits for Got it. It can always be read again via Replay or the Help pages.
- **Skipping is never a punishment.**

**Accessibility**
- Text follows the game's text-size setting and meets contrast rules.
- **Reduce motion:** ghost hands and pulses become still arrows and outlines, and nothing flashes more than 3 times a second.

**Data and tools**
- **All lesson text lives in content/,** editable in the Dev Kit and Obsidian and ready to translate. Control names are tokens (`{confirm}`, `{drag}`) that the module turns into the right word or icon for the device in use, switching live. It needs a "last input used" watcher: touch, mouse, pen, keyboard or gamepad.
- **Timings and strengths are settings:** escalation delay, dim strength, idle delay (try 5 s against 10 s) and read time.
- **The Dev Kit can jump to any lesson step, replay it, and "unlock all".**
- **Measure where players drop.** In the Dev Kit, log when each lesson is shown, done or skipped, and how long the action took. A lesson many players stall on is a design problem.

---

## 4. Where Goops is (the test bed)
| Part | Goops status |
|---|---|
| Runner: steps from data, advance on action / dismiss / gate, wait-then-hint, queue, rules clock | ✅ F30 |
| Practice (training mode), Dev Kit jump/replay | ✅ F30 |
| First-time trigger, seen per device, Replay lessons | ✅ F32 |
| Bubble surface (kit Callout) | ✅; F32 task 7: fixed size, one text, inside the column |
| Game panel surface (the CRT monitor + toaster) | 🔨 F32 task 7 (Muzzy's call, 2026-10-19) |
| Progressive → interrupt chain, spotlight with cut-outs, whole-target highlight | 🔨 F32 task 7 |
| Unlock trigger (F59) | ✅ `isUnlocked(what, rank)` + "the start of the first shift after it" as the calm moment; ONE per calm moment (several pending unlocks wait for the next shift start, earliest first — never a stack before the first piece falls); finding: the module's `isCalm()` wants a "one per calm moment" option |
| A lesson with no play running (F59) | ✅ the console between shifts: a one-step lesson with no set-up, nothing to pause, no Got it (game panel surface + outline on a menu button), finished by a screen event (`upgradesOpened`); finding: the runner needs no game at all for this — the module should allow a lesson outside play |
| Failure explainer (why the tank ruptured) | planned: F31's rupture ending |
| Unlock announcement + gradual reveal | planned: F59 rank unlocks |
| Device-aware words | partly (the lesson picks its mouse/keys/touch line); tokens are for the module |
| Ghost hand | candidate: the visor slider drag, the flick up |
| Hint timing: from / unless / again (F31 spike) | ✅ runner (see §5) |
| "Event while a state holds" conditions (F31) | ✅ runner: `if` on an event / action condition |
| Interrupt armed for a range of steps + "make sure it happens" (F31) | ✅ runner: interrupt `from` / `to`, step `ensure` |
| Live pointers by kind (nearest open crack, biggest group, an off-screen thing's arrow) (F31) | ✅ Goops (`goopsGates.ts`); the module needs the idea, not the code |

## 5. Findings from the first-day spike (F31, 2026-10-20)
Checking a whole 15-step scripted day against the runner (tutorial.md §9) turned up these general needs — none Goops-only:
- **A hint has three clocks, not one.** "N s after the step starts" isn't enough: *from* (the wait starts when something happens — "3 s after the goop is ready"), *unless* (doing the thing means no hint for the rest of the step; one already up goes and the step's own words come back — "3 s without fast-dropping"), *again* (each time this happens the wait starts over — "20 s without a seal", which is also how the Idle trigger in §1.D works). Before this, only the step moving on stopped a hint, so a player who'd already done the thing still got told to.
- **A miss is an event plus a state.** "The piece landed AND the crack is still open" can't be one event or one gate. Conditions need `if`: an event that only counts while a gate holds. (The game's events must arrive after the state they changed — Goops' do, as a batch after each tick.)
- **Discoveries need a range and a guarantee.** A discovery lesson ("cracks out of view") is armed only from the step that sets it up (`from` / `to` step ids), and one that MUST be taught before the lesson ends gets a staged fallback: a later step's `ensure` makes it happen if it hasn't (and skips if it was seen on this device before).
- **Safety rails = normal play + holds, in that order.** "Free play, but you can't lose yet" is one set-up: normal rules first, then the holds on top. A set-up applied in a fixed order where "normal" comes last silently undoes the rails.
- **Point at things by kind, picked live.** Where goop and cracks end up is the player's doing, so pointers name a kind ("the nearest open crack", "the biggest blue group", "the arrow of the off-screen crack") and the game picks it each frame — fixed cells only work for things the lesson placed.
- **A scripted piece order needs a rule for when it runs out,** decided as each piece comes in (it sees what the last piece built), not when it's queued. Goops: "green O's, with a blue I first while the column under the crack is too low".
- **The game's own feedback can BE the lesson** ("Above the pressure line" when you zap too early). The rule "the game's messages keep quiet while a lesson message is up" silences it, so such a step must show no lesson message (or repeat the line as a reaction). Module option worth adding: a step flag that lets the game's own short feedback through.
- **One lesson can span screens with no game running at its ends** (day one starts at the console and ends on the report): the runner already copes without an engine (F59); what's needed is the game handing the lesson from screen to screen without stopping it.

## Sources
[Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/basic/) · [GAG: replay instructions](https://gameaccessibilityguidelines.com/?p=3102) · [Roblox onboarding techniques](https://create.roblox.com/docs/en-us/production/game-design/onboarding-techniques) · [Xbox accessibility guideline 116: time limits](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-116-time-limits.md) · Celia Hodent, *The Gamer's Brain* (2017). The game examples come from general knowledge and weren't checked online.
