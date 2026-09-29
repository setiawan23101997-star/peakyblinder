import React, { useEffect, useMemo, useRef, useState } from 'react'

const STAFF_ROLES = ['Admin', 'Master', 'Elder']
const SERVER_TZ = 'Asia/Singapore'

function formatDate(value) {
  if (!value) return 'Unknown date'
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? new Date(`${value}T00:00:00+08:00`)
    : new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SERVER_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function formatDateTime(value) {
  if (!value) return 'Unknown'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SERVER_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed)
}

function formatTime(ts) {
  if (!ts) return ''
  const n = Number(ts)
  if (!Number.isFinite(n)) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SERVER_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(n))
}

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(rows, filename) {
  const headers = ['No.', 'Event Date', 'Event', 'Session', 'Player', 'Item', 'Quantity', 'Result', 'Roll Time']
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(',')),
  ].join('\r\n')
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function normalizeAttendanceLog(log) {
  const attendees = Array.isArray(log?.attendees) ? log.attendees : []
  const session = attendees.find(a => a?.sessionDisplayName || a?.sessionLabel)
  return {
    ...log,
    _sessionId: session?.sessionId || log?.sessionId || null,
    _sessionName: session?.sessionDisplayName || session?.sessionLabel || log?.event || 'Event Run',
    _date: log?.date || (log?.ts ? formatDate(log.ts) : 'Unknown date'),
    _participants: attendees.filter(a => a?.memberId != null && a?.name),
  }
}

function getRunLabel(sessionName) {
  const name = String(sessionName || '').toLowerCase()
  if (name.includes('first run')) return 'First Run'
  if (name.includes('second run')) return 'Second Run'
  return 'Single Run'
}

function runBadgeClass(run) {
  if (run === 'First Run') return 'border-sky-400/25 bg-sky-400/[.06] text-sky-300'
  if (run === 'Second Run') return 'border-violet-400/25 bg-violet-400/[.06] text-violet-300'
  return 'border-white/10 bg-white/[.03] text-text-dim'
}


function parseLootInput(value) {
  const name = String(value || '').trim()
  return { name, quantity: name ? 1 : 0 }
}

function getResultItemQuantity(item, results) {
  if (!item) return 1
  const used = results.filter(r => String(r.item_id) === String(item.id)).length
  return Math.max(0, Number(item.quantity) - used)
}

function buildCsvRows(roulette, results, itemsById = new Map()) {
  return results.map(row => {
    const isNothing = String(row.item_name || '').toLowerCase() === 'nothing'
    return {
      'No.': row.roll_number,
      'Event Date': roulette.event_date || '',
      'Event': roulette.event || '',
      'Session': roulette.session_display_name || '',
      'Player': row.winner_name || '',
      'Item': row.item_name || 'Nothing',
      'Quantity': isNothing ? 0 : 1,
      'Result': isNothing ? 'Nothing' : 'Loot',
      'Roll Time': row.rolled_at ? formatDateTime(row.rolled_at) : '',
    }
  })
}

