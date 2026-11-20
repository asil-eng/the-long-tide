// Cinematic color grade as a pmndrs postprocessing Effect: saturation, filmic contrast around
// mid-grey, split toning (cool teal shadows, warm amber highlights), lift/gain and a whisper of grain.
import { Effect } from 'postprocessing';
import { Uniform, Vector3 } from 'three';

const frag = /* glsl */ `
uniform float saturation; uniform float contrast; uniform vec3 shadowTint; uniform vec3 highlightTint;
uniform vec3 lift; uniform vec3 gain; uniform float grain; uniform float time;
float gHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec3 c = max(inputColor.rgb, 0.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  // contrast in log space around 0.18 mid grey
  c = pow(c / 0.18, vec3(contrast)) * 0.18;
  l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float sh = 1.0 - smoothstep(0.0, 0.25, l);
  float hi = smoothstep(0.3, 0.9, l);
  c *= mix(vec3(1.0), shadowTint, sh);
  c *= mix(vec3(1.0), highlightTint, hi);
  c = c * gain + lift * (1.0 - clamp(c, 0.0, 1.0));
  c += (gHash(uv * 1000.0) - 0.5) * grain;
  outputColor = vec4(c, inputColor.a);
}`;

export class GradeEffect extends Effect {
  constructor(o = {}) {
    super('GradeEffect', frag, {
      uniforms: new Map([
        ['saturation', new Uniform(o.saturation ?? 1.08)],
        ['contrast', new Uniform(o.contrast ?? 1.08)],
        ['shadowTint', new Uniform(new Vector3(...(o.shadowTint ?? [0.86, 0.98, 1.08])))],
        ['highlightTint', new Uniform(new Vector3(...(o.highlightTint ?? [1.06, 0.99, 0.88])))],
        ['lift', new Uniform(new Vector3(...(o.lift ?? [0.012, 0.014, 0.018])))],
        ['gain', new Uniform(new Vector3(...(o.gain ?? [1, 1, 1])))],
        ['grain', new Uniform(o.grain ?? 0.018)],
        ['time', new Uniform(0)],
      ]),
    });
  }
  update(renderer, inputBuffer, dt) { this.uniforms.get('time').value = (this.uniforms.get('time').value + dt) % 100; }
}
