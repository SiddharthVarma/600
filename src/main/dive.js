import { H, W } from './constellation.js';

// The camera move from the main screen into a science request. For Earth observation the constellation fades, the Earth
// in the middle of the screen swells around the target spot until its pixels are huge, and clouds rush in; once they
// cover everything the request's window opens behind them and the clouds clear to reveal it. Its own view starts in
// the same clouds, so it reads as one dive. For deep space, stars streak outward instead.
const earth = new Image();
earth.src = '600_earth_assets/earth.png';
const PIX = 4, // cloud pixel size, to match the pixel art
  IN = 1.3, // seconds until the screen is covered
  OUT = 0.7; // seconds for the cover to clear
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const CLOUD = [
  [176, 186, 202],
  [204, 212, 224],
  [228, 234, 242],
  [248, 250, 252],
];
function noise(x, y) {
  const h = (a, b) => {
    const s = Math.sin(a * 127.1 + b * 311.7 + 512.3) * 43758.5453;
    return s - Math.floor(s);
  };
  let s = 0,
    amp = 1,
    tot = 0;
  for (let o = 0; o < 3; o++, x *= 2, y *= 2, amp /= 2) {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi,
      u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi),
      b = h(xi + 1, yi),
      c = h(xi, yi + 1),
      d = h(xi + 1, yi + 1);
    s += (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * amp;
    tot += amp;
  }
  return s / tot;
}
const canvas = document.createElement('canvas');
canvas.className = 'dive';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d'),
  buf = document.createElement('canvas');
let running = false;
export const diving = () => running;

// to: 'earth' (with earthAt, the spot on the 240px Earth sprite to dive at) or 'space'. covered() runs once the screen
// is covered, to open the window underneath.
export function dive({ to, earthAt = [120, 120] }, covered) {
  if (running) return;
  running = true;
  canvas.width = W;
  canvas.height = H;
  canvas.classList.add('on');
  const bw = Math.ceil(W / PIX),
    bh = Math.ceil(H / PIX);
  buf.width = bw;
  buf.height = bh;
  const bctx = buf.getContext('2d'),
    img = bctx.createImageData(bw, bh),
    px = img.data,
    unit = Math.min(W, H),
    earthR = Math.max(19, unit * 0.052),
    streaks = Array.from({ length: 160 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() * 0.3, v: 0.6 + Math.random() * 1.4 }));
  const t0 = performance.now() / 1000;
  let opened = false;
  const frame = () => {
    const t = performance.now() / 1000 - t0;
    ctx.clearRect(0, 0, W, H);
    // the main screen fades to black on the way in; on the way out the cover clears to show the window
    const dark = t < IN ? Math.min(1, t / 0.5) : Math.max(0, 1 - (t - IN) / OUT);
    ctx.fillStyle = `rgba(0,0,0,${dark})`;
    ctx.fillRect(0, 0, W, H);
    if (to === 'earth') {
      if (t < IN) {
        const k = Math.pow(t / IN, 2.2),
          size = earthR * 2 * Math.pow(40, k),
          [u, v] = earthAt;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(earth, W / 2 - (u / 240 - 0.5) * size * k - size / 2, H / 2 - (v / 240 - 0.5) * size * k - size / 2, size, size);
      }
      // clouds: rush outward past the camera, cover everything at IN, then thin away
      const cover = t < IN ? Math.max(0, (t - (IN - 0.55)) / 0.55) : Math.max(0, 1 - (t - IN) / OUT),
        z = 1 + Math.pow(t, 2) * 0.8;
      if (cover > 0) {
        for (let y = 0; y < bh; y++)
          for (let x = 0; x < bw; x++) {
            const i = (y * bw + x) * 4,
              c = noise(((x - bw / 2) / z + bw / 2) / 26, ((y - bh / 2) / z + bh / 2) / 18);
            if (c > 1 - cover && BAYER[(y & 3) * 4 + (x & 3)] < (c - (1 - cover)) * 3 + (cover > 0.98 ? 1 : 0)) {
              const lv = Math.min(1, Math.max(0, (c - 0.35) * 2)) * 3 + BAYER[(y & 3) * 4 + (x & 3)] - 0.5,
                col = CLOUD[Math.max(0, Math.min(3, Math.round(lv)))];
              px[i] = col[0];
              px[i + 1] = col[1];
              px[i + 2] = col[2];
              px[i + 3] = 255;
            } else px[i + 3] = 0;
          }
        bctx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf, 0, 0, bw * PIX, bh * PIX);
      }
    } else {
      // deep space: stars streak outward from the centre, faster and longer as the jump builds
      const k = t < IN ? t / IN : Math.max(0, 1 - (t - IN) / OUT);
      ctx.strokeStyle = `rgba(220,230,255,${0.9 * k})`;
      ctx.lineWidth = 2;
      streaks.forEach(s => {
        const r0 = (s.r + t * s.v * 0.5) * unit,
          r1 = r0 + k * k * s.v * unit * 0.35;
        ctx.beginPath();
        ctx.moveTo(W / 2 + Math.cos(s.a) * r0, H / 2 + Math.sin(s.a) * r0);
        ctx.lineTo(W / 2 + Math.cos(s.a) * r1, H / 2 + Math.sin(s.a) * r1);
        ctx.stroke();
      });
    }
    if (t >= IN && !opened) {
      opened = true;
      covered();
    }
    if (t < IN + OUT) requestAnimationFrame(frame);
    else {
      canvas.classList.remove('on');
      running = false;
    }
  };
  requestAnimationFrame(frame);
}
