// The few values several modules both read and change: the satellite open in the side panel, and the
// satellites under a crosshair (one, or a whole event group) with when that crosshair appeared.
// intro: while SUDO's first-shift walkthrough runs, random anomalies, science requests and celestial events wait.
// science / launch: a science window (or its dive) or the launch window is open; a celestial event that comes due waits
// for it to close.
// faultsAfter: no new everyday fault before this time (performance.now()), e.g. a breather after the creature leaves.
// eventsAfter: likewise for celestial events: none before this time.
// sudoScience: SUDO is introducing the first science request, so no other request arrives until it's been opened.
// krakenDue: the creature is due but waiting for the open fault tickets to clear; no new faults meanwhile.
// teaseDue: the first celestial event is over, so hosted payload requests now offer galaxy classification (where the
// creature first shows itself) until it's been seen. krakenAwaitsTease: the creature came due before that, and waits.
export const state = {
  selected: null,
  highlighted: [],
  highlightAt: 0,
  intro: false,
  science: false,
  launch: false,
  faultsAfter: 0,
  eventsAfter: 0,
  sudoScience: false,
  krakenDue: false,
  teaseDue: false,
  krakenAwaitsTease: false,
};
// The creature's first appearance is a glimpse inside a galaxy classification request, and the attack never comes
// before it. Seen once in this browser, it's done (the science window, on the same origin, records it). With no
// storage there's no record to wait on, so the creature isn't held back.
export function teaseSeen() {
  try {
    return !!localStorage.getItem('sixhundred.thingSeen');
  } catch {
    return true;
  }
}
