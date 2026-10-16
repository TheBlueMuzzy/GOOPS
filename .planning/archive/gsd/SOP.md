---
title: Standard Operating Procedures
type: reference
tags: [workflow, commands, process]
updated: 2026-01-25
---

# Development SOP

This document covers both **how to work** (commands, workflow) and **how to think** (concepts, tradeoffs). Share freely.

---

## Core Concepts

### The Vertical Slice

Think of your app as a layered cake:

```
┌─────────────────────────────────────────────┐
│            POLISH (juice, sounds)           │  ← Top layer
├─────────────────────────────────────────────┤
│            UI (HUD, menus, feedback)        │
├─────────────────────────────────────────────┤
│        GAME LOGIC (rules, scoring)          │
├─────────────────────────────────────────────┤
│       RENDERING (graphics, animation)       │
├─────────────────────────────────────────────┤
│      CORE SYSTEMS (input, state, physics)   │  ← Bottom layer
└─────────────────────────────────────────────┘
```

**Horizontal approach** = Build one entire layer, then the next.
Like eating all the frosting before touching the cake.

```
┌─────────────────────────────────────────────┐
│                                             │
├─────────────────────────────────────────────┤
│                                             │
├─────────────────────────────────────────────┤
│                                             │
├─────────────────────────────────────────────┤
│                                             │
├─────────────────────────────────────────────┤
│ ██████████ BUILD ALL CORE SYSTEMS █████████ │  ← Entire layer first
└─────────────────────────────────────────────┘
```

**Vertical slice** = Build ONE feature through ALL layers.
Like cutting a slice of cake — you get every layer in one piece.

```
┌──────────────────┬──┬──────────────────────┐
│                  │██│                      │
├──────────────────┤██├──────────────────────┤
│                  │██│                      │
├──────────────────┤██├──────────────────────┤
│                  │██│  ← One feature       │
├──────────────────┤██├──────────────────────┤
│                  │██│    through ALL       │
├──────────────────┤██├──────────────────────┤
│                  │██│    layers            │
└──────────────────┴──┴──────────────────────┘
                    ↑
              VERTICAL SLICE
```

