import { useEffect, useRef, useState } from 'react';
import { DOWNLINK_TIME, SCIENCE, blit, brackets, drawDownlink, hudText, report } from './common.js';
import { BH, BW, bay, makeBuffer, rng } from './scenes.js';

// Interstellar object: keep a tumbling object from another star inside the reticle (which sits right on the pointer)
// until all its data is recorded. It streaks across the field along one gentle curve; if it gets away before you're
// done, the next sweep picks it up crossing back the other way, with the data so far kept. No timer, no fail.
// the view never grows taller than the window leaves room for: header and instructions above, buttons and result below
const FIT = `min(${BW * 4}px, calc((100vh - 340px) * ${BW / BH}))`;
const SCALE = 4,
  PASS = 18, // seconds for one streak across the field
  RECORD = 7, // % of the data recorded per second while locked
  LOCK = 8; // how close (scene pixels) the reticle must be
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

function makeSky(seed) {
  const r = rng(seed);
  return {
    stars: Array.from({ length: 340 }, () => ({
      x: r() * BW,
      y: r() * BH,
      b: Math.pow(r(), 3),
      c: r() < 0.12 ? [255, 210, 170] : r() < 0.2 ? [180, 210, 255] : [235, 238, 245],
      tw: r() * 10,
    })),
    gal: { x: 40 + r() * 160, y: 30 + r() * 90, a: r() * Math.PI },
    r,
  };
}
// one streak edge to edge, bowed into a single curve
function makePass(r, fromLeft) {
  const y0 = 20 + r() * (BH - 40),
    y1 = 20 + r() * (BH - 40),
    [x0, x1] = fromLeft ? [-10, BW + 10] : [BW + 10, -10];
  return { x0, y0, x1, y1, cx: BW / 2, cy: (y0 + y1) / 2 + (r() - 0.5) * 100 };
}
function objectAt(p, s) {
  const u = 1 - s;
  return { x: u * u * p.x0 + 2 * u * s * p.cx + s * s * p.x1, y: u * u * p.y0 + 2 * u * s * p.cy + s * s * p.y1 };
}
function drawSky(B, sky, t) {
  const { fb, put } = B;
  for (let i = 0; i < fb.length; i += 4) {
    fb[i] = 2;
    fb[i + 1] = 3;
    fb[i + 2] = 8;
    fb[i + 3] = 255;
  }
  // a faint galaxy smudge, dithered
  const g = sky.gal,
    ca = Math.cos(g.a),
    sa = Math.sin(g.a);
  for (let y = -10; y <= 10; y++)
    for (let x = -18; x <= 18; x++) {
      const d = Math.hypot((x * ca - y * sa) / 18, ((x * sa + y * ca) * 2.6) / 10);
      if (d < 1 && bay(Math.round(g.x + x), Math.round(g.y + y)) < (1 - d) * 0.8) put(g.x + x, g.y + y, [70, 66, 96], 0.6 * (1 - d));
    }
  sky.stars.forEach(s => {
    const b = s.b * (0.85 + 0.15 * Math.sin(t * 2 + s.tw));
    put(s.x, s.y, s.c, Math.min(1, 0.25 + b));
    if (s.b > 0.6)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        put(s.x + dx, s.y + dy, s.c, 0.35 * b);
  });
}
function drawObject(B, o, t) {
  // a reddish, elongated body; its brightness swings as it tumbles (dim end-on, bright broadside)
  const spin = t * 2.3,
    ca = Math.cos(spin),
    sa = Math.sin(spin),
    bright = 0.3 + 0.7 * Math.abs(sa);
  for (let s = -2.5; s <= 2.5; s += 0.5) {
    const k = 1 - Math.abs(s) / 3;
    B.put(
      o.x + ca * s,
      o.y + sa * s * 0.6,
      mix([110, 70, 50], [236, 180, 130], k * bright),
      Math.min(1, (0.5 + k * 0.5) * (0.5 + bright * 0.5)),
    );
  }
  if (bright > 0.9) B.put(o.x, o.y, [255, 236, 200]);
  return bright;
}

