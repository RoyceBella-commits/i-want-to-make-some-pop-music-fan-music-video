"""Per-line windowed forced alignment, refined by snapping to vocal onsets.

Whole-song alignment drifts across long sustained notes, so each line is aligned
only inside its own LRC window, then character starts are snapped to the nearest
vocal-stem onset.
Usage: uv run python align_lines.py <vocals.wav> <lyrics_lines.json> <out_json> [model]
"""
import json
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import stable_whisper

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I mode drops the script dir
from align import align_text, tokenize  # noqa: E402

SR = 16000
PRE, POST = 0.6, 1.2  # window padding around [LRC start, next LRC start]
SNAP = 0.08


def vocal_onsets(y, sr):
    hop = 64
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, n_fft=512)
    fr = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop, units="frames",
                                    pre_max=10, post_max=10, pre_avg=60, post_avg=60, delta=0.08, wait=25)
    return librosa.frames_to_time(fr, sr=sr, hop_length=hop)


def main(vocals: Path, lines_path: Path, out: Path, model_name: str = "large-v3"):
    lines = json.loads(lines_path.read_text())
    y, sr = sf.read(vocals, dtype="float32", always_2d=True)
    y = librosa.resample(y.mean(1), orig_sr=sr, target_sr=SR)
    onsets = vocal_onsets(y, SR)
    model = stable_whisper.load_model(model_name, device="cpu")

    report = []
    for i, line in enumerate(lines):
        line["tokens"] = tokenize(line["text"])
        text = align_text(line["tokens"])
        if not text:
            continue
        nxt = line["next"] if line["next"] else line["start"] + 8
        a = max(0.0, line["start"] - PRE)
        b = min(len(y) / SR, nxt + POST)
        clip = y[int(a * SR):int(b * SR)]
        res = model.align(clip, text, language="zh", verbose=None)
        chars = []
        for seg in res.segments:
            for w in seg.words:
                cs = [c for c in w.word if not c.isspace()]
                d = (w.end - w.start) / max(len(cs), 1)
                chars += [(c.lower(), a + w.start + k * d, a + w.start + (k + 1) * d, w.probability)
                          for k, c in enumerate(cs)]
        ci = 0
        for tok in line["tokens"]:
            if not tok["sung"]:
                continue
            got = chars[ci:ci + len(tok["t"])]
            ci += len(tok["t"])
            if not got:
                continue
            start, end = got[0][1], got[-1][2]
            near = onsets[np.abs(onsets - start) <= SNAP]
            if len(near):
                start = float(near[np.argmin(np.abs(near - start))])
            tok["start"], tok["end"] = round(start, 3), round(max(end, start + 0.05), 3)
            tok["p"] = round(min(g[3] for g in got), 3)
        # Keep starts monotonic and ends no later than the following unit's start.
        sung = [t for t in line["tokens"] if t["sung"] and "start" in t]
        for prev, cur in zip(sung, sung[1:]):
            cur["start"] = max(cur["start"], prev["start"] + 0.03)
            prev["end"] = min(prev["end"], cur["start"])
        if sung:
            line["aligned_start"] = sung[0]["start"]
            report.append((i, round(sung[0]["start"] - line["start"], 2), round(min(t["p"] for t in sung), 2)))
        print(f"line {i:3d}/{len(lines)} d={report[-1][1]:+.2f}", flush=True)

    out.write_text(json.dumps(lines, ensure_ascii=False, indent=1))
    big = [r for r in report if abs(r[1]) > 0.5]
    low = [r for r in report if r[2] < 0.05]
    print(f"lines: {len(report)}, |start-LRC|>0.5s: {len(big)} {big}")
    print(f"low-confidence lines (p<0.05): {len(low)} {[r[0] for r in low]}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), *(sys.argv[4:5]))
