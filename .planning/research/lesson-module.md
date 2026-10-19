# Lesson module: what Goops taught us (for the framework)

For the framework session, when it lifts the Goops lesson runner (F30) into a shared module. This is game-agnostic: kinds of tutorial moments any game can use. The Goops code it starts from is in `src/game/lessons/`: runner.ts is game-free, goopsLessons.ts is the adapter, and LessonView.tsx draws on the kit Callout.

## Muzzy's message kinds (2026-10-19, from playing the F32 breakdown lessons)
"By no means complete" — a start.

1. **Progressive.** Doesn't interrupt: floats there for X seconds while play goes on. With or without a dismiss/confirm button.
2. **Progressive → interrupt.** Same look, but if the player ignores it, it escalates: spotlight/dim layer, the game pauses, and only the ignored action works until they do it. (Goops: "go to the console" escalates once the visor glitch is fully bad, ~4 s.)
3. **Interrupt.** The same strict form from the start, with no progressive stage. On rails: pause, dim, one allowed action.
4. **Highlights.** Bounding boxes or outlines that bring focus to things. One outline can wrap several parts as one target, e.g. a light + the slider it belongs to.
5. **Full modal.** A mostly full-screen takeover with text + images/GIFs/videos, usually with a confirm and/or carousel controls to step back and forth through a sequence.

## Rules learned the hard way (Goops F32, Muzzy's first try)
- **Spotlight, not layering.** A dim layer with cut-outs: the message and its target stay bright, everything else dims. "It's about showcasing what we want."
- **Fixed size from the first frame.** The message and its button appear together. A box that reshapes when the button arrives looks broken.
- **One text at a time.** Never two messages stacked or swapping in one box.
- **Inside the play area.** On desktop a phone-made game is a column; messages never sit outside it.
- **The outline wraps the WHOLE target.** The whole screen, not its text. The light AND the control it belongs to.
- **Words say what to do.** "Drag the slider toward the light", not "do what the blinking light asks". An alert light alerts; it doesn't instruct.
- **Say it in one place only.** If the game's own screen already says it (Goops: "Pull the periscope to go back" on the monitor), the lesson adds a highlight, not a second message.
- **Use the game's own screens when there are any.** Goops at the console uses the CRT monitor as the lesson box. It slides a toaster down only when it needs more room, so there are no pop-ups at the console; pop-ups are used in the tank. Module hook: "render this lesson text in the game's own panel".
- **Teaching a control = teaching how it really works.** A drag is taught as a drag, and the control itself must not accept a tap-teleport.
- **Wrong input gets the same feedback everywhere.** Touching the slider at the button stage shakes it like a wrong button does.
- **Once per device, replayable.** Lessons remember they were seen, and Settings has "Replay lessons". A lesson counts as seen only when its key action is done.
- **A lesson never freezes a fail state.** A rupture mid-lesson drops the lesson, and it plays again next time.

## More kinds (research, 2026-10-19)
Ranked by how useful each one is for small web/phone games. "Trigger" = the game event that starts a lesson. "Seen flag" = the once-per-device memory the runner already has. Kinds 1–8 are worth building first; 17–22 can wait until a game needs them.

**1. Ghost hand (gesture demo).** A see-through hand or finger plays the move on the real control (drag, swipe, hold), on a loop, until the player does it.
- Fits: any touch gesture that words describe badly (drag, swipe, pinch, hold). Doesn't fit: plain taps on a button that's already highlighted.
- Example: Candy Crush's first levels, where a hand swipes one candy into place.
- Module needs: `gesture` (tap / drag / swipe / hold), `from`/`to` targets (the same anchors highlights use), loop speed, a pause between loops; it stops when the player starts the gesture. Reduce motion: shows a still arrow instead.

**2. Idle nudge (just-in-time hint).** If the player does nothing useful for N seconds, the game quietly points at a good move.
- Fits: puzzle and turn-based screens where a player can get stuck. Doesn't fit: real-time danger, where the hint would come too late.
- Example: Candy Crush makes a possible match wiggle after a few seconds of no input.
- Module needs: an idle timer the game can reset ("the player did something useful"), a `delay` in content/ (Roblox suggests trying 5 s against 10 s), and a game hook `suggestTarget()` that returns what to point at. Settings: hints on/off.

