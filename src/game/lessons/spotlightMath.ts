// The spotlight's maths (F32, Spotlight.tsx) — plain functions, no page needed (tests/lessons/spotlight.test.ts).
export type Box = { left: number; top: number; right: number; bottom: number }

export const grow = (b: Box, by: number): Box => ({ left: b.left - by, top: b.top - by, right: b.right + by, bottom: b.bottom + by })
/** The part of a box inside another (e.g. inside the window). */
export const clip = (b: Box, to: Box): Box => ({ left: Math.max(b.left, to.left), top: Math.max(b.top, to.top), right: Math.min(b.right, to.right), bottom: Math.min(b.bottom, to.bottom) })
const inside =(x: number, y: number, b: Box) => x > b.left && x < b.right && y > b.top && y < b.bottom
export const roundHalf = (n: number) => Math.round(n * 2) / 2

/** The rectangles of a w × h screen NOT covered by any of the boxes: cut along every box edge, so they never overlap
 *  each other, whatever the boxes do (two holes that overlap stay one hole — an even-odd path would re-dim the overlap). */
export function outsideRects(boxes: Box[], w: number, h: number): Box[] {
  const clampX = (x: number) => Math.max(0, Math.min(w, x)), clampY = (y: number) => Math.max(0, Math.min(h, y))
  const xs = [...new Set([0, w, ...boxes.flatMap((b) => [clampX(b.left), clampX(b.right)])])].sort((a, b) => a - b)
  const ys = [...new Set([0, h, ...boxes.flatMap((b) => [clampY(b.top), clampY(b.bottom)])])].sort((a, b) => a - b)
  const out: Box[] = []
  for (let j = 0; j < ys.length - 1; j++) {
    const top = ys[j], bottom = ys[j + 1]
    let start: number | null = null
    for (let i = 0; i < xs.length - 1; i++) {
      const covered = boxes.some((b) => inside((xs[i] + xs[i + 1]) / 2, (top + bottom) / 2, b))
      if (!covered && start === null) start = xs[i]
      const last = i === xs.length - 2
      if ((covered || last) && start !== null) {
        const end = covered ? xs[i] : xs[i + 1]
        if (end > start && bottom > top) out.push({ left: start, top, right: end, bottom })
        start = null
      }
    }
  }
  return out
}

/** The same as a CSS clip-path (it also shapes where taps land). */
export function outsidePath(boxes: Box[], w: number, h: number): string {
  const r = roundHalf
  const parts = outsideRects(boxes, w, h).map((b) => `M${r(b.left)} ${r(b.top)}H${r(b.right)}V${r(b.bottom)}H${r(b.left)}Z`)
  return parts.length ? `path("${parts.join('')}")` : 'inset(50%)' // (all covered: nothing left)
}
