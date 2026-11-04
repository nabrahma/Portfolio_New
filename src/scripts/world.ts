import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

/*
  The world: a single THREE.Points cloud (one draw call).
  kind 0 grass · 1 cloud · 2 object · 3 soil · 4 phosphor (screen, cable) · 5 star
  Everything is stippled points; light/dark only swaps three uniforms.
*/

type Buf = { pos: number[]; nrm: number[]; size: number[]; lum: number[]; kind: number[]; rnd: number[] };
const buf = (): Buf => ({ pos: [], nrm: [], size: [], lum: [], kind: [], rnd: [] });
function push(b: Buf, x: number, y: number, z: number, size: number, lum: number, kind: number, n = [0, 1, 0]) {
  b.pos.push(x, y, z);
  b.nrm.push(n[0], n[1], n[2]);
  b.size.push(size);
  b.lum.push(lum);
  b.kind.push(kind);
  b.rnd.push(Math.random());
}

// tiny deterministic value noise + fbm
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, o = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.02; a *= 0.5; }
  return s;
}

/* ---------------- the field ---------------- */
// The world is a diorama cut open at z = FACE: the field stops at a clean edge, and below it
// the earth's cut face. The camera sinks straight down past that face.
export const FACE = 0.9; // right in front of the chair: the desk sits on the edge

function grass(b: Buf, n: number) {
  for (let i = 0; i < n; i++) {
    const z = FACE - (FACE + 116) * Math.pow(Math.random(), 1.9);
    const spread = 20 + (9 - z) * 0.75;
    const x = (Math.random() * 2 - 1) * spread;
    const clump = fbm(x * 0.25, z * 0.25, 3);
    const y = Math.random() * (0.08 + clump * 0.38);
    const lum = 0.32 + clump * 0.55 + (Math.random() - 0.5) * 0.2;
    push(b, x, y, z, 1.25 + Math.random() * 0.5, lum, 0);
  }
  // faint horizon: tree line and a few poles
  for (let i = 0; i < n * 0.04; i++) {
    const x = (Math.random() * 2 - 1) * 110;
    const h = 0.4 + fbm(x * 0.08, 3.3, 3) * 2.6;
    push(b, x, Math.random() * h, -112 - Math.random() * 6, 1.3, 0.35, 0);
  }
  for (let p = 0; p < 7; p++) {
    const x = -90 + p * 28 + Math.random() * 10;
    for (let i = 0; i < 70; i++) push(b, x, Math.random() * 5.5, -105, 1.2, 0.5, 0);
    for (let i = 0; i < 30; i++) push(b, x + (Math.random() - 0.5) * 1.6, 5.2, -105, 1.1, 0.45, 0);
  }
}

/* ---------------- sky ---------------- */
function sky(b: Buf, n: number) {
  // a long band of cloud, like a stipple engraving
  let made = 0, guard = 0;
  while (made < n && guard++ < n * 12) {
    const x = (Math.random() * 2 - 1) * 120;
    const y = 9 + Math.random() * 26;
    const band = Math.exp(-Math.pow((y - 20) / 7.5, 2));
    const d = fbm(x * 0.035 + 10, y * 0.09, 6) * band;
    if (d < 0.26 || Math.random() > (d - 0.26) * 3.2) continue;
    const z = -95 - Math.random() * 18;
    push(b, x, y, z, 1.6 + Math.random() * 0.6, Math.min(1, 0.35 + (d - 0.26) * 2.6), 1);
    made++;
  }
  for (let i = 0; i < n * 0.08; i++) push(b, (Math.random() * 2 - 1) * 160, 4 + Math.random() * 70, -150, 1.1 + Math.random() * 0.8, 0.3 + Math.random() * 0.5, 5);
}

