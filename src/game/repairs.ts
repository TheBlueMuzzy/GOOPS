// THE REPAIR PUZZLES at the console (F24, GDD §5 Breakdowns — Muzzy, 2026-10-18). Pure rules, no screen: the console's
// panels (src/ui/RepairPanels.tsx) show them and send in what the player did; solved = act({ type: 'repair', machine }).
//   Laser: sliders light up (all 4 — content/tuning/breakdowns.json laser.repairSliders), each needing LEFT or RIGHT
//   at random; any unlit ones need nothing.
//   Visor (the RESET VISOR panel): slide up → press 3 lit buttons in turn (visor.repairButtons; never the same twice
//   running) → slide down.
//   Controls: turn the dial to the lit corner (it locks by itself), 4 corners in a row (controls.repairCorners), each
//   one picked at random from the corners the dial ISN'T on (an earlier corner can come back, never the current one).
// Muzzy, 2026-10-18: every repair should be about 4 clicks.
// HOW MANY STEPS each repair takes comes from ONE place, repairSteps() below — later upgrades take steps off it.
// A new puzzle every time the machine breaks. Wrong moves never reset anything (forgiving): a wrong button only shakes.

import breakdowns from '../../content/tuning/breakdowns.json'
import type { MachineId } from '../engine'

export type Rand = () => number // 0 ≤ r < 1 (Math.random in the game; seeded in tests)
const pick = <T>(list: readonly T[], rand: Rand) => list[Math.floor(rand() * list.length)]

// How many steps a machine's repair takes: the tuning (laser sliders lit · visor button presses · dial corners) minus
// `fewerSteps` (from upgrades: resolveUpgrades().fewerRepairSteps — 0 until "Quick Fix" style upgrades exist), never
// below 1. (The visor's two slides are always there; the laser can't light more than its 4 sliders.)
// (read from the live tuning each time — the Dev Kit's sliders reach the next puzzle)
const baseSteps = (machine: MachineId): number => ({
  laser: breakdowns.laser.repairSliders,
  visor: breakdowns.visor.repairButtons,
  controls: breakdowns.controls.repairCorners,
})[machine]
export function repairSteps(machine: MachineId, fewerSteps = 0): number {
  return Math.max(1, baseSteps(machine) - Math.max(0, Math.floor(fewerSteps)))
}

// ── Laser: sliders have 3 stops (0 = left, 1 = middle, 2 = right) and all start in the middle ──
export const LASER_SLIDERS = 4
export type LaserWant = (0 | 2 | null)[] // per slider: the end it must go to, or null (unlit: needs nothing)
// litCount = how many sliders light up (tuning; 4 = all of them)
export function newLaser(rand: Rand, litCount: number): LaserWant {
  const count = Math.min(Math.max(1, litCount), LASER_SLIDERS)
  const lit = new Set<number>()
  while (lit.size < count) lit.add(Math.floor(rand() * LASER_SLIDERS))
  return Array.from({ length: LASER_SLIDERS }, (_, i) => (lit.has(i) ? (rand() < 0.5 ? 0 : 2) : null))
}
export const laserSolved = (want: LaserWant, pos: number[]) => want.every((w, i) => w === null || pos[i] === w)

// ── Visor: the slider has 2 stops (0 = up, 1 = down) and starts down; three buttons (0 top … 2 bottom) ──
export const VISOR_BUTTONS = 3
export interface Visor {
  order: number[] // the buttons to press, in order (never the same twice running); 3 today
  step: number // 0 = slide up · 1…n = press order[step - 1] · n + 1 = slide down · n + 2 = fixed  (n = order.length)
  slider: 0 | 1
}
// presses = how many button presses (repairSteps('visor', …))
export function newVisor(rand: Rand, presses: number): Visor {
  const order: number[] = []
  while (order.length < Math.max(1, presses)) {
    const options = [0, 1, 2].filter((b) => b !== order[order.length - 1])
    order.push(pick(options, rand))
  }
  return { order, step: 0, slider: 1 }
}
export const visorDone = (v: Visor) => v.step >= v.order.length + 2
// after the last button: the bottom lamp asks for the slide down
export const visorWantsDown = (v: Visor) => v.step === v.order.length + 1
// the slider only moves when it's asked for (up at the start, down after the last button): otherwise it springs back (refused)
export function visorSlide(v: Visor, to: 0 | 1): Visor | null {
  if (v.step === 0 && to === 0) return { ...v, slider: 0, step: 1 }
  if (visorWantsDown(v) && to === 1) return { ...v, slider: 1, step: v.step + 1 }
  return null
}
// a button press: the lit one moves it on; any other is wrong (the panel shakes; nothing resets)
export function visorPress(v: Visor, button: number): { visor: Visor; wrong: boolean } {
  if (visorLitButton(v) === button) return { visor: { ...v, step: v.step + 1 }, wrong: false }
  return { visor: v, wrong: true }
}
// which button's lamp is lit now (null: none)
export function visorLitButton(v: Visor): number | null {
  return v.step >= 1 && v.step <= v.order.length ? v.order[v.step - 1] : null
}

// ── Controls: the dial rests on one of 4 corners (0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left) ──
export const DIAL_CORNERS = 4
export interface Controls {
  targets: number[] // the corners in turn, each different from the one before (and from where the dial starts)
  step: number // how many are locked (all of them = fixed)
  dial: number // the corner the dial points at
}
// cornerCount = how many corners in a row (tuning)
export function newControls(rand: Rand, cornerCount: number, dial = 0): Controls {
  const targets: number[] = []
  let from = dial // never ask for the corner the dial is already on
  while (targets.length < Math.max(1, cornerCount)) {
    from = pick([0, 1, 2, 3].filter((c) => c !== from), rand)
    targets.push(from)
  }
  return { targets, step: 0, dial }
}
export const controlsDone = (c: Controls) => c.step >= c.targets.length
// the dial turned to a corner: the lit one locks by itself (no confirm tap) and the next lights up
export function controlsTurn(c: Controls, corner: number): Controls {
  const locked = !controlsDone(c) && corner === c.targets[c.step]
  return { ...c, dial: corner, step: locked ? c.step + 1 : c.step }
}

// DURING A LESSON ONLY THE OUTLINED PART ANSWERS (F32, Muzzy's second try: "I was able to slide the sliders that weren't
// highlighted by the pink outline… it's a bit misleading"). While a lesson step outlines something, a repair control
// works only if it carries one of the outlined tags (its tag = what it is now: "repair-<machine>" while it's the part to
// use next); the others don't move or press — they give the panel's "wrong" shake. No lesson (nothing outlined): every
// control works as always.
// (the lesson's last step only outlines the periscope — the lesson is done with the console, so a second broken machine
// is repairable again there; message steps with Got it keep everything on rails)
const FREE_STEP = new Set(['periscope', 'backToTank'])
export const controlAnswers = (outlined: readonly string[], tag?: string) =>
  outlined.every((t) => FREE_STEP.has(t)) || (!!tag && outlined.includes(tag))
