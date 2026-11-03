import { initScroll, lenis, scrollToTarget, ScrollTrigger, $, $$ } from './core';
import { initCursor } from './cursor';
import { initLinks, themeFlood, wipeIn } from './pixels';
import { initReveals } from './reveal';
import { setSound, soundOn, sfx } from './sound';
import { site } from '../data/site';

export async function boot() {
  const openedAt = scrollY; // where the browser put us, before anyone has had a chance to scroll
  initScroll();
  initCursor();
  initLinks();
  initTray();
  initClock();
  initAnchors();
  initReveals();

  const page = document.documentElement.dataset.page;
  // home holds the arrival cover until the world and pins are built (it fires nb:ready)
  const ready = page === 'home'
    ? new Promise((r) => addEventListener('nb:ready', r, { once: true }))
    : document.fonts?.ready;
  wipeIn(ready);
  // where this page opens: a #section, the spot you left (back/forward), or the top
  Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(() => land(openedAt));
  addEventListener('pagehide', () => sessionStorage.setItem(scrollKey(), String(Math.round(scrollY))));
  if (page === 'home') (await import('./home')).initHome();
  else initReadMeter();
  if ($('[data-ascii]')) (await import('./ascii')).initAscii();
  if ($('[data-letter-view]')) (await import('./letter-view')).initLetterView();

  // images without dimensions or late fonts can shift layout
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
}

function initTray() {
  const html = document.documentElement;
  const theme = $('#theme-toggle');
  const label = $('.theme-label');
  const sync = () => { if (label) label.textContent = html.dataset.theme === 'dark' ? 'dark' : 'light'; };
  sync();
  theme?.addEventListener('click', (e) => {
    const r = theme.getBoundingClientRect();
    const x = (e as MouseEvent).clientX || r.left + r.width / 2;
    const y = (e as MouseEvent).clientY || r.top + r.height / 2;
    themeFlood(x, y, () => {
      const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
      html.dataset.theme = next;
      localStorage.setItem('nb-theme', next);
      sync();
      dispatchEvent(new CustomEvent('nb:theme'));
    });
  });

  const swatches = $$<HTMLButtonElement>('[data-phosphor-set]');
  const setP = (p: string) => {
    if (p === 'green') delete html.dataset.phosphor; else html.dataset.phosphor = p;
    localStorage.setItem('nb-phosphor', p);
    swatches.forEach((s) => s.setAttribute('aria-checked', String(s.dataset.phosphorSet === p)));
    dispatchEvent(new CustomEvent('nb:theme'));
  };
  swatches.forEach((s) => s.setAttribute('aria-checked', String(s.dataset.phosphorSet === (html.dataset.phosphor ?? 'green'))));
  swatches.forEach((s) => s.addEventListener('click', () => { setP(s.dataset.phosphorSet!); sfx.click(); }));

  const snd = $('#sound-toggle');
  const syncS = () => {
    snd?.setAttribute('aria-pressed', String(soundOn()));
    const st = snd?.querySelector('.tray-btn__state');
    if (st) st.textContent = soundOn() ? 'on' : 'off';
  };
  syncS();
  snd?.addEventListener('click', () => { setSound(!soundOn()); syncS(); sfx.boot(); });
}

function initClock() {
  const el = $('#clock');
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: site.timezone });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 15000);
}

function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const target = byHash(url.hash);
    if (!target) return;
    e.preventDefault();
    const dist = Math.abs(target.getBoundingClientRect().top) / innerHeight;
    // no hash in the address bar: a reload should start at the top, not at this section
    scrollToTarget(target, { duration: Math.min(4.2, 1 + dist * 0.5) });
  });
}

// typing /#letters into the address bar while already on the page: glide there like a link would
addEventListener('hashchange', () => {
  const page = document.documentElement.dataset.page;
  if (page === 'letter' || page === 'three-d') return;
  const t = byHash(location.hash);
  history.replaceState(null, '', location.pathname + location.search);
  if (!t) return;
  // the browser has already jumped; just nudge it clear of the menu bar, from where it really is
  const y = t.getBoundingClientRect().top + scrollY - 36;
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
});

// hashes like #1abc or #a%20b aren't valid selectors; look them up by id instead
function byHash(hash: string) {
  try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return null; }
}

const scrollKey = () => `nb-scroll:${location.pathname}`;

function land(openedAt: number) {
  const page = document.documentElement.dataset.page;
  if (page === 'letter' || page === 'three-d') return; // their hashes carry data, not a place
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const saved = Number(sessionStorage.getItem(scrollKey()));
  const target: HTMLElement | number | null =
    location.hash ? byHash(location.hash)
    : nav?.type === 'back_forward' && saved > 0 ? saved
    : 0;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (target === null) return;
  if (target === 0) {
    // the top: one quiet correction, never a second yank once someone has started scrolling
    if (openedAt > 0) lenis ? lenis.scrollTo(0, { immediate: true, force: true }) : scrollTo(0, 0);
    return;
  }
  const go = () => {
    ScrollTrigger.refresh();
    if (typeof target === 'number') {
      if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
      else scrollTo(0, target);
    } else scrollToTarget(target, { duration: 0.01 });
  };
  go();
  // fonts or late images can still shift things; land again once settled
  setTimeout(go, 400);
}

function initReadMeter() {
  const m = $('#meter');
  if (!m) return;
  const upd = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    m.textContent = String(Math.round((scrollY / Math.max(1, max)) * 100)).padStart(3, '0');
  };
  if (lenis) lenis.on('scroll', upd); else addEventListener('scroll', upd, { passive: true });
  upd();
}
