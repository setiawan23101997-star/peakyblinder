import React, { useMemo, useState } from 'react'

/* ───────────────────────── class emblems ───────────────────────── */

// Class artwork is mapped from the saved `cls` value, so choosing a class
// automatically gives the member the matching visual without storing image data per member.
const ClassIcon = ({ cls, size = 32 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 48 48',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  }

  const frame = (
    <rect x="1" y="1" width="46" height="46" rx="10" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.22" />
  )

  if (cls === 'Archer') return (
    <svg {...common} className="text-emerald-300">
      {frame}
      <path d="M31.5 8.5C22 13 17 22 17 32c0 4 1.5 6 3 8" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/>
      <path d="M16.5 10.5c9.5 4.5 14.5 13.5 14.5 23.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".7"/>
      <path d="M10 28h27" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="m31 24 8 4-8 4 2.5-4L31 24Z" fill="currentColor"/>
    </svg>
  )

  if (cls === 'Warlord') return (
    <svg {...common} className="text-sky-300">
      {frame}
      <path d="M13 19 17 11l7 4 7-4 4 8v8c0 8-5.5 12-12 15-6.5-3-12-7-12-15v-8Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"/>
      <path d="M15 22h18M18 28h12M21 34h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".9"/>
    </svg>
  )

  if (cls === 'Skald') return (
    <svg {...common} className="text-violet-300">
      {frame}
      <path d="M16 13c10 1 16 7 16 15 0 7-5 11-11 11-5 0-9-3-9-8 0-5 4-8 9-8 4 0 7 2 7 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M25 11v21M21 35h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="20" cy="31" r="2.3" fill="currentColor"/>
    </svg>
  )

  if (cls === 'Volva') return (
    <svg {...common} className="text-fuchsia-300">
      {frame}
      <path d="M24 8v32M12 14l24 20M36 14 12 34" stroke="currentColor" strokeWidth="1.7" opacity=".65"/>
      <path d="M24 13 28 20l7 4-7 4-4 7-4-7-7-4 7-4 4-7Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round"/>
      <circle cx="24" cy="24" r="3" fill="currentColor"/>
    </svg>
  )

  if (cls === 'Rune Fighter') return (
    <svg {...common} className="text-gold-bright">
      {frame}
      <path d="M24 7v34M14 14l20 20M34 14 14 34" stroke="currentColor" strokeWidth="1.4" opacity=".45"/>
      <path d="M28 8 15 27h9l-4 13 13-20h-9l4-12Z" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
      <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="1.1" opacity=".45"/>
    </svg>
  )

  // Berserker is the default and also the fallback for unknown/new classes.
  return (
    <svg {...common} className="text-red-300">
      {frame}
      <path d="M14 12 24 18l10-6-2 12 5 9-11-3-11 3 5-9-2-12Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="m13 18 8 8M35 18l-8 8M24 18v18" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/>
    </svg>
  )
}

const classIconTone = (cls) =>
  cls === 'Archer' ? 'border-emerald-400/30 bg-emerald-400/[0.07]' :
  cls === 'Warlord' ? 'border-sky-400/30 bg-sky-400/[0.07]' :
  cls === 'Skald' ? 'border-violet-400/30 bg-violet-400/[0.07]' :
  cls === 'Volva' ? 'border-fuchsia-400/30 bg-fuchsia-400/[0.07]' :
  cls === 'Rune Fighter' ? 'border-gold/35 bg-gold/[0.08]' :
  'border-red-400/30 bg-red-400/[0.07]'

// rgb triplets used for the soft glow behind each class emblem
const CLASS_GLOW = {
  Archer: '110,231,183',
  Warlord: '125,211,252',
  Skald: '196,181,253',
  Volva: '240,171,252',
  'Rune Fighter': '242,204,96',
}
const classGlow = cls => CLASS_GLOW[cls] || '252,165,165'

/* ───────────────────────── data ───────────────────────── */

const CATEGORIES = {
  power: {
    label: 'Combat Power',
    shortLabel: 'Power',
    tagline: 'Strongest warriors',
    icon: '⚔️',
    field: 'power',
    suffix: '',
  },
  coins: {
    label: 'Wealth',
    shortLabel: 'Coins',
    tagline: 'Richest hoarders',
    icon: '🪙',
    field: 'coins',
    suffix: '',
  },
  attendance: {
    label: 'Activity',
    shortLabel: 'Events',
    tagline: 'Most dedicated',
    icon: '◆',
    field: 'attendance',
    suffix: 'x',
  },
}

const PODIUM = {
  1: { title: 'Champion', rgb: '242,204,96', text: 'text-gold-bright', border: 'border-gold/50' },
  2: { title: 'Runner-up', rgb: '203,213,225', text: 'text-slate-200', border: 'border-slate-300/40' },
  3: { title: 'Third Place', rgb: '205,127,50', text: 'text-orange-300', border: 'border-orange-400/40' },
}

const PAGE_SIZE = 10

/* ───────────────────────── small pieces ───────────────────────── */

const Crown = ({ size = 26, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3 18h18l-1.5-9-4.5 4-3-7-3 7-4.5-4L3 18Zm0 2h18v2H3v-2Z" />
  </svg>
)

// Little gold corner brackets that make a panel feel like a game window.
function Corners({ className = 'border-gold/55' }) {
  const base = `pointer-events-none absolute h-3 w-3 ${className}`
  return (
    <>
      <span aria-hidden="true" className={`${base} left-1.5 top-1.5 border-l border-t`} />
      <span aria-hidden="true" className={`${base} right-1.5 top-1.5 border-r border-t`} />
      <span aria-hidden="true" className={`${base} bottom-1.5 left-1.5 border-b border-l`} />
      <span aria-hidden="true" className={`${base} bottom-1.5 right-1.5 border-b border-r`} />
    </>
  )
}

function RankBadge({ rank }) {
  const p = PODIUM[rank]

  if (p) {
    return (
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full border font-spectral text-[16px] font-bold ${p.text} ${p.border}`}
        style={{
          background: `radial-gradient(circle at 30% 25%, rgba(${p.rgb},.35), rgba(${p.rgb},.08))`,
          boxShadow: `0 0 14px -2px rgba(${p.rgb},.55)`,
        }}
      >
        {rank}
      </span>
    )
  }

  return (
    <span className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border border-white/[.08] bg-black/25 px-1.5 font-mono text-[14px] font-bold tabular-nums text-text-dim">
      {rank}
    </span>
  )
}

function Emblem({ cls, size = 44, glow = false, className = '' }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border ${classIconTone(cls)} ${className}`}
      style={{
        width: size + 10,
        height: size + 10,
        boxShadow: glow ? `0 0 26px -4px rgba(${classGlow(cls)},.55)` : undefined,
      }}
      title={cls || 'Berserker'}
    >
      <ClassIcon cls={cls} size={size} />
    </div>
  )
}

function RankValue({ rank, top = false }) {
  return (
    <span className={`font-mono font-bold tabular-nums ${
      top ? 'text-gold-bright' : 'text-text-bright'
    }`}>
      #{rank}
    </span>
  )
}


/* ───────────────────────── page ───────────────────────── */

export default function Leaderboard({ ctx }) {
  const { members = [], currentUser } = ctx
  const [category, setCategory] = useState('power')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Admin accounts are hidden from everyone except other Admins.
  const isAdmin = currentUser?.role === 'Admin'
  const visibleMembers = useMemo(
    () => (isAdmin ? members : members.filter(m => m.role !== 'Admin')),
    [members, isAdmin]
  )

  const activeCategory = CATEGORIES[category]
  const field = activeCategory.field
  const valueOf = member => Number(member?.[field]) || 0

  // Always calculate the official ranking from the complete member list first.
  // Search only filters what is displayed; it must never change a member's rank.
  const allRankedMembers = useMemo(() => {
    return [...visibleMembers].sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0))
  }, [visibleMembers, field])

  const rankById = useMemo(
    () => new Map(allRankedMembers.map((m, i) => [m.id, i + 1])),
    [allRankedMembers]
  )

  const query = search.trim().toLowerCase()

  const rankedMembers = useMemo(() => {
    if (!query) return allRankedMembers

    return allRankedMembers.filter(member => (
      String(member.name || '').toLowerCase().includes(query) ||
      String(member.cls || '').toLowerCase().includes(query) ||
      String(member.role || '').toLowerCase().includes(query)
    ))
  }, [allRankedMembers, query])

  // One continuous ranking board keeps the page simple.
  // Search filters the visible rows but never changes official ranks.
  const showPodium = false
  const listMembers = rankedMembers

  const totalPages = Math.max(1, Math.ceil(listMembers.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageMembers = listMembers.slice(startIndex, startIndex + PAGE_SIZE)

  const topValue = allRankedMembers.length ? valueOf(allRankedMembers[0]) : 0
  const getRank = member => rankById.get(member.id) || 0
  const isMeMember = member => !!currentUser && String(member.id) === String(currentUser.id)

  const formatNumber = value => (Number(value) || 0).toLocaleString()
  const formatValue = value => `${formatNumber(value)}${activeCategory.suffix}`

  // "Your standing" banner
  const myIndex = currentUser
    ? allRankedMembers.findIndex(m => String(m.id) === String(currentUser.id))
    : -1
  const me = myIndex >= 0 ? allRankedMembers[myIndex] : null
  const myRank = myIndex + 1
  const above = myIndex > 0 ? allRankedMembers[myIndex - 1] : null
  const gap = me && above ? valueOf(above) - valueOf(me) : 0
  const topPercent = me ? Math.max(1, Math.ceil((myRank / allRankedMembers.length) * 100)) : 0
  const canJumpToMe = !!me

  const changeCategory = nextCategory => {
    setCategory(nextCategory)
    setPage(1)
  }

  const changeSearch = value => {
    setSearch(value)
    setPage(1)
  }

  const jumpToMe = () => {
    if (!me || myRank <= 0) return

    const targetPage = Math.floor((myRank - 1) / PAGE_SIZE) + 1
    setSearch('')
    setPage(targetPage)

    const scrollToMe = () => {
      const target = document.querySelector(
        `[data-leaderboard-member-id="${String(me.id)}"]`
      )
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    if (targetPage === safePage) {
      requestAnimationFrame(scrollToMe)
    } else {
      setTimeout(scrollToMe, 80)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 sm:space-y-5">
      <style>{`
        @keyframes lb-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
        .lb-in { animation: lb-in .22s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .lb-in { animation: none; }
        }
      `}</style>

      {/* Header */}
      <header className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0b0908]/90">
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="text-[12px] font-bold uppercase tracking-[.2em] text-gold-dim">
                Clan Rankings
              </div>
              <h1 className="mt-1 font-spectral text-[30px] font-bold leading-tight text-text-bright sm:text-[34px]">
                Leaderboard
              </h1>
              <p className="mt-1 text-[14px] leading-5 text-text-dim sm:text-[14px]">
                Compare the clan&apos;s Combat Power, Coins, and Event Attendance.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-lg border border-white/[.07] bg-black/20 px-3.5 py-2.5 text-right">
                <div className="font-mono text-lg font-bold leading-none tabular-nums text-text-bright">
                  {visibleMembers.length}
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-[.15em] text-text-dim">
                  Members
                </div>
              </div>

              <div className="rounded-lg border border-gold/20 bg-gold/[.045] px-3.5 py-2.5">
                <div className="text-base leading-none">{activeCategory.icon}</div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-[.15em] text-gold-light">
                  {activeCategory.shortLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Your standing */}
      {me && (
        <section className="rounded-xl border border-white/[.08] bg-[#0b0908]/70">
          <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Emblem cls={me.cls} size={32} glow />
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[.18em] text-gold-dim">
                  Your standing
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-xl font-bold tabular-nums text-gold-bright">
                    #{myRank}
                  </span>
                  <span className="text-[14px] text-text-dim">
                    of {allRankedMembers.length}
                  </span>
                  <span className="text-[14px] text-text-dim">
                    · {formatValue(valueOf(me))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="min-w-0 text-[13px] text-text-dim sm:text-right">
                {above
                  ? gap === 0
                    ? `Tied with ${above.name}`
                    : `${formatNumber(gap)}${activeCategory.suffix} behind ${above.name}`
                  : 'You are #1'}
              </div>

              <button
                type="button"
                onClick={jumpToMe}
                className="shrink-0 rounded-lg border border-gold/25 bg-gold/[.06] px-3 py-2 text-[12px] font-bold uppercase tracking-wider text-gold-light transition hover:bg-gold/[.12] hover:text-gold-bright"
              >
                Find me
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="rounded-xl border border-white/[.08] bg-[#0b0908]/65 p-2.5">
        <div className="flex flex-col gap-2.5 md:flex-row">
          <div className="grid flex-1 grid-cols-3 rounded-lg border border-white/[.07] bg-black/20 p-1">
            {Object.entries(CATEGORIES).map(([key, item]) => {
              const active = category === key

              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => changeCategory(key)}
                  className={`min-h-[38px] rounded-md px-2 text-[13px] font-bold transition sm:text-[14px] ${
                    active
                      ? 'bg-gold/[.10] text-gold-bright'
                      : 'text-text-dim hover:bg-white/[.035] hover:text-text-bright'
                  }`}
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.shortLabel}
                </button>
              )
            })}
          </div>

          <div className="relative md:w-[300px] lg:w-[340px]">
            <input
              value={search}
              onChange={e => changeSearch(e.target.value)}
              placeholder="Search name, class, or role…"
              className="input h-10 w-full pl-9 pr-9 text-[14px]"
              aria-label="Search members"
            />
            <span
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-dim"
            >
              ⌕
            </span>

            {search && (
              <button
                type="button"
                onClick={() => changeSearch('')}
                className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md text-base leading-none text-text-dim hover:bg-white/[.05] hover:text-text"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Ranking */}
      <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0b0908]/80">
        <div className="flex items-center justify-between gap-3 border-b border-white/[.07] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base">{activeCategory.icon}</span>
              <h2 className="truncate text-[15px] font-bold text-text-bright sm:text-[16px]">
                {activeCategory.label}
              </h2>
            </div>
            <div className="mt-0.5 text-[12px] text-text-dim">
              Highest first
            </div>
          </div>

          <div className="shrink-0 rounded-full bg-white/[.04] px-2.5 py-1 text-[12px] font-mono text-text-dim">
            {query ? `${rankedMembers.length} found` : `${visibleMembers.length} members`}
          </div>
        </div>

        {pageMembers.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="text-2xl opacity-60">{query ? '⌕' : '—'}</div>
            <div className="mt-2 text-[15px] font-semibold text-text-bright">
              {query ? 'No members found' : 'No ranking data'}
            </div>
            <div className="mt-1 text-[14px] text-text-dim">
              {query ? 'Try another name, class, or role.' : 'There are no members to rank yet.'}
            </div>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[56px_minmax(0,1fr)_120px_minmax(140px,1fr)] gap-3 border-b border-white/[.06] bg-black/15 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[.16em] text-text-dim sm:grid">
              <div>Rank</div>
              <div>Member</div>
              <div>Class</div>
              <div className="text-right">{activeCategory.shortLabel}</div>
            </div>

            <div>
              {pageMembers.map((member, index) => {
                const rank = getRank(member)
                const mine = isMeMember(member)
                const value = valueOf(member)
                const pct = topValue > 0
                  ? Math.max(3, Math.min(100, Math.round((value / topValue) * 100)))
                  : 0

                return (
                  <div
                    key={`${category}-${member.id}`}
                    data-leaderboard-member-id={String(member.id)}
                    className={`lb-in relative border-b border-white/[.05] px-3.5 py-3 last:border-b-0 sm:px-5 ${
                      mine ? 'bg-gold/[.045]' : 'hover:bg-white/[.02]'
                    }`}
                    style={{ animationDelay: `${Math.min(index, 10) * 18}ms` }}
                  >
                    {mine && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-0.5 bg-gold-bright"
                      />
                    )}

                    <div className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[56px_minmax(0,1fr)_120px_minmax(140px,1fr)]">
                      <div>
                        <RankValue rank={rank} top={rank <= 3} />
                      </div>

                      <div className="flex min-w-0 items-center gap-2.5">
                        <Emblem
                          cls={member.cls}
                          size={30}
                          className={mine ? 'ring-1 ring-gold/35' : ''}
                        />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[14px] font-semibold text-text-bright">
                              {member.name}
                            </span>
                            {mine && (
                              <span className="shrink-0 rounded border border-gold/25 bg-gold/[.07] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-light">
                                You
                              </span>
                            )}
                          </div>

                          <div className="truncate text-[12px] text-text-dim sm:hidden">
                            {member.cls || 'Berserker'} · {member.role || 'Member'}
                          </div>
                          <div className="hidden truncate text-[12px] text-text-dim sm:block">
                            {member.role || 'Member'}
                          </div>
                        </div>
                      </div>

                      <div className="hidden truncate text-[13px] text-text sm:block">
                        {member.cls || '—'}
                      </div>

                      <div className="min-w-[74px] text-right">
                        <div className={`font-mono text-[15px] font-bold tabular-nums ${
                          rank <= 3 ? 'text-gold-light' : 'text-text-bright'
                        }`}>
                          {formatValue(value)}
                        </div>

                        <div className="mt-1.5 hidden h-1 overflow-hidden rounded-full bg-white/[.05] sm:block">
                          <div
                            className="h-full rounded-full bg-gold/55"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[.05] sm:hidden">
                      <div
                        className="h-full rounded-full bg-gold/55"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-white/[.06] px-4 py-3 sm:px-5">
                <div className="text-[12px] text-text-dim sm:text-[13px]">
                  {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, listMembers.length)} of {listMembers.length}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="min-h-[34px] rounded-lg border border-white/[.08] px-3 text-[12px] font-semibold text-text-dim transition hover:bg-white/[.04] hover:text-text disabled:pointer-events-none disabled:opacity-30"
                  >
                    Prev
                  </button>

                  <span className="min-w-[60px] text-center font-mono text-[12px] text-text-dim">
                    {safePage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="min-h-[34px] rounded-lg border border-white/[.08] px-3 text-[12px] font-semibold text-text-dim transition hover:bg-white/[.04] hover:text-text disabled:pointer-events-none disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
