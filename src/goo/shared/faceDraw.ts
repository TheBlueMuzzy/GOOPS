// THE FACES' PAINTBRUSH (F62): draws the goop's eyes, brows, closed-eye lines and mouths INSIDE a goo renderer's picture
// (on its own WebGL canvas, right after the goo's last pass) — not as a 2D layer on top, so one shared pixel shader can
// later treat goo and faces alike (Muzzy 2026-10-24). Both renderers use it; what to draw comes from faces.ts.
// Each shape is one quad in view cells (x = 0 at the centre column's centre, y = tank row), shaded by a small shader:
//   eye   — a white ellipse (squashed by how open it is) with the pupil inside it
//   line  — a round-ended stroke in the pupil colour (blinks, the zap's > <, worried brows)
//   mouth — a dark ellipse
// Clipped to the tank window like the goo, and see-through inside the x-ray boxes (F36) like the goo.
import { makeProgram, freeProgram, type Program } from './gl'
import { XRAY_GLSL, XRAY_UNIFORMS } from './xray'

const KIND_EYE = 0
const KIND_LINE = 1
const KIND_MOUTH = 2
const FLOATS = 10 // per vertex: x, y (view cells) · u, v (the shape's own units) · kind · p0..p3 · alpha

const FACE_VS = `#version 300 es
layout(location=0) in vec4 aPos;   // x, y (view cells), u, v (the shape's own units)
layout(location=1) in vec4 aShape; // kind, p0, p1, p2
layout(location=2) in vec2 aMore;  // p3, alpha
uniform vec2 uOrigin, uRes; uniform float uCell;
out vec2 vUv; out vec2 vP; flat out vec4 vShape; flat out vec2 vMore;
void main(){
  vec2 px = uOrigin + aPos.xy * uCell;
  vUv = aPos.zw; vP = aPos.xy; vShape = aShape; vMore = aMore;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}`

