"""Drum micro-timing: onsets per drum band, offsets vs. the 16th grid, swing and ghost notes.

Usage: uv run python groove.py <data_dir>
"""
import json
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt

BANDS = {"kick": (30, 150), "snare": (180, 4000), "hat": (6000, 16000)}
HOP = 128  # ~2.9 ms at 44.1 kHz


def band_onsets(y, sr, lo, hi):
    sos = butter(4, [lo, min(hi, sr / 2 - 100)], btype="band", fs=sr, output="sos")
    yb = sosfiltfilt(sos, y)
    env = librosa.onset.onset_strength(y=yb, sr=sr, hop_length=HOP, n_fft=1024, lag=1, max_size=3)
    frames = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=HOP, units="frames",
                                        pre_max=8, post_max=8, pre_avg=40, post_avg=40, delta=0.05, wait=20)
    times = librosa.frames_to_time(frames, sr=sr, hop_length=HOP)
    # Strength = peak band RMS right after the onset (dB), normalised over the song.
    rms = librosa.feature.rms(y=yb, frame_length=1024, hop_length=HOP)[0]
    strength = np.array([rms[f:f + 12].max() if f < len(rms) else 0 for f in frames])
    db = librosa.amplitude_to_db(strength + 1e-9)
    return times, db


def main(data: Path):
    grid = json.loads((data / "grid.json").read_text())
    T, first = grid["period"], grid["first_downbeat"]
    y, sr = sf.read(data / "stems" / "drums.wav", dtype="float32", always_2d=True)
    y = y.mean(1)

    onsets, summary = [], {}
    for kind, (lo, hi) in BANDS.items():
        times, db = band_onsets(y, sr, lo, hi)
        loud = np.percentile(db, 90) if len(db) else 0
        pos16 = (times - first) / (T / 4)
        k16 = np.round(pos16).astype(int)
        off_ms = (pos16 - k16) * (T / 4) * 1000
        for t, d, k, o in zip(times, db, k16, off_ms):
            onsets.append({
                "t": round(float(t), 4), "kind": kind, "db": round(float(d - loud), 1),
                "ghost": bool(d - loud < -14), "k16": int(k), "off_ms": round(float(o), 1),
            })
        main_hits = (db - loud > -14) & (np.abs(off_ms) < T / 8 * 1000)
        by_slot = {s: off_ms[main_hits & (k16 % 4 == s)] for s in range(4)}
        summary[kind] = {
            "count": int(len(times)),
            "ghosts": int((db - loud < -14).sum()),
            "mean_offset_ms_by_16th_slot": {s: round(float(v.mean()), 1) if len(v) else None for s, v in by_slot.items()},
            "hits_by_16th_slot": {s: int(len(v)) for s, v in by_slot.items()},
        }

    # Swing: the hats play 8ths, so measure how late the off-beat 8th lands vs. the on-beat one.
    hats = [o for o in onsets if o["kind"] == "hat" and not o["ghost"]]
    on = [o["off_ms"] for o in hats if o["k16"] % 4 == 0]
    off = [o["off_ms"] for o in hats if o["k16"] % 4 == 2]
    if on and off:
        delay = float(np.median(off) - np.median(on))
        s8 = T / 2 * 1000
        summary["swing8_delay_ms"] = round(delay, 1)
        summary["swing8_ratio"] = round((s8 + delay) / (s8 - delay), 3)
        summary["swing8_percent"] = round(100 * (s8 + delay) / (2 * s8), 1)
    sn = [o for o in onsets if o["kind"] == "snare" and not o["ghost"] and o["k16"] % 4 == 0 and (o["k16"] // 4) % 2 == 1]
    summary["backbeat_snare_lag_ms"] = round(float(np.median([o["off_ms"] for o in sn])), 1) if sn else None

    onsets.sort(key=lambda o: o["t"])
    (data / "groove.json").write_text(json.dumps({"summary": summary, "onsets": onsets}))
    print(json.dumps(summary, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
