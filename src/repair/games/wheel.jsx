import { useState } from 'react';
import { Header, Result } from '../shared/ui.jsx';

export function ReactionWheel() {
  const ASSETS = '600_wheel_assets/';
  const WHEEL_ANGLES = [45, 135, 225, 315];
  const WHEEL_ASSETS = [
    { file: 'wheel_nominal.png', w: 294, h: 340 },
    { file: 'wheel_failed.png', w: 303, h: 340 },
  ];
  const LEVELS = [0, 0.25, 0.5, 0.75, 1];
  const angleDelta = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };
  const ANGLE_TOL = 0.5,
    MAG_TOL = () => 0.01;
  const vecOf = lv =>
    WHEEL_ANGLES.reduce(
      (acc, ang, i) => {
        const p = lv[i] || 0;
        if (!p) return acc;
        const r = (ang * Math.PI) / 180;
        return { x: acc.x + Math.cos(r) * p, y: acc.y + Math.sin(r) * p };
      },
      { x: 0, y: 0 },
    );
  const allAssignments = avail => {
    let res = [{}];
    avail.forEach(i => {
      const next = [];
      res.forEach(base => LEVELS.forEach(p => next.push({ ...base, [i]: p })));
      res = next;
    });
    return res.filter(lv => Object.values(lv).some(p => p > 0));
  };
  const keyOf = (lv, avail) => avail.map(i => lv[i] || 0).join(',');

  const [setup] = useState(() => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const failedIdx = Math.floor(Math.random() * 4);
      const available = [0, 1, 2, 3].filter(i => i !== failedIdx);
      const assignments = allAssignments(available);
      const target = assignments[Math.floor(Math.random() * assignments.length)];
      const tv = vecOf(target);
      const mag = Math.hypot(tv.x, tv.y);
      if (mag < 0.5) continue;
      const targetAngle = ((Math.atan2(tv.y, tv.x) * 180) / Math.PI + 360) % 360;
      const correctKey = keyOf(target, available);
      let unique = true;
      for (const a of assignments) {
        if (keyOf(a, available) === correctKey) continue;
        const v = vecOf(a),
          m = Math.hypot(v.x, v.y),
          ang = ((Math.atan2(v.y, v.x) * 180) / Math.PI + 360) % 360;
        if (Math.abs(m - mag) <= MAG_TOL(mag) && angleDelta(ang, targetAngle) <= ANGLE_TOL) {
          unique = false;
          break;
        }
      }
      if (unique) return { failedIdx, available, mag, targetAngle };
    }
    const failedIdx = 0,
      available = [1, 2, 3],
      tv = vecOf({ 1: 1, 2: 0.5 });
    return { failedIdx, available, mag: Math.hypot(tv.x, tv.y), targetAngle: ((Math.atan2(tv.y, tv.x) * 180) / Math.PI + 360) % 360 };
  });

  const [levels, setLevels] = useState({});
  const cycle = i => {
    if (i === setup.failedIdx) return;
    setLevels(lv => {
      const cur = lv[i] || 0,
        idx = LEVELS.indexOf(cur);
      return { ...lv, [i]: LEVELS[(idx + 1) % LEVELS.length] };
    });
  };

  const resultant = vecOf(levels);
  const resMag = Math.hypot(resultant.x, resultant.y);
  const resAngle = resMag > 0.01 ? ((Math.atan2(resultant.y, resultant.x) * 180) / Math.PI + 360) % 360 : 0;
  const anySelected = Object.values(levels).some(p => p > 0);
  const closeEnough =
    anySelected && Math.abs(resMag - setup.mag) <= MAG_TOL(setup.mag) && angleDelta(resAngle, setup.targetAngle) <= ANGLE_TOL;

  const CX = 150,
    CY = 150;
  const polar = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [CX + Math.cos(a) * r, CY - Math.sin(a) * r];
  };
  const arrow = (angleDeg, length, color) => {
    if (length < 4) return null;
    const [x2, y2] = polar(angleDeg, length);
    const [h1x, h1y] = polar(angleDeg + 150, 10),
      [h2x, h2y] = polar(angleDeg - 150, 10);
    return (
      <g>
        <line x1={CX} y1={CY} x2={x2} y2={y2} stroke={color} strokeWidth="4" strokeLinecap="round" />
        <polygon points={`${x2},${y2} ${x2 + h1x - CX},${y2 + h1y - CY} ${x2 + h2x - CX},${y2 + h2y - CY}`} fill={color} />
      </g>
    );
  };
  const driftAngle = (setup.targetAngle + 180) % 360;

  return (
    <>
      <Header title="REACTION WHEEL FAULT" sub={`WHEEL ${setup.failedIdx + 1} OFFLINE · UNCOMMANDED TUMBLE`} />
      <p className="instructions">
        One wheel has failed. Cycle each working wheel's speed until the combined torque cancels the drift. Direction and magnitude both
        matter.
      </p>
      <div style={{ display: 'grid', placeItems: 'center', margin: '12px 0' }}>
        <svg viewBox="0 0 300 300" width="320" height="320" style={{ background: '#0c1210', border: '1px solid #34403a' }}>
          <circle cx={CX} cy={CY} r="104" fill="none" stroke="#242c29" strokeDasharray="3 5" />
          {arrow(driftAngle, 72, '#ff5964')}
          {resMag > 0.05 && arrow(resAngle, Math.min(56, 22 + resMag * 38), closeEnough ? '#c9ff4d' : '#ffd166')}
          <circle cx={CX} cy={CY} r="16" fill="#141d1a" stroke="#5c6b64" strokeWidth="3" />
          {WHEEL_ANGLES.map((ang, i) => {
            const failed = i === setup.failedIdx,
              p = levels[i] || 0;
            const asset = WHEEL_ASSETS[failed ? 1 : 0];
            const dispH = 64,
              dispW = (dispH * asset.w) / asset.h;
            const [wx, wy] = polar(ang, 104);
            const ringColor = p === 1 ? '#c9ff4d' : p === 0.75 ? '#d9f75f' : p === 0.5 ? '#ffd166' : p === 0.25 ? '#ff9f5a' : null;
            const ringFill =
              p === 1
                ? 'rgba(201,255,77,.22)'
                : p === 0.75
                  ? 'rgba(217,247,95,.2)'
                  : p === 0.5
                    ? 'rgba(255,209,102,.16)'
                    : p === 0.25
                      ? 'rgba(255,159,90,.14)'
                      : null;
            return (
              <g key={i} onClick={() => cycle(i)} style={{ cursor: failed ? 'default' : 'pointer' }}>
                {ringColor && <circle cx={wx} cy={wy} r={dispH * 0.62} fill={ringFill} stroke={ringColor} strokeWidth="2" />}
                <image href={ASSETS + asset.file} x={wx - dispW / 2} y={wy - dispH / 2} width={dispW} height={dispH} />
                {!failed && (
                  <text x={wx} y={wy + dispH / 2 + 16} textAnchor="middle" fontSize="9" fill={ringColor || '#5c6b64'}>
                    {p === 1 ? '100%' : p === 0.75 ? '75%' : p === 0.5 ? '50%' : p === 0.25 ? '25%' : 'OFF'}
                  </text>
                )}
              </g>
            );
          })}
          <text x="150" y="292" textAnchor="middle" fontSize="9" fill={closeEnough ? '#c9ff4d' : '#89948d'}>
            {closeEnough ? 'CORRECTION ALIGNED · READY TO FIRE' : 'CYCLE WHEEL SPEED · MATCH DIRECTION AND MAGNITUDE'}
          </text>
        </svg>
      </div>
      <div className="legend">
        <span>
          <i className="dot redbg" />
          DRIFT VECTOR
        </span>
        <span>
          <i className="dot green" />
          COMMANDED CORRECTION
        </span>
      </div>
      <Result ok={closeEnough}>
        {closeEnough ? 'RESIDUAL DRIFT NULLED · ATTITUDE STABLE' : 'Toggle wheels until the correction vector cancels the drift.'}
      </Result>
    </>
  );
}
