import React, { useState } from 'react'
import ResetPasswordModal from './ResetPasswordModal'


// Class artwork is mapped from the saved `cls` value, so choosing a class
// automatically gives the member the matching visual without storing image data per member.
const ClassIcon = ({ cls, size = 32 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 48 48',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  }

  const frame = (
    <rect x="1" y="1" width="46" height="46" rx="10" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.22" />
  )

  if (cls === 'Archer') return (
    <svg {...common} className="text-emerald-300">
      {frame}
      <path d="M31.5 8.5C22 13 17 22 17 32c0 4 1.5 6 3 8" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/>
      <path d="M16.5 10.5c9.5 4.5 14.5 13.5 14.5 23.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".7"/>
      <path d="M10 28h27" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="m31 24 8 4-8 4 2.5-4L31 24Z" fill="currentColor"/>
    </svg>
  )

  if (cls === 'Warlord') return (
    <svg {...common} className="text-sky-300">
      {frame}
      <path d="M13 19 17 11l7 4 7-4 4 8v8c0 8-5.5 12-12 15-6.5-3-12-7-12-15v-8Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"/>
      <path d="M15 22h18M18 28h12M21 34h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".9"/>
    </svg>
  )

  if (cls === 'Skald') return (
    <svg {...common} className="text-violet-300">
      {frame}
      <path d="M16 13c10 1 16 7 16 15 0 7-5 11-11 11-5 0-9-3-9-8 0-5 4-8 9-8 4 0 7 2 7 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M25 11v21M21 35h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="20" cy="31" r="2.3" fill="currentColor"/>
    </svg>
  )

  if (cls === 'Volva') return (
    <svg {...common} className="text-fuchsia-300">
      {frame}
      <path d="M24 8v32M12 14l24 20M36 14 12 34" stroke="currentColor" strokeWidth="1.7" opacity=".65"/>
      <path d="M24 13 28 20l7 4-7 4-4 7-4-7-7-4 7-4 4-7Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round"/>
      <circle cx="24" cy="24" r="3" fill="currentColor"/>
    </svg>
  )

  if (cls === 'Rune Fighter') return (
    <svg {...common} className="text-gold-bright">
      {frame}
      <path d="M24 7v34M14 14l20 20M34 14 14 34" stroke="currentColor" strokeWidth="1.4" opacity=".45"/>
      <path d="M28 8 15 27h9l-4 13 13-20h-9l4-12Z" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
      <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="1.1" opacity=".45"/>
    </svg>
  )

  // Berserker is the default and also the fallback for unknown/new classes.
  return (
    <svg {...common} className="text-red-300">
      {frame}
      <path d="M14 12 24 18l10-6-2 12 5 9-11-3-11 3 5-9-2-12Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="m13 18 8 8M35 18l-8 8M24 18v18" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/>
    </svg>
  )
}

const classIconTone = (cls) =>
  cls === 'Archer' ? 'border-emerald-400/25 bg-emerald-400/[0.06]' :
  cls === 'Warlord' ? 'border-sky-400/25 bg-sky-400/[0.06]' :
  cls === 'Skald' ? 'border-violet-400/25 bg-violet-400/[0.06]' :
  cls === 'Volva' ? 'border-fuchsia-400/25 bg-fuchsia-400/[0.06]' :
  cls === 'Rune Fighter' ? 'border-gold/30 bg-gold/[0.07]' :
  'border-red-400/25 bg-red-400/[0.06]'

export default function Members({ ctx }) {
  const { members, saveMember, updateMember, deleteMember, currentUser, addToast } = ctx
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newMember, setNewMember] = useState({
    name: '', username: '', password: '',
    cls: 'Berserker', power: 10000, role: 'Member',
  })
  const [loading, setLoading] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [coinInput, setCoinInput] = useState('')
  const [powerInput, setPowerInput] = useState('')

  const [resetTarget, setResetTarget] = useState(null)

  const isAdmin = currentUser?.role === 'Admin'
  const isMaster = currentUser?.role === 'Master' || isAdmin
  const isElder = currentUser?.role === 'Elder' || isMaster

  const visibleMembers = isAdmin ? members : members.filter(m => m.role !== 'Admin')
  const filtered = visibleMembers.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  const canRemoveMember = (target) => {
    if (!currentUser) return false
    if (target.id === currentUser.id) return false
    if (isAdmin) return true
    if (target.role === 'Master' || target.role === 'Admin') return false
    if (isMaster) return true
    if (currentUser.role === 'Elder' && target.role === 'Member') return true
    return false
  }

  const canChangeRole = (target) => {
    if (!currentUser) return false
    if (target.id === currentUser.id) return false
    if (isAdmin) return true
    if (target.role === 'Master' || target.role === 'Admin') return false
    if (isMaster) return true
    return false
  }

  const canResetPassword = (target) => {
    if (!currentUser) return false
    if (target.id === currentUser.id) return false
    return isAdmin
  }

  const openEditor = (m) => {
    setEditingId(m.id)
    setCoinInput(String(m.coins))
    setPowerInput(String(m.power))
  }

  const closeEditor = () => {
    setEditingId(null)
    setCoinInput('')
    setPowerInput('')
  }

  const addMember = async () => {
    if (!newMember.name.trim()) { addToast('Character name is required.', 'red', 'Error'); return }
    if (!newMember.username.trim()) { addToast('Username is required.', 'red', 'Error'); return }
    if (!newMember.password.trim()) { addToast('Password is required.', 'red', 'Error'); return }
    if (visibleMembers.some(m => m.username && m.username.toLowerCase() === newMember.username.toLowerCase())) {
      addToast('Username already taken.', 'red', 'Error'); return
    }

    let finalRole = 'Member'
    if (isAdmin) {
      finalRole = newMember.role
    } else if (isMaster) {
      if (newMember.role === 'Elder' || newMember.role === 'Master') finalRole = newMember.role
    } else if (isElder) {
      if (newMember.role !== 'Member') {
        addToast('Only Master or Admin can add Elders or Masters.', 'red', 'Not Allowed')
        return
      }
    }

    if (finalRole === 'Master' && !isAdmin) {
      if (!window.confirm(`Create ${newMember.name.trim()} as a MASTER?`)) return
    }
    if (finalRole === 'Admin') {
      if (!window.confirm(`Create ${newMember.name.trim()} as an ADMIN?`)) return
    }

    setLoading(true)
    const member = {
      id: Date.now(),
      name: newMember.name.trim(),
      username: newMember.username.trim(),
      password: newMember.password.trim(),
      cls: newMember.cls,
      power: parseInt(newMember.power) || 10000,
      coins: 100,
      attendance: 0,
      role: finalRole,
    }
    const saved = await saveMember(member)
    setLoading(false)

    if (saved) {
      addToast(`${member.name} added as ${finalRole}!`, 'gold', 'Member Added')
      setNewMember({ name: '', username: '', password: '', cls: 'Berserker', power: 10000, role: 'Member' })
      setShowAdd(false)
    }
  }

  const removeMember = async (id) => {
    const member = visibleMembers.find(m => m.id === id)
    if (!member) return
    if (!canRemoveMember(member)) {
      addToast('You do not have permission to remove this member.', 'red', 'Not Allowed')
      return
    }
    if (window.confirm(`Remove ${member.name}?`)) {
      const ok = await deleteMember(id)
      if (ok) {
        addToast(`${member.name} removed.`, 'red', 'Removed')
        closeEditor()
      }
    }
  }

  const saveEdits = async (member) => {
    const updates = {}
    const coinVal = parseInt(coinInput)
    const powerVal = parseInt(powerInput)

    if (!Number.isFinite(coinVal) || coinVal < 0) { addToast('Enter a valid coin amount.', 'red', 'Error'); return }
    if (!Number.isFinite(powerVal) || powerVal < 0) { addToast('Enter a valid power value.', 'red', 'Error'); return }

    if (coinVal !== member.coins) updates.coins = coinVal
    if (powerVal !== member.power) updates.power = powerVal
    if (Object.keys(updates).length === 0) { closeEditor(); return }

    const ok = await updateMember(member.id, updates)
    if (ok) {
      const parts = []
      if (updates.coins !== undefined) parts.push(`coins → ${updates.coins.toLocaleString()}`)
      if (updates.power !== undefined) parts.push(`power → ${updates.power.toLocaleString()}`)
      addToast(`${member.name}: ${parts.join(', ')}`, 'gold', 'Saved')
      closeEditor()
    }
  }

  const changeRole = async (id, newRole) => {
    const member = visibleMembers.find(m => m.id === id)
    if (!member) return
    if (!canChangeRole(member)) {
      addToast('You do not have permission to change roles.', 'red', 'Not Allowed')
      return
    }
    if (newRole === 'Master' && !isAdmin) {
      if (!window.confirm(`Promote ${member.name} to MASTER?`)) return
    }
    if (newRole === 'Admin') {
      if (!window.confirm(`Promote ${member.name} to ADMIN?`)) return
    }
    await updateMember(id, { role: newRole })
    addToast(`${member.name} is now ${newRole}.`, 'gold', 'Role Updated')
  }

  const roleClass = (role) =>
    role === 'Admin' ? 'border-red-500/40 bg-red-500/10 text-red-300' :
    role === 'Master' ? 'border-gold/45 bg-gold/10 text-gold-bright' :
    role === 'Elder' ? 'border-orange-400/35 bg-orange-400/10 text-orange-300' :
    'border-sky-400/30 bg-sky-400/10 text-sky-300'

  const roleDot = (role) =>
    role === 'Admin' ? 'bg-red-400' :
    role === 'Master' ? 'bg-gold-bright' :
    role === 'Elder' ? 'bg-orange-300' :
    'bg-sky-300'

  return (
    <div className="w-full">
      {/* Page heading + compact member controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="h-px w-6 bg-gold/60" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-light">Clan Roster</span>
          </div>
          <h1 className="font-spectral text-2xl font-bold tracking-tight text-gold-light">Members</h1>
          <p className="mt-0.5 text-xs text-text-dim">
            {visibleMembers.length} {visibleMembers.length === 1 ? 'warrior' : 'warriors'} in the clan
            {search && <span className="ml-2 text-gold/60">• {filtered.length} matching</span>}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative min-w-0 sm:w-64">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-dim">⌕</span>
            <input
              className="input h-9 w-full pl-8 pr-8 text-sm"
              placeholder="Search members..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-xs text-text-dim hover:bg-gold/10 hover:text-gold-light"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {isElder && (
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="btn-gold h-9 whitespace-nowrap px-4 text-xs font-bold"
            >
              {showAdd ? '✕ Close' : '+ Add Member'}
            </button>
          )}
        </div>
      </div>

      {/* Compact stats strip */}
      <div className="mb-3 grid grid-cols-3 overflow-hidden rounded-lg border border-gold/15 bg-void/45">
        <div className="border-r border-gold/10 px-3 py-2.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">Members</div>
          <div className="mt-0.5 text-sm font-semibold text-text">{visibleMembers.length}</div>
        </div>
        <div className="border-r border-gold/10 px-3 py-2.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">Showing</div>
          <div className="mt-0.5 text-sm font-semibold text-gold-light">{filtered.length}</div>
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">Access</div>
          <div className="mt-0.5 text-sm font-semibold text-text">{isAdmin ? 'Admin' : isMaster ? 'Master' : isElder ? 'Elder' : 'Member'}</div>
        </div>
      </div>

      {/* Add member form */}
      {showAdd && isElder && (
        <div className="mb-3 overflow-hidden rounded-lg border border-gold/25 bg-void/70 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between border-b border-gold/15 bg-gold/[0.035] px-4 py-3">
            <div>
              <div className="text-xs font-bold text-gold-light">Add New Member</div>
              <div className="mt-0.5 text-[10px] text-text-dim">Create a clan account and assign its initial role.</div>
            </div>
            <span className="rounded border border-gold/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-text-dim">Roster</span>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-dim">Character Name *</label>
              <input className="input h-9" placeholder="e.g. Arthur Shelby" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} disabled={loading} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-dim">Username *</label>
              <input className="input h-9" placeholder="Login username" value={newMember.username} onChange={e => setNewMember({ ...newMember, username: e.target.value })} disabled={loading} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-dim">Password *</label>
              <input className="input h-9" type="password" placeholder="Initial password" value={newMember.password} onChange={e => setNewMember({ ...newMember, password: e.target.value })} disabled={loading} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-dim">Class</label>
              <select className="input h-9" value={newMember.cls} onChange={e => setNewMember({ ...newMember, cls: e.target.value })} disabled={loading}>
                <option>Berserker</option><option>Warlord</option><option>Archer</option>
                <option>Skald</option><option>Volva</option><option>Rune Fighter</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-dim">Power</label>
              <input className="input h-9" type="number" min="0" placeholder="10000" value={newMember.power} onChange={e => setNewMember({ ...newMember, power: parseInt(e.target.value) || 0 })} disabled={loading} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-dim">Role</label>
              <select className="input h-9" value={newMember.role} onChange={e => setNewMember({ ...newMember, role: e.target.value })} disabled={loading}>
                <option value="Member">Member</option>
                {isMaster && <option value="Elder">Elder</option>}
                {isMaster && <option value="Master">Master</option>}
                {isAdmin && <option value="Admin">Admin (hidden)</option>}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-gold/10 bg-black/10 p-3 sm:flex-row sm:justify-end">
            <button onClick={() => setShowAdd(false)} className="order-2 rounded border border-gold/20 px-4 py-2 text-xs text-text-dim hover:border-gold/40 hover:text-gold-light sm:order-1">
              Cancel
            </button>
            <button onClick={addMember} className="btn-gold order-1 px-5 py-2 text-xs sm:order-2" disabled={loading}>
              {loading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </div>
      )}

      {/* Member table */}
      <div className="overflow-hidden rounded-lg border border-gold/15 bg-void/65 shadow-xl shadow-black/10">
        <div className="flex items-center justify-between border-b border-gold/10 bg-gold/[0.025] px-4 py-2.5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-dim">Clan Roster</div>
            <div className="mt-0.5 text-xs text-text">{filtered.length} visible {filtered.length === 1 ? 'member' : 'members'}</div>
          </div>
          <div className="text-[9px] font-medium uppercase tracking-wider text-text-dim">
            {isElder ? 'Management enabled' : 'View only'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b border-gold/15 bg-black/10">
                <th className="w-12 px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-text-dim">#</th>
                <th className="min-w-[190px] px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-text-dim">Member</th>
                {isElder && <th className="min-w-[130px] px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-text-dim">Username</th>}
                <th className="min-w-[125px] px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-text-dim">Class</th>
                <th className="w-28 px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-text-dim">Power</th>
                <th className="w-24 px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-text-dim">Coins</th>
                <th className="w-16 px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-text-dim">Att.</th>
                <th className="w-28 px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-text-dim">Role</th>
                {isElder && <th className="w-28 px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-text-dim">Action</th>}
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isElder ? 9 : 7} className="py-12 text-center">
                    <div className="text-2xl opacity-40">⌕</div>
                    <div className="mt-2 text-sm text-text-dim">No members found.</div>
                    {search && (
                      <button onClick={() => setSearch('')} className="mt-2 text-xs text-gold-light hover:text-gold-bright">
                        Clear search
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((m, i) => {
                  const isEditing = editingId === m.id
                  const canRemove = canRemoveMember(m)
                  const canRole = canChangeRole(m)
                  const canReset = canResetPassword(m)
                  const isSelf = m.id === currentUser?.id

                  return (
                    <React.Fragment key={m.id}>
                      <tr className={`group border-b border-gold/10 transition-colors ${isEditing ? 'bg-gold/[0.07]' : 'hover:bg-white/[0.018]'}`}>
                        <td className="px-3 py-2.5 align-middle text-xs font-mono text-text-dim">{String(i + 1).padStart(2, '0')}</td>

                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${classIconTone(m.cls)} ${isSelf ? 'ring-1 ring-gold/40' : ''}`} title={m.cls}>
                              <ClassIcon cls={m.cls} size={31} />
                            </div>
                            <div className="min-w-0">
                              <div className={`truncate font-semibold ${isSelf ? 'text-gold-bright' : 'text-gold-light'}`}>
                                {m.name}
                                {isSelf && <span className="ml-2 rounded border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-gold-bright">You</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {isElder && (
                          <td className="px-3 py-2.5 align-middle font-mono text-[11px] text-text-dim">{m.username}</td>
                        )}

                        <td className="px-3 py-2.5 align-middle">
                          <span className="text-xs text-text-dim">{m.cls}</span>
                        </td>

                        <td className="px-3 py-2.5 text-right align-middle">
                          <span className="font-semibold tabular-nums text-text">{m.power.toLocaleString()}</span>
                        </td>

                        <td className="px-3 py-2.5 text-right align-middle">
                          <span className="font-semibold tabular-nums text-gold-bright">{m.coins.toLocaleString()}</span>
                        </td>

                        <td className="px-3 py-2.5 text-center align-middle">
                          <span className="text-xs font-semibold tabular-nums text-text">{m.attendance}</span>
                        </td>

                        <td className="px-3 py-2.5 text-center align-middle">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold ${roleClass(m.role)}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${roleDot(m.role)}`} />
                            {m.role}
                          </span>
                        </td>

                        {isElder && (
                          <td className="px-3 py-2.5 text-right align-middle">
                            <button
                              onClick={() => isEditing ? closeEditor() : openEditor(m)}
                              className={`rounded border px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                                isEditing
                                  ? 'border-gold/45 bg-gold/15 text-gold-bright'
                                  : 'border-gold/20 text-text-dim hover:border-gold/40 hover:bg-gold/10 hover:text-gold-light'
                              }`}
                            >
                              {isEditing ? '✕ Close' : '⚙ Adjust'}
                            </button>
                          </td>
                        )}
                      </tr>

                      {isEditing && (
                        <tr className="border-b border-gold/10 bg-black/20">
                          <td />
                          <td colSpan={isElder ? 8 : 6} className="px-3 py-3">
                            <div className="rounded-lg border border-gold/20 bg-gold/[0.025]">
                              <div className="flex flex-col gap-1 border-b border-gold/10 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-light">Adjusting {m.name}</div>
                                <div className="text-[9px] text-text-dim">Edit roster values and access</div>
                              </div>

                              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
                                <div>
                                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-gold-light">🪙 Coins</label>
                                  <div className="flex items-center gap-2">
                                    <input type="number" min="0" value={coinInput} onChange={e => setCoinInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdits(m) }} className="input h-9 flex-1 text-right font-mono text-sm" autoFocus />
                                    <span className="whitespace-nowrap text-[9px] text-text-dim">now {m.coins.toLocaleString()}</span>
                                  </div>
                                </div>

                                <div>
                                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-sky-300">⚔ Power</label>
                                  <div className="flex items-center gap-2">
                                    <input type="number" min="0" value={powerInput} onChange={e => setPowerInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdits(m) }} className="input h-9 flex-1 text-right font-mono text-sm" />
                                    <span className="whitespace-nowrap text-[9px] text-text-dim">now {m.power.toLocaleString()}</span>
                                  </div>
                                </div>

                                <div className="flex items-end justify-end gap-2">
                                  <button onClick={() => saveEdits(m)} className="btn-gold h-9 px-4 text-xs">Save Changes</button>
                                  <button onClick={closeEditor} className="h-9 rounded border border-gold/20 px-3 text-xs text-text-dim hover:border-gold/40 hover:text-gold-light">Cancel</button>
                                </div>
                              </div>

                              {(!isSelf && (canRole || canRemove || canReset)) && (
                                <div className="flex flex-wrap items-center gap-2 border-t border-gold/10 px-4 py-3">
                                  <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-text-dim">Role & Access</span>

                                  {canRole && m.role === 'Member' && (
                                    <button onClick={() => changeRole(m.id, 'Elder')} className="rounded border border-sky-500/30 px-2.5 py-1.5 text-[10px] text-sky-300 hover:bg-sky-500/10">↑ Promote to Elder</button>
                                  )}

                                  {canRole && m.role === 'Elder' && (
                                    <>
                                      <button onClick={() => changeRole(m.id, 'Member')} className="rounded border border-yellow-500/30 px-2.5 py-1.5 text-[10px] text-yellow-300 hover:bg-yellow-500/10">↓ Demote to Member</button>
                                      {isMaster && (
                                        <button onClick={() => changeRole(m.id, 'Master')} className="rounded border border-gold/45 px-2.5 py-1.5 text-[10px] text-gold-bright hover:bg-gold/15">★ Promote to Master</button>
                                      )}
                                    </>
                                  )}

                                  {isAdmin && (m.role === 'Member' || m.role === 'Elder' || m.role === 'Master') && (
                                    <button onClick={() => changeRole(m.id, 'Admin')} className="rounded border border-red-500/40 px-2.5 py-1.5 text-[10px] text-red-300 hover:bg-red-500/10">⚠ Make Admin</button>
                                  )}

                                  {isAdmin && m.role === 'Admin' && (
                                    <button onClick={() => changeRole(m.id, 'Master')} className="rounded border border-yellow-500/35 px-2.5 py-1.5 text-[10px] text-yellow-300 hover:bg-yellow-500/10">Demote from Admin</button>
                                  )}

                                  {canReset && (
                                    <button onClick={() => setResetTarget(m)} className="rounded border border-gold/25 px-2.5 py-1.5 text-[10px] text-gold-light hover:bg-gold/10">🔑 Reset Password</button>
                                  )}

                                  {canRemove && (
                                    <button onClick={() => removeMember(m.id)} className="ml-auto rounded border border-red-500/30 px-2.5 py-1.5 text-[10px] text-red-300 hover:bg-red-500/10">✕ Remove Member</button>
                                  )}
                                </div>
                              )}

                              {isSelf && (
                                <div className="border-t border-gold/10 px-4 py-3 text-[9px] leading-relaxed text-text-dim">
                                  You cannot remove or change the role of your own account. Use the dropdown in the top-right to change your own password.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resetTarget && (
        <ResetPasswordModal
          ctx={ctx}
          member={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  )
}
