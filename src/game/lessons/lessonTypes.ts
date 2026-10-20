// THE LESSON FORMAT (F30) — what a content/lessons/<id>.json file holds. Knows nothing about Goops: the game reads
// `setup`, `pointer` and the gate / event names (src/game/lessons/goopsLessons.ts says which ones Goops has).
// Times are in SECONDS (easier to read and tune than ms). Built in Goops first; kept game-agnostic so a framework
// session can lift lessonTypes + patterns + runner into a module later.

// When a step moves on (its `advance`), when a hint or retry fires, when an interrupt fires.
export type Condition =
  | { on: 'dismiss' } // the player closes the message ("Got it" / Enter)
  // something happened in the game (a lock, a pop, a crack…). `where` filters on the event's details: each key must
  // equal the detail — or, when the detail is a list and the value a number, the list must have at least that many
  // (e.g. { "on": "event", "event": "pop", "where": { "sealed": 1 } } = a pop that sealed at least one crack)
  // F31 `if`: …and only counts while this gate holds at that moment (e.g. a piece landed AND the crack isn't plugged = a miss)
  | { on: 'event'; event: string; count?: number; where?: Record<string, unknown>; if?: Condition }
  | { on: 'action'; action: string; count?: number; if?: Condition } // the player tried a control (spin, rotate, softDrop, pop, hold…)
  | { on: 'gate'; gate: string; atLeast?: number; atMost?: number } // a number the game reports reached a value
  | { on: 'time'; after: number } // seconds after the step started
  | { on: 'any'; of: Condition[] } // whichever of these comes first (F32)

// How the game runs while a message shows: 'pause' = stopped (and no input) until dismissed, 'slow' = slowed
// (content/tuning/lessons.json slowSpeed), 'run' = as normal.
export type WhileShowing = 'pause' | 'slow' | 'run'

export interface LessonHint {
  after: number // seconds after the step started — or after `from` (doing the thing first means it never shows)
  // F31: when the wait starts, instead of the step's start (once: the first time it happens) — e.g. "3 s after the goop
  // is ready" = { "on": "gate", "gate": "ready:blue", "atLeast": 1 }
  from?: Condition
  // F31: doing this means they've got it: no hint for the rest of the step (one that's up goes, the step's message
  // comes back) — e.g. "3 s without fast-dropping" = unless { "on": "action", "action": "softDrop" }
  unless?: Condition
  // F31: each time this happens the wait starts over (one that's up goes) — e.g. "20 s without a seal". An event or an
  // action (a gate would keep starting it over while it holds).
  again?: Condition
  message: string // a text id (or the words themselves)
  pointer?: unknown
  while?: WhileShowing // default 'run'
}

export interface LessonRetry {
  when: Condition // e.g. the piece landed in the wrong place
  setup?: Record<string, unknown> // what the game does before the next try (old set-up stays: it piles up)
  message?: string // shown on each retry; {tries} = how many so far
  max?: number // after this many retries the step just moves on (never stuck); default: no limit
}

export interface LessonStep {
  id: string
  pattern?: string // a named building block (patterns.ts) that fills in the fields this step leaves out
  setup?: Record<string, unknown> // for the game: pieces, goop, cracks, pressure, which controls work…
  message?: string // a text id (or the words themselves); the game fills {placeholders} from its live state
  // for the game's look: what the message points at. A step with a pointer and NO message only points (F32: "pull the
  // periscope" — the screen already says it, so only the spotlight shows)
  pointer?: unknown
  dim?: boolean // darken everything but what it points at
  while?: WhileShowing // default 'run'
  showAfter?: number // seconds before the message shows (the game runs meanwhile); default 0
  advance?: Condition // default: dismiss
  hint?: LessonHint
  retry?: LessonRetry
  // already done (a gate that's already true when the step starts) → straight on to the next. A list = any of them.
  skipIf?: Condition | Condition[]
  reactions?: LessonReaction[]
  insist?: LessonInsist
  checkpoint?: boolean // leaving mid-lesson restarts here (the start of a phase)
  // F31: make sure an interrupt happens — if the lesson's interrupt `interrupt` hasn't fired by this step (nor been
  // seen on this device), this set-up runs too, after the step's own (day one's F1: the first crack goes just out of
  // view, so "cracks out of view" is taught before the day ends)
  ensure?: { interrupt: string; setup: Record<string, unknown> }
}

// "If something else happens" during a step (F32): say this instead of the step's message — no "Got it", the game
// keeps going as it was — until `until` happens (or the step ends); then the step's own message comes back.
// e.g. the player opens the pause menu while told to go to the console: "That's the pause menu…"
export interface LessonReaction {
  when: Condition
  message: string
  pointer?: unknown
  until?: Condition
}

// "Still not done?" (F32, Muzzy: ONE message that gets more assertive): when `when` happens, the step's SAME message
// stays up, but the game stops (`while`, default 'pause'), the dim comes on (`dim`, default true) and only the controls
// named in `only` work (e.g. ["console"]: the one thing the step asks for). No "Got it": doing the thing moves on.
export interface LessonInsist {
  when: Condition
  while?: WhileShowing
  dim?: boolean
  only?: string[]
}

// A message that can break into ANY step once (v1's discovery, e.g. "a crack went out of view"): it pauses the step
// where it is, and the step carries on exactly there when it's dismissed. remember = once on this device, ever.
export interface LessonInterrupt {
  id: string
  when: Condition
  message: string
  pointer?: unknown
  while?: WhileShowing // default 'pause'
  remember?: boolean
  // F31: only during these steps (step ids, both included; left out = from the first / to the last) — day one's D4 is
  // armed from D2 to the end; E1's red X only during E1. Outside them it waits (an event can still fire it later).
  from?: string
  to?: string
}

export interface Lesson {
  id: string
  start?: Record<string, unknown> // set-up done whenever the lesson starts (at any step)
  finish?: Record<string, unknown> // set-up done when the last step is done (e.g. back to normal play)
  steps: LessonStep[]
  interrupts?: LessonInterrupt[]
}

// Timings shared by every lesson (content/tuning/lessons.json — live in the Dev Kit's Tuning tab).
export interface LessonTiming {
  dismissArmSeconds: number // a paused message can't be closed for this long (no closing it by accident)
  betweenStepsSeconds: number // a breath between one step's end and the next step's start
  slowSpeed: number // the game's speed under a 'slow' message
  gatePollMs: number // how often gates are checked
}
