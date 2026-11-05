# lemo-opuscar 借鉴分析：能不能在 DeepSeek Harness 里用

- 原文：https://mp.weixin.qq.com/s/i8x27dFqpfaNEB4qZtPgXA
- 仓库：https://github.com/lemomo-ai/lemo-opuscar （MIT，截至 2026-11-07：12,940 star / 1,501 fork）
- 核实时间：2026-11-07

## 一句话结论

**能用，但"直接装"只能拿到 60 分，值钱的是它的结构而不是它的运行时。**
DSH 的技能格式与它兼容、本机依赖齐全，文章描述的那条管线你上个会话已经用自己的脚本跑通过一遍；真正的增量是 **66 份 STYLE.md + DIRECTOR/TECHNIQUE 的导演规则 + 脚本化质量闸门**。建议先花 1 小时做 10 秒测试片验证"DeepSeek 模型能不能还原风格"，再决定是薄封装直接用（A）还是自建精简版（B）。

---

## 一、文章在讲什么（对照仓库核实）

| 文章说法 | 核实结果 | 备注 |
| --- | --- | --- |
| 1.2 万 Star | ✅ 12,940 star（2026-11-07） | 开源先锋的号，数据属实 |
| 66 种风格，每种一份 STYLE.md + 一支演示片 | ✅ `styles/` 下 66 个风格目录（另 README、_template） | 2026-10-29 新增 7 个 |
| 不用视频生成模型，画面/音乐/旁白全代码 | ✅ canvas + WebGL 逐帧渲染；采样库配乐；TTS 旁白 | 无视频模型、无素材库 |
| ffmpeg 合成、Canvas/WebGL、TTS | ✅ `core/render/mux.sh`、`video.mjs`、`core/tts/` | 见下节实现细节 |
| 只是 Claude Code 插件 | ✅ 但库本身是纯脚本，**与 Claude Code 无强绑定** | 关键：可用性取决于脚本，不取决于 Claude |
| 风格针对 Claude Opus 5.5 调校 | ✅ 作者在 README 顶部明确警告："other models may not reproduce them well" | **这是本次决策最大的不确定项** |
| 一支片 30–60 分钟、Token 消耗大 | ✅ AGENTS/DIRECTOR 均反复提示；建议不超 2–3 分钟 | 长任务成本 |

文章没写、但对落地很关键的三件事：
1. **它是"提示词库 + 生产工具"的组合**，不是一个模型或一个 app；66 份 STYLE.md 才是资产（MIT）。
2. **它自带一整套自动质检**（阅读时长、配音转写、音乐对拍、响度、黑帧），这是它成片"不像 Demo"的主要原因。
3. **它把"风格"与"故事"做了强隔离**：STYLE.md 只写不变量，故事归导演——这条规则可以搬到任何内容生产类技能。

---

## 二、它的技术管线（照 `TECHNIQUE.md` 整理）

```
timeline（唯一真源：单 JSON/JS，画面、配音、配乐、字幕、校验共用）
 ├─► 画面：index.html 暴露 window.render(t) ──► 无头浏览器逐帧截图(JPEG q95) ──► ffmpeg libx264 crf14
 ├─► 旁白：TTS 逐句 ──► Whisper 转写核对 ──► 词级时间戳
 ├─► 配乐：同一 timeline 上写谱（采样器/物理建模/合成）──► 分轨
 ├─► 音效：程序化 foley，按 window.EV 事件落帧
 └─► 字幕：.srt + 烧入画面
       └─► 混音（duck/压缩/母带）──► mux.sh 两遍 loudnorm −14 LUFS ──► 成片
```

关键实现细节（都能在仓库里查到，值得抄）：

