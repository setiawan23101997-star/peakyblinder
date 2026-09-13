import React, { useState, useEffect, useMemo, useCallback, useId, useRef } from 'react'

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
    { time: '20:00', type: 'arena', name: 'Clan Arena Tournament', subtitle: 'See announcement' },
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
const MAX_LIVE_AUCTIONS = 3
const DEBUG_WINS = false

const TYPE = {
  boss:     { color: '#ef4444', icon: '👾', label: 'World Boss' },
  battle:   { color: '#3b82f6', icon: '⚔️', label: 'Server Battle' },
  treasure: { color: '#eab308', icon: '🏝️', label: 'Sindri Island' },
  arena:    { color: '#a855f7', icon: '🏟️', label: 'Arena' },
}

const RARITY_COLORS = {
  material:   { color: '#4ade80', border: 'rgba(74,222,128,0.6)' },
  uncommon:   { color: '#ffffff', border: 'rgba(255,255,255,0.55)' },
  rare:       { color: '#60a5fa', border: 'rgba(96,165,250,0.6)' },
  epic:       { color: '#f87171', border: 'rgba(248,113,113,0.7)' },
  legendary:  { color: '#f2cc60', border: 'rgba(242,204,96,0.75)' },
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const NBSP = '\u00A0'

const SERVER_TZ = 'Asia/Singapore'
const SERVER_TZ_LABEL = 'GMT+8'

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

const TIME_OPTS = { hour: '2-digit', minute: '2-digit', hour12: false }
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
  const time = getDTF('en-GB', { timeZone: tz, ...TIME_OPTS }).format(d)
  const day = getDTF('en-GB', { timeZone: tz, weekday: 'long' }).format(d)
  const date = getDTF('en-GB', { timeZone: tz, ...DATE_OPTS }).format(d)
  return { time, day, date }
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

function getGreeting(hour) {
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
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

  if (!code || failed) {
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
      src={`https://flagcdn.com/w20/${code}.png`}
      srcSet={`https://flagcdn.com/w20/${code}.png 1x, https://flagcdn.com/w40/${code}.png 2x`}
      width={width}
      height={height}
      alt={name ? `${name} flag` : ''}
      loading="lazy"
      decoding="async"
      className="rounded-[2px] border border-gold/20 object-cover flex-shrink-0"
      style={{ width, height }}
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
  const idPrefix = useId()

  const activeRegion = useMemo(() => {
    if (!region) return DEFAULT_REGION
    return {
      ...region,
      code: region.code || region.id,
      flag: region.flag || '',
      name: region.name || region.label || region.id,
      label: region.label || '',
    }
  }, [region])

  const isAdmin = currentUser?.role === 'Admin'
  const isElder = isAdmin || currentUser?.role === 'Elder' || currentUser?.role === 'Master'

  const { visibleMembers, totalCoins, totalPower } = useMemo(() => {
    const visible = isAdmin ? members : members.filter(m => m.role !== 'Admin')
    let coins = 0
    let power = 0
    for (const m of visible) {
      coins += m.coins
      power += m.power
    }
    return { visibleMembers: visible, totalCoins: coins, totalPower: power }
  }, [members, isAdmin])

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

  return (
    <div className="space-y-6 pb-8">
      <HeroSection
        currentUser={currentUser}
        activeRegion={activeRegion}
        setPage={setPage}
        isElder={isElder}
        goAttendance={goAttendance}
        goAuctions={goAuctions}
        goMembers={goMembers}
      />

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

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon="👥" label="Warriors" value={visibleMembers.length} />
        <StatTile icon="🪙" label="Coins in play" value={totalCoins.toLocaleString()} />
        <StatTile icon="⚔️" label="Total power" value={totalPower.toLocaleString()} />
        <StatTile icon="🔨" label="Live auctions" value={totalActiveAuctions} onClick={goAuctions} />
      </section>

      <ScheduleSection activeRegion={activeRegion} idPrefix={idPrefix} />
    </div>
  )
}

/* ── Hero ──────────────────────────────────────────────────────────── */

const HeroSection = React.memo(function HeroSection({
  currentUser, activeRegion, isElder,
  goAttendance, goAuctions, goMembers,
}) {
  const now = useNow()

  const serverClock = useMemo(() => formatInZone(now, SERVER_TZ), [now])
  const localClock = useMemo(() => formatInZone(now, activeRegion.tz), [now, activeRegion.tz])
  const serverSec = useMemo(
    () => String(getZoneParts(now, SERVER_TZ).ss).padStart(2, '0'),
    [now]
  )
  const todayDowServer = useMemo(() => getZoneParts(now, SERVER_TZ).dow, [now])
  const todayEvents = SCHEDULE_BY_DAY[todayDowServer] || []

  const greeting = getGreeting(getZoneParts(now, activeRegion.tz).hh)
  const firstName = currentUser?.name?.split(' ')[0] || 'Warrior'

  return (
    <>
      <section className="relative rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.06] via-transparent to-transparent overflow-hidden">
        <div className="p-4 md:p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-center">
          <div className="min-w-0">
            <h1 className="font-spectral text-2xl md:text-3xl font-bold leading-tight truncate">
              <span className="text-text-bright">{greeting}, </span>
              <span className="text-gold-bright">{firstName}</span>
            </h1>
            <p className="text-text-dim text-sm mt-1.5 truncate">
              {todayEvents.length > 0
                ? <>{todayEvents.length} {todayEvents.length === 1 ? 'event' : 'events'} today — first at{' '}
                    <span className="text-gold-light font-semibold font-mono whitespace-nowrap">{to12h(todayEvents[0].time)}</span>
                    {' '}server time.</>
                : <>Nothing scheduled today.</>}
            </p>
          </div>

          <div className="flex flex-wrap items-stretch gap-2">
            <div className="rounded-lg border border-gold/25 bg-void/60 px-3 py-2 min-w-[150px]">
              <div className="text-[10px] text-gold-dim font-semibold uppercase tracking-wider">
                Server · {SERVER_TZ_LABEL}
              </div>
              <div className="font-mono tabular-nums leading-none text-gold-bright whitespace-nowrap mt-0.5">
                <span className="text-xl md:text-2xl">
                  {serverClock.time.slice(0, 5)}
                </span>
                <span className="text-xs text-gold-light/60 ml-0.5">
                  :{serverSec}
                </span>
              </div>
              <div className="text-[10px] text-text-dim mt-1 whitespace-nowrap">
                {serverClock.day.slice(0, 3)} · {serverClock.date}
              </div>
            </div>

            <div className="rounded-lg border border-gold/25 bg-void/60 px-3 py-2 min-w-[150px]">
              <div className="text-[10px] text-gold-dim font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span>Local · {activeRegion.label}</span>
              </div>
              <div className="font-mono tabular-nums leading-none text-gold-bright whitespace-nowrap mt-0.5">
                <span className="text-xl md:text-2xl">{localClock.time}</span>
              </div>
              <div className="text-[10px] text-text-dim mt-1 whitespace-nowrap flex items-center gap-1.5">
                <FlagImage
                  code={activeRegion.code}
                  flag={activeRegion.flag}
                  name={activeRegion.name}
                  width={14}
                  height={10}
                />
                <span className="truncate">{activeRegion.name}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ActionTile icon="📋" label="Attendance" hint={isElder ? 'Record & award coins' : 'View attendance history'} onClick={goAttendance} />
        <ActionTile icon="🔨" label="Auctions" hint="Bid on clan items" onClick={goAuctions} />
        <ActionTile icon="👥" label={isElder ? 'Manage members' : 'View members'} hint={isElder ? 'Add, edit & remove' : 'See clan roster'} onClick={goMembers} />
      </section>
    </>
  )
})

/* ── Live auctions ─────────────────────────────────────────────────── */

const LiveAuctionsStrip = React.memo(function LiveAuctionsStrip({
  auctions, totalCount, onOpenAll, currentUser,
}) {
  const now = useNow()
  if (totalCount === 0) return null

  return (
    <section>
      <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-spectral text-xl font-bold text-text-bright">Live auctions</h2>
          <span className="text-[11px] font-semibold text-gold-bright bg-gold/15 border border-gold/40 rounded px-2 py-0.5">
            {totalCount} active
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenAll}
          className="text-xs font-semibold text-gold-light hover:text-gold-bright transition-colors"
        >
          View all →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {auctions.map(a => (
          <LiveAuctionCard
            key={a.id}
            auction={a}
            now={now}
            currentUserName={currentUser?.name}
            onOpenAll={onOpenAll}
          />
        ))}
      </div>

      {totalCount > auctions.length && (
        <p className="mt-3 w-full text-center text-xs text-text-dim py-2">
          and {totalCount - auctions.length} more {totalCount - auctions.length === 1 ? 'auction' : 'auctions'}
        </p>
      )}
    </section>
  )
})

const LiveAuctionCard = React.memo(function LiveAuctionCard({
  auction: a, now, currentUserName, onOpenAll,
}) {
  const rarity = RARITY_COLORS[a.rarity] || RARITY_COLORS.epic
  const remaining = (a.endsAt || 0) - now
  const isEnding = remaining > 0 && remaining < URGENT_MS
  const isLeading = a.topBidder && currentUserName === a.topBidder
  const timeLabel = formatAuctionTime(remaining)
  const cardLabel = `${a.name}, ${a.rarity} rarity, current bid ${(a.currentBid || 0).toLocaleString()}` +
    (a.topBidder ? `, top bidder ${a.topBidder}` : ', no bids yet') +
    `, ends in ${timeLabel}`

  return (
    <button
      type="button"
      onClick={onOpenAll}
      aria-label={cardLabel}
      className="group text-left rounded-xl border bg-void/40 p-3 flex gap-3 transition-colors hover:bg-gold/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
      style={{ borderColor: isLeading ? 'rgba(34,197,94,0.5)' : rarity.border }}
    >
      <div className="flex-shrink-0">
        {a.imageUrl ? (
          <img
            src={a.imageUrl}
            alt=""
            width={64}
            height={64}
            loading="lazy"
            className="rounded-lg border border-gold/25 object-cover bg-void/60"
            style={{ width: 64, height: 64 }}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div
            className="rounded-lg border flex items-center justify-center font-spectral font-bold"
            style={{
              width: 64, height: 64,
              borderColor: rarity.border,
              backgroundColor: `${rarity.color}15`,
              color: rarity.color,
              fontSize: 22,
            }}
            aria-hidden="true"
          >
            {a.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 flex flex-col">
        {/* Top row: rarity + countdown */}
        <div className="flex items-center justify-between gap-2 mb-1" aria-hidden="true">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: rarity.color }}>
            {a.rarity}
          </span>
          <span className={`text-[10px] font-mono tabular-nums font-semibold whitespace-nowrap ${
            isEnding ? 'text-red-400 motion-safe:animate-pulse' : 'text-text-dim'
          }`}>
            Ends in {timeLabel}
          </span>
        </div>

        <div className="text-sm font-semibold truncate mb-1.5" style={{ color: rarity.color }} aria-hidden="true">
          {a.name}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2 border-t border-gold/10" aria-hidden="true">
          <div className="min-w-0">
            <div className="text-[10px] text-text-dim leading-none">Top bid</div>
            <div className="font-mono text-base font-bold text-gold-bright tabular-nums leading-tight mt-1">
              {(a.currentBid || 0).toLocaleString()}
            </div>
          </div>
          <div className="text-right min-w-0">
            <div className="text-[10px] text-text-dim leading-none">Bidder</div>
            <div className={`text-xs font-semibold truncate mt-1 ${isLeading ? 'text-green-400' : 'text-text-bright'}`}>
              {a.topBidder || '—'}
            </div>
          </div>
        </div>

        {isLeading && (
          <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-green-400" aria-hidden="true">
            ✓ You're leading
          </div>
        )}
      </div>
    </button>
  )
})

/* ── Recently won ──────────────────────────────────────────────────── */

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
    <section>
      <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-spectral text-xl font-bold text-text-bright">Recently won</h2>
          <span className="text-[11px] font-semibold text-green-400 bg-green-500/10 border border-green-500/40 rounded px-2 py-0.5">
            last 7 days
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenAll}
          className="text-xs font-semibold text-gold-light hover:text-gold-bright transition-colors"
        >
          View history →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {wins.map(w => (
          <RecentWinCard
            key={w.auction.id}
            item={w}
            now={now}
            totalWins={winCounts[w.name] || 1}
            currentUserName={currentUserName}
            onOpenAll={onOpenAll}
          />
        ))}
      </div>
    </section>
  )
})

