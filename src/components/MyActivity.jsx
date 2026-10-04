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

const money = value => Number(value || 0).toLocaleString()

function toTime(value) {
  if (value == null || value === '') return 0

  const n = Number(value)
  if (Number.isFinite(n) && n > 0) {
    return n < 100000000000 ? n * 1000 : n
  }

  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value) {
  const ts = toTime(value)
  if (!ts) return 'Unknown date'

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ts))
}

function formatDateTime(value) {
  const ts = toTime(value)
  if (!ts) return 'Unknown date'

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts))
}

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
      _id: `attendance-${entry.ts || entry.date || index}`,
      _time: toTime(entry.ts || entry.date),
      _coins: Number(entry.coins ?? entry.earned ?? 0) || 0,
    }))
}

function getPerfectEntries(member) {
  return (Array.isArray(member?.attend_log) ? member.attend_log : [])
    .filter(entry => entry?.type === 'perfect_attendance_bonus')
    .map((entry, index) => ({
      ...entry,
      _type: 'perfect',
      _id: `perfect-${entry.weekKey || entry.awardedAt || index}`,
      _time: toTime(entry.awardedAt),
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

function StatCard({ label, value, detail, icon }) {
  return (
    <div className="rounded-xl border border-white/[.07] bg-black/20 p-4 shadow-[0_10px_35px_rgba(0,0,0,.16)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[.18em] text-text-dim">
          {label}
        </div>
        <div className="text-base opacity-80">{icon}</div>
      </div>

      <div className="mt-2 font-spectral text-2xl font-bold text-gold-bright">
        {value}
      </div>

      {detail ? (
        <div className="mt-1 text-[10px] text-text-dim">{detail}</div>
      ) : null}
    </div>
  )
}

function ActivityRow({ item }) {
  const isAttendance = item._type === 'attendance'
  const isPerfect = item._type === 'perfect'
  const isAuction = item._type === 'auction'

  return (
    <div className="flex gap-3 border-b border-white/[.05] px-4 py-4 last:border-b-0">
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border text-sm ${
        isAuction
          ? 'border-amber-400/20 bg-amber-400/[.06]'
          : isPerfect
            ? 'border-gold/25 bg-gold/[.07]'
            : 'border-emerald-400/20 bg-emerald-400/[.05]'
      }`}>
        {isAuction ? '🔨' : isPerfect ? '🏆' : '📋'}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-text-bright">
              {item.title}
            </div>
            <div className="mt-0.5 text-[10px] text-text-dim">
              {item.subtitle}
            </div>
          </div>

          <div className={`whitespace-nowrap font-mono text-[12px] font-bold ${
            item._coins >= 0 ? 'text-emerald-300' : 'text-red-300'
          }`}>
            {item._coins >= 0 ? '+' : ''}
            {money(item._coins)} coins
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-text-dim">
          <span>{formatDateTime(item._time)} GMT+8</span>

          {item.event ? (
            <span className="text-text">
              {item.event}
            </span>
          ) : null}

          {item.sessionDisplayName ? (
            <span>{item.sessionDisplayName}</span>
          ) : null}

          {item.weekLabel ? (
            <span>{item.weekLabel}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AuctionWinCard({ item }) {
  const image = getAuctionImage(item.auction)

  return (
    <div className="flex gap-3 rounded-xl border border-white/[.07] bg-black/20 p-3">
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-white/[.08] bg-black/30">
        {image ? (
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl">
            🔨
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-text-bright">
              {getAuctionItemName(item.auction)}
            </div>

            <div className="mt-1 flex flex-wrap gap-1.5">
              {item.auction?.rarity ? (
                <span className="rounded-full border border-gold/15 bg-gold/[.05] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-gold-light">
                  {item.auction.rarity}
                </span>
              ) : null}

              <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[.04] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-300">
                Winner
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="font-mono text-[13px] font-bold text-red-300">
              -{money(item.amount)}
            </div>
            <div className="text-[8px] uppercase tracking-wider text-text-dim">
              coins spent
            </div>
          </div>
        </div>

        <div className="mt-2 text-[9px] text-text-dim">
          {formatDateTime(item._time)} GMT+8
          {item.auction?.distributedBy
            ? ` · Distributed by ${item.auction.distributedBy}`
            : ''}
        </div>
      </div>
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
          _time: toTime(
            auction.endedAt ??
            auction.ended_at ??
            winner.time
          ),
          _type: 'auction',
        }
      })
      .filter(Boolean)
      .sort((a, b) => b._time - a._time)
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

  const activity = useMemo(() => {
    const attendance = attendanceEntries.map(entry => ({
      ...entry,
      title: entry.event || 'Attendance',
      subtitle: entry.sessionDisplayName ||
        entry.sessionLabel ||
        'Attendance reward',
    }))

    const perfect = perfectEntries.map(entry => ({
      ...entry,
      title: 'Perfect Attendance',
      subtitle: entry.weekLabel
        ? `${entry.weekLabel} · ${entry.sessions || 8} sessions completed`
        : `${entry.sessions || 8} sessions completed`,
    }))

    const auctionsActivity = auctionWins.map(item => ({
      ...item,
      title: `Won ${getAuctionItemName(item.auction)}`,
      subtitle: item.auction?.rarity
        ? `${item.auction.rarity} auction item`
        : 'Auction win',
      _coins: -Math.abs(item.amount),
    }))

    const decayActivity = decayLogs.map(item => ({
      ...item,
      title: `Coin Decay${item.percentage != null ? ` · ${item.percentage}%` : ''}`,
      subtitle: `${money(item.before)} → ${money(item.after)} coins`,
      _coins: -Math.abs(Number(item.delta || 0)),
    }))

    return [...attendance, ...perfect, ...auctionsActivity, ...decayActivity]
      .sort((a, b) => b._time - a._time)
  }, [attendanceEntries, perfectEntries, auctionWins, decayLogs])

  const filteredActivity = activeTab === 'all'
    ? activity
    : activeTab === 'attendance'
      ? attendanceEntries.map(entry => ({
          ...entry,
          title: entry.event || 'Attendance',
          subtitle: entry.sessionDisplayName || entry.sessionLabel || 'Attendance reward',
        }))
      : activeTab === 'perfect'
        ? perfectEntries.map(entry => ({
            ...entry,
            title: 'Perfect Attendance',
            subtitle: entry.weekLabel
              ? `${entry.weekLabel} · ${entry.sessions || 8} sessions completed`
              : `${entry.sessions || 8} sessions completed`,
          }))
        : activeTab === 'decay'
          ? decayLogs.map(item => ({
              ...item,
              title: `Coin Decay${item.percentage != null ? ` · ${item.percentage}%` : ''}`,
              subtitle: `${money(item.before)} → ${money(item.after)} coins`,
              _coins: -Math.abs(Number(item.delta || 0)),
            }))
          : []

  if (!member) {
    return (
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[.03] p-6 text-center">
          <div className="text-2xl">⚠️</div>
          <h1 className="mt-2 font-spectral text-lg font-bold text-text-bright">
            Member record not found
          </h1>
          <p className="mx-auto mt-1 max-w-md text-[11px] leading-5 text-text-dim">
            Your account is logged in, but no matching member record was found.
            Please check that your account name or member ID matches the Members data.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="text-[10px] font-bold uppercase tracking-[.22em] text-gold-dim">
          Personal Ledger
        </div>

        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-spectral text-2xl font-bold text-text-bright sm:text-3xl">
              My Activity
            </h1>
            <p className="mt-1 text-[11px] text-text-dim">
              Your attendance rewards, auction wins, Perfect Attendance, and Coin Decay history.
            </p>
          </div>

          <div className="rounded-lg border border-gold/15 bg-gold/[.04] px-3 py-2">
            <div className="text-[8px] font-bold uppercase tracking-[.16em] text-gold-dim">
              Current Balance
            </div>
            <div className="mt-0.5 font-mono text-lg font-bold text-gold-bright">
              {money(currentCoins)} <span className="text-[9px] text-text-dim">coins</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <StatCard
          label="Coins Earned"
          value={money(totalEarned)}
          detail="Attendance + Perfect Attendance"
          icon="🪙"
        />

        <StatCard
          label="Attendance"
          value={attendanceEntries.length}
          detail={`${money(attendanceCoins)} coins earned`}
          icon="📋"
        />

        <StatCard
          label="Auction Wins"
          value={auctionWins.length}
          detail={`${money(auctionSpent)} coins spent`}
          icon="🔨"
        />

        <StatCard
          label="Perfect Attendance"
          value={perfectEntries.length}
          detail={`+${money(perfectCoins)} coins`}
          icon="🏆"
        />

        <StatCard
          label="Coin Decay"
          value={`-${money(decaySpent)}`}
          detail={decayLogs.length === 1 ? '1 decay event' : `${decayLogs.length} decay events`}
          icon="📉"
        />
      </div>

      {/* Tabs */}
      <div className="mt-5 overflow-x-auto border-b border-white/[.06]">
        <div className="flex min-w-max gap-1">
          {TABS.map(tab => {
            const selected = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.1em] transition ${
                  selected
                    ? 'border-gold text-gold-bright'
                    : 'border-transparent text-text-dim hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Activity */}
      {(activeTab === 'all' || activeTab === 'attendance' || activeTab === 'perfect' || activeTab === 'decay') && (
        <section className="mt-4 overflow-hidden rounded-xl border border-white/[.07] bg-black/20">
          <div className="flex items-center justify-between gap-3 border-b border-white/[.06] px-4 py-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.18em] text-gold-dim">
                {activeTab === 'all' ? 'Activity Timeline' : TABS.find(t => t.id === activeTab)?.label}
              </div>
              <div className="mt-0.5 text-[10px] text-text-dim">
                All times shown in GMT+8.
              </div>
            </div>

            <span className="rounded-full border border-white/[.07] bg-black/20 px-2.5 py-1 text-[9px] font-mono text-text-dim">
              {filteredActivity.length} records
            </span>
          </div>

          {activeTab === 'decay' && decayLoading ? (
            <div className="px-4 py-10 text-center text-[11px] text-text-dim">
              Loading Coin Decay history…
            </div>
          ) : filteredActivity.length > 0 ? (
            <div>
              {filteredActivity.map(item => (
                <ActivityRow key={item._id} item={item} />
              ))}
            </div>
          ) : (
            <div className="px-4 py-12 text-center">
              <div className="text-2xl opacity-60">📭</div>
              <div className="mt-2 text-[12px] font-semibold text-text">
                No activity yet
              </div>
              <div className="mt-1 text-[10px] text-text-dim">
                {activeTab === 'decay'
                  ? 'No Coin Decay records found for your account.'
                  : 'Your activity will appear here when you earn attendance rewards or Perfect Attendance.'}
              </div>
              {activeTab === 'decay' && decayError ? (
                <div className="mx-auto mt-2 max-w-lg text-[9px] text-red-300/80">
                  {decayError}
                </div>
              ) : null}
            </div>
          )}
        </section>
      )}

      {/* Auction wins */}
      {activeTab === 'auctions' && (
        <section className="mt-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.18em] text-gold-dim">
                Auction Archive
              </div>
              <h2 className="mt-1 font-spectral text-xl font-bold text-text-bright">
                Items You Won
              </h2>
            </div>

            <div className="text-right">
              <div className="font-mono text-sm font-bold text-red-300">
                -{money(auctionSpent)}
              </div>
              <div className="text-[8px] uppercase tracking-wider text-text-dim">
                total spent
              </div>
            </div>
          </div>

          {auctionWins.length > 0 ? (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {auctionWins.map(item => (
                <AuctionWinCard
                  key={`${item.auction?.id || 'auction'}-${item._time}`}
                  item={item}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[.07] bg-black/20 px-4 py-12 text-center">
              <div className="text-2xl opacity-60">🔨</div>
              <div className="mt-2 text-[12px] font-semibold text-text">
                No auction wins yet
              </div>
              <div className="mt-1 text-[10px] text-text-dim">
                Completed auctions that you won will appear here.
              </div>
            </div>
          )}
        </section>
      )}

      {/* Small ledger note */}
      <div className="mt-4 rounded-lg border border-white/[.05] bg-black/10 px-3 py-2.5 text-[9px] leading-4 text-text-dim">
        <span className="font-semibold text-text">Ledger:</span>{' '}
        Attendance and Perfect Attendance are shown as coins earned.
        Auction wins and Coin Decay are shown separately as coins spent so the
        page does not mistake deductions for earnings.
      </div>
    </div>
  )
}
