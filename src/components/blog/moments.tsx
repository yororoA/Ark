'use client'
/* eslint-disable @next/next/no-img-element -- Preserve dimensions of existing blog media. */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from '@/components/appearance/p3r-link'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR, { useSWRConfig } from 'swr'
import { ArrowLeft, ArrowUpRight, MessageSquare, Plus, Reply, Share2, X } from 'lucide-react'
import { Comment, dateLabel, Entry, Envelope, excerpt, Media, mediaFor, safeUrl, SitemapContent } from '@/lib/blog'
import { send, sendIdempotent, useBlog, useBlogData } from './blog-provider'
import { useManagedUploads, type UploadedAsset } from './media-upload'
import { AutoTextarea, DeleteButton, FilePicker, LikeButton, LocalMediaGrid, Markdown, MediaGrid, PageHeading, Pagination, RequireLogin, State, styles } from './shared'
import { DateField } from './controls'
import { detailPath, listPath, newestFirst, prepareListReturn, rememberListPosition, safeReturnPath, useRestoreListPosition } from './list-navigation'

function useMomentMedia(entry: Entry) {
  const direct = mediaFor(entry)
  const resolved = new Set(direct.map(file => file.filename))
  const missing = Object.keys(entry.filenames || {}).filter(name => !resolved.has(name))
  const path = missing.length ? `moments/files?from=moments&filenames=${encodeURIComponent(missing.join(','))}` : null
  const result = useBlogData<Envelope<Media[]>>(path, { revalidateOnFocus: false })
  const files = [...direct, ...(result.data?.data || []).filter(file => safeUrl(file.url))]
  return { ...result, files }
}

function MomentCard({ entry, returnTo }: { entry: Entry; returnTo: string }) {
  const { locale, t } = useBlog()
  const { files } = useMomentMedia(entry)
  const cover = files[0]
  return <article className={styles['moment-card']}>
    <div className={styles['entry-meta']}><time dateTime={entry.createdAt}>{dateLabel(entry.createdAt, locale)}</time><span>{entry.username || 'YororoIce'}</span></div>
    <Link href={detailPath('moments', entry._id, returnTo)} onNavigate={() => rememberListPosition(returnTo)}><h2>{entry.title}</h2>
      {cover && (cover.mime.startsWith('video') ? <video className={styles['moment-media']} src={cover.url} muted preload="metadata" aria-label={entry.title} /> : <img className={styles['moment-media']} src={cover.url} alt={cover.desc || entry.title} loading="lazy" />)}
      <p>{excerpt(entry.content, 160)}</p>
      <div className={styles['entry-meta']}><span>♡ {entry.likes || 0}</span><span><MessageSquare size={12} /> {entry.comments?.length || 0}</span><span>{t('read')} <ArrowUpRight size={13} /></span></div>
    </Link>
  </article>
}

export function MomentList({ initialData }: { initialData?: Envelope<Entry[]> }) {
  const { t, session } = useBlog()
  const router = useRouter()
  const params = useSearchParams()
  const date = params.get('date') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const returnTo = listPath('moments', params)
  const { data, error, isLoading, mutate } = useBlogData<Envelope<Entry[]>>(`moments/get?isEditing=false&page=${page}&limit=12&date=${encodeURIComponent(date)}`, {
    fallbackData: initialData,
    revalidateOnMount: !initialData,
  })
  const sitemap = useBlogData<Envelope<SitemapContent>>('archive/sitemap')
  const entries = newestFirst(data?.data || [])
  const availableDates = sitemap.data ? new Set(sitemap.data.data.moments.map(entry => entry.createdAt.slice(0, 10))) : undefined
  useRestoreListPosition(returnTo, !!data)
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (value) next.set(key, value); else next.delete(key)
    router.push(`/moments?${next}`)
  }
  return <div className={styles['page']}>
    <PageHeading title="moments" english="Fragments" number="02">{session && !session.isGuest && <Link className={styles['primary-button']} href="/moments/new"><Plus size={16} />{t('newMoment')}</Link>}</PageHeading>
    <div className={styles['toolbar']}><span className={styles['eyebrow']}>{data?.pagination?.total ?? entries.length} / {t('entries')}</span><div className={styles['form-actions']}><DateField value={date} availableDates={availableDates} onChange={value => filter('date', value)} />{date && <button className={styles['secondary-button']} onClick={() => filter('date', '')}>{t('reset')}</button>}</div></div>
    <State loading={isLoading} error={error} empty={!!data && !entries.length} retry={() => mutate()} />
    <div className={styles['moments-grid']}>{entries.map(entry => <MomentCard key={entry._id} entry={entry} returnTo={returnTo} />)}</div>
    <Pagination page={page} pages={data?.pagination?.pages || 1} change={value => filter('page', String(value))} />
  </div>
}

