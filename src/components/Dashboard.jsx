import React, { useState, useEffect, useMemo, useCallback, useId, useRef } from 'react'
import { ClanNoticePreview } from './NoticeBoard'

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
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const URGENT_MS = 5 * 60 * 1000
const RECENT_WIN_MS = 7 * 24 * 60 * 60 * 1000
const JUST_ENDED_MS = 5 * 60 * 1000
const MAX_RECENT_WINS = 3
const MAX_LIVE_AUCTIONS = 5
const DEBUG_WINS = false

const TYPE = {
  boss:     { color: '#ef4444', icon: '👾', label: 'World Boss' },
  battle:   { color: '#3b82f6', icon: '⚔️', label: 'Server Battle' },
  treasure: { color: '#eab308', icon: '🏝️', label: 'Sindri Island' },
  arena:    { color: '#a855f7', icon: '🏟️', label: 'Arena' },
}

const RARITY_COLORS = {
  material:   { color: '#ffffff', border: 'rgba(255,255,255,0.55)' },	
  common:   { color: '#4ade80', border: 'rgba(74,222,128,0.6)' },
  uncommon:   { color: '#ffffff', border: 'rgba(255,255,255,0.55)' },
  rare:       { color: '#60a5fa', border: 'rgba(96,165,250,0.6)' },
  epic:       { color: '#f87171', border: 'rgba(248,113,113,0.7)' },
  legendary:  { color: '#f2cc60', border: 'rgba(242,204,96,0.75)' },
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const NBSP = '\u00A0'

const SERVER_TZ = 'Asia/Singapore'
const SERVER_TZ_LABEL = 'GMT+8'

// Server time remains authoritative. This timezone is only used to show
// the same event instant in each player's own browser/device timezone.
const AUTO_LOCAL_TZ = (() => {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'
  } catch {
    return 'Local'
  }
})()

function getLocalZoneLabel() {
  // Prefer a familiar regional abbreviation where the browser timezone is known.
  // Fall back to a GMT offset so the label remains accurate for other timezones.
  const COMMON_TZ_LABELS = {
    'Asia/Jakarta': 'WIB',
    'Asia/Pontianak': 'WIB',
    'Asia/Makassar': 'WITA',
    'Asia/Ujung_Pandang': 'WITA',
    'Asia/Jayapura': 'WIT',
    'Asia/Singapore': 'SGT',
    'Asia/Kuala_Lumpur': 'MYT',
    'Asia/Manila': 'PHT',
    'Asia/Bangkok': 'ICT',
    'Asia/Ho_Chi_Minh': 'ICT',
    'Asia/Tokyo': 'JST',
    'Asia/Seoul': 'KST',
    'Asia/Hong_Kong': 'HKT',
    'Asia/Shanghai': 'CST',
    'Australia/Sydney': 'AEST/AEDT',
    'Europe/London': 'GMT/BST',
    'Europe/Paris': 'CET/CEST',
    'America/New_York': 'ET',
    'America/Chicago': 'CT',
    'America/Denver': 'MT',
    'America/Los_Angeles': 'PT',
  }

  if (COMMON_TZ_LABELS[AUTO_LOCAL_TZ]) {
    return COMMON_TZ_LABELS[AUTO_LOCAL_TZ]
  }

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

const DEFAULT_REGION = {
  id: 'ph', code: 'ph', flag: '🇵🇭', name: 'Philippines',
  tz: 'Asia/Manila', label: 'GMT+8',
}

/* ── Cached Intl formatters ────────────────────────────────────────── */

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

const _dowCache = new Map()
function getDowFormatter(tz) {
  let f = _dowCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' })
    _dowCache.set(tz, f)
  }
  return f
}

const ZONE_PARTS_OPTS = {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
}

const TIME_OPTS = { hour: '2-digit', minute: '2-digit', hour12: true }
const DATE_OPTS = { day: '2-digit', month: 'short', year: 'numeric' }

const DOW_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')}${NBSP}${period}`
}

function getZoneParts(ts, tz) {
  const dtf = getDTF('en-GB', { timeZone: tz, ...ZONE_PARTS_OPTS })
  const parts = dtf.formatToParts(new Date(ts))
  let y = 0, m = 0, d = 0, hh = 0, mm = 0, ss = 0
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    switch (p.type) {
      case 'year': y = Number(p.value); break
      case 'month': m = Number(p.value); break
      case 'day': d = Number(p.value); break
      case 'hour': hh = p.value === '24' ? 0 : Number(p.value); break
      case 'minute': mm = Number(p.value); break
      case 'second': ss = Number(p.value); break
      default: break
    }
  }
  const dowStr = getDowFormatter(tz).format(new Date(ts))
  const dow = DOW_MAP[dowStr] ?? 0
  return { y, m, d, hh, mm, ss, dow }
}

function zoneWallTimeToUtc(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0, 0)
  const STEP_MS = 15 * 60 * 1000
  let best = guess
  let bestDiff = Infinity
  for (let i = -96; i <= 96; i++) {
    const ts = guess + i * STEP_MS
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
    fromParts.y, fromParts.m, fromParts.d + delta, hh, mm, tz
  )
  if (candidate > fromTs) return candidate

  const nextParts = getZoneParts(candidate + 24 * 60 * 60 * 1000, tz)
  return zoneWallTimeToUtc(nextParts.y, nextParts.m, nextParts.d + 6, hh, mm, tz)
}

function formatInZone(ts, tz) {
  const d = new Date(ts)

  // Use en-US for 12-hour clock formatting so AM/PM casing is
  // consistent everywhere. en-GB renders the period as lowercase
  // ("pm"), while the dashboard uses uppercase ("PM") elsewhere.
  const time = getDTF('en-US', { timeZone: tz, ...TIME_OPTS }).format(d)
  const day = getDTF('en-GB', { timeZone: tz, weekday: 'long' }).format(d)
  const date = getDTF('en-GB', { timeZone: tz, ...DATE_OPTS }).format(d)
  return { time, day, date }
}

