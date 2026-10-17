import { useState, useEffect, useRef } from 'react';
import { Header } from '../shared/ui.jsx';
import { pixelFont } from '../science/common.js';

export function Flare() {
  const NB = 160,
    DURATION = 45,
    CALM = 3; // NB frequency bins across the band; the flare builds after a CALM start
  const S_DB = 24,
    THRESH = 10,
    HALF = 4,
    PER_SAT = 4; // carrier level over the noise floor, SNR needed to upload, carrier half-width in bins, clean seconds per command
  const F0 = 10.7,
    F1 = 12.7; // Ku downlink band, GHz
  const ROWS = 110,
    ROW_RATE = 24,
    SPEC_H = 84,
    FALL_H = 176; // waterfall keeps ~4.6s of history
  const LIMIT_DB = S_DB - THRESH; // the noise under the carrier must stay below this for the link to hold
  const params = new URLSearchParams(location.search);
  const [sats] = useState(() => {
    const ids = (params.get('sats') || '').split(',').filter(Boolean);
    return ids.length ? ids : Array.from({ length: 7 }, () => String(100 + Math.floor(Math.random() * 900)));
  });
  const [world] = useState(() => {
    const flashes = [];
    for (let ft = 6 + Math.random() * 3; ft < DURATION; ft += 5 + Math.random() * 3) flashes.push([ft, 12 + Math.random() * 8]);
    return { flashes, bursts: [], next: CALM, start: NB / 2 };
  });
  const carrierRef = useRef(world.start),
    heldRef = useRef(0),
    draggingRef = useRef(false);
  const specRef = useRef(null),
    fallRef = useRef(null);
  const [view, setView] = useState({ t: 0, snr: S_DB, prog: 0, c: world.start });
  const [phase, setPhase] = useState('run'); // run | done
  const TOTAL = PER_SAT * sats.length;
  const clampC = c => Math.max(HALF, Math.min(NB - 1 - HALF, c));

  // flare intensity: quiet start, impulsive rise, long decay
  const envelope = t =>
    t < CALM ? 0 : t < 8 ? 0.35 + (0.65 * (t - CALM)) / (8 - CALM) : t < 22 ? 1 : 1 - (0.45 * (t - 22)) / (DURATION - 22);
  const spawn = t => {
    while (t >= world.next) {
      const slow = Math.random() < 0.2; // most bursts drift fast from high to low frequency; some are broad and slow
      world.bursts.push({
        t0: world.next,
        c0: Math.random() * NB * 1.15,
        v: slow ? -(3 + Math.random() * 5) : -(14 + Math.random() * 26),
        sig: slow ? 12 + Math.random() * 6 : 4 + Math.random() * 5,
        pk: slow ? 18 + Math.random() * 5 : 22 + Math.random() * 8,
        life: slow ? 5 + Math.random() * 3 : 3 + Math.random() * 3,
      });
      world.next += (0.35 + Math.random() * 0.6) / Math.max(0.35, envelope(world.next));
    }
    world.bursts = world.bursts.filter(b => t - b.t0 < b.life);
  };
  const noise = t => {
    // linear power per bin, noise floor = 1
    const n = new Array(NB).fill(1);
    world.bursts.forEach(bu => {
      const a = t - bu.t0,
        fade = Math.max(0, Math.min(1, a / 0.3, (bu.life - a) / 0.5)),
        c = bu.c0 + bu.v * a,
        amp = 10 ** (bu.pk / 10) * fade;
      for (let b = Math.max(0, Math.floor(c - 3 * bu.sig)); b < Math.min(NB, c + 3 * bu.sig + 1); b++)
        n[b] += amp * Math.exp(-(((b - c) / bu.sig) ** 2));
    });
    let fl = 0; // broadband flashes lift the whole band at once
    world.flashes.forEach(([ft, a]) => {
      const x = t - ft;
      if (x >= 0 && x < 4) fl += 10 ** (a / 10) * (x < 0.25 ? x / 0.25 : Math.exp(-(x - 0.25) / 0.8));
    });
    return fl ? n.map(v => v + fl) : n;
  };
  const snrAt = (n, c) => {
    const lo = Math.max(0, Math.round(c) - HALF),
      hi = Math.min(NB, Math.round(c) + HALF + 1);
    let s = 0;
    for (let b = lo; b < hi; b++) s += n[b];
    return S_DB - 10 * Math.log10(s / (hi - lo));
  };

  useEffect(() => {
    const down = e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') heldRef.current = -1;
      else if (e.key === 'ArrowRight' || e.key === 'd') heldRef.current = 1;
    };
    const up = e => {
      if ((e.key === 'ArrowLeft' || e.key === 'a') && heldRef.current === -1) heldRef.current = 0;
      if ((e.key === 'ArrowRight' || e.key === 'd') && heldRef.current === 1) heldRef.current = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'run') return;
    const buf = document.createElement('canvas');
    buf.width = NB;
    buf.height = ROWS;
    const bctx = buf.getContext('2d');
    bctx.fillStyle = '#05080a';
    bctx.fillRect(0, 0, NB, ROWS);
    const row = bctx.createImageData(NB, 1);
    const STOPS = [
      [0, 5, 8, 10],
      [0.25, 14, 40, 36],
      [0.5, 40, 110, 80],
      [0.72, 201, 255, 77],
      [0.86, 255, 209, 102],
      [1, 255, 89, 100],
    ];
    const colour = d => {
      const x = Math.max(0, Math.min(1, d / 30));
      let i = 1;
      while (x > STOPS[i][0]) i++;
      const [a, b] = [STOPS[i - 1], STOPS[i]],
        k = (x - a[0]) / (b[0] - a[0]);
      return [1, 2, 3].map(j => a[j] + (b[j] - a[j]) * k);
    };
    const fit = cv => {
      const dpr = devicePixelRatio || 1,
        w = Math.round(cv.clientWidth * dpr),
        h = Math.round(cv.clientHeight * dpr);
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [g, cv.clientWidth, cv.clientHeight];
    };
    let raf,
      last = null,
      t = 0,
      prog = 0,
      disp = S_DB,
      rowAcc = 0;
    const step = ts => {
      const dt = last == null ? 0 : Math.min(0.05, (ts - last) / 1000);
      last = ts;
      t += dt; // simulated time: a hidden tab pauses the flare too
      if (heldRef.current) carrierRef.current = clampC(carrierRef.current + heldRef.current * 70 * dt);
      const c = carrierRef.current;
      spawn(t);
      const n = noise(t);
      disp += (snrAt(n, c) - disp) * (1 - Math.exp(-dt / 0.2)); // receiver averaging
      if (disp >= THRESH) prog = Math.min(TOTAL, prog + dt);
      const rx = n.map(v => 10 * Math.log10(v * (0.55 + Math.random() * 0.9))); // noise only -- the carrier is the marked strip, so the trace inside it reads straight against the link limit

      rowAcc += dt * ROW_RATE;
      if (rowAcc >= 1) {
        rowAcc %= 1;
        bctx.drawImage(buf, 0, 0, NB, ROWS - 1, 0, 1, NB, ROWS - 1); // scroll history down, newest row on top
        rx.forEach((d, b) => {
          const [r, g, bl] = colour(d);
          row.data.set([r, g, bl, 255], b * 4);
        });
        bctx.putImageData(row, 0, 0);
      }
      const ok = disp >= THRESH;
      if (fallRef.current) {
        const [g, w, h] = fit(fallRef.current);
        g.imageSmoothingEnabled = false;
        g.drawImage(buf, 0, 0, w, h);
        const x0 = ((c - HALF) / NB) * w,
          x1 = ((c + HALF + 1) / NB) * w;
        g.strokeStyle = ok ? 'rgba(201,255,77,.7)' : 'rgba(255,89,100,.8)';
        g.lineWidth = 1;
        g.setLineDash([3, 4]);
        g.beginPath();
        g.moveTo(x0, 0);
        g.lineTo(x0, h);
        g.moveTo(x1, 0);
        g.lineTo(x1, h);
        g.stroke();
        g.setLineDash([]);
      }
      if (specRef.current) {
        const [g, w, h] = fit(specRef.current),
          y = d => h - 4 - ((Math.max(-2, Math.min(34, d)) + 2) / 36) * (h - 8);
        g.fillStyle = '#05080a';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#1a2320';
        g.beginPath();
        [0, 10, 20, 30].forEach(d => {
          g.moveTo(0, y(d));
          g.lineTo(w, y(d));
        });
        g.stroke();
        g.fillStyle = ok ? 'rgba(201,255,77,.12)' : 'rgba(255,89,100,.18)';
        g.fillRect(((c - HALF) / NB) * w, 0, ((2 * HALF + 1) / NB) * w, h);
        g.strokeStyle = '#ffd166';
        g.setLineDash([4, 4]);
        g.beginPath();
        g.moveTo(0, y(LIMIT_DB));
        g.lineTo(w, y(LIMIT_DB));
        g.stroke();
        g.setLineDash([]);
        g.font = pixelFont(11);
        g.fillStyle = '#ffd166';
        g.fillText('NOISE THRESHOLD', 4, y(LIMIT_DB) - 3);
        g.fillStyle = ok ? '#c9ff4d' : '#ff5964';
        g.textAlign = 'center';
        g.fillText('YOUR SIGNAL', Math.max(32, Math.min(w - 32, ((c + 0.5) / NB) * w)), 10);
        g.textAlign = 'left';
        g.strokeStyle = '#b9c7bf';
        g.lineWidth = 1.2;
        g.beginPath();
        rx.forEach((d, b) => {
          const x = ((b + 0.5) / NB) * w;
          b ? g.lineTo(x, y(d)) : g.moveTo(x, y(d));
        });
        g.stroke();
      }
      setView({ t, snr: disp, prog, c });
      if (prog >= TOTAL || t >= DURATION) {
        setPhase('done');
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const saved = Math.min(sats.length, Math.floor(view.prog / PER_SAT + 1e-9));
  useEffect(() => {
    if (phase !== 'done' || window.parent === window) return;
    const id = setTimeout(
      () => window.parent.postMessage({ type: 'flare-resolved', results: sats.map((satId, i) => ({ satId, fixed: i < saved })) }, '*'),
      saved === sats.length ? 1400 : 2200,
    );
    return () => clearTimeout(id);
  }, [phase]);

  const tune = e => {
    const box = e.currentTarget.getBoundingClientRect();
    carrierRef.current = clampC(((e.clientX - box.left) / box.width) * NB);
  };
  const drag = {
    onPointerDown: e => {
      if (phase !== 'run') return;
      draggingRef.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      tune(e);
    },
    onPointerMove: e => {
      if (draggingRef.current && phase === 'run') tune(e);
    },
    onPointerUp: () => {
      draggingRef.current = false;
    },
    onPointerCancel: () => {
      draggingRef.current = false;
    },
  };
  const ok = view.snr >= THRESH,
    freq = F0 + ((view.c + 0.5) / NB) * (F1 - F0);
  return (
    <>
      <Header title="SOLAR FLARE" sub={`RADIO BLACKOUT · Ku DOWNLINK · ${Math.max(0, Math.ceil(DURATION - view.t))}s REMAINING`} />
      <p className="instructions">
        The flare has cut the radio link to these satellites. Drag the shaded strip, or hold ← →, to a band where the noise is below the
        yellow <span style={{ color: 'var(--yellow)' }}>NOISE THRESHOLD</span> line. Stay there. The satellites reconnect one at a time.
      </p>
      <div style={{ maxWidth: 720, cursor: phase === 'run' ? 'ew-resize' : 'default', touchAction: 'none' }} {...drag}>
        <div style={{ fontSize: 10, letterSpacing: '.14em', color: '#7b8580', marginBottom: 4 }}>SPECTRUM</div>
        <canvas ref={specRef} style={{ width: '100%', height: SPEC_H, display: 'block', border: '1px solid #34403a' }} />
        <div style={{ fontSize: 10, letterSpacing: '.14em', color: '#7b8580', margin: '8px 0 4px' }}>WATERFALL · NEWEST AT TOP</div>
        <canvas ref={fallRef} style={{ width: '100%', height: FALL_H, display: 'block', border: '1px solid #34403a' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7b8580', marginTop: 4 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <span key={i}>{(F0 + (i * (F1 - F0)) / 4).toFixed(2)} GHz</span>
          ))}
        </div>
      </div>
      <div className="readout" style={{ color: ok ? 'var(--green)' : 'var(--red)' }}>
        SNR {view.snr.toFixed(1)} dB · SIGNAL {freq.toFixed(3)} GHz · {ok ? 'RECONNECTING' : 'LINK DROPPED'}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 720 }}>
        {sats.map((id, i) => {
          const p = Math.max(0, Math.min(1, view.prog / PER_SAT - i));
          return (
            <div
              key={id}
              style={{
                flex: '1 1 0',
                minWidth: 80,
                position: 'relative',
                border: '1px solid ' + (p >= 1 ? 'var(--green)' : '#39453f'),
                padding: '4px 8px',
                fontSize: 11,
                color: p >= 1 ? '#070809' : phase === 'done' ? 'var(--red)' : '#9aa39c',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${p * 100}%`,
                  background: p >= 1 ? 'var(--green)' : 'rgba(201,255,77,.25)',
                }}
              />
              <div style={{ position: 'relative' }}>SAT {String(id).padStart(3, '0')}</div>
              <div style={{ position: 'relative', fontSize: 9, letterSpacing: '.1em', marginTop: 2 }}>{p >= 1 ? 'ONLINE' : 'OFFLINE'}</div>
            </div>
          );
        })}
      </div>
      {phase === 'done' && (
        <div className={saved === sats.length ? 'success' : 'failure'}>
          {saved === sats.length
            ? 'ALL SATELLITES RECONNECTED · LINK HELD'
            : `${saved}/${sats.length} SATELLITES RECONNECTED · ${sats.length - saved} LOST`}
        </div>
      )}
    </>
  );
}
