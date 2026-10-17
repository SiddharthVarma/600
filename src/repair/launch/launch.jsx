import { useEffect, useRef, useState } from 'react';
import { brackets, fitWidth, hudText, pixelFont, report } from '../science/common.js';

// A rideshare launch to replace lost satellites. It opens over the pad at Vandenberg, seen from above as the main
// screen's dive arrives, fades to the rocket on the pad for the countdown, then plays in four phases: the first stage climbs through max-Q (the player
// throttles down to keep the dynamic pressure out of the red), stages separate, the second stage climbs out of the air
// (the player drops the fairing once aerodynamic heating is low enough), and the satellites deploy. A mistake recycles
// that phase; nothing is lost.
//
// The ascent is a point mass in SI units: thrust over a mass that burns down with the throttle, gravity along a
// scheduled flight-path angle (a gravity turn from vertical to 30°), and an exponential atmosphere. Dynamic pressure is
// q = ½ρv²; free-molecular heating on the fairing is ½ρv³, and fairings are dropped once it falls below 1135 W/m².
// Throttling down through max-Q costs gravity losses: hold it too long and stage 1 cuts off below the speed it needs.
const BW = 160,
  BH = 120,
  SCALE = 4,
  FIT = fitWidth(BW * SCALE, BH * SCALE);
const COUNT = Math.max(1, Math.min(4, parseInt(new URLSearchParams(location.search).get('count'), 10) || 1));
const G = 9.81,
  THRUST = 15.5, // stage 1 thrust per unit lift-off mass, m/s²
  BURN = 0.7 / 150, // propellant fraction burnt per second at full throttle
  DRY = 0.3, // mass fraction left at main engine cutoff
  THROTTLE_LOW = 0.6,
  SLEW = 0.1, // throttle change per mission second
  Q_MAX = 32000, // Pa
  Q_SCALE = 45000, // top of the gauge
  V_MECO = 2500, // m/s needed at stage 1 cutoff
  HEAT_LIMIT = 1135, // W/m²
  WARP_ASCENT = 12, // mission seconds per real second
  WARP_COAST = 5;
const PAD_TIME = 3, // real seconds over the pad from above, the last FADE of it fading to black
  FADE = 0.45,
  COUNTDOWN = 3,
  SEP_TIME = 2.6,
  DEPLOY_GAP = 0.7,
  FLASH_TIME = 2;
const rho = h => (h < 80000 ? 1.225 * Math.exp(-h / 8500) : 1.225 * Math.exp(-80000 / 8500) * Math.exp(-(h - 80000) / 6000));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fresh = () => ({ T: 0, h: 0, v: 0, m: 1, thr: 1, gam: 90, q: 0, heat: 0, hold: false, at: 0, maxQ: 0 });

// the sky by altitude, from blue at the pad to black above the air
const SKY = [
  [0, [96, 170, 255]],
  [8000, [52, 98, 200]],
  [25000, [20, 32, 90]],
  [50000, [6, 8, 20]],
  [80000, [2, 3, 6]],
];
function sky(h) {
  for (let i = 1; i < SKY.length; i++)
    if (h < SKY[i][0]) {
      const [h0, a] = SKY[i - 1],
        [h1, b] = SKY[i],
        k = (h - h0) / (h1 - h0);
      return `rgb(${a.map((c, j) => Math.round(c + (b[j] - c) * k)).join(',')})`;
    }
  return 'rgb(2,3,6)';
}
const STARS = Array.from({ length: 70 }, () => [Math.floor(Math.random() * BW), Math.floor(Math.random() * BH), Math.random()]),
  CLOUDS = Array.from({ length: 7 }, (_, i) => ({ alt: 1500 + i * 900 + Math.random() * 500, x: Math.random() * BW, w: 18 + Math.random() * 26 }));
