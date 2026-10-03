// Pixel-art scenes for the science requests. Each survey scene is generated from a seed into a low-res buffer (BW × BH),
// a static ground plus whatever moves on top, and is scaled up with no smoothing. Targets are what the player is asked
// to find; everything else that looks a bit like them is a decoy.
export const BW = 240,
  BH = 150;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
export const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
// palette colour for a 0..1 level, dithered so gradients stay pixel art instead of smooth
export function pick(pal, lv, x, y) {
  const v = lv * (pal.length - 1) + bay(x, y) - 0.5;
  return pal[Math.max(0, Math.min(pal.length - 1, Math.round(v)))];
}
export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function makeNoise(seed, period = 0) {
  const h = (x, y) => {
    if (period) {
      x = ((x % period) + period) % period;
      y = ((y % period) + period) % period;
    }
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const n = (x, y) => {
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
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct = 3) => {
    let s = 0,
      amp = 1,
      tot = 0,
      f = 1;
    for (let o = 0; o < oct; o++) {
      s += n(x * f, y * f) * amp;
      tot += amp;
      amp *= 0.5;
      f *= 2;
    }
    return s / tot;
  };
}
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// A pixel buffer: `fb` is drawn each frame, `base` holds the static ground it starts from.
export function makeBuffer() {
  const img = new ImageData(BW, BH),
    fb = img.data,
    base = new Uint8ClampedArray(BW * BH * 4);
  const put = (x, y, c, a = 1) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= BW || y >= BH) return;
    const i = (y * BW + x) * 4;
    if (a >= 1) {
      fb[i] = c[0];
      fb[i + 1] = c[1];
      fb[i + 2] = c[2];
      fb[i + 3] = 255;
      return;
    }
    fb[i] += (c[0] - fb[i]) * a;
    fb[i + 1] += (c[1] - fb[i + 1]) * a;
    fb[i + 2] += (c[2] - fb[i + 2]) * a;
    fb[i + 3] = 255;
  };
  const setBase = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= BW || y >= BH) return;
    const i = (y * BW + x) * 4;
    base[i] = c[0];
    base[i + 1] = c[1];
    base[i + 2] = c[2];
    base[i + 3] = 255;
  };
  const getBase = (x, y) => {
    const i = (y * BW + x) * 4;
    return [base[i], base[i + 1], base[i + 2]];
  };
  return { img, fb, base, put, setBase, getBase };
}
// an irregular dithered disc; the noise makes the edge ragged. colorAt(x, y, d) gets d = 0 at the centre, 1 at the edge.
function blob(cx, cy, r, colorAt, noise, rough = 0.45) {
  const R = Math.ceil(r * 1.5);
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y) / r,
        edge = 1 + (noise((cx + x) / 3.1, (cy + y) / 3.1, 2) - 0.5) * rough * 2;
      if (d < edge) colorAt(cx + x, cy + y, d / edge);
    }
}

const ICE = [
  [132, 156, 184],
  [160, 182, 206],
  [190, 208, 226],
  [214, 228, 240],
  [236, 243, 250],
  [250, 252, 255],
];
const SEAICE = [
  [150, 170, 192],
  [172, 190, 210],
  [196, 212, 228],
  [218, 230, 242],
];
const DEEP = [
  [8, 26, 46],
  [12, 36, 60],
  [18, 50, 78],
  [26, 66, 98],
];
const ROCK = [
  [40, 38, 40],
  [60, 56, 56],
  [84, 78, 74],
  [108, 100, 94],
];
const GUANO = [
  [104, 70, 54],
  [132, 90, 64],
  [158, 112, 80],
  [178, 136, 100],
];
const SEA = [
  [6, 28, 50],
  [10, 38, 64],
  [14, 50, 80],
  [20, 64, 98],
  [30, 82, 118],
  [46, 102, 138],
];
const FOREST = [
  [10, 34, 20],
  [16, 48, 26],
  [24, 64, 32],
  [36, 82, 40],
  [54, 102, 48],
  [78, 124, 58],
];
const IR = [
  [6, 4, 18],
  [14, 8, 34],
  [24, 14, 52],
  [36, 20, 68],
  [50, 28, 82],
];
const HOT = [
  [120, 30, 40],
  [200, 60, 40],
  [255, 140, 40],
  [255, 210, 90],
  [255, 248, 210],
];
const CLOUD = [
  [176, 186, 202],
  [204, 212, 224],
  [228, 234, 242],
  [248, 250, 252],
];

// keep generated things apart so targets and decoys never overlap
const spacer = () => {
  const spots = [];
  return (x, y, d) => {
    if (spots.some(s => Math.hypot(s[0] - x, s[1] - y) < d)) return false;
    spots.push([x, y]);
    return true;
  };
};

