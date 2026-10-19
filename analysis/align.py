"""Character-level lyric alignment with stable-ts (Whisper forced alignment).

Each lyric line is split into display tokens. Sung units are single CJK characters
or whole Latin words; punctuation is kept for display but carries no timing.
Usage: uv run python align.py <vocals.wav> <lyrics_lines.json> <out_json> [model]
"""
import json
import re
import sys
from pathlib import Path

import stable_whisper

UNIT = re.compile(r"[A-Za-z][A-Za-z']*|[0-9]+|[㐀-鿿]|\s+|.", re.S)
SUNG = re.compile(r"[A-Za-z0-9㐀-鿿]")


def tokenize(text: str):
    tokens = []
    for m in UNIT.finditer(text):
        s = m.group(0)
        if s.isspace():
            tokens.append({"t": " ", "sung": False})
        else:
            tokens.append({"t": s, "sung": bool(SUNG.match(s))})
    return tokens


def align_text(tokens) -> str:
    out = ""
    for tok in tokens:
        if not tok["sung"]:
            continue
        latin = tok["t"][0].isascii()
        if latin and out and not out.endswith(" "):
            out += " "
        out += tok["t"]
        if latin:
            out += " "
    return out.strip()


def main(vocals: Path, lines_path: Path, out: Path, model_name: str = "large-v3"):
    lines = json.loads(lines_path.read_text())
    for line in lines:
        line["tokens"] = tokenize(line["text"])
    text = "\n".join(align_text(l["tokens"]) for l in lines)

    model = stable_whisper.load_model(model_name, device="cpu")
    result = model.align(str(vocals), text, language="zh", original_split=True)
    (out.parent / "align_raw.json").write_text(json.dumps(result.to_dict(), ensure_ascii=False))

    # Flatten whisper words into per-character timings.
    chars = []
    for seg in result.segments:
        for w in seg.words:
            cs = [c for c in w.word if not c.isspace()]
            if not cs:
                continue
            d = (w.end - w.start) / len(cs)
            for i, c in enumerate(cs):
                chars.append((c.lower(), w.start + i * d, w.start + (i + 1) * d, w.probability))

    ci = 0
    mismatches = 0
    for line in lines:
        for tok in line["tokens"]:
            if not tok["sung"]:
                continue
            want = list(tok["t"].lower())
            got = chars[ci:ci + len(want)]
            if [g[0] for g in got] != want:
                mismatches += 1
            ci += len(want)
            if got:
                tok["start"] = round(got[0][1], 3)
                tok["end"] = round(got[-1][2], 3)
                tok["p"] = round(min(g[3] for g in got), 3)
    print(f"chars aligned: {ci}/{len(chars)}, token mismatches: {mismatches}")

    # Sanity check against LRC line starts.
    drift = []
    for line in lines:
        sung = [t for t in line["tokens"] if t["sung"] and "start" in t]
        if sung:
            line["aligned_start"] = sung[0]["start"]
            drift.append((round(sung[0]["start"] - line["start"], 2), line["start"]))
    flagged = [d for d in drift if abs(d[0]) > 0.5]
    print(f"lines with |aligned-LRC| > 0.5s: {len(flagged)} -> {flagged[:20]}")
    out.write_text(json.dumps(lines, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), *(sys.argv[4:5]))