function Comments({ entry, refresh }: { entry: Entry; refresh: () => Promise<unknown> }) {
  const { t, locale, session } = useBlog()
  const [content, setContent] = useState('')
  const [reply, setReply] = useState<Comment | null>(null)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const ids = entry.comments || []
  const key = ids.length ? ['/api/blog/moments/comment/get', ids.join(',')] : null
  const { data, error, isLoading, mutate } = useSWR<Envelope<Comment[]>>(key, () => send<Envelope<Comment[]>>('moments/comment/get', { commentIds: ids }))
  const comments = [...(data?.data || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const byId = new Map(comments.map(comment => [comment._id, comment]))
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || busy) return
    setBusy(true); setSubmitError('')
    try {
      await send('moments/comment/post', { momentId: entry._id, comment: content.trim(), belong: reply?._id })
      setContent(''); setReply(null)
      await refresh()
    } catch (error) { setSubmitError((error as Error).message) } finally { setBusy(false) }
  }
  return <section className={styles['comments']} id="comments"><h2>{t('comments')} <span className={styles['form-note']}>{ids.length}</span></h2>
    <State loading={isLoading} error={error} retry={() => mutate()} />
    {comments.map(comment => {
      const parent = comment.belong ? byId.get(comment.belong) : undefined
      return <article className={styles['comment']} key={comment._id} id={`comment-${comment._id}`}><div className={styles['entry-meta']}><strong>{comment.username}</strong><time>{dateLabel(comment.createdAt, locale)}</time></div>{parent && <blockquote><a href={`#comment-${parent._id}`}>{t('reply')} {parent.username}: {excerpt(parent.content, 120)}</a></blockquote>}<p>{comment.content}</p><div className={styles['form-actions']}><LikeButton kind="comment" id={comment._id} count={comment.likes} />{session && !session.isGuest && <button className={styles['secondary-button']} onClick={() => { setReply(comment); input.current?.focus() }}><Reply size={14} />{t('reply')}</button>}</div></article>
    })}
    <RequireLogin><form className={styles['form']} onSubmit={submit}>
      {reply && <div className={styles['reply-target']}><span>{t('reply')} {reply.username}: {excerpt(reply.content, 80)}</span><button type="button" className={styles['icon-button']} onClick={() => setReply(null)} aria-label={t('cancel')}><X size={16} /></button></div>}
      <label className={styles['field']}>{t('comments')}<textarea ref={input} required rows={4} maxLength={10000} value={content} onChange={e => setContent(e.target.value)} /></label>
      {submitError && <p className={styles['error']} role="alert">{submitError}</p>}
      <div><button className={styles['primary-button']} disabled={busy || !content.trim()}>{t(busy ? 'sending' : 'send')}</button></div>
    </form></RequireLogin>
  </section>
}

