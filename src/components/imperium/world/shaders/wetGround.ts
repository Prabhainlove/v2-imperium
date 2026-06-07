export const wetVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const wetFrag = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
uniform float uTime;
uniform vec3 uTint;
uniform vec3 uSpecular;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a, b, u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}

void main() {
  vec2 p = vWorldPos.xz * 0.35;
  float n = noise(p + uTime*0.03) * 0.6 + noise(p*2.4 - uTime*0.02) * 0.4;
  float streaks = smoothstep(0.45, 0.95, n);
  vec3 base = uTint * (0.04 + 0.18 * n);
  vec3 spec = uSpecular * streaks * 1.2;
  float vign = smoothstep(60.0, 5.0, length(vWorldPos.xz));
  vec3 col = (base + spec) * vign;
  gl_FragColor = vec4(col, 1.0);
}
`;
