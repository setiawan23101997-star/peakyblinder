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
  const { currentUser, setCurrentUser, addToast, region, setRegionId, regions: ctxRegions } = ctx

  // Normalize regions: always have `code` and `flag` fields.
  const regions = (Array.isArray(ctxRegions) && ctxRegions.length > 0 ? ctxRegions : FALLBACK_REGIONS)
    .map(r => ({
      ...r,
      code: r.code || r.id,
      flag: r.flag || '',
    }))

  const activeRegion = (() => {
    if (!region) return regions[0]
    // Normalize the incoming region the same way.
    return {
      ...region,
      code: region.code || region.id,
      flag: region.flag || '',
      name: region.name || region.label || region.id,
      label: region.label || '',
    }
  })()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [regionMenuOpen, setRegionMenuOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const userMenuRef = useRef(null)
  const regionMenuRef = useRef(null)

  useEffect(() => {
    if (!userMenuOpen && !regionMenuOpen) return
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
      if (regionMenuRef.current && !regionMenuRef.current.contains(e.target)) {
        setRegionMenuOpen(false)
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false)
        setRegionMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [userMenuOpen, regionMenuOpen])

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUser')
    addToast('Logged out.', 'blue', 'Goodbye')
    setUserMenuOpen(false)
  }

  const pickRegion = (id) => {
    if (typeof setRegionId === 'function') {
      setRegionId(id)
    } else {
      try { localStorage.setItem('peakyblader:localRegion', id) } catch {}
    }
    setRegionMenuOpen(false)
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
        <div className="h-full px-4 flex items-center justify-between">
          {/* Brand */}
          <button
            type="button"
            onClick={() => setPage('dashboard')}
            className="group flex items-center gap-2.5 shrink-0"
            aria-label="Go to Dashboard"
          >
            <span className="w-9 h-9 rounded-lg border border-gold/30 bg-gold/[0.07] flex items-center justify-center text-lg group-hover:border-gold/50 group-hover:bg-gold/10 transition-all">
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

            {/* Region */}
            <div ref={regionMenuRef} className="relative ml-2">
              <button
                type="button"
                onClick={() => { setRegionMenuOpen(o => !o); setUserMenuOpen(false) }}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-all ${
                  regionMenuOpen
                    ? 'border-gold/45 bg-gold/10 shadow-[0_0_18px_rgba(212,175,55,0.07)]'
                    : 'border-gold/15 bg-black/15 hover:border-gold/30 hover:bg-gold/[0.04]'
                }`}
                aria-expanded={regionMenuOpen}
                aria-label={`Region: ${activeRegion.name}. Click to change.`}
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-white/[0.03] border border-gold/10">
                  <FlagIcon code={activeRegion.code} name={activeRegion.name} width={20} height={15} fallbackFlag={activeRegion.flag} />
                </span>
                <span className="hidden lg:block text-left leading-tight">
                  <span className="block text-[9px] uppercase tracking-[0.14em] text-text-dim">Local Time</span>
                  <span className="block text-[11px] font-semibold text-text-bright truncate max-w-[82px]">
                    {activeRegion.name}
                  </span>
                </span>
                <span className="text-[10px] font-mono text-gold-light/80">{activeRegion.label}</span>
                <span className={`text-[10px] text-text-dim transition-transform ${regionMenuOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {regionMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-[280px] rounded-xl border border-gold/25 bg-dark/98 shadow-2xl overflow-hidden z-[100] pointer-events-auto"
                  style={{ boxShadow: '0 20px 55px rgba(0,0,0,0.82)' }}
                >
                  <div className="px-4 py-3 border-b border-gold/10 bg-void/60">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-light">
                      Your Local Region
                    </div>
                    <div className="text-[11px] text-text-dim mt-1">
                      Select your timezone. Game/server time stays unchanged.
                    </div>
                  </div>

                  <ul className="py-1">
                    {regions.map(r => {
                      const isActive = r.id === activeRegion.id
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); pickRegion(r.id) }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors ${
                              isActive
                                ? 'bg-gold/10 text-gold-bright'
                                : 'text-text hover:bg-white/[0.035] hover:text-gold-light'
                            }`}
                            aria-pressed={isActive}
                          >
                            <span className="w-7 h-7 rounded-md border border-gold/10 bg-white/[0.025] flex items-center justify-center shrink-0">
                              <FlagIcon code={r.code} name={r.name} width={20} height={15} fallbackFlag={r.flag} />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-semibold truncate">{r.name || r.label || r.id}</span>
                              <span className={`block text-[10px] font-mono mt-0.5 ${isActive ? 'text-gold-light/80' : 'text-text-dim'}`}>
                                {r.label || ''}
                              </span>
                            </span>
                            {isActive && (
                              <span className="w-5 h-5 rounded-full border border-gold/35 bg-gold/10 flex items-center justify-center text-gold-bright text-[10px]">✓</span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>

                  <div className="px-4 py-2.5 border-t border-gold/10 bg-black/10 text-[10px] text-text-dim leading-snug">
                    Local time is for your convenience. Event schedules remain based on server time.
                  </div>
                </div>
              )}
            </div>

            {/* User */}
            {currentUser && (
              <div ref={userMenuRef} className="relative ml-1 pl-2 border-l border-gold/10">
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(o => !o); setRegionMenuOpen(false) }}
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

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-0 left-0 bottom-0 w-72 bg-dark border-r border-gold/15 p-4 overflow-y-auto shadow-[12px_0_40px_rgba(0,0,0,0.4)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-12 flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg border border-gold/25 bg-gold/[0.06] flex items-center justify-center">🪙</span>
                <span className="font-spectral font-bold text-gold-light">Menu</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="w-8 h-8 rounded-lg border border-gold/15 text-text-dim hover:text-gold-light hover:bg-white/[0.03]">✕</button>
            </div>

            <div className="space-y-1">
              {navItems.map(item => {
                const active = page === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => { setPage(item.id); setMobileOpen(false) }}
                    className={`flex items-center gap-3 w-full text-left py-3 px-3 rounded-lg transition-colors ${
                      active
                        ? 'bg-gold/10 text-gold-bright border border-gold/15'
                        : 'text-text-dim hover:text-gold-light hover:bg-gold/5 border border-transparent'
                    }`}
                  >
                    <span className="w-7 text-center text-sm">{item.icon}</span>
                    <span className="text-sm font-semibold">{item.label}</span>
                  </button>
                )
              })}
            </div>

            {currentUser ? (
              <>
                <div className="mt-5 pt-4 border-t border-gold/10 flex items-center gap-2 px-2">
                  <span className="w-8 h-8 rounded-full border border-gold/25 bg-gold/10 flex items-center justify-center text-[11px] font-bold text-gold-light">
                    {(currentUser.name || 'U').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gold-light truncate">{currentUser.name}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded inline-flex mt-0.5 ${roleBadgeClass(currentUser.role)}`}>
                      {currentUser.role}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="px-2 text-[10px] uppercase tracking-widest font-bold text-gold-light mb-2">
                    🌍 Region
                  </div>
                  <ul className="space-y-0.5">
                    {regions.map(r => {
                      const isActive = r.id === activeRegion.id
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); pickRegion(r.id) }}
                            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-gold/10 text-gold-bright'
                                : 'text-text-dim hover:text-gold-light hover:bg-gold/5'
                            }`}
                            aria-pressed={isActive}
                          >
                            <FlagIcon code={r.code} name={r.name} width={20} height={15} fallbackFlag={r.flag} />
                            <span className="flex-1 min-w-0 text-xs font-semibold truncate">{r.name || r.label || r.id}</span>
                            {isActive && <span className="text-gold-bright text-xs shrink-0">✓</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t border-gold/10">
                  <button
                    onClick={() => { setShowChangePassword(true); setMobileOpen(false) }}
                    className="block w-full text-left py-2.5 px-2 text-text hover:text-gold-light transition-colors"
                  >
                    🔑 Change Password
                  </button>
                  <button onClick={handleLogout} className="block w-full text-left py-2.5 px-2 text-red-400 hover:text-red-300 transition-colors">
                    🚪 Logout
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => {
                  const guest = { id: 'guest', name: 'Guest', role: 'Guest', coins: 0 }
                  setCurrentUser(guest)
                  setMobileOpen(false)
                  addToast('Entered guest mode.', 'blue', 'Welcome')
                }}
                className="mt-5 pt-4 border-t border-gold/10 block w-full text-left py-3 px-2 text-text-dim hover:text-gold-light transition-colors"
              >
                👤 Guest
              </button>
            )}
          </div>
        </div>
      )}

      {/* Original content dimensions intentionally preserved */}
      <main className="flex-1 mt-16 p-4 md:p-6 max-w-7xl mx-auto w-full">
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
