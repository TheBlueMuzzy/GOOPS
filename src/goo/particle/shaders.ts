// Particle shaders (ported from lab-L3-particles.html): splat particles + bond capsules into a per-colour field
// (half res) -> blur -> threshold + wet shading, written as premultiplied colour over the TRANSPARENT canvas.
// Field textures: tex0 = colours 1-4, tex1.rgb = colours 5-7, tex2 = r unfilled weight / g ready weight.
import { XRAY_GLSL } from '../shared/xray'

export const SPLAT_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aSeg;   // capsule ends (view cells): a.xy, b.xy (a particle is a capsule with a == b)
layout(location=2) in vec3 aInfo;  // reach (cells), weight, colour 1-7
layout(location=3) in vec2 aFill;  // unfilled 0..1, ready 0..1
uniform vec2 uFieldRes, uOrigin; uniform float uCell;
out vec2 vP; flat out vec4 vSeg; flat out vec3 vInfo; flat out vec2 vFill;
void main(){
  vec2 lo = min(aSeg.xy, aSeg.zw) - aInfo.x, hi = max(aSeg.xy, aSeg.zw) + aInfo.x;
  vec2 p = mix(lo, hi, aCorner * 0.5 + 0.5);
  vP = p; vSeg = aSeg; vInfo = aInfo; vFill = aFill;
  vec2 clip = (uOrigin + p * uCell) / uFieldRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`

export const SPLAT_FS = `#version 300 es
precision highp float;
in vec2 vP; flat in vec4 vSeg; flat in vec3 vInfo; flat in vec2 vFill;
uniform float uWS;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1; layout(location=2) out vec4 o2;
void main(){
  vec2 pa = vP - vSeg.xy, ba = vSeg.zw - vSeg.xy;
  float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  vec2 e = pa - ba * t; float d2 = dot(e, e) / (vInfo.x * vInfo.x);
  if (d2 >= 1.0) discard;
  float u = 1.0 - d2; float k = u * u * u * vInfo.y * uWS;     // Wyvill kernel
  int c = int(vInfo.z + 0.5);
  o0 = vec4(float(c == 1), float(c == 2), float(c == 3), float(c == 4)) * k;
  o1 = vec4(float(c == 5), float(c == 6), float(c == 7), 0.0) * k;
  o2 = vec4(vFill.x * k, vFill.y * k, 0.0, 0.0);
}`

export const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uT0, uT1, uT2; uniform vec2 uStep, uOut; uniform float uSigma; uniform int uTaps;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1; layout(location=2) out vec4 o2;
void main(){
  vec2 uv = gl_FragCoord.xy / uOut;
  vec4 a = vec4(0.0), b = vec4(0.0), c = vec4(0.0); float ws = 0.0;
  for (int i = -12; i <= 12; i++) {
    if (i < -uTaps || i > uTaps) continue;
    float x = float(i) * 2.5 / float(uTaps) * uSigma; float w = exp(-0.5 * x * x / (uSigma * uSigma));
    vec2 o = uStep * x; a += texture(uT0, uv + o) * w; b += texture(uT1, uv + o) * w; c += texture(uT2, uv + o) * w; ws += w;
  }
  o0 = a / ws; o1 = b / ws; o2 = c / ws;
}`

export const SHADE_FS = `#version 300 es
precision highp float;
uniform sampler2D uT0, uT1, uT2, uW0, uW1, uW2;   // field (lightly blurred) + a wide-blurred copy for the group dome
uniform vec2 uRes, uOrigin; uniform float uCell, uScale, uTh, uWet, uBulge, uAbsorb, uFres, uTrans, uTime;
uniform float uUnA, uUnDim, uGlow, uPulse, uClipL, uClipR, uClipB;
uniform vec3 uCols[8];
out vec4 outColor;
${XRAY_GLSL}
float field(vec2 uv, vec4 m0, vec4 m1){ return (dot(texture(uT0, uv), m0) + dot(texture(uT1, uv), m1)) * uScale; }
float hgt(float f){ return sqrt(clamp((f - uTh) / 0.9, 0.0, 1.0)); }   // steep wet edge, soft dome on top
vec4 over(vec4 top, vec4 under){ return top + under * (1.0 - top.a); }
// wet goo shading for one layer: f1 = its field here, m0/m1 pick its channel, base = its colour
vec3 shade(vec2 uv, vec2 tx, float f1, float f2, vec4 m0, vec4 m1, vec3 base){
  float hR = hgt(field(uv + vec2(tx.x, 0.0), m0, m1)), hL = hgt(field(uv - vec2(tx.x, 0.0), m0, m1));
  float hU = hgt(field(uv + vec2(0.0, tx.y), m0, m1)), hD = hgt(field(uv - vec2(0.0, tx.y), m0, m1));
  vec2 grad = vec2(hR - hL, hU - hD) * 0.5 * uCell * 0.5;    // per cell (field is half-res), screen y up
  // group dome: the slope of a wide-blurred copy of this colour's field -> one broad pillow (and one shine) per group
  vec2 wo = tx * 3.0;
  float wR = dot(texture(uW0, uv + vec2(wo.x, 0.0)), m0) + dot(texture(uW1, uv + vec2(wo.x, 0.0)), m1);
  float wL = dot(texture(uW0, uv - vec2(wo.x, 0.0)), m0) + dot(texture(uW1, uv - vec2(wo.x, 0.0)), m1);
  float wU = dot(texture(uW0, uv + vec2(0.0, wo.y)), m0) + dot(texture(uW1, uv + vec2(0.0, wo.y)), m1);
  float wD = dot(texture(uW0, uv - vec2(0.0, wo.y)), m0) + dot(texture(uW1, uv - vec2(0.0, wo.y)), m1);
  vec2 gw = vec2(wR - wL, wU - wD) / 6.0 * uCell * 0.5 * uScale;
  vec3 n = normalize(vec3(-(grad * 0.22 + gw * 0.55) * uBulge, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.65, 0.62)), Hh = normalize(L + vec3(0.0, 0.0, 1.0));
  float ab = 1.0 - exp(-uAbsorb * f1 * 0.9);                 // Beer-Lambert: thin = light + clear, thick = deep
  vec3 body = mix(mix(base, vec3(1.0), 0.28), base * base * 0.85, ab);
  float diff = max(dot(n, L), 0.0);
  vec3 col = body * (0.5 + 0.62 * diff);
  float fl = field(uv + normalize(L.xy) * 7.0 * tx, m0, m1);  // fake subsurface where it's thin toward the light
  col += base * uTrans * 0.5 * (1.0 - smoothstep(uTh, uTh + 1.0, fl)) * (1.0 - diff * 0.5);
  float nh = max(dot(n, Hh), 0.0);
  float spec = pow(nh, mix(30.0, 160.0, clamp(uWet, 0.0, 1.0))) * uWet * 0.95 + pow(nh, 10.0) * 0.07 * uWet;
  float fr = pow(1.0 - n.z, 2.5) * uFres * uWet;
  col += vec3(spec) + mix(base, vec3(1.0), 0.55) * fr * 0.5;
  return col * (1.0 - 0.35 * smoothstep(0.55, 1.0, f2 / (f1 + 1e-4)));  // darker pinch where two colours press together
}
void main(){
  vec2 res = vec2(textureSize(uT0, 0)), tx = 1.0 / res;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uOrigin) / uCell;  // view cells, y down
  float px = 1.0 / uCell;
  float clip = smoothstep(uClipL - px, uClipL + px, p.x) * (1.0 - smoothstep(uClipR - px, uClipR + px, p.x))
    * (1.0 - smoothstep(uClipB - px, uClipB + px, p.y));   // the tank window (sides + floor; open above for the spawn rows)
  if (clip <= 0.0) { outColor = vec4(0.0); return; }
  vec4 a = texture(uT0, uv) * uScale; vec4 b4 = texture(uT1, uv) * uScale;
  float f[7] = float[7](a.x, a.y, a.z, a.w, b4.x, b4.y, b4.z);
  int ci = 0; float f1 = 0.0, f2 = 0.0, fsum = 0.0;
  for (int i = 0; i < 7; i++) { fsum += f[i]; if (f[i] > f1) { f2 = f1; f1 = f[i]; ci = i; } else if (f[i] > f2) f2 = f[i]; }
  // soft contact shadow under all goo, offset down-right (darkens the tank)
  vec2 so = uv + vec2(2.0, -3.0) * tx;
  vec4 sa = texture(uT0, so) * uScale; vec4 sb = texture(uT1, so) * uScale;
  vec4 outc = vec4(0.0, 0.0, 0.0, 0.55 * smoothstep(0.05, uTh, sa.x + sa.y + sa.z + sa.w + sb.x + sb.y + sb.z));
  float pulse = 0.5 + 0.5 * sin(uTime * 6.2832 * uPulse);
  // ready halo: a soft glow just outside a ready group, in the nearest goo colour
  float wr = texture(uW2, uv).g * uScale;
  if (wr > 0.002) {
    vec4 w0 = texture(uW0, uv), w1 = texture(uW1, uv);
    float wf[7] = float[7](w0.x, w0.y, w0.z, w0.w, w1.x, w1.y, w1.z);
    int wc = 0; float wb = 0.0;
    for (int i = 0; i < 7; i++) if (wf[i] > wb) { wb = wf[i]; wc = i; }
    float g = uGlow * clamp(wr * 1.2, 0.0, 1.0) * (0.35 + 0.65 * pulse) * 0.4;
    outc = over(vec4((uCols[wc + 1] * 0.7 + 0.3) * g, g), outc);
  }
  if (f1 > uTh * 0.5) {
    // the winner's field minus part of the rival's -> same colours fuse, different colours meet at a clean seam
    float fe = f1 - 0.6 * f2, aa = fwidth(fe) * 0.9 + 1e-4;
    vec4 m0 = vec4(float(ci == 0), float(ci == 1), float(ci == 2), float(ci == 3));
    vec4 m1 = vec4(float(ci == 4), float(ci == 5), float(ci == 6), 0.0);
    vec3 base = uCols[ci + 1];
    vec3 col = shade(uv, tx, f1, f2, m0, m1, base);
    float cover = smoothstep(uTh - aa, uTh + aa, fe);
    // filling: the part above the fill level is dimmer and more see-through, with a soft bright level line
    vec4 fl = texture(uT2, uv) * uScale;
    float un = clamp(fl.r / max(fsum, 1e-4), 0.0, 1.0);
    float rd = clamp(fl.g / max(fsum, 1e-4), 0.0, 1.0);
    float level = (1.0 - smoothstep(0.0, 0.3, abs(un - 0.5)));
    col *= 1.0 - uUnDim * un;
    col += (base * 0.5 + 0.35) * level * 0.3;
    col += base * uGlow * rd * (0.25 + 0.75 * pulse) * 0.8;   // ready: a gentle pulse inside the goo
    float al = cover * mix(1.0, uUnA, un);
    outc = over(vec4(col * al, al), outc);
  }
  outColor = outc * clip * xrayKeep(p, px);   // F36: see-through inside the x-ray boxes
}`
