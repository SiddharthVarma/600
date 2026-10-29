import { useEffect, useRef, useState } from 'react';
import { DOWNLINK_TIME, SCIENCE, blit, brackets, drawDownlink, hudText, pixelFont, report } from './common.js';
import { ScienceLayout, ScienceResult } from './layout.jsx';
import { BH, BW, bay, rng } from './scenes.js';

// Galaxy classification, the way volunteers sort galaxies by eye: each one is spiral, irregular, elliptical or an
// edge-on disk. Every galaxy is generated from a real model:
// - spiral: a small yellow bulge plus a bluer exponential disc, brightened along 2–3 logarithmic-spiral arms with pink
//   star-forming knots, seen at a random tilt;
// - irregular: lumpy blue star clouds with no symmetry, like the Magellanic Clouds;
// - elliptical: a smooth oval glow following the de Vaucouleurs profile, I ∝ exp(−7.67((r/rₑ)^¼ − 1)), yellowish;
// - disk: a disc seen edge-on, exponential along it and sech² through it, usually split by a dark dust lane.
const SCALE = 4,
  COUNT = 12,
  KINDS = ['spiral', 'irregular', 'elliptical', 'disk'],
  CHOICES = [...KINDS, 'unknown'],
  LABEL = { spiral: 'SPIRAL', irregular: 'IRREGULAR', elliptical: 'ELLIPTICAL', disk: 'DISK', unknown: '???' },
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
function spiral(r, ox = 0, oy = 0, size = 1, faceOn = false) {
  const rd = (8 + r() * 4) * size, // disc scale length
    arms = r() < 0.7 ? 2 : 3,
    pitch = ((14 + r() * 14) * Math.PI) / 180,
    phase = r() * Math.PI * 2,
    incl = Math.acos((faceOn ? 0.85 : 0.45) + r() * (faceOn ? 0.15 : 0.55)), // tilt: 0 = face on
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
const paint = (kind, seed) => render(seed, MAKERS[kind]);
function render(seed, makeLight) {
  const r = rng(seed),
    light = makeLight(r),
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

// The thing that isn't a galaxy, or not only one. A galaxy, and wrapped through it something large, slowly writhing: a
// deep purple silhouette with a dim purple rim. Its body sits in front of the galaxy's bright core, a dark heart, with
// six tentacles reaching up over the galaxy and four hanging down below it. The tentacles weave through the galaxy:
// each starts behind it and passes in front, then behind, then in front again along its length. In front, it blocks
// the galaxy's light; behind, it shows through the bright parts only faintly (in the dark ones it's plain either way).
// It hides in one of two: an edge-on disc with a dark dust lane, or a big spiral, nearly face on.
const THING_FILL = [28, 10, 42],
  THING_RIM = [132, 80, 170];
// a displayed colour back into light, so after tone mapping it shows as that colour
const unTone = c => c.map(v => -Math.log(1 - Math.min(0.985, v / 255)) / 2.2);
// disguise: 'disk' or 'spiral' to choose which galaxy it hides behind; left out, it's a coin flip
function makeThing(seed, disguise) {
  const r = rng(seed),
    // tentacles in a fan of `spread` radians around a direction
    fan = (n, at, spread, len, curl) =>
      Array.from({ length: n }, (_, k) => ({
        a: at - spread / 2 + (k / (n - 1)) * spread + (r() - 0.5) * 0.5,
        len: len + r() * 20,
        curl: curl + (r() - 0.5) * 0.08,
        ph: r() * 9,
        wig: 0.9 + r() * 0.7,
      }));
  let light, body, arms, thick, plain;
  if (disguise ? disguise === 'disk' : r() < 0.5) {
    // the edge-on disc (exponential along it, sech² through it, a bulge, and a dust lane along the midplane), tilted a
    // little
    const pa = (r() - 0.5) * 0.4,
      ca = Math.cos(pa),
      sa = Math.sin(pa);
    light = (x, y) => {
      const u = x * ca + y * sa,
        v = -x * sa + y * ca,
        sech = 1 / Math.cosh(v / 1.4),
        along = 1.3 * Math.exp(-Math.abs(u) / 15) * sech * sech,
        bulge = 1.4 * Math.exp(-Math.hypot(u, v * 1.4) / 3.6),
        lane = Math.abs(u) < 36 ? 1 - 0.8 * Math.exp(-((v / 0.6) ** 2)) : 1;
      return [(bulge * 1.05 + along * 0.75) * lane, (bulge * 0.92 + along * 0.85) * lane, (bulge * 0.72 + along * 1.05) * lane];
    };
    body = { x: BW / 2, y: BH / 2, rad: 8 };
    arms = [...fan(6, -Math.PI / 2 + pa, 2.2, 62, 0.04), ...fan(4, Math.PI / 2 + pa, 2.0, 52, 0.04)];
    thick = 3;
    plain = glow => glow < 0.3; // shows plainly wherever the disc is dim: above and below it, and in the dust lane
  } else {
    // the spiral: the same arrangement, a little larger to match the bigger galaxy, tilted a little either way
    const tilt = (r() - 0.5) * 0.4;
    light = spiral(rng(seed + 1), 0, 0, 1.8, true);
    body = { x: BW / 2, y: BH / 2, rad: 8 };
    arms = [...fan(6, -Math.PI / 2 + tilt, 2.2, 74, 0.04), ...fan(4, Math.PI / 2 + tilt, 2.0, 64, 0.04)];
    thick = 3.4;
    // plainly in the dark lanes between the spiral's arms, and anywhere out past its rim
    plain = (glow, x, y) => glow < 0.32 || Math.hypot(x - BW / 2, (y - BH / 2) * 1.35) > 46;
  }
  const gal = new Float32Array(BW * BH * 3),
    sky = new Float32Array(BW * BH * 3),
    noise = Float32Array.from({ length: BW * BH }, rng(seed + 2)),
    img = new ImageData(BW, BH),
    d = img.data,
    mask = new Uint8Array(BW * BH),
    front = new Uint8Array(BW * BH); // the parts of it in front of the galaxy
  // the light, baked once: the galaxy in front, and the deep field behind (stars, and faint galaxies much further off)
  const glow = (cx, cy, sd, b, col) => {
    for (let y = Math.max(0, Math.floor(cy - 3 * sd)); y <= Math.min(BH - 1, cy + 3 * sd); y++)
      for (let x = Math.max(0, Math.floor(cx - 3 * sd)); x <= Math.min(BW - 1, cx + 3 * sd); x++) {
        const k = b * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * sd * sd)),
          i = (y * BW + x) * 3;
        sky[i] += k * col[0];
        sky[i + 1] += k * col[1];
        sky[i + 2] += k * col[2];
      }
  };
  for (let k = 0; k < 60; k++) glow(r() * BW, r() * BH, 0.55, 0.3 + Math.pow(r(), 4) * 2.5, [1, 1, 1.05]);
  for (let k = 0; k < 25; k++) glow(r() * BW, r() * BH, 0.9 + r() * 0.8, 0.12 + r() * 0.12, r() < 0.5 ? [1, 0.85, 0.7] : [0.75, 0.85, 1.1]);
  for (let i = 0; i < BW * BH; i++) gal.set(light((i % BW) - BW / 2, ((i / BW) | 0) - BH / 2), i * 3);
  const fill = unTone(THING_FILL),
    rimLight = unTone(THING_RIM);
  const stamp = (cx, cy, rad, inFront) => {
    const R = Math.ceil(rad) + 1;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const x = Math.round(cx + dx),
          y = Math.round(cy + dy);
        if (x >= 0 && y >= 0 && x < BW && y < BH && dx * dx + dy * dy <= rad * rad + rad * 0.6) {
          mask[y * BW + x] = 1;
          front[y * BW + x] = inFront ? 1 : 0;
        }
      }
  };
  return t => {
    mask.fill(0);
    front.fill(0);
    arms.forEach((arm, k) => {
      let a = arm.a,
        x = body.x,
        y = body.y;
      for (let s = 0; s < arm.len; s++) {
        const f = s / arm.len;
        // the writhe, unhurried
        a += Math.sin(t * 0.77 + f * 6 + arm.ph) * 0.045 * arm.wig + arm.curl * f;
        x += Math.cos(a);
        y += Math.sin(a);
        // the weave: behind the galaxy for its first stretch, then in front, behind, in front, staggered arm to arm
        stamp(x, y, 0.6 + thick * Math.pow(1 - f, 1.15), Math.floor((s + k * 3) / 14) % 2 === 1);
      }
    });
    // the body last, in front of everything
    stamp(body.x, body.y, body.rad, true);
    stamp(body.x + 3, body.y - 3, body.rad * 0.75, true);
    stamp(body.x - 3, body.y + 3, body.rad * 0.8, true);
    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
      const x = i % BW,
        y = (i / BW) | 0,
        on = mask[i],
        rim = !on && ((x > 0 && mask[i - 1]) || (x < BW - 1 && mask[i + 1]) || (y > 0 && mask[i - BW]) || (y < BH - 1 && mask[i + BW])),
        inFront =
          front[i] || (x > 0 && front[i - 1]) || (x < BW - 1 && front[i + 1]) || (y > 0 && front[i - BW]) || (y < BH - 1 && front[i + BW]),
        // behind the galaxy, under its bright light it shows through faintly: a dithered 30% of its pixels
        faint = !inFront && !plain(gal[i * 3] + gal[i * 3 + 1] + gal[i * 3 + 2], x, y) && bay(x, y) > 0.3,
        n = (noise[i] - 0.5) * 0.04,
        dith = (bay(x, y) - 0.5) / 10;
      // the light that reaches us: its rim; its body, with the galaxy's light over it where it's behind and none where it's
      // in front; or the deep field and galaxy where it isn't. Tone mapped and dithered like every other galaxy.
      for (let k = 0; k < 3; k++) {
        const g = gal[i * 3 + k],
          lin = rim && !faint ? rimLight[k] + g * 0.5 : on && !faint ? fill[k] + (front[i] ? 0 : g) : sky[i * 3 + k] + g,
          v = 1 - Math.exp(-(lin + n + 0.02) * 2.2);
        d[p + k] = Math.round(Math.max(0, Math.min(1, Math.round(v * 10 + dith * 10) / 10)) * 255);
      }
      d[p + 3] = 255;
    }
    return img;
  };
}

