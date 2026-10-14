// The few values several modules both read and change: the satellite open in the side panel, and the
// satellites under a crosshair (one, or a whole event group) with when that crosshair appeared.
// intro: while SUDO's first-shift walkthrough runs, random anomalies, science requests and celestial events wait.
// science / launch: a science window (or its dive) or the launch window is open; a celestial event that comes due waits
// for it to close.
// faultsAfter: no new everyday fault before this time (performance.now()), e.g. a breather after the creature leaves.
// sudoScience: SUDO is introducing the first science request, so no other request arrives until it's been opened.
export const state = {
  selected: null,
  highlighted: [],
  highlightAt: 0,
  intro: false,
  science: false,
  launch: false,
  faultsAfter: 0,
  sudoScience: false,
};
