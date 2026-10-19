# 回环 RingAgain《我想要做点流行音乐》非官方 MV · 叙事版

![封面](docs/cover.png)

一支用代码"印刷"出来的 MV。一个抱着比自己还大的吉他的孩子，从夏天出发，学琴、转专业、组乐队，被注视，被说 nobody cares，然后还是做了点东西，最后回到那个夏天。

- 5 分 05 秒，1080p60，53 个镜头，39 张场景原画（另有 2 张角色设定稿、1 张封面）
- 画风模拟孔版印刷（Riso）：五种专色油墨、半调网点、套色错位。油墨每逢军鼓就被撞开，画面跟着后拍"呼吸"
- 每个字都在它被唱出的那一帧落下

> An unofficial, non-commercial music video for *我想要做点流行音乐* by 回环 RingAgain, built with Remotion + three.js in a risograph style. **No audio, lyrics or album art are included**; bring your own legally obtained copy of the song.

## ⚠️ 本仓库不包含

歌曲音频、歌词原文、专辑封面。它们的权利属于原作者（见 [NOTICE.md](NOTICE.md)）。

歌词以"只有时间、没有文字"的形式保存在 `story/public/data/timeline.public.json` 里。运行前，用你自己的正版音频把文字填回去，生成的文件只留在本地，已被 `.gitignore` 排除。

## 它是怎么做的

```
正版音频 ─► analysis/ ─► 分轨 · 拍点网格（77 BPM）· 逐字对齐 · 音高 · 逐帧特征 ─► timeline.json
分镜 ─► art/prompts ─► 图像生成模型 ─► art/raw ─► 分色 + 深度估计 ─► story/public/plates
                                                                     │
story/（Remotion + three.js）◄──────────────────────────────────────────┘
  ├─ 印版贴在按深度位移的网格上，做 2.5D 视差运镜
  ├─ Riso 着色器：半调网点、油墨斑驳、套色错位跟军鼓、逐色上版
  ├─ 歌词油墨层：弹簧落字（soul / pop 两种手感）、五线谱和音高音符、按透视贴进场景
  └─ 每个镜头的音乐元素特效（story/src/story/fx.tsx）
```

所有动画都是帧号的纯函数，同一帧无论渲染多少次都完全一样。

## 目录

| 路径 | 内容 |
|---|---|
| `story/` | Remotion 工程：`src/story/shots.ts`（53 个镜头的时间、运镜、歌词位置）、`fx.tsx`（逐镜特效）、`src/riso/`（印刷着色器）、`src/lyric/`（歌词排版）、`src/cover/`（封面） |
| `story/scripts/lyrics.mjs` | 歌词的剥离和回填 |
| `story/verify/` | 检查：每句歌词都被印出、没有空白帧 |
| `art/` | 生图与分色：`make_prompts.py`、`run_batch.py`、`gen_codex.py`、`plate.py`、`plates_all.py`，以及分镜表 `storyboard.md` |
| `analysis/` | 音频分析流水线（Python 3.11 + uv） |
| `tools/lyric-timing/` | 逐字时间校对网页 |
| `docs/` | 封面 |

## 快速开始：渲染 MV

需要 Node 20+（开发时用的是 24）、ffmpeg / ffprobe，以及歌曲的正版 FLAC。必须是带内嵌歌词的发行版本：它有完整的 104 句，常见的 LRC 少两句。

```bash
cd story
npm ci
npm run lyrics -- merge /path/to/song.flac     # 用你的音频把歌词填回 public/data/timeline.json
npm run verify                                  # 检查 104 句都有镜头负责
npx remotion studio                             # 预览
```

渲染并封装音频（Remotion 只输出画面）：

```bash
npx remotion render Story ../out/mv_silent.mp4 --gl=angle --muted
ffmpeg -i ../out/mv_silent.mp4 -i /path/to/song.flac -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 320k -af apad -shortest ../out/mv.mp4
```

封面：`npx remotion still Cover ../out/cover.png --gl=angle`。`CoverClean` 是不带字的版本；4:3 安全区为 x = 240–1680。

`--gl=angle` 适用于 macOS；在其他平台上，按 Remotion 文档选择 `--gl` 参数。

## 可选：重新生成原画

需要已登录、可以生图的 Codex CLI（≥ 0.162.1）。

```bash
cd art
python3 -I make_prompts.py                 # 从镜头描述写出 prompts/*.json
python3 -I run_batch.py s03_chords s04_form …   # 逐张调用 Codex，失败时用 high 重试一次
uv venv --python 3.11 .venv && uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python -I plates_all.py          # 分色 + 深度，写入 story/public/plates/
```

每张图都先经过分色再重新"印刷"，所以不同批次、甚至不同模型画的图，最后都会统一成同一种质感。

## 可选：从音频重新分析

仓库里已附带校准好的时间数据，通常不需要这一步。

```bash
cd analysis && uv sync
uv run python prepare.py /path/to/song.flac ../data            # 解码，取出内嵌歌词
uv run python separate.py ../data/mix_44k.wav ../data/stems    # Demucs 分轨
uv run python beats.py ../data/mix.wav ../data/beats.json
uv run python grid.py ../data/beats.json <时长秒> ../data/grid.json 77
uv run python features.py ../data
uv run python groove.py ../data
uv run python align_ctc.py ../data/stems/vocals.wav ../data/lyrics_lines.json ../data/lyrics_aligned_ctc.json
uv run python build_timeline.py ../data ../data/lyrics_aligned_ctc.json ../story/public
node ../tools/lyric-timing/server.mjs                           # 可选：http://localhost:5177 逐字校对
cd ../story && npm run lyrics -- strip                          # 重新生成不含歌词的 timeline.public.json
```

另外，有几处逐字时间是按人耳校准后直接写在代码里的，见 `story/src/lib/lyrics.ts` 中的 `FIXES`。

## 制作

创意方向、分镜取舍与所有听感上的校准来自人类创作者。代码、动画与提示词由 Claude Opus 5.5（Anthropic）协作编写。原画由图像生成模型绘制（通过 Codex CLI 调用）。

## 许可

- 源代码：[MIT](LICENSE)
- 原画、印版、封面：[CC BY-NC 4.0](LICENSE-ART.md)
- 字体与第三方组件：见 [NOTICE.md](NOTICE.md)
- 歌曲、歌词、专辑封面：权利归原作者所有，不在本仓库中

## 署名

《我想要做点流行音乐》 — 回环 RingAgain，专辑《松一口气！》（2025）。作词／作曲／演唱：马路；制作人／编曲／混音／母带：天秤Dav。

谢谢回环。
