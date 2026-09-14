import React, { useEffect, useMemo, useState } from 'react'
import ResetPasswordModal from './ResetPasswordModal'

const POWER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const PROFILE_REGION = 'STEAM'
const PROFILE_SERVER = '005'

const GRADE_META = {
  Epic: {
    label: 'Epic',
    color: '#ef4444',
    border: 'border-red-500/45',
    text: 'text-red-300',
    bg: 'bg-red-500/10',
    glow: 'rgba(239,68,68,.28)',
    image: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/grade/list_thumbnail_epic.webp',
  },
  Legendary: {
    label: 'Legendary',
    color: '#f5c542',
    border: 'border-gold/55',
    text: 'text-gold-bright',
    bg: 'bg-gold/10',
    glow: 'rgba(245,197,66,.30)',
    image: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/grade/list_thumbnail_legendary.webp',
  },
  Mythic: {
    label: 'Mythical',
    color: '#c026d3',
    border: 'border-fuchsia-500/55',
    text: 'text-fuchsia-300',
    bg: 'bg-fuchsia-500/10',
    glow: 'rgba(192,38,211,.34)',
    image: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/grade/list_thumbnail_mythic.webp',
  },
}

const CLASS_META = {
  Berserker: { icon: '⚔', label: 'Berserker', tone: 'from-red-500/30 via-transparent to-black' },
  Warlord: { icon: '🛡', label: 'Warlord', tone: 'from-orange-400/25 via-transparent to-black' },
  Archer: { icon: '🏹', label: 'Archer', tone: 'from-emerald-400/25 via-transparent to-black' },
  Skald: { icon: '♫', label: 'Skald', tone: 'from-cyan-400/25 via-transparent to-black' },
  Volva: { icon: '✦', label: 'Volva', tone: 'from-purple-400/25 via-transparent to-black' },
  'Rune Fighter': { icon: 'ᚱ', label: 'Rune Fighter', tone: 'from-blue-400/25 via-transparent to-black' },
}

const CLASS_ASSETS = {
  Archer: {
    thumbnail: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/thumbnail/archer.webp',
    nameplate: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/classname/en/archer.webp',
  },
  'Rune Fighter': {
    thumbnail: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/thumbnail/runeFighter.webp',
    nameplate: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/classname/en/runeFighter.webp',
  },
  Skald: {
    thumbnail: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/thumbnail/skald.webp',
    nameplate: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/classname/en/skald.webp',
  },
  Berserker: {
    thumbnail: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/thumbnail/berserker.webp',
    nameplate: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/classname/en/berserker.webp',
  },
  Warlord: {
    thumbnail: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/thumbnail/warlord.webp',
    nameplate: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/classname/en/warlord.webp',
  },
  Volva: {
    thumbnail: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/thumbnail/volva.webp',
    nameplate: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/character/classname/en/volva.webp',
  },
}

const CHARACTER_FRAME =
  'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/grade/list_item_frame.webp'
const GRADE_BACKGROUNDS = {
  Epic: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/grade/list_thumbnail_epic.webp',
  Legendary: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/grade/list_thumbnail_legendary.webp',
  Mythic: 'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/grade/list_thumbnail_mythic.webp',
}

const AWAKENING_BADGE =
  'https://gcdn.wemade.games/lygl/official/0.0.19/_next/static/images/nft/badge_awakening.webp'

const AWAKENING_OPTIONS = [
  { value: 0, label: 'Not Awakened' },
  { value: 1, label: 'Stage 1' },
]

const ROLE_META = {
  Admin: 'border-red-400/40 bg-red-400/10 text-red-300',
  Master: 'border-gold/45 bg-gold/10 text-gold-bright',
  Elder: 'border-orange-300/35 bg-orange-300/10 text-orange-300',
  Member: 'border-sky-300/25 bg-sky-300/5 text-sky-300',
}

const formatNumber = (value) => Number(value || 0).toLocaleString()

// Power is displayed with Indonesian-style thousands separators:
// 100000 -> 100.000, 1250000 -> 1.250.000.
// Keep the stored/database value numeric; the dots are display-only.
const formatPowerInput = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
const formatDate = (value) => {
  if (!value) return 'Not updated yet'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Not updated yet'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
const formatDateTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function getNextPowerUpdate(member) {
  if (!member?.power_next_update_at) return null
  const d = new Date(member.power_next_update_at)
  return Number.isNaN(d.getTime()) ? null : d
}

function getCooldown(member) {
  const next = getNextPowerUpdate(member)
  if (next) return Math.max(0, next.getTime() - Date.now())
  return 0
}

function getPowerUpdatesUsed(member) {
  const used = Number(member?.power_updates_used)
  if (Number.isFinite(used) && used >= 0) return Math.min(3, used)
  // Compatibility with the previous one-update lock system.
  return getCooldown(member) > 0 ? 3 : 0
}

function getPowerWindowRemaining(member) {
  return Math.max(0, 3 - getPowerUpdatesUsed(member))
}

function cooldownText(ms) {
  if (ms <= 0) return 'Available now'
  const totalMinutes = Math.ceil(ms / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'PB'
}

function safeImage(member) {
  return member?.character_image || member?.characterImage || member?.avatar_url || member?.avatarUrl || member?.image || ''
}

function PowerBadge({ member, rank }) {
  const cooldown = getCooldown(member)
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-text-dim">
          <span className="text-gold-bright">⚡</span> Growth Power
        </div>
        <div className="font-mono text-2xl font-black tracking-tight text-white sm:text-[27px]">
          {formatNumber(member.power)}
        </div>
      </div>
      {rank && (
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.16em] text-text-dim">Rank</div>
          <div className="font-spectral text-lg font-bold text-gold-bright">#{rank}</div>
        </div>
      )}
      {!rank && cooldown > 0 && (
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.16em] text-text-dim">Next update</div>
          <div className="font-mono text-xs font-bold text-gold-light">{cooldownText(cooldown)}</div>
        </div>
      )}
    </div>
  )
}

