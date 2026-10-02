'use client'
/* eslint-disable @next/next/no-img-element -- Existing gallery media uses arbitrary source dimensions. */

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { dateLabel, Envelope, Media, safeUrl } from '@/lib/blog'
import { send, useBlog, useBlogData } from './blog-provider'
import { FilePicker, MediaPreview, Modal, PageHeading, State, styles } from './shared'

type GalleryResult = Envelope<{ files: Media[]; count: number; hasMore: boolean; breakpoint: string | null }>

export default function Gallery() {
  const { t, locale, session, notify } = useBlog()
  const [filter, setFilter] = useState('all')
  const [preview, setPreview] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const { data, error, isLoading, mutate } = useBlogData<GalleryResult>('gallery/get?loadNums=500')
  // V1 has no cursor pagination and explicitly returns hasMore:false. Never
  // append a second fetch of the same folder under a fictitious "load more".
  const media = (data?.data.files || []).filter(file => safeUrl(file.url) && (filter === 'all' || file.mime.startsWith(filter))).toSorted((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!files.length || busy) return
    setBusy(true); setSubmitError('')
    try {
      const form = new FormData()
      for (const file of files) form.append('files', file)
      const result = await send<Envelope<{ count: number }>>('gallery/post', form)
      if (result.data.count !== files.length) {
        setFiles([])
        setSubmitError(t('partialUpload'))
        await mutate()
        return
      }
      setUploading(false); setFiles([]); notify(t('saved'))
      await mutate()
    } catch (error) { setSubmitError((error as Error).message) } finally { setBusy(false) }
  }
  return <div className={styles['page']}>
    <PageHeading title="gallery" english="Light & memory" number="03">{session && !session.isGuest && <button className={styles['primary-button']} onClick={() => { setUploading(true); setSubmitError('') }}><Upload size={16} />{t('upload')}</button>}</PageHeading>
    <div className={styles['toolbar']}><div className={styles['filters']}>{(['all', 'image', 'video'] as const).map(type => <button key={type} aria-pressed={filter === type} onClick={() => { setFilter(type); setPreview(null) }}>{t(type)}</button>)}</div><span className={styles['form-note']}>{media.length} {t('entries')}</span></div>
    <State loading={isLoading} error={error} empty={!!data && !media.length} retry={() => mutate()} />
    <div className={styles['gallery-grid']}>{media.map((file, index) => <figure key={file.url}><button onClick={() => setPreview(index)} aria-label={`${t('preview')} ${file.desc || file.filename}`}>{file.mime.startsWith('video') ? <video src={file.url} muted preload="metadata" /> : <img src={file.url} alt={file.desc || file.filename} loading="lazy" />}</button><figcaption><span>{file.username || 'YororoIce'}{file.mime.startsWith('video') ? ` / ${t('video')}` : ''}</span>{file.createdAt && <time>{dateLabel(file.createdAt, locale)}</time>}</figcaption></figure>)}</div>
    {preview !== null && media[preview] && <MediaPreview files={media} index={preview} close={() => setPreview(null)} />}
    {uploading && <Modal title={t('upload')} close={() => { if (!busy) setUploading(false) }}><form className={styles['form']} onSubmit={upload}><FilePicker files={files} setFiles={setFiles} />{submitError && <p role="alert" className={styles['error']}>{submitError}</p>}<div><button className={styles['primary-button']} disabled={busy || !files.length}>{t(busy ? 'saving' : 'upload')}</button></div></form></Modal>}
  </div>
}
