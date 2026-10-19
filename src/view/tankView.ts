// Draws the tank itself on a 2D canvas UNDER the goo: background, grid (scrolls as the tank spins), pressure water,
// cracks and the ghost piece. The goo canvas sits on top and is transparent where there's no goo.
import type { ShiftState } from '../engine/types'
import type { GooView } from '../goo/types'
import { screenColumn } from '../goo/types'
import { pieceScreenColumn } from './geometry'
import { crackIsOpen, type CrackBubbles } from './crackBubbles'
import look from '../../content/tuning/cracks-look.json'
import tank from '../../content/tuning/tank.json'

export type ColorOf = (c: number) => string

// guide: drawn in the tank right after the landing shadow, under everything else that's in the tank (the drop guide's
// chevrons, src/view/dropGuide.ts)
// F36 cracks you can read: bubbles = the open cracks' air bubbles (src/view/crackBubbles.ts), drawn right over the
// cracks; still = the reduce-motion setting (the x-ray box's dots stop marching)
export function drawTank(ctx: CanvasRenderingContext2D, s: ShiftState, view: GooView, colorOf: ColorOf, timeSec: number, guide?: () => void,
  cracksLook: { bubbles?: CrackBubbles; still?: boolean } = {}) {
  const { bubbles, still = false } = cracksLook
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

  // cracks in the tank wall
  for (const c of s.cracks) {
    const sx = centreX + screenColumn(c.x, view.camera, s.width) * cp
    const sy = topY + (c.y - s.bufferRows + 0.5) * cp
    if (sx < left - cp || sx > right + cp) continue
    drawCrack(ctx, sx, sy, cp, colorOf(c.color), c.id, timeSec)
  }
  bubbles?.draw(ctx, s, view, left, right)

  // ghost: where the piece will land. Placed by the spin, not the gliding camera, like the piece itself: the piece
  // stays still on screen while the tank slides under it.
  if (s.piece && s.ghost.length) {
    ctx.globalAlpha = tank.ghostAlpha
    ctx.strokeStyle = colorOf(s.piece.colors[0])
    ctx.lineWidth = Math.max(1.5, cp * 0.06)
    ctx.setLineDash([cp * 0.18, cp * 0.12])
    for (const [x, y] of s.ghost) {
      const sx = centreX + screenColumn(x, s.spin, s.width) * cp
      const sy = topY + (y - s.bufferRows + 0.5) * cp
      const h = cp * 0.42
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
  const X = look.xray
  for (const c of s.cracks) {
    if (crackIsOpen(s, c)) continue
    const sx = centreX + screenColumn(c.x, view.camera, s.width) * cp
    if (sx < left - cp || sx > right + cp) continue
    const top = topY + (c.y - s.bufferRows) * cp
    const pad = X.pad * cp
    ctx.globalAlpha = X.alpha * (1 - X.pulse * (0.5 - 0.5 * Math.sin(timeSec * 3 + c.id)))
    ctx.strokeStyle = X.color
    ctx.lineWidth = Math.max(1, X.width * cp)
    ctx.setLineDash([X.dash * cp, X.gap * cp])
    ctx.lineDashOffset = still ? 0 : -timeSec * X.dashSpeed * cp
    ctx.strokeRect(sx - cp / 2 - pad, top - pad, cp + 2 * pad, cp + 2 * pad)
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
    ctx.fillStyle = colorOf(c.color)
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

// A jagged crack, the same shape every frame for the same crack id, with a soft pulse so it reads as "fix me".
function drawCrack(ctx: CanvasRenderingContext2D, x: number, y: number, cp: number, color: string, id: number, t: number) {
  let seed = (id * 2654435761) >>> 0
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const pts: [number, number][] = []
  const n = 5
  for (let i = 0; i <= n; i++) {
    const a = -0.42 + (0.84 * i) / n
    pts.push([x + (rnd() - 0.5) * cp * 0.5, y + a * cp])
  }
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = color
  ctx.shadowBlur = cp * tank.crackGlow * (0.7 + 0.3 * Math.sin(t * 3 + id))
  ctx.strokeStyle = color
  ctx.lineWidth = cp * tank.crackWidth
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
  // a short branch
  const m = pts[2]
  ctx.moveTo(m[0], m[1]); ctx.lineTo(m[0] + (rnd() > 0.5 ? 1 : -1) * cp * 0.3, m[1] + cp * 0.12)
  ctx.stroke()
  ctx.restore()
}
