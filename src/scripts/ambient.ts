// A quiet generative score, synthesized live: a desert-sized drone underneath (low saws, a
// throat-sung vowel, wind), sparse 8-bit notes echoing off the walls on top, and every so
// often a slow, soft swell. D minor with a Phrygian E♭ for the sand. Meant to sit far back.

let nodes: { stop: () => void } | null = null;

export function startAmbient(a: AudioContext) {
  if (nodes) return;
  const t0 = a.currentTime;
  const out = a.createGain();
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(0.3, t0 + 6); // a slow fade in; never loud
  const tone = a.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2600;
  tone.connect(out).connect(a.destination);

  // a long, dark room: a generated impulse response
  const verb = a.createConvolver();
  verb.buffer = impulse(a, 6.5, 2.6);
  const wet = a.createGain();
  wet.gain.value = 0.55;
  verb.connect(wet).connect(tone);
  const dry = a.createGain();
  dry.gain.value = 0.6;
  dry.connect(tone);
  const send = (n: AudioNode, w = 1, d = 1) => {
    if (w) { const g = a.createGain(); g.gain.value = w; n.connect(g).connect(verb); }
    if (d) { const g = a.createGain(); g.gain.value = d; n.connect(g).connect(dry); }
  };

  const live: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const osc = (type: OscillatorType, f: number, detune = 0) => {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.start();
    live.push(o);
    return o;
  };
  const lfo = (rate: number, depth: number, target: AudioParam) => {
    const o = osc('sine', rate);
    const g = a.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
  };

  // 1 · the drone: two detuned saws on D, a fifth, a sub, under a slowly breathing filter
  const D1 = 36.71, A1 = 55, D2 = 73.42;
  const droneF = a.createBiquadFilter();
  droneF.type = 'lowpass';
  droneF.frequency.value = 260; // enough upper harmonics to carry on laptop speakers
  droneF.Q.value = 0.7;
  lfo(0.021, 90, droneF.frequency);
  const droneG = a.createGain();
  droneG.gain.value = 0.32;
  lfo(0.013, 0.08, droneG.gain);
  for (const [f, d, g] of [[D1, -6, 0.5], [D1, 7, 0.5], [A1, 3, 0.18], [D2, -4, 0.22]] as const) {
    const o = osc('sawtooth', f, d);
    const og = a.createGain();
    og.gain.value = g;
    o.connect(og).connect(droneF);
  }
  const sub = osc('sine', D1);
  const subG = a.createGain();
  subG.gain.value = 0.35;
  sub.connect(subG).connect(droneG);
  droneF.connect(droneG);
  send(droneG, 0.5, 0.8);

  // 2 · a throat-sung vowel: a saw through two moving formants, drifting between "oo" and "ah"
  const voice = osc('sawtooth', D2, 0);
  lfo(0.09, 3, voice.detune);
  const voiceG = a.createGain();
  voiceG.gain.value = 0.0;
  const f1 = a.createBiquadFilter(), f2 = a.createBiquadFilter();
  for (const f of [f1, f2]) { f.type = 'bandpass'; f.Q.value = 9; }
  f1.frequency.value = 420; f2.frequency.value = 820;
  lfo(0.031, 160, f1.frequency);
  lfo(0.027, 260, f2.frequency);
  voice.connect(f1).connect(voiceG);
  voice.connect(f2).connect(voiceG);
  // it breathes in and out over ~40 s
  const breathe = () => {
    if (!nodes) return;
    const t = a.currentTime;
    voiceG.gain.cancelScheduledValues(t);
    voiceG.gain.setValueAtTime(voiceG.gain.value, t);
    voiceG.gain.linearRampToValueAtTime(0.11, t + 14);
    voiceG.gain.linearRampToValueAtTime(0.0, t + 30);
    timers.push(window.setTimeout(breathe, 38000 + Math.random() * 14000));
  };
  send(voiceG, 0.8, 0.3);

  // 3 · wind across sand: soft noise through a wandering band
  const wind = a.createBufferSource();
  wind.buffer = pink(a, 4);
  wind.loop = true;
  wind.start();
  live.push(wind);
  const windF = a.createBiquadFilter();
  windF.type = 'bandpass';
  windF.frequency.value = 520;
  windF.Q.value = 0.8;
  lfo(0.017, 300, windF.frequency);
  const windG = a.createGain();
  windG.gain.value = 0.05;
  lfo(0.04, 0.025, windG.gain);
  wind.connect(windF).connect(windG);
  send(windG, 0.6, 0.6);

  // 4 · retro: sparse square-wave notes, echoing (D minor pentatonic + the E♭)
  const delay = a.createDelay(2);
  delay.delayTime.value = 0.42;
  const fb = a.createGain();
  fb.gain.value = 0.42;
  const dTone = a.createBiquadFilter();
  dTone.type = 'lowpass';
  dTone.frequency.value = 1400;
  delay.connect(dTone).connect(fb).connect(delay);
  const notesBus = a.createGain();
  notesBus.gain.value = 1;
  notesBus.connect(delay);
  send(notesBus, 0.7, 0.25);
  send(dTone, 0.5, 0.35);
  const scale = [293.66, 311.13, 349.23, 392, 440, 523.25, 587.33, 698.46];
  const blip = () => {
    if (!nodes) return;
    const t = a.currentTime + 0.05;
    const f = scale[Math.floor(Math.random() * scale.length)] / (Math.random() < 0.35 ? 2 : 1);
    const o = a.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    const g = a.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.022, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(lp).connect(g).connect(notesBus);
    o.start(t);
    o.stop(t + 1.2);
    // now and then, a second note a fifth or an octave up
    if (Math.random() < 0.3) timers.push(window.setTimeout(() => nodes && blipAt(f * (Math.random() < 0.5 ? 1.5 : 2)), 420));
    timers.push(window.setTimeout(blip, 2200 + Math.random() * 4200));
  };
  const blipAt = (f: number) => {
    const t = a.currentTime + 0.02;
    const o = a.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const g = a.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.012, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(notesBus);
    o.start(t);
    o.stop(t + 1);
  };

  // 5 · a rare swell: brass-ish saws on D and A, the filter opening slowly, then closing
  const swell = () => {
    if (!nodes) return;
    const t = a.currentTime + 0.1;
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(90, t);
    f.frequency.linearRampToValueAtTime(620, t + 5);
    f.frequency.linearRampToValueAtTime(90, t + 11);
    const g = a.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 5);
    g.gain.linearRampToValueAtTime(0, t + 11);
    for (const [fr, dt] of [[D2, -8], [D2, 9], [110, 0], [D2 * 2, 4]] as const) {
      const o = a.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = fr;
      o.detune.value = dt;
      o.connect(f);
      o.start(t);
      o.stop(t + 11.2);
    }
    f.connect(g);
    send(g, 0.9, 0.4);
    timers.push(window.setTimeout(swell, 45000 + Math.random() * 30000));
  };

  const timers: number[] = [];
  nodes = {
    stop() {
      timers.forEach(clearTimeout);
      const t = a.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 1.6);
      window.setTimeout(() => { live.forEach((n) => { try { n.stop(); } catch {} }); out.disconnect(); }, 1800);
    },
  };
  timers.push(window.setTimeout(breathe, 4000));
  timers.push(window.setTimeout(blip, 3000));
  timers.push(window.setTimeout(swell, 20000 + Math.random() * 10000));
}

export function stopAmbient() {
  nodes?.stop();
  nodes = null;
}

function impulse(a: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function pink(a: AudioContext, seconds: number) {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
  }
  return buf;
}
