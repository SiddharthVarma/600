# 600

A small satellite-constellation web game. A canvas view shows a constellation of 600 satellites in orbit; anomalies spawn on random satellites, and fixing one means opening it, running the right procedure in its terminal, and playing a short minigame themed around the subsystem at fault. Celestial events (solar flares, debris fields, gamma-ray bursts, and something else) hit groups of satellites at once.

Static site, no backend. Built with [Vite](https://vite.dev): `index.html` is the constellation, and each repair opens `react.html` (the React "repair lab") in an iframe.

## Running locally

Needs Node.js 20.19+ or 22.12+.

```bash
npm install        # once
npm run dev        # local server with live reload, prints the URL (usually http://localhost:5173/sixhundred/)
```

Individual minigames can be opened directly, e.g. `http://localhost:5173/sixhundred/react.html?type=thermal`.

```bash
npm run build      # production build into dist/sixhundred/
npm run preview    # serve the build locally to check it
npm run check      # build, then verify every image the code references exists
```

### Testing from the browser console

On the main page, open Inspect → Console and call `triggerFlare()`, `triggerDebris()`, `triggerGRB()` or `triggerKraken()` to start an event, or `trySpawnAnomaly()` for an everyday fault. `activeEvent` shows the current event; `activeEvent.left = 5` fast-forwards its countdown.

## Regression test

`scripts/regress.py` plays the game in a headless browser and records what happens, about 66 checks:

- SUDO's walkthrough;
- a fault fixed through its ticket and terminal, and a wrong procedure refused;
- every celestial event (ticket, emergency script, abort, reopen, result) and the creature;
- a science request paid out, and a replacement launch;
- a total loss and relaunch;
- every minigame rendering, and any JavaScript error anywhere.

It builds and plays both your last commit and your working copy, then prints the differences. The last commit is the expected result, so there's nothing to keep up to date by hand. Run it before merging anything that touches shared code (events, alerts, the terminal, the window launcher).

```
pip install playwright
python3 scripts/regress.py                # last commit vs your working copy (about 3 minutes)
python3 scripts/regress.py --base main    # compare against another commit or branch
python3 scripts/regress.py --only         # just your working copy, printing every check
```

## Deploying

Cloudflare Pages builds and deploys on every push: build command `npm run build`, output directory `dist`. Every branch gets its own preview URL.

The game lives at [varmasiddharth.com/sixhundred](https://varmasiddharth.com/sixhundred/). It builds into `dist/sixhundred/`, so on Pages it sits at `sixhundred.pages.dev/sixhundred/`. The Worker in `deploy/worker.js` runs on the route `varmasiddharth.com/sixhundred*` and fetches the same path from Pages, so the domain's other paths stay free for the rest of the site. The root of `sixhundred.pages.dev` redirects to the domain (`dist/_redirects`, written by `npm run build`).

## Structure

```
index.html, react.html     thin page shells; Vite injects the bundles
public/                    images, copied to the site as-is (paths in code are relative to the page, so they work under any prefix)
src/main/                  the constellation page
  main.js                  entry point: wires modules to the page, clocks, messages from minigame windows
  constellation.js         satellites, orbits, drawing the rings
  earth.js                 the spinning pixel-art Earth
  panel.js                 the uplink window: a satellite's STATUS and its terminal, docked bottom right
  terminal.js              ssh sessions, procedures/, emergency/ scripts
  launcher.js              minigame windows: load hidden, reveal, start
  alerts.js                SCID-UI alerts and crosshairs
  science.js               science requests: the bottom-left card and their window
  dive.js                  the camera dive into the Earth (or out to space) before a science or launch window
  credits.js               credits from science, the LAUNCH button, replacing lost satellites
  anomalies.js             spawning everyday faults
  pacing.js                how a visit ramps up: the opening, the first event, the calm, the warm-up
  intro.js                 SUDO: the walkthrough, and its lines on launches and celestial events
  state.js                 the few values several modules share
  events/                  core.js (tickets, emergency scripts, results) + flare, debris, grb, creature
  styles.css
src/repair/                the repair lab (React)
  main.jsx, App.jsx        entry point and game picker
  shared/                  frame, header, result, helpers, game catalog
  games/                   thermal, power, solar, contact, wheel, cpu, orbit, startracker
  events/                  bitflip (GRB), debris, flare
  science/                 science requests: pixel-art scenes, Earth-observation surveys, supernova, exoplanet,
                           galaxies, interstellar tracking
  launch/                  the replacement launch: pad, max-Q, staging, fairing, deploy
public/fonts/              Departure Mono and IBM Plex Mono, with their licences
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

Science requests (universities' hosted-payload proposals; optional, nothing is lost by skipping one): penguin colonies (penguins), whales (whales) and wildfires (wildfire) are Earth-observation surveys where you mark what you find; interstellar tracks a visiting object until all its data is recorded. `pushScience()` in the console adds one.
