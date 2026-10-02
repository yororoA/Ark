'use client'
/* eslint-disable @next/next/no-img-element -- Migrated media has arbitrary dimensions and hosts; preserve its original aspect ratio. */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ArrowRight, ArrowUpRight, FileImage, Heart, LoaderCircle, RotateCcw, Trash2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { dateLabel, Envelope, Media, TextKey } from '@/lib/blog'
import { send, useBlog, useBlogData } from './blog-provider'
import styles from './blog.module.scss'

export { styles }
export function PageHeading({ title, english, number, children }: { title: TextKey; english: string; number: string; children?: React.ReactNode }) {
  const { t } = useBlog()
  const localizedTitle = t(title)
  const repeatsEnglishTitle = localizedTitle.localeCompare(english, undefined, { sensitivity: 'base' }) === 0
  return <header className={styles['page-heading']}>
    <span className={styles['heading-index']} aria-hidden="true">{number}</span>
    <div className={styles['heading-title']}>
      <div className={styles['eyebrow']}><span className={styles['archive-only']}>YOROROICE ARCHIVE</span><span className={styles['rain-only']}>YOROROICE / JOURNAL</span> / {number}</div>
      <h1>{localizedTitle}{!repeatsEnglishTitle && <span className={styles['english-title']}>{english}</span>}</h1>
    </div>
    <svg className={styles['heading-ripple']} viewBox="0 0 160 70" fill="none" aria-hidden="true">
      <path d="M80 0V24M80 30L83 34L80 38L77 34Z" stroke="currentColor" />
      <ellipse cx="80" cy="48" rx="22" ry="5" stroke="currentColor" />
      <ellipse cx="80" cy="48" rx="46" ry="11" stroke="currentColor" opacity=".6" />
      <ellipse cx="80" cy="48" rx="74" ry="18" stroke="currentColor" opacity=".3" />
    </svg>
    {children && <div className={styles['heading-actions']}>{children}</div>}
  </header>
}
export function State({ loading, error, empty, retry }: { loading?: boolean; error?: Error; empty?: boolean; retry?: () => void }) {
  const { t } = useBlog()
  if (!loading && !error && !empty) return null
  return <div className={styles['state-box']} role={error ? 'alert' : 'status'}>{loading ? <><span className={styles['loading-line']} />{t('loading')}</> : error ? <><p>{error.message}</p><button className={styles['secondary-button']} onClick={retry}>{t('retry')}</button></> : <p>{t('noResults')}</p>}</div>
}
export function Markdown({ content }: { content: string }) {
  return <div className={styles['markdown']}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a> }}>{content}</ReactMarkdown></div>
}
export function RequireLogin({ children, guestAllowed = false }: { children: React.ReactNode; guestAllowed?: boolean }) {
  const { session, sessionLoading, t } = useBlog()
  const pathname = usePathname()
  if (sessionLoading) return <State loading />
  if (!session || (session.isGuest && !guestAllowed)) return <div className={styles['state-box']}><p>{t(session?.isGuest ? 'guestReadOnly' : 'signInToWrite')}</p><Link href={`/login?returnTo=${encodeURIComponent(pathname)}`} className={styles['primary-button']}>{t('login')}<ArrowUpRight size={16} /></Link></div>
  return children
}
export function LikeButton({ kind, id, count = 0 }: { kind: 'article' | 'moment' | 'comment'; id: string; count?: number }) {
  const { session, t, notify } = useBlog()
  const [busy, setBusy] = useState(false)
  const [value, setValue] = useState<{ base: number; likes: number } | null>(null)
  const listPath = kind === 'article' ? 'knowledge/liked' : kind === 'moment' ? 'moments/liked' : 'moments/comments/liked'
  const { data, mutate } = useBlogData<Envelope<string[]>>(session && !session.isGuest ? `${listPath}?account=${session.uid}` : null)
  const liked = data?.data.includes(id) ?? false
  async function toggle() {
    if (!session || session.isGuest) { notify(t('signInToWrite')); return }
    setBusy(true)
    try {
      const path = kind === 'article' ? 'knowledge/like' : kind === 'moment' ? 'moments/like' : 'moments/comment/like'
      const result = await send<Envelope<{ likes: number }>>(path, { [`${kind}Id`]: id, like: !liked })
      setValue({ base: count, likes: result.data.likes })
      await mutate({ data: liked ? (data?.data || []).filter(value => value !== id) : [...(data?.data || []), id] }, { revalidate: false })
    } catch (error) { notify((error as Error).message) } finally { setBusy(false) }
  }
  return <button className={styles['secondary-button']} disabled={busy || (!!session && !session.isGuest && !data)} onClick={toggle} aria-pressed={liked}><Heart size={15} fill={liked ? 'currentColor' : 'none'} />{t(liked ? 'liked' : 'like')} {value?.base === count ? value.likes : count}</button>
}
export function Modal({ title, children, close, variant = 'default', descriptionId }: {
  title: string; children: React.ReactNode; close: () => void; variant?: 'default' | 'confirm' | 'media'; descriptionId?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const { t } = useBlog()
  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement
    dialog?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previous
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])
  return <dialog ref={ref} className={styles['dialog']} data-variant={variant} role={variant === 'confirm' ? 'alertdialog' : undefined} aria-label={title} aria-describedby={descriptionId} onKeyDown={e => {
    const isNestedControl = e.target instanceof HTMLElement && !!e.target.closest('[data-blog-control-popup]')
    if (e.key === 'Escape' && !e.defaultPrevented && !isNestedControl) { e.preventDefault(); close() }
  }} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}><div className={styles['dialog-header']}><h2>{title}</h2><button className={styles['icon-button']} onClick={close} aria-label={t('close')}><X size={20} /></button></div>{children}</dialog>
}

