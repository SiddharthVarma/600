import { spawnAnomaly } from './anomalies.js';
import { alertElFor, alertElForEvent } from './alerts.js';
import { H, W, ringProgress, satellites } from './constellation.js';
import { activeEvent } from './events/core.js';
import { startPacing } from './pacing.js';
import { panel } from './panel.js';
import { pushScience } from './science.js';
import { state } from './state.js';

// SUDO, the satellite's sarcastic onboard computer, walks the player through their first fault: the ticket, its
// terminal, the repair, then the first science request. It watches what the player does rather than blocking anything;
// while it runs, random faults, science requests and celestial events wait, and the tutorial fault's countdown is
// frozen until its repair is open. It opens every visit (skip ends it); the corner "?" replays it.
const PHONE = matchMedia('(max-width: 600px) and (pointer: coarse)'),
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
  terminal: {
    line: 'See the STATUS line: SOLAR ARRAY MISALIGNED. Click its matching .py procedure file in the terminal. No pressure. Well, some pressure.',
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
    // the ticket opens its terminal straight away
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
// hand the game back: pacing.js takes it from here
function release() {
  state.intro = false;
  if (sat) sat.frozen = false;
  startPacing();
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
// play it again on demand, right where the game is: no reload, nothing reset
export function replayIntro() {
  if (bubble) return;
  startIntro(300);
}

// SUDO's word on launches: the first time LAUNCH lights up (enough credits and a satellite to replace), once per browser.
// It waits for the walkthrough to be over and for no window to be open, and points at the button.
const LAUNCH_SEEN = 'sixhundred.launchSeen',
  LAUNCH_LINE = "All that penguin counting paid off. 15 credits buys a rocket. Click LAUNCH up top to replace the satellites you've lost, up to four per ride.";
const launchBtn = document.getElementById('launch');
let hint = null;
function launchHintSeen() {
  try {
    return !!localStorage.getItem(LAUNCH_SEEN);
  } catch {
    return false;
  }
}
function closeHint() {
  if (!hint) return;
  clearInterval(hint.typing);
  hint.el.remove();
  launchBtn.classList.remove('sudo-spot');
  hint = null;
}
const hintPoll = setInterval(() => {
  if (hint) {
    if (launchBtn.hidden || state.launch) closeHint();
    return;
  }
  if (launchHintSeen()) return clearInterval(hintPoll);
  const busy = bubble || state.intro || document.querySelector('.repair-modal.show') || document.querySelector('.dive.on');
  if (launchBtn.hidden || launchBtn.disabled || busy) return;
  try {
    localStorage.setItem(LAUNCH_SEEN, '1');
  } catch {
    // no storage: it may show again next visit
  }
  const el = document.createElement('div');
  el.className = 'sudo on';
  el.innerHTML =
    '<div class="sudo-head"><span>SUDO · ONBOARD COMPUTER</span></div><div class="sudo-text"></div><div class="sudo-foot"><button class="sudo-next">GOT IT</button></div>';
  document.body.appendChild(el);
  const text = el.querySelector('.sudo-text'),
    line = say(LAUNCH_LINE),
    r = launchBtn.getBoundingClientRect();
  el.querySelector('.sudo-next').onclick = closeHint;
  el.style.left = (PHONE.matches ? 12 : Math.max(12, r.right - el.offsetWidth)) + 'px';
  el.style.top = r.bottom + 14 + 'px';
  launchBtn.classList.add('sudo-spot');
  let n = 0;
  hint = {
    el,
    typing: setInterval(() => {
      n = Math.min(line.length, n + 2);
      text.textContent = line.slice(0, n);
      if (n >= line.length) clearInterval(hint.typing);
    }, 2000 / TYPE_SPEED),
  };
}, 500);

// SUDO on celestial events: the first time each kind turns up in a visit, a line about it beside its EMERGENCY ticket,
// gone once the event's window opens or the event is over. The creature corrupts SUDO instead: purple, glitching and
// with no button, so clicks go through to the tentacles, until the attack ends and it comes back to itself.
const EVENT_LINES = {
  flare:
    'Parker Solar Probe just caught a solar flare. Satellites on the sunny side are losing their radio link. Click the EMERGENCY ticket to reconnect them.',
  grb: 'Fermi just detected a gamma-ray burst. It has flipped bits in the memory of five satellites. Click the EMERGENCY ticket to fix them.',
  debris: "NORAD is tracking debris through one of our planes. Not ours, but it's about to be our problem. Click the EMERGENCY ticket.",
};
const CORRUPTED = [
    "…I don't have a procedure for th—",
    'T̷H̴E̸ ̵S̷T̶A̸R̴S̵ ̶A̷R̸E̵ ̴W̶R̷O̸N̵G̷',
    '░▒▓ six hundred lights ▓▒░ six hundred morsels',
    'it has seen the constellation. it has seen y̵o̷u̴',
    'h-hit th̸e̷ tentac—',
  ].join('\n'),
  CORRUPTED_HEADS = ['SUDO · ONBOARD COMPUTER', 'S̷U̷D̷O̷ · ????????', '███ · ██████'],
  GLITCH = '░▒▓█',
  RECOVERED = '…Sorry. Where was I.';
const glitchChar = () => GLITCH[Math.floor(Math.random() * GLITCH.length)];
const seenEvents = new Set();
let aside = null;
function asideBubble(button) {
  const el = document.createElement('div');
  el.className = 'sudo on';
  el.innerHTML =
    '<div class="sudo-head"><span>SUDO · ONBOARD COMPUTER</span></div><div class="sudo-text"></div>' +
    (button ? '<div class="sudo-foot"><button class="sudo-next">GOT IT</button></div>' : '');
  document.body.appendChild(el);
  return el;
}
function closeAside() {
  if (!aside) return;
  clearInterval(aside.timer);
  clearInterval(aside.flicker);
  clearTimeout(aside.leave);
  aside.el.remove();
  aside = null;
}
// type a line out normally, the way SUDO always does
function typeInto(text, line) {
  let n = 0;
  const timer = setInterval(() => {
    n = Math.min(line.length, n + 2);
    text.textContent = line.slice(0, n);
    if (n >= line.length) clearInterval(timer);
  }, 2000 / TYPE_SPEED);
  return timer;
}
// type it out corrupted: it stutters and backtracks, the newest characters show as noise before they settle, and once
// it's all there, characters keep flickering to noise and back; the header can't settle on what it is either
function typeCorrupted(el) {
  const text = el.querySelector('.sudo-text'),
    head = el.querySelector('.sudo-head span'),
    chars = Array.from(CORRUPTED);
  let n = 0;
  const show = (k, tail) => (text.textContent = chars.slice(0, k).join('') + Array.from({ length: tail }, glitchChar).join(''));
  aside.timer = setInterval(() => {
    if (n < chars.length) {
      n = Math.random() < 0.12 ? Math.max(0, n - 2) : Math.min(chars.length, n + 1 + Math.floor(Math.random() * 2));
      show(n, n < chars.length ? 1 + Math.floor(Math.random() * 3) : 0);
    }
  }, 2000 / TYPE_SPEED);
  aside.flicker = setInterval(() => {
    head.textContent = CORRUPTED_HEADS[Math.random() < 0.6 ? 0 : 1 + Math.floor(Math.random() * 2)];
    if (n < chars.length) return;
    const noisy = chars.slice();
    for (let k = 0; k < 3; k++) {
      const i = Math.floor(Math.random() * noisy.length);
      if (noisy[i].trim()) noisy[i] = glitchChar();
    }
    text.textContent = noisy.join('');
  }, 180);
}
// where it sits: in the left column under the tickets (their width, just below the EMERGENCY one), the one part of the
// screen that's clear of the constellation; on phones, along the bottom
const alertsCol = document.getElementById('alerts');
function placeAside() {
  const b = aside.el;
  let x, y;
  if (PHONE.matches) {
    x = 12;
    y = innerHeight - b.offsetHeight - 16;
  } else {
    const r = alertsCol.getBoundingClientRect();
    b.style.width = r.width + 'px';
    x = r.left;
    y = r.bottom + 12;
  }
  b.style.left = Math.max(12, Math.min(innerWidth - b.offsetWidth - 12, x)) + 'px';
  b.style.top = Math.max(12, Math.min(innerHeight - b.offsetHeight - 12, y)) + 'px';
}
setInterval(() => {
  const ev = activeEvent;
  if (aside) {
    if (aside.kind === 'kraken') {
      // the attack's over: SUDO comes back to itself, says so, and goes
      if (!aside.recovered && !(ev && ev.kind === 'kraken')) {
        aside.recovered = true;
        clearInterval(aside.timer);
        clearInterval(aside.flicker);
        aside.el.classList.remove('sudo-corrupt');
        aside.el.querySelector('.sudo-head span').textContent = CORRUPTED_HEADS[0];
        aside.timer = typeInto(aside.el.querySelector('.sudo-text'), RECOVERED);
        aside.leave = setTimeout(closeAside, 3500);
      }
    } else if (ev !== aside.ev || ev.phase === 'running') closeAside();
    if (aside) placeAside();
    return;
  }
  // only once the walkthrough is over, and once per kind per visit
  if (!ev || seenEvents.has(ev.kind) || bubble || state.intro) return;
  if (ev.kind === 'kraken') {
    seenEvents.add(ev.kind);
    aside = { kind: ev.kind, ev, el: asideBubble(false) };
    aside.el.classList.add('sudo-corrupt');
    typeCorrupted(aside.el);
  } else {
    const ticket = alertElForEvent(ev);
    if (!ticket || ev.phase !== 'pending' || !EVENT_LINES[ev.kind]) return;
    seenEvents.add(ev.kind);
    aside = { kind: ev.kind, ev, ticket, el: asideBubble(true) };
    aside.el.querySelector('.sudo-next').onclick = closeAside;
    aside.timer = typeInto(aside.el.querySelector('.sudo-text'), say(EVENT_LINES[ev.kind]));
  }
  placeAside();
}, 250);
