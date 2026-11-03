import { cssVar, gsap, lenis, reduced, finePointer, scrollToTarget, ScrollTrigger, SplitText, $, $$ } from './core';
import { revealed, wipeOut } from './pixels';
import { sfx } from './sound';
import type { World } from './world';

export async function initHome() {
  const booting = runBoot();
  const world = await startWorld();
  initDrawer();
  initList();
  initDesktop();
  initStrip();
  initResurface();
  dispatchEvent(new Event('nb:ready'));
  await booting;
  await revealed;
  heroIntro();
  (await import('./letter')).initLetter();
  void world;
}

/* ---------------- boot ---------------- */
async function runBoot() {
  const el = $('[data-boot]');
  if (!el || reduced || sessionStorage.getItem('nb-booted') || location.hash) return;
  sessionStorage.setItem('nb-booted', '1');
  el.hidden = false;
  lenis?.stop();
  const lines = $$('.boot__line', el);
  const bar = $('[data-boot-bar]', el)!;
  let skip = false;
  const skipper = () => (skip = true);
  addEventListener('pointerdown', skipper, { once: true });
  addEventListener('keydown', skipper, { once: true });
  const tl = gsap.timeline();
  lines.forEach((l, i) => tl.to(l, { opacity: 1, duration: 0.01 }, i * 0.16));
  tl.to(bar, { width: '100%', duration: lines.length * 0.16 + 0.3, ease: 'steps(14)' }, 0);
  sfx.boot();
  await new Promise<void>((res) => {
    const check = () => (skip || !tl.isActive() ? res() : requestAnimationFrame(check));
    requestAnimationFrame(check);
  });
  tl.progress(1);
  await gsap.to(el, { clipPath: 'inset(0 0 100% 0)', duration: 0.5, ease: 'steps(10)' });
  el.remove();
  lenis?.start();
}

