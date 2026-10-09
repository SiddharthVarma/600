import { pushAnomalyAlert } from './alerts.js';
import { satellites } from './constellation.js';
import { EVENT_TYPES, eventActive } from './events/core.js';
import { krakenLive } from './events/creature.js';
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
  if (eventActive() || krakenLive() || state.intro) return;
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
  if (s.anomalyType === 'thermal') {
    s.values.TEMPERATURE = 78;
    s.values.POWER = 82;
  }
  if (s.anomalyType === 'contact') s.values.RSSI = 52;
  if (s.anomalyType === 'power') s.values.POWER = 32;
  if (s.anomalyType === 'solar') s.values.BATTERY = 31;
  if (s.anomalyType === 'wheel') s.values.TORQUE = 34;
  if (s.anomalyType === 'process') s.values.CPU = 98;
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
