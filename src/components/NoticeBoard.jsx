import React, { useCallback, useEffect, useMemo, useState } from 'react'

const NOTICE_TYPES = {
  important: { label: 'Important', icon: '!', className: 'text-red-300 border-red-400/20 bg-red-400/[0.06]' },
  war:       { label: 'War',       icon: '⚔', className: 'text-blue-300 border-blue-400/20 bg-blue-400/[0.06]' },
  boss:      { label: 'Boss',      icon: '👾', className: 'text-red-300 border-red-400/20 bg-red-400/[0.06]' },
  auction:   { label: 'Auction',   icon: '◇', className: 'text-gold-light border-gold/20 bg-gold/[0.055]' },
  event:     { label: 'Event',     icon: '◷', className: 'text-purple-300 border-purple-400/20 bg-purple-400/[0.06]' },
  general:   { label: 'General',   icon: '•', className: 'text-text-dim border-white/[0.09] bg-white/[0.025]' },
}

const STAFF_ROLES = new Set(['Admin', 'Master', 'Elder'])

function canManageNotices(user) {
  return STAFF_ROLES.has(user?.role)
}

function normalizeNotice(row) {
  return {
    id: row.id,
    title: row.title || 'Untitled Notice',
    content: row.content || '',
    type: row.type || 'general',
    pinned: Boolean(row.pinned),
    authorId: row.created_by ?? row.createdBy ?? null,
    authorName: row.created_by_name ?? row.createdByName ?? 'Clan Staff',
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  }
}