export function Tracking() {
  const info = SCIENCE.interstellar;
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('track'); // track → downlink → done
  const live = useRef({});
  live.current = { phase };
  const aim = useRef({ x: BW / 2, y: BH / 2 });

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d'),
      buf = document.createElement('canvas'),
      B = makeBuffer(),
      sky = makeSky(Math.floor(Math.random() * 1e9)),
      curve = [];
    buf.width = BW;
    buf.height = BH;
    const t0 = performance.now() / 1000;
    let raf,
      last = t0,
      pass = makePass(sky.r, sky.r() < 0.5),
      passStart = 0,
      data = 0,
      lastPoint = 0,
      sentAt = 0;
    const loop = () => {
      const now = performance.now() / 1000,
        t = now - t0,
        dt = Math.min(0.05, now - last),
        { phase } = live.current,
        W = ctx.canvas.width,
        H = ctx.canvas.height;
      last = now;
      const a = aim.current;
      // the object got away: the next sweep picks it up crossing back the other way
      if ((t - passStart) / PASS >= 1 && phase === 'track') {
        pass = makePass(sky.r, pass.x0 > BW / 2);
        passStart = t;
      }
      drawSky(B, sky, t);
      const o = objectAt(pass, Math.min(1, (t - passStart) / PASS)),
        bright = drawObject(B, o, t),
        locked = phase === 'track' && Math.abs(o.x - a.x) < LOCK && Math.abs(o.y - a.y) < LOCK;
      if (locked) {
        data = Math.min(100, data + dt * RECORD);
        if (t - lastPoint > 0.2) {
          lastPoint = t;
          curve.push(bright);
        }
        if (data >= 100) {
          sentAt = now;
          setPhase('downlink');
          live.current.phase = 'downlink';
        }
      }
      blit(ctx, buf, B.img);
      // reticle
      const rx = a.x * SCALE,
        ry = a.y * SCALE,
        R = 32;
      ctx.strokeStyle = phase !== 'track' || locked ? '#c9ff4d' : 'rgba(255,89,100,.85)';
      ctx.lineWidth = 3;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        ctx.beginPath();
        ctx.moveTo(rx + sx * R, ry + sy * (R - 12));
        ctx.lineTo(rx + sx * R, ry + sy * R);
        ctx.lineTo(rx + sx * (R - 12), ry + sy * R);
        ctx.stroke();
      }
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillRect(rx - 1, ry - 1, 3, 3);
      brackets(ctx);
      hudText(
        ctx,
        phase !== 'track' ? 'OBSERVATION COMPLETE' : locked ? 'LOCKED · RECORDING' : 'NO LOCK · STEER ONTO THE OBJECT',
        'left',
        'top',
        phase !== 'track' || locked ? '#c9ff4d' : 'rgba(255,89,100,.9)',
      );
      hudText(ctx, info.coords, 'right', 'top');
      // the data recorded so far, and the light curve it's building (the tumbling shows up as a flicker)
      const bw = 260,
        bx = 16,
        by = H - 34;
      ctx.fillStyle = 'rgba(2,4,6,.62)';
      ctx.fillRect(bx - 6, by - 30, bw + 12, 56);
      ctx.strokeStyle = '#39453f';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, 16);
      ctx.fillStyle = '#55b6ff';
      ctx.fillRect(bx + 3, by + 3, ((bw - 6) * data) / 100, 10);
      ctx.font = '16px "Courier New", monospace';
      ctx.fillStyle = '#c9ccc8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`DATA ${Math.floor(data)}%`, bx, by - 6);
      const cw = 300,
        cx = W - cw - 16,
        cy = H - 18,
        ch = 60;
      ctx.fillStyle = 'rgba(2,4,6,.62)';
      ctx.fillRect(cx - 6, cy - ch - 28, cw + 12, ch + 34);
      ctx.fillStyle = '#c9ccc8';
      ctx.fillText('LIGHT CURVE', cx, cy - ch - 6);
      ctx.strokeStyle = '#27302d';
      ctx.strokeRect(cx, cy - ch, cw, ch);
      ctx.fillStyle = '#ffd166';
      curve.slice(-cw / 4).forEach((b, i) => ctx.fillRect(cx + i * 4, cy - 4 - b * (ch - 10), 4, 4));
      if (phase === 'downlink') {
        const d = now - sentAt;
        drawDownlink(ctx, d);
        if (d >= DOWNLINK_TIME) {
          report({ type: 'science-complete', kind: 'interstellar' });
          setPhase('done');
          live.current.phase = 'done';
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [info]);

  const point = e => {
    const r = e.currentTarget.getBoundingClientRect();
    aim.current = { x: ((e.clientX - r.left) / r.width) * BW, y: ((e.clientY - r.top) / r.height) * BH };
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
        width={BW * SCALE}
        height={BH * SCALE}
        onPointerDown={point}
        onPointerMove={point}
        style={{
          width: '100%',
          maxWidth: FIT,
          display: 'block',
          imageRendering: 'pixelated',
          border: '1px solid #34403a',
          background: '#000',
          cursor: 'crosshair',
          touchAction: 'none',
        }}
      />
      {phase === 'done' && (
        <>
          <div className="success">{info.uni.toUpperCase()} RECEIVED THE OBSERVATION · LIGHT CURVE RECORDED</div>
          <div className="actions">
            <button className="action" onClick={() => report({ type: 'science-close' })}>
              DONE
            </button>
          </div>
        </>
      )}
    </>
  );
}
