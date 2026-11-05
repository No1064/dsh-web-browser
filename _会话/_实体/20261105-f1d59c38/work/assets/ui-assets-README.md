# dsh-web-browser 宣传片 UI 素材说明

本目录为 30 秒抖音竖屏宣传片（1080×1920）配套的两处 UI 高保真素材。所有文件均由本会话内独立 HTML/CSS 渲染，**未修改项目区任何文件**。

## 一、文件清单

| 文件 | 像素尺寸 | 模式 | 用途 |
| --- | --- | --- | --- |
| `ui-context-menu.png` | 516 × 1054 | RGBA，背景透明 | 右键菜单复刻，2x；可直接叠在浏览画面上做菜单高亮动画 |
| `menu.html` | — | 自包含 HTML | 同一菜单的可集成源码（透明背景、`.is-hot` 示例高亮），供逐项动画/录制 |
| `ui-history.png` | 3008 × 2258 | RGB | **浏览历史整页**（完整浏览器面板：工具栏 + 标签页 + 历史视图 + 底栏），2x，可直接替换宣传片里的面板区 |
| `ui-history-view.png` | 3008 × 2058 | RGB | 备用：仅历史视图本体（裁掉工具栏/标签页/底栏），对应面板内 1504×1029 CSS 区域 |
| `ui-history.html` | — | 自包含 HTML | 生成 `ui-history.png` 的源码（示例数据可改） |
| `ui-assets-README.md` | — | — | 本说明 |

CSS 尺寸换算（宣传片排版时按这个放置）：

- `ui-context-menu.png`：516×1054 px = **258×527 CSS**；其中菜单卡片本体 196×465 CSS（阴影与透明留白在四周）。
- `ui-history.png`：3008×2258 px = **1504×1129 CSS**，即 DSH 面板区尺寸（`screenshots/` 里 1800×1129 截图去掉 296px 左侧栏后的区域）。
- `ui-history-view.png`：3008×2058 px = **1504×1029 CSS**，对应面板内从工具栏/标签页之下（y=74 CSS）到底栏之上（y=1103 CSS）的区域。

## 二、渲染方式与字体

- 渲染器：Google Chrome 156，`--headless=new`，`--force-device-scale-factor=2`（设备像素比 DPR=2），`--hide-scrollbars`，`--virtual-time-budget` 让字体与布局完成后再截帧。
- 字体：`'OPPO Sans 4.0','Hiragino Sans GB','PingFang SC'`（本机 `~/Library/Fonts/OPPO Sans 4.0.ttf`，实际生效为 OPPO Sans 400/600）。
  - 菜单：12px（源码 `.dbp-ctx-item` 字号 12、行高 1.2、项高 28px）。
  - 历史页正文：13px / 行高 1.4；页标题 15px/600；分组标题 11px/600；条目标题 13px；URL 11.5px；时间 11px。与真实截图里的 DSH 面板字号一致，未放大做海报。
- 无外网依赖、无 CDN：图标全部为内联 SVG，路径直接取自源码 `icon()`（core.js）、`bmIcon()`（50-home-bookmarks.js）、`histIcon()`（70-history.js）；favicon 占位为 CSS 绘制的字母色块。
- PNG 为透明/白底 2x 位图，文字按 DPR=2 渲染，缩放回 1x 播放不会发虚。

复现命令（路径按实际目录替换）：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --no-sandbox --disable-gpu --user-data-dir=/tmp/chrome-replica \
  --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1504,1129 \
  --screenshot=ui-history.png --virtual-time-budget=2000 \
  "file:///ABS/PATH/ui-history.html"

