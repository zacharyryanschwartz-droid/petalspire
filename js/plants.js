// Procedural low-poly plant meshes for Petalspire
import * as THREE from 'three';
import { SPECIES, PLANT_TIERS } from './data.js';

const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...o }));
  }
  return matCache.get(key);
}

let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,248,225,.55)');
  gr.addColorStop(0.6, 'rgba(255,236,190,.15)');
  gr.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
export function glowSprite(color = '#FFF4D6', size = 1, opacity = 0.7) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); s.userData.baseOpacity = opacity; s.userData.glow = true;
  return s;
}

const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

// Leaf extending along +Z from origin, bent (droop) toward tip
function leafGeo(len = 1, wid = 0.3, droop = 0.35, thick = 0.05) {
  const g = new THREE.SphereGeometry(1, 14, 8);
  g.scale(wid, thick, len * 0.5); g.translate(0, 0, len * 0.5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / len;
    p.setY(i, p.getY(i) - droop * z * z * len + Math.abs(p.getX(i)) * 0.25);
    p.setX(i, p.getX(i) * (1 - 0.35 * z));
  }
  g.computeVertexNormals();
  return g;
}

function stemGeo(height, r = 0.035, bend = 0.06, seed = 0) {
  const pts = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    pts.push(new THREE.Vector3(Math.sin(t * 2.2 + seed) * bend * t, t * height, Math.cos(t * 1.7 + seed) * bend * t * 0.6));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 10, r, 6, false);
  return { g, curve };
}

function addLeaves(group, n, { len = 0.5, wid = 0.14, tilt = 0.9, droop = 0.35, color = '#7FA47D', y = 0.02, phase = 0, jitter = 0.15 } = {}) {
  const lm = mat(color);
  for (let i = 0; i < n; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = phase + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * jitter;
    pivot.position.y = y;
    const l = shadowy(new THREE.Mesh(leafGeo(len * (0.85 + Math.random() * 0.3), wid, droop), lm));
    l.rotation.x = -tilt + (Math.random() - 0.5) * 0.2;
    pivot.add(l); group.add(pivot);
  }
}

function seedMound(color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#6B4A33'));
  m.scale.y = 0.45; shadowy(m); g.add(m);
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(color, { roughness: 0.5 }));
  s.scale.set(1, 0.7, 1.3); s.position.set(0.02, 0.07, 0); s.rotation.y = 0.6; g.add(s);
  return g;
}

function sprout(color = '#9CC49A', h = 0.22) {
  const g = new THREE.Group();
  const { g: sg } = stemGeo(h, 0.018, 0.02);
  g.add(shadowy(new THREE.Mesh(sg, mat('#6E9A62'))));
  const top = new THREE.Group(); top.position.y = h; g.add(top);
  addLeaves(top, 2, { len: 0.17, wid: 0.075, tilt: 0.45, droop: 0.1, color, jitter: 0 });
  return g;
}

// ---------------- Moonflower ----------------
function trumpetGeo(scale = 1) {
  const pts = [[0.012, 0], [0.028, 0.1], [0.038, 0.22], [0.052, 0.32], [0.085, 0.4], [0.15, 0.46], [0.225, 0.495], [0.262, 0.488], [0.27, 0.47]]
    .map(([x, y]) => new THREE.Vector2(x * scale, y * scale));
  const g = new THREE.LatheGeometry(pts, 20);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const a = Math.atan2(z, x);
    const k = THREE.MathUtils.smoothstep(y / scale, 0.3, 0.49);
    const f = 1 + 0.16 * Math.cos(a * 5) * k;
    p.setX(i, x * f); p.setZ(i, z * f); p.setY(i, y + 0.03 * scale * Math.cos(a * 5) * k);
  }
  g.computeVertexNormals();
  return g;
}

function moonflower(stage) {
  const g = new THREE.Group();
  if (stage === 1) return addTo(g, sprout('#A9CBA6'));
  const h = stage === 2 ? 0.55 : 0.9;
  const { g: sg, curve } = stemGeo(h, 0.03, 0.05, 1.3);
  g.add(shadowy(new THREE.Mesh(sg, mat('#6E9A62'))));
  addLeaves(g, stage === 2 ? 4 : 6, { len: stage === 2 ? 0.45 : 0.62, wid: 0.12, tilt: 1.0, droop: 0.42, color: '#7FA47D' });
  addLeaves(g, 3, { len: 0.38, wid: 0.1, tilt: 0.6, droop: 0.3, color: '#94B98F', y: h * 0.35, phase: 0.5 });
  const top = curve.getPoint(1);
  const white = mat('#F6F2E6', { emissive: '#FFF0CC', emissiveIntensity: 0.18, roughness: 0.6, side: THREE.DoubleSide });
  if (stage === 2) {
    const bud = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 10), white);
    bud.position.copy(top).add(new THREE.Vector3(0, 0.14, 0)); bud.rotation.z = 0.15;
    const twist = bud.geometry.attributes.position;
    for (let i = 0; i < twist.count; i++) { const y = twist.getY(i); const a = y * 4; const x = twist.getX(i), z = twist.getZ(i); twist.setX(i, x * Math.cos(a) - z * Math.sin(a)); twist.setZ(i, x * Math.sin(a) + z * Math.cos(a)); }
    g.add(shadowy(bud));
    const gl = glowSprite('#FFF2D0', 0.6, 0.35); gl.position.copy(bud.position); g.add(gl);
    return g;
  }
  const head = new THREE.Group(); head.position.copy(top); head.rotation.z = -0.55; head.rotation.x = 0.15;
  const tr = shadowy(new THREE.Mesh(trumpetGeo(1.05), white)); head.add(tr);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.01, 0.2, 8, 1, true), mat('#FFF0B8', { emissive: '#FFE38A', emissiveIntensity: 0.9, side: THREE.DoubleSide }));
  inner.position.y = 0.36; head.add(inner);
  const pist = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), mat('#F5D07A', { emissive: '#F5D07A', emissiveIntensity: 1 }));
  pist.position.y = 0.47; head.add(pist);
  const sep = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 6), mat('#7FA47D')); sep.rotation.x = Math.PI; sep.position.y = 0.03; head.add(sep);
  const gl = glowSprite('#FFE4A8', 1.05, 0.3); gl.position.y = 0.42; head.add(gl);
  g.add(head);
  // floating motes
  const mg = new THREE.BufferGeometry(); const n = 10; const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = (Math.random() - 0.5) * 0.7; arr[i * 3 + 1] = 0.5 + Math.random() * 0.8; arr[i * 3 + 2] = (Math.random() - 0.5) * 0.7; }
  mg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.09, map: glowTexture(), color: '#FFF3C4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.userData.motes = true; g.add(motes);
  g.userData.glowing = true;
  return g;
}

