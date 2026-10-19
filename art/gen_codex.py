"""Generate one keyframe through Codex CLI's built-in image_gen.

Codex CLI (>= 0.162.1) with gpt-6.1-sol, reasoning low (high on retry); the full prompt is
written to a task file and passed verbatim; workspace-write sandbox rooted at the shot's
output dir. Requires a Codex login with image generation available.

usage: python3 -I gen_codex.py <prompt.json> [--effort high] [--note "fix: ..."]
Writes art/raw/<id>/<id>_vN.png plus task/events/result/log files.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

ART = Path(__file__).resolve().parent
FIELDS = [
    ('Use case', 'use_case'), ('Asset type', 'asset_type'), ('Primary request', 'primary_request'),
    ('Input images', 'input_images_text'), ('Scene/backdrop', 'scene'), ('Subject', 'subject'),
    ('Style/medium', 'style'), ('Composition/framing', 'composition'), ('Lighting/mood', 'lighting'),
    ('Color palette', 'palette'), ('Materials/textures', 'materials'), ('Constraints', 'constraints'),
    ('Avoid', 'avoid'),
]
QUOTA_WORDS = ('usage limit', 'quota', 'credits', 'limit reached', "you've hit your")


def build_prompt(shot: dict) -> str:
    style = json.loads((ART / 'style.json').read_text())
    merged = {**style, **{k: v for k, v in shot.items() if not k.startswith('extra_')}}
    # Shot-specific additions are appended to the shared lines instead of replacing them.
    for key in ('constraints', 'avoid', 'style'):
        if shot.get('extra_' + key):
            merged[key] = f"{style[key]}; {shot['extra_' + key]}"
    if shot.get('has_protagonist', True):
        merged['subject'] = f"{merged['subject'].rstrip('. ')}. {style['protagonist'][0].upper()}{style['protagonist'][1:]}"
    refs = shot.get('input_images', [])
    if refs:
        merged['input_images_text'] = '; '.join(f"Image {i + 1}: {r['role']}" for i, r in enumerate(refs))
    lines = [f'{label}: {merged[key]}' for label, key in FIELDS if merged.get(key)]
    return '\n'.join(lines)


def main() -> int:
    args = sys.argv[1:]
    prompt_path = Path(args[0]).resolve()
    effort = args[args.index('--effort') + 1] if '--effort' in args else 'low'
    note = args[args.index('--note') + 1] if '--note' in args else ''
    shot = json.loads(prompt_path.read_text())
    sid = shot['id']
    out = ART / 'raw' / sid
    out.mkdir(parents=True, exist_ok=True)
    n = 1 + sum(1 for _ in out.glob(f'{sid}_v*.png'))
    name = f'{sid}_v{n}'
    prompt = build_prompt(shot)
    size_req = shot.get('size_note', 'Landscape output, ideally 1536x1024 (3:2) or the widest landscape size available; report the actual size. Do not change any default resolution settings.')
    task = f"""请完成本次图片生成任务，并将真实图片保存为工作目录中的 {name}.png。
下面是已经写好的完整提示词。请把"提示词开始"和"提示词结束"之间的内容原样作为图像生成工具的 prompt，不要改写、翻译、扩写或删减：
提示词开始
{prompt}
提示词结束
尺寸：{size_req}
{('参考图：本任务附带了参考图，按提示词中 Input images 一行说明的用途使用。' if shot.get('input_images') else '')}
{('上一版的问题（本次需要修正）：' + note) if note else ''}
只调用一次图像生成工具。生成的图片会保存在 ~/.codex/generated_images/ 下，从那里复制到工作目录即可；不要为了保存而重新生成，也不要把图片的 base64 数据写进命令。
优先使用当前会话已经可用的图像生成能力。
如果缺少生图能力、额度用尽或调用失败，请明确报告实际原因，不把文字说明当作图片交付。
不要为本任务购买额度、切换到另行付费的 API，或递归调用另一个 Codex CLI。
最后报告实际生成文件、尺寸和使用的后端。
"""
    task_file = out / f'{name}.task.txt'
    task_file.write_text(task)
    cmd = ['codex', 'exec', '-m', 'gpt-6.1-sol', '-c', f'model_reasoning_effort="{effort}"',
           '--skip-git-repo-check', '--sandbox', 'workspace-write', '--cd', str(out)]
    for ref in shot.get('input_images', []):
        cmd += ['--image', str((ART / ref['path']).resolve())]
    cmd += ['--json', '--output-last-message', str(out / f'{name}.result.md'), '-']
    t0 = time.time()
    with task_file.open('rb') as stdin, (out / f'{name}.events.jsonl').open('wb') as ev, \
            (out / f'{name}.errors.log').open('wb') as err:
        code = subprocess.run(cmd, stdin=stdin, stdout=ev, stderr=err).returncode
    dt = time.time() - t0

    png = out / f'{name}.png'
    events = (out / f'{name}.events.jsonl').read_text(errors='replace')
    result = (out / f'{name}.result.md').read_text(errors='replace') if (out / f'{name}.result.md').exists() else ''
    status = 'turn.completed' if '"turn.completed"' in events else ('turn.failed' if '"turn.failed"' in events else 'unknown')
    ok = png.exists() and png.stat().st_mtime >= t0 - 1
    size = None
    if ok:
        sips = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(png)], capture_output=True, text=True).stdout
        vals = [int(l.split(':')[1]) for l in sips.splitlines() if 'pixel' in l]
        size = vals if len(vals) == 2 else None
        ok = size is not None
    quota = any(w in (events + result).lower() for w in QUOTA_WORDS) and not ok
    log = dict(id=sid, file=str(png) if ok else None, ok=ok, size=size, exit=code, status=status,
               seconds=round(dt, 1), backend='codex image_gen', model='gpt-6.1-sol', effort=effort,
               refs=[r['path'] for r in shot.get('input_images', [])], quota_suspect=quota, prompt=prompt)
    (out / f'{name}.log.json').write_text(json.dumps(log, ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in log.items() if k != 'prompt'}, ensure_ascii=False))
    if not ok:
        print('--- result ---\n' + result[-1500:])
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
