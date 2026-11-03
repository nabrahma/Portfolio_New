import { stamps } from '../data/stamps';

export type Stroke = { c: 'ink' | 'accent' | 'red' | 'erase'; w: number; p: number[] }; // p: x,y pairs in 0..1000
export interface LetterData {
  v: 1;
  to: string;
  name: string;
  msg: string;
  stamp: string;
  date: string;
  accent: string;
  strokes: Stroke[];
}

export const PAPER = { w: 840, h: 1040 };
export const PEN = { ink: '#161616', red: '#e0442b' };

/* Draw a letter on a canvas at PAPER size (scaled by `scale`). */
export function renderLetter(c: HTMLCanvasElement, d: LetterData, scale = 1) {
  c.width = PAPER.w * scale;
  c.height = PAPER.h * scale;
  const g = c.getContext('2d')!;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  // paper, rules, margin
  g.fillStyle = '#fbfaf5';
  g.fillRect(0, 0, PAPER.w, PAPER.h);
  g.fillStyle = '#c9d7e4';
  for (let y = 18 + 33; y < PAPER.h; y += 34 * 1.35) g.fillRect(0, y, PAPER.w, 1.2);
  g.fillStyle = '#ef8f7d';
  g.fillRect(52, 0, 1.4, PAPER.h);
  // date + stamp
  g.fillStyle = '#6b6b66';
  g.font = '500 14px "Geist Mono Variable", monospace';
  g.fillText(d.date.toUpperCase(), 76, 58);
  drawStamp(g, d.stamp, PAPER.w - 120, 34, 70, 80, d.accent);
  // words
  const line = 34 * 1.35;
  g.fillStyle = '#161616';
  g.font = `400 ${40}px Caveat, cursive`;
  let y = 18 + 33 + line * 2 - 10;
  g.fillText(`Dear ${d.to},`, 76, y);
  g.font = `400 ${36}px Caveat, cursive`;
  y += line;
  for (const l of wrap(g, d.msg, PAPER.w - 76 - 54)) {
    if (y > PAPER.h - line * 2) break;
    g.fillText(l, 76, y);
    y += line;
  }
  g.font = `400 ${38}px Caveat, cursive`;
  g.textAlign = 'right';
  g.fillText(`— ${d.name}`, PAPER.w - 54, PAPER.h - line + 6);
  g.textAlign = 'left';
  // doodle (on its own layer so the eraser doesn't eat the words)
  const layer = document.createElement('canvas');
  layer.width = c.width;
  layer.height = c.height;
  const lg = layer.getContext('2d')!;
  lg.setTransform(scale, 0, 0, scale, 0, 0);
  drawStrokes(lg, d.strokes, PAPER.w, PAPER.h, d.accent);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(layer, 0, 0);
}

export function drawStrokes(g: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number, accent: string) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const s of strokes) {
    if (s.p.length < 2) continue;
    g.globalCompositeOperation = s.c === 'erase' ? 'destination-out' : 'source-over';
    g.strokeStyle = s.c === 'accent' ? accent : s.c === 'red' ? PEN.red : PEN.ink;
    g.lineWidth = (s.w * w) / 1000;
    g.beginPath();
    const X = (i: number) => (s.p[i] * w) / 1000, Y = (i: number) => (s.p[i + 1] * h) / 1000;
    g.moveTo(X(0), Y(0));
    if (s.p.length === 2) g.lineTo(X(0) + 0.1, Y(0));
    for (let i = 2; i < s.p.length - 2; i += 2) {
      const mx = (X(i) + X(i + 2)) / 2, my = (Y(i) + Y(i + 2)) / 2;
      g.quadraticCurveTo(X(i), Y(i), mx, my);
    }
    if (s.p.length > 2) g.lineTo(X(s.p.length - 2), Y(s.p.length - 2));
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
}

function drawStamp(g: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, accent: string) {
  g.fillStyle = '#ffffff';
  g.fillRect(x, y, w, h);
  g.strokeStyle = '#c9c7bf';
  g.setLineDash([2, 3]);
  g.lineWidth = 2;
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.setLineDash([]);
  const grid = (stamps[key] ?? stamps.crt).grid;
  const cell = (w - 14) / 12;
  const oy = y + (h - cell * 12) / 2;
  grid.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === '.') return;
      g.fillStyle = ch === '#' ? '#161616' : accent;
      g.fillRect(x + 7 + i * cell, oy + j * cell, Math.ceil(cell), Math.ceil(cell));
    }),
  );
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (g.measureText(t).width > max && line) { out.push(line); line = word; }
      else line = t;
    }
    out.push(line);
  }
  return out;
}

/* URL-safe packing so a whole letter (doodle included) fits in a link */
export async function pack(d: LetterData) {
  const bytes = new TextEncoder().encode(JSON.stringify(d));
  let data = bytes, prefix = 'r';
  if ('CompressionStream' in window) {
    const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    data = new Uint8Array(await new Response(cs).arrayBuffer());
    prefix = 'z';
  }
  let bin = '';
  data.forEach((b) => (bin += String.fromCharCode(b)));
  return prefix + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function unpack(s: string): Promise<LetterData> {
  const prefix = s[0];
  const b64 = s.slice(1).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  let bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  if (prefix === 'z') {
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    bytes = new Uint8Array(await new Response(ds).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
