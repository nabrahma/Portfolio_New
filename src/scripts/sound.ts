// Tiny synthesized UI sounds plus a quiet ambient score. Off by default; the tray toggle
// turns both on, and the choice is remembered from page to page.
import { startAmbient, stopAmbient } from './ambient';

let ctx: AudioContext | null = null;
let on = localStorage.getItem('nb-sound') === 'on';

export const soundOn = () => on;

export function setSound(v: boolean) {
  on = v;
  localStorage.setItem('nb-sound', v ? 'on' : 'off');
  if (v) startAmbient(ensure());
  else stopAmbient();
}

// Remembered as on: browsers only allow audio after a gesture on this page, so the score
// starts with the first click or key. It rests while the tab is hidden.
if (on) {
  const go = () => { if (on) startAmbient(ensure()); };
  addEventListener('pointerdown', go, { once: true });
  addEventListener('keydown', go, { once: true });
}
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else if (on) ctx.resume();
});

function ensure() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', gain = 0.04, slide = 0) {
  if (!on) return;
  const a = ensure();
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, gain = 0.05, hp = 800) {
  if (!on) return;
  const a = ensure();
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  tick: () => tone(1800, 0.025, 'square', 0.018),
  click: () => tone(620, 0.06, 'square', 0.035, -200),
  open: () => { tone(380, 0.09, 'triangle', 0.05, 340); },
  nope: () => { tone(160, 0.08, 'square', 0.035); setTimeout(() => tone(120, 0.1, 'square', 0.03), 70); },
  paper: () => noise(0.18, 0.04, 2400),
  thunk: () => { tone(90, 0.14, 'sine', 0.12, -40); noise(0.06, 0.05, 300); },
  whoosh: () => noise(0.5, 0.06, 600),
  boot: () => { tone(220, 0.08, 'square', 0.03); setTimeout(() => tone(440, 0.08, 'square', 0.03), 90); setTimeout(() => tone(880, 0.12, 'square', 0.03), 180); },
};
