import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const NOTICE_TYPES = {
  important: { label: 'Important', icon: '!', className: 'text-red-300 border-red-400/20 bg-red-400/[0.06]' },
  war:       { label: 'War',       icon: '⚔', className: 'text-blue-300 border-blue-400/20 bg-blue-400/[0.06]' },
  boss:      { label: 'Boss',      icon: '👾', className: 'text-red-300 border-red-400/20 bg-red-400/[0.06]' },
  auction:   { label: 'Auction',   icon: '◇', className: 'text-gold-light border-gold/20 bg-gold/[0.055]' },
  event:     { label: 'Event',     icon: '◷', className: 'text-purple-300 border-purple-400/20 bg-purple-400/[0.06]' },
  general:   { label: 'General',   icon: '•', className: 'text-text-dim border-white/[0.09] bg-white/[0.025]' },
}

const STAFF_ROLES = new Set(['Admin', 'Master', 'Elder'])

const EMOJIS = [
  '😀', '😎', '😂', '🤣', '😈', '🤝', '👍', '👎',
  '🔥', '⚔️', '🛡️', '👑', '💀', '☠️', '🎯', '🏆',
  '💰', '🎁', '⭐', '💎', '🐉', '🐺', '🦅', '👹',
  '👻', '⚡', '❗', '❓', '📢', '📌', '🚨', '💥',
]

const TOOLBAR = [
  { command: 'bold', label: 'B', title: 'Bold', className: 'font-black' },
  { command: 'italic', label: 'I', title: 'Italic', className: 'italic' },
  { command: 'underline', label: 'U', title: 'Underline', className: 'underline' },
  { command: 'strikeThrough', label: 'S', title: 'Strikethrough', className: 'line-through' },
]

const FONT_SIZES = [
  { value: 'small', label: 'Small', px: 12 },
  { value: 'normal', label: 'Normal', px: 14 },
  { value: 'large', label: 'Large', px: 17 },
  { value: 'xl', label: 'Extra Large', px: 21 },
]

const FONT_COLORS = [
  { value: 'default', label: 'Default', hex: '#f1e7d3' },
  { value: 'gold', label: 'Gold', hex: '#f2cc60' },
  { value: 'white', label: 'White', hex: '#ffffff' },
  { value: 'red', label: 'Red', hex: '#f87171' },
  { value: 'orange', label: 'Orange', hex: '#fb923c' },
  { value: 'blue', label: 'Blue', hex: '#60a5fa' },
  { value: 'cyan', label: 'Cyan', hex: '#67e8f9' },
  { value: 'green', label: 'Green', hex: '#86efac' },
  { value: 'purple', label: 'Purple', hex: '#c4b5fd' },
]

const FONT_SIZE_TO_EXEC = {
  small: '2',
  normal: '3',
  large: '5',
  xl: '7',
}

const EXEC_TO_CLASS = {
  '1': 'notice-size-small',
  '2': 'notice-size-small',
  '3': 'notice-size-normal',
  '4': 'notice-size-large',
  '5': 'notice-size-large',
  '6': 'notice-size-xl',
  '7': 'notice-size-xl',
}

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function plainTextToHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>')
}

