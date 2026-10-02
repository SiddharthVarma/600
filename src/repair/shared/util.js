import { useEffect, useState } from 'react';

export const shuffle = a => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

export const allSubsets = n => {
  const res = [];
  for (let m = 1; m < 1 << n; m++) {
    const s = [];
    for (let b = 0; b < n; b++) if (m & (1 << b)) s.push(b);
    res.push(s);
  }
  return res;
};

// True on narrow touch screens (phones). Minigames use it to switch to a compact layout; laptops (mouse or trackpad) never
// match, whatever the window size or zoom, so nothing changes for them.
const PHONE = '(max-width: 600px) and (pointer: coarse)';
export function usePhone() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const m = window.matchMedia(PHONE),
      onChange = () => setPhone(m.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);
  return phone;
}
