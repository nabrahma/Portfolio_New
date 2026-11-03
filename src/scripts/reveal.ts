import { gsap, ScrollTrigger, SplitText, reduced, $$ } from './core';

export function initReveals() {
  initScramble();
  if (reduced) {
    $$('[data-count]').forEach((el) => (el.textContent = el.dataset.count!));
    return;
  }
  initFades();
  initSplits();
  initCounts();
  initPixelImages();
  initParallax();
  initBars();
}

/* fade-up blocks */
function initFades() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      const el = e.target as HTMLElement;
      const d = Number(el.dataset.revealDelay ?? 0);
      setTimeout(() => el.classList.add('is-in'), d);
      io.unobserve(el);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal]').forEach((el) => io.observe(el));
}

/* headings rise line by line out of a mask */
function initSplits() {
  document.fonts.ready.then(() => {
    $$('[data-split]').forEach((el) => {
      const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
      gsap.from(split.lines, {
        yPercent: 105,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });
  });
}

/* numbers count up once, keeping their format: 10,657 · 2.50 · 30 s */
function initCounts() {
  $$('[data-count]').forEach((el) => {
    const raw = el.dataset.count!;
    const m = raw.match(/[\d,.]+/);
    if (!m) return;
    const numStr = m[0];
    const target = parseFloat(numStr.replace(/,/g, ''));
    const decimals = (numStr.split('.')[1] ?? '').length;
    const comma = numStr.includes(',');
    const [pre, post] = [raw.slice(0, m.index), raw.slice(m.index! + numStr.length)];
    const o = { v: 0 };
    const fmt = (v: number) => {
      let s = v.toFixed(decimals);
      if (comma) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      return pre + s + post;
    };
    el.textContent = fmt(0);
    gsap.to(o, {
      v: target,
      duration: Math.min(2.2, 0.8 + Math.log10(target + 1) * 0.35),
      ease: 'power3.out',
      onUpdate: () => (el.textContent = fmt(o.v)),
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
}

/* images resolve from big pixels to sharp: 48 → 24 → 12 → 6 → 3 → crisp */
function initPixelImages() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      io.unobserve(e.target);
      const img = e.target.querySelector('img');
      if (!img) continue;
      if (img.complete && img.naturalWidth) pixelate(e.target as HTMLElement, img);
      else img.addEventListener('load', () => pixelate(e.target as HTMLElement, img), { once: true });
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('[data-pixel]').forEach((el) => { el.classList.add('px-wait'); io.observe(el); });
}

function pixelate(host: HTMLElement, img: HTMLImageElement) {
  const r = img.getBoundingClientRect();
  if (!r.width) { host.classList.remove('px-wait'); return; }
  const c = document.createElement('canvas');
  const dpr = Math.min(devicePixelRatio, 2);
  c.width = Math.round(r.width * dpr);
  c.height = Math.round(r.height * dpr);
  c.className = 'px-canvas';
  c.style.cssText = `position:absolute;left:${img.offsetLeft}px;top:${img.offsetTop}px;width:${r.width}px;height:${r.height}px;pointer-events:none;image-rendering:pixelated;`;
  img.parentElement!.style.position ||= 'relative';
  img.after(c);
  const g = c.getContext('2d')!;
  const small = document.createElement('canvas');
  const sg = small.getContext('2d')!;
  const steps = [48, 24, 12, 6, 3];
  let i = 0;
  host.classList.remove('px-wait');
  img.style.opacity = '0';
  const draw = () => {
    if (i >= steps.length) {
      img.style.opacity = '';
      c.remove();
      return;
    }
    const block = steps[i++] * dpr;
    small.width = Math.max(1, Math.round(c.width / block));
    small.height = Math.max(1, Math.round(c.height / block));
    sg.clearRect(0, 0, small.width, small.height);
    try { sg.drawImage(img, 0, 0, small.width, small.height); } catch { img.style.opacity = ''; c.remove(); return; }
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(small, 0, 0, c.width, c.height);
    setTimeout(draw, 85);
  };
  draw();
}

/* gentle parallax: data-parallax="-0.15" */
function initParallax() {
  $$('[data-parallax]').forEach((el) => {
    const k = Number(el.dataset.parallax);
    gsap.fromTo(el, { yPercent: -k * 50 }, {
      yPercent: k * 50, ease: 'none',
      scrollTrigger: { trigger: el.parentElement ?? el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

/* bar charts grow in steps, like a progress bar on an old OS */
function initBars() {
  $$('[data-bars]').forEach((chart) => {
    const bars = $$('.bar__fill', chart);
    gsap.from(bars, {
      scaleX: 0, transformOrigin: 'left center', duration: 1, ease: 'steps(12)', stagger: 0.06,
      scrollTrigger: { trigger: chart, start: 'top 80%', once: true },
    });
  });
}

/* hover text scramble on [data-scramble] */
const GLYPHS = '▓▒░█#%&*+=<>/\\';
const ORIG = new WeakMap<Text, string>();
function initScramble() {
  if (reduced) return;
  $$('[data-scramble]').forEach((el) => {
    let raf = 0;
    const host = el.closest('a, button') ?? el;
    host.addEventListener('pointerenter', () => {
      const nodes = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent!.trim()) as Text[];
      if (!nodes.length) return;
      const originals = nodes.map((n) => {
        if (!ORIG.has(n)) ORIG.set(n, n.textContent!);
        return ORIG.get(n)!;
      });
      const t0 = performance.now();
      cancelAnimationFrame(raf);
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 380);
        nodes.forEach((n, k) => {
          const o = originals[k];
          const reveal = Math.floor(p * o.length);
          n.textContent = o.split('').map((ch, i) => (i < reveal || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
        });
        if (p < 1) raf = requestAnimationFrame(step);
        else nodes.forEach((n, k) => (n.textContent = originals[k]));
      };
      raf = requestAnimationFrame(step);
    });
  });
}

export { ScrollTrigger };
