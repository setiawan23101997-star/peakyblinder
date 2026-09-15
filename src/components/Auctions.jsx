import React, { useState, useEffect, useMemo, useId, useRef } from 'react'

const RARITY = {
  material:   { label: 'Material',  color: '#ffffff', rgb: '255,255,255' },
  common:   { label: 'Common',    color: '#4ade80', rgb: '74,222,128' },
  uncommon:   { label: 'Uncommon',  color: '#ffffff', rgb: '255,255,255' },
  rare:       { label: 'Rare',      color: '#60a5fa', rgb: '96,165,250' },
  epic:       { label: 'Epic',      color: '#f87171', rgb: '248,113,113' },
  legendary:  { label: 'Legendary', color: '#f2cc60', rgb: '242,204,76' },
}

const GLOW_RARITIES = new Set(['legendary'])
const URGENT_MS = 5 * 60 * 1000
const BID_LOCK_MS = 30 * 1000
const MAX_BID_CHANGES = 2
const MAX_BID_SUBMISSIONS = 1 + MAX_BID_CHANGES

const SERVER_TZ_LABEL = 'UTC+08:00 (GMT+8)'
const SERVER_TZ_SHORT = 'UTC+08:00'
const SERVER_TZ_NAME = 'GMT+8'

// The auction clock is intentionally anchored to the game's fixed UTC+8 server time.
// All displayed auction timestamps are converted to this server wall-clock time.
function ServerTimeLabel({ compact = false }) {
  return compact ? SERVER_TZ_SHORT : `${SERVER_TZ_LABEL}`
}

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

const IMAGE_BUCKET = 'auction-images'

function rgba(rgb, alpha) { return `rgba(${rgb}, ${alpha})` }
function getRarityMeta(rarity) { return RARITY[rarity] || RARITY.epic }

const SERVER_OFFSET_MIN = 8 * 60
const MONTH_SHORT_ARR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toMs(ts) {
  if (ts instanceof Date) {
    const n = ts.getTime()
    return Number.isFinite(n) ? n : 0
  }
  const n = Number(ts)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function pad2(n) { return n < 10 ? `0${n}` : String(n) }

function serverParts(ts) {
  const ms = toMs(ts)
  if (!ms) return null
  const shifted = new Date(ms + SERVER_OFFSET_MIN * 60 * 1000)
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    hh: shifted.getUTCHours(),
    mm: shifted.getUTCMinutes(),
    ss: shifted.getUTCSeconds(),
  }
}

function to12Hour(hh) {
  const h = Number(hh)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return { hour: pad2(hour), suffix }
}

function formatServerClock(ts) {
  const p = serverParts(ts)
  if (!p) return '—'
  const t = to12Hour(p.hh)
  return `${pad2(p.d)} ${MONTH_SHORT_ARR[p.m]} ${p.y}, ${t.hour}:${pad2(p.mm)}:${pad2(p.ss)} ${t.suffix}`
}

function formatClock(ts) {
  const p = serverParts(ts)
  if (!p) return '—'
  const t = to12Hour(p.hh)
  return `${t.hour}:${pad2(p.mm)} ${t.suffix}`
}

function formatDateTime(ts) {
  const p = serverParts(ts)
  if (!p) return '—'
  const t = to12Hour(p.hh)
  return `${pad2(p.d)} ${MONTH_SHORT_ARR[p.m]}, ${t.hour}:${pad2(p.mm)} ${t.suffix}`
}

// Every player sees a second, automatic local-time view based on the
// timezone configured by their browser/device. Auction timestamps remain
// stored as epoch milliseconds, so no timezone-specific data is written
// into the auction itself.
const LOCAL_TIME_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time'
  } catch {
    return 'Local Time'
  }
})()

function localParts(ts) {
  const ms = toMs(ts)
  if (!ms) return null

  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: LOCAL_TIME_ZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      hourCycle: 'h12',
    }).formatToParts(new Date(ms))

    const get = type => parts.find(p => p.type === type)?.value || ''
    return {
      y: get('year'),
      m: get('month'),
      d: get('day'),
      hh: get('hour'),
      mm: get('minute'),
      dayPeriod: get('dayPeriod'),
    }
  } catch {
    return null
  }
}

function localTimeZoneOffset(ts = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: LOCAL_TIME_ZONE,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date(toMs(ts) || Date.now()))
    return parts.find(p => p.type === 'timeZoneName')?.value || LOCAL_TIME_ZONE
  } catch {
    return LOCAL_TIME_ZONE
  }
}

function formatLocalClock(ts) {
  const p = localParts(ts)
  if (!p) return '—'
  return `${p.hh}:${p.mm} ${p.dayPeriod}`
}

function formatLocalDateTime(ts) {
  const p = localParts(ts)
  if (!p) return '—'
  return `${p.d} ${p.m}, ${p.y}, ${p.hh}:${p.mm} ${p.dayPeriod}`
}

function formatLocalTimeLabel(ts = Date.now()) {
  return `${LOCAL_TIME_ZONE} · ${localTimeZoneOffset(ts)}`
}

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
  return auction.status === 'active' && (auction.endsAt - now) > BID_LOCK_MS
}

function getStartingBid(auction) {
  return Number(auction?.startBid ?? auction?.minBid ?? auction?.currentBid ?? 0) || 0
}

// Blind auctions do not have an open "current highest bid".
// The only minimum is the auction's starting bid.
function minNextBidFor(auction) {
  return getStartingBid(auction)
}

function getOwnBidState(auction, memberName) {
  const bids = Array.isArray(auction?.bids) ? auction.bids : []
  const mine = bids.filter(b => b?.bidder === memberName)
  const last = mine[mine.length - 1] || null
  if (last?.cancelled) {
    return { hasBid: false, amount: 0, submissions: 0, changesUsed: 0, changesLeft: 0, cancelled: true }
  }
  const submissions = mine.filter(b => !b?.cancelled)
  const changesUsed = Math.max(0, submissions.length - 1)
  return {
    hasBid: submissions.length > 0,
    amount: Number(last?.amount) || 0,
    submissions: submissions.length,
    changesUsed,
    changesLeft: Math.max(0, MAX_BID_CHANGES - changesUsed),
    cancelled: false,
  }
}

function getFinalBidEntries(auction) {
  const bids = Array.isArray(auction?.bids) ? auction.bids : []
  const latestByBidder = new Map()
  for (const bid of bids) {
    if (!bid?.bidder) continue
    latestByBidder.set(bid.bidder, bid)
  }
  return [...latestByBidder.values()]
    .filter(b => !b.cancelled && Number(b.amount) > 0)
    .map(b => ({ ...b, amount: Number(b.amount) || 0, time: Number(b.time) || 0 }))
    .sort((a, b) => b.amount - a.amount || a.time - b.time)
}

function getAuctionWinner(auction) {
  return getFinalBidEntries(auction)[0] || null
}

function getBidderCount(auction) {
  return getFinalBidEntries(auction).length
}

function displayNameForLibraryImage(img) {
  if (!img) return ''
  if (img.displayName) return img.displayName
  const base = (img.name || '').split('/').pop()
  const m = base.match(/^(\d+)-[a-z0-9]+\.([a-z0-9]+)$/i)
  if (m) return `image-${m[1]}.${m[2]}`
  return base
}

