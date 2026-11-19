// HUD for Solmar City — cash, health, wanted stars, objective line,
// speed, message toasts, screen switching, and the minimap.
//
// The HUD only reads the shared world object and writes to the DOM; it
// never touches the 3D scene. Every DOM lookup is guarded, so the module
// also runs headless (unit tests) when the page elements do not exist yet.
//
// Element ids (defined in index.html, owned by W4):
//   #cash #health-bar #health-fill #stars #objective #speed #message
//   #minimap (a <canvas>, 200x200) #menu #pause-screen #over-screen
//   #busted-screen
//
// Minimap: the whole city fits in one fixed view (about -280..+280 m on
// each axis). North (-Z) is up. Roads come from world.city.roads when the
// city system has built them, otherwise the known grid lines are drawn.

export const MINIMAP_SIZE = 200;
const MAP_EXTENT = 280; // half-width of the world shown on the minimap, metres
const GRID_LINES = [-232, -174, -116, -58, 0, 58, 116, 174, 232];
const MESSAGE_SECS = 3;

function project(x, z, size) {
  // World -> minimap pixels. North (-Z) is up, city centre is the middle.
  return [
    ((x + MAP_EXTENT) / (MAP_EXTENT * 2)) * size,
    ((z + MAP_EXTENT) / (MAP_EXTENT * 2)) * size,
  ];
}

function el(id) {
  if (typeof document === 'undefined') return null;
  return document.getElementById(id);
}