// ---------------- Spiral Sunpetal ----------------
function petalGeo(len, wid) {
  const g = new THREE.SphereGeometry(1, 14, 8);
  g.scale(wid, 0.035, len * 0.5); g.translate(0, 0, len * 0.5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / len, x = p.getX(i) / wid;
    p.setY(i, p.getY(i) + 0.3 * z * z * len + x * x * 0.07 * len * 3);
    p.setX(i, p.getX(i) * (0.55 + 0.6 * Math.sin(Math.min(1, z) * Math.PI * 0.85)));
  }
  g.computeVertexNormals();
  return g;
}
function sunpetal(stage) {
  const g = new THREE.Group();
  if (stage === 1) return addTo(g, sprout('#A7C99B'));
  const h = stage === 2 ? 0.6 : 1.05;
  const { g: sg } = stemGeo(h, 0.032, 0.03, 0.4);
  g.add(shadowy(new THREE.Mesh(sg, mat('#6E9A62'))));
  addLeaves(g, 5, { len: stage === 2 ? 0.42 : 0.55, wid: 0.13, tilt: 0.85, droop: 0.38, color: '#7FA47D' });
  if (stage === 2) {
    const bud = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.34, 9), mat('#C9CE7A'));
    bud.position.y = h + 0.1; g.add(shadowy(bud));
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(petalGeo(0.12, 0.05), mat('#D9C566'));
      const pv = new THREE.Group(); pv.position.y = h - 0.04 + i * 0.045; pv.rotation.y = i * 2.4; p.rotation.x = -1.2; pv.add(p); g.add(pv);
    }
    return g;
  }
  const N = 17;
  const c1 = new THREE.Color('#F7DA85'), c2 = new THREE.Color('#E9A93E');
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const size = THREE.MathUtils.lerp(0.36, 0.17, t);
    const col = c2.clone().lerp(c1, t * 0.9 + 0.1 * Math.random());
    const p = shadowy(new THREE.Mesh(petalGeo(size, size * 0.6), mat('#' + col.getHexString(), { roughness: 0.6, emissive: '#5a3a00', emissiveIntensity: 0.05 })));
    const pv = new THREE.Group();
    pv.position.y = THREE.MathUtils.lerp(0.42, h + 0.12, t);
    pv.rotation.y = i * 2.39996;
    p.rotation.x = -THREE.MathUtils.lerp(0.2, 0.75, t);
    p.position.z = 0.04;
    pv.add(p); g.add(pv);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 8), mat('#F5D07A')); tip.position.y = h + 0.2; g.add(tip);
  const gl = glowSprite('#FFD98A', 0.9, 0.18); gl.position.y = h * 0.8; g.add(gl);
  return g;
}

// ---------------- Heartvine ----------------
let heartGeoCache;
function heartGeo() {
  if (heartGeoCache) return heartGeoCache;
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(0.12, -0.33, 0.5, -0.12, 0.5, 0.16);
  s.bezierCurveTo(0.5, 0.45, 0.16, 0.52, 0, 0.27);
  s.bezierCurveTo(-0.16, 0.52, -0.5, 0.45, -0.5, 0.16);
  s.bezierCurveTo(-0.5, -0.12, -0.12, -0.33, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.04, bevelSegments: 2, curveSegments: 7 });
  g.translate(0, 0, -0.015);
  // cup slightly
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) - x * x * 0.35); }
  g.computeVertexNormals();
  return (heartGeoCache = g);
}
class Helix extends THREE.Curve {
  constructor(h, r, turns, ph) { super(); this.h = h; this.r = r; this.turns = turns; this.ph = ph; }
  getPoint(t, o = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2 + this.ph; const r = this.r * (1 - 0.35 * t) * Math.min(1, t * 6 + 0.2);
    return o.set(Math.cos(a) * r, t * this.h, Math.sin(a) * r);
  }
}
function heartvine(stage) {
  const g = new THREE.Group();
  if (stage === 1) {
    const s = sprout('#A9CBA6');
    const hl = new THREE.Mesh(heartGeo(), mat('#F7C5C5')); hl.scale.setScalar(0.12); hl.position.set(0, 0.26, 0.03); s.add(hl);
    return addTo(g, s);
  }
  const H = stage === 2 ? 0.6 : 1.05, R = 0.17, turns = stage === 2 ? 1.6 : 2.6;
  const vineM = mat('#6E9A62');
  for (const [ph, rr, k] of [[0, 1, 1], [Math.PI, 0.8, 0.85]]) {
    const curve = new Helix(H * k, R * rr, turns, ph);
    g.add(shadowy(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.028 * (k === 1 ? 1 : 0.8), 5), vineM)));
  }
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, H + 0.1, 5), mat('#B89470'));
  stake.position.y = (H + 0.1) / 2; g.add(stake);
  addLeaves(g, 3, { len: 0.28, wid: 0.1, tilt: 0.7, droop: 0.2, color: '#86AE80' });
  const curve = new Helix(H, R, turns, 0);
  const n = stage === 2 ? 5 : 10;
  const blush = [mat('#F7C5C5', { roughness: 0.6 }), mat('#F2AEB3', { roughness: 0.6 }), mat('#F9D3D0', { roughness: 0.6 })];
  const green = mat('#8DB78A');
  for (let i = 0; i < n; i++) {
    const t = 0.15 + (i / n) * 0.82;
    const p = curve.getPoint(t);
    const out = new THREE.Vector3(p.x, 0, p.z).normalize();
    const isGreen = stage === 2 ? i % 2 === 0 : i % 4 === 1;
    const leaf = shadowy(new THREE.Mesh(heartGeo(), isGreen ? green : blush[i % 3]));
    const sz = (stage === 2 ? 0.16 : 0.24) * (1.05 - t * 0.35);
    leaf.scale.setScalar(sz);
    leaf.position.copy(p).addScaledVector(out, sz * 0.55);
    leaf.lookAt(leaf.position.clone().add(out).add(new THREE.Vector3(0, 0.6, 0)));
    leaf.rotateZ((Math.random() - 0.5) * 0.6);
    g.add(leaf);
  }
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(stage === 2 ? '#B9CF95' : '#F2AEB3'));
  bud.scale.y = 1.3; bud.position.copy(curve.getPoint(1)).add(new THREE.Vector3(0, 0.04, 0)); g.add(bud);
  if (stage === 3) { const gl = glowSprite('#FFD3D3', 0.9, 0.16); gl.position.y = H * 0.6; g.add(gl); }
  return g;
}

