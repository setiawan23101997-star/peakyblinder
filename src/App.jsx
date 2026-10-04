/*
 * PeakyBlinder App.jsx
 * Based directly on the user's uploaded App source:
 * Pasted text(20260914-181933).txt
 *
 * This replacement keeps the existing application structure/routes and fixes:
 * 1) Power cooldown reset regression caused by a broken verification reference.
 * 2) Staff reset using a plain members UPDATE + separate verification.
 * 3) Detailed Admin Audit Log records with exact before/after values.
 * 4) Audit records for add/remove member, password reset, and Power reset.
 *
 * No auction/calendar/notice-board behavior was intentionally redesigned.
 */
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Members from './components/Members'
import Attendance from './components/Attendance'
import Auctions from './components/Auctions'
import Leaderboard from './components/Leaderboard'
import Login from './components/Login'
import EventCalendar from './components/EventCalendar'
import NoticeBoard from './components/NoticeBoard'
import AdminAuditLog from './components/AdminAuditLog'
import Marketplace from './components/Marketplace'
import LootRoulette from './components/LootRoulette'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Column lists are defined ONCE so every query (initial load, fallback refresh,
// reloads) downloads exactly the same, minimal set of columns.
// - `password` is intentionally NOT in MEMBER_COLS: other members' passwords
//   never need to reach the browser. Only the legacy login fallback uses it.
// - `region`, `server`, `character_image` are not mapped by normalizeMember, so
//   they were downloaded and discarded. Removed.
// - If tx_log / attend_log turn out to be big, delete them from MEMBER_COLS and
//   fetch them on demand where they are displayed.
const MEMBER_COLS = 'id,name,username,cls,role,coins,power,character_level,awakening_stage,profile_grade,power_updates_used,power_window_started_at,power_updated_at,power_next_update_at,attendance,auction_wins,join_date,discord,tx_log,attend_log'
const LOGIN_COLS = MEMBER_COLS + ',password'
const AUCTION_COLS = 'id,name,description,rarity,status,current_bid,min_bid,top_bidder,ends_at,started_at,ended_at,distributed_by,image_url,is_featured,bids,image_name'
const ATTENDANCE_COLS = 'id,event,date,ts,members,recorded_by,attendees'
const FALLBACK_REFRESH_MS = 5 * 60 * 1000
const CONSISTENCY_REFRESH_MS = 30 * 60 * 1000
const MEMBER_LIVE_COLS = 'id,name,username,cls,role,coins,power,character_level,awakening_stage,profile_grade,power_updates_used,power_window_started_at,power_updated_at,power_next_update_at,attendance,auction_wins,join_date,discord'

// Region options shared between Layout (picker) and Dashboard (display).
// `code` is the ISO 3166-1 alpha-2 code used to fetch flag images from
// flagcdn.com. `flag` is the emoji fallback for platforms that support it.
export const REGIONS = [
  { id: 'ph', code: 'ph', flag: '🇵🇭', name: 'Philippines', tz: 'Asia/Manila',       label: 'GMT+8' },
  { id: 'us', code: 'us', flag: '🇺🇸', name: 'New York',    tz: 'America/New_York',  label: 'ET' },
  { id: 'br', code: 'br', flag: '🇧🇷', name: 'Brazil',      tz: 'America/Sao_Paulo', label: 'BRT' },
  { id: 'de', code: 'de', flag: '🇩🇪', name: 'Germany',     tz: 'Europe/Berlin',     label: 'CET' },
  { id: 'by', code: 'by', flag: '🇧🇾', name: 'Belarus',     tz: 'Europe/Minsk',      label: 'MSK' },
  { id: 'ua', code: 'ua', flag: '🇺🇦', name: 'Ukraine',     tz: 'Europe/Kyiv',       label: 'EET' },
  { id: 'th', code: 'th', flag: '🇹🇭', name: 'Thailand',    tz: 'Asia/Bangkok',      label: 'GMT+7' },
  { id: 'id', code: 'id', flag: '🇮🇩', name: 'Indonesia',   tz: 'Asia/Jakarta',      label: 'GMT+7' },
]
const DEFAULT_REGION_ID = 'ph'
const REGION_STORAGE_KEY = 'peakyblader:localRegion'

function App() {
  const [page, setPage] = useState('dashboard')

  const [allMembers, setAllMembers] = useState([])
  const [members, setMembers] = useState([])

  const [auctions, setAuctions] = useState([])
  const [attendanceLogs, setAttendanceLogs] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [toasts, setToasts] = useState([])
  const [loading, setLoading] = useState(true)

  const [regionId, setRegionIdState] = useState(() => {
    try {
      const saved = localStorage.getItem(REGION_STORAGE_KEY)
      return saved && REGIONS.some(r => r.id === saved) ? saved : DEFAULT_REGION_ID
    } catch { return DEFAULT_REGION_ID }
  })

  const autoEndedRef = useRef(new Set())

  const setRegionId = (id) => {
    if (!REGIONS.some(r => r.id === id)) return
    setRegionIdState(id)
    try { localStorage.setItem(REGION_STORAGE_KEY, id) } catch {}
  }

  const region = REGIONS.find(r => r.id === regionId) || REGIONS[0]

  const addToast = (msg, type = 'gold', title = '') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type, title }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  const normalizeAuction = (a) => ({
    id: String(a.id),
    name: a.name ?? '',
    description: a.description ?? '',
    rarity: a.rarity ?? 'epic',
    status: a.status ?? 'active',
    currentBid: Number(a.current_bid ?? a.currentBid) || 0,
    startBid: Number(a.min_bid ?? a.startBid) || 0,
    topBidder: a.top_bidder ?? a.topBidder ?? null,
    endsAt: Number(a.ends_at ?? a.endsAt) || 0,
    startedAt: Number(a.started_at ?? a.startedAt) || 0,
    endedAt: Number(a.ended_at ?? a.endedAt) || 0,
    distributedBy: a.distributed_by ?? a.distributedBy ?? null,
    imageUrl: a.image_url ?? a.imageUrl ?? null,
    // Keep the featured flag when normalizing Supabase rows.
    // Auctions.jsx uses the camelCase `isFeatured` property, while
    // Supabase stores it as `is_featured`. Without this mapping,
    // the 5-second refresh overwrites the local featured state.
    isFeatured: Boolean(a.is_featured ?? a.isFeatured),
    bids: (() => {
      try {
        if (typeof a.bids === 'string') return JSON.parse(a.bids)
        if (Array.isArray(a.bids)) return a.bids
        return []
      } catch { return [] }
    })(),
    imageName: a.image_name ?? null,
  })

  const toJsonArray = (v) => {
    try {
      if (typeof v === 'string') return JSON.parse(v)
      if (Array.isArray(v)) return v
      return []
    } catch { return [] }
  }

  const normalizeMember = (m) => ({
    id: Number(m.id),
    name: m.name ?? '',
    username: m.username ?? '',
    password: m.password ?? '',
    cls: m.cls ?? '',
    role: m.role ?? 'Member',
    coins: Number(m.coins) || 0,
    power: Number(m.power) || 0,

    // Character profile fields — keep these in React state after every
    // Supabase load/update so Card Grade, Level and Awakening can persist.
    character_level: Number(m.character_level ?? m.level) || 1,
    awakening_stage: Number(m.awakening_stage) || 0,
    profile_grade: m.profile_grade ?? 'Legendary',

    // Power-window fields used by Members.jsx.
    power_updates_used: Number(m.power_updates_used) || 0,
    power_window_started_at: m.power_window_started_at ?? null,
    power_updated_at: m.power_updated_at ?? null,
    power_next_update_at: m.power_next_update_at ?? null,

    attendance: Number(m.attendance) || 0,
    auction_wins: Number(m.auction_wins ?? m.auctionWins) || 0,
    join_date: m.join_date ?? m.joinDate ?? '',
    discord: m.discord ?? '',
    tx_log: toJsonArray(m.tx_log),
    attend_log: toJsonArray(m.attend_log),
  })

  // Realtime UPDATE payloads can omit unchanged large columns. Never let a
  // missing key wipe data we already hold (logs, password).
  const mergeMemberRow = (prev, row) => {
    const next = normalizeMember(row)
    if (!prev) return next
    const keep = {}
    if (!('tx_log' in row)) keep.tx_log = prev.tx_log
    if (!('attend_log' in row)) keep.attend_log = prev.attend_log
    if (!row.password) keep.password = prev.password
    return { ...next, ...keep }
  }

  const upsertMember = (list, row, viewer, applyVisibility = false) => {
    const id = Number(row.id)
    const prevMember = list.find(m => Number(m.id) === id)
    const merged = mergeMemberRow(prevMember, row)
    if (applyVisibility && filterVisibleMembers([merged], viewer).length === 0) {
      return list.filter(m => Number(m.id) !== id)
    }
    const next = prevMember
      ? list.map(m => Number(m.id) === id ? merged : m)
      : [...list, merged]
    return next.sort((a, b) => Number(a.id) - Number(b.id))
  }

  const filterVisibleMembers = (list, viewer) => {
    if (viewer?.role === 'Admin') return list
    return list.filter(m => m.role !== 'Admin')
  }

  const loadAllData = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)

      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select(MEMBER_COLS)
        .order('id')
      if (membersError) throw membersError
      console.log('Loaded members:', membersData?.length || 0)

      let persistedViewer = null
      const savedUser = localStorage.getItem('currentUser')
      if (savedUser) {
        try { persistedViewer = JSON.parse(savedUser) } catch { persistedViewer = null }
      }

      if (!membersData || membersData.length === 0) {
        const defaultMembers = [
          { id: 1, name: 'Thomas Shelby', username: 'thomas', password: 'master123', cls: 'Archer', coins: 1000, power: 12345, attendance: 0, role: 'Master' },
          { id: 2, name: 'Arthur Shelby', username: 'arthur', password: 'member123', cls: 'Berserker', coins: 500, power: 11000, attendance: 0, role: 'Member' },
          { id: 3, name: 'John Shelby', username: 'john', password: 'member123', cls: 'Warlord', coins: 300, power: 9000, attendance: 0, role: 'Member' },
          { id: 4, name: 'Finn Shelby', username: 'finn', password: 'member123', cls: 'Skald', coins: 200, power: 7000, attendance: 0, role: 'Member' },
        ]
        for (const m of defaultMembers) {
          await supabase.from('members').insert([m])
        }
        const normalized = defaultMembers.map(normalizeMember)
        setAllMembers(normalized)
        setMembers(filterVisibleMembers(normalized, persistedViewer))
      } else {
        const normalized = membersData.map(normalizeMember)
        setAllMembers(normalized)
        setMembers(filterVisibleMembers(normalized, persistedViewer))
      }

      const { data: auctionsData, error: auctionsError } = await supabase
        .from('auctions')
        .select(AUCTION_COLS)
      if (auctionsError) throw auctionsError
      setAuctions((auctionsData || []).map(normalizeAuction))

      const { data: logsData, error: logsError } = await supabase
        .from('attendance_logs')
        .select(ATTENDANCE_COLS)
      if (logsError) throw logsError
      setAttendanceLogs(logsData || [])

      if (savedUser) {
        const user = JSON.parse(savedUser)
        const currentMembers = membersData || []
        const found = currentMembers.find(m => Number(m.id) === Number(user.id))
        if (found) {
          // MEMBER_COLS has no password; keep the one from the saved session
          // (the staff RPCs authenticate with it).
          const normalized = { ...normalizeMember(found), password: user.password ?? '' }
          setCurrentUser(normalized)
          setMembers(filterVisibleMembers((membersData || []).map(normalizeMember), normalized))
        } else {
          localStorage.removeItem('currentUser')
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      addToast('Could not connect to database. Please check your connection.', 'red', 'Connection Error')
    } finally {
      setLoading(false)
    }
  }

  // Don't download every table for visitors who are only looking at the login
  // screen. Returning users (saved session) load immediately; fresh logins load
  // right after currentUser is set.
  const loadedForRef = useRef(null)

  useEffect(() => {
    let savedId = null
    try {
      const saved = JSON.parse(localStorage.getItem('currentUser') || 'null')
      if (saved?.id != null) savedId = String(saved.id)
    } catch {}

    if (savedId) {
      loadedForRef.current = savedId
      loadAllData()
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!currentUser) {
      if (!loading) loadedForRef.current = null
      return
    }
    if (loadedForRef.current === String(currentUser.id)) return
    loadedForRef.current = String(currentUser.id)
    loadAllData({ silent: true })
  }, [currentUser?.id, loading])

  // Keep live state in sync with Supabase Realtime.
  // Realtime is the primary transport; database refreshes are only used as a
  // safety net when a channel is unhealthy and for an occasional consistency
  // sweep. This avoids downloading all three tables every 5 minutes.
  useEffect(() => {
    if (!currentUser) return undefined

    const realtimeStatusRef = {
      members: 'CONNECTING',
      auctions: 'CONNECTING',
      attendance: 'CONNECTING',
    }
    const refreshInFlightRef = { current: false }
    let lastConsistencyRefresh = 0
    let lastRefreshAttempt = 0
    let disposed = false

    const allRealtimeHealthy = () => (
      ['SUBSCRIBED', 'RECOVERED'].includes(realtimeStatusRef.members) &&
      ['SUBSCRIBED', 'RECOVERED'].includes(realtimeStatusRef.auctions) &&
      ['SUBSCRIBED', 'RECOVERED'].includes(realtimeStatusRef.attendance)
    )

    lastConsistencyRefresh = Date.now()

    const refreshCoreData = async ({ force = false } = {}) => {
      if (disposed) return
      if (typeof document !== 'undefined' && document.hidden) return
      if (refreshInFlightRef.current) return

      const now = Date.now()
      const consistencyDue = now - lastConsistencyRefresh >= CONSISTENCY_REFRESH_MS
      const needsRecovery = !allRealtimeHealthy()

      // With healthy Realtime channels there is no reason to fetch the whole
      // database on every 5-minute heartbeat. Do a full consistency sweep only
      // every 30 minutes, or recover only the tables whose channel is unhealthy.
      if (!force && !consistencyDue && !needsRecovery) return

      refreshInFlightRef.current = true
      lastRefreshAttempt = now

      const refreshMembers = force || consistencyDue || !['SUBSCRIBED', 'RECOVERED'].includes(realtimeStatusRef.members)
      const refreshAuctions = force || consistencyDue || !['SUBSCRIBED', 'RECOVERED'].includes(realtimeStatusRef.auctions)
      const refreshAttendance = force || consistencyDue || !['SUBSCRIBED', 'RECOVERED'].includes(realtimeStatusRef.attendance)

      try {
        const [membersRes, auctionsRes, logsRes] = await Promise.all([
          refreshMembers
            ? supabase.from('members').select(MEMBER_COLS).order('id')
            : Promise.resolve({ data: null, error: null }),
          refreshAuctions
            ? supabase.from('auctions').select(AUCTION_COLS)
            : Promise.resolve({ data: null, error: null }),
          refreshAttendance
            ? supabase.from('attendance_logs').select(ATTENDANCE_COLS)
            : Promise.resolve({ data: null, error: null }),
        ])

        let membersOk = !refreshMembers
        let auctionsOk = !refreshAuctions
        let attendanceOk = !refreshAttendance

        if (refreshMembers) {
          membersOk = !membersRes.error
          if (membersRes.error) {
            console.warn('[Fallback refresh] members:', membersRes.error.message)
          } else if (membersRes.data) {
            const normalized = membersRes.data.map(normalizeMember)
            setAllMembers(normalized)
            setMembers(filterVisibleMembers(normalized, currentUser))

            const currentId = Number(currentUser?.id)
            const freshCurrent = normalized.find(member => Number(member.id) === currentId)
            if (freshCurrent) {
              setCurrentUser(prev => {
                if (!prev || Number(prev.id) !== currentId) return prev
                const merged = { ...freshCurrent, password: prev.password ?? '' }
                try { localStorage.setItem('currentUser', JSON.stringify(merged)) } catch {}
                return merged
              })
            }
          }
        }

        if (refreshAuctions) {
          auctionsOk = !auctionsRes.error
          if (auctionsRes.error) {
            console.warn('[Fallback refresh] auctions:', auctionsRes.error.message)
          } else if (auctionsRes.data) {
            setAuctions(auctionsRes.data.map(normalizeAuction))
          }
        }

        if (refreshAttendance) {
          attendanceOk = !logsRes.error
          if (logsRes.error) {
            console.warn('[Fallback refresh] attendance:', logsRes.error.message)
          } else if (logsRes.data) {
            setAttendanceLogs(logsRes.data)
          }
        }

        if (refreshMembers && membersOk) realtimeStatusRef.members = realtimeStatusRef.members === 'SUBSCRIBED' ? 'SUBSCRIBED' : 'RECOVERED'
        if (refreshAuctions && auctionsOk) realtimeStatusRef.auctions = realtimeStatusRef.auctions === 'SUBSCRIBED' ? 'SUBSCRIBED' : 'RECOVERED'
        if (refreshAttendance && attendanceOk) realtimeStatusRef.attendance = realtimeStatusRef.attendance === 'SUBSCRIBED' ? 'SUBSCRIBED' : 'RECOVERED'

        if (refreshMembers && refreshAuctions && refreshAttendance && membersOk && auctionsOk && attendanceOk) {
          lastConsistencyRefresh = Date.now()
        }
      } catch (error) {
        console.warn('[Realtime fallback] Refresh failed:', error)
      } finally {
        refreshInFlightRef.current = false
      }
    }

    const handleMemberChange = payload => {
      const eventType = payload?.eventType
      const row = eventType === 'DELETE' ? payload?.old : payload?.new
      if (!row?.id) return
      const rowId = Number(row.id)

      if (eventType === 'DELETE') {
        setAllMembers(prev => prev.filter(m => Number(m.id) !== rowId))
        setMembers(prev => prev.filter(m => Number(m.id) !== rowId))
        return
      }

      setAllMembers(prev => upsertMember(prev, row))
      setMembers(prev => upsertMember(prev, row, currentUser, true))

      if (Number(currentUser?.id) === rowId) {
        const merged = mergeMemberRow(currentUser, row)
        setCurrentUser(merged)
        try { localStorage.setItem('currentUser', JSON.stringify(merged)) } catch {}
      }
    }

    const handleAuctionChange = payload => {
      const eventType = payload?.eventType
      const row = eventType === 'DELETE' ? payload?.old : payload?.new
      if (!row?.id) return

      setAuctions(prev => {
        if (eventType === 'DELETE') {
          return prev.filter(auction => String(auction.id) !== String(row.id))
        }

        const normalized = normalizeAuction(row)
        const exists = prev.some(auction => String(auction.id) === String(normalized.id))
        return exists
          ? prev.map(auction => String(auction.id) === String(normalized.id) ? normalized : auction)
          : [...prev, normalized]
      })
    }

    const handleAttendanceChange = payload => {
      const eventType = payload?.eventType
      const row = eventType === 'DELETE' ? payload?.old : payload?.new
      if (!row?.id) return

      setAttendanceLogs(prev => {
        if (eventType === 'DELETE') {
          return prev.filter(log => String(log.id) !== String(row.id))
        }

        const exists = prev.some(log => String(log.id) === String(row.id))
        return exists
          ? prev.map(log => String(log.id) === String(row.id) ? row : log)
          : [...prev, row]
      })
    }

    const onChannelStatus = (key, status) => {
      realtimeStatusRef[key] = status
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`[${key} Realtime] ${status}. Fallback refresh will recover this table.`)
      }
    }

    let membersChannel = null
    let auctionsChannel = null
    let attendanceChannel = null

    try {
      membersChannel = supabase
        .channel('app-members-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, handleMemberChange)
        .subscribe(status => onChannelStatus('members', status))

      auctionsChannel = supabase
        .channel('app-auctions-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, handleAuctionChange)
        .subscribe(status => onChannelStatus('auctions', status))

      attendanceChannel = supabase
        .channel('app-attendance-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, handleAttendanceChange)
        .subscribe(status => onChannelStatus('attendance', status))
    } catch (error) {
      console.warn('[Realtime] Setup failed:', error)
      realtimeStatusRef.members = 'ERROR'
      realtimeStatusRef.auctions = 'ERROR'
      realtimeStatusRef.attendance = 'ERROR'
    }

    // The interval now acts as a cheap health check. With all channels healthy,
    // it causes only one full consistency sweep every 30 minutes.
    const fallbackId = window.setInterval(() => {
      refreshCoreData()
    }, FALLBACK_REFRESH_MS)

    const handleVisibility = () => {
      if (document.hidden) return
      const stale = Date.now() - lastRefreshAttempt >= FALLBACK_REFRESH_MS
      if (stale || !allRealtimeHealthy()) refreshCoreData({ force: !allRealtimeHealthy() })
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      disposed = true
      window.clearInterval(fallbackId)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (membersChannel) {
        try { supabase.removeChannel(membersChannel) } catch {}
      }
      if (auctionsChannel) {
        try { supabase.removeChannel(auctionsChannel) } catch {}
      }
      if (attendanceChannel) {
        try { supabase.removeChannel(attendanceChannel) } catch {}
      }
    }
  }, [currentUser?.id, currentUser?.role])

  // Blind auctions are settled by Auctions.jsx. App.jsx must not
  // auto-close an expired auction that has submitted bids, because doing so
  // would bypass the blind winner/refund settlement logic.
  const getBlindFinalBids = (auction) => {
    const bids = Array.isArray(auction?.bids) ? auction.bids : []
    const latestByBidder = new Map()

    for (const bid of bids) {
      if (!bid?.bidder || bid?.cancelled) continue
      latestByBidder.set(bid.bidder, bid)
    }

    return [...latestByBidder.values()]
      .filter(b => Number(b.amount) > 0)
      .map(b => ({
        ...b,
        amount: Number(b.amount) || 0,
        time: Number(b.time) || 0,
      }))
      .sort((a, b) => b.amount - a.amount || a.time - b.time)
  }

  useEffect(() => {
    const autoEndExpired = async () => {
      const now = Date.now()

      const expired = auctions.filter(a =>
        a.status === 'active' &&
        a.endsAt > 0 &&
        a.endsAt <= now &&
        !autoEndedRef.current.has(a.id)
      )

      if (expired.length === 0) return

      for (const a of expired) {
        // IMPORTANT: an expired blind auction with bids must remain active in
        // the database until Auctions.jsx performs its winner/refund settlement.
        // Otherwise App.jsx could close it using the old open-bid fields
        // (topBidder/currentBid), causing the winner/refunds to be wrong.
        const finalBids = getBlindFinalBids(a)

        if (finalBids.length > 0) {
          continue
        }

        autoEndedRef.current.add(a.id)

        const endedAt = a.endsAt
        const distributedBy = null
        const finalBid = Number(a.startBid ?? a.currentBid ?? 0) || 0

        const { error } = await supabase
          .from('auctions')
          .update({
            status: 'ended',
            ended_at: endedAt,
            distributed_by: distributedBy,
            is_featured: false,
          })
          .eq('id', a.id)
          .eq('status', 'active')

        if (error) {
          console.error(`Auto-end failed for auction ${a.id}:`, error)
          autoEndedRef.current.delete(a.id)
          continue
        }

        setAuctions(prev => prev.map(x =>
          x.id === a.id
            ? {
                ...x,
                status: 'ended',
                topBidder: null,
                currentBid: finalBid,
                endsAt: endedAt,
                endedAt,
                distributedBy,
                isFeatured: false,
              }
            : x
        ))

        addToast(`"${a.name}" ended with no bids.`, 'blue', 'Auction Ended')
      }
    }

    autoEndExpired()
    const id = setInterval(autoEndExpired, 5000)
    return () => clearInterval(id)
  }, [auctions])

  // Audit writes must never make a successful member update look like a failure.
  // The previous App.jsx accidentally referenced logAudit without defining it,
  // so reset/update operations could change the database and then fall into
  // the catch block with a ReferenceError.
  const logAudit = async ({ action, entityType = 'System', entityId = null, details = {} }) => {
    if (!currentUser || !['Admin', 'Master', 'Elder'].includes(currentUser.role)) return false
    try {
      const { error } = await supabase.from('admin_audit_logs').insert([{
        actor_id: Number(currentUser.id) || null,
        actor_name: currentUser.name || 'Unknown Staff',
        actor_role: currentUser.role || null,
        action,
        entity_type: entityType,
        entity_id: entityId == null ? null : String(entityId),
        details: details || {},
      }])
      if (error) {
        console.warn('[logAudit] Audit log write failed:', error.message || error)
        return false
      }
      return true
    } catch (error) {
      console.warn('[logAudit] Audit log write failed:', error)
      return false
    }
  }

  const saveMember = async (member) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .insert([member])
        .select()
      if (error) throw error
      if (data && data.length > 0) {
        const normalized = normalizeMember(data[0])
        setAllMembers(prev => [...prev, normalized])
        setMembers(prev => [...prev, normalized])

        await logAudit({
          action: 'Added Member',
          entityType: 'Member',
          entityId: normalized.id,
          details: {
            member_name: normalized.name,
            username: normalized.username || null,
            target_role: normalized.role || null,
            field_changes: {
              role: { label: 'Role', before: null, after: normalized.role },
              profile_grade: { label: 'Card Grade', before: null, after: normalized.profile_grade },
              character_level: { label: 'Level', before: null, after: normalized.character_level },
              awakening_stage: { label: 'Awakening', before: null, after: normalized.awakening_stage },
              power: { label: 'Power', before: null, after: normalized.power, delta: Number(normalized.power) || 0 },
              coins: { label: 'Coins', before: null, after: normalized.coins, delta: Number(normalized.coins) || 0 },
            },
            changes: ['role', 'profile_grade', 'character_level', 'awakening_stage', 'power', 'coins'],
          },
        })

        return normalized
      }
      return null
    } catch (error) {
      console.error('Failed to save member:', error)
      addToast('Failed to save member. Please try again.', 'red', 'Error')
      return null
    }
  }

  const updateMember = async (id, updates) => {
    try {
      const numericId = Number(id)
      const existingMember = (allMembers || members || []).find(
        m => Number(m.id) === numericId
      )

      if (!currentUser?.id || !currentUser?.password) {
        throw new Error('Your login session is missing the member credentials. Please log out and log in again.')
      }

      const allowedUpdates = {}
      const allowedFields = [
        'coins',
        'power',
        'cls',
        'profile_grade',
        'character_level',
        'awakening_stage',
        'role',
        'region',
        'server',
        'discord',
        'name',
        'username',
        'character_image',
      ]

      for (const key of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(updates || {}, key)) {
          allowedUpdates[key] = updates[key]
        }
      }

      if (Object.keys(allowedUpdates).length === 0) {
        throw new Error('No supported member fields were provided.')
      }

      // Use the SECURITY DEFINER staff RPC instead of a direct members UPDATE.
      // Direct UPDATE + SELECT is blocked by the custom-login/RLS setup, which
      // made Power/other member edits appear to fail even when the request ran.
      const { data: updatedRow, error } = await supabase.rpc('update_member_by_staff', {
        p_target_id: numericId,
        p_actor_id: Number(currentUser.id),
        p_actor_password: String(currentUser.password),
        p_updates: allowedUpdates,
      })

      if (error) throw error
      if (!updatedRow) {
        throw new Error('Supabase did not return the updated member.')
      }

      {
        const normalized = normalizeMember(updatedRow)

        setAllMembers(prev => prev.map(m => Number(m.id) === numericId ? normalized : m))
        setMembers(prev => prev.map(m => Number(m.id) === numericId ? normalized : m))

        // Record the exact before → after values for member-management changes.
        // The Audit Log UI reads this structured object and renders each field
        // separately instead of only showing "changes: ['coins']".
        const fieldDefinitions = [
          {
            key: 'coins',
            label: 'Coins',
            before: Number(existingMember?.coins),
            after: Number(normalized.coins),
            numeric: true,
          },
          {
            key: 'power',
            label: 'Power',
            before: Number(existingMember?.power),
            after: Number(normalized.power),
            numeric: true,
          },
          {
            key: 'cls',
            label: 'Class',
            before: existingMember?.cls ?? '',
            after: normalized.cls ?? '',
          },
          {
            key: 'profile_grade',
            label: 'Card Grade',
            before: existingMember?.profile_grade ?? 'Legendary',
            after: normalized.profile_grade ?? 'Legendary',
          },
          {
            key: 'character_level',
            label: 'Level',
            before: Number(existingMember?.character_level ?? existingMember?.level ?? 1),
            after: Number(normalized.character_level ?? 1),
            numeric: true,
          },
          {
            key: 'awakening_stage',
            label: 'Awakening',
            before: Number(existingMember?.awakening_stage ?? 0),
            after: Number(normalized.awakening_stage ?? 0),
            numeric: true,
          },
          {
            key: 'role',
            label: 'Role',
            before: existingMember?.role ?? 'Member',
            after: normalized.role ?? 'Member',
          },
        ]

        const fieldChanges = {}

        for (const field of fieldDefinitions) {
          if (!Object.prototype.hasOwnProperty.call(updates || {}, field.key)) continue

          const changed = field.numeric
            ? Number(field.before) !== Number(field.after)
            : String(field.before ?? '') !== String(field.after ?? '')

          if (!changed) continue

          const item = {
            label: field.label,
            before: field.before,
            after: field.after,
          }

          if (field.numeric) {
            item.delta = Number(field.after) - Number(field.before)
          }

          fieldChanges[field.key] = item
        }

        // Keep a compact legacy-compatible list too.
        const changedKeys = Object.keys(fieldChanges)

        if (changedKeys.length > 0) {
          const auditDetails = {
            name: normalized.name,
            member_name: normalized.name,
            target_role: normalized.role,
            changes: changedKeys,
            field_changes: fieldChanges,
          }

          // Preserve the simple coin fields for compatibility with older
          // AdminAuditLog versions.
          if (fieldChanges.coins) {
            auditDetails.coins_before = fieldChanges.coins.before
            auditDetails.coins_after = fieldChanges.coins.after
            auditDetails.coin_change = fieldChanges.coins.delta
          }

          if (fieldChanges.power) {
            auditDetails.power_before = fieldChanges.power.before
            auditDetails.power_after = fieldChanges.power.after
            auditDetails.power_change = fieldChanges.power.delta
          }

          await logAudit({
            action: changedKeys.includes('coins')
              ? 'Changed Member Coins'
              : changedKeys.includes('power')
                ? 'Changed Member Power'
                : 'Updated Member',
            entityType: 'Member',
            entityId: normalized.id,
            details: auditDetails,
          })
        }

        return normalized
      }

      throw new Error('Member update returned no row. Check the members UPDATE/SELECT policy.')
    } catch (error) {
      console.error('Failed to update member:', error)
      addToast(
        error?.message || 'Failed to update member.',
        'red',
        'Update Failed'
      )
      return null
    }
  }

  // Staff Power reset: Admin / Master / Elder can reset another member's
  // 7-day Power window. This intentionally uses the same direct Supabase
  // members UPDATE pattern that the rest of this App uses.
  //
  // IMPORTANT:
  // - Do NOT call the reset RPC here.
  // - Do NOT use UPDATE(...).select() as the success condition.
  // - Verification is performed with a real, separately declared read error.
  //
  // We update the three actual cooldown fields, then read the member back
  // separately. This keeps the reset independent from RETURNING/RLS behavior.
  const resetMemberPowerCooldown = async (targetId) => {
    try {
      if (!currentUser || !['Admin', 'Master', 'Elder'].includes(currentUser.role)) {
        addToast(
          'Only Admin, Master, and Elder can reset a Power cooldown.',
          'red',
          'Not Allowed'
        )
        return false
      }

      const numericTargetId = Number(targetId)

      if (!Number.isFinite(numericTargetId)) {
        addToast('Invalid member ID.', 'red', 'Reset Failed')
        return false
      }

      const targetMember = (allMembers || members || []).find(
        m => Number(m.id) === numericTargetId
      )

      if (!targetMember) {
        addToast('Member not found.', 'red', 'Reset Failed')
        return false
      }

      if (Number(targetMember.id) === Number(currentUser.id)) {
        addToast(
          'Staff already have unlimited Power updates.',
          'blue',
          'No Reset Needed'
        )
        return false
      }

      const before = {
        power: Number(targetMember.power) || 0,
        power_updates_used: Number(targetMember.power_updates_used) || 0,
        power_window_started_at: targetMember.power_window_started_at || null,
        power_next_update_at: targetMember.power_next_update_at || null,
      }

      console.log('[resetMemberPowerCooldown] START', {
        targetId: numericTargetId,
        targetName: targetMember.name,
        actor: currentUser.name,
        actorRole: currentUser.role,
        before,
      })

      // This is deliberately a plain UPDATE. No RPC and no UPDATE().select().
      const { error: updateError } = await supabase
        .from('members')
        .update({
          power_updates_used: 0,
          power_window_started_at: null,
          power_next_update_at: null,
        })
        .eq('id', numericTargetId)

      if (updateError) {
        console.error('[resetMemberPowerCooldown] UPDATE FAILED:', updateError)
        throw updateError
      }

      // Read the row separately. The app already uses SELECT * on members,
      // so this gives us the actual persisted state after the reset.
      const { data: verified, error: readError } = await supabase
        .from('members')
        .select(MEMBER_COLS)
        .eq('id', numericTargetId)
        .maybeSingle()

      if (readError) {
        console.error('[resetMemberPowerCooldown] VERIFY READ FAILED:', readError)
        throw readError
      }

      if (!verified) {
        throw new Error(
          'The member could not be read after the reset. Check the members SELECT policy.'
        )
      }

      console.log('[resetMemberPowerCooldown] VERIFY RESULT:', {
        id: verified.id,
        power_updates_used: verified.power_updates_used,
        power_window_started_at: verified.power_window_started_at,
        power_next_update_at: verified.power_next_update_at,
      })

      // If another DB trigger is restoring the cooldown, do not pretend the
      // reset succeeded. This makes the real database problem visible.
      if (
        verified.power_next_update_at !== null ||
        Number(verified.power_updates_used) !== 0 ||
        verified.power_window_started_at !== null
      ) {
        throw new Error(
          'The database restored the Power cooldown after reset. Check the Power cooldown trigger/function in Supabase.'
        )
      }

      const normalized = normalizeMember(verified)

      setAllMembers(prev =>
        prev.map(m => Number(m.id) === numericTargetId ? normalized : m)
      )

      setMembers(prev =>
        prev.map(m => Number(m.id) === numericTargetId ? normalized : m)
      )

      // Keep the currently logged-in user's cached data correct if the target
      // somehow matches it, although the self-reset guard above normally stops it.
      if (Number(currentUser.id) === numericTargetId) {
        const keepSession = { ...normalized, password: currentUser.password }
        setCurrentUser(keepSession)
        localStorage.setItem('currentUser', JSON.stringify(keepSession))
      }

      // The reset itself is also a staff action and must be visible in Audit Log.
      await logAudit({
        action: 'Reset Member Power Cooldown',
        entityType: 'Member',
        entityId: normalized.id,
        details: {
          member_name: normalized.name,
          username: normalized.username || null,
          target_role: normalized.role || null,
          power: normalized.power,
          power_updates_used_before: before.power_updates_used,
          power_updates_used_after: 0,
          power_window_started_at_before: before.power_window_started_at,
          power_window_started_at_after: null,
          power_next_update_at_before: before.power_next_update_at,
          power_next_update_at_after: null,
          reset_by: currentUser.name || 'Unknown Staff',
          reset_by_role: currentUser.role || null,
          reason: 'Staff manually reset 7-day Power window',
        },
      })

      addToast(
        `${normalized.name} now has 3 fresh Power updates.`,
        'gold',
        'Power Reset'
      )

      return true
    } catch (error) {
      console.error('[resetMemberPowerCooldown] FAILED:', error)
      addToast(
        error?.message || 'Failed to reset Power cooldown.',
        'red',
        'Reset Failed'
      )
      return false
    }
  }

  const deleteMember = async (id) => {
    try {
      const targetMember = (allMembers || members || []).find(
        m => Number(m.id) === Number(id)
      )
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id)
      if (error) throw error
      setAllMembers(prev => prev.filter(m => m.id !== id))
      setMembers(prev => prev.filter(m => m.id !== id))

      await logAudit({
        action: 'Removed Member',
        entityType: 'Member',
        entityId: id,
        details: {
          member_name: targetMember?.name || 'Unknown Member',
          username: targetMember?.username || null,
          target_role: targetMember?.role || null,
        },
      })

      return true
    } catch (error) {
      console.error('Failed to delete member:', error)
      addToast('Failed to delete member. Please try again.', 'red', 'Error')
      return false
    }
  }

  const setMemberPasswordViaRpc = async (targetId, newPassword) => {
    if (!currentUser?.id || !currentUser?.password) {
      throw new Error('Your login session is missing the member credentials. Please log out and log in again.')
    }

    const targetNumericId = Number(targetId)
    if (!Number.isFinite(targetNumericId)) {
      throw new Error('Invalid target member ID.')
    }

    const trimmedPassword = String(newPassword ?? '').trim()
    if (!trimmedPassword) {
      throw new Error('New password cannot be empty.')
    }

    const { data, error } = await supabase.rpc('set_member_password', {
      p_target_id: targetNumericId,
      p_actor_id: Number(currentUser.id),
      p_actor_password: String(currentUser.password),
      p_new_password: trimmedPassword,
    })

    if (error) throw error
    if (data !== true) {
      throw new Error('Supabase did not confirm that the password was changed.')
    }

    return trimmedPassword
  }

  const resetMemberPassword = async (targetId, newPassword) => {
    try {
      const targetMember = (allMembers || members || []).find(
        m => Number(m.id) === Number(targetId)
      )

      await setMemberPasswordViaRpc(targetId, newPassword)

      // Refresh the target from Supabase so the app does not keep stale
      // password data in its member state.
      const { data: refreshed, error: refreshError } = await supabase
        .from('members')
        .select(MEMBER_COLS)
        .eq('id', Number(targetId))
        .maybeSingle()

      if (refreshError) throw refreshError

      if (refreshed) {
        const normalized = normalizeMember(refreshed)
        setAllMembers(prev =>
          prev.map(m => Number(m.id) === Number(targetId) ? normalized : m)
        )
        setMembers(prev =>
          prev.map(m => Number(m.id) === Number(targetId) ? normalized : m)
        )
      }

      await logAudit({
        action: 'Reset Member Password',
        entityType: 'Member',
        entityId: targetId,
        details: {
          member_name: targetMember?.name || refreshed?.name || 'Unknown Member',
          username: targetMember?.username || refreshed?.username || null,
          target_role: targetMember?.role || refreshed?.role || null,
          change_type: 'Staff reset member password',
        },
      })

      return true
    } catch (error) {
      console.error('Failed to reset password:', error)
      addToast(error?.message || 'Failed to reset password.', 'red', 'Password Reset Failed')
      return false
    }
  }

  const changeOwnPassword = async (oldPassword, newPassword) => {
    try {
      if (!currentUser?.id || !currentUser?.password) {
        addToast('Your login session is missing credentials. Please log out and log in again.', 'red', 'Session Error')
        return false
      }

      if (String(currentUser.password) !== String(oldPassword)) {
        addToast('Current password is incorrect.', 'red', 'Password Change Failed')
        return false
      }

      const changedPassword = await setMemberPasswordViaRpc(currentUser.id, newPassword)

      // Keep the active custom-login session synchronized with the database.
      const updated = { ...currentUser, password: changedPassword }
      setCurrentUser(updated)
      localStorage.setItem('currentUser', JSON.stringify(updated))

      await logAudit({
        action: 'Changed Own Password',
        entityType: 'Member',
        entityId: currentUser.id,
        details: {
          member_name: currentUser.name || 'Unknown Member',
          username: currentUser.username || null,
          change_type: 'Member changed own password',
        },
      })

      addToast('Your password has been changed successfully.', 'gold', 'Password Changed')
      return true
    } catch (error) {
      console.error('Failed to change password:', error)
      addToast(error?.message || 'Failed to change password.', 'red', 'Password Change Failed')
      return false
    }
  }

  const reloadMembers = async (memberIds = null) => {
    const requestedIds = Array.isArray(memberIds) && memberIds.length
      ? [...new Set(memberIds.map(id => Number(id)).filter(Number.isFinite))]
      : [Number(currentUser?.id)].filter(Number.isFinite)

    if (!requestedIds.length) return

    const { data, error } = await supabase
      .from('members')
      .select(MEMBER_LIVE_COLS)
      .in('id', requestedIds)

    if (error) throw error
    if (!data?.length) return

    // Auction actions usually need only the balances of the affected members.
    // Do not download tx_log/attend_log or the entire member table after each
    // bid/refund. Existing large logs stay in memory and Realtime remains the
    // source for other member changes.
    setAllMembers(prev => prev.map(member => {
      const fresh = data.find(row => Number(row.id) === Number(member.id))
      return fresh ? mergeMemberRow(member, fresh) : member
    }))

    setMembers(prev => prev.map(member => {
      const fresh = data.find(row => Number(row.id) === Number(member.id))
      return fresh ? mergeMemberRow(member, fresh) : member
    }))

    const currentId = Number(currentUser?.id)
    const freshCurrent = data.find(row => Number(row.id) === currentId)
    if (freshCurrent) {
      setCurrentUser(prev => {
        if (!prev || Number(prev.id) !== currentId) return prev
        const merged = mergeMemberRow(prev, freshCurrent)
        try { localStorage.setItem('currentUser', JSON.stringify(merged)) } catch {}
        return merged
      })
    }
  }

  const isMissingFunctionError = (error) =>
    error && (
      error.code === 'PGRST202' ||
      error.code === '42883' ||
      /could not find the function/i.test(error.message || '')
    )

  // Preferred path: the `login_member` RPC (see login_member.sql) checks the
  // credentials server-side and returns ONE row. Until that function exists,
  // fall back to the old behaviour (downloads the whole table) so login keeps
  // working.
  const handleLogin = async (username, password) => {
    try {
      let target = null

      const { data: rpcData, error: rpcError } = await supabase.rpc('login_member', {
        p_username: String(username ?? '').trim(),
        p_password: String(password ?? ''),
      })

      if (!rpcError) {
        target = Array.isArray(rpcData) ? (rpcData[0] || null) : (rpcData || null)
      } else if (isMissingFunctionError(rpcError)) {
        console.warn('[handleLogin] login_member RPC not found - using legacy full-table login. Run login_member.sql in Supabase to stop downloading every member on login.')
        const { data, error } = await supabase
          .from('members')
          .select(LOGIN_COLS)
        if (error) throw error

        target = (data || []).find(m =>
          m.username && m.username.toLowerCase() === username.toLowerCase() &&
          m.password === password
        ) || null
      } else {
        throw rpcError
      }

      if (!target) {
        return false
      }

      // The password was just verified, so keep the typed value on the session
      // (the staff RPCs need it as p_actor_password).
      const user = { ...normalizeMember(target), password: String(password) }
      setCurrentUser(user)
      localStorage.setItem('currentUser', JSON.stringify(user))

      // Members / auctions / logs are loaded by the effect that watches
      // currentUser, so there is no second full download here.
      addToast(`Welcome back, ${user.name}!`, 'gold', 'Login Success')
      return true
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUser')
    setMembers(filterVisibleMembers(allMembers, null))
    addToast('Logged out successfully.', 'blue', 'Goodbye')
  }

  const ctx = {
    members,
    setMembers,
    allMembers,
    saveMember,
    updateMember,
    deleteMember,
    resetMemberPassword,
    resetMemberPowerCooldown,
    changeOwnPassword,
    reloadMembers,
    auctions,
    setAuctions,
    attendanceLogs,
    setAttendanceLogs,
    currentUser,
    setCurrentUser,
    addToast,
    handleLogin,
    handleLogout,
    loadAllData,
    supabase,

    // Shared region state — Layout picker writes it, Dashboard reads it.
    regionId,
    region,
    setRegionId,
    regions: REGIONS,
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-void">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⚙️</div>
          <div className="text-text-dim">Loading...</div>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Login ctx={ctx} />
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':   return <Dashboard   ctx={ctx} setPage={setPage} />
      case 'members':     return <Members     ctx={ctx} />
      case 'attendance':  return <Attendance  ctx={ctx} />
      case 'auctions':    return <Auctions    ctx={ctx} />
      case 'marketplace': return <Marketplace ctx={ctx} />
      case 'loot-roulette': return <LootRoulette ctx={ctx} />
      case 'leaderboard': return <Leaderboard ctx={ctx} />
      case 'calendar':    return <EventCalendar setPage={setPage} />
      case 'notice-board': return <NoticeBoard ctx={ctx} />
      case 'admin-log':   return <AdminAuditLog ctx={ctx} />
      default:            return <Dashboard   ctx={ctx} setPage={setPage} />
    }
  }

  return (
    <Layout ctx={ctx} page={page} setPage={setPage} toasts={toasts}>
      {renderPage()}
    </Layout>
  )
}

export default App
