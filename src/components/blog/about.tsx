'use client'

import { useState } from 'react'
import { ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { BlogLink, Comment, dateLabel, Envelope, PROFILE, safeUrl } from '@/lib/blog'
import { send, useBlog, useBlogData } from './blog-provider'
import { Markdown, Modal, PageHeading, Pagination, State, styles } from './shared'

const categories = ['friend', 'tool', 'development', 'other'] as const
type AboutInfo = Partial<typeof PROFILE> & { bio?: string; twitter?: string; website?: string }

function LinkEditor({ entry, close, refresh }: { entry: Partial<BlogLink>; close: () => void; refresh: () => Promise<unknown> }) {
  const { t, notify } = useBlog()
  const [value, setValue] = useState({ name: entry.name || '', url: entry.url || '', description: entry.description || '', imgurl: entry.imgurl || '', category: entry.category || 'friend' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await send(entry._id ? `admin/links/${entry._id}` : 'admin/links', value, entry._id ? 'PUT' : 'POST')
      await refresh(); notify(t('saved')); close()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <Modal title={t(entry._id ? 'edit' : 'newLink')} close={() => { if (!busy) close() }}><form className={styles['form']} onSubmit={submit}>
    <label className={styles['field']}>{t('title')}<input required maxLength={100} value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} /></label>
    <label className={styles['field']}>{t('url')}<input required type="url" pattern="https?://.*" value={value.url} onChange={e => setValue({ ...value, url: e.target.value })} /></label>
    <label className={styles['field']}>{t('description')}<textarea rows={3} maxLength={1000} value={value.description} onChange={e => setValue({ ...value, description: e.target.value })} /></label>
    <label className={styles['field']}>{t('image')} URL<input type="url" pattern="https?://.*" value={value.imgurl} onChange={e => setValue({ ...value, imgurl: e.target.value })} /></label>
    <label className={styles['field']}>{t('category')}<select value={value.category} onChange={e => setValue({ ...value, category: e.target.value })}>{categories.map(category => <option key={category} value={category}>{t(category)}</option>)}</select></label>
    {error && <p className={styles['error']} role="alert">{error}</p>}
    <div><button className={styles['primary-button']} disabled={busy}>{t(busy ? 'saving' : 'save')}</button></div>
  </form></Modal>
}

function Links() {
  const { t, session, notify } = useBlog()
  const [category, setCategory] = useState('all')
  const [editing, setEditing] = useState<Partial<BlogLink> | null>(null)
  const [deleting, setDeleting] = useState('')
  const { data, error, isLoading, mutate } = useBlogData<Envelope<BlogLink[]>>('links')
  const links = (data?.data || []).filter(link => category === 'all' || link.category === category)
  async function remove(link: BlogLink) {
    if (!confirm(t('confirmDelete'))) return
    setDeleting(link._id)
    try { await send(`admin/links/${link._id}`, {}, 'DELETE'); await mutate() }
    catch (error) { notify((error as Error).message) } finally { setDeleting('') }
  }
  return <section><div className={styles['section-heading']}><div><div className={styles['eyebrow']}>CONNECTIONS</div><h2>{t('links')}</h2></div>{session?.isAdmin && <button className={styles['secondary-button']} onClick={() => setEditing({})}><Plus size={16} />{t('newLink')}</button>}</div>
    <div className={styles['filters']}>{(['all', ...categories] as const).map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{t(value)}</button>)}</div>
    <State loading={isLoading} error={error} empty={!!data && !links.length} retry={() => mutate()} />
    <div className={styles['link-grid']}>{links.map(link => <article className={styles['link-card']} key={link._id}><a href={safeUrl(link.url)} target="_blank" rel="noreferrer"><h3>{link.name}<ArrowUpRight size={20} /></h3><p>{link.description}</p></a>{session?.isAdmin && <div className={styles['form-actions']}><button className={styles['icon-button']} onClick={() => setEditing(link)} aria-label={`${t('edit')} ${link.name}`}><Pencil size={15} /></button><button className={styles['icon-button']} disabled={!!deleting} onClick={() => remove(link)} aria-label={`${t('delete')} ${link.name}`}><Trash2 size={15} /></button></div>}</article>)}</div>
    {editing && <LinkEditor entry={editing} close={() => setEditing(null)} refresh={mutate} />}
  </section>
}

function Guestbook() {
  const { t, session, locale, notify } = useBlog()
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const { data, error, isLoading, mutate } = useBlogData<Envelope<Comment[]>>('guestbook')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !content.trim()) return
    setBusy(true); setSubmitError('')
    try {
      await send('guestbook', { content: content.trim(), username: name.trim() || session?.username || 'Guest' })
      setContent(''); setPage(1); await mutate(); notify(t('saved'))
    } catch (error) { setSubmitError((error as Error).message) } finally { setBusy(false) }
  }
  return <section className={styles['guestbook']} id="guestbook"><div><div className={styles['section-heading']}><div><div className={styles['eyebrow']}>LEAVE AN ECHO</div><h2>{t('guestbook')}</h2></div></div>
    <form className={styles['form']} onSubmit={submit}><p className={styles['form-note']}>{t('guestbookHint')}</p><label className={styles['field']}>{t('nickname')}<input maxLength={50} placeholder={session?.username || 'Guest'} value={name} onChange={e => setName(e.target.value)} /></label><label className={styles['field']}>{t('content')}<textarea required rows={5} maxLength={5000} value={content} onChange={e => setContent(e.target.value)} /></label>{submitError && <p role="alert" className={styles['error']}>{submitError}</p>}<div><button className={styles['primary-button']} disabled={busy || !content.trim()}>{t(busy ? 'sending' : 'send')}<ArrowUpRight size={16} /></button></div></form>
    </div><div><State loading={isLoading} error={error} empty={data?.data.length === 0} retry={() => mutate()} />{data?.data.slice((page - 1) * 8, page * 8).map(entry => <article key={entry._id} className={styles['comment']}><div className={styles['entry-meta']}><strong>{entry.username}</strong><time>{dateLabel(entry.createdAt, locale)}</time></div><p>{entry.content}</p></article>)}<Pagination page={page} pages={Math.ceil((data?.data.length || 0) / 8)} change={setPage} /></div>
  </section>
}

export default function About() {
  const { t } = useBlog()
  const { data } = useBlogData<Envelope<AboutInfo>>('about')
  const info = data?.data
  const author = info?.author && info.author !== '博主' ? info.author : PROFILE.author
  const skills = info?.skills?.length ? info.skills : PROFILE.skills
  const interests = info?.interests?.length ? info.interests : PROFILE.interests
  const socials = [
    ['GitHub', info?.github || PROFILE.github], ['Bilibili', PROFILE.bilibili],
    ['X', info?.twitter || PROFILE.x], ['Email', `mailto:${info?.email || PROFILE.email}`],
  ]
  return <div className={styles['page']}><PageHeading title="about" english="Behind the words" number="05" />
    <section className={styles['about-intro']}><div><h2>{author}</h2><p>{PROFILE.description}</p><div className={styles['form-actions']}>{socials.map(([name, url]) => <a key={name} className={styles['text-link']} href={safeUrl(url)} target="_blank" rel="noreferrer">{name}<ArrowUpRight size={14} /></a>)}</div></div><div><div className={styles['eyebrow']}>{t('intro')}</div>{info?.bio && <Markdown content={info.bio} />}<div className={styles['tags']}>{skills.map(skill => <span key={skill}>{skill}</span>)}</div><div className={styles['tags']}>{interests.map(interest => <span key={interest}>{interest}</span>)}</div></div></section>
    <Links /><Guestbook />
  </div>
}
