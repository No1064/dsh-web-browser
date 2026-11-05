/**
 * Client half of the Browser bundle.
 *
 * Left-top sidebar panel icon ("浏览器") + a main-column panel keyed `browser`.
 * On Desktop, pages render in a leased Electron <webview> (same bridge the shipped
 * right-Sidebar Browser uses). On Web (no preload), a sandboxed iframe is the fallback.
 */
window.__ModuleLoader__.load({
  id: 'dsh-web-browser',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const PANEL_ID = 'browser'
    const NS = 'dsh-web-browser'
    const WORKSPACE_KEY = 'panel-browser'
    const STORAGE_KEY = 'dsh-web-browser:state:v1'
    const MAX_LIVE_GUESTS = 4
    // Injected by scripts/build.mjs (package.json version + build timestamp).
    const PLUGIN_VERSION = '__DSH_BROWSER_VERSION__'
    const PLUGIN_UPDATED_AT = '__DSH_BROWSER_UPDATED_AT__'
    // The host app runs with Electron's default UA, which contains "electron".
    // Several sites (e.g. chat.deepseek.com) flag that as an abnormal environment.
    // Present a stock desktop Chrome UA to the guest instead.
    const DESKTOP_CHROME_UA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.130 Safari/537.36'
    // Official DeepSeek whale mark (viewBox 23.16 x 17.04, fill = currentColor).
    const DEEPSEEK_FISH_PATH =
      'M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z'
    const DEEPSEEK_WORD_PATHS = [
      'M68.416 18.2447H67.0501V16.1272H68.416C69.2619 16.1272 70.1166 15.9163 70.6671 15.3304C71.2181 14.7444 71.426 13.8455 71.426 12.9471C71.426 12.0487 71.2268 11.1498 70.6671 10.5643C70.1083 9.97831 69.2619 9.76744 68.416 9.76744C67.5701 9.76744 66.7154 9.97831 66.1639 10.5643C65.6129 11.1503 65.4049 12.0487 65.4049 12.9471V21.6435H63.009V7.6582H65.4049V8.54883H65.8442C65.8918 8.49393 65.9394 8.44728 65.9875 8.40064C66.5871 7.85353 67.5049 7.6582 68.4072 7.6582C69.8212 7.6582 71.2341 8.00998 72.1607 8.98662C73.0868 9.96325 73.4143 11.4632 73.4143 12.9558C73.4143 14.4485 73.0785 15.9406 72.1607 16.925C71.2424 17.9094 69.8212 18.2457 68.416 18.2457V18.2447Z',
      'M31.9551 8.03497H33.3204V10.1525H31.9551C31.1087 10.1525 30.2545 10.3633 29.7035 10.9493C29.1525 11.5353 28.945 12.4342 28.945 13.3326C28.945 14.231 29.1447 15.1294 29.7035 15.7154C30.2623 16.3014 31.1087 16.5122 31.9551 16.5122C32.8015 16.5122 33.6562 16.3014 34.2072 15.7154C34.7582 15.1294 34.9657 14.231 34.9657 13.3326V4.62842H37.3611V18.6219H34.9657V17.7313H34.5264C34.4783 17.7857 34.4307 17.8329 34.3826 17.8795C33.7835 18.4261 32.8652 18.6219 31.9629 18.6219C30.5494 18.6219 29.136 18.2707 28.2099 17.294C27.2838 16.3174 26.9563 14.817 26.9563 13.3248C26.9563 11.8327 27.2916 10.34 28.2099 9.35561C29.136 8.37898 30.5494 8.03497 31.9551 8.03497Z',
      'M49.3786 13.1431V13.9948H42.9984V12.2996H47.2305C47.1348 11.6825 46.9113 11.1043 46.5119 10.682C45.9371 10.0727 45.0503 9.85409 44.1723 9.85409C43.2943 9.85409 42.4076 10.0727 41.8328 10.682C41.258 11.2913 41.05 12.2213 41.05 13.1435C41.05 14.0658 41.2575 15.003 41.8328 15.6046C42.4076 16.2061 43.2939 16.433 44.1723 16.433C45.0508 16.433 45.9371 16.2143 46.5119 15.6046C46.5916 15.5186 46.6635 15.4248 46.7354 15.331H49.0992C48.8918 16.0657 48.5643 16.7299 48.0691 17.2454C47.111 18.2531 45.6339 18.6205 44.1723 18.6205C42.7108 18.6205 41.2337 18.2609 40.2755 17.2454C39.3174 16.2299 38.9661 14.6828 38.9661 13.1435C38.9661 11.6043 39.3096 10.0494 40.2755 9.04168C41.242 8.03396 42.7108 7.66663 44.1723 7.66663C45.6339 7.66663 47.111 8.02618 48.0691 9.04168C49.0351 10.0572 49.3786 11.6043 49.3786 13.1435V13.1431Z',
      'M61.4045 13.1431V13.9948H55.0243V12.2996H59.2564C59.1602 11.6825 58.9372 11.1043 58.5378 10.682C57.963 10.0727 57.0762 9.85409 56.1982 9.85409C55.3202 9.85409 54.4335 10.0727 53.8587 10.682C53.2839 11.2913 53.0759 12.2213 53.0759 13.1435C53.0759 14.0658 53.2834 15.003 53.8587 15.6046C54.4335 16.2061 55.3202 16.433 56.1982 16.433C57.0762 16.433 57.963 16.2143 58.5378 15.6046C58.6179 15.5186 58.6894 15.4248 58.7608 15.331H61.1251C60.9171 16.0657 60.5897 16.7299 60.0945 17.2454C59.1364 18.2531 57.6593 18.6205 56.1982 18.6205C54.7372 18.6205 53.2596 18.2609 52.3014 17.2454C51.3432 16.2299 50.9919 14.6828 50.9919 13.1435C50.9919 11.6043 51.3355 10.0494 52.3014 9.04168C53.2678 8.03396 54.7367 7.66663 56.1982 7.66663C57.6598 7.66663 59.1364 8.02618 60.0945 9.04168C61.061 10.0572 61.4045 11.6043 61.4045 13.1435V13.1431Z',
      'M80.242 18.6214C81.7035 18.6214 83.1801 18.4105 84.1383 17.809C85.0965 17.2075 85.4482 16.2931 85.4482 15.3869C85.4482 14.4807 85.1042 13.5585 84.1383 12.9647C83.1801 12.371 81.703 12.1518 80.242 12.1518C79.6186 12.1518 79.0438 12.0658 78.6366 11.8394C78.2294 11.6047 78.0778 11.2534 78.0778 10.9017C78.0778 10.5499 78.2216 10.1908 78.6366 9.9639C79.0438 9.72921 79.6749 9.65147 80.2973 9.65147C80.9198 9.65147 81.5509 9.73747 81.9591 9.9639C82.3663 10.1986 82.5179 10.5499 82.5179 10.9017H84.9531C84.9531 9.99499 84.6421 9.07327 83.7719 8.47951C82.9017 7.88576 81.5679 7.66663 80.2424 7.66663C78.9169 7.66663 77.5837 7.8775 76.713 8.47951C75.8427 9.08104 75.5308 9.99499 75.5308 10.9017C75.5308 11.8083 75.8423 12.73 76.713 13.3238C77.5832 13.9176 78.9165 14.1367 80.2424 14.1367C80.929 14.1367 81.688 14.2227 82.1428 14.4491C82.5985 14.676 82.7579 15.0351 82.7579 15.3869C82.7579 15.7387 82.5985 16.0977 82.1428 16.3246C81.688 16.5511 80.9931 16.6371 80.3066 16.6371C79.62 16.6371 78.9169 16.5511 78.4694 16.3246C78.0224 16.0982 77.8543 15.7387 77.8543 15.3869H75.0435C75.0435 16.2935 75.3865 17.2153 76.3534 17.809C77.3194 18.4028 78.7809 18.6214 80.2424 18.6214H80.242Z',
      'M97.4733 13.1431V13.9948H91.0932V12.2996H95.3252C95.23 11.6825 95.006 11.1043 94.6071 10.682C94.0313 10.0727 93.1456 9.85409 92.2666 9.85409C91.3876 9.85409 90.5018 10.0727 89.927 10.682C89.3522 11.2913 89.1452 12.2213 89.1452 13.1435C89.1452 14.0658 89.3522 15.003 89.927 15.6046C90.5018 16.2061 91.3886 16.433 92.2666 16.433C93.1446 16.433 94.0313 16.2143 94.6071 15.6046C94.6863 15.5186 94.7587 15.4248 94.8301 15.331H97.1935C96.9855 16.0657 96.6585 16.7299 96.1639 17.2454C95.2057 18.2531 93.7281 18.6205 92.2666 18.6205C90.805 18.6205 89.3284 18.2609 88.3703 17.2454C87.4121 16.2299 87.0613 14.6828 87.0613 13.1435C87.0613 11.6043 87.4043 10.0494 88.3703 9.04168C89.3367 8.03396 90.806 7.66663 92.2666 7.66663C93.7272 7.66663 95.2057 8.02618 96.1639 9.04168C97.1298 10.0572 97.4729 11.6043 97.4729 13.1435L97.4733 13.1431Z',
      'M109.499 13.1431V13.9948H103.119V12.2996H107.351C107.256 11.6825 107.032 11.1043 106.632 10.682C106.057 10.0727 105.172 9.85409 104.293 9.85409C103.414 9.85409 102.528 10.0727 101.953 10.682C101.378 11.2913 101.17 12.2213 101.17 13.1435C101.17 14.0658 101.378 15.003 101.953 15.6046C102.528 16.2061 103.415 16.433 104.293 16.433C105.171 16.433 106.057 16.2143 106.632 15.6046C106.712 15.5186 106.784 15.4248 106.856 15.331H109.22C109.012 16.0657 108.685 16.7299 108.19 17.2454C107.231 18.2531 105.754 18.6205 104.293 18.6205C102.831 18.6205 101.355 18.2609 100.396 17.2454C99.4382 16.2299 99.0864 14.6828 99.0864 13.1435C99.0864 11.6043 99.4295 10.0494 100.396 9.04168C101.362 8.03396 102.832 7.66663 104.293 7.66663C105.754 7.66663 107.231 8.02618 108.19 9.04168C109.156 10.0572 109.499 11.6043 109.499 13.1435V13.1431Z',
      'M113.5 4.62817H111.104V18.6217H113.5V4.62817Z',
      'M117.589 12.8154L121.517 18.6208H118.554L114.625 12.8154L118.554 8.15088H121.517L117.589 12.8154Z'
    ]

    const COPY = {
      zh: {
        panel: '浏览器',
        back: '后退',
        forward: '前进',
        reload: '刷新',
        stop: '停止加载',
        address: '输入网址或搜索内容',
        go: '前往',
        openExternal: '用 Chrome 打开',
        newTab: '新标签页',
        closeTab: '关闭标签页',
        startTitle: '浏览器',
        startHint: '输入网址开始浏览，或从下面选一个常用站点',
        startFooter: '在系统 Chrome 中打开当前页：点工具栏的「用 Chrome 打开」。',
        errorTitle: '页面加载失败',
        retry: '重试',
        unsupported: '只支持 http/https 地址',
        invalid: '无法识别的地址',
        blocked: '无法打开该地址',
        notice: '当前环境使用 iframe 呈现页面。',
        engineBuiltin: '内置 Chromium',
        engineWeb: 'iframe',
        openWithChrome: '在本地 Chrome 中打开',
        updatedAt: '最后更新',
        update: '更新',
        updateHint: '重新加载页面以载入最新插件代码',
        loading: '加载中',
      },
      en: {
        panel: 'Browser',
        back: 'Back',
        forward: 'Forward',
        reload: 'Reload',
        stop: 'Stop loading',
        address: 'Enter a URL or search',
        go: 'Go',
        openExternal: 'Open in Chrome',
        newTab: 'New tab',
        closeTab: 'Close tab',
        startTitle: 'Browser',
        startHint: 'Enter a URL to start browsing, or pick a quick link below.',
        startFooter: 'To open the current page in your system Chrome, use "Open in Chrome" in the toolbar.',
        errorTitle: 'Page failed to load',
        retry: 'Retry',
        unsupported: 'Only http/https addresses are supported',
        invalid: 'Unrecognized address',
        blocked: 'Cannot open that address',
        notice: 'Pages are rendered in an iframe in this environment.',
        engineBuiltin: 'Built-in Chromium',
        engineWeb: 'iframe',
        openWithChrome: 'Open in local Chrome',
        updatedAt: 'Updated',
        update: 'Update',
        updateHint: 'Reload the page to load the latest plugin code',
        loading: 'Loading',
      },
    }

    // ---------------------------------------------------------------------------
    // Feature extension points. src/features/*.js are concatenated inside this
    // factory body by scripts/build.mjs. Keep these names stable.
    // ---------------------------------------------------------------------------
    const featureCss = []
    const featureToolbarExtras = []
    const featureStartSections = []
    const featureOverlays = []
    const featureViews = Object.create(null)
    const featureGuestHooks = []
    let featureQuickLinksRenderer = null
    let featureNewTabProvider = null
    let featureStartBackground = null
    let appLocaleId = 'zh'
    function featureText(zh, en) {
      return String(appLocaleId || '').toLowerCase().startsWith('zh') ? zh : en
    }

    const QUICK_LINKS = [
      { label: '百度', url: 'https://www.baidu.com/' },
      { label: '知乎', url: 'https://www.zhihu.com/' },
      { label: 'GitHub', url: 'https://github.com/' },
      { label: '维基百科', url: 'https://zh.wikipedia.org/' },
      { label: '必应', url: 'https://www.bing.com/' },
    ]

    const CSS = [
      '.dbp-root{position:relative;box-sizing:border-box;display:flex;flex-direction:column;flex:auto;align-self:stretch;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.4}',
      // macOS only: when the sidebar is collapsed the shell floats its nav buttons over the top-left of the center column; reserve the titlebar clearance only then.
      // macOS: when the sidebar is collapsed the shell floats its nav buttons over
      // the top-left of the center column. Reserve horizontal space in the toolbar
      // instead of a full-width top blank; +4px height clears their bottom edge.
      'html[data-platform=darwin] [data-sidebar-collapsed] .dbp-toolbar{padding-left:var(--dsh-frame-leading-clearance,0px);height:44px}',
      '.dbp-toolbar{display:flex;align-items:center;gap:4px;flex:none;height:40px;padding:0 8px;border-bottom:.5px solid var(--dsw-alias-border-l1)}',
      '.dbp-tool{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dbp-tool:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)}',
      '.dbp-tool:disabled{color:var(--dsw-alias-state-idle-primary);cursor:default}',
      '.dbp-addressWrap{display:flex;align-items:center;flex:auto;min-width:0;height:28px;padding:0 4px 0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1)}',
      '.dbp-addressWrap:focus-within{border-color:var(--dsw-alias-brand-primary)}',
      '.dbp-address{flex:auto;min-width:0;height:100%;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px}',
      '.dbp-address::placeholder{color:var(--dsw-alias-label-secondary)}',
      '.dbp-go{flex:none;height:22px;padding:0 8px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-brand-primary);font-size:12px;cursor:pointer}',
      '.dbp-go:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent)}',
      '.dbp-external{flex:none;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer;white-space:nowrap}',
      '.dbp-external:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)}',
      '.dbp-tabs{display:flex;align-items:stretch;gap:2px;flex:none;height:34px;padding:3px 8px 0;border-bottom:.5px solid var(--dsw-alias-border-l1);overflow-x:auto;overflow-y:hidden}',
      '.dbp-tab{display:inline-flex;align-items:center;gap:6px;flex:none;max-width:220px;min-width:120px;height:30px;padding:0 6px 0 11px;border:0;border-radius:7px 7px 0 0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer}',
      '.dbp-tab:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent)}',
      '.dbp-tab[data-active="true"]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.dbp-tabTitle{flex:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}',
      '.dbp-tabClose{display:inline-flex;align-items:center;justify-content:center;flex:none;width:18px;height:18px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dbp-tabClose:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent)}',
      '.dbp-tabAdd{display:inline-flex;align-items:center;justify-content:center;flex:none;width:26px;height:26px;margin-top:2px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dbp-tabAdd:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)}',
      '.dbp-viewportStack{position:relative;display:flex;flex:auto;min-height:0;min-width:0}',
      '.dbp-viewport{display:flex;position:absolute;inset:0;min-width:0;min-height:0}',
      '.dbp-webview{display:flex;flex:auto;width:100%;height:100%;border:0;background:var(--dsw-alias-bg-base)}',
      '.dbp-frame{display:flex;flex:auto;width:100%;height:100%;border:0;background:var(--dsw-alias-bg-base)}',
      '.dbp-loadingBar{position:absolute;left:0;right:0;top:0;height:2px;overflow:hidden;pointer-events:none;opacity:0;transition:opacity .15s ease}',
      '.dbp-loadingBar[data-on="true"]{opacity:1}',
      '.dbp-loadingBar::after{content:"";position:absolute;top:0;left:-35%;width:35%;height:100%;background:var(--dsw-alias-brand-primary);animation:dbpSlide 1.1s ease-in-out infinite}',
      '@keyframes dbpSlide{0%{left:-35%}100%{left:100%}}',
      '.dbp-start{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:32px;text-align:center;overflow:auto;background:radial-gradient(900px 420px at 50% -10%, color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent), transparent 70%), radial-gradient(700px 360px at 88% 110%, color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent), transparent 70%), var(--dsw-alias-bg-base)}',
      '.dbp-startTitle{display:flex;align-items:center;gap:10px;color:var(--dsw-alias-label-primary)}',
      '.dbp-brand{display:inline-flex;align-items:center;gap:6px}',
      '.dbp-brandBadge{display:inline-flex;align-items:center;height:21px;padding:0 8px;border-radius:4px;background:var(--dsw-static-deepseek-500);color:#fff;font-size:10px;font-weight:700;letter-spacing:.02em;line-height:1}',
      '.dbp-startHint{max-width:560px;color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:500}',
      '.dbp-links{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:480px}',
      '.dbp-featureLinks{width:100%;display:flex;flex-direction:column;align-items:center}',
      '.dbp-link{display:inline-flex;align-items:center;height:30px;padding:0 13px;border:.5px solid var(--dsw-alias-border-l2);border-radius:15px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}',
      '.dbp-link:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.dbp-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:32px;text-align:center;background:var(--dsw-alias-bg-base)}',
      '.dbp-errorTitle{color:var(--dsw-alias-state-error-primary);font-size:14px;font-weight:600}',
      '.dbp-errorMsg{max-width:520px;color:var(--dsw-alias-label-secondary);font-size:12px;word-break:break-word}',
      '.dbp-actions{display:flex;gap:8px;margin-top:4px}',
      '.dbp-btn{display:inline-flex;align-items:center;height:28px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}',
      '.dbp-btn:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)}',
      '.dbp-notice{flex:none;display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:.5px solid var(--dsw-alias-border-l1);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);color:var(--dsw-alias-label-secondary);font-size:11px}',
      '.dbp-footer{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;flex:none;height:26px;padding:0 10px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:11px}',
      '.dbp-footerLeft{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;white-space:nowrap}',
      '.dbp-footerDot{opacity:.6}',
      '.dbp-footerCenter{justify-self:center;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}',
      '.dbp-footerRight{display:flex;align-items:center;gap:8px;min-width:0;justify-self:end;white-space:nowrap}',
      '.dbp-footerUpdated{white-space:nowrap}',
      '.dbp-footerUpdate{padding:0 4px;border:0;background:transparent;color:var(--dsw-alias-brand-primary);font-size:11px;font-family:inherit;cursor:pointer}',
      '.dbp-footerUpdate:hover{text-decoration:underline}',
      '.dbp-featureView{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);z-index:8}',
    ].join('\n')

    function icon(kind) {
      const common = {
        width: 15,
        height: 15,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        style: { display: 'block', pointerEvents: 'none' },
      }
      if (kind === 'back') return h('svg', common, h('path', { d: 'M15 5 8 12l7 7' }))
      if (kind === 'forward') return h('svg', common, h('path', { d: 'm9 5 7 7-7 7' }))
      if (kind === 'reload') {
        return h('svg', common, [
          h('path', { key: 'a', d: 'M20 12a8 8 0 1 1-2.6-5.9' }),
          h('path', { key: 'b', d: 'M20 4v5h-5' }),
        ])
      }
      if (kind === 'stop') return h('svg', common, h('path', { d: 'M6 6h12v12H6z' }))
      if (kind === 'external') {
        return h('svg', common, [
          h('path', { key: 'a', d: 'M14 4h6v6' }),
          h('path', { key: 'b', d: 'M20 4 10 14' }),
          h('path', { key: 'c', d: 'M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5' }),
        ])
      }
      if (kind === 'plus') return h('svg', common, [h('path', { key: 'a', d: 'M12 5v14' }), h('path', { key: 'b', d: 'M5 12h14' })])
      if (kind === 'close') return h('svg', common, [h('path', { key: 'a', d: 'm6 6 12 12' }), h('path', { key: 'b', d: 'm18 6-12 12' })])
      return null
    }

    function BrowserIcon({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 18
      return h(
        'svg',
        {
          width: edge,
          height: edge,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block', pointerEvents: 'none' },
        },
        [
          h('rect', { key: 'r', x: 2.5, y: 3.5, width: 19, height: 17, rx: 3.2 }),
          h('path', { key: 'l', d: 'M2.5 8.2h19' }),
          h('circle', { key: 'c', cx: 12, cy: 14.4, r: 3.4 }),
          h('path', { key: 'h', d: 'M8.6 14.4h6.8' }),
          h('path', { key: 'm1', d: 'M12 11c-1.4 2.2-1.4 4.6 0 6.8' }),
          h('path', { key: 'm2', d: 'M12 11c1.4 2.2 1.4 4.6 0 6.8' }),
        ]
      )
    }

    function newTabId() {
      return 'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
    }

    function blankTab() {
      return { id: newTabId(), url: '', title: '', loading: false, error: '' }
    }

    function loadPersisted() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null
        const tabs = parsed.tabs
          .filter((tab) => tab && typeof tab.id === 'string')
          .map((tab) => ({
            id: tab.id,
            url: typeof tab.url === 'string' ? tab.url : '',
            title: typeof tab.title === 'string' ? tab.title : '',
            loading: false,
            error: '',
          }))
        if (tabs.length === 0) return null
        const activeId = tabs.some((tab) => tab.id === parsed.activeId) ? parsed.activeId : tabs[0].id
        return { tabs, activeId }
      } catch (error) {
        return null
      }
    }

    function savePersisted(state) {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            activeId: state.activeId,
            tabs: state.tabs.map((tab) => ({ id: tab.id, url: tab.url, title: tab.title })),
          })
        )
      } catch (error) {
        /* storage may be unavailable; browsing still works */
      }
    }

    function resolveAddress(input, t) {
      const raw = String(input == null ? '' : input).trim()
      if (!raw) return ''
      if (/^https?:\/\//i.test(raw)) return raw
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) throw new Error(t('unsupported'))
      if (/^[\w-]+(\.[\w-]+)+([/:?#].*)?$/.test(raw) || /^localhost(:\d+)?([/?#].*)?$/i.test(raw)) {
        return 'https://' + raw
      }
      const query = encodeURIComponent(raw)
      const chinese =
        String(appLocaleId || '').toLowerCase().startsWith('zh') ||
        String(navigator.language || '').toLowerCase().startsWith('zh')
      return chinese ? 'https://www.baidu.com/s?wd=' + query : 'https://www.bing.com/search?q=' + query
    }

    function formatUpdatedShort(value) {
      try {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return ''
        const pad = (number) => String(number).padStart(2, '0')
        return pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
      } catch (error) {
        return ''
      }
    }

    function formatUpdatedFull(value) {
      try {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return ''
        return date.toLocaleString()
      } catch (error) {
        return ''
      }
    }

    function reloadBrowserPage() {
      try {
        window.location.reload()
      } catch (error) {
        /* reload may be blocked; the user can refresh manually */
      }
    }

    function createEngine(bridge, callbacks) {
      const guests = new Map()
      const pending = new Map()
      let disposed = false
      let tick = 0

      function has(tabId) {
        return guests.has(tabId)
      }

      function hasPending(tabId) {
        return pending.has(tabId)
      }

      function destroy(tabId) {
        const guest = guests.get(tabId)
        if (!guest) return
        guests.delete(tabId)
        try {
          if (typeof guest.off === 'function') guest.off()
        } catch (error) {
          /* ignore */
        }
        try {
          guest.el.remove()
        } catch (error) {
          /* ignore */
        }
        Promise.resolve()
          .then(() => bridge.release(guest.lease))
          .catch(() => undefined)
      }

      function destroyAll() {
        disposed = true
        for (const tabId of Array.from(guests.keys())) destroy(tabId)
        pending.clear()
      }

      function prune() {
        while (guests.size > MAX_LIVE_GUESTS) {
          const activeId = callbacks.activeId()
          let victimId = null
          let victim = null
          for (const [tabId, guest] of guests) {
            if (tabId === activeId) continue
            if (victim === null || guest.usedAt < victim.usedAt) {
              victim = guest
              victimId = tabId
            }
          }
          if (victimId === null) return
          destroy(victimId)
        }
      }

      async function createGuest(tabId, container, url) {
        if (disposed) return
        if (pending.has(tabId)) {
          pending.get(tabId).url = url
          return
        }
        const slot = { url }
        pending.set(tabId, slot)
        let reservation
        try {
          reservation = await bridge.acquire(WORKSPACE_KEY)
        } catch (error) {
          pending.delete(tabId)
          callbacks.update(tabId, {
            error: (error && error.message) || String(error),
          })
          return
        }
        if (disposed || !slot.url || !container || !container.isConnected) {
          pending.delete(tabId)
          try {
            await bridge.release(reservation.lease)
          } catch (error) {
            /* ignore */
          }
          return
        }
        const element = document.createElement('webview')
        element.className = 'dbp-webview'
        element.setAttribute('name', reservation.lease)
        element.setAttribute('partition', reservation.partition)
        element.setAttribute('allowpopups', '')
        element.setAttribute('data-sidebar-browser-frame', 'webview')
        element.setAttribute('useragent', DESKTOP_CHROME_UA)
        element.setAttribute('src', 'about:blank#' + reservation.lease)
        container.appendChild(element)
        const guest = {
          lease: reservation.lease,
          el: element,
          off: null,
          ready: false,
          pendingUrl: slot.url,
          usedAt: ++tick,
        }
        guests.set(tabId, guest)
        pending.delete(tabId)

        const update = (patch) => {
          if (!disposed && guests.get(tabId) === guest) callbacks.update(tabId, patch)
        }
        element.addEventListener('dom-ready', () => {
          if (disposed || guests.get(tabId) !== guest) return
          guest.ready = true
          try {
            if (typeof element.setUserAgent === 'function') element.setUserAgent(DESKTOP_CHROME_UA)
          } catch (error) {
            /* older Electron: the useragent attribute still covers the first load */
          }
          const next = guest.pendingUrl
          guest.pendingUrl = ''
          if (!next) return
          try {
            element.loadURL(next)
          } catch (error) {
            update({ error: (error && error.message) || String(error) })
          }
        })
        element.addEventListener('did-start-loading', () => update({ loading: true, error: '' }))
        element.addEventListener('did-stop-loading', () => update({ loading: false }))
        element.addEventListener('did-navigate', (event) => update({ url: event.url, loading: false, error: '' }))
        element.addEventListener('did-navigate-in-page', (event) => {
          if (event.isMainFrame) update({ url: event.url })
        })
        element.addEventListener('page-title-updated', (event) => update({ title: event.title || '' }))
        element.addEventListener('did-fail-load', (event) => {
          if (event.errorCode === -3 || event.isMainFrame === false) return
          update({ loading: false, error: event.errorDescription || 'ERR ' + event.errorCode })
        })
        try {
          guest.off = bridge.onOpenRequested(reservation.lease, (url) => callbacks.popup(tabId, url))
        } catch (error) {
          guest.off = null
        }
        prune()
        for (const hook of featureGuestHooks) {
          try {
            hook({
              tabId,
              element,
              getSurface: () => (callbacks.getSurface ? callbacks.getSurface() : undefined),
            })
          } catch (error) {
            /* a broken feature must not break browsing */
          }
        }
      }

      function navigate(tabId, container, url) {
        if (disposed) return
        const guest = guests.get(tabId)
        if (guest) {
          guest.usedAt = ++tick
          if (guest.ready) {
            try {
              guest.el.loadURL(url)
            } catch (error) {
              callbacks.update(tabId, { error: (error && error.message) || String(error) })
            }
          } else {
            guest.pendingUrl = url
          }
          return
        }
        if (pending.has(tabId)) {
          pending.get(tabId).url = url
          return
        }
        void createGuest(tabId, container, url)
      }

      function goBack(tabId) {
        const guest = guests.get(tabId)
        if (guest && guest.ready) {
          try {
            guest.el.goBack()
          } catch (error) {
            /* no history */
          }
        }
      }

      function goForward(tabId) {
        const guest = guests.get(tabId)
        if (guest && guest.ready) {
          try {
            guest.el.goForward()
          } catch (error) {
            /* no history */
          }
        }
      }

      function reload(tabId) {
        const guest = guests.get(tabId)
        if (guest && guest.ready) {
          try {
            guest.el.reload()
          } catch (error) {
            /* ignore */
          }
        }
      }

      function stop(tabId) {
        const guest = guests.get(tabId)
        if (guest && guest.ready) {
          try {
            guest.el.stop()
          } catch (error) {
            /* ignore */
          }
        }
      }

      return { has, hasPending, navigate, destroy, destroyAll, goBack, goForward, reload, stop }
    }

    function BrowserPage({ t }) {
      const translate = typeof t === 'function' ? t : (key) => key
      const initial = React.useMemo(() => loadPersisted() || { tabs: [blankTab()], activeId: null }, [])
      const [state, setState] = React.useState(() => {
        const tabs = initial.tabs
        const activeId = initial.activeId || tabs[0].id
        return { tabs, activeId }
      })
      const [address, setAddress] = React.useState('')
      const [reloadKey, setReloadKey] = React.useState(0)
      const [view, setView] = React.useState(null)

      const stateRef = React.useRef(state)
      stateRef.current = state
      const containers = React.useRef(new Map())
      const addressRef = React.useRef(null)
      const addressFocused = React.useRef(false)
      const handlersRef = React.useRef({})

      const bridgeRef = React.useRef(
        (() => {
          const carrier = typeof window === 'undefined' ? undefined : window.dshDesktop
          return carrier && carrier.protocolVersion === 1 && carrier.browser ? carrier.browser : undefined
        })()
      )
      const engineRef = React.useRef(null)

      if (engineRef.current === null && bridgeRef.current) {
        engineRef.current = createEngine(bridgeRef.current, {
          update: (tabId, patch) => handlersRef.current.update(tabId, patch),
          popup: (tabId, url) => handlersRef.current.popup(tabId, url),
          activeId: () => stateRef.current.activeId,
          getSurface: () => handlersRef.current.surface,
        })
      }

      function updateTab(tabId, patch) {
        setState((prev) => {
          let changed = false
          const tabs = prev.tabs.map((tab) => {
            if (tab.id !== tabId) return tab
            changed = true
            return Object.assign({}, tab, patch)
          })
          return changed ? { tabs, activeId: prev.activeId } : prev
        })
      }

      function addTab(url) {
        let target = url || ''
        if (!target && typeof featureNewTabProvider === 'function') {
          try {
            target = featureNewTabProvider() || ''
          } catch (error) {
            target = ''
          }
        }
        const tab = Object.assign(blankTab(), target ? { url: target, loading: true } : {})
        setState((prev) => ({ tabs: prev.tabs.concat([tab]), activeId: tab.id }))
        window.setTimeout(() => {
          if (addressRef.current) addressRef.current.focus()
        }, 0)
      }

      function popupTab(parentTabId, url) {
        if (!url) return
        const tab = Object.assign(blankTab(), { url, loading: true })
        setState((prev) => ({ tabs: prev.tabs.concat([tab]), activeId: tab.id }))
      }

      handlersRef.current.update = updateTab
      handlersRef.current.popup = popupTab

      const activeTab = state.tabs.find((tab) => tab.id === state.activeId) || state.tabs[0]

      React.useEffect(() => {
        savePersisted(state)
      }, [state])

      React.useEffect(() => {
        if (!addressFocused.current) setAddress(activeTab ? activeTab.url : '')
      }, [state.activeId, activeTab && activeTab.url])

      React.useEffect(() => {
        if (!activeTab || !activeTab.url) return
        const container = containers.current.get(activeTab.id)
        if (!container) return
        const engine = engineRef.current
        if (!engine) return
        if (!engine.has(activeTab.id) && !engine.hasPending(activeTab.id)) {
          engine.navigate(activeTab.id, container, activeTab.url)
        }
      }, [state.tabs, state.activeId])

      React.useEffect(() => {
        return () => {
          if (engineRef.current) engineRef.current.destroyAll()
        }
      }, [])

      function registerContainer(tabId, element) {
        if (element) containers.current.set(tabId, element)
        else containers.current.delete(tabId)
      }

      function openUrl(url) {
        if (!activeTab) return
        let normalized
        try {
          normalized = resolveAddress(url, translate)
        } catch (error) {
          updateTab(activeTab.id, { error: (error && error.message) || translate('invalid') })
          return
        }
        if (!normalized) return
        updateTab(activeTab.id, { url: normalized, title: '', loading: true, error: '' })
        setAddress(normalized)
        addressFocused.current = false
        const container = containers.current.get(activeTab.id)
        const engine = engineRef.current
        if (engine && container) engine.navigate(activeTab.id, container, normalized)
      }

      function submitAddress(event) {
        if (event) event.preventDefault()
        openUrl(address)
        if (addressRef.current) addressRef.current.blur()
      }

      function openExternal() {
        const url = activeTab && activeTab.url ? activeTab.url : address
        if (!url) return
        try {
          window.open(url, '_blank', 'noopener,noreferrer')
        } catch (error) {
          /* main process may deny; nothing else to do */
        }
      }

      function closeTab(tabId) {
        const engine = engineRef.current
        if (engine) engine.destroy(tabId)
        setState((prev) => {
          const tab = prev.tabs.find((item) => item.id === tabId)
          const rest = prev.tabs.filter((item) => item.id !== tabId)
          if (rest.length === 0) {
            const fresh = blankTab()
            return { tabs: [fresh], activeId: fresh.id }
          }
          let activeId = prev.activeId
          if (tabId === prev.activeId) {
            const index = Math.max(0, prev.tabs.findIndex((item) => item.id === tabId) - 1)
            activeId = rest[Math.min(index, rest.length - 1)].id
          }
          return { tabs: rest, activeId }
        })
      }

      function selectTab(tabId) {
        setState((prev) => ({ tabs: prev.tabs, activeId: tabId }))
      }

      function reloadActive() {
        if (!activeTab) return
        const engine = engineRef.current
        if (engine) {
          engine.reload(activeTab.id)
        } else {
          setReloadKey((value) => value + 1)
        }
      }

      function stopActive() {
        if (engineRef.current && activeTab) engineRef.current.stop(activeTab.id)
      }

      function go(direction) {
        if (!engineRef.current || !activeTab) return
        if (direction < 0) engineRef.current.goBack(activeTab.id)
        else engineRef.current.goForward(activeTab.id)
      }

      function retry() {
        if (!activeTab) return
        updateTab(activeTab.id, { error: '', loading: true })
        const container = containers.current.get(activeTab.id)
        const engine = engineRef.current
        if (engine && container && activeTab.url) engine.navigate(activeTab.id, container, activeTab.url)
        else setReloadKey((value) => value + 1)
      }

      const surface = {
        t: translate,
        tabs: state.tabs,
        activeTab,
        activeId: state.activeId,
        address,
        setAddress,
        openUrl,
        openExternal,
        addTab,
        closeTab,
        selectTab,
        updateTab,
        view,
        setView,
        builtin: !!engineRef.current,
        engine: engineRef.current,
        bridge: bridgeRef.current,
      }
      handlersRef.current.surface = surface

      const builtin = !!engineRef.current
      const currentUrl = activeTab ? activeTab.url : ''

      return h(
        'div',
        { className: 'dbp-root' },
        [
          h('style', { key: 'style' }, CSS + '\n' + featureCss.join('\n')),
          h(
            'div',
            { key: 'toolbar', className: 'dbp-toolbar' },
            [
              h('button', {
                key: 'back',
                type: 'button',
                className: 'dbp-tool',
                title: translate('back'),
                'aria-label': translate('back'),
                onClick: () => go(-1),
                disabled: !builtin,
              }, icon('back')),
              h('button', {
                key: 'forward',
                type: 'button',
                className: 'dbp-tool',
                title: translate('forward'),
                'aria-label': translate('forward'),
                onClick: () => go(1),
                disabled: !builtin,
              }, icon('forward')),
              h('button', {
                key: 'reload',
                type: 'button',
                className: 'dbp-tool',
                title: activeTab && activeTab.loading ? translate('stop') : translate('reload'),
                'aria-label': activeTab && activeTab.loading ? translate('stop') : translate('reload'),
                onClick: activeTab && activeTab.loading ? stopActive : reloadActive,
              }, activeTab && activeTab.loading ? icon('stop') : icon('reload')),
              h('form', {
                key: 'addressForm',
                className: 'dbp-addressWrap',
                onSubmit: submitAddress,
              }, [
                h('input', {
                  key: 'input',
                  ref: addressRef,
                  className: 'dbp-address',
                  type: 'text',
                  value: address,
                  placeholder: translate('address'),
                  spellCheck: false,
                  autoComplete: 'off',
                  onFocus: () => { addressFocused.current = true },
                  onBlur: () => {
                    addressFocused.current = false
                    setAddress(activeTab ? activeTab.url : '')
                  },
                  onChange: (event) => setAddress(event.target.value),
                  'aria-label': translate('address'),
                }),
                h('button', { key: 'go', type: 'submit', className: 'dbp-go' }, translate('go')),
              ]),
              h('button', {
                key: 'external',
                type: 'button',
                className: 'dbp-external',
                title: translate('openWithChrome'),
                onClick: openExternal,
                disabled: !currentUrl && !address,
              }, [icon('external'), h('span', { key: 'label' }, translate('openExternal'))]),
              h('button', {
                key: 'newTab',
                type: 'button',
                className: 'dbp-tool',
                title: translate('newTab'),
                'aria-label': translate('newTab'),
                onClick: () => addTab(''),
              }, icon('plus')),
              ...featureToolbarExtras.map((component, index) =>
                h(component, { key: 'feature-tool-' + index, surface })
              ),
            ]
          ),
          h('div', {
            key: 'loadingBar',
            className: 'dbp-loadingBar',
            'data-on': activeTab && activeTab.loading ? 'true' : 'false',
          }),
          h(
            'div',
            { key: 'tabs', className: 'dbp-tabs' },
            state.tabs
              .map((tab) =>
                h(
                  'div',
                  {
                    key: tab.id,
                    className: 'dbp-tab',
                    'data-active': tab.id === activeTab.id ? 'true' : 'false',
                    role: 'tab',
                    tabIndex: 0,
                    title: tab.title || tab.url || translate('newTab'),
                    onClick: () => selectTab(tab.id),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        selectTab(tab.id)
                      }
                    },
                  },
                  [
                    h('span', { key: 'title', className: 'dbp-tabTitle' }, tab.title || tab.url || translate('newTab')),
                    h('button', {
                      key: 'close',
                      type: 'button',
                      className: 'dbp-tabClose',
                      title: translate('closeTab'),
                      'aria-label': translate('closeTab'),
                      onClick: (event) => {
                        event.stopPropagation()
                        closeTab(tab.id)
                      },
                    }, icon('close')),
                  ]
                )
              )
              .concat([
                h('button', {
                  key: 'add',
                  type: 'button',
                  className: 'dbp-tabAdd',
                  title: translate('newTab'),
                  'aria-label': translate('newTab'),
                  onClick: () => addTab(''),
                }, icon('plus')),
              ])
          ),
          !builtin
            ? h('div', { key: 'notice', className: 'dbp-notice' }, translate('notice'))
            : null,
          h(
            'div',
            { key: 'stack', className: 'dbp-viewportStack' },
            [
              ...state.tabs.map((tab) =>
                h('div', {
                  key: 'view-' + tab.id,
                  className: 'dbp-viewport',
                  style: { display: tab.id === activeTab.id ? 'flex' : 'none' },
                  ref: (element) => registerContainer(tab.id, element),
                })
              ),
              !builtin && activeTab
                ? h('iframe', {
                    key: 'frame-' + activeTab.id + '-' + reloadKey,
                    className: 'dbp-frame',
                    src: activeTab.url || 'about:blank',
                    sandbox: 'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox',
                    style: {
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      border: 0,
                      background: 'var(--dsw-alias-bg-base)',
                    },
                    title: activeTab.title || activeTab.url || translate('newTab'),
                  })
                : null,
              activeTab && !activeTab.url && !activeTab.error
                ? h(
                    'div',
                    {
                      key: 'start',
                      className: 'dbp-start',
                      style: typeof featureStartBackground === 'function' ? featureStartBackground() : undefined,
                    },
                    [
                      h('div', { key: 'title', className: 'dbp-startTitle' }, [
                        h('span', { key: 'brand', className: 'dbp-brand' }, [
                          h(
                            'svg',
                            {
                              key: 'fish',
                              width: 36,
                              height: 27,
                              viewBox: '0 0 23.16 17.04',
                              fill: 'none',
                              'aria-hidden': true,
                              style: { display: 'block', flex: 'none' },
                            },
                            h('path', { d: DEEPSEEK_FISH_PATH, fill: 'var(--dsw-static-deepseek-500)' })
                          ),
                          h(
                            'svg',
                            {
                              key: 'word',
                              width: 88,
                              height: 22,
                              viewBox: '26 0 96 24',
                              fill: 'none',
                              'aria-hidden': true,
                              style: { display: 'block', flex: 'none' },
                            },
                            DEEPSEEK_WORD_PATHS.map((d, index) =>
                              h('path', {
                                key: index,
                                d,
                                fill: 'var(--dsw-static-deepseek-500)',
                              })
                            )
                          ),
                          h('span', { key: 'badge', className: 'dbp-brandBadge' }, 'WebBrowser'),
                        ]),
                      ]),
                      h('div', { key: 'hint', className: 'dbp-startHint' }, translate('startHint')),
                      featureQuickLinksRenderer
                        ? h(
                            'div',
                            { key: 'links', className: 'dbp-featureLinks' },
                            h(featureQuickLinksRenderer, { surface })
                          )
                        : h(
                            'div',
                            { key: 'links', className: 'dbp-links' },
                            QUICK_LINKS.map((link) =>
                              h('button', {
                                key: link.url,
                                type: 'button',
                                className: 'dbp-link',
                                onClick: () => openUrl(link.url),
                              }, link.label)
                            )
                          ),
                      ...featureStartSections.map((component, index) =>
                        h(component, { key: 'feature-start-' + index, surface })
                      ),
                    ]
                  )
                : null,
              activeTab && activeTab.error
                ? h(
                    'div',
                    { key: 'error', className: 'dbp-overlay' },
                    [
                      h('div', { key: 'title', className: 'dbp-errorTitle' }, translate('errorTitle')),
                      h('div', { key: 'msg', className: 'dbp-errorMsg' }, activeTab.error),
                      h(
                        'div',
                        { key: 'actions', className: 'dbp-actions' },
                        [
                          h('button', {
                            key: 'retry',
                            type: 'button',
                            className: 'dbp-btn',
                            onClick: retry,
                          }, translate('retry')),
                          h('button', {
                            key: 'external',
                            type: 'button',
                            className: 'dbp-btn',
                            onClick: openExternal,
                          }, translate('openExternal')),
                        ]
                      ),
                    ]
                  )
                : null,
              view && featureViews[view]
                ? h(
                    'div',
                    { key: 'feature-view', className: 'dbp-featureView' },
                    h(featureViews[view], { surface })
                  )
                : null,
            ]
          ),
          h('div', { key: 'footer', className: 'dbp-footer' }, [
            h('div', { key: 'left', className: 'dbp-footerLeft' }, [
              h(
                'span',
                {
                  key: 'version',
                  className: 'dbp-footerVersion',
                  title: featureText('浏览器插件 v', 'Browser plugin v') + PLUGIN_VERSION,
                },
                'v' + PLUGIN_VERSION
              ),
              h('span', { key: 'dot', className: 'dbp-footerDot' }, '·'),
              h('span', { key: 'engine' }, builtin ? translate('engineBuiltin') : translate('engineWeb')),
              activeTab && activeTab.loading ? h('span', { key: 'loading' }, translate('loading')) : null,
            ]),
            h(
              'div',
              {
                key: 'center',
                className: 'dbp-footerCenter',
                title: currentUrl || translate('startFooter'),
              },
              currentUrl || translate('startFooter')
            ),
            h('div', { key: 'right', className: 'dbp-footerRight' }, [
              h(
                'span',
                {
                  key: 'updated',
                  className: 'dbp-footerUpdated',
                  title: formatUpdatedFull(PLUGIN_UPDATED_AT),
                },
                translate('updatedAt') + ' ' + formatUpdatedShort(PLUGIN_UPDATED_AT)
              ),
              h(
                'button',
                {
                  key: 'update',
                  type: 'button',
                  className: 'dbp-footerUpdate',
                  title: translate('updateHint'),
                  onClick: reloadBrowserPage,
                },
                translate('update')
              ),
            ]),
          ]),
          ...featureOverlays.map((component, index) =>
            h(component, { key: 'feature-overlay-' + index, surface })
          ),
        ]
      )
    }

    /* __FEATURES__ */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        try {
          const snapshot = ctx.locale.getLocale()
          const next = snapshot && (snapshot.locale || snapshot.id || snapshot.language)
          if (typeof next === 'string' && next) appLocaleId = next
        } catch (error) {
          /* keep the default locale id */
        }
        ctx.effect(
          () => ctx.locale.register(NS, COPY),
          'browser-panel.copy'
        )
        ctx.effect(
          () =>
            ctx.slots.inject('sidebar.panellist', () =>
              ctx.slots.register(
                {
                  name: 'sidebar.panellist',
                  id: PANEL_ID,
                  order: 15,
                  label: () => t('panel'),
                  locale: NS,
                  registrant: 'dsh-web-browser',
                },
                BrowserIcon
              )
            ),
          'browser-panel.panellist'
        )
        ctx.effect(
          () =>
            ctx.slots.inject('main', () =>
              ctx.slots.register(
                {
                  name: 'main',
                  key: PANEL_ID,
                  locale: NS,
                  registrant: 'dsh-web-browser',
                },
                BrowserPage
              )
            ),
          'browser-panel.main'
        )
      },
    }
  },
})
