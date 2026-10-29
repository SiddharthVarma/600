import { pushAlert, updateAlerts } from '../alerts.js';
import { H, W, ctx, updateNetwork } from '../constellation.js';
import { kraken, releaseSatellite, setTentacleState } from './creature.js';
import { sunOut } from './sun.js';
import { cancelPreload, closeRepair, fadeCloseModal, launcher, preload, reveal } from '../launcher.js';
import { panel } from '../panel.js';
import { state } from '../state.js';
import {
  FLEET,
  promptEl,
  sleep,
  termEvent,
  termFleet,
  termLine,
  termLsFleet,
  termNote,
  termPrompt,
  termRun,
  termSat,
} from '../terminal.js';

export let activeEvent = null,
  pulses = [],
  eventIncoming = false;
export const eventActive = () => !!activeEvent && activeEvent.phase === 'running'; // a pending event's ticket doesn't lock anything
// no repair, science or launch window can open: while an event's minigame is running, and for the whole of the
// creature's attack, which plays out on the main screen (a window over it would hide the tentacles taking satellites)
export const windowsBlocked = () => eventActive() || (!!activeEvent && activeEvent.kind === 'kraken');
// no new celestial event while one is live or on its way (a flare builds up for a few seconds before it has a ticket)
export const eventBusy = () => !!activeEvent || eventIncoming || state.intro;
// the quiet spell after the creature: no new celestial event until it's over (everyday faults have their own, shorter one)
export const eventsResting = () => performance.now() < state.eventsAfter;
export function setEventIncoming(v) {
  eventIncoming = v;
}
// A celestial event that comes due while a window is open (a repair, a science request, launch control) waits, and
// starts as soon as the window closes, so its arrival is never missed, no countdown runs unseen, and nothing lands on
// top of a minigame in progress. Only the first waits; any others that come due skip their turn as usual. A relaunch
// cancels it.
let held = null,
  heldGen = 0;
export const eventHeld = () => !!held;
const repairOpen = () => document.getElementById('repairModal').classList.contains('show');
export function holdForWindow(trigger) {
  if (!state.science && !state.launch && !repairOpen()) return false;
  held ||= trigger;
  return true;
}
export function releaseHeldEvent() {
  const trigger = held,
    gen = heldGen;
  held = null;
  // once the window has faded away
  if (trigger) setTimeout(() => gen === heldGen && trigger(), 600);
}

