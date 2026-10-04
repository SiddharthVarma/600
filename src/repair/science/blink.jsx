import { useEffect, useRef, useState } from 'react';
import { DOWNLINK_TIME, SCIENCE, blit, brackets, drawDownlink, hudText, report } from './common.js';
import { BH, BW, rng } from './scenes.js';

// Supernova search, the way transients are found: tonight's image of a patch of sky is blinked against an archive
// image of the same patch, and you look for the point of light that wasn't there before. The real one sits in a
// galaxy, off its core, and has the same blurred shape as every star (the telescope's point-spread function). The
// decoys are the classic false positives: an asteroid that moved between the frames, cosmic-ray hits (sharp specks in
// one frame only, no blur), and a variable star that was there all along and just brightened.
const FIT = `min(${BW * 4}px, calc((100vh - 340px) * ${BW / BH}))`;
const SCALE = 4,
  BLINK = 0.6, // seconds per frame while blinking
  NEAR = 6, // how close (scene pixels) a mark must be to count as that thing
  H0 = 70, // Hubble constant, km/s/Mpc
  C = 299792; // km/s

// Render a field into a float image (r, g, b) from point sources and galaxies, then add noise and tone-map it.
function render(seed, sources, galaxies, specks) {
  const r = rng(seed),
    f = new Float32Array(BW * BH * 3);
  const add = (x, y, v, c) => {
    if (x < 0 || y < 0 || x >= BW || y >= BH) return;
    const i = (y * BW + x) * 3;
    f[i] += v * c[0];
    f[i + 1] += v * c[1];
    f[i + 2] += v * c[2];
  };
  // a point source through the telescope: a Gaussian blur of the same width for every star
  const SIG = 0.85;
  sources.forEach(s => {
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const x = Math.round(s.x) + dx,
          y = Math.round(s.y) + dy,
          d2 = (x - s.x) ** 2 + (y - s.y) ** 2;
        add(x, y, s.flux * Math.exp(-d2 / (2 * SIG * SIG)), s.c);
      }
  });
  // galaxies: a bright bulge that falls off steeply plus a fainter, flattened disc
  galaxies.forEach(g => {
    const ca = Math.cos(g.pa),
      sa = Math.sin(g.pa),
      R = Math.ceil(g.re * 5);
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const u = dx * ca + dy * sa,
          v = (-dx * sa + dy * ca) / g.q,
          rr = Math.hypot(u, v);
        add(
          Math.round(g.x) + dx,
          Math.round(g.y) + dy,
          g.lum * (Math.exp(-Math.pow(rr / (g.re * 0.35), 0.5) * 3) + 0.25 * Math.exp(-rr / g.re)),
          [1, 0.9, 0.78],
        );
      }
  });
  // cosmic rays: a single sharp pixel or a short streak, no blur at all
  specks.forEach(s => {
    for (let k = 0; k < s.len; k++) add(Math.round(s.x + Math.cos(s.a) * k), Math.round(s.y + Math.sin(s.a) * k), 3, [1, 1, 1]);
  });
  const img = new ImageData(BW, BH);
  for (let i = 0, j = 0; i < f.length; i += 3, j += 4) {
    const noise = (r() - 0.5) * 0.05;
    for (let c = 0; c < 3; c++)
      img.data[j + c] = Math.round(255 * Math.min(1, 1 - Math.exp(-(f[i + c] + noise + 0.03) * 1.6)) * [0.9, 0.95, 1.05][c]);
    img.data[j + 3] = 255;
  }
  return img;
}

