import { useState, useEffect, useRef } from 'react';
import { Header } from '../shared/ui.jsx';

export function Debris() {
  const DURATION = 30,
    HIT_LIMIT = 2;
  const W = 300,
    H = 400,
    SHIP_Y = 362,
    SHIP_W = 64,
    SHIP_H = (SHIP_W * 644) / 1490,
    SHIP_SPEED = 190,
    MARGIN = SHIP_W / 2 + 4;
  const DEBRIS_TYPES = {
    bolt: { file: 'bolt.png', w: 18, h: 27, vy: [190, 240], weight: 3 },
    nut: { file: 'nut.png', w: 22, h: 20, vy: [180, 220], weight: 3 },
    hull: { file: 'scid_body.png', w: 26, h: 37, vy: [75, 105], weight: 2 },
    panel: { file: 'panel_body.png', w: 34, h: 18, vy: [70, 95], weight: 2 },
  };
  const ASSETS = '600_debris_assets/';
  const SHIP_ASSET = '600_solar_assets/satellite.png';
  const params = new URLSearchParams(location.search);
  const [sats] = useState(() => {
    const ids = (params.get('sats') || '').split(',').filter(Boolean);
    return ids.length ? ids : Array.from({ length: 10 }, () => 100 + Math.floor(Math.random() * 900));
  });

  const [shipX, setShipX] = useState(W / 2);
  const [debris, setDebris] = useState([]);
  const [hits, setHits] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [phase, setPhase] = useState('run'); // run | won | lost
  const [flash, setFlash] = useState(false);
  const heldRef = useRef(0); // -1 left, 1 right, 0 none
  const shipXRef = useRef(shipX);
  const debrisRef = useRef([]);
  const hitsRef = useRef(0);
  const idRef = useRef(0);

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
    let raf,
      startTs,
      lastT = 0,
      lastSpawn = 0,
      nextSpawn = 220;
    const step = ts => {
      if (!startTs) startTs = ts;
      const elapsed = (ts - startTs) / 1000;
      const dt = Math.min(0.05, elapsed - lastT);
      lastT = elapsed;

      shipXRef.current = Math.max(MARGIN, Math.min(W - MARGIN, shipXRef.current + heldRef.current * SHIP_SPEED * dt));
      setShipX(shipXRef.current);

      if ((elapsed - lastSpawn) * 1000 >= nextSpawn) {
        lastSpawn = elapsed;
        nextSpawn = 250 + Math.random() * 250;
        const pool = Object.entries(DEBRIS_TYPES).flatMap(([k, v]) => Array(v.weight).fill(k));
        const type = pool[Math.floor(Math.random() * pool.length)];
        const t = DEBRIS_TYPES[type];
        idRef.current += 1;
        debrisRef.current = [
          ...debrisRef.current,
          {
            id: idRef.current,
            type,
            x: MARGIN + Math.random() * (W - MARGIN * 2),
            y: -30,
            vy: t.vy[0] + Math.random() * (t.vy[1] - t.vy[0]),
            rot: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 140,
          },
        ];
      }

      let hitThisFrame = false;
      debrisRef.current = debrisRef.current
        .map(d => ({ ...d, y: d.y + d.vy * dt, rot: d.rot + d.rotSpeed * dt }))
        .filter(d => {
          if (d.y > H + 40) return false;
          const t = DEBRIS_TYPES[d.type];
          const dw = t.w * 0.9,
            dh = t.h * 0.9;
          const overlapX = Math.abs(d.x - shipXRef.current) < dw / 2 + SHIP_W / 3.2;
          const overlapY = Math.abs(d.y - SHIP_Y) < dh / 2 + SHIP_H / 3.2;
          if (overlapX && overlapY) {
            hitThisFrame = true;
            return false;
          }
          return true;
        });
      setDebris(debrisRef.current);
      if (hitThisFrame) {
        hitsRef.current += 1;
        setHits(hitsRef.current);
        if (hitsRef.current >= HIT_LIMIT) {
          setFlash(true);
          setPhase('impact'); // freeze-frame: stop the loop here, hold on the moment of impact
          return;
        }
        setFlash(true);
        setTimeout(() => setFlash(false), 220);
      }

      const remaining = Math.max(0, DURATION - elapsed);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0) {
        setPhase('won');
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'impact') return;
    const id = setTimeout(() => setPhase('lost'), 650); // hold the freeze-frame before revealing the cascade summary
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'won' && phase !== 'lost') return;
    if (window.parent !== window) {
      const id = setTimeout(
        () => window.parent.postMessage({ type: 'debris-resolved', survived: phase === 'won' }, '*'),
        phase === 'won' ? 1300 : 2200,
      );
      return () => clearTimeout(id);
    }
  }, [phase]);

  const nudge = dir => {
    heldRef.current = dir;
  };
  const release = () => {
    heldRef.current = 0;
  };

  return (
    <>
      <Header title="DEBRIS FIELD" sub={`COLLISION AVOIDANCE · ${timeLeft}s REMAINING · ${hits}/${HIT_LIMIT} IMPACTS`} />
      <p className="instructions">
        A rival satellite broke apart — wreckage is crossing our plane, risking a cascade across nearby satellites. Use ← → to dodge debris.
      </p>
      <div style={{ display: 'grid', placeItems: 'center', margin: '10px 0', position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={360}
          style={{ maxWidth: 340, display: 'block', background: '#05080a', border: '1px solid #34403a', touchAction: 'none' }}
        >
          {debris.map(d => {
            const t = DEBRIS_TYPES[d.type];
            return (
              <image
                key={d.id}
                href={ASSETS + t.file}
                x={d.x - t.w / 2}
                y={d.y - t.h / 2}
                width={t.w}
                height={t.h}
                transform={`rotate(${d.rot} ${d.x} ${d.y})`}
              />
            );
          })}
          <image
            href={SHIP_ASSET}
            x={shipX - SHIP_W / 2}
            y={SHIP_Y - SHIP_H / 2}
            width={SHIP_W}
            height={SHIP_H}
            style={{ filter: flash ? 'drop-shadow(0 0 8px #ff5964)' : 'drop-shadow(0 0 4px #c9ff4d)' }}
          />
          {flash && <rect x="0" y="0" width={W} height={H} fill="rgba(255,89,100,.28)" />}
          <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#89948d">
            {phase === 'run'
              ? 'HOLD ← → TO MANEUVER'
              : phase === 'won'
                ? 'FORMATION CLEAR'
                : phase === 'impact'
                  ? 'IMPACT DETECTED'
                  : 'CASCADE TRIGGERED'}
          </text>
        </svg>
      </div>
      <div className="actions">
        <button
          className="action"
          onPointerDown={() => nudge(-1)}
          onPointerUp={release}
          onPointerLeave={release}
          disabled={phase !== 'run'}
        >
          ◀ LEFT
        </button>
        <button className="action" onPointerDown={() => nudge(1)} onPointerUp={release} onPointerLeave={release} disabled={phase !== 'run'}>
          RIGHT ▶
        </button>
      </div>
      {phase === 'won' && <div className="success">DEBRIS FIELD CLEARED · {sats.length} SATELLITES HELD FORMATION</div>}
      {phase === 'lost' && <div className="failure">DEBRIS NOT OUT-MANEUVERED · {sats.length} SATELLITES LOST</div>}
    </>
  );
}
