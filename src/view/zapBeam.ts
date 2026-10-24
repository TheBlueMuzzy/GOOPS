// The zap's laser beam (F67): a flat 2D canvas ABOVE the visor (so the curved-TV look never moves it — it's a laser from
// the viewer, not part of the tank), from the visible tank's top centre, angled down to the tap, so it lands exactly on
// the finger. While the goop is sucked in, a glowing laser point sits at the tap. The approved sketch's drawFx
// (.planning/research/sketches/zap-look.html), timed by the shared zap timeline (src/goo/shared/zap.ts, zap.json).
// The goo itself (white-hot, suck-in, spray) is the renderers' job; this draws only the beam and the point.
import { beamStrength, laserGlow, zapEnd, zapLook, type ZapLook } from '../goo/shared/zap'

export interface ZapBeamShot {
  from: [number, number] // stage CSS px: the visible tank's top centre
  to: [number, number] // stage CSS px: the tap (the laser point)
  color: string // the zapped goop's colour (the beam's glow)
  t: number // seconds since the zap, on the goo's clock
}

export interface ZapBeam {
  // a zap hit: from the tank's top centre to the tap (stage px)
  fire(from: [number, number], to: [number, number], color: string): void
  // once a frame: dt = the goo's clock (0 while the Dev Kit pauses it); cellPx sizes the end dot and the laser point
  frame(dt: number, cellPx: number, width: number, height: number, dpr: number): void
  shots(): ZapBeamShot[] // (dev + tests) what's on screen now
  dispose(): void
}

export function createZapBeam(canvas: HTMLCanvasElement): ZapBeam {
  const ctx = canvas.getContext('2d')!
  let shots: ZapBeamShot[] = []
  let drawn = false

  function draw(Z: ZapLook, cell: number) {
    for (const s of shots) {
      // the laser point the goop is pulled into
      const g = laserGlow(Z, s.t)
      if (g) {
        ctx.shadowColor = s.color
        ctx.shadowBlur = 14
        ctx.fillStyle = `rgba(255,255,255,${g.alpha})`
        ctx.beginPath()
        ctx.arc(s.to[0], s.to[1], cell * g.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
      // the beam: white, fading over beamTime, glowing in the goop's colour, with a bright dot where it hits
      const a = beamStrength(Z, s.t)
      if (a > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${a})`
        ctx.lineWidth = 3 + 6 * a
        ctx.lineCap = 'round'
        ctx.shadowColor = s.color
        ctx.shadowBlur = 18
        ctx.beginPath()
        ctx.moveTo(s.from[0], s.from[1])
        ctx.lineTo(s.to[0], s.to[1])
        ctx.stroke()
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.beginPath()
        ctx.arc(s.to[0], s.to[1], cell * 0.5 * a + 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }
  }

  return {
    fire(from, to, color) {
      shots.push({ from, to, color, t: 0 })
    },
    frame(dt, cellPx, width, height, dpr) {
      const W = Math.round(width * dpr)
      const H = Math.round(height * dpr)
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W
        canvas.height = H
        drawn = true // (resizing cleared it)
      }
      if (!shots.length && !drawn) return // nothing on it, nothing to do
      const Z = zapLook()
      const end = Math.max(Z.beamTime, zapEnd(Z))
      for (const s of shots) s.t += dt
      shots = shots.filter((s) => s.t < end)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(Z, cellPx)
      drawn = shots.length > 0
    },
    shots: () => shots.map((s) => ({ ...s, from: [...s.from], to: [...s.to] })),
    dispose() {
      shots = []
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}
