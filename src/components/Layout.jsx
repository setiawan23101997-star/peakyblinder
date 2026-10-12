import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import ChangePasswordModal from './ChangePasswordModal'
import MyActivity from './MyActivity'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'members', label: 'Members', icon: '👥' },
  { id: 'attendance', label: 'Attendance', icon: '📋' },
  { id: 'auctions', label: 'Auctions', icon: '🔨' },
  { id: 'loot-roulette', label: 'Loot Roulette', icon: '🎰' },
  { id: 'marketplace', label: 'Marketplace', icon: '🛒' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'notice-board', label: 'Notice Board', icon: '📜' },
  { id: 'admin-log', label: 'Admin CP', icon: '🛡' , staffOnly: true },
]

// Desktop nav sizing. NAV_ITEM_BASE is shared by real buttons and the hidden
// measuring row so the measured widths always match what is rendered.
// (border-transparent is included so the active glass border never changes width.)
const NAV_ITEM_BASE = 'flex h-10 items-center gap-2 rounded-xl border border-transparent px-3 text-[13px] font-semibold'
const NAV_GAP = 2            // gap-0.5
const NAV_PILL_CHROME = 16   // pill padding + border + small safety margin

// Creator credit + support link (global footer, user menu and mobile menu).
const CREATOR_NAME = 'Ryuji / MiaKhalifa'
const SUPPORT_URL = 'https://discord.com/users/703295552821133324'
const SUPPORT_LINK_LABEL = 'message me on Discord'

// ---------------------------------------------------------------------------
// Supabase egress settings for the notification bell
// ---------------------------------------------------------------------------
// Realtime: only receive INSERTs for the signed-in member. Without a filter,
// every browser receives every member's notifications. If live notifications
// ever stop arriving on your setup, flip this to false (the local user_id
// check below still keeps other members' rows out of the list).
const REALTIME_FILTER_BY_USER = true
// Fallback poll, only used while Realtime is NOT connected and the tab is visible.
const POLL_FALLBACK_MS = 5 * 60 * 1000
// While Realtime is healthy, opening the bell only re-queries after this long.
const OPEN_REFRESH_MS = 10 * 60 * 1000
// Auction / marketplace item names + images, cached in the browser so each id
// is fetched once per week instead of once per page load.
const LOOKUP_CACHE_KEY = 'pb-notif-lookups-v1'
const LOOKUP_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const LOOKUP_CACHE_MAX = 200

const emptyLookupCache = () => ({ createdAt: Date.now(), auctions: {}, items: {} })

function readLookupCache() {
  try {
    const raw = localStorage.getItem(LOOKUP_CACHE_KEY)
    if (!raw) return emptyLookupCache()
    const parsed = JSON.parse(raw)
    if (!parsed || Date.now() - Number(parsed.createdAt || 0) > LOOKUP_CACHE_TTL) {
      return emptyLookupCache()
    }
    return {
      createdAt: Number(parsed.createdAt),
      auctions: parsed.auctions || {},
      items: parsed.items || {},
    }
  } catch {
    return emptyLookupCache()
  }
}

function trimLookupMap(map) {
  const keys = Object.keys(map)
  if (keys.length <= LOOKUP_CACHE_MAX) return map
  const out = {}
  for (const key of keys.slice(-LOOKUP_CACHE_MAX)) out[key] = map[key]
  return out
}

function writeLookupCache(cache) {
  try {
    localStorage.setItem(LOOKUP_CACHE_KEY, JSON.stringify({
      createdAt: cache.createdAt,
      auctions: trimLookupMap(cache.auctions),
      items: trimLookupMap(cache.items),
    }))
  } catch {
    // Storage full or blocked: the in-memory cache still works for this session.
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

// Automatically use the timezone configured on the player's browser/device.
// Server/game time remains authoritative; this only changes local-time presentation.
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

// Same original crest used on the login page.
function CrestIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 2.5l7.5 3v6c0 4.5-3.3 8.1-7.5 10-4.2-1.9-7.5-5.5-7.5-10v-6z" />
      <path d="M12 5.2l1.1 1.9L12 9l-1.1-1.9z" fill="currentColor" stroke="none" />
      <path d="M7.8 10.6L12 13l4.2-2.4" />
      <path d="M7.8 14L12 16.4l4.2-2.4" />
    </svg>
  )
}

/**
 * Flag image from flagcdn.com.
 * `code` is the ISO 3166-1 alpha-2 country code (e.g. "ph", "us", "id").
 * If the image fails to load, falls back to the emoji in `fallbackFlag` (optional).
 */
function FlagIcon({ code, name, width = 20, height = 15, fallbackFlag }) {
  const [failed, setFailed] = useState(false)

  if (!code) {
    // No code at all — render the emoji fallback if provided, else nothing.
    if (fallbackFlag) {
      return (
        <span
          className="inline-flex items-center justify-center flex-shrink-0 leading-none"
          style={{ width, height, fontSize: Math.round(height * 1.1) }}
          aria-hidden="true"
        >
          {fallbackFlag}
        </span>
      )
    }
    return null
  }

  if (failed && fallbackFlag) {
    return (
      <span
        className="inline-flex items-center justify-center flex-shrink-0 leading-none"
        style={{ width, height, fontSize: Math.round(height * 1.1) }}
        aria-hidden="true"
      >
        {fallbackFlag}
      </span>
    )
  }

  if (failed) return null

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

// CSS "hidden"/"md:hidden" only hides an element - it stays mounted and keeps
// querying + subscribing. This hook lets us mount a single NotificationBell.
function useMediaQuery(query) {
  const getMatch = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  const [matches, setMatches] = useState(getMatch)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else mql.addListener(onChange)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange)
      else mql.removeListener(onChange)
    }
  }, [query])

  return matches
}

