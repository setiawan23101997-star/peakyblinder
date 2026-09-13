import React, { useState, useEffect, useMemo, useId, useRef } from 'react'

const RARITY = {
  material:   { label: 'Common',    color: '#4ade80', rgb: '74,222,128' },
  uncommon:   { label: 'Uncommon',  color: '#ffffff', rgb: '255,255,255' },
  rare:       { label: 'Rare',      color: '#60a5fa', rgb: '96,165,250' },
  epic:       { label: 'Epic',      color: '#f87171', rgb: '248,113,113' },
  legendary:  { label: 'Legendary', color: '#f2cc60', rgb: '242,204,76' },
}

const GLOW_RARITIES = new Set(['legendary'])
const URGENT_MS = 5 * 60 * 1000
const MIN_BID_INCREMENT = 5

const SERVER_TZ_LABEL = 'GMT+8'

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

function formatServerClock(ts) {
  const p = serverParts(ts)
  if (!p) return '—'
  return `${pad2(p.d)} ${MONTH_SHORT_ARR[p.m]} ${p.y}, ${pad2(p.hh)}:${pad2(p.mm)}:${pad2(p.ss)}`
}

function formatClock(ts) {
  const p = serverParts(ts)
  if (!p) return '—'
  return `${pad2(p.hh)}:${pad2(p.mm)}`
}

