import { useState } from 'react';
import { Header, Result } from '../shared/ui.jsx';
import { allSubsets, shuffle } from '../shared/util.js';

export function Power() {
  const BUS_N = 4;
  const [setup] = useState(() => {
    const build = () => {
      const roleTags = shuffle(['L0', 'L1', 'L2', 'L2']);
      const loadAssign = [[], [], []];
      roleTags.forEach((role, idx) => {
        if (role === 'L0') loadAssign[0].push(idx);
        else if (role === 'L1') loadAssign[1].push(idx);
        else if (role === 'L2') loadAssign[2].push(idx);
      });
      const voltages = Array.from({ length: BUS_N }, () => 3 + Math.floor(Math.random() * 10));
      const loads = loadAssign.map(idxs => {
        const V = idxs.reduce((s, i) => s + voltages[i], 0);
        const targetI = Math.round((1.5 + Math.random() * 2) * 10) / 10;
        const Ri = Math.round((V / targetI) * 10) / 10;
        const trueI = V / Ri,
          tol = 0.25;
        const rangeLo = Math.round((trueI - tol) * 10) / 10,
          rangeHi = Math.round((trueI + tol) * 10) / 10;
        return { idxs, Ri, rangeLo, rangeHi, vLo: Math.round(rangeLo * Ri * 10) / 10, vHi: Math.round(rangeHi * Ri * 10) / 10 };
      });
      return { voltages, loads };
    };
    const subsets = allSubsets(BUS_N);
    const isUnique = cand => {
      for (const load of cand.loads) {
        const correctKey = load.idxs.slice().sort().join(',');
        for (const s of subsets) {
          if (s.slice().sort().join(',') === correctKey) continue;
          const sv = s.reduce((sum, i) => sum + cand.voltages[i], 0);
          const cur = Math.round((sv / load.Ri) * 10) / 10;
          if (cur >= load.rangeLo && cur <= load.rangeHi) return false;
        }
      }
      return true;
    };
    // ~45% of random builds give some load two valid bus combinations; 60 tries let one through almost half the time.
    // 2000 tries brings that to effectively zero and is still instant.
    for (let attempt = 0; attempt < 2000; attempt++) {
      const cand = build();
      if (isUnique(cand)) return cand;
    }
    return build();
  });
  const [staged, setStaged] = useState([]);
  const [usedBuses, setUsedBuses] = useState([]);
  const [connections, setConnections] = useState({});
  const [powered, setPowered] = useState([]);
  const [error, setError] = useState('');
  const busYs = [30, 110, 190, 270],
    loadYs = [30, 140, 250];

  const toggleBus = i => {
    if (usedBuses.includes(i)) return;
    setStaged(s => (s.includes(i) ? s.filter(x => x !== i) : [...s, i]));
    setError('');
  };
  const attemptLoad = li => {
    if (powered.includes(li)) return;
    if (staged.length === 0) {
      setError('SELECT ONE OR MORE BUSES FIRST');
      return;
    }
    const load = setup.loads[li];
    const V = staged.reduce((s, i) => s + setup.voltages[i], 0);
    const current = Math.round((V / load.Ri) * 10) / 10;
    if (current >= load.rangeLo && current <= load.rangeHi) {
      setUsedBuses(u => [...u, ...staged]);
      setConnections(c => ({ ...c, [li]: staged }));
      setPowered(p => [...p, li]);
      setStaged([]);
      setError('');
    } else {
      setError(current > load.rangeHi ? 'OVERCURRENT · TRIP · REDUCE STAGED VOLTAGE' : 'UNDERPOWERED · INSUFFICIENT CURRENT');
      setStaged([]);
    }
  };
  const stagedV = staged.reduce((s, i) => s + setup.voltages[i], 0);
  const ok = powered.length === 3;

  return (
    <>
      <Header title="POWER BUS" sub="VOLTAGE OSCILLATION · MULTI-RAIL FEED REQUIRED" />
      <p className="instructions">
        Stage buses so their combined voltage lands in a load's range, then click the load to commit. Two loads need one bus each; the
        leftover two pair for the third.
      </p>
      <svg
        viewBox="0 0 620 340"
        width="100%"
        style={{ maxWidth: 720, display: 'block', margin: '12px 0', background: '#0c1210', border: '1px solid #34403a' }}
      >
        {Object.entries(connections).flatMap(([li, busIdxs]) =>
          busIdxs.map(bi => {
            const y1 = busYs[bi] + 26,
              y2 = loadYs[+li] + 42;
            return (
              <path
                key={li + '-' + bi}
                d={`M 150 ${y1} C 260 ${y1}, 340 ${y2}, 450 ${y2}`}
                fill="none"
                stroke="#c9ff4d"
                strokeWidth="6"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 6px #c9ff4d)' }}
              />
            );
          }),
        )}
        {setup.voltages.map((v, i) => {
          const stagedOn = staged.includes(i),
            used = usedBuses.includes(i);
          return (
            <g key={'b' + i} onClick={() => toggleBus(i)} style={{ cursor: used ? 'default' : 'pointer' }}>
              <rect
                x="20"
                y={busYs[i]}
                width="130"
                height="52"
                rx="4"
                fill={used ? '#0f1513' : stagedOn ? '#f4f7ef' : '#101614'}
                stroke={used ? '#39453f' : stagedOn ? '#f4f7ef' : '#55b6ff'}
                strokeWidth="3"
              />
              <text x="85" y={busYs[i] + 22} textAnchor="middle" fill={stagedOn ? '#070809' : used ? '#4c5750' : '#89948d'} fontSize="10">
                BUS {i + 1}
                {used ? ' · IN USE' : ''}
              </text>
              <text x="85" y={busYs[i] + 40} textAnchor="middle" fill={stagedOn ? '#070809' : used ? '#4c5750' : '#55b6ff'} fontSize="14">
                {v}V
              </text>
            </g>
          );
        })}
        {setup.loads.map((load, i) => {
          const done = powered.includes(i);
          return (
            <g key={'l' + i} onClick={() => attemptLoad(i)} style={{ cursor: done ? 'default' : 'pointer' }}>
              <rect
                x="450"
                y={loadYs[i]}
                width="150"
                height="84"
                rx="4"
                fill={done ? 'var(--green)' : '#101614'}
                stroke={done ? 'var(--green)' : '#ffd166'}
                strokeWidth="3"
              />
              <text x="525" y={loadYs[i] + 18} textAnchor="middle" fill={done ? '#070809' : '#eef4eb'} fontSize="11">
                LOAD {i + 1}
                {done ? ' ✓' : ''}
              </text>
              <text x="525" y={loadYs[i] + 38} textAnchor="middle" fill={done ? '#070809' : '#c9ff4d'} fontSize="13">
                NEEDS {load.vLo}–{load.vHi}V
              </text>
              <text x="525" y={loadYs[i] + 56} textAnchor="middle" fill={done ? '#070809' : '#89948d'} fontSize="9">
                R {load.Ri}Ω · {load.rangeLo}–{load.rangeHi}A
              </text>
              <text x="525" y={loadYs[i] + 71} textAnchor="middle" fill={done ? '#070809' : '#89948d'} fontSize="8">
                CLICK TO COMMIT
              </text>
            </g>
          );
        })}
        <text x="300" y="320" textAnchor="middle" fill="#849089" fontSize="10">
          SELECT BUS SOCKETS · THEN CLICK A LOAD TO COMMIT
        </text>
      </svg>
      <div className="readout">
        STAGED {stagedV}V · {staged.length} BUS{staged.length === 1 ? '' : 'ES'} SELECTED
      </div>
      <button
        className="action"
        onClick={() => {
          setStaged([]);
          setUsedBuses([]);
          setConnections({});
          setPowered([]);
          setError('');
        }}
      >
        CLEAR SELECTION
      </button>
      <Result ok={ok}>{ok ? 'POWER BUS BALANCED · ALL LOADS NOMINAL' : error || 'Select bus sockets, then commit them to a load.'}</Result>
    </>
  );
}
