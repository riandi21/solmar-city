// Renderer: the one three.js renderer, scene and camera for the game.
// ACES tone mapping, sRGB output, soft shadows, a canvas-gradient sky,
// fog, and a warm directional sun with a 2048 shadow map covering the
// whole city. The bootstrap uses THIS scene and camera — it must never
// create a second one.

import * as THREE from 'three';

function makeSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#2f6fb4');
  gradient.addColorStop(0.45, '#7fb8e0');
  gradient.addColorStop(0.75, '#ffd9a0');
  gradient.addColorStop(1, '#ffe9c4');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(0xc8d8e8, 220, 900);

  const camera = new THREE.PerspectiveCamera(
    68, window.innerWidth / window.innerHeight, 0.1, 1600
  );
  camera.position.set(0, 40, 120);

  // Warm afternoon sun with a 2048 shadow map covering the city.
  const sun = new THREE.DirectionalLight(0xffe0b3, 2.6);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function update(dt, timeOfDay) {
    // Sun swings with the time of day so day/night can move it.
    // Noon is high and bright; midnight drops to a faint moonlit floor.
    const angle = timeOfDay * Math.PI * 2;
    sun.position.set(
      Math.cos(angle) * 260,
      Math.max(40, Math.sin(angle) * 260),
      140
    );
    const dayFactor = Math.max(0.15, Math.sin(angle));
    sun.intensity = 0.4 + dayFactor * 2.2;
    hemi.intensity = 0.25 + dayFactor * 0.65;
    // At night the sky darkens; the gradient texture is swapped by the
    // day/night system, here we only dim the fog to match.
    scene.fog.color.setHex(dayFactor > 0.5 ? 0xc8d8e8 : 0x1a2438);
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, sun, hemi, resize, update, render };
}
