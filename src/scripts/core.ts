import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger, SplitText };

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

export let lenis: Lenis | null = null;

export function initScroll() {
  if (reduced) return;
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.2, anchors: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

export function scrollToTarget(target: string | HTMLElement | number, opts: { duration?: number; offset?: number } = {}) {
  const offset = opts.offset ?? -36;
  if (lenis) {
    lenis.scrollTo(target as any, { offset, duration: opts.duration ?? 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    return;
  }
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  const y = typeof el === 'number' ? el : el ? el.getBoundingClientRect().top + scrollY + offset : 0;
  scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
}

export const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s);
export const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(s));
