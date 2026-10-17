// Small WebGL2 helpers shared by both goo renderers: programs, multi-texture render targets, cleanup.

// One triangle that covers the whole viewport (no vertex buffer needed)
export const FULLSCREEN_VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`

export interface Program {
  p: WebGLProgram
  u: Record<string, WebGLUniformLocation | null>
  shaders: WebGLShader[]
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Goo shader: ' + gl.getShaderInfoLog(s))
  return s
}

export function makeProgram(gl: WebGL2RenderingContext, vs: string, fs: string, names: string[]): Program {
  const p = gl.createProgram()!
  const shaders = [compile(gl, gl.VERTEX_SHADER, vs), compile(gl, gl.FRAGMENT_SHADER, fs)]
  for (const s of shaders) gl.attachShader(p, s)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Goo program: ' + gl.getProgramInfoLog(p))
  const u: Program['u'] = {}
  for (const n of names) u[n] = gl.getUniformLocation(p, n)
  return { p, u, shaders }
}

export function freeProgram(gl: WebGL2RenderingContext, P: Program | null): void {
  if (!P) return
  for (const s of P.shaders) gl.deleteShader(s)
  gl.deleteProgram(P.p)
}

// A render target with N colour textures (MRT) and an optional stencil buffer
export interface Target {
  w: number
  h: number
  t: WebGLTexture[]
  fb: WebGLFramebuffer
  rb: WebGLRenderbuffer | null
}

export function makeTarget(gl: WebGL2RenderingContext, w: number, h: number, count: number, float: boolean, stencil = false): Target {
  const t: WebGLTexture[] = []
  for (let i = 0; i < count; i++) {
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texStorage2D(gl.TEXTURE_2D, 1, float ? gl.RGBA16F : gl.RGBA8, w, h)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    t.push(tex)
  }
  const fb = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  t.forEach((tex, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex, 0))
  let rb: WebGLRenderbuffer | null = null
  if (stencil) {
    rb = gl.createRenderbuffer()!
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, w, h)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, rb)
  }
  gl.drawBuffers(t.map((_, i) => gl.COLOR_ATTACHMENT0 + i))
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { w, h, t, fb, rb }
}

export function freeTarget(gl: WebGL2RenderingContext, T: Target | null): void {
  if (!T) return
  for (const tex of T.t) gl.deleteTexture(tex)
  gl.deleteFramebuffer(T.fb)
  if (T.rb) gl.deleteRenderbuffer(T.rb)
}

// Bind each target texture to a texture unit and point the named sampler uniforms at them
export function bindTextures(gl: WebGL2RenderingContext, P: Program, list: [WebGLTexture, string][]): void {
  list.forEach(([tex, name], i) => {
    gl.activeTexture(gl.TEXTURE0 + i)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(P.u[name], i)
  })
}

// The goo canvas: transparent, premultiplied alpha, sits over the tank's 2D canvas
export function gooContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, stencil: false, depth: false })
  if (!gl) throw new Error('WebGL2 is not available on this device')
  return gl
}

// Match the canvas backing size to the view (CSS size x capped pixel ratio). Returns true if it changed.
export function fitCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number, dpr: number): boolean {
  const w = Math.max(1, Math.round(cssW * dpr))
  const h = Math.max(1, Math.round(cssH * dpr))
  if (canvas.width === w && canvas.height === h) return false
  canvas.width = w
  canvas.height = h
  return true
}