function penguins(B, r) {
  const { setBase, getBase, put, fb, base } = B,
    n = makeNoise(r() * 1000),
    sh = makeNoise(r() * 1000),
    free = spacer();
  const coast = x => 52 + (n(x / 30, 3.3, 3) - 0.5) * 40, // edge of the ice shelf
    edge = x => 122 + (n(x / 24, 9.1, 3) - 0.5) * 24; // sea ice → open water
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      if (y < coast(x)) {
        // ice shelf: wind-carved ripples running across, over broad shading
        const lv = 0.6 + (n(x / 26, y / 18, 3) - 0.5) * 0.45 + (n(x / 9, y / 1.4, 2) - 0.5) * 0.22;
        setBase(x, y, pick(ICE, Math.max(0, Math.min(1, lv)), x, y));
        if (y > coast(x) - 2) setBase(x, y, pick(ICE, 0.15, x, y)); // the shelf's cliff edge, in shadow
      } else if (y < edge(x)) setBase(x, y, pick(SEAICE, 0.55 + (n(x / 14 + 50, y / 10, 3) - 0.5) * 0.45, x, y));
      else setBase(x, y, pick(DEEP, 0.4 + (n(x / 9, y / 5, 2) - 0.5) * 0.6, x, y));
    }
  // cracks in the sea ice
  for (let k = 0; k < 5; k++) {
    let x = r() * BW,
      y = coast(x) + 6 + r() * 40,
      a = r() * Math.PI;
    const len = 40 + r() * 50;
    for (let s = 0; s < len; s++) {
      a += (r() - 0.5) * 0.5;
      x += Math.cos(a);
      y += Math.sin(a) * 0.6;
      if (y > coast(Math.round(x)) + 1 && y < edge(Math.round(x))) {
        setBase(x, y, [48, 82, 112]);
        if (r() < 0.4) setBase(x + 1, y, [70, 104, 134]);
      }
    }
  }
  // decoys: rocks on the shelf (dark, hard-edged, snow on top, shadow behind)...
  const rocks = 4 + Math.floor(r() * 4);
  for (let k = 0; k < rocks; k++) {
    const x = 10 + r() * (BW - 20),
      y = 8 + r() * (coast(Math.round(x)) - 20),
      rr = 2 + r() * 4;
    if (!free(x, y, 10)) continue;
    blob(x + 2, y + 1, rr, (px, py) => setBase(px, py, pick(ICE, 0.12, px, py)), sh);
    blob(x, y, rr, (px, py, d) => setBase(px, py, sh(px / 1.3, py / 1.3) > 0.72 ? ICE[4] : pick(ROCK, 1 - d * 0.8, px, py)), sh, 0.6);
  }
  // ...and icebergs frozen into the sea ice
  const bergs = 3 + Math.floor(r() * 3);
  for (let k = 0; k < bergs; k++) {
    const x = 10 + r() * (BW - 20),
      y = coast(Math.round(x)) + 10 + r() * 50,
      s = 2 + r() * 3;
    if (y > edge(Math.round(x)) - 6 || !free(x, y, 12)) continue;
    blob(x + 2, y + 2, s * 1.1, (px, py) => setBase(px, py, [128, 148, 176]), sh, 0.5);
    blob(x, y + 1, s, (px, py) => setBase(px, py, [150, 178, 208]), sh, 0.5);
    blob(x, y, s * 0.92, (px, py, d) => setBase(px, py, d < 0.5 ? [255, 255, 255] : [230, 240, 250]), sh, 0.5);
  }
  // colonies: soft brown stains on the sea ice near the shelf, with penguins dotted around them
  const N = 4 + Math.floor(r() * 6),
    targets = [];
  for (let tries = 0; targets.length < N && tries < 400; tries++) {
    const x = 8 + r() * (BW - 16),
      y = coast(Math.round(x)) + 5 + r() * 34,
      rr = 2.2 + r() * 2.6;
    if (y > edge(Math.round(x)) - 8 || !free(x, y, 13)) continue;
    blob(x, y, rr, (px, py, d) => setBase(px, py, d > 0.75 && bay(px, py) > 0.5 ? getBase(px, py) : pick(GUANO, 1 - d, px, py)), sh, 0.7);
    const birds = [],
      count = 6 + r() * 10;
    for (let b = 0; b < count; b++) {
      const a = r() * Math.PI * 2,
        d = rr * (0.4 + r() * 1.1);
      birds.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, ph: r() * 10 });
    }
    targets.push({ x, y, birds });
  }
  const floes = Array.from({ length: 16 }, () => {
    const x = r() * BW,
      e = edge(Math.round(x));
    return { x, y: e + 4 + r() * (BH - e - 6), w: 2 + Math.floor(r() * 4), h: 1 + Math.floor(r() * 2) };
  });
  return {
    targets,
    frame(t) {
      fb.set(base);
      // penguins shuffle a pixel now and then
      targets.forEach(c =>
        c.birds.forEach(b => {
          const j = Math.sin(t * 0.7 + b.ph) > 0.92 ? 1 : 0;
          put(b.x + j, b.y, [18, 20, 26]);
          if (bay(Math.round(b.x), Math.round(b.y)) > 0.6) put(b.x + j, b.y - 1, [240, 240, 236]);
        }),
      );
      floes.forEach(f => {
        const x = ((f.x + t * 1.2) % (BW + 8)) - 4;
        for (let y = 0; y < f.h; y++) for (let k = 0; k < f.w; k++) put(x + k, f.y + y, y === 0 ? [236, 244, 250] : [196, 214, 230]);
      });
    },
  };
}

// Open ocean: two layers of swell sliding past each other, a band of sun glint, whitecaps that come and go. calm(x, y)
// (0..1) flattens the water, as an oil slick does: darker, glassy, no whitecaps.
function ocean(put, n, t, glint, calm = () => 0) {
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const k = calm(x, y),
        sw = (n(x / 7 + t * 0.35, y / 3.2, 2) * 0.6 + n(x / 4 - t * 0.2 + 30, y / 6 + 9, 2) * 0.4) * (1 - k) + 0.5 * k,
        g = Math.max(0, 1 - Math.abs((x + y * 0.8) / (BW * 1.4) - 0.55 - glint * 0.2) * 7);
      put(x, y, pick(SEA, Math.max(0, Math.min(1, 0.3 + (sw - 0.5) * 0.7 + g * 0.35 - k * 0.32)), x, y));
      if (k > 0.1) continue;
      const hs = Math.sin(x * 12.9898 + y * 78.233 + Math.floor(t * 2 + (x % 7)) * 3.17) * 43758.5453,
        hr = hs - Math.floor(hs);
      if (sw > 0.72 && hr < 0.035) {
        put(x, y, [214, 232, 240], 0.8);
        put(x + 1, y, [190, 214, 228], 0.6);
      }
      if (g > 0.5 && hr > 0.985) put(x, y, [250, 252, 236]);
    }
}
// a ship heading along a, with its V-shaped wake. big: a cargo ship, long with coloured containers; otherwise a small
// fishing boat.
function ship(put, x, y, a, big = false) {
  const ca = Math.cos(a),
    sa = Math.sin(a),
    len = big ? 6 : 3;
  for (let s = 2; s < (big ? 22 : 16); s++)
    for (const side of [-1, 1])
      put(
        x - ca * (s + len - 3) - sa * side * s * 0.35,
        y - sa * (s + len - 3) + ca * side * s * 0.35,
        [190, 214, 226],
        Math.max(0, 0.7 - s / 22),
      );
  for (let s = -len; s <= len; s++)
    for (let w = -1; w <= 0; w++) {
      const c = big
        ? s === len
          ? [236, 236, 230]
          : s < -len + 2
            ? [60, 64, 70]
            : [
                [150, 60, 52],
                [52, 96, 140],
                [200, 160, 60],
              ][(s + 10) % 3]
        : s === len
          ? [220, 90, 60]
          : [236, 236, 230];
      put(x + ca * s - sa * w, y + sa * s + ca * w, c);
    }
  put(x - ca * (big ? len - 1 : 0), y - sa * (big ? len - 1 : 0), [70, 74, 80]);
}

