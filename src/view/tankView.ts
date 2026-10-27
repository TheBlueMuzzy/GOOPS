// Draws the tank itself on a 2D canvas UNDER the goo: background, grid (scrolls as the tank spins), pressure water,
// cracks and the ghost piece. The goo canvas sits on top and is transparent where there's no goo.
import type { ShiftState } from '../engine/types'
import type { GooView } from '../goo/types'
import { screenColumn } from '../goo/types'
import { pieceScreenColumn } from './geometry'
import { crackIsOpen, crackSpots, type CrackBubbles } from './crackBubbles'
import look from '../../content/tuning/cracks-look.json'
import tank from '../../content/tuning/tank.json'
import { WILD_COLOR } from '../goo/shared/palette'
import { twoColourGlow, wildStops } from '../goo/shared/wildLook'
import { GALAXY_SLOT, galaxyColours, galaxyCrackStars } from '../goo/shared/galaxyLook'

export type ColorOf = (c: number) => string

// F64: the colour a line or mark of goop colour c is drawn in on the dark tank — black's would vanish, so black (the
// galaxy, rank 50) is drawn in its rim glow (galaxy-look.json rim); every other colour as it is
const paintOf = (c: number, colorOf: ColorOf) => (c === GALAXY_SLOT ? galaxyColours().rim : colorOf(c))

/** F39: a wild cell's paint on a 2D canvas — the wild look's body with its sheen band across (x0, y0) → (x1, y1). */
export function wildPaint(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, colorOf: ColorOf, timeSec: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [at, hex] of wildStops([1, 2, 3, 4, 5].map(colorOf), timeSec)) g.addColorStop(at, hex)
  return g
}