// ================= v0.4: real plants (no glows / motes) =================
const spikeGeo = (() => { // a knobbly, tapering spike of florets (one mesh)
  const g = new THREE.CylinderGeometry(0.018, 0.034, 0.26, 7, 10); const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) { const y = p.getY(k), x = p.getX(k), z = p.getZ(k), a = Math.atan2(z, x); const bump = 1 + 0.28 * Math.max(0, Math.sin(y * 70 + a * 3)); p.setX(k, x * bump); p.setZ(k, z * bump); }
  g.computeVertexNormals(); return g; })();
// ---------------- Lavender: a mound of narrow grey-green leaves with slender purple flower spikes ----------------
function lavender(stage) {
  const g = new THREE.Group();
  if (stage === 1) return addTo(g, sprout('#A9BBA3', 0.2));
  const big = stage === 3;
  addLeaves(g, big ? 16 : 11, { len: big ? 0.42 : 0.32, wid: 0.045, tilt: 0.55, droop: 0.12, color: '#93A88E', jitter: 0.5 });
  addLeaves(g, big ? 10 : 6, { len: big ? 0.3 : 0.24, wid: 0.04, tilt: 0.25, droop: 0.05, color: '#A3B59D', y: 0.05, phase: 0.3, jitter: 0.5 });
  const n = big ? 9 : 6, stemM = mat('#7F9A72'), purple = [mat('#8E74C2', { roughness: 0.7 }), mat('#9C86C9', { roughness: 0.7 }), mat('#7D62B3', { roughness: 0.7 })], budM = mat('#A7A0B8', { roughness: 0.8 });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, lean = 0.12 + Math.random() * 0.2, h = (big ? 0.85 : 0.55) * (0.85 + Math.random() * 0.3);
    const pv = new THREE.Group(); pv.rotation.y = a; pv.rotation.z = lean; g.add(pv);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, h, 4), stemM); st.position.y = h / 2; pv.add(st);
    const spikeLen = big ? 0.26 : 0.12;
    const sp = new THREE.Mesh(spikeGeo, big ? purple[i % 3] : budM); sp.scale.set(1, spikeLen / 0.26, 1); sp.position.y = h - spikeLen / 2; pv.add(sp);
  }
  return g;
}
// daisy-type flower head (calendula & chamomile): one scalloped petal disc per row (cheap: 2–3 meshes per head), facing +Y
const daisyGeoCache = new Map();
function petalDiscGeo(petals, r) {
  const key = petals + ':' + r; if (daisyGeoCache.has(key)) return daisyGeoCache.get(key);
  const sh = new THREE.Shape(), N = petals * 8;
  for (let k = 0; k <= N; k++) { const a = (k / N) * Math.PI * 2, ph = (k % 8) / 8, rr = r * (0.42 + 0.58 * Math.pow(Math.sin(ph * Math.PI), 0.6)); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (k === 0) sh.moveTo(x, y); else sh.lineTo(x, y); }
  const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const d = Math.hypot(p.getX(k), p.getZ(k)) / r; p.setY(k, 0.02 * r * Math.sin(k) - d * d * r * 0.18); }
  g.computeVertexNormals(); daisyGeoCache.set(key, g); return g;
}
function daisyHead({ r = 0.13, petals = 16, rows = 1, petal = '#F0A33A', petal2 = null, centre = '#B5651D', dome = 0.5 }) {
  const head = new THREE.Group();
  for (let row = 0; row < rows; row++) {
    const d = shadowy(new THREE.Mesh(petalDiscGeo(petals, r * (1 - row * 0.25)), mat(row % 2 && petal2 ? petal2 : petal, { roughness: 0.65, side: THREE.DoubleSide })));
    d.position.y = row * 0.014; d.rotation.y = row * 0.21; head.add(d);
  }
  const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(centre, { roughness: 0.9 })); c.scale.y = dome; c.position.y = 0.012; head.add(c);
  return head;
}
// ---------------- Calendula: bushy, soft-green leaves and bright orange-gold double daisy blooms ----------------
function calendula(stage) {
  const g = new THREE.Group();
  if (stage === 1) return addTo(g, sprout('#A7C99B'));
  const big = stage === 3, H = big ? 0.62 : 0.45;
  addLeaves(g, big ? 9 : 7, { len: big ? 0.36 : 0.3, wid: 0.1, tilt: 0.75, droop: 0.25, color: '#86AE72' });
  addLeaves(g, 5, { len: 0.24, wid: 0.08, tilt: 0.5, droop: 0.15, color: '#97BC82', y: 0.12, phase: 0.6 });
  const stems = big ? 4 : 3;
  for (let i = 0; i < stems; i++) {
    const a = (i / stems) * Math.PI * 2 + 0.3, h = H * (0.8 + Math.random() * 0.35);
    const { g: sg, curve } = stemGeo(h, 0.02, 0.05, i * 1.7); const stem = shadowy(new THREE.Mesh(sg, mat('#6E9A62')));
    const pv = new THREE.Group(); pv.rotation.y = a; pv.rotation.z = 0.25; g.add(pv); pv.add(stem);
    const top = curve.getPoint(1);
    if (!big) { const bud = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#9DB86A')); bud.scale.y = 1.2; bud.position.copy(top).add(new THREE.Vector3(0, 0.03, 0)); pv.add(bud);
      const tipc = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#F0A33A')); tipc.position.copy(bud.position).add(new THREE.Vector3(0, 0.04, 0)); pv.add(tipc); continue; }
    const head = daisyHead({ r: 0.14, petals: 15, rows: 2, petal: i % 2 ? '#F2A23A' : '#F5B83E', petal2: '#E8892A', centre: '#A65A1C', dome: 0.55 });
    head.position.copy(top); head.rotation.z = -0.25; head.rotation.x = 0.1; pv.add(head);
  }
  return g;
}
// ---------------- Chamomile: feathery, fine leaves and many small white daisies with yellow domed centres ----------------
function chamomile(stage) {
  const g = new THREE.Group();
  if (stage === 1) return addTo(g, sprout('#A9CBA6', 0.18));
  const big = stage === 3, H = big ? 0.6 : 0.42, featherM = mat('#8DB37E');
  for (let i = 0; i < (big ? 8 : 6); i++) {   // feathery foliage: thin sprigs with tiny needle leaflets
    const pv = new THREE.Group(); pv.rotation.y = (i / 8) * Math.PI * 2 + Math.random(); pv.rotation.z = 0.5 + Math.random() * 0.5; g.add(pv);
    const len = 0.22 + Math.random() * 0.12; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, len, 4), featherM); st.position.y = len / 2; pv.add(st);
    for (let k = 1; k < 4; k++) for (const sgn of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.07, 3), featherM); l.position.set(sgn * 0.02, len * k / 4, 0); l.rotation.z = sgn * 0.9; pv.add(l); }
  }
  const n = big ? 8 : 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, h = H * (0.75 + Math.random() * 0.4);
    const pv = new THREE.Group(); pv.rotation.y = a; pv.rotation.z = 0.12 + Math.random() * 0.25; g.add(pv);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, h, 4), mat('#7FA46E')); st.position.y = h / 2; pv.add(st);
    if (!big) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#E9E3B0')); b.position.y = h + 0.01; pv.add(b); continue; }
    const head = daisyHead({ r: 0.085, petals: 13, rows: 1, petal: '#FFFDF6', centre: '#F2C33E', dome: 1.0 });
    head.position.y = h; head.rotation.z = -0.15; pv.add(head);
  }
  return g;
}

