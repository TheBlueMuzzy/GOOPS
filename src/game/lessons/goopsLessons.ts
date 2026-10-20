// THE GOOPS SIDE OF LESSONS (F30) — the thin adapter between the game-agnostic runner (runner.ts) and Goops:
// it turns a step's `setup` into engine.train commands, answers the runner's gates, hears the engine's events and the
// player's controls, and holds the speed / input switches ShiftStage reads every frame. App starts and stops lessons.
//
// What a Goops lesson step can use (content/lessons/*.json):
//   setup   (done in this order)
//     "clear": true                        empty the tank and drop the falling piece
//     "play": "normal"                     every rule back to a normal shift (free play) — before "rules", so a step can
//                                          say "normal play with these safety rails" (F31)
//     "rules": { … }                       src/engine/training.ts TrainingRules: pressureRise, cracks, integrity, breakdowns,
//                                          falling, autoSpawn, allow (["spin","rotate","softDrop","pop","hold"]), zone,
//                                          pressureCap, integrityFloor, rupture, overflowRail, ruptureDrainSpeed,
//                                          zapColors (colour names)
//     "pressure": 40                       set the pressure, in percent
//     "goop": [[col, row, colour], …]      goop placed (already full); col = from the middle of the view, row = from the floor
//     "cracks": [[col, row, colour], …]    cracks placed · "removeCracks": [[col, row], …] · F31: col "inView" / "outOfView"
//                                          = the first free cell on that row, from the middle out / just past the view's edge
//     "pieces": [{ "shape": "T_I", "color": "blue", "turns": 1 }, …]   the next pieces, in order
//     "then": { "pieces": [ … ], "buildUp": { "cell": [col, row], "piece": { … } } }   F31: when "pieces" run out, these
//                                          come round and round (not random ones); buildUp's piece comes first while the
//                                          stack under that cell is too low for the due piece to reach it
//     "spawn": true                        bring the next piece in now
//     "console": "frozen" / "normal"       F32: at the console mid-shift the tank stands still (a first repair) / runs at
//                                          content/tuning/breakdowns.json consoleTimeScale as usual (also back to normal
//                                          whenever a lesson ends)
//   gates   the tank's own (goopsGates.ts): "position", "pressure", "integrity", "sealed", "cracksOutOfView", "wrongCover",
//           F31: "plugged", "openCracks", "ready:<colour>", "full:<colour>", "underLine:<colour>" ·
//           F32: "atConsole" (1 = the console is over the tank mid-shift) · "broken:<machine>" (1 = broken) ·
//           "breakdownLessonsSeen" (how many first-breakdown lessons this device has finished)
//   events  every engine event by its type (lock, pop, plug, crack, ready, merge, quotaMet, rupture, breakdown, repaired,
//           F31: overflowRail…),
//           with its details for `where` (e.g. pop → sealed, repaired → machine); plus the screen events "shiftStarted",
//           "consoleOpened" (W / ↑ / flick up, mid-shift), "consoleClosed" (back in the tank), "pauseOpened", "pauseClosed",
//           F59: "upgradesOpened" (the console's Upgrades button, between shifts)
//   actions spin, rotate, softDrop, hold, pop, repair, console
//   pointer { "piece": true } · { "cell": [col, row] } (follows the tank as it spins) · F31: { "crack": "open" | "plugged" |
//           "wrongCover" | "outOfView" | "any" } (the nearest; out of view = its arrow on the edge) · { "goop": "blue" }
//           (the biggest blue group) · "bar-integrity" tag · { "tag": "readout" } (an element
//           with that data-tag; F32 tags: "bar-<machine>" the HUD's machine bar, "repair-<machine>" the part of its
//           repair panel that wants doing next, "panel-<machine>", "periscope", "monitor", "pauseResume") ·
//           { "selector": "…" } · none = where pieces drop in. The message goes on the side the target's data-placement
//           says, else the pointer's "placement" ("top" / "bottom" / "left" / "right"), else wherever it fits.
//           "or": { another pointer } = where to point when this one isn't on screen (LessonView).
//   words   a text id in content/text/en.json → lessons.<lesson id>; a { keys, mouse, phone } entry picks by the input used
//           last; {left} {total} {sealed} {pressure} {integrity} {tries} {consoleSpeed} are filled from the live shift
import type { MachineId, PieceChoice, ShiftAction, ShiftEngine, ShiftState, TrainingRules } from '../../engine'
import { colourOf, pointerCells, tankGate } from './goopsGates'
import { liveTuning } from '../../devkit/tuning/liveTuning'
import { rulesClock } from '../../devkit/gameClock'
import { fill, tipsMemory } from '../../ui/kit'
import { cellToScreen, tankRect } from '../../view/geometry'
import { flatPoint } from '../../view/visorFx'
import type { GooView } from '../../goo/types'
import { session } from '../session'
import { createLessonRunner } from './runner'
import type { Lesson } from './lessonTypes'
import lessonTimingFile from '../../../content/tuning/lessons.json'
import breakdowns from '../../../content/tuning/breakdowns.json'
import text from '../../../content/text/en.json'

