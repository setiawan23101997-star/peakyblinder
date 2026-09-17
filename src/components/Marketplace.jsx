import React, { useEffect, useMemo, useRef, useState } from 'react'

const ROLES = {
  ADMIN: 'Admin',
  MASTER: 'Master',
  ELDER: 'Elder',
}

const REVIEW_ROLES = [ROLES.ADMIN, ROLES.MASTER]
const DISTRIBUTE_ROLES = [ROLES.ADMIN, ROLES.MASTER, ROLES.ELDER]
const LISTING_CONTROL_ROLES = [ROLES.ADMIN, ROLES.MASTER, ROLES.ELDER]
const BULK_LISTING_REMOVE_ROLES = [ROLES.MASTER]
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const IMAGE_BUCKET = 'auction-images'

const formatCoins = value => new Intl.NumberFormat('en-US').format(Number(value) || 0)

const formatDate = value => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatShortDate = value => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const timeRemaining = value => {
  if (!value) return 'No expiry'
  const diff = new Date(value).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`
  return `${hours} hour${hours === 1 ? '' : 's'} left`
}

const displayNameForLibraryImage = img => {
  if (!img) return ''
  if (img.displayName) return img.displayName
  const base = (img.name || '').split('/').pop()
  const m = base.match(/^(\d+)-[a-z0-9]+\.([a-z0-9]+)$/i)
  if (m) return `image-${m[1]}.${m[2]}`
  return base || 'Marketplace artwork'
}

const rarityClass = rarity => {
  const r = String(rarity || 'common').toLowerCase()
  if (r === 'legendary') return 'border-amber-300/45 bg-amber-300/[.06] text-amber-200'
  if (r === 'epic') return 'border-red-400/35 bg-red-400/[.05] text-red-300'
  if (r === 'rare') return 'border-blue-400/35 bg-blue-400/[.05] text-blue-300'
  if (r === 'uncommon') return 'border-emerald-400/35 bg-emerald-400/[.05] text-emerald-300'
  return 'border-white/15 bg-white/[.025] text-text-dim'
}

const rarityTextClass = rarity => {
  const r = String(rarity || 'common').toLowerCase()
  if (r === 'legendary') return 'text-amber-200'
  if (r === 'epic') return 'text-red-300'
  if (r === 'rare') return 'text-blue-300'
  if (r === 'uncommon') return 'text-emerald-300'
  return 'text-text-bright'
}

const rarityGlowClass = rarity => {
  const r = String(rarity || 'common').toLowerCase()
  if (r === 'legendary') return 'bg-[radial-gradient(circle,rgba(255,215,70,.62),rgba(255,170,0,.28)_34%,rgba(255,120,0,.10)_56%,transparent_78%)]'
  if (r === 'epic') return 'bg-[radial-gradient(circle,rgba(255,45,65,.72),rgba(245,35,50,.36)_34%,rgba(190,20,35,.16)_56%,transparent_78%)]'
  if (r === 'rare') return 'bg-[radial-gradient(circle,rgba(55,155,255,.68),rgba(35,105,235,.30)_34%,rgba(20,70,190,.13)_56%,transparent_78%)]'
  if (r === 'uncommon') return 'bg-[radial-gradient(circle,rgba(35,235,145,.62),rgba(20,190,110,.28)_34%,rgba(10,130,75,.12)_56%,transparent_78%)]'
  return 'bg-[radial-gradient(circle,rgba(205,155,70,.48),rgba(150,100,30,.20)_34%,rgba(120,75,20,.08)_56%,transparent_78%)]'
}

const rarityArtworkBorderClass = rarity => {
  const r = String(rarity || 'common').toLowerCase()
  if (r === 'legendary') return 'border-amber-300/70 shadow-[inset_0_0_22px_rgba(255,190,30,.16),0_0_18px_rgba(255,175,0,.10)]'
  if (r === 'epic') return 'border-red-500/75 shadow-[inset_0_0_24px_rgba(255,35,50,.20),0_0_20px_rgba(235,25,40,.16)]'
  if (r === 'rare') return 'border-blue-400/70 shadow-[inset_0_0_22px_rgba(45,145,255,.18),0_0_18px_rgba(35,110,235,.12)]'
  if (r === 'uncommon') return 'border-emerald-400/65 shadow-[inset_0_0_22px_rgba(30,220,130,.16),0_0_18px_rgba(20,180,100,.10)]'
  return 'border-amber-100/20 shadow-[inset_0_0_18px_rgba(205,155,70,.06)]'
}

const statusClass = status => {
  if (status === 'active') return 'border-emerald-400/30 bg-emerald-400/[.06] text-emerald-300'
  if (status === 'pending_review') return 'border-amber-300/30 bg-amber-300/[.06] text-amber-200'
  if (status === 'rejected') return 'border-red-400/30 bg-red-400/[.06] text-red-300'
  if (status === 'sold_out') return 'border-blue-400/30 bg-blue-400/[.06] text-blue-300'
  if (status === 'distributed') return 'border-emerald-400/30 bg-emerald-400/[.06] text-emerald-300'
  if (status === 'purchased') return 'border-amber-300/30 bg-amber-300/[.06] text-amber-200'
  return 'border-white/10 bg-white/[.025] text-text-dim'
}

const statusLabel = status => String(status || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown'

function SectionTitle({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="mb-1 text-[10px] font-bold uppercase tracking-[.22em] text-gold-dim">{eyebrow}</div>}
        <h2 className="font-spectral text-xl font-bold text-text-bright">{title}</h2>
        {description && <p className="mt-1 text-[11px] leading-4 text-text-dim">{description}</p>}
      </div>
      {action}
    </div>
  )
}

function Modal({ title, children, onClose, wide = false, compact = false, narrow = false }) {
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-3 backdrop-blur-[3px] sm:p-5"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-[16px] border border-gold/20 bg-[#0a0908] shadow-[0_28px_90px_rgba(0,0,0,.85)] ${
          wide ? 'max-w-4xl' : narrow ? 'max-w-[440px]' : compact ? 'max-w-xl' : 'max-w-lg'
        }`}
        style={narrow ? { width: '440px', maxWidth: 'calc(100vw - 24px)' } : undefined}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/[.07] bg-[#0a0908]/96 px-4 py-3 backdrop-blur">
          <h2 className="min-w-0 truncate font-spectral text-lg font-bold text-gold-light">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[.08] text-base leading-none text-text-dim transition hover:border-gold/25 hover:bg-gold/[.04] hover:text-gold-light"
          >
            ×
          </button>
        </div>
        <div className={compact ? 'p-4' : 'p-5'}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.15em] text-text-dim">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-4 text-text-dim/55">{hint}</span>}
    </label>
  )
}