function MomentReader({ entry, refresh }: { entry: Entry; refresh: () => Promise<unknown> }) {
  const { t, locale, session, notify } = useBlog()
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const media = useMomentMedia(entry)
  const viewed = useRef('')
  const [views, setViews] = useState(entry.views || 0)
  const canDelete = session?.uid === entry.uid || session?.isAdmin
  useEffect(() => {
    if (viewed.current === entry._id) return
    viewed.current = entry._id
    void send<Envelope<{ views: number }>>('moments/view', { momentId: entry._id }).then(result => setViews(result.data.views)).catch(() => {})
  }, [entry._id])
  async function remove() {
    await send('moments/delete', { momentId: entry._id, moment_uid: entry.uid }, 'DELETE')
    await mutate(key => typeof key === 'string' && (
      key.startsWith('/api/blog/moments/get?')
      || key.startsWith('/api/blog/archive/feed?')
      || key === '/api/blog/archive/sitemap'
      || key.startsWith('/api/blog/moments/summary?')
    ))
    router.push('/moments')
  }
  return <><header className={styles['reader-header']}><div className={styles['eyebrow']}>02 / FRAGMENTS</div><h1>{entry.title}</h1><div className={styles['entry-meta']}><span>{entry.username || 'YororoIce'}</span><time dateTime={entry.createdAt}>{dateLabel(entry.createdAt, locale)}</time><span>↗ {views}</span></div></header>
    <Markdown content={entry.content} /><MediaGrid files={media.files} /><State loading={media.isLoading} error={media.error} retry={() => media.mutate()} />
    <div className={styles['reader-actions']}><LikeButton kind="moment" id={entry._id} count={entry.likes} /><button className={styles['secondary-button']} onClick={async () => { try { await navigator.clipboard.writeText(location.href); notify(t('copied')) } catch { notify(location.href) } }}><Share2 size={15} />{t('share')}</button>{canDelete && <DeleteButton name={entry.title} onDelete={remove} />}</div>
    <Comments entry={entry} refresh={refresh} />
  </>
}

export function MomentDetail({ id, initialEntry }: { id: string; initialEntry: Entry }) {
  const { t } = useBlog()
  const params = useSearchParams()
  const returnTo = safeReturnPath(params.get('returnTo'), 'moments')
  const { data, error, isLoading, mutate } = useBlogData<Envelope<Entry>>(`moments/${id}`, {
    fallbackData: { data: initialEntry },
    revalidateOnMount: false,
  })
  const entry = data?.data
  return <div className={styles['page']}><div className={styles['reader']}><Link className={styles['text-link']} href={returnTo} scroll={false} onNavigate={() => prepareListReturn(returnTo)}><ArrowLeft size={16} />{t('moments')}</Link><State loading={isLoading} error={error} empty={!!data && !entry} retry={() => mutate()} />{entry && <MomentReader key={id} entry={entry} refresh={mutate} />}</div></div>
}

