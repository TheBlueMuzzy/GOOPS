// Grid cells -> the rounded outline of one jelly body (ported from lab-L4-jelly.html).
// Cells are in UNWRAPPED columns (a body on the wrap seam is one piece); a cell spans x..x+1, y..y+1.

interface Edge {
  x0: number
  y0: number
  dx: number
  dy: number
  cell: number
  used: boolean
}

// Closed loops of unit edges around the cells (interior on the right, screen y-down)
export function traceLoops(cells: [number, number][]): Edge[][] {
  const key = (x: number, y: number) => (x + 128) * 1024 + (y + 64)
  const has = new Set(cells.map(([x, y]) => key(x, y)))
  const edges = new Map<number, Edge[]>()
  const all: Edge[] = []
  const add = (x0: number, y0: number, dx: number, dy: number, cell: number) => {
    const e = { x0, y0, dx, dy, cell, used: false }
    const k = key(x0, y0)
    if (!edges.has(k)) edges.set(k, [])
    edges.get(k)!.push(e)
    all.push(e)
  }
  cells.forEach(([x, y], ci) => {
    if (!has.has(key(x, y - 1))) add(x, y, 1, 0, ci) // top
    if (!has.has(key(x + 1, y))) add(x + 1, y, 0, 1, ci) // right
    if (!has.has(key(x, y + 1))) add(x + 1, y + 1, -1, 0, ci) // bottom
    if (!has.has(key(x - 1, y))) add(x, y + 1, 0, -1, ci) // left
  })
  const loops: Edge[][] = []
  for (const e0 of all) {
    if (e0.used) continue
    const loop: Edge[] = []
    let cur: Edge | null = e0
    while (cur && !cur.used) {
      cur.used = true
      loop.push(cur)
      const list: Edge[] = edges.get(key(cur.x0 + cur.dx, cur.y0 + cur.dy)) || []
      let best: Edge | null = null
      let bs = -9
      for (const c of list) {
        if (c.used) continue
        const s = cur.dx * c.dy - cur.dy * c.dx
        if (s > bs) {
          bs = s
          best = c
        }
      } // prefer the right turn (pinch diagonals apart)
      cur = best
    }
    loops.push(loop)
  }
  return loops
}

export interface OutlinePoints {
  n: number
  loops: [number, number][] // [start, count] per loop
  bx: number[] // rest position per point
  by: number[]
  ca: number[] // the two cells a point belongs to (for per-cell fall offsets) and the blend between them
  cb: number[]
  cw: number[]
}

// Loops -> rounded outline points (Bézier arcs at corners, ~0.3-cell spacing on straight runs)
export function buildPoints(loops: Edge[][], corner: number): OutlinePoints {
  const B: OutlinePoints = { n: 0, loops: [], bx: [], by: [], ca: [], cb: [], cw: [] }
  const push = (x: number, y: number, ca: number, cb: number, w: number) => {
    B.bx.push(x)
    B.by.push(y)
    B.ca.push(ca)
    B.cb.push(cb)
    B.cw.push(w)
    B.n++
  }
  for (const loop of loops) {
    const n = loop.length
    const start = B.n
    const corners: number[] = []
    for (let k = 0; k < n; k++) {
      const a = loop[(k + n - 1) % n]
      const b = loop[k]
      if (a.dx !== b.dx || a.dy !== b.dy) corners.push(k)
    }
    const rad = (k: number) => {
      const a = loop[(k + n - 1) % n]
      const b = loop[k]
      return a.dx * b.dy - a.dy * b.dx > 0 ? corner : corner * 0.5
    }
    for (let j = 0; j < corners.length; j++) {
      const k = corners[j]
      const kn = corners[(j + 1) % corners.length]
      const ein = loop[(k + n - 1) % n]
      const eo = loop[k]
      const Vx = eo.x0
      const Vy = eo.y0
      const r = rad(k)
      for (const t of [0, 0.25, 0.5, 0.75]) {
        // quadratic Bézier around the corner
        const ax = Vx - ein.dx * r
        const ay = Vy - ein.dy * r
        const bx = Vx + eo.dx * r
        const by = Vy + eo.dy * r
        const u = 1 - t
        push(u * u * ax + 2 * t * u * Vx + t * t * bx, u * u * ay + 2 * t * u * Vy + t * t * by, ein.cell, eo.cell, t)
      }
      const runLen = (kn - k + n) % n || n
      const r2 = rad(kn)
      const L = runLen - r - r2
      const m = Math.max(1, Math.round(L / 0.3))
      for (let i = 0; i < m; i++) {
        const s = (i * L) / m
        const e = loop[(k + Math.min(runLen - 1, Math.floor(r + s))) % n]
        push(Vx + eo.dx * (r + s), Vy + eo.dy * (r + s), e.cell, e.cell, 0)
      }
    }
    B.loops.push([start, B.n - start])
  }
  return B
}
