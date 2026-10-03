import { H, W, ctx } from '../constellation.js';

// The sun during a solar flare: a huge sun just off the right edge, so only its limb shows, with loops of plasma standing
// on it. It creeps in when the flare is detected, erupts once it has arrived (a loop swells and bursts, a shock front and
// a plume of plasma race toward the Earth, and the screen flashes), and creeps back out when the event ends. Drawn as
// chunky pixel art in a low-res buffer, like the tentacles.
const SPIX = 4,
  IN_TIME = 4, // seconds to creep in
  OUT_TIME = 3; // and to creep back out
// dark red → white-hot; the sun and everything it throws use only these
const PAL = [
  [54, 8, 6],
  [110, 20, 8],
  [176, 44, 12],
  [226, 92, 22],
  [250, 146, 40],
  [255, 196, 84],
  [255, 232, 160],
  [255, 250, 226],
];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
// prominences, rooted on the limb around angle π (facing left, toward the Earth); h in buffer pixels at laptop size
const LOOPS = [
  { a: Math.PI - 0.17, w: 0.16, h: 20, ph: 0 },
  { a: Math.PI + 0.06, w: 0.09, h: 11, ph: 2.1 },
  { a: Math.PI + 0.24, w: 0.13, h: 16, ph: 4 },
];
const STREAK_BINS = 720;
export const sun = { presence: 0, target: 0, last: 0, erupt: null, eruptOnArrival: false, sparks: [], flash: 0, canvas: document.createElement('canvas') };
let SW = 0,
  SH = 0,
  simg = null,
  sdata = null,
  R = 0,
  CX = 0,
  CY = 0,
  CX_REST = 0,
  size = 1, // loop height scale: smaller on a phone
  speed = 1; // eruption speed scale: a narrow screen is crossed sooner
const streak = new Float32Array(STREAK_BINS);

const clamp01 = v => Math.max(0, Math.min(1, v)),
  smooth = v => v * v * (3 - 2 * v);
function sBuffer() {
  const w = Math.ceil(W / SPIX),
    h = Math.ceil(H / SPIX);
  if (w !== SW || h !== SH || !simg) {
    SW = w;
    SH = h;
    sun.canvas.width = w;
    sun.canvas.height = h;
    simg = sun.canvas.getContext('2d').createImageData(w, h);
    sdata = simg.data;
    R = SH * 1.25;
    CY = SH * 0.55;
    CX_REST = SW + R - Math.max(SW * 0.06, 10); // a sliver of the limb shows; at least a few pixels on a phone
    size = Math.max(0.45, Math.min(1.3, Math.min(SW, SH) / 215));
    speed = Math.max(0.45, Math.min(1.4, SW / 360));
  }
  sdata.fill(0);
}
function spx(x, y, c, a = 255) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= SW || y >= SH) return;
  const i = (y * SW + x) * 4;
  if (a >= 255 || sdata[i + 3] === 0) {
    sdata[i] = c[0];
    sdata[i + 1] = c[1];
    sdata[i + 2] = c[2];
    sdata[i + 3] = a;
    return;
  }
  const k = a / 255;
  sdata[i] += (c[0] - sdata[i]) * k;
  sdata[i + 1] += (c[1] - sdata[i + 1]) * k;
  sdata[i + 2] += (c[2] - sdata[i + 2]) * k;
  sdata[i + 3] = Math.max(sdata[i + 3], a);
}
function sdisc(cx, cy, r, c, a) {
  const Rr = Math.ceil(r) + 1;
  for (let y = -Rr; y <= Rr; y++) for (let x = -Rr; x <= Rr; x++) if (x * x + y * y <= r * r + r * 0.6) spx(cx + x, cy + y, c, a);
}
// palette colour for a 0..1 level, dithered so gradients stay pixel art instead of smooth
function shade(level, x, y) {
  const v = level * (PAL.length - 1) + BAYER[(y & 3) * 4 + (x & 3)] - 0.5;
  return PAL[Math.max(0, Math.min(PAL.length - 1, Math.round(v)))];
}
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi),
    b = hash(xi + 1, yi),
    c = hash(xi, yi + 1),
    d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const limbPoint = (ang, r) => [CX + Math.cos(ang) * r, CY + Math.sin(ang) * r];

