"""Merge grid, sections, aligned lyrics (+ per-character pitch), drum hits and metadata
into story/public/data/timeline.json, and copy features into the Remotion project.

Usage: uv run python build_timeline.py <data_dir> <aligned_lyrics.json> <story_public_dir>
"""
import json
import shutil
import sys
from pathlib import Path

import numpy as np

# Section map. A section starts on a bar line ("bar", n), or just before a pickup line ("line", i),
# whichever the music does there. Each section ends where the next begins.
SECTIONS = [
    # id,        name,              start,          accent,   feel
    ("v1a",      "VERSE 1A",        ("t", 0.0),     "amber",  "soul"),
    ("v1b",      "VERSE 1B",        ("bar", 11),    "amber",  "soul"),
    ("pre1",     "PRE-CHORUS 1",    ("line", 17),   "blue",   "soul"),
    ("hold1",    "HOLD",            ("line", 26),   "blue",   "soul"),
    ("ch1",      "CHORUS 1",        ("bar", 25),    "pink",   "pop"),
    ("watch",    "WATCHED",         ("line", 30),   "red",    "pop"),
    ("rap",      "RAP",             ("line", 39),   "red",    "pop"),
    ("v2",       "VERSE 2",         ("bar", 43),    "white",  "soul"),
    ("pre2",     "PRE-CHORUS 2",    ("line", 61),   "green",  "soul"),
    ("hold2",    "HOLD",            ("line", 70),   "green",  "soul"),
    ("ch2",      "CHORUS 2",        ("bar", 57),    "pink",   "pop"),
    ("curious",  "CURIOUS",         ("line", 74),   "pink",   "pop"),
    ("bridge",   "BRIDGE",          ("bar", 65),    "violet", "soul"),
    ("build",    "BUILD",           ("line", 83),   "cycle",  "pop"),
    ("fc1",      "FINAL CHORUS A",  ("bar", 73),    "full",   "pop"),
    ("fc2",      "FINAL CHORUS B",  ("bar", 81),    "full",   "pop"),
    ("outro",    "OUTRO · LOOP",    ("t", 272.9),   "full",   "pop"),
    ("end",      "END",             ("line", 103),  "amber",  "soul"),
]
PICKUP_LEAD = 0.2  # a line-started section opens this long before the first sung character


def main(data: Path, aligned: Path, public: Path):
    grid = json.loads((data / "grid.json").read_text())
    meta = json.loads((data / "meta.json").read_text())
    layout = json.loads((data / "features.json").read_text())
    groove = json.loads((data / "groove.json").read_text())
    lines = json.loads(aligned.read_text())
    # Manual corrections from tools/lyric-timing, keyed "lineIndex:tokenIndex".
    ovr_path = data / "lyrics_overrides.json"
    if ovr_path.exists():
        ovr = json.loads(ovr_path.read_text()).get("tokens", {})
        for k, v in ovr.items():
            li, ti = map(int, k.split(":"))
            lines[li]["tokens"][ti]["start"], lines[li]["tokens"][ti]["end"] = v["s"], v["e"]
        print(f"applied {len(ovr)} manual timing overrides")
    T, first = grid["period"], grid["first_downbeat"]
    bar_t = lambda b: first + (b - 1) * 4 * T
    duration = layout["frames"] / layout["fps"]

    feats = np.fromfile(data / "features.bin", dtype=np.float32).reshape(layout["frames"], -1)
    vmidi = feats[:, layout["channels"].index("vocal_midi")]
    fps = layout["fps"]

    def line_start(i):
        return min(t["start"] for t in lines[i]["tokens"] if t.get("sung") and "start" in t)

    def resolve(spec):
        kind, v = spec
        if kind == "bar":
            return bar_t(v)
        if kind == "line":
            return line_start(v) - PICKUP_LEAD
        return float(v)

    starts = [resolve(spec) for _, _, spec, _, _ in SECTIONS]
    sections = []
    for k, (sid, name, _, accent, feel) in enumerate(SECTIONS):
        end = starts[k + 1] if k + 1 < len(SECTIONS) else duration
        sections.append({"id": sid, "name": name, "accent": accent, "feel": feel,
                         "start": round(starts[k], 4), "end": round(end, 4)})

    out_lines = []
    for i, line in enumerate(lines):
        toks = []
        for tok in line["tokens"]:
            o = {"t": tok["t"]}
            if tok["sung"] and "start" in tok:
                s, e = tok["start"], min(tok["end"], tok["start"] + 2.5)  # no unit holds longer than 2.5 s
                seg = vmidi[int(s * fps):max(int(s * fps) + 1, int(min(e, s + 0.45) * fps))]
                voiced = seg[seg > 0]
                o.update(s=s, e=e)
                if len(voiced):
                    o["m"] = round(float(np.median(voiced)), 2)
                    full = vmidi[int(s * fps):int(e * fps) + 1]
                    full = full[full > 0]
                    if e - s > 0.5 and len(full) and np.ptp(full) > 2.0:
                        o["mel"] = 1  # melisma: pitch moves while the character is held
            toks.append(o)
        sung = [t for t in toks if "s" in t]
        if not sung:
            continue
        start = sung[0]["s"]
        sec = next(s["id"] for s in sections if s["start"] <= start < s["end"] + 1e-6)
        out_lines.append({"i": i, "text": line["text"], "lrc": line["start"], "s": start,
                          "e": sung[-1]["e"], "sec": sec, "tokens": toks})

    # Vocal syllable onsets across the outro: they drive the endless "还有" ring.
    outro = next(sec for sec in sections if sec["id"] == "outro")
    import librosa
    import soundfile as sf
    vy, vsr = sf.read(data / "stems" / "vocals.wav", dtype="float32", always_2d=True)
    seg = vy.mean(1)[int(outro["start"] * vsr):int(outro["end"] * vsr)]
    env = librosa.onset.onset_strength(y=seg, sr=vsr, hop_length=256)
    ons = librosa.onset.onset_detect(onset_envelope=env, sr=vsr, hop_length=256, units="time", delta=0.12, wait=8)
    outro_onsets = [round(float(o + outro["start"]), 3) for o in ons]

    drums = [{"t": o["t"], "k": o["kind"][0], "g": int(o["ghost"]), "db": o["db"], "k16": o["k16"]}
             for o in groove["onsets"] if not (o["kind"] == "kick" and o["ghost"])]

    timeline = {
        "duration": round(duration, 4),
        "grid": {"bpm": grid["bpm"], "period": T, "first_downbeat": first, "n_bars": grid["n_bars"]},
        "groove": {k: v for k, v in groove["summary"].items() if not isinstance(v, dict)},
        "meta": meta,
        "sections": sections,
        "lines": out_lines,
        "drums": drums,
        "outro_onsets": outro_onsets,
    }
    (public / "data").mkdir(parents=True, exist_ok=True)
    (public / "data" / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, separators=(",", ":")))
    shutil.copy(data / "features.bin", public / "data" / "features.bin")
    shutil.copy(data / "features.json", public / "data" / "features.json")
    print(f"timeline: {len(out_lines)} lines, {sum(len([t for t in l['tokens'] if 's' in t]) for l in out_lines)} sung units, "
          f"{len(drums)} drum hits, {len(sections)} sections, {duration:.2f}s")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