function whales(B, r) {
  const { put } = B,
    free = spacer(),
    n = makeNoise(r() * 1000, 64),
    sh = makeNoise(r() * 1000),
    glint = r();
  // whales barely drift, so a mark placed on one stays on it
  const N = 4 + Math.floor(r() * 7),
    targets = [];
  for (let tries = 0; targets.length < N && tries < 400; tries++) {
    const x = 14 + r() * (BW - 28),
      y = 12 + r() * (BH - 24);
    if (!free(x, y, 16)) continue;
    targets.push({ x, y, a: r() * Math.PI * 2, len: 9 + r() * 5, deep: r() < 0.3, blow: r() * 6, period: 4 + r() * 4, ph: r() * 9 });
  }
  const boats = [],
    rocks = [],
    kelp = [];
  const nb = 2 + Math.floor(r() * 3);
  for (let k = 0; k < nb; k++) {
    const x = r() * BW,
      y = 10 + r() * (BH - 20);
    if (free(x, y, 18)) boats.push({ x, y, a: r() * Math.PI * 2, v: 3 + r() * 3 });
  }
  const nr = 1 + Math.floor(r() * 3);
  for (let k = 0; k < nr; k++) {
    const x = 10 + r() * (BW - 20),
      y = 10 + r() * (BH - 20);
    if (free(x, y, 16)) rocks.push({ x, y, r: 2 + r() * 2.5 });
  }
  const nk = 2 + Math.floor(r() * 3);
  for (let k = 0; k < nk; k++) {
    const x = r() * BW,
      y = r() * BH;
    if (free(x, y, 12)) kelp.push({ x, y, a: r() * Math.PI, len: 10 + r() * 16, ph: r() * 9 });
  }
  return {
    targets,
    frame(t) {
      ocean(put, n, t, glint);
      kelp.forEach(k => {
        for (let s = 0; s < k.len; s++) {
          const w = Math.sin(s * 0.5 + t + k.ph) * 1.2;
          put(
            k.x + Math.cos(k.a) * s - Math.sin(k.a) * w,
            k.y + Math.sin(k.a) * s + Math.cos(k.a) * w,
            s % 3 ? [58, 70, 34] : [82, 92, 44],
            0.85,
          );
        }
      });
      rocks.forEach(k => {
        blob(
          k.x,
          k.y,
          k.r + 1.2,
          (px, py, d) => d > 0.7 && (px + py + Math.floor(t * 4)) % 3 === 0 && put(px, py, [210, 228, 236], 0.8),
          sh,
        );
        blob(
          k.x,
          k.y,
          k.r,
          (px, py, d) =>
            put(
              px,
              py,
              pick(
                [
                  [44, 38, 34],
                  [70, 60, 50],
                  [96, 84, 70],
                ],
                1 - d,
                px,
                py,
              ),
            ),
          sh,
          0.6,
        );
      });
      boats.forEach(b =>
        ship(put, (((b.x + Math.cos(b.a) * b.v * t) % BW) + BW) % BW, (((b.y + Math.sin(b.a) * b.v * t) % BH) + BH) % BH, b.a),
      );
      targets.forEach(w => {
        // a whale bobs in place, nosing slowly round
        const a = w.a + Math.sin(t * 0.2 + w.ph) * 0.15,
          ca = Math.cos(a),
          sa = Math.sin(a),
          x = w.x,
          y = w.y;
        // the flat, glassy patch a whale leaves on the surface
        for (let s = -w.len / 2 - 4; s <= w.len / 2 + 3; s++)
          for (let q = -4; q <= 4; q++) {
            const e = (s / (w.len / 2 + 4)) ** 2 + (q / 4.2) ** 2;
            if (e <= 1) put(x + ca * s - sa * q, y + sa * s + ca * q, [40, 96, 132], 0.35 * (1 - e));
          }
        for (let s = -w.len / 2; s <= w.len / 2; s++) {
          const k = s / (w.len / 2),
            half = 1.6 * Math.sqrt(Math.max(0, 1 - k * k)) + (k > -0.2 && k < 0.6 ? 0.3 : 0);
          for (let q = -Math.ceil(half); q <= Math.ceil(half); q++) {
            if (Math.abs(q) > half + 0.2) continue;
            const c = Math.abs(q) > half - 0.6 ? [28, 34, 40] : Math.abs(q) < 0.6 && k > -0.5 ? [128, 136, 138] : [86, 94, 100];
            put(x + ca * s - sa * q, y + sa * s + ca * q, c, w.deep ? 0.5 : 0.95);
          }
        }
        // tail flukes
        const tx = x - ca * (w.len / 2 + 1),
          ty = y - sa * (w.len / 2 + 1);
        for (const side of [-1, 1])
          for (let q = 1; q <= 2; q++)
            put(tx - ca * q * 0.6 - sa * side * q, ty - sa * q * 0.6 + ca * side * q, [70, 78, 84], w.deep ? 0.45 : 0.95);
        if (w.deep) return;
        // white callosities on the head, the right whale's fingerprint
        for (const [s, q] of [
          [w.len / 2 - 1, 0],
          [w.len / 2 - 2.5, -1],
          [w.len / 2 - 2.5, 1],
        ])
          put(x + ca * s - sa * q, y + sa * s + ca * q, [226, 220, 204]);
        // the blow: a puff of spray every few seconds
        const ph = (t + w.blow) % w.period;
        if (ph < 1.4) {
          const hx = x + ca * (w.len / 2 - 2),
            hy = y + sa * (w.len / 2 - 2),
            g = ph / 1.4,
            rr = 1 + g * 2.5;
          for (let yy = -3; yy <= 3; yy++)
            for (let xx = -3; xx <= 3; xx++)
              if (xx * xx + yy * yy <= rr * rr && bay(Math.round(hx + xx), Math.round(hy + yy)) > g * 0.9)
                put(hx + xx, hy + yy - g * 2, [240, 246, 250], 0.9 - g * 0.6);
        }
      });
    },
  };
}

