import { satellites } from '../constellation.js';
import { eventBusy, holdForScience, startEvent } from './core.js';

const DEBRIS_RING_SIZE = 60,
  DEBRIS_CLUSTER = 10;
function pickDebrisCluster() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const ring = Math.floor(Math.random() * 10),
      k0 = Math.floor(Math.random() * DEBRIS_RING_SIZE);
    const group = Array.from({ length: DEBRIS_CLUSTER }, (_, j) => satellites[10 * ((k0 + j) % DEBRIS_RING_SIZE) + ring]);
    if (group.every(s => !s.lost && !s.anomaly && !s.rejoining)) return group; // never take over a satellite that's already mid-problem
  }
  return null;
}
export function scheduleDebris() {
  setTimeout(
    () => {
      triggerDebris();
      scheduleDebris();
    },
    260000 + Math.random() * 160000,
  );
}
export function triggerDebris() {
  if (eventBusy() || holdForScience(triggerDebris)) return;
  const group = pickDebrisCluster();
  if (group) startEvent('debris', group);
}
