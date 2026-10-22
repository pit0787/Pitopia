// Kite Kart – Kitesurf-Rennspiel
(() => {
'use strict';

// ===================================================================
// Hilfsfunktionen
// ===================================================================
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const fmtTime = (t) => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
const fmtDist = (m) => (m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m / 10) * 10 + ' m');
const fmtClock = (t) => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

const GRAV = 32;           // Schwerkraft beim Sprung
const KITE_HIT = 4.6;      // Abstand, ab dem sich zwei Kites verheddern
const KITE_DIST = 8;       // waagrechter Abstand Kite – Fahrer
const KITE_H = 13;         // Flughöhe des Kites
const EDGE_BOOST = 1.3;    // Tempo-Multiplikator beim Ankanten
const POWER_REGEN = 7;     // Kraft pro Sekunde ohne Ankanten
const JUMP_COST = 10;
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// Wind: Einheitsvektor in die Richtung, in die er weht, plus Böen
const wind = { x: 0, z: 1, gust: 1, base: 0 };
function setWind(deg) { const a = deg * Math.PI / 180; wind.x = Math.sin(a); wind.z = Math.cos(a); }
// Tempo-Faktor je nach Kurs zum Wind: Halbwind am schnellsten, gegen den Wind langsam
function windFactor(fx, fz) {
  const up = -(fx * wind.x + fz * wind.z);          // 1 = direkt gegen den Wind
  return 1 + 0.06 * (1 - up * up) - 0.17 * Math.max(0, up) ** 2;
}
const waveH = (x, z, t) => 0.35 * Math.sin(x * 0.08 + t * 1.3) + 0.25 * Math.sin(z * 0.11 - t * 1.1);

// ===================================================================
// Renderer, Szene, Licht
// ===================================================================
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, 1, 0.5, 2600);
scene.add(new THREE.HemisphereLight(0xffffff, 0x5aaccc, 0.7));
scene.add(new THREE.AmbientLight(0xffffff, 0.12));
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(0.5, 1, 0.35);
scene.add(sun);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Toon-Shading (3 Stufen) für den runden Comic-Look
const gradTex = (() => {
  const d = new Uint8Array([120, 120, 120, 255, 195, 195, 195, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
const matCache = new Map();
function toon(color, extra) {
  const key = color + (extra ? JSON.stringify(extra) : '');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: gradTex }, extra)));
  return matCache.get(key);
}
const GEO = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  sphereLo: new THREE.SphereGeometry(1, 8, 6),
  cone: new THREE.ConeGeometry(1, 1, 14),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
};
const SHARED_GEO = new Set(Object.values(GEO));
function ball(color, r, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(GEO.sphere, toon(color));
  m.scale.set(r * sx, r * sy, r * sz);
  m.position.set(x, y, z);
  return m;
}

// Statische Deko wird zu InstancedMeshes zusammengefasst (wenige Draw-Calls fürs Handy)
class Batch {
  constructor() { this.groups = new Map(); }
  bake(obj) {
    obj.updateMatrixWorld(true);
    obj.traverse((m) => {
      if (!m.isMesh) return;
      const key = m.geometry.uuid + '|' + m.material.uuid;
      if (!this.groups.has(key)) this.groups.set(key, { geo: m.geometry, mat: m.material, list: [] });
      this.groups.get(key).list.push(m.matrixWorld.clone());
    });
  }
  build(parent) {
    for (const g of this.groups.values()) {
      const im = new THREE.InstancedMesh(g.geo, g.mat, g.list.length);
      g.list.forEach((mtx, i) => im.setMatrixAt(i, mtx));
      im.instanceMatrix.needsUpdate = true;
      parent.add(im);
    }
  }
}

// ===================================================================
// Audio (kleine Pieptöne)
// ===================================================================
let actx = null;
function beep(freq, dur = 0.12, type = 'sine', vol = 0.12, slide = 0) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, actx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), actx.currentTime + dur);
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch (e) { /* kein Audio verfügbar */ }
}

// ===================================================================
// Strecken-Geometrie
// ===================================================================
const pathCache = {};
const START_IDX = 30;      // Startlinie (Stützpunkte à ca. 2 m)
const RUNOUT = 75;         // Auslauf hinter der Ziellinie
function computePath(def) {
  if (pathCache[def.id]) return pathCache[def.id];
  // Geraden und Kreisbögen im Abstand von ~2 m abtasten
  const px = [0], pz = [0], arcs = [];
  let cx = 0, cz = 0, h = 0;
  const step = (d, dh) => { h -= dh; cx += Math.sin(h) * d; cz += Math.cos(h) * d; px.push(cx); pz.push(cz); };
  for (const [len, deg, R = 80] of def.legs) {
    const sl = len * (def.straightScale || 1), n = Math.max(1, Math.round(sl / 2));
    for (let i = 0; i < n; i++) step(sl / n, 0);
    if (deg) {
      const a = deg * Math.PI / 180, arc = Math.abs(a) * R, m = Math.max(2, Math.round(arc / 2));
      const i0 = px.length - 1;
      for (let i = 0; i < m; i++) step(arc / m, a / m);
      arcs.push({ i0, i1: px.length - 1, deg });
    }
  }
  const N = px.length;
  const x = Float32Array.from(px), z = Float32Array.from(pz);
  const tx = new Float32Array(N), tz = new Float32Array(N), curv = new Float32Array(N);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, L = 0;
  for (let i = 0; i < N; i++) {
    minX = Math.min(minX, x[i]); maxX = Math.max(maxX, x[i]);
    minZ = Math.min(minZ, z[i]); maxZ = Math.max(maxZ, z[i]);
    if (i) L += Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]);
  }
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
    const dx = x[b] - x[a], dz = z[b] - z[a], l = Math.hypot(dx, dz) || 1;
    tx[i] = dx / l; tz[i] = dz / l;
  }
  for (let i = 0; i < N; i++) {
    const j = Math.min(N - 1, i + 12);
    curv[i] = Math.abs(wrapAngle(Math.atan2(tx[j], tz[j]) - Math.atan2(tx[i], tz[i])));
  }
  const finishIdx = N - 1 - RUNOUT;
  const raceLen = (finishIdx - START_IDX) * (L / (N - 1));
  return (pathCache[def.id] = { def, N, L, x, z, tx, tz, curv, minX, maxX, minZ, maxZ, width: def.width, finishIdx, raceLen, spacing: L / (N - 1), arcs });
}

// ===================================================================
// Welt (Wasser, Inseln, Bojen, Itemboxen, Ziel)
// ===================================================================
let world = null;       // THREE.Group der aktuellen Strecke
let path = null;        // Streckendaten
let waterMat = null;
let itemBoxes = [];
let worldTime = 0;
// Boardercross-Elemente der Strecke
let ramps = [], gates = [], rocks = [], gusts = [], shortcuts = [];
const SC_HALF = 9;         // halbe Breite einer Abkürzungs-Rinne
function segInfo(x, z, s) {
  const vx = s.bx - s.ax, vz = s.bz - s.az;
  const t = clamp(((x - s.ax) * vx + (z - s.az) * vz) / (vx * vx + vz * vz), 0, 1);
  const qx = s.ax + vx * t, qz = s.az + vz * t;
  return { d: Math.hypot(x - qx, z - qz), qx, qz };
}
const gustTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  gr.addColorStop(0, 'rgba(190,255,255,.7)'); gr.addColorStop(0.75, 'rgba(120,230,255,.45)'); gr.addColorStop(1, 'rgba(120,230,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 6; g.lineCap = 'round';
  for (let k = 0; k < 7; k++) { const x = 18 + k * 15, y = (k * 37) % 70 + 14; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 34); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping;
  return t;
})();
const gustMat = new THREE.MeshBasicMaterial({ map: gustTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const gustGeo = new THREE.CircleGeometry(1, 32);

const qTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '900 96px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = '#1b7fa3'; g.strokeText('?', 64, 70);
  g.fillStyle = '#fff'; g.fillText('?', 64, 70);
  return new THREE.CanvasTexture(c);
})();
const boxMat = new THREE.MeshPhongMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, shininess: 120, specular: 0xffffff, depthWrite: false });
const shieldMat = new THREE.MeshPhongMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.3, shininess: 120, specular: 0xffffff, depthWrite: false });

function skyTexture(c1, c2) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#' + new THREE.Color(c1).getHexString());
  gr.addColorStop(1, '#' + new THREE.Color(c2).getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  return new THREE.CanvasTexture(c);
}

function palm(rnd) {
  const g = new THREE.Group();
  const lean = 0.15 + rnd() * 0.25;
  let px = 0, py = 0;
  for (let i = 0; i < 6; i++) {
    g.add(ball(0x9c6b3f, 0.55 - i * 0.03, px, py, 0));
    py += 0.85; px += lean * i * 0.13;
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + rnd() * 0.3;
    const leaf = ball(k % 2 ? 0x3fbf5a : 0x2fa64a, 1, px + Math.sin(a) * 1.3, py, Math.cos(a) * 1.3, 0.5, 0.13, 2.0);
    leaf.rotation.order = 'YXZ'; leaf.rotation.y = a; leaf.rotation.x = 0.4;
    g.add(leaf);
  }
  for (let k = 0; k < 3; k++) g.add(ball(0x6b4226, 0.28, px + Math.sin(k * 2.1) * 0.35, py - 0.35, Math.cos(k * 2.1) * 0.35));
  return g;
}

