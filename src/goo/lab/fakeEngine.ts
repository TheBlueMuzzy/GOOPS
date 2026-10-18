// A tiny FAKE shift engine for the goo lab (dev only). It follows the engine contract (src/engine/types.ts) closely
// enough to drive the goo renderers: pieces fall in the middle, the tank spins, groups fill and get ready, tap pops.
// NOT the real rules — the real engine lives in src/engine/.
import type { Color, Group, ShiftAction, ShiftEngine, ShiftEvent, ShiftState } from '../../engine/types'
import { DEFAULT_COLOR_NAMES } from '../shared/palette'

const SHAPES: [number, number][][] = [
  [[-1, 0], [0, 0], [1, 0], [2, 0]], // I
  [[0, 0], [1, 0], [0, 1], [1, 1]], // O
  [[-1, 0], [0, 0], [1, 0], [0, 1]], // T
  [[-1, 0], [0, 0], [1, 0], [-1, 1]], // L
  [[-1, 0], [0, 0], [1, 0], [1, 1]], // J
  [[0, 0], [1, 0], [-1, 1], [0, 1]], // S
  [[-1, 0], [0, 0], [0, 1], [1, 1]], // Z
]

export const LAB_COLOR_NAMES = DEFAULT_COLOR_NAMES

export class FakeEngine implements ShiftEngine {
  state: ShiftState
  private events: ShiftEvent[] = []
  private fallT = 0
  private lockT = 0
  private soft = false
  private gravityT = -1
  private nextGroupId = 1
  private rng: () => number
  fallMs = 650
  colours = 5 // how many colours pieces use (1..7)

