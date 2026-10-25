// F63 THE WHITE GOOP'S LOOK — the Veteran, gooped, drawn on the TANK canvas: that canvas sits under the goo canvas, so
// he really is behind the goop (Muzzy's pick: he oozes behind it) in both goo styles, and a goop in front of him covers
// him. While goop covers him he gets the covered crack's x-ray look (same intention, same motion — F36): the goo over
// him goes see-through (his cell joins view.xray) and the x-ray box's marching dotted line rings him.
// Ported from the approved sketch (.planning/research/sketches/white-goop.html drawVet / placeVet / tapVet):
//   - white jelly (Jelly style: one soft blob with the jelly's highlight · Particle style: a clump of soft white dots)
//   - his face: eyes ALWAYS open (no blinks), a dark rim on the white eyes so they read on white goop, his squint
//     (the right lid comes down, the left only a little, a low brow over it), pupils on the crack he's after (else the
//     laser while it fires, else the falling piece)
//   - squashes as he oozes a cell, breathes while he seals, flinches with his eyes squeezed shut (> <) when the laser
//     goes through him
//   - a ring round the crack he's sealing that fills as he seals (the sketch's progress ring)
// The engine says where he is (state.vet); this only keeps his looks: squash, gaze, the ouch. Times = the goo's clock
// (the looks clock × the rules rate), so the Dev Kit pause holds him still. Numbers: content/tuning/whiteGoop.json
// (live); the x-ray line: content/tuning/cracks-look.json xray.
import type { Crack, ShiftEvent, ShiftState, TapPoint } from '../engine/types'
import { crackCells } from '../engine/twists'
import { wrapNear } from '../goo/shared/tank'
import { screenColumn, type GooView } from '../goo/types'
import { pieceScreenColumn } from './geometry'
import look from '../../content/tuning/whiteGoop.json'
import cracksLook from '../../content/tuning/cracks-look.json'