function ItemArtwork({ item, size = 'card' }) {
  const src = item?.image_url || item?.image_data
  const isTable = size === 'table'
  const isPurchase = size === 'purchase'
  const isReview = size === 'review'

  const box = isTable
    ? 'h-12 w-12'
    : isPurchase
      ? 'h-48 w-full sm:h-52'
      : isReview
        ? 'h-36 w-full sm:h-40'
        : 'aspect-square w-full self-start'

  const imageClass = isTable
    ? 'h-full w-full object-contain'
    : isPurchase
      ? 'max-h-40 max-w-40 sm:max-h-[170px] sm:max-w-[170px] object-contain'
      : isReview
        ? 'max-h-[116px] max-w-[116px] sm:max-h-[128px] sm:max-w-[128px] object-contain'
        : 'max-h-[108px] max-w-[108px] object-contain'

  if (isTable) {
    return (
      <div className={`relative flex ${box} items-center justify-center overflow-hidden rounded-lg border border-white/[.07] bg-[#070707]`}>
        {src
          ? <img src={src} alt={item?.name || 'Marketplace item'} className={`${imageClass} relative z-10 drop-shadow-[0_6px_14px_rgba(0,0,0,.65)]`} loading="lazy" />
          : <span className="relative z-10 text-xl text-gold-dim/25">◇</span>}
      </div>
    )
  }

  return (
    <div className={`group/art relative flex ${box} items-center justify-center overflow-hidden rounded-[11px] border bg-[#070707] ${rarityArtworkBorderClass(item?.rarity)}`}>
      {src && (isPurchase || isReview) && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[-14%] bg-cover bg-center opacity-[.32] blur-2xl"
          style={{
            backgroundImage: `
              radial-gradient(
                ellipse at center,
                rgba(255,255,255,.025) 0%,
                rgba(255,255,255,.01) 42%,
                rgba(0,0,0,.16) 70%,
                rgba(0,0,0,.62) 100%
              ),
              url(${src})
            `,
          }}
        />
      )}

      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${rarityGlowClass(item?.rarity)} ${
          isPurchase ? 'h-44 w-44 blur-lg opacity-95' : isReview ? 'h-36 w-36 blur-lg opacity-90' : 'h-32 w-32 blur-lg opacity-92'
        }`}
      />

      {src
        ? (
          <div className={`relative z-10 flex items-center justify-center ${
            isPurchase ? 'h-[82%] w-[82%]' : isReview ? 'h-[76%] w-[76%]' : 'h-[76%] w-[76%]'
          }`}>
            <img
              src={src}
              alt={item?.name || 'Marketplace item'}
              className="block h-full w-full object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,.9)] transition-transform duration-300 group-hover/art:scale-[1.02]"
              loading="lazy"
              style={{ imageRendering: 'auto' }}
            />
          </div>
        )
        : <span className="relative z-10 text-4xl text-gold-dim/25">◇</span>}

      <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(ellipse_at_center,transparent_44%,rgba(0,0,0,.025)_72%,rgba(0,0,0,.28)_100%)]" />
    </div>
  )
}

function ItemCard({ item, onBuy, canBuy, sold = false, buyerName = null, purchasedAt = null }) {
  const stock = Number(item?.stock) || 0
  const bundleQuantity = Math.max(1, Number(item?.bundle_quantity ?? item?.stock) || 1)
  const price = Number(item?.price) || 0
  const expired = item?.available_until && new Date(item.available_until).getTime() <= Date.now()
  const soldOut = sold || item?.status === 'sold_out' || stock < 1
  const rarity = String(item?.rarity || 'common').toLowerCase()

  const rarityBadge = {
    legendary: 'border-amber-300/45 bg-amber-300/[.055] text-amber-200',
    epic: 'border-red-400/35 bg-red-400/[.05] text-red-300',
    rare: 'border-blue-400/35 bg-blue-400/[.05] text-blue-300',
    uncommon: 'border-emerald-400/35 bg-emerald-400/[.05] text-emerald-300',
    common: 'border-white/15 bg-white/[.025] text-text-dim',
  }[rarity] || 'border-white/15 bg-white/[.025] text-text-dim'

  return (
    <article className="group overflow-hidden rounded-[14px] border border-white/[.08] bg-[#090807]/95 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/25 hover:shadow-[0_16px_42px_rgba(0,0,0,.36)]" style={{ contentVisibility: "auto", containIntrinsicSize: "0 280px" }}>
      <div className="grid grid-cols-[96px_minmax(0,1fr)] bg-[#060606] sm:grid-cols-[116px_minmax(0,1fr)] lg:grid-cols-[128px_minmax(0,1fr)]">
        <div className="self-start p-1">
          <ItemArtwork item={item} />
        </div>

        <div className="min-w-0 px-3 py-2 sm:px-3.5">
          <div className="flex min-h-[25px] min-w-0 items-start">
            <span
              className={`inline-flex max-w-full shrink items-center justify-center rounded-full border px-2.5 py-1.5 text-[9px] font-extrabold uppercase leading-none tracking-[.12em] whitespace-nowrap ${rarityBadge}`}
              title={item.rarity || 'common'}
            >
              {item.rarity || 'common'}
            </span>
          </div>

          <div className="mt-2 min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-[.17em] text-text-dim/60">Price</div>
            <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5 font-mono font-bold leading-none text-gold-bright">
              <span className="min-w-0 truncate text-[20px] font-extrabold sm:text-[21px]">{formatCoins(price)}</span>
              <span className="shrink-0 text-[9px] font-bold tracking-[.05em] text-gold-light/75">COINS</span>
            </div>
          </div>

          <div className="mt-2 border-t border-white/[.055] pt-1.5">
            <div className="text-[9px] font-bold uppercase tracking-[.17em] text-text-dim/60">Package</div>
            <div className="mt-0.5 flex items-baseline gap-1.5 font-mono font-bold leading-none text-text-bright">
              <span className="text-[16px] font-extrabold">{bundleQuantity}×</span>
              <span className="font-sans text-[10px] font-medium text-text-dim/80">items</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[.055] px-3.5 pb-3 pt-2 sm:px-4">
        <h3
          className={`truncate text-center font-spectral text-[16px] font-bold leading-tight tracking-[.01em] sm:text-[18px] ${rarityTextClass(item.rarity)}`}
          title={item.name}
        >
          {item.name}
        </h3>

        {sold && (
          <div className="mx-auto mt-2 max-w-[320px] rounded-lg border border-white/[.06] bg-white/[.018] px-2.5 py-1.5 text-center">
            <div className="text-[9px] font-bold uppercase tracking-[.14em] text-text-dim/80">Purchased By</div>
            <div className="mt-0.5 truncate text-[13px] font-semibold text-gold-light">{buyerName || 'Buyer information unavailable'}</div>
            {purchasedAt && (
              <div className="mt-0.5 text-[9px] text-text-dim/80">
                {new Date(purchasedAt).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short',
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-2.5 flex min-h-8 items-center justify-center gap-2 border-y border-white/[.055] px-1 text-center text-[9px] font-bold uppercase tracking-[.1em] sm:text-[10px] sm:tracking-[.12em]">
          <span className="text-text-dim/60">{soldOut ? 'Status' : 'Closes in'}</span>
          <span className={soldOut ? 'text-white/55' : expired ? 'text-red-300' : 'text-text-dim/85'}>
            {soldOut ? 'Sold Out' : expired ? 'Expired' : timeRemaining(item.available_until)}
          </span>
        </div>

        <button
          type="button"
          disabled={!canBuy || soldOut || expired}
          onClick={() => onBuy(item)}
          className="mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-[9px] border border-[#6b5425] bg-gradient-to-b from-gold/[.12] to-gold/[.04] text-[10px] font-bold uppercase tracking-[.14em] text-gold-light transition hover:border-[#d4af37] hover:from-gold/[.18] hover:to-gold/[.065] hover:shadow-[0_6px_18px_rgba(242,204,96,.07)] disabled:cursor-not-allowed disabled:border-white/[.06] disabled:bg-white/[.015] disabled:text-text-dim/35"
        >
          {!canBuy ? 'Sign In To Purchase' : soldOut ? 'Sold Out' : expired ? 'Expired' : 'Buy Now'}
          {canBuy && !soldOut && !expired && <span className="text-gold-bright"></span>}
        </button>
      </div>
    </article>
  )
}


const MemoizedItemCard = React.memo(ItemCard)

function ImageManager({ imageFile, imagePreview, pickedLibraryImg, libraryImages, libraryLoading, libraryError, uploading, deletingImageName, canDeleteImage, fileInputRef, onRefresh, onFileChange, onPick, onClear, onDeleteImage }) {
  const selectedLabel = imageFile
    ? imageFile.name
    : pickedLibraryImg
      ? (pickedLibraryImg.displayName || displayNameForLibraryImage(pickedLibraryImg))
      : ''
  const hasSelectedImage = Boolean(imageFile || pickedLibraryImg || imagePreview)

  return (
    <div className="rounded-xl border border-white/[.07] bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[.15em] text-gold-dim">Item Artwork</div>
          <div className="mt-1 text-[11px] text-text-dim">Use an Auction House image or upload a new one for this Clan Marketplace item.</div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={libraryLoading || uploading}
          className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-gold-light hover:text-gold-bright disabled:opacity-40"
        >
          {libraryLoading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-white/[.06] bg-black/20 p-3">
        {imagePreview ? (
          <img src={imagePreview} alt="Selected artwork" className="h-14 w-14 shrink-0 rounded-lg border border-gold/25 bg-black object-contain" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/[.1] text-[10px] text-text-dim/45">IMAGE</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Selected Asset</div>
          <div className="mt-1 truncate text-[11px] text-text-bright">
            {hasSelectedImage ? selectedLabel || 'Selected image' : 'No image selected'}
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onFileChange}
            disabled={uploading}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-gold/30 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gold-light hover:bg-gold/10 disabled:opacity-40"
          >
            {uploading ? 'Uploading…' : hasSelectedImage ? 'Change' : 'Upload'}
          </button>
          {hasSelectedImage && (
            <button
              type="button"
              onClick={onClear}
              disabled={uploading}
              className="rounded-lg border border-red-500/25 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 disabled:opacity-40"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-white/[.06] pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-[11px] font-bold uppercase tracking-[.15em] text-text-dim">Image Library</div>
          <div className="text-[11px] text-text-dim">
            {libraryLoading ? 'Loading…' : libraryError ? <span className="text-red-400">{libraryError}</span> : `${libraryImages.length} assets`}
          </div>
        </div>

        {libraryImages.length > 0 ? (
          <div className="grid max-h-[220px] grid-cols-6 gap-2 overflow-y-auto pr-1 sm:grid-cols-8">
            {libraryImages.map(image => {
              const picked = pickedLibraryImg?.name === image.name || (!imageFile && imagePreview === image.url)
              const title = image.displayName || displayNameForLibraryImage(image)
              const isDeleting = deletingImageName === image.name

              return (
                <div
                  key={image.name}
                  className={`group relative overflow-hidden rounded-lg border ${
                    picked ? 'border-gold-bright ring-1 ring-gold/40' : 'border-white/[.08] hover:border-gold/40'
                  } ${isDeleting ? 'pointer-events-none opacity-40' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => onPick(image)}
                    title={title}
                    className="block w-full"
                    aria-pressed={picked}
                    aria-label={`Use image ${title}`}
                  >
                    <img src={image.url} alt={title} className="aspect-square w-full object-contain bg-black" loading="lazy" />
                  </button>

                  {picked && (
                    <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-black">
                      ✓
                    </span>
                  )}

                  {canDeleteImage && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        onDeleteImage(image)
                      }}
                      disabled={isDeleting || Boolean(deletingImageName)}
                      title={`Delete image ${title}`}
                      aria-label={`Delete image ${title}`}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-red-500/50 bg-black/85 text-[9px] font-bold leading-none text-red-400 opacity-0 transition hover:border-red-400 hover:bg-red-500 hover:text-white group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? '…' : '✕'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/[.08] py-7 text-center text-[11px] text-text-dim">No images available yet.</div>
        )}

        <div className="mt-2 text-[10px] text-text-dim/45">Shared with the Auction House artwork library. Maximum upload size: 2 MB.</div>
      </div>
    </div>
  )
}

