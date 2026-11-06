'use client'
/* eslint-disable @next/next/no-img-element -- Article covers are stored as arbitrary external Markdown URLs. */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useSWRConfig } from 'swr'
import Link from '@/components/appearance/p3r-link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Download, Pencil, Plus, Search, Share2, X } from 'lucide-react'
import { articlePreview, dateLabel, Entry, Envelope, excerpt, SitemapContent } from '@/lib/blog'
import { send, useBlog, useBlogData, useBlogReferenceData } from './blog-provider'
import { useManagedUploads, type UploadedAsset } from './media-upload'
import { AutoTextarea, DeleteButton, FilePicker, LikeButton, LocalMediaGrid, Markdown, PageHeading, Pagination, RequireLogin, State, styles } from './shared'
import { DateField } from './controls'
import { shareContent } from '@/lib/share'
import PrismRecord from './prism-record'
import VoyageReader from './voyage-reader'
import { detailPath, listPath, newestFirst, prepareListReturn, rememberListPosition, safeReturnPath, useRestoreListPosition } from './list-navigation'
import searchStyles from './article-search.module.scss'

function ArticleListEntry({ entry, locale, read, returnTo }: { entry: Entry; locale: Parameters<typeof dateLabel>[1]; read: string; returnTo: string }) {
  const preview = articlePreview(entry.content)
  return <Link key={entry._id} href={detailPath('articles', entry._id, returnTo)} className={styles['article-card']} data-cover={!!preview.coverUrl} onNavigate={() => rememberListPosition(returnTo)}>
    <PrismRecord title={entry.title} category={entry.category} coverUrl={preview.coverUrl} coverAlt={preview.coverAlt} id={entry._id} date={entry.createdAt} />
    <time className={styles['article-date']} dateTime={entry.createdAt}><strong>{new Date(entry.createdAt).getUTCDate().toString().padStart(2, '0')}</strong>{entry.createdAt.slice(0, 7).replace('-', ' / ')}</time>
    {preview.coverUrl && <figure className={styles['article-cover']}><img src={preview.coverUrl} alt={preview.coverAlt || entry.title} loading="lazy" /></figure>}
    <div className={styles['article-card-body']}><h2>{entry.title}</h2><p>{excerpt(preview.content, 190)}</p><div className={styles['entry-meta']}><span>{entry.category}</span><span>{entry.username || 'YororoIce'}</span><span>{dateLabel(entry.createdAt, locale)}</span><span>♡ {entry.likes || 0}</span></div></div>
    <span className={styles['article-arrow']}>{read}<ArrowUpRight size={24} strokeWidth={1} /></span>
  </Link>
}

function ArticleSearch({ keyword, resetVersion, search, pending }: { keyword: string; resetVersion: number; search: (value: string) => void; pending: boolean }) {
  const { t } = useBlog()
  const [draft, setDraft] = useState({ keyword, resetVersion, value: keyword, submitted: null as string | null })
  if (draft.resetVersion !== resetVersion) {
    setDraft({ keyword, resetVersion, value: '', submitted: '' })
  } else if (draft.keyword !== keyword) {
    // An arriving response owns the submitted keyword, not a new draft typed
    // while it was loading. Other URL changes (such as Back) restore the URL.
    setDraft({ keyword, resetVersion, value: draft.submitted === keyword ? draft.value : keyword, submitted: null })
  }
  function submit(value: string) {
    setDraft(previous => ({ ...previous, value, submitted: value }))
    search(value)
  }
  return <form className={`${styles['search-field']} ${searchStyles.field}`} role="search" data-pending={pending} onSubmit={e => {
    e.preventDefault()
    submit(draft.value.trim())
    // A submitted phone search should reveal its results and bottom navigation.
    // WebKit keeps the input focused when tapping non-interactive page content.
    if (matchMedia('(max-width: 640px)').matches) e.currentTarget.querySelector('input')?.blur()
  }}><Search size={16} /><input type="search" enterKeyHint="search" aria-label={t('search')} placeholder={t('search')} value={draft.value} onChange={e => { const value = e.target.value; setDraft(previous => ({ ...previous, value })) }} />
    {(draft.value || keyword || pending) && <button type="button" aria-label={t('clearArticleSearch')} className={`${styles['icon-button']} ${searchStyles.clear}`} onClick={() => submit('')}><X size={15} /></button>}
    <button aria-label={t('search')} className={`${styles['icon-button']} ${searchStyles.submit}`}><ArrowUpRight size={16} /></button></form>
}

