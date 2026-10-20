// THE LESSON RUNNER (F30) — plays a lesson (lessonTypes.ts) one step at a time. Game-agnostic: everything it does to
// the game goes through a LessonGame (the game's adapter — Goops: goopsLessons.ts), and its timers run on the clock
// it's given (the game's RULES clock: the Dev Kit's ⏸ / ◐ pauses stop them, and so does the game's own pause menu).
//
// Each step goes through (v1 Tutorial v3 §4):
//   entering  — the game does the step's set-up; the step starts watching for its `advance`, `retry` and hint
//   waiting   — the game runs; the message shows after `showAfter` seconds (0 = at once)
//   showing   — the message is up; the game is paused / slowed / running (`while`); a message that waits to be
//               closed can be closed after dismissArmSeconds (no closing it by accident)
//   advancing — a short breath (betweenStepsSeconds), then the next step; after the last, the lesson's `finish`
// Pausing is part of the message being up (`while`), never a scattered call. The game itself is stopped by
// game.setSpeed(0) — not by stopping the rules clock — so the lesson's own timers keep their own time.
// All of a step's timers live in one pool that's emptied when the step ends: nothing from an old step can fire late.
import type { Condition, Lesson, LessonStep, LessonTiming, WhileShowing } from './lessonTypes'
import { expandStep } from './patterns'

// What the runner needs from the game.
export interface LessonGame {
  setup(setup: Record<string, unknown>): void // put the game in a step's starting state
  gate(name: string): number | null // a number a step can wait on (null = can't tell right now)
  // how fast the game runs (0 = stopped) and whether it takes input; only = while stopped, just these controls still
  // work (a step's insist, F32: e.g. ["console"])
  setSpeed(speed: number, inputOn: boolean, only?: string[]): void
  seen?(id: string): boolean // remembered on this device (an interrupt with remember: true)
  markSeen?(id: string): void
  finished?(lessonId: string): void // the last step of a lesson is done
}

// The clock: rules time (src/devkit/gameClock.ts rulesClock has exactly these).
export interface LessonClock {
  after(ms: number, fn: () => void): () => void
  every(ms: number, fn: () => void): () => void
}

// What the look shows. `text` is the step's message id (or words) — the game turns it into words.
export interface LessonMessage {
  kind: 'step' | 'hint' | 'retry' | 'interrupt' | 'reaction'
  text: string
  pointer?: unknown
  dim: boolean
  waitsForDismiss: boolean // it has a "Got it" (and Enter closes it)
  armed: boolean // …which works now
  tries: number // retries so far in this step ({tries} in the words)
  insisting?: boolean // F32: the step's insist has come (the same words, now with the game stopped and the dim on)
  only?: string[] // F32: the only controls that work while it shows (an insist)
}

export interface LessonView {
  lessonId: string | null // null = no lesson running
  stepIndex: number
  stepId: string | null
  total: number // steps in the lesson
  message: LessonMessage | null
  done: boolean // the last lesson finished
}

type Watcher = { cond: Condition; fire: () => void; n: number; scope: 'step' | 'lesson' }

// A pool of named rules-clock timers: setting a name again replaces it; clear() cancels them all.
function timerPool(clock: LessonClock) {
  const timers = new Map<string, () => void>()
  const clear = (name: string) => { timers.get(name)?.(); timers.delete(name) }
  return {
    after(name: string, ms: number, fn: () => void) { clear(name); timers.set(name, clock.after(ms, () => { timers.delete(name); fn() })) },
    every(name: string, ms: number, fn: () => void) { clear(name); timers.set(name, clock.every(ms, fn)) },
    clear,
    clearAll() { for (const stop of timers.values()) stop(); timers.clear() },
  }
}

// Does closing the message ("Got it") move this step on? (dismiss, or an 'any' that includes it)
const closedByDismiss = (c: Condition): boolean => c.on === 'dismiss' || (c.on === 'any' && c.of.some(closedByDismiss))

const IDLE: LessonView ={ lessonId: null, stepIndex: -1, stepId: null, total: 0, message: null, done: false }