function requestKey(prefix: string) {
  const value = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}:${value}`
}

function Compose() {
  const { t, session, notify } = useBlog()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [descriptions, setDescriptions] = useState<Record<string, string>>({})
  const [acknowledge, setAcknowledge] = useState(false)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [restoredMedia, setRestoredMedia] = useState(false)
  const [draftId, setDraftId] = useState('')
  const [autosave, setAutosave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('')
  const [allowLeave, setAllowLeave] = useState(false)
  const uploads = useManagedUploads('moment')
  const draft = useBlogData<Envelope<Entry | null>>(`moments/get?isEditing=true&account=${session!.uid}`)
  const localDraftKey = `ark.moment-draft.v1:${session!.uid}`
  const publishKey = useRef(requestKey('moment-publish'))
  const currentSnapshotRef = useRef('')
  const errorRef = useRef<HTMLParagraphElement>(null)
  const uploadedMedia = useMemo(() => uploads.items.flatMap(item => item.asset ? [{
    assetId: item.asset.id,
    description: descriptions[item.key] || '',
  }] : []), [descriptions, uploads.items])
  const snapshotFor = (media: typeof uploadedMedia) => JSON.stringify({
    title,
    content,
    acknowledge,
    media,
  })
  const currentSnapshot = snapshotFor(uploadedMedia)
  const hasDraftContent = !!(title.trim() || content.trim() || uploads.items.length || restoredMedia)
  const hasPendingUploads = uploads.items.some(item => item.status !== 'done')
  const hasUnsavedChanges = !allowLeave && (
    busy
    || hasPendingUploads
    || (hasDraftContent && currentSnapshot !== lastSavedSnapshot)
  )

  useEffect(() => { currentSnapshotRef.current = currentSnapshot }, [currentSnapshot])

  useEffect(() => {
    let frame = 0
    try {
      const saved = JSON.parse(localStorage.getItem(localDraftKey) || 'null') as {
        title?: string
        content?: string
        acknowledge?: boolean
        descriptions?: Record<string, string>
        fileNames?: string[]
      } | null
      if (!saved) return
      frame = requestAnimationFrame(() => {
        setTitle(saved.title || '')
        setContent(saved.content || '')
        setAcknowledge(!!saved.acknowledge)
        setDescriptions(saved.descriptions || {})
        setRestoredMedia(!!saved.fileNames?.length)
      })
    } catch { /* Local autosave is optional. */ }
    return () => cancelAnimationFrame(frame)
  }, [localDraftKey])

  useEffect(() => {
    try {
      // Do not clear here: this effect also runs once before local hydration.
      if (!hasDraftContent) return
      localStorage.setItem(localDraftKey, JSON.stringify({
        title,
        content,
        acknowledge,
        descriptions,
        fileNames: uploads.files.map(file => file.name),
        updatedAt: Date.now(),
      }))
    } catch { /* Server autosave remains available. */ }
  }, [acknowledge, content, descriptions, hasDraftContent, localDraftKey, title, uploads.files])

  useEffect(() => {
    if (!hasDraftContent || busy || uploads.isUploading || draft.isLoading || currentSnapshot === lastSavedSnapshot) return
    const timer = window.setTimeout(() => {
      setAutosave('saving')
      void sendIdempotent<Envelope<Entry>>('moments/post', {
        title: title.trim(),
        content,
        published: false,
        acknowledge,
        draftId,
        media: uploadedMedia,
      }, requestKey('moment-autosave')).then(result => {
        setDraftId(result.data._id)
        setLastSavedSnapshot(currentSnapshot)
        setAutosave(currentSnapshotRef.current === currentSnapshot ? 'saved' : 'idle')
      }).catch(saveError => {
        setAutosave('error')
        setError((saveError as Error).message)
      })
    }, 1600)
    return () => window.clearTimeout(timer)
  }, [acknowledge, busy, content, currentSnapshot, draft.isLoading, draftId, hasDraftContent, lastSavedSnapshot, title, uploadedMedia, uploads.isUploading])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const confirmNavigation = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!anchor || anchor.target === '_blank' || anchor.download || anchor.origin !== location.origin || anchor.href === location.href) return
      if (window.confirm(t('unsavedChanges'))) {
        setAllowLeave(true)
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', confirmNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', confirmNavigation, true)
    }
  }, [hasUnsavedChanges, t])

  useEffect(() => {
    if (!error) return
    errorRef.current?.focus()
  }, [error])

  async function submit(published: boolean) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const itemKeys = uploads.items.map(item => item.key)
      const assets = await uploads.uploadAll()
      const media = assets.map((asset, index) => ({
        assetId: asset.id,
        description: descriptions[itemKeys[index]] || '',
      }))
      const result = await sendIdempotent<Envelope<Entry> & { upload?: { requested: number; uploaded: number; failed: number } }>('moments/post', {
        title: title.trim(),
        content,
        published,
        acknowledge,
        draftId,
        media,
      }, published ? publishKey.current : requestKey('moment-draft'))
      setDraftId(result.data._id)
      setLastSavedSnapshot(snapshotFor(media))
      setAutosave('saved')
      notify(result.upload?.failed ? t('partialUpload') : t('saved'))
      await draft.mutate()
      if (published) {
        setAllowLeave(true)
        try { localStorage.removeItem(localDraftKey) } catch {}
        await mutate(key => typeof key === 'string' && (
          key.startsWith('/api/blog/moments/get?')
          || key.startsWith('/api/blog/archive/feed?')
          || key === '/api/blog/archive/sitemap'
          || key.startsWith('/api/blog/moments/summary?')
        ))
        router.push(`/moments/${result.data._id}`)
      }
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  function restore() {
    const entry = draft.data?.data
    if (!entry) return
    const managedAssets: UploadedAsset[] = Object.entries(entry.filesDetail || {}).flatMap(([filename, detail]) => (
      detail.assetId && detail.secure_url
        ? [{
            id: detail.assetId,
            scope: 'moment',
            filename: detail.origin || filename,
            mime: detail.mime || 'image/jpeg',
            url: detail.secure_url,
            bytes: 0,
            status: 'referenced',
          }]
        : []
    ))
    const restoredDescriptions = Object.fromEntries(managedAssets.map(asset => {
      const detail = Object.values(entry.filesDetail || {}).find(value => value.assetId === asset.id)
      return [`asset:${asset.id}`, detail?.desc || '']
    }))
    const restoredMediaPayload = managedAssets.map(asset => ({
      assetId: asset.id,
      description: restoredDescriptions[`asset:${asset.id}`] || '',
    }))
    setDraftId(entry._id)
    setTitle(entry.title)
    setContent(entry.content)
    setAcknowledge(!!entry.acknowledge)
    setDescriptions(restoredDescriptions)
    uploads.restoreAssets(managedAssets)
    setRestoredMedia(Object.values(entry.filesDetail || {}).some(detail => !detail.assetId))
    setLastSavedSnapshot(JSON.stringify({
      title: entry.title,
      content: entry.content,
      acknowledge: !!entry.acknowledge,
      media: restoredMediaPayload,
    }))
    setAutosave('saved')
  }
  const localDescriptions = uploads.files.map(file => descriptions[`${file.name}:${file.size}:${file.lastModified}:${file.type}`] || '')
  return <form className={styles['form']} onSubmit={e => { e.preventDefault(); void submit(true) }}>
    <State error={draft.error} retry={() => draft.mutate()} />
    {draft.data?.data && <div><button type="button" disabled={busy} className={styles['secondary-button']} onClick={restore}>{t('restoreDraft')}</button></div>}
    {restoredMedia && <p className={styles['form-note']}>{t('draftMedia')}</p>}
    <label className={styles['field']}>{t('title')}<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <div><button type="button" className={styles['secondary-button']} aria-pressed={preview} onClick={() => setPreview(!preview)}>{t(preview ? 'edit' : 'preview')}</button></div>
    {preview ? <><Markdown content={content} /><LocalMediaGrid files={uploads.files} descriptions={localDescriptions} /></> : <label className={styles['field']}>{t('content')} / Markdown<AutoTextarea minRows={10} value={content} onChange={e => setContent(e.target.value)} /></label>}
    <FilePicker files={uploads.files} setFiles={uploads.setFiles} uploadItems={uploads.items} onRetry={key => { void uploads.retry(key).catch(uploadError => setError((uploadError as Error).message)) }} onRemove={uploads.remove} max={50} />
    {!!uploads.items.length && <><div className={styles['media-description-list']}><p className={styles['form-note']}>{t('mediaDescriptionHint')}</p>{uploads.items.map(item => <div className={styles['media-description-row']} key={item.key}><label className={styles['field']}><span className={styles['media-description-label']} title={item.file?.name || item.asset?.filename}>{t('mediaDescription')} · {item.file?.name || item.asset?.filename}</span><input maxLength={1000} value={descriptions[item.key] || ''} onChange={event => { const description = event.target.value; setDescriptions(value => ({ ...value, [item.key]: description })) }} /></label>{!item.file && <button type="button" className={styles['icon-button']} aria-label={`${t('removeFile')} ${item.asset?.filename || ''}`} onClick={() => uploads.remove(item.key)}><X size={14} /></button>}</div>)}</div><label className={styles['checkbox']}><input type="checkbox" checked={acknowledge} onChange={e => setAcknowledge(e.target.checked)} />{t('acknowledge')}</label></>}
    {autosave !== 'idle' && <p className={styles['form-note']} role="status">{t(autosave === 'saving' ? 'draftSaving' : autosave === 'saved' ? 'autoSaved' : 'uploadFailed')}</p>}
    {error && <p ref={errorRef} tabIndex={-1} role="alert" className={styles['error']}>{error}</p>}
    <div className={styles['form-actions']}><button disabled={busy || uploads.isUploading || !title.trim()} className={styles['primary-button']}>{t(busy ? 'saving' : 'publish')}</button><button type="button" disabled={busy || uploads.isUploading} className={styles['secondary-button']} onClick={() => submit(false)}>{t('draft')}</button><Link href="/moments" className={styles['secondary-button']}>{t('cancel')}</Link></div>
  </form>
}

export function MomentEditor() {
  const { session } = useBlog()
  return <div className={styles['page']}><PageHeading title="newMoment" english="A new fragment" number="02" /><RequireLogin><Compose key={session?.uid} /></RequireLogin></div>
}
