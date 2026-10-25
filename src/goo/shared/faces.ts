// THE GOOP'S FACES (F62): which clumps have eyes and mouths, where they look, when they blink, worry, squeeze shut or
// "say something", and how they fade in one clump at a time. Ported from the approved sketch
// (.planning/research/sketches/goop-eyes.html — faceFor / eyeSpot / hasEyes / hasMouth / updateFaces / drawFace /
// stepFader). Both goo renderers use this; each tells it where a clump's eyes are on screen right now and it draws
// through the shared FaceDrawer (faceDraw.ts). Knobs: content/tuning/eyes.json (live). Story (design/story.md):
//   rank 0–9 nothing (the renderers don't even call this) · 10–19 a few tiny eyes in big clumps, shut when zapped ·
//   20–29 eyes in most clumps, following the falling piece / the laser · 30–39 blinks, worried at high pressure ·
//   40+ some clumps grow mouths, shut most of the time, now and then saying something.
// A face belongs to a clump's exact set of cells, so a clump keeps its dice rolls (eyes? mouth?) across rebuilds —
// no flicker. A clump that changes (a piece lands on it, it falls, it splits) carries on the face it mostly came
// from (fades, gaze, clocks), with new rolls for its new shape. Times are seconds on the goo's clock (the looks clock
// × the rules rate), so the Dev Kit pause stops blinks, talking and fades too.
import type { TapPoint } from '../../engine/types'
import eyesFile from '../../../content/tuning/eyes.json' // live: the Dev Kit's edits apply on the next frame
import { hexToRgb } from './palette'
import type { FaceDrawer } from './faceDraw'

// What the renderer is told about the story each frame (GooView.story)
export interface FaceStory {
  rank: number // the player's rank: 0–9 no faces at all
  pressure: number // 0..1
  focus: TapPoint | null // what the eyes look at: the falling piece's centre, or the laser's tap while it fires (tank cells, like a pop's `at`)
}

export interface EyesLook {
  eyeSize: number
  pupilSize: number
  eyeGap: number
  eyeCount: number
  eyeColor: [number, number, number]
  pupilColor: [number, number, number]
  mouthColor: [number, number, number]
  hex: [string, string, string] // the three colours as the file had them when they were last turned into numbers
  minClump10: number
  eyeChance10: number
  minClump20: number
  eyeChance20: number
  followSpeed: number
  followRange: number
  blinkEvery: number
  blinkTime: number
  worriedAt: number
  browTilt: number
  pupilShrink: number
  zapClose: number
  mouthChance: number
  mouthSize: number
  mouthOpen: number
  talkEvery: number
  talkTime: number
  appearSpread: number
  appearFade: number
}

const num = (v: unknown, min: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : min)
const hex = (v: unknown) => (typeof v === 'string' ? v : '#808080')

// The faces' knobs right now (eyes.json, with the Dev Kit's latest edit), written into `out` so a frame makes nothing new
export function readEyesLook(out?: EyesLook): EyesLook {
  const f = eyesFile as Record<string, unknown>
  const L = out ?? ({} as EyesLook)
  L.eyeSize = num(f.eyeSize, 0)
  L.pupilSize = Math.min(1, num(f.pupilSize, 0))
  L.eyeGap = num(f.eyeGap, 0)
  L.eyeCount = Math.max(1, Math.round(num(f.eyeCount, 1)))
  // (colours: turned into numbers only when the text changes)
  if (L.hex === undefined) L.hex = ['', '', '']
  if (L.hex[0] !== hex(f.eyeColor)) { L.hex[0] = hex(f.eyeColor); L.eyeColor = hexToRgb(L.hex[0]) }
  if (L.hex[1] !== hex(f.pupilColor)) { L.hex[1] = hex(f.pupilColor); L.pupilColor = hexToRgb(L.hex[1]) }
  if (L.hex[2] !== hex(f.mouthColor)) { L.hex[2] = hex(f.mouthColor); L.mouthColor = hexToRgb(L.hex[2]) }
  L.minClump10 = num(f.minClump10, 1)
  L.eyeChance10 = num(f.eyeChance10, 0)
  L.minClump20 = num(f.minClump20, 1)
  L.eyeChance20 = num(f.eyeChance20, 0)
  L.followSpeed = num(f.followSpeed, 0)
  L.followRange = num(f.followRange, 0)
  L.blinkEvery = num(f.blinkEvery, 0.05)
  L.blinkTime = num(f.blinkTime, 0.01)
  L.worriedAt = Math.min(1, num(f.worriedAt, 0))
  L.browTilt = num(f.browTilt, 0)
  L.pupilShrink = Math.min(1, num(f.pupilShrink, 0))
  L.zapClose = num(f.zapClose, 0)
  L.mouthChance = num(f.mouthChance, 0)
  L.mouthSize = num(f.mouthSize, 0)
  L.mouthOpen = Math.min(1, num(f.mouthOpen, 0))
  L.talkEvery = num(f.talkEvery, 0.1)
  L.talkTime = num(f.talkTime, 0.05)
  L.appearSpread = num(f.appearSpread, 0)
  L.appearFade = num(f.appearFade, 0.01)
  return L
}