export interface WhiteGoopView {
  /** Once a frame, before drawing: this frame's events and the goo's time step (seconds). focus = what the goop's eyes
   *  look at otherwise (the laser's tap while it fires, else the falling piece). */
  step(s: ShiftState, events: ShiftEvent[], dt: number, focus: TapPoint | null): void
  /** Draw him (call inside the tank's clip, after the cracks — drawTank's `white` hook). */
  draw(ctx: CanvasRenderingContext2D, s: ShiftState, view: GooView, style: 'jelly' | 'particle', timeSec: number, still: boolean): void
  /** His cells for the goo's x-ray (see-through over him) while goop covers him: grid indexes, added to view.xray. */
  xrayCells(s: ShiftState, out: number[]): void
  /** Story (rank 31: "every eye turns to it"): his centre while he drops in and for eyesTurnSec after he lands — the
   *  goop's eyes look there instead of their usual focus; null otherwise. */
  eyesOnHim(s: ShiftState, out: TapPoint): TapPoint | null
  /** (dev + tests) how he looks right now */
  report(): { ouch: boolean; squash: number; gaze: [number, number] }
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const OUCH_SHARE = 0.6 // eyes squeezed shut for this share of owTime (at most OUCH_MAX s) — the sketch's
const OUCH_MAX = 0.45
const GAZE_FOLLOW = 10.5 // how fast his pupils swing (the goop's eyes' followSpeed, Muzzy's F62 pick)

export function createWhiteGoopView(): WhiteGoopView {
  let sq = 1 // squash: 1 = normal, < 1 = squat, > 1 = tall
  let flinch = 0 // extra squash from a laser hit, springing back
  let flinchV = 0
  let owT = -1 // seconds since the laser went through him (-1 = not)
  let inGoop = 0 // 0..1, fades in while goop covers him
  let gx = 0
  let gy = 0 // gaze, -1..1
  let time = 0
  let landedAt = -1 // goo-clock time he finished dropping in (-1 = still dropping)

  return {
    step(s, events, dt, focus) {
      const v = s.vet
      if (!v) return
      time += dt
      if (v.mode === 'drop') landedAt = -1
      else if (landedAt < 0) landedAt = time
      for (const e of events) if (e.type === 'vetOw') { owT = 0; flinchV -= num(look.flinch, 0.2) * 30 }
      if (owT >= 0 && (owT += dt) >= num(look.owTime, 1)) owT = -1
      // flinch: a damped spring back to 0
      flinchV += (-140 * flinch - 12 * flinchV) * dt
      flinch += flinchV * dt
      let want = 1
      if (v.mode === 'move') want = 1 - 0.1 * Math.sin(Math.PI * v.t)
      else if (v.mode === 'seal') want = 1 + 0.04 * Math.sin(time * 3)
      inGoop += ((v.behind ? 1 : 0) - inGoop) * Math.min(1, dt * 8)
      if (inGoop > 0.5) want *= 0.94
      sq += (want - sq) * Math.min(1, dt * 18)
      // gaze: the crack he's after, else the goop's own focus
      // (F39 a grown crack: the cell of it nearest him — the one he's heading for or sitting on, not its root)
      const crack = v.targetId !== null ? s.cracks.find((c) => c.id === v.targetId) : undefined
      const aim = crack ? nearestCell(crack, v.px, v.py, s.width) : null
      const tgtX = aim ? aim[0] + 0.5 : focus?.x, tgtY = aim ? aim[1] + 0.5 : focus?.y
      let tx = 0, ty = 0
      if (tgtX !== undefined && tgtY !== undefined) {
        let dx = tgtX - (v.px + 0.5)
        dx = ((dx % s.width) + s.width * 1.5) % s.width - s.width / 2
        const dy = tgtY - (v.py + 0.5), d = Math.hypot(dx, dy)
        if (d > 0.05) { const near = Math.min(1, d / 0.8); tx = (dx / d) * near; ty = (dy / d) * near }
      }
      const k = 1 - Math.exp(-GAZE_FOLLOW * dt)
      gx += (tx - gx) * k
      gy += (ty - gy) * k
    },

    draw(ctx, s, view, style, timeSec, still) {
      const v = s.vet
      if (!v) return
      const cp = view.cellPx
      const visRows = s.height - s.bufferRows
      const left = view.centreX - (pieceScreenColumn(s.visibleWidth) + 0.5) * cp
      const cx = view.centreX + screenColumn(v.px, view.camera, s.width) * cp // his cell's centre
      const top = view.topY + (v.py - s.bufferRows) * cp
      // the ring round the crack he's sealing (drawn even when he's just out of view: the crack may not be)
      if (v.mode === 'seal') drawRing(ctx, s, view, v.targetId, v.seal)
      if (cx < left - cp || cx > left + (s.visibleWidth + 1) * cp || top > view.topY + visRows * cp) return
      const squash = Math.max(0.5, sq + flinch)
      const wide = 1 + (1 - squash) * 0.6
      const bottom = top + cp
      const w = cp * 0.92 * wide, h = cp * 0.92 * squash
      const alpha = num(look.alpha, 1) * (1 - inGoop) + num(look.behindAlpha, 0.7) * inGoop
      ctx.save()
      ctx.globalAlpha = alpha
      if (style === 'particle') drawDots(ctx, cx, bottom - h / 2, w, h, timeSec, still)
      else drawBlob(ctx, cx, bottom - h / 2, w, h)
      ctx.restore()
      if (inGoop > 0.05) drawXrayRing(ctx, cx, top, cp, inGoop, timeSec, still)
      const ouch = owT >= 0 && owT < Math.min(OUCH_MAX, num(look.owTime, 1) * OUCH_SHARE)
      ctx.save()
      ctx.globalAlpha = Math.max(alpha, 0.85)
      drawFace(ctx, cx, bottom - 0.56 * cp * squash, cp, ouch, gx, gy)
      ctx.restore()
    },

    xrayCells(s, out) {
      const v = s.vet
      if (!v || !(inGoop > 0.05 || v.behind)) return
      const here = v.y * s.width + v.x, from = v.fromY * s.width + v.fromX
      if (s.grid[here] && !out.includes(here)) out.push(here)
      if (s.grid[from] && !out.includes(from)) out.push(from)
    },

    eyesOnHim(s, out) {
      const v = s.vet
      if (!v || (landedAt >= 0 && time - landedAt > num(look.eyesTurnSec, 2))) return null
      out.x = v.px + 0.5
      out.y = v.py + 0.5
      return out
    },

    report: () => ({ ouch: owT >= 0, squash: sq + flinch, gaze: [gx, gy] }),
  }
}

// Jelly style: one soft white blob, rounder at the top, with the jelly's highlight up on the left
function drawBlob(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const col = String(look.color)
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h / 2, w, h, [w * 0.46, w * 0.46, w * 0.3, w * 0.3])
  const g = ctx.createRadialGradient(x - w * 0.15, y - h * 0.2, w * 0.05, x, y, w * 0.7)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.6, col)
  g.addColorStop(1, shade(col, 0.82))
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = Math.max(1, w * 0.04)
  ctx.strokeStyle = shade(col, 0.7)
  ctx.stroke()
  ctx.beginPath() // the highlight
  ctx.ellipse(x - w * 0.2, y - h * 0.24, w * 0.16, h * 0.09, -0.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fill()
}

