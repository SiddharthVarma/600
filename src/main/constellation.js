import { drawHighlight } from './alerts.js';
import { ANOMALY_FAIL_WINDOW } from './anomalies.js';
import { drawEventFx, flareFlicker } from './events/core.js';
import { drawKraken } from './events/creature.js';
import { drawSun, drawSunFlash } from './events/sun.js';
import { cctx, chart } from './panel.js';
import { state } from './state.js';

export const canvas = document.getElementById('constellation'),
  ctx = canvas.getContext('2d');
const earthImg = new Image();
earthImg.src = '600_earth_assets/earth.png';
export let W, H, dpr;
export const satellites = Array.from({ length: 600 }, (_, i) => ({
  id: i + 1,
  a: (Math.floor(i / 10) / 60) * Math.PI * 2 + (i % 10) * 0.018,
  ring: i % 10,
  r: 0.15 + (i % 10) * 0.038,
  speed: (0.00006 + (i % 10) * 0.000004) * (i % 2 ? -1 : 1),
  phase: 0,
  anomaly: false,
  anomalyType: null,
  countdown: 0,
  lost: false,
  rejoining: false,
  rejoinProgress: 0,
  values: { RSSI: 82, TEMPERATURE: 71, POWER: 68, BATTERY: 91, CPU: 63, TORQUE: 89 },
}));
export function updateNetwork() {
  const active = satellites.filter(s => !s.lost).length;
  const network = document.getElementById('network');
  network.textContent = `CONSTELLATION ${active === 600 ? 'NOMINAL' : 'DEGRADED'} · ${active}/600`;
  if (active === 0) document.getElementById('gameOver').classList.add('show');
}
export function resize() {
  dpr = devicePixelRatio || 1;
  W = innerWidth;
  H = innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  chart.width = chart.clientWidth * dpr;
  chart.height = 90 * dpr;
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
export function point(s, t) {
  const rr = s.r * Math.min(W, H),
    angle = s.a + t * s.speed + s.phase,
    x = W * 0.5 + Math.cos(angle) * rr,
    y = H * 0.5 + Math.sin(angle) * rr;
  return { x, y };
}
const RING_INTRO_DELAY = 1000,
  RING_INTRO_STAGGER = 200,
  RING_INTRO_FADE = 260;
export function ringProgress(i, t) {
  const p = (t - RING_INTRO_DELAY - i * RING_INTRO_STAGGER) / RING_INTRO_FADE;
  return Math.max(0, Math.min(1, p));
}
// Losing a satellite: a tiny burst where it was. A white flash, a few specks scattering and cooling from orange to
// grey, and one speck of debris that drifts on along the orbit before fading.
const BURST_MS = 650,
  DEBRIS_MS = 3200,
  bursts = [];
function noteLoss(s, t) {
  if (s.burst) return;
  s.burst = true;
  if (s.taken || s.sx == null || s.sx < 0 || s.sy < 0 || s.sx > W || s.sy > H) return;
  const along = Math.atan2(s.sy - H / 2, s.sx - W / 2) + (Math.sign(s.speed) || 1) * (Math.PI / 2);
  bursts.push({
    x: s.sx,
    y: s.sy,
    t0: t,
    along,
    specks: Array.from({ length: 7 }, () => ({ a: Math.random() * Math.PI * 2, d: 4 + Math.random() * 8, size: Math.random() < 0.4 ? 2 : 1 })),
  });
}
const COOL = [
  [255, 236, 200],
  [255, 170, 80],
  [220, 80, 50],
  [110, 104, 100],
];
function drawBursts(t) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i],
      age = t - b.t0;
    if (age > DEBRIS_MS) {
      bursts.splice(i, 1);
      continue;
    }
    const k = Math.min(1, age / BURST_MS);
    if (age < 90) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
    }
    if (k < 1) {
      const c = COOL[Math.min(COOL.length - 1, Math.floor(k * COOL.length))],
        out = 1 - Math.pow(1 - k, 2);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${1 - k * 0.7})`;
      b.specks.forEach(p => ctx.fillRect(Math.round(b.x + Math.cos(p.a) * p.d * out), Math.round(b.y + Math.sin(p.a) * p.d * out), p.size, p.size));
    }
    // the debris, drifting on along the orbit
    const d = (age / 1000) * 5;
    ctx.fillStyle = `rgba(150,146,140,${0.8 * (1 - age / DEBRIS_MS)})`;
    ctx.fillRect(Math.round(b.x + Math.cos(b.along) * d), Math.round(b.y + Math.sin(b.along) * d), 1.5, 1.5);
  }
}
export function draw(t) {
  ctx.clearRect(0, 0, W, H);
  drawSun(t);
  const slow = 1,
    unit = Math.min(W, H),
    cx = W * 0.5,
    cy = H * 0.5;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255,255,255,.055)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const rp = ringProgress(i, t);
    if (rp <= 0) continue;
    ctx.globalAlpha = rp;
    ctx.beginPath();
    ctx.arc(0, 0, unit * (0.15 + i * 0.038), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  const earthR = Math.max(19, unit * 0.052);
  if (earthImg.complete && earthImg.naturalWidth) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(earthImg, cx - earthR, cy - earthR, earthR * 2, earthR * 2);
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
    ctx.fill();
  }
  satellites.forEach(s => {
    if (s.lost) return noteLoss(s, t);
    const ringAlpha = ringProgress(s.ring, t);
    if (ringAlpha <= 0) return;
    const earthRatio = earthR / (unit * s.r);
    let decay = s.anomaly && s.anomalyType === 'orbit' ? Math.max(earthRatio, s.countdown / ANOMALY_FAIL_WINDOW) : 1;
    const p = point(s, t * slow);
    let px = W * 0.5 + (p.x - W * 0.5) * decay,
      py = H * 0.5 + (p.y - H * 0.5) * decay;
    if (s.rejoining) {
      s.rejoinProgress = Math.min(1, s.rejoinProgress + 0.006);
      const eased = 1 - Math.pow(1 - s.rejoinProgress, 3);
      px = W * 0.5 + (p.x - W * 0.5) * eased;
      py = H * 0.5 + (p.y - H * 0.5) * eased;
      if (s.rejoinProgress >= 1) {
        s.rejoining = false;
        if (state.selected === s) document.getElementById('log').textContent = 'TELEMETRY NOMINAL · ORBIT RESTORED';
      }
    }
    if (s.heldAt) {
      px = s.heldAt[0];
      py = s.heldAt[1];
    } else if (s.driftFrom) {
      const k = Math.min(1, (performance.now() - s.driftT0) / 1500),
        e = 1 - Math.pow(1 - k, 3);
      px = s.driftFrom[0] + (px - s.driftFrom[0]) * e;
      py = s.driftFrom[1] + (py - s.driftFrom[1]) * e;
      if (k >= 1) s.driftFrom = null;
    }
    s.sx = px;
    s.sy = py;
    const hot = s.anomaly && !s.flarePending; // a flare satellite turns red when the shock front reaches it
    ctx.globalAlpha = (s.rejoining ? 0.8 : 1) * ringAlpha * (hot && s.anomalyType === 'flare' ? flareFlicker(t) : 1);
    ctx.beginPath();
    ctx.arc(px, py, hot ? 3.6 : 1.5, 0, Math.PI * 2);
    ctx.fillStyle = hot
      ? s.anomalyType === 'kraken'
        ? '#b06ce0'
        : '#ff4d4d'
      : `rgba(255,255,255,${0.38 + 0.35 * (0.5 + 0.5 * Math.sin(s.phase + t * 0.0005))})`;
    ctx.fill();
    if (hot) {
      ctx.beginPath();
      ctx.arc(px, py, 11 + Math.sin(t * 0.003) * 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = s.anomalyType === 'kraken' ? 'rgba(176,108,224,.5)' : 'rgba(255,77,77,.3)';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  drawBursts(t);
  drawEventFx(t);
  drawKraken(t);
  drawHighlight(t);
  drawSunFlash();
  requestAnimationFrame(draw);
}
