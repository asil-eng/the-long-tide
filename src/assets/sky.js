// Hazy dust-bowl sky dome: peach horizon blending into the height fog, a dusty amber-brown
// zenith, a soft sun disc with a wide glow, and slow-moving thin cloud and dust banks.
import * as THREE from 'three';
import { world, NOISE_GLSL } from './materialPatch.js';

export function createSky({ zenith = '#a97f5e', horizon = '#d9ab82' } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      ...world,
      uZenith: { value: new THREE.Color(zenith) },
      uHorizon: { value: new THREE.Color(horizon) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vDir = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * wp; gl_Position.z = gl_Position.w; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uFogColor; uniform vec3 uFogSunColor;
      uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uTime;
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
        float sd = max(dot(d, uSunDir), 0.0);
        // haze band right at the horizon matches the ground fog exactly
        vec3 fogc = mix(uFogColor, uFogSunColor, pow(sd, 5.0));
        col = mix(col, fogc, 1.0 - smoothstep(0.0, 0.16, h));
        // thin dust/cloud banks drifting
        vec2 cp = d.xz / (h + 0.12) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
        float cl = fx_fbm(vec3(cp, uTime * 0.01));
        cl = smoothstep(0.4, 0.8, cl) * smoothstep(0.02, 0.25, h) * (1.0 - smoothstep(0.6, 0.95, h));
        vec3 clc = mix(uZenith * 0.92, uFogSunColor * 1.1, pow(sd, 3.0));
        col = mix(col, clc, cl * 0.7);
        // sun: a soft disc smothered by dust plus a broad warm glow
        col += uSunColor * (pow(sd, 900.0) * 6.0 + pow(sd, 40.0) * 0.35 + pow(sd, 6.0) * 0.18);
        // stars fade in as the sky darkens
        float night = 1.0 - smoothstep(0.03, 0.12, dot(uZenith, vec3(0.3, 0.59, 0.11)));
        if (night > 0.0) {
          vec3 sd3 = floor(d * 420.0);
          float st = fx_hash13(sd3);
          float tw = 0.6 + 0.4 * sin(uTime * 2.0 + st * 40.0);
          col += vec3(0.9, 0.92, 1.0) * step(0.9975, st) * tw * night * smoothstep(0.05, 0.3, h) * 1.6;
          // a band of the galaxy
          float band = exp(-pow(dot(d, normalize(vec3(0.4, 0.5, -0.75))) * 3.2, 2.0));
          col += vec3(0.11, 0.1, 0.13) * band * fx_fbm(vec3(d * 9.0)) * night;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}