# 菜单需要透明背景，额外加 --default-background-color=00000000，
# 截完用 PIL 按 alpha bbox 裁到内容边界：
#   --default-background-color=00000000 --window-size=276,660 --screenshot=ui-context-menu.png
```

`ui-history-view.png` 由 `ui-history.png` 裁切：`crop((0, 148, 3008, 2206))`（对应 CSS y=74 → 1103）。

## 三、与源码对齐的部分（结构 / 尺寸 / 色值）

### 1. 右键菜单

结构、文案、顺序、分组全部来自 `src/features/30-context-menu.js`：

- 容器 `.dbp-ctx-menu`（第 825 行）：`min-width:196px; max-width:280px; padding:4px; border:.5px solid border-l2; border-radius:8px; background:bg-layer-1; box-shadow:0 8px 24px(color-mix(label-primary 18%, transparent)); font-size:12px; line-height:1.2`。
- 菜单项 `.dbp-ctx-item`（第 826 行）：`height:28px; padding:0 8px; border-radius:5px; font-size:12px; white-space:nowrap`。
- hover / 高亮（第 827 行）：`background:brand-primary 12%; color:brand-primary`；禁用（第 828 行）：`color:state-idle-primary`。
- 分隔线 `.dbp-ctx-separator`（第 829 行）：`height:1px; margin:4px 6px; background:border-l1`。
- 菜单项顺序即 `dbpCtxBuildItems()`（第 351–479 行）在示例 payload 下的真实输出：
  `isEditable=true、selectionText 非空、linkURL 非空、canGoBack=true、canGoForward=false、zoom=1` →
  剪切 / 复制 / 粘贴 / 全选 / ─ / 在新标签页打开链接 / 复制链接地址 / 用 Chrome 打开链接 / ─ / 后退 / 前进(禁用) / 刷新 / ─ / 复制页面地址 / 用 Chrome 打开此页 / ─ / 放大 / 缩小 / 重置缩放(禁用)。
  其中 `前进` 因 `canGoForward=false`、`重置缩放` 因当前缩放 100% 而按源码置灰，不是排版简化。
- hover 示例落在「用 Chrome 打开链接」（`menu.html` 里为 `.is-hot`）。

### 2. 浏览历史页

结构与排版来自 `src/features/70-history.js`：

- 页面骨架 `HistoryPage`（第 726–847 行）：头部「返回 / 浏览历史 / 共 N 条 / 搜索标题或网址 / 清空全部」；按日期分组的列表（第 611–620、686–694 行）；行内「标题 + URL（仅当标题与 URL 不同）+ 时间 + 删除」（第 622–655 行）；「显示更多」（第 695–708 行）。
- 日期分组文案：`histDateLabel()`（第 429–436 行）→ 今天 / 昨天 / `YYYY-MM-DD`（本图第三组为 2026-11-03）。
- 时间格式：`histFormatTime()` → `HH:MM`，等宽数字。
- 页码规则：`HIST_PAGE_SIZE=200`（第 25 行）——单屏「今天/昨天/日期」与「显示更多」同现属于取景合成，见下节。
- 样式逐条对齐 `HIST_CSS`（第 852–899 行）：`max-width:960px` 居中、头部 `padding:14px 20px 12px`、标题 `15px/600`、搜索框 `height:30; radius:8`、清空按钮 `height:28; radius:7; 红色 40% 边框`、分组 `padding:14px 8px 6px; font-size:11px; letter-spacing:.04em`、行 `gap:10px; padding:2px 8px; radius:8`、删除按钮 24×24 且默认 `opacity:0` 仅悬停显示、显示更多 `height:30; radius:15; margin:14px auto 0`。
- 浏览器外壳（工具栏 40px / 标签页 34px / 底栏 26px、地址栏 28px、`.dbp-tool` 28×28、`.dbp-external` 26px、底栏 11px 等）来自 `src/core.js` 的 CSS（第 127–190 行）；图标路径来自 `icon()`（第 190–222 行）。「浏览历史」工具栏按钮激活态 `data-active="true"`（70-history.js 第 898 行）也按真实状态绘制。

### 3. 色值来源（DSH 内置 light 主题 token 解析值）

`src/core.js` 只引用 `var(--dsw-alias-*)`，具体值从本机 DSH 应用包内的 light 主题 CSS 解析得到（未改动）：

| token | 解析值 | 用途 |
| --- | --- | --- |
| `--dsw-alias-bg-base` / `bg-layer-1` | `#fff` | 面板、菜单、输入框底色 |
| `--dsw-alias-label-primary` | `#0f1115` | 主文字、菜单 hover 文字、品牌色（light 主题 brand-primary 即近黑） |
| `--dsw-alias-label-secondary` | `#61666b` | 次级文字、图标、时间、URL |
| `--dsw-alias-border-l1` | `rgba(0,0,0,.04)` | 0.5px 分区线、菜单分隔线 |
| `--dsw-alias-border-l2` | `rgba(0,0,0,.1)` | 0.5px 输入框/按钮边框、菜单外框 |
| `--dsw-alias-brand-primary` | `#0f1115` | 菜单 hover 底色 12%、工具栏激活底色 12%、`前往`/`更新` 文字 |
| `--dsw-alias-state-idle-primary` | `#d4d4d4` | 禁用项文字 |
| `--dsw-alias-state-error-primary` | `#ec1313` | `清空全部` 文字、删除 hover、红色 40% 边框/10% 背景 |
| `--dsw-alias-state-warn-primary` | `#f59e0b` | 历史页错误提示条用色（本图未出现该状态） |
| `--dsw-static-deepseek-500` | `#4176e6` | 仅用于品牌蓝（本组素材中未直接在菜单/历史页出现） |

