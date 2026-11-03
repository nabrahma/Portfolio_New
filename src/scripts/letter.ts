import { cssVar, gsap, reduced, $, $$ } from './core';
import { sfx } from './sound';
import { stampSvg } from '../data/stamps';
import { site } from '../data/site';
import { drawStrokes, pack, renderLetter, type LetterData, type Stroke } from './letter-render';

export function initLetter() {
  const root = $('#letters');
  const form = $<HTMLFormElement>('.letter', root!);
  if (!root || !form) return;

  const sheet = $('[data-sheet]', form)!;
  const canvas = $<HTMLCanvasElement>('[data-doodle]', form)!;
  const err = $('[data-err]', form)!;
  const slot = $('[data-stamp-slot]', form)!;
  const mini = $('[data-stamp-mini]', form);
  const env = $('[data-env]', root)!;
  const done = $('[data-done]', root)!;
  const today = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  $('[data-date]', form)!.textContent = today;
  $('[data-pm-date]', root)!.textContent = today;

  /* ---- stamp ---- */
  let stamp = 'crt';
  $$<HTMLInputElement>('input[name="stamp"]', form).forEach((r) =>
    r.addEventListener('change', () => {
      stamp = r.value;
      slot.innerHTML = stampSvg(stamp);
      if (mini) mini.innerHTML = slot.innerHTML;
      sfx.thunk();
      if (!reduced) gsap.fromTo(slot, { scale: 1.3, rotate: 8 }, { scale: 1, rotate: 0, duration: 0.4, ease: 'back.out(3)' });
    }),
  );

  /* ---- outgoing tray: the envelope preview follows the form ---- */
  const fromName = $('[data-from-name]', form);
  const fromMail = $('[data-from-mail]', form);
  const syncFrom = () => {
    const n = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const m = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    if (fromName) fromName.textContent = n || 'someone kind';
    if (fromMail) fromMail.textContent = m || 'no return address';
  };
  form.addEventListener('input', syncFrom);
  form.addEventListener('reset', () => setTimeout(syncFrom));

  /* ---- doodle ---- */
  const strokes: Stroke[] = [];
  let pen: Stroke['c'] = 'ink';
  const g = canvas.getContext('2d')!;
  const fit = () => {
    const r = sheet.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    redraw();
  };
  const redraw = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    drawStrokes(g, strokes, canvas.width, canvas.height, cssVar('--accent'));
  };
  new ResizeObserver(fit).observe(sheet);
  addEventListener('nb:theme', redraw);

  let cur: Stroke | null = null;
  const pt = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)];
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    cur = { c: pen, w: pen === 'erase' ? 26 : 5, p: pt(e) };
    strokes.push(cur);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const [x, y] = pt(e);
    const n = cur.p.length;
    if (Math.hypot(x - cur.p[n - 2], y - cur.p[n - 1]) < 4) return;
    cur.p.push(x, y);
    redraw();
  });
  const up = () => (cur = null);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  const setMode = (m: string) => {
    form.classList.toggle('is-drawing', m === 'draw');
    $$('[data-mode]', form).forEach((b) => {
      b.classList.toggle('is-on', b.dataset.mode === m);
      b.setAttribute('aria-checked', String(b.dataset.mode === m));
    });
    sfx.click();
  };
  $$('[data-mode]', form).forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode!)));
  $$('[data-pen]', form).forEach((b) =>
    b.addEventListener('click', () => {
      pen = b.dataset.pen as Stroke['c'];
      $$('[data-pen]', form).forEach((x) => x.classList.toggle('is-on', x === b));
      setMode('draw');
    }),
  );
  $('[data-clear]', form)!.addEventListener('click', () => { strokes.length = 0; redraw(); sfx.paper(); });

  /* ---- send ---- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const fd = new FormData(form);
    const msg = String(fd.get('message') ?? '').trim();
    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    if (fd.get('botcheck')) return;
    if (!msg && !strokes.length) { err.textContent = 'The page is empty. Write something, or doodle.'; ($('textarea', form) as HTMLElement).focus(); return; }
    if (!name) { err.textContent = 'Sign it, so I know who it’s from.'; ($('#l-name') as HTMLElement).focus(); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'That return address looks off.'; return; }
    const last = Number(localStorage.getItem('nb-letter-at') ?? 0);
    if (Date.now() - last < 60_000) { err.textContent = 'The tube is still cooling down. Try again in a minute.'; return; }

    const data: LetterData = {
      v: 1, to: site.name.split(' ')[0], name, msg, stamp, date: today,
      accent: cssVar('--accent'), strokes: strokes.filter((s) => s.p.length >= 2),
    };
    const link = `${location.origin}/letter#${await pack(data)}`;
    const sending = deliver({ name, email, msg, link, stamp });
    form.querySelector<HTMLButtonElement>('.send')!.disabled = true;

    try { await (reduced ? Promise.resolve() : animate(data)); }
    catch (err) { console.warn('Letter animation failed; delivering anyway.', err); }
    const res = await sending;
    showDone(res, name);
  });

  let mailtoHref = '';
  async function deliver(p: { name: string; email: string; msg: string; link: string; stamp: string }): Promise<'sent' | 'mailto' | 'fail' | 'offline'> {
    const key = root!.dataset.web3forms;
    const body = `${p.msg || '(a doodle, no words)'}\n\n— ${p.name}${p.email ? ` <${p.email}>` : ''}\n\nStamp: ${p.stamp}\nSee the letter as written, doodle included:\n${p.link}`;
    const to = root!.dataset.email;
    // mail apps choke on very long mailto URLs; the letter link carries the full text anyway
    const short = body.length > 1500 ? `${p.msg.slice(0, 600)}…

— ${p.name}

The whole letter, doodle included:
${p.link}` : body;
    mailtoHref = to ? `mailto:${to}?subject=${encodeURIComponent(`A letter from ${p.name}`)}&body=${encodeURIComponent(short)}` : '';
    if (key) {
      try {
        const r = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: key,
            subject: `✉ A letter from ${p.name} (portfolio)`,
            from_name: 'Portfolio mailroom',
            name: p.name,
            ...(p.email ? { email: p.email, replyto: p.email } : {}),
            message: body,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.success !== false) { localStorage.setItem('nb-letter-at', String(Date.now())); return 'sent'; }
        return 'fail';
      } catch { return 'fail'; }
    }
    if (mailtoHref) {
      location.href = mailtoHref;
      return 'mailto';
    }
    return 'offline';
  }

  function showDone(res: string, name: string) {
    const msg = $('[data-done-msg]', root!)!;
    const big = $('.mail__done-big', root!)!;
    const ok = res === 'sent' || res === 'mailto';
    big.textContent = ok ? '✉ Delivered.' : '✉ Stuck in the tube.';
    msg.textContent =
      res === 'sent' ? `Thank you, ${name}. It’s on its way up to the surface.` :
      res === 'mailto' ? 'Your mail app should open with the letter inside. Hit send there.' :
      res === 'offline' ? 'The mailroom isn’t connected yet, so this one didn’t go anywhere. Sorry.' :
      mailtoHref ? 'Something jammed on the way up. You can send it by email instead: everything you wrote, doodle link included.' :
      'Something jammed on the way up. Your words are still here: try again in a moment.';
    form!.style.opacity = '0';
    form!.style.pointerEvents = 'none';
    done.hidden = false;
    done.focus();
    if (!reduced) gsap.from(done.children, { y: 16, opacity: 0, stagger: 0.08, duration: 0.6, ease: 'power3.out' });
    if (!ok) {
      if (res === 'fail' && mailtoHref) {
        const a = document.createElement('a');
        a.className = 'btn btn--solid';
        a.href = mailtoHref;
        a.dataset.fallback = '';
        a.innerHTML = 'Send it by email instead <span class="arr">✉</span>';
        $('[data-again]', root!)!.before(a);
      }
      $('[data-again]', root!)!.textContent = 'Back to the letter ↺';
      ($('[data-again]', root!) as HTMLElement).dataset.keep = '1';
    }
  }

  $('[data-again]', root)!.addEventListener('click', (e) => {
    const keep = (e.currentTarget as HTMLElement).dataset.keep;
    if (!keep) { form.reset(); setMode('write'); strokes.length = 0; redraw(); slot.innerHTML = stampSvg('crt'); if (mini) mini.innerHTML = slot.innerHTML; stamp = 'crt'; }
    (e.currentTarget as HTMLElement).innerHTML = 'Write another <span class="arr">↺</span>';
    delete (e.currentTarget as HTMLElement).dataset.keep;
    $('[data-fallback]', root!)?.remove();
    done.hidden = true;
    form.style.opacity = '';
    form.style.pointerEvents = '';
    sheet.style.visibility = '';
    form.querySelector<HTMLButtonElement>('.send')!.disabled = false;
    gsap.set(env, { clearProps: 'all' });
    $$('.env__flap, .env__stamp, .env__postmark, .tube', root!).forEach((el) => gsap.set(el, { clearProps: 'all' }));
    $('[data-slot]', root!)!.innerHTML = '';
  });

  /* ---- fold, envelope, stamp, tube ---- */
  async function animate(d: LetterData) {
    await document.fonts.load('36px Caveat');
    const snap = document.createElement('canvas');
    renderLetter(snap, d, 1);
    const url = snap.toDataURL('image/png');
    const r = sheet.getBoundingClientRect();
    const host = root!.getBoundingClientRect();

    // three panels, positioned exactly over the sheet
    const fold = document.createElement('div');
    fold.className = 'fold';
    fold.style.cssText = `position:absolute;left:${r.left - host.left}px;top:${r.top - host.top}px;width:${r.width}px;height:${r.height}px;z-index:6;transform-style:preserve-3d;perspective:1600px;`;
    const panels = [0, 1, 2].map((i) => {
      const p = document.createElement('div');
      p.style.cssText = `position:absolute;left:0;width:100%;height:33.4%;top:${i * 33.3}%;transform-style:preserve-3d;transform-origin:${i === 0 ? 'bottom' : 'top'} center;`;
      p.innerHTML = `<div style="position:absolute;inset:0;backface-visibility:hidden;background:url(${url}) 0 ${i * 50}%/100% 300%;box-shadow:0 0 0 1px rgb(0 0 0 / .08)"></div><div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateX(180deg);background:#f1efe7;box-shadow:inset 0 0 0 1px rgb(0 0 0 / .1)"></div>`;
      fold.appendChild(p);
      return p;
    });
    panels[0].style.zIndex = '3';
    panels[2].style.zIndex = '2';
    root!.appendChild(fold);
    sheet.style.visibility = 'hidden';
    sfx.paper();

    const tl = gsap.timeline();
    tl.to(form, { opacity: 0.0, duration: 0.3 }, 0)
      .to(panels[2], { rotateX: 180, duration: 0.55, ease: 'power2.inOut' }, 0.05)
      .to(panels[0], { rotateX: -180, duration: 0.55, ease: 'power2.inOut', onStart: () => sfx.paper() }, 0.45)
      .to(fold, { y: '+=10', duration: 0.15 }, 0.95);
    await tl;

    // the envelope rises; the folded letter flies into its slot
    env.style.visibility = 'visible';
    const er = env.getBoundingClientRect();
    const slotEl = $('[data-slot]', root!)!;
    gsap.set(env, { y: 80, opacity: 0 });
    await gsap.to(env, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
    const sr = slotEl.getBoundingClientRect();
    const fr = fold.getBoundingClientRect(); // only the middle third is visible now
    const midH = fr.height / 3;
    const scale = Math.min(sr.width / fr.width, (sr.height * 0.95) / midH);
    const targetX = sr.left + sr.width / 2 - (fr.left + fr.width / 2);
    const targetY = sr.top + sr.height / 2 - (fr.top + fr.height / 2);
    await gsap.to(fold, { x: targetX, y: `+=${targetY - 30}`, scale, rotate: -2, duration: 0.7, ease: 'power3.inOut' });
    // tuck it between the back and the front of the envelope
    const fr2 = fold.getBoundingClientRect();
    const sr2 = slotEl.getBoundingClientRect();
    fold.style.cssText += `;left:0;top:0;z-index:auto;`;
    gsap.set(fold, { x: fr2.left - sr2.left - (fr.width - fr2.width) / 2, y: fr2.top - sr2.top - (fr.height - fr2.height) / 2 });
    slotEl.appendChild(fold);
    await gsap.to(fold, { y: '+=34', duration: 0.35, ease: 'power2.in' });

    // close, stamp, postmark
    const flap = $('.env__flap', env)!;
    const st = $('[data-env-stamp]', env)!;
    st.innerHTML = stampSvg(d.stamp);
    await gsap.to(flap, { rotateX: 0, duration: 0.5, ease: 'power2.inOut', onStart: () => sfx.paper() });
    gsap.set(flap, { zIndex: 3 });
    await gsap.fromTo(st, { opacity: 0, scale: 2.4, rotate: 18 }, { opacity: 1, scale: 1, rotate: -4, duration: 0.35, ease: 'back.out(2.2)', onComplete: () => sfx.thunk() });
    await gsap.to('.env__postmark', { opacity: 0.85, duration: 0.3, ease: 'steps(4)' });
    await gsap.to({}, { duration: 0.35 });

    // up the tube to the surface
    const tube = $('.tube', root!)!;
    const tubeTop = er.top - host.top - 260;
    gsap.set(tube, { top: tubeTop - 200 });
    await gsap.to(tube, { opacity: 1, top: tubeTop, duration: 0.45, ease: 'power3.out' });
    sfx.whoosh();
    await gsap.to(env, { y: -innerHeight * 1.2, scaleX: 0.5, scaleY: 0.9, rotate: 0, duration: 0.65, ease: 'power3.in' });
    await gsap.to(tube, { opacity: 0, top: tubeTop - 200, duration: 0.35, ease: 'power2.in' });
    fold.remove();
    env.style.visibility = 'hidden';
  }
}