/* ---------------- the desk, the screen, the person ---------------- */
function figure(b: Buf, density: number, eye: THREE.Vector3) {
  const meshes: { mesh: THREE.Mesh; albedo: number; kind?: number; dens?: number }[] = [];
  const add = (g: THREE.BufferGeometry, p: number[], albedo: number, rot?: number[], opts: { kind?: number; dens?: number } = {}) => {
    const m = new THREE.Mesh(g);
    m.position.set(p[0], p[1], p[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.updateMatrixWorld();
    meshes.push({ mesh: m, albedo, ...opts });
    return m;
  };
  const limb = (a: number[], c: number[], r: number, albedo: number) => {
    const A = new THREE.Vector3(...a), C = new THREE.Vector3(...c);
    const len = A.distanceTo(C);
    const g = new THREE.CapsuleGeometry(r, len, 3, 8);
    const m = new THREE.Mesh(g);
    m.position.copy(A).add(C).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), C.clone().sub(A).normalize());
    m.updateMatrixWorld();
    meshes.push({ mesh: m, albedo });
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

  // desk (wood, warm mid tone) with a side cabinet
  add(box(1.3, 0.05, 0.66), [0, 0.745, -0.62], 0.62);
  add(box(0.42, 0.7, 0.6), [0.42, 0.36, -0.62], 0.55);
  for (const [x, z] of [[-0.6, -0.34], [-0.6, -0.9]]) add(box(0.05, 0.72, 0.05), [x, 0.36, z], 0.5);
  // CRT: body, tapered back, base
  add(box(0.44, 0.38, 0.4), [-0.08, 0.98, -0.74], 0.85);
  add(box(0.32, 0.27, 0.22), [-0.08, 0.97, -1.03], 0.8);
  add(box(0.24, 0.04, 0.22), [-0.08, 0.79, -0.72], 0.7);
  add(box(0.44, 0.025, 0.15), [-0.06, 0.78, -0.4], 0.75); // keyboard
  // the screen glow
  add(new THREE.PlaneGeometry(0.34, 0.27), [-0.08, 0.99, -0.535], 1, undefined, { kind: 4, dens: 2.2 });
  // chair
  add(box(0.46, 0.05, 0.44), [0, 0.46, 0.16], 0.45);
  add(box(0.44, 0.44, 0.04), [0, 0.74, 0.4], 0.45, [-0.08, 0, 0]);
  for (const [x, z] of [[-0.2, -0.03], [0.2, -0.03], [-0.2, 0.36], [0.2, 0.36]]) add(box(0.035, 0.46, 0.035), [x, 0.23, z], 0.4);
  // the person, seen from behind: light shirt, dark trousers, dark hair
  const torso = add(new THREE.CapsuleGeometry(0.165, 0.3, 4, 12), [0, 0.86, 0.17], 0.95, [-0.14, 0, 0]);
  torso.scale.set(1.28, 1, 0.82);
  torso.updateMatrixWorld();
  add(new THREE.SphereGeometry(0.105, 14, 10), [0, 1.29, 0.09], 0.72);
  add(new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), [0, 1.3, 0.095], 0.12); // hair
  limb([0, 1.12, 0.13], [0, 1.2, 0.1], 0.045, 0.7); // neck
  limb([-0.22, 1.02, 0.16], [-0.25, 0.83, -0.06], 0.055, 0.92);
  limb([0.22, 1.02, 0.16], [0.25, 0.83, -0.06], 0.055, 0.92);
  limb([-0.25, 0.83, -0.06], [-0.12, 0.8, -0.36], 0.047, 0.9);
  limb([0.25, 0.83, -0.06], [0.1, 0.8, -0.36], 0.047, 0.9);
  limb([-0.1, 0.52, 0.12], [-0.12, 0.53, -0.3], 0.078, 0.22);
  limb([0.1, 0.52, 0.12], [0.12, 0.53, -0.3], 0.078, 0.22);
  limb([-0.12, 0.53, -0.3], [-0.13, 0.06, -0.33], 0.06, 0.22);
  limb([0.12, 0.53, -0.3], [0.13, 0.06, -0.33], 0.06, 0.22);

  const p = new THREE.Vector3(), nrm = new THREE.Vector3(), dir = new THREE.Vector3();
  const occluders = meshes.filter((m) => m.kind !== 4).map((m) => m.mesh);
  const ray = new THREE.Raycaster();
  // drop samples hidden behind other parts, seen from the hero camera
  const hidden = (q: THREE.Vector3) => {
    dir.copy(q).sub(eye);
    const dist = dir.length();
    ray.set(eye, dir.normalize());
    ray.far = dist - 0.012;
    return ray.intersectObjects(occluders, false).length > 0;
  };
  for (const { mesh, albedo, kind = 2, dens = 1 } of meshes) {
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const area = surfaceArea(g);
    const count = Math.max(40, Math.round(area * density * dens));
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(g)).build();
    for (let i = 0; i < count; i++) {
      sampler.sample(p, nrm);
      if (nrm.dot(dir.copy(eye).sub(p)) < 0 || hidden(p)) continue;
      push(b, p.x, p.y, p.z, kind === 4 ? 1.7 : 1.45, albedo * (0.85 + Math.random() * 0.3), kind, [nrm.x, nrm.y, nrm.z]);
    }
  }
  // the glow spills onto the desk and the person: a soft cone of phosphor
  for (let i = 0; i < density * 0.16; i++) {
    const t = Math.pow(Math.random(), 0.8);
    const x = -0.08 + (Math.random() - 0.5) * (0.36 + t * 1.3);
    const y = 0.99 + (Math.random() - 0.5) * (0.3 + t * 0.9);
    const z = -0.53 + t * 1.1;
    p.set(x, y, z);
    if (hidden(p)) continue;
    push(b, x, y, z, 1.2, 0.34 * (1 - t) + 0.05, 4, [0, 0, 1]);
  }
}

