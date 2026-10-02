import { ctx } from './constellation.js';
import { activeEvent, eventActive, eventTicketBody, openEventTicket } from './events/core.js';
import { state } from './state.js';

// SCID-UI alerts: an anomaly alert stays until the anomaly is resolved or the satellite is lost; the rest fade on their own.
// Clicking an alert highlights that satellite on the rings so the player can find it and click it.
const ALERT_LABELS = {
  thermal: 'THERMAL FAULT',
  power: 'POWER INSTABILITY',
  solar: 'SOLAR ARRAY MISALIGNED',
  wheel: 'REACTION WHEEL FAULT',
  process: 'CPU OVERLOAD',
  orbit: 'ORBITAL DECAY',
  startracker: 'STAR TRACKER LOST LOCK',
  contact: 'MISSED CONTACT WINDOW',
};
const alertsEl = document.getElementById('alerts'),
  MAX_ALERTS = 4;
let alerts = [];
export const satTag = s => `SAT ${String(s.id).padStart(3, '0')}`;
const countdownText = s => (s.anomalyType === 'orbit' ? `Impact in ${s.countdown}s` : `Lost in ${s.countdown}s if unresolved`);
export function pushAlert({ sat = null, event = null, title, body, crit = false, sticky = false, emergency = false }) {
  const el = document.createElement('div');
  el.className = 'alert' + (crit ? ' crit' : '') + (emergency ? ' emergency' : '');
  // a problem ticket can't be dismissed: it leaves only when the satellite is fixed or lost
  el.innerHTML =
    (sticky ? '' : '<button class="alert-x" aria-label="Dismiss">×</button>') +
    '<div class="alert-head"><span class="alert-icon">🛰️</span><span class="alert-app">SCID-UI ALERTS' +
    (emergency ? ' · EMERGENCY' : '') +
    '</span><span class="alert-time">now</span></div><div class="alert-title"></div><div class="alert-body"></div>';
  el.querySelector('.alert-title').textContent = title;
  el.querySelector('.alert-body').textContent = body;
  const a = { sat, event, type: sat?.anomalyType, sticky, el, born: Date.now() };
  el.onclick = e => {
    if (e.target.closest('.alert-x')) dismissAlert(a);
    else if (a.event) openEventTicket(a.event);
    else if (a.sat) highlightSat(a.sat);
  };
  alertsEl.prepend(el);
  alerts.unshift(a);
  if (!sticky) a.timer = setTimeout(() => dismissAlert(a), 6000);
  while (alerts.length > MAX_ALERTS) dismissAlert([...alerts].reverse().find(x => !x.sticky) || alerts[alerts.length - 1]); // drop the oldest passing alert first
}
function dismissAlert(a) {
  if (!alerts.includes(a)) return;
  alerts = alerts.filter(x => x !== a);
  clearTimeout(a.timer);
  a.el.classList.add('out');
  setTimeout(() => a.el.remove(), 300);
}
export function clearAlerts() {
  alerts.slice().forEach(dismissAlert);
}
export function pushAnomalyAlert(s) {
  pushAlert({
    sat: s,
    title: `${satTag(s)} · ${ALERT_LABELS[s.anomalyType] || 'ANOMALY'}`,
    body: countdownText(s),
    crit: true,
    sticky: true,
  });
}
export function updateAlerts() {
  alerts.slice().forEach(a => {
    if (a.event) {
      if (activeEvent !== a.event) {
        dismissAlert(a);
        return;
      }
      a.el.querySelector('.alert-body').textContent = eventTicketBody(a.event);
    } else if (a.sticky) {
      if (!a.sat.anomaly || a.sat.anomalyType !== a.type || a.sat.countdown <= 0) {
        dismissAlert(a);
        return;
      }
      a.el.querySelector('.alert-body').textContent = countdownText(a.sat);
    }
    const mins = Math.floor((Date.now() - a.born) / 60000);
    a.el.querySelector('.alert-time').textContent = mins ? `${mins}m ago` : 'now';
  });
}
function highlightSat(s) {
  if (eventActive() || s.lost) return;
  state.highlighted = [s];
  state.highlightAt = performance.now();
} // a lost satellite is gone from the rings, so there's nothing to point at
export function drawHighlight(t) {
  state.highlighted = state.highlighted.filter(s => !s.lost);
  state.highlighted.forEach(s => s.sx != null && drawCrosshair(s, t));
}
function drawCrosshair(s, t) {
  const x = s.sx,
    y = s.sy,
    r = 16 + Math.sin(t * 0.006) * 1.5,
    k = 6,
    age = Math.max(0, t - state.highlightAt),
    rgb = s.anomalyType === 'kraken' ? '176,108,224' : s.anomaly ? '255,77,77' : '230,231,228'; // red while faulty, white once recovered
  ctx.strokeStyle = `rgb(${rgb})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); // corner-bracket target around the satellite
  [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].forEach(([dx, dy]) => {
    ctx.moveTo(x + dx * r, y + dy * (r - k));
    ctx.lineTo(x + dx * r, y + dy * r);
    ctx.lineTo(x + dx * (r - k), y + dy * r);
  });
  ctx.stroke();
  ctx.lineWidth = 1;
  if (age < 900) {
    ctx.beginPath();
    ctx.arc(x, y, 14 + age * 0.07, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb},${1 - age / 900})`;
    ctx.stroke();
  } // one ripple to draw the eye
}
