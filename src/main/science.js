import { satellites } from './constellation.js';
import { dive, diving } from './dive.js';
import { state } from './state.js';
import { fadeCloseModal, launcher, preload, reveal } from './launcher.js';
import { touchScroll } from '../shared/touchscroll.js';

const PHONE = matchMedia('(max-width: 600px) and (pointer: coarse)');

// Science requests: universities' hosted-payload proposals that arrive now and then. They wait, folded into one card in
// the bottom left, until the player opens them; each opens its own window (a survey or a tracking job) and is done once
// its data is downlinked. Nothing is lost by ignoring them or getting one wrong.
// want: the kind of spot on the spinning Earth the camera dives at (ice, ocean or land); the space ones look away
const REQUESTS = {
  penguins: { what: 'Penguin Colony Tracking', uni: 'British Antarctic Survey', to: 'earth', want: 'ice' },
  whales: { what: 'Whale Population Tracking', uni: 'British Antarctic Survey', to: 'earth', want: 'ocean' },
  wildfire: { what: 'Wildfire Hotspot Tracking', uni: 'Brazilian Fire Research Center', to: 'earth', want: 'land' },
  interstellar: { what: 'Interstellar Object Tracking', uni: 'Instituto de Astrofísica de Canarias', to: 'space' },
  flamingos: { what: 'Flamingo Flock Tracking', uni: 'University of Nairobi', to: 'earth', want: 'land' },
  aircraft: { what: 'Aircraft Recognition', uni: 'Ministry of Defence', to: 'earth', want: 'land' },
  oil: { what: 'Oil Spill Tracking', uni: 'University College Dublin', to: 'earth', want: 'ocean' },
  darkships: { what: 'Dark Ship Tracking', uni: 'Global Fishing Watch', to: 'earth', want: 'ocean' },
  supernova: { what: 'Supernova Search', uni: 'University of Surrey', to: 'space' },
  exoplanet: { what: 'Exoplanet Transit Search', uni: 'University of Hawaiʻi', to: 'space' },
  galaxies: { what: 'Galaxy Classification', uni: 'Instituto de Astrofísica de Canarias', to: 'space' },
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
export function pushScience(kind, force = false) {
  if (state.intro && !force) return;
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
    40000 + Math.random() * 40000,
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
function ticket(r, arrived) {
  const c = card('science-ticket' + (arrived ? ' arrived' : ''), 'HOSTED PAYLOAD PROPOSAL ACCEPTED', `${r.what} · ${r.uni}`);
  c.onclick = () => openRequest(r);
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
  const n = waiting.length,
    newest = waiting[n - 1];
  if (!n) return;
  if (n === 1) {
    // a single request is just its ticket: tap it to go
    expanded = false;
    el.append(ticket(newest, arrived));
    return;
  }
  if (expanded) {
    // fanned out: one ticket per request, newest at the top, then a pill to fold them back up
    const list = document.createElement('div');
    list.className = 'science-list';
    [...waiting].reverse().forEach(r => list.append(ticket(r)));
    if (PHONE.matches) touchScroll(list);
    const less = document.createElement('button');
    less.className = 'science-less';
    less.textContent = 'show less';
    less.onclick = () => {
      expanded = false;
      render();
    };
    el.append(list, less);
    return;
  }
  // folded: a stack showing the newest request, with the count in a badge and the others peeking out underneath
  const stack = card(
    'science-stack' + (n === 2 ? ' two' : '') + (arrived ? ' arrived' : ''),
    'SCIENCE REQUESTS',
    `${newest.what} · ${newest.uni} · +${n - 1} more`,
  );
  const badge = document.createElement('span');
  badge.className = 'science-badge';
  badge.textContent = n;
  stack.append(badge);
  stack.onclick = () => {
    expanded = true;
    render();
  };
  el.append(stack);
}