function buildWorld(def) {
  if (world) {
    scene.remove(world);
    world.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      else if (o.isMesh && !SHARED_GEO.has(o.geometry)) o.geometry.dispose();
    });
    if (waterMat) { waterMat.uniforms.uTrack.value.dispose(); waterMat.dispose(); }
  }
  path = computePath(def);
  wind.base = def.wind + (Math.random() * 2 - 1) * 20;
  setWind(wind.base);
  world = new THREE.Group();
  scene.add(world);
  const rnd = mulberry32(hashStr(def.id));
  const W = path.width;

  // --- Abkürzungen: Rinne quer durch enge Kurven
  shortcuts = path.arcs.filter((a) => Math.abs(a.deg) >= 100).map((a) => {
    const entry = Math.max(START_IDX + 20, a.i0 - 8), exit = Math.min(path.finishIdx - 20, a.i1 + 8);
    return { entry, exit, ax: path.x[entry], az: path.z[entry], bx: path.x[exit], bz: path.z[exit] };
  });

  // --- Himmel & Nebel
  scene.background = skyTexture(def.sky[0], def.sky[1]);
  scene.fog = new THREE.Fog(def.sky[1], 260, 950);

  // --- Inseln planen (abseits der Strecke)
  const spanX = path.maxX - path.minX, spanZ = path.maxZ - path.minZ;
  const cx = (path.minX + path.maxX) / 2, cz = (path.minZ + path.maxZ) / 2;
  const islands = [];
  const distToTrack = (x, z) => {
    let best = Infinity;
    for (let i = 0; i < path.N; i += 3) best = Math.min(best, Math.hypot(x - path.x[i], z - path.z[i]));
    for (const s of shortcuts) best = Math.min(best, segInfo(x, z, s).d);
    return best;
  };
  const islandCount = Math.round(path.L / 110);
  for (let t = 0; t < islandCount * 8 && islands.length < islandCount; t++) {
    const r = 9 + rnd() * 24;
    const i = Math.floor(rnd() * path.N), side = rnd() < 0.5 ? -1 : 1, off = side * (W / 2 + r + 30 + rnd() * 160);
    const x = path.x[i] - path.tz[i] * off, z = path.z[i] + path.tx[i] * off;
    if (distToTrack(x, z) < W / 2 + r + 30) continue;
    if (islands.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 18)) continue;
    islands.push({ x, z, r });
  }

  // --- Wasser mit Fahrrinne (Canvas-Maske: R = Fahrrinne, G = Sandbank, B = Schaumkante)
  const margin = 300;
  const size = Math.max(spanX, spanZ) + margin * 2;
  const bx = cx - size / 2, bz = cz - size / 2;
  const TS = 2048, ppu = TS / size;
  const mc = document.createElement('canvas'); mc.width = mc.height = TS;
  const g = mc.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, TS, TS);
  for (const is of islands) {
    const px = (is.x - bx) * ppu, pz = (is.z - bz) * ppu, rr = (is.r + 14) * ppu;
    const gr = g.createRadialGradient(px, pz, rr * 0.45, px, pz, rr);
    gr.addColorStop(0, 'rgba(0,255,0,1)'); gr.addColorStop(1, 'rgba(0,255,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(px, pz, rr, 0, TAU); g.fill();
  }
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const s of shortcuts) {
    g.beginPath(); g.moveTo((s.ax - bx) * ppu, (s.az - bz) * ppu); g.lineTo((s.bx - bx) * ppu, (s.bz - bz) * ppu);
    g.lineWidth = SC_HALF * 2 * ppu; g.strokeStyle = 'rgb(150,0,0)'; g.stroke();
  }
  const tracePath = () => {
    g.beginPath();
    for (let k = 0; k < path.N; k++) {
      const px = (path.x[k] - bx) * ppu, pz = (path.z[k] - bz) * ppu;
      if (k === 0) g.moveTo(px, pz); else g.lineTo(px, pz);
    }
  };
  tracePath(); g.lineWidth = (W + 4) * ppu; g.strokeStyle = 'rgb(255,0,255)'; g.stroke();
  tracePath(); g.lineWidth = (W - 2) * ppu; g.strokeStyle = 'rgb(255,0,0)'; g.stroke();
  const maskTex = new THREE.CanvasTexture(mc);
  maskTex.flipY = false;
  maskTex.minFilter = THREE.LinearFilter;

  waterMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTrack: { value: maskTex },
      uBounds: { value: new THREE.Vector4(bx, bz, size, size) },
      uDeep: { value: new THREE.Color(def.water[0]) },
      uShallow: { value: new THREE.Color(def.water[1]) },
      uSand: { value: new THREE.Color(def.sand) },
      uFog: { value: new THREE.Color(def.sky[1]) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vW; varying float vH;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float h = 0.35 * sin(w.x * 0.08 + uTime * 1.3) + 0.25 * sin(w.z * 0.11 - uTime * 1.1);
        w.y += h; vH = h; vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uTime; uniform sampler2D uTrack; uniform vec4 uBounds;
      uniform vec3 uDeep, uShallow, uSand, uFog;
      varying vec3 vW; varying float vH;
      void main() {
        vec2 uv = (vW.xz - uBounds.xy) / uBounds.zw;
        vec4 m = texture2D(uTrack, clamp(uv, 0.0, 1.0));
        vec3 col = mix(uShallow, uDeep, m.r);
        float g = m.g;
        col = mix(col, uShallow * 1.1 + 0.1, smoothstep(0.0, 0.35, g));
        col = mix(col, vec3(1.0), smoothstep(0.3, 0.42, g) * (1.0 - smoothstep(0.5, 0.62, g)) * 0.85);
        col = mix(col, uSand, smoothstep(0.6, 0.72, g));
        col = mix(col, vec3(1.0), m.b * 0.5);
        col += 0.09 * smoothstep(0.2, 0.5, vH);
        float sp = sin(vW.x * 0.45 + uTime * 1.7 + sin(vW.z * 0.21)) * sin(vW.z * 0.4 - uTime * 1.3 + sin(vW.x * 0.17));
        col = mix(col, vec3(1.0), step(0.965, sp) * 0.55);
        float d = distance(vW, cameraPosition);
        col = mix(col, uFog, smoothstep(260.0, 950.0, d));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const wGeo = new THREE.PlaneGeometry(size + 1800, size + 1800, 256, 256);
  wGeo.rotateX(-Math.PI / 2);
  wGeo.translate(cx, 0, cz);
  const water = new THREE.Mesh(wGeo, waterMat);
  world.add(water);

  // --- Deko sammeln
  const batch = new Batch();
  for (const is of islands) {
    const grp = new THREE.Group();
    grp.position.set(is.x, 0, is.z);
    grp.add(ball(def.sand, is.r, 0, 0, 0, 1, 0.3, 1));
    grp.add(ball(0x5cc96a, is.r * 0.72, 0, is.r * 0.06, 0, 1, 0.42, 1));
    const palms = Math.max(1, Math.round(is.r / 9));
    for (let p = 0; p < palms; p++) {
      const a = rnd() * TAU, d = rnd() * is.r * 0.4;
      const pm = palm(rnd);
      pm.position.set(Math.sin(a) * d, is.r * 0.32, Math.cos(a) * d);
      pm.scale.setScalar(1.3 + rnd() * 0.7);
      pm.rotation.y = rnd() * TAU;
      grp.add(pm);
    }
    for (let k = 0; k < 3; k++) {
      const a = rnd() * TAU;
      grp.add(ball(0xb7a99a, 1.5 + rnd() * 2, Math.sin(a) * is.r * 0.85, 0.5, Math.cos(a) * is.r * 0.85, 1, 0.7, 1));
    }
    batch.bake(grp);
  }
  // Ferne Hügel links und rechts der Strecke
  for (let k = 0; k < path.L / 140; k++) {
    const i = Math.floor(rnd() * path.N), s = 60 + rnd() * 90, off = (rnd() < 0.5 ? -1 : 1) * (W / 2 + s + 260 + rnd() * 250);
    const hx = path.x[i] - path.tz[i] * off, hz = path.z[i] + path.tx[i] * off;
    if (distToTrack(hx, hz) < s + W / 2 + 120) continue;
    const hill = new THREE.Group();
    hill.position.set(hx, 0, hz);
    hill.add(ball(0x4fae6a, s, 0, 0, 0, 1, 0.55 + rnd() * 0.3, 1));
    hill.add(ball(def.sand, s * 1.08, 0, 0, 0, 1, 0.12, 1));
    batch.bake(hill);
  }
  // Bojen am Streckenrand
  const step = 11;
  for (let i = 0; i < path.N; i += step) {
    for (const side of [-1, 1]) {
      const off = side * (W / 2 + 1.5);
      const col = (i / step) % 2 ? 0xff5a4f : (side < 0 ? 0xffffff : 0xffd23f);
      batch.bake(ball(col, 0.85, path.x[i] - path.tz[i] * off, 0.25, path.z[i] + path.tx[i] * off));
    }
  }
  // Start- und Ziel-Bogen aus aufblasbaren Kugeln
  const arch = (i, label, c1, c2) => {
    const R = W / 2 + 3, rx = -path.tz[i], rz = path.tx[i];
    for (let k = 0; k <= 34; k++) {
      const a = (k / 34) * Math.PI;
      batch.bake(ball(k % 2 ? c1 : c2, 1.6, path.x[i] + rx * Math.cos(a) * R, Math.sin(a) * R * 0.8, path.z[i] + rz * Math.cos(a) * R));
    }
    const bc = document.createElement('canvas'); bc.width = 512; bc.height = 64;
    const b = bc.getContext('2d');
    for (let k = 0; k < 32; k++) for (let j = 0; j < 4; j++) { b.fillStyle = (k + j) % 2 ? '#222' : '#fff'; b.fillRect(k * 16, j * 16, 16, 16); }
    b.fillStyle = '#ffd23f'; b.fillRect(150, 6, 212, 52);
    b.font = '900 40px system-ui, sans-serif'; b.textAlign = 'center'; b.textBaseline = 'middle'; b.fillStyle = '#6b3b00';
    b.fillText(label, 256, 34);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.1, R * 1.1 / 8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), side: THREE.DoubleSide, fog: false }));
    banner.position.set(path.x[i], R * 0.8 - 1.8, path.z[i]);
    banner.rotation.y = Math.atan2(path.tx[i], path.tz[i]) + Math.PI;   // lesbar für ankommende Fahrer
    world.add(banner);
  };
  arch(START_IDX, 'START', 0xffffff, 0x3fbf5a);
  arch(path.finishIdx, 'ZIEL', 0xffffff, 0xff4f4f);

  // --- Boardercross-Elemente: Wellen, Bojen-Tore, Felsen, Böen-Felder
  ramps = []; gates = []; rocks = []; gusts = [];
  const taken = [];
  for (let i = START_IDX + 110; i < path.finishIdx - 40; i += 250) taken.push({ i, lat: 0, r: W });   // Itembox-Reihen
  for (const s of shortcuts) taken.push({ i: s.entry, lat: 0, r: W }, { i: s.exit, lat: 0, r: W });
  const free = (i, lat, r) => taken.every((t) => Math.hypot((t.i - i) * path.spacing, t.lat - lat) > t.r / 2 + r + 6);
  const place = (from, every, maxCurv, size, latRange, make) => {
    for (let i = START_IDX + from; i < path.finishIdx - 50; i += every + Math.floor(rnd() * every * 0.4)) {
      if (path.curv[i] > maxCurv) continue;
      for (let tries = 0; tries < 6; tries++) {
        const lat = (rnd() * 2 - 1) * W * latRange;
        if (!free(i, lat, size)) continue;
        taken.push({ i, lat, r: size * 2 });
        const p = trackPoint(i, lat);
        make({ idx: i, lat, x: p.x, z: p.z, h: p.h, tx: path.tx[i], tz: path.tz[i] });
        break;
      }
    }
  };
  place(90, 170, 0.35, 8, 0.28, (f) => {          // Welle als Sprungschanze
    f.len = 9; f.wide = 12; ramps.push(f);
    const grp = new THREE.Group(); grp.position.set(f.x, 0, f.z); grp.rotation.y = f.h;
    grp.add(ball(def.water[1], 1, 0, -0.2, 0, f.wide / 2, 1.9, f.len / 2));
    grp.add(ball(0xffffff, 1, 0, 1.2, -0.4, f.wide / 2 * 0.85, 0.5, 1.3));
    for (let k = -2; k <= 2; k++) grp.add(ball(0xffffff, 0.55, k * 2.4, 1.5, -1.2 + Math.abs(k) * 0.3));
    batch.bake(grp);
  });
  place(180, 200, 0.4, 9, 0.25, (f) => {          // Bojen-Tor
    f.gap = 13; gates.push(f);
    for (const sd of [-1, 1]) {
      const grp = new THREE.Group();
      grp.position.set(f.x - path.tz[f.idx] * sd * f.gap / 2, 0, f.z + path.tx[f.idx] * sd * f.gap / 2);
      grp.add(ball(0xff9f1c, 1.7, 0, 0.6, 0, 1, 1.15, 1), ball(0xffffff, 1.0, 0, 2.4, 0), ball(0xff9f1c, 0.55, 0, 3.6, 0));
      batch.bake(grp);
    }
  });
  place(140, 140, 1, 4, 0.4, (f) => {             // Felsen
    f.r = 2.4 + rnd() * 1.4; rocks.push(f);
    const grp = new THREE.Group(); grp.position.set(f.x, 0, f.z); grp.rotation.y = rnd() * TAU;
    grp.add(ball(0x8d8f99, f.r, 0, 0, 0, 1, 0.75, 0.9), ball(0xa3a6b0, f.r * 0.55, f.r * 0.45, f.r * 0.3, 0.2), ball(0x5cc96a, f.r * 0.35, -0.2, f.r * 0.62, 0, 1, 0.4, 1));
    batch.bake(grp);
  });
  place(70, 220, 1, 9, 0.3, (f) => {              // Böen-Feld
    f.r = 9; gusts.push(f);
    const m = new THREE.Mesh(gustGeo, gustMat);
    m.scale.setScalar(f.r); m.position.set(f.x, 0.75, f.z); m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2;
    world.add(m); f.mesh = m;
  });
  gates.sort((a, b) => a.idx - b.idx);
  // Grüne Bojen entlang der Abkürzungen
  for (const s of shortcuts) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az), ux = (s.bx - s.ax) / len, uz = (s.bz - s.az) / len;
    for (let d = 10; d < len - 10; d += 12) {
      for (const sd of [-1, 1]) batch.bake(ball(0x7be35d, 0.8, s.ax + ux * d - uz * sd * (SC_HALF + 1), 0.25, s.az + uz * d + ux * sd * (SC_HALF + 1)));
    }
  }
  // Wolken
  const cloudMat = toon(0xffffff, { fog: false });
  for (let k = 0; k < path.L / 160; k++) {
    const i = Math.floor(rnd() * path.N), off = (rnd() * 2 - 1) * 500;
    const cl = new THREE.Group();
    cl.position.set(path.x[i] - path.tz[i] * off, 90 + rnd() * 70, path.z[i] + path.tx[i] * off);
    for (let j = 0; j < 4; j++) {
      const m = new THREE.Mesh(GEO.sphereLo, cloudMat);
      const s = 10 + rnd() * 10;
      m.scale.set(s * 1.3, s * 0.8, s);
      m.position.set((j - 1.5) * 13 + rnd() * 4, rnd() * 5, rnd() * 8);
      cl.add(m);
    }
    batch.bake(cl);
  }
  batch.build(world);

  // --- Itemboxen: alle ~500 m eine Reihe quer über die Strecke
  itemBoxes = [];
  for (let i = START_IDX + 110; i < path.finishIdx - 40; i += 250) {
    for (const l of [-0.36, -0.18, 0, 0.18, 0.36]) {
      const off = l * W;
      const x = path.x[i] - path.tz[i] * off, z = path.z[i] + path.tx[i] * off;
      const grp = new THREE.Group();
      const shell = new THREE.Mesh(GEO.sphere, boxMat); shell.scale.setScalar(1.6);
      const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: qTex, depthWrite: false })); q.scale.setScalar(1.9);
      grp.add(q, shell);
      grp.position.set(x, 2, z);
      world.add(grp);
      itemBoxes.push({ x, z, grp, off: 0, phase: rnd() * TAU });
    }
  }

  // Kite-Leinen aller Fahrer in einem Objekt
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 4 * 3), 3));
  kiteLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2b3a55, transparent: true, opacity: 0.65 }));
  kiteLines.frustumCulled = false;
  world.add(kiteLines);

  buildMinimapBase();
}
let kiteLines = null;

