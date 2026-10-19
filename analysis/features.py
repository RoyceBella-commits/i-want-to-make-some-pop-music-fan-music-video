"""Per-video-frame (60 fps) audio features for driving the visuals.

Writes features.bin (float32, row-major [frame][channel]) and features.json (channel layout).
Usage: uv run python features.py <data_dir> [fps]
"""
import json
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

STEMS = ("vocals", "drums", "bass", "other")


def load_mono(path: Path):
    y, sr = sf.read(path, dtype="float32", always_2d=True)
    return y.mean(1), sr


def norm(x, lo=5, hi=99.5):
    a, b = np.percentile(x, lo), np.percentile(x, hi)
    return np.clip((x - a) / max(b - a, 1e-9), 0, 1)


def fit(x, n):
    return np.pad(x, (0, max(0, n - len(x))))[:n]


def band_rms(S, freqs, lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return np.sqrt((S[m] ** 2).mean(0))


def f0_midi(y, sr, hop, fmin, fmax, frame_length):
    f0, voiced, _ = librosa.pyin(y, fmin=fmin, fmax=fmax, sr=sr, hop_length=hop,
                                 frame_length=frame_length, center=True)
    midi = librosa.hz_to_midi(np.where(voiced & np.isfinite(f0), f0, np.nan))
    return np.nan_to_num(midi, nan=0.0)


def main(data: Path, fps: int = 60):
    mix, sr = load_mono(data / "mix_44k.wav")
    hop = sr // fps
    assert hop * fps == sr, "sample rate must be divisible by fps"
    n = int(np.ceil(len(mix) / hop))
    ch: dict[str, np.ndarray] = {}

    def rms_db(y):
        r = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
        return fit(norm(librosa.amplitude_to_db(r + 1e-9)), n)

    ch["mix_rms"] = rms_db(mix)
    stems = {s: load_mono(data / "stems" / f"{s}.wav")[0] for s in STEMS}
    for s, y in stems.items():
        ch[f"{s}_rms"] = rms_db(y)
        ch[f"{s}_onset"] = fit(norm(librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)), n)

    # Drum sub-bands: kick / snare body / hats.
    S = np.abs(librosa.stft(stems["drums"], n_fft=2048, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    for name, lo, hi in (("kick", 30, 150), ("snare", 180, 4000), ("hat", 6000, 16000)):
        ch[f"drum_{name}"] = fit(norm(librosa.amplitude_to_db(band_rms(S, freqs, lo, hi) + 1e-9)), n)

    # 32 log-spaced bands of the full mix, 40 Hz - 16 kHz.
    S = np.abs(librosa.stft(mix, n_fft=4096, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
    edges = np.geomspace(40, 16000, 33)
    bands = np.stack([band_rms(S, freqs, edges[i], edges[i + 1]) for i in range(32)])
    bands_db = librosa.amplitude_to_db(bands + 1e-9)
    bands_db = np.clip((bands_db - np.percentile(bands_db, 5)) / (np.percentile(bands_db, 99.5) - np.percentile(bands_db, 5)), 0, 1)
    for i in range(32):
        ch[f"spec_{i:02d}"] = fit(bands_db[i], n)
    cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
    ch["brightness"] = fit(norm(np.log(cent + 1)), n)

    # Harmonic content of keys/guitars (chroma, each frame normalised to its max).
    chroma = librosa.feature.chroma_cqt(y=stems["other"], sr=sr, hop_length=hop)
    for i, name in enumerate(("C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B")):
        ch[f"chroma_{name}"] = fit(chroma[i], n)

    print("pitch tracking (pyin) ...", flush=True)
    ch["vocal_midi"] = fit(f0_midi(stems["vocals"], sr, hop, 70, 1100, 2048), n)
    ch["bass_midi"] = fit(f0_midi(stems["bass"], sr, hop, 28, 330, 4096), n)

    names = list(ch)
    arr = np.stack([ch[k].astype(np.float32) for k in names], axis=1)
    arr.tofile(data / "features.bin")
    (data / "features.json").write_text(json.dumps({"fps": fps, "frames": n, "channels": names}, indent=1))
    print(f"features: {n} frames x {len(names)} channels")


if __name__ == "__main__":
    main(Path(sys.argv[1]), *(int(a) for a in sys.argv[2:3]))
