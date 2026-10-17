// Jelly shaders (ported from lab-L4-jelly.html). Passes:
// 1) mask (half res): each body's outline filled through the stencil (nonzero winding) into its colour channel.
//    tex0 = colours 1-4, tex1.rgb = colours 5-7, tex1.a = the one highlight per body, tex2 = r unfilled / g ready.
// 2) small blur (half res): anti-aliased edge + rim bevel   3) big blur (quarter res): body thickness = the dome
// 4) final: strongest colour wins (clean seams), glossy translucent jelly, written as premultiplied colour over the
//    TRANSPARENT canvas (the tank underneath is the lead's 2D canvas).

export const MASK_VS = `#version 300 es
layout(location=0) in vec4 aPos; uniform vec2 uOrigin, uCover; uniform float uCell; out vec2 vUv;
void main(){ vec2 px = uOrigin + aPos.xy * uCell; vUv = aPos.zw;
  gl_Position = vec4(px.x / uCover.x * 2.0 - 1.0, 1.0 - px.y / uCover.y * 2.0, 0.0, 1.0); }`

export const MASK_FS = `#version 300 es
precision mediump float; in vec2 vUv; uniform int uMode; uniform vec4 uC0, uC1; uniform float uHl, uLine, uFillOn, uReady, uAlpha;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1; layout(location=2) out vec4 o2;
void main(){
  if (uMode == 2) { float r = length(vUv); float e = (1.0 - smoothstep(0.35, 1.0, r)); o0 = vec4(0.0); o1 = vec4(0.0, 0.0, 0.0, e * e * uHl); o2 = vec4(0.0); }
  else {
    o0 = uC0 * uAlpha; o1 = vec4(uC1.rgb * uAlpha, 0.0);
    float unfilled = uFillOn * (1.0 - smoothstep(uLine - 0.06, uLine + 0.06, vUv.y)); // above the fill level (y down)
    o2 = vec4(unfilled, uReady, 0.0, 0.0) * uAlpha;
  }
}`

export const BLUR_FS = `#version 300 es
precision highp float; uniform sampler2D uT0, uT1, uT2; uniform vec2 uSize, uStep; uniform float uSigma; uniform int uR;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1; layout(location=2) out vec4 o2;
void main(){
  vec2 uv = gl_FragCoord.xy / uSize; vec4 a = vec4(0.0), b = vec4(0.0), c = vec4(0.0); float ws = 0.0;
  for (int i = -40; i <= 40; i++) { if (i < -uR || i > uR) continue;
    float w = exp(-0.5 * float(i * i) / (uSigma * uSigma)); vec2 u = uv + uStep * float(i);
    a += w * texture(uT0, u); b += w * texture(uT1, u); c += w * texture(uT2, u); ws += w; }
  o0 = a / ws; o1 = b / ws; o2 = c / ws;
}`