const FACE_FS = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vP; flat in vec4 vShape; flat in vec2 vMore;
uniform vec3 uEye, uPupil, uMouth; uniform float uCell, uClipL, uClipR, uClipB;
out vec4 outColor;
${XRAY_GLSL}
// 1 inside, 0 outside, with a one-pixel soft edge (d = signed distance-like value, 0 on the edge, < 0 inside)
float fill(float d){ float aa = max(fwidth(d), 1e-4); return 1.0 - smoothstep(-aa, aa, d); }
void main(){
  int kind = int(vShape.x + 0.5);
  vec3 col; float a;
  if (kind == ${KIND_EYE}) {            // p0 = open (0..1), p1, p2 = pupil centre, p3 = pupil radius (eye radii)
    float open = max(vShape.y, 0.02);
    float eye = fill(length(vec2(vUv.x, vUv.y / open)) - 1.0);
    float pupil = fill(length(vUv - vShape.zw) - vMore.x);
    col = mix(uEye, uPupil, pupil); a = eye;
  } else if (kind == ${KIND_LINE}) {    // p0 = length, p1 = half width (cells); u runs along the stroke
    float u = vUv.x - clamp(vUv.x, 0.0, vShape.y);
    col = uPupil; a = fill(length(vec2(u, vUv.y)) - vShape.z);
  } else {                              // the mouth: a unit circle in its own units, 85% solid
    col = uMouth; a = 0.85 * fill(length(vUv) - 1.0);
  }
  float px = 1.0 / uCell;
  float clip = smoothstep(uClipL - px, uClipL + px, vP.x) * (1.0 - smoothstep(uClipR - px, uClipR + px, vP.x))
    * (1.0 - smoothstep(uClipB - px, uClipB + px, vP.y));
  a *= vMore.y * clip * xrayKeep(vP, px);
  outColor = vec4(col * a, a); // premultiplied, like the goo canvas
}`

export interface FaceFrame {
  originX: number // device px of view cell (0, 0)
  originY: number
  cell: number // device px per cell
  width: number // the canvas, device px
  height: number
  clipL: number // the tank window, view cells (tankWindow) + its floor
  clipR: number
  clipB: number
  eye: [number, number, number] // colours, 0..1
  pupil: [number, number, number]
  mouth: [number, number, number]
}

export class FaceDrawer {
  private gl: WebGL2RenderingContext
  private P: Program
  private vao: WebGLVertexArrayObject
  private vbo: WebGLBuffer
  private buf = new Float32Array(FLOATS * 6 * 64)
  private n = 0 // floats written this frame

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.P = makeProgram(gl, FACE_VS, FACE_FS, ['uOrigin', 'uRes', 'uCell', 'uEye', 'uPupil', 'uMouth', 'uClipL', 'uClipR', 'uClipB', ...XRAY_UNIFORMS])
    this.vao = gl.createVertexArray()!
    this.vbo = gl.createBuffer()!
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, FLOATS * 4, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, FLOATS * 4, 16)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, FLOATS * 4, 32)
    gl.bindVertexArray(null)
  }

  begin() {
    this.n = 0
  }

  get empty() {
    return this.n === 0
  }

  // one corner: view position, the shape's own coordinates, and the shape's numbers
  private corner(x: number, y: number, u: number, v: number, kind: number, p0: number, p1: number, p2: number, p3: number, alpha: number) {
    if (this.n + FLOATS > this.buf.length) {
      const nb = new Float32Array(this.buf.length * 2)
      nb.set(this.buf)
      this.buf = nb
    }
    const b = this.buf
    let i = this.n
    b[i++] = x; b[i++] = y; b[i++] = u; b[i++] = v
    b[i++] = kind; b[i++] = p0; b[i++] = p1; b[i++] = p2; b[i++] = p3; b[i++] = alpha
    this.n = i
  }

  // an axis-aligned box (x0..x1, y0..y1 in view cells) whose own coordinates run u0..u1, v0..v1: two triangles
  private box(x0: number, y0: number, x1: number, y1: number, u0: number, v0: number, u1: number, v1: number,
    kind: number, p0: number, p1: number, p2: number, p3: number, alpha: number) {
    this.corner(x0, y0, u0, v0, kind, p0, p1, p2, p3, alpha)
    this.corner(x1, y0, u1, v0, kind, p0, p1, p2, p3, alpha)
    this.corner(x1, y1, u1, v1, kind, p0, p1, p2, p3, alpha)
    this.corner(x0, y0, u0, v0, kind, p0, p1, p2, p3, alpha)
    this.corner(x1, y1, u1, v1, kind, p0, p1, p2, p3, alpha)
    this.corner(x0, y1, u0, v1, kind, p0, p1, p2, p3, alpha)
  }

  // An open eye at (x, y), radius r (cells), open 0..1 (its height = r × open), the pupil at (px, py) and radius pr —
  // all three in eye radii (0, 0 = the middle). The pupil never shows outside the eye.
  eye(x: number, y: number, r: number, open: number, px: number, py: number, pr: number, alpha: number) {
    const m = 1.15 // a little room round the shape for the soft edge
    this.box(x - r * m, y - r * m, x + r * m, y + r * m, -m, -m, m, m, KIND_EYE, open, px, py, pr, alpha)
  }

  // A round-ended stroke from (x0, y0) to (x1, y1), half width hw (cells), in the pupil colour
  line(x0: number, y0: number, x1: number, y1: number, hw: number, alpha: number) {
    const dx = x1 - x0
    const dy = y1 - y0
    const L = Math.hypot(dx, dy)
    const ux = L > 1e-6 ? dx / L : 1 // along the stroke
    const uy = L > 1e-6 ? dy / L : 0
    const e = hw * 1.6 // room past each end and to each side
    // four corners of the turned rectangle round the stroke; u = along (0 … L), v = across
    const c = (s: number, t: number) => this.corner(x0 + ux * s - uy * t, y0 + uy * s + ux * t, s, t, KIND_LINE, L, hw, 0, 0, alpha)
    c(-e, -e); c(L + e, -e); c(L + e, e)
    c(-e, -e); c(L + e, e); c(-e, e)
  }

  // A mouth at (x, y): an ellipse w wide and h tall (half sizes, cells)
  mouth(x: number, y: number, w: number, h: number, alpha: number) {
    const m = 1.3
    this.box(x - w * m, y - h * m, x + w * m, y + h * m, -m, -m, m, m, KIND_MOUTH, 0, 0, 0, 0, alpha)
  }

  // Draw everything queued since begin() onto the framebuffer that's bound (the goo canvas), over the goo.
  // setXray = the renderer's x-ray uniforms for this program (shared/xray.ts setXray).
  flush(F: FaceFrame, setXray: (u: Program['u']) => void) {
    if (!this.n) return
    const gl = this.gl
    const u = this.P.u
    gl.useProgram(this.P.p)
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.bufferData(gl.ARRAY_BUFFER, this.buf.subarray(0, this.n), gl.STREAM_DRAW)
    gl.uniform2f(u.uOrigin, F.originX, F.originY)
    gl.uniform2f(u.uRes, F.width, F.height)
    gl.uniform1f(u.uCell, F.cell)
    gl.uniform3f(u.uEye, F.eye[0], F.eye[1], F.eye[2])
    gl.uniform3f(u.uPupil, F.pupil[0], F.pupil[1], F.pupil[2])
    gl.uniform3f(u.uMouth, F.mouth[0], F.mouth[1], F.mouth[2])
    gl.uniform1f(u.uClipL, F.clipL)
    gl.uniform1f(u.uClipR, F.clipR)
    gl.uniform1f(u.uClipB, F.clipB)
    setXray(u)
    gl.enable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.TRIANGLES, 0, this.n / FLOATS)
    gl.disable(gl.BLEND)
    gl.bindVertexArray(null)
  }

  dispose() {
    const gl = this.gl
    freeProgram(gl, this.P)
    gl.deleteBuffer(this.vbo)
    gl.deleteVertexArray(this.vao)
  }
}
