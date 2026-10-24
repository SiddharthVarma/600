import { useState, useEffect, useRef } from 'react';
import { LabLayout, Status } from '../shared/layout.jsx';

export function Contact() {
  const MASK = 10,
    SIGMA = 10,
    THRESH = 70,
    LOCK_S = 2;
  const PX = 150,
    PY = 150,
    PR = 128; // sky plot: centre = zenith, rim = horizon
  const D2R = Math.PI / 180,
    R2D = 180 / Math.PI;
  const unit = (a, e) => [Math.cos(e * D2R) * Math.sin(a * D2R), Math.cos(e * D2R) * Math.cos(a * D2R), Math.sin(e * D2R)];
  const toAzEl = v => [(((Math.atan2(v[0], v[1]) * R2D) % 360) + 360) % 360, Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D];
  const sepDeg = (u, v) => Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]))) * R2D;
  const plot = (az, el) => {
    const r = (PR * (90 - Math.max(0, el))) / 90;
    return [PX + r * Math.sin(az * D2R), PY - r * Math.cos(az * D2R)];
  };

  // One pass: a great circle through the culmination point, with theta(t) = atan(t/tau) -- a straight-line
  // flyby, slow near the horizon and fastest overhead. The real satellite sits ahead of or behind the stale
  // prediction along its track, plus a small cross-track error. Opens with the prediction at 12° rising and
  // sets under the mask D seconds later, sized to fit inside the repair window.
  const [pass] = useState(() => {
    const n = parseInt(new URLSearchParams(location.search).get('deadline'), 10);
    const D = Math.max(22, Math.min(34, (Number.isFinite(n) ? n : 38) - 4));
    const azC = Math.random() * 360,
      maxEl = 25 + Math.random() * 55,
      dir = Math.random() < 0.5 ? 1 : -1;
    const C = unit(azC, maxEl),
      p = [dir * Math.cos(azC * D2R), -dir * Math.sin(azC * D2R), 0];
    const nrm = [C[1] * p[2] - C[2] * p[1], C[2] * p[0] - C[0] * p[2], C[0] * p[1] - C[1] * p[0]];
    const se = Math.sin(maxEl * D2R);
    const thA = Math.acos(Math.sin(12 * D2R) / se),
      thB = Math.acos(Math.sin(MASK * D2R) / se);
    const tau = D / (Math.tan(thA) + Math.tan(thB));
    const dTheta = (14 + Math.random() * 10) * (Math.random() < 0.5 ? 1 : -1) * D2R;
    const xt = Math.tan((1.5 + Math.random() * 1.5) * D2R) * (Math.random() < 0.5 ? 1 : -1);
    const theta = t => Math.atan((t - tau * Math.tan(thA)) / tau);
    const along = (a, x) => {
      const v = [0, 1, 2].map(i => C[i] * Math.cos(a) + p[i] * Math.sin(a) + nrm[i] * x);
      const m = Math.hypot(...v);
      return v.map(c => c / m);
    };
    const track = [];
    for (let d = -90; d <= 90; d += 3) track.push(toAzEl(along(d * D2R, 0)));
    return { D, pred: t => along(theta(t), 0), truth: t => along(theta(t) + dTheta, xt), track };
  });

  const [ant, setAnt] = useState(() => toAzEl(pass.pred(0))); // the antenna starts on the predicted position
  const antRef = useRef(ant),
    goalRef = useRef(ant);
  const [view, setView] = useState({ t: 0, sig: 0, prog: 0, truth: null });
  const [phase, setPhase] = useState('search'); // search | locked | los
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (phase !== 'search') return;
    let raf,
      last,
      t = 0,
      disp = 0,
      prog = 0,
      rose = false;
    const step = ts => {
      if (last == null) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      t += dt;
      const tv = pass.truth(t),
        tel = toAzEl(tv)[1];
      if (tel >= MASK) rose = true;
      // LOS: it set below the mask, or the station's scheduled contact ended (a satellite trailing the
      // prediction on a high pass never quite reaches the far horizon in this flyby model)
      if ((rose && tel < MASK) || t >= pass.D + 4) {
        setView(v => ({ ...v, t, truth: toAzEl(tv) }));
        setPhase('los');
        return;
      }
      const [az, el] = goalRef.current; // the antenna points exactly where the player drags
      antRef.current = [az, el];
      const raw = tel >= MASK ? 100 * Math.exp(-((sepDeg(unit(az, el), tv) / SIGMA) ** 2)) : 0;
      disp += (raw - disp) * (1 - Math.exp(-dt / 0.25)); // receiver integration: the reading lags a fast sweep
      prog = disp >= THRESH ? prog + dt : Math.max(0, prog - 2 * dt);
      setAnt([az, el]);
      if (prog >= LOCK_S) {
        setView({ t, sig: disp, prog: 1, truth: toAzEl(tv) });
        setPhase('locked');
        return;
      }
      setView({ t, sig: disp, prog: prog / LOCK_S, truth: null });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase === 'search' || window.parent === window) return;
    const id = setTimeout(() => window.parent.postMessage({ type: phase === 'locked' ? 'repair-complete' : 'repair-failed' }, '*'), 1400);
    return () => clearTimeout(id);
  }, [phase]);

  const aim = e => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 300 - PX,
      y = ((e.clientY - b.top) / b.height) * 300 - PY;
    goalRef.current = [(Math.atan2(x, -y) * R2D + 360) % 360, 90 - (Math.min(PR, Math.hypot(x, y)) / PR) * 90];
  };
  const down = e => {
    if (phase !== 'search') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    aim(e);
  };
  const move = e => {
    if (dragging && phase === 'search') aim(e);
  };
  const up = () => setDragging(false);

  const [ax, ay] = plot(ant[0], ant[1]);
  const [px, py] = plot(...toAzEl(pass.pred(view.t)));
  const trackPts = pass.track.map(([a, e]) => plot(a, e).join(',')).join(' ');
  const sigColor = view.sig >= THRESH ? '#c9ff4d' : view.sig > 40 ? '#ffd166' : '#ff5964';
  const lockPx = ((Math.sqrt(Math.log(100 / THRESH)) * SIGMA) / 90) * PR; // on-plot radius of the lock zone
  const FRAME_DIR = '600_gn_antenna_pixel_frames/';
  const FRAMES = [
    { file: 'antenna_r01_f01.png', w: 96, h: 168 },
    { file: 'antenna_r01_f02.png', w: 128, h: 168 },
    { file: 'antenna_r01_f03.png', w: 128, h: 173 },
    { file: 'antenna_r01_f04.png', w: 105, h: 176 },
    { file: 'antenna_r01_f05.png', w: 103, h: 177 },
    { file: 'antenna_r01_f06.png', w: 96, h: 186 },
    { file: 'antenna_r01_f07.png', w: 93, h: 184 },
    { file: 'antenna_r01_f08.png', w: 99, h: 176 },
    { file: 'antenna_r01_f09.png', w: 103, h: 176 },
    { file: 'antenna_r01_f10.png', w: 128, h: 170 },
    { file: 'antenna_r01_f11.png', w: 128, h: 166 },
    { file: 'antenna_r01_f12.png', w: 96, h: 159 },
  ];
  const fr = FRAMES[Math.round(ant[0] / 30) % 12];
  const bars = [20, 45, 70, 90];

  // where to label the predicted pass: beside the middle of its track
  const [lx, ly] = plot(...pass.track[Math.floor(pass.track.length / 2)]);
  const stage = (
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <svg
          viewBox="0 0 300 300"
          height="100%"
          style={{ display: 'block', maxWidth: '100%', cursor: phase === 'search' ? 'crosshair' : 'default', touchAction: 'none' }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <circle cx={PX} cy={PY} r={PR * (1 - MASK / 180)} fill="none" stroke="rgba(255,89,100,.13)" strokeWidth={(PR * MASK) / 90} />
          {[PR, (PR * 2) / 3, PR / 3].map(r => (
            <circle key={r} cx={PX} cy={PY} r={r} fill="none" stroke="#27302d" strokeWidth={r === PR ? 1.5 : 1} />
          ))}
          {Array.from({ length: 12 }, (_, i) => {
            const a = i * 30 * D2R;
            return <line key={i} x1={PX} y1={PY} x2={PX + PR * Math.sin(a)} y2={PY - PR * Math.cos(a)} stroke="#1c2422" />;
          })}
          {[
            ['N', 0],
            ['E', 90],
            ['S', 180],
            ['W', 270],
          ].map(([l, a]) => (
            <text
              key={l}
              x={PX + (PR + 11) * Math.sin(a * D2R)}
              y={PY - (PR + 11) * Math.cos(a * D2R) + 3}
              textAnchor="middle"
              fontSize="9"
              fill="#7b8580"
            >
              {l}
            </text>
          ))}
          <text x={PX + 3} y={PY - PR / 3 - 3} fontSize="7" fill="#4c5750">
            60°
          </text>
          <text x={PX + 3} y={PY - (PR * 2) / 3 - 3} fontSize="7" fill="#4c5750">
            30°
          </text>
          <polyline points={trackPts} fill="none" stroke="#55b6ff" strokeWidth="1.2" strokeDasharray="3 4" opacity=".7" />
          {/* what the blue track and the red ring are, written on them */}
          <text x={lx + 8} y={ly - 6} fontSize="7" fill="#55b6ff" opacity=".85">
            PREDICTED PASS
          </text>
          <text x={PX} y={PY + PR - 4} textAnchor="middle" fontSize="6.5" fill="rgba(255,89,100,.8)" letterSpacing=".08em">
            ELEVATION MASK
          </text>
          <circle cx={px} cy={py} r="5" fill="none" stroke="#55b6ff" strokeWidth="1.5" />
          <circle cx={ax} cy={ay} r={(SIGMA / 90) * PR} fill="none" stroke={sigColor} strokeWidth=".8" opacity=".35" />
          <circle cx={ax} cy={ay} r={lockPx} fill="none" stroke={sigColor} strokeWidth="1.8" />
          <line x1={ax - 11} y1={ay} x2={ax + 11} y2={ay} stroke={sigColor} strokeWidth="1" />
          <line x1={ax} y1={ay - 11} x2={ax} y2={ay + 11} stroke={sigColor} strokeWidth="1" />
          {view.truth &&
            (() => {
              const [tx, ty] = plot(...view.truth);
              return (
                <g>
                  <circle cx={tx} cy={ty} r="10" fill="none" stroke={phase === 'locked' ? '#c9ff4d' : '#ff5964'} strokeWidth="1.5" />
                  <image href="600_solar_assets/satellite.png" x={tx - 16} y={ty - 7} width="32" height={(32 * 644) / 1490} />
                </g>
              );
            })()}
          {bars.map((th, i) => (
            <rect key={th} x={10 + i * 8} y={30 - (6 + i * 5)} width="5" height={6 + i * 5} fill={view.sig >= th ? '#c9ff4d' : '#2a332f'} />
          ))}
        </svg>
        <div style={{ textAlign: 'center' }}>
          <img src={FRAME_DIR + fr.file} alt="" style={{ height: 130, imageRendering: 'pixelated' }} />
          <div style={{ fontSize: 11, color: '#89948d', letterSpacing: '.12em', marginTop: 8 }}>
            AZ {Math.round(ant[0])}° · EL {Math.round(ant[1])}°
          </div>
        </div>
      </div>
  );
  return (
    <LabLayout
      eyebrow="Critical subsystem interaction"
      title="MISSED CONTACT"
      signal="STALE EPHEMERIS · BLIND ACQUISITION"
      view={stage}
      boxed
      brief="Search along the track for the signal and hold on it to lock before LOS."
      live={[
        [
          'Signal',
          `${Math.round(view.sig)}% · ${phase === 'locked' ? 'locked' : view.sig >= THRESH ? 'locking' : dragging ? 'slewing' : 'searching'}`,
          sigColor,
        ],
        ['LOS in', phase === 'search' ? `${Math.max(0, Math.ceil(pass.D - view.t))} s` : phase === 'locked' ? 'tracking' : 'lost'],
      ]}
      about="Dishes point using a predicted orbit. When it's out of date, the satellite isn't where the dish expects."
      aboutLabel="About this fault"
      left={<Status>DRAG TO SEARCH</Status>}
      result={
        phase === 'locked' ? (
          <Status tone="ok">DOWNLINK ESTABLISHED · TELEMETRY RECEIVED</Status>
        ) : (
          phase === 'los' && <Status tone="bad">LOSS OF SIGNAL · PASS SET BEFORE LOCK</Status>
        )
      }
    />
  );
}
