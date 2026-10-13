// Entry point for the constellation page: wires the modules to the page, starts the clocks, and handles
// messages from the minigame windows. Each feature lives in its own module next to this one.
import { clearAlerts, pushAlert, pushAnomalyAlert, satTag, updateAlerts } from './alerts.js';
import { ANOMALY_FAIL_WINDOW, resetAnomalies, trySpawnAnomaly } from './anomalies.js';
import { canvas, draw, H, point, resize, ringProgress, satellites, updateNetwork, W } from './constellation.js';
import { abortEvent, activeEvent, eventActive, pulses, renderFleetStatus, resetEvents, resolveEvent, tickEvent } from './events/core.js';
import { kraken, krakenClick, krakenLive, resetCreature, triggerKraken } from './events/creature.js';
import { triggerDebris } from './events/debris.js';
import { triggerFlare } from './events/flare.js';
import { triggerGRB } from './events/grb.js';
import { pacingStage } from './pacing.js';
import { closeRepair, launchers, startIfReady } from './launcher.js';
import { replayIntro, startIntro } from './intro.js';
import { closePanel, openSat, panel, renderCountdown, renderSat } from './panel.js';
import { closeLaunch, earn, launchMessage, resetCredits } from './credits.js';
import { closeScience, pushScience, resetScience, scheduleScience, scienceMessage } from './science.js';
import { state } from './state.js';
import { touchScroll } from '../shared/touchscroll.js';
import { promptEl, term, termNote, termRunFile, UPLINK_STATIONS } from './terminal.js';

// phones: the same test as the phone CSS
const PHONE = matchMedia('(max-width: 600px) and (pointer: coarse)');
// After a repair the uplink gets out of the way, so nothing behind it (tickets, a flare) stays hidden, but not at once:
// the repair window fades first, then the outcome (STATUS, the terminal's last line, the crosshair) holds long enough
// to read. If another satellite or an emergency has been opened by then, it stays open.
const READ_TIME = 1800;
function closeWhenRead(s) {
  setTimeout(() => {
    if (state.selected === s && panel.classList.contains('open')) closePanel();
  }, READ_TIME);
}

document.getElementById('restartAll').onclick = () => {
  satellites.forEach(s => {
    s.anomaly = false;
    s.anomalyType = null;
    s.countdown = 0;
    s.lost = false;
    s.rejoining = false;
    s.rejoinProgress = 0;
    s.flarePending = false;
    s.burst = false;
    s.taken = false;
  });
  resetAnomalies();
  state.selected = null;
  state.highlighted = [];
  clearAlerts();
  resetScience();
  closeLaunch();
  resetCredits();
  resetEvents();
  resetCreature();
  document.getElementById('gameOver').classList.remove('show');
  panel.classList.remove('open');
  updateNetwork();
};
updateNetwork();
addEventListener('resize', resize);
resize();
requestAnimationFrame(draw);
canvas.addEventListener('click', e => {
  if (eventActive()) return;
  const rect = canvas.getBoundingClientRect(),
    x = e.clientX - rect.left,
    y = e.clientY - rect.top;
  if (krakenClick(x, y)) return;
  const unit = Math.min(W, H),
    earthR = Math.max(19, unit * 0.052);
  let best = null,
    dist = Infinity;
  satellites.forEach(s => {
    if (s.lost || ringProgress(s.ring, performance.now()) <= 0) return;
    const base = point(s, performance.now()),
      earthRatio = earthR / (unit * s.r),
      decay = s.anomaly && s.anomalyType === 'orbit' ? Math.max(earthRatio, s.countdown / ANOMALY_FAIL_WINDOW) : 1,
      px = W * 0.5 + (base.x - W * 0.5) * decay,
      py = H * 0.5 + (base.y - H * 0.5) * decay,
      hit = s.anomaly ? 95 : 70,
      d = Math.hypot(px - x, py - y);
    if (d < hit && d < dist) {
      dist = d;
      best = s;
    }
  });
  if (best) openSat(best);
});
document.getElementById('close').onclick = closePanel;
term.addEventListener('click', e => {
  const f = e.target.closest('.term-file');
  if (f) termRunFile(f.dataset.file);
});
document.getElementById('scienceClose').onclick = closeScience;
document.getElementById('sudoHelp').onclick = replayIntro;
document.getElementById('repairClose').onclick = () => {
  closeRepair();
  termNote('procedure aborted', 'term-warn');
};
window.addEventListener('message', e => {
  if (e.data?.type === 'repair-loaded') {
    const L = Object.values(launchers).find(l => l.frame.contentWindow === e.source);
    if (L) {
      L.loaded = true;
      startIfReady(L);
    }
    return;
  }
  if (e.data?.type === 'launch-complete' || e.data?.type === 'launch-close') {
    launchMessage(e.data);
    return;
  }
  if (e.data?.type === 'science-complete' || e.data?.type === 'science-close') {
    scienceMessage(e.data);
    return;
  }
  if (e.data?.type === 'grb-resolved' || e.data?.type === 'flare-resolved') {
    resolveEvent(new Set((e.data.results || []).filter(r => r.fixed).map(r => +r.satId)));
    return;
  }
  if (e.data?.type === 'debris-resolved') {
    resolveEvent(new Set(e.data.survived && activeEvent ? activeEvent.sats.map(s => s.id) : []));
    return;
  }
  if (!state.selected) return;
  if (e.data?.type === 'repair-complete') {
    const wasOrbit = state.selected.anomalyType === 'orbit';
    state.selected.anomaly = false;
    state.selected.anomalyType = null;
    state.selected.countdown = 0;
    state.selected.lost = false;
    state.selected.rejoining = wasOrbit;
    state.selected.rejoinProgress = wasOrbit ? 0 : 1;
    document.getElementById('log').textContent = wasOrbit
      ? 'SUCCESSFUL EXECUTION · REJOINING ORBIT'
      : 'SUCCESSFUL EXECUTION · TELEMETRY NOMINAL';
    pushAlert({
      sat: state.selected,
      title: `${satTag(state.selected)} · RECOVERED`,
      body: wasOrbit ? 'Rejoining orbit.' : 'Telemetry nominal.',
    });
    updateAlerts();
    termNote('procedure complete · telemetry nominal', 'term-ok');
    closeRepair();
    renderSat(state.selected);
    closeWhenRead(state.selected);
  } else if (e.data?.type === 'repair-failed') {
    state.selected.anomaly = false;
    state.selected.anomalyType = null;
    state.selected.countdown = 0;
    state.selected.lost = true;
    state.selected.rejoining = false;
    updateNetwork();
    document.getElementById('log').textContent = 'SATELLITE COMMANDED TOO LATE · SATELLITE LOST';
    pushAlert({ sat: state.selected, title: `${satTag(state.selected)} · SIGNAL LOST`, body: 'Commanded too late.', crit: true });
    updateAlerts();
    termNote('link lost · satellite unrecoverable', 'term-err');
    closeRepair();
    closeWhenRead(state.selected);
  }
});
// SUDO's walkthrough opens every visit; once it hands over (or is skipped), pacing.js ramps the game up
startIntro();
document.querySelectorAll('[data-abort]').forEach(b => {
  b.onclick = abortEvent;
});
// the first science request comes somewhere in the given window, in seconds; after that on its own interval
const firstEvent = (trigger, schedule, from, to) =>
  setTimeout(
    () => {
      trigger();
      schedule();
    },
    (from + Math.random() * (to - from)) * 1000,
  );
