// The few values several modules both read and change: the satellite open in the side panel, and the
// satellites under a crosshair (one, or a whole event group) with when that crosshair appeared.
// intro: while SUDO's first-shift walkthrough runs, random anomalies, science requests and celestial events wait.
// science / launch: a science window (or its dive) or the launch window is open; a celestial event that comes due waits
// for it to close.
export const state = { selected: null, highlighted: [], highlightAt: 0, intro: false, science: false, launch: false };
