"""Decode the source FLAC and extract embedded lyrics, credits and cover.

Usage: uv run python prepare.py <song.flac> <out_dir>
"""
import json
import re
import subprocess
import sys
from pathlib import Path

CREDIT_KEYS = ("作词", "作曲", "演唱", "制作人", "编曲", "混音", "母带")
TS = re.compile(r"\[(\d+):(\d+(?:\.\d+)?)\](.*)")


def ffprobe_tags(src: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format_tags", "-of", "json", str(src)],
        check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(out)["format"]["tags"]


def parse_lyrics(raw: str):
    credits, lines = {}, []
    for row in raw.splitlines():
        m = TS.match(row.strip())
        if not m:
            continue
        t = int(m.group(1)) * 60 + float(m.group(2))
        text = m.group(3).strip()
        key = next((k for k in CREDIT_KEYS if text.startswith(k)), None)
        if key:
            credits[key] = text.split(":", 1)[1].strip()
        elif text:
            lines.append({"start": round(t, 3), "text": text})
    for i, line in enumerate(lines):
        line["next"] = lines[i + 1]["start"] if i + 1 < len(lines) else None
    return credits, lines


def main(src: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    tags = ffprobe_tags(src)
    lyr_key = next(k for k in tags if k.lower() == "lyrics")
    credits, lines = parse_lyrics(tags[lyr_key])
    meta = {
        "title": "我想要做点流行音乐",
        "artist": "回环 RingAgain",
        "album": tags.get("ALBUM") or tags.get("album"),
        "year": tags.get("DATE") or tags.get("date"),
        "credits": credits,
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    (out / "lyrics_lines.json").write_text(json.dumps(lines, ensure_ascii=False, indent=2))

    run = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
    # 48k/24-bit master for playback and the final mux; 44.1k float for Demucs.
    run("-i", str(src), "-map", "0:a", "-c:a", "pcm_s24le", str(out / "mix.wav"))
    run("-i", str(src), "-map", "0:a", "-ar", "44100", "-c:a", "pcm_f32le", str(out / "mix_44k.wav"))
    run("-i", str(src), "-map", "0:v", "-frames:v", "1", str(out / "cover.jpg"))
    print(f"{len(lines)} lyric lines, credits: {credits}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