const NOTIFICATION_RARITY = {
  common: {
    text: "text-white",
    border: "border-white/30",
    glow: "shadow-[0_0_18px_rgba(255,255,255,0.08)]",
  },
  uncommon: {
    text: "text-emerald-400",
    border: "border-emerald-400/35",
    glow: "shadow-[0_0_18px_rgba(52,211,153,0.12)]",
  },
  rare: {
    text: "text-blue-400",
    border: "border-blue-400/35",
    glow: "shadow-[0_0_18px_rgba(96,165,250,0.12)]",
  },
  epic: {
    text: "text-red-400",
    border: "border-red-400/35",
    glow: "shadow-[0_0_18px_rgba(248,113,113,0.12)]",
  },
  legendary: {
    text: "text-amber-300",
    border: "border-amber-300/45",
    glow: "shadow-[0_0_20px_rgba(252,211,77,0.16)]",
  },
};

const getNotificationRarity = rarity =>
  NOTIFICATION_RARITY[String(rarity || "common").toLowerCase()] || NOTIFICATION_RARITY.common;

const getNotificationAuctionImage = auction =>
  auction?.image_url || auction?.image_data || null;

const getNotificationMarketplaceImage = item =>
  item?.image_url || item?.image_data || null;

const renderMarketplaceMessage = (notification, item) => {
  const message = notification?.message || "";
  const itemName = item?.name;

  if (!message || !itemName) return message;

  // Marketplace messages do not consistently wrap the item name in quotes
  // (for example: "2 × Sword has been marked as distributed."), so do not
  // rely on quote parsing. Find the exact item name and render only that
  // portion with the item's rarity color.
  const index = message.indexOf(itemName);
  if (index < 0) return message;

  const rarity = getNotificationRarity(item?.rarity);
  const before = message.slice(0, index);
  const after = message.slice(index + itemName.length);

  return (
    <>
      {before}
      <span className={`font-semibold ${rarity.text}`}>
        {itemName}
      </span>
      {after}
    </>
  );
};

const renderAuctionWonMessage = (notification, auction) => {
  const message = notification?.message || "";
  const itemName = auction?.name;

  if (!message || !itemName) return message;

  const match = message.match(/^(.*?)(["“])(.+?)(["”])(.*)$/);
  if (!match) return message;

  const rarity = getNotificationRarity(auction?.rarity);

  return (
    <>
      {match[1]}
      <span className={`font-semibold ${rarity.text}`}>
        {itemName}
      </span>
      {match[5]}
    </>
  );
};

