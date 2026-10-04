import React, { useEffect, useMemo, useState } from 'react'

/*
  MyActivity.jsx

  Reads existing data from ctx only.
  No new Supabase tables/RPCs are required.

  Expected ctx:
    {
      members,
      auctions,
      currentUser,
      supabase,
    }

  Attendance history is read from member.attend_log, which is the same
  attendance ledger maintained by Attendance.jsx.
*/

const TABS = [
  { id: 'all', label: 'All Activity' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'auctions', label: 'Auction Wins' },
  { id: 'perfect', label: 'Perfect Attendance' },
  { id: 'decay', label: 'Coin Decay' },
]

const PAGE_SIZE = 40
const TZ = 'Asia/Singapore' // GMT+8 server time

// Each activity type gets its own icon + colour so rows can be told apart at a glance.
const TYPE_META = {
  attendance: {
    label: 'Attendance',
    icon: '📋',
    tile: 'border-emerald-400/25 bg-emerald-400/[.07]',
    pill: 'border-emerald-400/25 bg-emerald-400/[.07] text-emerald-300',
  },
  perfect: {
    label: 'Perfect Attendance',
    icon: '🏆',
    tile: 'border-gold/30 bg-gold/[.08]',
    pill: 'border-gold/30 bg-gold/[.08] text-gold-light',
  },
  auction: {
    label: 'Auction Win',
    icon: '🔨',
    tile: 'border-amber-400/25 bg-amber-400/[.07]',
    pill: 'border-amber-400/25 bg-amber-400/[.07] text-amber-300',
  },
  decay: {
    label: 'Coin Decay',
    icon: '📉',
    tile: 'border-red-400/25 bg-red-400/[.07]',
    pill: 'border-red-400/25 bg-red-400/[.07] text-red-300',
  },
}

const STAT_TONES = {
  emerald: { tile: 'border-emerald-400/25 bg-emerald-400/[.07]', value: 'text-emerald-300' },
  gold: { tile: 'border-gold/30 bg-gold/[.08]', value: 'text-gold-bright' },
  amber: { tile: 'border-amber-400/25 bg-amber-400/[.07]', value: 'text-amber-300' },
  red: { tile: 'border-red-400/25 bg-red-400/[.07]', value: 'text-red-300' },
}

// Same rarity colours as the Auctions page.
const RARITY_COLOR = {
  material: '#ffffff',
  common: '#4ade80',
  uncommon: '#ffffff',
  rare: '#60a5fa',
  epic: '#f87171',
  legendary: '#f2cc60',
}

const money = value => Number(value || 0).toLocaleString()

function signedMoney(value) {
  const n = Number(value) || 0
  if (n > 0) return `+${money(n)}`
  if (n < 0) return `-${money(Math.abs(n))}`
  return '0'
}

function amountTone(value) {
  const n = Number(value) || 0
  if (n > 0) return 'text-emerald-300'
  if (n < 0) return 'text-red-300'
  return 'text-text-dim'
}

function toTime(value) {
  if (value == null || value === '') return 0

  const n = Number(value)
  if (Number.isFinite(n) && n > 0) {
    return n < 100000000000 ? n * 1000 : n
  }

  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDateTime(value) {
  const ts = toTime(value)
  if (!ts) return 'Unknown date'

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts))
}

function formatTime(value) {
  const ts = toTime(value)
  if (!ts) return ''

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts))
}

const DAY_KEY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const DAY_LABEL_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function dayKey(ts) {
  return ts > 0 ? DAY_KEY_FMT.format(new Date(ts)) : 'unknown'
}

function dayLabel(ts, todayKey, yesterdayKey) {
  const key = dayKey(ts)
  if (key === 'unknown') return 'Unknown date'
  const full = DAY_LABEL_FMT.format(new Date(ts))
  if (key === todayKey) return `Today · ${full}`
  if (key === yesterdayKey) return `Yesterday · ${full}`
  return full
}

