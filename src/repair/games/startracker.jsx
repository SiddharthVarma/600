import { useState, useEffect, useRef } from 'react';
import { Execute, LabLayout, Status } from '../shared/layout.jsx';
import { shuffle } from '../shared/util.js';

function genStarSetup() {
  const N = 7,
    TRUE = 6;
  const cells = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push([c, r]);
  const chosen = shuffle(cells).slice(0, TRUE);
  const trueStars = chosen.map(([c, r], i) => ({ id: 't' + i, col: c, row: r, bright: Math.random() < 0.5 }));
  const pool = shuffle(trueStars.map(t => ({ id: t.id, bright: t.bright, real: true })));
  return { N, trueStars, pool };
}

export function StarTracker() {
  const CELL = 38;
  const [setup] = useState(genStarSetup);
  const { N, trueStars, pool } = setup;
  const SIZE = N * CELL;
  const [placed, setPlaced] = useState({});
  const [strikes, setStrikes] = useState(0);
  const [drag, setDrag] = useState(null);
  const [flash, setFlash] = useState(null);
  const gridRef = useRef();
  const dragRef = useRef(null);
  const ok = Object.keys(placed).length === trueStars.length;
  const placedIds = new Set(Object.values(placed));
  const onDown = (e, star) => {
    if (ok) return;
    const d = { id: star.id, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 };
    dragRef.current = d;
    setDrag(d);
  };
  useEffect(() => {
    if (!drag) return;
    const move = e => {
      const d = { ...dragRef.current, dx: e.clientX - dragRef.current.startX, dy: e.clientY - dragRef.current.startY };
      dragRef.current = d;
      setDrag(d);
    };
    const up = e => {
      const cur = dragRef.current;
      if (!cur) return;
      const star = pool.find(s => s.id === cur.id);
      const box = gridRef.current.getBoundingClientRect();
      const x = e.clientX - box.left,
        y = e.clientY - box.top;
      const inGrid = x >= -6 && y >= -6 && x < SIZE + 6 && y < SIZE + 6;
      const col = Math.floor(x / CELL),
        row = Math.floor(y / CELL),
        key = `${col},${row}`;
      const target = trueStars.find(t => t.col === col && t.row === row);
      const match = inGrid && star.real && target && target.bright === star.bright && !placed[key];
      if (match) {
        setPlaced(p => ({ ...p, [key]: star.id }));
      } else if (inGrid) {
        setFlash(star.id);
        setTimeout(() => setFlash(null), 380);
        setStrikes(s => {
          const n = s + 1;
          if (n >= 3) {
            setPlaced({});
            return 0;
          }
          return n;
        });
      }
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag && drag.id]);
  const view = (
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#7b8580', marginBottom: 8 }}>CATALOG REF · SECTOR 14-B</div>
          <div
            style={{
              width: N * 14,
              height: N * 14,
              position: 'relative',
              background: '#0d1211',
              border: '1px solid #27302d',
              backgroundImage: 'linear-gradient(#1a221e 1px,transparent 1px),linear-gradient(90deg,#1a221e 1px,transparent 1px)',
              backgroundSize: '14px 14px',
            }}
          >
            {trueStars.map(t => (
              <div
                key={t.id}
                style={{
                  position: 'absolute',
                  left: t.col * 14 + 7,
                  top: t.row * 14 + 7,
                  width: t.bright ? 7 : 4,
                  height: t.bright ? 7 : 4,
                  borderRadius: '50%',
                  background: 'var(--green)',
                  opacity: t.bright ? 1 : 0.55,
                  boxShadow: t.bright ? '0 0 6px var(--green)' : 'none',
                  transform: 'translate(-50%,-50%)',
                }}
              />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#7b8580', marginBottom: 8 }}>SENSOR GRID</div>
          <div
            ref={gridRef}
            style={{
              width: SIZE,
              height: SIZE,
              position: 'relative',
              background: '#0d1211',
              border: '1px solid #39453f',
              backgroundImage: 'linear-gradient(#1c2521 1px,transparent 1px),linear-gradient(90deg,#1c2521 1px,transparent 1px)',
              backgroundSize: `${CELL}px ${CELL}px`,
              touchAction: 'none',
            }}
          >
            {Object.entries(placed).map(([key]) => {
              const [c, r] = key.split(',').map(Number);
              const t = trueStars.find(s => s.col === c && s.row === r);
              return (
                <div
                  key={key}
                  style={{
                    position: 'absolute',
                    left: c * CELL + CELL / 2,
                    top: r * CELL + CELL / 2,
                    width: t.bright ? 15 : 9,
                    height: t.bright ? 15 : 9,
                    borderRadius: '50%',
                    background: 'var(--green)',
                    boxShadow: '0 0 12px var(--green)',
                    transform: 'translate(-50%,-50%)',
                  }}
                />
              );
            })}
          </div>
        </div>
        {/* a narrow column beside the grid: two candidates to a row */}
        <div style={{ width: 130 }}>
          <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#7b8580', marginBottom: 8 }}>CANDIDATE RACK</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, minHeight: 150 }}>
            {pool
              .filter(s => !placedIds.has(s.id))
              .map(s => {
                const dragging = drag && drag.id === s.id;
                const style = {
                  width: 40,
                  height: 40,
                  border: '1px solid ' + (flash === s.id ? 'var(--red)' : '#39453f'),
                  background: '#0d1211',
                  position: 'relative',
                  cursor: 'grab',
                  touchAction: 'none',
                  transition: dragging ? 'none' : 'border-color .2s',
                  zIndex: dragging ? 5 : 1,
                };
                if (dragging) ((style.transform = `translate(${drag.dx}px,${drag.dy}px)`), (style.cursor = 'grabbing'));
                return (
                  <div key={s.id} onPointerDown={e => onDown(e, s)} style={style}>
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: s.bright ? 11 : 6,
                        height: s.bright ? 11 : 6,
                        borderRadius: '50%',
                        background: flash === s.id ? 'var(--red)' : 'var(--green)',
                        opacity: s.bright ? 1 : 0.55,
                        boxShadow: s.bright ? `0 0 7px ${flash === s.id ? 'var(--red)' : 'var(--green)'}` : 'none',
                        transform: 'translate(-50%,-50%)',
                      }}
                    />
                  </div>
                );
              })}
          </div>
        </div>
      </div>
  );
  return (
    <LabLayout
      eyebrow="Critical subsystem interaction"
      title="STAR TRACKER LOCK"
      signal="LOST LOCK · CATALOG MATCH REQUIRED"
      view={view}
      boxed
      brief="Drag stars from the rack to copy the catalog pattern: position and brightness."
      live={[['Strikes', `${strikes} / 3`, strikes ? 'var(--red)' : undefined]]}
      about="A star tracker works out which way the satellite faces by matching the stars it sees to a catalog."
      aboutLabel="About this fault"
      left={<Status>Match the catalog reference exactly to reacquire lock.</Status>}
      right={<Execute ready={ok} />}
      result={ok && <Status tone="ok">PATTERN MATCHED · LOCK REACQUIRED</Status>}
    />
  );
}