// ---- the shared timings and looks (content/tuning/lessons.json), live in the Dev Kit's Tuning tab
const tuning = liveTuning('lessons', lessonTimingFile)
/** content/tuning/lessons.json as it is now (with the Dev Kit's edits). */
export const lessonTuning = () => tuning.current

// ---- the lesson files: content/lessons/<id>.json, each live (the Dev Kit's Lessons tab sends edits as "lesson-<id>")
const files = import.meta.glob<Lesson>('../../../content/lessons/*.json', { eager: true, import: 'default' })
const live = new Map<string, { readonly current: Lesson }>()
for (const lesson of Object.values(files)) live.set(lesson.id, liveTuning(`lesson-${lesson.id}`, lesson))
/** Every lesson as it is now (with the Dev Kit's edits). */
export const lessonIds = () => [...live.keys()]
export const lessonNow = (id: string): Lesson | null => live.get(id)?.current ?? null
/** The path a lesson's file is saved to (the Dev Kit's Lessons tab). */
export const lessonPath = (id: string) => `content/lessons/${id}.json`

// ---- the running shift and the switches ShiftStage reads every frame
let engine: ShiftEngine | null = null
let speed = 1 // × the shift's speed while a lesson message shows (0 = paused)
let inputOn = true
let only: string[] | null = null // F32: while input is off, the controls that still work (a step's insist: ["console"])
let anchorSpin = 0 // the tank's turn when the step was set up: lesson columns count from the middle of the view THEN
let lastInput: 'keys' | 'mouse' | 'phone' = 'keys'
let atConsole = false // F32: the console is over the tank mid-shift (App says so: lessonPlay.screen)
let consoleFrozen = false // F32: a lesson froze the tank while at the console (its first repair)
let training = false // the attached engine is a lesson's training shift (not a real one)

const NORMAL_PLAY: Partial<TrainingRules> = { pressureRise: 1, cracks: true, integrity: true, breakdowns: true, falling: true,
  autoSpawn: true, allow: null, zone: null, pressureCap: 1, integrityFloor: 0, rupture: true, overflowRail: false, ruptureDrainSpeed: 1, zapColors: null }

// a colour by its name in shift.json ("blue") or its number (1 = the first colour)
const colour = colourOf
const wrap = (x: number, w: number) => ((x % w) + w) % w
// lesson [col, row] → tank [x, y]
const toTank = (s: ShiftState, col: number, row: number): [number, number] => [wrap(anchorSpin + col, s.width), s.height - 1 - row]

function warn(what: string, setup: unknown) {
  if (import.meta.env.DEV) console.warn(`Lesson set-up: ${what} didn't work`, setup)
}