// Showing up one clump at a time: when a part should appear (or go), it waits a random moment within appearSpread,
// then fades over appearFade. Each clump rolls its own wait, so the fades overlap at random.
export interface Fader {
  a: number // 0 hidden … 1 shown
  want: boolean
  wait: number // seconds before its fade starts
}
const fader = (): Fader => ({ a: 0, want: false, wait: 0 })

export interface Face {
  key: string // the clump's cells, sorted
  size: number // how many cells
  cells: number[] // grid indexes
  eyeRoll: number // fixed 0..1 dice rolls for "has eyes?" and "has a mouth?" (from the cells: the same clump, the same rolls)
  mouthRoll: number
  spotA: number // the grid cell the eyes sit on — or, with spotB, between them (spotB = its right-hand neighbour, or -1)
  spotB: number
  gx: number // where the pupils look (-1 … 1 of their reach)
  gy: number
  blinkIn: number // seconds to the next blink
  blinkT: number // seconds into a blink (-1 = not blinking)
  zapT: number // seconds into a zap squeeze (-1 = none)
  talkIn: number // seconds to the next saying
  talkT: number // seconds into a saying (-1 = quiet)
  flaps: number // its own flap speed while talking
  eyes: Fader
  brows: Fader
  mouth: Fader
}

// (dev + tests: __goops.faces()) one face as the checks see it
export interface FaceReport {
  cells: number[]
  size: number
  eyes: number // 0..1 how faded in
  due: boolean // its eyes should be showing (they may still be waiting for their turn to fade in)
  brows: number
  mouth: number
  talking: boolean
  shut: number // 0 open … 1 shut (blink or zap squeeze)
  worried: number // 0..1
  gaze: [number, number] // where the pupils look (-1 … 1)
  at: [number, number] // where the eyes are: stage CSS px
  dying: boolean // the clump was just zapped (drawn shut until it's gone)
}

const rand = Math.random // looks-only randomness (never touches the rules)

// A fixed 0..1 number per text (FNV-1a + a mix), so a clump keeps the same dice roll across rebuilds and rank changes
export function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

// Where the eyes sit: the most "inside" pair of side-by-side cells (else the most inside single cell), preferring room
// below for a mouth. ux / uy = each cell's column (unwrapped round the tank) and row. Returns [a, b]: indexes into the
// cells — the eyes sit on cell a, or between a and its right-hand neighbour b (b = -1: on a alone).
export function eyeSpot(ux: number[], uy: number[]): [number, number] {
  const at = new Map<string, number>()
  ux.forEach((x, i) => at.set(x + ',' + uy[i], i))
  const n = (x: number, y: number) => (at.has(x + ',' + y) ? 1 : 0)
  const nb = (x: number, y: number) => n(x + 1, y) + n(x - 1, y) + n(x, y + 1) + n(x, y - 1)
  let best: [number, number] = [0, -1]
  let bs = -1e9
  ux.forEach((x, i) => {
    const y = uy[i]
    const s1 = nb(x, y) + 0.5 * n(x, y + 1) - 0.01 * y
    if (s1 > bs) {
      bs = s1
      best = [i, -1]
    }
    if (n(x + 1, y)) {
      const s2 = 1 + nb(x, y) + nb(x + 1, y) + 0.5 * (n(x, y + 1) + n(x + 1, y + 1)) - 0.01 * y
      if (s2 > bs) {
        bs = s2
        best = [i, at.get(x + 1 + ',' + y)!]
      }
    }
  })
  return best
}

// Where a face's eyes sit in a clump's own coordinates (ux / uy as the renderer unwrapped its cells): [x, y] in cells
export function spotIn(f: Face, cells: number[], ux: number[], uy: number[]): [number, number] {
  const i = Math.max(0, cells.indexOf(f.spotA))
  return [ux[i] + (f.spotB >= 0 ? 1 : 0.5), uy[i] + 0.5]
}

