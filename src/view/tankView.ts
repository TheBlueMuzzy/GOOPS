// Draws the tank itself on a 2D canvas UNDER the goo: background, grid (scrolls as the tank spins), pressure water,
// cracks and the ghost piece. The goo canvas sits on top and is transparent where there's no goo.
import type { ShiftState } from '../engine/types'
import type { GooView } from '../goo/types'
import { screenColumn } from '../goo/types'
import { pieceScreenColumn } from './geometry'
import tank from '../../content/tuning/tank.json'

export type ColorOf = (c: number) => string

// rim: F26 "Hug the tank" layout — draw the tank's walls glowing with its integrity (off in the other layouts)
export function drawTank(ctx: CanvasRenderingContext2D, s: ShiftState, view: GooView, colorOf: ColorOf, timeSec: number, rim = false) {
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

  if (rim) drawRim(ctx, left, right, topY, bottom, cp, s.integrity, timeSec)
}

// The tank's walls + floor as its integrity meter (F26 "Hug the tank"): cyan when healthy, blending to red as it
// falls, flickering when low. Drawn just outside the tank so it never covers goop or the off-screen crack arrows.
function drawRim(ctx: CanvasRenderingContext2D, left: number, right: number, top: number, bottom: number, cp: number, integrity: number, t: number) {
  const k = Math.max(0, Math.min(1, integrity))
  const color = mixHex(tank.rimDanger, tank.rimHealthy, k)
  const low = k < tank.rimFlickerBelow
  // a flicker: mostly on, with quick dips (a square-ish wave), harder the lower it gets
  const flicker = low ? 0.35 + 0.65 * (Math.sin(t * Math.PI * 2 * tank.rimFlickerHz) > -0.3 ? 1 : 0.2) : 1
  const w = Math.max(2, cp * tank.rimWidth), half = w / 2
  ctx.save()
  ctx.globalAlpha = flicker
  ctx.strokeStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = cp * tank.rimGlow
  ctx.lineWidth = w
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(left - half, top); ctx.lineTo(left - half, bottom + half); ctx.lineTo(right + half, bottom + half); ctx.lineTo(right + half, top)
  ctx.stroke()
  ctx.restore()
}

// a blend of two "#rrggbb" colours: k = 0 → a, k = 1 → b
function mixHex(a: string, b: string, k: number) {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const c = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k))
  return `rgb(${c[0]},${c[1]},${c[2]})`
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
