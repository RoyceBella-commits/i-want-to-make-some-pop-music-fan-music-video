"""Mix a metronome click (accented downbeats) onto the song to verify the beat grid by ear.

Usage: uv run python click.py <data_dir> <out.wav>
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf


def blip(sr, freq, dur=0.045, gain=0.5):
    t = np.arange(int(sr * dur)) / sr
    return gain * np.sin(2 * np.pi * freq * t) * np.exp(-t / (dur / 5))


def main(data: Path, out: Path):
    grid = json.loads((data / "grid.json").read_text())
    y, sr = sf.read(data / "mix.wav", dtype="float32", always_2d=True)
    click = np.zeros(len(y), dtype=np.float32)
    hi, lo = blip(sr, 1760), blip(sr, 1175, gain=0.35)
    for k in range(grid["n_beats"]):
        t = grid["first_downbeat"] + k * grid["period"]
        i = int(round(t * sr))
        b = hi if k % 4 == 0 else lo
        if 0 <= i < len(click) - len(b):
            click[i:i + len(b)] += b
    mixd = y * 0.6 + click[:, None]
    sf.write(out, np.clip(mixd, -1, 1), sr, subtype="PCM_16")
    print("wrote", out)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