// Bodenpunkt und Fahrtrichtung für eine Position auf der Strecke
// Reststrecke bis zum Ziel in Metern
const remaining = (r) => Math.max(0, (path.finishIdx - r.idx) * path.spacing);

function trackPoint(i, lat) {
  i = clamp(Math.round(i), 0, path.N - 1);
  return { x: path.x[i] - path.tz[i] * lat, z: path.z[i] + path.tx[i] * lat, h: Math.atan2(path.tx[i], path.tz[i]) };
}

// ===================================================================
// Charakter-Modelle
// ===================================================================
function buildKiteGeometry(c1, c2) {
  const seg = 14, R = 3.6, A = 1.15;
  const pos = [], col = [];
  const C1 = new THREE.Color(c1), C2 = new THREE.Color(c2);
  const pt = (u, front) => {
    const a = u * A, chord = 2.0 * (1 - 0.45 * u * u);
    return [Math.sin(a) * R, Math.cos(a) * R - R, front ? chord * 0.6 : -chord * 0.4];
  };
  for (let i = 0; i < seg; i++) {
    const u0 = (i / seg) * 2 - 1, u1 = ((i + 1) / seg) * 2 - 1;
    const a = pt(u0, true), b = pt(u0, false), c = pt(u1, true), d = pt(u1, false);
    const cc = (i === 0 || i === seg - 1 || i === 6 || i === 7) ? C2 : C1;
    pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    for (let k = 0; k < 6; k++) col.push(cc.r, cc.g, cc.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

function eyes(parent, x, y, z, r = 0.2) {
  for (const s of [-1, 1]) {
    parent.add(ball(0xffffff, r, s * x, y, z));
    parent.add(ball(0x1a1a2e, r * 0.5, s * x, y + r * 0.1, z + r * 0.8));
  }
}

function buildRiderMesh(def) {
  const root = new THREE.Group();
  const tg = new THREE.Group();                // Trick-/Sturz-Rotation
  root.add(tg);
  const board = new THREE.Group();
  board.add(ball(def.board, 1, 0, 0.15, 0, 0.8, 0.14, 2.2));
  board.add(ball(0xffffff, 1, 0, 0.2, 0, 0.35, 0.1, 1.6));
  tg.add(board);
  const body = new THREE.Group();
  tg.add(body);
  const c = def.color, b = def.belly;
  body.add(ball(c, 0.32, -0.45, 0.42, 0.1, 1, 0.7, 1.3), ball(c, 0.32, 0.45, 0.42, 0.1, 1, 0.7, 1.3));
  body.add(ball(c, 0.85, 0, 1.25, 0, 1, 1.1, 0.9));
  body.add(ball(b, 0.62, 0, 1.15, 0.36, 1, 1.15, 0.6));
  const head = new THREE.Group();
  head.position.set(0, 2.35, 0);
  body.add(head);
  // Hände + Lenkstange
  const handColor = def.species === 'crab' ? c : (def.species === 'gull' ? 0xffb81c : c);
  const handR = def.species === 'crab' ? 0.42 : 0.22;
  body.add(ball(handColor, handR, -0.6, 1.6, 0.9), ball(handColor, handR, 0.6, 1.6, 0.9));
  const bar = new THREE.Mesh(GEO.cyl, toon(0x2b3a55));
  bar.scale.set(0.06, 1.9, 0.06); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.62, 1.0);
  body.add(bar);

  switch (def.species) {
    case 'penguin': {
      head.add(ball(c, 0.7));
      head.add(ball(b, 0.5, 0, -0.05, 0.3, 1.1, 1, 0.8));
      eyes(head, 0.24, 0.12, 0.56);
      const beak = new THREE.Mesh(GEO.cone, toon(0xff9f1c));
      beak.scale.set(0.17, 0.45, 0.17); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.08, 0.82);
      head.add(beak);
      break;
    }
    case 'seal': {
      head.add(ball(c, 0.7));
      head.add(ball(b, 0.33, 0, -0.2, 0.55, 1.3, 0.8, 1));
      head.add(ball(0x1a1a2e, 0.11, 0, -0.08, 0.85));
      eyes(head, 0.26, 0.15, 0.55);
      break;
    }
    case 'crab': {
      head.position.y = 2.0;
      head.add(ball(c, 0.55, 0, 0, 0, 1.2, 0.8, 1));
      for (const s of [-1, 1]) {
        const st = new THREE.Mesh(GEO.cyl, toon(c)); st.scale.set(0.07, 0.6, 0.07); st.position.set(s * 0.25, 0.55, 0.25); head.add(st);
      }
      eyes(head, 0.25, 0.9, 0.3, 0.2);
      break;
    }
    case 'octopus': {
      head.add(ball(c, 0.85, 0, 0.2, -0.05, 1, 1.1, 1));
      eyes(head, 0.28, 0.05, 0.7, 0.22);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        body.add(ball(c, 0.27, Math.sin(a) * 0.8, 0.6, Math.cos(a) * 0.7));
      }
      break;
    }
    case 'dolphin': {
      head.add(ball(c, 0.68));
      head.add(ball(c, 0.3, 0, -0.12, 0.75, 1, 0.75, 1.5));
      eyes(head, 0.3, 0.12, 0.5, 0.18);
      const fin = new THREE.Mesh(GEO.cone, toon(c));
      fin.scale.set(0.25, 0.8, 0.45); fin.rotation.x = -0.6; fin.position.set(0, 1.9, -0.65);
      body.add(fin);
      break;
    }
    case 'turtle': {
      head.add(ball(c, 0.62));
      eyes(head, 0.24, 0.12, 0.5, 0.18);
      body.add(ball(0x3f8f45, 0.95, 0, 1.4, -0.35, 1.05, 1.1, 0.7));
      for (let k = 0; k < 5; k++) body.add(ball(0x2f6f35, 0.22, Math.sin(k * 1.3) * 0.5, 1.1 + (k % 3) * 0.35, -0.95, 1, 1, 0.4));
      break;
    }
    case 'gull': {
      head.add(ball(c, 0.66));
      eyes(head, 0.24, 0.12, 0.52, 0.17);
      const beak = new THREE.Mesh(GEO.cone, toon(0xffb81c));
      beak.scale.set(0.16, 0.55, 0.16); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.05, 0.85);
      head.add(beak);
      for (const s of [-1, 1]) {
        const w = ball(0xc9d3e0, 0.55, s * 0.95, 1.35, -0.15, 0.35, 0.95, 1.2);
        w.rotation.z = s * 0.45; body.add(w);
      }
      break;
    }
    case 'frog': {
      head.add(ball(c, 0.66, 0, 0, 0, 1.15, 0.85, 1));
      for (const s of [-1, 1]) {
        head.add(ball(c, 0.3, s * 0.33, 0.45, 0.22));
        head.add(ball(0xffffff, 0.22, s * 0.33, 0.5, 0.38));
        head.add(ball(0x1a1a2e, 0.11, s * 0.33, 0.52, 0.56));
        head.add(ball(0xff9fb0, 0.13, s * 0.5, -0.12, 0.48, 1, 0.6, 0.5));
      }
      break;
    }
  }

  const shield = new THREE.Mesh(GEO.sphere, shieldMat);
  shield.scale.setScalar(2.6); shield.position.y = 1.4; shield.visible = false;
  root.add(shield);

  const kite = new THREE.Group();
  const canopy = new THREE.Mesh(buildKiteGeometry(def.kite, def.kite2), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex, side: THREE.DoubleSide }));
  kite.add(canopy);
  return { root, tg, board, body, head, shield, kite };
}

// ===================================================================
// Fahrer
// ===================================================================
class Rider {
  constructor(def, isPlayer) {
    this.def = def;
    this.isPlayer = isPlayer;
    const s = def.stats;
    this.maxSpeed = 27 + s.speed * 2.4;
    this.accel = 10 + s.skill * 2.5;
    this.turnRate = 1.25 + s.agility * 0.27;
    this.offFactor = 0.5 + s.skill * 0.06;
    this.edgeDrain = 21 - s.skill * 1.6;
    this.jumpV = Math.sqrt(2 * GRAV * (3.5 + s.jump * 1.7));
    this.trickDur = 0.95 - s.trick * 0.11;
    this.trickBoost = 0.45 + s.trick * 0.12;
    this.stunMul = 1.15 - s.skill * 0.07;
    this.mesh = buildRiderMesh(def);
    world.add(this.mesh.root, this.mesh.kite);
    this.ai = {
      lane: 0, laneTarget: 0, laneTimer: 0, avoid: 0,
      edgeStart: 45 + Math.random() * 35, jumpRate: 0.08 + s.jump * 0.03,
      trickAgg: 0.4 + s.trick * 0.12, itemTimer: 0, noise: Math.random() * 100,
      sc: null, scSeen: null, scT: 0, want: new Map(),
    };
    this.reset();
  }
  reset() {
    Object.assign(this, {
      x: 0, z: 0, h: 0, y: 0, vy: 0, speed: 0, power: 100, exhausted: false, edging: false,
      idx: 0, lat: 0, offTrack: false, progress: 0, rank: 1,
      boost: 0, slow: 0, inv: 0, shieldT: 0, crash: null, finished: false, finishTime: 0,
      item: null, itemCount: 0, roll: 0, rollItem: null,
      trickT: 0, tricks: 0, trickType: 0, trickSpin: 0, steerVis: 0, speedMul: 1,
      kx: 0, ky: KITE_H, kz: 0, sway: Math.random() * TAU, wrongWay: 0,
      draft: 0, gustCd: 0, rampCd: 0, rockCd: 0, gateIdx: 0, sc: null, scOpen: false, spin: 0, spins: 0,
    });
  }
  get airborne() { return this.y > 0.001 || this.vy > 0; }
  get fx() { return Math.sin(this.h); }
  get fz() { return Math.cos(this.h); }
}

// ===================================================================
// Spielzustand
// ===================================================================
let riders = [];
let player = null;
let projectiles = [];
let state = 'menu';          // menu | countdown | race | finished | paused | results
let raceTime = 0, countdown = 0, finishTimer = 0, timeUp = false;
let trackDef = TRACKS[0];
let selChar = 0, selTrack = 0;
try { selChar = +localStorage.getItem('kk_char') || 0; selTrack = +localStorage.getItem('kk_track') || 0; } catch (e) { /* kein Speicher */ }
selChar = clamp(selChar, 0, CHARACTERS.length - 1); selTrack = clamp(selTrack, 0, TRACKS.length - 1);

function setupRace(def, playerChar, field) {
  trackDef = def;
  buildWorld(def);
  projectiles.forEach((p) => p.mesh && scene.remove(p.mesh));
  projectiles = [];
  riders = [];
  // Startaufstellung: Spieler startet in der Mitte des Feldes
  const others = (field || CHARACTERS).filter((c) => c !== CHARACTERS[playerChar]).sort(() => Math.random() - 0.5);
  const order = others.slice();
  if (playerChar >= 0) order.splice(Math.min(4, Math.floor(order.length / 2)), 0, CHARACTERS[playerChar]);
  else order.push(others[0] === CHARACTERS[0] ? CHARACTERS[1] : CHARACTERS[0]);
  // Startaufstellung: zwei Reihen à vier Fahrer hinter der Startlinie
  order.slice(0, 8).forEach((def, i) => {
    const r = new Rider(def, playerChar >= 0 && def === CHARACTERS[playerChar]);
    r.idx = START_IDX - 4 - Math.floor(i / 4) * 7;
    const p = trackPoint(r.idx, ((i % 4) - 1.5) * 12);
    r.x = p.x; r.z = p.z; r.h = p.h;
    r.progress = r.idx;
    riders.push(r);
  });
  player = riders.find((r) => r.isPlayer) || null;
  raceTime = 0; finishTimer = 0; timeUp = false;
  camH = (player || riders[0]).h;
  const t = player || riders[0];
  camera.position.set(t.x - Math.sin(t.h) * 14, 7, t.z - Math.cos(t.h) * 14);
}

// ===================================================================
// Eingabe
// ===================================================================
const input = { left: false, right: false, touchSteer: 0, edgeKey: false, edgeTouch: false, jump: false, item: false };
const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ShiftLeft: 'edgeKey', ShiftRight: 'edgeKey', ArrowUp: 'edgeKey', KeyW: 'edgeKey' };
window.addEventListener('keydown', (e) => {
  if (keyMap[e.code]) { input[keyMap[e.code]] = true; e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
  if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'ControlLeft') { if (state === 'race') input.item = true; }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});
window.addEventListener('keyup', (e) => { if (keyMap[e.code]) input[keyMap[e.code]] = false; });

