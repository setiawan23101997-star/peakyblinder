import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'

/* ─────────────────────────────────────────────────────────────────────
   PeakyBlinder · Event Calendar
   Server time (GMT+8) is authoritative; every player also sees their
   own local time automatically.
   ───────────────────────────────────────────────────────────────────── */

const WEEKLY_SCHEDULE = {
  1: [
    { time: '22:00', type: 'boss', name: 'Canyon of Nidavellir 1F', boss: 'Nargrim' },
    { time: '22:10', type: 'boss', name: 'Folkvang 5F · Inter-Server', boss: 'Twilight Disaster Nirva' },
  ],
  2: [
    { time: '20:00', type: 'battle', name: 'Server Battle', subtitle: 'Lv 40+ · Top 500 Growth Power' },
  ],
  3: [
    { time: '22:00', type: 'boss', name: 'Canyon of the World Tree', boss: 'Twilight Overlord Rogvalt' },
    { time: '22:10', type: 'boss', name: 'Crossroads of Ragnarok', boss: 'Faded Oath Vargreif' },
  ],
  4: [
    { time: '13:00', type: 'battle', name: 'Clan Annihilation', subtitle: '13:00 – 14:00' },
    { time: '19:00', type: 'boss', name: 'Myrkrheim', boss: 'Wrath of the Earth Bergbernd' },
    { time: '20:00', type: 'battle', name: 'Clan Annihilation', subtitle: '20:00 – 21:00' },
  ],
  5: [
    { time: '22:00', type: 'boss', name: 'Folkvang 5F · Inter-Server', boss: 'Twilight Disaster Nirva' },
    { time: '22:10', type: 'boss', name: 'Crossroads of Ragnarok', boss: 'Faded Oath Vargreif' },
  ],
  6: [
    { time: '13:00', type: 'treasure', name: "Sindri's Treasure Island", subtitle: '13:00 – 14:00' },
    { time: '19:00', type: 'boss', name: 'Glasir Forest', boss: 'Divine Beast of Void Ulnos' },
    { time: '20:00', type: 'treasure', name: "Sindri's Treasure Island", subtitle: '20:00 – 21:00' },
    { time: '21:00', type: 'battle', name: 'Clan Sanctuary', subtitle: '21:00 – 22:00' },
  ],
  0: [
    { time: '20:00', type: 'arena', name: 'Clan Arena Tournament', subtitle: 'See Announcement' },
    { time: '22:00', type: 'boss', name: 'Canyon of the World Tree', boss: 'Twilight Overlord Rogvalt' },
    { time: '22:10', type: 'boss', name: 'Canyon of Nidavellir 1F', boss: 'Nargrim' },
  ],
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

const SERVER_TZ = 'Asia/Singapore'
const SERVER_TZ_LABEL = 'GMT+8'
// Asia/Singapore has no daylight saving, so server wall-time maths can use a
// fixed offset. This is exact and far cheaper than searching with Intl.
const SERVER_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
const SOON_MS = 60 * 60 * 1000
// Events without an explicit "HH:MM – HH:MM" window count as in progress for this long.
const DEFAULT_RUN_MIN = { boss: 15, battle: 60, treasure: 60, arena: 60 }

const AUTO_LOCAL_TZ = (() => {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'
  } catch {
    return 'Local'
  }
})()

const TYPE = {
  boss:     { color: '#f87171', icon: '👾', label: 'World Boss' },
  battle:   { color: '#60a5fa', icon: '⚔️', label: 'Server Battle' },
  treasure: { color: '#facc15', icon: '🏝️', label: 'Sindri Island' },
  arena:    { color: '#c084fc', icon: '🏟️', label: 'Arena' },
}
const TYPE_KEYS = Object.keys(TYPE)

function TypeIcon({ type, size = 18 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  }
  switch (type) {
    case 'boss': // horned skull
      return (
        <svg {...common}>
          <path d="M4 4l3 4M20 4l-3 4" />
          <path d="M12 6c-4 0-6.5 2.6-6.5 6.2 0 2.1 1 3.6 2.5 4.5V19h8v-2.3c1.5-.9 2.5-2.4 2.5-4.5C18.5 8.6 16 6 12 6z" />
          <circle cx="9.5" cy="12.5" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="12.5" r="1.3" fill="currentColor" stroke="none" />
          <path d="M11 19v-1.5M13 19v-1.5" />
        </svg>
      )
    case 'battle': // crossed swords
      return (
        <svg {...common}>
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
          <path d="M13 19l6-6M16 16l4 4M19 21l2-2" />
          <path d="M9.5 6.5L21 3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2" />
        </svg>
      )
    case 'treasure': // chest
      return (
        <svg {...common}>
          <path d="M4 10a8 5 0 0 1 16 0" />
          <rect x="4" y="10" width="16" height="9" rx="1.5" />
          <path d="M4 13h16" />
          <rect x="10.5" y="11.5" width="3" height="3.5" rx=".6" />
        </svg>
      )
    case 'arena': // trophy
    default:
      return (
        <svg {...common}>
          <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
          <path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3" />
          <path d="M12 13v4M9 20h6M10 17h4" />
        </svg>
      )
  }
}

