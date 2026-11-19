// Audio for Solmar City: pure WebAudio synthesis, no audio files.
// Engine hum, police siren, gunshots and a looping music sequencer
// with four radio stations. M toggles mute, C changes station.
export function createAudio(world) {
  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    sirenHigh: false,
    muted: false,
    station: 0,
    step: 0,
    nextStepTime: 0,
    started: false,
    stations: [
      { name: 'SOLMAR FM', bpm: 96, root: 55.0, bass: [0, 0, 7, 10, 0, 3, 7, 5], pad: [0, 3, 7, 10] },
      { name: 'CORAL WAVE', bpm: 78, root: 49.0, bass: [0, 5, 3, 7, 0, 5, 10, 7], pad: [0, 5, 7, 12] },
      { name: 'DOCKS BASS', bpm: 122, root: 41.2, bass: [0, 0, 0, 12, 0, 10, 7, 12], pad: [0, 7, 10, 12] },
      { name: 'PALM NIGHT', bpm: 64, root: 65.4, bass: [0, 7, 5, 3, 0, 7, 10, 5], pad: [0, 3, 5, 7] },
    ],
  };

  function ensureContext() {
    if (audio.ctx) return true;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    audio.ctx = new Ctor();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.55;
    audio.master.connect(audio.ctx.destination);
    audio.musicGain = audio.ctx.createGain();
    audio.musicGain.gain.value = 0.16;
    audio.musicGain.connect(audio.master);
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 52;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'square';
    audio.sirenOsc.frequency.value = 660;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    return true;
  }

  function noteFreq(root, semitones) {
    return root * Math.pow(2, semitones / 12);
  }

  function playTone(freq, time, length, type, gainValue, dest) {
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + length);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + length + 0.05);
  }

  function scheduleStep() {
    const station = audio.stations[audio.station];
    const stepLen = 60 / station.bpm / 2;
    while (audio.nextStepTime < audio.ctx.currentTime + 0.25) {
      const t = audio.nextStepTime;
      const bassNote = station.bass[audio.step % station.bass.length];
      playTone(noteFreq(station.root, bassNote), t, stepLen * 1.8, 'triangle', 0.5, audio.musicGain);
      if (audio.step % 4 === 0) {
        for (const interval of station.pad) {
          playTone(noteFreq(station.root * 2, interval), t, stepLen * 3.6, 'sine', 0.08, audio.musicGain);
        }
      }
      if (audio.step % 2 === 1) {
        playTone(noteFreq(station.root * 4, station.pad[audio.step % station.pad.length]), t, stepLen * 0.9, 'sine', 0.05, audio.musicGain);
      }
      audio.step += 1;
      audio.nextStepTime += stepLen;
    }
  }

  audio.resume = function resume() {
    if (!ensureContext()) return;
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    audio.started = true;
    audio.nextStepTime = audio.ctx.currentTime + 0.1;
  };

  audio.setMuted = function setMuted(muted) {
    audio.muted = muted;
    if (audio.master) audio.master.gain.value = muted ? 0 : 0.55;
  };

  audio.toggleMute = function toggleMute() {
    audio.setMuted(!audio.muted);
    return audio.muted;
  };

  audio.cycleStation = function cycleStation() {
    audio.station = (audio.station + 1) % audio.stations.length;
    audio.step = 0;
    if (world.toast) world.toast('Radio: ' + audio.stations[audio.station].name);
    return audio.stations[audio.station].name;
  };

  audio.stationName = function stationName() {
    return audio.stations[audio.station].name;
  };

  audio.gunshot = function gunshot() {
    if (!ensureContext() || audio.muted) return;
    const duration = 0.22;
    const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * duration, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
    }
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    const gain = audio.ctx.createGain();
    gain.gain.value = 0.5;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start();
  };

  audio.beep = function beep(freq) {
    if (!ensureContext() || audio.muted) return;
    playTone(freq || 880, audio.ctx.currentTime, 0.12, 'sine', 0.25, audio.master);
  };

  audio.crash = function crash(hard) {
    if (!ensureContext() || audio.muted) return;
    const duration = hard ? 0.35 : 0.18;
    const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * duration, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.6);
    }
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = hard ? 900 : 500;
    const gain = audio.ctx.createGain();
    gain.gain.value = hard ? 0.6 : 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start();
    playTone(70, audio.ctx.currentTime, 0.25, 'sine', 0.4, audio.master);
  };

  audio.pickup = function pickup() {
    if (!ensureContext() || audio.muted) return;
    const now = audio.ctx.currentTime;
    playTone(660, now, 0.09, 'sine', 0.2, audio.master);
    playTone(990, now + 0.08, 0.14, 'sine', 0.2, audio.master);
  };

  audio.update = function update(dt) {
    const input = world.input;
    if (input && input.justPressed) {
      if (input.justPressed.has('KeyM')) {
        audio.toggleMute();
        if (world.toast) world.toast(audio.muted ? 'Sound muted' : 'Sound on');
      }
      if (input.justPressed.has('KeyC')) {
        if (ensureContext()) audio.cycleStation();
      }
    }
    if (!audio.ctx || !audio.started) return;
    const player = world.player || {};
    const driving = player.car || player.bike;
    const speed = Math.abs(player.speed || 0);
    const targetEngine = driving ? 0.05 + Math.min(speed / 60, 1) * 0.09 : 0;
    audio.engineGain.gain.setTargetAtTime(targetEngine, audio.ctx.currentTime, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(48 + speed * 3.2, audio.ctx.currentTime, 0.08);
    const wanted = world.wanted || 0;
    if (wanted >= 1 && world.mode === 'play') {
      audio.sirenGain.gain.setTargetAtTime(0.035, audio.ctx.currentTime, 0.2);
      audio.sirenTimer += dt;
      if (audio.sirenTimer > 0.45) {
        audio.sirenTimer = 0;
        audio.sirenHigh = !audio.sirenHigh;
        audio.sirenOsc.frequency.value = audio.sirenHigh ? 880 : 660;
      }
    } else {
      audio.sirenGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.2);
    }
    if (world.mode === 'play' && !audio.muted) scheduleStep();
  };

  return audio;
}
