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
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-spectral text-2xl font-bold text-gold-light mb-2">Auctions</h1>
          <p className="text-text-dim text-sm">
            {activeAuctions.length} active, {endedAuctions.length} ended
            {featuredAuction && <> · <span className="text-gold-light font-semibold">1 featured</span></>}
          </p>
        </div>

        <div className="flex items-stretch gap-2 flex-wrap">
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
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true">🕒</span><span>All times are server time ({SERVER_TZ_LABEL})</span>
          </span>
          {isElder && (
            <>
              <span className="text-gold/20" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true">⭐</span><span>Click a star to feature (visible to everyone)</span>
              </span>
            </>
          )}
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
            <div className="flex items-center justify-between gap-2 mb-2">
              <label htmlFor={fileInputId} className="text-[11px] font-bold uppercase tracking-widest text-gold-dim">
                Item image
              </label>
              <button
                type="button"
                onClick={loadLibrary}
                disabled={libraryLoading}
                className="text-[10px] font-semibold text-gold-light hover:text-gold-bright disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 rounded px-1.5 py-0.5"
              >
                {libraryLoading ? '↻ Loading…' : '↻ Refresh'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-shrink-0">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="rounded border border-gold/25 object-cover bg-void/60"
                    style={{ width: 44, height: 44 }}
                  />
                ) : (
                  <div
                    className="rounded border border-dashed border-gold/25 flex items-center justify-center text-sm text-text-dim/50 bg-void/40"
                    style={{ width: 44, height: 44 }}
                    aria-hidden="true"
                  >
                    🖼
                  </div>
                )}
              </div>

              <div className="min-w-0 max-w-[320px] flex items-center gap-2">
                {hasSelectedImage ? (
                  <>
                    {pickedLibraryImg && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gold-light bg-gold/10 border border-gold/30 rounded-full px-2 py-0.5 flex-shrink-0">
                        Library
                      </span>
                    )}
                    {imageFile && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded-full px-2 py-0.5 flex-shrink-0">
                        New
                      </span>
                    )}
                    <span
                      className="text-[11px] text-text-bright truncate"
                      title={selectedImageLabel}
                    >
                      {selectedImageLabel}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-text-dim italic">
                    No image selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
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
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded border px-2 py-1 cursor-pointer transition-colors ${
                    uploading
                      ? 'border-gold/20 text-text-dim cursor-not-allowed'
                      : 'border-gold/40 text-gold-light hover:bg-gold/10 hover:text-gold-bright'
                  }`}
                  aria-disabled={uploading}
                >
                  <span aria-hidden="true">📁</span>
                  <span>{hasSelectedImage ? 'Change' : 'Upload'}</span>
                </label>

                {hasSelectedImage && (
                  <button
                    type="button"
                    onClick={clearImage}
                    disabled={uploading}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 px-2 py-1 transition-colors disabled:opacity-40"
                    aria-label="Clear selected image"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gold/10">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gold-dim">
                  Reuse from library
                </div>
                <div className="text-[10px] text-text-dim">
                  {libraryLoading
                    ? 'Loading…'
                    : libraryError
                      ? <span className="text-red-400">{libraryError}</span>
                      : `${libraryImages.length} image${libraryImages.length === 1 ? '' : 's'}`}
                </div>
              </div>

              {libraryImages.length === 0 && !libraryLoading && !libraryError && (
                <div className="text-[11px] text-text-dim italic py-2 text-center border border-dashed border-gold/15 rounded">
                  No images in your library yet.
                </div>
              )}

              {libraryImages.length > 0 && (
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {libraryImages.map(img => {
                    const isPicked = pickedLibraryImg?.name === img.name
                    const isDeleting = deletingImageName === img.name
                    const title = img.displayName || displayNameForLibraryImage(img)
                    return (
                      <div
                        key={img.name}
                        className={`group relative rounded overflow-hidden border transition-colors ${
                          isPicked
                            ? 'border-gold-bright ring-1 ring-gold/50'
                            : 'border-gold/20 hover:border-gold/60'
                        } ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => pickFromLibrary(img)}
                          title={title}
                          className="block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
                          aria-pressed={isPicked}
                          aria-label={`Use image ${title}`}
                        >
                          <img
                            src={img.url}
                            alt={title}
                            loading="lazy"
                            className="w-full aspect-square object-cover bg-void/60"
                          />
                        </button>

                        {isPicked && (
                          <span className="absolute top-0.5 left-0.5 text-[8px] bg-gold text-black font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none shadow">
                            ✓
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteLibraryImage(img)
                          }}
                          disabled={isDeleting}
                          title="Delete image from library"
                          aria-label={`Delete image ${title}`}
                          className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-black/75 border border-red-500/60 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center text-[8px] font-bold leading-none transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
                        >
                          {isDeleting ? '…' : '✕'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
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
                  {formatClock(Date.now() + (parseInt(newItem.duration) || 60) * 60000)} server
                </span>
              </span>
            )}
          </div>
        </div>
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
        <div className="card text-center py-12 text-text-dim">No active auctions.</div>
      ) : otherActiveAuctions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
      ) : null}

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
      className="relative mb-6 overflow-hidden rounded-2xl border bg-[#0d0b0a]/95"
      style={{
        borderColor: rgba(rm.rgb, 0.42),
        boxShadow: `0 18px 50px -28px ${rgba(rm.rgb, 0.45)}, inset 0 1px 0 rgba(255,255,255,0.035)`,
      }}
      aria-label={`Featured auction: ${auction.name}`}
    >
      {/* Ambient rarity lighting */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(circle at 0% 0%, ${rgba(rm.rgb, 0.13)}, transparent 34%),
            radial-gradient(circle at 100% 100%, ${rgba(rm.rgb, 0.055)}, transparent 38%),
            linear-gradient(120deg, rgba(255,255,255,0.018), transparent 35%)
          `,
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-white/[0.06] bg-black/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <FeaturedPill rarityMeta={rm} />
            <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
              Featured auction
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span className="hidden sm:inline text-[9px] uppercase tracking-widest text-text-dim">
              Server · {SERVER_TZ_LABEL}
            </span>
            <span
              className={`font-mono text-sm sm:text-base font-bold tabular-nums ${isUrgent ? 'motion-safe:animate-pulse' : ''}`}
              style={{ color: isUrgent ? '#ef4444' : rm.color }}
            >
              {formatCountdown(auction.endsAt, now)}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[132px_minmax(0,1fr)_310px] gap-5 lg:gap-6 items-stretch">

            {/* Item artwork */}
            <div className="flex lg:block">
              {auction.imageUrl ? (
                <div
                  className="relative w-[112px] h-[112px] md:w-[132px] md:h-[132px] rounded-xl overflow-hidden border bg-black/35"
                  style={{
                    borderColor: rgba(rm.rgb, 0.5),
                    boxShadow: `0 10px 30px -16px ${rgba(rm.rgb, 0.65)}`,
                  }}
                >
                  <img
                    src={auction.imageUrl}
                    alt={auction.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      boxShadow: `inset 0 0 0 1px ${rgba(rm.rgb, 0.12)}`,
                    }}
                  />
                </div>
              ) : (
                <div
                  className="w-[112px] h-[112px] md:w-[132px] md:h-[132px] rounded-xl border flex items-center justify-center font-spectral text-4xl font-bold bg-black/30"
                  style={{
                    borderColor: rgba(rm.rgb, 0.5),
                    color: rm.color,
                    backgroundColor: rgba(rm.rgb, 0.08),
                  }}
                  aria-hidden="true"
                >
                  {auction.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Item information */}
            <div className="min-w-0 flex flex-col justify-center">
              <div
                className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1"
                style={{ color: rm.color }}
              >
                {rm.label}
              </div>

              <h2 className="font-spectral text-2xl md:text-3xl lg:text-[34px] font-bold leading-[1.05] text-text-bright break-words">
                {auction.name}
              </h2>

              {auction.description && (
                <p className="text-xs md:text-sm text-text-dim mt-2 max-w-2xl leading-relaxed">
                  {auction.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5 mt-5 max-w-xl">
                <div className="rounded-xl border border-white/[0.07] bg-black/25 px-3.5 py-3">
                  <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">
                    Current bid
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span
                      className="font-mono text-xl md:text-2xl font-bold tabular-nums"
                      style={{ color: rm.color }}
                    >
                      {auction.currentBid.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-text-dim">coins</span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-black/25 px-3.5 py-3 min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">
                    Leading bidder
                  </div>
                  <div className={`text-sm md:text-base font-semibold truncate mt-1 ${isWinning ? 'text-green-400' : 'text-text-bright'}`}>
                    {auction.topBidder || 'No bids yet'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[10px] text-text-dim">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-text-dim/70">Ends</span>
                  <span className="font-mono text-gold-light tabular-nums">{formatDateTime(auction.endsAt)}</span>
                  <span>server</span>
                </span>
                {isWinning && (
                  <span className="inline-flex items-center gap-1 text-green-400 font-semibold">
                    <span>✓</span> You're leading
                  </span>
                )}
              </div>
            </div>

            {/* Bid panel */}
            <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4 md:p-5 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-text-dim">
                    Place your bid
                  </div>
                  <div className="text-[11px] text-text-dim mt-1">
                    Minimum <span className="font-mono font-bold text-gold-light">{minNextBid.toLocaleString()}</span> coins
                  </div>
                </div>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: biddingOpen ? '#4ade80' : '#ef4444',
                    boxShadow: `0 0 10px ${biddingOpen ? 'rgba(74,222,128,.45)' : 'rgba(239,68,68,.45)'}`,
                  }}
                  aria-hidden="true"
                />
              </div>

              {currentUser && auction.status === 'active' ? (
                biddingOpen ? (
                  <div>
                    <label htmlFor={`featured-bid-${auction.id}`} className="sr-only">
                      Bid amount
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`featured-bid-${auction.id}`}
                        className="input text-base flex-1 min-w-0"
                        type="number"
                        min={minNextBid}
                        step={MIN_BID_INCREMENT}
                        placeholder={String(minNextBid)}
                        value={bidAmount}
                        onChange={e => onBidChange(e.target.value)}
                        onFocus={e => { if (!e.target.value) onBidChange(String(minNextBid)) }}
                      />
                      <button
                        onClick={onPlaceBid}
                        className="btn-gold px-5 text-sm font-bold whitespace-nowrap"
                      >
                        Bid
                      </button>
                    </div>
                    <div className="text-[10px] text-text-dim mt-2">
                      +{MIN_BID_INCREMENT} coins minimum increment
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-red-500/25 bg-red-500/[0.07] px-3 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                      <span>🔒</span>
                      <span>Bidding closed</span>
                    </div>
                    <div className="text-[10px] text-text-dim mt-1">
                      Final 5 minutes — auction is locked.
                    </div>
                  </div>
                )
              ) : (
                <div className="text-xs text-text-dim rounded-lg border border-white/[0.06] bg-black/20 px-3 py-3">
                  Sign in to participate in this auction.
                </div>
              )}
            </div>
          </div>

          {/* Bid history */}
          {history.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={onToggleBids}
                aria-expanded={isBidsExpanded}
                className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-dim hover:text-gold-light transition-colors rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
              >
                <span
                  className={`transition-transform ${isBidsExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
                Bid history
                <span className="font-mono text-gold-light">{history.length}</span>
              </button>

              {isBidsExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3 max-h-[190px] overflow-y-auto pr-1" role="list">
                  {history.map((b, idx) => {
                    const isCurrentTop = idx === 0
                    return (
                      <div
                        key={b.time || idx}
                        role="listitem"
                        className={`rounded-lg border px-3 py-2 ${
                          isCurrentTop
                            ? 'border-green-500/25 bg-green-500/[0.06]'
                            : 'border-white/[0.06] bg-black/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold truncate ${isCurrentTop ? 'text-green-300' : 'text-text-dim'}`}>
                            {b.bidder}
                          </span>
                          <span className={`font-mono text-xs font-bold tabular-nums flex-shrink-0 ${isCurrentTop ? 'text-green-300' : 'text-text-dim'}`}>
                            {b.amount.toLocaleString()}
                          </span>
                        </div>
                        <div className={`text-[10px] mt-1 ${isCurrentTop ? 'text-green-400' : 'text-text-dim/70'}`}>
                          {isCurrentTop
                            ? (auction.topBidder === currentUser?.name ? 'Winning' : 'Leading')
                            : 'Outbid'}
                          {' · '}
                          {formatClock(b.time)} server
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Admin actions */}
          {isElder && (
            <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/[0.06]">
              {isMaster && (
                <button
                  onClick={onEndEarly}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.04] px-3 py-2 text-[11px] font-semibold text-yellow-400 hover:bg-yellow-500/[0.09] hover:border-yellow-500/35 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
                >
                  <span aria-hidden="true">⏹</span>
                  End early
                </button>
              )}

              <button
                onClick={onToggleFeatured}
                disabled={featuringInFlight}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 disabled:opacity-50 ${
                  isPinned
                    ? 'border-gold/45 bg-gold/[0.09] text-gold-bright hover:bg-gold/[0.14]'
                    : 'border-white/[0.10] bg-black/20 text-text-dim hover:text-gold-light hover:border-gold/35'
                }`}
                title={isPinned ? 'Remove from featured' : 'Pin as featured'}
              >
                <span aria-hidden="true">{featuringInFlight ? '…' : (isPinned ? '★' : '☆')}</span>
                <span>{isPinned ? 'Unfeature' : 'Feature'}</span>
              </button>

              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-red-400/80 hover:text-red-300 hover:bg-red-500/[0.06] transition-colors ml-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
              >
                <span aria-hidden="true">🗑</span>
                Delete
              </button>
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
    <div
      className={`relative card border-l-4 ${isWinning ? 'bg-green-500/5' : ''}`}
      style={{
        borderLeftColor: isWinning ? '#22c55e' : rm.color,
        boxShadow: glow && !isWinning ? `0 0 16px ${rgba(rm.rgb, 0.12)}` : undefined,
      }}
    >
      {isElder && (
        <button
          type="button"
          onClick={onToggleFeatured}
          disabled={featuringInFlight}
          title={isFeatured ? 'Remove from featured' : 'Pin as featured'}
          aria-label={isFeatured ? 'Remove from featured' : 'Pin as featured'}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full border flex items-center justify-center text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 disabled:opacity-50 ${
            isFeatured
              ? 'bg-gold text-black border-gold-bright'
              : 'bg-void/60 text-gold-light/70 border-gold/30 hover:text-gold-bright hover:border-gold/60'
          }`}
        >
          {featuringInFlight ? '…' : (isFeatured ? '★' : '☆')}
        </button>
      )}

      <div className="flex items-start gap-3">
        {auction.imageUrl && (
          <ItemImage src={auction.imageUrl} alt={auction.name} size={64} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 pr-8">
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

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-dim">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <span aria-hidden="true">🕒</span>
          <span className="font-mono text-gold-light">
            {formatDateTime(auction.endsAt)}
          </span>
          <span>server</span>
        </span>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div>
          <div className="text-xs text-text-dim">Current bid</div>
          <div className="text-xl font-bold text-gold-bright tabular-nums">{auction.currentBid.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-dim">Top bidder</div>
          <div className={`font-semibold ${isWinning ? 'text-green-400' : 'text-text-bright'}`}>{auction.topBidder || '—'}</div>
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
                      {isCurrentTop ? (auction.topBidder === currentUser?.name ? 'winning' : 'leading') : 'outbid'} at{' '}
                      <span className="font-mono tabular-nums">{formatClock(b.time)}</span>
                      <span className="text-text-dim/70"> server</span>
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

        {endedAt > 0 && (
          <div className="hidden sm:flex flex-col items-end flex-shrink-0 leading-tight">
            <span className="text-[10px] font-mono tabular-nums text-gold-light whitespace-nowrap">
              {formatDateTime(endedAt)}
            </span>
            <span className="text-[10px] text-text-dim whitespace-nowrap">
              {agoLabel} · server
            </span>
          </div>
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

      {isExpanded && endedAt > 0 && (
        <div className="px-4 pb-3 text-[10px] text-text-dim flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>Ended {formatDateTime(endedAt)} · server time ({SERVER_TZ_LABEL})</span>
        </div>
      )}
    </li>
  )
}
