// Renderer, lights and sky for Solmar City (three.js r160).
//   createRenderer(canvas) -> { renderer, scene, camera, sun, hemi, resize, update, render }
//
// The renderer is ACES-tonemapped sRGB with soft shadows; the sun is a warm
// directional light whose shadow camera covers the whole city, the hemisphere
// light is the cool sky fill, and the sky is a runtime canvas gradient (no
// network asset) with light distance fog so the coast hazes toward the horizon.
// main.js owns the loop: it calls update(dt) once a frame (resize check) and
// render() after the systems have moved, or renders the scene itself.
import * as THREE from 'three';
import { PALETTE } from './config.js';

function makeSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, PALETTE.skyTop);
  gradient.addColorStop(0.55, '#a8d8ea');
  gradient.addColorStop(0.8, PALETTE.skyHorizon);
  gradient.addColorStop(1, '#ffd9a0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 420, 1150);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1600);
  camera.position.set(0, 40, 90);

  // Cool sky fill from above, warm bounce from the sand below.
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0xe8c890, 0.85);
  scene.add(hemi);

  // Late-afternoon sun from the south-west, so downtown throws long shadows
  // across the avenues and the sea glints.
  const sun = new THREE.DirectionalLight(new THREE.Color(PALETTE.sun), 2.4);
  sun.position.set(-180, 260, 220);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -360;
  sun.shadow.camera.right = 360;
  sun.shadow.camera.top = 360;
  sun.shadow.camera.bottom = -360;
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // v3 — the night sky: a pale moon disc and a field of stars, both
  // invisible by day. The day/night system drives them through
  // setCelestial(night01) below; they hang far above the city so they
  // never collide with anything.
  const moonMat = new THREE.MeshBasicMaterial({
    color: 0xf2ead0,
    transparent: true,
    opacity: 0,
    fog: false,
  });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(22, 32), moonMat);
  moon.position.set(320, 420, -520);
  moon.lookAt(0, 0, 0);
  moon.visible = false;
  scene.add(moon);
  const starGeo = new THREE.BufferGeometry();
  const starCount = 420;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.25 + Math.random() * 1.2; // elevation above the horizon
    const r = 900;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.2,
    transparent: true,
    opacity: 0,
    fog: false,
    sizeAttenuation: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.visible = false;
  scene.add(stars);

  /** v3 — fade the moon and stars in as night falls (0 = day, 1 = night). */
  function setCelestial(night01) {
    const n = Math.max(0, Math.min(1, night01 || 0));
    moon.visible = n > 0.03;
    stars.visible = n > 0.03;
    moonMat.opacity = n * 0.95;
    starMat.opacity = n * 0.9;
  }

  /** v3 — dim the filmic exposure a touch at night so the dark streets
   * read as night instead of a grey day. The day/night system calls
   * this with the same night factor it feeds setCelestial. */
  function setNightExposure(night01) {
    const n = Math.max(0, Math.min(1, night01 || 0));
    renderer.toneMappingExposure = 1.05 - n * 0.2;
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.floor(width * pixelRatio);
    const nextHeight = Math.floor(height * pixelRatio);
    if (renderer.domElement.width !== nextWidth || renderer.domElement.height !== nextHeight) {
      renderer.setSize(width, height, false);
    }
    if (camera.aspect !== width / height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  window.addEventListener('resize', resize);
  resize();

  /** Resize check only — the sun and sky are fixed; the city animates itself. */
  function update() {
    resize();
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, sun, hemi, resize, update, render, setCelestial, setNightExposure };
}
