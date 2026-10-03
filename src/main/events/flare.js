import { W, point, ringProgress, satellites } from '../constellation.js';
import { activeEvent, setSunGlow, startEvent } from './core.js';
import { sunIn } from './sun.js';

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
export function triggerFlare() {
  if (activeEvent) return;
  const now = performance.now();
  // the flash comes in from the right, so the sunlit side is the right half of the screen
  const sunlit = satellites.filter(
    s => !s.lost && !s.anomaly && !s.rejoining && ringProgress(s.ring, now) > 0 && point(s, now).x > W * 0.5,
  );
  if (sunlit.length < FLARE_SATS) return;
  const picked = [];
  while (picked.length < FLARE_SATS) picked.push(sunlit.splice(Math.floor(Math.random() * sunlit.length), 1)[0]);
  startEvent('flare', picked);
  sunIn(); // the sun creeps in from the right and erupts once it has arrived
  setSunGlow(0.4);
}
