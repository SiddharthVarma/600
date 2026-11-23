import { useEffect, useRef, useState } from 'react';
import { DOWNLINK_TIME, SCIENCE, brackets, drawDownlink, hudText, pixelFont, report } from './common.js';
import { Status } from '../shared/layout.jsx';
import { ScienceLayout, ScienceResult } from './layout.jsx';
import { BH, BW, rng } from './scenes.js';

// Exoplanet atmosphere: the follow-up on a planet the transit search found, reading its transmission spectrum. During
// a transit some starlight passes through the planet's atmosphere, and each molecule there absorbs at its own
// wavelengths, so the transit is deeper there: depth against wavelength shows peaks. One transit is too noisy to see
// them; stacking transits averages the noise down as 1/sqrt(N), which is how astronomers really do it with small
// telescopes. The player stacks transits until the peaks stand out, then drags each molecule's label onto its peak;
// which molecules are there depends on the planet's temperature.
// Band centres are real; the wavelength axis is log-scaled, 0.4-12 um (visible light to JWST's mid-infrared).
// The first two spectra in a browser are special: the first has an extra band at 11.8 um, CFC-11 (Freon), which
// nothing natural makes; the second, one sharp line at 450 nm (blue, clear of sodium's 589) that no known element
// absorbs. Both foreshadow the UFOs.
const W = BW * 4,
  H = BH * 4;
const SPEC = { L0: Math.log(0.4), L1: Math.log(12), bins: 64, sigma1: 380, maxN: 20 },
  // Every molecule there might be: its bands (centre um, width in ln(um), amplitude ppm), the one its label shows, and
  // its name for the result. Real band centres; ammonia also absorbs near 3.0 um, left out as it would sit on
  // methane's 3.3.
  MOLECULES = {
    Na: { bands: [[0.589, 0.03, 260]], shows: '0.59 µm', name: 'sodium' },
    K: { bands: [[0.768, 0.03, 220]], shows: '0.77 µm', name: 'potassium' },
    H2O: {
      bands: [
        [1.15, 0.05, 160],
        [1.4, 0.06, 380],
        [1.9, 0.07, 430],
        [2.7, 0.08, 470],
      ],
      shows: '1.9 µm',
      name: 'water vapour',
    },
    CH4: { bands: [[3.3, 0.06, 330]], shows: '3.3 µm', name: 'methane' },
    CO2: { bands: [[4.3, 0.05, 620]], shows: '4.3 µm', name: 'CO2' },
    SO2: { bands: [[7.4, 0.05, 300]], shows: '7.4 µm', name: 'sulphur dioxide' },
    NH3: { bands: [[10.5, 0.05, 330]], shows: '10.5 µm', name: 'ammonia' },
  },
  // What the planet's temperature leaves in its air. Hot planets have sodium and potassium as gases and no methane,
  // which heat breaks down, while starlight-driven chemistry makes SO2 (as on WASP-39b); cool ones keep methane and
  // ammonia (as on K2-18b, methane and CO2).
  AIRS = {
    hot: ['Na', 'K', 'H2O', 'CO2', 'SO2'],
    warm: ['H2O', 'CO2', 'CH4', 'SO2'],
    cool: ['H2O', 'CO2', 'CH4', 'NH3'],
  },
  ODD = { freon: { at: 11.8, w: 0.05, amp: 560 }, element: { at: 0.45, amp: 680 } },
  ODD_RESULT = {
    freon: 'Unidentified absorption at 11.8 µm · consistent with CFC-11 (Freon) · no known natural source',
    element: 'Unidentified line at 450 nm · present in every transit · matches no known element',
  },
  // what the red question mark says when it's clicked
  ODD_NOTE = { element: 'No match in the NIST atomic line database' },
  SPEC_SEEN = 'sixhundred.spectraSeen'; // how many special spectra this browser has found (0, 1 or 2)
