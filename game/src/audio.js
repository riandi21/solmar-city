// Solmar City audio: WebAudio synth only, no audio files. Engine hum, sirens,
// gunshots, a bass-and-pad music loop, and six radio stations (C cycles them).
// M toggles mute. Everything is built from oscillators and noise buffers so the
// game ships zero network requests and zero audio assets.

const STATIONS = [
  { name: 'Coral FM', bass: [55, 55, 65.41, 49], tempo: 112, wave: 'sawtooth' },
  { name: 'Sunset FM', bass: [49, 55, 58.27, 65.41], tempo: 96, wave: 'triangle' },
  { name: 'Havana Heat', bass: [58.27, 65.41, 55, 73.42], tempo: 124, wave: 'square' },
  { name: 'Neon Nights', bass: [65.41, 49, 55, 58.27], tempo: 120, wave: 'sawtooth' },
  { name: 'Boardwalk', bass: [55, 49, 65.41, 55], tempo: 104, wave: 'triangle' },
  { name: 'Vice Talk', bass: [49, 49, 55, 49], tempo: 88, wave: 'sine' },
];

const PAD_CHORDS = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [196, 246.94, 293.66],
  [164.81, 207.65, 246.94],
];

export function createAudio(world) {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOscA = null;
  let sirenOscB = null;
  let sirenGain = null;
  let muted = false;
  let station = 0;
  let stepTimer = 0;
  let stepIndex = 0;
  let started = false;

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
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineOsc.connect(engineGain);
      engineOsc.start();
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenGain.connect(master);
      sirenOscA = ctx.createOscillator();
      sirenOscA.type = 'sine';
      sirenOscA.frequency.value = 660;
      sirenOscA.connect(sirenGain);
      sirenOscA.start();
      sirenOscB = ctx.createOscillator();
      sirenOscB.type = 'sine';
      sirenOscB.frequency.value = 880;
      sirenOscB.connect(sirenGain);
      sirenOscB.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function noiseBurst(duration, volume, lowpass) {
    if (!ensure()) return;
    resume();
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function blip(freq, duration, volume, type) {
    if (!ensure()) return;
    resume();
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function playStep() {
    if (!ctx || muted) return;
    const st = STATIONS[station];
    const chord = PAD_CHORDS[stepIndex % PAD_CHORDS.length];
    const bassNote = st.bass[stepIndex % st.bass.length];
    const osc = ctx.createOscillator();
    osc.type = st.wave;
    osc.frequency.value = bassNote;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(t);
    osc.stop(t + 0.26);
    if (stepIndex % 2 === 0) {
      chord.forEach((freq) => {
        const pad = ctx.createOscillator();
        pad.type = 'sine';
        pad.frequency.value = freq;
        const pg = ctx.createGain();
        pg.gain.setValueAtTime(0.12, t);
        pg.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        pad.connect(pg);
        pg.connect(musicGain);
        pad.start(t);
        pad.stop(t + 0.95);
      });
    }
  }

  const audio = {
    stations: STATIONS.map((s) => s.name),
    get station() { return STATIONS[station].name; },
    get muted() { return muted; },
    ensure,
    resume,
    unlock() { ensure(); resume(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      stepIndex = 0;
      return STATIONS[station].name;
    },
    setStation(index) {
      station = ((index % STATIONS.length) + STATIONS.length) % STATIONS.length;
      stepIndex = 0;
      return STATIONS[station].name;
    },
    gunshot() { noiseBurst(0.14, 0.5, 1800); },
    punch() { noiseBurst(0.08, 0.3, 900); },
    crash() { noiseBurst(0.3, 0.55, 700); },
    pickup() { blip(880, 0.12, 0.3); blip(1318, 0.18, 0.25); },
    missionDone() {
      blip(523.25, 0.15, 0.3);
      setTimeout(() => blip(659.25, 0.15, 0.3), 140);
      setTimeout(() => blip(783.99, 0.3, 0.3), 280);
    },
    missionFail() { blip(220, 0.4, 0.3, 'sawtooth'); },
    siren(on) {
      if (!ensure()) return;
      sirenGain.gain.value = on && !muted ? 0.05 : 0;
    },
    update(dt) {
      if (!ctx || !started) return;
      const speed = world && world.player ? (world.player.speed || 0) : 0;
      const driving = world && typeof world.player.currentVehicle === 'function'
        ? world.player.currentVehicle() !== null
        : speed > 0.5;
      if (engineOsc) engineOsc.frequency.value = 50 + Math.min(speed, 60) * 2.2;
      if (engineGain) engineGain.gain.value = driving && !muted ? 0.06 : 0;
      const wanted = world ? (world.wanted || 0) : 0;
      if (sirenOscA && sirenOscB) {
        const phase = (performance.now() / 450) % 2 < 1;
        sirenOscA.frequency.value = phase ? 660 : 880;
        sirenOscB.frequency.value = phase ? 880 : 660;
      }
      audio.siren(wanted >= 1);
      if (muted) return;
      stepTimer += dt;
      const interval = 60 / STATIONS[station].tempo / 2;
      while (stepTimer >= interval) {
        stepTimer -= interval;
        stepIndex += 1;
        playStep();
      }
    },
  };
  return audio;
}