**Why vertical slices matter:**
- You can **play/test** after each slice (not waiting until everything's built)
- You find **integration bugs early** (before you've built 20 systems that don't talk)
- You can **cut scope** cleanly (complete features, not half-built systems)
- You validate **"is this fun?"** early, not after months of work

**When to use which:**

| Approach | Best For | Risk |
|----------|----------|------|
| **Vertical** | New mechanics, uncertain designs, prototypes | More integration work per feature |
| **Horizontal** | Known patterns, batching similar work | If design is wrong, lots of rework |
| **Hybrid** | Most real projects — vertical for milestones, horizontal within them | Requires judgment |

---

### What Are Tests?

Tests are **automated checklists**. Instead of manually checking "does the piece fall? does rotation work? does scoring calculate right?" — tests check 150 things in 2 seconds.

**Why they matter:**
- AI (and humans) sometimes break things while fixing other things
- Tests catch these instantly, before you waste time testing manually
- They're your safety net

**When they run:**
- Claude runs them automatically after any code change
- You can run them manually with `<test>`
- Pre-commit hook runs them before any commit

**Your mental model:** Tests answer "did anything break?" in 2 seconds.

---

### Git Branches (Simplified)

You don't need to think about branches much. Here's the simple version:

| Branch | What It Is |
|--------|------------|
| `master` | The deployed version. Always works. What friends see. |
| `feature/*` | Your working copy. Safe to mess up. |

**The workflow:**
1. Work on feature branch
2. Test it
3. When ready to deploy → merge to master → deploy

**"Deploy mid-feature" is fine:** You can merge and deploy even if the feature isn't complete. Master = "latest deployed version," which might be work-in-progress. Your feature branch continues for more work.

---

## The Daily Flow

```
┌──────────────────────────────────────────────────────────────┐
│                      START SESSION                           │
│                                                              │
│                     /gsd:progress                            │
│              "Where am I? What should I do?"                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         ▼                                     ▼
   ┌───────────┐                        ┌───────────┐
   │  Need to  │                        │  Ready to │
   │   plan    │                        │   code    │
   └─────┬─────┘                        └─────┬─────┘
         │                                    │
         ▼                                    ▼
  /gsd:plan-phase                      /gsd:execute-plan
         │                              (or just ask Claude)
         │                                    │
         └──────────────────┬─────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                      CODING LOOP                             │
│                                                              │
│    ┌─────────────────────────────────────────────────────┐   │
│    │                                                     │   │
│    │   Claude writes code                                │   │
│    │          │                                          │   │
│    │          ▼                                          │   │
│    │      <test>  ◄── Claude runs this AUTOMATICALLY     │   │
│    │          │                                          │   │
│    │    ┌─────┴─────┐                                    │   │
│    │    ▼           ▼                                    │   │
│    │ [Failed]    [Passed]                                │   │
│    │    │           │                                    │   │
│    │ Claude        ▼                                     │   │
│    │ fixes      <npm>  "Start local server"              │   │
│    │    │           │                                    │   │
│    │    └───► ◄─────┘                                    │   │
│    │                                                     │   │
│    │          ▼                                          │   │
│    │   Manual testing (you play the game)                │   │
│    │          │                                          │   │
│    │    ┌─────┴─────┐                                    │   │
│    │    ▼           ▼                                    │   │
│    │ [Issues]    [Good!]                                 │   │
│    │    │           │                                    │   │
│    │ Tell Claude    │                                    │   │
│    │    │           │                                    │   │
│    │    └───────────┘                                    │   │
│    │                                                     │   │
│    └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                      SAVE POINT                              │
│                                                              │
│                        <save>                                │
│            "Lock in progress, update all docs"               │
│                                                              │
│   • Runs tests                                               │
│   • Updates STATE.md with session summary                    │
│   • Updates other docs if needed                             │
│   • Commits and pushes                                       │
│   • "Saved. Ready to /clear or keep working."                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         ▼                                     ▼
   ┌───────────┐                        ┌───────────┐
   │   Keep    │                        │  Share    │
   │  working  │                        │  with     │
   │           │                        │  friends  │
   └─────┬─────┘                        └─────┬─────┘
         │                                    │
         │                                    ▼
         │                              ┌───────────┐
         │                              │ <deploy>  │
         │                              │           │
         │                              │ Merge to  │
         │                              │ master +  │
         │                              │ deploy    │
         │                              └─────┬─────┘
         │                                    │
         └──────────────────┬─────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                      END SESSION                             │
│                                                              │
│                        /clear                                │
│                                                              │
│          Everything saved in STATE.md from <save>            │
│          Next session: /gsd:progress picks up where          │
│          you left off                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Command Reference

### Your Commands

| Command | When | What It Does |
|---------|------|--------------|
| `<commands>` | Forgot something | Show this command list |
| `<flow>` | Need orientation | Show the daily workflow diagram |
| `<npm>` | Ready to test locally | Start dev server (or confirm running) |
| `<test>` | Want to run tests manually | Run automated checks (2 seconds) |
| `<save>` | Happy with current state | Full save: docs + commit + push |
| `<deploy>` | Ready for friends to test | Merge + build + deploy to GitHub Pages |

### GSD Commands

Use at **transition points** — not constantly, but when you need direction.

| Command | When | What It Does |
|---------|------|--------------|
| `/gsd:progress` | **Start of session**, between tasks | Check status, route to next action |
| `/gsd:plan-phase` | Ready to build something | Create detailed execution plan |
| `/gsd:execute-plan` | Plan approved | Claude codes the plan |
| `/gsd:verify-work` | Code complete | Guided UAT testing |
| `/gsd:plan-fix` | UAT found issues | Plan fixes |
| `/gsd:complete-milestone` | All phases done | Archive + prep next |
| `/gsd:new-milestone` | New major version | Define phases |

**Less common:** `/gsd:discuss-phase`, `/gsd:research-phase`, `/gsd:pause-work`, `/gsd:resume-work`

---

## Quality Gates

### Before Saying "Ready to Test"
Claude must:
- [ ] Run tests automatically
- [ ] Fix any failures
- [ ] Report build number for verification

### Before `<save>`
- [ ] Tests pass
- [ ] Feature works as intended
- [ ] No obvious bugs in manual testing

### Before `<deploy>`
- [ ] Tests pass
- [ ] Tested on mobile (if UI changes)
- [ ] Ready for friends to see current state

---

## Context Window Management

**The problem:** Claude can't see token count. User sees it late. Compaction loses information.

**The solution:** Save early, save often.

- `<save>` does a FULL save (all docs updated)
- If user mentions low context → save immediately
- STATE.md captures everything needed to resume
- After `<save>`, safe to `/clear`

**Good save points:**
- After completing a feature/fix
- Before starting something risky
- When told context is getting low
- End of a working session

---

## File Reference

| File | Purpose | Update When |
|------|---------|-------------|
| `.planning/STATE.md` | Session continuity | Every `<save>` |
| `.planning/PROJECT.md` | Requirements, decisions | Requirements change |
| `.planning/ROADMAP.md` | Milestones, phases | Phase/milestone status changes |
| `.planning/SOP.md` | This file — workflow reference | Process changes |
| `CLAUDE.md` | Project-specific context | Patterns/systems change |
| `.planning/PRD.md` | Full game requirements | Game design changes |

---

## For New Projects

1. Copy `.planning/` structure to new project
2. Run `/gsd:new-project` to initialize
3. Update `CLAUDE.md` with project-specific context
4. Update `.planning/PRD.md` with your requirements
5. Start with `/gsd:progress`

---

*This SOP is designed to be project-agnostic and shareable.*
