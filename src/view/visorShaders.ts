// Shaders for the visor glitch overlay (F25). Each is one triangle over the whole overlay (FULLSCREEN_VS in
// src/goo/shared/gl.ts) — and the overlay is just the tank's rectangle, so uRes = the tank's size in device px.
// FS_GLITCH and FS_PIX are the sketch's (.planning/research/sketches/visor-glitch.html), unchanged.

// The scene: the tank canvas, then the goo canvas over it (both uploaded premultiplied), over the stage background.
// The overlay only covers the TANK's rectangle (Muzzy, 2026-10-18: the curved-TV look over the viewing area, not the
// whole screen), so this pass cuts that rectangle out of the two full-window canvases: uOffset = where the rectangle's
// bottom-left corner is in them (device px, y up), uFull = their size.
// uPix > 0 snaps every pixel to the pixel filter's grid (pixelate folded into this pass: no extra pass for pixels-first).
// uClipTop = device px from the top where the goo starts (the spawn rows above the tank stay hidden, like the goo canvas's clip).
export const FS_COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uTank, uGoo; uniform vec2 uRes, uOffset, uFull; uniform float uPix, uClipTop; uniform vec3 uBg;
out vec4 o;
void main() {
  vec2 p = gl_FragCoord.xy;
  if (uPix > 0.0) p = (floor(p / uPix) + 0.5) * uPix;
  p += uOffset; // into the full-window canvases
  vec2 uv = p / uFull;
  vec4 t = texture(uTank, uv);
  vec3 col = uBg * (1.0 - t.a) + t.rgb;
  vec4 g = uFull.y - p.y < uClipTop ? vec4(0.0) : texture(uGoo, uv);
  o = vec4(col * (1.0 - g.a) + g.rgb, 1.0);
}`

// The glitch: one pass, 3 texture reads (R, G, B for the RGB split). Everything else is maths on the coordinates.
export const FS_GLITCH = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime, uAmt, uGrain, uDpr;
uniform float uCurveAlways, uVigAlways; // the curved-TV look that's on whenever you're in the vat (visor-fx.json 'always')
uniform float uScan, uRgb, uRoll, uNoise, uFlicker, uTear, uTearSize, uBlock, uBlockSize, uVig, uCurve, uDead, uDrop;
out vec4 o;
// integer hash (sin-based hashes repeat at big inputs and made dead lines show at amount 0)
uint hu(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float h1(float n) { return float(hu(floatBitsToUint(n)) >> 8) / 16777216.0; }
float h2(vec2 p) { return float(hu(floatBitsToUint(p.x) ^ hu(floatBitsToUint(p.y) + 0x9e3779b9u)) >> 8) / 16777216.0; }
float lt(float h, float t) { return h < t ? 1.0 : 0.0; } // 'happens' when the roll is under the chance; chance 0 = never
void main() {
  vec2 fc = gl_FragCoord.xy;            // device px, y up
  vec2 uv = fc / uRes;
  float a = uAmt, aLate = a * a;        // late effects ramp in slowly (a squared)
  float slot = floor(uTime * 12.0);     // the glitch clock: tears/blocks re-roll 12x a second
  // visor curvature (barrel)
  float curve = max(uCurveAlways, a) * uCurve; // always this curved; the glitch can only add
  vec2 c = uv * 2.0 - 1.0; c *= 1.0 + curve * 0.10 * dot(c, c); uv = c * 0.5 + 0.5;
  float outside = step(1.0, max(abs(c.x), abs(c.y)));
  // vertical slip (roll): rare, short, a few rows
  float slip = lt(h1(floor(uTime * 3.0) + 11.0), uRoll * aLate * 0.25) * 0.035;
  uv.y = fract(uv.y + slip);
  // tear bands: some bands shift sideways this slot; plus a tiny constant jitter on every line
  float bandH = (4.0 + 36.0 * uTearSize) * uDpr;
  float band = floor(fc.y / bandH);
  float tearOn = lt(h2(vec2(band, slot)), uTear * a * 0.22);
  float burst = lt(h1(slot + 3.0), 0.15 + 0.35 * a) * a; // some slots are 'bursts': split + tears louder
  uv.x += tearOn * (h2(vec2(band + 7.0, slot)) - 0.5) * 2.0 * (0.02 + 0.13 * uTearSize) * (0.4 + 0.6 * a);
  uv.x += (h2(vec2(floor(fc.y / uDpr), slot)) - 0.5) * uTear * a * 1.5 * uDpr / uRes.x;
  // digital blocks: some blocks read from a nearby wrong spot this slot
  float bs = uBlockSize * uDpr;
  vec2 blk = floor(fc / bs);
  float bslot = floor(uTime * 6.0 + h2(blk) * 6.0);  // each block keeps its own clock so they don't all switch together
  float bOn = lt(h2(blk + bslot * 1.37), uBlock * pow(a, 1.5) * 0.18);
  uv += bOn * (vec2(h2(blk + bslot), h2(blk - bslot)) - 0.5) * 4.0 * bs / uRes;
  // RGB split: red one way, blue the other (3 reads total)
  vec2 d = vec2((uRgb * a * 3.0 + burst * uRgb * 3.0) * uDpr / uRes.x, 0.0);
  vec3 col = vec3(texture(uTex, uv + d).r, texture(uTex, uv).g, texture(uTex, uv - d).b);
  // blocks that moved get a little ringing (brighter edge), never a colour swap: colour is the rule in Goops
  vec2 bf = fract(fc / bs);
  col += bOn * 0.08 * step(min(min(bf.x, bf.y), min(1.0 - bf.x, 1.0 - bf.y)), 0.12);
  // scanlines (snap to the pixel-filter grain when it comes after)
  float s = 0.5 + 0.5 * cos(6.2832 * fc.y / (2.0 * uGrain));
  col *= 1.0 - uScan * a * 0.55 * (1.0 - s);
  // rolling bright bar
  float ry = fract(uv.y - uTime * 0.12);
  col *= 1.0 + uRoll * a * 0.25 * smoothstep(0.0, 0.08, ry) * smoothstep(0.2, 0.08, ry);
  // static / snow (per grain cell, new every frame)
  vec2 g = floor(fc / uGrain);
  float n = h2(g + fract(uTime * 7.31) * 913.0);
  float streak = lt(h2(vec2(floor(fc.y / uGrain), floor(uTime * 20.0))), (0.015 + 0.05 * uNoise) * a); // VHS-ish white streak rows
  col = mix(col, vec3(n), clamp(uNoise * a * 0.45 + streak * uNoise * a * 0.35, 0.0, 1.0));
  // dead LCD lines: a column/row goes dead once 'amount' passes its own threshold, and stays
  float colId = floor(fc.x / (2.0 * uDpr)), rowId = floor(fc.y / (2.0 * uDpr));
  float deadC = lt(h1(colId + 5000.0), uDead * a * 0.025), deadR = lt(h1(rowId + 9000.0), uDead * a * 0.012);
  vec3 deadCol = mix(vec3(0.9, 0.2, 0.9), vec3(0.2, 0.95, 0.5), step(0.5, h1(colId + rowId * 0.01)));
  col = mix(col, deadCol, 0.75 * max(deadC, deadR));
  // flicker (dims only) + dropout (dark + snow, at most ~1/s, never full black)
  col *= 1.0 - uFlicker * a * 0.22 * h1(floor(uTime * 8.0));
  float drop = lt(h1(floor(uTime * 4.0) + 21.0), uDrop * smoothstep(0.4, 1.0, a) * 0.25);
  col = mix(col, vec3(n * 0.3), drop * 0.65);
  // vignette
  float v = dot(c, c);
  col *= 1.0 - uVig * max(uVigAlways, a) * 0.7 * smoothstep(0.3, 2.0, v);
  col *= 1.0 - outside;
  o = vec4(col, 1.0);
}`

// The pixel filter as its own pass (only used for glitch -> pixels order; pixels-first is folded into FS_COMPOSITE)
export const FS_PIX = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform float uPix;
out vec4 o;
void main() { vec2 p = (floor(gl_FragCoord.xy / uPix) + 0.5) * uPix; o = texture(uTex, p / uRes); } // one read per pixel`
