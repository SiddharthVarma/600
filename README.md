# 600

A small satellite-constellation web game. A canvas view shows a constellation of satellites in orbit; anomalies spawn on random satellites, and fixing one opens a "repair lab" — a short minigame themed around the actual subsystem at fault (thermal routing, power bus, orbital mechanics, reaction wheels, and so on).

No build step, no backend. `index.html` is the main view; each repair opens `react.html` in an iframe, which loads React 18 + Babel-standalone from a CDN and runs `react-app.jsx` directly in the browser.

## Running locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`.

Individual minigames can be opened directly for testing, e.g. `http://localhost:8000/react.html?type=thermal`.

## Structure

```
index.html          main constellation view, anomaly spawning, repair modal
react.html           shell that loads the minigame app into the repair modal iframe
react-app.jsx        all minigame components
react-styles.css     shared styling for the minigame app
600_solar_assets/     pixel art for Solar Alignment (scid + sun sprites)
600_wheel_assets/     pixel art for Reaction Wheel Fault
600_gn_antenna_pixel_frames/   12-frame rotation turntable for the ground antenna (Missed Contact)
```

## Minigames

Live in the main game (a satellite can spawn any of these):

| Type | Game |
|---|---|
| thermal | Thermal Routing — trace a safe coolant path through a valve graph |
| power | Power Bus — route power to loads using Ohm's law |
| solar | Solar Alignment — track the sun with a slider while it drifts |
| contact | Missed Contact — hill-climb a signal to lock the downlink |
| wheel | Reaction Wheel Fault — balance a torque vector across 3 surviving wheels |
| process | Process Fault — find and stop a runaway process before it breaches |
| orbit | Orbital Burn — drag-plot a transfer burn, then time a circularization burn |
| startracker | Star Tracker Lock — rebuild a star pattern from a catalog reference |