function drawLoop(L, t, height, bright, alpha = 1) {
  const N = 60;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i <= N; i++) {
      const s = i / N,
        ang = L.a - L.w / 2 + L.w * s,
        r = R + Math.sin(Math.PI * s) * height + Math.sin(t * 1.7 + s * 9 + L.ph) * 1.2;
      if (pass === 0) {
        const [x, y] = limbPoint(ang, r);
        sdisc(x, y, 2.6, PAL[3], Math.round(70 * alpha));
        continue;
      }
      // two twisting strands; plasma knots slide along them toward the feet, like material draining back down
      const knot = Math.sin((s * 6 - t * 1.4 + L.ph) * Math.PI) * 0.5 + 0.5,
        lv = Math.min(1, (0.5 + knot * 0.45) * bright);
      for (const k of [-1, 1]) {
        const [sx, sy] = limbPoint(ang, r + Math.sin(s * 14 + t * 2 + L.ph + k) * 0.9 * k);
        spx(sx, sy, shade(lv, Math.round(sx), Math.round(sy)), Math.round(255 * alpha));
        spx(sx + 1, sy, shade(lv * 0.85, Math.round(sx) + 1, Math.round(sy)), Math.round(255 * alpha));
      }
    }
  }
}
function drawSurface(t) {
  const x0 = Math.max(0, Math.floor(CX - R * 1.2)),
    R2 = R * R,
    reach = R * 1.2;
  for (let b = 0; b < STREAK_BINS; b++) {
    // corona streamers depend only on direction, so they're worked out once per frame
    const ang = (b / STREAK_BINS) * Math.PI * 2 - Math.PI;
    streak[b] = noise(ang * 24 + 50, t * 0.15) * 0.7 + noise(ang * 60 + 50, t * 0.3) * 0.3;
  }
  for (let y = 0; y < SH; y++)
    for (let x = x0; x < SW; x++) {
      const dx = x - CX,
        dy = y - CY,
        d2 = dx * dx + dy * dy;
      if (d2 < R2) {
        // surface: limb darkening (redder and dimmer toward the edge) + boiling granulation
        const mu = Math.sqrt(1 - d2 / R2),
          gran = noise(x / 2.4 + t * 0.35, y / 2.4 - t * 0.2) * 0.7 + noise(x / 7 - t * 0.1, y / 7) * 0.3;
        spx(x, y, shade(clamp01(0.3 + Math.pow(mu, 0.4) * 0.66 + (gran - 0.5) * 0.14), x, y));
        continue;
      }
      const d = Math.sqrt(d2);
      if (d > reach) continue;
      // corona: dithered haze with streamers, fading out from the limb
      const st = streak[Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * (STREAK_BINS - 1))],
        fall = 1 - (d - R) / (R * (0.06 + st * 0.12));
      if (fall <= 0 || fall < BAYER[(y & 3) * 4 + (x & 3)] * 0.5) continue;
      spx(x, y, shade(fall * fall * 0.55, x, y), Math.round(40 + 200 * fall * fall));
    }
}
function startEruption(t) {
  // from the part of the limb facing the Earth (screen centre), so the blast heads for the constellation
  sun.erupt = { t0: t, a: Math.atan2(SH / 2 - CY, SW / 2 - CX) + (Math.random() - 0.5) * 0.12, burst: false };
}
function drawEruption(t) {
  const ev = sun.erupt;
  if (!ev) return;
  const e = t - ev.t0;
  if (e < 1.1) {
    // a loop swells up off the limb...
    drawLoop({ a: ev.a, w: 0.13, ph: 1 }, t, (10 + e * e * 60) * size, 1.25);
    return;
  }
  if (!ev.burst) {
    // ...and bursts
    ev.burst = true;
    [ev.bx, ev.by] = limbPoint(ev.a, R + 40 * size);
    // fewer sparks on a smaller screen, so the plume stays sparks rather than a solid cloud
    for (let i = 0; i < 360 * speed; i++) {
      const dir = ev.a + (Math.random() - 0.5) * 0.7,
        sp = (40 + Math.random() * 120) * speed;
      sun.sparks.push({
        x: ev.bx + (Math.random() - 0.5) * 6,
        y: ev.by + (Math.random() - 0.5) * 10,
        vx: Math.cos(dir) * sp,
        vy: Math.sin(dir) * sp,
        life: 1.6 + Math.random() * 2.4,
        age: 0,
        big: Math.random() < 0.15,
      });
    }
  }
  // the shock front: a bright arc racing outward toward the satellites, thinning as it spreads
  const rad = (e - 1.1) * 150 * speed,
    fade = Math.max(0, 1 - rad / (SW * 1.1));
  for (let k = -60; k <= 60; k++) {
    const aa = ev.a + (k / 60) * 0.55,
      edge = 1 - Math.abs(k) / 60,
      lv = (0.35 + edge * 0.6) * fade;
    if (lv < 0.08) continue;
    const r = rad + Math.sin(k * 0.7 + e * 9) * 1.2,
      x = ev.bx + Math.cos(aa) * r,
      y = ev.by + Math.sin(aa) * r;
    spx(x, y, shade(lv, Math.round(x), Math.round(y)), Math.round(255 * Math.min(1, fade * 1.5)));
    spx(x - Math.cos(aa), y - Math.sin(aa), PAL[Math.max(1, Math.round(lv * 5))], Math.round(160 * fade));
    if (edge > 0.4) spx(x - Math.cos(aa) * 2, y - Math.sin(aa) * 2, PAL[2], Math.round(90 * fade));
  }
  sun.flash = e < 1.6 ? 1 - (e - 1.1) / 0.5 : 0;
  if (e > 6) sun.erupt = null;
}
function drawSparks(dt) {
  // the plume: sparks cool from white to red as they fly, with a dim trail
  sun.sparks = sun.sparks.filter(s => (s.age += dt) < s.life);
  sun.sparks.forEach(s => {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 0.995;
    s.vy *= 0.995;
    const k = 1 - s.age / s.life,
      c = PAL[Math.max(1, Math.round(k * (PAL.length - 1)))],
      a = Math.round(255 * Math.min(1, k * 2));
    spx(s.x - s.vx * 0.03, s.y - s.vy * 0.03, PAL[Math.max(0, Math.round(k * 3))], Math.round(140 * k));
    if (s.big) sdisc(s.x, s.y, 1, c, a);
    else spx(s.x, s.y, c, a);
  });
}