const PREF_KEY = 'pb-calendar-time-pref'

/* ── Time helpers ──────────────────────────────────────────────────── */

const _dtfCache = new Map()
function getDTF(locale, opts) {
  const key = locale + '|' + JSON.stringify(opts)
  let dtf = _dtfCache.get(key)
  if (!dtf) {
    dtf = new Intl.DateTimeFormat(locale, opts)
    _dtfCache.set(key, dtf)
  }
  return dtf
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

// Server-day facts for a timestamp.
function serverDay(ts) {
  const d = new Date(ts + SERVER_OFFSET_MS)
  return {
    dow: d.getUTCDay(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    startUtc: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - SERVER_OFFSET_MS,
    hh: d.getUTCHours(),
    mm: d.getUTCMinutes(),
    ss: d.getUTCSeconds(),
  }
}

// Start time of an event in the current server week (may already be past).
function occurrenceThisWeek(dow, hhmm, now) {
  const today = serverDay(now)
  const delta = (dow - today.dow + 7) % 7
  return today.startUtc + delta * DAY_MS + toMinutes(hhmm) * 60 * 1000
}

function runLengthMin(event) {
  const m = String(event.subtitle || '').match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/)
  if (m) {
    const diff = toMinutes(m[2]) - toMinutes(m[1])
    if (diff > 0) return { minutes: diff, explicit: true }
  }
  return { minutes: DEFAULT_RUN_MIN[event.type] || 30, explicit: false }
}

/**
 * Where an event stands right now.
 * status: 'live' | 'started' | 'soon' | 'upcoming' | 'done'
 * nextTs: the next time it starts (next week if it already ran this week).
 */
function eventState(event, dow, now) {
  const start = occurrenceThisWeek(dow, event.time, now)
  const run = runLengthMin(event)
  const end = start + run.minutes * 60 * 1000
  if (now >= start && now < end) {
    return { status: run.explicit ? 'live' : 'started', startTs: start, endTs: end, nextTs: start + WEEK_MS }
  }
  if (now >= end) return { status: 'done', startTs: start, endTs: end, nextTs: start + WEEK_MS }
  return { status: start - now <= SOON_MS ? 'soon' : 'upcoming', startTs: start, endTs: end, nextTs: start }
}

function formatLocal(ts) {
  const date = new Date(ts)
  return {
    time: getDTF('en-US', { timeZone: AUTO_LOCAL_TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(date),
    day: getDTF('en-GB', { timeZone: AUTO_LOCAL_TZ, weekday: 'short' }).format(date),
    dateLong: getDTF('en-GB', { timeZone: AUTO_LOCAL_TZ, weekday: 'long', day: 'numeric', month: 'short' }).format(date),
  }
}

function formatServerClock(ts) {
  const date = new Date(ts)
  return {
    time: getDTF('en-US', { timeZone: SERVER_TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(date),
    date: getDTF('en-GB', { timeZone: SERVER_TZ, weekday: 'short', day: '2-digit', month: 'short' }).format(date),
  }
}

const LOCAL_ZONE_LABEL = (() => {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: AUTO_LOCAL_TZ,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value || AUTO_LOCAL_TZ
  } catch {
    return AUTO_LOCAL_TZ
  }
})()

// True when the player's clock already matches server time.
const LOCAL_IS_SERVER = (() => {
  try {
    const probe = Date.UTC(2026, 0, 15, 12)
    const a = getDTF('en-GB', { timeZone: SERVER_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(probe)
    const b = getDTF('en-GB', { timeZone: AUTO_LOCAL_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(probe)
    return a === b
  } catch {
    return false
  }
})()

function formatCountdown(ms) {
  if (ms <= 0) return 'Now'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function readPref() {
  try { return localStorage.getItem(PREF_KEY) === 'server' ? 'server' : 'local' } catch { return 'local' }
}
function writePref(value) {
  try { localStorage.setItem(PREF_KEY, value) } catch { /* storage unavailable */ }
}

/* ── Static schedule ───────────────────────────────────────────────── */

const SCHEDULE_BY_DAY = (() => {
  const out = {}
  for (const dow of DAY_ORDER) {
    out[dow] = [...(WEEKLY_SCHEDULE[dow] || [])]
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((event, i) => ({ ...event, dow, key: `${dow}-${event.time}-${i}` }))
  }
  return out
})()

const ALL_EVENTS = DAY_ORDER.flatMap(dow => SCHEDULE_BY_DAY[dow])

/* ── Styles (scoped to .ec-root) ───────────────────────────────────── */

const EC_STYLES = `
  .ec-root { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  .ec-root .text-text-dim { color: #c9bda8; }
  /* Numbers use the page's own font with equal-width digits, instead of the
     system typewriter font, so clocks and countdowns look clean and don't jiggle. */
  .ec-root .font-mono {
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
    letter-spacing: -0.01em;
  }

  .ec-root .ec-glass {
    position: relative;
    background:
      radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,.08) 0%, transparent 50%),
      linear-gradient(160deg, rgba(34,28,22,.58) 0%, rgba(12,10,8,.66) 100%);
    backdrop-filter: blur(20px) saturate(155%);
    -webkit-backdrop-filter: blur(20px) saturate(155%);
    border: 1px solid rgba(255,255,255,.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 22px 60px -30px rgba(0,0,0,.85);
  }
  .ec-root .ec-glass::before {
    content: '';
    position: absolute;
    inset: 0;
    padding: 1px;
    border-radius: inherit;
    background: linear-gradient(140deg,
      rgba(255,255,255,.36) 0%,
      rgba(255,255,255,.04) 35%,
      var(--ec-rim, rgba(201,162,75,.26)) 70%,
      rgba(255,255,255,.1) 100%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
  /* Same look without live blur, for lists */
  .ec-root .ec-glass.ec-solid {
    background:
      radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,.06) 0%, transparent 50%),
      linear-gradient(160deg, rgba(30,25,20,.94) 0%, rgba(13,11,9,.96) 100%);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .ec-root .ec-inset {
    background: linear-gradient(180deg, rgba(255,255,255,.05) 0%, rgba(255,255,255,.018) 100%);
    border: 1px solid rgba(255,255,255,.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.07);
  }
  .ec-root .ec-well {
    background: rgba(0,0,0,.24);
    border: 1px solid rgba(255,255,255,.07);
    box-shadow: inset 0 2px 6px rgba(0,0,0,.32), 0 1px 0 rgba(255,255,255,.04);
  }
  .ec-root .ec-chip {
    background: linear-gradient(180deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.025) 100%);
    border: 1px solid rgba(255,255,255,.1);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14);
    transition: background .15s ease, border-color .15s ease, color .15s ease;
  }
  .ec-root button.ec-chip:hover:not(:disabled) {
    background: linear-gradient(180deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.04) 100%);
    border-color: rgba(235,208,141,.3);
  }

  /* Filter pills */
  .ec-root .ec-pill {
    border: 1px solid rgba(255,255,255,.1);
    background: rgba(255,255,255,.04);
    color: #c9bda8;
    transition: background .15s ease, border-color .15s ease, color .15s ease;
  }
  .ec-root .ec-pill:hover { color: #f4ebd9; border-color: rgba(255,255,255,.2); }
  .ec-root .ec-pill[aria-pressed="true"] {
    color: #f4ebd9;
    border-color: var(--ec-accent, rgba(235,208,141,.45));
    background: color-mix(in srgb, var(--ec-accent, #c9a24b) 16%, transparent);
  }

  /* Segmented control */
  .ec-root .ec-seg { background: rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.08); }
  .ec-root .ec-seg button[aria-pressed="true"] {
    background: linear-gradient(180deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.05) 100%);
    color: #f4ebd9;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.2);
  }

  /* Day tabs */
  .ec-root .ec-day { transition: background .15s ease, color .15s ease, border-color .15s ease; border: 1px solid transparent; }
  .ec-root .ec-day:hover { background: rgba(255,255,255,.04); }
  .ec-root .ec-day[aria-selected="true"] {
    background:
      radial-gradient(90% 70% at 50% 0%, rgba(255,255,255,.2) 0%, transparent 70%),
      linear-gradient(180deg, rgba(201,162,75,.2) 0%, rgba(201,162,75,.06) 100%);
    border-color: rgba(235,208,141,.4);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.22);
  }

  /* Event rows */
  .ec-root .ec-row { transition: border-color .2s ease, background .2s ease, transform .2s ease; }
  .ec-root .ec-row:hover { border-color: rgba(255,255,255,.15); }
  .ec-root .ec-row.is-flash { animation: ec-flash 1.4s ease-out 1; }
  @keyframes ec-flash {
    0%   { box-shadow: 0 0 0 0 rgba(242,204,96,.0); border-color: rgba(242,204,96,.8); }
    30%  { box-shadow: 0 0 0 4px rgba(242,204,96,.25); }
    100% { box-shadow: 0 0 0 0 rgba(242,204,96,0); }
  }

  .ec-root .ec-live-dot { animation: ec-pulse 1.6s ease-in-out infinite; }
  @keyframes ec-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }

  .ec-root button:focus-visible { outline: 2px solid rgba(235,208,141,.75); outline-offset: 2px; }

  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .ec-root .ec-glass { background: rgba(16,13,11,.97); }
  }
  @supports not (background: color-mix(in srgb, red 50%, blue)) {
    .ec-root .ec-pill[aria-pressed="true"] { background: rgba(201,162,75,.16); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ec-root .ec-live-dot, .ec-root .ec-row.is-flash { animation: none; }
    .ec-root .ec-row { transition: none; }
  }
`

/* ── Page ──────────────────────────────────────────────────────────── */

function EventCalendar({ setPage }) {
  const now = useNow(1000)
  const today = serverDay(now)
  const todayDow = today.dow

  const [selectedDay, setSelectedDay] = useState(todayDow)
  const [typeFilter, setTypeFilter] = useState('all')
  const [timePref, setTimePref] = useState(readPref)
  const [flashKey, setFlashKey] = useState(null)
  const listRef = useRef(null)

  // Follow the server day over midnight, unless the player picked another day.
  const followTodayRef = useRef(true)
  useEffect(() => {
    if (followTodayRef.current) setSelectedDay(todayDow)
  }, [todayDow])

  const selectDay = useCallback(dow => {
    followTodayRef.current = false
    setSelectedDay(dow)
  }, [])

  const changeTimePref = useCallback(value => {
    setTimePref(value)
    writePref(value)
  }, [])

  const matchesType = useCallback(e => typeFilter === 'all' || e.type === typeFilter, [typeFilter])

  // Every event with its live state.
  const states = useMemo(() => {
    const map = new Map()
    for (const event of ALL_EVENTS) map.set(event.key, eventState(event, event.dow, now))
    return map
  }, [now])

  const upcoming = useMemo(() => (
    ALL_EVENTS
      .filter(matchesType)
      .map(event => ({ event, state: states.get(event.key) }))
      .sort((a, b) => {
        const ra = a.state.status === 'live' || a.state.status === 'started' ? a.state.startTs : a.state.nextTs
        const rb = b.state.status === 'live' || b.state.status === 'started' ? b.state.startTs : b.state.nextTs
        return ra - rb
      })
  ), [states, matchesType])

  const hero = upcoming[0] || null
  const afterHero = upcoming.slice(1, 6)

  const dayEvents = useMemo(
    () => (SCHEDULE_BY_DAY[selectedDay] || []).filter(matchesType),
    [selectedDay, matchesType]
  )
  const hiddenByFilter = (SCHEDULE_BY_DAY[selectedDay] || []).length - dayEvents.length

  const typeCounts = useMemo(() => {
    const counts = { all: ALL_EVENTS.length }
    for (const key of TYPE_KEYS) counts[key] = ALL_EVENTS.filter(e => e.type === key).length
    return counts
  }, [])

  // Jump from "Up next" to the event in the day view and highlight it.
  const focusEvent = useCallback(event => {
    selectDay(event.dow)
    setFlashKey(event.key)
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector(`[data-event-key="${event.key}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [selectDay])

  useEffect(() => {
    if (!flashKey) return undefined
    const id = setTimeout(() => setFlashKey(null), 1500)
    return () => clearTimeout(id)
  }, [flashKey])

  const serverClock = formatServerClock(now)
  const localClock = formatLocal(now)
  const showLocalFirst = timePref === 'local' && !LOCAL_IS_SERVER

  return (
    <div className="ec-root min-w-0 space-y-4 pb-6">
      <style>{EC_STYLES}</style>

      {/* Header */}
      <header className="ec-glass rounded-[22px] px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-bright" aria-hidden="true" />
              Clan Calendar
            </div>
            <h1 className="mt-1 font-spectral text-[2rem] font-bold leading-none text-text-bright sm:text-[2.3rem]">Weekly Events</h1>
            <p className="mt-1.5 text-[13px] text-text-dim">
              {ALL_EVENTS.length} events every week · Times follow the game server ({SERVER_TZ_LABEL})
            </p>
          </div>

          <div className="flex flex-wrap items-stretch gap-2">
            <div className="ec-well flex items-center gap-4 rounded-2xl px-4 py-2.5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">Server · {SERVER_TZ_LABEL}</div>
                <div className="mt-0.5 font-mono text-[18px] font-bold leading-none text-gold-bright">{serverClock.time}</div>
                <div className="mt-1 text-[11px] text-text-dim">{serverClock.date}</div>
              </div>
              {!LOCAL_IS_SERVER && (
                <>
                  <span className="h-10 w-px bg-white/10" aria-hidden="true" />
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">Your time · {LOCAL_ZONE_LABEL}</div>
                    <div className="mt-0.5 font-mono text-[18px] font-bold leading-none text-text-bright">{localClock.time}</div>
                    <div className="mt-1 text-[11px] text-text-dim">{localClock.dateLong}</div>
                  </div>
                </>
              )}
            </div>
            {setPage && (
              <button
                type="button"
                onClick={() => setPage('dashboard')}
                className="ec-chip self-center rounded-full px-4 py-2 text-[12px] font-semibold text-text-bright"
              >
                ← Dashboard
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Next event */}
      {hero && (
        <NextEventHero
          item={hero}
          now={now}
          showLocalFirst={showLocalFirst}
          onShow={() => focusEvent(hero.event)}
        />
      )}

      {/* Controls */}
      <div className="ec-glass ec-solid flex flex-col gap-2.5 rounded-[18px] p-2.5 md:flex-row md:items-center md:justify-between">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Filter by event type">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            aria-pressed={typeFilter === 'all'}
            className="ec-pill flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold"
          >
            All events <span className="font-mono text-[11px] opacity-70">{typeCounts.all}</span>
          </button>
          {TYPE_KEYS.map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(prev => (prev === key ? 'all' : key))}
              aria-pressed={typeFilter === key}
              style={{ '--ec-accent': TYPE[key].color }}
              className="ec-pill flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold"
            >
              <span style={{ color: TYPE[key].color }}><TypeIcon type={key} size={15} /></span>
              {TYPE[key].label}
              <span className="font-mono text-[11px] opacity-70">{typeCounts[key]}</span>
            </button>
          ))}
        </div>

        {!LOCAL_IS_SERVER && (
          <div className="ec-seg flex shrink-0 items-center gap-0.5 self-start rounded-full p-1 md:self-auto" role="group" aria-label="Show times in">
            <span className="px-2 text-[11px] font-bold uppercase tracking-[.1em] text-text-dim">Show</span>
            {[['local', 'My time'], ['server', 'Server time']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => changeTimePref(value)}
                aria-pressed={timePref === value}
                className="h-8 rounded-full px-3.5 text-[12px] font-semibold text-text-dim transition-colors hover:text-text-bright"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Day view */}
        <section className="ec-glass ec-solid min-w-0 overflow-hidden rounded-[22px]">
          <DayTabs
            todayDow={todayDow}
            activeDay={selectedDay}
            onSelect={selectDay}
            matchesType={matchesType}
          />

          <div id="ec-day-panel" role="tabpanel" aria-labelledby={`ec-tab-${selectedDay}`} className="p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <h2 className="font-spectral text-[1.35rem] font-bold leading-none text-text-bright">{DAY_NAMES[selectedDay]}</h2>
                {selectedDay === todayDow && (
                  <span className="rounded-full border border-gold/40 bg-gold/[.14] px-2.5 py-0.5 text-[11px] font-bold text-gold-bright">Today</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-text-dim">
                  {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                  {hiddenByFilter > 0 && ` · ${hiddenByFilter} hidden by filter`}
                </span>
                {selectedDay !== todayDow && (
                  <button
                    type="button"
                    onClick={() => { followTodayRef.current = true; setSelectedDay(todayDow) }}
                    className="ec-chip rounded-full px-3 py-1 text-[12px] font-semibold text-gold-light"
                  >
                    Back to today
                  </button>
                )}
              </div>
            </div>

            {dayEvents.length === 0 ? (
              <EmptyDay
                filtered={hiddenByFilter > 0}
                onClear={() => setTypeFilter('all')}
              />
            ) : (
              <ol ref={listRef} className="relative space-y-2.5">
                {dayEvents.map(event => (
                  <EventRow
                    key={event.key}
                    event={event}
                    state={states.get(event.key)}
                    now={now}
                    showLocalFirst={showLocalFirst}
                    flash={flashKey === event.key}
                  />
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* Up next */}
        <aside className="ec-glass ec-solid rounded-[22px] p-4">
          <h2 className="text-[12px] font-bold uppercase tracking-[.12em] text-gold-dim">After that</h2>
          {afterHero.length === 0 ? (
            <p className="mt-3 text-[13px] text-text-dim">No other events match this filter.</p>
          ) : (
            <ol className="mt-3 space-y-1.5">
              {afterHero.map(({ event, state }) => (
                <UpNextItem
                  key={event.key}
                  event={event}
                  state={state}
                  now={now}
                  showLocalFirst={showLocalFirst}
                  onSelect={focusEvent}
                />
              ))}
            </ol>
          )}
          <p className="mt-4 border-t border-white/[.07] pt-3 text-[11px] leading-5 text-text-dim">
            Days follow server time. {LOCAL_IS_SERVER
              ? 'Your clock already matches the server.'
              : `Your times are converted automatically for ${AUTO_LOCAL_TZ}.`}
          </p>
        </aside>
      </div>
    </div>
  )
}

/* ── Next event hero ───────────────────────────────────────────────── */

const NextEventHero = React.memo(function NextEventHero({ item, now, showLocalFirst, onShow }) {
  const { event, state } = item
  const type = TYPE[event.type]
  const inProgress = state.status === 'live' || state.status === 'started'
  const target = inProgress ? state.endTs : state.nextTs
  const local = formatLocal(inProgress ? state.startTs : state.nextTs)
  const serverLabel = `${DAY_SHORT[event.dow]} ${to12h(event.time)}`
  const localLabel = `${local.day} ${local.time}`
  const progress = inProgress
    ? Math.min(1, (now - state.startTs) / Math.max(1, state.endTs - state.startTs))
    : 0

  return (
    <section
      className="ec-glass overflow-hidden rounded-[22px]"
      style={{ '--ec-rim': `${type.color}88` }}
      aria-label="Next clan event"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[.07]"
        style={{ background: `radial-gradient(circle at 0% 0%, ${type.color}, transparent 55%)` }}
        aria-hidden="true"
      />
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-4 p-4 sm:flex sm:gap-4 sm:p-5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14"
          style={{ color: type.color, background: `${type.color}1f`, border: `1px solid ${type.color}66` }}
          aria-hidden="true"
        >
          <TypeIcon type={event.type} size={28} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {inProgress ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-400/40 bg-green-500/[.14] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-green-300">
                <span className="ec-live-dot h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden="true" />
                {state.status === 'live' ? 'Happening now' : 'Just started'}
              </span>
            ) : (
              <span className="text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim">Next event</span>
            )}
            <span className="text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: type.color }}>{type.label}</span>
          </div>
          <h2 className="mt-1 truncate font-spectral text-[1.5rem] font-bold leading-tight text-text-bright sm:text-[1.75rem]">{event.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-dim">
            {event.boss && <span>Boss: <span className="text-text-bright/90">{event.boss}</span></span>}
            {event.subtitle && <span>{event.subtitle}</span>}
            {(event.boss || event.subtitle) && <span className="text-white/20">·</span>}
            <span className="font-semibold text-text-bright">{showLocalFirst ? localLabel : serverLabel}</span>
            {!LOCAL_IS_SERVER && (
              <span className="text-text-dim">({showLocalFirst ? `server ${serverLabel}` : `your time ${localLabel}`})</span>
            )}
          </div>
        </div>

        <div className="col-span-2 flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
          <div className="sm:text-right">
            <div className="text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">{inProgress ? 'Ends in' : 'Starts in'}</div>
            <div
              className={`mt-0.5 font-mono text-[1.9rem] font-bold leading-none ${inProgress ? 'text-green-300' : state.status === 'soon' ? 'text-amber-300' : 'text-gold-bright'}`}
            >
              {formatCountdown(target - now)}
            </div>
          </div>
          <button type="button" onClick={onShow} className="ec-chip rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-text-bright">
            Show in schedule
          </button>
        </div>
      </div>
      {/* Only while running: how far through the event we are */}
      {inProgress && (
        <div className="h-1 bg-black/40" role="progressbar" aria-label="Event progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-green-400 transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </section>
  )
})

/* ── Day tabs ──────────────────────────────────────────────────────── */

const DayTabs = React.memo(function DayTabs({ todayDow, activeDay, onSelect, matchesType }) {
  const tabRefs = useRef({})

  const moveTo = useCallback(dow => {
    onSelect(dow)
    tabRefs.current[dow]?.focus()
  }, [onSelect])

  const onKeyDown = useCallback((e, dow) => {
    const i = DAY_ORDER.indexOf(dow)
    if (e.key === 'ArrowRight') { e.preventDefault(); moveTo(DAY_ORDER[(i + 1) % 7]) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moveTo(DAY_ORDER[(i + 6) % 7]) }
    else if (e.key === 'Home') { e.preventDefault(); moveTo(DAY_ORDER[0]) }
    else if (e.key === 'End') { e.preventDefault(); moveTo(DAY_ORDER[6]) }
  }, [moveTo])

  return (
    <div
      role="tablist"
      aria-label="Day of the week (server time)"
      className="grid grid-cols-7 gap-1 border-b border-white/[.07] bg-black/20 p-1.5 sm:gap-1.5 sm:p-2"
    >
      {DAY_ORDER.map(dow => {
        const active = dow === activeDay
        const isToday = dow === todayDow
        const events = (SCHEDULE_BY_DAY[dow] || []).filter(matchesType)
        return (
          <button
            key={dow}
            ref={node => { tabRefs.current[dow] = node }}
            id={`ec-tab-${dow}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="ec-day-panel"
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(dow)}
            onKeyDown={e => onKeyDown(e, dow)}
            className={`ec-day relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2 sm:py-2.5 ${active ? 'text-gold-bright' : 'text-text-dim hover:text-text-bright'}`}
          >
            <span className="flex items-center gap-1 text-[12px] font-bold sm:text-[14px]">
              {DAY_SHORT[dow]}
              {isToday && <span className="h-1.5 w-1.5 rounded-full bg-gold-bright" aria-label="Today" />}
            </span>
            {/* One dot per event, in its type colour */}
            <span className="flex h-2 items-center gap-0.5" aria-hidden="true">
              {events.length === 0
                ? <span className="h-1 w-3 rounded-full bg-white/10" />
                : events.map(e => (
                  <span key={e.key} className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE[e.type]?.color }} />
                ))}
            </span>
            <span className="hidden text-[11px] font-medium text-text-dim sm:block">
              {events.length} {events.length === 1 ? 'event' : 'events'}
            </span>
          </button>
        )
      })}
    </div>
  )
})

/* ── Event row ─────────────────────────────────────────────────────── */

const STATUS_STYLE = {
  live:     { label: 'Happening now', cls: 'border-green-400/40 bg-green-500/[.14] text-green-300', dot: 'bg-green-400' },
  started:  { label: 'Just started',  cls: 'border-green-400/40 bg-green-500/[.14] text-green-300', dot: 'bg-green-400' },
  soon:     { label: 'Starting soon', cls: 'border-amber-300/40 bg-amber-400/[.14] text-amber-200', dot: 'bg-amber-300' },
  upcoming: null,
  done:     { label: 'Done this week', cls: 'border-white/10 bg-white/[.04] text-text-dim', dot: null },
}

const EventRow = React.memo(function EventRow({ event, state, now, showLocalFirst, flash }) {
  const type = TYPE[event.type]
  const status = STATUS_STYLE[state.status]
  const inProgress = state.status === 'live' || state.status === 'started'
  const done = state.status === 'done'
  const local = formatLocal(state.startTs)
  const serverTime = to12h(event.time)
  const localDiffersInDay = local.day !== DAY_SHORT[event.dow]
  const primary = showLocalFirst ? local.time : serverTime
  const secondary = LOCAL_IS_SERVER
    ? null
    : showLocalFirst
      ? `${serverTime} server`
      : `${localDiffersInDay ? `${local.day} ` : ''}${local.time} yours`

  return (
    <li
      data-event-key={event.key}
      className={`ec-row ec-inset relative flex gap-3 overflow-hidden rounded-2xl p-3 sm:gap-4 sm:p-3.5 ${done ? 'opacity-55' : ''} ${flash ? 'is-flash' : ''}`}
      style={inProgress ? { borderColor: 'rgba(74,222,128,.4)' } : undefined}
    >
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: type.color }} aria-hidden="true" />

      {/* Time column */}
      <div className="w-[82px] shrink-0 pl-1.5 sm:w-[96px]">
        <div className="whitespace-nowrap font-mono text-[14px] font-bold leading-tight text-text-bright sm:text-[16px]">{primary}</div>
        {secondary && <div className="mt-0.5 text-[11px] leading-4 text-text-dim">{secondary}</div>}
        {showLocalFirst && localDiffersInDay && (
          <div className="mt-0.5 text-[11px] font-semibold text-amber-200/90">{local.day}</div>
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: type.color }}>
            <span className="inline-flex items-center gap-1"><TypeIcon type={event.type} size={13} />{type.label}</span>
          </span>
          {status && (
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-[10px] font-bold uppercase tracking-wider ${status.cls}`}>
              {status.dot && <span className={`ec-live-dot h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />}
              {status.label}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[15px] font-semibold leading-snug text-text-bright sm:text-[16px]">{event.name}</div>
        {(event.boss || event.subtitle) && (
          <div className="mt-0.5 text-[12px] leading-5 text-text-dim">
            {event.boss ? <>Boss: <span className="text-text-bright/90">{event.boss}</span></> : event.subtitle}
          </div>
        )}
      </div>

      {/* Countdown */}
      <div className="shrink-0 self-center text-right">
        <div className="text-[10px] font-bold uppercase tracking-[.1em] text-text-dim">
          {inProgress ? 'Ends in' : done ? 'Next week' : 'Starts in'}
        </div>
        <div
          className={`mt-0.5 font-mono text-[14px] font-bold sm:text-[15px] ${inProgress ? 'text-green-300' : state.status === 'soon' ? 'text-amber-300' : done ? 'text-text-dim' : 'text-gold-light'}`}
        >
          {formatCountdown((inProgress ? state.endTs : state.nextTs) - now)}
        </div>
      </div>
    </li>
  )
})

/* ── Up next item ──────────────────────────────────────────────────── */

const UpNextItem = React.memo(function UpNextItem({ event, state, now, showLocalFirst, onSelect }) {
  const type = TYPE[event.type]
  const inProgress = state.status === 'live' || state.status === 'started'
  const ts = inProgress ? state.startTs : state.nextTs
  const local = formatLocal(ts)
  const localWhen = `${local.day} ${local.time}`
  const serverWhen = `${DAY_SHORT[event.dow]} ${to12h(event.time)}`

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(event)}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[.05]"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ color: type.color, background: `${type.color}1a`, border: `1px solid ${type.color}55` }}
          aria-hidden="true"
        >
          <TypeIcon type={event.type} size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-text-bright">{event.name}</span>
          {LOCAL_IS_SERVER ? (
            <span className="block truncate text-[12px] text-text-dim">{serverWhen}</span>
          ) : (
            <>
              <span className="mt-0.5 block truncate text-[12px] font-semibold leading-4 text-text-bright/90">
                {showLocalFirst ? localWhen : serverWhen}
              </span>
              <span className="block truncate text-[11px] leading-4 text-text-dim">
                {showLocalFirst ? `Server: ${serverWhen}` : `Your time: ${localWhen}`}
              </span>
            </>
          )}
        </span>
        <span className={`shrink-0 font-mono text-[12px] font-bold ${inProgress ? 'text-green-300' : state.status === 'soon' ? 'text-amber-300' : 'text-text-bright'}`}>
          {inProgress ? 'Now' : formatCountdown(ts - now)}
        </span>
      </button>
    </li>
  )
})

/* ── Empty day ─────────────────────────────────────────────────────── */

const EmptyDay = React.memo(function EmptyDay({ filtered, onClear }) {
  return (
    <div className="ec-well rounded-2xl px-4 py-12 text-center">
      <div className="text-2xl text-text-dim" aria-hidden="true">◌</div>
      <div className="mt-2 text-[15px] font-semibold text-text-bright">
        {filtered ? 'No events of this type on this day' : 'Nothing scheduled'}
      </div>
      <div className="mt-1 text-[13px] text-text-dim">
        {filtered ? 'Other event types are hidden by your filter.' : 'No clan events are listed for this day.'}
      </div>
      {filtered && (
        <button type="button" onClick={onClear} className="ec-chip mt-4 rounded-full px-4 py-2 text-[12px] font-semibold text-gold-light">
          Show all event types
        </button>
      )}
    </div>
  )
})

export default EventCalendar