function surfaceArea(g: THREE.BufferGeometry) {
  const pos = g.attributes.position;
  const idx = g.index;
  const a = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  let s = 0;
  const tri = (i0: number, i1: number, i2: number) => {
    a.fromBufferAttribute(pos, i0); c.fromBufferAttribute(pos, i1); d.fromBufferAttribute(pos, i2);
    s += c.sub(a).cross(d.sub(a)).length() / 2;
  };
  if (idx) for (let i = 0; i < idx.count; i += 3) tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
  else for (let i = 0; i < pos.count; i += 3) tri(i, i + 1, i + 2);
  return s;
}

/* ---------------- underground ---------------- */
export const STRATA = { topsoil: -2, subsoil: -14, bedrock: -28, archive: -44 };

// Each band: [top, bottom, density, lum, style]. style 0 dots · 1 hatch · 2 pebbles
const BANDS: [number, number, number, number, number][] = [
  [-0.04, -5.6, 0.9, 0.62, 0], // topsoil: dark, dense, right up to the lip of the cut
  [-5.6, -6.6, 1, 0.95, 1], // a pale seam
  [-6.6, -16.5, 0.38, 0.5, 2], // subsoil with pebbles
  [-16.5, -19.5, 1, 0.8, 1], // clay, hatched
  [-19.5, -36.5, 0.22, 0.42, 0], // bedrock (boulders added below)
  [-36.5, -38.6, 1, 0.9, 1], // the vault ceiling
];

// The camera sinks at x≈0.9, z≈8.2, looking toward −z. Soil fills the volume it looks into,
// so grains near the lens stream past quickly and far ones crawl: real parallax, not a wall.
// once under, the camera moves in to z≈4.2, a few metres off the face
const DIG = { x: 0.9, z: 4.2, near: 4.2 - FACE + 0.05, far: 30 };
function inView(near = DIG.near, far = DIG.far) {
  // uniform through the viewing wedge: more grains far away, where there's more room
  const u = Math.random();
  const d = Math.cbrt(u * (far ** 3 - near ** 3) + near ** 3);
  return { x: DIG.x + (Math.random() * 2 - 1) * (0.8 * d + 0.6), z: DIG.z - d, d };
}

