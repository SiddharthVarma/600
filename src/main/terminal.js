import { EVENTS, eventActive, runEmergency } from './events/core.js';
import { cancelRepairPreload, loadRepair, showRepair } from './launcher.js';
import { state } from './state.js';

// Command terminal in the investigation panel: each repair is a procedure script. Clicking a file types and runs it;
// the right script for the fault hands over to the repair lab, any other is rejected.
const SCRIPTS = {
  'align_array.py': 'solar',
  'blind_acq.py': 'contact',
  'burn_plan.py': 'orbit',
  'cpu_purge.py': 'process',
  'power_cycle.py': 'power',
  'thermal_reroute.py': 'thermal',
  'tracker_recal.py': 'startracker',
  'wheel_reconfig.py': 'wheel',
};
const FAULT_SUBSYSTEM = {
  thermal: 'TCS',
  power: 'EPS',
  solar: 'EPS',
  wheel: 'ADCS',
  startracker: 'ADCS',
  contact: 'COMMS',
  orbit: 'GNC',
  process: 'OBC',
};
const FAULT_TELEMETRY = {
  thermal: 'core 78°C · coolant loop flow low',
  power: 'bus 32% · regulation unstable',
  solar: 'battery 31% and falling · array off-sun',
  wheel: 'RW3 0 rpm · torque margin 34%',
  startracker: 'star tracker lost lock · attitude error rising',
  contact: 'last ground contact missed · RSSI -52 dBm',
  orbit: 'altitude decaying · below station-keeping box',
  process: 'CPU 98% · cluster overloaded',
};
const NOMINAL_TELEMETRY = {
  EPS: 'bus nominal',
  TCS: 'temperatures nominal',
  COMMS: 'link nominal',
  ADCS: 'attitude nominal',
  OBC: 'load nominal',
  GNC: 'orbit nominal',
};
export const term = document.getElementById('term'),
  sleep = ms => new Promise(r => setTimeout(r, ms));
export let termSat = null,
  termEvent = null,
  termRun = 0,
  promptEl = null; // termEvent: which emergency the fleet session was opened for // termRun bumps to cancel a running script when the panel switches satellite
// The ops computer's home holds procedures/ (run inside a satellite over ssh) and emergency/ (fleet-wide, run locally).
export const FLEET = 'fleet',
  HOME_PROMPT = '<span class="term-prompt">ops@600:~$</span> ';
const promptHTML = s =>
  s === FLEET
    ? '<span class="term-prompt">ops@600:~/emergency$</span> '
    : `<span class="term-prompt">ops@sat-${String(s.id).padStart(3, '0')}:~/procedures$</span> `;