| 点 | 具体做法 | 出处 |
| --- | --- | --- |
| 页面契约 | `window.DUR / render(t) / READY / EV / TEXTS(t)`，`render(t)` 必须**确定、无状态**，任何帧可单独重渲、可并行 | `core/README.md` |
| 帧→视频 | JPEG 截图经管道喂 ffmpeg（`-f image2pipe -c:v mjpeg`），每 worker 一个浏览器，分段编码后无损拼接；默认 3 workers，单独渲可 6 | `core/render/video.mjs` |
| 性能技巧 | 颗粒（grain）交给 ffmpeg 加，不在页面里画——页面画颗粒会让每帧不可压缩 | `TECHNIQUE.md §2` |
| 母带 | 两遍 loudnorm 到 −14 LUFS / TP −1.2（单遍差约 0.5 LU），最后 ebur128 复测并报警 | `core/render/mux.sh` |
| 阅读时长闸门 | 每段文字必须完整停留 ≥ `CJK字数÷4.5 + 其他字符÷15 + 1.5s`，且 ≥1.5s；页面要报 `TEXTS(t)` 的包围盒 | `core/render/readcheck.mjs` |
| 配音校验 | 每条 TTS 用 faster-whisper 转写回比稿，数字按数值比（十九=19），不过就重生成 | `core/tts/asr_check.py` |
| 对拍闸门 | 视觉击点与音乐 cue 的偏差目标 0ms（`cuecheck.py`） | `TECHNIQUE.md §3` |
| 依赖分层 | core ~350MB（浏览器+Python venv）→ voice ~0.55GB（Kokoro+edge-tts+Whisper）→ music ~140MB → 采样库 70–400MB/个 → HDRI 12MB | `TECHNIQUE.md §1` |
| 安装方式 | `setup.sh` 用 `git clone --filter=blob:none --sparse` 稀疏检出，只拉文档/核心工具/STYLE.md | `scripts/setup.sh` |

实测：稀疏克隆后库本体 **31MB**；`package.json` 只依赖 `playwright-core` 与 `three`；`requirements.txt` 只 numpy/scipy/soundfile/soxr/pillow/fonttools。

---

## 三、真正值得借鉴的 9 个设计动作

1. **风格即数据（STYLE.md）**：11 个固定章节——本质与"不是什么"、材质渲染、色彩逻辑、字体字幕、运动质感、镜头语法、声音调色板、母语动作、媒介陷阱、引擎、变体空间。**只写不变量，不写故事**。这是整套东西最可迁移的资产。
2. **三文件分工**：`DIRECTOR.md`（怎么导：故事/节奏/镜头/表演/自检）、`TECHNIQUE.md`（怎么建：管线/命令）、`STYLE.md`（长什么样）。职责不混，避免"提示词越写越长"。
3. **单一 timeline + 确定性 render(t)**：画面、声音、字幕、校验共用一套时间数字，所以能并行渲、能重渲单帧、能自动对拍。
4. **质量闸门脚本化**：阅读时长、配音转写、对拍、响度、黑帧、NaN 帧——**不是靠模型自我感觉，而是脚本 exit code**。
5. **Treatment first（先写方案再看示例）**：必须先写 `TREATMENT.md`（三个候选结构+选择理由+分镜+调度表），之后才允许打开演示片；交付前还要与演示片对比，**6 条里至少 4 条必须不同**。这是"防模板化"最硬的一招。
6. **风格工厂 5 步**：逐个问题规划 → 确认改动成本摘要 → 先出一帧真渲染样图（改库内风格时左右对比）→ 15–30 秒演示片 → 满意才保存；存到 `~/lemo-my-styles/`，**库升级不覆盖**。
7. **依赖分层**：按需安装，不一次装 1.5GB；缺什么由 STYLE.md 自己声明。
8. **合规内建**：`CREDITS`（每个第三方素材的来源+许可）、`FACTS.md`（每个数字的出处原文）、地图章节（国界/中国地图的硬规则）、版权红线（引用只学语法，不抄具体作品）。
9. **里程碑感谢片**：每个 star 节点拍一支，既是玩法也是社区运营——你刚给 dsh-web-browser 做抖音片，这条可以照搬成"每次发版一支片"。

---

## 四、DSH 能不能直接用：兼容性清单

### ✅ 对得上

