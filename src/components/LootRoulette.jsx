import React, { useEffect, useMemo, useRef, useState } from 'react'

const STAFF_ROLES = ['Admin', 'Master', 'Elder']

// Scoped styles for this page (glass look shared with the other portal pages)
const LR_STYLES = `
  .lr-root { font-variant-numeric: tabular-nums; }
  .lr-root .lr-glass {
    position: relative;
    background:
      radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,.07) 0%, transparent 50%),
      linear-gradient(160deg, rgba(34,28,22,.58) 0%, rgba(12,10,8,.66) 100%);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border: 1px solid rgba(255,255,255,.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 22px 60px -30px rgba(0,0,0,.85);
  }
  /* Same look without live blur, for repeated cards and modals */
  .lr-root .lr-solid, .lr-modal .lr-solid {
    background:
      radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,.05) 0%, transparent 50%),
      linear-gradient(160deg, rgba(30,25,20,.96) 0%, rgba(13,11,9,.98) 100%);
    border: 1px solid rgba(255,255,255,.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 22px 60px -30px rgba(0,0,0,.9);
  }
  /* Dropdown list: fully solid so nothing shows through it */
  .lr-root .lr-menu {
    background: #15110d;
    border: 1px solid rgba(212,175,55,.22);
    box-shadow: 0 24px 60px -12px rgba(0,0,0,.95), 0 0 0 1px rgba(0,0,0,.4);
  }
  .lr-root .lr-inset, .lr-modal .lr-inset {
    background: rgba(0,0,0,.24);
    border: 1px solid rgba(255,255,255,.07);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
  }
  .lr-root .lr-btn, .lr-modal .lr-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 40px; padding: 0 14px; border-radius: 12px;
    border: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.03);
    font-size: 12px; font-weight: 700; color: rgb(var(--lr-dim, 167 156 138));
    transition: border-color .2s ease, color .2s ease, background .2s ease;
  }
  .lr-root .lr-btn:hover:not(:disabled), .lr-modal .lr-btn:hover:not(:disabled) {
    border-color: rgba(212,175,55,.3); color: #f4ebd9; background: rgba(212,175,55,.05);
  }
  .lr-root .lr-btn:disabled, .lr-modal .lr-btn:disabled { opacity: .4; cursor: not-allowed; }
  .lr-root .lr-btn-danger, .lr-modal .lr-btn-danger { color: #fca5a5; border-color: rgba(248,113,113,.22); background: rgba(248,113,113,.05); }
  .lr-root .lr-btn-danger:hover:not(:disabled), .lr-modal .lr-btn-danger:hover:not(:disabled) { border-color: rgba(248,113,113,.4); color: #fecaca; background: rgba(248,113,113,.09); }

  /* Segmented control (Single event / Weekly) */
  .lr-root .lr-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 4px; padding: 4px; border-radius: 14px; background: rgba(0,0,0,.3); border: 1px solid rgba(255,255,255,.07); }
  .lr-root .lr-seg button { min-height: 40px; border-radius: 10px; font-size: 13px; font-weight: 700; color: #a79c8a; transition: background .2s ease, color .2s ease, box-shadow .2s ease; }
  .lr-root .lr-seg button:hover { color: #f4ebd9; }
  .lr-root .lr-seg button[aria-pressed="true"] {
    color: #1a1206;
    background: linear-gradient(180deg, #f2d27a 0%, #d4af37 55%, #b38d2a 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 6px 18px -8px rgba(212,175,55,.6);
  }

  /* Week chips */
  .lr-root .lr-week { flex: 0 0 auto; min-width: 150px; text-align: left; padding: 10px 12px; border-radius: 14px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.025); transition: border-color .2s ease, background .2s ease; }
  .lr-root .lr-week:hover { border-color: rgba(212,175,55,.28); }
  .lr-root .lr-week[aria-pressed="true"] { border-color: rgba(212,175,55,.5); background: rgba(212,175,55,.08); box-shadow: 0 0 0 1px rgba(212,175,55,.15), 0 10px 26px -16px rgba(212,175,55,.6); }

  /* Run rows with tick boxes */
  .lr-root .lr-run { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,.06); background: rgba(255,255,255,.018); transition: border-color .2s ease, background .2s ease, opacity .2s ease; }
  .lr-root .lr-run:hover:not(:disabled) { border-color: rgba(212,175,55,.22); }
  .lr-root .lr-run[aria-checked="true"] { border-color: rgba(212,175,55,.24); background: rgba(212,175,55,.045); }
  .lr-root .lr-run:disabled { opacity: .5; cursor: not-allowed; }
  .lr-root .lr-run.lr-run-sm { gap: 10px; padding: 8px 10px; }
  .lr-root .lr-tick { display: flex; height: 20px; width: 20px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 6px; border: 1.5px solid rgba(255,255,255,.22); font-size: 12px; font-weight: 900; color: transparent; transition: all .15s ease; }
  .lr-root .lr-run[aria-checked="true"] .lr-tick { border-color: #d4af37; background: #d4af37; color: #1a1206; }

  .lr-root .lr-field, .lr-modal .lr-field {
    width: 100%; border-radius: 14px; border: 1px solid rgba(255,255,255,.09); background: rgba(0,0,0,.3);
    color: #f4ebd9; outline: none; transition: border-color .2s ease, box-shadow .2s ease;
  }
  .lr-root .lr-field::placeholder, .lr-modal .lr-field::placeholder { color: rgba(167,156,138,.55); }
  .lr-root .lr-field:focus, .lr-modal .lr-field:focus { border-color: rgba(212,175,55,.45); box-shadow: 0 0 0 3px rgba(212,175,55,.1); }

  /* Items vs players balance bar */
  .lr-root .lr-bar { height: 8px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.06); }
  .lr-root .lr-bar > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #b38d2a, #f2d27a); transition: width .35s cubic-bezier(.2,.8,.2,1); }

  /* Roll modal */
  .lr-modal { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 12px; background: rgba(4,3,2,.78); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
  @media (min-width: 640px) { .lr-modal { padding: 20px; } }
  .lr-modal .lr-stage {
    position: relative; overflow: hidden; border-radius: 24px; border: 1px solid rgba(212,175,55,.18);
    background: radial-gradient(circle at 50% 0%, rgba(212,175,55,.14), transparent 60%), rgba(0,0,0,.32);
  }
  .lr-modal .lr-rays {
    position: absolute; left: 50%; top: 50%; width: 900px; height: 900px; margin: -450px 0 0 -450px; pointer-events: none;
    background: repeating-conic-gradient(from 0deg, transparent 0deg 9deg, rgba(212,175,55,.07) 12deg, transparent 15deg 24deg);
    -webkit-mask: radial-gradient(circle, #000 8%, transparent 55%); mask: radial-gradient(circle, #000 8%, transparent 55%);
    animation: lr-spin 50s linear infinite; will-change: transform;
  }
  .lr-modal .lr-name { transition: transform .25s cubic-bezier(.2,.8,.2,1), text-shadow .25s ease, color .25s ease; }
  .lr-modal .lr-name[data-locked="true"] { color: #f2cc60; transform: scale(1.06); text-shadow: 0 0 28px rgba(242,204,96,.45); }
  .lr-modal .lr-name[data-locked="false"] { color: rgba(244,235,217,.78); }
  .lr-modal .lr-progress { height: 4px; border-radius: 999px; background: rgba(255,255,255,.07); overflow: hidden; }
  .lr-modal .lr-progress > span { display: block; height: 100%; background: linear-gradient(90deg, #b38d2a, #f2d27a); transition: width .4s ease; }
  .lr-modal .lr-pop { animation: lr-pop .45s cubic-bezier(.2,.9,.3,1.3) both; }
  @keyframes lr-spin { to { rotate: 360deg; } }
  @keyframes lr-pop { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: none; } }

  /* Winner animation: a slow gold shimmer across the name, soft glow on the tile */
  .lr-root .lr-win-tile, .lr-modal .lr-win-tile {
    border-color: rgba(212,175,55,.38);
    background: linear-gradient(135deg, rgba(212,175,55,.12), rgba(212,175,55,.035));
    animation: lr-win-glow 3.2s ease-in-out infinite;
  }
  .lr-root .lr-win-name, .lr-modal .lr-win-name {
    font-weight: 800;
    background: linear-gradient(100deg, #e9c561 0%, #e9c561 38%, #fff6d8 50%, #e9c561 62%, #e9c561 100%);
    background-size: 250% 100%;
    -webkit-background-clip: text; background-clip: text;
    color: transparent;
    animation: lr-shimmer 3.2s linear infinite;
  }
  .lr-root .lr-win-item, .lr-modal .lr-win-item { color: #f2cc60; text-shadow: 0 0 12px rgba(242,204,96,.35); }
  @keyframes lr-shimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
  @keyframes lr-win-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(212,175,55,0), inset 0 1px 0 rgba(255,255,255,.06); }
    50%      { box-shadow: 0 0 18px -4px rgba(212,175,55,.45), inset 0 1px 0 rgba(255,255,255,.08); }
  }

  /* History status accent */
  .lr-root .lr-hist { position: relative; overflow: hidden; }
  .lr-root .lr-hist::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--lr-accent, rgba(255,255,255,.12)); }

  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .lr-root .lr-glass { background: rgba(16,13,11,.96); }
  }
  @media (prefers-reduced-motion: reduce) {
    .lr-modal .lr-rays, .lr-modal .lr-pop { animation: none; }
  }
`

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

