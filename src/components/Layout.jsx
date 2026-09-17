import React, { useState, useEffect, useRef } from 'react'
import ChangePasswordModal from './ChangePasswordModal'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'members', label: 'Members', icon: '👥' },
  { id: 'attendance', label: 'Attendance', icon: '📋' },
  { id: 'auctions', label: 'Auctions', icon: '🔨' },
  { id: 'marketplace', label: 'Marketplace', icon: '🛒' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'notice-board', label: 'Notice Board', icon: '📜' },
  { id: 'admin-log', label: 'Admin Log', icon: '🛡' , staffOnly: true },
]

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
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, message, auction_id, marketplace_item_id, is_read, created_at')
        .eq('user_id', memberId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error

      const auctionIds = [...new Set(
        (data || [])
          .filter(n => n.type === 'auction_won' && n.auction_id)
          .map(n => String(n.auction_id))
      )]

      let auctionMap = {}

      if (auctionIds.length) {
        const { data: auctions, error: auctionError } = await supabase
          .from('auctions')
          .select('id, name, rarity, image_url, image_data')
          .in('id', auctionIds)

        if (auctionError) {
          console.warn('Load notification auction data failed:', auctionError)
        } else {
          auctionMap = Object.fromEntries(
            (auctions || []).map(auction => [String(auction.id), auction])
          )
        }
      }

      const marketplaceItemIds = [...new Set(
        (data || [])
          .filter(n => n.marketplace_item_id)
          .map(n => String(n.marketplace_item_id))
      )]

      let marketplaceItemMap = {}

      if (marketplaceItemIds.length) {
        const { data: marketplaceItems, error: marketplaceError } = await supabase
          .from('marketplace_items')
          .select('id, name, rarity, image_url, image_data')
          .in('id', marketplaceItemIds)

        if (marketplaceError) {
          console.warn('Load notification marketplace item data failed:', marketplaceError)
        } else {
          marketplaceItemMap = Object.fromEntries(
            (marketplaceItems || []).map(item => [String(item.id), item])
          )
        }
      }

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

    const poll = setInterval(loadNotifications, 5000)

    let channel = null
    try {
      // Subscribe without a user_id filter. Some custom-auth setups can
      // prevent filtered Realtime events from reaching the browser.
      // We filter by memberId locally instead.
      channel = supabase
        .channel(`notifications-live-${memberId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
          },
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

            if (incoming.type === 'auction_won' && incoming.auction_id) {
              const { data: auction, error: auctionError } = await supabase
                .from('auctions')
                .select('id, name, rarity, image_url, image_data')
                .eq('id', incoming.auction_id)
                .maybeSingle()

              if (auctionError) {
                console.warn('Realtime auction lookup failed:', auctionError)
              }

              incoming = {
                ...incoming,
                auction: auction || null,
              }
            }

            if (incoming.marketplace_item_id) {
              const { data: marketplaceItem, error: marketplaceError } = await supabase
                .from('marketplace_items')
                .select('id, name, rarity, image_url, image_data')
                .eq('id', incoming.marketplace_item_id)
                .maybeSingle()

              if (marketplaceError) {
                console.warn('Realtime marketplace item lookup failed:', marketplaceError)
              }

              incoming = {
                ...incoming,
                marketplaceItem: marketplaceItem || null,
              }
            }

            setNotifications(prev => [
              incoming,
              ...prev.filter(n => n.id !== incoming.id),
            ].slice(0, 30))
          }
        )
        .subscribe(status => {
          console.log('[Notifications Realtime]', status)
        })
    } catch (err) {
      console.warn('Notification realtime setup failed:', err)
    }

    return () => {
      clearInterval(poll)
      if (channel) {
        try { supabase.removeChannel(channel) } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, memberId, currentUser?.name])

  useEffect(() => {
    if (!open) return

    loadNotifications()

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

    const previous = notifications
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
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
      .update({ is_read: true })
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
    // 5-second poll that started before the DELETE can finish afterward and
    // reinsert the old notifications into React state.
    ++loadRequestRef.current

    const previous = notifications
    setNotifications([])

    const { error } = await supabase
      .from('notifications')
      .delete()
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
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
          open
            ? 'border-gold/40 bg-gold/[.10] text-gold-bright shadow-[0_0_18px_rgba(212,175,55,.08)]'
            : 'border-gold/15 bg-black/15 text-gold-light hover:border-gold/30 hover:bg-gold/[.06]'
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
        <div className="fixed left-2.5 right-2.5 top-[82px] z-[120] w-auto max-w-none overflow-hidden rounded-[14px] border border-gold/25 bg-[#0a0807] shadow-[0_28px_90px_rgba(0,0,0,.88)] md:absolute md:left-auto md:right-0 md:top-full md:mt-3 md:w-[380px] md:max-w-[calc(100vw-20px)]">
          {/* Header */}
          <div className="relative border-b border-white/[.07] px-4 pb-2.5 pt-3.5">
            <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-gold/55 to-transparent" />

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
                      className="rounded-lg border border-gold/15 bg-gold/[.035] px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[.13em] text-gold-light transition-all hover:border-gold/30 hover:bg-gold/[.08]"
                    >
                      Mark all read
                    </button>
                  )}
                  {!confirmClear && (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="rounded-lg border border-red-400/15 bg-red-400/[.025] px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[.13em] text-text-dim transition-all hover:border-red-400/30 hover:bg-red-400/[.07] hover:text-red-300"
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
            <div className="border-b border-red-400/10 bg-red-950/[.12] px-4 py-3">
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
                    className="rounded-lg border border-white/[.08] bg-white/[.025] px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[.12em] text-text-dim hover:bg-white/[.05] hover:text-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={clearAllNotifications}
                    className="rounded-lg border border-red-400/25 bg-red-400/[.08] px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[.12em] text-red-300 hover:bg-red-400/[.14]"
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
                <div className="mx-auto h-8 w-8 animate-pulse rounded-xl border border-gold/20 bg-gold/[.04]" />
                <div className="mt-3 text-[10px] text-text-dim">Loading activity…</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/15 bg-gold/[.035]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-gold-dim">
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
                      className={`group relative mb-1 flex w-full gap-2 overflow-hidden rounded-lg border p-2 text-left transition-all last:mb-0 ${
                        unread
                          ? 'border-white/[.07] bg-gold/[.045] hover:border-white/[.12] hover:bg-gold/[.06]'
                          : 'border-white/[.035] bg-white/[.018] hover:border-white/[.08] hover:bg-white/[.035]'
                      }`}
                    >
                      {/* unread rail */}
                      {unread && (
                        <span className="absolute bottom-2.5 left-0 top-2.5 w-[2px] rounded-r-full bg-gold-bright shadow-[0_0_8px_rgba(242,204,96,.35)]" />
                      )}

                      {isAuctionWin || isMarketplace ? (
                        <span
                          className={`relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center overflow-hidden rounded-[9px] border bg-black/35 ${
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
                              className="h-full w-full rounded-[7px] object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className={`flex h-full w-full items-center justify-center rounded-[8px] text-[8px] font-bold uppercase tracking-[.12em] ${rarity?.text || 'text-text-dim/40'}`}>
                              Item
                            </div>
                          )}
                        </span>
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.025] text-text-dim">
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
  const { currentUser, setCurrentUser, addToast } = ctx
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const userMenuRef = useRef(null)
  const moreMenuRef = useRef(null)

  const visibleNavItems = navItems.filter(
    item => !item.staffOnly || ['Admin', 'Master', 'Elder'].includes(currentUser?.role)
  )
  const primaryNavItems = visibleNavItems.slice(0, 6)
  const secondaryNavItems = visibleNavItems.slice(6)
  const activeSecondary = secondaryNavItems.some(item => item.id === page)

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
    return 'bg-white/[0.04] text-text-dim border border-white/[0.08]'
  }

  const NavButton = ({ item, mobile = false }) => {
    const active = page === item.id
    return (
      <button
        type="button"
        onClick={() => navigate(item.id)}
        className={mobile
          ? `group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
              active
                ? 'border-gold/30 bg-gold/[0.09] text-gold-bright shadow-[0_8px_25px_rgba(212,175,55,.06)]'
                : 'border-transparent text-text-dim hover:border-white/[0.07] hover:bg-white/[0.03] hover:text-text-bright'
            }`
          : `group relative flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold transition-all ${
              active
                ? 'bg-gold/[0.09] text-gold-bright'
                : 'text-text-dim hover:bg-white/[0.035] hover:text-gold-light'
            }`
        }
        aria-current={active ? 'page' : undefined}
      >
        <span className={mobile
          ? `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[16px] ${active ? 'border-gold/25 bg-gold/[0.08]' : 'border-white/[0.06] bg-black/20'}`
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
        {!mobile && active && (
          <span className="absolute bottom-0.5 left-3 right-3 h-px rounded-full bg-gold-bright/70" />
        )}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-text-bright">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-gold/15 bg-[#080706]/95 shadow-[0_8px_35px_rgba(0,0,0,.35)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-4 px-3 sm:px-5 lg:px-7">
          <div className="flex min-w-0 shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileOpen(value => !value)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/[0.045] text-lg text-gold-light transition hover:border-gold/35 hover:bg-gold/[0.09] md:hidden"
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
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/[0.07] text-xl shadow-[0_0_24px_rgba(212,175,55,.06)] transition group-hover:border-gold/50">
                🪙
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block font-spectral text-[18px] font-bold tracking-wide text-gold-light group-hover:text-gold-bright">PeakyBlinder</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim/75">Clan Command Center</span>
              </span>
            </button>
          </div>

          <div className="hidden h-8 w-px bg-white/[0.07] md:block" />

          <div className="hidden min-w-0 flex-1 items-center md:flex">
            <div className="flex items-center gap-0.5 rounded-xl border border-white/[0.06] bg-black/20 p-1">
              {primaryNavItems.map(item => <NavButton key={item.id} item={item} />)}

              {secondaryNavItems.length > 0 && (
                <div ref={moreMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreOpen(value => !value)}
                    className={`flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold transition ${
                      activeSecondary || moreOpen
                        ? 'bg-gold/[0.09] text-gold-bright'
                        : 'text-text-dim hover:bg-white/[0.035] hover:text-gold-light'
                    }`}
                    aria-expanded={moreOpen}
                  >
                    <span className="text-[14px]">•••</span>
                    <span>More</span>
                    <span className="text-[10px]">▾</span>
                  </button>

                  {moreOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-gold/20 bg-[#0b0908] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,.8)]">
                      {secondaryNavItems.map(item => <NavButton key={item.id} item={item} mobile />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="md:hidden">
              <NotificationBell ctx={ctx} onNavigate={navigate} />
            </div>

            <div className="hidden xl:flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-gold/10 bg-gold/[0.04] text-sm">◷</span>
              <div className="leading-tight">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">Your Time</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="max-w-[120px] truncate text-[12px] font-semibold text-text-bright">{AUTO_LOCAL_TZ}</span>
                  <span className="font-mono text-[11px] text-gold-light/85">{getLocalZoneLabel()}</span>
                </div>
              </div>
            </div>

            {currentUser && (
              <>
                <div className="hidden md:block">
                  <NotificationBell ctx={ctx} onNavigate={navigate} />
                </div>
                <div ref={userMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(value => !value)}
                    className={`flex h-11 items-center gap-2 rounded-xl border px-2.5 transition ${
                      userMenuOpen ? 'border-gold/25 bg-gold/[0.07]' : 'border-white/[0.06] bg-black/15 hover:border-gold/20 hover:bg-white/[0.025]'
                    }`}
                    aria-expanded={userMenuOpen}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/25 bg-gold/[0.08] text-[13px] font-bold text-gold-light">
                      {(currentUser.name || 'U').charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[125px] text-left lg:block">
                      <span className="block truncate text-[13px] font-semibold text-text-bright">{currentUser.name}</span>
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-text-dim">{currentUser.role}</span>
                    </span>
                    <span className="text-[11px] text-text-dim">▾</span>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-gold/20 bg-[#0b0908] shadow-[0_22px_65px_rgba(0,0,0,.85)]">
                      <div className="border-b border-white/[0.07] bg-black/20 px-4 py-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">Signed in as</div>
                        <div className="mt-1.5 truncate text-[15px] font-semibold text-text-bright">{currentUser.name}</div>
                        <span className={`mt-2 inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${roleBadgeClass(currentUser.role)}`}>
                          {currentUser.role}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setShowChangePassword(true); setUserMenuOpen(false) }}
                        className="block w-full px-4 py-3 text-left text-[13px] font-medium text-text transition hover:bg-gold/[0.06] hover:text-gold-light"
                      >
                        🔑 <span className="ml-2">Change Password</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="block w-full border-t border-white/[0.06] px-4 py-3 text-left text-[13px] font-medium text-red-400 transition hover:bg-red-500/[0.06] hover:text-red-300"
                      >
                        🚪 <span className="ml-2">Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute inset-y-0 left-0 flex w-[86vw] max-w-[360px] flex-col border-r border-gold/20 bg-[#090807] shadow-[20px_0_70px_rgba(0,0,0,.85)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="border-b border-white/[0.07] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => navigate('dashboard')} className="flex min-w-0 items-center gap-3 text-left">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/[0.07] text-xl">🪙</span>
                  <span className="min-w-0">
                    <span className="block truncate font-spectral text-[18px] font-bold text-gold-light">PeakyBlinder</span>
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">Clan Command Center</span>
                  </span>
                </button>
                <button type="button" onClick={() => setMobileOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-lg text-text-dim hover:text-text-bright" aria-label="Close menu">✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-text-dim">Navigation</div>
              <div className="space-y-1">
                {visibleNavItems.map(item => <NavButton key={item.id} item={item} mobile />)}
              </div>

              <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.018] p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/[0.07] text-sm font-bold text-gold-light">
                    {(currentUser?.name || 'G').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">Account</div>
                    <div className="mt-0.5 truncate text-[14px] font-semibold text-text-bright">{currentUser?.name || 'Guest'}</div>
                  </div>
                  {currentUser && <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${roleBadgeClass(currentUser.role)}`}>{currentUser.role}</span>}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <span className="text-[11px] font-semibold text-text-dim">Your Time</span>
                  <span className="font-mono text-[11px] text-gold-light/85">{getLocalZoneLabel()}</span>
                </div>
              </div>

              {currentUser ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setShowChangePassword(true); setMobileOpen(false) }} className="min-h-11 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 text-[12px] font-semibold text-text hover:border-gold/20 hover:bg-gold/[0.05] hover:text-gold-light">🔑 Password</button>
                  <button type="button" onClick={handleLogout} className="min-h-11 rounded-xl border border-red-500/15 bg-red-500/[0.025] px-3 text-[12px] font-semibold text-red-400 hover:bg-red-500/[0.06]">🚪 Logout</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const guest = { id: 'guest', name: 'Guest', role: 'Guest', coins: 0 }
                    setCurrentUser(guest)
                    setMobileOpen(false)
                    addToast('Entered guest mode.', 'blue', 'Welcome')
                  }}
                  className="mt-3 min-h-11 w-full rounded-xl border border-gold/15 bg-gold/[0.04] text-[12px] font-semibold text-text-dim hover:bg-gold/[0.07] hover:text-gold-light"
                >
                  👤 Continue as Guest
                </button>
              )}
            </div>

            <div className="border-t border-white/[0.06] px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim/55">
              PeakyBlinder • Ymir Clan
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1600px] px-3 pb-8 pt-[88px] sm:px-5 lg:px-7">
        {children}
      </main>

      <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`rounded-xl border bg-[#0b0908]/95 p-3.5 backdrop-blur-sm shadow-[0_15px_45px_rgba(0,0,0,.65)] ${
              toast.type === 'gold' ? 'border-gold/50' :
              toast.type === 'red' ? 'border-blood/50' :
              toast.type === 'blue' ? 'border-blue-500/40' :
              'border-gold/30'
            }`}
          >
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
      `}</style>
    </div>
  )
}
