    // ---------------------------------------------------------------------------
    // Feature: home page + quick links + pinned sites (50-home-bookmarks.js)
    //
    // Plain JS fragment inlined into the client factory body by
    // scripts/build.mjs — see src/FEATURES.md. It intentionally uses the
    // factory-scope React / h / feature registries and never imports anything.
    //
    // Data model (one global set for every workspace):
    //   { homeUrl: string, newTabMode: 'start' | 'home',
    //     items: [{ id, url, title, favicon, pinned, createdAt }] }
    // Persisted in localStorage under BM_STORAGE_KEY.
    //
    // Registered here:
    //   featureToolbarExtras   -> home / star / settings buttons
    //   featureQuickLinksRenderer -> start-page grids ("已钉" + "常用网址")
    //   featureOverlays        -> settings dialog
    //   featureGuestHooks      -> favicon cache from page-favicon-updated
    //   featureNewTabProvider  -> new tab opens homeUrl when newTabMode === 'home'
    // ---------------------------------------------------------------------------

    const BM_STORAGE_KEY = 'dsh-web-browser:home:v1'
    const BM_MAX_FAVICON_CACHE = 300
    const BM_DEFAULT_LINKS = [
      { url: 'https://www.baidu.com/', zh: '百度', en: 'Baidu' },
      { url: 'https://www.zhihu.com/', zh: '知乎', en: 'Zhihu' },
      { url: 'https://github.com/', zh: 'GitHub', en: 'GitHub' },
      { url: 'https://zh.wikipedia.org/', zh: '维基百科', en: 'Wikipedia' },
      { url: 'https://www.bing.com/', zh: '必应', en: 'Bing' },
    ]

    // Best-effort icons for the seeded shortcuts; a failed load falls back to the
    // hue-tinted letter tile.
    const BM_DEFAULT_FAVICONS = {
      'https://www.baidu.com/': 'https://www.baidu.com/favicon.ico',
      'https://www.zhihu.com/': 'https://www.zhihu.com/favicon.ico',
      'https://github.com/': 'https://github.com/favicon.ico',
      'https://zh.wikipedia.org/': 'https://zh.wikipedia.org/favicon.ico',
      'https://www.bing.com/': 'https://www.bing.com/favicon.ico',
    }

    function bmDefaultFavicon(url) {
      return BM_DEFAULT_FAVICONS[url] || ''
    }

    const BM_DEFAULT_BACKGROUND = { kind: 'default', color: '#eef2ff', image: '' }

    function bmSafeImageUrl(value) {
      const raw = typeof value === 'string' ? value.trim() : ''
      if (!raw) return ''
      if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(raw)) return raw
      if (/^https?:\/\//i.test(raw)) return raw
      return ''
    }

    function bmNormalizeBackground(input) {
      const source = input && typeof input === 'object' ? input : {}
      const kind = source.kind === 'color' || source.kind === 'image' ? source.kind : 'default'
      const color = /^#[0-9a-fA-F]{6}$/.test(String(source.color || ''))
        ? String(source.color)
        : BM_DEFAULT_BACKGROUND.color
      const image = bmSafeImageUrl(source.image)
      return { kind, color, image }
    }

    const BM_HOME_CSS = [
      // toolbar buttons (reuse core .dbp-tool geometry, only add state colour)
      '.dbp-bm-toolPin[data-on="true"]{color:var(--dsw-alias-brand-primary)}',
      // start-page quick links
      '.dbp-bm-quick{display:flex;flex-direction:column;gap:16px;width:100%;max-width:700px;text-align:left}',
      '.dbp-bm-section{display:flex;flex-direction:column;gap:10px}',
      '.dbp-bm-sectionHead{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:18px;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;letter-spacing:.04em}',
      '.dbp-bm-panel{display:flex;flex-direction:column;gap:10px;padding:14px 16px 16px;border:.5px solid var(--dsw-alias-border-l1);border-radius:14px;background:color-mix(in srgb, var(--dsw-alias-bg-layer-1) 78%, transparent);box-shadow:0 1px 2px color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent);backdrop-filter:blur(10px)}',
      '.dbp-bm-panelHead{display:flex;align-items:center;gap:8px;min-height:20px}',
      '.dbp-bm-panelTitle{color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;letter-spacing:.01em}',
      '.dbp-bm-panelCount{color:var(--dsw-alias-label-secondary);font-size:11px}',
      '.dbp-bm-panelAction{margin-left:auto}',
      '.dbp-bm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:2px;max-height:268px;overflow:auto;padding:0}',
      '.dbp-bm-card{position:relative;display:flex;flex-direction:column;min-width:0;border:0;border-radius:10px;background:transparent;overflow:visible;transition:background .12s ease}',
      '.dbp-bm-card:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent)}',
      '.dbp-bm-cardMain{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;padding:10px 6px 9px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font-size:11.5px;cursor:pointer}',
      '.dbp-bm-cardTitle{width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;color:var(--dsw-alias-label-secondary)}',
      '.dbp-bm-card:hover .dbp-bm-cardTitle,.dbp-bm-cardMain:focus-visible .dbp-bm-cardTitle{color:var(--dsw-alias-label-primary)}',
      '.dbp-bm-cardDel{position:absolute;top:4px;right:4px;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:6px;background:color-mix(in srgb, var(--dsw-alias-bg-base) 86%, transparent);color:var(--dsw-alias-label-secondary);opacity:0;cursor:pointer;transition:opacity .12s ease}',
      '.dbp-bm-card:hover .dbp-bm-cardDel,.dbp-bm-cardDel:focus-visible{opacity:1}',
      '.dbp-bm-cardDel:hover{color:var(--dsw-alias-state-error-primary)}',
      '.dbp-bm-fav{display:inline-flex;align-items:center;justify-content:center;flex:none;width:34px;height:34px;border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l1)}',
      '.dbp-bm-fav img{display:block;width:20px;height:20px;border-radius:4px;object-fit:contain}',
      '.dbp-bm-favLetter{display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%;background:transparent;color:var(--dsw-alias-brand-primary);font-size:14px;font-weight:600;letter-spacing:.02em}',
      // Google-style start page: big search pill + circular shortcut tiles
      '.dbp-bm-quick{display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;max-width:760px;text-align:center}',
      '.dbp-bm-search{display:flex;align-items:center;gap:10px;width:min(640px,100%);height:48px;padding:0 8px 0 20px;border:.5px solid var(--dsw-alias-border-l2);border-radius:24px;background:color-mix(in srgb, var(--dsw-alias-bg-layer-1) 94%, transparent);box-shadow:0 2px 12px color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent)}',
      '.dbp-bm-search:focus-within{border-color:var(--dsw-alias-brand-primary);box-shadow:0 2px 14px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent)}',
      '.dbp-bm-searchIcon{display:inline-flex;flex:none;color:var(--dsw-alias-label-secondary)}',
      '.dbp-bm-searchInput{flex:auto;min-width:0;height:100%;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font-size:15px;font-weight:500;font-family:inherit}',
      '.dbp-bm-searchInput::placeholder{color:var(--dsw-alias-label-secondary)}',
      '.dbp-bm-searchGo{flex:none;height:34px;padding:0 16px;border:0;border-radius:17px;background:color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);color:var(--dsw-alias-brand-primary);font-size:13px;font-weight:600;font-family:inherit;cursor:pointer}',
      '.dbp-bm-searchGo:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent)}',
      '.dbp-bm-shortcuts{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;gap:10px 14px;width:100%;max-width:760px}',
      '.dbp-bm-card{width:96px;flex:none;border:0;background:transparent}',
      '.dbp-bm-cardMain{padding:6px 4px;gap:8px}',
      '.dbp-bm-shortcuts .dbp-bm-fav{width:52px;height:52px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 3px color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent), inset 0 0 0 .5px var(--dsw-alias-border-l1)}',
      '.dbp-bm-shortcuts .dbp-bm-fav img{width:26px;height:26px;border-radius:6px}',
      '.dbp-bm-shortcuts .dbp-bm-favLetter{font-size:19px}',
      '.dbp-bm-cardTitle{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}',
      '.dbp-bm-pin{position:absolute;top:2px;right:14px;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 .5px var(--dsw-alias-border-l1)}',
      '.dbp-bm-addTile{display:flex;flex-direction:column;align-items:center;gap:8px;padding:6px 4px;border:0;border-radius:10px;background:transparent;cursor:pointer;font-family:inherit}',
      '.dbp-bm-addTile:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent)}',
      '.dbp-bm-addFav{border:1px dashed var(--dsw-alias-border-l2);background:transparent;box-shadow:none;color:var(--dsw-alias-label-secondary)}',
      '.dbp-bm-meta{display:flex;align-items:center;gap:10px;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500}',
      '.dbp-bm-metaText{white-space:nowrap}',
      '.dbp-bm-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:4px 0;color:var(--dsw-alias-label-secondary);font-size:12px;text-align:center}',
      '.dbp-bm-linkBtn{padding:2px 5px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-brand-primary);font-size:13px;font-weight:500;cursor:pointer}',
      '.dbp-bm-linkBtn:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent)}',
      '.dbp-bm-bgRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dbp-bm-bgRow .dbp-bm-input{flex:auto;min-width:130px}',
      '.dbp-bm-color{flex:none;width:46px;height:28px;padding:2px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);cursor:pointer}',
      '.dbp-bm-file{display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 11px;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;font-family:inherit;white-space:nowrap;cursor:pointer}',
      '.dbp-bm-file:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)}',
      // settings dialog
      '.dbp-bm-overlay{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:24px;background:color-mix(in srgb, var(--dsw-alias-bg-base) 62%, transparent)}',
      '.dbp-bm-dialog{display:flex;flex-direction:column;width:min(560px,100%);max-height:100%;border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}',
      '.dbp-bm-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none;padding:12px 14px;border-bottom:.5px solid var(--dsw-alias-border-l1)}',
      '.dbp-bm-title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}',
      '.dbp-bm-body{display:flex;flex-direction:column;gap:14px;padding:14px;overflow:auto}',
      '.dbp-bm-field{display:flex;flex-direction:column;gap:6px}',
      '.dbp-bm-label{color:var(--dsw-alias-label-secondary);font-size:11px}',
      '.dbp-bm-hint{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}',
      '.dbp-bm-err{color:var(--dsw-alias-state-error-primary);font-size:11px}',
      '.dbp-bm-input{height:28px;min-width:0;padding:0 9px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:12px;outline:0}',
      '.dbp-bm-input:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.dbp-bm-input::placeholder{color:var(--dsw-alias-label-secondary)}',
      '.dbp-bm-list{display:flex;flex-direction:column;gap:6px;max-height:264px;overflow:auto}',
      '.dbp-bm-row{display:flex;align-items:center;gap:8px;min-height:40px;padding:6px 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base)}',
      '.dbp-bm-rowEdit{flex-wrap:wrap}',
      '.dbp-bm-rowText{display:flex;flex-direction:column;flex:auto;min-width:0}',
      '.dbp-bm-rowTitle{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:12px}',
      '.dbp-bm-rowUrl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11px}',
      '.dbp-bm-actions{display:flex;align-items:center;gap:2px;flex:none}',
      '.dbp-bm-mini{display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dbp-bm-mini:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)}',
      '.dbp-bm-mini:disabled{opacity:.35;cursor:default}',
      '.dbp-bm-mini[data-on="true"]{color:var(--dsw-alias-brand-primary)}',
      '.dbp-bm-add{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.dbp-bm-add .dbp-bm-input{flex:auto;min-width:120px}',
      '.dbp-bm-rowEdit .dbp-bm-input{flex:auto;min-width:110px}',
      '.dbp-bm-seg{display:inline-flex;gap:4px;padding:2px;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base)}',
      '.dbp-bm-segBtn{height:24px;padding:0 10px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer}',
      '.dbp-bm-segBtn[data-on="true"]{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);color:var(--dsw-alias-brand-primary)}',
      '.dbp-bm-primary{height:26px;padding:0 10px;border:0;border-radius:6px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-size:12px;cursor:pointer}',
      '.dbp-bm-primary:disabled{opacity:.5;cursor:default}',
      '.dbp-bm-ghost{height:26px;padding:0 9px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer}',
      '.dbp-bm-ghost:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)}',
      '.dbp-bm-foot{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex:none;padding:10px 14px;border-top:.5px solid var(--dsw-alias-border-l1)}',
    ].join('\n')
    featureCss.push(BM_HOME_CSS)

    // ---------------------------------------------------------------------------
    // Small helpers
    // ---------------------------------------------------------------------------

    function bmNewId() {
      return 'bm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
    }

    function bmNormalizeUrl(input) {
      const raw = String(input == null ? '' : input).trim()
      if (!raw) return ''
      const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : 'https://' + raw
      let parsed
      try {
        parsed = new URL(candidate)
      } catch (error) {
        return ''
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
      if (!parsed.hostname) return ''
      return parsed.href
    }

    function bmTitleFromUrl(url) {
      try {
        const parsed = new URL(url)
        const host = parsed.hostname.replace(/^www\./i, '')
        return host || String(url)
      } catch (error) {
        return String(url || '')
      }
    }

    // Hash is dropped for comparison only: pinning `https://x/#a` should still
    // light up the star on `https://x/`.
    function bmCompareKey(value) {
      const normalized = bmNormalizeUrl(value)
      if (!normalized) return ''
      const hashIndex = normalized.indexOf('#')
      return hashIndex >= 0 ? normalized.slice(0, hashIndex) : normalized
    }

    function bmSameUrl(a, b) {
      const left = String(a == null ? '' : a)
      const right = String(b == null ? '' : b)
      if (!left || !right) return false
      if (left === right) return true
      const ka = bmCompareKey(left)
      const kb = bmCompareKey(right)
      return !!ka && ka === kb
    }

    function bmCleanFavicon(value) {
      const raw = typeof value === 'string' ? value.trim() : ''
      if (!raw) return ''
      if (/^data:image\//i.test(raw)) return raw
      if (/^https?:\/\//i.test(raw)) return raw
      return ''
    }

    function bmSeedData() {
      const now = Date.now()
      return {
        homeUrl: '',
        newTabMode: 'start',
        background: bmNormalizeBackground(BM_DEFAULT_BACKGROUND),
        items: BM_DEFAULT_LINKS.map((link, index) => ({
          id: 'bm-seed-' + index,
          url: link.url,
          title: featureText(link.zh, link.en),
          favicon: bmDefaultFavicon(link.url),
          pinned: false,
          createdAt: now + index,
        })),
      }
    }

    function bmLoadData() {
      const fallback = bmSeedData()
      let raw = null
      try {
        raw = window.localStorage.getItem(BM_STORAGE_KEY)
      } catch (error) {
        return fallback
      }
      if (!raw) return fallback
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch (error) {
        return fallback
      }
      if (!parsed || typeof parsed !== 'object') return fallback
      if (!Array.isArray(parsed.items)) return fallback
      const items = []
      const seen = Object.create(null)
      for (const entry of parsed.items) {
        if (!entry || typeof entry !== 'object') continue
        const url = bmNormalizeUrl(entry.url)
        if (!url || seen[url]) continue
        seen[url] = true
        items.push({
          id: typeof entry.id === 'string' && entry.id ? entry.id : bmNewId(),
          url,
          title: typeof entry.title === 'string' ? entry.title : '',
          favicon: bmCleanFavicon(entry.favicon) || bmDefaultFavicon(url),
          pinned: !!entry.pinned,
          createdAt:
            typeof entry.createdAt === 'number' && isFinite(entry.createdAt)
              ? entry.createdAt
              : Date.now(),
        })
      }
      return {
        homeUrl: bmNormalizeUrl(parsed.homeUrl),
        newTabMode: parsed.newTabMode === 'home' ? 'home' : 'start',
        background: bmNormalizeBackground(parsed.background),
        items,
      }
    }

    // ---------------------------------------------------------------------------
    // Store: module-level state + a tiny subscription so every entry point
    // (toolbar, start page, dialog) sees the same data without prop drilling.
    // ---------------------------------------------------------------------------

    let bmData = null
    let bmOpen = false
    let bmSnapshot = null
    const bmSubs = new Set()
    const bmFavicons = new Map()

    function bmGetData() {
      if (bmData === null) bmData = bmLoadData()
      return bmData
    }

    function bmGetSnapshot() {
      if (bmSnapshot === null) bmSnapshot = { data: bmGetData(), open: bmOpen }
      return bmSnapshot
    }

    function bmEmit() {
      bmSnapshot = { data: bmGetData(), open: bmOpen }
      for (const listener of Array.from(bmSubs)) {
        try {
          listener()
        } catch (error) {
          /* a broken subscriber must not break the panel */
        }
      }
    }

    function bmCommit(next) {
      bmData = next
      try {
        window.localStorage.setItem(BM_STORAGE_KEY, JSON.stringify(next))
      } catch (error) {
        /* storage may be unavailable; in-memory state still works */
      }
      bmEmit()
    }

    function bmUseStore() {
      const [snap, setSnap] = React.useState(bmGetSnapshot)
      React.useEffect(() => {
        let live = true
        const sync = () => {
          if (live) setSnap(bmGetSnapshot())
        }
        bmSubs.add(sync)
        sync()
        return () => {
          live = false
          bmSubs.delete(sync)
        }
      }, [])
      return snap
    }

    function bmSetOpen(open) {
      const next = !!open
      if (bmOpen === next) return
      bmOpen = next
      bmEmit()
    }

    function bmFaviconFor(url) {
      const key = bmNormalizeUrl(url)
      return key ? bmFavicons.get(key) || '' : ''
    }

    function bmRememberFavicon(rawUrl, favicon) {
      const url = bmNormalizeUrl(rawUrl)
      const clean = bmCleanFavicon(favicon)
      if (!url || !clean) return
      if (bmFavicons.size > BM_MAX_FAVICON_CACHE) bmFavicons.clear()
      bmFavicons.set(url, clean)
      const data = bmGetData()
      let changed = false
      const items = data.items.map((item) => {
        if (!bmSameUrl(item.url, url)) return item
        if (item.favicon === clean) return item
        changed = true
        return Object.assign({}, item, { favicon: clean })
      })
      if (changed) bmCommit(Object.assign({}, data, { items }))
    }

    function bmFindItemByUrl(items, url) {
      for (const item of items) {
        if (bmSameUrl(item.url, url)) return item
      }
      return null
    }

    // ---------------------------------------------------------------------------
    // Data operations
    // ---------------------------------------------------------------------------

    function bmAddItem(input) {
      const data = bmGetData()
      const url = bmNormalizeUrl(input && input.url)
      if (!url) return 'invalid'
      const existing = bmFindItemByUrl(data.items, url)
      const title = String((input && input.title) || '').trim()
      if (existing) {
        if (title && title !== existing.title) {
          bmCommit(
            Object.assign({}, data, {
              items: data.items.map((item) =>
                item.id === existing.id ? Object.assign({}, item, { title }) : item
              ),
            })
          )
        }
        return 'exists'
      }
      const item = {
        id: bmNewId(),
        url,
        title: title || bmTitleFromUrl(url),
        favicon: bmCleanFavicon(input && input.favicon) || bmFaviconFor(url),
        pinned: !!(input && input.pinned),
        createdAt: Date.now(),
      }
      bmCommit(Object.assign({}, data, { items: [item].concat(data.items) }))
      return 'added'
    }

    function bmRemoveItem(id) {
      const data = bmGetData()
      const items = data.items.filter((item) => item.id !== id)
      if (items.length === data.items.length) return
      bmCommit(Object.assign({}, data, { items }))
    }

    function bmPatchItem(id, patch) {
      const data = bmGetData()
      let changed = false
      const items = data.items.map((item) => {
        if (item.id !== id) return item
        changed = true
        return Object.assign({}, item, patch)
      })
      if (changed) bmCommit(Object.assign({}, data, { items }))
    }

    function bmTogglePinItem(id) {
      const data = bmGetData()
      const target = data.items.find((item) => item.id === id)
      if (!target) return
      bmPatchItem(id, { pinned: !target.pinned })
    }

    function bmMoveItem(id, delta) {
      const data = bmGetData()
      const index = data.items.findIndex((item) => item.id === id)
      if (index < 0) return
      const target = index + delta
      if (target < 0 || target >= data.items.length) return
      const items = data.items.slice()
      const moved = items.splice(index, 1)[0]
      items.splice(target, 0, moved)
      bmCommit(Object.assign({}, data, { items }))
    }

    function bmSetHomeUrl(rawUrl) {
      const data = bmGetData()
      const trimmed = String(rawUrl == null ? '' : rawUrl).trim()
      const homeUrl = trimmed ? bmNormalizeUrl(trimmed) : ''
      if (trimmed && !homeUrl) return false
      if (homeUrl === data.homeUrl) return true
      bmCommit(Object.assign({}, data, { homeUrl }))
      return true
    }

    function bmSetNewTabMode(mode) {
      const data = bmGetData()
      const next = mode === 'home' ? 'home' : 'start'
      if (data.newTabMode === next) return
      bmCommit(Object.assign({}, data, { newTabMode: next }))
    }

    // Used by the toolbar star: pin / unpin the active page, adding it first
    // when it is not in the list yet (favicon comes from the guest hook cache).
    function bmTogglePinnedForTab(surface) {
      const tab = surface && surface.activeTab ? surface.activeTab : null
      const rawUrl = tab && tab.url ? String(tab.url) : ''
      if (!rawUrl) return
      const url = bmNormalizeUrl(rawUrl) || rawUrl
      const data = bmGetData()
      const existing = bmFindItemByUrl(data.items, url)
      const title = tab && typeof tab.title === 'string' ? tab.title.trim() : ''
      const favicon = bmFaviconFor(url)
      if (existing) {
        const next = Object.assign({}, existing, { pinned: !existing.pinned })
        if (!next.title && title) next.title = title
        if (favicon && favicon !== existing.favicon) next.favicon = favicon
        bmCommit(
          Object.assign({}, data, {
            items: data.items.map((item) => (item.id === existing.id ? next : item)),
          })
        )
        return
      }
      bmAddItem({ url, title, favicon, pinned: true })
    }

    // ---------------------------------------------------------------------------
    // Icons (stroke-based, currentColor, same visual weight as core icons)
    // ---------------------------------------------------------------------------

    function bmIcon(kind, size) {
      const edge = typeof size === 'number' && size > 0 ? size : 15
      const common = {
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        style: { display: 'block', pointerEvents: 'none' },
      }
      const starPath = 'm12 3.6 2.6 5.4 5.9.8-4.3 4.2 1.1 5.9L12 17l-5.3 2.9 1.1-5.9L3.5 9.8l5.9-.8z'
      if (kind === 'home') {
        return h('svg', common, [
          h('path', { key: 'a', d: 'M4 10.5 12 4l8 6.5' }),
          h('path', { key: 'b', d: 'M6 9.8V20h12V9.8' }),
          h('path', { key: 'c', d: 'M10.5 20v-5h3v5' }),
        ])
      }
      if (kind === 'star') return h('svg', common, h('path', { d: starPath }))
      if (kind === 'starFilled') {
        return h('svg', Object.assign({}, common, { fill: 'currentColor' }), h('path', { d: starPath }))
      }
      if (kind === 'gear') {
        return h('svg', common, [
          h('circle', { key: 'a', cx: 12, cy: 12, r: 3.1 }),
          h('path', {
            key: 'b',
            d: 'M12 3.2v2.1M12 18.7v2.1M4.8 12H2.7M21.3 12h-2.1M6.9 6.9 5.4 5.4M18.6 18.6l-1.5-1.5M17.1 6.9l1.5-1.5M5.4 18.6l1.5-1.5',
          }),
        ])
      }
      if (kind === 'close') {
        return h('svg', common, [
          h('path', { key: 'a', d: 'm6 6 12 12' }),
          h('path', { key: 'b', d: 'm18 6-12 12' }),
        ])
      }
      if (kind === 'up') {
        return h('svg', common, [h('path', { key: 'a', d: 'M12 19V5' }), h('path', { key: 'b', d: 'm6 11 6-6 6 6' })])
      }
      if (kind === 'down') {
        return h('svg', common, [h('path', { key: 'a', d: 'M12 5v14' }), h('path', { key: 'b', d: 'm6 13 6 6 6-6' })])
      }
      if (kind === 'pencil') {
        return h('svg', common, [
          h('path', { key: 'a', d: 'm4 20 1.2-4.2L16 5a2.1 2.1 0 0 1 3 3L8.2 18.8z' }),
          h('path', { key: 'b', d: 'm14.5 6.5 3 3' }),
        ])
      }
      if (kind === 'trash') {
        return h('svg', common, [
          h('path', { key: 'a', d: 'M4 7h16' }),
          h('path', { key: 'b', d: 'M9.5 7V4.8h5V7' }),
          h('path', { key: 'c', d: 'M6.5 7 7.4 20h9.2L17.5 7' }),
          h('path', { key: 'd', d: 'M10 11v6M14 11v6' }),
        ])
      }
      if (kind === 'search') {
        return h('svg', common, [
          h('circle', { key: 'a', cx: 11, cy: 11, r: 6.4 }),
          h('path', { key: 'b', d: 'm16 16 4.2 4.2' }),
        ])
      }
      if (kind === 'plus') {
        return h('svg', common, [h('path', { key: 'a', d: 'M12 5v14' }), h('path', { key: 'b', d: 'M5 12h14' })])
      }
      return null
    }

    function bmLetter(item) {
      const title = item && typeof item.title === 'string' ? item.title.trim() : ''
      const source = title || bmTitleFromUrl((item && item.url) || '')
      return (source.charAt(0) || '?').toUpperCase()
    }

    function bmLettersHue(url) {
      const text = String(url || '')
      let hash = 0
      for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 31 + text.charCodeAt(index)) % 360
      }
      return hash
    }

    function bmLetterStyle(item) {
      const hue = bmLettersHue((item && item.url) || '')
      return {
        background:
          'color-mix(in srgb, hsl(' +
          hue +
          ' 68% 52%) 20%, var(--dsw-alias-bg-layer-2))',
        color:
          'color-mix(in srgb, hsl(' +
          hue +
          ' 62% 42%) 78%, var(--dsw-alias-label-primary))',
      }
    }

    // ---------------------------------------------------------------------------
    // Start page
    // ---------------------------------------------------------------------------

    function BMFavicon({ item }) {
      const src = item && item.favicon ? item.favicon : ''
      const [failed, setFailed] = React.useState(false)
      React.useEffect(() => {
        setFailed(false)
      }, [src])
      if (!src || failed) {
        return h(
          'span',
          { className: 'dbp-bm-fav', 'aria-hidden': true },
          h('span', { className: 'dbp-bm-favLetter', style: bmLetterStyle(item) }, bmLetter(item))
        )
      }
      return h(
        'span',
        { className: 'dbp-bm-fav', 'aria-hidden': true },
        h('img', {
          src,
          alt: '',
          draggable: false,
          onError: () => setFailed(true),
        })
      )
    }

    function BMQuickCard({ item, onOpen, onRemove }) {
      const label = (item && item.title) || bmTitleFromUrl(item && item.url)
      return h('div', { className: 'dbp-bm-card' }, [
        h(
          'button',
          {
            key: 'main',
            type: 'button',
            className: 'dbp-bm-cardMain',
            title: item.url,
            onClick: () => onOpen(item.url),
          },
          [h(BMFavicon, { key: 'fav', item }), h('span', { key: 'title', className: 'dbp-bm-cardTitle' }, label)]
        ),
        item.pinned
          ? h(
              'span',
              { key: 'pin', className: 'dbp-bm-pin', 'aria-hidden': true },
              bmIcon('starFilled', 10)
            )
          : null,
        h(
          'button',
          {
            key: 'remove',
            type: 'button',
            className: 'dbp-bm-cardDel',
            title: featureText('从常用网址中删除', 'Remove from quick links'),
            'aria-label': featureText('从常用网址中删除', 'Remove from quick links'),
            onClick: (event) => {
              if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
              onRemove(item.id)
            },
          },
          bmIcon('close', 12)
        ),
      ])
    }

    function BMSearchBar({ surface }) {
      const [value, setValue] = React.useState('')
      function submit(event) {
        if (event) event.preventDefault()
        const text = String(value || '').trim()
        if (!text) return
        try {
          if (surface && typeof surface.openUrl === 'function') surface.openUrl(text)
        } catch (error) {
          /* navigation is best-effort */
        }
        setValue('')
      }
      return h('form', { className: 'dbp-bm-search', onSubmit: submit }, [
        h('span', { key: 'icon', className: 'dbp-bm-searchIcon' }, bmIcon('search', 18)),
        h('input', {
          key: 'input',
          className: 'dbp-bm-searchInput',
          type: 'text',
          value,
          placeholder: featureText('搜索或输入网址', 'Search or enter a URL'),
          'aria-label': featureText('搜索或输入网址', 'Search or enter a URL'),
          spellCheck: false,
          autoComplete: 'off',
          onChange: (event) => setValue(event.target.value),
        }),
        h(
          'button',
          { key: 'go', type: 'submit', className: 'dbp-bm-searchGo' },
          featureText('前往', 'Go')
        ),
      ])
    }

    function BMQuickLinks({ surface }) {
      const snap = bmUseStore()
      const data = snap.data
      const pinned = []
      const others = []
      for (const item of data.items) (item.pinned ? pinned : others).push(item)
      const ordered = pinned.concat(others)
      const openLink = (url) => {
        try {
          if (surface && typeof surface.openUrl === 'function') surface.openUrl(url)
        } catch (error) {
          /* invalid stored URL: nothing to open */
        }
      }
      const manage = () => bmSetOpen(true)
      const tiles = ordered.map((item) =>
        h(BMQuickCard, {
          key: item.id,
          item,
          onOpen: openLink,
          onRemove: bmRemoveItem,
        })
      )
      tiles.push(
        h(
          'button',
          {
            key: 'add-tile',
            type: 'button',
            className: 'dbp-bm-card dbp-bm-addTile',
            title: featureText('添加快捷方式', 'Add shortcut'),
            'aria-label': featureText('添加快捷方式', 'Add shortcut'),
            onClick: manage,
          },
          [
            h('span', { key: 'fav', className: 'dbp-bm-fav dbp-bm-addFav' }, bmIcon('plus', 22)),
            h(
              'span',
              { key: 'title', className: 'dbp-bm-cardTitle' },
              featureText('添加快捷方式', 'Add shortcut')
            ),
          ]
        )
      )
      return h('div', { className: 'dbp-bm-quick' }, [
        h(BMSearchBar, { key: 'search', surface }),
        h('div', { key: 'tiles', className: 'dbp-bm-shortcuts' }, tiles),
        h('div', { key: 'meta', className: 'dbp-bm-meta' }, [
          h(
            'span',
            { key: 'counts', className: 'dbp-bm-metaText' },
            featureText(
              '已钉 ' + pinned.length + ' · 常用 ' + others.length,
              pinned.length + ' pinned · ' + others.length + ' quick links'
            )
          ),
          h(
            'button',
            { key: 'manage', type: 'button', className: 'dbp-bm-linkBtn', onClick: manage },
            featureText('管理', 'Manage')
          ),
        ]),
      ])
    }

    // ---------------------------------------------------------------------------
    // Toolbar: home / pin / settings
    // ---------------------------------------------------------------------------

    function BMToolbar({ surface }) {
      const snap = bmUseStore()
      const data = snap.data
      const activeTab = surface && surface.activeTab ? surface.activeTab : null
      const activeUrl = activeTab && activeTab.url ? String(activeTab.url) : ''
      const item = activeUrl ? bmFindItemByUrl(data.items, activeUrl) : null
      const pinned = !!(item && item.pinned)
      const pinTitle = !activeUrl
        ? featureText('当前页不可钉住', 'This page cannot be pinned')
        : pinned
          ? featureText('取消钉住当前页', 'Unpin this page')
          : featureText('钉住当前页', 'Pin this page')
      return h(React.Fragment, null, [
        h(
          'button',
          {
            key: 'home',
            type: 'button',
            className: 'dbp-tool',
            title: featureText('主页', 'Home'),
            'aria-label': featureText('主页', 'Home'),
            onClick: () => {
              try {
                if (data.homeUrl && surface && typeof surface.openUrl === 'function') {
                  surface.openUrl(data.homeUrl)
                } else {
                  bmSetOpen(true)
                }
              } catch (error) {
                /* navigation is best-effort */
              }
            },
          },
          bmIcon('home')
        ),
        h(
          'button',
          {
            key: 'pin',
            type: 'button',
            className: 'dbp-tool dbp-bm-toolPin',
            'data-on': pinned ? 'true' : 'false',
            title: pinTitle,
            'aria-label': pinTitle,
            disabled: !activeUrl,
            onClick: () => bmTogglePinnedForTab(surface),
          },
          bmIcon(pinned ? 'starFilled' : 'star')
        ),
        h(
          'button',
          {
            key: 'settings',
            type: 'button',
            className: 'dbp-tool',
            title: featureText('主页与常用网址设置', 'Home and quick links settings'),
            'aria-label': featureText('主页与常用网址设置', 'Home and quick links settings'),
            onClick: () => bmSetOpen(true),
          },
          bmIcon('gear')
        ),
      ])
    }

    // ---------------------------------------------------------------------------
    // Settings dialog
    // ---------------------------------------------------------------------------

    function BMItemRow({ item, index, total }) {
      const [editing, setEditing] = React.useState(false)
      const [titleDraft, setTitleDraft] = React.useState(item.title || '')
      const [urlDraft, setUrlDraft] = React.useState(item.url || '')
      const [error, setError] = React.useState('')
      const label = item.title || bmTitleFromUrl(item.url)

      function startEdit() {
        setTitleDraft(item.title || '')
        setUrlDraft(item.url || '')
        setError('')
        setEditing(true)
      }

      function saveEdit() {
        const normalized = bmNormalizeUrl(urlDraft)
        if (!normalized) {
          setError(featureText('请输入 http/https 网址', 'Enter an http/https URL'))
          return
        }
        bmPatchItem(item.id, {
          url: normalized,
          title: String(titleDraft || '').trim() || bmTitleFromUrl(normalized),
        })
        setEditing(false)
        setError('')
      }

      if (editing) {
        return h(React.Fragment, null, [
          h('div', { key: 'row', className: 'dbp-bm-row dbp-bm-rowEdit' }, [
            h('input', {
              key: 'title',
              className: 'dbp-bm-input',
              type: 'text',
              value: titleDraft,
              placeholder: featureText('标题', 'Title'),
              'aria-label': featureText('标题', 'Title'),
              spellCheck: false,
              onChange: (event) => setTitleDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  saveEdit()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setEditing(false)
                }
              },
            }),
            h('input', {
              key: 'url',
              className: 'dbp-bm-input',
              type: 'text',
              value: urlDraft,
              placeholder: 'https://',
              'aria-label': featureText('网址', 'URL'),
              spellCheck: false,
              onChange: (event) => setUrlDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  saveEdit()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setEditing(false)
                }
              },
            }),
            h(
              'button',
              { key: 'save', type: 'button', className: 'dbp-bm-primary', onClick: saveEdit },
              featureText('保存', 'Save')
            ),
            h(
              'button',
              { key: 'cancel', type: 'button', className: 'dbp-bm-ghost', onClick: () => setEditing(false) },
              featureText('取消', 'Cancel')
            ),
          ]),
          error ? h('div', { key: 'error', className: 'dbp-bm-err' }, error) : null,
        ])
      }

      return h('div', { className: 'dbp-bm-row' }, [
        h(BMFavicon, { key: 'fav', item }),
        h('div', { key: 'text', className: 'dbp-bm-rowText' }, [
          h('span', { key: 'title', className: 'dbp-bm-rowTitle', title: label }, label),
          h('span', { key: 'url', className: 'dbp-bm-rowUrl', title: item.url }, item.url),
        ]),
        h('div', { key: 'actions', className: 'dbp-bm-actions' }, [
          h(
            'button',
            {
              key: 'pin',
              type: 'button',
              className: 'dbp-bm-mini',
              'data-on': item.pinned ? 'true' : 'false',
              title: item.pinned ? featureText('取消钉住', 'Unpin') : featureText('钉住', 'Pin'),
              'aria-label': item.pinned ? featureText('取消钉住', 'Unpin') : featureText('钉住', 'Pin'),
              onClick: () => bmTogglePinItem(item.id),
            },
            bmIcon(item.pinned ? 'starFilled' : 'star', 13)
          ),
          h(
            'button',
            {
              key: 'up',
              type: 'button',
              className: 'dbp-bm-mini',
              title: featureText('上移', 'Move up'),
              'aria-label': featureText('上移', 'Move up'),
              disabled: index === 0,
              onClick: () => bmMoveItem(item.id, -1),
            },
            bmIcon('up', 13)
          ),
          h(
            'button',
            {
              key: 'down',
              type: 'button',
              className: 'dbp-bm-mini',
              title: featureText('下移', 'Move down'),
              'aria-label': featureText('下移', 'Move down'),
              disabled: index === total - 1,
              onClick: () => bmMoveItem(item.id, 1),
            },
            bmIcon('down', 13)
          ),
          h(
            'button',
            {
              key: 'edit',
              type: 'button',
              className: 'dbp-bm-mini',
              title: featureText('编辑', 'Edit'),
              'aria-label': featureText('编辑', 'Edit'),
              onClick: startEdit,
            },
            bmIcon('pencil', 13)
          ),
          h(
            'button',
            {
              key: 'del',
              type: 'button',
              className: 'dbp-bm-mini',
              title: featureText('删除', 'Remove'),
              'aria-label': featureText('删除', 'Remove'),
              onClick: () => bmRemoveItem(item.id),
            },
            bmIcon('trash', 13)
          ),
        ]),
      ])
    }

    function BMSettingsDialog({ data }) {
      const [homeDraft, setHomeDraft] = React.useState(data.homeUrl || '')
      const [homeError, setHomeError] = React.useState('')
      const [addTitle, setAddTitle] = React.useState('')
      const [addUrl, setAddUrl] = React.useState('')
      const [addError, setAddError] = React.useState('')
      const [addNotice, setAddNotice] = React.useState('')
      const [bgError, setBgError] = React.useState('')
      const background = bmNormalizeBackground(data.background)
      const [bgUrl, setBgUrl] = React.useState(() => {
        return background.kind === 'image' && !background.image.startsWith('data:') ? background.image : ''
      })

      function commitBgUrl() {
        const trimmed = String(bgUrl || '').trim()
        if (!trimmed) {
          setBgError('')
          bmSetBackground({ kind: 'image', image: '' })
          return
        }
        const safe = bmSafeImageUrl(trimmed)
        if (!safe) {
          setBgError(featureText('请输入 http/https 图片地址', 'Enter an http/https image URL'))
          return
        }
        setBgError('')
        bmSetBackground({ kind: 'image', image: safe })
        setBgUrl(safe)
      }

      function pickBackgroundFile(event) {
        const input = event && event.target
        const file = input && input.files && input.files[0]
        if (input) input.value = ''
        if (!file) return
        if (!/^image\//i.test(String(file.type || ''))) {
          setBgError(featureText('请选择图片文件', 'Choose an image file'))
          return
        }
        if (file.size > 2000000) {
          setBgError(featureText('图片超过 2MB，请换小图或使用图片 URL', 'Image is over 2MB; use a smaller file or an image URL'))
          return
        }
        try {
          const reader = new FileReader()
          reader.onload = () => {
            const value = typeof reader.result === 'string' ? reader.result : ''
            if (!value) {
              setBgError(featureText('读取图片失败', 'Could not read the image'))
              return
            }
            setBgError('')
            bmSetBackground({ kind: 'image', image: value })
            setBgUrl('')
          }
          reader.onerror = () => setBgError(featureText('读取图片失败', 'Could not read the image'))
          reader.readAsDataURL(file)
        } catch (error) {
          setBgError(featureText('读取图片失败', 'Could not read the image'))
        }
      }

      function commitHome() {
        const trimmed = String(homeDraft || '').trim()
        if (!trimmed) {
          setHomeError('')
          bmSetHomeUrl('')
          setHomeDraft('')
          return true
        }
        const normalized = bmNormalizeUrl(trimmed)
        if (!normalized) {
          setHomeError(featureText('请输入 http/https 网址', 'Enter an http/https URL'))
          return false
        }
        setHomeError('')
        bmSetHomeUrl(normalized)
        setHomeDraft(normalized)
        return true
      }

      function close() {
        commitHome()
        bmSetOpen(false)
      }

      function submitAdd(event) {
        if (event) event.preventDefault()
        const result = bmAddItem({ url: addUrl, title: addTitle, pinned: false })
        if (result === 'invalid') {
          setAddNotice('')
          setAddError(featureText('请输入 http/https 网址', 'Enter an http/https URL'))
          return
        }
        if (result === 'exists') {
          setAddError('')
          setAddNotice(featureText('该网址已在列表中', 'This URL is already in the list'))
          setAddTitle('')
          setAddUrl('')
          return
        }
        setAddError('')
        setAddNotice('')
        setAddTitle('')
        setAddUrl('')
      }

      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (event && event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            bmSetOpen(false)
          }
        }
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('keydown', onKeyDown, true)
          // The panel itself unmounted: close silently so the dialog does not
          // pop back open the next time the browser panel is mounted.
          if (bmOpen) {
            bmOpen = false
            bmSnapshot = null
          }
        }
      }, [])

      const title = featureText('主页与常用网址', 'Home and quick links')

      return h(
        'div',
        {
          className: 'dbp-bm-overlay',
          onClick: (event) => {
            if (event.target === event.currentTarget) close()
          },
        },
        h(
          'div',
          {
            className: 'dbp-bm-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': title,
            onClick: (event) => event.stopPropagation(),
          },
          [
            h('div', { key: 'head', className: 'dbp-bm-head' }, [
              h('div', { key: 'title', className: 'dbp-bm-title' }, title),
              h(
                'button',
                {
                  key: 'close',
                  type: 'button',
                  className: 'dbp-bm-mini',
                  title: featureText('关闭', 'Close'),
                  'aria-label': featureText('关闭', 'Close'),
                  onClick: close,
                },
                bmIcon('close', 14)
              ),
            ]),
            h('div', { key: 'body', className: 'dbp-bm-body' }, [
              h('div', { key: 'home', className: 'dbp-bm-field' }, [
                h('div', { key: 'label', className: 'dbp-bm-label' }, featureText('主页网址', 'Home URL')),
                h('input', {
                  key: 'input',
                  className: 'dbp-bm-input',
                  type: 'text',
                  value: homeDraft,
                  placeholder: 'https://www.example.com/',
                  'aria-label': featureText('主页网址', 'Home URL'),
                  spellCheck: false,
                  autoFocus: true,
                  onChange: (event) => {
                    setHomeDraft(event.target.value)
                    if (homeError) setHomeError('')
                  },
                  onBlur: () => {
                    commitHome()
                  },
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitHome()
                      if (event.currentTarget && typeof event.currentTarget.blur === 'function') {
                        event.currentTarget.blur()
                      }
                    }
                  },
                }),
                homeError ? h('div', { key: 'error', className: 'dbp-bm-err' }, homeError) : null,
                h(
                  'div',
                  { key: 'hint', className: 'dbp-bm-hint' },
                  featureText(
                    '工具栏的主页按钮会打开这个网址；留空表示不设置主页。',
                    'The Home button in the toolbar opens this URL. Leave it empty for no home page.'
                  )
                ),
              ]),
              h('div', { key: 'mode', className: 'dbp-bm-field' }, [
                h(
                  'div',
                  { key: 'label', className: 'dbp-bm-label' },
                  featureText('新标签页打开', 'New tab opens')
                ),
                h('div', { key: 'seg', className: 'dbp-bm-seg' }, [
                  h(
                    'button',
                    {
                      key: 'start',
                      type: 'button',
                      className: 'dbp-bm-segBtn',
                      'data-on': data.newTabMode === 'start' ? 'true' : 'false',
                      onClick: () => bmSetNewTabMode('start'),
                    },
                    featureText('起始页', 'Start page')
                  ),
                  h(
                    'button',
                    {
                      key: 'home',
                      type: 'button',
                      className: 'dbp-bm-segBtn',
                      'data-on': data.newTabMode === 'home' ? 'true' : 'false',
                      onClick: () => bmSetNewTabMode('home'),
                    },
                    featureText('主页', 'Home page')
                  ),
                ]),
                data.newTabMode === 'home' && !data.homeUrl
                  ? h(
                      'div',
                      { key: 'warn', className: 'dbp-bm-hint' },
                      featureText(
                        '还没有设置主页网址，新标签页仍会显示起始页。',
                        'No home URL set yet, so new tabs still show the start page.'
                      )
                    )
                  : null,
              ]),
              h('div', { key: 'background', className: 'dbp-bm-field' }, [
                h(
                  'div',
                  { key: 'label', className: 'dbp-bm-label' },
                  featureText('起始页背景', 'Start page background')
                ),
                h('div', { key: 'seg', className: 'dbp-bm-seg' }, [
                  h(
                    'button',
                    {
                      key: 'default',
                      type: 'button',
                      className: 'dbp-bm-segBtn',
                      'data-on': background.kind === 'default' ? 'true' : 'false',
                      onClick: () => bmSetBackground({ kind: 'default' }),
                    },
                    featureText('默认', 'Default')
                  ),
                  h(
                    'button',
                    {
                      key: 'color',
                      type: 'button',
                      className: 'dbp-bm-segBtn',
                      'data-on': background.kind === 'color' ? 'true' : 'false',
                      onClick: () => bmSetBackground({ kind: 'color' }),
                    },
                    featureText('纯色', 'Solid')
                  ),
                  h(
                    'button',
                    {
                      key: 'image',
                      type: 'button',
                      className: 'dbp-bm-segBtn',
                      'data-on': background.kind === 'image' ? 'true' : 'false',
                      onClick: () => bmSetBackground({ kind: 'image' }),
                    },
                    featureText('图片', 'Image')
                  ),
                ]),
                background.kind === 'color'
                  ? h('div', { key: 'colorRow', className: 'dbp-bm-bgRow' }, [
                      h('input', {
                        key: 'color',
                        type: 'color',
                        className: 'dbp-bm-color',
                        value: background.color,
                        'aria-label': featureText('背景色', 'Background color'),
                        onChange: (event) => bmSetBackground({ kind: 'color', color: event.target.value }),
                      }),
                      h(
                        'span',
                        { key: 'hint', className: 'dbp-bm-hint' },
                        featureText(
                          '内容区会自动叠加可读性遮罩。',
                          'A readability overlay is added automatically.'
                        )
                      ),
                    ])
                  : null,
                background.kind === 'image'
                  ? h('div', { key: 'imageRow', className: 'dbp-bm-bgRow' }, [
                      h('input', {
                        key: 'url',
                        className: 'dbp-bm-input',
                        type: 'text',
                        value: bgUrl,
                        placeholder: 'https://…/background.jpg',
                        'aria-label': featureText('背景图片地址', 'Background image URL'),
                        spellCheck: false,
                        onChange: (event) => {
                          setBgUrl(event.target.value)
                          if (bgError) setBgError('')
                        },
                        onBlur: () => commitBgUrl(),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitBgUrl()
                          }
                        },
                      }),
                      h(
                        'label',
                        { key: 'file', className: 'dbp-bm-file' },
                        [
                          featureText('本地图片', 'Local image'),
                          h('input', {
                            key: 'input',
                            type: 'file',
                            accept: 'image/*',
                            style: { display: 'none' },
                            onChange: pickBackgroundFile,
                          }),
                        ]
                      ),
                      h(
                        'button',
                        {
                          key: 'clear',
                          type: 'button',
                          className: 'dbp-bm-ghost',
                          onClick: () => {
                            setBgUrl('')
                            setBgError('')
                            bmSetBackground({ kind: 'image', image: '' })
                          },
                        },
                        featureText('清除', 'Clear')
                      ),
                    ])
                  : null,
                bgError ? h('div', { key: 'error', className: 'dbp-bm-err' }, bgError) : null,
                background.kind === 'default'
                  ? h(
                      'div',
                      { key: 'hint', className: 'dbp-bm-hint' },
                      featureText('默认使用柔和渐变背景。', 'The default is a soft gradient.')
                    )
                  : null,
              ]),
              h('div', { key: 'items', className: 'dbp-bm-field' }, [
                h('div', { key: 'head', className: 'dbp-bm-sectionHead' }, [
                  h(
                    'span',
                    { key: 'label' },
                    featureText('常用网址', 'Quick links') + ' · ' + data.items.length
                  ),
                ]),
                data.items.length > 0
                  ? h(
                      'div',
                      { key: 'list', className: 'dbp-bm-list' },
                      data.items.map((item, index) =>
                        h(BMItemRow, {
                          key: item.id,
                          item,
                          index,
                          total: data.items.length,
                        })
                      )
                    )
                  : h(
                      'div',
                      { key: 'empty', className: 'dbp-bm-hint' },
                      featureText('还没有常用网址，在下面添加一个。', 'No quick links yet — add one below.')
                    ),
                h('div', { key: 'add', className: 'dbp-bm-add' }, [
                  h('input', {
                    key: 'title',
                    className: 'dbp-bm-input',
                    type: 'text',
                    value: addTitle,
                    placeholder: featureText('标题（可选）', 'Title (optional)'),
                    'aria-label': featureText('标题', 'Title'),
                    spellCheck: false,
                    onChange: (event) => setAddTitle(event.target.value),
                  }),
                  h('input', {
                    key: 'url',
                    className: 'dbp-bm-input',
                    type: 'text',
                    value: addUrl,
                    placeholder: 'https://',
                    'aria-label': featureText('网址', 'URL'),
                    spellCheck: false,
                    onChange: (event) => {
                      setAddUrl(event.target.value)
                      if (addError) setAddError('')
                      if (addNotice) setAddNotice('')
                    },
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        submitAdd()
                      }
                    },
                  }),
                  h(
                    'button',
                    { key: 'submit', type: 'button', className: 'dbp-bm-primary', onClick: submitAdd },
                    featureText('添加', 'Add')
                  ),
                ]),
                addError ? h('div', { key: 'error', className: 'dbp-bm-err' }, addError) : null,
                addNotice ? h('div', { key: 'notice', className: 'dbp-bm-hint' }, addNotice) : null,
                h(
                  'div',
                  { key: 'scope', className: 'dbp-bm-hint' },
                  featureText(
                    '这些网址由所有工作区共用，可钉住、排序和删除。',
                    'These links are shared across all workspaces. Pin, reorder or remove them here.'
                  )
                ),
              ]),
            ]),
            h('div', { key: 'foot', className: 'dbp-bm-foot' }, [
              h(
                'button',
                { key: 'done', type: 'button', className: 'dbp-bm-primary', onClick: close },
                featureText('完成', 'Done')
              ),
            ]),
          ]
        )
      )
    }

    function BMSettings() {
      const snap = bmUseStore()
      if (!snap.open) return null
      return h(BMSettingsDialog, { data: snap.data })
    }

    // ---------------------------------------------------------------------------
    // Registrations (run when the feature file is loaded, i.e. before apply()).
    // ---------------------------------------------------------------------------

    function bmSetBackground(patch) {
      const data = bmGetData()
      const next = bmNormalizeBackground(Object.assign({}, data.background, patch))
      bmCommit(Object.assign({}, data, { background: next }))
    }

    function bmStartBackground() {
      const data = bmGetData()
      const background = bmNormalizeBackground(data.background)
      if (background.kind === 'color') {
        return {
          background: background.color,
          backgroundImage:
            'linear-gradient(color-mix(in srgb, var(--dsw-alias-bg-base) 12%, transparent), color-mix(in srgb, var(--dsw-alias-bg-base) 26%, transparent))',
        }
      }
      if (background.kind === 'image' && background.image) {
        const url = background.image.replace(/["'\\]/g, '')
        // Only soften the area behind the search/links; keep the rest of the
        // photo clear instead of washing the whole image out.
        return {
          backgroundImage:
            'radial-gradient(ellipse 470px 300px at 50% 47%, color-mix(in srgb, var(--dsw-alias-bg-base) 64%, transparent) 0%, color-mix(in srgb, var(--dsw-alias-bg-base) 52%, transparent) 52%, color-mix(in srgb, var(--dsw-alias-bg-base) 18%, transparent) 82%, transparent 100%), url("' +
            url +
            '")',
          backgroundSize: 'auto, cover',
          backgroundPosition: 'center center, center center',
          backgroundRepeat: 'no-repeat, no-repeat',
        }
      }
      return null
    }

    featureQuickLinksRenderer = BMQuickLinks
    featureToolbarExtras.push(BMToolbar)
    featureOverlays.push(BMSettings)
    featureStartBackground = bmStartBackground

    featureNewTabProvider = function bmNewTabProvider() {
      try {
        const data = bmGetData()
        if (data.newTabMode === 'home' && data.homeUrl) return data.homeUrl
      } catch (error) {
        /* fall back to the start page */
      }
      return ''
    }

    featureGuestHooks.push(function bmFaviconHook(context) {
      const element = context && context.element
      if (!element || typeof element.addEventListener !== 'function') return
      element.addEventListener('page-favicon-updated', (event) => {
        try {
          const favicons = event && event.favicons
          if (!favicons || !favicons.length) return
          let url = ''
          try {
            url = typeof element.getURL === 'function' ? element.getURL() : ''
          } catch (error) {
            url = ''
          }
          if (!url) return
          bmRememberFavicon(url, favicons[0])
        } catch (error) {
          /* a broken favicon must not break browsing */
        }
      })
    })