function addTo(g, c) { g.add(c); return g; }

// ================= v0.5: the full catalog (stylized, low-poly, painterly palette) =================
// Small shared helpers
const rnd = (a, b) => a + Math.random() * (b - a);
function stalk(parent, h, { r = 0.012, color = '#6E9A62', lean = 0.2, a = 0, bend = 0.04, seed = 0 } = {}) {   // a leaning stem; returns [pivot, top point]
  const pv = new THREE.Group(); pv.rotation.y = a; pv.rotation.z = lean; parent.add(pv);
  const { g: sg, curve } = stemGeo(h, r, bend, seed); pv.add(shadowy(new THREE.Mesh(sg, mat(color))));
  return [pv, curve.getPoint(1), curve];
}
function pairLeaves(parent, curve, levels, { len = 0.16, wid = 0.08, color = '#7FB77A', tilt = 0.7, droop = 0.2, from = 0.25 } = {}) {   // opposite leaf pairs up a stem
  const lm = mat(color);
  for (let k = 0; k < levels; k++) { const t = from + (1 - from) * (k / levels), p = curve.getPoint(t), sc = 1 - 0.45 * (k / levels);
    for (const sgn of [0, Math.PI]) { const pv = new THREE.Group(); pv.position.copy(p); pv.rotation.y = sgn + k * Math.PI / 2; const l = shadowy(new THREE.Mesh(leafGeo(len * sc, wid * sc, droop), lm)); l.rotation.x = -tilt; pv.add(l); parent.add(pv); } }
}
function umbel(color, r = 0.12, n = 22, dome = 0.25, size = 0.022) {   // flat-topped flower cluster (yarrow, elder)
  const g = new THREE.Group(); const m = mat(color, { roughness: 0.75 }); const geo = new THREE.IcosahedronGeometry(size, 0);
  for (let i = 0; i < n; i++) { const a = i * 2.39996, d = Math.sqrt(i / n) * r; const b = new THREE.Mesh(geo, m); b.position.set(Math.cos(a) * d, dome * (r * r - d * d) / r, Math.sin(a) * d); g.add(b); }
  return g;
}
const cupGeoCache = new Map();
function cupPetalGeo(len, wid, cup = 0.5) {   // a cupped, rounded petal along +Z, curling up
  const key = [len, wid, cup].join(); if (cupGeoCache.has(key)) return cupGeoCache.get(key);
  const g = new THREE.SphereGeometry(1, 10, 6); g.scale(wid, 0.03, len * 0.5); g.translate(0, 0, len * 0.5);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i) / len, x = p.getX(i) / wid; p.setY(i, p.getY(i) + cup * z * z * len + x * x * 0.25 * wid); }
  g.computeVertexNormals(); cupGeoCache.set(key, g); return g;
}
function roseHead({ r = 0.12, rings = 3, per = 5, color = '#F2A7B8', inner = '#E58B9F', cup = 0.9, open = 0.55, m = null } = {}) {   // layered rose / camellia
  const head = new THREE.Group(); const c0 = new THREE.Color(color), c1 = new THREE.Color(inner);
  for (let ring = 0; ring < rings; ring++) { const k = ring / Math.max(1, rings - 1), len = r * (1.15 - 0.55 * k), n = per + (rings - 1 - ring);
    const pm = m ? m(ring) : mat('#' + c0.clone().lerp(c1, k).getHexString(), { roughness: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < n; i++) { const pv = new THREE.Group(); pv.rotation.y = (i / n) * Math.PI * 2 + ring * 0.7; pv.position.y = ring * r * 0.12;
      const pt = shadowy(new THREE.Mesh(cupPetalGeo(len, len * 0.62, cup), pm)); pt.rotation.x = -(open * (1 - k) + 1.05 * k); pv.add(pt); head.add(pv); } }
  const bud = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 8, 6), m ? m(rings) : mat(inner)); bud.position.y = r * 0.3; bud.scale.y = 1.3; head.add(bud);
  return head;
}
function bud(parent, pos, color, r = 0.04) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(color)); b.scale.y = 1.35; b.position.copy(pos); parent.add(b); return b; }
function needles(parent, curve, n, color, len = 0.07) {   // rosemary-style needle leaves along a stem
  const m = mat(color), geo = new THREE.CylinderGeometry(0.005, 0.009, len, 3);
  for (let i = 0; i < n; i++) { const t = 0.1 + 0.88 * (i / n), p = curve.getPoint(t); const l = new THREE.Mesh(geo, m); l.position.copy(p); l.rotation.set(rnd(-1, 1), i * 2.4, (i % 2 ? 1 : -1) * rnd(0.8, 1.2)); l.translateY(len / 2); parent.add(l); }
}