function wildfire(B, r) {
  const { setBase, put, fb, base } = B,
    n = makeNoise(r() * 1000),
    sh = makeNoise(r() * 1000);
  const kind = new Uint8Array(BW * BH); // 0 forest, 1 water, 2 road, 3 roof, 4 burn scar, 5 meadow
  const mark = (x, y, k) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < BW && y >= 0 && y < BH) kind[y * BW + x] = k;
  };
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const lv = 0.5 + (n(x / 18, y / 18, 3) - 0.5) * 0.7 + (n(x / 1.3, y / 1.3, 1) - 0.5) * 0.45;
      setBase(x, y, pick(FOREST, Math.max(0, Math.min(1, lv)), x, y));
      if (n(x / 22 + 70, y / 22, 2) > 0.76) {
        setBase(
          x,
          y,
          pick(
            [
              [96, 118, 60],
              [122, 140, 72],
              [148, 158, 88],
            ],
            n(x / 3, y / 3, 1),
            x,
            y,
          ),
        );
        mark(x, y, 5);
      }
    }
  // a river meandering across
  let ry = 20 + r() * (BH - 40),
    ra = 0;
  for (let x = -2; x < BW + 2; x++) {
    ra += (r() - 0.5) * 0.25;
    ra *= 0.97;
    ry += Math.sin(ra) * 1.2;
    for (let w = -1; w <= 1; w++) {
      setBase(x, ry + w, w === 0 ? [62, 104, 134] : [40, 78, 106]);
      mark(x, ry + w, 1);
    }
  }
  // a road, and a small town on it
  let rx = 20 + r() * (BW - 40);
  for (let y = 0; y < BH; y++) {
    rx += Math.sin(y / 17) * 0.6;
    setBase(rx, y, [150, 132, 98]);
    mark(rx, y, 2);
  }
  const town = { x: rx - 14 + r() * 8, y: 20 + r() * (BH - 50) },
    roofColors = [
      [160, 160, 156],
      [150, 74, 62],
      [196, 196, 188],
      [110, 112, 116],
    ];
  for (let k = 0; k < 22; k++) {
    const x = Math.round(town.x + (r() - 0.5) * 30),
      y = Math.round(town.y + (r() - 0.5) * 22),
      w = 2 + Math.floor(r() * 2),
      c = roofColors[Math.floor(r() * 4)];
    for (let yy = 0; yy < 2; yy++)
      for (let xx = 0; xx < w; xx++) {
        setBase(x + xx, y + yy, yy === 0 ? c : mix(c, [0, 0, 0], 0.25));
        mark(x + xx, y + yy, 3);
      }
  }
  // old burn scars
  for (let k = 0; k < 2; k++)
    blob(
      r() * BW,
      r() * BH,
      7 + r() * 8,
      (px, py, d) => {
        setBase(
          px,
          py,
          pick(
            [
              [26, 22, 20],
              [44, 36, 30],
              [62, 52, 40],
            ],
            d * 0.8 + n(px / 2, py / 2, 1) * 0.3,
            px,
            py,
          ),
        );
        mark(px, py, 4);
      },
      sh,
      0.6,
    );
  // active fires: in the forest, away from the town, each feeding a smoke plume that blows downwind
  const targets = [],
    wind = 0.4 + r() * 0.5,
    N = 3 + Math.floor(r() * 6);
  for (let tries = 0; targets.length < N && tries < 500; tries++) {
    const x = 8 + r() * (BW - 30),
      y = 8 + r() * (BH - 16);
    if (
      kind[Math.round(y) * BW + Math.round(x)] !== 0 ||
      Math.hypot(x - town.x, y - town.y) < 22 ||
      targets.some(f => Math.hypot(f.x - x, f.y - y) < 18)
    )
      continue;
    targets.push({ x, y, size: 1.2 + r() * 1.6, ph: r() * 10, puffs: [], seed: rng(Math.floor(r() * 1e9)) });
  }
  // clouds hide nothing, but look like smoke
  const clouds = Array.from({ length: 2 }, () => ({ x: r() * BW, y: r() * BH, r: 8 + r() * 6 }));
  const cloudX = (c, t) => ((c.x + t * 2) % (BW + 30)) - 15;
  return {
    targets,
    toggle: { button: 'THERMAL IR', on: 'THERMAL IR', off: 'VISIBLE' },
    frame(t, ir) {
      if (ir) {
        // thermal: the ground goes dark and cool, water coldest, roofs and old scars faintly warm, fires blaze
        for (let y = 0; y < BH; y++)
          for (let x = 0; x < BW; x++) {
            const i = (y * BW + x) * 4,
              lum = (base[i] * 0.3 + base[i + 1] * 0.5 + base[i + 2] * 0.2) / 255,
              k = kind[y * BW + x];
            let c = pick(IR, Math.min(1, lum * 2.2), x, y);
            if (k === 1) c = [4, 6, 20];
            if (k === 3)
              c = pick(
                [
                  [80, 28, 58],
                  [120, 40, 56],
                  [150, 58, 52],
                ],
                0.6 + Math.sin(t * 2 + x) * 0.1,
                x,
                y,
              );
            if (k === 4)
              c = pick(
                [
                  [40, 18, 50],
                  [62, 24, 60],
                ],
                0.6,
                x,
                y,
              );
            put(x, y, c);
          }
        clouds.forEach(c => blob(cloudX(c, t), c.y, c.r, (px, py, d) => put(px, py, [10, 12, 36], 0.7 * (1 - d)), sh, 0.5));
        targets.forEach(f => {
          const fl = 1 + Math.sin(t * 9 + f.ph) * 0.15;
          blob(f.x, f.y, (f.size + 2.5) * fl, (px, py, d) => put(px, py, pick(HOT, (1 - d) * 0.6, px, py), 0.9), sh, 0.3);
          blob(f.x, f.y, f.size * fl, (px, py, d) => put(px, py, pick(HOT, 1 - d * 0.5, px, py)), sh, 0.3);
        });
        return;
      }
      fb.set(base);
      // visible: flames peek out under thick smoke, and the plumes billow downwind and merge
      targets.forEach(f => {
        if (Math.sin(t * 13 + f.ph) > -0.2) put(f.x, f.y, [255, 150, 50]);
        if (Math.sin(t * 11 + f.ph * 2) > 0.3) put(f.x + 1, f.y - 1, [255, 220, 120]);
        if (!f.last || t - f.last > 0.12 || t < f.last) {
          f.last = t;
          f.puffs.push({ t0: t, dx: (f.seed() - 0.5) * 1.5, dy: (f.seed() - 0.5) * 1.5 });
        }
        f.puffs = f.puffs.filter(p => t - p.t0 < 7 && t >= p.t0);
        f.puffs.forEach(p => {
          const a = t - p.t0,
            x = f.x + p.dx + a * 6,
            y = f.y + p.dy + a * 6 * wind + Math.sin(a * 1.3 + f.ph) * 2,
            rr = 1.5 + a * 1.1,
            fade = Math.max(0, 1 - a / 7);
          for (let yy = -Math.ceil(rr); yy <= rr; yy++)
            for (let xx = -Math.ceil(rr); xx <= rr; xx++) {
              const d = Math.hypot(xx, yy) / rr;
              if (d <= 1 && bay(Math.round(x + xx), Math.round(y + yy)) < (1 - d) * fade * 1.2)
                put(x + xx, y + yy, a < 0.6 ? [150, 132, 120] : [200, 200, 196], a < 1.5 ? 0.85 : 0.6);
            }
        });
      });
      clouds.forEach(c =>
        blob(cloudX(c, t), c.y, c.r, (px, py, d) => bay(px, py) < (1 - d) * 1.4 && put(px, py, [236, 238, 240], 0.85), sh, 0.5),
      );
    },
  };
}

