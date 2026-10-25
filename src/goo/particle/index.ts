// PARTICLE goo, ported from .planning/research/sketches/lab-L3-particles.html.
// Each grid cell owns 9 particles on a 3x3 lattice, each pulled to its home spot by a weak spring. Same colours stick
// (cohesion + bonds); other colours push apart a little. Splatted per colour, blurred, thresholded, wet-shaded.
// Changes from L3 (Muzzy, 2026-10-17): the falling piece uses the Jelly-style rotate (lags and springs over), and pop is
// a short shrink + fade (no burst). Simulates in view space, only near the screen (TDD D03).
import type { ShiftEvent, ShiftState } from '../../engine/types'
import { screenColumn, type GooOptions, type GooRenderer, type GooView } from '../types'
import particleFile from '../../../content/tuning/goo-particle.json' // live: follows the Dev Kit's Tuning sliders (followFile, each frame)
import { followFile, parseKnobs, mergeKnobs, type Knobs } from '../shared/knobs'
import { DEFAULT_COLOR_NAMES, gooSlot, paletteTable } from '../shared/palette'
import { WILD_UNIFORMS, setWild } from '../shared/wildLook'
import { groupFillLines, inWindow, tankWindow, unwrapCells, viewOrigin, wrapNear, type FillInfo } from '../shared/tank'
import { PiecePose } from '../shared/piecePose'
import { FULLSCREEN_VS, bindTextures, fitCanvas, freeProgram, freeTarget, gooContext, makeProgram, makeTarget, type Program, type Target } from '../shared/gl'
import { BLUR_FS, SHADE_FS, SPLAT_FS, SPLAT_VS } from './shaders'
import { XRAY_MAX, XRAY_UNIFORMS, setXray } from '../shared/xray'
import { sprayDrops, sprayDue, suckIn, zapEnd, zapFade, zapHeat, zapLook, type ZapLook } from '../shared/zap'
import { FaceBook, type Face, type FaceReport } from '../shared/faces'
import { FaceDrawer } from '../shared/faceDraw'

// A zap (F67, the same timeline as Jelly — src/goo/shared/zap.ts): the zapped cells' particles, where the laser point is
// (view cells), their middle at the moment of the zap, and how far it's got
interface ZapGroup {
  id: number
  t: number
  lx: number
  ly: number
  c0x: number
  c0y: number
  color: number
  members: number[]
  sprayed: boolean
  hot: number // 0 … 1 white-hot
  fade: number // 1 … 0 as it's sucked in
  suck: number // 0 … 1 how far it's been sucked in, on average
  face: Face | null // F62 its face (squeezed shut, shrinking into the laser point with it) and where it sat at the zap
  fx0: number
  fy0: number
}

// The knobs as the file has them right now (with the Dev Kit's latest edit)
export const particleDefaults = (): Knobs => parseKnobs(particleFile)

const CELL_M = 0.05 // metres per cell, so gravity can be set in m/s²
const MAXP = 9000
const MAXB = 40000
const BS = 8 // bond slots per particle
const HR = 0.5 // neighbour reach
const R0 = 0.3 // push-apart
const RSEP = 0.42 // other-colour gap
const MAKE = 0.5 // bond-make distance
const RP = 0.14 // floor radius
const KREP = 700
const SEP = 22
const SIM_DT = 1 / 120
const INST = 10
const DROP_R = 0.255 // a v1 spray droplet's average radius (cells): a droplet of this size splats like one particle