**3. Safe first meeting (teach by design, no text).** The level is built so the first time you meet a thing, you can't get hurt and the right move is obvious.
- Fits: every new hazard or mechanic. Use it first and add words only if playtests show players miss it. Doesn't fit: menus and meta screens.
- Example: Super Mario Bros 1-1's first Goomba; Portal's test chambers.
- Module needs: almost nothing from the runner. It needs a "first time" flag per thing that the game's spawner or level script can read (`isFirstEncounter(id)`) so the game can make that encounter gentle.

**4. Device-aware input prompts.** The lesson shows the right control for the device: "Tap", "Click", "Space", or a gamepad button icon. It swaps live if the player changes device.
- Fits: every web game, since one build runs on phone and desktop. Doesn't fit: nothing; any lesson that names a control needs it.
- Example: Celeste swaps keyboard keys and controller buttons on screen the moment you touch the other one.
- Module needs: text tokens like `{confirm}` and `{drag}` that resolve per input type, an icon set per input type, and a "last input used" watcher (pointer type: touch / mouse / pen, keyboard, gamepad).

**5. Unlock announcement (F59 rank unlocks).** A short celebration card when something new opens up: "New: the sonar. Try it on the next dive."
- Fits: rank-ups, new tools, new modes. Show it at a calm moment (results screen or menu), never mid-action. Doesn't fit: things unlocked with no new rule to learn (a cosmetic only needs fanfare, not a lesson).
- Example: Clash Royale's new-card reveal when you reach a new arena.
- Module needs: a queue of pending announcements saved to storage (so one earned mid-dive shows after it), a "calm moment" hook from the game (`isCalm()`), image/icon, and an optional link to the follow-up lesson ("show me" starts the real lesson the next time it's relevant).

**6. "New" badge (red dot).** A small dot or NEW tag on a button or item until the player has opened it.
- Fits: menus, shops, codex entries, anything added by an unlock. Doesn't fit: the play field itself (it adds clutter).
- Example: Clash Royale's red dots on new cards and unclaimed rewards.
- Module needs: a per-item "seen" set in storage, `markSeen(id)`, and a badge part in the UI kit. Parent buttons show a dot if any child is unseen.

**7. Gradual feature reveal.** Buttons and systems stay hidden or locked until the player is ready, so the first screen is simple.
- Fits: anything with menus or meta systems. Pairs with 5 and 6. Doesn't fit: a game that only has a few controls in total.
- Example: Clash Royale unlocks clans, shop sections and modes by level instead of showing them on day one.
- Module needs: an `unlockedBy` rule per feature (rank, lesson done, games played), `isUnlocked(id)` for the UI, and a Dev Kit switch to "unlock all" for testing.

**8. Hold-to-explain tooltip.** Press-and-hold (phone) or hover (desktop) on anything to get its name and one line of what it does.
- Fits: icons, cards, status effects, keyword terms. Doesn't fit: as the only way to teach something the player must use; it's for reference.
- Example: Slay the Spire's keyword pop-ups on cards; Into the Breach's hover info on every tile and unit.
- Module needs: this is the pending Inspect module ("?" + Select). The lesson module only needs to point at it: "hold any part to learn more" as a one-time lesson, plus shared text from the codex (17).

**9. Outcome preview.** Before the player commits, the game shows what will happen (damage numbers, where a piece lands, what breaks).
- Fits: turn-based and puzzle games; it teaches the rules by showing them, and keeps doing it forever. Doesn't fit: fast action, where there's no time to read it.
- Example: Into the Breach shows every enemy attack and every push before you move.
- Module needs: mostly game-side. The module offers a "ghost" style (faded, dashed) so previews look the same in every game, plus a setting to turn previews off for experts.

**10. Success cheer.** A quick, warm confirmation when the player does the taught thing: a sound, a pop, a word ("Nice!"). It closes the lesson.
- Fits: the end of every action lesson; it tells the player "that was it". Doesn't fit: reference tips that have no action.
- Example: Duolingo's "Nice!" ding; Candy Crush's "Sweet!".
- Module needs: an `onDone` feel tier (small / medium / big from content/feel.json), using the game's existing feedback animation rather than a new one.

**11. Failure explainer.** After a loss, one short line on why it happened and what to try next time.
- Fits: any game you can lose, especially early on. Goops: what caused the rupture. Doesn't fit: losses the player clearly caused and understood; skip it after the first few.
- Example: League of Legends' death recap.
- Module needs: a `cause` the game passes with the fail event (`onFail(causeId)`), a text per cause, and a counter so each cause explains itself only the first 1–2 times.

**12. Struggle help (difficulty-adaptive).** After several failures at the same spot, the game offers help: a stronger hint, an easier version, or a skip. The player chooses; it's offered, never forced.
- Fits: levels with a clear wall. Doesn't fit: competitive or score-chase modes, where help changes fairness (keep it out of ranked play).
- Example: New Super Mario Bros Wii's Super Guide appears after 8 deaths on a level; Celeste's Assist Mode is a player-chosen version of the same idea.
- Module needs: a fail counter per spot (`failCount(spotId)`), a `threshold` in content/, what to offer (a hint lesson, an easier setting, a skip), and a setting to turn the offers off.

**13. Hint ladder.** Hints on request, in steps: a gentle nudge first, then clearer, then the answer.
- Fits: puzzle games. Doesn't fit: games with no single right answer.
- Example: Professor Layton's three hints per puzzle, then a super hint.
- Module needs: a `hints[]` list per puzzle or situation, a "hint" button the game shows, which step the player is on, and optionally a cost.

**14. "Played before?" question and skip.** At first launch, ask "New to <game>?" and offer "Show me" or "I know how to play". There's also a skip on long lessons.
- Fits: any game; returning players and players on a new device hate re-learning. Doesn't fit: a lesson that's under 5 seconds (skipping is slower than doing it).
- Example: Civilization VI asks your experience level and sets its advisor hints to match.
- Module needs: an `experience` setting (new / some / expert) that each lesson checks against its own `level` tag, a skip control on sequences, and "Replay lessons" (already there). Skipped lessons count as seen but stay in the replay list.

**15. "You left something" reminder.** A light nudge when the player is about to move on with something unused: an unspent upgrade, a tool never tried, an action left.
- Fits: end-of-turn, leaving a shop, ending a run. Doesn't fit: if it fires every time; it must stop once the player has shown they know.
- Example: Hearthstone's End Turn button stays yellow while you have moves left and turns green when you don't.
- Module needs: a game hook `pendingThings()` that returns what's unused, a check at "leaving" moments, and a "stop after the player ignores it N times" rule.

**16. Menu tour (coach marks).** A short guided walk through a new screen: highlight a part, one line of text, next. ("Coach mark" = a bubble pointing at a part of the screen.)
- Fits: meta screens the first time (shop, upgrades, settings). Keep it to 3 steps or fewer. Doesn't fit: gameplay; tours are forgotten by the time they matter.
- Example: Duolingo's first-time pointers on its home screen.
- Module needs: this is kinds 4 + 1 from Muzzy's list strung together; a `steps[]` list with next/back and a "done" that counts as seen. Reuse the carousel controls from the full modal.

**17. Help codex (handbook).** A help screen that fills in as you meet things: every enemy, tool or rule you've met has a page you can reread.
- Fits: games with many parts (enemies, cards, tools). It's where skipped or forgotten lessons live. Doesn't fit: tiny games with 3 rules (one Help screen is enough).
- Example: Slay the Spire's Compendium; Hades' Codex.
- Module needs: `entries[]` with id, title, text, image, and `unlockedBy` (met or lesson seen); auto-add when a lesson is seen; New badges (6); one entry's text shared with tooltips (8) so it's written once.

**18. Practice sandbox.** A no-fail space to try controls or a new tool before it counts.
- Fits: tricky skills, or a new tool from an unlock. Doesn't fit: simple games; just make the first real level gentle (3).
- Example: Clash Royale's Training Camp against a bot; fighting games' training mode.
- Module needs: a game-side "practice" mode flag (no fail, no score, no saving) that lessons can launch: `startPractice(scenarioId)`.

**19. Contextual action prompt.** A small "Tap to open" style prompt appears right on a thing when the player can use it, and goes away when they can't.
- Fits: games where you walk or aim near things (Goops' tank and console). Doesn't fit: board/grid games where everything is always usable.
- Example: Zelda: Breath of the Wild's "A Open" or "A Pick up" prompts.
- Module needs: `showPrompt(target, actionText)` / `hidePrompt` from the game, device-aware text (4), and a rule to show it only until used N times.

**20. Welcome-back refresher.** After a long break, replay the key lessons in short form, or offer to.
- Fits: games played in bursts with weeks between. Doesn't fit: daily-play games.
- Example: Duolingo's welcome-back review after missed days (an app, but the pattern is well known).
- Module needs: a "last played" date in storage, a `staleAfterDays` in content/, and a `refresher: true` tag on the lessons worth repeating.

**21. Starter goals list.** A short checklist of first goals ("Dive once", "Use the sonar", "Rank up") that leads new players through the systems.
- Fits: games with several systems to discover. Doesn't fit: one-mechanic arcade games.
- Example: Stardew Valley's early journal quests.
- Module needs: `goals[]` with a done-condition event, progress saved to storage, a reward hook, and a small UI kit list part.

**22. Between-round tips.** One-line tips shown on loading, matchmaking or results screens.
- Fits: deeper knowledge that's nice to know, rotated. Doesn't fit: anything the player must know (most players don't read them), or loads too short to read.
- Example: Clash Royale's tips while it searches for a battle.
- Module needs: `tips[]` with an optional "only after X is unlocked" condition, rotation without repeats, and a rule to never show a tip shorter than readable time; with no load time, show it on the results screen instead.

Already covered by Muzzy's list, so not repeated here: in-world (diegetic) teaching through the game's own screens (Goops console monitor) — the Portal-style extension is world signs or props, which is kind 3 plus the "render in the game's own panel" hook.

## More rules
From the research (The Gamer's Brain, Game Accessibility Guidelines, Roblox onboarding docs, well-known teardowns) plus what fits the rules above.
- **One new thing at a time.** Attention is small; a second new idea pushes out the first. Space new mechanics out over levels and sessions, not all on the first screen.
- **Say → do → cheer.** The player acts straight after being told, while it's fresh, then gets the success cheer (10). Never two lessons before the player has had a turn.
- **Show before telling.** A ghost hand, preview or safe first meeting beats a sentence. Add words only for what the picture can't show.
- **Teach at the moment of need.** A lesson appears when the thing is first useful, not in an up-front list.
- **Let them try first.** Wait a few seconds before a hint (idle nudge timing). Players who figure it out feel smart, and the lesson then marks itself seen.
- **Proven = learned.** If the player does the action before its lesson fires, mark the lesson seen and don't show it. Don't teach what they already know.
- **Then test it, then twist it.** After the safe first meeting, use the thing in a real (but fair) moment, then later in a new combination. That's how a lesson sticks.
- **Never time-limit text that matters.** Progressive messages that fade out stay at least long enough to read (a base time plus time per word, kept in content/), pause while touched or hovered, and anything important waits for the player. Keep a way to read it again (replay or codex).
- **Readable everywhere.** Text follows the game's text-size setting, meets contrast rules, and is short: verb first, about 12 words or fewer per message.
- **Reduce motion respected.** Ghost hands, pulses and bouncing arrows become still arrows and outlines; nothing flashes more than 3 times a second.
- **One lesson at a time, with priority.** A queue: the most important lesson wins, others wait, a short gap goes between lessons, and none fire during danger (the game's `isCalm()`).
- **The dismiss tap never hits the game.** Closing a message must not also press what's behind it.
- **All lesson text lives in content/.** That makes it editable in the Dev Kit and Obsidian, and ready to translate. Control names are tokens (`{confirm}`), never typed into the text.
- **Skipping is never a punishment.** Skipped lessons stay replayable and in the codex.
- **Same lesson look in every game, same motion.** Ghost hand, cheer, badge and spotlight are the module's parts; games style them through the UI kit, not with one-off effects.
- **Measure where players drop.** Log lesson shown / done / skipped / time-to-do (Dev Kit only). A lesson many players take long on, or skip, is a design problem, not a player problem.

Sources: [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/basic/), [GAG: replay instructions](https://gameaccessibilityguidelines.com/?p=3102), [Roblox onboarding techniques](https://create.roblox.com/docs/en-us/production/game-design/onboarding-techniques), [Xbox accessibility guideline 116: time limits](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-116-time-limits.md), Celia Hodent, *The Gamer's Brain* (2017).