// 0 = open, 1 = shut. Closes over `closeIn`, stays shut, opens again over the last 30% (at most 0.25 s).
function shutCurve(t: number, T: number, closeIn: number): number {
  if (t < 0 || T <= 0) return 0
  if (t < closeIn) return t / closeIn
  const r = Math.min(0.3 * T, 0.25)
  return t > T - r ? Math.max(0, (T - t) / r) : 1
}

export class FaceBook {
  readonly look: EyesLook = readEyesLook()
  rank = 0
  pressure = 0
  hasFocus = false
  focusX = 0 // view cells
  focusY = 0
  time = 0
  built = false // faces have been handed out since the book was last switched on
  private faces = new Map<string, Face>()
  private building: Map<string, Face> | null = null
  private owner = new Map<number, Face>() // grid cell → the face it belonged to (falls move it with the cell)
  private nextOwner: Map<number, Face> | null = null

  // Rank 10+: faces are on. Below that the renderers skip everything (no faces, no cost).
  get on() {
    return this.rank >= 10
  }

  // Once a frame, before anything else: the story, the knobs, the focus in view cells (toViewX: tank x → view x)
  frame(story: FaceStory | undefined, dt: number, toViewX: (x: number) => number) {
    const wasOn = this.on
    this.rank = story?.rank ?? 0
    this.pressure = Math.max(0, Math.min(1, story?.pressure ?? 0))
    const f = story?.focus
    this.hasFocus = !!f
    if (f) {
      this.focusX = toViewX(f.x - 0.5) // (a tap point's x is in cell edges: the cell's centre is x + 0.5)
      this.focusY = f.y
    }
    this.time += dt
    if (this.on) readEyesLook(this.look)
    if (wasOn && !this.on) this.clear()
  }

  clear() {
    this.faces.clear()
    this.owner.clear()
    this.built = false
  }

  // ---- handing faces to clumps: begin() → faceFor() per clump → end() ----
  begin() {
    this.building = new Map()
    this.nextOwner = new Map()
  }

  // The face for a clump of these grid cells (ux / uy = their unwrapped columns + rows, for where the eyes sit)
  faceFor(cells: number[], ux: number[], uy: number[]): Face {
    const key = cells.slice().sort((a, b) => a - b).join(',')
    let f = this.building!.get(key) ?? this.faces.get(key)
    if (!f) {
      const [a, b] = eyeSpot(ux, uy)
      const L = this.look
      f = {
        key, size: cells.length, cells: cells.slice(), eyeRoll: hash01(key + 'eyes'), mouthRoll: hash01(key + 'mouth'),
        spotA: cells[a], spotB: b >= 0 ? cells[b] : -1, gx: 0, gy: 0,
        blinkIn: L.blinkEvery * (0.3 + rand()), blinkT: -1, zapT: -1,
        talkIn: L.talkEvery * (0.3 + 1.4 * rand()), talkT: -1, flaps: 5 + rand() * 4,
        eyes: fader(), brows: fader(), mouth: fader(),
      }
      this.inherit(f, cells)
    }
    this.building!.set(key, f)
    for (const c of cells) this.nextOwner!.set(c, f)
    return f
  }

  end() {
    this.faces = this.building ?? new Map()
    this.owner = this.nextOwner ?? new Map()
    this.building = null
    this.nextOwner = null
    this.built = true
  }

  // A new clump carries on the face most of its cells came from: what's showing, where it looks, its clocks
  private inherit(f: Face, cells: number[]) {
    const votes = new Map<Face, number>()
    for (const c of cells) {
      const o = this.owner.get(c)
      if (o) votes.set(o, (votes.get(o) ?? 0) + 1)
    }
    let from: Face | null = null
    let most = 0
    for (const [o, v] of votes) if (v > most) { most = v; from = o }
    if (!from) return
    f.gx = from.gx
    f.gy = from.gy
    f.blinkIn = from.blinkIn
    f.blinkT = from.blinkT
    f.zapT = from.zapT
    f.talkIn = from.talkIn
    f.talkT = from.talkT
    f.eyes = { ...from.eyes }
    f.brows = { ...from.brows }
    f.mouth = { ...from.mouth }
  }

  // Cells that fell (the engine's fall event, [from, to]): their face goes with them
  moveCells(moves: [number, number][]) {
    if (!this.on) return
    const was = moves.map(([f]) => this.owner.get(f))
    for (const [f] of moves) this.owner.delete(f)
    moves.forEach(([, t], i) => { const o = was[i]; if (o) this.owner.set(t, o) })
  }

  // The face of the clump that holds this grid cell (as of the last hand-out), if any
  faceOf(cell: number): Face | undefined {
    return this.owner.get(cell)
  }

