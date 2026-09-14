import React, { useCallback, useEffect, useMemo, useState } from 'react'

const STAFF_ROLES = new Set(['Admin', 'Master', 'Elder'])

function formatDate(value) {
  if (!value) return 'Unknown time'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Unknown time'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

function normalizeLog(row) {
  let details = row?.details ?? {}
  if (typeof details === 'string') {
    try { details = JSON.parse(details) } catch { details = { value: details } }
  }

  return {
    id: row?.id,
    actorId: row?.actor_id ?? row?.actorId ?? null,
    actorName: row?.actor_name ?? row?.actorName ?? 'Unknown Staff',
    actorRole: row?.actor_role ?? row?.actorRole ?? '',
    action: row?.action || 'Unknown Action',
    entityType: row?.entity_type ?? row?.entityType ?? 'System',
    entityId: row?.entity_id ?? row?.entityId ?? null,
    details: details && typeof details === 'object' ? details : {},
    createdAt: row?.created_at ?? row?.createdAt ?? null,
  }
}

function prettyDetails(details) {
  return Object.entries(details || {})
    .filter(([key, value]) => {
      if (value === null || value === undefined || value === '') return false
      return ![
        'coins_before', 'coins_after', 'coin_change',
        'coin_before', 'coin_after', 'coin_delta',
        'power_before', 'power_after', 'power_change',
        'field_changes', 'changes',
      ].includes(String(key).toLowerCase())
    })
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ')
      let rendered = value
      if (typeof value === 'object') {
        try { rendered = JSON.stringify(value) } catch { rendered = '[object]' }
      }
      return `${label}: ${String(rendered)}`
    })
    .join(' · ')
}

function getCoinChange(details) {
  const d = details || {}
  const beforeRaw = d.coins_before ?? d.coin_before
  const afterRaw = d.coins_after ?? d.coin_after
  const deltaRaw = d.coin_change ?? d.coin_delta

  const before = Number(beforeRaw)
  const after = Number(afterRaw)
  const delta = Number(deltaRaw)

  if (Number.isFinite(before) && Number.isFinite(after)) {
    return {
      before,
      after,
      delta: Number.isFinite(delta) ? delta : after - before,
    }
  }

  if (Number.isFinite(delta)) {
    return { before: null, after: null, delta }
  }

  return null
}

function getFieldChanges(details) {
  const raw = details?.field_changes
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []

  const preferredOrder = [
    'coins',
    'power',
    'cls',
    'profile_grade',
    'character_level',
    'awakening_stage',
    'role',
  ]

  const keys = [
    ...preferredOrder.filter(key => Object.prototype.hasOwnProperty.call(raw, key)),
    ...Object.keys(raw).filter(key => !preferredOrder.includes(key)),
  ]

  return keys
    .map(key => {
      const item = raw[key]
      if (!item || typeof item !== 'object') return null

      return {
        key,
        label: item.label || key.replace(/_/g, ' '),
        before: item.before,
        after: item.after,
        delta: Number.isFinite(Number(item.delta)) ? Number(item.delta) : null,
      }
    })
    .filter(Boolean)
}

function formatAuditValue(value) {
  if (value === null || value === undefined || value === '') return '—'

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString()
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No'

  return String(value)
}

function fieldChangeTone(key, delta) {
  if (key === 'coins' || key === 'power') {
    if (delta > 0) return 'border-green-400/20 bg-green-400/[0.045] text-green-300'
    if (delta < 0) return 'border-red-400/20 bg-red-400/[0.045] text-red-300'
  }

  return 'border-gold/15 bg-gold/[0.035] text-text-bright'
}

function actionTone(action) {
  const value = String(action || '').toLowerCase()
  if (value.includes('delete') || value.includes('remove')) return 'text-red-300'
  if (value.includes('create') || value.includes('award') || value.includes('publish')) return 'text-green-300'
  if (value.includes('update') || value.includes('edit') || value.includes('change') || value.includes('reset')) return 'text-gold-light'
  return 'text-text-bright'
}

function detailTargetName(details, memberList = [], entityType = '', entityId = null) {
  const d = details || {}
  const explicit =
    d.member_name ||
    d.target_name ||
    d.player_name ||
    d.name ||
    null

  if (explicit) return explicit

  // Older audit rows may have only entity_type/entity_id. Resolve Member IDs
  // from the current member list so the UI never needs to expose raw IDs.
  if (String(entityType).toLowerCase() === 'member' && entityId != null) {
    const target = (memberList || []).find(
      member => String(member.id) === String(entityId)
    )
    return target?.name || null
  }

  return null
}

