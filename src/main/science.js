import { satellites } from './constellation.js';
import { dive, diving } from './dive.js';
import { releaseHeldEvent } from './events/core.js';
import { state } from './state.js';
import { fadeCloseModal, launcher, preload, reveal } from './launcher.js';
import { touchScroll } from '../shared/touchscroll.js';

const PHONE = matchMedia('(max-width: 600px) and (pointer: coarse)');

// Science requests: universities' hosted-payload proposals that arrive now and then. They wait, folded into one card in
// the bottom left, until the player opens them; each opens its own window (a survey or a tracking job) and is done once
// its data is downlinked. Nothing is lost by ignoring them or getting one wrong.
// area: where on Earth the request is ([latitudes], [longitudes]); the camera dives at a spot picked inside it, and the
// window shows that same spot. Aircraft bases come in three climates, each with its own area. The space ones look away.
const REQUESTS = {
  penguins: {
    what: 'Penguin Colony Tracking',
    uni: 'British Antarctic Survey',
    to: 'earth',
    area: [
      [-78, -65],
      [-180, 180],
    ],
  }, // the Antarctic coast
  whales: {
    what: 'Whale Population Tracking',
    uni: 'British Antarctic Survey',
    to: 'earth',
    area: [
      [-52, -42],
      [-50, 10],
    ],
  }, // the South Atlantic
  wildfire: {
    what: 'Wildfire Hotspot Tracking',
    uni: 'Brazilian Fire Research Center',
    to: 'earth',
    area: [
      [-14, -2],
      [-70, -50],
    ],
  }, // the Amazon
  interstellar: { what: 'Interstellar Object Tracking', uni: 'Instituto de Astrofísica de Canarias', to: 'space' },
  flamingos: {
    what: 'Flamingo Flock Tracking',
    uni: 'University of Nairobi',
    to: 'earth',
    area: [
      [-3, 1],
      [35.5, 36.5],
    ],
  }, // the Rift Valley lakes
  aircraft: {
    what: 'Aircraft Recognition',
    uni: 'Ministry of Defence',
    to: 'earth',
    areas: {
      temperate: [
        [46, 54],
        [0, 20],
      ],
      desert: [
        [20, 30],
        [40, 56],
      ],
      arctic: [
        [64, 70],
        [10, 30],
      ],
    },
  },
  oil: {
    what: 'Oil Spill Tracking',
    uni: 'University College Dublin',
    to: 'earth',
    area: [
      [25.5, 29],
      [-89.5, -86],
    ],
  }, // the Gulf of Mexico
  darkships: {
    what: 'Dark Ship Tracking',
    uni: 'Global Fishing Watch',
    to: 'earth',
    area: [
      [-5, 2],
      [-95, -82],
    ],
  }, // off the Galápagos
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
  state.science = true; // from the dive on, celestial events wait for this window to close
  render();
  // pick the place: a spot inside the request's area (for aircraft, first which kind of base), shared by the dive and
  // the window so they always agree
  const where = { to: r.to };
  let place = '';
  if (r.to === 'earth') {
    const kinds = r.areas && Object.keys(r.areas),
      biome = kinds && kinds[Math.floor(Math.random() * kinds.length)],
      [lat, lon] = biome ? r.areas[biome] : r.area;
    where.lat = lat[0] + Math.random() * (lat[1] - lat[0]);
    where.lon = lon[0] + Math.random() * (lon[1] - lon[0]);
    place = `&lat=${where.lat.toFixed(2)}&lon=${where.lon.toFixed(2)}` + (biome ? `&biome=${biome}` : '');
  }
  // the window loads hidden during the dive and opens once the screen is covered; ?dive tells it to start in the clouds
  preload(L, `react.html?type=${r.kind}&sat=${r.sat.id}&dive=1${place}`);
  dive(where, () => reveal(L));
}
export function closeScience() {
  if (!L.shown) return;
  L.shown = false;
  opened = null;
  fadeCloseModal('scienceModal', 'scienceFrame');
  // back at mission control: any celestial event that came due meanwhile starts now
  state.science = false;
  releaseHeldEvent();
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
  state.science = false;
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
// The fanned-out list only takes the room left below the fault tickets (and at most half the screen), scrolling inside
// if it must, so the two never overlap. The list is anchored at the bottom, so its bottom edge stays put while its
// height is capped. Re-fitted whenever the tickets change or the window resizes.
const alertsEl = document.getElementById('alerts');
function fitList() {
  const list = el.querySelector('.science-list');
  if (!list) return;
  list.style.maxHeight = '';
  const room = list.getBoundingClientRect().bottom - (alertsEl.getBoundingClientRect().bottom + 12);
  list.style.maxHeight = Math.max(84, Math.min(room, innerHeight * 0.5)) + 'px';
}
new ResizeObserver(fitList).observe(alertsEl);
addEventListener('resize', fitList);
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
    fitList();
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