function formatInAutoLocalZone(ts) {
  return formatInZone(ts, AUTO_LOCAL_TZ)
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

function formatAuctionTime(ms) {
  if (ms <= 0) return 'Ended'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatRelativePast(ms) {
  if (ms <= 0) return 'Just Now'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d Ago`
  if (h > 0) return `${h}h Ago`
  if (m > 0) return `${m}m Ago`
  return `${s}s Ago`
}

function getGreeting(hour) {
  if (hour < 5) return 'Still Up'
  if (hour < 12) return 'Good Morning'
  if (hour < 18) return 'Good Afternoon'
  return 'Good Evening'
}

function getLiveAuctionBidderCount(a) {
  const bids = Array.isArray(a?.bids) ? a.bids : []
  const latestByBidder = new Map()

  for (let i = 0; i < bids.length; i++) {
    const bid = bids[i]
    const bidder = String(bid?.bidder || bid?.bidderName || '').trim()
    if (!bidder) continue
    latestByBidder.set(bidder, { ...bid, _index: i })
  }

  return [...latestByBidder.values()].filter(
    bid => !bid?.cancelled && Number(bid?.amount ?? bid?.bid ?? 0) > 0
  ).length
}

function readWinner(a, now = Date.now()) {
  const name = a.winner || a.winnerName || a.topBidder || a.soldTo || null
  const price = a.finalBid ?? a.currentBid ?? a.winningBid ?? 0

  const explicit = a.endedAt || a.closedAt || 0
  const scheduled = a.endsAt || 0
  const lastBidTs = (() => {
    const bids = a.bids || []
    for (let i = bids.length - 1; i >= 0; i--) {
      const t = bids[i]?.time
      if (typeof t === 'number' && t > 0) return t
    }
    return 0
  })()

  let endedAt = 0
  if (explicit > 0) endedAt = explicit
  else if (scheduled > 0 && scheduled <= now) endedAt = scheduled
  else if (lastBidTs > 0) endedAt = lastBidTs

  return { name, price, endedAt }
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const FlagImage = React.memo(function FlagImage({ code, flag, name, width = 20, height = 15 }) {
  const [failed, setFailed] = useState(false)

  // FlagCDN uses lowercase ISO 3166-1 alpha-2 country codes.
  // Normalize here because region data may contain "ID", "PH", etc.
  const normalizedCode = String(code || '').trim().toLowerCase()

  if (!normalizedCode || failed) {
    if (!flag) return null
    return (
      <span
        className="inline-flex items-center justify-center flex-shrink-0 leading-none"
        style={{ width, height, fontSize: Math.round(height * 1.1) }}
        aria-hidden="true"
      >
        {flag}
      </span>
    )
  }

  return (
    <img
      src={`https://flagcdn.com/w20/${normalizedCode}.png`}
      srcSet={`https://flagcdn.com/w20/${normalizedCode}.png 1x, https://flagcdn.com/w40/${normalizedCode}.png 2x`}
      width={width}
      height={height}
      alt={name ? `${name} flag` : ''}
      loading="lazy"
      decoding="async"
      className="rounded-[2px] border border-gold/20 object-cover flex-shrink-0"
      style={{ width, height, minWidth: width, minHeight: height }}
      onError={() => setFailed(true)}
    />
  )
})

const ALL_EVENTS = (() => {
  const out = []
  for (const dow of DAY_ORDER) {
    for (const ev of WEEKLY_SCHEDULE[dow]) out.push({ ...ev, dow })
  }
  return out
})()

const SCHEDULE_BY_DAY = (() => {
  const out = {}
  for (const dow of DAY_ORDER) {
    out[dow] = [...(WEEKLY_SCHEDULE[dow] || [])].sort((a, b) => a.time.localeCompare(b.time))
  }
  return out
})()

export default function Dashboard({ ctx, setPage }) {
  const { members, auctions, currentUser, region } = ctx
  const activeRegion = useMemo(() => {
    if (!region) return DEFAULT_REGION
    return {
      ...region,
      code: String(region.code || region.id || '').trim().toLowerCase(),
      flag: region.flag || (String(region.code || region.id || '').trim().toLowerCase() === 'id' ? '🇮🇩' : ''),
      name: region.name || region.label || region.id,
      label: region.label || '',
    }
  }, [region])

  const isAdmin = currentUser?.role === 'Admin'
  const isElder = isAdmin || currentUser?.role === 'Elder' || currentUser?.role === 'Master'

  const visibleMembers = useMemo(
    () => isAdmin ? members : members.filter(m => m.role !== 'Admin'),
    [members, isAdmin]
  )

  const activeAuctions = useMemo(() => {
    return auctions
      .filter(a => a.status === 'active')
      .sort((a, b) => (a.endsAt || 0) - (b.endsAt || 0))
      .slice(0, MAX_LIVE_AUCTIONS)
  }, [auctions])

  const totalActiveAuctions = useMemo(
    () => auctions.filter(a => a.status === 'active').length,
    [auctions]
  )

  const endedAuctionData = useMemo(() => {
    const out = []
    for (const a of auctions) {
      if (a.status === 'active') continue
      const w = readWinner(a, Date.now())
      if (w.name && w.endedAt > 0) out.push({ auction: a, ...w })
    }
    out.sort((x, y) => y.endedAt - x.endedAt)
    return out
  }, [auctions])

  const goAuctions = useCallback(() => setPage('auctions'), [setPage])
  const goMembers = useCallback(() => setPage('members'), [setPage])
  const goAttendance = useCallback(() => setPage('attendance'), [setPage])
  const goCalendar = useCallback(() => setPage('calendar'), [setPage])
  const goNoticeBoard = useCallback(() => setPage('notice-board'), [setPage])

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden space-y-5 sm:space-y-8 pb-8 sm:pb-12">
      <HeroSection
        currentUser={currentUser}
        activeRegion={activeRegion}
        setPage={setPage}
        isElder={isElder}
        goAttendance={goAttendance}
        goAuctions={goAuctions}
        goMembers={goMembers}
        goCalendar={goCalendar}
      />

      <ClanPulse
        memberCount={visibleMembers.length}
        activeAuctionCount={totalActiveAuctions}
        onOpenMembers={goMembers}
        onOpenAuctions={goAuctions}
        onOpenCalendar={goCalendar}
      />

      <ClanNoticePreview ctx={ctx} onOpenAll={goNoticeBoard} />

      <LiveAuctionsStrip
        auctions={activeAuctions}
        totalCount={totalActiveAuctions}
        onOpenAll={goAuctions}
        currentUser={currentUser}
      />

      <RecentWinsStrip
        endedData={endedAuctionData}
        onOpenAll={goAuctions}
        currentUser={currentUser}
      />

      <UpcomingEventPreview onOpenCalendar={goCalendar} />


    </div>
  )
}

/* ── Hero ──────────────────────────────────────────────────────────── */

