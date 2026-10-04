import { useState, useEffect, useRef } from 'react';
import { Header } from '../shared/ui.jsx';
import { usePhone } from '../shared/util.js';

function genHammingWord() {
  // builds a genuine valid Hamming(7,4) codeword: 4 free data bits at
  // positions 3,5,6,7, with 3 check bits at positions 1,2,4 chosen so every
  // overlapping parity check comes out even (i.e. a "clean" register).
  const d = [Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0];
  const b = Array(8).fill(0);
  b[3] = d[0];
  b[5] = d[1];
  b[6] = d[2];
  b[7] = d[3];
  b[1] = b[3] ^ b[5] ^ b[7];
  b[2] = b[3] ^ b[6] ^ b[7];
  b[4] = b[5] ^ b[6] ^ b[7];
  return b.slice(1); // index 0..6 = bit position 1..7
}

function hammingSyndrome(bits) {
  const c1 = bits[0] ^ bits[2] ^ bits[4] ^ bits[6];
  const c2 = bits[1] ^ bits[2] ^ bits[5] ^ bits[6];
  const c3 = bits[3] ^ bits[4] ^ bits[5] ^ bits[6];
  return { c1, c2, c3, pos: c1 * 1 + c2 * 2 + c3 * 4 }; // pos 0 = no error, else the exact corrupted bit (1-7)
}

function HammingRow({ label, bits, syn, onToggle, disabled, reference, restored }) {
  const ok = restored != null ? restored : syn.pos === 0;
  // on phones a row fits on one line: tighter spacing, and the red edge and ✕ marks stand in for ERROR DETECTED
  const phone = usePhone();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: phone ? 8 : 14,
        padding: '5px 0',
        borderLeft: '2px solid ' + (ok ? 'transparent' : 'var(--red)'),
        paddingLeft: 10,
        borderBottom: '1px solid #1c2422',
        flexWrap: phone ? 'nowrap' : 'wrap',
      }}
    >
      <div style={{ width: phone ? 50 : 78, flexShrink: 0, fontSize: 11, color: reference ? '#7b8580' : '#9aa39c' }}>{label}</div>
      <div style={{ display: 'flex', gap: phone ? 3 : 4 }}>
        {bits.map((b, i) => (
          <button
            key={i}
            onClick={() => onToggle(i)}
            disabled={disabled}
            style={{
              width: phone ? 26 : 24,
              height: phone ? 26 : 24,
              padding: phone ? 0 : undefined,
              border: '1px solid #39453f',
              background: b ? '#1c2b16' : '#0d1211',
              color: b ? 'var(--green)' : '#5c6b64',
              fontSize: 12,
              cursor: disabled ? 'default' : 'pointer',
            }}
          >
            {b}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: phone ? 5 : 8, fontSize: 10 }}>
        <span style={{ color: syn.c1 ? 'var(--red)' : 'var(--green)' }}>C1:{syn.c1 ? '✕' : '✓'}</span>
        <span style={{ color: syn.c2 ? 'var(--red)' : 'var(--green)' }}>C2:{syn.c2 ? '✕' : '✓'}</span>
        <span style={{ color: syn.c3 ? 'var(--red)' : 'var(--green)' }}>C3:{syn.c3 ? '✕' : '✓'}</span>
      </div>
      {!phone && (
        <div style={{ fontSize: 10, color: ok ? 'var(--green)' : 'var(--red)', minWidth: 100 }}>{ok ? 'NO ERROR' : 'ERROR DETECTED'}</div>
      )}
    </div>
  );
}

