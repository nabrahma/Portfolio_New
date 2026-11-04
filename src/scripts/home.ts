import { cssVar, gsap, lenis, reduced, finePointer, scrollToTarget, ScrollTrigger, SplitText, $, $$ } from './core';
import { revealed, wipeOut } from './pixels';
import { runBoot } from './boot';
import { sfx } from './sound';
import type { World } from './world';

export async function initHome() {
  const boot = runBoot();
  void import('./world'); // start fetching now; building it waits until the title card sits still
  await boot.shown;
  const world = await startWorld();
  initDrawer();
  initList();
  initDesktop();
  initStrip();
  initResurface();
  dispatchEvent(new Event('nb:ready'));
  if (boot.active && world) {
    // the card covers the world: let it draw one frame (compiling its shaders), then rest it
    // until the card breaks up, so the counter has the main thread to itself
    await new Promise((r) => requestAnimationFrame(r));
    world.setRunning(false);
    void boot.done.then(() => world.setRunning(true));
  }
  await boot.done;
  await revealed;
  void heroIntro();
  (await import('./letter')).initLetter();
  void world;
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

  const phone = matchMedia('(max-width: 760px)').matches;
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
      // phones have less scroll per layer, so the card builds faster and holds longer
      s.build.progress(clamp01(t / (phone ? 0.18 : 0.32)));
      const out = s.last ? 0 : phone ? clamp01((t - 0.86) / 0.14) : clamp01((t - 0.8) / 0.2);
      // slow upward drift while it's on screen: it sits in the soil, the camera keeps sinking.
      // Phones get a shorter drift (the card sits near the bottom bar) and no blur, which is
      // the expensive part of the exit on a phone's GPU
      const drift = (0.5 - Math.min(t, 1)) * (phone ? 28 : 70) - out * (phone ? 40 : 60);
      gsap.set(s.el, { opacity: 1 - out, y: drift, filter: out && !phone ? `blur(${(out * 6).toFixed(1)}px)` : 'none' });
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
      const gone = o < 0.01;
      hero.style.transform = gone ? 'none' : `translate3d(0, ${(heroShift + scrollY).toFixed(2)}px, 0)`;
      hero.style.opacity = o.toFixed(3);
      hero.style.visibility = gone ? 'hidden' : '';
    }
    if (meter) meter.textContent = fmt(d);
    if (meterLabel) meterLabel.textContent = d >= -0.05 ? 'ALT' : 'DEPTH';
    if (track) track.style.transform = `translateY(${d * 18}px)`;
  });
  return world;
}

/* ---------------- hero intro ---------------- */
async function heroIntro() {
  if (reduced) return;
  const title = $('.hero__title');
  if (!title) return;
  // split with the real font in place, or the lines are measured in the fallback and re-wrap later
  await document.fonts.ready;
  if (matchMedia('(max-width: 560px)').matches) {
    // on a phone the headline is one balanced sentence (Hero.astro); splitting it into lines
    // undoes the balance, so it rises in as one block
    gsap.from(title, { opacity: 0, y: 28, duration: 1.2, ease: 'expo.out', delay: 0.1 });
  } else {
    const split = SplitText.create(title.children, { type: 'lines', mask: 'lines' });
    gsap.from(split.lines, { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.1, delay: 0.1 });
  }
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
      // the list has no scene: drop the drawer's pin (and its scroll length) while it's hidden
      if (scene) b.dataset.view === 'list' ? scene.disable(true) : scene.enable();
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

  const mm = gsap.matchMedia();
  // a wide screen gets the whole scroll scene; a tablet's drawer just rises in
  mm.add('(min-width: 1101px) and (prefers-reduced-motion: no-preference)', () => initDrawerScene(drawer));
  mm.add('(max-width: 1100px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.from($$('.folder', drawer), {
      y: 90, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.03,
      scrollTrigger: { trigger: drawer, start: 'top 75%', once: true },
    });
  });
}

/* The drawer as an exploded product drawing, played by the scroll. Pinned, it goes:
   closed (just the front panel) → the folders rise out of it → the camera orbits to a
   three-quarter view and the parts pull apart along the drawer's depth, with callouts →
   it files itself back together → slides into its column as Get Info arrives.
   Everything is a pure function of one smoothed progress value, so scrubbing back and
   forth (or a resize) can never leave a part stranded. */
let scene: ScrollTrigger | null = null;

