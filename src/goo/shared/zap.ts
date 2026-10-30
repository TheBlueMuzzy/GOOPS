// THE ZAP (F67): one timeline for both goo styles and the beam overlay, ported from the approved sketch
// (.planning/research/sketches/zap-look.html — startZap / stepZap / spray / drawFx). Knobs: content/tuning/zap.json.
//   0 … heat (= 40% of beamTime): the goop turns white-hot and swells
//   heat … heat + suckTime: every outline point slides into the laser point, nearest first (a teardrop), fading at the end
//   the spray fires once, at sprayAt × the whole zap (0 = as the beam hits, 1 = as the suck-in ends)
// Times are seconds on the goo's clock (the looks clock × the rules rate: the Dev Kit pause freezes it).
// Distances are tank cells. The droplet numbers are v1 px on a 30-px cell, so they're divided by V1_CELL here.
import zapFile from '../../../content/tuning/zap.json' // live: the Dev Kit's edits apply on the next read

export interface ZapLook {
  beamTime: number
  whiteHot: number
  swell: number
  suckTime: number
  droplets: number
  dropSpeed: number
  dropLife: number
  gravity: number
  sprayAt: number
}

export const V1_CELL = 30 // v1's cell size in px: dropSpeed / gravity / droplet size are in v1 px

const num = (v: unknown, min: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : min)

// The zap knobs right now (read once a frame). Reduce motion (`still`): no swell, no spray — the beam and the suck-in stay.
export function zapLook(still = false): ZapLook {
  return {
    beamTime: num(zapFile.beamTime, 0),
    whiteHot: Math.min(1, num(zapFile.whiteHot, 0)),
    swell: still ? 0 : num(zapFile.swell, 0),
    suckTime: num(zapFile.suckTime, 0),
    droplets: still ? 0 : Math.round(num(zapFile.droplets, 0)),
    dropSpeed: num(zapFile.dropSpeed, 0),
    dropLife: num(zapFile.dropLife, 0.05),
    gravity: num(zapFile.gravity, 0),
    sprayAt: Math.min(1, num(zapFile.sprayAt, 0)),
  }
}

export const heatTime = (z: ZapLook) => z.beamTime * 0.4
export const zapEnd = (z: ZapLook) => heatTime(z) + z.suckTime

// 0 … 1: how hot (white + swollen) the goop is at time t
export function zapHeat(z: ZapLook, t: number): number {
  const F = heatTime(z)
  return F > 0 ? Math.min(t / F, 1) : 1
}

// How far a point has been sucked into the laser point (0 = where it was, 1 = at the point). dist = the point's
// distance from the laser point, 0 (nearest) … 1 (farthest): the near side goes first, so the goop becomes a teardrop.
export function suckIn(z: ZapLook, t: number, dist: number): number {
  const F = heatTime(z)
  if (t <= F) return 0
  const u = z.suckTime > 0 ? (t - F) / z.suckTime : 1
  const ui = Math.max(0, Math.min(1, (u - 0.35 * dist) / 0.65))
  return ui * ui * (3 - 2 * ui)
}

// The zapped goop's opacity, from how far it's been sucked in on average (it fades over the last 40%)
export const zapFade = (meanSuck: number) => 1 - Math.max(0, (meanSuck - 0.6) / 0.4) ** 1.5

export const sprayDue = (z: ZapLook, t: number) => t >= z.sprayAt * zapEnd(z)

// The glowing laser point while the goop is sucked in (the sketch's drawFx): radius in cells + white's opacity, or null
export function laserGlow(z: ZapLook, t: number): { r: number; alpha: number } | null {
  const F = heatTime(z)
  if (t <= F || z.suckTime <= 0 || t >= F + z.suckTime) return null
  const u = (t - F) / z.suckTime
  return { r: 0.06 + 0.1 * Math.sin(Math.PI * u), alpha: 0.9 * (1 - u * u) }
}

// The beam's strength (1 as it hits, fading to 0 at beamTime), or 0 once it's gone
export const beamStrength = (z: ZapLook, t: number) => (z.beamTime > 0 && t < z.beamTime ? 1 - t / z.beamTime : 0)

export interface SprayDrop {
  x: number
  y: number
  vx: number
  vy: number
  r: number // radius, cells
  life: number // seconds
  g: number // gravity, cells / s²
}

// v1's createDropletsForPop: from a random outline point, outward ±0.4 rad (any way if the point is at the middle),
// speed 50–130% with an upward push, size 50–120% of 9 v1 px, life 70–130%. xs / ys = the goop's outline right now.
export function sprayDrops(z: ZapLook, xs: ArrayLike<number>, ys: ArrayLike<number>, rand: () => number = Math.random): SprayDrop[] {
  const n = xs.length
  if (z.droplets <= 0 || !n) return []
  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    cx += xs[i]
    cy += ys[i]
  }
  cx /= n
  cy /= n
  const k = 1 / V1_CELL
  const out: SprayDrop[] = []
  for (let d = 0; d < z.droplets; d++) {
    const i = Math.floor(rand() * n)
    const dx = xs[i] - cx
    const dy = ys[i] - cy
    const ang = Math.hypot(dx, dy) > 0.15 ? Math.atan2(dy, dx) + (rand() - 0.5) * 0.8 : rand() * Math.PI * 2
    const sp = z.dropSpeed * (0.5 + rand() * 0.8) * k
    out.push({ x: xs[i], y: ys[i], vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - z.dropSpeed * (50 / 60) * k,
      r: 9 * (0.5 + rand() * 0.7) * k, life: z.dropLife * (0.7 + rand() * 0.6), g: z.gravity * k })
  }
  return out
}
