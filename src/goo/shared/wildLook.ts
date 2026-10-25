// F39 THE WILD GOOP LOOK (rank 40+): ported from the sketch .planning/research/sketches/wild-goop.html (wildBase).
// Three looks in one shader piece, picked in content/tuning/twists-look.json "wild.look" (live in the Dev Kit):
//   oil     = a grey-violet body no goop has, with a thin-film rainbow band sliding across it (Claude's pick)
//   rainbow = v1: the real goop colours in turn, a wave sliding sideways (it IS red for a moment — kept to compare)
//   pearl   = a milky lavender body (well short of white — that's the Veteran) with a slow pastel shimmer
// Plus a soft pulsing halo + rim and tiny sparkles, on wild goop only. Both goo renderers include WILD_GLSL in their
// last shader (after their own uTime) and call setWild each frame; the tank canvas + next window use wildStops().
import looks from '../../../content/tuning/twists-look.json' // live: read where it's used (the Dev Kit's edits show at once)

export type Rgb = [number, number, number]

const LOOKS = ['rainbow', 'oil', 'pearl'] // the shader's uWLook number (the sketch's 0 / 1 / 2)

/** Which look is on: 0 rainbow, 1 oil, 2 pearl (unknown → oil). */
export function wildLookIndex(): number {
  const i = LOOKS.indexOf(String(looks.wild.look))
  return i < 0 ? 1 : i
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
/** The wild knobs as numbers right now. */
export function wildKnobs() {
  const w = looks.wild
  return {
    look: wildLookIndex(),
    speed: num(w.speed, 1),
    band: Math.max(0.05, num(w.band, 4)),
    saturation: num(w.saturation, 0.45),
    tint: num(w.tint, 0.4),
    glow: num(w.glow, 0.35),
    sparkle: num(w.sparkle, 0.25),
  }
}

/** The two-colour falling glow's knobs right now. */
export function twoColourGlow() {
  const t = looks.twoColour
  return { glow: num(t.glow, 0.6), size: num(t.size, 0.6), pulseHz: num(t.pulseHz, 1.2) }
}

// The GLSL piece (needs uTime declared before it). wildBase(p, n, th, glow): the body colour at view-cell point p
// (n = surface normal, th = thickness 0..1); glow = the halo / rim colour. wildSparkle(p, rim, glow): twinkles to add.
export const WILD_GLSL = `
uniform int uWLook; uniform float uWSpeed, uWBand, uWSat, uWTint, uWGlow, uWSpark; uniform vec3 uWRain[5];
vec3 wHsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
vec3 wDesat(vec3 c, float s){ float l = dot(c, vec3(0.299, 0.587, 0.114)); return mix(vec3(l), c, s); }
uint wHash(uvec2 v){ uint h = v.x * 1664525u + v.y * 1013904223u; h ^= h >> 16; h *= 0x7feb352du; h ^= h >> 15; h *= 0x846ca68bu; h ^= h >> 16; return h; }
float wH01(ivec2 g, uint s){ return float(wHash(uvec2(g + 4096) + uvec2(s * 7919u, s * 104729u)) & 0xffffffu) / 16777216.0; }
float wildPulse(){ return 0.75 + 0.25 * sin(uTime * (1.2 + 1.6 * uWSpeed)); }
vec3 wildBase(vec2 p, vec3 n, float th, out vec3 glow){
  float band = max(uWBand, 0.05);
  if (uWLook == 0) {
    float t = uTime * 2.5 * uWSpeed - p.x / band;
    float i = floor(t), u = fract(t);
    vec3 c = mix(uWRain[int(mod(i, 5.0))], uWRain[int(mod(i + 1.0, 5.0))], u);
    c = wDesat(c, uWSat) * (0.5 + uWTint);
    glow = c; return c;
  }
  if (uWLook == 1) {
    vec3 base = mix(vec3(0.27, 0.26, 0.33), vec3(0.58, 0.57, 0.65), uWTint);
    float sweep = (p.x * 0.85 + p.y * 0.45) / band - uTime * uWSpeed * 0.35;
    float bandOn = pow(0.5 + 0.5 * sin(sweep * 6.2832), 2.5);
    float hue = fract(sweep * 0.5 + n.x * 0.7 + n.y * 0.45 + th * 0.35);
    vec3 film = wDesat(wHsv(hue, 1.0, 1.0), uWSat * 0.8);
    vec3 c = mix(base, base * 0.7 + film * 0.55, 0.22 + 0.78 * bandOn);
    glow = mix(vec3(0.75, 0.72, 0.85), film, 0.6); return c;
  }
  vec3 base = mix(vec3(0.55, 0.51, 0.68), vec3(0.74, 0.69, 0.87), uWTint);
  float sw = (p.x * 0.7 - p.y * 0.55) / band;
  float hue = fract(0.35 * sin(sw * 3.0 + uTime * uWSpeed * 0.8) + n.x * 0.6 + n.y * 0.5 + uTime * uWSpeed * 0.04);
  vec3 film = wDesat(wHsv(hue, 1.0, 1.0), uWSat * 0.7);
  vec3 c = mix(base, base * 0.65 + film * 0.42, 0.65);
  glow = mix(vec3(0.86, 0.80, 1.0), film, 0.35); return c;
}
// the glow rim + sparkles on a wild body (rim = 1 at the very edge .. 0 inside)
vec3 wildExtras(vec2 p, float rim, vec3 wg){
  vec3 add = wg * uWGlow * rim * wildPulse() * 0.6;
  vec2 sp = p * 2.0; ivec2 g = ivec2(floor(sp));
  if (wH01(g, 1u) < uWSpark * 0.5) {
    vec2 d = (fract(sp) - (0.3 + 0.4 * vec2(wH01(g, 2u), wH01(g, 3u)))) * 2.0;
    float tw = pow(max(0.0, sin(uTime * (1.2 + 2.0 * wH01(g, 4u)) + 6.2832 * wH01(g, 5u))), 4.0);
    float star = pow(max(0.0, 1.0 - length(d) * 2.8), 2.0) * 1.6 + max(0.0, 1.0 - abs(d.x) * 9.0) * max(0.0, 1.0 - abs(d.y) * 1.1)
               + max(0.0, 1.0 - abs(d.y) * 9.0) * max(0.0, 1.0 - abs(d.x) * 1.1);
    add += mix(vec3(1.0), wg, 0.3) * min(star, 1.5) * tw * (1.0 - rim);
  }
  return add;
}
// the soft halo just outside a wild clump: w = the wide-blurred wild field here
vec4 wildHalo(vec2 p, float w){
  if (uWGlow <= 0.0 || w <= 0.002) return vec4(0.0);
  vec3 gcol; wildBase(p, vec3(0.0, 0.0, 1.0), 0.0, gcol);
  float g = uWGlow * smoothstep(0.0, 0.5, w) * wildPulse() * 0.55;
  return vec4(gcol * g, g * 0.6);
}`

export const WILD_UNIFORMS = ['uWLook', 'uWSpeed', 'uWBand', 'uWSat', 'uWTint', 'uWGlow', 'uWSpark', 'uWRain']

/** Set the wild look's uniforms (the program must be in use). cols = the renderer's palette table (slot c at c × 3). */
export function setWild(gl: WebGL2RenderingContext, u: Record<string, WebGLUniformLocation | null>, cols: Float32Array): void {
  const k = wildKnobs()
  gl.uniform1i(u.uWLook, k.look)
  gl.uniform1f(u.uWSpeed, k.speed)
  gl.uniform1f(u.uWBand, k.band)
  gl.uniform1f(u.uWSat, k.saturation)
  gl.uniform1f(u.uWTint, k.tint)
  gl.uniform1f(u.uWGlow, k.glow)
  gl.uniform1f(u.uWSpark, k.sparkle)
  gl.uniform3fv(u.uWRain, cols.subarray(3, 18)) // the v1 rainbow: the five goop colours (slots 1-5), never white / black
}

// ---------------------------------------------------------------- the same look in 2D (tank canvas, next window)

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
function hsv(h: number): Rgb {
  const k = (n: number) => Math.min(1, Math.max(0, Math.abs(((h * 6 + n) % 6) - 3) - 1))
  return [k(0), k(4), k(2)]
}
function desat(c: Rgb, s: number): Rgb {
  const l = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114
  return mix([l, l, l], c, s)
}
export const rgbHex = (c: Rgb) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')

/** The wild body's plain colour (no sheen) — for anything that needs one colour (e.g. the ready halo). */
export function wildBaseRgb(): Rgb {
  const k = wildKnobs()
  if (k.look === 2) return mix([0.55, 0.51, 0.68], [0.74, 0.69, 0.87], k.tint)
  return mix([0.27, 0.26, 0.33], [0.58, 0.57, 0.65], k.tint) // (rainbow has no body colour: oil's stands in)
}

/** Colour stops (0..1 along a diagonal) for a 2D wild cell: the body with the sheen band across it. `rainbow` = the
 *  five goop colours as hex (v1's look only). t = seconds on the looks clock (the band slides; 0 = still). */
export function wildStops(rainbow: string[] = [], t = 0): [number, string][] {
  const k = wildKnobs()
  if (k.look === 0 && rainbow.length) return rainbow.map((h, i) => [i / Math.max(1, rainbow.length - 1), h])
  const base = wildBaseRgb()
  const out: [number, string][] = []
  for (let i = 0; i <= 4; i++) {
    const s = i / 4
    const hue = (((s * 0.5 + t * k.speed * 0.175) % 1) + 1) % 1
    const film = desat(hsv(hue), k.saturation * (k.look === 2 ? 0.7 : 0.8))
    const on = k.look === 2 ? 0.65 : 0.22 + 0.78 * Math.pow(0.5 + 0.5 * Math.sin((s - t * k.speed * 0.35) * 6.2832), 2.5)
    const lit = k.look === 2 ? mix(base, [base[0] * 0.65 + film[0] * 0.42, base[1] * 0.65 + film[1] * 0.42, base[2] * 0.65 + film[2] * 0.42], on)
      : mix(base, [base[0] * 0.7 + film[0] * 0.55, base[1] * 0.7 + film[1] * 0.55, base[2] * 0.7 + film[2] * 0.55], on)
    out.push([s, rgbHex(lit)])
  }
  return out
}
