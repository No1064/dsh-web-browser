# SWISS MOTION · 10 s test — 交付说明

用 lemo-opuscar 的 `styles/swiss-motion/STYLE.md`（MIT）做的 10 秒测试片，
用来验证"DeepSeek 驱动的 agent 能不能按风格提示词做出成片"。

## 一、成片

| 文件 | 内容 |
| --- | --- |
| `out/swiss-motion-10s.mp4` | 成片：10.000 s / 1920×1080 / 30 fps / H.264 CRF14 + AAC 48 kHz |
| `out/poster.jpg` | 海报帧（8.2 s，全套版式完成时） |
| `out/contact-sheet.jpg` | 12 帧联系表（每 0.83 s 一帧） |
| `out/video.mp4` | 无声画面（渲染中间产物，便于重混音） |
| `audio/mix.wav` | 原始混音（-16.2 LUFS，供重新母带） |
| `audio/mix_mastered.wav` | 预母带（-14 LUFS / TP -1.5，mux 的输入） |
| `audio/make_audio.py` | 配乐 + foley 全套合成脚本（numpy/scipy，无采样） |
| `index.html` / `app.js` | 画面源码：`window.render(t)` 确定性逐帧渲染 |
| `fonts/` | Inter + Noto Sans SC 子集（OFL，仅用到的字） |
| `TREATMENT.md` | 导演方案（结构候选、分镜、cue、声音设计） |
| `build.sh` | 一键重建 |

**实测指标**：−13.8 LUFS、真峰值 −1.4 dBFS、LRA 1.0 LU；300 帧无黑帧；
readcheck 10/10 通过（每段文字停留均满足 `CJK÷4.5 + 其他÷15 + 1.5 s`）。

## 二、复现

依赖：Node 20+（本机 22.23）、ffmpeg 7+（本机 8.1）、系统 Chrome、npm（给 lemo core 装 playwright-core）。
lemo 库已装在 `~/lemo-opuscar`（66 风格全量，稀疏克隆）；如果换机器，按下面重拉：

```sh
git clone --depth 1 --filter=blob:none --sparse https://github.com/lemomo-ai/lemo-opuscar.git "$HOME/lemo-opuscar"
cd "$HOME/lemo-opuscar" && git sparse-checkout set --no-cone '/*' '!/styles/*/demo/' '!/styleboard/' '!/docs/frames/' '!/docs/*.jpg' '!/styles/*/poster.jpg'
npm install --no-audit --no-fund        # playwright-core + three，42 MB
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements.txt -r requirements-voice.txt
```

重建（本片约 20 秒：渲染 8 s + 音频 3 s + mux 8 s）：

```sh
LIB="$HOME/lemo-opuscar" PLAYWRIGHT_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" sh build.sh
```

注意：`build.sh` 里 mux 用的是 `audio/mix_mastered.wav`（先 `loudnorm + alimiter` 预母带，
否则 mux 的真峰值会超过 −1.2 dBFS 并报警）。

## 三、与 STYLE.md 的对照（落地了哪些不变量）

| STYLE.md 条目 | 本片做法 |
| --- | --- |
| §2 网格 | 1920×1080、12 栏、96 px 边距、24 px 栏距、24 px 基线；文字全部对齐栏线 |
| §2 材质 | 纯平面：纸、墨、两条规线；无渐变、无阴影、无纹理 |
| §3 色彩 | 纸 `#FFFFFF`、墨 `#111111`、三档灰 + **唯一信号色** `#E30613`，只给例外元素 |
| §4 字体 | 全片一个无衬线家族（Inter + Noto Sans SC 子集），两种字重；flush left；中文按字距收紧 |
| §5 运动 | 只用两条曲线：`cubic-bezier(.7,0,.2,1)` 与线性；入场是裁切揭示不是淡入；大字数字按 band 逐段"爬"进来；删除是刀切线 + 塌陷；例外元素线性、不吸附 |
| §6 镜头 | 锁定版面 + 一次 5% 推镜（3.5–4.0 s），停播前后都在节拍上 |
| §7 声音 | 120 BPM 机械脉冲、marimba/glock 音型、印刷 foley（纸、描线笔、铅字、裁刀、绒槌）；5.0–5.5 s 硬静音，静止里只有例外元素的滑音 |
| §8 母语动作 | 网格有含义（12 栏 / 8 个八分音符计数器）、snap=节拍、极端尺度对比、例外、刀切、墙式生成 |
| §9 陷阱 | 数字分段用单条 clip 路径避免接缝；文字不做淡入；离格元素加纸张留白保证可读 |

## 四、与作者 demo 的差异（DIRECTOR §11：6 条里至少 4 条不同）

| 项 | 作者 demo（Swiss Motion Graphics） | 本片 |
| --- | --- | --- |
| 结构 | 一张音乐节海报按五条规则排版 | 三条元规则 → 系统生成 66 种风格 |
| 开篇 | 海报版面直接开始 | 一个点 → 网格长出来 → 空白纸 |
| 标志镜头 | 海报排版完成 | 例外元素飞出网格、越过巨型数字 |
| 结尾 | 海报完成 | 空网格（系统收拢） |
| 叙事主体 | 虚构海报 | 元叙事（风格工具箱自身） |
| 信号色用法 | 海报主色 | 只给"例外"，最后被吸收为第 66 块 |

## 五、局限（这是测试片，不是交付级作品）

- 无旁白、无字幕条（10 秒测试，英文/中文都只做了版式内的字）；`core/tts` 与 Whisper 回比未使用。
- 只测 2D canvas 风格；3D/Shader 风格（需要 GPU、three.js）未验证。
- 字体是 Google Fonts 子集（仅用到的字形），换文案要重新取子集。
- 运行依赖 `/tmp/lemo-full` 的 lemo core（`video.mjs`/`mux.sh`/`readcheck.mjs`/`still.mjs`），未做成本地常驻技能。
- 音频未做真峰值过采样限幅之外的响度自动化，交付前应由 mux.sh 复测（已通过：−13.8 LUFS / −1.4 dBFS）。