// Attendance dates are plain calendar dates (e.g. "9/29/2026"), so format them without timezone shifting.
function formatCalendarDate(value) {
  const text = String(value || '').trim()
  if (!text) return 'Unknown date'
  let y, m, d
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    [, y, m, d] = match
  } else if ((match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    [, m, d, y] = match
    if (Number(m) > 12) [m, d] = [d, m]
  }
  if (!y) return formatDate(value)
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }).format(date)
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
    _date: log?.date ? formatCalendarDate(log.date) : (log?.ts ? formatDate(log.ts) : 'Unknown date'),
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
  if (run === 'Weekly') return 'border-amber-300/30 bg-amber-300/[.08] text-amber-200'
  if (run === 'First Run') return 'border-sky-400/25 bg-sky-400/[.06] text-sky-300'
  if (run === 'Second Run') return 'border-violet-400/25 bg-violet-400/[.06] text-violet-300'
  return 'border-white/10 bg-white/[.03] text-text-dim'
}

/* ── Weekly roulette (Tuesday → Saturday, server calendar) ───────────── */

const WEEK_DAY_MS = 24 * 60 * 60 * 1000

// Calendar day of an Attendance log as a UTC-midnight Date (no timezone shifting)
function getLogCalendarDay(log) {
  const text = String(log?.date || '').trim()
  let y, m, d
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    [, y, m, d] = match
  } else if ((match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    [, m, d, y] = match
    if (Number(m) > 12) [m, d] = [d, m]
  }
  if (!y && log?.ts) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: SERVER_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Number(log.ts)))
    ;[y, m, d] = parts.split('-')
  }
  if (!y) return null
  const day = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  return Number.isNaN(day.getTime()) ? null : day
}

function isoDay(date) {
  return date.toISOString().slice(0, 10)
}

// Tuesday that starts this day's week. Events run Tue–Sat, but Sunday/Monday
// entries (an Elder logging a run late) still belong to the same week.
function getWeekStart(day) {
  if (!day) return null
  const weekday = day.getUTCDay() // 0 Sun … 6 Sat
  const sinceTuesday = (weekday - 2 + 7) % 7
  return new Date(day.getTime() - sinceTuesday * WEEK_DAY_MS)
}

function isLateEntryDay(log) {
  const day = getLogCalendarDay(log)
  return Boolean(day) && day.getUTCDay() < 2 // Sunday or Monday
}

function formatWeekRange(startIso) {
  const start = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(start.getTime() + 4 * WEEK_DAY_MS)
  const f = opts => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts })
  const sameMonth = start.getUTCMonth() === end.getUTCMonth()
  return sameMonth
    ? `${f({ day: 'numeric' }).format(start)}–${f({ day: 'numeric', month: 'short', year: 'numeric' }).format(end)}`
    : `${f({ day: 'numeric', month: 'short' }).format(start)} – ${f({ day: 'numeric', month: 'short', year: 'numeric' }).format(end)}`
}

function isWeeklyRoulette(r) {
  return r?.roulette_type === 'weekly' || (Array.isArray(r?.attendance_log_ids) && r.attendance_log_ids.length > 1)
}

function displayRunLabel(r) {
  return isWeeklyRoulette(r) ? 'Weekly' : getRunLabel(r?.session_display_name)
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
        className="lr-field flex min-h-[52px] items-center justify-between gap-3 px-3.5 py-2.5 text-left"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {selected ? (
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-bold text-text-bright">{selected.event}</span>
            <span className="mt-0.5 block truncate text-[12px] text-text-dim">{selected._sessionName} · {selected._date}</span>
          </span>
        ) : (
          <span className="text-[14px] text-text-dim">Select an attendance run…</span>
        )}
        <span className={`shrink-0 text-text-dim transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="lr-menu absolute left-0 right-0 z-50 mt-2 max-h-80 overflow-auto rounded-2xl p-1.5" role="listbox">
          {options.map(log => {
            const used = activeAttendanceIds.has(String(log.id))
            const isSelected = String(log.id) === String(value)
            return (
              <button
                key={log.id}
                type="button"
                disabled={used}
                onClick={() => { onChange(String(log.id)); setOpen(false) }}
                className={`mb-1 w-full rounded-xl border px-3 py-2.5 text-left transition last:mb-0 ${
                  used
                    ? 'cursor-not-allowed border-transparent opacity-45'
                    : isSelected
                      ? 'border-gold/30 bg-gold/[.08]'
                      : 'border-transparent hover:border-white/[.08] hover:bg-white/[.04]'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-text-bright">{log.event}</div>
                    <div className="mt-0.5 truncate text-[11px] text-text-dim">{log._sessionName} · {log._date}</div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${used ? 'border-emerald-400/20 bg-emerald-400/[.05] text-emerald-300' : 'border-gold/20 bg-gold/[.05] text-gold-light'}`}>
                    {used ? 'Has roulette' : `${log._participants.length} players`}
                  </span>
                </div>
              </button>
            )
          })}
          {!options.length && <div className="px-3 py-5 text-center text-[13px] text-text-dim">No Attendance runs with players yet.</div>}
        </div>
      )}
    </div>
  )
}

function formatRunDay(log) {
  const day = getLogCalendarDay(log)
  if (!day) return log?._date || ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(day)
}

// Compact tick tile for one Attendance run (weekly mode)
function RunTile({ log, checked, disabled = false, onToggle, tag = null }) {
  const run = getRunLabel(log._sessionName)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      title={`${log.event} · ${log._sessionName} · ${log._date}`}
      className="lr-run lr-run-sm"
    >
      <span className="lr-tick" aria-hidden="true">✓</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold leading-5 text-text-bright">{log.event}</span>
        <span className="flex items-center gap-1 truncate text-[11px] leading-4 text-text-dim">
          <span>{formatRunDay(log)}</span>
          {run !== 'Single Run' && <span>· {run}</span>}
          {tag === 'late' && <span className="font-bold text-sky-300">· late entry</span>}
          {tag === 'added' && <span className="font-bold text-gold-light">· added</span>}
          {tag === 'used' && <span className="font-bold text-emerald-300">· in another weekly</span>}
        </span>
      </span>
      <span className="shrink-0 text-right text-[12px] font-bold leading-4 text-text-bright">
        {log._participants.length}
        <span className="block text-[9px] font-semibold uppercase tracking-wide text-text-dim">players</span>
      </span>
    </button>
  )
}

/* ── Attendance & chance (shown to every member) ────────────────────────
   Each run attended counts once. A player's chance = their attendance divided
   by everyone's attendance, so all chances add up to 100%. Max 1 item each. */

function getTotalRuns(r) {
  return Array.isArray(r?.attendance_log_ids) && r.attendance_log_ids.length ? r.attendance_log_ids.length : 1
}

function ticketsOf(p) {
  return Math.max(1, Number(p?.entries) || 1)
}

function formatShare(fraction) {
  const pct = fraction * 100
  if (pct >= 99.95) return '100%'
  if (pct > 0 && pct < 0.1) return '<0.1%'
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`
}

function AttendancePips({ attended, total }) {
  if (total <= 1) return null
  if (total > 10) return <span className="text-[11px] font-bold text-text-dim">{attended}/{total}</span>
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < attended ? 'bg-gold-light' : 'bg-white/[.14]'}`} />
      ))}
    </span>
  )
}

// All players in a simple grid: name, attendance + chance, and the result.
// Chance comes from attendance: more runs attended = higher chance (all add up to 100%).
function PlayerChances({ roulette, participants, results = [], currentUserId, showYou = true }) {
  const totalRuns = getTotalRuns(roulette)
  const totalAttendance = participants.reduce((sum, p) => sum + ticketsOf(p), 0) || 1
  const resultByMember = new Map(results.map(r => [String(r.winner_member_id), r]))
  const rolled = results.length > 0
  const isLoot = r => r && String(r.item_name || '').toLowerCase() !== 'nothing'
  const weekly = totalRuns > 1

  const rows = participants
    .map(p => ({ p, runs: ticketsOf(p), chance: ticketsOf(p) / totalAttendance, result: resultByMember.get(String(p.member_id)) }))
    .sort((x, y) => y.runs - x.runs || String(x.p.player_name).localeCompare(String(y.p.player_name)))
  const lootCount = rows.filter(r => isLoot(r.result)).length
  const nothingCount = rows.filter(r => r.result && !isLoot(r.result)).length
  const me = currentUserId == null ? null : rows.find(r => String(r.p.member_id) === String(currentUserId))

  if (!participants.length) return null
  return (
    <div className="space-y-3">
      {me && showYou && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-gold/25 bg-gold/[.06] px-4 py-3 text-[14px]">
          <span className="font-bold text-text-bright">You</span>
          {weekly && <span className="text-text">attended <span className="font-bold text-text-bright">{me.runs}/{totalRuns}</span> runs</span>}
          <span className="text-text-dim">→</span>
          <span className="text-[20px] font-bold text-gold-light">{formatShare(me.chance)}</span>
          <span className="text-text-dim">chance</span>
          {rolled && <span className={`ml-auto font-bold ${isLoot(me.result) ? 'text-gold-light' : 'text-text-dim'}`}>{isLoot(me.result) ? `🎁 You won ${me.result.item_name}` : 'Nothing this time'}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[.16em] text-gold-dim">All players</div>
          <div className="mt-0.5 text-[12px] text-text-dim">
            {weekly ? 'The more runs you attend, the higher your chance. Max 1 item each.' : 'Everyone has the same chance. Max 1 item each.'}
          </div>
        </div>
        {rolled && (
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className="rounded-full border border-gold/25 bg-gold/[.06] px-2.5 py-1 text-gold-light">{lootCount} loot</span>
            <span className="rounded-full border border-white/[.08] bg-white/[.03] px-2.5 py-1 text-text-dim">{nothingCount} Nothing</span>
          </div>
        )}
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map(row => {
          const won = isLoot(row.result)
          const mine = me && row === me
          return (
            <div
              key={row.p.member_id}
              className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 ${won ? 'lr-win-tile' : mine ? 'border-gold/25 bg-white/[.03]' : 'border-white/[.06] bg-white/[.02]'}`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className={`truncate text-[14px] font-semibold ${won ? 'lr-win-name' : mine ? 'text-gold-light' : 'text-text-bright'}`}>{row.p.player_name}</span>
                  {mine && <span className="shrink-0 rounded-full bg-gold/[.15] px-1.5 text-[9px] font-bold text-gold-light">YOU</span>}
                </span>
                <span className="mt-0.5 block text-[11px] text-text-dim">
                  {rolled
                    ? `${weekly ? `${row.runs}/${totalRuns} runs · ` : ''}${formatShare(row.chance)} chance`
                    : (weekly ? `${row.runs}/${totalRuns} runs` : '1 run')}
                </span>
              </span>
              {rolled ? (
                <span className={`max-w-[55%] shrink-0 truncate text-right text-[12px] font-bold ${won ? 'lr-win-item' : 'text-text-dim/80'}`}>
                  {won ? `🎁 ${row.result.item_name}` : row.result ? 'Nothing' : '—'}
                </span>
              ) : (
                <span className="shrink-0 text-[15px] font-bold text-gold-light">{formatShare(row.chance)}</span>
              )}
            </div>
          )
        })}
      </div>
      <div className="text-right text-[11px] text-text-dim">{participants.length} players · chances add up to 100%</div>
    </div>
  )
}

