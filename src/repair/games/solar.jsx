import { useState, useEffect, useRef } from 'react';
import { Header } from '../shared/ui.jsx';

export function Solar() {
  const CHARGE_RATE = 100 / 9,
    DRAIN_RATE = 100 / 11,
    SUN_R = 108,
    CX = 150,
    CY = 150;
  const ASSETS = '600_solar_assets/';
  const [dir] = useState(() => (Math.random() < 0.5 ? 1 : -1));
  const [speed] = useState(() => 5 + Math.random() * 3);
  const [stars] = useState(() =>
    Array.from({ length: 40 }, () => ({
      x: Math.random() * 300,
      y: Math.random() * 300,
      r: Math.random() * 1.2 + 0.3,
      o: Math.random() * 0.6 + 0.2,
    })),
  );
  // Spawn the array a fair, bounded distance from the sun (20-40°) rather than two fully independent
  // randoms -- otherwise the two can land ~180° apart, which is unrecoverable before the grace period ends.
  const [initial] = useState(() => {
    const sun0 = Math.random() * 360;
    const off = (20 + Math.random() * 20) * (Math.random() < 0.5 ? 1 : -1);
    return { sun0, angle0: (sun0 + off + 360) % 360 };
  });
  const [angle, setAngle] = useState(() => initial.angle0);
  const angleRef = useRef(angle);
  const [sunAngle, setSunAngle] = useState(() => initial.sun0);
  const [charge, setCharge] = useState(0);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  const angDelta = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };
  const polar = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [CX + Math.cos(a) * r, CY - Math.sin(a) * r];
  };
  const [dragging, setDragging] = useState(false);
  const angleFromPointer = e => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 300,
      y = ((e.clientY - box.top) / box.height) * 300;
    return ((Math.atan2(-(y - CY), x - CX) * 180) / Math.PI + 360) % 360;
  };
  const steerStart = e => {
    if (done || failed) return;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const v = angleFromPointer(e);
    angleRef.current = v;
    setAngle(v);
  };
  const steerMove = e => {
    if (!dragging || done || failed) return;
    const v = angleFromPointer(e);
    angleRef.current = v;
    setAngle(v);
  };
  const steerEnd = () => setDragging(false);

  useEffect(() => {
    if (done || failed) return;
    let raf,
      lastTs,
      sunLocal = sunAngle,
      elapsed = 0;
    const step = ts => {
      if (lastTs == null) lastTs = ts;
      const dt = Math.min(0.1, (ts - lastTs) / 1000);
      lastTs = ts;
      elapsed += dt;
      sunLocal = (sunLocal + dir * speed * dt + 360) % 360;
      // Real panels fall off faster than pure Lambert's cosine law once you're well off-axis --
      // surface reflectance rises sharply at high incidence angles (Fresnel losses), so effective
      // output drops steeper than cosine alone. Clamped at 0 past 90° off-boresight.
      const efficiency = Math.pow(Math.max(0, Math.cos((angDelta(angleRef.current, sunLocal) * Math.PI) / 180)), 5);
      setSunAngle(sunLocal);
      setCharge(c => {
        const next = Math.min(100, Math.max(0, c + (CHARGE_RATE * efficiency - DRAIN_RATE * (1 - efficiency)) * dt));
        if (next >= 100) setDone(true);
        else if (next <= 0 && elapsed > 12) setFailed(true); // long enough to actually read the instructions paragraph before failure is even possible
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [done, failed]);

  useEffect(() => {
    if (!done) return;
    if (window.parent !== window) {
      const id = setTimeout(() => window.parent.postMessage({ type: 'repair-complete' }, '*'), 1200);
      return () => clearTimeout(id);
    }
  }, [done]);

  useEffect(() => {
    if (!failed) return;
    if (window.parent !== window) {
      const id = setTimeout(() => window.parent.postMessage({ type: 'repair-failed' }, '*'), 1200);
      return () => clearTimeout(id);
    }
  }, [failed]);

  const offset = angDelta(angle, sunAngle);
  const efficiency = Math.pow(Math.max(0, Math.cos((offset * Math.PI) / 180)), 5);
  const lerp = (a, b, t) => a + (b - a) * t;
  const glowColor = `#${[lerp(255, 201, efficiency), lerp(89, 255, efficiency), lerp(100, 77, efficiency)].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const [sx, sy] = polar(sunAngle, SUN_R);
  const SCID_W = 150,
    SCID_H = (SCID_W * 644) / 1490,
    SUN_W = 70,
    SUN_H = (SUN_W * 345) / 520;
  const [bx, by] = polar(angle, 118);

  return (
    <>
      <Header title="SOLAR ALIGNMENT" sub="ARRAY OFFLINE · BATTERY DEPLETED" />
      <p className="instructions">
        Drag the dial to steer toward the sun. Output peaks dead-on and falls off sharply the further you drift.
      </p>
      <div style={{ display: 'grid', placeItems: 'center', margin: '12px 0' }}>
        <svg
          viewBox="0 0 300 300"
          width="320"
          height="320"
          style={{
            background: 'radial-gradient(circle,#0e1614,#070809 70%)',
            border: '1px solid #34403a',
            cursor: done || failed ? 'default' : 'grab',
            touchAction: 'none',
          }}
          onPointerDown={steerStart}
          onPointerMove={steerMove}
          onPointerUp={steerEnd}
          onPointerCancel={steerEnd}
        >
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
          ))}
          <circle cx={CX} cy={CY} r={SUN_R} fill="none" stroke="#242c29" strokeDasharray="3 5" />
          <line
            x1={CX}
            y1={CY}
            x2={bx}
            y2={by}
            stroke={glowColor}
            strokeWidth={1.5 + efficiency * 2}
            opacity={0.35 + efficiency * 0.5}
            style={{ filter: efficiency > 0.1 ? `drop-shadow(0 0 ${4 + efficiency * 8}px ${glowColor})` : 'none' }}
          />
          <image
            href={ASSETS + 'sun.png'}
            x={sx - SUN_W / 2}
            y={sy - SUN_H / 2}
            width={SUN_W}
            height={SUN_H}
            style={{
              filter: `brightness(${1 + efficiency * 0.45}) drop-shadow(0 0 ${efficiency * 18}px rgba(255,180,60,.8))`,
              transition: 'filter .15s',
            }}
          />
          <image
            href={ASSETS + 'satellite.png'}
            x={CX - SCID_W / 2}
            y={CY - SCID_H / 2}
            width={SCID_W}
            height={SCID_H}
            transform={`rotate(${90 - angle} ${CX} ${CY})`}
            style={{
              filter: `brightness(${1 + efficiency * 0.3}) drop-shadow(0 0 ${efficiency * 10}px ${glowColor})`,
              transition: 'filter .15s',
            }}
          />
          <text x="150" y="292" textAnchor="middle" fontSize="9" fill={failed ? '#ff5964' : glowColor}>
            {done ? 'ARRAY CHARGED' : failed ? 'BATTERY DEPLETED' : dragging ? 'STEERING' : `OUTPUT ${Math.round(efficiency * 100)}%`}
          </text>
        </svg>
      </div>
      <div className="readout" style={{ color: failed ? 'var(--red)' : glowColor }}>
        BATTERY {Math.round(charge)}% · OUTPUT {Math.round(efficiency * 100)}% · OFFSET {Math.round(offset)}°
      </div>
      <div className="bar">
        <i style={{ width: `${charge}%`, background: failed ? 'var(--red)' : glowColor }} />
      </div>
      <div className="legend">
        <span>
          <i className="dot yellowbg" />
          PANEL OUTPUT
        </span>
        <span>
          <i className="dot green" />
          CHARGING
        </span>
      </div>
      {done ? (
        <div className="success">ARRAY CHARGED · BATTERY ONLINE</div>
      ) : failed ? (
        <div className="failure">BATTERY FULLY DEPLETED · ARRAY OFFLINE · SATELLITE LOST</div>
      ) : null}
    </>
  );
}
