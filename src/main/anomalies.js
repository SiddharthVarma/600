import { pushAnomalyAlert } from './alerts.js';
import { satellites } from './constellation.js';
import { EVENT_TYPES, eventActive } from './events/core.js';
import { krakenLive } from './events/creature.js';

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
  ANOMALY_FAIL_WINDOW = 60;
// event satellites don't count toward the limit, so everyday faults keep coming while an event ticket waits
export function trySpawnAnomaly() {
  if (eventActive() || krakenLive()) return;
  const activeCount = satellites.filter(s => s.anomaly && !EVENT_TYPES.includes(s.anomalyType)).length;
  if (activeCount < MAX_CONCURRENT_ANOMALIES) {
    const available = satellites.filter(s => !s.lost && !s.anomaly && !s.rejoining),
      s = available[Math.floor(Math.random() * available.length)];
    if (s) {
      s.anomaly = true;
      s.anomalyType = nextAnomalyType();
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
      document.getElementById('hint').innerHTML = 'anomaly detected · locate the <span style="color:var(--danger)">red</span> signal';
      pushAnomalyAlert(s);
    }
  }
}
export function scheduleAnomaly() {
  setTimeout(
    () => {
      trySpawnAnomaly();
      scheduleAnomaly();
    },
    4000 + Math.random() * 6000,
  );
}

export function resetAnomalies() {
  anomalyBag = [];
  lastAnomalyType = 'thermal';
}