const HeroSection = React.memo(function HeroSection({
  currentUser, activeRegion, isElder,
  goAttendance, goAuctions, goMembers, goCalendar,
}) {
  const now = useNow()

  const serverClock = useMemo(() => formatInZone(now, SERVER_TZ), [now])
  const localClock = useMemo(() => formatInAutoLocalZone(now), [now])
  const serverSec = useMemo(
    () => String(getZoneParts(now, SERVER_TZ).ss).padStart(2, '0'),
    [now]
  )
  const greeting = getGreeting(getZoneParts(now, AUTO_LOCAL_TZ).hh)
  const firstName = currentUser?.name?.split(' ')[0] || 'Warrior'

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-gold/25 bg-[#0b0a09]/90 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" aria-hidden="true" />
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold/[0.05] blur-3xl" aria-hidden="true" />
        <div className="relative p-5 sm:p-6 md:p-7 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-4 sm:gap-6 items-center min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_10px_rgba(242,204,96,0.8)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold-dim">Clan command center</span>
            </div>
            <h1 className="font-spectral text-3xl sm:text-4xl md:text-[2.7rem] font-bold leading-tight break-words">
              <span className="text-text-bright">{greeting}, </span>
              <span className="text-gold-bright">{firstName}</span>
            </h1>
            <p className="mt-2 text-text-dim text-[11px] leading-relaxed sm:text-[15px]">
              Your clan overview, market activity, and upcoming events at a glance.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 min-w-0 w-full xl:w-auto xl:min-w-[380px]">
            <div className="min-w-0 rounded-xl border border-gold/15 bg-black/25 px-3 py-3 sm:px-4 sm:py-3.5">
              <div className="text-[10px] sm:text-[11px] text-text-dim font-bold uppercase tracking-[0.12em] sm:tracking-[0.16em] truncate">
                Server · {SERVER_TZ_LABEL}
              </div>
              <div className="font-mono tabular-nums leading-none text-gold-bright whitespace-nowrap mt-1">
                <span className="text-xl sm:text-2xl md:text-[1.7rem]">
                  {serverClock.time}
                </span>
                <span className="text-[10px] sm:text-sm text-gold-light/60 ml-0.5">
                  :{serverSec}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-text-dim mt-1.5 whitespace-nowrap">
                {serverClock.day.slice(0, 3)} · {serverClock.date}
              </div>
            </div>

            <div className="rounded-xl border border-gold/15 bg-black/25 px-3.5 py-3 min-w-0">
              <div className="text-[10px] sm:text-[11px] text-gold-dim font-semibold uppercase tracking-[0.12em] sm:tracking-wider flex items-center gap-1.5 truncate">
                <span>Your Time · {getLocalZoneLabel()}</span>
              </div>
              <div className="font-mono tabular-nums leading-none text-gold-bright whitespace-nowrap mt-1">
                <span className="text-xl sm:text-2xl md:text-[1.7rem]">{localClock.time}</span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-text-dim mt-1.5 whitespace-nowrap flex items-center gap-1.5">
                <span className="text-gold-light">●</span>
                <span className="truncate">{AUTO_LOCAL_TZ}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 min-w-0">
        <ActionTile icon="◷" label="Attendance" hint={isElder ? 'Record & Award Coins' : 'View Attendance History'} onClick={goAttendance} />
        <ActionTile icon="◇" label="Live Auctions" hint="Bid On Clan Items" onClick={goAuctions} />
        <ActionTile icon="♙" label={isElder ? 'Manage Members' : 'View Members'} hint={isElder ? 'Add, Edit & Remove' : 'See Clan Roster'} onClick={goMembers} />
        <ActionTile icon="▣" label="Event Calendar" hint="Check Upcoming Events" onClick={goCalendar} />
      </section>
    </>
  )
})

/* ── Clan Pulse ────────────────────────────────────────────────────── */

const ClanPulse = React.memo(function ClanPulse({
  memberCount, activeAuctionCount, onOpenMembers, onOpenAuctions, onOpenCalendar,
}) {
  const now = useNow()

  const serverParts = useMemo(() => getZoneParts(now, SERVER_TZ), [now])
  const todayEvents = SCHEDULE_BY_DAY[serverParts.dow] || []

  const nextEvent = useMemo(() => {
    let best = null

    for (const ev of ALL_EVENTS) {
      const ts = nextOccurrenceInZone(ev.dow, ev.time, now, SERVER_TZ)
      if (!best || ts < best.ts) {
        best = { ...ev, ts }
      }
    }

    return best
  }, [now])

  const nextEventTimes = useMemo(() => {
    if (!nextEvent) return null
    const server = formatInZone(nextEvent.ts, SERVER_TZ)
    const local = formatInAutoLocalZone(nextEvent.ts)
    return {
      serverTime: server.time,
      serverDay: server.day,
      localTime: local.time,
      localDay: local.day,
      localZone: getLocalZoneLabel(),
    }
  }, [nextEvent])

  return (
    <section
      aria-label="Clan Pulse"
      className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#090807]/78 shadow-[0_12px_34px_rgba(0,0,0,0.18)]"
    >
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/35 to-transparent"
        aria-hidden="true"
      />

      <div className="flex min-w-0 flex-col lg:flex-row lg:items-stretch">
        <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.055] px-4 py-3 lg:w-[150px] lg:border-b-0 lg:border-r lg:px-4">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-bright shadow-[0_0_9px_rgba(242,204,96,0.7)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-light">
              Clan Pulse
            </div>
            <div className="mt-0.5 text-[10px] text-text-dim">
              Live overview
            </div>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 divide-x divide-y divide-white/[0.055] sm:grid-cols-3 sm:divide-y-0">
          <button
            type="button"
            onClick={onOpenAuctions}
            className="group flex min-w-0 items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold/60 sm:px-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/15 bg-gold/[0.045] text-[14px] text-gold-light">
              ◇
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-bold uppercase tracking-[0.14em] text-text-dim">
                Live Auctions
              </span>
              <span className="mt-0.5 block font-mono text-[18px] font-bold leading-none tabular-nums text-gold-bright group-hover:text-gold-light">
                {activeAuctionCount}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenMembers}
            className="group flex min-w-0 items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold/60 sm:px-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/15 bg-gold/[0.045] text-[14px] text-gold-light">
              ♟
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-bold uppercase tracking-[0.14em] text-text-dim">
                Members
              </span>
              <span className="mt-0.5 block font-mono text-[18px] font-bold leading-none tabular-nums text-text-bright group-hover:text-gold-light">
                {memberCount}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenCalendar}
            aria-label={`Open Clan Calendar — ${nextEvent?.name || 'Next Event'}`}
            className="group flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-gold/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold/60 sm:px-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/15 bg-gold/[0.045] text-[11px] text-gold-light transition-all group-hover:border-gold/35 group-hover:bg-gold/[0.07] group-hover:text-gold-bright">
              →
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-bold uppercase tracking-[0.14em] text-gold-dim">
                Next Event
              </span>

              {nextEvent && nextEventTimes ? (
                <>
                  <span className="mt-0.5 block truncate text-[14px] font-semibold leading-tight text-text-bright group-hover:text-gold-light">
                    {nextEvent.name}
                  </span>

                  <span className="mt-1 block truncate font-mono text-[10px] leading-none text-gold-light/85">
                    {nextEventTimes.localTime} · {nextEventTimes.localDay}
                  </span>
                </>
              ) : (
                <span className="mt-0.5 block text-[10px] text-text-dim">
                  No event scheduled
                </span>
              )}
            </span>

            <span
              className="hidden shrink-0 pr-1 text-[13px] text-text-dim/40 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-light sm:block"
              aria-hidden="true"
            >
              →
            </span>
          </button>
        </div>
      </div>
    </section>
  )
})

/* ── Upcoming Event Preview ────────────────────────────────────────── */

