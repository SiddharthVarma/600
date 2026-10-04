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
  NUDGE_AFTER = 10000,
  TYPE_SPEED = 45; // characters per second
const STEPS = {
  welcome: {
    line: "Morning. Welcome to your first night shift in mission control. 600 satellites, one sleepy you. Nothing's on fire yet.",
    next: 'ticket',
  },
  ticket: {
    line: 'Ah. SCID-UI has alerted that something IS on fire. Click the red ticket, top left.',
    nudge: "The red one. Top left. I'll wait.",
  },
  sat: { line: "That's the one under the crosshair. Click it. Gently.", nudge: 'The satellite in the crosshair. The one that blinks.' },
  terminal: {
    line: 'Look up top: STATUS: SOLAR ARRAY MISALIGNED. Click its matching .py procedure file in the terminal. No pressure. Well, some pressure.',
    nudge: "The array's misaligned… align_array.py looks like the right procedure to fix this anomaly.",
  },
  playing: {},
  aborted: { line: "Closed it? Bold. Run the script again when you feel ready. Fix it soon or else we're at risk of losing that scid!" },
  failed: { line: "And it's gone. Don't worry, there are 599 more.", next: 'science' },
  done: { line: 'Nice. One down, 599 potential anomalies for 599 potential satellites to go.', next: 'science' },
  science: {
    line: "Not everything's on fire. Private organizations rent space on your satellites. These are optional. Nobody gets fired for ignoring requests to track penguin colonies.",
    next: 'hide',
  },
  sciencePlaying: {},
  bye: { line: "Bigger things turn up later. You'll see... Good luck!", next: 'finish' },
};
const say = s => (PHONE.matches ? s.replace(/\bClick\b/g, 'Tap').replace(/\bclick\b/g, 'tap') : s);

let bubble = null,
  textEl = null,
  nextBtn = null,
  step = null,
  since = 0,
  nudged = false,
  sat = null,
  spot = null,
  poll = 0,
  typing = 0,
  opening = 0;
const repairOpen = () => document.getElementById('repairModal').classList.contains('show'),
  scienceOpen = () => document.getElementById('scienceModal').classList.contains('show') || !!document.querySelector('.dive.on');
const satOpen = () => state.selected === sat && panel.classList.contains('open');

let full = '';
function show(line) {
  clearInterval(typing);
  full = say(line);
  let n = 0;
  textEl.textContent = '';
  bubble.classList.add('on');
  typing = setInterval(() => {
    n = Math.min(full.length, n + 2);
    textEl.textContent = full.slice(0, n);
    if (n >= full.length) typing = clearInterval(typing);
  }, 2000 / TYPE_SPEED);
}
// NEXT: finishes a line that's still typing; otherwise moves on
function next() {
  if (typing) {
    typing = clearInterval(typing);
    textEl.textContent = full;
    return;
  }
  const n = STEPS[step].next;
  if (n === 'finish') finish();
  else if (n === 'hide') bubble.classList.remove('on');
  else if (n) go(n);
}
function spotlight(el) {
  if (spot === el) return;
  if (spot) spot.classList.remove('sudo-spot');
  spot = el;
  if (spot) spot.classList.add('sudo-spot');
}
function go(name) {
  if (!bubble) return; // the walkthrough has already ended
  step = name;
  since = performance.now();
  nudged = false;
  spotlight(null);
  const s = STEPS[name];
  if (s.line) show(s.line);
  else bubble.classList.remove('on');
  nextBtn.hidden = !s.next;
  nextBtn.textContent = s.next === 'finish' ? 'GOT IT' : 'NEXT';
  ({
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
    science: () => {
      // the walkthrough's done its job: the game carries on from here. SUDO's goodbye waits for the first science
      // window to be opened and closed.
      pushScience('penguins', true);
      release();
    },
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
    // however it went, even if the repair opened and closed between two checks
    if (sat.lost) go('failed');
    else if (!sat.anomaly) go('done');
    else if (repairOpen()) go('playing');
  } else if (step === 'playing') {
    if (!repairOpen()) go(sat.lost ? 'failed' : sat.anomaly ? 'aborted' : 'done');
  } else if (step === 'science') {
    spotlight(document.getElementById('science'));
    if (scienceOpen()) go('sciencePlaying');
  } else if (step === 'sciencePlaying') {
    if (!scienceOpen()) go('bye');
  }
  if (bubble.classList.contains('on')) place();
}

// the corner "?" that replays the walkthrough; hidden while SUDO is talking
const help = document.getElementById('sudoHelp');
export function startIntro(delay = 1800) {
  state.intro = true;
  step = null;
  sat = null;
  help.hidden = true;
  bubble = document.createElement('div');
  bubble.className = 'sudo';
  bubble.innerHTML =
    '<div class="sudo-head"><span>SUDO · ONBOARD COMPUTER</span><button class="sudo-skip">skip</button></div><div class="sudo-text"></div><div class="sudo-foot"><button class="sudo-next">NEXT</button></div>';
  textEl = bubble.querySelector('.sudo-text');
  nextBtn = bubble.querySelector('.sudo-next');
  nextBtn.onclick = next;
  bubble.querySelector('.sudo-skip').onclick = finish;
  document.body.appendChild(bubble);
  poll = setInterval(tick, 250);
  opening = setTimeout(() => go('welcome'), delay);
}
// hand the game back: faults, science and events carry on, and the walkthrough won't show again
function release() {
  state.intro = false;
  if (sat) sat.frozen = false;
  try {
    localStorage.setItem(SEEN, '1');
  } catch {
    // private browsing or storage blocked: it'll just show again next time
  }
}
function finish() {
  clearTimeout(opening);
  clearInterval(poll);
  clearInterval(typing);
  release();
  spotlight(null);
  bubble?.remove();
  bubble = null;
  help.hidden = false;
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
// play it again on demand, right where the game is: no reload, nothing reset
export function replayIntro() {
  if (bubble) return;
  startIntro(300);
}
