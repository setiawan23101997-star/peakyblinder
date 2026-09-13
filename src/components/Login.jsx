import React, { useState } from 'react'

export default function Login({ ctx }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!username || !password) {
      setError('Please enter both username and password.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      // handleLogin may be synchronous or return a Promise.
      // Awaiting it ensures failed async authentication is handled correctly
      // instead of treating the Promise itself as a successful result.
      const ok = await Promise.resolve(ctx.handleLogin(username, password))

      if (!ok) {
        setError('Invalid username or password.')
        return
      }
    } catch (err) {
      console.error('Login failed:', err)
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-void">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-gold/[0.045] blur-3xl" />
        <div className="absolute bottom-[-260px] left-[-180px] h-[480px] w-[480px] rounded-full bg-black/30 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
      </div>

      <div className="relative flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[430px]">
          {/* Brand */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/30 bg-gold/[0.06] shadow-[0_0_45px_rgba(212,175,55,0.08)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/25 bg-black/25 text-2xl text-gold-bright">
                ◈
              </div>
            </div>

            <div className="mb-1 flex items-center justify-center gap-2">
              <span className="h-px w-8 bg-gold/45" />
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold-light">
                Clan Portal
              </span>
              <span className="h-px w-8 bg-gold/45" />
            </div>

            <h1 className="font-spectral text-3xl font-bold tracking-tight text-gold-light">
              PeakyBlinder
            </h1>
            <p className="mt-1 text-xs text-text-dim">
              Clan Management System
            </p>
          </div>

          {/* Login panel */}
          <div className="overflow-hidden rounded-xl border border-gold/20 bg-black/35 shadow-2xl shadow-black/30 backdrop-blur-sm">
            <div className="border-b border-gold/10 bg-gold/[0.025] px-5 py-4 sm:px-6">
              <div className="text-sm font-bold text-text">Welcome Back</div>
              <div className="mt-0.5 text-[10px] text-text-dim">
                Sign in to access the clan portal.
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <form onSubmit={handleSubmit} noValidate>
                {error && (
                  <div
                    role="alert"
                    className="mb-4 rounded-lg border border-red-500/35 bg-red-500/[0.08] px-3.5 py-3 text-xs text-red-300"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-px">!</span>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label
                    htmlFor="login-username"
                    className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-text-dim"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-dim">
                      ◉
                    </span>
                    <input
                      id="login-username"
                      type="text"
                      className="input h-11 w-full pl-9 text-sm"
                      placeholder="Enter your username"
                      value={username}
                      onChange={e => {
                        setUsername(e.target.value)
                        if (error) setError('')
                      }}
                      disabled={submitting}
                      autoFocus
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="mb-5">
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-text-dim"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-dim">
                      ◆
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className="input h-11 w-full pl-9 pr-12 text-sm"
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value)
                        if (error) setError('')
                      }}
                      disabled={submitting}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={submitting}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] text-text-dim transition-colors hover:bg-gold/10 hover:text-gold-light disabled:opacity-40"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-gold flex h-11 w-full items-center justify-center text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            </div>

            <div className="border-t border-gold/10 bg-black/10 px-5 py-3.5 text-center sm:px-6">
              <p className="text-[10px] leading-relaxed text-text-dim">
                Access is by invitation only. Contact your Master if you need an account.
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.16em] text-text-dim/60">
            <span className="h-px w-8 bg-gold/15" />
            <span>PeakyBlinder Clan</span>
            <span className="h-px w-8 bg-gold/15" />
          </div>
        </div>
      </div>
    </div>
  )
}
