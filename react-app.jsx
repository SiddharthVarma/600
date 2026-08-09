const { useState, useEffect, useRef } = React;
const shuffle = a => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]] } return x };
const allSubsets = n => { const res = []; for (let m = 1; m < (1 << n); m++) { const s = []; for (let b = 0; b < n; b++)if (m & (1 << b)) s.push(b); res.push(s) } return res };
const PROCESS_POOL = ['PACKET RETRY', 'TELEMETRY CACHE', 'IMAGE PIPELINE', 'LOG AGGREGATOR', 'PAYLOAD INDEXER', 'MEMORY SCRUBBER', 'ATTITUDE SOLVER', 'MOTION SCHEDULE', 'STAR TRACKER FEED', 'DOWNLINK BUFFER', 'EPHEMERIS CALCULATOR', 'FAULT MONITOR'];
const games = [['thermal', 'THERMAL ROUTING', 'Valve sequencing'], ['power', 'POWER BUS', 'Route power by the numbers'], ['solar', 'SOLAR ALIGNMENT', 'Point at the sun'], ['contact', 'MISSED CONTACT', 'Hunt the signal peak'], ['wheel', 'REACTION WHEEL FAULT', 'Balance the torque'], ['process', 'PROCESS FAULT', 'Contain the leak in time'], ['orbit', 'ORBITAL BURN', 'Plot a transfer burn'], ['sensor', 'SENSOR FAULT', 'Find the outlier'], ['attitude', 'ATTITUDE DRIFT', 'Stabilize pointing'], ['startracker', 'STAR TRACKER LOCK', 'Rebuild the star field'], ['impact', 'MODULE IMPACT', 'Isolate the breach'], ['radiation', 'RADIATION EVENT', 'Wait it out']];
function Frame({ type, setType, children }) { const embedded = Boolean(new URLSearchParams(location.search).get('type')); return <div className="app"><header className="top"><span className="brand">SIX HUNDRED / REPAIR LAB</span><span className="eyebrow">SAT 421 · MANUAL OVERRIDE</span></header><div className={'layout ' + (embedded ? 'embedded' : '')} style={embedded ? { display: 'block', marginTop: 0 } : {}}>{!embedded && <nav className="menu">{games.map(([id, name]) => <button key={id} className={type === id ? 'active' : ''} onClick={() => setType(id)}>{name}</button>)}</nav>}<main className="board" style={embedded ? { minHeight: '100%', border: 0 } : {}}>{children}</main></div></div> }
function Header({ title, sub }) { return <><div className="eyebrow">Critical subsystem interaction</div><h1>{title}</h1><div className="signal">{sub}</div></> }
function Result({ ok, children }) { const [sent, setSent] = useState(false); const finish = () => { if (!sent && window.parent !== window) { setSent(true); setTimeout(() => window.parent.postMessage({ type: 'repair-complete' }, '*'), 1200) } }; return children && <div className={ok ? 'success' : 'failure'}>{sent ? 'SUCCESSFUL EXECUTION' : children}{ok && <div className="actions"><button className="action" onClick={finish} disabled={sent}>{sent ? 'SUCCESSFUL EXECUTION' : 'EXECUTE'}</button></div>}</div> }
function Thermal() {
    const nodes = { CORE: [35, 120], PUMP: [105, 120], PURGE: [105, 42], 'VALVE A1': [185, 62], 'VALVE B1': [185, 178], MANIFOLD: [255, 120], 'VALVE A2': [325, 62], 'VALVE B2': [325, 178], RADIATOR: [375, 120] };
    const edges = [['CORE', 'PUMP'], ['PUMP', 'PURGE'], ['PUMP', 'VALVE A1'], ['PUMP', 'VALVE B1'], ['VALVE A1', 'MANIFOLD'], ['VALVE B1', 'MANIFOLD'], ['MANIFOLD', 'VALVE A2'], ['MANIFOLD', 'VALVE B2'], ['VALVE A2', 'RADIATOR'], ['VALVE B2', 'RADIATOR']];
    const [safe1] = useState(() => Math.random() < .5 ? 'VALVE A1' : 'VALVE B1');
    const [safe2] = useState(() => Math.random() < .5 ? 'VALVE A2' : 'VALVE B2');
    const [temps] = useState(() => {
        const hot = () => Math.round(95 + Math.random() * 45), cool = () => Math.round(18 + Math.random() * 16);
        return { 'VALVE A1': safe1 === 'VALVE A1' ? cool() : hot(), 'VALVE B1': safe1 === 'VALVE B1' ? cool() : hot(), 'VALVE A2': safe2 === 'VALVE A2' ? cool() : hot(), 'VALVE B2': safe2 === 'VALVE B2' ? cool() : hot() };
    });
    const target = ['CORE', 'PUMP', safe1, 'MANIFOLD', safe2, 'RADIATOR'];
    const [path, setPath] = useState([]), [dragging, setDragging] = useState(false), [error, setError] = useState('');
    const temp = 78 - path.length * 6, pressure = 42 + path.length * 11, ok = path.length === target.length;
    const follow = e => {
        if (!dragging || ok) return;
        const box = e.currentTarget.getBoundingClientRect(), x = (e.clientX - box.left) / box.width * 400, y = (e.clientY - box.top) / box.height * 240;
        const node = Object.keys(nodes).find(n => Math.hypot(nodes[n][0] - x, nodes[n][1] - y) < 23);
        if (!node || path.includes(node)) return;
        if (node === target[path.length]) { setPath(p => [...p, node]); setError('') }
        else { setPath([]); setDragging(false); setError(node === 'PURGE' ? 'DEAD END · PURGE LINE ISOLATED FROM RADIATOR LOOP' : 'FLOW LOST · COOLANT ENTERED HOT BYPASS') }
    };
    const start = e => {
        setPath([]); setError(''); setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const box = e.currentTarget.getBoundingClientRect(), x = (e.clientX - box.left) / box.width * 400, y = (e.clientY - box.top) / box.height * 240;
        if (Math.hypot(35 - x, 120 - y) < 28) setPath(['CORE']);
        else { setDragging(false); setError('START AT THE HOT CORE') }
    };
    const onPath = (a, b) => path.includes(a) && path.includes(b) && Math.abs(path.indexOf(a) - path.indexOf(b)) === 1;
    const line = (a, b) => { const [x1, y1] = nodes[a], [x2, y2] = nodes[b], on = onPath(a, b); return <line key={a + b} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? '#c9ff4d' : '#34403a'} strokeWidth={on ? 7 : 4} strokeLinecap="round" /> };
    return <>
        <Header title="THERMAL ROUTING" sub={`CORE ${temp}°C · COOLANT ${pressure} kPa`} />
        <p className="instructions">Hold and drag from the hot core through the pump. Two valve junctions block the loop — at each one, route through the cooler valve, or the coolant flashes in the hot bypass. A purge line branches off the pump but dead-ends before the manifold.</p>
        <svg viewBox="0 0 400 240" width="100%" style={{ maxWidth: 760, display: 'block', margin: '28px 0', background: '#0c1210', border: '1px solid #34403a', cursor: dragging ? 'grabbing' : 'crosshair', touchAction: 'none' }} onPointerDown={start} onPointerMove={follow} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
            {edges.map(([a, b]) => line(a, b))}
            {Object.entries(nodes).map(([n, [x, y]]) => {
                const done = path.includes(n), isValve = n.startsWith('VALVE');
                return <g key={n}>
                    <circle cx={x} cy={y} r="20" fill={done ? '#172714' : n === 'CORE' ? '#241512' : '#141d1a'} stroke={done ? '#c9ff4d' : '#5c6b64'} strokeWidth="3" />
                    <text x={x} y={y + 3} textAnchor="middle" fill="#eef4eb" fontSize={isValve ? 7 : 8}>{n}</text>
                    {isValve && <text x={x} y={y + 34} textAnchor="middle" fill="#c7d1cb" fontSize="9">{temps[n]}°C</text>}
                </g>;
            })}
            <text x="200" y="222" textAnchor="middle" fill={dragging ? '#c9ff4d' : '#89948d'} fontSize="10">{dragging ? 'DRAGGING COOLANT FLOW' : 'HOLD ON CORE · TRACE THE SAFE ROUTE'}</text>
        </svg>
        <div className="readout" style={{ color: temp > 70 ? 'var(--red)' : temp > 55 ? 'var(--yellow)' : 'var(--green)' }}>CORE {temp}°C · PRESSURE {pressure} kPa</div>
        <button className="action" onClick={() => { setPath([]); setError('') }}>RESET ROUTE</button>
        <Result ok={ok}>{ok ? 'THERMAL LOOP STABLE · COOLANT FLOW CONFIRMED' : error || 'Drag a continuous coolant path through the system.'}</Result>
    </>;
}
function Power() {
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
                const trueI = V / Ri, tol = .25;
                const rangeLo = Math.round((trueI - tol) * 10) / 10, rangeHi = Math.round((trueI + tol) * 10) / 10;
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
        for (let attempt = 0; attempt < 60; attempt++) {
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
    const busYs = [30, 110, 190, 270], loadYs = [30, 140, 250];


    const toggleBus = i => { if (usedBuses.includes(i)) return; setStaged(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]); setError('') };
    const attemptLoad = li => {
        if (powered.includes(li)) return;
        if (staged.length === 0) { setError('SELECT ONE OR MORE BUSES FIRST'); return }
        const load = setup.loads[li];
        const V = staged.reduce((s, i) => s + setup.voltages[i], 0);
        const current = Math.round((V / load.Ri) * 10) / 10;
        if (current >= load.rangeLo && current <= load.rangeHi) {
            setUsedBuses(u => [...u, ...staged]);
            setConnections(c => ({ ...c, [li]: staged }));
            setPowered(p => [...p, li]);
            setStaged([]); setError('');
        } else {
            setError(current > load.rangeHi ? 'OVERCURRENT · TRIP · REDUCE STAGED VOLTAGE' : 'UNDERPOWERED · INSUFFICIENT CURRENT');
            setStaged([]);
        }
    };
    const stagedV = staged.reduce((s, i) => s + setup.voltages[i], 0);
    const ok = powered.length === 3;

    return <>
        <Header title="POWER BUS" sub="VOLTAGE OSCILLATION · MULTI-RAIL FEED REQUIRED" />
        <p className="instructions">Each load needs its combined bus voltage inside the range shown. Two loads need just one bus each; the two buses left over are the pair for the third. Stage one or more buses, then click a load to commit them — click a staged bus again to remove it, or clear the selection outright.</p>
        <svg viewBox="0 0 620 340" width="100%" style={{ maxWidth: 720, display: 'block', margin: '26px 0', background: '#0c1210', border: '1px solid #34403a' }}>
            {Object.entries(connections).flatMap(([li, busIdxs]) => busIdxs.map(bi => {
                const y1 = busYs[bi] + 26, y2 = loadYs[+li] + 42;
                return <path key={li + '-' + bi} d={`M 150 ${y1} C 260 ${y1}, 340 ${y2}, 450 ${y2}`} fill="none" stroke="#c9ff4d" strokeWidth="6" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px #c9ff4d)' }} />;
            }))}
            {setup.voltages.map((v, i) => {
                const stagedOn = staged.includes(i), used = usedBuses.includes(i);
                return <g key={'b' + i} onClick={() => toggleBus(i)} style={{ cursor: used ? 'default' : 'pointer' }}>
                    <rect x="20" y={busYs[i]} width="130" height="52" rx="4" fill={used ? '#0f1513' : stagedOn ? '#f4f7ef' : '#101614'} stroke={used ? '#39453f' : stagedOn ? '#f4f7ef' : '#55b6ff'} strokeWidth="3" />
                    <text x="85" y={busYs[i] + 22} textAnchor="middle" fill={stagedOn ? '#070809' : used ? '#4c5750' : '#89948d'} fontSize="10">BUS {i + 1}{used ? ' · IN USE' : ''}</text>
                    <text x="85" y={busYs[i] + 40} textAnchor="middle" fill={stagedOn ? '#070809' : used ? '#4c5750' : '#55b6ff'} fontSize="14">{v}V</text>
                </g>;
            })}
            {setup.loads.map((load, i) => {
                const done = powered.includes(i);
                return <g key={'l' + i} onClick={() => attemptLoad(i)} style={{ cursor: done ? 'default' : 'pointer' }}>
                    <rect x="450" y={loadYs[i]} width="150" height="84" rx="4" fill={done ? 'var(--green)' : '#101614'} stroke={done ? 'var(--green)' : '#ffd166'} strokeWidth="3" />
                    <text x="525" y={loadYs[i] + 18} textAnchor="middle" fill={done ? '#070809' : '#eef4eb'} fontSize="11">LOAD {i + 1}{done ? ' ✓' : ''}</text>
                    <text x="525" y={loadYs[i] + 38} textAnchor="middle" fill={done ? '#070809' : '#c9ff4d'} fontSize="13">NEEDS {load.vLo}–{load.vHi}V</text>
                    <text x="525" y={loadYs[i] + 56} textAnchor="middle" fill={done ? '#070809' : '#89948d'} fontSize="9">R {load.Ri}Ω · {load.rangeLo}–{load.rangeHi}A</text>
                    <text x="525" y={loadYs[i] + 71} textAnchor="middle" fill={done ? '#070809' : '#89948d'} fontSize="8">CLICK TO COMMIT</text>
                </g>;
            })}
            <text x="300" y="320" textAnchor="middle" fill="#849089" fontSize="10">SELECT BUS SOCKETS · THEN CLICK A LOAD TO COMMIT</text>
        </svg>
        <div className="readout">STAGED {stagedV}V · {staged.length} BUS{staged.length === 1 ? '' : 'ES'} SELECTED</div>
        <button className="action" onClick={() => { setStaged([]); setError('') }}>CLEAR SELECTION</button>
        <Result ok={ok}>{ok ? 'POWER BUS BALANCED · ALL LOADS NOMINAL' : error || 'Select bus sockets, then commit them to a load.'}</Result>
    </>;
}
function Solar() {
    const CHARGE_RATE = 100 / 9, DRAIN_RATE = 100 / 25, TOL = 14, SUN_R = 108, CX = 150, CY = 150;
    const ASSETS = '600_solar_assets/';
    const [dir] = useState(() => Math.random() < .5 ? 1 : -1);
    const [speed] = useState(() => 5 + Math.random() * 3);
    const [stars] = useState(() => Array.from({ length: 40 }, () => ({ x: Math.random() * 300, y: Math.random() * 300, r: Math.random() * 1.2 + .3, o: Math.random() * .6 + .2 })));
    const [angle, setAngle] = useState(() => Math.random() * 360);
    const angleRef = useRef(angle);
    const [sunAngle, setSunAngle] = useState(() => Math.random() * 360);
    const [charge, setCharge] = useState(0);
    const [done, setDone] = useState(false);

    const angDelta = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d };
    const polar = (deg, r) => { const a = deg * Math.PI / 180; return [CX + Math.cos(a) * r, CY - Math.sin(a) * r] };

    useEffect(() => {
        if (done) return;
        let raf, lastTs, sunLocal = sunAngle;
        const step = ts => {
            if (lastTs == null) lastTs = ts;
            const dt = Math.min(.1, (ts - lastTs) / 1000);
            lastTs = ts;
            sunLocal = (sunLocal + dir * speed * dt + 360) % 360;
            const aligned = angDelta(angleRef.current, sunLocal) <= TOL;
            setSunAngle(sunLocal);
            setCharge(c => Math.min(100, Math.max(0, c + (aligned ? CHARGE_RATE : -DRAIN_RATE) * dt)));
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [done]);

    useEffect(() => { if (charge >= 100) setDone(true) }, [charge]);

    useEffect(() => {
        if (!done) return;
        if (window.parent !== window) { const id = setTimeout(() => window.parent.postMessage({ type: 'repair-complete' }, '*'), 1200); return () => clearTimeout(id) }
    }, [done]);

    const aligned = angDelta(angle, sunAngle) <= TOL;
    const [w1x, w1y] = polar(angle - TOL, 135), [w2x, w2y] = polar(angle + TOL, 135);
    const sector = `M ${CX} ${CY} L ${w1x} ${w1y} A 135 135 0 0 1 ${w2x} ${w2y} Z`;
    const [sx, sy] = polar(sunAngle, SUN_R);
    const SCID_W = 150, SCID_H = SCID_W * 222 / 520, SUN_W = 70, SUN_H = SUN_W * 345 / 520;

    return <>
        <Header title="SOLAR ALIGNMENT" sub="ARRAY OFFLINE · BATTERY DEPLETED" />
        <p className="instructions">Steer the array to keep the sun inside the amber cone. The sun drifts in a slow orbit, so once you're locked on you'll need to keep nudging the slider to stay with it while the battery charges.</p>
        <div style={{ display: 'grid', placeItems: 'center', margin: '24px 0' }}>
            <svg viewBox="0 0 300 300" width="320" height="320" style={{ background: 'radial-gradient(circle,#0e1614,#070809 70%)', border: '1px solid #34403a' }}>
                {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />)}
                <circle cx={CX} cy={CY} r={SUN_R} fill="none" stroke="#242c29" strokeDasharray="3 5" />
                <path d={sector} fill={aligned ? 'rgba(201,255,77,.28)' : 'rgba(255,209,102,.14)'} stroke={aligned ? '#c9ff4d' : '#ffd166'} strokeWidth="2" />
                <image href={ASSETS + 'sun.png'} x={sx - SUN_W / 2} y={sy - SUN_H / 2} width={SUN_W} height={SUN_H} style={{ filter: aligned ? 'brightness(1.35) drop-shadow(0 0 16px rgba(255,180,60,.7))' : 'none', transition: 'filter .2s' }} />
                <image href={ASSETS + 'scid.png'} x={CX - SCID_W / 2} y={CY - SCID_H / 2} width={SCID_W} height={SCID_H} transform={`rotate(${90 - angle} ${CX} ${CY})`} />
                <text x="150" y="292" textAnchor="middle" fontSize="9" fill={aligned ? '#c9ff4d' : '#89948d'}>{done ? 'ARRAY CHARGED' : aligned ? 'CHARGING · HOLD STEADY' : 'STEER INTO THE CONE'}</text>
            </svg>
        </div>
        <div className="readout" style={{ color: aligned ? 'var(--green)' : 'var(--yellow)' }}>BATTERY {Math.round(charge)}% · ARRAY {Math.round(angle)}° · SUN {Math.round(sunAngle)}°</div>
        <input className="range" type="range" min="0" max="359" value={Math.round(angle)} onChange={e => { const v = +e.target.value; angleRef.current = v; setAngle(v) }} disabled={done} />
        <div className="bar"><i style={{ width: `${charge}%`, background: aligned ? 'var(--green)' : 'var(--yellow)' }} /></div>
        <div className="legend"><span><i className="dot yellowbg" />ALIGNMENT CONE ±{TOL}°</span><span><i className="dot green" />CHARGING</span></div>
        {done ? <div className="success">ARRAY CHARGED · BATTERY ONLINE</div> : null}
    </>;
}
function Contact() {
    const THRESH = 88;
    const [seed] = useState(() => ({ base: Math.random() * 360, f1: .15 + Math.random() * .1, f2: .26 + Math.random() * .12, amp1: 60 + Math.random() * 30, amp2: 22 + Math.random() * 14, phase1: Math.random() * Math.PI * 2, phase2: Math.random() * Math.PI * 2 }));
    const [angle, setAngle] = useState(() => Math.random() * 360);
    const angleRef = useRef(angle);
    const [strength, setStrength] = useState(0);
    const [locked, setLocked] = useState(false);
    const [message, setMessage] = useState('');

    const angDelta = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d };
    const targetAngle = ms => { const s = ms / 1000; return (seed.base + Math.sin(s * seed.f1 + seed.phase1) * seed.amp1 + Math.sin(s * seed.f2 + seed.phase2) * seed.amp2 + 3600) % 360 };
    const signalAt = diff => { const raw = Math.cos(diff * Math.PI / 180); return raw > 0 ? Math.pow(raw, 4) * 100 : 0 };

    useEffect(() => {
        if (locked) return;
        let raf, startTs;
        const step = ts => {
            if (!startTs) startTs = ts;
            const elapsed = ts - startTs;
            const tgt = targetAngle(elapsed);
            const diff = angDelta(angleRef.current, tgt);
            setStrength(signalAt(diff));
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [locked]);

    useEffect(() => {
        if (!locked) return;
        if (window.parent !== window) { const id = setTimeout(() => window.parent.postMessage({ type: 'repair-complete' }, '*'), 1200); return () => clearTimeout(id) }
    }, [locked]);

    const setAngleBoth = a => { angleRef.current = a; setAngle(a); setMessage('') };
    const lockSignal = () => {
        if (strength >= THRESH) { setLocked(true); setMessage('') }
        else setMessage('SIGNAL TOO WEAK · KEEP TUNING');
    };

    const bars = [20, 45, 70, 90];
    const ASSETS = '600_solar_assets/';
    const FRAME_DIR = '600_gn_antenna_pixel_frames/';
    const FRAMES = [{ file: 'antenna_r01_f01.png', w: 96, h: 168 }, { file: 'antenna_r01_f02.png', w: 128, h: 168 }, { file: 'antenna_r01_f03.png', w: 128, h: 173 }, { file: 'antenna_r01_f04.png', w: 105, h: 176 }, { file: 'antenna_r01_f05.png', w: 103, h: 177 }, { file: 'antenna_r01_f06.png', w: 96, h: 186 }, { file: 'antenna_r01_f07.png', w: 93, h: 184 }, { file: 'antenna_r01_f08.png', w: 99, h: 176 }, { file: 'antenna_r01_f09.png', w: 103, h: 176 }, { file: 'antenna_r01_f10.png', w: 128, h: 170 }, { file: 'antenna_r01_f11.png', w: 128, h: 166 }, { file: 'antenna_r01_f12.png', w: 96, h: 159 }];
    const DISPLAY_H = 170, GROUND_Y = 232, CX = 150;
    const frameIdx = Math.round(angle / 30) % 12;
    const fr = FRAMES[frameIdx];
    const dispW = DISPLAY_H * (fr.w / fr.h);
    const imgX = CX - dispW / 2, imgY = GROUND_Y - DISPLAY_H;

    return <>
        <Header title="MISSED CONTACT" sub="RSSI -104 dBm · NO DIRECTIONAL LOCK" />
        <p className="instructions">The satellite's bearing isn't shown — only signal strength. Sweep the dish and hill-climb toward the peak. The satellite keeps drifting, so once you're close you'll need to keep tracking it, not just point and let go.</p>
        <div style={{ display: 'grid', placeItems: 'center', margin: '24px 0' }}>
            <svg viewBox="0 0 300 300" width="320" height="320" style={{ background: '#0c1210', border: '1px solid #34403a' }}>
                <ellipse cx={CX} cy={GROUND_Y + 6} rx="72" ry="10" fill="rgba(0,0,0,.35)" />
                <image href={FRAME_DIR + fr.file} x={imgX} y={imgY} width={dispW} height={DISPLAY_H} style={{ imageRendering: 'pixelated' }} />
                {locked && <image href={ASSETS + 'scid.png'} x="176" y="34" width="98" height={98 * 222 / 520} />}
                {bars.map((th, i) => <rect key={th} x={20 + i * 13} y={54 - (10 + i * 7)} width="9" height={10 + i * 7} fill={strength >= th ? '#c9ff4d' : '#2a332f'} stroke="#1c2422" strokeWidth="1" />)}
                <text x="150" y="292" textAnchor="middle" fontSize="9" fill={strength >= THRESH ? '#c9ff4d' : '#89948d'}>{locked ? 'DOWNLINK ESTABLISHED' : strength >= THRESH ? 'SIGNAL PEAKED · LOCK IT IN' : 'SWEEP THE DISH · HILL-CLIMB THE SIGNAL'}</text>
            </svg>
        </div>
        <div className="readout" style={{ color: strength >= THRESH ? 'var(--green)' : strength > 40 ? 'var(--yellow)' : 'var(--red)' }}>SIGNAL {Math.round(strength)}% · BEARING {Math.round(angle)}°</div>
        <input className="range" type="range" min="0" max="359" value={Math.round(angle)} onChange={e => setAngleBoth(+e.target.value)} disabled={locked} />
        <div className="bar"><i style={{ width: `${strength}%`, background: strength >= THRESH ? 'var(--green)' : strength > 40 ? 'var(--yellow)' : 'var(--red)' }} /></div>
        <div className="actions"><button className="action" style={{ borderColor: strength >= THRESH ? 'var(--green)' : '#39453f', color: strength >= THRESH ? 'var(--green)' : '#85908a' }} onClick={lockSignal} disabled={locked}>LOCK SIGNAL</button></div>
        <div className="legend"><span><i className="dot green" />SIGNAL PEAK</span></div>
        {locked ? <div className="success">DOWNLINK ESTABLISHED · TELEMETRY RECEIVED</div> : message ? <div className="failure">{message}</div> : null}
    </>;
}
function ReactionWheel() {
    const ASSETS = '600_wheel_assets/';
    const WHEEL_ANGLES = [45, 135, 225, 315];
    const WHEEL_ASSETS = [{ file: 'wheel_nominal.png', w: 294, h: 340 }, { file: 'wheel_failed.png', w: 303, h: 340 }];
    const LEVELS = [0, .25, .5, .75, 1];
    const angleDelta = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d };
    const ANGLE_TOL = 0.5, MAG_TOL = () => 0.01;
    const vecOf = lv => WHEEL_ANGLES.reduce((acc, ang, i) => { const p = lv[i] || 0; if (!p) return acc; const r = ang * Math.PI / 180; return { x: acc.x + Math.cos(r) * p, y: acc.y + Math.sin(r) * p } }, { x: 0, y: 0 });
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
            const targetAngle = (Math.atan2(tv.y, tv.x) * 180 / Math.PI + 360) % 360;
            const correctKey = keyOf(target, available);
            let unique = true;
            for (const a of assignments) {
                if (keyOf(a, available) === correctKey) continue;
                const v = vecOf(a), m = Math.hypot(v.x, v.y), ang = (Math.atan2(v.y, v.x) * 180 / Math.PI + 360) % 360;
                if (Math.abs(m - mag) <= MAG_TOL(mag) && angleDelta(ang, targetAngle) <= ANGLE_TOL) { unique = false; break }
            }
            if (unique) return { failedIdx, available, mag, targetAngle };
        }
        const failedIdx = 0, available = [1, 2, 3], tv = vecOf({ 1: 1, 2: .5 });
        return { failedIdx, available, mag: Math.hypot(tv.x, tv.y), targetAngle: (Math.atan2(tv.y, tv.x) * 180 / Math.PI + 360) % 360 };
    });

    const [levels, setLevels] = useState({});
    const cycle = i => { if (i === setup.failedIdx) return; setLevels(lv => { const cur = lv[i] || 0, idx = LEVELS.indexOf(cur); return { ...lv, [i]: LEVELS[(idx + 1) % LEVELS.length] } }) };

    const resultant = vecOf(levels);
    const resMag = Math.hypot(resultant.x, resultant.y);
    const resAngle = resMag > 0.01 ? (Math.atan2(resultant.y, resultant.x) * 180 / Math.PI + 360) % 360 : 0;
    const anySelected = Object.values(levels).some(p => p > 0);
    const closeEnough = anySelected && Math.abs(resMag - setup.mag) <= MAG_TOL(setup.mag) && angleDelta(resAngle, setup.targetAngle) <= ANGLE_TOL;

    const CX = 150, CY = 150;
    const polar = (deg, r) => { const a = deg * Math.PI / 180; return [CX + Math.cos(a) * r, CY - Math.sin(a) * r] };
    const arrow = (angleDeg, length, color) => {
        if (length < 4) return null;
        const [x2, y2] = polar(angleDeg, length);
        const [h1x, h1y] = polar(angleDeg + 150, 10), [h2x, h2y] = polar(angleDeg - 150, 10);
        return <g>
            <line x1={CX} y1={CY} x2={x2} y2={y2} stroke={color} strokeWidth="4" strokeLinecap="round" />
            <polygon points={`${x2},${y2} ${x2 + h1x - CX},${y2 + h1y - CY} ${x2 + h2x - CX},${y2 + h2y - CY}`} fill={color} />
        </g>;
    };
    const driftAngle = (setup.targetAngle + 180) % 360;

    return <>
        <Header title="REACTION WHEEL FAULT" sub={`WHEEL ${setup.failedIdx + 1} OFFLINE · UNCOMMANDED TUMBLE`} />
        <p className="instructions">One reaction wheel has failed and can't be commanded. The satellite is drifting — click each working wheel to cycle its commanded speed (OFF · 25% · 50% · 75% · 100%) until the combined torque cancels the drift. Direction and magnitude both have to line up.</p>
        <div style={{ display: 'grid', placeItems: 'center', margin: '24px 0' }}>
            <svg viewBox="0 0 300 300" width="320" height="320" style={{ background: '#0c1210', border: '1px solid #34403a' }}>
                <circle cx={CX} cy={CY} r="104" fill="none" stroke="#242c29" strokeDasharray="3 5" />
                {arrow(driftAngle, 72, '#ff5964')}
                {resMag > 0.05 && arrow(resAngle, Math.min(56, 22 + resMag * 38), closeEnough ? '#c9ff4d' : '#ffd166')}
                <circle cx={CX} cy={CY} r="16" fill="#141d1a" stroke="#5c6b64" strokeWidth="3" />
                {WHEEL_ANGLES.map((ang, i) => {
                    const failed = i === setup.failedIdx, p = levels[i] || 0;
                    const asset = WHEEL_ASSETS[failed ? 1 : 0];
                    const dispH = 64, dispW = dispH * asset.w / asset.h;
                    const [wx, wy] = polar(ang, 104);
                    const ringColor = p === 1 ? '#c9ff4d' : p === .75 ? '#d9f75f' : p === .5 ? '#ffd166' : p === .25 ? '#ff9f5a' : null;
                    const ringFill = p === 1 ? 'rgba(201,255,77,.22)' : p === .75 ? 'rgba(217,247,95,.2)' : p === .5 ? 'rgba(255,209,102,.16)' : p === .25 ? 'rgba(255,159,90,.14)' : null;
                    return <g key={i} onClick={() => cycle(i)} style={{ cursor: failed ? 'default' : 'pointer' }}>
                        {ringColor && <circle cx={wx} cy={wy} r={dispH * 0.62} fill={ringFill} stroke={ringColor} strokeWidth="2" />}
                        <image href={ASSETS + asset.file} x={wx - dispW / 2} y={wy - dispH / 2} width={dispW} height={dispH} />
                        {!failed && <text x={wx} y={wy + dispH / 2 + 16} textAnchor="middle" fontSize="9" fill={ringColor || '#5c6b64'}>{p === 1 ? '100%' : p === .75 ? '75%' : p === .5 ? '50%' : p === .25 ? '25%' : 'OFF'}</text>}
                    </g>;
                })}
                <text x="150" y="292" textAnchor="middle" fontSize="9" fill={closeEnough ? '#c9ff4d' : '#89948d'}>{closeEnough ? 'CORRECTION ALIGNED · READY TO FIRE' : 'CYCLE WHEEL SPEED · MATCH DIRECTION AND MAGNITUDE'}</text>
            </svg>
        </div>
        <div className="legend"><span><i className="dot redbg" />DRIFT VECTOR</span><span><i className="dot green" />COMMANDED CORRECTION</span></div>
        <Result ok={closeEnough}>{closeEnough ? 'RESIDUAL DRIFT NULLED · ATTITUDE STABLE' : 'Toggle wheels until the correction vector cancels the drift.'}</Result>
    </>;
}
function Process() {
    const BASE = 30, RATE = 70 / 180, WRONG_PENALTY = 16;
    const [setup] = useState(() => {
        const six = shuffle(PROCESS_POOL).slice(0, 6);
        const leakArr = shuffle(six).slice(0, 3);
        const leakSet = new Set(leakArr);
        const nonLeak = six.filter(p => !leakSet.has(p));
        const decoy = shuffle(nonLeak)[0];
        const seeds = {};
        six.forEach(p => seeds[p] = Math.random() * Math.PI * 2);
        return { six, leakSet, decoy, seeds };
    });
    const [phase, setPhase] = useState('run'); // run | won | lost
    const [retriesLeft, setRetriesLeft] = useState(1);
    const retriesRef = useRef(1);
    const [flash, setFlash] = useState(false);
    const [stopped, setStopped] = useState([]);
    const stoppedRef = useRef(stopped);
    useEffect(() => { stoppedRef.current = stopped }, [stopped]);
    const [displayCPU, setDisplayCPU] = useState(BASE);
    const [series, setSeries] = useState(() => { const o = {}; setup.six.forEach(p => o[p] = []); return o });
    const [rate, setRateInfo] = useState({ text: 'READING', stable: true });

    useEffect(() => {
        if (phase !== 'run') return;
        let raf, t0 = null, lastSampleT = -1, localSeries = {};
        setup.six.forEach(p => localSeries[p] = []);
        let cpuHist = [], curCPU = BASE;
        const step = ts => {
            if (t0 == null) t0 = ts;
            const elapsed = (ts - t0) / 1000;
            let target = BASE;
            const vals = {};
            setup.six.forEach(p => {
                const seed = setup.seeds[p];
                let v;
                if (setup.leakSet.has(p)) {
                    v = 16 + elapsed * 1.05 + Math.sin(elapsed * 1.3 + seed) * 2.2 + Math.sin(elapsed * .7 + seed * 1.7) * 1.3;
                    if (!stoppedRef.current.includes(p)) target += Math.max(0, elapsed * RATE);
                } else if (p === setup.decoy) {
                    v = elapsed < 9 ? 16 + elapsed * 4.9 : 60 + Math.sin(elapsed * 1.1 + seed) * 3;
                    if (stoppedRef.current.includes(p)) target += WRONG_PENALTY;
                } else {
                    v = 18 + Math.sin(elapsed * .9 + seed) * 4;
                    if (stoppedRef.current.includes(p)) target += WRONG_PENALTY;
                }
                vals[p] = Math.max(2, Math.min(99, v));
            });
            curCPU += (Math.min(140, target) - curCPU) * .06;
            const dispCPU = Math.max(0, Math.min(100, curCPU));
            setDisplayCPU(dispCPU);
            if (elapsed - lastSampleT >= .35) {
                lastSampleT = elapsed;
                setup.six.forEach(p => { localSeries[p] = [...localSeries[p], vals[p]].slice(-36) });
                setSeries({ ...localSeries });
                cpuHist.push({ t: elapsed, cpu: dispCPU });
                if (cpuHist.length > 6) cpuHist.shift();
                if (cpuHist.length >= 2) {
                    const a = cpuHist[0], b = cpuHist[cpuHist.length - 1];
                    const r = (b.cpu - a.cpu) / ((b.t - a.t) || 1);
                    if (r <= .15) setRateInfo({ text: 'STABLE', stable: true });
                    else {
                        const secs = (100 - dispCPU) / r;
                        setRateInfo({ text: secs > 599 ? '>10:00' : `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`, stable: false });
                    }
                }
            }
            const allLeaksStopped = [...setup.leakSet].every(p => stoppedRef.current.includes(p));
            const onlyLeaksStopped = stoppedRef.current.length === setup.leakSet.size;
            if (allLeaksStopped && onlyLeaksStopped && dispCPU < 50 && elapsed > 1) { setPhase('won'); return }
            if (curCPU >= 100) {
                if (retriesRef.current > 0) {
                    retriesRef.current -= 1;
                    setRetriesLeft(retriesRef.current);
                    setStopped([]);
                    setFlash(true);
                    setTimeout(() => setFlash(false), 1600);
                    t0 = null; lastSampleT = -1; curCPU = BASE; cpuHist = [];
                    localSeries = {}; setup.six.forEach(p => localSeries[p] = []);
                    setSeries({ ...localSeries });
                    setDisplayCPU(BASE);
                } else { setPhase('lost'); return }
            }
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [phase]);

    useEffect(() => {
        if (phase !== 'won') return;
        if (window.parent !== window) { const id = setTimeout(() => window.parent.postMessage({ type: 'repair-complete' }, '*'), 1200); return () => clearTimeout(id) }
    }, [phase]);
    useEffect(() => {
        if (phase !== 'lost') return;
        if (window.parent !== window) { const id = setTimeout(() => window.parent.postMessage({ type: 'repair-failed' }, '*'), 1200); return () => clearTimeout(id) }
    }, [phase]);

    const toggle = p => { if (phase !== 'run') return; setStopped(s => s.includes(p) ? s.filter(x => x !== p) : [...s, p]) };
    const leaksStoppedCount = [...setup.leakSet].filter(p => stopped.includes(p)).length;
    const spark = p => { const arr = series[p] || []; if (arr.length < 2) return ''; return arr.map((v, i) => `${(i / (arr.length - 1 || 1) * 80).toFixed(1)},${(30 - v / 100 * 28).toFixed(1)}`).join(' ') };

    return <>
        <Header title="MEMORY LEAK" sub={`CPU ${Math.round(displayCPU)}% · ${leaksStoppedCount}/3 LEAKS ISOLATED · ${retriesLeft} RETRY LEFT`} />
        <p className="instructions">Three of these six subprocesses are leaking memory and driving CPU toward critical. Watch each one's live trend — a real leak climbs continuously; a decoy spikes early then flattens out. Isolate the three real leaks before CPU breaches 100%. You get one emergency restart — a second breach loses the satellite for good.</p>
        <div className="pixel-grid">
            {setup.six.map(p => {
                const off = stopped.includes(p), actual = setup.leakSet.has(p);
                return <button className={'node ' + (off ? (actual ? 'done' : 'fail') : '')} onClick={() => toggle(p)} key={p} disabled={phase !== 'run'}>
                    {p}
                    <svg viewBox="0 0 80 30" width="100%" height="30" style={{ display: 'block', margin: '8px 0 4px' }}>
                        <polyline points={spark(p)} fill="none" stroke={off ? (actual ? '#0c1210' : '#0c1210') : '#8fd9ff'} strokeWidth="1.6" />
                    </svg>
                    <small>{off ? (actual ? 'ISOLATED' : 'SERVICE OFFLINE') : 'MONITORING'}</small>
                </button>;
            })}
        </div>
        <div className="bar"><i style={{ width: `${displayCPU}%`, background: displayCPU > 80 ? 'var(--red)' : displayCPU > 55 ? 'var(--yellow)' : 'var(--green)' }} /></div>
        <div className="readout" style={{ color: displayCPU > 80 ? 'var(--red)' : displayCPU > 55 ? 'var(--yellow)' : 'var(--green)' }}>CPU {Math.round(displayCPU)}% · TIME TO CRITICAL {rate.stable ? 'STABLE' : rate.text}</div>
        {flash && <div className="failure">CPU CRITICAL · EMERGENCY RESTART · {retriesLeft} RETRY REMAINING</div>}
        {phase === 'won' && <div className="success">LEAKS CONTAINED · CPU BELOW SAFE THRESHOLD</div>}
        {phase === 'lost' && <div className="failure">SATELLITE LOST · CPU OVERRUN</div>}
    </>;
}
function Orbit() {
    const cx = 150, cy = 150;
    const [cfg] = useState(() => {
        const raiseMode = Math.random() < .5, r2 = 60 + Math.random() * 20, delta = 20 + Math.random() * 12;
        const r1 = raiseMode ? Math.max(26, r2 - delta) : r2 + delta;
        const startAngle = Math.random() * 360, windowCenter = (startAngle + 130 + Math.random() * 100) % 360;
        return { raiseMode, r1, r2, minSafeR: 40, radiusTol: 9, startAngle, windowCenter, windowWidth: 50 };
    });
    const [stage, setStage] = useState('plot'); // plot -> approach -> coast -> success
    const [drag, setDrag] = useState(null), [locked, setLocked] = useState(null), [error, setError] = useState('');
    const [t, setT] = useState(0), [sweepT, setSweepT] = useState(0), [sweepDeg, setSweepDeg] = useState(0);

    const polar = (deg, r) => { const a = deg * Math.PI / 180; return [cx + Math.cos(a) * r, cy - Math.sin(a) * r] };
    const angDelta = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
    const satStart = polar(cfg.startAngle, cfg.r1);
    const points = end => {
        const [ex, ey] = polar(end.angle, end.dist);
        const da = (end.angle - cfg.startAngle + 360) % 360, midAngle = cfg.startAngle + da / 2;
        const midR = Math.max(20, Math.max(cfg.r1, end.dist) + (cfg.raiseMode ? 26 : -16));
        const [mx, my] = polar(midAngle, midR);
        return [satStart, [mx, my], [ex, ey]];
    };
    const pathD = pts => `M ${pts[0][0]} ${pts[0][1]} Q ${pts[1][0]} ${pts[1][1]} ${pts[2][0]} ${pts[2][1]}`;
    const bezierAt = (pts, p) => { const x = (1 - p) * (1 - p) * pts[0][0] + 2 * (1 - p) * p * pts[1][0] + p * p * pts[2][0], y = (1 - p) * (1 - p) * pts[0][1] + 2 * (1 - p) * p * pts[1][1] + p * p * pts[2][1]; return [x, y] };
    const toSvg = e => { const box = e.currentTarget.getBoundingClientRect(), x = (e.clientX - box.left) / box.width * 300, y = (e.clientY - box.top) / box.height * 300, dx = x - cx, dy = y - cy; return { x, y, dist: Math.hypot(dx, dy), angle: (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360 } };
    const evaluateMag = d => {
        if (!d) return { valid: false, msg: '' };
        if (d.dist < cfg.minSafeR) return { valid: false, msg: 'DANGER · ATMOSPHERIC INTERFACE' };
        if (Math.abs(d.dist - cfg.r2) > cfg.radiusTol) return { valid: false, msg: d.dist > cfg.r2 + cfg.radiusTol ? 'OVERSHOOT · BURN TOO HOT' : 'UNDERSHOOT · BURN TOO WEAK' };
        return { valid: true, msg: 'BURN PLOTTED' };
    };

    const start = e => { if (stage !== 'plot' || locked) return; const p = toSvg(e); if (Math.hypot(satStart[0] - p.x, satStart[1] - p.y) > 26) { setError('GRAB THE SATELLITE TO BEGIN'); return } e.currentTarget.setPointerCapture?.(e.pointerId); setError(''); setDrag(p) };
    const move = e => { if (!drag || stage !== 'plot' || locked) return; setDrag(toSvg(e)) };
    const release = () => { if (!drag || stage !== 'plot' || locked) return; const res = evaluateMag(drag); if (res.valid) { setLocked(drag); setError('') } else setError(res.msg); setDrag(null) };

    useEffect(() => {
        if (stage !== 'approach') return;
        let raf, startTs;
        const step = ts => {
            if (!startTs) startTs = ts;
            const p = Math.min(1, (ts - startTs) / 1300);
            setT(p);
            if (p < 1) raf = requestAnimationFrame(step);
            else {
                const raw = ((cfg.windowCenter + cfg.windowWidth / 2 - locked.angle) + 720) % 360;
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
        const duration = Math.max(1800, sweepDeg / 18 * 1000);
        let raf, startTs;
        const step = ts => {
            if (!startTs) startTs = ts;
            const p = Math.min(1, (ts - startTs) / duration);
            setSweepT(p);
            if (p < 1) raf = requestAnimationFrame(step);
            else { setStage('plot'); setLocked(null); setDrag(null); setT(0); setSweepT(0); setError('BURN WINDOW EXPIRED · REPLOT TRAJECTORY') }
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [stage, sweepDeg]);

    useEffect(() => {
        if (stage !== 'success') return;
        if (window.parent !== window) { const id = setTimeout(() => window.parent.postMessage({ type: 'repair-complete' }, '*'), 1200); return () => clearTimeout(id) }
    }, [stage]);

    const fireCircularization = () => {
        if (!inWindow) { setStage('plot'); setLocked(null); setDrag(null); setT(0); setSweepT(0); setError('CIRCULARIZATION MISSED · TRAJECTORY DECAYED · REPLOT BURN'); return }
        setStage('success');
    };

    const active = locked || drag;
    const evalNow = evaluateMag(drag);
    const pts = stage === 'plot' && active ? points(active) : null;
    const approachPts = locked ? points(locked) : null;
    const currentAngle = stage === 'coast' && locked ? (locked.angle + sweepDeg * sweepT) % 360 : null;
    const inWindow = currentAngle != null && angDelta(currentAngle, cfg.windowCenter) <= cfg.windowWidth / 2;
    const nearWindow = !inWindow && currentAngle != null && angDelta(currentAngle, cfg.windowCenter) <= cfg.windowWidth / 2 + 18;
    const trail = stage === 'coast' && locked ? Array.from({ length: 25 }, (_, i) => polar(locked.angle + sweepDeg * sweepT * i / 24, cfg.r2)) : [];
    const satNow = stage === 'approach' && approachPts ? bezierAt(approachPts, t) : stage === 'coast' && currentAngle != null ? polar(currentAngle, cfg.r2) : stage === 'success' ? polar(cfg.windowCenter, cfg.r2) : satStart;
    const arcPts = Array.from({ length: 9 }, (_, i) => polar(cfg.windowCenter - cfg.windowWidth / 2 + cfg.windowWidth * i / 8, cfg.r2));
    const sectorPath = `M ${cx} ${cy} L ${arcPts.map(p => p.join(',')).join(' L ')} Z`;
    const [wlx, wly] = polar(cfg.windowCenter, cfg.r2 + 16);

    const captionText = stage === 'plot' ? (locked ? 'BURN PLOTTED · IGNITE WHEN READY' : drag ? (evalNow.valid ? 'HOLD STEADY · RELEASE TO LOCK' : 'OUT OF TOLERANCE') : 'HOLD THE SATELLITE · DRAG TO PLOT BURN') : stage === 'approach' ? 'TRANSFER BURN UNDERWAY' : stage === 'coast' ? (inWindow ? 'INSERTION WINDOW OPEN · FIRE NOW' : nearWindow ? 'WINDOW APPROACHING · STAND BY' : 'COASTING · AWAIT INSERTION WINDOW') : 'CIRCULARIZATION COMPLETE';
    const captionColor = stage === 'coast' ? (inWindow ? '#c9ff4d' : nearWindow ? '#ffd166' : '#89948d') : stage === 'plot' && drag && !evalNow.valid ? '#ff5964' : (locked || stage !== 'plot') ? '#c9ff4d' : '#89948d';
    const readoutText = stage === 'plot' ? (locked ? 'BURN PLOTTED · READY TO IGNITE' : drag ? `BURN RADIUS ${Math.round(drag.dist)} · TARGET ${Math.round(cfg.r2)}±${cfg.radiusTol}` : 'AWAITING BURN PLOT') : stage === 'approach' ? 'IGNITING TRANSFER BURN' : stage === 'coast' ? (inWindow ? 'FIRE CIRCULARIZATION NOW' : nearWindow ? 'STAND BY · WINDOW APPROACHING' : 'COASTING TO INSERTION WINDOW') : 'ORBIT STABLE';
    const readoutColor = stage === 'coast' ? (inWindow ? 'var(--green)' : nearWindow ? 'var(--yellow)' : '#89948d') : stage === 'plot' ? (locked ? 'var(--green)' : drag ? (evalNow.valid ? 'var(--green)' : 'var(--red)') : 'var(--yellow)') : 'var(--yellow)';

    return <>
        <Header title="ORBITAL BURN" sub={`ORBIT ${cfg.raiseMode ? 'DECAYING' : 'OVER-BOOSTED'} · TWO-BURN TRANSFER REQUIRED`} />
        <p className="instructions">Drag from the satellite to plot a transfer burn onto the home orbital plane — not too hot, not too weak. Ignite the burn, then watch the coast: fire the circularization burn only while the satellite is inside the insertion window, or the orbit stays unstable and you'll have to replot.</p>
        <div style={{ display: 'grid', placeItems: 'center', margin: '24px 0' }}>
            <svg viewBox="0 0 300 300" width="320" height="320" style={{ background: '#0c1210', border: '1px solid #34403a', cursor: stage === 'plot' && !locked ? 'crosshair' : 'default', touchAction: 'none' }} onPointerDown={start} onPointerMove={move} onPointerUp={release} onPointerCancel={release}>
                <circle cx={cx} cy={cy} r={cfg.minSafeR} fill="rgba(255,89,100,.12)" stroke="#ff5964" strokeWidth="1" strokeDasharray="2 4" />
                <circle cx={cx} cy={cy} r={cfg.r1} fill="none" stroke="#ff5964" strokeWidth="1.5" strokeDasharray="3 5" opacity=".75" />
                <circle cx={cx} cy={cy} r={cfg.r2} fill="none" stroke="#3b4540" strokeWidth="2" />
                <path d={sectorPath} fill={inWindow ? 'rgba(201,255,77,.38)' : 'rgba(201,255,77,.14)'} stroke={inWindow ? '#c9ff4d' : '#5c6b60'} strokeWidth={inWindow ? 2.5 : 1.5} />
                <circle cx={cx} cy={cy} r="13" fill="#eef4eb" />
                {pts && <path d={pathD(pts)} fill="none" stroke={locked ? '#c9ff4d' : evalNow.valid ? '#c9ff4d' : '#ff5964'} strokeWidth={locked ? 3 : 2} strokeDasharray={locked ? undefined : '5 4'} style={locked ? { filter: 'drop-shadow(0 0 6px #c9ff4d)' } : {}} />}
                {stage === 'approach' && approachPts && <path d={pathD(approachPts)} fill="none" stroke="#c9ff4d" strokeWidth="3" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - t} style={{ filter: 'drop-shadow(0 0 8px #c9ff4d)' }} />}
                {stage === 'coast' && <polyline points={trail.map(p => p.join(',')).join(' ')} fill="none" stroke="#c9ff4d" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 8px #c9ff4d)' }} />}
                <circle cx={satNow[0]} cy={satNow[1]} r={stage === 'plot' ? 7 : 5} fill={locked || stage !== 'plot' ? '#c9ff4d' : '#eef4eb'} style={locked || stage !== 'plot' ? { filter: 'drop-shadow(0 0 8px #c9ff4d)' } : {}} />
                <text x={wlx} y={wly} textAnchor="middle" fill={inWindow ? '#c9ff4d' : '#7f8c84'} fontSize="8">INSERTION WINDOW</text>
                <text x="150" y="292" textAnchor="middle" fontSize="9" fill={captionColor}>{captionText}</text>
            </svg>
        </div>
        <div className="readout" style={{ color: readoutColor }}>{readoutText}</div>
        <div className="legend"><span><i className="dot green" />INSERTION WINDOW</span><span><i className="dot redbg" />MIN SAFE ALTITUDE</span></div>
        {stage === 'plot' && locked && <div className="actions"><button className="action" onClick={() => setStage('approach')}>ORBIT RAISING MANEUVER</button><button className="action" onClick={() => { setLocked(null); setError('') }}>REPLOT</button></div>}
        {stage === 'coast' && <div className="actions"><button className="action" style={{ borderColor: inWindow ? 'var(--green)' : nearWindow ? 'var(--yellow)' : '#39453f', color: inWindow ? 'var(--green)' : nearWindow ? 'var(--yellow)' : '#85908a' }} onClick={fireCircularization}>FIRE CIRCULARIZATION BURN</button></div>}
        {stage === 'success' ? <div className="success">CIRCULARIZATION ACCURATE · ORBIT {cfg.raiseMode ? 'RAISED' : 'LOWERED'} INTO HOME PLANE</div> : (error && stage === 'plot') ? <div className="failure">{error}</div> : null}
    </>;
}
function Sensor() { const [pick, setPick] = useState(null), [fault] = useState(() => shuffle(['A', 'B', 'C'])[0]), [vals] = useState(() => { const out = { A: 71, B: 71, C: 71 }; out[fault] = 88 + Math.floor(Math.random() * 9); return out }); return <><Header title="SENSOR FAULT" sub="TEMPERATURE STREAMS DISAGREE" /><p className="instructions">Compare the redundant sensors. Select the outlier and switch it offline.</p><div className="pixel-grid">{['A', 'B', 'C'].map(x => <button className={'node ' + (pick === x ? (x === fault ? 'done' : 'fail') : '')} onClick={() => setPick(x)} key={x}>SENSOR {x}<br /><small>{vals[x]}°C</small></button>)}</div><Result ok={pick === fault}>{pick === fault ? `SENSOR ${fault} ISOLATED · CONSENSUS RESTORED` : 'One stream is statistically abnormal.'}</Result></> }
function Attitude() { const [a, setA] = useState(-28); const ok = Math.abs(a) <= 3; return <><Header title="ATTITUDE DRIFT" sub="POINTING ERROR 28° · ANTENNA MISALIGNED" /><p className="instructions">Use the reaction wheels to bring the antenna back to Earth-pointing. Stop inside the narrow lock window.</p><div className="readout">{a}°</div><input className="range" type="range" min="-90" max="90" value={a} onChange={e => setA(+e.target.value)} /><Result ok={ok}>{ok ? 'ATTITUDE LOCKED · DOWNLINK READY' : 'Fine-tune the pointing error to ±3°.'}</Result></> }
function genStarSetup() {
    const N = 7, TRUE = 6;
    const cells = []; for (let r = 0; r < N; r++)for (let c = 0; c < N; c++)cells.push([c, r]);
    const chosen = shuffle(cells).slice(0, TRUE);
    const trueStars = chosen.map(([c, r], i) => ({ id: 't' + i, col: c, row: r, bright: Math.random() < .5 }));
    const pool = shuffle(trueStars.map(t => ({ id: t.id, bright: t.bright, real: true })));
    return { N, trueStars, pool };
}
function StarTracker() {
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
        dragRef.current = d; setDrag(d);
    };
    useEffect(() => {
        if (!drag) return;
        const move = e => {
            const d = { ...dragRef.current, dx: e.clientX - dragRef.current.startX, dy: e.clientY - dragRef.current.startY };
            dragRef.current = d; setDrag(d);
        };
        const up = e => {
            const cur = dragRef.current;
            if (!cur) return;
            const star = pool.find(s => s.id === cur.id);
            const box = gridRef.current.getBoundingClientRect();
            const x = e.clientX - box.left, y = e.clientY - box.top;
            const inGrid = x >= -6 && y >= -6 && x < SIZE + 6 && y < SIZE + 6;
            const col = Math.floor(x / CELL), row = Math.floor(y / CELL), key = `${col},${row}`;
            const target = trueStars.find(t => t.col === col && t.row === row);
            const match = inGrid && star.real && target && target.bright === star.bright && !placed[key];
            if (match) { setPlaced(p => ({ ...p, [key]: star.id })) }
            else if (inGrid) {
                setFlash(star.id); setTimeout(() => setFlash(null), 380);
                setStrikes(s => { const n = s + 1; if (n >= 3) { setPlaced({}); return 0 } return n });
            }
            dragRef.current = null; setDrag(null);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) };
    }, [drag && drag.id]);
    return <>
        <Header title="STAR TRACKER LOCK" sub="LOST LOCK · CATALOG MATCH REQUIRED" />
        <p className="instructions">The tracker's catalog reference is on the left. Drag stars from the rack onto the sensor grid to rebuild the same pattern — any bright star fills a bright slot, any dim star fills a dim slot, but the position has to be right. Wrong drops cost a strike; three strikes clears the grid.</p>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 18 }}>
            <div>
                <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#7b8580', marginBottom: 8 }}>CATALOG REF · SECTOR 14-B</div>
                <div style={{ width: N * 14, height: N * 14, position: 'relative', background: '#0d1211', border: '1px solid #27302d', backgroundImage: 'linear-gradient(#1a221e 1px,transparent 1px),linear-gradient(90deg,#1a221e 1px,transparent 1px)', backgroundSize: '14px 14px' }}>
                    {trueStars.map(t => <div key={t.id} style={{ position: 'absolute', left: t.col * 14 + 7, top: t.row * 14 + 7, width: t.bright ? 7 : 4, height: t.bright ? 7 : 4, borderRadius: '50%', background: 'var(--green)', opacity: t.bright ? 1 : .55, boxShadow: t.bright ? '0 0 6px var(--green)' : 'none', transform: 'translate(-50%,-50%)' }} />)}
                </div>
            </div>
            <div>
                <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#7b8580', marginBottom: 8 }}>SENSOR GRID · {strikes}/3 MISALIGN STRIKES</div>
                <div ref={gridRef} style={{ width: SIZE, height: SIZE, position: 'relative', background: '#0d1211', border: '1px solid #39453f', backgroundImage: 'linear-gradient(#1c2521 1px,transparent 1px),linear-gradient(90deg,#1c2521 1px,transparent 1px)', backgroundSize: `${CELL}px ${CELL}px`, touchAction: 'none' }}>
                    {Object.entries(placed).map(([key]) => { const [c, r] = key.split(',').map(Number); const t = trueStars.find(s => s.col === c && s.row === r); return <div key={key} style={{ position: 'absolute', left: c * CELL + CELL / 2, top: r * CELL + CELL / 2, width: t.bright ? 15 : 9, height: t.bright ? 15 : 9, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 12px var(--green)', transform: 'translate(-50%,-50%)' }} /> })}
                </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#7b8580', marginBottom: 8 }}>CANDIDATE RACK</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, minHeight: 150 }}>
                    {pool.filter(s => !placedIds.has(s.id)).map(s => {
                        const dragging = drag && drag.id === s.id;
                        const style = { width: 40, height: 40, border: '1px solid ' + (flash === s.id ? 'var(--red)' : '#39453f'), background: '#0d1211', position: 'relative', cursor: 'grab', touchAction: 'none', transition: dragging ? 'none' : 'border-color .2s', zIndex: dragging ? 5 : 1 };
                        if (dragging) style.transform = `translate(${drag.dx}px,${drag.dy}px)`, style.cursor = 'grabbing';
                        return <div key={s.id} onPointerDown={e => onDown(e, s)} style={style}>
                            <div style={{ position: 'absolute', left: '50%', top: '50%', width: s.bright ? 11 : 6, height: s.bright ? 11 : 6, borderRadius: '50%', background: flash === s.id ? 'var(--red)' : 'var(--green)', opacity: s.bright ? 1 : .55, boxShadow: s.bright ? `0 0 7px ${flash === s.id ? 'var(--red)' : 'var(--green)'}` : 'none', transform: 'translate(-50%,-50%)' }} />
                        </div>
                    })}
                </div>
            </div>
        </div>
        <Result ok={ok}>{ok ? 'PATTERN MATCHED · LOCK REACQUIRED' : 'Match the catalog reference exactly to reacquire lock.'}</Result>
    </>
}
function Impact() { const [pick, setPick] = useState(null), [fault] = useState(() => shuffle(['COMMS', 'POWER', 'THERMAL', 'PAYLOAD', 'GUIDANCE', 'BATTERY'])[0]); return <><Header title="MODULE IMPACT" sub="PRESSURE LOSS · STRUCTURAL BREACH DETECTED" /><p className="instructions">Isolate the damaged module before the pressure loss spreads. The breach location varies by incident.</p><div className="pixel-grid">{['COMMS', 'POWER', 'THERMAL', 'PAYLOAD', 'GUIDANCE', 'BATTERY'].map(x => <button className={'module ' + (pick === x ? (x === fault ? 'done' : 'fail') : '')} onClick={() => setPick(x)} key={x}>{x}</button>)}</div><Result ok={pick === fault}>{pick === fault ? 'MODULE ISOLATED · PRESSURE STABLE' : 'Trace the pressure-loss indicator to the damaged module.'}</Result></> }
function Radiation() { const [t, setT] = useState(0); useEffect(() => { if (t > 0) { const id = setTimeout(() => setT(t - 1), 1000); return () => clearTimeout(id) } }, [t]); return <><Header title="RADIATION EVENT" sub="SOLAR PARTICLE FLUX ELEVATED" /><p className="instructions">This is a transient event. Enter shielding protocol, then wait. Intervening too early risks unnecessary degradation.</p><div className="readout">{t ? `FLUX FALLING · ${t}s` : 'FLUX NOMINAL'}</div><button className="action" onClick={() => setT(8)} disabled={t > 0}>{t ? 'WAITING FOR CLEAR' : 'ENTER SHIELDING PROTOCOL'}</button><Result ok={t === 0 && false}>{t === 0 ? 'Wait for the event to pass without cycling power.' : ''}</Result></> }
function App() { const requested = new URLSearchParams(location.search).get('type'); const [type, setType] = useState(games.some(g => g[0] === requested) ? requested : 'thermal'); const C = { thermal: Thermal, power: Power, solar: Solar, contact: Contact, wheel: ReactionWheel, process: Process, orbit: Orbit, sensor: Sensor, attitude: Attitude, startracker: StarTracker, impact: Impact, radiation: Radiation }[type]; return <Frame type={type} setType={setType}><C /></Frame> }; ReactDOM.createRoot(document.getElementById('root')).render(<App />);

