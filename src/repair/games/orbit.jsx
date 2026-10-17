import { useState, useEffect } from 'react';
import { Header } from '../shared/ui.jsx';

export function Orbit() {
  const cx = 150,
    cy = 150;
  const [cfg] = useState(() => {
    // the fault is always decay: the satellite has sunk, and the burn raises it back to its home orbit
    let r2 = 60 + Math.random() * 20,
      delta = 20 + Math.random() * 12;
    let r1 = Math.max(26, r2 - delta);
    // Normalize so the larger orbit always fills the frame consistently -- otherwise a small random
    // draw renders as a tiny cluster lost in empty space instead of using the available canvas.
    const scale = 120 / Math.max(r1, r2);
    r1 *= scale;
    r2 *= scale;
    const startAngle = Math.random() * 360,
      windowCenter = (startAngle + 130 + Math.random() * 100) % 360;
    return { r1, r2, minSafeR: 40, radiusTol: 9, startAngle, windowCenter, windowWidth: 50 };
  });
  const [stage, setStage] = useState('plot'); // plot -> approach -> coast -> success
  const [drag, setDrag] = useState(null),
    [locked, setLocked] = useState(null),
    [error, setError] = useState('');
  const [t, setT] = useState(0),
    [sweepT, setSweepT] = useState(0),
    [sweepDeg, setSweepDeg] = useState(0);

  const polar = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy - Math.sin(a) * r];
  };
  const angDelta = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const satStart = polar(cfg.startAngle, cfg.r1);
  const points = end => {
    const [ex, ey] = polar(end.angle, end.dist);
    const da = (end.angle - cfg.startAngle + 360) % 360,
      midAngle = cfg.startAngle + da / 2;
    const midR = Math.max(20, Math.max(cfg.r1, end.dist) + 26);
    const [mx, my] = polar(midAngle, midR);
    return [satStart, [mx, my], [ex, ey]];
  };
  const pathD = pts => `M ${pts[0][0]} ${pts[0][1]} Q ${pts[1][0]} ${pts[1][1]} ${pts[2][0]} ${pts[2][1]}`;
  const bezierAt = (pts, p) => {
    const x = (1 - p) * (1 - p) * pts[0][0] + 2 * (1 - p) * p * pts[1][0] + p * p * pts[2][0],
      y = (1 - p) * (1 - p) * pts[0][1] + 2 * (1 - p) * p * pts[1][1] + p * p * pts[2][1];
    return [x, y];
  };
  const toSvg = e => {
    const box = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - box.left) / box.width) * 300,
      y = ((e.clientY - box.top) / box.height) * 300,
      dx = x - cx,
      dy = y - cy;
    return { x, y, dist: Math.hypot(dx, dy), angle: ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360 };
  };
  const evaluateMag = d => {
    if (!d) return { valid: false, msg: '' };
    if (d.dist < cfg.minSafeR) return { valid: false, msg: 'DANGER · ATMOSPHERIC INTERFACE' };
    if (Math.abs(d.dist - cfg.r2) > cfg.radiusTol)
      return { valid: false, msg: d.dist > cfg.r2 + cfg.radiusTol ? 'OVERSHOOT · BURN TOO HOT' : 'UNDERSHOOT · BURN TOO WEAK' };
    return { valid: true, msg: 'BURN PLOTTED' };
  };

  const start = e => {
    if (stage !== 'plot' || locked) return;
    const p = toSvg(e);
    if (Math.hypot(satStart[0] - p.x, satStart[1] - p.y) > 26) {
      setError('GRAB THE SATELLITE TO BEGIN');
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setError('');
    setDrag(p);
  };
  const move = e => {
    if (!drag || stage !== 'plot' || locked) return;
    setDrag(toSvg(e));
  };
  const release = () => {
    if (!drag || stage !== 'plot' || locked) return;
    const res = evaluateMag(drag);
    if (res.valid) {
      setLocked(drag);
      setError('');
    } else setError(res.msg);
    setDrag(null);
  };

  useEffect(() => {
    if (stage !== 'approach') return;
    let raf, startTs;
    const step = ts => {
      if (!startTs) startTs = ts;
      const p = Math.min(1, (ts - startTs) / 1300);
      setT(p);
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        const raw = (cfg.windowCenter + cfg.windowWidth / 2 - locked.angle + 720) % 360;
        setSweepDeg(raw < 10 ? raw + 360 : raw);
        setSweepT(0);
        setStage('coast');
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'coast') return;
    const duration = Math.max(1800, (sweepDeg / 18) * 1000);
    let raf, startTs;
    const step = ts => {
      if (!startTs) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setSweepT(p);
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        setStage('plot');
        setLocked(null);
        setDrag(null);
        setT(0);
        setSweepT(0);
        setError('BURN WINDOW EXPIRED · REPLOT TRAJECTORY');
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stage, sweepDeg]);

  useEffect(() => {
    if (stage !== 'success') return;
    if (window.parent !== window) {
      const id = setTimeout(() => window.parent.postMessage({ type: 'repair-complete' }, '*'), 1200);
      return () => clearTimeout(id);
    }
  }, [stage]);

  const fireCircularization = () => {
    if (!inWindow) {
      setStage('plot');
      setLocked(null);
      setDrag(null);
      setT(0);
      setSweepT(0);
      setError('CIRCULARIZATION MISSED · TRAJECTORY DECAYED · REPLOT BURN');
      return;
    }
    setStage('success');
  };

  const active = locked || drag;
  const evalNow = evaluateMag(drag);
  const pts = stage === 'plot' && active ? points(active) : null;
  // The plotted burn only has to land within radiusTol of r2, not exactly on it -- so the transfer
  // animation targets the true circular radius (same angle) rather than the player's imprecise value,
  // otherwise the handoff into the coast phase (which assumes you're exactly on r2) visibly snaps.
  const approachPts = locked ? points({ angle: locked.angle, dist: cfg.r2 }) : null;
  // after the circularization burn everything stays where it was when you fired (sweepT stops there): the satellite,
  // its trail, and the window at the width it had narrowed to
  const flown = (stage === 'coast' || stage === 'success') && locked;
  const currentAngle = flown ? (locked.angle + sweepDeg * sweepT) % 360 : null;
  const inWindow = currentAngle != null && angDelta(currentAngle, cfg.windowCenter) <= cfg.windowWidth / 2;
  const nearWindow = !inWindow && currentAngle != null && angDelta(currentAngle, cfg.windowCenter) <= cfg.windowWidth / 2 + 18;
  const trail =
    flown ? Array.from({ length: 25 }, (_, i) => polar(locked.angle + (sweepDeg * sweepT * i) / 24, cfg.r2)) : [];
  const satNow =
    stage === 'approach' && approachPts
      ? bezierAt(approachPts, t)
      : currentAngle != null
        ? polar(currentAngle, cfg.r2)
        : satStart;
  // The insertion window shows only a broad, vague sector at first and narrows to its true size as the
  // coast phase progresses -- you don't get precise timing info until you're actually getting close.
  const revealT = flown ? Math.min(1, sweepT / 0.65) : 0;
  const displayWidth = cfg.windowWidth * 3 - (cfg.windowWidth * 3 - cfg.windowWidth) * revealT;
  const arcPts = Array.from({ length: 9 }, (_, i) => polar(cfg.windowCenter - displayWidth / 2 + (displayWidth * i) / 8, cfg.r2));
  const sectorPath = `M ${cx} ${cy} L ${arcPts.map(p => p.join(',')).join(' L ')} Z`;
  const [wlx, wly] = polar(cfg.windowCenter, cfg.r2 + 16);

  const captionText =
    stage === 'plot'
      ? locked
        ? 'BURN PLOTTED · IGNITE WHEN READY'
        : drag
          ? evalNow.valid
            ? 'HOLD STEADY · RELEASE TO LOCK'
            : 'OUT OF TOLERANCE'
          : 'HOLD THE SATELLITE · DRAG TO PLOT BURN'
      : stage === 'approach'
        ? 'TRANSFER BURN UNDERWAY'
        : stage === 'coast'
          ? inWindow
            ? 'INSERTION WINDOW OPEN · FIRE NOW'
            : nearWindow
              ? 'WINDOW APPROACHING · STAND BY'
              : 'COASTING · AWAIT INSERTION WINDOW'
          : 'CIRCULARIZATION COMPLETE';
  const captionColor =
    stage === 'coast'
      ? inWindow
        ? '#c9ff4d'
        : nearWindow
          ? '#ffd166'
          : '#89948d'
      : stage === 'plot' && drag && !evalNow.valid
        ? '#ff5964'
        : locked || stage !== 'plot'
          ? '#c9ff4d'
          : '#89948d';
  const readoutText =
    stage === 'plot'
      ? locked
        ? 'BURN PLOTTED · READY TO IGNITE'
        : drag
          ? `BURN RADIUS ${Math.round(drag.dist)} · TARGET ${Math.round(cfg.r2)}±${cfg.radiusTol}`
          : 'AWAITING BURN PLOT'
      : stage === 'approach'
        ? 'IGNITING TRANSFER BURN'
        : stage === 'coast'
          ? inWindow
            ? 'FIRE CIRCULARIZATION NOW'
            : nearWindow
              ? 'STAND BY · WINDOW APPROACHING'
              : 'COASTING TO INSERTION WINDOW'
          : 'ORBIT STABLE';
  const readoutColor =
    stage === 'coast'
      ? inWindow
        ? 'var(--green)'
        : nearWindow
          ? 'var(--yellow)'
          : '#89948d'
      : stage === 'plot'
        ? locked
          ? 'var(--green)'
          : drag
            ? evalNow.valid
              ? 'var(--green)'
              : 'var(--red)'
            : 'var(--yellow)'
        : 'var(--yellow)';

  return (
    <>
      <Header title="ORBITAL BURN" sub="ORBIT DECAYING · TWO-BURN TRANSFER REQUIRED" />
      <p className="instructions">
        Drag to plot the transfer burn. Too much or too little delta-v misses the target orbit. Click EXECUTE BURN. When the satellite is
        inside the insertion window, click FIRE CIRCULARIZATION BURN. The window narrows as you approach. If you miss it, plot the burn
        again.
      </p>
      <div style={{ display: 'grid', placeItems: 'center', margin: '12px 0' }}>
        <svg
          viewBox="0 0 300 300"
          width="320"
          height="320"
          style={{
            background: '#0c1210',
            border: '1px solid #34403a',
            cursor: stage === 'plot' && !locked ? 'crosshair' : 'default',
            touchAction: 'none',
          }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={release}
          onPointerCancel={release}
        >
          <circle cx={cx} cy={cy} r={cfg.minSafeR} fill="rgba(255,89,100,.12)" stroke="#ff5964" strokeWidth="1" strokeDasharray="2 4" />
          <circle cx={cx} cy={cy} r={cfg.r1} fill="none" stroke="#ff5964" strokeWidth="1.5" strokeDasharray="3 5" opacity=".75" />
          <circle cx={cx} cy={cy} r={cfg.r2} fill="none" stroke="#3b4540" strokeWidth="2" />
          <path
            d={sectorPath}
            fill={inWindow ? 'rgba(201,255,77,.38)' : 'rgba(201,255,77,.14)'}
            stroke={inWindow ? '#c9ff4d' : '#5c6b60'}
            strokeWidth={inWindow ? 2.5 : 1.5}
          />
          <circle cx={cx} cy={cy} r="13" fill="#eef4eb" />
          {pts && (
            <path
              d={pathD(pts)}
              fill="none"
              stroke={locked ? '#c9ff4d' : evalNow.valid ? '#c9ff4d' : '#ff5964'}
              strokeWidth={locked ? 3 : 2}
              strokeDasharray={locked ? undefined : '5 4'}
              style={locked ? { filter: 'drop-shadow(0 0 6px #c9ff4d)' } : {}}
            />
          )}
          {/* the transfer arc draws itself during the burn, then stays: the path flown so far doesn't vanish */}
          {stage !== 'plot' && approachPts && (
            <path
              d={pathD(approachPts)}
              fill="none"
              stroke="#c9ff4d"
              strokeWidth="3"
              pathLength="1"
              strokeDasharray="1"
              strokeDashoffset={stage === 'approach' ? 1 - t : 0}
              style={{ filter: 'drop-shadow(0 0 8px #c9ff4d)' }}
            />
          )}
          {flown && (
            <polyline
              points={trail.map(p => p.join(',')).join(' ')}
              fill="none"
              stroke="#c9ff4d"
              strokeWidth="3"
              style={{ filter: 'drop-shadow(0 0 8px #c9ff4d)' }}
            />
          )}
          <circle
            cx={satNow[0]}
            cy={satNow[1]}
            r="6"
            fill={locked || stage !== 'plot' ? '#c9ff4d' : '#eef4eb'}
            style={locked || stage !== 'plot' ? { filter: 'drop-shadow(0 0 8px #c9ff4d)' } : {}}
          />
          <text x={wlx} y={wly} textAnchor="middle" fill={inWindow ? '#c9ff4d' : '#7f8c84'} fontSize="8">
            INSERTION WINDOW
          </text>
          <text x="150" y="292" textAnchor="middle" fontSize="9" fill={captionColor}>
            {captionText}
          </text>
        </svg>
      </div>
      <div className="readout" style={{ color: readoutColor }}>
        {readoutText}
      </div>
      <div className="legend">
        <span>
          <i className="dot green" />
          INSERTION WINDOW
        </span>
        <span>
          <i className="dot redbg" />
          MIN SAFE ALTITUDE
        </span>
      </div>
      {stage === 'plot' && locked && (
        <div className="actions">
          <button className="action" onClick={() => setStage('approach')}>
            EXECUTE BURN
          </button>
          <button
            className="action"
            onClick={() => {
              setLocked(null);
              setError('');
            }}
          >
            REPLOT
          </button>
        </div>
      )}
      {stage === 'coast' && (
        <div className="actions">
          <button
            className="action"
            style={{
              borderColor: inWindow ? 'var(--green)' : nearWindow ? 'var(--yellow)' : '#39453f',
              color: inWindow ? 'var(--green)' : nearWindow ? 'var(--yellow)' : '#85908a',
            }}
            onClick={fireCircularization}
          >
            FIRE CIRCULARIZATION BURN
          </button>
        </div>
      )}
      {stage === 'success' ? (
        <div className="success">CIRCULARIZATION ACCURATE · ORBIT RAISED INTO HOME PLANE</div>
      ) : error && stage === 'plot' ? (
        <div className="failure">{error}</div>
      ) : null}
    </>
  );
}