const CharacterArtwork = React.memo(function CharacterArtwork({ member, variant = 'card' }) {
  const gradeKey = member?.profile_grade === 'Mythical' ? 'Mythic' : (member?.profile_grade || 'Legendary')
  const grade = GRADE_META[gradeKey] || GRADE_META.Legendary
  const assets = CLASS_ASSETS[member?.cls] || CLASS_ASSETS.Berserker
  const awakening = Number(member?.awakening_stage) || 0
  const isModal = variant === 'modal'

  return (
    <div
      className={`relative overflow-hidden bg-[#090807] ${
        isModal
          ? 'mx-auto aspect-[0.73] w-full max-w-[470px] rounded-xl'
          : 'aspect-[0.73] w-full'
      }`}
      style={{
        boxShadow: `inset 0 -110px 110px ${grade.glow}, 0 0 42px ${grade.glow}`,
      }}
    >
      <div className="absolute inset-0 bg-[#090807]" />

      {/* Official YMIR grade background — use the real NFT background instead of a blurred character. */}
      <img
        src={GRADE_BACKGROUNDS[member?.profile_grade === 'Mythical' ? 'Mythic' : (member?.profile_grade || 'Legendary')] || GRADE_BACKGROUNDS.Legendary}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-[5px] h-[calc(100%-10px)] w-[calc(100%-10px)] object-cover object-center"
        decoding="async"
      />

      {/* Subtle darkening keeps the character readable without changing the official background. */}
      <div className="pointer-events-none absolute inset-[5px] bg-black/10" />

      <img
        src={assets.thumbnail}
        alt={member?.cls || 'Character'}
        className="absolute inset-[5px] z-10 h-[calc(100%-10px)] w-[calc(100%-10px)] object-cover object-top"
        loading="lazy"
        decoding="async"
      />

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent via-[58%] to-[#090807]/92" />

      <img
        src={CHARACTER_FRAME}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        loading="lazy"
        decoding="async"
      />

      {/* Official YMIR awakening badge: image only, with the stage number centered in the gem. */}
      {awakening > 0 && (
        <div className="absolute right-[4.8%] top-[3.4%] z-20 h-14 w-14">
          <img
            src={AWAKENING_BADGE}
            alt=""
            className="absolute inset-0 h-14 w-14 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,.85)]"
          />
          <span className="absolute inset-0 flex items-center justify-center pb-[1px] font-serif text-[19px] font-black leading-none text-white drop-shadow-[0_2px_2px_rgba(0,0,0,.95)]">
            {awakening}
          </span>
        </div>
      )}

      {/* Official YMIR class-name artwork.
          Fixed height keeps Archer / Berserker / Warlord / Skald / Volva / Rune Fighter visually consistent.
          Width is automatic so each official PNG keeps its own aspect ratio. */}
      <div className="absolute inset-x-[10%] bottom-[15.2%] z-20 flex h-[6.2%] items-center justify-center">
        <img
          src={assets.nameplate}
          alt={member?.cls || ''}
          className="block h-full w-auto max-w-[68%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,.95)]"
          loading="lazy"
          decoding="async"
        />
      </div>

    </div>
  )
})

const PlayerCard = React.memo(function PlayerCard({ member, rank, isSelf, onView, onStaffEdit }) {
  const meta = CLASS_META[member?.cls] || CLASS_META.Berserker
  const roleClass = ROLE_META[member?.role] || ROLE_META.Member
  const awakening = Number(member?.awakening_stage) || 0

  return (
    <article
      className={`group relative overflow-hidden rounded-xl border bg-[#0b0c0f] shadow-[0_18px_50px_rgba(0,0,0,.28)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-gold/35 hover:shadow-[0_24px_65px_rgba(0,0,0,.46)] ${
        isSelf ? 'border-gold/45 ring-1 ring-gold/10' : 'border-white/[0.07]'
      }`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '520px' }}
    >
      <CharacterArtwork member={member} />

      <div className="relative mt-3 px-3.5 pb-3.5">
        <div className="rounded-lg border border-white/[0.07] bg-[#0b0c0f]/97 p-3.5 shadow-[0_12px_30px_rgba(0,0,0,.28)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-spectral text-xl font-black leading-tight text-white">
                {member.name}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-light">
                  {meta.label}
                </span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-dim">
                  Lv. {Number(member?.character_level || member?.level || 1) || 1}
                </span>
              </div>
            </div>
            <span className={`shrink-0 rounded-md border px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] ${roleClass}`}>
              {member.role}
            </span>
          </div>

          <div className="mt-3 flex items-end justify-between border-y border-white/[0.06] py-2.5">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-text-dim">Growth Power</div>
              <div className="mt-0.5 font-mono text-xl font-black tracking-tight text-white">
                {formatNumber(member.power)}
              </div>
            </div>
            {rank && (
              <div className="text-right">
                <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-text-dim">Clan Rank</div>
                <div className="font-spectral text-lg font-black text-gold-bright">#{rank}</div>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Level" value={member.character_level || member.level || 1} />
            <Stat label="Server" value={PROFILE_SERVER} />
            <Stat label="Att" value={formatNumber(member.attendance)} />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onView(member)}
              className="flex-1 rounded-md border border-gold/35 bg-gold/5 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.13em] text-gold-light transition hover:bg-gold/10 hover:text-gold-bright"
            >
              View Profile
            </button>
            {isSelf && (
              <button
                onClick={() => onView(member, true)}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.13em] text-text-dim transition hover:border-gold/25 hover:text-gold-light"
              >
                Power
              </button>
            )}
            {onStaffEdit && (
              <button
                onClick={() => onStaffEdit(member)}
                title="Staff controls"
                className="rounded-md border border-white/10 px-3 py-2.5 text-text-dim transition hover:border-gold/25 hover:text-gold-light"
              >
                ⚙
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
})

function Stat({ label, value }) {
  return (
    <div className="min-w-0 rounded border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
      <div className="mb-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-text-dim">{label}</div>
      <div className="truncate font-mono text-[10px] font-semibold text-white/80">{value}</div>
    </div>
  )
}

function ProfileModal({ member, members, isSelf, onClose, onPowerUpdate, onPowerCooldownReset, onProfileUpdate, onStaffEdit, canResetPowerCooldown }) {
  const [powerValue, setPowerValue] = useState(formatPowerInput(member.power ?? 0))
  const [selectedClass, setSelectedClass] = useState(member.cls || 'Berserker')
  const [selectedGrade, setSelectedGrade] = useState(member.profile_grade === 'Mythical' ? 'Mythic' : (member.profile_grade || 'Legendary'))
  const [selectedLevel, setSelectedLevel] = useState(String(member.character_level || member.level || 1))
  const [selectedAwakening, setSelectedAwakening] = useState(String(Number(member.awakening_stage) || 0))
  const [saving, setSaving] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [, setClock] = useState(0)

  const cooldown = getCooldown(member)

  useEffect(() => {
    if (!member?.power_next_update_at) return undefined
    const id = setInterval(() => setClock(value => value + 1), 1000)
    return () => clearInterval(id)
  }, [member?.power_next_update_at])
  const rank = members.findIndex(m => m.id === member.id) + 1
  const previous = useMemo(() => {
    const index = members.findIndex(m => m.id === member.id)
    return index >= 0 ? members[index + 1] : null
  }, [members, member.id])

  useEffect(() => {
    setPowerValue(formatPowerInput(member.power ?? 0))
    setSelectedClass(member.cls || 'Berserker')
    setSelectedGrade(member.profile_grade === 'Mythical' ? 'Mythic' : (member.profile_grade || 'Legendary'))
    setSelectedLevel(String(member.character_level || member.level || 1))
    setSelectedAwakening(String(Number(member.awakening_stage) || 0))
  }, [member.id, member.power, member.cls, member.profile_grade, member.character_level, member.awakening_stage])

  const submit = async () => {
    const value = Number(powerValue.replace(/\D/g, ''))
    if (!Number.isFinite(value) || value < 0) return
    if (value === Number(member.power || 0)) return
    if (cooldown > 0) return

    setSaving(true)
    const ok = await onPowerUpdate(member, value)
    setSaving(false)
    if (ok) onClose()
  }

  const currentLevel = Number(member.character_level || member.level || 1)
  const currentAwakening = Number(member.awakening_stage) || 0
  const hasProfileChanges =
    selectedClass !== (member.cls || 'Berserker') ||
    Number(selectedLevel || 1) !== currentLevel ||
    Number(selectedAwakening || 0) !== currentAwakening

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-5"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-gold/20 bg-[#08090b] shadow-[0_35px_120px_rgba(0,0,0,.78)]">
        <div className="grid max-h-[94vh] overflow-y-auto lg:grid-cols-[minmax(390px,43%)_1fr]">
          {/* YMIR-style character side */}
          <div className="relative min-h-[620px] overflow-y-auto border-b border-white/[0.07] bg-[#08090b] lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(245,197,66,.08),transparent_42%)]" />

            <div className="relative px-5 pt-5 sm:px-7 sm:pt-7">
              <CharacterArtwork member={member} variant="modal" />
            </div>

            <div className="relative mt-4 mx-7 border-t border-white/[0.07] px-1 pt-4 pb-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[8px] font-black uppercase tracking-[0.24em] text-gold-light">
                    PeakyBlinder Character
                  </div>
                  <h2 className="mt-1 truncate font-spectral text-2xl font-black tracking-tight text-white">
                    {member.name}
                  </h2>
                  <p className="mt-1 text-[11px] text-text-dim">
                    {member.cls} · Level {currentLevel} · {currentAwakening > 0 ? `Awakening Stage ${currentAwakening}` : 'Not Awakened'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-text-dim">Clan Rank</div>
                  <div className="font-spectral text-xl font-black text-gold-bright">#{rank}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Profile information side */}
          <div className="min-w-0 p-5 sm:p-7 lg:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.26em] text-gold-light">
                  Character Profile
                </div>
                <h3 className="font-spectral text-3xl font-black tracking-tight text-white">
                  Growth Power
                </h3>
                <p className="mt-1 text-xs text-text-dim">
                  {member.cls} · {(member.profile_grade === 'Mythic' || member.profile_grade === 'Mythical') ? 'Mythical' : (member.profile_grade || 'Legendary')} · Server {PROFILE_SERVER}
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-text-dim transition hover:border-gold/30 hover:text-gold-light"
                aria-label="Close profile"
              >
                ×
              </button>
            </div>

            <div className="rounded-2xl border border-gold/20 bg-[radial-gradient(circle_at_100%_0%,rgba(245,197,66,.10),transparent_45%),#0d0e10] p-5 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.22em] text-text-dim">Current Power</div>
                  <div className="mt-1 font-mono text-4xl font-black tracking-tight text-gold-bright sm:text-5xl">
                    {formatNumber(member.power)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-text-dim">Clan Rank</div>
                  <div className="mt-1 font-spectral text-2xl font-black text-white">#{rank}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
              <Info label="Class" value={member.cls || '—'} />
              <Info label="Level" value={currentLevel} />
              <Info label="Awakening" value={currentAwakening > 0 ? `Stage ${currentAwakening}` : 'Not Awakened'} />
              <Info label="Region" value={PROFILE_REGION} />
              <Info label="Server" value={PROFILE_SERVER} />
              <Info label="Card Grade" value={(member.profile_grade === 'Mythic' || member.profile_grade === 'Mythical') ? 'Mythical' : (member.profile_grade || 'Legendary')} />
              <Info label="Last Update" value={formatDateTime(member.power_updated_at)} />
            </div>

            {isSelf && (
              <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#0c0d10] overflow-hidden">
                <div className="border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gold-light">
                    Customize My Character
                  </div>
                  <div className="mt-1 text-[10px] leading-relaxed text-text-dim">
                    Class, level and awakening are self-service profile settings. Card Grade is staff-managed and does not consume Power updates.
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-text-dim">Class</span>
                      <select className="input w-full" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={profileSaving}>
                        {Object.keys(CLASS_META).map(c => <option key={c}>{c}</option>)}
                      </select>
                    </label>

                    <div>
                      <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-text-dim">Card Grade</span>
                      <div className="flex h-[42px] items-center justify-between rounded-md border border-gold/20 bg-gold/[0.04] px-3">
                        <span className="text-sm font-semibold text-gold-light">
                          {(member.profile_grade === 'Mythic' || member.profile_grade === 'Mythical') ? 'Mythical' : (member.profile_grade || 'Legendary')}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-[0.12em] text-text-dim">Staff Only</span>
                      </div>
                    </div>

                    <label>
                      <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-text-dim">Character Level</span>
                      <input
                        className="input w-full font-mono"
                        type="number"
                        min="1"
                        value={selectedLevel}
                        onChange={e => setSelectedLevel(e.target.value.replace(/\D/g, ''))}
                        disabled={profileSaving}
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-text-dim">Awakening</span>
                      <select className="input w-full" value={selectedAwakening} onChange={e => setSelectedAwakening(e.target.value)} disabled={profileSaving}>
                        {AWAKENING_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[9px] leading-relaxed text-text-dim">
                      <span className="text-gold-bright">◆</span>
                      <span>Card Grade is managed by <strong className="font-bold text-white/75">Elder and Master only</strong>. Ask a staff member if you want to change your grade.</span>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!hasProfileChanges) return
                      const nextLevel = Math.max(1, Number.parseInt(selectedLevel, 10) || 1)
                      const nextAwakening = Math.min(1, Math.max(0, Number.parseInt(selectedAwakening, 10) || 0))
                      setProfileSaving(true)
                      const ok = await onProfileUpdate(member, {
                        cls: selectedClass,
                        character_level: nextLevel,
                        awakening_stage: nextAwakening,
                      })
                      setProfileSaving(false)
                      if (ok) onClose()
                    }}
                    disabled={profileSaving || !hasProfileChanges}
                    className="btn-gold mt-3 w-full disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {profileSaving ? 'Saving...' : 'Save Character Style'}
                  </button>
                </div>
              </div>
            )}

            {canResetPowerCooldown && !isSelf && (
              <div className="mt-5 rounded-2xl border border-gold/15 bg-gold/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gold-light">Staff Power Control</div>
                    <div className="mt-1 text-[10px] leading-relaxed text-text-dim">
                      Reset this player's 7-day Power window and give them 3 fresh updates immediately.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onPowerCooldownReset}
                    className="shrink-0 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-gold-light hover:bg-gold/15"
                  >
                    ↻ Reset Power
                  </button>
                </div>
              </div>
            )}

            {isSelf && (
              <section className="mt-5 overflow-hidden rounded-xl border border-gold/15 bg-[#0b0c0f]">
                <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gold-light">Update My Power</div>
                    <div className="mt-1 text-[10px] text-text-dim">Up to 3 updates in each 7-day window.</div>
                  </div>

                  <div className={`shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] ${
                    cooldown > 0
                      ? 'border-white/10 bg-white/[0.02] text-text-dim'
                      : 'border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-300'
                  }`}>
                    {cooldown > 0 ? `LOCKED · ${cooldownText(cooldown)}` : `${getPowerWindowRemaining(member)} / 3 LEFT`}
                  </div>
                </div>

                <div className="px-4 py-4 sm:px-5">
                  <div className="mb-4 flex items-center gap-2">
                    {[0, 1, 2].map(index => {
                      const active = cooldown <= 0 && index < getPowerWindowRemaining(member)
                      return (
                        <div
                          key={index}
                          className={`h-1 flex-1 rounded-full ${active ? 'bg-gold/80' : 'bg-white/[0.08]'}`}
                        />
                      )
                    })}
                  </div>

                  {cooldown <= 0 ? (
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="text-[8px] font-bold uppercase tracking-[0.16em] text-text-dim" htmlFor="profile-power-input">
                            New Growth Power
                          </label>
                          <span className="font-mono text-[10px] font-bold text-white/60">
                            Current {formatPowerInput(member.power)}
                          </span>
                        </div>
                        <input
                          id="profile-power-input"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9.]*"
                          value={powerValue}
                          onChange={e => setPowerValue(formatPowerInput(e.target.value))}
                          disabled={saving}
                          className="input h-12 w-full border-white/10 bg-black/25 px-4 font-mono text-lg font-bold tracking-wide text-white placeholder:text-white/20 focus:border-gold/60"
                          placeholder="100.000"
                          aria-label="New Growth Power"
                          autoComplete="off"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={submit}
                        disabled={saving || !powerValue || Number(powerValue.replace(/\D/g, '')) === Number(member.power || 0)}
                        className="btn-gold h-12 self-end rounded-lg px-5 text-[10px] font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {saving ? 'Saving...' : 'Update Power'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3">
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-dim">Power updates locked</div>
                        <div className="mt-1 text-xs font-semibold text-white/75">All 3 updates have been used.</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-sm font-black text-gold-light">{cooldownText(cooldown)}</div>
                        <div className="mt-0.5 text-[8px] text-text-dim">{formatDateTime(member.power_next_update_at)}</div>
                      </div>
                    </div>
                  )}

                  {cooldown <= 0 && (
                    <div className="mt-2 text-[9px] text-text-dim">
                      Enter the exact Growth Power from in-game. <span className="font-mono text-white/60">100000</span> is displayed as <span className="font-mono font-bold text-gold-light">100.000</span>.
                    </div>
                  )}
                </div>
              </section>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Info label="Clan Role" value={member.role || 'Member'} />
              <Info label="Attendance" value={formatNumber(member.attendance)} />
              <Info label="Coins" value={formatNumber(member.coins)} />
              <Info label="Last Power Rank" value={previous ? `Around ${formatNumber(previous.power)}` : 'Top of range'} />
            </div>

            {onStaffEdit && (
              <button
                onClick={() => { onClose(); onStaffEdit(member) }}
                className="mt-5 w-full rounded-lg border border-white/10 bg-white/[0.015] px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-text-dim transition hover:border-gold/25 hover:text-gold-light"
              >
                ⚙ Staff Controls
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="text-[8px] font-bold uppercase tracking-[0.17em] text-text-dim">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-white/85">{value}</div>
    </div>
  )
}

function RankingPanel({ members, onClose }) {
  const ranking = [...members].sort((a, b) => Number(b.power || 0) - Number(a.power || 0))
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-gold/20 bg-[#0a0b0d] shadow-[0_35px_100px_rgba(0,0,0,.7)]">
        <div className="flex items-center justify-between border-b border-white/[0.07] p-5">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-gold-light">PeakyBlinder</div>
            <h2 className="font-spectral text-2xl font-bold text-white">Clan Power Ranking</h2>
          </div>
          <button onClick={onClose} className="rounded-md border border-white/10 px-3 py-2 text-xs text-text-dim hover:text-gold-light">✕</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-3">
          {ranking.map((member, index) => {
            const meta = CLASS_META[member.cls] || CLASS_META.Berserker
            return (
              <div key={member.id} className={`mb-2 flex items-center gap-3 rounded-lg border p-3 ${index < 3 ? 'border-gold/15 bg-gold/[0.04]' : 'border-white/[0.05] bg-white/[0.015]'}`}>
                <div className={`w-8 text-center font-spectral text-xl font-bold ${index === 0 ? 'text-gold-bright' : index === 1 ? 'text-white/75' : index === 2 ? 'text-orange-300' : 'text-text-dim'}`}>#{index + 1}</div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-black/40 text-lg">{meta.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{member.name}</div>
                  <div className="text-[10px] text-text-dim">{member.cls} · Lv. {member.character_level || member.level || 1} · {Number(member.awakening_stage) > 0 ? `Awk ${member.awakening_stage}` : 'No Awakening'}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-black text-gold-bright">{formatNumber(member.power)}</div>
                  <div className="text-[8px] uppercase tracking-wider text-text-dim">Power</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StaffEditor({ member, ctx, onClose, onResetPassword }) {
  const { updateMember, deleteMember, addToast, currentUser } = ctx
  const [coinInput, setCoinInput] = useState(String(member.coins ?? 0))
  const [powerInput, setPowerInput] = useState(String(member.power ?? 0))
  const [classInput, setClassInput] = useState(member.cls || 'Berserker')
  const [gradeInput, setGradeInput] = useState(member.profile_grade === 'Mythical' ? 'Mythic' : (member.profile_grade || 'Legendary'))
  const [levelInput, setLevelInput] = useState(String(member.character_level || member.level || 1))
  const [awakeningInput, setAwakeningInput] = useState(String(Number(member.awakening_stage) || 0))
  const [saving, setSaving] = useState(false)

  const isAdmin = currentUser?.role === 'Admin'
  const isMaster = isAdmin || currentUser?.role === 'Master'
  const canRemove = member.id !== currentUser?.id && (isAdmin || (isMaster && !['Admin', 'Master'].includes(member.role)) || (currentUser?.role === 'Elder' && member.role === 'Member'))
  const canRole = member.id !== currentUser?.id && (isAdmin || (isMaster && !['Admin', 'Master'].includes(member.role)))
  const canReset = member.id !== currentUser?.id && (
    isAdmin ||
    (currentUser?.role === 'Master' && !['Admin', 'Master'].includes(member.role)) ||
    (currentUser?.role === 'Elder' && member.role === 'Member')
  )

  const save = async () => {
    const coins = Number.parseInt(coinInput, 10)
    const power = Number.parseInt(powerInput, 10)
    if (!Number.isFinite(coins) || coins < 0 || !Number.isFinite(power) || power < 0) {
      addToast('Enter valid coin and power values.', 'red', 'Error')
      return
    }
    const updates = {}
    if (coins !== Number(member.coins || 0)) updates.coins = coins
    if (classInput !== (member.cls || 'Berserker')) updates.cls = classInput
    const currentGradeKey = member.profile_grade === 'Mythical' ? 'Mythic' : (member.profile_grade || 'Legendary')
    if (gradeInput !== currentGradeKey) updates.profile_grade = gradeInput
    const level = Math.max(1, Number.parseInt(levelInput, 10) || 1)
    const awakening = Math.max(0, Number.parseInt(awakeningInput, 10) || 0)
    if (level !== Number(member.character_level || member.level || 1)) updates.character_level = level
    if (awakening !== Number(member.awakening_stage || 0)) updates.awakening_stage = awakening
    if (power !== Number(member.power || 0)) {
      updates.power = power
      updates.power_updated_at = new Date().toISOString()
      updates.power_next_update_at = new Date(Date.now() + POWER_COOLDOWN_MS).toISOString()
    }
    if (!Object.keys(updates).length) {
      onClose()
      return
    }
    setSaving(true)
    const ok = await updateMember(member.id, updates)
    setSaving(false)
    if (ok) {
      addToast(`${member.name} updated.`, 'gold', 'Member Updated')
      onClose()
    }
  }

  const changeRole = async (newRole) => {
    if (!canRole) return
    if (newRole === member.role) return
    if (newRole === 'Admin' && !window.confirm(`Promote ${member.name} to ADMIN?`)) return
    if (newRole === 'Master' && !isAdmin && !window.confirm(`Promote ${member.name} to MASTER?`)) return
    const ok = await updateMember(member.id, { role: newRole })
    if (ok) {
      addToast(`${member.name} is now ${newRole}.`, 'gold', 'Role Updated')
      onClose()
    }
  }

  const remove = async () => {
    if (!canRemove) return
    if (!window.confirm(`Remove ${member.name}?`)) return
    const ok = await deleteMember(member.id)
    if (ok) {
      addToast(`${member.name} removed.`, 'red', 'Removed')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-2xl border border-gold/20 bg-[#0a0b0d] p-5 shadow-[0_35px_100px_rgba(0,0,0,.7)] sm:p-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-gold-light">Staff Controls</div>
            <h2 className="font-spectral text-2xl font-bold text-white">{member.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-md border border-white/10 px-3 py-2 text-xs text-text-dim">✕</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-gold-light">Class</span>
            <select className="input w-full" value={classInput} onChange={e => setClassInput(e.target.value)}>
              {Object.keys(CLASS_META).map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-gold-light">Card Grade</span>
            <select className="input w-full" value={gradeInput} onChange={e => setGradeInput(e.target.value)}>
              {Object.keys(GRADE_META).map(g => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-gold-light">Level</span>
            <input className="input w-full font-mono" type="number" min="1" value={levelInput} onChange={e => setLevelInput(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label>
            <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-gold-light">Awakening</span>
            <select className="input w-full" value={awakeningInput} onChange={e => setAwakeningInput(e.target.value)}>
              {AWAKENING_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-gold-light">🪙 Coins</span>
            <input className="input w-full font-mono" type="number" min="0" value={coinInput} onChange={e => setCoinInput(e.target.value)} />
          </label>
          <label>
            <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-gold-light">⚡ Power</span>
            <input className="input w-full font-mono" type="number" min="0" value={powerInput} onChange={e => setPowerInput(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[10px] text-text-dim">
          Admin, Master, and Elder can manage this member's Class, Card Grade, Level, and Awakening. Players cannot change Card Grade themselves and must request a staff member. Staff Power corrections remain separate from the player's 7-day self-update lock.
        </div>
        {(canRole || canReset) && (
          <div className="mt-4 border-t border-white/[0.07] pt-4">
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-text-dim">Role & Access</div>
            <div className="flex flex-wrap gap-2">
              {canRole && member.role === 'Member' && (
                <button onClick={() => changeRole('Elder')} className="rounded-md border border-orange-300/30 px-3 py-2 text-[10px] font-bold text-orange-300 hover:bg-orange-300/10">↑ Promote Elder</button>
              )}
              {canRole && member.role === 'Elder' && (
                <>
                  <button onClick={() => changeRole('Member')} className="rounded-md border border-yellow-300/30 px-3 py-2 text-[10px] font-bold text-yellow-300 hover:bg-yellow-300/10">↓ Demote Member</button>
                  {isMaster && <button onClick={() => changeRole('Master')} className="rounded-md border border-gold/35 px-3 py-2 text-[10px] font-bold text-gold-bright hover:bg-gold/10">★ Promote Master</button>}
                </>
              )}
              {canRole && member.role === 'Master' && isAdmin && (
                <button onClick={() => changeRole('Elder')} className="rounded-md border border-orange-300/30 px-3 py-2 text-[10px] font-bold text-orange-300 hover:bg-orange-300/10">↓ Demote to Elder</button>
              )}
              {canRole && isAdmin && member.role !== 'Admin' && (
                <button onClick={() => changeRole('Admin')} className="rounded-md border border-red-400/30 px-3 py-2 text-[10px] font-bold text-red-300 hover:bg-red-400/10">⚠ Make Admin</button>
              )}
              {canRole && isAdmin && member.role === 'Admin' && (
                <button onClick={() => changeRole('Master')} className="rounded-md border border-yellow-400/30 px-3 py-2 text-[10px] font-bold text-yellow-300 hover:bg-yellow-400/10">↓ Demote Admin</button>
              )}
              {canReset && (
                <button onClick={() => { onClose(); onResetPassword(member) }} className="rounded-md border border-gold/30 px-3 py-2 text-[10px] font-bold text-gold-light hover:bg-gold/10">🔑 Reset Password</button>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          {canRemove ? (
            <button onClick={remove} className="rounded-md border border-red-500/35 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-300 hover:bg-red-500/10">Remove Member</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-white/10 px-4 py-2 text-xs text-text-dim hover:text-white">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-gold text-xs px-4 py-2">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Members({ ctx }) {
  const { members = [], saveMember, updateMember, deleteMember, resetMemberPowerCooldown, currentUser, addToast } = ctx
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('All')
  const [sortBy, setSortBy] = useState('power')
  const [showAdd, setShowAdd] = useState(false)
  const [showRanking, setShowRanking] = useState(false)
  const [selected, setSelected] = useState(null)
  const [staffEditing, setStaffEditing] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [loading, setLoading] = useState(false)
  const [newMember, setNewMember] = useState({
    name: '', username: '', password: '', cls: 'Berserker', power: 10000, character_level: 1, awakening_stage: 0, role: 'Member',
  })
  const isAdmin = currentUser?.role === 'Admin'
  const isMaster = currentUser?.role === 'Master' || isAdmin
  const isElder = currentUser?.role === 'Elder' || isMaster
  const visibleMembers = useMemo(() => isAdmin ? members : members.filter(m => m.role !== 'Admin'), [members, isAdmin])

  const ranked = useMemo(() => [...visibleMembers].sort((a, b) => Number(b.power || 0) - Number(a.power || 0)), [visibleMembers])
  const rankMap = useMemo(() => new Map(ranked.map((m, i) => [m.id, i + 1])), [ranked])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = visibleMembers.filter(m => {
      const matchesSearch = !q || `${m.name || ''} ${m.username || ''} ${m.cls || ''}`.toLowerCase().includes(q)
      const matchesClass = classFilter === 'All' || m.cls === classFilter
      return matchesSearch && matchesClass
    })
    return [...list].sort((a, b) => {
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''))
      if (sortBy === 'role') return String(a.role || '').localeCompare(String(b.role || ''))
      return Number(b.power || 0) - Number(a.power || 0)
    })
  }, [visibleMembers, search, classFilter, sortBy])

  const classes = useMemo(() => ['All', ...new Set(visibleMembers.map(m => m.cls).filter(Boolean))], [visibleMembers])

  const ownMember = members.find(m => m.id === currentUser?.id) || visibleMembers.find(m => m.username && m.username === currentUser?.username)
  // Admin / Master / Elder may manage another member's character profile
  // (Class, Card Grade, Level, Awakening). Existing hierarchy still controls
  // sensitive actions such as role changes, password resets, and removal.
  const staffEditAllowed = (member) => {
    if (!currentUser || member.id === currentUser.id) return false
    return ['Admin', 'Master', 'Elder'].includes(currentUser.role)
  }

  const handleProfileUpdate = async (member, updates) => {
    if (!currentUser || member.id !== currentUser.id) {
      addToast('You can only customize your own character.', 'red', 'Not Allowed')
      return false
    }
    const ok = await updateMember(member.id, updates)
    if (ok) {
      addToast('Your character profile was updated. Card Grade is staff-managed.', 'gold', 'Character Updated')
      return true
    }
    return false
  }

  const handlePowerCooldownReset = async (member) => {
    if (!currentUser || !['Admin', 'Master', 'Elder'].includes(currentUser.role)) {
      addToast('Only Admin, Master, and Elder can reset a Power cooldown.', 'red', 'Not Allowed')
      return false
    }

    const confirmed = window.confirm(
      `Reset the Power cooldown for ${member.name}?\n\nThis will give ${member.name} 3 fresh Power updates immediately.`
    )
    if (!confirmed) return false

    const ok = await resetMemberPowerCooldown?.(member.id)
    if (ok) {
      addToast(`${member.name} can now update Power 3 times.`, 'gold', 'Power Cooldown Reset')
      return true
    }
    return false
  }

  const handlePowerUpdate = async (member, newPower) => {
    if (!currentUser || member.id !== currentUser.id) {
      addToast('You can only update your own Power.', 'red', 'Not Allowed')
      return false
    }
    const remaining = getCooldown(member)
    if (remaining > 0) {
      addToast(`Power is locked for ${cooldownText(remaining)}.`, 'red', 'Power Locked')
      return false
    }
    const updates = { power: newPower }
    const ok = await updateMember(member.id, updates)
    if (ok) {
      const remainingUpdates = Math.max(0, 3 - (getPowerUpdatesUsed(member) + 1))
      addToast(
        remainingUpdates > 0
          ? `Power updated to ${formatNumber(newPower)}. You have ${remainingUpdates} Power update${remainingUpdates === 1 ? '' : 's'} remaining.`
          : `Power updated to ${formatNumber(newPower)}. Your Power is now locked until the next 7-day window.`,
        'gold',
        'Power Updated'
      )
      return true
    }
    return false
  }

  const addMember = async () => {
    if (!newMember.name.trim()) { addToast('Character name is required.', 'red', 'Error'); return }
    if (!newMember.username.trim()) { addToast('Username is required.', 'red', 'Error'); return }
    if (!newMember.password.trim()) { addToast('Password is required.', 'red', 'Error'); return }
    if (visibleMembers.some(m => m.username && m.username.toLowerCase() === newMember.username.toLowerCase())) {
      addToast('Username already taken.', 'red', 'Error'); return
    }

    let finalRole = 'Member'
    if (isAdmin) finalRole = newMember.role
    else if (isMaster && ['Elder', 'Master'].includes(newMember.role)) finalRole = newMember.role
    else if (isElder && newMember.role !== 'Member') {
      addToast('Only Master or Admin can add Elders or Masters.', 'red', 'Not Allowed')
      return
    }

    if (finalRole === 'Master' && !isAdmin && !window.confirm(`Create ${newMember.name.trim()} as a MASTER?`)) return
    if (finalRole === 'Admin' && !window.confirm(`Create ${newMember.name.trim()} as an ADMIN?`)) return

    setLoading(true)
    const member = {
      id: Date.now(),
      name: newMember.name.trim(),
      username: newMember.username.trim(),
      password: newMember.password.trim(),
      cls: newMember.cls,
      power: Number.parseInt(newMember.power, 10) || 10000,
      character_level: Number.parseInt(newMember.character_level, 10) || 1,
      awakening_stage: Number.parseInt(newMember.awakening_stage, 10) || 0,
      coins: 100,
      attendance: 0,
      role: finalRole,
      region: PROFILE_REGION,
      server: PROFILE_SERVER,
      profile_grade: 'Epic',
    }
    const saved = await saveMember(member)
    setLoading(false)
    if (saved) {
      addToast(`${member.name} added as ${finalRole}!`, 'gold', 'Member Added')
      setNewMember({ name: '', username: '', password: '', cls: 'Berserker', power: 10000, character_level: 1, awakening_stage: 0, role: 'Member' })
      setShowAdd(false)
    }
  }

  return (
    <div className="w-full pb-8">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="h-px w-7 bg-gold/60" />
            <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-gold-light">Clan Character Index</span>
          </div>
          <h1 className="font-spectral text-3xl font-black tracking-tight text-white">Members</h1>
          <p className="mt-1 text-xs text-text-dim">{visibleMembers.length} warriors · Growth Power ranking · player profiles</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowRanking(true)} className="rounded-md border border-gold/30 bg-gold/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-gold-light hover:bg-gold/10">⚡ Power Ranking</button>
          {isElder && <button onClick={() => setShowAdd(x => !x)} className="btn-gold px-4 py-2.5 text-[10px]">{showAdd ? '✕ Close' : '+ Add Member'}</button>}
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-white/[0.07] bg-[#0b0c0f]/80 p-3 shadow-[0_10px_35px_rgba(0,0,0,.18)]">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">
          <span className="rounded border border-gold/25 bg-gold/5 px-2 py-1 text-gold-light">Region · STEAM</span>
          <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-1">Server · 005</span>
          <span className="text-text-dim">Legendary-default character profiles</span>
        </div>
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim">⌕</span>
            <input className="input w-full pl-8" placeholder="Search character, username or class..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input lg:w-44" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            {classes.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="input lg:w-44" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="power">Highest Power</option>
            <option value="name">Name</option>
            <option value="role">Role</option>
          </select>
        </div>
      </div>

      {showAdd && isElder && (
        <div className="mb-5 rounded-xl border border-gold/25 bg-gradient-to-br from-gold/[0.07] to-transparent p-5">
          <div className="mb-4">
            <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-gold-light">Clan Administration</div>
            <h2 className="font-spectral text-xl font-bold text-white">Add New Character</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Character Name *"><input className="input" placeholder="e.g. Arthur Shelby" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} disabled={loading} /></Field>
            <Field label="Username *"><input className="input" placeholder="Login username" value={newMember.username} onChange={e => setNewMember({ ...newMember, username: e.target.value })} disabled={loading} /></Field>
            <Field label="Password *"><input className="input" type="password" placeholder="Initial password" value={newMember.password} onChange={e => setNewMember({ ...newMember, password: e.target.value })} disabled={loading} /></Field>
            <Field label="Class"><select className="input" value={newMember.cls} onChange={e => setNewMember({ ...newMember, cls: e.target.value })} disabled={loading}>{Object.keys(CLASS_META).map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Power"><input className="input font-mono" type="number" min="0" value={newMember.power} onChange={e => setNewMember({ ...newMember, power: Number.parseInt(e.target.value, 10) || 0 })} disabled={loading} /></Field>
            <Field label="Level"><input className="input font-mono" type="number" min="1" value={newMember.character_level} onChange={e => setNewMember({ ...newMember, character_level: e.target.value })} disabled={loading} /></Field>
            <Field label="Awakening"><select className="input" value={newMember.awakening_stage} onChange={e => setNewMember({ ...newMember, awakening_stage: Number(e.target.value) })} disabled={loading}>{AWAKENING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
            <Field label="Role"><select className="input" value={newMember.role} onChange={e => setNewMember({ ...newMember, role: e.target.value })} disabled={loading}><option value="Member">Member</option>{isMaster && <><option value="Elder">Elder</option><option value="Master">Master</option></>}{isAdmin && <option value="Admin">Admin (hidden)</option>}</select></Field>
          </div>
          <button onClick={addMember} disabled={loading} className="btn-gold mt-4 w-full">{loading ? 'Adding...' : 'Add Character'}</button>
        </div>
      )}

      {ownMember && (
        <div className="mb-5 grid gap-3 md:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-xl border border-gold/20 bg-gradient-to-r from-gold/[0.08] to-transparent p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-gold-light">Your Character</div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="font-spectral text-xl font-bold text-white">{ownMember.name}</div>
                  <span className="rounded border border-gold/25 bg-gold/5 px-2 py-1 text-[9px] font-bold uppercase text-gold-light">#{rankMap.get(ownMember.id) || '—'}</span>
                </div>
                <div className="mt-1 text-xs text-text-dim">{ownMember.cls} · {formatNumber(ownMember.power)} Power</div>
              </div>
              <button onClick={() => setSelected(ownMember)} className="rounded-md border border-gold/35 bg-gold/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-gold-light hover:bg-gold/10">Manage My Power</button>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-[#0b0c0f] p-4">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-dim">Next Power Update</div>
            <div className="mt-1 font-mono text-xl font-black text-white">{cooldownText(getCooldown(ownMember))}</div>
            <div className="mt-1 text-[10px] text-text-dim">{getCooldown(ownMember) > 0 ? `Available ${formatDateTime(ownMember.power_next_update_at)}` : 'Your Power is ready to be updated.'}</div>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-text-dim">{filtered.length} Characters</div>
        <div className="text-[9px] uppercase tracking-wider text-text-dim">Cards ranked by Growth Power</div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[#0b0c0f] py-16 text-center text-sm text-text-dim">No members found.</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map(member => (
            <PlayerCard
              key={member.id}
              member={member}
              rank={rankMap.get(member.id)}
              isSelf={member.id === currentUser?.id}
              onView={setSelected}
              onStaffEdit={staffEditAllowed(member) ? setStaffEditing : null}
            />
          ))}
        </div>
      )}

      {selected && (
        <ProfileModal
          key={`${selected.id}-${selected.power}-${selected.power_next_update_at || ''}-${selected.power_updates_used || 0}`}
          member={selected}
          members={ranked}
          isSelf={selected.id === currentUser?.id}
          onClose={() => setSelected(null)}
          onPowerUpdate={handlePowerUpdate}
          onPowerCooldownReset={() => handlePowerCooldownReset(selected)}
          onProfileUpdate={handleProfileUpdate}
          onStaffEdit={staffEditAllowed(selected) ? setStaffEditing : null}
          canResetPowerCooldown={Boolean(currentUser && ['Admin', 'Master', 'Elder'].includes(currentUser.role))}
        />
      )}

      {showRanking && <RankingPanel members={ranked} onClose={() => setShowRanking(false)} />}

      {staffEditing && (
        <StaffEditor member={staffEditing} ctx={ctx} onClose={() => setStaffEditing(null)} onResetPassword={setResetTarget} />
      )}

      {resetTarget && (
        <ResetPasswordModal ctx={ctx} member={resetTarget} onClose={() => setResetTarget(null)} />
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label>
      <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-text-dim">{label}</span>
      {children}
    </label>
  )
}
