'use client'
/* eslint-disable @next/next/no-img-element -- Link icons are arbitrary external URLs managed by the site owner. */

import { useEffect, useRef, useState } from 'react'
import { useSWRConfig } from 'swr'
import { ArrowUpRight, Pencil, Plus } from 'lucide-react'
import { BlogLink, Comment, dateLabel, Envelope, PROFILE, safeUrl } from '@/lib/blog'
import { request, send, useBlog, useBlogData } from './blog-provider'
import { DeleteButton, Markdown, Modal, PageHeading, Pagination, State, styles } from './shared'
import { BlogSelect } from './controls'
import { useAppearance } from '@/components/appearance/appearance-store'
import voyage from './voyage-about.module.scss'
import { voyageAboutCopy } from './voyage-about-copy'

const categories = ['friend', 'tool', 'development', 'other'] as const
type AboutInfo = Partial<typeof PROFILE> & { bio?: string; twitter?: string; website?: string }

function LinkImage({ url, className = styles['link-card-image'] }: { url?: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return null
  return <span className={className} aria-hidden="true"><img src={url} alt="" loading="lazy" onError={() => setFailed(true)} /></span>
}

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
    <BlogSelect label={t('category')} value={value.category} onChange={category => setValue({ ...value, category })} options={categories.map(category => ({ value: category, label: t(category) }))} />
    {error && <p className={styles['error']} role="alert">{error}</p>}
    <div><button className={styles['primary-button']} disabled={busy}>{t(busy ? 'saving' : 'save')}</button></div>
  </form></Modal>
}

function addressLabel(value: string) {
  const safe = safeUrl(value)
  if (!safe) return ''
  try {
    const url = new URL(safe)
    return url.protocol === 'mailto:' ? url.pathname : `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`
  } catch { return '' }
}

function SectionNumber({ number, children }: { number: string; children: React.ReactNode }) {
  return <div className={voyage.sectionNumber}><span aria-hidden="true">{number}</span><span>{children}</span></div>
}

function Links() {
  const { t, session, locale } = useBlog()
  const { design } = useAppearance()
  const copy = voyageAboutCopy[locale]
  const [category, setCategory] = useState('all')
  const [editing, setEditing] = useState<Partial<BlogLink> | null>(null)
  const { data, error, isLoading, mutate } = useBlogData<Envelope<BlogLink[]>>('links')
  const links = (data?.data || []).filter(link => category === 'all' || link.category === category)
  async function remove(link: BlogLink) {
    await send(`admin/links/${link._id}`, {}, 'DELETE')
    await mutate()
  }
  if (design === 'voyage') return <section className={voyage.connections} data-about-rule="" aria-labelledby="voyage-connections-title">
    <div className={voyage.connectionHeading}>
      <SectionNumber number="02">CONNECTIONS</SectionNumber><h2 id="voyage-connections-title" className={voyage.sectionTitle}>{t('links')}</h2>
      <div className={voyage.filters} role="group" aria-label={copy.filters}>{(['all', ...categories] as const).map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{t(value)}</button>)}</div>
      {session?.isAdmin && <button className={`${styles['secondary-button']} ${voyage.addLink}`} onClick={() => setEditing({})}><Plus size={16} />{t('newLink')}</button>}
    </div>
    <div className={voyage.addresses}>
      <State loading={isLoading} error={error} retry={() => mutate()} />
      {!isLoading && !error && data && !links.length && <div className={voyage.empty}><h3>{copy.noLinks}</h3><p>{copy.noLinksNote}</p></div>}
      {links.map((link, index) => {
        const safeImage = safeUrl(link.imgurl)
        const image = safeImage?.startsWith('http') ? safeImage : undefined
        const href = safeUrl(link.url)
        return <article key={link._id} className={voyage.address}>
          <a className={voyage.addressLink} href={href} target="_blank" rel="noreferrer">
            <span className={voyage.addressNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div className={voyage.addressCopy}><h3>{link.name}</h3>{link.description && <p>{link.description}</p>}<span className={voyage.addressUrl}>{addressLabel(link.url)}</span></div>
            <LinkImage key={image} url={image} className={voyage.addressImage} />
            {href && <ArrowUpRight className={voyage.addressArrow} size={24} aria-hidden="true" />}
          </a>
          {session?.isAdmin && <div className={voyage.addressActions}><button className={styles['icon-button']} onClick={() => setEditing(link)} aria-label={`${t('edit')} ${link.name}`}><Pencil size={15} /></button><DeleteButton name={link.name} iconOnly onDelete={() => remove(link)} /></div>}
        </article>
      })}
    </div>
    {editing && <LinkEditor entry={editing} close={() => setEditing(null)} refresh={mutate} />}
  </section>
  return <section><div className={styles['section-heading']}><div><div className={styles['eyebrow']}>CONNECTIONS</div><h2>{t('links')}</h2></div>{session?.isAdmin && <button className={styles['secondary-button']} onClick={() => setEditing({})}><Plus size={16} />{t('newLink')}</button>}</div>
    <div className={styles['filters']}>{(['all', ...categories] as const).map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{t(value)}</button>)}</div>
    <State loading={isLoading} error={error} empty={!!data && !links.length} retry={() => mutate()} />
    <div className={styles['link-grid']}>{links.map(link => {
      const safeImage = safeUrl(link.imgurl)
      const image = safeImage?.startsWith('http') ? safeImage : undefined
      return <article className={styles['link-card']} key={link._id}><a className={styles['link-card-link']} href={safeUrl(link.url)} target="_blank" rel="noreferrer"><LinkImage key={image} url={image} /><div className={styles['link-card-copy']}><h3>{link.name}<ArrowUpRight size={20} /></h3><p>{link.description}</p></div></a>{session?.isAdmin && <div className={styles['form-actions']}><button className={styles['icon-button']} onClick={() => setEditing(link)} aria-label={`${t('edit')} ${link.name}`}><Pencil size={15} /></button><DeleteButton name={link.name} iconOnly onDelete={() => remove(link)} /></div>}</article>
    })}</div>
    {editing && <LinkEditor entry={editing} close={() => setEditing(null)} refresh={mutate} />}
  </section>
}

