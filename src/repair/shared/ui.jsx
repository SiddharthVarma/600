import { useState } from 'react';
import { games } from './catalog.js';

export function Frame({ type, setType, children, remaining, timedOut }) {
  const params = new URLSearchParams(location.search);
  const embedded = Boolean(params.get('type'));
  const multi = Boolean(params.get('sats'));
  const satId = params.get('sat');
  const satLabel = multi
    ? 'MULTIPLE SATELLITES · EMERGENCY OVERRIDE'
    : satId
      ? `SAT ${String(satId).padStart(3, '0')} · MANUAL OVERRIDE`
      : 'SAT 421 · MANUAL OVERRIDE';
  return (
    <div className="app">
      <header className="top">
        <span className="brand">SIX HUNDRED / REPAIR LAB</span>
        <span className="eyebrow">
          {satLabel}
          {remaining != null && !timedOut && (
            <span style={{ color: remaining <= 10 ? 'var(--red)' : undefined, marginLeft: 10 }}>· REPAIR WINDOW {remaining}s</span>
          )}
        </span>
      </header>
      <div className={'layout ' + (embedded ? 'embedded' : '')} style={embedded ? { display: 'block', marginTop: 0 } : {}}>
        {!embedded && (
          <nav className="menu">
            {games.map(([id, name]) => (
              <button key={id} className={type === id ? 'active' : ''} onClick={() => setType(id)}>
                {name}
              </button>
            ))}
          </nav>
        )}
        <main className="board" style={embedded ? { minHeight: '100%', border: 0 } : {}}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function Header({ title, sub }) {
  return (
    <>
      <div className="eyebrow">Critical subsystem interaction</div>
      <h1>{title}</h1>
      <div className="signal">{sub}</div>
    </>
  );
}

export function Result({ ok, children }) {
  const [sent, setSent] = useState(false);
  const finish = () => {
    if (!sent && window.parent !== window) {
      setSent(true);
      setTimeout(() => window.parent.postMessage({ type: 'repair-complete' }, '*'), 1200);
    }
  };
  return (
    children && (
      <div className={ok ? 'success' : 'failure'}>
        {sent ? 'SUCCESSFUL EXECUTION' : children}
        {ok && !sent && (
          <div className="actions">
            <button className="action" onClick={finish}>
              EXECUTE
            </button>
          </div>
        )}
      </div>
    )
  );
}
