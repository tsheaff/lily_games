'use strict';

// Every note becomes a burst of dye in a GPU fluid, a refractive ripple, a spray
// of sparkles, and a small glowing creature that swims and stirs the liquid.
// Pitch class picks hue and angle (circle of fifths); register picks radius,
// size, speed, and lifetime. Noise everywhere keeps it from feeling mechanical.

const canvas = document.getElementById('c');
const hudEl = document.getElementById('hud');

const gl = canvas.getContext('webgl2', {
  alpha: false, depth: false, stencil: false, antialias: false,
  premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance',
});
if (!gl) { hudEl.textContent = 'webgl2 unavailable'; hudEl.classList.add('show'); throw new Error('no webgl2'); }
gl.getExtension('EXT_color_buffer_float');
gl.getExtension('EXT_color_buffer_half_float');
gl.getExtension('OES_texture_float_linear');

const CFG = {
  SIM_RES: 192,
  DYE_RES: 1024,
  BLOOM_RES: 384,
  BLOOM_ITER: 7,
  BLOOM_INTENSITY: 0.75,
  BLOOM_THRESHOLD: 0.42,
  BLOOM_KNEE: 0.35,
  PRESSURE_ITER: 22,
  PRESSURE: 0.8,
  CURL: 6,
  VEL_DISSIPATION: 0.55,
  DYE_DISSIPATION: 0.4,
  DYE_DISSIPATION_SUSTAIN: 0.42,
  MAX_PARTICLES: 40000,
  MAX_CREATURES: 96,
  DPR: Math.min(window.devicePixelRatio || 1, 1.6),
  FLOW_W: 64,
};

// ---------------------------------------------------------------- shaders