// Items must already be sorted newest-first.
function groupByDay(items) {
  const groups = []
  let current = null

  for (const item of items) {
    const key = dayKey(item._time)
    if (!current || current.key !== key) {
      current = { key, time: item._time, items: [], net: 0 }
      groups.push(current)
    }
    current.items.push(item)
    current.net += Number(item._coins) || 0
  }

  return groups
}

const byNewest = (a, b) => b._time - a._time

function getMemberFromContext(members, currentUser) {
  if (!Array.isArray(members) || !currentUser) return null

  const byId = members.find(m =>
    String(m?.id ?? '') === String(currentUser?.id ?? '')
  )
  if (byId) return byId

  return members.find(m =>
    String(m?.name || '').trim().toLowerCase() ===
    String(currentUser?.name || '').trim().toLowerCase()
  ) || null
}

function getAttendanceEntries(member) {
  return (Array.isArray(member?.attend_log) ? member.attend_log : [])
    .filter(entry => entry && entry.type !== 'perfect_attendance_bonus')
    .map((entry, index) => ({
      ...entry,
      _type: 'attendance',
      _id: `attendance-${entry.ts || entry.date || 'x'}-${index}`,
      _time: toTime(entry.ts || entry.date),
      // Entries that only have a date have no real time of day, so don't show one.
      _hasTime: entry.ts != null && entry.ts !== '',
      _coins: Number(entry.coins ?? entry.earned ?? 0) || 0,
    }))
}

function getPerfectEntries(member) {
  return (Array.isArray(member?.attend_log) ? member.attend_log : [])
    .filter(entry => entry?.type === 'perfect_attendance_bonus')
    .map((entry, index) => ({
      ...entry,
      _type: 'perfect',
      _id: `perfect-${entry.weekKey || entry.awardedAt || 'x'}-${index}`,
      _time: toTime(entry.awardedAt),
      _hasTime: toTime(entry.awardedAt) > 0,
      _coins: Number(entry.coins ?? 150) || 0,
    }))
}

function getFinalBidEntries(auction) {
  const bids = Array.isArray(auction?.bids) ? auction.bids : []
  const latestByBidder = new Map()

  for (const bid of bids) {
    if (!bid?.bidder) continue
    latestByBidder.set(
      String(bid.bidder).trim().toLowerCase(),
      bid
    )
  }

  return [...latestByBidder.values()]
    .filter(bid => !bid?.cancelled && Number(bid?.amount) > 0)
    .map(bid => ({
      ...bid,
      amount: Number(bid.amount) || 0,
      time: toTime(bid.time),
    }))
    .sort((a, b) => b.amount - a.amount || a.time - b.time)
}

function getAuctionWinner(auction) {
  return getFinalBidEntries(auction)[0] || null
}

function normalizeAuditDetails(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  if (typeof value === 'string') {
    try { return JSON.parse(value) || {} } catch { return {} }
  }
  return {}
}

// Two audit rows can occasionally represent the same Coin Decay operation
// (for example after a repeated client-side insert/retry). Treat rows with
// the same member, actor, timestamp (to the second), percentage and
// before/after balances as one visible activity entry.
function getDecayFingerprint(row) {
  const second = row?._time > 0
    ? Math.floor(row._time / 1000)
    : String(row?._id || '')

  return [
    String(row?.memberId ?? ''),
    String(row?.actorName ?? '').trim().toLowerCase(),
    String(row?.actorRole ?? '').trim().toLowerCase(),
    String(row?.percentage ?? ''),
    String(Number(row?.before ?? 0)),
    String(Number(row?.after ?? 0)),
    String(second),
  ].join('|')
}

function dedupeDecayRows(rows) {
  const seen = new Set()

  return rows.filter(row => {
    const fingerprint = getDecayFingerprint(row)
    if (seen.has(fingerprint)) return false
    seen.add(fingerprint)
    return true
  })
}

