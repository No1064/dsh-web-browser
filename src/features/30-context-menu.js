// ---- src/features/30-context-menu.js ----
//
// Custom right-click menu for the built-in <webview> guests.
//
// This file is a plain JS fragment concatenated inside the client factory body, so
// `React`, `h` and the core feature registries (featureGuestHooks / featureOverlays /
// featureCss / featureText) are already in scope. No imports, no JSX.
//
// Flow:
//   1. featureGuestHooks: each guest forwards its `context-menu` event to a
//      module-local bus, together with the viewport coordinates computed from
//      element.getBoundingClientRect() + event.x/y and the context fields.
//   2. featureOverlays: one fixed-position menu renders that payload, clamps its
//      position to the visible viewport and closes on outside click / Escape /
//      scroll / resize.
//
// Every browser call is defensive: the guest may be destroyed, getSurface() may be
// undefined, clipboard may be denied. A broken menu must never break browsing.

// ---------------------------------------------------------------------------
// Constants and module state
// ---------------------------------------------------------------------------
const DBP_CTX_MARGIN = 8
const DBP_CTX_MIN_ZOOM = 0.5
const DBP_CTX_MAX_ZOOM = 2
const DBP_CTX_ZOOM_STEP = 0.1
const DBP_CTX_ESTIMATED_WIDTH = 208
const DBP_CTX_ESTIMATED_ITEM_HEIGHT = 29

const dbpCtxMenuZoomByElement = new WeakMap()

const dbpCtxMenuBus = (() => {
  const listeners = new Set()
  return {
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {}
      listeners.add(listener)
      return () => {
        try {
          listeners.delete(listener)
        } catch (error) {
          /* ignore */
        }
      }
    },
    emit(payload) {
      for (const listener of Array.from(listeners)) {
        try {
          listener(payload)
        } catch (error) {
          /* one bad listener must not stop the menu */
        }
      }
    },
  }
})()

// ---------------------------------------------------------------------------
// Defensive helpers
// ---------------------------------------------------------------------------
function dbpCtxIsUsable(element) {
  if (!element) return false
  try {
    if (typeof element.isDestroyed === 'function' && element.isDestroyed()) return false
  } catch (error) {
    return false
  }
  try {
    if (element.isConnected === false) return false
  } catch (error) {
    /* ignore */
  }
  return true
}

function dbpCtxCall(target, method, args) {
  try {
    if (!target) return undefined
    const fn = target[method]
    if (typeof fn !== 'function') return undefined
    return fn.apply(target, args || [])
  } catch (error) {
    return undefined
  }
}

function dbpCtxCanGo(element, method) {
  return dbpCtxCall(element, method, []) === true
}

function dbpCtxResolveSurface(payload) {
  if (!payload) return undefined
  if (payload.surface) return payload.surface
  if (typeof payload.getSurface === 'function') {
    try {
      return payload.getSurface()
    } catch (error) {
      return undefined
    }
  }
  return undefined
}

function dbpCtxPageUrl(payload) {
  const fromEvent = payload && typeof payload.pageURL === 'string' ? payload.pageURL : ''
  if (fromEvent) return fromEvent
  const fromGuest = dbpCtxCall(payload && payload.element, 'getURL', [])
  if (typeof fromGuest === 'string' && fromGuest) return fromGuest
  const surface = dbpCtxResolveSurface(payload)
  const activeTab = surface && surface.activeTab
  if (activeTab && typeof activeTab.url === 'string' && activeTab.url) return activeTab.url
  return ''
}

function dbpCtxCopyTextLegacy(text) {
  try {
    if (typeof document === 'undefined' || !document.body) return false
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', 'readonly')
    area.setAttribute('aria-hidden', 'true')
    area.style.position = 'fixed'
    area.style.top = '-2000px'
    area.style.left = '-2000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    try {
      area.focus()
      area.select()
      if (typeof document.execCommand !== 'function') return false
      return document.execCommand('copy') === true
    } finally {
      if (area.parentNode) area.parentNode.removeChild(area)
    }
  } catch (error) {
    return false
  }
}