// Celestial events. An event marks its satellites, plays its effect in the sky and posts a CRITICAL ticket with a
// countdown. The player answers when ready: the ticket opens the ops computer in emergency/, the matching script
// streams its uplink log (each satellite pulses as its command lands), then the event minigame opens. A ticket left
// to run out resolves as a total loss.
export const EVENTS = {
  debris: {
    window: 55,
    script: 'debris_avoidance.py',
    verb: 'maneuver',
    game: 'debris',
    modal: 'debrisModal',
    frame: 'debrisFrame',
    name: 'DEBRIS FIELD',
    title: 'NORAD · DEBRIS ON COLLISION COURSE',
  },
  flare: {
    window: 50,
    script: 'flare_reconnect.py',
    verb: 'reconnect',
    game: 'flare',
    modal: 'flareModal',
    frame: 'flareFrame',
    name: 'SOLAR FLARE',
    title: 'PARKER SOLAR PROBE · SOLAR FLARE DETECTED',
  },
  kraken: { window: 45, script: null, name: 'UNIDENTIFIED CONTACT', title: 'SETI · UNIDENTIFIED.... CREATURE???' }, // played on the main screen, no procedure
  grb: {
    window: 100, // the same 100 s its minigame gives, as one countdown from ticket to fix
    script: 'grb_scrub.py',
    verb: 'scrub',
    game: 'bitflip',
    modal: 'grbModal',
    frame: 'grbFrame',
    name: 'GAMMA-RAY BURST',
    title: 'FERMI · GAMMA-RAY BURST DETECTED',
  },
};
export const EVENT_TYPES = ['debris', 'flare', 'bitflip', 'kraken'];
const planeTag = ev => String(ev.sats[0].ring + 1).padStart(2, '0');
export function eventTicketBody(ev) {
  if (ev.phase === 'running') return 'Response in progress.';
  const m = `${Math.floor(ev.left / 60)}:${String(ev.left % 60).padStart(2, '0')}`;
  if (ev.kind === 'kraken') return 'It needs to feed...';
  return ev.kind === 'debris'
    ? `Impact in ${m} · plane ${planeTag(ev)} · ${ev.sats.length} satellites`
    : ev.kind === 'flare'
      ? `Radio blackout in ${m} · ${ev.sats.length} satellites`
      : `${ev.sats.length} satellites corrupted · fault spreads in ${m}`; // a GRB arrives at light speed: the damage is already done
}
export function startEvent(kind, sats) {
  sats.forEach(s => {
    s.anomaly = true;
    s.anomalyType = kind === 'grb' ? 'bitflip' : kind;
    s.countdown = 0;
  });
  const now = performance.now();
  activeEvent = {
    kind,
    sats,
    left: EVENTS[kind].window,
    phase: 'pending',
    tickAt: now,
    bits: Array.from({ length: 18 }, () => ({ da: Math.random() * 0.3 - 0.15, dr: Math.random() * 10 - 5, sz: 1 + Math.random() * 1.4 })),
  };
  pushAlert({
    event: activeEvent,
    title: EVENTS[kind].title,
    body: eventTicketBody(activeEvent),
    crit: true,
    sticky: true,
    emergency: true,
  });
}
export function openEventTicket(ev) {
  if (eventActive() || activeEvent !== ev) return;
  state.highlighted = ev.sats.filter(s => !s.lost);
  state.highlightAt = performance.now();
  state.selected = null;
  panel.classList.add('open', 'fleet');
  document.getElementById('satName').textContent = `${EVENTS[ev.kind].name} · FLEET OPERATIONS`;
  document.getElementById('log').textContent = '';
  renderFleetStatus();
  // a new emergency gets a fresh session; the same one (e.g. after an abort) keeps its history but lists the scripts again
  if (termSat !== FLEET || termEvent !== ev) termFleet(ev);
  else if (promptEl) {
    promptEl.remove();
    termLsFleet();
  }
}
export function renderFleetStatus() {
  if (!panel.classList.contains('fleet')) return;
  const st = document.getElementById('status');
  st.className = 'status ' + (activeEvent ? 'degraded' : 'ok');
  st.textContent = !activeEvent
    ? 'STATUS: NO ACTIVE EMERGENCY'
    : activeEvent.kind === 'kraken'
      ? 'STATUS: ?????'
      : `STATUS: ${eventTicketBody(activeEvent).replace(/\.$/, '').toUpperCase()}`;
}
function emergencyLog(file, ev, accepted) {
  const verb = Object.values(EVENTS).find(e => e.script === file).verb;
  if (!accepted)
    return [
      [`POST /api/fleet/${verb}  201`, 'term-muted'],
      ['400 rejected · no matching emergency', 'term-err'],
    ];
  const tc = () =>
    '0x' +
    Math.floor(0x1000 + Math.random() * 0xefff)
      .toString(16)
      .toUpperCase();
  const source = {
    debris: `NORAD conjunction data pulled · plane ${planeTag(ev)}`,
    flare: 'Parker Solar Probe flare report pulled',
    grb: 'Fermi GBM trigger pulled',
  }[ev.kind];
  return [
    [source, 'term-muted'],
    [`s3://600-ops/fleet/${verb}.db found`, 'term-muted'],
    [`POST /api/fleet/${verb}  201`, 'term-muted'],
    ...ev.sats.filter(s => !s.lost).map(s => [`TC ${tc()} → SAT ${String(s.id).padStart(3, '0')}  accepted`, '', s]),
    ['202 accepted · handing control to operator', 'term-ok'],
  ];
}
export async function runEmergency(file, run) {
  const ev = activeEvent,
    accepted = !!ev && ev.phase === 'pending' && EVENTS[ev.kind].script === file;
  const L = accepted && eventLauncher(ev);
  // the gamma-ray burst's ticket is a deadline, so its minigame carries on the same countdown (the flare's and the
  // debris field's minigames last as long as the blackout or the pass itself, so they keep their own)
  if (accepted)
    preload(
      L,
      `react.html?type=${EVENTS[ev.kind].game}&sats=${ev.sats
        .filter(s => !s.lost)
        .map(s => s.id)
        .join(',')}`,
      () => (ev.kind === 'grb' ? ev.left : null),
    );
  for (const [text, cls, sat] of emergencyLog(file, ev, accepted)) {
    await sleep(90 + Math.random() * 140);
    if (run !== termRun) return L && cancelPreload(L);
    termLine(text, cls);
    if (sat) pulse(sat, '230,231,228'); // the command lands: that satellite blinks on the rings
  }
  if (!accepted) {
    termLsFleet();
    return;
  }
  await sleep(450);
  if (run !== termRun) return cancelPreload(L);
  termPrompt(FLEET);
  if (activeEvent === ev && ev.phase === 'pending') launchEvent(ev);
  else cancelPreload(L);
}
const eventLauncher = ev => launcher(EVENTS[ev.kind].frame, EVENTS[ev.kind].modal);
function launchEvent(ev) {
  ev.phase = 'running';
  state.highlighted = [];
  updateAlerts();
  renderFleetStatus();
  panel.classList.remove('open');
  if (document.getElementById('repairModal').classList.contains('show')) closeRepair();
  reveal(eventLauncher(ev));
}
export function abortEvent() {
  // × on an event window: back to waiting, countdown running again, the ticket opens it for another try
  const ev = activeEvent;
  if (!ev || ev.phase !== 'running') return;
  ev.phase = 'pending';
  ev.tickAt = performance.now();
  eventLauncher(ev).shown = false;
  fadeCloseModal(EVENTS[ev.kind].modal, EVENTS[ev.kind].frame);
  updateAlerts();
  renderFleetStatus();
  termNote('procedure aborted', 'term-warn', FLEET);
}
export function resolveEvent(saved) {
  // saved: ids of the satellites that came through
  const ev = activeEvent;
  if (!ev) return;
  // a breather once any event is over: no new fault for 10 s, so the result is read before the next ticket arrives.
  // After the creature, the climax, a longer one: no fault for 30 s, and no other celestial event for 2 minutes.
  state.faultsAfter = performance.now() + (ev.kind === 'kraken' ? 30000 : 10000);
  if (ev.kind === 'kraken') state.eventsAfter = performance.now() + 120000;
  if (ev.kind === 'kraken') {
    const now = performance.now();
    kraken.tentacles.forEach(tn => {
      tn.carrying = !!tn.prey.heldAt && !saved.has(tn.prey.id);
      setTentacleState(tn, 'retreat', now);
    });
    ev.sats.forEach(s => {
      if (saved.has(s.id)) releaseSatellite(s, now);
    });
  }
  ev.sats.forEach(s => {
    s.flarePending = false;
    if (s.heldAt && !saved.has(s.id)) return;
    s.anomaly = false;
    s.anomalyType = null;
    s.countdown = 0;
    if (!saved.has(s.id)) s.lost = true;
  });
  const n = ev.sats.length,
    k = ev.sats.filter(s => saved.has(s.id)).length,
    all = k === n;
  const [log, hint] =
    ev.kind === 'kraken'
      ? [
          all
            ? 'THE CREATURE HAS RETREATED... FOR NOW. · ALL SATELLITES HELD'
            : `THE CREATURE HAS RETREATED... FOR NOW. · ${n - k} SATELLITE${n - k === 1 ? '' : 'S'} TAKEN`,
          all ? 'contact lost · it seemed annoyed' : 'contact lost · satellites taken',
        ]
      : ev.kind === 'debris'
        ? [
            all ? 'DEBRIS FIELD CLEARED · FORMATION INTACT' : `DEBRIS NOT OUT-MANEUVERED · ${n - k} SATELLITES LOST`,
            all ? 'evasive maneuvers successful · network nominal' : 'orbital plane segment lost · debris field expanding',
          ]
        : ev.kind === 'flare'
          ? [
              `SOLAR FLARE PASSED · ${k}/${n} SATELLITES RECONNECTED`,
              all ? 'link held · network nominal' : 'radio blackout · satellites lost',
            ]
          : [
              `GAMMA-RAY BURST RESOLVED · ${k}/${n} SATELLITES RECOVERED`,
              all ? 'all registers restored · network nominal' : 'gamma-ray burst resolved · satellites lost',
            ];
  updateNetwork();
  document.getElementById('log').textContent = log;
  if (ev.phase === 'running') {
    eventLauncher(ev).shown = false;
    fadeCloseModal(EVENTS[ev.kind].modal, EVENTS[ev.kind].frame);
  }
  activeEvent = null;
  setSunGlow(0);
  sunOut();
  state.highlighted = state.highlighted.filter(s => !ev.sats.includes(s));
  updateAlerts();
  pushAlert({ title: log, body: hint.charAt(0).toUpperCase() + hint.slice(1) + '.', crit: !all });
  if (state.selected && ev.sats.includes(state.selected)) {
    panel.classList.remove('open');
    state.selected = null;
  }
  renderFleetStatus();
}
export function tickEvent() {
  // once a second; the countdown pauses while the event minigame is open
  const ev = activeEvent;
  if (!ev || ev.phase !== 'pending') return;
  ev.left--;
  ev.tickAt = performance.now();
  if (ev.kind === 'flare') setSunGlow(0.4 + 0.6 * (1 - ev.left / EVENTS.flare.window));
  if (ev.left <= 0) resolveEvent(new Set(ev.kind === 'kraken' ? ev.sats.filter(s => !s.lost && !s.heldAt).map(s => s.id) : [])); // tentacles: whoever is still here was held
}

