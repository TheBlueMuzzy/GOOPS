// Tank-space helpers. The tank is a cylinder: column `width` is column 0 again.

export function wrapX(x: number, width: number): number {
  return ((x % width) + width) % width
}

export function cellIndex(x: number, y: number, width: number): number {
  return y * width + wrapX(x, width)
}

// The 4 touching cells (left/right wrap around the cylinder; nothing above row 0 or below the floor).
export function neighbours(index: number, width: number, height: number): number[] {
  const x = index % width
  const y = (index - x) / width
  const out = [cellIndex(x - 1, y, width), cellIndex(x + 1, y, width)]
  if (y > 0) out.push(index - width)
  if (y < height - 1) out.push(index + width)
  return out
}

// Signed column distance from `from` to `x`, the short way round (-width/2 .. width/2).
export function columnOffset(x: number, from: number, width: number): number {
  let d = wrapX(x - from, width)
  if (d >= width / 2) d -= width
  return d
}

// v1 shows 12 columns with the piece in screen column 5, so the view covers spin-5 .. spin+6.
export function isOnScreen(x: number, spin: number, width: number, visibleWidth: number): boolean {
  const left = Math.floor((visibleWidth - 1) / 2)
  const d = columnOffset(x, spin, width)
  return d >= -left && d <= visibleWidth - 1 - left
}