// ---------------- Epic ----------------
// Peppermint: square-ish upright stems, bright serrated leaf pairs, lilac flower spikes
function peppermint(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#9ED39A', 0.2));
  const big = stage === 3, n = big ? 6 : 4;
  for (let i = 0; i < n; i++) { const h = (big ? 0.62 : 0.42) * rnd(0.8, 1.15);
    const [pv, top, curve] = stalk(g, h, { a: (i / n) * Math.PI * 2 + rnd(0, 0.4), lean: rnd(0.08, 0.3), color: '#5F8E57', r: 0.014, seed: i });
    pairLeaves(pv, curve, big ? 4 : 3, { len: 0.17, wid: 0.09, color: i % 2 ? '#7DC07A' : '#8FCB86', tilt: 0.6, droop: 0.18 });
    if (big) { const sp = new THREE.Mesh(spikeGeo, mat('#C3A6DC', { roughness: 0.7 })); sp.scale.set(0.9, 0.55, 0.9); sp.position.copy(top).add(new THREE.Vector3(0, 0.06, 0)); pv.add(sp); } }
  return g;
}
// Echinacea: tall stems, drooping magenta petals around a spiky copper cone
function echinacea(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#A7C99B'));
  const big = stage === 3, H = big ? 0.8 : 0.55;
  addLeaves(g, 7, { len: 0.36, wid: 0.09, tilt: 0.8, droop: 0.3, color: '#6F9A66' });
  const n = big ? 3 : 2;
  for (let i = 0; i < n; i++) { const [pv, top] = stalk(g, H * rnd(0.85, 1.1), { a: i * 2.1, lean: 0.15 + i * 0.08, r: 0.016, seed: i * 2 });
    if (!big) { bud(pv, top.clone().add(new THREE.Vector3(0, 0.03, 0)), '#B98A5A', 0.05); continue; }
    const head = new THREE.Group(); head.position.copy(top); pv.add(head);
    for (let k = 0; k < 13; k++) { const pp = new THREE.Group(); pp.rotation.y = (k / 13) * Math.PI * 2; const pt = shadowy(new THREE.Mesh(cupPetalGeo(0.15, 0.04, -0.6), mat(k % 2 ? '#D77FB0' : '#E596C0', { roughness: 0.6, side: THREE.DoubleSide }))); pt.rotation.x = 0.35; pp.add(pt); head.add(pp); }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.09, 10, 3), mat('#B5651D', { roughness: 0.95, flatShading: true })); cone.position.y = 0.04; head.add(cone);
    const tipM = mat('#E9A04A'); for (let k = 0; k < 8; k++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.03, 4), tipM); const a = k * 0.8; t.position.set(Math.cos(a) * 0.035, 0.05 + (k % 3) * 0.01, Math.sin(a) * 0.035); head.add(t); } }
  return g;
}
// Lemon Balm: a soft round mound of broad, crinkled, lemon-green leaves with tiny white flowers
function lemonbalm(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#C3DF8C', 0.18));
  const big = stage === 3;
  addLeaves(g, big ? 12 : 8, { len: big ? 0.3 : 0.24, wid: 0.15, tilt: 0.9, droop: 0.32, color: '#A9D27A', jitter: 0.4 });
  addLeaves(g, big ? 9 : 6, { len: 0.24, wid: 0.13, tilt: 0.55, droop: 0.25, color: '#B9DB7C', y: 0.1, phase: 0.4, jitter: 0.4 });
  addLeaves(g, 5, { len: 0.18, wid: 0.11, tilt: 0.25, droop: 0.2, color: '#C8E290', y: 0.2, phase: 0.9, jitter: 0.4 });
  if (big) { const wm = mat('#FFF9F0'); for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), wm); const a = i * 2.4, d = rnd(0.08, 0.2); f.position.set(Math.cos(a) * d, rnd(0.22, 0.32), Math.sin(a) * d); g.add(f); } }
  return g;
}
// ---------------- Legendary ----------------
// Rosemary: upright woody sprigs covered in grey-green needles, pale-blue flowers
function rosemary(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#8FAE95', 0.2));
  const big = stage === 3, n = big ? 7 : 5;
  for (let i = 0; i < n; i++) { const [pv, , curve] = stalk(g, (big ? 0.7 : 0.48) * rnd(0.8, 1.15), { a: (i / n) * Math.PI * 2 + rnd(0, 0.5), lean: rnd(0.05, 0.28), color: '#8A6E52', r: 0.013, seed: i });
    needles(pv, curve, big ? 22 : 15, i % 2 ? '#5E7F72' : '#6E8F86');
    if (big) { const fm = mat('#A9C4E8'); for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.016, 0), fm); f.position.copy(curve.getPoint(0.55 + k * 0.1)).add(new THREE.Vector3(rnd(-0.03, 0.03), 0, rnd(-0.03, 0.03))); pv.add(f); } } }
  return g;
}
// Yarrow: ferny foliage and flat-topped clusters of tiny blush flowers
function yarrow(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#A9CBA6', 0.18));
  const big = stage === 3, featherM = mat('#7FA46E');
  for (let i = 0; i < 7; i++) { const pv = new THREE.Group(); pv.rotation.y = (i / 7) * Math.PI * 2 + Math.random(); pv.rotation.z = 0.6 + Math.random() * 0.4; g.add(pv);
    const len = 0.26; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, len, 4), featherM); st.position.y = len / 2; pv.add(st);
    for (let k = 1; k < 6; k++) for (const sgn of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.06, 3), featherM); l.position.set(sgn * 0.018, len * k / 6, 0); l.rotation.z = sgn * 1.0; pv.add(l); } }
  const n = big ? 4 : 3;
  for (let i = 0; i < n; i++) { const [pv, top] = stalk(g, (big ? 0.72 : 0.5) * rnd(0.85, 1.1), { a: i * 1.9 + 0.3, lean: rnd(0.08, 0.25), r: 0.012, color: '#6F9466', seed: i });
    const u = umbel(big ? (i % 2 ? '#F2BFC6' : '#F7C5C5') : '#C9D6A8', big ? 0.12 : 0.07, big ? 26 : 14); u.position.copy(top); pv.add(u); }
  return g;
}
// Sunflower: a tall thick stalk, broad leaves and one big honey-gold face
function sunflower(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#A7C99B', 0.24));
  const big = stage === 3, H = big ? 1.15 : 0.75;
  const [pv, top, curve] = stalk(g, H, { r: 0.03, lean: 0.04, color: '#6E9A52', bend: 0.03 });
  pairLeaves(pv, curve, big ? 3 : 2, { len: 0.3, wid: 0.2, color: '#7EA65E', tilt: 0.9, droop: 0.4, from: 0.2 });
  if (!big) { const b = bud(pv, top.clone().add(new THREE.Vector3(0, 0.04, 0)), '#93AE5E', 0.08); b.scale.y = 0.9; return g; }
  const head = daisyHead({ r: 0.3, petals: 22, rows: 2, petal: '#F5D07A', petal2: '#EDB93C', centre: '#5A3A1E', dome: 0.35 });
  head.position.copy(top).add(new THREE.Vector3(0.03, 0.02, 0)); head.rotation.z = -1.0; pv.add(head);
  return g;
}
// ---------------- Rare ----------------
// Damask Rose: a small rose shrub with full, fragrant blush blooms
function damaskrose(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#8FB386', 0.2));
  const big = stage === 3, n = big ? 4 : 3;
  addLeaves(g, 8, { len: 0.22, wid: 0.11, tilt: 0.8, droop: 0.25, color: '#5E8A5A' });
  for (let i = 0; i < n; i++) { const [pv, top, curve] = stalk(g, (big ? 0.6 : 0.45) * rnd(0.85, 1.1), { a: (i / n) * Math.PI * 2, lean: rnd(0.15, 0.35), r: 0.015, color: '#5A7A4A', seed: i });
    pairLeaves(pv, curve, 2, { len: 0.13, wid: 0.08, color: '#5E8A5A', tilt: 0.8, droop: 0.2 });
    if (!big) { bud(pv, top, '#E58B9F', 0.045); continue; }
    const h = roseHead({ r: 0.12, rings: 3, per: 5, color: '#F7C5C5', inner: '#E07A93' }); h.position.copy(top); pv.add(h); }
  return g;
}
// Holy Basil (Tulsi): bushy, purple-tinged leaves and slender mauve flower spikes
function tulsi(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#9DBF8E', 0.2));
  const big = stage === 3, n = big ? 6 : 4;
  for (let i = 0; i < n; i++) { const [pv, top, curve] = stalk(g, (big ? 0.55 : 0.4) * rnd(0.85, 1.12), { a: (i / n) * Math.PI * 2 + 0.2, lean: rnd(0.12, 0.35), r: 0.013, color: '#6B5A6E', seed: i });
    pairLeaves(pv, curve, 3, { len: 0.15, wid: 0.09, color: i % 2 ? '#6F8F5E' : '#7E7A8E', tilt: 0.7, droop: 0.22 });
    if (big) { const sp = new THREE.Mesh(spikeGeo, mat('#A884C2', { roughness: 0.7 })); sp.scale.set(0.8, 0.75, 0.8); sp.position.copy(top).add(new THREE.Vector3(0, 0.09, 0)); pv.add(sp); } }
  return g;
}
// Elderflower: a young elder with compound leaves and big lacy cream umbels
function elderflower(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#9CC49A', 0.22));
  const big = stage === 3;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, big ? 0.45 : 0.35, 6), mat('#8E7A62')); trunk.position.y = big ? 0.225 : 0.175; g.add(shadowy(trunk));
  const n = big ? 5 : 4;
  for (let i = 0; i < n; i++) { const [pv, top, curve] = stalk(g, (big ? 0.78 : 0.55) * rnd(0.9, 1.08), { a: (i / n) * Math.PI * 2, lean: rnd(0.3, 0.55), r: 0.014, color: '#7C8A5E', seed: i });
    pairLeaves(pv, curve, 3, { len: 0.16, wid: 0.07, color: '#6F9A62', tilt: 0.9, droop: 0.25, from: 0.4 });
    const u = umbel(big ? '#F6F1DC' : '#D8DDB0', big ? 0.15 : 0.08, big ? 34 : 16, 0.18, big ? 0.02 : 0.018); u.position.copy(top); pv.add(u); }
  return g;
}
// ---------------- Super Rare ----------------
// Saffron Crocus: grassy leaves and lilac goblet flowers with three bright-red threads
const gobletGeo = (() => { const pts = [[0.005, 0], [0.03, 0.02], [0.05, 0.08], [0.06, 0.15], [0.055, 0.2]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 12); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), y = p.getY(i); const f = 1 + 0.2 * Math.max(0, Math.cos(a * 3)) * (y / 0.2); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); p.setY(i, y + 0.02 * Math.cos(a * 6) * (y / 0.2)); }
  g.computeVertexNormals(); return g; })();
