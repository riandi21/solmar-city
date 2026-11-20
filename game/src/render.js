// Solmar City — renderer (Round 16, v16).
// createRender(canvas) builds the ONE scene and camera the bootstrap uses.
// Nothing else in the game creates a scene: world.js leaves scene/camera
// null until the bootstrap hands this bundle in via world.attachRender().

import * as THREE from 'three';
import { CONFIG } from './config.js';

function makeSkyTexture() {
  // Vertical canvas gradient: warm horizon -> blue mid -> deep blue top.
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, CONFIG.sky.top);
  grad.addColorStop(0.55, CONFIG.sky.mid);
  grad.addColorStop(1.0, CONFIG.sky.horizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(CONFIG.fog.color, CONFIG.fog.near, CONFIG.fog.far);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    1,
    CONFIG.camera.near,
    CONFIG.camera.far,
  );
  camera.position.set(0, CONFIG.camera.height + 6, CONFIG.camera.distance + 8);

  // Warm directional sun with a 2048 shadow map covering the whole city.
  const sun = new THREE.DirectionalLight(CONFIG.sun.color, CONFIG.sun.intensity);
  const az = (CONFIG.sun.azimuth * Math.PI) / 180;
  const el = (CONFIG.sun.elevation * Math.PI) / 180;
  sun.position.set(
    Math.cos(el) * Math.sin(az) * 400,
    Math.sin(el) * 400,
    Math.cos(el) * Math.cos(az) * 400,
  );
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 1000;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // Soft sky fill so shadowed faces never go black.
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 0.75);
  scene.add(hemi);
  // Faint ambient lift for interiors / under-pier shade.
  const ambient = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(ambient);

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function update(dt) {
    // Slow sun drift keeps long sessions from looking frozen; tiny on purpose.
    void dt;
  }

  function render() {
    renderer.render(scene, camera);
  }

  resize();
  window.addEventListener('resize', resize);

  return { renderer, domElement: renderer.domElement, scene, camera, sun, hemi, resize, update, render };
}

export default createRender;
