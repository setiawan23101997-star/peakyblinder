import React, { useState, useEffect, useMemo, useId, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

const RARITY = {
  material:   { label: 'Material',  color: '#ffffff', rgb: '255,255,255' },
  common:   { label: 'Common',    color: '#4ade80', rgb: '74,222,128' },
  uncommon:   { label: 'Uncommon',  color: '#ffffff', rgb: '255,255,255' },
  rare:       { label: 'Rare',      color: '#60a5fa', rgb: '96,165,250' },
  epic:       { label: 'Epic',      color: '#f87171', rgb: '248,113,113' },
  legendary:  { label: 'Legendary', color: '#f2cc60', rgb: '242,204,76' },
}

const GLOW_RARITIES = new Set(['legendary'])
const URGENT_MS = 5 * 60 * 1000
const MAX_FEATURED = 3 // how many live lots can be featured at the same time
const BID_LOCK_MS = 30 * 1000
const MAX_BID_CHANGES = 2
const MAX_BID_SUBMISSIONS = 1 + MAX_BID_CHANGES

const SERVER_TZ_LABEL = 'UTC+08:00 (GMT+8)'
const SERVER_TZ_SHORT = 'UTC+08:00'
const SERVER_TZ_NAME = 'GMT+8'

// The auction clock is intentionally anchored to the game's fixed UTC+8 server time.
// All displayed auction timestamps are converted to this server wall-clock time.
function ServerTimeLabel({ compact = false }) {
  return compact ? SERVER_TZ_SHORT : `${SERVER_TZ_LABEL}`
}

const presetDescriptions = [
  '',
  'World Boss Drop',
  'Epic Weapon Drop',
  'Rare Armor Piece',
  'Legendary Material',
  'Clan Event Reward',
  'Auction House Special',
  'Crafted by Master',
  'Cross-Server Reward',
  'Ranking Prize',
  'Custom...',
]

const IMAGE_BUCKET = 'auction-images'
const ENDED_PAGE_SIZE = 50

// Compress newly selected PNG/JPG/WebP images in the browser before upload.
// Keep the output below Supabase Storage's existing 2 MB object limit.
const MAX_STORAGE_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024
const TARGET_WEBP_BYTES = Math.floor(1.8 * 1024 * 1024)
const MAX_WEBP_DIMENSION = 1600

function decodeImageFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read this image. Please choose another PNG or JPG.'))
    }
    image.src = objectUrl
  })
}

function canvasToWebPBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Image compression failed. Please choose another image.'))
        return
      }
      if (blob.type !== 'image/webp') {
        reject(new Error('Your browser could not convert this image to WebP. Please use a recent version of Chrome, Edge, or Firefox.'))
        return
      }
      resolve(blob)
    }, 'image/webp', quality)
  })
}

async function compressAuctionImageToWebP(file) {
  // Preserve GIF animation. GIFs continue using the existing 2 MB limit.
  if (file.type === 'image/gif') {
    if (file.size > MAX_STORAGE_IMAGE_BYTES) {
      throw new Error('GIF images must be under 2 MB so their animation is preserved.')
    }
    return file
  }

  const convertibleTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
  if (!convertibleTypes.has(file.type)) {
    if (file.size > MAX_STORAGE_IMAGE_BYTES) {
      throw new Error('Only PNG, JPG, and WebP images can be automatically compressed. Other image formats must be under 2 MB.')
    }
    return file
  }

  // A small WebP is already optimized enough; no need to recompress it.
  if (file.type === 'image/webp' && file.size <= TARGET_WEBP_BYTES) return file

  const image = await decodeImageFile(file)
  const originalWidth = image.naturalWidth || image.width
  const originalHeight = image.naturalHeight || image.height
  if (!originalWidth || !originalHeight) {
    throw new Error('This image has invalid dimensions. Please choose another image.')
  }

  const initialScale = Math.min(1, MAX_WEBP_DIMENSION / Math.max(originalWidth, originalHeight))
  const baseWidth = Math.max(1, Math.round(originalWidth * initialScale))
  const baseHeight = Math.max(1, Math.round(originalHeight * initialScale))
  const dimensionScales = [1, 0.85, 0.7, 0.55, 0.4]
  const qualityLevels = [0.86, 0.78, 0.70, 0.62]

  for (const dimensionScale of dimensionScales) {
    const width = Math.max(1, Math.round(baseWidth * dimensionScale))
    const height = Math.max(1, Math.round(baseHeight * dimensionScale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare this image for compression.')

    // WebP supports transparency, so transparent PNG auction art remains transparent.
    context.drawImage(image, 0, 0, width, height)

    for (const quality of qualityLevels) {
      const blob = await canvasToWebPBlob(canvas, quality)
      if (blob.size <= TARGET_WEBP_BYTES && blob.size <= MAX_STORAGE_IMAGE_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'auction-image'
        return new File([blob], `${baseName}.webp`, {
          type: 'image/webp',
          lastModified: Date.now(),
        })
      }
    }
  }

  throw new Error('This image is still too large after compression. Please choose a smaller image.')
}

// Glassmorphism / liquid-glass styling for this page. Only top-level surfaces
// use backdrop-filter; panels nested inside them use translucent fills, because
// a blurred element inside another blurred element loses its own blur.
const AG_STYLES = `
  .ag-root .ag-glass {
    background:
      radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,.08) 0%, transparent 50%),
      linear-gradient(160deg, rgba(34,28,22,.55) 0%, rgba(12,10,8,.62) 100%);
    backdrop-filter: blur(22px) saturate(160%);
    -webkit-backdrop-filter: blur(22px) saturate(160%);
    border: 1px solid rgba(255,255,255,.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 22px 60px -30px rgba(0,0,0,.85);
  }
  .ag-root .ag-glass--thin {
    background: linear-gradient(160deg, rgba(255,255,255,.055) 0%, rgba(255,255,255,.015) 100%);
    backdrop-filter: blur(16px) saturate(150%);
    -webkit-backdrop-filter: blur(16px) saturate(150%);
  }
  /* Refractive rim; cards can tint it with --ag-rim */
  .ag-root .ag-glass::before {
    content: '';
    position: absolute;
    inset: 0;
    padding: 1px;
    border-radius: inherit;
    background: linear-gradient(140deg,
      rgba(255,255,255,.38) 0%,
      rgba(255,255,255,.04) 35%,
      var(--ag-rim, rgba(201,162,75,.26)) 70%,
      rgba(255,255,255,.1) 100%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
  /* Same look as glass, but no live blur: used for repeated surfaces
     (auction cards, archive list) so long pages stay smooth on phones. */
  .ag-root .ag-glass.ag-solid {
    background:
      radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,.06) 0%, transparent 50%),
      linear-gradient(160deg, rgba(30,25,20,.94) 0%, rgba(13,11,9,.96) 100%);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .ag-root .ag-lift {
    transition: transform .25s cubic-bezier(.2,.8,.2,1), border-color .25s ease, box-shadow .25s ease;
  }
  .ag-root .ag-lift:hover {
    transform: translateY(-2px);
    border-color: rgba(255,255,255,.14);
  }

  /* Panels inside glass surfaces */
  .ag-root .ag-inset {
    background: linear-gradient(180deg, rgba(255,255,255,.05) 0%, rgba(255,255,255,.018) 100%);
    border: 1px solid rgba(255,255,255,.07);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.07);
  }
  .ag-root .ag-inset.ag-inset-gold {
    background: linear-gradient(160deg, rgba(201,162,75,.11) 0%, rgba(201,162,75,.025) 100%);
    border-color: rgba(235,208,141,.18);
    box-shadow: inset 0 1px 0 rgba(255,240,200,.1);
  }
  .ag-root .ag-well {
    background: rgba(0,0,0,.22);
    border: 1px solid rgba(255,255,255,.06);
    box-shadow: inset 0 2px 6px rgba(0,0,0,.3), 0 1px 0 rgba(255,255,255,.04);
  }
  .ag-root .ag-well.ag-well-gold {
    background: linear-gradient(180deg, rgba(0,0,0,.18) 0%, rgba(201,162,75,.07) 100%);
    border-color: rgba(235,208,141,.14);
  }

  /* Small glass controls */
  .ag-root .ag-chip {
    background: linear-gradient(180deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.025) 100%);
    border: 1px solid rgba(255,255,255,.1);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 4px 14px -8px rgba(0,0,0,.5);
    transition: background .2s ease, border-color .2s ease, color .2s ease;
  }
  .ag-root button.ag-chip:hover {
    background: linear-gradient(180deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.04) 100%);
    border-color: rgba(235,208,141,.28);
  }
  .ag-root .ag-chip.ag-chip-gold {
    background: linear-gradient(180deg, rgba(201,162,75,.18) 0%, rgba(201,162,75,.05) 100%);
    border-color: rgba(235,208,141,.28);
  }
  .ag-root .ag-chip.ag-chip-red {
    background: linear-gradient(180deg, rgba(239,68,68,.14) 0%, rgba(239,68,68,.04) 100%);
    border-color: rgba(248,113,113,.28);
  }
  .ag-root .ag-emblem {
    background:
      radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,.3) 0%, transparent 60%),
      linear-gradient(160deg, rgba(201,162,75,.28) 0%, rgba(201,162,75,.07) 100%);
    border: 1px solid rgba(255,255,255,.2);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 6px 18px -8px rgba(201,162,75,.5);
  }

  /* Inputs become recessed glass wells */
  .ag-root .input {
    background: linear-gradient(180deg, rgba(0,0,0,.32) 0%, rgba(0,0,0,.16) 100%);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px;
    box-shadow: inset 0 2px 6px rgba(0,0,0,.3), 0 1px 0 rgba(255,255,255,.05);
    transition: border-color .2s ease, box-shadow .2s ease;
  }
  .ag-root .input:focus {
    outline: none;
    border-color: rgba(235,208,141,.55);
    box-shadow: inset 0 2px 6px rgba(0,0,0,.28), 0 0 0 3px rgba(201,162,75,.2);
  }
  .ag-root select.input option { background: #15110e; color: #f4ebd9; }

  /* Liquid brass buttons */
  .ag-root .btn-gold {
    border: 1px solid rgba(255,240,200,.5);
    border-radius: 999px;
    color: #1a140b;
    background: linear-gradient(180deg,
      rgba(255,246,214,.96) 0%,
      rgba(235,208,141,.95) 20%,
      rgba(201,162,75,.93) 58%,
      rgba(160,122,46,.96) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.7),
      inset 0 -3px 8px rgba(90,60,10,.32),
      0 10px 24px -10px rgba(201,162,75,.6);
    transition: transform .2s ease, filter .2s ease, box-shadow .2s ease;
  }
  .ag-root .btn-gold:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.06);
  }
  .ag-root .btn-gold:active:not(:disabled) { transform: none; }
  .ag-root .btn-gold:disabled { opacity: .6; cursor: progress; }

  /* Readability on glass: brighter secondary text, smoother rendering */
  .ag-root { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  .ag-root .text-text-dim { color: #c9bda8; }
  .ag-root .font-mono { font-family: inherit; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; letter-spacing: -0.01em; }

  /* Confirm dialog */
  .ag-scrim {
    background: rgba(5,4,3,.58);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: ag-fade .18s ease-out both;
  }
  .ag-root .ag-dialog {
    --ag-rim: rgba(235,208,141,.4);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 40px 90px -20px rgba(0,0,0,.85);
    animation: ag-pop .22s cubic-bezier(.2,.8,.2,1) both;
  }
  .ag-root .ag-emblem-danger {
    background:
      radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,.25) 0%, transparent 60%),
      linear-gradient(160deg, rgba(239,68,68,.3) 0%, rgba(239,68,68,.08) 100%);
    border: 1px solid rgba(255,180,170,.28);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 6px 18px -8px rgba(239,68,68,.5);
    font-weight: 800;
  }
  .ag-root .ag-btn-danger {
    color: #fff5f3;
    border: 1px solid rgba(255,190,180,.45);
    background: linear-gradient(180deg, rgba(248,113,113,.95) 0%, rgba(220,38,38,.92) 60%, rgba(170,28,28,.95) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.45), inset 0 -3px 8px rgba(90,10,10,.3), 0 10px 24px -10px rgba(239,68,68,.6);
    transition: transform .2s ease, filter .2s ease;
  }
  .ag-root .ag-btn-danger:hover { transform: translateY(-1px); filter: brightness(1.06); }
  @keyframes ag-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ag-pop {
    from { opacity: 0; transform: translateY(10px) scale(.97); }
    to   { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ag-scrim, .ag-root .ag-dialog { animation: none; }
  }

  /* ── Featured tiles: animated "showcase" ─────────────────────────── */
  @keyframes ag-ft-in   { from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: none; } }
  @keyframes ag-spin    { to { rotate: 360deg; } }
  @keyframes ag-float   { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes ag-dash    { to { stroke-dashoffset: -100; } }
  @keyframes ag-rise    { 0% { transform: translateY(0) scale(.6); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-120px) scale(1); opacity: 0; } }
  @keyframes ag-breathe { 0%, 100% { opacity: .72; transform: scale(.97); } 50% { opacity: 1; transform: scale(1.03); } }

  /* Entrance plays once (motion.js adds .pbm-settled after the page opens) */
  html:not(.pbm-settled) .ag-root .ag-ft { animation: ag-ft-in .65s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--ag-d, 0ms); }

  /* Light that runs around the card edge: an SVG outline, so it moves at
     the same speed along every side (no crawling / racing on wide cards) */
  .ag-root .ag-ft-ring {
    position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1;
    overflow: visible; pointer-events: none;
  }
  .ag-root .ag-ft-ring rect {
    fill: none; stroke: var(--ag-c); stroke-width: 1.6; stroke-linecap: round;
    stroke-dasharray: 9 41; /* two soft lights, opposite each other */
    filter: drop-shadow(0 0 4px var(--ag-c));
    animation: ag-dash 12s linear infinite; animation-delay: calc(var(--ag-d, 0ms) * -10);
  }

  /* Featured tile header: picture | info | countdown.
     Narrow cards put the countdown under the name instead. */
  .ag-root .ag-ft-body { container: agft / inline-size; }
  .ag-root .ag-ft-head {
    display: grid; column-gap: 14px; row-gap: 6px;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: "stage info" "stage time";
  }
  .ag-root .ag-ft-head-stage { grid-area: stage; }
  .ag-root .ag-ft-head-info  { grid-area: info; align-self: start; }
  /* Countdown box: full width under the name; date on the right */
  .ag-root .ag-ft-head-time {
    grid-area: time; align-self: end;
    display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; column-gap: 10px; row-gap: 2px;
    padding: 8px 12px; border-radius: 13px;
    background: rgba(0,0,0,.24); border: 1px solid rgba(255,255,255,.07);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
  }
  .ag-root .ag-ft-date { text-align: right; padding-bottom: 2px; white-space: nowrap; }
  .ag-root .ag-ft-count { font-size: 22px; white-space: nowrap; }
  /* Wide cards: countdown box moves to the right of the name */
  @container agft (min-width: 520px) {
    .ag-root .ag-ft-head {
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas: "stage info time";
    }
    .ag-root .ag-ft-head-time { flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; padding: 10px 14px; }
    .ag-root .ag-ft-count { font-size: 28px; }
  }

  /* Square image stage */
  .ag-root .ag-ft-stage {
    position: relative; overflow: hidden; border-radius: 18px; isolation: isolate;
    border: 1px solid var(--ag-c-line); background: rgba(0,0,0,.42);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 14px 30px -18px var(--ag-c-glow);
  }
  .ag-root .ag-ft-amb {
    position: absolute; inset: -20%; width: 140%; height: 140%; max-width: none; object-fit: cover;
    filter: blur(22px) saturate(1.5); opacity: .5; z-index: -2; pointer-events: none;
  }
  .ag-root .ag-ft-glow {
    position: absolute; left: 50%; top: 50%; width: 120%; height: 120%; translate: -50% -50%; z-index: -1;
    border-radius: 50%; background: radial-gradient(circle, var(--ag-c-glow) 0%, transparent 62%);
    animation: ag-breathe 6s ease-in-out infinite; will-change: transform, opacity;
  }
  .ag-root .ag-ft-rays {
    position: absolute; left: 50%; top: 50%; width: 240%; height: 240%; translate: -50% -50%; z-index: -1;
    background: repeating-conic-gradient(from 0deg, transparent 0deg 10deg, var(--ag-c-ray) 13deg, transparent 16deg 26deg);
    -webkit-mask: radial-gradient(circle, #000 10%, transparent 50%); mask: radial-gradient(circle, #000 10%, transparent 50%);
    animation: ag-spin 40s linear infinite; will-change: transform;
  }
  .ag-root .ag-ft-hover {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    transition: transform .45s cubic-bezier(.2,.8,.2,1);
  }
  .ag-root .ag-ft:hover .ag-ft-hover { transform: scale(1.07) rotate(-2deg); }
  .ag-root .ag-ft-float { width: 76%; animation: ag-float 6s ease-in-out infinite; animation-delay: var(--ag-d, 0ms); will-change: transform; }
  .ag-root .ag-ft-img {
    position: relative; width: 100%; aspect-ratio: 1; overflow: hidden; border-radius: 14px;
    box-shadow: 0 0 0 1px var(--ag-c-line), 0 18px 28px -12px rgba(0,0,0,.95), 0 0 28px -6px var(--ag-c-glow);
  }
  .ag-root .ag-ft-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ag-root .ag-ft-spark {
    position: absolute; bottom: 6px; width: 3px; height: 3px; border-radius: 50%; z-index: 0; pointer-events: none;
    background: #fff; box-shadow: 0 0 6px 2px var(--ag-c-glow);
    animation: ag-rise 4.2s linear infinite; will-change: transform, opacity;
  }

  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .ag-root .ag-glass, .ag-root .ag-glass--thin { background: rgba(16,13,11,.96); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ag-root .ag-lift, .ag-root .ag-lift:hover, .ag-root .btn-gold { transition: none; transform: none; }
  }
`

// Re-render a child only when its data changes. Function props are ignored:
// every handler passed below goes through stable "latest" actions, so an older
// handler still calls the newest logic.
function sameDataProps(prev, next) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
  for (const key of keys) {
    const a = prev[key]
    const b = next[key]
    if (typeof a === 'function' && typeof b === 'function') continue
    if (key === 'auction') {
      if (!shallowEqualObject(a, b)) return false
      continue
    }
    if (!Object.is(a, b)) return false
  }
  return true
}

function shallowEqualObject(a, b) {
  if (Object.is(a, b)) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka) if (!Object.is(a[k], b[k])) return false
  return true
}

