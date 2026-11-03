import type { ImageMetadata } from 'astro';
import marginCover from '../assets/work/margin/watch.png';
import rukoCover from '../assets/work/ruko/1-money-out.png';
import berthCover from '../assets/work/berth/screen-2-now-station.png';
import thriftCover from '../assets/work/thriftup/card-thumbnail.webp';
import whatIfCover from '../assets/work/what-if/stack-shot-1600x1200.png';

export interface Project {
  slug: string;
  code: string; // index-tab code, e.g. "M 001"
  title: string;
  oneLiner: string;
  kind: string;
  year: string;
  tags: string[];
  cover: ImageMetadata;
  coverKind: 'phone' | 'wide';
  tint: string; // specimen panel colour (stays light in dark mode)
  spot: string; // the project's own accent, used sparingly on its page
}

// Order = reading order in the archive. Margin leads: a learning product for long videos.
export const projects: Project[] = [
  {
    slug: 'margin',
    code: 'M 001',
    title: 'Margin',
    oneLiner: 'Every note, pinned to its second. A study companion for long recorded lectures.',
    kind: 'UX research · Mobile app',
    year: '2026',
    tags: ['10,657 posts analysed', 'Offline-first', 'Android'],
    cover: marginCover,
    coverKind: 'phone',
    tint: '#E4EEDC',
    spot: '#335024',
  },
  {
    slug: 'ruko',
    code: 'R 002',
    title: 'Ruko',
    oneLiner: 'A warning people believe, at the second it matters. Scam safety for parents aged 45+.',
    kind: 'Trust & safety · Accessibility',
    year: '2026',
    tags: ['6 interviews', 'Warning test', 'UPI'],
    cover: rukoCover,
    coverKind: 'phone',
    tint: '#E0EFEC',
    spot: '#0E5E58',
  },
  {
    slug: 'berth',
    code: 'B 003',
    title: 'Berth',
    oneLiner: 'The one answer a train traveller needs right now: where to stand, and when to wake.',
    kind: 'Research synthesis · Mobile',
    year: '2026',
    tags: ['Mixed methods', 'Simulated study data', 'Lock screen + widgets'],
    cover: berthCover,
    coverKind: 'phone',
    tint: '#DDE5F5',
    spot: '#1E3A8A',
  },
  {
    slug: 'thriftup',
    code: 'T 004',
    title: 'ThriftUp',
    oneLiner: 'Making second-hand fashion feel first-rate, with a buy-back program called ModaCash.',
    kind: 'E-commerce · Web · Solo',
    year: '2024',
    tags: ['Personas', 'IA', '50+ screens'],
    cover: thriftCover,
    coverKind: 'wide',
    tint: '#EDEDED',
    spot: '#212126',
  },
  {
    slug: 'what-if',
    code: 'W 005',
    title: 'What if…?',
    oneLiner: 'Three tiny prototypes, one gesture each, tuned until they feel physical.',
    kind: 'Motion · Interaction design',
    year: '2026',
    tags: ['Smart Animate', 'Springs', 'Figma'],
    cover: whatIfCover,
    coverKind: 'wide',
    tint: '#ECEBE7',
    spot: '#FF5A36',
  },
];

export const bySlug = (slug: string) => projects.find((p) => p.slug === slug)!;
export const nextOf = (slug: string) => {
  const i = projects.findIndex((p) => p.slug === slug);
  return projects[(i + 1) % projects.length];
};

// The other folders in the drawer. Not clickable. Just lore.
export const fillerFolders = [
  '041 chai receipts',
  '042 fonts i will never use',
  '043 figma autosave (47)',
  '044 rejected logos',
  '045 wireframes on napkins',
  '046 blender donut v1',
  '047 kerning crimes',
  '048 midsem notes',
  '049 dark mode, again',
  '050 "one more iteration"',
  '051 screenshots of good ui',
  '052 moodboards',
  '053 tutorial hell',
  '054 sticky notes',
  '055 pixel fonts',
  '056 hackathon pizza',
  '057 unsent emails',
  '058 render farm (my laptop)',
];