const VS_BASE = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
uniform vec2 texelSize;
out vec2 vUv, vL, vR, vT, vB;
void main(){
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FS_HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB;
out vec4 fragColor;
`;

const FS_COPY = FS_HEAD + `
uniform sampler2D uTexture;
void main(){ fragColor = texture(uTexture, vUv); }`;

const FS_CLEAR = FS_HEAD + `
uniform sampler2D uTexture;
uniform float value;
void main(){ fragColor = value * texture(uTexture, vUv); }`;

const FS_SOLID = FS_HEAD + `
void main(){ fragColor = vec4(1.0); }`;

const FS_SPLAT = FS_HEAD + `
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform int uCount;
uniform vec4 uPoints[32];   // uv.x, uv.y, radius (height units^2), swirl
uniform vec4 uColors[32];
void main(){
  vec3 base = texture(uTarget, vUv).xyz;
  vec3 add = vec3(0.0);
  for (int i = 0; i < 32; i++) {
    if (i >= uCount) break;
    vec4 pt = uPoints[i];
    vec2 p = vUv - pt.xy;
    p.x *= aspectRatio;
    float g = exp(-dot(p, p) / pt.z);
    vec2 perp = vec2(-p.y, p.x) * inversesqrt(pt.z);
    add += g * (uColors[i].xyz + vec3(perp * pt.w, 0.0));
  }
  fragColor = vec4(base + add, 1.0);
}`;

const FS_ADVECT = FS_HEAD + `
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 simTexel;
uniform float dt;
uniform float dissipation;
uniform float hiDecay;
void main(){
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * simTexel;
  vec4 result = texture(uSource, coord);
  float hi = max(0.0, max(result.r, max(result.g, result.b)) - 0.5);
  fragColor = result / (1.0 + dissipation * dt * (1.0 + hi * hiDecay));
}`;

const FS_DIVERGENCE = FS_HEAD + `
uniform sampler2D uVelocity;
void main(){
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;
  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const FS_CURL = FS_HEAD + `
uniform sampler2D uVelocity;
void main(){
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const FS_VORTICITY = FS_HEAD + `
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
void main(){
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 vel = texture(uVelocity, vUv).xy + force * dt;
  fragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
}`;

const FS_PRESSURE = FS_HEAD + `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main(){
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float div = texture(uDivergence, vUv).x;
  fragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const FS_GRADIENT = FS_HEAD + `
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main(){
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 vel = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  fragColor = vec4(vel, 0.0, 1.0);
}`;

const FS_BLOOM_PREFILTER = FS_HEAD + `
uniform sampler2D uDye;
uniform sampler2D uParticles;
uniform float threshold;
uniform float knee;
uniform vec2 uCam;
uniform float aspect;
void main(){
  vec3 c = texture(uDye, vUv - uCam * 0.5 / vec2(aspect, 1.0)).rgb + texture(uParticles, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  rq = rq * rq / (4.0 * knee + 0.0001);
  c *= max(rq, br - threshold) / max(br, 0.0001);
  fragColor = vec4(c, 1.0);
}`;

const FS_BLUR = FS_HEAD + `
uniform sampler2D uTexture;
uniform vec2 srcTexel;
void main(){
  vec2 o = srcTexel * 0.75;
  vec4 s = texture(uTexture, vUv + vec2(-o.x, -o.y))
         + texture(uTexture, vUv + vec2( o.x, -o.y))
         + texture(uTexture, vUv + vec2(-o.x,  o.y))
         + texture(uTexture, vUv + vec2( o.x,  o.y));
  fragColor = s * 0.25;
}`;

// Signature effects for the keyboard's extremes: a full-screen rainbow arch (A0)
// and a Dark Side of the Moon prism (C8). Drawn into the particle layer.
const FS_FX = FS_HEAD + `
uniform float aspect;
uniform float uTime;
uniform vec2 uCam;
uniform vec4 uRainbow;  // age, level, velocity
uniform vec4 uPrism;    // age, level, velocity
uniform float uGain;

vec3 spectrum(float x){
  float h = clamp(x, 0.0, 1.0) * 0.78;
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sdTri(vec2 p, float r){
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}
float sdSeg(vec2 p, vec2 a, vec2 b, out float t){
  vec2 pa = p - a, ba = b - a;
  t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t);
}

vec3 rainbow(vec2 p){
  float age = uRainbow.x, level = uRainbow.y, vel = uRainbow.z;
  if (level < 0.002) return vec3(0.0);
  float topY = 0.84, footY = 0.02, hx = aspect * 0.5 + 0.06;
  float cy = (topY * topY - hx * hx - footY * footY) / (2.0 * (topY - footY));
  float R = topY - cy;
  vec2 d = p - vec2(aspect * 0.5, cy);
  float dist = length(d);
  float ang = atan(d.x, d.y);
  float angMax = atan(hx, footY - cy);
  float a01 = (ang + angMax) / (2.0 * angMax);
  float sweep = clamp(age / 1.3, 0.0, 1.0) * 1.25;
  float reveal = 1.0 - smoothstep(sweep - 0.25, sweep, a01);

  float width = 0.045 + 0.03 * vel;
  float wob = 0.005 * sin(ang * 9.0 - uTime * 1.3) + 0.003 * sin(ang * 23.0 + uTime * 2.1);
  float x = (dist - R - wob) / width;
  float shimmer = 0.85 + 0.15 * sin(ang * 40.0 + uTime * 3.0 + dist * 60.0);
  vec3 col = spectrum(0.5 - 0.6 * x) * smoothstep(1.0, 0.82, abs(x)) * shimmer;
  // fainter secondary bow with reversed colors, outside a darker gap
  float x2 = (dist - R - width * 3.4 - wob) / (width * 1.3);
  col += spectrum(0.5 + 0.6 * x2) * smoothstep(1.0, 0.82, abs(x2)) * 0.22;
  float sup = (dist - (R - width * 1.35)) / (width * 0.2);
  col += spectrum(0.8) * exp(-sup * sup) * 0.18;
  col += vec3(0.04, 0.04, 0.06) * smoothstep(0.0, 0.25, R - width - dist);
  col *= smoothstep(-0.02, 0.16, p.y);
  return col * reveal * level * (0.35 + 0.3 * vel);
}

vec3 prism(vec2 p){
  float age = uPrism.x, level = uPrism.y, vel = uPrism.z;
  if (level < 0.002) return vec3(0.0);
  const float k = 1.7320508;
  vec2 C = vec2(aspect * 0.5, 0.47);
  float grow = smoothstep(0.0, 0.7, age);
  float r = (0.16 + 0.06 * vel) * (0.8 + 0.2 * grow);
  vec2 q = rot(sin(uTime * 0.6) * 0.04 * (0.3 + vel)) * (p - C);
  vec3 col = vec3(0.0);

  // dispersive outline: each color channel sees a slightly different triangle
  float disp = 0.006 + 0.03 * vel;
  for (int ch = 0; ch < 3; ch++) {
    float s = 1.0 + (float(ch) - 1.0) * disp;
    float d = sdTri(q / s, r) * s;
    col[ch] += exp(-abs(d) * 300.0) * 1.2 + exp(-abs(d) * 45.0) * 0.22;
  }
  float d0 = sdTri(q, r);
  col += smoothstep(0.004, -0.004, d0) * vec3(0.035, 0.04, 0.06);

  // internal reflections: ghost triangles that rotate apart, more of them when struck harder
  int ghosts = int(1.0 + vel * 5.0);
  for (int i = 1; i <= 6; i++) {
    if (i > ghosts) break;
    float fi = float(i);
    float a = fi * 0.2 * sin(uTime * 0.35 + fi) * (0.4 + vel) + age * 0.12 * fi * (mod(fi, 2.0) * 2.0 - 1.0);
    float sc = 1.0 + fi * 0.1 * (0.5 + vel);
    float gd = sdTri(rot(a) * q / sc, r) * sc;
    col += spectrum(fract(fi * 0.17 + uTime * 0.05)) * exp(-abs(gd) * 200.0) * (0.55 / fi) * (0.5 + vel);
  }

  vec2 bl = vec2(-r, -r / k), br = vec2(r, -r / k), apex = vec2(0.0, 2.0 * r / k);
  vec2 pin = mix(bl, apex, 0.45), pout = mix(br, apex, 0.55);
  vec2 src = pin + normalize(vec2(-1.0, -0.3)) * 3.0;

  // incoming white beam, advancing from the left
  float t;
  float bd = sdSeg(q, src, pin, t);
  float front = smoothstep(0.0, 0.45, age);
  float beamOn = step(t, mix(0.6, 1.0, front)) * step(0.0, d0);
  float bw = 0.0025 + 0.002 * vel;
  col += vec3(1.0) * (exp(-bd * bd / (bw * bw)) * 1.3 + exp(-bd * 70.0) * 0.2) * beamOn;

  // light bending through the glass
  float id = sdSeg(q, pin, pout, t);
  col += mix(vec3(1.0), spectrum(0.5), 0.3) * exp(-id * 90.0) * 0.45 * smoothstep(0.35, 0.55, age) * step(d0, 0.0);

  // the fan of spectrum leaving the right face; velocity widens the dispersion
  vec2 v = q - pout;
  float phi = atan(v.y, v.x);
  float a0 = -0.2, spread = 0.12 + 0.42 * vel;
  float s = (a0 + spread * 0.5 - phi) / spread;
  float band = smoothstep(0.0, 0.05, s) * smoothstep(1.0, 0.95, s);
  float reach = max(0.0, age - 0.5) * 3.5;
  float lenMask = smoothstep(reach, reach - 0.2, length(v)) * smoothstep(0.0, 0.02, length(v));
  vec3 fan = spectrum(s) * band * lenMask * step(0.0, d0) * (0.85 + 0.15 * sin(s * 70.0 + uTime * 4.0));
  col += fan * (0.7 + 0.5 * vel);

  return col * level;
}

void main(){
  vec2 p = vec2(vUv.x * aspect, vUv.y) - uCam * 0.2;
  fragColor = vec4((rainbow(p) + prism(p)) * uGain, 1.0);
}`;

const FS_DISPLAY = FS_HEAD + `
uniform sampler2D uDye;
uniform sampler2D uParticles;
uniform sampler2D uBloom;
uniform vec2 uDyeTexel;
uniform vec2 uRes;
uniform float aspect;
uniform float uTime;
uniform float uPulse;
uniform float uBloomIntensity;
uniform vec2 uCam;
uniform sampler2D uSpec;   // x = log frequency, y = time (ring buffer)
uniform float uSpecHead;
uniform float uLevel;
uniform float uAudioOn;
uniform int uRippleCount;
uniform vec4 uRipples[24];  // uv.x, uv.y, age, strength

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

float dyeH(vec2 uv){
  vec3 d = texture(uDye, uv).rgb;
  return smoothstep(0.06, 0.6, max(d.r, max(d.g, d.b)));
}

// Dye is drawn as glossy, membrane-edged drops: a height field shaded like jelly.
vec3 drops(vec2 duv){
  vec3 d = texture(uDye, duv).rgb;
  float m = max(d.r, max(d.g, d.b));
  vec3 chroma = d / max(m, 1e-4);
  float mask = smoothstep(0.06, 0.09, m);
  vec3 halo = chroma * smoothstep(0.015, 0.08, m) * 0.12 * (1.0 - mask);
  if (mask <= 0.0) return halo;

  vec2 t2 = uDyeTexel * 2.0;
  float h = smoothstep(0.06, 0.6, m);
  float hL = dyeH(duv - vec2(t2.x, 0.0)), hR = dyeH(duv + vec2(t2.x, 0.0));
  float hT = dyeH(duv + vec2(0.0, t2.y)), hB = dyeH(duv - vec2(0.0, t2.y));
  vec3 n = normalize(vec3(hL - hR, hB - hT, 0.09));
  vec3 L = normalize(vec3(-0.4, 0.55, 0.75));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(max(dot(n, normalize(L + vec3(0, 0, 1))), 0.0), 70.0);
  float fres = pow(1.0 - n.z, 2.0);

  vec2 cp = duv * vec2(aspect, 1.0);
  float cell = 0.5 * vnoise(cp * 38.0 + uTime * 0.3) + 0.5 * vnoise(cp * 90.0 - uTime * 0.2);
  vec3 body = chroma * (0.35 + 0.75 * h) * mix(0.55, 1.1, diff) * (0.82 + 0.36 * cell * h);
  vec3 membrane = mix(chroma, vec3(1.0), 0.25) * fres * 1.3;
  return (body + membrane + spec * vec3(1.0, 0.97, 0.94) * 0.8) * mask + halo;
}

float starLayer(vec2 bp, float scale, float thresh, float seed){
  vec2 sp = bp * scale + seed;
  vec2 cell = floor(sp);
  float h = hash(cell);
  if (h < thresh) return 0.0;
  vec2 o = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
  float sd = length(fract(sp) - 0.5 - o * 0.6);
  float tw = 0.55 + 0.45 * sin(uTime * (0.7 + h * 3.0) + h * 80.0);
  return exp(-sd * sd * 140.0) * tw * (h - thresh) / (1.0 - thresh);
}

// The microphone as a distant aurora: frequency runs left to right, and each curtain is the
// spectrogram rising from a horizon, so sound you just made glows at the base and drifts
// upward into violet as it ages. A dim mirror of it shimmers below the horizon.
float specAt(float u, float age){
  return texture(uSpec, vec2(u, uSpecHead - age * (1.0 - 2.0 / float(textureSize(uSpec, 0).y)))).r;
}
vec3 aurora(vec2 uv){
  if (uAudioOn < 0.5) return vec3(0.0);
  vec2 p = uv * vec2(aspect, 1.0) - uCam * 0.08;
  float horizon = 0.11;
  float y = p.y - horizon;
  float ay = abs(y);
  float fold = 0.04 * sin(ay * 5.0 + uTime * 0.33 + p.x * 1.7)
             + 0.03 * (vnoise(vec2(p.x * 1.3, ay * 1.6 - uTime * 0.06)) - 0.5);
  float fx = p.x + fold * smoothstep(0.0, 0.25, ay);
  float u = clamp(fx / aspect, 0.0, 1.0);
  float age = clamp(ay / (y > 0.0 ? 0.72 : 0.2), 0.0, 1.0);
  float blur = 0.015 + 0.05 * age;
  float e = 0.4 * specAt(u, age)
          + 0.15 * (specAt(u - 0.012, age) + specAt(u + 0.012, age))
          + 0.15 * (specAt(u, age + blur) + specAt(u, max(age - blur, 0.0)));

  float rays = 0.5 + 0.5 * vnoise(vec2(fx * 150.0, ay * 2.5 - uTime * 0.5));
  rays *= 0.65 + 0.35 * vnoise(vec2(fx * 33.0, ay * 1.2 + uTime * 0.15));
  float fade = pow(1.0 - age, 1.4) * smoothstep(0.0, 0.025, ay + 0.004);
  // separate drifting curtains rather than one wall of light
  float curtains = smoothstep(0.32, 0.72, vnoise(vec2(fx * 2.4 + uTime * 0.04, ay * 0.6 + 3.0)));
  curtains = max(curtains, 0.5 * smoothstep(0.45, 0.8, vnoise(vec2(fx * 5.5 - uTime * 0.03, 7.0))));
  float I = e * mix(rays, 1.0, 0.25) * fade * curtains;

  vec3 cLow = mix(vec3(0.15, 0.95, 0.6), vec3(0.25, 0.75, 1.0), u);
  vec3 cHigh = mix(vec3(0.55, 0.25, 0.95), vec3(0.95, 0.35, 0.65), u);
  vec3 col = mix(cLow, cHigh, smoothstep(0.04, 0.55, age));
  float edge = exp(-y * y * 2500.0) * specAt(u, 0.0);
  vec3 a = col * I + vec3(0.6, 1.0, 0.85) * edge * 0.6;
  if (y < 0.0) a *= 0.16 * (0.85 + 0.15 * sin(p.x * 90.0 + uTime * 2.0 + ay * 200.0));
  return a * (0.14 + 0.36 * uLevel);
}

void main(){
  // a faint lens bulge so the field reads as a volume, not a flat sheet
  vec2 cc = (vUv - 0.5) * vec2(aspect, 1.0);
  vec2 uv = 0.5 + (vUv - 0.5) * (1.0 - 0.025 * dot(cc, cc));

  // expanding refractive rings: ripples in space-time
  vec2 off = vec2(0.0);
  for (int i = 0; i < 24; i++) {
    if (i >= uRippleCount) break;
    vec4 r = uRipples[i];
    vec2 d = uv - r.xy; d.x *= aspect;
    float dist = length(d);
    float age = r.z;
    float rad = age * (0.22 + 0.12 * r.w);
    float width = 0.018 + age * 0.045;
    float x = (dist - rad) / width;
    float amp = r.w * exp(-age * 1.25) * 0.03;
    off += (d / (dist + 1e-4)) * (-x * exp(-x * x)) * amp;
  }
  off.x /= aspect;
  vec2 suv = uv + off;

  // chromatic split grows with refraction and toward the edges
  vec2 ca = off * 1.0 + (uv - 0.5) * 0.0008;
  vec3 col;
  col.r = texture(uParticles, suv + ca).r;
  col.g = texture(uParticles, suv).g;
  col.b = texture(uParticles, suv - ca).b;

  // drops sit at mid depth, so they parallax half as much as the nearest sparkles
  vec2 camUv = uCam / vec2(aspect, 1.0);
  col += drops(suv - camUv * 0.5);

  // abstract space behind everything, in parallax layers
  vec2 bp = suv * vec2(aspect, 1.0);
  vec2 nbp = bp - uCam * 0.05;
  float neb = fbm(nbp * 1.6 + vec2(uTime * 0.012, -uTime * 0.008));
  float neb2 = fbm(nbp * 3.1 - vec2(uTime * 0.006, uTime * 0.011) + neb);
  vec3 bg = mix(vec3(0.004, 0.003, 0.012), vec3(0.028, 0.010, 0.050), neb);
  bg += vec3(0.004, 0.016, 0.03) * smoothstep(0.45, 0.85, neb2);
  bg *= 0.85 + 0.5 * uPulse + 0.6 * uLevel;
  bg += vec3(0.55, 0.6, 0.9) * 0.16 * starLayer(bp - uCam * 0.03, 160.0, 0.985, 0.0);
  bg += vec3(0.6, 0.62, 0.9) * 0.22 * starLayer(bp - uCam * 0.09, 95.0, 0.987, 17.0);
  bg += vec3(0.75, 0.72, 1.0) * 0.3 * starLayer(bp - uCam * 0.2, 45.0, 0.99, 41.0);

  col += bg + aurora(suv);
  col += texture(uBloom, suv).rgb * uBloomIntensity;

  col = aces(col * 1.05);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(lum), col, 1.18), 0.0);

  vec2 vd = (uv - 0.5) * vec2(aspect, 1.0);
  col *= mix(0.5, 1.0, smoothstep(1.15, 0.25, length(vd)));
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash(uv * uRes + fract(uTime) * 91.7) - 0.5) * (2.2 / 255.0);
  fragColor = vec4(col, 1.0);
}`;

const VS_PARTICLE = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=1) in vec4 aColor;
layout(location=2) in vec2 aSizeKind;
out vec4 vColor;
flat out int vKind;
void main(){
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = aSizeKind.x;
  vColor = aColor;
  vKind = int(aSizeKind.y + 0.5);
}`;

const FS_PARTICLE = `#version 300 es
precision highp float;
in vec4 vColor;
flat in int vKind;
out vec4 fragColor;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float a;
  if (vKind == 1) {
    float r = sqrt(r2);
    float rays = (exp(-abs(p.x) * 22.0) + exp(-abs(p.y) * 22.0)) * (1.0 - r);
    float diag = (exp(-abs(p.x + p.y) * 30.0) + exp(-abs(p.x - p.y) * 30.0)) * (1.0 - r) * 0.35;
    a = exp(-r2 * 30.0) * 1.4 + rays * 0.9 + diag;
  } else if (vKind == 2) {
    a = exp(-r2 * 5.0) * 0.8 + exp(-r2 * 1.6) * 0.25;
  } else {
    a = exp(-r2 * 10.0) + exp(-r2 * 3.0) * 0.3;
  }
  fragColor = vec4(vColor.rgb * vColor.a * a, 1.0);
}`;

// ---------------------------------------------------------------- gl helpers

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

class Program {
  constructor(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.p = p;
    this.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      this.u[name] = gl.getUniformLocation(p, name);
    }
  }
  bind() { gl.useProgram(this.p); return this; }
}

const progs = {
  copy: new Program(VS_BASE, FS_COPY),
  clear: new Program(VS_BASE, FS_CLEAR),
  solid: new Program(VS_BASE, FS_SOLID),
  splat: new Program(VS_BASE, FS_SPLAT),
  advect: new Program(VS_BASE, FS_ADVECT),
  divergence: new Program(VS_BASE, FS_DIVERGENCE),
  curl: new Program(VS_BASE, FS_CURL),
  vorticity: new Program(VS_BASE, FS_VORTICITY),
  pressure: new Program(VS_BASE, FS_PRESSURE),
  gradient: new Program(VS_BASE, FS_GRADIENT),
  prefilter: new Program(VS_BASE, FS_BLOOM_PREFILTER),
  blur: new Program(VS_BASE, FS_BLUR),
  display: new Program(VS_BASE, FS_DISPLAY),
  fx: new Program(VS_BASE, FS_FX),
  particle: new Program(VS_PARTICLE, FS_PARTICLE),
};

const quadVAO = gl.createVertexArray();
gl.bindVertexArray(quadVAO);
const quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

function blit(target) {
  gl.bindVertexArray(quadVAO);
  if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.viewport(0, 0, target.w, target.h); }
  else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function createFBO(w, h, ifmt, fmt, filter) {
  gl.activeTexture(gl.TEXTURE0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, gl.HALF_FLOAT, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return {
    tex, fbo, w, h, texel: [1 / w, 1 / h],
    attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; },
    dispose() { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); },
  };
}

function createDoubleFBO(w, h, ifmt, fmt, filter) {
  let a = createFBO(w, h, ifmt, fmt, filter);
  let b = createFBO(w, h, ifmt, fmt, filter);
  return {
    w, h, texel: a.texel,
    get read() { return a; },
    get write() { return b; },
    swap() { const t = a; a = b; b = t; },
    dispose() { a.dispose(); b.dispose(); },
  };
}

function getRes(res) {
  let ar = gl.drawingBufferWidth / gl.drawingBufferHeight;
  if (ar < 1) ar = 1 / ar;
  const min = Math.round(res), max = Math.round(res * ar);
  return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: max, h: min } : { w: min, h: max };
}

// ---------------------------------------------------------------- noise

const perm = new Uint8Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = 1337;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const GRAD = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1];
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
function noise2(xin, yin) {
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s), j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t), y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;
  let n = 0, tt, g;
  tt = 0.5 - x0 * x0 - y0 * y0;
  if (tt > 0) { g = (perm[ii + perm[jj]] & 7) * 2; tt *= tt; n += tt * tt * (GRAD[g] * x0 + GRAD[g + 1] * y0); }
  tt = 0.5 - x1 * x1 - y1 * y1;
  if (tt > 0) { g = (perm[ii + i1 + perm[jj + j1]] & 7) * 2; tt *= tt; n += tt * tt * (GRAD[g] * x1 + GRAD[g + 1] * y1); }
  tt = 0.5 - x2 * x2 - y2 * y2;
  if (tt > 0) { g = (perm[ii + 1 + perm[jj + 1]] & 7) * 2; tt *= tt; n += tt * tt * (GRAD[g] * x2 + GRAD[g + 1] * y2); }
  return 70 * n;
}

const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;

function hsv(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const boost = lum < 0.45 ? Math.min(1.8, Math.sqrt(0.45 / Math.max(lum, 0.05))) : 1;
  return [r * boost, g * boost, b * boost];
}

// ---------------------------------------------------------------- state

let aspect = 1;
let dye, velocity, divergence, curlFBO, pressure, particleFBO, flowFBO;
let bloomChain = [];
let flowW = CFG.FLOW_W, flowH = 36;
let flowGrid = new Float32Array(flowW * flowH * 4);
let flowScale = 1 / CFG.SIM_RES;
let readPBO = null, readFence = null, readbackOK = true;

function initFramebuffers() {
  [dye, velocity, divergence, curlFBO, pressure, particleFBO, flowFBO].forEach((f) => f && f.dispose());
  bloomChain.forEach((f) => f.dispose());

  const sim = getRes(CFG.SIM_RES);
  const dyeR = getRes(CFG.DYE_RES);
  const L = gl.LINEAR;
  dye = createDoubleFBO(dyeR.w, dyeR.h, gl.RGBA16F, gl.RGBA, L);
  velocity = createDoubleFBO(sim.w, sim.h, gl.RG16F, gl.RG, L);
  divergence = createFBO(sim.w, sim.h, gl.R16F, gl.RED, gl.NEAREST);
  curlFBO = createFBO(sim.w, sim.h, gl.R16F, gl.RED, gl.NEAREST);
  pressure = createDoubleFBO(sim.w, sim.h, gl.R16F, gl.RED, gl.NEAREST);
  particleFBO = createFBO(gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA16F, gl.RGBA, L);

  const b = getRes(CFG.BLOOM_RES);
  bloomChain = [];
  for (let i = 0; i < CFG.BLOOM_ITER; i++) {
    const w = b.w >> i, h = b.h >> i;
    if (w < 2 || h < 2) break;
    bloomChain.push(createFBO(w, h, gl.RGBA16F, gl.RGBA, L));
  }

  flowW = CFG.FLOW_W;
  flowH = Math.max(8, Math.round(flowW / aspect));
  flowFBO = createFBO(flowW, flowH, gl.RGBA16F, gl.RGBA, L);
  flowGrid = new Float32Array(flowW * flowH * 4);
  flowScale = 1 / sim.h;
  if (readPBO) gl.deleteBuffer(readPBO);
  readPBO = gl.createBuffer();
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, readPBO);
  gl.bufferData(gl.PIXEL_PACK_BUFFER, flowGrid.byteLength, gl.STREAM_READ);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  if (readFence) { gl.deleteSync(readFence); readFence = null; }
}

function resize() {
  const w = Math.floor(window.innerWidth * CFG.DPR);
  const h = Math.floor(window.innerHeight * CFG.DPR);
  if (canvas.width === w && canvas.height === h && dye) return;
  canvas.width = w; canvas.height = h;
  aspect = w / h;
  initFramebuffers();
}

// ---------------------------------------------------------------- splats

const dyeSplats = [];
const velSplats = [];
function splatDye(x, y, radius, r, g, b) { dyeSplats.push(x / aspect, y, radius, 0, r, g, b, 0); }
function splatVel(x, y, radius, fx, fy, swirl = 0) { velSplats.push(x / aspect, y, radius, swirl, fx, fy, 0, 0); }

const splatPts = new Float32Array(128), splatCols = new Float32Array(128);
function flushSplats(list, target) {
  const total = list.length / 8;
  if (!total) return;
  const p = progs.splat.bind();
  gl.uniform1f(p.u.aspectRatio, aspect);
  gl.uniform2f(p.u.texelSize, target.texel[0], target.texel[1]);
  for (let start = 0; start < total; start += 32) {
    const n = Math.min(32, total - start);
    for (let k = 0; k < n; k++) {
      const o = (start + k) * 8;
      splatPts.set(list.slice(o, o + 4), k * 4);
      splatCols.set(list.slice(o + 4, o + 8), k * 4);
    }
    gl.uniform1i(p.u.uCount, n);
    gl.uniform4fv(p.u.uPoints, splatPts);
    gl.uniform4fv(p.u.uColors, splatCols);
    gl.uniform1i(p.u.uTarget, target.read.attach(0));
    blit(target.write);
    target.swap();
  }
  list.length = 0;
}

// ---------------------------------------------------------------- fluid

function stepFluid(dt, curlStrength, dyeDissipation) {
  gl.disable(gl.BLEND);
  const ts = velocity.texel;

  let p = progs.curl.bind();
  gl.uniform2f(p.u.texelSize, ts[0], ts[1]);
  gl.uniform1i(p.u.uVelocity, velocity.read.attach(0));
  blit(curlFBO);

  p = progs.vorticity.bind();
  gl.uniform2f(p.u.texelSize, ts[0], ts[1]);
  gl.uniform1i(p.u.uVelocity, velocity.read.attach(0));
  gl.uniform1i(p.u.uCurl, curlFBO.attach(1));
  gl.uniform1f(p.u.curl, curlStrength);
  gl.uniform1f(p.u.dt, dt);
  blit(velocity.write); velocity.swap();

  p = progs.divergence.bind();
  gl.uniform2f(p.u.texelSize, ts[0], ts[1]);
  gl.uniform1i(p.u.uVelocity, velocity.read.attach(0));
  blit(divergence);

  p = progs.clear.bind();
  gl.uniform2f(p.u.texelSize, ts[0], ts[1]);
  gl.uniform1i(p.u.uTexture, pressure.read.attach(0));
  gl.uniform1f(p.u.value, CFG.PRESSURE);
  blit(pressure.write); pressure.swap();

  p = progs.pressure.bind();
  gl.uniform2f(p.u.texelSize, ts[0], ts[1]);
  gl.uniform1i(p.u.uDivergence, divergence.attach(0));
  for (let i = 0; i < CFG.PRESSURE_ITER; i++) {
    gl.uniform1i(p.u.uPressure, pressure.read.attach(1));
    blit(pressure.write); pressure.swap();
  }

  p = progs.gradient.bind();
  gl.uniform2f(p.u.texelSize, ts[0], ts[1]);
  gl.uniform1i(p.u.uPressure, pressure.read.attach(0));
  gl.uniform1i(p.u.uVelocity, velocity.read.attach(1));
  blit(velocity.write); velocity.swap();

  p = progs.advect.bind();
  gl.uniform2f(p.u.texelSize, ts[0], ts[1]);
  gl.uniform2f(p.u.simTexel, ts[0], ts[1]);
  gl.uniform1f(p.u.dt, dt);
  const vid = velocity.read.attach(0);
  gl.uniform1i(p.u.uVelocity, vid);
  gl.uniform1i(p.u.uSource, vid);
  gl.uniform1f(p.u.dissipation, CFG.VEL_DISSIPATION);
  gl.uniform1f(p.u.hiDecay, 0);
  blit(velocity.write); velocity.swap();
  gl.uniform1f(p.u.hiDecay, 1.5);

  gl.uniform2f(p.u.texelSize, dye.texel[0], dye.texel[1]);
  gl.uniform1i(p.u.uVelocity, velocity.read.attach(0));
  gl.uniform1i(p.u.uSource, dye.read.attach(1));
  gl.uniform1f(p.u.dissipation, dyeDissipation);
  blit(dye.write); dye.swap();
}

// Async GPU->CPU readback of a coarse velocity field so particles ride the liquid.
function updateFlowReadback() {
  if (!readbackOK) return;
  try {
    if (readFence) {
      const st = gl.clientWaitSync(readFence, 0, 0);
      if (st === gl.TIMEOUT_EXPIRED) return;
      gl.deleteSync(readFence); readFence = null;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, readPBO);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, flowGrid);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    }
    const p = progs.copy.bind();
    gl.uniform2f(p.u.texelSize, flowFBO.texel[0], flowFBO.texel[1]);
    gl.uniform1i(p.u.uTexture, velocity.read.attach(0));
    blit(flowFBO);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, readPBO);
    gl.readPixels(0, 0, flowW, flowH, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    readFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  } catch (e) {
    readbackOK = false;
    console.warn('flow readback disabled', e);
  }
}

// ---------------------------------------------------------------- curl noise field (CPU)

const CG_W = 64, CG_H = 36;
const curlPsi = new Float32Array((CG_W + 1) * (CG_H + 1));
function updateCurlField(t) {
  for (let j = 0; j <= CG_H; j++) {
    const y = j / CG_H;
    for (let i = 0; i <= CG_W; i++) {
      const x = (i / CG_W) * aspect;
      curlPsi[j * (CG_W + 1) + i] =
        noise2(x * 1.3 + t * 0.045, y * 1.3 - t * 0.03) +
        0.5 * noise2(x * 2.9 - t * 0.07, y * 2.9 + t * 0.05 + 17.3);
    }
  }
}

const flowOut = [0, 0];
function sampleFlow(x, y) {
  let fx = 0, fy = 0;
  const u = x / aspect;
  let gx = u * flowW - 0.5, gy = y * flowH - 0.5;
  gx = Math.min(flowW - 1.001, Math.max(0, gx));
  gy = Math.min(flowH - 1.001, Math.max(0, gy));
  const ix = gx | 0, iy = gy | 0, tx = gx - ix, ty = gy - iy;
  const i00 = (iy * flowW + ix) * 4, i10 = i00 + 4, i01 = i00 + flowW * 4, i11 = i01 + 4;
  fx = (flowGrid[i00] * (1 - tx) + flowGrid[i10] * tx) * (1 - ty) + (flowGrid[i01] * (1 - tx) + flowGrid[i11] * tx) * ty;
  fy = (flowGrid[i00 + 1] * (1 - tx) + flowGrid[i10 + 1] * tx) * (1 - ty) + (flowGrid[i01 + 1] * (1 - tx) + flowGrid[i11 + 1] * tx) * ty;
  fx *= flowScale; fy *= flowScale;

  let cx = u * CG_W, cy = y * CG_H;
  cx = Math.min(CG_W - 0.001, Math.max(0, cx));
  cy = Math.min(CG_H - 0.001, Math.max(0, cy));
  const jx = cx | 0, jy = cy | 0, sx = cx - jx, sy = cy - jy;
  const W = CG_W + 1;
  const p00 = curlPsi[jy * W + jx], p10 = curlPsi[jy * W + jx + 1];
  const p01 = curlPsi[(jy + 1) * W + jx], p11 = curlPsi[(jy + 1) * W + jx + 1];
  const dpdx = ((p10 - p00) * (1 - sy) + (p11 - p01) * sy) * CG_W / aspect;
  const dpdy = ((p01 - p00) * (1 - sx) + (p11 - p10) * sx) * CG_H;
  const T = 0.028 * (1 + state.mod * 1.5);
  flowOut[0] = fx + dpdy * T;
  flowOut[1] = fy - dpdx * T;
  return flowOut;
}

// ---------------------------------------------------------------- particles

const PMAX = CFG.MAX_PARTICLES;
const P = {
  n: 0,
  x: new Float32Array(PMAX), y: new Float32Array(PMAX),
  vx: new Float32Array(PMAX), vy: new Float32Array(PMAX),
  life: new Float32Array(PMAX), maxLife: new Float32Array(PMAX),
  size: new Float32Array(PMAX),
  r: new Float32Array(PMAX), g: new Float32Array(PMAX), b: new Float32Array(PMAX),
  kind: new Float32Array(PMAX), seed: new Float32Array(PMAX),
  couple: new Float32Array(PMAX), tw: new Float32Array(PMAX),
  z: new Float32Array(PMAX), vz: new Float32Array(PMAX),
};
const P_ARRAYS = ['x', 'y', 'vx', 'vy', 'life', 'maxLife', 'size', 'r', 'g', 'b', 'kind', 'seed', 'couple', 'tw', 'z', 'vz'].map((k) => P[k]);

// z is depth: 0 = nearest the viewer, 1 = deep in the background.
function emit(x, y, vx, vy, life, size, col, kind, couple, z = 0.5, vz = 0) {
  if (P.n >= PMAX) return;
  const i = P.n++;
  P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy;
  P.z[i] = z; P.vz[i] = vz;
  P.life[i] = life; P.maxLife[i] = life; P.size[i] = size;
  P.r[i] = col[0]; P.g[i] = col[1]; P.b[i] = col[2];
  P.kind[i] = kind; P.seed[i] = Math.random() * 100; P.couple[i] = couple;
  P.tw[i] = rand(4, 14);
}

function updateParticles(dt) {
  let i = 0;
  while (i < P.n) {
    P.life[i] -= dt;
    if (P.life[i] <= 0) {
      const j = --P.n;
      if (i !== j) for (const a of P_ARRAYS) a[i] = a[j];
      continue;
    }
    const f = sampleFlow(P.x[i], P.y[i]);
    const k = Math.min(1, P.couple[i] * dt);
    P.vx[i] += (f[0] - P.vx[i]) * k;
    P.vy[i] += (f[1] - P.vy[i]) * k;
    P.x[i] += P.vx[i] * dt;
    P.y[i] += P.vy[i] * dt;
    P.vz[i] *= 1 - k;
    P.z[i] = Math.min(1, Math.max(0, P.z[i] + P.vz[i] * dt));
    i++;
  }
}

const pVerts = new Float32Array(PMAX * 8);
const pVAO = gl.createVertexArray();
gl.bindVertexArray(pVAO);
const pBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
gl.bufferData(gl.ARRAY_BUFFER, pVerts.byteLength, gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 8);
gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);

function renderParticles(dt, time) {
  const dpr = canvas.height / 1000;
  const glow = 1 + state.pulse * 0.25;
  const cx = aspect / 2, cy = 0.5;
  const camX = state.cam[0], camY = state.cam[1];
  for (let i = 0; i < P.n; i++) {
    const t = P.life[i] / P.maxLife[i];
    const kind = P.kind[i];
    let a = Math.pow(t, 1.25);
    if (kind !== 2) a *= Math.min(1, (P.maxLife[i] - P.life[i]) / 0.05);
    if (kind === 1) a *= 0.5 + 0.5 * Math.sin(time * P.tw[i] + P.seed[i]);
    const hot = P.maxLife[i] < 0.01 ? 0 : Math.pow(t, 6) * 0.75;

    // perspective: near things are larger, brighter, spread wider and parallax more
    const z = P.z[i];
    const spread = 1.07 - 0.14 * z;
    const par = 1 - z;
    const px = cx + (P.x[i] - cx) * spread + camX * par;
    const py = cy + (P.y[i] - cy) * spread + camY * par;
    const scale = 1.45 - 0.85 * z;
    const bright = 1.15 - 0.7 * z;
    const fog = z * 0.3;
    const o = i * 8;
    pVerts[o] = px / aspect;
    pVerts[o + 1] = py;
    pVerts[o + 2] = (P.r[i] + (1 - P.r[i]) * hot) * (1 - fog) + 0.25 * fog;
    pVerts[o + 3] = (P.g[i] + (1 - P.g[i]) * hot) * (1 - fog) + 0.3 * fog;
    pVerts[o + 4] = (P.b[i] + (1 - P.b[i]) * hot) * (1 - fog) + 0.6 * fog;
    pVerts[o + 5] = a * glow * bright;
    pVerts[o + 6] = P.size[i] * scale * (kind === 2 ? 1 : 0.35 + 0.65 * t) * dpr;
    pVerts[o + 7] = kind;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, particleFBO.fbo);
  gl.viewport(0, 0, particleFBO.w, particleFBO.h);
  gl.enable(gl.BLEND);

  // fade the previous frame for soft motion trails
  gl.blendFunc(gl.ZERO, gl.CONSTANT_ALPHA);
  gl.blendColor(0, 0, 0, Math.pow(0.72, dt * 60));
  progs.solid.bind();
  gl.bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.blendFunc(gl.ONE, gl.ONE);
  if (fx.rainbow.level > 0.002 || fx.prism.level > 0.002) {
    const p = progs.fx.bind();
    gl.uniform1f(p.u.aspect, aspect);
    gl.uniform1f(p.u.uTime, time);
    gl.uniform2f(p.u.uCam, state.cam[0], state.cam[1]);
    gl.uniform4f(p.u.uRainbow, fx.rainbow.age, fx.rainbow.level, fx.rainbow.vel, 0);
    gl.uniform4f(p.u.uPrism, fx.prism.age, fx.prism.level, fx.prism.vel, 0);
    gl.uniform1f(p.u.uGain, 1 - Math.pow(0.72, dt * 60));
    gl.bindVertexArray(quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  if (P.n) {
    progs.particle.bind();
    gl.bindVertexArray(pVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pVerts, 0, P.n * 8);
    gl.drawArrays(gl.POINTS, 0, P.n);
  }
  gl.disable(gl.BLEND);
}

// ---------------------------------------------------------------- creatures

const creatures = [];

function spawnCreature(x, y, note, vel, hue, ch, z) {
  const t = clamp01((note - 21) / 87);
  const c = {
    x, y, z, note, ch, hue,
    lastPulse: 0,
    homeX: x, homeY: y,
    heading: rand(0, Math.PI * 2),
    speed: lerp(0.03, 0.13, t) * (0.7 + 0.7 * vel),
    size: lerp(46, 14, t) * (0.6 + 0.7 * vel),
    vel,
    energy: 1,
    held: true,
    release: lerp(7.5, 3.2, t) * (0.8 + 0.4 * vel) * rand(0.85, 1.2),
    phase: rand(0, Math.PI * 2),
    pulseRate: lerp(2.2, 6.5, t) * rand(0.8, 1.25),
    agility: lerp(1.0, 2.6, t) * rand(0.8, 1.3),
    seed: rand(0, 1000),
    pressure: 0,
    sparkleAcc: 0,
    age: 0,
  };
  creatures.push(c);
  if (creatures.length > CFG.MAX_CREATURES) {
    const old = creatures.find((k) => k.held) || creatures[0];
    old.held = false; old.release = Math.min(old.release, 1.2);
  }
  return c;
}

function updateCreatures(dt, time) {
  const cx = aspect / 2, cy = 0.5;
  for (let i = creatures.length - 1; i >= 0; i--) {
    const c = creatures[i];
    c.age += dt;
    if (c.held) c.energy = Math.max(0.35, c.energy * Math.exp(-dt * 0.05));
    else c.energy -= dt / c.release;
    if (c.energy <= 0) { creatures.splice(i, 1); continue; }
    const e = c.energy * c.energy * (3 - 2 * c.energy);

    // wander + gentle homing when drifting toward the edges
    c.heading += noise2(c.seed, time * 0.55) * c.agility * 2.4 * dt;
    const dx = cx - c.x, dy = cy - c.y;
    const edge = Math.max(
      Math.max(0, 0.12 - c.x) / 0.12, Math.max(0, c.x - (aspect - 0.12)) / 0.12,
      Math.max(0, 0.12 - c.y) / 0.12, Math.max(0, c.y - 0.88) / 0.12,
    );
    if (edge > 0) {
      let d = Math.atan2(dy, dx) - c.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      c.heading += d * Math.min(1, edge * 4 * dt);
    }
    // a loose tether to where the key put it, so creatures stay near their spot on the keyboard
    const hx = c.homeX - c.x, hy = c.homeY - c.y;
    const tether = Math.max(0, Math.hypot(hx, hy) - 0.05) / 0.1;
    if (tether > 0) {
      let d = Math.atan2(hy, hx) - c.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      c.heading += d * Math.min(1, tether * 3 * dt);
    }

    // jellyfish-like pulse swimming
    c.phase += dt * c.pulseRate;
    const pulse = Math.pow(0.5 + 0.5 * Math.sin(c.phase), 2.2);
    const sp = c.speed * (0.3 + 1.1 * pulse) * (0.4 + 0.6 * e);
    const dirx = Math.cos(c.heading), diry = Math.sin(c.heading);
    const f = sampleFlow(c.x, c.y);
    c.x += (dirx * sp + f[0] * 0.3) * dt;
    c.y += (diry * sp + f[1] * 0.3) * dt;
    c.hue += dt * 0.003;

    const col = hsv(c.hue + 0.015 * Math.sin(c.age * 0.9 + c.seed), 0.9, 1);
    const glow = (0.5 + 0.5 * pulse) * e * (1 + c.pressure);

    // each swim stroke lays a droplet, so the trail is a string of beads rather than a smear
    const cycle = Math.floor(c.phase / (Math.PI * 2));
    if (cycle !== c.lastPulse) {
      c.lastPulse = cycle;
      const dk = 0.3 * e * (0.6 + c.vel) * (1 + c.pressure);
      splatDye(c.x - dirx * 0.012, c.y - diry * 0.012, 0.00009 * (c.size / 30), col[0] * dk, col[1] * dk, col[2] * dk);
    }
    const jet = (25 + 160 * c.speed) * e * (0.25 + pulse);
    splatVel(c.x - dirx * 0.01, c.y - diry * 0.01, 0.0004 * (c.size / 30), -dirx * jet, -diry * jet, 0);

    // body: a pulsing glowing core with a soft corona
    const bodySize = c.size * (0.75 + 0.35 * pulse);
    emit(c.x, c.y, 0, 0, 0.0001, bodySize, col.map((v) => v * 0.3 * glow), 2, 0, c.z);
    emit(c.x, c.y, 0, 0, 0.0001, bodySize * 0.22, col.map((v) => (0.3 + 0.7 * v) * glow * 0.8), 0, 0, c.z);

    // tentacles: drifting motes shed from the rear that sway in the current
    const shed = Math.round(1 + 2 * e);
    for (let k = 0; k < shed; k++) {
      const sway = Math.sin(c.age * 7 + k * 2.1 + c.seed) * 0.6;
      const bx = -dirx * Math.cos(sway) + diry * Math.sin(sway);
      const by = -diry * Math.cos(sway) - dirx * Math.sin(sway);
      const s = rand(0.02, 0.07);
      const tcol = hsv(c.hue + rand(-0.025, 0.025), rand(0.7, 0.95), 1).map((v) => v * 0.7 * e);
      emit(c.x + bx * 0.008, c.y + by * 0.008, bx * s, by * s, rand(0.8, 2.0) * (0.5 + e), rand(2.5, 6) * (c.size / 30 + 0.4), tcol, 0, rand(0.6, 1.6), c.z, rand(-0.06, 0.06));
    }

    // held notes keep breathing out sparkles
    if (c.held) {
      c.sparkleAcc += dt * (4 + 10 * c.vel) * (1 + c.pressure * 2);
      while (c.sparkleAcc > 1) {
        c.sparkleAcc -= 1;
        const a = rand(0, Math.PI * 2), s = rand(0.03, 0.12);
        emit(c.x, c.y, Math.cos(a) * s, Math.sin(a) * s, rand(1, 2.5), rand(5, 12), hsv(c.hue + rand(-0.03, 0.03), 0.6, 1), 1, rand(0.8, 2), c.z, rand(-0.2, 0.2));
      }
    }
  }
}

// ---------------------------------------------------------------- musical mapping

const state = {
  sustain: false, mod: 0, bend: 0, pulse: 0, hueShift: rand(0, 1),
  lastMidi: -1e9, clockTicks: 0, brightness: 1, cam: [0, 0],
};
const fx = {
  rainbow: { age: 0, level: 0, vel: 0, held: false, sustained: false },
  prism: { age: 0, level: 0, vel: 0, held: false, sustained: false },
};
const LOWEST_KEY = 21, HIGHEST_KEY = 108;
const ripples = [];
const held = new Map(); // key "ch:note" -> { creature, down, sustained }

// Left-to-right across the screen follows the 88 keys; height drifts gently and lifts with loudness.
function notePosition(note, vel, time) {
  const t = clamp01((note - 21) / 87);
  const margin = 0.06 * aspect;
  return {
    x: margin + t * (aspect - 2 * margin) + noise2(note * 0.53, time * 0.2) * 0.012 * aspect,
    y: 0.5 + noise2(note * 0.31 + 20, time * 0.15) * 0.14 + (vel - 0.5) * 0.16,
  };
}

// Velocity sets the hue: soft notes are teal/blue, through violet and magenta, to hot red-gold when loud.
// Pitch class only tints it slightly.
function noteHue(note, velocity) {
  const fifth = ((note % 12) * 7) % 12;
  const v = clamp01((velocity - 0.12) / 0.68);
  return lerp(0.5, 1.12, v) + (fifth / 12 - 0.5) * 0.05 + state.bend * 0.06;
}

function noteOn(note, velocity, ch = 0, at = null) {
  const now = performance.now() / 1000;
  state.lastMidi = now;
  const vel = 0.25 + 0.75 * Math.pow(clamp01(velocity), 0.6);
  const t = clamp01((note - 21) / 87);
  const pos = at || notePosition(note, clamp01(velocity), clockTime);
  const { x, y } = pos;
  const hue = noteHue(note, velocity);
  const sizeF = lerp(1.5, 0.55, t) * (0.55 + 0.8 * vel);
  const col = hsv(hue, lerp(0.72, 0.98, clamp01(velocity)), 1);

  // loud notes come forward, soft ones sit further back
  const z = clamp01(0.62 - 0.26 * clamp01(velocity) + rand(-0.06, 0.06));

  // one glossy drop with a bright nucleus, plus a few separate droplets flung outward
  const intensity = 0.45 + 0.8 * vel;
  splatDye(x, y, 0.00045 * sizeF, col[0] * intensity, col[1] * intensity, col[2] * intensity);
  const core = 0.3 + 0.5 * vel;
  splatDye(x, y, 0.00008 * sizeF, lerp(col[0], 1, 0.4) * core, lerp(col[1], 1, 0.4) * core, lerp(col[2], 1, 0.4) * core);

  const spin = (note % 2 ? 1 : -1) * (rand(0.6, 1.0));
  splatVel(x, y, 0.002 * sizeF, 0, 0, spin * (15 + 60 * vel));

  const sats = 1 + Math.floor(vel * 2.5 + Math.random());
  const base = rand(0, Math.PI * 2);
  for (let k = 0; k < sats; k++) {
    const a = base + (k / sats) * Math.PI * 2 + rand(-0.5, 0.5);
    const d = rand(0.03, 0.055) * sizeF;
    const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
    const sc = hsv(hue + rand(-0.04, 0.04), rand(0.8, 1), 1);
    const si = intensity * rand(0.6, 1.0);
    splatDye(sx, sy, 0.00011 * sizeF * rand(0.6, 1.3), sc[0] * si, sc[1] * si, sc[2] * si);
    const force = (150 + 450 * vel) * rand(0.7, 1.2);
    splatVel(sx, sy, 0.0004 * sizeF, Math.cos(a) * force, Math.sin(a) * force, 0);
  }

  ripples.push({ x: x / aspect, y, age: 0, strength: (0.35 + 0.9 * vel) * lerp(1.25, 0.6, t) });
  if (ripples.length > 24) ripples.shift();

  // sparkle burst: explode outward, then get swallowed by the current
  const count = Math.round((30 + 120 * vel) * lerp(1.15, 0.8, t));
  const spdF = lerp(0.7, 1.4, t);
  for (let k = 0; k < count; k++) {
    // a direction on the sphere, so the burst is a volume that partly flies toward / away from you
    const uz = rand(-1, 1), ua = rand(0, Math.PI * 2), ur = Math.sqrt(1 - uz * uz);
    const s = (0.04 + Math.pow(Math.random(), 2) * 0.55) * (0.45 + vel) * spdF;
    const star = Math.random() < 0.22;
    const pc = Math.random() < 0.08 ? [1, 1, 1] : hsv(hue + rand(-0.03, 0.03), rand(0.6, 1), 1);
    emit(x, y, Math.cos(ua) * ur * s, Math.sin(ua) * ur * s,
      rand(1.2, 3.6) * lerp(1.4, 0.8, t),
      star ? rand(7, 18) * (0.7 + vel * 0.6) : rand(2, 6),
      pc, star ? 1 : 0, rand(0.5, 1.8), z, uz * s * 0.9);
  }
  // spiral arms
  const arms = 28;
  for (let k = 0; k < arms; k++) {
    const a = (k / arms) * Math.PI * 2 + base;
    const s = rand(0.08, 0.2) * (0.5 + vel) * spdF;
    const ta = a + spin * 1.2;
    emit(x + Math.cos(a) * 0.01, y + Math.sin(a) * 0.01, Math.cos(ta) * s, Math.sin(ta) * s,
      rand(1.5, 3.2), rand(3, 7), hsv(hue + 0.03 * Math.sin(a * 2), 0.85, 1), 0, rand(0.4, 1.0),
      z, Math.sin(a + base) * s * 0.8);
  }

  if (note === LOWEST_KEY && !at) triggerRainbow(velocity);
  if (note === HIGHEST_KEY && !at) triggerPrism(velocity);

  const creature = spawnCreature(x, y, note, vel, hue, ch, clamp01(0.5 + (z - 0.5) * 0.4));
  const key = ch + ':' + note;
  const prev = held.get(key);
  if (prev && prev.creature) prev.creature.held = false;
  held.set(key, { creature, down: true, sustained: false });
}

function releaseFx(f) {
  f.held = false;
  f.sustained = state.sustain;
}

function triggerRainbow(velocity) {
  const f = fx.rainbow;
  f.age = 0; f.level = 1; f.vel = clamp01(velocity); f.held = true; f.sustained = false;
  // a dusting of spectral sparkles along the arch
  const topY = 0.84, footY = 0.02, hx = aspect * 0.5 + 0.06;
  const cy = (topY * topY - hx * hx - footY * footY) / (2 * (topY - footY));
  const R = topY - cy, angMax = Math.atan2(hx, footY - cy);
  const width = 0.06 + 0.035 * f.vel;
  for (let k = 0; k < 360; k++) {
    const a01 = Math.random();
    const ang = -angMax + a01 * 2 * angMax;
    const off = rand(-1, 1);
    const r = R + off * width;
    const px = aspect / 2 + Math.sin(ang) * r, py = cy + Math.cos(ang) * r;
    if (py < 0) continue;
    const s = rand(0.005, 0.03);
    const h = (0.5 - 0.5 * off) * 0.78;
    emit(px, py, Math.sin(ang) * s, Math.cos(ang) * s, rand(1.5, 4.5) + a01 * 1.3, rand(3, 9),
      hsv(h, 0.85, 1), Math.random() < 0.3 ? 1 : 0, rand(0.2, 0.6), 0.5, rand(-0.04, 0.04));
  }
}

function triggerPrism(velocity) {
  const f = fx.prism;
  f.age = 0; f.level = 1; f.vel = clamp01(velocity); f.held = true; f.sustained = false;
  ripples.push({ x: 0.5, y: 0.47, age: 0, strength: 1.2 + f.vel });
  state.pulse = Math.min(1.5, state.pulse + 0.6 + f.vel);
  const r = (0.16 + 0.06 * f.vel) * 0.8, k3 = Math.sqrt(3);
  const verts = [[-r, -r / k3], [r, -r / k3], [0, 2 * r / k3]];
  for (const [vx, vy] of verts) {
    for (let k = 0; k < 40 + 60 * f.vel; k++) {
      const a = rand(0, Math.PI * 2), s = rand(0.02, 0.25) * (0.5 + f.vel);
      emit(aspect / 2 + vx, 0.47 + vy, Math.cos(a) * s, Math.sin(a) * s, rand(1, 3), rand(5, 14),
        Math.random() < 0.5 ? [1, 1, 1] : hsv(rand(0, 0.78), 0.8, 1), 1, rand(0.6, 1.4), 0.5, rand(-0.25, 0.25));
    }
  }
}

function updateFx(dt) {
  for (const f of [fx.rainbow, fx.prism]) {
    if (f.level <= 0.002) { f.level = 0; continue; }
    f.age += dt;
    const holding = f.held || (f.sustained && state.sustain);
    if (holding) f.level = Math.max(0.6, f.level * Math.exp(-dt * 0.04));
    else if (f.age > 1.5) f.level *= Math.exp(-dt / (1.6 + 1.6 * f.vel));
  }
}

function noteOff(note, ch = 0) {
  if (note === LOWEST_KEY) releaseFx(fx.rainbow);
  if (note === HIGHEST_KEY) releaseFx(fx.prism);
  const key = ch + ':' + note;
  const h = held.get(key);
  if (!h) return;
  h.down = false;
  if (state.sustain) { h.sustained = true; return; }
  if (h.creature) h.creature.held = false;
  held.delete(key);
}

function setSustain(on) {
  state.sustain = on;
  if (!on) {
    for (const [key, h] of held) {
      if (!h.down) { if (h.creature) h.creature.held = false; held.delete(key); }
    }
  }
}

function shimmer(x, y, amount, hue) {
  const n = Math.round(4 + amount * 22);
  for (let k = 0; k < n; k++) {
    const a = rand(0, Math.PI * 2), s = rand(0.02, 0.12) * (0.5 + amount);
    emit(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.8, 2.2), rand(4, 11), hsv(hue + rand(-0.05, 0.05), 0.5, 1), 1, rand(1, 2));
  }
  const c = hsv(hue, 0.7, 1).map((v) => v * 0.25 * amount);
  splatDye(x, y, 0.0005, c[0], c[1], c[2]);
}

const lastCC = new Map();
let lastShimmer = 0;
function onMIDIMessage(ev) {
  const d = ev.data;
  if (!d || !d.length) return;
  state.midiCount = (state.midiCount || 0) + 1;  const status = d[0];
  if (status >= 0xF0) {
    if (status === 0xF8) { if (++state.clockTicks % 24 === 0) state.pulse = Math.min(1.2, state.pulse + 0.5); }
    else if (status === 0xFA || status === 0xFB) { state.pulse = 1.2; ripples.push({ x: 0.5, y: 0.5, age: 0, strength: 0.6 }); }
    else if (status !== 0xFE) { const now = performance.now(); if (now - lastShimmer > 60) { lastShimmer = now; shimmer(rand(0.2, 0.8) * aspect, rand(0.2, 0.8), 0.4, state.hueShift + 0.5); } }
    return;
  }
  state.lastMidi = performance.now() / 1000;
  const type = status & 0xF0, ch = status & 0x0F;
  const a = d[1] ?? 0, b = d[2] ?? 0;
  switch (type) {
    case 0x90: if (b > 0) noteOn(a, b / 127, ch); else noteOff(a, ch); break;
    case 0x80: noteOff(a, ch); break;
    case 0xB0: handleCC(a, b); break;
    case 0xE0: state.bend = (((b << 7) | a) - 8192) / 8192; break;
    case 0xD0: for (const h of held.values()) if (h.creature && h.creature.ch === ch) h.creature.pressure = a / 127; break;
    case 0xA0: { const h = held.get(ch + ':' + a); if (h && h.creature) h.creature.pressure = b / 127; break; }
    case 0xC0: {
      state.hueShift += 0.13;
      for (let k = 0; k < 4; k++) shimmer(rand(0.15, 0.85) * aspect, rand(0.15, 0.85), 0.8, state.hueShift + k * 0.2);
      break;
    }
  }
}

function handleCC(cc, val) {
  if (cc === 64) { setSustain(val >= 64); return; }
  if (cc === 1) { state.mod = val / 127; return; }
  if (cc === 120 || cc === 123) { for (const h of held.values()) if (h.creature) h.creature.held = false; held.clear(); return; }
  const prev = lastCC.get(cc) ?? -100;
  if (Math.abs(prev - val) < 3) return;
  lastCC.set(cc, val);
  const now = performance.now();
  if (now - lastShimmer < 35) return;
  lastShimmer = now;
  const x = ((cc * 0.6180339) % 1 * 0.8 + 0.1) * aspect;
  shimmer(x, 0.1 + 0.8 * (val / 127), 0.5, state.hueShift + cc / 32);
}

// ---------------------------------------------------------------- MIDI access

let midiNames = [];
let hudTimer = null;
function hud(text, ms = 5000) {
  hudEl.textContent = text;
  hudEl.classList.add('show');
  clearTimeout(hudTimer);
  if (ms) hudTimer = setTimeout(() => hudEl.classList.remove('show'), ms);
}

async function initMIDI() {
  if (!navigator.requestMIDIAccess) { hud('web midi is not supported in this browser', 0); return; }
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    const bind = () => {
      midiNames = [];
      for (const input of access.inputs.values()) {
        input.onmidimessage = onMIDIMessage;
        midiNames.push(input.name);
      }
      hud(midiNames.length ? 'listening · ' + midiNames.join(' · ') : 'waiting for a midi device…', midiNames.length ? 5000 : 0);
    };
    bind();
    access.onstatechange = bind;
  } catch (e) {
    hud('midi access was blocked — click anywhere to retry', 0);
    window.addEventListener('pointerdown', () => initMIDI(), { once: true });
  }
}

// ---------------------------------------------------------------- microphone

// Log-spaced spectrum (low on the left, like the keyboard) with a scrolling history:
// the texture's rows are a ring buffer, so it is literally a spectrogram.
const SPEC_BINS = 128, SPEC_ROWS = 110, SPEC_RATE = 45;
const audio = {
  ready: false, label: '',
  spec: new Float32Array(SPEC_BINS), floor: new Float32Array(SPEC_BINS).fill(-60),
  level: 0, levelFloor: -60, bass: 0, treble: 0, head: 0, rowAcc: 0, moteAcc: 0,
};
let audioCtx = null, analyser = null, freqData = null, timeData = null;
const binLo = new Int32Array(SPEC_BINS), binHi = new Int32Array(SPEC_BINS);

const specTex = gl.createTexture();
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, specTex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, SPEC_BINS, SPEC_ROWS, 0, gl.RED, gl.FLOAT, new Float32Array(SPEC_BINS * SPEC_ROWS));

async function initAudio() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.45;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    freqData = new Float32Array(analyser.frequencyBinCount);
    timeData = new Float32Array(analyser.fftSize);
    const hzPerBin = audioCtx.sampleRate / analyser.fftSize;
    for (let i = 0; i < SPEC_BINS; i++) {
      const f0 = 32 * Math.pow(14000 / 32, i / SPEC_BINS);
      const f1 = 32 * Math.pow(14000 / 32, (i + 1) / SPEC_BINS);
      binLo[i] = Math.max(1, Math.floor(f0 / hzPerBin));
      binHi[i] = Math.max(binLo[i] + 1, Math.ceil(f1 / hzPerBin));
    }
    audio.label = stream.getAudioTracks()[0]?.label || 'microphone';
    audio.ready = true;
    const resume = () => audioCtx.state !== 'running' && audioCtx.resume();
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    hud((midiNames.length ? 'listening · ' + midiNames.join(' · ') + ' · ' : '') + 'mic · ' + audio.label);
  } catch (e) {
    console.warn('microphone unavailable', e);
  }
}

// Each band (and the overall level, stored at index SPEC_BINS) is measured against its own
// noise floor: the quietest it has been over the last few seconds. Room hum stays dark and
// only sound rising above it lights up.
const FLOOR_SECONDS = 6;
const floorCur = new Float32Array(SPEC_BINS + 1).fill(Infinity);
const floorHist = Array.from({ length: FLOOR_SECONDS }, () => new Float32Array(SPEC_BINS + 1).fill(Infinity));
let floorSlot = 0, floorTimer = 0;
function observeFloor(i, db) {
  if (db > -110 && db < floorCur[i]) floorCur[i] = db;
  let m = floorCur[i];
  for (let k = 0; k < FLOOR_SECONDS; k++) if (floorHist[k][i] < m) m = floorHist[k][i];
  return m;
}
function rotateFloors(dt) {
  floorTimer += dt;
  if (floorTimer < 1) return;
  floorTimer = 0;
  floorHist[floorSlot].set(floorCur);
  floorSlot = (floorSlot + 1) % FLOOR_SECONDS;
  floorCur.fill(Infinity);
}

function updateAudio(dt) {
  if (!audio.ready) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  analyser.getFloatFrequencyData(freqData);
  analyser.getFloatTimeDomainData(timeData);

  let sum = 0;
  for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
  const db = 20 * Math.log10(Math.sqrt(sum / timeData.length) + 1e-9);
  rotateFloors(dt);
  audio.levelFloor = observeFloor(SPEC_BINS, db);
  const lt = clamp01((db - audio.levelFloor - 5) / 40);
  audio.level += (lt - audio.level) * (1 - Math.exp(-dt * (lt > audio.level ? 18 : 3)));

  let bass = 0, treble = 0;
  for (let i = 0; i < SPEC_BINS; i++) {
    let p = 0;
    for (let b = binLo[i]; b < binHi[i]; b++) p += Math.pow(10, freqData[b] / 10);
    const bdb = 10 * Math.log10(p / (binHi[i] - binLo[i]) + 1e-12);
    audio.floor[i] = observeFloor(i, bdb);
    const e = clamp01((bdb - audio.floor[i] - 6) / 40);
    const s = audio.spec[i];
    audio.spec[i] = s + (e - s) * (1 - Math.exp(-dt * (e > s ? 30 : 5)));
    if (i < 24) bass += audio.spec[i];
    else if (i > 84) treble += audio.spec[i];
  }
  audio.bass = bass / 24;
  audio.treble = treble / (SPEC_BINS - 85);
  state.pulse = Math.max(state.pulse, audio.bass * 0.45);

  audio.rowAcc += dt * SPEC_RATE;
  if (audio.rowAcc >= 1) {
    audio.rowAcc = Math.min(audio.rowAcc - 1, 2);
    audio.head = (audio.head + 1) % SPEC_ROWS;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, specTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, audio.head, SPEC_BINS, 1, gl.RED, gl.FLOAT, audio.spec);
  }

  // high frequencies shed faint motes that drift up out of the aurora into deep space
  audio.moteAcc += dt * (audio.treble * 70 + audio.level * 12);
  while (audio.moteAcc > 1) {
    audio.moteAcc -= 1;
    const i = Math.floor(Math.random() * SPEC_BINS);
    if (Math.random() > audio.spec[i] + 0.05) continue;
    const u = (i + Math.random()) / SPEC_BINS;
    const c = hsv(lerp(0.4, 0.85, rand(0, 1) * 0.6 + u * 0.4), 0.55, 0.5 + audio.spec[i] * 0.5);
    emit(u * aspect, 0.1 + rand(0, 0.05), rand(-0.01, 0.01), rand(0.03, 0.09), rand(3, 6), rand(2, 4.5),
      c, Math.random() < 0.25 ? 1 : 0, 0.15, rand(0.78, 0.95), 0);
  }
}

// ---------------------------------------------------------------- keyboard + pointer fallback

const KEYMAP = 'awsedftgyhujkolp;\'';
let octave = 0;
const keysDown = new Set();
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  const k = e.key.toLowerCase();
  if (k === 'f') { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); return; }
  if (k === 'z') { octave = Math.max(-3, octave - 1); return; }
  if (k === 'x') { octave = Math.min(3, octave + 1); return; }
  if (k === ' ') { setSustain(true); return; }
  const idx = KEYMAP.indexOf(k);
  if (idx < 0 || keysDown.has(k)) return;
  keysDown.add(k);
  noteOn(60 + idx + octave * 12, rand(0.55, 1), 15);
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ') { setSustain(false); return; }
  const idx = KEYMAP.indexOf(k);
  if (idx < 0) return;
  keysDown.delete(k);
  noteOff(60 + idx + octave * 12, 15);
});

let pointer = null;
canvas.addEventListener('pointerdown', (e) => {
  const x = (e.clientX / window.innerWidth) * aspect, y = 1 - e.clientY / window.innerHeight;
  const note = Math.round(36 + (e.clientX / window.innerWidth) * 60);
  pointer = { x, y, id: e.pointerId, note };
  noteOn(note, 0.8, 14, { x, y });
});
canvas.addEventListener('pointermove', (e) => {
  wakeCursor();
  if (!pointer) return;
  const x = (e.clientX / window.innerWidth) * aspect, y = 1 - e.clientY / window.innerHeight;
  const dx = x - pointer.x, dy = y - pointer.y;
  pointer.x = x; pointer.y = y;
  splatVel(x, y, 0.0008, dx * 9000, dy * 9000, 0);
  const c = hsv(noteHue(pointer.note, 0.8), 0.85, 1).map((v) => v * 0.25);
  splatDye(x, y, 0.0004, c[0], c[1], c[2]);
});
const endPointer = () => { if (pointer) { noteOff(pointer.note, 14); pointer = null; } };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

let cursorTimer = null;
function wakeCursor() {
  document.body.classList.remove('idle-cursor');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => document.body.classList.add('idle-cursor'), 1500);
}
wakeCursor();

// ---------------------------------------------------------------- render

const rippleData = new Float32Array(24 * 4);

function renderBloom() {
  if (!bloomChain.length) return;
  gl.disable(gl.BLEND);
  let p = progs.prefilter.bind();
  gl.uniform2f(p.u.texelSize, bloomChain[0].texel[0], bloomChain[0].texel[1]);
  gl.uniform1i(p.u.uDye, dye.read.attach(0));
  gl.uniform1i(p.u.uParticles, particleFBO.attach(1));
  gl.uniform1f(p.u.threshold, CFG.BLOOM_THRESHOLD);
  gl.uniform1f(p.u.knee, CFG.BLOOM_KNEE);
  gl.uniform2f(p.u.uCam, state.cam[0], state.cam[1]);
  gl.uniform1f(p.u.aspect, aspect);
  blit(bloomChain[0]);

  p = progs.blur.bind();
  for (let i = 1; i < bloomChain.length; i++) {
    const src = bloomChain[i - 1];
    gl.uniform2f(p.u.srcTexel, src.texel[0], src.texel[1]);
    gl.uniform1i(p.u.uTexture, src.attach(0));
    blit(bloomChain[i]);
  }
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = bloomChain.length - 2; i >= 0; i--) {
    const src = bloomChain[i + 1];
    gl.uniform2f(p.u.srcTexel, src.texel[0], src.texel[1]);
    gl.uniform1i(p.u.uTexture, src.attach(0));
    blit(bloomChain[i]);
  }
  gl.disable(gl.BLEND);
}

function renderDisplay(time) {
  const n = Math.min(24, ripples.length);
  for (let i = 0; i < n; i++) {
    const r = ripples[ripples.length - n + i];
    rippleData[i * 4] = r.x; rippleData[i * 4 + 1] = r.y;
    rippleData[i * 4 + 2] = r.age; rippleData[i * 4 + 3] = r.strength;
  }
  const p = progs.display.bind();
  gl.uniform2f(p.u.texelSize, 1 / canvas.width, 1 / canvas.height);
  gl.uniform1i(p.u.uDye, dye.read.attach(0));
  gl.uniform1i(p.u.uParticles, particleFBO.attach(1));
  gl.uniform1i(p.u.uBloom, (bloomChain[0] || particleFBO).attach(2));
  gl.uniform2f(p.u.uDyeTexel, dye.texel[0], dye.texel[1]);
  gl.uniform2f(p.u.uRes, canvas.width, canvas.height);
  gl.uniform1f(p.u.aspect, aspect);
  gl.uniform1f(p.u.uTime, time);
  gl.uniform1f(p.u.uPulse, state.pulse);
  gl.uniform1f(p.u.uBloomIntensity, bloomChain.length ? CFG.BLOOM_INTENSITY : 0);
  gl.uniform1i(p.u.uRippleCount, n);
  gl.uniform2f(p.u.uCam, state.cam[0], state.cam[1]);
  gl.uniform4fv(p.u.uRipples, rippleData);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, specTex);
  gl.uniform1i(p.u.uSpec, 3);
  gl.uniform1f(p.u.uSpecHead, (audio.head + 0.5) / SPEC_ROWS);
  gl.uniform1f(p.u.uLevel, audio.level);
  gl.uniform1f(p.u.uAudioOn, audio.ready ? 1 : 0);
  blit(null);
}

let clockTime = 0;
let last = performance.now();
let dustAcc = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 30);
  state.fps = lerp(state.fps || 60, 1000 / Math.max(1, now - last), 0.05);
  last = now;
  clockTime += dt;
  resize();

  updateFlowReadback();
  updateCurlField(clockTime);

  state.pulse *= Math.exp(-dt * 2.5);
  // a slow drifting camera; layers at different depths slide past each other
  state.cam[0] = 0.03 * Math.sin(clockTime * 0.071) + 0.012 * Math.sin(clockTime * 0.19 + 1.3);
  state.cam[1] = 0.02 * Math.sin(clockTime * 0.053 + 0.7) + 0.008 * Math.sin(clockTime * 0.23);
  updateFx(dt);
  updateAudio(dt);
  state.hueShift += dt * 0.003;
  for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].age += dt; if (ripples[i].age > 4) ripples.splice(i, 1); }
  if (Math.abs(state.bend) > 0.02) splatVel(aspect / 2, 0.5, 0.06, 0, 0, state.bend * 160 * dt * 60);

  // faint drifting space dust so the void feels alive
  dustAcc += dt * 10;
  while (dustAcc > 1) {
    dustAcc -= 1;
    const c = hsv(state.hueShift + rand(0, 0.3), 0.4, rand(0.08, 0.22));
    emit(rand(0, aspect), rand(0, 1), 0, 0, rand(3, 7), rand(1.5, 3.5), c, Math.random() < 0.1 ? 1 : 0, rand(0.5, 1.5));
  }

  updateParticles(dt);
  updateCreatures(dt, clockTime);

  gl.disable(gl.BLEND);
  flushSplats(velSplats, velocity);
  flushSplats(dyeSplats, dye);
  stepFluid(dt, CFG.CURL * (1 + state.mod * 2.5), state.sustain ? CFG.DYE_DISSIPATION_SUSTAIN : CFG.DYE_DISSIPATION);

  renderParticles(dt, clockTime);
  renderBloom();
  renderDisplay(clockTime);
  requestAnimationFrame(frame);
}

resize();
window.addEventListener('resize', resize);
hud('waking up…', 0);
initMIDI();
initAudio();
requestAnimationFrame(frame);

window.__viz = { noteOn, noteOff, setSustain, state, audio, midiNames: () => midiNames, hud: () => hudEl.textContent };

if (new URLSearchParams(location.search).has('demo')) {
  const scale = [0, 2, 4, 7, 9];
  const play = () => {
    const chord = Math.random() < 0.3;
    const root = 36 + 12 * Math.floor(rand(0, 4)) + scale[Math.floor(rand(0, 5))];
    const notes = chord ? [root, root + 4, root + 7, root + 12] : [root];
    for (const n of notes) {
      noteOn(n, rand(0.35, 1), 13);
      setTimeout(() => noteOff(n, 13), rand(200, 1800));
    }
    setTimeout(play, rand(120, 900));
  };
  play();
}
