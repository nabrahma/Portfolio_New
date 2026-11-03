import { gsap, lenis, $, $$ } from './core';
import { uncover } from './pixels';

// The first-visit title card (Boot.astro). It shows a still 000 while the world is built (the
// build blocks the main thread, so nothing could move then anyway), then the name rises in and
// the counter runs to 100 at one deliberate pace, never rushed by the load finishing. At 100
// the card breaks up in the page-wipe cells, outward from the counter.

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const frame = () => new Promise<number>((r) => requestAnimationFrame(r));

/** `shown`: the card is on screen (build the heavy stuff now, while it sits still).
 *  `done`: the card has started to break up (play the hero in underneath). */
export function runBoot() {
  const html = document.documentElement;
  const el = $('[data-boot]');
  if (!el || !html.classList.contains('is-booting')) {
    el?.remove();
    return { active: false, shown: Promise.resolve(), done: Promise.resolve() };
  }
  sessionStorage.setItem('nb-booted', '1');
  el.style.animation = 'none'; // the script is alive: the CSS failsafe can stand down
  // listen first: initHome fires nb:ready synchronously once the world and pins are built
  const ready = new Promise<void>((r) => addEventListener('nb:ready', () => r(), { once: true }));
  lenis?.stop();

  const names = $$('[data-boot-name]', el);
  const count = $('[data-boot-count]', el)!;
  const n = { v: 0 };
  const show = () => (count.textContent = String(Math.round(n.v)).padStart(3, '0'));

  // two frames: the 000 card is painted before the build starts
  const shown = frame().then(frame).then(() => {});

  const done = (async () => {
    await shown;
    // start once the build is through (capped, so a slow network never holds the card on 000),
    // and give the browser two quiet frames so the count starts clean
    await Promise.race([ready, wait(2500)]);
    await frame();
    await frame();
    gsap.fromTo(names, { opacity: 0, yPercent: 20 }, { opacity: 1, yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.15 });
    await gsap.to(n, { v: 100, duration: 2.4, ease: 'power2.inOut', delay: 0.25, onUpdate: show });
    await Promise.race([ready, wait(6000)]); // only if the build outlasted the count
    gsap.to(names, { opacity: 0, yPercent: -20, duration: 0.8, ease: 'expo.out', stagger: 0.1 });
    await wait(480);
    // out from the middle: the card turns into cells and they clear from the counter outward.
    // The counter stays on top a moment, light on ink, so it breaks up with the cells around it.
    void uncover(() => {
      el.style.background = 'transparent';
      el.style.pointerEvents = 'none';
      gsap.to(count, { opacity: 0, duration: 0.3, ease: 'steps(3)', delay: 0.08 });
      lenis?.start();
    }, 'centre').then(() => {
      el.remove();
      html.classList.remove('is-booting');
    });
  })();

  return { active: true, shown, done };
}
