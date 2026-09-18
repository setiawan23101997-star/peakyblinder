import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'

/* ─────────────────────────────────────────────────────────────────────
   PeakyBlinder · Event Calendar
   Standalone calendar page using the clan's existing weekly schedule.
   Server time is authoritative; local time is shown automatically.
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
const AUTO_LOCAL_TZ = (() => {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'
  } catch {
    return 'Local'
  }
})()

const TYPE = {
  boss:     { color: '#ef4444', tagColor: '#f2cc60', icon: '👾', label: 'World Boss' },
  battle:   { color: '#3b82f6', tagColor: '#60a5fa', icon: '⚔️', label: 'Server Battle' },
  treasure: { color: '#eab308', tagColor: '#f2cc60', icon: '🏝️', label: 'Sindri Island' },
  arena:    { color: '#a855f7', tagColor: '#c084fc', icon: '🏟️', label: 'Arena' },
}

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

const DOW_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function getZoneParts(ts, tz) {
  const parts = getDTF('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ts))

  let y = 0, m = 0, d = 0, hh = 0, mm = 0, ss = 0
  for (const p of parts) {
    if (p.type === 'year') y = Number(p.value)
    if (p.type === 'month') m = Number(p.value)
    if (p.type === 'day') d = Number(p.value)
    if (p.type === 'hour') hh = p.value === '24' ? 0 : Number(p.value)
    if (p.type === 'minute') mm = Number(p.value)
    if (p.type === 'second') ss = Number(p.value)
  }

  const dowStr = getDTF('en-GB', {
    timeZone: tz,
    weekday: 'short',
  }).format(new Date(ts))

  return { y, m, d, hh, mm, ss, dow: DOW_MAP[dowStr] ?? 0 }
}

function zoneWallTimeToUtc(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0, 0)
  const step = 15 * 60 * 1000
  let best = guess
  let bestDiff = Infinity

  for (let i = -96; i <= 96; i++) {
    const ts = guess + i * step
    const p = getZoneParts(ts, tz)
    const wallMs = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss)
    const targetMs = Date.UTC(y, m - 1, d, hh, mm, 0)
    const diff = Math.abs(wallMs - targetMs)

    if (diff < bestDiff) {
      bestDiff = diff
      best = ts
    }

    if (diff === 0) break
  }

  return best
}

function nextOccurrenceInZone(dayOfWeek, hhmm, fromTs, tz) {
  const [hh, mm] = hhmm.split(':').map(Number)
  const fromParts = getZoneParts(fromTs, tz)
  const delta = (dayOfWeek - fromParts.dow + 7) % 7

  const candidate = zoneWallTimeToUtc(
    fromParts.y,
    fromParts.m,
    fromParts.d + delta,
    hh,
    mm,
    tz
  )

  if (candidate > fromTs) return candidate

  const nextParts = getZoneParts(candidate + 24 * 60 * 60 * 1000, tz)
  return zoneWallTimeToUtc(
    nextParts.y,
    nextParts.m,
    nextParts.d + 6,
    hh,
    mm,
    tz
  )
}

function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function formatZone(ts, tz) {
  const date = new Date(ts)
  return {
    time: getDTF('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date),
    day: getDTF('en-GB', {
      timeZone: tz,
      weekday: 'long',
    }).format(date),
    date: getDTF('en-GB', {
      timeZone: tz,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date),
  }
}

function getLocalZoneLabel() {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: AUTO_LOCAL_TZ,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())

    return parts.find(p => p.type === 'timeZoneName')?.value || AUTO_LOCAL_TZ
  } catch {
    return AUTO_LOCAL_TZ
  }
}

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

const ALL_EVENTS = (() => {
  const out = []

  for (const dow of DAY_ORDER) {
    for (const event of WEEKLY_SCHEDULE[dow] || []) {
      out.push({ ...event, dow })
    }
  }

  return out
})()

const SCHEDULE_BY_DAY = (() => {
  const out = {}

  for (const dow of DAY_ORDER) {
    out[dow] = [...(WEEKLY_SCHEDULE[dow] || [])]
      .sort((a, b) => a.time.localeCompare(b.time))
  }

  return out
})()

function EventCalendar({ setPage }) {
  const now = useNow()
  const serverParts = useMemo(() => getZoneParts(now, SERVER_TZ), [now])
  const todayDow = serverParts.dow

  const [selectedDay, setSelectedDay] = useState(todayDow)

  useEffect(() => {
    setSelectedDay(todayDow)
  }, [todayDow])

  const activeDay = selectedDay ?? todayDow
  const events = SCHEDULE_BY_DAY[activeDay] || []

  const weekSummary = useMemo(() => {
    return DAY_ORDER.map(dow => ({
      dow,
      count: (SCHEDULE_BY_DAY[dow] || []).length,
    }))
  }, [])

  const totalWeeklyEvents = ALL_EVENTS.length
  const localClock = useMemo(() => formatZone(now, AUTO_LOCAL_TZ), [now])
  const serverClock = useMemo(() => formatZone(now, SERVER_TZ), [now])

  const goBack = useCallback(() => {
    if (setPage) setPage('dashboard')
  }, [setPage])

  return (
    <main className="w-full min-w-0 max-w-full overflow-x-clip space-y-3.5 pb-8 sm:space-y-4">
      <CalendarHeader
        serverClock={serverClock}
        localClock={localClock}
        totalWeeklyEvents={totalWeeklyEvents}
        onBack={goBack}
      />

      <section aria-label="Weekly event calendar">
        <div className="mb-2.5 flex min-w-0 items-center justify-between gap-3 sm:mb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-bright shadow-[0_0_9px_rgba(242,204,96,0.65)]" aria-hidden="true" />
            <h2 className="font-spectral text-[22px] font-bold leading-none text-text-bright sm:text-2xl">
              Weekly Events
            </h2>
            <span className="hidden rounded-full border border-white/[0.06] bg-white/[0.018] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-text-dim sm:inline-flex">
              Server Time
            </span>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {Object.entries(TYPE).map(([key, type]) => (
              <div key={key} className="flex items-center gap-1.5 text-[10px] font-medium text-text-dim">
                <span className="text-sm leading-none" aria-hidden="true">{type.icon}</span>
                <span>{type.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-2.5 flex items-center gap-2 overflow-x-auto pb-0.5 sm:hidden">
          {Object.entries(TYPE).map(([key, type]) => (
            <span
              key={key}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[8px] font-semibold text-text-dim"
            >
              <span className="text-sm leading-none" aria-hidden="true">{type.icon}</span>
              {type.label}
            </span>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#090807]/80 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
          <DayTabs
            todayDow={todayDow}
            activeDay={activeDay}
            onSelect={setSelectedDay}
            weekSummary={weekSummary}
          />

          <div className="border-t border-white/[0.055] p-2.5 sm:p-3.5 md:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-spectral text-xl font-bold text-text-bright">
                  {DAY_NAMES[activeDay]}
                </div>
                <div className="mt-0.5 text-[10px] text-text-dim">
                  Server schedule · {events.length} {events.length === 1 ? 'event' : 'events'}
                </div>
              </div>

              {activeDay === todayDow && (
                <span className="shrink-0 rounded-full border border-gold/20 bg-gold/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-gold-light">
                  Today
                </span>
              )}
            </div>

            {events.length === 0 ? (
              <EmptyDay />
            ) : (
              <div className="space-y-2">
                {events.map((event, index) => (
                  <EventRow
                    key={`${event.time}-${event.name}-${index}`}
                    event={event}
                    dow={activeDay}
                    now={now}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="px-1 pt-0.5 text-[10px] leading-relaxed text-text-dim/85 sm:text-[11px]">
        Event schedules use server time · Local time is calculated automatically from your browser timezone.
      </div>
    </main>
  )
}

const CalendarHeader = React.memo(function CalendarHeader({
  serverClock,
  localClock,
  totalWeeklyEvents,
  onBack,
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-gold/15 bg-[#090807]/92 shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-gold/[0.04] blur-3xl" aria-hidden="true" />

      <div className="relative px-4 py-4 sm:px-5 sm:py-4 lg:px-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-gold-bright shadow-[0_0_10px_rgba(242,204,96,0.7)]" aria-hidden="true" />
              <h1 className="font-spectral text-[27px] font-bold leading-none tracking-[-0.02em] text-text-bright sm:text-[31px]">
                Clan Calendar
              </h1>
            </div>

            <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-text-dim sm:text-xs">
              Server schedule is authoritative. Local times are converted automatically.
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12px]">
              <span className="font-semibold text-text-dim">
                <span className="font-mono text-gold-light">{totalWeeklyEvents}</span>
                <span className="ml-1.5">events this week</span>
              </span>
              <span className="text-white/10">·</span>
              <span className="font-semibold uppercase tracking-[0.1em] text-text-dim">
                Server <span className="ml-1 font-mono normal-case tracking-normal text-gold-light">{SERVER_TZ_LABEL}</span>
              </span>
              <span className="text-white/10">→</span>
              <span className="font-semibold uppercase tracking-[0.1em] text-text-dim">
                Local <span className="ml-1 font-mono normal-case tracking-normal text-gold-light">{getLocalZoneLabel()}</span>
              </span>
            </div>
          </div>

          <div className="w-full shrink-0 lg:w-[360px]">
            <TimeConversionBar
              serverClock={serverClock}
              localClock={localClock}
            />
          </div>
        </div>
      </div>
    </header>
  )
})

const TimeConversionBar = React.memo(function TimeConversionBar({ serverClock, localClock }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-text-dim sm:text-[9px]">
              Server
            </span>
            <span className="font-mono text-[8px] font-semibold text-gold-light/80">
              {SERVER_TZ_LABEL}
            </span>
            <span className="text-white/15">→</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-text-dim sm:text-[9px]">
              Your Time
            </span>
            <span className="font-mono text-[8px] font-semibold text-gold-light/80">
              {getLocalZoneLabel()}
            </span>
          </div>
          <div className="mt-1.5 flex min-w-0 items-baseline gap-2.5 font-mono tabular-nums leading-none">
            <span className="truncate text-[19px] font-bold text-text-bright sm:text-[21px]">
              {serverClock.time}
            </span>
            <span className="text-[11px] font-semibold text-text-dim">→</span>
            <span className="truncate text-[19px] font-bold text-gold-bright sm:text-[21px]">
              {localClock.time}
            </span>
          </div>
          <div className="mt-1 truncate text-[8px] text-text-dim sm:text-[9px]">
            {serverClock.day.slice(0, 3)} · {serverClock.date} · {AUTO_LOCAL_TZ}
          </div>
        </div>
      </div>
    </div>
  )
})

const DayTabs = React.memo(function DayTabs({
  todayDow,
  activeDay,
  onSelect,
  weekSummary,
}) {
  const tabRefs = useRef({})

  const moveSelection = useCallback((fromDow, step) => {
    const index = DAY_ORDER.indexOf(fromDow)
    const nextIndex = (index + step + DAY_ORDER.length) % DAY_ORDER.length
    const nextDow = DAY_ORDER[nextIndex]

    onSelect(nextDow)
    tabRefs.current[nextDow]?.focus()
  }, [onSelect])

  const onKeyDown = useCallback((event, dow) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      moveSelection(dow, 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      moveSelection(dow, -1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      onSelect(DAY_ORDER[0])
      tabRefs.current[DAY_ORDER[0]]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      const last = DAY_ORDER[DAY_ORDER.length - 1]
      onSelect(last)
      tabRefs.current[last]?.focus()
    }
  }, [moveSelection, onSelect])

  return (
    <div
      role="tablist"
      aria-label="Days of the week in server time"
      className="grid grid-cols-7 border-b border-white/[0.06] bg-white/[0.012]"
    >
      {DAY_ORDER.map(dow => {
        const active = dow === activeDay
        const today = dow === todayDow
        const count = weekSummary.find(item => item.dow === dow)?.count || 0

        return (
          <button
            key={dow}
            ref={node => { tabRefs.current[dow] = node }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(dow)}
            onKeyDown={event => onKeyDown(event, dow)}
            className={`relative min-w-0 px-1 py-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/70 focus-visible:-outline-offset-2 sm:px-2.5 sm:py-3 ${
              active
                ? 'bg-gold/[0.035] text-gold-bright'
                : 'text-text-dim hover:bg-white/[0.02] hover:text-text-bright'
            }`}
          >
            <span className="flex items-center justify-center gap-1 text-[11px] font-bold sm:text-[12px]">
              {DAY_SHORT[dow]}
              {today && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-gold-bright"
                  aria-label="Today"
                />
              )}
            </span>

            <span className="mt-0.5 block font-mono text-[9px] tabular-nums text-text-dim sm:text-[10px]">
              {count} {count === 1 ? 'event' : 'events'}
            </span>

            {active && (
              <span
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gold-bright"
                aria-hidden="true"
              />
            )}
          </button>
        )
      })}
    </div>
  )
})

const EventRow = React.memo(function EventRow({ event, dow, now }) {
  const type = TYPE[event.type]
  const startTs = useMemo(
    () => nextOccurrenceInZone(dow, event.time, now, SERVER_TZ),
    [dow, event.time, now]
  )

  const countdown = formatCountdown(startTs - now)
  const local = formatZone(startTs, AUTO_LOCAL_TZ)
  const soon = startTs - now > 0 && startTs - now < 60 * 60 * 1000

  return (
    <article className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-black/20 transition-colors hover:border-gold/20 hover:bg-gold/[0.018]">
      <div
        className="absolute inset-y-2 left-0 w-[2px] rounded-full"
        style={{ background: type.color, boxShadow: `0 0 10px ${type.color}35` }}
        aria-hidden="true"
      />

      <div className="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-3.5 sm:py-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-base"
            style={{
              color: type.color,
              borderColor: `${type.color}30`,
              background: `${type.color}0d`,
            }}
            aria-hidden="true"
          >
            {type.icon}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-full border border-white/[0.08] bg-white/[0.025] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em]"
                style={{ color: type.tagColor }}
              >
                {type.label}
              </span>

              {soon && (
                <span className="rounded-full border border-red-400/25 bg-red-400/[0.07] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-red-300">
                  Starting Soon
                </span>
              )}
            </div>

            <h3 className="mt-0.5 break-words text-[15px] font-semibold leading-snug text-text-bright sm:text-base">
              {event.name}
            </h3>

            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-dim">
              {event.boss && <span className="truncate">👾 {event.boss}</span>}
              {event.subtitle && <span className="truncate">{event.subtitle}</span>}
            </div>
          </div>
        </div>

        <div className="min-w-0 shrink-0 border-t border-white/[0.055] pt-2.5 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] tabular-nums sm:justify-end sm:text-right">
            <span className="font-bold text-text-bright">
              {to12h(event.time)} server
            </span>
            <span className="text-white/20">→</span>
            <span className="font-semibold text-gold-light/90">
              {local.day.slice(0, 3)} · {local.time}
            </span>
            <span className="text-white/20">·</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-text-dim">
              starts in
            </span>
            <span
              className={`font-mono text-[13px] font-bold tabular-nums ${soon ? 'motion-safe:animate-pulse' : ''}`}
              style={{ color: soon ? '#f87171' : '#f2cc60' }}
            >
              {countdown}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
})

const EmptyDay = React.memo(function EmptyDay() {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-black/15 px-4 py-10 text-center">
      <div className="text-2xl opacity-60" aria-hidden="true">◌</div>
      <div className="mt-2 text-sm font-semibold text-text-bright">
        Nothing Scheduled
      </div>
      <div className="mt-1 text-[10px] text-text-dim">
        No clan events are listed for this day.
      </div>
    </div>
  )
})

export default EventCalendar