function dbpCtxCopyText(text) {
  const value = typeof text === 'string' ? text : ''
  if (!value) return false
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      const pending = navigator.clipboard.writeText(value)
      if (pending && typeof pending.then === 'function') {
        pending.then(
          () => {},
          () => {
            dbpCtxCopyTextLegacy(value)
          }
        )
      }
      return true
    }
  } catch (error) {
    /* fall back to the legacy path below */
  }
  return dbpCtxCopyTextLegacy(value)
}

function dbpCtxCopySelection(payload) {
  const text = payload && typeof payload.selectionText === 'string' ? payload.selectionText : ''
  if (!text) return false
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      const pending = navigator.clipboard.writeText(text)
      if (pending && typeof pending.then === 'function') {
        pending.then(
          () => {},
          () => {
            dbpCtxCall(payload.element, 'copy', [])
          }
        )
      }
      return true
    }
  } catch (error) {
    /* fall back to the guest below */
  }
  const copied = dbpCtxCall(payload && payload.element, 'copy', [])
  if (copied === undefined) dbpCtxCopyTextLegacy(text)
  return true
}

function dbpCtxOpenInChrome(url) {
  const target = typeof url === 'string' ? url.trim() : ''
  if (!target) return
  try {
    window.open(target, '_blank', 'noopener,noreferrer')
  } catch (error) {
    /* main process may deny; nothing else we can do */
  }
}

function dbpCtxOpenTab(payload, url) {
  const target = typeof url === 'string' ? url.trim() : ''
  if (!target) return
  const surface = dbpCtxResolveSurface(payload)
  if (surface && typeof surface.addTab === 'function') {
    try {
      surface.addTab(target)
      return
    } catch (error) {
      /* fall through to the system browser */
    }
  }
  dbpCtxOpenInChrome(target)
}

function dbpCtxCallOnGuest(payload, method) {
  const element = payload && payload.element
  if (!dbpCtxIsUsable(element)) return false
  try {
    if (typeof element.focus === 'function') element.focus()
  } catch (error) {
    /* the guest may already be gone */
  }
  dbpCtxCall(element, method, [])
  return true
}

function dbpCtxGetZoom(element) {
  if (!element) return 1
  let stored = undefined
  try {
    stored = dbpCtxMenuZoomByElement.get(element)
  } catch (error) {
    stored = undefined
  }
  if (typeof stored === 'number' && isFinite(stored) && stored > 0) return stored
  let current = 1
  const reported = dbpCtxCall(element, 'getZoomFactor', [])
  if (typeof reported === 'number' && isFinite(reported) && reported > 0) current = reported
  try {
    dbpCtxMenuZoomByElement.set(element, current)
  } catch (error) {
    /* ignore */
  }
  return current
}

