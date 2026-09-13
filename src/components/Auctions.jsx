import React, { useState, useEffect, useMemo, useId } from 'react'

const RARITY = {
  material:   { label: 'Common',    color: '#4ade80', rgb: '74,222,128' },
  uncommon:   { label: 'Uncommon',  color: '#ffffff', rgb: '255,255,255' },
  rare:       { label: 'Rare',      color: '#60a5fa', rgb: '96,165,250' },
  epic:       { label: 'Epic',      color: '#f87171', rgb: '248,113,113' },
  legendary:  { label: 'Legendary', color: '#f2cc60', rgb: '242,204,96' },
}

const GLOW_RARITIES = new Set(['legendary'])
const URGENT_MS = 5 * 60 * 1000
const MIN_BID_INCREMENT = 5

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

const presetDescriptions = [
  '',
  'World Boss Drop',
  'Epic Weapon Drop',
  'Rare Armor Piece',
  'Legendary Material',
  'Clan Event Reward',
  'Auction House Special',
  'Crafted by Master',
  'Cross-Server Reward',
  'Ranking Prize',
  'Custom...',
]

function rgba(rgb, alpha) { return `rgba(${rgb}, ${alpha})` }
function getRarityMeta(rarity) { return RARITY[rarity] || RARITY.epic }

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
const TIME_OPTS = { hour: '2-digit', minute: '2-digit', hour12: false }
const DATETIME_OPTS = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }
const SHORT_OPTS = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }
const WEEKDAY_OPTS = { weekday: 'short' }

function formatClockInZone(ts, tz) {
  return getDTF('en-GB', { timeZone: tz, ...CLOCK_OPTS }).format(new Date(ts))
}
function formatTimeInZone(ts, tz) {
  return getDTF('en-GB', { timeZone: tz, ...TIME_OPTS }).format(new Date(ts))
}
function formatDateTimeInZone(ts, tz) {
  return getDTF('en-GB', { timeZone: tz, ...DATETIME_OPTS }).format(new Date(ts))
}
function formatShortInZone(ts, tz) {
  return getDTF('en-GB', { timeZone: tz, ...SHORT_OPTS }).format(new Date(ts))
}
function formatWeekdayInZone(ts, tz) {
  return getDTF('en-GB', { timeZone: tz, ...WEEKDAY_OPTS }).format(new Date(ts))
}

function formatServerClock(ts) { return formatClockInZone(ts, SERVER_TZ) }
function formatClock(ts) { return formatTimeInZone(ts, SERVER_TZ) }
function formatDateTime(ts) { return formatDateTimeInZone(ts, SERVER_TZ) }

function formatCountdown(endsAt, now) {
  const diff = endsAt - now
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
}
function formatRelativePast(ms) {
  if (ms <= 0) return 'just now'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return `${s}s ago`
}
function isBiddingOpen(auction, now) {
  return auction.status === 'active' && (auction.endsAt - now) > URGENT_MS
}
function minNextBidFor(auction) {
  return (auction?.currentBid || 0) + MIN_BID_INCREMENT
}

/** Small flag image with emoji fallback (matches Attendance). */
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