firstEvent(pushScience, scheduleScience, 30, 50);
setInterval(() => {
  const ticking = krakenLive() ? [] : satellites.filter(s => s.anomaly && s.countdown > 0 && !s.frozen); // frozen: the intro's first fault waits for the player
  ticking.forEach(s => {
    s.countdown--;
    if (s.countdown === 0) {
      const wasOrbit = s.anomalyType === 'orbit';
      s.anomaly = false;
      s.anomalyType = null;
      s.lost = true;
      updateNetwork();
      if (state.selected === s)
        document.getElementById('log').textContent = wasOrbit
          ? 'SIGNAL LOST · SATELLITE BELOW RECOVERY ALTITUDE'
          : 'SIGNAL LOST · SATELLITE UNRECOVERABLE';
      pushAlert({
        sat: s,
        title: `${satTag(s)} · SIGNAL LOST`,
        body: wasOrbit ? 'Satellite below recovery altitude.' : 'Satellite unrecoverable.',
        crit: true,
      });
    } else if (state.selected === s) renderCountdown(s);
  });
  tickEvent();
  renderFleetStatus();
  updateAlerts();
}, 1000);

// Console hooks for testing in the browser (Inspect → Console): trigger events and look at live state.
// Module code doesn't put anything on window by itself, so these are exposed on purpose.
Object.assign(window, {
  triggerFlare,
  triggerDebris,
  triggerGRB,
  triggerKraken,
  trySpawnAnomaly,
  pushAnomalyAlert,
  pushScience,
  earn,
  pacingStage,
  replayIntro,
  renderSat,
  eventActive,
  point,
  satellites,
  kraken,
  panel,
  UPLINK_STATIONS,
});
Object.defineProperties(window, {
  activeEvent: { get: () => activeEvent },
  pulses: { get: () => pulses },
  promptEl: { get: () => promptEl },
  W: { get: () => W },
  H: { get: () => H },
  selected: {
    get: () => state.selected,
    set: v => {
      state.selected = v;
    },
  },
  highlighted: { get: () => state.highlighted },
});

// Phones only (same test as the phone CSS): the side panel scrolls itself, because iPhone Safari won't scroll it by swiping.
if (PHONE.matches) touchScroll(panel);