function setup(setup: Record<string, unknown>) {
  const e = engine
  if (!e) return
  const s = e.state
  anchorSpin = s.spin
  const train = (what: string, cmd: Parameters<ShiftEngine['train']>[0]) => { if (!e.train(cmd)) warn(what, setup) }
  if (setup.clear) train('clear', { type: 'clear' })
  // (play first, then rules: F31's free play is "normal play, with these safety rails" in one set-up)
  if (setup.play === 'normal') train('play normal', { type: 'rules', rules: NORMAL_PLAY })
  if (setup.rules) {
    const rules = { ...(setup.rules as Record<string, unknown>) }
    if (Array.isArray(rules.zapColors)) rules.zapColors = rules.zapColors.map(colour)
    train('rules', { type: 'rules', rules: rules as Partial<TrainingRules> })
  }
  if (typeof setup.pressure === 'number') train('pressure', { type: 'pressure', value: setup.pressure / 100 })
  if (Array.isArray(setup.goop)) {
    train('goop', { type: 'goop', cells: (setup.goop as unknown[][]).map(([col, row, c]) => [...toTank(s, Number(col), Number(row)), colour(c)] as [number, number, number]) })
  }
  for (const [col, row] of (setup.removeCracks as number[][] | undefined) ?? []) train('removeCracks', { type: 'removeCrack', x: toTank(s, col, row)[0], y: toTank(s, col, row)[1] })
  for (const [col, row, c] of (setup.cracks as unknown[][] | undefined) ?? []) {
    const y = toTank(s, 0, Number(row))[1]
    // F31: "inView" / "outOfView" instead of a column = the engine picks the first free spot on that row
    if (col === 'inView' || col === 'outOfView') train('cracks', { type: 'freeCrack', where: col, y, color: colour(c) })
    else train('cracks', { type: 'crack', x: toTank(s, Number(col), Number(row))[0], y, color: colour(c) })
  }
  if (Array.isArray(setup.pieces) || setup.then) {
    const piece = (p: PieceChoice) => ({ ...p, color: colour(p.color) })
    const then = setup.then as { pieces?: PieceChoice[]; buildUp?: { cell: [number, number]; piece: PieceChoice } } | undefined
    const fallback = then && { pieces: (then.pieces ?? []).map(piece),
      ...(then.buildUp ? { buildUp: { x: toTank(s, ...then.buildUp.cell)[0], y: toTank(s, ...then.buildUp.cell)[1], piece: piece(then.buildUp.piece) } } : {}) }
    train('pieces', { type: 'queue', pieces: ((setup.pieces ?? []) as PieceChoice[]).map(piece), ...(fallback ? { then: fallback } : {}) })
  }
  if (setup.spawn) train('spawn', { type: 'spawn' })
  if (setup.console === 'frozen' || setup.console === 'normal') consoleFrozen = setup.console === 'frozen'
}

// The machines with a first-breakdown lesson (content/lessons/<machine>.json, F32)
export const BREAKDOWN_LESSONS = ['visor', 'laser', 'controls'] as const
/** Has this device finished that lesson? (kit tips memory: 'lesson:<id>', cleared by Settings → Replay lessons) */
export const lessonSeen = (id: string) => tipsMemory().seen(`lesson:${id}`)

function gate(name: string): number | null {
  const s = engine?.state
  if (!s) return null
  const fromTank = tankGate(s, name) // (the tank's own numbers: goopsGates.ts)
  if (fromTank !== null) return fromTank
  switch (name) {
    case 'atConsole': return atConsole ? 1 : 0
    case 'breakdownLessonsSeen': return BREAKDOWN_LESSONS.filter(lessonSeen).length
  }
  if (name.startsWith('broken:')) {
    const m = s.machines?.[name.slice('broken:'.length) as MachineId]
    return m ? (m.broken ? 1 : 0) : null
  }
  // F32: 1 = the machine has been broken long enough (shift time) for the go-to-console message to insist
  // (content/tuning/lessons.json insistSeconds; 4 = the visor's glitch at full strength, visor-fx.json rampMs)
  if (name.startsWith('insist:')) {
    const m = s.machines?.[name.slice('insist:'.length) as MachineId]
    return m ? (m.broken && (m.brokenMs ?? 0) >= tuning.current.insistSeconds * 1000 ? 1 : 0) : null
  }
  return null
}

export const runner = createLessonRunner({
  clock: rulesClock, // the rules clock: the Dev Kit's ⏸ / ◐ and the game's own pause stop the lesson's timers
  timing: () => tuning.current,
  game: {
    setup,
    gate,
    setSpeed: (value, input, controls) => { speed = value; inputOn = input; only = input ? null : controls ?? null },
    seen: (id) => tipsMemory().seen(id),
    markSeen: (id) => tipsMemory().markSeen(id),
    finished: (id) => { consoleFrozen = false; tipsMemory().markSeen(`lesson:${id}`) },
  },
})

// every engine event reaches the runner (with its details, for `where`)
session.listen((events) => { for (const e of events) runner.event(e.type, e as unknown as Record<string, unknown>) })

// the input used last, for { keys, mouse, phone } words
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { lastInput = 'keys' }, true)
  window.addEventListener('pointerdown', (e) => { lastInput = e.pointerType === 'touch' ? 'phone' : 'mouse' }, true)
}

