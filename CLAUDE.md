# Claude Code Context for Goops

## On Session Start (Automatic)

A **SessionStart hook** automatically injects `.planning/STATE.md` after `/clear`, fresh `claude` invocation, or `claude --continue`. When you see this injected content:

1. Check "Known Issues" section (bugs + tech debt)
2. Find "Next Steps" section
3. Greet: "Welcome back. Last session: [summary]. Next up: [action]"
4. Surface Known Issues briefly
5. Offer to continue or show alternatives

**No user command needed** — just run `/clear` and the startup happens automatically.

---

## About the User
- **Not a professional engineer** — good with logic, not abstract coding patterns
- Prefers **human-readable code** over clever abstractions
- Values **targeted, minimal changes** — don't refactor beyond what's asked
- Always provide **terminal commands ready to copy/paste**

## Project Overview
Goops is a puzzle-action game built with React/TypeScript/Vite. Player clears colored goop from a cylindrical pressure tank. Mobile-optimized.

**Deployed:** https://thebluemuzzy.github.io/GOOPS/

---

## Commands

### Quick Commands

| Command | What Claude Does |
|---------|------------------|
| `<commands>` | Show this command list (including GSD commands) |
| `<flow>` | Show the daily workflow diagram |
| `<npm>` | Start dev server (`npm run dev -- --host`) or confirm already running |
| `<test>` | Show manual testing steps for current changes |
| `<runtests>` | Run automated tests (`npm run test:run`) |
| `<save>` | Full save: update all docs + commit + push (see details below) |
| `<deploy>` | Merge to master + build + deploy to GitHub Pages |
| `<research>` [topic] | Deep research on topic (or current context if no topic given) |
| `<askme>` | Stop and ask clarifying questions before acting (prevent assumptions) |

### GSD Commands (Planning & Tracking)

Use these at transition points — not constantly, but when you need direction.

| Command | When | What It Does |
|---------|------|--------------|
| `/gsd:progress` | **Start of session**, between tasks | Check status, get routed to next action |
| `/gsd:plan-phase` | Ready to build something | Create detailed execution plan |
| `/gsd:execute-plan` | Plan exists and approved | Claude codes the plan |
| `/gsd:verify-work` | Code complete, ready for UAT | Guided manual testing checklist |
| `/gsd:plan-fix` | UAT found issues | Plan fixes for the issues |
| `/gsd:complete-milestone` | All phases done | Archive milestone, prep next |
| `/gsd:new-milestone` | Starting a new major version | Define phases for the milestone |

**Less common:** `/gsd:discuss-phase`, `/gsd:research-phase`, `/gsd:pause-work`, `/gsd:resume-work`

---

## Core Rules

### Before Responding to Any Question
**Stop and run this checklist:**
1. What is the user trying to accomplish? (not what they literally asked)
2. Should I implement/fix/set up this thing, or just explain it?
3. Is there a better approach they haven't considered?

**Then respond with:**
- Brief answer to what they asked
- "I'll [action] now" — then do it
- If a better approach exists, say so before acting

**Never** just dump information and stop. Always end with action or a concrete offer.

### Context Hygiene (Mandatory)
**Use subagents (Task tool) when:**
- Reading more than 2 files to answer a question
- Exploring/searching the codebase
- Researching anything (docs, web, how-tos)
- Running exploratory commands

**Do NOT** read files directly or run grep/glob yourself for exploration.
Delegate to subagent → get summary back → main context stays clean.

### After ANY Code Change (Claude's Job)

**MANDATORY CHECKLIST — Do ALL of these, in order:**

1. [ ] Run `npm run test:run` — fix failures before proceeding
2. [ ] Restart dev server: `npm run dev -- --host` (background)
3. [ ] Wait 3-4 seconds, then read `.build-number` file
4. [ ] Produce the **Handoff Block** below (copy this format exactly)

**HANDOFF BLOCK (Required Output):**
```
## Ready for Testing

**Build #[NUMBER]** — Look for "Version 1.1.13.[NUMBER]" in footer

**Server:** http://localhost:[PORT]/GOOPS/

**What Changed:**
- [Bullet list of changes]

**Manual Test Steps:**
1. [Step with expected result]
2. [Step with expected result]
3. [etc.]
```

**Example:**
```
## Ready for Testing

**Build #13** — Look for "Version 1.1.13.13" in footer

**Server:** http://localhost:5173/GOOPS/

**What Changed:**
- Added wild pieces at rank 40+
- Changed max rank from 100 to 50

**Manual Test Steps:**
1. Set rank to 40, start game — should see rainbow pieces (15% chance)
2. Open rank selector — should only show 0-50
```

**This is non-negotiable.** Do not end your response without the Handoff Block.

### Git Discipline
- **Feature branches** for all new work (never code on master)
- **Commit often** — after each working piece
- **Push daily** — don't lose work
- **Merge only when deploying** — master = deployed version

