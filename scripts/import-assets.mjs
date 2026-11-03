// Pulls case-study assets out of the sibling project folders (and their handoff zips)
// into src/assets/work/<slug>/ and public/. Re-run after updating any handoff:
//   npm run assets
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const UX = resolve(ROOT, '..');
const TMP = join(ROOT, '.handoff');
const A = (slug) => join(ROOT, 'src/assets/work', slug);
const PUB = join(ROOT, 'public');

function unzip(zip, name) {
  const out = join(TMP, name);
  if (!existsSync(out)) {
    mkdirSync(out, { recursive: true });
    execFileSync(process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\Windows', 'System32', 'tar.exe') : 'unzip', process.platform === 'win32' ? ['-xf', zip, '-C', out] : ['-q', zip, '-d', out]);
  }
  return out;
}
function copy(from, to) {
  mkdirSync(resolve(to, '..'), { recursive: true });
  cpSync(from, to);
}
function copyDir(from, to, filter = () => true) {
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from)) if (filter(f)) cpSync(join(from, f), join(to, f));
}

rmSync(join(ROOT, 'src/assets/work'), { recursive: true, force: true });

// Margin
{
  const h = join(unzip(join(UX, 'Margin/Margin-handoff.zip'), 'margin'), 'Margin-handoff');
  copyDir(join(h, 'images/screens'), A('margin'));
  copy(join(h, 'Nabaskar-Brahma-Margin-Case-Study.pdf'), join(PUB, 'pdf/margin-case-study.pdf'));
}
// Ruko
{
  const h = join(unzip(join(UX, 'Ruko/Ruko-handoff.zip'), 'ruko'), 'Ruko-handoff');
  copyDir(join(h, 'images/screens'), A('ruko'));
  copyDir(join(h, 'images/graphics'), A('ruko'));
  copy(join(h, 'Nabaskar-Brahma-Ruko-Case-Study.pdf'), join(PUB, 'pdf/ruko-case-study.pdf'));
}
// Berth (no zip: assets come from the project folder)
{
  copyDir(join(UX, 'Berth/assets/png'), A('berth'));
  copy(join(UX, 'Berth/berth-case-study.pdf'), join(PUB, 'pdf/berth-case-study.pdf'));
}
// ThriftUp
{
  const h = join(unzip(join(UX, 'ThriftUp/ThriftUp-website-package.zip'), 'thriftup'), 'ThriftUp/images');
  copyDir(join(h, 'cover'), A('thriftup'), (f) => f.endsWith('.webp'));
  copyDir(join(h, 'case-study'), A('thriftup'));
  copyDir(join(h, 'details'), A('thriftup'));
  copyDir(join(h, 'screens/folds'), A('thriftup'));
  copyDir(join(h, 'design-system'), A('thriftup'));
  for (const s of ['home', 'modacash', 'bag-filled', 'profile', 'sign-up', 'purchase-done-a']) copy(join(h, `screens/${s}@864.webp`), join(A('thriftup'), `${s}-full.webp`));
}
// What if · Motion
{
  const h = join(unzip(join(UX, 'Motion/handoff/WhatIf-Motion-Handoff.zip'), 'motion'), 'WhatIf-Motion-Handoff');
  for (const [dir, key] of [['01-Stack', 'stack'], ['02-Inside', 'inside'], ['03-Tank', 'tank']]) {
    const d = join(h, dir);
    copyDir(d, A('what-if'), (f) => f.endsWith('.png'));
    copyDir(join(d, 'screens'), join(A('what-if'), key));
    copyDir(join(d, 'preview'), A('what-if'), (f) => f.endsWith('.png'));
    copy(join(d, `preview/${key}-preview.webm`), join(PUB, `video/${key}-preview.webm`));
  }
}
console.log('assets imported');
