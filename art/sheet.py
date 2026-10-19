"""Contact sheet of the latest raw image for each given shot id (2 columns, labelled).

usage: art/.venv/bin/python -I art/sheet.py <out.jpg> <id> [<id> ...]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ART = Path(__file__).resolve().parent


def latest(sid: str) -> Path | None:
    files = sorted((ART / 'raw' / sid).glob(f'{sid}_v*.png'), key=lambda p: int(p.stem.split('_v')[-1]))
    return files[-1] if files else None


def main() -> None:
    out, ids = sys.argv[1], sys.argv[2:]
    w, h = 836, 470
    cols = 2
    rows = (len(ids) + cols - 1) // cols
    sheet = Image.new('RGB', (w * cols, h * rows), 'white')
    d = ImageDraw.Draw(sheet)
    for i, sid in enumerate(ids):
        p = latest(sid)
        x, y = (i % cols) * w, (i // cols) * h
        if p:
            sheet.paste(Image.open(p).convert('RGB').resize((w, h)), (x, y))
        d.rectangle([x, y, x + 150, y + 28], fill='black')
        d.text((x + 6, y + 6), sid, fill='white')
    sheet.save(out, quality=85)


if __name__ == '__main__':
    main()
