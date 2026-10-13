import { state } from './state.js';
import { termReset, termSat } from './terminal.js';

// The uplink window, docked in the bottom-right corner: the satellite (or, during an emergency, the fleet), its STATUS
// line, which names the procedure to run, and the terminal. It's small on purpose, so a flare or the creature stays in
// view behind it.
export const panel = document.getElementById('panel');
const LABELS = {
  orbit: 'ORBITAL DECAY',
  solar: 'SOLAR ARRAY MISALIGNED',
  startracker: 'STAR TRACKER LOST LOCK',
  contact: 'MISSED CONTACT WINDOW',
  wheel: 'REACTION WHEEL FAULT',
  power: 'POWER INSTABILITY',
  process: 'CPU OVERLOAD',
  thermal: 'THERMAL FAULT',
  flare: 'RADIO BLACKOUT',
  debris: 'DEBRIS ON COLLISION COURSE',
  bitflip: 'MEMORY CORRUPTED',
  kraken: '????????',
};
export function renderSat(s) {
  panel.classList.remove('fleet');
  if (termSat !== s) termReset(s);
  document.getElementById('satName').textContent = `SAT ${String(s.id).padStart(3, '0')} · COMMAND UPLINK`;
  const label = s.anomaly ? LABELS[s.anomalyType] || 'DEGRADED' : 'NOMINAL';
  document.getElementById('status').textContent = `STATUS: ${label}`;
  document.getElementById('status').className = 'status ' + (s.anomaly ? 'degraded' : 'ok');
  renderCountdown(s);
}
// the line under the terminal: how long the satellite has left (kept current once a second)
export function renderCountdown(s) {
  if (s.anomaly && s.countdown > 0)
    document.getElementById('log').textContent =
      s.anomalyType === 'orbit' ? `ORBIT DECAY · IMPACT IN ${s.countdown}s` : `SATELLITE LOST IN ${s.countdown}s IF UNRESOLVED`;
}
// open a satellite's uplink (from its ticket or by clicking it on the rings); the crosshair stays on it while it's open
export function openSat(s) {
  if (s.lost) return;
  state.selected = s;
  state.highlighted = [s];
  state.highlightAt = performance.now();
  renderSat(s);
  panel.classList.add('open');
}
export function closePanel() {
  panel.classList.remove('open');
  state.highlighted = state.highlighted.filter(x => x !== state.selected);
  state.selected = null;
}