const SODA = [
  [50, 84, 80],
  [64, 98, 88],
  [82, 112, 94],
  [102, 124, 98],
];
const MUD = [
  [104, 92, 76],
  [124, 110, 90],
  [146, 132, 108],
];
const SALT = [
  [206, 202, 190],
  [224, 220, 210],
  [240, 238, 232],
];
const SCRUB = [
  [112, 98, 66],
  [132, 116, 78],
  [152, 136, 92],
];
const PINK = [
  [200, 98, 120],
  [230, 138, 156],
  [248, 182, 192],
];
function flamingos(B, r) {
  const { setBase, getBase, put, fb, base } = B,
    n = makeNoise(r() * 1000),
    sh = makeNoise(r() * 1000),
    free = spacer();
  // a soda lake filling most of the frame, ragged shore, mud flats and salt crust round it, dry scrub beyond
  const cx = BW * 0.5 + (r() - 0.5) * 40,
    cy = BH * 0.55,
    shore = (x, y) => Math.hypot((x - cx) / (BW * 0.55), (y - cy) / (BH * 0.58)) + (n(x / 20, y / 20, 3) - 0.5) * 0.5;
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const d = shore(x, y);
      if (d < 0.92) {
        let c = pick(SODA, 0.5 + (n(x / 16 + 40, y / 12, 3) - 0.5) * 0.6, x, y);
        if (d > 0.8) c = mix(c, pick(MUD, 0.6, x, y), (d - 0.8) / 0.12); // paler shallows near the shore
        setBase(x, y, c);
      } else if (d < 1.02)
        setBase(x, y, n(x / 6 + 9, y / 6, 2) > 0.55 ? pick(SALT, n(x / 3, y / 3, 1), x, y) : pick(MUD, n(x / 4, y / 4, 2), x, y));
      else {
        setBase(x, y, pick(SCRUB, n(x / 10, y / 10, 2), x, y));
        const h = Math.sin(x * 91.7 + y * 47.3) * 9871.3;
        if (h - Math.floor(h) > 0.965) setBase(x, y, [64, 80, 46]); // a bush
      }
    }
  // decoys: smooth streaks of pink algae in the water (no speckle)...
  const algae = 2 + Math.floor(r() * 3);
  for (let k = 0; k < algae; k++) {
    const x = cx + (r() - 0.5) * BW * 0.6,
      y = cy + (r() - 0.5) * BH * 0.5,
      a = r() * Math.PI,
      len = 14 + r() * 16;
    if (shore(x, y) > 0.75 || !free(x, y, 14)) continue;
    for (let s = -len; s <= len; s++)
      for (let q = -4; q <= 4; q++) {
        const e = (s / len) ** 2 + (q / 3.5) ** 2,
          px = x + Math.cos(a) * s - Math.sin(a) * q,
          py = y + Math.sin(a) * s + Math.cos(a) * q;
        if (e < 1 && bay(Math.round(px), Math.round(py)) < (1 - e) * 0.9 && px >= 0 && py >= 0 && px < BW && py < BH)
          setBase(px, py, mix(getBase(Math.round(px), Math.round(py)), [178, 98, 98], 0.45));
      }
  }
  // ...and hot springs steaming on the shore
  const springs = [];
  for (let tries = 0; springs.length < 2 && tries < 300; tries++) {
    const x = r() * BW,
      y = r() * BH,
      d = shore(x, y);
    if (d < 0.95 || d > 1.05 || !free(x, y, 16)) continue;
    blob(x, y, 1.6, (px, py) => setBase(px, py, [150, 190, 186]), sh, 0.3);
    springs.push({ x, y, ph: r() * 9 });
  }
  // flocks: speckled pink clusters standing in the shallows
  const N = 4 + Math.floor(r() * 6),
    targets = [];
  for (let tries = 0; targets.length < N && tries < 600; tries++) {
    const x = 8 + r() * (BW - 16),
      y = 8 + r() * (BH - 16),
      d = shore(x, y);
    if (d < 0.55 || d > 0.88 || !free(x, y, 14)) continue;
    const birds = [],
      count = 18 + r() * 20,
      rr = 3 + r() * 2;
    for (let b = 0; b < count; b++) {
      const a = r() * Math.PI * 2,
        q = Math.sqrt(r()) * rr;
      birds.push({ x: x + Math.cos(a) * q, y: y + Math.sin(a) * q * 0.7, lv: r(), ph: r() * 9 });
    }
    targets.push({ x, y, birds });
  }
  return {
    targets,
    frame(t) {
      fb.set(base);
      targets.forEach(f =>
        f.birds.forEach(b => {
          const j = Math.sin(t * 0.9 + b.ph) > 0.94 ? 1 : 0;
          put(b.x + j, b.y, pick(PINK, b.lv, Math.round(b.x), Math.round(b.y)));
          if (b.lv > 0.8) put(b.x + j, b.y - 1, [250, 236, 238]);
        }),
      );
      springs.forEach(s => {
        for (let k = 0; k < 3; k++) {
          const a = (t * 0.5 + s.ph + k / 3) % 1;
          blob(
            s.x + a * 3,
            s.y - a * 8,
            1 + a * 2.5,
            (px, py, d) => bay(px, py) < (1 - d) * (1 - a) * 1.4 && put(px, py, [236, 240, 240], 0.7),
            sh,
            0.4,
          );
        }
      });
    },
  };
}