function DistributorStatusBadge({ name }) {
  if (name) {
    const isSystem = name === 'System'
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          isSystem
            ? 'text-text-dim bg-void/60 border border-gold/15'
            : 'text-green-400 bg-green-500/10 border border-green-500/40'
        }`}
        title={isSystem ? 'Ended automatically by the timer' : `Handed out by ${name}`}
      >
        <span aria-hidden="true">{isSystem ? '⏱' : '✓'}</span>
        <span className="truncate max-w-[140px]">{name}</span>
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-yellow-400 bg-yellow-500/10 border border-yellow-500/40"
      title="A Master or Elder needs to hand the item to the winner in-game, then mark it here."
    >
      <span aria-hidden="true">⏳</span>
      <span>Awaiting hand-out</span>
    </span>
  )
}

function ItemImage({ src, alt, size = 56 }) {
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt || ''}
      width={size}
      height={size}
      loading="lazy"
      className="rounded border border-gold/25 object-cover flex-shrink-0 bg-void/60"
      style={{ width: size, height: size }}
      onError={(e) => { e.currentTarget.style.display = 'none' }}
    />
  )
}

export default function Auctions({ ctx }) {
  const {
    members, setMembers, auctions, setAuctions, currentUser, addToast, supabase,
    region, setRegionId, regions: ctxRegions,
  } = ctx

  const [showCreate, setShowCreate] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    rarity: 'epic',
    startBid: 100,
    duration: 60,
  })
  const [descChoice, setDescChoice] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [bidAmounts, setBidAmounts] = useState({})
  const [expandedBids, setExpandedBids] = useState({})
  const [now, setNow] = useState(() => Date.now())
  const [pickerOpen, setPickerOpen] = useState(false)
  const formId = useId()
  const fileInputId = `${formId}-image`

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setBidAmounts(prev => {
      const next = { ...prev }
      let changed = false
      for (const a of auctions) {
        if (a.status !== 'active') continue
        const current = next[a.id]
        if (current === undefined || current === '' || current === null) {
          next[a.id] = String(minNextBidFor(a))
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [auctions])

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

  const isElder = currentUser?.role === 'Elder' || currentUser?.role === 'Master' || currentUser?.role === 'Admin'
  const isMaster = currentUser?.role === 'Master' || currentUser?.role === 'Admin'

  const pickRegion = (id) => {
    if (typeof setRegionId === 'function') setRegionId(id)
    else try { localStorage.setItem('peakyblader:localRegion', id) } catch {}
    setPickerOpen(false)
  }

  const distributors = useMemo(() => {
    return [...members]
      .filter(m => m.role === 'Master' || m.role === 'Elder' || m.role === 'Admin')
      .sort((a, b) => {
        const rank = { Admin: 0, Master: 1, Elder: 2 }
        const ra = rank[a.role] ?? 99
        const rb = rank[b.role] ?? 99
        if (ra !== rb) return ra - rb
        return a.name.localeCompare(b.name)
      })
  }, [members])

  const finalDescription = descChoice === 'Custom...' ? customDesc.trim() : descChoice

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      addToast('Please choose an image file.', 'red', 'Invalid File')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      addToast('Image must be under 2 MB.', 'red', 'Too Large')
      return
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
  }

  const uploadImage = async () => {
    if (!imageFile) return null
    const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error } = await supabase.storage
      .from('auction-images')
      .upload(path, imageFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: imageFile.type,
      })

    if (error) throw error

    const { data } = supabase.storage.from('auction-images').getPublicUrl(path)
    return data?.publicUrl || null
  }

  const createAuction = async () => {
    if (!newItem.name.trim()) {
      addToast('Enter an item name.', 'red', 'Error')
      return
    }

    const startBid = parseInt(newItem.startBid) || 100
    const durationMin = parseInt(newItem.duration) || 60
    const endsAt = Date.now() + durationMin * 60 * 1000
    const id = String(Date.now())
    const description = finalDescription

    setUploading(true)

    let imageUrl = null
    try {
      imageUrl = await uploadImage()
    } catch (err) {
      console.error('Image upload failed:', err)
      addToast(`Couldn't upload image: ${err.message}`, 'red', 'Upload Failed')
      setUploading(false)
      return
    }

    const { error } = await supabase.from('auctions').insert([{
      id,
      name: newItem.name.trim(),
      description,
      rarity: newItem.rarity,
      status: 'active',
      started_at: Date.now(),
      ends_at: endsAt,
      current_bid: startBid,
      min_bid: startBid,
      top_bidder: null,
      bids: [],
      distributed_by: null,
      image_url: imageUrl,
    }])

    setUploading(false)

    if (error) {
      console.error('Create auction failed:', error)
      addToast(`Couldn't create auction: ${error.message}`, 'red', 'Save Failed')
      return
    }

    setAuctions(prev => [{
      id,
      name: newItem.name.trim(),
      description,
      rarity: newItem.rarity,
      status: 'active',
      currentBid: startBid,
      startBid,
      topBidder: null,
      endsAt,
      startedAt: Date.now(),
      bids: [],
      distributedBy: null,
      imageUrl,
    }, ...prev])

    setNewItem({ name: '', description: '', rarity: 'epic', startBid: 100, duration: 60 })
    setDescChoice('')
    setCustomDesc('')
    clearImage()
    setShowCreate(false)
    addToast(`"${newItem.name}" is now up for auction!`, 'gold', 'Auction Live')
  }

  const placeBid = async (auctionId) => {
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction || auction.status !== 'active') {
      addToast('This auction has ended.', 'red', 'Auction Ended')
      return
    }
    if (!isBiddingOpen(auction, Date.now())) {
      addToast('Bidding is closed — less than 5 minutes remaining.', 'red', 'Bidding Closed')
      return
    }
    const raw = bidAmounts[auctionId]
    const amount = (raw === '' || raw === undefined || raw === null)
      ? minNextBidFor(auction)
      : parseInt(raw)
    if (!amount || amount <= 0) {
      addToast('Enter a valid bid amount.', 'red', 'Invalid Bid')
      return
    }
    const minNext = minNextBidFor(auction)
    if (amount < minNext) {
      addToast(`Minimum bid is ${minNext.toLocaleString()} coins (current + ${MIN_BID_INCREMENT}).`, 'red', 'Bid Too Low')
      return
    }
    const bidder = members.find(m => m.name === currentUser.name)
    if (!bidder || bidder.coins < amount) {
      addToast('Not enough coins.', 'red', 'Insufficient Funds')
      return
    }

    const prevBidder = auction.topBidder
    const prevAmount = auction.currentBid
    const newBids = [
      ...(auction.bids || []),
      {
        bidder: currentUser.name,
        amount,
        time: Date.now(),
        previousBidder: prevBidder || null,
        previousAmount: prevBidder ? prevAmount : null,
      },
    ]

    const { error: auctionErr } = await supabase
      .from('auctions')
      .update({ current_bid: amount, top_bidder: currentUser.name, bids: newBids })
      .eq('id', auctionId)

    if (auctionErr) {
      console.error('Bid update failed:', auctionErr)
      addToast(`Couldn't place bid: ${auctionErr.message}`, 'red', 'Save Failed')
      return
    }

    await supabase.from('members').update({ coins: bidder.coins - amount }).eq('id', bidder.id)

    if (prevBidder) {
      const prev = members.find(m => m.name === prevBidder)
      if (prev) {
        await supabase.from('members').update({ coins: prev.coins + prevAmount }).eq('id', prev.id)
      }
    }

    setMembers(prev => prev.map(m => {
      if (m.id === bidder.id) return { ...m, coins: m.coins - amount }
      if (prevBidder && m.name === prevBidder) return { ...m, coins: m.coins + prevAmount }
      return m
    }))

    setAuctions(prev => prev.map(a => a.id === auctionId
      ? { ...a, currentBid: amount, topBidder: currentUser.name, bids: newBids }
      : a))
    setBidAmounts(prev => ({ ...prev, [auctionId]: '' }))
    addToast(`Bid of ${amount.toLocaleString()} coins placed on ${auction.name}.`, 'gold', 'Bid Placed')
  }

  const endAuction = async (auctionId) => {
    if (!isMaster) return
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return
    const hasWinner = !!auction.topBidder
    const winnerNote = hasWinner
      ? `\n\nWinner: ${auction.topBidder} for ${auction.currentBid.toLocaleString()} coins.`
      : `\n\nNo bids were placed — item goes undistributed.`
    if (window.confirm(`End "${auction.name}" early?${winnerNote}`)) {
      const { error } = await supabase.from('auctions').update({ status: 'ended' }).eq('id', auctionId)
      if (error) { addToast(`Couldn't end auction: ${error.message}`, 'red', 'Save Failed'); return }
      setAuctions(prev => prev.map(a => a.id === auctionId ? { ...a, status: 'ended', endedAt: Date.now() } : a))
      addToast(`"${auction.name}" ended. Now pick who distributes it.`, 'gold', 'Auction Ended')
    }
  }

  const assignDistributor = async (auctionId, distributorName) => {
    if (!isElder) return
    const value = distributorName || null
    const { error } = await supabase.from('auctions').update({ distributed_by: value }).eq('id', auctionId)
    if (error) {
      console.error('Assign distributor failed:', error)
      addToast(`Couldn't save distributor: ${error.message}`, 'red', 'Save Failed')
      return
    }
    setAuctions(prev => prev.map(a => a.id === auctionId ? { ...a, distributedBy: value } : a))
    if (value) addToast(`Distributor set: ${value}.`, 'gold', 'Updated')
    else addToast(`Distributor cleared.`, 'blue', 'Updated')
  }

  const deleteAuction = async (auctionId) => {
    if (!isElder) return
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return
    const refundNote = auction.status === 'active' && auction.topBidder
      ? `\n\n${auction.topBidder} will be refunded ${auction.currentBid.toLocaleString()} coins.`
      : ''
    if (!window.confirm(`Delete "${auction.name}" permanently?${refundNote}`)) return

    if (auction.status === 'active' && auction.topBidder && auction.currentBid > 0) {
      const bidder = members.find(m => m.name === auction.topBidder)
      if (bidder) {
        const { error: refundErr } = await supabase
          .from('members')
          .update({ coins: bidder.coins + auction.currentBid })
          .eq('id', bidder.id)
        if (!refundErr) {
          setMembers(prev => prev.map(m =>
            m.id === bidder.id ? { ...m, coins: m.coins + auction.currentBid } : m
          ))
        }
      }
    }

    const { error } = await supabase.from('auctions').delete().eq('id', auctionId)
    if (error) {
      console.error('Delete auction failed:', error)
      addToast(`Couldn't delete auction: ${error.message}`, 'red', 'Delete Failed')
      return
    }
    setAuctions(prev => prev.filter(a => a.id !== auctionId))
    addToast(`"${auction.name}" removed.`, 'red', 'Auction Deleted')
  }

  const toggleBidsExpanded = (id) => setExpandedBids(prev => ({ ...prev, [id]: !prev[id] }))

  const activeAuctions = useMemo(() => auctions.filter(a => a.status === 'active'), [auctions])
  const endedAuctions = useMemo(
    () => [...auctions.filter(a => a.status === 'ended')].sort((a, b) => {
      const ax = a.endedAt || a.endsAt || 0
      const bx = b.endedAt || b.endsAt || 0
      return bx - ax
    }),
    [auctions]
  )
  const pendingDistribution = useMemo(
    () => endedAuctions.filter(a => a.topBidder && !a.distributedBy).length,
    [endedAuctions]
  )

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-spectral text-2xl font-bold text-gold-light mb-2">Auctions</h1>
          <p className="text-text-dim text-sm">{activeAuctions.length} active, {endedAuctions.length} ended</p>
        </div>

        <div className="flex items-stretch gap-2 flex-wrap">
          {/* Region picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen(o => !o)}
              className={`card px-3 py-2 border-gold/30 flex items-center gap-3 h-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 min-w-[190px] ${
                pickerOpen ? 'border-gold/60 bg-gold/[0.06]' : 'hover:border-gold/50'
              }`}
              aria-expanded={pickerOpen}
              aria-label={`Region: ${activeRegion.name}. Click to change.`}
            >
              <span className="text-base leading-none" aria-hidden="true">🌍</span>
              <FlagImage code={activeRegion.code} flag={activeRegion.flag} name={activeRegion.name} width={20} height={15} />
              <div className="text-left flex-1 min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-widest text-gold-dim leading-tight">
                  Your local
                </div>
                <div className="font-mono text-xs text-gold-bright tabular-nums whitespace-nowrap leading-tight">
                  {formatShortInZone(now, activeRegion.tz)}
                </div>
              </div>
              <span
                className={`text-[10px] text-text-dim transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>

            {pickerOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-[260px] rounded-lg border border-gold/30 bg-dark shadow-xl overflow-hidden z-50"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}
              >
                <div className="px-4 py-2 border-b border-gold/15 bg-void/40">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gold-light">
                    🌍 Region
                  </div>
                </div>
                <ul>
                  {regions.map(r => {
                    const isActive = r.id === activeRegion.id
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => pickRegion(r.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 ${
                            isActive
                              ? 'bg-gold/15 text-gold-bright'
                              : 'text-text hover:bg-gold/10 hover:text-gold-light'
                          }`}
                          aria-pressed={isActive}
                        >
                          <FlagImage code={r.code} flag={r.flag} name={r.name} />
                          <span className="flex-1 min-w-0 text-xs font-semibold truncate">
                            {r.name || r.label || r.id}
                          </span>
                          <span className={`flex-shrink-0 text-[10px] font-mono ${isActive ? 'text-gold-bright' : 'text-text-dim'}`}>
                            {r.label || ''}
                          </span>
                          {isActive && (
                            <span className="text-gold-bright text-xs flex-shrink-0" aria-hidden="true">✓</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Server clock */}
          <div className="card px-3 py-2 border-gold/30 flex items-center gap-3 min-w-[190px]">
            <div className="text-lg leading-none" aria-hidden="true">🕒</div>
            <div className="text-left">
              <div className="text-[9px] font-bold uppercase tracking-widest text-gold-dim leading-tight">
                Server · {SERVER_TZ_LABEL}
              </div>
              <div className="font-mono text-xs text-gold-bright tabular-nums whitespace-nowrap leading-tight">
                {formatServerClock(now)}
              </div>
            </div>
          </div>

          {isElder && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="btn-gold whitespace-nowrap h-full"
              aria-expanded={showCreate}
            >
              {showCreate ? '✕ Cancel' : '+ Create auction'}
            </button>
          )}
        </div>
      </div>

      <div className="card mb-4 border-gold/20 bg-void/40">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-dim">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true">🔒</span><span>Bids lock 5 min before end</span>
          </span>
          <span className="text-gold/20" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true">📈</span><span>Min increment: +{MIN_BID_INCREMENT} coins</span>
          </span>
          <span className="text-gold/20" aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setShowLegend(v => !v)}
            aria-expanded={showLegend}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full border border-gold/30 bg-gold/10 text-gold-light hover:text-gold-bright hover:bg-gold/15 hover:border-gold/50 px-3 py-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
          >
            <span aria-hidden="true" className="text-sm leading-none">💡</span>
            <span>{showLegend ? 'Hide help' : 'How distribution works'}</span>
            <span aria-hidden="true" className={`text-[9px] leading-none transition-transform ${showLegend ? 'rotate-180' : ''}`}>▼</span>
          </button>
        </div>

        {showLegend && (
          <div className="mt-3 pt-3 border-t border-gold/10 text-xs text-text-dim space-y-2">
            <p className="flex items-start gap-2">
              <span className="text-base leading-none flex-shrink-0" aria-hidden="true">🎁</span>
              <span><span className="text-gold-light font-semibold">Distributed by</span> shows which Master or Elder has handed the winning item to the winner in-game.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-base leading-none flex-shrink-0" aria-hidden="true">⏳</span>
              <span><span className="text-yellow-400 font-semibold">Awaiting hand-out</span> — the winner hasn't received the item yet. An admin will mark it once delivered.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-base leading-none flex-shrink-0" aria-hidden="true">✓</span>
              <span><span className="text-green-400 font-semibold">Name</span> — delivered by that admin.{' '}<span className="text-text-dim font-semibold">⏱ System</span> means the auction ended automatically without a human handing it out.</span>
            </p>
          </div>
        )}
      </div>

      {isElder && pendingDistribution > 0 && (
        <div className="card mb-4 border-yellow-500/30 bg-yellow-500/[0.04]">
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <span aria-hidden="true">⚠️</span>
            <span className="font-semibold">
              {pendingDistribution} won {pendingDistribution === 1 ? 'item is' : 'items are'} still waiting for a distributor. Pick who handed it out below.
            </span>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="card mb-6 border-gold/40">
          <div className="text-sm font-semibold text-text-bright mb-4">New auction</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor={`${formId}-name`} className="block text-xs text-text-dim font-semibold mb-1">Item name</label>
              <input
                id={`${formId}-name`}
                className="input"
                placeholder="e.g. Kari Top / Bound"
                value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor={`${formId}-rarity`} className="block text-xs text-text-dim font-semibold mb-1">Rarity</label>
              <select
                id={`${formId}-rarity`}
                className="input"
                value={newItem.rarity}
                onChange={e => setNewItem({ ...newItem, rarity: e.target.value })}
              >
                {Object.entries(RARITY).map(([key, r]) => (
                  <option key={key} value={key}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor={`${formId}-desc`} className="block text-xs text-text-dim font-semibold mb-1">Description (optional)</label>
            <select
              id={`${formId}-desc`}
              className="input"
              value={descChoice}
              onChange={e => {
                setDescChoice(e.target.value)
                if (e.target.value !== 'Custom...') setCustomDesc('')
              }}
            >
              {presetDescriptions.map(d => (
                <option key={d} value={d}>{d === '' ? 'No description' : d}</option>
              ))}
            </select>
            {descChoice === 'Custom...' && (
              <input
                className="input mt-2"
                aria-label="Custom description"
                placeholder="Type your custom description..."
                value={customDesc}
                onChange={e => setCustomDesc(e.target.value)}
                maxLength={100}
                autoFocus
              />
            )}
          </div>

          <div className="mb-4">
            <label htmlFor={fileInputId} className="block text-xs text-text-dim font-semibold mb-1">
              Item image (optional)
            </label>

            <div className="flex items-center gap-3 rounded border border-gold/25 bg-void/40 px-3 py-2">
              <input
                id={fileInputId}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleImageChange}
                disabled={uploading}
                className="sr-only"
              />

              <label
                htmlFor={fileInputId}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded border px-3 py-1.5 cursor-pointer transition-colors ${
                  uploading
                    ? 'border-gold/20 text-text-dim cursor-not-allowed'
                    : 'border-gold/40 text-gold-light hover:bg-gold/10 hover:text-gold-bright'
                }`}
                aria-disabled={uploading}
              >
                <span aria-hidden="true">📁</span>
                <span>Choose file</span>
              </label>

              <span className="text-xs text-text-dim truncate flex-1 min-w-0">
                {imageFile ? imageFile.name : 'No file chosen'}
              </span>

              {imageFile && (
                <button
                  type="button"
                  onClick={clearImage}
                  disabled={uploading}
                  className="text-[11px] font-semibold rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 px-2.5 py-1 transition-colors disabled:opacity-40 flex-shrink-0"
                  aria-label="Clear selected image"
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {imagePreview && (
              <div className="mt-3 flex justify-start">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-[200px] w-auto h-auto max-w-full rounded border border-gold/25"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor={`${formId}-bid`} className="block text-xs text-text-dim font-semibold mb-1">Starting bid</label>
              <div className="flex items-center gap-2">
                <input
                  id={`${formId}-bid`}
                  className="input flex-1"
                  type="number"
                  min="1"
                  placeholder="100"
                  value={newItem.startBid}
                  onChange={e => setNewItem({ ...newItem, startBid: e.target.value })}
                />
                <span className="text-xs text-text-dim whitespace-nowrap">coins</span>
              </div>
            </div>
            <div>
              <label htmlFor={`${formId}-duration`} className="block text-xs text-text-dim font-semibold mb-1">Duration</label>
              <div className="flex items-center gap-2">
                <input
                  id={`${formId}-duration`}
                  className="input flex-1"
                  type="number"
                  min="1"
                  placeholder="60"
                  value={newItem.duration}
                  onChange={e => setNewItem({ ...newItem, duration: e.target.value })}
                />
                <span className="text-xs text-text-dim whitespace-nowrap">minutes</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={createAuction} className="btn-gold" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Start auction'}
            </button>
            {parseInt(newItem.duration) > 0 && (
              <span className="text-xs text-text-dim flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Ends</span>
                <span className="font-mono text-gold-light">
                  {formatTimeInZone(Date.now() + (parseInt(newItem.duration) || 60) * 60000, SERVER_TZ)} server
                </span>
                <span className="text-text-dim/50">·</span>
                <span className="font-mono text-gold-light inline-flex items-center gap-1">
                  <FlagImage
                    code={activeRegion.code}
                    flag={activeRegion.flag}
                    name={activeRegion.name}
                    width={14}
                    height={10}
                  />
                  {formatTimeInZone(Date.now() + (parseInt(newItem.duration) || 60) * 60000, activeRegion.tz)} local
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {activeAuctions.length === 0 ? (
        <div className="card text-center py-12 text-text-dim">No active auctions.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {activeAuctions.map(auction => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              now={now}
              currentUser={currentUser}
              isElder={isElder}
              isMaster={isMaster}
              bidAmount={bidAmounts[auction.id] || ''}
              onBidChange={v => setBidAmounts(prev => ({ ...prev, [auction.id]: v }))}
              onPlaceBid={() => placeBid(auction.id)}
              onEndEarly={() => endAuction(auction.id)}
              onDelete={() => deleteAuction(auction.id)}
              isBidsExpanded={!!expandedBids[auction.id]}
              onToggleBids={() => toggleBidsExpanded(auction.id)}
              activeRegion={activeRegion}
            />
          ))}
        </div>
      )}

      {endedAuctions.length > 0 && (
        <section className="mt-8">
          <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="font-spectral text-xl font-bold text-text-bright">Ended auctions</h2>
              <span className="text-[11px] font-semibold text-text-dim bg-void/60 border border-gold/20 rounded px-2 py-0.5">{endedAuctions.length}</span>
            </div>
            <div className="text-[11px] text-text-dim hidden md:flex items-center gap-3">
              <span><span className="text-yellow-400">⏳</span> awaiting hand-out</span>
              <span><span className="text-green-400">✓</span> delivered</span>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <ul className="divide-y divide-gold/10">
              {endedAuctions.map(a => (
                <EndedAuctionRow
                  key={a.id}
                  auction={a}
                  now={now}
                  currentUser={currentUser}
                  isElder={isElder}
                  distributors={distributors}
                  isExpanded={!!expandedBids[a.id]}
                  onToggle={() => toggleBidsExpanded(a.id)}
                  onAssignDistributor={(name) => assignDistributor(a.id, name)}
                  onDelete={() => deleteAuction(a.id)}
                  activeRegion={activeRegion}
                />
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */

function RarityBadge({ rarity }) {
  const rm = getRarityMeta(rarity)
  return (
    <span
      className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: rm.color, backgroundColor: rgba(rm.rgb, 0.12) }}
    >
      {rm.label}
    </span>
  )
}

function AuctionCard({
  auction, now, currentUser, isElder, isMaster,
  bidAmount, onBidChange, onPlaceBid, onEndEarly, onDelete,
  isBidsExpanded, onToggleBids, activeRegion,
}) {
  const isWinning = auction.topBidder === currentUser?.name
  const bids = auction.bids || []
  const history = useMemo(() => [...bids].reverse(), [bids])
  const rm = getRarityMeta(auction.rarity)
  const remaining = auction.endsAt - now
  const isUrgent = remaining > 0 && remaining < URGENT_MS
  const glow = GLOW_RARITIES.has(auction.rarity)
  const biddingOpen = isBiddingOpen(auction, now)
  const minNextBid = auction.currentBid + MIN_BID_INCREMENT

  return (
    <div
      className={`card border-l-4 ${isWinning ? 'bg-green-500/5' : ''}`}
      style={{
        borderLeftColor: isWinning ? '#22c55e' : rm.color,
        boxShadow: glow && !isWinning ? `0 0 16px ${rgba(rm.rgb, 0.12)}` : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        {auction.imageUrl && (
          <ItemImage src={auction.imageUrl} alt={auction.name} size={64} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold truncate" style={{ color: rm.color }}>{auction.name}</div>
              <div className="mt-1"><RarityBadge rarity={auction.rarity} /></div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-text-dim">Ends in</div>
              <div className={`font-bold text-red-400 ${isUrgent ? 'motion-safe:animate-pulse' : ''}`}>
                {formatCountdown(auction.endsAt, now)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {auction.description && (
        <div className="text-xs text-text-dim mt-2 italic">{auction.description}</div>
      )}

      {activeRegion && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-dim">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <span aria-hidden="true">🕒</span>
            <span className="font-mono text-gold-light">
              {formatDateTimeInZone(auction.endsAt, SERVER_TZ)}
            </span>
            <span>server</span>
          </span>
          <span className="text-gold/20" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <FlagImage
              code={activeRegion.code}
              flag={activeRegion.flag}
              name={activeRegion.name}
              width={14}
              height={10}
            />
            <span className="font-mono text-gold-light">
              {formatDateTimeInZone(auction.endsAt, activeRegion.tz)}
            </span>
            <span>local</span>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div>
          <div className="text-xs text-text-dim">Current bid</div>
          <div className="text-xl font-bold text-gold-bright tabular-nums">{auction.currentBid.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-dim">Top bidder</div>
          <div className="font-semibold text-text-bright">{auction.topBidder || '—'}</div>
        </div>
      </div>

      {isWinning && (
        <div className="mt-2 text-[11px] font-semibold text-green-400">✓ You're leading</div>
      )}

      {currentUser && auction.status === 'active' && (
        biddingOpen ? (
          <div className="mt-3">
            <div className="flex gap-2">
              <label htmlFor={`bid-${auction.id}`} className="sr-only">Bid amount for {auction.name}</label>
              <input
                id={`bid-${auction.id}`}
                className="input text-sm flex-1"
                type="number"
                min={minNextBid}
                step={MIN_BID_INCREMENT}
                placeholder={`Min ${minNextBid.toLocaleString()}`}
                value={bidAmount}
                onChange={e => onBidChange(e.target.value)}
                onFocus={e => { if (!e.target.value) onBidChange(String(minNextBid)) }}
              />
              <button onClick={onPlaceBid} className="btn-gold text-sm px-3">Bid</button>
            </div>
            <div className="text-[10px] text-text-dim mt-1">
              Minimum bid: <span className="text-gold-light font-semibold">{minNextBid.toLocaleString()}</span> coins
              <span className="text-text-dim"> · pre-filled for you</span>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-center">
            <div className="text-xs font-semibold text-red-400">🔒 Bidding closed</div>
            <div className="text-[10px] text-text-dim mt-0.5">Final 5 minutes — waiting for the auction to end.</div>
          </div>
        )
      )}

      {history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gold/10">
          <button
            type="button"
            onClick={onToggleBids}
            aria-expanded={isBidsExpanded}
            className="text-[11px] font-semibold text-gold-light hover:text-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 rounded"
          >
            {isBidsExpanded ? '▲ Hide bid history' : `▼ Show bid history (${history.length})`}
          </button>

          {isBidsExpanded && (
            <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1 mt-2" role="list">
              {history.map((b, idx) => {
                const isCurrentTop = idx === 0
                return (
                  <div
                    key={b.time || idx}
                    role="listitem"
                    className={`text-xs rounded px-2 py-1.5 ${isCurrentTop ? 'bg-green-500/10 border border-green-500/30' : 'bg-void/40 border border-gold/10'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold truncate ${isCurrentTop ? 'text-green-300' : 'text-text-dim line-through'}`}>{b.bidder}</span>
                      <span className={`font-bold flex-shrink-0 ${isCurrentTop ? 'text-green-300' : 'text-text-dim line-through'}`}>{b.amount.toLocaleString()}</span>
                    </div>
                    <div className={`text-[11px] mt-0.5 ${isCurrentTop ? 'text-green-400' : 'text-text-dim'}`}>
                      {isCurrentTop ? (auction.topBidder === currentUser?.name ? 'winning' : 'leading') : 'outbid'} at {formatClock(b.time)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {isElder && (
        <div className="flex gap-3 mt-3 pt-2 border-t border-gold/10">
          {isMaster && (
            <button
              onClick={onEndEarly}
              className="text-xs text-yellow-400 hover:text-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 rounded"
            >
              End early
            </button>
          )}
          <button
            onClick={onDelete}
            aria-label={`Delete auction: ${auction.name}`}
            className="text-xs text-red-400 hover:text-red-300 ml-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 rounded"
          >
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  )
}

function EndedAuctionRow({
  auction: a, now, currentUser, isElder, distributors,
  isExpanded, onToggle, onAssignDistributor, onDelete, activeRegion,
}) {
  const bids = a.bids || []
  const totalBids = bids.length
  const rm = getRarityMeta(a.rarity)
  const winner = a.topBidder
  const isMe = winner && currentUser?.name === winner
  const endedAt = a.endedAt || a.endsAt || 0
  const agoLabel = endedAt > 0 ? formatRelativePast(now - endedAt) : ''
  const assignedName = a.distributedBy || ''

  return (
    <li className={`${isMe ? 'bg-green-500/[0.04]' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-void/30 transition-colors">
        {a.imageUrl && <ItemImage src={a.imageUrl} alt={a.name} size={40} />}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: rm.color }} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate" style={{ color: rm.color }}>{a.name}</span>
              <RarityBadge rarity={a.rarity} />
              {isMe && (
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">🎉 You won</span>
              )}
            </div>
            {a.description && (
              <div className="text-[11px] text-text-dim italic truncate mt-0.5">{a.description}</div>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1.5 flex-shrink-0 min-w-0" title="Winner">
          <span className="text-sm" aria-hidden="true">🏆</span>
          <span className={`text-xs font-semibold truncate max-w-[120px] ${isMe ? 'text-green-400' : 'text-text-bright'}`}>
            {winner || <span className="italic text-text-dim font-normal">No bids</span>}
          </span>
        </div>

        {winner && (
          <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0 min-w-0" title="Distributed by">
            <span className="text-sm" aria-hidden="true">🎁</span>
            {isElder ? (
              <select
                className="input text-[11px] py-0.5 px-2 h-6 min-w-0 max-w-[160px]"
                value={assignedName}
                onChange={e => onAssignDistributor(e.target.value)}
                aria-label={`Distributor for ${a.name}`}
              >
                <option value="">— Not yet —</option>
                {distributors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            ) : (
              <DistributorStatusBadge name={assignedName} />
            )}
          </div>
        )}

        <div className="hidden sm:flex items-baseline gap-1 flex-shrink-0">
          <span className="font-mono font-bold text-gold-bright tabular-nums text-sm">{(a.currentBid || 0).toLocaleString()}</span>
          <span className="text-[10px] text-text-dim">coins</span>
        </div>

        {agoLabel && (
          <span className="text-[11px] text-text-dim flex-shrink-0 hidden sm:inline">{agoLabel}</span>
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
          {totalBids > 0 && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Hide bid history' : `Show bid history (${totalBids})`}
              className="text-[11px] text-gold-light hover:text-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 rounded px-1.5 py-1 flex items-center gap-1"
            >
              <span aria-hidden="true">{isExpanded ? '▲' : '▼'}</span>
              <span className="hidden md:inline">{totalBids}</span>
            </button>
          )}
          {isElder && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete auction: ${a.name}`}
              className="text-[11px] text-red-400 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 rounded px-1.5 py-1"
            >
              🗑
            </button>
          )}
        </div>
      </div>

      <div className="md:hidden flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-2 text-xs">
        {winner && (
          <span className="flex items-center gap-1">
            <span aria-hidden="true">🏆</span>
            <span className={`font-semibold ${isMe ? 'text-green-400' : 'text-text-bright'}`}>{winner}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="font-mono font-bold text-gold-bright tabular-nums">{(a.currentBid || 0).toLocaleString()}</span>
          <span className="text-text-dim">coins</span>
        </span>
        {agoLabel && <span className="text-text-dim">{agoLabel}</span>}
      </div>

      {winner && (
        <div className="lg:hidden flex items-center gap-2 px-4 pb-3 text-xs">
          <span aria-hidden="true">🎁</span>
          <span className="text-text-dim flex-shrink-0">Distributed by</span>
          {isElder ? (
            <select
              className="input text-[11px] py-0.5 px-2 h-7 flex-1 min-w-0"
              value={assignedName}
              onChange={e => onAssignDistributor(e.target.value)}
              aria-label={`Distributor for ${a.name}`}
            >
              <option value="">— Not yet —</option>
              {distributors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          ) : (
            <DistributorStatusBadge name={assignedName} />
          )}
        </div>
      )}

      {isExpanded && totalBids > 0 && (
        <div className="px-4 pb-3">
          <div className="rounded-lg bg-void/40 border border-gold/10 overflow-hidden">
            <ul className="divide-y divide-gold/5">
              {bids.map((b, idx) => {
                const isLast = idx === bids.length - 1
                return (
                  <li
                    key={b.time || idx}
                    className={`flex items-center gap-3 px-3 py-1.5 text-xs ${isLast ? 'bg-green-500/[0.06]' : ''}`}
                  >
                    <span className={`font-mono tabular-nums flex-shrink-0 ${isLast ? 'text-green-400' : 'text-text-dim'}`}>{formatClock(b.time)}</span>
                    <span className={`font-semibold truncate flex-1 ${isLast ? 'text-green-300' : 'text-text-dim'}`}>{b.bidder}</span>
                    <span className={`font-mono font-bold tabular-nums flex-shrink-0 ${isLast ? 'text-green-300' : 'text-text-dim'}`}>{b.amount.toLocaleString()}</span>
                    {isLast && <span className="text-[10px] font-bold text-green-400 uppercase flex-shrink-0">Won</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="px-4 pb-3 text-[10px] text-text-dim flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>Ended {endedAt > 0 ? formatDateTime(endedAt) : '—'} (server)</span>
          {activeRegion && endedAt > 0 && (
            <>
              <span className="text-gold/20" aria-hidden="true">·</span>
              <FlagImage
                code={activeRegion.code}
                flag={activeRegion.flag}
                name={activeRegion.name}
                width={14}
                height={10}
              />
              <span>{formatDateTimeInZone(endedAt, activeRegion.tz)} (local)</span>
            </>
          )}
        </div>
      )}
    </li>
  )
}