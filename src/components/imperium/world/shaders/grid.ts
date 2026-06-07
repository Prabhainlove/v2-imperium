export const gridVert = /* glsl */ `
varying vec3 vLocalPos;
void main() {
  vLocalPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const gridFrag = /* glsl */ `
varying vec3 vLocalPos;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uAccent;

void main() {
  vec3 p = vLocalPos * 0.5;
  vec3 g = abs(fract(p) - 0.5);
  float line = min(min(g.x, g.y), g.z);
  float grid = smoothstep(0.02, 0.0, line);

  vec3 g2 = abs(fract(p * 0.2) - 0.5);
  float line2 = min(min(g2.x, g2.y), g2.z);
  float major = smoothstep(0.04, 0.0, line2);

  float pulse = 0.5 + 0.5 * sin(uTime * 0.6 + vLocalPos.y * 0.4);
  vec3 col = uColor * grid * 0.7 + uAccent * major * (0.4 + 0.6 * pulse);
  float fade = 1.0 - smoothstep(8.0, 28.0, length(vLocalPos));
  gl_FragColor = vec4(col * fade, 1.0);
}
`;
