// Petalspire v0.52: the roadside billboard face, painted on a 1024×512 canvas (no image assets).
// drawBillboard(g, { on, panel, time, top }) — on: the ad boost is running; panel 0–2 cycles while on;
// time: remaining boost ('4:56'); top: { name, color } of the player's top seller (or null).
const SERIF = 'Fraunces, Georgia, serif', SANS = 'Nunito, "Trebuchet MS", sans-serif';
const C = { cream: '#FFF6E6', paper: '#F7EBD3', moss: '#3D5A40', sage: '#7FA47D', terra: '#B0603A', gold: '#F2B54A', rose: '#E58F94', lilac: '#B79AD6', leaf: '#6E9A5B' };
function rng(seed) { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }

function paper(g, W, H, base, blot, seed) {
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const r = rng(seed);
  for (let i = 0; i < 70; i++) { g.globalAlpha = 0.05 + r() * 0.06; g.fillStyle = blot[i % blot.length]; g.beginPath(); g.ellipse(r() * W, r() * H, 30 + r() * 110, 18 + r() * 60, r() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}
function brushFrame(g, W, H, col, seed) {   // a hand-painted double border
  const r = rng(seed); g.strokeStyle = col; g.lineCap = 'round';
  for (let pass = 0; pass < 3; pass++) {
    g.globalAlpha = pass ? 0.45 : 0.95; g.lineWidth = pass ? 6 : 16; const m = 18 + pass * 3 + r() * 2;
    g.beginPath(); g.moveTo(m + r() * 3, m); g.lineTo(W - m, m + r() * 4); g.lineTo(W - m - r() * 3, H - m); g.lineTo(m, H - m - r() * 4); g.closePath(); g.stroke();
  }
  g.globalAlpha = 0.9; g.lineWidth = 4; g.strokeRect(40, 40, W - 80, H - 80); g.globalAlpha = 1;
}
function flower(g, x, y, R, col, centre = '#FFE08A', petals = 6, rot = 0) {
  for (let pass = 0; pass < 2; pass++) {   // two translucent passes = soft painterly petals
    g.globalAlpha = pass ? 0.55 : 0.95; g.fillStyle = col;
    for (let k = 0; k < petals; k++) { const a = rot + k * 2 * Math.PI / petals + pass * 0.18; g.beginPath(); g.ellipse(x + Math.cos(a) * R * 0.62, y + Math.sin(a) * R * 0.62, R * 0.55, R * 0.34, a, 0, 7); g.fill(); }
  }
  g.globalAlpha = 1; g.fillStyle = centre; g.beginPath(); g.arc(x, y, R * 0.3, 0, 7); g.fill();
  g.fillStyle = 'rgba(176,96,58,0.45)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.3) * R * 0.14, y + Math.sin(k * 1.3) * R * 0.14, R * 0.05, 0, 7); g.fill(); }
}
function leaf(g, x, y, len, ang, col = C.leaf) { g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0); g.fill(); g.restore(); g.globalAlpha = 1; }
function bouquet(g, x, y, s, cols, muted) {   // stems in a little crate, five blooms
  g.strokeStyle = muted ? '#A9B49C' : '#5E8A4E'; g.lineWidth = 6 * s; g.lineCap = 'round';
  const heads = [[-60, -150, 34], [0, -185, 40], [60, -150, 34], [-30, -105, 28], [36, -100, 28]];
  for (const [hx, hy] of heads) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + hx * s * 0.4, y + hy * s * 0.5, x + hx * s, y + hy * s); g.stroke(); }
  leaf(g, x - 4 * s, y - 50 * s, 60 * s, -2.4, muted ? '#B7C0A9' : C.leaf); leaf(g, x + 4 * s, y - 60 * s, 64 * s, -0.7, muted ? '#B7C0A9' : '#7FA766');
  heads.forEach(([hx, hy, r], i) => flower(g, x + hx * s, y + hy * s, r * s, cols[i % cols.length], muted ? '#EADFB8' : '#FFE08A', i % 2 ? 5 : 6, i));
  g.fillStyle = muted ? '#CDB9A0' : '#B9895A'; g.fillRect(x - 58 * s, y - 6 * s, 116 * s, 52 * s);
  g.fillStyle = muted ? '#BFA98E' : '#9E6F45'; for (let k = 0; k < 3; k++) g.fillRect(x - 58 * s, y + (4 + k * 15) * s, 116 * s, 4 * s);
}
const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
function fit(g, text, font, size, maxW) { let s = size; do { g.font = font.replace('#', s); s -= 2; } while (g.measureText(text).width > maxW && s > 18); }
function badge(g, W, H, time) {   // remaining boost, bottom-right gold ribbon
  const w = 250, h = 74, x = W - w - 54, y = H - h - 50;
  g.fillStyle = 'rgba(61,90,64,0.18)'; rr(g, x + 4, y + 6, w, h, 37); g.fill();
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#FFD98A'); gr.addColorStop(1, C.gold); g.fillStyle = gr; rr(g, x, y, w, h, 37); g.fill();
  g.strokeStyle = '#C98A2A'; g.lineWidth = 3; g.stroke();
  g.fillStyle = C.moss; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 22px ${SANS}`; g.fillText('BOOST', x + 62, y + h / 2 + 1);
  g.font = `700 40px ${SERIF}`; g.fillText(time || '', x + 162, y + h / 2 + 2);
}
export function drawBillboard(g, { on = false, panel = 0, time = '', top = null } = {}) {
  const W = g.canvas.width, H = g.canvas.height;
  g.save(); g.clearRect(0, 0, W, H); g.textBaseline = 'middle';
  if (!on) {   // muted "Space for rent" — a faded old poster, never blank
    paper(g, W, H, '#E9E0CE', ['#CFC3AA', '#D8CDB6', '#BFB59E'], 7);
    g.globalAlpha = 0.35; bouquet(g, 830, 410, 1.0, ['#D9B3B5', '#C9BCD9', '#E6CF9D'], true); g.globalAlpha = 1;
    brushFrame(g, W, H, '#A9B89F', 3);
    g.fillStyle = 'rgba(176,96,58,0.55)'; g.textAlign = 'left'; g.font = `800 30px ${SANS}`; g.fillText('THIS BOARD IS', 92, 130);
    g.fillStyle = 'rgba(61,90,64,0.62)'; fit(g, 'Space for rent', `600 #px ${SERIF}`, 104, 640); g.fillText('Space for rent', 86, 232);
    g.fillStyle = 'rgba(61,90,64,0.45)'; g.font = `700 32px ${SANS}`; g.fillText('Your stand’s ad here · tap to run it', 92, 330);
    g.fillStyle = '#F4EEE1'; g.beginPath(); g.moveTo(W - 40, 40); g.lineTo(W - 150, 40); g.lineTo(W - 40, 140); g.closePath(); g.fill();   // torn, curled corner
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.beginPath(); g.moveTo(W - 150, 40); g.lineTo(W - 40, 140); g.lineTo(W - 120, 70); g.closePath(); g.fill();
    g.restore(); return;
  }
  paper(g, W, H, C.cream, ['#FCE3D9', '#EAF1DE', '#F9E9C6', '#EEE4F6'], 11 + panel);
  brushFrame(g, W, H, C.sage, 5 + panel);
  g.textAlign = 'left';
  if (panel === 0) {
    bouquet(g, 190, 400, 1.15, [C.rose, C.lilac, C.gold, '#F3A7A0', '#C7B2E6'], false);
    g.fillStyle = C.terra; g.font = `800 30px ${SANS}`; g.fillText('PETALSPIRE FARM STAND', 372, 112);
    g.fillStyle = C.moss; fit(g, 'Fresh Flowers', `700 #px ${SERIF}`, 96, 590); g.fillText('Fresh Flowers', 366, 200);
    fit(g, 'Ahead →', `700 #px ${SERIF}`, 96, 590); g.fillStyle = C.terra; g.fillText('Ahead →', 366, 298);
    g.fillStyle = 'rgba(61,90,64,0.75)'; g.font = `700 28px ${SANS}`; g.fillText('Next stop on the right', 372, 380);
  } else if (panel === 1) {
    const col = top?.color || C.lilac, name = top?.name || 'Lavender';
    flower(g, 200, 250, 118, col, '#FFE08A', 6, 0.3); leaf(g, 120, 360, 110, -2.6); leaf(g, 280, 370, 110, -0.6);
    g.fillStyle = C.terra; g.font = `800 30px ${SANS}`; g.fillText(top ? 'TODAY’S TOP SELLER' : 'PICKED THIS MORNING', 372, 112);
    g.fillStyle = C.moss; fit(g, name, `700 #px ${SERIF}`, 100, 590); g.fillText(name, 366, 214);
    g.fillStyle = 'rgba(61,90,64,0.75)'; g.font = `700 30px ${SANS}`; g.fillText('Grown by hand, sold at the stand', 372, 310);
  } else {
    for (const [x, y, r, c, rot] of [[150, 160, 62, C.rose, 0], [270, 230, 52, C.gold, 0.4], [140, 330, 56, C.lilac, 0.8], [300, 370, 40, '#F3A7A0', 0.2]]) flower(g, x, y, r, c, '#FFE08A', 6, rot);
    leaf(g, 210, 300, 80, -0.9); leaf(g, 90, 240, 70, 2.6);
    g.fillStyle = C.terra; g.font = `800 30px ${SANS}`; g.fillText('OPEN NOW · TURN IN', 402, 112);
    g.fillStyle = C.moss; fit(g, 'smell the flowers', `700 #px ${SERIF}`, 88, 560); g.fillText('Pull over &', 396, 200);
    g.fillText('smell the flowers', 396, 290);
    g.fillStyle = 'rgba(61,90,64,0.75)'; g.font = `700 28px ${SANS}`; g.fillText('Bouquets · dried bundles · oils', 402, 376);
  }
  badge(g, W, H, time);
  for (let k = 0; k < 3; k++) { g.fillStyle = k === panel ? C.terra : 'rgba(176,96,58,0.28)'; g.beginPath(); g.arc(96 + k * 30, H - 70, 9, 0, 7); g.fill(); }   // panel dots
  g.restore();
}
