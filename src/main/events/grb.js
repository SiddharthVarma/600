import { H, W, ctx, satellites } from '../constellation.js';
import { EVENTS, activeEvent, eventBusy, eventIncoming, eventsResting, holdForWindow, setEventIncoming, startEvent } from './core.js';

export function scheduleGRB() {
  setTimeout(
    () => {
      triggerGRB();
      scheduleGRB();
    },
    240000 + Math.random() * 160000,
  );
}

// The burst, from a distant galaxy: a white star brightens off to the top right, away from the rings, then bursts in a
// uranium-green flash. Only then are five satellites hit (the ticket arrives with them). Its afterglow stays in the
// sky, fading as the countdown runs, and goes once the event is over.
const BUILD_MS = 2200,
  FLASH_MS = 320,
  SETTLE_MS = 1000, // the burst's peak eases down to the afterglow
  FADE_MS = 900, // the afterglow going, once the event is over
  STAR = '245,250,255',
  URANIUM = '92,255,60',
  PX = 3,
  BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
let grb = null; // { t0, burstAt, endAt }

export function triggerGRB() {
  if (eventBusy() || eventsResting() || holdForWindow(triggerGRB)) return;
  setEventIncoming(true);
  grb = { t0: performance.now(), burstAt: 0, endAt: 0 };
  setTimeout(burst, BUILD_MS);
}
function burst() {
  // a relaunch in the meantime called the whole thing off
  if (!grb || !eventIncoming) return (grb = null);
  setEventIncoming(false);
  const pool = satellites.filter(s => !s.lost && !s.anomaly && !s.rejoining),
    picked = [];
  if (pool.length < 5) return (grb.endAt = performance.now());
  while (picked.length < 5) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  grb.burstAt = performance.now();
  startEvent('grb', picked);
}

// where it sits: in the top-right gap beyond the outer ring, below the credits and LAUNCH. On phones the rings fill the
// width and the tickets the top, so just outside the outer ring on the top-right diagonal.
function spot() {
  if (W > 600) return [W - 115, 175];
  const r = Math.min(W, H) * 0.492 + 22;
  return [W / 2 + r * Math.SQRT1_2, H / 2 - r * Math.SQRT1_2];
}
// a pixel-art glow, dithered on a 3 px grid like the rest of the canvas
function glow(cx, cy, r, peak, rgb) {
  ctx.fillStyle = `rgb(${rgb})`;
  for (let gy = Math.floor((cy - r) / PX) * PX; gy < cy + r; gy += PX)
    for (let gx = Math.floor((cx - r) / PX) * PX; gx < cx + r; gx += PX) {
      const d = Math.hypot(gx - cx, gy - cy) / r;
      if (d >= 1) continue;
      const v = peak * (1 - d) ** 2.2;
      if (v <= ((BAYER[(gy / PX) & 3][(gx / PX) & 3] + 0.5) / 16) * 0.9) continue;
      ctx.globalAlpha = Math.min(1, v);
      ctx.fillRect(gx, gy, PX, PX);
    }
  ctx.globalAlpha = 1;
}
export function drawGRB(t) {
  if (!grb) return;
  const ev = activeEvent && activeEvent.kind === 'grb' ? activeEvent : null;
  if (grb.burstAt && !ev && !grb.endAt) grb.endAt = t; // resolved, or a relaunch
  const [x, y] = spot();
  let r, peak;
  if (!grb.burstAt) {
    // building up: a point brightening into a full glow
    const k = Math.min(1, (t - grb.t0) / BUILD_MS);
    r = 10 + 50 * k ** 1.6;
    peak = 0.5 + 1.0 * k;
  } else {
    // after the burst, the afterglow fades with the countdown
    const left = ev ? ev.left / EVENTS.grb.window : 0,
      after = [18 + 22 * left, 0.6 + 0.5 * left],
      s = Math.min(1, (t - grb.burstAt) / SETTLE_MS);
    r = 76 + (after[0] - 76) * s;
    peak = 1.8 + (after[1] - 1.8) * s;
  }
  if (grb.endAt) {
    const k = (t - grb.endAt) / FADE_MS;
    if (k >= 1) return (grb = null);
    peak *= 1 - k;
  }
  glow(x, y, r, peak, STAR);
  // the flash: a uranium-green wash, brightest from the burst's side of the screen
  const f = grb.burstAt ? 1 - (t - grb.burstAt) / FLASH_MS : 0;
  if (f > 0) {
    const wash = ctx.createRadialGradient(x, y, 0, x, y, 1100);
    wash.addColorStop(0, `rgba(${URANIUM},${0.5 * f})`);
    wash.addColorStop(1, `rgba(${URANIUM},${0.16 * f})`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
  }
}
// the hit satellites' ring: uranium green, pulsing like any fault's, and wider for a moment as the burst lands
export function grbRing(t) {
  const k = grb && grb.burstAt ? Math.min(1, (t - grb.burstAt) / 600) : 1;
  return { r: 14 - 3 * k, colour: `rgba(${URANIUM},${0.95 - 0.2 * k})`, width: 3 - 1.5 * k };
}
