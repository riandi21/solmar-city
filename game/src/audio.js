// audio.js — Solmar City sound: 100% WebAudio synth, no audio files.
// Engine hum, two-tone siren, noise gunshot, a tiny step-sequencer music
// loop, and 6 radio stations cycled with C. M toggles mute.

const STATIONS = [
  { name: 'Vice FM',     bpm: 112, bass: [0, 0, 7, 0, 5, 0, 3, 10], wave: 'sawtooth', pad: [0, 3, 7, 10] },
  { name: 'Solmar Rock', bpm: 132, bass: [0, 0, 0, 3, 0, 5, 0, 7],  wave: 'square',   pad: [0, 5, 7, 12] },
  { name: 'Bassline 95', bpm: 96,  bass: [0, 10, 0, 7, 0, 12, 7, 5], wave: 'sawtooth', pad: [0, 7, 10, 15] },
  { name: 'Havana Nights', bpm: 104, bass: [0, 3, 5, 7, 5, 3, 0, 7], wave: 'triangle', pad: [0, 4, 7, 11] },
  { name: 'Neon Drive',  bpm: 122, bass: [0, 0, 12, 0, 10, 0, 7, 5], wave: 'sawtooth', pad: [0, 5, 8, 12] },
  { name: 'Sunset FM',   bpm: 88,  bass: [0, 7, 5, 3, 0, 3, 5, 7],  wave: 'sine',     pad: [0, 4, 7, 12] },
];

const A = 440;
function note(n) { return A * Math.pow(2, n / 12); }

export function createAudio(world) {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let station = 0;
  let step = 0;
  let nextStepTime = 0;
  let engineOsc = null;
  let engineGain = null;
  let sirenOn = false;
  let sirenOsc = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      // Engine: low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      engineOsc.connect(lp);
      lp.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch (e) { return false; }
    return true;
  }

  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  function blip(freq, dur, type, vol, when = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function playStep() {
    if (!ensure()) return;
    const st = STATIONS[station];
    const stepDur = 60 / st.bpm / 2; // 8th notes
    // Bassline note for this step.
    const bassNote = st.bass[step % st.bass.length];
    if (bassNote !== undefined) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = nextStepTime;
      o.type = st.wave;
      o.frequency.value = note(bassNote - 24);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
      o.connect(g); g.connect(musicGain);
      o.start(t); o.stop(t + stepDur);
    }
    // Pad chord on the downbeat of each bar.
    if (step % 8 === 0) {
      for (const p of st.pad) blip(note(p), stepDur * 7, 'sine', 0.05, nextStepTime - ctx.currentTime);
    }
    // Sunset FM gets a soft shaker tick on off-beats.
    if (st.name === 'Sunset FM' && step % 2 === 1) {
      const t = nextStepTime;
      const len = Math.floor(ctx.sampleRate * 0.03);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.25;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(musicGain);
      src.start(t);
    }
    step++;
    nextStepTime += stepDur;
  }

  function playGunshot() {
    if (!ensure()) return;
    const dur = 0.18;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.7;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1800;
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start();
  }

  function playSiren() {
    if (!ensure()) return;
    sirenOn = true;
    sirenTimer = 0;
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.value = 0.0;
      sirenOsc.connect(g); g.connect(master);
      sirenOsc._gain = g;
      sirenOsc.start();
    }
    sirenOsc._gain.gain.setTargetAtTime(0.08, ctx.currentTime, 0.05);
  }

  function stopSiren() {
    sirenOn = false;
    if (sirenOsc && sirenOsc._gain) sirenOsc._gain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.1);
  }

  function setStation(i) {
    station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    // Short two-note jingle so the station change is audible.
    if (ensure()) {
      blip(note(12), 0.12, 'sine', 0.12);
      blip(note(19), 0.18, 'sine', 0.12, 0.12);
    }
    return STATIONS[station].name;
  }

  function stationName() { return STATIONS[station].name; }

  function toggleMute() {
    muted = !muted;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
    return muted;
  }

  function update(dt) {
    if (!ctx) return;
    // Music scheduler: keep a small lookahead of scheduled steps.
    if (ctx.state === 'running') {
      if (nextStepTime < ctx.currentTime) nextStepTime = ctx.currentTime + 0.05;
      let guard = 0;
      while (nextStepTime < ctx.currentTime + 0.15 && guard++ < 8) playStep();
    }
    // Engine pitch/volume follows speed.
    if (engineOsc && engineGain) {
      const p = world.player || {};
      const speed = Math.abs(p.speed || 0);
      const driving = !!(p.vehicle || p.inVehicle || p.car || p.bike);
      const target = driving ? Math.min(0.12, 0.03 + speed * 0.0012) : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + speed * 1.6, ctx.currentTime, 0.1);
    }
    // Two-tone siren while police are close.
    const wanted = (world.player && world.player.wanted) || 0;
    const policeNear = !!(world.police && world.police.near);
    if ((wanted >= 1 || policeNear) && !sirenOn) playSiren();
    if (wanted === 0 && !policeNear && sirenOn) stopSiren();
    if (sirenOn && sirenOsc) {
      sirenTimer += dt;
      if (sirenTimer > 0.45) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.03);
      }
    }
    void dt;
  }

  const sys = {
    name: 'audio',
    update,
    setStation,
    toggleMute,
    playGunshot,
    playSiren,
    stopSiren,
    get station() { return STATIONS[station].name; },
    stationName,
    get stationIndex() { return station; },
    get stations() { return STATIONS.map((s) => s.name); },
    get muted() { return muted; },
  };
  return sys;
}
