'use client'
/* eslint-disable @next/next/no-img-element -- Article covers are stored as arbitrary external Markdown URLs. */

import { useEffect, useRef, useState } from 'react'
import { useSWRConfig } from 'swr'
import Link from '@/components/appearance/p3r-link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Download, Pencil, Plus, Search, Share2 } from 'lucide-react'
import { articlePreview, dateLabel, Entry, Envelope, excerpt } from '@/lib/blog'
import { send, useBlog, useBlogData } from './blog-provider'
import { AutoTextarea, DeleteButton, FilePicker, LikeButton, LocalMediaGrid, Markdown, PageHeading, Pagination, RequireLogin, State, styles } from './shared'
import { DateField } from './controls'

function ArticleListEntry({ entry, locale, read }: { entry: Entry; locale: Parameters<typeof dateLabel>[1]; read: string }) {
  const preview = articlePreview(entry.content)
  return <Link key={entry._id} href={`/articles/${entry._id}`} prefetch={false} className={styles['article-card']} data-cover={!!preview.coverUrl}>
    <time className={styles['article-date']} dateTime={entry.createdAt}><strong>{new Date(entry.createdAt).getUTCDate().toString().padStart(2, '0')}</strong>{entry.createdAt.slice(0, 7).replace('-', ' / ')}</time>
    {preview.coverUrl && <figure className={styles['article-cover']}><img src={preview.coverUrl} alt={preview.coverAlt || entry.title} loading="lazy" /></figure>}
    <div className={styles['article-card-body']}><h2>{entry.title}</h2><p>{excerpt(preview.content, 190)}</p><div className={styles['entry-meta']}><span>{entry.category}</span><span>{entry.username || 'YororoIce'}</span><span>{dateLabel(entry.createdAt, locale)}</span><span>♡ {entry.likes || 0}</span></div></div>
    <span className={styles['article-arrow']}>{read}<ArrowUpRight size={24} strokeWidth={1} /></span>
  </Link>
}

export function ArticleList({ initialData }: { initialData?: Envelope<Entry[]> }) {
  const { t, locale, session } = useBlog()
  const router = useRouter()
  const params = useSearchParams()
  const [query, setQuery] = useState(params.get('keyword') || '')
  const keyword = params.get('keyword') || ''
  const category = params.get('category') || ''
  const date = params.get('date') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const list = useBlogData<Envelope<Entry[]>>(`knowledge?limit=10&page=${page}&keyword=${encodeURIComponent(keyword)}&category=${encodeURIComponent(category)}&date=${encodeURIComponent(date)}`, {
    fallbackData: initialData,
    revalidateOnMount: !initialData,
  })
  const categories = useBlogData<Envelope<string[]>>('knowledge/meta/categories')
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (value) next.set(key, value); else next.delete(key)
    router.push(`/articles?${next}`)
  }
  return <div className={styles['page']}><PageHeading title="articles" english="Writings" number="01">{session && !session.isGuest && <Link href="/articles/new" className={styles['primary-button']}><Plus size={16} />{t('newArticle')}</Link>}</PageHeading>
    <div className={styles['toolbar']}><DateField value={date} onChange={value => filter('date', value)} />{date && <button className={styles['secondary-button']} onClick={() => filter('date', '')}>{t('reset')}</button>}</div>
    <div className={styles['toolbar']}><div className={styles['filters']}><button aria-pressed={!category} onClick={() => filter('category', '')}>{t('all')}</button>{categories.data?.data.map(item => <button key={item} aria-pressed={category === item} onClick={() => filter('category', item)}>{item}</button>)}</div><form className={styles['search-field']} onSubmit={e => { e.preventDefault(); filter('keyword', query) }}><Search size={16} /><input aria-label={t('search')} placeholder={t('search')} value={query} onChange={e => setQuery(e.target.value)} /><button aria-label={t('search')} className={styles['icon-button']}><ArrowUpRight size={16} /></button></form></div>
    <State loading={list.isLoading} error={list.error} empty={list.data?.data.length === 0} retry={() => { void list.mutate() }} />
    <div className={styles['article-list']}>{list.data?.data.map(entry => <ArticleListEntry key={entry._id} entry={entry} locale={locale} read={t('read')} />)}</div>
    <Pagination page={page} pages={list.data?.pagination?.pages || 1} change={value => filter('page', String(value))} />
  </div>
}

