import React, { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ResetPasswordModal from './ResetPasswordModal'

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const POWER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const PROFILE_REGION = 'STEAM'
const PROFILE_SERVER = '005'
const CDN = 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft'

const GRADE_META = {
  Epic:      { label: 'Epic',      color: '#ef4444', image: `${CDN}/grade/list_thumbnail_epic.webp` },
  Legendary: { label: 'Legendary', color: '#f5c542', image: `${CDN}/grade/list_thumbnail_legendary.webp` },
  Mythic:    { label: 'Mythical',  color: '#c026d3', image: `${CDN}/grade/list_thumbnail_mythic.webp` },
}

const CLASS_META = {
  Berserker:      { icon: '⚔', file: 'berserker' },
  Warlord:        { icon: '🛡', file: 'warlord' },
  Archer:         { icon: '🏹', file: 'archer' },
  Skald:          { icon: '♫', file: 'skald' },
  Volva:          { icon: '✦', file: 'volva' },
  'Rune Fighter': { icon: 'ᚱ', file: 'runeFighter' },
}
const CLASS_NAMES = Object.keys(CLASS_META)

const AWAKENING_BADGE = `${CDN}/badge_awakening.webp`

const AWAKENING_OPTIONS = [
  { value: 0, label: 'Not Awakened' },
  { value: 1, label: 'Stage 1' },
]

const ROLE_STYLE = {
  Admin:  'border-red-400/35 bg-red-400/[.12] text-red-300',
  Master: 'border-gold/40 bg-gold/[.12] text-gold-bright',
  Elder:  'border-orange-300/30 bg-orange-300/[.1] text-orange-300',
  Member: 'border-sky-300/25 bg-sky-300/[.08] text-sky-300',
}

const STAFF_ROLES = ['Admin', 'Master', 'Elder']

// Cards are added in batches as you scroll, so a big clan doesn't load 200+ images at once.
const CARD_BATCH = 24

const SORT_OPTIONS = [
  { value: 'power', label: 'Power' },
  { value: 'name', label: 'Name' },
  { value: 'role', label: 'Role' },
]

const EMPTY_NEW_MEMBER = {
  name: '', username: '', password: '', cls: 'Berserker', power: '10.000',
  character_level: '1', awakening_stage: 0, role: 'Member', profile_grade: 'Legendary',
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const toNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
const formatNumber = value => toNumber(value).toLocaleString()
const digitsOnly = value => String(value ?? '').replace(/\D/g, '')

// 1250000 -> "1.250.000". The stored value stays numeric; the dots are display-only.
const formatPowerInput = value => {
  const digits = digitsOnly(value)
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''
}
const parsePowerInput = value => {
  const digits = digitsOnly(value)
  return digits ? Number(digits) : NaN
}

const formatDate = value => {
  if (!value) return 'Not updated yet'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? 'Not updated yet'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const isStaffRole = role => STAFF_ROLES.includes(role)
const gradeKeyOf = member => (member?.profile_grade === 'Mythical' ? 'Mythic' : (member?.profile_grade || 'Legendary'))
const gradeOf = member => GRADE_META[gradeKeyOf(member)] || GRADE_META.Legendary
const levelOf = member => Math.max(1, toNumber(member?.character_level || member?.level, 1))
const awakeningOf = member => Math.max(0, toNumber(member?.awakening_stage, 0))
const awakeningLabel = stage => (stage > 0 ? `Awakening ${stage}` : 'Not Awakened')
const sameId = (a, b) => String(a) === String(b)

function getCooldown(member) {
  if (!member?.power_next_update_at) return 0
  const t = new Date(member.power_next_update_at).getTime()
  return Number.isNaN(t) ? 0 : Math.max(0, t - Date.now())
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'PB'
}

function customImage(member) {
  return member?.character_image || member?.characterImage || member?.avatar_url || member?.avatarUrl || member?.image || ''
}

function classAssets(cls) {
  const file = (CLASS_META[cls] || CLASS_META.Berserker).file
  return {
    thumbnail: `${CDN}/character/thumbnail/${file}.webp`,
    nameplate: `${CDN}/character/classname/en/${file}.webp`,
  }
}

// Every member row in the database (including hidden Admin accounts).
function allRows(ctxAllMembers, members) {
  if (Array.isArray(ctxAllMembers) && ctxAllMembers.length > 0) return ctxAllMembers
  return Array.isArray(members) ? members : []
}

/* ═══════════════════════════════════════════════════════════════════════════
   Styles (scoped to .mb-root)
   ═══════════════════════════════════════════════════════════════════════════ */

const MB_STYLES = `
  .mb-root { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  .mb-root .text-text-dim { color: #c9bda8; }
  .mb-root .font-mono { font-variant-numeric: tabular-nums; letter-spacing: 0; }

  .mb-root .mb-glass {
    position: relative;
    background:
      radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,.08) 0%, transparent 50%),
      linear-gradient(160deg, rgba(34,28,22,.58) 0%, rgba(12,10,8,.66) 100%);
    backdrop-filter: blur(22px) saturate(160%);
    -webkit-backdrop-filter: blur(22px) saturate(160%);
    border: 1px solid rgba(255,255,255,.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 22px 60px -30px rgba(0,0,0,.85);
  }
  .mb-root .mb-glass::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    padding: 1px;
    border-radius: inherit;
    background: linear-gradient(140deg,
      rgba(255,255,255,.38) 0%,
      rgba(255,255,255,.04) 35%,
      var(--mb-rim, rgba(201,162,75,.26)) 70%,
      rgba(255,255,255,.1) 100%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
  /* Same look, no live blur: used for the repeated member cards */
  .mb-root .mb-glass.mb-solid {
    background:
      radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,.06) 0%, transparent 50%),
      linear-gradient(160deg, rgba(30,25,20,.94) 0%, rgba(13,11,9,.96) 100%);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .mb-root .mb-glass.mb-modal {
    background:
      radial-gradient(120% 60% at 0% 0%, rgba(255,255,255,.08) 0%, transparent 50%),
      linear-gradient(160deg, rgba(34,28,22,.86) 0%, rgba(12,10,8,.92) 100%);
    backdrop-filter: blur(16px) saturate(150%);
    -webkit-backdrop-filter: blur(16px) saturate(150%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 40px 90px -20px rgba(0,0,0,.85);
    animation: mb-pop .22s cubic-bezier(.2,.8,.2,1) both;
  }
  /* No blur behind modals: blurring a page full of artwork is very expensive. */
  .mb-root .mb-overlay {
    background: rgba(5,4,3,.74);
    animation: mb-fade .18s ease-out both;
  }

  /* Off-screen cards are skipped by the browser until you scroll near them. */
  .mb-root .mb-cv {
    content-visibility: auto;
    contain-intrinsic-size: auto 360px;
  }

  /* Artwork fades in when it has loaded instead of popping in. */
  .mb-root .mb-img { opacity: 0; transition: opacity .35s ease; }
  .mb-root .mb-img.is-loaded { opacity: 1; }

  /* Gentle zoom on the character when hovering a card (GPU-only, cheap). */
  .mb-root .mb-portrait { transition: transform .35s cubic-bezier(.2,.8,.2,1), opacity .35s ease; transform-origin: 50% 100%; }
  .mb-root .mb-card:hover .mb-portrait { transform: scale(1.05); }

  /* Filter chips + segmented sort */
  .mb-root .mb-pill {
    border: 1px solid rgba(255,255,255,.1);
    background: rgba(255,255,255,.04);
    color: #c9bda8;
    transition: background .15s ease, border-color .15s ease, color .15s ease;
  }
  .mb-root .mb-pill:hover { border-color: rgba(235,208,141,.3); color: #f4ebd9; }
  .mb-root .mb-pill[aria-pressed="true"] {
    background: linear-gradient(180deg, rgba(201,162,75,.24) 0%, rgba(201,162,75,.08) 100%);
    border-color: rgba(235,208,141,.45);
    color: #f6dd93;
  }
  .mb-root .mb-seg { background: rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.08); }
  .mb-root .mb-seg button[aria-pressed="true"] {
    background: linear-gradient(180deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.05) 100%);
    color: #f4ebd9;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.2);
  }
  .mb-root input[type="search"]::-webkit-search-cancel-button { -webkit-appearance: none; display: none; }
  .mb-root .mb-kbd {
    border: 1px solid rgba(255,255,255,.14);
    border-bottom-width: 2px;
    background: rgba(255,255,255,.05);
  }
  .mb-root .mb-lift { transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease; }
  .mb-root .mb-lift:hover { transform: translateY(-3px); }

  .mb-root .mb-inset {
    background: linear-gradient(180deg, rgba(255,255,255,.05) 0%, rgba(255,255,255,.018) 100%);
    border: 1px solid rgba(255,255,255,.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.07);
  }
  .mb-root .mb-inset.mb-gold {
    background: linear-gradient(160deg, rgba(201,162,75,.13) 0%, rgba(201,162,75,.03) 100%);
    border-color: rgba(235,208,141,.2);
  }
  .mb-root .mb-inset.mb-red {
    background: linear-gradient(160deg, rgba(239,68,68,.1) 0%, rgba(239,68,68,.02) 100%);
    border-color: rgba(248,113,113,.22);
  }
  .mb-root .mb-well {
    background: rgba(0,0,0,.24);
    border: 1px solid rgba(255,255,255,.07);
    box-shadow: inset 0 2px 6px rgba(0,0,0,.32), 0 1px 0 rgba(255,255,255,.04);
  }
  .mb-root .mb-chip {
    background: linear-gradient(180deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.025) 100%);
    border: 1px solid rgba(255,255,255,.1);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 4px 14px -8px rgba(0,0,0,.5);
    transition: background .2s ease, border-color .2s ease, color .2s ease;
  }
  .mb-root button.mb-chip:hover:not(:disabled) {
    background: linear-gradient(180deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.04) 100%);
    border-color: rgba(235,208,141,.3);
  }
  .mb-root .mb-chip.mb-chip-gold {
    background: linear-gradient(180deg, rgba(201,162,75,.2) 0%, rgba(201,162,75,.06) 100%);
    border-color: rgba(235,208,141,.3);
  }
  .mb-root .mb-chip.mb-chip-red {
    background: linear-gradient(180deg, rgba(239,68,68,.15) 0%, rgba(239,68,68,.04) 100%);
    border-color: rgba(248,113,113,.3);
  }
  .mb-root .mb-emblem {
    background:
      radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,.3) 0%, transparent 60%),
      linear-gradient(160deg, rgba(201,162,75,.28) 0%, rgba(201,162,75,.07) 100%);
    border: 1px solid rgba(255,255,255,.2);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 6px 18px -8px rgba(201,162,75,.5);
  }
  .mb-root .mb-emblem-red {
    background:
      radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,.25) 0%, transparent 60%),
      linear-gradient(160deg, rgba(239,68,68,.3) 0%, rgba(239,68,68,.08) 100%);
    border: 1px solid rgba(255,180,170,.28);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 6px 18px -8px rgba(239,68,68,.5);
  }

  .mb-root .input {
    width: 100%;
    background: linear-gradient(180deg, rgba(0,0,0,.32) 0%, rgba(0,0,0,.16) 100%);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 12px;
    color: #f4ebd9;
    box-shadow: inset 0 2px 6px rgba(0,0,0,.3), 0 1px 0 rgba(255,255,255,.05);
    transition: border-color .2s ease, box-shadow .2s ease;
  }
  .mb-root .input::placeholder { color: rgba(201,189,168,.5); }
  .mb-root .input:focus {
    outline: none;
    border-color: rgba(235,208,141,.55);
    box-shadow: inset 0 2px 6px rgba(0,0,0,.28), 0 0 0 3px rgba(201,162,75,.2);
  }
  .mb-root .input:disabled { opacity: .55; }
  .mb-root select.input option { background: #15110e; color: #f4ebd9; }

  .mb-root .btn-gold {
    border: 1px solid rgba(255,240,200,.5);
    border-radius: 999px;
    color: #1a140b;
    font-weight: 700;
    background: linear-gradient(180deg,
      rgba(255,246,214,.96) 0%,
      rgba(235,208,141,.95) 20%,
      rgba(201,162,75,.93) 58%,
      rgba(160,122,46,.96) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.7),
      inset 0 -3px 8px rgba(90,60,10,.32),
      0 10px 24px -10px rgba(201,162,75,.6);
    transition: transform .2s ease, filter .2s ease;
  }
  .mb-root .btn-gold:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
  .mb-root .btn-gold:disabled { opacity: .45; cursor: not-allowed; }
  .mb-root .mb-btn-red {
    color: #fff5f3;
    font-weight: 700;
    border: 1px solid rgba(255,190,180,.45);
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(248,113,113,.95) 0%, rgba(220,38,38,.92) 60%, rgba(170,28,28,.95) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.45), inset 0 -3px 8px rgba(90,10,10,.3), 0 10px 24px -10px rgba(239,68,68,.6);
    transition: transform .2s ease, filter .2s ease;
  }
  .mb-root .mb-btn-red:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
  .mb-root .mb-btn-red:disabled { opacity: .4; cursor: not-allowed; }

  .mb-root .mb-focus:focus-visible,
  .mb-root button:focus-visible {
    outline: 2px solid rgba(235,208,141,.75);
    outline-offset: 2px;
  }

  @keyframes mb-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes mb-pop {
    from { opacity: 0; transform: translateY(10px) scale(.98); }
    to   { opacity: 1; transform: none; }
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .mb-root .mb-glass, .mb-root .mb-glass.mb-modal { background: rgba(16,13,11,.97); }
  }
  @media (prefers-reduced-motion: reduce) {
    .mb-root .mb-overlay, .mb-root .mb-glass.mb-modal { animation: none; }
    .mb-root .mb-img, .mb-root .mb-portrait { transition: none; }
    .mb-root .mb-card:hover .mb-portrait { transform: none; }
    .mb-root .mb-lift, .mb-root .mb-lift:hover, .mb-root .btn-gold { transition: none; transform: none; }
  }
`

/* ═══════════════════════════════════════════════════════════════════════════
   Shared UI: modal shell, confirm dialog, small pieces
   ═══════════════════════════════════════════════════════════════════════════ */

// Shared body-scroll lock so stacked modals don't fight over overflow.
let scrollLocks = 0
function lockScroll() {
  if (scrollLocks++ === 0) document.body.style.overflow = 'hidden'
  return () => {
    if (--scrollLocks === 0) document.body.style.overflow = ''
  }
}

/**
 * Glass modal rendered into <body>, so it always sits above the top bar.
 * Closes on Escape / backdrop click unless `busy` (saving in progress).
 */
function Modal({ title, eyebrow, onClose, busy = false, size = 'max-w-lg', children, footer, labelledBy }) {
  const fallbackId = useId()
  const titleId = labelledBy || fallbackId
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const busyRef = useRef(busy)
  busyRef.current = busy

  useEffect(() => {
    const unlock = lockScroll()
    const onKey = e => {
      if (e.key !== 'Escape') return
      // A confirm dialog on top handles its own Escape.
      if (document.querySelector('[data-mb-confirm]')) return
      if (!busyRef.current) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [])

  return createPortal(
    <div className="mb-root fixed inset-0 z-[300] flex items-end justify-center p-2 sm:items-center sm:p-5">
      <div className="mb-overlay absolute inset-0" onClick={() => !busy && onClose()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`mb-glass mb-modal flex max-h-[92vh] w-full ${size} flex-col overflow-hidden rounded-[24px]`}
      >
        {title !== undefined && (
          <div className="flex items-start justify-between gap-3 border-b border-white/[.08] px-5 py-4">
            <div className="min-w-0">
              {eyebrow && <div className="text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim">{eyebrow}</div>}
              <h2 id={titleId} className="mt-0.5 truncate font-spectral text-[1.3rem] font-bold leading-tight text-text-bright">
                {title}
              </h2>
            </div>
            <CloseButton onClick={onClose} disabled={busy} />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="border-t border-white/[.08] bg-white/[.025] px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

function CloseButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Close"
      className="mb-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] leading-none text-text-dim hover:text-text-bright disabled:opacity-40"
    >
      ×
    </button>
  )
}

/**
 * Glass confirm dialog. `requireText` makes the user type a word (e.g. RESET)
 * before the confirm button unlocks.
 */
function ConfirmDialog({
  title, body, note, details, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'gold', requireText, onConfirm, onCancel,
}) {
  const titleId = useId()
  const [typed, setTyped] = useState('')
  const firstRef = useRef(null)
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel
  const unlocked = !requireText || typed === requireText
  const danger = tone === 'danger'

  useEffect(() => {
    const previous = document.activeElement
    firstRef.current?.focus()
    const unlock = lockScroll()
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); cancelRef.current() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      unlock()
      previous?.focus?.()
    }
  }, [])

  return createPortal(
    <div data-mb-confirm="" className="mb-root fixed inset-0 z-[400] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <div className="mb-overlay absolute inset-0" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mb-glass mb-modal relative w-full max-w-[440px] overflow-hidden rounded-[24px]"
      >
        <div className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-start gap-3.5">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold ${danger ? 'mb-emblem-red text-red-200' : 'mb-emblem text-gold-light'}`}
              aria-hidden="true"
            >
              {danger ? '!' : '?'}
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-spectral text-[19px] font-bold leading-tight text-text-bright">{title}</h2>
              <div className="mt-1.5 space-y-2 text-[13px] leading-5 text-text-dim">
                {body && <p>{body}</p>}
                {details?.length > 0 && (
                  <ul className="mb-well max-h-40 space-y-1 overflow-y-auto rounded-xl px-3 py-2 text-[12px] text-text-bright">
                    {details.map((line, i) => <li key={`${i}-${line}`} className="truncate">• {line}</li>)}
                  </ul>
                )}
                {note && <p className={`text-[12px] ${danger ? 'text-red-300/90' : 'text-gold-light/85'}`}>{note}</p>}
                {requireText && (
                  <label className="block pt-1">
                    <span className="mb-1.5 block text-[12px] text-text-dim">
                      Type <strong className="font-mono text-text-bright">{requireText}</strong> to continue.
                    </span>
                    <input
                      ref={firstRef}
                      value={typed}
                      onChange={e => setTyped(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && unlocked) onConfirm() }}
                      placeholder={requireText}
                      autoComplete="off"
                      className="input h-11 px-3 font-mono text-[14px] font-bold uppercase tracking-wider"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-white/[.08] bg-white/[.025] px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
          <button
            ref={requireText ? undefined : firstRef}
            type="button"
            onClick={onCancel}
            className="mb-chip h-10 rounded-full px-5 text-[13px] font-semibold text-text-bright"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!unlocked}
            className={`h-10 px-5 text-[13px] ${danger ? 'mb-btn-red' : 'btn-gold'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function useConfirm() {
  const [dialog, setDialog] = useState(null)
  const resolver = useRef(null)

  const ask = useCallback(options => new Promise(resolve => {
    resolver.current?.(false)
    resolver.current = resolve
    setDialog(options)
  }), [])

  const settle = useCallback(result => {
    resolver.current?.(result)
    resolver.current = null
    setDialog(null)
  }, [])

  useEffect(() => () => resolver.current?.(false), [])

  const element = dialog
    ? <ConfirmDialog {...dialog} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
    : null
  return [ask, element]
}

function RolePill({ role }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${ROLE_STYLE[role] || ROLE_STYLE.Member}`}>
      {role || 'Member'}
    </span>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-text-dim/80">{hint}</span>}
    </label>
  )
}

function StatTile({ label, value, accent = false }) {
  return (
    <div className={`mb-inset rounded-2xl px-3.5 py-3 ${accent ? 'mb-gold' : ''}`}>
      <div className="text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">{label}</div>
      <div className={`mt-1 truncate font-mono text-[15px] font-bold ${accent ? 'text-gold-bright' : 'text-text-bright'}`}>{value}</div>
    </div>
  )
}

// Hides itself if the remote image fails, so a broken CDN link never shows an icon.
function SafeImg({ src, alt = '', className = '', onFail, eager = false, ...rest }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    setFailed(false)
    // Already in the browser cache: show it straight away.
    setLoaded(Boolean(ref.current?.complete && ref.current.naturalWidth))
  }, [src])
  if (!src || failed) return null
  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={`mb-img ${loaded ? 'is-loaded' : ''} ${className}`}
      onLoad={() => setLoaded(true)}
      onError={() => { setFailed(true); onFail?.() }}
      {...rest}
    />
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Character artwork
   ═══════════════════════════════════════════════════════════════════════════ */

const CharacterArtwork = React.memo(function CharacterArtwork({ member, large = false }) {
  const grade = gradeOf(member)
  const assets = classAssets(member?.cls)
  const awakening = awakeningOf(member)
  const portrait = customImage(member) || assets.thumbnail
  const [portraitFailed, setPortraitFailed] = useState(false)
  useEffect(() => setPortraitFailed(false), [portrait])

  return (
    <div
      className={`relative w-full overflow-hidden bg-black/50 ${large ? 'aspect-[4/5] rounded-[20px]' : 'aspect-[4/5]'}`}
      style={{ boxShadow: `inset 0 0 40px ${grade.color}33` }}
    >
      {/* Official grade background */}
      <SafeImg src={grade.image} eager={large} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/60" aria-hidden="true" />

      {/* Character */}
      {!portraitFailed ? (
        <SafeImg
          src={portrait}
          alt={member?.cls || 'Character'}
          onFail={() => setPortraitFailed(true)}
          eager={large}
          className="mb-portrait absolute inset-x-0 bottom-0 mx-auto h-[92%] w-auto max-w-none object-contain object-bottom"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center font-spectral text-4xl font-bold text-white/80" aria-hidden="true">
          {initials(member?.name)}
        </div>
      )}

      {/* Clean gold frame (replaces the official frame image, which has the game logo printed on it) */}
      <div
        className={`pointer-events-none absolute border ${large ? 'inset-2 rounded-[14px]' : 'inset-1.5 rounded-[12px]'}`}
        style={{ borderColor: `${grade.color}66`, boxShadow: `inset 0 0 0 1px rgba(0,0,0,.35), inset 0 0 24px ${grade.color}26` }}
        aria-hidden="true"
      />

      {/* Dark band behind the class name, so it's always readable */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent ${large ? 'h-28' : 'h-20'}`} aria-hidden="true" />

      {/* Awakening badge */}
      {awakening > 0 && (
        <div className={`absolute ${large ? 'right-3 top-3 h-12 w-12' : 'right-2.5 top-2.5 h-9 w-9'}`} title={awakeningLabel(awakening)}>
          <SafeImg src={AWAKENING_BADGE} className="h-full w-full object-contain" />
          <span className={`absolute inset-0 flex items-center justify-center font-bold text-white drop-shadow ${large ? 'text-[15px]' : 'text-[12px]'}`}>
            {awakening}
          </span>
        </div>
      )}

      {/* Official class nameplate */}
      <div className={`absolute inset-x-3 flex justify-center ${large ? 'bottom-5' : 'bottom-3'}`}>
        <SafeImg src={assets.nameplate} alt="" className={`${large ? 'h-11' : 'h-7 sm:h-8'} w-auto max-w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,.9)]`} />
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Member card
   ═══════════════════════════════════════════════════════════════════════════ */

const RANK_TONES = {
  1: 'border-gold/50 bg-gold/[.2] text-gold-bright',
  2: 'border-slate-200/40 bg-slate-200/[.14] text-slate-100',
  3: 'border-orange-300/40 bg-orange-300/[.14] text-orange-200',
}

const MemberCard = React.memo(function MemberCard({ member, rank, isSelf, onOpen }) {
  const grade = gradeOf(member)
  return (
    <button
      type="button"
      onClick={() => onOpen(member)}
      aria-label={`${member.name}, rank ${rank}, ${formatNumber(member.power)} Growth Power`}
      className="mb-glass mb-solid mb-lift mb-cv mb-card group relative flex w-full min-w-0 flex-col overflow-hidden rounded-[20px] text-left"
      style={{ '--mb-rim': `${grade.color}80` }}
    >
      <div className="relative">
        <CharacterArtwork member={member} />
        <span className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 font-mono text-[12px] font-bold ${RANK_TONES[rank] || 'border-white/20 bg-black/70 text-text-bright'}`}>
          #{rank}
        </span>
        {isSelf && (
          <span className="absolute left-3 top-10 rounded-full border border-emerald-300/40 bg-emerald-900/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
            You
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-spectral text-[16px] font-bold leading-tight text-text-bright group-hover:text-gold-light sm:text-[17px]">
              {member.name}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-text-dim">
              {member.cls || 'Berserker'} · Lv. {levelOf(member)}
            </div>
          </div>
          <RolePill role={member.role} />
        </div>

        <div className="mb-well mt-auto flex items-baseline justify-between gap-2 rounded-xl px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-[.1em] text-text-dim">Power</span>
          <span className="truncate font-mono text-[15px] font-bold text-gold-bright">{formatNumber(member.power)}</span>
        </div>
      </div>
    </button>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Profile (read-only view, with a "Manage" button for staff)
   ═══════════════════════════════════════════════════════════════════════════ */

function ProfileModal({ member, ranked, list = [], isSelf, canManage, onManage, onNavigate, onClose }) {
  const listIndex = list.findIndex(m => sameId(m.id, member.id))
  const prev = listIndex > 0 ? list[listIndex - 1] : null
  const next = listIndex >= 0 && listIndex < list.length - 1 ? list[listIndex + 1] : null
  const navRef = useRef({ prev, next, onNavigate })
  navRef.current = { prev, next, onNavigate }

  // ← / → browse through the members currently shown on the page.
  useEffect(() => {
    const onKey = e => {
      if (document.querySelector('[data-mb-confirm]')) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const { prev: p, next: n, onNavigate: go } = navRef.current
      if (e.key === 'ArrowLeft' && p) { e.preventDefault(); go?.(p) }
      if (e.key === 'ArrowRight' && n) { e.preventDefault(); go?.(n) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const index = ranked.findIndex(m => sameId(m.id, member.id))
  const rank = index >= 0 ? index + 1 : '—'
  const above = index > 0 ? ranked[index - 1] : null
  const grade = gradeOf(member)
  const gapToNext = above ? Math.max(0, toNumber(above.power) - toNumber(member.power)) : 0

  return (
    <Modal
      title={member.name}
      eyebrow={isSelf ? 'Your Character' : 'Character Profile'}
      onClose={onClose}
      size="max-w-3xl"
      footer={list.length > 1 && listIndex >= 0 ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => prev && onNavigate(prev)}
            disabled={!prev}
            className="mb-chip flex h-10 min-w-0 max-w-[42%] items-center gap-2 rounded-full px-4 text-[12px] font-semibold text-text-bright disabled:opacity-30"
          >
            <span aria-hidden="true">←</span>
            <span className="truncate">{prev ? prev.name : 'Previous'}</span>
          </button>
          <span className="hidden shrink-0 items-center gap-1.5 text-[12px] text-text-dim sm:flex">
            {listIndex + 1} of {list.length}
            <span className="mb-kbd rounded px-1.5 font-mono text-[10px]">←</span>
            <span className="mb-kbd rounded px-1.5 font-mono text-[10px]">→</span>
          </span>
          <span className="shrink-0 text-[12px] text-text-dim sm:hidden">{listIndex + 1} / {list.length}</span>
          <button
            type="button"
            onClick={() => next && onNavigate(next)}
            disabled={!next}
            className="mb-chip flex h-10 min-w-0 max-w-[42%] items-center gap-2 rounded-full px-4 text-[12px] font-semibold text-text-bright disabled:opacity-30"
          >
            <span className="truncate">{next ? next.name : 'Next'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : null}
    >
      <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[260px]">
          <div className="mb-glass overflow-hidden rounded-[20px]" style={{ '--mb-rim': `${grade.color}80` }}>
            <CharacterArtwork member={member} large />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <RolePill role={member.role} />
            <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={{ color: grade.color, borderColor: `${grade.color}55`, background: `${grade.color}14` }}>
              {grade.label}
            </span>
            <span className="text-[13px] text-text-dim">
              {member.cls || 'Berserker'} · Lv. {levelOf(member)} · {awakeningLabel(awakeningOf(member))}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="mb-inset mb-gold rounded-2xl px-4 py-3.5">
              <div className="text-[11px] font-bold uppercase tracking-[.12em] text-gold-dim">Growth Power</div>
              <div className="mt-1 font-mono text-[1.6rem] font-bold leading-none text-gold-bright">{formatNumber(member.power)}</div>
            </div>
            <div className="mb-inset rounded-2xl px-4 py-3.5">
              <div className="text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">Clan Rank</div>
              <div className="mt-1 font-mono text-[1.6rem] font-bold leading-none text-text-bright">#{rank}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatTile label="Coins" value={formatNumber(member.coins)} accent />
            <StatTile label="Attendance" value={formatNumber(member.attendance)} />
            <StatTile label="Server" value={`${member.region || PROFILE_REGION} · ${member.server || PROFILE_SERVER}`} />
          </div>

          <div className="mb-well divide-y divide-white/[.06] rounded-2xl text-[13px]">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-text-dim">Power last updated</span>
              <span className="font-semibold text-text-bright">{formatDate(member.power_updated_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-text-dim">{above ? `To reach #${rank - 1}` : 'Position'}</span>
              <span className="font-semibold text-gold-light">
                {above ? `+${formatNumber(gapToNext)} Power` : 'Top of the clan'}
              </span>
            </div>
          </div>

          {canManage ? (
            <button type="button" onClick={() => onManage(member)} className="btn-gold h-11 w-full text-[13px]">
              Manage {isSelf ? 'My Character' : member.name}
            </button>
          ) : isSelf && (
            <p className="mb-inset rounded-2xl px-4 py-3 text-[12px] leading-5 text-text-dim">
              Need to update your Power or character? Ask a Master or Elder to update it for you.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Power ranking
   ═══════════════════════════════════════════════════════════════════════════ */

function RankingModal({ ranked, currentUserId, onOpen, onClose }) {
  const listRef = useRef(null)
  const myIndex = ranked.findIndex(m => sameId(m.id, currentUserId))
  const jumpToMe = () => {
    listRef.current?.querySelector('[data-me="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  return (
    <Modal
      title="Clan Power Ranking"
      eyebrow="PeakyBlinder"
      onClose={onClose}
      size="max-w-xl"
      footer={myIndex >= 0 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-text-dim">You are <strong className="font-mono text-text-bright">#{myIndex + 1}</strong> of {ranked.length}</span>
          <button type="button" onClick={jumpToMe} className="mb-chip h-9 rounded-full px-4 text-[12px] font-semibold text-emerald-300">
            Jump to me ↓
          </button>
        </div>
      ) : null}
    >
      <ol ref={listRef} className="divide-y divide-white/[.06]">
        {ranked.map((member, i) => {
          const rank = i + 1
          const self = sameId(member.id, currentUserId)
          return (
            <li key={member.id} data-me={self ? 'true' : undefined}>
              <button
                type="button"
                onClick={() => onOpen(member)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[.04] sm:px-5 ${self ? 'bg-emerald-400/[.05]' : ''}`}
              >
                <span className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-[12px] font-bold ${RANK_TONES[rank] || 'border-white/10 bg-white/[.04] text-text-dim'}`}>
                  #{rank}
                </span>
                <span className="mb-emblem flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] text-gold-light" aria-hidden="true">
                  {(CLASS_META[member.cls] || CLASS_META.Berserker).icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-text-bright">
                    {member.name}{self && <span className="ml-1.5 text-[11px] font-bold text-emerald-300">· You</span>}
                  </span>
                  <span className="block truncate text-[12px] text-text-dim">
                    {member.cls || 'Berserker'} · Lv. {levelOf(member)} · {awakeningLabel(awakeningOf(member))}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-[14px] font-bold text-gold-bright">{formatNumber(member.power)}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Staff panel: member list + coin economy
   ═══════════════════════════════════════════════════════════════════════════ */

function StaffPanel({ members, currentUserId, busy, onManage, onCoinDecay, onCoinReset, onClose }) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? members.filter(m => `${m.name || ''} ${m.username || ''}`.toLowerCase().includes(q)) : members
  }, [members, search])

  const allVisibleSelected = visible.length > 0 && visible.every(m => selectedIds.has(String(m.id)))
  const selectedCount = selectedIds.size

  const toggle = id => setSelectedIds(prev => {
    const next = new Set(prev)
    const key = String(id)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const toggleVisible = () => setSelectedIds(prev => {
    const next = new Set(prev)
    visible.forEach(m => (allVisibleSelected ? next.delete(String(m.id)) : next.add(String(m.id))))
    return next
  })

  const runDecay = async () => {
    const ok = await onCoinDecay([...selectedIds])
    if (ok) setSelectedIds(new Set())
  }

  return (
    <Modal title="Staff Controls" eyebrow="Clan Administration" onClose={onClose} busy={busy} size="max-w-2xl">
      <div className="space-y-4 p-4 sm:p-5">
        {/* Coin economy */}
        <section className="mb-inset mb-gold rounded-2xl p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold text-text-bright">🪙 Coin Economy</h3>
              <p className="mt-0.5 text-[12px] leading-5 text-text-dim">
                Select members below, then apply a 25% decay (balances drop to 75%).
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={runDecay}
                disabled={busy || selectedCount === 0}
                className="btn-gold h-10 px-4 text-[12px]"
              >
                {busy ? 'Working…' : `↓ 25% Decay${selectedCount ? ` (${selectedCount})` : ''}`}
              </button>
              <button
                type="button"
                onClick={onCoinReset}
                disabled={busy}
                className="mb-chip mb-chip-red h-10 rounded-full px-4 text-[12px] font-bold text-red-300 disabled:opacity-40"
              >
                Reset All to 0
              </button>
            </div>
          </div>
        </section>

        {/* Search + selection */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" aria-hidden="true">⌕</span>
            <input
              className="input h-10 pl-9 pr-3 text-[13px]"
              placeholder="Search name or username…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoComplete="off"
              aria-label="Search members"
            />
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={toggleVisible} disabled={busy || visible.length === 0} className="mb-chip h-10 flex-1 rounded-full px-4 text-[12px] font-semibold text-text-bright disabled:opacity-40 sm:flex-none">
              {allVisibleSelected ? 'Clear Visible' : 'Select Visible'}
            </button>
            {selectedCount > 0 && (
              <button type="button" onClick={() => setSelectedIds(new Set())} disabled={busy} className="mb-chip h-10 flex-1 rounded-full px-4 text-[12px] font-semibold text-text-dim disabled:opacity-40 sm:flex-none">
                Clear ({selectedCount})
              </button>
            )}
          </div>
        </div>

        {/* Member list */}
        <div className="mb-well overflow-hidden rounded-2xl">
          {visible.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-text-dim">No matching members.</div>
          ) : (
            <ul className="max-h-[46vh] divide-y divide-white/[.06] overflow-y-auto">
              {visible.map(member => {
                const checked = selectedIds.has(String(member.id))
                return (
                  <li key={member.id} className={`flex items-center gap-3 px-3 py-2.5 ${checked ? 'bg-gold/[.07]' : ''}`}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(member.id)}
                      disabled={busy}
                      aria-label={`${checked ? 'Deselect' : 'Select'} ${member.name || 'member'}`}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[13px] font-black transition ${checked ? 'border-gold bg-gold text-black' : 'border-white/20 bg-black/25 text-transparent hover:border-gold/50'}`}
                    >
                      ✓
                    </button>
                    <button type="button" onClick={() => onManage(member)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-text-bright">
                          {member.name}{sameId(member.id, currentUserId) && <span className="ml-1.5 text-[11px] font-bold text-emerald-300">· You</span>}
                        </span>
                        <span className="block truncate text-[12px] text-text-dim">
                          {member.cls || '—'} · Lv. {levelOf(member)} · <span className="text-gold-light">{formatNumber(member.coins)} coins</span>
                        </span>
                      </span>
                      <RolePill role={member.role} />
                      <span className="shrink-0 text-[18px] text-text-dim" aria-hidden="true">›</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Staff editor: one place to edit a member
   ═══════════════════════════════════════════════════════════════════════════ */

function StaffEditor({ member, ctx, ask, onClose, onResetPassword, onResetPowerWindow }) {
  const { updateMember, deleteMember, addToast, currentUser } = ctx
  const [form, setForm] = useState(() => ({
    cls: member.cls || 'Berserker',
    grade: gradeKeyOf(member),
    level: String(levelOf(member)),
    awakening: String(awakeningOf(member)),
    coins: String(toNumber(member.coins)),
    power: formatPowerInput(member.power ?? 0),
  }))
  const [busy, setBusy] = useState(false)
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  const role = currentUser?.role
  const isAdmin = role === 'Admin'
  const isMaster = isAdmin || role === 'Master'
  const isSelf = sameId(member.id, currentUser?.id)
  const canManage = isStaffRole(role)
  const canRemove = !isSelf && (isAdmin || (isMaster && !['Admin', 'Master'].includes(member.role)) || (role === 'Elder' && member.role === 'Member'))
  const canRole = !isSelf && (isAdmin || (isMaster && !['Admin', 'Master'].includes(member.role)))
  const canReset = !isSelf && (isAdmin || (role === 'Master' && !['Admin', 'Master'].includes(member.role)) || (role === 'Elder' && member.role === 'Member'))
  const powerLockedFor = getCooldown(member)

  const save = async () => {
    if (!canManage) {
      addToast('Only Admin, Master, and Elder can use Staff Controls.', 'red', 'Not Allowed')
      return
    }
    const coins = Number.parseInt(digitsOnly(form.coins), 10)
    const power = parsePowerInput(form.power)
    if (!Number.isFinite(coins) || coins < 0 || !Number.isFinite(power) || power < 0) {
      addToast('Enter valid coin and power values.', 'red', 'Error')
      return
    }

    const updates = {}
    if (coins !== toNumber(member.coins)) updates.coins = coins
    if (form.cls !== (member.cls || 'Berserker')) updates.cls = form.cls
    if (form.grade !== gradeKeyOf(member)) updates.profile_grade = form.grade
    const level = Math.max(1, Number.parseInt(form.level, 10) || 1)
    const awakening = Math.min(1, Math.max(0, Number.parseInt(form.awakening, 10) || 0))
    if (level !== levelOf(member)) updates.character_level = level
    if (awakening !== awakeningOf(member)) updates.awakening_stage = awakening
    if (power !== toNumber(member.power)) {
      updates.power = power
      updates.power_updated_at = new Date().toISOString()
      updates.power_next_update_at = new Date(Date.now() + POWER_COOLDOWN_MS).toISOString()
    }

    if (!Object.keys(updates).length) {
      onClose()
      return
    }

    setBusy(true)
    try {
      const ok = await updateMember(member.id, updates)
      if (ok) {
        addToast(`${member.name} updated.`, 'gold', 'Member Updated')
        onClose()
      }
    } catch (error) {
      console.error('[Members] update failed:', error)
      addToast(error?.message || 'Could not save changes.', 'red', 'Update Failed')
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async newRole => {
    if (!canRole || newRole === member.role || busy) return
    if (newRole === 'Admin' || (newRole === 'Master' && !isAdmin)) {
      const ok = await ask({
        title: `Promote ${member.name} to ${newRole}?`,
        body: newRole === 'Admin'
          ? 'Admins have full control over the clan portal.'
          : 'Masters can manage members, roles and the clan economy.',
        confirmLabel: `Make ${newRole}`,
        tone: newRole === 'Admin' ? 'danger' : 'gold',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      const ok = await updateMember(member.id, { role: newRole })
      if (ok) {
        addToast(`${member.name} is now ${newRole}.`, 'gold', 'Role Updated')
        onClose()
      }
    } catch (error) {
      addToast(error?.message || 'Could not change role.', 'red', 'Role Update Failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!canRemove || busy) return
    const ok = await ask({
      title: `Remove ${member.name}?`,
      body: 'Their account will be deleted from the clan portal.',
      note: 'This cannot be undone.',
      confirmLabel: 'Remove member',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      const removed = await deleteMember(member.id)
      if (removed) {
        addToast(`${member.name} removed.`, 'red', 'Removed')
        onClose()
      }
    } catch (error) {
      addToast(error?.message || 'Could not remove member.', 'red', 'Remove Failed')
    } finally {
      setBusy(false)
    }
  }

  const roleActions = []
  if (canRole) {
    if (member.role === 'Member') roleActions.push(['Elder', '↑ Promote to Elder', 'text-orange-300'])
    if (member.role === 'Elder') {
      roleActions.push(['Member', '↓ Demote to Member', 'text-yellow-300'])
      if (isMaster) roleActions.push(['Master', '★ Promote to Master', 'text-gold-bright'])
    }
    if (member.role === 'Master' && isAdmin) roleActions.push(['Elder', '↓ Demote to Elder', 'text-orange-300'])
    if (isAdmin && member.role !== 'Admin') roleActions.push(['Admin', '⚠ Make Admin', 'text-red-300'])
    if (isAdmin && member.role === 'Admin') roleActions.push(['Master', '↓ Demote Admin', 'text-yellow-300'])
  }

  return (
    <Modal
      title={member.name}
      eyebrow={isSelf ? 'Manage My Character' : 'Staff Controls'}
      onClose={onClose}
      busy={busy}
      size="max-w-xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {canRemove ? (
            <button type="button" onClick={remove} disabled={busy} className="h-10 rounded-full px-4 text-[12px] font-bold text-red-300 hover:bg-red-500/[.1] disabled:opacity-40">
              Remove Member
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="mb-chip h-10 flex-1 rounded-full px-5 text-[13px] font-semibold text-text-bright disabled:opacity-40 sm:flex-none">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={busy} className="btn-gold h-10 flex-1 px-5 text-[13px] sm:flex-none">
              {busy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 p-4 sm:p-5">
        <section>
          <h3 className="mb-2.5 text-[12px] font-bold uppercase tracking-[.12em] text-gold-dim">Character</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class">
              <select className="input h-10 px-3 text-[13px]" value={form.cls} onChange={set('cls')} disabled={busy}>
                {CLASS_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Card Grade">
              <select className="input h-10 px-3 text-[13px]" value={form.grade} onChange={set('grade')} disabled={busy}>
                {Object.entries(GRADE_META).map(([key, g]) => <option key={key} value={key}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="Level">
              <input
                className="input h-10 px-3 font-mono text-[13px]"
                inputMode="numeric"
                value={form.level}
                onChange={e => setForm(f => ({ ...f, level: digitsOnly(e.target.value).slice(0, 4) }))}
                disabled={busy}
              />
            </Field>
            <Field label="Awakening">
              <select className="input h-10 px-3 text-[13px]" value={form.awakening} onChange={set('awakening')} disabled={busy}>
                {AWAKENING_OPTIONS.map(o => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-2.5 text-[12px] font-bold uppercase tracking-[.12em] text-gold-dim">Power & Coins</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="⚡ Growth Power" hint="Exact in-game value. 100000 shows as 100.000.">
              <input
                className="input h-10 px-3 font-mono text-[14px] font-bold"
                inputMode="numeric"
                value={form.power}
                onChange={e => setForm(f => ({ ...f, power: formatPowerInput(e.target.value) }))}
                disabled={busy}
                placeholder="100.000"
              />
            </Field>
            <Field label="🪙 Coins">
              <input
                className="input h-10 px-3 font-mono text-[14px] font-bold"
                inputMode="numeric"
                value={form.coins}
                onChange={e => setForm(f => ({ ...f, coins: digitsOnly(e.target.value) }))}
                disabled={busy || !canManage}
              />
            </Field>
          </div>
        </section>

        {(roleActions.length > 0 || canReset || !isSelf) && (
          <section className="mb-inset rounded-2xl p-3.5">
            <h3 className="mb-2.5 text-[12px] font-bold uppercase tracking-[.12em] text-text-dim">Role & Access</h3>
            <div className="flex flex-wrap gap-2">
              {roleActions.map(([target, label, tone]) => (
                <button key={label} type="button" onClick={() => changeRole(target)} disabled={busy} className={`mb-chip rounded-full px-3.5 py-2 text-[12px] font-bold ${tone} disabled:opacity-40`}>
                  {label}
                </button>
              ))}
              {canReset && (
                <button type="button" onClick={() => { onClose(); onResetPassword(member) }} disabled={busy} className="mb-chip mb-chip-gold rounded-full px-3.5 py-2 text-[12px] font-bold text-gold-light disabled:opacity-40">
                  🔑 Reset Password
                </button>
              )}
              {!isSelf && (
                <button type="button" onClick={() => onResetPowerWindow(member)} disabled={busy} className="mb-chip rounded-full px-3.5 py-2 text-[12px] font-bold text-text-bright disabled:opacity-40">
                  ↻ Reset Power Window
                </button>
              )}
            </div>
            {!isSelf && powerLockedFor > 0 && (
              <p className="mt-2 text-[11px] text-text-dim">Power window currently locked until {formatDate(member.power_next_update_at)}.</p>
            )}
          </section>
        )}
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Add member
   ═══════════════════════════════════════════════════════════════════════════ */

function AddMemberModal({ isMaster, isAdmin, busy, onSubmit, onClose }) {
  const [form, setForm] = useState(EMPTY_NEW_MEMBER)
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <Modal
      title="Add New Character"
      eyebrow="Clan Administration"
      onClose={onClose}
      busy={busy}
      size="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="mb-chip h-10 rounded-full px-5 text-[13px] font-semibold text-text-bright disabled:opacity-40">Cancel</button>
          <button type="button" onClick={() => onSubmit(form)} disabled={busy} className="btn-gold h-10 px-5 text-[13px]">
            {busy ? 'Adding…' : 'Add Character'}
          </button>
        </div>
      }
    >
      <form
        className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5"
        onSubmit={e => { e.preventDefault(); if (!busy) onSubmit(form) }}
      >
        <Field label="Character Name">
          <input className="input h-10 px-3 text-[13px]" value={form.name} onChange={set('name')} disabled={busy} autoComplete="off" />
        </Field>
        <Field label="Username">
          <input className="input h-10 px-3 text-[13px]" value={form.username} onChange={set('username')} disabled={busy} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label="Password">
          <input className="input h-10 px-3 text-[13px]" type="password" value={form.password} onChange={set('password')} disabled={busy} autoComplete="new-password" />
        </Field>
        <Field label="Role">
          <select className="input h-10 px-3 text-[13px]" value={form.role} onChange={set('role')} disabled={busy}>
            <option value="Member">Member</option>
            {isMaster && <option value="Elder">Elder</option>}
            {isMaster && <option value="Master">Master</option>}
            {isAdmin && <option value="Admin">Admin (hidden)</option>}
          </select>
        </Field>
        <Field label="Class">
          <select className="input h-10 px-3 text-[13px]" value={form.cls} onChange={set('cls')} disabled={busy}>
            {CLASS_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Card Grade">
          <select className="input h-10 px-3 text-[13px]" value={form.profile_grade} onChange={set('profile_grade')} disabled={busy}>
            {Object.entries(GRADE_META).map(([key, g]) => <option key={key} value={key}>{g.label}</option>)}
          </select>
        </Field>
        <Field label="Growth Power">
          <input
            className="input h-10 px-3 font-mono text-[13px]"
            inputMode="numeric"
            value={form.power}
            onChange={e => setForm(f => ({ ...f, power: formatPowerInput(e.target.value) }))}
            disabled={busy}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Level">
            <input
              className="input h-10 px-3 font-mono text-[13px]"
              inputMode="numeric"
              value={form.character_level}
              onChange={e => setForm(f => ({ ...f, character_level: digitsOnly(e.target.value).slice(0, 4) }))}
              disabled={busy}
            />
          </Field>
          <Field label="Awakening">
            <select className="input h-10 px-3 text-[13px]" value={String(form.awakening_stage)} onChange={e => setForm(f => ({ ...f, awakening_stage: Number(e.target.value) }))} disabled={busy}>
              {AWAKENING_OPTIONS.map(o => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        {/* lets Enter submit the form */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Members({ ctx }) {
  const {
    members = [], allMembers: ctxAllMembers = [], saveMember,
    resetMemberPowerCooldown, currentUser, addToast,
  } = ctx

  const [ask, confirmDialog] = useConfirm()
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('All')
  const deferredSearch = useDeferredValue(search)
  const [shownCount, setShownCount] = useState(CARD_BATCH)
  const searchRef = useRef(null)
  const sentinelRef = useRef(null)
  const [sortBy, setSortBy] = useState('power')
  const [viewingId, setViewingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showRanking, setShowRanking] = useState(false)
  const [showStaffPanel, setShowStaffPanel] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [adding, setAdding] = useState(false)
  const [coinBusy, setCoinBusy] = useState(false)

  const role = currentUser?.role
  const isAdmin = role === 'Admin'
  const isMaster = isAdmin || role === 'Master'
  const isElder = isMaster || role === 'Elder'

  const visibleMembers = useMemo(
    () => (isAdmin ? members : members.filter(m => m.role !== 'Admin')),
    [members, isAdmin]
  )
  const ranked = useMemo(
    () => [...visibleMembers].sort((a, b) => toNumber(b.power) - toNumber(a.power)),
    [visibleMembers]
  )
  const rankMap = useMemo(() => new Map(ranked.map((m, i) => [String(m.id), i + 1])), [ranked])

  const classes = useMemo(
    () => ['All', ...new Set(visibleMembers.map(m => m.cls).filter(Boolean))],
    [visibleMembers]
  )

  // Number of members per class, for the filter chips.
  const classCounts = useMemo(() => {
    const counts = new Map()
    for (const m of visibleMembers) if (m.cls) counts.set(m.cls, (counts.get(m.cls) || 0) + 1)
    return counts
  }, [visibleMembers])

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    const list = visibleMembers.filter(m =>
      (!q || `${m.name || ''} ${m.username || ''} ${m.cls || ''}`.toLowerCase().includes(q)) &&
      (classFilter === 'All' || m.cls === classFilter)
    )
    return list.sort((a, b) => {
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''))
      if (sortBy === 'role') return String(a.role || '').localeCompare(String(b.role || ''))
      return toNumber(b.power) - toNumber(a.power)
    })
  }, [visibleMembers, deferredSearch, classFilter, sortBy])

  // Start from the first batch whenever the filters change.
  useEffect(() => { setShownCount(CARD_BATCH) }, [deferredSearch, classFilter, sortBy])
  const shownMembers = useMemo(() => filtered.slice(0, shownCount), [filtered, shownCount])
  const hasMore = shownCount < filtered.length

  // Load the next batch shortly before the end of the grid scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setShownCount(c => c + CARD_BATCH)
    }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, shownMembers.length])

  // Press "/" anywhere on the page to jump to the search box.
  useEffect(() => {
    const onKey = e => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const isFiltering = search.trim() !== '' || classFilter !== 'All'
  const clearFilters = useCallback(() => { setSearch(''); setClassFilter('All') }, [])

  const ownMember = useMemo(
    () => members.find(m => sameId(m.id, currentUser?.id)) ||
      visibleMembers.find(m => m.username && m.username === currentUser?.username),
    [members, visibleMembers, currentUser?.id, currentUser?.username]
  )

  // Look modals up by id so they always show the latest member data after a save.
  const allList = allRows(ctxAllMembers, members)
  const viewing = viewingId != null ? allList.find(m => sameId(m.id, viewingId)) : null
  const editing = editingId != null ? allList.find(m => sameId(m.id, editingId)) : null

  // Close a modal whose member no longer exists (e.g. removed).
  useEffect(() => {
    if (viewingId != null && !viewing) setViewingId(null)
    if (editingId != null && !editing) setEditingId(null)
  }, [viewingId, viewing, editingId, editing])

  const openProfile = useCallback(member => {
    setShowRanking(false)
    setViewingId(member.id)
  }, [])

  const browseProfile = useCallback(member => setViewingId(member.id), [])

  const openEditor = useCallback(member => {
    setViewingId(null)
    setShowStaffPanel(false)
    setEditingId(member.id)
  }, [])

  /* ── Coin economy ─────────────────────────────────────────────────────── */

  // Runs one update per member and reports partial failures instead of
  // stopping silently halfway. Always reloads so the page shows the truth.
  const updateCoinsFor = async (rows, coinsFor) => {
    const results = await Promise.allSettled(
      rows.map(m => ctx.supabase.from('members').update({ coins: coinsFor(m) }).eq('id', m.id))
    )
    const failed = results.filter(r => r.status === 'rejected' || r.value?.error)
    await ctx.reloadMembers?.()
    return { failed: failed.length, firstError: failed[0]?.reason || failed[0]?.value?.error }
  }

  const handleCoinDecay = async selectedIds => {
    if (!isElder) {
      addToast('Only Admin, Master, and Elder can use coin controls.', 'red', 'Not Allowed')
      return false
    }
    const keys = new Set(selectedIds.map(String))
    const targets = allRows(ctxAllMembers, members).filter(m => keys.has(String(m.id)))
    if (!targets.length) {
      addToast('Select at least one member for coin decay.', 'red', 'No Members Selected')
      return false
    }

    const ok = await ask({
      title: 'Apply 25% coin decay?',
      body: `${targets.length} member${targets.length === 1 ? '' : 's'} will keep 75% of their current coins.`,
      details: [
        ...targets.slice(0, 8).map(m => `${m.name}: ${formatNumber(m.coins)} → ${formatNumber(Math.floor(Math.max(0, toNumber(m.coins)) * 0.75))}`),
        ...(targets.length > 8 ? [`+${targets.length - 8} more`] : []),
      ],
      note: 'Balances change immediately.',
      confirmLabel: 'Apply decay',
      tone: 'danger',
    })
    if (!ok) return false

    setCoinBusy(true)
    try {
      const { failed, firstError } = await updateCoinsFor(targets, m => Math.floor(Math.max(0, toNumber(m.coins)) * 0.75))
      if (failed) {
        console.error('[Coin Decay] failed rows:', firstError)
        addToast(`${targets.length - failed} updated, ${failed} failed. ${firstError?.message || ''}`.trim(), 'red', 'Coin Decay Incomplete')
        return false
      }
      addToast(`25% coin decay applied to ${targets.length} member${targets.length === 1 ? '' : 's'}.`, 'gold', 'Coin Decay Applied')
      return true
    } catch (error) {
      console.error('[Coin Decay] failed:', error)
      addToast(error?.message || 'Failed to apply coin decay.', 'red', 'Coin Decay Failed')
      return false
    } finally {
      setCoinBusy(false)
    }
  }

  const handleCoinReset = async () => {
    if (!isElder) {
      addToast('Only Admin, Master, and Elder can use coin controls.', 'red', 'Not Allowed')
      return
    }
    const targets = allRows(ctxAllMembers, members)
    if (!targets.length) {
      addToast('No members were found.', 'red', 'Coin Reset Failed')
      return
    }

    const ok = await ask({
      title: "Reset everyone's coins to 0?",
      body: `All ${targets.length} members, including Admin, Master and Elder, will have 0 coins.`,
      note: 'There is no undo or backup for this.',
      confirmLabel: 'Reset all coins',
      tone: 'danger',
      requireText: 'RESET',
    })
    if (!ok) {
      addToast('Coin reset cancelled. Nothing was changed.', 'blue', 'Reset Cancelled')
      return
    }

    setCoinBusy(true)
    try {
      const { failed, firstError } = await updateCoinsFor(targets, () => 0)
      if (failed) {
        console.error('[Coin Reset] failed rows:', firstError)
        addToast(`${targets.length - failed} reset, ${failed} failed. ${firstError?.message || ''}`.trim(), 'red', 'Coin Reset Incomplete')
        return
      }
      addToast(`All coins were reset to 0 for ${targets.length} members.`, 'red', 'Coins Reset')
    } catch (error) {
      console.error('[Coin Reset] failed:', error)
      addToast(error?.message || 'Failed to reset all coins.', 'red', 'Coin Reset Failed')
    } finally {
      setCoinBusy(false)
    }
  }

  /* ── Power window reset ───────────────────────────────────────────────── */

  const handlePowerWindowReset = async member => {
    if (!isElder) {
      addToast('Only Admin, Master, and Elder can reset a Power window.', 'red', 'Not Allowed')
      return
    }
    const ok = await ask({
      title: `Reset ${member.name}'s Power window?`,
      body: `${member.name} gets 3 fresh Power updates immediately.`,
      confirmLabel: 'Reset window',
    })
    if (!ok) return
    try {
      const done = await resetMemberPowerCooldown?.(member.id)
      if (done) addToast(`${member.name} can now update Power 3 times.`, 'gold', 'Power Window Reset')
    } catch (error) {
      addToast(error?.message || 'Could not reset the Power window.', 'red', 'Reset Failed')
    }
  }

  /* ── Add member ───────────────────────────────────────────────────────── */

  const addMember = async form => {
    const name = form.name.trim()
    const username = form.username.trim()
    const password = form.password.trim()
    if (!name) { addToast('Character name is required.', 'red', 'Error'); return }
    if (!username) { addToast('Username is required.', 'red', 'Error'); return }
    if (!password) { addToast('Password is required.', 'red', 'Error'); return }

    // Check every account (hidden Admin accounts included) so usernames stay unique.
    const taken = allRows(ctxAllMembers, members)
      .some(m => m.username && m.username.toLowerCase() === username.toLowerCase())
    if (taken) { addToast('Username already taken.', 'red', 'Error'); return }

    let finalRole = 'Member'
    if (isAdmin) finalRole = form.role
    else if (isMaster && ['Elder', 'Master'].includes(form.role)) finalRole = form.role
    else if (form.role !== 'Member') {
      addToast('Only Master or Admin can add Elders or Masters.', 'red', 'Not Allowed')
      return
    }

    if (finalRole === 'Admin' || (finalRole === 'Master' && !isAdmin)) {
      const ok = await ask({
        title: `Create ${name} as ${finalRole === 'Admin' ? 'an Admin' : 'a Master'}?`,
        confirmLabel: `Create ${finalRole}`,
        tone: finalRole === 'Admin' ? 'danger' : 'gold',
      })
      if (!ok) return
    }

    const power = parsePowerInput(form.power)
    const member = {
      id: Date.now(),
      name,
      username,
      password,
      cls: form.cls,
      power: Number.isFinite(power) ? power : 10000,
      character_level: Math.max(1, Number.parseInt(form.character_level, 10) || 1),
      awakening_stage: Math.min(1, Math.max(0, toNumber(form.awakening_stage))),
      coins: 100,
      attendance: 0,
      role: finalRole,
      region: PROFILE_REGION,
      server: PROFILE_SERVER,
      profile_grade: form.profile_grade || 'Legendary',
    }

    setAdding(true)
    try {
      const saved = await saveMember(member)
      if (saved) {
        addToast(`${member.name} added as ${finalRole}!`, 'gold', 'Member Added')
        setShowAdd(false)
      }
    } catch (error) {
      console.error('[Members] add failed:', error)
      addToast(error?.message || 'Could not add member.', 'red', 'Add Failed')
    } finally {
      setAdding(false)
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  const ownRank = ownMember ? rankMap.get(String(ownMember.id)) : null

  return (
    <div className="mb-root min-w-0 space-y-4">
      <style>{MB_STYLES}</style>
      {confirmDialog}

      {/* Header */}
      <header className="mb-glass rounded-[22px] px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_8px_rgba(242,204,96,.7)]" aria-hidden="true" />
              Clan Character Index
            </div>
            <h1 className="mt-1 font-spectral text-[2rem] font-bold leading-none text-text-bright sm:text-[2.3rem]">Members</h1>
            <p className="mt-1.5 text-[13px] text-text-dim">
              {visibleMembers.length} warriors · Region {PROFILE_REGION} · Server {PROFILE_SERVER}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowRanking(true)} className="mb-chip mb-chip-gold h-10 rounded-full px-4 text-[12px] font-bold text-gold-light">
              ⚡ Power Ranking
            </button>
            {isElder && (
              <>
                <button type="button" onClick={() => setShowStaffPanel(true)} className="mb-chip h-10 rounded-full px-4 text-[12px] font-bold text-text-bright">
                  ⚙ Staff Controls
                </button>
                <button type="button" onClick={() => setShowAdd(true)} className="btn-gold h-10 px-4 text-[12px]">
                  + Add Member
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Your character */}
      {ownMember && (
        <button
          type="button"
          onClick={() => openProfile(ownMember)}
          className="mb-glass mb-lift flex w-full items-center gap-3.5 rounded-[20px] px-4 py-3 text-left sm:px-5"
          style={{ '--mb-rim': `${gradeOf(ownMember).color}80` }}
        >
          <span className="mb-emblem flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-spectral text-[15px] font-bold text-gold-light">
            {initials(ownMember.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[.12em] text-gold-dim">Your Character</span>
            <span className="block truncate text-[15px] font-semibold text-text-bright">
              {ownMember.name} <span className="text-text-dim">· {ownMember.cls || 'Berserker'} · Lv. {levelOf(ownMember)}</span>
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-mono text-[15px] font-bold text-gold-bright">{formatNumber(ownMember.power)}</span>
            <span className="block text-[12px] text-text-dim">Rank #{ownRank || '—'}</span>
          </span>
        </button>
      )}

      {/* Filters */}
      <div className="mb-glass mb-solid space-y-2.5 rounded-[18px] p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              type="search"
              className="input h-10 pl-9 pr-16 text-[13px]"
              placeholder="Search name, username or class…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch('') } }}
              aria-label="Search members"
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                onClick={() => { setSearch(''); searchRef.current?.focus() }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[16px] text-text-dim hover:bg-white/10 hover:text-text-bright"
              >
                ×
              </button>
            ) : (
              <span className="mb-kbd pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded px-1.5 font-mono text-[11px] text-text-dim sm:block" aria-hidden="true">/</span>
            )}
          </div>

          <div className="mb-seg flex shrink-0 items-center gap-0.5 rounded-full p-1" role="group" aria-label="Sort members by">
            <span className="px-2 text-[11px] font-bold uppercase tracking-[.1em] text-text-dim">Sort</span>
            {SORT_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setSortBy(o.value)}
                aria-pressed={sortBy === o.value}
                className="h-8 rounded-full px-3.5 text-[12px] font-semibold text-text-dim transition-colors hover:text-text-bright"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Filter by class">
          {classes.map(c => {
            const count = c === 'All' ? visibleMembers.length : (classCounts.get(c) || 0)
            const icon = c === 'All' ? '◇' : (CLASS_META[c]?.icon || '•')
            return (
              <button
                key={c}
                type="button"
                onClick={() => setClassFilter(c)}
                aria-pressed={classFilter === c}
                className="mb-pill flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold"
              >
                <span aria-hidden="true">{icon}</span>
                {c === 'All' ? 'All' : c}
                <span className="font-mono text-[11px] opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-spectral text-[1.3rem] font-bold text-text-bright">
          {filtered.length} {filtered.length === 1 ? 'Character' : 'Characters'}
          {isFiltering && <span className="ml-2 font-sans text-[12px] font-normal text-text-dim">of {visibleMembers.length}</span>}
        </h2>
        {isFiltering && (
          <button type="button" onClick={clearFilters} className="mb-chip h-8 rounded-full px-3 text-[12px] font-semibold text-gold-light">
            Clear filters ×
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="mb-glass mb-solid rounded-[20px] px-4 py-14 text-center">
          <div className="text-[15px] font-semibold text-text-bright">No members found</div>
          <div className="mt-1 text-[13px] text-text-dim">
            {search.trim() ? <>Nothing matches “{search.trim()}”{classFilter !== 'All' ? ` in ${classFilter}` : ''}.</> : 'Try a different class.'}
          </div>
          <button type="button" onClick={clearFilters} className="mb-chip mt-4 h-9 rounded-full px-4 text-[12px] font-semibold text-gold-light">
            Show all members
          </button>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {shownMembers.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              rank={rankMap.get(String(member.id))}
              isSelf={sameId(member.id, currentUser?.id)}
              onOpen={openProfile}
            />
          ))}
        </div>
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setShownCount(c => c + CARD_BATCH)}
              className="mb-chip h-10 rounded-full px-5 text-[12px] font-semibold text-text-bright"
            >
              Show more · {filtered.length - shownCount} left
            </button>
          </div>
        )}
        </>
      )}

      {/* Modals */}
      {viewing && (
        <ProfileModal
          member={viewing}
          ranked={ranked}
          list={filtered}
          isSelf={sameId(viewing.id, currentUser?.id)}
          canManage={isElder}
          onManage={openEditor}
          onNavigate={browseProfile}
          onClose={() => setViewingId(null)}
        />
      )}

      {showRanking && (
        <RankingModal ranked={ranked} currentUserId={currentUser?.id} onOpen={openProfile} onClose={() => setShowRanking(false)} />
      )}

      {showStaffPanel && isElder && (
        <StaffPanel
          members={visibleMembers}
          currentUserId={currentUser?.id}
          busy={coinBusy}
          onManage={openEditor}
          onCoinDecay={handleCoinDecay}
          onCoinReset={handleCoinReset}
          onClose={() => setShowStaffPanel(false)}
        />
      )}

      {editing && isElder && (
        <StaffEditor
          key={editing.id}
          member={editing}
          ctx={ctx}
          ask={ask}
          onClose={() => setEditingId(null)}
          onResetPassword={setResetTarget}
          onResetPowerWindow={handlePowerWindowReset}
        />
      )}

      {showAdd && isElder && (
        <AddMemberModal
          isMaster={isMaster}
          isAdmin={isAdmin}
          busy={adding}
          onSubmit={addMember}
          onClose={() => setShowAdd(false)}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          ctx={ctx}
          member={resetTarget}
          target={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  )
}