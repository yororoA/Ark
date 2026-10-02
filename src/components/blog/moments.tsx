'use client'
/* eslint-disable @next/next/no-img-element -- Preserve dimensions of existing blog media. */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR, { useSWRConfig } from 'swr'
import { ArrowLeft, ArrowUpRight, MessageSquare, Plus, Reply, Share2, Trash2, X } from 'lucide-react'
import { Comment, dateLabel, Entry, Envelope, excerpt, Media, mediaFor, safeUrl } from '@/lib/blog'
import { send, useBlog, useBlogData } from './blog-provider'
import { FilePicker, LikeButton, Markdown, MediaGrid, PageHeading, Pagination, RequireLogin, State, styles } from './shared'

function useMomentMedia(entry: Entry) {
  const direct = mediaFor(entry)
  const resolved = new Set(direct.map(file => file.filename))
  const missing = Object.keys(entry.filenames || {}).filter(name => !resolved.has(name))
  const path = missing.length ? `moments/files?from=moments&filenames=${encodeURIComponent(missing.join(','))}` : null
  const result = useBlogData<Envelope<Media[]>>(path, { revalidateOnFocus: false })
  const files = [...direct, ...(result.data?.data || []).filter(file => safeUrl(file.url))]
  return { ...result, files }
}

function MomentCard({ entry }: { entry: Entry }) {
  const { locale, t } = useBlog()
  const { files } = useMomentMedia(entry)
  const cover = files[0]
  return <article className={styles['moment-card']}>
    <div className={styles['entry-meta']}><time>{dateLabel(entry.createdAt, locale)}</time><span>{entry.username || 'YororoIce'}</span></div>
    <Link href={`/moments/${entry._id}`}><h2>{entry.title}</h2>
      {cover && (cover.mime.startsWith('video') ? <video className={styles['moment-media']} src={cover.url} muted preload="metadata" aria-label={entry.title} /> : <img className={styles['moment-media']} src={cover.url} alt={cover.desc || entry.title} loading="lazy" />)}
      <p>{excerpt(entry.content, 160)}</p>
      <div className={styles['entry-meta']}><span>♡ {entry.likes || 0}</span><span><MessageSquare size={12} /> {entry.comments?.length || 0}</span><span>{t('read')} <ArrowUpRight size={13} /></span></div>
    </Link>
  </article>
}

export function MomentList() {
  const { t, session } = useBlog()
  const router = useRouter()
  const params = useSearchParams()
  const date = params.get('date') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, error, isLoading, mutate } = useBlogData<Envelope<Entry[]>>('moments/get?isEditing=false')
  const entries = (data?.data || []).filter(entry => !date || entry.createdAt.slice(0, 10) === date)
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (value) next.set(key, value); else next.delete(key)
    router.push(`/moments?${next}`)
  }
  return <div className={styles['page']}>
    <PageHeading title="moments" english="Fragments" number="02">{session && !session.isGuest && <Link className={styles['primary-button']} href="/moments/new"><Plus size={16} />{t('newMoment')}</Link>}</PageHeading>
    <div className={styles['toolbar']}><span className={styles['eyebrow']}>{entries.length} / {t('entries')}</span><div className={styles['form-actions']}><label className={styles['small-field']}>{t('date')}<input type="date" value={date} onChange={e => filter('date', e.target.value)} /></label>{date && <button className={styles['secondary-button']} onClick={() => filter('date', '')}>{t('reset')}</button>}</div></div>
    <State loading={isLoading} error={error} empty={!!data && !entries.length} retry={() => mutate()} />
    <div className={styles['moments-grid']}>{entries.slice((page - 1) * 12, page * 12).map(entry => <MomentCard key={entry._id} entry={entry} />)}</div>
    <Pagination page={page} pages={Math.ceil(entries.length / 12)} change={value => filter('page', String(value))} />
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
  const [deleting, setDeleting] = useState(false)
  const canDelete = session?.uid === entry.uid || session?.isAdmin
  useEffect(() => {
    if (viewed.current === entry._id) return
    viewed.current = entry._id
    void send<Envelope<{ views: number }>>('moments/view', { momentId: entry._id }).then(result => setViews(result.data.views)).catch(() => {})
  }, [entry._id])
  async function remove() {
    if (!confirm(t('confirmDelete'))) return
    setDeleting(true)
    try {
      await send('moments/delete', { momentId: entry._id, moment_uid: entry.uid }, 'DELETE')
      await mutate('/api/blog/moments/get?isEditing=false')
      router.push('/moments')
    } catch (error) { notify((error as Error).message); setDeleting(false) }
  }
  return <><header className={styles['reader-header']}><div className={styles['eyebrow']}>02 / FRAGMENTS</div><h1>{entry.title}</h1><div className={styles['entry-meta']}><span>{entry.username || 'YororoIce'}</span><time>{dateLabel(entry.createdAt, locale)}</time><span>↗ {views}</span></div></header>
    <Markdown content={entry.content} /><MediaGrid files={media.files} /><State loading={media.isLoading} error={media.error} retry={() => media.mutate()} />
    <div className={styles['reader-actions']}><LikeButton kind="moment" id={entry._id} count={entry.likes} /><button className={styles['secondary-button']} onClick={async () => { try { await navigator.clipboard.writeText(location.href); notify(t('copied')) } catch { notify(location.href) } }}><Share2 size={15} />{t('share')}</button>{canDelete && <button disabled={deleting} className={styles['secondary-button']} onClick={remove}><Trash2 size={15} />{t('delete')}</button>}</div>
    <Comments entry={entry} refresh={refresh} />
  </>
}

