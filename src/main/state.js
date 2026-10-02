// The few values several modules both read and change: the satellite open in the side panel, and the
// satellites under a crosshair (one, or a whole event group) with when that crosshair appeared.
export const state = { selected: null, highlighted: [], highlightAt: 0 };