const UpcomingEventPreview = React.memo(function UpcomingEventPreview({ onOpenCalendar }) {
  const now = useNow()

  const next = useMemo(() => {
    let best = null
    for (const ev of ALL_EVENTS) {
      const nextTs = nextOccurrenceInZone(ev.dow, ev.time, now, SERVER_TZ)
      if (!best || nextTs < best.nextTs) best = { ...ev, nextTs }
    }
    return best
  }, [now])

  if (!next) return null

  const type = TYPE[next.type]
  const remaining = Math.max(0, next.nextTs - now)
  const localEq = formatInAutoLocalZone(next.nextTs)
  const urgent = remaining > 0 && remaining < URGENT_MS

  return (
    <section aria-label="Upcoming clan event" className="relative">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2 sm:mb-3.5 sm:gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-bright shadow-[0_0_8px_rgba(242,204,96,0.65)]"
              aria-hidden="true"
            />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-dim">
              Next Event
            </span>
          </div>
          <h2 className="font-spectral text-[1.45rem] font-bold leading-none text-text-bright sm:text-[1.7rem]">
            Upcoming Clan Event
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenCalendar}
          className="shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-text-dim transition-colors hover:bg-white/[0.035] hover:text-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
        >
          View Calendar <span aria-hidden="true">→</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenCalendar}
        aria-label={`Open Clan Calendar — ${next.name}, ${to12h(next.time)} server time`}
        className="group relative block w-full min-w-0 cursor-pointer overflow-hidden rounded-xl border border-white/[0.07] bg-[#090807]/80 text-left shadow-[0_12px_34px_rgba(0,0,0,0.16)] transition-all duration-200 hover:border-gold/20 hover:bg-[#0c0b09] hover:shadow-[0_16px_38px_rgba(0,0,0,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
      >
        <div
          className="absolute inset-y-0 left-0 w-[3px] transition-all duration-200 group-hover:w-[4px]"
          style={{ background: type.color, boxShadow: `0 0 16px ${type.color}35` }}
          aria-hidden="true"
        />

        <div className="flex min-w-0 flex-col gap-3 px-3.5 py-3.5 sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-4.5">
          <div className="flex min-w-0 items-start gap-3 sm:contents">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-base transition-colors duration-200 group-hover:brightness-110 sm:h-12 sm:w-12 sm:text-lg"
              style={{
                color: type.color,
                borderColor: `${type.color}35`,
                background: `${type.color}0d`,
              }}
              aria-hidden="true"
            >
              {type.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="shrink-0 text-[9px] font-bold uppercase tracking-[0.13em] sm:text-[10px] sm:tracking-[0.16em]"
                  style={{ color: type.color }}
                >
                  {type.label}
                </span>
                <span className="truncate text-[9px] text-text-dim sm:text-[10px]">
                  {DAY_NAMES[next.dow].slice(0, 3)} · {to12h(next.time)}
                </span>
              </div>

              <div className="mt-0.5 truncate text-[15px] font-semibold text-text-bright transition-colors group-hover:text-gold-light sm:text-[14px]">
                {next.name}
              </div>

              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-text-dim sm:text-[11px]">
                {next.boss && (
                  <span className="truncate">👾 {next.boss}</span>
                )}
                {localEq && (
                  <>
                    {next.boss && <span className="text-white/15">·</span>}
                    <span className="truncate text-gold-light/80">
                      {localEq.day.slice(0, 3)} {localEq.time} your time
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] pt-2.5 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 sm:text-right">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-dim sm:text-[11px] sm:tracking-[0.14em]">
              Starts in
            </div>
            <div
              className={`whitespace-nowrap font-mono text-[17px] font-bold leading-none tabular-nums sm:text-[17px] ${
                urgent ? 'motion-safe:animate-pulse' : ''
              }`}
              style={{ color: urgent ? '#f87171' : type.color }}
            >
              {formatCountdown(remaining)}
            </div>
          </div>
        </div>
      </button>
    </section>
  )
})

/* ── Live Auctions ─────────────────────────────────────────────────── */