  // A zap took these cells: every clump touching them squeezes its eyes shut (> <) for zapClose
  shutAround(cells: number[], width: number, height: number) {
    if (!this.on) return
    const gone = new Set(cells)
    for (const c of cells) {
      const x = c % width
      const y = Math.floor(c / width)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        const n = ny * width + ((x + dx + width) % width)
        const f = gone.has(n) ? undefined : this.owner.get(n)
        if (f) f.zapT = 0
      }
    }
  }

  // ---- the rules of each face (rank decides which are switched on) ----
  hasEyes(f: Face): boolean {
    if (!this.on) return false
    const L = this.look
    const late = this.rank >= 20
    return f.size >= (late ? L.minClump20 : L.minClump10) && f.eyeRoll < (late ? L.eyeChance20 : L.eyeChance10)
  }

  hasMouth(f: Face): boolean {
    return this.rank >= 40 && this.hasEyes(f) && f.mouthRoll < this.look.mouthChance
  }

  get worried(): boolean {
    return this.rank >= 30 && this.pressure > 0 && this.pressure >= this.look.worriedAt
  }

  // how worried (0-1) a clump looks: grows with pressure past worriedAt, times its own brows' fade-in
  worriedOf(f: Face): number {
    if (!this.worried) return f.brows.a * 0.5
    const L = this.look
    return (0.5 + (0.5 * (this.pressure - L.worriedAt)) / Math.max(0.01, 1 - L.worriedAt)) * f.brows.a
  }

  private stepFader(F: Fader, want: boolean, dt: number) {
    if (want !== F.want) {
      F.want = want
      F.wait = rand() * this.look.appearSpread
    }
    if (F.wait > 0) {
      F.wait -= dt
      return
    }
    const k = dt / Math.max(0.01, this.look.appearFade)
    F.a = want ? Math.min(1, F.a + k) : Math.max(0, F.a - k)
  }

  // Once a frame per live clump: (x, y) = where its eyes are now (view cells)
  step(f: Face, x: number, y: number, dt: number) {
    const L = this.look
    const eyes = this.hasEyes(f)
    this.stepFader(f.eyes, eyes, dt)
    this.stepFader(f.brows, eyes && this.worried, dt)
    this.stepFader(f.mouth, this.hasMouth(f), dt)
    if (f.eyes.a <= 0) return
    let tx = 0 // look ahead unless following
    let ty = 0
    if (this.rank >= 20 && this.hasFocus) {
      const dx = this.focusX - x
      const dy = this.focusY - y
      const d = Math.hypot(dx, dy)
      if (d <= L.followRange && d > 1e-3) {
        const near = Math.min(1, d / 0.8)
        tx = (dx / d) * near
        ty = (dy / d) * near
      }
    }
    const k = 1 - Math.exp(-L.followSpeed * dt)
    f.gx += (tx - f.gx) * k
    f.gy += (ty - f.gy) * k
    if (this.rank >= 30) {
      if (f.blinkT >= 0) {
        f.blinkT += dt
        if (f.blinkT >= L.blinkTime) f.blinkT = -1
      } else if ((f.blinkIn -= dt) <= 0) {
        f.blinkT = 0
        f.blinkIn = L.blinkEvery * (0.5 + rand())
      }
    } else f.blinkT = -1
    if (f.zapT >= 0) {
      f.zapT += dt
      if (f.zapT >= L.zapClose) f.zapT = -1
    }
    if (f.talkT >= 0) {
      f.talkT += dt
      if (f.talkT >= L.talkTime) {
        f.talkT = -1
        f.talkIn = L.talkEvery * (0.3 + 1.4 * rand())
      }
    } else if (f.mouth.a > 0 && (f.talkIn -= dt) <= 0) f.talkT = 0 // its turn to say something
  }

  // ---- how shut, how open ----
  private blinkOf(f: Face): number {
    return f.blinkT >= 0 ? Math.sin(Math.PI * Math.min(1, f.blinkT / Math.max(0.01, this.look.blinkTime))) : 0
  }
  private zapShutOf(f: Face, forceShut: boolean): number {
    return forceShut ? 1 : shutCurve(f.zapT, this.look.zapClose, 0.05)
  }
  private sayOf(f: Face, zapS: number): number { // 0 shut … 1 wide: a few quick flaps while it says something (never mid-squeeze)
    if (f.talkT < 0 || zapS >= 0.5) return 0
    return Math.abs(Math.sin((Math.PI * f.flaps * f.talkT) / 2)) * Math.sin((Math.PI * f.talkT) / this.look.talkTime)
  }

  // Draw one face. (cx, cy) = where its eyes' spot is now (view cells); (ca, sa) = the clump's turn (cos, sin) and
  // `scale` its size (a zapped clump shrinks), so the eyes ride the goo; alpha = the clump's own fade.
  // forceShut = the zapped clump itself (eyes squeezed, no worry). pxCell = one screen pixel in cells.
  draw(D: FaceDrawer, f: Face, cx: number, cy: number, ca: number, sa: number, scale: number, alpha: number, forceShut: boolean, pxCell: number) {
    const L = this.look
    const r = L.eyeSize * scale
    alpha *= f.eyes.a
    if (r < 0.4 * pxCell || alpha <= 0.02) return
    const n = L.eyeCount
    const ay = -0.1 * f.mouth.a // the eyes move up a little to make room for a mouth (as it fades in)
    const blink = this.blinkOf(f)
    const zapS = this.zapShutOf(f, forceShut)
    const shut = Math.max(blink, zapS)
    const squeeze = zapS >= shut
    const open = 1 - shut
    const w = forceShut ? 0 : this.worriedOf(f)
    const hw = Math.max(0.6 * pxCell, r * 0.16) // the closed eyes' and brows' lines: half width
    for (let i = 0; i < n; i++) {
      const side = Math.sign(i - (n - 1) / 2)
      place(cx, cy, ca, sa, scale, (i - (n - 1) / 2) * L.eyeGap, ay)
      const ex = P[0]
      const ey = P[1]
      if (open > 0.12) {
        const pr = r * L.pupilSize * (1 - L.pupilShrink * w)
        const reach = Math.max(0, r - pr) * 0.9
        const shake = w * r * 0.07
        const px = f.gx * reach + shake * Math.sin(this.time * 47 + i)
        const py = f.gy * reach + shake * Math.cos(this.time * 41 + i)
        D.eye(ex, ey, r, open, px / r, py / r, pr / r, alpha)
      } else if (squeeze && side) { // ">" on the left eye, "<" on the right: points to the nose
        const d = -side
        D.line(ex - d * r, ey - r * 0.6, ex + d * r * 0.6, ey, hw, alpha)
        D.line(ex + d * r * 0.6, ey, ex - d * r, ey + r * 0.6, hw, alpha)
      } else D.line(ex - r, ey, ex + r, ey, hw, alpha) // a blink: a flat line
      if (w > 0 && L.browTilt > 0) { // worried brows: inner ends up; they fade in with this clump's turn
        const tilt = (L.browTilt * w * Math.PI) / 180
        const by = ey - r * (1.45 + 0.25 * w)
        const dx = Math.cos(tilt) * r
        const dy = -Math.sin(tilt) * r * side
        D.line(ex - dx, by + dy, ex + dx, by - dy, hw, alpha * f.brows.a)
      }
    }
    if (f.mouth.a > 0) { // a mouth: a shut line most of the time; while it says something, a few quick flaps
      place(cx, cy, ca, sa, scale, 0, 0.24)
      const mw = L.mouthSize * 0.5 * scale
      const say = this.sayOf(f, zapS)
      D.mouth(P[0], P[1], mw, Math.max(pxCell, mw * 0.7 * (0.08 + 0.92 * L.mouthOpen * say)), alpha * f.mouth.a)
    }
  }

  // (dev + tests) one face's numbers; (x, y) = its spot now in view cells, toPx turns that into stage CSS px
  report(f: Face, x: number, y: number, toPx: (x: number, y: number) => [number, number], dying: boolean): FaceReport {
    const zapS = this.zapShutOf(f, dying)
    return {
      cells: f.cells.slice(), size: f.size, eyes: f.eyes.a, due: f.eyes.want, brows: f.brows.a, mouth: f.mouth.a,
      talking: this.sayOf(f, zapS) > 0.05, shut: Math.max(this.blinkOf(f), zapS), worried: dying ? 0 : this.worriedOf(f),
      gaze: [f.gx, f.gy], at: toPx(x, y), dying,
    }
  }
}

// A point (dx, dy) in the clump's own shape, relative to the eyes' spot → where it is now, into P (a scratch point,
// so drawing makes no new arrays): the spot (cx, cy) + the clump's turn (ca, sa = cos, sin) × its size
const P = [0, 0]
function place(cx: number, cy: number, ca: number, sa: number, scale: number, dx: number, dy: number) {
  P[0] = cx + (ca * dx - sa * dy) * scale
  P[1] = cy + (sa * dx + ca * dy) * scale
}