// Particle style: a clump of soft white dots that drift a little (still: they hold their places)
function drawDots(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, still: boolean) {
  const n = Math.max(6, Math.round(num(look.dots, 18)))
  ctx.fillStyle = String(look.color)
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 // golden angle: evenly spread
    const r = Math.sqrt((i + 0.5) / n) * 0.42
    const wob = still ? 0 : 0.04 * Math.sin(t * 2.3 + i * 1.7)
    const px = x + Math.cos(a) * (r + wob) * w
    const py = y + Math.sin(a) * (r + wob) * h
    ctx.beginPath()
    ctx.arc(px, py, Math.max(1, w * 0.14), 0, Math.PI * 2)
    ctx.fill()
  }
}

// While goop covers him: the covered crack's x-ray line (cracks-look.json xray) round him, fading in with inGoop
function drawXrayRing(ctx: CanvasRenderingContext2D, cx: number, top: number, cp: number, k: number, t: number, still: boolean) {
  const X = cracksLook.xray
  const pad = X.pad * cp
  ctx.save()
  ctx.globalAlpha = X.alpha * k
  ctx.strokeStyle = X.color
  ctx.lineWidth = Math.max(1, X.width * cp)
  ctx.setLineDash([X.dash * cp, X.gap * cp])
  ctx.lineDashOffset = still ? 0 : -t * X.dashSpeed * cp
  ctx.beginPath()
  ctx.roundRect(cx - cp / 2 - pad, top - pad, cp + 2 * pad, cp + 2 * pad, cp * 0.3)
  ctx.stroke()
  ctx.restore()
}

// The ring round the crack he's sealing: a faint full ring, filled clockwise from the top as he seals
function drawRing(ctx: CanvasRenderingContext2D, s: ShiftState, view: GooView, id: number | null, seal: number) {
  const c = s.cracks.find((k) => k.id === id)
  if (!c) return
  const cp = view.cellPx
  const x = view.centreX + screenColumn(c.x, view.camera, s.width) * cp
  const y = view.topY + (c.y - s.bufferRows + 0.5) * cp
  const pad = num(look.ringPad, 0.12)
  const r = cp * (0.5 + pad)
  ctx.save()
  ctx.strokeStyle = String(look.ringColor)
  ctx.lineWidth = Math.max(1, num(look.ringWidth, 0.07) * cp)
  ctx.lineCap = 'round'
  const cells = crackCells(c)
  if (cells.length > 1) {
    // F39 a grown crack: he seals it whole, so the ring goes round the WHOLE crack — a rounded box round all its cells
    // (columns the short way round from the root), filling clockwise from its top-left as he seals
    let x0 = 0, x1 = 0, y0 = c.y, y1 = c.y
    for (const [cx, cy] of cells) {
      const dx = wrapNear(cx - c.x, s.width)
      x0 = Math.min(x0, dx); x1 = Math.max(x1, dx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy)
    }
    const bx = x + (x0 - 0.5 - pad) * cp, by = y + (y0 - c.y - 0.5 - pad) * cp
    const bw = (x1 - x0 + 1 + 2 * pad) * cp, bh = (y1 - y0 + 1 + 2 * pad) * cp
    const rad = Math.min(bw, bh) * 0.3
    const around = 2 * (bw + bh) - 8 * rad + 2 * Math.PI * rad // the box's length all the way round
    ctx.globalAlpha = 0.25
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, rad); ctx.stroke()
    ctx.globalAlpha = 0.9
    ctx.setLineDash([around * Math.min(1, seal), around + 1])
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, rad); ctx.stroke()
  } else {
    ctx.globalAlpha = 0.25
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = 0.9
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, seal)); ctx.stroke()
  }
  ctx.restore()
}

