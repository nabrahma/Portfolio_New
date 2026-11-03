import { gsap, lenis, $, $$ } from './core';
import { uncover } from './pixels';

// The first-visit title card (Boot.astro). The name rises in either side of a pixel counter
// that runs toward 100 while the world is built, then the card breaks up in the page-wipe
// cells, outward from the counter.

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** `shown`: the card has finished arriving (build the heavy stuff now, while it sits still).
 *  `done`: the card has started to break up (play the hero in underneath). */
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
  const count = $('[data-boot-count]', el)!;
  const n = { v: 0 };
  const show = () => (count.textContent = String(Math.round(n.v)).padStart(3, '0'));

  const shown = (async () => {
    gsap.fromTo(count, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 1.4, ease: 'expo.out' });
    gsap.fromTo(names, { opacity: 0, yPercent: 20 }, { opacity: 1, yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.18, delay: 0.3 });
    gsap.fromTo(caption, { opacity: 0 }, { opacity: 1, duration: 1, ease: 'expo.out', delay: 0.7 });
    await gsap.to(n, { v: 64, duration: 1.4, ease: 'power1.inOut', onUpdate: show });
  })();

  const done = (async () => {
    await shown;
    // keep creeping while the world downloads and builds; it pauses during the build itself
    const creep = gsap.to(n, { v: 92, duration: 4, ease: 'power2.out', onUpdate: show });
    await Promise.race([Promise.all([ready, wait(200)]), wait(6000)]);
    creep.kill();
    gsap.to(names, { opacity: 0, yPercent: -20, duration: 0.8, ease: 'expo.out', stagger: 0.1, delay: 0.2 });
    gsap.to(caption, { opacity: 0, duration: 0.5, ease: 'expo.out', delay: 0.2 });
    await gsap.to(n, { v: 100, duration: 0.55, ease: 'power2.out', onUpdate: show });
    await wait(260);
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

  return { shown, done };
}