function formatNoticeDate(value) {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function NoticeTypeBadge({ type }) {
  const meta = NOTICE_TYPES[type] || NOTICE_TYPES.general
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] ${meta.className}`}>
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  )
}

export function ClanNoticePreview({ ctx, onOpenAll }) {
  const { supabase, currentUser } = ctx
  const canManage = canManageNotices(currentUser)
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('clan_notices')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(2)

      if (error) throw error
      setNotices((data || []).map(normalizeNotice))
    } catch (error) {
      // The dashboard should never fail just because the optional notice table
      // has not been created yet.
      console.warn('Clan notices unavailable:', error?.message || error)
      setNotices([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  if (!loading && notices.length === 0) return null

  return (
    <section aria-label="Clan Notice Board" className="relative min-w-0">
      <div className="mb-4 flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex min-w-0 items-center gap-2.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-bright shadow-[0_0_8px_rgba(242,204,96,0.65)]" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-dim">Clan</span>
          </div>
          <h2 className="font-spectral text-[1.9rem] font-bold leading-none text-text-bright sm:text-[2.15rem]">Notice Board</h2>
        </div>
        <button
          type="button"
          onClick={onOpenAll}
          className="shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-dim transition-colors hover:bg-white/[0.035] hover:text-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
        >
          View All <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#050504]/96 shadow-[0_16px_42px_rgba(0,0,0,0.38)] backdrop-blur-[2px]">
        {loading ? (
          <div className="flex min-h-[112px] items-center justify-center bg-[#050504]/95 px-5 text-center">
            <div>
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-gold/15 bg-gold/[0.035] font-spectral text-xl text-gold-light/70">
                •
              </div>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-dim">
                Loading Notices
              </div>
            </div>
          </div>
        ) : notices.length === 0 ? (
          <button
            type="button"
            onClick={onOpenAll}
            className="group flex min-h-[238px] w-full items-center justify-center px-6 text-center transition-colors hover:bg-white/[0.018] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold/60"
          >
            <span>
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-gold/15 bg-gold/[0.035] font-spectral text-2xl text-gold-light/60 transition-colors group-hover:border-gold/30 group-hover:text-gold-light">
                +
              </span>
              <span className="mt-3 block text-[13px] font-semibold text-text-bright/95 group-hover:text-gold-light">
                No Active Notices
              </span>
              <span className="mt-1 block text-[10px] leading-relaxed text-text-dim">
                {canManage ? 'Publish a clan announcement from the Notice Board.' : 'Clan announcements will appear here.'}
              </span>
              <span className="mt-3 inline-flex rounded-lg border border-white/[0.07] bg-white/[0.018] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.13em] text-text-dim group-hover:border-gold/20 group-hover:text-gold-light">
                Open Notice Board →
              </span>
            </span>
          </button>
        ) : (
          <div className="divide-y divide-white/[0.055]">
            {notices.map(notice => {
              const meta = NOTICE_TYPES[notice.type] || NOTICE_TYPES.general
              return (
                <button

                  key={notice.id}

                  type="button"

                  onClick={onOpenAll}

                  className="group relative flex min-h-[124px] w-full min-w-0 items-start gap-4 bg-[#050504]/94 px-5 py-4 text-left transition-colors hover:bg-[#0b0a08]/98 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold/60 sm:px-6"

                >

                  <span

                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-black/35 text-[13px]"

                    style={{
                      color: meta.className.includes('red') ? '#fca5a5' : '#ead9b8',
                      
                                            borderColor: meta.className.includes('red') ? 'rgba(248,113,113,0.28)' : 'rgba(255,255,255,0.14)',
                    }}

                  >

                    {meta.icon}

                  </span>


                  <span className="min-w-0 flex-1 pr-2">

                    <span className="flex min-w-0 items-center gap-2.5">

                      <span className="min-w-0 truncate text-[14px] font-semibold leading-5 text-[#f1e7d3] group-hover:text-gold-light">

                        {notice.title}

                      </span>

                      {notice.pinned && (

                        <span className="shrink-0 rounded-sm text-[9px] font-bold uppercase tracking-[0.08em] text-gold-bright" title="Pinned">

                          PIN

                        </span>

                      )}

                    </span>


                    <span className="mt-1.5 block line-clamp-2 text-[11px] font-medium leading-[1.55] text-[#b9ad98]">

                      {notice.content}

                    </span>


                    <span className="mt-2.5 block text-[9px] font-medium leading-none text-[#766d60]">

                      {notice.authorName} <span className="px-1 text-[#4e493f]">·</span> {formatNoticeDate(notice.createdAt)}

                    </span>

                  </span>


                  <span className="shrink-0 pt-0.5">

                    <NoticeTypeBadge type={notice.type} />

                  </span>

                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default function NoticeBoard({ ctx }) {
  const { supabase, currentUser, addToast, logAudit } = ctx
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState('')
  const [filter, setFilter] = useState('all')
  const [showEditor, setShowEditor] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'general',
    pinned: false,
  })

  const canManage = canManageNotices(currentUser)

  const loadNotices = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clan_notices')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      setNotices((data || []).map(normalizeNotice))
      setDbError('')
    } catch (error) {
      console.error('Failed to load clan notices:', error)
      setDbError(error?.message || 'Could not load the Notice Board.')
      setNotices([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadNotices()
  }, [loadNotices])

  const filteredNotices = useMemo(
    () => filter === 'all' ? notices : notices.filter(n => n.type === filter),
    [filter, notices]
  )

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', content: '', type: 'general', pinned: false })
    setShowEditor(true)
  }

  const openEdit = (notice) => {
    setEditing(notice)
    setForm({
      title: notice.title,
      content: notice.content,
      type: notice.type,
      pinned: notice.pinned,
    })
    setShowEditor(true)
  }

  const closeEditor = () => {
    if (saving) return
    setShowEditor(false)
    setEditing(null)
  }

  const saveNotice = async (event) => {
    event.preventDefault()
    if (!canManage || !form.title.trim() || !form.content.trim() || saving) return

    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        pinned: Boolean(form.pinned),
        updated_at: new Date().toISOString(),
      }

      let result
      if (editing) {
        result = await supabase
          .from('clan_notices')
          .update(payload)
          .eq('id', editing.id)
          .select()
          .single()
      } else {
        result = await supabase
          .from('clan_notices')
          .insert([{
            ...payload,
            created_by: currentUser?.id ?? null,
            created_by_name: currentUser?.name || 'Clan Staff',
          }])
          .select()
          .single()
      }

      if (result.error) throw result.error

      const saved = normalizeNotice(result.data)
      setNotices(prev => {
        const next = editing
          ? prev.map(n => n.id === saved.id ? saved : n)
          : [saved, ...prev]
        return next.sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt))
      })

      await logAudit?.({
        action: editing ? 'Updated Notice' : 'Created Notice',
        entityType: 'Notice',
        entityId: saved.id,
        details: { title: saved.title, type: saved.type, pinned: saved.pinned },
      })

      addToast(
        editing ? 'Notice updated successfully.' : 'Notice published successfully.',
        'gold',
        editing ? 'Notice Updated' : 'Notice Published'
      )
      closeEditor()
    } catch (error) {
      console.error('Failed to save notice:', error)
      addToast(error?.message || 'Failed to save notice.', 'red', 'Notice Error')
    } finally {
      setSaving(false)
    }
  }

  const deleteNotice = async (notice) => {
    if (!canManage) return
    if (!window.confirm(`Delete "${notice.title}"? This cannot be undone.`)) return

    try {
      const { error } = await supabase.from('clan_notices').delete().eq('id', notice.id)
      if (error) throw error

      setNotices(prev => prev.filter(n => n.id !== notice.id))
      await logAudit?.({
        action: 'Deleted Notice',
        entityType: 'Notice',
        entityId: notice.id,
        details: { title: notice.title, type: notice.type },
      })
      addToast('Notice deleted.', 'blue', 'Notice Board')
    } catch (error) {
      console.error('Failed to delete notice:', error)
      addToast(error?.message || 'Failed to delete notice.', 'red', 'Notice Error')
    }
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 pb-10">
      <section className="relative overflow-hidden rounded-2xl border border-gold/20 bg-[#0b0a09]/90 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <div className="relative p-4 sm:p-5 md:p-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_10px_rgba(242,204,96,0.8)]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-dim">Clan communication</span>
            </div>
            <h1 className="font-spectral text-2xl font-bold text-text-bright sm:text-3xl">Clan Notice Board</h1>
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-text-dim sm:text-sm">
              Important announcements, battle reminders, boss schedules, and clan updates in one place.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="shrink-0 rounded-lg border border-gold/35 bg-gold/[0.08] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gold-bright transition-all hover:border-gold/55 hover:bg-gold/[0.13] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
            >
              + New Notice
            </button>
          )}
        </div>
      </section>

      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All <span>{notices.length}</span></FilterButton>
        {Object.entries(NOTICE_TYPES).map(([key, meta]) => {
          const count = notices.filter(n => n.type === key).length
          if (count === 0 && filter !== key) return null
          return <FilterButton key={key} active={filter === key} onClick={() => setFilter(key)}>{meta.label} <span>{count}</span></FilterButton>
        })}
      </div>

      {dbError && (
        <section className="rounded-xl border border-red-400/20 bg-red-400/[0.04] px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-300">Notice Board database not ready</div>
          <p className="mt-1 text-[10px] leading-relaxed text-text-dim">
            The UI is installed, but the <code className="text-gold-light">clan_notices</code> table is missing or inaccessible. Run the supplied SQL setup once in Supabase.
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#090807]/80">
        {loading ? (
          <div className="px-4 py-12 text-center text-[11px] text-text-dim">Loading notices…</div>
        ) : filteredNotices.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <div className="text-3xl opacity-50">📜</div>
            <div className="mt-3 text-sm font-semibold text-text-bright">No notices yet</div>
            <div className="mt-1 text-[10px] text-text-dim">
              {canManage ? 'Create the first clan notice above.' : 'There are no current clan announcements.'}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.055]">
            {filteredNotices.map(notice => (
              <NoticeRow
                key={notice.id}
                notice={notice}
                canManage={canManage}
                onEdit={openEdit}
                onDelete={deleteNotice}
              />
            ))}
          </div>
        )}
      </section>

      {showEditor && (
        <NoticeEditor
          form={form}
          setForm={setForm}
          editing={editing}
          saving={saving}
          onSave={saveNotice}
          onClose={closeEditor}
        />
      )}
    </div>
  )
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] transition-colors ${
        active
          ? 'border-gold/35 bg-gold/[0.08] text-gold-bright'
          : 'border-white/[0.07] bg-white/[0.015] text-text-dim hover:border-gold/20 hover:text-gold-light'
      }`}
    >
      {children}
    </button>
  )
}

