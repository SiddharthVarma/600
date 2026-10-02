import { useState } from 'react';
import { Header, Result } from '../shared/ui.jsx';

function buildThermalLayout(N, safes) {
  const nodes = { CORE: [35, 120], PUMP: [105, 120], PURGE: [105, 42] };
  const edges = [
    ['CORE', 'PUMP'],
    ['PUMP', 'PURGE'],
  ];
  const temps = {};
  const target = ['CORE', 'PUMP'];
  const hot = () => Math.round(95 + Math.random() * 45),
    cool = () => Math.round(18 + Math.random() * 16);
  let anchor = 'PUMP',
    x = 105;
  for (let i = 1; i <= N; i++) {
    x += i === 1 ? 80 : 70;
    const vA = `VALVE A${i}`,
      vB = `VALVE B${i}`;
    nodes[vA] = [x, 62];
    nodes[vB] = [x, 178];
    edges.push([anchor, vA], [anchor, vB]);
    const safe = safes[i - 1];
    temps[vA] = safe === 'A' ? cool() : hot();
    temps[vB] = safe === 'B' ? cool() : hot();
    const safeNode = safe === 'A' ? vA : vB;
    if (i < N) {
      x += 70;
      const m = N > 2 ? `MANIFOLD ${i}` : 'MANIFOLD';
      nodes[m] = [x, 120];
      edges.push([vA, m], [vB, m]);
      target.push(safeNode, m);
      anchor = m;
    } else {
      x += 50;
      nodes.RADIATOR = [x, 120];
      edges.push([vA, 'RADIATOR'], [vB, 'RADIATOR']);
      target.push(safeNode, 'RADIATOR');
    }
  }
  return { nodes, edges, temps, target, width: x + 25 };
}

export function Thermal() {
  const [junctions] = useState(() => 2 + Math.floor(Math.random() * 2));
  const [safes] = useState(() => Array.from({ length: junctions }, () => (Math.random() < 0.5 ? 'A' : 'B')));
  const [layout] = useState(() => buildThermalLayout(junctions, safes));
  const { nodes, edges, temps, target, width } = layout;
  const [path, setPath] = useState([]),
    [dragging, setDragging] = useState(false),
    [error, setError] = useState('');
  const temp = 78 - path.length * 5,
    pressure = 42 + path.length * 9,
    ok = path.length === target.length;
  const follow = e => {
    if (!dragging || ok) return;
    const box = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - box.left) / box.width) * width,
      y = ((e.clientY - box.top) / box.height) * 240;
    const node = Object.keys(nodes).find(n => Math.hypot(nodes[n][0] - x, nodes[n][1] - y) < 23);
    if (!node || path.includes(node)) return;
    if (node === target[path.length]) {
      setPath(p => [...p, node]);
      setError('');
    } else {
      setPath([]);
      setDragging(false);
      setError(node === 'PURGE' ? 'DEAD END · PURGE LINE ISOLATED FROM RADIATOR LOOP' : 'FLOW LOST · COOLANT ENTERED HOT BYPASS');
    }
  };
  const start = e => {
    setPath([]);
    setError('');
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const box = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - box.left) / box.width) * width,
      y = ((e.clientY - box.top) / box.height) * 240;
    if (Math.hypot(35 - x, 120 - y) < 28) setPath(['CORE']);
    else {
      setDragging(false);
      setError('START AT THE HOT CORE');
    }
  };
  const onPath = (a, b) => path.includes(a) && path.includes(b) && Math.abs(path.indexOf(a) - path.indexOf(b)) === 1;
  const line = (a, b) => {
    const [x1, y1] = nodes[a],
      [x2, y2] = nodes[b],
      on = onPath(a, b);
    return (
      <line
        key={a + b}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={on ? '#c9ff4d' : '#34403a'}
        strokeWidth={on ? 7 : 4}
        strokeLinecap="round"
      />
    );
  };
  return (
    <>
      <Header title="THERMAL ROUTING" sub={`CORE ${temp}°C · COOLANT ${pressure} kPa`} />
      <p className="instructions">
        Drag from the core through the pump, routing the cooler valve at each of the {junctions} junctions — the hot side flashes in the
        bypass. The purge line is a dead end.
      </p>
      <svg
        viewBox={`0 0 ${width} 240`}
        width="100%"
        style={{
          maxWidth: 760,
          display: 'block',
          margin: '12px 0',
          background: '#0c1210',
          border: '1px solid #34403a',
          cursor: dragging ? 'grabbing' : 'crosshair',
          touchAction: 'none',
        }}
        onPointerDown={start}
        onPointerMove={follow}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {edges.map(([a, b]) => line(a, b))}
        {Object.entries(nodes).map(([n, [x, y]]) => {
          const done = path.includes(n),
            isValve = n.startsWith('VALVE'),
            fontSize = n.length > 8 ? 6 : isValve ? 7 : 8;
          return (
            <g key={n}>
              <circle
                cx={x}
                cy={y}
                r="20"
                fill={done ? '#172714' : n === 'CORE' ? '#241512' : '#141d1a'}
                stroke={done ? '#c9ff4d' : '#5c6b64'}
                strokeWidth="3"
              />
              <text x={x} y={y + 3} textAnchor="middle" fill="#eef4eb" fontSize={fontSize}>
                {n}
              </text>
              {isValve && (
                <text x={x} y={y + 34} textAnchor="middle" fill="#c7d1cb" fontSize="9">
                  {temps[n]}°C
                </text>
              )}
            </g>
          );
        })}
        <text x={width / 2} y="222" textAnchor="middle" fill={dragging ? '#c9ff4d' : '#89948d'} fontSize="10">
          {dragging ? 'DRAGGING COOLANT FLOW' : 'HOLD ON CORE · TRACE THE SAFE ROUTE'}
        </text>
      </svg>
      <div className="readout" style={{ color: temp > 70 ? 'var(--red)' : temp > 55 ? 'var(--yellow)' : 'var(--green)' }}>
        CORE {temp}°C · PRESSURE {pressure} kPa
      </div>
      <button
        className="action"
        onClick={() => {
          setPath([]);
          setError('');
        }}
      >
        RESET ROUTE
      </button>
      <Result ok={ok}>
        {ok ? 'THERMAL LOOP STABLE · COOLANT FLOW CONFIRMED' : error || 'Drag a continuous coolant path through the system.'}
      </Result>
    </>
  );
}