// Returns an object of functions whose identity never changes but which always
// run the most recent version passed in.
function useLatestActions(actions) {
  const ref = useRef(actions)
  ref.current = actions
  const stable = useRef(null)
  if (!stable.current) {
    stable.current = {}
    for (const name of Object.keys(actions)) {
      stable.current[name] = (...args) => ref.current[name](...args)
    }
  }
  return stable.current
}

function rgba(rgb, alpha) { return `rgba(${rgb}, ${alpha})` }
function getRarityMeta(rarity) { return RARITY[rarity] || RARITY.epic }

const SERVER_OFFSET_MIN = 8 * 60
const MONTH_SHORT_ARR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toMs(ts) {
  if (ts instanceof Date) {
    const n = ts.getTime()
    return Number.isFinite(n) ? n : 0
  }
  const n = Number(ts)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function pad2(n) { return n < 10 ? `0${n}` : String(n) }

function serverParts(ts) {
  const ms = toMs(ts)
  if (!ms) return null
  const shifted = new Date(ms + SERVER_OFFSET_MIN * 60 * 1000)
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    hh: shifted.getUTCHours(),
    mm: shifted.getUTCMinutes(),
    ss: shifted.getUTCSeconds(),
  }
}

function to12Hour(hh) {
  const h = Number(hh)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return { hour: pad2(hour), suffix }
}

function formatServerClock(ts) {
  const p = serverParts(ts)
  if (!p) return '—'
  const t = to12Hour(p.hh)
  return `${pad2(p.d)} ${MONTH_SHORT_ARR[p.m]} ${p.y}, ${t.hour}:${pad2(p.mm)}:${pad2(p.ss)} ${t.suffix}`
}

function formatClock(ts) {
  const p = serverParts(ts)
  if (!p) return '—'
  const t = to12Hour(p.hh)
  return `${t.hour}:${pad2(p.mm)} ${t.suffix}`
}

function formatDateTime(ts) {
  const p = serverParts(ts)
  if (!p) return '—'
  const t = to12Hour(p.hh)
  return `${pad2(p.d)} ${MONTH_SHORT_ARR[p.m]}, ${t.hour}:${pad2(p.mm)} ${t.suffix}`
}

// Every player sees a second, automatic local-time view based on the
// timezone configured by their browser/device. Auction timestamps remain
// stored as epoch milliseconds, so no timezone-specific data is written
// into the auction itself.
const LOCAL_TIME_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time'
  } catch {
    return 'Local Time'
  }
})()

// Building an Intl.DateTimeFormat is slow; the page formats dozens of times a
// second, so each formatter is created once and reused.
let _localPartsDTF = null
let _localOffsetDTF = null

function localParts(ts) {
  const ms = toMs(ts)
  if (!ms) return null

  try {
    _localPartsDTF = _localPartsDTF || new Intl.DateTimeFormat(undefined, {
      timeZone: LOCAL_TIME_ZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      hourCycle: 'h12',
    })
    const parts = _localPartsDTF.formatToParts(new Date(ms))

    const get = type => parts.find(p => p.type === type)?.value || ''
    return {
      y: get('year'),
      m: get('month'),
      d: get('day'),
      hh: get('hour'),
      mm: get('minute'),
      dayPeriod: get('dayPeriod'),
    }
  } catch {
    return null
  }
}

function localTimeZoneOffset(ts = Date.now()) {
  try {
    _localOffsetDTF = _localOffsetDTF || new Intl.DateTimeFormat(undefined, {
      timeZone: LOCAL_TIME_ZONE,
      timeZoneName: 'shortOffset',
    })
    const parts = _localOffsetDTF.formatToParts(new Date(toMs(ts) || Date.now()))
    return parts.find(p => p.type === 'timeZoneName')?.value || LOCAL_TIME_ZONE
  } catch {
    return LOCAL_TIME_ZONE
  }
}

function formatLocalClock(ts) {
  const p = localParts(ts)
  if (!p) return '—'
  return `${p.hh}:${p.mm} ${p.dayPeriod}`
}

function formatLocalDateTime(ts) {
  const p = localParts(ts)
  if (!p) return '—'
  return `${p.d} ${p.m}, ${p.y}, ${p.hh}:${p.mm} ${p.dayPeriod}`
}

function formatLocalTimeLabel(ts = Date.now()) {
  return `${LOCAL_TIME_ZONE} · ${localTimeZoneOffset(ts)}`
}

function formatCountdown(endsAt, now) {
  const diff = endsAt - now
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
}
function formatRelativePast(ms) {
  if (ms <= 0) return 'just now'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return `${s}s ago`
}
function isBiddingOpen(auction, now) {
  return auction.status === 'active' && (auction.endsAt - now) > BID_LOCK_MS
}

function getStartingBid(auction) {
  return Number(auction?.startBid ?? auction?.minBid ?? auction?.currentBid ?? 0) || 0
}

// Blind auctions do not have an open "current highest bid".
// The only minimum is the auction's starting bid.
function minNextBidFor(auction) {
  return getStartingBid(auction)
}

const _ownBidCache = new WeakMap()
function getOwnBidState(auction, memberName) {
  if (!auction || typeof auction !== 'object') return computeOwnBidState(auction, memberName)
  let byName = _ownBidCache.get(auction)
  if (!byName || byName.bids !== auction.bids) {
    byName = new Map()
    byName.bids = auction.bids
    _ownBidCache.set(auction, byName)
  }
  const key = String(memberName ?? '')
  if (!byName.has(key)) byName.set(key, computeOwnBidState(auction, memberName))
  return byName.get(key)
}

function computeOwnBidState(auction, memberName) {
  const bids = Array.isArray(auction?.bids) ? auction.bids : []
  const mine = bids.filter(b => b?.bidder === memberName)
  const last = mine[mine.length - 1] || null
  if (last?.cancelled) {
    return { hasBid: false, amount: 0, submissions: 0, changesUsed: 0, changesLeft: 0, cancelled: true }
  }
  const submissions = mine.filter(b => !b?.cancelled)
  const changesUsed = Math.max(0, submissions.length - 1)
  return {
    hasBid: submissions.length > 0,
    amount: Number(last?.amount) || 0,
    submissions: submissions.length,
    changesUsed,
    changesLeft: Math.max(0, MAX_BID_CHANGES - changesUsed),
    cancelled: false,
  }
}

const _finalBidsCache = new WeakMap()
function getFinalBidEntries(auction) {
  if (!auction || typeof auction !== 'object') return computeFinalBidEntries(auction)
  const cached = _finalBidsCache.get(auction)
  if (cached && cached.bids === auction.bids) return cached.result
  const result = computeFinalBidEntries(auction)
  _finalBidsCache.set(auction, { bids: auction.bids, result })
  return result
}

function computeFinalBidEntries(auction) {
  const bids = Array.isArray(auction?.bids) ? auction.bids : []
  const latestByBidder = new Map()
  for (const bid of bids) {
    if (!bid?.bidder) continue
    latestByBidder.set(bid.bidder, bid)
  }
  return [...latestByBidder.values()]
    .filter(b => !b.cancelled && Number(b.amount) > 0)
    .map(b => ({ ...b, amount: Number(b.amount) || 0, time: Number(b.time) || 0 }))
    .sort((a, b) => b.amount - a.amount || a.time - b.time)
}

function getAuctionWinner(auction) {
  return getFinalBidEntries(auction)[0] || null
}

function getBidderCount(auction) {
  return getFinalBidEntries(auction).length
}

// ---------------------------------------------------------------------------
// Glass confirm dialog (replaces the browser's window.confirm)
// Usage: const ok = await askConfirm({ title, body, note, details, confirmLabel, tone })
// ---------------------------------------------------------------------------
function GlassConfirmDialog({
  title, body, note, details, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'gold', onConfirm, onCancel,
}) {
  const titleId = useId()
  const bodyId = useId()
  const panelRef = useRef(null)
  const cancelRef = useRef(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    const previouslyFocused = document.activeElement
    cancelRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKey = e => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancelRef.current()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll('button:not([disabled])')
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  const isDanger = tone === 'danger'

  return createPortal(
    <div className="ag-root fixed inset-0 z-[300] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <div className="ag-scrim absolute inset-0" onClick={onCancel} aria-hidden="true" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="ag-glass ag-dialog relative w-full max-w-[420px] overflow-hidden rounded-[24px]"
      >
        <div className="relative px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-start gap-3.5">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${
                isDanger ? 'ag-emblem-danger text-red-300' : 'ag-emblem text-gold-light'
              }`}
              aria-hidden="true"
            >
              {isDanger ? '!' : '?'}
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-spectral text-[19px] font-bold leading-tight text-text-bright">
                {title}
              </h2>
              <div id={bodyId} className="mt-1.5 space-y-2 text-[13px] leading-5 text-text-dim">
                {body && <p>{body}</p>}
                {Array.isArray(details) && details.length > 0 && (
                  <ul className="ag-well max-h-40 space-y-1 overflow-y-auto rounded-xl px-3 py-2 text-[12px] text-text-bright">
                    {details.map((line, i) => (
                      <li key={`${i}-${line}`} className="truncate">• {line}</li>
                    ))}
                  </ul>
                )}
                {note && (
                  <p className={`text-[12px] ${isDanger ? 'text-red-300/90' : 'text-gold-light/85'}`}>{note}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-white/[.08] bg-white/[.025] px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="ag-chip h-10 rounded-full px-5 text-[13px] font-semibold text-text-bright"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-10 px-5 text-[13px] font-bold ${isDanger ? 'ag-btn-danger rounded-full' : 'btn-gold'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function useGlassConfirm() {
  const [dialog, setDialog] = useState(null)
  const resolverRef = useRef(null)

  const askConfirm = useCallback(options => new Promise(resolve => {
    resolverRef.current?.(false) // a newer question replaces an unanswered one
    resolverRef.current = resolve
    setDialog(options)
  }), [])

  const settle = useCallback(result => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setDialog(null)
  }, [])

  useEffect(() => () => { resolverRef.current?.(false) }, [])

  const confirmDialog = dialog
    ? <GlassConfirmDialog {...dialog} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
    : null

  return [askConfirm, confirmDialog]
}

function displayNameForLibraryImage(img) {
  if (!img) return ''
  if (img.displayName) return img.displayName
  const base = (img.name || '').split('/').pop()
  const m = base.match(/^(\d+)-[a-z0-9]+\.([a-z0-9]+)$/i)
  if (m) return `image-${m[1]}.${m[2]}`
  return base
}

function FeaturedPill({ rarityMeta, small = false }) {
  const rm = rarityMeta
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-widest rounded-full whitespace-nowrap ${
        small ? 'text-[11px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1'
      }`}
      style={{
        background: `linear-gradient(135deg, ${rm.color} 0%, ${rgba(rm.rgb, 0.7)} 100%)`,
        color: '#0a0706',
        boxShadow: `0 0 0 1px ${rgba(rm.rgb, 0.45)}, 0 4px 14px -4px ${rgba(rm.rgb, 0.6)}`,
      }}
    >
      <svg
        width={small ? 8 : 10}
        height={small ? 8 : 10}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span>Featured</span>
    </span>
  )
}