// guide: drawn in the tank right after the landing shadow, under everything else that's in the tank (the drop guide's
// chevrons, src/view/dropGuide.ts)
// F36 cracks you can read: bubbles = the open cracks' air bubbles (src/view/crackBubbles.ts), drawn right over the
// cracks; still = the reduce-motion setting (the x-ray box's dots stop marching)
// F63 white = draws the white goop (src/view/whiteGoopView.ts) right over the cracks and bubbles, inside the tank's clip:
// under the goo canvas, so he's behind the goop
export function drawTank(ctx: CanvasRenderingContext2D, s: ShiftState, view: GooView, colorOf: ColorOf, timeSec: number, guide?: () => void,
  cracksLook: { bubbles?: CrackBubbles; still?: boolean; white?: () => void } = {}) {
  const { bubbles, still = false, white } = cracksLook
  const { cellPx: cp, centreX, topY, width: W, height: H, dpr } = view
  const visRows = s.height - s.bufferRows
  const left = centreX - (pieceScreenColumn(s.visibleWidth) + 0.5) * cp
  const right = left + s.visibleWidth * cp
  const bottom = topY + visRows * cp
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = tank.background
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.beginPath()
  ctx.rect(left, topY, right - left, bottom - topY)
  ctx.clip()
  ctx.fillStyle = tank.tank
  ctx.fillRect(left, topY, right - left, bottom - topY)

  // pressure water: everything at or below the pressure line can pop
  const lineY = topY + (s.pressureRow - s.bufferRows) * cp
  if (lineY < bottom) {
    ctx.globalAlpha = tank.waterAlpha
    ctx.fillStyle = tank.water
    ctx.fillRect(left, Math.max(topY, lineY), right - left, bottom - Math.max(topY, lineY))
    ctx.globalAlpha = 1
  }

  // grid lines move with the tank
  ctx.strokeStyle = tank.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  const frac = view.camera - Math.floor(view.camera)
  for (let k = -8; k <= 8; k++) {
    const x = Math.round(centreX + (k - frac + 0.5) * cp) + 0.5
    if (x > left && x < right) { ctx.moveTo(x, topY); ctx.lineTo(x, bottom) }
  }
  for (let r = 1; r < visRows; r++) { const y = Math.round(topY + r * cp) + 0.5; ctx.moveTo(left, y); ctx.lineTo(right, y) }
  ctx.stroke()

  // mended scars where cracks were sealed (F36), under everything else on the wall
  for (const c of s.sealedCracks ?? []) {
    const sx = centreX + screenColumn(c.x, view.camera, s.width) * cp
    if (sx < left - cp || sx > right + cp) continue
    drawSealed(ctx, sx, topY + (c.y - s.bufferRows + 0.5) * cp, cp, c.id)
  }

  // cracks in the tank wall (F39: every cell of a grown crack; key = its id for the root, so old cracks look the same)
  const spots = crackSpots(s)
  for (const c of spots) {
    const sx = centreX + screenColumn(c.x, view.camera, s.width) * cp
    const sy = topY + (c.y - s.bufferRows + 0.5) * cp
    if (sx < left - cp || sx > right + cp) continue
    if (c.color === GALAXY_SLOT) drawGalaxyCrack(ctx, sx, sy, cp, c.key, timeSec, still) // F64: a black crack, with stars
    else drawCrack(ctx, sx, sy, cp, colorOf(c.color), c.key, timeSec)
  }
  // F39 a grown crack reads as ONE crack: a thin seam in its colour from each grown cell back to the cell it grew from
  for (const c of s.cracks) {
    if (!c.cells || c.cells.length < 2) continue
    ctx.save()
    ctx.lineCap = 'round'
    ctx.strokeStyle = paintOf(c.color, colorOf) // (F64: a black crack's seam glows in the galaxy's rim colour)
    ctx.lineWidth = Math.max(1, cp * tank.crackWidth * 0.6)
    ctx.shadowColor = ctx.strokeStyle
    ctx.shadowBlur = cp * tank.crackGlow * 0.5
    ctx.beginPath()
    c.cells.forEach(([x, y], k) => {
      const from = c.cells![c.parent?.[k] ?? -1]
      if (!from) return
      const ax = centreX + screenColumn(x, view.camera, s.width) * cp, bx = centreX + screenColumn(from[0], view.camera, s.width) * cp
      if (Math.abs(ax - bx) > cp * 1.5) return // (across the tank's seam: the cells are next to each other the other way round)
      ctx.moveTo(ax, topY + (y - s.bufferRows + 0.5) * cp)
      ctx.lineTo(bx, topY + (from[1] - s.bufferRows + 0.5) * cp)
    })
    ctx.stroke()
    ctx.restore()
  }
  bubbles?.draw(ctx, s, view, left, right)
  white?.()

  // F39 a two-colour piece glows as it falls (story.md rank 20): a soft glow round each cell in its own colour, under
  // the goo (the jelly is see-through, so it shows round and through the piece). Placed like the ghost, by the spin.
  const two = twoColourGlow()
  if (s.piece && two.glow > 0 && new Set(s.piece.colors).size > 1) {
    const pulse = two.pulseHz > 0 ? 0.7 + 0.3 * Math.sin(timeSec * Math.PI * 2 * two.pulseHz) : 1
    const r = cp * (0.5 + two.size)
    ctx.globalCompositeOperation = 'lighter'
    for (const [k, [x, y]] of s.piece.cells.entries()) {
      const sx = centreX + screenColumn(x, s.spin, s.width) * cp
      const sy = topY + (y + s.piece.fall - s.bufferRows + 0.5) * cp
      const g = ctx.createRadialGradient(sx, sy, cp * 0.4, sx, sy, r) // (full colour up to the cell's edge, under the jelly)
      g.addColorStop(0, colorOf(s.piece.colors[k] ?? s.piece.colors[0]))
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalAlpha = Math.min(1, two.glow * pulse)
      ctx.fillStyle = g
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2)
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  // ghost: where the piece will land. Placed by the spin, not the gliding camera, like the piece itself: the piece
  // stays still on screen while the tank slides under it.
  if (s.piece && s.ghost.length) {
    ctx.globalAlpha = tank.ghostAlpha
    ctx.lineWidth = Math.max(1.5, cp * 0.06)
    ctx.setLineDash([cp * 0.18, cp * 0.12])
    for (const [k, [x, y]] of s.ghost.entries()) {
      const c = s.piece.colors[k] ?? s.piece.colors[0] // (F39: a two-colour piece's ghost in both colours)
      const sx = centreX + screenColumn(x, s.spin, s.width) * cp
      const sy = topY + (y - s.bufferRows + 0.5) * cp
      const h = cp * 0.42
      ctx.strokeStyle = c === WILD_COLOR ? wildPaint(ctx, sx - h, sy - h, sx + h, sy + h, colorOf, timeSec) : paintOf(c, colorOf)
      ctx.strokeRect(sx - h, sy - h, h * 2, h * 2)
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }
  guide?.()

  // the tank is a cylinder: shade toward the side walls
  const shade = ctx.createLinearGradient(left, 0, right, 0)
  shade.addColorStop(0, `rgba(0,0,0,${tank.wallShade})`)
  shade.addColorStop(0.18, 'rgba(0,0,0,0)')
  shade.addColorStop(0.82, 'rgba(0,0,0,0)')
  shade.addColorStop(1, `rgba(0,0,0,${tank.wallShade})`)
  ctx.fillStyle = shade
  ctx.fillRect(left, topY, right - left, bottom - topY)

  // broken laser (F23/F24): a group primed by a first zap glows under its goo with a quick pulse, so it reads as
  // "armed — zap again". (Drawn here, under the goo, so the goo renderers stay untouched; the jelly is see-through.)
  if (s.primed?.length) {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * Math.PI * 2 * tank.primedPulseHz)
    ctx.globalAlpha = tank.primedAlpha * (0.45 + 0.55 * pulse)
    ctx.fillStyle = tank.primedColor
    for (const id of s.primed) {
      for (const i of s.groups.get(id)?.cells ?? []) {
        const sx = centreX + screenColumn(i % s.width, view.camera, s.width) * cp
        const sy = topY + (Math.floor(i / s.width) - s.bufferRows) * cp
        if (sx > left - cp && sx < right + cp) ctx.fillRect(sx - cp / 2, sy, cp, cp)
      }
    }
    ctx.globalAlpha = 1
  }

  // F36 the x-ray: a crack with goop on it gets a dotted box round it ("the visor is auto targeting to help", Muzzy) —
  // the goo over it is drawn see-through (coveredCracks → view.xray → the goo renderers). Here on the tank canvas, so
  // the visor glitch distorts it too. It breathes with the crack's own glow (drawCrack) and its dots march.
  // (F39: per cell of a grown crack — the red X marks each cell the wrong colour sits on)
  const X = look.xray
  for (const c of spots) {
    if (crackIsOpen(s, c)) continue
    const sx = centreX + screenColumn(c.x, view.camera, s.width) * cp
    if (sx < left - cp || sx > right + cp) continue
    const top = topY + (c.y - s.bufferRows) * cp
    const pad = X.pad * cp
    ctx.globalAlpha = X.alpha * (1 - X.pulse * (0.5 - 0.5 * Math.sin(timeSec * 3 + c.key)))
    ctx.strokeStyle = X.color
    ctx.lineWidth = Math.max(1, X.width * cp)
    ctx.setLineDash([X.dash * cp, X.gap * cp])
    ctx.lineDashOffset = still ? 0 : -timeSec * X.dashSpeed * cp
    const bx = sx - cp / 2 - pad, by = top - pad, bs = cp + 2 * pad
    ctx.strokeRect(bx, by, bs, bs)
    // inside the box it reads as the visor's screen: a faint tint + scan lines rolling down (Muzzy, 2026-10-19:
    // "some sort of render effect … like they come from the visor"), and a wrong colour on the crack gets a pixel X
    // ("this one won't seal")
    ctx.save()
    ctx.beginPath(); ctx.rect(bx, by, bs, bs); ctx.clip()
    ctx.globalAlpha = X.tintAlpha
    ctx.fillStyle = X.tint
    ctx.fillRect(bx, by, bs, bs)
    const gap = Math.max(2, X.scanGap * cp)
    const roll = still ? 0 : (timeSec * X.scanSpeed * cp) % gap
    ctx.globalAlpha = X.scanAlpha
    for (let y = by - gap + roll; y < by + bs; y += gap) ctx.fillRect(bx, y, bs, Math.max(1, X.scanWidth * cp))
    if (!c.plugged && X.wrongAlpha > 0) {
      const n = Math.max(3, Math.round(X.wrongPixels)), size = X.wrongSize * cp, p = size / n
      const x0 = sx - size / 2, y0 = top + (cp - size) / 2
      ctx.globalAlpha = X.wrongAlpha
      // a dark rim first, so the X still reads over a red crack
      for (const [fill, grow] of [[X.wrongOutline, Math.max(1, p * 0.3)], [X.wrongColor, 0]] as const) {
        ctx.fillStyle = fill
        for (let i = 0; i < n; i++) for (const col of [i, n - 1 - i]) {
          ctx.fillRect(Math.round(x0 + col * p - grow), Math.round(y0 + i * p - grow), Math.ceil(p + 2 * grow), Math.ceil(p + 2 * grow))
        }
      }
    }
    ctx.restore()
  }
  ctx.setLineDash([])
  ctx.lineDashOffset = 0
  ctx.globalAlpha = 1
  ctx.restore()

  // cracks out of view: a small arrow in the crack's colour at its height, on the tank edge the short way round (v1)
  const arrow = cp * tank.offscreenArrowSize
  ctx.globalAlpha = tank.offscreenArrowAlpha
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 1
  for (const c of s.cracks) {
    const sx = centreX + screenColumn(c.x, view.camera, s.width) * cp
    if (sx >= left && sx <= right) continue // in view: the crack itself shows
    const sy = topY + (c.y - s.bufferRows + 0.5) * cp
    const toRight = sx > right
    const tip = toRight ? right - 3 : left + 3
    const base = toRight ? tip - arrow : tip + arrow
    ctx.fillStyle = paintOf(c.color, colorOf)
    ctx.beginPath(); ctx.moveTo(base, sy - arrow); ctx.lineTo(tip, sy); ctx.lineTo(base, sy + arrow); ctx.closePath()
    ctx.fill(); ctx.stroke()
  }
  ctx.globalAlpha = 1

  // the pressure line on top of the water
  if (lineY > topY && lineY < bottom) {
    ctx.strokeStyle = tank.pressureLine
    ctx.lineWidth = 2
    ctx.setLineDash([6, 5])
    ctx.beginPath(); ctx.moveTo(left, lineY); ctx.lineTo(right, lineY); ctx.stroke()
    ctx.setLineDash([])
  }
}

// A jagged crack's shape, the same every frame for the same crack id: its points top to bottom + a short branch.
function crackShape(x: number, y: number, cp: number, id: number): { pts: [number, number][]; branch: [number, number] } {
  let seed = (id * 2654435761) >>> 0
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const pts: [number, number][] = []
  const n = 5
  for (let i = 0; i <= n; i++) {
    const a = -0.42 + (0.84 * i) / n
    pts.push([x + (rnd() - 0.5) * cp * 0.5, y + a * cp])
  }
  const m = pts[2]
  return { pts, branch: [m[0] + (rnd() > 0.5 ? 1 : -1) * cp * 0.3, m[1] + cp * 0.12] }
}

function traceCrack(ctx: CanvasRenderingContext2D, { pts, branch }: ReturnType<typeof crackShape>) {
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
  ctx.moveTo(pts[2][0], pts[2][1]); ctx.lineTo(branch[0], branch[1])
}

// A crack, with a soft pulse so it reads as "fix me".
function drawCrack(ctx: CanvasRenderingContext2D, x: number, y: number, cp: number, color: string, id: number, t: number) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = color
  ctx.shadowBlur = cp * tank.crackGlow * (0.7 + 0.3 * Math.sin(t * 3 + id))
  ctx.strokeStyle = color
  ctx.lineWidth = cp * tank.crackWidth
  traceCrack(ctx, crackShape(x, y, cp, id))
  ctx.stroke()
  ctx.restore()
}

