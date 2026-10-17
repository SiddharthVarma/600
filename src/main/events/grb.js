import { satellites } from '../constellation.js';
import { eventBusy, holdForWindow, pulse, startEvent } from './core.js';

export function scheduleGRB() {
  setTimeout(
    () => {
      triggerGRB();
      scheduleGRB();
    },
    240000 + Math.random() * 160000,
  );
}
export function triggerGRB() {
  if (eventBusy() || holdForWindow(triggerGRB)) return;
  const pool = satellites.filter(s => !s.lost && !s.anomaly && !s.rejoining),
    picked = [];
  if (pool.length < 5) return;
  while (picked.length < 5) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  startEvent('grb', picked);
  picked.forEach(s => pulse(s, '205,190,255', 1100, 0.05)); // no warning: one sudden ping as the burst lands
}
