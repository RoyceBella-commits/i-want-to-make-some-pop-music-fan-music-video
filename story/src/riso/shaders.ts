const NOISE = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

/** Pass 1: the plate on a depth-displaced grid. Writes ink coverage, not colour. */
export const PLATE_VERT = /* glsl */ `
uniform sampler2D uB;
uniform float uDepth;
varying vec2 vUv;
void main() {
  vUv = uv;
  float d = texture2D(uB, uv).b;
  vec3 p = position;
  p.z += d * uDepth;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const PLATE_FRAG = /* glsl */ `
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uC;
uniform float uPass;
uniform float uTime;
/* sky weights inside the masked window: sun, cloud, rain, night */
uniform vec4 uWeather;
uniform float uWeatherOn;
uniform vec2 uSun;
/* collapse all inks into one teal drum; uMonoEdge is the plate-x where mono starts (wipe) */
uniform float uMono;
uniform float uMonoEdge;
varying vec2 vUv;
${NOISE}
void main() {
  vec3 a = texture2D(uA, vUv).rgb;
  vec3 b = texture2D(uB, vUv).rgb;
  float Y = a.r, T = a.g, C = a.b, P = b.r, Br = b.g;
  float m = texture2D(uC, vUv).r * uWeatherOn;
  if (m > 0.001) {
    vec2 q = vec2(vUv.x * 16.0 / 9.0, vUv.y);
    float sun = 1.0 - smoothstep(0.052, 0.058, distance(q, uSun));
    // sunny: pale blue sky + a flat yellow sun
    vec4 s1 = vec4(sun, 0.0, 0.32 * (1.0 - sun), 0.0);
    // cloudy: lighter sky with drifting teal clouds
    float cl = smoothstep(0.52, 0.56, fbm(q * vec2(5.0, 9.0) + vec2(uTime * 0.05, 0.0)));
    vec4 s2 = vec4(0.0, 0.42 * cl, 0.16 + 0.1 * (1.0 - cl), 0.06 * cl);
    // rain: heavy sky with falling paper-white streaks
    vec2 r = q * vec2(90.0, 7.0) + vec2(q.y * 14.0, uTime * 6.0);
    float streak = step(0.72, fract(r.x)) * step(0.62, fract(r.y)) * step(0.45, hash(floor(r)));
    vec4 s3 = vec4(0.0, 0.38 * (1.0 - streak), 0.55 * (1.0 - streak), 0.0);
    // night: deep teal + cornflower, paper moon and a few stars
    float moon = 1.0 - smoothstep(0.042, 0.048, distance(q, uSun + vec2(0.05, 0.02)));
    float star = step(0.995, hash(floor(q * 260.0)));
    float dark = (1.0 - moon) * (1.0 - star);
    vec4 s4 = vec4(0.18 * moon, 0.9 * dark, 0.75 * dark, 0.0);
    vec4 sky = uWeather.x * s1 + uWeather.y * s2 + uWeather.z * s3 + uWeather.w * s4;
    float br = uWeather.y * 0.06 * cl;
    Y = mix(Y, sky.x, m); T = mix(T, sky.y, m); C = mix(C, sky.z, m); P = mix(P, sky.w, m); Br = mix(Br, br, m);
  }
  if (uMono > 0.001) {
    float dk = clamp(Y * 0.22 + T * 0.95 + C * 0.5 + P * 0.45 + Br * 0.8, 0.0, 1.0);
    float torn = uMonoEdge + 0.012 * (vnoise(vec2(vUv.y * 40.0, 3.0)) - 0.5);
    float mm = uMono * smoothstep(torn - 0.004, torn + 0.004, vUv.x);
    Y = mix(Y, 0.0, mm); T = mix(T, dk, mm); C = mix(C, 0.0, mm); P = mix(P, 0.0, mm); Br = mix(Br, 0.0, mm);
  }
  gl_FragColor = uPass < 0.5 ? vec4(Y, T, C, 1.0) : vec4(P, Br, 0.0, 1.0);
}
`;

export const SCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Pass 2: screen-space riso print — misregistered drums, halftone, mottled ink, paper. */
export const SCREEN_FRAG = /* glsl */ `
uniform sampler2D tA;
uniform sampler2D tB;
uniform vec2 uRes;
uniform vec2 uOff[5];
uniform float uReveal[5];
uniform float uAngle[5];
uniform vec3 uTrans[5];
uniform vec3 uPaper;
uniform float uCell;
uniform float uSeed;
uniform float uGrain;
/* screen rect (px, y up) where the halftone cell grows — the image "deconstructs into elements" */
uniform vec4 uCellRect;
uniform float uCellMul;
/* right of uSplitX (px) the drums use a second set of offsets; 0 disables */
uniform float uSplitX;
uniform vec2 uOffR[5];
varying vec2 vUv;
${NOISE}
float dens(int i, vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  vec4 a = texture2D(tA, uv);
  vec4 b = texture2D(tB, uv);
  if (i == 0) return a.r;
  if (i == 1) return a.g;
  if (i == 2) return a.b;
  if (i == 3) return b.r;
  return b.g;
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec2 px = vUv * uRes;
  vec3 col = uPaper;
  for (int i = 0; i < 5; i++) {
    if (uReveal[i] <= 0.0) continue;
    // Offsets are given with y down (screen px); the shader's y is up.
    vec2 o = (uSplitX > 0.0 && px.x > uSplitX) ? uOffR[i] : uOff[i];
    vec2 off = vec2(o.x, -o.y);
    float d = dens(i, (px - off) / uRes);
    // The drum rolls ink on from the top of the sheet.
    float edge = uReveal[i] * 1.3 - 0.08 * vnoise(vec2(px.x * 0.012, float(i) * 3.7));
    d *= smoothstep(edge, edge - 0.05, 1.0 - vUv.y);
    // Uneven ink lay-down + boil.
    float mott = 0.84 + 0.3 * fbm(px * 0.011 + vec2(float(i) * 17.3, uSeed * 0.37));
    float dd = clamp(d * mott, 0.0, 1.0);
    float an = uAngle[i];
    float inRect = step(uCellRect.x, px.x) * step(px.x, uCellRect.z) * step(uCellRect.y, px.y) * step(px.y, uCellRect.w);
    float cell = uCell * mix(1.0, uCellMul, inRect);
    vec2 g = mat2(cos(an), -sin(an), sin(an), cos(an)) * px / cell;
    float dist = length(fract(g) - 0.5);
    float r = sqrt(dd / 3.14159) * 1.12;
    float aa = 1.2 / cell;
    float cov = 1.0 - smoothstep(r - aa, r + aa, dist);
    cov = mix(cov, 1.0, smoothstep(0.86, 0.97, dd)) * step(0.015, dd);
    // Pin-holes where the ink skipped.
    float h = hash(floor(px / 1.6) + vec2(uSeed * 1.7 + float(i) * 7.0, float(i)));
    cov *= 1.0 - uGrain * step(0.972, h) * 0.85;
    col *= mix(vec3(1.0), uTrans[i], cov);
  }
  float fib = fbm(px * vec2(0.006, 0.035) + uSeed * 0.01);
  col *= 1.0 - 0.04 * fib;
  gl_FragColor = vec4(toSrgb(col), 1.0);
}
`;
