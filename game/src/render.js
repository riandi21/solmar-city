// Solmar City — the renderer.
// createRenderer(canvas): ACES tone mapping, sRGB output, soft shadows,
// a gradient sky, fog and a warm directional sun with a 2048 shadow map
// covering the city. Returns renderer, scene, camera, sun, hemisphere
// light, resize, update and render. The bootstrap MUST use this scene
// and camera and never create a second one. In a headless environment
// without WebGL the renderer falls back to a stub so systems tests can
// still run against the real scene and camera.
import * as THREE from 'three';

export function createRenderer(canvas) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbfd9e8, 320, 900);

  // Gradient sky: a canvas texture when a DOM is available, else a color.
  let skyReady = false;
  try {
    if (typeof document !== 'undefined' && canvas) {
      const skyCanvas = document.createElement('canvas');
      skyCanvas.width = 4;
      skyCanvas.height = 256;
      const ctx = skyCanvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#2a6db0');
      grad.addColorStop(0.55, '#7fb8dd');
      grad.addColorStop(0.8, '#f7c98a');
      grad.addColorStop(1, '#ffd9a0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 4, 256);
      const tex = new THREE.CanvasTexture(skyCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      scene.background = tex;
      skyReady = true;
    }
  } catch (err) {
    skyReady = false;
  }
  if (!skyReady) scene.background = new THREE.Color(0x7fb8dd);

  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 2000);
  camera.position.set(0, 10, 80);
  camera.lookAt(0, 2, 0);

  const sun = new THREE.DirectionalLight(0xffe0b0, 2.6);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 800;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6a5a44, 0.9);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambient);

  let renderer = null;
  try {
    if (canvas && typeof canvas.getContext === 'function') {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1);
      renderer.setSize(1280, 720, false);
    }
  } catch (err) {
    renderer = null;
  }
  if (!renderer) {
    renderer = {
      isStub: true,
      domElement: canvas || null,
      setSize() {},
      setPixelRatio() {},
      render() {},
      dispose() {},
      shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
      toneMapping: THREE.ACESFilmicToneMapping,
      outputColorSpace: THREE.SRGBColorSpace,
    };
  }

  // Third-person follow camera: 10 m back, 6 m up, tracking the target's heading.
  const followOffset = new THREE.Vector3();
  function follow(target, dt) {
    if (!target) return;
    const pos = target.position || target;
    const heading = target.heading || 0;
    const back = 10;
    const up = 6;
    followOffset.set(
      pos.x - Math.sin(heading) * back,
      (pos.y || 0) + up,
      pos.z - Math.cos(heading) * back,
    );
    const k = Math.min(1, dt * 5 + 0.08);
    camera.position.lerp(followOffset, k);
    camera.lookAt(pos.x, (pos.y || 0) + 2, pos.z);
  }

  function resize(width, height) {
    const w = width || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const h = height || (typeof window !== 'undefined' ? window.innerHeight : 720);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (renderer.setSize) renderer.setSize(w, h, false);
  }

  function setTimeOfDay(hour) {
    // Sun swings east to west; below the horizon it dims and the moon takes over.
    const angle = ((hour - 6) / 12) * Math.PI;
    sun.position.set(Math.cos(angle) * 260, Math.max(20, Math.sin(angle) * 260), 120);
    const day = Math.max(0, Math.sin(angle));
    sun.intensity = 0.3 + day * 2.3;
    hemi.intensity = 0.3 + day * 0.6;
    if (day > 0.5) scene.fog.color.setHex(0xbfd9e8);
    else if (day > 0.05) scene.fog.color.setHex(0xe8a06a);
    else scene.fog.color.setHex(0x1a2438);
  }

  // Keep the canvas fitted to the window; the game loop calls resize on demand too.
  try {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', () => resize());
    }
  } catch (err) {
    // Headless: no window, no listener needed.
  }

  function update(dt, world) {
    if (world && world.daynight) setTimeOfDay(world.daynight.timeOfDay ?? world.daynight.time ?? world.timeOfDay ?? 10);
    if (world && world.player) follow(world.player, dt);
  }

  function render() {
    renderer.render(scene, camera);
  }

  const handle = {
    renderer, scene, camera, sun, hemi, ambient,
    resize, update, render, follow, setTimeOfDay,
  };
  return handle;
}

export const createRenderHandle = createRenderer;
export default createRenderer;
