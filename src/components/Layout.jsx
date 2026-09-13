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
    <div className="min-h-screen flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-void/95 border-b border-gold/20 backdrop-blur-sm px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🪙</span>
          <span className="font-spectral font-bold text-gold-light text-lg tracking-wider">PeakyBlinder</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`text-sm font-semibold tracking-wider transition-colors ${
                page === item.id ? 'text-gold-bright' : 'text-text-dim hover:text-gold-light'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}

          {/* Region picker */}
          <div ref={regionMenuRef} className="relative ml-3 pl-3 border-l border-gold/20">
            <button
              type="button"
              onClick={() => { setRegionMenuOpen(o => !o); setUserMenuOpen(false) }}
              className={`inline-flex items-center gap-2 text-sm font-semibold tracking-wider rounded border px-3 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 ${
                regionMenuOpen
                  ? 'border-gold/50 bg-gold/10 text-gold-bright'
                  : 'border-gold/25 text-text-dim hover:text-gold-light hover:border-gold/50 hover:bg-gold/5'
              }`}
              aria-expanded={regionMenuOpen}
              aria-label={`Region: ${activeRegion.name}. Click to change.`}
            >
              <span className="text-base leading-none" aria-hidden="true">🌍</span>

              {/* Flag — with the emoji as a fallback if the image can't load */}
              <FlagIcon
                code={activeRegion.code}
                name={activeRegion.name}
                width={20}
                height={15}
                fallbackFlag={activeRegion.flag}
              />

              {/* Region name (Indonesia, etc.) — small caps, truncated if needed */}
              <span className="text-xs font-semibold text-text-bright max-w-[100px] truncate">
                {activeRegion.name}
              </span>

              {/* Timezone label */}
              <span className="text-[10px] font-mono text-text-dim">
                {activeRegion.label}
              </span>

              <span
                className={`text-[10px] text-text-dim transition-transform ${regionMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>

            {regionMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-[280px] rounded-lg border border-gold/30 bg-dark shadow-xl overflow-hidden z-50"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}
              >
                <div className="px-4 py-2.5 border-b border-gold/15 bg-void/40">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gold-light">
                    🌍 Your local time
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
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 ${
                            isActive
                              ? 'bg-gold/15 text-gold-bright'
                              : 'text-text hover:bg-gold/10 hover:text-gold-light'
                          }`}
                          aria-pressed={isActive}
                        >
                          <FlagIcon code={r.code} name={r.name} width={20} height={15} fallbackFlag={r.flag} />

                          <span className="flex-1 min-w-0 text-sm font-semibold truncate">
                            {r.name || r.label || r.id}
                          </span>

                          <span className={`flex-shrink-0 text-[11px] font-mono tabular-nums ${
                            isActive ? 'text-gold-bright' : 'text-text-dim'
                          }`}>
                            {r.label || ''}
                          </span>

                          {isActive && (
                            <span className="flex-shrink-0 text-gold-bright text-xs" aria-hidden="true">✓</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <div className="px-4 py-2.5 border-t border-gold/15 text-[10px] text-text-dim leading-snug">
                  Only changes your local clock and event hints. The schedule stays on server time.
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          {currentUser && (
            <div ref={userMenuRef} className="relative pl-3 border-l border-gold/20">
              <button
                type="button"
                onClick={() => { setUserMenuOpen(o => !o); setRegionMenuOpen(false) }}
                className="flex items-center gap-2 text-sm text-gold-light hover:text-gold-bright transition-colors"
              >
                <span className="font-bold">{currentUser.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${roleBadgeClass(currentUser.role)}`}>
                  {currentUser.role}
                </span>
                <span
                  className="text-[10px] text-text-dim transition-transform"
                  style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}
                >
                  ▾
                </span>
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-[220px] rounded-lg border border-gold/30 bg-dark shadow-xl overflow-hidden z-50"
                  style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}
                >
                  <button
                    type="button"
                    onClick={() => { setShowChangePassword(true); setUserMenuOpen(false) }}
                    className="block w-full text-left px-4 py-2.5 text-sm text-text hover:bg-gold/10 hover:text-gold-light transition-colors"
                  >
                    🔑 Change Password
                  </button>
                  <div className="border-t border-gold/15" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-gold-light text-2xl"
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute top-0 left-0 bottom-0 w-72 bg-dark border-r border-gold/20 p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <span className="font-spectral font-bold text-gold-light">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="text-text-dim">✕</button>
            </div>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setPage(item.id); setMobileOpen(false) }}
                className={`block w-full text-left py-3 px-2 rounded transition-colors ${
                  page === item.id ? 'bg-gold/10 text-gold-bright' : 'text-text-dim hover:text-gold-light hover:bg-gold/5'
                }`}
              >
                {item.icon} {item.label}
              </button>
            ))}

            {currentUser ? (
              <>
                <div className="mt-4 pt-4 border-t border-gold/15 flex items-center gap-2 px-2">
                  <span className="text-sm font-bold text-gold-light truncate">{currentUser.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded flex-shrink-0 ${roleBadgeClass(currentUser.role)}`}>
                    {currentUser.role}
                  </span>
                </div>

                {/* Mobile region picker */}
                <div className="mt-3">
                  <div className="px-2 text-[10px] uppercase tracking-widest font-bold text-gold-light mb-1.5">
                    🌍 Region
                  </div>
                  <ul>
                    {regions.map(r => {
                      const isActive = r.id === activeRegion.id
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => pickRegion(r.id)}
                            className={`w-full flex items-center gap-3 px-2 py-2 rounded text-left transition-colors ${
                              isActive
                                ? 'bg-gold/15 text-gold-bright'
                                : 'text-text-dim hover:text-gold-light hover:bg-gold/5'
                            }`}
                            aria-pressed={isActive}
                          >
                            <FlagIcon code={r.code} name={r.name} width={20} height={15} fallbackFlag={r.flag} />
                            <span className="flex-1 min-w-0 text-xs font-semibold truncate">
                              {r.name || r.label || r.id}
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

                <button
                  onClick={() => { setShowChangePassword(true); setMobileOpen(false) }}
                  className="block w-full text-left py-3 px-2 text-text hover:text-gold-light transition-colors"
                >
                  🔑 Change Password
                </button>
                <button onClick={handleLogout} className="block w-full text-left py-3 px-2 text-red-400 hover:text-red-300 transition-colors">
                  🚪 Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  const guest = { id: 'guest', name: 'Guest', role: 'Guest', coins: 0 }
                  setCurrentUser(guest)
                  setMobileOpen(false)
                  addToast('Entered guest mode.', 'blue', 'Welcome')
                }}
                className="block w-full text-left py-3 px-2 text-text-dim hover:text-gold-light transition-colors"
              >
                👤 Guest
              </button>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 mt-16 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`bg-dark border ${
              toast.type === 'gold' ? 'border-gold/60' :
              toast.type === 'red' ? 'border-blood/60' :
              toast.type === 'blue' ? 'border-blue-500/40' :
              'border-gold/40'
            } rounded p-3 min-w-[200px] max-w-[350px] shadow-xl animate-slideIn`}
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
      `}</style>
    </div>
  )
}