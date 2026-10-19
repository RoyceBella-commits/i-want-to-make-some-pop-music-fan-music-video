"""Fit a constant-tempo 4/4 grid to beat_this output.

The song is produced at a fixed tempo, so a single (t0, period) pair describes every beat;
detector octave errors in double-time sections drop out as outliers.
Usage: uv run python grid.py <beats.json> <duration_s> <out_json> [bpm]
"""
import json
import sys
from pathlib import Path

import numpy as np


def main(beats_path: Path, duration: float, out: Path, bpm: float = 77.0):
    d = json.loads(beats_path.read_text())
    b = np.array(d["beats"])
    db = np.array(d["downbeats"])
    T = 60.0 / bpm
    t0 = np.angle(np.mean(np.exp(2j * np.pi * b / T))) / (2 * np.pi) * T
    k = np.round((b - t0) / T)
    res = b - (t0 + k * T)
    inl = np.abs(res) < 0.04
    t0 += float(np.median(res[inl]))

    # Downbeat phase: which beat index mod 4 the detected downbeats agree on.
    kd = np.round((db - t0) / T).astype(int)
    ok = np.abs(db - (t0 + kd * T)) < 0.06
    phase = int(np.argmax(np.bincount(kd[ok] % 4, minlength=4)))
    first = t0 + phase * T
    while first - 4 * T > -T / 2:
        first -= 4 * T

    n_beats = int(np.floor((duration - first) / T)) + 1
    grid = {
        "bpm": bpm,
        "period": T,
        "first_downbeat": round(first, 5),
        "beats_per_bar": 4,
        "n_beats": n_beats,
        "n_bars": int(np.ceil(n_beats / 4)),
        "fit_residual_ms": round(float(np.median(np.abs(res[inl]))) * 1000, 2),
        "inliers": f"{int(inl.sum())}/{len(b)}",
    }
    out.write_text(json.dumps(grid, indent=2))
    print(grid)


if __name__ == "__main__":
    main(Path(sys.argv[1]), float(sys.argv[2]), Path(sys.argv[3]), *(float(a) for a in sys.argv[4:5]))