const GRASS = [
  [58, 78, 44],
  [70, 92, 52],
  [86, 106, 60],
  [104, 118, 70],
];
const TARMAC = [
  [76, 78, 80],
  [88, 90, 92],
  [100, 102, 104],
];
// a parked aircraft seen from above, nose along a: fuselage, swept wings, tailplane. Its shadow falls to the lower
// right; outline: just painted lines on the tarmac, with no body and no shadow.
function plane(B, x, y, a, len, outline = false) {
  const ca = Math.cos(a),
    sa = Math.sin(a),
    pts = [];
  const at = (s, q) => [x + ca * s - sa * q, y + sa * s + ca * q];
  for (let s = -len / 2; s <= len / 2; s += 0.5) pts.push(at(s, 0));
  const span = len * 0.9,
    wing = len * 0.08;
  for (let q = -span / 2; q <= span / 2; q += 0.5) pts.push(at(wing - Math.abs(q) * 0.35, q));
  for (let q = -len * 0.2; q <= len * 0.2; q += 0.5) pts.push(at(-len / 2 + 1 - Math.abs(q) * 0.3, q));
  if (outline) return pts.forEach(([px, py]) => bay(Math.round(px), Math.round(py)) < 0.6 && B.setBase(px, py, [150, 152, 148]));
  pts.forEach(([px, py]) => B.setBase(px + 2, py + 1, [42, 44, 46]));
  pts.forEach(([px, py]) => B.setBase(px, py, [204, 206, 208]));
  for (let s = -len / 2 + 1; s < len / 2 - 1; s += 0.5) B.setBase(...at(s, 1), [176, 178, 180]);
  B.setBase(...at(len / 2 - 1, 0), [60, 70, 84]); // cockpit
}
// a fighter jet from above, nose along a: short fuselage, delta wings swept back to the tail, twin fins; dark grey,
// shadow to the lower right. outline: just painted lines on the tarmac, with no body and no shadow.
function fighter(B, x, y, a, len, outline = false) {
  const ca = Math.cos(a),
    sa = Math.sin(a),
    pts = [];
  const at = (s, q) => [x + ca * s - sa * q, y + sa * s + ca * q];
  for (let s = -len / 2; s <= len / 2; s += 0.5) pts.push(at(s, 0));
  // the delta: half-span grows from nothing just behind the cockpit to full at the tail
  const root = len * 0.15,
    tail = -len / 2 + 1;
  for (let s = tail; s <= root; s += 0.5) {
    const half = ((root - s) / (root - tail)) * len * 0.42;
    for (let q = -half; q <= half; q += 0.5) pts.push(at(s, q));
  }
  for (const side of [-1, 1]) for (let k = 0; k < 2; k++) pts.push(at(-len / 2 + k, side * 1.5)); // twin fins
  if (outline) return pts.forEach(([px, py]) => bay(Math.round(px), Math.round(py)) < 0.35 && B.setBase(px, py, [150, 152, 148]));
  pts.forEach(([px, py]) => B.setBase(px + 2, py + 1, [36, 38, 40]));
  pts.forEach(([px, py]) => B.setBase(px, py, [112, 118, 124]));
  for (let s = -len / 2 + 1; s < len / 2 - 1; s += 0.5) B.setBase(...at(s, 0), [142, 148, 154]); // the spine catches the light
  B.setBase(...at(len / 2 - 1.5, 0), [40, 56, 72]); // canopy
}
function aircraft(B, r) {
  const { setBase, fb, base } = B,
    n = makeNoise(r() * 1000),
    free = spacer();
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) setBase(x, y, pick(GRASS, n(x / 14, y / 14, 3) * 0.8 + n(x / 2, y / 2, 1) * 0.25, x, y));
  const tar = (x, y) => setBase(x, y, pick(TARMAC, n(x / 3 + 20, y / 3, 1), x, y));
  // the runway across the top, with centre-line dashes and threshold stripes; a taxiway below it; aprons below that
  const ry = 22 + Math.floor(r() * 14);
  for (let x = 6; x < BW - 6; x++)
    for (let y = ry - 4; y <= ry + 4; y++) {
      tar(x, y);
      if (y === ry && x % 8 < 4 && x > 22 && x < BW - 22) setBase(x, y, [226, 226, 220]);
      if ((x < 16 || x > BW - 17) && (y - ry) % 2 === 0 && Math.abs(y - ry) < 4) setBase(x, y, [226, 226, 220]);
    }
  const ty = ry + 15;
  for (let x = 14; x < BW - 14; x++) for (let y = ty - 1; y <= ty + 1; y++) tar(x, y);
  for (const cxx of [30, BW / 2, BW - 30]) for (let y = ry + 4; y < ty; y++) for (let x = cxx - 1; x <= cxx + 1; x++) tar(x, y);
  const aprons = [
    [12, ty + 6, 100, BH - 10],
    [124, ty + 6, BW - 40, BH - 10],
  ];
  aprons.forEach(([x0, y0, x1, y1]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) tar(x, y);
    for (let x = x0 + 8; x < x1; x += 16) for (let y = y0 + 2; y < y0 + 8; y++) setBase(x, y, [168, 150, 70]); // parking lines
  });
  for (let x = 40; x < 60; x++) for (let y = ty + 1; y < ty + 6; y++) tar(x, y);
  for (let x = 160; x < 180; x++) for (let y = ty + 1; y < ty + 6; y++) tar(x, y);
  // hangars along the right edge, roofs lit from the top left
  for (let k = 0; k < 3; k++) {
    const hx = BW - 34,
      hy = ty + 8 + k * 26;
    if (hy + 18 > BH - 4) break;
    for (let y = 0; y < 18; y++) for (let x = 0; x < 26; x++) setBase(hx + x + 2, hy + y + 2, [40, 44, 40]);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 26; x++) setBase(hx + x, hy + y, y < 9 ? [168, 168, 162] : [138, 138, 134]);
    free(hx + 13, hy + 9, 20);
  }
  const onApron = (x, y, m = 7) => aprons.some(([x0, y0, x1, y1]) => x > x0 + m && x < x1 - m && y > y0 + m && y < y1 - m);
  // decoys first, as they need the most room: big transport and tanker planes...
  for (let k = 0, tries = 0; k < 2 && tries < 300; tries++) {
    const x = r() * BW,
      y = r() * BH;
    if (!onApron(x, y, 11) || !free(x, y, 22)) continue;
    plane(B, x, y, -Math.PI / 2 + (r() - 0.5) * 0.3, 17 + r() * 3);
    k++;
  }
  // ...round fuel tanks out on the grass, each with its shadow...
  const farm = { x: 20 + r() * 60, y: BH - 14 };
  for (let k = 0; k < 3; k++) {
    const x = farm.x + k * 9,
      y = farm.y;
    if (!free(x, y, 7)) continue;
    blob(
      x + 2,
      y + 1,
      3.2,
      (px, py) => setBase(px, py, [38, 44, 34]),
      () => 0.5,
      0,
    );
    blob(
      x,
      y,
      3.2,
      (px, py, d) => setBase(px, py, d < 0.35 ? [236, 236, 230] : d < 0.8 ? [206, 208, 204] : [150, 152, 148]),
      () => 0.5,
      0,
    );
  }
  // ...and fuel trucks on the aprons
  for (let k = 0, tries = 0; k < 3 && tries < 200; tries++) {
    const x = Math.round(r() * BW),
      y = Math.round(r() * BH);
    if (!onApron(x, y) || !free(x, y, 9)) continue;
    for (let q = 0; q < 4; q++) for (let w = 0; w < 2; w++) setBase(x + q + 1, y + w + 1, [40, 42, 44]);
    for (let q = 0; q < 4; q++) for (let w = 0; w < 2; w++) setBase(x + q, y + w, q === 0 ? [236, 236, 230] : [222, 206, 110]);
    k++;
  }
  // fighter jets on the aprons, mostly nose to the taxiway
  const N = 3 + Math.floor(r() * 6),
    targets = [];
  for (let tries = 0; targets.length < N && tries < 600; tries++) {
    const x = r() * BW,
      y = r() * BH;
    if (!onApron(x, y) || !free(x, y, 13)) continue;
    fighter(B, x, y, -Math.PI / 2 + (r() < 0.75 ? (r() - 0.5) * 0.3 : (r() - 0.5) * 3), 9 + r() * 2);
    targets.push({ x, y });
  }
  // and fighters painted on the tarmac: the right shape, but no shadow
  for (let k = 0, tries = 0; k < 2 && tries < 200; tries++) {
    const x = r() * BW,
      y = r() * BH;
    if (!onApron(x, y) || !free(x, y, 13)) continue;
    fighter(B, x, y, -Math.PI / 2 + (r() - 0.5) * 0.4, 10, true);
    k++;
  }
  return {
    targets,
    frame() {
      fb.set(base);
    },
  };
}

