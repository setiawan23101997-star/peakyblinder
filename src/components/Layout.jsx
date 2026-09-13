import React, { useState, useEffect, useRef } from 'react'
import ChangePasswordModal from './ChangePasswordModal'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'members', label: 'Members', icon: '👥' },
  { id: 'attendance', label: 'Attendance', icon: '📋' },
  { id: 'auctions', label: 'Auctions', icon: '🔨' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
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
        <div className="h-full px-3.5 sm:px-4 flex items-center justify-between">
          {/* Brand */}
          <button
            type="button"
            onClick={() => setPage('dashboard')}
            className="group flex items-center gap-2.5 shrink-0"
            aria-label="Go to Dashboard"
          >
            <span className="w-9 h-9 sm:w-9 sm:h-9 rounded-lg border border-gold/30 bg-gold/[0.07] flex items-center justify-center text-lg group-hover:border-gold/50 group-hover:bg-gold/10 transition-all">
              🪙
            </span>
            <span className="font-spectral font-bold text-gold-light text-lg tracking-wider group-hover:text-gold-bright transition-colors">
              PeakyBlinder
            </span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <div className="flex items-center gap-0.5 rounded-xl border border-gold/10 bg-black/20 p-1">
              {navItems.map(item => {
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

            {/* User */}
            {currentUser && (
              <div ref={userMenuRef} className="relative ml-1 pl-2 border-l border-gold/10">
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
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-9 h-9 rounded-lg border border-gold/20 bg-gold/[0.04] text-gold-light text-xl flex items-center justify-center hover:bg-gold/10 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer — redesigned for compact app-style navigation */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-[3px] md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 w-[88vw] max-w-[380px] bg-[#0b0908] border-r border-gold/20 shadow-[18px_0_60px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Mobile drawer header */}
            <div className="shrink-0 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 border-b border-gold/10 bg-gradient-to-b from-[#12100d] to-[#0b0908]">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => { setPage('dashboard'); setMobileOpen(false) }}
                  className="flex items-center gap-2.5 min-w-0"
                  aria-label="Go to Dashboard"
                >
                  <span className="w-10 h-10 rounded-xl border border-gold/30 bg-gold/[0.08] flex items-center justify-center text-lg shadow-[0_0_18px_rgba(212,175,55,0.06)]">
                    🪙
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block font-spectral font-bold text-[17px] tracking-wide text-gold-light truncate">
                      PeakyBlinder
                    </span>
                    <span className="block text-[9px] uppercase tracking-[0.18em] text-text-dim mt-0.5">
                      Clan Command Center
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="shrink-0 w-10 h-10 rounded-xl border border-gold/20 bg-white/[0.025] text-gold-light flex items-center justify-center text-xl hover:bg-gold/10 hover:border-gold/35 transition-all"
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable drawer content */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 py-3.5">
              {/* Navigation */}
              <div className="mb-4">
                <div className="px-1 mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-text-dim">
                  Navigation
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {navItems.map(item => {
                    const active = page === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { setPage(item.id); setMobileOpen(false) }}
                        className={`relative min-h-[58px] flex items-center gap-2.5 rounded-xl border px-3 text-left transition-all ${
                          active
                            ? 'border-gold/35 bg-gold/[0.11] text-gold-bright shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_6px_20px_rgba(212,175,55,0.05)]'
                            : 'border-white/[0.06] bg-white/[0.018] text-text-dim hover:border-gold/20 hover:bg-gold/[0.05] hover:text-gold-light'
                        }`}
                      >
                        <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-base ${
                          active ? 'bg-gold/10 border border-gold/20' : 'bg-black/20 border border-white/[0.04]'
                        }`}>
                          {item.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12px] font-semibold leading-tight truncate">{item.label}</span>
                          {active && (
                            <span className="block text-[8px] uppercase tracking-[0.12em] text-gold-light/60 mt-1">
                              Current page
                            </span>
                          )}
                        </span>
                        {active && (
                          <span className="absolute right-2.5 top-2.5 w-1.5 h-1.5 rounded-full bg-gold-bright shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {currentUser ? (
                <>
                  {/* Account */}
                  <div className="rounded-xl border border-gold/15 bg-gradient-to-br from-gold/[0.07] to-transparent p-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 shrink-0 rounded-xl border border-gold/30 bg-gold/10 flex items-center justify-center text-sm font-bold text-gold-light">
                        {(currentUser.name || 'U').charAt(0).toUpperCase()}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] uppercase tracking-[0.16em] text-text-dim">Signed in as</div>
                        <div className="text-sm font-bold text-gold-light truncate mt-0.5">{currentUser.name}</div>
                      </div>

                      <span className={`shrink-0 text-[9px] px-2 py-1 rounded-md ${roleBadgeClass(currentUser.role)}`}>
                        {currentUser.role}
                      </span>
                    </div>
                  </div>

                  {/* Automatic local timezone */}
                  <div className="rounded-xl border border-gold/15 bg-gold/[0.035] overflow-hidden mb-3">
                    <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-gold-light">Your Time</div>
                        <div className="text-[9px] text-text-dim mt-0.5">Detected automatically from this device</div>
                      </div>
                      <span className="text-base text-gold-light">◷</span>
                    </div>
                    <div className="p-2.5">
                      <div className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg bg-black/20 border border-gold/10">
                        <span className="w-8 h-8 rounded-lg bg-gold/[0.08] border border-gold/15 flex items-center justify-center shrink-0 text-gold-light">◷</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-gold-light truncate">{AUTO_LOCAL_TZ}</div>
                          <div className="text-[9px] font-mono text-gold-light/60 mt-0.5">{getLocalZoneLabel()}</div>
                        </div>
                        <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shrink-0" />
                      </div>
                    </div>
                  </div>

                  {/* Account actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowChangePassword(true); setMobileOpen(false) }}
                      className="min-h-10 rounded-lg border border-white/[0.07] bg-white/[0.018] px-3 text-[11px] font-semibold text-text hover:border-gold/20 hover:bg-gold/[0.05] hover:text-gold-light transition-all"
                    >
                      🔑 Password
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="min-h-10 rounded-lg border border-red-500/15 bg-red-500/[0.025] px-3 text-[11px] font-semibold text-red-400 hover:border-red-500/30 hover:bg-red-500/[0.06] hover:text-red-300 transition-all"
                    >
                      🚪 Logout
                    </button>
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
                  className="w-full min-h-11 rounded-xl border border-gold/15 bg-gold/[0.04] text-sm font-semibold text-text-dim hover:text-gold-light hover:bg-gold/[0.07] transition-all"
                >
                  👤 Continue as Guest
                </button>
              )}
            </div>

            {/* Drawer footer */}
            <div className="shrink-0 px-4 py-2.5 border-t border-white/[0.06] bg-black/20 text-center">
              <span className="text-[8px] uppercase tracking-[0.16em] text-text-dim/70">
                PeakyBlinder Clan Management
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Original content dimensions intentionally preserved */}
      <main className="flex-1 mt-16 px-3.5 py-4 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">
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
