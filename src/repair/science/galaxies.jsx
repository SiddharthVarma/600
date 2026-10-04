import { useEffect, useRef, useState } from 'react';
import { DOWNLINK_TIME, SCIENCE, blit, brackets, drawDownlink, hudText, report } from './common.js';
import { BH, BW, bay, rng } from './scenes.js';

// Galaxy classification, the way volunteers sort galaxies by eye: each one is spiral, irregular, elliptical or an
// edge-on disk. Every galaxy is generated from a real model:
// - spiral: a small yellow bulge plus a bluer exponential disc, brightened along 2–3 logarithmic-spiral arms with pink
//   star-forming knots, seen at a random tilt;
// - irregular: lumpy blue star clouds with no symmetry, like the Magellanic Clouds;
// - elliptical: a smooth oval glow following the de Vaucouleurs profile, I ∝ exp(−7.67((r/rₑ)^¼ − 1)), yellowish;
// - disk: a disc seen edge-on, exponential along it and sech² through it, usually split by a dark dust lane.
const FIT = `min(${BW * 4}px, calc((100vh - 340px) * ${BW / BH}))`;
const SCALE = 4,
  COUNT = 12,
  KINDS = ['spiral', 'irregular', 'elliptical', 'disk'],
  LABEL = { spiral: 'SPIRAL', irregular: 'IRREGULAR', elliptical: 'ELLIPTICAL', disk: 'DISK' },
  ARTICLE = { spiral: 'A SPIRAL', irregular: 'AN IRREGULAR', elliptical: 'AN ELLIPTICAL', disk: 'AN EDGE-ON DISK' };