export default function AdminAuditLog({ ctx }) {
  const supabase = ctx?.supabase
  const currentUser = ctx?.currentUser
  const allMembers = ctx?.allMembers || []

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const [busy, setBusy] = useState(false)

  const canView = STAFF_ROLES.has(currentUser?.role)
  const canDelete = currentUser?.role === 'Admin' || currentUser?.role === 'Master'

  const loadLogs = useCallback(async () => {
    if (!canView || !supabase) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error: dbError } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      if (dbError) throw dbError

      setLogs((data || []).map(normalizeLog))
      setSelectedIds([])
      setError('')
    } catch (err) {
      console.error('Failed to load admin audit logs:', err)
      setError(err?.message || 'Could not load audit history.')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [canView, supabase])

  useEffect(() => {
    loadLogs()
    if (!canView) return undefined
    const timer = setInterval(loadLogs, 30000)
    return () => clearInterval(timer)
  }, [loadLogs, canView])

  const actions = useMemo(
    () => ['all', ...Array.from(new Set(logs.map(log => log.action)))],
    [logs]
  )

  const entities = useMemo(
    () => ['all', ...Array.from(new Set(logs.map(log => log.entityType)))],
    [logs]
  )

  const filtered = useMemo(() => logs.filter(log =>
    (actionFilter === 'all' || log.action === actionFilter) &&
    (entityFilter === 'all' || log.entityType === entityFilter)
  ), [logs, actionFilter, entityFilter])

  const visibleIds = useMemo(
    () => filtered.map(log => log.id).filter(Boolean),
    [filtered]
  )

  const allVisibleSelected =
    canDelete &&
    visibleIds.length > 0 &&
    visibleIds.every(id => selectedIds.includes(id))

  const toggleSelected = useCallback((id) => {
    if (!canDelete || !id) return
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }, [canDelete])

  const toggleSelectAll = useCallback(() => {
    if (!canDelete || visibleIds.length === 0) return

    setSelectedIds(prev => {
      const everyVisible = visibleIds.every(id => prev.includes(id))
      if (everyVisible) {
        return prev.filter(id => !visibleIds.includes(id))
      }

      return Array.from(new Set([...prev, ...visibleIds]))
    })
  }, [canDelete, visibleIds])

  const deleteSelected = useCallback(async () => {
    if (!canDelete || !supabase || selectedIds.length === 0 || busy) return

    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected audit log${selectedIds.length === 1 ? '' : 's'}?\n\nThis cannot be undone.`
    )
    if (!confirmed) return

    setBusy(true)
    try {
      const { error: dbError } = await supabase
        .from('admin_audit_logs')
        .delete()
        .in('id', selectedIds)

      if (dbError) throw dbError

      const deleted = new Set(selectedIds)
      setLogs(prev => prev.filter(log => !deleted.has(log.id)))
      setSelectedIds([])
      setError('')
    } catch (err) {
      console.error('Failed to delete selected audit logs:', err)
      setError(err?.message || 'Could not delete selected audit logs.')
    } finally {
      setBusy(false)
    }
  }, [busy, canDelete, selectedIds, supabase])

  const deleteAllLogs = useCallback(async () => {
    if (!canDelete || !supabase || busy) return

    const confirmed = window.confirm(
      'DELETE ALL AUDIT LOGS?\n\nThis will permanently remove the entire audit history from Supabase.\n\nThis action cannot be undone.'
    )
    if (!confirmed) return

    setBusy(true)
    setError('')

    try {
      // `not(id, is, null)` targets every row whose primary key is not null.
      // This is intentionally independent of the UI's `.limit(500)` display
      // query, so all records are removed rather than only visible records.
      const { error: dbError } = await supabase
        .from('admin_audit_logs')
        .delete()
        .not('id', 'is', null)

      if (dbError) throw dbError

      setLogs([])
      setSelectedIds([])
      setActionFilter('all')
      setEntityFilter('all')
    } catch (err) {
      console.error('Failed to delete all audit logs:', err)
      setError(
        err?.message ||
        'Could not delete all audit logs. Check the Supabase DELETE policy for admin_audit_logs.'
      )
    } finally {
      setBusy(false)
    }
  }, [busy, canDelete, supabase])

  const deleteOne = useCallback(async (log) => {
    if (!canDelete || !supabase || !log?.id || busy) return

    const confirmed = window.confirm(
      `Delete this audit log?\n\n${log.action} · ${log.actorName}\n${formatDate(log.createdAt)}\n\nThis cannot be undone.`
    )
    if (!confirmed) return

    setBusy(true)
    try {
      const { error: dbError } = await supabase
        .from('admin_audit_logs')
        .delete()
        .eq('id', log.id)

      if (dbError) throw dbError

      setLogs(prev => prev.filter(item => item.id !== log.id))
      setSelectedIds(prev => prev.filter(id => id !== log.id))
      setError('')
    } catch (err) {
      console.error('Failed to delete audit log:', err)
      setError(err?.message || 'Could not delete this audit log.')
    } finally {
      setBusy(false)
    }
  }, [busy, canDelete, supabase])

  if (!canView) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <section className="w-full max-w-md rounded-2xl border border-red-400/15 bg-[#0b0a09]/90 p-6 text-center">
          <div className="text-3xl">🔒</div>
          <h1 className="mt-3 font-spectral text-xl font-bold text-text-bright">Restricted Area</h1>
          <p className="mt-1.5 text-[10px] leading-relaxed text-text-dim">
            Admin activity logs are available only to clan staff.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 pb-10">
      <section className="relative overflow-hidden rounded-2xl border border-gold/20 bg-[#0b0a09]/90 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <div className="relative p-4 sm:p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_10px_rgba(242,204,96,0.8)]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-dim">
                  Security & Accountability
                </span>
              </div>
              <h1 className="font-spectral text-2xl font-bold text-text-bright sm:text-3xl">
                Admin Audit Log
              </h1>
              <p className="mt-1.5 text-[11px] leading-relaxed text-text-dim sm:text-sm">
                Staff actions are recorded here.
              </p>
            </div>

            <div className="hidden shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-right sm:block">
              <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-text-dim">Recorded</div>
              <div className="mt-0.5 font-mono text-lg font-bold text-gold-bright">{logs.length}</div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-xl border border-red-400/20 bg-red-400/[0.04] px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-300">
            Audit database error
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-text-dim">{error}</p>
        </section>
      )}

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#0b0a09] px-3 py-2 text-[10px] font-semibold text-text-bright outline-none focus:border-gold/30"
        >
          {actions.map(value => (
            <option key={value} value={value}>{value === 'all' ? 'All Actions' : value}</option>
          ))}
        </select>

        <select
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#0b0a09] px-3 py-2 text-[10px] font-semibold text-text-bright outline-none focus:border-gold/30"
        >
          {entities.map(value => (
            <option key={value} value={value}>{value === 'all' ? 'All Areas' : value}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={loadLogs}
          disabled={loading || busy}
          className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {canDelete && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-[#090807]/80 px-3 py-2.5">
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={visibleIds.length === 0 || busy}
            className="rounded-lg border border-gold/15 bg-gold/[0.035] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-gold-light hover:border-gold/30 disabled:opacity-40"
          >
            {allVisibleSelected ? 'Deselect All' : 'Select All'}
          </button>

          <span className="text-[9px] text-text-dim">
            {selectedIds.length} selected · {logs.length} loaded
          </span>

          <button
            type="button"
            onClick={deleteSelected}
            disabled={selectedIds.length === 0 || busy}
            className="ml-auto rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-red-300 hover:border-red-400/40 hover:bg-red-400/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy ? 'Deleting…' : `Delete Selected${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
          </button>

          <button
            type="button"
            onClick={deleteAllLogs}
            disabled={busy || logs.length === 0}
            className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-red-200 hover:border-red-500/50 hover:bg-red-500/[0.12] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy ? 'Working…' : 'Delete All Logs'}
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#090807]/80">
        <div className={`hidden gap-3 border-b border-white/[0.06] bg-white/[0.018] px-4 py-2.5 text-[8px] font-bold uppercase tracking-[0.16em] text-text-dim md:grid ${
          canDelete
            ? 'grid-cols-[34px_130px_minmax(130px,0.7fr)_minmax(150px,1fr)_minmax(220px,1.6fr)_62px]'
            : 'grid-cols-[130px_minmax(130px,0.7fr)_minmax(150px,1fr)_minmax(220px,1.6fr)]'
        }`}>
          {canDelete && <span />}
          <span>When</span>
          <span>Staff</span>
          <span>Action</span>
          <span>Details</span>
          {canDelete && <span className="text-right">Manage</span>}
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-[11px] text-text-dim">Loading audit history…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <div className="text-3xl opacity-50">🛡</div>
            <div className="mt-3 text-sm font-semibold text-text-bright">No audit entries</div>
            <div className="mt-1 text-[10px] text-text-dim">
              Important staff actions will appear here.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.055]">
            {filtered.map(log => {
              const details = prettyDetails(log.details)
              const targetName = detailTargetName(
                log.details,
                allMembers,
                log.entityType,
                log.entityId
              )
              const coinChange = getCoinChange(log.details)
              const delta = coinChange?.delta ?? 0

              return (
                <div key={String(log.id)} className="px-4 py-3 sm:px-4">
                  <div className={`grid min-w-0 gap-2 md:items-center md:gap-3 ${
                    canDelete
                      ? 'md:grid-cols-[34px_130px_minmax(130px,0.7fr)_minmax(150px,1fr)_minmax(220px,1.6fr)_62px]'
                      : 'md:grid-cols-[130px_minmax(130px,0.7fr)_minmax(150px,1fr)_minmax(220px,1.6fr)]'
                  }`}>
                    {canDelete && (
                      <label className="flex items-center md:justify-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(log.id)}
                          onChange={() => toggleSelected(log.id)}
                          disabled={busy}
                          className="h-3.5 w-3.5 accent-yellow-500"
                          aria-label={`Select audit log ${log.id}`}
                        />
                      </label>
                    )}

                    <div className="text-[9px] text-text-dim">
                      <div className="font-mono tabular-nums text-text-bright">{formatDate(log.createdAt)}</div>
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-semibold text-gold-light">{log.actorName}</div>
                      {log.actorRole && (
                        <div className="mt-0.5 text-[7px] uppercase tracking-[0.1em] text-text-dim">{log.actorRole}</div>
                      )}
                    </div>

                    <div className={`min-w-0 text-[10px] font-semibold ${actionTone(log.action)}`}>
                      {log.action}
                      {log.entityType && (
                        <span className="ml-1.5 text-[8px] font-normal text-text-dim">
                          · {log.entityType}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      {targetName && (
                        <div className="mb-1.5 text-[10px] font-semibold text-text-bright">
                          Target: <span className="text-gold-light">{targetName}</span>
                        </div>
                      )}

                      {getFieldChanges(log.details).length > 0 ? (
                        <div className="mb-1.5 space-y-1.5">
                          {getFieldChanges(log.details).map(change => (
                            <div
                              key={change.key}
                              className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 ${fieldChangeTone(change.key, change.delta)}`}
                            >
                              <span className="min-w-[62px] text-[8px] font-black uppercase tracking-[0.1em] text-gold-light">
                                {change.label}
                              </span>

                              <span className="font-mono text-[10px] font-semibold tabular-nums">
                                {formatAuditValue(change.before)}
                                <span className="mx-1.5 text-text-dim">→</span>
                                {formatAuditValue(change.after)}
                              </span>

                              {change.delta !== null && (
                                <span className={`rounded px-1.5 py-0.5 font-mono text-[8px] font-bold tabular-nums ${
                                  change.delta > 0
                                    ? 'bg-green-400/[0.08] text-green-300'
                                    : change.delta < 0
                                      ? 'bg-red-400/[0.08] text-red-300'
                                      : 'bg-white/[0.04] text-text-dim'
                                }`}>
                                  {change.delta > 0 ? '+' : ''}{change.delta.toLocaleString()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : coinChange ? (
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md border border-gold/20 bg-gold/[0.06] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-gold-light">
                            Coins
                          </span>
                          {coinChange.before !== null && coinChange.after !== null ? (
                            <span className="font-mono text-[10px] font-semibold tabular-nums text-text-bright">
                              {coinChange.before.toLocaleString()} → {coinChange.after.toLocaleString()}
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] font-semibold tabular-nums text-text-bright">
                              {Math.abs(delta).toLocaleString()}
                            </span>
                          )}
                          <span className={`rounded-md px-1.5 py-0.5 font-mono text-[8px] font-bold tabular-nums ${
                            delta > 0
                              ? 'border border-green-400/20 bg-green-400/[0.06] text-green-300'
                              : delta < 0
                                ? 'border border-red-400/20 bg-red-400/[0.06] text-red-300'
                                : 'border border-white/[0.08] bg-white/[0.025] text-text-dim'
                          }`}>
                            {delta > 0 ? '+' : ''}{delta.toLocaleString()}
                          </span>
                        </div>
                      ) : null}

                      <div className="break-words text-[9px] leading-relaxed text-text-dim">
                        {details || 'No additional details recorded.'}
                      </div>
                    </div>

                    {canDelete && (
                      <div className="flex justify-start md:justify-end">
                        <button
                          type="button"
                          onClick={() => deleteOne(log)}
                          disabled={busy}
                          title="Delete audit log"
                          className="rounded-md border border-red-400/15 bg-red-400/[0.025] px-2 py-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-red-300/70 hover:border-red-400/30 hover:bg-red-400/[0.07] hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