// Lenk-Joystick auf der linken Bildschirmhälfte
{
  const zone = $('steer-zone'), base = $('stick-base'), knob = $('stick-knob');
  let id = null, ox = 0, oy = 0;
  zone.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    id = e.pointerId; ox = e.clientX; oy = e.clientY;
    zone.setPointerCapture(id);
    const r = zone.getBoundingClientRect();
    base.style.display = 'block'; base.style.left = (ox - r.left) + 'px'; base.style.top = (oy - r.top) + 'px';
    knob.style.transform = '';
    $('steer-hint').style.opacity = 0;
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = clamp(e.clientX - ox, -55, 55);
    input.touchSteer = dx / 55;
    knob.style.transform = `translateX(${dx}px)`;
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null; input.touchSteer = 0; base.style.display = 'none';
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
}
function holdButton(el, onDown, onUp) {
  const pointers = new Set();
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); pointers.add(e.pointerId); el.setPointerCapture(e.pointerId); el.classList.add('down'); onDown(); });
  const up = (e) => { if (!pointers.delete(e.pointerId)) return; if (!pointers.size) { el.classList.remove('down'); onUp && onUp(); } };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
holdButton($('btn-jump'), () => { input.jump = true; });
holdButton($('btn-edge'), () => { input.edgeTouch = true; }, () => { input.edgeTouch = false; });
$('item-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); if (state === 'race') input.item = true; });
$('pause-btn').addEventListener('click', () => togglePause());

// Neigungssteuerung: Handy wie ein Lenkrad drehen. Die Schwerkraft wird in Bildschirm-
// Koordinaten umgerechnet; der Winkel beim Rennstart gilt als Geradeaus (Kalibrierung).
const TILT_DEAD = 7 * Math.PI / 180;     // tote Zone, damit kleines Wackeln nicht lenkt
const TILT_MAX = 32 * Math.PI / 180;     // ab diesem Winkel voller Einschlag
const tilt = { on: false, angle: null, zero: 0, steer: 0, lastEvent: 0 };
function onMotion(e) {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x === null) return;
  const o = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  let sx = g.x, sy = g.y;                                   // Hochformat
  if (o === 90) { sx = -g.y; sy = g.x; }
  else if (o === -90 || o === 270) { sx = g.y; sy = -g.x; }
  else if (o === 180) { sx = -g.x; sy = -g.y; }
  const a = Math.atan2(sx, sy);
  tilt.angle = tilt.angle === null ? a : tilt.angle + wrapAngle(a - tilt.angle) * 0.35;   // glätten
  tilt.lastEvent = performance.now();
  const d = wrapAngle(tilt.angle - tilt.zero), m = Math.abs(d);
  tilt.steer = m < TILT_DEAD ? 0 : -Math.sign(d) * clamp((m - TILT_DEAD) / (TILT_MAX - TILT_DEAD), 0, 1);
}
function calibrateTilt() { if (tilt.angle !== null) { tilt.zero = tilt.angle; tilt.steer = 0; } }
function updateTiltButton() {
  const b = $('btn-tilt');
  b.textContent = 'Neigungssteuerung: ' + (tilt.on ? 'An' : 'Aus');
  b.classList.toggle('primary', tilt.on);
  $('btn-calibrate').classList.toggle('hidden', !tilt.on);
  $('steer-hint').textContent = tilt.on ? '📱 Handy neigen = lenken' : '◀ Lenken ▶';
}
async function enableTilt() {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      if (await DeviceMotionEvent.requestPermission() !== 'granted') throw new Error('denied');
    }
  } catch (e) { tiltNote('Kein Zugriff auf den Bewegungssensor erlaubt.'); return; }
  window.addEventListener('devicemotion', onMotion);
  tilt.on = true; tilt.angle = null;
  updateTiltButton();
  try { localStorage.setItem('kk_tilt', '1'); } catch (e) { /* egal */ }
  // Kommen keine Sensordaten an (z. B. eingebettete Ansicht), wieder ausschalten
  setTimeout(() => {
    if (tilt.on && performance.now() - tilt.lastEvent > 1400) {
      disableTilt();
      tiltNote('Hier kommen keine Sensordaten an. Öffne das Spiel direkt im Handy-Browser.');
    }
  }, 1500);
}
function disableTilt() {
  window.removeEventListener('devicemotion', onMotion);
  tilt.on = false; tilt.steer = 0;
  updateTiltButton();
  try { localStorage.removeItem('kk_tilt'); } catch (e) { /* egal */ }
}
function tiltNote(text) { const n = $('tilt-note'); n.textContent = text; n.classList.remove('hidden'); }
$('btn-tilt').addEventListener('click', () => { $('tilt-note').classList.add('hidden'); tilt.on ? disableTilt() : enableTilt(); });
$('btn-calibrate').addEventListener('click', () => { calibrateTilt(); showMsg('Kalibriert', 0.8, 'So gehaltene Lage = geradeaus'); });
if (!isTouch) $('btn-tilt').classList.add('hidden');
updateTiltButton();

function playerControl() {
  const steer = clamp((input.right ? 1 : 0) - (input.left ? 1 : 0) + input.touchSteer + (tilt.on ? tilt.steer : 0), -1, 1);
  const c = { steer, edge: input.edgeKey || input.edgeTouch, jump: input.jump, item: input.item };
  input.jump = false; input.item = false;
  return c;
}

// ===================================================================
// KI
// ===================================================================
function aiControl(r, dt) {
  const ai = r.ai, N = path.N;
  ai.laneTimer -= dt;
  if (ai.laneTimer <= 0) { ai.laneTarget = (Math.random() * 2 - 1) * 0.65; ai.laneTimer = 2 + Math.random() * 4; }
  ai.lane = lerp(ai.lane, ai.laneTarget, damp(0.8, dt));
  ai.avoid *= 1 - damp(1.5, dt);

  // Anderen Kites und Seetang ausweichen
  const fx = r.fx, fz = r.fz, rx = -fz, rz = fx;
  const avoidObj = (ox, oz, range, wide) => {
    const dx = ox - r.x, dz = oz - r.z;
    const fwd = dx * fx + dz * fz, side = dx * rx + dz * rz;
    if (fwd > -6 && fwd < range && Math.abs(side) < wide) ai.avoid += (side > 0 ? -1 : 1) * (wide - Math.abs(side)) * 7 * dt;
  };
  for (const o of riders) {
    if (o === r || o.crash) continue;
    // Direkt dahinter im Windschatten bleiben, erst kurz davor ausscheren
    const dx = o.x - r.x, dz = o.z - r.z, fwd = dx * fx + dz * fz, side = dx * rx + dz * rz;
    if (fwd > 9 && Math.abs(side) < 2.5) continue;
    avoidObj(o.x, o.z, 26, 9.5);
  }
  for (const k of rocks) if (Math.abs(k.idx - r.idx) < 25) avoidObj(k.x, k.z, 40, k.r + 4);
  for (const p of projectiles) if (p.type === 'seaweed') avoidObj(p.x, p.z, 28, 5);
  ai.avoid = clamp(ai.avoid, -14, 14);

  const la = Math.round(8 + r.speed * 0.3);
  const ti = Math.min(N - 1, r.idx + la);
  // Wellen, Tore und Böen gezielt anfahren (je nach Charakter)
  let laneLat = ai.lane * path.width * 0.4;
  let best = null;
  for (const list of [ramps, gates, gusts]) {
    for (const f of list) {
      const d = f.idx - r.idx;
      if (d > 4 && d < 45 && (!best || d < best.idx - r.idx)) best = f;
    }
  }
  if (best) {
    if (!ai.want.has(best)) {
      const s = r.def.stats;
      ai.want.set(best, Math.random() < (ramps.includes(best) ? 0.2 + s.trick * 0.1 : gates.includes(best) ? 0.45 + s.skill * 0.08 : 0.5));
    }
    if (ai.want.get(best)) laneLat = best.lat;
  }
  // Abkürzung nehmen, wenn sie offen ist (ab Platz 4)
  if (!ai.sc) {
    for (const s of shortcuts) {
      const d = s.entry - r.idx;
      if (d > 0 && d < 45 && ai.scSeen !== s) { ai.scSeen = s; if (r.rank >= 4 && Math.random() < 0.8) { ai.sc = s; ai.scT = 0; } }
    }
  } else {
    ai.scT += dt;
    if (r.idx > ai.sc.exit - 4 || r.idx < ai.sc.entry - 60 || ai.scT > 10 || (r.sc !== ai.sc && r.idx > ai.sc.entry + 30)) ai.sc = null;
  }
  const lat = clamp(laneLat + ai.avoid, -path.width * 0.48, path.width * 0.48);
  let tx = path.x[ti] - path.tz[ti] * lat, tz = path.z[ti] + path.tx[ti] * lat;
  if (ai.sc) {
    // Der Rinne folgen: Zielpunkt 25 m voraus auf der Mittellinie
    const s = ai.sc, vx = s.bx - s.ax, vz = s.bz - s.az, len = Math.hypot(vx, vz);
    const t = ((r.x - s.ax) * vx + (r.z - s.az) * vz) / len;
    if (r.idx < s.entry - 3 && t < 0) { tx = s.ax; tz = s.az; }
    else { const u = clamp(t + 25, 0, len) / len; tx = s.ax + vx * u; tz = s.az + vz * u; }
  }
  const diff = wrapAngle(Math.atan2(tx - r.x, tz - r.z) - r.h);
  const wobble = Math.sin(worldTime * 0.7 + ai.noise) * 0.08;
  const steer = r.airborne ? 0 : clamp(-diff * 2.8 + wobble, -1, 1);   // in der Luft nicht ungewollt drehen

  // Ankanten mit Hysterese
  const curvy = path.curv[ti] > 0.7;
  let edge = r.edging ? r.power > 12 && !curvy : r.power > ai.edgeStart && !curvy;

  // Springen & Tricks
  let jump = false;
  if (!r.airborne) {
    if (r.power > 35 && !curvy && Math.random() < dt * ai.jumpRate) jump = true;
    for (const p of projectiles) {
      if (p.owner === r || p.type === 'seaweed') continue;
      const d = Math.hypot(p.x - r.x, p.z - r.z);
      if (d < 14 && r.power >= JUMP_COST && Math.random() < 0.5) jump = true;
    }
  } else if (r.trickT <= 0) {
    const tLand = (r.vy + Math.sqrt(r.vy * r.vy + 2 * GRAV * r.y)) / GRAV;
    const margin = 0.1 - Math.random() * 0.2 * (1 - r.def.stats.skill / 6);   // ungeschickte Fahrer verschätzen sich öfter
    if (tLand > r.trickDur + margin && Math.random() < ai.trickAgg * dt * 6) jump = true;
  }

  // Items
  let item = false;
  if (r.item) {
    ai.itemTimer -= dt;
    const t = r.item;
    if (t === 'boost' || t === 'triple') item = !curvy && ai.itemTimer < 0;
    else if (t === 'energy') item = r.power < 40;
    else if (t === 'shield') item = ai.itemTimer < -2 || projectiles.some((p) => p.owner !== r && Math.hypot(p.x - r.x, p.z - r.z) < 20);
    else if (t === 'calm' || t === 'puffer') item = ai.itemTimer < 0;
    else if (t === 'torpedo') {
      item = ai.itemTimer < -6 || riders.some((o) => {
        if (o === r || o.crash) return false;
        const dx = o.x - r.x, dz = o.z - r.z, d = Math.hypot(dx, dz);
        return d < 55 && d > 4 && (dx * fx + dz * fz) / d > 0.97;
      });
    } else if (t === 'seaweed') {
      item = ai.itemTimer < -6 || riders.some((o) => o !== r && o.rank === r.rank + 1 && Math.hypot(o.x - r.x, o.z - r.z) < 30);
    }
  }
  return { steer, edge, jump, item };
}

// ===================================================================
// Items
// ===================================================================
function pickItem(r) {
  const lead = riders.reduce((a, b) => (b.progress > a.progress ? b : a), riders[0]);
  const gap = (lead.progress - r.progress) * path.spacing;
  const table = ITEM_TABLE[r.rank === 1 ? 'lead' : gap < 60 ? 'close' : gap < 200 ? 'mid' : 'far'];
  let sum = 0;
  for (const k in table) sum += table[k];
  let v = Math.random() * sum;
  for (const k in table) { v -= table[k]; if (v <= 0) return k; }
  return 'boost';
}

const projGeo = {
  bomb: (() => { const g = new THREE.Group(); g.add(ball(0x2b2b3a, 1)); g.add(ball(0xffffff, 0.3, 0.35, 0.45, 0.6)); const f = ball(0xffa62b, 0.25, 0, 1.05, 0); g.add(f); return g; }),
  puffer: (() => {
    const g = new THREE.Group(); g.add(ball(0xffd23f, 1.1));
    for (let k = 0; k < 14; k++) {
      const a = k * 2.4, b = Math.acos(1 - 2 * (k + 0.5) / 14);
      const sp = new THREE.Mesh(GEO.cone, toon(0xe0961f)); sp.scale.set(0.18, 0.5, 0.18);
      const v = new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a));
      sp.position.copy(v).multiplyScalar(1.1); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); g.add(sp);
    }
    eyes(g, 0.4, 0.25, 0.9, 0.25); return g;
  }),
  seaweed: (() => { const g = new THREE.Group(); for (let k = 0; k < 6; k++) g.add(ball(k % 2 ? 0x2f9e44 : 0x52c46b, 0.8, Math.sin(k) * 1.1, 0.1, Math.cos(k * 1.7) * 1.1, 1, 0.45, 1)); return g; }),
};