function saffron(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#9CC49A', 0.16));
  const big = stage === 3, grassM = mat('#6E9A62');
  for (let i = 0; i < 14; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.36, 3), grassM); l.position.y = 0.16; l.rotation.set(rnd(-0.35, 0.35), 0, rnd(-0.35, 0.35)); l.position.x = rnd(-0.06, 0.06); l.position.z = rnd(-0.06, 0.06); g.add(l); }
  const n = big ? 3 : 2;
  for (let i = 0; i < n; i++) { const a = i * 2.1 + 0.4, x = Math.cos(a) * 0.08, z = Math.sin(a) * 0.08;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.16, 5), mat('#F3EFD9')); st.position.set(x, 0.08, z); g.add(st);
    const cup = shadowy(new THREE.Mesh(gobletGeo, mat(big ? '#B79AE0' : '#C9B7E6', { roughness: 0.55, side: THREE.DoubleSide }))); cup.position.set(x, 0.15, z); if (!big) cup.scale.set(0.55, 1, 0.55); g.add(cup);
    if (big) for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.15, 3), mat('#D2331F', { emissive: '#8A1A0A', emissiveIntensity: 0.3 })); t.position.set(x, 0.29, z); t.rotation.set(Math.cos(k * 2.1) * 0.35, 0, Math.sin(k * 2.1) * 0.35); g.add(t); } }
  return g;
}
// Blue Lotus: round floating pads and a star-shaped sky-blue water lily with a golden heart
function bluelotus(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#8FBF9A', 0.14));
  const big = stage === 3;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), mat('#A9CFDA', { roughness: 0.25, metalness: 0.1 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.012; g.add(water);
  for (const [x, z, r] of [[0.15, 0.08, 0.13], [-0.14, 0.1, 0.11], [0.02, -0.17, 0.12]]) { const pad = new THREE.Mesh(new THREE.CircleGeometry(r, 16, 0.25, Math.PI * 2 - 0.25), mat('#5E8F5A', { side: THREE.DoubleSide })); pad.rotation.x = -Math.PI / 2; pad.position.set(x, 0.02, z); g.add(pad); }
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, big ? 0.32 : 0.2, 5), mat('#6E9A62')); st.position.y = big ? 0.16 : 0.1; g.add(st);
  const top = new THREE.Vector3(0, big ? 0.32 : 0.2, 0);
  if (!big) { const b = bud(g, top, '#8FB8E8', 0.05); b.scale.y = 1.7; return g; }
  const head = new THREE.Group(); head.position.copy(top); g.add(head);
  for (const [row, n, len, tilt, col] of [[0, 10, 0.17, 0.55, '#8FB8E8'], [1, 8, 0.13, 0.95, '#A9C9F0'], [2, 6, 0.09, 1.25, '#C8E0E8']]) for (let i = 0; i < n; i++) {
    const pv = new THREE.Group(); pv.rotation.y = (i / n) * Math.PI * 2 + row * 0.3; pv.position.y = row * 0.012; const pt = shadowy(new THREE.Mesh(petalGeo(len, len * 0.32), mat(col, { roughness: 0.5, side: THREE.DoubleSide, emissive: '#7FA8D8', emissiveIntensity: 0.08 }))); pt.rotation.x = -tilt; pv.add(pt); head.add(pv); }
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 6), mat('#F5D07A', { emissive: '#F5D07A', emissiveIntensity: 0.4 })); c.position.y = 0.04; head.add(c);
  return g;
}
// Jasmine: a twining vine on a cane with small dark leaves, starry white flowers and blush buds
function starFlower(color = '#FFFDF6', r = 0.05) {
  const f = new THREE.Group(); const m = mat(color, { roughness: 0.55, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) { const pv = new THREE.Group(); pv.rotation.y = (i / 5) * Math.PI * 2; const p = new THREE.Mesh(cupPetalGeo(r, r * 0.45, 0.1), m); p.rotation.x = -0.15; pv.add(p); f.add(pv); }
  const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 6, 4), mat('#F5D07A')); f.add(c); return f;
}
function jasmine(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#8FB386', 0.2));
  const big = stage === 3, H = big ? 0.95 : 0.6;
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, H + 0.1, 5), mat('#B89470')); stake.position.y = (H + 0.1) / 2; g.add(stake);
  const curve = new Helix(H, 0.09, big ? 2.4 : 1.6, 0); g.add(shadowy(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 5), mat('#5E7F4E'))));
  const lm = mat('#4F7A4A');
  for (let i = 0; i < (big ? 16 : 10); i++) { const t = 0.08 + 0.9 * (i / (big ? 16 : 10)), p = curve.getPoint(t); const l = shadowy(new THREE.Mesh(leafGeo(0.11, 0.05, 0.1), lm)); l.position.copy(p); l.rotation.set(-0.6, i * 2.2, 0); g.add(l);
    if (big && i % 2) { const f = starFlower('#FFFDF6', 0.05); f.position.copy(p).add(new THREE.Vector3(Math.cos(i) * 0.04, 0.02, Math.sin(i) * 0.04)); f.rotation.set(rnd(-0.5, 0.5), 0, rnd(-0.5, 0.5)); g.add(f); }
    else if (i % 3 === 0) bud(g, p.clone().add(new THREE.Vector3(0.03, 0.02, 0)), '#F7C5C5', 0.018); }
  return g;
}
// ---------------- Ultra Rare ----------------
// Ghost Orchid: no leaves — a tangle of silvery roots on a twig and one pale floating bloom with long curling tails
function ghostorchid(stage) {
  const g = new THREE.Group();
  const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, stage === 1 ? 0.3 : 0.55, 6), mat('#8E7A62')); twig.position.y = stage === 1 ? 0.15 : 0.275; g.add(shadowy(twig));
  const rootM = mat('#A9B9A0', { roughness: 0.8 });
  for (let i = 0; i < (stage === 1 ? 4 : 9); i++) { const a = i * 0.7, y0 = rnd(0.12, stage === 1 ? 0.28 : 0.5);
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, y0, 0), new THREE.Vector3(Math.cos(a) * 0.12, y0 + rnd(-0.08, 0.06), Math.sin(a) * 0.12), new THREE.Vector3(Math.cos(a + 0.6) * 0.2, y0 - rnd(0.05, 0.15), Math.sin(a + 0.6) * 0.2)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 10, 0.008, 4), rootM)); }
  if (stage === 1) return g;
  const spike = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(0.12, 0.6, 0.02), new THREE.Vector3(0.2, 0.78, 0.04)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(spike, 12, 0.006, 4), mat('#8FA586')));
  const top = spike.getPoint(1);
  if (stage === 2) { bud(g, top, '#E8EFE4', 0.035); return g; }
  const white = mat('#F4F7F2', { roughness: 0.45, side: THREE.DoubleSide, emissive: '#E8F4EE', emissiveIntensity: 0.25 });
  const head = new THREE.Group(); head.position.copy(top); head.rotation.z = -0.3; g.add(head);
  for (const [a, len] of [[0, 0.1], [2.2, 0.1], [4.1, 0.09], [1.1, 0.07], [5.2, 0.07]]) { const pv = new THREE.Group(); pv.rotation.y = a; const p = new THREE.Mesh(cupPetalGeo(len, 0.018, 0.4), white); p.rotation.x = -0.9; pv.add(p); head.add(pv); }
  const lip = new THREE.Mesh(cupPetalGeo(0.1, 0.06, -0.3), white); lip.rotation.x = 0.5; head.add(lip);
  for (const sgn of [-1, 1]) { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(sgn * 0.02, -0.01, 0.05), new THREE.Vector3(sgn * 0.08, -0.12, 0.08), new THREE.Vector3(sgn * 0.04, -0.26, 0.02), new THREE.Vector3(sgn * 0.1, -0.34, 0.06)]);
    head.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.006, 4), white)); }
  return g;
}
// Jade Vine: a little arch trellis dripping with a cascade of luminous jade-turquoise claw flowers
function jadevine(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#8FBF9A', 0.22));
  const big = stage === 3, H = big ? 0.9 : 0.65, woodM = mat('#9C7A58');
  for (const x of [-0.2, 0.2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, H, 5), woodM); p.position.set(x, H / 2, 0); g.add(shadowy(p)); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 5), woodM); bar.rotation.z = Math.PI / 2; bar.position.y = H; g.add(bar);
  const vine = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.2, 0.05, 0.02), new THREE.Vector3(-0.17, H * 0.6, 0.03), new THREE.Vector3(0, H + 0.03, 0.02), new THREE.Vector3(0.17, H * 0.7, 0.03), new THREE.Vector3(0.2, 0.2, 0.02)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(vine, 30, 0.012, 5), mat('#5E7F4E')));
  const lm = mat('#5F8F5A'); for (let i = 0; i < 9; i++) { const p = vine.getPoint(i / 9); const l = shadowy(new THREE.Mesh(leafGeo(0.13, 0.05, 0.2), lm)); l.position.copy(p); l.rotation.set(-0.4, i * 1.7, 0); g.add(l); }
  const jade = mat('#5FD3B8', { roughness: 0.4, emissive: '#2FB89A', emissiveIntensity: big ? 0.25 : 0.1 }), jade2 = mat('#8FE3CC', { roughness: 0.4, emissive: '#2FB89A', emissiveIntensity: 0.15 });
  const claw = new THREE.ConeGeometry(0.02, 0.09, 5); claw.translate(0, -0.045, 0);
  for (const x of big ? [-0.09, 0.04, 0.13] : [0]) { const len = big ? 0.42 : 0.18, n = big ? 12 : 5;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, len, 3), mat('#6E5A4A')); stem.position.set(x, H - len / 2, 0.02); g.add(stem);
    for (let k = 0; k < n; k++) { const y = H - 0.04 - (k / n) * len; for (let j = 0; j < 3; j++) { const c = new THREE.Mesh(claw, k % 2 ? jade : jade2); const a = j * 2.1 + k * 0.6; c.position.set(x + Math.cos(a) * 0.025, y, 0.02 + Math.sin(a) * 0.025); c.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9 + Math.PI); g.add(c); } } }
  return g;
}
// Middlemist Red: a glossy dark camellia shrub with lush, fully double rose-pink blooms
function middlemist(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#5E8A5A', 0.2));
  const big = stage === 3, gloss = mat('#2F5A3A', { roughness: 0.3 });
  const body = new THREE.Group(); g.add(body);
  for (let i = 0; i < (big ? 22 : 14); i++) { const a = i * 2.4, d = rnd(0.05, 0.22), y = rnd(0.12, big ? 0.62 : 0.45); const l = shadowy(new THREE.Mesh(leafGeo(0.14, 0.07, 0.08), gloss)); l.position.set(Math.cos(a) * d, y, Math.sin(a) * d); l.rotation.set(rnd(-0.6, 0.2), a, 0); body.add(l); }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 5), mat('#6E5A4A')); trunk.position.y = 0.15; g.add(trunk);
  for (let i = 0; i < (big ? 3 : 2); i++) { const a = i * 2.2 + 0.5, p = new THREE.Vector3(Math.cos(a) * 0.13, big ? 0.58 + i * 0.04 : 0.45, Math.sin(a) * 0.13);
    if (!big) { bud(g, p, '#C94A66', 0.045); continue; }
    const h = roseHead({ r: 0.11, rings: 4, per: 6, color: '#E0607A', inner: '#F2A7B8', cup: 0.3, open: 0.25 }); h.position.copy(p); h.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(h); }
  return g;
}
// ---------------- Other World ----------------
// Crystal Rose: a rose of translucent, faceted crystal petals on a silvery stem
function crystalrose(stage) {
  const g = new THREE.Group(); if (stage === 1) return addTo(g, sprout('#B9D6E0', 0.2));
  const big = stage === 3, H = big ? 0.7 : 0.5;
  const crystal = (k) => mat(['#C9D6F5', '#DCE6FA', '#EEF3FF', '#F7C5C5', '#FFFFFF'][k % 5], { roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.82, flatShading: true, emissive: '#9FB4F0', emissiveIntensity: 0.35, side: THREE.DoubleSide });
  const [pv, top, curve] = stalk(g, H, { r: 0.014, color: '#9FB0A8', lean: 0.08 });
  for (let i = 0; i < 4; i++) { const p = curve.getPoint(0.25 + i * 0.15); const l = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), crystal(i)); l.scale.set(0.5, 0.15, 1.4); l.position.copy(p); l.rotation.y = i * 2.2; l.translateZ(0.06); pv.add(l); }
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), crystal(i)); c.scale.set(0.5, 1.6, 0.5); c.position.set(Math.cos(i * 1.3) * 0.16, 0.05, Math.sin(i * 1.3) * 0.16); c.rotation.z = rnd(-0.4, 0.4); g.add(c); }
  if (!big) { const b = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), crystal(0)); b.scale.y = 1.5; b.position.copy(top); pv.add(b); return g; }
  const h = roseHead({ r: 0.14, rings: 3, per: 5, cup: 0.6, open: 0.5, m: crystal }); h.position.copy(top); pv.add(h);
  return g;
}