// Each galaxy is a light function f(x, y) → [r, g, b] in its own frame, centred on the origin, sized in scene pixels.
function elliptical(r, ox = 0, oy = 0, size = 1) {
  const re = (9 + r() * 6) * size,
    q = 0.55 + r() * 0.45,
    pa = r() * Math.PI,
    lum = 1.6 + r() * 0.6,
    ca = Math.cos(pa),
    sa = Math.sin(pa);
  return (x, y) => {
    const u = (x - ox) * ca + (y - oy) * sa,
      v = (-(x - ox) * sa + (y - oy) * ca) / q,
      rr = Math.max(0.3, Math.hypot(u, v)) / re,
      I = lum * Math.exp(-7.67 * (Math.pow(rr, 0.25) - 1)) * 0.012;
    return [I * 1.05, I * 0.9, I * 0.7];
  };
}
function spiral(r, ox = 0, oy = 0, size = 1) {
  const rd = (8 + r() * 4) * size, // disc scale length
    arms = r() < 0.7 ? 2 : 3,
    pitch = ((14 + r() * 14) * Math.PI) / 180,
    phase = r() * Math.PI * 2,
    incl = Math.acos(0.45 + r() * 0.55), // tilt: 0 = face on
    pa = r() * Math.PI,
    ca = Math.cos(pa),
    sa = Math.sin(pa),
    ci = Math.cos(incl),
    knots = [];
  // star-forming knots, scattered along the arms
  for (let k = 0; k < 22; k++) {
    const rad = rd * (0.6 + r() * 2.2),
      arm = Math.floor(r() * arms),
      th = Math.log(rad / rd) / Math.tan(pitch) + phase + (arm * 2 * Math.PI) / arms + (r() - 0.5) * 0.25;
    knots.push([rad * Math.cos(th), rad * Math.sin(th)]);
  }
  return (x, y) => {
    // undo the tilt and rotation to get the point in the galaxy's own plane
    const u = (x - ox) * ca + (y - oy) * sa,
      v = (-(x - ox) * sa + (y - oy) * ca) / ci,
      rad = Math.max(0.3, Math.hypot(u, v)),
      th = Math.atan2(v, u);
    // a logarithmic spiral: θ = ln(r / r_d) / tan(pitch) + phase, repeated for each arm
    const wave = Math.cos(arms * (th - Math.log(rad / rd) / Math.tan(pitch) - phase)),
      armLight = Math.pow(Math.max(0, wave), 3),
      disc = Math.exp(-rad / rd) * (0.25 + 1.6 * armLight * Math.min(1, rad / (rd * 0.6))),
      bulge = 1.4 * Math.exp(-Math.pow(rad / (rd * 0.28), 1.2));
    let R = bulge * 1.05 + disc * 0.7,
      G = bulge * 0.92 + disc * 0.82,
      B = bulge * 0.7 + disc * 1.1;
    for (const [kx, ky] of knots) {
      const d2 = (u - kx) ** 2 + (v - ky) ** 2;
      if (d2 < 4) {
        const k = Math.exp(-d2 * 1.4) * 0.5 * Math.exp(-rad / (rd * 3));
        R += k * 1.1;
        G += k * 0.55;
        B += k * 0.85;
      }
    }
    return [R, G, B];
  };
}
function irregular(r) {
  // no symmetry: a few lumpy blue star clouds of different sizes, with pink star-forming knots scattered through them
  const clumps = Array.from({ length: 4 + Math.floor(r() * 4) }, () => [
      (r() - 0.5) * 26,
      (r() - 0.5) * 20,
      2.5 + r() * 5,
      0.4 + r() * 0.8,
    ]),
    knots = Array.from({ length: 12 }, () => {
      const c = clumps[Math.floor(r() * clumps.length)];
      return [c[0] + (r() - 0.5) * c[2] * 2, c[1] + (r() - 0.5) * c[2] * 2];
    });
  return (x, y) => {
    let R = 0,
      G = 0,
      B = 0;
    for (const [cx, cy, s, a] of clumps) {
      const k = a * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s));
      R += k * 0.7;
      G += k * 0.82;
      B += k * 1.1;
    }
    for (const [kx, ky] of knots) {
      const k = Math.exp(-((x - kx) ** 2 + (y - ky) ** 2) * 1.2) * 0.45;
      R += k * 1.1;
      G += k * 0.55;
      B += k * 0.85;
    }
    return [R, G, B];
  };
}
function disk(r) {
  // a disc galaxy seen edge-on: light falls off exponentially along the disc and as sech² through its thickness, with
  // a small bulge, and a dark dust lane along the midplane
  const rd = 11 + r() * 5,
    hz = 1 + r() * 0.8,
    pa = r() * Math.PI,
    ca = Math.cos(pa),
    sa = Math.sin(pa),
    dust = r() < 0.75;
  return (x, y) => {
    const u = x * ca + y * sa,
      v = -x * sa + y * ca,
      sech = 1 / Math.cosh(v / hz),
      disc = 1.3 * Math.exp(-Math.abs(u) / rd) * sech * sech,
      bulge = 1.1 * Math.exp(-Math.hypot(u, v * 1.4) / 2.6),
      lane = dust && Math.abs(u) < rd * 2.4 ? 1 - 0.75 * Math.exp(-((v / 0.55) ** 2)) : 1;
    return [(bulge * 1.05 + disc * 0.75) * lane, (bulge * 0.92 + disc * 0.85) * lane, (bulge * 0.72 + disc * 1.05) * lane];
  };
}
const MAKERS = { spiral, elliptical, irregular, disk };

// one galaxy, centred in the frame, with a few foreground stars and faint noise, tone-mapped and dithered to pixel art
function paint(kind, seed) {
  const r = rng(seed),
    light = MAKERS[kind](r),
    stars = Array.from({ length: 26 }, () => [r() * BW, r() * BH, 0.4 + Math.pow(r(), 4) * 3]),
    img = new ImageData(BW, BH),
    d = img.data,
    noise = rng(seed + 1);
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const c = light(x - BW / 2, y - BH / 2);
      stars.forEach(([sx, sy, b]) => {
        const d2 = (x - sx) ** 2 + (y - sy) ** 2;
        if (d2 < 6) {
          const k = b * Math.exp(-d2 / 1.2);
          c[0] += k;
          c[1] += k;
          c[2] += k * 1.05;
        }
      });
      const i = (y * BW + x) * 4,
        n = (noise() - 0.5) * 0.04,
        dith = (bay(x, y) - 0.5) / 10;
      for (let k = 0; k < 3; k++) {
        // brightness tone-mapped (1 − e^−kI), then snapped to 10 levels with a dithered threshold
        const v = 1 - Math.exp(-(c[k] + n + 0.02) * 2.2);
        d[i + k] = Math.round(Math.max(0, Math.min(1, Math.round(v * 10 + dith * 10) / 10)) * 255);
      }
      d[i + 3] = 255;
    }
  return img;
}

