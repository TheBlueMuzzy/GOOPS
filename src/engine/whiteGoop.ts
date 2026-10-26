// THE WHITE GOOP (F63): the Veteran, gooped. From rank `fromRank` (31) one white clump is in the tank. Ported from
// Muzzy's approved sketch (.planning/research/sketches/white-goop.html — decide(), stepsFrom's ooze branch,
// hardness(), the seal) with his picks (.planning/research/white-goop/picks.json): he OOZES BEHIND THE GOOP.
//   - He is NOT a grid cell: never merges, never pops, never holds goop up. Goop passes in front of him.
//   - Drop-in: at the start of the shift he falls from the top of the tank like goop until something holds him up
//     (the floor or goop under him), then clings to the back wall.
//   - Every time he arrives somewhere he thinks again: on a crack → seal it (sealTime seconds), then rest (restAfter);
//     otherwise pick the crack that's hardest for YOU (rows you'd have to build up under it, + coveredHardness if
//     wrong-colour goop covers it) and ooze one cell toward it — slower (× oozeSlow) through goop.
//   - Oozing reaches every cell, so the sketch's "can't reach it → take the next one" never comes up here; and the
//     sketch's "wriggles out" (goop landing on him) only matters for the gravity styles — with Ooze goop passes in
//     front of him, so neither is built.
//   - The laser passes through him: a zap on his cell says "ow" (an event the view turns into the bubble + a flinch)
//     and still pops goop in front of him (the sketch's tapVet).
// Numbers: content/tuning/whiteGoop.json, read at the moment each is used (live). Time only moves through step(),
// which the engine calls on the rules clock — the Dev Kit pause stops him. No randomness: shifts stay repeatable.
import type { Crack, ShiftState, TapPoint, WhiteGoop } from './types'
import { wrapX } from './tank'
import { crackCells, crackHas, crackSize, plugsCrack } from './twists'

// The shape of content/tuning/whiteGoop.json the engine reads (the look numbers are the view's)
export interface WhiteGoopConfig {
  fromRank: number // he's in the tank from this rank (31)
  dropFromCentre: number // drop-in column: this many columns from the view's centre at the start (− = left)
  dropSecPerCell: number // drop-in: seconds per row as he falls
  secPerCell: number // oozing: seconds per cell through empty tank
  oozeSlow: number // × slower through a cell with goop in it
  targetBy: string // 'hardestForYou' (Muzzy's pick) · 'oldest' · 'closest' · F64 'outOfReach' (the final shift)
  reachRows?: number // F64 outOfReach: only cracks with at least this many rows to build under them (hardness); none → he waits
  shrinkPerSeal?: number // F64 the final shift: how much of him each sealed crack cell uses up (shift.ts; unset = none)
  coveredHardness: number // hardestForYou: a crack covered by the wrong colour counts this many rows harder (you'd dig)
  sealTime: number // seconds sitting on a crack to seal it
  // F39 grown cracks: each cell past the first adds sealTime × this (1 = sealTime × the crack's size). Unset = 1.
  sealTimePerExtraCell?: number
  restAfter: number // seconds he rests after a seal
  thinkSec: number // with no crack to go to, he looks again this often
  countsForQuota: boolean // his seals count toward the shift's crack quota
  integrityRefund: boolean // his seals patch the tank (integrity.sealRefund), as yours do
}

const num = (v: unknown, fallback: number, min = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : fallback)

/** Is the white goop in this shift? (a normal shift at or above his rank; never in a lesson's training shift) */
export function whiteGoopIn(cfg: WhiteGoopConfig | undefined, rank: number, training: boolean): boolean {
  return !!cfg && !training && rank >= num(cfg.fromRank, Infinity)
}

/** Him at the start of a shift: at the top of the visible tank, about to drop in. */
export function newWhiteGoop(state: ShiftState, cfg: WhiteGoopConfig): WhiteGoop {
  const x = wrapX(state.spin + Math.round(num(cfg.dropFromCentre, 0, -state.width)), state.width)
  const y = state.bufferRows
  return { x, y, fromX: x, fromY: y, t: 1, moveMs: 0, px: x, py: y, mode: 'drop', targetId: null, seal: 0, waitMs: 0, behind: false }
}

/** Does a zap at `at` (fractional tank cells) hit him? Generous by a little, like the sketch's onVet — read from where
 *  he's DRAWN (px, py), so a tap on the clump you see always counts. */