function spawnProjectile(type, owner) {
  const p = { type, owner, life: 0, x: owner.x, z: owner.z, y: 1, h: owner.h, speed: 0, target: null };
  if (type === 'torpedo') {
    p.x += owner.fx * 3.5; p.z += owner.fz * 3.5; p.speed = owner.speed + 48; p.maxLife = 3.2;
    p.mesh = projGeo.bomb();
  } else if (type === 'puffer') {
    const ahead = riders.filter((o) => o !== owner && o.rank < owner.rank && !o.finished).sort((a, b) => b.rank - a.rank)[0];
    p.target = ahead || null;
    p.x += owner.fx * 3.5; p.z += owner.fz * 3.5; p.speed = Math.max(owner.speed + 30, 62); p.maxLife = 8;
    p.mesh = projGeo.puffer();
  } else {
    p.x -= owner.fx * 5; p.z -= owner.fz * 5; p.y = 0.2; p.maxLife = 40;
    p.mesh = projGeo.seaweed();
  }
  p.mesh.position.set(p.x, p.y, p.z);
  scene.add(p.mesh);
  projectiles.push(p);
}

function useItem(r) {
  const t = r.item;
  if (!t) return;
  r.itemCount--;
  if (r.itemCount <= 0) r.item = null;
  r.ai.itemTimer = 1 + Math.random() * 3;
  switch (t) {
    case 'boost': case 'triple':
      r.boost = Math.min(3, r.boost + 1.6); if (r.isPlayer) beep(300, 0.4, 'sawtooth', 0.06, 500); break;
    case 'energy':
      r.power = Math.min(100, r.power + 60); r.exhausted = false; if (r.isPlayer) { beep(520, 0.1); beep(780, 0.2); } break;
    case 'shield':
      r.shieldT = 8; if (r.isPlayer) beep(660, 0.25, 'triangle'); break;
    case 'calm':
      for (const o of riders) {
        if (o === r || o.rank > r.rank) continue;
        if (o.shieldT > 0) { o.shieldT = 0; continue; }
        o.power = 0; o.exhausted = true; o.slow = 3; o.edging = false;
        if (o.isPlayer) showMsg('Flaute!', 1.5, `${r.def.name} hat dir den Wind genommen`);
      }
      if (r.isPlayer) showMsg('Flaute!', 1.2, 'Alle vor dir sind ausgebremst');
      break;
    default:
      spawnProjectile(t, r); if (r.isPlayer) beep(220, 0.15, 'square', 0.06, -100);
  }
}

// ===================================================================
// Physik
// ===================================================================
function crash(r, type, by) {
  if (r.crash) return false;
  if (type !== 'splash' && r.shieldT > 0) {
    r.shieldT = 0; burst(r.x, 1.5, r.z, 16, 6);
    if (r.isPlayer) beep(900, 0.15, 'triangle');
    return false;
  }
  if (type === 'tangle' && r.inv > 0) return false;
  const base = { tangle: 2.6, hit: 1.6, splash: 1.3, slip: 0.9 }[type];
  r.crash = { type, t: 0, dur: base * r.stunMul };
  r.trickT = 0; r.edging = false; r.spin = 0;
  burst(r.x, 0.5, r.z, 22, 8);
  if (r.isPlayer) {
    const msgs = {
      tangle: ['Kites verheddert!', by ? `Mit ${by.def.name} zusammengestoßen – Neustart am Checkpoint` : 'Neustart am Checkpoint'],
      hit: ['Getroffen!', by ? `von ${by.def.name}` : ''],
      splash: ['Bauchklatscher!', 'Trick nicht rechtzeitig fertig'],
      slip: ['Seetang!', ''],
    }[type];
    showMsg(msgs[0], 1.6, msgs[1]);
    beep(180, 0.5, 'sawtooth', 0.08, -120);
  }
  return true;
}

function respawn(r) {
  const seg = path.N / 16;
  const cp = Math.max(START_IDX, Math.floor(r.idx / seg) * seg | 0);
  let best = 0, bestD = -1;
  for (const lat of [-16, -8, 0, 8, 16]) {
    const p = trackPoint(cp, lat);
    let d = Infinity;
    for (const o of riders) if (o !== r) d = Math.min(d, Math.hypot(o.x - p.x, o.z - p.z));
    if (d > bestD) { bestD = d; best = lat; }
  }
  const p = trackPoint(cp, best);
  r.x = p.x; r.z = p.z; r.h = p.h; r.idx = cp; r.lat = best;
  r.speed = 0; r.y = 0; r.vy = 0; r.boost = 0; r.sc = null; r.ai.sc = null;
}

function land(r) {
  burst(r.x, 0.3, r.z, 14, 5);
  if (r.trickT > 0) { r.spin = 0; crash(r, 'splash'); return; }
  // Drehung: schief gelandet (mehr als ~60° quer) = Sturz, sonst zählt jede volle Drehung als Trick
  const off = Math.abs(wrapAngle(r.spin));
  if (off > 1.05) {
    r.spin = 0;
    if (crash(r, 'splash') && r.isPlayer) showMsg('Schief gelandet!', 1.6, 'Drehung vor der Landung beenden');
    return;
  }
  r.tricks += Math.round(Math.abs(r.spin) / TAU);
  r.spin = 0; r.spins = 0;
  if (r.tricks > 0) {
    r.boost = Math.min(3, r.boost + r.tricks * r.trickBoost);
    r.power = Math.min(100, r.power + r.tricks * 5);
    if (r.isPlayer) { showMsg(r.tricks > 1 ? `${r.tricks}x Trick!` : 'Trick!', 1, '+ Turbo'); beep(600, 0.1); beep(900, 0.18); }
  }
  r.tricks = 0;
}

const SPIN_RATE = TAU / 0.9;     // eine volle Drehung in ~0,9 s bei vollem Einschlag
const TRICK_NAMES = ['Kiteloop', 'Backroll', 'Frontroll', 'Railey', 'Handlepass', 'Megaloop'];

function physics(r, c, dt) {
  r.boost = Math.max(0, r.boost - dt);
  r.slow = Math.max(0, r.slow - dt);
  r.inv = Math.max(0, r.inv - dt);
  r.shieldT = Math.max(0, r.shieldT - dt);
  r.sway += dt;

  if (r.crash) {
    const cr = r.crash;
    cr.t += dt;
    r.speed = Math.max(0, r.speed - (cr.type === 'slip' ? 22 : 45) * dt);
    r.x += r.fx * r.speed * dt; r.z += r.fz * r.speed * dt;
    if (r.y > 0 || r.vy > 0) { r.vy -= GRAV * dt; r.y = Math.max(0, r.y + r.vy * dt); if (r.y === 0) r.vy = 0; }
    r.power = Math.min(100, r.power + POWER_REGEN * dt);
    if (cr.t >= cr.dur) {
      if (cr.type === 'tangle') respawn(r);
      r.crash = null;
      r.inv = cr.type === 'tangle' ? 2.2 : 1.2;
    }
    return;
  }

  const air = r.airborne;
  // Ankanten: schneller, kostet aber Kraft
  const edging = c.edge && !air && !r.exhausted && r.power > 0;
  if (edging) {
    r.power -= r.edgeDrain * dt;
    if (r.power <= 0) { r.power = 0; r.exhausted = true; }
  } else {
    r.power = Math.min(100, r.power + POWER_REGEN * dt);
  }
  if (r.exhausted && r.power > 12) r.exhausted = false;
  r.edging = edging;

  // Sprung / Trick
  if (c.jump) {
    if (!air) {
      if (r.power >= JUMP_COST) {
        r.power -= JUMP_COST; r.vy = r.jumpV * (edging ? 1.08 : 1); r.y = 0.01; r.tricks = 0; r.spin = 0; r.spins = 0;
        burst(r.x, 0.3, r.z, 10, 6);
        if (r.isPlayer) beep(440, 0.15, 'triangle', 0.08, 300);
      } else if (r.isPlayer) showMsg('Zu wenig Kraft', 0.8);
    } else if (r.trickT <= 0) {
      r.trickT = r.trickDur; r.trickType = r.tricks % 3;
      if (r.isPlayer) { showMsg(TRICK_NAMES[(r.tricks + Math.floor(r.sway)) % TRICK_NAMES.length], 0.7); beep(700 + r.tricks * 120, 0.1, 'triangle'); }
    }
  }

  // Lenken – in der Luft dreht man sich stattdessen um die eigene Achse
  const turn = r.turnRate * (air ? 0.25 : 1) * (edging ? 1.1 : 1) * clamp(r.speed / 8, 0.3, 1) * (r.slow > 0 ? 0.8 : 1);
  r.h = wrapAngle(r.h - c.steer * turn * dt);
  if (air) {
    const s = Math.abs(c.steer) < 0.3 ? 0 : Math.sign(c.steer) * (Math.abs(c.steer) - 0.3) / 0.7;
    r.spin -= s * SPIN_RATE * (0.8 + r.def.stats.trick * 0.08) * dt;
    const turns = Math.floor(Math.abs(r.spin) / TAU + 0.15);   // zählt kurz vor Vollendung
    if (turns > r.spins) {
      r.spins = turns;
      if (r.isPlayer) { showMsg(turns * 360 + '°!', 0.7); beep(600 + turns * 150, 0.1, 'triangle'); }
    }
  }
  r.steerVis = lerp(r.steerVis, c.steer, damp(8, dt));

  // Tempo
  let maxS = r.maxSpeed * r.speedMul;
  if (edging) maxS *= EDGE_BOOST;
  if (r.boost > 0) maxS *= 1.45;
  if (r.slow > 0) maxS *= 0.55;
  if (r.offTrack && !air) maxS *= r.offFactor;
  if (r.sc && !r.scOpen && !air) maxS *= 0.45;   // Abkürzung gesperrt = Sandbank
  if (r.finished) maxS = Math.min(maxS, 8);   // nach dem Ziel ausrollen
  maxS *= windFactor(r.fx, r.fz);
  if (r.speed < maxS) r.speed = Math.min(maxS, r.speed + (r.boost > 0 ? 45 : r.accel * (edging ? 1.4 : 1)) * dt);
  else r.speed = Math.max(maxS, r.speed - (air ? 3 : 20) * dt);
  r.x += r.fx * r.speed * dt;
  r.z += r.fz * r.speed * dt;

  // Flugphase
  if (air) {
    r.vy -= GRAV * dt;
    r.y += r.vy * dt;
    if (r.trickT > 0) {
      r.trickT -= dt;
      if (r.trickT <= 0) { r.trickT = 0; r.tricks++; }
    }
    if (r.y <= 0) { r.y = 0; r.vy = 0; land(r); }
  }
}