function soil(b: Buf, n: number) {
  // weight each band by its height × density so the total stays near n
  const weights = BANDS.map(([t, bo, d]) => (t - bo) * d * d);
  const sum = weights.reduce((a, c) => a + c, 0);
  BANDS.forEach(([top, bot, , lum, style], bi) => {
    const h = top - bot;
    const cnt = Math.round((n * weights[bi]) / sum);
    for (let i = 0; i < cnt; i++) {
      // 30% texture the cut face itself (moves exactly with the edge); the rest fills the depth behind it
      const onFace = Math.random() < 0.3;
      const { x, z } = onFace ? { x: DIG.x + (Math.random() * 2 - 1) * 8, z: FACE - 0.02 - Math.random() * 0.45 } : inView();
      const wob = (fbm(x * 0.18 + z * 0.07, top * 0.3, 3) - 0.5) * 1.2;
      let y = bot + Math.random() * h;
      // seams are thin sheets: edge-on they read as a line, from above as a floor of dust
      if (style === 1) y = Math.round(y / 0.16) * 0.16 + (Math.random() - 0.5) * 0.02;
      y += wob * (style === 1 ? 0.5 : 0.25);
      if (y > -0.05) continue;
      // face grains sit close to the lens, so keep them fine and a touch dimmer
      const size = onFace ? 0.62 + Math.random() * 0.2 : style === 1 ? 1.15 : 1.2 + Math.random() * 0.5;
      push(b, x, y, z, size, lum * (0.7 + Math.random() * 0.45) * (onFace ? 0.8 : 1), 3);
    }
  });
  // the lip of the cut: a fine, bright seam right under the grass line
  for (let i = 0; i < n * 0.05; i++) {
    push(b, DIG.x + (Math.random() * 2 - 1) * 40, -0.015 - Math.pow(Math.random(), 3) * 0.08, FACE - Math.random() * 0.04, 0.75, 0.45 + Math.random() * 0.25, 3);
  }
  // and a denser skin of topsoil on the face just under it, so the edge never reads as a gap
  for (let i = 0; i < n * 0.04; i++) {
    push(b, DIG.x + (Math.random() * 2 - 1) * 9, -0.04 - Math.pow(Math.random(), 1.6) * 0.9, FACE - Math.random() * 0.15, 0.7, 0.3 + Math.random() * 0.2, 3);
  }
  // pebbles and boulders: noisy blobs, sampled on their surface, scattered through the depth
  for (let r = 0; r < 70; r++) {
    const pebble = r < 42;
    const at = inView(DIG.near + 0.4, pebble ? 14 : 22);
    const cy = pebble ? -7.2 - Math.random() * 9 : -20.5 - Math.random() * 15.5;
    const rad = pebble ? 0.08 + Math.random() * 0.22 : 0.35 + Math.random() * 0.75;
    const cnt = Math.round(rad * rad * 9000);
    for (let i = 0; i < cnt; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const sq = Math.sqrt(1 - u * u);
      const nx = sq * Math.cos(th), ny = u * 0.72, nz = sq * Math.sin(th);
      const k = rad * (0.78 + fbm(nx * 2.2 + r, ny * 2.2 + nz, 3) * 0.55);
      push(b, at.x + nx * k, cy + ny * k, at.z + nz * k, 1.45, 0.95, 2, [nx, ny, nz]);
    }
  }
  // roots hanging from the field, random-walk polylines
  for (let r = 0; r < 26; r++) {
    const at = inView(DIG.near + 0.1, 16);
    let x = at.x, y = -0.2, z = at.z;
    let dx = (Math.random() - 0.5) * 0.3;
    const len = 60 + Math.random() * 160;
    for (let i = 0; i < len; i++) {
      x += dx * 0.06 + (Math.random() - 0.5) * 0.03;
      y -= 0.025 + Math.random() * 0.03;
      dx += (Math.random() - 0.5) * 0.2;
      const w = (1 - i / len) * 0.05;
      for (let k = 0; k < 7; k++) push(b, x + (Math.random() - 0.5) * w, y, z + (Math.random() - 0.5) * w, 1.25, 0.9, 2);
    }
  }
}

/* the CRT's cable, running from the back of the screen down to the archive */
export function cablePath() {
  const pts = [
    [-0.08, 0.92, -1.12], [-0.1, 0.75, -1.2], [-0.2, 0.02, -1.25], [-0.6, -1.5, -0.3],
    [0.4, -5, 0.35], [1.5, -10, 0.55], [-0.6, -16, 0.45], [-1.6, -22, 0.55], [0.6, -28, 0.45],
    [1.2, -34, 0.2], [0, -39.5, -1.6], [0, -41.2, -3.4], // stays behind the cut face
  ].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
}
function cable(top: Buf, under: Buf, n: number) {
  const c = cablePath();
  for (let i = 0; i < n; i++) {
    const t = Math.random();
    const p = c.getPointAt(t);
    const r = 0.06;
    const a = Math.random() * Math.PI * 2;
    push(p.y >= -0.02 ? top : under, p.x + Math.cos(a) * r, p.y + (Math.random() - 0.5) * 0.02, p.z + Math.sin(a) * r, 1.5, t, 4, [0, 0, 1]);
  }
}