export function whiteGoopAt(state: ShiftState, at: TapPoint): boolean {
  const v = state.vet
  if (!v) return false
  let dx = at.x - (v.px + 0.5)
  dx = ((dx % state.width) + state.width * 1.5) % state.width - state.width / 2 // the short way round the tank
  return Math.abs(dx) <= 0.6 && at.y >= v.py - 0.15 && at.y <= v.py + 1.1
}

const goopAt = (s: ShiftState, x: number, y: number) => s.grid[y * s.width + x] !== 0

// The highest goop in column x, as a row from the floor (the floor row = 0); an empty column = -1 (the sketch's colTopRow)
function columnTop(s: ShiftState, x: number): number {
  for (let y = 0; y < s.height; y++) if (goopAt(s, x, y)) return s.height - 1 - y
  return -1
}

/** How hard a crack is for YOU (the sketch's hardness): rows you'd have to build up under it, + coveredHardness if
 *  wrong-colour goop covers it (you'd have to dig it out first). */
//  F39: a grown crack is as hard as its hardest cell (you have to cover every one).
export function crackHardness(s: ShiftState, c: Crack, cfg: WhiteGoopConfig): number {
  let hardest = 0
  for (const [x, y] of crackCells(c)) {
    const here = s.grid[y * s.width + x]
    const covered = here !== 0 && !plugsCrack(here, c.color) // (wild goop plugs any colour: not "wrong")
    hardest = Math.max(hardest, Math.max(0, s.height - 1 - y - columnTop(s, x)) + (covered ? num(cfg.coveredHardness, 4) : 0))
  }
  return hardest
}

/** How long he sits on this crack to seal it (ms): sealTime, + sealTime × sealTimePerExtraCell for each cell a grown
 *  crack has past its first (F39: 1 = sealTime × its size). */
export function sealMs(cfg: WhiteGoopConfig, c: Crack): number {
  const one = Math.max(0.1, num(cfg.sealTime, 6)) * 1000
  return one * (1 + (crackSize(c) - 1) * num(cfg.sealTimePerExtraCell, 1))
}

// Cheapest ooze path from him to every visible cell (Dijkstra over the tank's visible rows; the tank wraps round).
// Each step: one cell up / down / left / right, costing 1, or oozeSlow into a cell with goop in it.
function search(s: ShiftState, from: number, oozeSlow: number): { dist: Float64Array; prev: Int32Array } {
  const N = s.width * s.height
  const dist = new Float64Array(N).fill(Infinity)
  const prev = new Int32Array(N).fill(-1)
  const done = new Uint8Array(N)
  dist[from] = 0
  for (;;) {
    let u = -1, best = Infinity
    for (let i = s.bufferRows * s.width; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i }
    if (u < 0) break
    done[u] = 1
    const x = u % s.width, y = Math.floor(u / s.width)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ny = y + dy
      if (ny < s.bufferRows || ny >= s.height) continue
      const nx = wrapX(x + dx, s.width), v = ny * s.width + nx
      const d = best + (goopAt(s, nx, ny) ? Math.max(1, oozeSlow) : 1)
      if (d < dist[v]) { dist[v] = d; prev[v] = u }
    }
  }
  return { dist, prev }
}

/** Advance him by dt ms (rules time). Returns the crack he finished sealing this step (the engine seals it), or null. */
export function stepWhiteGoop(s: ShiftState, cfg: WhiteGoopConfig, dt: number): Crack | null {
  const v = s.vet
  if (!v) return null
  let sealed: Crack | null = null
  if (v.mode === 'move' || v.mode === 'drop') {
    v.t = Math.min(1, v.t + dt / Math.max(1, v.moveMs))
    if (v.t >= 1 && v.mode === 'move') v.mode = 'idle'
  } else if (v.mode === 'seal') {
    const c = s.cracks.find((k) => k.id === v.targetId)
    if (!c || !crackHas(c, v.x, v.y)) { v.mode = 'idle'; v.seal = 0 } // (you sealed it first)
    else {
      v.seal += dt / sealMs(cfg, c) // (a crack that grows while he sits on it takes longer from then on)
      if (v.seal >= 1) { sealed = c; v.targetId = null; v.seal = 0; v.mode = 'rest'; v.waitMs = num(cfg.restAfter, 1) * 1000 }
    }
  } else if (v.mode === 'rest' || v.mode === 'wait') {
    v.waitMs -= dt
    if (v.waitMs <= 0) v.mode = 'idle'
  }
  if (v.mode === 'drop' && v.t >= 1) dropStep(s, v, cfg)
  if (v.mode === 'idle') decide(s, v, cfg)
  place(s, v)
  return sealed
}