const PARAMS = new URLSearchParams(location.search);
function specialsSeen() {
  try {
    return Number(localStorage.getItem(SPEC_SEEN)) || 0;
  } catch {
    return 2;
  }
}
// which spectrum this is: ?special=freon, element or none forces one, for testing
function pickSpecial() {
  const forced = PARAMS.get('special');
  if (forced) return ODD[forced] ? forced : null;
  return ['freon', 'element'][specialsSeen()] || null;
}
// the planet being followed up, as the transit search found it (?planet=, ?depth=, ?teq= its temperature in K);
// opened on its own, a stand-in
function followedUp() {
  const depth = Number(PARAMS.get('depth')),
    teq = Number(PARAMS.get('teq'));
  return {
    name: PARAMS.get('planet') || `TOI-${1000 + Math.floor(Math.random() * 5000)}.01`,
    depth: depth > 0 && depth < 0.1 ? depth : 0.006 + Math.random() * 0.02,
    teq: teq > 0 ? teq : [1300, 800, 350][Math.floor(Math.random() * 3)],
  };
}
// What's in this planet's air, by its temperature. The Freon spectrum skips ammonia, whose 10.5 um peak would crowd
// Freon's 11.8.
function airOf(planet, special) {
  let present = AIRS[planet.teq > 1000 ? 'hot' : planet.teq > 500 ? 'warm' : 'cool'];
  if (special === 'freon' && present.includes('NH3')) present = AIRS.warm;
  // the labels in the tray come shuffled, never in wavelength order, so their order doesn't give the peaks away
  const byWave = [...present].sort((a, b) => MOLECULES[a].bands[0][0] - MOLECULES[b].bands[0][0]);
  let order;
  do order = [...present].sort(() => Math.random() - 0.5);
  while (order.join() === byWave.join());
  return { present, order };
}
// the molecules found, as a list for the result: "sodium, potassium and CO2"
const listOf = ms => {
  const names = ms.map(m => MOLECULES[m].name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
};
const binL = i => Math.exp(SPEC.L0 + ((i + 0.5) / SPEC.bins) * (SPEC.L1 - SPEC.L0));
// the true depth (ppm) in each wavelength bin
function spectrumModel(base, special, present) {
  return Array.from({ length: SPEC.bins }, (_, i) => {
    const l = binL(i),
      bump = ([c, w, A]) => A * Math.exp(-((Math.log(l) - Math.log(c)) ** 2) / (2 * w * w));
    let d = base + present.reduce((s, m) => s + MOLECULES[m].bands.reduce((t, b) => t + bump(b), 0), 0);
    if (special === 'freon') d += bump([ODD.freon.at, ODD.freon.w, ODD.freon.amp]);
    // a single atomic line: far narrower than a bin, so it lands in one
    const lo = Math.exp(SPEC.L0 + (i / SPEC.bins) * (SPEC.L1 - SPEC.L0)),
      hi = Math.exp(SPEC.L0 + ((i + 1) / SPEC.bins) * (SPEC.L1 - SPEC.L0));
    if (special === 'element' && ODD.element.at >= lo && ODD.element.at < hi) d += ODD.element.amp;
    return d;
  });
}
// the spectrum plot's frame on the canvas, and where things sit in it
const SP = { l: 124, r: 28, t: 70, b: 196 },
  spX = l => SP.l + ((Math.log(l) - SPEC.L0) / (SPEC.L1 - SPEC.L0)) * (W - SP.l - SP.r),
  // the tray: as many slots as labels (up to six), side by side after its caption
  TRAY = { l: 184, r: W - SP.r },
  chipStep = n => (TRAY.r - TRAY.l) / n,
  chipW = n => chipStep(n) - 14,
  chipX = (k, n) => TRAY.l + chipStep(n) * (k + 0.5),
  CHIP_H = 60,
  CHIP_Y = H - 76;
// one more transit's worth of noise in every bin (a rough Gaussian from summed uniforms)
function addTransit(sp) {
  const u = sp.rand;
  for (let i = 0; i < SPEC.bins; i++) sp.noise[i] += (u() + u() + u() + u() - 2) * 1.73 * SPEC.sigma1;
}
// a small label: dark with a coloured edge, or filled
function label(ctx, text, cx, cy, color, filled) {
  ctx.font = pixelFont(22);
  const w = ctx.measureText(text).width + 20;
  ctx.fillStyle = filled ? color : 'rgba(2,4,6,.9)';
  ctx.fillRect(cx - w / 2, cy - 16, w, 32);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - w / 2, cy - 16, w, 32);
  ctx.fillStyle = filled ? '#061206' : color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
}
function drawSpectrum(ctx, sp, { N, placed, drag, wrong, special, now, note, air }) {
  const { present, order } = air;
  const lo = sp.base - 500,
    hi = sp.base + 950,
    yOf = d => SP.t + ((hi - d) / (hi - lo)) * (H - SP.t - SP.b),
    sigma = SPEC.sigma1 / Math.sqrt(N),
    depthAt = l => sp.model[Math.min(SPEC.bins - 1, Math.max(0, Math.floor(((Math.log(l) - SPEC.L0) / (SPEC.L1 - SPEC.L0)) * SPEC.bins)))];
  ctx.fillStyle = '#030408';
  ctx.fillRect(0, 0, W, H);
  // axes: depth up the side (every 200 ppm a line, every 400 a number), wavelength along the bottom
  ctx.font = pixelFont(22);
  ctx.strokeStyle = '#1b2220';
  ctx.lineWidth = 1;
  for (let d = Math.ceil(lo / 200) * 200; d <= hi; d += 200) {
    ctx.beginPath();
    ctx.moveTo(SP.l, yOf(d));
    ctx.lineTo(W - SP.r, yOf(d));
    ctx.stroke();
  }
  ctx.fillStyle = '#7b8580';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let d = Math.ceil(lo / 400) * 400; d <= hi - 100; d += 400) ctx.fillText(String(d), SP.l - 12, yOf(d));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const l of [0.5, 1, 2, 3, 5, 8, 12]) ctx.fillText(String(l), spX(l), H - SP.b + 10);
  ctx.fillText('WAVELENGTH  µm', (SP.l + W - SP.r) / 2, H - SP.b + 38);
  ctx.save();
  ctx.translate(22, (SP.t + H - SP.b) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('DEPTH  ppm', 0, -10);
  ctx.restore();
  // the measurements: each bin's average over the transits combined, with its error bar
  const e = (sigma / (hi - lo)) * (H - SP.t - SP.b);
  for (let i = 0; i < SPEC.bins; i++) {
    const x = Math.round(spX(binL(i))),
      y = Math.round(yOf(sp.model[i] + sp.noise[i] / N)),
      top = Math.max(SP.t, y - e),
      bottom = Math.min(H - SP.b, y + e);
    ctx.fillStyle = 'rgba(85,182,255,.35)';
    if (bottom > top) ctx.fillRect(x - 1, top, 2, bottom - top);
    if (y < SP.t - 4 || y > H - SP.b + 4) continue;
    ctx.fillStyle = '#e8ead8';
    ctx.fillRect(x - 4, y - 4, 8, 8);
  }
  // the labels pinned to their peaks; once all four are on, whatever's left over gets a question mark
  const pin = (text, l, color, filled) => {
    const yb = yOf(depthAt(l)),
      cy = Math.max(SP.t + 22, yb - 70);
    ctx.strokeStyle = color;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(spX(l), cy + 16);
    ctx.lineTo(spX(l), yb - 12);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, text, spX(l), cy, color, filled);
    return { x: spX(l), y: cy };
  };
  Object.entries(placed).forEach(([m, l]) => pin(m, l, '#c9ff4d', true));
  // the question mark, where a click can find it, and what it says once clicked
  sp.question = special && present.every(m => placed[m]) ? pin('?', ODD[special].at, '#ff5964', false) : null;
  if (note && sp.question && ODD_NOTE[special]) {
    ctx.font = pixelFont(22);
    const text = ODD_NOTE[special],
      w = ctx.measureText(text).width + 24,
      x = Math.min(W - SP.r - w, sp.question.x + 30);
    ctx.fillStyle = 'rgba(2,4,6,.95)';
    ctx.fillRect(x, sp.question.y - 18, w, 36);
    ctx.strokeStyle = '#ff5964';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, sp.question.y - 18, w, 36);
    ctx.fillStyle = '#ff5964';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 12, sp.question.y + 1);
  }
  // the tray: each label not yet placed, with where that molecule absorbs
  if (order.some(m => !placed[m] && drag?.m !== m)) {
    ctx.font = pixelFont(22);
    ctx.fillStyle = '#7b8580';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('DRAG ONTO', SP.l - 90, H - 58);
    ctx.fillText('ITS PEAK', SP.l - 90, H - 32);
  }
  const n = order.length,
    cw = chipW(n);
  order.forEach((m, k) => {
    if (placed[m] || drag?.m === m) return;
    const x = chipX(k, n),
      red = wrong && wrong.m === m && now - wrong.at < 0.8;
    ctx.fillStyle = 'rgba(2,4,6,.9)';
    ctx.fillRect(x - cw / 2, CHIP_Y, cw, CHIP_H);
    ctx.strokeStyle = red ? '#ff5964' : '#c9ff4d';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - cw / 2, CHIP_Y, cw, CHIP_H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = red ? '#ff5964' : '#c9ff4d';
    ctx.fillText(m, x, CHIP_Y + 18);
    ctx.fillStyle = '#9aa19e';
    ctx.fillText(MOLECULES[m].shows, x, CHIP_Y + 44);
  });
  if (drag) label(ctx, drag.m, drag.x, drag.y, '#c9ff4d', true);
  hudText(ctx, `TRANSITS COMBINED · ${N}`, 'left', 'top');
  hudText(ctx, `ERROR ±${Math.round(sigma)} ppm`, 'right', 'top');
}

