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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-gold-light/70 mb-1">
            Clan Rankings
          </div>
          <h1 className="font-spectral text-2xl font-bold text-gold-light">
            Leaderboard
          </h1>
          <p className="text-text-dim text-sm mt-1">
            Compare the clan's strongest and most active members.
          </p>
        </div>

        <div className="text-xs text-text-dim">
          <span className="text-text font-semibold">{visibleMembers.length}</span>{' '}
          members
        </div>
      </div>

      {/* Controls */}
      <div className="card p-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(categories).map(([key, item]) => {
              const active = category === key

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => changeCategory(key)}
                  className={[
                    'px-3 py-2 rounded-lg text-xs font-semibold transition border',
                    active
                      ? 'bg-gold/10 border-gold/30 text-gold-light'
                      : 'border-transparent text-text-dim hover:text-text hover:bg-white/5',
                  ].join(' ')}
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                </button>
              )
            })}
          </div>

          <div className="relative w-full lg:w-64">
            <input
              value={search}
              onChange={e => changeSearch(e.target.value)}
              placeholder="Search members..."
              className="input w-full pl-9"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim text-sm">
              ⌕
            </span>
          </div>
        </div>
      </div>

      {/* Main leaderboard */}
      <section className="card overflow-hidden p-0">
        <div className="px-4 py-4 border-b border-gold/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center">
              {activeCategory.icon}
            </div>
            <div>
              <h2 className="font-semibold text-text">{activeCategory.label}</h2>
              <p className="text-[11px] text-text-dim">
                Ranked from highest to lowest
              </p>
            </div>
          </div>

          <div className="text-[10px] uppercase tracking-wider text-text-dim text-right">
            {search.trim()
              ? `${rankedMembers.length} result${rankedMembers.length === 1 ? '' : 's'}`
              : `${rankedMembers.length} results`}
            {search.trim() && (
              <div className="normal-case tracking-normal mt-0.5 text-[10px]">
                Official ranks preserved
              </div>
            )}
          </div>
        </div>

        {pageMembers.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-2xl mb-2">⌕</div>
            <div className="text-sm font-medium text-text">No members found</div>
            <div className="text-xs text-text-dim mt-1">
              Try another name or class.
            </div>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[64px_minmax(0,1fr)_150px_120px] gap-3 px-4 py-2.5 bg-white/[0.02] border-b border-gold/10 text-[10px] uppercase tracking-wider text-text-dim">
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
                    className={[
                      'grid grid-cols-[44px_minmax(0,1fr)_auto] sm:grid-cols-[64px_minmax(0,1fr)_150px_120px] gap-3 items-center px-4 py-3 border-b border-gold/10 last:border-b-0',
                      isCurrentUser ? 'bg-gold/5' : 'hover:bg-white/[0.02]',
                    ].join(' ')}
                  >
                    {/* Rank */}
                    <div
                      className={[
                        'font-bold text-sm',
                        rank === 1
                          ? 'text-gold-bright'
                          : rank === 2
                            ? 'text-text'
                            : rank === 3
                              ? 'text-gold-light'
                              : 'text-text-dim',
                      ].join(' ')}
                    >
                      #{rank}
                    </div>

                    {/* Member */}
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-bg-soft border border-gold/15 flex items-center justify-center text-xs font-bold text-gold-light">
                        {(member.name || '?').charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-text truncate">
                            {member.name}
                          </span>

                          {isCurrentUser && (
                            <span className="hidden xs:inline text-[9px] uppercase tracking-wider text-gold-light border border-gold/20 bg-gold/5 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-text-dim truncate">
                          {member.role || 'Member'}
                        </div>
                      </div>
                    </div>

                    {/* Class */}
                    <div className="hidden sm:block text-xs text-text-dim truncate">
                      {member.cls || '—'}
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <div className="font-bold text-sm text-gold-light">
                        {formatValue(member[activeCategory.field])}
                      </div>
                      <div className="sm:hidden text-[9px] uppercase tracking-wider text-text-dim">
                        {activeCategory.shortLabel}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gold/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-[11px] text-text-dim">
                Showing{' '}
                <span className="text-text">
                  {startIndex + 1}–{Math.min(startIndex + pageSize, rankedMembers.length)}
                </span>{' '}
                of <span className="text-text">{rankedMembers.length}</span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded border border-gold/15 text-xs text-text-dim hover:text-text hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1)
                    .filter(p => {
                      if (totalPages <= 5) return true
                      return (
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - safePage) <= 1
                      )
                    })
                    .map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={[
                          'min-w-8 px-2 py-1.5 rounded border text-xs',
                          p === safePage
                            ? 'border-gold/30 bg-gold/10 text-gold-light'
                            : 'border-transparent text-text-dim hover:text-text hover:bg-white/5',
                        ].join(' ')}
                      >
                        {p}
                      </button>
                    ))}

                  <button
                    type="button"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded border border-gold/15 text-xs text-text-dim hover:text-text hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"
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
