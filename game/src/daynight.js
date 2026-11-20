import * as THREE from 'three';

// Day/night cycle for Solmar City: sun + moon orbit, sky colour lerp,
// street lamps and headlights at night, stars, HUD clock.
// world.timeOfDay is 0..24 (hours). world.clock is an optional HUD hook.
export function createDayNight(scene, world) {
  const DAY_LENGTH = 480; // seconds for a full 24h cycle
  let timeOfDay = typeof world.timeOfDay === 'number' ? world.timeOfDay : 10;
  let lampsOn = false;

  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(100, 180, 60);
  scene.add(sun);
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.0);
  moon.position.set(-100, 120, -60);
  scene.add(moon);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a2f28, 0.6);
  scene.add(hemi);

  // Stars: points on a dome, fade in at night.
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 600; i++) {
    const a = world.rng() * Math.PI * 2;
    const e = world.rng() * Math.PI * 0.45 + 0.08;
    const r = 900;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0 });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Visible moon disc crossing the sky.
  const moonDisc = new THREE.Mesh(
    new THREE.SphereGeometry(14, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false })
  );
  scene.add(moonDisc);

  // Street lamps: simple emissive posts scattered along roads.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000 });
  const lampBulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0x000000 });
  const lamps = [];
  const lampGeo = new THREE.CylinderGeometry(0.12, 0.18, 5, 6);
  const bulbGeo = new THREE.SphereGeometry(0.35, 8, 8);
  for (let i = 0; i < 48; i++) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(lampGeo, lampMat);
    pole.position.y = 2.5;
    const bulb = new THREE.Mesh(bulbGeo, lampBulbMat.clone());
    bulb.position.y = 5.1;
    const light = new THREE.PointLight(0xffc978, 0, 26, 1.6);
    light.position.y = 5;
    g.add(pole, bulb, light);
    const x = (world.rng() - 0.5) * 560;
    const z = (world.rng() - 0.5) * 560;
    g.position.set(x, 0, z);
    scene.add(g);
    lamps.push({ bulb: bulb.material, light });
  }

  const daySky = new THREE.Color(0x87b5e0);
  const duskSky = new THREE.Color(0xe08a5a);
  const nightSky = new THREE.Color(0x0b1026);
  const sky = new THREE.Color();

  function isNight() { return timeOfDay < 5.5 || timeOfDay >= 19; }

  function skipToNight() { timeOfDay = 21.5; world.timeOfDay = timeOfDay; }

  // Direct time set (used by tests / mission skips); keeps the same smooth path.
  function setTime(hours) {
    timeOfDay = ((hours % 24) + 24) % 24;
    world.timeOfDay = timeOfDay;
  }

  function update(dt) {
    timeOfDay = (timeOfDay + (dt / DAY_LENGTH) * 24) % 24;
    world.timeOfDay = timeOfDay;
    const t = timeOfDay;
    // Sun elevation: smooth sine over the day, moon opposite phase.
    const sunAngle = ((t - 6) / 12) * Math.PI; // 0 at 06:00, PI at 18:00
    const sunUp = Math.sin(sunAngle);
    const moonAngle = sunAngle + Math.PI;
    const moonUp = Math.sin(moonAngle);
    const dayF = THREE.MathUtils.clamp(sunUp * 2.2, 0, 1);
    const duskF = THREE.MathUtils.clamp(1 - Math.abs(sunUp) * 3, 0, 1) * (sunUp > -0.25 ? 1 : 0);
    const nightF = THREE.MathUtils.clamp(-sunUp * 2.2, 0, 1);

    sun.position.set(Math.cos(sunAngle) * 300, Math.max(sunUp, 0.02) * 300, 120);
    sun.intensity = 0.15 + dayF * 2.1;
    moon.position.set(Math.cos(moonAngle) * 300, Math.max(moonUp, 0.02) * 300, -120);
    moon.intensity = nightF * 0.7;
    moonDisc.position.set(Math.cos(moonAngle) * 700, Math.max(moonUp, 0.05) * 700, -300);
    moonDisc.visible = moonUp > -0.05;
    moonDisc.material.color.setHex(nightF > 0.5 ? 0xe8ecff : 0xc9a689);

    sky.copy(daySky).lerp(duskSky, duskF * 0.8).lerp(nightSky, nightF);
    if (scene.background && scene.background.isColor) scene.background.copy(sky);
    else scene.background = sky.clone();
    if (scene.fog) scene.fog.color.copy(sky);
    hemi.intensity = 0.18 + dayF * 0.45;
    starMat.opacity = nightF * 0.9;

    const night = isNight();
    if (night !== lampsOn) {
      lampsOn = night;
      for (const l of lamps) {
        l.light.intensity = night ? 14 : 0;
        l.bulb.emissive.setHex(night ? 0xffd27a : 0x000000);
        l.bulb.emissiveIntensity = night ? 2 : 0;
      }
      // Headlights: player's vehicle / player light hook.
      if (world.player) world.player.headlightsOn = night;
    }
    // HUD clock hook.
    if (world.clock) {
      const h = Math.floor(timeOfDay);
      const m = Math.floor((timeOfDay - h) * 60);
      world.clock.text = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      world.clock.isNight = night;
    }
  }

  return { update, isNight, skipToNight, setTime };
}