function revealFilterItem(strip: HTMLElement, item: Element | null) {
  if (!item || !strip.clientWidth || strip.scrollWidth <= strip.clientWidth) return
  const viewport = strip.getBoundingClientRect()
  const target = item.getBoundingClientRect()
  const left = viewport.left + strip.clientLeft
  const right = left + strip.clientWidth
  // Reveal only the horizontal filter strip; never move the reading position.
  if (target.left < left) strip.scrollLeft += target.left - left
  else if (target.right > right) strip.scrollLeft += target.right - right
}

export function ArticleList({ initialData }: { initialData?: Envelope<Entry[]> }) {
  const { t, locale, session } = useBlog()
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [hasSearched, setHasSearched] = useState(false)
  const committedQuery = params.toString()
  const requestedQuery = useRef(committedQuery)
  useEffect(() => { requestedQuery.current = committedQuery }, [committedQuery])
  const keyword = params.get('keyword') || ''
  const [searchResetVersion, setSearchResetVersion] = useState(0)
  const category = params.get('category') || ''
  const date = params.get('date') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const returnTo = listPath('articles', params)
  const list = useBlogData<Envelope<Entry[]>>(`knowledge?limit=10&page=${page}&keyword=${encodeURIComponent(keyword)}&category=${encodeURIComponent(category)}&date=${encodeURIComponent(date)}`, {
    fallbackData: initialData,
    revalidateOnMount: initialData ? false : undefined,
  })
  const categories = useBlogReferenceData<Envelope<string[]>>('knowledge/meta/categories')
  const categoryStrip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const strip = categoryStrip.current
    if (!strip) return
    const reveal = () => revealFilterItem(strip, strip.querySelector('button[aria-pressed="true"]'))
    reveal()
    const resize = new ResizeObserver(reveal)
    resize.observe(strip)
    return () => resize.disconnect()
  }, [category, categories.data])
  const sitemap = useBlogReferenceData<Envelope<SitemapContent>>('archive/sitemap')
  const entries = newestFirst(list.data?.data || [])
  const availableDates = sitemap.data ? new Set(sitemap.data.data.articles.map(entry => entry.createdAt.slice(0, 10))) : undefined
  const busy = isPending || list.isLoading
  const hasFilters = Boolean(keyword || category || date)
  const resultCount = (list.data?.pagination?.total ?? entries.length).toLocaleString(locale)
  useRestoreListPosition(returnTo, !!list.data)
  function navigate(next: URLSearchParams) {
    setHasSearched(true)
    requestedQuery.current = next.toString()
    const destination = requestedQuery.current ? `/articles?${requestedQuery.current}` : '/articles'
    startTransition(() => router.push(destination))
  }
  function filter(key: string, value: string) {
    // Rapid search/category changes compose against the latest requested
    // conditions, even while the previously committed list remains on screen.
    const next = new URLSearchParams(requestedQuery.current)
    next.delete('page')
    if (value) next.set(key, value); else next.delete(key)
    navigate(next)
  }
  function clearFilters() {
    setSearchResetVersion(value => value + 1)
    const next = new URLSearchParams(requestedQuery.current)
    for (const key of ['keyword', 'category', 'date', 'page']) next.delete(key)
    navigate(next)
  }
  return <div className={styles['page']} data-blog-view="articles"><PageHeading title="articles" english="Writings" number="01">{session && !session.isGuest && <Link href="/articles/new" className={styles['primary-button']}><Plus size={16} />{t('newArticle')}</Link>}</PageHeading>
    <div className={styles['article-tools']} data-date-active={!!date}>
      <div className={styles['toolbar']} data-tool-group="date"><DateField value={date} availableDates={availableDates} onChange={value => filter('date', value)} />{date && <button className={styles['secondary-button']} onClick={() => filter('date', '')}>{t('reset')}</button>}</div>
      <div className={styles['toolbar']} data-tool-group="query"><div ref={categoryStrip} className={styles['filters']} onFocusCapture={event => { if (event.target instanceof HTMLElement) revealFilterItem(event.currentTarget, event.target.closest('button')) }}><button aria-pressed={!category} onClick={() => filter('category', '')}><span>{t('all')}</span></button>{categories.data?.data.map(item => <button key={item} title={item} aria-pressed={category === item} onClick={() => filter('category', item)}><span>{item}</span></button>)}</div><ArticleSearch keyword={keyword} resetVersion={searchResetVersion} pending={busy} search={value => filter('keyword', value)} /></div>
    </div>
    {(hasSearched || hasFilters || busy || list.data?.data.length === 0) && <div className={searchStyles.feedback} data-article-search-feedback data-pending={busy}>
      <p role="status" aria-live="polite" aria-atomic="true">{busy ? t('articleSearchUpdating') : list.error ? '' : list.data ? t('articleSearchResults').replace('{count}', resultCount) : ''}</p>
      {!busy && !list.error && list.data?.data.length === 0 && hasFilters && <button type="button" onClick={clearFilters}>{t('clearArticleFilters')}<X size={14} /></button>}
    </div>}
    <section aria-label={t('articleSearchRegion')} aria-busy={busy} data-article-search-results>
    <State loading={list.isLoading} error={list.error} empty={list.data?.data.length === 0} retry={() => { void list.mutate() }} />
    <div className={styles['article-list']}>{entries.map(entry => <ArticleListEntry key={entry._id} entry={entry} locale={locale} read={t('read')} returnTo={returnTo} />)}</div>
    <Pagination page={page} pages={list.data?.pagination?.pages || 1} change={value => filter('page', String(value))} />
    </section>
  </div>
}

