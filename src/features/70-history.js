// Browser history: permanent per-profile visit records in IndexedDB plus a
// standalone history page (search / date groups / delete / clear all).
//
// This file is a plain JS fragment concatenated inside the client factory body, so
// `React`, `h` and the core feature registries (featureCss / featureToolbarExtras /
// featureViews / featureGuestHooks / featureText) are already in scope.
// No imports, no exports, no JSX. Everything lives in one IIFE so that no top-level
// name can collide with the other feature files that share this closure.
//
// Product rules (decided):
//   - Records are permanent: nothing expires and nothing is evicted automatically.
//     Only explicit user deletion / "clear all" removes them.
//   - Storage is IndexedDB (never localStorage): DB "dsh-web-browser-history",
//     store "entries" (autoIncrement keyPath id) with index "visitedAt".
//   - Every storage failure is caught, logged with console.warn, and surfaced in the
//     history page as an inline notice; it never breaks browsing.
;(function () {
  // ---------------------------------------------------------------------------
  // Constants and module state
  // ---------------------------------------------------------------------------
  const HIST_DB_NAME = 'dsh-web-browser-history'
  const HIST_DB_VERSION = 1
  const HIST_STORE = 'entries'
  const HIST_INDEX = 'visitedAt'
  const HIST_PAGE_SIZE = 200
  const HIST_DEDUPE_MS = 5000
  const HIST_TITLE_MS = 10000
  const HIST_LOG_PREFIX = '[dsh-web-browser:history]'

  // '' = healthy, 'unavailable' = IndexedDB cannot be opened/read/written,
  // 'quota' = the browser refused a write because the quota is exhausted.
  const histFlags = { problem: '' }
  const histSubscribers = new Set()
  // element -> last record written for that guest, used for the dedupe windows.
  const histLastByElement = typeof WeakMap === 'function' ? new WeakMap() : null
  let histDbPromise = null

  // ---------------------------------------------------------------------------
  // Data layer (IndexedDB, promise-wrapped, never throws synchronously)
  // ---------------------------------------------------------------------------
  function histSafeString(value) {
    return typeof value === 'string' ? value : ''
  }

  function histCleanUrl(value) {
    const url = histSafeString(value).trim()
    return /^https?:\/\//i.test(url) ? url : ''
  }

  function histNormalizeEntry(value) {
    if (!value || typeof value !== 'object') return null
    const id = value.id
    if (typeof id !== 'number' || !isFinite(id)) return null
    const url = histCleanUrl(value.url)
    if (!url) return null
    const visitedAt =
      typeof value.visitedAt === 'number' && isFinite(value.visitedAt) ? value.visitedAt : 0
    if (!visitedAt) return null
    return { id, url, title: histSafeString(value.title), visitedAt }
  }

  function histNotify() {
    for (const listener of Array.from(histSubscribers)) {
      try {
        listener()
      } catch (error) {
        /* an observer must never break recording */
      }
    }
  }

  function histSubscribe(listener) {
    if (typeof listener !== 'function') return () => {}
    histSubscribers.add(listener)
    return () => {
      try {
        histSubscribers.delete(listener)
      } catch (error) {
        /* ignore */
      }
    }
  }

  function histHandleError(error) {
    try {
      console.warn(HIST_LOG_PREFIX, error && error.message ? error.message : error)
    } catch (ignored) {
      /* console may be missing in odd hosts */
    }
    const name = error && error.name ? String(error.name) : ''
    const next =
      name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
        ? 'quota'
        : 'unavailable'
    if (histFlags.problem !== next) {
      histFlags.problem = next
      histNotify()
    }
  }

  // A successful read proves the store is reachable again, so it clears
  // "unavailable"; a full quota can only be proven fixed by a successful write.
  function histMarkOk(mode) {
    if (!histFlags.problem) return
    if (mode !== 'readwrite' && histFlags.problem !== 'unavailable') return
    histFlags.problem = ''
    histNotify()
  }

  function histOpenDb() {
    if (histDbPromise) return histDbPromise
    histDbPromise = new Promise((resolve, reject) => {
      let request = null
      try {
        if (typeof indexedDB === 'undefined' || !indexedDB) {
          throw new Error('IndexedDB is not available')
        }
        request = indexedDB.open(HIST_DB_NAME, HIST_DB_VERSION)
      } catch (error) {
        reject(error)
        return
      }
      request.onupgradeneeded = () => {
        const db = request.result
        const store = db.objectStoreNames.contains(HIST_STORE)
          ? request.transaction.objectStore(HIST_STORE)
          : db.createObjectStore(HIST_STORE, { keyPath: 'id', autoIncrement: true })
        if (!store.indexNames.contains(HIST_INDEX)) {
          store.createIndex(HIST_INDEX, 'visitedAt', { unique: false })
        }
      }
      request.onsuccess = () => {
        const db = request.result
        try {
          db.onversionchange = () => {
            try {
              db.close()
            } catch (error) {
              /* ignore */
            }
            histDbPromise = null
          }
        } catch (error) {
          /* ignore */
        }
        resolve(db)
      }
      request.onerror = () => {
        reject(request.error || new Error('IndexedDB open failed'))
      }
      request.onblocked = () => {
        reject(new Error('IndexedDB open blocked'))
      }
    })
    // Do not cache a failed open: a later visit/read can retry (e.g. transient lock).
    histDbPromise = histDbPromise.catch((error) => {
      histDbPromise = null
      throw error
    })
    return histDbPromise
  }

  // Run one IndexedDB transaction. `execute(store, done)` schedules the requests and
  // calls done(value) with whatever should resolve the promise. All failures reject
  // (after being logged once) so callers can decide how to recover.
  function histRun(mode, execute) {
    return histOpenDb()
      .then(
        (db) =>
          new Promise((resolve, reject) => {
            let result = null
            let settled = false
            const fail = (error) => {
              if (settled) return
              settled = true
              reject(error || new Error('history storage failed'))
            }
            let tx = null
            try {
              tx = db.transaction(HIST_STORE, mode)
            } catch (error) {
              fail(error)
              return
            }
            tx.oncomplete = () => {
              if (settled) return
              settled = true
              resolve(result)
            }
            tx.onerror = () => fail(tx.error)
            tx.onabort = () => fail(tx.error || new Error('history transaction aborted'))
            try {
              execute(tx.objectStore(HIST_STORE), (value) => {
                result = value
              })
            } catch (error) {
              try {
                tx.abort()
              } catch (ignored) {
                /* ignore */
              }
              fail(error)
            }
          })
      )
      .then((value) => {
        histMarkOk(mode)
        return value
      })
      .catch((error) => {
        histHandleError(error)
        throw error
      })
  }

  function histListEntries() {
    return histRun('readonly', (store, done) => {
      const request = store.getAll()
      request.onsuccess = () => {
        done(Array.isArray(request.result) ? request.result : [])
      }
    }).then((items) => {
      const normalized = []
      for (const item of items || []) {
        const entry = histNormalizeEntry(item)
        if (entry) normalized.push(entry)
      }
      normalized.sort((a, b) => b.visitedAt - a.visitedAt || b.id - a.id)
      return normalized
    })
  }

  function histAppend(entry) {
    return histRun('readwrite', (store, done) => {
      const request = store.add(entry)
      request.onsuccess = () => {
        done(request.result)
      }
    })
  }

  // Update the title of one existing entry. Resolves false when the row no longer
  // exists (e.g. the user deleted it while the page was still loading).
  function histPutTitle(id, title) {
    return histRun('readwrite', (store, done) => {
      done(false)
      const getRequest = store.get(id)
      getRequest.onsuccess = () => {
        const current = getRequest.result
        if (!current) return
        const next = {
          id: current.id,
          url: histCleanUrl(current.url) || histSafeString(current.url),
          title: histSafeString(title),
          visitedAt: typeof current.visitedAt === 'number' ? current.visitedAt : Date.now(),
        }
        const putRequest = store.put(next)
        putRequest.onsuccess = () => {
          done(true)
        }
      }
    })
  }

  function histDeleteEntry(id) {
    return histRun('readwrite', (store, done) => {
      store.delete(id)
      done(true)
    })
  }

  function histClearAll() {
    return histRun('readwrite', (store, done) => {
      store.clear()
      done(true)
    })
  }

  // ---------------------------------------------------------------------------
  // Recording (guest hook) with the per-element dedupe windows
  // ---------------------------------------------------------------------------
  function histReadLast(element) {
    if (!histLastByElement) return null
    try {
      return histLastByElement.get(element) || null
    } catch (error) {
      return null
    }
  }

  function histRemember(element, record) {
    if (!histLastByElement) return
    try {
      histLastByElement.set(element, record)
    } catch (error) {
      /* ignore */
    }
  }

  function histApplyTitle(record, rawTitle) {
    if (!record) return
    const title = histSafeString(rawTitle)
    if (!title || record.title === title) return
    record.title = title
    if (record.id == null) {
      // The append is still in flight: remember the freshest title and apply it once
      // the new row id arrives (see histNoteVisit).
      record.pendingTitle = title
      return
    }
    histPutTitle(record.id, title)
      .then((updated) => {
        if (updated === false) record.deleted = true
        else if (record.pendingTitle === title) record.pendingTitle = ''
      })
      .catch(() => {
        /* already logged by the data layer */
      })
  }

  function histNoteVisit(element, rawUrl, rawTitle) {
    const url = histCleanUrl(rawUrl)
    if (!url) return // about:/data:/devtools:/empty -> not recorded
    const title = histSafeString(rawTitle)
    const now = Date.now()
    const last = histReadLast(element)

    // Same element, same URL, within 5s: this is a follow-up event of the same
    // visit (redirect/refresh/SPA), so only refresh the title of the same row.
    if (last && last.url === url && !last.deleted && now - last.at <= HIST_DEDUPE_MS) {
      last.at = now
      histApplyTitle(last, title)
      return
    }

    const record = { id: null, url, at: now, title, pendingTitle: '', deleted: false }
    histRemember(element, record)
    const entry = { url, title, visitedAt: now }
    histAppend(entry)
      .then((id) => {
        if (typeof id === 'number') record.id = id
        const pending = record.pendingTitle
        record.pendingTitle = ''
        if (!pending || record.id == null || pending === entry.title) {
          histNotify() // let an open history page pick up the new row
          return
        }
        histPutTitle(record.id, pending)
          .then((updated) => {
            if (updated === false) record.deleted = true
          })
          .catch(() => {
            /* already logged */
          })
          .then(() => {
            histNotify()
          })
      })
      .catch(() => {
        // Write failed (unavailable/quota). Drop the cached "last" record so the
        // next stop-loading tries a fresh append instead of updating a ghost row.
        if (record.id == null) histRemember(element, null)
      })
  }

  function histNoteTitle(element, rawTitle) {
    const title = histSafeString(rawTitle)
    if (!title) return
    const last = histReadLast(element)
    if (!last || !last.url) return
    if (Date.now() - last.at > HIST_TITLE_MS) return
    let current = ''
    try {
      current = histCleanUrl(element.getURL())
    } catch (error) {
      current = ''
    }
    if (current && current !== last.url) return
    histApplyTitle(last, title)
  }

  function histGuestHook({ element }) {
    if (!element || typeof element.addEventListener !== 'function') return
    element.addEventListener('did-stop-loading', () => {
      if (element.isConnected === false) return
      let url = ''
      let title = ''
      try {
        url = element.getURL()
      } catch (error) {
        url = ''
      }
      try {
        title = element.getTitle()
      } catch (error) {
        title = ''
      }
      histNoteVisit(element, url, title)
    })
    element.addEventListener('page-title-updated', (event) => {
      if (element.isConnected === false) return
      histNoteTitle(element, event && event.title)
    })
  }

  // ---------------------------------------------------------------------------
  // Presentation helpers
  // ---------------------------------------------------------------------------
  function histPad(value) {
    return value < 10 ? '0' + value : String(value)
  }

  function histStartOfDay(timestamp) {
    const date = new Date(timestamp)
    date.setHours(0, 0, 0, 0)
    return date.getTime()
  }

  function histFormatTime(timestamp) {
    const date = new Date(timestamp)
    return histPad(date.getHours()) + ':' + histPad(date.getMinutes())
  }

  function histFormatDate(timestamp) {
    const date = new Date(timestamp)
    return date.getFullYear() + '-' + histPad(date.getMonth() + 1) + '-' + histPad(date.getDate())
  }

  function histDateLabel(timestamp) {
    const today = histStartOfDay(Date.now())
    const day = histStartOfDay(timestamp)
    const diff = Math.round((today - day) / 86400000)
    if (diff === 0) return featureText('今天', 'Today')
    if (diff === 1) return featureText('昨天', 'Yesterday')
    return histFormatDate(timestamp)
  }

  function histIcon(kind, size) {
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
    if (kind === 'back') return h('svg', common, h('path', { d: 'M15 5 8 12l7 7' }))
    if (kind === 'clock') {
      return h('svg', common, [
        h('path', { key: 'a', d: 'M3 12a9 9 0 1 0 2.6-6.4' }),
        h('path', { key: 'b', d: 'M3 4v4.5h4.5' }),
        h('path', { key: 'c', d: 'M12 7.8V12l2.9 1.7' }),
      ])
    }
    if (kind === 'trash') {
      return h('svg', common, [
        h('path', { key: 'a', d: 'M4 7h16' }),
        h('path', { key: 'b', d: 'M9 7V4.5h6V7' }),
        h('path', { key: 'c', d: 'M6.5 7l.9 12.5h9.2L17.5 7' }),
        h('path', { key: 'd', d: 'M10 11v5.5' }),
        h('path', { key: 'e', d: 'M14 11v5.5' }),
      ])
    }
    if (kind === 'search') {
      return h('svg', common, [
        h('circle', { key: 'a', cx: 11, cy: 11, r: 6.5 }),
        h('path', { key: 'b', d: 'm16 16 4.5 4.5' }),
      ])
    }
    if (kind === 'close') {
      return h('svg', common, [h('path', { key: 'a', d: 'm6 6 12 12' }), h('path', { key: 'b', d: 'm18 6-12 12' })])
    }
    return null
  }

  function histEmptyState(kind, title, hint) {
    return h('div', { className: 'dbp-hist-empty' }, [
      h('div', { key: 'icon', className: 'dbp-hist-emptyIcon' }, histIcon(kind, 30)),
      h('div', { key: 'title', className: 'dbp-hist-emptyTitle' }, title),
      h('div', { key: 'hint', className: 'dbp-hist-emptyHint' }, hint),
    ])
  }

  // ---------------------------------------------------------------------------
  // Toolbar button -> opens the standalone history view
  // ---------------------------------------------------------------------------
  function HistoryToolbarButton({ surface }) {
    const active = !!(surface && surface.view === 'history')
    const label = featureText('浏览历史', 'History')
    return h(
      'button',
      {
        type: 'button',
        className: 'dbp-tool dbp-hist-tool',
        title: label,
        'aria-label': label,
        'data-active': active ? 'true' : 'false',
        onClick: () => {
          if (!surface || typeof surface.setView !== 'function') return
          try {
            surface.setView('history')
          } catch (error) {
            /* ignore */
          }
        },
      },
      histIcon('clock')
    )
  }

  // ---------------------------------------------------------------------------
  // History page (featureViews.history)
  // ---------------------------------------------------------------------------
  function HistoryPage({ surface }) {
    const [entries, setEntries] = React.useState([])
    const [loading, setLoading] = React.useState(true)
    const [query, setQuery] = React.useState('')
    const [limit, setLimit] = React.useState(HIST_PAGE_SIZE)
    const [confirming, setConfirming] = React.useState(false)
    const [reloadTick, setReloadTick] = React.useState(0)
    const [, forceRender] = React.useReducer((value) => value + 1, 0)
    const problem = histFlags.problem

    // Live updates: storage health changes and new recorded visits both nudge the
    // page. The reload tick is a separate state so the effect below re-reads IDB.
    React.useEffect(() => {
      return histSubscribe(() => {
        forceRender()
        setReloadTick((value) => value + 1)
      })
    }, [])

    React.useEffect(() => {
      let cancelled = false
      setLoading(true)
      histListEntries()
        .then((items) => {
          if (cancelled) return
          setEntries(items)
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setEntries([])
          setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }, [reloadTick])

    function reload() {
      setReloadTick((value) => value + 1)
    }

    function goBack() {
      if (!surface || typeof surface.setView !== 'function') return
      try {
        surface.setView(null)
      } catch (error) {
        /* ignore */
      }
    }

    function openEntry(entry) {
      if (!surface || typeof surface.addTab !== 'function') return
      if (!entry || !histCleanUrl(entry.url)) return
      try {
        surface.addTab(entry.url)
        if (typeof surface.setView === 'function') surface.setView(null)
      } catch (error) {
        try {
          console.warn(HIST_LOG_PREFIX, 'open history entry failed', error)
        } catch (ignored) {
          /* ignore */
        }
      }
    }

    function removeEntry(id) {
      setEntries((prev) => prev.filter((entry) => entry.id !== id))
      histDeleteEntry(id)
        .then(reload)
        .catch(reload)
    }

    function confirmClear() {
      setConfirming(false)
      setEntries([])
      histClearAll()
        .then(reload)
        .catch(reload)
    }

    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? entries.filter((entry) => {
          return (
            histSafeString(entry.title).toLowerCase().indexOf(needle) !== -1 ||
            histSafeString(entry.url).toLowerCase().indexOf(needle) !== -1
          )
        })
      : entries
    const visible = filtered.slice(0, limit)

    const groups = []
    let group = null
    for (const entry of visible) {
      const day = histStartOfDay(entry.visitedAt)
      if (!group || group.day !== day) {
        group = { day, label: histDateLabel(entry.visitedAt), items: [] }
        groups.push(group)
      }
      group.items.push(entry)
    }

    function renderEntry(entry) {
      const label = entry.title || entry.url
      const deleteLabel = featureText('删除这条记录', 'Delete this entry')
      const showUrl = !!entry.title && entry.title !== entry.url
      return h('li', { key: 'hist-' + entry.id, className: 'dbp-hist-item' }, [
        h(
          'button',
          {
            key: 'open',
            type: 'button',
            className: 'dbp-hist-open',
            title: label,
            onClick: () => openEntry(entry),
          },
          [
            h('span', { key: 'title', className: 'dbp-hist-itemTitle' }, label),
            showUrl ? h('span', { key: 'url', className: 'dbp-hist-itemUrl' }, entry.url) : null,
          ]
        ),
        h('span', { key: 'time', className: 'dbp-hist-time' }, histFormatTime(entry.visitedAt)),
        h(
          'button',
          {
            key: 'delete',
            type: 'button',
            className: 'dbp-hist-del',
            title: deleteLabel,
            'aria-label': deleteLabel,
            onClick: () => removeEntry(entry.id),
          },
          histIcon('trash')
        ),
      ])
    }

    let body = null
    if (loading) {
      body = [
        h(
          'div',
          { key: 'loading', className: 'dbp-hist-loading' },
          featureText('加载中…', 'Loading…')
        ),
      ]
    } else if (entries.length === 0) {
      body = [
        histEmptyState(
          'clock',
          featureText('还没有浏览记录', 'No history yet'),
          featureText(
            '打开的网页会自动记录在这里，记录不会自动过期或删除。',
            'Pages you visit are recorded here permanently; nothing expires automatically.'
          )
        ),
      ]
    } else if (filtered.length === 0) {
      body = [
        histEmptyState(
          'search',
          featureText('没有匹配的记录', 'No matching entries'),
          featureText('换个关键词试试。', 'Try a different keyword.')
        ),
      ]
    } else {
      body = groups.map((item) =>
        h('section', { key: 'group-' + item.day, className: 'dbp-hist-groupWrap' }, [
          h('div', { key: 'label', className: 'dbp-hist-group' }, [
            h('span', { key: 'text' }, item.label),
            h('span', { key: 'count', className: 'dbp-hist-groupCount' }, String(item.items.length)),
          ]),
          h('ul', { key: 'rows', className: 'dbp-hist-rows' }, item.items.map(renderEntry)),
        ])
      )
      if (filtered.length > visible.length) {
        body.push(
          h(
            'button',
            {
              key: 'more',
              type: 'button',
              className: 'dbp-hist-more',
              onClick: () => setLimit((value) => value + HIST_PAGE_SIZE),
            },
            featureText('显示更多', 'Show more')
          )
        )
      }
    }

    let problemText = ''
    if (problem === 'quota') {
      problemText = featureText(
        '存储空间已满，新的浏览记录未能保存；已保存的记录不会被删除。',
        'Storage is full; new entries were not saved. Existing entries are kept.'
      )
    } else if (problem === 'unavailable') {
      problemText = featureText(
        '历史记录存储不可用，记录未能读取或保存。',
        'History storage is unavailable; records could not be read or saved.'
      )
    }

    const backLabel = featureText('返回', 'Back')

    return h('div', { className: 'dbp-hist' }, [
      h('div', { key: 'inner', className: 'dbp-hist-inner' }, [
      h('div', { key: 'head', className: 'dbp-hist-head' }, [
        h(
          'button',
          {
            key: 'back',
            type: 'button',
            className: 'dbp-hist-back',
            title: backLabel,
            'aria-label': backLabel,
            onClick: goBack,
          },
          histIcon('back')
        ),
        h('span', { key: 'title', className: 'dbp-hist-title' }, featureText('浏览历史', 'History')),
        !loading && entries.length
          ? h(
              'span',
              { key: 'count', className: 'dbp-hist-count' },
              featureText('共 ' + entries.length + ' 条', entries.length + ' entries')
            )
          : null,
        h(
          'div',
          { key: 'search', className: 'dbp-hist-searchWrap' },
          [
            h('span', { key: 'icon', className: 'dbp-hist-searchIcon' }, histIcon('search', 14)),
            h('input', {
              key: 'input',
              className: 'dbp-hist-search',
              type: 'text',
              value: query,
              placeholder: featureText('搜索标题或网址', 'Search title or URL'),
              spellCheck: false,
              autoComplete: 'off',
              'aria-label': featureText('搜索历史记录', 'Search history'),
              onChange: (event) => {
                setQuery(event.target.value)
                setLimit(HIST_PAGE_SIZE)
              },
            }),
            query
              ? h(
                  'button',
                  {
                    key: 'clear',
                    type: 'button',
                    className: 'dbp-hist-clear',
                    title: featureText('清除搜索', 'Clear search'),
                    'aria-label': featureText('清除搜索', 'Clear search'),
                    onClick: () => {
                      setQuery('')
                      setLimit(HIST_PAGE_SIZE)
                    },
                  },
                  histIcon('close', 12)
                )
              : null,
          ]
        ),
        h(
          'button',
          {
            key: 'clear',
            type: 'button',
            className: 'dbp-hist-btn',
            'data-danger': 'true',
            disabled: loading || entries.length === 0,
            onClick: () => setConfirming(true),
          },
          featureText('清空全部', 'Clear all')
        ),
      ]),
      confirming
        ? h(
            'div',
            { key: 'confirm', className: 'dbp-hist-confirm', role: 'group' },
            [
              h(
                'span',
                { key: 'text', className: 'dbp-hist-confirmText' },
                featureText(
                  '清空全部浏览记录？此操作不可撤销。',
                  'Clear all history? This cannot be undone.'
                )
              ),
              h(
                'button',
                {
                  key: 'yes',
                  type: 'button',
                  className: 'dbp-hist-btn',
                  'data-danger': 'true',
                  onClick: confirmClear,
                },
                featureText('清空', 'Clear')
              ),
              h(
                'button',
                {
                  key: 'no',
                  type: 'button',
                  className: 'dbp-hist-btn',
                  onClick: () => setConfirming(false),
                },
                featureText('取消', 'Cancel')
              ),
            ]
          )
        : null,
      problemText
        ? h(
            'div',
            { key: 'problem', className: 'dbp-hist-notice', role: 'status', 'aria-live': 'polite' },
            problemText
          )
        : null,
      h('div', { key: 'list', className: 'dbp-hist-list' }, body),
      ]),
    ])
  }

  // ---------------------------------------------------------------------------
  // Styles (registered through featureCss; only --dsw-alias-* theme tokens)
  // ---------------------------------------------------------------------------
  const HIST_CSS = [
    '.dbp-hist{display:flex;flex-direction:column;flex:auto;min-height:0;height:100%;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.4}',
    '.dbp-hist-inner{display:flex;flex-direction:column;flex:auto;min-height:0;width:100%;max-width:960px;margin:0 auto}',
    '.dbp-hist-head{display:flex;align-items:center;gap:10px;flex:none;padding:14px 20px 12px;border-bottom:.5px solid var(--dsw-alias-border-l1)}',
    '.dbp-hist-back{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
    '.dbp-hist-back:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)}',
    '.dbp-hist-title{flex:none;font-size:15px;font-weight:600;letter-spacing:.01em;white-space:nowrap}',
    '.dbp-hist-count{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap}',
    '.dbp-hist-searchWrap{display:flex;align-items:center;gap:6px;flex:auto;min-width:100px;height:30px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}',
    '.dbp-hist-searchWrap:focus-within{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-base)}',
    '.dbp-hist-searchIcon{display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--dsw-alias-label-secondary)}',
    '.dbp-hist-search{flex:auto;min-width:0;height:100%;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;font-family:inherit}',
    '.dbp-hist-search::placeholder{color:var(--dsw-alias-label-secondary)}',
    '.dbp-hist-clear{display:inline-flex;align-items:center;justify-content:center;flex:none;width:20px;height:20px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
    '.dbp-hist-clear:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent)}',
    '.dbp-hist-btn{display:inline-flex;align-items:center;justify-content:center;flex:none;height:28px;padding:0 11px;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;font-family:inherit;white-space:nowrap;cursor:pointer}',
    '.dbp-hist-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)}',
    '.dbp-hist-btn:disabled{color:var(--dsw-alias-state-idle-primary);cursor:default}',
    '.dbp-hist-btn[data-danger="true"]{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 40%, transparent)}',
    '.dbp-hist-btn[data-danger="true"]:hover:not(:disabled){color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent)}',
    '.dbp-hist-confirm{display:flex;align-items:center;gap:8px;flex:none;padding:9px 20px;border-bottom:.5px solid var(--dsw-alias-border-l1);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);color:var(--dsw-alias-label-secondary);font-size:12px}',
    '.dbp-hist-confirmText{flex:auto;min-width:0}',
    '.dbp-hist-notice{flex:none;padding:8px 20px;border-bottom:.5px solid var(--dsw-alias-border-l1);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}',
    '.dbp-hist-list{flex:auto;min-height:0;overflow:auto;padding:2px 12px 28px}',
    '.dbp-hist-groupWrap{display:block}',
    '.dbp-hist-group{position:sticky;top:0;z-index:1;display:flex;align-items:baseline;gap:8px;padding:14px 8px 6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;letter-spacing:.04em}',
    '.dbp-hist-groupCount{color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:400;opacity:.75}',
    '.dbp-hist-rows{display:flex;flex-direction:column;gap:2px;margin:0;padding:0 0 2px;list-style:none}',
    '.dbp-hist-item{display:flex;align-items:center;gap:10px;padding:2px 8px;border-radius:8px}',
    '.dbp-hist-item:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent)}',
    '.dbp-hist-open{display:flex;flex:auto;min-width:0;flex-direction:column;gap:1px;padding:6px 2px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;text-align:left;cursor:pointer}',
    '.dbp-hist-open:hover .dbp-hist-itemTitle,.dbp-hist-open:focus-visible .dbp-hist-itemTitle{color:var(--dsw-alias-brand-primary)}',
    '.dbp-hist-open:focus-visible{outline:.5px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
    '.dbp-hist-itemTitle{font-size:13px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.dbp-hist-itemUrl{font-size:11.5px;line-height:1.4;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.dbp-hist-time{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
    '.dbp-hist-del{display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;transition:opacity .12s ease}',
    '.dbp-hist-item:hover .dbp-hist-del,.dbp-hist-del:focus-visible{opacity:1}',
    '.dbp-hist-del:hover{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent)}',
    '.dbp-hist-more{display:block;margin:14px auto 0;height:30px;padding:0 16px;border:.5px solid var(--dsw-alias-border-l2);border-radius:15px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;font-family:inherit;cursor:pointer}',
    '.dbp-hist-more:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
    '.dbp-hist-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:72px 20px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}',
    '.dbp-hist-emptyIcon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}',
    '.dbp-hist-emptyTitle{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600}',
    '.dbp-hist-emptyHint{max-width:360px;color:var(--dsw-alias-label-secondary);font-size:12px}',
    '.dbp-hist-loading{padding:36px 20px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px}',
    '.dbp-hist-tool[data-active="true"]{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent)}',
  ].join('\n')

  // ---------------------------------------------------------------------------
  // Registration (runs when the feature file is concatenated, before apply)
  // ---------------------------------------------------------------------------
  featureCss.push(HIST_CSS)
  featureToolbarExtras.push(HistoryToolbarButton)
  featureViews.history = HistoryPage
  featureGuestHooks.push(histGuestHook)
})()