// effects in the sky
export function setSunGlow(v) {
  document.getElementById('sunGlow').style.opacity = v;
}
export function pulse(s, rgb, life = 700, grow = 0.035) {
  pulses.push({ s, rgb, life, grow, t0: performance.now() });
}
export function flareFlicker(t) {
  // flare satellites flicker, faster as the blackout gets closer
  const ev = activeEvent;
  if (!ev || ev.kind !== 'flare' || ev.phase !== 'pending') return 1;
  return 0.55 + 0.45 * Math.abs(Math.sin(t * (0.003 + 0.012 * (1 - ev.left / EVENTS.flare.window))));
}
export function drawEventFx(t) {
  const ev = activeEvent;
  if (ev && ev.kind === 'debris' && ev.phase === 'pending') {
    // wreckage closes in along the threatened ring as the countdown runs down
    const mid = ev.sats[Math.floor(ev.sats.length / 2)],
      rr = mid.r * Math.min(W, H),
      dir = Math.sign(mid.speed) || 1;
    const p = Math.max(0, Math.min(1, 1 - (ev.left - (t - ev.tickAt) / 1000) / EVENTS.debris.window));
    const head = mid.a + t * mid.speed + mid.phase + dir * (1 - p) * 1.4;
    ev.bits.forEach((b, i) => {
      const a = head + dir * (b.da + i * 0.012),
        x = W * 0.5 + Math.cos(a) * (rr + b.dr),
        y = H * 0.5 + Math.sin(a) * (rr + b.dr);
      ctx.fillStyle = `rgba(255,170,110,${0.35 + 0.45 * p})`;
      ctx.fillRect(x - b.sz / 2, y - b.sz / 2, b.sz, b.sz);
    });
  }
  pulses = pulses.filter(p => t - p.t0 < p.life);
  pulses.forEach(p => {
    if (p.s.lost || p.s.sx == null) return;
    const age = Math.max(0, t - p.t0);
    ctx.beginPath();
    ctx.arc(p.s.sx, p.s.sy, 5 + age * p.grow, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${p.rgb},${1 - age / p.life})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;
  });
}

// Relaunch: no event, no effects, every event window closed.
export function resetEvents() {
  activeEvent = null;
  eventIncoming = false;
  held = null;
  heldGen++;
  pulses = [];
  setSunGlow(0);
  sunOut();
  ['grbModal', 'debrisModal', 'flareModal'].forEach(id => document.getElementById(id).classList.remove('show'));
  ['grbFrame', 'debrisFrame', 'flareFrame'].forEach(id => {
    document.getElementById(id).src = '';
  });
}
