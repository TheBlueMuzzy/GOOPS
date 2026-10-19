// JELLY goo (the F02 pick), ported from .planning/research/sketches/lab-L4-jelly.html.
// One soft body per same-colour group: a ring of outline points traced around the group's grid shape. Each point is
// pulled toward (a) the shape-matched goal (best rigid fit of the rest shape = "keep my shape") and (b) its home on the
// grid ("stay where the rules say"), with damping (TaminoMartinius home springs + Müller 2005 shape matching).
// Reads the engine's state + events, never writes back. Simulates in view space around the camera (TDD D03).
import type { ShiftEvent, ShiftState } from '../../engine/types'
import type { GooOptions, GooRenderer, GooView } from '../types'
import jellyFile from '../../../content/tuning/goo-jelly.json' // live: follows the Dev Kit's Tuning sliders (followFile, each frame)
import { followFile, parseKnobs, mergeKnobs, type Knobs } from '../shared/knobs'
import { DEFAULT_COLOR_NAMES, paletteTable } from '../shared/palette'
import { groupFillLines, tankWindow, unwrapAround, unwrapCells, viewOrigin, wrapNear, wrapTurns, type FillInfo } from '../shared/tank'
import { PiecePose } from '../shared/piecePose'
import { FULLSCREEN_VS, bindTextures, fitCanvas, freeProgram, freeTarget, gooContext, makeProgram, makeTarget, type Program, type Target } from '../shared/gl'
import { buildPoints, traceLoops } from './outline'
import { BLUR_FS, FINAL_FS, MASK_FS, MASK_VS } from './shaders'

// The knobs as the file has them right now (with the Dev Kit's latest edit)
export const jellyDefaults = (): Knobs => parseKnobs(jellyFile)

type Kind = 'grid' | 'piece' | 'dying'
type KickKind = 'squash' | 'radial' | 'twist' | 'shear'

interface Body {
  id: number
  kind: Kind
  color: number
  groupId: number
  n: number
  loops: [number, number][]
  bx: number[] // rest points: grid bodies = unwrapped tank edge coords; the piece = relative to its centre
  by: number[]
  ca: number[]
  cb: number[]
  cw: number[]
  hx: Float32Array
  hy: Float32Array
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  t: number
  alpha: number
  fa: number // fitted rotation + centroids (for the highlight)
  fcx: number
  fcy: number
  rcx: number
  rcy: number
  hlCell: number
  hlX: number
  hlY: number
  hlW: number
  hlH: number
  hlRX: number
  hlRY: number
  cellIdx: number[] // grid index per cell (grid bodies)
  centreCol: number // mean unwrapped column (wrap the whole body as one)
  turns: number // which copy around the cylinder is drawn (changes = teleport the sim with it)
  restMeanY: number
  ring: boolean
  buildCam: number
  from: Set<number>
  landed: number
  stuck: Set<number> | null
}

interface Strand {
  color: number
  A: Body
  B: Body
  ia: number
  ib: number
  w0: number
  V: number
  t: number
  w: number
}

interface Drop {
  x: number
  y: number
  vx: number
  vy: number
  r0: number
  life: number
  life0: number
  color: number
}

interface DrawItem {
  color: number
  alpha: number
  fan: [number, number]
  hl: [number, number]
  cover: [number, number]
  line: number
  fillOn: number
  ready: number
}

const C0: number[][] = [[0, 0, 0, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
const C1: number[][] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]]
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]