export function createParticleRenderer(canvas: HTMLCanvasElement, opts: GooOptions = {}): GooRenderer {
  const K: Knobs = particleDefaults()
  const seen: Knobs = { ...K } // the file's values as last followed (followFile)
  const colorNames = opts.colorNames ?? DEFAULT_COLOR_NAMES
  const cols = paletteTable(colorNames)
  const gl = gooContext(canvas)

  // ---------------- particles (struct of arrays) ----------------
  const X = new Float32Array(MAXP)
  const Y = new Float32Array(MAXP)
  const VX = new Float32Array(MAXP)
  const VY = new Float32Array(MAXP)
  const AX = new Float32Array(MAXP)
  const AY = new Float32Array(MAXP)
  const OX = new Float32Array(MAXP) // lattice offset inside the cell
  const OY = new Float32Array(MAXP)
  const PH = new Float32Array(MAXP) // idle wander phase
  const GS = new Float32Array(MAXP) // per-particle gravity share
  const DL = new Float32Array(MAXP) // hang delay
  const WT = new Float32Array(MAXP) // splat weight (fades on pop)
  const ZT = new Float32Array(MAXP) // time since pop
  const RX = new Float32Array(MAXP) // where it was popped
  const RY = new Float32Array(MAXP)
  const HX = new Float32Array(MAXP) // current home
  const HY = new Float32Array(MAXP)
  const UN = new Float32Array(MAXP) // unfilled 0..1
  const RD = new Float32Array(MAXP) // ready 0..1
  const ZG = new Int32Array(MAXP) // popped: the zap it belongs to (a ZapGroup id), or -1 = a quiet fade (popMs)
  const DZ = new Float32Array(MAXP) // zapped: distance from the laser point, 0 nearest … 1 farthest (nearest goes first)
  const EZ = new Float32Array(MAXP) // zapped: how far it's been sucked in (0 … 1) — it gets smaller as it goes
  const DR = new Float32Array(MAXP) // a spray droplet: its reach, × the splat reach
  const LF = new Float32Array(MAXP) // a spray droplet: seconds of life left, out of LZ
  const LZ = new Float32Array(MAXP)
  const GV = new Float32Array(MAXP) // a spray droplet: its gravity (cells / s²)
  const COL = new Uint8Array(MAXP)
  const ST = new Uint8Array(MAXP) // 0 dead, 1 bound to a cell, 2 popped (shrinking away / zapped), 3 a spray droplet (F67)
  const OWN = new Int32Array(MAXP) // >= 0: grid cell index; -1-k: falling-piece cell k
  const BA = new Int32Array(MAXB)
  const BB = new Int32Array(MAXB)
  const BR = new Float32Array(MAXB)
  const BL = new Uint8Array(MAXB)
  const SP = new Int32Array(MAXP * BS).fill(-1) // bond slots: partner, bond id
  const SB = new Int32Array(MAXP * BS).fill(-1)
  const alive = new Int32Array(MAXP)
  let nAlive = 0
  let hiP = 0
  let hiB = 0
  const freeP: number[] = []
  const freeB: number[] = []
  for (let i = MAXP - 1; i >= 0; i--) freeP.push(i)
  for (let i = MAXB - 1; i >= 0; i--) freeB.push(i)
  const OFFS: [number, number][] = []
  for (const j of [-1, 0, 1]) for (const i of [-1, 0, 1]) OFFS.push([i / 3, j / 3])

  let W = 0
  let H = 0
  let cellParts: (number[] | null)[] = []
  let pieceParts: number[][] | null = null
  let pieceHome = new Float32Array(16)
  // the pose's own part of each piece home (turn + spring offsets, no glide): the piece particles are carried along
  // with it, so the Jelly-style rotate swings the clumps round as one instead of tearing them apart
  let poseHome = new Float32Array(16)
  let prevPose = new Float32Array(16)
  let prevPoseOk = false
  let simT = 0
  let stepN = 0
  let simAcc = 0
  let time = 0
  let camera = 0
  let lastCamera = 0
  let spin = 0
  let dropped = false
  let fills = new Map<number, FillInfo>()
  const pose = new PiecePose()
  let zaps = new Map<number, ZapGroup>()
  let nextZap = 1
  let Z: ZapLook = zapLook() // zap.json as of this frame
  // F62 the goop's faces (rank 10+): one per engine group, riding the mean of its eye cells' particles
  const book = new FaceBook()
  let clumpFaces: Face[] = [] // the live clumps' faces
  let faceXY: number[] = [] // where each one's eyes are now (view cells): x, y pairs
  let faceGrid = new Uint8Array(0) // the grid + groups when the faces were last handed out
  let faceGroup = new Int32Array(0)
  let lastView: GooView | null = null
  let S: ShiftState | null = null

  // spatial hash (counting sort into 0.5-cell buckets), view space
  let HX0 = 0
  const HY0 = -12
  let NBX = 0
  let NBY = 0
  let bStart = new Int32Array(1)
  let bCount = new Int32Array(1)
  const BK = new Int32Array(MAXP)
  const sorted = new Int32Array(MAXP)

  const rand = Math.random // visual-only randomness (never touches the rules)

  function reset(state: ShiftState) {
    for (let i = 0; i < hiP; i++) if (ST[i]) killParticle(i)
    W = state.width
    H = state.height
    cellParts = new Array(W * H).fill(null)
    pieceParts = null
    zaps = new Map()
    book.clear()
    clumpFaces = []
    faceGrid = new Uint8Array(W * H)
    faceGroup = new Int32Array(W * H).fill(-1)
    pose.shape = null
    HX0 = -W / 2 - 2
    NBX = Math.ceil((W + 4) / HR)
    NBY = Math.ceil((H + 16) / HR)
    bStart = new Int32Array(NBX * NBY + 1)
    bCount = new Int32Array(NBX * NBY)
    if (state.piece) spawnPiece(state, 0)
  }

  function newParticle(c: number, owner: number, x: number, y: number, ox: number, oy: number): number {
    if (!freeP.length) return -1
    const i = freeP.pop()!
    X[i] = x
    Y[i] = y
    VX[i] = 0
    VY[i] = 0
    OX[i] = ox
    OY[i] = oy
    PH[i] = rand() * 6.283
    GS[i] = 0.8 + rand() * 0.4
    DL[i] = 0
    WT[i] = 1
    ZT[i] = 0
    UN[i] = 0
    RD[i] = 0
    COL[i] = c
    ST[i] = 1
    ZG[i] = -1
    OWN[i] = owner
    HX[i] = x
    HY[i] = y
    if (i >= hiP) hiP = i + 1
    return i
  }
  // 9 particles (3x3 lattice) around (cx, cy), starting `lift` cells higher
  function makeCell(c: number, owner: number, cx: number, cy: number, lift: number): number[] {
    const list: number[] = []
    for (const [ox, oy] of OFFS) {
      const jx = ox + (rand() - 0.5) * 0.04
      const jy = oy + (rand() - 0.5) * 0.04
      const i = newParticle(c, owner, cx + jx, cy + jy - lift - rand() * 0.1, jx, jy)
      if (i >= 0) {
        HX[i] = cx + jx
        HY[i] = cy + jy
        list.push(i)
      }
    }
    return list
  }
  function killBond(b: number) {
    for (const p of [BA[b], BB[b]])
      for (let s = p * BS; s < p * BS + BS; s++)
        if (SB[s] === b) {
          SB[s] = -1
          SP[s] = -1
        }
    BL[b] = 0
    freeB.push(b)
  }
  function killParticle(i: number) {
    for (let s = i * BS; s < i * BS + BS; s++) if (SB[s] >= 0) killBond(SB[s])
    ST[i] = 0
    freeP.push(i)
  }
  function tryBond(i: number, j: number, d: number) {
    let si = -1
    let sj = -1
    for (let s = i * BS; s < i * BS + BS; s++) {
      if (SP[s] === j) return
      if (SP[s] < 0 && si < 0) si = s
    }
    if (si < 0) return
    for (let s = j * BS; s < j * BS + BS; s++)
      if (SP[s] < 0) {
        sj = s
        break
      }
    if (sj < 0 || !freeB.length) return
    const b = freeB.pop()!
    BA[b] = i
    BB[b] = j
    BR[b] = d
    BL[b] = 1
    if (b >= hiB) hiB = b + 1
    SP[si] = j
    SB[si] = b
    SP[sj] = i
    SB[sj] = b
  }

  // ---------------- goo that leaves without a zap (a swapped-out piece, cells gone without a pop event) ----------------
  // Quiet: it lets go of its cells, shrinks toward its middle and fades out over popMs. No burst.
  function popList(list: number[]) {
    for (const i of list) {
      if (ST[i] !== 1) continue
      ST[i] = 2
      ZG[i] = -1
      ZT[i] = 0
      RX[i] = X[i]
      RY[i] = Y[i]
      UN[i] = 0
    }
  }
  function popStep(i: number, h: number) {
    const z = ZG[i] >= 0 ? zaps.get(ZG[i]) : undefined
    if (z) {
      zapStep(i, z)
      return
    }
    ZT[i] += h
    const T = Math.max(0.05, K.popMs / 1000)
    WT[i] = Math.max(0, 1 - ZT[i] / T) ** 1.5
    // drift a touch toward where it was, heavily damped: it sinks into itself rather than flying anywhere
    AX[i] = (RX[i] - X[i]) * 40 - VX[i] * 12
    AY[i] = (RY[i] - Y[i]) * 40 - VY[i] * 12 + 3
  }

  // ---------------- THE ZAP (F67): the same timeline as Jelly ----------------
  // The zapped cells' particles heat (white-hot + swell), then each is pulled into the laser point, nearest first,
  // fading at the end; the spray is a burst of droplet particles in the goop's colour. `at` = where the zap hit.
  function zapCells(cells: number[], color: number, at: { x: number; y: number } | undefined) {
    // F62: its face (if its eyes are showing) goes with it, squeezed shut; the clumps touching it squeeze theirs
    const face = book.on ? book.faceOf(cells[0]) ?? null : null
    if (face) spotNow(face)
    const [fx0, fy0] = SPOT
    book.shutAround(cells, W, H)
    const members: number[] = []
    for (const ci of cells) {
      const l = cellParts[ci]
      if (l) for (const i of l) if (ST[i] === 1) members.push(i)
      cellParts[ci] = null
    }
    if (!members.length) return
    let c0x = 0
    let c0y = 0
    for (const i of members) {
      c0x += X[i]
      c0y += Y[i]
    }
    c0x /= members.length
    c0y /= members.length
    // the laser point in view cells, on the copy of the cylinder nearest the goop (no tap point: its middle)
    let lx = c0x
    let ly = c0y
    if (at) {
      const x0 = screenColumn(at.x - 0.5, lastCamera, W) // (the particles sit where last frame's camera put them)
      lx = x0 + Math.round((c0x - x0) / W) * W
      ly = at.y
    }
    const z: ZapGroup = { id: nextZap++, t: 0, lx, ly, c0x, c0y, color, members, sprayed: false, hot: 0, fade: 1, suck: 0,
      face: face && face.eyes.a > 0 ? face : null, fx0, fy0 }
    let dmax = 1e-3
    for (const i of members) {
      ST[i] = 2
      ZG[i] = z.id
      RX[i] = X[i]
      RY[i] = Y[i]
      UN[i] = 0
      DZ[i] = Math.hypot(X[i] - lx, Y[i] - ly)
      dmax = Math.max(dmax, DZ[i])
    }
    for (const i of members) DZ[i] /= dmax
    zaps.set(z.id, z)
  }
  // pulled toward its spot on the timeline: swollen by the heat, then into the laser point
  function zapStep(i: number, z: ZapGroup) {
    const grow = 1 + Z.swell * z.hot
    const e = suckIn(Z, z.t, DZ[i])
    EZ[i] = e
    const tx = z.lx + (z.c0x + (RX[i] - z.c0x) * grow - z.lx) * (1 - e)
    const ty = z.ly + (z.c0y + (RY[i] - z.c0y) * grow - z.ly) * (1 - e)
    WT[i] = z.fade
    AX[i] = (tx - X[i]) * 900 - VX[i] * 40
    AY[i] = (ty - Y[i]) * 900 - VY[i] * 40
  }
  // once a frame: each zap's clock, heat, fade and spray; a finished zap's particles go
  function stepZaps(dt: number) {
    const end = zapEnd(Z)
    for (const z of zaps.values()) {
      z.t += dt
      z.hot = zapHeat(Z, z.t)
      let em = 0
      let n = 0
      for (const i of z.members)
        if (ST[i] === 2 && ZG[i] === z.id) {
          em += suckIn(Z, z.t, DZ[i])
          n++
        }
      z.suck = n ? em / n : 1
      z.fade = n ? zapFade(z.suck) : 0
      if (!z.sprayed && sprayDue(Z, z.t)) {
        z.sprayed = true
        const xs: number[] = []
        const ys: number[] = []
        for (const i of z.members) if (ST[i] === 2 && ZG[i] === z.id) {
          xs.push(X[i])
          ys.push(Y[i])
        }
        for (const d of sprayDrops(Z, xs, ys)) {
          const i = newParticle(z.color, -1, d.x, d.y, 0, 0)
          if (i < 0) break
          ST[i] = 3
          VX[i] = d.vx
          VY[i] = d.vy
          DR[i] = (0.7 * d.r) / DROP_R // (a lone particle splats a little bigger than a jelly drop of the same radius)
          LF[i] = d.life
          LZ[i] = Z.dropLife
          GV[i] = d.g
        }
      }
      if (z.t >= end && z.sprayed) {
        for (const i of z.members) if (ST[i] === 2 && ZG[i] === z.id) killParticle(i)
        zaps.delete(z.id)
      }
    }
  }
  // a spray droplet: flies under its own gravity, shrinks and fades over its life (v1), bounces off the floor
  function dropStep(i: number, h: number) {
    LF[i] -= h
    WT[i] = Math.max(0, LF[i] / Math.max(0.05, LZ[i]))
    AX[i] = 0
    AY[i] = GV[i]
    if (LF[i] <= 0) WT[i] = 0
  }

  // ---------------- F62 THE FACES (src/goo/shared/faces.ts has the rules; this places them on the particles) ----------------
  // Where a face's eyes are now (view cells): the middle of its eye cells' particles — so they ride the goo as it
  // wobbles and falls — or, with none there (off screen), the cells' own middle. Into SPOT.
  const SPOT = [0, 0]
  function spotNow(f: Face) {
    let sx = 0
    let sy = 0
    let n = 0
    for (let k = 0; k < 2; k++) { // spotA, then spotB if there is one (no array a frame)
      const c = k === 0 ? f.spotA : f.spotB
      const l = c >= 0 ? cellParts[c] : undefined
      if (l) for (const i of l) if (ST[i] === 1) { sx += X[i]; sy += Y[i]; n++ }
    }
    if (n) {
      SPOT[0] = sx / n
      SPOT[1] = sy / n
    } else {
      SPOT[0] = screenColumn(f.spotA % W, camera, W) + (f.spotB >= 0 ? 0.5 : 0)
      SPOT[1] = Math.floor(f.spotA / W) + 0.5
    }
  }

  // hand each engine group its face (when the grid or the groups change, or faces just switched on)
  function assignFaces(state: ShiftState) {
    book.begin()
    clumpFaces = []
    for (const g of state.groups.values()) {
      if (!g.cells.length) continue
      const U = unwrapCells(g.cells, W)
      clumpFaces.push(book.faceFor(g.cells, U.ux, U.uy))
    }
    book.end()
    faceXY = new Array(clumpFaces.length * 2).fill(0)
    faceGrid.set(state.grid)
    faceGroup.set(state.groupOf)
  }
  function facesStale(state: ShiftState): boolean {
    if (!book.built) return true
    for (let i = 0; i < state.grid.length; i++) if (state.grid[i] !== faceGrid[i] || state.groupOf[i] !== faceGroup[i]) return true
    return false
  }

  function stepFaces(dt: number) {
    clumpFaces.forEach((f, k) => {
      spotNow(f)
      faceXY[k * 2] = SPOT[0]
      faceXY[k * 2 + 1] = SPOT[1]
      book.step(f, SPOT[0], SPOT[1], dt)
    })
  }

  // a zapped clump's face: its spot pulled into the laser point with the goop (zapStep's own sum) + its size, into SPOT
  function dyingSpot(z: ZapGroup): number {
    const grow = 1 + Z.swell * z.hot
    const keep = 1 - z.suck
    SPOT[0] = z.lx + (z.c0x + (z.fx0 - z.c0x) * grow - z.lx) * keep
    SPOT[1] = z.ly + (z.c0y + (z.fy0 - z.c0y) * grow - z.ly) * keep
    return Math.max(0.05, grow * keep)
  }

  // ---------------- the falling piece ----------------
  function pieceHomes() {
    const s = pose.shape
    if (!s) return
    if (pieceHome.length < s.ux.length * 2) {
      pieceHome = new Float32Array(s.ux.length * 2)
      poseHome = new Float32Array(s.ux.length * 2)
      prevPose = new Float32Array(s.ux.length * 2)
      prevPoseOk = false
    }
    const ca = Math.cos(pose.a)
    const sa = Math.sin(pose.a)
    for (let k = 0; k < s.ux.length; k++) {
      const rx = s.ux[k] + 0.5 - s.cx
      const ry = s.uy[k] + 0.5 - s.cy
      const [hx, hy] = pose.viewRel(rx, ry, spin, W)
      pieceHome[k * 2] = hx
      pieceHome[k * 2 + 1] = hy
      poseHome[k * 2] = ca * rx - sa * ry + pose.x
      poseHome[k * 2 + 1] = sa * rx + ca * ry + pose.y
    }
  }
  function carryPiece() {
    if (!pieceParts || !pose.shape) return
    const n = pose.shape.ux.length
    if (prevPoseOk && pieceParts.length === n)
      for (let k = 0; k < n; k++) {
        const dx = poseHome[k * 2] - prevPose[k * 2]
        const dy = poseHome[k * 2 + 1] - prevPose[k * 2 + 1]
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) continue // a jump (new shape): leave it to the springs
        for (const i of pieceParts[k]) {
          X[i] += dx
          Y[i] += dy
        }
      }
    prevPose.set(poseHome.subarray(0, n * 2))
    prevPoseOk = true
  }
  function spawnPiece(state: ShiftState, lift: number) {
    const p = state.piece!
    if (pieceParts) for (const l of pieceParts) popList(l) // a swapped-out piece fades away
    pose.spawn(p, W, state.spin, 0)
    prevPoseOk = false
    pieceHomes()
    pieceParts = p.cells.map((_, k) => makeCell(p.colors[k] ?? p.colors[0] ?? 1, -1 - k, pieceHome[k * 2], pieceHome[k * 2 + 1], lift))
  }
  // After a rotate the cells are listed in a new order: hand each new cell the particle clump nearest its (lagged) home
  function reassignPiece() {
    if (!pieceParts || !pose.shape) return
    prevPoseOk = false
    pieceHomes()
    const left = pieceParts.slice()
    const out: number[][] = []
    for (let k = 0; k < pose.shape.ux.length; k++) {
      let best = 0
      let bd = 1e9
      left.forEach((l, j) => {
        let cx = 0
        let cy = 0
        for (const i of l) {
          cx += X[i]
          cy += Y[i]
        }
        const n = Math.max(1, l.length)
        const d = (cx / n - pieceHome[k * 2]) ** 2 + (cy / n - pieceHome[k * 2 + 1]) ** 2
        if (d < bd) {
          bd = d
          best = j
        }
      })
      const l = left.splice(best, 1)[0] ?? []
      for (const i of l) OWN[i] = -1 - k
      out.push(l)
    }
    pieceParts = out
  }
  // Lock: which clump goes to which grid cell? Match the locked cells to the piece's cells by shape.
  function lockPiece(cells: number[]) {
    if (!pieceParts) return
    const s = pose.shape
    const lx = cells.map((c) => c % W)
    const ly = cells.map((c) => Math.floor(c / W))
    const ux = lx.map((x) => lx[0] + wrapNear(x - lx[0], W))
    const key = (x: number, y: number) => x + ',' + y
    let order: number[] = cells.map((_, k) => k)
    if (s && s.ux.length === cells.length) {
      const mx = Math.min(...ux)
      const my = Math.min(...ly)
      const smx = Math.min(...s.ux)
      const smy = Math.min(...s.uy)
      const at = new Map<string, number>()
      s.ux.forEach((x, k) => at.set(key(x - smx, s.uy[k] - smy), k))
      const m = cells.map((_, j) => at.get(key(ux[j] - mx, ly[j] - my)))
      if (m.every((v) => v !== undefined)) order = m as number[]
    }
    cells.forEach((ci, j) => {
      const list = pieceParts![order[j]] ?? []
      for (const i of list) OWN[i] = ci
      const prev = cellParts[ci]
      if (prev) for (const i of prev) if (ST[i]) killParticle(i) // safety (should not happen)
      cellParts[ci] = list
    })
    const thump = !dropped
    dropped = false
    const mine = new Set(cells)
    if (thump)
      for (const ci of cells) {
        // landing thump: the piece squashes outward, neighbours wobble
        for (const i of cellParts[ci] ?? []) {
          VY[i] += 2.2 * K.wobble
          VX[i] += OX[i] * 5 * K.wobble
        }
        const x = ci % W
        const y = Math.floor(ci / W)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy
            if (ny < 0 || ny >= H) continue
            const ni = ny * W + ((x + dx + W) % W)
            if (mine.has(ni) || !cellParts[ni]) continue
            for (const i of cellParts[ni]!) VY[i] += 1.2 * K.wobble
          }
      }
    pieceParts = null
  }

  // A poke: the poked cell squashes outward like a small landing thump, and a ripple runs through the rest of its
  // cluster, weaker the farther each cell is (cells away, around the cylinder the short way).
  function poke(cell: number, state: ShiftState) {
    const w = K.wobble * K.poke
    const px = cell % W, py = Math.floor(cell / W)
    const group = state.groups.get(state.groupOf[cell])
    for (const ci of group?.cells ?? [cell]) {
      let dx = Math.abs((ci % W) - px)
      dx = Math.min(dx, W - dx)
      const far = Math.hypot(dx, Math.floor(ci / W) - py)
      const fall = 1 / (1 + far) // 1 at the poked cell, ½ next to it…
      for (const i of cellParts[ci] ?? []) {
        VY[i] += 75 * w * fall
        VX[i] += OX[i] * 150 * w * fall
      }
    }
  }

  // ---------------- events from the engine -> particles ----------------
  function handle(events: ShiftEvent[], state: ShiftState) {
    let lastSwap = -1
    events.forEach((e, i) => {
      if (e.type === 'lock' || e.type === 'spawn') lastSwap = i
    })
    events.forEach((e, i) => {
      const p = state.piece
      switch (e.type) {
        case 'spawn':
          if (i === lastSwap && p) spawnPiece(state, 1.4)
          break
        case 'move':
          if (i > lastSwap && p) pose.reshape(p, W, state.spin, 0)
          break
        case 'rotate':
          if (i > lastSwap && p) {
            pose.reshape(p, W, state.spin, e.dir)
            reassignPiece()
          }
          break
        case 'drop': {
          // hard drop: the bottom lets go first, the top hangs a moment -> the piece stretches as it falls
          if (!pieceParts || e.rows < 1) break
          let bottom = -1e9
          for (const l of pieceParts) for (const i of l) bottom = Math.max(bottom, Y[i])
          for (const l of pieceParts)
            for (const i of l) {
              DL[i] = (bottom - Y[i]) * 0.07
              GS[i] = 0.85 + rand() * 0.35
            }
          dropped = true
          break
        }
        case 'lock':
          lockPiece(e.cells)
          break
        case 'reject': // a zap on goop that can't pop yet pokes it (Muzzy 2026-10-18)
          if (e.cell !== undefined && K.poke) poke(e.cell, state)
          break
        case 'pop':
          zapCells(e.cells, e.color, e.at)
          break
        case 'fall': {
          book.moveCells(e.moves) // (falling clumps keep their faces)
          const moved = e.moves.map(([f, t]) => [f, t, cellParts[f]] as const)
          for (const [f] of moved) cellParts[f] = null
          for (const [, t, list] of moved)
            if (list) {
              cellParts[t] = list
              for (const i of list) {
                OWN[i] = t
                DL[i] = rand() * 0.05
              }
            }
          break
        }
      }
    })
  }

  // ---------------- simulation ----------------
  let formBonds = false
  let cohK = 0
  let viscK = 0
  function pair(i: number, j: number) {
    const dx = X[j] - X[i]
    const dy = Y[j] - Y[i]
    const d2 = dx * dx + dy * dy
    if (d2 >= HR * HR || d2 < 1e-10) return
    const zi = ST[i] >= 2 // (popped goo and spray droplets)
    const zj = ST[j] >= 2
    if (zi !== zj) return // popped goo slides past live goo
    // zapped goo is pulled into one point (no push-apart to fight it); spray droplets fly through everything
    if (zi && (ZG[i] >= 0 || ZG[j] >= 0 || ST[i] === 3 || ST[j] === 3)) return
    const same = COL[i] === COL[j]
    const d = Math.sqrt(d2)
    const nx = dx / d
    const ny = dy / d
    const q = d / HR
    let f = 0 // + = push apart
    if (d < R0) f += KREP * (1 - d / R0) * (zi ? Math.min(WT[i], WT[j]) : 1)
    if (same) {
      if (q > 0.6) f -= cohK * (q - 0.6) * (1 - q) // surface tension: same colours pull together
      const u = (VX[i] - VX[j]) * nx + (VY[i] - VY[j]) * ny // viscosity: neighbours share velocity
      const I = viscK * (1 - q) * u
      AX[i] -= I * nx
      AY[i] -= I * ny
      AX[j] += I * nx
      AY[j] += I * ny
      if (formBonds && d < MAKE && !zi) {
        // sticky bond: lattice neighbours
        const hs = Math.hypot(HX[j] - HX[i], HY[j] - HY[i])
        if (hs < 0.55) tryBond(i, j, hs)
      }
    } else if (d < RSEP) f += SEP * (1 - d / RSEP) // other colours: a slight push -> clean seam
    AX[i] -= f * nx
    AY[i] -= f * ny
    AX[j] += f * nx
    AY[j] += f * ny
  }

  const strandSnap = () => 0.35 + 0.75 * K.tension // strings snap past this (cells): 0 -> 0.35, 1 -> 1.1, 3 -> 2.6

  // Magnetism: strongest pull on particle i toward a same-colour cell (square of half-size 0.45) of another group
  function magnet(i: number, k: number, state: ShiftState) {
    const M = K.magnetism
    if (M <= 0) return
    const reach = 0.25 + 0.5 * M
    const pull = k * 0.3 * M
    const c = COL[i]
    const o = OWN[i]
    const mine = o >= 0 ? state.groupOf[o] : -2
    let best = 0
    let bx = 0
    let by = 0
    const test = (cx: number, cy: number) => {
      const qx = Math.max(cx - 0.45, Math.min(cx + 0.45, X[i]))
      const qy = Math.max(cy - 0.45, Math.min(cy + 0.45, Y[i]))
      const dx = qx - X[i]
      const dy = qy - Y[i]
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < 1e-4 || d >= reach) return
      const a = pull * (1 - d / reach)
      if (a > best) {
        best = a
        bx = dx / d
        by = dy / d
      }
    }
    const x0 = Math.round(X[i]) // view column offset of the nearest cell centre
    const y0 = Math.floor(Y[i])
    const rr = Math.ceil(reach) + 1
    for (let y = Math.max(0, y0 - rr); y <= Math.min(H - 1, y0 + rr); y++)
      for (let dxc = -rr; dxc <= rr; dxc++) {
        const vx = x0 + dxc
        const col = (((Math.round(camera) + vx) % W) + W) % W
        const n = y * W + col
        if (state.grid[n] !== c || state.groupOf[n] === mine) continue
        test(screenColumn(col, camera, W), y + 0.5)
      }
    const p = state.piece
    if (o >= 0 && p && pose.shape) for (let q = 0; q < p.cells.length; q++) if (p.colors[q] === c) test(pieceHome[q * 2], pieceHome[q * 2 + 1])
    AX[i] += best * bx
    AY[i] += best * by
  }

  function simStep(h: number, state: ShiftState) {
    simT += h
    stepN++
    pose.integrate(h)
    pieceHomes()
    carryPiece()
    nAlive = 0
    for (let i = 0; i < hiP; i++) if (ST[i]) alive[nAlive++] = i
    // hash
    bCount.fill(0)
    for (let n = 0; n < nAlive; n++) {
      const i = alive[n]
      const bx = Math.min(NBX - 1, Math.max(0, Math.floor((X[i] - HX0) / HR)))
      const by = Math.min(NBY - 1, Math.max(0, Math.floor((Y[i] - HY0) / HR)))
      const b = by * NBX + bx
      BK[i] = b
      bCount[b]++
    }
    let acc = 0
    for (let b = 0; b < NBX * NBY; b++) {
      bStart[b] = acc
      acc += bCount[b]
    }
    bStart[NBX * NBY] = acc
    bCount.fill(0)
    for (let n = 0; n < nAlive; n++) {
      const i = alive[n]
      const b = BK[i]
      sorted[bStart[b] + bCount[b]++] = i
    }

    // single-particle forces: home spring, gravity, drag
    const g = K.gravity / CELL_M
    const k = K.stiffness
    const cd = 2 * (0.05 + K.viscosity * 0.7) * Math.sqrt(k)
    const wob = K.wobble * 0.045
    const capX = k * 1.5
    const capDown = k * 0.35
    for (let n = 0; n < nAlive; n++) {
      const i = alive[n]
      if (ST[i] === 2) {
        popStep(i, h)
        continue
      }
      if (ST[i] === 3) {
        dropStep(i, h)
        continue
      }
      let ax = 0
      let ay = 0
      const o = OWN[i]
      let cx: number
      let cy: number
      if (o >= 0) {
        cx = screenColumn(o % W, camera, W)
        cy = Math.floor(o / W) + 0.5
      } else {
        cx = pieceHome[(-1 - o) * 2]
        cy = pieceHome[(-1 - o) * 2 + 1]
      }
      const hx = cx + OX[i] + wob * Math.sin(simT * 1.3 + PH[i])
      const hy = cy + OY[i] + wob * Math.cos(simT * 1.1 + PH[i] * 1.7)
      HX[i] = hx
      HY[i] = hy
      const dx = hx - X[i]
      const dy = hy - Y[i]
      ax = Math.max(-capX, Math.min(capX, k * dx))
      if (DL[i] > 0) {
        DL[i] -= h
        ay = 0 // hanging a moment
      } else if (dy > 0) ay = Math.min(k * dy, capDown) + g * GS[i] * Math.min(dy / 0.5, 1) // above home: gravity does the falling
      else ay = Math.max(-capX, k * dy) // below home (overshoot): spring back up
      const near = 1 / (1 + (dx * dx + dy * dy) * 4) // no damping while far away (free fall)
      ax -= cd * VX[i] * near
      ay -= cd * VY[i] * near
      if (dy < 0 && VY[i] > 0) ay -= K.landing * VY[i] // landing: soak up the overshoot (squash, not splash)
      if (VY[i] > K.maxFall) VY[i] = K.maxFall // terminal speed
      AX[i] = ax
      AY[i] = ay
      magnet(i, k, state)
    }

    // neighbour forces (each pair once: same bucket + 4 forward buckets)
    cohK = 60
    viscK = 2 + K.viscosity * 30
    formBonds = stepN % 3 === 0
    for (let by = 0; by < NBY; by++)
      for (let bx = 0; bx < NBX; bx++) {
        const b = by * NBX + bx
        const s0 = bStart[b]
        const e0 = bStart[b + 1]
        if (s0 === e0) continue
        for (let a = s0; a < e0; a++) {
          const i = sorted[a]
          for (let c = a + 1; c < e0; c++) pair(i, sorted[c])
          if (bx + 1 < NBX) {
            const nb = b + 1
            for (let c = bStart[nb]; c < bStart[nb + 1]; c++) pair(i, sorted[c])
          }
          if (by + 1 < NBY)
            for (let ox = -1; ox <= 1; ox++) {
              const nbx = bx + ox
              if (nbx < 0 || nbx >= NBX) continue
              const nb = b + NBX + ox
              for (let c = bStart[nb]; c < bStart[nb + 1]; c++) pair(i, sorted[c])
            }
        }
      }

    // bonds: between bound neighbours a jelly spring (rest = home spacing) so the group holds its grid shape and
    // jiggles as one. When the homes separate the bond goes plastic: a honey strand that stretches, thins and snaps.
    const KJ = k * 0.9 + 10
    const KS = 15 + K.tension * 25
    const SNAP = strandSnap()
    const creep = 1.2 / (1 + K.tension)
    for (let b = 0; b < hiB; b++) {
      if (!BL[b]) continue
      const i = BA[b]
      const j = BB[b]
      if (ST[i] !== 1 || ST[j] !== 1) {
        killBond(b) // popped goo lets go of everything
        continue
      }
      const dx = X[j] - X[i]
      const dy = Y[j] - Y[i]
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-6
      let kb = KS
      let jelly = false
      const hs = Math.hypot(HX[j] - HX[i], HY[j] - HY[i])
      if (hs < 0.55) {
        BR[b] = hs
        kb = KJ
        jelly = true // jelly: hold the shape
      } else if (Math.abs(d - BR[b]) > 0.06) BR[b] += (d - BR[b]) * Math.min(1, creep * h) // strand: creep
      if (d > (jelly ? K.snap : SNAP)) {
        killBond(b) // strings snap at the tension length
        continue
      }
      const f = kb * (d - BR[b])
      const nx = dx / d
      const ny = dy / d
      AX[i] += f * nx
      AY[i] += f * ny
      AX[j] -= f * nx
      AY[j] -= f * ny
    }

    // integrate + tank floor (no side walls: the tank is a cylinder)
    for (let n = 0; n < nAlive; n++) {
      const i = alive[n]
      VX[i] += AX[i] * h
      VY[i] += AY[i] * h
      X[i] += VX[i] * h
      Y[i] += VY[i] * h
      if (Y[i] > H - RP) {
        Y[i] = H - RP
        if (VY[i] > 0) VY[i] *= -0.4
        VX[i] *= 0.9
      }
      if ((ST[i] === 2 && ZG[i] < 0 && WT[i] < 0.03) || (ST[i] === 3 && LF[i] <= 0)) killParticle(i) // (a zap's own go in stepZaps)
    }
  }

  // keep particles in step with the grid, only near the screen
  function syncCells(state: ShiftState) {
    for (let ci = 0; ci < W * H; ci++) {
      const c = state.grid[ci]
      const list = cellParts[ci]
      const near = inWindow(screenColumn(ci % W, camera, W), state.visibleWidth, K.margin)
      if (list && (!near || !c || COL[list[0]] !== c)) {
        if (near && !c) popList(list) // vanished without a pop event: fade it out
        else for (const i of list) if (ST[i]) killParticle(i)
        cellParts[ci] = null
      }
      if (c && near && !cellParts[ci]) cellParts[ci] = makeCell(c, ci, screenColumn(ci % W, camera, W), Math.floor(ci / W) + 0.5, 0)
    }
    // unfilled / ready per particle, from its group's fill level
    for (let ci = 0; ci < W * H; ci++) {
      const list = cellParts[ci]
      if (!list) continue
      const f = fills.get(state.groupOf[ci])
      const filling = !!f && f.fill < 0.999
      const row = Math.floor(ci / W) + 0.5
      for (const i of list) {
        UN[i] = filling ? Math.max(0, Math.min(1, (f!.line - (row + OY[i])) / 0.25 + 0.5)) : 0
        RD[i] = f && f.ready ? 1 : 0
      }
    }
  }

  function update(state: ShiftState, events: ShiftEvent[], view: GooView, dt: number) {
    if (state.width !== W || state.height !== H) reset(state)
    lastCamera = camera
    camera = view.camera
    spin = state.spin
    fills = groupFillLines(state)
    Z = zapLook(view.still)
    book.frame(view.story, dt, (x) => screenColumn(x, camera, W))
    lastView = view
    S = state
    handle(events, state)
    if (!state.piece && pieceParts) {
      for (const l of pieceParts) popList(l)
      pieceParts = null
    }
    if (state.piece && (pose.swapped(state.piece, W) || !pieceParts)) spawnPiece(state, 0) // hold swap / missed spawn
    if (state.piece) pose.follow(state.piece, W, spin)
    syncCells(state)
    // popped goo rides with the tank as it spins; locked goo rides part of each turn at once (spinCarry), so it sloshes
    // behind less (Muzzy 2026-10-18: "50% less"). The falling piece's goo (OWN < 0) isn't on the tank: left alone.
    const dcam = wrapNear(camera - lastCamera, W)
    if (dcam)
      for (let i = 0; i < hiP; i++)
        if (ST[i] === 2) {
          X[i] -= dcam
          RX[i] -= dcam
        } else if (ST[i] === 3) X[i] -= dcam
        else if (ST[i] === 1 && OWN[i] >= 0) X[i] -= dcam * (K.spinCarry ?? 0)
    if (dcam)
      for (const z of zaps.values()) {
        z.lx -= dcam
        z.c0x -= dcam
        z.fx0 -= dcam
      }
    stepZaps(dt)
    simAcc = Math.min(simAcc + dt, SIM_DT * 4)
    while (simAcc >= SIM_DT) {
      simStep(SIM_DT, state)
      simAcc -= SIM_DT
    }
    if (book.on) {
      if (facesStale(state)) assignFaces(state)
      stepFaces(dt)
    }
  }

  // ---------------- WebGL ----------------
  const floatOK = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))
  const WSCALE = floatOK ? 1 : 0.25
  const splatP: Program = makeProgram(gl, SPLAT_VS, SPLAT_FS, ['uFieldRes', 'uOrigin', 'uCell', 'uWS'])
  const blurP: Program = makeProgram(gl, FULLSCREEN_VS, BLUR_FS, ['uT0', 'uT1', 'uT2', 'uStep', 'uSigma', 'uOut', 'uTaps'])
  const shadeP: Program = makeProgram(gl, FULLSCREEN_VS, SHADE_FS, [
    'uT0', 'uT1', 'uT2', 'uW0', 'uW1', 'uW2', 'uRes', 'uOrigin', 'uCell', 'uScale', 'uTh', 'uWet', 'uBulge', 'uAbsorb',
    'uFres', 'uTrans', 'uTime', 'uUnA', 'uUnDim', 'uGlow', 'uPulse', 'uClipL', 'uClipR', 'uClipB', 'uCols', 'uWhite', ...XRAY_UNIFORMS, ...WILD_UNIFORMS,
  ])
  const xrayBuf = new Float32Array(XRAY_MAX * 4)
  const faceDraw = new FaceDrawer(gl) // F62
  const emptyVAO = gl.createVertexArray()!
  const splatVAO = gl.createVertexArray()!
  gl.bindVertexArray(splatVAO)
  const quadBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const instData = new Float32Array((MAXP + MAXB) * INST)
  const instBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf)
  gl.bufferData(gl.ARRAY_BUFFER, instData.byteLength, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, INST * 4, 0)
  gl.vertexAttribDivisor(1, 1)
  gl.enableVertexAttribArray(2)
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, INST * 4, 16)
  gl.vertexAttribDivisor(2, 1)
  gl.enableVertexAttribArray(3)
  gl.vertexAttribPointer(3, 3, gl.FLOAT, false, INST * 4, 28)
  gl.vertexAttribDivisor(3, 1)
  gl.bindVertexArray(null)

  let fA: Target | null = null
  let fB: Target | null = null
  let fC: Target | null = null
  let fQ: Target | null = null
  let fw = 1
  let fh = 1
  let qw = 1
  let qh = 1
  function resizeTargets() {
    for (const T of [fA, fB, fC, fQ]) freeTarget(gl, T)
    fw = Math.max(1, Math.ceil(canvas.width / 2))
    fh = Math.max(1, Math.ceil(canvas.height / 2))
    qw = Math.max(1, Math.ceil(fw / 2))
    qh = Math.max(1, Math.ceil(fh / 2))
    fA = makeTarget(gl, fw, fh, 3, floatOK)
    fB = makeTarget(gl, fw, fh, 3, floatOK)
    fC = makeTarget(gl, qw, qh, 3, floatOK)
    fQ = makeTarget(gl, qw, qh, 3, floatOK)
  }

  function fillInstances(clipL: number, clipR: number): number {
    let n = 0
    const R = K.splat
    const put = (x0: number, y0: number, x1: number, y1: number, r: number, w: number, c: number, un: number, rd: number, hot = 0) => {
      const o = n * INST
      instData[o] = x0
      instData[o + 1] = y0
      instData[o + 2] = x1
      instData[o + 3] = y1
      instData[o + 4] = r
      instData[o + 5] = w
      instData[o + 6] = c
      instData[o + 7] = un
      instData[o + 8] = rd
      instData[o + 9] = hot
      n++
    }
    for (let i = 0; i < hiP; i++) {
      if (!ST[i] || X[i] < clipL - 1 || X[i] > clipR + 1) continue
      // popped: shrinks as it fades; a spray droplet: its own size, shrinking over its life (v1); zapped: white-hot
      const z = ST[i] === 2 && ZG[i] >= 0 ? zaps.get(ZG[i]) : undefined
      const r = ST[i] === 3 ? R * DR[i] * (0.6 + 0.4 * WT[i]) : ST[i] === 2 ? R * (0.55 + 0.45 * WT[i]) * (z ? 1 - 0.6 * EZ[i] : 1) : R
      put(X[i], Y[i], X[i], Y[i], r, ST[i] === 3 ? Math.min(1, WT[i] * 1.4) : WT[i], gooSlot(COL[i]), UN[i], RD[i], z ? z.hot : 0) // (F39: wild → slot 8, its own channel)
    }
    const L0 = 0.42
    const span = Math.max(0.1, strandSnap() - L0)
    for (let b = 0; b < hiB; b++) {
      // stretched bonds become strings: thinner and weaker the closer they get to snapping
      if (!BL[b]) continue
      const i = BA[b]
      const j = BB[b]
      const d = Math.hypot(X[j] - X[i], Y[j] - Y[i])
      if (d <= L0) continue
      const s = Math.min(1, (d - L0) / span)
      const w = Math.min(WT[i], WT[j], 1) * Math.min(1, (d - L0) * 8) * 1.3 * Math.pow(1 - s, 0.6)
      if (w < 0.02) continue
      put(X[i], Y[i], X[j], Y[j], R * 0.6 * (1 - 0.4 * s), w, gooSlot(COL[i]), Math.min(UN[i], UN[j]), Math.min(RD[i], RD[j]))
    }
    return n
  }

  function blurPass(src: Target, dst: Target, w: number, h: number, sx: number, sy: number) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb)
    gl.viewport(0, 0, w, h)
    for (let t = 0; t < 3; t++) {
      gl.activeTexture(gl.TEXTURE0 + t)
      gl.bindTexture(gl.TEXTURE_2D, src.t[t])
    }
    gl.uniform2f(blurP.u.uStep, sx, sy)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function draw(state: ShiftState, view: GooView) {
    const dpr = Math.min(view.dpr || 1, K.maxDpr)
    if (fitCanvas(canvas, view.width, view.height, dpr) || !fA) resizeTargets()
    const [clipL, clipR] = tankWindow(state.visibleWidth)
    const n = fillInstances(clipL, clipR)
    const [ox, oy] = viewOrigin(view, state.bufferRows)
    const cell = view.cellPx * dpr
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.STENCIL_TEST)
    gl.disable(gl.SCISSOR_TEST)
    gl.colorMask(true, true, true, true)
    // 1) splat into the half-res per-colour field
    gl.bindFramebuffer(gl.FRAMEBUFFER, fA!.fb)
    gl.viewport(0, 0, fw, fh)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.useProgram(splatP.p)
    gl.bindVertexArray(splatVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instData, 0, n * INST)
    gl.uniform2f(splatP.u.uFieldRes, fw, fh)
    gl.uniform2f(splatP.u.uOrigin, (ox * dpr) / 2, (oy * dpr) / 2)
    gl.uniform1f(splatP.u.uCell, cell / 2)
    gl.uniform1f(splatP.u.uWS, WSCALE)
    if (n) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n)
    gl.disable(gl.BLEND)
    // 2) light blur (A -> B -> A)
    gl.bindVertexArray(emptyVAO)
    gl.useProgram(blurP.p)
    gl.uniform1i(blurP.u.uT0, 0)
    gl.uniform1i(blurP.u.uT1, 1)
    gl.uniform1i(blurP.u.uT2, 2)
    if (K.blur > 0.005) {
      gl.uniform1f(blurP.u.uSigma, (K.blur * cell) / 2)
      gl.uniform2f(blurP.u.uOut, fw, fh)
      gl.uniform1i(blurP.u.uTaps, 4)
      blurPass(fA!, fB!, fw, fh, 1 / fw, 0)
      blurPass(fB!, fA!, fw, fh, 0, 1 / fh)
    }
    // 2b) wide blur (A -> Q -> C, quarter res) for the group-scale dome
    gl.uniform1f(blurP.u.uSigma, (K.dome * cell) / 2)
    gl.uniform2f(blurP.u.uOut, qw, qh)
    gl.uniform1i(blurP.u.uTaps, 12)
    blurPass(fA!, fQ!, qw, qh, 1 / fw, 0)
    blurPass(fQ!, fC!, qw, qh, 0, 1 / fh)
    // 3) threshold + wet shading at full res, onto the transparent canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(shadeP.p)
    const u = shadeP.u
    bindTextures(gl, shadeP, [[fA!.t[0], 'uT0'], [fA!.t[1], 'uT1'], [fA!.t[2], 'uT2'], [fC!.t[0], 'uW0'], [fC!.t[1], 'uW1'], [fC!.t[2], 'uW2']])
    gl.uniform2f(u.uRes, canvas.width, canvas.height)
    gl.uniform2f(u.uOrigin, ox * dpr, oy * dpr)
    gl.uniform1f(u.uCell, cell)
    gl.uniform1f(u.uScale, 1 / WSCALE)
    gl.uniform1f(u.uTh, K.threshold)
    gl.uniform1f(u.uWet, K.wetness)
    gl.uniform1f(u.uBulge, K.bulge)
    gl.uniform1f(u.uAbsorb, K.absorb)
    gl.uniform1f(u.uFres, K.fresnel)
    gl.uniform1f(u.uTrans, K.translucency)
    gl.uniform1f(u.uTime, time)
    gl.uniform1f(u.uUnA, K.unfilledAlpha)
    gl.uniform1f(u.uUnDim, K.unfilledDim)
    gl.uniform1f(u.uGlow, K.readyGlow)
    gl.uniform1f(u.uPulse, K.readyPulse)
    gl.uniform1f(u.uClipL, clipL)
    gl.uniform1f(u.uClipR, clipR)
    gl.uniform1f(u.uClipB, state.height)
    gl.uniform3fv(u.uCols, cols)
    gl.uniform1f(u.uWhite, Z.whiteHot) // F67: how far toward white zapped goo turns
    setWild(gl, u, cols) // F39: the wild goop's look (twists-look.json, live)
    setXray(gl, u, state, view, xrayBuf) // F36: covered cracks show through
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
    // 4) F62 the faces, over the goo on the same canvas
    if (book.on) drawFaces(state, view, ox * dpr, oy * dpr, cell, clipL, clipR)
  }

  function drawFaces(state: ShiftState, view: GooView, ox: number, oy: number, cell: number, clipL: number, clipR: number) {
    faceDraw.begin()
    const px = 1 / view.cellPx // one CSS pixel, in cells
    clumpFaces.forEach((f, k) => {
      const x = faceXY[k * 2]
      if (x > clipL - 1 && x < clipR + 1) book.draw(faceDraw, f, x, faceXY[k * 2 + 1], 1, 0, 1, 1, false, px)
    })
    for (const z of zaps.values()) {
      if (!z.face) continue
      const k = dyingSpot(z)
      book.draw(faceDraw, z.face, SPOT[0], SPOT[1], 1, 0, k, z.fade, true, px)
    }
    const L = book.look
    faceDraw.flush({ originX: ox, originY: oy, cell, width: canvas.width, height: canvas.height, clipL, clipR, clipB: state.height,
      eye: L.eyeColor, pupil: L.pupilColor, mouth: L.mouthColor }, (uu) => setXray(gl, uu, state, view, xrayBuf))
  }

  // (dev + tests) every face now, with where it is on the stage
  function faceReports(): FaceReport[] {
    if (!book.on || !lastView || !S) return []
    const [ox, oy] = viewOrigin(lastView, S.bufferRows)
    const cp = lastView.cellPx
    const toPx = (x: number, y: number): [number, number] => [ox + x * cp, oy + y * cp]
    const out = clumpFaces.map((f, k) => book.report(f, faceXY[k * 2], faceXY[k * 2 + 1], toPx, false))
    for (const z of zaps.values())
      if (z.face) {
        dyingSpot(z)
        out.push(book.report(z.face, SPOT[0], SPOT[1], toPx, true))
      }
    return out
  }

  let disposed = false
  return {
    name: 'particle',
    frame(state, events, view, dtSec) {
      if (disposed) return
      const dt = Math.min(Math.max(dtSec, 0), 0.05)
      time += dt
      followFile(K, particleFile, seen) // Dev Kit edits to the knob file apply on this frame
      paletteTable(colorNames, undefined, cols) // and to goo-colors.json
      update(state, events, view, dt)
      draw(state, view)
    },
    setKnobs(values) {
      mergeKnobs(K, values)
    },
    motion(cell) { // the average speed of this cell's particles
      const list = cellParts[cell]
      if (!list || !list.length) return 0
      let sum = 0
      for (const i of list) sum += Math.hypot(VX[i], VY[i])
      return sum / list.length
    },
    faces: faceReports,
    dispose() {
      if (disposed) return
      disposed = true
      for (const T of [fA, fB, fC, fQ]) freeTarget(gl, T)
      fA = fB = fC = fQ = null
      for (const P of [splatP, blurP, shadeP]) freeProgram(gl, P)
      faceDraw.dispose()
      gl.deleteBuffer(quadBuf)
      gl.deleteBuffer(instBuf)
      gl.deleteVertexArray(splatVAO)
      gl.deleteVertexArray(emptyVAO)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    },
  }
}
