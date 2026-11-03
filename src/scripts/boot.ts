import { gsap, lenis, $, $$ } from './core';
import { uncover } from './pixels';

// The first-visit title card (Boot.astro). The name rises in either side of a render that
// resolves from big pixels to sharp, the card holds while the world is built, then the render
// breaks back into blocks and the card dissolves in the same ink cells as the page wipe.

const STEPS = [48, 24, 12, 6, 3]; // the case-study image reveal (reveal.ts)
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** `shown`: the card has finished arriving (build the heavy stuff now, while it sits still).
 *  `done`: the card has started to dissolve (play the hero in underneath). */
export function runBoot() {
  const html = document.documentElement;
  const el = $('[data-boot]');
  if (!el || !html.classList.contains('is-booting')) {
    el?.remove();
    return { shown: Promise.resolve(), done: Promise.resolve() };
  }
  sessionStorage.setItem('nb-booted', '1');
  el.style.animation = 'none'; // the script is alive: the CSS failsafe can stand down
  // listen first: initHome fires nb:ready synchronously once the world and pins are built
  const ready = new Promise<void>((r) => addEventListener('nb:ready', () => r(), { once: true }));
  lenis?.stop();

  const names = $$('[data-boot-name]', el);
  const caption = $('[data-boot-caption]', el);
  const shot = $('[data-boot-shot]', el)!;
  const img = $<HTMLImageElement>('img', shot)!;
  const draw = painter(img, $<HTMLCanvasElement>('canvas', shot)!);

  const shown = (async () => {
    const loaded = img.complete && img.naturalWidth
      ? Promise.resolve()
      : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); });
    gsap.fromTo(shot, { scale: 1.3 }, { scale: 1, duration: 2, ease: 'expo.out' });
    gsap.fromTo(names, { opacity: 0, yPercent: 20 }, { opacity: 1, yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.18, delay: 0.3 });
    gsap.fromTo(caption, { opacity: 0 }, { opacity: 1, duration: 1, ease: 'expo.out', delay: 0.7 });
    const resolve = (async () => {
      await Promise.race([loaded, wait(1200)]);
      for (const b of STEPS) { draw(b); await wait(110); }
      draw(0);
    })();
    await Promise.all([resolve, wait(1600)]);
  })();

  const done = (async () => {
    await shown;
    await Promise.race([Promise.all([ready, wait(400)]), wait(6000)]);
    // out: the name lifts away while the render breaks back into blocks and shrinks to nothing
    gsap.to(names, { opacity: 0, yPercent: -20, duration: 0.8, ease: 'expo.out', stagger: 0.1 });
    gsap.to(caption, { opacity: 0, duration: 0.5, ease: 'expo.out' });
    const shrink = gsap.to(shot, { scale: 0, duration: 0.55, ease: 'power3.in', delay: 0.15 });
    for (const b of [...STEPS].reverse()) { draw(b); await wait(70); }
    await shrink;
    void uncover(() => {
      el.remove();
      html.classList.remove('is-booting');
      lenis?.start();
    });
  })();

  return { shown, done };
}

/** Draws the image into the canvas at a given block size (0 = show the sharp image itself). */
function painter(img: HTMLImageElement, c: HTMLCanvasElement) {
  const g = c.getContext('2d')!;
  const small = document.createElement('canvas');
  const sg = small.getContext('2d')!;
  return (block: number) => {
    if (!block || !img.naturalWidth) {
      img.style.opacity = '1';
      c.style.visibility = 'hidden';
      return;
    }
    const dpr = Math.min(devicePixelRatio, 2);
    const w = c.clientWidth, h = c.clientHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    small.width = Math.max(1, Math.round(w / block));
    small.height = Math.max(1, Math.round(h / block));
    // cover-crop, like the img's object-fit
    const s = Math.max(small.width / img.naturalWidth, small.height / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    sg.drawImage(img, (small.width - dw) / 2, (small.height - dh) / 2, dw, dh);
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, c.width, c.height);
    img.style.opacity = '0';
    c.style.visibility = 'visible';
  };
}