### Context Window
User cannot see token count until it's shown. Claude cannot see it at all.
- Save early, save often
- When user says `<save>`, do a FULL save (all docs)
- If user mentions low context, prioritize saving immediately

### When Context Auto-Compacts (Preserve These)
- All modified file paths and current changes
- Test results (pass/fail status)
- Current branch and recent commits
- Known Issues from STATE.md
- The Core Rules from this file (especially the checklists)

---

## Command Details

### `<npm>`
```
1. Check if dev server already running (look for existing process)
2. If running: "Dev server already at localhost:5173 (network: [IP]:5173)"
3. If not: Start `npm run dev -- --host` in background
4. Show both localhost and network URLs
```

### `<test>`
```
1. Look at what was changed this session (files modified, features added/fixed)
2. Provide specific manual testing steps the user should perform
3. Include what to look for (expected behavior) and what would indicate a bug
4. Keep it focused — only steps relevant to current changes
```
Example: "1. Start a game at rank 30+. 2. Wait for cracks to spawn. 3. Verify they grow over time when not covered by goop."

### `<runtests>`
```
1. Run `npm run test:run`
2. Report: "✓ 150 tests passed" or show failures
3. (Claude auto-runs this after code changes anyway)
```

### `<save>` (The Big One)
```
1. Run tests (verify nothing broken)
2. Update STATE.md:
   - Current task state (done vs pending)
   - What was accomplished this session
   - Any bugs/blockers found
   - Decisions made
   - Next steps
3. Update other docs if relevant:
   - ROADMAP.md if phase status changed
   - PROJECT.md if requirements changed
4. Git add all changes
5. Generate descriptive commit message
6. Git commit + push
7. Say: "Saved and pushed. Ready to /clear or keep working."
```

### `<deploy>`
```
1. Run tests (safety check)
2. Merge current branch to master (if not on master)
3. Run `npm run deploy`
4. If success: "✓ Deployed! https://thebluemuzzy.github.io/GOOPS/"
5. If fail: Show error message
```

### `<research>` [topic]
```
1. If topic provided: research that topic deeply
2. If no topic: research whatever we were just discussing
3. Use claude-code-guide agent or web search as appropriate
4. Return comprehensive findings with actionable recommendations
5. For Claude Code questions: check hooks, settings, CLI options
6. For game/code questions: explore codebase, check patterns
```
Use when you need deep investigation before making decisions.

### `<askme>`
```
1. STOP — do not take action yet
2. Review what was just asked/discussed
3. Identify any assumptions you'd be making
4. Ask clarifying questions to fill gaps in understanding
5. Only skip questions if you TRULY understand with no ambiguity
6. Wait for answers before proceeding
```
Use when you want to ensure Claude doesn't assume intent or approach.

### `<flow>`
Show the **full** daily workflow diagram from SOP.md — the big ASCII graphic with branching paths (in "The Daily Flow" section). Not a simplified version.

### `<commands>`
Show the command tables above.

---

## Key Files

| File | Purpose |
|------|---------|
| `.planning/STATE.md` | Current position, session continuity |
| `.planning/PROJECT.md` | Requirements, key decisions |
| `.planning/ROADMAP.md` | Milestones, phases, progress |
| `.planning/SOP.md` | Workflow reference, concepts, flow diagrams |
| `PRD.md` | Full game requirements |
| `constants.ts` | Upgrade configurations |

---

## Current Status

**Version:** 1.1.13 (build auto-increments)
**Tests:** 150 across 7 files
**Milestones complete:** v1.0 (MVP), v1.1 (Architecture), v1.2 (Progression)

### Key Systems
- **Complications**: LASER@rank4, LIGHTS@rank2, CONTROLS@rank6
- **Upgrades**: 20 total (8 Onboarding + 4 Junk + 4 Mixer + 4 Cracked)
- **XP Curve**: `3500 + (rank * 250)` per rank

---

## Project-Specific Patterns

### Code Reuse
Always check for existing patterns before creating new ones:

| Need | Solution | Location |
|------|----------|----------|
| Shake animation | `className="shake-anim"` | `GameBoard.css` |
| Event communication | `gameEventBus.emit()` | `core/events.ts` |
| Stop pointer events | `e.stopPropagation(); e.preventDefault();` | Common pattern |

### Mobile Performance
Mobile is throttled to 40fps with simplified rendering. Key files:
- `hooks/useGameEngine.ts` — Frame throttling
- `components/GameBoard.tsx` — `isMobile` conditional rendering

**Do NOT remove `isMobile` checks without understanding why they exist.**

### Version Numbers
Format: **X.Y.Z.B** (Major.Minor.Patch.Build)
- **B** auto-increments on dev/build
- **Z** bumped for meaningful changes
- **Y** bumped for milestone completion
- **X** bumped for release to friends

### File Sizes to Watch
- `GameEngine.ts` ~1197 lines (CrackManager extracted)
- `GameBoard.tsx` ~758 lines (manageable)
