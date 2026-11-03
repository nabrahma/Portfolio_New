// Prints /resume to public/Nabaskar-Brahma-UX-Resume.pdf with headless Edge or Chrome.
// Run through `npm run resume` (build → print → build again so dist/ carries the PDF).
// The PDF is real text in one column, so ATS parsers and "select all → paste" read it in order.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('public/Nabaskar-Brahma-UX-Resume.pdf');
const PORT = 4329;

const browsers = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
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

try {
  await ready;
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=6000', `--print-to-pdf=${OUT}`, `http://127.0.0.1:${PORT}/resume/`,
  ], { stdio: 'ignore' });
  console.log(`résumé → ${OUT} (${Math.round(statSync(OUT).size / 1024)} KB)`);
} finally {
  preview.kill();
}