export function ArticleDetail({ id, initialArticle }: { id: string; initialArticle: Entry }) {
  const { t, locale, session, notify } = useBlog()
  const router = useRouter()
  const params = useSearchParams()
  const returnTo = safeReturnPath(params.get('returnTo'), 'articles')
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
    await refresh(key => typeof key === 'string' && (
      key.startsWith('/api/blog/knowledge?')
      || key.startsWith('/api/blog/archive/feed?')
      || key === '/api/blog/archive/sitemap'
    ))
    router.push('/articles')
  }
  function exportMarkdown() {
    if (!article) return
    const url = URL.createObjectURL(new Blob([`# ${article.title}\n\n${article.content}`], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `${article.title.replace(/[\\/:*?"<>|]/g, '_')}.md`; link.click(); URL.revokeObjectURL(url)
  }
  return <div className={styles['page']}><div className={styles['reader']} data-voyage-reader>
    <Link href={returnTo} scroll={false} className={styles['text-link']} onNavigate={() => prepareListReturn(returnTo)}><ArrowLeft size={16} />{t('articles')}</Link>
    <State loading={isLoading} error={error} retry={() => mutate()} />
    {article && <VoyageReader key={article._id} articleId={article._id} contentKey={article.content} locale={locale}>
      <header className={styles['reader-header']}>
        <div className={styles['eyebrow']}>01 / {article.category || 'WRITINGS'}</div>
        <h1>{article.title}</h1>
        <div className={styles['entry-meta']}><span>{article.username || 'YororoIce'}</span><time dateTime={article.createdAt}>{dateLabel(article.createdAt, locale)}</time><span>{Math.max(1, Math.ceil(article.content.length / 650))} {t('readTime')}</span><span>↗ {views}</span></div>
        {!!article.tags?.length && <div className={styles['tags']}>{article.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
      </header>
      <Markdown content={article.content} readingGuide />
      <div className={styles['reader-actions']}>
        <LikeButton kind="article" id={id} count={article.likes} />
        <button className={styles['secondary-button']} onClick={exportMarkdown}><Download size={15} />{t('export')}</button>
        <button className={styles['secondary-button']} onClick={async () => { const result = await shareContent(article.title); if (result === 'copied') notify(t('copied')); else if (result !== 'shared' && result !== 'cancelled') notify(result) }}><Share2 size={15} />{t('share')}</button>
        {isOwner && <Link href={`/articles/${id}/edit`} className={styles['secondary-button']}><Pencil size={15} />{t('edit')}</Link>}
        {canDelete && <DeleteButton name={article.title} onDelete={remove} />}
      </div>
    </VoyageReader>}
  </div></div>
}

type ArticleDraft = {
  title: string; content: string; category: string; tags: string; preview: boolean
  mediaAssetIds: string[]; files: File[]; assets: UploadedAsset[]
}
// This tab's memory only: do not persist unpublished text or local Files.
const articleDrafts = new Map<string, ArticleDraft>()

function Editor({ article, draftKey }: { article?: Entry; draftKey: string }) {
  const { t, notify } = useBlog()
  const router = useRouter()
  const { mutate } = useSWRConfig()
  // RequireLogin mounts the editor only after the client session is known;
  // its server/hydration loading state never reads a user's in-memory draft.
  const [initialDraft] = useState(() => articleDrafts.get(draftKey))
  const [title, setTitle] = useState(initialDraft?.title ?? article?.title ?? '')
  const [content, setContent] = useState(initialDraft?.content ?? article?.content ?? '')
  const [category, setCategory] = useState(initialDraft?.category ?? article?.category ?? '')
  const [tags, setTags] = useState(initialDraft?.tags ?? article?.tags?.join(', ') ?? '')
  const [preview, setPreview] = useState(initialDraft?.preview ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mediaAssetIds, setMediaAssetIds] = useState(initialDraft?.mediaAssetIds ?? article?.mediaAssets ?? [])
  const uploads = useManagedUploads('article', 1)
  const { setFiles, restoreAssets } = uploads
  const restoredAssets = uploads.items.flatMap(item => !item.file && item.asset ? [item.asset] : [])
  const restoredOnce = useRef(false)
  const queueReady = useRef(!initialDraft?.files.length && !initialDraft?.assets.length)
  const discarded = useRef(false)
  const editor = useRef<HTMLTextAreaElement>(null)
  const selection = useRef({ start: content.length, end: content.length })
  const restoreCursor = useRef<number | null>(null)
  useEffect(() => {
    if (restoredOnce.current) return
    restoredOnce.current = true
    if (!initialDraft) return
    setFiles(initialDraft.files)
    restoreAssets(initialDraft.assets)
  }, [initialDraft, setFiles, restoreAssets])
  useEffect(() => {
    // Do not overwrite a restored queue with the hook's initial empty state.
    if (!queueReady.current && !uploads.items.length) return
    queueReady.current = true
    if (discarded.current) return
    articleDrafts.set(draftKey, {
      title, content, category, tags, preview, mediaAssetIds,
      files: uploads.items.flatMap(item => item.file && !item.asset ? [item.file] : []),
      assets: uploads.assets,
    })
  }, [draftKey, title, content, category, tags, preview, mediaAssetIds, uploads.items, uploads.assets])
  useEffect(() => {
    if (!busy && !uploads.isUploading) return
    const keepActiveEditor = (event: MouseEvent) => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return
      const url = new URL(link.href)
      if (url.origin === location.origin && url.pathname === '/theme') {
        event.preventDefault()
        event.stopPropagation()
        notify(t(uploads.isUploading ? 'uploadingFile' : 'saving'))
      }
    }
    document.addEventListener('click', keepActiveEditor, true)
    return () => document.removeEventListener('click', keepActiveEditor, true)
  }, [busy, uploads.isUploading, notify, t])
  function clearDraft(savedArticle = article) {
    discarded.current = true
    articleDrafts.delete(draftKey)
    // Also reset a page retained by the router after cancel/publish.
    setTitle(savedArticle?.title ?? '')
    setContent(savedArticle?.content ?? '')
    setCategory(savedArticle?.category ?? '')
    setTags(savedArticle?.tags?.join(', ') ?? '')
    setMediaAssetIds(savedArticle?.mediaAssets ?? [])
    setPreview(false)
    uploads.reset()
    selection.current = { start: savedArticle?.content.length ?? 0, end: savedArticle?.content.length ?? 0 }
    restoreCursor.current = null
  }
  function resumeDraft() { discarded.current = false }
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
      const result = await send<Envelope<Entry>>(article ? `knowledge/${article._id}` : 'knowledge', { title: title.trim(), content, category, tags: tags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean), mediaAssetIds }, article ? 'PUT' : 'POST')
      clearDraft(article ? result.data : undefined)
      await mutate(`/api/blog/knowledge/${result.data._id}`, result, { revalidate: false })
      await mutate(key => typeof key === 'string' && (
        key.startsWith('/api/blog/knowledge?')
        || key.startsWith('/api/blog/archive/feed?')
        || key === '/api/blog/archive/sitemap'
        || key === '/api/blog/knowledge/meta/categories'
      ))
      notify(t('saved')); router.push(`/articles/${result.data._id}`)
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  async function upload() {
    if (!uploads.items.length) return
    const filename = uploads.files[0]?.name || uploads.assets[0]?.filename || ''
    const range = selection.current
    setBusy(true); setError('')
    try {
      const assets = await uploads.uploadAll()
      if (discarded.current) return
      const asset = assets.at(-1)
      if (!asset) throw new Error(t('uploadFailed'))
      const markdown = `![${filename.replace(/[\[\]]/g, '')}](${asset.url})`
      let cursor = range.start + markdown.length
      setContent(value => {
        const start = Math.min(range.start, value.length)
        const end = Math.max(start, Math.min(range.end, value.length))
        cursor = start + markdown.length
        return `${value.slice(0, start)}${markdown}${value.slice(end)}`
      })
      selection.current = { start: cursor, end: cursor }
      restoreCursor.current = cursor
      setMediaAssetIds(value => [...new Set([...value, asset.id])])
      uploads.reset()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <form className={styles['form']} onSubmit={submit} onChangeCapture={resumeDraft} onClickCapture={resumeDraft} onDropCapture={resumeDraft}>
    <label className={styles['field']}>{t('title')}<input required value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></label>
    <div className={styles['form-row']}>
      <label className={styles['field']}>{t('category')}<input value={category} onChange={e => setCategory(e.target.value)} /></label>
      <label className={styles['field']}>{t('tags')}<input value={tags} onChange={e => setTags(e.target.value)} /></label>
    </div>
    <div className={styles['form-actions']}>
      <button type="button" className={styles['secondary-button']} aria-pressed={preview} onClick={() => setPreview(!preview)}>{t(preview ? 'edit' : 'preview')}</button>
      <FilePicker files={uploads.files} setFiles={uploads.setFiles} uploadItems={uploads.items} onRetry={key => { void uploads.retry(key).catch(uploadError => setError((uploadError as Error).message)) }} onRemove={uploads.remove} max={1 - restoredAssets.length} imageOnly label={t('insertMedia')} onBeforeSelect={() => { if (editor.current?.isConnected) rememberSelection(editor.current) }} />
      {!!uploads.items.length && <button type="button" className={styles['secondary-button']} disabled={busy || uploads.isUploading} onClick={upload}>{t('insertMedia')}</button>}
    </div>
    {!!restoredAssets.length && <ul className={styles['upload-files']}>{restoredAssets.map(asset => <li key={asset.id} data-status="done">
      <div className={styles['upload-file-summary']}><span title={asset.filename}>{asset.filename}</span><small>{t('uploadDone')}</small>
        <button type="button" className={styles['icon-button']} aria-label={`${t('removeFile')} ${asset.filename}`} onClick={() => uploads.remove(`asset:${asset.id}`)}><X size={14} /></button>
      </div>
    </li>)}</ul>}
    {preview ? <><Markdown content={content} /><LocalMediaGrid files={uploads.files} /></> : <label className={styles['field']}>{t('content')} / Markdown<AutoTextarea required minRows={14} disabled={busy} className={styles['editor-textarea']} value={content} onChange={e => { setContent(e.target.value); rememberSelection(e.currentTarget) }} onSelect={e => rememberSelection(e.currentTarget)} onBlur={e => rememberSelection(e.currentTarget)} /></label>}
    {error && <p role="alert" className={styles['error']}>{error}</p>}
    <div className={styles['form-actions']}>
      <button className={styles['primary-button']} disabled={busy || uploads.isUploading || !title.trim() || !content.trim()}>{t(busy ? 'saving' : article ? 'save' : 'publish')}</button>
      <Link href={article ? `/articles/${article._id}` : '/articles'} className={styles['secondary-button']} onNavigate={() => clearDraft()}>{t('cancel')}</Link>
    </div>
  </form>
}
export function ArticleEditor({ id }: { id?: string }) {
  const { session } = useBlog()
  const draftKey = JSON.stringify([session?.uid, id || 'new'])
  const data = useBlogData<Envelope<Entry>>(id ? `knowledge/${id}` : null, { revalidateOnFocus: false, revalidateIfStale: false })
  const canEdit = !id || (data.data?.data.uid === session?.uid)
  return <div className={styles['page']}><PageHeading title={id ? 'edit' : 'newArticle'} english="Compose" number="01" /><RequireLogin>{id ? <><State loading={data.isLoading} error={data.error} retry={() => data.mutate()} />{data.data && (canEdit ? <Editor key={draftKey} draftKey={draftKey} article={data.data.data} /> : <p className={styles['error']}>403</p>)}</> : <Editor key={draftKey} draftKey={draftKey} />}</RequireLogin></div>
}
