import { W, point, ringProgress, satellites } from '../constellation.js';
import { eventBusy, holdForScience, pulse, setEventIncoming, setSunGlow, startEvent } from './core.js';
import { sunIn, sunOut } from './sun.js';

const FLARE_SATS = 7;
export function scheduleFlare() {
  setTimeout(
    () => {
      triggerFlare();
      scheduleFlare();
    },
    230000 + Math.random() * 160000,
  );
}
// the sun rises on the right, so the sunlit side is the right half of the screen
const sunlitSats = now =>
  satellites.filter(s => !s.lost && !s.anomaly && !s.rejoining && ringProgress(s.ring, now) > 0 && point(s, now).x > W * 0.5);
const angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// The flare plays out before it's an event: the sun creeps in and erupts, the satellites in the blast's path are chosen
// when it bursts, and each turns red as the shock front reaches it. The first hit raises the ticket and starts the
// countdown.
let path = [],
  started = false;
export function triggerFlare() {
  if (eventBusy() || holdForScience(triggerFlare) || sunlitSats(performance.now()).length < FLARE_SATS) return;
  setEventIncoming(true);
  setSunGlow(0.4);
  path = [];
  started = false;
  sunIn({ burst: aim, front: sweep, done: finish });
}
function abort() {
  // nothing left to hit (very unlikely): the sun just leaves
  setEventIncoming(false);
  setSunGlow(0);
  sunOut();
}
function aim(front) {
  // in the blast's path: sunlit satellites inside the cone the shock front sweeps, chosen at random; if too few are
  // inside it, the closest to it make up the number
  const now = performance.now(),
    off = s => {
      const p = point(s, now);
      return angleGap(Math.atan2(p.y - front.y, p.x - front.x), front.a);
    };
  const pool = sunlitSats(now),
    inside = pool.filter(s => off(s) < front.span * 0.9).sort(() => Math.random() - 0.5),
    outside = pool.filter(s => !inside.includes(s)).sort((a, b) => off(a) - off(b));
  path = [...inside, ...outside].slice(0, FLARE_SATS);
  if (path.length < FLARE_SATS) abort();
}
function hitSat(s) {
  s.flarePending = false;
  pulse(s, '255,170,90');
}
function sweep(front) {
  const now = performance.now(),
    reached = path.filter(s => {
      const p = point(s, now);
      return Math.hypot(p.x - front.x, p.y - front.y) <= front.r;
    });
  if (!reached.length) return;
  if (!started) {
    // first hit: the flare becomes an event. Satellites that went bad some other way in the meantime are spared.
    path = path.filter(s => !s.lost && !s.anomaly);
    if (!path.length) return abort();
    started = true;
    setEventIncoming(false);
    startEvent('flare', path);
    path.forEach(s => (s.flarePending = true));
  }
  reached.forEach(s => s.flarePending && hitSat(s));
  path = path.filter(s => s.flarePending);
}
function finish() {
  // the front has faded: anything it somehow didn't reach is hit now, so no satellite is left looking healthy
  if (!started && path.length) sweep({ x: 0, y: 0, r: Infinity });
  path.forEach(s => s.flarePending && hitSat(s));
  path = [];
}
