import { pushAnomalyAlert } from './alerts.js';
import { satellites } from './constellation.js';
import { EVENT_TYPES, eventBusy } from './events/core.js';
import { state } from './state.js';

let lastAnomalyType = 'thermal',
  anomalyBag = [];
function nextAnomalyType() {
  if (!anomalyBag.length)
    anomalyBag = ['thermal', 'wheel', 'power', 'process', 'orbit', 'solar', 'startracker', 'contact'].sort(() => Math.random() - 0.5);
  let next = anomalyBag.pop();
  if (next === lastAnomalyType) {
    anomalyBag.unshift(next);
    next = anomalyBag.pop() || 'solar';
  }
  return next;
}
export const MAX_CONCURRENT_ANOMALIES = 2,
  ANOMALY_FAIL_WINDOW = 90; // seconds to fix a fault: time to read the ticket, the terminal and the repair
// everyday faults under way (event satellites don't count, so faults keep coming while an event ticket waits)
export const activeFaults = () => satellites.filter(s => s.anomaly && !EVENT_TYPES.includes(s.anomalyType));
export function trySpawnAnomaly(max = MAX_CONCURRENT_ANOMALIES) {
  // no new faults from the moment a celestial event is on its way until it's over (eventBusy covers the intro too);
  // faults already open carry on
  if (eventBusy() || performance.now() < state.faultsAfter) return;
  if (activeFaults().length < max) {
    const available = satellites.filter(s => !s.lost && !s.anomaly && !s.rejoining),
      s = available[Math.floor(Math.random() * available.length)];
    if (s) spawnAnomaly(s, nextAnomalyType());
  }
}
// put a fault of the given type on a satellite and raise its ticket
export function spawnAnomaly(s, type) {
  s.anomaly = true;
  s.anomalyType = type;
  lastAnomalyType = s.anomalyType;
  s.countdown = ANOMALY_FAIL_WINDOW;
  pushAnomalyAlert(s);
}
export function scheduleAnomaly() {
  setTimeout(
    () => {
      trySpawnAnomaly();
      scheduleAnomaly();
    },
    20000 + Math.random() * 20000,
  );
}

export function resetAnomalies() {
  anomalyBag = [];
  lastAnomalyType = 'thermal';
}