export function Galaxies() {
  const info = SCIENCE.galaxies;
  const [coords] = useState(info.coords); // a fresh patch of sky each time
  const canvasRef = useRef(null);
  // the set to sort: a shuffled mix, three of each kind. In about two runs in five, one of them isn't a galaxy.
  const [deck] = useState(() => {
    const r = rng(Math.floor(Math.random() * 1e9)),
      kinds = Array.from({ length: COUNT }, (_, i) => KINDS[i % KINDS.length]).sort(() => r() - 0.5),
      deck = kinds.map(kind => ({ kind, img: paint(kind, Math.floor(r() * 1e9)) }));
    // for testing: ?thing=spiral or ?thing=disk puts it first in the deck, behind that galaxy
    const test = new URLSearchParams(location.search).get('thing');
    if (test) deck[0] = { kind: 'unknown', frame: makeThing(Math.floor(r() * 1e9), test) };
    else if (r() < 0.4) deck[4 + Math.floor(r() * 7)] = { kind: 'unknown', frame: makeThing(Math.floor(r() * 1e9)) };
    return deck;
  });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [flash, setFlash] = useState(null); // the last answer, shown briefly: { ok, kind }
  const [phase, setPhase] = useState('sort'); // sort → downlink → done
  const live = useRef({});
  live.current = { index, flash, phase, answers };
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
      const item = deck[Math.min(index, COUNT - 1)],
        thing = item.kind === 'unknown' && phase === 'sort';
      blit(ctx, buf, item.frame ? item.frame(now) : item.img);
      brackets(ctx);
      // on the thing, the readout glitches
      hudText(ctx, thing ? `GALAXY ?? OF ${COUNT}` : `GALAXY ${Math.min(index + 1, COUNT)} OF ${COUNT}`, 'left', 'top');
      hudText(ctx, thing ? 'RA ??h ??m · DEC ??°' : coords, 'right', 'top');
      if (flash) {
        ctx.font = pixelFont(22);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const msg =
            flash.kind === 'unknown'
              ? flash.ok
                ? 'IT SAW YOU.'
                : 'THAT WAS NOT A GALAXY.'
              : flash.chose === 'unknown'
                ? 'NOTHING THERE. YET.'
                : flash.ok
                  ? `CORRECT · ${LABEL[flash.kind]}`
                  : `IT WAS ${ARTICLE[flash.kind]}`,
          w = ctx.measureText(msg).width;
        ctx.fillStyle = 'rgba(2,4,6,.8)';
        ctx.fillRect(W / 2 - w / 2 - 14, H - 64, w + 28, 40);
        ctx.fillStyle = flash.kind === 'unknown' && flash.ok ? '#b06ce0' : flash.ok ? '#c9ff4d' : '#ff5964';
        ctx.fillText(msg, W / 2, H - 32);
      }
      if (phase === 'downlink') {
        const d = now - sentAt.current;
        drawDownlink(ctx, d);
        if (d >= DOWNLINK_TIME && !reported) {
          reported = true;
          const { answers } = live.current;
          report({ type: 'science-complete', kind: 'galaxies', found: answers.filter(Boolean).length, total: answers.length });
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
    setFlash({ ok, kind: truth, chose: kind });
    // a moment to see whether you were right, then the next galaxy. The thing behind the galaxy lingers, still writhing,
    // so there's time to see what was there.
    setTimeout(
      () => {
        setFlash(null);
        if (index + 1 >= COUNT) {
          sentAt.current = performance.now() / 1000;
          setPhase('downlink');
        } else setIndex(index + 1);
      },
      truth === 'unknown' ? 3500 : ok ? 1500 : 2000,
    );
  };
  // keys 1–5
  useEffect(() => {
    const onKey = e => {
      const k = CHOICES[Number(e.key) - 1];
      if (k) classify(k);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  const correct = answers.filter(Boolean).length;

  return (
    <ScienceLayout
      info={info}
      view={<canvas ref={canvasRef} width={BW * SCALE} height={BH * SCALE} />}
      live={[
        ['Right', correct],
      ]}
      left={
        phase !== 'done' && (
          <div className="lab-choices">
            {CHOICES.map((k, i) => (
              <button
                key={k}
                className="action"
                onClick={() => classify(k)}
                disabled={!!flash || phase !== 'sort'}
                // ??? sits there quietly, in grey, whether or not anything comes
                style={{ ...(k === 'unknown' ? { color: '#6b7470', borderColor: '#39403c' } : {}), ...(flash || phase !== 'sort' ? { opacity: 0.5 } : {}) }}
              >
                {i + 1} · {LABEL[k]}
              </button>
            ))}
          </div>
        )
      }
      right={
        phase === 'done' && (
          <button className="action" onClick={() => report({ type: 'science-close' })}>
            DONE
          </button>
        )
      }
      result={
        phase === 'done' && (
          // green only for a perfect run, the one that pays in full; anything less is amber, like a partial survey
          <ScienceResult ok={correct === COUNT}>
            {info.uni} received your classifications · {correct} of {COUNT} correct
            {deck.some(g => g.kind === 'unknown') && ' · 1 image withheld from the archive'}
          </ScienceResult>
        )
      }
    />
  );
}