export function MomentDetail({ id }: { id: string }) {
  const { t } = useBlog()
  const { data, error, isLoading, mutate } = useBlogData<Envelope<Entry[]>>('moments/get?isEditing=false')
  const entry = data?.data.find(item => item._id === id)
  return <div className={styles['page']}><div className={styles['reader']}><Link className={styles['text-link']} href="/moments"><ArrowLeft size={16} />{t('moments')}</Link><State loading={isLoading} error={error} empty={!!data && !entry} retry={() => mutate()} />{entry && <MomentReader key={id} entry={entry} refresh={mutate} />}</div></div>
}

function Compose() {
  const { t, session, notify } = useBlog()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [description, setDescription] = useState('')
  const [acknowledge, setAcknowledge] = useState(false)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [restoredMedia, setRestoredMedia] = useState(false)
  const draft = useBlogData<Envelope<Entry | null>>(`moments/get?isEditing=true&account=${session!.uid}`)
  async function submit(published: boolean) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const form = new FormData()
      form.append('title', title.trim()); form.append('content', content)
      form.append('published', String(published)); form.append('acknowledge', String(acknowledge))
      form.append('descriptions', JSON.stringify(Object.fromEntries(files.map(file => [file.name, description]))))
      for (const file of files) form.append('files', file)
      const result = await send<Envelope<Entry>>('moments/post', form)
      const uploaded = Object.keys(result.data.filenames || {}).length
      notify(uploaded < files.length ? t('partialUpload') : t('saved'))
      await draft.mutate()
      if (published) {
        await mutate('/api/blog/moments/get?isEditing=false')
        router.push(`/moments/${result.data._id}`)
      }
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  function restore() {
    const entry = draft.data?.data
    if (!entry) return
    setTitle(entry.title); setContent(entry.content); setFiles([])
    setRestoredMedia(!!Object.keys(entry.filenames || {}).length)
  }
  return <form className={styles['form']} onSubmit={e => { e.preventDefault(); void submit(true) }}>
    <State error={draft.error} retry={() => draft.mutate()} />
    {draft.data?.data && <div><button type="button" disabled={busy} className={styles['secondary-button']} onClick={restore}>{t('restoreDraft')}</button></div>}
    {restoredMedia && <p className={styles['form-note']}>{t('draftMedia')}</p>}
    <label className={styles['field']}>{t('title')}<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <div><button type="button" className={styles['secondary-button']} aria-pressed={preview} onClick={() => setPreview(!preview)}>{t(preview ? 'edit' : 'preview')}</button></div>
    {preview ? <Markdown content={content} /> : <label className={styles['field']}>{t('content')} / Markdown<textarea rows={10} value={content} onChange={e => setContent(e.target.value)} /></label>}
    <FilePicker files={files} setFiles={setFiles} max={50} />
    {!!files.length && <><label className={styles['field']}>{t('description')}<input value={description} onChange={e => setDescription(e.target.value)} /></label><label className={styles['checkbox']}><input type="checkbox" checked={acknowledge} onChange={e => setAcknowledge(e.target.checked)} />{t('acknowledge')}</label></>}
    {error && <p role="alert" className={styles['error']}>{error}</p>}
    <div className={styles['form-actions']}><button disabled={busy || !title.trim()} className={styles['primary-button']}>{t(busy ? 'saving' : 'publish')}</button><button type="button" disabled={busy} className={styles['secondary-button']} onClick={() => submit(false)}>{t('draft')}</button><Link href="/moments" className={styles['secondary-button']}>{t('cancel')}</Link></div>
  </form>
}

export function MomentEditor() {
  const { session } = useBlog()
  return <div className={styles['page']}><PageHeading title="newMoment" english="A new fragment" number="02" /><RequireLogin><Compose key={session?.uid} /></RequireLogin></div>
}
