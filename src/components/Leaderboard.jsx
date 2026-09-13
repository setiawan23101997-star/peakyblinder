import React, { useMemo, useState } from 'react'

const getClassIcon = cls => CLASS_ICONS[cls] || null

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
  cls === 'Archer' ? 'border-emerald-400/25 bg-emerald-400/[0.06]' :
  cls === 'Warlord' ? 'border-sky-400/25 bg-sky-400/[0.06]' :
  cls === 'Skald' ? 'border-violet-400/25 bg-violet-400/[0.06]' :
  cls === 'Volva' ? 'border-fuchsia-400/25 bg-fuchsia-400/[0.06]' :
  cls === 'Rune Fighter' ? 'border-gold/30 bg-gold/[0.07]' :
  'border-red-400/25 bg-red-400/[0.06]'

export default function Leaderboard({ ctx }) {
  const { members = [], currentUser } = ctx
  const [category, setCategory] = useState('power')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Admin accounts are hidden from everyone except other Admins.
  const isAdmin = currentUser?.role === 'Admin'
  const visibleMembers = useMemo(
    () => (isAdmin ? members : members.filter(m => m.role !== 'Admin')),
    [members, isAdmin]
  )

  const categories = {
    power: {
      label: 'Combat Power',
      shortLabel: 'Power',
      icon: '⚔️',
      field: 'power',
      suffix: '',
    },
    coins: {
      label: 'Wealth',
      shortLabel: 'Coins',
      icon: '🪙',
      field: 'coins',
      suffix: '',
    },
    attendance: {
      label: 'Activity',
      shortLabel: 'Events',
      icon: '◆',
      field: 'attendance',
      suffix: 'x',
    },
  }

  const activeCategory = categories[category]

  // Always calculate the official ranking from the complete member list first.
  // Search only filters what is displayed; it must never change a member's rank.
  const allRankedMembers = useMemo(() => {
    return [...visibleMembers].sort(
      (a, b) =>
        (Number(b[activeCategory.field]) || 0) -
        (Number(a[activeCategory.field]) || 0)
    )
  }, [visibleMembers, activeCategory.field])

  const rankedMembers = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return allRankedMembers

    return allRankedMembers.filter(member => {
      return (
        String(member.name || '').toLowerCase().includes(query) ||
        String(member.cls || '').toLowerCase().includes(query) ||
        String(member.role || '').toLowerCase().includes(query)
      )
    })
  }, [allRankedMembers, search])

  const totalPages = Math.max(1, Math.ceil(rankedMembers.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const pageMembers = rankedMembers.slice(startIndex, startIndex + pageSize)

  const getRank = member => {
    const index = allRankedMembers.findIndex(m => m.id === member.id)
    return index + 1
  }

  const formatValue = value =>
    `${(Number(value) || 0).toLocaleString()}${activeCategory.suffix}`

  const changeCategory = nextCategory => {
    setCategory(nextCategory)
    setPage(1)
  }

  const changeSearch = value => {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Compact page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-gold-light/70">
            <span className="w-1.5 h-1.5 rounded-full bg-gold/70" />
            Clan Rankings
          </div>
          <div className="flex items-baseline gap-3 mt-0.5">
            <h1 className="font-spectral text-2xl font-bold text-gold-light tracking-wide">
              Leaderboard
            </h1>
            <span className="hidden sm:inline text-[11px] text-text-dim">
              {visibleMembers.length} members
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="px-2.5 py-1.5 rounded-md border border-gold/15 bg-dark/50 text-[10px]">
            <span className="text-text-dim">Ranked by</span>
            <span className="ml-1.5 text-gold-light font-semibold">{activeCategory.shortLabel}</span>
          </div>
        </div>
      </div>

      {/* Compact toolbar */}
      <section className="rounded-lg border border-gold/15 bg-dark/75 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2">
          <div className="flex items-center gap-0.5 rounded-md border border-gold/10 bg-black/20 p-0.5 shrink-0">
            {Object.entries(categories).map(([key, item]) => {
              const active = category === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => changeCategory(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold transition-colors ${
                    active
                      ? 'bg-gold/10 text-gold-bright border border-gold/20'
                      : 'border border-transparent text-text-dim hover:text-text hover:bg-white/[0.035]'
                  }`}
                >
                  <span className="text-[11px]">{item.icon}</span>
                  <span>{item.shortLabel}</span>
                </button>
              )
            })}
          </div>

          <div className="relative flex-1 sm:max-w-[240px] sm:ml-auto">
            <input
              value={search}
              onChange={e => changeSearch(e.target.value)}
              placeholder="Search member..."
              className="input w-full h-9 pl-8 pr-8 text-xs"
              aria-label="Search members"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim text-xs">
              ⌕
            </span>
            {search && (
              <button
                type="button"
                onClick={() => changeSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded text-text-dim hover:text-text hover:bg-white/5"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Compact leaderboard */}
      <section className="rounded-lg border border-gold/15 bg-dark/75 overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
        {/* Table heading */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gold/10 bg-black/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm">{activeCategory.icon}</span>
            <span className="text-xs font-semibold text-text truncate">{activeCategory.label}</span>
            <span className="text-[10px] text-text-dim">·</span>
            <span className="text-[10px] text-text-dim">Highest first</span>
          </div>
          <span className="text-[10px] text-text-dim shrink-0">
            {search.trim() ? `${rankedMembers.length} results` : `${visibleMembers.length} members`}
          </span>
        </div>

        {pageMembers.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-9 h-9 mx-auto rounded-full border border-gold/15 bg-gold/5 flex items-center justify-center text-text-dim mb-2">
              ⌕
            </div>
            <div className="text-sm font-medium text-text">No members found</div>
            <div className="text-xs text-text-dim mt-1">Try another name, class, or role.</div>
          </div>
        ) : (
          <>
            {/* Dense table header */}
            <div className="hidden sm:grid grid-cols-[54px_minmax(0,1fr)_125px_105px] gap-2 px-3.5 py-2 bg-white/[0.018] border-b border-gold/10 text-[9px] uppercase tracking-[0.13em] text-text-dim">
              <div>Rank</div>
              <div>Member</div>
              <div>Class</div>
              <div className="text-right">{activeCategory.shortLabel}</div>
            </div>

            <div>
              {pageMembers.map(member => {
                const rank = getRank(member)
                const isCurrentUser = member.id === currentUser?.id

                return (
                  <div
                    key={member.id}
                    className={`grid grid-cols-[44px_minmax(0,1fr)_auto] sm:grid-cols-[54px_minmax(0,1fr)_125px_105px] gap-2 items-center px-3.5 py-2.5 border-b border-gold/10 last:border-b-0 transition-colors ${
                      isCurrentUser ? 'bg-gold/[0.055]' : 'hover:bg-white/[0.025]'
                    }`}
                  >
                    {/* Rank */}
                    <div className={`text-xs font-bold tabular-nums ${
                      rank === 1
                        ? 'text-gold-bright'
                        : rank === 2
                          ? 'text-text'
                          : rank === 3
                            ? 'text-gold-light'
                            : 'text-text-dim'
                    }`}>
                      {String(rank).padStart(2, '0')}
                    </div>

                    {/* Member */}
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center ${
                        classIconTone(member.cls)
                      } ${isCurrentUser ? 'ring-1 ring-gold/40' : ''}`} title={member.cls || 'Berserker'}>
                        <ClassIcon cls={member.cls} size={31} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-xs text-text truncate">
                            {member.name}
                          </span>
                          {isCurrentUser && (
                            <span className="shrink-0 text-[8px] uppercase tracking-wider text-gold-light border border-gold/20 bg-gold/5 px-1 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-text-dim truncate mt-0.5">
                          {member.role || 'Member'}
                        </div>
                      </div>
                    </div>

                    {/* Class */}
                    <div className="hidden sm:block text-[11px] text-text-dim truncate">
                      {member.cls || '—'}
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <span className={`font-bold text-xs tabular-nums ${
                        rank <= 3 ? 'text-gold-light' : 'text-text'
                      }`}>
                        {formatValue(member[activeCategory.field])}
                      </span>
                      <div className="sm:hidden text-[8px] uppercase tracking-wider text-text-dim mt-0.5">
                        {activeCategory.shortLabel}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <div className="px-3.5 py-2.5 bg-black/10 border-t border-gold/10 flex items-center justify-between gap-3">
              <div className="text-[10px] text-text-dim">
                {startIndex + 1}–{Math.min(startIndex + pageSize, rankedMembers.length)}
                <span className="mx-1">of</span>
                <span className="text-text">{rankedMembers.length}</span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded border border-gold/12 text-[10px] text-text-dim hover:text-text hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Prev
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1)
                    .filter(p => totalPages <= 5 || p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`min-w-7 px-1.5 py-1 rounded border text-[10px] ${
                          p === safePage
                            ? 'border-gold/30 bg-gold/10 text-gold-light'
                            : 'border-transparent text-text-dim hover:text-text hover:bg-white/5'
                        }`}
                      >
                        {p}
                      </button>
                    ))}

                  <button
                    type="button"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded border border-gold/12 text-[10px] text-text-dim hover:text-text hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