// F64 a black crack (the final shift): the same jagged crack, a glow in the galaxy's rim colour round a dark core, and a
// few stars twinkling along it (galaxy-look.json crackStars; still = reduce motion: they hold steady)
function drawGalaxyCrack(ctx: CanvasRenderingContext2D, x: number, y: number, cp: number, id: number, t: number, still: boolean) {
  const g = galaxyColours()
  const shape = crackShape(x, y, cp, id)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = g.rim
  ctx.shadowBlur = cp * tank.crackGlow * (0.7 + 0.3 * Math.sin(t * 3 + id))
  ctx.strokeStyle = g.rim
  ctx.lineWidth = cp * tank.crackWidth * 1.6
  traceCrack(ctx, shape)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.strokeStyle = g.core
  ctx.lineWidth = cp * tank.crackWidth * 0.9
  traceCrack(ctx, shape)
  ctx.stroke()
  const stars = galaxyCrackStars()
  ctx.fillStyle = g.star
  for (let k = 0; k < stars.count; k++) {
    const [px, py] = shape.pts[1 + ((k * 2 + id) % (shape.pts.length - 2))] // (on the crack's inner points, spread out)
    const a = t * stars.twinkle * (1 + 0.37 * k) + id * 1.7 + k * 2.1 // (the goo's star twinkle: two uneven waves, galaxyLook.ts)
    const tw = still ? 0.8 : 1 - stars.depth * (1 - (0.5 + 0.5 * (0.6 * Math.sin(a) + 0.4 * Math.sin(a * 2.37 + 1.9))) ** 2)
    const r = Math.max(0.6, cp * 0.05 * stars.size) * (0.6 + 0.6 * tw)
    ctx.globalAlpha = tw
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillRect(px - r * 2.4, py - r * 0.2, r * 4.8, r * 0.4) // a little cross glint
    ctx.fillRect(px - r * 0.2, py - r * 2.4, r * 0.4, r * 4.8)
  }
  ctx.restore()
}

