import { inSky, onEarth } from './scenes.js';

// Each science request: who asked for it, what the window says, and where the camera dives in on the Earth sprite.
// coords: picks a fresh, believable location each time a window opens (a spot in the right part of the world, or
// anywhere on the sky).
// The window's side panel: brief (what to do), guide (what counts, ✓, and what doesn't, ✗, each with a colour
// swatch: [counts, colour, text]), about (why the requester wants it), optionally cite ([text, url], a paper linked
// at the end of about) and facts (a couple of details about the data).
const earth = (lat, lon) => () => onEarth(Math.random, lat, lon),
  sky = () => inSky(Math.random);
export const SCIENCE = {
  penguins: {
    title: 'PENGUIN COLONY TRACKING',
    signal: 'EMPEROR PENGUINS · SEA ICE SURVEY',
    brief: 'Tap each colony on the sea ice to mark it, then downlink.',
    guide: [
      [1, '#7a5a3c', 'Brown patches on the ice: a colony'],
      [0, '#9aa3a6', 'Grey rock'],
      [0, '#e8f2f6', 'Icebergs'],
    ],
    about: "Emperor penguins breed on sea ice, which is thinning. Counting colonies from orbit shows how they're coping.",
    facts: [
      ['Sensor', 'optical · 0.5 m/px'],
      ['Region', 'Antarctic coast'],
    ],
    uni: 'British Antarctic Survey',
    noun: ['colony', 'colonies'],
    earthAt: [118, 214],
    coords: earth([-78, -65], [-180, 180]), // the Antarctic coast
  },
  whales: {
    title: 'WHALE POPULATION TRACKING',
    signal: 'SOUTHERN BLUE WHALES · CONSERVATION SURVEY',
    brief: 'Tap each whale to mark it, then downlink.',
    guide: [
      [1, '#3a5c7a', 'Long dark shape, often with a white blow'],
      [0, '#c9c9c9', 'Boats (straight wakes)'],
      [0, '#55704a', 'Rocks and kelp'],
    ],
    about: "Blue whales were hunted almost to extinction. Counting them from space shows whether they're coming back.",
    facts: [
      ['Sensor', 'optical · 0.3 m/px'],
      ['Sea state', 'calm, low glint'],
    ],
    uni: 'British Antarctic Survey',
    noun: ['whale', 'whales'],
    earthAt: [150, 150],
    coords: earth([-52, -42], [-50, 10]), // the South Atlantic
  },
  wildfire: {
    title: 'WILDFIRE HOTSPOT TRACKING',
    signal: 'AMAZON RAINFOREST · ACTIVE FIRE SURVEY',
    brief: 'Switch to thermal to see through the smoke. Tap each active fire, then downlink.',
    guide: [
      [1, '#ff7a3a', 'Bright hotspot in thermal: an active fire'],
      [0, '#c9a77a', 'Warm rooftops'],
      [0, '#8a8f8a', 'Smoke (visible only)'],
    ],
    about: 'Most Amazon fires are set to clear forest. Fire counts show where clearing is happening this week.',
    facts: [
      ['Sensor', 'visible + thermal IR (4 µm)'],
      ['Region', 'southern Amazon'],
    ],
    uni: 'Brazilian Fire Research Center',
    noun: ['fire', 'fires'],
    earthAt: [64, 92],
    coords: earth([-14, -2], [-70, -50]), // the Amazon
  },
  flamingos: {
    title: 'FLAMINGO FLOCK TRACKING',
    signal: 'LESSER FLAMINGOS · SODA LAKE SURVEY',
    brief: 'Tap each flock of flamingos in the shallows, then downlink.',
    guide: [
      [1, '#f29ab8', 'Speckled pink clusters: a flock'],
      [0, '#d97a9a', 'Smooth pink streaks: algae'],
      [0, '#e8e8e8', 'Steaming pools: hot springs'],
    ],
    about: 'Lesser flamingos feed on a few soda lakes. As the lakes rise they lose them: this tracks where the flocks go.',
    facts: [
      ['Sensor', 'optical · 0.5 m/px'],
      ['Lakes', 'East African Rift'],
    ],
    uni: 'University of Nairobi',
    noun: ['flock', 'flocks'],
    earthAt: [205, 120],
    coords: earth([-3, 1], [35.5, 36.5]), // the East African Rift lakes
  },
  aircraft: {
    title: 'AIRCRAFT RECOGNITION',
    signal: 'ARMS CONTROL VERIFICATION · DEFENCE SURVEY',
    brief: 'Count the aircraft that match the target card. Tap each one, then downlink your count.',
    guide: [
      [1, '#9aa3ad', 'The type on the target card'],
      [0, '#3a3f44', 'Any other aircraft'],
      [0, '#d9c25a', 'Ground vehicles'],
    ],
    about:
      'Unfortunately, military contracts pay really well. Counting the type of aircraft the Ministry of Defence asks us to will help pay for our next launch.',
    facts: [['Sensor', 'optical · 0.5 m/px']],
    uni: 'Ministry of Defence',
    noun: ['fighter jet', 'fighter jets'],
    earthAt: [80, 185],
    coords: earth([46, 54], [0, 20]), // fallback: each airbase sets its own, by climate
  },
  oil: {
    title: 'OIL SPILL TRACKING',
    signal: 'MARINE POLLUTION · RADAR SURVEY',
    brief: 'Switch to radar to see through cloud. Tap each slick, then downlink.',
    guide: [
      [1, '#1d2328', 'Long, narrow, dark: a slick'],
      [0, '#2c3540', 'Broad and dark: calm water'],
      [0, '#e0e0e0', 'Bright dots: ships, rigs'],
    ],
    about: "Oil smooths the sea's ripples, so radar sees a slick as a dark streak, day or night, through cloud.",
    facts: [
      ['Sensor', 'radar (SAR) · 5 m/px'],
      ['Region', 'Gulf of Mexico'],
    ],
    uni: 'University College Dublin',
    noun: ['slick', 'slicks'],
    earthAt: [140, 190],
    coords: earth([25.5, 29], [-89.5, -86]), // the Gulf of Mexico
  },
  darkships: {
    title: 'DARK SHIP TRACKING',
    signal: 'ILLEGAL FISHING · AIS CROSS-CHECK',
    brief: 'Watch for position pings. Mark every ship that stays silent, then downlink.',
    guide: [
      [1, '#ff5964', 'No ping: a dark ship'],
      [0, '#55b6ff', 'Pings every few seconds'],
    ],
    about: 'Some ships switch off their position beacon to fish illegally inside the Galápagos Marine Reserve.',
    facts: [
      ['Sensor', 'radar (SAR) + AIS'],
      ['Area', 'off the Galápagos'],
    ],
    uni: 'Global Fishing Watch',
    noun: ['dark ship', 'dark ships'],
    earthAt: [130, 50],
    coords: earth([-5, 2], [-95, -82]), // off the Galápagos and Ecuador
  },
  supernova: {
    title: 'SUPERNOVA SEARCH',
    signal: 'TRANSIENT SURVEY · ARCHIVE VS TONIGHT',
    brief: "Tonight's image flicks with an older one. Tap the new star, then downlink.",
    guide: [
      [1, '#ffffff', 'New since the archive: the star'],
      [0, '#ffd166', 'Moves between them: an asteroid'],
      [0, '#c58cff', 'One sharp pixel: a cosmic ray'],
    ],
    about: 'A supernova fades within weeks. Catching one early lets bigger telescopes study it.',
    facts: [['Survey', 'tonight vs archive']],
    uni: 'University of Surrey',
    coords: sky,
  },
  exoplanet: {
    title: 'EXOPLANET TRANSIT SEARCH',
    signal: 'TRANSIT PHOTOMETRY · WATCHING ONE STAR',
    brief: 'Tap each dip in brightness as it scrolls past. Three dips pin down the orbit.',
    guide: [
      [1, '#55b6ff', 'A short, flat-bottomed dip: a transit'],
      [0, '#ffd166', 'Sudden upward spike: a flare'],
    ],
    about: "The dip's depth gives the planet's size; the gap between dips gives the length of its year.",
    facts: [
      ['Method', 'transit photometry'],
      ['Precision', '200 ppm'],
    ],
    uni: 'University of Hawaiʻi',
  },
  galaxies: {
    title: 'GALAXY CLASSIFICATION',
    signal: 'DEEP FIELD · SORT BY SHAPE',
    brief: 'Sort each galaxy by its shape. Classify all 12.',
    guide: [
      [1, '#c9d3ff', 'Spiral: arms winding out'],
      [1, '#9ab0ff', 'Irregular: lumpy, no symmetry'],
      [1, '#ffe2a8', 'Elliptical: smooth oval'],
      [1, '#dfe6ff', 'Disk: a thin edge-on line'],
    ],
    about: 'Galaxies sorted by eye train the ML models that classify millions more. Check out this cool paper on CNNs being used to classify galaxies:',
    cite: ['Varma et al. (2022)', 'https://academic.oup.com/mnras/article/509/2/2654/6425754'],
    facts: [], // the paper takes their room
    uni: 'Instituto de Astrofísica de Canarias',
    coords: sky,
  },
  interstellar: {
    title: 'INTERSTELLAR OBJECT TRACKING',
    signal: 'OBJECT 2026 A1 · VISITOR FROM ANOTHER STAR',
    brief: 'Keep the object inside the reticle until all its data is recorded.',
    guide: [
      [1, '#ffffff', 'The fast-moving object: keep it centred'],
      [0, '#9aa3a6', 'Background stars'],
    ],
    about: 'Only three objects from another star have ever been seen: ʻOumuamua, Borisov and 3I/ATLAS. This is the fourth.',
    facts: [
      ['Orbit', 'hyperbolic · unbound'],
      ['Speed', 'about 58 km/s'],
    ],
    uni: 'Instituto de Astrofísica de Canarias',
    coords: sky,
  },
};
// how wide a minigame's view can be: its full size, or less if the window is short, leaving room above it for the header
// and instructions (up to four lines) and below it for the buttons and a two-line result
export const fitWidth = (w, h) => `min(${w}px, calc((100vh - 420px) * ${w / h}))`;
// text drawn on the pixel scenes is in the pixel font; asked for up front, since drawing on a canvas doesn't make the
// browser download it
export const pixelFont = px => `${px}px "Departure Mono", monospace`;
document.fonts?.load(pixelFont(22));
export const report = data => window.parent !== window && window.parent.postMessage(data, '*');

