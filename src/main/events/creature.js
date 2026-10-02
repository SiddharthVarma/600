import { pushAlert, satTag } from '../alerts.js';
import { H, W, ctx, point, satellites, updateNetwork } from '../constellation.js';
import { activeEvent, pulse, resolveEvent, startEvent } from './core.js';

// Tentacle event: no window and no procedure. Tentacles reach in from the screen edges for real satellites. Click a
// tentacle to zap it back (it returns angrier and takes more hits); if one grabs a satellite, click the satellite fast
// to fire its thrusters and break free before it's dragged off-screen. Drawn as chunky pixel art in a low-res buffer.
const KPIX = 4,
  KRAKEN_PREY = 5;
const K_OUTLINE = [24, 10, 34],
  K_DARK = [74, 32, 110],
  K_BODY = [118, 58, 168],
  K_LIGHT = [168, 104, 214],
  K_SUCKER = [236, 184, 214],
  K_SUCKER_IN = [150, 78, 140];
export const kraken = { tentacles: [], sparks: [], nextSpawn: 0, last: 0, canvas: document.createElement('canvas') };
let KW = 0,
  KH = 0,
  kimg = null,
  kdata = null;
function kBuffer() {
  const w = Math.ceil(W / KPIX),
    h = Math.ceil(H / KPIX);
  if (w !== KW || h !== KH || !kimg) {
    KW = w;
    KH = h;
    kraken.canvas.width = w;
    kraken.canvas.height = h;
    kimg = kraken.canvas.getContext('2d').createImageData(w, h);
    kdata = kimg.data;
  }
  kdata.fill(0);
}
function kpx(x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= KW || y >= KH) return;
  const i = (y * KW + x) * 4;
  kdata[i] = c[0];
  kdata[i + 1] = c[1];
  kdata[i + 2] = c[2];
  kdata[i + 3] = 255;
}
function kdisc(cx, cy, r, c) {
  const R = Math.ceil(r) + 1;
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (x * x + y * y <= r * r + r * 0.6) kpx(cx + x, cy + y, c);
}
// The arm is a chain whose shape is a wave travelling down it plus a curl toward the tip; the chain is then rotated and
// stretched so the tip lands on the target at reach = 1.
function tentacleChain(base, target, t, reach, wig, curl) {
  const N = 36,
    pts = [[0, 0]];
  let a = 0,
    x = 0,
    y = 0;
  for (let i = 0; i < N; i++) {
    const s = i / (N - 1);
    a += Math.sin(t * 2.4 - s * 7) * 0.06 * wig * (0.25 + s) + curl * s * s * 0.32;
    x += Math.cos(a);
    y += Math.sin(a);
    pts.push([x, y]);
  }
  const end = pts[N],
    rot = Math.atan2(target[1] - base[1], target[0] - base[0]) - Math.atan2(end[1], end[0]);
  const k = Math.max(3, Math.hypot(target[0] - base[0], target[1] - base[1]) * reach) / Math.hypot(end[0], end[1]);
  return pts.map(([u, v]) => [
    base[0] + (u * Math.cos(rot) - v * Math.sin(rot)) * k,
    base[1] + (u * Math.sin(rot) + v * Math.cos(rot)) * k,
  ]);
}
function drawTentacle(pts) {
  const dense = []; // resample so neighbouring discs always overlap, even near the thin tip
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[i + 1],
      steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.7)),
      l = Math.hypot(x1 - x0, y1 - y0) || 1;
    for (let j = 0; j < steps; j++) {
      const f = j / steps,
        s = (i + f) / (pts.length - 1);
      dense.push({
        x: x0 + (x1 - x0) * f,
        y: y0 + (y1 - y0) * f,
        nx: -(y1 - y0) / l,
        ny: (x1 - x0) / l,
        r: 0.9 + 5.6 * Math.pow(1 - s, 1.15),
      });
    }
  }
  dense.forEach(p => kdisc(p.x, p.y, p.r + 1, K_OUTLINE));
  dense.forEach(p => kdisc(p.x, p.y, p.r, K_DARK));
  dense.forEach(p => kdisc(p.x + p.nx * p.r * 0.22, p.y + p.ny * p.r * 0.22, p.r * 0.72, K_BODY));
  dense.forEach(p => p.r > 1.6 && kdisc(p.x + p.nx * p.r * 0.5, p.y + p.ny * p.r * 0.5, p.r * 0.26, K_LIGHT));
  let last = -9; // suckers along the underside
  dense.forEach((p, i) => {
    if (p.r < 1.8 || i - last < Math.max(5, p.r * 2.4)) return;
    last = i;
    const sx = p.x - p.nx * p.r * 0.55,
      sy = p.y - p.ny * p.r * 0.55;
    kdisc(sx, sy, Math.max(0.7, p.r * 0.3), K_SUCKER);
    kpx(sx, sy, K_SUCKER_IN);
  });
  return dense;
}
function kSpark(at, n, c) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2,
      v = 40 + Math.random() * 90;
    kraken.sparks.push({ x: at[0], y: at[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.25, c });
  }
}