function NoticeRow({ notice, canManage, onEdit, onDelete }) {
  const meta = NOTICE_TYPES[notice.type] || NOTICE_TYPES.general
  return (
    <article className="group relative px-4 py-4 sm:px-5 sm:py-4.5">
      <div className="flex min-w-0 items-start gap-3.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm ${meta.className}`}>
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <NoticeTypeBadge type={notice.type} />
            {notice.pinned && <span className="rounded-full border border-gold/20 bg-gold/[0.045] px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-gold-light">Pinned</span>}
          </div>
          <h2 className="mt-1.5 text-[14px] font-semibold text-text-bright sm:text-[15px]">{notice.title}</h2>
          <p className="mt-1 whitespace-pre-wrap text-[10px] leading-relaxed text-text-dim sm:text-[11px]">{notice.content}</p>
          <div className="mt-2 text-[8px] text-text-dim/70">
            {notice.authorName} · {formatNoticeDate(notice.createdAt)}
            {notice.updatedAt && ' · edited'}
          </div>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
            <button type="button" onClick={() => onEdit(notice)} className="rounded-md border border-white/[0.07] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-text-dim hover:border-gold/20 hover:text-gold-light">Edit</button>
            <button type="button" onClick={() => onDelete(notice)} className="rounded-md border border-red-400/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-text-dim hover:border-red-400/25 hover:text-red-300">Delete</button>
          </div>
        )}
      </div>
    </article>
  )
}