const RADAR = [
  [10, 10, 12],
  [34, 34, 36],
  [62, 62, 64],
  [94, 94, 94],
  [128, 128, 126],
  [166, 166, 162],
  [206, 206, 200],
];
// Oil spills, the way they're really found: by radar (SAR). In visible light a cloud deck hides much of the sea. Radar
// sees through cloud: it measures how much the ripples on the sea scatter its microwaves back, and oil damps those
// ripples, so slicks come out dark and sharp-edged. Windless patches are dark too (no ripples), but broad and soft;
// ships and platforms are bright points. Slicks are drawn out downwind, often trailing from a ship or platform.
function oil(B, r) {
  const { put } = B,
    n = makeNoise(r() * 1000, 64),
    sh = makeNoise(r() * 1000),
    cl = makeNoise(r() * 1000),
    glint = r(),
    free = spacer(),
    wind = r() * Math.PI * 2,
    wc = Math.cos(wind),
    ws = Math.sin(wind);
  const slick = new Float32Array(BW * BH),
    owner = new Int8Array(BW * BH).fill(-1),
    N = 3 + Math.floor(r() * 4),
    targets = [],
    sources = [];
  for (let tries = 0; targets.length < N && tries < 400; tries++) {
    const x = 20 + r() * (BW - 40),
      y = 16 + r() * (BH - 32),
      len = 16 + r() * 18,
      wid = 3 + r() * 2.5,
      a = wind + (r() - 0.5) * 0.4;
    if (!free(x, y, len * 1.1)) continue;
    const ca = Math.cos(a),
      sa = Math.sin(a),
      id = targets.length;
    for (let yy = -len - 6; yy <= len + 6; yy++)
      for (let xx = -len - 6; xx <= len + 6; xx++) {
        const px = Math.round(x + xx),
          py = Math.round(y + yy);
        if (px < 0 || py < 0 || px >= BW || py >= BH) continue;
        const s = xx * ca + yy * sa,
          q = -xx * sa + yy * ca,
          taper = 1 - Math.max(0, s / len) * 0.6, // narrows toward the downwind end
          e = (s / len) ** 2 + (q / (wid * taper)) ** 2 + (sh(px / 5, py / 5, 2) - 0.5) * 0.6;
        if (e < 1 && 1 - e > slick[py * BW + px]) {
          slick[py * BW + px] = 1 - e;
          owner[py * BW + px] = id;
        }
      }
    if (r() < 0.6) sources.push({ x: x - ca * len, y: y - sa * len, a, rig: r() < 0.4 });
    targets.push({ x, y, box: len * 8, hit: (mx, my) => owner[Math.round(my) * BW + Math.round(mx)] === id });
  }
  // decoys: windless patches, broad and soft-edged
  const lows = [];
  for (let tries = 0; lows.length < 2 && tries < 300; tries++) {
    const x = r() * BW,
      y = r() * BH,
      rad = 13 + r() * 9;
    if (free(x, y, rad + 6)) lows.push({ x, y, r: rad });
  }
  const boats = [];
  for (let tries = 0; boats.length < 2 && tries < 200; tries++) {
    const x = r() * BW,
      y = r() * BH;
    if (free(x, y, 18)) boats.push({ x, y, a: r() * Math.PI * 2 });
  }
  const lowAt = (x, y) =>
    lows.reduce((m, L) => {
      const d = Math.hypot(x - L.x, y - L.y) / L.r + (sh(x / 7 + 40, y / 7, 2) - 0.5) * 0.35;
      return Math.max(m, d < 1 ? Math.pow(1 - d, 0.7) : 0);
    }, 0);
  const calm = (x, y) => Math.max(slick[y * BW + x] > 0 ? 0.6 + slick[y * BW + x] * 0.4 : 0, lowAt(x, y) * 0.3);
  // radar speckle is fixed in a given image, so it's worked out once
  const speckle = new Float32Array(BW * BH).map((_, i) => {
    const h = Math.sin((i % BW) * 12.9898 + Math.floor(i / BW) * 78.233) * 43758.5453;
    return 0.55 + (h - Math.floor(h)) * 0.9;
  });
  const bright = (x, y, big) => {
    put(x, y, [255, 255, 250]);
    put(x + 1, y, [236, 236, 230]);
    const arm = big ? 4 : 2; // the bright cross a strong reflector makes in a radar image
    for (let k = 2; k <= arm; k++)
      for (const [dx, dy] of [
        [k, 0],
        [-k + 1, 0],
        [0, k],
        [0, -k],
      ])
        put(x + dx, y + dy, [190, 190, 184], 0.7);
  };
  return {
    targets,
    toggle: { button: 'RADAR', on: 'RADAR (SAR)', off: 'VISIBLE' },
    frame(t, sar) {
      if (sar) {
        for (let y = 0; y < BH; y++)
          for (let x = 0; x < BW; x++) {
            const i = y * BW + x,
              k = slick[i],
              rows = n((x * wc + y * ws) / 14, (-x * ws + y * wc) / 2.5, 2); // wind streaks along the wind
            let b = 0.6 + (rows - 0.5) * 0.25;
            b *= 1 - 0.7 * lowAt(x, y);
            if (k > 0) b *= 0.18 + 0.12 * (1 - k);
            put(x, y, pick(RADAR, Math.max(0, Math.min(1, b * speckle[i])), x, y));
          }
        sources.forEach(s => bright(s.x, s.y, true));
        boats.forEach(b => bright(b.x, b.y, false));
        return;
      }
      ocean(put, n, t, glint, calm);
      // a thin rainbow sheen round each slick's edge, the way thin films of oil shimmer
      for (let y = 0; y < BH; y++)
        for (let x = 0; x < BW; x++) {
          const k = slick[y * BW + x];
          if (k > 0 && k < 0.22 && bay(x, y) < 0.55)
            put(
              x,
              y,
              [
                [130, 70, 150],
                [60, 130, 170],
                [176, 166, 84],
              ][Math.floor((x + y + t * 3) / 3) % 3],
              0.75,
            );
        }
      sources.forEach(s => {
        if (!s.rig) return ship(put, s.x, s.y, s.a, true);
        for (let yy = -3; yy <= 3; yy++)
          for (let xx = -3; xx <= 3; xx++)
            put(s.x + xx, s.y + yy, Math.abs(xx) === 3 || Math.abs(yy) === 3 ? [70, 74, 78] : [150, 152, 148]);
        put(s.x + 2, s.y - 4, (t * 6) % 2 < 1 ? [255, 170, 60] : [255, 220, 120]); // the flare stack
      });
      boats.forEach(b => ship(put, b.x, b.y, b.a));
      // the cloud deck, drifting slowly
      for (let y = 0; y < BH; y++)
        for (let x = 0; x < BW; x++) {
          const c = cl((x + t * 1.5) / 34, y / 24, 3);
          if (c > 0.5 && bay(x, y) < (c - 0.5) * 9) put(x, y, pick(CLOUD, Math.min(1, (c - 0.5) * 3.2), x, y), 0.96);
        }
    },
  };
}

