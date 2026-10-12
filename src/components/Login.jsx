import React, { useState } from 'react'

// Footer credit.
const CREATOR_NAME = 'Ryuji / MiaKhalifa'
const CONTACT_LABEL = 'just message me'
const CONTACT_URL = 'https://discord.com/users/703295552821133324'

const TABS = ['login', 'info']
const FEATURES = ['Attendance', 'Members', 'Auctions', 'Leaderboard']

// Original art-deco crest: shield, twin chevrons, diamond crown.
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

export default function Login({ ctx }) {
  const [tab, setTab] = useState('login') // 'login' | 'info'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsOn, setCapsOn] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    if (!username.trim() || !password) {
      setError('Enter both your username and password.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const ok = await Promise.resolve(ctx.handleLogin(username, password))
      if (!ok) setError('Wrong username or password. Check both and try again.')
    } catch (err) {
      console.error('Login failed:', err)
      setError(err?.message || 'Could not sign you in. Try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  const checkCaps = (e) => {
    if (e.getModifierState) setCapsOn(e.getModifierState('CapsLock'))
  }

  const handleTabKey = (e) => {
    const i = TABS.indexOf(tab)
    let next = null
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length]
    else if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length]
    else if (e.key === 'Home') next = TABS[0]
    else if (e.key === 'End') next = TABS[TABS.length - 1]
    if (next) {
      e.preventDefault()
      setTab(next)
      document.getElementById(`pb-tab-${next}`)?.focus()
    }
  }

  const clearError = () => {
    if (error) setError('')
  }

  return (
    <div className="pb-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        .pb-page {
          --soot: #0a0908;
          --coal: #14110f;
          --brass: #c9a24b;
          --brass-hi: #ebd08d;
          --brass-glow: rgba(201, 162, 75, 0.28);
          --bone: #f6eedf;
          --ash: #b9ae9c;
          --danger: #ff9d94;

          /* Glass tokens */
          --glass-fill: linear-gradient(135deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.04) 100%);
          --glass-fill-strong: linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 100%);
          --glass-line: rgba(255,255,255,0.16);
          --glass-line-soft: rgba(255,255,255,0.09);
          --glass-blur: blur(26px) saturate(170%);
          --glass-blur-sm: blur(14px) saturate(150%);
          --glass-hi: inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(255,255,255,0.04);

          position: fixed;
          inset: 0;
          overflow-y: auto;
          color: var(--bone);
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
          background:
            radial-gradient(120% 80% at 50% -10%, #2a1f12 0%, transparent 60%),
            linear-gradient(180deg, #0d0b0a 0%, var(--soot) 100%);
        }

        .pb-page *, .pb-page *::before, .pb-page *::after { box-sizing: border-box; }

        /* ---------- Ambient light behind the glass ---------- */
        .pb-backdrop {
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .pb-orb {
          position: absolute;
          border-radius: 50%;
          opacity: .75;
        }

        .pb-orb--1 {
          width: 46vmax; height: 46vmax;
          top: -14vmax; left: -10vmax;
          background: radial-gradient(circle, rgba(201,162,75,0.55) 0%, rgba(201,162,75,0) 70%);
        }

        .pb-orb--2 {
          width: 38vmax; height: 38vmax;
          bottom: -12vmax; right: -8vmax;
          background: radial-gradient(circle, rgba(150,62,38,0.5) 0%, rgba(150,62,38,0) 70%);
        }

        .pb-orb--3 {
          width: 26vmax; height: 26vmax;
          top: 40%; left: 55%;
          background: radial-gradient(circle, rgba(74,96,112,0.45) 0%, rgba(74,96,112,0) 70%);
        }

        .pb-grain {
          position: absolute;
          inset: 0;
          background-image:
            repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 32px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 32px);
          mask-image: radial-gradient(ellipse at center, #000 30%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse at center, #000 30%, transparent 80%);
        }

        .pb-shell {
          position: relative;
          z-index: 1;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 16px;
        }

        /* ---------- Liquid-glass card ---------- */
        .pb-card {
          position: relative;
          isolation: isolate;
          width: min(100%, 840px);
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          border-radius: 28px;
          background:
            radial-gradient(120% 60% at 0% 0%, rgba(255,255,255,0.14) 0%, transparent 45%),
            var(--glass-fill);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          box-shadow:
            var(--glass-hi),
            0 40px 80px -24px rgba(0,0,0,0.75),
            0 0 0 1px rgba(0,0,0,0.25);
          overflow: hidden;
          animation: pb-enter .5s cubic-bezier(.2,.8,.2,1) both;
        }

        /* Refractive gradient rim */
        .pb-card::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 2;
          padding: 1px;
          border-radius: inherit;
          background: linear-gradient(140deg,
            rgba(255,255,255,0.55) 0%,
            rgba(255,255,255,0.08) 30%,
            rgba(201,162,75,0.35) 65%,
            rgba(255,255,255,0.22) 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        @keyframes pb-enter {
          from { opacity: 0; transform: translateY(12px) scale(.985); }
          to   { opacity: 1; transform: none; }
        }

        /* ---------- Brand side ---------- */
        .pb-brand {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 16px;
          padding: 28px 30px;
          overflow: hidden;
          background:
            linear-gradient(150deg, rgba(201,162,75,0.16) 0%, rgba(201,162,75,0) 55%),
            rgba(255,255,255,0.025);
        }

        /* Hairline divider that fades at the ends */
        .pb-brand::after {
          content: '';
          position: absolute;
          top: 10%;
          bottom: 10%;
          right: 0;
          width: 1px;
          background: linear-gradient(180deg, transparent, rgba(255,255,255,0.22), transparent);
        }

        .pb-watermark {
          position: absolute;
          right: -50px;
          bottom: -40px;
          width: 260px;
          height: 260px;
          color: var(--brass-hi);
          opacity: .06;
          pointer-events: none;
        }

        .pb-brand > *:not(.pb-watermark) { position: relative; }

        .pb-emblem-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 46px;
          height: 46px;
          border-radius: 14px;
          color: var(--brass-hi);
          background:
            radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,0.35) 0%, transparent 60%),
            linear-gradient(160deg, rgba(201,162,75,0.32), rgba(201,162,75,0.08));
          border: 1px solid rgba(255,255,255,0.22);
          box-shadow: var(--glass-hi), 0 8px 24px -8px rgba(201,162,75,0.5);
          backdrop-filter: var(--glass-blur-sm);
          -webkit-backdrop-filter: var(--glass-blur-sm);
        }

        .pb-emblem-wrap svg { width: 24px; height: 24px; }

        .pb-wordmark {
          margin: 14px 0 0;
          font-family: 'Cinzel', Georgia, serif;
          font-size: clamp(28px, 3.5vw, 36px);
          font-weight: 800;
          line-height: 1.04;
          letter-spacing: 0.02em;
          text-shadow: 0 2px 18px rgba(0,0,0,0.45);
        }

        .pb-wordmark span {
          display: block;
          font-weight: 600;
          font-style: italic;
          background: linear-gradient(180deg, #fff3cf 0%, var(--brass-hi) 45%, var(--brass) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .pb-tagline {
          margin: 10px 0 0;
          max-width: 32ch;
          color: var(--ash);
          font-size: 12.5px;
          line-height: 1.5;
        }

        .pb-features {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 14px 0 0;
          padding: 0;
          list-style: none;
        }

        .pb-features li {
          padding: 4px 11px;
          border-radius: 999px;
          color: var(--bone);
          font-size: 11px;
          font-weight: 500;
          background: var(--glass-fill-strong);
          border: 1px solid var(--glass-line);
          box-shadow: var(--glass-hi);
          backdrop-filter: var(--glass-blur-sm);
          -webkit-backdrop-filter: var(--glass-blur-sm);
        }

        .pb-brand-foot {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 12px;
          color: var(--ash);
          font-size: 11.5px;
          line-height: 1.35;
          background: rgba(0,0,0,0.18);
          border: 1px solid var(--glass-line-soft);
        }

        .pb-badge {
          flex: none;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--brass-hi);
          box-shadow: 0 0 8px var(--brass), 0 0 2px #fff;
        }

        /* ---------- Form side ---------- */
        .pb-main {
          display: flex;
          flex-direction: column;
          padding: 24px 26px 24px;
        }

        /* Segmented glass control */
        .pb-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          padding: 4px;
          margin-bottom: 16px;
          border-radius: 999px;
          background: rgba(0,0,0,0.25);
          border: 1px solid var(--glass-line-soft);
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.35);
        }

        .pb-tab {
          position: relative;
          padding: 7px 10px;
          border: 1px solid transparent;
          border-radius: 999px;
          background: none;
          color: var(--ash);
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: color .2s ease, background .25s ease, border-color .25s ease, box-shadow .25s ease;
        }

        .pb-tab:hover { color: var(--bone); }

        .pb-tab[aria-selected="true"] {
          color: var(--bone);
          background:
            radial-gradient(90% 70% at 50% 0%, rgba(255,255,255,0.28) 0%, transparent 70%),
            linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06));
          border-color: rgba(255,255,255,0.2);
          box-shadow: var(--glass-hi), 0 4px 14px -4px rgba(0,0,0,0.5);
        }

        .pb-tab:focus-visible,
        .pb-link:focus-visible,
        .pb-reveal:focus-visible,
        .pb-footer a:focus-visible {
          outline: 2px solid var(--brass-hi);
          outline-offset: 2px;
        }

        .pb-panels {
          flex: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
        }

        .pb-panel {
          grid-area: 1 / 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
          visibility: hidden;
          pointer-events: none;
          overflow: hidden;
        }

        .pb-panel.is-active {
          visibility: visible;
          pointer-events: auto;
          animation: pb-fade .25s ease-out both;
        }

        @keyframes pb-fade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: none; }
        }

        .pb-title {
          margin: 0;
          font-family: 'Cinzel', Georgia, serif;
          font-size: 21px;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .pb-status { margin: 4px 0 10px; }

        .pb-lede {
          margin: 0;
          color: var(--ash);
          font-size: 12px;
          line-height: 1.4;
        }

        .pb-form { display: flex; flex-direction: column; gap: 12px; }

        .pb-field { position: relative; }

        .pb-field label {
          display: block;
          margin-bottom: 4px;
          color: var(--bone);
          font-size: 12px;
          font-weight: 600;
        }

        .pb-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .pb-input-icon {
          position: absolute;
          left: 12px;
          width: 15px;
          height: 15px;
          color: var(--ash);
          pointer-events: none;
          transition: color .2s ease;
        }

        .pb-input-wrap:focus-within .pb-input-icon { color: var(--brass-hi); }

        /* Recessed glass well */
        .pb-input {
          width: 100%;
          height: 42px;
          padding: 0 12px 0 36px;
          border: 1px solid var(--glass-line-soft);
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(0,0,0,0.32), rgba(0,0,0,0.18));
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.06);
          backdrop-filter: var(--glass-blur-sm);
          -webkit-backdrop-filter: var(--glass-blur-sm);
          color: var(--bone);
          font-family: inherit;
          font-size: 13px;
          transition: border-color .2s ease, box-shadow .2s ease, background .2s ease;
        }

        .pb-input--pw { padding-right: 44px; }
        .pb-input::placeholder { color: rgba(185,174,156,0.55); }
        .pb-input:hover:not(:disabled) { border-color: rgba(255,255,255,0.18); }

        .pb-input:focus {
          outline: none;
          border-color: rgba(235,208,141,0.6);
          background: linear-gradient(180deg, rgba(0,0,0,0.28), rgba(201,162,75,0.06));
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.3), 0 0 0 3px var(--brass-glow);
        }

        .pb-input:disabled { opacity: .55; }

        .pb-input:-webkit-autofill,
        .pb-input:-webkit-autofill:focus {
          -webkit-text-fill-color: var(--bone);
          caret-color: var(--bone);
          -webkit-box-shadow: 0 0 0 40px #17130f inset;
          transition: background-color 9999s ease-out;
        }

        .pb-reveal {
          position: absolute;
          right: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: var(--ash);
          cursor: pointer;
          transition: color .2s ease, background .2s ease, border-color .2s ease;
        }

        .pb-reveal:hover:not(:disabled) {
          color: var(--brass-hi);
          background: rgba(255,255,255,0.08);
          border-color: var(--glass-line-soft);
        }

        .pb-hint {
          position: absolute;
          top: calc(100% + 2px);
          left: 2px;
          display: flex;
          align-items: center;
          gap: 4px;
          color: #f0c35c;
          font-size: 11px;
        }

        .pb-error {
          padding: 7px 10px;
          border-radius: 12px;
          color: var(--danger);
          font-size: 11.5px;
          line-height: 1.35;
          background: linear-gradient(135deg, rgba(217,83,79,0.22), rgba(217,83,79,0.08));
          border: 1px solid rgba(255,140,130,0.3);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
          backdrop-filter: var(--glass-blur-sm);
          -webkit-backdrop-filter: var(--glass-blur-sm);
        }

        /* Liquid brass button */
        .pb-submit {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 44px;
          margin-top: 4px;
          border: 1px solid rgba(255,240,200,0.55);
          border-radius: 999px;
          background:
            linear-gradient(180deg, rgba(246,224,160,0.95) 0%, rgba(201,162,75,0.92) 55%, rgba(160,122,46,0.95) 100%);
          color: #1a140b;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: .01em;
          cursor: pointer;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.7),
            inset 0 -3px 8px rgba(90,60,10,0.35),
            0 10px 24px -8px rgba(201,162,75,0.55);
          transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
        }

        /* Specular sheen */
        .pb-submit::before {
          content: '';
          position: absolute;
          top: 1px;
          left: 8%;
          right: 8%;
          height: 45%;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0));
          pointer-events: none;
        }

        .pb-submit > * { position: relative; }

        .pb-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.06);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.8),
            inset 0 -3px 8px rgba(90,60,10,0.3),
            0 14px 30px -8px rgba(201,162,75,0.7);
        }

        .pb-submit:active:not(:disabled) { transform: translateY(0) scale(.99); }

        .pb-submit:focus-visible {
          outline: 2px solid var(--bone);
          outline-offset: 3px;
        }

        .pb-submit:disabled { opacity: .7; cursor: progress; }

        .pb-spinner {
          width: 13px;
          height: 13px;
          border: 2px solid rgba(26,20,11,0.25);
          border-top-color: #1a140b;
          border-radius: 50%;
          animation: pb-spin .6s linear infinite;
        }

        @keyframes pb-spin { to { transform: rotate(360deg); } }

        .pb-note {
          margin: 0;
          color: var(--ash);
          font-size: 11.5px;
          line-height: 1.35;
          text-align: center;
        }

        .pb-link {
          padding: 4px 10px;
          border: 0;
          border-radius: 999px;
          background: none;
          color: var(--brass-hi);
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background .2s ease;
        }

        .pb-link:hover { background: rgba(255,255,255,0.08); }

        /* ---------- Info tab ---------- */
        .pb-info { margin: 0; display: flex; flex-direction: column; gap: 8px; }

        .pb-info-card {
          padding: 9px 12px;
          border-radius: 14px;
          background: var(--glass-fill);
          border: 1px solid var(--glass-line-soft);
          box-shadow: var(--glass-hi);
        }

        .pb-info dt { color: var(--brass-hi); font-size: 12px; font-weight: 600; }

        .pb-info dd {
          margin: 2px 0 0;
          color: var(--ash);
          font-size: 11.5px;
          line-height: 1.4;
        }

        /* ---------- Footer ---------- */
        .pb-footer {
          padding: 8px 18px;
          border-radius: 18px;
          text-align: center;
          color: var(--ash);
          font-size: 11.5px;
          line-height: 1.5;
          background: var(--glass-fill);
          border: 1px solid var(--glass-line-soft);
          box-shadow: var(--glass-hi);
          backdrop-filter: var(--glass-blur-sm);
          -webkit-backdrop-filter: var(--glass-blur-sm);
        }

        .pb-footer p { margin: 0; }
        .pb-footer strong { color: var(--bone); font-weight: 600; }

        .pb-footer a {
          color: var(--brass-hi);
          text-decoration: none;
          border-bottom: 1px dashed var(--brass);
        }

        .pb-footer a:hover { border-bottom-style: solid; }

        /* ---------- No backdrop-filter support: solid fallback ---------- */
        @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
          .pb-card { background: rgba(24,20,17,0.94); }
          .pb-footer, .pb-features li, .pb-info-card { background: rgba(34,29,25,0.92); }
        }

        /* ---------- Mobile ---------- */
        @media (max-width: 768px) {
          .pb-shell { justify-content: flex-start; padding-top: 14px; }

          .pb-card { grid-template-columns: 1fr; border-radius: 24px; }

          .pb-brand {
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            gap: 12px;
            padding: 14px 16px;
          }

          .pb-brand::after {
            top: auto;
            bottom: 0;
            left: 8%;
            right: 8%;
            width: auto;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
          }

          .pb-emblem-wrap { width: 38px; height: 38px; border-radius: 12px; }
          .pb-emblem-wrap svg { width: 19px; height: 19px; }
          .pb-wordmark { margin: 0; font-size: 22px; }
          .pb-wordmark span { display: inline; margin-left: 4px; }
          .pb-tagline, .pb-features, .pb-brand-foot, .pb-watermark { display: none; }

          .pb-main { padding: 16px 16px 20px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .pb-card, .pb-panel { animation: none; }
          .pb-spinner { animation-duration: 1.6s; }
          .pb-input, .pb-submit, .pb-tab, .pb-reveal, .pb-input-icon, .pb-link { transition: none; }
        }
      `}</style>

      <div className="pb-backdrop" aria-hidden="true">
        <div className="pb-orb pb-orb--1" />
        <div className="pb-orb pb-orb--2" />
        <div className="pb-orb pb-orb--3" />
        <div className="pb-grain" />
      </div>

      <div className="pb-shell">
        <main className="pb-card">
          {/* Brand side */}
          <section className="pb-brand">
            <CrestIcon className="pb-watermark" strokeWidth="1" />

            <div>
              <div className="pb-emblem-wrap">
                <CrestIcon />
              </div>
              <h1 className="pb-wordmark">
                Peaky<span>Blinder</span>
              </h1>
              <p className="pb-tagline">
                The clan's private portal. Everything your crew needs, in one place.
              </p>
              <ul className="pb-features" aria-label="Portal features">
                {FEATURES.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>

            <div className="pb-brand-foot">
              <span className="pb-badge" aria-hidden="true" />
              Private portal. Accounts issued by administration.
            </div>
          </section>

          {/* Form side */}
          <section className="pb-main">
            <div className="pb-tabs" role="tablist" aria-label="Portal sections" onKeyDown={handleTabKey}>
              <button
                type="button"
                role="tab"
                id="pb-tab-login"
                aria-selected={tab === 'login'}
                aria-controls="pb-panel-login"
                tabIndex={tab === 'login' ? 0 : -1}
                className="pb-tab"
                onClick={() => setTab('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                id="pb-tab-info"
                aria-selected={tab === 'info'}
                aria-controls="pb-panel-info"
                tabIndex={tab === 'info' ? 0 : -1}
                className="pb-tab"
                onClick={() => setTab('info')}
              >
                About the portal
              </button>
            </div>

            <div className="pb-panels">
              {/* Sign in */}
              <div
                className={`pb-panel${tab === 'login' ? ' is-active' : ''}`}
                role="tabpanel"
                id="pb-panel-login"
                aria-labelledby="pb-tab-login"
                aria-hidden={tab !== 'login'}
              >
                <div>
                  <h2 className="pb-title">Welcome back</h2>
                  <div className="pb-status">
                    {error ? (
                      <div className="pb-error" role="alert">
                        {error}
                      </div>
                    ) : (
                      <p className="pb-lede">Sign in with your clan account to open the portal.</p>
                    )}
                  </div>

                  <form className="pb-form" onSubmit={handleSubmit} noValidate>
                    <div className="pb-field">
                      <label htmlFor="login-username">Username</label>
                      <div className="pb-input-wrap">
                        <svg className="pb-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <input
                          id="login-username"
                          name="username"
                          className="pb-input"
                          type="text"
                          placeholder="Your clan username"
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value)
                            clearError()
                          }}
                          disabled={submitting}
                          autoFocus
                          autoComplete="username"
                          autoCapitalize="none"
                          spellCheck={false}
                          required
                        />
                      </div>
                    </div>

                    <div className="pb-field">
                      <label htmlFor="login-password">Password</label>
                      <div className="pb-input-wrap">
                        <svg className="pb-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <input
                          id="login-password"
                          name="password"
                          className="pb-input pb-input--pw"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Your password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value)
                            clearError()
                          }}
                          onKeyDown={checkCaps}
                          onKeyUp={checkCaps}
                          onBlur={() => setCapsOn(false)}
                          disabled={submitting}
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          className="pb-reveal"
                          onClick={() => setShowPassword((v) => !v)}
                          disabled={submitting}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {capsOn && (
                        <div className="pb-hint" role="status">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          Caps Lock is on.
                        </div>
                      )}
                    </div>

                    <button className="pb-submit" type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <span className="pb-spinner" aria-hidden="true" />
                          <span>Signing in…</span>
                        </>
                      ) : (
                        <span>Sign in</span>
                      )}
                    </button>
                  </form>
                </div>

                <p className="pb-note">No account yet? Ask your Master to create one for you.</p>
              </div>

              {/* Info */}
              <div
                className={`pb-panel${tab === 'info' ? ' is-active' : ''}`}
                role="tabpanel"
                id="pb-panel-info"
                aria-labelledby="pb-tab-info"
                aria-hidden={tab !== 'info'}
              >
                <div>
                  <h2 className="pb-title">About the portal</h2>
                  <div className="pb-status">
                    <p className="pb-lede">What you can do here and who to ask for help.</p>
                  </div>

                  <dl className="pb-info">
                    <div className="pb-info-card">
                      <dt>Getting an account</dt>
                      <dd>
                        Accounts are created by the clan administration. Contact your Master if you need access.
                      </dd>
                    </div>
                    <div className="pb-info-card">
                      <dt>What's inside</dt>
                      <dd>
                        Attendance, members, auctions, the leaderboard and other clan tools.
                      </dd>
                    </div>
                    <div className="pb-info-card">
                      <dt>Getting help</dt>
                      <dd>
                        Use the contact link below the card if you have trouble with your account or permissions.
                      </dd>
                    </div>
                  </dl>
                </div>

                <p className="pb-note">
                  <button type="button" className="pb-link" onClick={() => setTab('login')}>
                    Back to sign in
                  </button>
                </p>
              </div>
            </div>
          </section>
        </main>

        <footer className="pb-footer">
          <p>
            Built by <strong>{CREATOR_NAME}</strong>
          </p>
          <p>
            Support is always appreciated, never expected.{' '}
            {CONTACT_URL ? (
              <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">
                {CONTACT_LABEL}
              </a>
            ) : (
              <strong>{CONTACT_LABEL}</strong>
            )}
            .
          </p>
        </footer>
      </div>
    </div>
  )
}