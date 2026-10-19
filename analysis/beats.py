"""Beat / downbeat tracking with beat_this, plus a regularised tempo grid.

Usage: uv run python beats.py <mix.wav> <out_json>
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from beat_this.inference import Audio2Beats


def main(src: Path, out: Path):
    audio, sr = sf.read(src, dtype="float64", always_2d=True)
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    a2b = Audio2Beats(checkpoint_path="final0", device=device, dbn=False)
    beats, downbeats = a2b(audio.mean(1), sr)
    beats, downbeats = np.asarray(beats), np.asarray(downbeats)

    ibi = np.diff(beats)
    bpm_local = 60 / ibi
    bpm = float(60 / np.median(ibi))

    # Beat index within its bar (0 = downbeat), bar number counted from 1.
    beat_in_bar, bar_of_beat, bar = [], [], 0
    pos = -1
    for b in beats:
        if np.min(np.abs(downbeats - b)) < 0.05:
            bar += 1
            pos = 0
        else:
            pos = pos + 1 if pos >= 0 else -1
        beat_in_bar.append(pos)
        bar_of_beat.append(bar)

    result = {
        "bpm": round(bpm, 2),
        "bpm_range": [round(float(np.percentile(bpm_local, 5)), 1), round(float(np.percentile(bpm_local, 95)), 1)],
        "beats": [round(float(b), 4) for b in beats],
        "downbeats": [round(float(d), 4) for d in downbeats],
        "beat_in_bar": beat_in_bar,
        "bar_of_beat": bar_of_beat,
    }
    out.write_text(json.dumps(result))
    beats_per_bar = np.bincount([p for p in beat_in_bar if p >= 0]).tolist()
    print(f"bpm={bpm:.2f} range={result['bpm_range']} beats={len(beats)} downbeats={len(downbeats)}")
    print("beat-position histogram (0=downbeat):", beats_per_bar)
    print("first beats:", result["beats"][:8], "first downbeats:", result["downbeats"][:4])


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