function sanitizeNoticeHtml(value) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return plainTextToHtml(value)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(String(value ?? ''), 'text/html')

  const allowedTags = new Set([
    'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE',
    'BR', 'P', 'DIV', 'H1', 'H2', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'SPAN', 'FONT',
  ])

  const allowedSizeClasses = new Set([
    'notice-size-small',
    'notice-size-normal',
    'notice-size-large',
    'notice-size-xl',
  ])

  const allowedColorClasses = new Set([
    'notice-color-default',
    'notice-color-gold',
    'notice-color-white',
    'notice-color-red',
    'notice-color-orange',
    'notice-color-blue',
    'notice-color-cyan',
    'notice-color-green',
    'notice-color-purple',
  ])

  const paletteByHex = Object.fromEntries(
    FONT_COLORS.map(color => [color.hex.toLowerCase(), color.value])
  )

  const colorToClass = colorValue => {
    const raw = String(colorValue || '').trim().toLowerCase()
    if (!raw) return ''

    if (paletteByHex[raw]) {
      return `notice-color-${paletteByHex[raw]}`
    }

    const rgbMatch = raw.match(
      /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/
    )

    if (!rgbMatch) return ''

    const rgbHex = `#${[rgbMatch[1], rgbMatch[2], rgbMatch[3]]
      .map(v => Math.min(255, Number(v)).toString(16).padStart(2, '0'))
      .join('')}`

    return paletteByHex[rgbHex] ? `notice-color-${paletteByHex[rgbHex]}` : ''
  }

  const styleColorToClass = styleValue => {
    if (!styleValue) return ''
    return colorToClass(styleValue)
  }

  const sanitizeNode = node => {
    if (node.nodeType === Node.TEXT_NODE) return

    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove()
      return
    }

    const element = node
    const tag = element.tagName

    // Remove unsafe/unknown elements but keep their text/content.
    if (!allowedTags.has(tag)) {
      const fragment = doc.createDocumentFragment()
      while (element.firstChild) {
        fragment.appendChild(element.firstChild)
      }
      element.replaceWith(fragment)
      return
    }

    // Rich formatting generated by contentEditable/execCommand is often
    // represented as <font size="..."> or <font color="...">. Convert those
    // to our stable classes before recursively cleaning children.
    if (tag === 'FONT') {
      const sizeValue = element.getAttribute('size')
      const colorValue =
        element.getAttribute('color') ||
        element.style?.color ||
        ''

      const sizeClass = EXEC_TO_CLASS[sizeValue] || ''
      const colorClass = colorToClass(colorValue)

      const span = doc.createElement('span')
      const classes = [sizeClass, colorClass].filter(Boolean)
      if (classes.length) span.setAttribute('class', classes.join(' '))

      while (element.firstChild) {
        span.appendChild(element.firstChild)
      }

      element.replaceWith(span)
      sanitizeNode(span)
      return
    }

    if (tag === 'SPAN') {
      const rawClass = element.getAttribute('class') || ''
      const safeClasses = rawClass
        .split(/\s+/)
        .filter(Boolean)
        .filter(name =>
          allowedSizeClasses.has(name) ||
          allowedColorClasses.has(name)
        )

      // Some browsers produce inline style="color: rgb(...)" rather than a
      // class. Convert only colors from our predefined palette.
      const inlineColorClass = styleColorToClass(element.style?.color)
      if (inlineColorClass && !safeClasses.some(name => allowedColorClasses.has(name))) {
        safeClasses.push(inlineColorClass)
      }

      // Keep only our controlled classes; strip all arbitrary attributes.
      Array.from(element.attributes).forEach(attribute => {
        element.removeAttribute(attribute.name)
      })

      if (safeClasses.length) {
        element.setAttribute('class', Array.from(new Set(safeClasses)).join(' '))
      }
    } else {
      Array.from(element.attributes).forEach(attribute => {
        element.removeAttribute(attribute.name)
      })
    }

    // IMPORTANT: recurse after conversions. This prevents nested font tags
    // from losing their formatting during a second save/edit cycle.
    Array.from(element.childNodes).forEach(sanitizeNode)
  }

  Array.from(doc.body.childNodes).forEach(sanitizeNode)
  return doc.body.innerHTML
}

function contentToEditorHtml(value) {
  if (!value) return ''
  const stringValue = String(value)
  return /<[a-z][\s\S]*>/i.test(stringValue)
    ? sanitizeNoticeHtml(stringValue)
    : plainTextToHtml(stringValue)
}

function htmlToPlainText(value) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return String(value ?? '').replace(/<[^>]*>/g, ' ')
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(String(value ?? ''), 'text/html')
  return doc.body.textContent || ''
}

function hasMeaningfulContent(html) {
  return htmlToPlainText(html).replace(/\u00a0/g, ' ').trim().length > 0
}

function execEditorCommand(command, value = null) {
  try {
    document.execCommand(command, false, value)
  } catch (error) {
    console.warn(`Editor command "${command}" failed:`, error)
  }
}

function saveSelection() {
  if (typeof window === 'undefined' || !window.getSelection) return null
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  return selection.getRangeAt(0).cloneRange()
}

