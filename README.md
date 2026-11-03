# NB—OS · portfolio

Nabaskar Brahma's portfolio: UX/UI case studies and 3D renders.

**Concept: Surface / Underground.** The hero is a stippled point-cloud world: a field, a cloud band, and a person at a CRT. Scrolling sinks the camera down the CRT's cable through the soil, past five layers that preview who I am and what I do (design, motion, 3D), to the archive, a file drawer of case studies. Below that are a desktop of draggable windows, a 3D film strip and a mailroom where visitors leave a letter.

Stack: Astro 5 (static) · GSAP + ScrollTrigger + SplitText · Lenis · Three.js · Geist / Geist Mono / Departure Mono / Caveat.

## Run it

```
npm install
npm run dev        # http://localhost:4321
npm run build      # static site in dist/
npm run preview
```

Deploy `dist/` anywhere static: Vercel, Netlify, Cloudflare Pages or GitHub Pages. Set `site` in `astro.config.mjs` to your domain first.

## Before you publish

| Where | What |
| --- | --- |
| `src/data/site.ts` | Done: email, socials, education, résumé link. |
| `.env` | Done locally. Add `PUBLIC_WEB3FORMS_KEY` on your host too (see below). |
| `astro.config.mjs` | `site:` your real domain, then run `npm run resume` so the résumé's portfolio links point at it. |
| `src/pages/work/margin.astro`, `ruko.astro`, `berth.astro` | Done: `FIGMA` holds each prototype link. Check that the files are set to "Anyone with the link can view". |
| `src/data/projects.ts`, `src/pages/work/thriftup.astro` | Done: ThriftUp is 2024, solo. |
| What if | Optional: replace `public/video/*-preview.webm` with Figma screen recordings. |

## Letters (the mailroom)

Letters are sent with [Web3Forms](https://web3forms.com), which is free, needs no backend, and delivers to whichever inbox you register. Create an access key there, then add it to `.env`:

```
PUBLIC_WEB3FORMS_KEY=your-key
```

Set the same variable on your host (Vercel/Netlify env settings) and rebuild. Each email has the plain text plus a link to `/letter#…`, which redraws the letter exactly as it was written: handwriting, doodle and stamp. The whole letter is packed into the link, so nothing is stored anywhere.

Without a key, the site falls back to `mailto:` if `email` is set in `site.ts`. Otherwise it tells the visitor the mailroom isn't connected.

## Résumé

`src/data/resume.ts` holds the content; `/resume` renders it as a plain one-column page, and

```
npm run resume     # build → print /resume to public/Nabaskar-Brahma-UX-Resume.pdf with headless Edge/Chrome → build
```

The PDF is ATS-safe by construction: one column, a system font embedded as real text (no Type3 glyphs), no ligatures, standard headings, every link also written out. Before sending, open it, select all, paste into Notepad: everything should read in order. The research behind it is in `../reports/UX intern resume for Google.md`.

## 3D work

The 17 renders live in `src/assets/3d/` and are listed in `src/data/three-d.ts` (title, alt text, and whether they're `featured`).

- **Home:** the `featured` renders run as a pinned film strip that moves sideways as you scroll (`src/components/home/World3D.astro`).
- **/3d:** all renders as a contact sheet. Clicking one opens a full-screen viewer that works with arrow keys, swipe and Esc. `/3d#cafe` opens that render directly, which is how the home strip links in.

To add one: drop the image in `src/assets/3d/`, import it at the top of `three-d.ts`, and add an entry. `year` and `tools` are optional and show under the title when set.

## Updating case studies

Case-study assets come from the sibling project folders and their handoff zips:

```
npm run assets     # re-extracts Margin, Ruko, ThriftUp, Motion zips + Berth/assets into src/assets/work
```

Page copy lives in `src/pages/work/*.astro`, built from shared components in `src/components/case/`.

## Map

```
src/
  data/          site.ts (personal), projects.ts (archive), stamps.ts (pixel stamps), three-d.ts
  layouts/       Base.astro (menu bar, status bar, cursor, wipes), CaseStudy.astro
  components/
    home/        Boot, Hero, Descent, Archive (drawer + list), Desktop, World3D, Mailroom
    case/        Sec, Shot, Quote, Stats, Bars, Flipbook
  scripts/
    core.ts      Lenis + GSAP setup
    world.ts     the Three.js point-cloud world
    home.ts      boot, scroll → camera, drawer, windows
    pixels.ts    theme flood (minesweeper edge) and page wipes
    reveal.ts    split headings, counters, pixel-resolving images, scramble
    cursor.ts    grid-snapped cursor and trail
    letter*.ts   composer, renderer, viewer
    ascii.ts     the letter-drawn donut
    sound.ts     synthesized UI sounds (off by default)
  styles/        global.css (tokens), case.css
```

## Accessibility and motion

- `prefers-reduced-motion`: no smooth scroll, no boot, no wipes or floods, and the world is still.
- Every image carries the alt text from its handoff. Specimen panels stay light in dark mode, because the graphics are drawn for paper.
- The drawer's real folders are links in tab order; on phones the drawer becomes a list.
- The custom cursor only runs on fine pointers.

Fonts: Departure Mono © Helena Zhang, SIL OFL 1.1 (`public/fonts/DepartureMono-LICENSE.txt`). Geist and Caveat are OFL, via Fontsource.