function AttendancePicker({ options, value, onChange, activeAttendanceIds }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = options.find(log => String(log.id) === String(value)) || null

  useEffect(() => {
    const onPointerDown = event => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border border-gold/15 bg-[#151210] px-3 py-2.5 text-left text-sm text-text-bright outline-none transition hover:border-gold/30 focus:border-gold/40 focus:ring-2 focus:ring-gold/10"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 truncate">
          {selected ? `${selected.event} · ${selected._sessionName} · ${selected._date}` : 'Select attendance record...'}
        </span>
        <span className={`shrink-0 text-text-dim transition ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-gold/20 bg-[#151210] p-1.5 shadow-2xl shadow-black/50" role="listbox">
          {options.map(log => {
            const used = activeAttendanceIds.has(String(log.id))
            const isSelected = String(log.id) === String(value)
            return (
              <button
                key={log.id}
                type="button"
                disabled={used}
                onClick={() => { onChange(String(log.id)); setOpen(false) }}
                className={`mb-1 w-full rounded-lg border px-3 py-2.5 text-left transition last:mb-0 ${
                  used
                    ? 'cursor-not-allowed border-white/[.04] bg-white/[.02] opacity-50'
                    : isSelected
                      ? 'border-gold/25 bg-gold/[.08]'
                      : 'border-transparent bg-transparent hover:border-white/[.07] hover:bg-white/[.05]'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-white">{log.event}</div>
                    <div className="mt-0.5 truncate text-[10px] text-white/65">{log._sessionName} · {log._date}</div>
                  </div>
                  <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${used ? 'border-emerald-400/15 bg-emerald-400/[.04] text-emerald-300' : 'border-gold/15 bg-gold/[.04] text-gold-light'}`}>
                    {used ? 'ROULETTE EXISTS' : `${log._participants.length} PLAYERS`}
                  </span>
                </div>
              </button>
            )
          })}
          {!options.length && <div className="px-3 py-4 text-center text-xs text-white/55">No Attendance records with participants.</div>}
        </div>
      )}
    </div>
  )
}

export default function LootRoulette({ ctx }) {
  const { attendanceLogs, currentUser, addToast, supabase } = ctx
  const isStaff = STAFF_ROLES.includes(currentUser?.role)

  const firstItemRef = useRef(null)
  const modalRef = useRef(null)
  const animationTimersRef = useRef(new Set())
  const pausedRef = useRef(false)
  const skipRef = useRef(false)

  const [selectedAttendanceId, setSelectedAttendanceId] = useState('')
  const [items, setItems] = useState([{ name: '' }])
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [roulette, setRoulette] = useState(null)
  const [participants, setParticipants] = useState([])
  const [rouletteItems, setRouletteItems] = useState([])
  const [results, setResults] = useState([])
  const [spinning, setSpinning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [skipRequested, setSkipRequested] = useState(false)
  const [animationItem, setAnimationItem] = useState(null)
  const [animationWinner, setAnimationWinner] = useState(null)
  const [animationIndex, setAnimationIndex] = useState(0)
  const [animationTotal, setAnimationTotal] = useState(0)
  const [batchSummary, setBatchSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyLimit, setHistoryLimit] = useState(100)
  const [activeAttendanceIds, setActiveAttendanceIds] = useState(() => new Set())
  const [historySearch, setHistorySearch] = useState('')
  const [expandedHistoryIds, setExpandedHistoryIds] = useState(() => new Set())
  const [confirmCreate, setConfirmCreate] = useState(false)
  const [confirmRoll, setConfirmRoll] = useState(false)
  const [voidTarget, setVoidTarget] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [actionPassword, setActionPassword] = useState('')
  const [actionTarget, setActionTarget] = useState(null)
  const [actionType, setActionType] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [rollRecovery, setRollRecovery] = useState(false)
  const [activeMenuOpen, setActiveMenuOpen] = useState(false)
  const [rollPanelOpen, setRollPanelOpen] = useState(false)
  const [reducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (rollPanelOpen && roulette && roulette.status !== 'ready') setRollPanelOpen(false)
  }, [rollPanelOpen, roulette])

  const attendanceOptions = useMemo(() => (
    [...(attendanceLogs || [])]
      .map(normalizeAttendanceLog)
      .filter(log => log._participants.length > 0)
      .sort((a, b) => Number(b.ts || b.id || 0) - Number(a.ts || a.id || 0))
  ), [attendanceLogs])

  const selectedAttendance = attendanceOptions.find(log => String(log.id) === String(selectedAttendanceId)) || null
  const eligibleParticipants = participants.filter(p => !results.some(r => String(r.winner_member_id) === String(p.member_id)))
  const remainingLootUnits = rouletteItems.reduce((sum, item) => sum + getResultItemQuantity(item, results), 0)
  const completedParticipants = participants.length - eligibleParticipants.length
  const distributedLootUnits = results.filter(r => String(r.item_name || '').toLowerCase() !== 'nothing').length
  const nothingCount = results.filter(r => String(r.item_name || '').toLowerCase() === 'nothing').length

  const historyEvents = useMemo(
    () => [...new Set(history.map(r => r.event).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))),
    [history]
  )

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    if (!query) return history
    return history.filter(r => {
      const haystack = [
        r.event,
        r.session_display_name,
        r.event_date,
        ...(r.results || []).flatMap(row => [row.winner_name, row.item_name]),
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [history, historySearch])

  const hasMoreHistory = history.length >= historyLimit

  const clearAnimationTimers = () => {
    animationTimersRef.current.forEach(timer => {
      window.clearTimeout(timer)
      window.clearInterval(timer)
    })
    animationTimersRef.current.clear()
  }

  useEffect(() => {
    if (!selectedAttendanceId && attendanceOptions[0]) setSelectedAttendanceId(String(attendanceOptions[0].id))
  }, [attendanceOptions, selectedAttendanceId])

  useEffect(() => {
    if (!attendanceOptions.length) return
    if (selectedAttendanceId && !activeAttendanceIds.has(String(selectedAttendanceId))) return
    const firstAvailable = attendanceOptions.find(log => !activeAttendanceIds.has(String(log.id)))
    if (firstAvailable) setSelectedAttendanceId(String(firstAvailable.id))
  }, [attendanceOptions, activeAttendanceIds, selectedAttendanceId])

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        if (voidTarget && !voiding) setVoidTarget(null)
        else if (confirmCreate) setConfirmCreate(false)
        else if (confirmRoll) setConfirmRoll(false)
        else {
          setActiveMenuOpen(false)
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [voidTarget, voiding, confirmCreate, confirmRoll])

  useEffect(() => {
    if (voidTarget || confirmCreate || confirmRoll) {
      const timer = window.setTimeout(() => modalRef.current?.focus(), 0)
      return () => window.clearTimeout(timer)
    }
  }, [voidTarget, confirmCreate, confirmRoll])

  useEffect(() => () => {
    clearAnimationTimers()
    pausedRef.current = false
    skipRef.current = false
  }, [])

  const loadHistory = async (nextLimit = historyLimit) => {
    if (!supabase) return
    setHistoryLoading(true)
    try {
      const [{ data: rows, error }, { data: activeRows, error: activeError }] = await Promise.all([
        supabase.from('loot_roulettes').select('*').order('created_at', { ascending: false }).limit(nextLimit),
        supabase.from('loot_roulettes').select('attendance_log_id').neq('status', 'void'),
      ])
      if (error) throw error
      if (activeError) console.error('Failed to load active attendance usage:', activeError)

      setActiveAttendanceIds(new Set((activeRows || []).map(row => String(row.attendance_log_id))))

      const rouletteRows = rows || []
      if (!rouletteRows.length) {
        setHistory([])
        return
      }

      const ids = rouletteRows.map(r => r.id)
      const [{ data: resultRows }, { data: participantRows }, { data: itemRows }] = await Promise.all([
        supabase.from('loot_roulette_results').select('*').in('roulette_id', ids).order('roll_number', { ascending: true }),
        supabase.from('loot_roulette_participants').select('*').in('roulette_id', ids),
        supabase.from('loot_roulette_items').select('*').in('roulette_id', ids).order('display_order', { ascending: true }),
      ])

      const grouped = rouletteRows.map(r => ({
        ...r,
        results: (resultRows || []).filter(x => String(x.roulette_id) === String(r.id)),
        participants: (participantRows || []).filter(x => String(x.roulette_id) === String(r.id)),
        items: (itemRows || []).filter(x => String(x.roulette_id) === String(r.id)),
      }))
      setHistory(grouped)

    } catch (error) {
      console.error('Failed to load loot history:', error)
      addToast(error?.message || 'Could not load loot history.', 'red', 'History Failed')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const resetCreateForm = () => setItems([{ name: '' }])

  const addItemRow = (focusNew = false) => {
    setItems(prev => [...prev, { name: '' }])
    if (focusNew) setTimeout(() => firstItemRef.current?.focus(), 0)
  }

  const removeItemRow = index => setItems(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index))

  const updateItem = (index, key, value) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [key]: value } : item))
  }

  const handleItemKeyDown = (event, index) => {
    if (event.key !== 'Enter' || event.isComposing) return
    event.preventDefault()
    const parsed = parseLootInput(items[index].name)
    if (!parsed.name) return
    addItemRow(true)
  }

  const getCreatePayload = () => items
    .map(item => ({ name: String(item.name || '').trim(), quantity: 1 }))
    .filter(item => item.name)

  const requestCreateRoulette = () => {
    if (!isStaff) return
    if (!selectedAttendance) {
      addToast('Select an attendance event first.', 'red', 'Event Required')
      return
    }
    if (activeAttendanceIds.has(String(selectedAttendance.id))) {
      addToast('This Attendance record already has a non-void Loot Roulette.', 'red', 'Roulette Already Exists')
      return
    }
    const payload = getCreatePayload()
    if (!payload.length) {
      addToast('Add at least one loot item, for example “Dragon Scale”.', 'red', 'Loot Required')
      return
    }
    setConfirmCreate(true)
  }

  const createRoulette = async () => {
    const payload = getCreatePayload()
    if (!selectedAttendance || !payload.length) return
    setConfirmCreate(false)
    setCreating(true)
    try {
      const actorId = Number(currentUser?.id) || null
      const actorPassword = currentUser?.password || ''
      const { data, error } = await supabase.rpc('create_loot_roulette', {
        p_attendance_log_id: Number(selectedAttendance.id),
        p_items: payload,
        p_actor_id: actorId,
        p_actor_password: actorPassword,
      })
      if (error) throw error

      resetCreateForm()
      setCreateOpen(false)
      await openRoulette(data.id)
      setRollPanelOpen(true)
      await loadHistory()
      addToast('Loot Roulette created. Participants were imported from Attendance.', 'gold', 'Roulette Ready')
    } catch (error) {
      console.error('Create loot roulette failed:', error)
      addToast(error?.message || 'Could not create Loot Roulette.', 'red', 'Create Failed')
    } finally {
      setCreating(false)
    }
  }

  const openRoulette = async id => {
    if (!id) return
    try {
      const { data: r, error: rError } = await supabase.from('loot_roulettes').select('*').eq('id', id).single()
      if (rError) throw rError
      const [{ data: p, error: pError }, { data: i, error: iError }, { data: res, error: resError }] = await Promise.all([
        supabase.from('loot_roulette_participants').select('*').eq('roulette_id', id).order('player_name'),
        supabase.from('loot_roulette_items').select('*').eq('roulette_id', id).order('display_order'),
        supabase.from('loot_roulette_results').select('*').eq('roulette_id', id).order('roll_number'),
      ])
      if (pError) throw pError
      if (iError) throw iError
      if (resError) throw resError

      clearAnimationTimers()
      pausedRef.current = false
      skipRef.current = false
      setPaused(false)
      setSkipRequested(false)
      setSpinning(false)
      setAnimationItem(null)
      setAnimationWinner(null)
      setAnimationIndex(0)
      setAnimationTotal(0)
      setBatchSummary(null)
      setRoulette(r)
      setParticipants(p || [])
      setRouletteItems(i || [])
      setResults(res || [])
    } catch (error) {
      console.error('Failed to open loot roulette:', error)
      addToast(error?.message || 'Could not load this Loot Roulette.', 'red', 'Load Failed')
    }
  }

  const normalizeRolledRow = row => ({
    id: row.id,
    roulette_id: roulette?.id,
    roll_number: row.rollNumber ?? row.roll_number,
    winner_member_id: row.winnerMemberId ?? row.winner_member_id,
    winner_name: row.winnerName ?? row.winner_name,
    item_id: row.itemId ?? row.item_id,
    item_name: row.itemName ?? row.item_name,
    rolled_at: row.rolledAt ?? row.rolled_at,
  })

  const orderedLootResults = (rolled, itemRows) => {
    const normalized = rolled.map(normalizeRolledRow)
    const loot = normalized.filter(row => String(row.item_name || '').toLowerCase() !== 'nothing')
    const used = new Set()
    const ordered = []

    itemRows.forEach(item => {
      loot
        .filter(row => String(row.item_id) === String(item.id))
        .sort((a, b) => Number(a.roll_number || 0) - Number(b.roll_number || 0))
        .forEach(row => {
          if (!used.has(row.id || `${row.roll_number}-${row.item_id}`)) {
            used.add(row.id || `${row.roll_number}-${row.item_id}`)
            ordered.push(row)
          }
        })
    })
    loot.forEach(row => {
      const key = row.id || `${row.roll_number}-${row.item_id}`
      if (!used.has(key)) ordered.push(row)
    })
    return { normalized, ordered }
  }

  const animateResults = async (rolled, itemRows) => {
    const { normalized, ordered } = orderedLootResults(rolled, itemRows)
    setAnimationTotal(ordered.length)
    setAnimationIndex(0)

    if (reducedMotion || ordered.length === 0) {
      await openRoulette(roulette.id)
      setBatchSummary({
        count: normalized.length,
        loot: ordered.length,
        nothing: normalized.filter(row => String(row.item_name || '').toLowerCase() === 'nothing').length,
      })
      setSpinning(false)
      await loadHistory(historyLimit)
      return
    }

    const names = participants.map(p => p.player_name).filter(Boolean)
    for (let index = 0; index < ordered.length; index += 1) {
      if (skipRef.current) skipRef.current = false
      const row = ordered[index]
      const item = itemRows.find(i => String(i.id) === String(row.item_id))
      setAnimationItem(item || { id: row.item_id, name: row.item_name })
      setAnimationWinner(row)
      setAnimationIndex(index + 1)

      await new Promise(resolve => {
        const duration = 1250 + Math.min(index * 90, 450)
        let elapsed = 0
        let last = performance.now()
        let tick = 0

        const step = () => {
          const now = performance.now()
          if (!pausedRef.current) {
            elapsed += now - last
            tick += 1
            const progress = Math.min(1, elapsed / duration)

            if (skipRef.current || progress >= 1) {
              skipRef.current = false
              setAnimationWinner(prev => ({ ...prev, _displayName: row.winner_name }))
              resolve()
              return
            }

            const candidate = names.length ? names[tick % names.length] : row.winner_name
            setAnimationWinner(prev => ({
              ...prev,
              _displayName: progress > 0.72 ? row.winner_name : candidate,
            }))
          }
          last = now

          const delay = Math.round(35 + Math.pow(Math.min(elapsed / duration, 1), 2) * 105)
          const timer = window.setTimeout(() => {
            animationTimersRef.current.delete(timer)
            step()
          }, delay)
          animationTimersRef.current.add(timer)
        }

        step()
      })
    }

    await openRoulette(roulette.id)
    setBatchSummary({
      count: normalized.length,
      loot: ordered.length,
      nothing: normalized.filter(row => String(row.item_name || '').toLowerCase() === 'nothing').length,
    })
    setAnimationItem(null)
    setAnimationWinner(null)
    setSpinning(false)
    setPaused(false)
    pausedRef.current = false
    skipRef.current = false
    await loadHistory(historyLimit)
  }

  const requestSpin = () => {
    if (!roulette || spinning || roulette.status === 'completed' || roulette.status === 'void') return
    if (!eligibleParticipants.length || !remainingLootUnits) {
      addToast('There are no eligible players or loot remaining.', 'red', 'Roulette Complete')
      return
    }
    setConfirmRoll(true)
  }

  const spin = async () => {
    if (!roulette || spinning || roulette.status === 'completed' || roulette.status === 'void') return
    if (!eligibleParticipants.length || !remainingLootUnits) return

    setConfirmRoll(false)
    setRollRecovery(false)
    setBatchSummary(null)
    setSpinning(true)
    setPaused(false)
    setSkipRequested(false)
    pausedRef.current = false
    skipRef.current = false

    try {
      const actorId = Number(currentUser?.id) || null
      const actorPassword = currentUser?.password || ''
      const { data, error } = await supabase.rpc('spin_all_loot_roulette', {
        p_roulette_id: roulette.id,
        p_actor_id: actorId,
        p_actor_password: actorPassword,
      })
      if (error) throw error

      const rolled = Array.isArray(data?.results) ? data.results : []
      if (!rolled.length) {
        await openRoulette(roulette.id)
        const refreshed = await supabase.from('loot_roulette_results').select('*').eq('roulette_id', roulette.id)
        if (refreshed.error || !(refreshed.data || []).length) {
          setSpinning(false)
          setRollRecovery(true)
          addToast('The server did not return a confirmed roll. Refresh before trying again.', 'red', 'Roll Status Unknown')
          return
        }
        setSpinning(false)
        return
      }

      await animateResults(rolled, rouletteItems)
    } catch (error) {
      console.error('Loot Roulette batch roll failed:', error)
      setSpinning(false)
      setRollRecovery(true)
      addToast('The server could not confirm the roll. Refresh the roulette before trying again.', 'red', 'Roll Status Unknown')
    }
  }

  const togglePause = () => {
    if (!spinning) return
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
  }

  const skipAnimation = () => {
    if (!spinning) return
    skipRef.current = true
    setSkipRequested(true)
    if (pausedRef.current) {
      pausedRef.current = false
      setPaused(false)
    }
  }

  const requestVoid = target => {
    if (!target || !isStaff || target.status === 'void') return
    setActiveMenuOpen(false)
    setVoidReason('')
    setActionPassword('')
    setActionTarget(target)
    setActionType('void')
    setVoidTarget(target)
  }

  const requestDelete = target => {
    if (!target || !isStaff || deleting) return
    setActiveMenuOpen(false)
    setActionPassword('')
    setActionTarget(target)
    setActionType('delete')
  }

  const closeStaffAction = () => {
    if (deleting || voiding) return
    setActionTarget(null)
    setActionType(null)
    setActionPassword('')
    setVoidReason('')
    setVoidTarget(null)
  }

  const confirmStaffAction = async () => {
    const target = actionTarget
    if (!target || !isStaff || !actionPassword.trim()) {
      addToast('Enter your staff login password first.', 'red', 'Password Required')
      return
    }

    const actorId = Number(currentUser?.id) || null
    if (!actorId) {
      addToast('Your staff login session is missing the member ID. Please log out and log in again.', 'red', 'Session Error')
      return
    }

    const password = actionPassword
    if (actionType === 'void') setVoiding(true)
    else setDeleting(true)

    try {
      const rpcName = actionType === 'void' ? 'void_loot_roulette' : 'delete_loot_roulette'
      const payload = actionType === 'void'
        ? {
            p_roulette_id: target.id,
            p_actor_id: actorId,
            p_actor_password: password,
            p_reason: voidReason.trim() || null,
          }
        : {
            p_roulette_id: target.id,
            p_actor_id: actorId,
            p_actor_password: password,
          }

      const { data, error } = await supabase.rpc(rpcName, payload)
      if (error) throw error

      if (actionType === 'void') {
        if (data?.status !== 'void') throw new Error('The server did not confirm that the roulette was voided.')
        const id = target.id
        setActionTarget(null)
        setActionType(null)
        setActionPassword('')
        setVoidReason('')
        setVoidTarget(null)
        await openRoulette(id)
        await loadHistory(historyLimit)
        addToast('Roulette voided. Attendance remains unchanged.', 'gold', 'Roulette Voided')
      } else {
        if (!data?.deleted) throw new Error('The server did not confirm that the roulette was deleted.')

        const targetId = String(target.id)
        const { data: stillThere, error: verifyError } = await supabase
          .from('loot_roulettes')
          .select('id')
          .eq('id', targetId)
          .maybeSingle()
        if (verifyError) throw verifyError
        if (stillThere) throw new Error('The server reported success, but the roulette still exists in the database.')

        if (String(roulette?.id) === targetId) {
          setRollPanelOpen(false)
          setRoulette(null)
          setParticipants([])
          setRouletteItems([])
          setResults([])
          setBatchSummary(null)
          setAnimationItem(null)
          setAnimationWinner(null)
        }

        setExpandedHistoryIds(prev => {
          const next = new Set(prev)
          next.delete(target.id)
          return next
        })

        setActionTarget(null)
        setActionType(null)
        setActionPassword('')
        await loadHistory(historyLimit)
        addToast('Loot Roulette deleted successfully. Attendance remains unchanged.', 'gold', 'Roulette Deleted')
      }
    } catch (error) {
      console.error(`${actionType} Loot Roulette failed:`, error)
      addToast(error?.message || `Could not ${actionType} Loot Roulette.`, 'red', `${actionType === 'void' ? 'Void' : 'Delete'} Failed`)
    } finally {
      setVoiding(false)
      setDeleting(false)
    }
  }

  const confirmVoid = async () => {
    setActionType('void')
    await confirmStaffAction()
  }

  const deleteRoulette = async target => {
    requestDelete(target)
  }

  const startReplacement = () => {
    if (!roulette || roulette.status !== 'void') return
    setSelectedAttendanceId(String(roulette.attendance_log_id))
    resetCreateForm()
    setCreateOpen(true)
    setTimeout(() => document.getElementById('loot-roulette-create')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const exportRouletteCsv = (r, rows = r?.results || [], itemRows = r?.items || []) => {
    if (!r) return
    const itemMap = new Map(itemRows.map(item => [String(item.id), item]))
    const csvRows = buildCsvRows(r, rows, itemMap)
    if (!csvRows.length) {
      addToast('There are no loot results to export for this roulette.', 'red', 'Nothing to Export')
      return
    }
    downloadCsv(csvRows, `loot-roulette-${String(r.event || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(r.event_date || 'history').replace(/[^0-9-]+/g, '-')}.csv`)
  }

  const exportAllCsv = () => {
    const rows = history
      .filter(r => r.status !== 'void')
      .flatMap(r => buildCsvRows(r, r.results || [], r.items || []))
    if (!rows.length) {
      addToast('There are no non-void loot results to export.', 'red', 'Nothing to Export')
      return
    }
    downloadCsv(rows, 'loot-roulette-history.csv')
  }

  const toggleHistoryFull = id => {
    setExpandedHistoryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedSummary = selectedAttendance ? {
    participants: selectedAttendance._participants.length,
    date: selectedAttendance._date,
    run: getRunLabel(selectedAttendance._sessionName),
    used: activeAttendanceIds.has(String(selectedAttendance.id)),
  } : null

  const createPayload = getCreatePayload()
  const createUnitCount = createPayload.length
  const currentUserResult = results.find(r => String(r.winner_member_id) === String(currentUser?.id))
  const lootResultsByItem = useMemo(() => {
    const map = new Map()
    results.forEach(row => {
      const key = String(row.item_id)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(row)
    })
    return map
  }, [results])

  const selectClass = 'min-h-[44px] w-full rounded-xl border border-gold/15 bg-[#151210] px-3 py-2.5 text-sm text-white outline-none transition focus:border-gold/40 focus:ring-2 focus:ring-gold/10 [color-scheme:dark]'
  const inputClass = 'min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-text-bright placeholder:text-text-dim/60 outline-none transition focus:border-gold/40 focus:ring-2 focus:ring-gold/10'

  const statusLabel = roulette?.status === 'completed' ? 'Completed' : roulette?.status === 'void' ? 'Void' : 'Ready'

  return (
    <div className="min-w-0 space-y-4">
      <header className="rounded-2xl border border-gold/15 bg-[#0c0a09]/95 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-gold-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-bright" /> Clan Rewards
            </div>
            <h1 className="mt-1 font-spectral text-2xl font-bold text-text-bright sm:text-3xl">Loot Roulette</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-text-dim">Attendance determines eligibility. Staff starts the roll, and the server securely decides every result.</p>
          </div>

          <div className="relative flex shrink-0 items-center gap-2">
            {isStaff && (
              <button type="button" onClick={() => setCreateOpen(v => !v)} className="btn-gold min-h-10 px-3 text-xs font-bold">
                {createOpen ? 'Close New Roulette' : '+ New Roulette'}
              </button>
            )}
            <button type="button" onClick={() => loadHistory()} className="min-h-10 rounded-xl border border-white/[.08] bg-white/[.02] px-3 text-xs font-bold text-text-dim transition hover:border-gold/20 hover:text-text-bright">↻ Refresh</button>
            <button type="button" onClick={exportAllCsv} className="min-h-10 rounded-xl border border-gold/20 bg-gold/[.05] px-3 text-xs font-bold text-gold-light transition hover:bg-gold/[.08]">↓ Export All</button>
          </div>
        </div>
      </header>

      {isStaff && createOpen && (
        <section id="loot-roulette-create" className="rounded-2xl border border-gold/15 bg-[#0c0a09]/95 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[.16em] text-gold-dim">Staff Only</div>
              <h2 className="mt-1 text-lg font-bold text-text-bright">New Loot Roulette</h2>
              <p className="mt-1 text-[13px] leading-5 text-text-dim">Pick one Attendance run, then enter one loot item per line.</p>
            </div>
            <button type="button" onClick={() => setCreateOpen(false)} className="self-start rounded-lg border border-white/[.08] px-3 py-2 text-xs font-bold text-text-dim hover:text-text-bright">Close</button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">Attendance Event</label>
              <AttendancePicker options={attendanceOptions} value={selectedAttendanceId} onChange={setSelectedAttendanceId} activeAttendanceIds={activeAttendanceIds} />
              {selectedSummary && (
                <div className="mt-2 rounded-xl border border-white/[.07] bg-black/20 px-3 py-2.5 text-[12px] text-text-dim">
                  <span className="font-bold text-text-bright">{selectedSummary.participants} players</span> · {selectedSummary.run} · {selectedSummary.date}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">Loot Pool</label>
                <span className="text-[12px] font-bold text-gold-light">{createUnitCount} items · {selectedSummary?.participants || 0} players</span>
              </div>
              <textarea
                value={items.map(item => item.name).join('\n')}
                onChange={event => {
                  const lines = event.target.value.split('\n')
                  setItems(lines.map(line => ({ name: line })).concat(lines.length ? [] : [{ name: '' }]))
                }}
                placeholder={'Silvarin x3\nMiddle Horn x1\nParchment X1'}
                className={`${inputClass} min-h-36 resize-y py-3`}
                aria-label="Loot items, one per line"
              />
              <div className="mt-2 space-y-2">
                {items.map((item, index) => {
                  const parsed = parseLootInput(item.name)
                  if (!parsed.name) return null
                  return (
                    <div key={`${index}-${parsed.name}`} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate rounded-lg border border-white/[.06] bg-black/20 px-3 py-2 text-[13px] text-text-bright">{parsed.name}</div>

                    </div>
                  )
                })}
              </div>
              <button type="button" disabled={creating} onClick={requestCreateRoulette} className="btn-gold mt-4 min-h-11 w-full text-sm font-bold disabled:opacity-50">{creating ? 'Creating...' : 'Create Roulette'}</button>
            </div>
          </div>
        </section>
      )}

      {roulette && rollPanelOpen && roulette.status === 'ready' && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label="Loot Roulette roll panel" onMouseDown={event => { if (event.target === event.currentTarget && !spinning) setRollPanelOpen(false) }}>
          <section id="loot-roulette-active" className="max-h-[94vh] w-full max-w-6xl overflow-y-auto overflow-x-hidden rounded-3xl border border-gold/15 bg-[linear-gradient(145deg,rgba(18,15,11,.99),rgba(8,8,8,.99))] shadow-[0_24px_100px_rgba(0,0,0,.55)]">
          <div className="border-b border-white/[.06] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-spectral text-xl font-bold tracking-tight text-text-bright sm:text-2xl">{roulette.event}</h2>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${runBadgeClass(getRunLabel(roulette.session_display_name))}`}>{getRunLabel(roulette.session_display_name)}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${roulette.status === 'completed' ? 'border-emerald-400/20 bg-emerald-400/[.05] text-emerald-300' : roulette.status === 'void' ? 'border-red-400/20 bg-red-400/[.05] text-red-300' : 'border-gold/20 bg-gold/[.05] text-gold-light'}`}>{statusLabel}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-dim">
                  <span>{roulette.session_display_name || 'Event Run'}</span><span className="text-white/20">•</span><span>{roulette.event_date || 'Unknown date'}</span><span className="text-white/20">•</span><span>{formatTime(roulette.event_ts)} GMT+8</span>
                </div>
              </div>

              <div className="relative flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => !spinning && setRollPanelOpen(false)} disabled={spinning} className="min-h-10 rounded-xl border border-white/[.08] bg-white/[.02] px-3 text-xs font-bold text-text-dim transition hover:border-gold/20 hover:text-text-bright disabled:cursor-not-allowed disabled:opacity-40">Close</button>
                <div className="hidden rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2 sm:block">
                  <div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Players</div>
                  <div className="mt-0.5 text-sm font-black text-text-bright">{participants.length}</div>
                </div>
                <div className="rounded-xl border border-gold/15 bg-gold/[.035] px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-[.14em] text-gold-dim">Loot left</div>
                  <div className="mt-0.5 text-sm font-black text-gold-light">{remainingLootUnits}</div>
                </div>
                <button type="button" onClick={() => exportRouletteCsv(roulette, results, rouletteItems)} className="min-h-10 rounded-xl border border-white/[.08] bg-white/[.02] px-3 text-xs font-bold text-text-dim transition hover:border-gold/20 hover:text-text-bright">CSV</button>
                {isStaff && (
                  <>
                    <button type="button" onClick={() => setActiveMenuOpen(v => !v)} aria-label="Roulette staff actions" aria-expanded={activeMenuOpen} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.02] text-lg font-black text-text-dim transition hover:border-gold/20 hover:text-text-bright">⋯</button>
                    {activeMenuOpen && (
                      <div className="absolute right-0 top-12 z-40 w-48 rounded-2xl border border-white/[.08] bg-[#151210] p-1.5 shadow-2xl shadow-black/60">
                        {roulette.status !== 'void' && <button type="button" onClick={() => requestVoid(roulette)} className="min-h-10 w-full rounded-xl px-3 text-left text-xs font-bold text-red-300 transition hover:bg-red-400/[.05]">Void Roulette</button>}
                        <button type="button" onClick={event => { event.stopPropagation(); requestDelete(roulette) }} className="min-h-10 w-full rounded-xl px-3 text-left text-xs font-bold text-red-300 transition hover:bg-red-400/[.05]">Delete Roulette</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {roulette.status === 'void' && (
            <div className="mx-4 mt-4 rounded-2xl border border-red-400/15 bg-red-400/[.035] p-4 sm:mx-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[.14em] text-red-300">Roulette voided</div>
                  <div className="mt-1 text-[13px] leading-5 text-text-dim">Attendance remains unchanged, so staff can create a replacement from the same run.</div>
                  {roulette.void_reason && <div className="mt-2 text-xs text-text-dim">Reason: <span className="font-semibold text-text-bright">{roulette.void_reason}</span></div>}
                </div>
                {isStaff && <button type="button" onClick={startReplacement} className="min-h-10 shrink-0 rounded-xl border border-gold/20 bg-gold/[.05] px-3 text-xs font-bold text-gold-light">Create Replacement</button>}
              </div>
            </div>
          )}

          <div className="p-4 sm:p-6">
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-3 sm:p-3.5"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Participants</div><div className="mt-1 text-lg font-black text-text-bright">{participants.length}</div></div>
              <div className="rounded-2xl border border-gold/10 bg-gold/[.025] p-3 sm:p-3.5"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-gold-dim">Loot awarded</div><div className="mt-1 text-lg font-black text-gold-light">{distributedLootUnits}</div></div>
              <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-3 sm:p-3.5"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Nothing</div><div className="mt-1 text-lg font-black text-text-bright">{nothingCount}</div></div>
              <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-3 sm:p-3.5"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Progress</div><div className="mt-1 text-lg font-black text-text-bright">{completedParticipants}/{participants.length}</div></div>
            </div>

            <div className="rounded-3xl border border-gold/10 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,.08),transparent_55%)] p-4 sm:p-6">
              {spinning ? (
                <div className="mx-auto max-w-3xl text-center">
                  <div className="flex items-center justify-between gap-3 text-left">
                    <div><div className="text-[10px] font-black uppercase tracking-[.2em] text-gold-dim">Live reveal</div><div className="mt-1 text-xs text-text-dim">Item {animationIndex} of {animationTotal}</div></div>
                  </div>
                  <div className="mt-5 rounded-2xl border border-gold/15 bg-black/25 px-4 py-8 sm:px-8 sm:py-10">
                    <div className="text-xs font-bold uppercase tracking-[.2em] text-text-dim">{animationItem?.name || 'Loot'}</div>
                    <div className="mt-4 min-h-14 break-words text-3xl font-black tracking-tight text-gold-bright sm:min-h-20 sm:text-5xl">{animationWinner?._displayName || animationWinner?.winner_name || '…'}</div>
                    <div className="mx-auto mt-3 max-w-md text-[11px] leading-5 text-text-dim">Winner is locked by the server. This animation only reveals the saved result.</div>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={skipAnimation} className="min-h-10 rounded-xl border border-gold/20 bg-gold/[.05] px-4 text-xs font-bold text-gold-light transition hover:bg-gold/[.09]">{skipRequested ? 'Finishing…' : 'Skip animation'}</button>
                    <button type="button" onClick={togglePause} className="min-h-10 rounded-xl border border-white/[.08] px-4 text-xs font-bold text-text-dim transition hover:text-text-bright">{paused ? 'Next' : 'Pause'}</button>
                  </div>
                </div>
              ) : batchSummary ? (
                <div className="mx-auto max-w-2xl py-4 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/[.06] text-emerald-300">✓</div>
                  <div className="mt-3 text-[10px] font-black uppercase tracking-[.22em] text-emerald-300">Roll complete</div>
                  <div className="mt-1 text-3xl font-black tracking-tight text-text-bright sm:text-4xl">{batchSummary.loot} loot revealed</div>
                  <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs font-bold"><span className="rounded-full border border-gold/20 bg-gold/[.05] px-3 py-1.5 text-gold-light">{batchSummary.loot} winners</span><span className="rounded-full border border-white/[.08] bg-white/[.03] px-3 py-1.5 text-text-dim">{batchSummary.nothing} Nothing</span></div>
                </div>
              ) : (
                <div className="mx-auto max-w-2xl py-4 text-center">
                  <div className="text-[10px] font-black uppercase tracking-[.2em] text-gold-dim">Server-side distribution</div>
                  <div className="mt-2 text-2xl font-black tracking-tight text-text-bright sm:text-3xl">{roulette.status === 'completed' ? 'Roulette Complete' : roulette.status === 'void' ? 'Roulette Voided' : 'Ready to Roll'}</div>
                  <div className="mx-auto mt-2 max-w-xl text-[13px] leading-5 text-text-dim">Each loot unit is assigned once. A player can win at most one item. Nothing results are recorded, but never animated.</div>
                </div>
              )}

              {isStaff && roulette.status === 'ready' && !spinning && <button type="button" disabled={!eligibleParticipants.length || !remainingLootUnits} onClick={requestSpin} className="btn-gold mx-auto mt-5 flex min-h-12 w-full max-w-sm items-center justify-center text-sm font-black shadow-[0_8px_30px_rgba(212,175,55,.12)] disabled:cursor-not-allowed disabled:opacity-40">START ROLL</button>}
              {!isStaff && roulette.status === 'ready' && !spinning && <div className="mt-5 text-center text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">Waiting for staff to start</div>}
              {rollRecovery && !spinning && roulette.status === 'ready' && <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-red-400/20 bg-red-400/[.035] p-3 text-left"><div className="text-xs font-bold text-red-200">Roll status needs confirmation</div><p className="mt-1 text-[11px] leading-5 text-text-dim">The server may have completed the roll. Refresh before trying again.</p><button type="button" onClick={async () => { setRollRecovery(false); await openRoulette(roulette.id); await loadHistory(historyLimit) }} className="mt-2 min-h-10 rounded-xl border border-red-400/20 bg-red-400/[.06] px-3 text-xs font-bold text-red-200">Refresh Roulette</button></div>}
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-gold-dim">Loot board</div><div className="mt-1 text-[13px] text-text-dim">Every unit stays visible. Winners are recorded below each item.</div></div><span className="text-xs font-bold text-gold-light">{distributedLootUnits}/{rouletteItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} awarded</span></div>
              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {rouletteItems.map((item, itemIndex) => {
                  const winners = lootResultsByItem.get(String(item.id)) || []
                  const totalUnits = Number(item.quantity) || 1
                  return (
                    <article key={item.id} className="group rounded-2xl border border-white/[.07] bg-white/[.018] p-3.5 transition hover:border-gold/15 hover:bg-gold/[.018]">
                      <div className="flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gold/15 bg-gold/[.04] text-[10px] font-black text-gold-light">{String(itemIndex + 1).padStart(2, '0')}</div><div className="min-w-0 flex-1"><div className="truncate text-[14px] font-bold text-text-bright">{item.name}</div><div className="mt-1 text-[11px] text-text-dim">{winners.length}/{totalUnits} awarded</div></div></div>
                      <div className="mt-3 grid grid-cols-2 gap-1.5">{Array.from({ length: totalUnits }).map((_, index) => { const winner = winners[index]; return <div key={`${item.id}-${index}`} className={`min-h-8 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${winner ? 'border-gold/20 bg-gold/[.045] text-gold-light' : 'border-white/[.06] bg-black/15 text-text-dim'}`}><span className="mr-1 text-[9px] opacity-50">#{index + 1}</span>{winner?.winner_name || '?'}</div> })}</div>
                    </article>
                  )
                })}
              </div>
            </div>

            {currentUserResult ? <div className="mt-4 flex items-center gap-3 rounded-2xl border border-gold/20 bg-gold/[.045] px-4 py-3 text-[13px] font-bold text-gold-light"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/[.10]">✓</span><span>You won <span className="text-text-bright">{currentUserResult.item_name}</span></span></div> : roulette.status === 'completed' ? <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.018] px-4 py-3 text-[13px] font-semibold text-text-dim"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[.04]">—</span><span>No loot this time.</span></div> : null}

            <details className="mt-5 rounded-2xl border border-white/[.06] bg-black/15" open={participants.length <= 12}>
              <summary className="cursor-pointer list-none px-4 py-3.5"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-text-dim">Participants</div><div className="mt-1 text-[12px] text-text-dim">Attendance players stay visible here.</div></div><span className="rounded-full border border-gold/15 bg-gold/[.035] px-2.5 py-1 text-[11px] font-bold text-gold-light">{completedParticipants}/{participants.length}</span></div></summary>
              <div className="border-t border-white/[.06] p-3 sm:p-4"><div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{participants.map(p => { const result = results.find(r => String(r.winner_member_id) === String(p.member_id)); const nothing = String(result?.item_name || '').toLowerCase() === 'nothing'; return <div key={p.member_id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/[.06] bg-white/[.018] px-3 py-2.5"><span className="min-w-0 truncate text-[12px] font-semibold text-text-bright">{p.player_name}</span><span className={`shrink-0 max-w-[48%] truncate text-right text-[10px] font-bold ${nothing ? 'text-text-dim' : result ? 'text-gold-light' : 'text-white/30'}`}>{result ? (nothing ? 'Nothing' : result.item_name) : 'Waiting'}</span></div> })}</div></div>
            </details>
          </div>
          </section>
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-gold/15 bg-[#0c0a09]/95 shadow-[0_14px_50px_rgba(0,0,0,.18)] p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="text-[10px] font-black uppercase tracking-[.2em] text-gold-dim">Archive</div><h2 className="mt-1 font-spectral text-xl font-bold text-text-bright">Loot History</h2><p className="mt-1 text-[13px] text-text-dim">Past distributions stay compact until you open one.</p></div>
          <div className="relative w-full sm:max-w-sm"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim">⌕</span><input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search player, item or event..." className={`${inputClass} pl-9`} aria-label="Search loot history" /></div>
        </div>

        <div className="mt-5 space-y-2.5">
          {historyLoading ? <div className="py-12 text-center text-[13px] text-text-dim">Loading loot history...</div> : filteredHistory.length === 0 ? <div className="rounded-2xl border border-white/[.06] bg-black/20 py-12 text-center text-[13px] text-text-dim">No loot roulette history found.</div> : filteredHistory.map(r => {
            const expanded = expandedHistoryIds.has(r.id)
            const playerCount = r.participants?.length || 0
            const itemsTotal = (r.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
            const lootCount = (r.results || []).filter(row => String(row.item_name || '').toLowerCase() !== 'nothing').length
            const nothing = (r.results || []).filter(row => String(row.item_name || '').toLowerCase() === 'nothing').length
            const winnerChips = [...new Set((r.results || []).filter(row => String(row.item_name || '').toLowerCase() !== 'nothing').map(row => row.winner_name).filter(Boolean))]
            return (
              <article key={r.id} className={`overflow-hidden rounded-2xl border bg-black/20 transition ${expanded ? 'border-gold/15' : 'border-white/[.07] hover:border-white/[.12]'}`}>
                <div className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><div className="truncate text-[14px] font-bold text-text-bright">{r.event}</div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${r.status === 'void' ? 'border-red-400/20 bg-red-400/[.04] text-red-300' : r.status === 'completed' ? 'border-emerald-400/20 bg-emerald-400/[.04] text-emerald-300' : 'border-gold/15 bg-gold/[.04] text-gold-light'}`}>{r.status}</span></div>
                    <div className="mt-1 text-[12px] text-text-dim">{r.event_date || 'Unknown date'} <span className="text-white/20">•</span> {r.session_display_name || 'Event Run'} <span className="text-white/20">•</span> {itemsTotal} items <span className="text-white/20">•</span> {playerCount} players <span className="text-white/20">•</span> <span className="text-gold-light">{lootCount} loot</span> <span className="text-white/20">•</span> {nothing} nothing</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{winnerChips.slice(0, 8).map(name => <span key={`${r.id}-${name}`} className="rounded-full border border-gold/15 bg-gold/[.035] px-2 py-1 text-[10px] font-semibold text-gold-light">{name}</span>)}{winnerChips.length > 8 && <span className="rounded-full border border-white/[.07] px-2 py-1 text-[10px] text-text-dim">+{winnerChips.length - 8} more</span>}{nothing > 0 && <span className="rounded-full border border-white/[.07] bg-white/[.02] px-2 py-1 text-[10px] font-semibold text-text-dim">{nothing} Nothing</span>}</div>
                  </div>
                  <div className="flex shrink-0 gap-2"><button type="button" onClick={() => toggleHistoryFull(r.id)} className="min-h-10 rounded-xl border border-gold/20 bg-gold/[.045] px-3.5 text-xs font-bold text-gold-light transition hover:bg-gold/[.08]">{expanded ? 'Hide Details' : 'View Full'}</button><button type="button" onClick={() => exportRouletteCsv(r)} className="min-h-10 rounded-xl border border-white/[.08] px-3.5 text-xs font-bold text-text-dim transition hover:border-white/[.14] hover:text-text-bright">CSV</button></div>
                </div>

                {expanded && <div className="border-t border-white/[.06] bg-black/10 p-3 sm:p-4">
                  {r.status === 'void' && <div className="mb-3 rounded-xl border border-red-400/15 bg-red-400/[.035] px-3 py-2.5 text-[12px] text-text-dim">Void reason: <span className="font-semibold text-red-200">{r.void_reason || 'Voided by staff'}</span></div>}
                  <div className="mb-4 rounded-2xl border border-white/[.06] bg-white/[.012] p-3.5 sm:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[.18em] text-gold-dim">All Participants</div>
                        <div className="mt-1 text-[12px] text-text-dim">Every Attendance player is listed with their final result.</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                        <span className="rounded-full border border-gold/15 bg-gold/[.04] px-2 py-1 text-gold-light">{lootCount} Loot</span>
                        <span className="rounded-full border border-white/[.08] bg-white/[.025] px-2 py-1 text-text-dim">{nothing} Nothing</span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {(r.participants || []).map(player => {
                        const result = (r.results || []).find(row => String(row.winner_member_id) === String(player.member_id))
                        const isNothing = String(result?.item_name || '').toLowerCase() === 'nothing'
                        const isLoot = Boolean(result) && !isNothing
                        return (
                          <div key={player.member_id} className={`flex min-h-10 items-center justify-between gap-2 rounded-xl border px-3 py-2 ${isLoot ? 'border-gold/15 bg-gold/[.035]' : isNothing ? 'border-white/[.06] bg-black/15' : 'border-white/[.05] bg-white/[.012]'}`}>
                            <span className="min-w-0 truncate text-[12px] font-semibold text-text-bright">{player.player_name}</span>
                            <span className={`shrink-0 max-w-[52%] truncate text-right text-[10px] font-bold ${isLoot ? 'text-gold-light' : isNothing ? 'text-text-dim' : 'text-white/35'}`}>
                              {isLoot ? `🎁 ${result.item_name}` : isNothing ? 'Nothing' : 'No Result'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/[.06] bg-white/[.012] p-3.5 sm:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[.18em] text-gold-dim">Distribution Summary</div>
                        <div className="mt-1 text-[12px] text-text-dim">Each player is listed once above with their final reward. Item-level cards are intentionally omitted to avoid duplicate information.</div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <span className="rounded-full border border-gold/15 bg-gold/[.04] px-2.5 py-1 text-[10px] font-bold text-gold-light">{lootCount} Loot</span>
                        <span className="rounded-full border border-white/[.08] bg-white/[.025] px-2.5 py-1 text-[10px] font-bold text-text-dim">{nothing} Nothing</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">{r.status === 'ready' && <button type="button" onClick={async () => { await openRoulette(r.id); setRollPanelOpen(true) }} className="min-h-10 rounded-xl border border-gold/20 bg-gold/[.045] px-3 text-xs font-bold text-gold-light">Start Roll</button>}{isStaff && r.status !== 'void' && <button type="button" onClick={() => requestVoid(r)} className="min-h-10 rounded-xl border border-red-400/20 bg-red-400/[.04] px-3 text-xs font-bold text-red-300">Void</button>}{isStaff && <button type="button" onClick={event => { event.stopPropagation(); requestDelete(r) }} className="min-h-10 rounded-xl border border-red-400/20 bg-red-400/[.04] px-3 text-xs font-bold text-red-300">Delete</button>}</div>
                </div>}
              </article>
            )
          })}
        </div>

        {hasMoreHistory && !historyLoading && <div className="mt-4 flex justify-center"><button type="button" onClick={() => { const next = historyLimit + 100; setHistoryLimit(next); loadHistory(next) }} className="min-h-10 rounded-xl border border-gold/20 bg-gold/[.04] px-4 text-xs font-bold text-gold-light">Load More History</button></div>}
      </section>
      {actionTarget && actionType && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-label={actionType === 'void' ? 'Void loot roulette' : 'Delete loot roulette'} onMouseDown={e => e.target === e.currentTarget && closeStaffAction()}>
          <div ref={modalRef} tabIndex={-1} className="w-full max-w-md overflow-hidden rounded-2xl border border-red-400/20 bg-[#0c0a09] shadow-2xl outline-none">
            <div className="border-b border-white/[.07] px-4 py-4 sm:px-5">
              <div className="text-[11px] font-bold uppercase tracking-[.18em] text-red-300">Staff Action</div>
              <h3 className="mt-1 text-lg font-bold text-text-bright">{actionType === 'void' ? 'Void Loot Roulette?' : 'Delete Loot Roulette?'}</h3>
              <p className="mt-1 text-[13px] leading-5 text-text-dim">{actionTarget.event} · {actionTarget.session_display_name || 'Event Run'} · {actionTarget.event_date || ''}</p>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              <div className="rounded-xl border border-red-400/10 bg-red-400/[.025] p-3 text-[12px] leading-5 text-text-dim">
                {actionType === 'void' ? 'Void keeps the Attendance record and allows a replacement roulette.' : 'Delete permanently removes this roulette, its participants, loot items, and results. Attendance is not changed.'}
              </div>
              {actionType === 'void' && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">Reason (optional)</label>
                  <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} rows={3} className="w-full resize-none rounded-xl border border-white/[.08] bg-black/20 px-3 py-2.5 text-[13px] text-text-bright outline-none focus:border-gold/30" placeholder="Why is this roulette being voided?" />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">Staff Password</label>
                <input autoFocus type="password" value={actionPassword} onChange={e => setActionPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmStaffAction() }} className="w-full rounded-xl border border-white/[.08] bg-black/20 px-3 py-2.5 text-[13px] text-text-bright outline-none focus:border-gold/30" placeholder="Enter your current login password" />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeStaffAction} disabled={deleting || voiding} className="min-h-10 rounded-lg border border-white/[.08] px-4 text-xs font-bold text-text-dim hover:text-text-bright disabled:opacity-50">Cancel</button>
                <button type="button" onClick={confirmStaffAction} disabled={deleting || voiding || !actionPassword.trim()} className="min-h-10 rounded-lg border border-red-400/20 bg-red-500/[.08] px-4 text-xs font-bold text-red-200 disabled:cursor-not-allowed disabled:opacity-50">{deleting ? 'Deleting…' : voiding ? 'Voiding…' : actionType === 'void' ? 'Void Roulette' : 'Delete Permanently'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmCreate && selectedAttendance && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-label="Confirm create loot roulette" onMouseDown={e => e.target === e.currentTarget && setConfirmCreate(false)}>
          <div ref={modalRef} tabIndex={-1} className="w-full max-w-lg overflow-hidden rounded-2xl border border-gold/20 bg-[#0c0a09] shadow-2xl outline-none">
            <div className="border-b border-white/[.07] px-4 py-4 sm:px-5">
              <div className="text-[11px] font-bold uppercase tracking-[.18em] text-gold-dim">Final Check</div>
              <h3 className="mt-1 text-lg font-bold text-text-bright">Create Loot Roulette?</h3>
              <p className="mt-1 text-[13px] leading-5 text-text-dim">Review the Attendance run and loot pool before creating it.</p>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                <div className="text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">Attendance</div>
                <div className="mt-1 text-[14px] font-bold text-text-bright">{selectedAttendance.event}</div>
                <div className="mt-0.5 text-[12px] text-text-dim">{selectedAttendance._sessionName} · {selectedAttendance._date} · {selectedAttendance._participants.length} players</div>
              </div>
              <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[.14em] text-text-dim"><span>Loot Pool</span><span className="text-gold-light">{createUnitCount} units</span></div>
                <div className="space-y-1.5">
                  {createPayload.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2"><span className="truncate text-[13px] font-semibold text-text-bright">{item.name}</span></div>)}
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setConfirmCreate(false)} className="min-h-10 rounded-lg border border-white/[.08] px-4 text-xs font-bold text-text-dim hover:text-text-bright">Cancel</button>
                <button type="button" onClick={createRoulette} className="btn-gold min-h-10 px-4 text-xs font-bold">Create Roulette</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmRoll && roulette && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-label="Confirm loot roll" onMouseDown={e => e.target === e.currentTarget && setConfirmRoll(false)}>
          <div ref={modalRef} tabIndex={-1} className="w-full max-w-md overflow-hidden rounded-2xl border border-gold/20 bg-[#0c0a09] shadow-2xl outline-none">
            <div className="border-b border-white/[.07] px-4 py-4 sm:px-5">
              <div className="text-[11px] font-bold uppercase tracking-[.18em] text-gold-dim">Final Check</div>
              <h3 className="mt-1 text-lg font-bold text-text-bright">Start the roll?</h3>
              <p className="mt-1 text-[13px] leading-5 text-text-dim">The server will decide every remaining result in one call. The animation only reveals those saved results.</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/[.07] bg-black/20 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-text-dim">Players</div><div className="mt-1 text-lg font-black text-text-bright">{eligibleParticipants.length}</div></div>
                <div className="rounded-xl border border-gold/15 bg-gold/[.03] p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-text-dim">Loot Units</div><div className="mt-1 text-lg font-black text-gold-light">{remainingLootUnits}</div></div>
                <div className="rounded-xl border border-white/[.07] bg-black/20 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-text-dim">Nothing</div><div className="mt-1 text-lg font-black text-text-bright">{Math.max(0, eligibleParticipants.length - remainingLootUnits)}</div></div>
              </div>
              <div className="mt-3 rounded-xl border border-gold/10 bg-gold/[.025] px-3 py-2.5 text-[12px] leading-5 text-text-dim">Each eligible player can receive at most one result. Nothing is never animated.</div>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setConfirmRoll(false)} className="min-h-10 rounded-lg border border-white/[.08] px-4 text-xs font-bold text-text-dim hover:text-text-bright">Cancel</button>
                <button type="button" onClick={spin} className="btn-gold min-h-10 px-4 text-xs font-bold">START ROLL</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
