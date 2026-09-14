import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Members from './components/Members'
import Attendance from './components/Attendance'
import EventCalendar from './components/EventCalendar'
import Auctions from './components/Auctions'
import Leaderboard from './components/Leaderboard'
import Login from './components/Login'

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
        autoEndedRef.current.add(a.id)

        const winner = a.topBidder || null
        const finalBid = a.currentBid ?? 0
        const endedAt = a.endsAt
        const distributedBy = winner ? 'System' : null

        const { error } = await supabase
          .from('auctions')
          .update({
            status: 'ended',
            ended_at: endedAt,
            distributed_by: distributedBy,
            is_featured: false,
          })
          .eq('id', a.id)

        if (error) {
          console.error(`Auto-end failed for auction ${a.id}:`, error)
          autoEndedRef.current.delete(a.id)
          continue
        }

        setAuctions(prev => prev.map(x =>
          x.id === a.id
            ? { ...x, status: 'ended', topBidder: winner, currentBid: finalBid, endsAt: endedAt, endedAt, distributedBy, isFeatured: false }
            : x
        ))

        if (winner) {
          addToast(`"${a.name}" ended — won by ${winner} for ${finalBid.toLocaleString()} coins.`, 'gold', 'Auction Ended')
        } else {
          addToast(`"${a.name}" ended with no bids.`, 'blue', 'Auction Ended')
        }
      }
    }

    autoEndExpired()
    const id = setInterval(autoEndExpired, 5000)
    return () => clearInterval(id)
  }, [auctions])

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
      const { data, error } = await supabase
        .from('members')
        .update(updates)
        .eq('id', id)
        .select()
      if (error) throw error
      if (data && data.length > 0) {
        const normalized = normalizeMember(data[0])
        setAllMembers(prev => prev.map(m => m.id === id ? normalized : m))
        setMembers(prev => prev.map(m => m.id === id ? normalized : m))
        return normalized
      }
      return null
    } catch (error) {
      console.error('Failed to update member:', error)
      addToast('Failed to update member. Please try again.', 'red', 'Error')
      return null
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
      case 'calendar':    return <EventCalendar setPage={setPage} />
      case 'auctions':    return <Auctions    ctx={ctx} />
      case 'leaderboard': return <Leaderboard ctx={ctx} />
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