export const lessonPlay = {
  /** × the shift's speed (ShiftStage multiplies the rules clock's rate by it): 0 while a paused message shows, and at
   *  the console while a lesson freezes the tank there (F32). */
  speed: () => (consoleFrozen && atConsole ? 0 : speed),
  /** F32: is the tank frozen at the console for a lesson? (App then runs the rules clock at full speed there, so the
   *  lesson's own timers — hints, "Got it" — keep their time while the tank stands still.) */
  consoleFrozen: () => consoleFrozen && !!runner.view().lessonId,
  /** F32: a screen event — App says what the player did (the console opened / closed mid-shift, the pause menu). */
  screen(name: 'consoleOpened' | 'consoleClosed' | 'pauseOpened' | 'pauseClosed' | 'upgradesOpened') {
    if (name === 'consoleOpened') atConsole = true
    if (name === 'consoleClosed') atConsole = false
    runner.event(name)
  },
  /** Is the running shift a real one (not a lesson's training shift)? */
  realShift: () => !!engine && !training,
  /** Does the tank take the player's controls right now? (Not under a paused message.) */
  inputOn: () => inputOn,
  /** F32: under an insisting message only the console control works (W / ↑ / flick up) — the tank's controls don't. */
  consoleOnly: () => !inputOn && !!only?.includes('console'),
  /** Is a lesson message up? (The game's own in-shift messages wait while it is.) */
  messageUp: () => !!runner.view().message,
  inputKind: () => lastInput,
  /** App: this engine is the lesson's. Returns it wrapped, so the runner hears the player's controls. */
  attach(e: ShiftEngine): ShiftEngine {
    engine = e
    training = true
    anchorSpin = e.state.spin
    return {
      get state() { return e.state },
      // (a control the step blocks isn't heard either, so it can't move the lesson on)
      act(action: ShiftAction) { const heard = e.allows(action.type); e.act(action); if (heard) runner.action(action.type) },
      tick: (ms) => e.tick(ms),
      takeEvents: () => e.takeEvents(),
      setWallKick: (mode) => e.setWallKick(mode),
      snapshot: () => e.snapshot(),
      restore: (snap) => e.restore(snap),
      train: (cmd) => e.train(cmd),
      allows: (type) => e.allows(type),
    }
  },
  /** App: a REAL shift started — its first breakdowns may start lessons (F32, firstBreakdowns.ts). The engine isn't
   *  wrapped: a real shift's lessons only listen (events, screen events, gates). */
  watch(e: ShiftEngine) {
    engine = e
    training = false
    anchorSpin = e.state.spin
  },
  /** Start a lesson at a step (1 = the first; or a step id). Unknown lesson → false. */
  start(id: string, step: number | string = 1): boolean {
    const lesson = lessonNow(id)
    if (!lesson || !engine) return false
    const at = typeof step === 'string' ? Math.max(0, lesson.steps.findIndex((x) => x.id === step)) : Math.max(1, step) - 1
    runner.start(() => lessonNow(id)!, at)
    runner.event('shiftStarted')
    return true
  },
  /** F59: a lesson at the console BETWEEN shifts (no shift running: nothing to set up or pause — its line goes on the
   *  monitor, LessonView outlines what it points at). Starting a shift stops it. */
  startAtConsole(id: string): boolean {
    if (!lessonNow(id)) return false
    runner.start(() => lessonNow(id)!, 0)
    return true
  },
  /** The lesson is over (back to the console, a new shift): stop it, nothing paused. */
  stop() {
    runner.stop() // (sets the speed back to 1 with input on)
    engine = null
    training = false
    atConsole = false
    consoleFrozen = false
  },
  /** The tank ruptured mid-lesson: drop the lesson (and any waiting) so the drain runs as normal; the shift goes on. */
  drop() {
    runner.stop()
    consoleFrozen = false
  },
  /** The live numbers a message's {placeholders} can show. */
  vars(): Record<string, number> {
    const s = engine?.state
    if (!s) return {}
    return { left: Math.max(0, s.cracksNeeded - s.cracksSealed), total: s.cracksNeeded, sealed: s.cracksSealed,
      pressure: Math.round(s.pressure * 100), integrity: Math.round(s.integrity * 100), tries: runner.view().message?.tries ?? 0,
      consoleSpeed: Math.round(breakdowns.consoleTimeScale * 100) }
  },
}

type Words = string | { keys?: string; mouse?: string; phone?: string }

