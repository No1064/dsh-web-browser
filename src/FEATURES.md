# Feature 文件契约

`client.js` 是构建产物：`scripts/build.mjs` 把 `src/core.js` 与 `src/features/*.js` 按文件名排序拼接，再替换 `src/core.js` 里的 `/* __FEATURES__ */` 标记。

- **只改自己的 feature 文件**，不要改 `src/core.js`、`client.js`、`scripts/build.mjs`、`package.json`。
- Feature 文件是 **普通 JS 片段**，会被拼进 `factory(require) { ... }` 的函数体内部，因此可以直接使用 core 里的 `React`、`h`（`React.createElement`）、常量与注册表。
- 不要写 `import` / `export` / JSX。用 `h()` 构造元素。目标运行环境是 Electron 44 的 Chromium（可用现代 JS，但保持无构建步骤）。
- 类名统一加自己的前缀（如 `dbp-ctx-`、`dbp-bm-`、`dbp-hist-`）；样式通过 `featureCss.push('...')` 注册，构建时会接在 core CSS 后面。
- 文案用 core 提供的 `featureText(zh, en)`（跟随 DSH 当前语言）；不要直接用 `navigator.language`。
- 主题只用 `--dsw-alias-*` / `--dsw-*` token，不要写死颜色（图标/插画除外）。

## Core 提供的扩展点

### 注册表（在 core 中已声明）

```js
const featureCss = []              // push CSS 字符串
const featureToolbarExtras = []    // push 组件：h(Component, { surface })
const featureStartSections = []    // push 组件：h(Component, { surface })，渲染在起始页快捷入口之后
const featureOverlays = []         // push 组件：h(Component, { surface })，渲染在面板根节点末尾（可放 fixed/absolute 弹层）
const featureViews = {}            // featureViews.history = Component；h(Component, { surface }) 覆盖内容区
const featureGuestHooks = []       // push ({ tabId, element, getSurface }) => {}；每个 webview guest 创建后调用
let featureQuickLinksRenderer = null // 设为组件以替代 core 的默认快捷入口
```

所有注册在 feature 文件加载时执行（早于 `apply`）。

### `surface`（渲染时传给 feature 组件）

```js
surface.t                  // core 的 i18n 函数（NS = dsh-web-browser）
surface.tabs               // [{ id, url, title, loading, error }]
surface.activeTab          // 当前标签
surface.activeId           // 当前标签 id
surface.address            // 地址栏当前文本
surface.setAddress(text)
surface.openUrl(url)       // 在当前标签导航（会做地址规范化）
surface.openExternal()     // 用系统浏览器打开当前页
surface.addTab(url)        // 新建标签并激活
surface.closeTab(id)
surface.selectTab(id)
surface.updateTab(id, patch)
surface.view               // 当前 feature view（null = 正常浏览）
surface.setView(nameOrNull)
surface.builtin            // 是否 Desktop 内置引擎（false = iframe 降级）
surface.engine             // 内部 engine 对象（不建议直接使用）
surface.bridge             // dshDesktop.browser（可能 undefined）
```

### Guest hook（右键菜单 / 历史 / favicon 用）

```js
featureGuestHooks.push(({ tabId, element, getSurface }) => {
  element.addEventListener('context-menu', (event) => { /* event: linkURL, selectionText, isEditable, mediaType, srcURL, x, y ... */ })
  element.addEventListener('page-favicon-updated', (event) => { /* event.favicons: string[] */ })
  element.addEventListener('did-navigate', (event) => { /* event.url */ })
})
```

`element` 是 Electron `<webview>`，可用 `copy() / cut() / paste() / selectAll() / goBack() / goForward() / reload() / getURL() / getTitle() / setZoomFactor()`。
guest 被销毁时元素移除，监听器随之回收。

## 构建与校验

```bash
node scripts/build.mjs     # 生成 client.js
node --check client.js     # 语法校验
```

Agent 不要自己运行 build / 安装 / 刷新页面；由 Lead 统一构建、安装、验收。