function NotificationBell({ ctx, onNavigate }) {
  const { currentUser, supabase } = ctx
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const panelRef = useRef(null)
  const loadRequestRef = useRef(0)
  const lastLoadedRef = useRef(0)
  const realtimeLiveRef = useRef(false)
  // Auction / marketplace names + images rarely change; cached in memory and
  // in localStorage so each id is looked up once instead of on every load.
  const lookupCacheRef = useRef(null)
  if (lookupCacheRef.current === null) lookupCacheRef.current = readLookupCache()

  const memberId = currentUser?.id
  const isGuest = !memberId || currentUser?.name === 'Guest'

  const loadNotifications = async () => {
    const requestId = ++loadRequestRef.current

    if (!supabase || isGuest) {
      if (requestId === loadRequestRef.current) setNotifications([])
      return
    }

    setLoading(true)
    try {
      // Only the columns the bell actually renders.
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, message, auction_id, marketplace_item_id, is_read, created_at')
        .eq('user_id', memberId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error

      let cacheChanged = false

      const auctionIds = [...new Set(
        (data || [])
          .filter(n => n.type === 'auction_won' && n.auction_id)
          .map(n => String(n.auction_id))
      )]

      const auctionMap = lookupCacheRef.current.auctions
      const missingAuctionIds = auctionIds.filter(id => !auctionMap[id])

      if (missingAuctionIds.length) {
        const { data: auctions, error: auctionError } = await supabase
          .from('auctions')
          .select('id, name, rarity, image_url')
          .in('id', missingAuctionIds)

        if (auctionError) {
          console.warn('Load notification auction data failed:', auctionError)
        } else {
          for (const auction of auctions || []) auctionMap[String(auction.id)] = auction
          cacheChanged = true
        }
      }

      const marketplaceItemIds = [...new Set(
        (data || [])
          .filter(n => n.marketplace_item_id)
          .map(n => String(n.marketplace_item_id))
      )]

      const marketplaceItemMap = lookupCacheRef.current.items
      const missingItemIds = marketplaceItemIds.filter(id => !marketplaceItemMap[id])

      if (missingItemIds.length) {
        const { data: marketplaceItems, error: marketplaceError } = await supabase
          .from('marketplace_items')
          .select('id, name, rarity, image_url')
          .in('id', missingItemIds)

        if (marketplaceError) {
          console.warn('Load notification marketplace item data failed:', marketplaceError)
        } else {
          for (const item of marketplaceItems || []) marketplaceItemMap[String(item.id)] = item
          cacheChanged = true
        }
      }

      if (cacheChanged) writeLookupCache(lookupCacheRef.current)

      // Ignore an older request if Clear All (or a newer load) happened
      // while this query was still in flight.
      if (requestId !== loadRequestRef.current) return

      const canReceiveMarketplaceReview = ['Admin', 'Master'].includes(String(currentUser?.role || ''))

      setNotifications(
        (data || [])
          .filter(notification => (
            notification.type !== 'marketplace_review' || canReceiveMarketplaceReview
          ))
          .map(notification => ({
          ...notification,
          auction: notification.auction_id
            ? auctionMap[String(notification.auction_id)] || null
            : null,
          marketplaceItem: notification.marketplace_item_id
            ? marketplaceItemMap[String(notification.marketplace_item_id)] || null
            : null,
        }))
      )
      lastLoadedRef.current = Date.now()
    } catch (err) {
      if (requestId === loadRequestRef.current) {
        console.warn('Load notifications failed:', err)
      }
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
    if (!supabase || isGuest) return

    // Fallback poll: skipped while the tab is hidden or Realtime is connected.
    const poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (realtimeLiveRef.current) return
      loadNotifications()
    }, POLL_FALLBACK_MS)

    // Coming back to the tab: refresh only if we likely missed something.
    const handleVisibility = () => {
      if (document.hidden) return
      const stale = Date.now() - lastLoadedRef.current
      if ((!realtimeLiveRef.current && stale > POLL_FALLBACK_MS) || stale > OPEN_REFRESH_MS * 3) {
        loadNotifications()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    let channel = null
    try {
      const changeFilter = {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }
      if (REALTIME_FILTER_BY_USER) changeFilter.filter = `user_id=eq.${memberId}`

      channel = supabase
        .channel(`notifications-live-${memberId}-${Date.now()}`)
        .on(
          'postgres_changes',
          changeFilter,
          async payload => {
            const incomingRow = payload?.new
            if (!incomingRow) return

            // Only show notifications belonging to the currently logged-in member.
            if (String(incomingRow.user_id) !== String(memberId)) return

            // Marketplace Review is only for Admin/Master.
            // Do not affect Marketplace purchase/distribution notifications.
            if (
              incomingRow.type === 'marketplace_review' &&
              !['Admin', 'Master'].includes(String(currentUser?.role || ''))
            ) return

            let incoming = incomingRow
            let cacheChanged = false

            if (incoming.type === 'auction_won' && incoming.auction_id) {
              const cacheKey = String(incoming.auction_id)
              let auction = lookupCacheRef.current.auctions[cacheKey] || null

              if (!auction) {
                const { data, error: auctionError } = await supabase
                  .from('auctions')
                  .select('id, name, rarity, image_url')
                  .eq('id', incoming.auction_id)
                  .maybeSingle()

                if (auctionError) {
                  console.warn('Realtime auction lookup failed:', auctionError)
                } else if (data) {
                  auction = data
                  lookupCacheRef.current.auctions[cacheKey] = data
                  cacheChanged = true
                }
              }

              incoming = {
                ...incoming,
                auction: auction || null,
              }
            }

            if (incoming.marketplace_item_id) {
              const cacheKey = String(incoming.marketplace_item_id)
              let marketplaceItem = lookupCacheRef.current.items[cacheKey] || null

              if (!marketplaceItem) {
                const { data, error: marketplaceError } = await supabase
                  .from('marketplace_items')
                  .select('id, name, rarity, image_url')
                  .eq('id', incoming.marketplace_item_id)
                  .maybeSingle()

                if (marketplaceError) {
                  console.warn('Realtime marketplace item lookup failed:', marketplaceError)
                } else if (data) {
                  marketplaceItem = data
                  lookupCacheRef.current.items[cacheKey] = data
                  cacheChanged = true
                }
              }

              incoming = {
                ...incoming,
                marketplaceItem: marketplaceItem || null,
              }
            }

            if (cacheChanged) writeLookupCache(lookupCacheRef.current)

            setNotifications(prev => [
              incoming,
              ...prev.filter(n => n.id !== incoming.id),
            ].slice(0, 30))
          }
        )
        .subscribe(status => {
          const wasLive = realtimeLiveRef.current
          realtimeLiveRef.current = status === 'SUBSCRIBED'
          // After a reconnect, catch up once if the list is old.
          if (
            !wasLive &&
            realtimeLiveRef.current &&
            lastLoadedRef.current &&
            Date.now() - lastLoadedRef.current > 2 * 60 * 1000
          ) {
            loadNotifications()
          }
        })
    } catch (err) {
      console.warn('Notification realtime setup failed:', err)
    }

    return () => {
      clearInterval(poll)
      document.removeEventListener('visibilitychange', handleVisibility)
      realtimeLiveRef.current = false
      if (channel) {
        try { supabase.removeChannel(channel) } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, memberId, currentUser?.name])

  useEffect(() => {
    if (!open) return

    // Realtime already keeps the list current; only re-query when it is down
    // or the list is genuinely old.
    const stale = Date.now() - lastLoadedRef.current
    if ((!realtimeLiveRef.current && stale > 60 * 1000) || stale > OPEN_REFRESH_MS) {
      loadNotifications()
    }

    const handleOutside = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    const handleEscape = e => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const unreadCount = notifications.filter(n => !n.is_read).length

  const formatNotificationTime = value => {
    const time = value ? new Date(value).getTime() : NaN
    if (!Number.isFinite(time)) return 'JUST NOW'

    const diff = Math.max(0, Date.now() - time)
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    if (diff < minute) return 'JUST NOW'
    if (diff < hour) return `${Math.floor(diff / minute)} MIN AGO`
    if (diff < day) return `${Math.floor(diff / hour)} HR AGO`
    if (diff < 7 * day) return `${Math.floor(diff / day)} DAYS AGO`

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(time)).toUpperCase()
  }

  const markRead = async id => {
    if (!supabase || !id) return

    const target = notifications.find(n => n.id === id)
    if (target?.is_read) return // already read: skip the network call

    const previous = notifications
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true }, { returning: 'minimal' })
      .eq('id', id)

    if (error) {
      console.warn('Mark notification read failed:', error)
      setNotifications(previous)
    }
  }

  const markAllRead = async () => {
    if (!supabase || !memberId || unreadCount === 0) return

    const previous = notifications
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true }, { returning: 'minimal' })
      .eq('user_id', memberId)
      .eq('is_read', false)

    if (error) {
      console.warn('Mark all notifications read failed:', error)
      setNotifications(previous)
    }
  }

  const clearAllNotifications = async () => {
    if (!supabase || !memberId || notifications.length === 0) return

    // Invalidate every in-flight/polling load first. Without this, a
    // fallback poll that started before the DELETE can finish afterward and
    // reinsert the old notifications into React state.
    ++loadRequestRef.current

    const previous = notifications
    setNotifications([])

    const { error } = await supabase
      .from('notifications')
      .delete({ returning: 'minimal' })
      .eq('user_id', memberId)

    if (error) {
      console.warn('Clear notifications failed:', error)
      setNotifications(previous)
    }

    setConfirmClear(false)
  }

  const handleNotificationClick = async notification => {
    await markRead(notification.id)
    setOpen(false)
    if (notification.type?.startsWith('auction_') || notification.auction_id) {
      onNavigate?.('auctions')
      return
    }

    if (notification.marketplace_item_id || notification.type?.startsWith('marketplace_')) {
      onNavigate?.('marketplace')
    }
  }

  if (isGuest) return null

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={`lg-chip relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
          open ? 'lg-chip-active text-gold-bright' : 'text-gold-light'
        }`}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full border-2 border-void bg-red-500 px-1 text-[8px] font-bold leading-none text-white shadow-[0_0_10px_rgba(239,68,68,.45)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="lg-panel lg-pop fixed left-2.5 right-2.5 top-[82px] z-[120] w-auto max-w-none overflow-hidden rounded-[20px] md:absolute md:left-auto md:right-0 md:top-full md:mt-3 md:w-[380px] md:max-w-[calc(100vw-20px)]">
          {/* Header */}
          <div className="relative border-b border-white/[.08] px-4 pb-2.5 pt-3.5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[.22em] text-gold-dim">
                  Clan Center
                </div>
                <h3 className="mt-1 font-spectral text-[18px] font-bold leading-none text-text-bright">
                  Notifications
                </h3>
              </div>

              {notifications.length > 0 && (
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="lg-chip rounded-full px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[.13em] text-gold-light"
                    >
                      Mark all read
                    </button>
                  )}
                  {!confirmClear && (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="lg-chip rounded-full px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[.13em] text-text-dim hover:text-red-300"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[8px] font-bold uppercase tracking-[.18em] text-text-dim/65">
                Recent activity
              </span>
              <span className="text-[8px] font-mono text-text-dim/45">
                {notifications.length} {notifications.length === 1 ? 'NOTICE' : 'NOTICES'}
              </span>
            </div>
          </div>

          {confirmClear && (
            <div className="border-b border-red-400/10 bg-red-500/[.08] px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-text-bright">
                    Clear all notifications?
                  </div>
                  <div className="mt-1 text-[9px] leading-relaxed text-text-dim">
                    This will remove all notifications from your account.
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="lg-chip rounded-full px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[.12em] text-text-dim"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={clearAllNotifications}
                    className="rounded-full border border-red-400/30 bg-red-400/[.12] px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[.12em] text-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,.12)] hover:bg-red-400/[.2]"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notification list */}
          <div className="max-h-[min(420px,calc(100vh-145px))] overflow-y-auto overscroll-contain">
            {loading && notifications.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="lg-emblem mx-auto h-8 w-8 animate-pulse rounded-xl" />
                <div className="mt-3 text-[10px] text-text-dim">Loading activity…</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="lg-emblem mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-gold-light">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="mt-4 text-sm font-semibold text-text-bright">No new activity</div>
                <div className="mt-1 text-[10px] leading-4 text-text-dim">
                  Auction results and important clan updates will appear here.
                </div>
              </div>
            ) : (
              <div className="p-2.5">
                {notifications.map(notification => {
                  const unread = !notification.is_read
                  const isAuctionWin = notification.type === 'auction_won'
                  const isMarketplace = Boolean(
                    notification.marketplace_item_id ||
                    notification.type?.startsWith('marketplace_')
                  )
                  const notificationItem = isAuctionWin
                    ? notification.auction
                    : isMarketplace
                      ? notification.marketplaceItem
                      : null
                  const rarity = notificationItem
                    ? getNotificationRarity(notificationItem?.rarity)
                    : null

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={`group relative mb-1.5 flex w-full gap-2 overflow-hidden rounded-xl border p-2 text-left transition-all last:mb-0 ${
                        unread
                          ? 'border-white/[.10] bg-gradient-to-br from-gold/[.10] to-white/[.03] shadow-[inset_0_1px_0_rgba(255,255,255,.08)] hover:border-white/[.16]'
                          : 'border-white/[.05] bg-white/[.025] hover:border-white/[.10] hover:bg-white/[.05]'
                      }`}
                    >
                      {/* unread rail */}
                      {unread && (
                        <span className="absolute bottom-2.5 left-0 top-2.5 w-[2px] rounded-r-full bg-gold-bright shadow-[0_0_8px_rgba(242,204,96,.35)]" />
                      )}

                      {isAuctionWin || isMarketplace ? (
                        <span
                          className={`relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border bg-black/30 ${
                            rarity?.border || 'border-white/[.08]'
                          } ${rarity?.glow || ''}`}
                        >
                          {(isAuctionWin
                            ? getNotificationAuctionImage(notification.auction)
                            : getNotificationMarketplaceImage(notification.marketplaceItem)) ? (
                            <img
                              src={isAuctionWin
                                ? getNotificationAuctionImage(notification.auction)
                                : getNotificationMarketplaceImage(notification.marketplaceItem)}
                              alt={notificationItem?.name || 'Notification item'}
                              className="h-full w-full rounded-[8px] object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className={`flex h-full w-full items-center justify-center rounded-[8px] text-[8px] font-bold uppercase tracking-[.12em] ${rarity?.text || 'text-text-dim/40'}`}>
                              Item
                            </div>
                          )}
                        </span>
                      ) : (
                        <span className="lg-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-dim">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        {!isAuctionWin && (
                          <span className="flex items-center gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-[.16em] text-text-dim">
                              Clan Update
                            </span>
                          </span>
                        )}

                        <span className={`mt-0.5 block text-[12px] font-bold leading-4 ${
                          unread ? 'text-text-bright' : 'text-text'
                        }`}>
                          {isAuctionWin ? (
                            <span className="text-[#E7C873]">Auction Won!</span>
                          ) : (
                            String(notification.title || "")
                              .replace(/^[\uFFFD🛒📦🏆]+\s*/, "")
                          )}
                        </span>

                        <span className={`mt-0.5 block text-[10px] leading-[1.35] ${
                          unread ? 'text-text-dim' : 'text-text-dim/75'
                        }`}>
                          {isAuctionWin
                            ? renderAuctionWonMessage(notification, notification.auction)
                            : isMarketplace && notification.marketplaceItem
                              ? renderMarketplaceMessage(notification, notification.marketplaceItem)
                              : notification.message}
                        </span>

                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] font-bold uppercase tracking-[.13em] text-text-dim/50">
                          <span>{formatNotificationTime(notification.created_at)}</span>
                          {(notification.auction_id || notification.marketplace_item_id) && (
                            <>
                              <span>•</span>
                              <span className="text-gold-dim transition-colors group-hover:text-gold-light">
                                {notification.auction_id ? 'View auction →' : 'View marketplace →'}
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

export default function Layout({ ctx, page, setPage, children, toasts }) {
  const { currentUser, setCurrentUser, addToast, allMembers, supabase } = ctx
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const isDesktop = useMediaQuery('(min-width: 768px)')
  const userMenuRef = useRef(null)
  const moreMenuRef = useRef(null)

  const visibleNavItems = navItems.filter(
    item => !item.staffOnly || ['Admin', 'Master', 'Elder'].includes(currentUser?.role)
  )
  // Desktop navigation is measured, not guessed: it shows as many items as
  // physically fit next to the account controls and moves the rest into "More".
  const [visibleCount, setVisibleCount] = useState(visibleNavItems.length)
  const navWrapRef = useRef(null)
  const navMeasureRef = useRef(null)
  const primaryNavItems = visibleNavItems.slice(0, visibleCount)
  const overflowNavItems = visibleNavItems.slice(visibleCount)
  const activeOverflow = overflowNavItems.some(item => item.id === page)

  useLayoutEffect(() => {
    const wrap = navWrapRef.current
    const measure = navMeasureRef.current
    if (!wrap || !measure) return undefined

    let cancelled = false
    const recalc = () => {
      if (cancelled) return
      const available = wrap.clientWidth - NAV_PILL_CHROME
      if (available <= 0) return // mobile layout: desktop nav is hidden

      const cells = Array.from(measure.children)
      const moreWidth = cells.pop()?.offsetWidth || 0
      const widths = cells.map(cell => cell.offsetWidth)
      const total = widths.length

      let fit = 0
      let used = 0
      for (let n = 1; n <= total; n += 1) {
        used += widths[n - 1] + (n > 1 ? NAV_GAP : 0)
        const needed = n === total ? used : used + NAV_GAP + moreWidth
        if (needed <= available) fit = n
      }
      setVisibleCount(prev => (prev === fit ? prev : fit))
    }

    recalc()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recalc) : null
    observer?.observe(wrap)
    window.addEventListener('resize', recalc)
    document.fonts?.ready?.then(recalc)

    return () => {
      cancelled = true
      observer?.disconnect()
      window.removeEventListener('resize', recalc)
    }
  }, [visibleNavItems.length])

  // Prefer the live member record from App.jsx. When staff changes Coins,
  // updateMember/reloadMembers can update allMembers and Layout re-renders
  // immediately without forcing a page refresh or doing periodic polling.
  const liveCurrentUser = allMembers?.find(
    member => String(member.id) === String(currentUser?.id)
  ) || currentUser

  const [displayCoins, setDisplayCoins] = useState(
    Number(liveCurrentUser?.coins || 0)
  )

  // Keep the Layout coin balance live from shared context (no extra queries).
  useEffect(() => {
    if (liveCurrentUser?.id) {
      setDisplayCoins(Number(liveCurrentUser?.coins || 0))
    }
  }, [liveCurrentUser?.id, liveCurrentUser?.coins])

  // NOTE: no separate Realtime channel here. App.jsx already listens to the
  // members table and updates allMembers/currentUser, which feeds
  // liveCurrentUser above. A second subscription only duplicated the traffic.

  useEffect(() => {
    if (!userMenuOpen && !moreOpen) return

    const handleClickOutside = e => {
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
      if (moreOpen && moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreOpen(false)
      }
    }

    const handleEscape = e => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false)
        setMoreOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [userMenuOpen, moreOpen])

  const navigate = id => {
    setPage(id)
    setMobileOpen(false)
    setMoreOpen(false)
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUser')
    addToast('Logged out.', 'blue', 'Goodbye')
    setUserMenuOpen(false)
    setMobileOpen(false)
  }

  const roleBadgeClass = role => {
    if (role === 'Admin') return 'bg-red-500/15 text-red-300 border border-red-500/30'
    if (role === 'Master') return 'bg-gold/15 text-gold-light border border-gold/35'
    if (role === 'Elder') return 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
    return 'bg-white/[0.05] text-text-dim border border-white/[0.1]'
  }

  const hasCoins = Number(displayCoins || 0) > 0

  const toastAccent = type =>
    type === 'red' ? 'bg-red-400' :
    type === 'blue' ? 'bg-blue-400' :
    'bg-gold-bright'

  const NavButton = ({ item, mobile = false }) => {
    const active = page === item.id
    return (
      <button
        type="button"
        onClick={() => navigate(item.id)}
        className={mobile
          ? `group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
              active
                ? 'lg-chip lg-chip-active text-gold-bright'
                : 'border-transparent text-text-dim hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-text-bright'
            }`
          : `group relative transition-all ${NAV_ITEM_BASE} ${
              active
                ? 'lg-tab-active text-gold-bright'
                : 'text-text-dim hover:bg-white/[0.05] hover:text-gold-light'
            }`
        }
        aria-current={active ? 'page' : undefined}
      >
        <span className={mobile
          ? `flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[16px] ${active ? 'border-gold/30 bg-gold/[0.1]' : 'border-white/[0.07] bg-white/[0.03]'}`
          : `text-[14px] leading-none transition-transform group-hover:scale-105 ${active ? 'opacity-100' : 'opacity-65'}`
        }>
          {item.icon}
        </span>
        <span className={mobile ? 'min-w-0 flex-1 text-[14px] font-semibold' : 'whitespace-nowrap'}>
          {item.label}
        </span>
        {mobile && active && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-bright shadow-[0_0_9px_rgba(212,175,55,.6)]" />
        )}
      </button>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-transparent text-text-bright">
      {/* Ambient light for the glass to refract */}
      <div className="lg-ambient" aria-hidden="true">
        <div className="lg-orb lg-orb--1" />
        <div className="lg-orb lg-orb--2" />
        <div className="lg-orb lg-orb--3" />
      </div>

      <nav className="lg-bar fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-[64px] w-full max-w-[1900px] items-center gap-2 overflow-hidden px-2 md:h-[72px] md:gap-3 md:overflow-visible md:px-5 lg:px-7 2xl:px-6">
          <div className="flex w-auto min-w-0 shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileOpen(value => !value)}
              className="lg-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-gold-light md:hidden"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? '✕' : '☰'}
            </button>

            <button
              type="button"
              onClick={() => navigate('dashboard')}
              className="group flex min-w-0 items-center gap-3"
              aria-label="Go to Dashboard"
            >
              <span className="lg-emblem flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gold-light transition group-hover:text-gold-bright">
                <CrestIcon width="22" height="22" />
              </span>
              <span className="hidden min-w-0 md:block">
                <span className="block font-spectral text-[18px] font-bold tracking-wide text-gold-light group-hover:text-gold-bright">PeakyBlinder</span>
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim/75 xl:block">Clan Command Center</span>
              </span>
            </button>
          </div>

          <div className="hidden h-8 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent md:block" />

          <div ref={navWrapRef} className="relative hidden min-w-0 flex-1 items-center md:flex">
            {/* Invisible row used only to measure each item's natural width. */}
            <div
              ref={navMeasureRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute left-0 top-0 flex w-max gap-0.5 whitespace-nowrap"
            >
              {visibleNavItems.map(item => (
                <span key={item.id} className={NAV_ITEM_BASE}>
                  <span className="text-[14px] leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </span>
              ))}
              <span className={NAV_ITEM_BASE}>
                <span className="text-[14px]">•••</span>
                <span>More</span>
                <span className="text-[10px]">▾</span>
              </span>
            </div>

            <div className="lg-track flex min-w-0 items-center gap-0.5 rounded-2xl p-1">
              {primaryNavItems.map(item => <NavButton key={item.id} item={item} />)}

              {overflowNavItems.length > 0 && (
                <div ref={moreMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setMoreOpen(value => !value)}
                    className={`transition ${NAV_ITEM_BASE} ${
                      activeOverflow || moreOpen
                        ? 'lg-tab-active text-gold-bright'
                        : 'text-text-dim hover:bg-white/[0.05] hover:text-gold-light'
                    }`}
                    aria-expanded={moreOpen}
                  >
                    <span className="text-[14px]">•••</span>
                    <span>More</span>
                    <span className="text-[10px]">▾</span>
                  </button>

                  {moreOpen && (
                    <div className="lg-panel lg-pop absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-2xl p-1.5">
                      {overflowNavItems.map(item => <NavButton key={item.id} item={item} mobile />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
            {currentUser && (
              <div className={`lg-chip flex h-10 shrink-0 items-center gap-1 rounded-xl px-2 md:hidden ${hasCoins ? 'lg-chip-warm' : ''}`}>
                <span className={`text-[13px] ${hasCoins ? '' : 'opacity-40 grayscale'}`}>🪙</span>
                <span className={`font-mono text-[12px] font-semibold ${hasCoins ? 'text-gold-light' : 'text-text-dim/60'}`}>
                  {Number(displayCoins || 0).toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex h-10 w-10 shrink-0 items-center justify-center md:hidden">
              {!isDesktop && <NotificationBell ctx={ctx} onNavigate={navigate} />}
            </div>

            <div
              className="lg-chip hidden h-11 shrink-0 items-center gap-2 rounded-xl px-2.5 xl:flex"
              title={`Your time zone: ${AUTO_LOCAL_TZ}`}
            >
              <span className="text-sm text-gold-light/70">◷</span>
              <div className="leading-tight">
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-text-dim">Your Time</div>
                <div className="mt-0.5 font-mono text-[11px] text-gold-light/90">{getLocalZoneLabel()}</div>
              </div>
            </div>

            {currentUser && (
              <>
                <div className="hidden h-11 w-11 shrink-0 items-center justify-center md:flex">
                  {isDesktop && <NotificationBell ctx={ctx} onNavigate={navigate} />}
                </div>

                <div className={`lg-chip hidden shrink-0 items-center gap-2 rounded-xl px-2.5 py-2 lg:flex ${hasCoins ? 'lg-chip-warm' : ''}`}>
                  <span className={`text-[13px] ${hasCoins ? '' : 'opacity-40 grayscale'}`}>🪙</span>
                  <div className="leading-tight">
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-text-dim">Coins</div>
                    <div className={`mt-0.5 font-mono text-[12px] font-semibold ${hasCoins ? 'text-gold-light' : 'text-text-dim/60'}`}>
                      {Number(displayCoins || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div ref={userMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(value => !value)}
                    className={`lg-chip flex h-11 w-11 items-center justify-center gap-2 rounded-xl px-0 transition xl:w-auto xl:justify-start xl:px-2.5 ${
                      userMenuOpen ? 'lg-chip-active' : ''
                    }`}
                    aria-expanded={userMenuOpen}
                  >
                    <span className="lg-emblem flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-gold-light">
                      {(currentUser.name || 'U').charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[125px] text-left xl:block">
                      <span className="block truncate text-[13px] font-semibold text-text-bright">{currentUser.name}</span>
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-text-dim">{currentUser.role}</span>
                    </span>
                    <span className="hidden text-[11px] text-text-dim xl:block">▾</span>
                  </button>

                  {userMenuOpen && (
                    <div className="lg-panel lg-pop absolute right-0 top-full mt-2 w-[min(16rem,calc(100vw-1rem))] overflow-hidden rounded-2xl">
                      <div className="border-b border-white/[0.08] bg-white/[0.03] px-4 py-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">Signed in as</div>
                        <div className="mt-1.5 truncate text-[15px] font-semibold text-text-bright">{currentUser.name}</div>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${roleBadgeClass(currentUser.role)}`}>
                          {currentUser.role}
                        </span>
                      </div>
                      <div className="p-1.5">
                        <button
                          type="button"
                          onClick={() => { navigate('my-activity'); setUserMenuOpen(false) }}
                          className={`block w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition hover:bg-white/[0.06] hover:text-gold-light ${page === 'my-activity' ? 'bg-gold/[0.1] text-gold-bright' : 'text-text'}`}
                        >
                          📜 <span className="ml-2">My Activity</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowChangePassword(true); setUserMenuOpen(false) }}
                          className="block w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-text transition hover:bg-white/[0.06] hover:text-gold-light"
                        >
                          🔑 <span className="ml-2">Change Password</span>
                        </button>
                        <a
                          href={SUPPORT_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setUserMenuOpen(false)}
                          className="block w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-text transition hover:bg-white/[0.06] hover:text-gold-light"
                        >
                          💛 <span className="ml-2">Support the developer</span>
                        </a>
                        <div className="my-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="block w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-red-400 transition hover:bg-red-500/[0.1] hover:text-red-300"
                        >
                          🚪 <span className="ml-2">Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          {/* Scrim is a sibling (not a parent) so the drawer's own blur still works */}
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="lg-panel lg-drawer absolute inset-y-0 left-0 flex w-[86vw] max-w-[360px] flex-col rounded-r-[26px]">
            <div className="border-b border-white/[0.08] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => navigate('dashboard')} className="flex min-w-0 items-center gap-3 text-left">
                  <span className="lg-emblem flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gold-light">
                    <CrestIcon width="24" height="24" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-spectral text-[18px] font-bold text-gold-light">PeakyBlinder</span>
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">Clan Command Center</span>
                  </span>
                </button>
                <button type="button" onClick={() => setMobileOpen(false)} className="lg-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-text-dim hover:text-text-bright" aria-label="Close menu">✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-text-dim">Navigation</div>
              <div className="space-y-1">
                {visibleNavItems.map(item => <NavButton key={item.id} item={item} mobile />)}
              </div>

              <div className="lg-chip mt-6 rounded-2xl p-3.5">
                <div className="flex items-center gap-3">
                  <span className="lg-emblem flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-gold-light">
                    {(currentUser?.name || 'G').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">Account</div>
                    <div className="mt-0.5 truncate text-[14px] font-semibold text-text-bright">{currentUser?.name || 'Guest'}</div>
                  </div>
                  {currentUser && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${roleBadgeClass(currentUser.role)}`}>{currentUser.role}</span>}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3">
                  <span className="text-[11px] font-semibold text-text-dim">Your Time</span>
                  <span className="font-mono text-[11px] text-gold-light/85">{getLocalZoneLabel()}</span>
                </div>
              </div>

              {currentUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('my-activity')}
                    className={`lg-chip mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-3 text-[12px] font-semibold ${page === 'my-activity' ? 'lg-chip-active text-gold-light' : 'text-text hover:text-gold-light'}`}
                  >
                    📜 My Activity
                  </button>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => { setShowChangePassword(true); setMobileOpen(false) }} className="lg-chip min-h-11 rounded-2xl px-3 text-[12px] font-semibold text-text hover:text-gold-light">🔑 Password</button>
                    <button type="button" onClick={handleLogout} className="min-h-11 rounded-2xl border border-red-400/20 bg-red-500/[0.06] px-3 text-[12px] font-semibold text-red-400 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] hover:bg-red-500/[0.12]">🚪 Logout</button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const guest = { id: 'guest', name: 'Guest', role: 'Guest', coins: 0 }
                    setCurrentUser(guest)
                    setMobileOpen(false)
                    addToast('Entered guest mode.', 'blue', 'Welcome')
                  }}
                  className="lg-chip lg-chip-warm mt-3 min-h-11 w-full rounded-2xl text-[12px] font-semibold text-text-dim hover:text-gold-light"
                >
                  👤 Continue as Guest
                </button>
              )}
            </div>

            <div className="border-t border-white/[0.07] px-4 py-3 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim/55">PeakyBlinder • Ymir Clan</div>
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-gold-light underline decoration-gold/30 underline-offset-2 hover:text-gold-bright"
              >
                💛 Built by {CREATOR_NAME} · Support the developer
              </a>
            </div>
          </div>
        </div>
      )}

      <main className="relative mx-auto w-full max-w-[1600px] flex-1 px-3 pb-8 pt-[88px] sm:px-5 lg:px-7">
        {page === 'my-activity' ? <MyActivity ctx={ctx} /> : children}
      </main>

      <footer className="relative mx-auto w-full max-w-[1600px] px-3 pb-6 sm:px-5 lg:px-7">
        <div className="flex flex-col items-center gap-1 px-4 py-3 text-center text-xs leading-5 text-text-dim sm:flex-row sm:justify-center sm:gap-2">
          <span>Built by <span className="font-semibold text-gold-light">{CREATOR_NAME}</span></span>
          <span className="hidden text-white/20 sm:inline">•</span>
          <span>
            Support is always appreciated, never expected. If you'd like to help,{' '}
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gold-light underline decoration-gold/30 underline-offset-2 transition-colors hover:text-gold-bright"
            >
              {SUPPORT_LINK_LABEL}
            </a>
            .
          </span>
        </div>
      </footer>

      <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="lg-panel animate-slideIn relative overflow-hidden rounded-2xl py-3.5 pl-4 pr-4"
          >
            <span className={`absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full ${toastAccent(toast.type)}`} aria-hidden="true" />
            {toast.title && <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gold-light">{toast.title}</div>}
            <div className="text-[13px] leading-5 text-text">{toast.msg}</div>
          </div>
        ))}
      </div>

      {showChangePassword && currentUser && (
        <ChangePasswordModal ctx={ctx} onClose={() => setShowChangePassword(false)} />
      )}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn { animation: slideIn 0.3s forwards; }
        button { -webkit-tap-highlight-color: transparent; }

        /* ---------- Ambient light behind the glass ---------- */
        .lg-ambient {
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .lg-orb {
          position: absolute;
          border-radius: 50%;
          opacity: .6;
        }
        .lg-orb--1 {
          width: 44vmax; height: 44vmax; top: -16vmax; left: -12vmax;
          background: radial-gradient(circle, rgba(201,162,75,.45) 0%, rgba(201,162,75,0) 70%);
        }
        .lg-orb--2 {
          width: 36vmax; height: 36vmax; bottom: -14vmax; right: -10vmax;
          background: radial-gradient(circle, rgba(150,62,38,.4) 0%, rgba(150,62,38,0) 70%);
        }
        .lg-orb--3 {
          width: 24vmax; height: 24vmax; top: 38%; left: 58%;
          background: radial-gradient(circle, rgba(74,96,112,.35) 0%, rgba(74,96,112,0) 70%);
        }

        /* ---------- Top bar ----------
           The blur lives on a pseudo-element, so the nav itself does not
           become a "backdrop root" and the dropdowns inside it still blur
           the page underneath them. */
        .lg-bar::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: -1;
          background: linear-gradient(180deg, rgba(22,18,14,.62) 0%, rgba(12,10,8,.42) 100%);
          backdrop-filter: blur(26px) saturate(170%);
          -webkit-backdrop-filter: blur(26px) saturate(170%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 10px 40px rgba(0,0,0,.35);
        }
        .lg-bar::after {
          content: '';
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(235,208,141,.4) 30%, rgba(255,255,255,.25) 50%, rgba(235,208,141,.4) 70%, transparent);
          pointer-events: none;
        }

        /* ---------- Floating glass panels (menus, drawer, toasts) ---------- */
        .lg-panel {
          background:
            radial-gradient(120% 60% at 0% 0%, rgba(255,255,255,.09) 0%, transparent 50%),
            linear-gradient(160deg, rgba(36,30,24,.72) 0%, rgba(14,11,9,.8) 100%);
          backdrop-filter: blur(30px) saturate(170%);
          -webkit-backdrop-filter: blur(30px) saturate(170%);
          border: 1px solid rgba(255,255,255,.08);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.18),
            0 28px 80px -14px rgba(0,0,0,.8);
        }
        .lg-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 1px;
          border-radius: inherit;
          background: linear-gradient(140deg, rgba(255,255,255,.4), rgba(255,255,255,.04) 35%, rgba(201,162,75,.28) 70%, rgba(255,255,255,.12));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .lg-pop { animation: lg-pop .18s cubic-bezier(.2,.8,.2,1) both; transform-origin: top right; }
        @keyframes lg-pop {
          from { opacity: 0; transform: translateY(-4px) scale(.98); }
          to   { opacity: 1; transform: none; }
        }
        .lg-drawer { animation: lg-drawer .25s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes lg-drawer {
          from { transform: translateX(-24px); opacity: 0; }
          to   { transform: none; opacity: 1; }
        }

        /* ---------- Glass chips (no backdrop-filter on purpose: they sit
           on already-blurred surfaces, and a filter here would break the
           blur of any dropdown opened from inside them) ---------- */
        .lg-chip {
          background: linear-gradient(180deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.025) 100%);
          border: 1px solid rgba(255,255,255,.1);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 4px 14px -6px rgba(0,0,0,.45);
          transition: background .2s ease, border-color .2s ease, box-shadow .2s ease, color .2s ease;
        }
        button.lg-chip:hover, a.lg-chip:hover {
          background: linear-gradient(180deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.04) 100%);
          border-color: rgba(235,208,141,.28);
        }
        .lg-chip.lg-chip-warm {
          background: linear-gradient(180deg, rgba(201,162,75,.14) 0%, rgba(201,162,75,.04) 100%);
          border-color: rgba(235,208,141,.2);
        }
        .lg-chip.lg-chip-active,
        .lg-chip.lg-chip-active:hover {
          background:
            radial-gradient(90% 70% at 50% 0%, rgba(255,255,255,.22) 0%, transparent 70%),
            linear-gradient(180deg, rgba(201,162,75,.22) 0%, rgba(201,162,75,.07) 100%);
          border-color: rgba(235,208,141,.4);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 0 22px -4px rgba(201,162,75,.35);
        }

        /* ---------- Nav track + selected tab ---------- */
        .lg-track {
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(255,255,255,.07);
          box-shadow: inset 0 1px 3px rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.04);
        }
        .lg-tab-active {
          background:
            radial-gradient(90% 70% at 50% 0%, rgba(255,255,255,.24) 0%, transparent 70%),
            linear-gradient(180deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,.04) 100%);
          border-color: rgba(255,255,255,.18);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 4px 14px -4px rgba(0,0,0,.5);
        }

        /* ---------- Emblem / avatar tile ---------- */
        .lg-emblem {
          background:
            radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,.32) 0%, transparent 60%),
            linear-gradient(160deg, rgba(201,162,75,.3) 0%, rgba(201,162,75,.08) 100%);
          border: 1px solid rgba(255,255,255,.2);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 6px 18px -8px rgba(201,162,75,.55);
        }

        /* ---------- Footer strip ---------- */
        .lg-strip {
          background: linear-gradient(135deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.02) 100%);
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
          border: 1px solid rgba(255,255,255,.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
        }

        /* ---------- No blur support: keep everything readable ---------- */
        @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
          .lg-bar::before { background: rgba(10,8,7,.97); }
          .lg-panel { background: rgba(14,11,9,.98); }
          .lg-strip { background: rgba(20,16,13,.95); }
        }

        @media (prefers-reduced-motion: reduce) {
          .lg-orb, .lg-pop, .lg-drawer, .animate-slideIn { animation: none; }
          .lg-chip { transition: none; }
        }
      `}</style>
    </div>
  )
}