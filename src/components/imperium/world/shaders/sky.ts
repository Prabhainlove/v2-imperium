export const skyVert = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vWorldPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const skyFrag = /* glsl */ `
varying vec3 vWorldPos;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uGlow;
void main() {
  vec3 dir = normalize(vWorldPos);
  float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uBottom, uTop, pow(h, 1.4));
  float horizon = exp(-abs(dir.y) * 8.0);
  col += uGlow * horizon * 0.6;
  gl_FragColor = vec4(col, 1.0);
}
`;