function makeField(seed) {
  const r = rng(seed),
    stars = Array.from({ length: 110 }, () => {
      const t = r();
      return {
        x: 4 + r() * (BW - 8),
        y: 4 + r() * (BH - 8),
        flux: 0.25 + Math.pow(r(), 6) * 6,
        c: t < 0.2 ? [0.8, 0.9, 1.2] : t < 0.45 ? [1.15, 0.95, 0.75] : [1, 1, 1],
      };
    });
  const galaxies = Array.from({ length: 6 }, () => ({
    x: 20 + r() * (BW - 40),
    y: 16 + r() * (BH - 32),
    re: 2.5 + r() * 4,
    q: 0.35 + r() * 0.6,
    pa: r() * Math.PI,
    lum: 0.5 + r() * 0.6,
  }));
  // the supernova: in a galaxy, off its core along the disc, about as bright as a middling star
  const host = galaxies[Math.floor(r() * galaxies.length)],
    off = (0.6 + r() * 0.9) * host.re * (r() < 0.5 ? -1 : 1);
  const sn = { x: host.x + Math.cos(host.pa) * off, y: host.y + Math.sin(host.pa) * off, flux: 1.4 + r() * 0.8, c: [1, 0.96, 0.9] };
  // decoys
  const variable = stars.find(s => s.flux > 0.6 && s.flux < 2 && Math.hypot(s.x - sn.x, s.y - sn.y) > 25) || stars[0];
  const ast = { x: 20 + r() * (BW - 40), y: 20 + r() * (BH - 40), a: r() * Math.PI * 2, step: 7 + r() * 4 };
  const astThen = { x: ast.x, y: ast.y, flux: 0.9, c: [1, 1, 1] },
    astNow = { x: ast.x + Math.cos(ast.a) * ast.step, y: ast.y + Math.sin(ast.a) * ast.step, flux: 0.9, c: [1, 1, 1] };
  const crNow = Array.from({ length: 2 }, () => ({
      x: 10 + r() * (BW - 20),
      y: 10 + r() * (BH - 20),
      len: 1 + Math.floor(r() * 3),
      a: r() * Math.PI,
    })),
    crThen = [{ x: 10 + r() * (BW - 20), y: 10 + r() * (BH - 20), len: 1, a: 0 }];
  const brighter = { ...variable, flux: variable.flux * 2.3 };
  const reference = render(seed + 1, [...stars, astThen], galaxies, crThen),
    tonight = render(seed + 2, [...stars.filter(s => s !== variable), brighter, astNow, sn], galaxies, crNow);
  const z = 0.012 + r() * 0.05;
  return {
    reference,
    tonight,
    sn,
    z,
    things: [
      { kind: 'sn', x: sn.x, y: sn.y },
      { kind: 'asteroid', x: astThen.x, y: astThen.y },
      { kind: 'asteroid', x: astNow.x, y: astNow.y },
      { kind: 'variable', x: variable.x, y: variable.y },
      ...crNow.map(c => ({ kind: 'cosmic', x: c.x, y: c.y })),
      ...crThen.map(c => ({ kind: 'cosmic', x: c.x, y: c.y })),
    ],
  };
}
const VERDICT = {
  asteroid: 'THAT WAS AN ASTEROID · IT MOVED BETWEEN THE TWO IMAGES',
  cosmic: 'THAT WAS A COSMIC RAY HIT · A SHARP SPECK IN ONE IMAGE ONLY, NOT STAR-SHAPED',
  variable: 'THAT STAR WAS ALREADY THERE · IT JUST BRIGHTENED (A VARIABLE STAR)',
  none: 'NOTHING NEW THERE',
};
const LABEL = { sn: 'SUPERNOVA', asteroid: 'ASTEROID', cosmic: 'COSMIC RAY', variable: 'VARIABLE STAR' };

