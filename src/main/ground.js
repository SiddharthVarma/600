import { balance, COIN, spend } from './credits.js';
import { activeEvent, eventHeld, eventIncoming } from './events/core.js';
import { state } from './state.js';
import { UPLINK_STATIONS } from './terminal.js';

// GROUND-UI: trouble at the ground stations. The top bar counts the stations online, and a GROUND ISSUE button by the
// credits drops the tickets down below it. An issue costs credits to fix; left alone (or with too few credits), the
// station goes offline for a minute.
// Each incident: [station, what's wrong, what's happening, the fix, its cost in credits (1 if not given)]
const INCIDENTS = [
  ['KOCHI', 'EQUIPMENT ROOM FLOODED', 'Monsoon water is coming in under the door. Pumps will clear it.', 'Hire a guy with a mop'],
  ['GOONHILLY', 'COPPER STOLEN', 'Thieves stripped the cable run overnight. The feed has no signal path.', 'Replace the cable', 3],
  ['SVALBARD', 'BEAR AT THE DISH', 'A polar bear is sniffing around the antenna. No one can reach it.', 'Fire a few warning shots'],
  ['INUVIK', 'RADOME ICED OVER', 'Ice is building on the dome and the signal is fading.', 'Switch on all hair dryers'],
  ['DUBLIN', 'SEAGULL ON THE FEED', "A gull has claimed the feed horn and won't move.", 'Anti-bird spray'],
  ['TENERIFE', 'DRONE IN THE BEAM', "Someone's holiday drone is hovering over the dish.", 'Fire an EMP', 3],
  [
    'GOONHILLY',
    'COWS IN THE FIELD',
    "The farmer's herd got through the fence and is leaning on the dish.",
    'Fix the fence and fire up the grill',
    2,
  ],
  ['PUNE', 'POWER CUT', "The grid's down and the generator won't start.", 'Diesel delivery', 2],
  ['KOCHI', 'KITE IN THE BEAM', "Festival kites keep drifting across the dish's view.", 'Pay the kite patrol'],
  ['BEIJING', 'FIBRE CUT', 'A digger went through the fibre outside the gate.', 'Repair crew', 3],
  ['ADELAIDE', 'AMPLIFIER FAILED', "The receiver's low-noise amplifier has burnt out.", 'Swap in the spare', 3],
  ['TIRANE', 'MOTOR OVERHEATING', "The dish's azimuth motor is overheating mid-pass.", 'Replace the bearing', 3],
  ['INUVIK', 'ROAD SNOWED IN', "Overnight snowfall has closed the road; the ground crew can't get in.", 'Snow plough', 2],
  [
    'PERTH',
    'LICENCE REVIEW',
    'The regulator wants paperwork before the station transmits again.',
    'Bribe the government to look the other way',
    3,
  ],
  [
    'GAZA',
    'MICROWAVE IN THE DATA',
    'Someone keeps opening the staff microwave before it beeps, and the receiver picks it up.',
    'Buy a new microwave',
  ],
  ['TENERIFE', 'SAHARAN DUST', 'A Calima dust storm has coated the dish in red sand.', 'Pressure wash'],
  ['PUNE', 'MONKEYS ON THE DISH', 'A troop of monkeys has pulled the cover off the feed.', 'Bribe them with bananas'],
  ['KOCHI', 'SNAKE IN THE RACK', "There's a cobra coiled behind the modem, and no one will go near it.", 'Call the snake catcher'],
  ['DUBLIN', 'LIGHTNING STRIKE', 'A surge came down the mast and fried the modem.', 'New surge protector', 2],
  ['GOONHILLY', 'FORCED UPDATE', 'The control PC restarted to install updates mid-pass.', 'Buy the pro licence', 2],
  ['BEIJING', 'CERTIFICATE EXPIRED', "The link's security certificate lapsed at midnight and nobody renewed it.", 'Renew the certificate'],
  ['TIRANE', 'EARTHQUAKE', 'A tremor has knocked the dish off its pointing.', 'Recalibrate on a star', 2],
  ['ADELAIDE', 'PASSWORD ON HOLIDAY', 'The only engineer who knows the admin password is on a beach in Bali.', 'Call them anyway'],
  ['SVALBARD', 'FOX IN THE CABLE DUCT', 'An Arctic fox has moved into the duct and is chewing through the coax.', 'Trap and release'],
];
const cost = inc => inc[4] || 1,
  GRACE = 45, // seconds to fix it before the station drops
  OFFLINE = 60,
  between = (a, b) => (a + Math.random() * (b - a)) * 1000;

// the count reads like the satellite count beside it; the button, like LAUNCH, sits with the credits it spends
const count = document.createElement('span'),
  btn = document.createElement('button'),
  drop = document.createElement('div');
count.className = 'gcount';
btn.className = 'launch ground';
btn.id = 'groundBtn';
drop.className = 'gdrop';
document.querySelector('.topline .brand').append(count);
document.querySelector('.purse').prepend(btn);
document.body.append(drop);
let issues = [], // { inc, el, left, offline }
  bag = [],
  next = 0;

