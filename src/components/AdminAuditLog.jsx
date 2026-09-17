import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ResetPasswordModal from './ResetPasswordModal'

const STAFF_ROLES = new Set(['Admin', 'Master', 'Elder'])
const POWER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const PROFILE_REGION = 'STEAM'
const PROFILE_SERVER = '005'

const CLASS_OPTIONS = ['Berserker', 'Warlord', 'Archer', 'Skald', 'Volva', 'Rune Fighter']
const GRADE_OPTIONS = ['Epic', 'Legendary', 'Mythic']
const AWAKENING_OPTIONS = [
  { value: 0, label: 'Not Awakened' },
  { value: 1, label: 'Stage 1' },
]

const formatNumber = value => Number(value || 0).toLocaleString()

function formatDate(value) {
  if (!value) return 'Unknown time'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Unknown time'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d)
}

function cooldownText(value) {
  const ms = Math.max(0, Number(value) || 0)
  if (ms <= 0) return 'Ready'
  const totalHours = Math.ceil(ms / 3600000)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}

function getCooldown(member) {
  if (!member?.power_next_update_at) return 0
  return Math.max(0, new Date(member.power_next_update_at).getTime() - Date.now())
}

function normalizeLog(row) {
  let details = row?.details ?? {}
  if (typeof details === 'string') {
    try { details = JSON.parse(details) } catch { details = { value: details } }
  }
  return {
    id: row?.id,
    actorId: row?.actor_id ?? row?.actorId ?? null,
    actorName: row?.actor_name ?? row?.actorName ?? 'Unknown Staff',
    actorRole: row?.actor_role ?? row?.actorRole ?? '',
    action: row?.action || 'Unknown Action',
    entityType: row?.entity_type ?? row?.entityType ?? 'System',
    entityId: row?.entity_id ?? row?.entityId ?? null,
    details: details && typeof details === 'object' ? details : {},
    createdAt: row?.created_at ?? row?.createdAt ?? null,
  }
}

function prettyDetails(details) {
  return Object.entries(details || {})
    .filter(([key, value]) => {
      if (value === null || value === undefined || value === '') return false
      return !['coins_before', 'coins_after', 'coin_change', 'coin_before', 'coin_after', 'coin_delta', 'power_before', 'power_after', 'power_change', 'field_changes', 'changes'].includes(String(key).toLowerCase())
    })
    .map(([key, value]) => {
      let rendered = value
      if (typeof value === 'object') {
        try { rendered = JSON.stringify(value) } catch { rendered = '[object]' }
      }
      return `${key.replace(/_/g, ' ')}: ${String(rendered)}`
    })
    .join(' · ')
}

function getFieldChanges(details) {
  const raw = details?.field_changes
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const preferred = ['coins', 'power', 'cls', 'profile_grade', 'character_level', 'awakening_stage', 'role']
  return [...preferred.filter(key => Object.prototype.hasOwnProperty.call(raw, key)), ...Object.keys(raw).filter(key => !preferred.includes(key))]
    .map(key => {
      const item = raw[key]
      if (!item || typeof item !== 'object') return null
      return { key, label: item.label || key.replace(/_/g, ' '), before: item.before, after: item.after, delta: Number.isFinite(Number(item.delta)) ? Number(item.delta) : null }
    })
    .filter(Boolean)
}

function actionTone(action) {
  const value = String(action || '').toLowerCase()
  if (value.includes('delete') || value.includes('remove')) return 'text-red-300'
  if (value.includes('create') || value.includes('award') || value.includes('publish')) return 'text-green-300'
  if (value.includes('update') || value.includes('edit') || value.includes('change') || value.includes('reset')) return 'text-gold-light'
  return 'text-text-bright'
}

function targetName(log, members) {
  const explicit = log.details?.member_name || log.details?.target_name || log.details?.player_name || log.details?.name
  if (explicit) return explicit
  if (String(log.entityType).toLowerCase() === 'member' && log.entityId != null) {
    return members.find(member => String(member.id) === String(log.entityId))?.name || null
  }
  return null
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d10] p-5 shadow-[0_12px_35px_rgba(0,0,0,.18)]">
      <div className="text-[14px] font-bold uppercase tracking-[0.18em] text-text-dim">{label}</div>
      <div className="mt-1 font-mono text-2xl font-black text-gold-bright">{value}</div>
      {hint && <div className="mt-1 text-[14px] text-text-dim">{hint}</div>}
    </div>
  )
}

