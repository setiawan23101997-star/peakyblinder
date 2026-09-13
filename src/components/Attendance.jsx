import React, { useState, useEffect, useMemo } from 'react'

const eventTypes = [
  'Clan Annihilation',
  'Inter-Server Battle',
  'Clan Sanctuary',
  "Sindri's Treasure Island",
  'World Boss',
]

const SERVER_TZ = 'Asia/Singapore'
const SERVER_TZ_LABEL = 'GMT+8'

const FALLBACK_REGIONS = [
  { id: 'ph', code: 'ph', flag: '🇵🇭', name: 'Philippines', tz: 'Asia/Manila',       label: 'GMT+8' },
  { id: 'us', code: 'us', flag: '🇺🇸', name: 'New York',    tz: 'America/New_York',  label: 'ET' },
  { id: 'br', code: 'br', flag: '🇧🇷', name: 'Brazil',      tz: 'America/Sao_Paulo', label: 'BRT' },
  { id: 'de', code: 'de', flag: '🇩🇪', name: 'Germany',     tz: 'Europe/Berlin',     label: 'CET' },
  { id: 'by', code: 'by', flag: '🇧🇾', name: 'Belarus',     tz: 'Europe/Minsk',      label: 'MSK' },
  { id: 'ua', code: 'ua', flag: '🇺🇦', name: 'Ukraine',     tz: 'Europe/Kyiv',       label: 'EET' },
  { id: 'th', code: 'th', flag: '🇹🇭', name: 'Thailand',    tz: 'Asia/Bangkok',      label: 'GMT+7' },
  { id: 'id', code: 'id', flag: '🇮🇩', name: 'Indonesia',   tz: 'Asia/Jakarta',      label: 'GMT+7' },
]

/* ── Cached Intl formatters ───────────────────────────────────────── */

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

const CLOCK_OPTS = {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
}
const SHORT_OPTS = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }
const SHORT_NO_YEAR_OPTS = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }

function formatClockInZone(ts, tz) {
  return getDTF('en-GB', { timeZone: tz, ...CLOCK_OPTS }).format(new Date(ts))
}
function formatShortInZone(ts, tz) {
  return getDTF('en-GB', { timeZone: tz, ...SHORT_OPTS }).format(new Date(ts))
}
function formatShortNoYearInZone(ts, tz) {
  return getDTF('en-GB', { timeZone: tz, ...SHORT_NO_YEAR_OPTS }).format(new Date(ts))
}

function formatGMT8(ts = Date.now()) {
  return formatClockInZone(ts, SERVER_TZ)
}
function formatGMT8Short(ts = Date.now()) {
  return formatShortInZone(ts, SERVER_TZ)
}
function formatInZone(ts, tz) {
  return formatShortNoYearInZone(ts, tz)
}

/** Small flag image from flagcdn.com with emoji fallback. */
function FlagImage({ code, flag, name, width = 20, height = 15 }) {
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
}