function initDrawerScene(drawer: HTMLElement) {
  const wrap = drawer.closest<HTMLElement>('.drawer-wrap')!;
  const xpl = $('[data-xpl]', wrap)!;
  const stack = $('.drawer__stack', drawer)!;
  const folders = $$('.folder', drawer);
  const real = folders.map((f) => f.classList.contains('is-real'));
  const front = $('.drawer__front', drawer)!;
  const walls = $<SVGElement>('.drawer__walls', drawer)!;
  const tray = $('.drawer__tray', drawer)!;
  const info = $('.info', wrap);
  const hud = $('.xpl__hud', xpl)!;
  const phaseEl = $('.xpl__phase', xpl)!;
  const phase = $('[data-xpl-phase]', xpl)!;
  const pct = $('[data-xpl-pct]', xpl)!;
  const cue = $('.xpl__cue', xpl)!;
  const tags = ['a', 'b', 'c', 'd'].map((k) => $(`[data-tag="${k}"]`, xpl)!);
  const wires = ['a', 'b', 'c', 'd'].map((k) => {
    const g = $<SVGGElement>(`[data-wire="${k}"]`, xpl)!;
    return { g, line: g.querySelector('polyline')!, dot: g.querySelector('circle')! };
  });
  // what each callout points at: the front panel, the back folder, a real folder, a near filler
  const N = folders.length;
  const realIdx = real.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
  const fillIdx = real.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
  const targets = [
    front,
    $('.folder__tab', folders[1])!,
    $('.folder__tab', folders[realIdx[Math.floor(realIdx.length / 2)]])!,
    $('.folder__tab', folders[fillIdx[fillIdx.length - 3]])!,
  ];
  const slots = [0.74, 0.2, 0.24, 0.7]; // callouts' heights, as a share of the visible stage

  const GAP = 46, LIFT = 64, RX = -28, RY = 30, SS = 0.56;
  const mid = (N - 1) / 2;
  const io = gsap.parseEase('power3.inOut');
  const out = gsap.parseEase('power2.out');
  const seg = (u: number, a: number, b: number) => Math.min(1, Math.max(0, (u - a) / (b - a)));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // geometry, re-read on every refresh (layout offsets ignore transforms, so this is safe mid-scene)
  const g = { barH: 36, avail: 800, off: 0, top: 0, vc: 400, tops: [] as number[], C: 0, fTop: 0, fC: 0, dx: 0, zB: 0, zF: 0 };
  const measure = () => {
    g.barH = parseFloat(cssVar('--bar-h')) || 36;
    g.avail = innerHeight - g.barH - 28; // between the menu bar and the status bar
    // when the drawer is taller than the stage, crop its empty top margin first
    g.off = Math.max(0, Math.min(140, wrap.offsetHeight - g.avail));
    g.top = g.barH - g.off + drawer.offsetTop; // the drawer's top on screen while pinned
    g.vc = g.barH + g.avail / 2;
    g.tops = folders.map((f) => stack.offsetTop + f.offsetTop);
    g.C = g.tops.reduce((a, b) => a + b, 0) / N + 75; // the exploded row's centre line
    g.fTop = front.offsetTop;
    g.fC = g.fTop + front.offsetHeight / 2;
    const wr = wrap.getBoundingClientRect();
    g.dx = innerWidth / 2 - (wr.left + drawer.offsetLeft + drawer.offsetWidth / 2);
    g.zB = -mid * GAP - 70;
    g.zF = (N - 1 - mid) * GAP + 110;
    drawer.style.setProperty('--oy', `${g.C}px`);
    tray.style.height = `${g.zF + 40 - g.zB}px`;
  };

  let last = -1;
  const render = (p: number) => {
    if (p === last) return;
    last = p;
    const u = p * 10;
    const o = io(seg(u, 0.3, 2.6)); // open: closed → assembled
    const x = io(seg(u, 2.4, 4.6)) - io(seg(u, 6.4, 8.6)); // exploded amount, up and back down
    const d = io(seg(u, 8.5, 9.7)); // docked into its column
    const spin = (seg(u, 2.4, 8.6) - 0.5) * -14 * x; // a slow orbit while it's apart, so it never sits dead

    const closedY = g.vc - (g.top + g.fC);
    const explY = g.vc - (g.top + g.C);
    drawer.style.setProperty('--sx', (g.dx * (1 - d)).toFixed(2));
    drawer.style.setProperty('--sy', lerp(lerp(closedY, 0, o), explY, x).toFixed(2));
    drawer.style.setProperty('--rx', (RX * x).toFixed(3));
    drawer.style.setProperty('--ry', (RY * x + spin).toFixed(3));
    drawer.style.setProperty('--ss', lerp(1, SS, x).toFixed(4));
    drawer.classList.toggle('is-scene', u > 2.3 && u < 8.7);
    drawer.classList.toggle('is-x', u > 3.9 && u < 7);
    drawer.classList.toggle('is-busy', u < 9.8);

    folders.forEach((f, i) => {
      // front folders lift out of the drawer first, the back ones travel furthest
      const a = 0.3 + (N - 1 - i) * 0.045;
      const oi = io(seg(u, a, a + 1.2));
      const closed = g.fTop + 10 - g.tops[i];
      const row = g.C - 75 - g.tops[i] - (real[i] ? LIFT : 0);
      const y = lerp(closed, 0, oi) + row * x;
      const z = (i - mid) * GAP * x;
      f.style.transform = `translate3d(0, ${y.toFixed(2)}px, ${z.toFixed(2)}px)`;
      f.style.opacity = String(Math.min(1, oi * 3));
    });
    front.style.transform = `translate3d(0, ${((g.C + 40 - g.fC) * x).toFixed(2)}px, ${(g.zF * x).toFixed(2)}px)`;
    // the sides arrive once the folders are up, and leave as soon as the camera starts to turn
    walls.style.opacity = String(seg(u, 1.8, 2.6) * (1 - Math.min(1, x * 5)));
    tray.style.opacity = String(x);
    tray.style.transform = `translate3d(0, ${(g.C + 75).toFixed(2)}px, ${(g.zB * x).toFixed(2)}px) rotateX(90deg) scaleY(${Math.max(0.001, x).toFixed(4)})`;
    if (info) {
      info.style.opacity = String(d);
      info.style.transform = `translateX(${(60 * (1 - d)).toFixed(2)}px)`;
    }

    // the drawing's furniture: title, phase readout, the first nudge, the callouts
    const furniture = 1 - d;
    const wr = wrap.getBoundingClientRect();
    hud.style.opacity = phaseEl.style.opacity = String(furniture);
    hud.style.top = phaseEl.style.top = `${g.barH + 18 - wr.top}px`;
    cue.style.opacity = String(1 - seg(u, 0.1, 0.8));
    cue.style.top = `${g.barH + g.avail - 34 - wr.top}px`;
    phase.textContent = u < 0.3 ? 'Closed' : u < 2.6 ? 'Opening' : u < 4.6 ? 'Taking it apart' : u < 6.4 ? 'Exploded view' : u < 8.6 ? 'Filing it back' : 'Filed';
    pct.textContent = String(Math.round(p * 100)).padStart(3, '0');

    tags.forEach((tag, k) => {
      const t = out(seg(u, 4 + k * 0.22, 4.6 + k * 0.22)) * (1 - seg(u, 6.2, 6.7));
      tag.style.opacity = String(t);
      tag.style.translate = `${(tag.classList.contains('is-left') ? -16 : 16) * (1 - t)}px 0`;
      const w = wires[k];
      w.g.style.opacity = String(t);
      if (t <= 0) return;
      const top = g.barH + g.avail * slots[k] - wr.top - tag.offsetHeight / 2;
      tag.style.top = `${top.toFixed(1)}px`;
      const r = targets[k].getBoundingClientRect();
      const left = tag.classList.contains('is-left');
      const tx = (k === 0 ? r.left + r.width * 0.12 : r.left + r.width / 2) - wr.left;
      const ty = r.top + r.height / 2 - wr.top;
      const sx = left ? tag.offsetWidth + 10 : wrap.offsetWidth - tag.offsetWidth - 10;
      const sy = top + 22;
      const ex = sx + (left ? 28 : -28);
      // the wire draws itself from the callout towards the part
      const fx = lerp(ex, tx, t), fy = lerp(sy, ty, t);
      w.line.setAttribute('points', `${sx},${sy} ${ex},${sy} ${fx.toFixed(1)},${fy.toFixed(1)}`);
      w.dot.setAttribute('cx', fx.toFixed(1));
      w.dot.setAttribute('cy', fy.toFixed(1));
    });
  };

  xpl.hidden = false;
  drawer.classList.add('is-staged');
  measure();
  const proxy = { p: 0 };
  const tween = gsap.to(proxy, {
    p: 1,
    ease: 'none',
    onUpdate: () => render(proxy.p),
    scrollTrigger: {
      trigger: wrap,
      start: () => `top+=${g.off} ${g.barH}px`,
      end: () => `+=${Math.round(innerHeight * 3.2)}`,
      pin: true,
      scrub: 0.9,
      anticipatePin: 1,
      refreshPriority: 2, // created before the reveals and pins below it: measure it first
      onRefreshInit: measure,
      onRefresh: () => { last = -1; render(proxy.p); },
    },
  });
  scene = tween.scrollTrigger!;
  render(0);
  ScrollTrigger.sort();
  ScrollTrigger.refresh();

  return () => {
    scene = null;
    tween.scrollTrigger?.kill();
    tween.kill();
    xpl.hidden = true;
    drawer.classList.remove('is-staged', 'is-scene', 'is-x', 'is-busy');
    for (const el of [...folders, front, tray, walls as unknown as HTMLElement, ...(info ? [info] : [])]) {
      el.style.transform = '';
      el.style.opacity = '';
    }
  };
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