function spawnTentacle(now) {
  const ev = activeEvent,
    hunted = kraken.tentacles.filter(tn => tn.state !== 'retreat').map(tn => tn.prey);
  const free = ev.sats.filter(s => !s.lost && !hunted.includes(s));
  if (!free.length) return;
  // keep tentacles apart: skip prey within 55° of a satellite another tentacle is already after
  const ang = sat => {
    const o = point(sat, now);
    return Math.atan2(o.y - H / 2, o.x - W / 2);
  };
  const apart = free.filter(sat =>
    hunted.every(h => Math.abs(((((ang(sat) - ang(h)) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > (55 * Math.PI) / 180),
  );
  if (!apart.length) return;
  const prey = apart[Math.floor(Math.random() * apart.length)];
  kraken.tentacles.push({
    prey,
    reach: 0,
    hp: 1,
    maxHp: 1,
    speed: 0.13,
    state: 'reach',
    stateT: now,
    wig: 1,
    curl: 0.25,
    tug: 0,
    pts: [],
    tip: null,
    phase: Math.random() * 10,
  });
}
export function setTentacleState(tn, state, now) {
  tn.state = state;
  tn.stateT = now;
}
function angrier(tn, now) {
  tn.maxHp = Math.min(3, tn.maxHp + 1);
  tn.hp = tn.maxHp;
  tn.speed *= 1.15;
  tn.tug = 0;
  setTentacleState(tn, 'recoil', now);
}
function zapTentacle(tn, now) {
  kSpark(tn.tip, 14, [255, 236, 160]);
  if (--tn.hp <= 0) angrier(tn, now);
  else tn.reach = Math.max(0, tn.reach - 0.08);
}
function tugSatellite(tn, now) {
  // each click fires the trapped satellite's thrusters
  kSpark(tn.prey.heldAt, 5, [201, 255, 77]);
  tn.tug += 0.14;
  if (tn.tug >= 1) {
    releaseSatellite(tn.prey, now);
    pulse(tn.prey, '201,255,77');
    angrier(tn, now);
  }
}
export function releaseSatellite(s, now) {
  if (s.heldAt) {
    s.driftFrom = s.heldAt;
    s.driftT0 = now;
  }
  s.heldAt = null;
}
function takeSatellite(tn, now) {
  const s = tn.prey;
  s.heldAt = null;
  s.lost = true;
  s.anomaly = false;
  s.anomalyType = null;
  updateNetwork();
  pushAlert({ sat: s, title: `${satTag(s)} · TAKEN`, body: 'Dragged out of orbit.', crit: true });
  setTentacleState(tn, 'retreat', now);
  if (activeEvent && activeEvent.kind === 'kraken' && activeEvent.sats.every(x => x.lost)) resolveEvent(new Set());
}
function updateTentacle(tn, now, dt) {
  const age = (now - tn.stateT) / 1000;
  if (tn.state === 'reach') {
    tn.reach = Math.min(1, tn.reach + tn.speed * dt);
    if (tn.reach >= 1) setTentacleState(tn, 'grab', now);
  } else if (tn.state === 'grab') {
    if (age > 0.45) setTentacleState(tn, 'drag', now);
  } else if (tn.state === 'drag') {
    tn.reach -= 0.07 * dt;
    tn.tug = Math.max(0, tn.tug - 0.1 * dt);
    if (tn.reach <= -0.08) takeSatellite(tn, now);
  } else if (tn.state === 'recoil') {
    tn.reach += (0.12 - tn.reach) * Math.min(1, dt * 10);
    if (age > 0.7) setTentacleState(tn, 'reach', now);
  } else if (tn.state === 'retreat') tn.reach -= dt * 0.35;
  const holding = tn.state === 'grab' || tn.state === 'drag';
  tn.wig += ((tn.state === 'recoil' ? 3.2 : holding ? 1.15 : 1) - tn.wig) * Math.min(1, dt * 6);
  tn.curl += ((holding || tn.carrying ? 1.35 : 0.25) - tn.curl) * Math.min(1, dt * 4);
}
export const krakenLive = () => !!activeEvent && activeEvent.kind === 'kraken'; // while it lasts, everyday anomalies stop: none spawn and their timers pause
export function krakenClick(x, y) {
  // during the attack every click on the rings belongs to the fight
  if (!krakenLive()) return false;
  const now = performance.now(),
    live = kraken.tentacles.filter(tn => tn.state !== 'retreat');
  const held = live.find(tn => tn.prey.heldAt && Math.hypot(tn.prey.heldAt[0] - x, tn.prey.heldAt[1] - y) < 40);
  if (held) {
    tugSatellite(held, now);
    return true;
  }
  const hit = live.find(tn => tn.pts.some(([px, py, r]) => Math.hypot(px - x, py - y) < r + 16));
  if (hit) {
    if (hit.prey.heldAt) tugSatellite(hit, now);
    else zapTentacle(hit, now);
  }
  return true; // during the attack the rings are for fighting: a miss never opens a satellite's panel
}
export function drawKraken(t) {
  const live = activeEvent && activeEvent.kind === 'kraken';
  if (!live && !kraken.tentacles.length && !kraken.sparks.length) return;
  const dt = Math.min(0.05, (t - (kraken.last || t)) / 1000);
  kraken.last = t;
  if (live && t >= kraken.nextSpawn) {
    if (kraken.tentacles.filter(tn => tn.state !== 'retreat').length < 3) spawnTentacle(t);
    kraken.nextSpawn = t + 3000 + Math.random() * 2500;
  }
  kBuffer();
  kraken.tentacles.forEach(tn => {
    updateTentacle(tn, t, dt);
    if (tn.state !== 'retreat') {
      // a retreating arm pulls back along its last line
      const o = point(tn.prey, t),
        dx = o.x - W / 2 || 1e-6,
        dy = o.y - H / 2 || 1e-6,
        k = Math.min((W / 2 + 14) / Math.abs(dx), (H / 2 + 14) / Math.abs(dy));
      tn.target = [o.x, o.y];
      tn.base = [W / 2 + dx * k, H / 2 + dy * k]; // enters from the screen edge in line with its satellite
    }
    // full length at all times: slide the whole arm in from beyond the edge rather than stretching it
    const [bx, by] = tn.base,
      [tx, ty] = tn.target,
      f = Math.max(-0.2, tn.reach);
    const tipAt = [bx + (tx - bx) * f, by + (ty - by) * f],
      rootAt = [tipAt[0] - (tx - bx), tipAt[1] - (ty - by)];
    const pts = tentacleChain(
      [rootAt[0] / KPIX, rootAt[1] / KPIX],
      [tipAt[0] / KPIX, tipAt[1] / KPIX],
      t / 1000 + tn.phase,
      1,
      tn.wig,
      tn.curl,
    );
    const dense = drawTentacle(pts),
      tip = pts[pts.length - 1];
    tn.pts = dense.filter((_, i) => i % 3 === 0).map(p => [p.x * KPIX, p.y * KPIX, p.r * KPIX]);
    tn.tip = [tip[0] * KPIX, tip[1] * KPIX];
    if ((tn.state === 'grab' || tn.state === 'drag' || tn.carrying) && !tn.prey.lost) tn.prey.heldAt = tn.tip;
    if (tn.carrying && tn.reach <= -0.08) {
      tn.carrying = false;
      takeSatellite(tn, t);
    }
  });
  kraken.tentacles = kraken.tentacles.filter(tn => tn.state !== 'retreat' || tn.reach > -0.18);
  kraken.sparks = kraken.sparks.filter(p => (p.life -= dt) > 0);
  kraken.sparks.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    kpx(p.x / KPIX, p.y / KPIX, p.c);
  });
  kraken.canvas.getContext('2d').putImageData(kimg, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(kraken.canvas, 0, 0, KW * KPIX, KH * KPIX);
  ctx.imageSmoothingEnabled = true;
  kraken.tentacles.forEach(tn => {
    // the trapped satellite stays visible inside the curl
    const at = tn.prey.heldAt;
    if (!at) return;
    ctx.beginPath();
    ctx.arc(at[0], at[1], 3.6, 0, Math.PI * 2);
    ctx.fillStyle = '#b06ce0';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(at[0], at[1], 9 + (1 - tn.tug) * 4, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(201,255,77,${0.25 + tn.tug * 0.6})`;
    ctx.stroke(); // fills in as you break free
  });
}
export function scheduleKraken() {
  setTimeout(
    () => {
      triggerKraken();
      scheduleKraken();
    },
    600000 + Math.random() * 300000,
  );
} // rare, so it stays a surprise
export function triggerKraken() {
  if (activeEvent) return;
  // prey only from rings 7 and 9: they orbit the same way, so tentacles chasing them don't sweep into each other
  const pool = satellites.filter(s => !s.lost && !s.anomaly && !s.rejoining && (s.ring === 7 || s.ring === 9)),
    picked = [];
  if (pool.length < KRAKEN_PREY) return;
  while (picked.length < KRAKEN_PREY) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  startEvent('kraken', picked);
  kraken.nextSpawn = performance.now() + 1200;
}

export function resetCreature() {
  kraken.tentacles = [];
  kraken.sparks = [];
  satellites.forEach(s => {
    s.heldAt = null;
    s.driftFrom = null;
  });
}
