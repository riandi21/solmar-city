import * as THREE from 'three';

// Weather: rain and fog events, with night storms. Rain is a visible
// particle sheet around the player, fog thickens the scene fog, and rain
// cuts driving grip (read by the vehicles system through world.weatherGrip).
// Storms only roll in at night and add lightning flashes.
export function createWeather(world) {
  const scene = world.scene;
  const camera = world.camera;

  const DRY_GRIP = 1.0;
  const RAIN_GRIP = 0.68;
  const STORM_GRIP = 0.58;

  let state = 'clear'; // clear | rain | fog | storm
  let stateTime = 0; // seconds left in the current event (0 = indefinite clear)
  let nextEventIn = 45 + Math.random() * 60;
  let fogTarget = 0; // 0..1 how foggy it should be
  let fogAmount = 0; // smoothed fog amount actually applied
  let rainAmount = 0; // smoothed 0..1
  let lightningTimer = 0;
  let flash = 0; // 0..1 lightning flash brightness, decays fast
  let announced = false;

  world.weatherGrip = DRY_GRIP;
  world.weather = world.weather || 'clear';

  // Keep the scene fog object around so we can thicken it; create a light
  // one if the renderer never made one.
  if (!scene.fog) {
    scene.fog = new THREE.Fog(0xa8c6e2, 220, 900);
  }
  const baseFogNear = scene.fog.near;
  const baseFogFar = scene.fog.far;

  // --- rain: 1,200 streaks in a box that follows the camera
  const RAIN_COUNT = 1200;
  const rainPos = new Float32Array(RAIN_COUNT * 3);
  const rainSpeed = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 120;
    rainPos[i * 3 + 1] = Math.random() * 60;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    rainSpeed[i] = 34 + Math.random() * 22;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xaac8e8, size: 0.35, transparent: true, opacity: 0,
    depthWrite: false,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);

  // --- lightning: a brief sky flash from a high directional light
  const flashLight = new THREE.DirectionalLight(0xdfe8ff, 0);
  flashLight.position.set(120, 300, -80);
  scene.add(flashLight);

  function setState(next, duration) {
    state = next;
    stateTime = duration || 0;
    world.weather = next;
    announced = false;
    if (next === 'rain') {
      fogTarget = 0.35;
    } else if (next === 'fog') {
      fogTarget = 1;
    } else if (next === 'storm') {
      fogTarget = 0.55;
    } else {
      fogTarget = 0;
    }
  }

  function startRain(duration) {
    setState('rain', duration || 50 + Math.random() * 40);
  }

  function startFog(duration) {
    setState('fog', duration || 60 + Math.random() * 40);
  }

  function startStorm(duration) {
    setState('storm', duration || 45 + Math.random() * 30);
    lightningTimer = 1 + Math.random() * 3;
  }

  function clear() {
    setState('clear', 0);
    nextEventIn = 60 + Math.random() * 90;
  }

  function isRaining() {
    return state === 'rain' || state === 'storm';
  }

  function getGrip() {
    return world.weatherGrip;
  }

  // Visibility 1 (clear) to ~0.2 (pea-soup fog), for the HUD and for
  // systems that care how far anyone can see (police, helicopter).
  function getVisibility() {
    return 1 - fogAmount * 0.8;
  }

  function getFogAmount() {
    return fogAmount;
  }

  function getRainAmount() {
    return rainAmount;
  }

  function pickEvent() {
    const night = world.night === true ||
      (world.dayNight && world.dayNight.isNight && world.dayNight.isNight());
    const roll = Math.random();
    if (night && roll < 0.3) {
      startStorm();
    } else if (roll < 0.55) {
      startRain();
    } else {
      startFog();
    }
  }

  function update(dt) {
    // Schedule: events roll in on their own while the game runs.
    if (world.mode === 'play') {
      if (state === 'clear') {
        nextEventIn -= dt;
        if (nextEventIn <= 0) pickEvent();
      } else if (stateTime > 0) {
        stateTime -= dt;
        if (stateTime <= 0) {
          setState('clear', 0);
          nextEventIn = 70 + Math.random() * 110;
        }
      }
    }

    if (!announced && state !== 'clear' && world.events) {
      world.events.push({ type: 'weather', weather: state });
      announced = true;
    }

    // Smooth the rain and fog amounts toward their targets.
    const rainTarget = isRaining() ? 1 : 0;
    rainAmount += (rainTarget - rainAmount) * Math.min(1, dt * 1.6);
    fogAmount += (fogTarget - fogAmount) * Math.min(1, dt * 0.8);

    // Grip: slick roads while it rains, worst in a storm.
    const gripTarget = state === 'storm' ? STORM_GRIP : state === 'rain' ? RAIN_GRIP : DRY_GRIP;
    world.weatherGrip += (gripTarget - world.weatherGrip) * Math.min(1, dt * 2);

    // Fog density: pull the far plane in as fog thickens.
    if (scene.fog) {
      scene.fog.near = baseFogNear * (1 - fogAmount * 0.55);
      scene.fog.far = baseFogFar * (1 - fogAmount * 0.78);
    }

    // Rain particles: fall, recycle to the top, follow the camera.
    if (rainAmount > 0.02 && camera) {
      rain.visible = true;
      rainMat.opacity = rainAmount * 0.75;
      rain.position.set(camera.position.x, 0, camera.position.z);
      const arr = rainGeo.attributes.position.array;
      for (let i = 0; i < RAIN_COUNT; i++) {
        arr[i * 3 + 1] -= rainSpeed[i] * dt;
        arr[i * 3] += dt * 6; // slight wind slant
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3 + 1] = 55 + Math.random() * 5;
          arr[i * 3] = (Math.random() - 0.5) * 120;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 120;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
    } else {
      rain.visible = false;
    }

    // Lightning: random strikes during storms, flash decays in ~0.15 s.
    if (state === 'storm') {
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        flash = 0.9 + Math.random() * 0.6;
        lightningTimer = 3 + Math.random() * 7;
      }
    }
    flash = Math.max(0, flash - dt * 6);
    flashLight.intensity = flash * 5;
  }

  return {
    update,
    startRain,
    startFog,
    startStorm,
    clear,
    isRaining,
    getGrip,
    getVisibility,
    getFogAmount,
    getRainAmount,
    getState: () => state,
    isStorming: () => state === 'storm',
    isFoggy: () => state === 'fog',
    rain,
  };
}