// Other World tier gets the strongest glow: brighter halo, more motes (Moonflower keeps its own motes).
function addMotes(g, color, n = 12, spread = 0.8, y0 = 0.4) {
  const mg = new THREE.BufferGeometry(); const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = (Math.random() - 0.5) * spread; arr[i * 3 + 1] = y0 + Math.random() * 0.8; arr[i * 3 + 2] = (Math.random() - 0.5) * spread; }
  mg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.09, map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.userData.motes = true; g.add(motes); return motes;
}

const SEED_COLORS = { lavender: '#8C7A5E', calendula: '#B08A4E', chamomile: '#D8CFA8', heartvine: '#E9A7A0', sunpetal: '#E3B44E', moonflower: '#EDE9DD',
  peppermint: '#6E5A44', echinacea: '#7A5A3A', lemonbalm: '#5E4A36', rosemary: '#8A7050', yarrow: '#B8A88A', sunflower: '#4A4038', damaskrose: '#C98A6A', tulsi: '#3E3428',
  elderflower: '#5A3A44', saffron: '#C9A07A', bluelotus: '#6E7A5A', jasmine: '#7A6A4E', ghostorchid: '#D8D2BE', jadevine: '#7A8A6A', middlemist: '#8E5A3A', crystalrose: '#C9D6F5' };
