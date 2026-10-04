// The few values several modules both read and change: the satellite open in the side panel, and the
// satellites under a crosshair (one, or a whole event group) with when that crosshair appeared.
// intro: while SUDO's first-shift walkthrough runs, random anomalies, science requests and celestial events wait.
export const state = { selected: null, highlighted: [], highlightAt: 0, intro: false };