function FeaturedPill({ rarityMeta, small = false }) {
  const rm = rarityMeta
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-widest rounded-full whitespace-nowrap ${
        small ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'
      }`}
      style={{
        background: `linear-gradient(135deg, ${rm.color} 0%, ${rgba(rm.rgb, 0.7)} 100%)`,
        color: '#0a0706',
        boxShadow: `0 0 0 1px ${rgba(rm.rgb, 0.45)}, 0 4px 14px -4px ${rgba(rm.rgb, 0.6)}`,
      }}
    >
      <svg
        width={small ? 8 : 10}
        height={small ? 8 : 10}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span>Featured</span>
    </span>
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
  } = ctx

  const currentMember = useMemo(
    () => (Array.isArray(members) ? members.find(m => m?.name === currentUser?.name) : null),
    [members, currentUser?.name]
  )
  const currentCoins = Math.max(0, Number(currentMember?.coins) || 0)

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
  const [pickedLibraryImg, setPickedLibraryImg] = useState(null)
  const [libraryImages, setLibraryImages] = useState([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState(null)
  const [deletingImageName, setDeletingImageName] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [bidAmounts, setBidAmounts] = useState({})
  const [expandedBids, setExpandedBids] = useState({})
  const [selectedEndedAuctions, setSelectedEndedAuctions] = useState([])
  const [featuringInFlight, setFeaturingInFlight] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const formId = useId()
  const fileInputId = `${formId}-image`
  const libraryLoadRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setBidAmounts(prev => {
      const next = { ...prev }
      let changed = false
      for (const a of (Array.isArray(auctions) ? auctions : [])) {
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

  useEffect(() => {
    if (!showCreate) return
    if (libraryLoadRef.current) return
    libraryLoadRef.current = true
    loadLibrary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate])

  const loadLibrary = async () => {
    if (!supabase) return
    setLibraryLoading(true)
    setLibraryError(null)
    try {
      const { data, error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .list('', {
          limit: 200,
          sortBy: { column: 'created_at', order: 'desc' },
        })
      if (error) throw error

      const items = (data || [])
        .filter(f => f.name && !f.name.startsWith('.'))
        .map(f => {
          const { data: urlData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(f.name)
          return {
            name: f.name,
            displayName: displayNameForLibraryImage({ name: f.name }),
            url: urlData?.publicUrl || '',
            createdAt: f.created_at || f.updated_at || null,
          }
        })
        .filter(f => f.url)

      setLibraryImages(items)
    } catch (err) {
      console.error('Load image library failed:', err)
      setLibraryError(err.message || 'Failed to load image library')
    } finally {
      setLibraryLoading(false)
    }
  }

  const deleteLibraryImage = async (img) => {
    if (!supabase) return
    const fileName = img?.name
    if (!fileName) return

    if (!window.confirm(`Delete this image permanently?\n\n${displayNameForLibraryImage(img)}\n\nThis removes it from storage. Any auction already using it will keep its picture, but you won't be able to reuse it here.`)) {
      return
    }

    setDeletingImageName(fileName)
    try {
      const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([fileName])
      if (error) throw error

      setLibraryImages(prev => prev.filter(p => p.name !== fileName))
      if (pickedLibraryImg?.name === fileName) {
        setPickedLibraryImg(null)
        setImagePreview(prev => (prev === img.url ? null : prev))
      }
      addToast('Image deleted from library.', 'red', 'Deleted')
    } catch (err) {
      console.error('Delete image failed:', err)
      addToast(`Couldn't delete image: ${err.message}`, 'red', 'Delete Failed')
    } finally {
      setDeletingImageName(null)
    }
  }

  const isElder = currentUser?.role === 'Elder' || currentUser?.role === 'Master' || currentUser?.role === 'Admin'
  const isMaster = currentUser?.role === 'Master' || currentUser?.role === 'Admin'

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
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setPickedLibraryImg(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const pickFromLibrary = (img) => {
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setPickedLibraryImg({ name: img.name, url: img.url, displayName: img.displayName })
    setImagePreview(img.url)
  }

  const clearImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setPickedLibraryImg(null)
    setImagePreview(null)
  }

  const uploadImage = async () => {
    if (pickedLibraryImg) return pickedLibraryImg.url
    if (!imageFile) return null
    const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, imageFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: imageFile.type,
      })

    if (error) throw error

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
    const url = data?.publicUrl || null
    if (url) {
      setLibraryImages(prev => [
        { name: path, url, createdAt: new Date().toISOString(), displayName: imageFile.name },
        ...prev.filter(p => p.url !== url),
      ])
    }
    return url
  }

  const createAuction = async () => {
    const itemName = String(newItem?.name ?? '').trim()
    if (!itemName) {
      addToast('Enter an item name.', 'red', 'Error')
      return
    }

    if (!supabase) {
      addToast('Database connection is unavailable.', 'red', 'Connection Error')
      return
    }

    const startBid = Math.max(1, parseInt(newItem?.startBid, 10) || 100)
    const durationMin = Math.max(1, parseInt(newItem?.duration, 10) || 60)
    const startedAt = Date.now()
    const endsAt = startedAt + durationMin * 60 * 1000
    const id = String(startedAt)
    const description = finalDescription || null

    setUploading(true)

    try {
      const imageUrl = await uploadImage()

      const payload = {
        id,
        name: itemName,
        description,
        rarity: newItem?.rarity || 'epic',
        status: 'active',
        started_at: startedAt,
        ends_at: endsAt,
        current_bid: startBid,
        min_bid: startBid,
        top_bidder: null,
        bids: [],
        distributed_by: null,
        image_url: imageUrl,
        is_featured: false,
      }

      // The payload is already complete. Do not chain .select() here:
      // INSERT + SELECT can fail under an RLS policy that permits INSERT
      // but does not permit the client to read the inserted row back.
      const { error } = await supabase
        .from('auctions')
        .insert([payload])

      if (error) throw error

      const row = payload

      const newAuction = {
        id: String(row.id ?? id),
        name: row.name ?? itemName,
        description: row.description ?? '',
        rarity: row.rarity ?? payload.rarity,
        status: row.status ?? 'active',
        currentBid: Number(row.current_bid ?? startBid) || startBid,
        startBid: Number(row.min_bid ?? startBid) || startBid,
        topBidder: row.top_bidder ?? null,
        endsAt: Number(row.ends_at ?? endsAt) || endsAt,
        startedAt: Number(row.started_at ?? startedAt) || startedAt,
        endedAt: Number(row.ended_at ?? 0) || 0,
        bids: Array.isArray(row.bids)
          ? row.bids
          : (typeof row.bids === 'string'
              ? (() => { try { return JSON.parse(row.bids) || [] } catch { return [] } })()
              : []),
        distributedBy: row.distributed_by ?? null,
        imageUrl: row.image_url ?? imageUrl ?? null,
        isFeatured: row.is_featured === true,
      }

      setAuctions(prev => {
        const safePrev = Array.isArray(prev) ? prev : []
        return [newAuction, ...safePrev.filter(a => String(a?.id) !== String(newAuction.id))]
      })

      setNewItem({
        name: '',
        description: '',
        rarity: 'epic',
        startBid: 100,
        duration: 60,
      })
      setDescChoice('')
      setCustomDesc('')
      clearImage()
      setShowCreate(false)

      addToast(`"${itemName}" is now up for auction!`, 'gold', 'Auction Live')
    } catch (err) {
      console.error('Create auction failed:', err)
      addToast(
        `Couldn't start auction: ${err?.message || 'Unknown error'}`,
        'red',
        'Auction Not Started'
      )
    } finally {
      setUploading(false)
    }
  }

  const finalizingRef = useRef(new Set())

  const settleAuction = async (auctionId, { early = false } = {}) => {
    if (!supabase) return false
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction || auction.status !== 'active') return false

    const endedAt = Date.now()
    const finalBids = getFinalBidEntries(auction)
    const winner = finalBids[0] || null
    const losers = finalBids.slice(1)

    // Claim the auction transition first. The status guard prevents two
    // browsers from settling the same auction twice.
    const { data: claimed, error: claimErr } = await supabase
      .from('auctions')
      .update({
        status: 'ended',
        current_bid: winner?.amount || getStartingBid(auction),
        top_bidder: winner?.bidder || null,
        is_featured: false,
      })
      .eq('id', auctionId)
      .eq('status', 'active')
      .select('id')
      .maybeSingle()

    if (claimErr) {
      console.error('Auction settlement claim failed:', claimErr)
      if (early) addToast(`Couldn't end auction: ${claimErr.message}`, 'red', 'Save Failed')
      return false
    }

    if (!claimed) {
      // Another browser already finalized it.
      return false
    }

    let refundFailed = false
    for (const loser of losers) {
      const member = members.find(m => m.name === loser.bidder)
      if (!member || loser.amount <= 0) continue

      const { error: refundErr } = await supabase
        .from('members')
        .update({ coins: (Number(member.coins) || 0) + loser.amount })
        .eq('id', member.id)

      if (refundErr) {
        refundFailed = true
        console.error('Loser refund failed:', refundErr)
      } else {
        setMembers(prev => prev.map(m =>
          m.id === member.id ? { ...m, coins: (Number(m.coins) || 0) + loser.amount } : m
        ))
      }
    }

    setAuctions(prev => prev.map(a => a.id === auctionId ? {
      ...a,
      status: 'ended',
      currentBid: winner?.amount || getStartingBid(a),
      topBidder: winner?.bidder || null,
      endedAt,
      isFeatured: false,
    } : a))

    if (refundFailed) {
      addToast(`"${auction.name}" ended, but one or more losing-bid refunds need attention.`, 'red', 'Refund Warning')
    } else if (winner) {
      addToast(
        `"${auction.name}" ended. Winner: ${winner.bidder} at ${winner.amount.toLocaleString()} coins.`,
        'gold',
        early ? 'Auction Ended' : 'Auction Complete'
      )
    } else {
      addToast(`"${auction.name}" ended with no final bids.`, 'blue', 'Auction Complete')
    }

    return true
  }

  const placeBid = async (auctionId) => {
    const auction = auctions.find(a => a.id === auctionId)
    const bidNow = Date.now()

    if (!auction || auction.status !== 'active') {
      addToast('This auction has ended.', 'red', 'Auction Ended')
      return
    }

    if (!isBiddingOpen(auction, bidNow)) {
      addToast('Bidding is locked during the final 30 seconds.', 'red', 'Bidding Closed')
      return
    }

    const bidder = members.find(m => m.name === currentUser?.name)
    if (!bidder) {
      addToast('Your member record could not be found.', 'red', 'Bid Failed')
      return
    }

    const own = getOwnBidState(auction, currentUser.name)
    if (own.cancelled) {
      addToast('You cancelled your bid and cannot bid again on this auction.', 'red', 'Bid Cancelled')
      return
    }
    if (own.submissions >= MAX_BID_SUBMISSIONS) {
      addToast('You have used your initial bid plus both allowed changes.', 'red', 'No Changes Left')
      return
    }

    const raw = bidAmounts[auctionId]
    const amount = (raw === '' || raw === undefined || raw === null)
      ? (own.hasBid ? own.amount : getStartingBid(auction))
      : parseInt(raw, 10)

    const startingBid = getStartingBid(auction)

    if (!Number.isFinite(amount) || amount <= 0) {
      addToast('Enter a valid bid amount.', 'red', 'Invalid Bid')
      return
    }

    if (amount < startingBid) {
      addToast(`Your bid must be at least ${startingBid.toLocaleString()} coins.`, 'red', 'Bid Too Low')
      return
    }

    if (own.hasBid && amount === own.amount) {
      addToast('Enter a different amount to use a bid change.', 'red', 'No Change')
      return
    }

    // Only the latest bid is reserved. A change up reserves the difference;
    // a change down immediately releases the difference.
    const previousReserved = own.amount
    const availableForNewBid = (Number(bidder.coins) || 0) + previousReserved
    if (amount > availableForNewBid) {
      addToast('Not enough available coins for that bid.', 'red', 'Insufficient Funds')
      return
    }

    const delta = amount - previousReserved
    const newCoins = (Number(bidder.coins) || 0) - delta

    const newBids = [
      ...(auction.bids || []),
      {
        bidder: currentUser.name,
        amount,
        time: bidNow,
        previousAmount: previousReserved || null,
        changeNumber: own.submissions,
        isChange: own.submissions > 0,
        cancelled: false,
      },
    ]

    // Reserve/release the coin difference first. If the auction write fails,
    // roll the member balance back to its previous value.
    const { error: coinErr } = await supabase
      .from('members')
      .update({ coins: newCoins })
      .eq('id', bidder.id)

    if (coinErr) {
      console.error('Bid reserve update failed:', coinErr)
      addToast(`Couldn't reserve coins: ${coinErr.message}`, 'red', 'Save Failed')
      return
    }

    const { error: auctionErr } = await supabase
      .from('auctions')
      .update({
        bids: newBids,
        current_bid: startingBid,
        top_bidder: null,
      })
      .eq('id', auctionId)
      .eq('status', 'active')

    if (auctionErr) {
      await supabase.from('members').update({ coins: bidder.coins }).eq('id', bidder.id)
      console.error('Blind bid save failed:', auctionErr)
      addToast(`Couldn't save your bid: ${auctionErr.message}`, 'red', 'Save Failed')
      return
    }

    setMembers(prev => prev.map(m => m.id === bidder.id ? { ...m, coins: newCoins } : m))
    setAuctions(prev => prev.map(a => a.id === auctionId ? {
      ...a,
      bids: newBids,
      currentBid: startingBid,
      topBidder: null,
    } : a))
    setBidAmounts(prev => ({ ...prev, [auctionId]: '' }))

    if (own.hasBid) {
      addToast(
        `Your bid changed to ${amount.toLocaleString()} coins. ${Math.max(0, MAX_BID_CHANGES - own.changesUsed - 1)} change${Math.max(0, MAX_BID_CHANGES - own.changesUsed - 1) === 1 ? '' : 's'} remaining.`,
        'gold',
        'Bid Changed'
      )
    } else {
      addToast(`Your blind bid of ${amount.toLocaleString()} coins is locked in.`, 'gold', 'Bid Submitted')
    }
  }

  const cancelBid = async (auctionId) => {
    const auction = auctions.find(a => a.id === auctionId)
    const bidNow = Date.now()
    if (!auction || auction.status !== 'active') {
      addToast('This auction has already ended.', 'red', 'Auction Ended')
      return
    }
    if (!isBiddingOpen(auction, bidNow)) {
      addToast('Bid cancellation is disabled during the final 30 seconds.', 'red', 'Cancellation Locked')
      return
    }

    const own = getOwnBidState(auction, currentUser?.name)
    if (!own.hasBid || own.amount <= 0) {
      addToast('You do not have an active bid to cancel.', 'red', 'No Active Bid')
      return
    }

    if (!window.confirm(
      `Cancel Blind Bid?\n\nYour current bid of ${own.amount.toLocaleString()} coins will be cancelled.\n\nThe ${own.amount.toLocaleString()} reserved coins will be returned immediately.\nYou will not be able to bid again on this auction.`
    )) return

    const bidder = members.find(m => m.name === currentUser?.name)
    if (!bidder) {
      addToast('Your member record could not be found.', 'red', 'Cancel Failed')
      return
    }

    const newBids = [
      ...(auction.bids || []),
      {
        bidder: currentUser.name,
        amount: 0,
        time: bidNow,
        previousAmount: own.amount,
        cancelled: true,
        changeNumber: own.submissions,
      },
    ]

    const refundedCoins = (Number(bidder.coins) || 0) + own.amount

    const { error: coinErr } = await supabase
      .from('members')
      .update({ coins: refundedCoins })
      .eq('id', bidder.id)

    if (coinErr) {
      console.error('Bid cancellation refund failed:', coinErr)
      addToast(`Couldn't return your coins: ${coinErr.message}`, 'red', 'Cancel Failed')
      return
    }

    const { error: auctionErr } = await supabase
      .from('auctions')
      .update({
        bids: newBids,
        current_bid: getStartingBid(auction),
        top_bidder: null,
      })
      .eq('id', auctionId)
      .eq('status', 'active')

    if (auctionErr) {
      await supabase.from('members').update({ coins: bidder.coins }).eq('id', bidder.id)
      console.error('Bid cancellation save failed:', auctionErr)
      addToast(`Couldn't cancel the bid: ${auctionErr.message}`, 'red', 'Cancel Failed')
      return
    }

    setMembers(prev => prev.map(m => m.id === bidder.id ? { ...m, coins: refundedCoins } : m))
    setAuctions(prev => prev.map(a => a.id === auctionId ? {
      ...a,
      bids: newBids,
      currentBid: getStartingBid(a),
      topBidder: null,
    } : a))
    setBidAmounts(prev => ({ ...prev, [auctionId]: '' }))
    addToast(`Your ${own.amount.toLocaleString()}-coin bid was cancelled and fully returned.`, 'blue', 'Bid Cancelled')
  }

  useEffect(() => {
    for (const auction of auctions) {
      if (auction.status !== 'active' || !auction.endsAt || auction.endsAt > now) continue
      if (finalizingRef.current.has(auction.id)) continue
      finalizingRef.current.add(auction.id)
      settleAuction(auction.id).finally(() => finalizingRef.current.delete(auction.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, auctions])

  const endAuction = async (auctionId) => {
    if (!isMaster) return
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return
    if (window.confirm(
      `End "${auction.name}" early?\n\nAll submitted blind bids will be revealed and the highest final bid will win.\nIf two final bids are tied, the earliest final bid wins.`
    )) {
      await settleAuction(auctionId, { early: true })
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

    const finalBids = auction.status === 'active' ? getFinalBidEntries(auction) : []
    const refundNote = finalBids.length
      ? `\n\n${finalBids.reduce((sum, b) => sum + b.amount, 0).toLocaleString()} reserved coins across ${finalBids.length} active bidder${finalBids.length === 1 ? '' : 's'} will be returned.`
      : ''

    if (!window.confirm(`Delete "${auction.name}" permanently?${refundNote}`)) return

    if (auction.status === 'active') {
      for (const bid of finalBids) {
        const member = members.find(m => m.name === bid.bidder)
        if (!member || bid.amount <= 0) continue
        const { error: refundErr } = await supabase
          .from('members')
          .update({ coins: (Number(member.coins) || 0) + bid.amount })
          .eq('id', member.id)
        if (refundErr) {
          addToast(`Couldn't refund ${bid.bidder}: ${refundErr.message}`, 'red', 'Delete Failed')
          return
        }
        setMembers(prev => prev.map(m =>
          m.id === member.id ? { ...m, coins: (Number(m.coins) || 0) + bid.amount } : m
        ))
      }
    }

    // Remove notifications tied to this auction first. The DB FK currently
    // uses ON DELETE SET NULL, which would otherwise leave old win notices
    // behind after the auction is deleted.
    const { error: notificationError } = await supabase
      .from('notifications')
      .delete()
      .eq('auction_id', auctionId)

    if (notificationError) {
      console.error('Delete auction notifications failed:', notificationError)
      addToast(`Couldn't clean auction notifications: ${notificationError.message}`, 'red', 'Delete Failed')
      return
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

  const toggleEndedSelection = (auctionId) => {
    setSelectedEndedAuctions(prev =>
      prev.includes(auctionId)
        ? prev.filter(id => id !== auctionId)
        : [...prev, auctionId]
    )
  }

  const toggleSelectAllEnded = () => {
    setSelectedEndedAuctions(prev =>
      prev.length === endedAuctions.length
        ? []
        : endedAuctions.map(a => a.id)
    )
  }

  const deleteSelectedEndedAuctions = async () => {
    if (!isElder || selectedEndedAuctions.length === 0) return

    const selected = endedAuctions.filter(a => selectedEndedAuctions.includes(a.id))
    if (!selected.length) return

    const names = selected.slice(0, 5).map(a => `• ${a.name}`).join('\n')
    const more = selected.length > 5 ? `\n• +${selected.length - 5} more` : ''
    const confirmed = window.confirm(
      `Delete ${selected.length} archived auction${selected.length === 1 ? '' : 's'} permanently?\n\n${names}${more}\n\nThis cannot be undone.`
    )
    if (!confirmed) return

    try {
      const ids = selected.map(a => a.id)

      // Clean up notifications first so deleting archive history cannot leave
      // orphaned auction-win notifications in the notification bell.
      const { error: notificationError } = await supabase
        .from('notifications')
        .delete()
        .in('auction_id', ids)

      if (notificationError) throw notificationError

      const { error } = await supabase
        .from('auctions')
        .delete()
        .in('id', ids)
        .eq('status', 'ended')

      if (error) throw error

      setAuctions(prev => prev.filter(a => !ids.includes(a.id)))
      setSelectedEndedAuctions([])
      addToast(
        `${selected.length} archived auction${selected.length === 1 ? '' : 's'} deleted.`,
        'red',
        'Auctions Deleted'
      )
    } catch (err) {
      console.error('Bulk delete auctions failed:', err)
      addToast(`Couldn't delete selected auctions: ${err.message}`, 'red', 'Delete Failed')
    }
  }

  const toggleFeatured = async (auctionId) => {
    console.log('══════════════════════════════════════════════════════════════')
    console.log('[toggleFeatured] ▶ CALLED', { auctionId, type: typeof auctionId })
    console.log('[toggleFeatured] currentUser:', currentUser)
    console.log('[toggleFeatured] isElder:', isElder)
    console.log('[toggleFeatured] featuringInFlight:', featuringInFlight)

    if (!isElder) {
      console.warn('[toggleFeatured] ✕ blocked: not elder')
      return
    }
    if (featuringInFlight) {
      console.warn('[toggleFeatured] ✕ blocked: in flight')
      return
    }

    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) {
      console.warn('[toggleFeatured] ✕ blocked: auction not found', auctionId)
      console.log('[toggleFeatured] available ids:', auctions.map(a => a.id))
      return
    }

    const willUnfeature = !!auction.isFeatured
    console.log('[toggleFeatured] willUnfeature:', willUnfeature)
    console.log('[toggleFeatured] target auction:', auction)

    setFeaturingInFlight(true)

    try {
      if (willUnfeature) {
        console.log('[toggleFeatured] → sending UPDATE is_featured=false')
        const res = await supabase
          .from('auctions')
          .update({ is_featured: false })
          .eq('id', auctionId)

        console.log('[toggleFeatured] ← unfeature response:', {
          error: res.error,
          status: res.status,
          statusText: res.statusText,
          data: res.data,
          count: res.count,
        })

        if (res.error) throw res.error

        // VERIFY
        const check = await supabase
          .from('auctions')
          .select('id, name, is_featured')
          .eq('id', auctionId)
          .maybeSingle()
        console.log('[toggleFeatured] ✓ verify read:', check)

        if (check.error) {
          console.warn('[toggleFeatured] verify read failed:', check.error)
        } else if (check.data && check.data.is_featured === true) {
          console.error('[toggleFeatured] ⚠ DB STILL SHOWS is_featured=true after unfeature!')
        }

        setAuctions(prev => prev.map(a => a.id === auctionId ? { ...a, isFeatured: false } : a))
        addToast(`"${auction.name}" is no longer featured.`, 'blue', 'Updated')
      } else {
        console.log('[toggleFeatured] → clearing others first')
        const others = auctions.filter(a => a.isFeatured && a.id !== auctionId)
        console.log('[toggleFeatured] others to clear:', others.map(a => a.id))
        if (others.length > 0) {
          const clearRes = await supabase
            .from('auctions')
            .update({ is_featured: false })
            .in('id', others.map(a => a.id))
          console.log('[toggleFeatured] ← clear-others response:', {
            error: clearRes.error,
            status: clearRes.status,
            data: clearRes.data,
          })
          if (clearRes.error) throw clearRes.error
        }

        console.log('[toggleFeatured] → sending UPDATE is_featured=true on', auctionId)
        const res = await supabase
          .from('auctions')
          .update({ is_featured: true })
          .eq('id', auctionId)

        console.log('[toggleFeatured] ← set response:', {
          error: res.error,
          status: res.status,
          statusText: res.statusText,
          data: res.data,
          count: res.count,
        })

        if (res.error) throw res.error

        // VERIFY
        const check = await supabase
          .from('auctions')
          .select('id, name, is_featured')
          .eq('id', auctionId)
          .maybeSingle()
        console.log('[toggleFeatured] ✓ verify read:', check)

        if (check.error) {
          console.warn('[toggleFeatured] verify read failed:', check.error)
        } else if (check.data && check.data.is_featured === false) {
          console.error('[toggleFeatured] ⚠ DB STILL SHOWS is_featured=false after set! RLS or trigger issue.')
          throw new Error(
            `DB rejected the change. After the update, the row still shows is_featured=false. ` +
            `Most likely cause: RLS update policy blocks this user, OR a trigger on the auctions table ` +
            `overrides the value. Run this in Supabase SQL editor to test: ` +
            `update auctions set is_featured = true where id = '${auctionId}'; select id, is_featured from auctions where id = '${auctionId}';`
          )
        }

        setAuctions(prev => prev.map(a => {
          if (a.id === auctionId) return { ...a, isFeatured: true }
          if (a.isFeatured) return { ...a, isFeatured: false }
          return a
        }))
        addToast(`"${auction.name}" is now featured.`, 'gold', 'Featured')
      }
    } catch (err) {
      console.error('[toggleFeatured] ✕ FAILED:', err)
      addToast(`Couldn't feature: ${err.message || 'unknown error'}`, 'red', 'Not Saved')
    } finally {
      console.log('[toggleFeatured] ■ done')
      console.log('══════════════════════════════════════════════════════════════')
      setFeaturingInFlight(false)
    }
  }

  const toggleBidsExpanded = (id) => setExpandedBids(prev => ({ ...prev, [id]: !prev[id] }))

  const activeAuctions = useMemo(() => (Array.isArray(auctions) ? auctions : []).filter(a => a?.status === 'active'), [auctions])
  const endedAuctions = useMemo(
    () => [...(Array.isArray(auctions) ? auctions : []).filter(a => a?.status === 'ended')].sort((a, b) => {
      const ax = a.endedAt || a.endsAt || 0
      const bx = b.endedAt || b.endsAt || 0
      return bx - ax
    }),
    [auctions]
  )
  const pendingDistribution = useMemo(
    () => endedAuctions.filter(a => getAuctionWinner(a) && !a.distributedBy).length,
    [endedAuctions]
  )

  const featuredAuction = useMemo(() => {
    return activeAuctions.find(a => a.isFeatured) || null
  }, [activeAuctions])

  const otherActiveAuctions = useMemo(
    () => activeAuctions.filter(a => a.id !== featuredAuction?.id),
    [activeAuctions, featuredAuction]
  )

  const selectedImageLabel = imageFile
    ? imageFile.name
    : pickedLibraryImg
      ? (pickedLibraryImg.displayName || displayNameForLibraryImage(pickedLibraryImg))
      : ''

  const hasSelectedImage = !!(imageFile || pickedLibraryImg)

  return (
    <div className="space-y-4">
      {/* Premium auction header */}
      <header className="relative overflow-hidden rounded-2xl border border-white/[.08] bg-[#0b0908]/95 shadow-[0_18px_60px_-42px_rgba(0,0,0,.9)]">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(circle at 8% 0%, rgba(242,204,96,.075), transparent 30%), radial-gradient(circle at 88% 100%, rgba(242,204,96,.035), transparent 28%)',
          }}
        />
        <div className="relative px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_9px_rgba(242,204,96,.65)]" />
                <span className="text-[9px] font-bold uppercase tracking-[.24em] text-gold-dim">Clan Auction House</span>
              </div>

              <div className="mt-1.5 flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-1">
                <h1 className="font-spectral text-[28px] font-bold leading-none tracking-tight text-text-bright sm:text-[32px]">
                  Auctions
                </h1>
                <span className="text-[10px] leading-4 text-text-dim sm:whitespace-nowrap">Private blind bidding</span>
              </div>

              <p className="mt-1.5 max-w-xl text-[11px] leading-4 text-text-dim sm:text-xs">
                Bid on rare clan items with private bids.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-stretch lg:justify-end">
              <div className="min-w-0 rounded-lg border border-white/[.07] bg-black/25 px-3 py-2.5 sm:min-w-[92px]">
                <div className="text-[8px] font-bold uppercase tracking-[.16em] text-text-dim">Live</div>
                <div className="mt-0.5 font-mono text-lg font-bold leading-none tabular-nums text-gold-bright">{activeAuctions.length}</div>
              </div>

              <div className="min-w-0 rounded-lg border border-white/[.07] bg-black/25 px-3 py-2.5 sm:min-w-[92px]">
                <div className="text-[8px] font-bold uppercase tracking-[.16em] text-text-dim">Completed</div>
                <div className="mt-0.5 font-mono text-lg font-bold leading-none tabular-nums text-text-bright">{endedAuctions.length}</div>
              </div>

              <div className="min-w-0 rounded-lg border border-gold/20 bg-gold/[.045] px-3 py-2.5 sm:min-w-[148px]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[8px] font-bold uppercase tracking-[.16em] text-gold-dim">Your Coins</div>
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_7px_rgba(242,204,96,.55)]" />
                </div>
                <div className="mt-0.5 font-mono text-lg font-bold leading-none tabular-nums text-gold-bright">
                  {currentCoins.toLocaleString()}
                </div>
                <div className="mt-1 text-[8px] text-text-dim">Available to bid</div>
              </div>

              <div className="min-w-0 rounded-lg border border-white/[.07] bg-black/25 px-3 py-2.5 sm:min-w-[148px]">
                <div className="text-[8px] font-bold uppercase tracking-[.16em] text-text-dim">Server Time</div>
                <div className="mt-0.5 font-mono text-sm font-bold leading-none tabular-nums text-text-bright">
                  {formatClock(now)} <span className="text-[8px] font-semibold text-text-dim">{SERVER_TZ_SHORT}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[8px] text-text-dim">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,.55)]" />
                  <span>{SERVER_TZ_NAME}</span>
                  <span>·</span>
                  <span>{formatLocalClock(now)} local</span>
                </div>
              </div>

              {isElder && (
                <button
                  type="button"
                  onClick={() => setShowCreate(!showCreate)}
                  className="min-h-[60px] w-full rounded-lg px-3 text-xs font-bold shadow-[0_8px_22px_-15px_rgba(242,204,96,.7)] sm:w-auto sm:min-w-[148px] sm:px-4 btn-gold"
                  aria-expanded={showCreate}
                >
                  {showCreate ? '✕ Close' : '+ Create Auction'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-white/[.055] pt-3">
          <div className="hidden sm:flex min-h-7 flex-wrap items-center gap-y-2 text-[11px] leading-5 text-text-dim">
            <div className="inline-flex h-7 items-center gap-2 pr-5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
              <span><span className="font-semibold text-text-bright">{activeAuctions.length}</span> live lot{activeAuctions.length === 1 ? '' : 's'}</span>
            </div>
            <span className="h-4 border-l border-white/[.10]" aria-hidden="true" />
            <div className="inline-flex h-7 items-center px-5">
              Minimum <span className="ml-1 font-semibold text-text-bright">starting bid</span>
            </div>
            {featuredAuction && (
              <>
                <span className="h-4 border-l border-white/[.10]" aria-hidden="true" />
                <div className="inline-flex h-7 items-center px-5 text-gold-light">★ <strong>Featured lot active</strong></div>
              </>
            )}
            {pendingDistribution > 0 && isElder && (
              <>
                <span className="h-4 border-l border-white/[.10]" aria-hidden="true" />
                <div className="inline-flex h-7 items-center px-5 text-yellow-400"><strong>{pendingDistribution}</strong>&nbsp; awaiting distribution</div>
              </>
            )}
          </div>
          {(featuredAuction || (pendingDistribution > 0 && isElder)) && (
            <div className="flex sm:hidden flex-wrap items-center gap-2">
              {featuredAuction && <span className="inline-flex items-center rounded-full border border-gold/20 bg-gold/[.045] px-2.5 py-1 text-[10px] font-semibold text-gold-light">★ Featured lot active</span>}
              {pendingDistribution > 0 && isElder && <span className="inline-flex items-center rounded-full border border-yellow-500/20 bg-yellow-500/[.035] px-2.5 py-1 text-[10px] font-semibold text-yellow-400">{pendingDistribution} awaiting distribution</span>}
            </div>
          )}
        </div>
        </div>
      </header>

      {/* Essential auction rules — deliberately limited to the information players need before bidding */}
      <div className="rounded-xl border border-white/[.065] bg-[#0b0908]/70 px-3 py-2.5 sm:px-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-x-6 sm:gap-y-2.5 text-[11px] leading-5 text-text-dim">
          <div className="inline-flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gold/15 bg-gold/[.04] text-[11px] text-gold-light">↻</span>
            <span><strong className="text-text-bright">1 bid + 2 changes</strong> per player</span>
          </div>

          <span className="hidden md:inline text-white/10">|</span>

          <div className="inline-flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-yellow-500/15 bg-yellow-500/[.04] text-[11px] text-yellow-400">◷</span>
            <span>Locks in final <strong className="text-text-bright">30 seconds</strong></span>
          </div>

          <span className="hidden md:inline text-white/10">|</span>

          <div className="inline-flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gold/15 bg-gold/[.04] text-[11px] text-gold-light">◉</span>
            <span><strong className="text-text-bright">Local time</strong> shown on auctions</span>
          </div>

        </div>
      </div>

      {/* Create auction */}
      {showCreate && (
        <section className="overflow-hidden rounded-2xl border border-gold/25 bg-[#0d0b0a]/95">
          <div className="border-b border-white/[.06] bg-black/20 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.2em] text-gold-dim">Auction setup</div>
                <h2 className="mt-1 font-spectral text-xl font-bold text-text-bright">Create New Auction</h2>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 w-8 rounded-lg border border-white/[.08] text-text-dim hover:text-text-bright hover:bg-white/[.04]" aria-label="Close create auction">✕</button>
            </div>
          </div>

          <div className="p-5 md:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)] gap-6">
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`${formId}-name`} className="block text-[10px] font-bold uppercase tracking-[.16em] text-gold-dim mb-2">Item name</label>
                    <input id={`${formId}-name`} className="input w-full" placeholder="e.g. Kari Top / Bound" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor={`${formId}-rarity`} className="block text-[10px] font-bold uppercase tracking-[.16em] text-gold-dim mb-2">Rarity</label>
                    <select id={`${formId}-rarity`} className="input w-full" value={newItem.rarity} onChange={e => setNewItem({ ...newItem, rarity: e.target.value })}>
                      {Object.entries(RARITY).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor={`${formId}-desc`} className="block text-[10px] font-bold uppercase tracking-[.16em] text-gold-dim mb-2">Description</label>
                  <select id={`${formId}-desc`} className="input w-full" value={descChoice} onChange={e => { setDescChoice(e.target.value); if (e.target.value !== 'Custom...') setCustomDesc('') }}>
                    {presetDescriptions.map(d => <option key={d} value={d}>{d === '' ? 'No description' : d}</option>)}
                  </select>
                  {descChoice === 'Custom...' && (
                    <input className="input w-full mt-2" aria-label="Custom description" placeholder="Type a short description..." value={customDesc} onChange={e => setCustomDesc(e.target.value)} maxLength={100} autoFocus />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/[.07] bg-black/20 p-4">
                    <label htmlFor={`${formId}-bid`} className="block text-[10px] font-bold uppercase tracking-[.16em] text-text-dim mb-2">Starting bid</label>
                    <div className="flex items-center gap-2">
                      <input id={`${formId}-bid`} className="input flex-1" type="number" min="1" placeholder="100" value={newItem.startBid} onChange={e => setNewItem({ ...newItem, startBid: e.target.value })} />
                      <span className="text-xs text-text-dim">coins</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[.07] bg-black/20 p-4">
                    <label htmlFor={`${formId}-duration`} className="block text-[10px] font-bold uppercase tracking-[.16em] text-text-dim mb-2">Duration</label>
                    <div className="flex items-center gap-2">
                      <input id={`${formId}-duration`} className="input flex-1" type="number" min="1" placeholder="60" value={newItem.duration} onChange={e => setNewItem({ ...newItem, duration: e.target.value })} />
                      <span className="text-xs text-text-dim">minutes</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gold/15 bg-gold/[.025] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[.16em] text-gold-dim">Auction preview</div>
                      <div className="mt-1 text-sm text-text-bright">{newItem.name.trim() || 'Untitled Item'}</div>
                    </div>
                    <RarityBadge rarity={newItem.rarity} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                    <div><span className="text-text-dim">Opening bid</span><div className="mt-1 font-mono font-bold text-gold-light">{(parseInt(newItem.startBid) || 100).toLocaleString()} coins</div></div>
                    <div>
                      <span className="text-text-dim">Closes</span>
                      <div className="mt-1 font-mono font-bold text-gold-light">
                        {formatClock(Date.now() + (parseInt(newItem.duration) || 60) * 60000)} <span className="text-text-dim">{SERVER_TZ_SHORT}</span>
                      </div>
                      <div className="mt-0.5 text-[9px] font-mono text-text-dim">
                        Local {formatLocalClock(Date.now() + (parseInt(newItem.duration) || 60) * 60000)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Image manager */}
              <div className="rounded-xl border border-white/[.07] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[.16em] text-gold-dim">Item artwork</div>
                    <div className="mt-1 text-[11px] text-text-dim">Upload a new image or reuse an existing asset.</div>
                  </div>
                  <button type="button" onClick={loadLibrary} disabled={libraryLoading} className="text-[10px] font-bold uppercase tracking-wider text-gold-light hover:text-gold-bright disabled:opacity-40">
                    {libraryLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-white/[.06] bg-black/20 p-3">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-lg border border-gold/25 object-cover bg-void/60" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg border border-dashed border-white/[.10] flex items-center justify-center text-text-dim/50">IMG</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Selected asset</div>
                    <div className="mt-1 truncate text-xs text-text-bright">{hasSelectedImage ? selectedImageLabel : 'No image selected'}</div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <input id={fileInputId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} disabled={uploading} className="sr-only" />
                    <label htmlFor={fileInputId} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-center transition-colors ${uploading ? 'border-white/[.08] text-text-dim cursor-not-allowed' : 'border-gold/35 text-gold-light hover:bg-gold/10 hover:border-gold/55'}`}>
                      {hasSelectedImage ? 'Change' : 'Upload'}
                    </label>
                    {hasSelectedImage && <button type="button" onClick={clearImage} disabled={uploading} className="rounded-lg border border-red-500/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 disabled:opacity-40">Clear</button>}
                  </div>
                </div>

                <div className="mt-4 border-t border-white/[.06] pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-[.16em] text-text-dim">Image library</div>
                    <div className="text-[10px] text-text-dim">{libraryLoading ? 'Loading…' : libraryError ? <span className="text-red-400">{libraryError}</span> : `${libraryImages.length} asset${libraryImages.length === 1 ? '' : 's'}`}</div>
                  </div>
                  {libraryImages.length === 0 && !libraryLoading && !libraryError && <div className="rounded-lg border border-dashed border-white/[.08] py-7 text-center text-[11px] text-text-dim">No images available yet.</div>}
                  {libraryImages.length > 0 && (
                    <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 xl:grid-cols-6 gap-2 max-h-[235px] overflow-y-auto pr-1">
                      {libraryImages.map(img => {
                        const isPicked = pickedLibraryImg?.name === img.name
                        const isDeleting = deletingImageName === img.name
                        const title = img.displayName || displayNameForLibraryImage(img)
                        return (
                          <div key={img.name} className={`group relative overflow-hidden rounded-lg border ${isPicked ? 'border-gold-bright ring-1 ring-gold/40' : 'border-white/[.08] hover:border-gold/40'} ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}>
                            <button type="button" onClick={() => pickFromLibrary(img)} title={title} className="block w-full" aria-pressed={isPicked} aria-label={`Use image ${title}`}>
                              <img src={img.url} alt={title} loading="lazy" className="aspect-square w-full object-cover bg-void/60" />
                            </button>
                            {isPicked && <span className="absolute top-1 left-1 h-4 w-4 rounded-full bg-gold text-black text-[9px] font-bold flex items-center justify-center">✓</span>}
                            <button type="button" onClick={e => { e.stopPropagation(); deleteLibraryImage(img) }} disabled={isDeleting} title="Delete image" aria-label={`Delete image ${title}`} className="absolute top-1 right-1 h-4 w-4 rounded-full bg-black/80 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white text-[8px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100">{isDeleting ? '…' : '✕'}</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.06] pt-5">
              <div className="text-[11px] text-text-dim">
                The auction uses <span className="text-text-bright font-semibold">{SERVER_TZ_LABEL}</span> as the authoritative clock. Your screen also shows <span className="text-text-bright font-semibold">{formatLocalTimeLabel()}</span>.
              </div>
              <button onClick={createAuction} className="btn-gold min-h-10 px-5 font-bold" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Start Auction'}
              </button>
            </div>
          </div>
        </section>
      )}

      {featuredAuction && (
        <FeaturedAuctionCard
          auction={featuredAuction}
          now={now}
          currentUser={currentUser}
          currentCoins={currentCoins}
          isElder={isElder}
          isMaster={isMaster}
          isPinned={!!featuredAuction.isFeatured}
          onToggleFeatured={() => toggleFeatured(featuredAuction.id)}
          featuringInFlight={featuringInFlight}
          bidAmount={bidAmounts[featuredAuction.id] || ''}
          onBidChange={v => setBidAmounts(prev => ({ ...prev, [featuredAuction.id]: v }))}
          onPlaceBid={() => placeBid(featuredAuction.id)}
          onCancelBid={() => cancelBid(featuredAuction.id)}
          onEndEarly={() => endAuction(featuredAuction.id)}
          onDelete={() => deleteAuction(featuredAuction.id)}
          isBidsExpanded={!!expandedBids[featuredAuction.id]}
          onToggleBids={() => toggleBidsExpanded(featuredAuction.id)}
        />
      )}

      {otherActiveAuctions.length === 0 && !featuredAuction ? (
        <div className="relative overflow-hidden rounded-2xl border border-white/[.07] bg-[#0b0908]/80">
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
            style={{ background: 'radial-gradient(circle at 50% 0%, rgba(242,204,96,.055), transparent 42%)' }}
          />
          <div className="relative flex min-h-[190px] flex-col items-center justify-center px-5 py-8 text-center sm:min-h-[250px] sm:py-12">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/[.045] text-lg text-gold-light">
              ◇
            </div>
            <div className="mt-3 text-sm font-semibold text-text-bright">No Live Auctions</div>
            <div className="mt-1 max-w-sm text-[11px] leading-4 text-text-dim">
              There are no active lots right now. New clan auctions will appear here when they go live.
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/[.06] bg-black/20 px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[.14em] text-text-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Auction house ready
            </div>
          </div>
        </div>
      ) : otherActiveAuctions.length > 0 ? (
        <section>
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.2em] text-gold-dim">Live inventory</div>
              <h2 className="mt-1 font-spectral text-xl font-bold text-text-bright">Active Auctions</h2>
            </div>
            <span className="rounded-full border border-white/[.07] bg-black/20 px-2.5 py-1 text-[10px] font-mono text-text-dim">{otherActiveAuctions.length} lots</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {otherActiveAuctions.map(auction => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                now={now}
                currentUser={currentUser}
                currentCoins={currentCoins}
                isElder={isElder}
                isMaster={isMaster}
                isFeatured={!!auction.isFeatured}
                onToggleFeatured={() => toggleFeatured(auction.id)}
                featuringInFlight={featuringInFlight}
                bidAmount={bidAmounts[auction.id] || ''}
                onBidChange={v => setBidAmounts(prev => ({ ...prev, [auction.id]: v }))}
                onPlaceBid={() => placeBid(auction.id)}
                onCancelBid={() => cancelBid(auction.id)}
                onEndEarly={() => endAuction(auction.id)}
                onDelete={() => deleteAuction(auction.id)}
                isBidsExpanded={!!expandedBids[auction.id]}
                onToggleBids={() => toggleBidsExpanded(auction.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {endedAuctions.length > 0 && (
        <section className="pt-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.2em] text-gold-dim">Auction archive</div>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="font-spectral text-xl font-bold text-text-bright">Completed Auctions</h2>
                <span className="rounded-full border border-white/[.07] bg-black/20 px-2 py-0.5 text-[10px] font-mono text-text-dim">{endedAuctions.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-[10px] text-text-dim">Review bidder count, winners, final bids, and distribution status.</div>
              {isElder && (
                <>
                  <button
                    type="button"
                    onClick={toggleSelectAllEnded}
                    className="rounded-md border border-white/[.08] bg-black/20 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-text-dim hover:border-gold/25 hover:text-gold-light"
                  >
                    {selectedEndedAuctions.length === endedAuctions.length ? 'Clear Selection' : 'Select All'}
                  </button>
                  {selectedEndedAuctions.length > 0 && (
                    <button
                      type="button"
                      onClick={deleteSelectedEndedAuctions}
                      className="rounded-md border border-red-500/20 bg-red-500/[.04] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-red-400 hover:border-red-400/35 hover:bg-red-500/[.08]"
                    >
                      Delete {selectedEndedAuctions.length}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/[.07] bg-[#0b0908]/90">
            <ul className="divide-y divide-white/[.05]">
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
                  onAssignDistributor={name => assignDistributor(a.id, name)}
                  onDelete={() => deleteAuction(a.id)}
                  isSelected={selectedEndedAuctions.includes(a.id)}
                  onToggleSelect={() => toggleEndedSelection(a.id)}
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

function BlindStatusPill({ children, tone = 'gold' }) {
  const toneClass = tone === 'green'
    ? 'border-green-500/25 bg-green-500/[.06] text-green-400'
    : tone === 'red'
      ? 'border-red-500/25 bg-red-500/[.06] text-red-400'
      : 'border-gold/20 bg-gold/[.045] text-gold-light'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${toneClass}`}>
      {children}
    </span>
  )
}

function BlindBidPanel({
  auction, now, currentUser, currentCoins = 0, bidAmount, onBidChange, onPlaceBid, onCancelBid,
}) {
  const biddingOpen = isBiddingOpen(auction, now)
  const own = getOwnBidState(auction, currentUser?.name)
  const startingBid = getStartingBid(auction)
  const canSubmit = biddingOpen && !own.cancelled && own.submissions < MAX_BID_SUBMISSIONS
  const isUrgent = auction.endsAt - now > 0 && auction.endsAt - now < URGENT_MS
  const availableCoins = Math.max(0, Number(currentCoins) || 0)
  const reservedCoins = own.hasBid ? Math.max(0, Number(own.amount) || 0) : 0
  const totalCoins = availableCoins + reservedCoins

  return (
    <div className="rounded-xl border border-gold/20 bg-gold/[.025] p-3 sm:p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[.16em] text-gold-light">Blind Bid</span>
          <BlindStatusPill tone="gold">Private</BlindStatusPill>
        </div>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            biddingOpen
              ? 'bg-green-400 shadow-[0_0_9px_rgba(74,222,128,.55)]'
              : 'bg-red-400 shadow-[0_0_9px_rgba(239,68,68,.45)]'
          }`}
          aria-label={biddingOpen ? 'Bidding open' : 'Bidding locked'}
        />
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-gold/15 bg-gold/[.035] px-2.5 py-2">
          <div className="text-[9px] font-bold uppercase tracking-[.13em] text-gold-dim">Your Coins</div>
          <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums text-gold-bright">
            {availableCoins.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[8px] text-text-dim">available balance</div>
        </div>
        <div className="rounded-lg border border-white/[.06] bg-black/15 px-2.5 py-2">
          <div className="text-[9px] font-bold uppercase tracking-[.13em] text-text-dim">Reserved</div>
          <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums text-text-bright">
            {reservedCoins.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[8px] text-text-dim">
            {own.hasBid ? 'current blind bid' : 'no active bid'}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-b border-white/[.06] pb-2.5">
        <span className="text-[10px] leading-5 text-text-dim">
          {own.hasBid
            ? <>Total <span className="font-mono font-semibold text-text-bright">{totalCoins.toLocaleString()}</span> coins including your reserved bid.</>
            : 'Your bid is hidden from everyone until close.'}
        </span>
        <span className="shrink-0 text-[10px] font-mono text-text-dim">
          {own.cancelled ? 'CANCELLED' : `${own.submissions}/${MAX_BID_SUBMISSIONS} submitted`}
        </span>
      </div>

      {own.cancelled ? (
        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/[.035] px-3 py-2.5">
          <div className="min-w-0">
            <BlindStatusPill tone="red">Bid Cancelled</BlindStatusPill>
            <div className="mt-1 text-[9px] leading-4 text-text-dim">
              Reserved coins returned. You cannot bid again.
            </div>
          </div>
          <span className="shrink-0 text-lg text-red-400/70">×</span>
        </div>
      ) : (
        <>
          <div className="mt-2.5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Your Current Bid</div>
              <div className={`mt-0.5 font-mono text-xl font-bold tabular-nums ${own.hasBid ? 'text-green-300' : 'text-text-dim'}`}>
                {own.hasBid ? own.amount.toLocaleString() : '—'}
                {own.hasBid && <span className="ml-1 text-[10px] font-normal text-text-dim">coins</span>}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Changes Left</div>
              <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-gold-light">{own.changesLeft}</div>
            </div>
          </div>

          {currentUser && auction.status === 'active' && (
            canSubmit ? (
              <div className="mt-2.5">
                <label htmlFor={`blind-bid-${auction.id}`} className="sr-only">
                  Blind bid amount for {auction.name}
                </label>
                <div className="flex gap-2">
                  <input
                    id={`blind-bid-${auction.id}`}
                    className="input min-w-0 flex-1 text-base font-mono"
                    type="number"
                    inputMode="numeric"
                    min={startingBid}
                    step="1"
                    placeholder={String(own.hasBid ? own.amount : startingBid)}
                    value={bidAmount}
                    onChange={e => onBidChange(e.target.value)}
                    onFocus={e => {
                      if (!e.target.value) onBidChange(String(own.hasBid ? own.amount : startingBid))
                    }}
                    aria-label="Your blind bid amount"
                  />
                  <button
                    type="button"
                    onClick={onPlaceBid}
                    className="btn-gold shrink-0 min-w-[76px] px-3 font-bold"
                  >
                    {own.hasBid ? 'Change' : 'Bid'}
                  </button>
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-text-dim">
                  <span>
                    {own.hasBid
                      ? `${own.changesLeft} change${own.changesLeft === 1 ? '' : 's'} remaining`
                      : 'Your first bid is hidden from other members'}
                  </span>
                  <span className="shrink-0 text-gold-light/80">Min {startingBid.toLocaleString()}</span>
                </div>

                {own.hasBid && (
                  <button
                    type="button"
                    onClick={onCancelBid}
                    disabled={!biddingOpen || typeof onCancelBid !== 'function'}
                    className="mt-2 w-full rounded-lg border border-red-500/25 bg-red-500/[.025] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.1em] text-red-400 transition-colors hover:border-red-500/45 hover:bg-red-500/[.07] hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Cancel / Remove Bid
                  </button>
                )}
              </div>
            ) : (
              <div className={`mt-2.5 flex items-center gap-2 rounded-lg border px-3 py-2.5 ${
                isUrgent
                  ? 'border-red-500/25 bg-red-500/[.045]'
                  : 'border-red-500/15 bg-red-500/[.025]'
              }`}>
                <span className="text-sm">🔒</span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-red-400">Bidding Locked</div>
                  <div className="text-[10px] leading-5 text-text-dim">Final 30 seconds — bids, changes and cancellations are closed.</div>
                </div>
              </div>
            )
          )}

          {!currentUser && (
            <div className="mt-2.5 rounded-lg border border-white/[.06] bg-black/15 px-3 py-2.5 text-[10px] text-text-dim">
              Sign in to participate.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FeaturedAuctionCard({
  auction, now, currentUser, currentCoins, isElder, isMaster,
  isPinned, onToggleFeatured, featuringInFlight,
  bidAmount, onBidChange, onPlaceBid, onCancelBid, onEndEarly, onDelete,
}) {
  const rm = getRarityMeta(auction.rarity)
  const remaining = auction.endsAt - now
  const isUrgent = remaining > 0 && remaining < URGENT_MS
  const biddingOpen = isBiddingOpen(auction, now)
  const own = getOwnBidState(auction, currentUser?.name)
  const startingBid = getStartingBid(auction)
  const availableCoins = Math.max(0, Number(currentCoins) || 0)
  const reservedCoins = own.hasBid ? Math.max(0, Number(own.amount) || 0) : 0
  const canSubmit = biddingOpen && !own.cancelled && own.submissions < MAX_BID_SUBMISSIONS

  return (
    <section
      className="relative overflow-hidden rounded-xl border bg-[#0b0908]/95"
      style={{
        borderColor: rgba(rm.rgb, 0.28),
        boxShadow: `0 14px 35px -28px ${rgba(rm.rgb, 0.38)}, inset 0 1px 0 rgba(255,255,255,.03)`,
      }}
      aria-label={`Featured blind auction: ${auction.name}`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background: `radial-gradient(circle at 10% 50%, ${rgba(rm.rgb,.09)}, transparent 42%)`,
        }}
      />

      {/* Header exactly kept as a thin banner row */}
      <div className="relative flex items-center justify-between gap-2 border-b border-white/[.06] bg-black/20 px-3 py-1.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <FeaturedPill rarityMeta={rm} />
          <span className="hidden truncate text-[9px] font-bold uppercase tracking-[.15em] text-text-dim sm:inline">
            Featured Blind Lot
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden text-[10px] font-bold uppercase tracking-[.16em] text-text-dim sm:inline">
            Time
          </span>
          <span
            className={`rounded-lg border px-3 py-1.5 font-mono text-[14px] font-bold leading-none tabular-nums ${
              isUrgent
                ? 'border-red-500/30 bg-red-500/[.07] text-red-400 motion-safe:animate-pulse'
                : 'border-gold/20 bg-gold/[.04]'
            }`}
            style={!isUrgent ? { color: rm.color } : undefined}
          >
            {formatCountdown(auction.endsAt, now)}
          </span>
        </div>
      </div>

      {/* Reference-style horizontal hero:
          information stays on the left, image is anchored on the far right,
          and the action controls sit on the same lower line as the auction facts. */}
      <div className="relative px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="relative flex min-h-[126px] items-stretch gap-2 sm:min-h-[136px] sm:gap-4">
          {/* Left content */}
          <div className="order-1 flex min-w-0 flex-1 flex-col justify-between pr-[94px] sm:pr-1">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <RarityBadge rarity={auction.rarity} />
                <BlindStatusPill>Blind</BlindStatusPill>
              </div>

              <h2
                className="mt-0.5 font-spectral text-[22px] font-bold leading-tight break-words sm:text-[25px]"
                style={{ color: rm.color }}
              >
                {auction.name}
              </h2>

              {auction.description && (
                <p className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-text-dim sm:text-[11px]">
                  {auction.description}
                </p>
              )}

              {/* Larger, readable auction facts */}
              <div className="mt-2 hidden flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] font-medium text-text-dim sm:flex sm:text-[13px]">
                <span>
                  Starts <strong className="font-mono text-[13px] font-semibold text-text-bright sm:text-[14px]">{startingBid.toLocaleString()}</strong> coins
                </span>
                <span className="text-text-dim/45">•</span>
                <span>
                  Ends <strong className="font-mono text-[13px] font-semibold text-text-bright sm:text-[14px]">{formatDateTime(auction.endsAt)}</strong>
                  <span className="ml-1 text-[10px] text-text-dim">UTC+08:00</span>
                </span>
                <span className="text-text-dim/45">•</span>
                <span>
                  Local <strong className="font-mono text-[13px] font-semibold text-text-bright sm:text-[14px]">{formatLocalDateTime(auction.endsAt)}</strong>
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-text-dim sm:hidden">
                <span>Starts <strong className="font-mono font-semibold text-text-bright">{startingBid.toLocaleString()}</strong> coins</span>
                <span className="text-text-dim/45">•</span>
                <span>Ends <strong className="font-mono font-semibold text-text-bright">{formatLocalDateTime(auction.endsAt)}</strong></span>
              </div>

              {/* Blind explanation sits directly under the timing, as helper text. */}
              <div className="mt-1.5 flex flex-col gap-0.5 text-[10px] leading-4 sm:flex-row sm:flex-wrap sm:gap-x-3">
                <span className="font-medium text-text-dim">
                  Your bid is hidden from everyone until close.
                </span>
                <span className="hidden text-text-dim/35 sm:inline">•</span>
                <span className="text-text-dim/70">
                  Your first bid is hidden from other members.
                </span>
              </div>

              <div className="mt-1.5">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-wide ${
                  getBidderCount(auction) === 0
                    ? 'border-white/[.12] bg-white/[.025] text-text-dim'
                    : 'border-gold/25 bg-gold/[.055] text-gold-light'
                }`}>
                  {getBidderCount(auction) > 0 && (
                <span className="font-mono text-[10px] text-gold-bright">{getBidderCount(auction)}</span>
              )}
              <span className={getBidderCount(auction) > 0 ? 'ml-1' : ''}>
                {getBidderCount(auction) === 0 ? 'No Players Bidding' : getBidderCount(auction) === 1 ? 'Player Bidding' : 'Players Bidding'}
              </span>
                </span>
                <span className="ml-2 text-[9px] text-text-dim">Blind bids hidden</span>
              </div>
            </div>

            {/* Bottom action area:
                mobile uses two deliberate rows so the balance, bid field and
                actions never compete for the same narrow horizontal space. */}
            <div className="mt-2 border-t border-white/[.06] pt-2 sm:flex sm:items-center sm:gap-2">
              <div className="flex min-w-0 items-center justify-between sm:shrink-0">
                <div>
                  <div className="text-[7px] font-bold uppercase tracking-[.13em] text-gold-dim">Your Coins</div>
                  <div className="font-mono text-[15px] font-bold tabular-nums text-gold-bright">
                    {availableCoins.toLocaleString()}
                  </div>
                </div>

                <div className="hidden shrink-0 border-l border-white/[.07] pl-3 sm:block">
                  <div className="text-[7px] font-bold uppercase tracking-[.13em] text-text-dim">Reserved</div>
                  <div className="font-mono text-[13px] font-bold tabular-nums text-text-bright">
                    {reservedCoins.toLocaleString()}
                  </div>
                </div>

                <div className="hidden shrink-0 border-l border-white/[.07] pl-3 sm:block">
                  <div className="text-[7px] font-bold uppercase tracking-[.13em] text-text-dim">Current Bid</div>
                  <div className={`font-mono text-[13px] font-bold tabular-nums ${own.hasBid ? 'text-green-300' : 'text-text-dim'}`}>
                    {own.hasBid ? own.amount.toLocaleString() : '—'}
                    {own.hasBid && <span className="ml-1 text-[7px] font-normal text-text-dim">coins</span>}
                  </div>
                </div>
              </div>

              {currentUser && auction.status === 'active' && (
                own.cancelled ? (
                  <div className="mt-2 rounded-md border border-red-500/20 bg-red-500/[.035] px-2.5 py-2 text-center text-[8px] font-bold text-red-400 sm:ml-auto sm:mt-0">
                    BID CANCELLED
                  </div>
                ) : canSubmit ? (
                  <div className="mt-2 flex w-full min-w-0 items-stretch gap-2 sm:ml-auto sm:mt-0 sm:w-auto">
                    <label htmlFor={`featured-blind-bid-${auction.id}`} className="sr-only">
                      Blind bid amount for {auction.name}
                    </label>
                    <input
                      id={`featured-blind-bid-${auction.id}`}
                      className="input h-11 min-w-0 flex-1 px-3 py-2 text-lg font-mono sm:h-8 sm:w-[105px] sm:flex-none sm:px-2 sm:py-1 sm:text-sm"
                      type="number"
                      inputMode="numeric"
                      min={startingBid}
                      step="1"
                      placeholder={String(own.hasBid ? own.amount : startingBid)}
                      value={bidAmount}
                      onChange={e => onBidChange(e.target.value)}
                      onFocus={e => {
                        if (!e.target.value) onBidChange(String(own.hasBid ? own.amount : startingBid))
                      }}
                      aria-label="Your blind bid amount"
                    />
                    <button
                      type="button"
                      onClick={onPlaceBid}
                      className="btn-gold h-11 w-[92px] shrink-0 px-3 text-sm font-bold sm:h-8 sm:w-auto sm:min-w-[66px] sm:px-3 sm:text-[9px]"
                    >
                      {own.hasBid ? 'Change' : 'Bid'}
                    </button>
                  </div>
                ) : (
                  <div className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border px-2.5 py-2 sm:ml-auto sm:mt-0 sm:w-auto ${
                    isUrgent
                      ? 'border-red-500/25 bg-red-500/[.045]'
                      : 'border-red-500/15 bg-red-500/[.025]'
                  }`}>
                    <span className="text-xs">🔒</span>
                    <div className="text-[8px] font-bold text-red-400">Bidding Locked</div>
                  </div>
                )
              )}

              {own.hasBid && !own.cancelled && biddingOpen && (
                <button
                  type="button"
                  onClick={onCancelBid}
                  className="mt-2 h-11 w-full shrink-0 rounded-md border border-red-500/15 bg-transparent px-3 text-[9px] font-semibold uppercase tracking-[.06em] text-red-400/80 hover:border-red-500/35 hover:bg-red-500/[.04] hover:text-red-300 sm:mt-0 sm:w-auto sm:h-8 sm:px-2.5 sm:text-[8px]"
                >
                  Cancel
                </button>
              )}

              <div className="hidden shrink-0 text-right lg:block">
                <div className="text-[7px] uppercase tracking-[.13em] text-text-dim">Changes</div>
                <div className="font-mono text-[11px] font-bold text-gold-light">{own.changesLeft}</div>
              </div>
            </div>
          </div>

          {/* Right-side item image — anchored exactly to the banner edge */}
          {auction.imageUrl ? (
            <div
              className="order-2 absolute right-0 top-0 flex h-[84px] w-[84px] shrink-0 overflow-hidden rounded-lg border bg-black/40 sm:relative sm:right-auto sm:top-auto sm:h-[120px] sm:w-[120px]"
              style={{
                borderColor: rgba(rm.rgb,.42),
                boxShadow: `0 10px 25px -18px ${rgba(rm.rgb,.48)}`,
              }}
            >
              <img
                src={auction.imageUrl}
                alt={auction.name}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={e => { e.currentTarget.style.display='none' }}
              />
            </div>
          ) : (
            <div
              className="order-2 absolute right-0 top-0 flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-lg border bg-black/30 font-spectral text-2xl font-bold sm:relative sm:right-auto sm:top-auto sm:h-[120px] sm:w-[120px]"
              style={{
                borderColor: rgba(rm.rgb,.42),
                color: rm.color,
                backgroundColor: rgba(rm.rgb,.06),
              }}
            >
              {auction.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {isElder && (
          <div className="mt-2 flex items-center gap-2 border-t border-white/[.04] pt-1.5">
            <span className="text-[7px] font-bold uppercase tracking-[.15em] text-text-dim">Admin</span>

            {isMaster && (
              <button
                type="button"
                onClick={onEndEarly}
                className="rounded-md border border-yellow-500/15 bg-yellow-500/[.025] px-2 py-1 text-[8px] font-semibold text-yellow-400 hover:bg-yellow-500/[.07]"
              >
                End Early
              </button>
            )}

            <button
              type="button"
              onClick={onToggleFeatured}
              disabled={featuringInFlight}
              className={`rounded-md border px-2 py-1 text-[8px] font-semibold ${
                isPinned
                  ? 'border-gold/35 bg-gold/[.08] text-gold-bright'
                  : 'border-white/[.08] bg-black/20 text-text-dim hover:text-gold-light'
              }`}
            >
              {featuringInFlight ? '…' : isPinned ? '★ Unfeature' : '☆ Feature'}
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="ml-auto rounded-md px-2 py-1 text-[8px] font-semibold text-red-400/75 hover:bg-red-500/[.06] hover:text-red-300"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function AuctionCard({
  auction, now, currentUser, currentCoins, isElder, isMaster,
  isFeatured, onToggleFeatured, featuringInFlight,
  bidAmount, onBidChange, onPlaceBid, onCancelBid, onEndEarly, onDelete,
}) {
  const rm = getRarityMeta(auction.rarity)
  const remaining = auction.endsAt - now
  const isUrgent = remaining > 0 && remaining < URGENT_MS

  return (
    <article
      className="group relative overflow-hidden rounded-xl border border-white/[.07] bg-[#0c0a09]/90 transition-colors duration-200 hover:border-white/[.13]"
      style={{ boxShadow: GLOW_RARITIES.has(auction.rarity) ? `0 14px 34px -28px ${rgba(rm.rgb,.34)}` : undefined }}
    >
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${rm.color}, ${rgba(rm.rgb,.12)})` }} />

      {isElder && (
        <button
          type="button"
          onClick={onToggleFeatured}
          disabled={featuringInFlight}
          title={isFeatured ? 'Remove from featured' : 'Pin as featured'}
          aria-label={isFeatured ? 'Remove from featured' : 'Pin as featured'}
          className={`absolute right-2.5 top-2.5 z-10 h-7 w-7 rounded-md border flex items-center justify-center text-xs ${
            isFeatured
              ? 'border-gold/40 bg-gold text-black'
              : 'border-white/[.08] bg-black/55 text-gold-light/70 hover:border-gold/35 hover:text-gold-bright'
          }`}
        >
          {featuringInFlight ? '…' : isFeatured ? '★' : '☆'}
        </button>
      )}

      <div className="p-3.5 sm:p-4">
        <div className="flex gap-3">
          {auction.imageUrl ? (
            <div className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-lg border bg-black/35" style={{ borderColor: rgba(rm.rgb,.28) }}>
              <img src={auction.imageUrl} alt={auction.name} loading="lazy" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display='none' }} />
            </div>
          ) : (
            <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-lg border bg-black/30 font-spectral text-xl font-bold" style={{ borderColor: rgba(rm.rgb,.28), color: rm.color }}>
              {auction.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1 pr-7">
            <div className="flex flex-wrap items-center gap-1.5">
              <RarityBadge rarity={auction.rarity} />
              <BlindStatusPill>Blind</BlindStatusPill>
            </div>
            <h3 className="mt-1 break-words text-[15px] font-bold leading-5" style={{ color: rm.color }}>{auction.name}</h3>
            {auction.description && <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-text-dim">{auction.description}</p>}
          </div>

          <div className="hidden shrink-0 text-right sm:block">
            <div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Time</div>
            <div className={`mt-0.5 font-mono text-[15px] font-bold tabular-nums ${isUrgent ? 'text-red-400 motion-safe:animate-pulse' : 'text-gold-light'}`}>
              {formatCountdown(auction.endsAt, now)}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3 border-y border-white/[.05] py-2 sm:mt-3 sm:py-2.5">
          <div className="min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-[.13em] text-text-dim">Starting Bid </span>
            <span className="font-mono text-sm font-bold tabular-nums" style={{ color: rm.color }}>{getStartingBid(auction).toLocaleString()}</span>
            <span className="ml-1 text-[9px] text-text-dim">coins</span>
          </div>

          <div className="text-right">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-wide ${
                  getBidderCount(auction) === 0
                    ? 'border-white/[.12] bg-white/[.025] text-text-dim'
                    : 'border-gold/25 bg-gold/[.055] text-gold-light'
                }`}>
              {getBidderCount(auction) > 0 && (
                <span className="font-mono text-[10px] text-gold-bright">{getBidderCount(auction)}</span>
              )}
              <span className={getBidderCount(auction) > 0 ? 'ml-1' : ''}>
                {getBidderCount(auction) === 0 ? 'No Players Bidding' : getBidderCount(auction) === 1 ? 'Player Bidding' : 'Players Bidding'}
              </span>
            </span>
            <div className="mt-1 text-[9px] text-text-dim">Other bids hidden</div>
          </div>
        </div>

        {/* Mobile countdown: intentionally compact so it reads as a status, not a second content card. */}
        <div className={`mt-2.5 flex items-center justify-between gap-3 border-y px-1 py-2 sm:hidden ${
          isUrgent ? 'border-red-500/20' : 'border-gold/[.10]'
        }`}>
          <div className="min-w-0">
            <div className={`text-[8px] font-bold uppercase tracking-[.16em] ${
              isUrgent ? 'text-red-400' : 'text-text-dim'
            }`}>
              Ends In
            </div>
            <div className="mt-0.5 text-[8px] text-text-dim/70">
              {isUrgent ? 'Final 30 seconds' : 'Auction is live'}
            </div>
          </div>
          <div className={`shrink-0 rounded-md px-2.5 py-1 ${
            isUrgent
              ? 'bg-red-500/[.08] text-red-400'
              : 'bg-gold/[.06] text-gold-light'
          }`}>
            <span className={`font-mono text-[15px] font-bold leading-none tabular-nums ${
              isUrgent ? 'motion-safe:animate-pulse' : ''
            }`}>
              {formatCountdown(auction.endsAt, now)}
            </span>
          </div>
        </div>

        <BlindBidPanel
          auction={auction}
          now={now}
          currentUser={currentUser}
          currentCoins={currentCoins}
          bidAmount={bidAmount}
          onBidChange={onBidChange}
          onPlaceBid={onPlaceBid}
          onCancelBid={onCancelBid}
        />

        <div className="mt-2.5 flex items-center justify-between gap-3 text-[9px] text-text-dim">
          <span>Ends {formatDateTime(auction.endsAt)} {SERVER_TZ_SHORT}</span>
          <span>Local {formatLocalDateTime(auction.endsAt)}</span>
        </div>

        {isElder && (
          <div className="mt-2.5 flex items-center gap-2 border-t border-white/[.05] pt-2.5">
            {isMaster && (
              <button type="button" onClick={onEndEarly} className="rounded-md px-2 py-1.5 text-[9px] font-semibold text-yellow-400 hover:bg-yellow-500/[.07]">
                End Early
              </button>
            )}
            <button type="button" onClick={onDelete} aria-label={`Delete auction: ${auction.name}`} className="ml-auto rounded-md px-2 py-1.5 text-[9px] font-semibold text-red-400/75 hover:bg-red-500/[.07]">
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

function EndedAuctionRow({
  auction: a, now, currentUser, isElder, distributors,
  isExpanded, onToggle, onAssignDistributor, onDelete,
  isSelected = false, onToggleSelect,
}) {
  const finalBids = getFinalBidEntries(a)
  const winnerEntry = finalBids[0] || null
  const winner = winnerEntry?.bidder || a.topBidder || ''
  const finalAmount = winnerEntry?.amount || Number(a.currentBid) || 0
  const isMe = !!winner && currentUser?.name === winner
  const endedAt = a.endedAt || a.endsAt || 0
  const agoLabel = endedAt > 0 ? formatRelativePast(now - endedAt) : ''
  const assignedName = a.distributedBy || ''
  const rm = getRarityMeta(a.rarity)

  return (
    <li className={isMe ? 'bg-green-500/[.018]' : ''}>
      <div className="px-3 py-3.5 sm:px-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(360px,1fr)_135px_125px_165px_auto] lg:items-start lg:gap-4">
          <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
            {isElder && (
              <label className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/[.08] bg-black/20 hover:border-gold/30">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onToggleSelect}
                  className="h-4 w-4 accent-yellow-500"
                  aria-label={`Select auction: ${a.name}`}
                />
              </label>
            )}
            {a.imageUrl ? (
              <ItemImage src={a.imageUrl} alt={a.name} size={48} />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-black/20 font-spectral text-lg font-bold" style={{ borderColor: rgba(rm.rgb,.25), color: rm.color }}>
                {a.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: rm.color }} />
                <span className="truncate text-[13px] font-bold" style={{ color: rm.color }}>{a.name}</span>
                <RarityBadge rarity={a.rarity} />
                {isMe && (
                  <span className="shrink-0 rounded-full border border-green-500/20 bg-green-500/[.05] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-green-400">
                    You Won
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-dim">
                {endedAt > 0 ? (
                  <>
                    <span>{agoLabel || 'Closed'}</span>
                    <span className="text-text-dim/45">·</span>
                    <span>Server {formatClock(endedAt)} {SERVER_TZ_SHORT}</span>
                    <span className="text-text-dim/45">·</span>
                    <span>Local {formatLocalClock(endedAt)}</span>
                  </>
                ) : (
                  'Closed'
                )}
              </div>
              <div className="mt-1">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                  finalBids.length === 0
                    ? 'border-white/[.14] bg-white/[.03] text-text-dim'
                    : 'border-gold/30 bg-gold/[.07] text-gold-light'
                }`}>
                  {finalBids.length > 0 && (
                    <span className="font-mono text-[11px] font-bold text-gold-bright">{finalBids.length}</span>
                  )}
                  <span className={finalBids.length > 0 ? 'ml-1' : ''}>
                    {finalBids.length === 0 ? 'No Players Bidding' : finalBids.length === 1 ? 'Player Bidding' : 'Players Bidding'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="contents">
            <div className="min-w-0 self-start sm:col-span-1 lg:col-span-1">
              <div className="text-[8px] font-bold uppercase tracking-[.13em] text-text-dim">Winner</div>
              <div className={`mt-1 max-w-[150px] truncate text-[12px] font-semibold leading-5 ${isMe ? 'text-green-400' : 'text-text-bright'}`}>
                {winner || <span className="italic font-normal text-text-dim">No bids</span>}
              </div>
            </div>

            <div className="self-start sm:col-span-1 lg:col-span-1">
              <div className="text-[8px] font-bold uppercase tracking-[.13em] text-text-dim">Winning Bid</div>
              <div className="mt-1 font-mono text-[14px] font-bold leading-5 tabular-nums text-gold-bright">
                {finalAmount.toLocaleString()} <span className="text-[9px] font-semibold text-text-dim">coins</span>
              </div>
            </div>

            {winner && (
              <div className="min-w-0 self-start sm:col-span-2 lg:col-span-1">
                <div className="text-[8px] font-bold uppercase tracking-[.13em] text-text-dim">Distribution</div>
                {isElder ? (
                  <select
                    className="input mt-1 h-8 max-w-[155px] px-2 text-[10px]"
                    value={assignedName}
                    onChange={e => onAssignDistributor(e.target.value)}
                    aria-label={`Distributor for ${a.name}`}
                  >
                    <option value="">Not yet assigned</option>
                    {distributors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                ) : (
                  <div className="mt-0.5"><DistributorStatusBadge name={assignedName} /></div>
                )}
              </div>
            )}
          </div>

          <div className="col-span-2 flex shrink-0 items-center justify-start gap-2 border-t border-white/[.05] pt-2.5 sm:justify-end lg:col-span-1 lg:mt-5 lg:border-0 lg:pt-0">
            {finalBids.length > 0 && (
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={isExpanded}
                className="rounded-md border border-white/[.07] bg-black/15 px-2.5 py-1.5 text-[9px] font-bold text-gold-light hover:border-gold/25 hover:bg-gold/[.025]"
              >
                {isExpanded ? 'Hide Results' : 'Reveal Results'}
              </button>
            )}
            {isElder && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete auction: ${a.name}`}
                className="rounded-md px-2 py-1.5 text-[9px] font-semibold text-red-400/75 hover:bg-red-500/[.07] hover:text-red-300"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {isExpanded && finalBids.length > 0 && (
          <div className="mt-2.5 overflow-hidden rounded-lg border border-white/[.06] bg-black/15">
            <div className="divide-y divide-white/[.04]">
              {finalBids.map((b, idx) => {
                const isWinner = idx === 0
                return (
                  <div
                    key={`${b.bidder}-${b.time}-${idx}`}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 ${
                      isWinner ? 'bg-green-500/[.03]' : ''
                    }`}
                  >
                    <div className={`min-w-0 truncate text-[13px] font-semibold ${isWinner ? 'text-green-300' : 'text-text-bright'}`}>
                      {b.bidder}
                    </div>
                    <div className={`text-right font-mono text-[13px] font-bold tabular-nums ${isWinner ? 'text-green-300' : 'text-text-bright'}`}>
                      {b.amount.toLocaleString()} <span className="text-[8px] font-semibold text-text-dim">coins</span>
                    </div>
                    <div className={`font-mono text-[10px] ${isWinner ? 'text-green-400' : 'text-text-dim'}`}>
                      Final bid · {formatClock(b.time)} {SERVER_TZ_SHORT} · Local {formatLocalClock(b.time)}
                    </div>
                    <div className="text-right text-[9px] font-bold uppercase tracking-[.12em] text-green-400">
                      {isWinner ? 'Winner' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
            {endedAt > 0 && (
              <div className="border-t border-white/[.05] px-4 py-2 text-[10px] text-text-dim">
                Closed {formatDateTime(endedAt)} {SERVER_TZ_SHORT} · Local {formatLocalDateTime(endedAt)}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

