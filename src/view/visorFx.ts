// The visor glitch (F25) + the pixel filter: a third canvas (WebGL2) over the tank and goo canvases. Each frame it uploads
// both canvases as textures, composites them, runs the glitch, and/or pixelates, and draws the result. While it shows, the
// two canvases under it are hidden (visibility, not unmounted). With no glitch and the pixel filter off it hides and does
// nothing at all, so the game looks exactly as without it. The HUD is DOM above the stage, so it never glitches.
// Knobs: content/tuning/visor-fx.json. Shaders: ./visorShaders.ts (the sketch's, unchanged).
import type { MachineState, ShiftState } from '../engine/types'
import type { GooView } from '../goo/types'
import { FULLSCREEN_VS, makeProgram, freeProgram, makeTarget, freeTarget, type Program, type Target } from '../goo/shared/gl'
import { FS_COMPOSITE, FS_GLITCH, FS_PIX } from './visorShaders'
import fx from '../../content/tuning/visor-fx.json'

export type VisorFxConfig = typeof fx

const BG = [5 / 255, 7 / 255, 13 / 255] // the stage background (game.css .stage), under the tank canvas
const LOOK_UNIFORMS: [string, keyof VisorFxConfig['look']][] = [['uScan', 'scan'], ['uRgb', 'rgb'], ['uRoll', 'roll'],
  ['uNoise', 'noise'], ['uFlicker', 'flicker'], ['uTear', 'tear'], ['uTearSize', 'tearSize'], ['uBlock', 'block'],
  ['uBlockSize', 'blockSize'], ['uVig', 'vignette'], ['uCurve', 'curve'], ['uDead', 'dead'], ['uDrop', 'dropout']]

// Glitch amount from the visor's signal: 0 when fine (or locked), 1 when broken.
export function visorAmount(visor: MachineState | undefined, cfg: Pick<VisorFxConfig, 'healthClean' | 'healthBroken'> = fx): number {
  if (!visor || !visor.unlocked) return 0
  if (visor.broken) return 1
  const t = (cfg.healthClean - visor.health) / (cfg.healthClean - cfg.healthBroken)
  return Math.min(1, Math.max(0, t))
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
  dispose(): void
}

export function createVisorFx(stage: HTMLElement, tankCanvas: HTMLCanvasElement, gooCanvas: () => HTMLCanvasElement | null): VisorFx {
  const canvas = document.createElement('canvas')
  canvas.className = 'stage-layer'
  canvas.dataset.visor = ''
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '1' // above the goo canvas even after a style switch re-adds it (React appends it last)
  canvas.style.display = 'none'
  stage.appendChild(canvas)
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false })
  if (!gl) { canvas.remove(); return { frame() {}, dispose() {} } } // no WebGL2: the game just plays without the effect

  const PC = makeProgram(gl, FULLSCREEN_VS, FS_COMPOSITE, ['uTank', 'uGoo', 'uRes', 'uPix', 'uClipTop', 'uBg'])
  const PG = makeProgram(gl, FULLSCREEN_VS, FS_GLITCH, ['uTex', 'uRes', 'uTime', 'uAmt', 'uGrain', 'uDpr', ...LOOK_UNIFORMS.map(([u]) => u)])
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
  if (import.meta.env.DEV) {
    // dev + tests only: change the override live and freeze the glitch clock for repeatable screenshots
    (window as unknown as { __goopsVisor?: unknown }).__goopsVisor = {
      set(o: Partial<VisorOverride>) { Object.assign(override, o) },
      freeze(t?: number) { frozenAt = t ?? null },
      get shown() { return shown },
    }
  }

  const hideUnder = (hide: boolean) => {
    const v = hide ? 'hidden' : ''
    for (const c of [tankCanvas, gooCanvas()]) if (c && c.style.visibility !== v) c.style.visibility = v
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
      const amount = override.amount ?? visorAmount(state.machines?.visor)
      const pixOn = override.pixelate ?? fx.pixel.pixelate >= 0.5
      if (amount <= 0 && !pixOn) {
        if (shown) { shown = false; canvas.style.display = 'none'; hideUnder(false) }
        return
      }
      if (!shown) { shown = true; canvas.style.display = '' }
      hideUnder(true) // every frame: a goo-style switch brings a fresh goo canvas
      const goo = gooCanvas()
      if (canvas.width !== tankCanvas.width || canvas.height !== tankCanvas.height) {
        canvas.width = tankCanvas.width; canvas.height = tankCanvas.height
      }
      const w = canvas.width, h = canvas.height
      if (!A || A.w !== w || A.h !== h) { freeTarget(gl, A); freeTarget(gl, B); A = makeTarget(gl, w, h, 1, false); B = null }

      gl.bindVertexArray(vao)
      gl.viewport(0, 0, w, h)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      upload(tankTex, tankCanvas)
      if (goo) upload(gooTex, goo)

      const dpr = view.dpr, pixPx = fx.pixel.pixSize * dpr, pixFirst = fx.pixel.pixFirst >= 0.5
      const glitch = amount > 0
      const pixAfter = pixOn && glitch && !pixFirst // glitch -> pixels: its own pass at the end
      if (pixAfter && !B) B = makeTarget(gl, w, h, 1, false)

      // 1. scene (pixelated here when pixels come first, or when there's no glitch)
      bind(PC, [[tankTex, 'uTank'], [gooTex, 'uGoo']], glitch ? A : null)
      gl.uniform1f(PC.u.uPix, pixOn && !pixAfter ? pixPx : 0)
      gl.uniform1f(PC.u.uClipTop, goo ? view.topY * dpr : h)
      gl.uniform3f(PC.u.uBg, BG[0], BG[1], BG[2])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!glitch) return
      // 2. glitch
      bind(PG, [[A.t[0], 'uTex']], pixAfter ? B : null)
      gl.uniform1f(PG.u.uTime, frozenAt ?? timeSec)
      gl.uniform1f(PG.u.uAmt, amount)
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
    dispose() {
      hideUnder(false)
      freeTarget(gl, A); freeTarget(gl, B)
      for (const P of [PC, PG, PP]) freeProgram(gl, P)
      gl.deleteTexture(tankTex); gl.deleteTexture(gooTex); gl.deleteVertexArray(vao)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
      if (import.meta.env.DEV) delete (window as unknown as { __goopsVisor?: unknown }).__goopsVisor
    },
  }
}