// Drop-in: one row down while nothing holds him up; landed → he clings to the wall and starts thinking.
function dropStep(s: ShiftState, v: WhiteGoop, cfg: WhiteGoopConfig): void {
  const held = v.y >= s.height - 1 || goopAt(s, v.x, v.y + 1)
  if (held) { v.mode = 'idle'; return }
  startMove(v, v.x, v.y + 1, num(cfg.dropSecPerCell, 0.07) * 1000)
  v.mode = 'drop'
}

function startMove(v: WhiteGoop, x: number, y: number, ms: number): void {
  v.fromX = v.x; v.fromY = v.y
  v.x = x; v.y = y // (in the new cell for the rules at once; drawn sliding there over the move)
  v.t = 0
  v.moveMs = Math.max(30, ms)
  v.mode = 'move'
}

// The sketch's decide(): on a crack → seal it; no cracks → wait a moment and look again; else one ooze step toward
// the crack in most danger.
function decide(s: ShiftState, v: WhiteGoop, cfg: WhiteGoopConfig): void {
  const under = s.cracks.find((c) => crackHas(c, v.x, v.y)) // (any cell of a grown crack: he seals it whole, F39)
  if (under) {
    if (v.targetId !== under.id) v.seal = 0
    v.targetId = under.id
    v.mode = 'seal'
    return
  }
  if (!s.cracks.length) { wait(v, cfg); return }
  const from = v.y * s.width + v.x
  const oozeSlow = num(cfg.oozeSlow, 2.5, 1)
  const { dist, prev } = search(s, from, oozeSlow)
  // (F39: a grown crack is reached at its nearest cell)
  const nearest = (c: Crack) => crackCells(c).map(([x, y]) => y * s.width + x).reduce((a, b) => (dist[b] < dist[a] ? b : a))
  const cost = (c: Crack) => dist[nearest(c)]
  // F64 outOfReach (the final shift): only the cracks you can't reach — at least reachRows rows to build under them
  const reach = num(cfg.reachRows, 0)
  const wanted = cfg.targetBy === 'outOfReach' ? s.cracks.filter((c) => crackHardness(s, c, cfg) >= reach) : s.cracks
  const pick = [...wanted].sort((a, b) => danger(s, b, cfg, cost(b)) - danger(s, a, cfg, cost(a)) || a.id - b.id)
    .find((c) => Number.isFinite(cost(c))) // (oozing reaches every cell: always the first)
  if (!pick) { wait(v, cfg); return }
  v.targetId = pick.id
  v.seal = 0
  // walk back from the crack to find the first step
  let step = nearest(pick)
  while (prev[step] !== from && prev[step] >= 0) step = prev[step]
  const nx = step % s.width, ny = Math.floor(step / s.width)
  const secs = num(cfg.secPerCell, 0.7, 0.05) * (goopAt(s, nx, ny) ? oozeSlow : 1)
  startMove(v, nx, ny, secs * 1000)
}

function wait(v: WhiteGoop, cfg: WhiteGoopConfig): void {
  v.targetId = null
  v.mode = 'wait'
  v.waitMs = num(cfg.thinkSec, 0.3, 0.05) * 1000
}

// Bigger = more danger (the sketch's dangerOf; Muzzy's pick: hardest for you)
function danger(s: ShiftState, c: Crack, cfg: WhiteGoopConfig, cost: number): number {
  if (cfg.targetBy === 'oldest') return -c.id
  if (cfg.targetBy === 'closest') return -(Number.isFinite(cost) ? cost : 1e6)
  return crackHardness(s, c, cfg)
}

// Where he's drawn: from → to along the move (a straight flow, like the sketch's ooze), the short way round the tank;
// and whether goop covers his cell (then he's behind it: the view's x-ray outline).
function place(s: ShiftState, v: WhiteGoop): void {
  let dx = v.x - v.fromX
  if (dx > s.width / 2) dx -= s.width
  if (dx < -s.width / 2) dx += s.width
  const px = v.fromX + dx * v.t
  v.px = ((px % s.width) + s.width) % s.width
  v.py = v.fromY + (v.y - v.fromY) * v.t
  v.behind = goopAt(s, v.x, v.y)
}
