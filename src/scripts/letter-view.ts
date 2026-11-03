import { gsap, reduced, $ } from './core';
import { renderLetter, unpack } from './letter-render';
import { stamps, stampSvg } from '../data/stamps';
import { revealed } from './pixels';

// /letter#<packed>: re-draws a letter exactly as it was written, doodle included.
export async function initLetterView() {
  const host = $('[data-letter-view]')!;
  const desk = $('[data-letter-desk]', host)!;
  const canvas = $<HTMLCanvasElement>('canvas', host)!;
  const title = $('[data-letter-title]', host)!;
  const status = $('[data-letter-status]', host)!;
  const set = (sel: string, v: string) => { const el = $(sel, host); if (el) el.textContent = v; };

  const hash = location.hash.slice(1);
  if (!hash) {
    title.textContent = 'This envelope is empty.';
    status.textContent = 'Letters arrive here through the link in the email.';
    return;
  }
  try {
    const d = await unpack(hash);
    await document.fonts.load('36px Caveat');
    renderLetter(canvas, d, 2);

    // the name is visitor-written: build the heading with text nodes, never innerHTML
    const who = document.createElement('span');
    who.className = 'hand';
    who.textContent = d.name || 'someone';
    title.replaceChildren('A letter from ', who, '.');
    status.textContent = `Written ${d.date}, sealed with ${stamps[d.stamp]?.label.toLowerCase() ?? 'a stamp'}.`;

    const words = d.msg.trim() ? d.msg.trim().split(/\s+/).length : 0;
    const strokes = d.strokes?.length ?? 0;
    set('[data-lv-from]', d.name);
    set('[data-lv-name]', d.name);
    set('[data-lv-date]', d.date);
    set('[data-lv-pm]', d.date);
    set('[data-lv-stampname]', stamps[d.stamp]?.label ?? d.stamp);
    set('[data-lv-words]', String(words));
    set('[data-lv-strokes]', strokes ? `${strokes} stroke${strokes === 1 ? '' : 's'}` : 'none');
    set('[data-letter-text]', d.msg || '(no words, just a doodle)');
    const st = $('[data-lv-stamp]', host);
    if (st && stamps[d.stamp]) st.innerHTML = stampSvg(d.stamp);

    desk.hidden = false;
    if (reduced) return;
    await revealed;
    // the letter slides up out of its envelope, then the details settle in
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from(canvas, { yPercent: 18, rotateX: 14, opacity: 0, duration: 1.2 })
      .from('.lv-env', { y: 40, rotate: 8, opacity: 0, duration: 0.9 }, 0.15)
      .from('.lv-env__flap', { scaleY: 0, duration: 0.6, ease: 'back.out(2)' }, 0.55)
      .from('.lv-receipt > div, .lv-transcript, .lv__actions', { y: 14, opacity: 0, stagger: 0.06, duration: 0.7 }, 0.4);
  } catch {
    title.textContent = 'This letter got crumpled on the way.';
    status.textContent = 'The link looks incomplete. Try copying the whole link from the email.';
  }
}
