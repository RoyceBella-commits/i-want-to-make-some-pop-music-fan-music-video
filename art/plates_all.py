"""Make Riso plates for every shot whose newest raw image has no (or an older) plate yet.

usage: art/.venv/bin/python -I art/plates_all.py [--force id ...]
"""
import json
import subprocess
import sys
from pathlib import Path

ART = Path(__file__).resolve().parent
# Region masks (pixel rect in the raw image : colours : tolerance) for shots that need one.
MASKS = {
    's02_teen': '20,0,480,445:#C3ECFE|#F7F6E8:22',
}


def latest(sid: str) -> Path | None:
    files = sorted((ART / 'raw' / sid).glob(f'{sid}_v*.png'), key=lambda p: int(p.stem.split('_v')[-1]))
    return files[-1] if files else None


def main() -> None:
    force = set(sys.argv[2:]) if len(sys.argv) > 1 and sys.argv[1] == '--force' else set()
    extra = json.loads((ART / 'masks.json').read_text()) if (ART / 'masks.json').exists() else {}
    masks = {**MASKS, **extra}
    for d in sorted((ART / 'raw').iterdir()):
        sid = d.name
        if not sid.startswith('s'):
            continue
        src = latest(sid)
        if not src:
            continue
        meta = ART / 'plates' / sid / 'plate.json'
        if meta.exists() and sid not in force and json.loads(meta.read_text()).get('source', '').endswith(src.name):
            continue
        cmd = [str(ART / '.venv/bin/python'), '-I', str(ART / 'plate.py'), str(src), sid]
        if sid in masks:
            cmd += ['--mask', masks[sid]]
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=ART.parent)
        print(sid, 'ok' if r.returncode == 0 else 'FAILED\n' + r.stderr[-800:], flush=True)


if __name__ == '__main__':
    main()