export function createLessonRunner(o: { game: LessonGame; clock: LessonClock; timing: () => LessonTiming; patterns?: Record<string, Partial<LessonStep>> }) {
  const { game, clock, timing } = o
  const stepTimers = timerPool(clock) // emptied at every step change
  const lessonTimers = timerPool(clock) // the interrupts' gates: live across steps
  let watchers: Watcher[] = []
  let getLesson: (() => Lesson) | null = null
  const queued: (() => Lesson)[] = []
  let index = -1
  let step: LessonStep | null = null
  let advancing = false
  let insisted: LessonStep | null = null // the step whose insist has come (F32)
  let tries = 0
  let firedInterrupts = new Set<string>()
  let interrupt: { saved: { message: LessonMessage; while: WhileShowing } | null } | null = null // an interrupt is up
  let showingWhile: WhileShowing = 'run'
  let reacting: { saved: LessonMessage | null } | null = null // a step's reaction is up (the step's message kept)
  let view: LessonView = IDLE
  const listeners = new Set<() => void>()

  const publish = (change: Partial<LessonView>) => {
    view = { ...view, ...change }
    for (const l of listeners) l()
  }
  const speedFor = (w: WhileShowing, only?: string[]) => {
    if (w === 'pause') game.setSpeed(0, false, only)
    else game.setSpeed(w === 'slow' ? timing().slowSpeed : 1, true)
  }

  // Put a message up (or, while an interrupt is up, keep it for when the interrupt is closed).
  function show(message: LessonMessage, w: WhileShowing) {
    if (interrupt && message.kind !== 'interrupt') { interrupt.saved = { message, while: w }; return }
    reacting = null // (a new message ends a reaction)
    showingWhile = w
    speedFor(w, message.only)
    publish({ message })
    if (message.waitsForDismiss) {
      // (an interrupt's timer lives across steps: the step may move on under it)
      const timers = message.kind === 'interrupt' ? lessonTimers : stepTimers
      timers.after(`arm:${message.kind}`, timing().dismissArmSeconds * 1000, () => {
        if (view.message === message) publish({ message: { ...message, armed: true } })
      })
    }
  }
  function hide() {
    if (interrupt) { interrupt.saved = null; return }
    showingWhile = 'run'
    speedFor('run')
    publish({ message: null })
  }

  // ---- conditions
  function holds(cond: Condition): boolean {
    if (cond.on === 'any') return cond.of.some(holds)
    if (cond.on !== 'gate') return false
    const value = game.gate(cond.gate)
    if (value === null) return false
    return (cond.atLeast === undefined || value >= cond.atLeast) && (cond.atMost === undefined || value <= cond.atMost)
  }
  function watch(cond: Condition, fire: () => void, scope: 'step' | 'lesson', name: string) {
    const timers = scope === 'step' ? stepTimers : lessonTimers
    if (cond.on === 'any') cond.of.forEach((c, k) => watch(c, fire, scope, `${name}:${k}`))
    else if (cond.on === 'event' || cond.on === 'action') watchers.push({ cond, fire, n: 0, scope })
    else if (cond.on === 'gate') timers.every(name, Math.max(16, timing().gatePollMs), () => { if (holds(cond)) fire() })
    else if (cond.on === 'time') timers.after(name, cond.after * 1000, fire)
    // ('dismiss' is the message's own "Got it")
  }
  function matches(where: Record<string, unknown> | undefined, data: Record<string, unknown> | undefined) {
    if (!where) return true
    return Object.entries(where).every(([k, want]) => {
      const got = data?.[k]
      if (Array.isArray(got) && typeof want === 'number') return got.length >= want
      return got === want
    })
  }
  function heard(kind: 'event' | 'action', name: string, data?: Record<string, unknown>) {
    for (const w of [...watchers]) {
      if (!watchers.includes(w)) continue // an earlier watcher moved the lesson on: this one belongs to the old step
      const c = w.cond
      if (c.on !== kind) continue
      if ((c.on === 'event' ? c.event : c.on === 'action' ? c.action : '') !== name) continue
      if (c.on === 'event' && !matches(c.where, data)) continue
      if (c.if && !holds(c.if)) continue // (F31: only while this gate holds, e.g. a landing that missed the crack)
      w.n++
      if (w.n >= ((c.on === 'event' || c.on === 'action') && c.count ? c.count : 1)) { w.n = 0; w.fire() }
    }
  }

  // ---- steps
  function clearStep() {
    reacting = null
    hintFor = null
    hintOff = false
    hintCovered = null
    stepTimers.clearAll()
    watchers = watchers.filter((w) => w.scope === 'lesson')
  }

  // ---- the step's hint (wait-then-hint): `after` seconds from the step's start — or from `from` (F31) — unless
  // `unless` happens first (F31); `again` starts the wait over (F31). A hint that goes away gives back what it covered.
  let hintFor: LessonStep | null = null // the step whose hint is running (started once per step)
  let hintOff = false // the step's `unless` happened: no hint for the rest of the step
  let hintCovered: { message: LessonMessage; while: WhileShowing } | null = null // the message the hint is shown over
  function startHint() {
    const h = step?.hint
    if (!h || !step || hintFor === step) return
    const at = step
    hintFor = at
    let started = !h.from
    const wait = () => stepTimers.after('hint', h.after * 1000, () => {
      if (step !== at || advancing || hintOff) return
      if (view.message && view.message.kind !== 'hint') hintCovered = { message: view.message, while: showingWhile }
      show({ kind: 'hint', text: h.message, pointer: h.pointer ?? step?.pointer, dim: false, waitsForDismiss: false, armed: false, tries }, h.while ?? 'run')
    })
    if (h.from) {
      watch(h.from, () => {
        if (started) return
        started = true
        stepTimers.clear('hint:from') // (a gate: stop asking)
        wait()
      }, 'step', 'hint:from')
    } else wait()
    if (h.unless) watch(h.unless, () => { hintOff = true; takeHintDown() }, 'step', 'hint:unless')
    if (h.again) watch(h.again, () => { if (hintOff || !started) return; takeHintDown(); wait() }, 'step', 'hint:again')
  }
  function takeHintDown() {
    stepTimers.clear('hint')
    if (view.message?.kind !== 'hint') return
    const covered = hintCovered
    hintCovered = null
    if (covered) show(covered.message, covered.while)
    else hide()
  }

  function enter(i: number) {
    const lesson = getLesson?.()
    if (!lesson) return
    clearStep()
    advancing = false
    if (i >= lesson.steps.length) return finish(lesson)
    index = i
    step = expandStep(lesson.steps[i], o.patterns)
    tries = 0
    insisted = null
    const s = step
    publish({ stepIndex: i, stepId: s.id, total: lesson.steps.length })
    if (s.setup) game.setup(s.setup)
    // F31: an interrupt this step makes sure of (it hasn't fired yet: this set-up makes it happen)
    if (s.ensure && !interruptDone(s.ensure.interrupt)) game.setup(s.ensure.setup)
    hide()
    const skips = s.skipIf ? (Array.isArray(s.skipIf) ? s.skipIf : [s.skipIf]) : []
    if (skips.some(holds)) return advance() // the player is already past this one
    const advanceOn = s.advance ?? { on: 'dismiss' }
    watch(advanceOn, advance, 'step', 'advance')
    if (s.retry) watch(s.retry.when, retry, 'step', 'retry')
    s.reactions?.forEach((r, k) => {
      watch(r.when, () => react(r), 'step', `react:${k}`)
      if (r.until) watch(r.until, unreact, 'step', `unreact:${k}`)
    })
    const w = s.while ?? 'run'
    // a paused message: the hint clock starts once it's closed (doing nothing while reading isn't "stuck")
    if (!(s.message && w === 'pause')) startHint()
    // (no message but a pointer: it only points — the spotlight, no words, nothing to close)
    if (s.message || s.pointer !== undefined) {
      const message: LessonMessage = { kind: 'step', text: s.message ?? '', pointer: s.pointer, dim: !!s.dim,
        waitsForDismiss: !!s.message && (closedByDismiss(advanceOn) || w === 'pause'), armed: false, tries }
      if (!s.showAfter) show(message, w)
      else stepTimers.after('show', s.showAfter * 1000, () => show(message, w))
    }
    if (s.insist) watch(s.insist.when, insist, 'step', 'insist')
  }

  // the step's insist (F32): its own message again, now with the game stopped, the dim on and only `only` working
  function insist() {
    const it = step?.insist
    if (!it || advancing || !step || insisted === step) return // (once per step: a gate keeps holding)
    insisted = step
    stepTimers.clear('hint') // (one message: no hint on top of it)
    stepTimers.clear('show') // (nor a late showAfter replacing the insisting message)
    show({ kind: 'step', text: step.message ?? '', pointer: step.pointer, dim: it.dim ?? true, waitsForDismiss: false, armed: false,
      tries, insisting: true, only: it.only }, it.while ?? 'pause')
  }

  function advance() {
    if (advancing || !step) return
    advancing = true
    clearStep()
    hide()
    const next = index + 1
    // (a breath between steps — none after the last: the lesson is over at once)
    const breath = next < (getLesson?.().steps.length ?? 0) ? timing().betweenStepsSeconds * 1000 : 0
    if (breath > 0) stepTimers.after('next', breath, () => enter(next))
    else enter(next)
  }

  function retry() {
    const r = step?.retry
    if (!r || advancing) return
    tries++
    if (r.max !== undefined && tries > r.max) return advance() // never stuck: after enough tries it moves on
    if (r.setup) game.setup(r.setup)
    if (r.message) show({ kind: 'retry', text: r.message, pointer: step?.pointer, dim: false, waitsForDismiss: true, armed: false, tries }, 'pause')
  }

  // a step's reaction (lessonTypes LessonReaction): its words over the step's message until `until`; the game's
  // speed stays as it was (no "Got it")
  function react(r: NonNullable<LessonStep['reactions']>[number]) {
    if (advancing || interrupt) return
    if (!reacting) reacting = { saved: view.message?.kind === 'reaction' ? null : view.message }
    publish({ message: { kind: 'reaction', text: r.message, pointer: r.pointer, dim: false, waitsForDismiss: false, armed: false, tries } })
  }
  function unreact() {
    if (!reacting) return
    const saved = reacting.saved
    reacting = null
    if (view.message?.kind !== 'reaction') return
    if (saved) show(saved, showingWhile) // (shown again: re-armed, if it waits for "Got it")
    else publish({ message: null })
  }

  function finish(lesson: Lesson) {
    lessonTimers.clearAll()
    watchers = []
    step = null
    if (lesson.finish) game.setup(lesson.finish)
    speedFor('run')
    game.finished?.(lesson.id)
    const next = queued.shift()
    if (next) return begin(next, 0)
    getLesson = null // (nothing running: the next queue() starts at once)
    index = -1
    publish({ ...IDLE, done: true })
  }

  // ---- interrupts (v1's discovery: once, across steps, resuming the step exactly where it was)
  const interruptDone = (id: string) => firedInterrupts.has(id) || !!game.seen?.(`interrupt:${id}`)
  // F31: is the lesson at a step the interrupt is armed for? (its from / to step ids; an unknown id = no limit)
  function armedNow(lesson: Lesson, it: NonNullable<Lesson['interrupts']>[number]) {
    const at = (id: string | undefined) => (id === undefined ? -1 : lesson.steps.findIndex((x) => x.id === id))
    const from = at(it.from), to = at(it.to)
    return (from < 0 || index >= from) && (to < 0 || index <= to)
  }
  function fireInterrupt(id: string) {
    const lesson = getLesson?.()
    const it = lesson?.interrupts?.find((x) => x.id === id)
    if (!lesson || !it || firedInterrupts.has(id) || interrupt || !armedNow(lesson, it)) return
    firedInterrupts.add(id)
    if (it.remember) game.markSeen?.(`interrupt:${id}`)
    interrupt = { saved: view.message ? { message: view.message, while: showingWhile } : null }
    show({ kind: 'interrupt', text: it.message, pointer: it.pointer, dim: false, waitsForDismiss: true, armed: false, tries }, it.while ?? 'pause')
  }

  function begin(get: () => Lesson, at: number) {
    stop(false)
    getLesson = get
    const lesson = get()
    firedInterrupts = new Set()
    publish({ lessonId: lesson.id, done: false, message: null })
    if (lesson.start) game.setup(lesson.start)
    for (const it of lesson.interrupts ?? []) {
      if (it.remember && game.seen?.(`interrupt:${it.id}`)) continue
      watch(it.when, () => fireInterrupt(it.id), 'lesson', `interrupt:${it.id}`)
    }
    enter(Math.max(0, Math.min(at, lesson.steps.length - 1)))
  }

  function stop(publishIdle = true) {
    clearStep()
    lessonTimers.clearAll()
    watchers = []
    getLesson = null
    step = null
    index = -1
    interrupt = null
    advancing = false
    if (publishIdle) { speedFor('run'); publish(IDLE) }
  }

  return {
    /** Start a lesson at a step (0 = the start). getLesson is asked again at every step, so live edits apply. */
    start: (get: () => Lesson, at = 0) => { queued.length = 0; begin(get, at) },
    /** Play this lesson after the one running (or now, if none is). */
    queue(get: () => Lesson) { if (getLesson) queued.push(get); else begin(get, 0) },
    stop: () => { queued.length = 0; stop() },
    /** The player closed the message ("Got it" / Enter). Ignored until it's armed. */
    dismiss() {
      const m = view.message
      if (!m || !m.waitsForDismiss || !m.armed) return
      if (m.kind === 'interrupt') {
        const saved = interrupt?.saved ?? null
        interrupt = null
        if (saved) show(saved.message, saved.while)
        else hide()
        return
      }
      if (m.kind === 'step' && closedByDismiss(step?.advance ?? { on: 'dismiss' })) return advance()
      hide() // a paused message read: the game goes on, and the step waits for its own thing
      if (m.kind === 'step') startHint()
    },
    /** Something happened in the game (an engine event, a screen event). */
    event: (name: string, data?: Record<string, unknown>) => heard('event', name, data),
    /** The player tried a control. */
    action: (name: string) => heard('action', name),
    /** The step the runner restarts from after leaving mid-lesson: the last checkpoint at or before `at`. */
    restartPoint(lesson: Lesson, at: number) {
      for (let i = Math.min(at, lesson.steps.length - 1); i > 0; i--) if (lesson.steps[i].checkpoint) return i
      return 0
    },
    view: () => view,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
  }
}

export type LessonRunner = ReturnType<typeof createLessonRunner>