function ActionCard({ icon, title, description, button, onClick, danger = false }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-[0_12px_35px_rgba(0,0,0,.18)] ${danger ? 'border-red-400/15 bg-red-400/[0.025]' : 'border-white/[0.07] bg-[#0b0c0f]'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gold/15 bg-gold/[0.04] text-lg">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-black uppercase tracking-[0.15em] text-text-bright">{title}</div>
          <p className="mt-1 text-[14px] leading-6 text-text-dim">{description}</p>
          <button type="button" onClick={onClick} className={`mt-3 rounded-lg px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] ${danger ? 'border border-red-400/25 bg-red-400/[0.05] text-red-300 hover:bg-red-400/10' : 'border border-gold/20 bg-gold/[0.04] text-gold-light hover:bg-gold/10'}`}>
            {button}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddMemberModal({ ctx, onClose }) {
  const { saveMember, addToast, currentUser, allMembers = [] } = ctx
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', password: '', cls: 'Berserker', power: 10000, character_level: 1, awakening_stage: 0, role: 'Member', profile_grade: 'Legendary' })
  const isAdmin = currentUser?.role === 'Admin'
  const isMaster = isAdmin || currentUser?.role === 'Master'

  const submit = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      addToast('Character name, username, and password are required.', 'red', 'Missing Information')
      return
    }
    if (allMembers.some(member => String(member.username || '').toLowerCase() === form.username.trim().toLowerCase())) {
      addToast('Username already taken.', 'red', 'Cannot Create Member')
      return
    }

    if (form.role === 'Master' && !isAdmin && !window.confirm(`Create ${form.name.trim()} as a MASTER?`)) return
    if (form.role === 'Admin' && !isAdmin) return

    setSaving(true)
    const member = {
      id: Date.now(), name: form.name.trim(), username: form.username.trim(), password: form.password.trim(),
      cls: form.cls, power: Number.parseInt(form.power, 10) || 10000,
      character_level: Math.max(1, Number.parseInt(form.character_level, 10) || 1),
      awakening_stage: Number.parseInt(form.awakening_stage, 10) || 0, coins: 100, attendance: 0,
      role: form.role, region: PROFILE_REGION, server: PROFILE_SERVER, profile_grade: form.profile_grade,
    }
    const ok = await saveMember(member)
    setSaving(false)
    if (ok) {
      addToast(`${member.name} added as ${member.role}.`, 'gold', 'Member Added')
      onClose()
    }
  }

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl rounded-2xl border border-gold/20 bg-[#0a0b0d] p-6 shadow-[0_35px_100px_rgba(0,0,0,.7)] sm:p-8">
        <div className="mb-5 flex items-start justify-between">
          <div><div className="text-[12px] font-bold uppercase tracking-[0.24em] text-gold-light">Member Management</div><h2 className="font-spectral text-2xl font-bold text-white">Add New Member</h2></div>
          <button onClick={onClose} className="rounded-md border border-white/10 px-3 py-2 text-xs text-text-dim">✕</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Character Name *</span><input className="input h-12 w-full px-4 text-[14px]" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Arthur Shelby" /></label>
          <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Username *</span><input className="input h-12 w-full px-4 text-[14px]" value={form.username} onChange={e => set('username', e.target.value)} placeholder="Login username" /></label>
          <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Initial Password *</span><input className="input h-12 w-full px-4 text-[14px]" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Initial password" /></label>
          <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Class</span><select className="input h-12 w-full px-4 text-[14px]" value={form.cls} onChange={e => set('cls', e.target.value)}>{CLASS_OPTIONS.map(option => <option key={option}>{option}</option>)}</select></label>
          <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Starting Power</span><input className="input w-full font-mono" type="number" min="0" value={form.power} onChange={e => set('power', e.target.value)} /></label>
          <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Character Level</span><input className="input w-full font-mono" type="number" min="1" value={form.character_level} onChange={e => set('character_level', e.target.value)} /></label>
          <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Awakening</span><select className="input h-12 w-full px-4 text-[14px]" value={form.awakening_stage} onChange={e => set('awakening_stage', Number(e.target.value))}>{AWAKENING_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Card Grade</span><select className="input h-12 w-full px-4 text-[14px]" value={form.profile_grade} onChange={e => set('profile_grade', e.target.value)}>{GRADE_OPTIONS.map(option => <option key={option}>{option === 'Mythic' ? 'Mythical' : option}</option>)}</select></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Role</span><select className="input h-12 w-full px-4 text-[14px]" value={form.role} onChange={e => set('role', e.target.value)}><option>Member</option>{isMaster && <><option>Elder</option><option>Master</option></>}{isAdmin && <option>Admin</option>}</select></label>
        </div>
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[14px] leading-6 text-text-dim">New characters start with <strong className="text-gold-light">100 Coins</strong>. Staff can choose the Card Grade and role according to their permissions.</div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-text-dim">Cancel</button><button onClick={submit} disabled={saving} className="btn-gold text-xs px-5 py-2.5">{saving ? 'Creating...' : 'Create Member'}</button></div>
      </div>
    </div>
  )
}

function ManageMemberModal({ ctx, member, onClose }) {
  const { updateMember, deleteMember, resetMemberPowerCooldown, resetMemberPassword, addToast, currentUser } = ctx
  const [saving, setSaving] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [form, setForm] = useState({
    cls: member.cls || 'Berserker', profile_grade: member.profile_grade === 'Mythical' ? 'Mythic' : (member.profile_grade || 'Legendary'),
    level: member.character_level || member.level || 1, awakening: Number(member.awakening_stage) || 0,
    coins: member.coins ?? 0, power: member.power ?? 0,
  })
  const isAdmin = currentUser?.role === 'Admin'
  const isMaster = isAdmin || currentUser?.role === 'Master'
  const isStaff = STAFF_ROLES.has(currentUser?.role)
  const isSelf = String(member.id) === String(currentUser?.id)
  const canRole = !isSelf && (isAdmin || (isMaster && !['Admin', 'Master'].includes(member.role)))
  const canRemove = !isSelf && (isAdmin || (isMaster && !['Admin', 'Master'].includes(member.role)) || (currentUser?.role === 'Elder' && member.role === 'Member'))
  const canReset = !isSelf && (isAdmin || (isMaster && !['Admin', 'Master'].includes(member.role)) || (currentUser?.role === 'Elder' && member.role === 'Member'))

  const save = async () => {
    if (!isStaff) return
    const coins = Math.max(0, Number.parseInt(form.coins, 10) || 0)
    const power = Math.max(0, Number.parseInt(form.power, 10) || 0)
    const level = Math.max(1, Number.parseInt(form.level, 10) || 1)
    const awakening = Math.max(0, Number.parseInt(form.awakening, 10) || 0)
    const updates = {}
    if (form.cls !== (member.cls || 'Berserker')) updates.cls = form.cls
    if (form.profile_grade !== (member.profile_grade === 'Mythical' ? 'Mythic' : (member.profile_grade || 'Legendary'))) updates.profile_grade = form.profile_grade
    if (coins !== Number(member.coins || 0)) updates.coins = coins
    if (level !== Number(member.character_level || member.level || 1)) updates.character_level = level
    if (awakening !== Number(member.awakening_stage || 0)) updates.awakening_stage = awakening
    if (power !== Number(member.power || 0)) { updates.power = power; updates.power_updated_at = new Date().toISOString(); updates.power_next_update_at = new Date(Date.now() + POWER_COOLDOWN_MS).toISOString() }
    if (!Object.keys(updates).length) { onClose(); return }
    setSaving(true)
    const ok = await updateMember(member.id, updates)
    setSaving(false)
    if (ok) { addToast(`${member.name} updated.`, 'gold', 'Member Updated'); onClose() }
  }

  const changeRole = async role => {
    if (!canRole || role === member.role) return
    if (role === 'Admin' && !isAdmin) return
    if (role === 'Admin' && !window.confirm(`Promote ${member.name} to ADMIN?`)) return
    if (role === 'Master' && !isAdmin && !window.confirm(`Promote ${member.name} to MASTER?`)) return
    const ok = await updateMember(member.id, { role })
    if (ok) { addToast(`${member.name} is now ${role}.`, 'gold', 'Role Updated'); onClose() }
  }

  const remove = async () => {
    if (!canRemove || !window.confirm(`Remove ${member.name}?\n\nThis cannot be undone.`)) return
    const ok = await deleteMember(member.id)
    if (ok) { addToast(`${member.name} removed.`, 'red', 'Member Removed'); onClose() }
  }

  const resetCooldown = async () => {
    if (!isStaff || !resetMemberPowerCooldown) return
    if (!window.confirm(`Reset the Power cooldown for ${member.name}?\n\nThis gives the member 3 fresh Power updates immediately.`)) return
    const ok = await resetMemberPowerCooldown(member.id)
    if (ok) addToast(`${member.name} can now update Power 3 times.`, 'gold', 'Power Cooldown Reset')
  }

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-gold/20 bg-[#0a0b0d] p-6 shadow-[0_35px_100px_rgba(0,0,0,.7)] sm:p-8">
          <div className="mb-5 flex items-start justify-between"><div><div className="text-[12px] font-bold uppercase tracking-[0.24em] text-gold-light">Staff Controls</div><h2 className="font-spectral text-2xl font-bold text-white">{member.name}</h2><div className="mt-1 text-[14px] uppercase tracking-wider text-text-dim">{member.role} · {member.cls || '—'}</div></div><button onClick={onClose} className="rounded-md border border-white/10 px-3 py-2 text-xs text-text-dim">✕</button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Class</span><select className="input h-12 w-full px-4 text-[14px]" value={form.cls} onChange={e => setForm(p => ({ ...p, cls: e.target.value }))}><>{CLASS_OPTIONS.map(option => <option key={option}>{option}</option>)}</></select></label>
            <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Card Grade</span><select className="input h-12 w-full px-4 text-[14px]" value={form.profile_grade} onChange={e => setForm(p => ({ ...p, profile_grade: e.target.value }))}>{GRADE_OPTIONS.map(option => <option key={option}>{option === 'Mythic' ? 'Mythical' : option}</option>)}</select></label>
            <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Character Level</span><input className="input w-full font-mono" type="number" min="1" value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))} /></label>
            <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">Awakening</span><select className="input h-12 w-full px-4 text-[14px]" value={form.awakening} onChange={e => setForm(p => ({ ...p, awakening: Number(e.target.value) }))}>{AWAKENING_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">🪙 Coins</span><input className="input w-full font-mono" type="number" min="0" value={form.coins} onChange={e => setForm(p => ({ ...p, coins: e.target.value }))} /></label>
            <label><span className="mb-1.5 block text-[14px] font-bold uppercase tracking-wider text-gold-light">⚡ Power</span><input className="input w-full font-mono" type="number" min="0" value={form.power} onChange={e => setForm(p => ({ ...p, power: e.target.value }))} /></label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="text-[14px] font-bold uppercase tracking-wider text-text-dim">Power Cooldown</div><div className="mt-1 font-mono text-lg font-bold text-gold-light">{cooldownText(getCooldown(member))}</div><div className="mt-1 text-[14px] text-text-dim">Staff Power updates are unlimited.</div></div><button type="button" onClick={resetCooldown} className="rounded-xl border border-gold/20 bg-gold/[0.035] p-3 text-left hover:bg-gold/[0.07]"><div className="text-[14px] font-bold uppercase tracking-wider text-gold-light">Power Control</div><div className="mt-1 text-[13px] font-bold text-white">Reset Power Cooldown</div><div className="mt-1 text-[14px] text-text-dim">Give this member 3 fresh Power updates.</div></button></div>
          {(canRole || canReset) && <div className="mt-4 border-t border-white/[0.07] pt-4"><div className="mb-2 text-[14px] font-bold uppercase tracking-[0.18em] text-text-dim">Role & Account</div><div className="flex flex-wrap gap-2">{canRole && member.role === 'Member' && <button onClick={() => changeRole('Elder')} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-40">↑ Promote Elder</button>}{canRole && member.role === 'Elder' && <><button onClick={() => changeRole('Member')} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-40">↓ Demote Member</button>{isMaster && <button onClick={() => changeRole('Master')} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-40">★ Promote Master</button>}</>}{canRole && member.role === 'Master' && isAdmin && <button onClick={() => changeRole('Elder')} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-40">↓ Demote to Elder</button>}{canRole && isAdmin && member.role !== 'Admin' && <button onClick={() => changeRole('Admin')} className="rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-red-300 hover:bg-red-400/10 disabled:opacity-40">⚠ Make Admin</button>}{canRole && isAdmin && member.role === 'Admin' && <button onClick={() => changeRole('Master')} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-40">↓ Demote Admin</button>}{canReset && resetMemberPassword && <button onClick={() => setResetTarget(member)} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-40">🔑 Reset Password</button>}</div></div>}
          <div className="mt-5 flex flex-wrap justify-between gap-2">{canRemove ? <button onClick={remove} className="rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-red-300 hover:bg-red-400/10 disabled:opacity-40">Remove Member</button> : <span />}</div>
          <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-text-dim">Cancel</button><button onClick={save} disabled={saving || !isStaff} className="btn-gold text-xs px-5 py-2.5">{saving ? 'Saving...' : 'Save Changes'}</button></div>
        </div>
      </div>
      {resetTarget && <ResetPasswordModal ctx={ctx} member={resetTarget} onClose={() => setResetTarget(null)} />}
    </>
  )
}

