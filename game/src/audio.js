// Sound for Solmar City: everything is synthesized live with WebAudio, no audio
// files. Engine hum, two-tone police siren, gunshot noise, punch thud, a little
// mission-complete jingle, and a car radio with three switchable synth
// stations (C cycles them). The AudioContext is only created on the first
// user gesture (start()), and every method is safe to call before that — it
// just does nothing until there is sound.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicOn = true;

  // Engine: one sawtooth through a lowpass, pitch and growl follow the speed.
  let engineOsc = null;
  let engineFilter = null;
  let engineGain = null;
  // Siren: one square wave whose pitch hops between two tones on a slow LFO.
  let sirenOsc = null;
  let sirenLfo = null;
  let sirenGain = null;
  let sirenActive = false;
  // Music: a tiny step sequencer ticking on a timer, scheduling notes ahead.
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;

  // Car radio: three synth stations. Each one picks its own tempo, bass
  // roots (Hz, one per eighth-note step), pad chords and bass wave.
  // chords: 8 entries, one per bar-step slot; the sequencer plays chords[0]
  // on even bars and chords[4] on odd bars (see scheduleMusicStep).
  const STATIONS = [
    {
      name: 'Solmar FM',
      bpm: 100,
      wave: 'triangle',
      offbeat: false,
      bass: [55.0, 55.0, 65.41, 49.0, 55.0, 55.0, 82.41, 73.42],
      chords: [
        [220.0, 261.63, 329.63], // Am
        [220.0, 261.63, 329.63],
        [174.61, 220.0, 261.63], // F
        [196.0, 246.94, 293.66], // G
        [220.0, 261.63, 329.63],
        [220.0, 261.63, 329.63],
        [164.81, 220.0, 261.63], // E-ish lift
        [196.0, 246.94, 293.66],
      ],
    },
    {
      name: 'Coral Nights',
      bpm: 116,
      wave: 'square',
      offbeat: false,
      // Darker synthwave walk: Am / F / Dm / E, square bass bites harder.
      bass: [55.0, 55.0, 43.65, 55.0, 49.0, 49.0, 73.42, 82.41],
      chords: [
        [220.0, 261.63, 329.63], // Am
        [220.0, 261.63, 329.63],
        [174.61, 220.0, 261.63], // F
        [146.83, 174.61, 220.0], // Dm
        [164.81, 207.65, 246.94], // E
        [164.81, 207.65, 246.94],
        [174.61, 220.0, 261.63], // F
        [196.0, 246.94, 293.66], // G
      ],
    },
    {
      name: 'Portside',
      bpm: 88,
      wave: 'triangle',
      offbeat: true, // reggae-ish: the bass lands on the off-beats only
      // Bright island walk: C / F / G, roots bounce a fifth up on the skank.
      bass: [65.41, 98.0, 65.41, 87.31, 73.42, 110.0, 65.41, 98.0],
      chords: [
        [261.63, 329.63, 392.0], // C
        [261.63, 329.63, 392.0],
        [174.61, 220.0, 261.63], // F
        [196.0, 246.94, 293.66], // G
        [196.0, 246.94, 293.66], // G
        [196.0, 246.94, 293.66],
        [174.61, 220.0, 261.63], // F
        [261.63, 329.63, 392.0], // C
      ],
    },
  ];
  let stationIndex = 0;

  /** Length of one eighth-note step at the active station's tempo. */
  function stepSeconds() {
    return 60 / STATIONS[stationIndex].bpm / 2;
  }

  function ensureContext() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, volume, when = 0, slideTo = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, volume, filterFreq) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function buildEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineFilter.Q.value = 2;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function buildSiren() {
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 720;
    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'square';
    sirenLfo.frequency.value = 0.9; // hops about once a second
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180; // swings the pitch 720 +/- 180 Hz
    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    sirenLfo.start();
  }

  function scheduleMusicStep(step, time) {
    const station = STATIONS[stationIndex];
    const ss = stepSeconds();
    const bar = Math.floor(step / 8) % 2;
    const beat = step % 8;
    // Bass on the steps the station wants: every step, except offbeat
    // stations (Portside) which only play on the off-beats. Quieter there.
    const playBass = !station.offbeat || beat % 2 === 1;
    if (playBass) {
      const bass = ctx.createOscillator();
      bass.type = station.wave;
      bass.frequency.value = station.bass[beat];
      const bassGain = ctx.createGain();
      const vol = station.wave === 'square' ? 0.09 : 0.16;
      bassGain.gain.setValueAtTime(beat % 2 === 0 ? vol : vol * 0.55, time);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, time + ss * 0.95);
      bass.connect(bassGain);
      bassGain.connect(master);
      bass.start(time);
      bass.stop(time + ss);
    }
    // Pad chord at the top of each bar, soft and slow.
    if (beat === 0) {
      const chord = station.chords[bar * 4];
      for (let i = 0; i < chord.length; i += 1) {
        const pad = ctx.createOscillator();
        pad.type = 'sine';
        pad.frequency.value = chord[i];
        const padGain = ctx.createGain();
        padGain.gain.setValueAtTime(0, time);
        padGain.gain.linearRampToValueAtTime(0.045, time + 0.4);
        padGain.gain.linearRampToValueAtTime(0.0001, time + ss * 8);
        pad.connect(padGain);
        padGain.connect(master);
        pad.start(time);
        pad.stop(time + ss * 8);
      }
    }
  }

  function musicTick() {
    if (!ctx || !musicOn || muted) return;
    while (nextNoteTime < ctx.currentTime + 0.25) {
      scheduleMusicStep(musicStep, Math.max(nextNoteTime, ctx.currentTime));
      nextNoteTime += stepSeconds();
      musicStep = (musicStep + 1) % 64;
    }
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    musicStep = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    musicTimer = window.setInterval(musicTick, 90);
  }

  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    /** Create (or resume) the audio context. Call from a user gesture. */
    start() {
      if (!ensureContext()) return;
      resume();
      if (!engineOsc) buildEngine();
      if (!sirenOsc) buildSiren();
      if (musicOn) startMusic();
    },

    /** Engine hum: speed01 0..1 raises pitch, filter and volume. 0 idles quietly. */
    engine(speed01) {
      if (!ctx || !engineOsc) return;
      const s = Math.max(0, Math.min(1, speed01));
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(52 + s * 165, t, 0.08);
      engineFilter.frequency.setTargetAtTime(280 + s * 1400, t, 0.08);
      engineGain.gain.setTargetAtTime(0.05 + s * 0.1, t, 0.1);
    },

    /** Two-tone siren on while the police are after the player. */
    siren(on) {
      if (!ctx || !sirenGain) {
        sirenActive = on;
        return;
      }
      sirenActive = on;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.15);
    },

    /** Short noise burst: the pistol. */
    shot() {
      if (!ctx) return;
      resume();
      noiseBurst(0.14, 0.5, 2800);
      tone(160, 0.09, 'square', 0.18, 0, 55);
    },

    /** Low thud: a punch landing. */
    punch() {
      if (!ctx) return;
      resume();
      tone(120, 0.16, 'sine', 0.5, 0, 42);
      noiseBurst(0.08, 0.2, 500);
    },

    /** Little rising arpeggio: mission complete. */
    jingle() {
      if (!ctx) return;
      resume();
      const notes = [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < notes.length; i += 1) tone(notes[i], 0.35, 'triangle', 0.22, i * 0.11);
      tone(1318.5, 0.5, 'triangle', 0.18, notes.length * 0.11);
    },

    /** Music loop on/off (kept across mute). */
    setMusic(on) {
      musicOn = on;
      if (!ctx) return;
      if (on) startMusic();
      else stopMusic();
    },

    /** M toggles this: silence everything, keep the nodes running. */
    setMuted(m) {
      muted = m;
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05);
    },

    /** Radio: cycle to the next station (C key). Returns the new name. */
    nextStation() {
      stationIndex = (stationIndex + 1) % STATIONS.length;
      return STATIONS[stationIndex].name;
    },

    /** Radio: jump to station i (wraps, so -1 is the last station). */
    setStation(i) {
      const n = STATIONS.length;
      stationIndex = ((Math.floor(i) % n) + n) % n;
      return STATIONS[stationIndex].name;
    },

    /** Radio: name of the station now playing. */
    stationName() {
      return STATIONS[stationIndex].name;
    },

    get muted() {
      return muted;
    },
    get sirenOn() {
      return sirenActive;
    },
    get station() {
      return stationIndex;
    },
  };
}
