// Every science window is laid out the same way: the request's title, then the view on the left with a side panel
// beside it, and a toolbar underneath. The panel always has the same four sections: BRIEF (what to do), LIVE (the
// numbers that change as you play), GUIDE (what counts and what doesn't) and ABOUT THIS REQUEST (why it was asked for).
// The toolbar keeps the main action on the right; on the left, a hint or a view switch, and the result once it's in.
export function ScienceLayout({ info, view, live = [], left, right, result }) {
  return (
    <div className="sci">
      <div>
        <div className="eyebrow">Hosted payload request</div>
        <h1>{info.title}</h1>
        <div className="signal" style={{ color: 'var(--blue)' }}>
          {info.signal}
        </div>
      </div>
      <div className="sci-body">
        <div className="sci-stage">{view}</div>
        <aside className="sci-panel">
          <section>
            <div className="sci-label">Brief</div>
            <p>{info.brief}</p>
          </section>
          <section>
            <div className="sci-label">Live</div>
            {live.map(([k, v]) => (
              <div className="sci-row" key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </section>
          <section>
            <div className="sci-label">Guide</div>
            {info.guide.map(([counts, colour, text]) => (
              <div className="sci-guide" key={text}>
                <span className="sci-swatch" style={{ background: colour }} />
                <span className={counts ? 'sci-yes' : 'sci-no'}>{counts ? '✓' : '✗'}</span>
                {text}
              </div>
            ))}
          </section>
          <section className="sci-about">
            <div className="sci-label">About this request</div>
            <p>
              {info.about}
              {info.cite && (
                <>
                  {' '}
                  <a href={info.cite[1]} target="_blank" rel="noopener noreferrer">
                    {info.cite[0]}
                  </a>
                  .
                </>
              )}
            </p>
            {info.facts.map(([k, v]) => (
              <div className="sci-row" key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </section>
        </aside>
      </div>
      <div className="sci-tool">
        <div className="sci-left">{result || left}</div>
        {right}
      </div>
    </div>
  );
}

// the result, in the toolbar: green for a full haul, amber for anything less
export function ScienceResult({ ok, children }) {
  return <span className={'sci-result ' + (ok ? 'ok' : 'partial')}>{children}</span>;
}

// a two-way switch between views (visible and thermal, visible and radar)
export function ViewSwitch({ off, on, value, onChange }) {
  return (
    <div className="sci-switch">
      <button className={value ? '' : 'on'} onClick={() => onChange(false)}>
        {off}
      </button>
      <button className={value ? 'on' : ''} onClick={() => onChange(true)}>
        {on}
      </button>
    </div>
  );
}