async function termType(prefix, cmd, run) {
  // types a command after a prompt; false if the session changed mid-way
  const line = termLine(prefix + '<span class="term-typed"></span><span class="term-cursor"></span>');
  for (const ch of cmd) {
    line.querySelector('.term-typed').textContent += ch;
    await sleep(16);
    if (run !== termRun) return false;
  }
  line.querySelector('.term-cursor').remove();
  return true;
}
const fsw = s => `4.${8 + (s.id % 7)}.${s.id % 13}`; // each satellite always reports the same flight software version
export function termLine(html, cls = '') {
  const d = document.createElement('div');
  d.className = 'term-line ' + cls;
  d.innerHTML = html;
  term.appendChild(d);
  term.scrollTop = term.scrollHeight;
  return d;
}
export function termPrompt(s) {
  promptEl = termLine(promptHTML(s) + '<span class="term-typed"></span><span class="term-cursor"></span>');
}
function termLs(s) {
  termLine(promptHTML(s) + 'ls');
  termLine(
    Object.keys(SCRIPTS)
      .concat('telemetry.log')
      .map(f => `<span class="term-file" data-file="${f}">${f}</span>`)
      .join(''),
    'term-files',
  );
  termPrompt(s);
}
export async function termReset(s) {
  // opening a satellite logs into it first; no prompt (so no clicks) until the session is up
  const run = ++termRun,
    id = String(s.id).padStart(3, '0');
  term.innerHTML = '';
  termSat = s;
  promptEl = null;
  if (!(await termType(HOME_PROMPT, `ssh ops@sat-${id}`, run))) return;
  await sleep(250);
  if (run !== termRun) return;
  termLine(`sshing into SAT ${id} via ${UPLINK_STATIONS[s.id % UPLINK_STATIONS.length]}…`, 'term-muted');
  await sleep(400);
  if (run !== termRun) return;
  termLine(`connected · fsw ${fsw(s)}`, 'term-muted');
  await sleep(150);
  if (run !== termRun) return;
  if (!(await termType(`<span class="term-prompt">ops@sat-${id}:~$</span> `, 'cd procedures', run))) return;
  await sleep(120);
  if (run !== termRun) return;
  termLs(s);
}
export async function termFleet(ev) {
  // an emergency ticket opens the ops computer itself, in emergency/
  const run = ++termRun;
  term.innerHTML = '';
  termSat = FLEET;
  termEvent = ev;
  promptEl = null;
  if (!(await termType(HOME_PROMPT, 'ls', run))) return;
  termLine('<span class="term-dir">procedures/</span><span class="term-dir">emergency/</span>', 'term-files');
  await sleep(200);
  if (run !== termRun) return;
  if (!(await termType(HOME_PROMPT, 'cd emergency', run))) return;
  await sleep(120);
  if (run !== termRun) return;
  if (ev && ev.kind === 'kraken') {
    if (!(await termType(promptHTML(FLEET), 'grep -ril cosmic_horror .', run))) return;
    termLine('no procedure found for: cosmic_horror', 'term-warn');
  }
  termLsFleet();
}
export function termLsFleet() {
  termLine(promptHTML(FLEET) + 'ls');
  termLine(
    Object.values(EVENTS)
      .filter(e => e.script)
      .map(e => `<span class="term-file" data-file="${e.script}">${e.script}</span>`)
      .join(''),
    'term-files',
  );
  termPrompt(FLEET);
}
export function termNote(text, cls, target = state.selected) {
  // a line from outside the terminal (repair finished, aborted, satellite lost), kept above the prompt
  if (!termSat || termSat !== target) return;
  const hadPrompt = !!promptEl;
  if (promptEl) promptEl.remove();
  termLine(text, cls);
  if (hadPrompt) termPrompt(termSat);
}
function telemetryTail(s) {
  const t = k => new Date(Date.now() - k * 4000).toTimeString().slice(0, 8),
    fault = s.anomaly && FAULT_TELEMETRY[s.anomalyType];
  const quiet = Object.keys(NOMINAL_TELEMETRY)
    .filter(k => !fault || k !== FAULT_SUBSYSTEM[s.anomalyType])
    .slice(0, 3);
  quiet.forEach((k, i) => termLine(`${t(3 - i)}  ${k.padEnd(5)} ${NOMINAL_TELEMETRY[k]}`, 'term-muted'));
  if (fault) termLine(`${t(0)}  ${FAULT_SUBSYSTEM[s.anomalyType].padEnd(5)} ${fault}`, 'term-warn');
  else termLine(`${t(0)}  all subsystems nominal`, 'term-ok');
}
export const UPLINK_STATIONS = [
  'SVALBARD',
  'INUVIK',
  'KOCHI',
  'DUBLIN',
  'TENERIFE',
  'BEIJING',
  'GOONHILLY',
  'ADELAIDE',
  'PERTH',
  'TIRANE',
  'PUNE',
  'GAZA',
  'MALTA',
  'HOUSTON',
  'SEATTLE',
  'SANTIAGO',
  'SAO PAULO',
  'ABUJA',
  'DAR ES SALAAM',
  'DURBAN',
];
function procedureLog(s, accepted) {
  // what a procedure prints on its way to the satellite
  const id = String(s.id).padStart(3, '0'),
    tc = () =>
      '0x' +
      Math.floor(0x1000 + Math.random() * 0xefff)
        .toString(16)
        .toUpperCase();
  let seq = 1000 + Math.floor(Math.random() * 8000);
  const lines = [
    [`scid globals loaded · SAT ${id} · fsw ${fsw(s)}`, 'term-muted'],
    [`s3://600-ops/sat-${id}/procedures.db found`, 'term-muted'],
    [`POST /api/sat/${id}/session  201`, 'term-muted'],
    [`uplink via ${UPLINK_STATIONS[s.id % UPLINK_STATIONS.length]} · elev ${18 + Math.floor(Math.random() * 60)}°`, 'term-muted'],
    [`POST /api/sat/${id}/tc  201`, 'term-muted'],
  ];
  if (accepted)
    lines.push(
      [`TC ${tc()} accepted · seq ${seq++}`],
      [`TC ${tc()} accepted · seq ${seq++}`],
      [`POST /api/sat/${id}/verify  201`, 'term-muted'],
      ['202 accepted · handing control to operator', 'term-ok'],
    );
  else lines.push([`TC ${tc()} rejected onboard`, 'term-warn'], ['400 rejected · precondition failed', 'term-err']);
  return lines;
}
export async function termRunFile(file) {
  const fleet = termSat === FLEET,
    s = fleet ? null : state.selected;
  if ((!fleet && !s) || !promptEl || eventActive()) return; // no prompt means a script is still running
  const run = ++termRun,
    line = promptEl,
    cmd = file.endsWith('.py') ? `python3 ${file}` : `tail ${file}`;
  promptEl = null;
  for (const ch of cmd) {
    line.querySelector('.term-typed').textContent += ch;
    await sleep(16);
    if (run !== termRun) return;
  }
  line.querySelector('.term-cursor').remove();
  if (fleet) return runEmergency(file, run);
  if (!file.endsWith('.py')) {
    telemetryTail(s);
    termPrompt(s);
    return;
  }
  const type = SCRIPTS[file],
    accepted = s.anomaly && s.anomalyType === type;
  if (accepted) loadRepair(type); // the repair lab downloads and compiles behind the log, so it is ready when the log finishes
  for (const [text, cls] of procedureLog(s, accepted)) {
    await sleep(90 + Math.random() * 160);
    if (run !== termRun) return cancelRepairPreload();
    termLine(text, cls);
  }
  if (accepted) {
    await sleep(450);
    if (run !== termRun) return cancelRepairPreload();
    termPrompt(s);
    if (eventActive()) cancelRepairPreload();
    else showRepair();
  } else {
    document.getElementById('hint').textContent = 'command logged · anomaly persists';
    termLs(s);
  }
}
