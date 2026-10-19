"""Global character-level CTC forced alignment (WhisperX-style) with LRC band constraints.

A Chinese wav2vec2 CTC model produces 20 ms frame posteriors over the separated vocals; one
Viterbi pass aligns every character of the song at once. Each line's characters are confined
to a band around its LRC slot so a long sustained note can't drag later lines with it.
Character starts are finally snapped to nearby vocal onsets.

Usage: uv run python align_ctc.py <vocals.wav> <lyrics_lines.json> <out_json>
"""
import json
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I mode drops the script dir
from align import tokenize  # noqa: E402
from align_lines import vocal_onsets  # noqa: E402

MODEL = "jonatasgrosman/wav2vec2-large-xlsr-53-chinese-zh-cn"
SR = 16000
HOP = 0.02  # wav2vec2 frame stride
BAND_PRE, BAND_POST = 1.4, 2.2  # seconds around [LRC start, next LRC start]
SNAP = 0.06
STAR = -1


def emissions(y: np.ndarray, model, chunk=20.0, ctx=2.0) -> np.ndarray:
    """Log-posteriors [frames, vocab] for the whole track, chunked with context."""
    n = int(np.ceil(len(y) / SR / HOP))
    out = np.full((n, model.config.vocab_size), -1e4, dtype=np.float32)
    t = 0.0
    dur = len(y) / SR
    with torch.no_grad():
        while t < dur:
            a, b = max(0.0, t - ctx), min(dur, t + chunk + ctx)
            x = torch.from_numpy(y[int(a * SR):int(b * SR)])[None]
            x = (x - x.mean()) / (x.std() + 1e-7)
            lp = torch.log_softmax(model(x).logits[0], -1).numpy()
            f0 = int(round(a / HOP))
            keep0 = int(round((t - a) / HOP))
            keep1 = min(lp.shape[0], int(round((min(dur, t + chunk) - a) / HOP)))
            out[f0 + keep0:f0 + keep1] = lp[keep0:keep1][: n - (f0 + keep0)]
            t += chunk
    return out


def viterbi(lp: np.ndarray, toks: list[int], lo: np.ndarray, hi: np.ndarray, blank=0):
    """CTC forced alignment. Returns per-token (first_frame, last_frame)."""
    T, J = lp.shape[0], len(toks)
    S = 2 * J + 1
    nonblank = np.delete(lp, blank, axis=1)
    star_col = nonblank.max(1) - 0.5
    em = np.empty((T, J), dtype=np.float32)
    frames = np.arange(T)
    for j, tid in enumerate(toks):
        col = star_col if tid == STAR else lp[:, tid]
        em[:, j] = np.where((frames >= lo[j]) & (frames <= hi[j]), col, -1e9)
    blank_em = lp[:, blank]
    can_skip = np.zeros(S, bool)
    for s in range(3, S, 2):
        j = s // 2
        can_skip[s] = toks[j] != toks[j - 1] or toks[j] == STAR
    NEG = -1e18
    dp = np.full(S, NEG)
    dp[0] = blank_em[0]
    dp[1] = em[0, 0]
    bp = np.zeros((T, S), dtype=np.int8)
    odd = np.arange(1, S, 2)
    for t in range(1, T):
        stay = dp
        adv = np.concatenate(([NEG], dp[:-1]))
        skip = np.concatenate(([NEG, NEG], dp[:-2]))
        skip = np.where(can_skip, skip, NEG)
        cand = np.stack([stay, adv, skip])
        choice = cand.argmax(0)
        best = cand[choice, np.arange(S)]
        e = np.empty(S)
        e[0::2] = blank_em[t]
        e[odd] = em[t]
        dp = best + e
        bp[t] = choice
    s = S - 1 if dp[S - 1] >= dp[S - 2] else S - 2
    first = np.full(J, -1)
    last = np.full(J, -1)
    for t in range(T - 1, -1, -1):
        if s % 2 == 1:
            j = s // 2
            first[j] = t
            if last[j] < 0:
                last[j] = t
        s -= int(bp[t, s])
    return first, last


def main(vocals: Path, lines_path: Path, out: Path):
    lines = json.loads(lines_path.read_text())
    proc = Wav2Vec2Processor.from_pretrained(MODEL)
    model = Wav2Vec2ForCTC.from_pretrained(MODEL).eval()
    vocab = proc.tokenizer.get_vocab()
    blank = vocab[proc.tokenizer.pad_token]

    y, sr = sf.read(vocals, dtype="float32", always_2d=True)
    y = librosa.resample(y.mean(1), orig_sr=sr, target_sr=SR)
    lp = emissions(y, model)
    T = lp.shape[0]
    print(f"emissions: {T} frames", flush=True)

    # Target sequence: one CTC token per CJK character, one per Latin letter (A-Z in vocab).
    toks, lo, hi, owner = [], [], [], []  # owner = (line, token index, letter index)
    for li, line in enumerate(lines):
        line["tokens"] = tokenize(line["text"])
        nxt = line["next"] if line["next"] else line["start"] + 25
        a = int(max(0, line["start"] - BAND_PRE) / HOP)
        b = int(min(T * HOP, nxt + BAND_POST) / HOP)
        for ti, tok in enumerate(line["tokens"]):
            if not tok["sung"]:
                continue
            units = list(tok["t"].upper()) if tok["t"][0].isascii() else [tok["t"]]
            for ui, u in enumerate(units):
                toks.append(vocab.get(u, STAR))
                lo.append(a)
                hi.append(b)
                owner.append((li, ti, ui))
    missing = sum(1 for x in toks if x == STAR)
    print(f"targets: {len(toks)} tokens ({missing} wildcards)", flush=True)

    first, last = viterbi(lp, toks, np.array(lo), np.array(hi), blank)
    onsets = vocal_onsets(y, SR)

    spans: dict[tuple[int, int], list[float]] = {}
    for (li, ti, _), f0, f1 in zip(owner, first, last):
        s, e = f0 * HOP, (f1 + 1) * HOP
        cur = spans.setdefault((li, ti), [s, e])
        cur[0], cur[1] = min(cur[0], s), max(cur[1], e)

    for li, line in enumerate(lines):
        sung = []
        for ti, tok in enumerate(line["tokens"]):
            if (li, ti) not in spans:
                continue
            s, e = spans[(li, ti)]
            near = onsets[np.abs(onsets - s) <= SNAP]
            if len(near):
                s = float(near[np.argmin(np.abs(near - s))])
            tok["start"], tok["end"] = round(s, 3), round(max(e, s + 0.04), 3)
            sung.append(tok)
        # CTC marks a character's onset well, its release poorly: extend each unit to the next onset.
        for prev, cur in zip(sung, sung[1:]):
            cur["start"] = max(cur["start"], prev["start"] + 0.03)
            prev["end"] = round(max(prev["end"], min(cur["start"], prev["start"] + 1.6)), 3)
            prev["end"] = min(prev["end"], cur["start"])
        if sung:
            line["aligned_start"] = sung[0]["start"]

    out.write_text(json.dumps(lines, ensure_ascii=False, indent=1))
    d = [round(l["aligned_start"] - l["start"], 2) for l in lines if "aligned_start" in l]
    print(f"line start - LRC: median {np.median(d):+.2f}s, |d|>0.6s: {sum(abs(x) > 0.6 for x in d)} lines")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
