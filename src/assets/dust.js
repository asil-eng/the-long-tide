// Drifting dust motes in a box that wraps around the camera. Motes brighten strongly when
// seen against the sun (forward scattering), so they "catch the light" in backlit shots.
import * as THREE from 'three';
import { world } from './materialPatch.js';

export function createDust({ count = 4000, box = 40, height = 12 } = {}) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), s = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = Math.random() * box; p[i * 3 + 1] = Math.pow(Math.random(), 1.8) * height; p[i * 3 + 2] = Math.random() * box;
    s[i] = Math.random();
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...world, uBox: { value: box }, uHeight: { value: height }, uCenter: { value: new THREE.Vector3() }, uPixel: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float seed; uniform float uTime; uniform vec2 uWindDir; uniform float uBox; uniform float uHeight; uniform vec3 uCenter; uniform float uPixel;
      uniform vec3 uSunDir; varying float vAlpha; varying float vBright;
      void main(){
        vec3 p = position;
        p.xz += uWindDir * uTime * (0.9 + seed * 0.8);
        p.y += sin(uTime * 0.6 + seed * 40.0) * 0.25 + uTime * 0.05 * (seed - 0.3);
        p.x += sin(uTime * 0.9 + seed * 17.0) * 0.3;
        // wrap inside a box centred on the camera
        p.xz = mod(p.xz - uCenter.xz + uBox * 0.5, uBox) - uBox * 0.5 + uCenter.xz;
        p.y = mod(p.y, uHeight);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        gl_PointSize = clamp((0.6 + seed * 1.6) * uPixel * 18.0 / dist, 1.0, 9.0 * uPixel);
        vec3 vd = normalize(p - cameraPosition);
        vBright = 0.18 + pow(max(dot(vd, uSunDir), 0.0), 6.0) * 2.4;
        vAlpha = smoothstep(0.5, 2.5, dist) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, dist)) * (1.0 - p.y / uHeight * 0.6);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunColor; varying float vAlpha; varying float vBright;
      void main(){
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, r) * vAlpha * 0.55;
        gl_FragColor = vec4(uSunColor * vBright * 0.6 + vec3(0.06, 0.045, 0.03), a);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.onBeforeRender = (r, sc, cam) => { mat.uniforms.uCenter.value.copy(cam.position); mat.uniforms.uPixel.value = r.getPixelRatio(); };
  return pts;
}