export function sunIn() {
  sun.target = 1;
  sun.eruptOnArrival = true;
}
export function sunOut() {
  sun.target = 0;
  sun.eruptOnArrival = false;
}
// drawn first, behind the rings, so satellites stay visible (and clickable) over the plasma
export function drawSun(now) {
  const t = now / 1000,
    dt = Math.min(0.05, Math.max(0, t - (sun.last || t)));
  sun.last = t;
  sun.presence =
    sun.target > sun.presence ? Math.min(sun.target, sun.presence + dt / IN_TIME) : Math.max(sun.target, sun.presence - dt / OUT_TIME);
  sun.flash = 0;
  if (sun.presence <= 0 && !sun.erupt && !sun.sparks.length) return;
  sBuffer();
  // the body arrives over the first 70%, then the loops rise off it; leaving reverses that order
  const body = smooth(clamp01(sun.presence / 0.7)),
    rise = smooth(clamp01((sun.presence - 0.6) / 0.4));
  CX = CX_REST + (1 - body) * (Math.max(SW * 0.06, 10) + R * 0.2);
  if (sun.presence > 0) drawSurface(t);
  // loops grow up out of the surface with their feet planted (fading in), and sink back into it on the way out
  if (rise > 0.03) LOOPS.forEach(L => drawLoop(L, t, (L.h + Math.sin(t * 0.6 + L.ph) * 1.5) * size * rise, 1, rise));
  if (sun.eruptOnArrival && sun.presence >= 1) {
    sun.eruptOnArrival = false;
    startEruption(t);
  }
  drawEruption(t);
  drawSparks(dt);
  sun.canvas.getContext('2d').putImageData(simg, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sun.canvas, 0, 0, SW * SPIX, SH * SPIX);
  ctx.imageSmoothingEnabled = true;
}
// drawn last, over everything on the canvas: the blast reaching the constellation, a pale wash from the sun side in
// hard pixel bands
export function drawSunFlash() {
  if (sun.flash <= 0) return;
  for (let x = 0; x < SW; x++) {
    const a = Math.round(sun.flash * Math.max(0, x / SW - 0.15) * 0.85 * 8) / 8;
    if (a <= 0) continue;
    ctx.fillStyle = `rgba(255,236,190,${a})`;
    ctx.fillRect(x * SPIX, 0, SPIX, H);
  }
}