export function Atmosphere() {
  const info = SCIENCE.atmosphere;
  const canvasRef = useRef(null);
  const [planet] = useState(followedUp);
  const [special] = useState(pickSpecial);
  const [air] = useState(() => airOf(planet, special));
  const { present, order } = air;
  const [phase, setPhase] = useState('spectrum'); // spectrum → downlink → done
  const [combined, setCombined] = useState(1);
  const [placed, setPlaced] = useState({}); // molecule → the band (um) its label was dropped on
  const live = useRef({});
  live.current = { phase, combined, placed };
  const hold = useRef({ drag: null, wrong: null, note: false });
  // the true depth in each bin, and each bin's noise summed over the transits combined so far
  const spec = useRef(null);
  if (!spec.current) {
    const base = planet.depth * 1e6;
    spec.current = {
      base,
      model: spectrumModel(base, special, present),
      noise: new Float64Array(SPEC.bins),
      rand: rng(Math.floor(Math.random() * 1e9)),
    };
    addTransit(spec.current);
  }

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    let raf,
      sentAt = 0,
      reported = false;
    const loop = () => {
      const now = performance.now() / 1000,
        { phase, combined, placed } = live.current,
        H0 = hold.current;
      drawSpectrum(ctx, spec.current, { N: combined, placed, drag: H0.drag, wrong: H0.wrong, special, now, note: H0.note, air });
      brackets(ctx);
      if (phase === 'downlink') {
        sentAt ||= now;
        const d = now - sentAt;
        drawDownlink(ctx, d);
        if (d >= DOWNLINK_TIME && !reported) {
          reported = true;
          report({ type: 'science-complete', kind: 'atmosphere', special });
          // one more of the strange ones found (not when forced for testing)
          if (special && !PARAMS.get('special'))
            try {
              localStorage.setItem(SPEC_SEEN, String(specialsSeen() + 1));
            } catch {
              // no storage: it'll turn up again next time
            }
          setPhase('done');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [special, air]);

  // pick a label up from the tray, drag it, and drop it on one of its molecule's peaks
  const toCanvas = e => {
    const r = canvasRef.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const down = e => {
    const [x, y] = toCanvas(e),
      q = spec.current.question,
      onQuestion = q && Math.abs(x - q.x) < 26 && Math.abs(y - q.y) < 20;
    // the question mark says what it is; a click anywhere else puts that away
    hold.current.note = onQuestion && !hold.current.note;
    if (onQuestion || phase !== 'spectrum') return;
    const n = order.length,
      k = order.findIndex((m, k) => !placed[m] && Math.abs(x - chipX(k, n)) < chipW(n) / 2 && y > CHIP_Y && y < CHIP_Y + CHIP_H);
    if (k < 0) return;
    hold.current.drag = { m: order[k], x, y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = e => {
    const d = hold.current.drag;
    if (d) [d.x, d.y] = toCanvas(e);
  };
  const up = () => {
    const d = hold.current.drag;
    if (!d) return;
    hold.current.drag = null;
    const hit = d.y < H - SP.b && MOLECULES[d.m].bands.find(([c]) => Math.abs(spX(c) - d.x) < 28);
    if (hit) setPlaced(p => ({ ...p, [d.m]: hit[0] }));
    else hold.current.wrong = { m: d.m, at: performance.now() / 1000 };
  };
  const combine = () => {
    addTransit(spec.current);
    setCombined(n => n + 1);
  };

  return (
    <ScienceLayout
      info={info}
      view={
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ cursor: phase === 'spectrum' ? 'grab' : 'default', touchAction: 'none' }}
        />
      }
      left={
        phase === 'spectrum' &&
        combined < SPEC.maxN && (
          <button className="action" onClick={combine}>
            STACK TRANSITS
          </button>
        )
      }
      right={
        phase === 'done' ? (
          <button className="action" onClick={() => report({ type: 'science-close' })}>
            DONE
          </button>
        ) : (
          <button className="action" disabled={phase !== 'spectrum' || !present.every(m => placed[m])} onClick={() => setPhase('downlink')}>
            DOWNLINK
          </button>
        )
      }
      result={
        phase === 'done' &&
        (special ? (
          <Status tone="bad">{ODD_RESULT[special]}</Status>
        ) : (
          <ScienceResult ok>
            {info.uni} confirms {listOf(present)} in the air of {planet.name}
          </ScienceResult>
        ))
      }
    />
  );
}
