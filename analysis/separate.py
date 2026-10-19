"""Split the mix into drums / bass / other / vocals with Demucs (htdemucs_ft).

Audio I/O goes through soundfile so we don't depend on torchaudio backends.
Usage: uv run python separate.py <mix_44k.wav> <out_dir>
"""
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model


def main(src: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    audio, sr = sf.read(src, dtype="float32", always_2d=True)
    model = get_model("htdemucs_ft")
    assert sr == model.samplerate, f"expected {model.samplerate} Hz, got {sr}"
    wav = torch.from_numpy(audio.T.copy())
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / ref.std()
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    with torch.no_grad():
        sources = apply_model(model, wav[None], device=device, shifts=1, split=True, overlap=0.25, progress=True)[0]
    sources = sources * ref.std() + ref.mean()
    for name, src_t in zip(model.sources, sources):
        sf.write(out / f"{name}.wav", src_t.cpu().numpy().T.astype(np.float32), sr, subtype="FLOAT")
        print("wrote", name)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
