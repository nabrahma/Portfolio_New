import { cssVar, reduced, $$ } from './core';

// A spinning torus drawn in letters (the classic donut, with a nod to every
// 3D artist's first tutorial). Brightest characters glow in the phosphor colour.
const RAMP = '.,:-=+rskabNBKAR#@';

export function initAscii() {
  $$<HTMLCanvasElement>('[data-ascii]').forEach(run);
}

function run(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!;
  let W = 0, H = 0, cols = 0, rows = 0, cw = 0, ch = 0;
  let A = 1, B = 0.4, visible = false;
  const tilt = { x: 0, y: 0 };
  const fit = () => {
    const r = c.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    W = r.width; H = r.height;
    c.width = W * dpr; c.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cw = W < 500 ? 7.5 : 9.5;
    ch = cw * 1.6;
    cols = Math.floor(W / cw);
    rows = Math.floor(H / ch);
  };
  fit();
  new ResizeObserver(fit).observe(c);
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(c);
  c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    tilt.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    tilt.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  c.addEventListener('pointerleave', () => { tilt.x = 0; tilt.y = 0; });

  let ink = cssVar('--ink'), acc = cssVar('--accent-ink'), bg = cssVar('--bg');
  addEventListener('nb:theme', () => { ink = cssVar('--ink'); acc = cssVar('--accent-ink'); bg = cssVar('--bg'); });

  const frame = () => {
    requestAnimationFrame(frame);
    if (!visible && !reduced) return;
    const n = cols * rows;
    const z = new Float32Array(n);
    const out = new Int8Array(n).fill(-1);
    const K2 = 5, R1 = 1, R2 = 2;
    const K1 = Math.min(cols * cw, rows * ch) * K2 * 0.32 / (R1 + R2);
    const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
    for (let th = 0; th < 6.283; th += 0.07) {
      const ct = Math.cos(th), st = Math.sin(th);
      for (let ph = 0; ph < 6.283; ph += 0.022) {
        const cp = Math.cos(ph), sp = Math.sin(ph);
        const cx = R2 + R1 * ct, cy = R1 * st;
        const x = cx * (cB * cp + sA * sB * sp) - cy * cA * sB;
        const y = cx * (sB * cp - sA * cB * sp) + cy * cA * cB;
        const zz = K2 + cA * cx * sp + cy * sA;
        const ooz = 1 / zz;
        const xp = Math.floor(cols / 2 + (K1 * ooz * x) / cw);
        const yp = Math.floor(rows / 2 - (K1 * ooz * y) / ch);
        const L = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp);
        if (xp < 0 || yp < 0 || xp >= cols || yp >= rows) continue;
        const i = xp + yp * cols;
        if (ooz > z[i]) {
          z[i] = ooz;
          out[i] = Math.max(0, Math.min(RAMP.length - 1, Math.floor(((L + 1.4) / 2.8) * RAMP.length)));
        }
      }
    }
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.font = `500 ${cw * 1.3}px "Geist Mono Variable", monospace`;
    g.textBaseline = 'top';
    const ox = (W - cols * cw) / 2, oy = (H - rows * ch) / 2;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const k = out[i + j * cols];
        if (k < 0) continue;
        g.fillStyle = k >= RAMP.length - 3 ? acc : ink;
        g.globalAlpha = 0.35 + (k / RAMP.length) * 0.65;
        g.fillText(RAMP[k], ox + i * cw, oy + j * ch);
      }
    g.globalAlpha = 1;
    if (!reduced) {
      A += 0.012 + tilt.y * 0.02;
      B += 0.006 + tilt.x * 0.02;
    }
  };
  frame();
}