function Guestbook() {
  const { t, session, locale, notify } = useBlog()
  const { design } = useAppearance()
  const copy = voyageAboutCopy[locale]
  const { mutate: refresh } = useSWRConfig()
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const { data, error, isLoading, mutate } = useBlogData<Envelope<Comment[]>>(`guestbook?page=${page}&limit=8`)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !content.trim()) return
    const submittedContent = content
    setBusy(true); setSubmitError('')
    try {
      await send('guestbook', { content: submittedContent.trim(), username: name.trim() || session?.username || 'Guest' })
      setContent(current => current === submittedContent ? '' : current)
      // Revalidate the destination page even when page 1 is already cached.
      if (page === 1) await mutate()
      else await refresh('/api/blog/guestbook?page=1&limit=8', await request<Envelope<Comment[]>>('guestbook?page=1&limit=8'), { revalidate: false })
      setPage(1)
      notify(t('saved'))
    } catch (error) { setSubmitError((error as Error).message) } finally { setBusy(false) }
  }
  if (design === 'voyage') return <section className={voyage.guestbook} id="guestbook" data-about-rule="" aria-labelledby="voyage-guestbook-title">
    <div className={voyage.guestHeading}><div><SectionNumber number="03">LEAVE AN ECHO</SectionNumber><h2 id="voyage-guestbook-title" className={voyage.sectionTitle}>{t('guestbook')}</h2></div><p>{t('guestbookHint')}</p></div>
    <div className={voyage.correspondence}>
      <form className={voyage.writingPaper} onSubmit={submit} aria-busy={busy}>
        <label className={voyage.nameField}><span>{t('nickname')}</span><input maxLength={50} placeholder={session?.username || 'Guest'} value={name} onChange={e => setName(e.target.value)} autoComplete="nickname" /></label>
        <label className={voyage.messageField}><span>{t('content')}</span><textarea required rows={5} maxLength={5000} value={content} onChange={e => setContent(e.target.value)} /></label>
        {submitError && <p role="alert" className={styles['error']}>{submitError}</p>}
        <div className={voyage.sendRow}><p>{copy.publicNote}</p><button className={voyage.sendButton} disabled={busy || !content.trim()}>{t(busy ? 'sending' : 'send')}<ArrowUpRight size={18} aria-hidden="true" /></button></div>
      </form>
      <div className={voyage.incoming}>
        <div className={voyage.incomingHeading}><h3>{copy.incoming}</h3><span aria-hidden="true">GUESTBOOK</span></div>
        <State loading={isLoading} error={error} retry={() => mutate()} />
        {!isLoading && !error && data?.data.length === 0 && <div className={voyage.empty}><h3>{copy.emptyTitle}</h3><p>{copy.emptyNote}</p></div>}
        {data?.data.map(entry => <article key={entry._id} className={voyage.letter}><div className={voyage.letterHeading}><strong>{entry.username}</strong><time dateTime={entry.createdAt}>{dateLabel(entry.createdAt, locale)}</time></div><p>{entry.content}</p></article>)}
        <Pagination page={page} pages={data?.pagination?.pages || 1} change={setPage} />
      </div>
    </div>
  </section>
  return <section className={styles['guestbook']} id="guestbook"><div><div className={styles['section-heading']}><div><div className={styles['eyebrow']}>LEAVE AN ECHO</div><h2>{t('guestbook')}</h2></div></div>
    <form className={styles['form']} onSubmit={submit}><p className={styles['form-note']}>{t('guestbookHint')}</p><label className={styles['field']}>{t('nickname')}<input maxLength={50} placeholder={session?.username || 'Guest'} value={name} onChange={e => setName(e.target.value)} /></label><label className={styles['field']}>{t('content')}<textarea required rows={5} maxLength={5000} value={content} onChange={e => setContent(e.target.value)} /></label>{submitError && <p role="alert" className={styles['error']}>{submitError}</p>}<div><button className={styles['primary-button']} disabled={busy || !content.trim()}>{t(busy ? 'sending' : 'send')}<ArrowUpRight size={16} /></button></div></form>
    </div><div><State loading={isLoading} error={error} empty={data?.data.length === 0} retry={() => mutate()} />{data?.data.map(entry => <article key={entry._id} className={styles['comment']}><div className={styles['entry-meta']}><strong>{entry.username}</strong><time dateTime={entry.createdAt}>{dateLabel(entry.createdAt, locale)}</time></div><p>{entry.content}</p></article>)}<Pagination page={page} pages={data?.pagination?.pages || 1} change={setPage} /></div>
  </section>
}