export function Blink() {
  const info = SCIENCE.supernova;
  const canvasRef = useRef(null);
  const [field] = useState(() => makeField(Math.floor(Math.random() * 1e9)));
  const [phase, setPhase] = useState('look'); // look → downlink → done
  const [view, setView] = useState('blink'); // blink | tonight | reference
  const [mark, setMark] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const live = useRef({});
  live.current = { phase, view, mark, verdict };
  const sentAt = useRef(0);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d'),
      buf = document.createElement('canvas');
    buf.width = BW;
    buf.height = BH;
    const t0 = performance.now() / 1000;
    let raf,
      reported = false;
    const loop = () => {
      const now = performance.now() / 1000,
        t = now - t0,
        { phase, view, mark, verdict } = live.current,
        showTonight = view === 'tonight' || (view === 'blink' && Math.floor(t / BLINK) % 2 === 1);
      blit(ctx, buf, showTonight ? field.tonight : field.reference);
      if (mark && phase !== 'done') {
        ctx.strokeStyle = 'rgba(85,182,255,.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mark.x * SCALE, mark.y * SCALE, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (phase === 'done') {
        // show what everything was
        ctx.font = '14px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        field.things.forEach(th => {
          const x = th.x * SCALE,
            y = th.y * SCALE,
            s = th.kind === 'sn' ? 30 : 22;
          ctx.strokeStyle = th.kind === 'sn' ? '#c9ff4d' : 'rgba(255,209,102,.8)';
          ctx.lineWidth = th.kind === 'sn' ? 3 : 2;
          ctx.strokeRect(x - s / 2, y - s / 2, s, s);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fillText(LABEL[th.kind], x, y + s / 2 + 3);
        });
        if (mark && verdict !== 'sn') {
          ctx.strokeStyle = '#ff5964';
          ctx.lineWidth = 3;
          const x = mark.x * SCALE,
            y = mark.y * SCALE;
          ctx.beginPath();
          ctx.moveTo(x - 9, y - 9);
          ctx.lineTo(x + 9, y + 9);
          ctx.moveTo(x + 9, y - 9);
          ctx.lineTo(x - 9, y + 9);
          ctx.stroke();
        }
      }
      brackets(ctx);
      hudText(
        ctx,
        showTonight ? 'TONIGHT' : 'ARCHIVE · 2 YEARS AGO',
        'left',
        'top',
        showTonight ? 'rgba(201,255,77,.9)' : 'rgba(255,209,102,.9)',
      );
      hudText(ctx, info.coords, 'right', 'top');
      if (phase === 'downlink') {
        const d = now - sentAt.current;
        drawDownlink(ctx, d);
        if (d >= DOWNLINK_TIME && !reported) {
          reported = true;
          report({ type: 'science-complete', kind: 'supernova', found: verdict === 'sn' ? 1 : 0, total: 1 });
          setPhase('done');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [field, info]);

  const tap = e => {
    if (phase !== 'look') return;
    const r = e.currentTarget.getBoundingClientRect();
    setMark({ x: ((e.clientX - r.left) / r.width) * BW, y: ((e.clientY - r.top) / r.height) * BH });
  };
  const downlink = () => {
    // what did they mark? the nearest known thing within reach, or nothing
    let best = { kind: 'none', d: NEAR };
    field.things.forEach(th => {
      const d = Math.hypot(th.x - mark.x, th.y - mark.y);
      if (d < best.d) best = { kind: th.kind, d };
    });
    setVerdict(best.kind);
    sentAt.current = performance.now() / 1000;
    setPhase('downlink');
  };
  const views = { blink: 'BLINKING', tonight: 'TONIGHT ONLY', reference: 'ARCHIVE ONLY' },
    next = { blink: 'tonight', tonight: 'reference', reference: 'blink' },
    mpc = (C * field.z) / H0,
    mly = Math.round((mpc * 3.2616) / 10) * 10;

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
        width={BW * SCALE}
        height={BH * SCALE}
        onPointerDown={tap}
        style={{
          width: '100%',
          maxWidth: FIT,
          display: 'block',
          imageRendering: 'pixelated',
          border: '1px solid #34403a',
          background: '#000',
          cursor: phase === 'look' ? 'crosshair' : 'default',
          touchAction: 'none',
        }}
      />
      <div className="actions" style={{ alignItems: 'center' }}>
        <button className="action" onClick={() => setView(next[view])}>
          VIEW: {views[view]}
        </button>
        <span className="eyebrow">{mark ? 'CANDIDATE MARKED' : 'TAP THE NEW STAR'}</span>
        <span style={{ flex: 1 }} />
        {phase === 'done' ? (
          <button className="action" onClick={() => report({ type: 'science-close' })}>
            DONE
          </button>
        ) : (
          <button
            className="action"
            disabled={phase !== 'look' || !mark}
            style={phase !== 'look' || !mark ? { opacity: 0.4 } : {}}
            onClick={downlink}
          >
            DOWNLINK
          </button>
        )}
      </div>
      {phase === 'done' &&
        (verdict === 'sn' ? (
          <div className="success">
            {info.uni.toUpperCase()} CONFIRMS A SUPERNOVA · HOST GALAXY AT REDSHIFT z ≈ {field.z.toFixed(3)}, ABOUT{' '}
            {mly.toLocaleString('en-GB')} MILLION LIGHT-YEARS AWAY
          </div>
        ) : (
          <div className="failure" style={{ color: 'var(--yellow)', borderColor: 'var(--yellow)' }}>
            {info.uni.toUpperCase()} RECEIVED YOUR CANDIDATE · {VERDICT[verdict]}
          </div>
        ))}
    </>
  );
}