function darkships(B, r) {
  const { put } = B,
    n = makeNoise(r() * 1000, 64),
    glint = r(),
    free = spacer(),
    ships = [];
  // a busy patch of ocean: cargo ships (which always broadcast) and fishing boats, some of which have switched off
  const count = 10 + Math.floor(r() * 5),
    dark = 2 + Math.floor(r() * 4);
  for (let tries = 0; ships.length < count && tries < 600; tries++) {
    const x = 12 + r() * (BW - 24),
      y = 10 + r() * (BH - 20);
    if (!free(x, y, 17)) continue;
    const big = ships.length >= dark && r() < 0.35,
      a = r() * Math.PI * 2,
      lag = 2 + r() * 3; // the broadcast position trails the ship a little: it was sent a moment ago
    ships.push({
      x,
      y,
      a,
      big,
      dark: ships.length < dark,
      ax: x - Math.cos(a) * lag + (r() - 0.5) * 2,
      ay: y - Math.sin(a) * lag + (r() - 0.5) * 2,
    });
  }
  // each broadcasting ship pings on its own rhythm, every few seconds
  ships.forEach(s => {
    s.every = 2.5 + r() * 3.5;
    s.ph = r() * s.every;
  });
  return {
    targets: ships.filter(s => s.dark),
    frame(t) {
      ocean(put, n, t, glint);
      ships.forEach(s => ship(put, s.x, s.y, s.a, s.big));
      // a ping: a ring spreading from the position the ship reported, fading as it goes. Silent ships never ping.
      ships.forEach(s => {
        if (s.dark) return;
        const age = (t + s.ph) % s.every;
        if (age > 1.4) return;
        const rad = 1 + age * 6,
          fade = 1 - age / 1.4,
          steps = Math.ceil(rad * 7);
        if (age < 0.25) put(s.ax, s.ay, [230, 255, 236]);
        for (let k = 0; k < steps; k++) {
          const a = (k / steps) * Math.PI * 2,
            x = s.ax + Math.cos(a) * rad,
            y = s.ay + Math.sin(a) * rad;
          if (bay(Math.round(x), Math.round(y)) < fade + 0.15) put(x, y, [196, 255, 214], 0.85 * fade + 0.1);
        }
      });
    },
  };
}

const BUILDERS = { penguins, whales, wildfire, flamingos, aircraft, oil, darkships };
export function makeSurvey(kind, seed) {
  const B = makeBuffer();
  return { ...B, ...BUILDERS[kind](B, rng(seed)) };
}

// The zoom-in: the camera dives at the Earth sprite, punches through cloud, then the ground resolves from coarse blocks
// to sharp pixels. Draws onto the display canvas `ctx` (BW × BH scaled by `scale`).
export const ZOOM_TIME = 2.8;
const cloudN = makeNoise(7);
export function drawZoom(ctx, scale, earth, earthAt, S, t) {
  const W = BW * scale,
    H = BH * scale,
    { fb, img, put } = S;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  if (t < 1.25 && earth.complete && earth.naturalWidth) {
    const k = Math.pow(t / 1.25, 2.2),
      size = H * 0.7 * Math.pow(26, k),
      [u, v] = earthAt;
    ctx.drawImage(earth, W / 2 - (u / 240 - 0.5) * size * k - size / 2, H / 2 - (v / 240 - 0.5) * size * k - size / 2, size, size);
  }
  if (t > 1.2) {
    // the ground, resolving: block size 16 → 1
    const g = Math.min(1, (t - 1.2) / (ZOOM_TIME - 1.4)),
      blk = [16, 12, 8, 6, 4, 3, 2, 1][Math.min(7, Math.floor(g * 8))];
    S.frame(t, false);
    if (blk > 1)
      for (let by = 0; by < BH; by += blk)
        for (let bx = 0; bx < BW; bx += blk) {
          const si = (Math.min(BH - 1, by + (blk >> 1)) * BW + Math.min(BW - 1, bx + (blk >> 1))) * 4;
          for (let y = by; y < Math.min(BH, by + blk); y++)
            for (let x = bx; x < Math.min(BW, bx + blk); x++) {
              const i = (y * BW + x) * 4;
              fb[i] = fb[si];
              fb[i + 1] = fb[si + 1];
              fb[i + 2] = fb[si + 2];
            }
        }
  } else for (let i = 3; i < fb.length; i += 4) fb[i] = 0;
  // clouds rush outward past the camera
  if (t > 0.7) {
    const z = 1 + Math.pow(t - 0.7, 2) * 3,
      cover = Math.min(1, (t - 0.7) / 0.5) * Math.max(0, 1 - (t - 1.6) / 1.1);
    if (cover > 0)
      for (let y = 0; y < BH; y++)
        for (let x = 0; x < BW; x++) {
          const c = cloudN(((x - BW / 2) / z + BW / 2) / 26, ((y - BH / 2) / z + BH / 2) / 18, 3);
          if (c > 1 - cover * 0.95 && bay(x, y) < (c - (1 - cover)) * 3) put(x, y, pick(CLOUD, Math.min(1, (c - 0.35) * 2), x, y), 0.94);
        }
  }
  return img;
}
