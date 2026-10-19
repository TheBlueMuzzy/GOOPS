// THE GOOPS SIDE OF LESSONS (F30) — the thin adapter between the game-agnostic runner (runner.ts) and Goops:
// it turns a step's `setup` into engine.train commands, answers the runner's gates, hears the engine's events and the
// player's controls, and holds the speed / input switches ShiftStage reads every frame. App starts and stops lessons.
//
// What a Goops lesson step can use (content/lessons/*.json):
//   setup   (done in this order)
//     "clear": true                        empty the tank and drop the falling piece
//     "rules": { … }                       src/engine/training.ts TrainingRules: pressureRise, cracks, integrity, breakdowns,
//                                          falling, autoSpawn, allow (["spin","rotate","softDrop","pop","hold"]), zone,
//                                          pressureCap, integrityFloor, rupture, overflowRail, ruptureDrainSpeed,
//                                          zapColors (colour names)
//     "play": "normal"                     every rule back to a normal shift (free play)
//     "pressure": 40                       set the pressure, in percent
//     "goop": [[col, row, colour], …]      goop placed (already full); col = from the middle of the view, row = from the floor
//     "cracks": [[col, row, colour], …]    cracks placed · "removeCracks": [[col, row], …]
//     "pieces": [{ "shape": "T_I", "color": "blue", "turns": 1 }, …]   the next pieces, in order
//     "spawn": true                        bring the next piece in now
//   gates   "position" (rows the falling piece's bottom has come into the tank) · "pressure" / "integrity" (percent) ·
//           "sealed" (cracks sealed) · "cracksOutOfView" · "wrongCover" (cracks covered by another colour's goop)
//   events  every engine event by its type (lock, pop, plug, crack, ready, merge, quotaMet, rupture, breakdown…), with
//           its details for `where` (e.g. pop → sealed); plus "shiftStarted" (screen events: more later, F31/F32)
//   actions spin, rotate, softDrop, hold, pop, repair, console
//   pointer { "piece": true } · { "cell": [col, row] } (follows the tank as it spins) · { "tag": "readout" } (an element
//           with that data-tag) · { "selector": "…" } · none = where pieces drop in
//   words   a text id in content/text/en.json → lessons.<lesson id>; a { keys, mouse, phone } entry picks by the input used
//           last; {left} {total} {sealed} {pressure} {integrity} {tries} are filled from the live shift
import type { PieceChoice, ShiftAction, ShiftEngine, ShiftState, TrainingRules } from '../../engine'
import { isOnScreen } from '../../engine/tank'
import { liveTuning } from '../../devkit/tuning/liveTuning'
import { rulesClock } from '../../devkit/gameClock'
import { fill, tipsMemory } from '../../ui/kit'
import { cellToScreen, tankRect } from '../../view/geometry'
import { flatPoint } from '../../view/visorFx'
import type { GooView } from '../../goo/types'
import { session } from '../session'
import { createLessonRunner } from './runner'
import type { Lesson } from './lessonTypes'
import lessonTiming from '../../../content/tuning/lessons.json'
import shiftConfig from '../../../content/tuning/shift.json'
import text from '../../../content/text/en.json'

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
let anchorSpin = 0 // the tank's turn when the step was set up: lesson columns count from the middle of the view THEN
let lastInput: 'keys' | 'mouse' | 'phone' = 'keys'

const NORMAL_PLAY: Partial<TrainingRules> = { pressureRise: 1, cracks: true, integrity: true, breakdowns: true, falling: true,
  autoSpawn: true, allow: null, zone: null, pressureCap: 1, integrityFloor: 0, rupture: true, overflowRail: false, ruptureDrainSpeed: 1, zapColors: null }

// a colour by its name in shift.json ("blue") or its number (1 = the first colour)
const colour = (c: unknown) => (typeof c === 'number' ? c : shiftConfig.colors.indexOf(String(c)) + 1)
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
  if (setup.rules) {
    const rules = { ...(setup.rules as Record<string, unknown>) }
    if (Array.isArray(rules.zapColors)) rules.zapColors = rules.zapColors.map(colour)
    train('rules', { type: 'rules', rules: rules as Partial<TrainingRules> })
  }
  if (setup.play === 'normal') train('play normal', { type: 'rules', rules: NORMAL_PLAY })
  if (typeof setup.pressure === 'number') train('pressure', { type: 'pressure', value: setup.pressure / 100 })
  if (Array.isArray(setup.goop)) {
    train('goop', { type: 'goop', cells: (setup.goop as unknown[][]).map(([col, row, c]) => [...toTank(s, Number(col), Number(row)), colour(c)] as [number, number, number]) })
  }
  for (const [col, row] of (setup.removeCracks as number[][] | undefined) ?? []) train('removeCracks', { type: 'removeCrack', x: toTank(s, col, row)[0], y: toTank(s, col, row)[1] })
  for (const [col, row, c] of (setup.cracks as unknown[][] | undefined) ?? []) {
    const [x, y] = toTank(s, Number(col), Number(row))
    train('cracks', { type: 'crack', x, y, color: colour(c) })
  }
  if (Array.isArray(setup.pieces)) {
    train('pieces', { type: 'queue', pieces: (setup.pieces as PieceChoice[]).map((p) => ({ ...p, color: colour(p.color) })) })
  }
  if (setup.spawn) train('spawn', { type: 'spawn' })
}