function StatTile({ label, value, tone = 'plain' }) {
  return (
    <div className={`rounded-2xl px-3.5 py-3 ${tone === 'gold' ? 'border border-gold/20 bg-gold/[.05]' : 'lr-inset'}`}>
      <div className={`text-[10px] font-bold uppercase tracking-[.14em] ${tone === 'gold' ? 'text-gold-dim' : 'text-text-dim'}`}>{label}</div>
      <div className={`mt-1 text-[22px] font-bold leading-none ${tone === 'gold' ? 'text-gold-light' : 'text-text-bright'}`}>{value}</div>
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
  const [activeAttendanceIds, setActiveAttendanceIds] = useState(() => new Set()) // runs used by a single-event roulette
  const [activeWeeklyIds, setActiveWeeklyIds] = useState(() => new Set())         // runs used by a weekly roulette
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
  const [createMode, setCreateMode] = useState('single') // 'single' | 'weekly'
  const [selectedWeekKey, setSelectedWeekKey] = useState('')
  const [excludedWeekLogIds, setExcludedWeekLogIds] = useState(() => new Set())
  const [extraWeekLogIds, setExtraWeekLogIds] = useState(() => new Set())
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

  // Attendance runs grouped into Tuesday–Saturday weeks (newest first)
  const weekGroups = useMemo(() => {
    const map = new Map()
    attendanceOptions.forEach(log => {
      const start = getWeekStart(getLogCalendarDay(log))
      if (!start) return
      const key = isoDay(start)
      if (!map.has(key)) map.set(key, { key, label: formatWeekRange(key), logs: [] })
      map.get(key).logs.push(log)
    })
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, [attendanceOptions])

  const selectedWeek = weekGroups.find(w => w.key === selectedWeekKey) || null
  const weekRuns = useMemo(() => (selectedWeek?.logs || []).map(log => ({
    log,
    used: activeWeeklyIds.has(String(log.id)),
    included: !activeWeeklyIds.has(String(log.id)) && !excludedWeekLogIds.has(String(log.id)),
  })), [selectedWeek, activeWeeklyIds, excludedWeekLogIds])
  // Runs from other weeks that staff added by hand (e.g. logged very late)
  const otherRuns = useMemo(() => {
    const inWeek = new Set((selectedWeek?.logs || []).map(log => String(log.id)))
    return attendanceOptions
      .filter(log => !inWeek.has(String(log.id)) && !activeWeeklyIds.has(String(log.id)))
      .slice(0, 40)
  }, [attendanceOptions, selectedWeek, activeWeeklyIds])
  const extraLogs = otherRuns.filter(log => extraWeekLogIds.has(String(log.id)))
  const weekIncludedLogs = [...weekRuns.filter(r => r.included).map(r => r.log), ...extraLogs]
  // One entry per player, however many runs they attended
  const weekPlayers = useMemo(() => {
    const map = new Map()
    weekIncludedLogs.forEach(log => log._participants.forEach(p => {
      const key = String(p.memberId)
      if (!map.has(key)) map.set(key, { memberId: p.memberId, name: p.name, runs: 0 })
      map.get(key).runs += 1
    }))
    return [...map.values()].sort((a, b) => b.runs - a.runs || String(a.name).localeCompare(String(b.name)))
  }, [weekIncludedLogs.map(l => l.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!weekGroups.length) return
    if (selectedWeekKey && weekGroups.some(w => w.key === selectedWeekKey)) return
    setSelectedWeekKey(weekGroups[0].key)
  }, [weekGroups, selectedWeekKey])

  const toggleExtraRun = id => setExtraWeekLogIds(prev => {
    const next = new Set(prev)
    const key = String(id)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const toggleWeekRun = id => setExcludedWeekLogIds(prev => {
    const next = new Set(prev)
    const key = String(id)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
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
        supabase.from('loot_roulettes').select('attendance_log_id, attendance_log_ids, roulette_type').neq('status', 'void')
          .then(res => res.error ? supabase.from('loot_roulettes').select('attendance_log_id').neq('status', 'void') : res),
      ])
      if (error) throw error
      if (activeError) console.error('Failed to load active attendance usage:', activeError)

      // Single-event and weekly roulettes lock runs separately:
      // a run can have one single roulette AND be part of one weekly roulette.
      const rowsList = activeRows || []
      const isWeeklyRow = row => row.roulette_type === 'weekly' || (Array.isArray(row.attendance_log_ids) && row.attendance_log_ids.length > 1)
      setActiveAttendanceIds(new Set(rowsList.filter(row => !isWeeklyRow(row)).map(row => String(row.attendance_log_id))))
      setActiveWeeklyIds(new Set(rowsList.filter(isWeeklyRow).flatMap(row => (row.attendance_log_ids || [row.attendance_log_id]).map(String))))

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
    .map(item => parseLootInput(item.name))
    .filter(item => item.name)

  const requestCreateRoulette = () => {
    if (!isStaff) return
    if (createMode === 'weekly') {
      if (!selectedWeek || !weekIncludedLogs.length) {
        addToast('Pick a week and at least one Attendance run.', 'red', 'Runs Required')
        return
      }
      if (!getCreatePayload().length) {
        addToast('Add at least one loot item, for example “Dragon Scale”.', 'red', 'Loot Required')
        return
      }
      setConfirmCreate(true)
      return
    }
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

  const createWeeklyRoulette = async () => {
    const payload = getCreatePayload()
    if (!selectedWeek || !weekIncludedLogs.length || !payload.length) return
    setConfirmCreate(false)
    setCreating(true)
    try {
      const actorId = Number(currentUser?.id) || null
      const actorPassword = currentUser?.password || ''
      const weekEnd = isoDay(new Date(new Date(`${selectedWeek.key}T00:00:00Z`).getTime() + 4 * WEEK_DAY_MS))
      const { data, error } = await supabase.rpc('create_weekly_loot_roulette', {
        p_attendance_log_ids: weekIncludedLogs.map(log => Number(log.id)),
        p_items: payload,
        p_actor_id: actorId,
        p_actor_password: actorPassword,
        p_week_start: selectedWeek.key,
        p_week_end: weekEnd,
      })
      if (error) throw error

      resetCreateForm()
      setExcludedWeekLogIds(new Set())
      setExtraWeekLogIds(new Set())
      setCreateOpen(false)
      await openRoulette(data.id)
      setRollPanelOpen(true)
      await loadHistory()
      addToast(`Weekly Loot Roulette created with ${weekPlayers.length} players from ${weekIncludedLogs.length} runs.`, 'gold', 'Roulette Ready')
    } catch (error) {
      console.error('Create weekly loot roulette failed:', error)
      addToast(error?.message || 'Could not create the weekly Loot Roulette.', 'red', 'Create Failed')
    } finally {
      setCreating(false)
    }
  }

  const createRoulette = async () => {
    if (createMode === 'weekly') return createWeeklyRoulette()
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
    if (isWeeklyRoulette(roulette)) {
      const start = getWeekStart(getLogCalendarDay({ date: roulette.event_date }))
      setCreateMode('weekly')
      if (start) setSelectedWeekKey(isoDay(start))
      setExcludedWeekLogIds(new Set())
      setExtraWeekLogIds(new Set())
    } else {
      setCreateMode('single')
    }
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
  const createUnitCount = createPayload.reduce((sum, item) => sum + item.quantity, 0)
  const createPlayerCount = createMode === 'weekly' ? weekPlayers.length : (selectedSummary?.participants || 0)
  const createBlockedReason = createMode === 'weekly'
    ? (!selectedWeek
        ? 'Pick a week.'
        : !weekIncludedLogs.length
          ? 'Tick at least one Attendance run.'
          : !createUnitCount
            ? 'Add at least one loot item to continue.'
            : '')
    : !selectedAttendance
    ? 'Select an attendance event.'
    : selectedSummary?.used
      ? 'This event already has a roulette. Void it first to create a replacement.'
      : !createPlayerCount
        ? 'This event has no players.'
        : !createUnitCount
          ? 'Add at least one loot item to continue.'
          : ''
  const createBalanceText = createUnitCount < createPlayerCount
    ? `${createPlayerCount - createUnitCount} ${createPlayerCount - createUnitCount === 1 ? 'player' : 'players'} will get Nothing`
    : createUnitCount > createPlayerCount
      ? `${createUnitCount - createPlayerCount} ${createUnitCount - createPlayerCount === 1 ? 'item' : 'items'} will stay undistributed`
      : 'Every player gets exactly one item'
  const hasExportableResults = history.some(r => (r.results || []).length > 0)
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


  const statusLabel = roulette?.status === 'completed' ? 'Completed' : roulette?.status === 'void' ? 'Void' : 'Ready'

  // ── Display-only helpers ──────────────────────────────────────────────
  const statusPill = status => status === 'completed'
    ? 'border-emerald-400/25 bg-emerald-400/[.06] text-emerald-300'
    : status === 'void'
      ? 'border-red-400/25 bg-red-400/[.06] text-red-300'
      : 'border-gold/25 bg-gold/[.06] text-gold-light'
  const statusAccent = status => status === 'completed' ? 'rgba(52,211,153,.55)' : status === 'void' ? 'rgba(248,113,113,.5)' : 'rgba(212,175,55,.6)'
  const rouletteDateText = r => isWeeklyRoulette(r) && /^\d{4}-\d{2}-\d{2}$/.test(String(r?.event_date || '')) ? formatWeekRange(r.event_date) : formatDate(r?.event_date)

  // Newest roulette still waiting to be rolled (shown to everyone)
  const upcomingRoulette = useMemo(() => history.find(r => r.status === 'ready' && (r.participants || []).length) || null, [history])

  // Your newest win (history is newest first) and your chance in the waiting draw
  const myLastWin = useMemo(() => {
    if (currentUser?.id == null) return ''
    for (const r of history) {
      if (r.status === 'void') continue
      const row = (r.results || []).find(x => String(x.winner_member_id) === String(currentUser.id) && String(x.item_name || '').toLowerCase() !== 'nothing')
      if (row) return row.item_name
    }
    return ''
  }, [history, currentUser?.id])
  const myUpcoming = useMemo(() => {
    if (!upcomingRoulette || currentUser?.id == null) return null
    const list = upcomingRoulette.participants || []
    const me = list.find(p => String(p.member_id) === String(currentUser.id))
    if (!me) return null
    const total = list.reduce((sum, p) => sum + ticketsOf(p), 0) || 1
    return { runs: ticketsOf(me), totalRuns: getTotalRuns(upcomingRoulette), chance: ticketsOf(me) / total }
  }, [upcomingRoulette, currentUser?.id])

  const pageStats = useMemo(() => {
    const live = history.filter(r => r.status !== 'void')
    const lootRows = live.flatMap(r => (r.results || []).filter(row => String(row.item_name || '').toLowerCase() !== 'nothing'))
    const me = currentUser?.id == null ? null : String(currentUser.id)
    return {
      roulettes: live.length,
      loot: lootRows.length,
      winners: new Set(lootRows.map(row => String(row.winner_member_id))).size,
      mine: me ? lootRows.filter(row => String(row.winner_member_id) === me).length : 0,
      ready: live.filter(r => r.status === 'ready').length,
    }
  }, [history, currentUser?.id])

  const weekTickets = weekPlayers.reduce((sum, p) => sum + p.runs, 0)
  const totalTickets = participants.reduce((sum, p) => sum + ticketsOf(p), 0)
  const hasTickets = participants.some(p => ticketsOf(p) > 1)
  const balancePct = createPlayerCount ? Math.min(100, Math.round((Math.min(createUnitCount, createPlayerCount) / createPlayerCount) * 100)) : 0
  const totalLootUnits = rouletteItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
  const revealLocked = Boolean(animationWinner && animationWinner._displayName && animationWinner._displayName === animationWinner.winner_name)
  const revealPct = animationTotal ? Math.round((animationIndex / animationTotal) * 100) : 0

  return (
    <div className="lr-root min-w-0 space-y-4">
      <style>{LR_STYLES}</style>

      {/* ── Header (compact) ───────────────────────────────────────── */}
      <header className="lr-glass rounded-[24px] px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-spectral text-[26px] font-bold leading-tight text-text-bright">Loot Roulette</h1>
            <p className="text-[13px] text-text-dim">Win loot from events you attend. <span className="text-gold-light">More runs = higher chance.</span></p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isStaff && !createOpen && (
              <button type="button" onClick={() => setCreateOpen(true)} className="btn-gold min-h-10 px-5 text-[13px] font-bold">+ New Roulette</button>
            )}
            <button type="button" onClick={() => loadHistory()} className="lr-btn" aria-label="Refresh">↻<span className="hidden sm:inline">Refresh</span></button>
            <button type="button" onClick={exportAllCsv} disabled={!hasExportableResults} className="lr-btn" aria-label="Export all">↓<span className="hidden sm:inline">Export</span></button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[.06] pt-3 text-[13px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[.08] px-3 py-1.5">
            <span aria-hidden="true">🎁</span>
            <span className="text-text-dim">Your wins</span>
            <span className="font-bold text-gold-light">{pageStats.mine}</span>
            {myLastWin && <span className="hidden text-text-dim sm:inline">· last: <span className="font-semibold text-text-bright">{myLastWin}</span></span>}
          </span>
          {myUpcoming && (
            <button
              type="button"
              onClick={() => document.getElementById('loot-upcoming')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[.1] bg-white/[.03] px-3 py-1.5 transition hover:border-gold/30"
            >
              <span className="text-text-dim">This week</span>
              {myUpcoming.totalRuns > 1 && <span className="font-semibold text-text-bright">{myUpcoming.runs}/{myUpcoming.totalRuns} runs</span>}
              <span className="text-text-dim">·</span>
              <span className="font-bold text-gold-light">{formatShare(myUpcoming.chance)} chance</span>
              <span className="text-text-dim" aria-hidden="true">→</span>
            </button>
          )}
          <span className="ml-auto text-[12px] text-text-dim">
            {pageStats.roulettes} {pageStats.roulettes === 1 ? 'roulette' : 'roulettes'} · {pageStats.loot} loot given · {pageStats.winners} players rewarded
          </span>
        </div>
      </header>

      {/* ── Upcoming draw (everyone can see their chance) ───────────── */}
      {upcomingRoulette && (
        <section id="loot-upcoming" className="lr-glass scroll-mt-24 rounded-[24px] p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-gold-dim">
                <span className="h-2 w-2 rounded-full bg-gold shadow-[0_0_8px_rgba(212,175,55,.8)]" aria-hidden="true" />
                Upcoming draw
              </div>
              <h2 className="mt-1 font-spectral text-[22px] font-bold text-text-bright sm:text-[24px]">{upcomingRoulette.event}</h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-text-dim">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${runBadgeClass(displayRunLabel(upcomingRoulette))}`}>{displayRunLabel(upcomingRoulette)}</span>
                <span>{rouletteDateText(upcomingRoulette)}</span>
                <span className="text-white/20">•</span>
                <span>{(upcomingRoulette.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} items</span>
                <span className="text-white/20">•</span>
                <span>{(upcomingRoulette.participants || []).length} players</span>
              </div>
            </div>
            <button type="button" onClick={async () => { await openRoulette(upcomingRoulette.id); setRollPanelOpen(true) }} className={isStaff ? 'btn-gold min-h-10 shrink-0 px-5 text-[13px] font-bold' : 'lr-btn shrink-0'}>
              {isStaff ? '🎲 Open roll' : 'View draw'}
            </button>
          </div>
          <PlayerChances roulette={upcomingRoulette} participants={upcomingRoulette.participants || []} results={upcomingRoulette.results || []} currentUserId={currentUser?.id} />
        </section>
      )}

      {/* ── Create ─────────────────────────────────────────────────── */}
      {isStaff && createOpen && (
        <section id="loot-roulette-create" className="lr-glass relative z-20 rounded-[24px] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-spectral text-[22px] font-bold text-text-bright sm:text-[24px]">New Loot Roulette</h2>
              <p className="mt-0.5 text-[13px] text-text-dim">Choose who can win, then list the loot.</p>
            </div>
            <button type="button" onClick={() => setCreateOpen(false)} className="lr-btn shrink-0" aria-label="Close new roulette form">✕ Close</button>
          </div>

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            {/* Step 1: who can win */}
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-text-bright">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/[.12] text-[12px] font-bold text-gold-light">1</span>
                Who can win
              </div>

              <div className="lr-seg" role="group" aria-label="Roulette type">
                <button type="button" aria-pressed={createMode === 'single'} onClick={() => setCreateMode('single')}>One event</button>
                <button type="button" aria-pressed={createMode === 'weekly'} onClick={() => setCreateMode('weekly')}>Whole week · Tue–Sat</button>
              </div>

              {createMode === 'single' ? (
                <div className="mt-3">
                  <AttendancePicker options={attendanceOptions} value={selectedAttendanceId} onChange={setSelectedAttendanceId} activeAttendanceIds={activeAttendanceIds} />
                  {selectedSummary && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-text-dim">
                      <span className="rounded-full border border-gold/20 bg-gold/[.05] px-2.5 py-1 font-bold text-gold-light">{selectedSummary.participants} players</span>
                      <span className={`rounded-full border px-2.5 py-1 font-bold ${runBadgeClass(selectedSummary.run)}`}>{selectedSummary.run}</span>
                      <span>{selectedSummary.date}</span>
                      {selectedSummary.used && <span className="rounded-full border border-amber-400/25 bg-amber-400/[.06] px-2.5 py-1 font-bold text-amber-300">Already has a roulette</span>}
                    </div>
                  )}
                  <p className="mt-2 text-[12px] leading-5 text-text-dim">Runs that already have a one-event roulette are locked. Runs in a weekly roulette can still get their own one-event roulette.</p>
                </div>
              ) : (
                <div className="mt-3">
                  {weekGroups.length === 0 ? (
                    <div className="lr-inset rounded-2xl px-4 py-6 text-center text-[13px] text-text-dim">No attendance runs yet.</div>
                  ) : (
                    <>
                      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Pick a week">
                        {weekGroups.slice(0, 10).map(week => {
                          const free = week.logs.filter(log => !activeWeeklyIds.has(String(log.id))).length
                          return (
                            <button
                              key={week.key}
                              type="button"
                              aria-pressed={week.key === selectedWeekKey}
                              onClick={() => { setSelectedWeekKey(week.key); setExcludedWeekLogIds(new Set()); setExtraWeekLogIds(new Set()) }}
                              className="lr-week"
                            >
                              <div className="text-[13px] font-bold text-text-bright">{week.label}</div>
                              <div className="mt-0.5 text-[11px] text-text-dim">
                                {week.logs.length} {week.logs.length === 1 ? 'run' : 'runs'}{free < week.logs.length ? ` · ${week.logs.length - free} used` : ''}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[12px] text-text-dim">
                          <span className="font-semibold text-text-bright">{weekRuns.filter(r => r.included).length + extraLogs.length}</span> of {weekRuns.filter(r => !r.used).length + extraLogs.length} runs ticked
                        </span>
                        <span className="flex gap-1">
                          <button type="button" onClick={() => setExcludedWeekLogIds(new Set())} className="rounded-lg px-2 py-1 text-[11px] font-bold text-gold-light hover:bg-gold/[.08]">All</button>
                          <button type="button" onClick={() => setExcludedWeekLogIds(new Set(weekRuns.map(r => String(r.log.id))))} className="rounded-lg px-2 py-1 text-[11px] font-bold text-text-dim hover:bg-white/[.06] hover:text-text-bright">None</button>
                        </span>
                      </div>

                      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                        {weekRuns.map(({ log, used, included }) => (
                          <RunTile key={log.id} log={log} checked={included} disabled={used} onToggle={() => toggleWeekRun(log.id)} tag={used ? 'used' : isLateEntryDay(log) ? 'late' : null} />
                        ))}
                        {extraLogs.map(log => (
                          <RunTile key={`extra-${log.id}`} log={log} checked onToggle={() => toggleExtraRun(log.id)} tag="added" />
                        ))}
                      </div>

                      {otherRuns.length > 0 && (
                        <details className="lr-inset mt-2 rounded-2xl">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[12px] font-semibold text-text-dim hover:text-text-bright">
                            <span>+ Add a run from another week <span className="font-normal">(logged late or off-schedule)</span></span>
                            <span aria-hidden="true">⌄</span>
                          </summary>
                          <div className="grid max-h-64 gap-1.5 overflow-y-auto border-t border-white/[.06] p-2 sm:grid-cols-2">
                            {otherRuns.filter(log => !extraWeekLogIds.has(String(log.id))).map(log => (
                              <RunTile key={`other-${log.id}`} log={log} checked={false} onToggle={() => toggleExtraRun(log.id)} />
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: loot */}
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="loot-pool-input" className="flex items-center gap-2 text-[13px] font-semibold text-text-bright">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/[.12] text-[12px] font-bold text-gold-light">2</span>
                  Loot items
                </label>
                <span className="text-[12px] font-semibold text-gold-light">{createUnitCount} {createUnitCount === 1 ? 'item' : 'items'}</span>
              </div>
              <textarea
                id="loot-pool-input"
                rows={Math.min(14, Math.max(8, items.length + 1))}
                value={items.map(item => item.name).join('\n')}
                onChange={event => {
                  const lines = event.target.value.split('\n')
                  setItems(lines.map(line => ({ name: line })).concat(lines.length ? [] : [{ name: '' }]))
                }}
                placeholder={'Silvarin\nMiddle Horn\nParchment'}
                className="lr-field resize-y px-3.5 py-3 text-[14px] leading-6"
              />
              <p className="mt-2 text-[12px] leading-5 text-text-dim">One item per line. Repeat a line for extra copies.</p>
              {createMode === 'weekly' && weekGroups.length > 0 && (
                <div className="lr-inset mt-3 rounded-2xl p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-[13px] text-text-dim">
                      <span className="text-[18px] font-bold text-gold-light">{weekPlayers.length}</span> players <span className="text-text-dim">from {weekIncludedLogs.length} {weekIncludedLogs.length === 1 ? 'run' : 'runs'}</span>
                    </div>
                    <div className="text-[11px] text-text-dim">More runs attended = higher chance</div>
                  </div>
                  {weekPlayers.length > 0 && (
                    <p className="mt-1.5 text-[11px] leading-4 text-text-dim">The number shows how many of these runs each player attended. Each player can win only one item.</p>
                  )}
                  {weekPlayers.length > 0 && (
                    <div className="mt-2.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                      {weekPlayers.map(p => (
                        <span key={p.memberId} title={`Attended ${p.runs} of ${weekIncludedLogs.length} runs · ${Math.round((p.runs / Math.max(1, weekTickets)) * 1000) / 10}% chance`} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold text-text-bright ${p.runs > 1 ? 'border-gold/20 bg-gold/[.05]' : 'border-white/[.08] bg-white/[.03]'}`}>
                          {p.name}
                          <span className={`text-[10px] font-bold ${p.runs > 1 ? 'text-gold-light' : 'text-text-dim'}`}>{p.runs}/{weekIncludedLogs.length}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer: balance + create */}
          <div className="mt-5 flex flex-col gap-3 border-t border-white/[.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 sm:max-w-md">
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <span className={createBlockedReason ? 'text-text-dim' : 'font-semibold text-text-bright'} aria-live="polite">{createBlockedReason || createBalanceText}</span>
                {!createBlockedReason && <span className="shrink-0 text-text-dim">{createUnitCount} / {createPlayerCount}</span>}
              </div>
              <div className="lr-bar mt-2" aria-hidden="true"><span style={{ width: `${balancePct}%` }} /></div>
            </div>
            <button type="button" disabled={creating || Boolean(createBlockedReason)} onClick={requestCreateRoulette} className="btn-gold min-h-11 w-full px-6 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[220px]">
              {creating ? 'Creating…' : createMode === 'weekly' ? 'Create weekly roulette' : 'Create roulette'}
            </button>
          </div>
        </section>
      )}

      {/* ── Roll panel ─────────────────────────────────────────────── */}
      {roulette && rollPanelOpen && roulette.status === 'ready' && (
        <div className="lr-modal z-[180]" role="dialog" aria-modal="true" aria-label="Loot Roulette roll panel" onMouseDown={event => { if (event.target === event.currentTarget && !spinning) setRollPanelOpen(false) }}>
          <section id="loot-roulette-active" className="lr-solid max-h-[94vh] w-full max-w-6xl overflow-y-auto overflow-x-hidden rounded-[28px]">
            <div className="border-b border-white/[.06] px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-spectral text-[22px] font-bold tracking-tight text-text-bright sm:text-[26px]">{roulette.event}</h2>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${runBadgeClass(displayRunLabel(roulette))}`}>{displayRunLabel(roulette)}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusPill(roulette.status)}`}>{statusLabel}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-dim">
                    <span>{roulette.session_display_name || 'Event Run'}</span><span className="text-white/20">•</span><span>{rouletteDateText(roulette)}</span>
                    {!isWeeklyRoulette(roulette) && <><span className="text-white/20">•</span><span>{formatTime(roulette.event_ts)} GMT+8</span></>}
                  </div>
                </div>

                <div className="relative flex shrink-0 flex-wrap items-center gap-2">
                  <button type="button" onClick={() => exportRouletteCsv(roulette, results, rouletteItems)} className="lr-btn">CSV</button>
                  {isStaff && (
                    <>
                      <button type="button" onClick={() => setActiveMenuOpen(v => !v)} aria-label="Roulette staff actions" aria-expanded={activeMenuOpen} className="lr-btn w-10 px-0 text-[16px]">⋯</button>
                      {activeMenuOpen && (
                        <div className="lr-solid absolute right-0 top-12 z-40 w-48 rounded-2xl p-1.5">
                          {roulette.status !== 'void' && <button type="button" onClick={() => requestVoid(roulette)} className="min-h-10 w-full rounded-xl px-3 text-left text-[12px] font-bold text-red-300 transition hover:bg-red-400/[.07]">Void roulette</button>}
                          <button type="button" onClick={event => { event.stopPropagation(); requestDelete(roulette) }} className="min-h-10 w-full rounded-xl px-3 text-left text-[12px] font-bold text-red-300 transition hover:bg-red-400/[.07]">Delete roulette</button>
                        </div>
                      )}
                    </>
                  )}
                  <button type="button" onClick={() => !spinning && setRollPanelOpen(false)} disabled={spinning} className="lr-btn">Close</button>
                </div>
              </div>
            </div>

            {roulette.status === 'void' && (
              <div className="mx-4 mt-4 rounded-2xl border border-red-400/20 bg-red-400/[.04] p-4 sm:mx-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-[.14em] text-red-300">Roulette voided</div>
                    <div className="mt-1 text-[13px] leading-5 text-text-dim">Attendance is unchanged, so staff can create a replacement.</div>
                    {roulette.void_reason && <div className="mt-2 text-[12px] text-text-dim">Reason: <span className="font-semibold text-text-bright">{roulette.void_reason}</span></div>}
                  </div>
                  {isStaff && <button type="button" onClick={startReplacement} className="lr-btn shrink-0 border-gold/25 text-gold-light">Create replacement</button>}
                </div>
              </div>
            )}

            <div className="p-4 sm:p-6">
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Players" value={participants.length} />
                <StatTile label="Loot left" value={remainingLootUnits} tone="gold" />
                <StatTile label="Awarded" value={distributedLootUnits} />
                <StatTile label="Progress" value={`${completedParticipants}/${participants.length}`} />
              </div>

              {/* Reveal stage */}
              <div className="lr-stage px-4 py-6 sm:px-8 sm:py-8">
                <div className="lr-rays" aria-hidden="true" />
                <div className="relative">
                  {spinning ? (
                    <div className="mx-auto max-w-3xl text-center">
                      <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[.16em] text-text-dim">
                        <span>Live reveal</span>
                        <span className="text-gold-light">{animationIndex} / {animationTotal}</span>
                      </div>
                      <div className="lr-progress mt-2"><span style={{ width: `${revealPct}%` }} /></div>

                      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[.14em] text-gold-light">
                        🎁 {animationItem?.name || animationItem?.item_name || 'Loot'}
                      </div>
                      <div
                        className="lr-name mt-5 min-h-[56px] break-words font-spectral text-[36px] font-bold leading-tight sm:min-h-[76px] sm:text-[56px]"
                        data-locked={revealLocked ? 'true' : 'false'}
                        aria-live="polite"
                      >
                        {animationWinner?._displayName || animationWinner?.winner_name || '…'}
                      </div>
                      <div className="mx-auto mt-2 max-w-md text-[12px] leading-5 text-text-dim">The winner is already saved on the server. This only reveals it.</div>

                      <div className="mt-6 flex flex-wrap justify-center gap-2">
                        <button type="button" onClick={skipAnimation} className="lr-btn border-gold/25 text-gold-light">{skipRequested ? 'Finishing…' : 'Skip ⏭'}</button>
                        <button type="button" onClick={togglePause} className="lr-btn">{paused ? '▶ Resume' : '❚❚ Pause'}</button>
                      </div>
                    </div>
                  ) : batchSummary ? (
                    <div className="lr-pop mx-auto max-w-2xl py-2 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/[.08] text-[20px] text-emerald-300">✓</div>
                      <div className="mt-3 text-[11px] font-bold uppercase tracking-[.2em] text-emerald-300">Roll complete</div>
                      <div className="mt-1 font-spectral text-[32px] font-bold text-text-bright sm:text-[40px]">{batchSummary.loot} loot revealed</div>
                      <div className="mt-3 flex flex-wrap justify-center gap-2 text-[12px] font-bold">
                        <span className="rounded-full border border-gold/25 bg-gold/[.06] px-3 py-1.5 text-gold-light">{batchSummary.loot} winners</span>
                        <span className="rounded-full border border-white/[.09] bg-white/[.03] px-3 py-1.5 text-text-dim">{batchSummary.nothing} Nothing</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-2xl py-2 text-center">
                      <div className="text-[11px] font-bold uppercase tracking-[.2em] text-gold-dim">Server-side roll</div>
                      <div className="mt-2 font-spectral text-[30px] font-bold text-text-bright sm:text-[36px]">{roulette.status === 'completed' ? 'Roulette complete' : roulette.status === 'void' ? 'Roulette voided' : 'Ready to roll'}</div>
                      <div className="mx-auto mt-2 max-w-xl text-[13px] leading-5 text-text-dim">Each loot unit goes to one player. A player can win at most one item.{hasTickets ? ' Players who attended more runs have a higher chance.' : ''} Players without loot get “Nothing”, which isn't animated.</div>
                    </div>
                  )}

                  {isStaff && roulette.status === 'ready' && !spinning && (
                    <button type="button" disabled={!eligibleParticipants.length || !remainingLootUnits} onClick={requestSpin} className="btn-gold mx-auto mt-6 flex min-h-12 w-full max-w-sm items-center justify-center text-[15px] font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-40">
                      🎲 Start roll
                    </button>
                  )}
                  {!isStaff && roulette.status === 'ready' && !spinning && <div className="mt-6 text-center text-[12px] font-bold uppercase tracking-[.14em] text-text-dim">Waiting for staff to start</div>}
                  {rollRecovery && !spinning && roulette.status === 'ready' && (
                    <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-red-400/25 bg-red-400/[.05] p-3 text-left">
                      <div className="text-[13px] font-bold text-red-200">Roll status needs checking</div>
                      <p className="mt-1 text-[12px] leading-5 text-text-dim">The server may have finished the roll. Refresh before trying again.</p>
                      <button type="button" onClick={async () => { setRollRecovery(false); await openRoulette(roulette.id); await loadHistory(historyLimit) }} className="lr-btn lr-btn-danger mt-2">Refresh roulette</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Loot board */}
              <div className="mt-5">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[.16em] text-gold-dim">Loot board</div>
                    <div className="mt-0.5 text-[13px] text-text-dim">Winners appear under each item.</div>
                  </div>
                  <span className="text-[12px] font-bold text-gold-light">{distributedLootUnits}/{totalLootUnits} awarded</span>
                </div>
                <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                  {rouletteItems.map((item, itemIndex) => {
                    const winners = lootResultsByItem.get(String(item.id)) || []
                    const totalUnits = Number(item.quantity) || 1
                    const done = winners.length >= totalUnits
                    return (
                      <article key={item.id} className={`rounded-2xl border p-3.5 transition ${done ? 'border-gold/20 bg-gold/[.035]' : 'border-white/[.07] bg-white/[.02]'}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/[.06] text-[12px] font-bold text-gold-light">{String(itemIndex + 1).padStart(2, '0')}</div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-bold text-text-bright">{item.name || item.item_name}</div>
                            <div className="mt-0.5 text-[11px] text-text-dim">{winners.length}/{totalUnits} awarded</div>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-1.5">
                          {Array.from({ length: totalUnits }).map((_, index) => {
                            const winner = winners[index]
                            return (
                              <div key={`${item.id}-${index}`} className={`min-h-8 truncate rounded-lg border px-2 py-1.5 text-[12px] font-semibold ${winner ? 'border-gold/25 bg-gold/[.06] text-gold-light' : 'border-dashed border-white/[.08] text-text-dim/70'}`}>
                                {winner?.winner_name || 'Not yet rolled'}
                              </div>
                            )
                          })}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>

              {currentUserResult ? (
                <div className="lr-pop mt-4 flex items-center gap-3 rounded-2xl border border-gold/25 bg-gold/[.06] px-4 py-3 text-[14px] font-bold text-gold-light">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/[.14]">🎁</span>
                  <span>You won <span className="text-text-bright">{currentUserResult.item_name}</span></span>
                </div>
              ) : roulette.status === 'completed' ? (
                <div className="lr-inset mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px] font-semibold text-text-dim">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[.05]">—</span>
                  <span>No loot this time.</span>
                </div>
              ) : null}

              <div className="lr-inset mt-5 rounded-2xl p-3 sm:p-4">
                <PlayerChances roulette={roulette} participants={participants} results={results} currentUserId={currentUser?.id} />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── History ────────────────────────────────────────────────── */}
      <section className="lr-glass rounded-[24px] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-spectral text-[22px] font-bold text-text-bright sm:text-[24px]">Loot history</h2>
            <p className="mt-0.5 text-[13px] text-text-dim">Open an entry to see every player's result.</p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" aria-hidden="true">⌕</span>
            <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search player, item or event…" className="lr-field min-h-[44px] py-2.5 pl-9 pr-3 text-[14px]" aria-label="Search loot history" />
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {historyLoading ? (
            <div className="py-12 text-center text-[13px] text-text-dim">Loading loot history…</div>
          ) : filteredHistory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[.1] bg-black/20 px-4 py-12 text-center">
              <div className="text-[30px]" aria-hidden="true">🎲</div>
              <div className="mt-2 text-[15px] font-semibold text-text-bright">{historySearch.trim() ? 'No matching results' : 'No loot roulette yet'}</div>
              <p className="mx-auto mt-1 max-w-sm text-[13px] leading-5 text-text-dim">
                {historySearch.trim() ? `Nothing matches “${historySearch.trim()}”.` : isStaff ? 'Create one after an event or at the end of the week. Attendance is imported automatically.' : 'Results appear here after staff rolls the loot.'}
              </p>
              {historySearch.trim() ? (
                <button type="button" onClick={() => setHistorySearch('')} className="lr-btn mt-4">Clear search</button>
              ) : isStaff && !createOpen ? (
                <button type="button" onClick={() => setCreateOpen(true)} className="btn-gold mt-4 min-h-10 px-5 text-[13px] font-bold">+ New Roulette</button>
              ) : null}
            </div>
          ) : filteredHistory.map(r => {
            const expanded = expandedHistoryIds.has(r.id)
            const playerCount = r.participants?.length || 0
            const itemsTotal = (r.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
            const lootCount = (r.results || []).filter(row => String(row.item_name || '').toLowerCase() !== 'nothing').length
            const nothing = (r.results || []).filter(row => String(row.item_name || '').toLowerCase() === 'nothing').length
            const winnerChips = [...new Set((r.results || []).filter(row => String(row.item_name || '').toLowerCase() !== 'nothing').map(row => row.winner_name).filter(Boolean))]
            const run = displayRunLabel(r)
            return (
              <article key={r.id} className={`lr-hist lr-solid rounded-2xl transition ${expanded ? 'border-gold/20' : ''}`} style={{ '--lr-accent': statusAccent(r.status) }}>
                <div className="flex flex-col gap-3 py-3.5 pl-5 pr-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-[15px] font-bold text-text-bright">{r.event}</div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${runBadgeClass(run)}`}>{run}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${statusPill(r.status)}`}>{r.status}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-text-dim">
                      <span>{rouletteDateText(r)}</span>
                      <span className="text-white/20">•</span><span>{r.session_display_name || 'Event Run'}</span>
                      <span className="text-white/20">•</span><span>{playerCount} players</span>
                      <span className="text-white/20">•</span><span>{itemsTotal} items</span>
                    </div>
                    {(() => {
                      const me = currentUser?.id == null ? null : (r.participants || []).find(pl => String(pl.member_id) === String(currentUser.id))
                      if (!me || r.status === 'void') return null
                      const myChance = ticketsOf(me) / Math.max(1, (r.participants || []).reduce((sum, pl) => sum + ticketsOf(pl), 0))
                      const myResult = (r.results || []).find(row => String(row.winner_member_id) === String(me.member_id))
                      const won = myResult && String(myResult.item_name || '').toLowerCase() !== 'nothing'
                      const runs = getTotalRuns(r)
                      return (
                        <div className={`mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2.5 py-1 text-[12px] ${won ? 'border-gold/25 bg-gold/[.06]' : 'border-white/[.08] bg-white/[.025]'}`}>
                          <span className="font-bold text-text-bright">You</span>
                          {runs > 1 && <span className="text-text-dim">{Math.max(1, Number(me.entries) || 1)}/{runs} runs</span>}
                          <span className="text-text-dim">·</span>
                          <span className="font-bold text-gold-light">{formatShare(myChance)} chance</span>
                          <span className="text-text-dim">→</span>
                          <span className={won ? 'font-bold text-gold-light' : 'text-text-dim'}>{won ? `🎁 ${myResult.item_name}` : myResult ? 'Nothing' : 'Not rolled yet'}</span>
                        </div>
                      )
                    })()}
                    {(winnerChips.length > 0 || nothing > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {winnerChips.slice(0, 8).map(name => <span key={`${r.id}-${name}`} className="rounded-full border border-gold/20 bg-gold/[.05] px-2 py-0.5 text-[11px] font-semibold text-gold-light">{name}</span>)}
                        {winnerChips.length > 8 && <span className="rounded-full border border-white/[.08] px-2 py-0.5 text-[11px] text-text-dim">+{winnerChips.length - 8} more</span>}
                        {nothing > 0 && <span className="rounded-full border border-white/[.08] bg-white/[.02] px-2 py-0.5 text-[11px] font-semibold text-text-dim">{nothing} Nothing</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.status !== 'void' && <span className="hidden text-right text-[12px] text-text-dim sm:block"><span className="block text-[16px] font-bold text-gold-light">{lootCount}</span>loot</span>}
                    <button type="button" onClick={() => toggleHistoryFull(r.id)} className="lr-btn border-gold/25 text-gold-light" aria-expanded={expanded}>{expanded ? 'Hide' : 'View'}</button>
                    <button type="button" onClick={() => exportRouletteCsv(r)} className="lr-btn">CSV</button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-white/[.06] bg-black/15 p-3 sm:p-4">
                    {r.status === 'void' && <div className="mb-3 rounded-xl border border-red-400/20 bg-red-400/[.04] px-3 py-2.5 text-[12px] text-text-dim">Void reason: <span className="font-semibold text-red-200">{r.void_reason || 'Voided by staff'}</span></div>}
                    <div>
                      <PlayerChances roulette={r} participants={r.participants || []} results={r.results || []} currentUserId={currentUser?.id} showYou={false} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.status === 'ready' && <button type="button" onClick={async () => { await openRoulette(r.id); setRollPanelOpen(true) }} className="btn-gold min-h-10 px-4 text-[12px] font-bold">Open roll</button>}
                      {isStaff && r.status !== 'void' && <button type="button" onClick={() => requestVoid(r)} className="lr-btn lr-btn-danger">Void</button>}
                      {isStaff && <button type="button" onClick={event => { event.stopPropagation(); requestDelete(r) }} className="lr-btn lr-btn-danger">Delete</button>}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>

        {hasMoreHistory && !historyLoading && (
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={() => { const next = historyLimit + 100; setHistoryLimit(next); loadHistory(next) }} className="lr-btn border-gold/25 text-gold-light">Load more</button>
          </div>
        )}
      </section>

      {/* ── Void / delete ──────────────────────────────────────────── */}
      {actionTarget && actionType && (
        <div className="lr-modal z-[230]" role="dialog" aria-modal="true" aria-label={actionType === 'void' ? 'Void loot roulette' : 'Delete loot roulette'} onMouseDown={e => e.target === e.currentTarget && closeStaffAction()}>
          <div ref={modalRef} tabIndex={-1} className="lr-solid w-full max-w-md overflow-hidden rounded-[22px] outline-none" style={{ borderColor: 'rgba(248,113,113,.25)' }}>
            <div className="border-b border-white/[.07] px-4 py-4 sm:px-5">
              <div className="text-[11px] font-bold uppercase tracking-[.16em] text-red-300">Staff action</div>
              <h3 className="mt-1 text-[18px] font-bold text-text-bright">{actionType === 'void' ? 'Void this roulette?' : 'Delete this roulette?'}</h3>
              <p className="mt-1 text-[13px] leading-5 text-text-dim">{actionTarget.event} · {actionTarget.session_display_name || 'Event Run'} · {rouletteDateText(actionTarget)}</p>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              <div className="rounded-xl border border-red-400/15 bg-red-400/[.04] p-3 text-[12px] leading-5 text-text-dim">
                {actionType === 'void' ? 'Void keeps the Attendance runs and lets you create a replacement.' : 'Delete permanently removes this roulette, its players, loot and results. Attendance is not changed.'}
              </div>
              {actionType === 'void' && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">Reason (optional)</label>
                  <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} rows={3} className="lr-field resize-none px-3 py-2.5 text-[13px]" placeholder="Why is this roulette being voided?" />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">Staff password</label>
                <input autoFocus type="password" value={actionPassword} onChange={e => setActionPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmStaffAction() }} className="lr-field min-h-[44px] px-3 text-[13px]" placeholder="Your current login password" />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeStaffAction} disabled={deleting || voiding} className="lr-btn">Cancel</button>
                <button type="button" onClick={confirmStaffAction} disabled={deleting || voiding || !actionPassword.trim()} className="lr-btn lr-btn-danger">{deleting ? 'Deleting…' : voiding ? 'Voiding…' : actionType === 'void' ? 'Void roulette' : 'Delete permanently'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm create ─────────────────────────────────────────── */}
      {confirmCreate && (createMode === 'weekly' ? selectedWeek : selectedAttendance) && (
        <div className="lr-modal z-[220]" role="dialog" aria-modal="true" aria-label="Confirm create loot roulette" onMouseDown={e => e.target === e.currentTarget && setConfirmCreate(false)}>
          <div ref={modalRef} tabIndex={-1} className="lr-solid w-full max-w-lg overflow-hidden rounded-[22px] outline-none">
            <div className="border-b border-white/[.07] px-4 py-4 sm:px-5">
              <div className="text-[11px] font-bold uppercase tracking-[.16em] text-gold-dim">Final check</div>
              <h3 className="mt-1 text-[18px] font-bold text-text-bright">{createMode === 'weekly' ? 'Create weekly roulette?' : 'Create roulette?'}</h3>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4 sm:p-5">
              <div className="lr-inset rounded-xl p-3">
                <div className="text-[11px] font-bold uppercase tracking-[.14em] text-text-dim">{createMode === 'weekly' ? 'Week' : 'Attendance'}</div>
                {createMode === 'weekly' ? (
                  <>
                    <div className="mt-1 text-[15px] font-bold text-text-bright">{selectedWeek.label} <span className="text-[12px] font-semibold text-text-dim">(Tue–Sat)</span></div>
                    <div className="mt-0.5 text-[12px] text-text-dim">{weekIncludedLogs.length} {weekIncludedLogs.length === 1 ? 'run' : 'runs'} · <span className="font-semibold text-gold-light">{weekPlayers.length} players</span> · chance grows with attendance</div>
                    <ul className="mt-2 space-y-1">
                      {weekIncludedLogs.map(log => <li key={log.id} className="truncate text-[12px] text-text-dim">• {log.event} · {log._sessionName} · {log._date}</li>)}
                    </ul>
                  </>
                ) : (
                  <>
                    <div className="mt-1 text-[15px] font-bold text-text-bright">{selectedAttendance.event}</div>
                    <div className="mt-0.5 text-[12px] text-text-dim">{selectedAttendance._sessionName} · {selectedAttendance._date} · {selectedAttendance._participants.length} players</div>
                  </>
                )}
              </div>
              <div className="lr-inset rounded-xl p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[.14em] text-text-dim"><span>Loot</span><span className="text-gold-light">{createUnitCount} {createUnitCount === 1 ? 'item' : 'items'}</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {createPayload.map((item, index) => <span key={`${item.name}-${index}`} className="rounded-lg border border-white/[.08] bg-black/25 px-2.5 py-1 text-[12px] font-semibold text-text-bright">{item.name}</span>)}
                </div>
              </div>
              <div className="text-[12px] text-text-dim">{createBalanceText}</div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setConfirmCreate(false)} className="lr-btn">Cancel</button>
                <button type="button" onClick={createRoulette} className="btn-gold min-h-10 px-5 text-[13px] font-bold">{createMode === 'weekly' ? 'Create weekly roulette' : 'Create roulette'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm roll ───────────────────────────────────────────── */}
      {confirmRoll && roulette && (
        <div className="lr-modal z-[220]" role="dialog" aria-modal="true" aria-label="Confirm loot roll" onMouseDown={e => e.target === e.currentTarget && setConfirmRoll(false)}>
          <div ref={modalRef} tabIndex={-1} className="lr-solid w-full max-w-md overflow-hidden rounded-[22px] outline-none">
            <div className="border-b border-white/[.07] px-4 py-4 sm:px-5">
              <div className="text-[11px] font-bold uppercase tracking-[.16em] text-gold-dim">Final check</div>
              <h3 className="mt-1 text-[18px] font-bold text-text-bright">Start the roll?</h3>
              <p className="mt-1 text-[13px] leading-5 text-text-dim">The server decides every result in one go. The animation just reveals them.</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2">
                <StatTile label="Players" value={eligibleParticipants.length} />
                <StatTile label="Loot" value={remainingLootUnits} tone="gold" />
                <StatTile label="Nothing" value={Math.max(0, eligibleParticipants.length - remainingLootUnits)} />
                </div>
                {hasTickets && (
                  <div className="mt-3 rounded-xl border border-gold/15 bg-gold/[.04] px-3 py-2.5 text-[12px] leading-5 text-text-dim">
                    Players who attended more runs have a <span className="font-semibold text-gold-light">higher chance</span>. Each player still wins at most one item.
                  </div>
                )}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setConfirmRoll(false)} className="lr-btn">Cancel</button>
                <button type="button" onClick={spin} className="btn-gold min-h-10 px-5 text-[13px] font-bold">🎲 Start roll</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
