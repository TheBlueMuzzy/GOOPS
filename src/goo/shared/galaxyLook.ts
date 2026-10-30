// F64 THE GALAXY-BLACK LOOK (the final shift, rank 50 — design/story.md: "all the goop is galaxy black — black with
// shimmering stars"). Black is shift.json's 7th colour and only comes at rank 50, so colour slot 7 is always drawn this
// way (like the wild goop's slot 8, wildLook.ts):
//   - the body: a deep night colour with nebula clouds drifting through it, seen like a window onto space (the clouds and
//     stars are pinned to the view, not the goop — the goop moves over a still sky, the classic galaxy-texture look)
//   - shimmering stars: two layers (many small, a few bigger with a cross glint), each twinkling at its own pace
//   - so black reads on the dark tank: its edge glows in the rim colour and a soft halo rings each clump
// Both goo renderers include GALAXY_GLSL in their last shader (after their own uTime) and call setGalaxy each frame; the
// tank canvas (cracks, ghost, arrows) and the next window use the 2D helpers below. Numbers: content/tuning/galaxy-look.json
// (live: read where they're used, so the Dev Kit's edits show at once).
import look from '../../../content/tuning/galaxy-look.json'
import { hexToRgb } from './palette'

/** The colour slot drawn as galaxy black (shift.json colors: 'black' is the 7th). */
export const GALAXY_SLOT = 7

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

// The GLSL piece (needs uTime declared before it). galaxyBase(p) = the body colour at view-cell point p;
// galaxyExtras(p, rim) = the stars + the edge glow to add (rim = 1 at the very edge .. 0 inside);
// galaxyHalo(w) = the soft glow just outside a black clump (w = the wide-blurred black field here).
export const GALAXY_GLSL = `
uniform vec3 uGBody, uGNeb1, uGNeb2, uGRim, uGStar; uniform float uGNeb, uGNebSize, uGDrift, uGRimGlow, uGHalo, uGStars, uGStarSize, uGTwinkle, uGTwinkleDepth;
uint gHash(uvec2 v){ uint h = v.x * 1664525u + v.y * 1013904223u; h ^= h >> 16; h *= 0x7feb352du; h ^= h >> 15; h *= 0x846ca68bu; h ^= h >> 16; return h; }
float gH01(ivec2 g, uint s){ return float(gHash(uvec2(g + 8192) + uvec2(s * 7919u, s * 104729u)) & 0xffffffu) / 16777216.0; }
float gNoise(vec2 q){
  ivec2 i = ivec2(floor(q)); vec2 f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gH01(i, 1u), gH01(i + ivec2(1, 0), 1u), f.x), mix(gH01(i + ivec2(0, 1), 1u), gH01(i + ivec2(1, 1), 1u), f.x), f.y);
}
float gClouds(vec2 q){ return gNoise(q) * 0.6 + gNoise(q * 2.03 + 7.1) * 0.3 + gNoise(q * 4.1 + 2.3) * 0.1; }
vec3 galaxyBase(vec2 p){
  vec2 q = p / max(uGNebSize, 0.1) + vec2(uTime * uGDrift, uTime * uGDrift * 0.37) / max(uGNebSize, 0.1);
  vec3 c = mix(uGBody, uGNeb1, uGNeb * smoothstep(0.42, 0.85, gClouds(q)));
  return mix(c, uGNeb2, uGNeb * 0.8 * smoothstep(0.5, 0.9, gClouds(q * 1.3 + 11.7)));
}
// one layer of stars: sc = layer cells per view cell, chance = share of layer cells with a star, k = how tight
vec3 gStars(vec2 p, float sc, float chance, float k, float bright, uint seed){
  vec2 sp = p * sc + vec2(uTime * uGDrift * sc * 0.5, 0.0);
  ivec2 g = ivec2(floor(sp));
  if (gH01(g, seed) >= chance) return vec3(0.0);
  vec2 d = fract(sp) - (0.2 + 0.6 * vec2(gH01(g, seed + 1u), gH01(g, seed + 2u)));
  float s = max(uGStarSize, 0.05);
  float core = exp(-dot(d, d) * k / (s * s));
  float glint = max(0.0, 1.0 - abs(d.x) * 14.0 / s) * max(0.0, 1.0 - abs(d.y) * 2.2 / s)
              + max(0.0, 1.0 - abs(d.y) * 14.0 / s) * max(0.0, 1.0 - abs(d.x) * 2.2 / s);
  // twinkle: two waves at odd speeds (uneven, like a real star's flicker); uGTwinkleDepth = how far it dims (0 = steady)
  float a = uTime * uGTwinkle * (0.7 + 1.6 * gH01(g, seed + 3u)) + 6.2832 * gH01(g, seed + 4u);
  float tw = 1.0 - clamp(uGTwinkleDepth, 0.0, 1.0) * (1.0 - pow(0.5 + 0.5 * (0.6 * sin(a) + 0.4 * sin(a * 2.37 + 1.9)), 2.0));
  return uGStar * (core + glint * 0.35 * bright) * tw * bright;
}
vec3 galaxyExtras(vec2 p, float rim){
  vec3 add = gStars(p, 3.0, uGStars * 0.5, 50.0, 0.9, 21u) + gStars(p, 1.3, uGStars * 0.35, 90.0, 1.5, 41u);
  return add * (1.0 - rim * 0.7) + uGRim * uGRimGlow * rim;
}
vec4 galaxyHalo(float w){
  if (uGHalo <= 0.0 || w <= 0.002) return vec4(0.0);
  float g = uGHalo * smoothstep(0.0, 0.5, w) * 0.5;
  return vec4(uGRim * g, g * 0.6);
}`