function gate(name: string): number | null {
  const s = engine?.state
  if (!s) return null
  switch (name) {
    case 'position': return s.piece ? Math.max(...s.piece.cells.map(([, y]) => y)) - s.bufferRows + 1 : null
    case 'pressure': return Math.round(s.pressure * 100)
    case 'integrity': return Math.round(s.integrity * 100)
    case 'sealed': return s.cracksSealed
    case 'cracksOutOfView': return s.cracks.filter((c) => !isOnScreen(c.x, s.spin, s.width, s.visibleWidth)).length
    case 'wrongCover': return s.cracks.filter((c) => { const g = s.grid[c.y * s.width + c.x]; return g !== 0 && g !== c.color }).length
    default: return null
  }
}

export const runner = createLessonRunner({
  clock: rulesClock, // the rules clock: the Dev Kit's ⏸ / ◐ and the game's own pause stop the lesson's timers
  timing: () => lessonTiming,
  game: {
    setup,
    gate,
    setSpeed: (value, input) => { speed = value; inputOn = input },
    seen: (id) => tipsMemory().seen(id),
    markSeen: (id) => tipsMemory().markSeen(id),
    finished: (id) => tipsMemory().markSeen(`lesson:${id}`),
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
  /** × the shift's speed (ShiftStage multiplies the rules clock's rate by it): 0 while a paused message shows. */
  speed: () => speed,
  /** Does the tank take the player's controls right now? (Not under a paused message.) */
  inputOn: () => inputOn,
  /** Is a lesson message up? (The game's own in-shift messages wait while it is.) */
  messageUp: () => !!runner.view().message,
  inputKind: () => lastInput,
  /** App: this engine is the lesson's. Returns it wrapped, so the runner hears the player's controls. */
  attach(e: ShiftEngine): ShiftEngine {
    engine = e
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
  /** Start a lesson at a step (1 = the first; or a step id). Unknown lesson → false. */
  start(id: string, step: number | string = 1): boolean {
    const lesson = lessonNow(id)
    if (!lesson || !engine) return false
    const at = typeof step === 'string' ? Math.max(0, lesson.steps.findIndex((x) => x.id === step)) : Math.max(1, step) - 1
    runner.start(() => lessonNow(id)!, at)
    runner.event('shiftStarted')
    return true
  },
  /** The lesson is over (back to the console, a new shift): stop it, nothing paused. */
  stop() {
    runner.stop() // (sets the speed back to 1 with input on)
    engine = null
  },
  /** The live numbers a message's {placeholders} can show. */
  vars(): Record<string, number> {
    const s = engine?.state
    if (!s) return {}
    return { left: Math.max(0, s.cracksNeeded - s.cracksSealed), total: s.cracksNeeded, sealed: s.cracksSealed,
      pressure: Math.round(s.pressure * 100), integrity: Math.round(s.integrity * 100), tries: runner.view().message?.tries ?? 0 }
  },
}

type Words = string | { keys?: string; mouse?: string; phone?: string }

/** A message id → its words: content/text/en.json → lessons.<lesson id>.<id>, picked by input, {placeholders} filled.
 *  (An id that isn't in en.json is shown as it is: handy while writing a lesson.) */
export function lessonWords(lessonId: string | null, id: string, vars: Record<string, number>, input: 'keys' | 'mouse' | 'phone'): string {
  const book = (text as unknown as { lessons?: Record<string, Record<string, Words>> }).lessons?.[lessonId ?? ''] ?? {}
  const entry = book[id] ?? id
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
const TAG_TARGETS: Record<string, string> = { readout: '[data-tag="readout"] .kit-pinned' }

/** A CSS selector for the Callout's target, from the message's pointer. */
export function lessonTarget(pointer: unknown): string {
  const p = (pointer ?? {}) as { tag?: string; selector?: string }
  if (p.tag) return TAG_TARGETS[p.tag] ?? `[data-tag="${p.tag}"]`
  if (p.selector) return p.selector
  return '.lesson-mark'
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
  const p = (runner.view().message?.pointer ?? {}) as { piece?: boolean; cell?: [number, number]; tag?: string; selector?: string }
  let box: [number, number, number, number] | null = null // left, top, right, bottom
  const rect = tankRect(view, s.visibleWidth, s.height - s.bufferRows)
  const cellBox = (x: number, y: number): [number, number, number, number] => {
    const [fx, fy] = cellToScreen(x, y, view, s.width, s.bufferRows)
    const [cx, cy] = bentPoint(fx, fy, rect, curve)
    const h = view.cellPx / 2
    return [cx - h, cy - h, cx + h, cy + h]
  }
  const around = (cells: [number, number][]) => cells.map(([x, y]) => cellBox(x, Math.max(y, s.bufferRows)))
    .reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])])
  if (!runner.view().message || p.tag || p.selector) box = null
  else if (p.cell) box = cellBox(...toTank(s, p.cell[0], p.cell[1]))
  else if (p.piece && s.piece) box = around(s.piece.cells)
  else box = cellBox(wrap(s.spin, s.width), s.bufferRows) // where pieces drop in
  if (!box) { if (el.style.display !== 'none') el.style.display = 'none'; return }
  const [l, t, r, b] = box.map(Math.round)
  el.style.display = ''
  el.style.translate = `${l}px ${t}px`
  el.style.width = `${r - l}px`
  el.style.height = `${b - t}px`
}