| 项 | 状态 |
| --- | --- |
| 技能格式 | lemo 的 `SKILL.md` 只有 `name` + `description` 两个 frontmatter 字段；DSH 的 `~/.dsh/skills/<name>/SKILL.md` 同一套，且同样支持附属脚本/资源（`doc-tools` 就是 `SKILL.md + scripts/ + templates/ + references/`） |
| Node | 需要 20+，本机 **v22.23.1** ✅ |
| ffmpeg | 需要 7+，本机 **8.1** ✅（`ffprobe` 也在） |
| Python | 需要 3.11+，本机系统 3.9.6 ❌，但 **uv 0.11.6** ✅（`setup.sh` 会自动 `uv venv --python 3.12`） |
| 浏览器 | `setup.sh` 会装 playwright chromium-headless-shell；本机也已有系统 Chrome，上会话就是用 Chrome CDP 抓帧的 |
| 模型侧能力 | 上个会话已用 DeepSeek 生成 41KB `scene.html` + `capture.mjs` + 8 句旁白 + 程序化 BGM，产出 30s/1080×1920/-14 LUFS 成片 → **代码做片这条路在本机已跑通** |

### ⚠️ 三处必须适配

1. **写入路径被沙箱拦截（实测）**：DSH 当前 workspace-write 策略下，`~/lemo-opuscar`、`~/lemo-my-styles`、`~/.dsh/skills` 的写入均返回 `Operation not permitted`。
   - 绕法一：`LEMO_OPUSCAR_HOME` 指向工作区内（但库+venv 会进 git 仓库，不干净）；
   - 绕法二：安装时申请一次 `danger-full-access`（或用户自己在终端跑 `setup.sh`），之后渲染只读库、写工作区，不再需要提权。
   - 注意：**安装期**需要写库目录（npm/venv），**生产期**只往项目目录写，所以一次提权即可。
2. **Claude Code 语法要换**：`SKILL.md` 里写的是 `<skill base directory>`（Claude Code 会注入）、`AskUserQuestion`、`claude plugin ...`。DSH 里要换成绝对路径、`ask_user_question`（DSH 支持 options，能一对一映射）、去掉 marketplace 命令。
3. **模型调校差异（最大风险）**：作者明说风格是为 Opus 5.5 调的。DSH 跑的是 deepseek-flash。**在投 1–2 天进去之前，先渲染一支 10 秒测试片判断保真度**——建议选 2D 风格（`ink-wash` 水墨 / `swiss-motion` 瑞士排版），别先碰 3D/Shader 风格。

### 成本

- 下载：库本体 31MB；core 依赖约 350MB；voice 层约 0.55GB + Whisper 模型（中文约 480MB）；采样库每个 70–400MB（可按需）。
- 时间：一支 30–60 秒片约 30–60 分钟 agent 时间 + 大量 token；帧文件数百 MB（上会话 `work/` 达 517MB）。
- 许可：代码与文档 MIT（可复制 STYLE.md，需保留版权声明）；演示片 CC BY 4.0（商用要署名 LemoLab）；你自己的片子归你；部分演示旁白不在 CC BY 内。

---

## 五、三种落法

| 方案 | 做什么 | 成本 | 拿到什么 | 风险 |
| --- | --- | --- | --- | --- |
| **A 直接用** | `setup.sh` 装库 → 写 30 行 DSH 封装 SKILL.md（绝对路径、ask_user_question、库路径） | 1–2 小时（含下载） | 66 风格 + 全套工具链，马上能出片 | 模型保真度未知；沙箱提权摩擦；包 1GB+ |
| **B 自建精简版（推荐）** | 复用 MIT 的 66 份 STYLE.md + 蒸馏 DIRECTOR/TECHNIQUE 规则；运行时用你已验证的本地栈（系统 Chrome CDP + edge-tts + numpy + ffmpeg），**不装 playwright/three**；补 DSH 特性（后台任务、分阶段落盘、断点续渲） | MVP 1–2 天（单风格端到端），完整 3–5 天 | 轻、可控、可长期维护的技能；与你的落盘规范一致 | 要自己拼装；3D 风格暂不支持 |
| **C 只借方法论** | 把 9 个设计动作搬进现有技能（doc-tools 的模板、发版物料、PPT 流程） | 半天 | 现有技能的质量提升 | 不出片 |

