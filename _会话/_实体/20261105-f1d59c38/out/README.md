# dsh-web-browser · 抖音宣传片交付说明（v2）

> 30 秒竖屏宣传片 + 3:4 封面 + 发布文案，用于抖音发布。
> 主调：**在 DSH 里直接用网页版 DeepSeek** + **自定义标签页背景**。
> 生成时间：2026-11-05 ｜ 会话实体：`_会话/_实体/20261105-f1d59c38/`

## 一、交付文件

| 文件 | 说明 |
| --- | --- |
| `out/promo-30s-1080x1920.mp4` | 成片：30.000s / 1080×1920 / 30fps / H.264 + AAC（11 MB） |
| `out/cover-3x4.png` | 抖音封面：1080×1440（3:4，主标题「DeepSeek 网页版 · 装进 DSH」） |
| `copy/douyin-copy.md` | 标题 3 选 1、正文、11 个话题标签、封面文案、置顶评论、发布建议、事实自查 |
| `out/发布文案.txt` | 可直接复制粘贴的纯文本版（标题/正文/标签/置顶评论） |
| `work/storyboard.md` | 分镜脚本与时间轴 |
| `audio/mix.wav` | 成片音轨（v2 配音 + 原创 BGM，-14 LUFS） |
| `audio/bgm.wav` / `audio/bgm_only.mp3` | 纯 BGM，便于试听/换配乐 |
| `audio/README.md` | 音频结构、电平与混音方法 |
| `work/scene.html` + `work/timeline.json` + `work/capture.mjs` | 可复现的动效渲染源码与逐帧抓取脚本 |
| `work/cover2.html` | 封面渲染源码（v2） |

## 二、成片规格

- 时长：30.000s（900 帧 @30fps）
- 画面：1080×1920（竖屏 9:16），H.264 High@4.2，yuv420p，CRF 16，2 倍分辨率渲染后 Lanczos 下采样（约 3.1 Mbps）
- 声音：AAC 192kbps / 48kHz / 立体声；整体 **-14.2 LUFS**（母带目标 -14.0），真峰值 **-1.6 dBTP**
- 字幕：关键短语以大字幕烧入画面（未单独叠底部字幕条，避开抖音底部标题区）
- 安全区：正文内容避开顶部 160px、右侧 140px、底部 430px（点赞/评论/标题区域）

## 三、分镜（8 段）

| 时间 | 场景 | 画面 | 大字 |
| --- | --- | --- | --- |
| 0.00–3.36 | 痛点钩子 | 多窗口残影闪切（含自定义背景页）、⌘/Tab 键帽横穿 | 网页版 DeepSeek / 还切浏览器？ |
| 3.36–6.69 | 揭晓 | DSH 侧栏高亮「浏览器」→ 整页面板打开 chat.deepseek.com，侧栏滑出、面板铺满 | 网页版 DeepSeek / 直接开在 DSH 里 |
| 6.69–9.66 | 网页版直接用 | 推近地址栏 + 欢迎页 + 输入框，环出「深度思考 / 智能搜索」 | 登录就能用 / 聊天不切窗口 |
| 9.66–13.33 | 标签常驻 | 推近 DeepSeek 标签页与「+」 | DeepSeek 常驻 / 重启也还在 |
| 13.33–16.52 | 自定义背景 | 自定义起始页整卡弹入（图片背景），斜向高光扫过 | 标签页背景 / 想换就换 |
| 16.52–19.78 | 四种背景 | 同页轻推近，四种背景 chips 逐个弹出 | 渐变、纯色、图片 / 本地图都行 |
| 19.78–23.45 | 细节齐全 | 右键菜单逐项高亮 → 交叉淡入浏览历史页 | 右键、历史 / 一个都不少 |
| 23.45–30.00 | 片尾 CTA | 图标 + 名称 + 安装命令 + GitHub 搜索 + 点 Star | GitHub 搜 dsh-web-browser / 点个 Star |

## 四、声音

- 配音：`edge-tts` zh-CN-YunxiNeural（云希，男声），共 8 句：
  1. 网页版 DeepSeek，还切浏览器？ 2. 装个插件，直接开在 DSH 里。 3. 登录就能用，不切窗口。 4. DeepSeek 常驻，重启也还在。 5. 标签页背景，也能自己换。 6. 渐变、纯色、图片都行。 7. 右键、历史、Chrome 都在。 8. 开源免费，GitHub 搜 dsh-web-browser，点个 Star。
- 配乐：程序化合成的原创 BGM（120 BPM，30.0s，无任何版权采样/人声），结构对齐 8 个场景切点；人声段落自动压低 10dB
- 视频侧可直接使用 `audio/mix.wav`；若想换配乐，用 `python3 audio/bgm_script.py --bgm-from <你的wav>` 走同一条 duck + 母带链

> 说明：TTS 原始文件自带约 180ms 前导静音，配音实际开口比时间轴晚约 0.18s；画面本来就是「先入画、后开口」，成片听感上无需再调。若要严格对齐可跑 `--trim-vo-lead`。

## 五、素材真实性与版权

- 主画面来自项目真实截图 `screenshots/01-start.jpg`、`02-browse.jpg`（裁剪掉左侧含个人工作区名的区域，仅保留顶部菜单与面板）
- 右键菜单、浏览历史页是**按插件源码复刻的示意界面**（`src/features/30-context-menu.js`、`70-history.js`），不是真实录屏；历史条目为公开站点示例数据，无个人信息
- 自定义背景场景使用项目 README 自带截图 `screenshots/03-start-custom.jpg`（裁掉左侧含个人信息区域）；背景图版权归项目/原作者，发布前如需商用请自行确认
- 图标、字体均为本机/项目自带；BGM 与配音均为生成内容，无第三方版权素材
- 未出现 star 数、下载量、性能数据或绝对化表述；所有功能点可对应 README

## 六、发布建议（摘要，详见 copy/douyin-copy.md）

- 标题推荐：**切窗口太烦？DeepSeek 直接开在 DSH 里**
- 封面：使用 `out/cover-3x4.png`；正文里不要再叠与封面重复的大字
- 配乐：**用原声发布**（已有配音 + 原创 BGM），不要再叠抖音热门 BGM；发布时保留「原声」以便别人复用
- 时间：工作日 21:00–22:30 首发，午休 12:10–13:00 备选
- 置顶评论：完整安装命令 + GitHub 地址 + 一句「点 Star 收更新」；不刷三连、不删负评，问题引到 GitHub issue
- 安装命令：
  ```
  dsh plugin --profile desktop add github:No1064/dsh-web-browser
  ```

## 七、如何复现/修改

```bash
# 1. 逐帧渲染（需本机 Chrome + node，约 8 分钟）
cd work && node capture.mjs frames --dpr=2 --start=0 --end=30 --fps=30

# 2. 合成成片
ffmpeg -y -framerate 30 -i frames/f_%05d.jpg -i ../audio/mix.wav \
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset slow -crf 16 -profile:v high -level 4.2 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart \
  ../out/promo-30s-1080x1920.mp4
```

- 改文案/时间：改 `work/timeline.json` 的秒数后重跑第 1、2 步；改画面：改 `work/scene.html`（`renderAt(t)` 纯函数，任一帧可复现）
- 改配音：改 `work/make_vo.py` 的台词后重跑，再重跑 `audio/bgm_script.py` 重新混音
- 改封面：改 `work/cover2.html` 后用 Chrome headless 截图（2x 再缩到 1080×1440）