注意：DSH light 主题的 `brand-primary` 是近黑色，所以**菜单 hover 是 12% 黑灰高亮**（`#e2e2e3` 级），"前往"等品牌色文字也是近黑，不是蓝色；这与 `screenshots/01-start.jpg`、`02-browse.jpg` 的真实界面一致。测试表明 Chrome 已正确命中本机 OPPO Sans（与 Hiragino Sans GB / PingFang SC 渲染结果可区分）。

## 四、示意（非源码真实）清单

1. **历史数据全部为示意**：30 秒宣传片需要真实产品里没有的示例记录。站点仅使用公开站点（deepseek.com、github.com、developer.mozilla.org、bilibili.com、electronjs.org、wikipedia.org、stackoverflow.com、zhihu.com），标题/URL 为公开页面名称，时间为连续递减的示例值；无任何个人信息、token 数、工作区名。
2. **"共 216 条" 与分组计数 6 / 5 / 4**：示意总数与示例条数，不是真实使用数据。
3. **favicon 字母色块是补充**：源码 `renderEntry()` 的历史条目没有 favicon（只有标题/URL/时间/删除）。按简报"favicon 占位"的要求补了 16px 字母块，配色沿用 `50-home-bookmarks.js` 的 hue 字母块视觉语言（hue 按站点品牌色手工取值，非源码 hash）。
4. **"显示更多"在单屏出现是取景合成**：真实逻辑为每页 200 条、仅在 200 行之后出现"显示更多"；单屏同时看到「今天/昨天/日期」分组与"显示更多"在真实产品里不可能（那需要列表已滚到第 200 行附近）。本图为了在一帧内展示"分组 + 显示更多"入口做了版式合成，功能真实、出现条件示意。
5. **鼠标悬停态是摆拍**：第 2 行（DeepSeek 开放平台）为 hover 态（浅灰底 + 删除按钮显形）；工具栏「浏览历史」为激活态；菜单「用 Chrome 打开链接」为 hover 亮项。真实交互时这些随鼠标出现。
6. **菜单场景分支**：按源码 `isEditable=true + 有选区 + 命中链接` 输出，因此第一组含「剪切」。任务要求在源码分支为准，此分支必然含剪切，故保留。
7. **外壳状态取自真实截图**：地址栏 `https://chat.deepseek.com/`、标签页 `DeepSeek - 探索未至之境`、底栏 `v0.2.10 · 内置 Chromium / 最后更新 11-05 19:19` 均取自 `screenshots/01-start.jpg` / `02-browse.jpg`，仅用于让素材与真实界面同版本、同一状态。
8. **无光标、无窗口圆角/投影**：历史页是矩形面板内容（便于在视频里嵌入设备框）；菜单不含鼠标指针，方便单独做光标动画。
9. **历史页未展示空状态、加载中、存储异常提示、清空确认条**（源码中存在，但宣传片不需要）；清空入口为头部「清空全部」按钮本身。

## 五、在宣传片里的用法建议

- `ui-history.png` 按 1504×1129 CSS 直接放进面板位置；如需历史页出现在现有工具栏/标签页下方（沿用 01/02 的 chrome），用 `ui-history-view.png`（1504×1029 CSS，面板内 y=74 起）。
- `ui-context-menu.png` 叠在浏览画面上：透明度保留，直接按 258×527 CSS 摆位；阴影已包含在 PNG 里。
- 逐项高亮动画用 `menu.html`：元素是独立 DOM，改 class `.is-hot` 即可逐项切换；背景透明，可 `element screenshot` 或录屏裁切；`#dbp-ctx-menu` 为菜单本体，尺寸与真实 DSH 菜单一致（196×465 CSS）。
- 需要改示例数据时直接编辑 `ui-history.html` 后重新执行第二节命令即可，字体/尺寸/DPR 不变。
