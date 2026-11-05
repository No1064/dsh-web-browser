# 生成项目抖音宣传视频

- 会话：`session-f1d59c38-a12c-4793-a9af-149e0590c07b`
- 创建：2026-11-05T23:11:31
- 实体目录：`_会话/_实体/20261105-f1d59c38/`

## 一句话目标

给 dsh-web-browser（DSH 整页浏览器插件）生成一条 30 秒抖音竖屏宣传片，含封面与发布文案；主调为「在 DSH 里直接用网页版 DeepSeek」与「自定义标签页背景」。

## 结论

- 成片 `out/promo-30s-1080x1920.mp4`：30.000s / 1080×1920 / 30fps / H.264+AAC / -14 LUFS；8 段分镜、AI 男声（云希）配音 + 原创 BGM + 大字幕；主调为网页版 DeepSeek + 自定义标签页背景（v2）。
- 封面 `out/cover-3x4.png`（1080×1440，主标题「DeepSeek 网页版 · 装进 DSH」）。
- 发布物料 `copy/douyin-copy.md` + `out/发布文案.txt`：标题 3 选 1、正文、11 个标签、封面文案、置顶评论、发布建议、事实自查。
- 画面素材：真实截图（裁掉含个人信息区域）+ 按源码复刻的右键菜单/历史页示意界面；BGM 与配音均为生成内容，无第三方版权素材。
- 详细交付说明见 `out/README.md`。

## 文件清单

| 路径 | 内容 | 状态 |
| --- | --- | --- |
| `out/promo-30s-1080x1920.mp4` | 成片 | 定稿（待归类，可考虑进 `promo/` 或 Release 附件） |
| `out/cover-3x4.png` | 抖音封面 1080×1440 | 定稿（同上） |
| `out/README.md` | 交付说明、规格、分镜、复现方法 | 定稿 |
| `copy/douyin-copy.md` | 抖音标题/正文/话题/封面文案/置顶评论/发布建议 | 定稿 |
| `work/storyboard.md` | 分镜脚本与时间轴 | 过程 |
| `work/scene.html` / `timeline.json` / `capture.mjs` / `cover2.html`（v2 封面） | 动效渲染源码、时间轴、逐帧抓取、封面源码 | 过程（可复用） |
| `work/make_vo.py` / `work/previews/` / `work/frames/` | 配音生成、预览帧、渲染帧（frames 为临时产物，可删） | 过程/临时 |
| `audio/` | `mix.wav`、`bgm.wav`、`bgm_only.mp3`、`bgm_script.py`、README | 成品音轨 + 可复现源码 |
| `work/assets/` | 截图裁剪、图标、按源码复刻的菜单/历史页素材与说明 | 过程素材 |
