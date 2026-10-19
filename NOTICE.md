# NOTICE

## 原作版权 / Original work

歌曲《我想要做点流行音乐》（回环 RingAgain，收录于专辑《松一口气！》，2025）的**录音、词曲、歌词和专辑封面**，其权利归原作者及权利人所有：

- 作词／作曲／演唱：马路
- 制作人／编曲／混音／母带：天秤Dav

本仓库是**非官方、非商业**的个人创作，与乐队及其厂牌无关，**不包含**：

- 歌曲音频，以及由音频解码、分离得到的任何文件（分轨等）
- 歌词原文（`timeline.public.json` 只保留每个字的时间、音高和字形类别）
- 专辑封面

要渲染 MV，请使用你自己合法获得的歌曲文件（见 README）。

仓库中的 `story/public/data/timeline.public.json` 与 `features.bin` 是对原曲分析得到的数值数据（拍点、逐字时间、音高、逐帧能量和频谱），无法还原出音频或歌词。它们仅为复现这支 MV 提供，不在 MIT 许可范围内另行授权。

## 第三方组件 / Third-party components

| 组件 | 用途 | 许可 |
|---|---|---|
| Noto Sans SC（子集） | 强调句、片尾字体 | SIL OFL 1.1，见 `story/public/fonts/OFL-NotoSansSC.txt`；保留字体名为 "Source"，子集未使用该名称 |
| Noto Serif SC（子集） | 歌词字体 | SIL OFL 1.1，见 `story/public/fonts/OFL-NotoSerifSC.txt` |
| [Remotion](https://www.remotion.dev) | 逐帧合成与渲染 | Remotion License：个人、3 人以下公司、非营利组织免费；更大规模的营利组织需购买公司许可 |
| three.js、React | 渲染 | MIT |
| [Depth Anything V2 Large](https://huggingface.co/depth-anything/Depth-Anything-V2-Large-hf) | 为原画生成深度图（印版的深度通道） | **CC BY-NC 4.0（非商业）** |
| Demucs | 分离人声、鼓、贝斯（仅分析，不随仓库分发） | MIT |
| beat_this | 拍点与强拍检测 | MIT |
| stable-ts | 逐字对齐（备选方案） | MIT |
| wav2vec2-large-xlsr-53-chinese-zh-cn | 逐字 CTC 对齐 | Apache-2.0 |
| librosa | 音高与特征提取 | ISC |
| transformers | 加载对齐与深度模型 | Apache-2.0 |

## 图像生成 / AI-generated images

`art/raw/` 中的原画由图像生成模型绘制（通过 Codex CLI 调用），提示词见 `art/prompts/`。之后经 `art/plate.py` 分色、估计深度，由代码重新"印刷"，并加上动画和排版。图像许可见 `LICENSE-ART.md`。
