import { useEffect, useRef, useState } from 'react';
import { DOWNLINK_TIME, SCIENCE, brackets, drawDownlink, hudText, report } from './common.js';
import { BH, BW, rng } from './scenes.js';

// Exoplanet transit search. One star's brightness streams in; when its planet crosses in front, it dims by the
// fraction of the disc covered, depth = (Rp/R*)², for a duration set by the orbit (Kepler's third law gives the orbit
// size from the period and the star's mass). The player taps each dip as it scrolls past; three pin down the period.
// Starspots make the star wander slowly and flares spike it; neither is a transit. The result is worked out from the
// player's own marks and the data, then the light curve is folded on that period.
const FIT = `min(${BW * 4}px, calc((100vh - 340px) * ${BW / BH}))`;
const W = BW * 4,
  H = BH * 4,
  STAR_H = 150, // star-field strip at the top of the view
  DAYS_SHOWN = 3, // width of the light-curve window
  DAY_SECONDS = 3, // real seconds per simulated day
  CADENCE = 0.01, // days between brightness measurements
  NOISE = 0.0012,
  NEEDED = 3;
const R_SUN_AU = 0.00465047,
  R_EARTH_PER_SUN = 109.08,
  R_EARTH_PER_JUP = 11.21;
const STARS = [
  { type: 'G', R: 1, M: 1, T: 5772, P: [2, 5], depth: [0.006, 0.014], flares: 0.15 },
  { type: 'K', R: 0.75, M: 0.8, T: 4800, P: [1.5, 4], depth: [0.007, 0.02], flares: 0.3 },
  { type: 'M', R: 0.45, M: 0.5, T: 3500, P: [1, 3], depth: [0.008, 0.028], flares: 0.6 },
];

function makeSystem(seed) {
  const r = rng(seed),
    star = STARS[Math.floor(r() * STARS.length)],
    P = star.P[0] + r() * (star.P[1] - star.P[0]),
    depth = star.depth[0] + r() * (star.depth[1] - star.depth[0]),
    a = Math.cbrt(star.M * (P / 365.25) ** 2), // AU
    dur = (P / Math.PI) * Math.asin(Math.min(1, (star.R * R_SUN_AU) / a)), // a central transit, circular orbit
    t0 = 0.8 + r() * (P - 0.3); // first mid-transit, never right at the start
  const flares = [];
  for (let t = r() * 3; t < 400; t += 1 + r() * (3 / star.flares)) flares.push({ t, amp: 0.004 + r() * 0.01 });
  return {
    star,
    P,
    depth,
    a,
    dur,
    t0,
    flares,
    spot: { amp: 0.0015 + r() * 0.0025, period: 8 + r() * 6, ph: r() * 6 },
    name: `TOI-${1000 + Math.floor(r() * 5000)}.01`,
    field: Array.from({ length: 70 }, () => ({ x: r() * BW, y: r() * (STAR_H / 4), b: Math.pow(r(), 3) })),
    noise: rng(seed + 7),
  };
}
// how far into a transit time t is (0 outside one), with a short ingress and egress and a limb-darkened floor
function transitDip(sys, t) {
  const ph = ((((t - sys.t0) % sys.P) + sys.P * 1.5) % sys.P) - sys.P / 2,
    x = Math.abs(ph),
    half = sys.dur / 2,
    edge = sys.dur * 0.15;
  if (x >= half) return 0;
  if (x > half - edge) return (sys.depth * (half - x)) / edge;
  return sys.depth * (1 - 0.25 * (x / half) ** 2);
}
function brightness(sys, t) {
  let f = 1 + sys.spot.amp * Math.sin((2 * Math.PI * t) / sys.spot.period + sys.spot.ph) - transitDip(sys, t);
  sys.flares.forEach(fl => {
    if (t >= fl.t && t < fl.t + 0.3) f += fl.amp * Math.exp(-(t - fl.t) / 0.03);
  });
  // a rough Gaussian from summed uniforms
  const g = (sys.noise() + sys.noise() + sys.noise() + sys.noise() - 2) * 1.73;
  return f + g * NOISE;
}
const epochOf = (sys, t) => Math.round((t - sys.t0) / sys.P);
function describe(sys, marks, data) {
  // the period from the player's own marks (least squares of mark time against transit number)...
  const ns = marks.map(m => m.n),
    ts = marks.map(m => m.t),
    mn = ns.reduce((a, b) => a + b) / ns.length,
    mt = ts.reduce((a, b) => a + b) / ts.length;
  const P = ns.reduce((s, n, i) => s + (n - mn) * (ts[i] - mt), 0) / ns.reduce((s, n) => s + (n - mn) ** 2, 0);
  // ...and the depth from the data: in-transit floor against everything else
  const inT = data.filter(d => transitDip(sys, d.t) > sys.depth * 0.6),
    outT = data.filter(d => transitDip(sys, d.t) === 0),
    mean = a => a.reduce((s, d) => s + d.f, 0) / a.length,
    depth = Math.max(0, mean(outT) - mean(inT));
  const ratio = Math.sqrt(depth),
    rEarth = ratio * sys.star.R * R_EARTH_PER_SUN,
    a = Math.cbrt(sys.star.M * (P / 365.25) ** 2),
    teq = sys.star.T * Math.sqrt((sys.star.R * R_SUN_AU) / (2 * a)) * Math.pow(0.7, 0.25); // albedo 0.3
  const kind =
    rEarth < 1.25
      ? 'A ROCKY PLANET'
      : rEarth < 2
        ? 'A SUPER-EARTH'
        : rEarth < 4
          ? 'A SUB-NEPTUNE'
          : rEarth < 8
            ? 'A NEPTUNE-SIZED PLANET'
            : P < 10
              ? 'A HOT JUPITER'
              : 'A GAS GIANT';
  const size = rEarth >= 8 ? `${(rEarth / R_EARTH_PER_JUP).toFixed(1)} × JUPITER'S RADIUS` : `${rEarth.toFixed(1)} × EARTH'S RADIUS`;
  return { P, kind, size, a, teq };
}