export default function Attendance({ ctx }) {
  const {
    members, setMembers, attendanceLogs, setAttendanceLogs,
    currentUser, addToast, supabase,
    region, setRegionId, regions: ctxRegions,
  } = ctx

  const [selectedEvent, setSelectedEvent] = useState(eventTypes[0])
  const [coinAmount, setCoinAmount] = useState(25)
  const [selectedMembers, setSelectedMembers] = useState({})
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState({})
  const [detailLog, setDetailLog] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const isElder = currentUser?.role === 'Elder' || currentUser?.role === 'Master' || currentUser?.role === 'Admin'
  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  const regions = useMemo(() => {
    const list = Array.isArray(ctxRegions) && ctxRegions.length > 0 ? ctxRegions : FALLBACK_REGIONS
    return list.map(r => ({ ...r, code: r.code || r.id, flag: r.flag || '' }))
  }, [ctxRegions])

  const activeRegion = useMemo(() => {
    const r = region || regions[0]
    return {
      ...r,
      code: r.code || r.id,
      flag: r.flag || '',
      name: r.name || r.label || r.id,
      label: r.label || '',
    }
  }, [region, regions])

  const toggleMember = (id) => setSelectedMembers(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleLog = (id) => setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }))

  const pickRegion = (id) => {
    if (typeof setRegionId === 'function') setRegionId(id)
    else try { localStorage.setItem('peakyblader:localRegion', id) } catch {}
    setPickerOpen(false)
  }

  const recordAttendance = async () => {
    const ids = Object.keys(selectedMembers).filter(k => selectedMembers[k])
    if (ids.length === 0) {
      addToast('Select at least one member.', 'red', 'Error')
      return
    }

    const coinValue = parseInt(coinAmount)
    if (!Number.isFinite(coinValue) || coinValue < 0) {
      addToast('Enter a valid coin amount.', 'red', 'Error')
      return
    }

    setSubmitting(true)

    const nowDate = new Date()
    const dateStr = nowDate.toLocaleDateString()
    const ts = nowDate.getTime()

    const targets = members.filter(m => ids.includes(String(m.id)))

    const results = await Promise.all(targets.map(async (m) => {
      const attendEntry = {
        event: selectedEvent,
        date: dateStr,
        ts,
        qualifier: 'full',
        coins: coinValue,
      }
      const { data, error } = await supabase.rpc('record_attendance_and_log', {
        p_member_name: m.name,
        p_coins_delta: coinValue,
        p_attendance_delta: 1,
        p_attend_entry: attendEntry,
        p_bonus_tx_entries: [],
      })
      if (error) {
        console.error(`Failed to save ${m.name}:`, error)
        return { id: m.id, name: m.name, ok: false, error }
      }
      return { id: m.id, name: m.name, ok: true, newCoins: data }
    }))

    const failed = results.filter(r => !r.ok)
    if (failed.length > 0) {
      addToast(`Couldn't save attendance for: ${failed.map(f => f.name).join(', ')}`, 'red', 'Save Failed')
      setSubmitting(false)
      return
    }

    const log = {
      id: ts,
      event: selectedEvent,
      date: dateStr,
      ts,
      members: ids.length,
      recorded_by: currentUser?.name || 'System',
      attendees: targets.map(m => ({
        name: m.name,
        cls: m.cls,
        qualifier: 'full',
        earned: coinValue,
      })),
    }

    const { error: logError } = await supabase
      .from('attendance_logs')
      .insert([log])

    if (logError) {
      console.error('Failed to save log:', logError)
      addToast('Coins saved, but the attendance log failed to save.', 'red', 'Partial Save')
    }

    setMembers(prev => prev.map(m => {
      if (!ids.includes(String(m.id))) return m
      const attendEntry = { event: selectedEvent, date: dateStr, ts, qualifier: 'full', coins: coinValue }
      return {
        ...m,
        coins: (m.coins || 0) + coinValue,
        attendance: (m.attendance || 0) + 1,
        attend_log: [...(m.attend_log || []), attendEntry],
      }
    }))
    setAttendanceLogs(prev => [log, ...prev])

    setSelectedMembers({})
    setSubmitting(false)
    addToast(`${ids.length} members recorded for ${selectedEvent} (+${coinValue} coins each).`, 'gold', 'Attendance Saved')
  }

  const deleteLog = async (log) => {
    if (!isElder) {
      addToast('Only Elders and Masters can delete attendance.', 'red', 'Not Allowed')
      return
    }

    const attendees = log.attendees || []
    const totalCoins = attendees.reduce((s, a) => s + (a.earned || 0), 0)

    const confirmMsg =
      `Delete "${log.event}" attendance from ${formatGMT8Short(log.ts || log.id)}?\n\n` +
      `This will reverse:\n` +
      `• ${attendees.length} member(s)\n` +
      `• ${totalCoins.toLocaleString()} coins total\n\n` +
      `This cannot be undone.`

    if (!window.confirm(confirmMsg)) return

    setDeletingId(log.id)

    const reversed = await Promise.all(attendees.map(async (a) => {
      const member = members.find(m => m.name === a.name)
      if (!member) return { name: a.name, ok: true, skipped: true }

      const newCoins = Math.max(0, (member.coins || 0) - (a.earned || 0))
      const newAttendance = Math.max(0, (member.attendance || 0) - 1)

      const filteredLog = (member.attend_log || []).filter(entry => {
        if (entry.event !== a.event && entry.event !== log.event) return true
        const entryTs = entry.ts || 0
        if (entryTs && log.ts && entryTs === log.ts) return false
        if (entry.event === log.event && entry.date === log.date) return false
        return true
      })

      const { error } = await supabase
        .from('members')
        .update({
          coins: newCoins,
          attendance: newAttendance,
          attend_log: filteredLog,
        })
        .eq('id', member.id)

      if (error) {
        console.error(`Failed to reverse ${a.name}:`, error)
        return { name: a.name, ok: false, error }
      }
      return { name: a.name, ok: true, memberId: member.id, newCoins, newAttendance, filteredLog }
    }))

    const failed = reversed.filter(r => !r.ok)
    if (failed.length > 0) {
      addToast(`Couldn't reverse all members: ${failed.map(f => f.name).join(', ')}`, 'red', 'Partial Reversal')
    }

    setMembers(prev => prev.map(m => {
      const r = reversed.find(x => x.memberId === m.id)
      if (!r) return m
      return {
        ...m,
        coins: r.newCoins,
        attendance: r.newAttendance,
        attend_log: r.filteredLog,
      }
    }))

    const { error: delErr } = await supabase
      .from('attendance_logs')
      .delete()
      .eq('id', log.id)

    if (delErr) {
      console.error('Failed to delete log row:', delErr)
      addToast(`Couldn't remove the log: ${delErr.message}`, 'red', 'Delete Failed')
      setDeletingId(null)
      return
    }

    setAttendanceLogs(prev => prev.filter(l => l.id !== log.id))
    setDeletingId(null)
    addToast(
      `Attendance reversed — ${attendees.length} member(s), ${totalCoins.toLocaleString()} coins removed.`,
      'red',
      'Attendance Deleted'
    )
  }

  const sortedLogs = [...attendanceLogs].sort((a, b) => {
    const ta = a.ts || Number(a.id) || new Date(a.date).getTime() || 0
    const tb = b.ts || Number(b.id) || new Date(b.date).getTime() || 0
    return tb - ta
  })

  const selectedCount = Object.values(selectedMembers).filter(Boolean).length
  const allFilteredSelected = filtered.length > 0 && filtered.every(m => selectedMembers[m.id])
  const selectedTotalCoins = selectedCount * (Number(coinAmount) || 0)

  const toggleAllFiltered = () => {
    setSelectedMembers(prev => {
      const next = { ...prev }
      if (allFilteredSelected) {
        filtered.forEach(m => delete next[m.id])
      } else {
        filtered.forEach(m => { next[m.id] = true })
      }
      return next
    })
  }

  const clearSelection = () => setSelectedMembers({})

  return (
    <div className="space-y-5">
      {/* Simple Auction-style header */}
      <header className="relative z-30 overflow-visible rounded-2xl border border-gold/15 bg-[#0c0a09]/90">
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          aria-hidden="true"
          style={{
            background: 'radial-gradient(circle at 0% 0%, rgba(242,204,96,.06), transparent 38%), linear-gradient(120deg, rgba(255,255,255,.018), transparent 42%)',
          }}
        />
        <div className="relative p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-bright" />
                <span className="text-[10px] font-bold uppercase tracking-[.22em] text-gold-dim">Clan Management</span>
              </div>
              <h1 className="font-spectral text-3xl font-bold tracking-tight text-text-bright">Attendance</h1>
              <p className="mt-1 text-sm text-text-dim">
                {isElder ? 'Mark the members who attended and record their reward.' : 'View clan attendance and event participation.'}
              </p>
            </div>

            <div className="flex flex-wrap items-stretch gap-2">
              <div className="rounded-xl border border-white/[.07] bg-black/20 px-4 py-2.5 min-w-[100px]">
                <div className="text-[9px] font-bold uppercase tracking-[.15em] text-text-dim">Members</div>
                <div className="mt-1 text-xl font-mono font-bold tabular-nums text-text-bright">{members.length}</div>
              </div>
              {isElder && (
                <div className="rounded-xl border border-gold/20 bg-gold/[.04] px-4 py-2.5 min-w-[100px]">
                  <div className="text-[9px] font-bold uppercase tracking-[.15em] text-gold-dim">Selected</div>
                  <div className="mt-1 text-xl font-mono font-bold tabular-nums text-gold-bright">{selectedCount}</div>
                </div>
              )}
              <div className="rounded-xl border border-gold/20 bg-gold/[.04] px-4 py-2.5 min-w-[210px]">
                <div className="text-[9px] font-bold uppercase tracking-[.15em] text-gold-dim">Server Time · {SERVER_TZ_LABEL}</div>
                <div className="mt-1 text-sm font-mono font-bold tabular-nums text-gold-light whitespace-nowrap">{formatGMT8(now)}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/[.07] bg-black/20 px-3 py-2 text-[11px] text-text-dim">
              <span className="text-green-400">●</span>
              <span><span className="text-text-bright font-semibold">{attendanceLogs.length}</span> attendance log{attendanceLogs.length === 1 ? '' : 's'}</span>
            </div>

            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setPickerOpen(o => !o)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 ${pickerOpen ? 'border-gold/60 bg-gold/[.06] text-gold-bright' : 'border-white/[.08] bg-black/20 text-text-dim hover:border-gold/35 hover:text-text-bright'}`}
                aria-expanded={pickerOpen}
              >
                <FlagImage code={activeRegion.code} flag={activeRegion.flag} name={activeRegion.name} width={20} height={15} />
                <span className="font-semibold">{activeRegion.name}</span>
                <span className="font-mono text-[10px] text-text-dim">{formatInZone(now, activeRegion.tz)}</span>
                <span className={`transition-transform ${pickerOpen ? 'rotate-180' : ''}`}>⌄</span>
              </button>

              {pickerOpen && (
                <div className="absolute right-0 top-full mt-2 w-[260px] max-h-[420px] rounded-xl border border-gold/25 bg-[#0c0a09] shadow-2xl overflow-auto z-[100]">
                  <div className="sticky top-0 px-4 py-2.5 border-b border-white/[.06] bg-[#0c0a09]">
                    <div className="text-[9px] font-bold uppercase tracking-[.18em] text-gold-dim">Local Region</div>
                    <div className="mt-0.5 text-[10px] text-text-dim">Choose the timezone used for local times.</div>
                  </div>
                  {regions.map(r => {
                    const isActive = r.id === activeRegion.id
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => pickRegion(r.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-gold/10 text-gold-bright' : 'text-text hover:bg-white/[.03] hover:text-text-bright'}`}
                      >
                        <FlagImage code={r.code} flag={r.flag} name={r.name} />
                        <span className="flex-1 min-w-0 text-xs font-semibold truncate">{r.name || r.label || r.id}</span>
                        <span className="text-[10px] font-mono text-text-dim">{r.label || ''}</span>
                        {isActive && <span className="text-gold-bright text-xs">✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* One-step recording workspace */}
      {isElder && (
        <section className="rounded-2xl border border-gold/20 bg-[#0c0a09]/85 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[.06] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text-bright">Record Attendance</h2>
              <p className="mt-1 text-[11px] text-text-dim">Choose the event, set the reward, then mark the members who attended.</p>
            </div>
            <div className="text-[10px] text-text-dim font-mono">Maximum clan size: 50 members</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-0 border-b border-white/[.06]">
            <div className="p-5 border-b lg:border-b-0 lg:border-r border-white/[.06]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.16em] text-text-dim">Event</span>
                  <select className="input w-full h-10" value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
                    {eventTypes.map(e => <option key={e}>{e}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.16em] text-text-dim">Coins Per Member</span>
                  <div className="flex gap-2">
                    <input
                      className="input w-full h-10 font-mono tabular-nums"
                      type="number"
                      min="0"
                      step="1"
                      value={coinAmount}
                      onChange={e => setCoinAmount(e.target.value)}
                      placeholder="25"
                    />
                    <span className="self-center text-[10px] text-text-dim">coins</span>
                  </div>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {[10, 25, 50, 100, 200].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCoinAmount(v)}
                    className={`rounded-md border px-2.5 py-1.5 text-[10px] font-mono transition-colors ${Number(coinAmount) === v ? 'border-gold/50 bg-gold/10 text-gold-bright' : 'border-white/[.08] text-text-dim hover:border-gold/30 hover:text-gold-light'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-white/[.06] bg-black/15 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-[10px] text-text-dim">
                  <span>Selected members</span>
                  <strong className="font-mono text-text-bright">{selectedCount} / {members.length}</strong>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-text-dim">
                  <span>Reward per member</span>
                  <strong className="font-mono text-gold-light">+{(Number(coinAmount) || 0).toLocaleString()}</strong>
                </div>
                <div className="mt-2 pt-2 border-t border-white/[.06] flex items-center justify-between gap-3 text-[10px] text-text-dim">
                  <span>Total reward</span>
                  <strong className="font-mono text-gold-bright">{selectedTotalCoins.toLocaleString()} coins</strong>
                </div>
              </div>

              <div className="mt-3 text-[9px] text-text-dim">
                Attendance will be recorded at <span className="font-mono text-gold-light">{formatGMT8(now)}</span> server time.
              </div>
            </div>

            <div className="p-5 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[.16em] text-text-dim">Members</div>
                  <div className="mt-0.5 text-xs text-text-bright"><span className="font-mono">{selectedCount}</span> selected</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={toggleAllFiltered} className="text-[10px] font-semibold text-gold-light hover:text-gold-bright">
                    {allFilteredSelected ? 'Clear Visible' : `Select ${filtered.length === members.length ? 'All' : 'Visible'}`}
                  </button>
                  {selectedCount > 0 && (
                    <button type="button" onClick={clearSelection} className="text-[10px] text-text-dim hover:text-red-300">Clear All</button>
                  )}
                </div>
              </div>

              <div className="relative mb-3">
                <input
                  className="input w-full h-10 pl-9"
                  placeholder="Search member name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim text-xs">⌕</span>
              </div>

              <div className="rounded-xl border border-white/[.07] overflow-hidden">
                <div className="grid grid-cols-[34px_minmax(0,1fr)_90px] items-center gap-2 px-3 py-2 border-b border-white/[.06] bg-black/20 text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">
                  <span />
                  <span>Member</span>
                  <span className="text-right">Attendance</span>
                </div>
                <div className="max-h-[360px] overflow-y-auto divide-y divide-white/[.045]">
                  {filtered.map(m => {
                    const checked = !!selectedMembers[m.id]
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMember(m.id)}
                        aria-pressed={checked}
                        className={`w-full grid grid-cols-[34px_minmax(0,1fr)_90px] items-center gap-2 px-3 py-2.5 text-left transition-colors ${checked ? 'bg-gold/[.055]' : 'hover:bg-white/[.025]'}`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-md border text-[11px] ${checked ? 'border-gold bg-gold text-black' : 'border-white/15 bg-black/20 text-transparent'}`}>✓</span>
                        <span className="min-w-0">
                          <span className={`block truncate text-xs font-semibold ${checked ? 'text-gold-light' : 'text-text-bright'}`}>{m.name}</span>
                          <span className="block mt-0.5 truncate text-[9px] text-text-dim">{m.cls || 'Member'}</span>
                        </span>
                        <span className="text-right text-[10px] font-mono tabular-nums text-text-dim">{m.attendance || 0}</span>
                      </button>
                    )
                  })}
                  {filtered.length === 0 && (
                    <div className="px-4 py-10 text-center text-xs text-text-dim">No members found.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={`px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${selectedCount > 0 ? 'bg-gold/[.035]' : 'bg-black/10'}`}>
            <div>
              <div className="text-xs font-semibold text-text-bright">
                {selectedCount > 0 ? `${selectedCount} member${selectedCount === 1 ? '' : 's'} ready` : 'No members selected'}
              </div>
              <div className="mt-0.5 text-[10px] text-text-dim">
                {selectedCount > 0 ? `${selectedEvent} · +${(Number(coinAmount) || 0).toLocaleString()} coins each` : 'Select the members who attended this event.'}
              </div>
            </div>
            <button
              type="button"
              onClick={recordAttendance}
              disabled={submitting || selectedCount === 0}
              className="btn-gold min-h-10 px-6 text-sm font-bold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : selectedCount > 0 ? `Record ${selectedCount} Member${selectedCount === 1 ? '' : 's'}` : 'Select Members First'}
            </button>
          </div>
        </section>
      )}

      {/* Attendance history — compact for up to 50 attendees */}
      <section className="rounded-2xl border border-white/[.07] bg-[#0c0a09]/70 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[.06] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-text-bright">Recent Attendance</h2>
            <p className="mt-0.5 text-[10px] text-text-dim">Event records · open a record to view attendees</p>
          </div>
          <span className="rounded-md border border-white/[.07] bg-black/20 px-2 py-1 text-[10px] font-mono text-text-dim">
            {sortedLogs.length} log{sortedLogs.length === 1 ? '' : 's'}
          </span>
        </div>

        {sortedLogs.length > 0 ? (
          <div className="divide-y divide-white/[.05]">
            {sortedLogs.slice(0, 30).map(log => {
              const attendees = log.attendees || []
              const coinEach = attendees[0]?.earned ?? 0
              const logTs = log.ts || Number(log.id) || new Date(log.date).getTime() || 0
              const isDeleting = deletingId === log.id
              const totalAwarded = attendees.reduce((sum, a) => sum + (a.earned || 0), 0)

              return (
                <div key={log.id} className="px-5 py-3.5 hover:bg-white/[.015] transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text-bright">{log.event}</span>
                        <span className="rounded-md border border-white/[.07] bg-black/20 px-1.5 py-0.5 text-[9px] font-mono text-text-dim">
                          {log.members || attendees.length}/50
                        </span>
                        <span className="rounded-md border border-green-500/15 bg-green-500/[.035] px-1.5 py-0.5 text-[9px] font-semibold text-green-400">
                          +{coinEach.toLocaleString()} each
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-dim">
                        <span className="font-mono tabular-nums">
                          {formatGMT8Short(logTs)} · {SERVER_TZ_LABEL}
                        </span>

                        {logTs > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-gold-light/75">
                            <FlagImage
                              code={activeRegion.code}
                              flag={activeRegion.flag}
                              name={activeRegion.name}
                              width={14}
                              height={10}
                            />
                            <span>{formatInZone(logTs, activeRegion.tz)}</span>
                          </span>
                        )}

                        <span>
                          by <strong className="text-gold-light">{log.recorded_by || log.recordedBy || 'System'}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 lg:flex-shrink-0">
                      <span className="text-[10px] text-text-dim">
                        {totalAwarded.toLocaleString()} total
                      </span>

                      <button
                        type="button"
                        onClick={() => setDetailLog(log)}
                        className="rounded-lg border border-gold/20 bg-gold/[.035] px-3 py-1.5 text-[10px] font-semibold text-gold-light hover:border-gold/40 hover:bg-gold/[.08] transition-colors"
                      >
                        View {attendees.length}/50
                      </button>

                      {isElder && (
                        <button
                          type="button"
                          onClick={() => deleteLog(log)}
                          disabled={isDeleting}
                          className="rounded-lg border border-red-500/20 px-2.5 py-1.5 text-[10px] font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                        >
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.07] bg-black/20 text-gold-light">✓</div>
            <div className="mt-3 text-sm font-semibold text-text-dim">No attendance recorded yet.</div>
            {isElder && (
              <div className="mt-1 text-[10px] text-text-dim">
                Use the recording panel above when an event is completed.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Attendee details — fixed-size modal so 50 members never make the page excessively long */}
      {detailLog && (() => {
        const attendees = detailLog.attendees || []
        const logTs = detailLog.ts || Number(detailLog.id) || new Date(detailLog.date).getTime() || 0
        const coinEach = attendees[0]?.earned ?? 0
        const totalAwarded = attendees.reduce((sum, a) => sum + (a.earned || 0), 0)

        return (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label={`${detailLog.event} attendance`}
            onMouseDown={e => {
              if (e.target === e.currentTarget) setDetailLog(null)
            }}
          >
            <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-2xl border border-gold/20 bg-[#0c0a09] shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-white/[.06] px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-text-bright">{detailLog.event}</h3>
                    <span className="rounded-md border border-white/[.07] bg-black/20 px-1.5 py-0.5 text-[9px] font-mono text-text-dim">
                      {attendees.length}/50
                    </span>
                    <span className="rounded-md border border-green-500/15 bg-green-500/[.035] px-1.5 py-0.5 text-[9px] font-semibold text-green-400">
                      +{coinEach.toLocaleString()} each
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-dim">
                    <span className="font-mono tabular-nums">
                      {formatGMT8Short(logTs)} · {SERVER_TZ_LABEL}
                    </span>

                    {logTs > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-gold-light/75">
                        <FlagImage
                          code={activeRegion.code}
                          flag={activeRegion.flag}
                          name={activeRegion.name}
                          width={14}
                          height={10}
                        />
                        <span>{formatInZone(logTs, activeRegion.tz)}</span>
                      </span>
                    )}

                    <span>
                      by <strong className="text-gold-light">{detailLog.recorded_by || detailLog.recordedBy || 'System'}</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailLog(null)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[.08] text-text-dim hover:border-gold/30 hover:text-gold-light transition-colors"
                  aria-label="Close attendee details"
                >
                  ×
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.06] px-5 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[.15em] text-gold-dim">
                  Attendees · {attendees.length} / 50
                </div>
                <div className="text-[10px] text-text-dim">
                  Total awarded <strong className="text-gold-light">{totalAwarded.toLocaleString()}</strong> coins
                </div>
              </div>

              <div className="max-h-[58vh] overflow-y-auto p-4 md:p-5">
                {attendees.length === 0 ? (
                  <div className="py-10 text-center text-xs text-text-dim italic">
                    No attendee details saved for this log.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                    {attendees.map((a, idx) => (
                      <div
                        key={`${a.name}-${idx}`}
                        className="min-w-0 rounded-lg border border-white/[.06] bg-black/15 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-gold/[.06] text-[9px] font-mono text-gold-dim">
                            {idx + 1}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold text-text-bright">{a.name}</div>
                            {a.cls && (
                              <div className="mt-0.5 truncate text-[9px] text-text-dim">{a.cls}</div>
                            )}
                          </div>

                          <span className="flex-shrink-0 text-[10px] font-mono font-bold text-green-400">
                            +{(a.earned || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
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