/* the archive: a filing cabinet in the vault, one drawer open */
function cabinet(b: Buf, density: number) {
  const parts: [number[], number[], number][] = [
    [[2.4, 3.6, 1.6], [0, -42.9 + 1.8 - 2.5, -4.2], 0.8],
    [[2.2, 0.75, 1.9], [0, -40.6 - 0.2, -2.6], 0.95], // the open drawer
  ];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (const [s, c, alb] of parts) {
    const g = new THREE.BoxGeometry(s[0], s[1], s[2]);
    g.translate(c[0], c[1], c[2]);
    const sm = new MeshSurfaceSampler(new THREE.Mesh(g)).build();
    const cnt = Math.round(surfaceArea(g) * density);
    for (let i = 0; i < cnt; i++) {
      sm.sample(p, n);
      push(b, p.x, p.y, p.z, 1.5, alb, 2, [n.x, n.y, n.z]);
    }
  }
  // drawer seams and handles
  for (let row = 0; row < 3; row++) {
    const y = -41.6 - row * 1.15;
    for (let i = 0; i < 260; i++) push(b, -1.15 + Math.random() * 2.3, y, -3.39, 1.4, 0.95, 2, [0, 0, 1]);
    for (let i = 0; i < 90; i++) push(b, -0.3 + Math.random() * 0.6, y - 0.5, -3.33, 1.6, 1, 4, [0, 0, 1]);
  }
}

