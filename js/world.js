// Scene, environment, garden bed and props
import * as THREE from 'three';
import { mat, glowSprite, glowTexture } from './plants.js';

export const GRID = 6, TILE = 1.0, GAP = 0.08;
const shadowy = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };

function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function tileCenter(i) {
  const r = Math.floor(i / GRID), c = i % GRID;
  const off = (GRID - 1) / 2;
  return new THREE.Vector3((c - off) * (TILE + GAP), 0, (r - off) * (TILE + GAP));
}

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
  s.scale.set(h * w / 110, h, 1); s.renderOrder = 5;
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

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const HORIZON = new THREE.Color('#F6D9B6');
  scene.fog = new THREE.Fog(HORIZON, 30, 75);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  // Sky
  const sunDir = new THREE.Vector3(-0.75, 0.32, -0.58).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#BFDCE6') }, mid: { value: new THREE.Color('#F4E6D2') }, hor: { value: HORIZON }, sun: { value: sunDir }, sunCol: { value: new THREE.Color('#FFD08A') } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top, mid, hor, sun, sunCol; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.15, 0.7, h));
        float s = max(dot(normalize(vP), sun), 0.0); c += sunCol * (pow(s, 6.0) * 0.35 + pow(s, 120.0) * 0.9);
        gl_FragColor = vec4(c, 1.0);
