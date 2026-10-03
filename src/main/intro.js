import { spawnAnomaly } from './anomalies.js';
import { alertElFor } from './alerts.js';
import { H, W, ringProgress, satellites } from './constellation.js';
import { panel } from './panel.js';
import { pushScience } from './science.js';
import { state } from './state.js';

// SUDO, the satellite's sarcastic onboard computer, walks a first-time player through their first fault: the ticket,
// the satellite, its terminal, the repair, then the first science request. It watches what the player does rather than
// blocking anything; while it runs, random faults, science requests and celestial events wait, and the tutorial
// fault's countdown is frozen until its repair is open. Shown once per browser; replayIntro() in the console shows it
// again.
const SEEN = 'sixhundred.introSeen',
  PHONE = matchMedia('(max-width: 600px) and (pointer: coarse)'),
  NUDGE_AFTER = 12000,
  TYPE_SPEED = 45; // characters per second
const STEPS = {
  welcome: { line: "Morning. Welcome to night shifts. 600 satellites, one sleepy you. Nothing's on fire yet." },
  ticket: {
    line: 'Ah. SCID-UI has alerted that something IS on fire. Click the red ticket, top left.',
    nudge: "The red one. Top left. I'll wait.",
  },
  sat: { line: "That's the one under the crosshair. Click it. Gently.", nudge: 'The satellite in the crosshair. The one that blinks.' },
  terminal: {
    line: "You're logged into the satellite now. Run the script that matches the problem. No pressure. Well, some pressure.",
    nudge: 'Click the script that matches the problem. No typing needed.',
  },
  playing: {},
  aborted: { line: 'Closed it? Bold. Run the script again when you feel ready. The satellite will wait. For now.' },
  failed: { line: "And it's gone. Don't worry, there are 599 more." },
  done: { line: 'Nice. One down, 599 to go.' },
  science: {
    line: "Not everything's on fire. Private organizations rent space on your satellites. These are optional. Nobody gets fired for ignoring requests to track penguin colonies",
  },
  bye: { line: "Bigger things turn up later. You'll see... Good luck!" },
};
const say = s => (PHONE.matches ? s.replace(/\bClick\b/g, 'Tap').replace(/\bclick\b/g, 'tap') : s);

let bubble = null,
  textEl = null,
  step = null,
  since = 0,
  nudged = false,
  sat = null,
  spot = null,
  poll = 0,
  typing = 0;
const repairOpen = () => document.getElementById('repairModal').classList.contains('show');
const satOpen = () => state.selected === sat && panel.classList.contains('open');