/* ---------------- shaders ---------------- */
const vert = /* glsl */ `
  uniform float uTime, uPixel, uScale, uAspect, uMouseK, uRippleT, uFace, uHoverK;
  uniform vec2 uMouse, uHover;
  uniform vec3 uRipple;
  uniform vec3 uLight;
  attribute vec3 aNormal;
  attribute float aSize, aLum, aKind, aRand;
  varying float vA, vKind, vFlick, vHover;
  void main() {
    vec3 p = position;
    float lum = aLum;
    float k = aKind;
    if (k < 0.5) {
      float h = p.y;
      float w = sin(uTime * 1.2 + p.x * 0.32 + p.z * 0.21) * 0.6 + sin(uTime * 2.3 + p.x * 0.9 - p.z * 0.4) * 0.25;
      p.x += w * h * 0.55;
      p.z += w * h * 0.18;
      lum *= 0.78 + 0.32 * sin(uTime * 0.7 + p.x * 0.11 - p.z * 0.19);
      // ripple from a click
      float rt = uTime - uRippleT;
      float d = distance(p.xz, uRipple.xz);
      float ring = exp(-pow(d - rt * 7.0, 2.0) * 0.6) * exp(-rt * 0.9);
      p.y += ring * 0.45 * step(0.0, rt);
      lum += ring * 0.6;
    } else if (k < 1.5) {
      p.x += uTime * 0.18 * (0.6 + aRand * 0.4);
      p.x = mod(p.x + 120.0, 240.0) - 120.0;
    } else if (k > 4.5) {
      lum *= 0.6 + 0.4 * sin(uTime * (0.6 + aRand * 1.4) + aRand * 40.0);
    } else if (k > 1.5 && k < 2.5) {
      float facing = dot(normalize(aNormal), normalize(cameraPosition - p));
      lum *= smoothstep(-0.05, 0.25, facing) * (0.38 + 0.62 * max(dot(normalize(aNormal), uLight), 0.0));
    }
    vFlick = 1.0;
    if (k > 3.5 && k < 4.5) {
      // the screen flickers in scanlines; the cable carries pulses downward
      vFlick = 0.75 + 0.25 * sin(p.y * 220.0 - uTime * 9.0);
      float pulse = fract(aLum * 6.0 - uTime * 0.22);
      lum = (aLum <= 1.0 && p.y < 0.7) ? 0.35 + smoothstep(0.92, 1.0, pulse) * 0.9 : aLum;
    }
    #ifndef UNDER
    // the field dissolves as the camera comes down to meet it, so it never collapses into a
    // hard bright line edge-on; the figure stays, standing on the lip of the cut
    if (k < 0.5) lum *= smoothstep(-0.1, 0.6, cameraPosition.y);
    #endif
    #ifdef UNDER
    // Inside the earth. From above ground a grain is visible only if the line of sight reaches
    // it through the cut face; if it would pass through the field's surface first, it's buried.
    if (cameraPosition.y > 0.0) {
      float t = cameraPosition.y / max(cameraPosition.y - p.y, 1e-4);
      float zc = mix(cameraPosition.z, p.z, t);
      if (zc < uFace) lum = 0.0;
    }
    #endif
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    // the cursor pushes points aside, in screen space
    vec2 ndc = clip.xy / clip.w;
    vec2 dd = ndc - uMouse; dd.x *= uAspect;
    float dist = length(dd);
    float push = smoothstep(0.22, 0.0, dist) * uMouseK * (k < 1.5 || (k > 1.5 && k < 2.5) ? 1.0 : 0.4);
    clip.xy += normalize(dd + 1e-5) * push * 0.05 * clip.w / vec2(uAspect, 1.0);
    // a soft spot of accent follows the pointer
    vec2 hd = ndc - uHover; hd.x *= uAspect;
    vHover = smoothstep(0.17, 0.0, length(hd)) * uHoverK;
    gl_Position = clip;
    float z = -mv.z;
    gl_PointSize = clamp(aSize * uPixel * (uScale / z), 1.0, 5.0 * uPixel);
    if (k < 0.5) gl_PointSize = clamp(aSize * uPixel * (uScale * 0.9 / max(z, 0.5)), 1.0, 3.6 * uPixel);
    if (k > 0.5 && k < 1.5 || k > 4.5) gl_PointSize = aSize * uPixel;
    float fog = (k > 0.5 && k < 1.5 || k > 4.5) ? 1.0 : smoothstep(130.0, 18.0, z);
    vA = clamp(lum, 0.0, 1.0) * fog * smoothstep(0.08, 0.6, z);
    if (k > 2.5 && k < 3.5) vA *= (0.25 + 0.75 * smoothstep(32.0, 4.0, z)) * (0.45 + 0.55 * smoothstep(0.7, 3.0, z));
    vKind = k;
  }
`;
const frag = /* glsl */ `
  uniform vec3 uInk, uAccent;
  uniform float uOpacity;
  varying float vA, vKind, vFlick, vHover;
  void main() {
    if (vA < 0.02) discard;
    bool phos = vKind > 3.5 && vKind < 4.5;
    vec3 c = phos ? uAccent : mix(uInk, uAccent, vHover * 0.9);
    gl_FragColor = vec4(c, vA * (phos ? vFlick : 1.0 + vHover * 0.35) * uOpacity);
  }
`;

/* ---------------- the world ---------------- */
export interface World {
  setProgress(p: number): void;
  setMouse(x: number, y: number, active: boolean): void;
  clearHover(): void;
  ripple(clientX: number, clientY: number): void;
  setColors(ink: string, bg: string, accent: string): void;
  setOpacity(o: number): void;
  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean };
  resize(): void;
  depth(): number;
  /** how far (px) the ground's front edge has moved on screen since the top of the page */
  edgeShift(): number;
  setRunning(on: boolean): void;
  dispose(): void;
}