// F36 a sealed crack (Muzzy: "turns black/grey so it looks fixed"): the same crack, dark grey, no glow, with a few
// stitches across it. content/tuning/cracks-look.json → sealed.
function drawSealed(ctx: CanvasRenderingContext2D, x: number, y: number, cp: number, id: number) {
  const S = look.sealed
  const shape = crackShape(x, y, cp, id)
  ctx.save()
  ctx.globalAlpha = S.alpha
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = S.color
  ctx.lineWidth = Math.max(1, cp * S.width)
  traceCrack(ctx, shape)
  ctx.stroke()
  const n = Math.max(0, Math.round(S.stitches))
  if (n) {
    ctx.strokeStyle = S.stitchColor
    ctx.lineWidth = Math.max(1, cp * S.width * 0.6)
    ctx.beginPath()
    for (let k = 0; k < n; k++) {
      const f = (k + 1) / (n + 1) // evenly along the crack, between its points
      const i = Math.min(shape.pts.length - 2, Math.floor(f * (shape.pts.length - 1)))
      const u = f * (shape.pts.length - 1) - i
      const [ax, ay] = shape.pts[i], [bx, by] = shape.pts[i + 1]
      const sx = ax + (bx - ax) * u, sy = ay + (by - ay) * u
      ctx.moveTo(sx - cp * 0.13, sy - cp * 0.03); ctx.lineTo(sx + cp * 0.13, sy + cp * 0.03)
    }
    ctx.stroke()
  }
  ctx.restore()
}