// The cell of a crack nearest (px, py) (columns the short way round the tank) — F39: a grown crack has many.
function nearestCell(c: Crack, px: number, py: number, width: number): [number, number] {
  let best: [number, number] = [c.x, c.y], bd = Infinity
  for (const [x, y] of crackCells(c)) {
    const d = Math.hypot(wrapNear(x - px, width), y - py)
    if (d < bd) { bd = d; best = [x, y] }
  }
  return best
}

// His face (the sketch's drawVet): two white eyes with a dark rim, pupils on (gx, gy); his squint = the right eye's lid
// comes down `squint` of the way (the left one only a little) with a low brow over it. ouch = squeezed shut: > <
function drawFace(ctx: CanvasRenderingContext2D, x: number, y: number, cp: number, ouch: boolean, gx: number, gy: number) {
  const r = num(look.eyeSize, 0.18) * cp
  const half = (num(look.eyeGap, 0.48) / 2) * cp
  const squint = num(look.squint, 0.25)
  const ink = String(look.rimColor)
  ctx.lineCap = 'round'
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1, ex = x + side * half, ey = y
    ctx.strokeStyle = ink
    ctx.lineWidth = Math.max(1.2, r * 0.32)
    if (ouch) {
      const d = -side
      ctx.beginPath()
      ctx.moveTo(ex - d * r, ey - r * 0.6); ctx.lineTo(ex + d * r * 0.6, ey); ctx.lineTo(ex - d * r, ey + r * 0.6)
      ctx.stroke()
      continue
    }
    ctx.save()
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2)
    ctx.fillStyle = String(look.eyeColor); ctx.fill()
    ctx.lineWidth = Math.max(0.8, r * 0.14); ctx.strokeStyle = ink; ctx.globalAlpha *= 0.55; ctx.stroke() // the rim
    ctx.globalAlpha /= 0.55
    ctx.clip()
    const pr = r * 0.45, reach = (r - pr) * 0.9
    ctx.beginPath(); ctx.arc(ex + gx * reach, ey + gy * reach, pr, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill()
    const lid = i ? squint : squint * 0.15
    if (lid > 0) {
      const ly = ey - r + 2 * r * lid
      ctx.fillStyle = String(look.lidColor)
      ctx.fillRect(ex - r - 1, ey - r - 1, 2 * r + 2, ly - (ey - r) + 1)
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, r * 0.22)
      ctx.beginPath(); ctx.moveTo(ex - r, ly); ctx.lineTo(ex + r, ly); ctx.stroke()
    }
    ctx.restore()
    if (i && squint > 0.05) { // a low brow over the squint: the outer end pulled down
      const by = ey - r * (1.25 - 0.5 * squint)
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.2, r * 0.3)
      ctx.beginPath(); ctx.moveTo(ex - r * 0.9, by - r * 0.15); ctx.lineTo(ex + r * 1.0, by + r * 0.25 * squint * 2); ctx.stroke()
    }
  }
}

// A hex colour darkened to `k` of its brightness
function shade(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const c = (sh: number) => Math.round(((n >> sh) & 255) * k)
  return `rgb(${c(16)},${c(8)},${c(0)})`
}