export default function About() {
  const { t, locale } = useBlog()
  const { design } = useAppearance()
  const page = useRef<HTMLDivElement>(null)
  const copy = voyageAboutCopy[locale]
  useEffect(() => {
    if (design !== 'voyage' || !page.current) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const rules = [...page.current.querySelectorAll<HTMLElement>('[data-about-rule]')]
    if (motion.matches || document.hidden) return
    const visible = new Set<HTMLElement>()
    let settled = false
    const begin = () => {
      const phase = document.documentElement.dataset.voyageWipe
      if (settled || (phase && phase !== 'idle')) return
      visible.forEach(rule => {
        if (rule.dataset.aboutRule !== 'waiting') return
        rule.dataset.aboutRule = 'visible'
        observer.unobserve(rule)
      })
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const rule = entry.target as HTMLElement
        if (entry.isIntersecting) visible.add(rule)
        else visible.delete(rule)
      })
      begin()
    }, { threshold: .08 })
    const transition = new MutationObserver(begin)
    transition.observe(document.documentElement, { attributes: true, attributeFilter: ['data-voyage-wipe'] })
    rules.forEach(rule => { rule.dataset.aboutRule = 'waiting'; observer.observe(rule) })
    const simplify = () => {
      if (!motion.matches && !document.hidden) return
      settled = true
      rules.forEach(rule => { rule.dataset.aboutRule = '' })
      observer.disconnect(); transition.disconnect()
    }
    motion.addEventListener('change', simplify)
    document.addEventListener('visibilitychange', simplify)
    return () => {
      observer.disconnect(); transition.disconnect()
      motion.removeEventListener('change', simplify)
      document.removeEventListener('visibilitychange', simplify)
    }
  }, [design])
  const { data } = useBlogData<Envelope<AboutInfo>>('about')
  const info = data?.data
  const author = info?.author && info.author !== '博主' ? info.author : PROFILE.author
  const skills = info?.skills?.length ? info.skills : PROFILE.skills
  const interests = info?.interests?.length ? info.interests : PROFILE.interests
  const socials = [
    ['GitHub', info?.github || PROFILE.github], ['Bilibili', PROFILE.bilibili],
    ['X', info?.twitter || PROFILE.x], ['Email', `mailto:${info?.email || PROFILE.email}`],
  ]
  if (design === 'voyage') return <div ref={page} className={`${styles['page']} ${voyage.page}`}><PageHeading title="about" english="Behind the words" number="05" />
    <section className={voyage.intro} aria-labelledby="voyage-author-title">
      <SectionNumber number="01">{copy.person}</SectionNumber>
      <div className={voyage.introGrid}><h2 id="voyage-author-title">{author}</h2><p className={voyage.quote}>{PROFILE.description}</p></div>
      {info?.bio && <div className={voyage.bio}><Markdown content={info.bio} /></div>}
      <nav className={voyage.channels} data-about-rule="" aria-label={copy.channels}>{socials.map(([name, url]) => <a key={name} className={voyage.channel} href={safeUrl(url)} target="_blank" rel="noreferrer"><strong>{name}</strong><small>{name === 'Email' ? copy.email : addressLabel(url)}</small><ArrowUpRight size={23} aria-hidden="true" /></a>)}</nav>
      <div className={voyage.details}><div><h3>{copy.tools}<span aria-hidden="true"> / TOOLS</span></h3><ul>{skills.map(skill => <li key={skill}>{skill}</li>)}</ul></div><div><h3>{copy.interests}<span aria-hidden="true"> / INTERESTS</span></h3><ul>{interests.map(interest => <li key={interest}>{interest}</li>)}</ul></div></div>
    </section>
    <Links /><Guestbook />
  </div>
  return <div className={styles['page']}><PageHeading title="about" english="Behind the words" number="05" />
    <section className={styles['about-intro']}><div><h2>{author}</h2><p>{PROFILE.description}</p><div className={styles['form-actions']}>{socials.map(([name, url]) => <a key={name} className={styles['text-link']} href={safeUrl(url)} target="_blank" rel="noreferrer">{name}<ArrowUpRight size={14} /></a>)}</div></div><div><div className={styles['eyebrow']}>{t('intro')}</div>{info?.bio && <Markdown content={info.bio} />}<div className={styles['tags']}>{skills.map(skill => <span key={skill}>{skill}</span>)}</div><div className={styles['tags']}>{interests.map(interest => <span key={interest}>{interest}</span>)}</div></div></section>
    <Links /><Guestbook />
  </div>
}
