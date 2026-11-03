import { cssVar, gsap, lenis, reduced, $ } from './core';
import { sfx } from './sound';

// The first-visit boot: a buzzing CRT channel (CSS, see Boot.astro) while the world loads,
// then the static falls into a black hole at the centre and the page comes back out of it.

const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
async function run(ms: number, step: (t: number) => void) {
  // frame-capped time, like the page wipes: a stalled frame pauses the effect instead of skipping it
  let last = await frame(), t = 0;
  for (;;) {
    const now = await frame();
    t += Math.min(now - last, 34);
    last = now;
    const p = Math.min(1, t / ms);
    step(p);
    if (p >= 1) break;
  }
}

export async function runBoot() {
  const html = document.documentElement;
  const el = $('[data-boot]');
  if (!el || !html.classList.contains('is-booting')) { el?.remove(); return; }
  sessionStorage.setItem('nb-booted', '1');
  el.style.animation = 'none'; // the script is alive: the CSS failsafe can stand down
  // listen first: initHome fires nb:ready synchronously once the world and pins are built
  const ready = new Promise<void>((r) => addEventListener('nb:ready', () => r(), { once: true }));
  lenis?.stop();
  sfx.boot();

  // the readout creeps toward 90 while we wait, then completes
  const pct = $('[data-boot-pct]', el);
  let shown = 0, done = false;
  const tickPct = () => {
    shown += ((done ? 100 : 90) - shown) * (done ? 0.35 : 0.04);
    if (pct) pct.textContent = String(Math.min(99, Math.floor(shown))).padStart(2, '0');
    if (!done || shown < 99.5) requestAnimationFrame(tickPct);
  };
  requestAnimationFrame(tickPct);

  const minTime = new Promise((r) => setTimeout(r, 1300));
  await Promise.race([Promise.all([ready, minTime]), new Promise((r) => setTimeout(r, 6000))]);
  done = true;
  await new Promise((r) => setTimeout(r, 260));
  if (pct) pct.textContent = '100';

  await collapse(el);
  el.remove();
  html.classList.remove('is-booting');
  lenis?.start();
}

async function collapse(el: HTMLElement) {
  const canvas = $<HTMLCanvasElement>('.boot__fx', el)!;
  const dpr = Math.min(devicePixelRatio, 2);
  const W = innerWidth, H = innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ink = cssVar('--ink'), bg = cssVar('--bg'), acc = cssVar('--accent');
  const cx = W / 2, cy = H / 2;
  const reach = Math.hypot(cx, cy);

  // the static becomes particles: same 3px grains, same density feel
  const n = Math.round(Math.min(26000, (W * H) / 60));
  const r0 = new Float32Array(n), a0 = new Float32Array(n), al = new Float32Array(n), dl = new Float32Array(n), hot = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    r0[i] = Math.hypot(x - cx, y - cy);
    a0[i] = Math.atan2(y - cy, x - cx);
    al[i] = 0.25 + Math.random() * 0.75;
    dl[i] = (r0[i] / reach) * 0.42 + Math.random() * 0.12; // the inside falls first; the edges trail in
    hot[i] = Math.random() < 0.22 ? 1 : 0;
  }
  // hand over from the CSS static to the canvas in one frame
  for (const c of el.querySelectorAll<HTMLElement>('.boot__noise, .boot__roll, .boot__label')) c.style.visibility = 'hidden';
  sfx.whoosh();

  // 1 · infall: everything spirals inward, faster and tighter the closer it gets
  await run(1050, (p) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const pull = p * p;
    for (let i = 0; i < n; i++) {
      const t = Math.min(1, Math.max(0, (p - dl[i]) / (1 - dl[i])));
      const e = t * t * t;
      const r = r0[i] * (1 - e);
      if (r < 1.2) continue;
      // a log spiral: the closer it gets, the faster it winds, so the field draws into arms
      const a = a0[i] + 1.15 * Math.log((r0[i] + 6) / (r + 6)) + e * 0.6;
      const s = 3 * (1 - e * 0.6);
      g.globalAlpha = al[i] * (0.4 + 0.6 * (1 - e));
      g.fillStyle = hot[i] && e > 0.35 ? acc : ink;
      g.fillRect(cx + Math.cos(a) * r - s / 2, cy + Math.sin(a) * r * 0.92 - s / 2, s, s);
    }
    // the singularity: a pinpoint that brightens as the matter arrives
    g.globalAlpha = Math.min(1, pull * 1.4);
    g.fillStyle = acc;
    const core = 1 + pull * 3;
    g.fillRect(cx - core, cy - core, core * 2, core * 2);
    g.globalAlpha = 1;
  });

  // 2 · and out the other side, like a stone dropped in water: the page opens from the point in
  // a set of rings that travel outward together and fade, and it settles with a damped wobble
  el.style.background = 'transparent';
  // scale the page around the middle of the screen (main is thousands of px tall, so its own
  // centre is far below the fold); the menu and status bars stay put
  const main = $('#main');
  if (main && !reduced) {
    gsap.fromTo(main, { scale: 1.07, transformOrigin: `50% ${scrollY + innerHeight / 2}px` }, { scale: 1, duration: 1.6, ease: 'elastic.out(1, 0.42)', clearProps: 'transform,transformOrigin' });
  }
  sfx.thunk();
  const rings = 5;
  await run(1250, (p) => {
    const e = 1 - Math.pow(1 - p, 2.4);
    const R = e * reach * 1.12; // the leading crest; the page shows inside it
    g.clearRect(0, 0, W, H);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    // the ripples: evenly spaced behind the crest, each weaker than the one before, and the
    // whole train fading as it spreads, like water losing its energy
    const gap = 26 + e * 70;
    for (let k = 0; k < rings; k++) {
      const r = R - k * gap;
      if (r <= 2) continue;
      const strength = (1 - p) * Math.pow(0.62, k);
      g.globalAlpha = strength;
      g.strokeStyle = k === 0 ? acc : ink;
      g.lineWidth = (k === 0 ? 2.4 : 1.3) * (1 - p * 0.6);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      // a soft trough just inside each crest, so it reads as a wave, not a line
      g.globalAlpha = strength * 0.18;
      g.lineWidth = gap * 0.35;
      g.strokeStyle = ink;
      g.beginPath();
      g.arc(cx, cy, Math.max(1, r - gap * 0.3), 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}