**按目标分支**：
- 只想给 dsh-web-browser 再出几支宣传片 → **A 或更省事的"只克隆库 + 手动照 STYLE.md 做"**，不必建技能；
- 想要一个以后反复用的能力（给任何产品出片）→ **B**；
- 想改进现有文档/PPT 技能的产出质量 → **C**。

---

## 六、若走 B：建议结构与 MVP 边界

```
~/.dsh/skills/code-film/            # 用 create_skill 建（需一次提权）
├── SKILL.md                        # 触发词 + 路由：库内风格 / 改风格 / 我的风格
├── guides/
│   ├── DIRECTOR.md                 # 直接取用（MIT），保留出处
│   ├── TECHNIQUE-DSH.md            # 把 lemo 的管线换成 DSH 本机栈的命令
│   └── MY-STYLES.md                # 风格工厂 5 步（可先做简化版）
├── styles/<slug>/STYLE.md          # 66 份（MIT）
├── scripts/
│   ├── capture.mjs                 # 已有（上会话版），补 --fps/--size/分段
│   ├── tts.py                      # edge-tts 逐句 + 时长表
│   ├── mix.py                      # 母带 -14 LUFS + duck（可从 bgm_script.py 抽）
│   ├── srt.py                      # 字幕（可从 lemo 移植）
│   └── readcheck.mjs               # 阅读时长闸门（可移植，改页面契约）
└── references/{本机环境.md,许可与署名.md}
```

MVP 验收线：选 `swiss-motion` 或 `ink-wash`，7–10 秒、1080×1080、中文配音、烧字幕，产出满足：−14 LUFS、readcheck 全过、与 demo 分镜明显不同（≥4/6 不同）、`CREDITS` 完整。
**过关再扩到 66 风格；不过关就退回 A（用作者调好的工具链）+ 换更简单的风格。**

---

## 七、风险与待验证

| 风险 | 说明 | 验证方式 |
| --- | --- | --- |
| 模型保真度 | STYLE.md 里大量具体数值/技法假设吃 Opus 5.5 的代码能力 | 10 秒测试片，肉眼比对 STYLE.md 的 §1 本质描述 |
| 3D/Shader | lemo 依赖 GPU（macOS 走 `LEMO_ANGLE=metal`）；headless 下 WebGL2 不稳 | 先跳过 3D，仅 2D 风格 |
| 长任务 | 30–60 分钟渲染，DSH 单会话容易到上下文边界 | 分阶段落盘 + `run_in_background` + 帧缓存按 timeline 哈希复用 |
| 沙箱 | 库目录/技能目录写入被拦 | 安装期一次提权，或库放工作区 `_tools/`（会进 git，需 .gitignore） |
| Token | 一支片可能烧掉一次大额用量 | 先 10 秒，再 30 秒；不要一上手就 60 秒 |
| 版权 | STYLE.md 是 MIT，但要保留声明；演示片 CC BY 4.0 | `references/许可与署名.md` 写清 |
| 中文配音 | edge-tts 需联网；离线 Kokoro 中文"sound plain" | 沿用上会话已验证的 `zh-CN-YunxiNeural` |

---

## 八、下一步（可立即做）

1. **10 秒测试片**（约 40 分钟）：`/tmp/lemo-full` 已有 31MB 稀疏克隆；用 `swiss-motion` 的 STYLE.md 写 page + 现有 CDP 抓帧 + ffmpeg，看 DeepSeek 能否还原。
2. **决定 A/B**：测试片过关 → B；不过关 → A（装作者工具链）。
3. **若要 A**：我写一个 `lemo-opuscar-dsh` 薄封装 SKILL.md（30 行）并把库指到 `~/.dsh/skills/lemo-opuscar/lib`，需要你允许一次工作区外写入。


---

## 附：10 秒测试片结果（2026-11-07 实测）

产出：`test-film-10s/out/swiss-motion-10s.mp4`（10.000 s / 1920×1080 / 30 fps / −13.8 LUFS / TP −1.4 dBFS）

