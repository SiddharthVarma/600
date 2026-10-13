import { satellites, updateNetwork } from './constellation.js';
import { dive, diving } from './dive.js';
import { eventActive, releaseHeldEvent } from './events/core.js';
import { krakenLive } from './events/creature.js';
import { fadeCloseModal, launcher, preload, reveal } from './launcher.js';
import { state } from './state.js';

// Credits: what the hosted-payload customers pay for their data, spent on launches that replace lost satellites. A
// launch costs the same however many it carries, up to a rideshare's worth, so waiting for more losses is better value.
const PAY_FULL = 5,
  PAY_PARTIAL = 2,
  LAUNCH_COST = 15,
  RIDESHARE = 4;

// a small pixel-art gold coin: o rim, h highlight, g gold, d shade
const PIXELS = ['..oooo..', '.ohhggo.', 'ohggggdo', 'ohgddgdo', 'ohgddgdo', 'oggggddo', '.oddddo.', '..oooo..'],
  SHADES = { o: '#7a4f0e', h: '#fff1b8', g: '#ffd166', d: '#d99a2b' };
export const COIN = `<svg class="coin" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${PIXELS.flatMap((row, y) =>
  [...row].map((c, x) => (SHADES[c] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${SHADES[c]}"/>` : '')),
).join('')}</svg>`;

let credits = 0;
const purse = document.getElementById('credits'),
  launchBtn = document.getElementById('launch');
purse.innerHTML = `${COIN}<span>0</span>`;
launchBtn.innerHTML = `LAUNCH · ${LAUNCH_COST} ${COIN}`;
const amount = purse.lastChild;

// full marks pay in full, finding at least something pays a little. A job with no score (tracking, transits) only
// reaches its downlink once it's done, so it always pays in full.
export function payFor({ found, total, wrong = 0 }) {
  if (found == null) return PAY_FULL;
  return found === total && !wrong ? PAY_FULL : found > 0 ? PAY_PARTIAL : 0;
}
export function earn(n) {
  n = Number(n) || 0;
  if (!n) return;
  credits += n;
  render();
  const gain = document.createElement('span');
  gain.className = 'gain';
  gain.textContent = `+${n}`;
  purse.append(gain);
  setTimeout(() => gain.remove(), 1600);
}
export function resetCredits() {
  credits = 0;
  render();
}

// the launch button shows once there's money for it and something to replace; it waits out celestial events, the
// creature, SUDO's walkthrough and a launch already under way
const lostSats = () => satellites.filter(s => s.lost),
  L = launcher('launchFrame', 'launchModal');
function render() {
  amount.textContent = credits;
  launchBtn.hidden = credits < LAUNCH_COST || !lostSats().length;
  launchBtn.disabled = eventActive() || krakenLive() || state.intro || state.launch;
}
// LAUNCH dives down to the pad at Vandenberg and opens launch control there, with as many lost satellites as one rocket
// carries. Nothing is spent until they're deployed, so closing it early costs nothing.
const PAD = { to: 'earth', lat: 34.63, lon: -120.61 };
launchBtn.onclick = () => {
  render();
  if (launchBtn.hidden || launchBtn.disabled || diving()) return;
  state.launch = true;
  render();
  preload(L, `react.html?type=launch&count=${Math.min(RIDESHARE, lostSats().length)}&dive=1`);
  dive(PAD, () => reveal(L));
};
export function closeLaunch() {
  if (!L.shown) return;
  L.shown = false;
  fadeCloseModal('launchModal', 'launchFrame');
  state.launch = false;
  render();
  releaseHeldEvent();
}
// messages from launch control: once the satellites are deployed, pay, and they climb out from the Earth to the empty
// slots (the same rise as a satellite rejoining its orbit) behind the window
export function launchMessage(data) {
  if (data.type === 'launch-complete' && L.shown) {
    credits -= LAUNCH_COST;
    lostSats()
      .slice(0, RIDESHARE)
      .forEach(s =>
        Object.assign(s, {
          lost: false,
          burst: false,
          taken: false,
          heldAt: null,
          driftFrom: null,
          anomaly: false,
          anomalyType: null,
          countdown: 0,
          flarePending: false,
          rejoining: true,
          rejoinProgress: 0,
        }),
      );
    updateNetwork();
    render();
  }
  if (data.type === 'launch-close') closeLaunch();
}
document.getElementById('launchClose').onclick = closeLaunch;
render();
// losses and events change from all over the game, so the button checks in twice a second
setInterval(render, 500);