function locate(r, dt) {
  const N = path.N;
  let best = r.idx, bd = Infinity;
  for (let i = Math.max(0, r.idx - 14), e = Math.min(N - 1, r.idx + 14); i <= e; i++) {
    const dx = r.x - path.x[i], dz = r.z - path.z[i], d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  r.idx = best;
  // Anfang und Ende der Strecke begrenzen
  if (best === 0 || best === N - 1) {
    const along = (r.x - path.x[best]) * path.tx[best] + (r.z - path.z[best]) * path.tz[best];
    if ((best === 0 && along < 0) || (best === N - 1 && along > 0)) {
      r.x -= path.tx[best] * along; r.z -= path.tz[best] * along; r.speed *= 0.9;
    }
  }
  const rx = -path.tz[best], rz = path.tx[best];
  r.lat = (r.x - path.x[best]) * rx + (r.z - path.z[best]) * rz;
  const lim = path.width / 2 + 20;
  // Abkürzungs-Rinnen
  let inSc = null;
  for (const s of shortcuts) {
    if (best < s.entry - 20 || best > s.exit + 20) continue;
    // zählt erst, wenn man die eigentliche Strecke verlässt (Kurven schneiden ist erlaubt)
    if (segInfo(r.x, r.z, s).d < SC_HALF + (r.sc === s ? 0 : 5) && (r.sc === s || Math.abs(r.lat) > path.width / 2)) { inSc = s; break; }
  }
  if (inSc && r.sc !== inSc) {
    r.sc = inSc; r.scOpen = r.rank >= 4;
    if (r.isPlayer && state === 'race') {
      if (r.scOpen) { showMsg('Abkürzung!', 1.2); beep(520, 0.1); beep(780, 0.15); }
      else showMsg('Sandbank!', 1.6, 'Abkürzungen sind erst ab Platz 4 offen');
    }
  }
  if (!inSc && r.sc) {
    if (Math.abs(r.lat) > lim) {           // seitlich aus der Rinne: zurückschieben
      const q = segInfo(r.x, r.z, r.sc), k = SC_HALF / (q.d || 1);
      r.x = q.qx + (r.x - q.qx) * k; r.z = q.qz + (r.z - q.qz) * k; r.speed *= 0.97;
      inSc = r.sc;
    } else r.sc = null;
  }
  r.offTrack = !inSc && Math.abs(r.lat) > path.width / 2;
  // Äußere Begrenzung: zurück zur Strecke schieben
  if (!inSc && Math.abs(r.lat) > lim) {
    const over = r.lat - Math.sign(r.lat) * lim;
    r.x -= rx * over; r.z -= rz * over; r.lat -= over;
    r.speed *= 0.97;
  }
  r.progress = best;
  if (!r.finished && best >= path.finishIdx) {
    r.finished = true; r.finishTime = raceTime;
    if (r.isPlayer) onPlayerFinish();
  }
  // Falsche Richtung erkennen
  const dot = r.fx * path.tx[best] + r.fz * path.tz[best];
  r.wrongWay = dot < -0.3 && !r.crash && !r.sc ? r.wrongWay + dt : 0;
}

// Wellen, Böen, Tore und Felsen
function trackFeatures(r, dt) {
  r.gustCd = Math.max(0, r.gustCd - dt);
  r.rampCd = Math.max(0, r.rampCd - dt);
  r.rockCd = Math.max(0, r.rockCd - dt);
  if (r.crash || r.finished) return;
  const ground = !r.airborne;
  if (ground && r.rampCd <= 0) {
    for (const f of ramps) {
      if (Math.abs(f.idx - r.idx) > 10) continue;
      const dx = r.x - f.x, dz = r.z - f.z;
      if (Math.abs(dx * f.tx + dz * f.tz) < f.len / 2 && Math.abs(-dx * f.tz + dz * f.tx) < f.wide / 2) {
        r.vy = r.jumpV * 1.3; r.y = 0.01; r.tricks = 0; r.spin = 0; r.spins = 0; r.rampCd = 1;
        burst(r.x, 0.5, r.z, 16, 8);
        if (r.isPlayer) { showMsg('Welle!', 0.8, 'Jetzt Tricks!'); beep(380, 0.25, 'triangle', 0.08, 400); }
        break;
      }
    }
  }
  if (ground && r.gustCd <= 0) {
    for (const f of gusts) {
      if (Math.abs(f.idx - r.idx) > 8 || Math.hypot(r.x - f.x, r.z - f.z) > f.r) continue;
      r.boost = Math.max(r.boost, 1.0); r.power = Math.min(100, r.power + 12); r.exhausted = false; r.gustCd = 2;
      if (r.isPlayer) { showMsg('Windböe!', 0.8, '+ Turbo + Kraft'); beep(300, 0.3, 'sawtooth', 0.05, 300); }
      break;
    }
  }
  while (r.gateIdx < gates.length && r.idx >= gates[r.gateIdx].idx) {
    const g = gates[r.gateIdx++];
    if (Math.abs(r.lat - g.lat) < g.gap / 2) {
      r.boost = Math.max(r.boost, 0.8); r.power = Math.min(100, r.power + 8);
      if (r.isPlayer) { showMsg('Tor!', 0.7, '+ Turbo'); beep(660, 0.08); beep(880, 0.12); }
    }
  }
  if (r.rockCd <= 0) {
    for (const k of rocks) {
      if (Math.abs(k.idx - r.idx) > 8) continue;
      const dx = r.x - k.x, dz = r.z - k.z, d = Math.hypot(dx, dz), min = k.r + 0.9;
      if (d < min && r.y < k.r * 0.8) {
        r.x = k.x + dx / (d || 1) * min; r.z = k.z + dz / (d || 1) * min;
        r.speed *= 0.35; r.slow = Math.max(r.slow, 0.5); r.rockCd = 0.6;
        burst(r.x, 1, r.z, 12, 6);
        if (r.isPlayer) { showMsg('Felsen!', 0.9, 'Tipp: drüberspringen'); beep(150, 0.25, 'square', 0.06); }
        break;
      }
    }
  }
}

// Windschatten: dicht hinter einem anderen Fahrer lädt sich ein Turbo auf
const DRAFT_TIME = 1.3;
function drafting(dt) {
  for (const r of riders) {
    let behind = false;
    if (!r.crash && !r.airborne && !r.finished && r.speed > 12) {
      for (const o of riders) {
        if (o === r || o.crash || o.airborne) continue;
        const dx = o.x - r.x, dz = o.z - r.z, fwd = dx * r.fx + dz * r.fz;
        if (fwd < 5 || fwd > 22) continue;
        if (Math.abs(-dx * r.fz + dz * r.fx) < 3.2) { behind = true; break; }
      }
    }
    if (behind) {
      r.draft += dt;
      if (r.isPlayer && Math.random() < dt * 30) {
        emitSpray(r.x + (Math.random() - 0.5) * 5, 1 + Math.random() * 3, r.z + (Math.random() - 0.5) * 5, -r.fx * 25, 0, -r.fz * 25, 0.3, 0.12);
      }
      if (r.draft >= DRAFT_TIME) {
        r.draft = 0; r.boost = Math.max(r.boost, 1.3);
        if (r.isPlayer) { showMsg('Windschatten-Turbo!', 1); beep(500, 0.3, 'sawtooth', 0.06, 500); }
      }
    } else r.draft = Math.max(0, r.draft - dt * 1.5);
  }
}

function collisions() {
  const n = riders.length;
  for (let i = 0; i < n; i++) {
    const a = riders[i];
    for (let j = i + 1; j < n; j++) {
      const b = riders[j];
      // Körperkontakt: wegschubsen
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 2.4 && d > 0.001 && Math.abs(a.y - b.y) < 2) {
        const push = (2.4 - d) / 2, nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
        a.speed *= 0.98; b.speed *= 0.98;
      }
      // Kites berühren sich => beide stürzen
      if (a.crash || b.crash || a.finished || b.finished) continue;
      if (Math.abs(a.ky - b.ky) > 5) continue;
      const kd = Math.hypot(a.kx - b.kx, a.kz - b.kz);
      if (kd < KITE_HIT && a.inv <= 0 && b.inv <= 0) {
        const aShield = a.shieldT > 0, bShield = b.shieldT > 0;
        crash(a, 'tangle', b);
        crash(b, 'tangle', a);
        if (aShield || bShield) { a.inv = Math.max(a.inv, 1); b.inv = Math.max(b.inv, 1); }
      }
    }
  }
  // Itemboxen
  for (const box of itemBoxes) {
    if (box.off > 0) continue;
    for (const r of riders) {
      if (r.crash || r.y > 4) continue;
      if ((r.x - box.x) ** 2 + (r.z - box.z) ** 2 < 7.5) {
        box.off = 3; burst(box.x, 2, box.z, 10, 5);
        if (!r.item && r.roll <= 0) {
          r.roll = 1.0; r.rollItem = pickItem(r);
          if (r.isPlayer) beep(880, 0.08, 'square', 0.05);
        }
        break;
      }
    }
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life += dt;
    if (p.type === 'puffer' && p.target && !p.target.crash) {
      const want = Math.atan2(p.target.x - p.x, p.target.z - p.z);
      p.h += clamp(wrapAngle(want - p.h), -3.2 * dt, 3.2 * dt);
    }
    if (p.type !== 'seaweed') {
      p.x += Math.sin(p.h) * p.speed * dt; p.z += Math.cos(p.h) * p.speed * dt;
      p.y = p.type === 'torpedo' ? 0.9 + Math.abs(Math.sin(p.life * 9)) * 1.4 : 1.6 + Math.sin(p.life * 6) * 0.3;
      if (p.life % 0.05 < dt) emitSpray(p.x, 0.3, p.z, 0, 3, 0, 0.4, 0.5);
    }
    p.mesh.position.set(p.x, p.y + (p.type === 'seaweed' ? waveH(p.x, p.z, worldTime) : 0), p.z);
    p.mesh.rotation.y = p.type === 'seaweed' ? p.life * 0.3 : p.h + (p.type === 'torpedo' ? 0 : Math.sin(p.life * 8) * 0.3);
    let gone = p.life > p.maxLife;
    for (const r of riders) {
      if (gone) break;
      if (r.crash || (r === p.owner && p.life < 0.8)) continue;
      const hitR = p.type === 'puffer' ? 2.6 : 2.3;
      if ((r.x - p.x) ** 2 + (r.z - p.z) ** 2 > hitR * hitR) continue;
      if (p.type !== 'puffer' && r.y > 1.5) continue;   // drübergesprungen!
      crash(r, p.type === 'seaweed' ? 'slip' : 'hit', p.owner);
      gone = true;
    }
    if (gone) { scene.remove(p.mesh); projectiles.splice(i, 1); burst(p.x, 1, p.z, 12, 6); }
  }
}

// ===================================================================
// Partikel (Gischt)
// ===================================================================
const SPRAY_MAX = 420;
const spray = new THREE.InstancedMesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: 0xffffff }), SPRAY_MAX);
spray.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
spray.frustumCulled = false;
scene.add(spray);
const sp = { x: new Float32Array(SPRAY_MAX), y: new Float32Array(SPRAY_MAX), z: new Float32Array(SPRAY_MAX), vx: new Float32Array(SPRAY_MAX), vy: new Float32Array(SPRAY_MAX), vz: new Float32Array(SPRAY_MAX), life: new Float32Array(SPRAY_MAX), max: new Float32Array(SPRAY_MAX), size: new Float32Array(SPRAY_MAX) };
let spHead = 0;
function emitSpray(x, y, z, vx, vy, vz, life, size) {
  const i = spHead; spHead = (spHead + 1) % SPRAY_MAX;
  sp.x[i] = x; sp.y[i] = y; sp.z[i] = z; sp.vx[i] = vx; sp.vy[i] = vy; sp.vz[i] = vz; sp.life[i] = life; sp.max[i] = life; sp.size[i] = size;
}
function burst(x, y, z, n, power) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * TAU, s = power * (0.4 + Math.random() * 0.6);
    emitSpray(x, y, z, Math.sin(a) * s, power * (0.6 + Math.random()), Math.cos(a) * s, 0.6 + Math.random() * 0.4, 0.35 + Math.random() * 0.35);
  }
}
const dummy = new THREE.Object3D();
function updateSpray(dt) {
  for (let i = 0; i < SPRAY_MAX; i++) {
    if (sp.life[i] > 0) {
      sp.life[i] -= dt;
      sp.vy[i] -= 22 * dt;
      sp.x[i] += (sp.vx[i] + wind.x * 5) * dt; sp.y[i] += sp.vy[i] * dt; sp.z[i] += (sp.vz[i] + wind.z * 5) * dt;
      const s = sp.life[i] > 0 ? sp.size[i] * (0.4 + 0.6 * sp.life[i] / sp.max[i]) : 0;
      dummy.position.set(sp.x[i], Math.max(sp.y[i], -0.5), sp.z[i]);
      dummy.scale.setScalar(s);
    } else {
      dummy.scale.setScalar(0);
    }
    dummy.updateMatrix();
    spray.setMatrixAt(i, dummy.matrix);
  }
  spray.instanceMatrix.needsUpdate = true;
}

