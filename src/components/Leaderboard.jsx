import React, { useMemo, useState } from 'react'

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
                      <div className={`w-8 h-8 shrink-0 rounded-md border flex items-center justify-center text-[11px] font-bold ${
                        isCurrentUser
                          ? 'border-gold/35 bg-gold/10 text-gold-bright'
                          : 'border-gold/12 bg-bg-soft text-gold-light'
                      }`}>
                        {(member.name || '?').charAt(0).toUpperCase()}
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