export function DeleteButton({ name, onDelete, iconOnly = false }: { name: string; onDelete: () => Promise<void>; iconOnly?: boolean }) {
  const { t } = useBlog()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const descriptionId = useId()
  async function remove() {
    if (busy) return
    setBusy(true); setError('')
    try { await onDelete(); setOpen(false) }
    catch (error) { setError((error as Error).message) }
    finally { setBusy(false) }
  }
  return <>
    <button type="button" className={styles[iconOnly ? 'icon-button' : 'secondary-button']} aria-label={`${t('delete')} ${name}`} onClick={() => { setError(''); setOpen(true) }}>
      <Trash2 size={15} />{!iconOnly && t('delete')}
    </button>
    {open && <Modal title={t('delete')} variant="confirm" descriptionId={descriptionId} close={() => { if (!busy) setOpen(false) }}>
      <div className={styles['confirm-content']}>
        <div className={styles['confirm-entry']}><Trash2 size={24} strokeWidth={1} /><strong>{name}</strong></div>
        <p id={descriptionId}>{t('confirmDelete')}</p>
        {error && <p className={styles['error']} role="alert">{error}</p>}
      </div>
      <div className={styles['dialog-footer']}>
        <button type="button" autoFocus className={styles['secondary-button']} disabled={busy} onClick={() => setOpen(false)}>{t('cancel')}</button>
        <button type="button" className={styles['danger-button']} disabled={busy} onClick={remove}>{busy ? <LoaderCircle size={15} className={styles['busy-icon']} /> : <Trash2 size={15} />}{t(busy ? 'deleting' : 'delete')}</button>
      </div>
    </Modal>}
  </>
}
export function MediaPreview({ files, index, close, compact = false }: { files: Media[]; index: number; close: () => void; compact?: boolean }) {
  const [active, setActive] = useState(index)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const mediaRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ active: false, pointerId: -1, x: 0, y: 0, panX: 0, panY: 0 })
  const { t, locale } = useBlog()
  const item = files[active]
  const isImage = !item.mime.startsWith('video')
  const resetView = useCallback(() => {
    dragRef.current.active = false
    setPanning(false)
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [])
  function changeMedia(offset: number) {
    setActive(value => Math.max(0, Math.min(files.length - 1, value + offset)))
    resetView()
  }
  function changeScale(offset: number) {
    setScale(value => Math.max(.5, Math.min(3, Number((value + offset).toFixed(2)))))
  }
  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    if (!isImage || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { active: true, pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
    setPanning(true)
  }
  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag.active || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    setPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y })
  }
  function endPan(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current.pointerId !== event.pointerId) return
    dragRef.current.active = false
    setPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  useEffect(() => {
    const media = mediaRef.current
    if (!media || !isImage) return
    const zoom = (event: WheelEvent) => {
      event.preventDefault()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? media.clientHeight : 1
      const factor = Math.exp(-event.deltaY * unit * .002)
      setScale(value => Math.max(.5, Math.min(3, Number((value * factor).toFixed(3)))))
    }
    media.addEventListener('wheel', zoom, { passive: false })
    return () => media.removeEventListener('wheel', zoom)
  }, [isImage])
  useEffect(() => {
    const navigate = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setActive(value => Math.max(0, value - 1))
        resetView()
      }
      if (event.key === 'ArrowRight') {
        setActive(value => Math.min(files.length - 1, value + 1))
        resetView()
      }
      if (!isImage) return
      if (event.key === '-' || event.key === '_') { event.preventDefault(); changeScale(-.25) }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); changeScale(.25) }
      if (event.key === '0') { event.preventDefault(); resetView() }
    }
    window.addEventListener('keydown', navigate)
    return () => window.removeEventListener('keydown', navigate)
  }, [files.length, isImage, resetView])
  return <Modal title={item.desc || t('preview')} close={close} variant="media">
    <div
      ref={mediaRef}
      className={styles['preview-media']}
      data-compact={compact}
      data-image={isImage}
      data-panning={panning}
      data-zoomed={isImage && scale !== 1}
      role={isImage ? 'group' : undefined}
      aria-label={isImage ? t('panZoomImage') : undefined}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      {isImage
        ? <div className={styles['preview-canvas']} style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` }}><img draggable={false} key={item.url} src={item.url} alt={item.desc || item.filename} style={{ transform: `scale(${scale})` }} /></div>
        : <video key={item.url} src={item.url} controls autoPlay />}
    </div>
    <div className={`${styles['dialog-footer']} ${styles['preview-footer']}`}>
      <div className={styles['preview-navigation']}>
        <button type="button" className={styles['secondary-button']} disabled={active === 0} onClick={() => changeMedia(-1)}><ArrowLeft size={15} />{t('previous')}</button>
        <button type="button" className={styles['secondary-button']} disabled={active === files.length - 1} onClick={() => changeMedia(1)}>{t('next')}<ArrowRight size={15} /></button>
      </div>
      <span className={styles['preview-counter']}>{active + 1} / {files.length}{item.createdAt ? ` · ${dateLabel(item.createdAt, locale)}` : ''}</span>
      {isImage && <div className={styles['preview-zoom']} role="group" aria-label={t('preview')}>
        <button type="button" className={styles['icon-button']} disabled={scale <= .5} onClick={() => changeScale(-.25)} aria-label={t('zoomOut')} title={t('zoomOut')}><ZoomOut size={17} /></button>
        <output aria-live="polite">{Math.round(scale * 100)}%</output>
        <button type="button" className={styles['icon-button']} disabled={scale === 1 && pan.x === 0 && pan.y === 0} onClick={resetView} aria-label={t('resetZoom')} title={t('resetZoom')}><RotateCcw size={16} /></button>
        <button type="button" className={styles['icon-button']} disabled={scale >= 3} onClick={() => changeScale(.25)} aria-label={t('zoomIn')} title={t('zoomIn')}><ZoomIn size={17} /></button>
      </div>}
    </div>
  </Modal>
}
export function MediaGrid({ files, compact = false, onMediaLoad }: { files: Media[]; compact?: boolean; onMediaLoad?: () => void }) {
  const [preview, setPreview] = useState<number | null>(null)
  if (!files.length) return null
  const hasVideo = files.some(file => file.mime.startsWith('video'))
  const hasImage = files.some(file => !file.mime.startsWith('video'))
  return <><div className={styles['media-grid']} data-compact={compact} data-count={Math.min(files.length, 4)} data-mixed={hasVideo && hasImage}>{files.map((file, index) => file.mime.startsWith('video') ? <div className={styles['media-item']} data-kind="video" key={file.url}><video src={file.url} controls preload="metadata" onLoadedMetadata={onMediaLoad} /></div> : <button className={styles['media-item']} data-kind="image" key={file.url} onClick={() => setPreview(index)} aria-label={file.desc || file.filename}><img loading="lazy" src={file.url} alt={file.desc || file.filename} onLoad={onMediaLoad} /></button>)}</div>{preview !== null && <MediaPreview files={files} index={preview} close={() => setPreview(null)} compact={compact} />}</>
}
export function FilePicker({ files, setFiles, max = 16, imageOnly = false }: { files: File[]; setFiles: (files: File[]) => void; max?: number; imageOnly?: boolean }) {
  const { t, notify } = useBlog()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  function choose(next: File[]) {
    const limit = imageOnly ? 10 : 50
    const invalidType = next.some(file => !file.type.startsWith('image/') && (imageOnly || !file.type.startsWith('video/')))
    if (invalidType || next.length > max || next.some(file => file.size > limit * 1024 * 1024)) { notify(`${t('upload')}: ≤ ${max} · ≤ ${limit} MB · ${imageOnly ? 'image' : 'image / video'}`); return }
    setFiles(next)
  }
  return <div className={styles['file-drop']} data-dragging={dragging} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false) }} onDrop={e => { e.preventDefault(); setDragging(false); choose(Array.from(e.dataTransfer.files)) }}>
    <input ref={input} type="file" hidden multiple accept={imageOnly ? 'image/*' : 'image/*,video/*'} onChange={e => { choose(Array.from(e.target.files || [])); e.target.value = '' }} />
    <button type="button" className={styles['upload-trigger']} disabled={!max} onClick={() => input.current?.click()}>
      <span className={styles['upload-symbol']}><Upload size={22} strokeWidth={1} /></span>
      <span><strong>{t('upload')}</strong><small>{t('dropFiles')} · {imageOnly ? '10' : '50'} MB / {t('file')}</small></span>
      <span className={styles['upload-count']}>{String(files.length).padStart(2, '0')}<small>/ {max}</small></span>
    </button>
    {!!files.length && <ul className={styles['upload-files']}>{files.map((file, index) => <li key={`${file.name}-${index}`}>
      <FileImage size={14} /><span title={file.name}>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
      <button type="button" className={styles['icon-button']} aria-label={`${t('removeFile')} ${file.name}`} onClick={() => setFiles(files.filter((_, item) => item !== index))}><X size={14} /></button>
    </li>)}</ul>}
  </div>
}
export function Pagination({ page, pages, change }: { page: number; pages: number; change: (page: number) => void }) {
  const { t } = useBlog()
  if (pages <= 1) return null
  return <nav className={styles['pagination']} aria-label={t('pagination')}><button disabled={page <= 1} onClick={() => change(page - 1)}><ArrowLeft size={15} />{t('previous')}</button><span><strong>{String(page).padStart(2, '0')}</strong><i>/</i>{String(pages).padStart(2, '0')}</span><button disabled={page >= pages} onClick={() => change(page + 1)}>{t('next')}<ArrowRight size={15} /></button></nav>
}