function dbpCtxSetZoom(element, next) {
  if (!dbpCtxIsUsable(element)) return
  const value = Number(next)
  if (!isFinite(value)) return
  const clamped = Math.min(DBP_CTX_MAX_ZOOM, Math.max(DBP_CTX_MIN_ZOOM, Math.round(value * 100) / 100))
  dbpCtxCall(element, 'setZoomFactor', [clamped])
  try {
    dbpCtxMenuZoomByElement.set(element, clamped)
  } catch (error) {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Payload + menu model
// ---------------------------------------------------------------------------
function dbpCtxBuildPayload(tabId, element, getSurface, event) {
  // Electron's <webview> forwards the context-menu args as a single `params`
  // object; older shapes put the fields directly on the DOM event. Support both.
  const params =
    event && event.params && typeof event.params === 'object' ? event.params : event || {}
  let rect = null
  try {
    if (element && typeof element.getBoundingClientRect === 'function') {
      rect = element.getBoundingClientRect()
    }
  } catch (error) {
    rect = null
  }
  const offsetX = Number(params.x)
  const offsetY = Number(params.y)
  const x = (rect ? Number(rect.left) : 0) + (isFinite(offsetX) ? offsetX : 0)
  const y = (rect ? Number(rect.top) : 0) + (isFinite(offsetY) ? offsetY : 0)
  let surface
  if (typeof getSurface === 'function') {
    try {
      surface = getSurface()
    } catch (error) {
      surface = undefined
    }
  }
  return {
    tabId,
    element,
    getSurface,
    surface,
    x: isFinite(x) ? x : 0,
    y: isFinite(y) ? y : 0,
    rect: rect
      ? {
          left: Number(rect.left) || 0,
          top: Number(rect.top) || 0,
          width: Number(rect.width) || 0,
          height: Number(rect.height) || 0,
        }
      : null,
    offsetX: isFinite(offsetX) ? offsetX : 0,
    offsetY: isFinite(offsetY) ? offsetY : 0,
    selectionText: typeof params.selectionText === 'string' ? params.selectionText : '',
    isEditable: params.isEditable === true,
    linkURL: typeof params.linkURL === 'string' ? params.linkURL : '',
    linkText: typeof params.linkText === 'string' ? params.linkText : '',
    mediaType: typeof params.mediaType === 'string' ? params.mediaType : 'none',
    srcURL: typeof params.srcURL === 'string' ? params.srcURL : '',
    pageURL: typeof params.pageURL === 'string' ? params.pageURL : '',
  }
}

function dbpCtxSeparator(id) {
  return { kind: 'separator', id }
}

function dbpCtxItem(id, label, run, options) {
  const item = { kind: 'item', id, label, run }
  if (options && options.disabled) item.disabled = true
  return item
}

function dbpCtxBuildItems(payload) {
  const items = []
  if (!payload) return items
  const element = payload.element
  const alive = dbpCtxIsUsable(element)
  const selectionText = typeof payload.selectionText === 'string' ? payload.selectionText : ''
  const hasSelection = selectionText.trim().length > 0
  const isEditable = payload.isEditable === true
  const linkURL = typeof payload.linkURL === 'string' ? payload.linkURL : ''
  const hasLink = linkURL.length > 0
  const srcURL = typeof payload.srcURL === 'string' ? payload.srcURL : ''
  const hasImage = payload.mediaType === 'image' && srcURL.length > 0

  const push = (item) => {
    if (item) items.push(item)
  }
  const separate = () => {
    if (!items.length) return
    if (items[items.length - 1].kind === 'separator') return
    items.push(dbpCtxSeparator('dbp-ctx-sep-' + items.length))
  }

  if (isEditable) {
    push(
      dbpCtxItem('dbp-ctx-cut', featureText('剪切', 'Cut'), () => {
        dbpCtxCallOnGuest(payload, 'cut')
      }, { disabled: !alive || !hasSelection })
    )
    if (hasSelection) {
      push(
        dbpCtxItem('dbp-ctx-copy', featureText('复制', 'Copy'), () => {
          dbpCtxCopySelection(payload)
        })
      )
    }
    push(
      dbpCtxItem('dbp-ctx-paste', featureText('粘贴', 'Paste'), () => {
        dbpCtxCallOnGuest(payload, 'paste')
      }, { disabled: !alive })
    )
    push(
      dbpCtxItem('dbp-ctx-select-all', featureText('全选', 'Select all'), () => {
        dbpCtxCallOnGuest(payload, 'selectAll')
      }, { disabled: !alive })
    )
  } else if (hasSelection) {
    push(
      dbpCtxItem('dbp-ctx-copy', featureText('复制', 'Copy'), () => {
        dbpCtxCopySelection(payload)
      })
    )
    push(
      dbpCtxItem('dbp-ctx-select-all', featureText('全选', 'Select all'), () => {
        dbpCtxCallOnGuest(payload, 'selectAll')
      }, { disabled: !alive })
    )
  }

  if (hasLink) {
    separate()
    push(
      dbpCtxItem('dbp-ctx-link-open-tab', featureText('在新标签页打开链接', 'Open link in new tab'), () => {
        dbpCtxOpenTab(payload, linkURL)
      })
    )
    push(
      dbpCtxItem('dbp-ctx-link-copy', featureText('复制链接地址', 'Copy link address'), () => {
        dbpCtxCopyText(linkURL)
      })
    )
    push(
      dbpCtxItem('dbp-ctx-link-chrome', featureText('用 Chrome 打开链接', 'Open link in Chrome'), () => {
        dbpCtxOpenInChrome(linkURL)
      })
    )
  }

  if (hasImage) {
    // An image inside a link gets both sections; the open/copy items are only
    // duplicated when the image URL differs from the link target.
    const sameAsLink = hasLink && srcURL === linkURL
    separate()
    if (!sameAsLink) {
      push(
        dbpCtxItem('dbp-ctx-image-open-tab', featureText('在新标签页打开图片', 'Open image in new tab'), () => {
          dbpCtxOpenTab(payload, srcURL)
        })
      )
    }
    push(
      dbpCtxItem('dbp-ctx-image-copy', featureText('复制图片地址', 'Copy image address'), () => {
        dbpCtxCopyText(srcURL)
      })
    )
    if (!sameAsLink) {
      push(
        dbpCtxItem('dbp-ctx-image-chrome', featureText('用 Chrome 打开图片', 'Open image in Chrome'), () => {
          dbpCtxOpenInChrome(srcURL)
        })
      )
    }
  }

  // Page-level actions: always available, they apply wherever the click landed.
  separate()
  const pageURL = dbpCtxPageUrl(payload)
  push(
    dbpCtxItem('dbp-ctx-back', featureText('后退', 'Back'), () => {
      if (dbpCtxCanGo(element, 'canGoBack')) dbpCtxCall(element, 'goBack', [])
    }, { disabled: !alive || !dbpCtxCanGo(element, 'canGoBack') })
  )
  push(
    dbpCtxItem('dbp-ctx-forward', featureText('前进', 'Forward'), () => {
      if (dbpCtxCanGo(element, 'canGoForward')) dbpCtxCall(element, 'goForward', [])
    }, { disabled: !alive || !dbpCtxCanGo(element, 'canGoForward') })
  )
  push(
    dbpCtxItem('dbp-ctx-reload', featureText('刷新', 'Reload'), () => {
      dbpCtxCall(element, 'reload', [])
    }, { disabled: !alive })
  )

  separate()
  push(
    dbpCtxItem('dbp-ctx-copy-page-url', featureText('复制页面地址', 'Copy page URL'), () => {
      dbpCtxCopyText(dbpCtxPageUrl(payload))
    }, { disabled: !pageURL })
  )
  push(
    dbpCtxItem('dbp-ctx-page-chrome', featureText('用 Chrome 打开此页', 'Open page in Chrome'), () => {
      dbpCtxOpenInChrome(dbpCtxPageUrl(payload))
    }, { disabled: !pageURL })
  )

  separate()
  const zoom = alive ? dbpCtxGetZoom(element) : 1
  push(
    dbpCtxItem('dbp-ctx-zoom-in', featureText('放大', 'Zoom in'), () => {
      dbpCtxSetZoom(element, dbpCtxGetZoom(element) + DBP_CTX_ZOOM_STEP)
    }, { disabled: !alive || zoom >= DBP_CTX_MAX_ZOOM - 0.001 })
  )
  push(
    dbpCtxItem('dbp-ctx-zoom-out', featureText('缩小', 'Zoom out'), () => {
      dbpCtxSetZoom(element, dbpCtxGetZoom(element) - DBP_CTX_ZOOM_STEP)
    }, { disabled: !alive || zoom <= DBP_CTX_MIN_ZOOM + 0.001 })
  )
  push(
    dbpCtxItem('dbp-ctx-zoom-reset', featureText('重置缩放', 'Reset zoom'), () => {
      dbpCtxSetZoom(element, 1)
    }, { disabled: !alive || Math.abs(zoom - 1) < 0.001 })
  )

  return items
}

function dbpCtxRunItem(item, close) {
  try {
    if (typeof close === 'function') close()
  } catch (error) {
    /* ignore */
  }
  if (!item || typeof item.run !== 'function') return
  try {
    item.run()
  } catch (error) {
    /* never let a menu action break the panel */
  }
}

// ---------------------------------------------------------------------------
// Guest pointer probe + context-menu forwarding
//
// `params.x/y` from Electron are not reliable enough for DOM overlays (they can
// be screen-, window- or guest-relative depending on the Electron/Chromium
// version). Ask the guest page for the click position of its own contextmenu
// event instead — it is always in guest CSS pixels, so rect.left/top + point is
// stable. The params payload remains the fallback.
// ---------------------------------------------------------------------------
const DBP_CTX_PROBE_INSTALL =
  "(function(){try{if(window.__dshCtxProbeInstalled)return;window.__dshCtxProbeInstalled=true;window.addEventListener('contextmenu',function(e){try{window.__dshCtxPoint={x:e.clientX,y:e.clientY,t:Date.now()};}catch(_){}},true);}catch(_){}})();"
const DBP_CTX_PROBE_READ =
  "(function(){try{var p=window.__dshCtxPoint;var now=Date.now();var s='';try{s=window.getSelection?window.getSelection().toString():'';}catch(_){}return {point:p&&now-p.t<5000?{x:p.x,y:p.y}:null,selection:s?String(s).slice(0,2000):''};}catch(_){return null;}})();"

function dbpCtxInstallProbe(element) {
  try {
    if (!element || typeof element.executeJavaScript !== 'function') return
    Promise.resolve(element.executeJavaScript(DBP_CTX_PROBE_INSTALL, false)).catch(() => undefined)
  } catch (error) {
    /* older Electron or a destroyed guest */
  }
}

async function dbpCtxForwardContextMenu(payload) {
  let next = payload
  try {
    const element = payload && payload.element
    if (element && typeof element.executeJavaScript === 'function' && dbpCtxIsUsable(element)) {
      const probe = await Promise.race([
        Promise.resolve(element.executeJavaScript(DBP_CTX_PROBE_READ, false)),
        new Promise((resolve) => setTimeout(() => resolve(null), 120)),
      ])
      if (probe && typeof probe === 'object') {
        const point = probe.point
        if (point && isFinite(point.x) && isFinite(point.y)) {
          const rect = payload.rect || { left: 0, top: 0 }
          next = Object.assign({}, payload, {
            point: { x: Number(point.x), y: Number(point.y) },
            x: (Number(rect.left) || 0) + Number(point.x),
            y: (Number(rect.top) || 0) + Number(point.y),
          })
        }
        if (!next.selectionText && typeof probe.selection === 'string' && probe.selection) {
          next = Object.assign({}, next, { selectionText: probe.selection })
        }
      }
    }
  } catch (error) {
    /* keep the params-based fallback */
  }
  try {
    dbpCtxMenuBus.emit(next)
  } catch (error) {
    /* a broken menu must not break the panel */
  }
}

featureGuestHooks.push(({ tabId, element, getSurface }) => {
  if (!element || typeof element.addEventListener !== 'function') return
  const install = () => dbpCtxInstallProbe(element)
  element.addEventListener('dom-ready', install)
  element.addEventListener('did-navigate', install)
  element.addEventListener('did-stop-loading', install)
  install()
  element.addEventListener('context-menu', (event) => {
    try {
      if (!event) return
      if (!dbpCtxIsUsable(element)) return
      if (typeof event.preventDefault === 'function') event.preventDefault()
      void dbpCtxForwardContextMenu(dbpCtxBuildPayload(tabId, element, getSurface, event))
    } catch (error) {
      /* a broken menu must not break the guest page */
    }
  })
})

// ---------------------------------------------------------------------------
// Overlay component
// ---------------------------------------------------------------------------
function DbpContextMenuOverlay({ surface }) {
  const [menu, setMenu] = React.useState(null)
  const menuRef = React.useRef(null)
  const [size, setSize] = React.useState({
    width: DBP_CTX_ESTIMATED_WIDTH,
    height: DBP_CTX_ESTIMATED_ITEM_HEIGHT * 6,
  })

  const close = React.useCallback(() => {
    setMenu(null)
  }, [])

  // Listen for right-clicks forwarded by the guest hooks.
  React.useEffect(() => {
    const unsubscribe = dbpCtxMenuBus.subscribe((payload) => {
      try {
        if (!payload || !dbpCtxIsUsable(payload.element)) return
        setMenu(payload)
      } catch (error) {
        /* ignore */
      }
    })
    return unsubscribe
  }, [])

  // Close when the active tab changes underneath the menu.
  const activeId = surface && surface.activeId
  React.useEffect(() => {
    if (activeId === undefined) return
    setMenu((current) => {
      if (!current) return current
      return current.tabId === activeId ? current : null
    })
  }, [activeId])

  // Dismissal: outside pointer, Escape, scroll, resize, window blur.
  React.useEffect(() => {
    if (!menu) return undefined
    const onKeyDown = (event) => {
      try {
        if (!event) return
        if (event.key !== 'Escape' && event.key !== 'Esc') return
        if (typeof event.preventDefault === 'function') event.preventDefault()
        if (typeof event.stopPropagation === 'function') event.stopPropagation()
        close()
      } catch (error) {
        /* ignore */
      }
    }
    const onPointerDown = (event) => {
      try {
        const node = menuRef.current
        if (node && event && event.target && typeof node.contains === 'function' && node.contains(event.target)) {
          return
        }
        close()
      } catch (error) {
        /* ignore */
      }
    }
    const onDismiss = () => close()
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('resize', onDismiss)
    window.addEventListener('scroll', onDismiss, true)
    window.addEventListener('blur', onDismiss)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('resize', onDismiss)
      window.removeEventListener('scroll', onDismiss, true)
      window.removeEventListener('blur', onDismiss)
    }
  }, [menu, close])

  // Keep keyboard focus inside the menu so Escape / arrows reach the embedder
  // (a focused guest page would swallow key events).
  React.useEffect(() => {
    if (!menu) return
    const node = menuRef.current
    if (!node || typeof node.focus !== 'function') return
    try {
      node.focus({ preventScroll: true })
    } catch (error) {
      try {
        node.focus()
      } catch (innerError) {
        /* ignore */
      }
    }
  }, [menu])

  const items = React.useMemo(() => dbpCtxBuildItems(menu), [menu])

  // Measure the real menu box, then clamp the anchor point into the viewport.
  React.useLayoutEffect(() => {
    if (!menu) return
    const node = menuRef.current
    if (!node || typeof node.getBoundingClientRect !== 'function') return
    let rect
    try {
      rect = node.getBoundingClientRect()
    } catch (error) {
      return
    }
    const nextWidth = Math.max(1, Math.round(Number(rect.width) || 0))
    const nextHeight = Math.max(1, Math.round(Number(rect.height) || 0))
    setSize((previous) => {
      if (previous.width === nextWidth && previous.height === nextHeight) return previous
      return { width: nextWidth, height: nextHeight }
    })
  })

  if (!menu) return null

  let viewportWidth = 0
  let viewportHeight = 0
  try {
    viewportWidth = Number(window.innerWidth) || 0
    viewportHeight = Number(window.innerHeight) || 0
  } catch (error) {
    viewportWidth = 0
    viewportHeight = 0
  }
  if (!viewportWidth) viewportWidth = 1024
  if (!viewportHeight) viewportHeight = 768

  const menuWidth = size.width || DBP_CTX_ESTIMATED_WIDTH
  const menuHeight = size.height || items.length * DBP_CTX_ESTIMATED_ITEM_HEIGHT
  const maxLeft = Math.max(DBP_CTX_MARGIN, viewportWidth - menuWidth - DBP_CTX_MARGIN)
  const maxTop = Math.max(DBP_CTX_MARGIN, viewportHeight - menuHeight - DBP_CTX_MARGIN)
  const left = Math.round(Math.min(Math.max(DBP_CTX_MARGIN, Number(menu.x) || 0), maxLeft))
  const top = Math.round(Math.min(Math.max(DBP_CTX_MARGIN, Number(menu.y) || 0), maxTop))

  const onMenuKeyDown = (event) => {
    try {
      const key = event && event.key
      if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return
      const node = menuRef.current
      if (!node || typeof node.querySelectorAll !== 'function') return
      const buttons = Array.from(node.querySelectorAll('button:not([disabled])'))
      if (!buttons.length) return
      if (typeof event.preventDefault === 'function') event.preventDefault()
      const current = buttons.indexOf(document.activeElement)
      let next = 0
      if (key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % buttons.length
      else if (key === 'ArrowUp') next = current <= 0 ? buttons.length - 1 : current - 1
      else if (key === 'Home') next = 0
      else next = buttons.length - 1
      try {
        buttons[next].focus()
      } catch (error) {
        /* ignore */
      }
    } catch (error) {
      /* ignore */
    }
  }

  return h(
    'div',
    {
      className: 'dbp-ctx-backdrop',
      onPointerDown: (event) => {
        try {
          const node = menuRef.current
          if (node && event && event.target && node.contains(event.target)) return
          close()
        } catch (error) {
          /* ignore */
        }
      },
      onContextMenu: (event) => {
        try {
          if (event && typeof event.preventDefault === 'function') event.preventDefault()
        } catch (error) {
          /* ignore */
        }
        close()
      },
      onWheel: (event) => {
        // Scrolling the tall menu itself must not dismiss it; wheel anywhere
        // else (usually over the guest page) closes.
        try {
          const node = menuRef.current
          if (node && event && event.target && node.contains(event.target)) return
        } catch (error) {
          /* ignore */
        }
        close()
      },
    },
    h(
      'div',
      {
        ref: menuRef,
        className: 'dbp-ctx-menu',
        role: 'menu',
        tabIndex: -1,
        'aria-label': featureText('页面菜单', 'Page menu'),
        style: { left: left + 'px', top: top + 'px' },
        onPointerDown: (event) => {
          try {
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
          } catch (error) {
            /* ignore */
          }
        },
        onContextMenu: (event) => {
          try {
            if (event && typeof event.preventDefault === 'function') event.preventDefault()
          } catch (error) {
            /* ignore */
          }
        },
        onKeyDown: onMenuKeyDown,
      },
      items.map((item) => {
        if (item.kind === 'separator') {
          return h('div', {
            key: item.id,
            className: 'dbp-ctx-separator',
            role: 'separator',
          })
        }
        return h(
          'button',
          {
            key: item.id,
            type: 'button',
            role: 'menuitem',
            className: 'dbp-ctx-item',
            disabled: !!item.disabled,
            onClick: () => dbpCtxRunItem(item, close),
          },
          item.label
        )
      })
    )
  )
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
featureCss.push(
  [
    '.dbp-ctx-backdrop{position:fixed;inset:0;z-index:2147483000;background:transparent}',
    '.dbp-ctx-menu{position:fixed;z-index:2147483001;box-sizing:border-box;min-width:196px;max-width:280px;max-height:calc(100vh - 16px);padding:4px;overflow-y:auto;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.2;outline:0;user-select:none;-webkit-user-select:none}',
    '.dbp-ctx-item{display:flex;align-items:center;width:100%;height:28px;padding:0 8px;border:0;border-radius:5px;background:transparent;color:inherit;font-size:12px;font-family:inherit;text-align:left;white-space:nowrap;cursor:pointer}',
    '.dbp-ctx-item:hover:not(:disabled),.dbp-ctx-item:focus-visible:not(:disabled){background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);color:var(--dsw-alias-brand-primary);outline:0}',
    '.dbp-ctx-item:disabled{color:var(--dsw-alias-state-idle-primary);cursor:default}',
    '.dbp-ctx-separator{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1)}',
  ].join('\n')
)

featureOverlays.push(DbpContextMenuOverlay)
