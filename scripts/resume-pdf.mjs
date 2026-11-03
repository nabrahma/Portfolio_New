// Prints /resume to public/Nabaskar-Brahma-UX-Resume.pdf with headless Edge or Chrome.
// Run through `npm run resume` (build → print → build again so dist/ carries the PDF).
// The PDF is real text in one column, so ATS parsers and "select all → paste" read it in order.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, statSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const OUT = resolve(process.env.RESUME_OUT ?? 'public/Nabaskar-Brahma-UX-Resume.pdf');
const PORT = 4329;

const browsers = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browser = browsers.find((b) => existsSync(b));
if (!browser) {
  console.error('No Edge or Chrome found. Set CHROME_PATH to a Chromium browser.');
  process.exit(1);
}

const preview = spawn(process.execPath, ['node_modules/astro/astro.js', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'pipe' });
const ready = new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview did not start')), 30000);
  preview.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
});

// a throwaway profile, so the browser can never print a cached copy of an older build
const profile = mkdtempSync(join(tmpdir(), 'resume-pdf-'));
const tmp = join(profile, 'resume.pdf');
try {
  await ready;
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw',
    `--user-data-dir=${profile}`, '--disk-cache-size=1',
    '--virtual-time-budget=6000', `--print-to-pdf=${tmp}`, `http://127.0.0.1:${PORT}/resume/?v=${Date.now()}`,
  ], { stdio: 'ignore' });
  if (!existsSync(tmp)) throw new Error('the browser did not write a PDF');
  // print to a temp file, then copy: a PDF left open in a viewer can't be overwritten in place,
  // and the browser fails silently when that happens
  try { copyFileSync(tmp, OUT); }
  catch { throw new Error(`could not replace ${OUT}. Is it open in a PDF viewer or editor tab? Close it and run again.`); }
  console.log(`résumé → ${OUT} (${Math.round(statSync(OUT).size / 1024)} KB)`);
} finally {
  preview.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