| 验证项 | 结果 |
| --- | --- |
| DeepSeek 能否读懂 `STYLE.md` 并落地不变量 | ✅ 11 节里用到的 9 节（网格/材质/色彩/字体/运动/镜头/声音/母语动作/陷阱）都能落到具体参数 |
| lemo 工具链能否在 DSH 沙箱内跑 | ✅ `video.mjs`（playwright-core + 系统 Chrome）、`mux.sh`、`readcheck.mjs`、`still.mjs` 全通；库放 `/tmp` 即可，无需提权 |
| readcheck 阅读时长闸门 | ✅ 10/10（首轮 9/10，`66 × STYLE.md` 差 0.03 s，改入场时间后通过——闸门确实能抓错） |
| 响度/黑帧 | ✅ −13.8 LUFS、TP −1.4 dBFS、300 帧无黑帧 |
| 从零到成片耗时 | 约 10–12 分钟（写代码 + 3 轮静帧自检 + 渲染 8 s + 音频 3 s + mux 8 s），不含前期调研 |
| 与作者 demo 的差异 | ✅ 结构/开篇/标志镜头/结尾/信号色用法 5 项不同（DIRECTOR 要求 ≥4/6） |

**对 A/B 决策的影响**：原判断"先验证模型保真度"已过关，且证明 **lemo 的 core 工具可直接用**——
这让 A 与 B 的边界发生变化：

- A（直接用）的实际成本比预想更低：库 31 MB + npm 42 MB（不用装 350 MB 的浏览器，`PLAYWRIGHT_CHROME` 指向系统 Chrome 即可）；
- B（自建）的价值收窄为：把 66 份 STYLE.md + 玩法（风格工厂、用户风格库）产品化成 DSH 技能，运行时**建议直接复用 lemo core**，而不是重写。

**测试片暴露的真实摩擦**（写技能时要写进指南）：

1. 母带必须预限幅：`loudnorm` 线性模式不压真峰值，`mux.sh` 会报 TP 超标 → 先 `loudnorm + alimiter` 得 `mix_mastered.wav` 再喂 mux。
2. 分段揭示（band reveal）必须用**单条 clip 路径 + 单次 fillText**，逐段绘制会在接缝处出现白线。
3. 在黑色大字上画信号色/文字要加纸张留白（knockout），否则红色方块不可读。
4. 中文必须做字体子集（Google Fonts CSS `text=` 参数），且字形集合要预先定稿，改文案要重取。


---

## 附 2：A 方案落地记录（2026-11-07）

用户选择 A（装全套 66 风格 + 薄封装技能），已完成：

| 项 | 结果 |
| --- | --- |
| 库 | `~/lemo-opuscar`，稀疏克隆，commit `bc0992a`，66 个风格目录，379 MB（`.venv` 308M + `node_modules` 42M） |
| 运行时 | Node 22.23.1 / ffmpeg 8.1 / Python 3.12.11（uv venv）/ 系统 Chrome |
| 省掉的安装 | **没装** playwright 的 chromium-headless-shell（约 150–350MB），`PLAYWRIGHT_CHROME` 指向系统 Chrome |
| 技能 | `~/.dsh/skills/lemo-opuscar/SKILL.md`，已进技能目录（DSH 用 `ask_user_question` 替代 `AskUserQuestion`，项目落盘按 `~/.dsh/AGENTS.md`） |
| 冒烟 1 | 库内 `styles/swiss-motion/demo` 静帧渲染成功（**先补 3 个 OFL 字体**，仓库不含字体二进制） |
| 冒烟 2 | `tts_zh.py` 中文配音成功（edge-tts，1.569 s） |
| 冒烟 3 | `asr_check.py` 首次要下 Whisper 模型：本机 `ALL_PROXY=socks5h` 导致 httpx 要求 `socksio`；`env -u ALL_PROXY -u all_proxy` 后走 HTTP 代理可用（已写进技能 §3.7） |
| 会话策略 | 安装时批准了一次工作区外写入，此后本会话文件策略为 `danger-full-access` |

**使用方式**：以后说"用 XX 风格做一支 XX 的 N 秒片"即可触发技能；技能会先跑先决检查，再按上游
`AGENTS.md → DIRECTOR → TECHNIQUE → STYLE` 走完 6 步，成片按本机落盘规范放 `_会话/_实体/<id>/<name>/`。
