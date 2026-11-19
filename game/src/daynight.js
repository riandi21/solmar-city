import * as THREE from 'three';

// Day/night cycle for Solmar City: a full 24-hour clock driving the sun,
// the moon, the sky colour, the stars, street lamps and car headlights.
// Everything is a smooth function of the sun's elevation, so dusk and dawn
// blend instead of snapping. Time can be skipped straight to night.
export function createDayNight(world) {
  const scene = world.scene;
  const dayLength = (world.config && world.config.dayLengthSeconds) || 600;
  const startHour = (world.config && world.config.startHour) || 10;

  let hours = startHour; // 0..24
  let wasNight = false;
  let announcedDusk = false;
  let announcedDawn = false;

  // --- lights: reuse the renderer's sun/hemi when present, else make ours
  let sun = world.sun || null;
  if (!sun) {
    sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -320;
    sun.shadow.camera.right = 320;
    sun.shadow.camera.top = 320;
    sun.shadow.camera.bottom = -320;
    sun.shadow.camera.far = 900;
    scene.add(sun);
    scene.add(sun.target);
  }
  let hemi = world.hemi || world.hemisphereLight || null;
  if (!hemi) {
    hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
    scene.add(hemi);
  }

  // --- sky palettes (lerped by sun elevation)
  const SKY_DAY = new THREE.Color(0x7fb4e8);
  const SKY_DUSK = new THREE.Color(0xe07b3f);
  const SKY_NIGHT = new THREE.Color(0x0a0f24);
  const FOG_DAY = new THREE.Color(0xa8c6e2);
  const FOG_NIGHT = new THREE.Color(0x0d1428);
  const SUN_DAY = new THREE.Color(0xfff1cf);
  const SUN_DUSK = new THREE.Color(0xff8a3d);
  const MOON_LIGHT = new THREE.Color(0x9db8e8);
  const skyColor = new THREE.Color();
  const fogColor = new THREE.Color();
  const tmpColor = new THREE.Color();

  if (scene.background === null || scene.background === undefined) {
    scene.background = new THREE.Color(0x7fb4e8);
  }

  // --- stars: a dome of points, faded in at night
  const starCount = 700;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.48; // upper sky only
    const r = 880;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi) + 20;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 2.2, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- moon: a pale disc that crosses the sky opposite the sun
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(16, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xe8eefc, fog: false, transparent: true, opacity: 0 })
  );
  scene.add(moon);
  const moonHalo = new THREE.Mesh(
    new THREE.SphereGeometry(20, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x8fa8d8, fog: false, transparent: true, opacity: 0 })
  );
  scene.add(moonHalo);

  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();

  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function formatClock() {
    const h = Math.floor(hours) % 24;
    const m = Math.floor((hours % 1) * 60);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return hh + ':' + mm;
  }

  function setLampState(on) {
    const lamps = world.city && world.city.lamps;
    if (!Array.isArray(lamps)) return;
    for (const lamp of lamps) {
      if (!lamp) continue;
      if (lamp.light) lamp.light.intensity = on ? (lamp.nightIntensity || 2.2) : 0;
      if (lamp.bulb && lamp.bulb.material && lamp.bulb.material.emissive) {
        lamp.bulb.material.emissiveIntensity = on ? 2.5 : 0.15;
      } else if (lamp.mesh && lamp.mesh.material && lamp.mesh.material.emissive) {
        lamp.mesh.material.emissiveIntensity = on ? 2.5 : 0.15;
      }
    }
  }

  function setHeadlights(on) {
    const cars = world.cars;
    if (!Array.isArray(cars)) return;
    for (const car of cars) {
      if (!car || !car.headlights) continue;
      for (const hl of car.headlights) {
        if (hl) hl.visible = on;
      }
      if (car.headlightMeshes) {
        for (const m of car.headlightMeshes) if (m) m.visible = on;
      }
    }
    const bikes = world.bikes;
    if (Array.isArray(bikes)) {
      for (const bike of bikes) {
        if (bike && bike.headlight) bike.headlight.visible = on;
      }
    }
  }

  function applyLighting() {
    // Sun angle: rises 06:00, sets 18:00, midnight is straight down.
    const angle = ((hours - 6) / 12) * Math.PI;
    const elev = Math.sin(angle); // -1..1, >0 while the sun is up
    const daylight = smoothstep(-0.08, 0.25, elev); // 0 at night, 1 in full day
    const duskness = 1 - smoothstep(0.02, 0.45, Math.abs(elev)); // peaks at horizon
    const night = 1 - daylight;

    sunDir.set(Math.cos(angle), Math.sin(angle), 0.35).normalize();
    sun.position.copy(sunDir).multiplyScalar(420);
    sun.target.position.set(0, 0, 0);
    sun.intensity = 0.06 + 2.5 * daylight;
    tmpColor.copy(SUN_DAY).lerp(SUN_DUSK, duskness);
    sun.color.copy(tmpColor);

    hemi.intensity = 0.12 + 0.85 * daylight;
    hemi.color.setHex(0xbfd9ff).lerp(new THREE.Color(0x2a3560), night);
    hemi.groundColor.setHex(0x8a7a5a).lerp(new THREE.Color(0x1a1c26), night);

    // Sky: day -> dusk tint near the horizon crossing -> night.
    skyColor.copy(SKY_DAY).lerp(SKY_DUSK, duskness * 0.85);
    skyColor.lerp(SKY_NIGHT, night);
    if (scene.background && scene.background.isColor) {
      scene.background.copy(skyColor);
    }
    if (scene.fog && scene.fog.color) {
      fogColor.copy(FOG_DAY).lerp(FOG_NIGHT, night);
      scene.fog.color.copy(fogColor);
    }

    // Moon rides opposite the sun: up while the sun is down.
    const moonAngle = angle + Math.PI;
    const moonElev = Math.sin(moonAngle);
    moonDir.set(Math.cos(moonAngle), Math.sin(moonAngle), -0.3).normalize();
    moon.position.copy(moonDir).multiplyScalar(820);
    moonHalo.position.copy(moonDir).multiplyScalar(820);
    const moonUp = smoothstep(-0.05, 0.3, moonElev);
    moon.material.opacity = moonUp;
    moonHalo.material.opacity = moonUp * 0.22;
    moon.visible = moonUp > 0.01;
    moonHalo.visible = moonUp > 0.01;

    // Stars fade in as the sky darkens.
    starMat.opacity = night * 0.95;
    stars.visible = night > 0.02;

    // Moonlight takes over from sunlight at night.
    if (night > 0.5 && sun.intensity < 0.25) {
      sun.color.copy(MOON_LIGHT);
      sun.intensity = 0.22;
    }

    const isNight = elev < 0.02;
    world.night = isNight;
    world.daylight = daylight;
    world.timeOfDay = hours;
    world.clockString = formatClock();

    if (isNight !== wasNight) {
      setLampState(isNight);
      setHeadlights(isNight);
      if (isNight && !announcedDusk && world.events) {
        world.events.push({ type: 'dusk', time: hours });
        announcedDusk = true;
        announcedDawn = false;
      } else if (!isNight && !announcedDawn && world.events) {
        world.events.push({ type: 'dawn', time: hours });
        announcedDawn = true;
        announcedDusk = false;
      }
      wasNight = isNight;
    }

    // HUD clock line, when the HUD has rendered one.
    if (typeof document !== 'undefined') {
      const el = document.getElementById('hud-clock');
      if (el) el.textContent = formatClock() + (isNight ? '  Night' : '  Day');
    }
  }

  function update(dt) {
    hours = (hours + (dt / dayLength) * 24) % 24;
    world.elapsed = (world.elapsed || 0) + dt;
    applyLighting();
  }

  function skipToNight() {
    hours = 21.5;
    applyLighting();
  }

  function skipToDay() {
    hours = 10;
    applyLighting();
  }

  function setTime(h) {
    hours = ((h % 24) + 24) % 24;
    applyLighting();
  }

  function isNight() {
    return !!world.night;
  }

  // Named phase for HUD labels and other systems (territories, police):
  // 'day' | 'dusk' | 'night' | 'dawn', derived from the same smooth curve.
  function getPhase() {
    const angle = ((hours - 6) / 12) * Math.PI;
    const elev = Math.sin(angle);
    if (elev > 0.25) return 'day';
    if (elev > 0.02) return hours < 12 ? 'dawn' : 'dusk';
    if (elev > -0.12) return hours < 12 ? 'dawn' : 'dusk';
    return 'night';
  }

  function getDaylight() {
    return world.daylight !== undefined ? world.daylight : 1;
  }

  applyLighting();

  return {
    update,
    skipToNight,
    skipToDay,
    setTime,
    isNight,
    getDaylight,
    getPhase,
    getTime: () => hours,
    formatClock,
    sun,
    hemi,
    stars,
    moon,
  };
}
