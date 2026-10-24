import { useState } from 'react';

// Every lab window (science requests and repairs) is laid out the same way: the title, then the view on the left with a
// side panel beside it, and a toolbar underneath. The panel's sections are BRIEF (what to do), LIVE (the numbers that
// change as you play), GUIDE (what counts and what doesn't) and ABOUT (why it matters); a section with nothing to say is
// left out, and they stack from the top. The toolbar keeps the main action on the right; on the left, a hint, a
// secondary control or the status, and the result once it's in.
// view: the game. A canvas fills the view's width; anything else (an SVG, a terminal) sits centred in a fixed box.
export function LabLayout({
  eyebrow,
  title,
  signal,
  signalColor = 'var(--red)',
  view,
  boxed = false,
  brief,
  live = [],
  guide = [],
  about,
  aboutLabel,
  cite,
  facts = [],
  left,
  right,
  result,
}) {
  return (
    <div className="lab">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <div className="signal" style={{ color: signalColor }}>
          {signal}
        </div>
      </div>
      <div className="lab-body">
        <div className={'lab-stage' + (boxed ? ' boxed' : '')}>{view}</div>
        <aside className="lab-panel">
          {brief && (
            <section>
              <div className="lab-label">Brief</div>
              <p>{brief}</p>
            </section>
          )}
          {live.length > 0 && (
            <section>
              <div className="lab-label">Live</div>
              {live.map(([k, v, color]) => (
                <div className="lab-row" key={k}>
                  <span>{k}</span>
                  <b style={color ? { color } : undefined}>{v}</b>
                </div>
              ))}
            </section>
          )}
          {guide.length > 0 && (
            <section>
              <div className="lab-label">Guide</div>
              {guide.map(([counts, colour, text]) => (
                <div className="lab-guide" key={text}>
                  <span className="lab-swatch" style={{ background: colour }} />
                  <span className={counts ? 'lab-yes' : 'lab-no'}>{counts ? '✓' : '✗'}</span>
                  {text}
                </div>
              ))}
            </section>
          )}
          {about && (
            <section className="lab-about">
              <div className="lab-label">{aboutLabel}</div>
              <p>
                {about}
                {cite && (
                  <>
                    {' '}
                    <a href={cite[1]} target="_blank" rel="noopener noreferrer">
                      {cite[0]}
                    </a>
                    .
                  </>
                )}
              </p>
              {facts.map(([k, v]) => (
                <div className="lab-row" key={k}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
      <div className="lab-tool">
        <div className="lab-left">{result || left}</div>
        {right}
      </div>
    </div>
  );
}

// a message in the toolbar: ok (green), partial (amber), bad (red) or plain (muted), for hints and running status
export function Status({ tone = 'plain', children }) {
  return <span className={'lab-status ' + tone}>{children}</span>;
}

// a repair's EXECUTE: dimmed until the repair is done; pressed, it hands the satellite back to the main screen
export function Execute({ ready }) {
  const [sent, setSent] = useState(false);
  const run = () => {
    if (!ready || sent) return;
    setSent(true);
    if (window.parent !== window) setTimeout(() => window.parent.postMessage({ type: 'repair-complete' }, '*'), 1200);
  };
  return (
    <button className="action" disabled={!ready || sent} style={!ready ? { opacity: 0.4 } : undefined} onClick={run}>
      {sent ? 'EXECUTED' : 'EXECUTE'}
    </button>
  );
}

// a two-way switch between views (visible and thermal, visible and radar)
export function ViewSwitch({ off, on, value, onChange }) {
  return (
    <div className="lab-switch">
      <button className={value ? '' : 'on'} onClick={() => onChange(false)}>
        {off}
      </button>
      <button className={value ? 'on' : ''} onClick={() => onChange(true)}>
        {on}
      </button>
    </div>
  );
}
