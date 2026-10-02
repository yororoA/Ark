'use client'
/* eslint-disable @next/next/no-img-element -- Migrated media has arbitrary dimensions and hosts; preserve its original aspect ratio. */

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ArrowRight, ArrowUpRight, FileImage, Heart, LoaderCircle, Trash2, Upload, X } from 'lucide-react'
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
  return <header className={styles['page-heading']}><div><div className={styles['eyebrow']}>YOROROICE ARCHIVE / {number}</div><h1>{localizedTitle}{!repeatsEnglishTitle && <span className={styles['english-title']}>{english}</span>}</h1></div>{children}</header>
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
  title: string; children: React.ReactNode; close: () => void; variant?: 'default' | 'confirm'; descriptionId?: string
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
export function MediaPreview({ files, index, close }: { files: Media[]; index: number; close: () => void }) {
  const [active, setActive] = useState(index)
  const { t, locale } = useBlog()
  useEffect(() => {
    const navigate = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setActive(value => Math.max(0, value - 1))
      if (event.key === 'ArrowRight') setActive(value => Math.min(files.length - 1, value + 1))
    }
    window.addEventListener('keydown', navigate)
    return () => window.removeEventListener('keydown', navigate)
  }, [files.length])
  const item = files[active]
  return <Modal title={item.desc || t('preview')} close={close}>{item.mime.startsWith('video') ? <video key={item.url} src={item.url} controls autoPlay /> : <img src={item.url} alt={item.desc || item.filename} />}<div className={styles['dialog-footer']}><button className={styles['secondary-button']} disabled={active === 0} onClick={() => setActive(active - 1)}>{t('previous')}</button><span>{active + 1} / {files.length}{item.createdAt ? ` · ${dateLabel(item.createdAt, locale)}` : ''}</span><button className={styles['secondary-button']} disabled={active === files.length - 1} onClick={() => setActive(active + 1)}>{t('next')}</button></div></Modal>
}
export function MediaGrid({ files }: { files: Media[] }) {
  const [preview, setPreview] = useState<number | null>(null)
  if (!files.length) return null
  return <><div className={styles['media-grid']}>{files.map((file, index) => file.mime.startsWith('video') ? <video src={file.url} key={file.url} controls preload="metadata" /> : <button key={file.url} onClick={() => setPreview(index)} aria-label={file.desc || file.filename}><img loading="lazy" src={file.url} alt={file.desc || file.filename} /></button>)}</div>{preview !== null && <MediaPreview files={files} index={preview} close={() => setPreview(null)} />}</>
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