// ===================================================================
// Darstellung der Fahrer
// ===================================================================
const tmpV = new THREE.Vector3(), kUp = new THREE.Vector3(), kFwd = new THREE.Vector3(), kSide = new THREE.Vector3(), kMat = new THREE.Matrix4();
function updateRiderVisual(r, dt, li) {
  const m = r.mesh;
  const wave = waveH(r.x, r.z, worldTime);
  m.root.position.set(r.x, r.y + wave * 0.8, r.z);
  m.root.rotation.y = r.h + r.spin;
  m.root.visible = !(r.inv > 0 && Math.floor(r.inv * 10) % 2 === 0);

  const tg = m.tg;
  if (r.crash) {
    const t = r.crash.t, ty = r.crash.type;
    if (ty === 'slip') { tg.rotation.set(0, t * 14, 0); tg.position.y = 0; }
    else { tg.rotation.set(0, 0, lerp(tg.rotation.z, 1.5, damp(6, dt))); tg.position.y = lerp(tg.position.y, -0.9, damp(4, dt)); }
  } else {
    tg.position.y = lerp(tg.position.y, 0, damp(8, dt));
    tg.rotation.set(0, 0, 0);
    if (r.trickT > 0) {
      const prog = 1 - r.trickT / r.trickDur, a = prog * TAU;
      if (r.trickType === 0) tg.rotation.y = a;
      else if (r.trickType === 1) tg.rotation.x = -a;
      else tg.rotation.z = a;
    }
    const lean = r.steerVis * 0.35 + (r.edging ? 0.22 * (r.steerVis >= 0 ? 1 : -1) : 0);
    m.board.rotation.z = lerp(m.board.rotation.z, lean, damp(10, dt));
    m.body.rotation.z = m.board.rotation.z * 0.8;
    m.body.rotation.x = lerp(m.body.rotation.x, r.edging ? -0.32 : -0.15, damp(6, dt));
  }
  m.shield.visible = r.shieldT > 0;
  if (m.shield.visible) m.shield.scale.setScalar(2.6 + Math.sin(worldTime * 6) * 0.1);

  // Kite: fliegt auf der Lee-Seite (mit dem Wind) und zieht leicht in Fahrtrichtung
  const fx = r.fx, fz = r.fz, rx = -fz, rz = fx;
  const hy = r.y + 1.6 + wave * 0.8;
  let dx = wind.x * 0.85 + fx * 0.55 + rx * r.steerVis * 0.25, dz = wind.z * 0.85 + fz * 0.55 + rz * r.steerVis * 0.25;
  const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  // Böen lassen den Kite quer zum Wind pendeln
  const sway = Math.sin(r.sway * 0.9) * 1.4 * wind.gust;
  let kx = r.x + dx * KITE_DIST - wind.z * sway, kz = r.z + dz * KITE_DIST + wind.x * sway;
  let ky = KITE_H + r.y * 0.85 + Math.sin(r.sway * 1.3) * 0.5 - (wind.gust - 1) * 3;
  if (r.crash && r.crash.type === 'tangle') {
    const f = clamp(r.crash.t / 0.9, 0, 1);
    ky = lerp(ky, 0.6, f * f);
    kx += wind.x * 6 * f; kz += wind.z * 6 * f;   // abgestürzter Kite treibt mit dem Wind ab
  }
  r.kx = lerp(r.kx || kx, kx, damp(10, dt)); r.kz = lerp(r.kz || kz, kz, damp(10, dt)); r.ky = lerp(r.ky, ky, damp(10, dt));
  m.kite.position.set(r.kx, r.ky, r.kz);
  // Ausrichtung: Leinen stehen senkrecht zum Schirm, Vorderkante zeigt gegen den Wind
  kUp.set(r.kx - r.x, r.ky - hy, r.kz - r.z).normalize();
  kFwd.set(-wind.x, 0, -wind.z).addScaledVector(kUp, wind.x * kUp.x + wind.z * kUp.z).normalize();
  kSide.crossVectors(kUp, kFwd);
  kMat.makeBasis(kSide, kUp, kFwd);
  m.kite.quaternion.setFromRotationMatrix(kMat);
  m.kite.rotateY(Math.sin(r.sway * 1.7) * 0.08 * wind.gust);
  m.kite.visible = m.root.visible || !!r.crash;

  // Leinen
  m.kite.updateMatrixWorld();
  const arr = kiteLines.geometry.attributes.position.array;
  for (let s = 0; s < 2; s++) {
    const side = s ? 1 : -1;
    tmpV.set(side * 3.25, -2.1, 0); m.kite.localToWorld(tmpV);
    const o = (li * 4 + s * 2) * 3;
    arr[o] = tmpV.x; arr[o + 1] = tmpV.y; arr[o + 2] = tmpV.z;
    arr[o + 3] = r.x + fx * 1 - rx * side * 0.6; arr[o + 4] = hy; arr[o + 5] = r.z + fz * 1 - rz * side * 0.6;
  }

  // Gischt hinter dem Brett
  if (!r.airborne && r.speed > 6 && !r.crash) {
    const rate = r.speed * 0.22 * (r.edging ? 2.2 : 1) * (r.boost > 0 ? 1.6 : 1) * (r.isPlayer ? 1 : 0.6);
    r.sprayAcc = (r.sprayAcc || 0) + rate * dt;
    while (r.sprayAcc > 1) {
      r.sprayAcc--;
      const side = Math.random() < 0.5 ? -1 : 1;
      emitSpray(r.x - fx * 1.8 + rx * side * 0.5, 0.2 + wave, r.z - fz * 1.8 + rz * side * 0.5,
        -fx * r.speed * 0.08 + rx * side * (2 + Math.random() * 3), 3 + Math.random() * 4 + (r.edging ? 3 : 0), -fz * r.speed * 0.08 + rz * side * (2 + Math.random() * 3),
        0.45 + Math.random() * 0.3, 0.25 + Math.random() * 0.25);
    }
  }
}

// ===================================================================
// Kamera
// ===================================================================
let camH = 0;
const camLook = new THREE.Vector3(), camWant = new THREE.Vector3();
function updateChaseCam(r, dt) {
  camH += wrapAngle(r.h - camH) * damp(r.crash ? 1.5 : 4, dt);
  const fx = Math.sin(camH), fz = Math.cos(camH);
  camWant.set(r.x - fx * 13, 7 + r.y * 0.55, r.z - fz * 13);
  camera.position.lerp(camWant, damp(7, dt));
  camLook.set(r.x + fx * 10, 5.2 + r.y * 0.6, r.z + fz * 10);
  camera.lookAt(camLook);
  const fov = 66 + (r.boost > 0 ? 10 : 0) + (r.edging ? 4 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, damp(4, dt)); camera.updateProjectionMatrix(); }
}
function updateMenuCam(dt) {
  const lead = riders.reduce((a, b) => (b.progress > a.progress ? b : a), riders[0]);
  const a = worldTime * 0.15;
  camWant.set(lead.x + Math.sin(a) * 34, 15, lead.z + Math.cos(a) * 34);
  camera.position.lerp(camWant, damp(2, dt));
  camLook.set(lead.x, 4, lead.z);
  camera.lookAt(camLook);
}

// ===================================================================
// HUD
// ===================================================================
const hud = {
  pos: $('pos-num'), lap: $('lap-num'), timer: $('timer'),
  power: $('power-fill'), powerVal: $('power-val'), itemBtn: $('item-btn'), itemIcon: $('item-icon'),
  msg: $('message'), jump: $('btn-jump'), edge: $('btn-edge'), wind: $('wind-arrow'),
  draft: $('draft-fill'), draftBox: $('draft-box'), round: $('round-box'), hc: $('hc-box'),
};
let msgTimer = 0;
function showMsg(text, dur = 1.5, small = '') {
  hud.msg.innerHTML = text + (small ? `<small>${small}</small>` : '');
  hud.msg.classList.add('show');
  msgTimer = dur;
}
const itemKeys = Object.keys(ITEMS);
let lastHud = {};
function setHud(key, el, val, prop = 'textContent') {
  if (lastHud[key] === val) return;
  lastHud[key] = val;
  el[prop] = val;
}
function updateHud(dt) {
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) hud.msg.classList.remove('show'); }
  if (!player) return;
  setHud('pos', hud.pos, String(player.rank));
  const hc = Math.round(handicap(player) * 1000) / 10;
  setHud('hc', hud.hc, hc > 0 ? `+${String(hc).replace('.', ',')} % Tempo` : '');
  setHud('lap', hud.lap, fmtDist(remaining(player)));
  const left = RACE_TIME_LIMIT - raceTime;
  setHud('timer', hud.timer, fmtClock(state === 'countdown' ? RACE_TIME_LIMIT : left));
  hud.timer.classList.toggle('low', left < 30 && state === 'race');
  // Windpfeil relativ zur Blickrichtung der Kamera (oben = geradeaus)
  const cf = Math.sin(camH) * wind.x + Math.cos(camH) * wind.z;
  const cr = -Math.cos(camH) * wind.x + Math.sin(camH) * wind.z;
  setHud('wind', hud.wind.style, `rotate(${Math.round(Math.atan2(cr, cf) * 180 / Math.PI - 90)}deg)`, 'transform');
  const df = Math.round(player.draft / DRAFT_TIME * 20) * 5;
  setHud('draft', hud.draft.style, df + '%', 'width');
  setHud('draftOn', hud.draftBox, df > 0 ? 'on' : '', 'className');
  const pw = Math.round(player.power);
  setHud('pw', hud.power.style, pw + '%', 'width');
  setHud('pwv', hud.powerVal, String(pw));
  let icon = '', cls = '';
  if (player.roll > 0) { icon = ITEMS[itemKeys[Math.floor(worldTime * 14) % itemKeys.length]].icon; }
  else if (player.item) { icon = ITEMS[player.item].icon + (player.itemCount > 1 ? `<sup>${player.itemCount}</sup>` : ''); cls = 'ready'; }
  setHud('icon', hud.itemIcon, icon, 'innerHTML');
  setHud('icls', hud.itemBtn, cls, 'className');
  setHud('jd', hud.jump, (player.power < JUMP_COST && !player.airborne) ? 'big-btn disabled' + (hud.jump.classList.contains('down') ? ' down' : '') : 'big-btn' + (hud.jump.classList.contains('down') ? ' down' : ''), 'className');
  setHud('ed', hud.edge, (player.exhausted ? 'big-btn disabled' : 'big-btn') + (hud.edge.classList.contains('down') ? ' down' : ''), 'className');
}

// Minikarte
const mm = $('minimap'), mmCtx = mm.getContext('2d');
let mmBase = null, mmT = null;
function buildMinimapBase() {
  mmBase = document.createElement('canvas'); mmBase.width = mmBase.height = 140;
  const g = mmBase.getContext('2d');
  const span = Math.max(path.maxX - path.minX, path.maxZ - path.minZ);
  const s = 110 / span, ox = 70 - ((path.minX + path.maxX) / 2) * s, oz = 70 - ((path.minZ + path.maxZ) / 2) * s;
  mmT = (x, z) => [ox + x * s, oz + z * s];
  g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i < path.N; i += 4) { const [px, pz] = mmT(path.x[i], path.z[i]); i ? g.lineTo(px, pz) : g.moveTo(px, pz); }
  g.lineCap = 'round';
  g.lineWidth = 9; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke();
  g.lineWidth = 5; g.strokeStyle = '#1b7fa3'; g.stroke();
  const [sx, sz] = mmT(path.x[START_IDX], path.z[START_IDX]);
  g.fillStyle = '#3fbf5a'; g.beginPath(); g.arc(sx, sz, 5, 0, TAU); g.fill();
  const [fx, fz] = mmT(path.x[path.finishIdx], path.z[path.finishIdx]);
  g.fillStyle = '#fff'; g.fillRect(fx - 5, fz - 5, 10, 10);
  g.fillStyle = '#222'; g.fillRect(fx - 5, fz - 5, 5, 5); g.fillRect(fx, fz, 5, 5);
}
function drawMinimap() {
  mmCtx.clearRect(0, 0, 140, 140);
  mmCtx.drawImage(mmBase, 0, 0);
  for (const r of riders) {
    if (r.isPlayer) continue;
    const [x, z] = mmT(r.x, r.z);
    mmCtx.fillStyle = '#' + new THREE.Color(r.def.kite).getHexString();
    mmCtx.beginPath(); mmCtx.arc(x, z, 4, 0, TAU); mmCtx.fill();
  }
  if (player) {
    const [x, z] = mmT(player.x, player.z);
    mmCtx.fillStyle = '#ffd23f'; mmCtx.strokeStyle = '#6b3b00'; mmCtx.lineWidth = 2;
    mmCtx.beginPath(); mmCtx.arc(x, z, 6, 0, TAU); mmCtx.fill(); mmCtx.stroke();
  }
}

// ===================================================================
// Rennablauf
// ===================================================================
function updateRanks() {
  const sorted = riders.slice().sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return a.finishTime - b.finishTime;
    return b.progress - a.progress;
  });
  sorted.forEach((r, i) => { r.rank = i + 1; });
  return sorted;
}

// Handicap nach Platz: jeder Platz hinter dem Führenden fährt etwas schneller (gilt für alle)
const HANDICAP_PER_PLACE = 0.015;
const handicap = (r) => (r.finished ? 0 : (r.rank - 1) * HANDICAP_PER_PLACE);
function rubberBand(r, dt) {
  const base = r.isPlayer ? 1 : 0.96;      // Grundtempo der Computer-Fahrer
  r.speedMul = lerp(r.speedMul, base + handicap(r), damp(1.5, dt));
}

let lastLapMsg = -2, demoEnd = 0;
function simulate(dt) {
  worldTime += dt;
  wind.gust = 1 + 0.18 * Math.sin(worldTime * 0.37) + 0.1 * Math.sin(worldTime * 1.13 + 2);
  setWind(wind.base + 25 * Math.sin(worldTime * 0.07));     // der Wind dreht langsam hin und her
  for (const f of gusts) { f.mesh.rotation.y = Math.atan2(wind.x, wind.z); }
  gustTex.offset.y = (worldTime * 1.5) % 1;
  const racing = state === 'race' || state === 'finished' || state === 'menu';
  if (racing) {
    for (const r of riders) {
      const c = (r.isPlayer && !r.finished && state !== 'menu' && !debug.autopilot) ? playerControl() : aiControl(r, dt);
      if (r.roll > 0) { r.roll -= dt; if (r.roll <= 0) { r.item = r.rollItem; r.itemCount = r.item === 'triple' ? 3 : 1; r.ai.itemTimer = 0.5 + Math.random() * 3; } }
      if (c.item && r.item && !r.crash) useItem(r);
      rubberBand(r, dt);
      physics(r, c, dt);
      locate(r, dt);
      trackFeatures(r, dt);
    }
    drafting(dt);
    collisions();
    updateProjectiles(dt);
    updateRanks();
  }
  for (const box of itemBoxes) {
    box.off = Math.max(0, box.off - dt);
    box.grp.visible = box.off <= 0;
    box.grp.position.y = 2 + Math.sin(worldTime * 2 + box.phase) * 0.4;
    box.grp.rotation.y = worldTime * 1.5 + box.phase;
  }
  boxMat.color.setHSL((worldTime * 0.15) % 1, 0.8, 0.75);
  riders.forEach((r, i) => updateRiderVisual(r, dt, i));
  kiteLines.geometry.attributes.position.needsUpdate = true;
  updateSpray(dt);
  waterMat.uniforms.uTime.value = worldTime;

  if (state === 'race' && player) {
    raceTime += dt;
    const rest = remaining(player);
    if (rest < 500 && lastLapMsg !== 500) {
      lastLapMsg = 500; showMsg('Endspurt!', 1.8, 'Noch 500 m bis zum Ziel'); beep(660, 0.15); beep(990, 0.3);
    } else if (rest < path.raceLen / 2 && lastLapMsg < 0) {
      lastLapMsg = 1; showMsg('Halbzeit!', 1.4, 'Noch ' + fmtDist(rest));
    }
    if (player.wrongWay > 1.2) showMsg('Falsche Richtung!', 0.3);
    if (raceTime >= RACE_TIME_LIMIT) { timeUp = true; showResults(); }
  }
  if (state === 'menu') {
    demoEnd = riders.some((r) => r.finished) ? demoEnd + dt : 0;
    if (demoEnd > 5) startMenuDemo();
  }
  if (state === 'finished') {
    raceTime += dt;
    finishTimer -= dt;
    if (finishTimer <= 0) showResults();
  }
}

