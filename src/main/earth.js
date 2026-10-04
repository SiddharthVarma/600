// The spinning Earth at the centre of the constellation: a small hand-made world map wrapped onto a sphere and turned
// slowly, drawn as chunky pixel art in the same green and blue (and black outline) as the original sprite, with ice
// caps at both poles. Each frame, every block of the disc is traced back to the latitude and longitude it shows (an
// orthographic projection), and the map is read there.
const N = 32, // blocks across
  TURN = 30, // seconds per rotation
  OUTLINE = 1 - 1.15 / N; // the outermost ring of blocks is the black outline

// The world in 5° cells (72 across, 36 down from 90°N), land as column ranges per row. Rough on purpose: it only has to
// read as Earth at 32 blocks across. India is drawn a touch wide so it reads at this size.
const LAND = [
  [], // 90–85N
  [
    [16, 22],
    [26, 33],
    [39, 39],
    [47, 48],
    [55, 57],
  ],
  [
    [12, 23],
    [21, 34],
    [39, 40],
    [47, 49],
    [56, 60],
  ],
  [
    [4, 7],
    [8, 22],
    [22, 32],
    [41, 43],
    [44, 71],
  ],
  [
    [2, 8],
    [8, 16],
    [21, 24],
    [25, 31],
    [32, 33],
    [37, 41],
    [41, 71],
  ],
  [
    [1, 8],
    [8, 16],
    [21, 24],
    [26, 28],
    [32, 33],
    [37, 42],
    [42, 71],
  ],
  [
    [2, 6],
    [9, 16],
    [21, 24],
    [35, 35],
    [37, 39],
    [41, 63],
    [68, 70],
  ],
  [
    [8, 21],
    [34, 35],
    [36, 63],
    [68, 69],
  ],
  [
    [11, 24],
    [35, 41],
    [44, 71],
  ],
  [
    [11, 22],
    [34, 36],
    [37, 41],
    [44, 45],
    [48, 60],
    [61, 61],
    [64, 64],
  ],
  [
    [12, 21],
    [34, 35],
    [40, 44],
    [45, 50],
    [51, 60],
    [61, 61],
    [63, 64],
  ],
  [
    [12, 20],
    [34, 42],
    [42, 47],
    [47, 60],
    [62, 63],
  ],
  [
    [13, 17],
    [19, 19],
    [33, 42],
    [43, 49],
    [49, 60],
  ],
  [
    [14, 18],
    [19, 21],
    [33, 43],
    [43, 47],
    [49, 54],
    [56, 59],
  ], // India
  [
    [16, 18],
    [33, 44],
    [44, 46],
    [50, 54],
    [56, 57],
    [60, 61],
  ],
  [
    [16, 17],
    [33, 45],
    [46, 46],
    [50, 53],
    [56, 57],
    [60, 61],
  ],
  [
    [20, 24],
    [33, 45],
    [51, 52],
    [56, 56],
    [61, 61],
  ], // India's tip and Sri Lanka
  [
    [20, 26],
    [37, 44],
    [55, 56],
    [58, 59],
  ],
  [
    [20, 27],
    [38, 44],
    [56, 57],
    [58, 59],
    [60, 60],
    [62, 65],
  ],
  [
    [21, 27],
    [38, 43],
    [57, 58],
    [62, 65],
  ],
  [
    [21, 27],
    [38, 43],
    [45, 45],
    [62, 65],
  ],
  [
    [22, 27],
    [38, 43],
    [45, 45],
    [60, 66],
  ],
  [
    [22, 26],
    [38, 42],
    [45, 45],
    [59, 66],
  ],
  [
    [22, 25],
    [39, 42],
    [59, 66],
  ],
  [
    [21, 24],
    [39, 41],
    [59, 65],
  ],
  [
    [21, 23],
    [64, 65],
    [70, 71],
  ],
  [
    [21, 22],
    [65, 65],
    [69, 70],
  ],
  [
    [21, 22],
    [69, 69],
  ],
  [[21, 22]],
  [], // 60–55S
  [[22, 23]],
  [
    [0, 2],
    [7, 23],
    [31, 71],
  ],
  [
    [7, 24],
    [30, 71],
  ],
  [[0, 71]],
  [[0, 71]],
  [[0, 71]],
];
const ROWS = 36,
  COLS = 72,
  map = LAND.map(rs => {
    const row = new Uint8Array(COLS);
    rs.forEach(([a, b]) => {
      for (let c = a; c <= b; c++) row[c] = 1;
    });
    return row;
  });