function restoreSelection(range) {
  if (!range || typeof window === 'undefined' || !window.getSelection) return
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

const noticeStyle = `
.notice-rich-content p,
.notice-rich-content div { margin: 0.2rem 0; }
.notice-rich-content b,
.notice-rich-content strong { font-weight: 900 !important; color: #f1e7d3; }
.notice-rich-content i,
.notice-rich-content em { font-style: italic !important; }
.notice-rich-content u { text-decoration: underline !important; text-underline-offset: 2px; }
.notice-rich-content s,
.notice-rich-content strike { text-decoration: line-through !important; }
.notice-rich-content h1,
.notice-rich-content h2 { margin: 0.35rem 0; font-weight: 800; color: #f1e7d3; }
.notice-rich-content h1 { font-size: 1.08em; }
.notice-rich-content h2 { font-size: 1.02em; }
.notice-rich-content .notice-size-small { font-size: 12px; line-height: 1.55; }
.notice-rich-content .notice-size-normal { font-size: 14px; line-height: 1.55; }
.notice-rich-content .notice-size-large { font-size: 17px; line-height: 1.5; }
.notice-rich-content .notice-size-xl { font-size: 21px; line-height: 1.4; }
.notice-color-default { color: #f1e7d3; }
.notice-color-gold { color: #f2cc60; }
.notice-color-white { color: #ffffff; }
.notice-color-red { color: #f87171; }
.notice-color-orange { color: #fb923c; }
.notice-color-blue { color: #60a5fa; }
.notice-color-cyan { color: #67e8f9; }
.notice-color-green { color: #86efac; }
.notice-color-purple { color: #c4b5fd; }
.notice-rich-content ul,
.notice-rich-content ol { margin: 0.35rem 0; padding-left: 1.35rem; }
.notice-rich-content ul { list-style: disc; }
.notice-rich-content ol { list-style: decimal; }
.notice-rich-content li { margin: 0.12rem 0; }
.notice-rich-content blockquote {
  margin: 0.4rem 0;
  padding-left: 0.75rem;
  border-left: 2px solid rgba(242,204,96,0.35);
  color: #c9bca6;
  font-style: italic;
}
.notice-rich-content .notice-size-small { font-size: 12px; }
.notice-rich-content .notice-size-normal { font-size: 14px; }
.notice-rich-content .notice-size-large { font-size: 18px; }
.notice-rich-content .notice-size-xl { font-size: 24px; font-weight: 800; color: #f1e7d3; }

.notice-editor p,
.notice-editor div { margin: 0.2rem 0; }
.notice-editor b,
.notice-editor strong { font-weight: 900 !important; color: #f1e7d3; }
.notice-editor i,
.notice-editor em { font-style: italic !important; }
.notice-editor u { text-decoration: underline !important; text-underline-offset: 2px; }
.notice-editor s,
.notice-editor strike { text-decoration: line-through !important; }
.notice-editor h1,
.notice-editor h2 { margin: 0.35rem 0; color: #f1e7d3; font-weight: 800; }
.notice-editor h1 { font-size: 1.15em; }
.notice-editor h2 { font-size: 1.05em; }
.notice-editor .notice-size-small { font-size: 12px; line-height: 1.55; }
.notice-editor .notice-size-normal { font-size: 14px; line-height: 1.55; }
.notice-editor .notice-size-large { font-size: 17px; line-height: 1.5; }
.notice-editor .notice-size-xl { font-size: 21px; line-height: 1.4; }
.notice-editor ul,
.notice-editor ol { margin: 0.35rem 0; padding-left: 1.35rem; }
.notice-editor ul { list-style: disc; }
.notice-editor ol { list-style: decimal; }
.notice-editor li { margin: 0.12rem 0; }
.notice-editor blockquote {
  margin: 0.4rem 0;
  padding-left: 0.75rem;
  border-left: 2px solid rgba(242,204,96,0.35);
  color: #c9bca6;
  font-style: italic;
}
.notice-editor:focus { outline: none; }
`

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
    <>
      <style>{noticeStyle}</style>
      <section aria-label="Clan Notice Board" className="relative min-w-0">
      <div className="mb-4 flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_8px_rgba(242,204,96,0.65)]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-dim">Clan</span>
          </div>
          <h2 className="font-spectral text-[1.9rem] font-bold leading-none text-text-bright sm:text-[2.15rem]">
            Notice Board
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenAll}
          className="shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-dim hover:bg-white/[0.035] hover:text-gold-bright"
        >
          View All <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#050504]/96 shadow-[0_16px_42px_rgba(0,0,0,0.38)]">
        {loading ? (
          <div className="flex min-h-[112px] items-center justify-center px-5 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-dim">
              Loading Notices
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.055]">
            {notices.map(notice => {
              const meta = NOTICE_TYPES[notice.type] || NOTICE_TYPES.general
              return (
                <button
                  key={notice.id}
                  type="button"
                  onClick={onOpenAll}
                  className="group relative flex min-h-[124px] w-full min-w-0 items-start gap-4 bg-[#050504]/94 px-5 py-4 text-left hover:bg-[#0b0a08]/98 sm:px-6"
                >
                  <span
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-black/35 text-[13px]"
                    style={{
                      color: meta.className.includes('red') ? '#fca5a5' : '#ead9b8',
                      borderColor: meta.className.includes('red')
                        ? 'rgba(248,113,113,0.28)'
                        : 'rgba(255,255,255,0.14)',
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
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] text-gold-bright">
                          PIN
                        </span>
                      )}
                    </span>

                    <span
                      className="notice-rich-content mt-1.5 block line-clamp-3 text-[11px] font-medium leading-[1.55] text-[#b9ad98]"
                      dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(contentToEditorHtml(notice.content)) }}
                    />

                    <span className="mt-2.5 block text-[9px] font-medium text-[#766d60]">
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
    </>
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
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'general',
    pinned: false,
  })

  const canManage = canManageNotices(currentUser)

  const loadNotices = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('clan_notices')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      setNotices((data || []).map(normalizeNotice))
      setSelectedIds([])
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

  const visibleIds = useMemo(
    () => filteredNotices.map(notice => notice.id).filter(Boolean),
    [filteredNotices]
  )

  const allVisibleSelected =
    canManage &&
    visibleIds.length > 0 &&
    visibleIds.every(id => selectedIds.includes(id))

  const toggleNoticeSelection = id => {
    if (!canManage || deleting || !id) return
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (!canManage || deleting || visibleIds.length === 0) return

    setSelectedIds(prev => {
      if (visibleIds.every(id => prev.includes(id))) {
        return prev.filter(id => !visibleIds.includes(id))
      }
      return Array.from(new Set([...prev, ...visibleIds]))
    })
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', content: '', type: 'general', pinned: false })
    setShowEditor(true)
  }

  const openEdit = notice => {
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

  const saveNotice = async event => {
    event.preventDefault()
    if (!canManage || !form.title.trim() || saving) return

    const editor = event.currentTarget.querySelector('[data-notice-editor="true"]')
    const cleanHtml = sanitizeNoticeHtml(editor?.innerHTML || '')

    if (!hasMeaningfulContent(cleanHtml)) {
      addToast?.('Write a message before saving the notice.', 'red', 'Notice Error')
      return
    }

    if (htmlToPlainText(cleanHtml).length > 2000) {
      addToast?.('Notice message is limited to 2,000 characters.', 'red', 'Notice Error')
      return
    }

    setSaving(true)

    try {
      const payload = {
        title: form.title.trim(),
        content: cleanHtml,
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

        return next.sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            new Date(b.createdAt) - new Date(a.createdAt)
        )
      })

      await logAudit?.({
        action: editing ? 'Updated Notice' : 'Created Notice',
        entityType: 'Notice',
        entityId: saved.id,
        details: {
          title: saved.title,
          type: saved.type,
          pinned: saved.pinned,
          formatting: 'Rich text',
        },
      })

      addToast?.(
        editing ? 'Notice updated successfully.' : 'Notice published successfully.',
        'gold',
        editing ? 'Notice Updated' : 'Notice Published'
      )

      closeEditor()
    } catch (error) {
      console.error('Failed to save notice:', error)
      addToast?.(error?.message || 'Failed to save notice.', 'red', 'Notice Error')
    } finally {
      setSaving(false)
    }
  }

  const deleteNotice = async notice => {
    if (!canManage || deleting) return
    if (!window.confirm(`Delete "${notice.title}"? This cannot be undone.`)) return

    setDeleting(true)

    try {
      const { error } = await supabase
        .from('clan_notices')
        .delete()
        .eq('id', notice.id)

      if (error) throw error

      setNotices(prev => prev.filter(n => n.id !== notice.id))
      setSelectedIds(prev => prev.filter(id => id !== notice.id))

      await logAudit?.({
        action: 'Deleted Notice',
        entityType: 'Notice',
        entityId: notice.id,
        details: { title: notice.title, type: notice.type },
      })

      addToast?.('Notice deleted.', 'blue', 'Notice Board')
    } catch (error) {
      console.error('Failed to delete notice:', error)
      addToast?.(error?.message || 'Failed to delete notice.', 'red', 'Notice Error')
    } finally {
      setDeleting(false)
    }
  }

  const deleteSelected = async () => {
    if (!canManage || !supabase || selectedIds.length === 0 || deleting) return

    const selectedNotices = notices.filter(notice => selectedIds.includes(notice.id))
    const preview = selectedNotices.slice(0, 3).map(notice => `• ${notice.title}`).join('\n')
    const extra = selectedNotices.length > 3
      ? `\n• +${selectedNotices.length - 3} more`
      : ''

    if (!window.confirm(
      `Delete ${selectedIds.length} selected notice${selectedIds.length === 1 ? '' : 's'}?\n\n${preview}${extra}\n\nThis cannot be undone.`
    )) return

    setDeleting(true)

    try {
      const { error } = await supabase
        .from('clan_notices')
        .delete()
        .in('id', selectedIds)

      if (error) throw error

      setNotices(prev => prev.filter(notice => !selectedIds.includes(notice.id)))
      setSelectedIds([])

      await logAudit?.({
        action: 'Deleted Notices',
        entityType: 'Notice',
        entityId: null,
        details: {
          count: selectedIds.length,
          titles: selectedNotices.map(notice => notice.title),
          type: 'Bulk Delete',
        },
      })

      addToast?.(
        `${selectedIds.length} notice${selectedIds.length === 1 ? '' : 's'} deleted.`,
        'blue',
        'Notice Board'
      )
    } catch (error) {
      console.error('Failed to delete selected notices:', error)
      addToast?.(error?.message || 'Failed to delete selected notices.', 'red', 'Notice Error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <style>{noticeStyle}</style>

      <div className="w-full min-w-0 max-w-full space-y-5 pb-10">
        <section className="relative overflow-hidden rounded-2xl border border-gold/20 bg-[#0b0a09]/90 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

          <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5 md:p-6">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-bright shadow-[0_0_10px_rgba(242,204,96,0.8)]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-dim">
                  Clan communication
                </span>
              </div>

              <h1 className="font-spectral text-2xl font-bold text-text-bright sm:text-3xl">
                Clan Notice Board
              </h1>

              <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-text-dim sm:text-sm">
                Important announcements, battle reminders, boss schedules, and clan updates in one place.
              </p>
            </div>

            {canManage && (
              <button
                type="button"
                onClick={openCreate}
                className="shrink-0 rounded-lg border border-gold/35 bg-gold/[0.08] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gold-bright hover:border-gold/55 hover:bg-gold/[0.13]"
              >
                + New Notice
              </button>
            )}
          </div>
        </section>

        <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            All <span>{notices.length}</span>
          </FilterButton>

          {Object.entries(NOTICE_TYPES).map(([key, meta]) => {
            const count = notices.filter(n => n.type === key).length
            if (count === 0 && filter !== key) return null

            return (
              <FilterButton
                key={key}
                active={filter === key}
                onClick={() => setFilter(key)}
              >
                {meta.label} <span>{count}</span>
              </FilterButton>
            )
          })}
        </div>

        {canManage && notices.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-[#090807]/80 px-3 py-2.5">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={deleting || visibleIds.length === 0}
              className="rounded-lg border border-gold/15 bg-gold/[0.035] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-gold-light hover:border-gold/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {allVisibleSelected ? 'Deselect All' : 'Select All'}
            </button>

            <span className="text-[9px] text-text-dim">
              {selectedIds.length} selected · {filteredNotices.length} shown
            </span>

            <button
              type="button"
              onClick={deleteSelected}
              disabled={deleting || selectedIds.length === 0}
              className="ml-auto rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-red-300 hover:border-red-400/40 hover:bg-red-400/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {deleting ? 'Deleting…' : `Delete Selected${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
            </button>
          </div>
        )}

        {dbError && (
          <section className="rounded-xl border border-red-400/20 bg-red-400/[0.04] px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-300">
              Notice Board database not ready
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-text-dim">
              The UI is installed, but the <code className="text-gold-light">clan_notices</code> table is missing or inaccessible. Run the supplied SQL setup once in Supabase.
            </p>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#090807]/80">
          {loading ? (
            <div className="px-4 py-12 text-center text-[11px] text-text-dim">
              Loading notices…
            </div>
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
                  selected={selectedIds.includes(notice.id)}
                  onToggleSelect={toggleNoticeSelection}
                  deleting={deleting}
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
    </>
  )
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
        active
          ? 'border-gold/35 bg-gold/[0.08] text-gold-bright'
          : 'border-white/[0.07] bg-white/[0.015] text-text-dim hover:border-gold/20 hover:text-gold-light'
      }`}
    >
      {children}
    </button>
  )
}

function NoticeRow({
  notice,
  canManage,
  selected,
  onToggleSelect,
  deleting,
  onEdit,
  onDelete,
}) {
  const meta = NOTICE_TYPES[notice.type] || NOTICE_TYPES.general

  return (
    <article className={`group relative px-4 py-4 sm:px-5 sm:py-4.5 ${selected ? 'bg-gold/[0.025]' : ''}`}>
      <div className="flex min-w-0 items-start gap-3.5">
        {canManage && (
          <label className="flex shrink-0 items-center pt-3" title="Select notice">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.(notice.id)}
              disabled={deleting}
              className="h-3.5 w-3.5 accent-yellow-500"
              aria-label={`Select notice ${notice.title}`}
            />
          </label>
        )}

        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm ${meta.className}`}>
          {meta.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <NoticeTypeBadge type={notice.type} />

            {notice.pinned && (
              <span className="rounded-full border border-gold/20 bg-gold/[0.045] px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-gold-light">
                Pinned
              </span>
            )}
          </div>

          <h2 className="mt-1.5 text-[14px] font-semibold text-text-bright sm:text-[15px]">
            {notice.title}
          </h2>

          <div
            className="notice-rich-content mt-1 text-[10px] leading-relaxed text-text-dim sm:text-[11px]"
            dangerouslySetInnerHTML={{
              __html: sanitizeNoticeHtml(contentToEditorHtml(notice.content)),
            }}
          />

          <div className="mt-2 text-[8px] text-text-dim/70">
            {notice.authorName} · {formatNoticeDate(notice.createdAt)}
            {notice.updatedAt && ' · edited'}
          </div>
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onEdit(notice)}
              disabled={deleting}
              className="rounded-md border border-white/[0.07] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-40"
            >
              Edit
            </button>

            <button
              type="button"
              onClick={() => onDelete(notice)}
              disabled={deleting}
              className="rounded-md border border-red-400/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-text-dim hover:border-red-400/25 hover:text-red-300 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

function NoticeEditor({ form, setForm, editing, saving, onSave, onClose }) {
  const editorRef = useRef(null)
  const selectionRef = useRef(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showSizeMenu, setShowSizeMenu] = useState(false)
  const [showColorMenu, setShowColorMenu] = useState(false)
  const [activeFormat, setActiveFormat] = useState({})
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!editorRef.current || initialized) return
    editorRef.current.innerHTML = contentToEditorHtml(form.content)
    setInitialized(true)
  }, [form.content, initialized])

  const applyFontColor = value => {
    if (!value) return

    focusEditor()
    restoreSelection(selectionRef.current)

    const paletteColor = FONT_COLORS.find(item => item.value === value)
    if (!paletteColor) return

    execEditorCommand('foreColor', paletteColor.hex)
    updateActiveFormat()
    setShowColorMenu(false)
  }

  const updateActiveFormat = () => {
    try {
      if (editorRef.current?.contains(document.activeElement)) {
        selectionRef.current = saveSelection()
      }

      setActiveFormat({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
      })
    } catch {
      // Ignore selection-state errors from browsers.
    }
  }

  const focusEditor = () => {
    editorRef.current?.focus()
    restoreSelection(selectionRef.current)
  }

  const rememberSelection = () => {
    if (editorRef.current?.contains(document.activeElement)) {
      selectionRef.current = saveSelection()
    }
  }

  const runCommand = command => {
    focusEditor()
    execEditorCommand(command)
    updateActiveFormat()
  }

  const setBlock = tag => {
    focusEditor()
    execEditorCommand('formatBlock', tag)
    updateActiveFormat()
  }

  const applyFontSize = value => {
    if (!value) return

    // Restore the exact text/caret selection before changing size. This makes
    // size changes feel like a normal formatting tool rather than a separate
    // form control that steals focus from the editor.
    focusEditor()
    execEditorCommand('fontSize', FONT_SIZE_TO_EXEC[value] || '3')
    updateActiveFormat()
    setShowSizeMenu(false)
  }

  const insertEmoji = emoji => {
    focusEditor()

    try {
      execEditorCommand('insertText', emoji)
    } catch {
      execEditorCommand('insertHTML', escapeHtml(emoji))
    }

    updateActiveFormat()
    setShowEmojiPicker(false)
  }

  const clearFormatting = () => {
    focusEditor()
    execEditorCommand('removeFormat')
    execEditorCommand('formatBlock', 'P')

    editorRef.current?.querySelectorAll(
      '.notice-size-small, .notice-size-normal, .notice-size-large, .notice-size-xl, ' +
      '.notice-color-default, .notice-color-gold, .notice-color-white, ' +
      '.notice-color-red, .notice-color-orange, .notice-color-blue, ' +
      '.notice-color-cyan, .notice-color-green, .notice-color-purple'
    ).forEach(node => {
      node.replaceWith(...Array.from(node.childNodes))
    })

    updateActiveFormat()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="my-4 w-full max-w-3xl overflow-visible rounded-2xl border border-gold/25 bg-[#0d0c0a] shadow-[0_24px_90px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold-dim">
              Clan Communication
            </div>
            <h2 className="mt-1 font-spectral text-lg font-bold text-text-bright">
              {editing ? 'Edit Notice' : 'New Notice'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-2 py-1 text-lg text-text-dim hover:bg-white/[0.04] hover:text-gold-light"
            aria-label="Close editor"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4 p-4 sm:p-5">
          <div>
            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-text-dim">
              Title
            </label>

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
              <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-text-dim">
                Type
              </label>

              <select
                value={form.type}
                onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                className="h-[58px] w-full rounded-xl border border-white/[0.09] bg-[#11100e] px-3 text-sm text-text-bright outline-none transition-colors focus:border-gold/35"
              >
                {Object.entries(NOTICE_TYPES).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>

            <label className={`flex min-h-[58px] cursor-pointer items-center gap-3 rounded-xl border px-3 transition-colors ${
              form.pinned
                ? 'border-gold/30 bg-gold/[0.07]'
                : 'border-white/[0.09] bg-black/20 hover:border-white/[0.14]'
            }`}>
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={e => setForm(prev => ({ ...prev, pinned: e.target.checked }))}
                className="h-4 w-4 shrink-0 accent-yellow-400"
              />

              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[10px] font-bold text-text-bright">
                  Pin notice
                  {form.pinned && (
                    <span className="rounded-full border border-gold/20 bg-gold/[0.08] px-1.5 py-0.5 text-[7px] uppercase tracking-[0.08em] text-gold-bright">
                      Pinned
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[8px] leading-relaxed text-text-dim">
                  Keep it above newer notices.
                </span>
              </span>
            </label>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="block text-[9px] font-bold uppercase tracking-[0.15em] text-text-dim">
                Message
              </label>
              <span className="text-[8px] text-text-dim/60">Format your announcement</span>
            </div>

            <div className="overflow-visible rounded-xl border border-white/[0.09] bg-black/30 focus-within:border-gold/35">
              <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.07] bg-white/[0.018] p-1.5">
                {TOOLBAR.map(tool => (
                  <button
                    key={tool.command}
                    type="button"
                    title={tool.title}
                    aria-label={tool.title}
                    onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                    onClick={() => runCommand(tool.command)}
                    className={`flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-[10px] text-text-dim ${
                      activeFormat[tool.command]
                        ? 'border-gold/30 bg-gold/[0.10] text-gold-bright'
                        : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-text-bright'
                    } ${tool.className}`}
                  >
                    {tool.label}
                  </button>
                ))}

                <span className="mx-0.5 h-5 w-px bg-white/[0.08]" />

                <button
                  type="button"
                  title="Heading"
                  onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                  onClick={() => setBlock('H2')}
                  className="flex h-7 items-center justify-center rounded-md border border-transparent px-2 text-[9px] font-black text-text-dim hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-text-bright"
                >
                  H
                </button>

                <button
                  type="button"
                  title="Bullet list"
                  onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                  onClick={() => runCommand('insertUnorderedList')}
                  className="flex h-7 items-center justify-center rounded-md border border-transparent px-2 text-[11px] text-text-dim hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-text-bright"
                >
                  •
                </button>

                <button
                  type="button"
                  title="Numbered list"
                  onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                  onClick={() => runCommand('insertOrderedList')}
                  className="flex h-7 items-center justify-center rounded-md border border-transparent px-2 text-[9px] font-bold text-text-dim hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-text-bright"
                >
                  1.
                </button>

                <button
                  type="button"
                  title="Quote"
                  onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                  onClick={() => setBlock('BLOCKQUOTE')}
                  className="flex h-7 items-center justify-center rounded-md border border-transparent px-2 text-[13px] text-text-dim hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-text-bright"
                >
                  “
                </button>

                <div className="relative">
                  <button
                    type="button"
                    title="Font size"
                    aria-haspopup="menu"
                    aria-expanded={showSizeMenu}
                    onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                    onClick={() => {
                      setShowSizeMenu(prev => !prev)
                      setShowColorMenu(false)
                      setShowEmojiPicker(false)
                    }}
                    className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[8px] font-bold uppercase tracking-[0.06em] transition-colors ${
                      showSizeMenu
                        ? 'border-gold/30 bg-gold/[0.08] text-gold-bright'
                        : 'border-white/[0.08] bg-[#11100e] text-text-dim hover:border-gold/20 hover:text-text-bright'
                    }`}
                  >
                    <span>Size</span>
                    <span className="text-[7px] opacity-60">▾</span>
                  </button>

                  {showSizeMenu && (
                    <div
                      role="menu"
                      className="absolute left-0 top-9 z-30 w-[178px] overflow-hidden rounded-lg border border-white/[0.12] bg-[#11100e] p-1 shadow-[0_18px_45px_rgba(0,0,0,0.65)]"
                    >
                      <div className="px-2 py-1.5 text-[7px] font-bold uppercase tracking-[0.14em] text-text-dim/60">
                        Text Size
                      </div>

                      {FONT_SIZES.map(size => (
                        <button
                          key={size.value}
                          type="button"
                          role="menuitem"
                          onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                          onClick={() => applyFontSize(size.value)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-text-dim transition-colors hover:bg-gold/[0.07] hover:text-gold-light"
                        >
                          <span className="text-[9px] font-bold uppercase tracking-[0.08em]">
                            {size.label}
                          </span>
                          <span
                            className="font-semibold text-text-bright"
                            style={{ fontSize: `${Math.min(size.px, 18)}px` }}
                          >
                            Aa
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    title="Text color"
                    aria-haspopup="menu"
                    aria-expanded={showColorMenu}
                    onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                    onClick={() => {
                      setShowColorMenu(prev => !prev)
                      setShowSizeMenu(false)
                      setShowEmojiPicker(false)
                    }}
                    className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[8px] font-bold uppercase tracking-[0.06em] transition-colors ${
                      showColorMenu
                        ? 'border-gold/30 bg-gold/[0.08] text-gold-bright'
                        : 'border-white/[0.08] bg-[#11100e] text-text-dim hover:border-gold/20 hover:text-text-bright'
                    }`}
                  >
                    <span className="flex flex-col items-center justify-center leading-none">
                      <span className="text-[8px] font-black">A</span>
                      <span className="mt-0.5 h-[2px] w-3 rounded-full bg-gold-bright" />
                    </span>
                    <span>Color</span>
                    <span className="text-[7px] opacity-60">▾</span>
                  </button>

                  {showColorMenu && (
                    <div
                      role="menu"
                      className="absolute left-0 top-9 z-30 w-[230px] rounded-lg border border-white/[0.12] bg-[#11100e] p-2 shadow-[0_18px_45px_rgba(0,0,0,0.65)]"
                    >
                      <div className="mb-2 px-1 text-[7px] font-bold uppercase tracking-[0.14em] text-text-dim/60">
                        Text Color
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        {FONT_COLORS.map(color => (
                          <button
                            key={color.value}
                            type="button"
                            role="menuitem"
                            onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                            onClick={() => applyFontColor(color.value)}
                            className="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-gold/[0.07]"
                          >
                            <span
                              className="h-4 w-4 shrink-0 rounded-full border border-white/20"
                              style={{ backgroundColor: color.hex }}
                            />
                            <span className="text-[8px] font-bold uppercase tracking-[0.06em] text-text-dim">
                              {color.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  title="Clear formatting"
                  onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                  onClick={clearFormatting}
                  className="ml-auto flex h-7 items-center justify-center rounded-md border border-transparent px-2 text-[8px] font-bold uppercase tracking-[0.08em] text-text-dim hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-text-bright"
                >
                  Clear
                </button>

                <div className="relative">
                  <button
                    type="button"
                    title="Insert emoji"
                    aria-label="Insert emoji"
                    onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                    onClick={() => {
                      setShowEmojiPicker(prev => !prev)
                      setShowSizeMenu(false)
                      setShowColorMenu(false)
                    }}
                    className="flex h-7 items-center justify-center rounded-md border border-transparent px-2 text-[14px] text-text-dim hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-text-bright"
                  >
                    😀
                  </button>

                  {showEmojiPicker && (
                    <div className="absolute right-0 top-9 z-20 w-[250px] rounded-xl border border-gold/20 bg-[#12110f] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.65)]">
                      <div className="mb-2 px-1 text-[8px] font-bold uppercase tracking-[0.14em] text-text-dim">
                        Clan Emojis
                      </div>

                      <div className="grid grid-cols-8 gap-1">
                        {EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); rememberSelection() }}
                            onClick={() => insertEmoji(emoji)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-sm hover:bg-gold/[0.08]"
                            aria-label={`Insert ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={editorRef}
                data-notice-editor="true"
                contentEditable={!saving}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                spellCheck
                onInput={updateActiveFormat}
                onKeyUp={updateActiveFormat}
                onMouseUp={updateActiveFormat}
                onFocus={updateActiveFormat}
                className="notice-editor min-h-[235px] max-h-[420px] overflow-y-auto px-4 py-3.5 text-sm leading-relaxed text-text-bright outline-none sm:min-h-[250px]"
              />
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-3 text-[8px] text-text-dim/55">
              <span>Format selected text or set the style for what you type next</span>
              <span>Max 2,000 characters</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-text-dim hover:text-text-bright disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="rounded-lg border border-gold/35 bg-gold/[0.09] px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-gold-bright hover:bg-gold/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Publish Notice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
