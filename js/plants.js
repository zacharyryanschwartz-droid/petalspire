// Procedural low-poly plant meshes for Petalspire
import * as THREE from 'three';

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

function addTo(g, c) { g.add(c); return g; }

const SEED_COLORS = { heartvine: '#E9A7A0', sunpetal: '#E3B44E', moonflower: '#EDE9DD' };
export function buildPlant(species, stage) {
  let g;
  if (stage === 0) g = seedMound(SEED_COLORS[species]);
  else if (species === 'moonflower') g = moonflower(stage);
  else if (species === 'sunpetal') g = sunpetal(stage);
  else g = heartvine(stage);
  g.userData.phase = Math.random() * 10;
  return g;
}
