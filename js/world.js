// Petalspire v0.4: scene, environment, lots & woods, raised beds, roadside buildings, cars, effects
import * as THREE from 'three';
import { mat, glowSprite, glowTexture } from './plants.js';
import { TILE, BED_N, ROAD, SPOTS, PARK_X, LOTS, LOT_FOR_SALE, ORCH_FOR_SALE, SIGNS, SITES, OBSTACLES, siteById, ORCHARD_TREE_SPOTS, ORCH_X, ORCH_Z } from './layout.js';
import { FIND_COLORS, TREES } from './data.js';
import { drawBillboard } from './billboard.js';

const shadowy = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const elastic = (k) => (k >= 1 ? 1 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2));
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function textSprite(text, { font = '600 64px Fraunces, serif', color = '#3D5A40', bg = 'rgba(255,249,240,.92)', border = '#B7D4B5', h = 0.5 } = {}) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  g.font = font; const w = Math.ceil(g.measureText(text).width) + 70; c.width = w; c.height = 110;
  g.font = font;
  g.fillStyle = bg; g.strokeStyle = border; g.lineWidth = 6;
  const r = 44; g.beginPath(); g.roundRect(4, 4, w - 8, 102, r); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(247,197,197,.8)'; g.lineWidth = 2.5; g.beginPath(); g.roundRect(13, 13, w - 26, 84, r - 9); g.stroke();
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 58);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(h * w / 110, h, 1); s.renderOrder = 5; s.userData.text = text; s.userData.h = h;
  return s;
}
function iconTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.shadowColor = 'rgba(60,40,20,.25)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.fillStyle = '#FFF9F0'; g.beginPath(); g.arc(64, 60, 46, 0, Math.PI * 2); g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 6; g.strokeStyle = kind === 'water' ? '#8EC0D0' : '#E9C46A'; g.stroke();
  g.beginPath(); g.moveTo(52, 102); g.lineTo(64, 116); g.lineTo(76, 102); g.fillStyle = '#FFF9F0'; g.fill();
  if (kind === 'water') {
    g.beginPath(); g.moveTo(64, 28); g.bezierCurveTo(52, 46, 42, 56, 42, 68); g.arc(64, 68, 22, Math.PI, 0, true); g.bezierCurveTo(86, 56, 76, 46, 64, 28);
    g.fillStyle = '#A8D2E0'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#5E97AA'; g.stroke();
    g.beginPath(); g.arc(57, 70, 9, Math.PI * 0.6, Math.PI * 1.1); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
  } else {
    const star = (cx, cy, R, r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2; const rr = i % 2 ? r : R; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); };
    star(64, 60, 32, 10); g.fillStyle = '#F5D07A'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = '#C9952E'; g.stroke();
    star(90, 36, 10, 3.5); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function roundedBox(w, h, d, r) {
  const s = new THREE.Shape(); const x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r, q = Math.min(W, H) * 0.35;
  s.moveTo(x + q, y); s.lineTo(x + W - q, y); s.quadraticCurveTo(x + W, y, x + W, y + q); s.lineTo(x + W, y + H - q); s.quadraticCurveTo(x + W, y + H, x + W - q, y + H);
  s.lineTo(x + q, y + H); s.quadraticCurveTo(x, y + H, x, y + H - q); s.lineTo(x, y + q); s.quadraticCurveTo(x, y, x + q, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 3, curveSegments: 6 });
  g.center(); g.computeVertexNormals(); return g;
}