export function Galaxies() {
  const info = SCIENCE.galaxies;
  const canvasRef = useRef(null);
  // the set to sort: a shuffled mix, three of each kind
  const [deck] = useState(() => {
    const r = rng(Math.floor(Math.random() * 1e9)),
      kinds = Array.from({ length: COUNT }, (_, i) => KINDS[i % KINDS.length]).sort(() => r() - 0.5);
    return kinds.map(kind => ({ kind, img: paint(kind, Math.floor(r() * 1e9)) }));
  });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState(null); // the last answer, shown briefly: { ok, kind }
  const [phase, setPhase] = useState('sort'); // sort → downlink → done
  const live = useRef({});
  live.current = { index, flash, phase };
  const sentAt = useRef(0);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d'),
      buf = document.createElement('canvas');
    buf.width = BW;
    buf.height = BH;
    let raf,
      reported = false;
    const loop = () => {
      const now = performance.now() / 1000,
        { index, flash, phase } = live.current,
        W = ctx.canvas.width,
        H = ctx.canvas.height;
      blit(ctx, buf, deck[Math.min(index, COUNT - 1)].img);
      brackets(ctx);
      hudText(ctx, `GALAXY ${Math.min(index + 1, COUNT)} OF ${COUNT}`, 'left', 'top');
      hudText(ctx, info.coords, 'right', 'top');
      if (flash) {
        ctx.font = '22px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const msg = flash.ok ? `CORRECT · ${LABEL[flash.kind]}` : `IT WAS ${ARTICLE[flash.kind]}`,
          w = ctx.measureText(msg).width;
        ctx.fillStyle = 'rgba(2,4,6,.8)';
        ctx.fillRect(W / 2 - w / 2 - 14, H - 64, w + 28, 40);
        ctx.fillStyle = flash.ok ? '#c9ff4d' : '#ff5964';
        ctx.fillText(msg, W / 2, H - 32);
      }
      if (phase === 'downlink') {
        const d = now - sentAt.current;
        drawDownlink(ctx, d);
        if (d >= DOWNLINK_TIME && !reported) {
          reported = true;
          report({ type: 'science-complete', kind: 'galaxies' });
          setPhase('done');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [deck, info]);

  const classify = kind => {
    if (phase !== 'sort' || flash) return;
    const truth = deck[index].kind,
      ok = kind === truth;
    setAnswers([...answers, ok]);
    setStreak(ok ? streak + 1 : 0);
    setFlash({ ok, kind: truth });
    // a moment to see whether you were right, then the next galaxy
    setTimeout(
      () => {
        setFlash(null);
        if (index + 1 >= COUNT) {
          sentAt.current = performance.now() / 1000;
          setPhase('downlink');
        } else setIndex(index + 1);
      },
      ok ? 650 : 1300,
    );
  };
  // keys 1, 2, 3
  useEffect(() => {
    const onKey = e => {
      const k = KINDS[Number(e.key) - 1];
      if (k) classify(k);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  const correct = answers.filter(Boolean).length;

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
        style={{
          width: '100%',
          maxWidth: FIT,
          display: 'block',
          imageRendering: 'pixelated',
          border: '1px solid #34403a',
          background: '#000',
        }}
      />
      <div className="actions" style={{ alignItems: 'center' }}>
        {phase === 'sort' &&
          KINDS.map((k, i) => (
            <button key={k} className="action" onClick={() => classify(k)} disabled={!!flash} style={flash ? { opacity: 0.5 } : {}}>
              {i + 1} · {LABEL[k]}
            </button>
          ))}
        <span className="eyebrow">{answers.length ? `${correct} OF ${answers.length} RIGHT · STREAK ${streak}` : 'PRESS 1–4'}</span>
        <span style={{ flex: 1 }} />
        {phase === 'done' && (
          <button className="action" onClick={() => report({ type: 'science-close' })}>
            DONE
          </button>
        )}
      </div>
      {phase === 'done' && (
        <div
          className={correct >= COUNT - 2 ? 'success' : 'failure'}
          style={correct >= COUNT - 2 ? {} : { color: 'var(--yellow)', borderColor: 'var(--yellow)' }}
        >
          {info.uni.toUpperCase()} RECEIVED YOUR CLASSIFICATIONS · {correct} OF {COUNT} CORRECT
        </div>
      )}
    </>
  );
}
