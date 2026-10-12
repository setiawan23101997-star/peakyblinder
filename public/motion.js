/* ==========================================================================
   PeakyBlinder · motion.js
   Interactive effects for the clan portal (pairs with motion.css).

   - Cursor glow: a soft light follows your mouse across cards and panels.
   - Card tilt: cards lean toward the mouse (full-motion devices only).
   - Click ripple: buttons and cards answer a click with a light ripple.
   - Scroll reveal: cards and rows further down fade/rise in as you reach them.
   - Page entrance plays once per page (no full-page blink when the app
     re-creates a page while reloading data).

   Safe with React: it never adds or removes elements inside the app. It only
   sets data-* attributes and CSS variables, and draws ripples in its own
   layer on <body>. Everything is event-delegated, so new pages and cards are
   picked up automatically.
   ========================================================================== */
(() => {
  if (typeof window === 'undefined' || window.__pbMotion) return
  window.__pbMotion = true

  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)')
  const hoverMQ = window.matchMedia('(hover: hover) and (pointer: fine)')
  const reduced = () => reduceMQ.matches
  const canHover = () => hoverMQ.matches

  /* ── What reacts ─────────────────────────────────────────────────────── */

  // Get the cursor glow (and tilt, for the cards)
  const GLOW_SEL = [
    '.mb-card', '.ag-lift', '.db-lift', '.ec-row',
    '.db-glass', '.ag-glass', '.at-glass', '.mb-glass', '.ec-glass', '.pb-card',
  ].join(',')
  const TILT_SEL = '.mb-card, .ag-lift, .db-lift'

  // Get a click ripple
  const RIPPLE_SEL = [
    'button:not(:disabled)', 'a[href]', '[role="tab"]', '[role="button"]',
  ].join(',')

  // Fade/rise in when scrolled into view
  const REVEAL_SEL = [
    '.mb-card', '.ag-lift', '.ec-row', '.db-lift',
    '.ag-root li', '.at-root li', '.ec-root aside li',
  ].join(',')

  /* ── Cursor glow + tilt ──────────────────────────────────────────────── */

  let hot = null          // element under the cursor
  let pending = null      // latest pointer event, handled once per frame
  let frame = 0

  function setHot(el) {
    if (hot === el) return
    if (hot) {
      delete hot.dataset.pbmHot
      hot.style.removeProperty('--pbm-rx')
      hot.style.removeProperty('--pbm-ry')
    }
    hot = el
    if (hot) hot.dataset.pbmHot = ''
  }

  function paint() {
    frame = 0
    const e = pending
    if (!e || !hot) return
    const r = hot.getBoundingClientRect()
    if (!r.width || !r.height) return
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    hot.style.setProperty('--pbm-x', `${x}px`)
    hot.style.setProperty('--pbm-y', `${y}px`)
    if (!reduced() && hot.matches(TILT_SEL)) {
      // Max ~5° each way; keeps cards readable
      const rx = ((y / r.height) - 0.5) * -10
      const ry = ((x / r.width) - 0.5) * 10
      hot.style.setProperty('--pbm-rx', `${rx.toFixed(2)}deg`)
      hot.style.setProperty('--pbm-ry', `${ry.toFixed(2)}deg`)
    }
  }

  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !canHover()) return
    // The innermost card wins over the panel around it
    const target = e.target instanceof Element ? e.target.closest(GLOW_SEL) : null
    setHot(target)
    pending = e
    if (target && !frame) frame = requestAnimationFrame(paint)
  }, { passive: true })

  document.addEventListener('pointerleave', () => setHot(null), { passive: true })
  window.addEventListener('blur', () => setHot(null))

  /* ── Click ripple ────────────────────────────────────────────────────── */

  let layer = null
  function rippleLayer() {
    if (layer && layer.isConnected) return layer
    layer = document.createElement('div')
    layer.className = 'pbm-ripple-layer'
    layer.setAttribute('aria-hidden', 'true')
    document.body.appendChild(layer)
    return layer
  }

  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return
    const el = e.target instanceof Element ? e.target.closest(RIPPLE_SEL) : null
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width < 8 || r.height < 8 || r.width > 900) return

    const cs = getComputedStyle(el)
    // A clipping box shaped like the element, drawn in our own layer
    const box = document.createElement('div')
    box.className = 'pbm-ripple-box'
    box.style.left = `${r.left}px`
    box.style.top = `${r.top}px`
    box.style.width = `${r.width}px`
    box.style.height = `${r.height}px`
    box.style.borderRadius = cs.borderRadius

    const size = Math.hypot(r.width, r.height) * 2
    const dot = document.createElement('span')
    dot.className = 'pbm-ripple'
    dot.style.width = dot.style.height = `${size}px`
    dot.style.left = `${e.clientX - r.left - size / 2}px`
    dot.style.top = `${e.clientY - r.top - size / 2}px`
    // Gold buttons get a light ripple, everything else a warm gold one
    if (el.matches('.btn-gold, .pb-submit')) dot.dataset.tone = 'light'

    box.appendChild(dot)
    rippleLayer().appendChild(box)
    setTimeout(() => box.remove(), 650)
  }, { passive: true })

  /* ── Scroll reveal ───────────────────────────────────────────────────── */

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target
          io.unobserve(el)
          el.dataset.pbmReveal = 'in'
          // Hand control back to the page's own hover transitions afterwards
          setTimeout(() => { if (el.dataset.pbmReveal === 'in') el.dataset.pbmReveal = 'done' }, 750)
        }
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 })
    : null

  const seen = new WeakSet()
  let scanQueued = false

  function scan() {
    scanQueued = false
    if (!io) return
    const limit = window.innerHeight
    const candidates = document.querySelectorAll(REVEAL_SEL)
    for (const el of candidates) {
      if (seen.has(el)) continue
      seen.add(el)
      // Only hide things that start below the visible screen; the rest are
      // already handled by motion.css's page entrance.
      const top = el.getBoundingClientRect().top
      if (top > limit) {
        el.dataset.pbmReveal = 'wait'
        io.observe(el)
      }
    }
  }

  function queueScan() {
    if (scanQueued) return
    scanQueued = true
    requestAnimationFrame(() => setTimeout(scan, 0))
  }

  /* ── Page entrance plays once per page ───────────────────────────────── */
  // motion.css only runs entrance animations while <html> lacks .pbm-settled.
  // We add it shortly after a page opens. If the app later re-creates the
  // same page (e.g. while reloading data) nothing fades in again, so the page
  // no longer blinks. Switching to a different page replays the entrance.
  const html = document.documentElement
  const PAGE_KINDS = ['db-root', 'ag-root', 'at-root', 'mb-root', 'ec-root']
  const PAGE_SEL = PAGE_KINDS.map(c => '.' + c).join(',')
  let currentPage = null
  let settleTimer = 0

  function checkPage() {
    const el = document.querySelector(PAGE_SEL)
    if (!el) return // loading screen etc.: keep remembering the last page
    const kind = PAGE_KINDS.find(c => el.classList.contains(c))
    if (!kind || kind === currentPage) return
    currentPage = kind
    html.classList.remove('pbm-settled')
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => html.classList.add('pbm-settled'), 1500)
  }

  function start() {
    const root = document.getElementById('root') || document.body
    new MutationObserver(muts => {
      for (const m of muts) {
        if (m.addedNodes.length) { checkPage(); queueScan(); break }
      }
    }).observe(root, { childList: true, subtree: true })
    checkPage()
    queueScan()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
