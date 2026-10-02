import { state } from './state.js';

// Minigame windows load hidden with ?preload and wait. Each reports 'repair-loaded' once compiled; the game only starts
// ('repair-start') when it is both loaded and on screen, so no time is spent while the player can't see it. The same
// launcher runs satellite repairs and the three event windows.
export const launchers = {};
export function launcher(frameId, modalId) {
  return (launchers[frameId] ||= {
    frame: document.getElementById(frameId),
    modal: document.getElementById(modalId),
    loaded: false,
    shown: false,
    started: false,
    deadline: () => null,
  });
}
export function preload(L, url, deadline = () => null) {
  Object.assign(L, { loaded: false, shown: false, started: false, deadline });
  L.frame.src = url + '&preload=1';
}
export function reveal(L) {
  L.shown = true;
  L.modal.classList.add('show');
  startIfReady(L);
}
export function startIfReady(L) {
  if (!L.loaded || !L.shown || L.started) return;
  L.started = true;
  L.frame.contentWindow.postMessage({ type: 'repair-start', deadline: L.deadline() }, '*');
  L.frame.contentWindow.focus(); // keyboard games (debris, flare) need focus inside the iframe or the arrow keys stay on this page
}
export function cancelPreload(L) {
  if (!L.shown) L.frame.src = '';
}
const REPAIR = launcher('repairFrame', 'repairModal');
export function loadRepair(type) {
  preload(
    REPAIR,
    `react.html?type=${type}&deadline=${state.selected ? state.selected.countdown : ''}&sat=${state.selected ? state.selected.id : ''}`,
    () => (state.selected ? state.selected.countdown : null),
  );
}
export const showRepair = () => reveal(REPAIR),
  cancelRepairPreload = () => cancelPreload(REPAIR);
export function fadeCloseModal(modalId, frameId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('show');
  setTimeout(() => {
    document.getElementById(frameId).src = '';
  }, 260);
}
export function closeRepair() {
  REPAIR.shown = false;
  fadeCloseModal('repairModal', 'repairFrame');
}
