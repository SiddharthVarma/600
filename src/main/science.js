import { satellites } from './constellation.js';
import { dive, diving } from './dive.js';
import { fadeCloseModal, launcher, preload, reveal } from './launcher.js';

// Science requests: universities' hosted-payload proposals that arrive now and then. They wait, folded into one card in
// the bottom left, until the player opens them; each opens its own window (a survey or a tracking job) and is done once
// its data is downlinked. Nothing is lost by ignoring them or getting one wrong.
// earthAt: the spot on the Earth sprite the camera dives at (Antarctica, open ocean, forest); interstellar looks away
const REQUESTS = {
  penguins: { what: 'Penguin Colony Tracking', uni: 'University of Oxford', to: 'earth', earthAt: [118, 214] },
  whales: { what: 'Whale Population Tracking', uni: 'University of St Andrews', to: 'earth', earthAt: [150, 150] },
  wildfire: { what: 'Wildfire Hotspot Tracking', uni: 'University of Maryland', to: 'earth', earthAt: [64, 92] },
  interstellar: { what: 'Interstellar Object Tracking', uni: 'University of Hawaiʻi', to: 'space' },
};
const MAX_WAITING = 4;
const el = document.getElementById('science'),
  L = launcher('scienceFrame', 'scienceModal');
let waiting = [],
  expanded = false,
  opened = null,
  note = null,
  noteTimer = 0;

const hostSat = () => {
  const up = satellites.filter(s => !s.lost);
  return up[Math.floor(Math.random() * up.length)];
};
export function pushScience(kind) {
  // a new kind of request each time, while there's room
  const free = Object.keys(REQUESTS).filter(k => !waiting.some(r => r.kind === k));
  kind = REQUESTS[kind] ? kind : free[Math.floor(Math.random() * free.length)];
  if (!kind || waiting.length >= MAX_WAITING || waiting.some(r => r.kind === kind)) return;
  waiting.push({ kind, ...REQUESTS[kind], sat: hostSat() });
  render(true);
}
export function scheduleScience() {
  setTimeout(
    () => {
      pushScience();
      scheduleScience();
    },
    75000 + Math.random() * 60000,
  );
}
function openRequest(r) {
  if (diving()) return;
  if (!r.sat || r.sat.lost) r.sat = hostSat();
  opened = r;
  expanded = false;
  render();
  // the window loads hidden during the dive and opens once the screen is covered; ?dive tells it to start in the clouds
  preload(L, `react.html?type=${r.kind}&sat=${r.sat.id}&dive=1`);
  dive(r, () => reveal(L));
}
export function closeScience() {
  if (!L.shown) return;
  L.shown = false;
  opened = null;
  fadeCloseModal('scienceModal', 'scienceFrame');
}
// messages from the science window
export function scienceMessage(data) {
  if (data.type === 'science-complete' && opened) {
    waiting = waiting.filter(r => r !== opened);
    note = `DATA RECEIVED · ${opened.uni.toUpperCase()}`;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      note = null;
      render();
    }, 6000);
    render();
  }
  if (data.type === 'science-close') closeScience();
}
export function resetScience() {
  waiting = [];
  expanded = false;
  note = null;
  closeScience();
  render();
}

function card(cls, title, body) {
  const c = document.createElement('div');
  c.className = 'alert science-card ' + cls;
  c.innerHTML =
    '<div class="alert-head"><span class="alert-icon">🔭</span><span class="alert-app">SCID-UI ALERTS · SCIENCE</span><span class="alert-time"></span></div><div class="alert-title"></div><div class="alert-body"></div>';
  c.querySelector('.alert-title').textContent = title;
  c.querySelector('.alert-body').textContent = body;
  return c;
}
function render(arrived = false) {
  el.replaceChildren();
  if (note) {
    const n = document.createElement('div');
    n.className = 'science-note';
    n.textContent = note;
    el.append(n);
  }
  if (!waiting.length) return;
  // opened up: one ticket per request, newest at the top
  if (expanded)
    [...waiting].reverse().forEach(r => {
      const c = card('science-ticket', 'HOSTED PAYLOAD PROPOSAL ACCEPTED', `${r.what} · ${r.uni}`);
      c.onclick = () => openRequest(r);
      el.append(c);
    });
  // folded: one card standing for all of them
  const n = waiting.length,
    summary = card(
      'science-summary' + (arrived ? ' arrived' : ''),
      n === 1 ? '1 SCIENCE REQUEST' : `${n} SCIENCE REQUESTS`,
      expanded ? 'Hide requests' : 'Hosted payload proposals accepted · tap to view',
    );
  summary.querySelector('.alert-time').textContent = expanded ? '' : `${n} new`;
  summary.onclick = () => {
    expanded = !expanded;
    render();
  };
  el.append(summary);
}