export const FINAL_FS = `#version 300 es
precision highp float;
uniform sampler2D uS0, uS1, uS2, uQ0, uQ1, uQ2, uM1;
uniform vec2 uRes, uOrigin, uQTex; uniform float uCell, uTime, uTrans, uWet, uUnA, uUnDim, uGlow, uPulse, uClipL, uClipR, uClipB;
uniform vec3 uCols[8];
out vec4 outColor;
float pick(vec4 t0, vec4 t1, vec4 s0, vec3 s1){ return dot(t0, s0) + dot(t1.rgb, s1); }
// premultiplied "over"
vec4 over(vec4 top, vec4 under){ return top + under * (1.0 - top.a); }
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / uRes;
  vec2 p = (vec2(fc.x, uRes.y - fc.y) - uOrigin) / uCell;   // view cells, y down (x = 0 at the centre column's centre)
  float px = 1.0 / uCell;
  float clip = smoothstep(uClipL - px, uClipL + px, p.x) * (1.0 - smoothstep(uClipR - px, uClipR + px, p.x))
    * (1.0 - smoothstep(uClipB - px, uClipB + px, p.y));   // the tank window (sides + floor; open above for the spawn rows)
  if (clip <= 0.0) { outColor = vec4(0.0); return; }
  // soft contact shadow from the thick field, nudged down-right (darkens the tank under the goo)
  vec2 so = vec2(0.6, -0.9) * uQTex; vec4 sh0 = texture(uQ0, uv + so), sh1 = texture(uQ1, uv + so);
  vec4 res = vec4(0.0, 0.0, 0.0, 0.45 * clamp(sh0.r + sh0.g + sh0.b + sh0.a + sh1.r + sh1.g + sh1.b, 0.0, 1.0));
  float pulse = 0.5 + 0.5 * sin(uTime * 6.2832 * uPulse);
  // ready halo: a soft glow just outside a ready group, in the nearest goo colour
  vec4 q0 = texture(uQ0, uv), q1 = texture(uQ1, uv);
  float qr = texture(uQ2, uv).g;
  if (qr > 0.002) {
    float qb = q0.r; int qc = 1;
    if (q0.g > qb) { qb = q0.g; qc = 2; } if (q0.b > qb) { qb = q0.b; qc = 3; } if (q0.a > qb) { qb = q0.a; qc = 4; }
    if (q1.r > qb) { qb = q1.r; qc = 5; } if (q1.g > qb) { qb = q1.g; qc = 6; } if (q1.b > qb) { qb = q1.b; qc = 7; }
    float g = uGlow * clamp(qr * 1.6, 0.0, 1.0) * (0.35 + 0.65 * pulse) * 0.4;
    res = over(vec4((uCols[qc] * 0.7 + 0.3) * g, g), res);
  }
  // strongest colour wins -> clean seams, never mixed
  vec4 s0 = texture(uS0, uv), s1 = texture(uS1, uv);
  float f = s0.r, f2 = 0.0; int c = 1; vec4 sel = vec4(1, 0, 0, 0); vec3 sel1 = vec3(0.0);   // f2 = runner-up colour
  if (s0.g > f) { f2 = f; f = s0.g; c = 2; sel = vec4(0, 1, 0, 0); } else f2 = max(f2, s0.g);
  if (s0.b > f) { f2 = f; f = s0.b; c = 3; sel = vec4(0, 0, 1, 0); } else f2 = max(f2, s0.b);
  if (s0.a > f) { f2 = f; f = s0.a; c = 4; sel = vec4(0, 0, 0, 1); } else f2 = max(f2, s0.a);
  if (s1.r > f) { f2 = f; f = s1.r; c = 5; sel = vec4(0); sel1 = vec3(1, 0, 0); } else f2 = max(f2, s1.r);
  if (s1.g > f) { f2 = f; f = s1.g; c = 6; sel = vec4(0); sel1 = vec3(0, 1, 0); } else f2 = max(f2, s1.g);
  if (s1.b > f) { f2 = f; f = s1.b; c = 7; sel = vec4(0); sel1 = vec3(0, 0, 1); } else f2 = max(f2, s1.b);
  float aa = max(fwidth(f), 1e-4);
  float a = smoothstep(0.5 - aa, 0.5 + aa, f);
  a *= smoothstep(0.0, max(fwidth(f - f2) * 1.5, 0.03), f - f2);   // thin anti-aliased seam where two colours meet
  if (a > 0.0) {
    // thickness (quarter-res big blur) -> one dome per body; its gradient is the surface slope
    float th = pick(q0, q1, sel, sel1);
    vec2 ex = vec2(uQTex.x, 0.0), ey = vec2(0.0, uQTex.y);
    vec2 gq = vec2(pick(texture(uQ0, uv + ex), texture(uQ1, uv + ex), sel, sel1) - pick(texture(uQ0, uv - ex), texture(uQ1, uv - ex), sel, sel1),
                   pick(texture(uQ0, uv + ey), texture(uQ1, uv + ey), sel, sel1) - pick(texture(uQ0, uv - ey), texture(uQ1, uv - ey), sel, sel1)) * 0.5;
    vec2 ge = vec2(dFdx(f), dFdy(f)) * uCell;             // small-blur slope: the bevel right at the edge
    float bev = 1.0 - smoothstep(0.5, 0.95, f);
    vec3 n = normalize(vec3(-(gq * 7.0 + ge * 0.9 * bev), 1.0));
    vec3 L = normalize(vec3(-0.45, 0.65, 0.62)), Hh = normalize(L + vec3(0.0, 0.0, 1.0));
    vec3 base = uCols[c];
    float t = smoothstep(0.45, 1.0, th);                  // 0 thin edge .. 1 deep inside
    float diff = max(dot(n, L), 0.0);
    vec3 body = base * (0.5 + 0.55 * diff);
    body = mix(body * 1.15 + base * 0.12, body * 0.85, t);               // absorb: thin = lighter, thick = deeper
    body += base * 0.45 * smoothstep(0.35, 1.0, t) * (0.85 + 0.15 * sin(uTime * 1.3)); // inner glow in the core
    float rim = 1.0 - smoothstep(0.5, 0.7, f);
    body = mix(body, base * 0.3, rim * 0.55);                            // dark lip right at the edge
    float fres = pow(1.0 - n.z, 1.6);
    body += (base * 0.6 + 0.4) * fres * uWet * 0.55;                     // glossy edge rim
    float spec = pow(max(dot(n, Hh), 0.0), 18.0) * uWet * 0.16;   // broad soft sheen only; the one sharp highlight is per body
    float hl = texture(uM1, uv).a * uWet;                                // the one highlight
    float op = mix(1.0, 0.5 + 0.45 * t, uTrans);                         // translucency: thin parts show the tank
    // filling: the part above the fill level is dimmer and more see-through, with a soft bright level line
    vec4 s2 = texture(uS2, uv);
    float u = clamp(s2.r / max(f, 0.05), 0.0, 1.0);
    float rd = clamp(s2.g / max(f, 0.05), 0.0, 1.0);
    float level = (1.0 - smoothstep(0.0, 0.3, abs(u - 0.5))) * step(0.02, s2.r);
    body *= 1.0 - uUnDim * u;
    body += (base * 0.5 + 0.35) * level * 0.3;
    op *= mix(1.0, uUnA, u);
    hl *= 1.0 - 0.6 * u;
    // ready: a gentle pulse inside the body
    body += base * uGlow * rd * (0.25 + 0.75 * pulse) * 0.8;
    vec3 col = a * ((1.0 - op) * base * 0.12 + op * body + vec3(spec + hl));
    res = over(vec4(col, a * op), res);
  }
  outColor = res * clip;
}`
