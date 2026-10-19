// The visor glitch (F25) + the pixel filter: a third canvas (WebGL2) over the tank and goo canvases, covering ONLY the
// visible tank's rectangle (Muzzy, 2026-10-18: the curved-TV look over the viewing area, not the whole screen — so the
// curve and vignette bend at the tank's edges, and everything outside it looks exactly as with no glitch). Each frame it
// uploads both canvases as textures, cuts the tank's rectangle out of them, composites, runs the glitch, and/or
// pixelates, and draws the result, opaque, over the tank. With no glitch and the pixel filter off it hides and does
// nothing at all, so the game looks exactly as without it. The HUD is DOM above the stage, so it never glitches.
// Knobs: content/tuning/visor-fx.json. Shaders: ./visorShaders.ts (the sketch's, unchanged).
import type { MachineState, ShiftState } from '../engine/types'
import type { GooView } from '../goo/types'
import { tankRect } from './geometry'
import { FULLSCREEN_VS, makeProgram, freeProgram, makeTarget, freeTarget, type Program, type Target } from '../goo/shared/gl'
import { FS_COMPOSITE, FS_GLITCH, FS_PIX } from './visorShaders'
import fxFile from '../../content/tuning/visor-fx.json'
import { liveTuning } from '../devkit/tuning/liveTuning'

// the knobs, following the Dev Kit's Tuning sliders live (read .current each frame)
const live = liveTuning('visor-fx', fxFile)

export type VisorFxConfig = typeof fxFile

const BG = [5 / 255, 7 / 255, 13 / 255] // the stage background (game.css .stage), under the tank canvas
const LOOK_UNIFORMS: [string, keyof VisorFxConfig['look']][] = [['uScan', 'scan'], ['uRgb', 'rgb'], ['uRoll', 'roll'],
  ['uNoise', 'noise'], ['uFlicker', 'flicker'], ['uTear', 'tear'], ['uTearSize', 'tearSize'], ['uBlock', 'block'],
  ['uBlockSize', 'blockSize'], ['uVig', 'vignette'], ['uCurve', 'curve'], ['uDead', 'dead'], ['uDrop', 'dropout']]

// Glitch amount (0..1): nothing until the visor breaks (Muzzy 2026-10-18), then it builds up over rampMs of play.
export function visorAmount(visor: MachineState | undefined, cfg: Pick<VisorFxConfig, 'rampMs'> = live.current): number {
  if (!visor || !visor.unlocked || !visor.broken) return 0
  return cfg.rampMs > 0 ? Math.min(1, (visor.brokenMs ?? 0) / cfg.rampMs) : 1
}

// The curved-TV look moves things on screen: a point drawn at height y on the flat tank shows up somewhere else.
// For a screen column x, this gives the screen y where flat height y appears (CSS px) — so things drawn ON TOP of
// the curve (the pressure readout's dot) can sit on the bent line. Same barrel as the shader (visorShaders.ts:
// c *= 1 + curve * 0.10 * |c|², c = -1..1 across the tank's rectangle), solved backwards with a few Newton steps.
export function curvedY(x: number, y: number, rect: { left: number; top: number; width: number; height: number }, curve: number): number {
  if (curve <= 0 || rect.width <= 0 || rect.height <= 0) return y
  const k = curve * 0.1
  const cx = ((x - rect.left) / rect.width) * 2 - 1
  const want = ((y - rect.top) / rect.height) * 2 - 1
  let cy = want
  for (let i = 0; i < 6; i++) cy -= (cy * (1 + k * (cx * cx + cy * cy)) - want) / (1 + k * (cx * cx + 3 * cy * cy))
  return rect.top + ((cy + 1) / 2) * rect.height
}

// The other way round: the flat tank point the player sees at screen point (x, y) — what a tap is really pointing at
// (Muzzy 2026-10-18: a click on a one-cell goop near the tank's corners missed it and rotated the piece instead).
// Exactly the shader's barrel, so it needs no solving.
export function flatPoint(x: number, y: number, rect: { left: number; top: number; width: number; height: number }, curve: number): [number, number] {
  if (curve <= 0 || rect.width <= 0 || rect.height <= 0) return [x, y]
  const cx = ((x - rect.left) / rect.width) * 2 - 1, cy = ((y - rect.top) / rect.height) * 2 - 1
  const m = 1 + curve * 0.1 * (cx * cx + cy * cy)
  return [rect.left + ((cx * m + 1) / 2) * rect.width, rect.top + ((cy * m + 1) / 2) * rect.height]
}

