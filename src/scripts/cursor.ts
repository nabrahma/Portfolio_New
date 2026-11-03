import { finePointer, gsap, reduced, $, $$ } from './core';
import { sfx } from './sound';

// A grid-snapped square cursor with a short pixel trail.
// Elements opt into states with data-cursor="link" | "draw" | "hide" | "label:Text".
export function initCursor() {
  const el = $('.cursor');
  if (!el || !finePointer) { el?.remove(); return; }
  document.documentElement.classList.add('has-cursor');

  const dot = $('.cursor__dot', el)!;
  const label = $('.cursor__label', el)!;
  const trail = $$('.cursor__trail', el);
  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const pts = trail.map(() => ({ x: pos.x, y: pos.y }));
  let shown = false;
  el.classList.add('is-hidden');

  addEventListener('pointermove', (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    if (!shown) { shown = true; el.classList.remove('is-hidden'); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { el.classList.add('is-hidden'); shown = false; });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));

  const snap = (v: number, g: number) => Math.round(v / g) * g;
  gsap.ticker.add(() => {
    el.style.transform = `translate3d(${snap(pos.x, 2)}px, ${snap(pos.y, 2)}px, 0)`;
    if (reduced) return;
    let px = pos.x, py = pos.y;
    pts.forEach((p, i) => {
      const k = 0.32 - i * 0.07;
      p.x += (px - p.x) * k;
      p.y += (py - p.y) * k;
      const t = trail[i];
      t.style.transform = `translate3d(${snap(p.x - pos.x, 6)}px, ${snap(p.y - pos.y, 6)}px, 0)`;
      t.style.opacity = String(0.45 - i * 0.13);
      px = p.x; py = p.y;
    });
  });

  let current: Element | null = null;
  document.addEventListener('pointerover', (e) => {
    const t = (e.target as Element).closest('[data-cursor], a, button, input, textarea, [role="button"], label');
    if (t === current) return;
    current = t;
    el.classList.remove('is-link', 'is-label', 'is-draw');
    el.style.visibility = '';
    if (!t) return;
    const mode = t.getAttribute('data-cursor') ?? (t.matches('input, textarea') ? 'text' : 'link');
    if (mode === 'hide') el.style.visibility = 'hidden';
    else if (mode === 'draw') el.classList.add('is-draw');
    else if (mode === 'text') { /* native caret is enough */ }
    else if (mode.startsWith('label:')) { label.textContent = mode.slice(6); el.classList.add('is-label', 'is-link'); sfx.tick(); }
    else { el.classList.add('is-link'); sfx.tick(); }
  });
  void dot;
}
