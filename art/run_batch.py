"""Generate a list of keyframes one after another through gen_codex.py.

usage: python3 -I run_batch.py <id> [<id> ...]
- skips ids that already have an image (art/raw/<id>/<id>_v*.png)
- waits for an id's reference images to exist before generating it (so two workers can share deps)
- a failed shot is retried once with reasoning effort high (as the guide says)
- stops the whole batch if Codex reports a usage/quota limit
"""
import json
import subprocess
import sys
import time
from pathlib import Path

ART = Path(__file__).resolve().parent


def has_image(sid: str) -> bool:
    return any((ART / 'raw' / sid).glob(f'{sid}_v*.png'))


def run(sid: str, effort: str) -> dict:
    out = subprocess.run([sys.executable, '-I', str(ART / 'gen_codex.py'), str(ART / 'prompts' / f'{sid}.json'), '--effort', effort],
                         capture_output=True, text=True)
    line = next((l for l in out.stdout.splitlines() if l.startswith('{')), '{}')
    return json.loads(line)


def main() -> None:
    for sid in sys.argv[1:]:
        if has_image(sid):
            print(f'skip {sid}', flush=True)
            continue
        refs = json.loads((ART / 'prompts' / f'{sid}.json').read_text()).get('input_images', [])
        for r in refs:
            while not (ART / r['path']).exists():
                time.sleep(10)
        res = run(sid, 'low')
        if not res.get('ok') and not res.get('quota_suspect'):
            print(f'retry {sid} with high', flush=True)
            res = run(sid, 'high')
        print(json.dumps({k: res.get(k) for k in ('id', 'ok', 'size', 'seconds', 'effort', 'quota_suspect')}), flush=True)
        if res.get('quota_suspect'):
            print('STOP: quota limit reported by Codex', flush=True)
            return


if __name__ == '__main__':
    main()
