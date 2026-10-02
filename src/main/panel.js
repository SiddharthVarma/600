import { termReset, termSat } from './terminal.js';

export const panel = document.getElementById('panel');
export const chart = document.getElementById('chart'),
  cctx = chart.getContext('2d');
const chartConfigs = {
  TEMPERATURE: { title: 'TEMPERATURE / HISTORY', threshold: 0.7 },
  POWER: { title: 'POWER OUTPUT / HISTORY', threshold: 0.55 },
  BATTERY: { title: 'BATTERY PACK / HISTORY', threshold: 0.35 },
  RSSI: { title: 'RSSI / CONTACT HISTORY', threshold: 0.68 },
  CPU: { title: 'CPU LOAD / HISTORY', threshold: 0.85 },
  ALTITUDE: { title: 'ORBITAL ALTITUDE / HISTORY', threshold: 0.35 },
  TORQUE: { title: 'TORQUE MARGIN / HISTORY', threshold: 0.4 },
  POINTING: { title: 'ATTITUDE POINTING ERROR / HISTORY', threshold: 0.62 },
};
export function renderSat(s) {
  panel.classList.remove('fleet');
  document.getElementById('panelEyebrow').textContent = 'Investigation / Orbital relay';
  if (termSat !== s) termReset(s);
  document.getElementById('satName').textContent = `SATELLITE ${String(s.id).padStart(3, '0')}`;
  const label =
    s.anomalyType === 'orbit'
      ? 'ORBITAL DECAY'
      : s.anomalyType === 'solar'
        ? 'SOLAR ARRAY MISALIGNED'
        : s.anomalyType === 'startracker'
          ? 'STAR TRACKER LOST LOCK'
          : s.anomalyType === 'contact'
            ? 'MISSED CONTACT WINDOW'
            : s.anomalyType === 'wheel'
              ? 'REACTION WHEEL FAULT'
              : s.anomalyType === 'power'
                ? 'POWER INSTABILITY'
                : s.anomalyType === 'process'
                  ? 'CPU OVERLOAD'
                  : s.anomalyType === 'flare'
                    ? 'RADIO BLACKOUT'
                    : s.anomalyType === 'debris'
                      ? 'DEBRIS ON COLLISION COURSE'
                      : s.anomalyType === 'bitflip'
                        ? 'MEMORY CORRUPTED'
                        : s.anomalyType === 'kraken'
                          ? '????????'
                          : s.anomaly
                            ? 'DEGRADED'
                            : 'NOMINAL';
  document.getElementById('status').textContent = `STATUS: ${label}`;
  document.getElementById('status').className = 'status ' + (s.anomaly ? 'degraded' : 'ok');
  const el = document.getElementById('telemetry');
  el.innerHTML = '';
  Object.entries(s.values).forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className =
      'metric ' +
      (s.anomaly &&
      ((s.anomalyType === 'thermal' && k === 'TEMPERATURE') ||
        (s.anomalyType === 'orbit' && k === 'POWER') ||
        (s.anomalyType === 'solar' && k === 'BATTERY') ||
        (s.anomalyType === 'wheel' && k === 'TORQUE') ||
        (s.anomalyType === 'contact' && k === 'RSSI'))
        ? 'hot'
        : '');
    row.innerHTML = `<div class="metric-head"><span class="metric-name">${k}</span><span class="metric-value">${k === 'RSSI' ? '-' + v + ' dBm' : k === 'TEMPERATURE' ? v + '°C' : v + '%'}</span></div><div class="bar"><i style="width:${Math.min(v, 100)}%"></i></div>`;
    row.onclick = () => {
      drawChart(k, v, s.anomalyType);
    };
    el.appendChild(row);
  });
  const defaultKey =
    s.anomalyType === 'thermal'
      ? 'TEMPERATURE'
      : s.anomalyType === 'power'
        ? 'POWER'
        : s.anomalyType === 'solar'
          ? 'BATTERY'
          : s.anomalyType === 'wheel'
            ? 'TORQUE'
            : s.anomalyType === 'startracker'
              ? 'POINTING'
              : s.anomalyType === 'contact'
                ? 'RSSI'
                : s.anomalyType === 'process'
                  ? 'CPU'
                  : s.anomalyType === 'orbit'
                    ? 'ALTITUDE'
                    : 'TEMPERATURE';
  drawChart(defaultKey, defaultKey === 'ALTITUDE' || defaultKey === 'POINTING' ? 100 : s.values[defaultKey], s.anomalyType);
  if (s.anomaly && s.countdown > 0)
    document.getElementById('log').textContent =
      s.anomalyType === 'orbit' ? `ORBIT DECAY · IMPACT IN ${s.countdown}s` : `SATELLITE LOST IN ${s.countdown}s IF UNRESOLVED`;
}
function drawChart(key, val, type) {
  const cfg = chartConfigs[key] || { title: `${key} / HISTORY`, threshold: null };
  document.getElementById('chartTitle').textContent = cfg.title;
  const w = chart.clientWidth,
    h = 90;
  cctx.clearRect(0, 0, w, h);
  cctx.strokeStyle = '#252c29';
  cctx.lineWidth = 1;
  cctx.beginPath();
  for (let y = 15; y < h; y += 25) {
    cctx.moveTo(0, y);
    cctx.lineTo(w, y);
  }
  cctx.stroke();
  if (cfg.threshold) {
    const ty = h - 15 - cfg.threshold * (h - 25);
    cctx.strokeStyle = '#ff4d4d';
    cctx.setLineDash([4, 4]);
    cctx.beginPath();
    cctx.moveTo(0, ty);
    cctx.lineTo(w, ty);
    cctx.stroke();
    cctx.setLineDash([]);
  }
  const points = [];
  for (let i = 0; i < 40; i++) {
    let n = Math.min(1, Math.max(0, (val || 0) / 100));
    if (type === 'orbit') n = Math.max(0.12, 1 - i * 0.022);
    if (type === 'power') n = 0.58 + Math.sin(i * 1.1) * 0.16 + (i > 27 ? 0.1 : 0);
    if (type === 'wheel') n = 0.36 + Math.sin(i * 1.4) * 0.06 - (i > 18 ? (i - 18) * 0.012 : 0);
    if (type === 'process') n = 0.42 + (i > 25 ? (i - 25) * 0.025 : Math.sin(i) * 0.03);
    if (type === 'thermal') n = 0.48 + (i > 20 ? (i - 20) * 0.018 : Math.sin(i * 0.4) * 0.025);
    if (type === 'startracker') n = 0.12 + i * 0.0195 + Math.sin(i * 0.6) * 0.025;
    if (type === 'solar') n = Math.max(0.06, 0.7 - i * 0.0145 + Math.sin(i * 0.5) * 0.02);
    points.push({ x: (i * w) / 39, y: h - 15 - n * (h - 25), n });
  }
  const normalColor =
    key === 'TEMPERATURE' ? '#c9f75f' : key === 'POWER' ? '#ffd166' : key === 'CPU' ? '#58a6ff' : key === 'TORQUE' ? '#c58cff' : '#c9f75f';
  const lowIsBad = key === 'ALTITUDE' || key === 'TORQUE' || key === 'BATTERY';
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      danger = cfg.threshold && (lowIsBad ? (a.n + b.n) / 2 < cfg.threshold : (a.n + b.n) / 2 > cfg.threshold);
    cctx.strokeStyle = danger ? '#ff4d4d' : normalColor;
    cctx.lineWidth = 1.7;
    cctx.beginPath();
    cctx.moveTo(a.x, a.y);
    cctx.lineTo(b.x, b.y);
    cctx.stroke();
  }
  points.forEach(p => {
    const danger = cfg.threshold && (lowIsBad ? p.n < cfg.threshold : p.n > cfg.threshold);
    if (danger) {
      cctx.fillStyle = '#ff4d4d';
      cctx.beginPath();
      cctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
      cctx.fill();
    }
  });
}
