#!/usr/bin/env python3
"""Verify every image asset referenced in index.html / react-app.jsx actually
exists on disk. Run from the repo root (or anywhere -- paths are resolved
relative to this script's parent directory).

Handles two patterns found in this codebase:
  - full/relative literal paths, e.g. '600_earth_assets/earth.png'
  - folder-prefix + bare-filename concatenation, e.g. ASSETS + 'scid.png'
    where `const ASSETS = '600_solar_assets/';` is declared somewhere in
    the same file.

This is a heuristic static check (regex over the source text), not a real
JS/JSX parser -- if a new dynamic path-construction pattern is introduced
that isn't a simple `prefix + 'file.ext'` concatenation, extend the logic
below rather than assuming this script covers it.
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ['index.html', 'react-app.jsx']
IMG_EXT = r'(?:png|webp|jpe?g|gif|svg)'

img_literal_re = re.compile(r"""['"`]([\w./-]+\.""" + IMG_EXT + r""")['"`]""")
prefix_decl_re = re.compile(r"""(?:const|let)\s+\w+\s*=\s*['"`]([\w./-]+/)['"`]""")

missing = []
checked = set()

for fname in FILES:
    text = (ROOT / fname).read_text(encoding='utf-8')
    prefixes = prefix_decl_re.findall(text)

    for m in img_literal_re.finditer(text):
        path = m.group(1)
        if path in checked:
            continue

        if '/' in path:
            # full/relative literal path -- check directly
            checked.add(path)
            if not (ROOT / path).exists():
                missing.append((fname, path))
        else:
            # bare filename -- try repo root and every declared folder prefix
            candidates = [path] + [p + path for p in prefixes]
            if any((ROOT / c).exists() for c in candidates):
                checked.update(candidates)
            else:
                key = (fname, path)
                if key not in missing:
                    missing.append(key)

if missing:
    print('Broken asset references found:')
    for f, p in missing:
        print(f'  {f}: {p}')
    sys.exit(1)

print(f'All asset references OK ({len(checked)} unique paths checked)')