function formatDateTime(ts) {
  const p = serverParts(ts)
  if (!p) return '—'
  return `${pad2(p.d)} ${MONTH_SHORT_ARR[p.m]}, ${pad2(p.hh)}:${pad2(p.mm)}`
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
  return auction.status === 'active' && (auction.endsAt - now) > URGENT_MS
}
function minNextBidFor(auction) {
  return (auction?.currentBid || 0) + MIN_BID_INCREMENT
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
      is_featured: false,
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
      isFeatured: false,
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
      const { error } = await supabase
        .from('auctions')
        .update({ status: 'ended', is_featured: false })
        .eq('id', auctionId)
      if (error) { addToast(`Couldn't end auction: ${error.message}`, 'red', 'Save Failed'); return }
      setAuctions(prev => prev.map(a => a.id === auctionId ? { ...a, status: 'ended', endedAt: Date.now(), isFeatured: false } : a))
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
    <div className="space-y-6">
      {/* Page header */}
      <header className="relative overflow-hidden rounded-2xl border border-gold/15 bg-[#0c0a09]/90">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: 'radial-gradient(circle at 0% 0%, rgba(242,204,96,.07), transparent 38%), linear-gradient(120deg, rgba(255,255,255,.02), transparent 42%)',
          }}
        />
        <div className="relative p-5 md:p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_10px_rgba(242,204,96,.7)]" />
                <span className="text-[10px] font-bold uppercase tracking-[.22em] text-gold-dim">Clan Auction House</span>
              </div>
              <h1 className="font-spectral text-3xl md:text-4xl font-bold tracking-tight text-text-bright">
                Auctions
              </h1>
              <p className="mt-1.5 text-sm text-text-dim max-w-2xl">
                Compete for rare clan items, track live bids, and secure your next reward.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/[.07] bg-black/20 px-3.5 py-2.5 min-w-[105px]">
                <div className="text-[9px] font-bold uppercase tracking-[.15em] text-text-dim">Live</div>
                <div className="mt-1 text-xl font-mono font-bold tabular-nums text-gold-bright">{activeAuctions.length}</div>
              </div>
              <div className="rounded-xl border border-white/[.07] bg-black/20 px-3.5 py-2.5 min-w-[105px]">
                <div className="text-[9px] font-bold uppercase tracking-[.15em] text-text-dim">Completed</div>
                <div className="mt-1 text-xl font-mono font-bold tabular-nums text-text-bright">{endedAuctions.length}</div>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-xl border border-gold/20 bg-gold/[.045] px-3.5 py-2.5 min-w-[105px]">
                <div className="text-[9px] font-bold uppercase tracking-[.15em] text-gold-dim">Server Time</div>
                <div className="mt-1 text-sm font-mono font-bold tabular-nums text-gold-light whitespace-nowrap">
                  {formatClock(now)}
                </div>
                <div className="text-[9px] text-text-dim mt-0.5">{SERVER_TZ_LABEL}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/[.07] bg-black/20 px-3 py-2 text-[11px] text-text-dim">
              <span className="text-green-400">●</span>
              <span><span className="text-text-bright font-semibold">{activeAuctions.length}</span> live auction{activeAuctions.length === 1 ? '' : 's'}</span>
            </div>
            {featuredAuction && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/[.04] px-3 py-2 text-[11px] text-gold-light">
                <span>★</span>
                <span>Featured lot active</span>
              </div>
            )}
            {pendingDistribution > 0 && isElder && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/25 bg-yellow-500/[.04] px-3 py-2 text-[11px] text-yellow-400">
                <span>!</span>
                <span><strong>{pendingDistribution}</strong> awaiting distribution</span>
              </div>
            )}
            <div className="ml-auto">
              {isElder && (
                <button
                  onClick={() => setShowCreate(!showCreate)}
                  className="btn-gold min-h-10 px-4 text-sm font-bold"
                  aria-expanded={showCreate}
                >
                  {showCreate ? '✕ Close' : '+ Create Auction'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Auction rules */}
      <div className="rounded-xl border border-white/[.06] bg-black/20">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-[11px] text-text-dim">
          <span className="inline-flex items-center gap-2"><span className="text-gold-light">↗</span> Minimum increment <strong className="text-text-bright">+{MIN_BID_INCREMENT}</strong></span>
          <span className="hidden sm:inline text-white/10">|</span>
          <span className="inline-flex items-center gap-2"><span className="text-yellow-400">◷</span> Bidding locks in the final <strong className="text-text-bright">5 minutes</strong></span>
          <span className="hidden md:inline text-white/10">|</span>
          <span className="inline-flex items-center gap-2"><span className="text-gold-light">◉</span> All auction times use <strong className="text-text-bright">{SERVER_TZ_LABEL}</strong></span>
          <button
            type="button"
            onClick={() => setShowLegend(v => !v)}
            aria-expanded={showLegend}
            className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-gold-light hover:text-gold-bright transition-colors"
          >
            {showLegend ? 'Hide guide' : 'Auction guide'}
            <span className={`transition-transform ${showLegend ? 'rotate-180' : ''}`}>⌄</span>
          </button>
        </div>
        {showLegend && (
          <div className="border-t border-white/[.06] px-4 py-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-text-dim">
            <div><span className="text-gold-light font-semibold">Winner</span> — the highest bidder when the auction closes.</div>
            <div><span className="text-yellow-400 font-semibold">Awaiting hand-out</span> — an admin still needs to deliver the item in-game.</div>
            <div><span className="text-green-400 font-semibold">Delivered</span> — the winning item has been handed to the winner.</div>
          </div>
        )}
      </div>

      {/* Distribution notice */}
      {isElder && pendingDistribution > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/[.035] px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400">!</span>
          <div className="min-w-0">
            <div className="text-xs font-bold text-yellow-400">Distribution requires attention</div>
            <div className="mt-0.5 text-[11px] text-text-dim">
              {pendingDistribution} {pendingDistribution === 1 ? 'winning item is' : 'winning items are'} still waiting for a distributor.
            </div>
          </div>
        </div>
      )}

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
                    <div><span className="text-text-dim">Closes</span><div className="mt-1 font-mono font-bold text-gold-light">{formatClock(Date.now() + (parseInt(newItem.duration) || 60) * 60000)} server</div></div>
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
                The auction will use <span className="text-text-bright font-semibold">{SERVER_TZ_LABEL}</span> and begin immediately after creation.
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
          isElder={isElder}
          isMaster={isMaster}
          isPinned={!!featuredAuction.isFeatured}
          onToggleFeatured={() => toggleFeatured(featuredAuction.id)}
          featuringInFlight={featuringInFlight}
          bidAmount={bidAmounts[featuredAuction.id] || ''}
          onBidChange={v => setBidAmounts(prev => ({ ...prev, [featuredAuction.id]: v }))}
          onPlaceBid={() => placeBid(featuredAuction.id)}
          onEndEarly={() => endAuction(featuredAuction.id)}
          onDelete={() => deleteAuction(featuredAuction.id)}
          isBidsExpanded={!!expandedBids[featuredAuction.id]}
          onToggleBids={() => toggleBidsExpanded(featuredAuction.id)}
        />
      )}

      {otherActiveAuctions.length === 0 && !featuredAuction ? (
        <div className="rounded-2xl border border-dashed border-white/[.09] bg-black/15 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-gold/15 bg-gold/[.04] text-gold-light">◇</div>
          <div className="mt-4 text-sm font-semibold text-text-bright">No Live Auctions</div>
          <div className="mt-1 text-xs text-text-dim">New clan auctions will appear here when they go live.</div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {otherActiveAuctions.map(auction => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                now={now}
                currentUser={currentUser}
                isElder={isElder}
                isMaster={isMaster}
                isFeatured={!!auction.isFeatured}
                onToggleFeatured={() => toggleFeatured(auction.id)}
                featuringInFlight={featuringInFlight}
                bidAmount={bidAmounts[auction.id] || ''}
                onBidChange={v => setBidAmounts(prev => ({ ...prev, [auction.id]: v }))}
                onPlaceBid={() => placeBid(auction.id)}
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
            <div className="text-[10px] text-text-dim">Review winners, final bids, and distribution status.</div>
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

function FeaturedAuctionCard({
  auction, now, currentUser, isElder, isMaster,
  isPinned, onToggleFeatured, featuringInFlight,
  bidAmount, onBidChange, onPlaceBid, onEndEarly, onDelete,
  isBidsExpanded, onToggleBids,
}) {
  const isWinning = auction.topBidder === currentUser?.name
  const bids = auction.bids || []
  const history = useMemo(() => [...bids].reverse(), [bids])
  const rm = getRarityMeta(auction.rarity)
  const remaining = auction.endsAt - now
  const isUrgent = remaining > 0 && remaining < URGENT_MS
  const biddingOpen = isBiddingOpen(auction, now)
  const minNextBid = auction.currentBid + MIN_BID_INCREMENT

  return (
    <section
      className="relative overflow-hidden rounded-2xl border bg-[#0b0908]/95"
      style={{
        borderColor: rgba(rm.rgb, 0.34),
        boxShadow: `0 22px 60px -34px ${rgba(rm.rgb, 0.42)}, inset 0 1px 0 rgba(255,255,255,.035)`,
      }}
      aria-label={`Featured auction: ${auction.name}`}
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{
        background: `radial-gradient(circle at 0% 0%, ${rgba(rm.rgb,.12)}, transparent 34%), radial-gradient(circle at 100% 100%, ${rgba(rm.rgb,.045)}, transparent 40%)`,
      }} />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.06] bg-black/25 px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <FeaturedPill rarityMeta={rm} />
            <div className="hidden sm:block">
              <div className="text-[9px] font-bold uppercase tracking-[.18em] text-gold-dim">Featured Lot</div>
              <div className="text-[11px] text-text-dim">Priority auction selected by clan leadership</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Time Remaining</span>
            <span className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums ${isUrgent ? 'border-red-500/30 bg-red-500/[.07] text-red-400 motion-safe:animate-pulse' : 'border-gold/20 bg-gold/[.04]'}`} style={!isUrgent ? { color: rm.color } : undefined}>
              {formatCountdown(auction.endsAt, now)}
            </span>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[148px_minmax(0,1fr)_330px] gap-5 lg:gap-7">
            <div className="flex justify-center lg:justify-start">
              {auction.imageUrl ? (
                <div className="relative h-[148px] w-[148px] overflow-hidden rounded-2xl border bg-black/40" style={{ borderColor: rgba(rm.rgb,.45), boxShadow: `0 18px 40px -20px ${rgba(rm.rgb,.5)}` }}>
                  <img src={auction.imageUrl} alt={auction.name} loading="lazy" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display='none' }} />
                  <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 0 1px ${rgba(rm.rgb,.1)}` }} />
                </div>
              ) : (
                <div className="flex h-[148px] w-[148px] items-center justify-center rounded-2xl border bg-black/30 font-spectral text-5xl font-bold" style={{ borderColor: rgba(rm.rgb,.45), color: rm.color, backgroundColor: rgba(rm.rgb,.07) }}>
                  {auction.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex flex-wrap items-center gap-2">
                <RarityBadge rarity={auction.rarity} />
                {isWinning && <span className="rounded-full border border-green-500/25 bg-green-500/[.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green-400">Leading</span>}
              </div>
              <h2 className="mt-2 font-spectral text-2xl md:text-3xl xl:text-[36px] font-bold leading-[1.04] text-text-bright break-words">{auction.name}</h2>
              {auction.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-text-dim">{auction.description}</p>}

              <div className="mt-5 grid grid-cols-2 gap-2.5 max-w-xl">
                <div className="rounded-xl border border-white/[.07] bg-black/25 px-3.5 py-3">
                  <div className="text-[9px] font-bold uppercase tracking-[.15em] text-text-dim">Current Bid</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: rm.color }}>{auction.currentBid.toLocaleString()}</span>
                    <span className="text-[10px] text-text-dim">coins</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/[.07] bg-black/25 px-3.5 py-3 min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-[.15em] text-text-dim">Leading Bidder</div>
                  <div className={`mt-1 truncate text-sm font-semibold ${isWinning ? 'text-green-400' : 'text-text-bright'}`}>{auction.topBidder || 'No bids yet'}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-text-dim">
                <span>Ends <span className="font-mono text-gold-light">{formatDateTime(auction.endsAt)}</span> server</span>
                {isWinning && <span className="font-semibold text-green-400">✓ You are currently leading</span>}
              </div>
            </div>

            <div className="rounded-2xl border border-gold/20 bg-gradient-to-b from-gold/[.055] to-black/25 p-4 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[.18em] text-gold-dim">Place Your Bid</div>
                  <div className="mt-1 text-xs text-text-dim">Minimum accepted bid</div>
                </div>
                <span className={`mt-1 h-2 w-2 rounded-full ${biddingOpen ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,.55)]' : 'bg-red-400 shadow-[0_0_10px_rgba(239,68,68,.45)]'}`} />
              </div>

              <div className="mt-4 rounded-xl border border-white/[.07] bg-black/25 p-3">
                <div className="text-[9px] font-bold uppercase tracking-wider text-text-dim">Minimum Bid</div>
                <div className="mt-1 font-mono text-lg font-bold text-gold-light">{minNextBid.toLocaleString()} <span className="text-[10px] font-normal text-text-dim">coins</span></div>
              </div>

              {currentUser && auction.status === 'active' ? (
                biddingOpen ? (
                  <div className="mt-3">
                    <label htmlFor={`featured-bid-${auction.id}`} className="sr-only">Bid amount for {auction.name}</label>
                    <div className="flex gap-2">
                      <input id={`featured-bid-${auction.id}`} className="input min-w-0 flex-1 text-base font-mono" type="number" min={minNextBid} step={MIN_BID_INCREMENT} placeholder={String(minNextBid)} value={bidAmount} onChange={e => onBidChange(e.target.value)} onFocus={e => { if (!e.target.value) onBidChange(String(minNextBid)) }} />
                      <button onClick={onPlaceBid} className="btn-gold px-5 font-bold">Bid</button>
                    </div>
                    <div className="mt-2 text-[10px] text-text-dim">Bids increase by at least <span className="font-semibold text-gold-light">{MIN_BID_INCREMENT}</span> coins.</div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/[.06] p-3">
                    <div className="text-xs font-bold text-red-400">🔒 Bidding Locked</div>
                    <div className="mt-1 text-[10px] leading-4 text-text-dim">Bidding closes during the final 5 minutes.</div>
                  </div>
                )
              ) : (
                <div className="mt-3 rounded-xl border border-white/[.07] bg-black/20 p-3 text-xs text-text-dim">Sign in to participate in this auction.</div>
              )}
            </div>
          </div>

          {history.length > 0 && (
            <div className="mt-6 border-t border-white/[.06] pt-4">
              <button type="button" onClick={onToggleBids} aria-expanded={isBidsExpanded} className="inline-flex items-center gap-2 rounded-lg text-[10px] font-bold uppercase tracking-[.16em] text-text-dim hover:text-gold-light">
                <span className={`transition-transform ${isBidsExpanded ? 'rotate-180' : ''}`}>⌄</span>
                Bid Activity <span className="font-mono text-gold-light">{history.length}</span>
              </button>
              {isBidsExpanded && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1" role="list">
                  {history.map((b, idx) => {
                    const isCurrentTop = idx === 0
                    return (
                      <div key={b.time || idx} role="listitem" className={`rounded-xl border px-3.5 py-3 ${isCurrentTop ? 'border-green-500/25 bg-green-500/[.055]' : 'border-white/[.06] bg-black/20'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-xs font-semibold ${isCurrentTop ? 'text-green-300' : 'text-text-dim'}`}>{b.bidder}</span>
                          <span className={`font-mono text-xs font-bold tabular-nums ${isCurrentTop ? 'text-green-300' : 'text-text-dim'}`}>{b.amount.toLocaleString()}</span>
                        </div>
                        <div className={`mt-1 text-[10px] ${isCurrentTop ? 'text-green-400' : 'text-text-dim/70'}`}>{isCurrentTop ? (auction.topBidder === currentUser?.name ? 'Winning' : 'Leading') : 'Outbid'} · {formatClock(b.time)} server</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {isElder && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[.06] pt-4">
              <span className="mr-1 text-[9px] font-bold uppercase tracking-[.16em] text-text-dim">Admin</span>
              {isMaster && <button onClick={onEndEarly} className="rounded-lg border border-yellow-500/20 bg-yellow-500/[.035] px-3 py-2 text-[11px] font-semibold text-yellow-400 hover:bg-yellow-500/[.08]">⏹ End Early</button>}
              <button onClick={onToggleFeatured} disabled={featuringInFlight} className={`rounded-lg border px-3 py-2 text-[11px] font-semibold ${isPinned ? 'border-gold/35 bg-gold/[.08] text-gold-bright' : 'border-white/[.08] bg-black/20 text-text-dim hover:text-gold-light'}`}>
                {featuringInFlight ? '…' : isPinned ? '★ Unfeature' : '☆ Feature'}
              </button>
              <button onClick={onDelete} className="ml-auto rounded-lg px-3 py-2 text-[11px] font-semibold text-red-400/80 hover:bg-red-500/[.06] hover:text-red-300">Delete</button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function AuctionCard({
  auction, now, currentUser, isElder, isMaster,
  isFeatured, onToggleFeatured, featuringInFlight,
  bidAmount, onBidChange, onPlaceBid, onEndEarly, onDelete,
  isBidsExpanded, onToggleBids,
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
    <article
      className={`group relative overflow-hidden rounded-2xl border bg-[#0c0a09]/90 transition-all duration-200 hover:-translate-y-0.5 ${isWinning ? 'border-green-500/25' : 'border-white/[.07] hover:border-white/[.13]'}`}
      style={{
        boxShadow: glow && !isWinning ? `0 18px 42px -30px ${rgba(rm.rgb,.38)}` : undefined,
      }}
    >
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${rm.color}, ${rgba(rm.rgb,.18)})` }} />

      {isElder && (
        <button type="button" onClick={onToggleFeatured} disabled={featuringInFlight} title={isFeatured ? 'Remove from featured' : 'Pin as featured'} aria-label={isFeatured ? 'Remove from featured' : 'Pin as featured'} className={`absolute right-3 top-3 z-10 h-8 w-8 rounded-lg border flex items-center justify-center text-sm transition-colors ${isFeatured ? 'border-gold/40 bg-gold text-black' : 'border-white/[.08] bg-black/50 text-gold-light/70 hover:border-gold/35 hover:text-gold-bright'}`}>
          {featuringInFlight ? '…' : isFeatured ? '★' : '☆'}
        </button>
      )}

      <div className="p-4">
        <div className="flex gap-3">
          {auction.imageUrl ? (
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border bg-black/35" style={{ borderColor: rgba(rm.rgb,.28) }}>
              <img src={auction.imageUrl} alt={auction.name} loading="lazy" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display='none' }} />
            </div>
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl border bg-black/30 font-spectral text-2xl font-bold" style={{ borderColor: rgba(rm.rgb,.28), color: rm.color }}>{auction.name.charAt(0).toUpperCase()}</div>
          )}

          <div className="min-w-0 flex-1 pr-8">
            <div className="flex flex-wrap items-center gap-1.5">
              <RarityBadge rarity={auction.rarity} />
              {isWinning && <span className="rounded-full bg-green-500/[.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green-400">Leading</span>}
            </div>
            <h3 className="mt-1.5 truncate text-base font-bold" style={{ color: rm.color }}>{auction.name}</h3>
            {auction.description && <p className="mt-0.5 truncate text-[11px] text-text-dim">{auction.description}</p>}
          </div>
        </div>

        <div className={`mt-4 rounded-xl border ${isUrgent ? 'border-red-500/20 bg-red-500/[.035]' : 'border-white/[.06] bg-black/20'} px-3 py-2.5`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Time Remaining</div>
              <div className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${isUrgent ? 'text-red-400 motion-safe:animate-pulse' : 'text-gold-light'}`}>{formatCountdown(auction.endsAt, now)}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Ends</div>
              <div className="mt-0.5 text-[10px] font-mono text-text-dim">{formatDateTime(auction.endsAt)}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/[.06] bg-black/15 px-3 py-2.5">
            <div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Current Bid</div>
            <div className="mt-0.5 font-mono text-lg font-bold tabular-nums" style={{ color: rm.color }}>{auction.currentBid.toLocaleString()}</div>
            <div className="text-[9px] text-text-dim">coins</div>
          </div>
          <div className="rounded-xl border border-white/[.06] bg-black/15 px-3 py-2.5 min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim">Leading Bidder</div>
            <div className={`mt-1 truncate text-xs font-semibold ${isWinning ? 'text-green-400' : 'text-text-bright'}`}>{auction.topBidder || 'No bids yet'}</div>
            <div className="mt-1 text-[9px] text-text-dim">{history.length} bid{history.length === 1 ? '' : 's'}</div>
          </div>
        </div>

        {currentUser && auction.status === 'active' && (
          biddingOpen ? (
            <div className="mt-3 rounded-xl border border-gold/15 bg-gold/[.025] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[.14em] text-gold-dim">Your Bid</span>
                <span className="text-[10px] text-text-dim">Min <span className="font-mono font-bold text-gold-light">{minNextBid.toLocaleString()}</span></span>
              </div>
              <div className="flex gap-2">
                <label htmlFor={`bid-${auction.id}`} className="sr-only">Bid amount for {auction.name}</label>
                <input id={`bid-${auction.id}`} className="input min-w-0 flex-1 text-sm font-mono" type="number" min={minNextBid} step={MIN_BID_INCREMENT} placeholder={String(minNextBid)} value={bidAmount} onChange={e => onBidChange(e.target.value)} onFocus={e => { if (!e.target.value) onBidChange(String(minNextBid)) }} />
                <button onClick={onPlaceBid} className="btn-gold px-4 text-sm font-bold">Bid</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[.05] p-3">
              <div className="text-xs font-bold text-red-400">🔒 Bidding Locked</div>
              <div className="mt-1 text-[10px] text-text-dim">Final 5 minutes — auction closes automatically.</div>
            </div>
          )
        )}

        {history.length > 0 && (
          <div className="mt-3 border-t border-white/[.06] pt-3">
            <button type="button" onClick={onToggleBids} aria-expanded={isBidsExpanded} className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.13em] text-text-dim hover:text-gold-light">
              <span className={`transition-transform ${isBidsExpanded ? 'rotate-180' : ''}`}>⌄</span>
              Bid History <span className="font-mono text-gold-light">{history.length}</span>
            </button>
            {isBidsExpanded && (
              <div className="mt-2 max-h-[180px] space-y-1.5 overflow-y-auto pr-1" role="list">
                {history.map((b, idx) => {
                  const isCurrentTop = idx === 0
                  return (
                    <div key={b.time || idx} role="listitem" className={`rounded-lg border px-2.5 py-2 ${isCurrentTop ? 'border-green-500/20 bg-green-500/[.05]' : 'border-white/[.05] bg-black/15'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-[11px] font-semibold ${isCurrentTop ? 'text-green-300' : 'text-text-dim'}`}>{b.bidder}</span>
                        <span className={`font-mono text-[11px] font-bold ${isCurrentTop ? 'text-green-300' : 'text-text-dim'}`}>{b.amount.toLocaleString()}</span>
                      </div>
                      <div className={`mt-0.5 text-[9px] ${isCurrentTop ? 'text-green-400' : 'text-text-dim/70'}`}>{isCurrentTop ? (auction.topBidder === currentUser?.name ? 'Winning' : 'Leading') : 'Outbid'} · {formatClock(b.time)} server</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {isElder && (
          <div className="mt-3 flex items-center gap-2 border-t border-white/[.06] pt-3">
            {isMaster && <button onClick={onEndEarly} className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-yellow-400 hover:bg-yellow-500/[.07]">End Early</button>}
            <button onClick={onDelete} aria-label={`Delete auction: ${auction.name}`} className="ml-auto rounded-lg px-2 py-1.5 text-[10px] font-semibold text-red-400/80 hover:bg-red-500/[.07]">Delete</button>
          </div>
        )}
      </div>
    </article>
  )
}

function EndedAuctionRow({
  auction: a, now, currentUser, isElder, distributors,
  isExpanded, onToggle, onAssignDistributor, onDelete,
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
    <li className={`${isMe ? 'bg-green-500/[.025]' : ''}`}>
      <div className="px-4 py-3.5 md:px-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {a.imageUrl ? (
            <ItemImage src={a.imageUrl} alt={a.name} size={48} />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border bg-black/20 font-spectral text-lg font-bold" style={{ borderColor: rgba(rm.rgb,.25), color: rm.color }}>{a.name.charAt(0).toUpperCase()}</div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rm.color }} />
              <span className="truncate text-sm font-bold" style={{ color: rm.color }}>{a.name}</span>
              <RarityBadge rarity={a.rarity} />
              {isMe && <span className="rounded-full border border-green-500/20 bg-green-500/[.05] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green-400">You Won</span>}
            </div>
            {a.description && <div className="mt-0.5 truncate text-[10px] text-text-dim">{a.description}</div>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:items-center gap-2 sm:gap-5 lg:gap-6">
            <div className="min-w-[100px]">
              <div className="text-[9px] font-bold uppercase tracking-[.13em] text-text-dim">Winner</div>
              <div className={`mt-0.5 max-w-[130px] truncate text-xs font-semibold ${isMe ? 'text-green-400' : 'text-text-bright'}`}>{winner || <span className="italic font-normal text-text-dim">No bids</span>}</div>
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase tracking-[.13em] text-text-dim">Final Bid</div>
              <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-gold-bright">{(a.currentBid || 0).toLocaleString()}</div>
            </div>

            <div className="min-w-[145px]">
              <div className="text-[9px] font-bold uppercase tracking-[.13em] text-text-dim">Distribution</div>
              {winner ? (
                isElder ? (
                  <select className="input mt-0.5 h-7 max-w-[160px] px-2 py-0 text-[10px]" value={assignedName} onChange={e => onAssignDistributor(e.target.value)} aria-label={`Distributor for ${a.name}`}>
                    <option value="">Not yet assigned</option>
                    {distributors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                ) : (
                  <div className="mt-1"><DistributorStatusBadge name={assignedName} /></div>
                )
              ) : <div className="mt-0.5 text-[10px] text-text-dim">No distribution required</div>}
            </div>

            <div className="hidden sm:block min-w-[120px]">
              <div className="text-[9px] font-bold uppercase tracking-[.13em] text-text-dim">Closed</div>
              <div className="mt-0.5 text-[10px] font-mono text-text-bright">{endedAt > 0 ? formatDateTime(endedAt) : '—'}</div>
              <div className="text-[9px] text-text-dim">{agoLabel ? `${agoLabel} · server` : ''}</div>
            </div>
          </div>

          <div className="flex items-center gap-1 lg:ml-auto">
            {totalBids > 0 && (
              <button type="button" onClick={onToggle} aria-expanded={isExpanded} className="rounded-lg border border-white/[.07] bg-black/15 px-2.5 py-2 text-[10px] font-bold text-gold-light hover:border-gold/25">
                {isExpanded ? 'Hide Bids' : `${totalBids} Bid${totalBids === 1 ? '' : 's'}`}
              </button>
            )}
            {isElder && <button type="button" onClick={onDelete} aria-label={`Delete auction: ${a.name}`} className="rounded-lg px-2.5 py-2 text-[10px] font-semibold text-red-400/75 hover:bg-red-500/[.07] hover:text-red-300">Delete</button>}
          </div>
        </div>

        {isExpanded && totalBids > 0 && (
          <div className="mt-3 rounded-xl border border-white/[.06] bg-black/20 overflow-hidden">
            <div className="grid grid-cols-[80px_minmax(0,1fr)_100px_auto] gap-3 border-b border-white/[.05] px-3 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-text-dim">
              <span>Time</span><span>Bidder</span><span className="text-right">Amount</span><span />
            </div>
            <ul className="divide-y divide-white/[.04]">
              {bids.map((b, idx) => {
                const isLast = idx === bids.length - 1
                return (
                  <li key={b.time || idx} className={`grid grid-cols-[80px_minmax(0,1fr)_100px_auto] items-center gap-3 px-3 py-2 text-[11px] ${isLast ? 'bg-green-500/[.035]' : ''}`}>
                    <span className={`font-mono tabular-nums ${isLast ? 'text-green-400' : 'text-text-dim'}`}>{formatClock(b.time)}</span>
                    <span className={`truncate font-semibold ${isLast ? 'text-green-300' : 'text-text-dim'}`}>{b.bidder}</span>
                    <span className={`text-right font-mono font-bold tabular-nums ${isLast ? 'text-green-300' : 'text-text-dim'}`}>{b.amount.toLocaleString()}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-green-400">{isLast ? 'Winner' : ''}</span>
                  </li>
                )
              })}
            </ul>
            {endedAt > 0 && <div className="border-t border-white/[.05] px-3 py-2 text-[9px] text-text-dim">Closed {formatDateTime(endedAt)} · server time ({SERVER_TZ_LABEL})</div>}
          </div>
        )}
      </div>
    </li>
  )
}