export function BitFlip() {
  const TIME = 100;
  const [setup] = useState(() => {
    const idsParam = new URLSearchParams(location.search).get('sats');
    const ids = idsParam
      ? idsParam.split(',').filter(Boolean)
      : Array.from({ length: 5 }, () => String(100 + Math.floor(Math.random() * 900)));
    const ref = genHammingWord();
    const sats = ids.map(rawId => {
      const id = 'SAT ' + String(rawId).padStart(3, '0');
      const original = genHammingWord();
      const corruptPos = 1 + Math.floor(Math.random() * 7);
      const bits = [...original];
      bits[corruptPos - 1] ^= 1;
      return { id: id, satId: rawId, original, bits, corruptPos };
    });
    return { ref, sats };
  });
  // fixPos[i] = the single bit position (1-7) currently flipped back for satellite i, or null if untouched.
  // Only ever one bit differs from the true corrupted state, so a clean syndrome and a correct fix are
  // mathematically the same thing -- there's no way to land on a different, coincidentally-valid word.
  const [fixPos, setFixPos] = useState(() => setup.sats.map(() => null));
  const [phase, setPhase] = useState('run'); // run | done
  const [remaining, setRemaining] = useState(TIME);
  const WRONG_PENALTY = 5;
  const triedRef = useRef(setup.sats.map(() => new Set()));

  useEffect(() => {
    if (phase !== 'run') return;
    if (remaining <= 0) {
      setPhase('done');
      return;
    }
    const id = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, phase]);

  const bitsState = setup.sats.map((s, si) => {
    const b = [...s.bits];
    if (fixPos[si] != null) b[fixPos[si] - 1] ^= 1;
    return b;
  });

  const toggle = (si, bi) => {
    if (phase !== 'run') return;
    const pos = bi + 1;
    setFixPos(fp => fp.map((p, i) => (i === si ? (p === pos ? null : pos) : p)));
    const s = setup.sats[si];
    if (pos !== s.corruptPos && !triedRef.current[si].has(pos)) {
      triedRef.current[si].add(pos);
      setRemaining(r => Math.max(0, r - WRONG_PENALTY));
    }
  };

  const results = bitsState.map(bits => hammingSyndrome(bits));
  const restored = setup.sats.map((s, i) => fixPos[i] === s.corruptPos);
  const fixedCount = restored.filter(Boolean).length;

  useEffect(() => {
    if (fixedCount === 5 && phase === 'run') setPhase('done');
  }, [fixedCount, phase]);

  useEffect(() => {
    if (phase !== 'done') return;
    if (window.parent !== window) {
      const id = setTimeout(() => {
        const results = setup.sats.map((s, i) => ({ satId: s.satId, fixed: restored[i] }));
        window.parent.postMessage({ type: 'grb-resolved', results }, '*');
      }, 1400);
      return () => clearTimeout(id);
    }
  }, [phase]);

  const refSyn = hammingSyndrome(setup.ref);

  return (
    <>
      <Header title="GAMMA RAY BURST" sub={`HAMMING CODE ERROR CORRECTION · ${remaining}s REMAINING`} />
      <p className="instructions">
        A gamma-ray burst has flipped one bit in each affected satellite's memory register. Each register runs a Hamming code — three
        checksum bits (C1/C2/C3) covering overlapping bit positions. Work out the bad bit from which checks fail, then click to flip it
        back. Wrong guesses cost {WRONG_PENALTY}s.
      </p>
      <div style={{ fontSize: 12, color: '#7b8580', lineHeight: 1.5, margin: '8px 0', border: '1px solid #1c2422', padding: '8px 10px' }}>
        C1 covers bits 1,3,5,7 &nbsp;·&nbsp; C2 covers bits 2,3,6,7 &nbsp;·&nbsp; C3 covers bits 4,5,6,7 — a check fails if an odd number of
        its bits are wrong.
        <br />
        Only C1 fails → bit 1 &nbsp;·&nbsp; only C2 → bit 2 &nbsp;·&nbsp; C1+C2 → bit 3 &nbsp;·&nbsp; only C3 → bit 4 &nbsp;·&nbsp; C1+C3 →
        bit 5 &nbsp;·&nbsp; C2+C3 → bit 6 &nbsp;·&nbsp; all three → bit 7
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#7b8580', marginBottom: 4 }}>EXAMPLE · CLEAN READING</div>
        <HammingRow label="REF 000" bits={setup.ref} syn={refSyn} onToggle={() => {}} disabled reference />
      </div>
      <div style={{ marginTop: 8, display: 'grid', gap: 0 }}>
        <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#7b8580', marginBottom: 6 }}>AFFECTED SATELLITES</div>
        {setup.sats.map((s, si) => (
          <HammingRow
            key={s.id}
            label={s.id}
            bits={bitsState[si]}
            syn={results[si]}
            restored={restored[si]}
            onToggle={bi => toggle(si, bi)}
            disabled={phase !== 'run'}
          />
        ))}
      </div>
      {phase === 'done' && (
        <div className={fixedCount === 5 ? 'success' : 'failure'}>
          {fixedCount === 5
            ? 'ALL REGISTERS RESTORED · HAMMING CODE VALIDATED'
            : `${fixedCount}/5 SATELLITES RECOVERED · ${5 - fixedCount} LOST TO UNCORRECTED BIT ERRORS`}
        </div>
      )}
    </>
  );
}
