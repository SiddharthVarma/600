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
