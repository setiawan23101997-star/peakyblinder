                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setAttendeeSearch(''); setDetailLog(null) }}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[.08] text-text-dim hover:border-gold/30 hover:text-gold-light transition-colors"
                  aria-label="Close attendee details"
                >
                  ×
                </button>
              </div>

              {/* Summary bar */}
              <div className="flex flex-col gap-2.5 border-b border-white/[.06] bg-black/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <div className="text-[13px] font-bold uppercase tracking-[.16em] text-gold-light">Attendees</div>
                  <div className="mt-0.5 text-[13px] text-text-dim">Individual GP-based rewards</div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border border-gold/15 bg-gold/[.035] px-3 py-2">
                  <span className="text-[12px] font-bold uppercase tracking-[.12em] text-text-dim">Total</span>
                  <span className="font-sans text-sm font-bold tabular-nums text-gold-bright">{totalAwarded.toLocaleString()} Coins</span>
                </div>
              </div>

              {/* Compact attendee list */}
              <div className="border-b border-white/[.06] px-3.5 py-2.5 sm:px-4">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-dim">⌕</span>
                  <input
                    type="search"
                    value={attendeeSearch}
                    onChange={e => setAttendeeSearch(e.target.value)}
                    placeholder="Search player or class..."
                    aria-label="Search attendees"
                    className="w-full rounded-lg border border-white/[.08] bg-black/20 py-2 pl-9 pr-16 text-[12px] text-text-bright outline-none placeholder:text-text-dim focus:border-gold/30"
                  />
                  {attendeeSearch && (
                    <button
                      type="button"
                      onClick={() => setAttendeeSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] text-text-dim hover:text-text-bright"
                      aria-label="Clear attendee search"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-3.5 sm:p-4">
                {attendees.length === 0 ? (
                  <div className="py-10 text-center text-xs text-text-dim italic">
                    No attendee details saved for this log.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                    {filteredAttendees.map((a, idx) => (
                      <div
                        key={`${a.name}-${idx}`}
                        className="min-w-0 rounded-lg border border-white/[.07] bg-[#12110f] px-3 py-2.5 transition-colors hover:border-gold/20"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-gold/15 bg-gold/[.05] text-[13px] font-sans font-bold text-gold-light">
                            {idx + 1}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="whitespace-normal break-words text-[15px] font-bold leading-5 text-text-bright" title={a.name}>{a.name}</div>
                            <div className="mt-0.5 whitespace-normal break-words text-[12px] leading-4 text-text-dim" title={a.cls || 'Member'}>{a.cls || 'Member'}</div>
                          </div>

                          {isElder && (
                            <button
                              type="button"
                              onClick={() => removeAttendee(detailLog, a)}
                              disabled={removingAttendeeKey === `${detailLog.id}-${a.memberId || a.name}`}
                              title={`Remove ${a.name} from this attendance record`}
                              aria-label={`Remove ${a.name} from this attendance record`}
                              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-red-500/15 text-[13px] text-red-300/70 transition-colors hover:border-red-400/30 hover:bg-red-500/[.06] hover:text-red-300 disabled:opacity-40"
                            >
                              {removingAttendeeKey === `${detailLog.id}-${a.memberId || a.name}` ? '…' : '×'}
                            </button>
                          )}
                        </div>

                        <div className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-white/[.06] pt-2">
                          <div className="rounded-md bg-black/15 px-2 py-1.5">
                            <div className="text-[9px] font-semibold uppercase tracking-[.1em] text-text-dim">GP</div>
                            <div className="mt-0.5 whitespace-nowrap text-[11px] font-sans font-semibold text-text-bright">{a.gp != null ? formatGp(a.gp) : '—'}</div>
                          </div>
                          <div className="rounded-md bg-black/15 px-2 py-1.5">
                            <div className="text-[9px] font-semibold uppercase tracking-[.1em] text-text-dim">Bonus</div>
                            <div className="mt-0.5 whitespace-nowrap text-[11px] font-sans font-semibold text-gold-light">+{(a.gpBonus ?? 0).toLocaleString()}</div>
                          </div>
                          <div className="rounded-md bg-green-500/[.035] px-2 py-1.5">
                            <div className="text-[9px] font-bold uppercase tracking-[.1em] text-green-400/80">Earned</div>
                            <div className="mt-0.5 whitespace-nowrap text-[12px] font-sans font-bold tabular-nums text-green-300">+{(a.earned || 0).toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-[11px] font-sans text-text-dim sm:hidden">
                          <span>Base +{(a.baseCoins ?? 0).toLocaleString()}</span>
                          <span className="text-white/15">•</span>
                          <span>GP bonus +{(a.gpBonus ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                    {attendees.length > 0 && filteredAttendees.length === 0 && (
                      <div className="py-10 text-center">
                        <div className="text-[13px] font-semibold text-text-bright">No players found</div>
                        <div className="mt-1 text-[11px] text-text-dim">Try a different player name or class.</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