export function ArticleDetail({ id, initialArticle }: { id: string; initialArticle: Entry }) {
  const { t, locale, session, notify } = useBlog()
  const router = useRouter()
  const { mutate: refresh } = useSWRConfig()
  const viewed = useRef('')
  const [views, setViews] = useState(initialArticle.views || 0)
  const { data, error, isLoading, mutate } = useBlogData<Envelope<Entry>>(`knowledge/${id}`, {
    fallbackData: { data: initialArticle },
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnMount: false,
  })
  const article = data?.data
  const isOwner = !!article && session?.uid === article.uid
  const canDelete = isOwner || session?.isAdmin
  useEffect(() => {
    if (viewed.current === id) return
    viewed.current = id
    void send<Envelope<{ views: number }>>('knowledge/view', { articleId: id })
      .then(result => setViews(result.data.views))
      .catch(() => {})
  }, [id])
  async function remove() {
    await send(`knowledge/${id}`, {}, 'DELETE')
    await refresh(key => typeof key === 'string' && (key.startsWith('/api/blog/knowledge?') || key.startsWith('/api/blog/archive/feed?')))
    router.push('/articles')
  }
  function exportMarkdown() {
    if (!article) return
    const url = URL.createObjectURL(new Blob([`# ${article.title}\n\n${article.content}`], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `${article.title.replace(/[\\/:*?"<>|]/g, '_')}.md`; link.click(); URL.revokeObjectURL(url)
  }
  return <div className={styles['page']}><div className={styles['reader']}><Link href="/articles" className={styles['text-link']}><ArrowLeft size={16} />{t('articles')}</Link><State loading={isLoading} error={error} retry={() => mutate()} />{article && <><header className={styles['reader-header']}><div className={styles['eyebrow']}>01 / {article.category || 'WRITINGS'}</div><h1>{article.title}</h1><div className={styles['entry-meta']}><span>{article.username || 'YororoIce'}</span><time dateTime={article.createdAt}>{dateLabel(article.createdAt, locale)}</time><span>{Math.max(1, Math.ceil(article.content.length / 650))} {t('readTime')}</span><span>↗ {views}</span></div>{!!article.tags?.length && <div className={styles['tags']}>{article.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}</header><Markdown content={article.content} /><div className={styles['reader-actions']}><LikeButton kind="article" id={id} count={article.likes} /><button className={styles['secondary-button']} onClick={exportMarkdown}><Download size={15} />{t('export')}</button><button className={styles['secondary-button']} onClick={async () => { try { await navigator.clipboard.writeText(location.href); notify(t('copied')) } catch { notify(location.href) } }}><Share2 size={15} />{t('share')}</button>{isOwner && <Link href={`/articles/${id}/edit`} className={styles['secondary-button']}><Pencil size={15} />{t('edit')}</Link>}{canDelete && <DeleteButton name={article.title} onDelete={remove} />}</div></>}</div></div>
}

function Editor({ article }: { article?: Entry }) {
  const { t, notify } = useBlog()
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const [title, setTitle] = useState(article?.title || '')
  const [content, setContent] = useState(article?.content || '')
  const [category, setCategory] = useState(article?.category || '')
  const [tags, setTags] = useState(article?.tags?.join(', ') || '')
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState<File[]>([])
  const editor = useRef<HTMLTextAreaElement>(null)
  const selection = useRef({ start: content.length, end: content.length })
  const restoreCursor = useRef<number | null>(null)
  function rememberSelection(textarea: HTMLTextAreaElement) {
    editor.current = textarea
    selection.current = { start: textarea.selectionStart, end: textarea.selectionEnd }
  }
  useEffect(() => {
    const cursor = restoreCursor.current
    if (busy || preview || cursor === null || !editor.current?.isConnected) return
    const frame = requestAnimationFrame(() => {
      editor.current?.focus()
      editor.current?.setSelectionRange(cursor, cursor)
      restoreCursor.current = null
    })
    return () => cancelAnimationFrame(frame)
  }, [busy, content, preview])
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const result = await send<Envelope<Entry>>(article ? `knowledge/${article._id}` : 'knowledge', { title: title.trim(), content, category, tags: tags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean) }, article ? 'PUT' : 'POST')
      await mutate(`/api/blog/knowledge/${result.data._id}`, result, { revalidate: false })
      await mutate(key => typeof key === 'string' && (key.startsWith('/api/blog/knowledge?') || key.startsWith('/api/blog/archive/feed?') || key === '/api/blog/knowledge/meta/categories'))
      notify(t('saved')); router.push(`/articles/${result.data._id}`)
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  async function upload() {
    if (!images[0]) return
    const image = images[0]
    const range = selection.current
    setBusy(true); setError('')
    try {
      const form = new FormData(); form.append('image', image)
      const result = await send<Envelope<{ url: string }>>('knowledge/upload-image', form)
      const markdown = `![${image.name.replace(/[\[\]]/g, '')}](${result.data.url})`
      let cursor = range.start + markdown.length
      setContent(value => {
        const start = Math.min(range.start, value.length)
        const end = Math.max(start, Math.min(range.end, value.length))
        cursor = start + markdown.length
        return `${value.slice(0, start)}${markdown}${value.slice(end)}`
      })
      selection.current = { start: cursor, end: cursor }
      restoreCursor.current = cursor
      setImages([])
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <form className={styles['form']} onSubmit={submit}><label className={styles['field']}>{t('title')}<input required value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></label><div className={styles['form-row']}><label className={styles['field']}>{t('category')}<input value={category} onChange={e => setCategory(e.target.value)} /></label><label className={styles['field']}>{t('tags')}<input value={tags} onChange={e => setTags(e.target.value)} /></label></div><div className={styles['form-actions']}><button type="button" className={styles['secondary-button']} aria-pressed={preview} onClick={() => setPreview(!preview)}>{t(preview ? 'edit' : 'preview')}</button><FilePicker files={images} setFiles={setImages} max={1} imageOnly label={t('insertMedia')} onBeforeSelect={() => { if (editor.current?.isConnected) rememberSelection(editor.current) }} />{!!images.length && <button type="button" className={styles['secondary-button']} disabled={busy} onClick={upload}>{t('insertMedia')}</button>}</div>{preview ? <><Markdown content={content} /><LocalMediaGrid files={images} /></> : <label className={styles['field']}>{t('content')} / Markdown<AutoTextarea required minRows={14} disabled={busy} className={styles['editor-textarea']} value={content} onChange={e => { setContent(e.target.value); rememberSelection(e.currentTarget) }} onSelect={e => rememberSelection(e.currentTarget)} onBlur={e => rememberSelection(e.currentTarget)} /></label>}{error && <p role="alert" className={styles['error']}>{error}</p>}<div className={styles['form-actions']}><button className={styles['primary-button']} disabled={busy || !title.trim() || !content.trim()}>{t(busy ? 'saving' : article ? 'save' : 'publish')}</button><Link href={article ? `/articles/${article._id}` : '/articles'} className={styles['secondary-button']}>{t('cancel')}</Link></div></form>
}
export function ArticleEditor({ id }: { id?: string }) {
  const { session } = useBlog()
  const data = useBlogData<Envelope<Entry>>(id ? `knowledge/${id}` : null, { revalidateOnFocus: false, revalidateIfStale: false })
  const canEdit = !id || (data.data?.data.uid === session?.uid)
  return <div className={styles['page']}><PageHeading title={id ? 'edit' : 'newArticle'} english="Compose" number="01" /><RequireLogin>{id ? <><State loading={data.isLoading} error={data.error} retry={() => data.mutate()} />{data.data && (canEdit ? <Editor article={data.data.data} /> : <p className={styles['error']}>403</p>)}</> : <Editor />}</RequireLogin></div>
}
