import type { WebGLProgramParametersWithUniforms } from 'three'

// The pole tile is 444 m per pixel: fine from orbit, a smear from 1 km up. This adds procedural
// regolith to the shading only (bumps, small craters, grain), in world space and in kilometres,
// each octave fading out with distance so nothing shimmers. It never moves the geometry and it is
// not data: heights, shadows and light directions still come from the LOLA tile and the ephemeris.

const NOISE = /* glsl */ `
varying vec3 vWP;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 h22(vec2 p){ float n = h21(p); return vec2(n, h21(p + n + 17.7)); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
// Bowl craters with a raised rim, sparse, one candidate per grid cell. Height in km.
float craters(vec2 p, float scale, float seed){
  vec2 g = p / scale, ig = floor(g);
  float h = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = ig + vec2(float(i), float(j));
    if (h21(c * 1.7 + seed) > 0.2) continue;
    vec2 q = g - (c + h22(c + seed));
    float rr = h21(c * 3.1 + seed); float rad = 0.12 + 0.46 * rr * rr;
    float d = length(q) / rad;
    float bowl = d < 1.0 ? -(1.0 - d * d) : 0.0;
    float rim = 0.28 * exp(-pow((d - 1.05) * 3.6, 2.0));
    h += (bowl + rim) * rad * scale * 0.14;
  }
  return h;
}
float detailH(vec2 p, float dist){
  float h = 0.0;
  float f1 = 1.0 - smoothstep(0.8, 3.0, dist);          // 0.03 km craters, visible within ~3 km
  float f2 = 1.0 - smoothstep(2.0, 9.0, dist);          // 0.12 km craters
  float f3 = 1.0 - smoothstep(0.5, 2.0, dist);          // metre-scale bumps
  float f4 = 1.0 - smoothstep(1.5, 7.0, dist);
  float f5 = 1.0 - smoothstep(4.0, 22.0, dist);
  h += f1 * craters(p, 0.03, 1.3);
  h += f4 * (vnoise(p / 0.025) - 0.5) * 0.0018;
  h += f5 * (vnoise(p / 0.05) - 0.5) * 0.006;
  return h;
}
`

const NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  // One height sample, bumped with screen-space derivatives: cheap enough for integrated GPUs.
  float dist = length(vWP - cameraPosition);
  if (dist < 24.0) {
    float h = detailH(vWP.xz, dist);
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1);
    vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    normal = normalize(abs(det) * normal - grad * 1.6);
  }
}
`

const COLOR = /* glsl */ `
#include <color_fragment>
{
  float dist = length(vWP - cameraPosition);
  float near = dist < 24.0 ? 1.0 - smoothstep(1.5, 20.0, dist) : 0.0;
  float grain = vnoise(vWP.xz / 0.03) * 0.5 + vnoise(vWP.xz / 0.11) * 0.5;
  float blotch = vnoise(vWP.xz / 0.35);
  // Darker, less uniform regolith up close; the orbital colour stays the base.
  diffuseColor.rgb *= mix(1.0, 0.8 + 0.3 * grain + 0.16 * blotch, near);
}
`

export function injectReliefDetail(shader: WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + NOISE)
    .replace('#include <normal_fragment_maps>', NORMAL)
    .replace('#include <color_fragment>', COLOR)
}