/** A message id → its words: content/text/en.json → lessons.<lesson id>.<id> (or lessons.shared.<id>), picked by input,
 *  {placeholders} filled.
 *  (An id that isn't in en.json is shown as it is: handy while writing a lesson.) */
export function lessonWords(lessonId: string | null, id: string, vars: Record<string, number>, input: 'keys' | 'mouse' | 'phone'): string {
  const book = (text as unknown as { lessons?: Record<string, Record<string, Words>> }).lessons?.[lessonId ?? ''] ?? {}
  const shared = (text as unknown as { lessons?: Record<string, Record<string, Words>> }).lessons?.shared ?? {}
  const entry = book[id] ?? shared[id] ?? id // (lessons.shared: lines several lessons use, e.g. "go to the console")
  const words = typeof entry === 'string' ? entry : (entry[input] ?? entry.keys ?? entry.mouse ?? entry.phone ?? id)
  return fill(words, vars)
}

/** ?lesson=<id>&step=<n> (dev): the next "Start shift" plays that lesson from that step. */
export function lessonFromUrl(): { id: string; step: number | string } | null {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null
  const p = new URLSearchParams(location.search)
  const id = p.get('lesson')
  if (!id || !lessonNow(id)) return null
  const step = p.get('step')
  return { id, step: step === null ? 1 : /^\d+$/.test(step) ? Number(step) : step }
}

// ---- the pointer: where the message points (CSS px in the stage), placed by ShiftStage's frame loop on its
// invisible .lesson-mark box; the kit's Callout points at that box and its pulse ring outlines it.
// Tags whose visible part is inside the tagged element (the readout's words sit in a kit PinnedBox hung on its point)
// (the HUD's machine bars are kit Bars, found by their meter's name — the whole bar, its name above it included)
const barOf = (name: string) => `.kit-bar:has([role="progressbar"][aria-label="${name}"])`
const TAG_TARGETS: Record<string, string> = {
  readout: '[data-tag="readout"] .kit-pinned',
  'bar-visor': barOf(text.hud.visor), 'bar-laser': barOf(text.hud.laser), 'bar-controls': barOf(text.hud.controls),
  'bar-integrity': barOf(text.hud.integrity), // F31: day one's D1 "this bar is its health"
  pauseResume: '.kit-pause .kit-menu > button:first-child', // the pause menu's "Back to the tank" (the kit's Pause)
  // the console's periscope: the part you grab (the kit's PullHandle) — while it works (a phone on its side switches it
  // off: the "or" pointer, Back to the tank, takes over)
  periscope: '.kit-pull-grip:not(:disabled)',
  // the console's "Back to the tank" button (a phone on its side, where the periscope and monitor are off screen)
  backToTank: '.kit-screen[aria-label="Console"] [data-slot="bottom-left"] button',
}

/** What a lesson step's `pointer` can say (Goops). tags = several things joined into ONE outlined box (F32: a lamp and
 *  the slider it asks for); every element carrying a tag counts (the visor's "repair-visor" = the lit lamp AND its
 *  control). or = where to point when none of this is on screen. */
export type LessonPointer = { tag?: string; tags?: string[]; selector?: string; piece?: boolean; cell?: [number, number]
  crack?: string; goop?: string // F31: the nearest crack of a kind / the biggest group of a colour (goopsGates.ts)
  placement?: string; or?: LessonPointer; show?: LessonPointer } // show (F32): also kept out of the dim, not outlined
export type Box = { left: number; top: number; right: number; bottom: number }

/** A CSS selector for what the pointer points at (several tags: a selector list). */
export function lessonTarget(pointer: unknown): string {
  const p = (pointer ?? {}) as LessonPointer
  const tags = p.tags ?? (p.tag ? [p.tag] : [])
  if (tags.length) return tags.map((tag) => TAG_TARGETS[tag] ?? `[data-tag="${tag}"]`).join(', ')
  if (p.selector) return p.selector
  return '.lesson-mark'
}

// on screen: there, with a size, and at least partly inside the window
const onScreen = (r: DOMRect) => (r.width > 0 || r.height > 0) && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth

/** The elements a pointer points at now — or its "or" when they aren't on screen, and so on. null = nothing on screen
 *  (or no pointer: the message points at nothing). */
export function lessonTargets(pointer: unknown): { els: Element[]; pointer: LessonPointer } | null {
  for (let p = pointer as LessonPointer | undefined; p; p = p.or) {
    const els = [...document.querySelectorAll(lessonTarget(p))].filter((el) => onScreen(el.getBoundingClientRect()))
    if (els.length) return { els, pointer: p }
  }
  return null
}

