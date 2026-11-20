// Billowing dust kicked up by wheels (or footsteps): pooled soft sprites that grow, drift
// downwind, rise slightly and fade. Lit warm by the sun, brighter when backlit.
import * as THREE from 'three';
import { world } from './materialPatch.js';

export function createDustTrail({ max = 1400 } = {}) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), age = new Float32Array(max), life = new Float32Array(max), size = new Float32Array(max), seed = new Float32Array(max);
  const vel = new Float32Array(max * 3);
  life.fill(1); age.fill(10);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('age', new THREE.BufferAttribute(age, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('life', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { ...world, uPixel: { value: 1 }, uHeight: { value: 900 } },
    vertexShader: /* glsl */ `
      attribute float age; attribute float life; attribute float size; attribute float seed;
      uniform float uPixel; uniform float uHeight; uniform vec3 uSunDir;
      varying float vA; varying float vLit; varying float vSeed;
      void main(){
        float t = clamp(age / life, 0.0, 1.0);
        vec4 mv = viewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float s = size * (0.35 + t * 1.6);
        gl_PointSize = s * uHeight * uPixel / max(-mv.z, 0.1);
        vA = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.35, 1.0, t)) * step(age, life);
        vec3 vd = normalize(position - cameraPosition);
        vLit = 0.55 + pow(max(dot(vd, uSunDir), 0.0), 4.0) * 1.2;
        vSeed = seed;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunColor; uniform vec3 uDustColor; uniform vec3 uFogColor;
      varying float vA; varying float vLit; varying float vSeed;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        float n = sin(c.x * 9.0 + vSeed * 30.0) * sin(c.y * 7.0 + vSeed * 17.0) * 0.12;
        float a = smoothstep(0.5, 0.05, r + n) * vA * 0.42;
        vec3 col = mix(uDustColor, uFogColor, 0.35) * (0.55 + 0.45 * uSunColor * vLit);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.onBeforeRender = (r, s, cam) => { mat.uniforms.uPixel.value = r.getPixelRatio(); mat.uniforms.uHeight.value = r.domElement.height / r.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)); };
  let head = 0;
  return {
    object: pts,
    emit(p, v, { sz = 1.2, lf = 3.2 } = {}) {
      const i = head; head = (head + 1) % max;
      pos.set([p.x, p.y, p.z], i * 3);
      vel.set([v.x + (Math.random() - 0.5) * 0.6, v.y + Math.random() * 0.4, v.z + (Math.random() - 0.5) * 0.6], i * 3);
      age[i] = 0; life[i] = lf * (0.7 + Math.random() * 0.6); size[i] = sz * (0.7 + Math.random() * 0.6); seed[i] = Math.random();
    },
    update(dt) {
      const w = world.uWindDir.value;
      for (let i = 0; i < max; i++) {
        if (age[i] > life[i]) continue;
        age[i] += dt;
        const k = Math.exp(-dt * 1.6);
        vel[i * 3] = vel[i * 3] * k + w.x * 1.4 * (1 - k); vel[i * 3 + 2] = vel[i * 3 + 2] * k + w.y * 1.4 * (1 - k); vel[i * 3 + 1] = vel[i * 3 + 1] * k + 0.25 * (1 - k);
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      g.attributes.position.needsUpdate = true; g.attributes.age.needsUpdate = true; g.attributes.life.needsUpdate = true; g.attributes.size.needsUpdate = true;
    },
  };
}