export function Transit() {
  const info = SCIENCE.exoplanet;
  const canvasRef = useRef(null);
  const [sys] = useState(() => makeSystem(Math.floor(Math.random() * 1e9)));
  const [phase, setPhase] = useState('watch'); // watch → downlink → done
  const [found, setFound] = useState(0);
  const [result, setResult] = useState(null);
  const live = useRef({});
  live.current = { phase, result };
  const state = useRef({ T: 0, data: [], marks: [], misses: [] });

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d'),
      S = state.current;
    const t0 = performance.now() / 1000;
    let raf,
      last = t0,
      sentAt = 0,
      reported = false;
    const cx0 = 70,
      cw = W - 90,
      cy0 = STAR_H + 40,
      ch = H - STAR_H - 80;
    const loop = () => {
      const now = performance.now() / 1000,
        dt = Math.min(0.05, now - last),
        { phase, result } = live.current;
      last = now;
      // data arrives in real time until the job is done
      if (phase === 'watch') {
        S.T += dt / DAY_SECONDS;
        while ((S.data.length ? S.data[S.data.length - 1].t : -CADENCE) + CADENCE <= S.T) {
          const t = (S.data.length ? S.data[S.data.length - 1].t : 0) + CADENCE;
          S.data.push({ t, f: brightness(sys, t) });
        }
      }
      ctx.fillStyle = '#030408';
      ctx.fillRect(0, 0, W, H);
      // the star field, with the target in a photometry aperture
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, W, STAR_H);
      sys.field.forEach(s => {
        ctx.fillStyle = `rgba(230,236,250,${0.25 + s.b * 0.75})`;
        ctx.fillRect(Math.round(s.x) * 4, Math.round(s.y) * 4, 4, 4);
      });
      const tx = W / 2,
        ty = STAR_H / 2,
        latest = S.data.length ? S.data[S.data.length - 1].f : 1,
        glow = Math.max(0.4, Math.min(1, 0.8 + (latest - 1) * 25));
      ctx.fillStyle = `rgba(255,${sys.star.type === 'M' ? 170 : sys.star.type === 'K' ? 205 : 236},${sys.star.type === 'G' ? 190 : 140},${glow})`;
      ctx.fillRect(tx - 6, ty - 6, 12, 12);
      ctx.fillRect(tx - 10, ty - 2, 20, 4);
      ctx.fillRect(tx - 2, ty - 10, 4, 20);
      ctx.strokeStyle = 'rgba(85,182,255,.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, 26, 0, Math.PI * 2);
      ctx.stroke();
      hudText(ctx, `${sys.name} · ${sys.star.type}-TYPE STAR`, 'left', 'top');
      hudText(ctx, `DAY ${S.T.toFixed(1)}`, 'right', 'top');
      // the light curve: the last few days, scrolling left, or folded on the period once it's known
      ctx.strokeStyle = '#27302d';
      ctx.strokeRect(cx0, cy0, cw, ch);
      const lo = 1 - sys.depth * 1.6 - 0.004,
        hi = 1 + 0.008,
        yOf = f => cy0 + ch - ((Math.min(hi, Math.max(lo, f)) - lo) / (hi - lo)) * ch;
      ctx.font = '14px "Courier New", monospace';
      ctx.fillStyle = '#7b8580';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      if (phase !== 'done') {
        const tL = S.T - DAYS_SHOWN,
          xOf = t => cx0 + ((t - tL) / DAYS_SHOWN) * cw;
        ctx.fillText('BRIGHTNESS', cx0, cy0 - 6);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let d = Math.ceil(tL); d <= S.T; d++) {
          ctx.fillStyle = '#1c2422';
          ctx.fillRect(xOf(d), cy0, 1, ch);
          ctx.fillStyle = '#7b8580';
          ctx.fillText(`DAY ${d}`, xOf(d), cy0 + ch + 6);
        }
        ctx.fillStyle = '#e8ead8';
        S.data.forEach(d => d.t >= tL && ctx.fillRect(Math.round(xOf(d.t)) - 1, Math.round(yOf(d.f)) - 1, 3, 3));
        S.marks.forEach(m => {
          if (m.t < tL) return;
          ctx.fillStyle = 'rgba(201,255,77,.85)';
          ctx.fillRect(xOf(m.t) - 1, cy0, 3, ch);
        });
        S.misses = S.misses.filter(m => now - m.at < 1.6);
        S.misses.forEach(m => {
          if (m.t < tL) return;
          ctx.fillStyle = `rgba(255,89,100,${1 - (now - m.at) / 1.6})`;
          ctx.fillRect(xOf(m.t) - 1, cy0, 3, ch);
          ctx.fillText('NOT A TRANSIT', xOf(m.t), cy0 + 8);
        });
      } else if (result) {
        // folded: every measurement placed by where it falls in the orbit, so all the transits stack into one
        const span = Math.max(sys.dur * 1.6, 0.12),
          xOf = ph => cx0 + (ph / span + 0.5) * cw,
          tc = S.marks[0].t - S.marks[0].n * result.P;
        ctx.fillText(`FOLDED ON THE ${result.P.toFixed(2)}-DAY PERIOD`, cx0, cy0 - 6);
        ctx.fillStyle = 'rgba(232,234,216,.85)';
        S.data.forEach(d => {
          const ph = ((((d.t - tc) % result.P) + result.P * 1.5) % result.P) - result.P / 2;
          if (Math.abs(ph) < span / 2) ctx.fillRect(Math.round(xOf(ph)) - 1, Math.round(yOf(d.f)) - 1, 3, 3);
        });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#7b8580';
        ctx.fillText('HOURS FROM MID-TRANSIT', cx0 + cw / 2, cy0 + ch + 6);
        for (const hr of [-2, -1, 0, 1, 2]) {
          const x = xOf(hr / 24);
          if (x > cx0 && x < cx0 + cw) ctx.fillText(String(hr), x, cy0 + ch - 18);
        }
      }
      brackets(ctx);
      if (phase === 'downlink') {
        const d = now - sentAt;
        drawDownlink(ctx, info.uni, d);
        if (d >= DOWNLINK_TIME && !reported) {
          reported = true;
          report({ type: 'science-complete', kind: 'exoplanet' });
          setPhase('done');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // when the third transit is marked
    state.current.onDone = () => {
      sentAt = performance.now() / 1000;
    };
    return () => cancelAnimationFrame(raf);
  }, [sys, info]);

  const tap = e => {
    if (phase !== 'watch') return;
    const S = state.current,
      rect = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - rect.left) / rect.width) * W,
      cx0 = 70,
      cw = W - 90,
      t = S.T - DAYS_SHOWN + ((x - cx0) / cw) * DAYS_SHOWN;
    if (x < cx0 || t > S.T) return;
    // a hit is anywhere on a dip (with a little slack), one mark per transit
    const n = epochOf(sys, t),
      mid = sys.t0 + n * sys.P;
    if (Math.abs(t - mid) < sys.dur / 2 + 0.04 && n >= 0) {
      if (S.marks.some(m => m.n === n)) return;
      S.marks.push({ t, n });
      setFound(S.marks.length);
      if (S.marks.length >= NEEDED) {
        setResult(describe(sys, S.marks, S.data));
        S.onDone();
        setPhase('downlink');
      }
    } else S.misses.push({ t, at: performance.now() / 1000 });
  };

  return (
    <>
      <div className="eyebrow">Hosted payload request</div>
      <h1>{info.title}</h1>
      <div className="signal" style={{ color: 'var(--blue)' }}>
        {info.signal}
      </div>
      <p className="instructions">{info.text}</p>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={tap}
        style={{
          width: '100%',
          maxWidth: FIT,
          display: 'block',
          imageRendering: 'pixelated',
          border: '1px solid #34403a',
          background: '#000',
          cursor: phase === 'watch' ? 'crosshair' : 'default',
          touchAction: 'none',
        }}
      />
      <div className="actions" style={{ alignItems: 'center' }}>
        <span className="eyebrow">
          {found} OF {NEEDED} TRANSITS
        </span>
        <span style={{ flex: 1 }} />
        {phase === 'done' && (
          <button className="action" onClick={() => report({ type: 'science-close' })}>
            DONE
          </button>
        )}
      </div>
      {phase === 'done' && result && (
        <div className="success">
          {info.uni.toUpperCase()} CONFIRMS {result.kind} · PERIOD {result.P.toFixed(2)} DAYS · {result.size} · ORBIT {result.a.toFixed(3)}{' '}
          AU · ABOUT {Math.round(result.teq / 10) * 10} K
        </div>
      )}
    </>
  );
}