  constructor(seed = 1) {
    let s = seed >>> 0 || 1
    this.rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    }
    const width = 30
    const height = 24
    this.state = {
      width, height, bufferRows: 3, visibleWidth: 12,
      grid: new Uint8Array(width * height), groupOf: new Int32Array(width * height).fill(-1), groups: new Map(),
      spin: 0, piece: null, ghost: [], next: null, held: null, pressure: 0, pressureRow: 0, integrity: 1, phase: 'playing',
      cracks: [], cracksSealed: 0, cracksNeeded: 0, quotaMet: false, score: 0, status: 'playing', rank: 1,
    }
    this.spawn()
  }

  private idx(x: number, y: number) {
    const W = this.state.width
    return y * W + (((x % W) + W) % W)
  }
  private free(cells: [number, number][]) {
    const S = this.state
    return cells.every(([x, y]) => y < S.height && (y < 0 || !S.grid[this.idx(x, y)]))
  }
  private wrapX(x: number) {
    const W = this.state.width
    return ((x % W) + W) % W
  }

  reset() {
    const S = this.state
    S.grid.fill(0)
    S.groupOf.fill(-1)
    S.groups = new Map()
    S.piece = null
    this.gravityT = -1
    this.spawn()
  }

  spawn() {
    const S = this.state
    const shape = SHAPES[Math.floor(this.rng() * SHAPES.length)]
    const color: Color = 1 + Math.floor(this.rng() * this.colours)
    const cells = shape.map(([x, y]) => [this.wrapX(S.spin + x), y + 1] as [number, number])
    if (!this.free(cells)) {
      this.reset()
      return
    }
    S.piece = { cells, colors: cells.map(() => color), rotation: 0, fall: 0 }
    this.fallT = 0
    this.lockT = 0
    this.events.push({ type: 'spawn' })
  }

  act(a: ShiftAction) {
    const S = this.state
    const p = S.piece
    switch (a.type) {
      case 'spin': {
        // the tank turns under the piece: the piece keeps its place on screen = moves one column in tank space
        if (p) {
          const moved = p.cells.map(([x, y]) => [this.wrapX(x + a.dir), y] as [number, number])
          if (!this.free(moved)) return
          p.cells = moved
        }
        S.spin = this.wrapX(S.spin + a.dir)
        this.events.push({ type: 'spin', dx: a.dir })
        break
      }
      case 'rotate': {
        if (!p) return
        const [px, py] = p.cells[1]
        const W = S.width
        for (const k of [0, -1, 1]) {
          const r = p.cells.map(([x, y]) => {
            let dx = x - px
            if (dx > W / 2) dx -= W
            if (dx < -W / 2) dx += W
            const dy = y - py
            const [rx, ry] = a.dir > 0 ? [-dy, dx] : [dy, -dx]
            return [this.wrapX(px + rx + k), py + ry] as [number, number]
          })
          if (this.free(r)) {
            p.cells = r
            p.rotation = (p.rotation + a.dir + 4) % 4
            this.events.push({ type: 'rotate', dir: a.dir })
            return
          }
        }
        break
      }
      case 'softDrop':
        this.soft = a.on
        break
      case 'pop': {
        const i = this.idx(a.x, a.y)
        const g = S.groups.get(S.groupOf[i])
        if (!g || !g.ready) return
        for (const c of g.cells) S.grid[c] = 0
        this.events.push({ type: 'pop', cells: g.cells.slice(), color: g.color, sealed: [] })
        this.regroup()
        this.gravityT = 160
        break
      }
      case 'hold':
        break
    }
  }

  private lock() {
    const S = this.state
    const p = S.piece
    if (!p) return
    const cells = p.cells.map(([x, y]) => this.idx(x, y))
    cells.forEach((c, k) => (S.grid[c] = p.colors[k]))
    S.piece = null
    this.events.push({ type: 'lock', cells, color: p.colors[0] })
    this.regroup()
    this.spawn()
  }

  // Same-colour connected groups (around the cylinder). A changed group keeps the fill it already had (by cell count).
  regroup(allFull = false) {
    const S = this.state
    const W = S.width
    const old = S.groups
    const oldOf = S.groupOf.slice()
    S.groupOf.fill(-1)
    const groups = new Map<number, Group>()
    for (let i = 0; i < S.grid.length; i++) {
      if (!S.grid[i] || S.groupOf[i] >= 0) continue
      const cells: number[] = []
      const stack = [i]
      S.groupOf[i] = -2
      while (stack.length) {
        const c = stack.pop()!
        cells.push(c)
        const x = c % W
        const y = Math.floor(c / W)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ny = y + dy
          if (ny < 0 || ny >= S.height) continue
          const j = ny * W + ((x + dx + W) % W)
          if (S.grid[j] === S.grid[i] && S.groupOf[j] === -1) {
            S.groupOf[j] = -2
            stack.push(j)
          }
        }
      }
      const from = new Set(cells.map((c) => oldOf[c]))
      const same = from.size === 1 && !from.has(-1) && old.get([...from][0])?.cells.length === cells.length
      let id: number
      let fill: number
      if (same) {
        id = [...from][0]
        fill = old.get(id)!.fill
      } else {
        id = this.nextGroupId++
        let filled = 0
        for (const o of from) {
          const g = old.get(o)
          if (g) filled += g.fill * g.cells.filter((c) => S.grid[c] === g.color).length
        }
        fill = Math.min(1, filled / cells.length)
        if (from.size >= 2) this.events.push({ type: 'merge', groupId: id })
      }
      if (allFull) fill = 1
      for (const c of cells) S.groupOf[c] = id
      groups.set(id, { id, color: S.grid[i], cells, fill, ready: fill >= 1 })
    }
    S.groups = groups
  }

  // Lab "Fill": fill the visible tank from just under half way down, with same-colour clumps; all groups ready
  fillTank() {
    const S = this.state
    const W = S.width
    const top = S.bufferRows + Math.floor((S.height - S.bufferRows) * 0.45)
    const pc = new Set((S.piece?.cells ?? []).map(([x, y]) => this.idx(x, y)))
    for (let y = S.height - 1; y >= top; y--)
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        if (pc.has(i)) continue
        const left = S.grid[y * W + ((x + W - 1) % W)]
        const below = y < S.height - 1 ? S.grid[i + W] : 0
        const r = this.rng()
        S.grid[i] = r < 0.3 && left ? left : r < 0.55 && below ? below : 1 + Math.floor(this.rng() * this.colours)
      }
    this.regroup(true)
  }

  tick(ms: number) {
    const S = this.state
    const p = S.piece
    // filling
    for (const g of S.groups.values()) {
      if (g.fill >= 1) continue
      g.fill = Math.min(1, g.fill + ms / (375 * g.cells.length))
      if (g.fill >= 1) {
        g.ready = true
        this.events.push({ type: 'ready', groupId: g.id })
      }
    }
    if (this.gravityT >= 0 && (this.gravityT -= ms) < 0) this.applyGravity()
    if (!p) return
    const below = p.cells.map(([x, y]) => [x, y + 1] as [number, number])
    const canFall = this.free(below)
    const speed = this.soft ? 12 : 1
    if (canFall) {
      this.lockT = 0
      this.fallT += ms * speed
      if (this.fallT >= this.fallMs) {
        this.fallT -= this.fallMs
        p.cells = below
        this.events.push({ type: 'step' })
      }
      p.fall = this.free(p.cells.map(([x, y]) => [x, y + 1] as [number, number])) ? Math.min(1, this.fallT / this.fallMs) : 0
    } else {
      p.fall = 0
      this.fallT = 0
      this.lockT += ms
      if (this.lockT >= 400) this.lock()
    }
  }

  // per-cell column compaction (like the sketches): unsupported goop drops
  private applyGravity() {
    const S = this.state
    const W = S.width
    const moves: [number, number][] = []
    for (let x = 0; x < W; x++) {
      let to = S.height - 1
      for (let y = S.height - 1; y >= 0; y--) {
        const c = S.grid[y * W + x]
        if (!c) continue
        if (to !== y) {
          S.grid[to * W + x] = c
          S.grid[y * W + x] = 0
          moves.push([y * W + x, to * W + x])
        }
        to--
      }
    }
    if (moves.length) {
      this.events.push({ type: 'fall', moves })
      this.regroup()
    }
  }

  takeEvents(): ShiftEvent[] {
    const e = this.events
    this.events = []
    return e
  }

  setWallKick(): void {} // the fake engine has only one kick rule
}