const RecentWinCard = React.memo(function RecentWinCard({
  item, now, totalWins, currentUserName, onOpenAll,
}) {
  const { auction: a, name: winnerName, price, endedAt } = item
  const rarity = RARITY_COLORS[a.rarity] || RARITY_COLORS.epic
  const isMe = winnerName && currentUserName === winnerName
  const justEnded = endedAt > 0 && (now - endedAt) < JUST_ENDED_MS
  const agoLabel = formatRelativePast(now - endedAt)
  const hasMultipleWins = totalWins > 1
  const cardLabel = `${a.name} won by ${winnerName} for ${price.toLocaleString()} coins, ${agoLabel}` +
    (hasMultipleWins ? ` (${totalWins} wins in the last 7 days)` : '') +
    (isMe ? '. Congratulations!' : '') +
    (justEnded ? ' Just ended.' : '')

  return (
    <button
      type="button"
      onClick={onOpenAll}
      aria-label={cardLabel}
      className={`group relative text-left rounded-xl border p-3 flex gap-3 transition-colors hover:bg-gold/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 ${
        isMe ? 'bg-green-500/[0.06]' : 'bg-void/40'
      }`}
      style={{
        borderColor: isMe ? 'rgba(34,197,94,0.55)' : rarity.border,
        boxShadow: isMe ? '0 0 0 1px rgba(34,197,94,0.15), 0 0 24px -8px rgba(34,197,94,0.35)' : undefined,
      }}
    >
      {justEnded && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl motion-safe:animate-pulse"
          style={{ boxShadow: '0 0 0 1px rgba(242,204,96,0.45), 0 0 22px -4px rgba(242,204,96,0.55)' }}
        />
      )}

      <div className="flex-shrink-0">
        {a.imageUrl ? (
          <img
            src={a.imageUrl}
            alt=""
            width={64}
            height={64}
            loading="lazy"
            className="rounded-lg border border-gold/25 object-cover bg-void/60"
            style={{ width: 64, height: 64 }}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div
            className="rounded-lg border flex items-center justify-center font-spectral font-bold"
            style={{
              width: 64, height: 64,
              borderColor: rarity.border,
              backgroundColor: `${rarity.color}15`,
              color: rarity.color,
              fontSize: 22,
            }}
            aria-hidden="true"
          >
            {a.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-1" aria-hidden="true">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: rarity.color }}>
            {a.rarity}
          </span>
          <span className="text-[11px] font-mono tabular-nums font-semibold text-text-dim whitespace-nowrap">
            {justEnded ? 'Just ended' : agoLabel}
          </span>
        </div>

        <div className="text-sm font-semibold truncate mb-1.5" style={{ color: rarity.color }} aria-hidden="true">
          {a.name}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2 border-t border-gold/10" aria-hidden="true">
          <div className="min-w-0">
            <div className="text-[10px] text-text-dim leading-none">Final price</div>
            <div className="font-mono text-base font-bold text-gold-bright tabular-nums leading-tight mt-1">
              {price.toLocaleString()}
            </div>
          </div>
          <div className="text-right min-w-0">
            <div className="text-[10px] text-text-dim leading-none">Won by</div>
            <div className={`text-xs font-semibold truncate mt-1 ${isMe ? 'text-green-400' : 'text-text-bright'}`}>
              {winnerName}
            </div>
            {hasMultipleWins && (
              <div className="text-[10px] text-gold-light mt-0.5">
                {totalWins} wins this week
              </div>
            )}
          </div>
        </div>

        <div
          className={`mt-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
            isMe ? 'text-green-400' : 'text-text-dim'
          }`}
          aria-hidden="true"
        >
          <span>{isMe ? '🎉' : '🏆'}</span>
          <span className="truncate">{isMe ? 'Congratulations!' : 'Sold'}</span>
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
    <section>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-spectral text-2xl font-bold text-text-bright">Weekly schedule</h2>
          <p className="text-text-dim text-sm mt-1 flex items-center gap-2 flex-wrap">
            <span>🕒 Server time · {SERVER_TZ_LABEL}</span>
            {activeRegion.id !== 'ph' && (
              <>
                <span className="text-text-dim/50">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span>Local:</span>
                  <FlagImage
                    code={activeRegion.code}
                    flag={activeRegion.flag}
                    name={activeRegion.name}
                    width={16}
                    height={12}
                  />
                  <span className="text-gold-light font-semibold">{activeRegion.name}</span>
                  <span className="text-text-dim">{activeRegion.label}</span>
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
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

  const localEq = formatInZone(next.nextTs, activeRegion.tz)

  return (
    <div className="relative rounded-2xl border border-gold/25 overflow-hidden mb-3">
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{ background: `radial-gradient(circle at 0% 0%, ${t.color}, transparent 60%)` }}
        aria-hidden="true"
      />

      <div className="relative p-4 flex items-center gap-4 flex-wrap">
        <div
          className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: `${t.color}15`, border: `1px solid ${t.color}40` }}
          aria-hidden="true"
        >
          {t.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: t.color }}>
            Coming up next
          </div>
          <div className="font-spectral text-lg md:text-xl font-bold text-text-bright leading-tight truncate">
            {next.name}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-text-dim flex-wrap">
            {next.boss && <span className="truncate">👾 {next.boss}</span>}
            <span className="font-mono tabular-nums whitespace-nowrap">
              {DAY_NAMES[next.dow].slice(0, 3)} · {to12h(next.time)} · server
            </span>
            {activeRegion.label && localEq && (
              <span className="text-gold-light/80 tabular-nums whitespace-nowrap inline-flex items-center gap-1">
                <FlagImage
                  code={activeRegion.code}
                  flag={activeRegion.flag}
                  name={activeRegion.name}
                  width={14}
                  height={10}
                />
                <span>{localEq.day.slice(0, 3)} {localEq.time} local</span>
              </span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-text-dim font-semibold uppercase tracking-wider mb-0.5 whitespace-nowrap">
            Starts in
          </div>
          <div
            className={`font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none whitespace-nowrap ${urgent ? 'motion-safe:animate-pulse' : ''}`}
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
    <div className="rounded-xl border border-gold/15 bg-void/30 overflow-hidden">
      <div
        role="tablist"
        aria-label="Day of the week (server time)"
        className="flex overflow-x-auto no-scrollbar border-b border-gold/10"
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
              className={`relative flex-1 min-w-[64px] sm:min-w-[76px] flex flex-col items-center gap-0.5 px-2 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 focus-visible:-outline-offset-2 ${
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
        className="p-2.5 space-y-2"
      >
        {events.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-text-dim italic">
            Nothing scheduled for {DAY_NAMES[activeDay]}.
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
  const localEq = formatInZone(startTs, activeRegion.tz)

  return (
    <div className="rounded-lg bg-void/50 border border-gold/10 p-3 sm:p-0 sm:px-3 sm:py-2.5 hover:border-gold/25 transition-colors">
      <div className="sm:hidden">
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg"
            style={{ background: `${t.color}10`, border: `1px solid ${t.color}25` }}
            aria-hidden="true"
          >
            {t.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text-bright leading-snug">
              {ev.name}
            </div>
            {(ev.boss || ev.subtitle) && (
              <div className="text-xs text-text-dim mt-0.5 leading-snug">
                {ev.boss ? `👾 ${ev.boss}` : ev.subtitle}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-gold/10 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="font-mono font-bold text-sm tabular-nums leading-none whitespace-nowrap"
              style={{ color: t.color }}
            >
              {ev.time}
            </span>
            <span className="text-[11px] text-text-dim font-mono tabular-nums whitespace-nowrap">
              {to12h(ev.time)}
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] text-text-dim leading-none">Starts in</div>
            <div className="font-mono text-xs text-gold-light tabular-nums mt-0.5 leading-none whitespace-nowrap">
              {countdown}
            </div>
          </div>
        </div>

        {activeRegion.label && localEq && (
          <div className="mt-1.5 text-[10px] text-gold-light/70 tabular-nums flex items-center gap-1.5">
            <FlagImage
              code={activeRegion.code}
              flag={activeRegion.flag}
              name={activeRegion.name}
              width={14}
              height={10}
            />
            <span>{localEq.day.slice(0, 3)} {localEq.time} your time</span>
          </div>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-3">
        <div className="flex-shrink-0 w-14 text-center border-r border-gold/15 pr-3">
          <div className="font-mono font-bold text-sm tabular-nums leading-tight whitespace-nowrap" style={{ color: t.color }}>
            {ev.time}
          </div>
          <div className="text-[10px] text-text-dim font-mono tabular-nums mt-0.5 whitespace-nowrap">
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

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text-bright truncate">{ev.name}</div>
          {(ev.boss || ev.subtitle) && (
            <div className="text-xs text-text-dim truncate mt-0.5">
              {ev.boss ? `👾 ${ev.boss}` : ev.subtitle}
            </div>
          )}
          {activeRegion.label && localEq && (
            <div className="text-[10px] text-gold-light/70 tabular-nums mt-0.5 flex items-center gap-1.5">
              <FlagImage
                code={activeRegion.code}
                flag={activeRegion.flag}
                name={activeRegion.name}
                width={14}
                height={10}
              />
              <span>{localEq.day.slice(0, 3)} {localEq.time} your time</span>
            </div>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-text-dim">Starts in</div>
          <div className="font-mono text-xs text-gold-light tabular-nums mt-0.5 whitespace-nowrap">
            {countdown}
          </div>
        </div>
      </div>
    </div>
  )
})

const StatTile = React.memo(function StatTile({ icon, label, value, onClick }) {
  const clickable = !!onClick
  const Tag = clickable ? 'button' : 'div'
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`text-left rounded-xl border border-gold/15 bg-void/40 px-4 py-3 transition-colors ${
        clickable ? 'hover:border-gold/40 hover:bg-gold/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg" aria-hidden="true">{icon}</span>
        <span className="text-[10px] text-text-dim font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-mono text-xl sm:text-2xl font-bold text-text-bright tabular-nums leading-none">{value}</div>
    </Tag>
  )
})

const ActionTile = React.memo(function ActionTile({ icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-gold/15 bg-void/40 px-4 py-3 hover:border-gold/40 hover:bg-gold/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 transition-colors text-left"
    >
      <span className="text-xl opacity-80 group-hover:opacity-100 transition-opacity" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text-bright truncate">{label}</div>
        <div className="text-xs text-text-dim truncate">{hint}</div>
      </div>
    </button>
  )
})