// PARTICLE goo, ported from .planning/research/sketches/lab-L3-particles.html.
// Each grid cell owns 9 particles on a 3x3 lattice, each pulled to its home spot by a weak spring. Same colours stick
// (cohesion + bonds); other colours push apart a little. Splatted per colour, blurred, thresholded, wet-shaded.
// Changes from L3 (Muzzy, 2026-10-17): the falling piece uses the Jelly-style rotate (lags and springs over), and pop is
// a short shrink + fade (no burst). Simulates in view space, only near the screen (TDD D03).
import type { ShiftEvent, ShiftState } from '../../engine/types'
import { screenColumn, type GooOptions, type GooRenderer, type GooView } from '../types'
import particleFile from '../../../content/tuning/goo-particle.json' // live: follows the Dev Kit's Tuning sliders (followFile, each frame)
import { followFile, parseKnobs, mergeKnobs, type Knobs } from '../shared/knobs'
import { DEFAULT_COLOR_NAMES, paletteTable } from '../shared/palette'
import { groupFillLines, inWindow, tankWindow, viewOrigin, wrapNear, type FillInfo } from '../shared/tank'
import { PiecePose } from '../shared/piecePose'
import { FULLSCREEN_VS, bindTextures, fitCanvas, freeProgram, freeTarget, gooContext, makeProgram, makeTarget, type Program, type Target } from '../shared/gl'
import { BLUR_FS, SHADE_FS, SPLAT_FS, SPLAT_VS } from './shaders'

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
const INST = 9

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
  const COL = new Uint8Array(MAXP)
  const ST = new Uint8Array(MAXP) // 0 dead, 1 bound to a cell, 2 popped (shrinking away)
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

  // ---------------- POP (placeholder until the laser "explode/harden" look is designed) ----------------
  // Quiet: the popped goo lets go of its cells, shrinks toward its middle and fades out over popMs. No burst.
  function popList(list: number[]) {
    for (const i of list) {
      if (ST[i] !== 1) continue
      ST[i] = 2
      ZT[i] = 0
      RX[i] = X[i]
      RY[i] = Y[i]
      UN[i] = 0
    }
  }
  function popStep(i: number, h: number) {
    ZT[i] += h
    const T = Math.max(0.05, K.popMs / 1000)
    WT[i] = Math.max(0, 1 - ZT[i] / T) ** 1.5
    // drift a touch toward where it was, heavily damped: it sinks into itself rather than flying anywhere
    AX[i] = (RX[i] - X[i]) * 40 - VX[i] * 12
    AY[i] = (RY[i] - Y[i]) * 40 - VY[i] * 12 + 3
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
        case 'pop':
          for (const ci of e.cells) {
            const l = cellParts[ci]
            if (l) popList(l)
            cellParts[ci] = null
          }
          break
        case 'fall': {
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
    const zi = ST[i] === 2
    const zj = ST[j] === 2
    if (zi !== zj) return // popped goo slides past live goo
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
      if (ST[i] === 2 && WT[i] < 0.03) killParticle(i)
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
        } else if (ST[i] === 1 && OWN[i] >= 0) X[i] -= dcam * (K.spinCarry ?? 0)
    simAcc = Math.min(simAcc + dt, SIM_DT * 4)
    while (simAcc >= SIM_DT) {
      simStep(SIM_DT, state)
      simAcc -= SIM_DT
    }
  }

  // ---------------- WebGL ----------------
  const floatOK = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))
  const WSCALE = floatOK ? 1 : 0.25
  const splatP: Program = makeProgram(gl, SPLAT_VS, SPLAT_FS, ['uFieldRes', 'uOrigin', 'uCell', 'uWS'])
  const blurP: Program = makeProgram(gl, FULLSCREEN_VS, BLUR_FS, ['uT0', 'uT1', 'uT2', 'uStep', 'uSigma', 'uOut', 'uTaps'])
  const shadeP: Program = makeProgram(gl, FULLSCREEN_VS, SHADE_FS, [
    'uT0', 'uT1', 'uT2', 'uW0', 'uW1', 'uW2', 'uRes', 'uOrigin', 'uCell', 'uScale', 'uTh', 'uWet', 'uBulge', 'uAbsorb',
    'uFres', 'uTrans', 'uTime', 'uUnA', 'uUnDim', 'uGlow', 'uPulse', 'uClipL', 'uClipR', 'uClipB', 'uCols',
  ])
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
  gl.vertexAttribPointer(3, 2, gl.FLOAT, false, INST * 4, 28)
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
    const put = (x0: number, y0: number, x1: number, y1: number, r: number, w: number, c: number, un: number, rd: number) => {
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
      n++
    }
    for (let i = 0; i < hiP; i++) {
      if (!ST[i] || X[i] < clipL - 1 || X[i] > clipR + 1) continue
      const r = ST[i] === 2 ? R * (0.55 + 0.45 * WT[i]) : R // popped: shrinks as it fades
      put(X[i], Y[i], X[i], Y[i], r, WT[i], COL[i], UN[i], RD[i])
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
      put(X[i], Y[i], X[j], Y[j], R * 0.6 * (1 - 0.4 * s), w, COL[i], Math.min(UN[i], UN[j]), Math.min(RD[i], RD[j]))
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
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
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
    dispose() {
      if (disposed) return
      disposed = true
      for (const T of [fA, fB, fC, fQ]) freeTarget(gl, T)
      fA = fB = fC = fQ = null
      for (const P of [splatP, blurP, shadeP]) freeProgram(gl, P)
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
