import { useState, useEffect } from 'react';
import { BitFlip } from './events/bitflip.jsx';
import { Debris } from './events/debris.jsx';
import { Flare } from './events/flare.jsx';
import { Contact } from './games/contact.jsx';
import { Process } from './games/cpu.jsx';
import { Orbit } from './games/orbit.jsx';
import { Power } from './games/power.jsx';
import { Solar } from './games/solar.jsx';
import { StarTracker } from './games/startracker.jsx';
import { Thermal } from './games/thermal.jsx';
import { ReactionWheel } from './games/wheel.jsx';
import { Blink } from './science/blink.jsx';
import { Survey } from './science/survey.jsx';
import { Transit } from './science/transit.jsx';
import { Tracking } from './science/tracking.jsx';
import { games } from './shared/catalog.js';
import { Frame } from './shared/ui.jsx';

export function App() {
  const params = new URLSearchParams(location.search);
  const requested = params.get('type');
  const [type, setType] = useState(games.some(g => g[0] === requested) ? requested : 'thermal');
  const [remaining, setRemaining] = useState(() => {
    const n = parseInt(params.get('deadline'), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const [timedOut, setTimedOut] = useState(false);
  // ?preload: the main screen loads this page hidden while its terminal log runs. Hold the game until it says start,
  // and take the satellite's countdown as it is at that moment.
  const [ready, setReady] = useState(() => !params.has('preload'));
  useEffect(() => {
    if (ready) return;
    const onStart = e => {
      if (e.data?.type !== 'repair-start') return;
      const n = parseInt(e.data.deadline, 10);
      if (Number.isFinite(n) && n > 0) setRemaining(n);
      setReady(true);
    };
    window.addEventListener('message', onStart);
    if (window.parent !== window) window.parent.postMessage({ type: 'repair-loaded' }, '*');
    return () => window.removeEventListener('message', onStart);
  }, [ready]);
  useEffect(() => {
    if (remaining == null || timedOut || !ready) return;
    const id = setTimeout(() => {
      if (remaining <= 1) {
        setTimedOut(true);
        setRemaining(0);
      } else setRemaining(remaining - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [remaining, timedOut, ready]);
  useEffect(() => {
    if (!timedOut) return;
    if (window.parent !== window) {
      const id = setTimeout(() => window.parent.postMessage({ type: 'repair-failed' }, '*'), 2200);
      return () => clearTimeout(id);
    }
  }, [timedOut]);
  const C = {
    thermal: Thermal,
    power: Power,
    solar: Solar,
    contact: Contact,
    wheel: ReactionWheel,
    process: Process,
    orbit: Orbit,
    startracker: StarTracker,
    bitflip: BitFlip,
    debris: Debris,
    flare: Flare,
    penguins: () => <Survey kind="penguins" />,
    whales: () => <Survey kind="whales" />,
    wildfire: () => <Survey kind="wildfire" />,
    interstellar: Tracking,
    flamingos: () => <Survey kind="flamingos" />,
    aircraft: () => <Survey kind="aircraft" />,
    oil: () => <Survey kind="oil" />,
    darkships: () => <Survey kind="darkships" />,
    supernova: Blink,
    exoplanet: Transit,
  }[type];
  return (
    <Frame type={type} setType={setType} remaining={remaining} timedOut={timedOut}>
      {!ready ? null : timedOut ? (
        <div className="failure" style={{ margin: '60px 0', fontSize: 14, letterSpacing: '.03em' }}>
          SATELLITE COMMANDED TOO LATE · SATELLITE LOST
        </div>
      ) : (
        <C />
      )}
    </Frame>
  );
}
