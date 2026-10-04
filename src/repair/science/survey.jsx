import { useEffect, useRef, useState } from 'react';
import { DOWNLINK_TIME, SCIENCE, blit, brackets, drawDownlink, hudText, report } from './common.js';
import { BH, BW, ZOOM_TIME, drawZoom, makeSurvey } from './scenes.js';

// Earth-observation request (penguins, whales, wildfires): the camera dives in, the player taps what they're asked to
// find, and downlinks the survey. No timer; a wrong survey costs nothing.
// the view never grows taller than the window leaves room for: header and instructions above, buttons and result below
const FIT = `min(${BW * 4}px, calc((100vh - 340px) * ${BW / BH}))`;
const SCALE = 4,
  MATCH = 7; // a mark within this many scene pixels of a target counts as finding it
// after the main screen's dive the window opens inside the clouds, so its own zoom skips the Earth
const SKIP = new URLSearchParams(location.search).has('dive') ? 1.25 : 0;
const earth = new Image();
earth.src = '600_earth_assets/earth.png';

function score(marks, targets) {
  // pair marks with targets, closest pairs first, each used once
  const pairs = [];
  marks.forEach((m, i) =>
    targets.forEach((tg, j) => {
      // a target with a shape (an oil slick) counts a mark anywhere on it; otherwise it's a point
      const d = tg.hit ? (tg.hit(m.x, m.y) ? 0 : Infinity) : Math.hypot(m.x - tg.x, m.y - tg.y);
      if (d < MATCH) pairs.push([d, i, j]);
    }),
  );
  pairs.sort((a, b) => a[0] - b[0]);
  const usedMarks = new Set(),
    found = new Set();
  pairs.forEach(([, i, j]) => {
    if (usedMarks.has(i) || found.has(j)) return;
    usedMarks.add(i);
    found.add(j);
  });
  return { found, wrong: marks.filter((_, i) => !usedMarks.has(i)) };
}
const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;