// incidents come out of a shuffled bag, so none repeats until the rest have had a turn
function draw() {
  const busy = new Set(issues.map(i => i.inc[0]));
  if (!bag.length) bag = [...INCIDENTS].sort(() => Math.random() - 0.5);
  const i = bag.findIndex(inc => !busy.has(inc[0]));
  return i < 0 ? null : bag.splice(i, 1)[0];
}
export function triggerGround() {
  const inc = draw();
  if (!inc) return;
  const el = document.createElement('div');
  el.className = 'alert ground';
  el.innerHTML =
    '<div class="alert-head"><span class="alert-icon">📡</span><span class="alert-app">GROUND-UI</span><span class="alert-time">now</span></div>' +
    '<div class="alert-title"></div><div class="alert-body"></div><div class="g-more"></div>' +
    `<div class="g-act"><button class="g-fix"></button><span class="g-note"></span></div>`;
  el.querySelector('.alert-title').textContent = `GS ${inc[0]} · ${inc[1]}`;
  el.querySelector('.g-more').textContent = inc[2];
  el.querySelector('.g-fix').innerHTML = `${inc[3].toUpperCase()} · ${cost(inc)} ${COIN}`;
  const issue = { inc, el, left: GRACE, offline: false, born: Date.now() };
  el.querySelector('.g-fix').onclick = () => fix(issue);
  issues.push(issue);
  drop.prepend(el);
  render();
}
function fix(issue) {
  if (issue.offline || balance() < cost(issue.inc)) return;
  spend(cost(issue.inc));
  remove(issue);
}
function remove(issue) {
  issues = issues.filter(i => i !== issue);
  issue.el.classList.add('out');
  setTimeout(() => issue.el.remove(), 300);
  if (!issues.length) setTimeout(() => toggle(false), 300);
  render();
}
function render() {
  const down = issues.filter(i => i.offline).length,
    open = issues.length - down,
    n = UPLINK_STATIONS.length;
  count.textContent = `· GROUND ${n - down}/${n}`;
  // an offline station is still an issue, so its ticket stays reachable; the button glows while one can be fixed
  btn.hidden = !issues.length;
  btn.innerHTML = `${open ? '<i></i>' : ''}${issues.length} GROUND ISSUE${issues.length > 1 ? 'S' : ''} ▾`;
  btn.classList.toggle('quiet', !open);
  issues.forEach(i => {
    const fixable = !i.offline && balance() >= cost(i.inc);
    i.el.classList.toggle('crit', i.offline);
    i.el.querySelector('.alert-title').textContent = `GS ${i.inc[0]} · ${i.offline ? 'OFFLINE' : i.inc[1]}`;
    i.el.querySelector('.alert-body').textContent = i.offline ? `Back online in ${i.left}s` : `Offline in ${i.left}s unless fixed`;
    i.el.querySelector('.g-fix').disabled = !fixable;
    const note = i.el.querySelector('.g-note');
    note.textContent = fixable ? `or offline for ${OFFLINE} s` : `Not enough credits · offline for ${OFFLINE} s`;
    note.classList.toggle('short', !fixable);
    const mins = Math.floor((Date.now() - i.born) / 60000);
    i.el.querySelector('.alert-time').textContent = mins ? `${mins}m ago` : 'now';
  });
}
// the dropdown hangs below the button, right-aligned to it
function toggle(show = !drop.classList.contains('show')) {
  if (show && !issues.length) show = false;
  const r = btn.getBoundingClientRect();
  drop.style.left = Math.max(12, r.right - 330) + 'px';
  drop.style.top = r.bottom + 10 + 'px';
  drop.classList.toggle('show', show);
  btn.classList.toggle('on', show);
}
btn.onclick = e => {
  e.stopPropagation();
  toggle();
};
// a click anywhere else folds it away
document.addEventListener('click', e => {
  if (!drop.contains(e.target)) toggle(false);
});
addEventListener('resize', () => drop.classList.contains('show') && toggle(true));

// Pacing brings the first incident itself, before the first celestial event, then calls startGround(); after that they
// come on their own, one at a time, never during an event or the creature. Nor while a window (a repair, science
// request, launch or emergency, or the dive into one) is open, where the button can't be seen: one that comes due then
// waits until a few seconds after it closes.
const AFTER_WINDOW = 4000;
let windowAt = 0, // when a window was last seen open
  started = false;
const windowOpen = () => state.science || state.launch || !!document.querySelector('.repair-modal.show, .dive.on');
export const groundReady = (t = performance.now()) => !activeEvent && !eventIncoming && !eventHeld() && t - windowAt >= AFTER_WINDOW;
// an incident still waiting to be fixed (one that's gone offline no longer holds anything up)
export const groundOpen = () => issues.some(i => !i.offline);
export function startGround() {
  started = true;
}
const quiet = t => started && groundReady(t);
setInterval(() => {
  issues.slice().forEach(i => {
    if (--i.left > 0) return;
    if (i.offline) return remove(i);
    i.offline = true;
    i.left = OFFLINE;
  });
  const t = performance.now();
  if (windowOpen()) windowAt = t;
  if (!next && started) next = t + between(90, 150);
  if (next && t >= next && quiet(t) && !groundOpen()) {
    triggerGround();
    next = t + between(90, 150);
  }
  render();
}, 1000);
export function resetGround() {
  issues.forEach(i => i.el.remove());
  issues = [];
  next = 0;
  toggle(false);
  render();
}
render();
