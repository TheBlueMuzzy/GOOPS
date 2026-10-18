// THE REPAIR PUZZLES at the console (F24, GDD §5 Breakdowns — Muzzy, 2026-10-18). Pure rules, no screen: the console's
// panels (src/ui/RepairPanels.tsx) show them and send in what the player did; solved = act({ type: 'repair', machine }).
//   Laser: sliders light up (all 4 — content/tuning/breakdowns.json laser.repairSliders), each needing LEFT or RIGHT
//   at random; any unlit ones need nothing.
//   Visor (the RESET LIGHTS panel): slide up → press 3 lit buttons in turn (never the same twice running) → slide down.
//   Controls: turn the dial to the lit corner (it locks by itself), 4 corners in a row (controls.repairCorners), each
//   one picked at random from the corners the dial ISN'T on (an earlier corner can come back, never the current one).
// Muzzy, 2026-10-18: every repair should be about 4 clicks.
// A new puzzle every time the machine breaks. Wrong moves never reset anything (forgiving): a wrong button only shakes.

export type Rand = () => number // 0 ≤ r < 1 (Math.random in the game; seeded in tests)
const pick = <T>(list: readonly T[], rand: Rand) => list[Math.floor(rand() * list.length)]

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
  order: number[] // the 3 buttons to press, in order (never the same twice running)
  step: number // 0 = slide up · 1–3 = press order[step - 1] · 4 = slide down · 5 = fixed
  slider: 0 | 1
}
export function newVisor(rand: Rand): Visor {
  const order: number[] = []
  while (order.length < 3) {
    const options = [0, 1, 2].filter((b) => b !== order[order.length - 1])
    order.push(pick(options, rand))
  }
  return { order, step: 0, slider: 1 }
}
export const visorDone = (v: Visor) => v.step >= 5
// the slider only moves when it's asked for (up at step 0, down at step 4): otherwise it springs back (refused)
export function visorSlide(v: Visor, to: 0 | 1): Visor | null {
  if (v.step === 0 && to === 0) return { ...v, slider: 0, step: 1 }
  if (v.step === 4 && to === 1) return { ...v, slider: 1, step: 5 }
  return null
}
// a button press: the lit one moves it on; any other is wrong (the panel shakes; nothing resets)
export function visorPress(v: Visor, button: number): { visor: Visor; wrong: boolean } {
  if (v.step >= 1 && v.step <= 3 && button === v.order[v.step - 1]) return { visor: { ...v, step: v.step + 1 }, wrong: false }
  return { visor: v, wrong: true }
}
// which button's lamp is lit now (null: none)
export const visorLitButton = (v: Visor) => (v.step >= 1 && v.step <= 3 ? v.order[v.step - 1] : null)

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