/* ---------------- the world ---------------- */
async function startWorld(): Promise<World | null> {
  const canvas = $<HTMLCanvasElement>('.world');
  if (!canvas) return null;
  let world: World;
  try {
    const { createWorld } = await import('./world');
    const lite = innerWidth < 760 || (navigator.hardwareConcurrency ?? 8) <= 4;
    world = createWorld(canvas, { lite, still: reduced });
  } catch (err) {
    console.warn('World failed to start; continuing without it.', err);
    canvas.remove();
    return null;
  }
  const paint = () => world.setColors(cssVar('--ink'), cssVar('--bg'), cssVar('--accent-ink'));
  paint();
  addEventListener('nb:theme', paint);
  addEventListener('resize', () => world.resize());

  // pointer: points part around the cursor; a click sends a ripple through the grass
  const hero = $('#surface')!;
  let onHero = false;
  addEventListener('pointermove', (e) => {
    if (!finePointer) return;
    world.setMouse((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1, onHero);
  }, { passive: true });
  hero.addEventListener('pointerenter', () => (onHero = true));
  hero.addEventListener('pointerleave', () => { onHero = false; });
  document.documentElement.addEventListener('pointerleave', () => world.clearHover());
  hero.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a, button')) return;
    world.ripple(e.clientX, e.clientY);
    sfx.thunk();
  });

  // the descent: each layer builds in, drifts up through the soil, then lifts away
  const strata = (reduced ? [] : $$('.stratum')).map((el, i, all) => {
    const at = el.dataset.at!.split(',').map(Number) as [number, number];
    const last = i === all.length - 1;
    const split = SplitText.create($('.stratum__title', el)!, { type: 'lines', mask: 'lines' });
    const video = $<HTMLVideoElement>('[data-st-video]', el);
    const build = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
      .fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.6, ease: 'power2.inOut' }, 0)
      .from($('.stratum__label', el), { opacity: 0, x: -12, duration: 0.4 }, 0.15)
      .from(split.lines, { yPercent: 105, duration: 0.6, stagger: 0.08 }, 0.2)
      .from($('.stratum__body', el), { opacity: 0, y: 14, duration: 0.5 }, 0.35)
      .from($$('[data-st-item]', el), { opacity: 0, y: 16, duration: 0.45, stagger: 0.05 }, 0.45);
    return { el, at, last, build, video, shown: false };
  });
  const meter = $('#meter');
  const meterLabel = $('#meter-label');
  const track = $('.ruler__track');
  let progress = 0;
  const fmt = (d: number) => (d >= -0.05 ? '+' : '−') + Math.abs(d).toFixed(1).padStart(5, '0');
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  const layStrata = (p: number) => {
    for (const s of strata) {
      const [a, b] = s.at;
      const t = (p - a) / (b - a); // 0 → 1 across this layer's stretch of scroll
      const on = t > 0.012 && (t < 1 || s.last); // not before the build has opened a sliver
      if (on !== s.shown) {
        s.shown = on;
        s.el.style.visibility = on ? 'visible' : 'hidden';
        if (s.video) on ? s.video.play().catch(() => {}) : s.video.pause();
      }
      if (!on) continue;
      s.build.progress(clamp01(t / 0.32));
      const out = s.last ? 0 : clamp01((t - 0.8) / 0.2);
      // slow upward drift while it's on screen: it sits in the soil, the camera keeps sinking
      const drift = (0.5 - Math.min(t, 1)) * 70 - out * 60;
      gsap.set(s.el, { opacity: 1 - out, y: drift, filter: out ? `blur(${(out * 6).toFixed(1)}px)` : 'none' });
    }
  };

  ScrollTrigger.create({
    start: 0, // the page top, not #surface: the hero moves itself (see below), which would skew its measured start
    endTrigger: '#descent',
    end: 'bottom bottom',
    onUpdate: (self) => {
      progress = self.progress;
      world.setProgress(progress);
      layStrata(progress);
    },
  });
  layStrata(0);


  // fade the world out as the archive slides over it, then stop rendering
  ScrollTrigger.create({
    trigger: '#work',
    start: 'top bottom',
    end: 'top 20%',
    onUpdate: (self) => {
      const o = 1 - self.progress;
      world.setOpacity(o);
      world.setRunning(o > 0.01);
    },
  });

  // The hero copy rides on the ground: it moves exactly as far as the field's edge does on
  // screen, with the same easing, and fades out with the field. No separate scroll speed, no lag.
  const ride = !reduced;
  let heroShift = 0;
  gsap.ticker.add(() => {
    const d = world.depth();
    if (ride) {
      heroShift = world.edgeShift();
      const camY = d + 0.92;
      const t = Math.min(1, Math.max(0, (camY + 0.35) / 1.1));
      const o = t * t * (3 - 2 * t); // eases out with the field, a touch after it
      hero.style.transform = `translate3d(0, ${(heroShift + scrollY).toFixed(2)}px, 0)`;
      hero.style.opacity = o.toFixed(3);
      hero.style.visibility = o < 0.01 ? 'hidden' : '';
    }
    if (meter) meter.textContent = fmt(d);
    if (meterLabel) meterLabel.textContent = d >= -0.05 ? 'ALT' : 'DEPTH';
    if (track) track.style.transform = `translateY(${d * 18}px)`;
  });
  return world;
}

/* ---------------- hero intro ---------------- */
function heroIntro() {
  if (reduced) return;
  const title = $('.hero__title');
  if (!title) return;
  const split = SplitText.create(title.children, { type: 'lines', mask: 'lines' });
  gsap.from(split.lines, { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.1, delay: 0.1 });
  gsap.from(['.hero__meta', '.hero__intro', '.hero__cta'], { opacity: 0, y: 12, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 0.45 });
}

/* ---------------- archive: drawer ---------------- */
function initDrawer() {
  const body = $('.archive__body');
  $$<HTMLButtonElement>('[data-view]').forEach((b) =>
    b.addEventListener('click', () => {
      body?.setAttribute('data-view-current', b.dataset.view!);
      $$('[data-view]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      sfx.click();
      ScrollTrigger.refresh();
    }),
  );

  const drawer = $('.drawer');
  if (!drawer) return;
  const items = $$('[data-info]');
  const empty = $('.info__empty');
  const show = (slug: string | null) => {
    items.forEach((i) => (i.hidden = i.dataset.info !== slug));
    if (empty) empty.hidden = !!slug;
  };

  $$('.folder.is-real').forEach((f) => {
    const a = $<HTMLAnchorElement>('.folder__hit', f)!;
    const on = () => { drawer.classList.add('is-peeking'); f.classList.add('is-hot'); show(a.dataset.slug!); sfx.open(); };
    const off = () => { drawer.classList.remove('is-peeking'); f.classList.remove('is-hot'); };
    f.addEventListener('pointerenter', on);
    f.addEventListener('pointerleave', off);
    a.addEventListener('focus', on);
    a.addEventListener('blur', off);
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      sfx.paper();
      if (reduced) { location.href = a.href; return; }
      gsap.to(f, { y: -innerHeight * 0.4, rotate: -3, duration: 0.55, ease: 'power3.in' });
      setTimeout(() => wipeOut(a.href), 260);
    });
  });
  $$('.folder.is-filler').forEach((f) =>
    f.addEventListener('click', () => {
      f.classList.remove('is-nope');
      void f.offsetWidth;
      f.classList.add('is-nope');
      sfx.nope();
    }),
  );

  if (!reduced) {
    gsap.from($$('.folder', drawer), {
      y: 90, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.03,
      scrollTrigger: { trigger: drawer, start: 'top 75%', once: true },
    });
  }
}