export function createHud() {
  // Look the elements up lazily on every call: index.html may be rewritten
  // after this module loads, and tests may run with no DOM at all.
  const els = () => ({
    cash: el('cash'),
    healthBar: el('health-bar'),
    healthFill: el('health-fill'),
    stars: el('stars'),
    objective: el('objective'),
    speed: el('speed'),
    message: el('message'),
    minimap: el('minimap'),
    menu: el('menu'),
    pause: el('pause-screen'),
    over: el('over-screen'),
    busted: el('busted-screen'),
    // v3 panels (created by index.html; hud.js only writes into them).
    clock: el('clock'),
    missionTracker: el('mission-tracker'),
    activityTracker: el('activity-tracker'),
    raceBanner: el('race-banner'),
  });

  const state = {
    messageTimer: null,
    lastObjective: '',
    mapCtx: null,
    lastPrompt: '',
  };

  // Extra HUD nodes (NOS meter, radio station, weapon, shop prompt) are
  // created here and appended to #hud — index.html is not rewritten for
  // them. Guarded: with no DOM (headless tests) they simply stay null.
  const extra = { nos: null, nosFill: null, radio: null, weapon: null, prompt: null };
  function makeNode(id, css) {
    if (typeof document === 'undefined') return null;
    const found = document.getElementById(id);
    if (found) return found;
    const hudRoot = document.getElementById('hud');
    if (!hudRoot) return null;
    const node = document.createElement('div');
    node.id = id;
    node.className = 'hud-panel';
    node.style.cssText = css;
    hudRoot.appendChild(node);
    return node;
  }
  extra.nos = makeNode('nos',
    'position:absolute;right:14px;bottom:64px;width:150px;padding:7px 10px;'
    + 'font-size:12px;color:#aab4c4;text-transform:uppercase;letter-spacing:1px;display:none;');
  if (extra.nos) {
    extra.nos.textContent = 'NOS';
    const fill = document.createElement('div');
    fill.id = 'nos-fill';
    fill.style.cssText = 'height:8px;margin-top:4px;border-radius:4px;background:#4dc3ff;width:100%;';
    extra.nos.appendChild(fill);
    extra.nosFill = fill;
  }
  // v3 — stamina bar (on foot, while sprinting matters) and the armour
  // vest indicator, built the same way as the NOS meter above.
  extra.stamina = makeNode('stamina',
    'position:absolute;left:14px;bottom:224px;width:150px;padding:7px 10px;'
    + 'font-size:12px;color:#aab4c4;text-transform:uppercase;letter-spacing:1px;display:none;');
  if (extra.stamina) {
    extra.stamina.textContent = 'Stamina';
    const fill = document.createElement('div');
    fill.id = 'stamina-fill';
    fill.style.cssText = 'height:8px;margin-top:4px;border-radius:4px;background:#58d68d;width:100%;';
    extra.stamina.appendChild(fill);
    extra.staminaFill = fill;
  }
  extra.armor = makeNode('armor',
    'position:absolute;right:14px;top:160px;padding:7px 12px;font-size:14px;display:none;');
  extra.radio = makeNode('radio',
    'position:absolute;right:14px;bottom:108px;padding:7px 12px;font-size:14px;display:none;');
  extra.weapon = makeNode('weapon',
    'position:absolute;right:14px;top:118px;padding:7px 12px;font-size:14px;display:none;');
  extra.prompt = makeNode('prompt',
    'position:absolute;left:50%;bottom:160px;transform:translateX(-50%);'
    + 'padding:8px 16px;font-size:15px;color:#ffd34d;display:none;white-space:nowrap;');

  function setPrompt(text) {
    state.lastPrompt = text || '';
    if (!extra.prompt) return;
    extra.prompt.textContent = state.lastPrompt;
    extra.prompt.style.display = state.lastPrompt ? 'block' : 'none';
  }

  function showMessage(text) {
    const { message } = els();
    if (!message) return;
    message.textContent = text;
    message.style.display = 'block';
    if (state.messageTimer) clearTimeout(state.messageTimer);
    state.messageTimer = setTimeout(() => {
      message.style.display = 'none';
    }, MESSAGE_SECS * 1000);
  }

  function setObjective(text) {
    state.lastObjective = text;
    const { objective } = els();
    if (objective) objective.textContent = text;
  }

  function setScreenVisible(node, visible) {
    if (node) node.style.display = visible ? 'flex' : 'none';
  }

  function drawRoads(ctx, world, size) {
    ctx.strokeStyle = 'rgba(200, 210, 220, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const roads = world.city && world.city.roads;
    if (roads && roads.length > 0) {
      for (const road of roads) {
        const [ax, ay] = project(
          road.axis === 'x' ? road.from : road.coord,
          road.axis === 'x' ? road.coord : road.from,
          size,
        );
        const [bx, by] = project(
          road.axis === 'x' ? road.to : road.coord,
          road.axis === 'x' ? road.coord : road.to,
          size,
        );
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
    } else {
      // Fallback: the fixed 9x9 grid from BUILD-NOTES.md.
      for (const c of GRID_LINES) {
        const [x0, y0] = project(c, -MAP_EXTENT, size);
        const [x1, y1] = project(c, MAP_EXTENT, size);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        const [x2, y2] = project(-MAP_EXTENT, c, size);
        const [x3, y3] = project(MAP_EXTENT, c, size);
        ctx.moveTo(x2, y2);
        ctx.lineTo(x3, y3);
      }
    }
    ctx.stroke();
  }

  function drawDiamond(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  function drawMinimap(world, canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    if (!state.mapCtx) state.mapCtx = canvas.getContext('2d');
    const ctx = state.mapCtx;
    if (!ctx) return;
    const size = canvas.width || MINIMAP_SIZE;
    const t = world.time || 0;
    const pulse = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 1.2);

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(10, 18, 28, 0.85)';
    ctx.fillRect(0, 0, size, size);

    // Sea along the south edge and the marina on the east edge, for orientation.
    ctx.fillStyle = 'rgba(40, 110, 160, 0.6)';
    const [, seaY] = project(0, 261, size);
    ctx.fillRect(0, seaY, size, size - seaY);

    drawRoads(ctx, world, size);

    // Mission marker: a pulsing gold diamond.
    if (world.mission && world.mission.marker) {
      const [mx, my] = project(world.mission.marker.x, world.mission.marker.z, size);
      drawDiamond(ctx, mx, my, 4 + 2.5 * pulse, '#ffd34d');
      ctx.strokeStyle = 'rgba(255, 211, 77, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, 8 + 4 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Traffic cars as yellow dots, police as flashing blue/red dots.
    for (const car of world.cars || []) {
      const [cx, cy] = project(car.pos.x, car.pos.z, size);
      if (car.kind === 'police') {
        ctx.fillStyle = Math.floor(t * 2) % 2 === 0 ? '#3a86ff' : '#ff3b30';
      } else {
        ctx.fillStyle = '#ffd60a';
      }
      ctx.beginPath();
      ctx.arc(cx, cy, car.kind === 'police' ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // v3 — district labels, so the minimap reads as a map of the city
    // instead of a grid: the new Old Town quarter, the lighthouse, and
    // the v2 districts, drawn small under their spots.
    const districts = (world.city && world.city.districts) || {};
    const labels = [
      ['Downtown', 0, 0],
      ['Old Town', (districts.oldTown || { x: -203, z: -58 }).x, (districts.oldTown || { x: -203, z: -58 }).z],
      ['Lighthouse', (districts.lighthouse || { x: -270, z: 300 }).x, (districts.lighthouse || { x: -270, z: 300 }).z],
      ['Freight Yard', (districts.freightYard || { x: -170, z: -260 }).x, (districts.freightYard || { x: -170, z: -260 }).z],
      ['Boardwalk', (districts.boardwalk || { x: 0, z: 264 }).x, (districts.boardwalk || { x: 0, z: 264 }).z],
      ['Marina', 305, 160],
    ];
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const [name, lx, lz] of labels) {
      // Clamp onto the canvas: the lighthouse and marina sit at the
      // map's edge, and an unclamped label would draw outside it.
      const [rx, ry] = project(lx, lz, size);
      const px = Math.max(28, Math.min(size - 28, rx));
      const py = Math.max(10, Math.min(size - 12, ry));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillText(name, px + 1, py + 9);
      ctx.fillStyle = 'rgba(238, 241, 245, 0.9)';
      ctx.fillText(name, px, py + 8);
    }

    // Player: a white arrow rotated by heading. Heading 0 faces -Z (up).
    if (world.player && world.player.pos) {
      const [px, py] = project(world.player.pos.x, world.player.pos.z, size);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-(world.player.heading || 0));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.5, 5);
      ctx.lineTo(0, 2.5);
      ctx.lineTo(-4.5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function update(world) {
    const e = els();
    const player = world.player || {};

    if (e.cash) {
      const cash = Math.floor(world.cash || 0);
      e.cash.textContent = `$${cash.toLocaleString('en-US')}`;
    }
    if (e.healthFill) {
      const hp = Math.max(0, Math.min(100, player.health ?? 100));
      e.healthFill.style.width = `${hp}%`;
      e.healthFill.style.background = hp > 50 ? '#3ddc5f' : hp > 25 ? '#ffb020' : '#ff3b30';
    }
    if (e.healthBar) {
      e.healthBar.setAttribute('aria-valuenow', String(Math.round(player.health ?? 100)));
    }
    if (e.stars) {
      const wanted = Math.max(0, Math.min(5, world.wanted || 0));
      e.stars.textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
    }
    if (e.objective && world.mission && world.mission.objective) {
      e.objective.textContent = world.mission.objective;
    }
    if (e.speed) {
      const kmh = Math.round(Math.abs(player.speed || 0) * 3.6);
      e.speed.textContent = player.car ? `${kmh} km/h` : `${kmh} km/h on foot`;
    }

    // NOS meter: only while driving. world.player.nos is 0..1 (1 = full).
    if (extra.nos && extra.nosFill) {
      const inCar = !!player.car;
      extra.nos.style.display = inCar ? 'block' : 'none';
      if (inCar) {
        const nos = Math.max(0, Math.min(1, player.nos ?? 1));
        extra.nosFill.style.width = `${nos * 100}%`;
        extra.nosFill.style.background = nos > 0.25 ? '#4dc3ff' : '#ff3b30';
      }
    }
    // v3 — stamina meter: only on foot, and only while it is not full
    // (a full bar would just sit there). world.player.stamina is 0..100.
    if (extra.stamina && extra.staminaFill) {
      const onFoot = !player.car;
      const stamina = Math.max(0, Math.min(100, player.stamina ?? 100));
      extra.stamina.style.display = onFoot && stamina < 100 ? 'block' : 'none';
      if (onFoot) {
        extra.staminaFill.style.width = `${stamina}%`;
        extra.staminaFill.style.background = stamina > 25 ? '#58d68d' : '#ff3b30';
      }
    }
    // v3 — armour vest: shows the remaining durability while worn.
    if (extra.armor) {
      const armor = Math.max(0, Math.round(player.armor || 0));
      extra.armor.textContent = armor > 0 ? `Vest ${armor}` : '';
      extra.armor.style.display = armor > 0 ? 'block' : 'none';
    }
    // Radio station label, bottom-right: "♪ Solmar FM".
    if (extra.radio) {
      let name = '';
      try {
        if (world.audio && typeof world.audio.stationName === 'function') {
          name = world.audio.stationName() || '';
        }
      } catch {
        name = '';
      }
      extra.radio.textContent = name ? `♪ ${name}` : '';
      extra.radio.style.display = name ? 'block' : 'none';
    }
    // Weapon label: what Rico is holding (fists / pistol / SMG / shotgun / rifle).
    if (extra.weapon) {
      let weapon = '';
      try {
        weapon = world.systems?.combat?.state?.weapon || '';
      } catch {
        weapon = '';
      }
      const labels = { fists: 'Fists', pistol: 'Pistol', smg: 'SMG', shotgun: 'Shotgun', rifle: 'Rifle' };
      const shown = weapon ? (labels[weapon.toLowerCase()] || weapon) : '';
      extra.weapon.textContent = shown;
      extra.weapon.style.display = shown ? 'block' : 'none';
    }

    // v3 — the clock: the day/night system owns the time; the HUD just
    // prints it (and a small moon/sun so night reads at a glance).
    if (e.clock) {
      let clockText = '';
      let night = false;
      try {
        const dn = world.systems && world.systems.daynight;
        if (dn && typeof dn.clockText === 'function') clockText = dn.clockText();
        if (dn && typeof dn.isNight === 'function') night = dn.isNight();
      } catch {
        clockText = '';
      }
      e.clock.textContent = clockText ? `${night ? '☾' : '☀'} ${clockText}` : '';
      e.clock.style.display = clockText ? 'block' : 'none';
    }

    // v3 — mission tracker: which job, which stage, how much time is
    // left on a timed one, and how many of the twelve are done.
    if (e.missionTracker) {
      const names = {
        1: 'First Wheels', 2: 'Courier Run', 3: 'Hot Pursuit', 4: 'The Marina Job',
        5: 'Dourado Moves In', 6: 'The Port Run', 7: 'Five-Star Heat', 8: 'The Coral Takeover',
        9: 'Harbor Escort', 10: 'Midnight Delivery', 11: 'Harbor Takedown', 12: 'The Harbor War',
      };
      const mission = world.mission || {};
      const done = (world.missionsDone || []).length;
      let text = '';
      if (mission.id && names[mission.id]) {
        text = `Mission ${mission.id} · ${names[mission.id]}`;
        if (mission.stage) text += ` — stage ${mission.stage}`;
        if (mission.timer > 0) text += ` — ${Math.ceil(mission.timer)}s left`;
        text += ` (${done}/12 done)`;
      } else if (done >= 12) {
        text = 'All 12 missions done — Solmar City is yours, Rico.';
      } else {
        text = `Missions done: ${done}/12`;
      }
      e.missionTracker.innerHTML = `<b>${text}</b>`;
    }

    // v3 — activity tracker: hidden packages, taxi money, best race times.
    if (e.activityTracker) {
      let packages = 0;
      let taxi = 0;
      let bests = [];
      let recent = '';
      try {
        const progress = world.activitiesProgress;
        if (progress) {
          packages = (progress.packagesFound || []).length;
          taxi = progress.taxiEarned || 0;
          bests = Object.entries(progress.raceBest || {}).map(([id, t]) => `${id} ${Number(t).toFixed(1)}s`);
          // v3 — the last race result, newest first.
          const history = progress.raceHistory || [];
          if (history.length) {
            const last = history[0];
            recent = ` · Last race: <b>${last.race} ${Number(last.seconds).toFixed(1)}s</b>`;
          }
        }
      } catch {
        // Progress is a nicety; the tracker just shows zeroes.
      }
      e.activityTracker.innerHTML =
        `Packages <b>${packages}/20</b> · Taxi <b>$${taxi}</b>` +
        (bests.length ? ` · Best: <b>${bests.join(', ')}</b>` : '') + recent;
    }

    // v3 — race banner: live race clock while a street race runs, or the
    // "press T" prompt when Rico stands on a start gantry.
    if (e.raceBanner) {
      let banner = '';
      try {
        const acts = world.systems && world.systems.activities;
        if (acts && acts.state) {
          if (acts.state.race) {
            const r = acts.state.race;
            banner = `${r.def.name} — ${r.timer.toFixed(1)}s · checkpoint ${r.index + 1}/${r.def.checkpoints.length}`;
          } else if (acts.state.racePrompt) {
            banner = acts.state.racePrompt;
          }
        }
      } catch {
        banner = '';
      }
      e.raceBanner.textContent = banner;
      e.raceBanner.style.display = banner ? 'block' : 'none';
    }

    // One screen visible at a time, driven by world.mode.
    setScreenVisible(e.menu, world.mode === 'menu');
    setScreenVisible(e.pause, world.mode === 'pause');
    setScreenVisible(e.over, world.mode === 'over');
    setScreenVisible(e.busted, world.mode === 'busted');

    drawMinimap(world, e.minimap);
  }

  return { update, showMessage, setObjective, setPrompt, state };
}

// Re-exported for tests that want the pure projection without a DOM.
export function minimapProject(x, z, size = MINIMAP_SIZE) {
  return project(x, z, size);
}