export default function Marketplace({ ctx }) {
  const { currentUser, supabase, addToast, allMembers } = ctx
  const liveCurrentUser = allMembers?.find(
    member => String(member.id) === String(currentUser?.id)
  ) || currentUser
  const role = liveCurrentUser?.role || currentUser?.role || 'Member'
  const isStaff = [ROLES.ADMIN, ROLES.MASTER, ROLES.ELDER].includes(role)
  const canReview = REVIEW_ROLES.includes(role)
  const canDistribute = DISTRIBUTE_ROLES.includes(role)
  const canManageListings = LISTING_CONTROL_ROLES.includes(role)
  const canBulkRemoveListings = BULK_LISTING_REMOVE_ROLES.includes(role)
  const canManageHistory = isStaff
  const canBuy = Boolean(currentUser && role !== 'Guest')
  // Marketplace submission controls are available only to staff.
  // Regular Members keep the existing Marketplace experience unchanged.
  const canSubmit = isStaff

  const [items, setItems] = useState([])
  const [purchases, setPurchases] = useState([])
  const [displayCoins, setDisplayCoins] = useState(Number(liveCurrentUser?.coins || 0))
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('shop')
  const [staffTab, setStaffTab] = useState(canReview ? 'pending' : 'distribution')
  const [buyItem, setBuyItem] = useState(null)
  const [purchaseError, setPurchaseError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [reviewItem, setReviewItem] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [distributionPurchase, setDistributionPurchase] = useState(null)
  const [distributionNote, setDistributionNote] = useState('')
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([])
  const [selectedListingIds, setSelectedListingIds] = useState([])
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState([])

  const emptyForm = { name: '', description: '', rarity: 'common', image_url: '', image_data: '', price: 100, stock: 1, duration_days: 7 }
  const [form, setForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [pickedLibraryImg, setPickedLibraryImg] = useState(null)
  const [libraryImages, setLibraryImages] = useState([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState(null)
  const [deletingImageName, setDeletingImageName] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const load = async ({ silent = false } = {}) => {
    if (!supabase) return
    try {
      if (!silent) setLoading(true)
      // Marketplace Sold Inventory needs the buyer name for sold listings.
      // Purchase history remains read-only here; the listing itself is still controlled by the Marketplace RPCs.
      const purchaseQuery = supabase.from('marketplace_purchases').select('*').order('purchased_at', { ascending: false })

      const [{ data: itemData, error: itemError }, { data: purchaseData, error: purchaseError }] = await Promise.all([
        supabase.from('marketplace_items').select('*').order('created_at', { ascending: false }),
        purchaseQuery,
      ])
      if (itemError) throw itemError
      if (purchaseError) throw purchaseError
      setItems(itemData || [])
      setPurchases(purchaseData || [])

      // Staff needs the full member list for management controls.
      // Regular members also need buyer names for sold-out Marketplace cards,
      // in addition to the staff names shown on distributed purchases.
      const relatedMemberIds = [...new Set(
        (purchaseData || [])
          .flatMap(p => [p.buyer_id, p.distributed_by])
          .filter(id => id !== null && id !== undefined)
          .map(id => Number(id))
          .filter(Number.isFinite)
      )]

      if (isStaff || relatedMemberIds.length > 0) {
        let memberQuery = supabase
          .from('members')
          .select('id,name,role')
          .order('name')

        if (!isStaff) {
          memberQuery = memberQuery.in('id', relatedMemberIds)
        }

        const { data: memberData, error: memberError } = await memberQuery
        if (!memberError) setMembers(memberData || [])
      } else if (!isStaff) {
        setMembers([])
      }
    } catch (error) {
      console.error('[Marketplace] load failed:', error)
      addToast(error?.message || 'Could not load Marketplace.', 'red', 'Marketplace Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [currentUser?.id, role])

  // Keep the Marketplace balance synced from the shared member context.
  // This updates the UI immediately when Coins change elsewhere without polling
  // or forcing a Marketplace reload.
  useEffect(() => {
    // Sync from the shared member context when it changes.
    // Supabase Realtime below can update displayCoins directly between context syncs.
    if (liveCurrentUser?.id) {
      setDisplayCoins(Number(liveCurrentUser?.coins || 0))
    }
  }, [liveCurrentUser?.id, liveCurrentUser?.coins])

  // Listen only for this player's member-row updates. This is event-driven
  // (no interval/polling), so the balance changes as soon as Supabase sends
  // the database update without making the Marketplace feel like it refreshes.
  useEffect(() => {
    if (!supabase || !currentUser?.id) return undefined

    const memberId = Number(currentUser.id)
    const channel = supabase
      .channel(`marketplace-member-balance-${memberId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'members',
          filter: `id=eq.${memberId}`,
        },
        payload => {
          const nextCoins = Number(payload?.new?.coins)
          if (Number.isFinite(nextCoins)) {
            setDisplayCoins(nextCoins)
          }
        }
      )
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Marketplace] Member balance realtime ${status.toLowerCase()}.`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, currentUser?.id])

  // Keep Marketplace data in sync in the background. Realtime updates are
  // intentionally silent so the page never looks like it is reloading.
  useEffect(() => {
    if (!supabase) return undefined

    let refreshTimer = null
    let disposed = false

    const schedulePurchaseRefresh = () => {
      if (disposed) return
      if (refreshTimer) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        if (!disposed) load({ silent: true })
      }, 400)
    }

    const applyItemRealtimeChange = payload => {
      if (disposed || !payload) return

      const eventType = payload.eventType
      const record = payload.new
      const oldRecord = payload.old

      setItems(prev => {
        if (eventType === 'INSERT') {
          if (!record?.id || prev.some(item => item.id === record.id)) return prev
          return [record, ...prev]
        }

        if (eventType === 'UPDATE') {
          if (!record?.id) return prev
          const exists = prev.some(item => item.id === record.id)
          return exists
            ? prev.map(item => item.id === record.id ? record : item)
            : [record, ...prev]
        }

        if (eventType === 'DELETE') {
          const deletedId = oldRecord?.id
          if (!deletedId) return prev
          return prev.filter(item => item.id !== deletedId)
        }

        return prev
      })
    }

    const channel = supabase
      .channel(`marketplace-realtime-${currentUser?.id || 'guest'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketplace_items' },
        applyItemRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketplace_purchases' },
        schedulePurchaseRefresh
      )
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Marketplace] Realtime subscription ${status.toLowerCase()}. Manual refresh remains available.`)
        }
      })

    return () => {
      disposed = true
      if (refreshTimer) window.clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [supabase, currentUser?.id, role])

  const loadLibrary = async () => {
    if (!supabase) return
    setLibraryLoading(true)
    setLibraryError(null)
    try {
      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
      if (error) throw error
      const library = (data || []).filter(file => file?.name && !file.name.startsWith('.')).map(file => {
        const { data: urlData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(file.name)
        return { name: file.name, displayName: displayNameForLibraryImage({ name: file.name }), url: urlData?.publicUrl || '', createdAt: file.created_at || file.updated_at || null }
      }).filter(file => file.url)
      setLibraryImages(library)
    } catch (error) {
      console.error('[Marketplace] image library load failed:', error)
      setLibraryError(error?.message || 'Failed to load image library')
    } finally {
      setLibraryLoading(false)
    }
  }

  const clearImage = () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setPickedLibraryImg(null)
    setImagePreview(null)
    setForm(prev => ({ ...prev, image_url: '', image_data: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const deleteLibraryImage = async image => {
    if (!isStaff || !supabase || !image?.name || deletingImageName) return

    const title = image.displayName || displayNameForLibraryImage(image)
    if (!window.confirm(
      `Delete this image permanently?\n\n${title}\n\nThis removes it from the shared Auction House artwork library. Any existing listing that already uses this image will keep its stored URL.`
    )) {
      return
    }

    const fileName = image.name
    setDeletingImageName(fileName)

    try {
      const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([fileName])
      if (error) throw error

      setLibraryImages(prev => prev.filter(item => item.name !== fileName))

      if (pickedLibraryImg?.name === fileName || imagePreview === image.url) {
        clearImage()
      }

      addToast('Image deleted from the artwork library.', 'red', 'Image Deleted')
    } catch (error) {
      console.error('[Marketplace] delete image failed:', error)
      addToast(error?.message || 'Could not delete image.', 'red', 'Delete Failed')
    } finally {
      setDeletingImageName(null)
    }
  }

  const handleImageChange = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { addToast('Please choose an image file.', 'red', 'Invalid File'); return }
    if (file.size > 2 * 1024 * 1024) { addToast('Image must be under 2 MB.', 'red', 'Too Large'); return }
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setPickedLibraryImg(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setForm(prev => ({ ...prev, image_url: '', image_data: '' }))
  }

  const pickFromLibrary = image => {
    if (!image?.url) return
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setPickedLibraryImg(image)
    setImagePreview(image.url)
    setForm(prev => ({ ...prev, image_url: image.url, image_data: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadImage = async () => {
    if (pickedLibraryImg?.url) return pickedLibraryImg.url
    if (!imageFile) return form.image_url?.trim() || null
    setUploading(true)
    try {
      const ext = imageFile.type === 'image/png' ? 'png' : (imageFile.name.split('.').pop()?.toLowerCase() || 'png')
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, imageFile, { cacheControl: '3600', upsert: false, contentType: imageFile.type || 'image/png' })
      if (error) throw error
      const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
      const url = data?.publicUrl || null
      if (!url) throw new Error('The uploaded image URL could not be created.')
      setLibraryImages(prev => [{ name: path, displayName: imageFile.name, url, createdAt: new Date().toISOString() }, ...prev.filter(image => image.url !== url)])
      setForm(prev => ({ ...prev, image_url: url, image_data: '' }))
      return url
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (showSubmit || showEdit) loadLibrary()
  }, [showSubmit, showEdit])

  const activeItems = useMemo(() => items.filter(item => item.status === 'active' && new Date(item.available_until).getTime() > Date.now() && Number(item.stock) > 0), [items])
  const soldItems = useMemo(() => items.filter(item => item.status === 'sold_out'), [items])

  const filteredActiveItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = activeItems.filter(item => {
      const matchesSearch = !q || [item.name, item.description, item.rarity].some(value => String(value || '').toLowerCase().includes(q))
      const matchesRarity = rarityFilter === 'all' || String(item.rarity || 'common').toLowerCase() === rarityFilter
      return matchesSearch && matchesRarity
    })
    return [...filtered].sort((a, b) => {
      if (sortBy === 'price_low') return Number(a.price) - Number(b.price)
      if (sortBy === 'price_high') return Number(b.price) - Number(a.price)
      if (sortBy === 'stock') return Number(b.stock) - Number(a.stock)
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
  }, [activeItems, search, rarityFilter, sortBy])

  const filteredSoldItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = soldItems.filter(item => {
      const matchesSearch = !q || [item.name, item.description, item.rarity].some(value => String(value || '').toLowerCase().includes(q))
      const matchesRarity = rarityFilter === 'all' || String(item.rarity || 'common').toLowerCase() === rarityFilter
      return matchesSearch && matchesRarity
    })
    return [...filtered].sort((a, b) => {
      if (sortBy === 'price_low') return Number(a.price) - Number(b.price)
      if (sortBy === 'price_high') return Number(b.price) - Number(a.price)
      return new Date(b.purchased_at || b.updated_at || b.created_at || 0).getTime() - new Date(a.purchased_at || a.updated_at || a.created_at || 0).getTime()
    })
  }, [soldItems, search, rarityFilter, sortBy])

  const myPurchases = useMemo(() => purchases.filter(p => Number(p.buyer_id) === Number(currentUser?.id)), [purchases, currentUser?.id])
  const pendingItems = useMemo(() => items.filter(item => item.status === 'pending_review'), [items])
  const mySubmissions = useMemo(() => items.filter(item => Number(item.submitted_by) === Number(currentUser?.id)), [items, currentUser?.id])
  const distributionQueue = useMemo(() => purchases.filter(p => p.status === 'purchased'), [purchases])
  const activeListings = useMemo(() => items.filter(item => item.status === 'active' || item.status === 'sold_out'), [items])

  const memberName = id => members.find(m => Number(m.id) === Number(id))?.name || `Member #${id}`
  const itemName = id => items.find(item => item.id === id)?.name || 'Marketplace Item'
  const itemPackageQuantity = id => {
    const item = items.find(entry => entry.id === id)
    return Math.max(1, Number(item?.bundle_quantity ?? item?.stock) || 1)
  }

  const buyerForItem = itemId => {
    const purchase = purchases.find(p => p.item_id === itemId && p.status !== 'cancelled')
    return purchase ? memberName(purchase.buyer_id) : null
  }

  const purchasedAtForItem = itemId => {
    const purchase = purchases.find(p => p.item_id === itemId && p.status !== 'cancelled')
    return purchase?.purchased_at || null
  }

  const openBuy = item => {
    setPurchaseError('')
    setBuyItem(item)
  }

  const openSubmit = () => {
    clearImage()
    setForm({ ...emptyForm })
    setShowSubmit(true)
  }

  const submitItem = async e => {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      const imageUrl = await uploadImage()
      const { data: createdItem, error } = await supabase.rpc('marketplace_submit_item', {
        p_actor_id: currentUser.id,
        p_name: form.name.trim(),
        p_description: form.description.trim() || '',
        p_rarity: form.rarity,
        p_image_url: imageUrl,
        p_image_data: null,
        p_price: Number(form.price),
        p_stock: Number(form.stock),
        p_duration_days: Number(form.duration_days),
      })
      if (error) throw error

      // The RPC returns the new row, so update the local list instead of
      // downloading the entire Marketplace again.
      if (createdItem) {
        const created = Array.isArray(createdItem) ? createdItem[0] : createdItem
        if (created?.id) {
          setItems(prev => [created, ...prev.filter(item => item.id !== created.id)])
        }
      }

      setShowSubmit(false)
      addToast('Clan item submitted for Master review.', 'gold', 'Marketplace Submitted')
    } catch (error) {
      addToast(error?.message || 'Failed to submit Marketplace item.', 'red', 'Submit Failed')
    } finally { setBusy(false) }
  }

  const confirmDirectList = async e => {
    e?.preventDefault?.()
    if (!canSubmit || busy || showEdit) return

    const itemName = String(form.name || '').trim()
    const price = Number(form.price)
    const stock = Number(form.stock)
    const durationDays = Number(form.duration_days)

    if (!itemName) {
      addToast('Enter an item name before listing.', 'red', 'Cannot List')
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      addToast('Enter a valid price.', 'red', 'Cannot List')
      return
    }

    if (!Number.isInteger(stock) || stock < 1) {
      addToast('Quantity must be at least 1.', 'red', 'Cannot List')
      return
    }

    if (!Number.isInteger(durationDays) || durationDays < 1) {
      addToast('Duration must be at least 1 day.', 'red', 'Cannot List')
      return
    }

    if (!window.confirm(
      `Confirm direct listing?\n\n"${itemName}" will be published to the Clan Marketplace immediately.\n\nThis bypasses the review queue.`
    )) {
      return
    }

    setBusy(true)
    try {
      const imageUrl = await uploadImage()
      const { data: createdItem, error } = await supabase.rpc('marketplace_staff_list_item', {
        p_actor_id: Number(currentUser.id),
        p_name: itemName,
        p_description: String(form.description || '').trim(),
        p_rarity: form.rarity || 'common',
        p_image_url: imageUrl || null,
        p_image_data: null,
        p_price: Math.round(price),
        p_stock: stock,
        p_duration_days: durationDays,
      })

      if (error) throw error

      // The RPC returns the new row, so add it directly to the current list.
      // This avoids refetching every Marketplace item after each listing.
      if (createdItem) {
        const created = Array.isArray(createdItem) ? createdItem[0] : createdItem
        if (created?.id) {
          setItems(prev => [created, ...prev.filter(item => item.id !== created.id)])
        }
      }

      setShowSubmit(false)
      clearImage()
      addToast(`"${itemName}" is now live on the Marketplace.`, 'gold', 'Listing Confirmed')
    } catch (error) {
      const message = String(error?.message || 'Failed to list Marketplace item.')
      if (/PGRST202|Could not find the function|schema cache/i.test(message)) {
        addToast(
          'Run the Marketplace staff-listing SQL once in Supabase, then try Confirm & List again.',
          'red',
          'Database Setup Required'
        )
      } else {
        addToast(message, 'red', 'Listing Failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const confirmBuy = async () => {
    if (!buyItem) return

    setPurchaseError('')
    setBusy(true)

    try {
      const total = Number(buyItem.price)
      const availableCoins = Number(liveCurrentUser?.coins ?? displayCoins ?? 0)

      if (availableCoins < total) {
        setPurchaseError(
          `You need ${formatCoins(total)} Coins to purchase this item.`
        )
        return
      }

      const { error } = await supabase.rpc('marketplace_purchase_item', {
        p_buyer_id: currentUser.id,
        p_item_id: buyItem.id,
        p_quantity: 1,
      })
      if (error) throw error

      // Update the balance shown by Marketplace immediately after the RPC succeeds.
      // The global member context may refresh asynchronously, so do not wait for it
      // before updating the balance at the top of this page.
      setDisplayCoins(prev => Math.max(0, Number(prev || 0) - total))

      setBuyItem(null)
      addToast(`Purchased ${buyItem.name} for ${formatCoins(total)} coins.`, 'gold', 'Purchase Complete')
    } catch (error) {
      // Keep all non-balance purchase errors on the existing toast behavior.
      addToast(error?.message || 'Purchase failed.', 'red', 'Purchase Failed')
    } finally {
      setBusy(false)
    }
  }

  const approve = async () => {
    if (!reviewItem || !canReview) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('marketplace_master_review_item', { p_actor_id: currentUser.id, p_item_id: reviewItem.id, p_action: 'approve', p_rejection_reason: null })
      if (error) throw error
      setReviewItem(null)
      addToast(`"${reviewItem.name}" is now active.`, 'gold', 'Marketplace Approved')
      await load()
    } catch (error) { addToast(error?.message || 'Approval failed.', 'red', 'Review Failed') } finally { setBusy(false) }
  }

  const reject = async () => {
    if (!reviewItem || !canReview) return
    const reason = window.prompt('Rejection reason (optional):', '')
    if (reason === null) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('marketplace_master_review_item', { p_actor_id: currentUser.id, p_item_id: reviewItem.id, p_action: 'reject', p_rejection_reason: reason.trim() || null })
      if (error) throw error
      setReviewItem(null)
      addToast(`"${reviewItem.name}" was rejected.`, 'blue', 'Marketplace Review')
      await load()
    } catch (error) { addToast(error?.message || 'Rejection failed.', 'red', 'Review Failed') } finally { setBusy(false) }
  }

  const openEdit = item => {
    if (!item?.id || !canReview) return
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)

    const imageUrl = item.image_url || item.image_data || ''
    const matchingLibraryImage = libraryImages.find(image => image.url === imageUrl) || null
    const fromMs = new Date(item.available_from || item.created_at || Date.now()).getTime()
    const untilMs = new Date(item.available_until || '').getTime()
    const calculatedDays = Number.isFinite(fromMs) && Number.isFinite(untilMs) && untilMs > fromMs
      ? Math.max(1, Math.ceil((untilMs - fromMs) / 86400000))
      : 7

    setImageFile(null)
    setPickedLibraryImg(matchingLibraryImage)
    setImagePreview(imageUrl || null)
    setForm({
      name: item.name || '',
      description: item.description || '',
      rarity: item.rarity || 'common',
      image_url: item.image_url || '',
      image_data: item.image_data || '',
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
      stock: Math.max(1, Number(item.bundle_quantity ?? item.stock) || 1),
      duration_days: calculatedDays,
    })
    setShowEdit(true)
  }

  const saveEdit = async (e, approveAfterSave = false) => {
    e.preventDefault()
    if (!reviewItem || !canReview || busy) return

    const name = String(form.name || '').trim()
    const price = Number(form.price)
    const packageQuantity = Number(form.stock)
    const durationDays = Number(form.duration_days)

    if (!name) {
      addToast('Item name is required.', 'red', 'Cannot Save')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      addToast('Enter a valid price.', 'red', 'Cannot Save')
      return
    }
    if (!Number.isInteger(packageQuantity) || packageQuantity < 1) {
      addToast('Package quantity must be at least 1.', 'red', 'Cannot Save')
      return
    }
    if (!Number.isInteger(durationDays) || durationDays < 1) {
      addToast('Duration must be at least 1 day.', 'red', 'Cannot Save')
      return
    }

    setBusy(true)
    try {
      const imageUrl = await uploadImage()
      const itemId = reviewItem.id
      const itemName = name
      const { error } = await supabase.rpc('marketplace_master_edit_item', {
        p_actor_id: Number(currentUser.id),
        p_item_id: itemId,
        p_name: itemName,
        p_description: String(form.description || '').trim(),
        p_rarity: form.rarity || 'common',
        p_image_url: imageUrl || null,
        p_image_data: null,
        p_price: Math.round(price),
        p_stock: packageQuantity,
        p_duration_days: durationDays,
      })
      if (error) throw error

      if (approveAfterSave) {
        const { error: approveError } = await supabase.rpc('marketplace_master_review_item', {
          p_actor_id: Number(currentUser.id),
          p_item_id: itemId,
          p_action: 'approve',
          p_rejection_reason: null,
        })
        if (approveError) throw approveError

        setShowEdit(false)
        setReviewItem(null)
        addToast(`"${itemName}" was saved and is now active.`, 'gold', 'Listing Saved & Approved')
      } else {
        setShowEdit(false)
        setReviewItem(null)
        addToast('Marketplace submission updated.', 'gold', 'Changes Saved')
      }
      await load()
    } catch (error) {
      const message = String(error?.message || 'Edit failed.')
      if (/PGRST202|Could not find the function|schema cache/i.test(message)) {
        addToast('The Marketplace edit RPC is missing in Supabase. Run the Marketplace edit repair SQL.', 'red', 'Database Setup Required')
      } else {
        addToast(message, 'red', 'Edit Failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const distribute = async () => {
    if (!distributionPurchase || !canDistribute) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('marketplace_distribute_purchase', { p_staff_id: currentUser.id, p_purchase_id: distributionPurchase.id, p_distribution_note: distributionNote.trim() || null })
      if (error) throw error
      setDistributionPurchase(null)
      setDistributionNote('')
      addToast('Purchase marked as distributed.', 'gold', 'Distribution Complete')
      await load()
    } catch (error) {
      const message = String(error?.message || '')
      if (/PGRST202|Could not find the function|schema cache/i.test(message)) addToast('The Marketplace distribution RPC is not installed in Supabase yet. Run the Marketplace Step 3 Repair SQL.', 'red', 'Database Setup Required')
      else addToast(message || 'Distribution failed.', 'red', 'Distribution Failed')
    } finally { setBusy(false) }
  }

  const closeListing = async item => {
    if (!canManageListings) return
    if (!window.confirm(`Close "${item.name}"? Existing purchase history will remain unchanged.`)) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('marketplace_close_item', { p_staff_id: currentUser.id, p_item_id: item.id })
      if (error) throw error
      addToast(`"${item.name}" has been closed.`, 'blue', 'Listing Closed')
      await load()
    } catch (error) { addToast(error?.message || 'Could not close listing.', 'red', 'Close Failed') } finally { setBusy(false) }
  }

  const removeListing = async item => {
    if (!canManageListings) return

    const isOwnElderActiveListing = role === ROLES.ELDER && Number(item?.submitted_by) === Number(currentUser?.id) && item?.status === 'active'
    const canRemoveCompletedListing = ['sold_out', 'closed', 'expired', 'rejected'].includes(item?.status)

    if (!isOwnElderActiveListing && !canRemoveCompletedListing) return

    const confirmation = isOwnElderActiveListing
      ? `Remove "${item.name}" from the Clan Marketplace?\n\nThis is your active listing. It will be closed and removed from the purchasable Marketplace. Existing purchase history, if any, will remain unchanged.`
      : `Remove "${item.name}" from the Clan Marketplace? Purchase history will remain unchanged.`

    if (!window.confirm(confirmation)) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('marketplace_remove_listing', {
        p_staff_id: currentUser.id,
        p_item_id: item.id,
      })
      if (error) throw error
      addToast(`"${item.name}" was removed from the Clan Marketplace.`, 'blue', 'Listing Removed')
      await load()
    } catch (error) {
      addToast(error?.message || 'Could not remove listing.', 'red', 'Remove Failed')
    } finally { setBusy(false) }
  }

  const deletableSubmissionStatuses = ['pending_review', 'rejected', 'expired', 'closed']

  const submissionsWithPurchaseHistory = useMemo(
    () => new Set((purchases || []).map(purchase => String(purchase.item_id))),
    [purchases]
  )

  const deletableSubmissions = useMemo(
    () => mySubmissions.filter(item =>
      deletableSubmissionStatuses.includes(item.status) &&
      !submissionsWithPurchaseHistory.has(String(item.id))
    ),
    [mySubmissions, submissionsWithPurchaseHistory]
  )

  const toggleSubmissionSelection = itemId => {
    const id = String(itemId)
    setSelectedSubmissionIds(prev => prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id])
  }

  const selectAllSubmissions = checked => {
    setSelectedSubmissionIds(checked ? deletableSubmissions.map(item => String(item.id)) : [])
  }

  const deleteSelectedSubmissions = async ids => {
    if (!canSubmit || busy) return

    const normalizedIds = [...new Set((ids || []).map(id => String(id)).filter(Boolean))]
    if (normalizedIds.length === 0) return

    if (!window.confirm(
      `Delete ${normalizedIds.length} selected Marketplace submission${normalizedIds.length === 1 ? '' : 's'}?\\n\\nThis permanently removes the selected submission records from your My Submissions list. Active or sold listings are not included.`
    )) {
      return
    }

    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('marketplace_delete_my_submissions_bulk', {
        p_actor_id: Number(currentUser.id),
        p_item_ids: normalizedIds,
      })

      if (error) throw error

      const deletedCount = Number(data) || normalizedIds.length
      setSelectedSubmissionIds([])
      addToast(
        `${deletedCount} Marketplace submission${deletedCount === 1 ? '' : 's'} deleted.`,
        'blue',
        'Submissions Deleted'
      )
      await load()
    } catch (error) {
      const message = String(error?.message || 'Could not delete Marketplace submissions.')
      if (/PGRST202|Could not find the function|schema cache/i.test(message)) {
        addToast(
          'The Marketplace submission-delete RPC is missing in Supabase. Run the submission delete SQL once, then try again.',
          'red',
          'Database Setup Required'
        )
      } else {
        addToast(message, 'red', 'Delete Failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const toggleListingSelection = itemId => {
    const id = String(itemId)
    setSelectedListingIds(prev => prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id])
  }

  const selectAllListings = checked => {
    setSelectedListingIds(checked ? activeListings.map(item => String(item.id)) : [])
  }

  const removeSelectedListings = async ids => {
    if (!canBulkRemoveListings || busy) return
    const normalizedIds = [...new Set((ids || []).map(id => String(id)).filter(Boolean))]
    if (normalizedIds.length === 0) return

    const message = `Remove ${normalizedIds.length} selected Marketplace listing${normalizedIds.length === 1 ? '' : 's'}?\n\nThe listing${normalizedIds.length === 1 ? '' : 's'} will be removed from active Marketplace management and marked closed. Existing purchase history will remain unchanged.`
    if (!window.confirm(message)) return

    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('marketplace_remove_listings_bulk', {
        p_staff_id: currentUser.id,
        p_item_ids: normalizedIds,
      })
      if (error) throw error
      const removedCount = Number(data) || normalizedIds.length
      setSelectedListingIds([])
      addToast(`${removedCount} Marketplace listing${removedCount === 1 ? '' : 's'} removed. Purchase history was preserved.`, 'blue', 'Listings Removed')
      await load()
    } catch (error) {
      addToast(error?.message || 'Could not remove Marketplace listings.', 'red', 'Listing Removal Failed')
    } finally {
      setBusy(false)
    }
  }

  const toggleHistorySelection = purchaseId => {
    const id = String(purchaseId)
    setSelectedHistoryIds(prev => prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id])
  }

  const selectAllHistory = checked => {
    setSelectedHistoryIds(checked ? purchases.map(p => String(p.id)) : [])
  }

  const deletePurchaseHistory = async ids => {
    if (!canManageHistory || busy) return
    const normalizedIds = [...new Set((ids || []).map(id => String(id)).filter(Boolean))]
    if (normalizedIds.length === 0) return

    const isAll = normalizedIds.length === purchases.length && purchases.length > 0
    const message = isAll
      ? `Delete ALL ${normalizedIds.length} Marketplace purchase history records?\n\nThis only removes purchase history records. Marketplace listings and member coin balances will not be changed.`
      : `Delete ${normalizedIds.length} selected Marketplace purchase history record${normalizedIds.length === 1 ? '' : 's'}?\n\nThis only removes purchase history records. Marketplace listings and member coin balances will not be changed.`

    if (!window.confirm(message)) return

    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('marketplace_delete_purchase_history_bulk', {
        p_staff_id: currentUser.id,
        p_purchase_ids: normalizedIds,
      })
      if (error) throw error
      const deletedCount = Number(data) || normalizedIds.length
      setSelectedHistoryIds([])
      addToast(`${deletedCount} Marketplace purchase history record${deletedCount === 1 ? '' : 's'} deleted.`, 'blue', 'History Deleted')
      await load()
    } catch (error) {
      addToast(error?.message || 'Could not delete Marketplace purchase history.', 'red', 'History Delete Failed')
    } finally {
      setBusy(false)
    }
  }

  const shopTabs = [
    { id: 'shop', label: 'Shop' },
    { id: 'orders', label: 'My Purchases' },
    { id: 'history', label: 'Marketplace History', count: purchases.length },
    ...(canSubmit ? [{ id: 'listings', label: 'My Submissions' }] : []),
    ...(isStaff ? [{ id: 'management', label: role === ROLES.ELDER ? 'Distribution' : 'Management' }] : []),
  ]

  const staffTabs = canReview
    ? [
        { id: 'pending', label: 'Pending Review', count: pendingItems.length },
        { id: 'active', label: 'Active Listings', count: activeListings.length },
        { id: 'history', label: 'Purchase History', count: purchases.length },
        { id: 'distribution', label: 'Distribution', count: distributionQueue.length },
      ]
    : [
        { id: 'history', label: 'Purchase History', count: purchases.length },
        { id: 'distribution', label: 'Distribution Queue', count: distributionQueue.length },
      ]

  return (
    <>
      <style>{`
        @media (min-width: 1024px) {
          .marketplace-orders-grid {
            grid-template-columns: minmax(0, 1fr) 150px 180px 220px !important;
          }

          .marketplace-orders-grid > :nth-child(2),
          .marketplace-orders-grid > :nth-child(3) {
            justify-self: center;
            width: 100%;
            text-align: center;
          }

          .marketplace-orders-grid > :nth-child(4) {
            justify-self: end;
            width: 100%;
            text-align: right;
          }
        }
      `}</style>

      <div className="space-y-4 pb-10">
      {/* MEMBER MARKETPLACE */}
      <section className="relative overflow-hidden rounded-[18px] border border-gold/15 bg-[#090807]/95 shadow-[0_18px_70px_rgba(0,0,0,.24)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(242,204,96,.08),transparent_28%),linear-gradient(110deg,rgba(255,255,255,.018),transparent_45%)]" />
        <div className="relative flex flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-5 sm:py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-gold-dim"><span className="h-px w-5 bg-gold/50" /> Clan Trade Hall</div>
            <h1 className="mt-1.5 font-spectral text-3xl font-bold uppercase tracking-[.02em] text-gold-light sm:text-[34px]">Marketplace</h1>
            <p className="mt-1 text-[12px] text-text-dim">Browse items supplied by the PeakyBlinder Clan. Listings are clan-owned.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-stretch">
            <div className="w-full rounded-xl border border-gold/15 bg-gold/[.035] px-4 py-3 sm:min-w-[145px] sm:w-auto">
              <div className="text-[9px] font-bold uppercase tracking-[.16em] text-text-dim">Your Coins</div>
              <div className="mt-1 font-mono text-xl font-bold text-gold-bright">{formatCoins(displayCoins)}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[.12em] text-gold-dim">Clan Balance</div>
            </div>
            {canSubmit && <button type="button" onClick={openSubmit} className="w-full rounded-xl border border-gold/30 bg-gold/[.07] px-4 py-3 text-left transition hover:border-gold/50 hover:bg-gold/[.12] sm:min-w-[145px] sm:w-auto"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-gold-dim">Staff Tools</div><div className="mt-1 text-[12px] font-bold uppercase tracking-[.08em] text-gold-light">Submit Item</div><div className="mt-1 text-[9px] text-text-dim">Submit a clan inventory item for review</div></button>}
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-white/[.07] bg-black/25 p-1.5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 w-full flex-nowrap gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible">{shopTabs.map(t => <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[.12em] transition sm:px-4 ${tab === t.id ? 'border border-gold/25 bg-gold/[.09] text-gold-bright' : 'border border-transparent text-text-dim hover:bg-white/[.025] hover:text-gold-light'}`}>{t.label}</button>)}</div>
          <button type="button" onClick={load} disabled={loading} className="w-full rounded-lg border border-white/[.08] px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[.12em] text-text-dim hover:border-gold/20 hover:text-gold-light disabled:opacity-40 md:w-auto">{loading ? 'Refreshing…' : '↻ Refresh'}</button>
        </div>
      </section>

      {tab === 'shop' && (
        <>
          <section className="mt-3 rounded-xl border border-white/[.07] bg-black/20 p-3">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_145px_145px]">
              <label className="flex h-10 items-center gap-2 rounded-lg border border-white/[.08] bg-black/25 px-3"><span className="text-text-dim/50">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." className="min-w-0 flex-1 bg-transparent text-[11px] text-text outline-none placeholder:text-text-dim/35" /></label>
              <select value={rarityFilter} onChange={e => setRarityFilter(e.target.value)} className="h-10 rounded-lg border border-white/[.08] bg-[#0b0908] px-3 text-[11px] text-text-dim outline-none"><option value="all">All Rarities</option>{RARITIES.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}</select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="h-10 rounded-lg border border-white/[.08] bg-[#0b0908] px-3 text-[11px] text-text-dim outline-none"><option value="newest">Newest</option><option value="price_low">Price: Low</option><option value="price_high">Price: High</option><option value="stock">Stock</option></select>
            </div>
          </section>

          <section className="mt-5">
            {loading ? null : filteredActiveItems.length > 0 ? (
              <>
                <SectionTitle title="Available Now" />
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{filteredActiveItems.map(item => <MemoizedItemCard key={item.id} item={item} onBuy={openBuy} canBuy={canBuy} />)}</div>
              </>
            ) : activeItems.length === 0 ? (
              <div className="relative overflow-hidden rounded-[20px] border border-gold/15 bg-[#080706]/95 shadow-[0_18px_70px_rgba(0,0,0,.28)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(242,204,96,.095),transparent_30%),linear-gradient(135deg,rgba(255,255,255,.018),transparent_42%,rgba(242,204,96,.018))]" />
                <div className="pointer-events-none absolute inset-x-[8%] top-0 h-px bg-gradient-to-r from-transparent via-gold/35 to-transparent" />
                <div className="pointer-events-none absolute inset-x-[18%] bottom-0 h-px bg-gradient-to-r from-transparent via-gold/12 to-transparent" />
                <div className="relative px-5 py-9 sm:px-10 sm:py-10">
                  <div className="mx-auto max-w-3xl">
                    <div className="flex flex-col items-center text-center">
                      <div className="inline-flex items-center gap-2.5 rounded-full border border-gold/15 bg-gold/[.035] px-3.5 py-1.5 text-[8px] font-bold uppercase tracking-[.24em] text-gold-dim">
                        <span className="h-1.5 w-1.5 rounded-full bg-gold/65 shadow-[0_0_10px_rgba(242,204,96,.5)]" />
                        Marketplace Status
                        <span className="text-gold/25">•</span>
                        Standby
                      </div>
                      <div className="relative mt-5 flex h-[68px] w-[68px] items-center justify-center rounded-[20px] border border-gold/20 bg-black/25 shadow-[0_0_55px_rgba(242,204,96,.07)]">
                        <div className="absolute inset-2 rounded-[15px] border border-gold/10" />
                        <span className="relative font-spectral text-[27px] text-gold/70">◇</span>
                      </div>
                      <h3 className="mt-4 font-spectral text-[27px] font-bold tracking-[-.01em] text-gold-light sm:text-[30px]">The Shelves Are Empty</h3>
                      <p className="mx-auto mt-2 max-w-xl text-[11px] leading-5 text-text-dim sm:text-[12px]">No clan packages are available for purchase right now. Approved inventory will appear here automatically when it is ready for members.</p>
                      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
                        <div className="flex items-center gap-2 rounded-lg border border-white/[.07] bg-white/[.018] px-3.5 py-2.5">
                          <span className="font-mono text-sm font-bold text-text-bright">0</span>
                          <span className="text-[8px] font-bold uppercase tracking-[.15em] text-text-dim/55">Active Packages</span>
                        </div>
                        <span className="hidden h-4 w-px bg-white/[.08] sm:block" />
                        <div className="flex items-center gap-2 rounded-lg border border-gold/10 bg-gold/[.025] px-3.5 py-2.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-gold/60" />
                          <span className="text-[8px] font-bold uppercase tracking-[.15em] text-gold-dim/70">Awaiting New Stock</span>
                        </div>
                      </div>
                      <button type="button" onClick={load} disabled={loading} className="mt-6 rounded-lg border border-gold/25 bg-gold/[.07] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[.14em] text-gold-light transition hover:border-gold/45 hover:bg-gold/[.12] disabled:opacity-40">↻ Refresh Inventory</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/[.08] bg-[#080706]/90 px-5 py-12">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(242,204,96,.045),transparent_34%)]" />
                <div className="relative mx-auto max-w-lg text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/[.09] bg-white/[.025] text-2xl text-gold-dim/60">⌕</div>
                  <h3 className="mt-4 font-spectral text-xl font-bold text-text-bright">No Matching Listings</h3>
                  <p className="mt-1.5 text-[11px] leading-5 text-text-dim">No active package matches your current search or rarity filter.</p>
                  <button type="button" onClick={() => { setSearch(''); setRarityFilter('all'); setSortBy('newest') }} className="mt-5 rounded-lg border border-white/[.1] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.12em] text-text-dim transition hover:border-gold/25 hover:text-gold-light">Clear Filters</button>
                </div>
              </div>
            )}
          </section>

          {filteredSoldItems.length > 0 && (
            <section className="mt-8">
              <div className="flex flex-col gap-1 border-b border-white/[.06] pb-3 sm:flex-row sm:items-end sm:justify-between">
                <SectionTitle eyebrow="Marketplace History" title="Sold Inventory" description="Previously sold Clan Marketplace packages remain visible here with the member who purchased each package. They cannot be purchased again." />
                <div className="text-[11px] font-bold uppercase tracking-[.14em] text-text-dim/55">{filteredSoldItems.length} sold</div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {filteredSoldItems.map(item => (
                  <MemoizedItemCard
                    key={item.id}
                    item={item}
                    sold
                    onBuy={setBuyItem}
                    canBuy={canBuy}
                    buyerName={buyerForItem(item.id)}
                    purchasedAt={purchasedAtForItem(item.id)}
                  />
                ))}
              </div>
            </section>
          )}

        </>
      )}

      {tab === 'orders' && (
        <section className="mt-5 overflow-hidden rounded-[18px] border border-gold/10 bg-[#090807]/95 shadow-[0_18px_60px_rgba(0,0,0,.22)]">
          <div className="border-b border-white/[.07] px-5 py-5">
            <SectionTitle eyebrow="Member History" title="My Purchases" description="Every purchase keeps its original price snapshot." />
          </div>

          {myPurchases.length === 0 ? (
            <div className="px-5 py-14 text-center text-[12px] text-text-dim">No purchases yet.</div>
          ) : (
            <div>
              <div className="marketplace-orders-grid hidden border-b border-white/[.06] bg-white/[.018] px-5 py-3 text-[12px] font-bold uppercase tracking-[.16em] text-gold-dim lg:grid lg:gap-3">
                <div>Item</div>
                <div className="text-center">Price</div>
                <div className="text-center">Status</div>
                <div className="text-right">Distributed By</div>
              </div>

              <div className="divide-y divide-white/[.055]">
                {myPurchases.map(p => {
                  const purchaseItem = items.find(item => item.id === p.item_id)
                  const purchaseRarity = purchaseItem?.rarity

                  return (
                    <div key={p.id} className="group px-4 py-[18px] transition-colors duration-150 hover:bg-white/[.018] sm:px-5">
                      <div className="marketplace-orders-grid grid gap-3 lg:items-center lg:gap-3">
                        <div className="flex min-w-0 items-center gap-3.5">
                          <div className="shrink-0">
                            <ItemArtwork item={purchaseItem} size="table" />
                          </div>
                          <div className="min-w-0">
                            <div className={`truncate text-[15px] font-semibold leading-5 tracking-[.005em] ${rarityTextClass(purchaseRarity)}`}>
                              {itemName(p.item_id)}
                            </div>
                            <div className="mt-1.5 text-[12px] leading-5 text-text-dim">
                              Quantity {itemPackageQuantity(p.item_id)}×
                              <span className="mx-1.5 text-white/15">•</span>
                              Purchased {formatDate(p.purchased_at)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:block lg:text-center">
                          <span className="text-[10px] font-bold uppercase tracking-[.12em] text-text-dim/50 lg:hidden">Price</span>
                          <div className="inline-flex flex-col items-center rounded-lg border border-gold/10 bg-gold/[.035] px-3 py-2">
                            <span className="font-mono text-[14px] font-bold leading-5 text-gold-light">{formatCoins(p.total_price)}</span>
                            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.12em] text-gold-dim">Coins</span>
                          </div>
                        </div>

                        <div className="flex min-w-0 items-center justify-between gap-3 lg:block lg:text-center">
                          <span className="text-[10px] font-bold uppercase tracking-[.12em] text-text-dim/50 lg:hidden">Status</span>
                          <div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.09em] ${statusClass(p.status)}`}>
                              {statusLabel(p.status)}
                            </span>
                            <div className="mt-1.5 text-[12px] leading-4 text-text-dim">
                              {p.status === 'purchased' ? 'Awaiting distribution' : 'Item successfully distributed'}
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0 flex items-center justify-between gap-3 lg:block lg:text-right">
                          <span className="text-[10px] font-bold uppercase tracking-[.12em] text-text-dim/50 lg:hidden">Distributed By</span>
                          <div>
                            {p.distributed_by ? (
                              <>
                                <div className="truncate text-[13px] font-semibold leading-5 text-text-bright">{memberName(p.distributed_by)}</div>
                                <div className="mt-1 text-[11px] leading-4 text-text-dim">Marketplace staff</div>
                              </>
                            ) : (
                              <>
                                <div className="text-[13px] font-medium leading-5 text-text-dim">Not distributed yet</div>
                                <div className="mt-1 text-[11px] leading-4 text-text-dim">Awaiting fulfillment</div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'history' && (
        <section className="mt-5 overflow-hidden rounded-[18px] border border-gold/10 bg-[#090807]/95 shadow-[0_18px_60px_rgba(0,0,0,.22)]">
          <div className="relative border-b border-white/[.07] px-5 py-5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_0%,rgba(242,204,96,.055),transparent_34%)]" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle
                eyebrow="Clan Activity"
                title="Marketplace History"
                description="Recent Marketplace purchases across the clan. This view is read-only for members."
              />
              <div className="shrink-0 rounded-lg border border-gold/10 bg-gold/[.035] px-3 py-2 text-center">
                <div className="font-mono text-[14px] font-bold text-gold-light">{formatCoins(purchases.length)}</div>
                <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.12em] text-gold-dim">Transactions</div>
              </div>
            </div>
          </div>

          {purchases.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/[.08] bg-white/[.02] text-2xl text-gold-dim/55">◈</div>
              <h3 className="mt-4 font-spectral text-xl font-bold text-text-bright">No Marketplace Activity</h3>
              <p className="mt-1.5 text-[11px] leading-5 text-text-dim">Purchase transactions will appear here once members start trading in the Clan Marketplace.</p>
            </div>
          ) : (
            <div>
              <div className="marketplace-history-grid hidden border-b border-white/[.06] bg-white/[.018] px-5 py-3 text-[11px] font-bold uppercase tracking-[.16em] text-gold-dim lg:grid lg:grid-cols-[minmax(0,1fr)_160px_90px_150px_150px_220px] lg:gap-3">
                <div>Item</div>
                <div className="text-center">Buyer</div>
                <div className="text-center">Qty</div>
                <div className="text-center">Total</div>
                <div className="text-center">Status</div>
                <div className="text-right">Purchased</div>
              </div>

              <div className="divide-y divide-white/[.055]">
                {purchases.map(p => {
                  const purchaseItem = items.find(item => item.id === p.item_id)
                  const purchaseRarity = purchaseItem?.rarity

                  return (
                    <div key={p.id} className="group px-4 py-4 transition-colors duration-150 hover:bg-white/[.018] sm:px-5">
                      <div className="marketplace-history-grid grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_90px_150px_150px_220px] lg:items-center lg:gap-3">
                        <div className="flex min-w-0 items-center gap-3.5">
                          <div className="shrink-0">
                            <ItemArtwork item={purchaseItem} size="table" />
                          </div>
                          <div className="min-w-0 flex items-center gap-2">
                            <div className={`min-w-0 truncate text-[16px] font-semibold leading-5 ${rarityTextClass(purchaseRarity)}`}>
                              {itemName(p.item_id)}
                            </div>
                            <span className="shrink-0 text-[12px] font-medium capitalize leading-5 text-text-dim/80">
                              {purchaseRarity || 'Common'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:flex lg:h-full lg:items-center lg:justify-center lg:text-center">
                          <span className="text-[9px] font-bold uppercase tracking-[.12em] text-text-dim/50 lg:hidden">Buyer</span>
                          <span className="inline-block max-w-full truncate text-[13px] font-semibold text-text-bright lg:max-w-full">{memberName(p.buyer_id)}</span>
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:flex lg:h-full lg:items-center lg:justify-center lg:text-center">
                          <span className="text-[9px] font-bold uppercase tracking-[.12em] text-text-dim/50 lg:hidden">Quantity</span>
                          <span className="font-mono text-[13px] text-text-dim">{itemPackageQuantity(p.item_id)}×</span>
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:flex lg:h-full lg:items-center lg:justify-center lg:text-center">
                          <span className="text-[9px] font-bold uppercase tracking-[.12em] text-text-dim/50 lg:hidden">Total</span>
                          <div>
                            <span className="font-mono text-[14px] font-bold text-gold-light">{formatCoins(p.total_price)}</span>
                            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[.08em] text-gold-dim">Coins</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:flex lg:h-full lg:items-center lg:justify-center lg:text-center">
                          <span className="text-[9px] font-bold uppercase tracking-[.12em] text-text-dim/50 lg:hidden">Status</span>
                          <span className={`inline-flex rounded-full border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] ${statusClass(p.status)}`}>
                            {statusLabel(p.status)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:flex lg:h-full lg:items-center lg:justify-end lg:text-right">
                          <span className="text-[9px] font-bold uppercase tracking-[.12em] text-text-dim/50 lg:hidden">Purchased</span>
                          <div>
                            <div className="text-[13px] text-text-dim">{formatDate(p.purchased_at)}</div>
                            {p.distributed_by && (
                              <div className="mt-1 text-[10px] text-text-dim/55">
                                Distributed by {memberName(p.distributed_by)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'listings' && canSubmit && <section className="mt-5 rounded-xl border border-white/[.08] bg-[#090807]/90">
        <div className="border-b border-white/[.06] px-4 py-4">
          <SectionTitle
            eyebrow="Staff Submissions"
            title="My Submissions"
            description="Track clan inventory items you submitted for review."
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {deletableSubmissions.length > 0 && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => selectAllSubmissions(selectedSubmissionIds.length !== deletableSubmissions.length)}
                      className="rounded-lg border border-white/[.09] px-3 py-2 text-[10px] font-bold uppercase tracking-[.1em] text-text-dim transition hover:border-gold/25 hover:text-gold-light disabled:opacity-40"
                    >
                      {selectedSubmissionIds.length === deletableSubmissions.length && deletableSubmissions.length > 0 ? 'Clear All' : 'Select All'}
                    </button>
                    <button
                      type="button"
                      disabled={busy || selectedSubmissionIds.length === 0}
                      onClick={() => deleteSelectedSubmissions(selectedSubmissionIds)}
                      className="rounded-lg border border-red-400/20 bg-red-400/[.045] px-3 py-2 text-[10px] font-bold uppercase tracking-[.1em] text-red-300 transition hover:bg-red-400/[.08] disabled:opacity-40"
                    >
                      Delete Selected{selectedSubmissionIds.length > 0 ? ` (${selectedSubmissionIds.length})` : ''}
                    </button>
                  </>
                )}
                <button type="button" onClick={openSubmit} className="rounded-lg border border-gold/30 bg-gold/[.07] px-3 py-2 text-[10px] font-bold uppercase tracking-[.1em] text-gold-light">
                  ＋ New Item
                </button>
              </div>
            }
          />
        </div>

        {selectedSubmissionIds.length > 0 && (
          <div className="flex items-center justify-between border-b border-gold/10 bg-gold/[.025] px-4 py-2.5 text-[10px]">
            <span className="font-semibold text-gold-light">
              {selectedSubmissionIds.length} submission{selectedSubmissionIds.length === 1 ? '' : 's'} selected
            </span>
            <button type="button" onClick={() => setSelectedSubmissionIds([])} className="text-text-dim hover:text-text-bright">
              Clear selection
            </button>
          </div>
        )}

        {mySubmissions.length === 0 ? (
          <div className="px-4 py-12 text-center text-[11px] text-text-dim">You have not submitted any clan items.</div>
        ) : (
          <div className="divide-y divide-white/[.05]">
            {mySubmissions.map(item => {
              const hasPurchaseHistory = submissionsWithPurchaseHistory.has(String(item.id))
              const canDeleteSubmission = deletableSubmissionStatuses.includes(item.status) && !hasPurchaseHistory
              const selected = selectedSubmissionIds.includes(String(item.id))

              return (
                <div key={item.id} className={`px-4 py-4 ${selected ? 'bg-gold/[.035]' : ''}`}>
                  <div className={`grid gap-3 md:items-center ${deletableSubmissions.length > 0 ? 'md:grid-cols-[32px_44px_minmax(0,1fr)_100px_110px_110px]' : 'md:grid-cols-[44px_minmax(0,1fr)_100px_110px_110px]'}`}>
                    {deletableSubmissions.length > 0 && (
                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!canDeleteSubmission || busy}
                          onChange={() => toggleSubmissionSelection(item.id)}
                          aria-label={hasPurchaseHistory ? `${item.name} cannot be deleted because it has purchase history` : `Select ${item.name}`}
                          title={hasPurchaseHistory ? 'Cannot permanently delete: this submission has purchase history.' : undefined}
                          className="h-4 w-4 accent-[#d4af37] disabled:cursor-not-allowed disabled:opacity-25"
                        />
                      </div>
                    )}

                    <ItemArtwork item={item} size="table" />

                    <div>
                      <div className={`text-[11px] font-semibold ${rarityTextClass(item.rarity)}`}>{item.name}</div>
                      <div className="mt-1 text-[10px] text-text-dim">Submitted {formatDate(item.submitted_at)}</div>
                      {hasPurchaseHistory && (
                        <div className="mt-1 text-[9px] font-semibold uppercase tracking-[.08em] text-amber-300/70">Purchase history • Cannot permanently delete</div>
                      )}
                    </div>

                    <div className="font-mono text-[11px] font-bold text-gold-light">{formatCoins(item.price)}</div>
                    <div className="text-[11px] text-text-dim">{Math.max(1, Number(item.bundle_quantity ?? item.stock) || 1)}× package</div>
                    <div>
                      <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                  </div>

                  {!canDeleteSubmission && (
                    <div className="mt-2 pl-0 text-[9px] text-text-dim/45 md:pl-[76px]">
                      {item.status === 'active' ? 'Active listings cannot be deleted while they are available for purchase.' : 'This listing is protected from deletion.'}
                    </div>
                  )}

                  {item.status === 'rejected' && (
                    <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[.045] px-3 py-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-[.14em] text-red-300/75">Rejection Reason</div>
                      <div className="mt-1 text-[11px] leading-5 text-red-100/80">{item.rejection_reason || 'No reason was provided by the reviewer.'}</div>
                      {item.rejected_at && <div className="mt-1 text-[9px] text-red-200/40">Reviewed {formatDate(item.rejected_at)}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>}


      {tab === 'management' && isStaff && (
  <section className="mt-5">
    <div className="relative overflow-hidden rounded-[18px] border border-gold/15 bg-[#090a0b]/95 shadow-[0_18px_60px_rgba(0,0,0,.22)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_0%,rgba(242,204,96,.07),transparent_30%)]" />

      <div className="relative flex flex-col gap-4 border-b border-white/[.07] px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.22em] text-gold-dim">
            <span className="h-px w-5 bg-gold/50" /> Staff Console
          </div>
          <h2 className="mt-1.5 font-spectral text-2xl font-bold uppercase text-gold-light">Marketplace Management</h2>
          <p className="mt-1.5 text-[13px] leading-5 text-text-dim">Approvals, active listings, purchase history, and in-game distribution.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/[.08] bg-white/[.02] px-3 py-2 text-[11px] font-bold uppercase tracking-[.1em] text-text-dim">{role}</span>
          {canSubmit && <button type="button" onClick={openSubmit} className="rounded-lg border border-gold/30 bg-gold/[.08] px-3 py-2.5 text-[11px] font-bold uppercase tracking-[.1em] text-gold-light hover:bg-gold/[.12]">＋ Add Listing</button>}
        </div>
      </div>

      <div className="relative border-b border-white/[.07] px-3 py-3">
        <div className="flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
          {staffTabs.map(t => (
            <button key={t.id} type="button" onClick={() => setStaffTab(t.id)} className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-3 text-[11px] font-bold uppercase tracking-[.08em] transition-colors sm:px-4 ${staffTab === t.id ? 'border border-gold/25 bg-gold/[.09] text-gold-bright' : 'border border-transparent text-text-dim hover:bg-white/[.025] hover:text-gold-light'}`}>
              {t.label}
              {Number(t.count) > 0 && <span className="rounded-full bg-white/[.08] px-2 py-0.5 text-[10px]">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="relative p-4 sm:p-5">

        {staffTab === 'pending' && canReview && (
          <div className="overflow-hidden rounded-xl border border-white/[.07]">
            <div className="hidden bg-white/[.035] px-4 py-3 text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim md:grid md:grid-cols-[56px_minmax(240px,1.7fr)_110px_80px_110px_150px_190px] md:items-center md:gap-3 md:text-center">
              <span />
              <span className="text-left">Item</span><span>Price</span><span>Qty</span><span>Duration</span><span>Submitted By</span><span>Actions</span>
            </div>
            {pendingItems.length === 0 ? (
              <div className="px-5 py-14 text-center text-[12px] text-text-dim">No listings waiting for review.</div>
            ) : pendingItems.map(item => (
              <div key={item.id} className="grid gap-4 border-t border-white/[.055] px-4 py-4 md:grid-cols-[56px_minmax(240px,1.7fr)_110px_80px_110px_150px_190px] md:items-center md:gap-3 md:text-center">
                <div className="flex justify-center"><ItemArtwork item={item} size="table" /></div>
                <div className="min-w-0 text-left">
                  <div className={`truncate text-[14px] font-semibold ${rarityTextClass(item.rarity)}`}>{item.name}</div>
                  <div className="mt-1.5 text-[11px] text-text-dim">{item.rarity} <span className="mx-1 text-white/15">•</span> {formatShortDate(item.submitted_at)}</div>
                </div>
                <div className="font-mono text-[13px] font-bold text-gold-light">{formatCoins(item.price)}</div>
                <div className="text-[12px] text-text-dim">{Math.max(1, Number(item.bundle_quantity ?? item.stock) || 1)}×</div>
                <div className="text-[12px] text-text-dim">{Math.max(1, Math.ceil((new Date(item.available_until).getTime() - new Date(item.available_from).getTime()) / 86400000))} days</div>
                <div className="text-[12px] text-text-dim">{memberName(item.submitted_by)}</div>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => setReviewItem(item)} className="rounded-md border border-emerald-400/25 bg-emerald-400/[.06] px-3 py-2 text-[10px] font-bold uppercase text-emerald-300 hover:bg-emerald-400/[.1]">Review</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {staffTab === 'active' && canReview && (
          <div className="overflow-hidden rounded-xl border border-white/[.07]">
            {canBulkRemoveListings && (
              <div className="flex flex-col gap-3 border-b border-white/[.07] bg-white/[.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim">Listing Management</div>
                  <div className="mt-1 text-[11px] text-text-dim">Select multiple listings to remove them from Marketplace management. Purchase history stays intact.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={busy || activeListings.length === 0} onClick={() => selectAllListings(selectedListingIds.length !== activeListings.length)} className="rounded-md border border-white/[.09] px-3 py-2 text-[9px] font-bold uppercase tracking-[.08em] text-text-dim hover:border-gold/25 hover:text-gold-light disabled:opacity-40">
                    {selectedListingIds.length === activeListings.length && activeListings.length > 0 ? 'Clear All' : 'Select All'}
                  </button>
                  <button type="button" disabled={busy || selectedListingIds.length === 0} onClick={() => removeSelectedListings(selectedListingIds)} className="rounded-md border border-red-400/20 bg-red-400/[.045] px-3 py-2 text-[9px] font-bold uppercase tracking-[.08em] text-red-300 hover:bg-red-400/[.08] disabled:opacity-40">
                    Remove Selected{selectedListingIds.length > 0 ? ` (${selectedListingIds.length})` : ''}
                  </button>
                </div>
              </div>
            )}

            {selectedListingIds.length > 0 && canBulkRemoveListings && (
              <div className="flex items-center justify-between border-b border-gold/10 bg-gold/[.025] px-4 py-2.5 text-[10px]">
                <span className="font-semibold text-gold-light">{selectedListingIds.length} listing{selectedListingIds.length === 1 ? '' : 's'} selected</span>
                <button type="button" onClick={() => setSelectedListingIds([])} className="text-text-dim hover:text-text-bright">Clear selection</button>
              </div>
            )}

            <div className={`hidden bg-white/[.035] px-4 py-3 text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim md:grid md:items-center md:gap-3 md:text-center ${canBulkRemoveListings ? 'md:grid-cols-[36px_minmax(260px,1.8fr)_120px_100px_130px_110px]' : 'md:grid-cols-[minmax(260px,1.8fr)_120px_100px_130px_110px]'}`}>
              {canBulkRemoveListings && <span />}
              <span className="text-left">Item</span><span>Price</span><span>Quantity</span><span>Availability</span><span>Action</span>
            </div>

            {activeListings.length === 0 ? (
              <div className="px-5 py-14 text-center text-[12px] text-text-dim">No active Marketplace listings.</div>
            ) : activeListings.map(item => {
              const selected = selectedListingIds.includes(String(item.id))
              return (
                <div key={item.id} className={`grid gap-4 border-t border-white/[.055] px-4 py-4 md:items-center md:gap-3 md:text-center ${canBulkRemoveListings ? 'md:grid-cols-[36px_minmax(260px,1.8fr)_120px_100px_130px_110px]' : 'md:grid-cols-[minmax(260px,1.8fr)_120px_100px_130px_110px]'} ${selected ? 'bg-gold/[.035]' : ''}`}>
                  {canBulkRemoveListings && (
                    <div className="flex justify-start md:justify-center">
                      <input type="checkbox" checked={selected} onChange={() => toggleListingSelection(item.id)} disabled={busy} aria-label={`Select listing ${item.name}`} className="h-4 w-4 accent-gold" />
                    </div>
                  )}
                  <div className="flex min-w-0 items-center gap-3 text-left">
                    <ItemArtwork item={item} size="table" />
                    <div className="min-w-0">
                      <div className={`truncate text-[14px] font-semibold ${rarityTextClass(item.rarity)}`}>{item.name}</div>
                      <div className="mt-1.5 text-[11px] text-text-dim">{item.rarity} · {statusLabel(item.status)}</div>
                    </div>
                  </div>
                  <div className="font-mono text-[13px] font-bold text-gold-light">{formatCoins(item.price)}</div>
                  <div className="text-[12px] text-text-dim">{Math.max(1, Number(item.bundle_quantity ?? item.stock) || 1)}×</div>
                  <div className="text-[12px] text-text-dim">{timeRemaining(item.available_until)}</div>
                  <div className="flex justify-center">{item.status === 'active' || item.status === 'sold_out' ? <button type="button" onClick={() => closeListing(item)} disabled={busy} className="rounded-md border border-red-400/20 px-3 py-2 text-[10px] font-bold uppercase text-red-300 hover:bg-red-400/[.06] disabled:opacity-40">Close</button> : null}</div>
                </div>
              )
            })}
          </div>
        )}

        {staffTab === 'history' && canManageHistory && (
          <div className="overflow-hidden rounded-xl border border-white/[.07]">
            <div className="flex flex-col gap-3 border-b border-white/[.07] bg-white/[.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim">Marketplace History Management</div>
                <div className="mt-1 text-[11px] text-text-dim">Select individual purchase records or manage the entire visible history.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy || purchases.length === 0} onClick={() => selectAllHistory(selectedHistoryIds.length !== purchases.length)} className="rounded-md border border-white/[.09] px-3 py-2 text-[9px] font-bold uppercase tracking-[.08em] text-text-dim hover:border-gold/25 hover:text-gold-light disabled:opacity-40">
                  {selectedHistoryIds.length === purchases.length && purchases.length > 0 ? 'Clear All' : 'Select All'}
                </button>
                <button type="button" disabled={busy || selectedHistoryIds.length === 0} onClick={() => deletePurchaseHistory(selectedHistoryIds)} className="rounded-md border border-red-400/20 bg-red-400/[.045] px-3 py-2 text-[9px] font-bold uppercase tracking-[.08em] text-red-300 hover:bg-red-400/[.08] disabled:opacity-40">
                  Delete Selected{selectedHistoryIds.length > 0 ? ` (${selectedHistoryIds.length})` : ''}
                </button>
                <button type="button" disabled={busy || purchases.length === 0} onClick={() => deletePurchaseHistory(purchases.map(p => p.id))} className="rounded-md border border-red-400/30 px-3 py-2 text-[9px] font-bold uppercase tracking-[.08em] text-red-200 hover:bg-red-400/[.08] disabled:opacity-40">
                  Delete All History
                </button>
              </div>
            </div>

            {selectedHistoryIds.length > 0 && (
              <div className="flex items-center justify-between border-b border-gold/10 bg-gold/[.025] px-4 py-2.5 text-[10px]">
                <span className="font-semibold text-gold-light">{selectedHistoryIds.length} record{selectedHistoryIds.length === 1 ? '' : 's'} selected</span>
                <button type="button" onClick={() => setSelectedHistoryIds([])} className="text-text-dim hover:text-text-bright">Clear selection</button>
              </div>
            )}

            <div className="hidden bg-white/[.035] px-4 py-3 text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim md:grid md:grid-cols-[36px_minmax(240px,1.4fr)_130px_80px_120px_130px_160px] md:items-center md:gap-3 md:text-center">
              <span />
              <span className="text-left">Item</span><span>Buyer</span><span>Qty</span><span>Total</span><span>Status</span><span>Purchased</span>
            </div>
            {purchases.length === 0 ? (
              <div className="px-5 py-14 text-center text-[12px] text-text-dim">No purchase history.</div>
            ) : purchases.map(p => {
              const purchaseItem = items.find(item => item.id === p.item_id)
              const selected = selectedHistoryIds.includes(String(p.id))
              return (
                <div key={p.id} className={`grid gap-4 border-t border-white/[.055] px-4 py-4 md:grid-cols-[36px_minmax(240px,1.4fr)_130px_80px_120px_130px_160px] md:items-center md:gap-3 md:text-center ${selected ? 'bg-gold/[.035]' : ''}`}>
                  <div className="flex justify-start md:justify-center">
                    <input type="checkbox" checked={selected} onChange={() => toggleHistorySelection(p.id)} disabled={busy} aria-label={`Select purchase ${p.id}`} className="h-4 w-4 accent-gold" />
                  </div>
                  <div className="flex min-w-0 items-center gap-3 text-left">
                    <ItemArtwork item={purchaseItem} size="table" />
                    <div className={`truncate text-[14px] font-semibold ${rarityTextClass(purchaseItem?.rarity)}`}>{itemName(p.item_id)}</div>
                  </div>
                  <div className="text-[12px] text-text-dim">{memberName(p.buyer_id)}</div>
                  <div className="text-[12px] text-text-dim">{p.quantity}</div>
                  <div className="font-mono text-[13px] font-bold text-gold-light">{formatCoins(p.total_price)}</div>
                  <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${statusClass(p.status)}`}>{statusLabel(p.status)}</span></div>
                  <div className="text-[12px] text-text-dim">{formatDate(p.purchased_at)}</div>
                </div>
              )
            })}
          </div>
        )}

        {staffTab === 'distribution' && canDistribute && (
          <div className="overflow-hidden rounded-xl border border-white/[.07]">
            <div className="hidden bg-white/[.035] px-4 py-3 text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim md:grid md:grid-cols-[minmax(280px,1.5fr)_150px_80px_130px_170px] md:items-center md:gap-3 md:text-center">
              <span className="text-left">Item</span><span>Buyer</span><span>Qty</span><span>Coins Paid</span><span>Action</span>
            </div>
            {distributionQueue.length === 0 ? (
              <div className="px-5 py-14 text-center text-[12px] text-text-dim">No purchases are waiting for distribution.</div>
            ) : distributionQueue.map(p => {
              const purchaseItem = items.find(item => item.id === p.item_id)
              return (
                <div key={p.id} className="grid gap-4 border-t border-white/[.055] px-4 py-4 md:grid-cols-[minmax(280px,1.5fr)_150px_80px_130px_170px] md:items-center md:gap-3 md:text-center">
                  <div className="flex min-w-0 items-center gap-3 text-left">
                    <ItemArtwork item={purchaseItem} size="table" />
                    <div className="min-w-0">
                      <div className={`truncate text-[14px] font-semibold ${rarityTextClass(purchaseItem?.rarity)}`}>{itemName(p.item_id)}</div>
                      <div className="mt-1.5 text-[11px] text-text-dim">Purchased {formatDate(p.purchased_at)}</div>
                    </div>
                  </div>
                  <div className="text-[12px] text-text-dim">{memberName(p.buyer_id)}</div>
                  <div className="text-[12px] text-text-dim">{p.quantity}</div>
                  <div className="font-mono text-[13px] font-bold text-gold-light">{formatCoins(p.total_price)}</div>
                  <div className="flex justify-center"><button type="button" onClick={() => { setDistributionPurchase(p); setDistributionNote('') }} className="rounded-md border border-emerald-400/25 bg-emerald-400/[.06] px-3.5 py-2.5 text-[10px] font-bold uppercase text-emerald-300 hover:bg-emerald-400/[.1]">Distribute Item</button></div>
                </div>
              )
            })}
          </div>
        )}

        {staffTab === 'listings' && canSubmit && (
          <div className="overflow-hidden rounded-xl border border-white/[.07]">
            <div className="hidden bg-white/[.035] px-4 py-3 text-[11px] font-bold uppercase tracking-[.14em] text-gold-dim md:grid md:grid-cols-[56px_minmax(240px,1.7fr)_120px_100px_130px] md:items-center md:gap-3 md:text-center">
              <span /><span className="text-left">Item</span><span>Price</span><span>Quantity</span><span>Status</span>
            </div>
            {mySubmissions.length === 0 ? (
              <div className="px-5 py-14 text-center text-[12px] text-text-dim">No submissions yet.</div>
            ) : mySubmissions.map(item => (
              <div key={item.id} className="grid gap-4 border-t border-white/[.055] px-4 py-4 md:grid-cols-[56px_minmax(240px,1.7fr)_120px_100px_130px] md:items-center md:gap-3 md:text-center">
                <div className="flex justify-center"><ItemArtwork item={item} size="table" /></div>
                <div className="min-w-0 text-left">
                  <div className={`truncate text-[14px] font-semibold ${rarityTextClass(item.rarity)}`}>{item.name}</div>
                  <div className="mt-1.5 text-[11px] text-text-dim">{item.rarity}</div>
                </div>
                <div className="font-mono text-[13px] text-gold-light">{formatCoins(item.price)}</div>
                <div className="text-[12px] text-text-dim">{item.stock}</div>
                <div className="flex flex-wrap items-center justify-center gap-2">
  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
  {(
    ['sold_out', 'closed', 'expired', 'rejected'].includes(item.status) ||
    (role === ROLES.ELDER && Number(item.submitted_by) === Number(currentUser?.id) && item.status === 'active')
  ) && (
    <button type="button" disabled={busy} onClick={() => removeListing(item)} className="rounded-md border border-red-400/20 px-3 py-2 text-[10px] font-bold uppercase tracking-[.08em] text-red-300 hover:bg-red-400/[.06] disabled:opacity-40">Remove</button>
  )}
</div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  </section>
)}{buyItem && <Modal title="Confirm Purchase" narrow compact onClose={() => !busy && setBuyItem(null)}>
        <div className="space-y-3.5">
          <div className="rounded-lg border border-white/[.07] bg-white/[.018] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-text-dim/50">Confirm purchase</div>
                <div className={`mt-1 truncate font-spectral text-[19px] font-bold ${rarityTextClass(buyItem.rarity)}`}>{buyItem.name}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[19px] font-bold leading-none text-gold-bright">{formatCoins(Number(buyItem.price))}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[.12em] text-gold-dim">Coins</div>
              </div>
            </div>
          </div>

          {purchaseError && (
      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-lg border border-red-400/25 bg-red-500/[.06] px-3 py-2.5 text-left"
      >
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-red-400/35 bg-red-400/[.08] text-[11px] font-bold text-red-300">
          !
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[.14em] text-red-300">
            Purchase Unavailable
          </div>
          <div className="mt-0.5 text-[11px] leading-4 text-red-200/80">
            {purchaseError}
          </div>
        </div>
      </div>
    )}

    <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/[.07] bg-white/[.018] px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[.14em] text-text-dim/55">Your Balance</div>
              <div className="mt-1 font-mono text-[20px] font-bold leading-none text-text-bright">
                {formatCoins(Number(displayCoins || 0))}
                <span className="ml-1 text-[10px] font-semibold tracking-[.08em] text-text-dim">COINS</span>
              </div>
            </div>

            <div className="rounded-lg border border-gold/15 bg-gold/[.035] px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[.14em] text-text-dim/55">After Purchase</div>
              <div className="mt-1 font-mono text-[20px] font-bold leading-none text-gold-light">
                {formatCoins(Math.max(0, Number(displayCoins || 0) - Number(buyItem.price)))}
                <span className="ml-1 text-[10px] font-semibold tracking-[.08em] text-gold-dim">COINS</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/[.06] pt-3">
            <button type="button" disabled={busy} onClick={() => { setPurchaseError(''); setBuyItem(null) }} className="rounded-lg border border-white/[.08] px-3.5 py-2 text-[12px] font-bold uppercase tracking-[.1em] text-text-dim transition hover:border-white/[.14] hover:text-text-bright">Cancel</button>
            <button type="button" disabled={busy} onClick={confirmBuy} className="rounded-lg border border-gold/30 bg-gold/[.09] px-4 py-2 text-[12px] font-bold uppercase tracking-[.1em] text-gold-light transition hover:border-gold/45 hover:bg-gold/[.14] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Processing…' : 'Confirm Purchase'}</button>
          </div>
        </div>
      </Modal>}
      {(showSubmit || showEdit) && (
        <Modal
          title={showEdit ? 'Edit Pending Listing' : 'Submit Marketplace Item'}
          wide
          onClose={() => !busy && (showEdit ? setShowEdit(false) : setShowSubmit(false))}
        >
          <form onSubmit={showEdit ? saveEdit : submitItem} className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="rounded-xl border border-white/[.07] bg-black/10 p-4">
                <div className="mb-4">
                  <div className="text-[10px] font-bold uppercase tracking-[.18em] text-gold-dim">Listing Details</div>
                  <div className="mt-1 text-[11px] text-text-dim">Set the item, rarity, price, package size, and listing duration.</div>
                </div>

                <div className="space-y-4">
                  <Field label="Item Name">
                    <input
                      className="w-full rounded-lg border border-white/[.09] bg-black/25 px-3 py-2.5 text-sm text-text outline-none focus:border-gold/35"
                      required
                      maxLength={120}
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Kari Top"
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Rarity">
                      <select
                        className="w-full rounded-lg border border-white/[.09] bg-[#0b0908] px-3 py-2.5 text-sm text-text outline-none"
                        value={form.rarity}
                        onChange={e => setForm(f => ({ ...f, rarity: e.target.value }))}
                      >
                        {RARITIES.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
                      </select>
                    </Field>

                    <Field label="Price · Coins">
                      <input
                        className="w-full rounded-lg border border-white/[.09] bg-black/25 px-3 py-2.5 text-sm text-text outline-none focus:border-gold/35"
                        required
                        type="number"
                        min="0"
                        step="1"
                        value={form.price}
                        onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      />
                    </Field>

                    <Field label="Quantity Items">
                      <input
                        className="w-full rounded-lg border border-white/[.09] bg-black/25 px-3 py-2.5 text-sm text-text outline-none focus:border-gold/35"
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={form.stock}
                        onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                      />
                      <span className="mt-1 block text-[10px] leading-4 text-text-dim/60">
                        Members receive all {form.stock || 1}× in one purchase. The package can be bought only once.
                      </span>
                    </Field>

                    <Field label="Duration · Days">
                      <input
                        className="w-full rounded-lg border border-white/[.09] bg-black/25 px-3 py-2.5 text-sm text-text outline-none focus:border-gold/35"
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={form.duration_days}
                        onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <ImageManager
                imageFile={imageFile}
                imagePreview={imagePreview}
                pickedLibraryImg={pickedLibraryImg}
                libraryImages={libraryImages}
                libraryLoading={libraryLoading}
                libraryError={libraryError}
                uploading={uploading}
                deletingImageName={deletingImageName}
                canDeleteImage={isStaff}
                fileInputRef={fileInputRef}
                onRefresh={loadLibrary}
                onFileChange={handleImageChange}
                onPick={pickFromLibrary}
                onClear={clearImage}
                onDeleteImage={deleteLibraryImage}
              />
            </div>

            <div className="rounded-lg border border-amber-300/10 bg-amber-300/[.02] px-3 py-2.5 text-[10px] leading-4 text-text-dim">
              {showEdit
                ? 'Changes are limited to pending listings. Approval is still required before the item becomes active.'
                : isStaff
                  ? 'Submit for Review sends this item to the review queue. Confirm & List publishes it immediately.'
                  : 'New listings enter Pending Review. A Master or Admin must approve them before members can purchase.'}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/[.06] pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => showEdit ? setShowEdit(false) : setShowSubmit(false)}
                className="rounded-lg border border-white/[.08] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.1em] text-text-dim transition hover:border-white/[.14] hover:bg-white/[.025]"
              >
                Cancel
              </button>

              {showEdit ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveEdit}
                  className="rounded-lg border border-gold/30 bg-gold/[.09] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[.1em] text-gold-light transition hover:border-gold/45 hover:bg-gold/[.14] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save Changes'}
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg border border-gold/30 bg-gold/[.07] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[.1em] text-gold-light transition hover:border-gold/45 hover:bg-gold/[.12] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? 'Submitting…' : 'Submit for Review'}
                  </button>

                  {isStaff && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={confirmDirectList}
                      className="rounded-lg border border-emerald-400/25 bg-emerald-400/[.055] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[.1em] text-emerald-300 transition hover:border-emerald-300/40 hover:bg-emerald-400/[.09] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? 'Publishing…' : 'Confirm & List'}
                    </button>
                  )}
                </>
              )}
            </div>
          </form>
        </Modal>
      )}


      {reviewItem && !showEdit && <Modal title="Marketplace Review" compact onClose={() => !busy && setReviewItem(null)}>
        <div className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
            <ItemArtwork item={reviewItem} size="review" />
            <div className="flex min-w-0 flex-col justify-center">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${rarityClass(reviewItem.rarity)}`}>{reviewItem.rarity}</span>
                <span className="rounded-full border border-amber-300/25 bg-amber-300/[.05] px-2 py-0.5 text-[9px] font-bold uppercase text-amber-200">Pending Review</span>
              </div>
              <h3 className="mt-1.5 truncate font-spectral text-[22px] font-bold leading-tight text-text-bright">{reviewItem.name}</h3>
              <p className="mt-1 text-[10px] text-text-dim">Listed by <span className="text-text-bright/80">{memberName(reviewItem.submitted_by)}</span> · {formatDate(reviewItem.submitted_at)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-white/[.06] bg-white/[.012] px-3 py-2.5">
              <div className="text-[8px] font-bold uppercase tracking-[.12em] text-text-dim">Price</div>
              <div className="mt-0.5 font-mono text-[15px] font-bold text-gold-light">{formatCoins(reviewItem.price)}</div>
            </div>
            <div className="rounded-lg border border-white/[.06] bg-white/[.012] px-3 py-2.5">
              <div className="text-[8px] font-bold uppercase tracking-[.12em] text-text-dim">Quantity</div>
              <div className="mt-0.5 font-mono text-[15px] font-bold text-text-bright">{Math.max(1, Number(reviewItem.bundle_quantity ?? reviewItem.stock) || 1)}×</div>
            </div>
            <div className="rounded-lg border border-white/[.06] bg-white/[.012] px-3 py-2.5">
              <div className="text-[8px] font-bold uppercase tracking-[.12em] text-text-dim">Expires</div>
              <div className="mt-0.5 text-[10px] font-semibold text-text-bright">{formatShortDate(reviewItem.available_until)}</div>
            </div>
          </div>

          <div className="rounded-lg border border-white/[.06] bg-white/[.015] px-3 py-2.5 text-[10px] leading-4 text-text-dim">
            {reviewItem.description || 'No description provided.'}
          </div>

          {canReview && <div className="flex flex-col-reverse gap-2 border-t border-white/[.06] pt-3 sm:flex-row sm:justify-end">
            <button type="button" disabled={busy} onClick={reject} className="rounded-lg border border-red-400/20 px-3.5 py-2.5 text-[9px] font-bold uppercase tracking-[.1em] text-red-300 transition hover:border-red-400/35 hover:bg-red-400/[.04]">Reject</button>
            <button type="button" disabled={busy} onClick={() => openEdit(reviewItem)} className="rounded-lg border border-white/[.09] px-3.5 py-2.5 text-[9px] font-bold uppercase tracking-[.1em] text-text-dim transition hover:border-white/[.16] hover:text-text-bright">Edit</button>
            <button type="button" disabled={busy} onClick={approve} className="rounded-lg border border-emerald-400/25 bg-emerald-400/[.06] px-4 py-2.5 text-[9px] font-bold uppercase tracking-[.1em] text-emerald-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/[.1]">{busy ? 'Processing…' : 'Approve Listing'}</button>
          </div>}
        </div>
      </Modal>}

      {distributionPurchase && <Modal title="Complete Distribution" onClose={() => !busy && setDistributionPurchase(null)}><div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[.025] p-4"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-emerald-300/70">Paid Purchase</div><div className="mt-1 font-spectral text-xl font-bold text-text-bright">{itemName(distributionPurchase.item_id)}</div><div className="mt-1 text-[11px] text-text-dim">Buyer: {memberName(distributionPurchase.buyer_id)} · Qty {itemPackageQuantity(distributionPurchase.item_id)}×</div><div className="mt-2 font-mono text-lg font-bold text-gold-bright">{formatCoins(distributionPurchase.total_price)} coins</div></div><div className="mt-4"><Field label="Distribution Note" hint="Optional delivery or character/account note."><textarea className="min-h-[95px] w-full resize-y rounded-lg border border-white/[.09] bg-black/25 px-3 py-2.5 text-sm text-text outline-none focus:border-gold/35" maxLength={500} value={distributionNote} onChange={e => setDistributionNote(e.target.value)} placeholder="Delivered in-game…" /></Field></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setDistributionPurchase(null)} className="rounded-lg border border-white/[.08] px-4 py-2.5 text-[10px] font-bold uppercase text-text-dim">Cancel</button><button type="button" disabled={busy} onClick={distribute} className="rounded-lg border border-emerald-400/25 bg-emerald-400/[.06] px-5 py-2.5 text-[10px] font-bold uppercase text-emerald-300">{busy ? 'Updating…' : 'Mark as Distributed'}</button></div></Modal>}
    </div>
    </>
  )
}
