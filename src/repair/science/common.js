
// Each science request: who asked for it, what the window says, and where the camera dives in on the Earth sprite.
export const SCIENCE = {
  penguins: {
    title: 'PENGUIN COLONY TRACKING',
    signal: 'EMPEROR PENGUINS · SEA ICE SURVEY',
    text: "Penguin colonies show up as brown patches on the sea ice. Tap each colony to mark it, then downlink your results to the British Antarctic Survey. Grey rocks and icebergs aren't colonies.",
    uni: 'British Antarctic Survey',
    noun: ['colony', 'colonies'],
    earthAt: [118, 214],
    coords: '70.6°S 11.6°W',
  },
  whales: {
    title: 'WHALE POPULATION TRACKING',
    signal: 'SOUTHERN BLUE WHALES · CONSERVATION SURVEY',
    text: "Tap each whale to mark it, then downlink your results to the British Antarctic Survey. Watch for their blows. Boats, rocks and kelp don't count.",
    uni: 'British Antarctic Survey',
    noun: ['whale', 'whales'],
    earthAt: [150, 150],
    coords: '41.2°S 63.9°W',
  },
  wildfire: {
    title: 'WILDFIRE HOTSPOT TRACKING',
    signal: 'AMAZON RAINFOREST · ACTIVE FIRE SURVEY',
    text: "Smoke hides the fires. Switch to thermal infrared to see through it, tap each active fire to mark it, then downlink your survey to the Brazilian Fire Research Center. Warm rooftops aren't fires.",
    uni: 'Brazilian Fire Research Center',
    noun: ['fire', 'fires'],
    earthAt: [64, 92],
    coords: '9.0°S 63.0°W',
  },
  flamingos: {
    title: 'FLAMINGO FLOCK TRACKING',
    signal: 'LESSER FLAMINGOS · SODA LAKE SURVEY',
    text: 'Tap each flock of flamingos to mark it, then downlink your survey to the University of Nairobi. Flocks are speckled pink clusters in the shallows. Smooth pink streaks are algae, and the steaming pools are hot springs.',
    uni: 'University of Nairobi',
    noun: ['flock', 'flocks'],
    earthAt: [205, 120],
    coords: '0.25°N 36.10°E',
  },
  aircraft: {
    title: 'AIRCRAFT RECOGNITION',
    signal: 'ARMS CONTROL VERIFICATION · DEFENCE SURVEY',
    text: "The Ministry of Defence wants a count of one type of aircraft at this base, shown on the target card. Tap each one that matches, then downlink your count..",
    uni: 'Ministry of Defence',
    noun: ['fighter jet', 'fighter jets'],
    earthAt: [80, 185],
    coords: '45.2°N 12.6°E',
  },
  oil: {
    title: 'OIL SPILL TRACKING',
    signal: 'MARINE POLLUTION · RADAR SURVEY',
    text: 'Switch to radar to see through the cloud. Oil smooths the sea, so slicks show up dark. Calm, windless patches are dark too, but slicks are long and narrow, often trailing from a ship or platform. Tap each slick to mark it, then downlink your survey to University College Dublin.',
    uni: 'University College Dublin',
    noun: ['slick', 'slicks'],
    earthAt: [140, 190],
    coords: '28.7°N 88.4°W',
  },
  darkships: {
    title: 'DARK SHIP TRACKING',
    signal: 'ILLEGAL FISHING · AIS CROSS-CHECK',
    text: 'Ships broadcast their position every few seconds, but some switch it off to fish illegally. Watch for the pings and mark every ship that stays silent, then downlink to Global Fishing Watch.',
    uni: 'Global Fishing Watch',
    noun: ['dark ship', 'dark ships'],
    earthAt: [130, 50],
    coords: '1.3°S 91.5°W',
  },
  supernova: {
    title: 'SUPERNOVA SEARCH',
    signal: 'TRANSIENT SURVEY · ARCHIVE VS TONIGHT',
    text: "Tonight's image of this patch of sky is flicking back and forth with an older one. Find the new star that wasn't there before, tap it, then downlink to the University of Surrey. Anything that moves between the two is an asteroid, and a sharp single-pixel speck is a cosmic ray hit.",
    uni: 'University of Surrey',
    coords: 'RA 12h 31m · DEC +14°',
  },
  exoplanet: {
    title: 'EXOPLANET TRANSIT SEARCH',
    signal: 'TRANSIT PHOTOMETRY · WATCHING ONE STAR',
    text: "When a planet passes in front of its star, the star dims slightly, once every orbit. Watch its brightness and tap each dip as it scrolls past. Three dips pin down the orbit. Flares, sudden upward spikes, aren't transits.",
    uni: 'University of Hawaiʻi',
  },
  galaxies: {
    title: 'GALAXY CLASSIFICATION',
    signal: 'DEEP FIELD · SORT BY SHAPE',
    text: 'Sort each galaxy by its shape. Spiral: arms winding round a bright centre. Irregular: clumpy, with no clear shape. Elliptical: a smooth oval glow. Disk: seen edge-on, a thin streak, often split by a dark dust lane. Tap a button or press 1–4. Classify all 12 and the results go to the Instituto de Astrofísica de Canarias.',
    uni: 'Instituto de Astrofísica de Canarias',
    coords: 'RA 12h 36m · DEC +62°',
  },
  interstellar: {
    title: 'INTERSTELLAR OBJECT TRACKING',
    signal: 'OBJECT 2026 A1 · VISITOR FROM ANOTHER STAR',
    text: 'An interstellar object is streaking through our solar system! Keep it inside the reticle until all its data is recorded.',
    uni: 'Instituto de Astrofísica de Canarias',
    coords: 'RA 16h 21m · DEC +12°',
  },
};
export const report = data => window.parent !== window && window.parent.postMessage(data, '*');

export function hudText(ctx, s, ax, ay, color = 'rgba(201,255,77,.85)') {
  const W = ctx.canvas.width,
    H = ctx.canvas.height;
  ctx.font = '18px "Courier New", monospace';
  ctx.textAlign = ax;
  ctx.textBaseline = ay;
  const x = ax === 'left' ? 16 : W - 16,
    y = ay === 'top' ? 14 : H - 14,
    w = ctx.measureText(s).width;
  // a dark backing so the readout stays legible on white ice
  ctx.fillStyle = 'rgba(2,4,6,.62)';
  ctx.fillRect(ax === 'left' ? x - 6 : x - w - 6, ay === 'top' ? y - 4 : y - 22, w + 12, 26);
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
  ctx.font = '18px "Courier New", monospace';
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