function onPlayerFinish() {
  state = 'finished';
  finishTimer = 3.5;
  showMsg(`Ziel! Platz ${player.rank}`, 3.2, fmtTime(player.finishTime));
  beep(523, 0.15); setTimeout(() => beep(659, 0.15), 150); setTimeout(() => beep(784, 0.35), 300);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!world) return;
  if (state === 'countdown') {
    countdown -= dt;
    const n = Math.ceil(countdown);
    if (n !== lastCount && n > 0 && n <= 3) { lastCount = n; showMsg(String(n), 0.9); beep(440, 0.15); }
    // Start-Turbo: Kante kurz vor „Los!“ drücken
    const held = input.edgeKey || input.edgeTouch;
    if (held && startPress === null) startPress = countdown;
    if (!held) startPress = null;
    if (countdown > 0.5) calibrateTilt();     // Haltung während des Countdowns = geradeaus
    if (countdown <= 0) { state = 'race'; startBoosts(held); }
    worldTime += dt;
    riders.forEach((r, i) => updateRiderVisual(r, dt, i));
    kiteLines.geometry.attributes.position.needsUpdate = true;
    updateSpray(dt);
    waterMat.uniforms.uTime.value = worldTime;
    input.jump = false; input.item = false;
  } else if (state !== 'paused' && state !== 'results') {
    simulate(dt);
  }
  if (state === 'menu') updateMenuCam(dt);
  else if (player && state !== 'paused') updateChaseCam(player, dt);
  if (state !== 'menu') { updateHud(dt); if (state !== 'paused') drawMinimap(); }
  renderer.render(scene, camera);
}
let lastCount = 0, startPress = null;
function startBoosts(held) {
  for (const r of riders) {
    if (r.isPlayer) continue;
    if (Math.random() < 0.25 + r.def.stats.skill * 0.1) r.boost = 1.6;
  }
  if (!player) return;
  if (held && startPress !== null && startPress <= 1.0) {
    player.boost = 1.6; showMsg('Perfekter Start!', 1.2); beep(880, 0.15); beep(1320, 0.3);
  } else if (held && startPress !== null) {
    player.slow = 1.0; showMsg('Fehlstart!', 1.2, 'Zu früh gedrückt'); beep(200, 0.4, 'square', 0.06);
  } else {
    showMsg('Los!', 0.8); beep(880, 0.35);
  }
}

// ===================================================================
// Menüs
// ===================================================================
const screens = ['menu-title', 'menu-help', 'menu-chars', 'menu-tracks', 'menu-pause', 'menu-results'];
function show(id) {
  screens.forEach((s) => $(s).classList.toggle('hidden', s !== id));
}
function setRaceUI(on) {
  $('hud').classList.toggle('hidden', !on);
  $('touch').classList.toggle('hidden', !on || !isTouch);
}
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => show(b.dataset.back)));

function buildCharGrid() {
  const grid = $('char-grid');
  grid.innerHTML = '';
  CHARACTERS.forEach((c, i) => {
    const el = document.createElement('button');
    el.className = 'char-card' + (i === selChar ? ' selected' : '');
    const stats = Object.keys(STAT_LABELS).map((k) =>
      `<div class="stat"><label>${STAT_LABELS[k]}</label><div class="pips">${[1, 2, 3, 4, 5].map((n) => `<i class="pip${n <= c.stats[k] ? ' on' : ''}"></i>`).join('')}</div></div>`).join('');
    el.innerHTML = `<div class="char-head"><div class="char-face" style="background:#${new THREE.Color(c.kite).getHexString()}">${c.emoji}</div>
      <div><div class="char-name">${c.name}</div><div class="char-type">${c.type} · ${c.desc}</div></div></div>${stats}`;
    el.addEventListener('click', () => {
      selChar = i;
      try { localStorage.setItem('kk_char', i); } catch (e) { /* egal */ }
      grid.querySelectorAll('.char-card').forEach((n, k) => n.classList.toggle('selected', k === i));
      beep(600 + i * 40, 0.08, 'triangle');
    });
    grid.appendChild(el);
  });
}
function buildTrackGrid() {
  const grid = $('track-grid');
  grid.innerHTML = '';
  TRACKS.forEach((t, i) => {
    const p = computePath(t);
    const el = document.createElement('button');
    el.className = 'track-card' + (i === selTrack ? ' selected' : '');
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 160;
    const g = cv.getContext('2d');
    const span = Math.max((p.maxX - p.minX) / 1.5, p.maxZ - p.minZ);
    const s = 130 / span, ox = 120 - ((p.minX + p.maxX) / 2) * s, oz = 80 - ((p.minZ + p.maxZ) / 2) * s;
    g.lineJoin = 'round';
    g.beginPath();
    g.lineCap = 'round';
    for (let k = 0; k < p.N; k += 3) { k ? g.lineTo(ox + p.x[k] * s, oz + p.z[k] * s) : g.moveTo(ox + p.x[k] * s, oz + p.z[k] * s); }
    g.lineWidth = 12; g.strokeStyle = '#fff'; g.stroke();
    g.lineWidth = 7; g.strokeStyle = '#' + new THREE.Color(t.water[0]).getHexString(); g.stroke();
    g.fillStyle = '#3fbf5a'; g.beginPath(); g.arc(ox + p.x[START_IDX] * s, oz + p.z[START_IDX] * s, 7, 0, TAU); g.fill();
    g.fillStyle = '#ff4f4f'; g.beginPath(); g.arc(ox + p.x[p.finishIdx] * s, oz + p.z[p.finishIdx] * s, 7, 0, TAU); g.fill();
    el.appendChild(cv);
    const info = document.createElement('div');
    info.innerHTML = `<div class="track-name">${t.name}</div><div class="track-info">${t.difficulty} · ${fmtDist(p.raceLen)} von Start bis Ziel<br>Zeitlimit 3:00</div>`;
    el.appendChild(info);
    el.addEventListener('click', () => {
      selTrack = i;
      try { localStorage.setItem('kk_track', i); } catch (e) { /* egal */ }
      grid.querySelectorAll('.track-card').forEach((n, k) => n.classList.toggle('selected', k === i));
      beep(500 + i * 80, 0.08, 'triangle');
    });
    grid.appendChild(el);
  });
}

function goFullscreen() {
  if (!isTouch) return;
  const el = document.documentElement;
  try {
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req && !document.fullscreenElement) {
      const p = req.call(el);
      if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
    }
  } catch (e) { /* nicht unterstützt */ }
}

// K.-o.-Cup: { round, field: Liste der Charakter-Indizes, die noch dabei sind }
let cup = null, resultAction = 'again';
function startCup() {
  cup = { round: 0, field: CHARACTERS.map((c, i) => i) };
  startRace();
}

function startRace() {
  show(null);
  const round = cup && CUP_ROUNDS[cup.round];
  setupRace(TRACKS[round ? round.track : selTrack], selChar, cup ? cup.field.map((i) => CHARACTERS[i]) : null);
  lastHud = {}; lastLapMsg = -2; lastCount = 0; startPress = null;
  setRaceUI(true);
  state = 'countdown';
  countdown = round ? 5 : 3.2;
  calibrateTilt();
  hud.round.textContent = round ? `🏆 ${round.name} · ${riders.length} Fahrer` : '';
  if (round) showMsg(round.name, 1.8, round.out ? `Die letzten ${round.out} scheiden aus` : 'Der Sieger holt den Cup!');
  input.touchSteer = 0; input.edgeTouch = false;
}

function startMenuDemo() {
  demoEnd = 0;
  setupRace(TRACKS[selTrack], -1);
  // Demo: Fahrer etwas verteilen, damit es lebendig aussieht
  riders.forEach((r, i) => { r.speed = 20; r.power = 40 + i * 7; });
  state = 'menu';
  setRaceUI(false);
}

function togglePause() {
  if (state === 'race' || state === 'finished') {
    pausedFrom = state; state = 'paused'; show('menu-pause');
  } else if (state === 'paused') {
    state = pausedFrom; show(null); last = performance.now();
  }
}
let pausedFrom = 'race';
document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'race' || state === 'finished')) togglePause(); });

function showResults() {
  state = 'results';
  const sorted = updateRanks();
  let title = timeUp && !(player && player.finished) ? 'Zeit abgelaufen!' : `Platz ${player.rank}!`;
  let out = [];
  resultAction = 'again';
  if (cup) {
    const round = CUP_ROUNDS[cup.round], final = cup.round === CUP_ROUNDS.length - 1;
    out = round.out ? sorted.slice(sorted.length - round.out) : [];
    const playerOut = out.includes(player);
    if (final) title = player.rank === 1 ? '🏆 Cup-Sieger!' : `Finale: Platz ${player.rank}`;
    else title = playerOut ? 'Ausgeschieden!' : `${round.name} geschafft!`;
    if (!final && !playerOut) {
      cup.field = sorted.filter((r) => !out.includes(r)).map((r) => CHARACTERS.indexOf(r.def));
      cup.round++;
      resultAction = 'next';
    } else resultAction = 'cup';
  }
  $('btn-res-again').textContent = resultAction === 'next' ? `Weiter: ${CUP_ROUNDS[cup.round].name}` : resultAction === 'cup' ? 'Cup neu starten' : 'Nochmal';
  $('result-title').textContent = title;
  $('result-table').innerHTML = sorted.map((r) => {
    let t;
    if (out.includes(r)) t = '✖ raus';
    else if (r.finished) t = fmtTime(r.finishTime);
    else t = 'noch ' + fmtDist(remaining(r));
    return `<tr class="${r.isPlayer ? 'me' : ''}${out.includes(r) ? ' out' : ''}"><td>${r.rank}.</td><td>${r.def.emoji} ${r.def.name}${r.isPlayer ? ' (Du)' : ''}</td><td>${t}</td></tr>`;
  }).join('');
  setRaceUI(false);
  show('menu-results');
  beep(player.rank <= 3 ? 784 : 330, 0.4, 'triangle');
}

$('btn-start').addEventListener('click', () => { goFullscreen(); buildCharGrid(); show('menu-chars'); beep(660, 0.1, 'triangle'); });
$('btn-help').addEventListener('click', () => show('menu-help'));
$('btn-chars-next').addEventListener('click', () => { buildTrackGrid(); show('menu-tracks'); });
$('btn-race').addEventListener('click', () => { goFullscreen(); cup = null; startRace(); });
$('btn-cup').addEventListener('click', () => { goFullscreen(); startCup(); });
$('btn-resume').addEventListener('click', () => { calibrateTilt(); togglePause(); });
$('btn-restart').addEventListener('click', () => startRace());
$('btn-quit').addEventListener('click', () => { cup = null; startMenuDemo(); show('menu-title'); });
$('btn-res-again').addEventListener('click', () => (resultAction === 'cup' ? startCup() : startRace()));
$('btn-res-menu').addEventListener('click', () => { cup = null; startMenuDemo(); show('menu-title'); });

// Debug-/Testzugriff
const debug = { autopilot: false };
window.KiteKart = {
  debug,
  fastForward(sec) { if (state === 'countdown') state = 'race'; for (let t = 0; t < sec && (state === 'race' || state === 'finished'); t += 1 / 30) simulate(1 / 30); },
  get raceTime() { return raceTime; },
  get state() { return state; }, get riders() { return riders; }, get player() { return player; }, get path() { return path; }, startRace, startCup,
  get cup() { return cup; }, tilt, get features() { return { ramps, gates, rocks, gusts, shortcuts }; }, showResults, selectChar: (i) => { selChar = i; }, selectTrack: (i) => { selTrack = i; } };

try { if (isTouch && localStorage.getItem('kk_tilt') === '1' && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission !== 'function') enableTilt(); } catch (e) { /* egal */ }
startMenuDemo();
show('menu-title');
requestAnimationFrame(frame);
})();
