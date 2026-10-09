import { activeFaults, scheduleAnomaly, trySpawnAnomaly } from './anomalies.js';
import { activeEvent, eventHeld, eventIncoming } from './events/core.js';
import { scheduleKraken, triggerKraken } from './events/creature.js';
import { scheduleDebris, triggerDebris } from './events/debris.js';
import { scheduleFlare, triggerFlare } from './events/flare.js';
import { scheduleGRB, triggerGRB } from './events/grb.js';
import { pushScience } from './science.js';

// Pacing: how a visit ramps up, so there's time to read, enjoy and do, and something new keeps turning up. Once SUDO
// hands over (or is skipped):
//   opening  faults one at a time until two have come and gone (SUDO's guided fault counts as the first)
//   event    then the first celestial event: a random flare, gamma-ray burst or debris field, never the creature
//   calm     90–120 s of quiet once it's over, with a fresh science request: no faults
//   warm     about six minutes of single faults with 45–75 s gaps; celestial events every 2–3 minutes, and the
//            creature can turn up a minute or two in
//   busy     up to two faults at once, a new one every 20–40 s; events on their own schedules
// Science requests run on their own schedule throughout.
const EVENTS = [triggerFlare, triggerGRB, triggerDebris];
const between = (a, b) => a + Math.random() * (b - a),
  now = () => performance.now() / 1000,
  eventBusy = () => !!activeEvent || eventIncoming || eventHeld();
let stage = null,
  until = 0, // the next fault (or the first event) comes no sooner than this
  warmEnd = 0,
  nextEvent = 0,
  tries = [], // events still to try for the first one: one may not be possible right then (a flare needs sunlit satellites)
  ended = 0;
const live = new Set(); // faults under way, to notice when one ends

function tick() {
  // count faults as they end, fixed or lost; the next one waits a little after each
  const faults = activeFaults(),
    t = now();
  live.forEach(s => {
    if (faults.includes(s)) return;
    live.delete(s);
    ended++;
    until = Math.max(until, t + (stage === 'warm' ? between(45, 75) : between(15, 20)));
  });
  faults.forEach(s => live.add(s));
  if (stage === 'opening') {
    if (ended >= 2) {
      stage = 'event';
      until = t + 10;
      tries = [...EVENTS].sort(() => Math.random() - 0.5);
    } else if (!faults.length && t >= until) trySpawnAnomaly(1);
  } else if (stage === 'event') {
    if (eventBusy()) stage = 'eventLive';
    else if (t >= until) {
      if (tries.length) tries.pop()();
      else startCalm(t); // none could start: move on
    }
  } else if (stage === 'eventLive') {
    if (!eventBusy()) startCalm(t);
  } else if (stage === 'calm') {
    if (t >= until) {
      stage = 'warm';
      warmEnd = t + 360;
      nextEvent = t + between(120, 180);
      until = t + 5;
      setTimeout(
        () => {
          triggerKraken();
          scheduleKraken();
        },
        between(60, 120) * 1000,
      );
    }
  } else if (stage === 'warm') {
    if (t >= warmEnd) return goBusy();
    if (!faults.length && t >= until) trySpawnAnomaly(1);
    if (t >= nextEvent && !eventBusy()) {
      EVENTS[Math.floor(Math.random() * EVENTS.length)]();
      nextEvent = t + between(120, 180);
    }
  }
}
function startCalm(t) {
  stage = 'calm';
  until = t + between(90, 120);
  pushScience();
}
function goBusy() {
  stage = 'busy';
  scheduleAnomaly();
  scheduleGRB();
  scheduleFlare();
  scheduleDebris();
}
setInterval(tick, 1000);
// SUDO hands over (or is skipped): start the opening. Once a visit; replaying the walkthrough doesn't restart it.
export function startPacing() {
  if (stage) return;
  stage = 'opening';
  until = now() + 10;
}
export const pacingStage = () => stage;