function NoticeEditor({ form, setForm, editing, saving, onSave, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-gold/25 bg-[#0d0c0a] shadow-[0_24px_90px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold-dim">Clan Communication</div>
            <h2 className="mt-1 font-spectral text-lg font-bold text-text-bright">{editing ? 'Edit Notice' : 'New Notice'}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg px-2 py-1 text-text-dim hover:bg-white/[0.04] hover:text-gold-light">✕</button>
        </div>

        <form onSubmit={onSave} className="space-y-4 p-4 sm:p-5">
          <div>
            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-text-dim">Title</label>
            <input
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              maxLength={100}
              required
              placeholder="e.g. Server Battle Tomorrow"
              className="w-full rounded-lg border border-white/[0.09] bg-black/30 px-3 py-2.5 text-sm text-text-bright outline-none placeholder:text-text-dim/40 focus:border-gold/35"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-text-dim">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.09] bg-[#11100e] px-3 py-2.5 text-sm text-text-bright outline-none focus:border-gold/35"
              >
                {Object.entries(NOTICE_TYPES).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
              </select>
            </div>
            <label className="flex cursor-pointer items-end gap-2.5 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={e => setForm(prev => ({ ...prev, pinned: e.target.checked }))}
                className="h-4 w-4 accent-yellow-400"
              />
              <span>
                <span className="block text-[10px] font-semibold text-text-bright">Pin notice</span>
                <span className="block text-[8px] text-text-dim">Keep it above newer notices.</span>
              </span>
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-text-dim">Message</label>
            <textarea
              value={form.content}
              onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
              maxLength={2000}
              required
              rows={6}
              placeholder="Write the announcement for the clan…"
              className="w-full resize-y rounded-lg border border-white/[0.09] bg-black/30 px-3 py-2.5 text-sm leading-relaxed text-text-bright outline-none placeholder:text-text-dim/40 focus:border-gold/35"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-3">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-text-dim hover:text-text-bright">Cancel</button>
            <button type="submit" disabled={saving || !form.title.trim() || !form.content.trim()} className="rounded-lg border border-gold/35 bg-gold/[0.09] px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-gold-bright hover:bg-gold/[0.14] disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Publish Notice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