/** The one box round all of these elements (page px). */
export function boxAround(els: Element[]): Box | null {
  let box: Box | null = null
  for (const el of els) {
    const r = el.getBoundingClientRect()
    box = box ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) }
      : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
  }
  return box
}

/** F32: the words the thing pointed at asks for (data-say on it: the visor's slider "fixSlide", its lit button
 *  "fixButton"), instead of the step's own — so the message always says what to do with the part that's outlined. */
export const lessonSay = (els: Element[]) => els.map((el) => el.getAttribute('data-say')).find(Boolean) ?? null

/** F32: the visible tank's box (page px), kept by the frame loop — under an insisting go-to-console message the flick
 *  up still has to reach it through the dim. */
let tankBox: Box | null = null
export const lessonTankBox = () => tankBox

/** F32: the room a lesson message may use — the game's phone-width column, minus the kit's edge room (on a wide window
 *  the game is a phone-shaped column; a message never sits outside it). */
export function gameColumn(): Box {
  const w = window.innerWidth, h = window.innerHeight
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const consoleScreen = document.querySelector('.kit-screen[aria-label="Console"]')
  if (consoleScreen) { // the console's column: its slots' room (the kit's padding = the column's edges + edge room)
    const r = consoleScreen.getBoundingClientRect(), st = getComputedStyle(consoleScreen)
    return { left: r.left + parseFloat(st.paddingLeft), top: r.top + rem, right: r.right - parseFloat(st.paddingRight), bottom: r.bottom - rem }
  }
  // the tank: the HUD's column (ShiftStage's --kit-hud-w: the tank and a little room each side)
  const col = Math.min(w, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kit-hud-w')) || w)
  return { left: (w - col) / 2 + rem, top: rem, right: (w + col) / 2 - rem, bottom: h - rem }
}

// Where a flat tank point shows on screen under the visor's curved-TV look (the other way round from flatPoint: a few
// steps of "move by how far off it lands" — the bend is gentle, so it settles quickly).
function bentPoint(fx: number, fy: number, rect: ReturnType<typeof tankRect>, curve: number): [number, number] {
  let x = fx, y = fy
  for (let i = 0; i < 6; i++) {
    const [lx, ly] = flatPoint(x, y, rect, curve)
    x -= lx - fx
    y -= ly - fy
  }
  return [x, y]
}

/** Place the mark box over what the pointer points at (or hide it). Called every frame.
 *  curve = the visor's curved-TV strength now: the box goes where the cell is SEEN. */
export function placeLessonMark(el: HTMLElement | null, s: ShiftState, view: GooView, curve: number) {
  if (!el) return
  const p = (runner.view().message?.pointer ?? {}) as LessonPointer
  let box: [number, number, number, number] | null = null // left, top, right, bottom
  const rect = tankRect(view, s.visibleWidth, s.height - s.bufferRows)
  tankBox = { left: rect.left, top: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height } // (the stage fills the window: its px are the page's)
  const cellBox = (x: number, y: number): [number, number, number, number] => {
    const [fx, fy] = cellToScreen(x, y, view, s.width, s.bufferRows)
    const [cx, cy] = bentPoint(fx, fy, rect, curve)
    const h = view.cellPx / 2
    return [cx - h, cy - h, cx + h, cy + h]
  }
  const around = (cells: [number, number][]) => cells.map(([x, y]) => cellBox(x, Math.max(y, s.bufferRows)))
    .reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])])
  if (!runner.view().message || p.tag || p.tags || p.selector) box = null
  else if (p.cell) box = cellBox(...toTank(s, p.cell[0], p.cell[1]))
  else if (p.piece && s.piece) box = around(s.piece.cells)
  else if (p.crack || p.goop) { // F31: a crack / a goop group picked live (goopsGates.ts) — none right now: no box
    const cells = pointerCells(s, p) ?? []
    box = cells.length ? around(cells) : null
  }
  else box = cellBox(wrap(s.spin, s.width), s.bufferRows) // where pieces drop in
  if (!box) { if (el.style.display !== 'none') el.style.display = 'none'; return }
  const [l, t, r, b] = box.map(Math.round)
  el.style.display = ''
  el.style.translate = `${l}px ${t}px`
  el.style.width = `${r - l}px`
  el.style.height = `${b - t}px`
}