// Dev-only URL overrides: ?visor=0.6 locks the glitch amount, ?visor=off forces 0; ?pixel=on|off forces the pixel filter.
export interface VisorOverride { amount: number | null; pixelate: boolean | null }
export function parseVisorOverride(search: string): VisorOverride {
  const q = new URLSearchParams(search)
  const v = q.get('visor'), p = q.get('pixel')
  const n = v === null ? NaN : Number(v)
  return {
    amount: v === 'off' ? 0 : Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null,
    pixelate: p === 'on' ? true : p === 'off' ? false : null,
  }
}

export interface VisorFx {
  frame(state: ShiftState, view: GooView, timeSec: number): void
  curve(): number // how curved the tank looked on the last frame (the shader's strength; 0 = flat) — for curvedY
  dispose(): void
}

export function createVisorFx(stage: HTMLElement, tankCanvas: HTMLCanvasElement, gooCanvas: () => HTMLCanvasElement | null): VisorFx {
  const canvas = document.createElement('canvas')
  canvas.className = 'stage-layer'
  canvas.dataset.visor = ''
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '1' // above the goo canvas even after a style switch re-adds it (React appends it last)
  canvas.style.inset = 'auto' // not the whole stage like the other layers: frame() puts it on the tank's rectangle
  canvas.style.display = 'none'
  stage.appendChild(canvas)
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false })
  if (!gl) { canvas.remove(); return { frame() {}, curve: () => 0, dispose() {} } } // no WebGL2: the game just plays without the effect

  const PC = makeProgram(gl, FULLSCREEN_VS, FS_COMPOSITE, ['uTank', 'uGoo', 'uRes', 'uOffset', 'uFull', 'uPix', 'uClipTop', 'uBg'])
  const PG = makeProgram(gl, FULLSCREEN_VS, FS_GLITCH, ['uTex', 'uRes', 'uTime', 'uAmt', 'uGrain', 'uDpr', 'uCurveAlways', 'uVigAlways', ...LOOK_UNIFORMS.map(([u]) => u)])
  const PP = makeProgram(gl, FULLSCREEN_VS, FS_PIX, ['uTex', 'uRes', 'uPix'])
  const vao = gl.createVertexArray()
  const tex = () => {
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }
  const tankTex = tex(), gooTex = tex()
  let A: Target | null = null, B: Target | null = null // in-between targets (B only for glitch -> pixels order)

  const override = import.meta.env.DEV ? parseVisorOverride(location.search) : { amount: null, pixelate: null }
  let frozenAt: number | null = null, shown = false
  let curveNow = 0, amountNow = 0 // amountNow: the glitch amount on the last frame (dev hook, e2e/visor.mjs)
  if (import.meta.env.DEV) {
    // dev + tests only: change the override live and freeze the glitch clock for repeatable screenshots
    (window as unknown as { __goopsVisor?: unknown }).__goopsVisor = {
      set(o: Partial<VisorOverride>) { Object.assign(override, o) },
      freeze(t?: number) { frozenAt = t ?? null },
      get shown() { return shown },
      get amount() { return amountNow },
    }
  }

  const upload = (t: WebGLTexture, src: HTMLCanvasElement) => {
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
  }
  const bind = (P: Program, list: [WebGLTexture, string][], dst: Target | null) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null)
    gl.useProgram(P.p)
    list.forEach(([t, name], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(P.u[name], i) })
    gl.uniform2f(P.u.uRes, canvas.width, canvas.height)
  }

  return {
    frame(state, view, timeSec) {
      const fx = live.current
      const amount = override.amount ?? visorAmount(state.machines?.visor)
      amountNow = amount
      const pixOn = override.pixelate ?? fx.pixel.pixelate >= 0.5
      // the tank's rectangle in the full-window canvases, in whole device px (kept inside them)
      const dpr = view.dpr, fullW = tankCanvas.width, fullH = tankCanvas.height
      const r = tankRect(view, state.visibleWidth, state.height - state.bufferRows)
      const x0 = Math.max(0, Math.round(r.left * dpr)), x1 = Math.min(fullW, Math.round((r.left + r.width) * dpr))
      const y0 = Math.max(0, Math.round(r.top * dpr)), y1 = Math.min(fullH, Math.round((r.top + r.height) * dpr))
      // the curved-TV look is on whenever you're in the vat (visor-fx.json 'always'), so the pass runs even with no glitch
      const always = fx.always.curve > 0 || fx.always.vignette > 0
      curveNow = 0
      if ((amount <= 0 && !pixOn && !always) || x1 <= x0 || y1 <= y0) {
        if (shown) { shown = false; canvas.style.display = 'none' }
        return
      }
      if (!shown) { shown = true; canvas.style.display = '' }
      const goo = gooCanvas()
      const w = x1 - x0, h = y1 - y0
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      const box = { left: `${x0 / dpr}px`, top: `${y0 / dpr}px`, width: `${w / dpr}px`, height: `${h / dpr}px` }
      for (const k of ['left', 'top', 'width', 'height'] as const) if (canvas.style[k] !== box[k]) canvas.style[k] = box[k]
      if (!A || A.w !== w || A.h !== h) { freeTarget(gl, A); freeTarget(gl, B); A = makeTarget(gl, w, h, 1, false); B = null }

      gl.bindVertexArray(vao)
      gl.viewport(0, 0, w, h)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      upload(tankTex, tankCanvas)
      if (goo) upload(gooTex, goo)

      const pixPx = fx.pixel.pixSize * dpr, pixFirst = fx.pixel.pixFirst >= 0.5
      const glitch = amount > 0 || always
      if (glitch) curveNow = Math.max(fx.always.curve, fx.look.curve * amount) // as the shader: max(uCurveAlways, uCurve * a)
      const pixAfter = pixOn && glitch && !pixFirst // glitch -> pixels: its own pass at the end
      if (pixAfter && !B) B = makeTarget(gl, w, h, 1, false)

      // 1. scene (pixelated here when pixels come first, or when there's no glitch)
      bind(PC, [[tankTex, 'uTank'], [gooTex, 'uGoo']], glitch ? A : null)
      gl.uniform2f(PC.u.uOffset, x0, fullH - y1) // the rectangle's bottom-left corner (GL counts y up from the bottom)
      gl.uniform2f(PC.u.uFull, fullW, fullH)
      gl.uniform1f(PC.u.uPix, pixOn && !pixAfter ? pixPx : 0)
      gl.uniform1f(PC.u.uClipTop, goo ? view.topY * dpr : fullH)
      gl.uniform3f(PC.u.uBg, BG[0], BG[1], BG[2])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!glitch) return
      // 2. glitch
      bind(PG, [[A.t[0], 'uTex']], pixAfter ? B : null)
      gl.uniform1f(PG.u.uTime, frozenAt ?? timeSec)
      gl.uniform1f(PG.u.uAmt, amount)
      gl.uniform1f(PG.u.uCurveAlways, fx.always.curve)
      gl.uniform1f(PG.u.uVigAlways, fx.always.vignette)
      gl.uniform1f(PG.u.uGrain, pixAfter ? pixPx : 1.5 * dpr)
      gl.uniform1f(PG.u.uDpr, dpr)
      for (const [u, k] of LOOK_UNIFORMS) gl.uniform1f(PG.u[u], fx.look[k])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      // 3. pixels after the glitch
      if (pixAfter && B) {
        bind(PP, [[B.t[0], 'uTex']], null)
        gl.uniform1f(PP.u.uPix, pixPx)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    },
    curve: () => curveNow,
    dispose() {
      freeTarget(gl, A); freeTarget(gl, B)
      for (const P of [PC, PG, PP]) freeProgram(gl, P)
      gl.deleteTexture(tankTex); gl.deleteTexture(gooTex); gl.deleteVertexArray(vao)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
      if (import.meta.env.DEV) delete (window as unknown as { __goopsVisor?: unknown }).__goopsVisor
    },
  }
}