function DistributorStatusBadge({ name }) {
  if (name) {
    const isSystem = name === 'System'
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          isSystem
            ? 'text-text-dim bg-void/60 border border-gold/15'
            : 'text-green-400 bg-green-500/10 border border-green-500/40'
        }`}
        title={isSystem ? 'Ended automatically by the timer' : `Handed out by ${name}`}
      >
        <span aria-hidden="true">{isSystem ? '⏱' : ''}</span>
        <span className="truncate max-w-[140px]">{name}</span>
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full text-yellow-400 bg-yellow-500/10 border border-yellow-500/40"
      title="A Master or Elder needs to hand the item to the winner in-game, then mark it here."
    >
      <span aria-hidden="true">⏳</span>
      <span>Awaiting hand-out</span>
    </span>
  )
}

function ItemImage({ src, alt, size = 56 }) {
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt || ''}
      width={size}
      height={size}
      loading="lazy"
      className="rounded border border-gold/25 object-cover flex-shrink-0 bg-void/60"
      style={{ width: size, height: size }}
      onError={(e) => { e.currentTarget.style.display = 'none' }}
    />
  )
}

export default function Auctions({ ctx }) {
  const {
    members, setMembers, auctions, setAuctions, currentUser, addToast, supabase, reloadMembers,
  } = ctx

  const currentMember = useMemo(
    () => (Array.isArray(members) ? members.find(m => m?.name === currentUser?.name) : null),
    [members, currentUser?.name]
  )
  const currentCoins = Math.max(0, Number(currentMember?.coins) || 0)

  const [showCreate, setShowCreate] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    rarity: 'epic',
    startBid: 100,
    duration: 60,
  })
  const [descChoice, setDescChoice] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [pickedLibraryImg, setPickedLibraryImg] = useState(null)
  const [libraryImages, setLibraryImages] = useState([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState(null)
  const [deletingImageName, setDeletingImageName] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [bidAmounts, setBidAmounts] = useState({})
  const [expandedBids, setExpandedBids] = useState({})
  const [askConfirm, confirmDialog] = useGlassConfirm()
  const [selectedEndedAuctions, setSelectedEndedAuctions] = useState([])
  const [endedPage, setEndedPage] = useState(1)
  const archiveRef = useRef(null)
  const [featuringInFlight, setFeaturingInFlight] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const formId = useId()
  const fileInputId = `${formId}-image`
  const libraryLoadRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setBidAmounts(prev => {
      const next = { ...prev }
      let changed = false
      for (const a of (Array.isArray(auctions) ? auctions : [])) {
        if (a.status !== 'active') continue
        const current = next[a.id]
        if (current === undefined || current === '' || current === null) {
          next[a.id] = String(minNextBidFor(a))
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [auctions])

  useEffect(() => {
    if (!showCreate) return
    if (libraryLoadRef.current) return
    libraryLoadRef.current = true
    loadLibrary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate])

  const loadLibrary = async () => {
    if (!supabase) return
    setLibraryLoading(true)
    setLibraryError(null)
    try {
      const { data, error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .list('', {
          limit: 200,
          sortBy: { column: 'created_at', order: 'desc' },
        })
      if (error) throw error

      const items = (data || [])
        .filter(f => f.name && !f.name.startsWith('.'))
        .map(f => {
          const { data: urlData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(f.name)
          return {
            name: f.name,
            displayName: displayNameForLibraryImage({ name: f.name }),
            url: urlData?.publicUrl || '',
            createdAt: f.created_at || f.updated_at || null,
          }
        })
        .filter(f => f.url)

      setLibraryImages(items)
    } catch (err) {
      console.error('Load image library failed:', err)
      setLibraryError(err.message || 'Failed to load image library')
    } finally {
      setLibraryLoading(false)
    }
  }

  const deleteLibraryImage = async (img) => {
    if (!supabase) return
    const fileName = img?.name
    if (!fileName) return

    const confirmedImageDelete = await askConfirm({
      title: 'Delete this image?',
      body: `"${displayNameForLibraryImage(img)}" will be removed from storage.`,
      note: "Auctions already using it keep their picture, but you won't be able to reuse it here.",
      confirmLabel: 'Delete image',
      tone: 'danger',
    })
    if (!confirmedImageDelete) return

    setDeletingImageName(fileName)
    try {
      const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([fileName])
      if (error) throw error

      setLibraryImages(prev => prev.filter(p => p.name !== fileName))
      if (pickedLibraryImg?.name === fileName) {
        setPickedLibraryImg(null)
        setImagePreview(prev => (prev === img.url ? null : prev))
      }
      addToast('Image deleted from library.', 'red', 'Deleted')
    } catch (err) {
      console.error('Delete image failed:', err)
      addToast(`Couldn't delete image: ${err.message}`, 'red', 'Delete Failed')
    } finally {
      setDeletingImageName(null)
    }
  }

  const isElder = currentUser?.role === 'Elder' || currentUser?.role === 'Master' || currentUser?.role === 'Admin'
  const isMaster = currentUser?.role === 'Master' || currentUser?.role === 'Admin'

  const distributors = useMemo(() => {
    return [...members]
      .filter(m => m.role === 'Master' || m.role === 'Elder' || m.role === 'Admin')
      .sort((a, b) => {
        const rank = { Admin: 0, Master: 1, Elder: 2 }
        const ra = rank[a.role] ?? 99
        const rb = rank[b.role] ?? 99
        if (ra !== rb) return ra - rb
        return a.name.localeCompare(b.name)
      })
  }, [members])

  const finalDescription = descChoice === 'Custom...' ? customDesc.trim() : descChoice

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      addToast('Please choose an image file.', 'red', 'Invalid File')
      return
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      addToast('Image must be under 20 MB before compression.', 'red', 'Too Large')
      return
    }
    if (file.type === 'image/gif' && file.size > MAX_STORAGE_IMAGE_BYTES) {
      addToast('GIF images must be under 2 MB so their animation is preserved.', 'red', 'Too Large')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) && file.size > MAX_STORAGE_IMAGE_BYTES) {
      addToast('Only PNG, JPG, and WebP images can be automatically compressed. Other image formats must be under 2 MB.', 'red', 'Unsupported Format')
      return
    }
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setPickedLibraryImg(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const pickFromLibrary = (img) => {
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setPickedLibraryImg({ name: img.name, url: img.url, displayName: img.displayName })
    setImagePreview(img.url)
  }

  const clearImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setPickedLibraryImg(null)
    setImagePreview(null)
  }

  const uploadImage = async () => {
    if (pickedLibraryImg) return pickedLibraryImg.url
    if (!imageFile) return null

    const uploadFile = await compressAuctionImageToWebP(imageFile)
    const ext = uploadFile.type === 'image/webp'
      ? 'webp'
      : (uploadFile.name.split('.').pop()?.toLowerCase() || 'gif')
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, uploadFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: uploadFile.type,
      })

    if (error) throw error

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
    const url = data?.publicUrl || null
    if (url) {
      setLibraryImages(prev => [
        { name: path, url, createdAt: new Date().toISOString(), displayName: imageFile.name },
        ...prev.filter(p => p.url !== url),
      ])
    }
    return url
  }

  const createAuction = async () => {
    const itemName = String(newItem?.name ?? '').trim()
    if (!itemName) {
      addToast('Enter an item name.', 'red', 'Error')
      return
    }

    if (!supabase) {
      addToast('Database connection is unavailable.', 'red', 'Connection Error')
      return
    }

    const startBid = Math.max(1, parseInt(newItem?.startBid, 10) || 100)
    const durationMin = Math.max(1, parseInt(newItem?.duration, 10) || 60)
    const startedAt = Date.now()
    const endsAt = startedAt + durationMin * 60 * 1000
    const id = String(startedAt)
    const description = finalDescription || null

    setUploading(true)

    try {
      const imageUrl = await uploadImage()

      const payload = {
        id,
        name: itemName,
        description,
        rarity: newItem?.rarity || 'epic',
        status: 'active',
        started_at: startedAt,
        ends_at: endsAt,
        current_bid: startBid,
        min_bid: startBid,
        top_bidder: null,
        bids: [],
        distributed_by: null,
        image_url: imageUrl,
        is_featured: false,
      }

      // The payload is already complete. Do not chain .select() here:
      // INSERT + SELECT can fail under an RLS policy that permits INSERT
      // but does not permit the client to read the inserted row back.
      const { error } = await supabase
        .from('auctions')
        .insert([payload])

      if (error) throw error

      const row = payload

      const newAuction = {
        id: String(row.id ?? id),
        name: row.name ?? itemName,
        description: row.description ?? '',
        rarity: row.rarity ?? payload.rarity,
        status: row.status ?? 'active',
        currentBid: Number(row.current_bid ?? startBid) || startBid,
        startBid: Number(row.min_bid ?? startBid) || startBid,
        topBidder: row.top_bidder ?? null,
        endsAt: Number(row.ends_at ?? endsAt) || endsAt,
        startedAt: Number(row.started_at ?? startedAt) || startedAt,
        endedAt: Number(row.ended_at ?? 0) || 0,
        bids: Array.isArray(row.bids)
          ? row.bids
          : (typeof row.bids === 'string'
              ? (() => { try { return JSON.parse(row.bids) || [] } catch { return [] } })()
              : []),
        distributedBy: row.distributed_by ?? null,
        imageUrl: row.image_url ?? imageUrl ?? null,
        isFeatured: row.is_featured === true,
      }

      setAuctions(prev => {
        const safePrev = Array.isArray(prev) ? prev : []
        return [newAuction, ...safePrev.filter(a => String(a?.id) !== String(newAuction.id))]
      })

      setNewItem({
        name: '',
        description: '',
        rarity: 'epic',
        startBid: 100,
        duration: 60,
      })
      setDescChoice('')
      setCustomDesc('')
      clearImage()
      setShowCreate(false)

      addToast(`"${itemName}" is now up for auction!`, 'gold', 'Auction Live')
    } catch (err) {
      console.error('Create auction failed:', err)
      addToast(
        `Couldn't start auction: ${err?.message || 'Unknown error'}`,
        'red',
        'Auction Not Started'
      )
    } finally {
      setUploading(false)
    }
  }

  // Auction settlement is handled by Supabase RPC / pg_cron.
  // The client must never directly decide winners or refund coins, because
  // multiple browsers can otherwise race and create duplicate/missing refunds.
  const settleAuction = async (auctionId, { early = false } = {}) => {
    if (!supabase) return false
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return false

    if (!early) {
      // Expired auctions are settled automatically by pg_cron.
      // Do not mutate the auction or member balances from the browser.
      return false
    }

    const actorId = Number(currentMember?.id)
    if (!Number.isFinite(actorId) || actorId <= 0) {
      addToast('Your member ID could not be verified.', 'red', 'Auction End Failed')
      return false
    }

    const { data, error } = await supabase.rpc('auction_settle_random_tie', {
      p_auction_id: String(auctionId),
      p_actor_id: actorId,
      p_early: true,
    })

    if (error) {
      console.error('Early auction settlement failed:', error)
      addToast(`Couldn't end auction: ${error.message}`, 'red', 'Save Failed')
      return false
    }

    if (typeof reloadMembers === 'function') {
      try { await reloadMembers() } catch (refreshError) {
        console.warn('Member refresh after auction settlement failed:', refreshError)
      }
    }

    // The RPC is authoritative. Refreshing the local row from its result
    // keeps this browser in sync without performing a second settlement.
    const result = Array.isArray(data) ? data[0] : data
    const winner = result?.winner_name || result?.top_bidder || null
    const finalBid = Number(result?.winning_amount ?? result?.current_bid ?? 0) || 0

    setAuctions(prev => prev.map(a => a.id === auctionId ? {
      ...a,
      status: 'ended',
      currentBid: finalBid || a.currentBid,
      topBidder: typeof winner === 'string' ? winner : (winner?.bidder || a.topBidder || null),
      endedAt: Date.now(),
      isFeatured: false,
    } : a))

    if (result?.already_settled) {
      addToast(`"${auction.name}" was already settled.`, 'blue', 'Auction Already Ended')
    } else if (winner) {
      const winnerName = typeof winner === 'string' ? winner : winner?.bidder
      addToast(
        `"${auction.name}" ended. Winner: ${winnerName || 'Unknown'}${finalBid ? ` at ${finalBid.toLocaleString()} coins.` : '.'}`,
        'gold',
        'Auction Ended'
      )
    } else {
      addToast(`"${auction.name}" ended with no final bids.`, 'blue', 'Auction Complete')
    }

    return true
  }

  const placeBid = async (auctionId) => {
    const auction = auctions.find(a => a.id === auctionId)
    const bidNow = Date.now()

    if (!auction || auction.status !== 'active') {
      addToast('This auction has ended.', 'red', 'Auction Ended')
      return
    }

    if (!isBiddingOpen(auction, bidNow)) {
      addToast('Bidding is locked during the final 30 seconds.', 'red', 'Bidding Closed')
      return
    }

    const bidder = members.find(m => m.name === currentUser?.name)
    if (!bidder) {
      addToast('Your member record could not be found.', 'red', 'Bid Failed')
      return
    }

    if (!currentUser?.password) {
      addToast('Your login session is missing credentials. Please log out and log in again.', 'red', 'Bid Failed')
      return
    }

    const own = getOwnBidState(auction, currentUser.name)
    if (own.cancelled) {
      addToast('You cancelled your bid and cannot bid again on this auction.', 'red', 'Bid Cancelled')
      return
    }
    if (own.submissions >= MAX_BID_SUBMISSIONS) {
      addToast('You have used your initial bid plus both allowed changes.', 'red', 'No Changes Left')
      return
    }

    const raw = bidAmounts[auctionId]
    const amount = (raw === '' || raw === undefined || raw === null)
      ? (own.hasBid ? own.amount : getStartingBid(auction))
      : parseInt(raw, 10)

    const startingBid = getStartingBid(auction)

    if (!Number.isFinite(amount) || amount <= 0) {
      addToast('Enter a valid bid amount.', 'red', 'Invalid Bid')
      return
    }

    if (amount < startingBid) {
      addToast(`Your bid must be at least ${startingBid.toLocaleString()} coins.`, 'red', 'Bid Too Low')
      return
    }

    if (own.hasBid && amount === own.amount) {
      addToast('Enter a different amount to use a bid change.', 'red', 'No Change')
      return
    }

    // The database RPC is authoritative. It locks both rows and changes
    // the member balance + auction bid in one transaction.
    const { data, error } = await supabase.rpc('auction_place_bid', {
      p_auction_id: String(auctionId),
      p_bidder_id: Number(bidder.id),
      p_bidder_password: String(currentUser.password),
      p_amount: amount,
    })

    if (error) {
      console.error('Auction bid failed:', error)
      addToast(error.message || 'Could not place your bid.', 'red', 'Bid Failed')
      return
    }

    const result = Array.isArray(data) ? data[0] : data
    const newCoins = Number(result?.coins)
    const newBids = Array.isArray(result?.bids)
      ? result.bids
      : [...(auction.bids || []), {
          bidder: currentUser.name,
          amount,
          time: bidNow,
          previousAmount: own.amount || null,
          changeNumber: own.submissions,
          isChange: own.submissions > 0,
          cancelled: false,
        }]

    if (!Number.isFinite(newCoins)) {
      console.error('Auction RPC returned no authoritative coin balance:', result)
      addToast('Bid was saved, but the server did not return the new balance. Refreshing data.', 'red', 'Bid Warning')
      return
    }

    setMembers(prev => prev.map(m =>
      m.id === bidder.id ? { ...m, coins: newCoins } : m
    ))

    if (typeof reloadMembers === 'function') {
      try { await reloadMembers() } catch (refreshError) {
        console.warn('Member refresh after auction bid failed:', refreshError)
      }
    }

    setAuctions(prev => prev.map(a => a.id === auctionId ? {
      ...a,
      bids: newBids,
      currentBid: startingBid,
      topBidder: null,
    } : a))

    setBidAmounts(prev => ({ ...prev, [auctionId]: '' }))

    if (own.hasBid) {
      const delta = Number(result?.delta) || 0
      const changeText = delta >= 0
        ? `${delta.toLocaleString()} additional coins reserved.`
        : `${Math.abs(delta).toLocaleString()} coins released.`

      addToast(
        `Your bid changed to ${amount.toLocaleString()} coins. ${changeText}`,
        'gold',
        'Bid Changed'
      )
    } else {
      addToast(
        `Your blind bid of ${amount.toLocaleString()} coins is locked in. ${newCoins.toLocaleString()} coins remaining.`,
        'gold',
        'Bid Submitted'
      )
    }
  }

  const cancelBid = async (auctionId) => {
    const auction = auctions.find(a => a.id === auctionId)
    const bidNow = Date.now()

    if (!auction || auction.status !== 'active') {
      addToast('This auction has already ended.', 'red', 'Auction Ended')
      return
    }

    if (!isBiddingOpen(auction, bidNow)) {
      addToast('Bid cancellation is disabled during the final 30 seconds.', 'red', 'Cancellation Locked')
      return
    }

    const own = getOwnBidState(auction, currentUser?.name)
    if (!own.hasBid || own.amount <= 0) {
      addToast('You do not have an active bid to cancel.', 'red', 'No Active Bid')
      return
    }

    const confirmedCancel = await askConfirm({
      title: 'Cancel your bid?',
      body: `Your ${own.amount.toLocaleString()}-coin bid will be cancelled and the coins returned to you right away.`,
      note: 'You will not be able to bid on this auction again.',
      confirmLabel: 'Cancel bid',
      cancelLabel: 'Keep bid',
      tone: 'danger',
    })
    if (!confirmedCancel) return

    if (!currentUser?.password) {
      addToast('Your login session is missing credentials. Please log out and log in again.', 'red', 'Cancel Failed')
      return
    }

    // Keep cancellation atomic too. This prevents a refund from succeeding
    // while the cancelled-bid marker fails to save.
    const { data, error } = await supabase.rpc('auction_cancel_bid', {
      p_auction_id: String(auctionId),
      p_bidder_id: Number(currentUser.id),
      p_bidder_password: String(currentUser.password),
    })

    if (error) {
      console.error('Bid cancellation failed:', error)
      addToast(error.message || 'Could not cancel your bid.', 'red', 'Cancel Failed')
      return
    }

    const result = Array.isArray(data) ? data[0] : data
    const newCoins = Number(result?.coins)
    const newBids = Array.isArray(result?.bids)
      ? result.bids
      : [
          ...(auction.bids || []),
          {
            bidder: currentUser.name,
            amount: 0,
            time: bidNow,
            previousAmount: own.amount,
            cancelled: true,
            changeNumber: own.submissions,
          },
        ]

    if (!Number.isFinite(newCoins)) {
      addToast('Cancellation completed, but the server did not return the new balance. Refreshing data.', 'red', 'Cancel Warning')
      return
    }

    setMembers(prev => prev.map(m =>
      m.id === Number(currentUser.id) ? { ...m, coins: newCoins } : m
    ))

    if (typeof reloadMembers === 'function') {
      try { await reloadMembers() } catch (refreshError) {
        console.warn('Member refresh after bid cancellation failed:', refreshError)
      }
    }

    setAuctions(prev => prev.map(a => a.id === auctionId ? {
      ...a,
      bids: newBids,
      currentBid: getStartingBid(a),
      topBidder: null,
    } : a))

    setBidAmounts(prev => ({ ...prev, [auctionId]: '' }))
    addToast(
      `Your ${own.amount.toLocaleString()}-coin bid was cancelled and fully returned. ${newCoins.toLocaleString()} coins available.`,
      'blue',
      'Bid Cancelled'
    )
  }

  const endAuction = async (auctionId) => {
    if (!isMaster) return
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return
    const confirmedEnd = await askConfirm({
      title: `End "${auction.name}" early?`,
      body: 'All blind bids will be revealed and the highest final bid wins.',
      note: 'If final bids are tied, the server picks the winner by random draw.',
      confirmLabel: 'End auction',
    })
    if (confirmedEnd) {
      await settleAuction(auctionId, { early: true })
    }
  }

  const assignDistributor = async (auctionId, distributorName) => {
    if (!isElder) return
    const value = distributorName || null
    const { error } = await supabase.from('auctions').update({ distributed_by: value }).eq('id', auctionId)
    if (error) {
      console.error('Assign distributor failed:', error)
      addToast(`Couldn't save distributor: ${error.message}`, 'red', 'Save Failed')
      return
    }
    setAuctions(prev => prev.map(a => a.id === auctionId ? { ...a, distributedBy: value } : a))
    if (value) addToast(`Distributor set: ${value}.`, 'gold', 'Updated')
    else addToast(`Distributor cleared.`, 'blue', 'Updated')
  }

  const deleteAuction = async (auctionId) => {
    if (!isElder) return
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return

    const finalBids = auction.status === 'active' ? getFinalBidEntries(auction) : []
    const refundNote = finalBids.length
      ? `\n\n${finalBids.reduce((sum, b) => sum + b.amount, 0).toLocaleString()} reserved coins across ${finalBids.length} active bidder${finalBids.length === 1 ? '' : 's'} will be returned.`
      : ''

    const confirmedDelete = await askConfirm({
      title: `Delete "${auction.name}"?`,
      body: 'This permanently removes the auction.',
      note: refundNote.trim() || undefined,
      confirmLabel: 'Delete auction',
      tone: 'danger',
    })
    if (!confirmedDelete) return

    const actorId = Number(currentMember?.id)
    if (!Number.isFinite(actorId) || actorId <= 0) {
      addToast('Your member ID could not be verified.', 'red', 'Delete Failed')
      return
    }

    // Refunds, notification cleanup, and auction deletion are handled by one
    // database transaction. The browser never performs a partial refund.
    const { data, error } = await supabase.rpc('auction_delete_with_refunds', {
      p_auction_id: String(auctionId),
      p_actor_id: actorId,
    })

    if (error) {
      console.error('Delete auction failed:', error)
      addToast(error.message || `Couldn't delete auction: ${auction.name}`, 'red', 'Delete Failed')
      return
    }

    setAuctions(prev => prev.filter(a => String(a.id) !== String(auctionId)))
    if (typeof reloadMembers === 'function') {
      try { await reloadMembers() } catch (refreshError) {
        console.warn('Member refresh after auction delete failed:', refreshError)
      }
    }

    const refunds = Array.isArray(data?.refunds) ? data.refunds : []
    const totalRefunded = refunds.reduce((sum, row) => sum + (Number(row?.amount) || 0), 0)
    const suffix = totalRefunded > 0 ? ` ${totalRefunded.toLocaleString()} coins returned.` : ''
    addToast(`"${auction.name}" removed.${suffix}`, 'red', 'Auction Deleted')
  }

  const toggleEndedSelection = (auctionId) => {
    setSelectedEndedAuctions(prev =>
      prev.includes(auctionId)
        ? prev.filter(id => id !== auctionId)
        : [...prev, auctionId]
    )
  }

  // Select / clear only the auctions on the page being viewed.
  const toggleSelectAllEnded = () => {
    const pageIds = pagedEndedAuctions.map(a => a.id)
    setSelectedEndedAuctions(prev => {
      const allOnPage = pageIds.length > 0 && pageIds.every(id => prev.includes(id))
      return allOnPage
        ? prev.filter(id => !pageIds.includes(id))
        : [...new Set([...prev, ...pageIds])]
    })
  }

  const goToEndedPage = (pageNumber) => {
    setEndedPage(pageNumber)
    archiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const exportAuctionWinnersCsv = () => {
    if (!isElder) {
      addToast('Only Admin, Master, and Elder can export auction winners.', 'red', 'Not Allowed')
      return
    }

    if (!endedAuctions.length) {
      addToast('There are no completed auctions to export.', 'red', 'Nothing to Export')
      return
    }

    const rows = endedAuctions.map(auction => {
      const finalBids = getFinalBidEntries(auction)

      // For completed auctions, trust the server-settled winner first.
      // This matters when two final bids are tied and the settlement RPC
      // performed a random tie-break. The client-side bid sort cannot know
      // that random result.
      const winner = auction.topBidder || finalBids[0]?.bidder || ''
      const winnerEntry = finalBids.find(
        bid => String(bid?.bidder || '') === String(winner || '')
      ) || null
      const winningBid = winnerEntry?.amount || Number(auction.currentBid) || 0
      const endedAt = Number(auction.endedAt || auction.endsAt || 0) || 0
      const distributor = auction.distributedBy || ''

      return {
        AuctionID: auction.id ?? '',
        Item: auction.name || '',
        Rarity: getRarityMeta(auction.rarity).label || auction.rarity || '',
        Winner: winner || 'No Winner',
        WinningBid: winner ? winningBid : 0,
        BidderCount: finalBids.length,
        AuctionEnded: endedAt ? formatDateTime(endedAt) : '',
        ServerTimezone: SERVER_TZ_SHORT,
        DistributedBy: distributor || 'Not yet assigned',
        DistributionStatus: winner
          ? (distributor ? 'Distributed / Assigned' : 'Awaiting hand-out')
          : 'No Winner',
      }
    })

    const headers = [
      'Auction ID',
      'Item',
      'Rarity',
      'Winner',
      'Winning Bid',
      'Bidder Count',
      'Auction Ended',
      'Server Timezone',
      'Distributed By',
      'Distribution Status',
    ]

    const csvEscape = value => {
      const text = value == null ? '' : String(value)
      return /[",\n\r]/.test(text)
        ? `"${text.replace(/"/g, '""')}"`
        : text
    }

    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(header => {
        const key = header === 'Auction ID'
          ? 'AuctionID'
          : header === 'Winning Bid'
            ? 'WinningBid'
            : header === 'Bidder Count'
              ? 'BidderCount'
              : header === 'Auction Ended'
                ? 'AuctionEnded'
                : header === 'Server Timezone'
                  ? 'ServerTimezone'
                  : header === 'Distributed By'
                    ? 'DistributedBy'
                    : header === 'Distribution Status'
                      ? 'DistributionStatus'
                      : header
        return csvEscape(row[key])
      }).join(',')),
    ].join('\r\n')

    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    const dateStamp = (() => {
      const parts = serverParts(Date.now())
      return parts
        ? `${parts.y}-${pad2(parts.m + 1)}-${pad2(parts.d)}`
        : 'export'
    })()

    link.download = `auction-winners-${dateStamp}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    const winnerCount = rows.filter(row => row.Winner !== 'No Winner').length
    addToast(
      `Exported ${rows.length} completed auction${rows.length === 1 ? '' : 's'} · ${winnerCount} winner record${winnerCount === 1 ? '' : 's'}.`,
      'gold',
      'Auction Winners Exported'
    )
  }

  const deleteSelectedEndedAuctions = async () => {
    if (!isElder || selectedEndedAuctions.length === 0) return

    const selected = endedAuctions.filter(a => selectedEndedAuctions.includes(a.id))
    if (!selected.length) return

    const confirmed = await askConfirm({
      title: `Delete ${selected.length} archived auction${selected.length === 1 ? '' : 's'}?`,
      details: [
        ...selected.slice(0, 8).map(a => a.name),
        ...(selected.length > 8 ? [`+${selected.length - 8} more`] : []),
      ],
      note: 'This cannot be undone.',
      confirmLabel: `Delete ${selected.length}`,
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      const ids = selected.map(a => a.id)

      // Clean up notifications first so deleting archive history cannot leave
      // orphaned auction-win notifications in the notification bell.
      const { error: notificationError } = await supabase
        .from('notifications')
        .delete()
        .in('auction_id', ids)

      if (notificationError) throw notificationError

      const { error } = await supabase
        .from('auctions')
        .delete()
        .in('id', ids)
        .eq('status', 'ended')

      if (error) throw error

      setAuctions(prev => prev.filter(a => !ids.includes(a.id)))
      setSelectedEndedAuctions([])
      addToast(
        `${selected.length} archived auction${selected.length === 1 ? '' : 's'} deleted.`,
        'red',
        'Auctions Deleted'
      )
    } catch (err) {
      console.error('Bulk delete auctions failed:', err)
      addToast(`Couldn't delete selected auctions: ${err.message}`, 'red', 'Delete Failed')
    }
  }

  const toggleFeatured = async (auctionId) => {
    console.log('══════════════════════════════════════════════════════════════')
    console.log('[toggleFeatured] ▶ CALLED', { auctionId, type: typeof auctionId })
    console.log('[toggleFeatured] currentUser:', currentUser)
    console.log('[toggleFeatured] isElder:', isElder)
    console.log('[toggleFeatured] featuringInFlight:', featuringInFlight)

    if (!isElder) {
      console.warn('[toggleFeatured] ✕ blocked: not elder')
      return
    }
    if (featuringInFlight) {
      console.warn('[toggleFeatured] ✕ blocked: in flight')
      return
    }

    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) {
      console.warn('[toggleFeatured] ✕ blocked: auction not found', auctionId)
      console.log('[toggleFeatured] available ids:', auctions.map(a => a.id))
      return
    }

    const willUnfeature = !!auction.isFeatured
    console.log('[toggleFeatured] willUnfeature:', willUnfeature)
    console.log('[toggleFeatured] target auction:', auction)

    setFeaturingInFlight(true)

    try {
      if (willUnfeature) {
        console.log('[toggleFeatured] → sending UPDATE is_featured=false')
        const res = await supabase
          .from('auctions')
          .update({ is_featured: false })
          .eq('id', auctionId)

        console.log('[toggleFeatured] ← unfeature response:', {
          error: res.error,
          status: res.status,
          statusText: res.statusText,
          data: res.data,
          count: res.count,
        })

        if (res.error) throw res.error

        // VERIFY
        const check = await supabase
          .from('auctions')
          .select('id, name, is_featured')
          .eq('id', auctionId)
          .maybeSingle()
        console.log('[toggleFeatured] ✓ verify read:', check)

        if (check.error) {
          console.warn('[toggleFeatured] verify read failed:', check.error)
        } else if (check.data && check.data.is_featured === true) {
          console.error('[toggleFeatured] ⚠ DB STILL SHOWS is_featured=true after unfeature!')
        }

        setAuctions(prev => prev.map(a => a.id === auctionId ? { ...a, isFeatured: false } : a))
        addToast(`"${auction.name}" is no longer featured.`, 'blue', 'Updated')
      } else {
        // Up to MAX_FEATURED live lots can be featured at once (others are no longer cleared)
        const liveFeatured = auctions.filter(a => a.isFeatured && a.status === 'active' && a.id !== auctionId)
        console.log('[toggleFeatured] live featured now:', liveFeatured.map(a => a.id))
        if (liveFeatured.length >= MAX_FEATURED) {
          addToast(`Only ${MAX_FEATURED} lots can be featured at once. Unfeature one first.`, 'red', 'Featured Full')
          return
        }

        console.log('[toggleFeatured] → sending UPDATE is_featured=true on', auctionId)
        const res = await supabase
          .from('auctions')
          .update({ is_featured: true })
          .eq('id', auctionId)

        console.log('[toggleFeatured] ← set response:', {
          error: res.error,
          status: res.status,
          statusText: res.statusText,
          data: res.data,
          count: res.count,
        })

        if (res.error) throw res.error

        // VERIFY
        const check = await supabase
          .from('auctions')
          .select('id, name, is_featured')
          .eq('id', auctionId)
          .maybeSingle()
        console.log('[toggleFeatured] ✓ verify read:', check)

        if (check.error) {
          console.warn('[toggleFeatured] verify read failed:', check.error)
        } else if (check.data && check.data.is_featured === false) {
          console.error('[toggleFeatured] ⚠ DB STILL SHOWS is_featured=false after set! RLS or trigger issue.')
          throw new Error(
            `DB rejected the change. After the update, the row still shows is_featured=false. ` +
            `Most likely cause: RLS update policy blocks this user, OR a trigger on the auctions table ` +
            `overrides the value. Run this in Supabase SQL editor to test: ` +
            `update auctions set is_featured = true where id = '${auctionId}'; select id, is_featured from auctions where id = '${auctionId}';`
          )
        }

        setAuctions(prev => prev.map(a => (a.id === auctionId ? { ...a, isFeatured: true } : a)))
        addToast(`"${auction.name}" is now featured.`, 'gold', 'Featured')
      }
    } catch (err) {
      console.error('[toggleFeatured] ✕ FAILED:', err)
      addToast(`Couldn't feature: ${err.message || 'unknown error'}`, 'red', 'Not Saved')
    } finally {
      console.log('[toggleFeatured] ■ done')
      console.log('══════════════════════════════════════════════════════════════')
      setFeaturingInFlight(false)
    }
  }

  const toggleBidsExpanded = (id) => setExpandedBids(prev => ({ ...prev, [id]: !prev[id] }))

  const actions = useLatestActions({
    toggleFeatured,
    placeBid,
    cancelBid,
    endAuction,
    deleteAuction,
    assignDistributor,
    toggleBidsExpanded,
    toggleEndedSelection,
    pickFromLibrary,
    deleteLibraryImage,
    setBidAmount: (id, value) => setBidAmounts(prev => ({ ...prev, [id]: value })),
  })

  const activeAuctions = useMemo(() => (Array.isArray(auctions) ? auctions : []).filter(a => a?.status === 'active'), [auctions])
  const endedAuctions = useMemo(
    () => [...(Array.isArray(auctions) ? auctions : []).filter(a => a?.status === 'ended')].sort((a, b) => {
      const ax = a.endedAt || a.endsAt || 0
      const bx = b.endedAt || b.endsAt || 0
      return bx - ax
    }),
    [auctions]
  )
  const endedPageCount = Math.max(1, Math.ceil(endedAuctions.length / ENDED_PAGE_SIZE))
  const safeEndedPage = Math.min(endedPage, endedPageCount)
  const pagedEndedAuctions = useMemo(
    () => endedAuctions.slice((safeEndedPage - 1) * ENDED_PAGE_SIZE, safeEndedPage * ENDED_PAGE_SIZE),
    [endedAuctions, safeEndedPage]
  )
  const selectedEndedSet = useMemo(() => new Set(selectedEndedAuctions), [selectedEndedAuctions])
  const allPageSelected = pagedEndedAuctions.length > 0 &&
    pagedEndedAuctions.every(a => selectedEndedSet.has(a.id))

  // If auctions are deleted and the current page no longer exists, step back.
  useEffect(() => {
    if (endedPage > endedPageCount) setEndedPage(endedPageCount)
  }, [endedPage, endedPageCount])

  const latestEndedAt = endedAuctions.length ? (endedAuctions[0].endedAt || endedAuctions[0].endsAt || 0) : 0
  const archiveNow = latestEndedAt && now - latestEndedAt < 2 * 60 * 1000
    ? now
    : Math.floor(now / 60000) * 60000

  const pendingDistribution = useMemo(
    () => endedAuctions.filter(a => getAuctionWinner(a) && !a.distributedBy).length,
    [endedAuctions]
  )

  const featuredAuctions = useMemo(
    () => activeAuctions.filter(a => a.isFeatured).slice(0, MAX_FEATURED),
    [activeAuctions]
  )
  const featureSlotsFull = featuredAuctions.length >= MAX_FEATURED

  const otherActiveAuctions = useMemo(() => {
    const featuredIds = new Set(featuredAuctions.map(a => a.id))
    return activeAuctions.filter(a => !featuredIds.has(a.id))
  }, [activeAuctions, featuredAuctions])

  const selectedImageLabel = imageFile
    ? imageFile.name
    : pickedLibraryImg
      ? (pickedLibraryImg.displayName || displayNameForLibraryImage(pickedLibraryImg))
      : ''

  const hasSelectedImage = !!(imageFile || pickedLibraryImg)

  return (
    <div className="ag-root space-y-4">
      <style>{AG_STYLES}</style>
      {confirmDialog}
      {/* Premium auction header */}
      <header className="ag-glass relative overflow-hidden rounded-[22px]">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(circle at 8% 0%, rgba(242,204,96,.075), transparent 30%), radial-gradient(circle at 88% 100%, rgba(242,204,96,.035), transparent 28%)',
          }}
        />
        <div className="relative px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_9px_rgba(242,204,96,.65)]" />
                <span className="text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim">Clan Auction House</span>
              </div>

              <div className="mt-1.5 flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-1">
                <h1 className="font-spectral text-[28px] font-bold leading-none tracking-tight text-text-bright sm:text-[32px]">
                  Auctions
                </h1>
                <span className="text-[11px] leading-4 text-text-dim sm:whitespace-nowrap">Private blind bidding</span>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-stretch lg:justify-end">
              <div className="min-w-0 rounded-xl ag-inset px-3 py-2.5 sm:min-w-[92px]">
                <div className="text-[10px] font-bold uppercase tracking-[.12em] text-text-dim">Live</div>
                <div className="mt-0.5 font-mono text-lg font-bold leading-none tabular-nums text-gold-bright">{activeAuctions.length}</div>
              </div>

              <div className="min-w-0 rounded-xl ag-inset px-3 py-2.5 sm:min-w-[92px]">
                <div className="text-[10px] font-bold uppercase tracking-[.12em] text-text-dim">Completed</div>
                <div className="mt-0.5 font-mono text-lg font-bold leading-none tabular-nums text-text-bright">{endedAuctions.length}</div>
              </div>

              <div className="min-w-0 rounded-xl ag-inset ag-inset-gold px-3 py-2.5 sm:min-w-[148px]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-[.12em] text-gold-dim">Your Coins</div>
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_7px_rgba(242,204,96,.55)]" />
                </div>
                <div className="mt-0.5 font-mono text-lg font-bold leading-none tabular-nums text-gold-bright">
                  {currentCoins.toLocaleString()}
                </div>
                <div className="mt-1 text-[10px] text-text-dim">Available to bid</div>
              </div>

              <div className="min-w-0 rounded-xl ag-inset px-3 py-2.5 sm:min-w-[148px]">
                <div className="text-[10px] font-bold uppercase tracking-[.12em] text-text-dim">Server Time</div>
                <div className="mt-0.5 font-mono text-sm font-bold leading-none tabular-nums text-text-bright">
                  {formatClock(now)} <span className="text-[10px] font-semibold text-text-dim">{SERVER_TZ_SHORT}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-dim">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,.55)]" />
                  <span>{SERVER_TZ_NAME}</span>
                  <span>·</span>
                  <span>{formatLocalClock(now)} local</span>
                </div>
              </div>

              {isElder && (
                <button
                  type="button"
                  onClick={() => setShowCreate(!showCreate)}
                  className="min-h-[60px] w-full rounded-lg px-3 text-xs font-bold shadow-[0_8px_22px_-15px_rgba(242,204,96,.7)] sm:w-auto sm:min-w-[148px] sm:px-4 btn-gold"
                  aria-expanded={showCreate}
                >
                  {showCreate ? '✕ Close' : '+ Create Auction'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-white/[.055] pt-3">
          <div className="hidden sm:flex min-h-7 flex-wrap items-center gap-y-2 text-[11px] leading-5 text-text-dim">
            <div className="inline-flex h-7 items-center gap-2 pr-5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
              <span><span className="font-semibold text-text-bright">{activeAuctions.length}</span> live lot{activeAuctions.length === 1 ? '' : 's'}</span>
            </div>
            <span className="h-4 border-l border-white/[.10]" aria-hidden="true" />
            <div className="inline-flex h-7 items-center px-5">
              Minimum <span className="ml-1 font-semibold text-text-bright">starting bid</span>
            </div>
            {featuredAuctions.length > 0 && (
              <>
                <span className="h-4 border-l border-white/[.10]" aria-hidden="true" />
                <div className="inline-flex h-7 items-center px-5 text-gold-light">★&nbsp;<strong>{featuredAuctions.length}/{MAX_FEATURED} featured</strong></div>
              </>
            )}
            {pendingDistribution > 0 && isElder && (
              <>
                <span className="h-4 border-l border-white/[.10]" aria-hidden="true" />
                <div className="inline-flex h-7 items-center px-5 text-yellow-400"><strong>{pendingDistribution}</strong>&nbsp; awaiting distribution</div>
              </>
            )}
          </div>
          {(featuredAuctions.length > 0 || (pendingDistribution > 0 && isElder)) && (
            <div className="flex sm:hidden flex-wrap items-center gap-2">
              {featuredAuctions.length > 0 && <span className="inline-flex items-center rounded-full border border-gold/20 bg-gold/[.045] px-2.5 py-1 text-[11px] font-semibold text-gold-light">★ {featuredAuctions.length}/{MAX_FEATURED} featured</span>}
              {pendingDistribution > 0 && isElder && <span className="inline-flex items-center rounded-full border border-yellow-500/20 bg-yellow-500/[.035] px-2.5 py-1 text-[11px] font-semibold text-yellow-400">{pendingDistribution} awaiting distribution</span>}
            </div>
          )}
        </div>
        </div>
      </header>

      {/* Essential auction rules — deliberately limited to the information players need before bidding */}
      <div className="ag-glass ag-solid relative rounded-2xl px-3 py-2.5 sm:px-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-x-6 sm:gap-y-2.5 text-[11px] leading-5 text-text-dim">
          <div className="inline-flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gold/15 bg-gold/[.04] text-[11px] text-gold-light">↻</span>
            <span><strong className="text-text-bright">1 bid + 2 changes</strong> per player</span>
          </div>

          <span className="hidden md:inline text-white/10">|</span>

          <div className="inline-flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-yellow-500/15 bg-yellow-500/[.04] text-[11px] text-yellow-400">◷</span>
            <span>Locks in final <strong className="text-text-bright">30 seconds</strong></span>
          </div>

          <span className="hidden md:inline text-white/10">|</span>

          <div className="inline-flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gold/15 bg-gold/[.04] text-[11px] text-gold-light">◉</span>
            <span><strong className="text-text-bright">Local time</strong> shown on auctions</span>
          </div>

        </div>
      </div>

      {/* Create auction */}
      {showCreate && (
        <section className="ag-glass relative overflow-hidden rounded-[22px]">
          <div className="border-b border-white/[.08] bg-white/[.03] px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim">Auction setup</div>
                <h2 className="mt-1 font-spectral text-xl font-bold text-text-bright">Create New Auction</h2>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="ag-chip h-8 w-8 rounded-xl text-text-dim hover:text-text-bright" aria-label="Close create auction">✕</button>
            </div>
          </div>

          <div className="p-5 md:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)] gap-6">
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`${formId}-name`} className="block text-[11px] font-bold uppercase tracking-[.12em] text-gold-dim mb-2">Item name</label>
                    <input id={`${formId}-name`} className="input w-full" placeholder="e.g. Kari Top / Bound" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor={`${formId}-rarity`} className="block text-[11px] font-bold uppercase tracking-[.12em] text-gold-dim mb-2">Rarity</label>
                    <select id={`${formId}-rarity`} className="input w-full" value={newItem.rarity} onChange={e => setNewItem({ ...newItem, rarity: e.target.value })}>
                      {Object.entries(RARITY).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor={`${formId}-desc`} className="block text-[11px] font-bold uppercase tracking-[.12em] text-gold-dim mb-2">Description</label>
                  <select id={`${formId}-desc`} className="input w-full" value={descChoice} onChange={e => { setDescChoice(e.target.value); if (e.target.value !== 'Custom...') setCustomDesc('') }}>
                    {presetDescriptions.map(d => <option key={d} value={d}>{d === '' ? 'No description' : d}</option>)}
                  </select>
                  {descChoice === 'Custom...' && (
                    <input className="input w-full mt-2" aria-label="Custom description" placeholder="Type a short description..." value={customDesc} onChange={e => setCustomDesc(e.target.value)} maxLength={100} autoFocus />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl ag-inset p-4">
                    <label htmlFor={`${formId}-bid`} className="block text-[11px] font-bold uppercase tracking-[.12em] text-text-dim mb-2">Starting bid</label>
                    <div className="flex items-center gap-2">
                      <input id={`${formId}-bid`} className="input flex-1" type="number" min="1" placeholder="100" value={newItem.startBid} onChange={e => setNewItem({ ...newItem, startBid: e.target.value })} />
                      <span className="text-xs text-text-dim">coins</span>
                    </div>
                  </div>
                  <div className="rounded-2xl ag-inset p-4">
                    <label htmlFor={`${formId}-duration`} className="block text-[11px] font-bold uppercase tracking-[.12em] text-text-dim mb-2">Duration</label>
                    <div className="flex items-center gap-2">
                      <input id={`${formId}-duration`} className="input flex-1" type="number" min="1" placeholder="60" value={newItem.duration} onChange={e => setNewItem({ ...newItem, duration: e.target.value })} />
                      <span className="text-xs text-text-dim">minutes</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl ag-inset ag-inset-gold p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[.12em] text-gold-dim">Auction preview</div>
                      <div className="mt-1 text-sm text-text-bright">{newItem.name.trim() || 'Untitled Item'}</div>
                    </div>
                    <RarityBadge rarity={newItem.rarity} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                    <div><span className="text-text-dim">Opening bid</span><div className="mt-1 font-mono font-bold text-gold-light">{(parseInt(newItem.startBid) || 100).toLocaleString()} coins</div></div>
                    <div>
                      <span className="text-text-dim">Closes</span>
                      <div className="mt-1 font-mono font-bold text-gold-light">
                        {formatClock(Date.now() + (parseInt(newItem.duration) || 60) * 60000)} <span className="text-text-dim">{SERVER_TZ_SHORT}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] font-mono text-text-dim">
                        Local {formatLocalClock(Date.now() + (parseInt(newItem.duration) || 60) * 60000)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Image manager */}
              <div className="rounded-2xl ag-inset p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[.12em] text-gold-dim">Item artwork</div>
                    <div className="mt-1 text-[11px] text-text-dim">Upload a new image or reuse an existing asset.</div>
                  </div>
                  <button type="button" onClick={loadLibrary} disabled={libraryLoading} className="text-[11px] font-bold uppercase tracking-wider text-gold-light hover:text-gold-bright disabled:opacity-40">
                    {libraryLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>

                <div className="flex items-center gap-3 rounded-xl ag-well p-3">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-lg border border-gold/25 object-cover bg-void/60" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg border border-dashed border-white/[.10] flex items-center justify-center text-text-dim/50">IMG</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-dim">Selected asset</div>
                    <div className="mt-1 truncate text-xs text-text-bright">{hasSelectedImage ? selectedImageLabel : 'No image selected'}</div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <input id={fileInputId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} disabled={uploading} className="sr-only" />
                    <label htmlFor={fileInputId} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-center transition-colors ${uploading ? 'border-white/[.08] text-text-dim cursor-not-allowed' : 'border-gold/35 text-gold-light hover:bg-gold/10 hover:border-gold/55'}`}>
                      {hasSelectedImage ? 'Change' : 'Upload'}
                    </label>
                    {hasSelectedImage && <button type="button" onClick={clearImage} disabled={uploading} className="rounded-lg border border-red-500/25 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 disabled:opacity-40">Clear</button>}
                  </div>
                </div>

                <div className="mt-4 border-t border-white/[.06] pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">Image library</div>
                    <div className="text-[11px] text-text-dim">{libraryLoading ? 'Loading…' : libraryError ? <span className="text-red-400">{libraryError}</span> : `${libraryImages.length} asset${libraryImages.length === 1 ? '' : 's'}`}</div>
                  </div>
                  {libraryImages.length === 0 && !libraryLoading && !libraryError && <div className="rounded-lg border border-dashed border-white/[.08] py-7 text-center text-[11px] text-text-dim">No images available yet.</div>}
                  {libraryImages.length > 0 && (
                    <LibraryGrid
                      images={libraryImages}
                      pickedName={pickedLibraryImg?.name || null}
                      deletingName={deletingImageName}
                      onPick={actions.pickFromLibrary}
                      onDelete={actions.deleteLibraryImage}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.06] pt-5">
              <div className="text-[11px] text-text-dim">
                The auction uses <span className="text-text-bright font-semibold">{SERVER_TZ_LABEL}</span> as the authoritative clock. Your screen also shows <span className="text-text-bright font-semibold">{formatLocalTimeLabel()}</span>.
              </div>
              <button onClick={createAuction} className="btn-gold min-h-10 px-5 font-bold" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Start Auction'}
              </button>
            </div>
          </div>
        </section>
      )}

      {featuredAuctions.length > 0 && (
        <div
          className={
            featuredAuctions.length === 1
              ? 'flex flex-col'
              : featuredAuctions.length === 2
                ? 'grid grid-cols-1 gap-3.5 md:grid-cols-2'
                : 'grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3'
          }
        >
          {featuredAuctions.map((fa, index) => {
            const FeaturedView = featuredAuctions.length === 1 ? FeaturedAuctionCard : FeaturedAuctionTile
            return (
            <FeaturedView
              key={fa.id}
              index={index}
              auction={fa}
              now={now}
              currentUser={currentUser}
              currentCoins={currentCoins}
              isElder={isElder}
              isMaster={isMaster}
              isPinned={!!fa.isFeatured}
              onToggleFeatured={() => actions.toggleFeatured(fa.id)}
              featuringInFlight={featuringInFlight}
              bidAmount={bidAmounts[fa.id] || ''}
              onBidChange={v => actions.setBidAmount(fa.id, v)}
              onPlaceBid={() => actions.placeBid(fa.id)}
              onCancelBid={() => actions.cancelBid(fa.id)}
              onEndEarly={() => actions.endAuction(fa.id)}
              onDelete={() => actions.deleteAuction(fa.id)}
              isBidsExpanded={!!expandedBids[fa.id]}
              onToggleBids={() => actions.toggleBidsExpanded(fa.id)}
            />
            )
          })}
        </div>
      )}

      {otherActiveAuctions.length === 0 && featuredAuctions.length === 0 ? (
        <div className="ag-glass ag-solid relative overflow-hidden rounded-[22px]">
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
            style={{ background: 'radial-gradient(circle at 50% 0%, rgba(242,204,96,.055), transparent 42%)' }}
          />
          <div className="relative flex min-h-[190px] flex-col items-center justify-center px-5 py-8 text-center sm:min-h-[250px] sm:py-12">
            <div className="ag-emblem flex h-11 w-11 items-center justify-center rounded-xl text-lg text-gold-light">
              ◇
            </div>
            <div className="mt-3 text-sm font-semibold text-text-bright">No Live Auctions</div>
            <div className="mt-1 max-w-sm text-[11px] leading-4 text-text-dim">
              There are no active lots right now. New clan auctions will appear here when they go live.
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full ag-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-text-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Auction house ready
            </div>
          </div>
        </div>
      ) : otherActiveAuctions.length > 0 ? (
        <section>
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim">Live inventory</div>
              <h2 className="mt-1 font-spectral text-xl font-bold text-text-bright">Active Auctions</h2>
            </div>
            <span className="rounded-full ag-chip px-2.5 py-1 text-[11px] font-mono text-text-dim">{otherActiveAuctions.length} lots</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {otherActiveAuctions.map(auction => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                now={now}
                currentUser={currentUser}
                currentCoins={currentCoins}
                isElder={isElder}
                isMaster={isMaster}
                isFeatured={!!auction.isFeatured}
                onToggleFeatured={() => actions.toggleFeatured(auction.id)}
                featuringInFlight={featuringInFlight}
                featureSlotsFull={featureSlotsFull}
                bidAmount={bidAmounts[auction.id] || ''}
                onBidChange={v => actions.setBidAmount(auction.id, v)}
                onPlaceBid={() => actions.placeBid(auction.id)}
                onCancelBid={() => actions.cancelBid(auction.id)}
                onEndEarly={() => actions.endAuction(auction.id)}
                onDelete={() => actions.deleteAuction(auction.id)}
                isBidsExpanded={!!expandedBids[auction.id]}
                onToggleBids={() => actions.toggleBidsExpanded(auction.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {endedAuctions.length > 0 && (
        <section ref={archiveRef} className="scroll-mt-24 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim">Auction archive</div>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="font-spectral text-xl font-bold text-text-bright">Completed Auctions</h2>
                <span className="rounded-full ag-chip px-2 py-0.5 text-[11px] font-mono text-text-dim">{endedAuctions.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-[11px] text-text-dim">Review bidder count, winners, final bids, and distribution status.</div>
              {isElder && (
                <>
                  <button
                    type="button"
                    onClick={exportAuctionWinnersCsv}
                    className="rounded-full ag-chip ag-chip-gold px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gold-light hover:border-gold/35 hover:bg-gold/[.07]"
                    title="Export completed auction winner history as CSV"
                  >
                    Export Winners CSV
                  </button>
                  <button
                    type="button"
                    onClick={toggleSelectAllEnded}
                    className="rounded-full ag-chip px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-dim hover:border-gold/25 hover:text-gold-light"
                  >
                    {allPageSelected ? 'Clear Page' : 'Select Page'}
                  </button>
                  {selectedEndedAuctions.length > 0 && (
                    <button
                      type="button"
                      onClick={deleteSelectedEndedAuctions}
                      className="rounded-full ag-chip ag-chip-red px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-red-400 hover:border-red-400/35 hover:bg-red-500/[.08]"
                    >
                      Delete {selectedEndedAuctions.length}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="ag-glass ag-solid relative overflow-hidden rounded-[22px]">
            <ul className="divide-y divide-white/[.05]">
              {pagedEndedAuctions.map(a => (
                <EndedAuctionRow
                  key={a.id}
                  auction={a}
                  now={archiveNow}
                  currentUser={currentUser}
                  isElder={isElder}
                  distributors={distributors}
                  isExpanded={!!expandedBids[a.id]}
                  onToggle={() => actions.toggleBidsExpanded(a.id)}
                  onAssignDistributor={name => actions.assignDistributor(a.id, name)}
                  onDelete={() => actions.deleteAuction(a.id)}
                  isSelected={selectedEndedSet.has(a.id)}
                  onToggleSelect={() => actions.toggleEndedSelection(a.id)}
                />
              ))}
            </ul>
            <ArchivePager
              page={safeEndedPage}
              pageCount={endedPageCount}
              total={endedAuctions.length}
              pageSize={ENDED_PAGE_SIZE}
              onPage={goToEndedPage}
            />
          </div>
        </section>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */

const LibraryGrid = React.memo(function LibraryGrid({ images, pickedName, deletingName, onPick, onDelete }) {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 xl:grid-cols-6 gap-2 max-h-[235px] overflow-y-auto pr-1">
      {images.map(img => {
        const isPicked = pickedName === img.name
        const isDeleting = deletingName === img.name
        const title = img.displayName || displayNameForLibraryImage(img)
        return (
          <div key={img.name} className={`group relative overflow-hidden rounded-lg border ${isPicked ? 'border-gold-bright ring-1 ring-gold/40' : 'border-white/[.08] hover:border-gold/40'} ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}>
            <button type="button" onClick={() => onPick(img)} title={title} className="block w-full" aria-pressed={isPicked} aria-label={`Use image ${title}`}>
              <img src={img.url} alt={title} loading="lazy" decoding="async" className="aspect-square w-full object-cover bg-void/60" />
            </button>
            {isPicked && <span className="absolute top-1 left-1 h-4 w-4 rounded-full bg-gold text-black text-[11px] font-bold flex items-center justify-center">✓</span>}
            <button type="button" onClick={e => { e.stopPropagation(); onDelete(img) }} disabled={isDeleting} title="Delete image" aria-label={`Delete image ${title}`} className="absolute top-1 right-1 h-4 w-4 rounded-full bg-black/80 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white text-[10px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100">{isDeleting ? '…' : '✕'}</button>
          </div>
        )
      })}
    </div>
  )
})