export const GALAXY_UNIFORMS = ['uGBody', 'uGNeb1', 'uGNeb2', 'uGRim', 'uGStar', 'uGNeb', 'uGNebSize', 'uGDrift', 'uGRimGlow', 'uGHalo', 'uGStars', 'uGStarSize', 'uGTwinkle', 'uGTwinkleDepth']

const rgb = new Float32Array(3) // (one buffer, refilled: no garbage per frame)
function setRgb(gl: WebGL2RenderingContext, at: WebGLUniformLocation | null, hex: unknown) {
  const [r, g, b] = hexToRgb(String(hex))
  rgb[0] = r; rgb[1] = g; rgb[2] = b
  gl.uniform3fv(at, rgb)
}

/** Set the galaxy look's uniforms (the program must be in use). */
export function setGalaxy(gl: WebGL2RenderingContext, u: Record<string, WebGLUniformLocation | null>): void {
  setRgb(gl, u.uGBody, look.body)
  setRgb(gl, u.uGNeb1, look.nebula1)
  setRgb(gl, u.uGNeb2, look.nebula2)
  setRgb(gl, u.uGRim, look.rim)
  setRgb(gl, u.uGStar, look.starColor)
  gl.uniform1f(u.uGNeb, num(look.nebula, 0.6))
  gl.uniform1f(u.uGNebSize, num(look.nebulaSize, 2.5))
  gl.uniform1f(u.uGDrift, num(look.drift, 0.08))
  gl.uniform1f(u.uGRimGlow, num(look.rimGlow, 0.9))
  gl.uniform1f(u.uGHalo, num(look.halo, 0.45))
  gl.uniform1f(u.uGStars, num(look.stars, 0.55))
  gl.uniform1f(u.uGStarSize, num(look.starSize, 1))
  gl.uniform1f(u.uGTwinkle, num(look.twinkle, 4))
  gl.uniform1f(u.uGTwinkleDepth, num(look.twinkleDepth, 0.85))
}

// ---------------------------------------------------------------- the same look in 2D (tank canvas, next window)

/** The colours a 2D black cell / crack is drawn with right now: body (the night), rim (its glow) and the stars'. */
export function galaxyColours(): { body: string; rim: string; star: string; core: string } {
  return { body: String(look.body), rim: String(look.rim), star: String(look.starColor), core: String(look.crackCore) }
}

/** How many stars twinkle along a black crack, and how fast. */
export function galaxyCrackStars(): { count: number; twinkle: number; depth: number; size: number } {
  return { count: Math.max(0, Math.round(num(look.crackStars, 3))), twinkle: num(look.twinkle, 4),
    depth: Math.min(1, Math.max(0, num(look.twinkleDepth, 0.85))), size: num(look.starSize, 1) }
}
