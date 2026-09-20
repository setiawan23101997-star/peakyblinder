import React, { useState, useEffect } from 'react'

const eventTypes = [
  'Inter-Server Battle',
  'Clan Annihilation',
  'World Boss',
  "Sindri's Treasure Island",
  'Clan Sanctuary',
]

const WEEKLY_EVENT_SESSIONS = [
  {
    id: 'server-battle-tue-1900',
    event: 'Inter-Server Battle',
    day: 2,
    dayLabel: 'Tuesday',
    time: '20:00',
    endTime: '21:00',
    label: 'Tuesday · 20:00–21:00',
    displayName: 'Server Battle',
  },
  {
    id: 'clan-annihilation-thu-1300',
    event: 'Clan Annihilation',
    day: 4,
    dayLabel: 'Thursday',
    time: '13:00',
    endTime: '14:00',
    label: 'Thursday · 13:00–14:00',
    displayName: 'Clan Annihilation · First Run',
  },
  {
    id: 'clan-annihilation-thu-2000',
    event: 'Clan Annihilation',
    day: 4,
    dayLabel: 'Thursday',
    time: '20:00',
    endTime: '21:00',
    label: 'Thursday · 20:00–21:00',
    displayName: 'Clan Annihilation · Second Run',
  },
  {
    id: 'world-boss-thu-1900',
    event: 'World Boss',
    day: 4,
    dayLabel: 'Thursday',
    time: '19:00',
    label: 'Thursday · 19:00',
    displayName: 'World Boss · Myrkrheim · Wrath of the Earth Bergbernd',
  },
  {
    id: 'sindri-sat-1300',
    event: "Sindri's Treasure Island",
    day: 6,
    dayLabel: 'Saturday',
    time: '13:00',
    endTime: '14:00',
    label: 'Saturday · 13:00–14:00',
    displayName: "Sindri's Treasure Island · First Run",
  },
  {
    id: 'sindri-sat-2000',
    event: "Sindri's Treasure Island",
    day: 6,
    dayLabel: 'Saturday',
    time: '20:00',
    endTime: '21:00',
    label: 'Saturday · 20:00–21:00',
    displayName: "Sindri's Treasure Island · Second Run",
  },
  {
    id: 'world-boss-sat-1900',
    event: 'World Boss',
    day: 6,
    dayLabel: 'Saturday',
    time: '19:00',
    label: 'Saturday · 19:00',
    displayName: 'World Boss · Glasir Forest · Divine Beast of Void Ulnos',
  },
  {
    id: 'clan-sanctuary-sat-2100',
    event: 'Clan Sanctuary',
    day: 6,
    dayLabel: 'Saturday',
    time: '21:00',
    label: 'Saturday · 21:00',
    displayName: 'Clan Sanctuary',
  },
]

/* Automatic attendance reward rules from the clan reward table.
   Perfect Attendance is a separate weekly +150 bonus. */
const ATTENDANCE_REWARDS = {
  'Inter-Server Battle': { base: 100, bonuses: [5, 10, 15, 20] },
  'World Boss': { base: 50, bonuses: [3, 5, 10, 15] },
  'Clan Annihilation': { base: 75, bonuses: [5, 10, 15, 20] },
  "Sindri's Treasure Island": { base: 75, bonuses: [5, 10, 15, 20] },
  'Clan Sanctuary': { base: 50, bonuses: [3, 5, 10, 15] },
}

const PERFECT_ATTENDANCE_BONUS = 150
const PERFECT_ATTENDANCE_REQUIRED_SESSIONS = WEEKLY_EVENT_SESSIONS.length

function getAttendanceGpBonus(power, event) {
  const gp = Number(power) || 0
  const reward = ATTENDANCE_REWARDS[event]
  if (!reward || gp < 100000) return 0
  if (gp < 150000) return reward.bonuses[0]
  if (gp < 200000) return reward.bonuses[1]
  if (gp < 250000) return reward.bonuses[2]
  return reward.bonuses[3]
}

function getAttendanceReward(power, event) {
  const reward = ATTENDANCE_REWARDS[event]
  if (!reward) return 0
  return reward.base + getAttendanceGpBonus(power, event)
}

function formatGp(power) {
  return (Number(power) || 0).toLocaleString()
}

function getServerDateParts(ts = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SERVER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(new Date(ts))
  return {
    year: Number(parts.find(p => p.type === 'year')?.value),
    month: Number(parts.find(p => p.type === 'month')?.value),
    day: Number(parts.find(p => p.type === 'day')?.value),
    weekday: parts.find(p => p.type === 'weekday')?.value || '',
  }
}

function getWeekStartTuesday(ts = Date.now()) {
  const { year, month, day } = getServerDateParts(ts)
  const base = new Date(Date.UTC(year, month - 1, day))
  const dayOfWeek = base.getUTCDay()
  const daysSinceTuesday = (dayOfWeek + 7 - 2) % 7
  base.setUTCDate(base.getUTCDate() - daysSinceTuesday)
  return base
}

function formatDateKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function getAttendanceWeekKey(ts = Date.now()) {
  return formatDateKey(getWeekStartTuesday(ts))
}

function getAttendanceWeekLabel(ts = Date.now()) {
  const start = getWeekStartTuesday(ts)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 4)
  const fmt = date => date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
  return `${fmt(start)} – ${fmt(end)}`
}

function getSessionForEvent(event, sessionId) {
  return WEEKLY_EVENT_SESSIONS.find(s => s.event === event && s.id === sessionId) ||
    WEEKLY_EVENT_SESSIONS.find(s => s.event === event) || null
}

function getRunLabel(session) {
  const name = String(session?.displayName || '').toLowerCase()
  if (name.includes('first run')) return 'First Run'
  if (name.includes('second run')) return 'Second Run'
  return 'Single Run'
}

function getRunTagClass(run) {
  if (run === 'First Run') return 'border-sky-400/20 bg-sky-400/[.06] text-sky-300'
  if (run === 'Second Run') return 'border-violet-400/20 bg-violet-400/[.06] text-violet-300'
  return 'border-white/[.10] bg-white/[.035] text-text-dim'
}

function getLogSession(log) {
  const directSessionId = log?.sessionId
  const attendeeSessionId = (log?.attendees || []).find(a => a?.sessionId)?.sessionId
  return getSessionForEvent(log?.event, directSessionId || attendeeSessionId)
}

function getAttendeeMemberId(attendee) {
  return attendee?.memberId != null ? String(attendee.memberId) : null
}

const SERVER_TZ = 'Asia/Singapore'
const SERVER_TZ_LABEL = 'GMT+8'

// Automatically use the timezone configured on the player's browser/device.
// Server time remains authoritative for saved attendance records.
const AUTO_LOCAL_TZ = (() => {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'
  } catch {
    return 'Local'
  }
})()

function getLocalZoneLabel() {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: AUTO_LOCAL_TZ,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value || AUTO_LOCAL_TZ
  } catch {
    return AUTO_LOCAL_TZ
  }
}

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

function formatInAutoLocalZone(ts) {
  return formatShortNoYearInZone(ts, AUTO_LOCAL_TZ)
}

function getSessionTimestamp(session, weekTs = Date.now(), timeValue = session.time) {
  const start = getWeekStartTuesday(weekTs)
  const dayOffset = Math.max(0, Number(session.day) - 2)
  const [hours, minutes] = String(timeValue || '00:00').split(':').map(Number)

  // The event calendar is authored in server GMT+8 (Asia/Singapore).
  // Convert the server wall-clock time into a timestamp before formatting it
  // in the player's device timezone.
  return Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate() + dayOffset,
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  ) - (8 * 60 * 60 * 1000)
}

