import { useState, useEffect, useRef } from 'react';
import { Header } from '../shared/ui.jsx';
import { shuffle, usePhone } from '../shared/util.js';

const PROCESS_POOL = [
  'PACKET RETRY',
  'TELEMETRY CACHE',
  'IMAGE PIPELINE',
  'LOG AGGREGATOR',
  'PAYLOAD INDEXER',
  'MEMORY SCRUBBER',
  'ATTITUDE SOLVER',
  'MOTION SCHEDULE',
  'STAR TRACKER FEED',
  'DOWNLINK BUFFER',
  'EPHEMERIS CALCULATOR',
  'FAULT MONITOR',
];

export function Process() {
  const N = 10,
    RUNAWAY = 3,
    LEGIT = 2,
    CLIMB = 0.25; // CLIMB: CPU % per second an unpurged runaway gains
  const pad = id => String(id).padStart(3, '0');
  const [setup] = useState(() => {
    const procs = shuffle(PROCESS_POOL).map(p => p.toLowerCase().replace(/ /g, '_'));
    const scheduled = procs.slice(0, 2),
      unscheduled = procs.slice(2);
    const own = parseInt(new URLSearchParams(location.search).get('sat'), 10);
    const ids = new Set(Number.isFinite(own) ? [own] : []);
    while (ids.size < N) ids.add(1 + Math.floor(Math.random() * 600));
    // the satellite this repair was opened from comes first, so it is always one of the runaways
    const rows = [...ids]
      .map((id, i) => {
        const kind = i < RUNAWAY ? 'runaway' : i < RUNAWAY + LEGIT ? 'legit' : 'normal';
        return {
          id,
          kind,
          proc: kind === 'legit' ? scheduled[i % 2] : unscheduled[Math.floor(Math.random() * unscheduled.length)],
          cpu0: kind === 'runaway' ? 86 + Math.random() * 5 : kind === 'legit' ? 88 + Math.random() * 8 : 20 + Math.random() * 45,
          seed: Math.random() * Math.PI * 2,
        };
      })
      .sort((a, b) => a.id - b.id);
    return { rows, scheduled };
  });
  const [cpus, setCpus] = useState(() => setup.rows.map(r => r.cpu0));
  const purgedRef = useRef(new Set());
  const [purged, setPurged] = useState([]);
  const [cmd, setCmd] = useState('');
  const [out, setOut] = useState([]);
  const [phase, setPhase] = useState('run'); // run | won | lost
  const [failMsg, setFailMsg] = useState('');

  useEffect(() => {
    if (phase !== 'run') return;
    let raf,
      last = null,
      t = 0;
    const step = ts => {
      const dt = last == null ? 0 : Math.min(0.05, (ts - last) / 1000);
      last = ts;
      t += dt; // simulated time: a hidden tab pauses it
      const next = setup.rows.map(r =>
        purgedRef.current.has(r.id)
          ? 3 + Math.sin(t * 2 + r.seed)
          : r.kind === 'runaway'
            ? r.cpu0 + CLIMB * t + Math.sin(t * 1.7 + r.seed) * 0.6
            : r.cpu0 + Math.sin(t * 1.1 + r.seed) * 2.5,
      );
      setCpus(next);
      const saturated = setup.rows.find((r, i) => r.kind === 'runaway' && !purgedRef.current.has(r.id) && next[i] >= 100);
      if (saturated) {
        setFailMsg(`SAT ${pad(saturated.id)} · CPU SATURATED · WATCHDOG RESET`);
        setPhase('lost');
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase === 'run' || window.parent === window) return;
    const id = setTimeout(
      () => window.parent.postMessage({ type: phase === 'won' ? 'repair-complete' : 'repair-failed' }, '*'),
      phase === 'won' ? 1200 : 2200,
    );
    return () => clearTimeout(id);
  }, [phase]);

  const typedIds = c => [
    ...new Set(
      c
        .split(/[\s,]+/)
        .map(x => parseInt(x, 10))
        .filter(Number.isFinite),
    ),
  ];
  const toggle = id => {
    if (phase !== 'run' || purgedRef.current.has(id)) return;
    setCmd(c => {
      const list = typedIds(c);
      return (list.includes(id) ? list.filter(x => x !== id) : [...list, id]).join(' ');
    });
  };
  const purge = () => {
    if (phase !== 'run') return;
    const wanted = typedIds(cmd);
    if (!wanted.length) {
      setOut([['usage: purge <sat id> …', 'muted']]);
      return;
    }
    const lines = [],
      found = wanted.map(id => setup.rows.find(r => r.id === id)).filter(Boolean);
    wanted.filter(id => !found.some(r => r.id === id)).forEach(id => lines.push([`purge: SAT ${pad(id)}: not in this cluster`, 'warn']));
    const wrong = found.find(r => r.kind !== 'runaway');
    setCmd('');
    if (wrong) {
      lines.push([
        `SAT ${pad(wrong.id)} · ${wrong.proc} killed · ${wrong.kind === 'legit' ? 'scheduled task lost' : 'healthy service killed'}`,
        'err',
      ]);
      setOut(lines.slice(-2));
      setFailMsg(`SAT ${pad(wrong.id)} · ${wrong.kind === 'legit' ? 'SCHEDULED TASK KILLED' : 'HEALTHY SERVICE KILLED'}`);
      setPhase('lost');
      return;
    }
    const fresh = found.filter(r => !purgedRef.current.has(r.id));
    fresh.forEach(r => purgedRef.current.add(r.id));
    if (fresh.length) lines.push([`purged ${fresh.map(r => `SAT ${pad(r.id)}`).join(', ')} · runaway processes killed`, 'ok']);
    setPurged([...purgedRef.current]);
    setOut(lines.slice(-2));
    if (setup.rows.every(r => r.kind !== 'runaway' || purgedRef.current.has(r.id))) setPhase('won');
  };

  const selected = typedIds(cmd),
    load = Math.round(cpus.reduce((a, b) => a + b, 0) / cpus.length);
  const purgedRunaways = setup.rows.filter(r => r.kind === 'runaway' && purged.includes(r.id)).length;
  const phone = usePhone(); // compact layout on phones: narrower columns, no status column, the command box on its own line
  const prompt = <span style={{ color: 'var(--green)' }}>ops@600:~/cluster$</span>;
  const tone = { muted: '#7b8580', warn: 'var(--yellow)', err: 'var(--red)', ok: 'var(--green)' };
  return (
    <>
      <Header title="CPU OVERLOAD" sub={`CLUSTER LOAD ${load}% · ${purgedRunaways}/${RUNAWAY} RUNAWAYS PURGED`} />
      <p className="instructions">
        Some satellites in this cluster have runaway processes maxing out their CPU. Purge them, but leave heavy load from tasks in schedule.cfg
        running. That's expected. Click lines or type IDs, then purge.
      </p>
      <div
        style={{
          maxWidth: 720,
          border: '1px solid #262d2b',
          background: '#070909',
          padding: phone ? '8px 10px' : '8px 12px',
          fontSize: phone ? 11 : 12,
          lineHeight: 1.6,
          overflowWrap: phone ? 'anywhere' : undefined,
        }}
      >
        <div style={{ color: '#7b8580' }}>{prompt} cat schedule.cfg</div>
        <div style={{ color: 'var(--yellow)', marginBottom: 4 }}>scheduled now: {setup.scheduled.join(', ')}</div>
        <div style={{ color: '#7b8580' }}>{prompt} tail -f cpu_watchdog.log</div>
        {setup.rows.map((r, i) => {
          const done = purged.includes(r.id),
            on = selected.includes(r.id),
            c = cpus[i];
          return (
            <div
              key={r.id}
              onClick={() => toggle(r.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: phone ? '52px 30px 42px minmax(0, 1fr)' : '64px 60px 50px 1fr 64px',
                alignItems: 'center',
                gap: phone ? 7 : 10,
                padding: phone ? '4px 6px' : '0 6px',
                margin: '0 -6px',
                cursor: done || phase !== 'run' ? 'default' : 'pointer',
                background: on ? 'rgba(201,255,77,.1)' : 'transparent',
                color: done ? '#3b4441' : '#c6cdc8',
              }}
            >
              <span>SAT {pad(r.id)}</span>
              <span style={{ height: 5, background: '#1a211f' }}>
                <i
                  style={{
                    display: 'block',
                    height: '100%',
                    width: `${Math.min(100, c)}%`,
                    background: done ? '#2a3230' : c > 85 ? 'var(--red)' : c > 60 ? 'var(--yellow)' : 'var(--green)',
                  }}
                />
              </span>
              <span style={{ textAlign: 'right' }}>{Math.min(99.9, c).toFixed(1)}%</span>
              <span
                style={
                  phone
                    ? {
                        color: done ? '#3b4441' : '#8fd9ff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textDecoration: done ? 'line-through' : 'none',
                      }
                    : { color: done ? '#3b4441' : '#8fd9ff' }
                }
              >
                {r.proc}
              </span>
              {!phone && (
                <span style={{ fontSize: 10, letterSpacing: '.1em', color: on ? 'var(--green)' : '#3b4441' }}>
                  {done ? 'PURGED' : on ? 'SELECTED' : ''}
                </span>
              )}
            </div>
          );
        })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: phone ? 'wrap' : 'nowrap' }}>
          {prompt}
          <span>purge</span>
          <input
            value={cmd}
            onChange={e => setCmd(e.target.value.replace(/[^\d\s,]/g, ''))}
            onKeyDown={e => {
              if (e.key === 'Enter') purge();
            }}
            disabled={phase !== 'run'}
            placeholder="click lines or type IDs"
            spellCheck={false}
            // 16px on phones: iPhone Safari zooms the page into any text box smaller than that
            style={{
              flex: phone ? '1 1 140px' : 1,
              minWidth: 0,
              background: 'transparent',
              border: 0,
              outline: 0,
              color: '#f4f7ef',
              fontSize: phone ? 16 : 12,
              padding: 0,
            }}
          />
          <button
            className="action"
            onClick={purge}
            disabled={phase !== 'run'}
            style={{ padding: phone ? '7px 14px' : '3px 10px', fontSize: 11 }}
          >
            PURGE
          </button>
        </div>
        {out.map(([text, kind], i) => (
          <div key={i} style={{ color: tone[kind] }}>
            {text}
          </div>
        ))}
      </div>
      {phase === 'won' && <div className="success">RUNAWAY PROCESSES PURGED · CLUSTER LOAD NOMINAL</div>}
      {phase === 'lost' && <div className="failure">{failMsg}</div>}
    </>
  );
}