export function createWorld(canvas) {
  const labels = [];
  function label(text, opts = {}) { const s = textSprite(text, opts); s.userData.opts = opts; s.userData.text = text; labels.push(s); return s; }
  function setLabel(s, text, opts = s.userData.opts) { if (s.userData.text === text && opts === s.userData.opts) return; const f = textSprite(text, opts); s.material.map?.dispose(); s.material.map = f.material.map; s.material.needsUpdate = true; s.scale.copy(f.scale); s.userData.text = text; s.userData.opts = opts; }
  function relabel() { for (const s of labels) { const t = s.userData.text; s.userData.text = null; setLabel(s, t, s.userData.opts); } }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // v0.63 (iOS crash fix): iPhone Safari kills the tab when GPU memory runs out. Cap the drawing buffer harder on iOS
  // (1.5× instead of the 3× screen; 2× elsewhere) and use a smaller shadow map there.
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const PR_CAP = IOS ? 1.5 : 2;
  let paused = false, pausedFrames = 0;   // v0.63: see setPaused()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PR_CAP));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const HORIZON = new THREE.Color('#F6D9B6');
  scene.fog = new THREE.Fog(HORIZON, 34, 85);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
  const frameHooks = [];

  // ---------- Sky ----------
  const sunDir = new THREE.Vector3(-0.75, 0.32, -0.58).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#BFDCE6') }, mid: { value: new THREE.Color('#F4E6D2') }, hor: { value: HORIZON }, sun: { value: sunDir }, sunCol: { value: new THREE.Color('#FFD08A') } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top, mid, hor, sun, sunCol; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.15, 0.7, h));
        float s = max(dot(normalize(vP), sun), 0.0); c += sunCol * (pow(s, 6.0) * 0.35 + pow(s, 120.0) * 0.9);
        gl_FragColor = vec4(c, 1.0);
#include <colorspace_fragment>
      }`,
  })); scene.add(sky);   // v0.6: the sky dome follows the camera (Home and the Orchard are far apart)

  // ---------- Lights ----------
  scene.add(new THREE.HemisphereLight('#D3E6EC', '#B9C99A', 0.95));
  const sun = new THREE.DirectionalLight('#FFC27A', 3.3);
  sun.position.copy(sunDir).multiplyScalar(26).setY(14);
  sun.castShadow = true; sun.shadow.mapSize.set(IOS ? 1024 : 2048, IOS ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#F7C5C5', 0.35); fill.position.set(8, 5, 8); scene.add(fill);

  // ---------- Ground (flat building area, road, rolling hills beyond) ----------
  // v0.6: the flat area reaches back to z ≈ −31 behind the middle plots for the Orchard (smoothly back to −21 at the sides)
  function flatBack(x) { return 21 + 10 * (1 - THREE.MathUtils.smoothstep(Math.abs(x), 6, 13)); }
  const gg = new THREE.PlaneGeometry(200, 200, 140, 140); gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position; const cols = new Float32Array(gp.count * 3);
  const cNear = new THREE.Color('#ADCB98'), cPatch = new THREE.Color('#C9D9A4'), cFar = new THREE.Color('#93B585'), cWarm = new THREE.Color('#E2D08E'), cWood = new THREE.Color('#9DB884');
  const tmp = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    const ox = Math.max(0, Math.abs(x) - 17), oz = Math.max(0, z > 0 ? z - 14 : -z - flatBack(x));
    const out = Math.hypot(ox, oz), hill = THREE.MathUtils.smoothstep(out, 0, 18);
    const nearRoad = z > ROAD.z0 - 0.6 && z < ROAD.z1 + 0.6;
    const y = nearRoad ? -0.03 : (noise(x * 0.07, z * 0.07) * 6 + noise(x * 0.2, z * 0.2) * 1.4) * hill + noise(x * 0.6, z * 0.6) * 0.05;
    gp.setY(i, y - 0.02);
    const inWoods = x > -14 && x < 14 && z > -18 && z < 4.6;
    tmp.copy(cNear).lerp(cPatch, noise(x * 0.35 + 9, z * 0.35) * 0.8).lerp(cFar, hill * 0.7).lerp(cWarm, noise(x * 0.12, z * 0.12 + 3) * 0.25);
    if (inWoods) tmp.lerp(cWood, 0.25);
    cols.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  gg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); gg.computeVertexNormals();
  const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ground.receiveShadow = true; ground.userData.kind = 'ground'; scene.add(ground);

  // road
  const roadW = ROAD.z1 - ROAD.z0, roadZ = (ROAD.z0 + ROAD.z1) / 2;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(200, roadW), mat('#C9B9A0', { roughness: 1 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.0, roadZ); road.receiveShadow = true; scene.add(road);
  for (const z of [ROAD.z0 - 0.12, ROAD.z1 + 0.12]) { const v = new THREE.Mesh(new THREE.PlaneGeometry(200, 0.34), mat('#D9C9A4', { roughness: 1 })); v.rotation.x = -Math.PI / 2; v.position.set(0, 0.006, z); v.receiveShadow = true; scene.add(v); }
  { const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 0.12), mat('#F5E6B8', { roughness: 1 }), 70); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    for (let i = 0; i < 70; i++) { m4.compose(new THREE.Vector3(-70 + i * 2.0, 0.01, roadZ), q, new THREE.Vector3(1, 1, 1)); dash.setMatrixAt(i, m4); } dash.receiveShadow = true; scene.add(dash); }

  const rnd = mulberry(7);
  const decor = new THREE.Group(); scene.add(decor);
  const woodM = mat('#B07D52'), woodL = mat('#C99A6B'), woodD = mat('#8E6040'), trunkM = mat('#8E6A4E');

  // split-rail fence across the road
  { const postG = new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6), railG = new THREE.BoxGeometry(2.05, 0.07, 0.06);
    const posts = new THREE.InstancedMesh(postG, woodD, 40), rails = new THREE.InstancedMesh(railG, woodL, 80); const m4 = new THREE.Matrix4(); let r = 0;
    for (let i = 0; i < 40; i++) { const x = -40 + i * 2; m4.makeTranslation(x, 0.45, ROAD.z1 + 0.9); posts.setMatrixAt(i, m4); for (const y of [0.4, 0.72]) { m4.makeTranslation(x + 1, y, ROAD.z1 + 0.9); rails.setMatrixAt(r++, m4); } }
    posts.castShadow = rails.castShadow = true; decor.add(posts, rails); }

  // ---------- Trees & shared geometry ----------
  const canopyGeo = new THREE.SphereGeometry(1, 16, 11);
  { const p = canopyGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const k = 1 + (noise(v.x * 2 + 5, v.z * 2 + v.y * 2) - 0.5) * 0.35; p.setXYZ(i, v.x * k, v.y * k * 0.9, v.z * k); } canopyGeo.computeVertexNormals(); }
  const treeCols = ['#8FB487', '#A3C49A', '#7FA47D', '#F4C3C3', '#B7D4B5', '#9DBF8F', '#8FB487', '#A9C78E'];
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1.6, 7); trunkGeo.translate(0, 0.8, 0);
  function makeTree(sc, colIdx, r, layers = 3) {
    const t = new THREE.Group();
    const tr = shadowy(new THREE.Mesh(trunkGeo, trunkM)); tr.scale.setScalar(sc); t.add(tr);
    const cm = mat(treeCols[colIdx % treeCols.length]);
    for (let k = 0; k < layers; k++) {
      const c = shadowy(new THREE.Mesh(canopyGeo, cm)); const s = sc * (0.95 - k * 0.18);
      c.scale.setScalar(s); c.position.set((r() - 0.5) * 0.6 * sc, (1.85 + k * 0.72) * sc, (r() - 0.5) * 0.6 * sc); t.add(c);
    }
    t.userData.leaf = treeCols[colIdx % treeCols.length];
    return t;
  }
  const stumpGeo = new THREE.CylinderGeometry(0.24, 0.3, 0.32, 9); stumpGeo.translate(0, 0.16, 0);
  const ringGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 9); const rootGeo = new THREE.ConeGeometry(0.08, 0.36, 5);
  function makeStump(sc = 1) {
    const g = new THREE.Group();
    g.add(shadowy(new THREE.Mesh(stumpGeo, trunkM)));
    const top = new THREE.Mesh(ringGeo, mat('#DDBB8C')); top.position.y = 0.33; g.add(top);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 4, 14), mat('#B48A5E')); ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.345; g.add(ring2);
    for (let k = 0; k < 4; k++) { const rt = shadowy(new THREE.Mesh(rootGeo, trunkM)); const a = k * 1.6 + 0.3; rt.position.set(Math.cos(a) * 0.27, 0.05, Math.sin(a) * 0.27); rt.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); g.add(rt); }
    g.scale.setScalar(sc); return g;
  }
  const bushM = [mat('#8DB486'), mat('#A7C99B'), mat('#7FA47D')];
  function makeBush(sc, r) {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) { const b = shadowy(new THREE.Mesh(canopyGeo, bushM[k % 3])); const s = sc * (0.42 - k * 0.07); b.scale.set(s * 1.2, s * 0.9, s * 1.2); b.position.set((r() - 0.5) * 0.5 * sc, s * 0.7, (r() - 0.5) * 0.5 * sc); g.add(b); }
    if (r() < 0.6) for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(['#F7C5C5', '#FFF9F0', '#F5D07A'][k % 3])); f.position.set((r() - 0.5) * 0.7 * sc, 0.45 * sc + r() * 0.15, (r() - 0.5) * 0.7 * sc); g.add(f); }
    g.userData.leaf = '#A7C99B'; return g;
  }
  const rockGeo = new THREE.DodecahedronGeometry(0.4, 1);
  { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const k = 1 + (noise(v.x * 3 + 2, v.z * 3 + v.y * 3) - 0.5) * 0.35; p.setXYZ(i, v.x * k, v.y * k * 0.65, v.z * k); } rockGeo.computeVertexNormals(); }
  function makeRock(sc, r) {
    const g = new THREE.Group();
    const a = shadowy(new THREE.Mesh(rockGeo, mat('#D8CFC0'))); a.scale.setScalar(sc); a.position.y = 0.15 * sc; a.rotation.y = r() * 3; g.add(a);
    const b = shadowy(new THREE.Mesh(rockGeo, mat('#C7BEAF'))); b.scale.setScalar(sc * 0.5); b.position.set(0.35 * sc, 0.08, 0.2 * sc); g.add(b);
    const moss = new THREE.Mesh(rockGeo, mat('#9DBF8F')); moss.scale.set(sc * 0.55, sc * 0.3, sc * 0.55); moss.position.set(-0.05 * sc, 0.33 * sc, 0); g.add(moss);
    g.userData.leaf = '#D8CFC0'; return g;
  }

  // ---------- Obstacles (interactive woods) ----------
  const woods = new THREE.Group(); scene.add(woods);
  const obs = new Map(); // id -> { def, group, stump, state }
  for (const def of OBSTACLES) {
    const r = mulberry(def.k);
    const o = { def, group: null, stump: null, state: def.type === 'stump' ? 'stump' : 'full' };
    if (def.type === 'tree') o.group = makeTree(def.s, Math.floor(r() * 99), r, def.lot === 'home' ? 3 : 2);
    else if (def.type === 'bush') o.group = makeBush(def.s * 1.1, r);
    else if (def.type === 'rock') o.group = makeRock(def.s, r);
    if (o.group) { o.group.position.set(def.x, 0, def.z); o.group.rotation.y = r() * 6.28; o.group.userData.kind = 'obstacle'; o.group.userData.id = def.id; woods.add(o.group); }
    if (def.type === 'tree' || def.type === 'stump') {
      o.stump = makeStump(def.type === 'stump' ? def.s : def.s * 0.95); o.stump.position.set(def.x, 0, def.z); o.stump.rotation.y = r() * 6;
      o.stump.userData.kind = 'obstacle'; o.stump.userData.id = def.id; o.stump.visible = def.type === 'stump'; woods.add(o.stump);
    }
    obs.set(def.id, o);
  }
  function setObstacle(id, state) { // 'full' | 'stump' | 'gone'
    const o = obs.get(id); if (!o) return; o.state = state;
    if (o.group) { o.group.visible = state === 'full'; o.group.quaternion.identity(); o.group.rotation.y = hash(o.def.x, o.def.z) * 6.28; o.group.scale.setScalar(1); }
    if (o.stump) { o.stump.visible = state === 'stump'; o.stump.scale.setScalar(o.def.type === 'stump' ? o.def.s : o.def.s * 0.95); }
  }

  // ---------- Background trees (not interactive) ----------
  const bgTrees = [];   // v0.31: positions feed the shade model
  for (let i = 0; i < 46; i++) {
    let x, z;
    const side = i % 4;
    if (side === 0) { x = -40 + rnd() * 80; z = ROAD.z1 + 4 + rnd() * 16; }
    else if (side === 1) { x = -16 - rnd() * 16; z = -24 + rnd() * 28; }
    else if (side === 2) { x = 16 + rnd() * 16; z = -24 + rnd() * 28; }
    else { x = -30 + rnd() * 60; z = -20 - rnd() * 14; if (Math.abs(x) < 7.5 && z > -31) z = -31.5 - rnd() * 4; }   // v0.6: keep the Orchard clear
    const bs = 1.0 + rnd() * 0.8; const t = makeTree(bs, Math.floor(rnd() * 8), rnd, 2); t.position.set(x, 0, z); bgTrees.push({ x, z, s: bs });
    const yy = (noise(x * 0.07, z * 0.07) * 6) * THREE.MathUtils.smoothstep(Math.hypot(Math.max(0, Math.abs(x) - 17), Math.max(0, z > 0 ? z - 14 : -z - flatBack(x))), 0, 18);
    t.position.y = yy - 0.1; decor.add(t);
  }

  // ---------- Grass & meadow flowers ----------
  const blocked = (x, z) => (z > ROAD.z0 - 0.4 && z < ROAD.z1 + 0.5) || SITES.some((s) => Math.abs(x - s.x) < 2.05 && Math.abs(z - s.z) < 2.05) || (z > 2.5 && z < 4.6 && x > -4.6 && x < 4.7);
  const fGeo = new THREE.IcosahedronGeometry(0.07, 0);
  ['#F7C5C5', '#FFF9F0', '#F5D07A', '#F2AEB3', '#E9D7F0'].forEach((col) => {
    const N = 90; const im = new THREE.InstancedMesh(fGeo, mat(col, { roughness: 0.6 }), N); const m4 = new THREE.Matrix4(); let n = 0;
    for (let i = 0; i < N; i++) { const x = -22 + rnd() * 44, z = rnd() < 0.55 ? ROAD.z1 + 1.2 + rnd() * 8 : -18 + rnd() * 22.5; if (blocked(x, z)) continue; m4.makeTranslation(x, 0.12 + rnd() * 0.08, z); im.setMatrixAt(n++, m4); }
    im.count = n; decor.add(im);
  });
  const gGeo = new THREE.ConeGeometry(0.05, 0.3, 4); gGeo.translate(0, 0.15, 0);
  { const N = 1100; const grass = new THREE.InstancedMesh(gGeo, mat('#8DB486'), N); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(); let n = 0;
    for (let i = 0; i < N; i++) { const x = -24 + rnd() * 48, z = -20 + rnd() * 38; if (blocked(x, z)) continue;
      e.set((rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.5); q.setFromEuler(e); const s = 0.6 + rnd() * 0.9; sc.set(s, s, s);
      m4.compose(new THREE.Vector3(x, 0, z), q, sc); grass.setMatrixAt(n++, m4); } grass.count = n; decor.add(grass); }

  // mailbox + lanterns by the road
  { const mb = new THREE.Group(); mb.position.set(-1.9, 0, 4.75);
    const p = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), woodD)); p.position.y = 0.5; mb.add(p);
    const box = shadowy(new THREE.Mesh(roundedBox(0.5, 0.3, 0.3, 0.08), mat('#B7D4B5'))); box.position.y = 1.08; mb.add(box);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.12), mat('#E58F94')); flag.position.set(0.12, 1.25, 0.17); mb.add(flag);
    decor.add(mb); }
  const glows = [];
  function lantern(x, z, parent = decor) {
    const p = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6), woodD)); p.position.set(x, 0.8, z); parent.add(p);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.04), woodD); hook.position.set(x + 0.12, 1.58, z); parent.add(hook);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat('#FFE1A0', { emissive: '#FFC861', emissiveIntensity: 1.5 })); l.position.set(x + 0.24, 1.42, z); parent.add(l);
    const gl = glowSprite('#FFCF7A', 1.2, 0.55); gl.position.copy(l.position); parent.add(gl); glows.push(gl);
  }
  lantern(-4.45, 4.55); lantern(4.35, 4.55);

  // ---------- Lot borders, tint and For Sale signs ----------
  const lotFx = {}; let orchFenceG = null; const orchOwned = new Set(['orchard']);   // v0.66.1: bought Orchard land, for the fence
  const stakeG = new THREE.CylinderGeometry(0.035, 0.045, 0.55, 5); stakeG.translate(0, 0.27, 0);
  const ropeG = new THREE.CylinderGeometry(0.014, 0.014, 1, 4); ropeG.rotateZ(Math.PI / 2);
  function signTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 150; const g = c.getContext('2d');
    g.fillStyle = '#FFF6E6'; g.beginPath(); g.roundRect(4, 4, 248, 142, 22); g.fill();
    g.strokeStyle = '#D9A93F'; g.lineWidth = 7; g.stroke();
    g.strokeStyle = 'rgba(247,197,197,.9)'; g.lineWidth = 3; g.beginPath(); g.roundRect(16, 16, 224, 118, 14); g.stroke();
    g.fillStyle = '#3D5A40'; g.textAlign = 'center'; g.font = '700 50px Fraunces, serif'; g.fillText('For Sale', 128, 74);
    g.font = '700 24px Nunito, sans-serif'; g.fillStyle = '#8A6418'; g.fillText('tap to view plot', 128, 112);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.9 });
  for (const id of [...LOT_FOR_SALE, ...ORCH_FOR_SALE]) {
    const l = LOTS[id]; const fx = new THREE.Group(); scene.add(fx);
    const tint = new THREE.Mesh(new THREE.PlaneGeometry(l.x1 - l.x0 - 0.1, l.z1 - l.z0 - 0.1), new THREE.MeshBasicMaterial({ color: '#4E6A49', transparent: true, opacity: 0.13, depthWrite: false }));
    tint.rotation.x = -Math.PI / 2; tint.position.set((l.x0 + l.x1) / 2, 0.07, (l.z0 + l.z1) / 2); tint.renderOrder = 1; fx.add(tint);
    const ins = 0.22, pts = [[l.x0 + ins, l.z0 + ins], [l.x1 - ins, l.z0 + ins], [l.x1 - ins, l.z1 - ins], [l.x0 + ins, l.z1 - ins]];
    const stakes = [], ropes = [];
    for (let e = 0; e < 4; e++) {
      const [ax, az] = pts[e], [bx, bz] = pts[(e + 1) % 4]; const len = Math.hypot(bx - ax, bz - az); const n = Math.max(2, Math.round(len / 1.6));
      for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
        stakes.push([x0, z0]); ropes.push([(x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0), Math.atan2(-(z1 - z0), x1 - x0)]); }
    }
    const sm = new THREE.InstancedMesh(stakeG, woodD, stakes.length), rm = new THREE.InstancedMesh(ropeG, mat('#EAD9B5'), ropes.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    stakes.forEach(([x, z], k) => { m4.makeTranslation(x, 0, z); sm.setMatrixAt(k, m4); });
    ropes.forEach(([x, z, len, a], k) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); m4.compose(new THREE.Vector3(x, 0.46, z), q, new THREE.Vector3(len, 1, 1)); rm.setMatrixAt(k, m4); });
    sm.castShadow = true; fx.add(sm, rm);
    const [sx, sz] = SIGNS[id]; const sign = new THREE.Group(); sign.position.set(sx, 0, sz); sign.rotation.y = Math.atan2(-(sx > 150 ? sx - ORCH_X : sx), 14) * 0.6;
    for (const px of [-0.42, 0.42]) { const p = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.25, 6), woodD)); p.position.set(px, 0.62, 0); sign.add(p); }
    const board = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.66, 0.06), woodL)); board.position.y = 1.0; sign.add(board);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.6), signMat); face.position.set(0, 1.0, 0.035); sign.add(face);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.8; sign.add(hit);
    sign.userData = { kind: 'lot', id }; fx.add(sign);
    // v0.3: a floating tag that always draws on top, so the sign can't hide behind the home trees
    const tag = label('For Sale', { h: 0.48, color: '#3D5A40', border: '#D9A93F' }); tag.material.depthTest = false; tag.renderOrder = 12;
    tag.position.set(sx, 2.75, sz); tag.userData.kind = 'lot'; tag.userData.id = id; tag.userData.tag = true; fx.add(tag);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 4), new THREE.MeshBasicMaterial({ color: '#D9A93F', transparent: true, opacity: 0.55, depthWrite: false })); stalk.position.set(sx, 1.98, sz); fx.add(stalk);
    lotFx[id] = { fx, sign, tag };
  }

  // ---------- v0.6: The Orchard — its own place on the Map, far east of Home (so it reads as a separate scene) ----------
  const orchardScene = new THREE.Group(); scene.add(orchardScene);
  {
    const og = new THREE.PlaneGeometry(170, 170, 90, 90); og.rotateX(-Math.PI / 2);
    const op = og.attributes.position, oc = new Float32Array(op.count * 3), c0 = new THREE.Color('#A9CC8E'), c1 = new THREE.Color('#C4DA98'), c2 = new THREE.Color('#8FB37F'), cw = new THREE.Color('#E2D08E'), t = new THREE.Color();
    for (let i = 0; i < op.count; i++) {
      const x = op.getX(i), z = op.getZ(i), wx = x + ORCH_X, wz = z + ORCH_Z;
      const out = Math.hypot(Math.max(0, Math.abs(x) - 24), z > 0 ? Math.max(0, z - 15) : Math.max(0, -z - 26)), hill = THREE.MathUtils.smoothstep(out, 0, 22);
      op.setY(i, (noise(wx * 0.06, wz * 0.06) * 7 + noise(wx * 0.2, wz * 0.2) * 1.2) * hill + noise(wx * 0.6, wz * 0.6) * 0.04 - 0.02);
      t.copy(c0).lerp(c1, noise(wx * 0.3, wz * 0.3 + 4) * 0.9).lerp(c2, hill * 0.75).lerp(cw, noise(wx * 0.1 + 2, wz * 0.1) * 0.18);
      oc.set([t.r, t.g, t.b], i * 3);
    }
    og.setAttribute('color', new THREE.BufferAttribute(oc, 3)); og.computeVertexNormals();
    const ground2 = new THREE.Mesh(og, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    ground2.position.set(ORCH_X, 0, ORCH_Z); ground2.receiveShadow = true; ground2.userData.kind = 'ground'; orchardScene.add(ground2);
    // a sandy lane in from the front, mown rows between the tree spots
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), mat('#E3CFA2', { roughness: 1 })); lane.rotation.x = -Math.PI / 2; lane.position.set(ORCH_X, 0.012, 4.4); lane.receiveShadow = true; orchardScene.add(lane);
    // v0.61: the Orchard road — same style as Home's (verges, dashes, split-rail fence across it)
    { const rW = ROAD.z1 - ROAD.z0, rZ = (ROAD.z0 + ROAD.z1) / 2;
      const rd = new THREE.Mesh(new THREE.PlaneGeometry(140, rW), mat('#C9B9A0', { roughness: 1 })); rd.rotation.x = -Math.PI / 2; rd.position.set(ORCH_X, 0.02, rZ); rd.receiveShadow = true; orchardScene.add(rd);
      for (const z of [ROAD.z0 - 0.12, ROAD.z1 + 0.12]) { const v = new THREE.Mesh(new THREE.PlaneGeometry(140, 0.34), mat('#D9C9A4', { roughness: 1 })); v.rotation.x = -Math.PI / 2; v.position.set(ORCH_X, 0.026, z); v.receiveShadow = true; orchardScene.add(v); }
      const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 0.12), mat('#F5E6B8', { roughness: 1 }), 70); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      for (let i = 0; i < 70; i++) { m4.compose(new THREE.Vector3(ORCH_X - 70 + i * 2.0, 0.03, rZ), q, new THREE.Vector3(1, 1, 1)); dash.setMatrixAt(i, m4); } dash.receiveShadow = true; orchardScene.add(dash);
      const postG = new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6), railG = new THREE.BoxGeometry(2.05, 0.07, 0.06), posts = new THREE.InstancedMesh(postG, woodD, 40), rails = new THREE.InstancedMesh(railG, woodL, 80); let r2 = 0;
      for (let i = 0; i < 40; i++) { const x = ORCH_X - 40 + i * 2; m4.makeTranslation(x, 0.45, ROAD.z1 + 0.9); posts.setMatrixAt(i, m4); for (const y of [0.4, 0.72]) { m4.makeTranslation(x + 1, y, ROAD.z1 + 0.9); rails.setMatrixAt(r2++, m4); } }
      posts.castShadow = rails.castShadow = true; orchardScene.add(posts, rails); }
    const rowM = mat('#BCD596', { roughness: 1 });
    for (const z of [...new Set(ORCHARD_TREE_SPOTS.filter((p) => p.lot === 'orchard').map((p) => p.z))]) { const r = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 1.5), rowM); r.rotation.x = -Math.PI / 2; r.position.set(ORCH_X, 0.01, z); r.receiveShadow = true; orchardScene.add(r); }   // v0.68: 4 rows
    // v0.66.1: split-rail fence around the PURCHASED Orchard land only (the field + every bought Orchard plot), with a gate at
    // the lane; it is rebuilt whenever an Orchard plot is bought (setLotOwned), so unbought land always stays outside it.
    orchFenceG = new THREE.Group(); orchFenceG.userData.kind = 'orchfence'; orchardScene.add(orchFenceG); buildOrchFence();
    const m4 = new THREE.Matrix4();   // (still used by the meadow below)
    // wildflowers dotted through the grass (sunny meadow)
    { const fr = mulberry(77), fg = new THREE.IcosahedronGeometry(0.07, 0), cols = ['#FFFFFF', '#F5D35A', '#F7C5C5', '#B79AD6'];
      for (const c of cols) { const n = 90, im = new THREE.InstancedMesh(fg, mat(c), n); for (let k = 0; k < n; k++) { let x, z; do { x = ORCH_X + (fr() - 0.5) * 30; z = ORCH_Z + (fr() - 0.5) * 26; } while ((z > 4.3 && z < 8.9) || ORCHARD_TREE_SPOTS.some((p) => Math.hypot(p.x - x, p.z - z) < 1.1)); m4.makeTranslation(x, 0.06, z); im.setMatrixAt(k, m4); } orchardScene.add(im); } }
    // wild trees and blossom shrubs scattered on the hills around the field
    const r = mulberry(31);
    for (let k = 0; k < 90; k++) { const a = r() * Math.PI * 2, d = 27 + r() * 26, x = ORCH_X + Math.cos(a) * d * 1.1, z = ORCH_Z + Math.sin(a) * d - 4; if (z > 3.6 && z < 9.6) continue;
      const tr = makeTree(0.8 + r() * 0.7, Math.floor(r() * 8), r, 2 + Math.floor(r() * 2)); tr.position.set(x, 0, z); tr.rotation.y = r() * 6; orchardScene.add(tr); }
    for (let k = 0; k < 18; k++) { const b = makeBush(0.9 + r() * 0.5, r); const sx = r() < 0.5 ? -1 : 1; b.position.set(ORCH_X + sx * (22.5 + r() * 3), 0, ORCH_Z - 12 + r() * 14); orchardScene.add(b); }
  }
  // The Orchard shed: a little open-sided packing shed whose roof feeds the Orchard's rain barrel
  const orchardShed = new THREE.Group(); orchardShed.position.set(SPOTS.orchardshed[0], 0, SPOTS.orchardshed[1]); orchardScene.add(orchardShed);
  {
    for (const [x, z] of [[-0.8, -0.55], [0.8, -0.55], [-0.8, 0.55], [0.8, 0.55]]) { const p = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 0.12), woodD)); p.position.set(x, 0.85, z); orchardShed.add(p); }
    const roofM = mat('#B5523B', { roughness: 0.8 });
    for (const s of [-1, 1]) { const rf = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.8), roofM)); rf.position.set(0, 1.95, s * 0.36); rf.rotation.x = s * 0.42; orchardShed.add(rf); }
    const ridge = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.08, 0.1), woodL)); ridge.position.y = 2.12; orchardShed.add(ridge);
    const bench = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.5), woodL)); bench.position.set(0, 0.75, -0.2); orchardShed.add(bench);
    for (let k = 0; k < 3; k++) { const crate = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.32), woodM)); crate.position.set(-0.5 + k * 0.5, 0.14, 0.25); orchardShed.add(crate);
      const fr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(['#E0584A', '#F2B04C', '#F5D35A'][k])); fr.position.set(-0.5 + k * 0.5, 0.31, 0.25); orchardShed.add(fr); }
    const counter = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.5), woodL)); counter.position.set(0, 0.92, 0.62); orchardShed.add(counter);
    const front = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.86, 0.06), woodM)); front.position.set(0, 0.45, 0.86); orchardShed.add(front);
    const stockG = new THREE.Group(); stockG.name = 'stock'; orchardShed.add(stockG); stockG.visible = false;
    for (let k = 0; k < 6; k++) { const fr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat(['#E0584A', '#F2B04C', '#F5D35A', '#8E1A30', '#6A3A7A', '#B5B03A'][k])); fr.position.set(-0.75 + k * 0.3, 1.04, 0.6); stockG.add(fr); }
    for (let k = 0; k < 3; k++) { const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 10), mat(['#B8203A', '#F5D547', '#D9783A'][k], { roughness: 0.3 })); jar.position.set(-0.4 + k * 0.4, 1.07, 0.48); stockG.add(jar); }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 1.9), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.1; orchardShed.add(hit);
    const st = label('Orchard Stand', { h: 0.42, color: '#3D5A40', border: '#D9A93F' }); st.position.set(0, 2.75, 0.2); st.userData.kind = 'orchardshed'; orchardShed.add(st);
    orchardShed.traverse((m) => { m.userData.kind ??= 'orchardshed'; });
    orchardShed.userData.kind = 'orchardshed';
  }
  const bulkOrch = makeBulkBox('orchard'); bulkOrch.position.set(1.45, 0, 0.9); bulkOrch.rotation.y = -0.25; orchardShed.add(bulkOrch);
  function bulkPop(loc) { const g = loc === 'orchard' ? bulkOrch : bulkHome; g.userData.pop = performance.now(); poof(g.getWorldPosition(new THREE.Vector3()).setY(0.7), '#E9B949', 10, 0.9); }
  function setBulk(loc, on) { (loc === 'orchard' ? bulkOrch : bulkHome).visible = !!on; }
  function setOStandStock(n) { const g = orchardShed.getObjectByName('stock'); if (g) g.visible = n > 0; }
  const orchSign = label('The Orchard', { h: 0.55, color: '#3D5A40', border: '#D9A93F' }); orchSign.position.set(ORCH_X - 2.6, 1.7, 4.1); orchardScene.add(orchSign);
  function buildOrchFence() {
    if (!orchFenceG) return;
    for (const c of [...orchFenceG.children]) { orchFenceG.remove(c); c.geometry?.dispose?.(); }
    const ids = ['orchard', ...ORCH_FOR_SALE].filter((id) => orchOwned.has(id)), L = (id) => LOTS[id], E = 0.01;
    const owned = (x, z) => ids.some((id) => { const l = L(id); return x > l.x0 + E && x < l.x1 - E && z > l.z0 + E && z < l.z1 - E; });
    const posts = [], rails = [], segs = [];
    // every side of an owned plot whose neighbour across that side is NOT owned is part of the outline (split at 1 m so partial sides work)
    for (const id of ids) { const l = L(id);
      for (const [ax, az, bx, bz, nx, nz] of [[l.x0, l.z0, l.x1, l.z0, 0, -1], [l.x0, l.z1, l.x1, l.z1, 0, 1], [l.x0, l.z0, l.x0, l.z1, -1, 0], [l.x1, l.z0, l.x1, l.z1, 1, 0]]) {
        const len = Math.hypot(bx - ax, bz - az), n = Math.round(len); let run = null;
        for (let k = 0; k <= n; k++) { const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, out = k < n && !owned(x + nx * 0.5, z + nz * 0.5);
          if (out && !run) run = [ax + (bx - ax) * k / n, az + (bz - az) * k / n];
          if (!out && run) { segs.push([run[0], run[1], ax + (bx - ax) * k / n, az + (bz - az) * k / n]); run = null; } } } }
    // the gate: a 2.8 m opening on the front edge at the Orchard lane
    const GZ = LOTS.orchard.z1, G0 = ORCH_X - 1.4, G1 = ORCH_X + 1.4, cut = [];
    for (const [ax, az, bx, bz] of segs) { if (Math.abs(az - GZ) < E && Math.abs(bz - GZ) < E && Math.min(ax, bx) < G0 && Math.max(ax, bx) > G1) { cut.push([Math.min(ax, bx), az, G0, az], [G1, az, Math.max(ax, bx), az]); } else cut.push([ax, az, bx, bz]); }
    for (const [ax, az, bx, bz] of cut) { const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 2));
      for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; posts.push([x, z]); if (k < n) rails.push([x + (bx - ax) / n / 2, z + (bz - az) / n / 2, Math.hypot(bx - ax, bz - az) / n, -Math.atan2(bz - az, bx - ax)]); } }
    const postG = new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6), railG = new THREE.BoxGeometry(1, 0.07, 0.06);
    const pm = new THREE.InstancedMesh(postG, woodD, Math.max(1, posts.length)), rm = new THREE.InstancedMesh(railG, woodL, Math.max(1, rails.length * 2)), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    posts.forEach(([x, z], k) => { m4.makeTranslation(x, 0.45, z); pm.setMatrixAt(k, m4); }); pm.count = posts.length;
    rails.forEach(([x, z, len, a], k) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); for (const [j, y] of [[0, 0.4], [1, 0.72]]) { m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(len, 1, 1)); rm.setMatrixAt(k * 2 + j, m4); } }); rm.count = rails.length * 2;
    pm.castShadow = rm.castShadow = true; orchFenceG.add(pm, rm);
    // gate posts, a little arch and two gate leaves swung open
    for (const x of [G0, G1]) { const gp = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.16), woodD)); gp.position.set(x, 0.75, GZ); orchFenceG.add(gp); }
    const arch = shadowy(new THREE.Mesh(new THREE.BoxGeometry(G1 - G0 + 0.4, 0.14, 0.14), woodD)); arch.position.set(ORCH_X, 1.48, GZ); orchFenceG.add(arch);
    for (const [x, sx] of [[G0, 1], [G1, -1]]) { const leaf = new THREE.Group(); leaf.position.set(x, 0, GZ); leaf.rotation.y = sx * -1.1; orchFenceG.add(leaf);
      for (const y of [0.3, 0.62, 0.94]) { const r = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.05), woodL)); r.position.set(sx * 0.66, y, 0); leaf.add(r); }
      const br = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.05), woodL)); br.position.set(sx * 0.66, 0.62, 0); br.rotation.z = sx * 0.55; leaf.add(br); }
  }
  function setLotOwned(id, owned) { const f = lotFx[id]; if (f) f.fx.visible = !owned;
    if (ORCH_FOR_SALE.includes(id) && orchOwned.has(id) !== !!owned) { if (owned) orchOwned.add(id); else orchOwned.delete(id); buildOrchFence(); } }

  // ---------- Raised beds ----------
  const beds = []; const tiles = [];
  const soilDry = new THREE.Color('#8C6545'), soilWet = new THREE.Color('#563A28');
  const tileGeo = new THREE.BoxGeometry(1.0, 0.16, 1.0, 7, 1, 7);
  { const p = tileGeo.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getY(i) > 0) { const x = p.getX(i), z = p.getZ(i); const edge = Math.max(Math.abs(x), Math.abs(z)) * 2; p.setY(i, p.getY(i) + 0.05 * (1 - edge * edge) + (hash(x * 9, z * 9) - 0.5) * 0.035); } } tileGeo.computeVertexNormals(); }
  const ICON_TEX = { water: iconTexture('water'), ready: iconTexture('ready') };
  // v0.31: soft dappled shade overlay per tile (opacity follows the tile's shade)
  const SHADE_TEX = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 10, 64, 64, 66); rg.addColorStop(0, 'rgba(32,52,44,.85)'); rg.addColorStop(0.7, 'rgba(32,52,44,.6)'); rg.addColorStop(1, 'rgba(32,52,44,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 9; k++) { const x = 20 + hash(k, 7) * 88, y = 20 + hash(7, k) * 88, r = 5 + hash(k, k + 3) * 9; const d = g.createRadialGradient(x, y, 0, x, y, r); d.addColorStop(0, 'rgba(0,0,0,.55)'); d.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = d; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const shadeGeo = new THREE.PlaneGeometry(1.06, 1.06); shadeGeo.rotateX(-Math.PI / 2);
  const span = BED_N * TILE + 0.1;
  function addBed(siteId, animate) {
    const s = siteById(siteId); const bed = new THREE.Group(); bed.position.set(s.x, 0, s.z); scene.add(bed);
    for (let k = 0; k < 4; k++) {
      const plank = shadowy(new THREE.Mesh(new THREE.BoxGeometry(span + 0.5, 0.34, 0.26), k % 2 ? woodM : woodL));
      const cap = shadowy(new THREE.Mesh(new THREE.BoxGeometry(span + 0.56, 0.06, 0.32), woodL));
      const grp = new THREE.Group(); grp.add(plank); cap.position.y = 0.19; grp.add(cap);
      grp.rotation.y = k * Math.PI / 2; grp.position.y = 0.17;
      const d = span / 2 + 0.12; if (k === 0) grp.position.z = d; if (k === 1) grp.position.x = d; if (k === 2) grp.position.z = -d; if (k === 3) grp.position.x = -d;
      bed.add(grp);
    }
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const post = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.5, 8), woodD)); post.position.set(x * (span / 2 + 0.12), 0.25, z * (span / 2 + 0.12)); bed.add(post);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), woodL); knob.position.copy(post.position).setY(0.52); knob.scale.y = 0.6; bed.add(knob);
    }
    const under = new THREE.Mesh(new THREE.BoxGeometry(span, 0.2, span), mat('#5E412C')); under.position.y = 0.08; under.receiveShadow = true; bed.add(under);
    const base = tiles.length;
    for (let k = 0; k < BED_N * BED_N; k++) {
      const r = Math.floor(k / BED_N), c = k % BED_N, off = (BED_N - 1) / 2;
      const m = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ color: soilDry.clone().offsetHSL(0, 0, (hash(base + k, 3) - 0.5) * 0.03), roughness: 1 }));
      m.receiveShadow = true; m.position.set((c - off) * TILE, 0.22, (r - off) * TILE); m.userData = { kind: 'tile', index: base + k }; bed.add(m);
      const holder = new THREE.Group(); holder.position.set(m.position.x, 0.32, m.position.z); holder.scale.setScalar(1.3); bed.add(holder);
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
      icon.scale.setScalar(0.36); icon.visible = false; icon.renderOrder = 10; holder.add(icon);
      const sh = new THREE.Mesh(shadeGeo, new THREE.MeshBasicMaterial({ map: SHADE_TEX, transparent: true, opacity: 0, depthWrite: false }));
      sh.position.set(m.position.x, 0.365, m.position.z); sh.rotation.y = hash(base + k, 9) * 6.28; sh.renderOrder = 1; sh.visible = false; sh.userData.shade = true; bed.add(sh);
      tiles.push({ mesh: m, holder, icon, plant: null, key: '', bed, shade: sh });
    }
    beds.push({ site: siteId, group: bed });
    if (animate) { bed.userData.born = performance.now(); bed.scale.set(1, 0.01, 1); poof(new THREE.Vector3(s.x, 0.4, s.z), '#C99A6B', 26, 1.8); poof(new THREE.Vector3(s.x, 0.3, s.z), '#E9D9B8', 16, 1.6); }
    return base;
  }
  // ---------- v0.31: irrigation (drip hose from the rain barrel + badge on the bed) ----------
  const irrig = new Map(); const hoseM = mat('#3D5A40', { roughness: 0.7 }), hoseL = mat('#5F7F5F', { roughness: 0.8 });
  const IRRIG_TEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.shadowColor = 'rgba(60,40,20,.25)'; g.shadowBlur = 8; g.shadowOffsetY = 3; g.fillStyle = '#FFF9F0'; g.beginPath(); g.arc(64, 62, 48, 0, 7); g.fill(); g.shadowColor = 'transparent';
    g.lineWidth = 7; g.strokeStyle = '#B7D4B5'; g.stroke();
    g.strokeStyle = '#3D5A40'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(30, 48); g.bezierCurveTo(48, 36, 70, 60, 98, 46); g.stroke();
    g.fillStyle = '#8EC0D0'; for (const [x, y] of [[44, 64], [66, 70], [86, 62]]) { g.beginPath(); g.moveTo(x, y - 12); g.bezierCurveTo(x + 9, y, x + 7, y + 9, x, y + 9); g.bezierCurveTo(x - 7, y + 9, x - 9, y, x, y - 12); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  function setIrrigation(siteId, on, from = SPOTS.barrel) {
    const old = irrig.get(siteId); if (old) { scene.remove(old); irrig.delete(siteId); }
    if (!on) return;
    const s = siteById(siteId); const g = new THREE.Group(); g.userData.irrigation = siteId;
    const [bx, bz] = from, half = span / 2 + 0.12;
    // v0.4: short run inside the plot. Attach to the bed side facing the barrel, along a lane just outside the bed.
    const sideways = Math.abs(bx - s.x) >= half, pts = [[bx, 0.22, bz], [bx, 0.04, bz + (s.z < bz ? -0.4 : 0.4)]];
    let att, feedAlongZ;
    if (sideways) { const sg = Math.sign(bx - s.x), sideX = s.x + sg * half, lane = sideX + sg * 0.22; pts.push([lane, 0.04, bz + (s.z < bz ? -0.4 : 0.4)], [lane, 0.04, s.z], [sideX, 0.4, s.z]); att = [sideX, s.z]; feedAlongZ = true; }
    else { const sg = Math.sign(bz - s.z) || 1, sideZ = s.z + sg * half; pts.push([bx, 0.04, sideZ + sg * 0.22], [bx, 0.4, sideZ]); att = [bx, sideZ]; feedAlongZ = false; }
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    const hose = shadowy(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.045, 6, false), hoseM)); g.add(hose); g.userData.hoseLen = curve.getLength();
    for (const r of [-0.5, 0.5]) {
      const z = s.z + r * TILE, line = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, span + 0.1, 6), hoseL); line.rotation.z = Math.PI / 2; line.position.set(s.x, 0.38, z); g.add(line);
      for (let c = -1; c <= 1; c++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), mat('#8EC0D0', { emissive: '#8EC0D0', emissiveIntensity: 0.25 })); e.position.set(s.x + c * TILE, 0.37, z); g.add(e); }
    }
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, TILE + 0.1, 6), hoseL);
    if (feedAlongZ) { feed.rotation.x = Math.PI / 2; feed.position.set(att[0] - Math.sign(att[0] - s.x) * 0.1, 0.38, s.z); } else { feed.rotation.z = Math.PI / 2; feed.position.set(s.x, 0.38, att[1] - Math.sign(att[1] - s.z) * 0.1); }
    g.add(feed);
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: IRRIG_TEX, transparent: true, depthWrite: false, depthTest: false })); badge.scale.setScalar(0.5); badge.renderOrder = 11;
    badge.position.set(s.x + (bx < s.x ? -half : half), 0.95, s.z + (bz < s.z ? -half : half)); badge.userData.irrigBadge = siteId; g.add(badge); g.userData.badge = badge;
    scene.add(g); irrig.set(siteId, g);
  }
  function irrigPulse(siteId) { const g = irrig.get(siteId); if (!g) return; g.userData.pulse = performance.now(); }
  frameHooks.push((dt, t) => { for (const g of irrig.values()) { const b = g.userData.badge; const k = g.userData.pulse ? Math.max(0, 1 - (performance.now() - g.userData.pulse) / 700) : 0; b.scale.setScalar(0.5 + 0.18 * k + 0.02 * Math.sin(t * 3)); } });
  function tileWorld(i) { const t = tiles[i]; return t.mesh.getWorldPosition(new THREE.Vector3()).setY(0.3); }

  // Build ghosts
  const ghosts = new THREE.Group(); scene.add(ghosts); const ghostMeshes = [];
  const ghostOk = new THREE.MeshBasicMaterial({ color: '#F5D07A', transparent: true, opacity: 0.35, depthWrite: false });
  const ghostNo = new THREE.MeshBasicMaterial({ color: '#E8A5A8', transparent: true, opacity: 0.18, depthWrite: false });
  const barOk = new THREE.MeshBasicMaterial({ color: '#FFE7A6', transparent: true, opacity: 0.95, depthWrite: false });
  const barNo = new THREE.MeshBasicMaterial({ color: '#D98B90', transparent: true, opacity: 0.7, depthWrite: false });
  function setGhosts(list) {
    ghosts.clear(); ghostMeshes.length = 0;
    if (!list) return;
    for (const { id, ok, sun } of list) {
      const s = siteById(id); const g = new THREE.Group(); g.position.set(s.x, 0.09, s.z);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(span + 0.5, span + 0.5), ok ? ghostOk : ghostNo); pl.rotation.x = -Math.PI / 2; pl.renderOrder = 2; g.add(pl);
      for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(span + 0.6, 0.05, 0.09), ok ? barOk : barNo); b.rotation.y = k * Math.PI / 2; const d = (span + 0.5) / 2; b.position.set(k === 1 ? d : k === 3 ? -d : 0, 0.03, k === 0 ? d : k === 2 ? -d : 0); b.renderOrder = 3; g.add(b); }
      if (sun != null) { const lb = textSprite(`Sun ${Math.round(sun * 100)}%`, { h: 0.42, color: sun >= 0.8 ? '#3D5A40' : '#7C6A4C', border: sun >= 0.8 ? '#F5D07A' : '#C8E0E8', bg: sun >= 0.8 ? 'rgba(255,246,214,.95)' : 'rgba(234,242,244,.95)' }); lb.material.depthTest = false; lb.renderOrder = 12; lb.position.set(0, 0.75, 0); lb.userData.sunLabel = Math.round(sun * 100); g.add(lb); }
      pl.userData = { kind: 'site', id, ok, sun }; ghostMeshes.push(pl); ghosts.add(g);
    }
  }

  // v0.41: spot ghosts for placing a structure (Tincture Stand): green = can build here, pink = blocked
  const spotGhosts = new THREE.Group(); scene.add(spotGhosts);
  const spotOk = new THREE.MeshBasicMaterial({ color: '#8FD18B', transparent: true, opacity: 0.55, depthWrite: false });
  const spotNo = new THREE.MeshBasicMaterial({ color: '#E8A5A8', transparent: true, opacity: 0.35, depthWrite: false });
  const spotRingOk = new THREE.MeshBasicMaterial({ color: '#4E9F55', transparent: true, opacity: 0.9, depthWrite: false });
  function setSpotGhosts(list) {
    for (const c of [...spotGhosts.children]) { spotGhosts.remove(c); c.traverse((m) => m.geometry?.dispose()); }
    if (!list) return;
    for (const { x, z, ok } of list) {
      const g = new THREE.Group(); g.position.set(x, 0.08, z);
      const pl = new THREE.Mesh(new THREE.CircleGeometry(ok ? 0.62 : 0.42, 24), ok ? spotOk : spotNo); pl.rotation.x = -Math.PI / 2; pl.renderOrder = 2; g.add(pl);
      if (ok) { const r = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 28), spotRingOk); r.rotation.x = -Math.PI / 2; r.position.y = 0.01; r.renderOrder = 3; g.add(r); }
      g.userData = { spot: true, x, z, ok }; spotGhosts.add(g);
    }
  }
  frameHooks.push(() => { const t = performance.now() / 1000; for (const g of spotGhosts.children) if (g.userData.ok) g.scale.setScalar(1 + 0.06 * Math.sin(t * 3 + g.position.x)); });
  // v0.41: Sickle / Plow target one raised bed — each bed gets its own frame (green = something to do, grey = nothing to do)
  const bedTargets = new THREE.Group(); scene.add(bedTargets);
  const bedOkM = new THREE.MeshBasicMaterial({ color: '#7CCB78', transparent: true, opacity: 0.85, depthWrite: false });
  const bedNoM = new THREE.MeshBasicMaterial({ color: '#CDBFA8', transparent: true, opacity: 0.45, depthWrite: false });
  function setBedTargets(list) {
    for (const c of [...bedTargets.children]) { bedTargets.remove(c); c.traverse((m) => m.geometry?.dispose()); }
    if (!list) return;
    const h = TILE * BED_N / 2 + 0.22, w = 0.16;
    for (const { x, z, ok, b } of list) {
      const g = new THREE.Group(); g.position.set(x, 0.07, z);
      for (const [px, pz, sx, sz] of [[0, -h, 2 * h + w, w], [0, h, 2 * h + w, w], [-h, 0, w, 2 * h], [h, 0, w, 2 * h]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), ok ? bedOkM : bedNoM); m.rotation.x = -Math.PI / 2; m.position.set(px, 0, pz); m.renderOrder = 3; g.add(m); }
      g.userData = { bedTarget: true, ok, b }; bedTargets.add(g);
    }
  }
  frameHooks.push(() => { const t = performance.now() / 1000; for (const g of bedTargets.children) if (g.userData.ok) g.scale.setScalar(1 + 0.025 * Math.sin(t * 3.4 + g.position.x)); });
  // Selection frame
  const sel = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: '#F5D07A', transparent: true, opacity: 0.95, depthWrite: false }));
  sel.rotation.x = -Math.PI / 2; sel.scale.setScalar(Math.SQRT2 * 0.93); sel.visible = false; scene.add(sel);
  const selGlow = glowSprite('#FFE8A8', 1.6, 0.35); selGlow.visible = false; scene.add(selGlow);

  const scafM = mat('#D4A877'), scafD = mat('#8E6040');
  function makeScaffold(w, h, d) {
    const g = new THREE.Group(); const poleG = new THREE.CylinderGeometry(0.045, 0.05, h, 6);
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) { const p = shadowy(new THREE.Mesh(poleG, scafD)); p.position.set(x, h / 2, z); g.add(p); }
    for (let y = 0.65; y < h - 0.2; y += 0.8) {
      for (const z of [-d / 2, d / 2]) { const b = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.06, 0.14), scafM)); b.position.set(0, y, z); g.add(b); }
      for (const x of [-w / 2, w / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, d + 0.12), scafM); b.position.set(x, y + 0.03, 0); g.add(b); }
    }
    const ang = Math.atan2(h * 0.8, w), len = Math.hypot(w, h * 0.8);
    for (const z of [-d / 2 - 0.03, d / 2 + 0.03]) { const br = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), scafD); br.position.set(0, h * 0.45, z); br.rotation.z = z > 0 ? ang : -ang; g.add(br); }
    const top = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.07, d + 0.3), scafM)); top.position.y = h; g.add(top);
    for (let k = 0; k < 3; k++) { const pl = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.18), scafM)); pl.position.set(-w / 2 + 0.3 + k * 0.12, 0.06 + k * 0.065, d / 2 + 0.45); pl.rotation.y = 0.2 * k; g.add(pl); }
    return g;
  }
  const label_ = label; const CLOSED_L = { h: 0.46, color: '#7C6A4C', border: '#D9C9A4' }, OPEN_L = { h: 0.5 };
  // ---------- Farm stand ----------
  const stand = new THREE.Group(); stand.position.set(SPOTS.stand[0], 0, SPOTS.stand[1]); scene.add(stand);
  const crates = [];
  {
    const counter = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.95, 0.9), woodM)); counter.position.y = 0.48; stand.add(counter);
    const top = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 1.05), woodL)); top.position.y = 0.98; stand.add(top);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.04), mat('#F2E3CB')); panel.position.set(0, 0.5, 0.46); stand.add(panel);
    for (let k = 0; k < 3; k++) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), mat(['#9C86C9', '#F0A33A', '#FFFFFF'][k])); h.position.set(-0.55 + k * 0.55, 0.52, 0.485); stand.add(h); }
    for (const x of [-1.2, 1.2]) for (const z of [-0.4, 0.4]) { const p = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.5, 6), woodD)); p.position.set(x, 1.25, z); stand.add(p); }
    const n = 8;
    for (let i = 0; i < n; i++) {
      const s = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.9 / n, 0.05, 1.4), mat(i % 2 ? '#FFF6EA' : '#F4B9BC')));
      s.position.set(-1.45 + (i + 0.5) * 2.9 / n, 2.55, 0.05); s.rotation.x = 0.28; stand.add(s);
      const sc = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(2.9 / n / 2, 2.9 / n / 2, 0.05, 10, 1, false, 0, Math.PI), s.material));
      sc.rotation.x = Math.PI / 2 + 0.28; sc.rotation.z = Math.PI; sc.position.set(s.position.x, 2.36, 0.72); stand.add(sc);
    }
    [['#9C86C9', '#8268B8'], ['#F2A23A', '#E8892A'], ['#FFFDF6', '#F2C33E']].forEach(([a, b], k) => {
      const cr = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, 0.5), woodL)); cr.position.set(-0.8 + k * 0.8, 1.17, 0.05); stand.add(cr);
      const fl = new THREE.Group(); stand.add(fl); crates.push(fl);
      for (let j = 0; j < 7; j++) {
        const f = shadowy(new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), mat(j % 2 ? a : b)));
        f.position.set(-0.8 + k * 0.8 + (hash(j, k) - 0.5) * 0.45, 1.36 + hash(k, j) * 0.08, 0.05 + (hash(j + 3, k) - 0.5) * 0.3); fl.add(f);
      }
      fl.visible = false;
    });
    const chalk = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.05), mat('#4C5F4E'))); chalk.position.set(1.65, 0.45, 0.6); chalk.rotation.set(-0.15, -0.3, 0); stand.add(chalk);
    const lt = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat('#FFE1A0', { emissive: '#FFC861', emissiveIntensity: 1.4 })); lt.position.set(1.25, 2.0, 0.6); stand.add(lt);
    const lg = glowSprite('#FFCF7A', 1.4, 0.6); lg.position.copy(lt.position); stand.add(lg); glows.push(lg);
    const label = label_('Farm Stand', { h: 0.5 }); label.position.set(0, 3.2, 0.3); stand.add(label); stand.userData.label = label;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.6, 1.8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.6; stand.add(hit);
  }
  stand.userData.kind = 'stand'; stand.visible = false;
  // ---------- v0.65: Bulk Sell Box — a little slatted crate beside each stand (instant sale at half the stand price) ----------
  function makeBulkBox(loc) {
    const g = new THREE.Group(); g.userData = { kind: 'bulkbox', loc };
    const slatM = mat('#E3C79A', { roughness: 0.85 }), postM = mat('#B88A5A'), sageM = mat('#9DBF9E'), blushM = mat('#F4B9BC'), goldM = mat('#E9B949', { roughness: 0.4 });
    const base = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.58), postM)); base.position.y = 0.05; g.add(base);
    for (let k = 0; k < 3; k++) for (const [w, d, x, z] of [[0.78, 0.04, 0, 0.27], [0.78, 0.04, 0, -0.27], [0.04, 0.54, 0.37, 0], [0.04, 0.54, -0.37, 0]]) {
      const sl = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), slatM)); sl.position.set(x, 0.14 + k * 0.14, z); g.add(sl); }
    for (const [x, z] of [[0.37, 0.27], [-0.37, 0.27], [0.37, -0.27], [-0.37, -0.27]]) { const p = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), postM)); p.position.set(x, 0.27, z); g.add(p); }
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.6), sageM); band.position.y = 0.43; g.add(band);
    // a few goods peeking out, a blush tag and a honey-gold coin
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(['#9C86C9', '#F0A33A', '#FFFDF6', '#F2A7B8', '#8FC48A'][k])); b.position.set(-0.24 + k * 0.12, 0.42, (k % 2 ? 0.06 : -0.08)); g.add(b); }
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.02), blushM); tag.position.set(0, 0.3, 0.3); tag.rotation.x = -0.08; g.add(tag);
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 14), goldM); coin.rotation.x = Math.PI / 2; coin.position.set(0, 0.3, 0.315); g.add(coin);
    const lb = label('Bulk Box', { h: 0.3 }); lb.position.set(0, 0.95, 0); g.add(lb);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.2, 0.8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.5; g.add(hit);
    return g;
  }
  const bulkHome = makeBulkBox('home'); bulkHome.position.set(-1.95, 0, 0.75); bulkHome.rotation.y = 0.25; stand.add(bulkHome);
  // ---------- v0.4: one rain barrel per plot, each with a live water/countdown badge ----------
  const BARREL_FONT = '700 54px Nunito, sans-serif', BARREL_FONT2 = '700 40px Nunito, sans-serif';
  function barrelCanvasTex(line1, line2, full) {
    const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = BARREL_FONT; const w1 = g.measureText(line1).width; g.font = BARREL_FONT2; const w2 = line2 ? g.measureText(line2).width : 0;
    const W2 = Math.ceil(Math.max(w1 + 70, w2) + 56), H = line2 ? 150 : 104; c.width = W2; c.height = H;
    g.fillStyle = full ? 'rgba(234,244,247,.95)' : 'rgba(255,249,240,.95)'; g.strokeStyle = '#8EC0D0'; g.lineWidth = 6; g.beginPath(); g.roundRect(4, 4, W2 - 8, H - 8, 40); g.fill(); g.stroke();
    const x0 = (W2 - (w1 + 52)) / 2, cy = 54;   // water drop + main line
    g.fillStyle = '#7FB3C6'; g.beginPath(); g.moveTo(x0 + 18, cy - 24); g.bezierCurveTo(x0 + 34, cy - 4, x0 + 32, cy + 20, x0 + 18, cy + 20); g.bezierCurveTo(x0 + 4, cy + 20, x0 + 2, cy - 4, x0 + 18, cy - 24); g.fill();
    g.fillStyle = '#3D5A40'; g.font = BARREL_FONT; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(line1, x0 + 50, cy + 2);
    if (line2) { g.font = BARREL_FONT2; g.fillStyle = '#5F7F5F'; g.textAlign = 'center'; g.fillText(line2, W2 / 2, 112); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { t, w: W2, h: H };
  }
  function makeBarrel(lot, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const bd = new THREE.Group(); g.add(bd); g.userData.body = bd;   // v0.63: the barrel itself (scaled up with its size level)
    const b = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.75, 12), woodM)); b.position.y = 0.38; bd.add(b);
    for (const y of [0.15, 0.6]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 4, 16), mat('#7C6A5A')); r.rotation.x = Math.PI / 2; r.position.y = y; bd.add(r); }
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.29, 14), mat('#A8D2E0', { roughness: 0.2, emissive: '#7FB3C6', emissiveIntensity: 0.15 })); w.rotation.x = -Math.PI / 2; w.position.y = 0.72; bd.add(w); g.userData.surface = w;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.55; g.add(hit);
    const info = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })); info.renderOrder = 12; info.position.y = 1.35; info.visible = false; info.userData.barrelInfo = lot; g.add(info);
    g.userData.kind = 'barrel'; g.userData.lot = lot; g.userData.info = info; g.visible = false; barrels.set(lot, g); return g;
  }
  // v0.63: barrel size levels — the barrel grows a little per level and gains a honey-brass band per level (shared geometry)
  const BAND_Y = [0.38, 0.27, 0.49, 0.06], BAND_S = [1, 1.08, 1.16, 1.25, 1.34]; let bandGeo = null, bandMat = null;
  function setBarrelLv(lot, lv, pop = false) {
    const g = barrels.get(lot); if (!g) return; lv = Math.max(1, Math.min(5, lv | 0)); if (g.userData.lv === lv && !pop) return; g.userData.lv = lv;
    const bd = g.userData.body, sc = BAND_S[lv - 1]; bd.scale.set(sc, sc, sc); g.userData.info.position.y = 1.35 * sc + 0.05 * (lv - 1);
    const bands = g.userData.bands || (g.userData.bands = []);
    if (!bandGeo) { bandGeo = new THREE.TorusGeometry(0.335, 0.03, 4, 18); bandMat = mat('#D9B45A', { roughness: 0.35, metalness: 0.4 }); }
    while (bands.length < lv - 1) { const r = new THREE.Mesh(bandGeo, bandMat); r.rotation.x = Math.PI / 2; r.position.y = BAND_Y[bands.length]; bd.add(r); bands.push(r); }
    bands.forEach((r, k) => (r.visible = k < lv - 1));
    if (pop) { bd.scale.set(sc * 1.12, sc * 1.12, sc * 1.12); setTimeout(() => bd.scale.set(sc, sc, sc), 220); }
  }
  const barrels = new Map();
  const barrel = makeBarrel('home', SPOTS.barrel[0], SPOTS.barrel[1]);
  function addBarrel(lot, x, z, animate) { const g = barrels.get(lot) || makeBarrel(lot, x, z); g.position.set(x, 0, z); if (animate) buildAnim(g, [0.9, 1.0, 0.9], null); else g.visible = true; return g; }
  function removeBarrel(lot) { const g = barrels.get(lot); if (!g) return; setGutter(lot, null); poof(g.position.clone().setY(0.5), '#E9D9B8', 12, 1); scene.remove(g); barrels.delete(lot); }
  // v0.41: a gutter + downspout from a roof on the same plot into the barrel (a barrel only collects rain when connected)
  const gutters = new Map(); const gutterM = mat('#8E979C', { roughness: 0.45, metalness: 0.35 });
  // v0.52: one pipe per connected stand (a barrel takes up to 2); `froms` is a list of roof [x, z] (a single pair still works)
  function setGutter(lot, froms) {
    if (froms && froms.length && !Array.isArray(froms[0])) froms = [froms]; froms = (froms || []).filter((f) => f && f.length === 2);
    const g = barrels.get(lot), key = g && froms.length ? froms.map((f) => `${f[0].toFixed(2)},${f[1].toFixed(2)}`).join('+') + `>${g.position.x.toFixed(2)},${g.position.z.toFixed(2)}` : '';
    const old = gutters.get(lot); if (old?.userData.key === key) return; if (old) { scene.remove(old); old.traverse((m) => m.geometry?.dispose()); gutters.delete(lot); }
    if (!key) return;
    const grp = new THREE.Group(); grp.userData.key = key; grp.userData.gutter = lot; grp.userData.pipes = froms.length;
    const bx = g.position.x, bz = g.position.z;
    froms.forEach((from, k) => {
      const dx = bx - from[0], dz = bz - from[1], d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, off = Math.min(0.85, d * 0.45), H = 1.75 - k * 0.12;
      const P = (x, y, z) => new THREE.Vector3(x, y, z), a = P(from[0] + ux * off, H, from[1] + uz * off), b = P(bx + (k ? 0.08 : 0), H, bz + (k ? 0.08 : 0)), c = P(bx + (k ? 0.08 : 0), 0.86, bz + (k ? 0.08 : 0));
      const path = new THREE.CurvePath(); if (a.distanceTo(b) > 0.05) path.add(new THREE.LineCurve3(a, b)); path.add(new THREE.LineCurve3(b, c));
      grp.add(shadowy(new THREE.Mesh(new THREE.TubeGeometry(path, 24, 0.04, 6), gutterM)));
      for (const p of [a, b]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), gutterM); e.position.copy(p); grp.add(e); }
      const trough = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), gutterM); trough.position.copy(a); grp.add(trough);
    });
    scene.add(grp); gutters.set(lot, grp);
  }
  frameHooks.push(() => { for (const [lot, grp] of gutters) grp.visible = !!barrels.get(lot)?.visible; });
  // text: main line ('7/10 · next in 0:42' or '10/10 · Full'), sub: 'Feeds 2/4 beds'. Re-drawn only when the text changes (once a second at most).
  function setBarrelInfo(lot, main, sub, full, k = 0) {
    const g = barrels.get(lot); if (!g) return; const s = g.userData.info; const key = main + '|' + sub + '|' + full;
    if (s.userData.key !== key) { const { t, w, h } = barrelCanvasTex(main, sub, full); s.material.map?.dispose(); s.material.map = t; s.material.needsUpdate = true; s.userData.key = key; s.userData.aspect = w / h; s.userData.hpx = h; s.userData.main = main; s.userData.sub = sub; }
    s.visible = g.visible; g.userData.surface.position.y = 0.2 + 0.52 * k;
  }
  frameHooks.push(() => { // stay readable on a phone, shrink (and drop the sub line) when zoomed out
    const z = ctl.zoom, sc = Math.max(0.55, Math.min(1.05, 1.25 - 0.45 * z));
    for (const g of barrels.values()) { const s = g.userData.info; if (!s.userData.aspect) continue; const h = 0.42 * sc * (s.userData.hpx / 104); s.scale.set(h * s.userData.aspect, h, 1); s.material.opacity = z > 1.9 ? 0.0 : z > 1.6 ? 0.7 : 1; }
  });
  // ---------- v0.4: placeable Honeybee Skep (one per plot) + a soft honey tint and bee icon on the beds it boosts ----------
  const hives = new Map(), beeFx = new THREE.Group(); scene.add(beeFx);
  const strawM = mat('#E2B65A', { roughness: 0.9 }), strawD = mat('#B8873A', { roughness: 0.9 }), beeM = mat('#F2C230'), beeDark = mat('#3A2E22');
  function makeHive(lot, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const post = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.42, 8), woodM)); post.position.y = 0.21; g.add(post);
    const board = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 14), woodM)); board.position.y = 0.45; g.add(board);
    [[0.38, 0.12], [0.36, 0.26], [0.31, 0.39], [0.23, 0.5], [0.12, 0.58]].forEach(([r, y], n) => { const t = shadowy(new THREE.Mesh(new THREE.TorusGeometry(r, 0.075, 6, 18), n % 2 ? strawD : strawM)); t.rotation.x = Math.PI / 2; t.position.y = 0.48 + y; g.add(t); });
    const body = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.37, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), strawM)); body.scale.y = 1.55; body.position.y = 0.5; g.add(body);
    const door = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), beeDark); door.position.set(0, 0.6, 0.37); g.add(door);
    const bees = [];
    for (let n = 0; n < 4; n++) { const b = new THREE.Group(); const bd = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), beeM); bd.scale.set(1.3, 1, 1); b.add(bd);
      const st = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 4, 10), beeDark); st.rotation.y = Math.PI / 2; b.add(st); g.add(b); bees.push({ b, ph: n * 1.7, r: 0.55 + n * 0.12, h: 0.75 + (n % 2) * 0.25 }); }
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.65; g.add(hit);
    g.userData.kind = 'hive'; g.userData.lot = lot; g.userData.bees = bees; g.visible = false; hives.set(lot, g); return g;
  }
  function addHive(lot, x, z, animate) { const g = hives.get(lot) || makeHive(lot, x, z); g.position.set(x, 0, z); if (animate) buildAnim(g, [0.9, 1.3, 0.9], null); else g.visible = true; return g; }
  function removeHive(lot) { const g = hives.get(lot); if (!g) return; poof(g.position.clone().setY(0.6), '#F3D27A', 14, 1.2); scene.remove(g); hives.delete(lot); }
  // ---------- v0.61: Garden Workers — a soft, stylized gardener (straw hat, sage apron, little watering can) ----------
  const workers = new Map();
  function makeWorker(lot) {
    const g = new THREE.Group(); g.userData = { kind: 'worker', id: lot }; scene.add(g);
    const skin = mat('#E8C4A0', { roughness: 0.8 }), shirt = mat('#F3E6D0', { roughness: 0.9 }), apron = mat('#8FB08A', { roughness: 0.85 }), boot = mat('#7A5A3C'), straw = mat('#E3C27A', { roughness: 0.95 }), band = mat('#C2513F');
    const body = shadowy(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.32, 6, 14), shirt)); body.position.y = 0.46; g.add(body);
    const ap = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.205, 0.36, 16, 1, true, -1.2, 2.4), apron)); ap.position.y = 0.4; g.add(ap);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), mat('#7C9C77')); pocket.position.set(0, 0.42, 0.2); g.add(pocket);
    for (const sx of [-0.08, 0.08]) { const b = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), boot)); b.scale.set(1, 0.6, 1.35); b.position.set(sx, 0.05, 0.02); g.add(b); }
    const head = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skin)); head.position.y = 0.86; g.add(head);
    for (const sx of [-0.045, 0.045]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), mat('#3D3328')); e.position.set(sx, 0.875, 0.118); g.add(e); }
    for (const sx of [-0.075, 0.075]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), mat('#F2A9A0', { transparent: true, opacity: 0.7 })); c.position.set(sx, 0.84, 0.105); g.add(c); }
    const brim = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.02, 20), straw)); brim.position.y = 0.95; g.add(brim);
    const crown = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.12, 16), straw)); crown.position.y = 1.02; g.add(crown);
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.03, 16, 1, true), band); hb.position.y = 0.975; g.add(hb);
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#B98BD6')); flower.position.set(0.12, 1.0, 0.05); g.add(flower);
    const arm = new THREE.Group(); arm.position.set(0.2, 0.62, 0); g.add(arm);
    const sleeve = shadowy(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), shirt)); sleeve.position.y = -0.12; arm.add(sleeve);
    const can = new THREE.Group(); can.position.set(0.04, -0.3, 0.06); arm.add(can);
    const tank = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 12), mat('#7FA6B8', { roughness: 0.5, metalness: 0.2 }))); can.add(tank);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.16, 6), mat('#6C93A6')); spout.rotation.z = -0.9; spout.position.set(0.1, 0.04, 0); can.add(spout);
    const arm2 = shadowy(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), shirt)); arm2.position.set(-0.2, 0.5, 0); arm2.rotation.z = -0.15; g.add(arm2);
    const pay = textSprite('Needs pay', { h: 0.26, color: '#8A5A1E', border: '#E3B341' }); pay.position.y = 1.32; pay.visible = false; g.add(pay);
    // v0.65: a woven basket (hidden until they pick or carry), then everything but the pay tag goes on a rig so the gardener can lean, kneel and walk
    const basket = new THREE.Group(); basket.position.set(-0.26, 0.36, 0.08); basket.visible = false;
    const wick = mat('#B98A55', { roughness: 0.95 }), bsk = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.1, 10, 1, true), wick)); basket.add(bsk);
    const bbot = new THREE.Mesh(new THREE.CircleGeometry(0.085, 10), wick); bbot.rotation.x = -Math.PI / 2; bbot.position.y = -0.05; basket.add(bbot);
    const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 4, 10, Math.PI), wick); hnd.position.y = 0.04; basket.add(hnd);
    const fillM = mat('#E7A0B5', { roughness: 0.8 }), fill = new THREE.Group(); for (const [fx, fz] of [[-0.04, 0], [0.04, 0.02], [0, -0.04]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), fillM); b.position.set(fx, 0.04, fz); fill.add(b); } basket.add(fill);
    g.add(basket);
    const boots = []; g.children.forEach((c) => { if (c.geometry?.type === 'SphereGeometry' && Math.abs(c.position.y - 0.05) < 0.001) boots.push(c); });
    const rig = new THREE.Group(); [...g.children].forEach((c) => { if (c !== pay) rig.add(c); }); g.add(rig);
    g.traverse((o) => { if (o !== g) o.userData = { ...o.userData, kind: 'worker', id: lot }; });
    g.userData.parts = { arm, pay, head, rig, boots, can, basket, fillM, arm2 }; g.userData.state = 'work'; g.userData.mv = { path: [], k: 0, act: null, until: 0, face: null, carry: false };
    return g;
  }
  // v0.65: walking + task poses (visual only — the work itself is already done by main.js). pts = waypoints, act = what to do on arrival.
  function workerGo(lot, pts, act, ms, o = {}) { const g = workers.get(lot); if (!g) return false; const m = g.userData.mv;
    m.path = (pts || []).map((p) => ({ x: p.x, z: p.z })); m.k = 0; m.act = act || null; m.ms = ms || 0; m.until = 0; m.face = o.face || null; m.carry = !!o.carry;
    if (o.color) g.userData.parts.fillM.color.set(o.color); g.userData.parts.basket.visible = m.carry; return true; }
  function workerIdle(lot) { const g = workers.get(lot); if (!g) return false; const m = g.userData.mv; return !m.path.length && performance.now() >= m.until; }
  function workerPose(lot) { const g = workers.get(lot); if (!g) return null; const m = g.userData.mv; return { x: +g.position.x.toFixed(2), z: +g.position.z.toFixed(2), moving: m.path.length > 0, act: m.act, acting: !m.path.length && performance.now() < m.until, carry: g.userData.parts.basket.visible, left: m.path.length }; }
  function placeWorker(lot, x, z) { const g = workers.get(lot); if (!g) return; g.position.set(x, 0, z); const m = g.userData.mv; m.path = []; m.until = 0; m.act = null; }
  function addWorker(lot, x, z, animate) { let g = workers.get(lot); if (!g) { g = makeWorker(lot); workers.set(lot, g); } g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x + (x > 150 ? 300 : 0), 6 - z) * 0.4; if (animate) { g.visible = true; poof(g.position.clone().setY(0.5), '#B7D4B5', 14, 1.1); } else g.visible = true; return g; }
  function removeWorker(lot) { const g = workers.get(lot); if (!g) return; scene.remove(g); workers.delete(lot); }
  function setWorker(lot, state) { const g = workers.get(lot); if (!g) return; g.userData.state = state; g.userData.parts.pay.visible = state === 'pay'; }
  function workerAt(lot) { const g = workers.get(lot); return g ? { x: g.position.x, z: g.position.z, state: g.userData.state, pay: g.userData.parts.pay.visible, visible: g.visible } : null; }
  const WK_SPEED = 1.15;
  let wkLast = 0;
  function updateWorkers(t) {
    const pnow = performance.now(), dt = Math.min(0.25, wkLast ? (pnow - wkLast) / 1000 : 0.016); wkLast = pnow;   // wall-clock step: same walking speed on slow devices
    for (const g of workers.values()) { if (!g.visible) continue; const P = g.userData.parts, m = g.userData.mv, w = g.userData.state === 'work', ph = t + (g.id || 0);
      let walk = false;
      if (m.path.length) {   // walk along the waypoints, turning smoothly
        const p = m.path[0], dx = p.x - g.position.x, dz = p.z - g.position.z, d = Math.hypot(dx, dz), step = WK_SPEED * dt;
        if (d <= step) { g.position.x = p.x; g.position.z = p.z; m.path.shift(); if (!m.path.length) m.until = pnow + (m.ms || 0); }
        else { g.position.x += dx / d * step; g.position.z += dz / d * step; turnTo(g, Math.atan2(dx, dz), dt * 8); walk = true; }
      } else if (m.face && pnow < m.until) turnTo(g, Math.atan2(m.face.x - g.position.x, m.face.z - g.position.z), dt * 6);
      const act = !walk && pnow < m.until ? m.act : null, R = P.rig;
      // reset to neutral, then layer the pose
      let ry = 0, rx = 0, armZ = 0.08, armX = 0, canX = 0, bootSw = 0, headY = Math.sin(ph * 0.5) * 0.1;
      if (walk) { ry = Math.abs(Math.sin(ph * 9)) * 0.035; bootSw = Math.sin(ph * 9) * 0.07; armX = Math.sin(ph * 9) * 0.3; armZ = 0.12; headY = 0; }
      else if (act === 'water') { rx = 0.12; armZ = 0.25; armX = -0.9; canX = 0.55 + Math.sin(ph * 2.2) * 0.12; headY = Math.sin(ph * 0.8) * 0.15; }
      else if (act === 'plant') { ry = -0.16; rx = 0.42; armZ = 0.15; armX = -1.0 + Math.sin(ph * 4) * 0.25; headY = 0; }
      else if (act === 'pick') { rx = 0.5 + Math.sin(ph * 2.4) * 0.08; armZ = 0.2; armX = -1.2 + Math.sin(ph * 3.4) * 0.3; headY = Math.sin(ph * 1.3) * 0.2; }
      else if (act === 'stock' || act === 'craft') { rx = 0.08; armZ = 0.18; armX = -1.1 + Math.sin(ph * 3) * 0.35; headY = Math.sin(ph * 1.1) * 0.25; }
      else if (act === 'rest') { ry = -0.12; rx = -0.05; armZ = 0.05; headY = Math.sin(ph * 0.4) * 0.25; }
      else if (w && !m.act) { ry = Math.abs(Math.sin(ph * 3)) * 0.02; armZ = 0.2 + Math.sin(ph * 2.2) * 0.2; armX = -0.25; headY = Math.sin(ph * 0.9) * 0.35; }
      R.position.y = ry; R.rotation.x = rx; P.arm.rotation.z = armZ; P.arm.rotation.x = armX; P.can.rotation.z = -canX; P.head.rotation.y = headY;
      if (P.boots.length === 2) { P.boots[0].position.z = 0.02 + bootSw; P.boots[1].position.z = 0.02 - bootSw; }
      if (P.pay.visible) P.pay.position.y = 1.32 + Math.sin(t * 2.5) * 0.04; }
  }
  function turnTo(g, a, k) { let d = a - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, k); }
  let beeTex = null;
  function beeIcon() { if (beeTex) return beeTex; const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
    x.fillStyle = 'rgba(255,249,236,.95)'; x.beginPath(); x.arc(48, 48, 44, 0, 7); x.fill(); x.strokeStyle = '#E2B65A'; x.lineWidth = 5; x.stroke();
    x.font = '54px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🐝', 48, 52); beeTex = new THREE.CanvasTexture(c); beeTex.colorSpace = THREE.SRGBColorSpace; return beeTex; }
  const tintM = new THREE.MeshBasicMaterial({ color: '#F6C64E', transparent: true, opacity: 0.28, depthWrite: false });
  // centers: [{x, z}] of the beds boosted by a hive on their own plot.
  function setBeeBeds(centers) {
    while (beeFx.children.length) { const o = beeFx.children.pop(); o.geometry?.dispose(); if (o.isSprite) o.material.dispose(); }
    for (const c of centers) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 4.1), tintM); t.rotation.x = -Math.PI / 2; t.position.set(c.x, 0.025, c.z); t.renderOrder = 1; beeFx.add(t);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: beeIcon(), transparent: true, depthWrite: false })); sp.scale.set(0.42, 0.42, 1); sp.position.set(c.x + 1.75, 0.75, c.z + 1.75); beeFx.add(sp);
    }
  }
  frameHooks.push(() => { const t = performance.now() / 1000;
    for (const g of hives.values()) if (g.visible) for (const e of g.userData.bees) { const a = t * 2.2 + e.ph; e.b.position.set(Math.cos(a) * e.r, e.h + Math.sin(t * 5 + e.ph) * 0.06, Math.sin(a) * e.r); e.b.rotation.y = -a; } });
  // ---------- v0.4: Tincture Stand (glass bottles on a little wooden stall) ----------
  const tincture = new THREE.Group(); tincture.position.set(SPOTS.tincture[0], 0, SPOTS.tincture[1]); tincture.rotation.y = -0.35; tincture.scale.setScalar(0.8); scene.add(tincture);
  const tincSlots = [];
  {
    const counter = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 0.8), woodM)); counter.position.y = 0.45; tincture.add(counter);
    const top = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 0.95), woodL)); top.position.y = 0.94; tincture.add(top);
    for (const x of [-1.0, 1.0]) { const post = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.12), woodD)); post.position.set(x, 1.15, -0.3); tincture.add(post); }
    const roof = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 1.2), mat('#8C6545'))); roof.position.set(0, 2.3, 0.05); roof.rotation.x = 0.18; tincture.add(roof);
    const shelf = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.3), woodL)); shelf.position.set(0, 1.45, -0.28); tincture.add(shelf);
    const glassC = ['#C98B4E', '#A0643A', '#B7D4B5', '#D8E6EC', '#E9B44C', '#8A5A3A'];
    for (let k = 0; k < 9; k++) for (const y of [1.0, 1.5]) {
      const col = glassC[(k + (y > 1.2 ? 2 : 0)) % glassC.length]; const bm = mat(col, { roughness: 0.15, transparent: true, opacity: 0.82, emissive: col, emissiveIntensity: 0.08 });
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.24, 8), bm); bt.position.set(-0.84 + k * 0.21, y + 0.12, y > 1.2 ? -0.28 : -0.12); tincture.add(bt);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.08, 6), bm); neck.position.set(bt.position.x, y + 0.28, bt.position.z); tincture.add(neck);
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 6), mat('#C99A6B')); cork.position.set(bt.position.x, y + 0.34, bt.position.z); tincture.add(cork);
    }
    for (let k = 0; k < 2; k++) {   // two craft slots: a big flask that glows when a tincture is ready
      const g = new THREE.Group(); g.position.set(-0.55 + k * 1.1, 0.98, 0.18);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat('#D8C6E8', { roughness: 0.1, transparent: true, opacity: 0.8 }).clone()); f.position.y = 0.16; g.add(f);
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), f.material); n.position.y = 0.36; g.add(n);
      const gl = glowSprite('#FFE19A', 0.9, 0.45); gl.position.y = 0.2; gl.visible = false; g.add(gl);
      g.visible = false; tincture.add(g); tincSlots.push({ g, f, gl });
    }
    const label = label_('Tincture Stand', { h: 0.5 }); label.position.set(0, 3.0, 0.2); tincture.add(label); tincture.userData.label = label;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.8, 1.4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.3; tincture.add(hit);
  }
  tincture.userData.kind = 'tincture'; tincture.visible = false;
  function setTincture(slots) { slots.forEach((s, k) => { const t = tincSlots[k]; if (!t) return; t.g.visible = !!s; if (!s) return; t.f.material.color.set(s.done ? '#E9B44C' : s.base === 'vinegar' ? '#E8C9A0' : '#D8C6E8'); t.gl.visible = !!s.done; }); }
  // ---------- v0.41: Essential Oil Stand — a stall with two copper stills; steam puffs while distilling ----------
  const still = new THREE.Group(); still.position.set(SPOTS.still[0], 0, SPOTS.still[1]); still.rotation.y = 0.3; still.scale.setScalar(0.8); scene.add(still);
  const stillSlots = [];
  {
    const copper = mat('#D0824A', { roughness: 0.32, metalness: 0.35, emissive: '#5A2A10', emissiveIntensity: 0.12 }), copperD = mat('#A35F34', { roughness: 0.4, metalness: 0.3 });
    const counter = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 0.8), woodM)); counter.position.y = 0.45; still.add(counter);
    const top = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 0.95), woodL)); top.position.y = 0.94; still.add(top);
    for (const x of [-1.0, 1.0]) { const post = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.12), woodD)); post.position.set(x, 1.15, -0.3); still.add(post); }
    const roof = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 1.2), mat('#7A5A44'))); roof.position.set(0, 2.3, 0.05); roof.rotation.x = 0.18; still.add(roof);
    const shelf = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.3), woodL)); shelf.position.set(0, 1.5, -0.28); still.add(shelf);
    const amber = mat('#8A4A1C', { roughness: 0.15, transparent: true, opacity: 0.9 });
    for (let k = 0; k < 7; k++) { const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.18, 8), amber); bt.position.set(-0.75 + k * 0.25, 1.62, -0.28); still.add(bt);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 6), mat('#2F2A26')); cap.position.set(bt.position.x, 1.75, -0.28); still.add(cap); }
    const steamMat = () => new THREE.SpriteMaterial({ map: glowTexture(), color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false });
    for (let k = 0; k < 2; k++) {
      const g = new THREE.Group(); g.position.set(-0.5 + k * 1.0, 0.98, 0.12); still.add(g);
      const pot = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), copper)); pot.scale.y = 0.85; pot.position.y = 0.22; g.add(pot);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), copper); helm.position.y = 0.48; g.add(helm);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.56, 0), new THREE.Vector3(0.1, 0.72, 0), new THREE.Vector3(0.26, 0.68, 0), new THREE.Vector3(0.36, 0.42, 0)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.025, 6), copper));
      const cond = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.34, 10), copperD)); cond.position.set(0.38, 0.2, 0); g.add(cond);
      for (const y of [0.1, 0.2, 0.3]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 4, 14), copper); r.rotation.x = Math.PI / 2; r.position.set(0.38, y, 0); g.add(r); }
      const ember = glowSprite('#FF9A4A', 0.32, 0.8); ember.position.set(0, 0.02, 0.1); ember.visible = false; g.add(ember);
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.2, 8), mat('#B8692A', { roughness: 0.1, emissive: '#7A3A10', emissiveIntensity: 0.35 })); bottle.position.set(0.38, 0.47, 0); bottle.visible = false; g.add(bottle);
      const gl = glowSprite('#FFD27A', 0.8, 0.45); gl.position.set(0.38, 0.5, 0); gl.visible = false; g.add(gl);
      const steam = [0, 1, 2].map(() => { const sp = new THREE.Sprite(steamMat()); sp.userData.steam = true; sp.renderOrder = 6; sp.visible = false; g.add(sp); return sp; });
      stillSlots.push({ g, ember, bottle, gl, steam, active: false });
    }
    const label = label_('Essential Oil Stand', { h: 0.5 }); label.position.set(0, 3.0, 0.2); still.add(label); still.userData.label = label;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.8, 1.4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.3; still.add(hit);
  }
  still.userData.kind = 'still'; still.visible = false;
  function setStill(slots) { slots.forEach((s, k) => { const t = stillSlots[k]; if (!t) return; t.active = !!s && !s.done; t.ember.visible = t.active; t.bottle.visible = !!s && s.done; t.gl.visible = !!s && s.done; }); }
  frameHooks.push(() => { const tt = performance.now() / 1000;
    for (const t of stillSlots) t.steam.forEach((sp, i) => { if (!t.active || !still.visible) { sp.visible = false; return; } const ph = (tt * 0.55 + i / 3) % 1; sp.visible = true;
      sp.position.set(0.03 + ph * 0.15 + Math.sin(tt * 2 + i) * 0.04, 0.6 + ph * 0.9, ph * 0.95); sp.scale.setScalar(0.2 + ph * 0.55); sp.material.opacity = 0.9 * Math.sin(Math.PI * Math.min(1, ph * 1.15)); }); });
  // ---------- v0.52: Tea Stand — a sage-striped stall with a copper kettle, tins and two brewing teapots ----------
  const teastand = new THREE.Group(); teastand.position.set(SPOTS.teastand[0], 0, SPOTS.teastand[1]); teastand.rotation.y = -0.2; teastand.scale.setScalar(0.8); scene.add(teastand);
  const teaSlots = [];
  {
    const counter = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 0.8), mat('#B9895A', { roughness: 0.85 }))); counter.position.y = 0.45; teastand.add(counter);
    for (let k = 0; k < 3; k++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.04, 0.02), woodD); pl.position.set(0, 0.2 + k * 0.25, 0.41); teastand.add(pl); }
    const top = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 0.95), woodL)); top.position.y = 0.94; teastand.add(top);
    for (const x of [-1.0, 1.0]) for (const z of [-0.32, 0.38]) { const post = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), woodD)); post.position.set(x, 1.1, z); teastand.add(post); }
    // striped awning (cream + sage), scalloped front edge
    const stripeC = document.createElement('canvas'); stripeC.width = 256; stripeC.height = 16; { const g = stripeC.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#F7F3E6' : '#7FA47D'; g.fillRect(i * 32, 0, 32, 16); } }
    const stripeT = new THREE.CanvasTexture(stripeC); stripeT.colorSpace = THREE.SRGBColorSpace;
    const awn = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.06, 1.2), new THREE.MeshStandardMaterial({ map: stripeT, roughness: 0.85 }))); awn.position.set(0, 2.2, 0.1); awn.rotation.x = 0.2; teastand.add(awn);
    for (let i = 0; i < 8; i++) { const sc = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(i % 2 ? '#F7F3E6' : '#7FA47D')); sc.rotation.x = Math.PI; sc.scale.set(1, 0.6, 0.35); sc.position.set(-1.07 + i * 0.306, 2.07, 0.7); teastand.add(sc); }
    // shelf of tea tins
    const shelf = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.28), woodL)); shelf.position.set(0, 1.5, -0.3); teastand.add(shelf);
    ['#E58F94', '#B79AD6', '#F2B54A', '#7FA47D', '#6C7FD0', '#E58F94'].forEach((c, k) => { const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 12), mat(c, { roughness: 0.4, metalness: 0.2 })); tin.position.set(-0.7 + k * 0.28, 1.64, -0.3); teastand.add(tin);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 12), mat('#B0603A', { metalness: 0.3, roughness: 0.4 })); lid.position.set(tin.position.x, 1.77, -0.3); teastand.add(lid); });
    // copper kettle in the middle
    const copper = mat('#D0824A', { roughness: 0.32, metalness: 0.35, emissive: '#5A2A10', emissiveIntensity: 0.12 });
    const kettle = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), copper)); kettle.scale.y = 0.8; kettle.position.set(0, 1.13, 0.05); teastand.add(kettle);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.2, 8), copper); spout.position.set(0.2, 1.18, 0.05); spout.rotation.z = -0.9; teastand.add(spout);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 14, Math.PI), mat('#3A2A20')); handle.position.set(0, 1.27, 0.05); teastand.add(handle);
    const steamMat = () => new THREE.SpriteMaterial({ map: glowTexture(), color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false });
    for (let k = 0; k < 2; k++) {   // two teapots = two brewing slots
      const g = new THREE.Group(); g.position.set(-0.62 + k * 1.24, 0.98, 0.12); teastand.add(g);
      const pot = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), mat(k ? '#F7F3E6' : '#E7C3C0', { roughness: 0.35 }))); pot.scale.y = 0.85; pot.position.y = 0.15; g.add(pot);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6), mat('#B0603A')); lid.position.y = 0.3; g.add(lid);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.16, 8), pot.material); sp.position.set(0.17, 0.18, 0); sp.rotation.z = -0.9; g.add(sp);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.08, 10), mat('#FFFFFF', { roughness: 0.3 })); cup.position.set(0.32, 0.04, 0.12); g.add(cup);
      const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 12), mat('#F2B54A', { emissive: '#7A5A10', emissiveIntensity: 0.4 })); tin.position.set(-0.28, 0.1, 0.1); tin.visible = false; g.add(tin);
      const gl = glowSprite('#FFD27A', 0.8, 0.45); gl.position.set(-0.28, 0.2, 0.1); gl.visible = false; g.add(gl);
      const steam = [0, 1, 2].map(() => { const s2 = new THREE.Sprite(steamMat()); s2.userData.steam = true; s2.renderOrder = 6; s2.visible = false; g.add(s2); return s2; });
      teaSlots.push({ g, tin, gl, steam, active: false });
    }
    const label = label_('Tea Stand', { h: 0.5 }); label.position.set(0, 2.95, 0.2); teastand.add(label); teastand.userData.label = label;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.8, 1.4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.3; teastand.add(hit);
  }
  teastand.userData.kind = 'teastand'; teastand.visible = false;
  function setTea(slots) { slots.forEach((s, k) => { const t = teaSlots[k]; if (!t) return; t.active = !!s && !s.done; t.tin.visible = !!s && s.done; t.gl.visible = !!s && s.done; if (s?.color) t.tin.material.color.set(s.color); }); }
  frameHooks.push(() => { const tt = performance.now() / 1000;
    for (const t of teaSlots) t.steam.forEach((sp, i) => { if (!t.active || !teastand.visible) { sp.visible = false; return; } const ph = (tt * 0.6 + i / 3) % 1; sp.visible = true;
      sp.position.set(0.17 + ph * 0.12 + Math.sin(tt * 2 + i) * 0.04, 0.3 + ph * 0.8, ph * 0.5); sp.scale.setScalar(0.16 + ph * 0.45); sp.material.opacity = 0.85 * Math.sin(Math.PI * Math.min(1, ph * 1.15)); }); });
  // ---------- v0.6: Pressed Oil Stand (screw press, barrels, bottles) and Fruit Stand (awning, jars, crates, a jam pot) ----------
  const craftSlots = { press: [], opress: [], fruitstand: [] };
  const steamMat2 = () => new THREE.SpriteMaterial({ map: glowTexture(), color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false });
  // v0.66.1: one builder for both oil presses (Home + the Orchard's own)
  function makePress(kind, spot, name) {
  const press = new THREE.Group(); press.position.set(spot[0], 0, spot[1]); press.rotation.y = -0.2; press.scale.setScalar(0.8); scene.add(press);
  {
    const iron = mat('#6E777A', { roughness: 0.45, metalness: 0.5 }), oak = mat('#9A6B44', { roughness: 0.85 });
    const base = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 1.1), woodD)); base.position.y = 0.15; press.add(base);
    for (const x of [-0.55, 0.55]) { const post = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.1, 0.24), oak)); post.position.set(x - 0.35, 1.2, 0); press.add(post); }
    const beam = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.26, 0.3), oak)); beam.position.set(-0.35, 2.2, 0); press.add(beam);
    const screw = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 10), iron)); screw.position.set(-0.35, 1.5, 0); press.add(screw);
    for (let i = 0; i < 9; i++) { const th = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 4, 10), iron); th.rotation.x = Math.PI / 2 + 0.2; th.position.set(-0.35, 1.0 + i * 0.12, 0); press.add(th); }
    const wheel = new THREE.Group(); wheel.position.set(-0.35, 2.5, 0); press.add(wheel); press.userData.wheel = wheel;
    const rim = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 24), iron)); rim.rotation.x = Math.PI / 2; wheel.add(rim);
    for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.03, 0.03), iron); sp.rotation.y = i * Math.PI / 4; wheel.add(sp); }
    const plate = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 18), iron)); plate.position.set(-0.35, 0.86, 0); press.add(plate);
    const basket = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.5, 18, 1, true), oak)); basket.position.set(-0.35, 0.56, 0); press.add(basket);
    for (let i = 0; i < 12; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.04), woodL); const a = (i / 12) * Math.PI * 2; sl.position.set(-0.35 + Math.cos(a) * 0.48, 0.56, Math.sin(a) * 0.48); sl.rotation.y = -a; press.add(sl); }
    const spout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.3), woodL); spout.position.set(-0.35, 0.33, 0.6); press.add(spout);
    const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), mat('#F2C53D', { emissive: '#8A6418', emissiveIntensity: 0.4 })); drip.position.set(-0.35, 0.22, 0.72); drip.visible = false; press.add(drip); press.userData.drip = drip;
    const barrel = (x, z, sc) => { const b = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.3 * sc, 0.26 * sc, 0.7 * sc, 14), oak)); b.position.set(x, 0.3 + 0.35 * sc, z); press.add(b);
      for (const y of [-0.22, 0.22]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.295 * sc, 0.018, 4, 18), iron); h.rotation.x = Math.PI / 2; h.position.set(x, 0.3 + 0.35 * sc + y * sc, z); press.add(h); } };
    barrel(0.75, -0.2, 1); barrel(0.7, 0.35, 0.8);
    for (let k = 0; k < 2; k++) {   // two pressing slots = two finished-bottle spots on the bench
      const g = new THREE.Group(); g.position.set(0.25 + k * 0.38, 0.3, 0.42); press.add(g);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.3, 10), mat('#F2C53D', { roughness: 0.25, emissive: '#8A6418', emissiveIntensity: 0.3 })); b.position.y = 0.15; b.visible = false; g.add(b);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 8), mat('#8A6545')); neck.position.y = 0.34; b.add(neck); neck.position.y = 0.19;
      const gl = glowSprite('#FFD27A', 0.7, 0.45); gl.position.y = 0.25; gl.visible = false; g.add(gl);
      craftSlots[kind].push({ g, item: b, gl, active: false });
    }
    const label = label_(name, { h: 0.5 }); label.position.set(0, 3.1, 0.2); press.add(label); press.userData.label = label;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.0, 1.4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.4; press.add(hit);
  }
  press.userData.kind = kind; press.visible = false; return press;
  }
  const press = makePress('press', SPOTS.press, 'Pressed Oil Stand'), opress = makePress('opress', SPOTS.opress || [0, -95], 'Orchard Oil Press');
  const fruitstand = new THREE.Group(); fruitstand.position.set(SPOTS.fruitstand[0], 0, SPOTS.fruitstand[1]); fruitstand.rotation.y = -0.2; fruitstand.scale.setScalar(0.8); scene.add(fruitstand);
  {
    const counter = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 0.8), mat('#C99A6B', { roughness: 0.85 }))); counter.position.y = 0.45; fruitstand.add(counter);
    const top = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 0.95), woodD)); top.position.y = 0.94; fruitstand.add(top);
    for (const x of [-1.0, 1.0]) for (const z of [-0.32, 0.38]) { const post = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), woodD)); post.position.set(x, 1.1, z); fruitstand.add(post); }
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 8; const cx = cv.getContext('2d');
    for (let i = 0; i < 8; i++) { cx.fillStyle = i % 2 ? '#FFF6E6' : '#D9473B'; cx.fillRect(i * 16, 0, 16, 8); }
    const stripeT = new THREE.CanvasTexture(cv); stripeT.colorSpace = THREE.SRGBColorSpace;
    const awn = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.06, 1.2), new THREE.MeshStandardMaterial({ map: stripeT, roughness: 0.85 }))); awn.position.set(0, 2.2, 0.1); awn.rotation.x = 0.2; fruitstand.add(awn);
    for (let i = 0; i < 8; i++) { const sc = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(i % 2 ? '#FFF6E6' : '#D9473B')); sc.rotation.x = Math.PI; sc.scale.set(1, 0.6, 0.35); sc.position.set(-1.07 + i * 0.305, 2.08, 0.7); fruitstand.add(sc); }
    const shelf = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.28), woodL)); shelf.position.set(0, 1.5, -0.3); fruitstand.add(shelf);
    ['#B8203A', '#F5D547', '#6A3A7A', '#F6A46B', '#8A4A22', '#E9C27A'].forEach((c, k) => { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.2, 12), mat(c, { roughness: 0.25 })); j.position.set(-0.7 + k * 0.28, 1.63, -0.3); fruitstand.add(j);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.04, 12), mat('#F7E3E3')); lid.position.set(j.position.x, 1.75, -0.3); fruitstand.add(lid); });
    const crate = (x, z, c) => { const b = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.42), woodL)); b.position.set(x, 0.16, z); fruitstand.add(b);
      for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(c, { roughness: 0.5 })); f.position.set(x - 0.16 + (i % 3) * 0.16, 0.36, z - 0.08 + Math.floor(i / 3) * 0.16); fruitstand.add(f); } };
    crate(-0.75, 0.75, '#D9473B'); crate(-0.15, 0.8, '#F6A46B'); crate(0.5, 0.75, '#F5D547');
    const stove = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.12, 14), mat('#3A3A3A', { roughness: 0.6 }))); stove.position.set(0, 1.04, 0.05); fruitstand.add(stove);
    const pot = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.24, 16), mat('#D0824A', { roughness: 0.32, metalness: 0.35 }))); pot.position.set(0, 1.22, 0.05); fruitstand.add(pot);
    for (let k = 0; k < 2; k++) {
      const g = new THREE.Group(); g.position.set(-0.62 + k * 1.24, 0.98, 0.12); fruitstand.add(g);
      const j = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 12), mat('#B8203A', { roughness: 0.25, emissive: '#3A0A10', emissiveIntensity: 0.3 })); j.position.y = 0.12; j.visible = false; g.add(j);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12), mat('#F7E3E3')); lid.position.y = 0.15; j.add(lid);
      const gl = glowSprite('#FFD27A', 0.7, 0.45); gl.position.y = 0.2; gl.visible = false; g.add(gl);
      const steam = [0, 1, 2].map(() => { const s2 = new THREE.Sprite(steamMat2()); s2.userData.steam = true; s2.renderOrder = 6; s2.visible = false; fruitstand.add(s2); return s2; });
      craftSlots.fruitstand.push({ g, item: j, gl, steam, active: false });
    }
    const label = label_('Fruit Stand', { h: 0.5 }); label.position.set(0, 2.95, 0.2); fruitstand.add(label); fruitstand.userData.label = label;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.8, 1.6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.3; fruitstand.add(hit);
  }
  fruitstand.userData.kind = 'fruitstand'; fruitstand.visible = false;
  // slots: [{ done, color } | null]
  function setCraft(kind, slots) { slots.forEach((s, k) => { const t = craftSlots[kind][k]; if (!t) return; t.active = !!s && !s.done; t.item.visible = !!s && s.done; t.gl.visible = !!s && s.done && !!s.glow; if (s?.color) { t.item.material = t.item.material.clone(); t.item.material.color.set(s.color); } }); }
  frameHooks.push(() => { const tt = performance.now() / 1000;
    for (const [pr, kk] of [[press, 'press'], [opress, 'opress']]) { const pressing = craftSlots[kk].some((t) => t.active); if (pr.visible) { if (pressing) pr.userData.wheel.rotation.y = tt * 1.4; pr.userData.drip.visible = pressing; if (pressing) pr.userData.drip.scale.y = 0.6 + 0.4 * Math.abs(Math.sin(tt * 3)); } }
    const cooking = craftSlots.fruitstand.some((t) => t.active);
    craftSlots.fruitstand.forEach((t, k) => t.steam.forEach((sp, i) => { if (!cooking || !fruitstand.visible || k) { sp.visible = false; return; } const ph = (tt * 0.6 + i / 3) % 1; sp.visible = true;
      sp.position.set(Math.sin(tt * 2 + i) * 0.06, 1.35 + ph * 0.8, 0.05 + ph * 0.3); sp.scale.setScalar(0.16 + ph * 0.45); sp.material.opacity = 0.85 * Math.sin(Math.PI * Math.min(1, ph * 1.15)); })); });

  // ---------- v0.6: Orchard trees — one stylized procedural model per tree card ----------
  const orchardG = new THREE.Group(); scene.add(orchardG);
  const orchardTrees = new Map();
  function rainbowBark() {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d');
    const cols = ['#5BA06A', '#E07A5A', '#7A6ACF', '#E9B83E', '#4FA0B8', '#C85A8A', '#8FBF5A'];
    for (let i = 0; i < 26; i++) { c.fillStyle = cols[i % cols.length]; const x = (i * 23) % 64; c.beginPath(); c.ellipse(x, (i * 37) % 128, 8 + (i % 4) * 3, 22 + (i % 5) * 6, 0, 0, Math.PI * 2); c.fill(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  let barkRainbow = null;
  function makeFruitTree(def) {
    const root = new THREE.Group(), grow = new THREE.Group(), fruits = new THREE.Group(); root.add(grow); grow.add(fruits);
    const rnd = ((seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(def.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 2147483646 + 1);
    const glow = def.glow >= 1, leafM = mat(def.leaf, { roughness: 0.8, ...(glow ? { emissive: def.leaf, emissiveIntensity: 0.25 } : {}) });
    const barkM = def.shape === 'eucalyptus' ? new THREE.MeshStandardMaterial({ map: (barkRainbow ||= rainbowBark()), roughness: 0.6 }) : mat(def.trunk, { roughness: 0.9 });
    const fruitM = mat(def.fruitC, { roughness: 0.35, ...(glow ? { emissive: def.fruitC, emissiveIntensity: 0.7 } : {}) });
    const blobs = [];
    const trunk = (h, r0 = 0.1, r1 = 0.15, x = 0, z = 0, tilt = 0) => { const m = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 9), barkM)); m.position.set(x, h / 2, z); m.rotation.z = tilt; grow.add(m); return m; };
    const blob = (x, y, z, r, sx = 1, sy = 1, sz = 1, m = leafM, detail = 1) => { const g = new THREE.IcosahedronGeometry(r, detail); const b = shadowy(new THREE.Mesh(g, m)); b.position.set(x, y, z); b.scale.set(sx, sy, sz); grow.add(b); blobs.push({ x, y, z, r, sx, sy, sz }); return b; };
    const branch = (x0, y0, x1, y1, z1 = 0, r = 0.05) => { const a = new THREE.Vector3(x0, y0, 0), b = new THREE.Vector3(x1, y1, z1), d = b.clone().sub(a); const m = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, d.length(), 7), barkM)); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); grow.add(m); };
    let fruitN = 9, fr = 0.09, fruitGeo = null, onTrunk = false;
    switch (def.shape) {
      case 'round': trunk(1.4); blob(0, 2.0, 0, 0.95); blob(-0.45, 1.75, 0.3, 0.55); blob(0.5, 1.8, -0.2, 0.55); break;
      case 'spread': trunk(1.0, 0.11, 0.17); branch(0, 0.9, -0.7, 1.35); branch(0, 0.9, 0.75, 1.3, 0.2); blob(0, 1.6, 0, 1.15, 1, 0.42, 1); blob(-0.7, 1.5, 0.2, 0.55, 1, 0.6, 1); blob(0.7, 1.5, -0.1, 0.55, 1, 0.6, 1); fr = 0.1; break;
      case 'oval': trunk(1.5, 0.08, 0.12); blob(0, 2.3, 0, 0.7, 1, 1.55, 1); fruitN = 12; fr = 0.06; fruitGeo = 'pair'; break;
      case 'weep': trunk(1.6, 0.1, 0.15); blob(0, 2.15, 0, 0.9, 1.1, 0.55, 1.1);
        for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 6), leafM); c.position.set(Math.cos(a) * 0.85, 1.55, Math.sin(a) * 0.85); c.rotation.x = Math.PI; c.castShadow = true; grow.add(c); blobs.push({ x: c.position.x, y: 1.35, z: c.position.z, r: 0.16, sx: 1, sy: 1, sz: 1 }); } fr = 0.085; break;
      case 'lollipop': trunk(1.5, 0.06, 0.09); { const pot = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.4, 14), mat('#C98B5E'))); pot.position.y = 0.2; grow.add(pot); } blob(0, 2.0, 0, 0.75, 1, 1, 1, leafM, 2); fr = 0.1; break;
      case 'broad': trunk(1.2, 0.12, 0.18); branch(0, 1.1, -0.6, 1.6); branch(0, 1.1, 0.6, 1.6); blob(-0.65, 1.85, 0, 0.7); blob(0.65, 1.85, 0.1, 0.7); blob(0, 2.2, -0.1, 0.75); fr = 0.09; break;
      case 'olive': trunk(1.0, 0.09, 0.14, -0.08, 0, 0.18); trunk(1.1, 0.08, 0.13, 0.1, 0.05, -0.2); for (let i = 0; i < 7; i++) blob(-0.7 + rnd() * 1.4, 1.35 + rnd() * 0.8, -0.5 + rnd() * 1.0, 0.32 + rnd() * 0.15, 1, 0.7, 1, mat(i % 2 ? '#9DB08A' : '#8EA27A'), 0); fruitN = 14; fr = 0.045; break;
      case 'blossom': trunk(1.3, 0.08, 0.12); blob(0, 1.95, 0, 0.9, 1.05, 0.8, 1.05);
        for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, e = rnd() * 1.2 - 0.3, p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat('#F7D4E2', { emissive: '#F7D4E2', emissiveIntensity: 0.15 })); p.position.set(Math.cos(a) * Math.cos(e) * 0.93, 1.95 + Math.sin(e) * 0.72, Math.sin(a) * Math.cos(e) * 0.93); grow.add(p); } fr = 0.065; fruitGeo = 'almond'; break;
      case 'vase': trunk(0.8, 0.1, 0.14); branch(0, 0.75, -0.55, 1.7); branch(0, 0.75, 0.55, 1.7); branch(0, 0.75, 0, 1.8, -0.5); blob(-0.6, 1.95, 0, 0.5, 1, 1.25, 1); blob(0.6, 1.95, 0, 0.5, 1, 1.25, 1); blob(0, 2.1, -0.5, 0.5, 1, 1.25, 1); fr = 0.12; fruitN = 8; fruitGeo = 'crown'; break;
      case 'lantern': trunk(1.4); blob(0, 2.0, 0, 0.9, 1, 1, 1, mat('#D98A3A', { roughness: 0.8 })); blob(-0.3, 2.3, 0.3, 0.5, 1, 1, 1, mat('#E8A24A', { roughness: 0.8 })); fr = 0.12; fruitGeo = 'lantern'; break;
      case 'eucalyptus': trunk(2.6, 0.1, 0.17); branch(0, 1.9, -0.6, 2.5); branch(0, 2.1, 0.55, 2.8, 0.2); blob(-0.6, 2.65, 0, 0.45, 1.2, 0.6, 1, mat('#7FB0A0')); blob(0.55, 2.95, 0.2, 0.5, 1.2, 0.6, 1, mat('#8FC0AE')); blob(0, 3.0, -0.2, 0.55, 1.2, 0.55, 1, mat('#7AA898')); fr = 0.07; fruitGeo = 'leaf'; break;
      case 'cacao': trunk(1.9, 0.12, 0.17); blob(0, 2.3, 0, 0.95, 1.1, 0.6, 1.1, mat('#4F7A45')); onTrunk = true; fruitN = 7; break;
      case 'moon': trunk(1.4); blob(0, 2.0, 0, 0.92, 1, 1, 1, leafM, 2); blob(-0.4, 2.35, 0.25, 0.45, 1, 1, 1, mat('#7A8AC4', { emissive: '#7A8AC4', emissiveIntensity: 0.3 })); fr = 0.11; break;
      case 'crystal': trunk(1.3, 0.07, 0.11); { const cm = new THREE.MeshStandardMaterial({ color: '#BFE3D9', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.82, emissive: '#5A9AB0', emissiveIntensity: 0.25, flatShading: true });
        blob(0, 2.0, 0, 0.9, 1, 1.1, 1, cm, 0); blob(-0.5, 1.75, 0.2, 0.45, 1, 1, 1, cm, 0); blob(0.5, 1.8, -0.2, 0.45, 1, 1, 1, cm, 0); } fr = 0.1; fruitGeo = 'octa'; break;
      default: trunk(1.4); blob(0, 2.0, 0, 0.9);
    }
    // fruit, placed on the outside of the canopy (or, for cacao, straight on the trunk)
    const geo = fruitGeo === 'octa' ? new THREE.OctahedronGeometry(fr) : fruitGeo === 'leaf' ? new THREE.SphereGeometry(fr, 6, 4) : new THREE.SphereGeometry(fr, 10, 8);
    const fm = fruitGeo === 'leaf' ? mat('#E07A5A', { roughness: 0.6 }) : fruitM;
    for (let i = 0; i < fruitN; i++) {
      let m;
      if (onTrunk) { m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), fruitM); m.scale.set(0.8, 1.6, 0.8); const a = i * 2.4; m.position.set(Math.cos(a) * 0.17, 0.5 + (i / fruitN) * 1.2, Math.sin(a) * 0.17); m.rotation.z = Math.cos(a) * 0.3; }
      else { const b = blobs[i % blobs.length], a = rnd() * Math.PI * 2, e = -0.5 + rnd() * 0.9;
        m = new THREE.Mesh(geo, fm); m.position.set(b.x + Math.cos(a) * Math.cos(e) * b.r * b.sx * 0.97, b.y + Math.sin(e) * b.r * b.sy * 0.97, b.z + Math.sin(a) * Math.cos(e) * b.r * b.sz * 0.97);
        if (fruitGeo === 'pair') { const m2 = new THREE.Mesh(geo, fm); m2.position.set(0.09, -0.02, 0); m.add(m2); }
        if (fruitGeo === 'lantern' || fruitGeo === 'crown') m.scale.set(1, 0.85, 1);
        if (fruitGeo === 'almond') m.scale.set(0.8, 1.2, 0.8); }
      m.castShadow = true; fruits.add(m);
    }
    if (glow) for (let i = 0; i < 4; i++) { const g = glowSprite(def.fruitC, 0.9, 0.45); const b = blobs[i % blobs.length]; g.position.set(b.x, b.y, b.z + b.r * 0.6); fruits.add(g); }
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 3.2, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.6; root.add(hit);
    root.userData = { grow, fruits };
    return root;
  }
  const STAGE_SCALE = [0.28, 0.5, 0.75, 1];
  function addOrchardTree(k, sp) {
    removeOrchardTree(k); const def = TREES[sp], spot = ORCHARD_TREE_SPOTS[k]; if (!def || !spot) return null;
    const t = makeFruitTree(def); t.position.set(spot.x, 0, spot.z); t.rotation.y = (k * 1.7) % (Math.PI * 2);
    Object.assign(t.userData, { kind: 'orchardtree', k, sp }); orchardG.add(t); orchardTrees.set(k, t); return t;
  }
  function setOrchardTree(k, stage, ripe, dry = false) { const t = orchardTrees.get(k); if (!t) return; const s = STAGE_SCALE[Math.max(0, Math.min(3, stage))]; t.userData.grow.scale.setScalar(s); t.userData.fruits.visible = stage >= 3 && !!ripe; t.userData.stage = stage; t.userData.ripe = !!ripe;
    // v0.67.1: a picked tree waits for water — the usual needs-water icon floats over it
    let ic = t.userData.waterIcon; if (dry && !ic) { ic = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICON_TEX.water, transparent: true, depthWrite: false, depthTest: false })); ic.renderOrder = 12; ic.scale.setScalar(0.85); t.add(ic); t.userData.waterIcon = ic; }
    if (ic) { ic.visible = !!dry; ic.position.set(0, 0.9 + 3.1 * s, 0); } }
  frameHooks.push((dt, tt) => { for (const t of orchardTrees.values()) { const ic = t.userData.waterIcon; if (ic?.visible) ic.scale.setScalar(0.85 + 0.05 * Math.sin(tt * 3 + t.userData.k)); } });
  // v0.67.1: tree-row irrigation. Each owned row shows a badge at its west end: the drip badge + a drip line when irrigated,
  // a pale "not irrigated" badge otherwise.
  const DRY_TEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.globalAlpha = 0.9; g.fillStyle = '#FFF9F0'; g.beginPath(); g.arc(64, 62, 48, 0, 7); g.fill(); g.lineWidth = 6; g.setLineDash([10, 8]); g.strokeStyle = '#B9AE9C'; g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#B9AE9C'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(30, 48); g.bezierCurveTo(48, 36, 70, 60, 98, 46); g.stroke();
    g.lineWidth = 4; g.beginPath(); const x = 64, y = 70; g.moveTo(x, y - 14); g.bezierCurveTo(x + 10, y, x + 8, y + 10, x, y + 10); g.bezierCurveTo(x - 8, y + 10, x - 10, y, x, y - 14); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const treeRowG = new THREE.Group(); scene.add(treeRowG); const treeRows = new Map();
  function setTreeRows(rows) {   // rows: [{ id, x0, x1, z, on }]
    for (const g of treeRows.values()) treeRowG.remove(g); treeRows.clear();
    for (const r of rows) { const g = new THREE.Group(); g.userData = { treeRow: r.id, on: !!r.on };
      const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: r.on ? IRRIG_TEX : DRY_TEX, transparent: true, depthWrite: false, depthTest: false })); b.scale.setScalar(0.62); b.renderOrder = 11; b.position.set(r.x0 - 1.5, 0.75, r.z); g.add(b); g.userData.badge = b;
      if (r.on) { const len = r.x1 - r.x0 + 2.2, line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), hoseM); line.rotation.z = Math.PI / 2; line.position.set((r.x0 + r.x1) / 2 - 0.1, 0.05, r.z + 0.75); g.add(line);
        for (let x = r.x0; x <= r.x1 + 0.01; x += (r.x1 - r.x0) / Math.max(1, r.n - 1) || 1) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), mat('#8EC0D0', { emissive: '#8EC0D0', emissiveIntensity: 0.25 })); e.position.set(x, 0.06, r.z + 0.75); g.add(e); } }
      treeRowG.add(g); treeRows.set(r.id, g); }
  }
  function treeRowPulse(id) { const g = treeRows.get(id); if (g) g.userData.pulse = performance.now(); }
  frameHooks.push((dt, t) => { for (const g of treeRows.values()) { const b = g.userData.badge, k = g.userData.pulse ? Math.max(0, 1 - (performance.now() - g.userData.pulse) / 700) : 0; b.scale.setScalar(0.62 + 0.2 * k + (g.userData.on ? 0.02 * Math.sin(t * 3) : 0)); } });
  function removeOrchardTree(k) { const t = orchardTrees.get(k); if (t) { orchardG.remove(t); orchardTrees.delete(k); } }
  frameHooks.push(() => { const tt = performance.now() / 1000; for (const t of orchardTrees.values()) if (t.userData.ripe) t.userData.grow.rotation.z = Math.sin(tt * 0.8 + t.userData.k) * 0.012; });

  // ---------- v0.41: Parking Lot — painted bays along the near lane by the Farm Stand, plus a P sign ----------
  const parking = new THREE.Group(); parking.position.set(PARK_X[1], 0, ROAD.near); parking.visible = false; scene.add(parking);   // children are relative to the middle bay
  const paintM = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.9, transparent: true, opacity: 0.92, depthWrite: false });
  const parkBays = PARK_X.map((x, k) => { const g = new THREE.Group(); g.position.set(x - PARK_X[1], 0.015, 0); parking.add(g);
    for (const dx of [-1.25, 1.25]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1.2), paintM); l.rotation.x = -Math.PI / 2; l.position.x = dx; l.renderOrder = 1; g.add(l); }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.1), paintM); back.rotation.x = -Math.PI / 2; back.position.z = 0.62; back.renderOrder = 1; g.add(back);
    return g; });
  { const post = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 8), mat('#8E979C', { metalness: 0.3, roughness: 0.5 }))); post.position.set(2.15 - PARK_X[1], 0.85, 4.8 - ROAD.near); parking.add(post);
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#3F6FB0'; g.beginPath(); g.roundRect(4, 4, 120, 120, 18); g.fill(); g.strokeStyle = '#FFFFFF'; g.lineWidth = 7; g.beginPath(); g.roundRect(12, 12, 104, 104, 12); g.stroke();
    g.fillStyle = '#FFFFFF'; g.font = '800 84px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })); sign.position.set(2.15 - PARK_X[1], 1.55, 4.84 - ROAD.near); sign.rotation.y = 0.15; parking.add(sign);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(2.15 - PARK_X[1], 0.95, 4.8 - ROAD.near); parking.add(hit); }
  parking.userData.kind = 'parking';
  function setParking(cap) { parking.visible = cap > 1; parkBays.forEach((b, k) => (b.visible = k < cap)); parking.userData.spots = cap; }
  // v0.68.1: the Orchard's own Parking Lot — the same painted bays + P sign along the Orchard road, beside the Orchard Stand
  const oparking = (() => { const ud = parking.userData; parking.userData = {}; const o = parking.clone(); parking.userData = ud; return o; })(); oparking.position.x = PARK_X[1] + (SPOTS.orchardshed[0] - PARK_X[0]); oparking.visible = false; oparking.userData = { kind: 'parking', loc: 'orchard' }; scene.add(oparking);
  const oparkBays = oparking.children.slice(0, PARK_X.length);
  function setOParking(cap, built = cap > 1) { oparking.visible = built; oparkBays.forEach((b, k) => (b.visible = k < cap)); oparking.userData.spots = cap; }

  // ---------- v0.41: Windmill (placed once anywhere on owned ground; sails turn gently) ----------
  const windmill = new THREE.Group(); windmill.position.set(SPOTS.windmill[0], 0, SPOTS.windmill[1]); windmill.rotation.y = 0.35; windmill.visible = false; scene.add(windmill);
  const sails = new THREE.Group();
  { const tower = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.7, 2.6, 8), mat('#EFE4CF', { roughness: 0.9 }))); tower.position.y = 1.3; windmill.add(tower);
    const cap = shadowy(new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.7, 8), mat('#B0603A', { roughness: 0.8 }))); cap.position.y = 2.95; windmill.add(cap);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 0.06), woodD); door.position.set(0, 0.3, 0.66); door.rotation.x = -0.08; windmill.add(door);
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), mat('#7FB3C6', { roughness: 0.3 })); win.position.set(0, 1.7, 0.55); windmill.add(win);
    sails.position.set(0, 2.55, 0.62); windmill.add(sails);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 10), woodD); hub.rotation.x = Math.PI / 2; sails.add(hub);
    const cloth = mat('#FFF6E6', { roughness: 0.9, side: THREE.DoubleSide });
    for (let k = 0; k < 4; k++) { const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2; sails.add(arm);
      const spar = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.55, 0.05), woodM)); spar.position.y = 0.8; arm.add(spar);
      const sail = shadowy(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.15), cloth)); sail.position.set(0.2, 0.92, 0.02); arm.add(sail); }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.6, 1.5), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.7; windmill.add(hit); }
  windmill.userData.kind = 'windmill'; windmill.userData.sails = sails;
  frameHooks.push((dt) => { if (windmill.visible) sails.rotation.z -= Math.min(0.1, dt || 0.016) * 0.9; });

  // ---------- v0.41: Billboard across the road — tap to Run ad (traffic boost); bulbs glow while the ad runs ----------
  const billboard = new THREE.Group(); billboard.position.set(SPOTS.billboard[0], 0, SPOTS.billboard[1]); billboard.rotation.y = 0.18; billboard.visible = false; scene.add(billboard);
  const bulbs = [], bbGlow = glowSprite('#FFD27A', 5.2, 0.0);
  { for (const x of [-1.25, 1.25]) { const p = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 0.16), woodD)); p.position.set(x, 1.2, 0); billboard.add(p); }
    const back = shadowy(new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.75, 0.12), woodM)); back.position.set(0, 2.85, -0.05); billboard.add(back);
    // v0.52: the face is a live canvas ad (brand palette, Fraunces/Nunito) — redrawn only when its content changes
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, emissive: '#FFFFFF', emissiveMap: t, emissiveIntensity: 0.05 })); face.position.set(0, 2.85, 0.02); billboard.add(face); billboard.userData.face = face;
    const backFace = new THREE.Mesh(face.geometry, face.material); backFace.position.set(0, 2.85, -0.12); backFace.rotation.y = Math.PI; billboard.add(backFace);   // never a blank board from behind
    // shimmer: a soft diagonal light band sliding across the face while the ad runs (texture offset only, no redraw)
    const sc = document.createElement('canvas'); sc.width = 256; sc.height = 16; { const sg = sc.getContext('2d'), gr = sg.createLinearGradient(0, 0, 256, 0);
      gr.addColorStop(0, 'rgba(255,240,200,0)'); gr.addColorStop(0.42, 'rgba(255,240,200,0)'); gr.addColorStop(0.5, 'rgba(255,246,220,0.85)'); gr.addColorStop(0.58, 'rgba(255,240,200,0)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 256, 16); }
    const st = new THREE.CanvasTexture(sc); st.wrapS = THREE.RepeatWrapping; st.repeat.set(0.5, 1);
    const shimmer = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: st, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    shimmer.position.set(0, 2.85, 0.03); shimmer.rotation.z = 0; billboard.add(shimmer); billboard.userData.shimmer = shimmer;
    billboard.userData.bb = { c, t, mode: '', panel: 0, draws: 0, key: '' };
    const bulbOff = mat('#E9DFC8', { roughness: 0.4 });
    const bulbAt = [];   // v0.52: bulbs all the way round the frame (chasing while the ad runs)
    for (let i = 0; i < 7; i++) bulbAt.push([-1.5 + i * 0.5, 3.78]);
    for (let i = 1; i < 4; i++) bulbAt.push([1.62, 3.78 - i * 0.465]);
    for (let i = 6; i >= 0; i--) bulbAt.push([-1.5 + i * 0.5, 1.92]);
    for (let i = 3; i > 0; i--) bulbAt.push([-1.62, 3.78 - i * 0.465]);
    for (const [x, y] of bulbAt) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), bulbOff.clone()); b.position.set(x, y, 0.08); billboard.add(b); bulbs.push(b); }
    bbGlow.position.set(0, 2.85, 0.4); billboard.add(bbGlow);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.0, 0.8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 2.0; billboard.add(hit); }
  const bbLabel = label('Billboard', { h: 0.5 }); bbLabel.position.set(0, 4.35, 0.1); billboard.add(bbLabel); billboard.userData.label = bbLabel; billboard.userData.kind = 'billboard';
  let bbOn = false;
  let bbInfo = { time: '', top: null };
  const BB_PANEL_MS = 4500, BB_PANELS = 3;
  function bbRedraw(force) {
    const d = billboard.userData.bb, panel = bbOn ? d.panel : 0;
    const key = [bbOn ? 'on' : 'off', panel, bbOn ? bbInfo.time : '', bbInfo.top?.name || ''].join('|');
    if (!force && key === d.key) return; d.key = key; d.mode = bbOn ? 'ad' : 'rent'; d.shown = panel; d.draws++;
    drawBillboard(d.c.getContext('2d'), { on: bbOn, panel, time: bbInfo.time, top: bbInfo.top }); d.t.needsUpdate = true;
  }
  function setBillboard(on, text, info) {
    const was = bbOn; bbOn = !!on; if (text) setLabel(bbLabel, text);
    if (info) bbInfo = { ...bbInfo, ...info };
    if (bbOn && !was) { billboard.userData.bb.panel = 0; billboard.userData.bb.since = performance.now(); }
    bbRedraw();
  }
  if (document.fonts?.ready) document.fonts.ready.then(() => bbRedraw(true));
  document.fonts?.addEventListener?.('loadingdone', () => bbRedraw(true));
  bbRedraw(true);
  // v0.68.1: the Orchard's Billboard across the Orchard road — shares the face, bulbs and glow with the Home one (one ad campaign)
  const obillboard = (() => { const ud = billboard.userData; billboard.userData = {}; const o = billboard.clone(); billboard.userData = ud; return o; })(); obillboard.position.set(SPOTS.obillboard[0], 0, SPOTS.obillboard[1]); obillboard.visible = false; obillboard.userData = { ...billboard.userData, loc: 'orchard' }; scene.add(obillboard);
  frameHooks.push(() => { if (!billboard.visible && !obillboard.visible) return; const t = performance.now() / 1000, d = billboard.userData.bb;
    if (bbOn && performance.now() - (d.since || 0) > BB_PANEL_MS) { d.since = performance.now(); d.panel = (d.panel + 1) % BB_PANELS; bbRedraw(); }
    bulbs.forEach((b, k) => { const lit = bbOn && ((Math.floor(t * 5) + k) % 3 !== 0); b.material.emissive.set(lit ? '#FFC94A' : '#000000'); b.material.emissiveIntensity = lit ? 1.7 : 0; b.material.color.set(lit ? '#FFF2B0' : '#D9CFBA'); });
    billboard.userData.face.material.emissiveIntensity = bbOn ? 0.32 + 0.08 * Math.sin(t * 3) : 0.04; bbGlow.material.opacity = bbOn ? 0.6 + 0.15 * Math.sin(t * 3) : 0;
    const sh = billboard.userData.shimmer; sh.material.opacity = bbOn ? 0.55 : 0; if (bbOn) sh.material.map.offset.x = ((t * 0.28) % 1.6) - 0.8; });

  // v0.6: the Crate Shelf — two old crates stacked on their sides beside the counter (shown while installed)
  const standShelf = new THREE.Group(); standShelf.position.set(1.98, 0, -0.12); standShelf.rotation.y = -0.22; stand.add(standShelf); standShelf.visible = false;
  const shelfGoods = new THREE.Group(); standShelf.add(shelfGoods);
  {
    const cm = mat('#B98A5A'), cd = mat('#8E6040');
    for (const [y, w] of [[0.0, 0.78], [0.5, 0.66]]) {
      const g = new THREE.Group(); g.position.y = y;
      const back = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w, 0.48, 0.04), cd)); back.position.set(0, 0.24, -0.2); g.add(back);
      for (const sx of [-1, 1]) { const sd = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.48, 0.42), cm)); sd.position.set(sx * (w / 2 - 0.025), 0.24, 0); g.add(sd); }
      for (const yy of [0.02, 0.46]) { const sl = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.42), cm)); sl.position.set(0, yy, 0); g.add(sl); }
      const slat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.05, 0.02), cd); slat.position.set(0, 0.34, 0.21); g.add(slat);
      standShelf.add(g);
    }
    const jarC = ['#E58F94', '#F5D07A', '#B79AD6', '#9BC48A', '#F2A23A'];
    for (let k = 0; k < 8; k++) { const row = k < 4 ? 0 : 1, x = (k % 4 - 1.5) * (row ? 0.14 : 0.17);
      const jar = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 10), mat(jarC[k % 5], { roughness: 0.4 }))); jar.position.set(x, 0.13 + row * 0.5, 0.02); shelfGoods.add(jar);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 10), mat('#F7F1E3')); lid.position.set(x, 0.225 + row * 0.5, 0.02); shelfGoods.add(lid); }
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), mat('#FFF6E6')); tag.position.set(0, 0.85, 0.215); standShelf.add(tag);
  }
  function setStandShelf(on, filled) { standShelf.visible = !!on; shelfGoods.visible = !!filled; }
  function setStandStock(f) { crates[0].visible = !!f.heart; crates[1].visible = !!f.sun; crates[2].visible = !!f.moon; }

  // ---------- Supply market (boarded up until unlocked) ----------
  const market = new THREE.Group(); market.position.set(SPOTS.market[0], 0, SPOTS.market[1]); market.scale.setScalar(0.86); market.rotation.y = 0.12; scene.add(market);
  const boards = new THREE.Group(), openBits = new THREE.Group();
  {
    const wall = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 1.7), mat('#F2E3CB'))); wall.position.y = 0.8; market.add(wall);
    const trim = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.8), woodL)); trim.position.y = 0.06; market.add(trim);
    const roofG = new THREE.CylinderGeometry(1.25, 1.25, 2.95, 3, 1); roofG.rotateZ(Math.PI / 2);
    const roof = shadowy(new THREE.Mesh(roofG, mat('#8FAF86'))); roof.scale.set(1, 0.62, 0.86); roof.rotation.x = Math.PI / 2 * 0; roof.position.y = 1.6 + 0.38; roof.rotation.x = Math.PI; roof.rotation.y = 0;
    // orient the triangular prism with its ridge up
    roof.rotation.set(Math.PI / 6 + Math.PI, 0, 0); roof.position.y = 2.15; market.add(roof);
    const chim = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 0.28), mat('#C99A8E'))); chim.position.set(0.8, 2.45, -0.3); market.add(chim);
    const door = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.05, 0.06), woodD)); door.position.set(0, 0.55, 0.86); market.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), mat('#D9A93F')); knob.position.set(0.2, 0.55, 0.9); market.add(knob);
    for (const x of [-0.85, 0.85]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.46, 0.05), mat('#C8E0E8', { emissive: '#FFE1A0', emissiveIntensity: 0.0 })); win.position.set(x, 0.98, 0.86); market.add(win); market.userData['win' + x] = win;
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.08), woodL); fr.position.set(x, 0.72, 0.88); market.add(fr);
      const box = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.22), woodM)); box.position.set(x, 0.62, 0.98); market.add(box);
    }
    // boards across door & windows
    const bm = mat('#A8744A');
    for (const [x, y, w, a] of [[0, 0.75, 0.95, 0.55], [0, 0.42, 0.95, -0.5], [-0.85, 0.98, 0.74, 0.35], [0.85, 0.98, 0.74, -0.35]]) {
      const b = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w, 0.11, 0.04), bm)); b.position.set(x, y, 0.93); b.rotation.z = a; boards.add(b);
    }
    for (let k = 0; k < 7; k++) { const wd = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4 + hash(k, 2) * 0.3, 4), mat('#7FA47D')); wd.position.set(-1.25 + k * 0.42, 0.2, 0.95 + hash(k, 1) * 0.1); wd.rotation.z = (hash(k, 5) - 0.5) * 0.6; boards.add(wd); }
    market.add(boards);
    // open bits: striped awning, seed crates, glow
    for (let i = 0; i < 6; i++) { const s = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.6), mat(i % 2 ? '#FFF6EA' : '#C8E0E8'))); s.position.set(-1.05 + i * 0.42, 1.55, 1.12); s.rotation.x = 0.45; openBits.add(s); }
    for (const [x, c] of [[-1.55, '#F7C5C5'], [1.55, '#F5D07A']]) { const cr = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.45), woodL)); cr.position.set(x, 0.18, 1.15); openBits.add(cr);
      for (let j = 0; j < 4; j++) { const pk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.17, 0.02), mat(j % 2 ? '#FFF9F0' : c)); pk.position.set(x - 0.15 + j * 0.1, 0.42, 1.12); pk.rotation.z = (j - 1.5) * 0.12; openBits.add(pk); } }
    const lt = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat('#FFE1A0', { emissive: '#FFC861', emissiveIntensity: 1.4 })); lt.position.set(0, 1.32, 1.08); openBits.add(lt);
    const lg = glowSprite('#FFCF7A', 1.2, 0.55); lg.position.copy(lt.position); openBits.add(lg); glows.push(lg);
    openBits.visible = false; market.add(openBits);
    const label = label_('Supply Market · Closed', CLOSED_L); label.position.set(0, 3.1, 0.3); market.add(label); market.userData.label = label;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.3, 2.0), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.5; market.add(hit);
  }
  market.userData.kind = 'market';
  // market restoration: boarded -> scaffold (+progress bar) -> open
  const mScaf = makeScaffold(3.1, 2.75, 2.15); mScaf.visible = false; market.add(mScaf);
  const mBar = new THREE.Group(); mBar.position.set(0, 2.98, 1.2); mBar.visible = false; market.add(mBar);
  { const bg = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.05), mat('#FFF9F0')); mBar.add(bg);
    const fg = new THREE.BoxGeometry(1.6, 0.1, 0.06); fg.translate(0.8, 0, 0); const fill = new THREE.Mesh(fg, mat('#F5D07A', { emissive: '#F5D07A', emissiveIntensity: 0.35 })); fill.position.x = -0.8; mBar.add(fill); mBar.userData.fill = fill; }
  let marketState = 'closed', marketPct = -1;
  function setMarketState(state, k = 0) {
    marketState = state;
    boards.visible = state === 'closed' || (state === 'building' && k < 0.45); openBits.visible = state === 'open';
    mScaf.visible = mBar.visible = state === 'building'; mBar.userData.fill.scale.x = Math.max(0.03, Math.min(1, k));
    for (const key of Object.keys(market.userData)) if (key.startsWith('win')) market.userData[key].material.emissiveIntensity = state === 'open' ? 0.55 : state === 'building' ? 0.15 : 0;
    const L = market.userData.label;
    if (state === 'open') setLabel(L, 'Supply Market', OPEN_L);
    else if (state === 'building') { const pct = Math.floor(k * 20) * 5; if (pct !== marketPct) { marketPct = pct; setLabel(L, `Rebuilding · ${pct}%`, { h: 0.46, color: '#8A6418', border: '#F5D07A' }); } L.position.y = 3.45; }
    else setLabel(L, 'Supply Market · Closed', CLOSED_L);
    if (state !== 'building') L.position.y = 3.1;
  }
  function setMarketOpen(open) { setMarketState(open ? 'open' : 'closed'); }

  // ---------- Drying rack ----------
  const rack = new THREE.Group(); rack.position.set(SPOTS.rack[0], 0, SPOTS.rack[1]); rack.rotation.y = -0.25; rack.scale.setScalar(0.82); scene.add(rack);
  const bundles = [];
  {
    for (const x of [-1.1, 1.1]) for (const s of [-1, 1]) { const leg = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.3, 6), woodD)); leg.position.set(x, 1.1, s * 0.32); leg.rotation.x = s * 0.28; rack.add(leg); }
    const bar = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), woodM)); bar.rotation.z = Math.PI / 2; bar.position.y = 2.15; rack.add(bar);
    const bar2 = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), woodM)); bar2.rotation.z = Math.PI / 2; bar2.position.y = 0.55; rack.add(bar2);
    for (let k = 0; k < 3; k++) {
      const g = new THREE.Group(); g.position.set(-0.75 + k * 0.75, 2.12, 0);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 4), mat('#8E6040')); str.position.y = -0.12; g.add(str);
      const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 8), mat('#B7D4B5')); tie.position.y = -0.27; g.add(tie);
      const cone = shadowy(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 9), mat('#F7C5C5'))); cone.rotation.x = Math.PI; cone.position.y = -0.68; g.add(cone);
      for (let j = 0; j < 6; j++) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), cone.material); h.position.set(Math.cos(j) * 0.11, -0.95 - (j % 2) * 0.1, Math.sin(j) * 0.11); h.scale.y = 0.7; g.add(h); }
      const gl = glowSprite('#FFE19A', 1.0, 0.5); gl.position.y = -0.7; gl.visible = false; g.add(gl);
      rack.add(g); bundles.push({ group: g, cone, glow: gl });
    }
    const label = label_('Drying Rack', { h: 0.55 }); label.position.set(0, 2.95, 0); rack.add(label); rack.userData.label = label;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 1.5), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.4; rack.add(hit);
  }
  rack.userData.kind = 'rack'; rack.visible = false;
  function setRack(slots) {
    slots.forEach((s, k) => {
      const b = bundles[k]; if (!b) return;   // v0.63: an upgraded rack has more slots than the 3 drawn bundles
      b.group.visible = !!s; if (!s) return;
      b.cone.material = mat(s.done ? '#C9A08E' : '#F7C5C5');
      b.group.children.forEach((c) => { if (c.isMesh && c.geometry.type === 'SphereGeometry') c.material = mat(s.done ? '#B98E7E' : '#F2AEB3'); });
      b.glow.visible = !!s.done;
    });
  }
  const appearing = new Set();   // v0.64.1: every object mid pop-in (was a fixed list that left out the Orchard Stand, so it stayed at 1% scale)
  function appear(obj, animate) {
    obj.visible = true;
    if (animate) { appearing.add(obj); obj.userData.appear = performance.now(); obj.userData.baseScale = obj.userData.baseScale || obj.scale.x; obj.scale.setScalar(0.01); poof(obj.position.clone().setY(0.8), '#E9D9B8', 22, 2.0); poof(obj.position.clone().setY(1.2), '#F7C5C5', 12, 1.5); }
  }

  // ---------- v0.3: build animation (scaffold rises, sawdust, structure pops in) ----------
  const builds = [];
  // v0.63: a stand under construction wears a scaffold (made once per stand, then just shown / hidden) and a 'Building · N%' label
  function setCons(obj, size, k) {
    if (!obj) return; const u = obj.userData, L = u.label || obj.children.find((c) => c.isSprite);
    if (k == null) { if (u.consSc) u.consSc.visible = false; if (L && u.consBase) { setLabel(L, u.consBase.text, u.consBase.opts); u.consBase = null; } u.consPct = -1; return; }
    if (!u.consSc) { u.consSc = makeScaffold(...size); obj.add(u.consSc); }
    u.consSc.visible = true;
    const pct = Math.floor(Math.min(0.99, k) * 20) * 5;
    if (L) { if (!u.consBase) u.consBase = { text: L.userData.text, opts: L.userData.opts }; if (u.consPct !== pct) { u.consPct = pct; setLabel(L, `Building · ${pct}%`, { h: 0.46, color: '#8A6418', border: '#F5D07A' }); } }
  }
  function buildAnim(obj, size, onDone) {
    const sc = makeScaffold(...size); sc.position.copy(obj.position); sc.rotation.y = obj.rotation.y; sc.scale.set(obj.scale.x, 0.01, obj.scale.z); scene.add(sc);
    obj.visible = false; builds.push({ t0: performance.now(), sc, obj, size, onDone, puffs: 0, shown: false });
  }
  function updateBuilds(now) {
    for (let k = builds.length - 1; k >= 0; k--) {
      const b = builds[k], dt = (now - b.t0) / 1000, s0 = b.obj.userData.baseScale || b.obj.scale.x;
      if (dt < 0.8) b.sc.scale.y = s0 * Math.max(0.01, easeOut(dt / 0.8)); else if (dt < 1.9) b.sc.scale.y = s0;
      while (b.puffs < 7 && dt > 0.45 + b.puffs * 0.2) { b.puffs++; const p = b.obj.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * b.size[0], 0.3 + Math.random() * b.size[1] * 0.7, (Math.random() - 0.5) * b.size[2] * 0.8)); poof(p, '#EBD5AA', 9, 0.9); if (b.puffs % 2) poof(p, '#F6E8CC', 5, 0.6); }
      if (dt > 1.9 && !b.shown) { b.shown = true; b.obj.userData.baseScale = s0; appear(b.obj, true); }
      if (dt > 1.9) { const q = Math.min(1, (dt - 1.9) / 0.5); b.sc.scale.y = s0 * Math.max(0.01, 1 - q); }
      if (dt > 2.45) { scene.remove(b.sc); builds.splice(k, 1); b.onDone?.(); }
    }
  }

  // ---------- v0.3: blueprints (ghost of a structure you can build) ----------
  const bpMat = new THREE.MeshBasicMaterial({ color: '#F5D07A', transparent: true, opacity: 0.3, depthWrite: false });
  const bpPad = new THREE.MeshBasicMaterial({ color: '#FFE7A6', transparent: true, opacity: 0.35, depthWrite: false });
  const blueprints = {}; const bpGroup = new THREE.Group(); scene.add(bpGroup);
  function shownUnder(m, root) { let o = m; while (o && o !== root) { if (!o.visible) return false; o = o.parent; } return true; }
  function makeBlueprint(src, id, text, padW, padD) {
    src.updateMatrixWorld(true); const inv = src.matrixWorld.clone().invert();
    const g = new THREE.Group(); g.position.copy(src.position); g.rotation.copy(src.rotation); g.scale.copy(src.scale);
    src.traverse((m) => {
      if (!m.isMesh || !shownUnder(m, src)) return;
      const hidden = m.material.visible === false; const c = new THREE.Mesh(m.geometry, hidden ? m.material : bpMat);
      inv.clone().multiply(m.matrixWorld).decompose(c.position, c.quaternion, c.scale); c.renderOrder = 4; g.add(c);
    });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(padW, padD), bpPad); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.04; g.add(pad);
    const L = label(text, { h: 0.5, color: '#8A6418', border: '#F5D07A' }); L.position.set(0, 3.25, 0.3); L.material.depthTest = false; L.renderOrder = 11; g.add(L);
    g.userData = { kind: 'blueprint', id }; g.visible = false; bpGroup.add(g); blueprints[id] = g; return g;
  }
  function setBlueprint(id, on) { const g = blueprints[id]; if (g && g.visible !== on) { g.visible = on; if (on) poof(g.position.clone().setY(0.4), '#F5D07A', 10, 1.2); } }

  // ---------- v0.3: found items on the ground (sparkle, tap to collect) ----------
  const lootG = new THREE.Group(); scene.add(lootG); const loots = new Map();
  const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 60); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,236,170,.9)'); grd.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = grd; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? 11 : 60; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const rust = mat('#B07A55'), metal = mat('#9AA3A6'), weath = mat('#A89A86'), terra = mat('#C9876A'), glass = mat('#BFDCCF', { roughness: 0.2, transparent: true, opacity: 0.85 });
  const M = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = shadowy(new THREE.Mesh(geo, m)); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
  function findMesh(kind) {
    const g = new THREE.Group(); const c = FIND_COLORS[kind] || '#C9A67E'; const cm = mat(c);
    switch (kind) {
      case 'watering_can': g.add(M(new THREE.CylinderGeometry(0.15, 0.17, 0.26, 10), cm, 0, 0.13), M(new THREE.CylinderGeometry(0.025, 0.035, 0.36, 6), cm, 0.2, 0.2, 0, 0, 0, -0.9), M(new THREE.TorusGeometry(0.1, 0.02, 5, 10, Math.PI), cm, -0.02, 0.27, 0)); break;
      case 'wheelbarrow': g.add(M(new THREE.BoxGeometry(0.5, 0.16, 0.34), cm, 0, 0.24), M(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), mat('#5A4A44'), 0.3, 0.11, 0, Math.PI / 2), M(new THREE.BoxGeometry(0.5, 0.03, 0.03), woodD, -0.35, 0.22, 0.13), M(new THREE.BoxGeometry(0.5, 0.03, 0.03), woodD, -0.35, 0.22, -0.13)); break;
      case 'old_crate': g.add(M(new THREE.BoxGeometry(0.42, 0.28, 0.32), cm, 0, 0.14, 0, 0, 0.3), M(new THREE.BoxGeometry(0.44, 0.04, 0.34), woodD, 0, 0.2, 0, 0, 0.3)); break;
      case 'flower_pot': g.add(M(new THREE.CylinderGeometry(0.15, 0.1, 0.24, 10), cm, 0, 0.1, 0, 0, 0, 1.2), M(new THREE.BoxGeometry(0.1, 0.06, 0.08), cm, 0.25, 0.03, 0.08, 0.4, 0.3)); break;
      case 'lantern': g.add(M(new THREE.BoxGeometry(0.16, 0.24, 0.16), metal, 0, 0.12, 0, 0, 0, 0.3), M(new THREE.ConeGeometry(0.13, 0.1, 4), metal, -0.04, 0.27, 0, 0, Math.PI / 4, 0.3), M(new THREE.BoxGeometry(0.12, 0.16, 0.17), glass, 0, 0.12, 0, 0, 0, 0.3)); break;
      case 'bench': g.add(M(new THREE.BoxGeometry(0.66, 0.05, 0.2), cm, 0, 0.16, 0, 0, 0, 0.12), M(new THREE.BoxGeometry(0.05, 0.16, 0.18), cm, -0.25, 0.07), M(new THREE.BoxGeometry(0.05, 0.12, 0.18), cm, 0.25, 0.06), M(new THREE.BoxGeometry(0.6, 0.14, 0.04), cm, 0.05, 0.08, 0.16, -1.2)); break;
      case 'gnome': g.add(M(new THREE.ConeGeometry(0.11, 0.24, 8), cm, 0, 0.1, 0, 0, 0, 1.4), M(new THREE.SphereGeometry(0.075, 8, 6), mat('#E9CDB4'), -0.14, 0.09, 0), M(new THREE.ConeGeometry(0.07, 0.18, 8), mat('#D99A9A'), -0.27, 0.1, 0, 0, 0, 1.5)); break;
      case 'fencing': g.add(M(new THREE.TorusGeometry(0.2, 0.014, 4, 18), metal, 0, 0.1, 0, 1.2, 0.3), M(new THREE.TorusGeometry(0.15, 0.014, 4, 16), metal, 0.08, 0.12, 0.05, 0.6, 1.1), M(new THREE.TorusGeometry(0.12, 0.012, 4, 14), metal, -0.08, 0.08, -0.04, 1.6, 0.4)); break;
      case 'bottles': g.add(M(new THREE.CylinderGeometry(0.05, 0.06, 0.24, 8), glass, 0, 0.12), M(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 8), mat('#A9CCB0', { transparent: true, opacity: 0.85, roughness: 0.2 }), 0.14, 0.06, 0.04, 0, 0, 1.4), M(new THREE.CylinderGeometry(0.045, 0.055, 0.2, 8), mat('#C8E0E8', { transparent: true, opacity: 0.85, roughness: 0.2 }), -0.12, 0.1, 0.06)); break;
      case 'roadscrap': case 'scrap_metal': g.add(M(new THREE.BoxGeometry(0.38, 0.03, 0.22), metal, 0, 0.06, 0, 0.2, 0.4, 0.15), M(new THREE.BoxGeometry(0.28, 0.03, 0.16), rust, 0.06, 0.12, -0.04, -0.3, 1.2, 0.2), M(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6), metal, -0.1, 0.05, 0.1, 0, 0, 1.5)); break;
      default: g.add(M(new THREE.BoxGeometry(0.3, 0.2, 0.3), cm, 0, 0.1));
    }
    return g;
  }
  function makeSapling(sc = 1) {
    const g = new THREE.Group();
    g.add(M(new THREE.CylinderGeometry(0.025, 0.035, 0.55, 5), trunkM, 0, 0.27));
    const lm = mat('#9DC48F');
    for (let k = 0; k < 4; k++) { const l = M(leafGeo, lm, Math.cos(k * 1.7) * 0.09, 0.42 + k * 0.06, Math.sin(k * 1.7) * 0.09, 0, k * 1.7, 0.5); l.scale.setScalar(1.6); g.add(l); }
    const top = M(new THREE.SphereGeometry(0.1, 8, 6), lm, 0, 0.62); top.scale.y = 1.3; g.add(top);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#8C6545')); mound.scale.y = 0.35; mound.receiveShadow = true; g.add(mound);
    g.add(M(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), woodD, 0.1, 0.35, 0));
    g.scale.setScalar(sc); g.userData.leaf = '#9DC48F'; return g;
  }
  function addLoot(key, kind, x, z, animate) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const item = kind === 'sapling' ? makeSapling(0.8) : findMesh(kind); item.rotation.y = hash(x, z) * 6; g.add(item);
    const gl = glowSprite('#FFE7A0', 1.25, 0.6); gl.position.y = 0.3; g.add(gl);
    const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, depthTest: false })); st.scale.setScalar(0.6); st.position.y = 0.95; st.renderOrder = 9; g.add(st);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.4; g.add(hit);
    g.userData = { kind: 'loot', key }; lootG.add(g); loots.set(key, { g, st, ph: hash(z, x) * 6, born: animate ? performance.now() : 0 });
    if (animate) { g.scale.setScalar(0.01); poof(new THREE.Vector3(x, 0.5, z), '#F5D07A', 14, 1.1); }
  }
  function removeLoot(key) { const l = loots.get(key); if (!l) return; poof(l.g.position.clone().setY(0.5), '#F5D07A', 16, 1.2); poof(l.g.position.clone().setY(0.4), '#FFF9F0', 8, 0.8); lootG.remove(l.g); loots.delete(key); }

  // ---------- v0.3: decor you place in the garden ----------
  const decorG = new THREE.Group(); scene.add(decorG); const decors = new Map();
  function makeDecor(type) {
    const g = new THREE.Group(); let hitH = 1.2;
    switch (type) {
      case 'planter': { g.add(M(new THREE.CylinderGeometry(0.34, 0.25, 0.42, 14), terra, 0, 0.21), M(new THREE.TorusGeometry(0.33, 0.04, 6, 16), mat('#D99A7E'), 0, 0.42, 0, Math.PI / 2));
        const b = M(canopyGeo, mat('#9DC48F'), 0, 0.55); b.scale.set(0.3, 0.22, 0.3); g.add(b);
        for (let k = 0; k < 7; k++) g.add(M(new THREE.IcosahedronGeometry(0.06, 0), mat(['#F7C5C5', '#F5D07A', '#FFF9F0'][k % 3]), Math.cos(k * 0.9) * 0.22, 0.66 + (k % 2) * 0.06, Math.sin(k * 0.9) * 0.22)); hitH = 0.9; break; }
      case 'lantern': { g.add(M(new THREE.CylinderGeometry(0.045, 0.06, 1.5, 6), woodD, 0, 0.75), M(new THREE.BoxGeometry(0.34, 0.04, 0.04), woodD, 0.14, 1.48, 0));
        const lb = M(new THREE.BoxGeometry(0.18, 0.24, 0.18), mat('#FFE1A0', { emissive: '#FFC861', emissiveIntensity: 1.3 }), 0.27, 1.28, 0); g.add(lb, M(new THREE.ConeGeometry(0.16, 0.1, 4), mat('#6E6A60'), 0.27, 1.45, 0, 0, Math.PI / 4));
        const gl = glowSprite('#FFCF7A', 1.3, 0.55); gl.position.set(0.27, 1.28, 0); g.add(gl); glows.push(gl); hitH = 1.7; break; }
      case 'bench': { const wm = woodL; g.add(M(new THREE.BoxGeometry(1.25, 0.07, 0.42), wm, 0, 0.45), M(new THREE.BoxGeometry(1.25, 0.32, 0.06), wm, 0, 0.72, -0.2, -0.12));
        for (const x of [-0.52, 0.52]) for (const z of [-0.16, 0.16]) g.add(M(new THREE.BoxGeometry(0.07, 0.45, 0.07), woodD, x, 0.22, z));
        for (const x of [-0.62, 0.62]) g.add(M(new THREE.BoxGeometry(0.06, 0.06, 0.44), woodD, x, 0.62, 0)); hitH = 1; break; }
      case 'gnome': { g.add(M(new THREE.ConeGeometry(0.2, 0.42, 10), mat('#8FAF86'), 0, 0.21), M(new THREE.SphereGeometry(0.12, 10, 8), mat('#F2CDB4'), 0, 0.5), M(new THREE.ConeGeometry(0.11, 0.3, 10), mat('#FFF9F0'), 0, 0.38, 0.07, 0.35), M(new THREE.ConeGeometry(0.13, 0.36, 10), mat('#E58F94'), 0, 0.72, -0.02, -0.15), M(new THREE.SphereGeometry(0.03, 6, 5), mat('#F2A9AE'), 0, 0.5, 0.12)); hitH = 1; break; }
      case 'trellis': { for (const x of [-0.45, 0.45]) g.add(M(new THREE.BoxGeometry(0.07, 1.6, 0.07), woodD, x, 0.8, 0));
        for (let k = 0; k < 4; k++) { g.add(M(new THREE.BoxGeometry(1.25, 0.03, 0.03), metal, 0, 0.35 + k * 0.34, 0, 0, 0, 0.6)); g.add(M(new THREE.BoxGeometry(1.25, 0.03, 0.03), metal, 0, 0.35 + k * 0.34, 0, 0, 0, -0.6)); }
        g.add(M(new THREE.BoxGeometry(1.0, 0.05, 0.05), woodD, 0, 1.58, 0));
        for (let k = 0; k < 14; k++) g.add(M(k % 3 ? leafGeo : new THREE.IcosahedronGeometry(0.07, 0), mat(k % 3 ? '#8DB486' : ['#F7C5C5', '#F2AEB3'][k % 2]), (hash(k, 1) - 0.5) * 0.85, 0.3 + hash(k, 2) * 1.2, 0.05, 0, hash(k, 3) * 6, 0)); hitH = 1.7; break; }
      case 'chime': { g.add(M(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6), woodD, 0, 0.8), M(new THREE.BoxGeometry(0.7, 0.04, 0.04), woodD, 0.25, 1.55, 0));
        ['#C8E0E8', '#B7D4B5', '#F7C5C5', '#F5D07A'].forEach((c, k) => { const x = 0.0 + k * 0.17; g.add(M(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 3), woodD, x, 1.42, 0)); g.add(M(new THREE.CylinderGeometry(0.045, 0.055, 0.2 + (k % 2) * 0.06, 8), mat(c, { transparent: true, opacity: 0.85, roughness: 0.15, emissive: c, emissiveIntensity: 0.15 }), x, 1.2 - (k % 2) * 0.05, 0)); }); hitH = 1.7; break; }
      case 'vane': { const cu = mat('#C98B5E', { metalness: 0.3, roughness: 0.5 });
        g.add(M(new THREE.CylinderGeometry(0.04, 0.06, 1.7, 6), woodD, 0, 0.85), M(new THREE.BoxGeometry(0.8, 0.04, 0.04), cu, 0, 1.75, 0), M(new THREE.ConeGeometry(0.07, 0.16, 4), cu, 0.44, 1.75, 0, 0, 0, -Math.PI / 2), M(new THREE.BoxGeometry(0.04, 0.2, 0.18), cu, -0.38, 1.78, 0));
        const bird = M(new THREE.SphereGeometry(0.13, 8, 6), cu, 0, 1.92, 0); bird.scale.set(1.4, 0.9, 0.35); g.add(bird, M(new THREE.ConeGeometry(0.08, 0.2, 4), cu, -0.18, 2.0, 0, 0, 0, 0.9));
        for (const [x, z] of [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) g.add(M(new THREE.BoxGeometry(0.03, 0.03, 0.03), cu, x, 1.55, z)); hitH = 2.1; break; }
    }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.0, hitH, 0.9), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = hitH / 2; g.add(hit);
    return g;
  }
  function addDecor(key, type, x, z, rot = 0, animate = false) {
    const g = makeDecor(type); g.position.set(x, 0, z); g.rotation.y = rot; g.userData = { kind: 'decor', key }; decorG.add(g); decors.set(key, g);
    if (animate) { g.userData.born = performance.now(); g.scale.setScalar(0.01); poof(new THREE.Vector3(x, 0.4, z), '#F5D07A', 14, 1.2); poof(new THREE.Vector3(x, 0.3, z), '#F7C5C5', 8, 1); }
  }
  function removeDecor(key) { const g = decors.get(key); if (!g) return; poof(g.position.clone().setY(0.4), '#E9D9B8', 12, 1); decorG.remove(g); decors.delete(key); }

  // ---------- v0.3: trees you plant (slow growth, chop for extra Wood) ----------
  const GROWN_SC = [0, 0.42, 0.72, 1.08];
  function grownModel(o, stage) {
    if (stage === 0) return makeSapling(1.1);
    const r = mulberry(o.def.k); return makeTree(GROWN_SC[stage], o.def.k % 8, r, stage >= 3 ? 3 : 2);
  }
  function addGrown(id, x, z, stage, state = 'full') {
    const def = { id, x, z, s: 1.08, type: 'tree', lot: 'grown', k: Math.floor(hash(x * 3.1, z * 1.7) * 1e6) };
    const o = { def, group: null, stump: makeStump(def.s * 0.95), state, stage: -1, grown: true };
    o.stump.position.set(x, 0, z); o.stump.rotation.y = hash(z, x) * 6; o.stump.userData.kind = 'obstacle'; o.stump.userData.id = id; o.stump.visible = state === 'stump'; woods.add(o.stump);
    obs.set(id, o); setGrown(id, stage, false);
  }
  function setGrown(id, stage, animate = true) {
    const o = obs.get(id); if (!o || o.stage === stage || o.busy) return;
    if (o.group) woods.remove(o.group);
    o.group = grownModel(o, stage); o.group.position.set(o.def.x, 0, o.def.z); o.group.rotation.y = hash(o.def.x, o.def.z) * 6.28;
    o.group.userData.kind = 'obstacle'; o.group.userData.id = id; o.group.visible = o.state === 'full'; woods.add(o.group); o.stage = stage;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.4, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.7; o.group.add(hit);
    if (animate) { o.group.userData.born = performance.now(); o.group.scale.setScalar(0.01); poof(new THREE.Vector3(o.def.x, 0.8 + stage * 0.5, o.def.z), '#A7C99B', 14, 1.1, true); poof(new THREE.Vector3(o.def.x, 1, o.def.z), '#F5D07A', 6, 0.8); }
  }
  function removeGrown(id) { const o = obs.get(id); if (!o) return; if (o.group) woods.remove(o.group); woods.remove(o.stump); obs.delete(id); }

  // ---------- Particles ----------
  const parts = []; const partGeo = new THREE.IcosahedronGeometry(0.08, 0); const leafGeo = new THREE.SphereGeometry(0.09, 5, 4); leafGeo.scale(1, 0.35, 1.5);
  function poof(pos, color, n = 18, spread = 1.4, leafy = false) {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(leafy ? leafGeo : partGeo, mat(color)); m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.5, (Math.random() - 0.5) * 0.6));
      const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random()) * spread;
      m.userData.v = new THREE.Vector3(Math.cos(a) * sp, 1.2 + Math.random() * 2.2, Math.sin(a) * sp); m.userData.life = 0; m.userData.max = 0.7 + Math.random() * 0.6;
      m.userData.spin = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6); m.userData.s0 = 0.7 + Math.random() * 0.9; m.userData.leafy = leafy;
      m.scale.setScalar(m.userData.s0); scene.add(m); parts.push(m);
    }
  }

  // ---------- Obstacle animations ----------
  const anims = [];
  function chop(id, onDone) {
    const o = obs.get(id); if (!o || o.state !== 'full' || o.busy) return false; o.busy = true;
    const dir = new THREE.Vector3(o.def.x - camera.position.x, 0, o.def.z - camera.position.z).normalize();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.2);
    anims.push({ t0: performance.now(), type: 'chop', o, axis: new THREE.Vector3(dir.z, 0, -dir.x), dir, onDone });
    poof(new THREE.Vector3(o.def.x, 0.6, o.def.z), '#E2C9A0', 8, 0.8);
    return true;
  }
  function clearObstacle(id, onDone) { // stumps, bushes, rocks
    const o = obs.get(id); if (!o || o.busy || o.state === 'gone') return false; o.busy = true;
    anims.push({ t0: performance.now(), type: 'dig', o, target: o.state === 'stump' ? o.stump : o.group, onDone });
    return true;
  }
  function updateAnims(now) {
    for (let k = anims.length - 1; k >= 0; k--) {
      const a = anims[k], dt = (now - a.t0) / 1000, o = a.o;
      if (a.type === 'chop') {
        const g = o.group; const baseQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(o.def.x, o.def.z) * 6.28);
        if (dt < 0.42) { const w = Math.sin(dt * 38) * 0.09 * (1 - dt / 0.42); g.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(a.axis, w)).multiply(baseQ); }
        else if (dt < 1.1) { const k2 = (dt - 0.42) / 0.68; const ang = k2 * k2 * Math.PI * 0.47; g.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(a.axis, ang)).multiply(baseQ); if (!a.stumped) { a.stumped = true; o.stump.visible = true; o.stump.scale.setScalar(0.01); o.stump.userData.born = now; } }
        else {
          const top = new THREE.Vector3(o.def.x, 0.4, o.def.z).addScaledVector(a.dir, 2.4 * o.def.s);
          poof(top, g.userData.leaf, 26, 1.7, true); poof(top.clone().addScaledVector(a.dir, 0.8), '#F7C5C5', 6, 1.2, true); poof(new THREE.Vector3(o.def.x, 0.3, o.def.z), '#E2C9A0', 10, 1);
          g.visible = false; o.state = 'stump'; o.busy = false; anims.splice(k, 1); a.onDone?.();
        }
      } else if (a.type === 'dig') {
        const k2 = Math.min(1, dt / 0.38); const t = a.target; const s0 = o.state === 'stump' ? (o.def.type === 'stump' ? o.def.s : o.def.s * 0.95) : 1;
        t.scale.set(s0 * (1 + 0.25 * Math.sin(k2 * Math.PI)) * (1 - k2 * 0.9), s0 * (1 - k2), s0 * (1 + 0.25 * Math.sin(k2 * Math.PI)) * (1 - k2 * 0.9));
        if (k2 >= 1) {
          poof(new THREE.Vector3(o.def.x, 0.3, o.def.z), o.state === 'stump' ? '#C9A67E' : o.group.userData.leaf, 18, 1.3, o.def.type === 'bush');
          poof(new THREE.Vector3(o.def.x, 0.2, o.def.z), '#B9946A', 8, 0.9);
          t.visible = false; o.state = 'gone'; o.busy = false; anims.splice(k, 1); a.onDone?.();
        }
      }
    }
  }

  // ---------- Cars ----------
  const cars = [];
  const CAR_COLS = ['#F7C5C5', '#C8E0E8', '#F5D07A', '#B7D4B5', '#E3D3EE', '#F2B9A0'];
  const bodyG = roundedBox(2.0, 0.55, 1.0, 0.2), cabG = roundedBox(1.15, 0.52, 0.86, 0.18), bumpG = roundedBox(0.14, 0.16, 1.02, 0.06);
  const wheelG = new THREE.CylinderGeometry(0.2, 0.2, 0.16, 14); wheelG.rotateX(Math.PI / 2);
  const hubG = new THREE.CylinderGeometry(0.09, 0.09, 0.17, 10); hubG.rotateX(Math.PI / 2);
  // v0.63: every car part shares ONE geometry (cars used to build 7–8 new geometries each and never dispose them, so GPU
  // buffers grew with every customer — part of the iOS Safari memory crash)
  const sideG = new THREE.BoxGeometry(0.86, 0.26, 0.9), windG = new THREE.BoxGeometry(0.06, 0.28, 0.66), lampG = new THREE.SphereGeometry(0.075, 10, 8),
    headG = new THREE.SphereGeometry(0.14, 12, 10), hairG = new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), roofG = new THREE.BoxGeometry(0.7, 0.05, 0.6), boxG = roundedBox(0.5, 0.22, 0.4, 0.06);
  function makeCar(col) {
    const g = new THREE.Group();
    const body = shadowy(new THREE.Mesh(bodyG, mat(col, { roughness: 0.5 }))); body.position.y = 0.5; g.add(body);
    const cab = shadowy(new THREE.Mesh(cabG, mat('#FFF9F0', { roughness: 0.5 }))); cab.position.set(-0.12, 0.96, 0); g.add(cab);
    const glass = mat('#A9CCD8', { roughness: 0.15, metalness: 0.1 });
    const side = new THREE.Mesh(sideG, glass); side.position.set(-0.12, 1.0, 0); g.add(side);
    const wind = new THREE.Mesh(windG, glass); wind.position.set(0.46, 0.99, 0); wind.rotation.z = 0.25; g.add(wind);
    for (const x of [1.0, -1.0]) { const b = new THREE.Mesh(bumpG, mat('#FFF9F0')); b.position.set(x, 0.36, 0); g.add(b); }
    for (const z of [0.28, -0.28]) { const h = new THREE.Mesh(lampG, mat('#FFF6D8', { emissive: '#FFE1A0', emissiveIntensity: 0.9 })); h.position.set(1.0, 0.56, z); g.add(h); }
    const wheels = [];
    for (const x of [0.62, -0.62]) for (const z of [0.46, -0.46]) { const w = shadowy(new THREE.Mesh(wheelG, mat('#5A4A44'))); w.position.set(x, 0.2, z); g.add(w); const hb = new THREE.Mesh(hubG, mat('#FFF9F0')); w.add(hb); wheels.push(w); }
    const head = new THREE.Mesh(headG, mat(['#F2CDB4', '#D9A988', '#A77B5B', '#F7D9C4'][Math.floor(Math.random() * 4)])); head.position.set(0.02, 1.02, 0.18); g.add(head);
    const hair = new THREE.Mesh(hairG, mat(['#6B4B3A', '#3B3330', '#C98B4E', '#8E6A4E'][Math.floor(Math.random() * 4)])); hair.position.copy(head.position).setY(1.05); g.add(hair);
    const rack = new THREE.Mesh(roofG, woodD); rack.position.set(-0.15, 1.25, 0); g.add(rack);
    if (Math.random() < 0.5) { const bx = new THREE.Mesh(boxG, mat(['#F5D07A', '#B7D4B5', '#F7C5C5'][Math.floor(Math.random() * 3)])); bx.position.set(-0.15, 1.38, 0); g.add(bx); }
    g.userData.wheels = wheels;
    return g;
  }
  function spawnCar({ stopX = null, onPark, dir = 1, color, behind = 0, ox = 0 } = {}) {   // v0.61: ox = the road's x offset (the Orchard road is at ORCH_X)   // v0.52: behind = car lengths back (group arrivals drive in nose to tail)
    const g = makeCar(color || CAR_COLS[Math.floor(Math.random() * CAR_COLS.length)]);
    const z = dir > 0 ? ROAD.near : ROAD.far; const x0 = ox + (dir > 0 ? -46 : 46) - dir * behind * 3.2;
    g.position.set(x0, 0, z); g.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(g);
    const car = { group: g, dir, stopX, onPark, ox, state: stopX != null ? 'in' : 'pass', v: 9, x: x0, bob: Math.random() * 10, leave() { car.state = 'out'; car.v = 0.5; } };
    cars.push(car); return car;
  }
  // v0.52: the water truck (Supply Market › Fill Rain Barrels) — a little tanker that drives up the near lane, parks, then leaves.
  function makeTruck() {
    const g = new THREE.Group(), wheels = [];
    const chassis = shadowy(new THREE.Mesh(roundedBox(3.1, 0.3, 1.1, 0.1), mat('#5A6B70', { roughness: 0.6 }))); chassis.position.set(-0.15, 0.42, 0); g.add(chassis);
    const cab = shadowy(new THREE.Mesh(roundedBox(0.95, 0.95, 1.08, 0.16), mat('#5E97AA', { roughness: 0.45 }))); cab.position.set(1.0, 0.98, 0); g.add(cab);
    const glass = mat('#CFE6EE', { roughness: 0.15, metalness: 0.1 });
    const wind = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.86), glass); wind.position.set(1.48, 1.18, 0); g.add(wind);
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 1.1), glass); side.position.set(1.05, 1.2, 0); g.add(side);
    const tankG = new THREE.CylinderGeometry(0.58, 0.58, 2.0, 22); tankG.rotateZ(Math.PI / 2);
    const tank = shadowy(new THREE.Mesh(tankG, mat('#EEF2EE', { roughness: 0.35, metalness: 0.15 }))); tank.position.set(-0.55, 1.12, 0); g.add(tank);
    const bandG = new THREE.CylinderGeometry(0.6, 0.6, 0.22, 22); bandG.rotateZ(Math.PI / 2);
    for (const x of [-1.2, 0.1]) { const bd = new THREE.Mesh(bandG, mat('#5E97AA')); bd.position.set(x, 1.12, 0); g.add(bd); }
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), mat('#7FB9D0', { roughness: 0.3 })); drop.scale.set(1, 1.3, 0.25); drop.position.set(-0.55, 1.12, 0.58); g.add(drop);
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 18), mat('#3B3330')); hose.position.set(-1.62, 0.95, 0); hose.rotation.y = Math.PI / 2; g.add(hose);
    for (const z of [0.3, -0.3]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mat('#FFF6D8', { emissive: '#FFE1A0', emissiveIntensity: 0.9 })); h.position.set(1.49, 0.7, z); g.add(h); }
    for (const x of [1.0, -0.35, -1.15]) for (const z of [0.5, -0.5]) { const w = shadowy(new THREE.Mesh(wheelG, mat('#5A4A44'))); w.position.set(x, 0.2, z); g.add(w); const hb = new THREE.Mesh(hubG, mat('#FFF9F0')); w.add(hb); wheels.push(w); }
    g.userData.wheels = wheels; g.userData.truck = true;
    return g;
  }
  function spawnTruck({ stopX = -8, onPark, x0 = -34 } = {}) {
    const g = makeTruck(); g.position.set(x0, 0, ROAD.near); scene.add(g);
    const car = { group: g, dir: 1, stopX, onPark, state: 'in', v: 9, x: x0, bob: Math.random() * 10, truck: true, leave() { car.state = 'out'; car.v = 0.5; } };
    cars.push(car); return car;
  }
  function updateCars(dt, t) {
    for (let k = cars.length - 1; k >= 0; k--) {
      const c = cars[k];
      if (c.van && c.state === 'out') {   // v0.65: timed drive-off too (3 s), then the van is hidden and returned to the pool
        const u = (performance.now() - c.tOut) / 1000, d = u < 2 ? 3 * u * u : 12 + 12 * (u - 2), x = c.stopX + c.dir * d, dx = x - c.x;
        c.x = x; c.group.position.x = x; c.v = Math.min(12, 6 * u); c.group.userData.wheels.forEach((w) => (w.rotation.z -= Math.abs(dx) / 0.2));
        if (u > 3.2) { c.group.visible = false; c.group.userData.busy = false; cars.splice(k, 1); }
        continue; }
      if (c.van && c.state === 'in') {   // v0.65: the van's drive-in is timed (ease-out over T s), so it parks on time even at a low frame rate
        const k = Math.min(1, (performance.now() - c.t0) / 1000 / c.T), x = c.stopX - c.dir * c.from * (1 - k) * (1 - k);
        c.v = (2 * c.from * (1 - k)) / c.T; const dx = x - c.x; c.x = x; c.group.position.x = x; c.group.userData.wheels.forEach((w) => (w.rotation.z -= Math.abs(dx) / 0.2));
        c.group.position.y = 0; if (k >= 1) { c.v = 0; c.state = 'park'; const f = c.onPark; c.onPark = null; f?.(c); }
        continue; }
      if (c.state === 'in') { const d = (c.stopX - c.x) * c.dir; c.v = Math.max(0.0, Math.min(c.van ? 12 : 10, d * (c.van ? 3 : 1.5)));   /* v0.65: the van brakes a little harder */ if (d < 0.03) { c.x = c.stopX; c.v = 0; c.state = 'park'; const f = c.onPark; c.onPark = null; f?.(c); } }
      else if (c.state === 'out') c.v = Math.min(11, c.v + 5 * dt);
      else if (c.state === 'pass') c.v = 8;
      const dx = c.v * dt * c.dir; c.x += dx; c.group.position.x = c.x;
      c.group.userData.wheels.forEach((w) => (w.rotation.z -= Math.abs(dx) / 0.2));
      c.group.position.y = c.v > 0.1 ? Math.abs(Math.sin(t * 14 + c.bob)) * 0.02 : 0;
      if (c.van && c.state === 'out' && (c.x - c.stopX) * c.dir > 28) { c.group.visible = false; c.group.userData.busy = false; cars.splice(k, 1); continue; }   // v0.65: vans are reused, never removed
      if (Math.abs(c.x - (c.ox || 0)) > 48 && c.state !== 'in') { scene.remove(c.group); cars.splice(k, 1); }
    }
  }

  // ---------- v0.65: garden features (Sundial + garden charms) placed on the map ----------
  // Each placed feature builds its own small geometries and disposes them when it is put back in the bag (materials come from
  // the shared mat() cache, so they are never disposed here). Tap target: an invisible cylinder.
  const featG = new THREE.Group(); scene.add(featG); const feats = new Map();
  const C = { cream: '#FFF9F0', stone: '#E9DFCF', stoneD: '#C9B9A0', gold: '#E7B547', goldD: '#B8892E', sage: '#8FAF86', sageD: '#5E7F5A', blush: '#F2B9B4', copper: '#C98B4E', moon: '#C9D6F2', lilac: '#C8B4EA' };
  function makeFeat(id) {
    const g = new THREE.Group(); let hitH = 1.1;
    const post = (h, x = 0) => M(new THREE.CylinderGeometry(0.05, 0.065, h, 8), woodD, x, h / 2);
    switch (id) {
      case 'sundial': { g.add(M(new THREE.CylinderGeometry(0.24, 0.3, 0.5, 10), mat(C.stone), 0, 0.25), M(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 20), mat(C.gold, { roughness: 0.4, metalness: 0.3 }), 0, 0.53));
        const gn = M(new THREE.BoxGeometry(0.03, 0.22, 0.3), mat(C.goldD, { metalness: 0.4, roughness: 0.4 }), 0, 0.64, 0.02); gn.rotation.x = 0.5; g.add(gn); hitH = 0.9; break; }
      case 'gardenbell': { g.add(post(1.25), M(new THREE.BoxGeometry(0.42, 0.05, 0.05), woodD, 0.17, 1.2, 0));
        g.add(M(new THREE.CylinderGeometry(0.05, 0.15, 0.22, 12, 1, true), mat(C.gold, { roughness: 0.35, metalness: 0.5, side: THREE.DoubleSide }), 0.32, 1.03), M(new THREE.SphereGeometry(0.035, 8, 6), mat(C.goldD), 0.32, 0.92)); hitH = 1.4; break; }
      case 'rainchain': { g.add(post(1.35), M(new THREE.BoxGeometry(0.4, 0.05, 0.05), woodD, 0.16, 1.32, 0));
        for (let k = 0; k < 7; k++) { const l = M(new THREE.TorusGeometry(0.045, 0.014, 5, 10), mat(C.copper, { metalness: 0.5, roughness: 0.4 }), 0.32, 1.24 - k * 0.12, 0); l.rotation.y = k % 2 ? Math.PI / 2 : 0; g.add(l); }
        g.add(M(new THREE.CylinderGeometry(0.2, 0.15, 0.14, 14), mat(C.copper, { metalness: 0.4, roughness: 0.45 }), 0.32, 0.07), M(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 14), mat('#9CCFE0', { roughness: 0.15 }), 0.32, 0.13)); hitH = 1.4; break; }
      case 'seedtin': { g.add(M(new THREE.BoxGeometry(0.5, 0.32, 0.5), woodL, 0, 0.16), M(new THREE.BoxGeometry(0.38, 0.22, 0.28), mat(C.sage, { roughness: 0.5, metalness: 0.2 }), 0, 0.43), M(new THREE.BoxGeometry(0.4, 0.05, 0.3), mat(C.sageD, { metalness: 0.2 }), 0, 0.56), M(new THREE.BoxGeometry(0.2, 0.1, 0.01), mat(C.cream), 0, 0.44, 0.145)); hitH = 0.8; break; }
      case 'scales': { g.add(post(1.05), M(new THREE.BoxGeometry(0.7, 0.04, 0.04), mat(C.gold, { metalness: 0.4, roughness: 0.4 }), 0, 1.05));
        for (const x of [-0.32, 0.32]) { g.add(M(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 4), mat(C.goldD), x, 0.89), M(new THREE.CylinderGeometry(0.16, 0.11, 0.05, 14), mat(C.gold, { metalness: 0.45, roughness: 0.35 }), x, 0.72)); }
        g.add(M(new THREE.CylinderGeometry(0.22, 0.26, 0.06, 14), woodD, 0, 0.03)); hitH = 1.2; break; }
      case 'pocketwatch': { g.add(M(new THREE.BoxGeometry(0.34, 0.3, 0.2), woodL, 0, 0.15));
        const case_ = M(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 22), mat(C.gold, { metalness: 0.45, roughness: 0.35 }), 0, 0.62, 0, Math.PI / 2); g.add(case_);
        g.add(M(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 22), mat(C.cream), 0, 0.62, 0.042, Math.PI / 2), M(new THREE.TorusGeometry(0.06, 0.02, 6, 12), mat(C.goldD), 0, 0.97, 0));
        g.add(M(new THREE.BoxGeometry(0.02, 0.17, 0.01), mat('#5A4A44'), 0, 0.69, 0.055), M(new THREE.BoxGeometry(0.12, 0.02, 0.01), mat('#5A4A44'), 0.05, 0.62, 0.055)); hitH = 1.1; break; }
      case 'moonfountain': { g.add(M(new THREE.CylinderGeometry(0.5, 0.56, 0.24, 18), mat(C.stone), 0, 0.12), M(new THREE.CylinderGeometry(0.44, 0.44, 0.03, 18), mat('#A9C4EE', { emissive: '#8C9BE0', emissiveIntensity: 0.45, roughness: 0.1 }), 0, 0.25));
        g.add(M(new THREE.CylinderGeometry(0.07, 0.1, 0.5, 8), mat(C.stone), 0, 0.5), M(new THREE.CylinderGeometry(0.24, 0.16, 0.1, 14), mat(C.stone), 0, 0.78), M(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), mat('#A9C4EE', { emissive: '#8C9BE0', emissiveIntensity: 0.5 }), 0, 0.83));
        const moon = M(new THREE.TorusGeometry(0.13, 0.04, 8, 16, Math.PI * 1.2), mat(C.moon, { emissive: '#C9D6F2', emissiveIntensity: 0.8 }), 0, 1.03, 0, 0, 0, 0.9); g.add(moon); hitH = 1.2; break; }
      case 'faelantern': { g.add(post(1.4), M(new THREE.BoxGeometry(0.36, 0.04, 0.04), woodD, 0.14, 1.36, 0));
        g.add(M(new THREE.OctahedronGeometry(0.15, 0), mat(C.lilac, { emissive: '#B48AD8', emissiveIntensity: 1.1, roughness: 0.3 }), 0.28, 1.12), M(new THREE.ConeGeometry(0.11, 0.1, 6), mat(C.goldD), 0.28, 1.3, 0));
        for (let k = 0; k < 3; k++) g.add(M(new THREE.SphereGeometry(0.025, 6, 4), mat('#FFF3C9', { emissive: '#F5D07A', emissiveIntensity: 1.2 }), 0.28 + Math.cos(k * 2.1) * 0.25, 0.9 + k * 0.12, Math.sin(k * 2.1) * 0.25)); hitH = 1.5; break; }
      default: g.add(M(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat(C.cream), 0, 0.15));
    }
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, hitH, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = hitH / 2; g.add(hit);
    return g;
  }
  const disposeGroup = (g) => g.traverse((o) => { o.geometry?.dispose(); if (o.material && !o.material.visible) o.material.dispose(); });   // shared mat() materials stay
  function addFeat(key, id, x, z, rot = 0, animate = false) {
    removeFeat(key, false);
    const g = makeFeat(id); g.position.set(x, 0, z); g.rotation.y = rot; g.userData = { kind: 'gfeat', key, id }; featG.add(g); feats.set(key, g);
    if (animate) { g.userData.born = performance.now(); g.scale.setScalar(0.01); poof(new THREE.Vector3(x, 0.4, z), '#F5D07A', 14, 1.2); }
  }
  function removeFeat(key, fx = true) { const g = feats.get(key); if (!g) return; if (fx) poof(g.position.clone().setY(0.4), '#E9D9B8', 12, 1); featG.remove(g); feats.delete(key); disposeGroup(g); }

  // ---------- v0.65: the delivery van (Supply Market orders) ----------
  // Two reusable vans (built once, hidden when idle — nothing is created per trip except a few crate meshes that share one
  // geometry + material). A trip: drive in on the near lane, park, drop crates on the verge, drive off.
  const vanPool = [], crateG = roundedBox(0.36, 0.3, 0.36, 0.04), crateM = mat('#D9B98A', { roughness: 0.85 }), crateBand = new THREE.BoxGeometry(0.38, 0.06, 0.38), dropC = [];
  const vanGeo = { body: roundedBox(1.7, 1.0, 1.06, 0.14), cab: roundedBox(0.8, 0.78, 1.04, 0.16), wind: new THREE.BoxGeometry(0.06, 0.34, 0.84), stripe: new THREE.BoxGeometry(1.72, 0.12, 1.08), sign: new THREE.BoxGeometry(0.9, 0.3, 0.02), lamp: new THREE.SphereGeometry(0.07, 8, 6), leaf: new THREE.SphereGeometry(0.09, 8, 6) };
  function makeVan() {
    const g = new THREE.Group(), wheels = [];
    g.add(M(vanGeo.body, mat('#FFF3E2', { roughness: 0.5 }), -0.35, 0.92, 0), M(vanGeo.stripe, mat(C.sage), -0.35, 0.72, 0), M(vanGeo.cab, mat('#F7C5C5', { roughness: 0.45 }), 0.86, 0.78, 0));
    g.add(new THREE.Mesh(vanGeo.wind, mat('#CFE6EE', { roughness: 0.15, metalness: 0.1 }))); g.children[g.children.length - 1].position.set(1.24, 0.95, 0);
    for (const z of [0.54, -0.54]) { const s = M(vanGeo.sign, mat(C.gold), -0.35, 1.1, z); g.add(s); const lf = M(vanGeo.leaf, mat(C.sageD), -0.75, 1.1, z * 1.02); lf.scale.set(1, 0.6, 0.3); g.add(lf); }
    for (const z of [0.3, -0.3]) g.add(M(vanGeo.lamp, mat('#FFF6D8', { emissive: '#FFE1A0', emissiveIntensity: 0.9 }), 1.27, 0.62, z));
    for (const x of [0.86, -0.8]) for (const z of [0.5, -0.5]) { const w = shadowy(new THREE.Mesh(wheelG, mat('#5A4A44'))); w.position.set(x, 0.2, z); g.add(w); const hb = new THREE.Mesh(hubG, mat('#FFF9F0')); w.add(hb); wheels.push(w); }
    g.userData.wheels = wheels; g.userData.van = true; g.visible = false; scene.add(g);
    return g;
  }
  // stopX = where it parks; ox = road offset (Orchard road at ORCH_X); onPark(van) runs once when it stops. Returns null when both vans are out.
  // v0.65: it uses the FAR lane, coming from +x (dir −1), so it never collides with customers parked in the near-lane bays.
  function spawnVan({ stopX = -3.4, ox = 0, onPark, from = 26, dir = -1, T } = {}) {
    let g = vanPool.find((v) => !v.userData.busy); if (!g) { if (vanPool.length >= 2) return null; g = makeVan(); vanPool.push(g); }
    g.userData.busy = true; g.visible = true; const x0 = stopX - dir * from; g.position.set(x0, 0, dir > 0 ? ROAD.near : ROAD.far); g.rotation.y = dir > 0 ? 0 : Math.PI;
    const car = { group: g, dir, stopX, onPark, ox, state: 'in', v: 10, x: x0, bob: Math.random() * 10, van: true, from, t0: performance.now(), T: Math.max(0.8, T || from / 7.5), leave() { car.state = 'out'; car.v = 0.5; car.tOut = performance.now(); } };
    cars.push(car); return car;
  }
  function dropCrates(x, z, n = 1) {
    for (let k = 0; k < Math.min(3, Math.max(1, n)); k++) {
      const c = new THREE.Mesh(crateG, crateM); c.castShadow = true; const band = new THREE.Mesh(crateBand, mat(C.sage)); c.add(band);
      c.position.set(x - 0.5 + k * 0.42, 1.2 + k * 0.25, z); c.userData = { t0: performance.now() + k * 140, y1: 0.15 }; scene.add(c); dropC.push(c);
    }
  }
  function updateCrates(nowMs) {
    for (const g of [bulkHome, bulkOrch]) if (g.userData.pop) { const t = (nowMs - g.userData.pop) / 1000; if (t > 0.5) { g.scale.setScalar(1); g.userData.pop = 0; } else g.scale.set(1 + Math.sin(t * Math.PI * 2) * 0.08 * (1 - t * 2), 1 - Math.sin(t * Math.PI * 2) * 0.1 * (1 - t * 2), 1 + Math.sin(t * Math.PI * 2) * 0.08 * (1 - t * 2)); }
    for (let k = dropC.length - 1; k >= 0; k--) { const c = dropC[k], t = (nowMs - c.userData.t0) / 1000; if (t < 0) continue;
      c.position.y = Math.max(c.userData.y1, c.position.y - t * t * 6 * 0.016 * 10); c.rotation.y = t * 0.6;
      if (t > 2.4) { c.scale.setScalar(Math.max(0.01, 1 - (t - 2.4) * 2.5)); }
      if (t > 2.8) { poof(c.position.clone().setY(0.3), '#E9D9B8', 8, 0.8); scene.remove(c); dropC.splice(k, 1); } }
  }

  // ---------- Motes & droplets ----------
  const NM = 110; const mg = new THREE.BufferGeometry(); const mp = new Float32Array(NM * 3); const mseed = new Float32Array(NM);
  for (let i = 0; i < NM; i++) { mp[i * 3] = (rnd() - 0.5) * 26; mp[i * 3 + 1] = 0.3 + rnd() * 4.5; mp[i * 3 + 2] = -10 + rnd() * 20; mseed[i] = rnd() * 100; }
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.12, map: glowTexture(), color: '#FFE3A3', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(motes);
  const dropGeo = new THREE.SphereGeometry(0.04, 6, 4); dropGeo.scale(1, 1.6, 1);
  const dropM = new THREE.MeshStandardMaterial({ color: '#BFE3EE', roughness: 0.2, transparent: true, opacity: 0.85 });
  const drops = [];

  // ---------- Camera ----------
  const DEF = { az: 0.2, pol: 0.86, zoom: 1 };
  const ctl = { az: DEF.az, pol: DEF.pol, zoom: 1, base: 20, target: new THREE.Vector3(0, 0.3, -0.6), home: new THREE.Vector3(0, 0.3, -0.6), auto: false, glide: null };
  function fitDist() {
    const aspect = camera.aspect, vf = THREE.MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    return Math.max((12.0 / 2) / Math.tan(hf / 2), (10.5 / 2) / Math.tan(vf / 2));
  }
  function updateCamera() {
    const d = ctl.base * ctl.zoom, sp = Math.sin(ctl.pol);
    camera.position.set(ctl.target.x + d * sp * Math.sin(ctl.az), ctl.target.y + d * Math.cos(ctl.pol), ctl.target.z + d * sp * Math.cos(ctl.az));
    camera.lookAt(ctl.target); camera.updateMatrixWorld(); sky.position.copy(camera.position);
    sun.target.position.set(ctl.target.x, 0, ctl.target.z); sun.position.copy(sunDir).multiplyScalar(26).setY(14).add(sun.target.position);
  }
  let locHome = null;   // v0.6: the camera's resting spot for the current location (null = Home)
  function setLocation(target) { locHome = target; resize(); ctl.moved = false; ctl.glide = null; ctl.target.copy(ctl.home); ctl.az = DEF.az; ctl.pol = DEF.pol; ctl.zoom = 1; updateCamera(); }
  function resize() {
    pausedFrames = 0;   // a resized canvas is cleared: draw one fresh frame even while paused
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 46 : 40; camera.updateProjectionMatrix();
    ctl.base = fitDist(); if (locHome) ctl.home.set(locHome[0], 0.3, locHome[2] + (w / h < 0.8 ? 0.6 : 0)); else ctl.home.set(-0.3, 0.3, w / h < 0.8 ? 0.2 : -0.4);
    if (!ctl.moved) ctl.target.copy(ctl.home);
    updateCamera();
  }
  window.addEventListener('resize', resize); resize();
  function glide(to, dur = 1.2, onDone) {
    ctl.glide = { t0: performance.now(), dur: dur * 1000, from: { az: ctl.az, pol: ctl.pol, zoom: ctl.zoom, target: ctl.target.clone() }, to: { az: to.az ?? ctl.az, pol: to.pol ?? ctl.pol, zoom: to.zoom ?? ctl.zoom, target: (to.target || ctl.target).clone() }, onDone };
  }
  function intro(onDone) {
    ctl.az = -0.75; ctl.pol = 0.72; ctl.zoom = 1.55; ctl.target.set(-1, 0.3, -9); updateCamera();
    glide({ az: DEF.az, pol: DEF.pol, zoom: 1, target: ctl.home }, 6.2, onDone);
  }

  // ---------- Picking ----------
  const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  function pick(x, y, mode) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (mode === 'build') { const h = raycaster.intersectObjects(ghostMeshes, false)[0]; return h ? h.object.userData : null; }
    if (mode === 'ground') { const p = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3()); return p ? { kind: 'ground', point: p } : null; }
    const targets = [...tiles.map((t) => t.mesh), ...tiles.map((t) => t.holder), woods, lootG, decorG, featG, bpGroup];
    if (stand.visible) targets.push(stand); if (rack.visible) targets.push(rack); if (tincture.visible) targets.push(tincture); if (still.visible) targets.push(still); if (teastand.visible) targets.push(teastand); if (press.visible) targets.push(press); if (opress.visible) targets.push(opress); if (fruitstand.visible) targets.push(fruitstand); targets.push(orchardG); if (orchardShed.visible) targets.push(orchardShed);   /* v0.65 fix: the Orchard Stand (and its scaffold while it's being built) was never tappable */ if (parking.visible) targets.push(parking); if (oparking.visible) targets.push(oparking); if (obillboard.visible) targets.push(obillboard); if (windmill.visible) targets.push(windmill); if (billboard.visible) targets.push(billboard); targets.push(market); for (const g of barrels.values()) if (g.visible) targets.push(g); for (const g of hives.values()) if (g.visible) targets.push(g); for (const g of workers.values()) if (g.visible) targets.push(g);
    for (const id of Object.keys(lotFx)) if (lotFx[id].fx.visible) targets.push(lotFx[id].sign, lotFx[id].tag);
    const hits = raycaster.intersectObjects(targets, true);
    for (const h of hits) { if (h.object.userData?.tag && visibleChain(h.object)) return { kind: 'lot', id: h.object.userData.id }; }
    for (const h of hits) { const ti = tiles.findIndex((t) => t.icon === h.object); if (ti >= 0 && h.object.visible) return { kind: 'tile', index: ti }; }
    for (const h of hits) { let o = h.object; if (!visibleChain(o)) continue; while (o && o !== lootG) { if (o.userData?.kind === 'loot') return o.userData; o = o.parent; } }
    for (const h of hits) {
      let o = h.object; if (!visibleChain(o)) continue;
      if (o.isSprite && o.material.blending === THREE.AdditiveBlending) continue;
      while (o) {
        if (o.userData?.kind === 'obstacle') return { kind: 'obstacle', id: o.userData.id };
        if (o.userData?.kind) return o.userData;
        const ti = tiles.findIndex((t) => t.holder === o); if (ti >= 0) return { kind: 'tile', index: ti };
        o = o.parent;
      }
    }
    const g = raycaster.intersectObject(ground, false)[0];
    return g ? { kind: 'ground', point: g.point } : null;
  }
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function groundAt(x, y) { ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, camera); return raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3()); }
  function visibleChain(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
  function project(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, behind: p.z > 1 }; }

  // ---------- Plants on tiles ----------
  function setPlant(i, species, stage, watered, variant = '') {   // v0.61: variant = the Blue Lotus barrel's fill
    const t = tiles[i]; const key = species ? `${species}:${stage}:${variant}` : '';
    t.mesh.material.color.copy(watered ? soilWet : soilDry);
    if (t.key === key) return false;
    if (t.plant) { t.holder.remove(t.plant); t.plant = null; }
    t.key = key; return true;
  }
  function attachPlant(i, obj, pop = true) { const t = tiles[i]; t.plant = obj; obj.userData.born = pop ? performance.now() : 0; if (pop) obj.scale.setScalar(0.01); t.holder.add(obj); }
  function setShade(i, v) { const t = tiles[i]; if (!t) return; t.shade.visible = v > 0.06; t.shade.material.opacity = Math.min(0.62, v * 0.7); t.shade.userData.v = v; }
  function setIcon(i, kind) { const t = tiles[i]; if (!kind) { t.icon.visible = false; return; } t.icon.material.map = ICON_TEX[kind]; t.icon.material.needsUpdate = true; t.icon.visible = true; }
  function select(i) {
    if (i == null) { sel.visible = false; selGlow.visible = false; return; }
    const c = tileWorld(i); sel.position.set(c.x, 0.34, c.z); sel.visible = true; selGlow.position.set(c.x, 0.5, c.z); selGlow.visible = true;
  }
  function splash(i) {
    const c = tileWorld(i);
    for (let k = 0; k < 14; k++) { const d = new THREE.Mesh(dropGeo, dropM); d.position.set(c.x + (Math.random() - 0.5) * 0.7, 1.6 + Math.random() * 0.8, c.z + (Math.random() - 0.5) * 0.7); d.userData.v = -1.5 - Math.random() * 1.5; d.userData.floor = 0.35; scene.add(d); drops.push(d); }
  }


  // ---------- v0.4: Sickle sweep + Plow furrows ----------
  const fxs = [];
  const bladeM = new THREE.MeshStandardMaterial({ color: '#CFD6DA', metalness: 0.7, roughness: 0.25, emissive: '#3A4448', transparent: true });
  const handleM = new THREE.MeshStandardMaterial({ color: '#8A5A34', roughness: 0.8, transparent: true });
  const trailM = new THREE.MeshBasicMaterial({ color: '#F7F1D0', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const soilM = new THREE.MeshStandardMaterial({ color: '#5A3B24', roughness: 1, transparent: true });
  const plowM = new THREE.MeshStandardMaterial({ color: '#9AA3A8', metalness: 0.6, roughness: 0.35, transparent: true });
  // centers: [{x,z}] bed centres; sweeps a big sickle blade around each bed in turn, with a bright arc trail.
  function sickleSweep(centers) {
    centers.forEach((c, k) => {
      const g = new THREE.Group(); g.position.set(c.x, 0.75, c.z);
      const blade = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 6, 28, Math.PI * 0.85), bladeM.clone()); blade.rotation.x = -Math.PI / 2; g.add(blade);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 8), handleM.clone()); handle.rotation.z = Math.PI / 2; handle.position.set(1.15, 0, 0); g.add(handle);
      const trail = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 40, 1, 0, 0.01), trailM.clone()); trail.rotation.x = -Math.PI / 2; trail.position.y = -0.05; g.add(trail);
      g.visible = false; scene.add(g);
      fxs.push({ delay: k * 220, dur: 900, obj: g, upd(e) { g.visible = true; g.rotation.y = 1.4 - e * Math.PI * 2.1;
        trail.geometry.dispose(); trail.geometry = new THREE.RingGeometry(0.6, 1.0, 40, 1, 0, Math.max(0.01, Math.min(e, 0.7) * Math.PI * 2.1));
        trail.rotation.z = 0; const fade = e > 0.75 ? 1 - (e - 0.75) / 0.25 : 1; g.traverse((o) => { if (o.material) o.material.opacity = (o === trail ? 0.55 : 1) * fade; });
        if (Math.random() < 0.5) poof(new THREE.Vector3(c.x + Math.cos(-g.rotation.y) * 0.8, 0.6, c.z - Math.sin(-g.rotation.y) * 0.8), '#B9D98F', 2, 0.35); } });
    });
  }
  // rows: [[a, b]] world points (start/end tile centre of each bed row); a plow blade runs along each and leaves a furrow.
  function plowFurrows(rows) {
    rows.forEach(([a, b], k) => {
      const len = a.distanceTo(b) + 0.8, ang = Math.atan2(b.x - a.x, b.z - a.z);
      const g = new THREE.Group(); g.position.copy(a).setY(0.36); g.rotation.y = ang;
      const fur = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 1), soilM.clone()); fur.scale.z = 0.01; g.add(fur);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), plowM.clone()); blade.rotation.x = Math.PI / 2; blade.position.y = 0.14; g.add(blade);
      g.visible = false; scene.add(g);
      fxs.push({ delay: k * 140, dur: 1100, obj: g, upd(e) { g.visible = true; const m = Math.min(1, e / 0.7), d = -0.4 + m * len;
        fur.scale.z = Math.max(0.01, m * len); fur.position.z = -0.4 + m * len / 2; blade.position.z = d;
        if (m < 1 && Math.random() < 0.6) poof(new THREE.Vector3(a.x + Math.sin(ang) * d, 0.45, a.z + Math.cos(ang) * d), '#8B6440', 2, 0.3);
        const fade = e > 0.7 ? 1 - (e - 0.7) / 0.3 : 1; blade.material.opacity = fade; fur.material.opacity = Math.min(1, fade * 1.4); } });
    });
  }
  // t0 is set on an effect's first frame, so a busy frame (e.g. a big harvest) never skips the animation.
  frameHooks.push(() => { const now = performance.now();
    for (let k = fxs.length - 1; k >= 0; k--) { const f = fxs[k]; if (f.t0 == null) f.t0 = now + f.delay; if (now < f.t0) continue; const e = Math.min(1, (now - f.t0) / f.dur); f.upd(e);
      if (e >= 1) { scene.remove(f.obj); f.obj.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); fxs.splice(k, 1); } } });
  // ---------- Render loop ----------
  const clock = new THREE.Clock();
  function render() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, now = performance.now();
    if (ctl.glide) {
      const G = ctl.glide, k = Math.min(1, (now - G.t0) / G.dur), e = easeInOut(k);
      ctl.az = G.from.az + (G.to.az - G.from.az) * e; ctl.pol = G.from.pol + (G.to.pol - G.from.pol) * e; ctl.zoom = G.from.zoom + (G.to.zoom - G.from.zoom) * e;
      ctl.target.lerpVectors(G.from.target, G.to.target, e); updateCamera();
      if (k >= 1) { ctl.glide = null; G.onDone?.(); }
    } else if (ctl.auto) { ctl.az += dt * 0.06; updateCamera(); }
    updateAnims(now); updateCars(dt, t); updateCrates(now); updateBuilds(now); updateWorkers(t);
    bpMat.opacity = 0.22 + 0.14 * (0.5 + 0.5 * Math.sin(t * 3)); bpPad.opacity = 0.2 + 0.18 * (0.5 + 0.5 * Math.sin(t * 3));
    for (const l of loots.values()) { l.st.material.rotation = t * 1.2 + l.ph; const s = 0.45 + 0.2 * (0.5 + 0.5 * Math.sin(t * 4 + l.ph)); l.st.scale.setScalar(s); l.st.position.y = 0.95 + Math.sin(t * 2 + l.ph) * 0.08;
      if (l.born) { const k = Math.min(1, (now - l.born) / 500); l.g.scale.setScalar(Math.max(0.01, elastic(k))); if (k >= 1) l.born = 0; } }
    for (const g of decors.values()) if (g.userData.born) { const k = Math.min(1, (now - g.userData.born) / 600); g.scale.setScalar(Math.max(0.01, elastic(k))); if (k >= 1) g.userData.born = 0; }
    for (const g of feats.values()) if (g.userData.born) { const k = Math.min(1, (now - g.userData.born) / 600); g.scale.setScalar(Math.max(0.01, elastic(k))); if (k >= 1) g.userData.born = 0; }
    for (const o of obs.values()) if (o.grown && o.group?.userData.born) { const k = Math.min(1, (now - o.group.userData.born) / 700); o.group.scale.setScalar(Math.max(0.01, elastic(k))); if (k >= 1) o.group.userData.born = 0; }
    if (marketState === 'building' && Math.random() < dt * 1.3) poof(market.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 0.4 + Math.random() * 1.6, 0.9)), '#EBD5AA', 6, 0.7);
    for (const tl of tiles) {
      const p = tl.plant; if (!p) continue;
      if (p.userData.born) { const k = Math.min(1, (now - p.userData.born) / 600); p.scale.setScalar(Math.max(0.01, elastic(k))); if (k >= 1) p.userData.born = 0; }
      p.rotation.z = Math.sin(t * 1.3 + p.userData.phase) * 0.035; p.rotation.x = Math.sin(t * 1.1 + p.userData.phase * 2) * 0.025;
      p.traverse((o) => { if (o.userData.glow) o.material.opacity = o.userData.baseOpacity * (0.8 + 0.2 * Math.sin(t * 2 + p.userData.phase)); if (o.userData.motes) o.rotation.y = t * 0.3; });
      if (tl.icon.visible) tl.icon.position.y = 1.35 + (tl.key.endsWith(':3') ? 0.2 : -0.5) + Math.sin(t * 2.5 + p.userData.phase) * 0.06;
    }
    for (const b of beds) if (b.group.userData.born) { const k = Math.min(1, (now - b.group.userData.born) / 700); b.group.scale.set(1, Math.max(0.01, elastic(k)), 1); if (k >= 1) b.group.userData.born = 0; }
    for (const o of appearing) { if (!o.userData.appear) { appearing.delete(o); continue; } if (builds.some((b) => b.obj === o && !b.shown)) continue; const k = Math.min(1, (now - o.userData.appear) / 750); o.scale.setScalar(Math.max(0.01, elastic(k)) * o.userData.baseScale); if (k >= 1) { o.userData.appear = 0; appearing.delete(o); } }
    for (const o of obs.values()) if (o.stump?.userData.born) { const k = Math.min(1, (now - o.stump.userData.born) / 400); o.stump.scale.setScalar(Math.max(0.01, elastic(k)) * o.def.s * 0.95); if (k >= 1) o.stump.userData.born = 0; }
    sel.material.opacity = 0.65 + 0.3 * Math.sin(t * 4);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4); ghostOk.opacity = 0.22 + 0.2 * pulse; barOk.opacity = 0.7 + 0.3 * pulse;
    for (const id of Object.keys(lotFx)) { const s = lotFx[id].sign; if (s.parent.visible) s.rotation.z = Math.sin(t * 1.4 + s.position.x) * 0.02; }
    const pa = motes.geometry.attributes.position;
    for (let i = 0; i < NM; i++) { pa.array[i * 3 + 1] += Math.sin(t * 0.6 + mseed[i]) * 0.003; pa.array[i * 3] += Math.cos(t * 0.3 + mseed[i]) * 0.003; }
    pa.needsUpdate = true;
    for (const g of glows) g.material.opacity = 0.5 + 0.08 * Math.sin(t * 3 + g.position.x);
    for (let k = drops.length - 1; k >= 0; k--) { const d = drops[k]; d.userData.v -= 9 * dt; d.position.y += d.userData.v * dt; if (d.position.y < d.userData.floor) { scene.remove(d); drops.splice(k, 1); } }
    for (let k = parts.length - 1; k >= 0; k--) {
      const m = parts[k], u = m.userData; u.life += dt; u.v.y -= (u.leafy ? 4 : 7) * dt; if (u.leafy) u.v.multiplyScalar(1 - 1.8 * dt);
      m.position.addScaledVector(u.v, dt); if (m.position.y < 0.05) { m.position.y = 0.05; u.v.set(0, 0, 0); }
      m.rotation.x += u.spin.x * dt; m.rotation.y += u.spin.y * dt; m.scale.setScalar(u.s0 * Math.max(0.01, 1 - Math.pow(u.life / u.max, 2)));
      if (u.life > u.max) { scene.remove(m); parts.splice(k, 1); }
    }
    bundles.forEach((b, k) => { b.group.rotation.z = Math.sin(t * 1.2 + k) * 0.04; });
    for (const f of frameHooks) f(dt, t);
    if (!paused || pausedFrames++ < 1) renderer.render(scene, camera);   // v0.63: while a full-screen overlay (Card Pack reveal) covers the farm, keep the last frame instead of re-drawing the 3D scene under it
  }
  function setPaused(on) { on = !!on; if (on !== paused) { paused = on; pausedFrames = 0; } }

  return {
    setPaused, PR_CAP, IOS,
    renderer, scene, camera, ctl, DEF, tiles, beds, obs, stand, rack, market, barrel, still, setStill, teastand, setTea, press, opress, orchFenceInfo: () => ({ posts: orchFenceG?.children[0]?.count || 0, owned: [...orchOwned] }), fruitstand, setCraft, addOrchardTree, setOrchardTree, removeOrchardTree, orchardTrees, setTreeRows, treeRows, treeRowPulse, makeFruitTree, parking, setParking, oparking, setOParking, obillboard, windmill, billboard, setBillboard, spotGhosts, setSpotGhosts, bedTargets, setBedTargets, barrels, addBarrel, removeBarrel, gutters, setGutter, setBarrelInfo, setBarrelLv, hives, addHive, removeHive, setBeeBeds, tincture, setTincture, cars, frameHooks,
    updateCamera, resize, glide, intro, pick, project, tileWorld, sickleSweep, plowFurrows, fxCount: () => fxs.length,
    setObstacle, chop, clearObstacle, addBed, setGhosts, setLotOwned, setLocation, orchardScene, orchardShed, setOStandStock, setStandShelf, standShelf, setStandStock, setMarketOpen, setRack, appear, spawnCar, spawnTruck, poof,
    tilePlant: (i) => tiles[i]?.plant || null, addWorker, removeWorker, setWorker, workerAt, workerGo, workerIdle, workerPose, placeWorker, setPlant, attachPlant, setIcon, setShade, bgTrees, setIrrigation, irrigPulse, irrig, select, splash, render, textSprite, relabel, groundAt,
    buildAnim, setCons, makeBlueprint, setBlueprint, setMarketState, addLoot, removeLoot, addDecor, removeDecor, addFeat, removeFeat, feats, setBulk, bulkPop, bulkHome: () => bulkHome, bulkOrch: () => bulkOrch, spawnVan, dropCrates, vans: vanPool, crates: dropC, addGrown, setGrown, removeGrown, loots, decors,
    iconWorld(i) { const t = tiles[i]; t.icon.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(t.icon.matrixWorld); },
  };
}