export function createWorld(canvas: HTMLCanvasElement, opts: { lite: boolean; still: boolean }): World {
  const q = opts.lite ? 0.42 : 1;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  const dpr = Math.min(devicePixelRatio, opts.lite ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  // the canvas's own box, not the window: on phones it's sized to the large viewport (100lvh),
  // so the browser bar sliding in and out doesn't resize, re-project or stretch the world
  const view = { w: canvas.clientWidth || innerWidth, h: canvas.clientHeight || innerHeight };
  const camera = new THREE.PerspectiveCamera(36, view.w / view.h, 0.05, 400);

  const surfaceCam = new THREE.Vector3(2.0, 0.92, 7.9);
  const surfaceLook = new THREE.Vector3(-0.1, 1.3, -3);
  // two clouds: the surface (field, sky, figure) and the earth (soil, roots, cable, vault)
  const top = buf();
  const under = buf();
  grass(top, Math.round(120000 * q));
  sky(top, Math.round(26000 * q));
  figure(top, 16000 * (opts.lite ? 0.6 : 1), surfaceCam);
  soil(under, Math.round(170000 * q));
  cable(top, under, Math.round(15000 * q));
  cabinet(under, 2600 * (opts.lite ? 0.6 : 1));

  const geo = (b: Buf) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('aNormal', new THREE.Float32BufferAttribute(b.nrm, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(b.size, 1));
    g.setAttribute('aLum', new THREE.Float32BufferAttribute(b.lum, 1));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(b.kind, 1));
    g.setAttribute('aRand', new THREE.Float32BufferAttribute(b.rnd, 1));
    g.computeBoundingSphere();
    return g;
  };
  const gTop = geo(top);
  const gUnder = geo(under);

  const uniforms = {
    uTime: { value: 0 },
    uPixel: { value: dpr },
    uScale: { value: 1 },
    uAspect: { value: view.w / view.h },
    uMouse: { value: new THREE.Vector2(9, 9) },
    uMouseK: { value: 0 },
    uRipple: { value: new THREE.Vector3(0, 0, 0) },
    uRippleT: { value: -100 },
    uLight: { value: new THREE.Vector3(-0.4, 0.8, 0.45).normalize() },
    uInk: { value: new THREE.Color('#ecebe6') },
    uAccent: { value: new THREE.Color('#39ff88') },
    uOpacity: { value: 1 },
    uFace: { value: FACE },
    uHover: { value: new THREE.Vector2(9, 9) },
    uHoverK: { value: 0 },
  };
  // draw order: the surface, then the opaque face of the cut over it, then the earth on top.
  // The face hides whatever of the surface sits below the edge line; nothing shows through.
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true, depthWrite: false });
  const matUnder = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, depthTest: false, defines: { UNDER: 1 } });
  const surfacePts = new THREE.Points(gTop, mat);
  const earthPts = new THREE.Points(gUnder, matUnder);
  const faceMat = new THREE.MeshBasicMaterial({ color: '#0a0a0a', transparent: true, depthTest: false, depthWrite: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(900, 120), faceMat);
  face.position.set(0, -60, FACE);
  surfacePts.renderOrder = 0;
  face.renderOrder = 1;
  earthPts.renderOrder = 2;
  for (const o of [surfacePts, face, earthPts]) { o.frustumCulled = false; scene.add(o); }

  // camera path: the surface view, then straight down the cable
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, k: 0, tk: 0, hx: 9, hy: 9, hk: 0, thk: 0 };
  let progress = 0;
  let target = 0; // scroll position; the camera eases toward it so the descent glides
  let running = true;
  // half linear, half smoothstep: leaves the surface promptly, settles softly into the vault
  const ease = (t: number) => 0.5 * t + 0.5 * t * t * (3 - 2 * t);
  const sm = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
  // starts from rest: speeds up over the first 12% of the scroll, then runs straight (C1, no kink)
  const ramp = (t: number) => (t < 0.12 ? (t * t) / 0.24 : t - 0.06) / 0.94;

  // where the camera is (without the mouse sway) at a given scroll progress
  function pose(p: number, pos: THREE.Vector3, look: THREE.Vector3) {
    const s = ease(ramp(Math.min(1, Math.max(0, p))));
    const y = THREE.MathUtils.lerp(surfaceCam.y, -40.2, s);
    // straight down past the edge first, then ease in toward the face once the field is gone
    pos.set(THREE.MathUtils.lerp(surfaceCam.x, DIG.x, s), y, THREE.MathUtils.lerp(surfaceCam.z, DIG.z, sm((s - 0.035) / 0.2)));
    // look slightly down while passing the ground, then level, then down at the vault
    // on tall portrait screens, tilt down so the figure rides above the headline
    const portrait = camera.aspect < 0.8 ? -1.15 : 0;
    const lookY = y + THREE.MathUtils.lerp(surfaceLook.y - surfaceCam.y + portrait, 0, sm(s * 6)) - sm((s - 0.86) / 0.14) * 1.1;
    look.set(THREE.MathUtils.lerp(surfaceLook.x, 0, s), lookY, THREE.MathUtils.lerp(surfaceLook.z, -3, s));
  }

  function place() {
    pose(progress, camPos, camLook);
    camera.position.set(camPos.x + mouse.x * 0.35, camPos.y + mouse.y * 0.14, camPos.z);
    camera.lookAt(camLook);
  }

  // screen y of the field's front edge, seen from a given pose (no mouse sway)
  const probe = new THREE.PerspectiveCamera();
  const restPos = new THREE.Vector3(), restLook = new THREE.Vector3(), pv = new THREE.Vector3();
  function edgeY(pos: THREE.Vector3, look: THREE.Vector3) {
    probe.copy(camera);
    probe.position.copy(pos);
    probe.lookAt(look);
    probe.updateMatrixWorld();
    pv.set(pos.x, 0, FACE).project(probe);
    return ((1 - pv.y) / 2) * view.h;
  }

  let sized = '';
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (`${w}x${h}` === sized) return; // nothing changed (a phone's bar moving, say)
    sized = `${w}x${h}`;
    view.w = w;
    view.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the figure framed on tall phones
    camera.fov = w / h < 0.8 ? 52 : 36;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = w / h;
    uniforms.uScale.value = (h / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.0052;
  }
  resize();

  let last = performance.now();
  function tick() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!opts.still) uniforms.uTime.value += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    mouse.k += (mouse.tk - mouse.k) * 0.08;
    progress += (target - progress) * (1 - Math.exp(-dt * 4.5));
    if (Math.abs(target - progress) < 1e-5) progress = target;
    uniforms.uMouse.value.set(mouse.tx, mouse.ty);
    // the accent spot trails the pointer a little, and fades in and out
    mouse.hx += (mouse.tx - mouse.hx) * 0.22;
    mouse.hy += (mouse.ty - mouse.hy) * 0.22;
    mouse.hk += (mouse.thk - mouse.hk) * 0.08;
    uniforms.uHover.value.set(mouse.hx, mouse.hy);
    uniforms.uHoverK.value = mouse.hk;
    uniforms.uMouseK.value = mouse.k * Math.max(0, 1 - progress * 6);
    place();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(tick);

  const v = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  return {
    setProgress(p) {
      target = p;
      if (!running || opts.still) { progress = p; place(); }
    },
    setMouse(x, y, active) {
      if (mouse.thk === 0) { mouse.hx = x; mouse.hy = y; } // don't sweep in from far away
      mouse.tx = x; mouse.ty = y; mouse.tk = active ? 1 : 0; mouse.thk = 1;
    },
    clearHover() { mouse.thk = 0; },
    ripple(cx, cy) {
      ray.setFromCamera(new THREE.Vector2((cx / view.w) * 2 - 1, -(cy / view.h) * 2 + 1), camera);
      const hit = ray.ray.intersectPlane(ground, v);
      if (!hit) return;
      uniforms.uRipple.value.copy(hit);
      uniforms.uRippleT.value = uniforms.uTime.value;
    },
    setColors(ink, bg, accent) {
      uniforms.uInk.value.set(ink);
      uniforms.uAccent.value.set(accent);
      renderer.setClearColor(new THREE.Color(bg), 1);
      faceMat.color.set(bg);
    },
    setOpacity(o) { uniforms.uOpacity.value = o; canvas.style.opacity = String(Math.min(1, o * 1.5)); },
    project(x, y, z) {
      v.set(x, y, z).project(camera);
      return { x: (v.x + 1) / 2 * view.w, y: (1 - v.y) / 2 * view.h, visible: v.z < 1 };
    },
    resize,
    depth: () => camPos.y - surfaceCam.y,
    edgeShift() {
      pose(0, restPos, restLook);
      return Math.max(-view.h * 3, edgeY(camPos, camLook) - edgeY(restPos, restLook));
    },
    setRunning(on) {
      if (on === running) return;
      running = on;
      if (on) last = performance.now();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      for (const d of [gTop, gUnder, mat, matUnder, face.geometry, faceMat]) d.dispose();
      renderer.dispose();
    },
  };
}
