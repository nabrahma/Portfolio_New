import { cssVar, lenis, reduced, $ } from './core';
import { sfx } from './sound';

// One full-screen canvas does both pixel jobs:
//  · the theme flood (cells spread from the click, minesweeper digits on the frontier)
//  · the page wipe (random cells cover on leave, dissolve on arrive)

const canvas = () => $<HTMLCanvasElement>('.pixel-wipe')!;

function setup(cell: number) {
  const c = canvas();
  const dpr = Math.min(devicePixelRatio, 2);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = Math.ceil(innerWidth / cell);
  const rows = Math.ceil(innerHeight / cell);
  return { c, g, cols, rows };
}

const frame = () => new Promise<number>((r) => requestAnimationFrame(r));

// Progress advances by frame time capped at ~30fps, so if the main thread stalls
// (the world building, a big layout) the animation pauses and resumes instead of
// jumping to the end.
async function run(duration: number, step: (p: number) => void) {
  let last = await frame();
  let t = 0;
  for (;;) {
    const now = await frame();
    t += Math.min(now - last, 34);
    last = now;
    const p = Math.min(1, t / duration);
    step(p);
    if (p >= 1) break;
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ---------------- theme flood ---------------- */

let flooding = false;

export async function themeFlood(x: number, y: number, apply: () => void) {
  if (reduced || flooding) { apply(); return; }
  flooding = true;
  sfx.click();
  const cell = innerWidth < 700 ? 22 : 30;
  const { c, g, cols, rows } = setup(cell);
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  // arrival time per cell: distance + noise, so the edge is ragged like the reference
  const arrive = new Float32Array(cols * rows);
  let max = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const d = Math.hypot(i - cx, j - cy);
      const v = d + (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453 % 1 + 1) % 1 * 5.5;
      arrive[j * cols + i] = v;
      if (v > max) max = v;
    }
  const html = document.documentElement;
  const nextDark = html.dataset.theme !== 'dark';
  const newBg = nextDark ? '#0a0a0a' : '#f1f0eb';
  const newInk = nextDark ? '#ecebe6' : '#0b0b0b';
  const acc = cssVar('--accent');
  c.style.background = 'transparent';
  g.font = `${Math.round(cell * 0.5)}px "Departure Mono", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const filled = (i: number, j: number, r: number) => i >= 0 && j >= 0 && i < cols && j < rows && arrive[j * cols + i] <= r;

  await run(560, (p) => {
    const r = p * (max + 1);
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.fillStyle = newBg;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) if (arrive[j * cols + i] <= r) g.fillRect(i * cell, j * cell, cell, cell);
    // frontier digits: count filled neighbours, like minesweeper
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        if (filled(i, j, r)) continue;
        let n = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && filled(i + di, j + dj, r)) n++;
        if (!n) continue;
        g.fillStyle = nextDark ? newBg : newInk;
        g.globalAlpha = 0.9;
        g.fillRect(i * cell + 1, j * cell + 1, cell - 2, cell - 2);
        g.globalAlpha = 1;
        g.fillStyle = n >= 4 ? acc : nextDark ? newInk : newBg;
        g.fillText(String(n), i * cell + cell / 2, j * cell + cell / 2 + 1);
      }
  });
  apply();
  // dissolve the cover to reveal the page in its new theme
  const order = shuffled(cols * rows);
  await run(320, (p) => {
    const n = Math.floor(p * order.length);
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.fillStyle = newBg;
    for (let k = n; k < order.length; k++) {
      const idx = order[k];
      g.fillRect((idx % cols) * cell, Math.floor(idx / cols) * cell, cell, cell);
    }
  });
  g.clearRect(0, 0, innerWidth, innerHeight);
  flooding = false;
}

function shuffled(n: number) {
  const a = new Uint32Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  for (let i = n - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ---------------- page wipe ---------------- */

let leaving = false;

export async function wipeOut(href: string) {
  if (reduced) { location.href = href; return; }
  if (leaving) return;
  leaving = true;
  document.documentElement.classList.add('is-wiping');
  sfx.whoosh();
  const cell = innerWidth < 700 ? 28 : 40;
  const { g, cols, rows } = setup(cell);
  const ink = cssVar('--ink');
  // sweep upward with jitter: rows from the bottom fill first
  const t = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) t[j * cols + i] = (rows - 1 - j) / rows * 0.7 + Math.random() * 0.3;
  await run(420, (p) => {
    g.fillStyle = ink;
    for (let k = 0; k < t.length; k++) if (t[k] <= p) g.fillRect((k % cols) * cell, Math.floor(k / cols) * cell, cell, cell);
  });
  sessionStorage.setItem('nb-wipe', '1');
  sessionStorage.setItem('nb-booted', '1'); // moving around inside the OS: no boot screen
  location.href = href;
}

let markRevealed!: () => void;
/** Resolves when the arriving page starts to show (immediately if there was no wipe). */
export const revealed = new Promise<void>((r) => (markRevealed = r));

export async function wipeIn(ready: Promise<unknown> = Promise.resolve()) {
  const html = document.documentElement;
  sessionStorage.removeItem('nb-wipe');
  if (!html.classList.contains('is-arriving')) { markRevealed(); return; }
  // Keep the page covered while it builds itself (world, pins, fonts), capped so the
  // cover can never stick, then give the browser two quiet frames before animating.
  await Promise.race([ready, wait(2500)]);
  await frame();
  await frame();
  await uncover(() => {
    html.classList.remove('is-arriving');
    markRevealed();
  });
}

/** Covers the screen in ink cells, runs `swap` underneath, then dissolves the cells:
 *  bottom-up like the page wipe, or outward from the middle of the screen. */
export async function uncover(swap: () => void, from: 'bottom' | 'centre' = 'bottom') {
  const cell = innerWidth < 700 ? 28 : 40;
  const { c, g, cols, rows } = setup(cell);
  const ink = cssVar('--ink');
  g.fillStyle = ink;
  g.fillRect(0, 0, innerWidth, innerHeight);
  swap();
  c.style.background = 'transparent';
  const t = new Float32Array(cols * rows);
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2, far = Math.hypot(cx, cy) || 1;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      t[j * cols + i] = from === 'centre'
        ? Math.hypot(i - cx, j - cy) / far * 0.72 + Math.random() * 0.28
        : (rows - 1 - j) / rows * 0.7 + Math.random() * 0.3;
  await run(from === 'centre' ? 640 : 520, (p) => {
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.fillStyle = ink;
    for (let k = 0; k < t.length; k++) if (t[k] > p) g.fillRect((k % cols) * cell, Math.floor(k / cols) * cell, cell, cell);
  });
  g.clearRect(0, 0, innerWidth, innerHeight);
}

export function initLinks() {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest('a');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download') || a.dataset.noWipe !== undefined) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) return; // in-page anchors handled elsewhere
    if (url.pathname === location.pathname && url.search === location.search) {
      // already here (the logo on the home page): glide to the top, no reload
      e.preventDefault();
      if (lenis) lenis.scrollTo(0, { duration: Math.min(2.4, 0.6 + scrollY / 4000) });
      else scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      return;
    }
    if (/\.(pdf|webm|mp4|png|jpg|zip)$/i.test(url.pathname)) return;
    if (url.pathname.startsWith('/resume')) return; // a plain document page, outside the OS chrome
    e.preventDefault();
    wipeOut(url.href);
  });
  addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) {
      leaving = false;
      document.documentElement.classList.remove('is-wiping', 'is-arriving');
      const c = canvas();
      c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    }
  });
}