function formatSessionTimes(session, weekTs = Date.now()) {
  const startTs = getSessionTimestamp(session, weekTs, session.time)
  const endTs = session.endTime
    ? getSessionTimestamp(session, weekTs, session.endTime)
    : null

  const localFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: AUTO_LOCAL_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return {
    serverTime: session.endTime ? `${session.time}–${session.endTime}` : session.time,
    localTime: endTs
      ? `${localFormatter.format(new Date(startTs))}–${localFormatter.format(new Date(endTs))}`
      : localFormatter.format(new Date(startTs)),
  }
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
  } = ctx

  const [selectedEvent, setSelectedEvent] = useState(eventTypes[0])
  const [selectedSessionId, setSelectedSessionId] = useState(WEEKLY_EVENT_SESSIONS[0].id)
  const [selectedMembers, setSelectedMembers] = useState({})
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState({})
  const [detailLog, setDetailLog] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [removingAttendeeKey, setRemovingAttendeeKey] = useState(null)
  const [attendeeSearch, setAttendeeSearch] = useState('')
  const [openActionMenuId, setOpenActionMenuId] = useState(null)
  const [showAddMissing, setShowAddMissing] = useState(false)
  const [missingLog, setMissingLog] = useState(null)
  const [missingMembers, setMissingMembers] = useState({})
  const [missingSearch, setMissingSearch] = useState('')
  const [addingMissing, setAddingMissing] = useState(false)
  const [awardingPerfect, setAwardingPerfect] = useState(false)
  const [showPerfectAttendance, setShowPerfectAttendance] = useState(false)
  const [showRewardGuide, setShowRewardGuide] = useState(false)
  const [showEventSchedule, setShowEventSchedule] = useState(false)
  const [perfectSearch, setPerfectSearch] = useState('')
  const [perfectFilter, setPerfectFilter] = useState('qualified')
  const [now, setNow] = useState(Date.now())
  const [expandedDays, setExpandedDays] = useState({ 2: false, 4: false, 6: false })
  const [expandedSections, setExpandedSections] = useState({
    calendar: false,
    perfect: false,
    record: false,
    history: false,
  })
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historySearch, setHistorySearch] = useState('')
  const HISTORY_PAGE_SIZE = 8

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const setAllSections = (expanded) => {
    setExpandedSections({
      calendar: expanded,
      perfect: expanded,
      record: expanded,
      history: expanded,
    })
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const isElder = currentUser?.role === 'Elder' || currentUser?.role === 'Master' || currentUser?.role === 'Admin'
  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
  const selectedSession = getSessionForEvent(selectedEvent, selectedSessionId)
  const eventSessions = WEEKLY_EVENT_SESSIONS.filter(session => session.event === selectedEvent)
  const currentWeekKey = getAttendanceWeekKey(now)
  const currentWeekLabel = getAttendanceWeekLabel(now)

  useEffect(() => {
    if (!eventSessions.some(session => session.id === selectedSessionId)) {
      setSelectedSessionId(eventSessions[0]?.id || '')
    }
  }, [selectedEvent, selectedSessionId])

  const selectedTargets = members.filter(m => selectedMembers[m.id])
  const selectedRewardRows = selectedTargets.map(m => ({
    member: m,
    gp: Number(m.power) || 0,
    gpBonus: getAttendanceGpBonus(m.power, selectedEvent),
    reward: getAttendanceReward(m.power, selectedEvent),
  }))
  const selectedTotalCoins = selectedRewardRows.reduce((sum, row) => sum + row.reward, 0)

  const weeklyPerfectAttendance = members.map(member => {
    const memberId = String(member.id)
    const attendedSessionIds = new Set()
    const perfectBonusEntries = []

    // The member attendance ledger is the canonical source. It stores sessionId
    // even for records added later through "Add Missing".
    ;(member.attend_log || []).forEach(entry => {
      if (!entry || entry.type === 'perfect_attendance_bonus') return
      const entryTs = Number(entry.ts) || 0
      if (!entryTs || getAttendanceWeekKey(entryTs) !== currentWeekKey) return
      if (entry.sessionId && WEEKLY_EVENT_SESSIONS.some(session =>
        session.id === entry.sessionId && session.event === entry.event
      )) {
        attendedSessionIds.add(entry.sessionId)
      }
    })

    // Supplement the ledger from attendance logs for older data that may not
    // have an attend_log entry, while avoiding duplicate session counts.
    ;(attendanceLogs || []).forEach(log => {
      const logTs = Number(log.ts) || Number(log.id) || 0
      if (!logTs || getAttendanceWeekKey(logTs) !== currentWeekKey) return

      const attendee = (log.attendees || []).find(a =>
        getAttendeeMemberId(a) === memberId ||
        String(a.name || '').trim().toLowerCase() === String(member.name || '').trim().toLowerCase()
      )
      if (!attendee) return

      const sessionId = attendee.sessionId || log.sessionId
      if (sessionId && WEEKLY_EVENT_SESSIONS.some(session =>
        session.id === sessionId && session.event === log.event
      )) {
        attendedSessionIds.add(sessionId)
        return
      }

      // Legacy records without session IDs: only infer a duplicated run when
      // the recorded timestamp exactly matches its scheduled server time.
      const matchingSessions = WEEKLY_EVENT_SESSIONS.filter(session => session.event === log.event)
      if (matchingSessions.length === 1) {
        attendedSessionIds.add(matchingSessions[0].id)
      } else if (matchingSessions.length > 1) {
        const logDate = new Date(logTs)
        const hour = Number(new Intl.DateTimeFormat('en-US', {
          timeZone: SERVER_TZ, hour: '2-digit', hour12: false,
        }).format(logDate))
        const minute = Number(new Intl.DateTimeFormat('en-US', {
          timeZone: SERVER_TZ, minute: '2-digit',
        }).format(logDate))
        const minutes = hour * 60 + minute
        const inferred = matchingSessions.find(session => {
          const match = String(session.time || '').match(/(\\d{1,2}):(\\d{2})/)
          return match && Number(match[1]) * 60 + Number(match[2]) === minutes
        })
        if (inferred) attendedSessionIds.add(inferred.id)
      }
    })

    ;(member.attend_log || []).forEach(entry => {
      if (entry?.type === 'perfect_attendance_bonus' && entry?.weekKey === currentWeekKey) {
        perfectBonusEntries.push(entry)
      }
    })

    return {
      member,
      attendedSessionIds,
      attendedCount: attendedSessionIds.size,
      qualified: attendedSessionIds.size >= PERFECT_ATTENDANCE_REQUIRED_SESSIONS,
      awarded: perfectBonusEntries.length > 0,
    }
  })

  const qualifiedPerfectAttendance = weeklyPerfectAttendance.filter(row => row.qualified)
  const unawardedPerfectAttendance = qualifiedPerfectAttendance.filter(row => !row.awarded)
  const perfectAttendanceTotal = unawardedPerfectAttendance.length * PERFECT_ATTENDANCE_BONUS

  const toggleMember = (id) => setSelectedMembers(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleLog = (id) => setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }))


  const recordAttendance = async () => {
    const ids = Object.keys(selectedMembers).filter(k => selectedMembers[k])
    if (ids.length === 0) {
      addToast('Select at least one member.', 'red', 'Error')
      return false
    }

    if (!selectedSession || !ATTENDANCE_REWARDS[selectedEvent]) {
      addToast('Please select a scheduled event session with an automatic reward rule.', 'red', 'Session Required')
      return false
    }

    const duplicateSession = (attendanceLogs || []).find(log => {
      const logTs = log.ts || Number(log.id) || 0
      if (!logTs || getAttendanceWeekKey(logTs) !== getAttendanceWeekKey(Date.now())) return false
      return (log.attendees || []).some(a => a.sessionId === selectedSession.id)
    })
    if (duplicateSession) {
      addToast(`${selectedSession.displayName} is already recorded for this week.`, 'red', 'Already Recorded')
      return false
    }

    setSubmitting(true)

    const nowDate = new Date()
    const dateStr = nowDate.toLocaleDateString()
    const ts = nowDate.getTime()

    const targets = members.filter(m => ids.includes(String(m.id)))

    const results = await Promise.all(targets.map(async (m) => {
      const reward = getAttendanceReward(m.power, selectedEvent)
      const attendEntry = {
        event: selectedEvent,
        sessionId: selectedSession.id,
        sessionLabel: selectedSession.label,
        sessionDisplayName: selectedSession.displayName,
        date: dateStr,
        ts,
        qualifier: 'full',
        coins: reward,
        baseCoins: ATTENDANCE_REWARDS[selectedEvent].base,
        gp: Number(m.power) || 0,
        gpBonus: getAttendanceGpBonus(m.power, selectedEvent),
        perfectAttendanceBonus: 0,
      }
      const { data, error } = await supabase.rpc('record_attendance_and_log', {
        p_member_name: m.name,
        p_coins_delta: reward,
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
      return false
    }

    const log = {
      id: ts,
      event: selectedEvent,
      date: dateStr,
      ts,
      members: ids.length,
      recorded_by: currentUser?.name || 'System',
      attendees: targets.map(m => {
        const reward = getAttendanceReward(m.power, selectedEvent)
        return {
          memberId: m.id,
          name: m.name,
          cls: m.cls,
          qualifier: 'full',
          sessionId: selectedSession.id,
          sessionLabel: selectedSession.label,
          sessionDisplayName: selectedSession.displayName,
          earned: reward,
          gp: Number(m.power) || 0,
          baseCoins: ATTENDANCE_REWARDS[selectedEvent].base,
          gpBonus: getAttendanceGpBonus(m.power, selectedEvent),
          perfectAttendanceBonus: 0,
        }
      }),
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
      const reward = getAttendanceReward(m.power, selectedEvent)
      const attendEntry = {
        event: selectedEvent,
        sessionId: selectedSession.id,
        sessionLabel: selectedSession.label,
        sessionDisplayName: selectedSession.displayName,
        date: dateStr,
        ts,
        qualifier: 'full',
        coins: reward,
        baseCoins: ATTENDANCE_REWARDS[selectedEvent].base,
        gp: Number(m.power) || 0,
        gpBonus: getAttendanceGpBonus(m.power, selectedEvent),
        perfectAttendanceBonus: 0,
      }
      return {
        ...m,
        coins: (m.coins || 0) + reward,
        attendance: (m.attendance || 0) + 1,
        attend_log: [...(m.attend_log || []), attendEntry],
      }
    }))
    setAttendanceLogs(prev => [log, ...prev])

    setSelectedMembers({})
    setSubmitting(false)
    addToast(
      `${ids.length} members recorded for ${selectedEvent} · ${selectedSession.displayName}.`,
      'gold',
      'Attendance Saved'
    )
    return true
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
        const entryTs = entry.ts || 0
        if (entryTs && log.ts && entryTs === log.ts) return false
        if (a.sessionId && entry.sessionId === a.sessionId && entry.event === log.event) return false
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

  const removeAttendee = async (log, attendee) => {
    if (!isElder) {
      addToast('Only Admin, Master, and Elder can remove an attendee.', 'red', 'Not Allowed')
      return
    }

    if (!log || !attendee) return

    const member = members.find(m =>
      String(m.id) === String(attendee.memberId) ||
      String(m.name).trim().toLowerCase() === String(attendee.name).trim().toLowerCase()
    )

    if (!member) {
      addToast(`Member "${attendee.name}" could not be found.`, 'red', 'Member Not Found')
      return
    }

    const reward = Number(attendee.earned ?? attendee.coins ?? 0)
    const newCoins = Math.max(0, Number(member.coins || 0) - reward)
    const newAttendance = Math.max(0, Number(member.attendance || 0) - 1)

    const updatedAttendees = (log.attendees || []).filter(a => {
      if (attendee.memberId != null && a.memberId != null) {
        return String(a.memberId) !== String(attendee.memberId)
      }
      return String(a.name).trim().toLowerCase() !== String(attendee.name).trim().toLowerCase()
    })

    const confirmMsg =
      `Remove "${attendee.name}" from ${getLogSession(log)?.displayName || log.event}?\n\n` +
      `This will reverse ${reward.toLocaleString()} Coins and 1 attendance for this player.\n\n` +
      `The rest of the attendance record will remain unchanged.`

    if (!window.confirm(confirmMsg)) return

    const key = `${log.id}-${attendee.memberId || attendee.name}`
    setRemovingAttendeeKey(key)

    const filteredMemberLog = (member.attend_log || []).filter(entry => {
      const sameEvent = String(entry.event || '') === String(log.event || '')
      const sameMember = attendee.memberId != null && entry.memberId != null
        ? String(entry.memberId) === String(attendee.memberId)
        : true
      const sameSession = attendee.sessionId
        ? String(entry.sessionId || '') === String(attendee.sessionId)
        : true
      const sameTs = entry.ts && log.ts
        ? Number(entry.ts) === Number(log.ts)
        : true

      return !(sameEvent && sameMember && sameSession && sameTs)
    })

    const { error: memberError } = await supabase
      .from('members')
      .update({
        coins: newCoins,
        attendance: newAttendance,
        attend_log: filteredMemberLog,
      })
      .eq('id', member.id)

    if (memberError) {
      console.error(`Failed to remove attendee ${attendee.name}:`, memberError)
      setRemovingAttendeeKey(null)
      addToast(`Couldn't remove ${attendee.name}: ${memberError.message}`, 'red', 'Remove Failed')
      return
    }

    const { error: logError } = await supabase
      .from('attendance_logs')
      .update({ attendees: updatedAttendees })
      .eq('id', log.id)

    if (logError) {
      console.error('Failed to update attendance log after attendee removal:', logError)

      await supabase
        .from('members')
        .update({
          coins: member.coins || 0,
          attendance: member.attendance || 0,
          attend_log: member.attend_log || [],
        })
        .eq('id', member.id)

      setRemovingAttendeeKey(null)
      addToast(`Couldn't update the attendance record: ${logError.message}`, 'red', 'Remove Failed')
      return
    }

    const updatedLog = { ...log, attendees: updatedAttendees }

    setMembers(prev => prev.map(m =>
      String(m.id) === String(member.id)
        ? { ...m, coins: newCoins, attendance: newAttendance, attend_log: filteredMemberLog }
        : m
    ))

    setAttendanceLogs(prev => prev.map(item =>
      String(item.id) === String(log.id) ? updatedLog : item
    ))

    setDetailLog(prev =>
      prev && String(prev.id) === String(log.id) ? updatedLog : prev
    )

    setRemovingAttendeeKey(null)

    addToast(
      `${attendee.name} removed · ${reward.toLocaleString()} Coins reversed.`,
      'red',
      'Attendee Removed'
    )
  }

  const openAddMissing = (log = null) => {
    const target = log || sortedLogs[0] || null
    if (!target) {
      addToast('There is no attendance record to add members to.', 'red', 'No Record')
      return
    }

    const attendees = target.attendees || []
    setMissingLog(target)
    setMissingMembers({})
    setMissingSearch('')
    setShowAddMissing(true)
  }

  const toggleMissingMember = (id) => {
    setMissingMembers(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const addMissingRecord = async () => {
    if (!isElder) {
      addToast('Only Admin, Master, and Elder can add missing attendance records.', 'red', 'Not Allowed')
      return
    }

    if (!missingLog) return

    const ids = Object.keys(missingMembers).filter(id => missingMembers[id])
    if (ids.length === 0) {
      addToast('Select at least one missing member.', 'red', 'No Members Selected')
      return
    }

    if (!ATTENDANCE_REWARDS[missingLog.event]) {
      addToast('This event does not have an automatic reward rule yet.', 'red', 'Reward Rule Missing')
      return
    }

    const existingNames = new Set((missingLog.attendees || []).map(a => String(a.name).trim().toLowerCase()))
    const targets = members.filter(m =>
      ids.includes(String(m.id)) &&
      !existingNames.has(String(m.name).trim().toLowerCase())
    )

    if (targets.length === 0) {
      addToast('Those members are already included in this attendance record.', 'red', 'Already Recorded')
      return
    }

    setAddingMissing(true)

    const logTs = missingLog.ts || Number(missingLog.id) || Date.now()
    const missingSession = getLogSession(missingLog)
    const logDate = missingLog.date || new Date(logTs).toLocaleDateString()
    const newAttendees = targets.map(m => {
      const reward = getAttendanceReward(m.power, missingLog.event)
      return {
        memberId: m.id,
        name: m.name,
        cls: m.cls,
        qualifier: 'full',
        sessionId: missingLog.sessionId || missingSession?.id || null,
        sessionLabel: missingLog.sessionLabel || missingSession?.label || null,
        sessionDisplayName: missingLog.sessionDisplayName || missingSession?.displayName || null,
        earned: reward,
        gp: Number(m.power) || 0,
        baseCoins: ATTENDANCE_REWARDS[missingLog.event].base,
        gpBonus: getAttendanceGpBonus(m.power, missingLog.event),
        perfectAttendanceBonus: 0,
      }
    })
    const updatedAttendees = [...(missingLog.attendees || []), ...newAttendees]

    const { error: logError } = await supabase
      .from('attendance_logs')
      .update({
        members: updatedAttendees.length,
        attendees: updatedAttendees,
      })
      .eq('id', missingLog.id)

    if (logError) {
      console.error('Failed to update attendance record:', logError)
      addToast(`Couldn't add the missing members: ${logError.message}`, 'red', 'Save Failed')
      setAddingMissing(false)
      return
    }

    const results = await Promise.all(targets.map(async (m) => {
      const reward = getAttendanceReward(m.power, missingLog.event)
      const attendEntry = {
        event: missingLog.event,
        sessionId: missingLog.sessionId || missingSession?.id || null,
        sessionLabel: missingLog.sessionLabel || missingSession?.label || null,
        sessionDisplayName: missingLog.sessionDisplayName || missingSession?.displayName || null,
        date: logDate,
        ts: logTs,
        qualifier: 'full',
        coins: reward,
        baseCoins: ATTENDANCE_REWARDS[missingLog.event].base,
        gp: Number(m.power) || 0,
        gpBonus: getAttendanceGpBonus(m.power, missingLog.event),
        perfectAttendanceBonus: 0,
      }

      const nextAttendLog = [...(m.attend_log || []), attendEntry]
      const { error } = await supabase
        .from('members')
        .update({
          coins: (m.coins || 0) + reward,
          attendance: (m.attendance || 0) + 1,
          attend_log: nextAttendLog,
        })
        .eq('id', m.id)

      return { member: m, ok: !error, error, nextAttendLog }
    }))

    const failed = results.filter(r => !r.ok)
    if (failed.length > 0) {
      console.error('Failed to update some missing members:', failed)
      addToast(
        `Attendance record updated, but some members failed: ${failed.map(r => r.member.name).join(', ')}`,
        'red',
        'Partial Save'
      )
      setAddingMissing(false)
      return
    }

    const updatedLog = {
      ...missingLog,
      members: updatedAttendees.length,
      attendees: updatedAttendees,
    }

    setAttendanceLogs(prev => prev.map(log => log.id === missingLog.id ? updatedLog : log))
    setMembers(prev => prev.map(m => {
      const result = results.find(r => r.member.id === m.id)
      if (!result) return m
      return {
        ...m,
        coins: (m.coins || 0) + getAttendanceReward(m.power, missingLog.event),
        attendance: (m.attendance || 0) + 1,
        attend_log: result.nextAttendLog,
      }
    }))

    setShowAddMissing(false)
    setMissingLog(null)
    setMissingMembers({})
    setAddingMissing(false)

    addToast(
      `${targets.length} missing member${targets.length === 1 ? '' : 's'} added to ${missingLog.event}. Rewards were calculated from each member's GP.`,
      'gold',
      'Missing Record Added'
    )
  }

  const awardPerfectAttendance = async (rows) => {
    if (!isElder || awardingPerfect || !rows?.length) return

    const freshRows = rows.filter(row => row.qualified && !row.awarded)
    if (freshRows.length === 0) {
      addToast('There are no unawarded qualified players for this week.', 'red', 'Already Awarded')
      return
    }

    const total = freshRows.length * PERFECT_ATTENDANCE_BONUS
    const names = freshRows.map(row => row.member.name).join(', ')
    const confirmed = window.confirm(
      `Award Weekly Perfect Attendance?\n\n${freshRows.length} qualified player(s):\n${names}\n\n+${PERFECT_ATTENDANCE_BONUS} Coins each\nTotal: +${total.toLocaleString()} Coins\n\nThis weekly bonus can only be awarded once per player.`
    )
    if (!confirmed) return

    setAwardingPerfect(true)
    const weekKey = currentWeekKey
    const awardedAt = Date.now()
    const results = await Promise.all(freshRows.map(async row => {
      const member = row.member
      const alreadyAwarded = (member.attend_log || []).some(entry => entry?.type === 'perfect_attendance_bonus' && entry?.weekKey === weekKey)
      if (alreadyAwarded) return { member, ok: true, skipped: true }

      const bonusEntry = {
        type: 'perfect_attendance_bonus',
        weekKey,
        weekLabel: currentWeekLabel,
        coins: PERFECT_ATTENDANCE_BONUS,
        sessions: PERFECT_ATTENDANCE_REQUIRED_SESSIONS,
        awardedAt,
        awardedBy: currentUser?.name || 'System',
      }
      const nextAttendLog = [...(member.attend_log || []), bonusEntry]
      const { error } = await supabase
        .from('members')
        .update({
          coins: (member.coins || 0) + PERFECT_ATTENDANCE_BONUS,
          attend_log: nextAttendLog,
        })
        .eq('id', member.id)

      return { member, ok: !error, error, nextAttendLog }
    }))

    const failed = results.filter(result => !result.ok)
    const successful = results.filter(result => result.ok)

    setMembers(prev => prev.map(member => {
      const result = successful.find(item => item.member.id === member.id)
      if (!result || result.skipped) return member
      return {
        ...member,
        coins: (member.coins || 0) + PERFECT_ATTENDANCE_BONUS,
        attend_log: result.nextAttendLog,
      }
    }))

    setAwardingPerfect(false)

    if (failed.length > 0) {
      addToast(`Perfect Attendance awarded to ${successful.filter(r => !r.skipped).length} player(s). Failed: ${failed.map(r => r.member.name).join(', ')}`, 'red', 'Partial Award')
      return
    }

    addToast(`+150 Coins awarded to ${successful.filter(r => !r.skipped).length} Perfect Attendance player(s).`, 'gold', 'Perfect Attendance Awarded')
  }

  const resetPerfectAttendanceAwards = async () => {
    if (!isElder || awardingPerfect) return

    const awardedRows = weeklyPerfectAttendance.filter(row => row.awarded)
    if (awardedRows.length === 0) {
      addToast('There are no Perfect Attendance awards to reset for this week.', 'red', 'Nothing to Reset')
      return
    }

    const total = awardedRows.length * PERFECT_ATTENDANCE_BONUS
    const names = awardedRows.map(row => row.member.name).join(', ')
    const confirmed = window.confirm(
      `Reset Weekly Perfect Attendance awards?\n\n` +
      `${awardedRows.length} player(s):\n${names}\n\n` +
      `This will remove the +${PERFECT_ATTENDANCE_BONUS} bonus and subtract ` +
      `${total.toLocaleString()} Coins in total.\n\n` +
      `The players will become eligible to be awarded again.`
    )
    if (!confirmed) return

    setAwardingPerfect(true)
    const weekKey = currentWeekKey

    const results = await Promise.all(awardedRows.map(async row => {
      const member = row.member
      const nextAttendLog = (member.attend_log || []).filter(entry =>
        !(entry?.type === 'perfect_attendance_bonus' && entry?.weekKey === weekKey)
      )

      const removedCount =
        (member.attend_log || []).length - nextAttendLog.length

      if (removedCount === 0) {
        return { member, ok: true, skipped: true, nextAttendLog }
      }

      const newCoins = Math.max(0, Number(member.coins) - (removedCount * PERFECT_ATTENDANCE_BONUS))

      const { error } = await supabase
        .from('members')
        .update({
          coins: newCoins,
          attend_log: nextAttendLog,
        })
        .eq('id', member.id)

      return {
        member,
        ok: !error,
        error,
        nextAttendLog,
        newCoins,
      }
    }))

    const failed = results.filter(result => !result.ok)
    const successful = results.filter(result => result.ok && !result.skipped)

    setMembers(prev => prev.map(member => {
      const result = successful.find(item => item.member.id === member.id)
      if (!result) return member

      return {
        ...member,
        coins: result.newCoins,
        attend_log: result.nextAttendLog,
      }
    }))

    setAwardingPerfect(false)

    if (failed.length > 0) {
      addToast(
        `Reset completed for ${successful.length} player(s). Failed: ${failed.map(r => r.member.name).join(', ')}`,
        'red',
        'Partial Reset'
      )
      return
    }

    addToast(
      `Perfect Attendance reset for ${successful.length} player(s). ${total.toLocaleString()} Coins reversed.`,
      'gold',
      'Awards Reset'
    )
  }

  const sortedLogs = [...attendanceLogs].sort((a, b) => {
    const ta = a.ts || Number(a.id) || new Date(a.date).getTime() || 0
    const tb = b.ts || Number(b.id) || new Date(b.date).getTime() || 0
    return tb - ta
  })

  const selectedCount = Object.values(selectedMembers).filter(Boolean).length
  const allFilteredSelected = filtered.length > 0 && filtered.every(m => selectedMembers[m.id])

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

  const visiblePerfectRows = weeklyPerfectAttendance.filter(row => {
    const matchesSearch = String(row.member.name || '').toLowerCase().includes(perfectSearch.trim().toLowerCase())
    if (!matchesSearch) return false
    if (perfectFilter === 'qualified') return row.qualified
    if (perfectFilter === 'ready') return row.qualified && !row.awarded
    if (perfectFilter === 'awarded') return row.awarded
    return true
  })

  const filteredHistoryLogs = sortedLogs.filter(log => {
    const q = historySearch.trim().toLowerCase()
    if (!q) return true
    const attendees = log.attendees || []
    const haystack = [
      log.event,
      log.sessionDisplayName,
      log.sessionLabel,
      log.recorded_by,
      log.recordedBy,
      ...attendees.map(a => a.name),
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(q)
  })

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryLogs.length / HISTORY_PAGE_SIZE))
  const safeHistoryPage = Math.min(historyPage, historyTotalPages)
  const paginatedHistoryLogs = filteredHistoryLogs.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE
  )

  return (
    <div className="min-w-0 space-y-3">
      {/* Header */}
      <header className="rounded-2xl border border-gold/15 bg-[#0c0a09]/90">
        <div className="flex flex-col gap-2 px-4 py-3 sm:px-5 sm:py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.18em] text-gold-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-bright" />
              Clan Management
            </div>
            <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
              <h1 className="font-spectral text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">Attendance</h1>
              <span className="rounded-md border border-white/[.07] bg-black/20 px-2 py-0.5 text-[11px] font-sans text-text-dim">{members.length} members</span>
              <span className="rounded-md border border-white/[.07] bg-black/20 px-2 py-0.5 text-[11px] font-sans text-text-dim">{sortedLogs.length} logs</span>
            </div>
            <p className="mt-0.5 text-[12px] sm:text-[13px] text-text-dim">
              {isElder ? 'Select a session, mark attendees, and let GP determine the reward.' : 'View clan attendance and event participation.'}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <div className="text-left sm:text-right text-[11px] sm:text-[12px] text-text-dim">
              <span>Server </span><span className="font-semibold text-gold-light">{formatGMT8(now)}</span>
              <span className="mx-1.5">·</span>
              <span>Local </span><span className="font-semibold text-text-bright">{formatInAutoLocalZone(now)}</span>
            </div>
            {isElder && (
              <button type="button" onClick={() => setShowRecordModal(true)} className="btn-gold min-h-9 w-full px-3 text-[12px] font-bold sm:w-auto">
                + Record
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Weekly calendar — thin expandable bar */}
      <section className="overflow-hidden rounded-2xl border border-gold/15 bg-[#0c0a09]/[.97]">
        <button
          type="button"
          onClick={() => setShowEventSchedule(value => !value)}
          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left sm:px-5 hover:bg-white/[.018]"
          aria-expanded={showEventSchedule}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-bold uppercase tracking-[.14em] text-text-dim">Weekly Event Calendar</span>
              <span className="rounded-md border border-white/[.08] bg-black/15 px-2 py-0.5 text-[11px] text-text-dim">{currentWeekLabel}</span>
              <span className="text-[10px] text-text-dim">8 sessions · GMT+8</span>
            </div>
          </div>
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/[.08] text-[14px] font-semibold text-text-dim">
            {showEventSchedule ? '−' : '+'}
          </span>
        </button>

        {showEventSchedule && (
          <div className="border-t border-white/[.06] px-3 py-3 sm:px-4">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
              {[2, 4, 6].map(day => {
                const daySessions = WEEKLY_EVENT_SESSIONS.filter(session => session.day === day)
                const dayLabel = daySessions[0]?.dayLabel || ''
                return (
                  <div key={day} className="rounded-xl border border-white/[.07] bg-black/15 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">{dayLabel}</span>
                      <span className="text-[10px] text-text-dim">{daySessions.length} sessions</span>
                    </div>
                    <div className="space-y-1.5">
                      {daySessions.map((session, index) => {
                        const times = formatSessionTimes(session, now)
                        const run = getRunLabel(session)
                        return (
                          <div key={session.id} className="rounded-lg border border-white/[.06] bg-[#10100e] px-2.5 py-2">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-[9px] text-text-dim">{String(index + 1).padStart(2, '0')}</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold leading-4 text-text-bright">{session.displayName}</div>
                                <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-text-dim">
                                  <span>Server {times.serverTime}</span>
                                  <span>Local {times.localTime}</span>
                                  {run !== 'Single Run' && <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${getRunTagClass(run)}`}>{run}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Weekly status — compact stat chips */}
      <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <button
          type="button"
          onClick={() => setShowPerfectAttendance(true)}
          className="flex min-w-0 w-full items-center justify-between gap-3 rounded-xl border border-white/[.08] bg-[#0c0a09]/[.97] px-3.5 py-3 text-left hover:border-gold/20 sm:py-2.5"
        >
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[.14em] text-text-dim">Perfect Attendance</div>
            <div className="mt-0.5 truncate text-[13px] font-semibold text-text-bright">{qualifiedPerfectAttendance.length} qualified · 8/8 required</div>
          </div>
          <span className="flex-shrink-0 whitespace-nowrap text-[13px] font-bold text-gold-bright">+150</span>
        </button>

        <button
          type="button"
          onClick={() => setShowRewardGuide(true)}
          className="flex min-w-0 w-full flex-wrap items-center gap-1.5 rounded-xl border border-white/[.08] bg-[#0c0a09]/[.97] px-3.5 py-3 text-left transition-colors hover:border-gold/25 hover:bg-gold/[.02] sm:py-2.5"
          title="View reward and GP bonus criteria"
        >
          <div className="mr-1 min-w-0 basis-full sm:basis-auto">
            <div className="text-[10px] font-bold uppercase tracking-[.14em] text-text-dim">Reward Guide</div>
            <div className="text-[11px] text-text-dim">Click to view GP bonus criteria</div>
          </div>
          {[['Battle', 100], ['Boss', 50], ['Annihilation', 75], ['Sindri', 75], ['Sanctuary', 50]].map(([name, base]) => (
            <div key={name} className="flex-shrink-0 rounded-lg border border-white/[.06] bg-black/15 px-2.5 py-1.5">
              <span className="text-[10px] text-text-dim">{name}</span>
              <span className="ml-1.5 text-[11px] font-semibold text-text-bright">+{base}</span>
            </div>
          ))}
        </button>
      </div>

      {/* Recent Attendance — only a small page of records is rendered */}
      <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0c0a09]/95 shadow-[0_10px_40px_rgba(0,0,0,.18)]">
        <div className="flex flex-col gap-2.5 border-b border-white/[.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-text-bright">Recent Attendance</h2>
            <p className="mt-0.5 text-[12px] text-text-dim">Showing the latest 8 records · use search to find older sessions</p>
          </div>
          <div className="flex items-center gap-1.5">
            {isElder && sortedLogs.length > 0 && <button type="button" onClick={() => openAddMissing()} className="rounded-lg border border-gold/20 bg-gold/[.035] px-2.5 py-1.5 text-[11px] font-bold text-gold-light hover:border-gold/40">+ Add Missing</button>}
            <span className="rounded-md border border-white/[.07] bg-black/20 px-2 py-1 text-[11px] font-sans text-text-dim">{sortedLogs.length} logs</span>
          </div>
        </div>

        <div className="border-b border-white/[.06] bg-black/10 px-4 py-2.5">
          <div className="flex gap-1.5">
            <div className="relative min-w-0 flex-1">
              <input
                className="input h-8 w-full pl-8 text-[12px]"
                placeholder="Search event, run, player, or recorder..."
                value={historySearch}
                onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1) }}
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim text-[13px]">⌕</span>
            </div>
            {historySearch && <button type="button" onClick={() => { setHistorySearch(''); setHistoryPage(1) }} className="rounded-lg border border-white/[.08] px-2.5 text-[11px] text-text-dim hover:text-text-bright">Clear</button>}
          </div>
        </div>

        <div className="divide-y divide-white/[.045]">
          {paginatedHistoryLogs.map(log => {
            const attendees = log.attendees || []
            const logTs = log.ts || Number(log.id) || new Date(log.date).getTime() || 0
            const totalAwarded = attendees.reduce((sum, a) => sum + (Number(a.earned) || 0), 0)
            const session = getLogSession(log)
            const run = getRunLabel(session)
            const isDeleting = deletingId === log.id
            return (
              <div key={log.id} className="px-4 py-3 hover:bg-white/[.018]">
                <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[14px] font-semibold text-text-bright">{log.sessionDisplayName || log.event}</span>
                      <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${getRunTagClass(run)}`}>{run}</span>
                      <span className="rounded-md border border-white/[.07] bg-black/20 px-1.5 py-0.5 text-[10px] font-sans text-text-dim">{attendees.length}/50</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] sm:text-[12px] text-text-dim">
                      <span title={`Server time: ${formatGMT8Short(logTs)} · GMT+8`}>Local {formatInAutoLocalZone(logTs)}</span>
                      <span>by <strong className="text-gold-light">{log.recorded_by || log.recordedBy || 'System'}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 lg:justify-end">
                    <span className="flex items-center gap-1 text-[12px] font-bold text-gold-light"><span aria-hidden="true">🪙</span>{totalAwarded.toLocaleString()}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { setAttendeeSearch(''); setDetailLog(log) }} title="View attendance details" aria-label="View attendance details" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[.08] text-[13px] text-text-dim hover:border-white/[.16] hover:text-text-bright">⌕</button>
                      {isElder && attendees.length < 50 && <button type="button" onClick={() => openAddMissing(log)} title="Add missing members" aria-label="Add missing members" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[.08] text-[14px] text-text-dim hover:border-white/[.16] hover:text-text-bright">+</button>}
                      {isElder && (
                        <div className="relative">
                          <button type="button" onClick={() => setOpenActionMenuId(openActionMenuId === log.id ? null : log.id)} title="More actions" aria-label="More actions" aria-expanded={openActionMenuId === log.id} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[.08] text-[16px] text-text-dim hover:border-white/[.16] hover:text-text-bright">⋮</button>
                          {openActionMenuId === log.id && (
                            <div className="absolute right-0 top-9 z-30 min-w-[120px] rounded-lg border border-white/[.10] bg-[#11100f] p-1 shadow-xl">
                              <button type="button" onClick={() => { setOpenActionMenuId(null); deleteLog(log) }} disabled={isDeleting} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11px] font-semibold text-red-300 hover:bg-red-500/[.07] disabled:opacity-40">
                                {isDeleting ? 'Deleting…' : 'Delete record'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {paginatedHistoryLogs.length === 0 && <div className="px-4 py-10 text-center text-[12px] text-text-dim">No attendance records found.</div>}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[.06] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] text-text-dim">Page {safeHistoryPage} of {historyTotalPages} · {filteredHistoryLogs.length} matching</span>
          <div className="flex gap-1">
            <button type="button" disabled={safeHistoryPage <= 1} onClick={() => setHistoryPage(page => Math.max(1, page - 1))} className="flex-1 rounded-lg border border-white/[.08] px-2.5 py-1.5 text-[11px] text-text-dim disabled:opacity-30 sm:flex-none">← Prev</button>
            <button type="button" disabled={safeHistoryPage >= historyTotalPages} onClick={() => setHistoryPage(page => Math.min(historyTotalPages, page + 1))} className="flex-1 rounded-lg border border-white/[.08] px-2.5 py-1.5 text-[11px] text-text-dim disabled:opacity-30 sm:flex-none">Next →</button>
          </div>
        </div>
      </section>

      {/* Record Attendance modal */}
      {isElder && showRecordModal && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-3 backdrop-blur-[3px]" role="dialog" aria-modal="true">
          <div className="flex w-full max-w-3xl max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-gold/20 bg-[#0c0a09] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/[.07] px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-text-bright">Record Attendance</h3>
                  {selectedSession && <span className="rounded-md border border-gold/20 bg-gold/[.04] px-2 py-0.5 text-[11px] font-bold text-gold-light">{getRunLabel(selectedSession)}</span>}
                </div>
                <p className="mt-0.5 text-[12px] text-text-dim">Pick the exact event and run first. Players will see exactly which session they are being recorded for.</p>
              </div>
              <button type="button" onClick={() => !submitting && setShowRecordModal(false)} disabled={submitting} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[.08] text-text-dim hover:border-gold/30 hover:text-gold-light disabled:opacity-40">×</button>
            </div>

            <div className="min-h-0 overflow-y-auto p-4">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">Event</span>
                  <select className="input h-9 w-full text-[13px]" value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
                    {eventTypes.map(e => <option key={e}>{e}</option>)}
                  </select>
                </label>
                <div>
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">Run / Session</span>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {eventSessions.map(session => {
                      const active = selectedSessionId === session.id
                      const times = formatSessionTimes(session, now)
                      return (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => setSelectedSessionId(session.id)}
                          className={`min-h-[58px] rounded-lg border px-3 py-2 text-left transition-colors ${active ? 'border-gold/40 bg-gold/[.07]' : 'border-white/[.08] bg-black/15 hover:border-gold/20'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[13px] font-bold ${active ? 'text-gold-bright' : 'text-text-bright'}`}>{getRunLabel(session)}</span>
                            {active && <span className="text-[11px] text-gold-bright">✓</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="truncate text-[11px] text-text-dim">{session.displayName}</span>
                            <span className="font-sans text-[10px] text-text-dim">{times.serverTime} · Local {times.localTime}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-gold/15 bg-gold/[.025] px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim">Selected Session</div>
                    <div className="mt-0.5 text-[14px] font-semibold text-text-bright">{selectedSession?.displayName || 'Choose a session'}</div>
                    <div className="mt-0.5 text-[11px] text-text-dim">{selectedSession ? `${getRunLabel(selectedSession)} · ${formatSessionTimes(selectedSession, now).serverTime} GMT+8` : 'No session selected'}</div>
                  </div>
                  <div className="text-right"><div className="text-[11px] text-text-dim">Selected</div><div className="font-sans text-[14px] font-bold text-gold-bright">{selectedCount} · {selectedTotalCoins.toLocaleString()} Coins</div></div>
                </div>
              </div>

              {selectedSession && (
                <div className="mt-2.5 rounded-lg border border-white/[.07] bg-black/15 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
                    <span className="font-semibold text-text-bright">
                      Reward: <span className="text-gold-light">+{ATTENDANCE_REWARDS[selectedEvent]?.base || 0} base</span>
                    </span>
                    <span className="text-text-dim">
                      GP bonus: <span className="font-sans font-semibold text-gold-light">+{getAttendanceGpBonus(0, selectedEvent)}</span> to <span className="font-sans font-semibold text-gold-light">+{ATTENDANCE_REWARDS[selectedEvent]?.bonuses?.[3] || 0}</span>
                    </span>
                    <span className="text-text-dim">
                      Exact bonus is shown beside each selected player.
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-col gap-1.5 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <input className="input h-8 w-full pl-8 text-[12px]" placeholder="Search member..." value={search} onChange={e => setSearch(e.target.value)} />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim text-[13px]">⌕</span>
                </div>
                <button type="button" onClick={toggleAllFiltered} className="min-h-8 w-full rounded-lg border border-white/[.08] px-2.5 text-[11px] font-semibold sm:w-auto sm:shrink-0 text-text-dim hover:border-gold/25 hover:text-gold-light">{allFilteredSelected ? 'Clear Visible' : 'Select Visible'}</button>
                {selectedCount > 0 && <button type="button" onClick={clearSelection} className="min-h-8 w-full rounded-lg border border-white/[.08] px-2.5 text-[11px] text-text-dim hover:text-red-300 sm:w-auto sm:shrink-0">Clear</button>}
              </div>

              <div className="mt-2.5 overflow-hidden rounded-xl border border-white/[.07]">
                <div className="hidden sm:grid grid-cols-[28px_minmax(0,1fr)_72px_125px] items-center gap-2 border-b border-white/[.06] bg-black/20 px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-text-dim">
                  <span />
                  <span>Member</span>
                  <span className="text-right">GP</span>
                  <span className="text-right">Reward</span>
                </div>
                <div className="max-h-[390px] overflow-y-auto divide-y divide-white/[.045]">
                  {filtered.map(m => {
                    const checked = !!selectedMembers[m.id]
                    const reward = getAttendanceReward(m.power, selectedEvent)
                    return (
                      <button key={m.id} type="button" onClick={() => toggleMember(m.id)} aria-pressed={checked} className={`grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 text-left sm:grid-cols-[28px_minmax(0,1fr)_72px_125px] ${checked ? 'bg-gold/[.055]' : 'hover:bg-white/[.02]'}`}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-md border text-[13px] ${checked ? 'border-gold bg-gold text-black' : 'border-white/15 bg-black/20 text-transparent'}`}>✓</span>
                         <span className="min-w-0">
                           <span className={`block truncate text-[13px] font-semibold ${checked ? 'text-gold-light' : 'text-text-bright'}`}>{m.name}</span>
                           <span className="block truncate text-[10px] text-text-dim">{m.cls || 'Member'}</span>
                           <span className="mt-0.5 block truncate text-[10px] font-sans text-text-dim sm:hidden">{formatGp(m.power)} GP · Base +{ATTENDANCE_REWARDS[selectedEvent]?.base || 0} · GP +{getAttendanceGpBonus(m.power, selectedEvent)}</span>
                         </span>
                         <span className="text-right font-sans text-[11px] text-text-dim">
                           <span className="font-semibold text-green-300 sm:hidden">+{reward}</span>
                           <span className="hidden sm:inline">{formatGp(m.power)}</span>
                         </span>
                         <span className="hidden text-right sm:block">
                           <span className="block font-sans text-[13px] font-bold text-green-300">+{reward}</span>
                           <span className="block mt-0.5 text-[10px] text-text-dim">Base +{ATTENDANCE_REWARDS[selectedEvent]?.base || 0} · GP +{getAttendanceGpBonus(m.power, selectedEvent)}</span>
                         </span>
                      </button>
                    )
                  })}
                  {filtered.length === 0 && <div className="px-4 py-10 text-center text-[12px] text-text-dim">No members found.</div>}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 border-t border-white/[.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><div className="text-[12px] font-semibold text-text-bright">{selectedCount ? `${selectedCount} members ready` : 'No members selected'}</div><div className="truncate text-[11px] text-text-dim">{selectedSession?.displayName || 'Select a session'}</div></div>
              <div className="flex w-full gap-1.5 sm:w-auto">
                <button type="button" onClick={() => setShowRecordModal(false)} disabled={submitting} className="flex-1 rounded-lg border border-white/[.08] px-3 py-1.5 text-[12px] text-text-dim disabled:opacity-40 sm:flex-none">Cancel</button>
                <button type="button" onClick={async () => { const ok = await recordAttendance(); if (ok) setShowRecordModal(false) }} disabled={submitting || selectedCount === 0 || !selectedSession} className="btn-gold min-h-8 flex-1 px-3 text-[12px] font-bold disabled:opacity-40 sm:flex-none">
                  {submitting ? 'Saving…' : selectedCount ? `Record ${selectedCount}` : 'Select Members'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full weekly event schedule */}
      {showEventSchedule && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-label="Weekly Event Schedule"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setShowEventSchedule(false)
          }}
        >
          <div className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-gold/20 bg-[#0c0a09] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/[.07] px-4 py-4 sm:px-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-gold/20 bg-gold/[.05] px-2 py-1 text-[12px] font-bold uppercase tracking-[.12em] text-gold-dim">Weekly Schedule</span>
                  <span className="text-[13px] font-sans text-text-dim">{currentWeekLabel}</span>
                </div>
                <h3 className="mt-1.5 text-lg font-bold text-text-bright">Event Schedule</h3>
                <p className="mt-0.5 text-[13px] text-text-dim">Server Time GMT+8 · Local time is shown for reference</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEventSchedule(false)}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/[.08] text-text-dim hover:border-gold/30 hover:text-gold-light"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="space-y-4">
                {[2, 4, 6].map(day => {
                  const daySessions = WEEKLY_EVENT_SESSIONS.filter(session => session.day === day)
                  const dayLabel = daySessions[0]?.dayLabel || ''
                  return (
                    <div key={day} className="overflow-hidden rounded-xl border border-white/[.08] bg-[#10100e]">
                      <div className="flex items-center justify-between border-b border-white/[.07] bg-white/[.02] px-3.5 py-2.5 sm:px-4">
                        <div>
                          <div className="text-[15px] font-bold uppercase tracking-[.12em] text-gold-light">{dayLabel}</div>
                          <div className="mt-0.5 text-[12px] text-text-dim">{daySessions.length} scheduled {daySessions.length === 1 ? 'session' : 'sessions'}</div>
                        </div>
                        <span className="rounded-md border border-gold/15 bg-gold/[.035] px-2 py-1 text-[12px] font-sans font-bold text-gold-light">{daySessions.length}</span>
                      </div>

                      <div className="divide-y divide-white/[.05]">
                        {daySessions.map((session, index) => {
                          const times = formatSessionTimes(session, now)
                          const run = getRunLabel(session)
                          return (
                            <div key={session.id} className="px-3.5 py-3 sm:px-4">
                              <div className="flex items-start gap-3">
                                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gold/15 bg-gold/[.045] text-[12px] font-sans font-bold text-gold-light">{String(index + 1).padStart(2, '0')}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[15px] sm:text-[15px] font-semibold leading-5 text-text-bright">{session.displayName}</span>
                                    {run !== 'Single Run' && (
                                      <span className="rounded-md border border-gold/20 bg-gold/[.04] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[.08em] text-gold-light">{run}</span>
                                    )}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <span className="rounded-md border border-gold/15 bg-gold/[.035] px-2.5 py-1.5 text-[12px] font-sans font-bold text-gold-light">Server {times.serverTime} · GMT+8</span>
                                    <span className="rounded-md border border-white/[.08] bg-black/20 px-2.5 py-1.5 text-[12px] font-sans font-semibold text-text-bright">Local {times.localTime}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 rounded-xl border border-gold/15 bg-gold/[.025] p-3.5">
                <div className="text-[12px] font-bold uppercase tracking-[.12em] text-gold-dim">Reward Information</div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/[.06] bg-black/15 px-3 py-2.5 text-[12px] text-text-dim">
                    <span className="font-semibold text-text-bright">Attendance:</span> Base reward + GP bonus according to the member's GP tier.
                  </div>
                  <div className="rounded-lg border border-gold/15 bg-gold/[.025] px-3 py-2.5 text-[12px] text-text-dim">
                    <span className="font-semibold text-gold-light">Perfect Attendance:</span> Attend all 8 weekly sessions → <span className="font-sans font-bold text-gold-bright">+150 Coins</span>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reward Guide modal */}
      {showRewardGuide && (
        <div
          className="fixed inset-0 z-[225] flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-label="Attendance reward guide"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setShowRewardGuide(false)
          }}
        >
          <div className="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-2xl border border-gold/20 bg-[#0c0a09] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/[.07] px-4 py-4 sm:px-5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-gold-dim">Attendance Rewards</div>
                <h3 className="mt-1 text-lg font-bold text-text-bright">Reward & GP Bonus Criteria</h3>
                <p className="mt-1 text-[12px] leading-5 text-text-dim">
                  Each attendance gives a base reward. Your GP determines the additional bonus.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRewardGuide(false)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[.08] text-text-dim hover:border-gold/30 hover:text-gold-light"
                aria-label="Close reward guide"
              >
                ×
              </button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-4 sm:p-5">
              <div className="overflow-x-auto rounded-xl border border-white/[.07]">
                <div className="min-w-[680px]">
                  <div className="grid grid-cols-[minmax(180px,1.5fr)_70px_repeat(4,minmax(88px,1fr))] items-center border-b border-white/[.07] bg-white/[.025] px-3 py-3 text-[10px] font-bold uppercase tracking-[.1em] text-text-dim sm:px-4">
                    <span>Event</span>
                    <span className="text-center">Base</span>
                    <span className="text-center">100–150k</span>
                    <span className="text-center">150–200k</span>
                    <span className="text-center">200–250k</span>
                    <span className="text-center">250k+</span>
                  </div>

                  {[
                    ['Server Battle', 100, 5, 10, 15, 20],
                    ['World Boss', 50, 3, 5, 10, 15],
                    ['Clan Annihilation', 75, 5, 10, 15, 20],
                    ["Sindri's Treasure Island", 75, 5, 10, 15, 20],
                    ['Clan Sanctuary', 50, 3, 5, 10, 15],
                  ].map(([event, base, b1, b2, b3, b4]) => (
                    <div key={event} className="grid grid-cols-[minmax(180px,1.5fr)_70px_repeat(4,minmax(88px,1fr))] items-center border-b border-white/[.05] px-3 py-3 last:border-b-0 sm:px-4">
                      <div>
                        <div className="text-[12px] font-semibold text-text-bright">{event}</div>
                        <div className="mt-0.5 text-[10px] text-text-dim">Per attendance</div>
                      </div>
                      <div className="text-center text-[12px] font-bold text-text-bright">+{base}</div>
                      {[b1, b2, b3, b4].map((bonus, index) => (
                        <div key={index} className="text-center text-[12px] font-semibold text-gold-light">+{bonus}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/[.07] bg-black/15 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">GP bonus</div>
                  <p className="mt-1.5 text-[12px] leading-5 text-text-dim">
                    The GP bonus is calculated when attendance is recorded. Higher GP tiers receive a larger bonus on top of the base reward.
                  </p>
                </div>
                <div className="rounded-xl border border-gold/15 bg-gold/[.025] p-3">
                  <div className="text-[11px] font-bold uppercase tracking-[.12em] text-gold-dim">Perfect Attendance</div>
                  <p className="mt-1.5 text-[12px] leading-5 text-text-dim">
                    Attend all <strong className="text-text-bright">8 scheduled sessions</strong> Tuesday–Saturday to qualify for the separate <strong className="text-gold-bright">+150 Coins</strong> weekly bonus.
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/[.07] bg-white/[.015] px-3 py-2.5 text-[11px] leading-5 text-text-dim">
                <strong className="text-text-bright">Session reminder:</strong> Clan Annihilation and Sindri's Treasure Island each have a First Run and Second Run. Each run counts as its own scheduled attendance session.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Perfect Attendance details modal — keeps the main page short even with 50 members */}
      {showPerfectAttendance && (() => {
        return (
          <div
            className="fixed inset-0 z-[230] flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-[3px]"
            role="dialog"
            aria-modal="true"
            aria-label="Weekly Perfect Attendance"
            onMouseDown={e => {
              if (e.target === e.currentTarget && !awardingPerfect) setShowPerfectAttendance(false)
            }}
          >
            <div className="flex w-full max-w-4xl max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-gold/20 bg-[#0c0a09] shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-white/[.07] px-4 py-3.5 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-gold/20 bg-gold/[.05] px-2 py-1 text-[12px] font-bold uppercase tracking-[.14em] text-gold-dim">Weekly</span>
                    <span className="text-[13px] font-sans text-text-dim">{currentWeekLabel}</span>
                  </div>
                  <h3 className="mt-1.5 text-lg font-bold text-text-bright">Perfect Attendance</h3>
                  <p className="mt-0.5 text-[13px] text-text-dim">Players are qualified only when they attend all {PERFECT_ATTENDANCE_REQUIRED_SESSIONS} scheduled sessions.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg border border-gold/15 bg-gold/[.035] px-3 py-2 text-right">
                    <div className="text-[11px] font-bold uppercase tracking-[.12em] text-text-dim">Reward</div>
                    <div className="mt-0.5 font-sans text-sm font-bold text-gold-bright">+150 Coins</div>
                  </div>
                  <button type="button" onClick={() => setShowPerfectAttendance(false)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[.08] text-text-dim hover:border-gold/30 hover:text-gold-light" aria-label="Close">×</button>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-b border-white/[.06] bg-black/10 px-4 py-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <input
                    className="input h-10 w-full pl-9"
                    placeholder="Search player..."
                    value={perfectSearch}
                    onChange={e => setPerfectSearch(e.target.value)}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim text-xs">⌕</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[['qualified', 'Qualified'], ['ready', 'Ready'], ['awarded', 'Awarded'], ['all', 'All']].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPerfectFilter(value)}
                      className={`rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors ${perfectFilter === value ? 'border-gold/35 bg-gold/[.07] text-gold-light' : 'border-white/[.08] bg-black/15 text-text-dim hover:text-text-bright'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-b border-white/[.06] px-4 py-2.5 text-[12px] text-text-dim">
                <span>Showing <strong className="text-text-bright">{visiblePerfectRows.length}</strong> of {weeklyPerfectAttendance.length} players</span>
                <span><strong className="text-gold-light">{qualifiedPerfectAttendance.length}</strong> qualified</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                {visiblePerfectRows.length === 0 ? (
                  <div className="py-12 text-center text-xs text-text-dim">No players match this filter.</div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-white/[.07]">
                    <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_150px_125px_120px] items-center gap-3 border-b border-white/[.07] bg-white/[.02] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">
                      <span>Player</span><span>Attendance</span><span>Status</span><span className="text-right">Bonus</span>
                    </div>
                    <div className="divide-y divide-white/[.05]">
                      {visiblePerfectRows.map(row => (
                        <div key={row.member.id} className="px-3 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_150px_125px_120px] sm:items-center sm:gap-3 sm:px-4">
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-bold text-text-bright">{row.member.name}</div>
                            <div className="mt-0.5 text-[12px] text-text-dim">{row.attendedCount}/{PERFECT_ATTENDANCE_REQUIRED_SESSIONS} sessions attended</div>
                            <div className="mt-2 flex h-1.5 max-w-[260px] overflow-hidden rounded-full bg-white/[.06]">
                              {WEEKLY_EVENT_SESSIONS.map(session => (
                                <span key={session.id} className={`flex-1 border-r border-black/30 last:border-r-0 ${row.attendedSessionIds.has(session.id) ? 'bg-gold-bright' : 'bg-white/[.035]'}`} />
                              ))}
                            </div>
                          </div>
                          <div className="mt-2 text-[13px] font-sans text-text-dim sm:mt-0">
                            <span className="text-text-bright">{row.attendedCount}</span> / {PERFECT_ATTENDANCE_REQUIRED_SESSIONS}
                          </div>
                          <div className="mt-2 sm:mt-0">
                            {row.awarded ? (
                              <span className="inline-flex rounded-md border border-green-500/15 bg-green-500/[.035] px-2 py-1 text-[12px] font-semibold text-green-300">✓ Awarded</span>
                            ) : row.qualified ? (
                              <span className="inline-flex rounded-md border border-gold/20 bg-gold/[.045] px-2 py-1 text-[12px] font-semibold text-gold-light">🏆 Qualified</span>
                            ) : (
                              <span className="inline-flex rounded-md border border-white/[.07] bg-black/15 px-2 py-1 text-[12px] text-text-dim">Not qualified</span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 sm:mt-0 sm:justify-end">
                            <span className="font-sans text-sm font-bold text-gold-bright">{row.qualified ? '+150' : '—'}</span>
                            {isElder && row.qualified && !row.awarded && (
                              <button
                                type="button"
                                onClick={() => awardPerfectAttendance([row])}
                                disabled={awardingPerfect}
                                className="rounded-lg border border-gold/20 bg-gold/[.035] px-2.5 py-1.5 text-[12px] font-semibold text-gold-light hover:border-gold/40 disabled:opacity-40"
                              >
                                Award
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-white/[.06] bg-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[12px] text-text-dim">Attendance is calculated from the 8 scheduled sessions for this week.</div>
                {isElder && (
                  <div className="flex flex-wrap items-center gap-2">
                    {unawardedPerfectAttendance.length > 0 && (
                      <button
                        type="button"
                        onClick={() => awardPerfectAttendance(unawardedPerfectAttendance)}
                        disabled={awardingPerfect}
                        className="btn-gold min-h-9 px-3.5 text-[13px] font-bold disabled:opacity-40"
                      >
                        {awardingPerfect ? 'Awarding…' : `Award +150 to All ${unawardedPerfectAttendance.length} Qualified`}
                      </button>
                    )}
                    {weeklyPerfectAttendance.some(row => row.awarded) && (
                      <button
                        type="button"
                        onClick={resetPerfectAttendanceAwards}
                        disabled={awardingPerfect}
                        className="min-h-9 rounded-lg border border-red-500/20 bg-red-500/[.035] px-3.5 text-[13px] font-bold text-red-300 hover:border-red-500/35 disabled:opacity-40"
                      >
                        {awardingPerfect ? 'Processing…' : 'Reset Awards'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Add missing attendance record — staff only */}
      {showAddMissing && missingLog && (() => {
        const alreadyRecorded = new Set((missingLog.attendees || []).map(a => String(a.name).trim().toLowerCase()))
        const availableMissing = members.filter(m => {
          if (alreadyRecorded.has(String(m.name).trim().toLowerCase())) return false
          return String(m.name || '').toLowerCase().includes(missingSearch.toLowerCase())
        })
        const missingSelectedCount = Object.values(missingMembers).filter(Boolean).length
        const baseRecordedCount = (missingLog.attendees || []).length

        return (
          <div
            className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Add missing attendance record"
            onMouseDown={e => {
              if (e.target === e.currentTarget && !addingMissing) setShowAddMissing(false)
            }}
          >
            <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-gold/20 bg-[#0c0a09] shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/[.06] px-4 sm:px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-gold/20 bg-gold/[.05] px-2 py-1 text-[12px] font-bold uppercase tracking-[.14em] text-gold-dim">
                      Staff Only
                    </span>
                    <span className="text-[13px] font-sans text-text-dim">
                      {baseRecordedCount}/50 recorded
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-bold text-text-bright">Add Missing Record</h3>
                  <p className="mt-1 text-[13px] leading-4 text-text-dim">
                    Add a member who was accidentally left out of an existing attendance event.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => !addingMissing && setShowAddMissing(false)}
                  disabled={addingMissing}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[.08] text-text-dim hover:border-gold/30 hover:text-gold-light disabled:opacity-40"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="max-h-[68vh] overflow-y-auto p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-[.16em] text-text-dim">Attendance Session</span>
                    <select
                      className="input w-full h-10"
                      value={missingLog.id}
                      onChange={e => {
                        const next = attendanceLogs.find(log => String(log.id) === String(e.target.value))
                        if (next) {
                          setMissingLog(next)
                          setMissingMembers({})
                        }
                      }}
                    >
                      {sortedLogs.map(log => (
                        <option key={log.id} value={log.id}>
                          {log.event} · {formatGMT8Short(log.ts || Number(log.id) || Date.now())} · {(log.attendees || []).length}/50
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="block">
                    <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-[.16em] text-text-dim">Automatic Reward</span>
                    <div className="h-10 flex items-center rounded-lg border border-gold/20 bg-gold/[.04] px-3 text-[13px] text-text-dim">
                      GP-based reward · calculated per member
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-gold/15 bg-gold/[.035] px-3.5 py-3">
                  <div className="text-[13px] text-text-dim">
                    Selected session: <strong className="text-gold-light">{missingLog.sessionDisplayName || missingLog.sessionLabel || missingLog.event}</strong>
                  </div>
                  <div className="mt-1 text-[13px] text-text-dim">
                    Existing attendees: <strong className="font-sans text-text-bright">{baseRecordedCount}/50</strong>
                    <span className="mx-1.5 text-white/20">·</span>
                    Adding: <strong className="font-sans text-gold-light">{missingSelectedCount}</strong>
                  </div>
                  {missingSelectedCount > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/[.06] text-[12px] font-sans text-text-dim">
                      {members.filter(m => missingMembers[m.id] && !alreadyRecorded.has(String(m.name).trim().toLowerCase())).map(m => (
                        <span key={m.id} className="mr-3 inline-block">
                          {m.name}: {formatGp(m.power)} GP → +{getAttendanceReward(m.power, missingLog.event)} coins
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative mt-4">
                  <input
                    className="input w-full h-10 pl-9"
                    placeholder="Search missing member..."
                    value={missingSearch}
                    onChange={e => setMissingSearch(e.target.value)}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim text-xs">⌕</span>
                </div>

                <div className="mt-3 rounded-xl border border-white/[.07] overflow-hidden">
                  <div className="flex items-center justify-between gap-2 border-b border-white/[.06] bg-black/20 px-3 py-2">
                    <span className="text-[12px] font-bold uppercase tracking-[.14em] text-text-dim">Members not yet recorded</span>
                    <span className="text-[12px] font-sans text-text-dim">{availableMissing.length} available</span>
                  </div>

                  <div className="max-h-[330px] overflow-y-auto divide-y divide-white/[.045]">
                    {availableMissing.map(m => {
                      const checked = !!missingMembers[m.id]
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMissingMember(m.id)}
                          aria-pressed={checked}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${checked ? 'bg-gold/[.055]' : 'hover:bg-white/[.025]'}`}
                        >
                          <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border text-[14px] ${checked ? 'border-gold bg-gold text-black' : 'border-white/15 bg-black/20 text-transparent'}`}>
                            ✓
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-xs font-semibold ${checked ? 'text-gold-light' : 'text-text-bright'}`}>{m.name}</span>
                            <span className="block mt-0.5 truncate text-[12px] text-text-dim">{m.cls || 'Member'}</span>
                          </span>
                          <span className="text-[12px] font-sans text-text-dim">{m.attendance || 0} total</span>
                        </button>
                      )
                    })}

                    {availableMissing.length === 0 && (
                      <div className="px-4 py-10 text-center text-xs text-text-dim">
                        {baseRecordedCount >= 50 ? 'This record already has 50 attendees.' : 'No missing members found.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/[.06] bg-black/10 px-4 sm:px-5 py-3.5">
                <div className="text-[13px] text-text-dim">
                  {missingSelectedCount > 0
                    ? `${missingSelectedCount} member${missingSelectedCount === 1 ? '' : 's'} selected · reward calculated from each member's GP automatically`
                    : 'Select the missing member(s) first.'}
                </div>
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddMissing(false)}
                    disabled={addingMissing}
                    className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-xs text-text-dim hover:text-text-bright disabled:opacity-40 sm:flex-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addMissingRecord}
                    disabled={addingMissing || missingSelectedCount === 0 || baseRecordedCount >= 50}
                    className="btn-gold min-h-9 flex-1 px-4 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed sm:flex-none"
                  >
                    {addingMissing ? 'Adding…' : `Add ${missingSelectedCount || ''} Missing Member${missingSelectedCount === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Attendee details — compact professional modal */}
      {detailLog && (() => {
        const attendees = detailLog.attendees || []
        const logTs = detailLog.ts || Number(detailLog.id) || new Date(detailLog.date).getTime() || 0
        const totalAwarded = attendees.reduce((sum, a) => sum + (Number(a.earned) || 0), 0)
        const normalizedAttendeeSearch = attendeeSearch.trim().toLowerCase()
        const filteredAttendees = normalizedAttendeeSearch
          ? attendees.filter(a =>
              String(a.name || '').toLowerCase().includes(normalizedAttendeeSearch) ||
              String(a.cls || '').toLowerCase().includes(normalizedAttendeeSearch)
            )
          : attendees

        return (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-[3px]"
            role="dialog"
            aria-modal="true"
            aria-label={`${detailLog.event} attendance`}
            onMouseDown={e => {
              if (e.target === e.currentTarget) setDetailLog(null)
            }}
          >
            <div className="w-full max-w-3xl max-h-[84vh] overflow-hidden rounded-2xl border border-gold/20 bg-[#0d0c0b] shadow-2xl">
              {/* Compact header */}
              <div className="flex items-center justify-between gap-3 border-b border-white/[.07] px-4 sm:px-5 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm sm:text-base font-bold text-text-bright">{getLogSession(detailLog)?.displayName || detailLog.sessionDisplayName || detailLog.event}</h3>
                    <span className="rounded-md border border-white/[.08] bg-white/[.025] px-1.5 py-0.5 text-[12px] font-sans text-text-dim">
                      {attendees.length}/50
                    </span>
                    <span className="rounded-md border border-green-500/15 bg-green-500/[.035] px-1.5 py-0.5 text-[12px] font-semibold text-green-400">
                      {getRunLabel(getLogSession(detailLog))} · GP rewards
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-text-dim">
                    <span className="font-sans tabular-nums">{formatGMT8Short(logTs)} · {SERVER_TZ_LABEL}</span>
                    <span className="text-white/15">•</span>
                    <span>by <strong className="text-gold-light">{detailLog.recorded_by || detailLog.recordedBy || 'System'}</strong></span>
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
