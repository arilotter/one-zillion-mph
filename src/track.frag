precision highp float;
varying vec2 vUv;

uniform float scroll;

float roadWidth = 0.6;
float edgeWidth = 0.08;
float perspectiveModifier = 0.5;
vec3 grassColor = vec3(0, 0.4, 0);
vec3 barrierColor1 = vec3(1, 0, 0);
vec3 barrierColor2 = vec3(1, 1, 1);
vec3 roadColor = vec3(0.6, 0.6, 0.6);
void main() {
  float y = vUv.y;
  float x = vUv.x;

  float r = roadWidth * abs(y - perspectiveModifier);
  r = r;
  float nX = abs(x);

  vec3 color;
  if(nX < r) {
    color = roadColor;
  } else if(nX < r + edgeWidth) {
    float s = step(mod(abs(y + scroll), 0.08) * (1. / 0.08), 0.5);
    color = s * barrierColor1 + (1.0 - s) * barrierColor2;
  } else {
    color = grassColor;
  }

  gl_FragColor = vec4(color, 1.0);
}