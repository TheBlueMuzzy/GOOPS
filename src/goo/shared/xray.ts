// F36 the x-ray (Muzzy, 2026-10-18): a crack under goop stays visible — the tank view draws a dotted box round it, and
// the goo inside that box goes see-through so the crack and the box show through. Both goo renderers use this: the
// boxes go to their last shader as rectangles in view cells, and the shader thins the goo inside them (XRAY_GLSL).
import type { ShiftState } from '../../engine/types'
import { screenColumn, type GooView } from '../types'

export const XRAY_MAX = 8 // boxes the shader can take at once (more covered cracks than this on screen: the rest stay solid)

// The GLSL piece: uXray[i] = (left, top, right, bottom) in view cells (x = 0 at the centre column's centre, y = tank row
// from the top of the spawn rows, down). Returns how solid the goo stays at p: uXrayA inside a box, 1 outside.
export const XRAY_GLSL = `
uniform vec4 uXray[${XRAY_MAX}]; uniform int uXrayN; uniform float uXrayA;
float xrayKeep(vec2 p, float px) {
  float k = 1.0;
  for (int i = 0; i < ${XRAY_MAX}; i++) {
    if (i >= uXrayN) break;
    vec4 r = uXray[i];
    vec2 d = max(r.xy - p, p - r.zw);
    float inside = 1.0 - smoothstep(0.0, px * 1.5, max(d.x, d.y));
    k = min(k, mix(1.0, uXrayA, inside));
  }
  return k;
}`

export const XRAY_UNIFORMS = ['uXray', 'uXrayN', 'uXrayA']

// Fill `out` (XRAY_MAX × 4 floats) with this frame's boxes; returns how many. Boxes out of view are skipped.
export function xrayRects(state: ShiftState, view: GooView, out: Float32Array): number {
  const x = view.xray
  if (!x || x.alpha >= 1) return 0
  let n = 0
  const half = state.visibleWidth / 2 + 1
  for (const i of x.cells) {
    if (n >= XRAY_MAX) break
    const sc = screenColumn(i % state.width, view.camera, state.width)
    if (Math.abs(sc) > half) continue
    const y = Math.floor(i / state.width)
    out.set([sc - 0.5 - x.pad, y - x.pad, sc + 0.5 + x.pad, y + 1 + x.pad], n * 4)
    n++
  }
  return n
}

// Set the uniforms on the program in use (u = its uniform locations).
export function setXray(gl: WebGL2RenderingContext, u: Record<string, WebGLUniformLocation | null>, state: ShiftState, view: GooView, buf: Float32Array) {
  const n = xrayRects(state, view, buf)
  gl.uniform1i(u.uXrayN, n)
  gl.uniform1f(u.uXrayA, Math.max(0, Math.min(1, view.xray?.alpha ?? 1)))
  if (n) gl.uniform4fv(u.uXray, buf)
}