function pagerItems(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const items = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)
  if (start > 2) items.push('gap-start')
  for (let n = start; n <= end; n += 1) items.push(n)
  if (end < pageCount - 1) items.push('gap-end')
  items.push(pageCount)
  return items
}

function ArchivePager({ page, pageCount, total, pageSize, onPage }) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)

  return (
    <nav
      className="flex flex-col items-center gap-3 border-t border-white/[.08] bg-white/[.02] px-4 py-3 sm:flex-row sm:justify-between"
      aria-label="Completed auctions pages"
    >
      <div className="text-[12px] text-text-dim">
        Showing <span className="font-mono font-semibold text-text-bright">{first.toLocaleString()}–{last.toLocaleString()}</span>
        {' '}of <span className="font-mono font-semibold text-text-bright">{total.toLocaleString()}</span>
      </div>

      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="ag-chip h-9 rounded-full px-3.5 text-[12px] font-semibold text-text-bright disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Previous page"
          >
            ‹ Prev
          </button>

          {pagerItems(page, pageCount).map(item => (
            typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                onClick={() => onPage(item)}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Page ${item}`}
                className={`h-9 min-w-[36px] rounded-full px-2.5 font-mono text-[12px] font-bold ${
                  item === page ? 'btn-gold' : 'ag-chip text-text-bright'
                }`}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="px-1 text-[12px] text-text-dim" aria-hidden="true">…</span>
            )
          ))}

          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= pageCount}
            className="ag-chip h-9 rounded-full px-3.5 text-[12px] font-semibold text-text-bright disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Next page"
          >
            Next ›
          </button>
        </div>
      )}
    </nav>
  )
}

function RarityBadge({ rarity }) {
  const rm = getRarityMeta(rarity)
  return (
    <span
      className="inline-block text-[11px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: rm.color, backgroundColor: rgba(rm.rgb, 0.12) }}
    >
      {rm.label}
    </span>
  )
}

function BlindStatusPill({ children, tone = 'gold' }) {
  const toneClass = tone === 'green'
    ? 'border-green-500/25 bg-green-500/[.06] text-green-400'
    : tone === 'red'
      ? 'border-red-500/25 bg-red-500/[.06] text-red-400'
      : 'border-gold/20 bg-gold/[.045] text-gold-light'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${toneClass}`}>
      {children}
    </span>
  )
}

/* ──────────────────────────────────────────────────────────────────────
   Bid controls, featured lot and auction card
   Compact layout sized for coin amounts of up to ~5 digits.
   ────────────────────────────────────────────────────────────────────── */

// Step size for − / + and the quick-add chips, based on the starting bid.
function bidStepFor(startingBid) {
  if (startingBid >= 5000) return 100
  if (startingBid >= 500) return 50
  return 10
}

// Gold normally, amber in the last hour, red in the last 5 minutes.
function countdownTone(remaining) {
  if (remaining <= 0) return 'text-text-dim'
  if (remaining < URGENT_MS) return 'text-red-400 motion-safe:animate-pulse'
  if (remaining < 60 * 60 * 1000) return 'text-amber-300'
  return 'text-gold-bright'
}

function formatLocalShort(ts) {
  const p = localParts(ts)
  if (!p) return '—'
  return `${p.d} ${p.m}, ${p.hh}:${p.mm} ${p.dayPeriod}`
}

function BidderPill({ count }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
      count === 0
        ? 'border-white/[.12] bg-white/[.03] text-text-dim'
        : 'border-gold/25 bg-gold/[.06] text-gold-light'
    }`}>
      {count > 0 && <span className="font-mono text-gold-bright">{count}</span>}
      {count === 0 ? 'No bidders yet' : count === 1 ? 'player bidding' : 'players bidding'}
    </span>
  )
}

function ChangeDots({ left, total = MAX_BID_CHANGES }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${left} of ${total} changes left`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i < left ? 'bg-gold-bright' : 'bg-white/15'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

/* ── Admin "⋯" menu ────────────────────────────────────────────────── */

function AdminMenu({ isMaster, isFeatured, featuringInFlight, featureSlotsFull = false, onToggleFeatured, onEndEarly, onDelete, itemName }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = fn => () => { setOpen(false); fn?.() }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Admin actions for ${itemName}`}
        className="ag-chip flex h-8 w-8 items-center justify-center rounded-full text-[16px] leading-none text-text-dim hover:text-text-bright"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-white/[.12] bg-[#17130f]/[.98] p-1 shadow-[0_18px_40px_-12px_rgba(0,0,0,.9)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={run(onToggleFeatured)}
            disabled={featuringInFlight || (!isFeatured && featureSlotsFull)}
            title={!isFeatured && featureSlotsFull ? `All ${MAX_FEATURED} featured spots are used. Unfeature one first.` : undefined}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-gold-light hover:bg-white/[.06] disabled:opacity-40"
          >
            <span aria-hidden="true">{isFeatured ? '★' : '☆'}</span>
            {featuringInFlight ? 'Saving…' : isFeatured ? 'Unfeature' : featureSlotsFull ? `Featured full (${MAX_FEATURED}/${MAX_FEATURED})` : 'Feature this lot'}
          </button>
          {isMaster && (
            <button
              type="button"
              role="menuitem"
              onClick={run(onEndEarly)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-amber-300 hover:bg-white/[.06]"
            >
              <span aria-hidden="true">⏹</span> End early
            </button>
          )}
          <div className="my-1 h-px bg-white/[.07]" />
          <button
            type="button"
            role="menuitem"
            onClick={run(onDelete)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-red-300 hover:bg-red-500/[.1]"
          >
            <span aria-hidden="true">🗑</span> Delete auction
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Bid controls ──────────────────────────────────────────────────── */

const BlindBidPanel = React.memo(function BlindBidPanel({
  auction, now, currentUser, currentCoins = 0, bidAmount, onBidChange, onPlaceBid, onCancelBid,
  wide = false, stacked = false,
}) {
  const biddingOpen = isBiddingOpen(auction, now)
  const own = getOwnBidState(auction, currentUser?.name)
  const startingBid = getStartingBid(auction)
  const canSubmit = biddingOpen && !own.cancelled && own.submissions < MAX_BID_SUBMISSIONS
  const step = bidStepFor(startingBid)

  // Coins usable for this bid: your free balance plus anything already
  // reserved on this auction (changing a bid releases the old amount first).
  const reserved = own.hasBid ? own.amount : 0
  const maxBid = Math.max(0, Number(currentCoins) || 0) + reserved

  const raw = String(bidAmount ?? '')
  const fallback = own.hasBid ? own.amount : startingBid
  const value = raw === '' ? fallback : (parseInt(raw, 10) || 0)
  const tooLow = value < startingBid
  const tooHigh = value > maxBid
  const unchanged = own.hasBid && value === own.amount
  const invalid = tooLow || tooHigh || unchanged

  const setValue = v => onBidChange(String(Math.max(0, Math.min(999999, Math.round(v)))))

  if (!currentUser) {
    return (
      <div className="rounded-xl ag-well px-3 py-2.5 text-[12px] text-text-dim">Sign in to place a bid.</div>
    )
  }

  if (own.cancelled) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[.05] px-3 py-2.5">
        <span className="text-red-300" aria-hidden="true">✕</span>
        <div className="text-[12px] leading-4 text-text-dim">
          <span className="font-semibold text-red-300">Bid cancelled.</span> Coins returned — you can't bid on this lot again.
        </div>
      </div>
    )
  }

  if (auction.status === 'active' && !canSubmit) {
    const usedAll = biddingOpen && own.submissions >= MAX_BID_SUBMISSIONS
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl ag-well px-3 py-2.5">
        <div className="flex items-center gap-2 text-[12px] text-text-dim">
          <span aria-hidden="true">🔒</span>
          {usedAll ? 'No bid changes left' : 'Bidding closed for the final 30 seconds'}
        </div>
        {own.hasBid && (
          <span className="shrink-0 text-[12px] text-text-dim">
            Your bid <strong className="font-mono text-green-300">{own.amount.toLocaleString()}</strong>
          </span>
        )}
      </div>
    )
  }

  const quick = [step, step * 5, step * 10]
  const inputId = `blind-bid-${auction.id}`

  return (
    <div className="rounded-xl ag-inset ag-inset-gold p-2.5 sm:p-3">
      <div className={`flex flex-wrap items-center gap-2 ${wide ? 'lg:flex-nowrap' : ''}`}>
        {/* Stepper */}
        <div className={`flex items-center rounded-full ag-well p-0.5 ${stacked ? 'flex-[1_1_150px] justify-between' : ''} ${tooHigh ? 'ring-1 ring-red-400/60' : ''}`}>
          <button
            type="button"
            onClick={() => setValue(Math.max(startingBid, value - step))}
            disabled={value - step < startingBid}
            aria-label={`Lower bid by ${step}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] leading-none text-text-bright hover:bg-white/10 disabled:opacity-30"
          >
            −
          </button>
          <label htmlFor={inputId} className="sr-only">Blind bid amount for {auction.name}</label>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={raw === '' ? String(fallback) : raw}
            onChange={e => onBidChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onFocus={e => e.target.select()}
            onKeyDown={e => {
              if (e.key === 'Enter' && !invalid) onPlaceBid()
              if (e.key === 'ArrowUp') { e.preventDefault(); setValue(value + step) }
              if (e.key === 'ArrowDown') { e.preventDefault(); setValue(Math.max(startingBid, value - step)) }
            }}
            aria-invalid={invalid && !unchanged}
            className={`w-[7ch] bg-transparent text-center font-mono text-[17px] font-bold outline-none ${tooHigh ? 'text-red-300' : 'text-text-bright'}`}
          />
          <button
            type="button"
            onClick={() => setValue(value + step)}
            disabled={value + step > maxBid}
            aria-label={`Raise bid by ${step}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] leading-none text-text-bright hover:bg-white/10 disabled:opacity-30"
          >
            +
          </button>
        </div>

        {/* Quick add */}
        <div className={`flex items-center gap-1 ${stacked ? 'flex-[3_1_230px]' : ''}`}>
          {quick.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => setValue(value + q)}
              disabled={value + q > maxBid}
              className={`ag-chip h-8 rounded-full px-2.5 font-mono text-[12px] font-semibold text-text-bright disabled:opacity-30 ${stacked ? 'flex-1' : ''}`}
            >
              +{q.toLocaleString()}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setValue(maxBid)}
            disabled={maxBid < startingBid}
            className={`ag-chip ag-chip-gold h-8 rounded-full px-2.5 text-[12px] font-bold text-gold-light disabled:opacity-30 ${stacked ? 'flex-1' : ''}`}
          >
            Max
          </button>
        </div>

        <button
          type="button"
          onClick={onPlaceBid}
          disabled={invalid}
          className={`btn-gold ${stacked ? 'h-10 w-full' : 'ml-auto h-9 min-w-[84px]'} px-4 text-[13px] font-bold ${invalid ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          {own.hasBid ? 'Change' : 'Bid'}
        </button>
      </div>

      {/* Status line */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-[12px] text-text-dim">
        {tooHigh ? (
          <span className="font-semibold text-red-300">Not enough coins — you can bid up to {maxBid.toLocaleString()}</span>
        ) : tooLow ? (
          <span className="font-semibold text-amber-300">Minimum bid is {startingBid.toLocaleString()}</span>
        ) : own.hasBid ? (
          <span>
            Your bid <strong className="font-mono text-green-300">{own.amount.toLocaleString()}</strong>
            {unchanged && <span className="ml-1 text-text-dim/80">· enter a new amount to change it</span>}
          </span>
        ) : (
          <span>You have <strong className="font-mono text-text-bright">{(Number(currentCoins) || 0).toLocaleString()}</strong> coins</span>
        )}

        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <ChangeDots left={own.changesLeft} />
            {own.changesLeft} {own.changesLeft === 1 ? 'change' : 'changes'} left
          </span>
          {own.hasBid && biddingOpen && typeof onCancelBid === 'function' && (
            <button
              type="button"
              onClick={onCancelBid}
              className="rounded-full px-2 py-0.5 text-[12px] font-semibold text-red-300/90 hover:bg-red-500/[.1] hover:text-red-200"
            >
              Cancel bid
            </button>
          )}
        </span>
      </div>
    </div>
  )
}, sameDataProps)

/* ── Shared bits for the cards ─────────────────────────────────────── */

function ItemThumb({ auction, rm, size }) {
  const style = { width: size, height: size, borderColor: rgba(rm.rgb, .35) }
  return auction.imageUrl ? (
    <div className="relative shrink-0 overflow-hidden rounded-2xl border bg-black/35" style={style}>
      <img
        src={auction.imageUrl}
        alt={auction.name}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
    </div>
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl border bg-black/30 font-spectral font-bold"
      style={{ ...style, color: rm.color, fontSize: Math.round(size / 2.6), backgroundColor: rgba(rm.rgb, .06) }}
    >
      {auction.name.charAt(0).toUpperCase()}
    </div>
  )
}

function YoureBiddingTag({ show }) {
  if (!show) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-400/30 bg-green-500/[.1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-300">
      ✓ You're bidding
    </span>
  )
}

/* ── Featured lot: shared animated showcase ────────────────────────── */

// Colour variables used by the showcase animations (see .ag-ft* in AG_STYLES)
function showcaseVars(rm, index = 0) {
  return {
    '--ag-d': `${index * 140}ms`,
    '--ag-c': rm.color,
    '--ag-c-line': rgba(rm.rgb, .35),
    '--ag-c-glow': rgba(rm.rgb, .55),
    '--ag-c-ray': rgba(rm.rgb, .16),
    '--ag-rim': rgba(rm.rgb, 0.55),
  }
}

const SPARK_SPOTS = [12, 30, 50, 68, 86]

// Square image stage: blurred colour fill, rays, glow, sparkles, floating item with shine
function ShowcaseStage({ auction, rm, index = 0, className = '' }) {
  return (
    <div className={`ag-ft-stage shrink-0 ${className}`}>
      {auction.imageUrl && (
        <img src={auction.imageUrl} alt="" aria-hidden="true" className="ag-ft-amb" loading="lazy" decoding="async" />
      )}
      <div className="ag-ft-rays" aria-hidden="true" />
      <div className="ag-ft-glow" aria-hidden="true" />
      {SPARK_SPOTS.map((left, i) => (
        <span
          key={left}
          className="ag-ft-spark"
          aria-hidden="true"
          style={{ left: `${left}%`, animationDelay: `${(i * 0.8 + index * 0.35).toFixed(2)}s`, opacity: 0 }}
        />
      ))}
      <div className="ag-ft-hover">
        <div className="ag-ft-float">
          {auction.imageUrl ? (
            <div className="ag-ft-img">
              <img
                src={auction.imageUrl}
                alt={auction.name}
                loading="lazy"
                decoding="async"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            </div>
          ) : (
            <div className="ag-ft-img flex items-center justify-center bg-black/40">
              <span className="font-spectral text-[56px] font-bold leading-none" style={{ color: rm.color }}>
                {auction.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Featured lot (only one featured: big card) ─────────────────────── */

const FeaturedAuctionCard = React.memo(function FeaturedAuctionCard({
  auction, now, currentUser, currentCoins, isElder, isMaster,
  isPinned, onToggleFeatured, featuringInFlight, index = 0,
  bidAmount, onBidChange, onPlaceBid, onCancelBid, onEndEarly, onDelete,
}) {
  const rm = getRarityMeta(auction.rarity)
  const remaining = auction.endsAt - now
  const own = getOwnBidState(auction, currentUser?.name)
  const bidders = getBidderCount(auction)

  return (
    <section
      className="ag-glass ag-ft relative rounded-[22px]"
      style={{
        ...showcaseVars(rm, index),
        borderColor: rgba(rm.rgb, 0.2),
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.16), 0 26px 60px -30px ${rgba(rm.rgb, 0.45)}, 0 20px 50px -26px rgba(0,0,0,.75)`,
      }}
      aria-label={`Featured blind auction: ${auction.name}`}
    >
      <svg className="ag-ft-ring" aria-hidden="true">
        <rect x="0" y="0" width="100%" height="100%" rx="22" ry="22" pathLength="100" />
      </svg>
      <div
        className="pointer-events-none absolute inset-0 rounded-[22px]"
        aria-hidden="true"
        style={{ background: `radial-gradient(circle at 12% 40%, ${rgba(rm.rgb, .12)}, transparent 45%)` }}
      />

      <div className="relative z-[2] flex flex-col gap-4 p-4 sm:flex-row sm:gap-5 sm:p-5">
        {/* Showcase + (phone) title */}
        <div className="flex items-center gap-3 sm:block">
          <ShowcaseStage auction={auction} rm={rm} index={index} className="h-[112px] w-[112px] sm:h-[232px] sm:w-[232px]" />
          <div className="min-w-0 flex-1 sm:hidden">
            <FeaturedPill rarityMeta={rm} small />
            <h2 className="mt-1 font-spectral text-[22px] font-bold leading-tight break-words" style={{ color: rm.color }}>{auction.name}</h2>
          </div>
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="hidden items-center gap-2 sm:flex">
                <FeaturedPill rarityMeta={rm} />
                <span className="text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">Featured lot</span>
              </div>
              <h2 className="mt-1 hidden font-spectral text-[28px] font-bold leading-tight break-words sm:block" style={{ color: rm.color }}>
                {auction.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <RarityBadge rarity={auction.rarity} />
                <BlindStatusPill>Blind</BlindStatusPill>
                <YoureBiddingTag show={own.hasBid} />
              </div>
              {auction.description && (
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-text-dim">{auction.description}</p>
              )}
            </div>

            <div className="flex shrink-0 items-start gap-2">
              <div className="text-right" title={`Ends ${formatLocalDateTime(auction.endsAt)} (server ${formatDateTime(auction.endsAt)} ${SERVER_TZ_SHORT})`}>
                <div className="text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">Ends in</div>
                <div className={`font-mono text-[26px] font-bold leading-none ${countdownTone(remaining)}`}>
                  {formatCountdown(auction.endsAt, now)}
                </div>
                <div className="mt-1 text-[11px] text-text-dim">{formatLocalShort(auction.endsAt)}</div>
              </div>
              {isElder && (
                <AdminMenu
                  isMaster={isMaster}
                  isFeatured={isPinned}
                  featuringInFlight={featuringInFlight}
                  onToggleFeatured={onToggleFeatured}
                  onEndEarly={onEndEarly}
                  onDelete={onDelete}
                  itemName={auction.name}
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-text-dim">
            <span>Starts at <strong className="font-mono text-text-bright">{getStartingBid(auction).toLocaleString()}</strong> coins</span>
            <span className="text-white/20" aria-hidden="true">•</span>
            <BidderPill count={bidders} />
            <span className="hidden text-white/20 sm:inline" aria-hidden="true">•</span>
            <span className="hidden text-[12px] sm:inline">Bids stay hidden until the lot closes</span>
          </div>

          <div className="mt-auto">
            <BlindBidPanel
              auction={auction}
              now={now}
              currentUser={currentUser}
              currentCoins={currentCoins}
              bidAmount={bidAmount}
              onBidChange={onBidChange}
              onPlaceBid={onPlaceBid}
              onCancelBid={onCancelBid}
              wide
            />
          </div>
        </div>
      </div>
    </section>
  )
}, sameDataProps)

/* ── Featured lot, side-by-side tile (used when 2–3 lots are featured) ── */

const FeaturedAuctionTile = React.memo(function FeaturedAuctionTile({
  auction, now, currentUser, currentCoins, isElder, isMaster,
  isPinned, onToggleFeatured, featuringInFlight, index = 0,
  bidAmount, onBidChange, onPlaceBid, onCancelBid, onEndEarly, onDelete,
}) {
  const rm = getRarityMeta(auction.rarity)
  const remaining = auction.endsAt - now
  const own = getOwnBidState(auction, currentUser?.name)
  const bidders = getBidderCount(auction)

  return (
    <section
      className="ag-glass ag-ft relative flex h-full flex-col rounded-[22px]"
      style={{
        ...showcaseVars(rm, index),
        borderColor: rgba(rm.rgb, 0.22),
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.16), 0 24px 54px -30px ${rgba(rm.rgb, 0.5)}, 0 18px 44px -26px rgba(0,0,0,.75)`,
      }}
      aria-label={`Featured blind auction: ${auction.name}`}
    >
      <svg className="ag-ft-ring" aria-hidden="true">
        <rect x="0" y="0" width="100%" height="100%" rx="22" ry="22" pathLength="100" />
      </svg>

      <div className="ag-ft-body relative z-[2] flex flex-1 flex-col gap-3 p-3.5 sm:p-4">
        {isElder && (
          <div className="absolute right-3.5 top-3.5 z-[3] sm:right-4 sm:top-4">
            <AdminMenu
              isMaster={isMaster}
              isFeatured={isPinned}
              featuringInFlight={featuringInFlight}
              onToggleFeatured={onToggleFeatured}
              onEndEarly={onEndEarly}
              onDelete={onDelete}
              itemName={auction.name}
            />
          </div>
        )}

        {/* Picture | name + tags | countdown (countdown drops under the name when the card is narrow) */}
        <div className="ag-ft-head">
          <ShowcaseStage auction={auction} rm={rm} index={index} className="ag-ft-head-stage h-[124px] w-[124px] sm:h-[164px] sm:w-[164px]" />

          <div className={`ag-ft-head-info min-w-0 ${isElder ? 'pr-10' : ''}`}>
            <FeaturedPill rarityMeta={rm} small />
            <h2 className="mt-1.5 font-spectral text-[20px] font-bold leading-tight break-words sm:text-[22px]" style={{ color: rm.color }}>
              {auction.name}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <RarityBadge rarity={auction.rarity} />
              <BlindStatusPill>Blind</BlindStatusPill>
              <YoureBiddingTag show={own.hasBid} />
            </div>
          </div>

          <div
            className="ag-ft-head-time"
            title={`Ends ${formatLocalDateTime(auction.endsAt)} (server ${formatDateTime(auction.endsAt)} ${SERVER_TZ_SHORT})`}
          >
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.12em] text-text-dim">Ends in</div>
              <div className={`ag-ft-count font-mono font-bold leading-tight ${countdownTone(remaining)}`}>
                {formatCountdown(auction.endsAt, now)}
              </div>
            </div>
            <div className="ag-ft-date text-[11px] leading-4 text-text-dim">{formatLocalShort(auction.endsAt)}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-text-dim">
          {auction.description && <span className="min-w-0 truncate text-[12px]">{auction.description}</span>}
          {auction.description && <span className="text-white/20" aria-hidden="true">•</span>}
          <span>Starts at <strong className="font-mono text-text-bright">{getStartingBid(auction).toLocaleString()}</strong></span>
          <span className="text-white/20" aria-hidden="true">•</span>
          <BidderPill count={bidders} />
        </div>

        <div className="mt-auto">
          <BlindBidPanel
            auction={auction}
            now={now}
            currentUser={currentUser}
            currentCoins={currentCoins}
            bidAmount={bidAmount}
            onBidChange={onBidChange}
            onPlaceBid={onPlaceBid}
            onCancelBid={onCancelBid}
            stacked
          />
        </div>
      </div>
    </section>
  )
}, sameDataProps)

/* ── Auction card ──────────────────────────────────────────────────── */

const AuctionCard = React.memo(function AuctionCard({
  auction, now, currentUser, currentCoins, isElder, isMaster,
  isFeatured, onToggleFeatured, featuringInFlight, featureSlotsFull,
  bidAmount, onBidChange, onPlaceBid, onCancelBid, onEndEarly, onDelete,
}) {
  const rm = getRarityMeta(auction.rarity)
  const remaining = auction.endsAt - now
  const own = getOwnBidState(auction, currentUser?.name)

  return (
    <article
      className="ag-glass ag-solid ag-lift group relative flex flex-col rounded-[20px]"
      style={{
        '--ag-rim': rgba(rm.rgb, 0.4),
        boxShadow: GLOW_RARITIES.has(auction.rarity)
          ? `inset 0 1px 0 rgba(255,255,255,.16), 0 20px 48px -26px ${rgba(rm.rgb, .5)}`
          : undefined,
      }}
    >
      <div className="h-0.5 w-full rounded-t-[20px]" style={{ background: `linear-gradient(90deg, ${rm.color}, ${rgba(rm.rgb, .12)})` }} />

      <div className="flex flex-1 flex-col gap-3 p-3.5 sm:p-4">
        {/* Item + time */}
        <div className="flex gap-3">
          <ItemThumb auction={auction} rm={rm} size={64} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <RarityBadge rarity={auction.rarity} />
              <YoureBiddingTag show={own.hasBid} />
            </div>
            <h3 className="mt-1 break-words text-[16px] font-bold leading-5" style={{ color: rm.color }}>{auction.name}</h3>
            {auction.description && <p className="mt-0.5 line-clamp-1 text-[12px] leading-4 text-text-dim">{auction.description}</p>}
          </div>

          <div className="flex shrink-0 items-start gap-1.5">
            <div className="text-right" title={`Ends ${formatLocalDateTime(auction.endsAt)} (server ${formatDateTime(auction.endsAt)} ${SERVER_TZ_SHORT})`}>
              <div className={`font-mono text-[16px] font-bold leading-tight ${countdownTone(remaining)}`}>
                {formatCountdown(auction.endsAt, now)}
              </div>
              <div className="mt-0.5 text-[11px] text-text-dim">{formatLocalShort(auction.endsAt)}</div>
            </div>
            {isElder && (
              <AdminMenu
                isMaster={isMaster}
                isFeatured={isFeatured}
                featuringInFlight={featuringInFlight}
                featureSlotsFull={featureSlotsFull}
                onToggleFeatured={onToggleFeatured}
                onEndEarly={onEndEarly}
                onDelete={onDelete}
                itemName={auction.name}
              />
            )}
          </div>
        </div>

        {/* Facts */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-text-dim">
          <span>Starts at <strong className="font-mono" style={{ color: rm.color }}>{getStartingBid(auction).toLocaleString()}</strong> coins</span>
          <BidderPill count={getBidderCount(auction)} />
        </div>

        <div className="mt-auto">
          <BlindBidPanel
            auction={auction}
            now={now}
            currentUser={currentUser}
            currentCoins={currentCoins}
            bidAmount={bidAmount}
            onBidChange={onBidChange}
            onPlaceBid={onPlaceBid}
            onCancelBid={onCancelBid}
          />
        </div>
      </div>
    </article>
  )
}, sameDataProps)

const EndedAuctionRow = React.memo(function EndedAuctionRow({
  auction: a, now, currentUser, isElder, distributors,
  isExpanded, onToggle, onAssignDistributor, onDelete,
  isSelected = false, onToggleSelect,
}) {
  const finalBids = getFinalBidEntries(a)
  const winnerEntry = finalBids[0] || null
  const winner = winnerEntry?.bidder || a.topBidder || ''
  const finalAmount = winnerEntry?.amount || Number(a.currentBid) || 0
  const isMe = !!winner && currentUser?.name === winner
  const endedAt = a.endedAt || a.endsAt || 0
  const agoLabel = endedAt > 0 ? formatRelativePast(now - endedAt) : ''
  const assignedName = a.distributedBy || ''
  const rm = getRarityMeta(a.rarity)

  return (
    <li className={isMe ? 'bg-green-500/[.018]' : ''}>
      <div className="px-3 py-3.5 sm:px-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(360px,1fr)_135px_125px_165px_auto] lg:items-start lg:gap-4">
          <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
            {isElder && (
              <label className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/[.08] bg-black/20 hover:border-gold/30">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onToggleSelect}
                  className="h-4 w-4 accent-yellow-500"
                  aria-label={`Select auction: ${a.name}`}
                />
              </label>
            )}
            {a.imageUrl ? (
              <ItemImage src={a.imageUrl} alt={a.name} size={48} />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-black/20 font-spectral text-lg font-bold" style={{ borderColor: rgba(rm.rgb,.25), color: rm.color }}>
                {a.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: rm.color }} />
                <span className="truncate text-[13px] font-bold" style={{ color: rm.color }}>{a.name}</span>
                <RarityBadge rarity={a.rarity} />
                {isMe && (
                  <span className="shrink-0 rounded-full border border-green-500/20 bg-green-500/[.05] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
                    You Won
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-dim">
                {endedAt > 0 ? (
                  <>
                    <span>{agoLabel || 'Closed'}</span>
                    <span className="text-text-dim/45">·</span>
                    <span title={`Server time: ${formatClock(endedAt)} ${SERVER_TZ_SHORT}`}>{formatLocalClock(endedAt)}</span>
                  </>
                ) : (
                  'Closed'
                )}
              </div>
              <div className="mt-1">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                  finalBids.length === 0
                    ? 'border-white/[.14] bg-white/[.03] text-text-dim'
                    : 'border-gold/30 bg-gold/[.07] text-gold-light'
                }`}>
                  {finalBids.length > 0 && (
                    <span className="font-mono text-[11px] font-bold text-gold-bright">{finalBids.length}</span>
                  )}
                  <span className={finalBids.length > 0 ? 'ml-1' : ''}>
                    {finalBids.length === 0 ? 'No Players Bidding' : finalBids.length === 1 ? 'Player Bidding' : 'Players Bidding'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="contents">
            <div className="min-w-0 self-start sm:col-span-1 lg:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-[.13em] text-text-dim">Winner</div>
              <div className={`mt-1 max-w-[150px] truncate text-[12px] font-semibold leading-5 ${isMe ? 'text-green-400' : 'text-text-bright'}`}>
                {winner || <span className="italic font-normal text-text-dim">No bids</span>}
              </div>
            </div>

            <div className="self-start sm:col-span-1 lg:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-[.13em] text-text-dim">Winning Bid</div>
              <div className="mt-1 font-mono text-[14px] font-bold leading-5 tabular-nums text-gold-bright">
                {finalAmount.toLocaleString()} <span className="text-[11px] font-semibold text-text-dim">coins</span>
              </div>
            </div>

            {winner && (
              <div className="min-w-0 self-start sm:col-span-2 lg:col-span-1">
                <div className="text-[10px] font-bold uppercase tracking-[.13em] text-text-dim">Distribution</div>
                {isElder ? (
                  <select
                    className="input mt-1 h-8 max-w-[155px] px-2 text-[11px]"
                    value={assignedName}
                    onChange={e => onAssignDistributor(e.target.value)}
                    aria-label={`Distributor for ${a.name}`}
                  >
                    <option value="">Not yet assigned</option>
                    {distributors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                ) : (
                  <div className="mt-0.5"><DistributorStatusBadge name={assignedName} /></div>
                )}
              </div>
            )}
          </div>

          <div className="col-span-2 flex shrink-0 items-center justify-start gap-2 border-t border-white/[.05] pt-2.5 sm:justify-end lg:col-span-1 lg:mt-5 lg:border-0 lg:pt-0">
            {finalBids.length > 0 && (
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={isExpanded}
                className="rounded-full ag-chip px-3 py-1.5 text-[11px] font-bold text-gold-light"
              >
                {isExpanded ? 'Hide Results' : 'Reveal Results'}
              </button>
            )}
            {isElder && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete auction: ${a.name}`}
                className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-red-400/75 hover:bg-red-500/[.07] hover:text-red-300"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {isExpanded && finalBids.length > 0 && (
          <div className="mt-2.5 overflow-hidden rounded-xl ag-well">
            <div className="divide-y divide-white/[.04]">
              {finalBids.map((b, idx) => {
                const isWinner = idx === 0
                return (
                  <div
                    key={`${b.bidder}-${b.time}-${idx}`}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 ${
                      isWinner ? 'bg-green-500/[.03]' : ''
                    }`}
                  >
                    <div className={`min-w-0 truncate text-[13px] font-semibold ${isWinner ? 'text-green-300' : 'text-text-bright'}`}>
                      {b.bidder}
                    </div>
                    <div className={`text-right font-mono text-[13px] font-bold tabular-nums ${isWinner ? 'text-green-300' : 'text-text-bright'}`}>
                      {b.amount.toLocaleString()} <span className="text-[10px] font-semibold text-text-dim">coins</span>
                    </div>
                    <div className={`font-mono text-[11px] ${isWinner ? 'text-green-400' : 'text-text-dim'}`}>
                      Final bid · {formatLocalClock(b.time)}
                    </div>
                    <div className="text-right text-[11px] font-bold uppercase tracking-[.12em] text-green-400">
                      {isWinner ? 'Winner' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
            {endedAt > 0 && (
              <div className="border-t border-white/[.05] px-4 py-2 text-[11px] text-text-dim">
                Closed {formatLocalDateTime(endedAt)}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}, sameDataProps)