function isAuctionEnded(auction) {
  const status = String(auction?.status || '').toLowerCase()
  if (status === 'ended' || status === 'completed' || status === 'closed') return true

  const endedAt = toTime(auction?.endedAt ?? auction?.ended_at)
  if (endedAt > 0) return true

  const endsAt = toTime(auction?.endsAt ?? auction?.ends_at)
  return endsAt > 0 && endsAt <= Date.now()
}

function getAuctionItemName(auction) {
  return auction?.name ||
    auction?.item_name ||
    auction?.itemName ||
    'Auction Item'
}

function getAuctionImage(auction) {
  return auction?.imageUrl ||
    auction?.image_url ||
    auction?.image ||
    null
}

/* ───────────────────────── presentation ───────────────────────── */

function StatCard({ label, value, detail, icon, tone = 'gold', className = '' }) {
  const t = STAT_TONES[tone] || STAT_TONES.gold

  return (
    <div className={`flex items-center gap-3.5 rounded-xl border border-white/[.08] bg-black/25 p-4 ${className}`}>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl ${t.tile}`}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">
          {label}
        </div>
        <div className={`mt-0.5 font-spectral text-[26px] font-bold leading-tight tabular-nums ${t.value}`}>
          {value}
        </div>
        {detail ? (
          <div className="mt-0.5 text-[12px] leading-4 text-text-dim">{detail}</div>
        ) : null}
      </div>
    </div>
  )
}

function DayHeader({ group, todayKey, yesterdayKey }) {
  const count = group.items.length

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-y border-white/[.06] bg-white/[.03] px-4 py-2.5 first:border-t-0 sm:px-5">
      <span className="text-[13px] font-bold text-text-bright">
        {dayLabel(group.time, todayKey, yesterdayKey)}
      </span>

      <span className="text-[12px] text-text-dim">
        {count} {count === 1 ? 'record' : 'records'} ·{' '}
        <span className={`font-mono font-semibold ${amountTone(group.net)}`}>
          {signedMoney(group.net)}
        </span>{' '}
        net
      </span>
    </div>
  )
}

function ActivityRow({ item }) {
  const meta = TYPE_META[item._type] || TYPE_META.attendance

  // Extra details, without repeating what the title / subtitle already say.
  const shown = [item.title, item.subtitle].filter(Boolean).map(String)
  const extras = [...new Set(
    [item.event, item.sessionDisplayName, item.weekLabel]
      .filter(Boolean)
      .map(String)
      .filter(text => !shown.some(s => s === text || s.includes(text)))
  )]

  return (
    <div className="flex gap-3 border-b border-white/[.05] px-4 py-4 last:border-b-0 sm:gap-4 sm:px-5">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-base ${meta.tile}`}
        aria-hidden="true"
      >
        {meta.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="break-words text-[14px] font-semibold leading-5 text-text-bright">
          {item.title}
        </div>

        {item.subtitle ? (
          <div className="mt-0.5 break-words text-[13px] leading-5 text-text">
            {item.subtitle}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12px] text-text-dim">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.pill}`}>
            {meta.label}
          </span>

          {item._hasTime ? (
            <span className="font-mono">{formatTime(item._time)}</span>
          ) : null}

          {extras.map(text => (
            <span key={text}>
              <span className="mr-2 text-text-dim/50">•</span>{text}
            </span>
          ))}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className={`font-mono text-[16px] font-bold tabular-nums ${amountTone(item._coins)}`}>
          {signedMoney(item._coins)}
        </div>
        <div className="text-[11px] text-text-dim">coins</div>
      </div>
    </div>
  )
}

function AuctionWinCard({ item }) {
  const image = getAuctionImage(item.auction)
  const rarity = String(item.auction?.rarity || '').toLowerCase()
  const nameColor = RARITY_COLOR[rarity]

  return (
    <div className="flex gap-3.5 rounded-xl border border-white/[.08] bg-black/25 p-3.5">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/[.1] bg-black/30">
        {image ? (
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">
            🔨
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="break-words text-[15px] font-bold leading-5 text-text-bright"
              style={nameColor ? { color: nameColor } : undefined}
            >
              {getAuctionItemName(item.auction)}
            </div>

            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {rarity ? (
                <span className="rounded-full border border-gold/20 bg-gold/[.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-light">
                  {rarity}
                </span>
              ) : null}

              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/[.07] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Winner
              </span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="font-mono text-[16px] font-bold tabular-nums text-red-300">
              -{money(item.amount)}
            </div>
            <div className="text-[11px] text-text-dim">coins spent</div>
          </div>
        </div>

        <div className="mt-2.5 text-[12px] leading-4 text-text-dim">
          {formatDateTime(item._time)} GMT+8
          {item.auction?.distributedBy ? (
            <span className="block sm:inline">
              <span className="hidden sm:inline"> · </span>
              Distributed by <span className="text-text">{item.auction.distributedBy}</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Notice({ tone = 'info', children }) {
  const cls = tone === 'error'
    ? 'border-red-400/20 bg-red-400/[.05] text-red-200'
    : 'border-white/[.08] bg-white/[.03] text-text'

  return (
    <div className={`border-b px-4 py-2.5 text-[12px] leading-5 sm:px-5 ${cls}`}>
      {children}
    </div>
  )
}

export default function MyActivity({ ctx }) {
  const {
    members = [],
    auctions = [],
    currentUser,
  } = ctx || {}

  const [activeTab, setActiveTab] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [decayLogs, setDecayLogs] = useState([])
  const [decayLoading, setDecayLoading] = useState(false)
  const [decayError, setDecayError] = useState('')

  const member = useMemo(
    () => getMemberFromContext(members, currentUser),
    [members, currentUser]
  )

  const attendanceEntries = useMemo(
    () => getAttendanceEntries(member),
    [member]
  )

  const perfectEntries = useMemo(
    () => getPerfectEntries(member),
    [member]
  )

  // Start from the first page again whenever the tab changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [activeTab])

  useEffect(() => {
    let cancelled = false

    const loadDecayLogs = async () => {
      if (!member?.id || !ctx?.supabase) {
        setDecayLogs([])
        return
      }

      setDecayLoading(true)
      setDecayError('')

      try {
        const { data, error } = await ctx.supabase
          .from('admin_audit_logs')
          .select('id, actor_name, actor_role, action, entity_type, details, created_at')
          .eq('action', 'Apply Coin Decay')
          .order('created_at', { ascending: false })
          .limit(500)

        if (error) throw error

        const memberId = String(member.id)
        const memberName = String(member.name || '').trim().toLowerCase()

        const rows = (Array.isArray(data) ? data : []).flatMap(log => {
          const details = normalizeAuditDetails(log?.details)
          const percentage = Number(details?.percentage)
          const targets = Array.isArray(details?.targets) ? details.targets : []

          const target = targets.find(item => {
            const targetId = String(item?.id ?? '')
            const targetName = String(item?.name ?? '').trim().toLowerCase()

            return targetId === memberId || (
              !targetId && memberName && targetName === memberName
            )
          })

          if (!target) return []

          const before = Number(
            target?.before ??
            target?.coins_before ??
            0
          ) || 0

          const after = Number(
            target?.after ??
            target?.coins_after ??
            0
          ) || 0

          const rawDelta = Number(
            target?.delta ??
            (after - before)
          ) || 0

          return [{
            _id: `decay-${log.id}-${member.id}`,
            _type: 'decay',
            _time: toTime(log.created_at),
            _hasTime: true,
            _coins: rawDelta,
            memberId: member.id,
            before,
            after,
            delta: rawDelta,
            percentage: Number.isFinite(percentage) ? percentage : null,
            actorName: log.actor_name || 'Clan Staff',
            actorRole: log.actor_role || '',
          }]
        })

        // Keep genuine separate decay operations, but hide exact duplicate
        // audit entries that would otherwise appear twice in My Activity.
        const uniqueRows = dedupeDecayRows(rows)

        if (!cancelled) setDecayLogs(uniqueRows)
      } catch (error) {
        console.error('Failed to load Coin Decay history:', error)
        if (!cancelled) {
          setDecayLogs([])
          setDecayError(error?.message || 'Could not load Coin Decay history.')
        }
      } finally {
        if (!cancelled) setDecayLoading(false)
      }
    }

    loadDecayLogs()

    return () => {
      cancelled = true
    }
  }, [ctx?.supabase, member?.id, member?.name])

  const auctionWins = useMemo(() => {
    if (!member && !currentUser) return []

    const name = String(member?.name || currentUser?.name || '')
      .trim()
      .toLowerCase()

    if (!name || !Array.isArray(auctions)) return []

    return auctions
      .filter(isAuctionEnded)
      .map(auction => {
        const winner = getAuctionWinner(auction)
        if (!winner) return null

        const winnerName = String(winner.bidder || '')
          .trim()
          .toLowerCase()

        if (winnerName !== name) return null

        return {
          auction,
          amount: Number(winner.amount) || 0,
          _id: `auction-${auction.id}`,
          _time: toTime(
            auction.endedAt ??
            auction.ended_at ??
            winner.time
          ),
          _hasTime: true,
          _type: 'auction',
        }
      })
      .filter(Boolean)
      .sort(byNewest)
  }, [auctions, member, currentUser])

  const attendanceCoins = attendanceEntries.reduce(
    (sum, entry) => sum + Number(entry._coins || 0),
    0
  )

  const perfectCoins = perfectEntries.reduce(
    (sum, entry) => sum + Number(entry._coins || 0),
    0
  )

  const auctionSpent = auctionWins.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  )

  const decaySpent = decayLogs.reduce(
    (sum, item) => sum + Math.abs(Number(item.delta || item._coins || 0)),
    0
  )

  const totalEarned = attendanceCoins + perfectCoins
  const currentCoins = Number(member?.coins ?? currentUser?.coins ?? 0) || 0

  // Build each typed list once, newest first; tabs just pick one of them.
  const attendanceItems = useMemo(() => attendanceEntries.map(entry => ({
    ...entry,
    title: entry.event || 'Attendance',
    subtitle: entry.sessionDisplayName ||
      entry.sessionLabel ||
      'Attendance reward',
  })).sort(byNewest), [attendanceEntries])

  const perfectItems = useMemo(() => perfectEntries.map(entry => ({
    ...entry,
    title: 'Perfect Attendance',
    subtitle: entry.weekLabel
      ? `${entry.weekLabel} · ${entry.sessions || 8} sessions completed`
      : `${entry.sessions || 8} sessions completed`,
  })).sort(byNewest), [perfectEntries])

  const auctionItems = useMemo(() => auctionWins.map(item => ({
    ...item,
    title: `Won ${getAuctionItemName(item.auction)}`,
    subtitle: item.auction?.rarity
      ? `${item.auction.rarity} auction item`
      : 'Auction win',
    _coins: -Math.abs(item.amount),
  })), [auctionWins])

  const decayItems = useMemo(() => decayLogs.map(item => ({
    ...item,
    title: `Coin Decay${item.percentage != null ? ` · ${item.percentage}%` : ''}`,
    subtitle: `${money(item.before)} → ${money(item.after)} coins`,
    _coins: -Math.abs(Number(item.delta || 0)),
  })).sort(byNewest), [decayLogs])

  const activity = useMemo(
    () => [...attendanceItems, ...perfectItems, ...auctionItems, ...decayItems].sort(byNewest),
    [attendanceItems, perfectItems, auctionItems, decayItems]
  )

  const listByTab = {
    all: activity,
    attendance: attendanceItems,
    perfect: perfectItems,
    decay: decayItems,
  }
  const filteredActivity = listByTab[activeTab] || []
  const visibleActivity = filteredActivity.slice(0, visibleCount)
  const remaining = filteredActivity.length - visibleActivity.length

  const todayKey = dayKey(Date.now())
  const yesterdayKey = dayKey(Date.now() - 24 * 60 * 60 * 1000)
  const dayGroups = groupByDay(visibleActivity)

  const tabCounts = {
    all: activity.length,
    attendance: attendanceItems.length,
    auctions: auctionWins.length,
    perfect: perfectItems.length,
    decay: decayLoading ? '…' : decayItems.length,
  }

  if (!member) {
    return (
      <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-6">
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[.03] p-6 text-center">
          <div className="text-2xl">⚠️</div>
          <h1 className="mt-2 font-spectral text-xl font-bold text-text-bright">
            Member record not found
          </h1>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-5 text-text-dim">
            Your account is logged in, but no matching member record was found.
            Please check that your account name or member ID matches the Members data.
          </p>
        </div>
      </div>
    )
  }

  const activeTabLabel = TABS.find(t => t.id === activeTab)?.label

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[.22em] text-gold-dim">
            Personal Ledger
          </div>
          <h1 className="mt-1 font-spectral text-[30px] font-bold leading-tight text-text-bright sm:text-4xl">
            My Activity
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-text-dim">
            Your attendance rewards, auction wins, Perfect Attendance, and Coin Decay history.
          </p>
        </div>

        <div className="rounded-xl border border-gold/25 bg-gold/[.05] px-4 py-3 sm:min-w-[190px] sm:text-right">
          <div className="text-[11px] font-bold uppercase tracking-[.16em] text-gold-dim">
            Current Balance
          </div>
          <div className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-gold-bright">
            {money(currentCoins)}{' '}
            <span className="text-[12px] font-normal text-text-dim">coins</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Coins Earned"
          value={`+${money(totalEarned)}`}
          detail="Attendance + Perfect Attendance"
          icon="🪙"
          tone="emerald"
        />

        <StatCard
          label="Attendance"
          value={attendanceEntries.length}
          detail={`${money(attendanceCoins)} coins earned`}
          icon="📋"
          tone="emerald"
        />

        <StatCard
          label="Perfect Attendance"
          value={perfectEntries.length}
          detail={`+${money(perfectCoins)} coins`}
          icon="🏆"
          tone="gold"
        />

        <StatCard
          label="Auction Wins"
          value={auctionWins.length}
          detail={`${money(auctionSpent)} coins spent`}
          icon="🔨"
          tone="amber"
        />

        <StatCard
          label="Coin Decay"
          value={`-${money(decaySpent)}`}
          detail={decayItems.length === 1 ? '1 decay event' : `${decayItems.length} decay events`}
          icon="📉"
          tone="red"
          className="sm:col-span-2 lg:col-span-2"
        />
      </div>

      {/* Tabs */}
      <div className="-mx-3 mt-6 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Activity filter" className="flex min-w-max gap-2">
          {TABS.map(tab => {
            const selected = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[40px] items-center gap-2 rounded-lg border px-3.5 text-[13px] font-semibold transition ${
                  selected
                    ? 'border-gold/40 bg-gold/[.10] text-gold-bright'
                    : 'border-white/[.08] bg-black/20 text-text hover:border-white/[.16] hover:text-text-bright'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${
                  selected ? 'bg-gold/[.15] text-gold-bright' : 'bg-white/[.06] text-text-dim'
                }`}>
                  {tabCounts[tab.id]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline */}
      {activeTab !== 'auctions' && (
        <section className="mt-4 overflow-hidden rounded-xl border border-white/[.08] bg-black/20">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.06] px-4 py-3.5 sm:px-5">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[.16em] text-gold-dim">
                {activeTab === 'all' ? 'Activity Timeline' : activeTabLabel}
              </div>
              <div className="mt-0.5 text-[12px] text-text-dim">
                Newest first · all times GMT+8 ·{' '}
                <span className="text-emerald-300">+ earned</span>{' '}
                <span className="text-red-300">- spent</span>
              </div>
            </div>

            <span className="rounded-full border border-white/[.08] bg-black/20 px-3 py-1 font-mono text-[12px] text-text">
              {filteredActivity.length} {filteredActivity.length === 1 ? 'record' : 'records'}
            </span>
          </div>

          {(activeTab === 'all' || activeTab === 'decay') && decayError ? (
            <Notice tone="error">
              Coin Decay history could not be loaded, so it is missing from this list. {decayError}
            </Notice>
          ) : null}

          {activeTab === 'all' && decayLoading ? (
            <Notice>Loading Coin Decay history…</Notice>
          ) : null}

          {activeTab === 'decay' && decayLoading ? (
            <div className="px-4 py-12 text-center text-[13px] text-text-dim">
              Loading Coin Decay history…
            </div>
          ) : filteredActivity.length > 0 ? (
            <div>
              {dayGroups.map(group => (
                <div key={group.key}>
                  <DayHeader group={group} todayKey={todayKey} yesterdayKey={yesterdayKey} />
                  {group.items.map(item => (
                    <ActivityRow key={item._id} item={item} />
                  ))}
                </div>
              ))}

              {remaining > 0 ? (
                <div className="border-t border-white/[.06] px-4 py-3.5 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
                    className="min-h-[40px] rounded-lg border border-gold/30 bg-gold/[.06] px-5 text-[13px] font-semibold text-gold-light transition hover:bg-gold/[.12] hover:text-gold-bright"
                  >
                    Show {Math.min(PAGE_SIZE, remaining)} more
                    <span className="ml-1.5 text-text-dim">({remaining} remaining)</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="px-4 py-14 text-center">
              <div className="text-3xl opacity-60">📭</div>
              <div className="mt-2 text-[14px] font-semibold text-text-bright">
                No activity yet
              </div>
              <div className="mx-auto mt-1 max-w-sm text-[13px] leading-5 text-text-dim">
                {activeTab === 'decay'
                  ? 'No Coin Decay records found for your account.'
                  : 'Your activity will appear here when you earn attendance rewards or Perfect Attendance.'}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Auction wins */}
      {activeTab === 'auctions' && (
        <section className="mt-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[.16em] text-gold-dim">
                Auction Archive
              </div>
              <h2 className="mt-1 font-spectral text-2xl font-bold text-text-bright">
                Items You Won
              </h2>
            </div>

            <div className="text-right">
              <div className="font-mono text-lg font-bold tabular-nums text-red-300">
                -{money(auctionSpent)}
              </div>
              <div className="text-[11px] text-text-dim">total coins spent</div>
            </div>
          </div>

          {auctionWins.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {auctionWins.map(item => (
                <AuctionWinCard key={item._id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[.08] bg-black/20 px-4 py-14 text-center">
              <div className="text-3xl opacity-60">🔨</div>
              <div className="mt-2 text-[14px] font-semibold text-text-bright">
                No auction wins yet
              </div>
              <div className="mt-1 text-[13px] text-text-dim">
                Completed auctions that you won will appear here.
              </div>
            </div>
          )}
        </section>
      )}

      {/* Ledger note */}
      <div className="mt-5 rounded-xl border border-white/[.06] bg-black/15 px-4 py-3 text-[12.5px] leading-5 text-text-dim">
        <span className="font-semibold text-text">How to read this:</span>{' '}
        Attendance and Perfect Attendance are coins <span className="text-emerald-300">earned</span>.
        Auction wins and Coin Decay are coins <span className="text-red-300">spent</span>, shown
        separately so deductions are never mistaken for earnings.
      </div>
    </div>
  )
}