// One builder per species id. v0.5: all 21 catalog plants (Heartvine stays for the disabled fantasy card).
const BUILDERS = { lavender, calendula, chamomile, heartvine, sunpetal, moonflower, peppermint, echinacea, lemonbalm, rosemary, yarrow, sunflower,
  damaskrose, tulsi, elderflower, saffron, bluelotus, jasmine, ghostorchid, jadevine, middlemist, crystalrose };
export const PLANT_BUILDERS = Object.keys(BUILDERS);
// Glow by tier (data.js PLANT_TIERS[].glow): 0 none · 1 soft halo (Rare, Super Rare) · 2 shimmer (Ultra Rare) · 3 Other World: brightest halo + motes
const GLOW = { 1: { size: 0.9, op: 0.22 }, 2: { size: 1.2, op: 0.32 }, 3: { size: 1.6, op: 0.5 } };
export function buildPlant(species, stage) {
  let g;
  if (stage === 0) g = seedMound(SEED_COLORS[species] || '#B08A4E');
  else g = (BUILDERS[species] || lavender)(stage);
  const sp = SPECIES[species], lvl = sp ? PLANT_TIERS[sp.tier]?.glow || 0 : 0;
  if (lvl && stage >= 2) {
    const G = GLOW[lvl], k = stage === 2 ? 0.55 : 1, col = new THREE.Color(sp.color).lerp(new THREE.Color('#FFF9F0'), 0.35);
    const halo = glowSprite('#' + col.getHexString(), G.size * (stage === 2 ? 0.75 : 1), G.op * k); halo.position.y = stage === 2 ? 0.4 : 0.55; g.add(halo);
    if (lvl === 3) { const core = glowSprite('#FFF6E0', 0.7, 0.45 * k); core.position.y = stage === 2 ? 0.45 : 0.7; g.add(core);
      if (stage === 3 && species !== 'moonflower') addMotes(g, '#' + col.getHexString(), 14); }
    if (lvl === 2 && stage === 3) addMotes(g, '#F4F7F2', 6, 0.6, 0.45);
    g.userData.glowing = true; g.userData.glowLevel = lvl;
  }
  g.userData.phase = Math.random() * 10;
  return g;
}