function CoinDecayModal({ ctx, onClose }) {
  const { allMembers = [], currentUser, supabase, reloadMembers, addToast } = ctx
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const rows = allMembers
  const allSelected = rows.length > 0 && rows.every(member => selected.includes(member.id))
  const toggleAll = () => setSelected(allSelected ? [] : rows.map(member => member.id))
  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const run = async () => {
    if (!STAFF_ROLES.has(currentUser?.role) || selected.length === 0 || busy) return
    if (!window.confirm(`Apply 25% Coin Decay to ${selected.length} selected member${selected.length === 1 ? '' : 's'}?\n\nTheir balances will become 75% of the current amount.`)) return
    setBusy(true)
    try {
      const targets = rows.filter(member => selected.includes(member.id))
      const results = await Promise.all(targets.map(member => supabase.from('members').update({ coins: Math.floor(Math.max(0, Number(member.coins) || 0) * 0.75) }).eq('id', member.id)))
      const failed = results.find(result => result.error)
      if (failed?.error) throw failed.error
      await reloadMembers?.()
      addToast(`25% Coin decay applied to ${targets.length} members.`, 'gold', 'Coin Decay Applied')
      onClose()
    } catch (error) {
      addToast(error?.message || 'Failed to apply Coin Decay.', 'red', 'Coin Decay Failed')
    } finally { setBusy(false) }
  }
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-xl max-h-[85vh] overflow-hidden rounded-2xl border border-gold/20 bg-[#0a0b0d] shadow-[0_35px_100px_rgba(0,0,0,.7)]"><div className="flex items-center justify-between border-b border-white/[0.07] p-5"><div><div className="text-[14px] font-bold uppercase tracking-[0.2em] text-gold-light">Coin Management</div><h2 className="font-spectral text-xl font-bold text-white">25% Coin Decay</h2></div><button onClick={onClose} className="rounded-md border border-white/10 px-3 py-2 text-xs text-text-dim">✕</button></div><div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3"><span className="text-[14px] text-text-dim">{selected.length} selected</span><button onClick={toggleAll} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-40">{allSelected ? 'Clear All' : 'Select All'}</button></div><div className="max-h-[55vh] overflow-y-auto p-3">{rows.map(member => <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03]"><input type="checkbox" checked={selected.includes(member.id)} onChange={() => toggle(member.id)} className="h-4 w-4 accent-yellow-500" /><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold text-white">{member.name}</div><div className="text-[14px] text-text-dim">{member.role} · {formatNumber(member.coins)} Coins</div></div></label>)}</div><div className="flex justify-end gap-2 border-t border-white/[0.07] p-4"><button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-text-dim">Cancel</button><button onClick={run} disabled={busy || selected.length === 0} className="btn-gold text-xs px-5 py-2.5">{busy ? 'Processing...' : `Apply Decay${selected.length ? ` (${selected.length})` : ''}`}</button></div></div></div>
}

export default function AdminAuditLog({ ctx }) {
  const supabase = ctx?.supabase
  const currentUser = ctx?.currentUser
  const allMembers = ctx?.allMembers || []
  const canView = STAFF_ROLES.has(currentUser?.role)
  const canDelete = currentUser?.role === 'Admin' || currentUser?.role === 'Master'

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showCoinDecay, setShowCoinDecay] = useState(false)
  const [showResetCoins, setShowResetCoins] = useState(false)
  const [resetText, setResetText] = useState('')

  const loadLogs = useCallback(async () => {
    if (!canView || !supabase) { setLoading(false); return }
    setLoading(true)
    try {
      const { data, error: dbError } = await supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(500)
      if (dbError) throw dbError
      setLogs((data || []).map(normalizeLog)); setSelectedIds([]); setError('')
    } catch (err) { console.error('Failed to load admin audit logs:', err); setError(err?.message || 'Could not load audit history.'); setLogs([]) }
    finally { setLoading(false) }
  }, [canView, supabase])

  useEffect(() => {
    loadLogs()
    if (!canView) return undefined
    const timer = setInterval(loadLogs, 30000)
    return () => clearInterval(timer)
  }, [loadLogs, canView])

  const visibleMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allMembers.filter(member => !q || `${member.name || ''} ${member.username || ''} ${member.cls || ''} ${member.role || ''}`.toLowerCase().includes(q))
  }, [allMembers, search])
  const staffCount = allMembers.filter(member => STAFF_ROLES.has(member.role)).length
  const recentLogs = logs.slice(0, 5)
  const actions = useMemo(() => ['all', ...Array.from(new Set(logs.map(log => log.action)))], [logs])
  const entities = useMemo(() => ['all', ...Array.from(new Set(logs.map(log => log.entityType)))], [logs])
  const filteredLogs = useMemo(() => logs.filter(log => (actionFilter === 'all' || log.action === actionFilter) && (entityFilter === 'all' || log.entityType === entityFilter)), [logs, actionFilter, entityFilter])
  const visibleIds = filteredLogs.map(log => log.id).filter(Boolean)
  const allVisibleSelected = canDelete && visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id))

  const toggleSelected = id => { if (canDelete) setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }
  const toggleSelectAll = () => setSelectedIds(prev => allVisibleSelected ? prev.filter(id => !visibleIds.includes(id)) : Array.from(new Set([...prev, ...visibleIds])))

  const deleteSelected = async () => {
    if (!canDelete || selectedIds.length === 0 || busy) return
    if (!window.confirm(`Delete ${selectedIds.length} selected audit log${selectedIds.length === 1 ? '' : 's'}?\n\nThis cannot be undone.`)) return
    setBusy(true)
    try { const { error: dbError } = await supabase.from('admin_audit_logs').delete().in('id', selectedIds); if (dbError) throw dbError; setLogs(prev => prev.filter(log => !selectedIds.includes(log.id))); setSelectedIds([]) }
    catch (err) { setError(err?.message || 'Could not delete selected audit logs.') }
    finally { setBusy(false) }
  }

  const deleteAllLogs = async () => {
    if (!canDelete || busy || logs.length === 0) return
    if (!window.confirm('DELETE ALL AUDIT LOGS?\n\nThis permanently removes the entire audit history.\n\nThis cannot be undone.')) return
    setBusy(true)
    try { const { error: dbError } = await supabase.from('admin_audit_logs').delete().not('id', 'is', null); if (dbError) throw dbError; setLogs([]); setSelectedIds([]) }
    catch (err) { setError(err?.message || 'Could not delete all audit logs.') }
    finally { setBusy(false) }
  }

  const resetAllCoins = async () => {
    if (!STAFF_ROLES.has(currentUser?.role) || busy || allMembers.length === 0) return
    if (resetText !== 'RESET') return
    setBusy(true)
    try {
      const results = await Promise.all(allMembers.map(member => supabase.from('members').update({ coins: 0 }).eq('id', member.id)))
      const failed = results.find(result => result.error)
      if (failed?.error) throw failed.error
      await ctx.reloadMembers?.(); ctx.addToast?.(`All Coins were permanently reset to 0 for ${allMembers.length} members.`, 'red', 'Coins Reset'); setShowResetCoins(false); setResetText('')
    } catch (err) { ctx.addToast?.(err?.message || 'Failed to reset all Coins.', 'red', 'Coin Reset Failed') }
    finally { setBusy(false) }
  }

  if (!canView) return <div className="flex min-h-[50vh] items-center justify-center"><section className="w-full max-w-md rounded-2xl border border-red-400/15 bg-[#0b0a09]/90 p-6 text-center"><div className="text-3xl">🔒</div><h1 className="mt-3 font-spectral text-xl font-bold text-text-bright">Restricted Area</h1><p className="mt-1.5 text-[13px] leading-relaxed text-text-dim">Staff Control Center is available only to Admin, Master, and Elder.</p></section></div>

  return (
    <div className="w-full min-w-0 max-w-full space-y-7 pb-12">
      <section className="relative overflow-hidden rounded-2xl border border-gold/20 bg-[#0b0a09]/90 shadow-[0_18px_60px_rgba(0,0,0,.28)]"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" /><div className="relative p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="mb-2 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_10px_rgba(242,204,96,.8)]" /><span className="text-[13px] font-bold uppercase tracking-[.22em] text-gold-dim">Clan Administration</span></div><h1 className="font-spectral text-2xl font-bold text-text-bright sm:text-3xl">Staff Control Center</h1><p className="mt-1.5 text-[14px] leading-6 text-text-dim">Manage members, Power, Coins, accounts, and staff activity from one place.</p></div><div className="rounded-lg border border-gold/15 bg-gold/[.035] px-3 py-2 text-right"><div className="text-[14px] font-bold uppercase tracking-wider text-text-dim">Signed in as</div><div className="mt-0.5 text-[14px] font-bold text-gold-light">{currentUser?.role}</div></div></div></div></section>

      <section><div className="mb-3 text-[12px] font-black uppercase tracking-[.2em] text-text-dim">Overview</div><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><StatCard label="Members" value={allMembers.length} hint="All clan characters" /><StatCard label="Staff" value={staffCount} hint="Admin · Master · Elder" /><StatCard label="Activity" value={logs.length} hint="Loaded audit events" /><StatCard label="Recent Action" value={recentLogs.length ? 'Live' : '—'} hint={recentLogs.length ? formatDate(recentLogs[0].createdAt) : 'No activity'} /></div></section>

      <section><div className="mb-3 flex items-end justify-between"><div><div className="text-[12px] font-black uppercase tracking-[.2em] text-text-dim">Quick Actions</div><div className="mt-1 text-[13px] text-text-dim">Common staff tasks, kept simple.</div></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><ActionCard icon="＋" title="Add Member" description="Create a new clan character and account." button="Add Member" onClick={() => setShowAddMember(true)} /><ActionCard icon="⚔" title="Manage Members" description="Search a member and edit profile, Power, Coins, or account controls." button="Open Member List" onClick={() => document.getElementById('staff-member-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} /><ActionCard icon="🪙" title="Coin Management" description="Apply a 25% decay to selected members." button="Manage Coins" onClick={() => setShowCoinDecay(true)} /><ActionCard icon="⚡" title="Power Management" description="Select a member below to update Power or reset their cooldown." button="Choose Member" onClick={() => document.getElementById('staff-member-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} /></div></section>

      <section id="staff-member-list" className="scroll-mt-5"><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-[12px] font-black uppercase tracking-[.2em] text-text-dim">Member Management</div><div className="mt-1 text-[13px] text-text-dim">Search first. Open a focused control panel only when you need it.</div></div><div className="text-[14px] text-text-dim">{visibleMembers.length} shown</div></div><div className="mb-4 flex flex-col gap-3 sm:flex-row"><input className="input h-12 min-w-0 flex-1 px-4 text-[14px]" placeholder="🔍 Search member, username, class, or role..." value={search} onChange={e => setSearch(e.target.value)} /><button onClick={() => setShowAddMember(true)} className="btn-gold shrink-0 px-4 text-[14px]">＋ Add Member</button></div><div className="grid gap-2">{visibleMembers.slice(0, 50).map(member => <div key={member.id} className="flex flex-col gap-3 rounded-2xl border border-white/[.08] bg-[#0c0d10] p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gold/10 bg-gold/[.035] text-sm">{member.cls === 'Archer' ? '🏹' : member.cls === 'Warlord' ? '🛡' : member.cls === 'Skald' ? '♫' : member.cls === 'Volva' ? '✦' : member.cls === 'Rune Fighter' ? 'ᚱ' : '⚔'}</div><div className="min-w-0"><div className="truncate text-[14px] font-bold text-white">{member.name}</div><div className="mt-0.5 truncate text-[14px] uppercase tracking-wider text-text-dim">{member.role} · {member.cls || '—'} · Lv. {member.character_level || member.level || 1}</div></div></div><div className="grid grid-cols-2 gap-2 text-right sm:flex sm:items-center"><div><div className="text-[13px] uppercase tracking-wider text-text-dim">Power</div><div className="font-mono text-[13px] font-bold text-gold-light">{formatNumber(member.power)}</div></div><div><div className="text-[13px] uppercase tracking-wider text-text-dim">Coins</div><div className="font-mono text-[13px] font-bold text-text-bright">{formatNumber(member.coins)}</div></div><button onClick={() => setSelectedMember(member)} className="col-span-2 rounded-lg border border-gold/20 bg-gold/[.04] px-4 py-2 text-[14px] font-bold uppercase tracking-wider text-gold-light hover:bg-gold/[.09] sm:col-span-1">Manage</button></div></div>)}{visibleMembers.length > 50 && <div className="py-3 text-center text-[14px] text-text-dim">Showing first 50 results. Use search to find a specific member.</div>}{visibleMembers.length === 0 && <div className="rounded-xl border border-white/[.07] bg-[#0b0c0f] py-10 text-center text-[13px] text-text-dim">No members found.</div>}</div></section>

      <section><div className="mb-3 text-[12px] font-black uppercase tracking-[.2em] text-text-dim">Coin Management</div><div className="grid gap-3 md:grid-cols-2"><ActionCard icon="🪙" title="25% Coin Decay" description="Select exactly which members should have their current Coin balance reduced to 75%." button="Select Members" onClick={() => setShowCoinDecay(true)} /><ActionCard icon="⚠" title="Reset All Coins" description="Permanently set every member's Coins to zero. Admin, Master, Elder, and Members are all included." button="Reset Everyone" onClick={() => { setResetText(''); setShowResetCoins(true) }} danger /></div></section>

      <section><div className="mb-3 text-[12px] font-black uppercase tracking-[.2em] text-text-dim">Activity History</div><div className="flex min-w-0 flex-col gap-2 sm:flex-row"><select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="input h-12 flex-1 px-4 text-[14px]"><option value="all">All Actions</option>{actions.slice(1).map(value => <option key={value}>{value}</option>)}</select><select value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="input h-12 flex-1 px-4 text-[14px]"><option value="all">All Areas</option>{entities.slice(1).map(value => <option key={value}>{value}</option>)}</select><button onClick={loadLogs} disabled={loading || busy} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-40">Refresh</button></div>{canDelete && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/[.07] bg-[#090807]/80 px-3 py-2.5"><button onClick={toggleSelectAll} disabled={!visibleIds.length || busy} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-40">{allVisibleSelected ? 'Deselect All' : 'Select All'}</button><span className="text-[14px] text-text-dim">{selectedIds.length} selected · {logs.length} loaded</span><button onClick={deleteSelected} disabled={!selectedIds.length || busy} className="control-btn danger ml-auto">Delete Selected</button><button onClick={deleteAllLogs} disabled={!logs.length || busy} className="rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-red-300 hover:bg-red-400/10 disabled:opacity-40">Delete All Logs</button></div>}{error && <div className="mt-2 rounded-xl border border-red-400/20 bg-red-400/[.04] px-4 py-3 text-[14px] text-red-300">{error}</div>}<div className="mt-3 overflow-hidden rounded-xl border border-white/[.07] bg-[#090807]/80">{loading ? <div className="px-4 py-12 text-center text-[13px] text-text-dim">Loading activity...</div> : filteredLogs.length === 0 ? <div className="px-4 py-12 text-center text-[13px] text-text-dim">No activity entries found.</div> : <div className="divide-y divide-white/[.055]">{filteredLogs.slice(0, 100).map(log => { const changes = getFieldChanges(log.details); const target = targetName(log, allMembers); return <div key={String(log.id)} className="p-5 sm:p-6"><div className="flex flex-col gap-3 md:flex-row md:items-start"><div className="w-full shrink-0 md:w-44"><div className="font-mono text-[14px] text-text-dim">{formatDate(log.createdAt)}</div><div className="mt-1 text-[14px] font-bold text-gold-light">{log.actorName}</div><div className="text-[13px] uppercase tracking-wider text-text-dim">{log.actorRole}</div></div><div className="min-w-0 flex-1"><div className={`text-[13px] font-bold ${actionTone(log.action)}`}>{log.action}<span className="ml-1 text-[14px] font-normal text-text-dim">· {log.entityType}</span></div>{target && <div className="mt-1 text-[14px] text-text-bright">Target: <span className="font-bold text-gold-light">{target}</span></div>}{changes.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{changes.map(change => <span key={change.key} className="rounded-md border border-white/[.08] bg-white/[.025] px-2 py-1 text-[14px] text-text-bright">{change.label}: <strong>{String(change.before ?? '—')}</strong> → <strong>{String(change.after ?? '—')}</strong></span>)}</div>}<div className="mt-1 break-words text-[14px] leading-6 text-text-dim">{prettyDetails(log.details) || 'No additional details recorded.'}</div></div>{canDelete && <button onClick={async () => { if (!window.confirm('Delete this audit log?')) return; await supabase.from('admin_audit_logs').delete().eq('id', log.id); setLogs(prev => prev.filter(item => item.id !== log.id)) }} className="control-btn danger shrink-0">Delete</button>}</div></div>})}</div>}</div></section>

      <section><div className="mb-3 text-[12px] font-black uppercase tracking-[.2em] text-red-300/80">Danger Zone</div><div className="rounded-xl border border-red-400/15 bg-red-400/[.025] p-4"><div className="text-[13px] font-bold text-red-200">Permanent administrative actions</div><p className="mt-1 text-[14px] leading-6 text-text-dim">Use these only when you are certain. Coin reset and audit-history deletion cannot be undone from the website.</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => { setResetText(''); setShowResetCoins(true) }} className="rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-red-300 hover:bg-red-400/10 disabled:opacity-40">Reset All Coins</button>{canDelete && <button onClick={deleteAllLogs} disabled={busy || !logs.length} className="rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2 text-[14px] font-bold uppercase tracking-[0.1em] text-red-300 hover:bg-red-400/10 disabled:opacity-40">Delete Audit History</button>}</div></div></section>

      {showAddMember && <AddMemberModal ctx={ctx} onClose={() => { setShowAddMember(false); ctx.reloadMembers?.() }} />}
      {selectedMember && <ManageMemberModal ctx={ctx} member={selectedMember} onClose={() => { setSelectedMember(null); ctx.reloadMembers?.() }} />}
      {showCoinDecay && <CoinDecayModal ctx={ctx} onClose={() => { setShowCoinDecay(false); ctx.reloadMembers?.() }} />}
      {showResetCoins && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"><div className="w-full max-w-md rounded-2xl border border-red-400/25 bg-[#0b0a09] p-5 shadow-[0_35px_100px_rgba(0,0,0,.8)]"><div className="text-3xl">⚠️</div><h2 className="mt-2 font-spectral text-xl font-bold text-red-200">Reset All Coins</h2><p className="mt-2 text-[13px] leading-relaxed text-text-dim">This permanently sets <strong className="text-white">ALL {allMembers.length} members</strong> to 0 Coins. There is no undo or website backup.</p><div className="mt-4 text-[14px] font-bold uppercase tracking-wider text-text-dim">Type RESET to continue</div><input autoFocus className="input mt-2 w-full h-12 text-center font-mono text-lg font-bold tracking-[.25em]" value={resetText} onChange={e => setResetText(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') resetAllCoins() }} placeholder="RESET" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowResetCoins(false)} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-text-dim">Cancel</button><button onClick={resetAllCoins} disabled={resetText !== 'RESET' || busy} className="rounded-lg border border-red-400/30 bg-red-400/[.08] px-4 py-2 text-[13px] font-bold uppercase text-red-200 disabled:opacity-35">{busy ? 'Resetting...' : 'Confirm Reset'}</button></div></div></div>}
    </div>
  )
}