#include <colorspace_fragment>
      }`,
  }));
  scene.add(sky);

  // Lights
  const hemi = new THREE.HemisphereLight('#D3E6EC', '#B9C99A', 0.95); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFC27A', 3.3);
  sun.position.copy(sunDir).multiplyScalar(20).setY(11);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#F7C5C5', 0.35); fill.position.set(8, 5, 8); scene.add(fill);

  // Ground with rolling hills
  const gg = new THREE.PlaneGeometry(160, 160, 96, 96); gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position; const cols = new Float32Array(gp.count * 3);
  const cNear = new THREE.Color('#ADCB98'), cPatch = new THREE.Color('#C9D9A4'), cFar = new THREE.Color('#93B585'), cWarm = new THREE.Color('#E2D08E');
  const tmp = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), r = Math.hypot(x, z);
    const hill = THREE.MathUtils.smoothstep(r, 11, 34);
    const y = (noise(x * 0.07, z * 0.07) * 5 + noise(x * 0.2, z * 0.2) * 1.2) * hill + noise(x * 0.6, z * 0.6) * 0.06;
    gp.setY(i, y - 0.02);
    tmp.copy(cNear).lerp(cPatch, noise(x * 0.35 + 9, z * 0.35) * 0.8).lerp(cFar, hill * 0.7).lerp(cWarm, noise(x * 0.12, z * 0.12 + 3) * 0.25);
    cols.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  gg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); gg.computeVertexNormals();
  const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ground.receiveShadow = true; scene.add(ground);

  // Garden bed
  const bed = new THREE.Group(); scene.add(bed);
  const span = GRID * (TILE + GAP) + 0.1;
  const wood = mat('#B07D52'), woodL = mat('#C99A6B'), woodD = mat('#8E6040');
  for (let s = 0; s < 4; s++) {
    const plank = shadowy(new THREE.Mesh(new THREE.BoxGeometry(span + 0.5, 0.34, 0.26), s % 2 ? wood : woodL));
    const cap = shadowy(new THREE.Mesh(new THREE.BoxGeometry(span + 0.56, 0.06, 0.32), woodL));
    const grp = new THREE.Group(); grp.add(plank); cap.position.y = 0.19; grp.add(cap);
    grp.rotation.y = s * Math.PI / 2; grp.position.y = 0.17;
    const d = span / 2 + 0.12; if (s === 0) grp.position.z = d; if (s === 1) grp.position.x = d; if (s === 2) grp.position.z = -d; if (s === 3) grp.position.x = -d;
    bed.add(grp);
  }
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const post = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.5, 8), woodD));
    post.position.set(x * (span / 2 + 0.12), 0.25, z * (span / 2 + 0.12)); bed.add(post);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), woodL); knob.position.copy(post.position).setY(0.52); knob.scale.y = 0.6; bed.add(knob);
  }
  const under = new THREE.Mesh(new THREE.BoxGeometry(span, 0.2, span), mat('#5E412C')); under.position.y = 0.08; under.receiveShadow = true; bed.add(under);

  const tiles = [];
  const soilDry = new THREE.Color('#8C6545'), soilWet = new THREE.Color('#563A28');
  const tileGeo = new THREE.BoxGeometry(TILE, 0.16, TILE, 7, 1, 7);
  { const p = tileGeo.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getY(i) > 0) { const x = p.getX(i), z = p.getZ(i); const edge = Math.max(Math.abs(x), Math.abs(z)) * 2; p.setY(i, p.getY(i) + 0.05 * (1 - edge * edge) + (hash(x * 9, z * 9) - 0.5) * 0.035); } } tileGeo.computeVertexNormals(); }
  for (let i = 0; i < GRID * GRID; i++) {
    const m = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ color: soilDry.clone().offsetHSL(0, 0, (hash(i, 3) - 0.5) * 0.03), roughness: 1 }));
    m.receiveShadow = true;
    const c = tileCenter(i); m.position.set(c.x, 0.22, c.z);
    m.userData = { kind: 'tile', index: i };
    bed.add(m);
    const holder = new THREE.Group(); holder.position.set(c.x, 0.32, c.z); holder.scale.setScalar(1.3); bed.add(holder);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
    icon.scale.setScalar(0.36); icon.visible = false; icon.renderOrder = 10; holder.add(icon);
    tiles.push({ mesh: m, holder, icon, plant: null, key: '' });
  }
  const ICON_TEX = { water: iconTexture('water'), ready: iconTexture('ready') };

  // Selection frame
  const sel = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: '#F5D07A', transparent: true, opacity: 0.95, depthWrite: false }));
  sel.rotation.x = -Math.PI / 2; sel.scale.setScalar(Math.SQRT2 * 0.93); sel.visible = false; bed.add(sel);
  const selGlow = glowSprite('#FFE8A8', 1.6, 0.35); selGlow.visible = false; bed.add(selGlow);

  // ---------- Market stall ----------
  const stall = new THREE.Group(); stall.position.set(-2.55, 0, -6.4); stall.rotation.y = 0.3; scene.add(stall);
  {
    const counter = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 0.9), wood)); counter.position.y = 0.48; stall.add(counter);
    const top = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 1.05), woodL)); top.position.y = 0.98; stall.add(top);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.5, 0.04), mat('#F2E3CB')); panel.position.set(0, 0.5, 0.46); stall.add(panel);
    for (const x of [-1.25, 1.25]) for (const z of [-0.4, 0.4]) {
      const p = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.5, 6), woodD)); p.position.set(x, 1.25, z); stall.add(p);
    }
    const n = 8;
    for (let i = 0; i < n; i++) {
      const s = shadowy(new THREE.Mesh(new THREE.BoxGeometry(3.0 / n, 0.05, 1.4), mat(i % 2 ? '#FFF6EA' : '#F4B9BC')));
      s.position.set(-1.5 + (i + 0.5) * 3.0 / n, 2.55, 0.05); s.rotation.x = 0.28; stall.add(s);
      const sc = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(3.0 / n / 2, 3.0 / n / 2, 0.05, 10, 1, false, 0, Math.PI), s.material));
      sc.rotation.x = Math.PI / 2 + 0.28; sc.rotation.z = Math.PI; sc.position.set(s.position.x, 2.36, 0.72); stall.add(sc);
    }
    // crates & bouquets
    const crateCols = [['#F7C5C5', '#F2AEB3'], ['#F5D07A', '#E9B44C'], ['#FFFBF2', '#E9EEF0']];
    crateCols.forEach(([a, b], k) => {
      const cr = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, 0.5), woodL)); cr.position.set(-0.8 + k * 0.8, 1.17, 0.05); stall.add(cr);
      for (let j = 0; j < 7; j++) {
        const f = shadowy(new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), mat(j % 2 ? a : b, k === 2 ? { emissive: '#FFF1D2', emissiveIntensity: 0.4 } : {})));
        f.position.set(-0.8 + k * 0.8 + (hash(j, k) - 0.5) * 0.45, 1.36 + hash(k, j) * 0.08, 0.05 + (hash(j + 3, k) - 0.5) * 0.3); stall.add(f);
      }
    });
    for (let j = 0; j < 3; j++) { const pk = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.03), mat('#FFF9F0')); pk.position.set(0.95 + j * 0.0, 1.55, -0.3 + j * 0.02); pk.rotation.set(-0.2, 0.2 * j - 0.2, 0); stall.add(pk); }
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat('#FFE1A0', { emissive: '#FFC861', emissiveIntensity: 1.4 })); lantern.position.set(1.35, 2.0, 0.6); stall.add(lantern);
    const lg = glowSprite('#FFCF7A', 1.4, 0.6); lg.position.copy(lantern.position); stall.add(lg);
    const label = textSprite('Market', { h: 0.55 }); label.position.set(0, 3.25, 0.3); stall.add(label); stall.userData.label = label;
    // tap proxy
    const hit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.6, 1.8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.6; stall.add(hit);
  }
  stall.userData.kind = 'market';

  // ---------- Drying rack ----------
  const rack = new THREE.Group(); rack.position.set(2.75, 0, -6.1); rack.rotation.y = -0.35; scene.add(rack);
  const bundles = [];
  {
    for (const x of [-1.1, 1.1]) {
      for (const s of [-1, 1]) { const leg = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.3, 6), woodD)); leg.position.set(x, 1.1, s * 0.32); leg.rotation.x = s * 0.28; rack.add(leg); }
    }
    const bar = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), wood)); bar.rotation.z = Math.PI / 2; bar.position.y = 2.15; rack.add(bar);
    const bar2 = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), wood)); bar2.rotation.z = Math.PI / 2; bar2.position.y = 0.55; rack.add(bar2);
    const basket = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.3, 12), mat('#C9A06E'))); basket.position.set(-1.6, 0.15, 0.3); rack.add(basket);
    for (let k = 0; k < 3; k++) {
      const g = new THREE.Group(); g.position.set(-0.75 + k * 0.75, 2.12, 0);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 4), mat('#8E6040')); str.position.y = -0.12; g.add(str);
      const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 8), mat('#B7D4B5')); tie.position.y = -0.27; g.add(tie);
      const cone = shadowy(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 9), mat('#F7C5C5')));
      cone.rotation.x = Math.PI; cone.position.y = -0.68; g.add(cone);
      for (let j = 0; j < 6; j++) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), cone.material); h.position.set(Math.cos(j) * 0.11, -0.95 - (j % 2) * 0.1, Math.sin(j) * 0.11); h.scale.y = 0.7; g.add(h); }
      const gl = glowSprite('#FFE19A', 1.0, 0.5); gl.position.y = -0.7; gl.visible = false; g.add(gl);
      rack.add(g); bundles.push({ group: g, cone, glow: gl });
    }
    const label = textSprite('Drying Rack', { h: 0.5 }); label.position.set(0, 2.85, 0); rack.add(label); rack.userData.label = label;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 1.5), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.4; rack.add(hit);
  }
  rack.userData.kind = 'rack';

  // ---------- Decor: trees, bushes, flowers, lanterns, stones ----------
  const decor = new THREE.Group(); scene.add(decor);
  const canopyGeo = new THREE.SphereGeometry(1, 18, 12);
  { const p = canopyGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const k = 1 + (noise(v.x * 2 + 5, v.z * 2 + v.y * 2) - 0.5) * 0.35; p.setXYZ(i, v.x * k, v.y * k * 0.9, v.z * k); } canopyGeo.computeVertexNormals(); }
  const treeCols = ['#8FB487', '#A3C49A', '#7FA47D', '#F4C3C3', '#B7D4B5', '#9DBF8F'];
  const trunkM = mat('#8E6A4E');
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const placeTree = (x, z, sc, col) => {
    const t = new THREE.Group(); t.position.set(x, 0, z);
    const tr = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.12 * sc, 0.2 * sc, 1.6 * sc, 6), trunkM)); tr.position.y = 0.8 * sc; t.add(tr);
    const cm = mat(col);
    for (let k = 0; k < 3; k++) {
      const c = shadowy(new THREE.Mesh(canopyGeo, cm)); const s = sc * (1.0 - k * 0.18);
      c.scale.setScalar(s); c.position.set((rnd() - 0.5) * 0.7 * sc, (1.9 + k * 0.75) * sc, (rnd() - 0.5) * 0.7 * sc); t.add(c);
    }
    decor.add(t);
  };
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 9.5 + rnd() * 12;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z < -4 && Math.abs(x) < 6 && r < 12) continue;
    placeTree(x, z, 0.8 + rnd() * 0.7, treeCols[i % treeCols.length]);
  }
  placeTree(-7.2, -8.5, 1.3, '#F4C3C3'); placeTree(7.5, -9.0, 1.4, '#8FB487'); placeTree(0.5, -12, 1.6, '#A3C49A');
  const bushM = [mat('#8DB486'), mat('#A7C99B'), mat('#7FA47D')];
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2, r = 7.2 + rnd() * 5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - stall.position.x, z - stall.position.z) < 2.2 || Math.hypot(x - rack.position.x, z - rack.position.z) < 2.2) continue;
    const b = shadowy(new THREE.Mesh(canopyGeo, bushM[i % 3])); const s = 0.3 + rnd() * 0.35; b.scale.set(s * 1.2, s * 0.85, s * 1.2); b.position.set(x, s * 0.5, z); decor.add(b);
  }
  // instanced flowers + grass tufts
  const fGeo = new THREE.IcosahedronGeometry(0.07, 0);
  const fCols = ['#F7C5C5', '#FFF9F0', '#F5D07A', '#F2AEB3', '#E9D7F0'];
  fCols.forEach((col, k) => {
    const im = new THREE.InstancedMesh(fGeo, mat(col, { roughness: 0.6 }), 60); const m4 = new THREE.Matrix4(); let n = 0;
    for (let i = 0; i < 60; i++) {
      const a = rnd() * Math.PI * 2, r = 5.0 + rnd() * 7; const x = Math.cos(a) * r, z = Math.sin(a) * r;
      m4.makeTranslation(x, 0.12 + rnd() * 0.08, z); im.setMatrixAt(n++, m4);
    }
    im.count = n; decor.add(im);
  });
  const gGeo = new THREE.ConeGeometry(0.05, 0.3, 4); gGeo.translate(0, 0.15, 0);
  const grass = new THREE.InstancedMesh(gGeo, mat('#8DB486'), 500); { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(); let n = 0;
    for (let i = 0; i < 500; i++) { const a = rnd() * Math.PI * 2, r = 4.6 + rnd() * 9; const x = Math.cos(a) * r, z = Math.sin(a) * r;
      e.set((rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.5); q.setFromEuler(e); const s = 0.6 + rnd() * 0.9; sc.set(s, s, s);
      m4.compose(new THREE.Vector3(x, 0, z), q, sc); grass.setMatrixAt(n++, m4); } grass.count = n; }
  decor.add(grass);
  // stepping stones toward stall and rack
  const stoneM = mat('#EDE3D3');
  const stones = [[-1.6, -4.4], [-2.3, -5.1], [1.6, -4.4], [2.4, -5.0], [0, -4.6], [-0.9, 4.7], [0.6, 5.3], [-0.2, 6.2]];
  for (const [x, z] of stones) { const s = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.08, 9), stoneM), false); s.position.set(x, 0.03, z); s.rotation.y = hash(x, z) * 3; decor.add(s); }
  // lantern posts
  const glows = [];
  for (const [x, z] of [[-4.6, 3.9], [4.6, 3.9], [-4.6, -3.9], [4.6, -3.9]]) {
    const p = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6), woodD)); p.position.set(x, 0.8, z); decor.add(p);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.04), woodD); hook.position.set(x + 0.12, 1.58, z); decor.add(hook);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat('#FFE1A0', { emissive: '#FFC861', emissiveIntensity: 1.5 })); l.position.set(x + 0.24, 1.42, z); decor.add(l);
    const gl = glowSprite('#FFCF7A', 1.2, 0.55); gl.position.copy(l.position); decor.add(gl); glows.push(gl);
  }

  // golden-hour pollen motes
  const NM = 90; const mg = new THREE.BufferGeometry(); const mp = new Float32Array(NM * 3); const mseed = new Float32Array(NM);
  for (let i = 0; i < NM; i++) { mp[i * 3] = (rnd() - 0.5) * 18; mp[i * 3 + 1] = 0.3 + rnd() * 4; mp[i * 3 + 2] = (rnd() - 0.5) * 18; mseed[i] = rnd() * 100; }
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.12, map: glowTexture(), color: '#FFE3A3', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(motes);

  // water droplets (reused)
  const dropGeo = new THREE.SphereGeometry(0.04, 6, 4); dropGeo.scale(1, 1.6, 1);
  const dropM = new THREE.MeshStandardMaterial({ color: '#BFE3EE', roughness: 0.2, transparent: true, opacity: 0.85 });
  const drops = [];

  // -------- Camera controls --------
  const ctl = { az: 0.32, pol: 0.98, dist: 20, minD: 9, maxD: 26, target: new THREE.Vector3(0, 0.3, -1.1), zoom: 1, auto: true };
  function fitDist() {
    const aspect = camera.aspect, vf = THREE.MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const byW = (9.6 / 2) / Math.tan(hf / 2);
    const byH = (8.5 / 2) / Math.tan(vf / 2);
    return Math.max(byW, byH);
  }
  function updateCamera() {
    const d = ctl.base * ctl.zoom;
    const sp = Math.sin(ctl.pol);
    camera.position.set(ctl.target.x + d * sp * Math.sin(ctl.az), ctl.target.y + d * Math.cos(ctl.pol), ctl.target.z + d * sp * Math.cos(ctl.az));
    camera.lookAt(ctl.target); camera.updateMatrixWorld();
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 46 : 40;
    camera.updateProjectionMatrix();
    ctl.base = fitDist();
    // in portrait, nudge the look target so the bed sits above the bottom UI
    ctl.target.set(0, 0.3, w / h < 0.8 ? -0.2 : -0.6);
    updateCamera();
  }
  window.addEventListener('resize', resize); resize();

  const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  function pick(x, y) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const targets = [...tiles.map((t) => t.mesh), ...tiles.map((t) => t.holder), stall, rack];
    const hits = raycaster.intersectObjects(targets, true);
    // status icons (drawn on top of everything) win first
    for (const h of hits) { const ti = tiles.findIndex((t) => t.icon === h.object); if (ti >= 0 && h.object.visible) return { kind: 'tile', index: ti }; }
    for (const h of hits) {
      let o = h.object;
      if (o.isSprite && !o.parent?.userData?.label && o.material.blending === THREE.AdditiveBlending) continue;
      while (o) {
        if (o.userData?.kind) return o.userData;
        const ti = tiles.findIndex((t) => t.holder === o);
        if (ti >= 0) return { kind: 'tile', index: ti };
        o = o.parent;
      }
    }
    return null;
  }
  function iconWorld(i) { const t = tiles[i]; t.icon.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(t.icon.matrixWorld); }
  function project(v) {
    const p = v.clone().project(camera);
    return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight };
  }

  function setPlant(i, species, stage, watered) {
    const t = tiles[i]; const key = species ? `${species}:${stage}` : '';
    t.mesh.material.color.copy(watered ? soilWet : soilDry);
    if (t.key === key) return false;
    if (t.plant) { t.holder.remove(t.plant); t.plant = null; }
    t.key = key;
    if (!species) return true;
    return true;
  }
  function attachPlant(i, obj, pop = true) {
    const t = tiles[i]; t.plant = obj; obj.userData.born = pop ? performance.now() : 0; if (pop) obj.scale.setScalar(0.01); t.holder.add(obj);
  }
  function setIcon(i, kind) {
    const t = tiles[i];
    if (!kind) { t.icon.visible = false; return; }
    t.icon.material.map = ICON_TEX[kind]; t.icon.material.needsUpdate = true; t.icon.visible = true;
    t.icon.userData.kind = kind;
  }
  function select(i) {
    if (i == null) { sel.visible = false; selGlow.visible = false; return; }
    const c = tileCenter(i); sel.position.set(c.x, 0.34, c.z); sel.visible = true;
    selGlow.position.set(c.x, 0.5, c.z); selGlow.visible = true;
  }
  function splash(i) {
    const c = tileCenter(i);
    for (let k = 0; k < 14; k++) {
      const d = new THREE.Mesh(dropGeo, dropM); d.position.set(c.x + (Math.random() - 0.5) * 0.7, 1.6 + Math.random() * 0.8, c.z + (Math.random() - 0.5) * 0.7);
      d.userData.v = -1.5 - Math.random() * 1.5; d.userData.floor = 0.35; scene.add(d); drops.push(d);
    }
  }
  function setRack(slots) {
    slots.forEach((s, k) => {
      const b = bundles[k];
      b.group.visible = !!s;
      if (!s) return;
      const col = s.done ? '#C9A08E' : '#F7C5C5';
      b.cone.material = mat(col);
      b.group.children.forEach((c) => { if (c.isMesh && c.geometry.type === 'SphereGeometry') c.material = mat(s.done ? '#B98E7E' : '#F2AEB3'); });
      b.glow.visible = !!s.done;
    });
  }

  const clock = new THREE.Clock();
  function render() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (ctl.auto) { ctl.az += dt * 0.08; updateCamera(); }
    // plant pop-in + sway
    for (const tl of tiles) {
      const p = tl.plant; if (!p) continue;
      if (p.userData.born) { const k = Math.min(1, (performance.now() - p.userData.born) / 600); const e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); p.scale.setScalar(Math.max(0.01, k < 1 ? e : 1)); if (k >= 1) p.userData.born = 0; }
      p.rotation.z = Math.sin(t * 1.3 + p.userData.phase) * 0.035; p.rotation.x = Math.sin(t * 1.1 + p.userData.phase * 2) * 0.025;
      p.traverse((o) => {
        if (o.userData.glow) o.material.opacity = o.userData.baseOpacity * (0.8 + 0.2 * Math.sin(t * 2 + p.userData.phase));
        if (o.userData.motes) o.rotation.y = t * 0.3;
      });
      if (tl.icon.visible) { tl.icon.position.y = 1.35 + (tl.key.endsWith(':3') ? 0.2 : -0.5) + Math.sin(t * 2.5 + p.userData.phase) * 0.06; }
    }
    for (const tl of tiles) if (tl.icon.visible && !tl.plant) tl.icon.position.y = 0.9 + Math.sin(t * 2.5) * 0.06;
    sel.material.opacity = 0.65 + 0.3 * Math.sin(t * 4);
    // motes drift
    const pa = motes.geometry.attributes.position;
    for (let i = 0; i < NM; i++) { pa.array[i * 3 + 1] += Math.sin(t * 0.6 + mseed[i]) * 0.003; pa.array[i * 3] += Math.cos(t * 0.3 + mseed[i]) * 0.003; }
    pa.needsUpdate = true;
    for (const g of glows) g.material.opacity = 0.5 + 0.08 * Math.sin(t * 3 + g.position.x);
    for (let k = drops.length - 1; k >= 0; k--) { const d = drops[k]; d.userData.v -= 9 * dt; d.position.y += d.userData.v * dt; if (d.position.y < d.userData.floor) { scene.remove(d); drops.splice(k, 1); } }
    bundles.forEach((b, k) => { b.group.rotation.z = Math.sin(t * 1.2 + k) * 0.04; });
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, ctl, tiles, iconWorld, stall, rack, updateCamera, resize, pick, project, setPlant, attachPlant, setIcon, select, splash, setRack, render, textSprite };
}