function show(line) {
  clearInterval(typing);
  const full = say(line);
  let n = 0;
  textEl.textContent = '';
  bubble.classList.add('on');
  typing = setInterval(() => {
    n = Math.min(full.length, n + 2);
    textEl.textContent = full.slice(0, n);
    if (n >= full.length) clearInterval(typing);
  }, 2000 / TYPE_SPEED);
}
function spotlight(el) {
  if (spot === el) return;
  if (spot) spot.classList.remove('sudo-spot');
  spot = el;
  if (spot) spot.classList.add('sudo-spot');
}
function go(name) {
  step = name;
  since = performance.now();
  nudged = false;
  spotlight(null);
  const s = STEPS[name];
  if (s.line) show(s.line);
  else bubble.classList.remove('on');
  ({
    welcome: () => setTimeout(() => go('ticket'), 4500),
    ticket: () => {
      // a fault the player can't miss: mid-screen, clear of the tickets and the side panel. Solar alignment reads at a
      // glance, and its countdown waits until they've opened the repair.
      const now = performance.now(),
        pool = satellites.filter(
          s =>
            !s.lost && !s.anomaly && ringProgress(s.ring, now) > 0 && s.sx > W * 0.3 && s.sx < W * 0.62 && s.sy > H * 0.3 && s.sy < H * 0.7,
        );
      sat = pool[Math.floor(Math.random() * pool.length)] || satellites.find(s => !s.lost && !s.anomaly);
      spawnAnomaly(sat, 'solar');
      sat.frozen = true;
    },
    playing: () => (sat.frozen = false),
    aborted: () => (sat.frozen = true),
    failed: () => setTimeout(() => go('science'), 4000),
    done: () => setTimeout(() => go('science'), 3500),
    science: () => {
      pushScience('penguins', true);
      setTimeout(() => step === 'science' && go('bye'), 11000);
    },
    bye: () => setTimeout(() => finish(), 7000),
  })[name]?.();
}
// where the bubble sits: next to whatever it's talking about
function place() {
  const b = bubble,
    bw = b.offsetWidth,
    bh = b.offsetHeight,
    clampX = x => Math.max(12, Math.min(innerWidth - bw - 12, x)),
    clampY = y => Math.max(12, Math.min(innerHeight - bh - 12, y));
  let x = innerWidth / 2 - bw / 2,
    y = innerHeight - bh - 64;
  if (PHONE.matches) {
    // phones: along the bottom, or the top when the bottom is busy (the science card, the side panel's terminal)
    x = 12;
    y = step === 'science' || step === 'terminal' || step === 'aborted' ? 74 : innerHeight - bh - 16;
  } else if ((step === 'ticket' || step === 'science') && spot) {
    const r = spot.getBoundingClientRect();
    x = r.right + 16;
    y = step === 'science' ? r.bottom - bh : r.top;
  } else if (step === 'sat' && sat?.sx != null) {
    x = sat.sx + 34;
    y = sat.sy - 20;
  } else if (step === 'terminal' || step === 'aborted') {
    x = innerWidth - panel.offsetWidth - bw - 18;
    y = document.getElementById('term').getBoundingClientRect().top;
  }
  b.style.left = clampX(x) + 'px';
  b.style.top = clampY(y) + 'px';
}
function tick() {
  if (!step) return; // nothing said yet
  const waited = performance.now() - since,
    s = STEPS[step];
  if (s.nudge && !nudged && waited > NUDGE_AFTER) {
    nudged = true;
    show(s.nudge);
  }
  if (step === 'ticket') {
    spotlight(alertElFor(sat) || null);
    if (satOpen()) go('terminal');
    else if (state.highlighted.includes(sat)) go('sat');
  } else if (step === 'sat') {
    if (satOpen()) go('terminal');
  } else if (step === 'terminal' || step === 'aborted') {
    spotlight(document.getElementById('term'));
    if (repairOpen()) go('playing');
  } else if (step === 'playing') {
    if (!repairOpen()) go(sat.lost ? 'failed' : sat.anomaly ? 'aborted' : 'done');
  } else if (step === 'science') spotlight(document.getElementById('science'));
  if (bubble.classList.contains('on')) place();
}

export function startIntro() {
  state.intro = true;
  bubble = document.createElement('div');
  bubble.className = 'sudo';
  bubble.innerHTML =
    '<div class="sudo-head"><span>SUDO · ONBOARD COMPUTER</span><button class="sudo-skip">skip</button></div><div class="sudo-text"></div>';
  textEl = bubble.querySelector('.sudo-text');
  bubble.querySelector('.sudo-skip').onclick = finish;
  document.body.appendChild(bubble);
  poll = setInterval(tick, 250);
  setTimeout(() => go('welcome'), 1800);
}
function finish() {
  clearInterval(poll);
  clearInterval(typing);
  state.intro = false;
  if (sat) sat.frozen = false;
  spotlight(null);
  bubble?.remove();
  bubble = null;
  try {
    localStorage.setItem(SEEN, '1');
  } catch {
    // private browsing or storage blocked: it'll just show again next time
  }
}
// first visit only
export function maybeStartIntro() {
  try {
    if (localStorage.getItem(SEEN)) return false;
  } catch {
    // no storage: show it
  }
  startIntro();
  return true;
}
export function replayIntro() {
  try {
    localStorage.removeItem(SEEN);
  } catch {
    // nothing stored to clear
  }
  location.reload();
}
