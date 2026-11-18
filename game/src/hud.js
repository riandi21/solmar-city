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
  });

  const state = {
    messageTimer: null,
    lastObjective: '',
    mapCtx: null,
  };

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

    // One screen visible at a time, driven by world.mode.
    setScreenVisible(e.menu, world.mode === 'menu');
    setScreenVisible(e.pause, world.mode === 'pause');
    setScreenVisible(e.over, world.mode === 'over');
    setScreenVisible(e.busted, world.mode === 'busted');

    drawMinimap(world, e.minimap);
  }

  return { update, showMessage, setObjective, state };
}

// Re-exported for tests that want the pure projection without a DOM.
export function minimapProject(x, z, size = MINIMAP_SIZE) {
  return project(x, z, size);
}