export function hudText(ctx, s, ax, ay, color = 'rgba(201,255,77,.85)') {
  const W = ctx.canvas.width,
    H = ctx.canvas.height;
  ctx.font = pixelFont(22);
  ctx.textAlign = ax;
  ctx.textBaseline = ay;
  const x = ax === 'left' ? 16 : W - 16,
    y = ay === 'top' ? 14 : H - 14,
    w = ctx.measureText(s).width;
  // a dark backing so the readout stays legible on white ice
  ctx.fillStyle = 'rgba(2,4,6,.62)';
  ctx.fillRect(ax === 'left' ? x - 6 : x - w - 6, ay === 'top' ? y - 4 : y - 26, w + 12, 30);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
export function brackets(ctx) {
  const W = ctx.canvas.width,
    H = ctx.canvas.height,
    L = 34;
  ctx.strokeStyle = 'rgba(201,255,77,.55)';
  ctx.lineWidth = 3;
  for (const [x, y, dx, dy] of [
    [10, 10, 1, 1],
    [W - 10, 10, -1, 1],
    [10, H - 10, 1, -1],
    [W - 10, H - 10, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * L, y);
    ctx.stroke();
  }
}
// the scene's low-res buffer, scaled up onto the display canvas with no smoothing
export function blit(ctx, buf, img) {
  buf.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, ctx.canvas.width, ctx.canvas.height);
}

export const DOWNLINK_TIME = 2.8;
// The downlink: the view dims and a progress bar fills as the data goes down.
export function drawDownlink(ctx, d) {
  const W = ctx.canvas.width,
    H = ctx.canvas.height,
    p = Math.min(1, d / (DOWNLINK_TIME - 0.3));
  ctx.fillStyle = 'rgba(2,4,6,.74)';
  ctx.fillRect(0, 0, W, H);
  ctx.font = pixelFont(22);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const bw = 300,
    bx = W / 2 - bw / 2,
    by = H / 2 - 10;
  ctx.strokeStyle = '#39453f';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, 18);
  ctx.fillStyle = '#55b6ff';
  ctx.fillRect(bx + 3, by + 3, (bw - 6) * p, 12);
  ctx.fillStyle = '#c9ccc8';
  ctx.fillText(p < 1 ? `DOWNLINK ${Math.round(p * 100)}% · ${(3.8 + Math.sin(d * 3) * 0.6).toFixed(1)} MB/s` : 'RECEIVED', W / 2, by - 30);
}