// The launch complex from above, as the dive arrives: the Pacific to the west, surf and sand, chaparral, roads, the pad
// with its flame trench, tower and lightning masts, and the rocket on it, a white dot casting a shadow.
const PAD_AT = [99.5, 59.5];
function makeAerial() {
  const c = document.createElement('canvas');
  c.width = BW;
  c.height = BH;
  const g = c.getContext('2d'),
    img = g.createImageData(BW, BH),
    d = img.data,
    hash = (x, y) => {
      const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const coast = 34 + Math.sin(y * 0.06) * 6 + Math.sin(y * 0.17 + 1) * 2,
        n = hash(x >> 1, y >> 1);
      let col;
      if (x < coast - 2) col = hash(x, y) < 0.06 ? [70, 120, 190] : x > coast - 8 ? [52, 104, 170] : [36, 82, 150];
      else if (x < coast - 1) col = [214, 228, 238];
      else if (x < coast) col = [205, 186, 140];
      else if (hash(x, y) < 0.06) col = [80, 92, 58];
      else col = n < 0.33 ? [122, 124, 78] : n < 0.66 ? [138, 136, 88] : [104, 112, 70];
      const i = (y * BW + x) * 4;
      d[i] = col[0];
      d[i + 1] = col[1];
      d[i + 2] = col[2];
      d[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const shadowed = (x, y, w, h, fill) => {
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(x + 2, y + 1, w, h);
    g.fillStyle = fill;
    g.fillRect(x, y, w, h);
  };
  g.fillStyle = '#6e6c64';
  g.fillRect(116, 62, BW - 116, 2);
  g.fillRect(130, 0, 2, BH);
  g.fillStyle = '#9d988c';
  g.fillRect(84, 48, 32, 28);
  g.fillStyle = '#bdb8ac';
  g.fillRect(85, 49, 30, 26);
  g.fillStyle = '#3b3a35';
  g.fillRect(97, 62, 5, 16);
  shadowed(104, 55, 3, 9, '#5b6266');
  [
    [86, 50],
    [113, 50],
    [86, 73],
    [113, 73],
  ].forEach(([x, y]) => shadowed(x, y, 1, 1, '#4a4f52'));
  [
    [121, 67, 8, 5],
    [136, 40, 6, 4],
    [140, 70, 5, 6],
  ].forEach(([x, y, w, h]) => shadowed(x, y, w, h, '#d6d3cb'));
  g.fillStyle = 'rgba(0,0,0,.4)';
  g.fillRect(100, 59, 6, 2);
  g.fillStyle = '#e8ecef';
  g.fillRect(98, 58, 3, 3);
  g.fillStyle = '#b3bcc4';
  g.fillRect(100, 59, 1, 2);
  return c;
}
const WHITE = '#e8ecef',
  SHADE = '#b3bcc4',
  BLACK = '#15181a';

// the rocket, drawn upright in its own little canvas around (RX, RY) = the top of stage 1, then tilted into the scene
const RW = 64,
  RH = 128,
  RX = 32,
  RY = 44;
function body(c, x, y, w, h) {
  c.fillStyle = WHITE;
  c.fillRect(x, y, w, h);
  c.fillStyle = SHADE;
  c.fillRect(x + w - 1, y, 1, h);
}
function plume(c, x, y, len, wide, vac) {
  // sea level: a tight bright flame; with altitude (and in vacuum) the exhaust balloons out and fades
  const cols = vac ? ['rgba(255,246,220,.9)', 'rgba(255,200,140,.55)', 'rgba(150,170,255,.3)'] : ['#fff6c8', '#ffd166', '#ff8a3d'];
  for (let i = 0; i < len; i++) {
    const k = i / len,
      w = Math.round(1 + wide * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - k * 0.3)) + (Math.random() < 0.3 ? 1 : 0);
    c.fillStyle = cols[Math.min(2, Math.floor(k * 3 + Math.random() * 0.6))];
    c.fillRect(x - w, y + i, w * 2 + 1, 1);
  }
}
function satellite(c, x, y, open) {
  c.fillStyle = '#cfd6dc';
  c.fillRect(x, y, 5, 2);
  c.fillStyle = '#7d8a94';
  c.fillRect(x + 4, y, 1, 2);
  if (open) {
    c.fillStyle = '#2a4d9a';
    c.fillRect(x + 5, y, open, 1);
    c.fillStyle = '#4f7fd8';
    c.fillRect(x + 5, y + 1, open, 1);
  }
}

export function Launch() {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('pad'); // pad → count → ascent → sep → coast → deploy → done
  const [flash, setFlash] = useState(null); // a failed phase, shown before it recycles
  const live = useRef({ phase: 'pad', flash: null });
  live.current.phase = phase;
  live.current.flash = flash;
  const sim = useRef(fresh()),
    saved = useRef(null); // the flight as stage 2 lit, to retry the fairing from
  const go = p => {
    live.current.phase = p;
    setPhase(p);
    sim.current.at = performance.now() / 1000;
  };
  // a failed phase: say what went wrong, then recycle to the pad (stage 1) or to stage 2 lighting (the fairing)
  const fail = (msg, back) => {
    live.current.flash = msg;
    setFlash(msg);
    setTimeout(() => {
      live.current.flash = null;
      setFlash(null);
      sim.current = back === 'pad' ? fresh() : { ...saved.current };
      go(back === 'pad' ? 'count' : 'coast');
    }, FLASH_TIME * 1000);
  };

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d'),
      buf = document.createElement('canvas'),
      rocket = document.createElement('canvas'),
      aerial = makeAerial();
    buf.width = BW;
    buf.height = BH;
    rocket.width = RW;
    rocket.height = RH;
    const b = buf.getContext('2d'),
      r = rocket.getContext('2d');
    sim.current.at = performance.now() / 1000;
    let raf,
      last = performance.now() / 1000,
      reported = false;
    const loop = () => {
      const now = performance.now() / 1000,
        dt = Math.min(0.05, now - last),
        s = sim.current,
        { phase, flash } = live.current,
        since = now - s.at;
      last = now;

      // ---- the physics ----
      if (!flash) {
        if (phase === 'pad' && since >= PAD_TIME) go('count');
        else if (phase === 'count' && since >= COUNTDOWN) go('ascent');
        else if (phase === 'ascent') {
          for (let k = 0, n = Math.ceil((dt * WARP_ASCENT) / 0.05); k < n; k++) {
            const d = (dt * WARP_ASCENT) / n;
            s.thr += clamp((s.hold ? THROTTLE_LOW : 1) - s.thr, -SLEW * d, SLEW * d);
            s.gam = 90 - Math.min(60, Math.max(0, s.T - 8) * 0.45);
            const sg = Math.sin((s.gam * Math.PI) / 180);
            s.v += ((THRUST * s.thr) / s.m - G * sg) * d;
            s.h += s.v * sg * d;
            s.m -= BURN * s.thr * d;
            s.T += d;
            s.q = 0.5 * rho(s.h) * s.v * s.v;
            s.maxQ = Math.max(s.maxQ, s.q);
          }
          if (s.q > Q_MAX) fail('MAX-Q EXCEEDED · SCRUB · RECYCLING', 'pad');
          else if (s.m <= DRY) {
            if (s.v < V_MECO) fail('TOO SLOW AT STAGE 1 CUTOFF · SCRUB · RECYCLING', 'pad');
            else go('sep');
          }
        } else if (phase === 'sep' || phase === 'coast' || phase === 'deploy') {
          // coasting through separation, then the second stage burns on, pitching toward horizontal
          const d = dt * WARP_COAST,
            burning = phase !== 'sep' || since > SEP_TIME * 0.6;
          s.gam = Math.max(0, s.gam - 0.25 * d);
          const sg = Math.sin((s.gam * Math.PI) / 180);
          s.v += ((burning ? 9 : 0) - G * sg) * d;
          s.h += s.v * sg * d;
          s.T += d;
          s.heat = 0.5 * rho(s.h) * s.v ** 3;
          if (phase === 'sep' && since >= SEP_TIME) {
            saved.current = { ...s, hold: false };
            go('coast');
          }
          if (phase === 'deploy' && since > 1 + COUNT * DEPLOY_GAP + 1.2 && !reported) {
            reported = true;
            report({ type: 'launch-complete', count: COUNT });
            go('done');
          }
        }
      }

      // ---- the picture ----
      if (phase === 'pad') {
        // over the pad, easing in on the rocket, then fading to black
        const k = clamp(since / PAD_TIME, 0, 1),
          z = 1 + 0.45 * k * k * (3 - 2 * k),
          sw = BW / z,
          sh = BH / z;
        b.imageSmoothingEnabled = false;
        b.drawImage(aerial, clamp(PAD_AT[0] - sw / 2, 0, BW - sw), clamp(PAD_AT[1] - sh / 2, 0, BH - sh), sw, sh, 0, 0, BW, BH);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf, 0, 0, ctx.canvas.width, ctx.canvas.height);
        hudText(ctx, 'ACQUIRING · 34.6°N 120.6°W', 'left', 'top');
        hudText(ctx, 'PAD 1', 'right', 'top');
        brackets(ctx);
        ctx.fillStyle = `rgba(0,0,0,${clamp((since - (PAD_TIME - FADE)) / FADE, 0, 1)})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        raf = requestAnimationFrame(loop);
        return;
      }
      const h = s.h,
        tilt = (Math.min(30, (90 - s.gam) * 0.5) * Math.PI) / 180;
      b.fillStyle = sky(h);
      b.fillRect(0, 0, BW, BH);
      const starA = clamp((h - 20000) / 30000, 0, 1);
      STARS.forEach(([x, y, a]) => {
        if (starA * a < 0.15) return;
        b.fillStyle = `rgba(230,236,255,${starA * a})`;
        b.fillRect(x, y, 1, 1);
      });
      // the Earth's limb, once high enough to see the curve
      const limb = clamp((h - 60000) / 30000, 0, 1);
      if (limb > 0) {
        const R = 260,
          top = BH - 16 * limb;
        b.fillStyle = `rgba(110,170,255,${0.5 * limb})`;
        b.beginPath();
        b.arc(BW / 2, top + R - 1, R, 0, Math.PI * 2);
        b.fill();
        b.fillStyle = `rgba(40,80,170,${limb})`;
        b.beginPath();
        b.arc(BW / 2, top + R + 1, R, 0, Math.PI * 2);
        b.fill();
      }
      // clouds rushing past on the way up
      CLOUDS.forEach(c => {
        const y = 64 - (c.alt - h) * 0.02;
        if (y < -8 || y > BH + 8) return;
        b.fillStyle = 'rgba(240,244,250,.85)';
        b.fillRect(Math.round(c.x - c.w / 2), Math.round(y), Math.round(c.w), 3);
        b.fillRect(Math.round(c.x - c.w / 3), Math.round(y - 2), Math.round(c.w * 0.6), 2);
      });
      // the pad, dropping away
      const groundY = 103 + h * 0.12;
      if (groundY < BH) {
        b.fillStyle = '#3c7a43';
        b.fillRect(0, Math.round(groundY), BW, BH);
        b.fillStyle = '#5b6266';
        b.fillRect(90, Math.round(groundY) - 44, 3, 44);
        for (let y = 0; y < 44; y += 6) b.fillRect(86, Math.round(groundY) - 44 + y, 4, 1);
        // smoke from the flame trench at lift-off
        if (phase === 'ascent' || phase === 'count') {
          const puff = phase === 'ascent' ? Math.min(1, s.T / 4) : 0;
          b.fillStyle = 'rgba(225,228,230,.8)';
          for (let i = 0; i < 10; i++) {
            const spread = 6 + puff * 40;
            b.fillRect(Math.round(80 + Math.cos(i * 1.7) * spread * (i / 10)) - 3, Math.round(groundY) - 3 - (i % 3) * 2 * puff, 6, 3);
          }
        }
      }

      // the rocket, in its own canvas
      r.clearRect(0, 0, RW, RH);
      const sepK = phase === 'sep' ? clamp((since - SEP_TIME * 0.25) / (SEP_TIME * 0.75), 0, 1) : phase === 'ascent' || phase === 'count' ? 0 : 1,
        fairingOff = phase === 'deploy' || phase === 'done',
        out = fairingOff ? now - s.deployAt : 0, // seconds since the fairing came off, carried on into 'done'
        fairK = clamp(out / 1.2, 0, 1);
      // stage 1 and its flame, falling away after separation
      if (sepK < 1) {
        const dy = Math.round(sepK * sepK * 60),
          dx = Math.round(sepK * 3);
        body(r, RX - 2 + dx, RY + 9 + dy, 5, 30);
        r.fillStyle = BLACK;
        r.fillRect(RX - 2 + dx, RY + 7 + dy, 5, 2); // interstage
        r.fillRect(RX - 3 + dx, RY + 34 + dy, 1, 5); // landing legs
        r.fillRect(RX + 3 + dx, RY + 34 + dy, 1, 5);
        if (phase === 'ascent' || (phase === 'count' && since > COUNTDOWN - 0.4))
          plume(r, RX + dx, RY + 39 + dy, Math.round(10 + 8 * s.thr + Math.random() * 3), 1 + h / 25000, false);
      }
      // stage 2: its engine lights a moment after separation
      body(r, RX - 2, RY - 4, 5, 11);
      r.fillStyle = '#2b2f31';
      r.fillRect(RX - 1, RY + 7, 3, 2);
      if ((phase === 'sep' && since > SEP_TIME * 0.6) || phase === 'coast' || (phase === 'deploy' && out < 0.8))
        plume(r, RX, RY + 9, Math.round(7 + Math.random() * 3), 4, true);
      // the payload stack (the top one deploys first), and the fairing over it
      const gone = fairingOff ? clamp(Math.floor((out - 1) / DEPLOY_GAP) + 1, 0, COUNT) : 0;
      for (let i = 0; i < COUNT - gone; i++) satellite(r, RX - 2, RY - 6 - i * 3, 0);
      const nose = [1, 1, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
      [-1, 1].forEach(side => {
        const dx = Math.round(side * fairK * 14),
          dy = Math.round(fairK * fairK * 10);
        if (fairK >= 1) return;
        nose.forEach((w, i) => {
          const y = RY - 18 + i + dy;
          // each half is the part of the row on its side of the centre line
          if (side < 0) {
            r.fillStyle = WHITE;
            r.fillRect(RX - Math.floor(w / 2) + dx, y, Math.ceil(w / 2), 1);
          } else {
            r.fillStyle = WHITE;
            r.fillRect(RX + dx, y, Math.ceil(w / 2), 1);
            r.fillStyle = SHADE;
            r.fillRect(RX + Math.floor(w / 2) + dx, y, 1, 1);
          }
        });
      });
      b.save();
      b.imageSmoothingEnabled = false;
      b.translate(80, 64);
      b.rotate(tilt);
      b.drawImage(rocket, -RX, -RY);
      b.restore();
      // deployed satellites drift free from where they sat on the (tilted) stack, panels unfolding
      for (let j = 0; j < gone; j++) {
        const i = COUNT - 1 - j,
          k = out - 1 - j * DEPLOY_GAP,
          side = j % 2 ? 1 : -1,
          lx = -2,
          ly = -6 - i * 3;
        satellite(
          b,
          Math.round(80 + lx * Math.cos(tilt) - ly * Math.sin(tilt) + side * k * 9),
          Math.round(64 + lx * Math.sin(tilt) + ly * Math.cos(tilt) - k * 5),
          Math.min(6, Math.floor(k * 6)),
        );
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, 0, 0, ctx.canvas.width, ctx.canvas.height);

      // ---- the readouts ----
      const W = ctx.canvas.width,
        H = ctx.canvas.height,
        clock = Math.floor(s.T),
        stamp =
          phase === 'count'
            ? `T- 00:0${Math.max(1, Math.ceil(COUNTDOWN - since))}`
            : `T+ ${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
      hudText(
        ctx,
        {
          count: 'T-MINUS',
          ascent: 'STAGE 1 · MAX-Q',
          sep: since < SEP_TIME * 0.25 ? 'MECO' : since < SEP_TIME * 0.6 ? 'STAGE SEPARATION' : 'STAGE 2 IGNITION',
          coast: 'STAGE 2 · FAIRING',
          deploy: 'SECO · DEPLOY',
          done: 'DEPLOYED',
        }[phase],
        'left',
        'top',
      );
      hudText(ctx, stamp, 'right', 'top');
      hudText(ctx, `ALT ${(h / 1000).toFixed(1)} km · ${(s.v / 1000).toFixed(2)} km/s`, 'left', 'bottom');
      if (phase === 'ascent' || phase === 'count') hudText(ctx, `THROTTLE ${Math.round(s.thr * 100)}%`, 'right', 'bottom');
      // the gauge on the right: dynamic pressure on the way up, aerodynamic heating for the fairing
      const gauge = phase === 'count' || phase === 'ascent' ? 'q' : phase === 'coast' ? 'heat' : null;
      if (gauge) {
        const gx = W - 58,
          gy = 70,
          gh = H - 150,
          gw = 22,
          // heating spans orders of magnitude, so its gauge is logarithmic: 10² to 10⁵·⁵ W/m²
          frac = gauge === 'q' ? s.q / Q_SCALE : (Math.log10(Math.max(100, s.heat)) - 2) / 3.5,
          limit = gauge === 'q' ? Q_MAX / Q_SCALE : (Math.log10(HEAT_LIMIT) - 2) / 3.5,
          over = gauge === 'q' ? s.q > Q_MAX * 0.85 : s.heat > HEAT_LIMIT;
        ctx.fillStyle = 'rgba(2,4,6,.7)';
        ctx.fillRect(gx - 34, gy - 30, gw + 46, gh + 64);
        ctx.fillStyle = 'rgba(255,89,100,.25)';
        ctx.fillRect(gx, gy, gw, gh * (1 - limit));
        ctx.fillStyle = over ? '#ff5964' : '#c9ff4d';
        const f = clamp(frac, 0, 1);
        ctx.fillRect(gx + 4, gy + gh * (1 - f), gw - 8, gh * f);
        ctx.strokeStyle = '#39453f';
        ctx.lineWidth = 2;
        ctx.strokeRect(gx, gy, gw, gh);
        ctx.strokeStyle = '#ff5964';
        ctx.beginPath();
        ctx.moveTo(gx - 6, gy + gh * (1 - limit));
        ctx.lineTo(gx + gw + 6, gy + gh * (1 - limit));
        ctx.stroke();
        ctx.font = pixelFont(16);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(201,255,77,.85)';
        ctx.fillText(gauge === 'q' ? 'Q' : 'HEAT', gx + gw / 2, gy - 24);
        ctx.fillText(gauge === 'q' ? `${(s.q / 1000).toFixed(1)}` : `${(s.heat / 1000).toFixed(1)}`, gx + gw / 2, gy + gh + 8);
        ctx.fillText(gauge === 'q' ? 'kPa' : 'kW/m²', gx + gw / 2, gy + gh + 22);
      }
      brackets(ctx);
      if (phase === 'count') {
        ctx.font = pixelFont(44);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(201,255,77,.9)';
        // in the sky above the rocket, on a dark backing so it reads against the blue
        const n = Math.max(1, Math.ceil(COUNTDOWN - since)),
          msg = n === 3 ? 'LIFTOFF IN 3' : String(n),
          w = ctx.measureText(msg).width;
        ctx.fillStyle = 'rgba(2,4,6,.7)';
        ctx.fillRect(W / 2 - w / 2 - 18, 96, w + 36, 64);
        ctx.fillStyle = 'rgba(201,255,77,.95)';
        ctx.fillText(msg, W / 2, 128);
        // fading in from the view over the pad
        if (since < FADE) {
          ctx.fillStyle = `rgba(0,0,0,${1 - since / FADE})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
      if (phase === 'done') {
        // the payoff, big in the middle once the last one is out
        const msg = COUNT === 1 ? 'SATELLITE DEPLOYED' : 'ALL SATELLITES DEPLOYED';
        ctx.font = pixelFont(33);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(msg).width;
        ctx.fillStyle = 'rgba(2,4,6,.75)';
        ctx.fillRect(W / 2 - w / 2 - 18, 100, w + 36, 52);
        ctx.fillStyle = '#c9ff4d';
        ctx.fillText(msg, W / 2, 126);
      }
      if (flash) {
        ctx.font = pixelFont(22);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(flash).width;
        ctx.fillStyle = 'rgba(2,4,6,.85)';
        ctx.fillRect(W / 2 - w / 2 - 14, H / 2 - 22, w + 28, 44);
        ctx.fillStyle = '#ff5964';
        ctx.fillText(flash, W / 2, H / 2);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // the throttle answers to the space bar too
    const key = down => e => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (live.current.phase === 'coast' && down) jettison();
      else sim.current.hold = down;
    };
    const kd = key(true),
      ku = key(false);
    addEventListener('keydown', kd);
    addEventListener('keyup', ku);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', kd);
      removeEventListener('keyup', ku);
    };
  }, []);

  const hold = down => () => (sim.current.hold = down);
  function jettison() {
    if (live.current.phase !== 'coast' || live.current.flash) return;
    if (sim.current.heat > HEAT_LIMIT) fail('PAYLOAD OVERHEATED · SCRUB · RECYCLING', 'stage 2');
    else {
      sim.current.deployAt = performance.now() / 1000;
      go('deploy');
    }
  }
  const press = { touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' };

  return (
    <>
      <div className="eyebrow">Launch control</div>
      <h1>Replacement launch</h1>
      <div className="signal" style={{ color: 'var(--yellow)' }}>
        RIDESHARE · {COUNT} {COUNT === 1 ? 'SATELLITE' : 'SATELLITES'}
      </div>
      <p className="instructions">
        Hold THROTTLE DOWN through max-Q to keep dynamic pressure out of the red. Release it after max-Q. If you hold it too long, stage
        1 is too slow at separation. Jettison the fairing when heating falls below the line.
      </p>
      <canvas
        ref={canvasRef}
        width={BW * SCALE}
        height={BH * SCALE}
        style={{
          width: '100%',
          maxWidth: FIT,
          display: 'block',
          imageRendering: 'pixelated',
          border: '1px solid #34403a',
          background: '#000',
        }}
      />
      <div className="actions" style={{ alignItems: 'center' }}>
        {phase === 'done' ? (
          <>
            <span className="eyebrow">{COUNT === 1 ? 'SATELLITE DEPLOYED' : 'ALL SATELLITES DEPLOYED'}</span>
            <span style={{ flex: 1 }} />
            <button className="action" onClick={() => report({ type: 'launch-close' })}>
              DONE
            </button>
          </>
        ) : phase === 'deploy' ? null : phase === 'coast' || phase === 'sep' ? (
          <button className="action" disabled={phase !== 'coast'} style={{ ...press, opacity: phase === 'coast' ? 1 : 0.4 }} onClick={jettison}>
            JETTISON FAIRING
          </button>
        ) : (
          <button
            className="action"
            disabled={phase !== 'ascent'}
            style={{ ...press, opacity: phase === 'ascent' ? 1 : 0.4 }}
            onPointerDown={hold(true)}
            onPointerUp={hold(false)}
            onPointerLeave={hold(false)}
            onPointerCancel={hold(false)}
            onContextMenu={e => e.preventDefault()}
          >
            THROTTLE DOWN · HOLD
          </button>
        )}
      </div>
    </>
  );
}
