import { W, point, ringProgress, satellites } from '../constellation.js';
import { activeEvent, setSunGlow, startEvent } from './core.js';

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
  const flash = document.getElementById('flareFlash');
  flash.classList.add('on');
  setTimeout(() => flash.classList.remove('on'), 180);
  setSunGlow(0.4);
}
