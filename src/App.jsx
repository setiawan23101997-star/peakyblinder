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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

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

  const filterVisibleMembers = (list, viewer) => {
    if (viewer?.role === 'Admin') return list
    return list.filter(m => m.role !== 'Admin')
  }

  const loadAllData = async () => {
    try {
      setLoading(true)

      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
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
        .select('*')
      if (auctionsError) throw auctionsError
      setAuctions((auctionsData || []).map(normalizeAuction))

      const { data: logsData, error: logsError } = await supabase
        .from('attendance_logs')
        .select('*')
      if (logsError) throw logsError
      setAttendanceLogs(logsData || [])

      if (savedUser) {
        const user = JSON.parse(savedUser)
        const currentMembers = membersData || []
        const found = currentMembers.find(m => Number(m.id) === Number(user.id))
        if (found) {
          const normalized = normalizeMember(found)
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

  useEffect(() => {
    loadAllData()
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: membersData } = await supabase.from('members').select('*').order('id')
      const { data: auctionsData } = await supabase.from('auctions').select('*')
      const { data: logsData } = await supabase.from('attendance_logs').select('*')
      if (membersData) {
        const normalized = membersData.map(normalizeMember)
        setAllMembers(normalized)
        setMembers(filterVisibleMembers(normalized, currentUser))
      }
      if (auctionsData) setAuctions(auctionsData.map(normalizeAuction))
      if (logsData) setAttendanceLogs(logsData)
    }, 5000)
    return () => clearInterval(interval)
  }, [currentUser])

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

      const { data, error } = await supabase
        .from('members')
        .update(updates)
        .eq('id', id)
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        const normalized = normalizeMember(data[0])

        setAllMembers(prev => prev.map(m => Number(m.id) === numericId ? normalized : m))
        setMembers(prev => prev.map(m => Number(m.id) === numericId ? normalized : m))

        // Record the exact before/after values for every important member field.
        // This is intentionally stored as structured JSON so Admin Audit Log can
        // display exactly what staff changed instead of only "changes: ['coins']".
        const fieldMap = {
          coins: 'Coins',
          power: 'Power',
          cls: 'Class',
          profile_grade: 'Card Grade',
          character_level: 'Level',
          awakening_stage: 'Awakening',
          role: 'Role',
        }

        const numericFields = new Set([
          'coins',
          'power',
          'character_level',
          'awakening_stage',
        ])

        const fieldChanges = {}

        Object.keys(updates || {}).forEach(key => {
          if (!(key in fieldMap)) return

          const beforeRaw = existingMember?.[key]
          const afterRaw = normalized?.[key]

          const before = numericFields.has(key)
            ? Number(beforeRaw ?? 0)
            : (beforeRaw ?? null)

          const after = numericFields.has(key)
            ? Number(afterRaw ?? 0)
            : (afterRaw ?? null)

          const changed = numericFields.has(key)
            ? before !== after
            : String(before ?? '') !== String(after ?? '')

          if (!changed) return

          const entry = {
            label: fieldMap[key],
            before,
            after,
          }

          if (numericFields.has(key)) {
            entry.delta = after - before
          }

          fieldChanges[key] = entry
        })

        const changedKeys = Object.keys(fieldChanges)

        const auditDetails = {
          name: normalized.name,
          username: normalized.username || null,
          changes: changedKeys,
          field_changes: fieldChanges,
        }

        // Keep legacy coin fields too so older/newer Audit Log UIs remain
        // compatible with records written by previous versions.
        if (fieldChanges.coins) {
          auditDetails.coins_before = fieldChanges.coins.before
          auditDetails.coins_after = fieldChanges.coins.after
          auditDetails.coin_change = fieldChanges.coins.delta
        }

        const changedPower = fieldChanges.power
        if (changedPower) {
          auditDetails.power_before = changedPower.before
          auditDetails.power_after = changedPower.after
          auditDetails.power_change = changedPower.delta
        }

        await logAudit({
          action: changedPower
            ? 'Changed Member Power'
            : fieldChanges.coins
              ? 'Changed Member Coins'
              : 'Updated Member',
          entityType: 'Member',
          entityId: normalized.id,
          details: auditDetails,
        })

        return normalized
      }

      return null
    } catch (error) {
      console.error('Failed to update member:', error)
      addToast(error?.message || 'Failed to update member. Please try again.', 'red', 'Error')
      return null
    }
  }


  // Staff Power reset: Admin / Master / Elder can reset another member's
  // 7-day Power window. This changes ONLY the window fields, never Power.
  // The preferred database path is the reset_member_power_cooldown RPC from
  // POWER_COOLDOWN_DEEP_REPAIR_AND_RESET_RPC.sql.
  //
  // IMPORTANT: do not use UPDATE(...).select(...).maybeSingle() here.
  // PostgREST can apply the UPDATE but return no row when SELECT/RLS rules
  // interfere with the RETURNING step. That made the old code look like the
  // reset failed even when the write happened.
  const resetMemberPowerCooldown = async (targetId) => {
    try {
      if (!currentUser || !['Admin', 'Master', 'Elder'].includes(currentUser.role)) {
        addToast('Only Admin, Master, and Elder can reset a Power cooldown.', 'red', 'Not Allowed')
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
        addToast('Staff already have unlimited Power updates.', 'blue', 'No Reset Needed')
        return false
      }

      console.log('[resetMemberPowerCooldown] START', {
        targetId: numericTargetId,
        targetName: targetMember.name,
        actor: currentUser.name,
        actorRole: currentUser.role,
        before: {
          power_updates_used: targetMember.power_updates_used,
          power_window_started_at: targetMember.power_window_started_at,
          power_updated_at: targetMember.power_updated_at,
          power_next_update_at: targetMember.power_next_update_at,
        },
      })

      // Preferred path: server-side RPC. This avoids RLS/RETURNING ambiguity
      // and makes the reset one database operation.
      let verified = null
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'reset_member_power_cooldown',
        {
          p_actor_id: Number(currentUser.id),
          p_target_id: numericTargetId,
        }
      )

      if (!rpcError) {
        verified = Array.isArray(rpcData) ? rpcData[0] : rpcData
      } else {
        // If the migration has not been installed yet, keep a compatibility
        // fallback so the button can still work with a permissive members
        // UPDATE policy. Other RPC errors must not be hidden.
        const missingRpc =
          rpcError.code === 'PGRST202' ||
          /reset_member_power_cooldown/i.test(rpcError.message || '')

        if (!missingRpc) {
          console.error('[resetMemberPowerCooldown] RPC FAILED:', rpcError)
          throw rpcError
        }

        console.warn('[resetMemberPowerCooldown] RPC not installed; using direct UPDATE fallback.')

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

        // Read separately so UPDATE ... RETURNING/RLS cannot make a successful
        // database write look like a failed reset.
        const { data: fallbackData, error: fallbackReadError } = await supabase
          .from('members')
          .select('id, name, username, role, power, power_updates_used, power_window_started_at, power_updated_at, power_next_update_at')
          .eq('id', numericTargetId)
          .maybeSingle()

        if (fallbackReadError) throw fallbackReadError
        verified = fallbackData
      }

      if (verifyError) {
        console.error('[resetMemberPowerCooldown] VERIFY READ FAILED:', verifyError)
        throw verifyError
      }

      if (!verified) {
        throw new Error('The member was not returned after the reset. Check the members SELECT policy.')
      }

      console.log('[resetMemberPowerCooldown] VERIFY RESULT:', {
        id: verified.id,
        power_updates_used: verified.power_updates_used,
        power_window_started_at: verified.power_window_started_at,
        power_updated_at: verified.power_updated_at,
        power_next_update_at: verified.power_next_update_at,
      })

      // The reset is only considered successful if the database really has no
      // next-update timestamp and the counter/window are cleared.
      if (
        verified.power_next_update_at !== null ||
        Number(verified.power_updates_used) !== 0 ||
        verified.power_window_started_at !== null
      ) {
        throw new Error(
          'Database did not keep the Power reset. A database trigger or policy is restoring the cooldown. Check the Power reset SQL migration.'
        )
      }

      const normalized = normalizeMember(verified)

      setAllMembers(prev =>
        prev.map(m => Number(m.id) === numericTargetId ? normalized : m)
      )
      setMembers(prev =>
        prev.map(m => Number(m.id) === numericTargetId ? normalized : m)
      )

      // Audit failure must NOT undo a successful reset.
      await logAudit({
        action: 'Reset Member Power Cooldown',
        entityType: 'Member',
        entityId: normalized.id,
        details: {
          member_name: normalized.name,
          username: normalized.username || null,
          target_role: normalized.role || null,
          power: normalized.power,
          power_updates_used_before: Number(targetMember.power_updates_used) || 0,
          power_updates_used_after: 0,
          power_window_started_at_before: targetMember.power_window_started_at || null,
          power_window_started_at_after: null,
          power_next_update_at_before: targetMember.power_next_update_at || null,
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
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id)
      if (error) throw error
      setAllMembers(prev => prev.filter(m => m.id !== id))
      setMembers(prev => prev.filter(m => m.id !== id))
      return true
    } catch (error) {
      console.error('Failed to delete member:', error)
      addToast('Failed to delete member. Please try again.', 'red', 'Error')
      return false
    }
  }

  const resetMemberPassword = async (targetId, newPassword) => {
    try {
      const { error } = await supabase
        .from('members')
        .update({ password: newPassword })
        .eq('id', targetId)
      if (error) throw error
      return true
    } catch (error) {
      console.error('Failed to reset password:', error)
      addToast('Failed to reset password.', 'red', 'Error')
      return false
    }
  }

  const changeOwnPassword = async (oldPassword, newPassword) => {
    try {
      if (currentUser.password !== oldPassword) {
        return false
      }
      const { error } = await supabase
        .from('members')
        .update({ password: newPassword })
        .eq('id', currentUser.id)
      if (error) throw error

      const updated = { ...currentUser, password: newPassword }
      setCurrentUser(updated)
      localStorage.setItem('currentUser', JSON.stringify(updated))
      return true
    } catch (error) {
      console.error('Failed to change password:', error)
      addToast('Failed to change password.', 'red', 'Error')
      return false
    }
  }

  const reloadMembers = async () => {
    const { data } = await supabase.from('members').select('*').order('id')
    if (data) {
      const normalized = data.map(normalizeMember)
      setAllMembers(normalized)
      setMembers(filterVisibleMembers(normalized, currentUser))
    }
  }

  const handleLogin = async (username, password) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
      if (error) throw error

      const target = (data || []).find(m =>
        m.username && m.username.toLowerCase() === username.toLowerCase() &&
        m.password === password
      )

      if (!target) {
        return false
      }

      const user = normalizeMember(target)
      setCurrentUser(user)
      localStorage.setItem('currentUser', JSON.stringify(user))

      const normalized = (data || []).map(normalizeMember)
      setAllMembers(normalized)
      setMembers(filterVisibleMembers(normalized, user))

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
