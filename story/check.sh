#!/bin/zsh
# Render stills of the Story composition at the given times (seconds) and tile them 3-up.
# usage: ./check.sh <name> t1 t2 ...   -> ../out/story/check/<name>.jpg
set -e
cd "${0:A:h}"
name=$1; shift
npx remotion bundle src/index.ts --out-dir build --log=error >/dev/null
mkdir -p ../out/story/check/$name
for s in "$@"; do
  f=$(python3 -c "print(round($s*60))")
  npx remotion still build Story ../out/story/check/$name/t$s.png --frame=$f --gl=angle --log=error >/dev/null
done
../art/.venv/bin/python -I - ../out/story/check/$name "$@" <<'PY'
import sys
from PIL import Image, ImageDraw
d, ts = sys.argv[1], sys.argv[2:]
ims = [Image.open(f'{d}/t{t}.png').convert('RGB').resize((640, 360)) for t in ts]
c = Image.new('RGB', (1920, 360 * ((len(ims) + 2) // 3)), 'white')
dr = ImageDraw.Draw(c)
for i, (im, t) in enumerate(zip(ims, ts)):
    x, y = (i % 3) * 640, (i // 3) * 360
    c.paste(im, (x, y))
    dr.rectangle([x, y, x + 70, y + 20], fill='black')
    dr.text((x + 5, y + 4), t, fill='white')
c.save(f'{d}.jpg', quality=85)
print(f'{d}.jpg')
PY
