# Deepseek Harness 文章借鉴分析

- 会话：`session-ffc2d5d2-ae70-4f90-8081-528eb44f1d04`
- 创建：2026-11-07T00:21:13
- 实体目录：`_会话/_实体/20261107-ffc2d5d2/`

## 一句话目标

分析微信公众号文章《1.2万star！纯代码拍电影，66种风格，一句话出片！》（lemo-opuscar），判断其中哪些内容可以在 DeepSeek Harness 中借鉴或直接使用。

## 结论

- **能直接用，但直接装只拿 60 分**：DSH 技能格式与 lemo 的 `SKILL.md` 兼容，本机 Node 22 / ffmpeg 8.1 / uv / Chrome 齐备；但 `~/lemo-opuscar` 等库外写入被 DSH 沙箱拦截、SKILL.md 是 Claude Code 语法、风格针对 Opus 5.5 调校（换 DeepSeek 保真度未验）。
- **值钱的是结构不是运行时**：66 份 STYLE.md（MIT）+ DIRECTOR/TECHNIQUE 的导演规则 + 脚本化质量闸门（阅读时长/配音转写/对拍/响度）可迁移；lemo 的 playwright/three 运行时对 DSH 非必需。
- **你已有同构管线**：上个会话 `20261105-f1d59c38` 已用 Chrome CDP + edge-tts + numpy + ffmpeg 做出 30s 抖音片，缺的只是风格库与质检闸门。
- **建议**：先做 10 秒测试片验证 DeepSeek 保真度 → 过关走 B（自建精简技能，复用 MIT 语料 + 本地栈），不过关走 A（薄封装直接用作者工具链）。
- **测试片已产出（2026-11-07）**：`test-film-10s/out/swiss-motion-10s.mp4`，10.000 s / 1920×1080 / 30 fps / −13.8 LUFS；readcheck 10/10、无黑帧。结论：DeepSeek 能按 STYLE.md 做出成片，lemo 的 video/mux/readcheck 工具链在 DSH 沙箱内可直接用（库放 /tmp 或工作区，安装期才需提权）。
- **A 方案已落地（2026-11-07）**：库装在 `~/lemo-opuscar`（66 风格，commit `bc0992a`，379MB：`.venv` 308M + `node_modules` 42M），没有装 350MB 的 headless 浏览器，改用系统 Chrome（`PLAYWRIGHT_CHROME`）。DSH 适配技能写在 `~/.dsh/skills/lemo-opuscar/SKILL.md`，已出现在技能目录。冒烟验证：库内 demo 静帧渲染通过（需先补 3 个 OFL 字体）、edge-tts 中文配音通过、`asr_check` 首次下载 Whisper 会撞上本机 SOCKS 代理（解法已写进技能）。

## 文件清单

| 路径 | 内容 | 状态 |
| --- | --- | --- |
| `lemo-opuscar-借鉴分析.md` | 文章核实、技术管线、9 个可借鉴设计动作、DSH 兼容性实测、A/B/C 三方案与 MVP 边界、风险清单 | 分析定稿（待归类，暂留会话区） |
| `test-film-10s/` | 10 秒瑞士动态排版测试片：成片、海报、联系表、源码、音频、TREATMENT、README、build.sh | 测试产物（过程，暂留会话区） |

外部落点（不在本会话目录）：

| 路径 | 内容 |
| --- | --- |
| `~/lemo-opuscar/` | 66 风格库 + core 工具（MIT，稀疏克隆，commit `bc0992a`） |
| `~/.dsh/skills/lemo-opuscar/SKILL.md` | DSH 适配技能：先决检查、流程映射、6 条实测坑、常用命令、重装步骤 |

