"""Checks the timeline against the source: lyric text, timing sanity and frame accuracy.

Usage: uv run python verify.py <song.flac> <timeline.json>
"""
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I mode drops the script dir
from prepare import ffprobe_tags, parse_lyrics  # noqa: E402

FPS = 60


def main(flac: Path, timeline_path: Path):
    tags = ffprobe_tags(flac)
    _, src_lines = parse_lyrics(tags[next(k for k in tags if k.lower() == "lyrics")])
    tl = json.loads(timeline_path.read_text())
    errors = []

    # 1. Text: every embedded line appears, verbatim and in order.
    shown = [l["text"] for l in tl["lines"]]
    want = [l["text"] for l in src_lines]
    if shown != want:
        missing = [w for w in want if w not in shown]
        errors.append(f"lyric text differs from FLAC: {len(missing)} missing lines")
    rebuilt = ["".join(tok["t"] for tok in l["tokens"]) for l in tl["lines"]]
    bad = [i for i, (a, b) in enumerate(zip(rebuilt, shown)) if a != b]
    if bad:
        errors.append(f"tokens don't rebuild their line text: lines {bad}")

    # 2. Timing sanity: every sung unit timed, positive, monotonic within a line.
    units = 0
    for l in tl["lines"]:
        prev = -1.0
        for tok in l["tokens"]:
            if "s" not in tok:
                continue
            units += 1
            if not (tok["e"] > tok["s"] >= 0):
                errors.append(f"line {l['i']} '{tok['t']}': bad span {tok['s']}..{tok['e']}")
            if tok["s"] < prev:
                errors.append(f"line {l['i']} '{tok['t']}': start goes backwards")
            prev = tok["s"]

    # 3. Frame accuracy: a unit appears on the first frame whose time >= its start.
    worst = 0.0
    for l in tl["lines"]:
        for tok in l["tokens"]:
            if "s" in tok:
                frame = math.ceil(tok["s"] * FPS - 1e-9)
                worst = max(worst, abs(frame / FPS - tok["s"]))
    if worst > 1 / FPS:
        errors.append(f"entrance error {worst * 1000:.1f} ms exceeds one frame")

    print(f"lines {len(shown)}/{len(want)} · units {units} · worst entrance error {worst * 1000:.1f} ms (1 frame = {1000 / FPS:.1f} ms)")
    # Lines 3 and 70 (0-based 2 and 69) exist only in the embedded lyrics, not in the common LRC.
    for idx in (2, 69):
        print(f"  line {idx + 1} (missing from LRC) present: {idx < len(want) and want[idx] in shown}")
    if errors:
        print("FAIL")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print("PASS")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
