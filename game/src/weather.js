import * as THREE from 'three';

// Weather: rain + fog events, storms at night, reduced driving grip in rain.
// world.weatherGrip (0..1) is read by vehicle systems; 1 = full grip.
export function createWeather(scene, world) {
  let raining = false;
  let rainTarget = 0;
  let rainLevel = 0;
  let fogDensity = 0.0012;
  let fogTarget = 0.0012;
  let stormTimer = 0;
  let nextEvent = 45 + world.rng() * 60;

  const COUNT = 1200;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (world.rng() - 0.5) * 120;
    pos[i * 3 + 1] = world.rng() * 60;
    pos[i * 3 + 2] = (world.rng() - 0.5) * 120;
    speeds[i] = 38 + world.rng() * 22;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x9fb4cc, size: 0.35, transparent: true, opacity: 0, depthWrite: false,
  });
  const rain = new THREE.Points(geo, mat);
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);

  if (!scene.fog) scene.fog = new THREE.FogExp2(0x87b5e0, fogDensity);
  world.weatherGrip = 1;

  function setRain(on) { raining = !!on; rainTarget = on ? 1 : 0; }
  function setFog(density) { fogTarget = THREE.MathUtils.clamp(density, 0, 0.03); }

  function update(dt) {
    // Random events: rain rolls in, storms only at night.
    nextEvent -= dt;
    if (nextEvent <= 0) {
      nextEvent = 50 + world.rng() * 90;
      const night = world.timeOfDay !== undefined && (world.timeOfDay < 5.5 || world.timeOfDay >= 19);
      if (!raining && world.rng() < 0.45) {
        setRain(true);
        if (night && world.rng() < 0.5) stormTimer = 20 + world.rng() * 25;
        setFog(0.004 + world.rng() * 0.004);
      } else if (raining) {
        setRain(false);
        setFog(0.0012);
      }
    }
    if (stormTimer > 0) {
      stormTimer -= dt;
      // Lightning flicker: brief ambient lift.
      if (world.rng() < dt * 0.6) {
        const flash = new THREE.PointLight(0xdfe8ff, 400, 600, 1.2);
        flash.position.set((world.rng() - 0.5) * 400, 120, (world.rng() - 0.5) * 400);
        scene.add(flash);
        setTimeout(() => scene.remove(flash), 120);
      }
    }

    rainLevel += (rainTarget - rainLevel) * Math.min(1, dt * 0.8);
    if (rainTarget === 0 && rainLevel < 0.02) rainLevel = 0;
    rain.visible = rainLevel > 0.02;
    mat.opacity = rainLevel * 0.75;
    if (rain.visible) {
      const p = world.player ? world.player.position : { x: 0, y: 0, z: 0 };
      const arr = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3 + 1] -= speeds[i] * dt;
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3 + 1] = 55 + world.rng() * 5;
          arr[i * 3] = p.x + (world.rng() - 0.5) * 120;
          arr[i * 3 + 2] = p.z + (world.rng() - 0.5) * 120;
        }
      }
      geo.attributes.position.needsUpdate = true;
      rain.position.set(0, 0, 0);
    }

    fogDensity += (fogTarget - fogDensity) * Math.min(1, dt * 0.5);
    if (scene.fog && scene.fog.isFogExp2) scene.fog.density = fogDensity;

    // Grip: rain cuts grip to ~0.62, storms to ~0.5.
    const target = stormTimer > 0 ? 0.5 : 1 - rainLevel * 0.38;
    world.weatherGrip = THREE.MathUtils.lerp(world.weatherGrip ?? 1, target, Math.min(1, dt * 2));
    world.raining = rainLevel > 0.3;
  }

  return { update, setRain, setFog };
}