const LiveAuctionsStrip = React.memo(function LiveAuctionsStrip({
  auctions, totalCount, onOpenAll, currentUser,
}) {
  const now = useNow()
  if (totalCount === 0) return null

  const visibleAuctions = auctions.slice(0, 3)
  const remainingCount = Math.max(0, totalCount - visibleAuctions.length)
  const single = visibleAuctions.length === 1

  return (
    <section className="relative min-w-0" aria-label="Live auctions">
      <div className="mb-2.5 flex min-w-0 items-end justify-between gap-2 sm:mb-3 sm:gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.7)]" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-dim">Market</span>
            <span className="rounded-full border border-red-400/20 bg-red-400/[0.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-red-300">
              {totalCount} Active
            </span>
          </div>
          <h2 className="font-spectral text-[1.65rem] font-bold leading-none text-text-bright sm:text-[2.15rem]">
            Live Auctions
          </h2>
        </div>
        <button type="button" onClick={onOpenAll}
          className="shrink-0 rounded-lg px-1.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-text-dim sm:px-2.5 sm:py-2 sm:text-[10px] sm:tracking-[0.14em] transition-colors hover:bg-white/[0.035] hover:text-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60">
          View Market <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className={single ? 'grid min-w-0' : 'grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-3'}>
        {visibleAuctions.map(a => (
          <LiveAuctionCard key={a.id} auction={a} now={now}
            currentUserName={currentUser?.name} onOpenAll={onOpenAll} wide={single} />
        ))}
      </div>

      {remainingCount > 0 && (
        <button type="button" onClick={onOpenAll}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.018] py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-dim transition-all hover:border-gold/20 hover:bg-gold/[0.025] hover:text-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60">
          +{remainingCount} More {remainingCount === 1 ? 'Auction' : 'Auctions'} <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  )
})

const LiveAuctionCard = React.memo(function LiveAuctionCard({
  auction: a, now, currentUserName, onOpenAll, wide = false,
}) {
  const rarity = RARITY_COLORS[a.rarity] || RARITY_COLORS.epic
  const remaining = Math.max(0, (a.endsAt || 0) - now)
  const isEnding = remaining > 0 && remaining < URGENT_MS
  const timeLabel = formatAuctionTime(remaining)

  // All active clan auctions use blind bidding. The dashboard never exposes
  // another member's identity or current/highest bid. It only shows the
  // number of active bidders, preserving blind-bid privacy.
  // `currentBid` is retained here only as the stored starting-bid display
  // value used by the existing dashboard data shape.
  const startingBid = Number(a.startBid ?? a.minBid ?? a.currentBid ?? 0)

  const bidderCount = getLiveAuctionBidderCount(a)

  const cardLabel =
    `${a.name}, ${a.rarity} rarity, blind auction, starting bid ${startingBid.toLocaleString()} coins, ` +
    `${bidderCount} ${bidderCount === 1 ? 'player' : 'players'} bidding, bid details hidden, ends in ${timeLabel}`

  return (
    <button type="button" onClick={onOpenAll} aria-label={cardLabel}
      className={`group relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.085] bg-[#080706]/95 text-left shadow-[0_14px_38px_rgba(0,0,0,0.26)] transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/20 hover:bg-[#0a0908] hover:shadow-[0_20px_48px_rgba(0,0,0,0.36)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 ${wide ? '' : ''}`}>
      <span className="absolute inset-y-5 left-0 w-[3px] rounded-full"
        style={{ background: rarity.color, boxShadow: `0 0 18px ${rarity.color}55` }} aria-hidden="true" />
      <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 opacity-45"
        style={{ background: `radial-gradient(circle at center, ${rarity.color}12, transparent 68%)` }} aria-hidden="true" />

      {wide ? (
        <div className="relative flex min-w-0 flex-col gap-1.5 p-3 pl-5 sm:flex-row sm:items-center sm:gap-4 sm:p-4 sm:pl-6 lg:gap-5 lg:p-4.5 lg:pl-7">
          <div className="flex min-w-0 items-center gap-2.5 sm:contents">
            <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-lg border bg-black/50 shadow-[0_8px_24px_rgba(0,0,0,0.42)] sm:h-[78px] sm:w-[78px] lg:h-[88px] lg:w-[88px]"
              style={{ borderColor: `${rarity.color}45` }}>
              {a.imageUrl ? (
                <img src={a.imageUrl} alt="" width={104} height={104} loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  onError={(e) => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-spectral text-2xl font-bold sm:text-4xl"
                  style={{ color: rarity.color }} aria-hidden="true">
                  {a.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="absolute inset-0 rounded-xl ring-1 ring-inset"
                style={{ boxShadow: `inset 0 0 28px ${rarity.color}18` }} aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1 sm:min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] sm:px-2 sm:py-1 sm:text-[10px] sm:tracking-[0.16em]"
                  style={{ color: rarity.color, borderColor: `${rarity.color}35`, background: `${rarity.color}0c` }}>
                  {a.rarity}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-gold/20 bg-gold/[0.045] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-gold-light sm:px-2 sm:py-1 sm:text-[9px]">
                  Blind
                </span>
                {isEnding && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-red-400/20 bg-red-400/[0.06] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.07em] text-red-300 sm:gap-1.5 sm:px-2 sm:py-1 sm:text-[9px] sm:tracking-[0.08em]">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 motion-safe:animate-pulse" aria-hidden="true" />
                    Ending Soon
                  </span>
                )}
              </div>

              <div className="mt-0.5 truncate font-spectral text-[1.05rem] font-bold leading-tight sm:mt-1.5 sm:text-[1.4rem] lg:text-[1.6rem]" style={{ color: rarity.color }}>
                {a.name}
              </div>

              <div className="mt-1.5">
                <span className="inline-flex items-center rounded-full border border-gold/25 bg-gold/[.055] px-2.5 py-1 text-[9px] font-bold tracking-wide text-gold-light">
                  <span className="font-mono text-[10px] text-gold-bright">{bidderCount}</span>
                  <span className="ml-1">{bidderCount === 1 ? 'Player Bidding' : 'Players Bidding'}</span>
                </span>
                
              </div>
            </div>
          </div>

          <div className="hidden h-[68px] w-px shrink-0 bg-white/[0.07] lg:block" />

          <div className="grid w-full min-w-0 shrink-0 grid-cols-2 gap-2 sm:w-[280px] sm:gap-2.5 lg:w-[320px] lg:gap-3">
            <div className="min-w-0 rounded-lg border border-gold/10 bg-gold/[0.025] px-3 py-1.5 sm:px-3.5 sm:py-3">
              <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-text-dim sm:text-[9px] sm:tracking-[0.16em]">Starting Bid</div>
              <div className="mt-1 flex min-w-0 items-baseline gap-1 sm:mt-2 sm:gap-1.5">
                <span className="truncate font-mono text-[1.15rem] font-bold leading-none tabular-nums text-gold-bright sm:text-[1.45rem]">
                  {startingBid.toLocaleString()}
                </span>
                <span className="shrink-0 text-[8px] font-semibold uppercase tracking-[0.06em] text-gold-light/55 sm:text-[9px] sm:tracking-[0.08em]">Coins</span>
              </div>
            </div>

            <div className={`min-w-0 rounded-lg border px-3 py-1.5 text-right sm:px-3.5 sm:py-3 ${isEnding ? 'border-red-400/20 bg-red-400/[0.055]' : 'border-white/[0.07] bg-white/[0.018]'}`}>
              <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-text-dim sm:text-[9px] sm:tracking-[0.16em]">Ends In</div>
              <div className={`mt-1 truncate font-mono text-[1.05rem] font-bold leading-none tabular-nums sm:mt-1.5 sm:text-[1.25rem] lg:text-[1.35rem] ${isEnding ? 'motion-safe:animate-pulse' : ''}`}
                style={{ color: isEnding ? '#f87171' : rarity.color }}>
                {timeLabel}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex min-w-0 flex-col p-4 pl-5 sm:p-4.5 sm:pl-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative h-[78px] w-[78px] shrink-0 overflow-hidden rounded-xl border bg-black/50 shadow-[0_7px_20px_rgba(0,0,0,0.38)]"
              style={{ borderColor: `${rarity.color}45` }}>
              {a.imageUrl ? (
                <img src={a.imageUrl} alt="" width={78} height={78} loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  onError={(e) => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-spectral text-3xl font-bold"
                  style={{ color: rarity.color }} aria-hidden="true">
                  {a.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: rarity.color, borderColor: `${rarity.color}35`, background: `${rarity.color}0c` }}>
                  {a.rarity}
                </span>
                <span className="inline-flex rounded-md border border-gold/20 bg-gold/[0.045] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-gold-light">
                  Blind
                </span>
              </div>

              <div className="mt-1.5 truncate font-spectral text-[1.45rem] font-bold leading-tight" style={{ color: rarity.color }}>
                {a.name}
              </div>

              <div className="mt-1.5">
                <span className="inline-flex items-center rounded-full border border-gold/25 bg-gold/[.055] px-2.5 py-1 text-[9px] font-bold tracking-wide text-gold-light">
                  <span className="font-mono text-[10px] text-gold-bright">{bidderCount}</span>
                  <span className="ml-1">{bidderCount === 1 ? 'Player Bidding' : 'Players Bidding'}</span>
                </span>
                
              </div>
            </div>
          </div>

          <div className="my-2.5 border-t border-white/[0.07]" />

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-gold/10 bg-gold/[0.025] px-3 py-2.5">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">Starting Bid</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-[1.35rem] font-bold leading-none tabular-nums text-gold-bright">
                  {startingBid.toLocaleString()}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-gold-light/55">Coins</span>
              </div>
            </div>

            <div className={`rounded-lg border px-3 py-2.5 text-right ${isEnding ? 'border-red-400/20 bg-red-400/[0.055]' : 'border-white/[0.07] bg-white/[0.018]'}`}>
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">Ends In</div>
              <div className={`mt-1 font-mono text-[1.25rem] font-bold leading-none tabular-nums ${isEnding ? 'motion-safe:animate-pulse' : ''}`}
                style={{ color: isEnding ? '#f87171' : rarity.color }}>
                {timeLabel}
              </div>
            </div>
          </div>
        </div>
      )}
    </button>
  )
})

const RecentWinsStrip = React.memo(function RecentWinsStrip({
  endedData, onOpenAll, currentUserName,
}) {
  const now = useNow()
  const cutoff = now - RECENT_WIN_MS

  const wins = useMemo(() => {
    const out = []
    for (const item of endedData) {
      if (item.endedAt >= cutoff && item.endedAt <= now) out.push(item)
      if (out.length >= MAX_RECENT_WINS) break
    }
    return out
  }, [endedData, cutoff, now])

  const winCounts = useMemo(() => {
    const acc = {}
    for (const w of wins) {
      if (w.name) acc[w.name] = (acc[w.name] || 0) + 1
    }
    return acc
  }, [wins])

  if (wins.length === 0) return null

  return (
    <section className="relative" aria-label="Recently won auctions">
      <div className="mb-3 flex min-w-0 items-end justify-between gap-3 sm:mb-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_9px_rgba(242,204,96,0.65)]" aria-hidden="true" />
            <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-text-dim">History</span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-dim">
              Last 7 Days
            </span>
          </div>
          <h2 className="font-spectral text-2xl font-bold leading-none text-text-bright sm:text-[1.7rem]">
            Recently Won
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenAll}
          className="shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-text-dim transition-colors hover:bg-white/[0.035] hover:text-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
        >
          View History <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#090807]/80 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
        <div className="hidden grid-cols-[minmax(250px,1.45fr)_minmax(150px,0.9fr)_130px_92px] items-center gap-4 border-b border-white/[0.06] bg-white/[0.018] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-text-dim md:grid">
          <span>Item</span>
          <span>Winner</span>
          <span>Final Bid</span>
          <span className="text-right">Closed</span>
        </div>

        <div className="divide-y divide-white/[0.055]">
          {wins.map(w => (
            <RecentWinRow
              key={w.auction.id}
              item={w}
              now={now}
              totalWins={winCounts[w.name] || 1}
              currentUserName={currentUserName}
              onOpenAll={onOpenAll}
            />
          ))}
        </div>
      </div>
    </section>
  )
})

const RecentWinRow = React.memo(function RecentWinRow({
  item, now, totalWins, currentUserName, onOpenAll,
}) {
  const { auction: a, name: winnerName, price, endedAt } = item
  const rarity = RARITY_COLORS[a.rarity] || RARITY_COLORS.epic
  const isMe = winnerName && currentUserName === winnerName
  const justEnded = endedAt > 0 && (now - endedAt) < JUST_ENDED_MS
  const agoLabel = formatRelativePast(now - endedAt)
  const hasMultipleWins = totalWins > 1

  const rowLabel =
    `${a.name} won by ${winnerName} for ${price.toLocaleString()} Coins, ${agoLabel}` +
    (hasMultipleWins ? `, ${totalWins} wins in the last 7 days` : '') +
    (isMe ? ', You Won' : '')

  return (
    <button
      type="button"
      onClick={onOpenAll}
      aria-label={rowLabel}
      className={`group relative w-full min-w-0 text-left transition-colors hover:bg-white/[0.022] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold/60 ${
        isMe ? 'bg-green-400/[0.025]' : ''
      }`}
    >
      <span
        className="absolute inset-y-2 left-0 w-[2px] rounded-full"
        style={{ background: isMe ? '#4ade80' : rarity.color }}
        aria-hidden="true"
      />

      {/* Desktop/tablet: true result-table hierarchy. */}
      <div className="hidden min-w-0 grid-cols-[minmax(250px,1.45fr)_minmax(150px,0.9fr)_130px_92px] items-center gap-4 px-4 py-2.5 md:grid">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-black/35">
            {a.imageUrl ? (
              <img
                src={a.imageUrl}
                alt=""
                width={44}
                height={44}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center font-spectral text-base font-bold"
                style={{ color: rarity.color }}
                aria-hidden="true"
              >
                {a.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: rarity.color }}>
                {a.rarity}
              </span>
              {justEnded && (
                <span className="rounded-full border border-gold/20 bg-gold/[0.06] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-gold-light">
                  Just ended
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-[14px] font-semibold text-text-bright">{a.name}</div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`truncate text-[11px] font-medium ${isMe ? 'text-green-300' : 'text-text-bright'}`}>
              {winnerName}
            </span>
            {isMe && (
              <span className="shrink-0 rounded-full border border-green-400/25 bg-green-400/[0.07] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-green-300">
                You Won
              </span>
            )}
          </div>
          {hasMultipleWins && (
            <div className="mt-0.5 text-[8px] text-gold-light/70">{totalWins} wins in last 7 days</div>
          )}
        </div>

        <div>
          <div className="flex items-baseline gap-1 font-mono font-bold tabular-nums">
            <span className="text-[15px] text-gold-bright">{price.toLocaleString()}</span>
            <span className="text-[8px] font-semibold text-gold-light/55">coins</span>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-[10px] font-semibold ${justEnded ? 'text-gold-light' : 'text-text-dim'}`}>
            {justEnded ? 'Just ended' : agoLabel}
          </div>
        </div>
      </div>

      {/* Mobile: same hierarchy, stacked intentionally rather than squeezing table columns. */}
      <div className="flex min-w-0 items-center gap-2.5 px-2.5 py-3 md:hidden">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-black/35">
          {a.imageUrl ? (
            <img
              src={a.imageUrl}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center font-spectral text-lg font-bold"
              style={{ color: rarity.color }}
              aria-hidden="true"
            >
              {a.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.15em]" style={{ color: rarity.color }}>
              {a.rarity}
            </span>
            {isMe && (
              <span className="shrink-0 rounded-full border border-green-400/25 bg-green-400/[0.07] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-green-300">
                You Won
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[16px] font-semibold text-text-bright">{a.name}</div>
          <div className="mt-0.5 truncate text-[11px] text-text-dim">
            Won by <span className={isMe ? 'font-semibold text-green-300' : 'text-text-bright'}>{winnerName}</span>
            {hasMultipleWins ? ` · ${totalWins} wins` : ''}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="flex items-baseline justify-end gap-1 font-mono font-bold tabular-nums">
            <span className="text-[14px] text-gold-bright">{price.toLocaleString()}</span>
            <span className="text-[7px] font-semibold text-gold-light/55">coins</span>
          </div>
          <div className={`mt-1 text-[8px] font-semibold ${justEnded ? 'text-gold-light' : 'text-text-dim'}`}>
            {justEnded ? 'Just ended' : agoLabel}
          </div>
        </div>
      </div>
    </button>
  )
})

/* ── Schedule ──────────────────────────────────────────────────────── */

const ScheduleSection = React.memo(function ScheduleSection({ activeRegion, idPrefix }) {
  const todayDowServer = useTodayDowServer()
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => {
    setSelectedDay(prev => prev ?? todayDowServer)
  }, [todayDowServer])

  const activeDay = selectedDay ?? todayDowServer

  return (
    <section className="relative">
      <div className="flex items-end justify-between mb-3 sm:mb-4 flex-wrap gap-2 sm:gap-3 min-w-0">
        <div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-dim mb-0.5">Clan calendar</div>
            <h2 className="font-spectral text-2xl font-bold text-text-bright">Weekly Schedule</h2>
          <div className="mt-1 text-[10px] text-text-dim">
            Server schedule is authoritative · Your Time updates automatically from your browser/device timezone.
          </div>
          </div>
          <p className="text-text-dim text-sm mt-1 flex items-center gap-2 flex-wrap">
             <span>🕒 Server Time · {SERVER_TZ_LABEL}</span>
             <span className="text-text-dim/50">·</span>
             <span className="inline-flex items-center gap-1.5">
               <span>Your Time:</span>
               <span className="text-gold-light font-semibold">{AUTO_LOCAL_TZ}</span>
               <span className="text-text-dim">{getLocalZoneLabel()}</span>
             </span>
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-4 flex-wrap">
          {Object.entries(TYPE).map(([k, t]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-text-dim">
              <span aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      <NextEventCard activeRegion={activeRegion} />

      <WeeklyEventTabs
        todayDow={todayDowServer}
        activeDay={activeDay}
        onSelect={setSelectedDay}
        activeRegion={activeRegion}
        idPrefix={idPrefix}
      />
    </section>
  )
})

function useTodayDowServer() {
  const now = useNow(60_000)
  return useMemo(() => getZoneParts(now, SERVER_TZ).dow, [now])
}

const NextEventCard = React.memo(function NextEventCard({ activeRegion }) {
  const now = useNow()

  const next = useMemo(() => {
    let best = null
    for (const ev of ALL_EVENTS) {
      const nextTs = nextOccurrenceInZone(ev.dow, ev.time, now, SERVER_TZ)
      if (!best || nextTs < best.nextTs) best = { ...ev, nextTs }
    }
    return best
  }, [now])

  if (!next) return null

  const t = TYPE[next.type]
  const remaining = next.nextTs - now
  const urgent = remaining > 0 && remaining < URGENT_MS
  const progress = Math.min(1, Math.max(0, 1 - remaining / WEEK_MS))

  const localEq = formatInAutoLocalZone(next.nextTs)

  return (
    <div className="relative w-full min-w-0 rounded-2xl border border-gold/15 bg-[#0b0a09]/85 overflow-hidden mb-3 shadow-[0_14px_40px_rgba(0,0,0,0.2)]">
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{ background: `radial-gradient(circle at 0% 0%, ${t.color}, transparent 60%)` }}
        aria-hidden="true"
      />

      <div className="relative grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-2.5 p-3 sm:flex sm:items-center sm:gap-4 sm:p-4 md:p-5">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-black/20 text-lg sm:h-12 sm:w-12 sm:rounded-2xl sm:text-2xl"
          style={{ background: `${t.color}15`, border: `1px solid ${t.color}40` }}
          aria-hidden="true"
        >
          {t.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: t.color }}>
            Coming Up Next
          </div>
          <div className="font-spectral text-base sm:text-lg md:text-xl font-bold text-text-bright leading-tight break-words">
            {next.name}
          </div>
          <div className="flex items-center gap-x-2 gap-y-1 mt-1 text-[10px] sm:text-sm text-text-dim flex-wrap min-w-0">
            {next.boss && <span className="truncate max-w-full">👾 {next.boss}</span>}
            <span className="font-mono tabular-nums whitespace-nowrap">
              {DAY_NAMES[next.dow].slice(0, 3)} · {to12h(next.time)} · server
            </span>
            {localEq && (
               <span className="text-gold-light/80 tabular-nums whitespace-nowrap inline-flex items-center gap-1">
                 <span className="text-gold-light">●</span>
                 <span>{localEq.day.slice(0, 3)} {localEq.time} your time</span>
               </span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-shrink-0 text-right">
          <div className="text-[10px] text-text-dim font-semibold uppercase tracking-wider mb-0.5 whitespace-nowrap">
            Starts In
          </div>
          <div
            className={`font-mono text-2xl sm:text-2xl md:text-3xl font-bold tabular-nums leading-none whitespace-nowrap ${urgent ? 'motion-safe:animate-pulse' : ''}`}
            style={{ color: t.color }}
          >
            {formatCountdown(remaining)}
          </div>
        </div>
      </div>

      <div className="h-1 bg-void/60" role="presentation">
        <div
          className="h-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress * 100}%`, background: t.color }}
        />
      </div>
    </div>
  )
})

const WeeklyEventTabs = React.memo(function WeeklyEventTabs({
  todayDow, activeDay, onSelect, activeRegion, idPrefix,
}) {
  const tabRefs = useRef({})

  const moveSelection = useCallback((fromDow, step) => {
    const idx = DAY_ORDER.indexOf(fromDow)
    const nextIdx = (idx + step + DAY_ORDER.length) % DAY_ORDER.length
    const nextDow = DAY_ORDER[nextIdx]
    onSelect(nextDow)
    tabRefs.current[nextDow]?.focus()
  }, [onSelect])

  const handleKeyDown = useCallback((e, dow) => {
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); moveSelection(dow, 1); break
      case 'ArrowLeft': e.preventDefault(); moveSelection(dow, -1); break
      case 'Home': e.preventDefault(); onSelect(DAY_ORDER[0]); tabRefs.current[DAY_ORDER[0]]?.focus(); break
      case 'End': e.preventDefault(); onSelect(DAY_ORDER[DAY_ORDER.length - 1]); tabRefs.current[DAY_ORDER[DAY_ORDER.length - 1]]?.focus(); break
      default: break
    }
  }, [moveSelection, onSelect])

  const events = SCHEDULE_BY_DAY[activeDay] || []
  const panelId = `${idPrefix}-panel`

  return (
    <div className="w-full min-w-0 rounded-2xl border border-gold/15 bg-[#0b0a09]/70 overflow-hidden shadow-[0_12px_35px_rgba(0,0,0,0.18)]">
      <div
        role="tablist"
        aria-label="Day Of The Week (Server Time)"
        className="grid grid-cols-7 overflow-hidden border-b border-white/[0.06] bg-black/20"
      >
        {DAY_ORDER.map(dow => {
          const isActive = dow === activeDay
          const isToday = dow === todayDow
          const count = (SCHEDULE_BY_DAY[dow] || []).length
          const tabId = `${idPrefix}-tab-${dow}`
          return (
            <button
              key={dow}
              ref={el => { tabRefs.current[dow] = el }}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(dow)}
              onKeyDown={e => handleKeyDown(e, dow)}
              className={`relative min-w-0 flex flex-col items-center gap-0.5 px-0.5 sm:px-3 py-2.5 sm:py-3 text-[11px] sm:text-base font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 focus-visible:-outline-offset-2 ${
                isActive ? 'text-gold-bright' : 'text-text-dim hover:text-text-bright'
              }`}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {DAY_SHORT[dow]}
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-gold-bright" aria-label="Today" />}
              </span>
              <span className="text-[10px] font-mono tabular-nums text-text-dim whitespace-nowrap">
                {count} {count === 1 ? 'evt' : 'evts'}
              </span>
              {isActive && (
                <span className="absolute left-2 right-2 bottom-0 h-[2px] bg-gold-bright rounded-full" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${activeDay}`}
        tabIndex={0}
        className="p-2.5 sm:p-3 md:p-4 space-y-2 sm:space-y-2.5 min-w-0"
      >
        {events.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-text-dim italic">
            Nothing Scheduled For {DAY_NAMES[activeDay]}.
          </div>
        ) : (
          events.map((ev, i) => (
            <EventRow
              key={`${ev.time}-${i}`}
              ev={ev}
              dow={activeDay}
              activeRegion={activeRegion}
            />
          ))
        )}
      </div>
    </div>
  )
})

const EventRow = React.memo(function EventRow({ ev, dow, activeRegion }) {
  const now = useNow()
  const t = TYPE[ev.type]

  const startTs = useMemo(
    () => nextOccurrenceInZone(dow, ev.time, now, SERVER_TZ),
    [dow, ev.time, now]
  )
  const countdown = formatCountdown(startTs - now)
  const localEq = formatInAutoLocalZone(startTs)

  return (
    <div className="rounded-xl bg-black/20 border border-white/[0.06] p-3 sm:p-0 sm:px-3.5 sm:py-3 hover:border-gold/25 hover:bg-gold/[0.025] transition-all">
      <div className="sm:hidden">
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg"
            style={{ background: `${t.color}10`, border: `1px solid ${t.color}25` }}
            aria-hidden="true"
          >
            {t.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] sm:text-base font-semibold text-text-bright leading-snug break-words">
              {ev.name}
            </div>
            {(ev.boss || ev.subtitle) && (
              <div className="text-[11px] sm:text-sm text-text-dim mt-0.5 leading-snug">
                {ev.boss ? `👾 ${ev.boss}` : ev.subtitle}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-gold/10 pt-2">
          <div className="min-w-0">
            <span
              className="font-mono font-bold text-sm tabular-nums leading-none whitespace-nowrap"
              style={{ color: t.color }}
            >
              {to12h(ev.time)}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1 sm:text-right flex-shrink-0 pt-2 sm:pt-0 border-t border-white/[0.06] sm:border-0 min-w-0">
            <div className="text-[9px] sm:text-[10px] text-text-dim leading-none">Starts In</div>
            <div className="font-mono text-[11px] sm:text-sm text-gold-light tabular-nums mt-0.5 leading-none whitespace-nowrap">
              {countdown}
            </div>
          </div>
        </div>

        {localEq && (
           <div className="mt-1.5 text-[10px] text-gold-light/70 tabular-nums flex items-center gap-1.5">
             <span className="text-gold-light">●</span>
             <span>{localEq.day.slice(0, 3)} {localEq.time} Your Time · {getLocalZoneLabel()}</span>
           </div>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-3">
        <div className="flex-shrink-0 w-24 text-center border-r border-gold/15 pr-3">
          <div className="font-mono font-bold text-sm tabular-nums leading-tight whitespace-nowrap" style={{ color: t.color }}>
            {to12h(ev.time)}
          </div>
        </div>

        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg"
          style={{ background: `${t.color}10`, border: `1px solid ${t.color}25` }}
          aria-hidden="true"
        >
          {t.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="break-words text-[15px] font-semibold leading-tight text-text-bright sm:text-base">{ev.name}</div>
          {(ev.boss || ev.subtitle) && (
            <div className="text-xs text-text-dim truncate mt-0.5">
              {ev.boss ? `👾 ${ev.boss}` : ev.subtitle}
            </div>
          )}
          {localEq && (
            <div className="text-[10px] text-gold-light/70 tabular-nums mt-0.5 flex items-center gap-1.5">
              <span className="text-gold-light">●</span>
              <span>{localEq.day.slice(0, 3)} {localEq.time} · Your Time · {AUTO_LOCAL_TZ}</span>
            </div>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1 sm:text-right flex-shrink-0 pt-2 sm:pt-0 border-t border-white/[0.06] sm:border-0 min-w-0">
          <div className="text-[10px] text-text-dim">Starts In</div>
          <div className="font-mono text-xs text-gold-light tabular-nums mt-0.5 whitespace-nowrap">
            {countdown}
          </div>
        </div>
      </div>
    </div>
  )
})

const StatTile = React.memo(function StatTile({
  icon,
  label,
  value,
  accent = '#d6b45b',
  onClick,
}) {
  const clickable = !!onClick
  const Tag = clickable ? 'button' : 'div'

  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`group relative min-w-0 overflow-hidden rounded-xl border bg-[#0a0908]/80 px-3 py-3 sm:px-4 sm:py-3.5 md:px-4 md:py-3.5 text-left transition-all duration-200 ${
        clickable
          ? 'cursor-pointer hover:-translate-y-0.5 hover:bg-[#100e0b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60'
          : ''
      }`}
      style={{
        borderColor: `${accent}22`,
        boxShadow: `inset 0 1px 0 ${accent}08`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full opacity-75"
        style={{ background: accent }}
      />

      <div className="flex items-center gap-3 min-w-0">
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border text-sm font-semibold sm:h-9 sm:w-9 md:h-10 md:w-10 md:text-base"
          style={{
            color: accent,
            borderColor: `${accent}32`,
            background: `linear-gradient(145deg, ${accent}12, transparent)`,
          }}
          aria-hidden="true"
        >
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="break-words text-[8px] leading-tight font-bold uppercase tracking-[0.10em] text-text-dim sm:text-[9px] sm:tracking-[0.14em] md:text-[10px]">
            {label}
          </div>
          <div className="mt-1 break-words font-mono text-lg font-bold leading-none tracking-tight tabular-nums text-text-bright sm:text-xl md:text-2xl">
            {value}
          </div>
        </div>

        {clickable && (
          <span
            className="hidden sm:block text-[9px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: accent }}
          >
            Open
          </span>
        )}
      </div>
    </Tag>
  )
})

const ActionTile = React.memo(function ActionTile({ icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-[#0b0a09]/70 px-4 py-3.5 sm:gap-3.5 sm:rounded-2xl sm:px-5 sm:py-4 hover:-translate-y-0.5 hover:border-gold/30 hover:bg-gold/[0.035] hover:shadow-[0_12px_30px_rgba(0,0,0,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 transition-all text-left"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gold/15 bg-gold/[0.05] text-sm text-gold-light opacity-90 sm:h-10 sm:w-10 sm:rounded-xl sm:text-lg group-hover:opacity-100" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <div className="break-words text-[15px] font-semibold leading-tight text-text-bright sm:text-base">{label}</div>
        <div className="mt-0.5 break-words text-[12px] leading-tight text-text-dim sm:text-sm">{hint}</div>
      </div>
    </button>
  )
})