export function Survey({ kind }) {
  const info = SCIENCE[kind];
  const [coords] = useState(info.coords); // a fresh spot in the right part of the world each time
  const canvasRef = useRef(null);
  const [scene] = useState(() => makeSurvey(kind, Math.floor(Math.random() * 1e9)));
  const [phase, setPhase] = useState('zoom'); // zoom → look → downlink → done
  const [ir, setIr] = useState(false);
  const [marks, setMarks] = useState([]);
  const [result, setResult] = useState(null);
  // the animation loop reads the latest state from here
  const live = useRef({});
  live.current = { phase, ir, marks, result };
  const sentAt = useRef(0);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d'),
      buf = document.createElement('canvas'),
      refBuf = document.createElement('canvas');
    buf.width = BW;
    buf.height = BH;
    refBuf.width = 40;
    refBuf.height = 30;
    const t0 = performance.now() / 1000 - SKIP;
    let raf,
      reported = false;
    const loop = () => {
      const now = performance.now() / 1000,
        t = now - t0,
        { phase, ir, marks, result } = live.current;
      if (phase === 'zoom') {
        blit(ctx, buf, drawZoom(ctx, SCALE, earth, info.earthAt, scene, t));
        hudText(ctx, 'ACQUIRING · ' + (scene.coords || coords), 'left', 'top');
        if (t >= ZOOM_TIME) setPhase('look');
      } else {
        scene.frame(t, ir);
        blit(ctx, buf, scene.img);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(85,182,255,.95)';
        if (phase !== 'done')
          marks.forEach(m => {
            ctx.beginPath();
            ctx.arc(m.x * SCALE, m.y * SCALE, 14, 0, Math.PI * 2);
            ctx.stroke();
          });
        if (phase === 'done' && result) {
          // what you found (green), what you missed (red), and marks on nothing (red ×)
          ctx.lineWidth = 3;
          scene.targets.forEach((tg, j) => {
            const r = (tg.box || 26) + Math.sin(t * 4) * 2;
            ctx.strokeStyle = result.found.has(j) ? '#c9ff4d' : '#ff5964';
            ctx.strokeRect(tg.x * SCALE - r / 2, tg.y * SCALE - r / 2, r, r);
          });
          ctx.strokeStyle = '#ff5964';
          result.wrong.forEach(m => {
            const x = m.x * SCALE,
              y = m.y * SCALE;
            ctx.beginPath();
            ctx.moveTo(x - 9, y - 9);
            ctx.lineTo(x + 9, y + 9);
            ctx.moveTo(x + 9, y - 9);
            ctx.lineTo(x - 9, y + 9);
            ctx.stroke();
          });
        }
        brackets(ctx);
        hudText(ctx, scene.toggle ? scene.toggle[ir ? 'on' : 'off'] : 'VISIBLE', 'left', 'top');
        hudText(ctx, scene.coords || coords, 'right', 'top');
        if (scene.reference && phase !== 'done') {
          // the target card: what you're looking for, top down, as it looks from up here
          const W = ctx.canvas.width,
            x0 = W - 196,
            y0 = 46,
            ref = scene.reference;
          ctx.fillStyle = 'rgba(2,4,6,.85)';
          ctx.fillRect(x0, y0, 180, 136);
          ctx.strokeStyle = 'rgba(201,255,77,.55)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x0, y0, 180, 136);
          refBuf.getContext('2d').putImageData(ref.img, 0, 0);
          ctx.drawImage(refBuf, x0 + 30, y0 + 22, 120, 90);
          ctx.font = '13px "Courier New", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = 'rgba(201,255,77,.85)';
          ctx.fillText('TARGET', x0 + 90, y0 + 6);
          ctx.fillText(ref.name, x0 + 90, y0 + 114);
        }
        hudText(ctx, '0.5 m/px', 'left', 'bottom', 'rgba(201,255,77,.6)');
        if (phase === 'downlink') {
          const d = now - sentAt.current;
          drawDownlink(ctx, d);
          if (d >= DOWNLINK_TIME && !reported) {
            reported = true;
            report({ type: 'science-complete', kind, found: result.found.size, total: scene.targets.length });
            setPhase('done');
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scene, info, kind]);

  const tap = e => {
    if (phase !== 'look') return;
    const r = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * BW,
      y = ((e.clientY - r.top) / r.height) * BH;
    // tapping a mark again removes it
    const hit = marks.findIndex(m => Math.hypot(m.x - x, m.y - y) < 5);
    setMarks(hit >= 0 ? marks.filter((_, i) => i !== hit) : [...marks, { x, y }]);
  };
  const downlink = () => {
    setResult(score(marks, scene.targets));
    sentAt.current = performance.now() / 1000;
    setPhase('downlink');
  };
  const total = scene.targets.length,
    found = result ? result.found.size : 0,
    wrong = result ? result.wrong.length : 0,
    perfect = result && found === total && !wrong;

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
        {scene.toggle && (
          <button className="action" onClick={() => setIr(!ir)}>
            {scene.toggle.button}: {ir ? 'ON' : 'OFF'}
          </button>
        )}
        <span className="eyebrow">{marks.length ? `${marks.length} MARKED` : 'TAP TO MARK'}</span>
        <span style={{ flex: 1 }} />
        {phase === 'done' ? (
          <button className="action" onClick={() => report({ type: 'science-close' })}>
            DONE
          </button>
        ) : (
          <button
            className="action"
            disabled={phase !== 'look' || !marks.length}
            style={phase !== 'look' || !marks.length ? { opacity: 0.4 } : {}}
            onClick={downlink}
          >
            DOWNLINK
          </button>
        )}
      </div>
      {phase === 'done' && (
        <div className={perfect ? 'success' : 'failure'} style={perfect ? {} : { color: 'var(--yellow)', borderColor: 'var(--yellow)' }}>
          {info.uni.toUpperCase()} RECEIVED YOUR DATA ·{' '}
          {perfect
            ? `ALL ${plural(total, scene.noun || info.noun).toUpperCase()} FOUND`
            : `YOU FOUND ${found} OF ${plural(total, scene.noun || info.noun).toUpperCase()}`}
          {wrong > 0 && ` · ${wrong} ${wrong === 1 ? 'MARK WAS' : 'MARKS WERE'} ON NOTHING`}
        </div>
      )}
    </>
  );
}
