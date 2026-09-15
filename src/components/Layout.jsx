import React, { useState, useEffect, useRef } from 'react'
import ChangePasswordModal from './ChangePasswordModal'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'members', label: 'Members', icon: '👥' },
  { id: 'attendance', label: 'Attendance', icon: '📋' },
  { id: 'auctions', label: 'Auctions', icon: '🔨' },
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
        .select('id, user_id, type, title, message, auction_id, is_read, created_at')
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

      // Ignore an older request if Clear All (or a newer load) happened
      // while this query was still in flight.
      if (requestId !== loadRequestRef.current) return

      setNotifications(
        (data || []).map(notification => ({
          ...notification,
          auction: notification.auction_id
            ? auctionMap[String(notification.auction_id)] || null
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
        <div className="absolute right-0 top-full mt-3 z-[120] w-[min(380px,calc(100vw-20px))] overflow-hidden rounded-[14px] border border-gold/25 bg-[#0a0807] shadow-[0_28px_90px_rgba(0,0,0,.88)]">
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
                  const rarity = isAuctionWin
                    ? getNotificationRarity(notification.auction?.rarity)
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

                      {isAuctionWin ? (
                        <span
                          className={`relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center overflow-hidden rounded-[9px] border bg-black/35 ${
                            getNotificationRarity(notification.auction?.rarity).border
                          } ${getNotificationRarity(notification.auction?.rarity).glow}`}
                        >
                          {getNotificationAuctionImage(notification.auction) ? (
                            <img
                              src={getNotificationAuctionImage(notification.auction)}
                              alt={notification.auction?.name || 'Auction item'}
                              className="h-full w-full rounded-[7px] object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-[8px] text-[8px] font-bold uppercase tracking-[.12em] text-text-dim/40">
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
                            ) : String(notification.title || "").replace(/^🏆\s*/, "")}
                        </span>

                        <span className={`mt-0.5 block text-[10px] leading-[1.35] ${
                          unread ? 'text-text-dim' : 'text-text-dim/75'
                        }`}>
                          {isAuctionWin ? renderAuctionWonMessage(notification, notification.auction) : notification.message}
                        </span>

                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] font-bold uppercase tracking-[.13em] text-text-dim/50">
                          <span>{formatNotificationTime(notification.created_at)}</span>
                          {notification.auction_id && (
                            <>
                              <span>•</span>
                              <span className="text-gold-dim transition-colors group-hover:text-gold-light">
                                View auction →
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
  const [showChangePassword, setShowChangePassword] = useState(false)

  const userMenuRef = useRef(null)

  useEffect(() => {
    if (!userMenuOpen) return

    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }

    const handleEscape = (e) => {
      if (e.key === 'Escape') setUserMenuOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [userMenuOpen])

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUser')
    addToast('Logged out.', 'blue', 'Goodbye')
    setUserMenuOpen(false)
  }


  const roleBadgeClass = (role) => {
    if (role === 'Admin') return 'bg-red-500/20 text-red-400 border border-red-500/40'
    if (role === 'Master') return 'bg-gold/15 text-gold-light border border-gold/40'
    if (role === 'Elder') return 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
    return 'bg-gold/10 text-text-dim border border-gold/20'
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-void/95 border-b border-gold/15 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.22)]">
        <div className="h-full px-3 sm:px-4 flex items-center justify-between md:justify-between">
          {/* Mobile app header: menu + brand stay together on the LEFT */}
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-10 h-10 shrink-0 rounded-xl border border-gold/20 bg-gold/[0.04] text-gold-light flex items-center justify-center transition-colors hover:bg-gold/10"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? '✕' : '☰'}
            </button>

            {/* Brand */}
            <button
              type="button"
              onClick={() => setPage('dashboard')}
              className="group flex min-w-0 items-center gap-2.5 shrink-0"
              aria-label="Go to Dashboard"
            >
              <span className="w-9 h-9 rounded-lg border border-gold/30 bg-gold/[0.07] flex items-center justify-center text-lg group-hover:border-gold/50 group-hover:bg-gold/10 transition-all">
                🪙
              </span>
              <span className="font-spectral font-bold text-[18px] sm:text-lg tracking-wide sm:tracking-wider text-gold-light group-hover:text-gold-bright transition-colors truncate">
                PeakyBlinder
              </span>
            </button>
          </div>

          {/* Mobile notification access */}
          <div className="md:hidden ml-auto pl-2">
            <NotificationBell ctx={ctx} onNavigate={setPage} />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 ml-auto">
            <div className="flex items-center gap-0.5 rounded-xl border border-gold/10 bg-black/20 p-1">
              {navItems.filter(item => !item.staffOnly || ['Admin', 'Master', 'Elder'].includes(currentUser?.role)).map(item => {
                const active = page === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPage(item.id)}
                    className={`relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold tracking-wide transition-all duration-150 ${
                      active
                        ? 'bg-gold/10 text-gold-bright border border-gold/20 shadow-[0_2px_12px_rgba(212,175,55,0.08)]'
                        : 'border border-transparent text-text-dim hover:text-gold-light hover:bg-white/[0.025]'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className={`text-[13px] leading-none ${active ? 'opacity-100' : 'opacity-70'}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {active && <span className="absolute left-3 right-3 -bottom-[1px] h-px bg-gold/70 rounded-full" />}
                  </button>
                )
              })}
            </div>

            {/* Automatic local timezone */}
            <div className="relative ml-2">
              <div
                className="inline-flex items-center gap-2 rounded-xl border border-gold/15 bg-black/15 px-3 py-1.5"
                title="Automatically detected from your browser/device timezone"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-gold/10 bg-gold/[0.04] text-[12px]">
                  ◷
                </span>
                <span className="hidden lg:block text-left leading-tight">
                  <span className="block text-[9px] uppercase tracking-[0.14em] text-text-dim">Your Time</span>
                  <span className="block max-w-[110px] truncate text-[11px] font-semibold text-text-bright">{AUTO_LOCAL_TZ}</span>
                </span>
                <span className="text-[10px] font-mono text-gold-light/80">{getLocalZoneLabel()}</span>
              </div>
            </div>

            {/* User + Notifications */}
            {currentUser && (
              <div className="relative ml-1 pl-2 border-l border-gold/10 flex items-center gap-1.5">
                <NotificationBell ctx={ctx} onNavigate={setPage} />

                <div ref={userMenuRef} className="relative">
                  <button
                  type="button"
                  onClick={() => setUserMenuOpen(o => !o)}
                  className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all ${
                    userMenuOpen ? 'bg-white/[0.035]' : 'hover:bg-white/[0.025]'
                  }`}
                  aria-expanded={userMenuOpen}
                >
                  <span className="w-7 h-7 rounded-full border border-gold/25 bg-gold/10 flex items-center justify-center text-[11px] font-bold text-gold-light">
                    {(currentUser.name || 'U').charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden lg:block text-left max-w-[100px]">
                    <span className="block text-xs font-semibold text-gold-light truncate">{currentUser.name}</span>
                    <span className="block text-[9px] uppercase tracking-wider text-text-dim">{currentUser.role}</span>
                  </span>
                  <span className="text-[10px] text-text-dim">▾</span>
                </button>

                {userMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-[220px] rounded-xl border border-gold/25 bg-dark shadow-2xl overflow-hidden z-[100] pointer-events-auto"
                    style={{ boxShadow: '0 20px 55px rgba(0,0,0,0.82)' }}
                  >
                    <div className="px-4 py-3 border-b border-gold/10 bg-void/50">
                      <div className="text-[10px] uppercase tracking-widest text-text-dim">Signed in as</div>
                      <div className="text-sm font-semibold text-gold-light mt-1 truncate">{currentUser.name}</div>
                      <span className={`inline-flex mt-2 text-[10px] px-2 py-0.5 rounded ${roleBadgeClass(currentUser.role)}`}>
                        {currentUser.role}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowChangePassword(true); setUserMenuOpen(false) }}
                      className="block w-full text-left px-4 py-3 text-sm text-text hover:bg-gold/10 hover:text-gold-light transition-colors"
                    >
                      🔑 <span className="ml-1">Change Password</span>
                    </button>
                    <div className="border-t border-gold/10" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      🚪 <span className="ml-1">Logout</span>
                    </button>
                  </div>
                )}
                </div>
              </div>
            )}
          </div>


        </div>
      </nav>

      {/* Mobile Drawer — compact, left-side, app-style navigation */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 w-[78vw] max-w-[300px] bg-[#0b0908] border-r border-gold/20 shadow-[18px_0_50px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Compact drawer header */}
            <div className="shrink-0 px-3.5 pt-[calc(0.7rem+env(safe-area-inset-top))] pb-3 border-b border-gold/10">
              <div className="flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => { setPage('dashboard'); setMobileOpen(false) }}
                  className="flex min-w-0 items-center gap-2.5 text-left"
                  aria-label="Go to Dashboard"
                >
                  <span className="w-9 h-9 shrink-0 rounded-lg border border-gold/30 bg-gold/[0.08] flex items-center justify-center text-base">
                    🪙
                  </span>
                  <span className="min-w-0">
                    <span className="block font-spectral font-bold text-[16px] tracking-wide text-gold-light truncate">
                      PeakyBlinder
                    </span>
                    <span className="block text-[8px] uppercase tracking-[0.17em] text-text-dim mt-0.5">
                      Clan Command Center
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="shrink-0 w-9 h-9 rounded-lg border border-white/[0.07] bg-white/[0.02] text-gold-light flex items-center justify-center text-lg hover:bg-gold/10 transition-colors"
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2.5 py-2">
              {/* Primary navigation — one clean vertical list */}
              <div>
                <div className="px-1 mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-text-dim">
                  Navigation
                </div>

                <nav className="space-y-1.5" aria-label="Mobile navigation">
                  {navItems.filter(item => !item.staffOnly || ['Admin', 'Master', 'Elder'].includes(currentUser?.role)).map(item => {
                    const active = page === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { setPage(item.id); setMobileOpen(false) }}
                        className={`relative flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all ${
                          active
                            ? 'border-gold/30 bg-gold/[0.09] text-gold-bright'
                            : 'border-transparent bg-transparent text-text-dim hover:border-white/[0.06] hover:bg-white/[0.025] hover:text-gold-light'
                        }`}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[15px] ${
                          active
                            ? 'bg-gold/[0.09] border border-gold/20'
                            : 'bg-black/20 border border-white/[0.04]'
                        }`}>
                          {item.icon}
                        </span>

                        <span className="min-w-0 flex-1 text-[12px] font-semibold truncate">
                          {item.label}
                        </span>

                        {active && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-bright shadow-[0_0_8px_rgba(212,175,55,0.55)]" />
                        )}
                      </button>
                    )
                  })}
                </nav>
              </div>

              {currentUser ? (
                <div className="mt-5">
                  {/* Compact account row */}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.018] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 shrink-0 rounded-lg border border-gold/25 bg-gold/[0.07] flex items-center justify-center text-[11px] font-bold text-gold-light">
                        {(currentUser.name || 'U').charAt(0).toUpperCase()}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="text-[8px] uppercase tracking-[0.15em] text-text-dim">Signed in</div>
                        <div className="mt-0.5 text-[12px] font-semibold text-gold-light truncate">{currentUser.name}</div>
                      </div>

                      <span className={`shrink-0 text-[8px] px-1.5 py-1 rounded ${roleBadgeClass(currentUser.role)}`}>
                        {currentUser.role}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-white/[0.05] pt-2">
                      <span className="text-[8px] uppercase tracking-[0.14em] text-text-dim">Your Time</span>
                      <span className="text-[8px] font-mono text-gold-light/80">
                        {getLocalZoneLabel()}
                      </span>
                    </div>
                  </div>

                  {/* Compact account actions */}
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setShowChangePassword(true); setMobileOpen(false) }}
                      className="min-h-9 rounded-lg border border-white/[0.07] bg-white/[0.018] px-2.5 text-[10px] font-semibold text-text hover:border-gold/20 hover:bg-gold/[0.05] hover:text-gold-light transition-all"
                    >
                      🔑 Password
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="min-h-9 rounded-lg border border-red-500/15 bg-red-500/[0.025] px-2.5 text-[10px] font-semibold text-red-400 hover:border-red-500/30 hover:bg-red-500/[0.06] hover:text-red-300 transition-all"
                    >
                      🚪 Logout
                    </button>
                  </div>
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
                  className="mt-5 w-full min-h-10 rounded-lg border border-gold/15 bg-gold/[0.04] text-[11px] font-semibold text-text-dim hover:text-gold-light hover:bg-gold/[0.07] transition-all"
                >
                  👤 Continue as Guest
                </button>
              )}
            </div>

            <div className="shrink-0 px-3 py-2 border-t border-white/[0.06] bg-black/20 text-center">
              <span className="text-[8px] uppercase tracking-[0.15em] text-text-dim/60">
                PeakyBlinder
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Original content dimensions intentionally preserved */}
      <main className="flex-1 mt-16 px-2.5 py-2.5.5 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`bg-dark/95 backdrop-blur-sm border ${
              toast.type === 'gold' ? 'border-gold/60' :
              toast.type === 'red' ? 'border-blood/60' :
              toast.type === 'blue' ? 'border-blue-500/40' :
              'border-gold/40'
            } rounded-lg p-3 min-w-[200px] max-w-[350px] shadow-xl animate-slideIn`}
          >
            {toast.title && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-gold-light mb-1">
                {toast.title}
              </div>
            )}
            <div className="text-sm text-text">{toast.msg}</div>
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
        .animate-slideIn {
          animation: slideIn 0.3s forwards;
        }
        button {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  )
}