export function createJellyRenderer(canvas: HTMLCanvasElement, opts: GooOptions = {}): GooRenderer {
  const K: Knobs = jellyDefaults()
  const seen: Knobs = { ...K } // the file's values as last followed (followFile)
  const colorNames = opts.colorNames ?? DEFAULT_COLOR_NAMES
  const cols = paletteTable(colorNames)
  const gl = gooContext(canvas)
  const floatOK = !!gl.getExtension('EXT_color_buffer_float')

  // ---------------- simulation state ----------------
  let W = 0
  let H = 0
  let bodies: Body[] = []
  let pieceBody: Body | null = null
  let retired: Body[] = []
  let dying: Body[] = []
  let drops: Drop[] = []
  let strands: Strand[] = []
  let nextId = 1
  let cellOff = new Float32Array(0)
  let cellVel = new Float32Array(0)
  let cellDelay = new Float32Array(0)
  let cellBody = new Int32Array(0)
  let seenGrid = new Uint8Array(0)
  let seenGroup = new Int32Array(0)
  let forceRebuild = false
  let needPiece = false
  let kicks: [number, KickKind, number][] = []
  let fallFrom = new Map<number, number>()
  let lockSet = new Set<number>()
  let landedTick = 0
  const pose = new PiecePose()
  let camera = 0
  let lastCamera = 0
  let spin = 0
  let fills = new Map<number, FillInfo>()
  let time = 0
  let S: ShiftState | null = null

  function reset(state: ShiftState) {
    W = state.width
    H = state.height
    bodies = []
    pieceBody = null
    retired = []
    dying = []
    drops = []
    strands = []
    kicks = []
    fallFrom = new Map()
    lockSet = new Set()
    cellOff = new Float32Array(W * H)
    cellVel = new Float32Array(W * H)
    cellDelay = new Float32Array(W * H)
    cellBody = new Int32Array(W * H).fill(-1)
    seenGrid = new Uint8Array(W * H)
    seenGroup = new Int32Array(W * H).fill(-1)
    forceRebuild = true
    pose.shape = null
    needPiece = !!state.piece
    if (state.piece) pose.spawn(state.piece, W, state.spin, 0)
  }

  // ---------------- bodies ----------------
  function newBody(cells: [number, number][], color: number, kind: Kind): Body {
    const P = buildPoints(traceLoops(cells), K.corner)
    const n = P.n
    const B: Body = {
      id: nextId++, kind, color, groupId: -1, n, loops: P.loops, bx: P.bx, by: P.by, ca: P.ca, cb: P.cb, cw: P.cw,
      hx: new Float32Array(n), hy: new Float32Array(n), x: new Float32Array(n), y: new Float32Array(n),
      vx: new Float32Array(n), vy: new Float32Array(n), t: 0, alpha: 1, fa: 0, fcx: 0, fcy: 0, rcx: 0, rcy: 0,
      hlCell: 0, hlX: 0, hlY: 0, hlW: 0, hlH: 0, hlRX: 0, hlRY: 0, cellIdx: [], centreCol: 0, turns: 0, restMeanY: 0,
      ring: false, buildCam: 0, from: new Set(), landed: -1, stuck: null,
    }
    // the one highlight: on the top-left cell, stretched along its row (up to 3 cells)
    let tl = 0
    cells.forEach(([x, y], i) => {
      if (y < cells[tl][1] || (y === cells[tl][1] && x < cells[tl][0])) tl = i
    })
    const [tx, ty] = cells[tl]
    let run = 1
    while (run < 3 && cells.some(([x, y]) => x === tx + run && y === ty)) run++
    const tall = cells.some(([x, y]) => x === tx && y === ty + 1)
    B.hlCell = tl
    B.hlX = tx + 0.42 + 0.36 * (run - 1)
    B.hlY = ty + 0.3
    B.hlW = 0.24 + 0.2 * (run - 1)
    B.hlH = tall ? 0.12 : 0.1
    B.restMeanY = P.by.reduce((a, v) => a + v, 0) / Math.max(1, n) // mean of the rest outline (fill level rides with it)
    return B
  }

  function makeGridBody(cells: number[], color: number, groupId: number): Body {
    let U = unwrapCells(cells, W)
    if (U.ring) U = unwrapAround(cells, W, camera)
    const B = newBody(U.ux.map((x, i) => [x, U.uy[i]]), color, 'grid')
    B.groupId = groupId
    B.cellIdx = cells
    B.ring = U.ring
    B.buildCam = camera
    B.centreCol = U.ux.reduce((s, v) => s + v, 0) / U.ux.length
    B.turns = wrapTurns(B.centreCol, camera, W)
    return B
  }

  function offX(B: Body) {
    return -0.5 - camera + B.turns * W
  }

  // homes = where each point sits on the grid right now (grid cells + their visual fall offset, or the piece pose)
  function computeHomes(B: Body) {
    if (B.kind === 'grid') {
      const ci = B.cellIdx
      const ox = offX(B)
      for (let i = 0; i < B.n; i++) {
        const w = B.cw[i]
        B.hx[i] = B.bx[i] + ox
        B.hy[i] = B.by[i] + cellOff[ci[B.ca[i]]] * (1 - w) + cellOff[ci[B.cb[i]]] * w
      }
    } else if (B.kind === 'piece' && pose.shape) {
      for (let i = 0; i < B.n; i++) {
        const [hx, hy] = pose.viewRel(B.bx[i], B.by[i], spin, W)
        B.hx[i] = hx
        B.hy[i] = hy
      }
    }
  }

  function highlightRest(B: Body): [number, number] {
    if (B.kind === 'piece') return pose.shape ? pose.viewRel(B.hlX, B.hlY, spin, W) : [B.hlX, B.hlY]
    if (B.kind === 'grid') return [B.hlX + offX(B), B.hlY + cellOff[B.cellIdx[B.hlCell]]]
    return [B.hlRX, B.hlRY]
  }

  // start a fresh body from the old bodies' wobble: each new point copies the displacement + velocity of the
  // nearest old point (same colour, nearest home). Brand-new bodies "appear" with a spring-out.
  function transfer(B: Body, olds: Body[]) {
    const buckets = new Map<number, (Body | number)[]>()
    const bk = (x: number, y: number) => (Math.floor(x) + 60) * 1000 + Math.floor(y) + 60
    for (const O of olds) {
      if (O.color !== B.color) continue
      for (let i = 0; i < O.n; i++) {
        const k = bk(O.hx[i], O.hy[i])
        if (!buckets.has(k)) buckets.set(k, [])
        buckets.get(k)!.push(O, i)
      }
    }
    let matched = 0
    for (let i = 0; i < B.n; i++) {
      let best: Body | null = null
      let bi = 0
      let bd = 0.5
      const fx = Math.floor(B.hx[i])
      const fy = Math.floor(B.hy[i])
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const L = buckets.get((fx + dx + 60) * 1000 + fy + dy + 60)
          if (!L) continue
          for (let j = 0; j < L.length; j += 2) {
            const O = L[j] as Body
            const k = L[j + 1] as number
            const d = Math.hypot(O.hx[k] - B.hx[i], O.hy[k] - B.hy[i])
            if (d < bd) {
              bd = d
              best = O
              bi = k
            }
          }
        }
      if (best) {
        B.x[i] = B.hx[i] + best.x[bi] - best.hx[bi]
        B.y[i] = B.hy[i] + best.y[bi] - best.hy[bi]
        B.vx[i] = best.vx[bi]
        B.vy[i] = best.vy[bi]
        matched++
      } else {
        B.x[i] = B.hx[i]
        B.y[i] = B.hy[i]
      }
    }
    if (!matched) {
      // appear: start shrunk toward the middle, spring out
      let cx = 0
      let cy = 0
      for (let i = 0; i < B.n; i++) {
        cx += B.hx[i]
        cy += B.hy[i]
      }
      cx /= B.n
      cy /= B.n
      for (let i = 0; i < B.n; i++) {
        B.x[i] = cx + (B.hx[i] - cx) * 0.7
        B.y[i] = cy + (B.hy[i] - cy) * 0.7
      }
    }
  }

  // velocity kicks: smooth whole-body motion fields, so the body moves as ONE jelly
  function kick(B: Body | null | undefined, kind: KickKind, amt: number) {
    if (!B || !amt || !B.n) return
    let cx = 0
    let cy = 0
    let ymax = -1e9
    let ymin = 1e9
    for (let i = 0; i < B.n; i++) {
      cx += B.x[i]
      cy += B.y[i]
      ymax = Math.max(ymax, B.y[i])
      ymin = Math.min(ymin, B.y[i])
    }
    cx /= B.n
    cy /= B.n
    const hgt = Math.max(1, ymax - ymin)
    const s = amt * K.wobble
    for (let i = 0; i < B.n; i++) {
      const dx = B.x[i] - cx
      const dy = B.y[i] - cy
      if (kind === 'squash') {
        B.vy[i] += (s * (ymax - B.y[i])) / Math.sqrt(hgt)
        B.vx[i] += (s * 0.6 * dx) / Math.sqrt(hgt)
      } else if (kind === 'radial') {
        B.vx[i] += s * dx
        B.vy[i] += s * dy
      } else if (kind === 'twist') {
        B.vx[i] -= s * dy
        B.vy[i] += s * dx
      } else {
        B.vx[i] += s * (B.y[i] - cy) // shear
      }
    }
  }

  // landing: the body's shared fall speed stops (it becomes squash instead of sinking through the floor)
  function stopFall(B: Body | undefined) {
    if (!B || B.landed === landedTick) return
    B.landed = landedTick
    let m = 0
    for (let i = 0; i < B.n; i++) m += B.vy[i]
    m /= B.n
    if (m > 0) for (let i = 0; i < B.n; i++) B.vy[i] -= m
  }

  const queueKick = (cell: number, kind: KickKind, amt: number) => kicks.push([cell, kind, amt])
  const bodyById = (id: number) => bodies.find((b) => b.id === id)
  const gx = (i: number) => i % W
  const gy = (i: number) => Math.floor(i / W)
  const neighbour = (i: number, dx: number, dy: number) => {
    const y = gy(i) + dy
    if (y < 0 || y >= H) return -1
    return y * W + ((gx(i) + dx + W) % W)
  }

  // ---------------- POP (placeholder until the laser "explode/harden" look is designed) ----------------
  // Quiet drain: the body's home springs let go, it swells a touch, then shrinks away and fades (popMs). No droplets.
  function popCells(cells: number[]) {
    const hit = new Set<number>()
    for (const c of cells) if (cellBody[c] >= 0) hit.add(cellBody[c])
    for (const id of hit) {
      const B = bodyById(id)
      if (!B) continue
      bodies = bodies.filter((b) => b !== B)
      strands = strands.filter((s) => s.A !== B && s.B !== B)
      ;[B.hlRX, B.hlRY] = highlightRest(B)
      B.kind = 'dying'
      B.t = 0
      kick(B, 'radial', 1.5)
      dying.push(B)
    }
    for (const c of cells) {
      cellOff[c] = 0
      cellVel[c] = 0
      for (const [dx, dy] of N4) {
        const j = neighbour(c, dx, dy)
        if (j >= 0 && S && S.grid[j] && !cells.includes(j)) queueKick(j, 'radial', -0.8)
      }
    }
  }

  // ---------------- events ----------------
  function handle(events: ShiftEvent[], state: ShiftState) {
    // events that read state.piece only make sense if no lock/spawn follows them in this batch (the piece changed)
    let lastSwap = -1
    events.forEach((e, i) => {
      if (e.type === 'lock' || e.type === 'spawn') lastSwap = i
    })
    events.forEach((e, i) => {
      const p = state.piece
      switch (e.type) {
        case 'spawn':
          if (i === lastSwap && p) {
            pose.spawn(p, W, state.spin, -1.2)
            pieceBody = null
            needPiece = true
          }
          break
        case 'move':
          if (i > lastSwap && p) {
            pose.reshape(p, W, state.spin, 0)
            if (pieceBody) kick(pieceBody, 'shear', 2.2 * e.dx)
          }
          break
        case 'rotate': // the drawn piece lags 90° behind and springs over with overshoot; the body twists as it goes
          if (i > lastSwap && p) {
            pose.reshape(p, W, state.spin, e.dir)
            needPiece = true
          }
          break
        case 'drop':
          pose.drop(e.rows)
          break
        case 'lock': {
          const dropping = pose.y < -0.4
          for (const c of e.cells) {
            lockSet.add(c)
            if (dropping) {
              cellOff[c] = pose.y
              cellVel[c] = 12
              cellDelay[c] = 0
            } else queueKick(c, 'squash', 2.4)
          }
          if (pieceBody) {
            // the piece was placed by the spin, the grid by the animated camera: keep the jelly where it is
            const d = wrapNear(spin - camera, W)
            for (let k = 0; k < pieceBody.n; k++) pieceBody.hx[k] += d
            retired.push(pieceBody)
          }
          if (!dropping)
            for (const c of e.cells)
              for (const [dx, dy] of N4) {
                const j = neighbour(c, dx, dy)
                if (j >= 0 && !lockSet.has(j)) queueKick(j, 'squash', 0.9)
              }
          pieceBody = null
          pose.y = 0 // the drop offset belonged to this piece only (several drops in one frame must not add up)
          break
        }
        case 'pop':
          popCells(e.cells)
          break
        case 'reject': // a zap on goop that can't pop yet pokes it: the jelly presses in and springs back (Muzzy 2026-10-18)
          if (e.cell !== undefined && K.poke) {
            queueKick(e.cell, 'squash', 30 * K.poke)
            queueKick(e.cell, 'radial', -22 * K.poke)
          }
          break
        case 'fall': {
          const off = cellOff.slice()
          const vel = cellVel.slice()
          for (const [f] of e.moves) {
            cellOff[f] = 0
            cellVel[f] = 0
          }
          for (const [f, t] of e.moves) {
            cellOff[t] = off[f] + (gy(f) - gy(t))
            cellVel[t] = vel[f]
            cellDelay[t] = 0.04
            fallFrom.set(t, f)
          }
          break
        }
      }
    })
  }

  // a body = same colour + same engine group, 4-connected around the cylinder, AND moving together (same visual fall
  // offset). Falling cells are their own body until they land; then the next rebuild merges them with a wobble.
  function visualGroup(state: ShiftState, start: number, seen: Uint8Array): number[] {
    const c = state.grid[start]
    const g = state.groupOf[start]
    const out: number[] = []
    const stack = [start]
    seen[start] = 1
    while (stack.length) {
      const i = stack.pop()!
      out.push(i)
      for (const [dx, dy] of N4) {
        const j = neighbour(i, dx, dy)
        if (j >= 0 && !seen[j] && state.grid[j] === c && state.groupOf[j] === g && cellOff[j] === cellOff[i] && cellVel[j] === cellVel[i]) {
          seen[j] = 1
          stack.push(j)
        }
      }
    }
    return out
  }

  function rebuild(state: ShiftState) {
    const olds = bodies.concat(retired)
    retired = []
    const oldCellBody = cellBody
    const next: Body[] = []
    const seen = new Uint8Array(W * H)
    cellBody = new Int32Array(W * H).fill(-1)
    for (let i = 0; i < W * H; i++) {
      if (!state.grid[i] || seen[i]) continue
      const B = makeGridBody(visualGroup(state, i, seen), state.grid[i], state.groupOf[i])
      computeHomes(B)
      transfer(B, olds)
      const from = new Set<number>() // merge: the cells came from 2+ different bodies (or a body + the piece)
      for (const ci of B.cellIdx) {
        if (lockSet.has(ci)) {
          from.add(-2)
          continue
        }
        const o = oldCellBody[fallFrom.has(ci) ? fallFrom.get(ci)! : ci]
        if (o >= 0) from.add(o)
      }
      if (from.size >= 2) {
        kick(B, 'radial', 1.6)
        kick(B, 'squash', 1.4)
      }
      B.from = from
      for (const ci of B.cellIdx) cellBody[ci] = B.id
      next.push(B)
    }
    for (let i = 0; i < W * H; i++)
      if (!state.grid[i]) {
        cellOff[i] = 0
        cellVel[i] = 0
      }
    reanchorStrands(next)
    for (let a = 0; a < next.length; a++)
      for (let b = a + 1; b < next.length; b++) {
        // a body that split -> a strand between its parts
        const A = next[a]
        const Bb = next[b]
        if (A.color !== Bb.color || ![...A.from].some((o) => o >= 0 && Bb.from.has(o))) continue
        if (strands.some((s) => (s.A === A && s.B === Bb) || (s.A === Bb && s.B === A))) continue
        makeStrand(A, Bb)
      }
    bodies = next
    fallFrom = new Map()
    lockSet = new Set()
    seenGrid.set(state.grid)
    seenGroup.set(state.groupOf)
  }

  function buildPiece(state: ShiftState) {
    const p = state.piece
    if (!p || !pose.shape) {
      pieceBody = null
      return
    }
    const s = pose.shape
    const old = pieceBody
    const B = newBody(s.ux.map((x, i) => [x, s.uy[i]]), p.colors[0] ?? 1, 'piece')
    // rest points relative to the piece centre (the pose places and turns them)
    for (let i = 0; i < B.n; i++) {
      B.bx[i] -= s.cx
      B.by[i] -= s.cy
    }
    B.hlX -= s.cx
    B.hlY -= s.cy
    computeHomes(B)
    transfer(B, old ? [old] : [])
    if (old) {
      kick(B, 'twist', -2.2)
      strands = strands.filter((st) => st.A !== old && st.B !== old)
    }
    pieceBody = B
  }

  function stepBody(B: Body, h: number, ks: number, kh: number, c: number, scale: number) {
    const n = B.n
    let cx = 0
    let cy = 0
    let rx = 0
    let ry = 0
    for (let i = 0; i < n; i++) {
      cx += B.x[i]
      cy += B.y[i]
      rx += B.hx[i]
      ry += B.hy[i]
    }
    cx /= n
    cy /= n
    rx /= n
    ry /= n
    let a00 = 0
    let a01 = 0
    let a10 = 0
    let a11 = 0
    for (let i = 0; i < n; i++) {
      const px = B.x[i] - cx
      const py = B.y[i] - cy
      const qx = B.hx[i] - rx
      const qy = B.hy[i] - ry
      a00 += px * qx
      a01 += px * qy
      a10 += py * qx
      a11 += py * qy
    }
    const ang = Math.atan2(a10 - a01, a00 + a11)
    const cs = Math.cos(ang) * scale
    const sn = Math.sin(ang) * scale
    B.fa = ang
    B.fcx = cx
    B.fcy = cy
    B.rcx = rx
    B.rcy = ry
    for (let i = 0; i < n; i++) {
      const qx = B.hx[i] - rx
      const qy = B.hy[i] - ry
      const gx2 = cx + cs * qx - sn * qy
      const gy2 = cy + sn * qx + cs * qy
      B.vx[i] += (ks * (gx2 - B.x[i]) + kh * (B.hx[i] - B.x[i]) - c * B.vx[i]) * h
      B.vy[i] += (ks * (gy2 - B.y[i]) + kh * (B.hy[i] - B.y[i]) - c * B.vy[i]) * h
      B.x[i] += B.vx[i] * h
      B.y[i] += B.vy[i] * h
      if (B.y[i] > H) {
        B.y[i] = H // tank floor (no side walls: the tank is a cylinder)
        if (B.vy[i] > 0) B.vy[i] *= -0.3
      }
    }
    const kl = 260 * K.skin * h // surface tension: each skin point pulled toward its two neighbours (rounds, tightens)
    if (kl > 0)
      for (const [s0, cnt] of B.loops)
        for (let k = 0; k < cnt; k++) {
          const i = s0 + k
          const a = s0 + ((k + cnt - 1) % cnt)
          const b = s0 + ((k + 1) % cnt)
          B.vx[i] += kl * (B.x[a] + B.x[b] - 2 * B.x[i])
          B.vy[i] += kl * (B.y[a] + B.y[b] - 2 * B.y[i])
        }
  }

  // ---- surface tension between bodies: sticky reach + strands that thin and tear ----
  function loopOf(B: Body, i: number): [number, number] {
    for (const [s0, cnt] of B.loops) if (i >= s0 && i < s0 + cnt) return [s0, cnt]
    return [0, B.n]
  }
  function nearestPair(A: Body, B: Body): [number, number, number] {
    let bd = 1e9
    let ia = 0
    let ib = 0
    for (let i = 0; i < A.n; i++)
      for (let j = 0; j < B.n; j++) {
        const d = (A.x[i] - B.x[j]) ** 2 + (A.y[i] - B.y[j]) ** 2
        if (d < bd) {
          bd = d
          ia = i
          ib = j
        }
      }
    return [ia, ib, Math.sqrt(bd)]
  }
  const strandSnap = () => 0.35 + 0.75 * K.tension // cells: 0 -> 0.35 (no strings), 1 -> 1.1, 3 -> 2.6
  function makeStrand(A: Body, B: Body) {
    if (K.tension <= 0) return
    const [ia, ib, d] = nearestPair(A, B)
    if (d > 1.6) return
    const w0 = 0.3 + 0.08 * K.tension // neck thickness (cells)
    strands.push({ color: A.color, A, B, ia, ib, w0, V: w0 * Math.max(d, 0.5), t: 0, w: w0 })
  }
  function reanchorStrands(next: Body[]) {
    // bodies were rebuilt: hook each strand end onto the nearest point of the new bodies
    const near = (x: number, y: number, col: number): [Body | null, number] => {
      let bd = 0.8
      let best: Body | null = null
      let bi = 0
      for (const B of next)
        if (B.color === col)
          for (let i = 0; i < B.n; i++) {
            const d = Math.hypot(B.x[i] - x, B.y[i] - y)
            if (d < bd) {
              bd = d
              best = B
              bi = i
            }
          }
      return [best, bi]
    }
    strands = strands.filter((s) => {
      const [A, ia] = near(s.A.x[s.ia], s.A.y[s.ia], s.color)
      const [B, ib] = near(s.B.x[s.ib], s.B.y[s.ib], s.color)
      if (!A || !B || A === B) return false // re-joined (or gone): no strand needed
      Object.assign(s, { A, ia, B, ib })
      return true
    })
  }
  function strandPull(s: Strand, h: number) {
    // the neck pulls its two ends toward each other: the bodies stretch out into it
    const k = (30 + 50 * K.tension) * (s.w / s.w0) * h
    for (const [P, i, Q, j] of [[s.A, s.ia, s.B, s.ib], [s.B, s.ib, s.A, s.ia]] as [Body, number, Body, number][]) {
      const dx = Q.x[j] - P.x[i]
      const dy = Q.y[j] - P.y[i]
      const [s0, cnt] = loopOf(P, i)
      for (let o = -3; o <= 3; o++) {
        const m = s0 + ((((i - s0 + o) % cnt) + cnt) % cnt)
        const wt = 1 - Math.abs(o) / 4
        P.vx[m] += k * dx * wt
        P.vy[m] += k * dy * wt
      }
    }
  }
  function updateStrands(dt: number) {
    strands = strands.filter((s) => {
      s.t += dt
      const L = Math.hypot(s.B.x[s.ib] - s.A.x[s.ia], s.B.y[s.ib] - s.A.y[s.ia])
      // volume-preserving thinning as it stretches, plus a slow drain so a strand never hangs forever
      s.w = Math.min(s.w0, s.V / Math.max(L, 0.01)) * Math.exp(-s.t / (0.5 + 0.9 * K.tension))
      if (s.w > 0.07 && L < strandSnap()) return true
      // tear: each end snaps back into its body (elastic release) and a bead drips off
      for (const [P, i, Q, j] of [[s.A, s.ia, s.B, s.ib], [s.B, s.ib, s.A, s.ia]] as [Body, number, Body, number][]) {
        const [s0, cnt] = loopOf(P, i)
        const dx = Q.x[j] - P.x[i]
        const dy = Q.y[j] - P.y[i]
        const d = Math.hypot(dx, dy) || 1
        for (let o = -3; o <= 3; o++) {
          const m = s0 + ((((i - s0 + o) % cnt) + cnt) % cnt)
          const wt = (1 - Math.abs(o) / 4) * 2.5 * K.wobble
          P.vx[m] -= (dx / d) * wt
          P.vy[m] -= (dy / d) * wt
        }
      }
      const mx = (s.A.x[s.ia] + s.B.x[s.ib]) / 2
      const my = (s.A.y[s.ia] + s.B.y[s.ib]) / 2
      drops.push({ x: mx, y: my, vx: 0, vy: 0.5, r0: 0.13, life: 0.5, life0: 0.5, color: s.color })
      return false
    })
  }
  function cohesion(dt: number) {
    // magnetism: skin points of DIFFERENT same-colour bodies within reach pull toward each other
    const M = K.magnetism
    if (M <= 0) return
    const all = pieceBody ? bodies.concat([pieceBody]) : bodies
    const R = 0.25 + 0.5 * M
    const pull = K.stiffness * 0.1 * M * dt
    const map = new Map<number, (Body | number)[]>()
    const key = (c: number, fx: number, fy: number) => c * 1e6 + (fx + 300) * 1000 + fy + 300
    for (const B of all)
      for (let i = 0; i < B.n; i++) {
        const k = key(B.color, Math.floor(B.x[i] / R), Math.floor(B.y[i] / R))
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(B, i)
      }
    for (const B of all)
      for (let i = 0; i < B.n; i++) {
        const fx = Math.floor(B.x[i] / R)
        const fy = Math.floor(B.y[i] / R)
        let best = 0
        let ux = 0
        let uy = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const L = map.get(key(B.color, fx + dx, fy + dy))
            if (!L) continue
            for (let j = 0; j < L.length; j += 2) {
              const O = L[j] as Body
              if (O === B) continue
              const o = L[j + 1] as number
              const ex = O.x[o] - B.x[i]
              const ey = O.y[o] - B.y[i]
              const d = Math.hypot(ex, ey)
              if (d > R || d < 1e-4) continue
              const a = pull * (1 - d / R)
              if (a > best) {
                best = a
                ux = ex / d
                uy = ey / d
              }
            }
          }
        B.vx[i] += ux * best
        B.vy[i] += uy * best
      }
  }
  // Sticky touch: when the falling piece touches a same-colour jelly, they stick, and a string forms as they slide
  // apart. One string per jelly per piece; Tension decides how far it stretches.
  function stickyTouch() {
    if (K.tension <= 0 || !pieceBody) return
    const P = pieceBody
    P.stuck = P.stuck || new Set()
    let x0 = 1e9
    let x1 = -1e9
    let y0 = 1e9
    let y1 = -1e9
    for (let i = 0; i < P.n; i++) {
      x0 = Math.min(x0, P.x[i])
      x1 = Math.max(x1, P.x[i])
      y0 = Math.min(y0, P.y[i])
      y1 = Math.max(y1, P.y[i])
    }
    for (const B of bodies) {
      if (B.color !== P.color || P.stuck.has(B.id)) continue
      let near = false
      for (let i = 0; i < B.n && !near; i++) near = B.x[i] > x0 - 0.2 && B.x[i] < x1 + 0.2 && B.y[i] > y0 - 0.2 && B.y[i] < y1 + 0.2
      if (!near) continue
      const [, , d] = nearestPair(P, B)
      if (d > 0.15) continue
      P.stuck.add(B.id)
      makeStrand(P, B)
    }
  }

  function update(state: ShiftState, events: ShiftEvent[], view: GooView, dt: number) {
    if (state.width !== W || state.height !== H) reset(state)
    S = state
    lastCamera = camera
    camera = view.camera
    spin = state.spin
    handle(events, state)
    landedTick++
    const g = K.gravity * 10 // cells / s²
    for (let i = 0; i < W * H; i++) {
      // grid-side falls (after a pop, hard drop): visual offset falls under gravity, lands with a squash
      if (cellOff[i] === 0 && cellVel[i] === 0) continue
      if (cellDelay[i] > 0) {
        cellDelay[i] -= dt
        continue
      }
      cellVel[i] += g * dt
      cellOff[i] += cellVel[i] * dt
      if (cellOff[i] >= 0) {
        forceRebuild = true
        stopFall(bodyById(cellBody[i]))
        queueKick(i, 'squash', Math.min(cellVel[i] * 0.22, 3.5))
        cellOff[i] = 0
        cellVel[i] = 0
      }
    }
    for (const B of bodies) if (B.ring && Math.abs(wrapNear(camera - B.buildCam, W)) > 3) forceRebuild = true
    if (forceRebuild || !sameArrays(state)) {
      forceRebuild = false
      rebuild(state)
    }
    if (state.piece && pose.swapped(state.piece, W)) {
      // a different piece without a spawn (hold swap, or we missed the spawn): it appears where it is
      pose.spawn(state.piece, W, spin, 0)
      pieceBody = null
      needPiece = true
    }
    if (state.piece) pose.follow(state.piece, W, spin)
    if (needPiece) {
      needPiece = false
      buildPiece(state)
    }
    if (!state.piece) pieceBody = null
    if (kicks.length) {
      // apply each kind once per body (strongest wins)
      const best = new Map<string, [number, KickKind, number]>()
      for (const [cell, kind, amt] of kicks) {
        const id = cellBody[cell]
        if (id < 0) continue
        const k = id + kind
        if (!best.has(k) || Math.abs(amt) > Math.abs(best.get(k)![2])) best.set(k, [id, kind, amt])
      }
      for (const [id, kind, amt] of best.values()) kick(bodyById(id), kind, amt)
      kicks = []
    }
    // wrap: a body whose nearest copy flipped to the other side of the cylinder moves with its whole sim state.
    // (The camera itself wrapping 29.9 -> 0.1 also flips the turn count, but then the home doesn't jump: no shift.)
    const dcam = wrapNear(camera - lastCamera, W)
    for (const B of bodies) {
      const t = wrapTurns(B.centreCol, camera, W)
      if (t !== B.turns) {
        const jump = B.centreCol - camera + t * W - (B.centreCol - lastCamera + B.turns * W) + dcam
        const d = Math.round(jump / W) * W
        if (d) for (let i = 0; i < B.n; i++) B.x[i] += d
        B.turns = t
      }
    }
    // locked goo rides part of each turn at once (spinCarry), so it sloshes behind less (Muzzy 2026-10-18: "50% less")
    if (dcam && K.spinCarry) for (const B of bodies) for (let i = 0; i < B.n; i++) B.x[i] -= dcam * K.spinCarry
    // loose goo (draining bodies, drips) rides with the tank as it spins
    const dc = dcam
    if (dc) {
      for (const B of dying) {
        for (let i = 0; i < B.n; i++) B.x[i] -= dc
        B.hlRX -= dc
      }
      for (const d of drops) d.x -= dc
    }
    for (const B of bodies) computeHomes(B)
    if (pieceBody) computeHomes(pieceBody)
    const ks = K.stiffness
    const kh = K.stiffness * K.home
    const c = K.viscosity
    const DRAIN = Math.max(0.05, K.popMs / 1000)
    const steps = Math.max(1, Math.ceil(dt * 120))
    const h = dt / steps
    for (let s = 0; s < steps; s++) {
      pose.integrate(h)
      if (pieceBody) {
        computeHomes(pieceBody)
        stepBody(pieceBody, h, ks, kh, c, 1)
      }
      for (const B of bodies) stepBody(B, h, ks, kh, c, 1)
      for (const st of strands) strandPull(st, h)
      for (const B of dying) {
        const t = B.t / DRAIN
        const sc = t < 0.15 ? 1 + (0.05 * t) / 0.15 : Math.max(0.02, 1.05 * (1 - (t - 0.15) / 0.85) ** 1.5)
        for (let i = 0; i < B.n; i++) B.vy[i] += 4 * h // drains downward a little
        stepBody(B, h, ks * 0.8, 0, c, sc)
      }
    }
    cohesion(dt)
    stickyTouch()
    updateStrands(dt)
    for (const B of dying) {
      B.t += dt
      B.alpha = 1 - Math.max(0, (B.t / DRAIN - 0.35) / 0.65) ** 1.3
    }
    dying = dying.filter((B) => B.t < DRAIN)
    for (const d of drops) {
      d.vy += g * dt
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.life -= dt
    }
    drops = drops.filter((d) => d.life > 0 && d.y < H + 1)
    fills = groupFillLines(state)
  }

  function sameArrays(state: ShiftState): boolean {
    const a = state.grid
    const b = state.groupOf
    for (let i = 0; i < a.length; i++) if (a[i] !== seenGrid[i] || b[i] !== seenGroup[i]) return false
    return true
  }

  // ---------------- WebGL ----------------
  const PM: Program = makeProgram(gl, MASK_VS, MASK_FS, ['uOrigin', 'uCover', 'uCell', 'uMode', 'uC0', 'uC1', 'uHl', 'uLine', 'uFillOn', 'uReady', 'uAlpha'])
  const PB: Program = makeProgram(gl, FULLSCREEN_VS, BLUR_FS, ['uT0', 'uT1', 'uT2', 'uSize', 'uStep', 'uSigma', 'uR'])
  const PF: Program = makeProgram(gl, FULLSCREEN_VS, FINAL_FS, [
    'uS0', 'uS1', 'uS2', 'uQ0', 'uQ1', 'uQ2', 'uM1', 'uRes', 'uOrigin', 'uQTex', 'uCell', 'uTime', 'uTrans', 'uWet',
    'uUnA', 'uUnDim', 'uGlow', 'uPulse', 'uClipL', 'uClipR', 'uClipB', 'uCols',
  ])
  const vaoMask = gl.createVertexArray()!
  const vbo = gl.createBuffer()!
  const vaoFsq = gl.createVertexArray()!
  gl.bindVertexArray(vaoMask)
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0)
  gl.bindVertexArray(null)
  let TM: Target | null = null
  let TA: Target | null = null
  let TS: Target | null = null
  let TB: Target | null = null
  let TQ: Target | null = null
  let Wm = 1
  let Hm = 1

  function resizeTargets() {
    for (const T of [TM, TA, TS, TB, TQ]) freeTarget(gl, T)
    Wm = Math.ceil(canvas.width / 4) * 2 // half res; quarter = /2
    Hm = Math.ceil(canvas.height / 4) * 2
    TM = makeTarget(gl, Wm, Hm, 3, false, true)
    TA = makeTarget(gl, Wm, Hm, 3, floatOK)
    TS = makeTarget(gl, Wm, Hm, 3, floatOK)
    TB = makeTarget(gl, Wm / 2, Hm / 2, 3, floatOK)
    TQ = makeTarget(gl, Wm / 2, Hm / 2, 3, floatOK)
  }

  // --- geometry: stencil fans per body, highlight quads, cover quads ---
  let vbuf = new Float32Array(1 << 16)
  let vn = 0
  const pushV = (x: number, y: number, u: number, v: number) => {
    if (vn + 4 > vbuf.length) {
      const nb = new Float32Array(vbuf.length * 2)
      nb.set(vbuf)
      vbuf = nb
    }
    vbuf[vn++] = x
    vbuf[vn++] = y
    vbuf[vn++] = u
    vbuf[vn++] = v
  }
  const mark = () => vn / 4
  function fanBody(B: Body) {
    for (const [s, cnt] of B.loops)
      for (let i = 1; i < cnt - 1; i++) {
        pushV(B.x[s], B.y[s], 0, 0)
        pushV(B.x[s + i], B.y[s + i], 0, 0)
        pushV(B.x[s + i + 1], B.y[s + i + 1], 0, 0)
      }
  }
  function fanDrop(d: Drop) {
    const r = d.r0 * Math.min(1, (d.life / d.life0) * 1.4)
    const N = 10
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * 6.2832
      const a1 = ((i + 1) / N) * 6.2832
      pushV(d.x, d.y, 0, 0)
      pushV(d.x + Math.cos(a0) * r, d.y + Math.sin(a0) * r, 0, 0)
      pushV(d.x + Math.cos(a1) * r, d.y + Math.sin(a1) * r, 0, 0)
    }
  }
  function fanStrand(s: Strand) {
    // tapered neck: thick where it meets each body, thinnest in the middle
    const ax = s.A.x[s.ia]
    const ay = s.A.y[s.ia]
    const bx = s.B.x[s.ib]
    const by = s.B.y[s.ib]
    const L = Math.hypot(bx - ax, by - ay) || 1e-3
    const ux = (bx - ax) / L
    const uy = (by - ay) / L
    const nx = -uy
    const ny = ux
    const N = 8
    const side: [number, number][] = []
    const hw = (t: number) => 0.5 * s.w * (1 + 1.2 * (1 - Math.sin(Math.PI * t)))
    const at = (t: number, sg: number): [number, number] => {
      const tt = L * t - 0.1 + 0.2 * t
      return [ax + ux * tt + sg * nx * hw(t), ay + uy * tt + sg * ny * hw(t)]
    }
    for (let i = 0; i <= N; i++) side.push(at(i / N, 1))
    for (let i = N; i >= 0; i--) side.push(at(i / N, -1))
    let area = 0
    for (let i = 0; i < side.length; i++) {
      const a = side[i]
      const b = side[(i + 1) % side.length]
      area += a[0] * b[1] - b[0] * a[1]
    }
    if (area < 0) side.reverse() // same winding as body outlines, so overlaps add up instead of cancelling
    for (let i = 1; i < side.length - 1; i++) {
      pushV(side[0][0], side[0][1], 0, 0)
      pushV(side[i][0], side[i][1], 0, 0)
      pushV(side[i + 1][0], side[i + 1][1], 0, 0)
    }
  }
  function hlQuad(B: Body, DRAIN: number) {
    // the highlight rides the body's fitted rotation + centroid, so it jiggles with it
    const [ax, ay] = highlightRest(B)
    const ca = Math.cos(B.fa)
    const sa = Math.sin(B.fa)
    const qx = ax - B.rcx
    const qy = ay - B.rcy
    const k = B.kind === 'dying' ? Math.max(0.05, B.t < DRAIN * 0.15 ? 1 : 1 - (B.t / DRAIN - 0.15) / 0.85) : 1
    const cx = B.fcx + (ca * qx - sa * qy) * k
    const cy = B.fcy + (sa * qx + ca * qy) * k
    const rot = B.fa - 0.18
    const ux = Math.cos(rot) * B.hlW * k
    const uy = Math.sin(rot) * B.hlW * k
    const vx = -Math.sin(rot) * B.hlH * k
    const vy = Math.cos(rot) * B.hlH * k
    const P = (s: number, t: number) => pushV(cx + ux * s + vx * t, cy + uy * s + vy * t, s, t)
    P(-1, -1)
    P(1, -1)
    P(1, 1)
    P(-1, -1)
    P(1, 1)
    P(-1, 1)
  }
  function cover(x0: number, y0: number, x1: number, y1: number): [number, number] {
    const s = mark()
    const P = (x: number, y: number) => pushV(x, y, x, y) // uv = view position (for the fill level)
    P(x0, y0)
    P(x1, y0)
    P(x1, y1)
    P(x0, y0)
    P(x1, y1)
    P(x0, y1)
    return [s, 6]
  }

  function buildGeometry(clipL: number, clipR: number): DrawItem[] {
    vn = 0
    const items: DrawItem[] = []
    const DRAIN = Math.max(0.05, K.popMs / 1000)
    const onScreen = (B: Body) => {
      let x0 = 1e9
      let x1 = -1e9
      let y0 = 1e9
      let y1 = -1e9
      for (let i = 0; i < B.n; i++) {
        x0 = Math.min(x0, B.x[i])
        x1 = Math.max(x1, B.x[i])
        y0 = Math.min(y0, B.y[i])
        y1 = Math.max(y1, B.y[i])
      }
      return x1 > clipL - 2 && x0 < clipR + 2 ? [x0 - 0.3, y0 - 0.3, x1 + 0.3, y1 + 0.3] : null
    }
    const add = (B: Body, alpha: number) => {
      const bb = onScreen(B)
      if (!bb) return
      let s = mark()
      fanBody(B)
      const fan: [number, number] = [s, mark() - s]
      s = mark()
      hlQuad(B, DRAIN)
      const hl: [number, number] = [s, mark() - s]
      const f = B.kind === 'grid' ? fills.get(B.groupId) : undefined
      const filling = !!f && f.fill < 0.999
      const line = f ? f.line + (B.fcy - B.restMeanY) : 0
      items.push({ color: B.color, alpha, fan, hl, cover: cover(bb[0], bb[1], bb[2], bb[3]), line, fillOn: filling ? 1 : 0, ready: f && f.ready ? 1 : 0 })
    }
    for (const B of bodies) add(B, 1)
    if (pieceBody) add(pieceBody, 1)
    for (const B of dying) add(B, Math.max(0, B.alpha))
    for (let c = 1; c < 8; c++) {
      // extras of this colour: strings + drips
      const s = mark()
      for (const d of drops) if (d.color === c) fanDrop(d)
      for (const st of strands) if (st.color === c) fanStrand(st)
      if (mark() === s) continue
      const fan: [number, number] = [s, mark() - s]
      items.push({ color: c, alpha: 1, fan, hl: [0, 0], cover: cover(-W, -10, W, H + 10), line: 0, fillOn: 0, ready: 0 })
    }
    return items
  }

  function maskItem(it: DrawItem) {
    if (!it.fan[1]) return
    // stencil: nonzero winding of the outline fan
    gl.colorMask(false, false, false, false)
    gl.stencilFunc(gl.ALWAYS, 0, 0xff)
    gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP)
    gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP)
    gl.uniform1i(PM.u.uMode, 0)
    gl.drawArrays(gl.TRIANGLES, it.fan[0], it.fan[1])
    gl.colorMask(true, true, true, true)
    gl.stencilFunc(gl.NOTEQUAL, 0, 0xff)
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
    if (it.hl[1]) {
      gl.uniform1i(PM.u.uMode, 2)
      gl.uniform1f(PM.u.uHl, it.alpha)
      gl.drawArrays(gl.TRIANGLES, it.hl[0], it.hl[1])
    }
    // cover the body's box: writes colour + fill/ready where the stencil is set, and clears the stencil as it goes
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO)
    gl.uniform1i(PM.u.uMode, 1)
    gl.uniform4fv(PM.u.uC0, C0[it.color] ?? C0[0])
    gl.uniform4fv(PM.u.uC1, C1[it.color] ?? C1[0])
    gl.uniform1f(PM.u.uAlpha, it.alpha)
    gl.uniform1f(PM.u.uLine, it.line)
    gl.uniform1f(PM.u.uFillOn, it.fillOn)
    gl.uniform1f(PM.u.uReady, it.ready)
    gl.drawArrays(gl.TRIANGLES, it.cover[0], it.cover[1])
  }

  function blur(src: Target, dst: Target, dx: number, dy: number, sigma: number) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb)
    gl.viewport(0, 0, dst.w, dst.h)
    for (let i = 0; i < 3; i++) {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, src.t[i])
    }
    gl.uniform2f(PB.u.uSize, dst.w, dst.h)
    gl.uniform2f(PB.u.uStep, dx / dst.w, dy / dst.h)
    gl.uniform1f(PB.u.uSigma, sigma)
    gl.uniform1i(PB.u.uR, Math.min(40, Math.ceil(sigma * 2.5)))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function draw(state: ShiftState, view: GooView) {
    const dpr = Math.min(view.dpr || 1, K.maxDpr)
    if (fitCanvas(canvas, view.width, view.height, dpr) || !TM) resizeTargets()
    const [clipL, clipR] = tankWindow(state.visibleWidth)
    const items = buildGeometry(clipL, clipR)
    const [ox, oy] = viewOrigin(view, state.bufferRows)
    const cell = view.cellPx * dpr
    const cw = canvas.width
    const ch = canvas.height
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.SCISSOR_TEST)
    // 1) mask
    gl.bindFramebuffer(gl.FRAMEBUFFER, TM!.fb)
    gl.viewport(0, 0, Wm, Hm)
    gl.clearColor(0, 0, 0, 0)
    gl.clearStencil(0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
    gl.useProgram(PM.p)
    gl.bindVertexArray(vaoMask)
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, vbuf.subarray(0, vn), gl.STREAM_DRAW)
    gl.uniform2f(PM.u.uOrigin, ox * dpr, oy * dpr)
    gl.uniform1f(PM.u.uCell, cell)
    gl.uniform2f(PM.u.uCover, cw, ch)
    gl.enable(gl.BLEND)
    gl.blendEquation(gl.MAX)
    gl.enable(gl.STENCIL_TEST)
    for (const it of items) maskItem(it)
    gl.disable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD)
    gl.disable(gl.STENCIL_TEST)
    gl.colorMask(true, true, true, true)
    // 2) + 3) blurs
    gl.useProgram(PB.p)
    gl.bindVertexArray(vaoFsq)
    gl.uniform1i(PB.u.uT0, 0)
    gl.uniform1i(PB.u.uT1, 1)
    gl.uniform1i(PB.u.uT2, 2)
    const cHalf = cell * (Wm / cw)
    const sg = cHalf * (0.06 + 0.03 * K.magnetism) // more magnetism = same colours fuse from a little further away
    blur(TM!, TA!, 1, 0, sg)
    blur(TA!, TS!, 0, 1, sg)
    blur(TM!, TB!, 1, 0, cHalf * 0.5 * 0.42)
    blur(TB!, TQ!, 0, 1, cHalf * 0.5 * 0.42)
    // 4) final, straight onto the transparent canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, cw, ch)
    gl.useProgram(PF.p)
    bindTextures(gl, PF, [[TS!.t[0], 'uS0'], [TS!.t[1], 'uS1'], [TS!.t[2], 'uS2'], [TQ!.t[0], 'uQ0'], [TQ!.t[1], 'uQ1'], [TQ!.t[2], 'uQ2'], [TM!.t[1], 'uM1']])
    gl.uniform2f(PF.u.uRes, cw, ch)
    gl.uniform2f(PF.u.uOrigin, ox * dpr, oy * dpr)
    gl.uniform2f(PF.u.uQTex, 2 / Wm, 2 / Hm)
    gl.uniform1f(PF.u.uCell, cell)
    gl.uniform1f(PF.u.uTime, time)
    gl.uniform1f(PF.u.uTrans, K.translucency)
    gl.uniform1f(PF.u.uWet, K.wetness)
    gl.uniform1f(PF.u.uUnA, K.unfilledAlpha)
    gl.uniform1f(PF.u.uUnDim, K.unfilledDim)
    gl.uniform1f(PF.u.uGlow, K.readyGlow)
    gl.uniform1f(PF.u.uPulse, K.readyPulse)
    gl.uniform1f(PF.u.uClipL, clipL) // goo only inside the tank window
    gl.uniform1f(PF.u.uClipR, clipR)
    gl.uniform1f(PF.u.uClipB, state.height)
    gl.uniform3fv(PF.u.uCols, cols)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
  }

  let disposed = false
  return {
    name: 'jelly',
    frame(state, events, view, dtSec) {
      if (disposed) return
      const dt = Math.min(Math.max(dtSec, 0), 0.05)
      time += dt
      followFile(K, jellyFile, seen) // Dev Kit edits to the knob file apply on this frame
      paletteTable(colorNames, undefined, cols) // and to goo-colors.json
      update(state, events, view, dt)
      draw(state, view)
    },
    setKnobs(values) {
      mergeKnobs(K, values)
    },
    motion(cell) { // the average speed of the points of the jelly that holds this cell
      const B = cellBody[cell] >= 0 ? bodyById(cellBody[cell]) : undefined
      if (!B || !B.n) return 0
      let sum = 0
      for (let i = 0; i < B.n; i++) sum += Math.hypot(B.vx[i], B.vy[i])
      return sum / B.n
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const T of [TM, TA, TS, TB, TQ]) freeTarget(gl, T)
      TM = TA = TS = TB = TQ = null
      for (const P of [PM, PB, PF]) freeProgram(gl, P)
      gl.deleteBuffer(vbo)
      gl.deleteVertexArray(vaoMask)
      gl.deleteVertexArray(vaoFsq)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    },
  }
}