const OCEAN = [63, 81, 181],
  GROUND = [76, 175, 80],
  ICE = [228, 236, 244];
// what each block of the latest frame shows, so a camera dive can aim at the right kind of spot
export const SURFACE = { none: 0, outline: 1, ocean: 2, land: 3, ice: 4 };
const kinds = new Uint8Array(N * N);
const canvas = document.createElement('canvas'),
  gctx = canvas.getContext('2d'),
  img = gctx.createImageData(N, N);
canvas.width = canvas.height = N;

function landAt(lat, lon) {
  const r = Math.min(ROWS - 1, Math.max(0, Math.floor((90 - lat) / 5))),
    c = ((Math.floor((lon + 180) / 5) % COLS) + COLS) % COLS;
  return map[r][c];
}
function render(spin) {
  const d = img.data;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = ((i + 0.5) / N) * 2 - 1,
        y = ((j + 0.5) / N) * 2 - 1,
        r2 = x * x + y * y,
        k = j * N + i,
        p = k * 4;
      if (r2 > 1) {
        d[p + 3] = 0;
        kinds[k] = SURFACE.none;
        continue;
      }
      if (Math.sqrt(r2) > OUTLINE) {
        d[p] = d[p + 1] = d[p + 2] = 0;
        d[p + 3] = 255;
        kinds[k] = SURFACE.outline;
        continue;
      }
      const z = Math.sqrt(1 - r2),
        lat = (Math.asin(-y) * 180) / Math.PI,
        lon = (Math.atan2(x, z) * 180) / Math.PI + spin,
        lon360 = ((lon % 360) + 360) % 360,
        land = landAt(lat, lon),
        // ice caps are bands of latitude, so they stay in view as it turns; Greenland's ice sheet comes and goes
        ice = lat > 62 || lat < -55 || (land && lat > 60 && lon360 > 290 && lon360 < 340),
        c = ice ? ICE : land ? GROUND : OCEAN;
      d[p] = c[0];
      d[p + 1] = c[1];
      d[p + 2] = c[2];
      d[p + 3] = 255;
      kinds[k] = ice ? SURFACE.ice : land ? SURFACE.land : SURFACE.ocean;
    }
  gctx.putImageData(img, 0, 0);
}
// draw the Earth for this moment, centred at (cx, cy) with radius r
export function drawEarth(ctx, cx, cy, r, now) {
  render(((now / 1000) * 360) / TURN);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, cx - r, cy - r, r * 2, r * 2);
  ctx.imageSmoothingEnabled = true;
}
// a copy of the Earth as it looks right now, and a spot on it (0..1 across and down) of the wanted kind, away from the
// edge, for a camera dive to aim at
export function snapshotEarth(want) {
  const copy = document.createElement('canvas');
  copy.width = copy.height = N;
  copy.getContext('2d').drawImage(canvas, 0, 0);
  const spots = [];
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = ((i + 0.5) / N) * 2 - 1,
        y = ((j + 0.5) / N) * 2 - 1;
      if (kinds[j * N + i] === SURFACE[want] && x * x + y * y < 0.6) spots.push([(i + 0.5) / N, (j + 0.5) / N]);
    }
  // ice sits at the poles, past the inner area: take the nearest ice to the centre instead
  if (!spots.length)
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) if (kinds[j * N + i] === SURFACE[want]) spots.push([(i + 0.5) / N, (j + 0.5) / N]);
  spots.sort((a, b) => Math.hypot(a[0] - 0.5, a[1] - 0.5) - Math.hypot(b[0] - 0.5, b[1] - 0.5));
  const pool = spots.slice(0, Math.max(1, Math.ceil(spots.length / 3)));
  return { image: copy, at: pool[Math.floor(Math.random() * pool.length)] || [0.5, 0.5] };
}
