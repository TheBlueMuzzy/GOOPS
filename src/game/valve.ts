// THE RELEASE VALVE's puzzle (F64 — the final shift, Muzzy's mini-game 2026-10-26; sketch S11 valve-wheels.html).
// Pure rules, no screen: the console's valve panel (src/ui/ValvePanel.tsx) draws it and sends in what the player did;
// solved = the engine's openValveStage().
//   Two wheels, each with a hidden RIGHT turn. How far each is from right (−1..1, 0 = right) moves one needle; the
//   valve.json `rule` says how the two mix. The needle swings there on a spring (`sway`). Held inside the green
//   (`green` wide, × `shrink` each stage) for `hold` seconds = the stage opens.
//   Wheels turn in clicks (`detents` a turn): a key = one click, a drag clicks from one to the next.
// Numbers: content/tuning/valve.json (read each time — the Dev Kit's sliders reach the next frame).
import valveFile from '../../content/tuning/valve.json'

export type Rand = () => number // 0 ≤ r < 1 (Math.random in the game; seeded in tests and scripted checks)

export interface ValveConfig {
  rule: number
  detents: number
  fine: number
  coarseGain: number
  green: number
  shrink: number
  hold: number
  sway: number
  openSec: number
  goSec: number
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
/** valve.json now, every number checked (a broken one falls back to the sketch's default). */
export function valveConfig(file: Partial<ValveConfig> = valveFile): ValveConfig {
  return {
    rule: Math.round(num(file.rule, 2)), detents: Math.max(0, Math.round(num(file.detents, 8))), fine: num(file.fine, 0.3),
    coarseGain: num(file.coarseGain, 1.6), green: Math.max(0, num(file.green, 0.16)), shrink: Math.max(0, num(file.shrink, 0.75)),
    hold: Math.max(0, num(file.hold, 0.6)), sway: Math.max(0.1, num(file.sway, 9)), openSec: Math.max(0, num(file.openSec, 1.1)),
    goSec: Math.max(0, num(file.goSec, 3)),
  }
}

export const TAU = Math.PI * 2
/** An angle brought into −π..π. */
export const wrap = (a: number) => { const x = (a + Math.PI) % TAU; return (x < 0 ? x + TAU : x) - Math.PI }
/** One click of a wheel, in radians (0 = smooth). */
export const clickSize = (cfg: ValveConfig) => (cfg.detents > 0 ? TAU / cfg.detents : 0)
/** How far one key press turns a wheel: a click, or 1/24 of a turn when the wheels are smooth. */
export const keyTurn = (cfg: ValveConfig) => clickSize(cfg) || TAU / 24
/** The click nearest an angle (smooth wheels: the angle itself). */
export const snap = (a: number, cfg: ValveConfig) => { const c = clickSize(cfg); return c ? Math.round(a / c) * c : a }

/** How far a wheel is from right: −1..1 (0 = right; ±1 = half a turn off), signed. */
export const wheelOff = (angle: number, right: number) => wrap(angle - right) / Math.PI

/** Where the needle wants to be (−1..1, 0 = the green's middle) for the two wheels' errors e1 (left), e2 (right). */
export function needleTarget(cfg: ValveConfig, e1: number, e2: number): number {
  if (cfg.rule === 1) return (e1 + e2) / 2 // Add: both push the same amount
  if (cfg.rule === 3) return Math.abs(e1) >= Math.abs(e2) ? e1 : e2 // Worst wins
  // Coarse + fine (the default): the right wheel moves it `fine` as much as the left
  return Math.max(-1, Math.min(1, ((e1 + e2 * cfg.fine) / (1 + cfg.fine)) * cfg.coarseGain))
}

/** The green's width (share of the dial) at a stage (0 = the first). */
export const greenWidth = (cfg: ValveConfig, stage: number) => cfg.green * Math.pow(cfg.shrink, Math.max(0, stage))
/** Is the needle in the green? */
export const inGreen = (needle: number, cfg: ValveConfig, stage: number) => Math.abs(needle) <= greenWidth(cfg, stage) / 2

export interface ValveWheels {
  right: [number, number] // each wheel's hidden right turn (radians, on a click)
  angle: [number, number] // where each wheel is now (radians, on a click)
}
/** Where the needle wants to be for these wheels. */
export const wheelsTarget = (cfg: ValveConfig, w: ValveWheels) =>
  needleTarget(cfg, wheelOff(w.angle[0], w.right[0]), wheelOff(w.angle[1], w.right[1]))

/** A new valve for a stage: hidden right turns on clicks, and a start the needle reads OUT of the green (never solved). */
export function newValve(rand: Rand, cfg: ValveConfig, stage: number): ValveWheels {
  const n = cfg.detents > 0 ? cfg.detents : 360
  const at = () => snap(Math.floor(rand() * n) * (TAU / n), cfg)
  const right: [number, number] = [at(), at()]
  const w: ValveWheels = { right, angle: [right[0], right[1]] }
  for (let tries = 0; tries < 200 && Math.abs(wheelsTarget(cfg, w)) <= greenWidth(cfg, stage) / 2; tries++) w.angle = [at(), at()]
  // (a valve so loose that nearly every start is solved: put the left wheel half a turn off)
  if (Math.abs(wheelsTarget(cfg, w)) <= greenWidth(cfg, stage) / 2) w.angle = [snap(right[0] + Math.PI, cfg), w.angle[1]]
  return w
}

/** The needle's spring: one step of `dt` seconds toward `want` (sway = how stiff; a little under-damped, so it wobbles). */
export function stepNeedle(needle: { pos: number; vel: number }, want: number, sway: number, dt: number): { pos: number; vel: number } {
  const vel = needle.vel + ((want - needle.pos) * sway * sway - needle.vel * 2 * sway * 0.55) * dt
  return { pos: Math.max(-1.05, Math.min(1.05, needle.pos + vel * dt)), vel }
}

/** Time held in the green after `dt` more seconds: it adds up while the needle is in the green and no wheel is held,
 *  and starts again from 0 the moment it isn't. */
export const holdStep = (held: number, counts: boolean, dt: number) => (counts ? held + dt : 0)
/** Held long enough: the stage opens. Never at 0 held — with `hold` 0 the needle must still touch the green (review:
 *  a Dev Kit hold of 0 opened the stage on the first frame, needle anywhere). */
export const holdDone = (held: number, cfg: ValveConfig) => held > 0 && held >= cfg.hold

/** A seeded 0..1 random (mulberry32) — the same valve every run under scripted checks and in tests. */
export function seededRand(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