function initList() {
  $$('.list li').forEach((li) => {
    const img = $<HTMLImageElement>('.list__peek', li);
    if (!img) return;
    li.addEventListener('pointermove', (e) => {
      img.style.left = `${e.clientX + 24}px`;
      img.style.top = `${e.clientY - 100}px`;
    });
  });
}

/* ---------------- desktop windows ---------------- */
function initDesktop() {
  const area = $('.desk__area');
  if (!area) return;
  let z = 10;
  $$('[data-win]', area).forEach((win) => {
    const bar = $('[data-drag]', win)!;
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    const pos = { x: 0, y: 0 };
    win.addEventListener('pointerdown', () => (win.style.zIndex = String(++z)));
    bar.addEventListener('pointerdown', (e) => {
      if (innerWidth <= 1000) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY; ox = pos.x; oy = pos.y;
      bar.setPointerCapture(e.pointerId);
      win.classList.add('is-dragging');
      sfx.tick();
    });
    bar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const ar = area.getBoundingClientRect();
      const wr = win.getBoundingClientRect();
      let nx = ox + e.clientX - sx;
      let ny = oy + e.clientY - sy;
      // keep the title bar reachable
      const left = wr.left - pos.x + nx, top = wr.top - pos.y + ny;
      if (left < ar.left - wr.width + 80) nx += ar.left - wr.width + 80 - left;
      if (left > ar.right - 80) nx -= left - (ar.right - 80);
      if (top < ar.top - 10) ny += ar.top - 10 - top;
      if (top > ar.bottom - 40) ny -= top - (ar.bottom - 40);
      pos.x = Math.round(nx / 4) * 4;
      pos.y = Math.round(ny / 4) * 4;
      win.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    });
    const end = () => { dragging = false; win.classList.remove('is-dragging'); };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    // windows stack in a column below 1000px; drop any drag offset when we get there
    addEventListener('resize', () => {
      if (innerWidth > 1000 || (!pos.x && !pos.y)) return;
      pos.x = pos.y = 0;
      win.style.transform = '';
    });
  });

  if (!reduced && innerWidth > 1000) {
    gsap.from($$('[data-win]', area), {
      scale: 0.92, opacity: 0, duration: 0.5, ease: 'steps(6)', stagger: 0.12,
      scrollTrigger: { trigger: area, start: 'top 70%', once: true },
    });
  }
}

/* ---------------- 3D film strip ---------------- */
function initStrip() {
  const pin = $('[data-strip]');
  const track = $('[data-strip-track]');
  if (!pin || !track || reduced) return;
  const bar = $('[data-strip-bar]');
  const n = $('[data-strip-n]');
  const frames = $$('.w3d__frame', track);
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  // below 761px the strip is a native swipe row (CSS); matchMedia undoes the pin on the way down
  gsap.matchMedia().add('(min-width: 761px)', () => {
  gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${dist()}`,
      pin: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
      refreshPriority: 1, // created after the reveals below it, so measure it first
      onUpdate: (s) => {
        if (bar) bar.style.transform = `scaleX(${s.progress})`;
        if (n) n.textContent = String(Math.min(frames.length, Math.floor(s.progress * frames.length) + 1)).padStart(2, '0');
      },
    },
  });
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  return () => { if (bar) bar.style.transform = ''; };
  });
}

function initResurface() {
  $('[data-resurface]')?.addEventListener('click', (e) => {
    e.preventDefault();
    sfx.whoosh();
    scrollToTarget(0, { duration: 3.2, offset: 0 });
  });
}
