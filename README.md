# 600

A small satellite-constellation web game. A canvas view shows a constellation of 600 satellites in orbit; anomalies spawn on random satellites, and fixing one means opening it, running the right procedure in its terminal, and playing a short minigame themed around the subsystem at fault. Celestial events (solar flares, debris fields, gamma-ray bursts, and something else) hit groups of satellites at once.

Static site, no backend. Built with [Vite](https://vite.dev): `index.html` is the constellation, and each repair opens `react.html` (the React "repair lab") in an iframe.

## Running locally

Needs Node.js 20.19+ or 22.12+.

```bash
npm install        # once
npm run dev        # local server with live reload, prints the URL (usually http://localhost:5173)
```

Individual minigames can be opened directly, e.g. `http://localhost:5173/react.html?type=thermal`.

```bash
npm run build      # production build into dist/
npm run preview    # serve dist/ locally to check the build
npm run check      # build, then verify every image the code references exists
```

### Testing from the browser console

On the main page, open Inspect → Console and call `triggerFlare()`, `triggerDebris()`, `triggerGRB()` or `triggerKraken()` to start an event, or `trySpawnAnomaly()` for an everyday fault. `activeEvent` shows the current event; `activeEvent.left = 5` fast-forwards its countdown.

## Deploying

Cloudflare Pages builds and deploys on every push: build command `npm run build`, output directory `dist`. Every branch gets its own preview URL.

## Structure

```
index.html, react.html     thin page shells; Vite injects the bundles
public/                    images, copied to the site as-is (paths in code are relative to the site root)
src/main/                  the constellation page
  main.js                  entry point: wires modules to the page, clocks, messages from minigame windows
  constellation.js         satellites, orbits, drawing the rings
  panel.js                 side panel: telemetry and history chart
  terminal.js              ssh sessions, procedures/, emergency/ scripts
  launcher.js              minigame windows: load hidden, reveal, start
  alerts.js                SCID-UI alerts and crosshairs
  anomalies.js             spawning everyday faults
  state.js                 the few values several modules share
  events/                  core.js (tickets, emergency scripts, results) + flare, debris, grb, creature
  styles.css
src/repair/                the repair lab (React)
  main.jsx, App.jsx        entry point and game picker
  shared/                  frame, header, result, helpers, game catalog
  games/                   thermal, power, solar, contact, wheel, cpu, orbit, startracker
  events/                  bitflip (GRB), debris, flare
scripts/check_assets.py    CI check that referenced images exist
LESSONS_LEARNT.md          problems found while testing, and how they were fixed
```

## Minigames

Everyday repairs (a satellite can spawn any of these):

| Type | Game |
|---|---|
| thermal | Thermal Routing — trace a safe coolant path through a valve graph |
| power | Power Bus — route power to loads using Ohm's law |
| solar | Solar Alignment — drag the array to track the sun |
| contact | Missed Contact — search an az/el sky plot for the real satellite and lock on |
| wheel | Reaction Wheel Fault — balance a torque vector across 3 surviving wheels |
| process | CPU Overload — purge the runaway processes, but not the scheduled ones |
| orbit | Orbital Burn — drag-plot a transfer burn, then time a circularization burn |
| startracker | Star Tracker Lock — rebuild a star pattern from a catalog reference |

Celestial events: Solar Flare (flare), Debris Field (debris), Gamma-Ray Burst (bitflip), and the creature, which is played on the main screen.
