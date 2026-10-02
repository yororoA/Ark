'use client'
/* eslint-disable @next/next/no-img-element -- Article covers are stored as arbitrary external Markdown URLs. */

import Link from 'next/link'
import { useRef } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Plus } from 'lucide-react'
import { articlePreview, dateLabel, Entry, Envelope, excerpt, PROFILE } from '@/lib/blog'
import { useBlog, useBlogData } from './blog-provider'
import { State, styles } from './shared'

function OrbitalArtwork() {
  return <svg className={styles['orbital-art']} viewBox="0 0 900 820" fill="none" aria-hidden="true">
    <defs>
      <pattern id="ark-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><path d="M0 0V7" stroke="currentColor" strokeWidth=".6" opacity=".25" /></pattern>
      <linearGradient id="ark-fade"><stop stopColor="currentColor" stopOpacity=".01" /><stop offset="1" stopColor="currentColor" stopOpacity=".23" /></linearGradient>
    </defs>
    <path d="M535 42C272 42 112 245 112 435S278 786 544 786" stroke="currentColor" strokeWidth=".6" />
    <path d="M548 81C332 81 159 242 159 435S339 746 548 746" stroke="currentColor" strokeWidth="1.4" />
    <path d="M569 121C375 121 199 266 199 443S378 704 569 704" stroke="currentColor" strokeWidth=".5" />
    <path d="M520 157C326 179 200 321 227 494S425 733 612 651" stroke="currentColor" strokeWidth="33" opacity=".08" />
    <g className={styles['art-orbit']}>
      <ellipse cx="450" cy="410" rx="370" ry="285" transform="rotate(-49 450 410)" stroke="currentColor" strokeWidth=".7" />
      <circle cx="450" cy="410" r="318" stroke="currentColor" strokeWidth=".5" strokeDasharray="2 8" />
      <path d="M150 511L751 309M240 118L660 702" stroke="currentColor" strokeWidth=".6" opacity=".5" />
      <circle cx="185" cy="233" r="6" fill="currentColor" /><circle cx="663" cy="646" r="3" fill="currentColor" />
    </g>
    <path d="M286 659V395C286 275 342 190 450 145C556 194 612 277 612 395V659" stroke="currentColor" strokeWidth="1.1" />
    <path d="M316 659V399C316 298 357 227 450 178C543 227 583 298 583 399V659" stroke="currentColor" strokeWidth=".5" />
    <path d="M335 658V401C335 305 387 253 450 213C510 253 564 310 564 401V658Z" fill="url(#ark-hatch)" />
    <path d="M325 644L578 267L650 310L398 686Z" fill="url(#ark-fade)" />
    <path d="M400 93L624 744M278 587H700M218 613H732M490 70V780" stroke="currentColor" strokeWidth=".5" opacity=".55" />
    <path d="M678 194L683 213L702 218L683 223L678 242L673 223L654 218L673 213Z" fill="currentColor" />
    <path d="M329 695L333 707L345 711L333 715L329 727L325 715L313 711L325 707Z" fill="currentColor" />
    <path d="M430 420h40m-20-20v40" stroke="currentColor" strokeWidth=".7" />
    <circle cx="450" cy="410" r="193" stroke="currentColor" strokeWidth=".5" />
    <path d="M687 385V617H704V404" fill="currentColor" opacity=".8" />
    <path d="M743 391V520" stroke="currentColor" strokeWidth="2" />
    <text x="736" y="554" fill="currentColor" fontSize="9" letterSpacing="4" transform="rotate(90 736 554)">A PERSONAL CHRONICLE</text>
    <text x="300" y="760" fill="currentColor" fontSize="9" letterSpacing="3">YOROROICE / ARK</text>
  </svg>
}

export default function Home() {
  const { t, locale } = useBlog()
  const art = useRef<HTMLDivElement>(null)
  const articles = useBlogData<Envelope<Entry[]>>('knowledge?limit=4')
  const moments = useBlogData<Envelope<Entry[]>>('moments/get?isEditing=false')
  const status = useBlogData<Envelope<{ online: boolean }>>('status/bines', { refreshInterval: 60000 })
  const github = useBlogData<Envelope<{ reposCount: number; monthCommits: number; languages: { name: string; percent: number }[] }>>('github/summary')
  const featured = articles.data?.data[0]
  const featuredPreview = featured ? articlePreview(featured.content) : null
  const recent = articles.data?.data.slice(1, 4) || []
  const isOnline = status.data?.data.online
  const statusLabel = isOnline === undefined ? 'unknown' : isOnline ? 'online' : 'offline'
  const dates = new Set(moments.data?.data.map(entry => entry.createdAt.slice(0, 10)))
  const calendarStart = new Date()
  calendarStart.setUTCDate(calendarStart.getUTCDate() - 83)
  return <>
    <section className={styles['hero']} onPointerMove={event => {
      if (event.pointerType !== 'mouse' || !art.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const rect = event.currentTarget.getBoundingClientRect()
      art.current.style.setProperty('--art-x', `${((event.clientX - rect.left) / rect.width - .5) * 18}px`)
      art.current.style.setProperty('--art-y', `${((event.clientY - rect.top) / rect.height - .5) * 12}px`)
    }}>
      <div className={styles['hero-top']}><span>THE PERSONAL ARCHIVE OF YOROROICE</span><Plus size={13} /><span>A COLLECTION IN PROGRESS</span></div>
      <div className={styles['hero-art']}><div className={styles['art-plane']} ref={art}><OrbitalArtwork />{featured && <Link href={`/articles/${featured._id}`} prefetch={false} className={styles['track-record']}><span>01 / LATEST RECORD</span><strong>{featured.title}</strong><small>{featured.category} · {dateLabel(featured.createdAt, locale)}</small><ArrowUpRight size={17} strokeWidth={1} /></Link>}<span className={styles['art-label']}>MEMORIES / THOUGHTS / CREATIONS</span></div></div>
      <div className={styles['hero-content']}>
        <div className={styles['eyebrow']}>00 / A CONTINUING STORY</div>
        <h1>Yororo<span>Ice. Ark</span></h1>
        <h2>{t('intro')}</h2>
        <p>{t('introBody')}</p>
        <div className={styles['hero-actions']}><Link href="/articles" className={styles['primary-button']}>{t('read')}<ArrowUpRight size={18} /></Link><Link href="/moments" className={styles['text-link']}>{t('explore')}<ArrowRight size={17} /></Link></div>
      </div>
      <div className={styles['hero-bottom']}>
        <span className={styles['status']} data-online={isOnline}>
          <i />BINES · {t(statusLabel)}
        </span>
        {/* The former Latin ornament looked like an advertising label. */}
        <a className={styles['scroll-link']} href="#recent">
          {t('latest')}<ArrowDown size={12} />
        </a>
      </div>
    </section>
    <section id="recent" className={styles['home-section']}>
      <div className={styles['section-heading']}><div><div className={styles['eyebrow']}>01 / RECENT WRITINGS</div><h2>{t('latest')}</h2></div><Link href="/articles" className={styles['text-link']}>{t('all')}<ArrowUpRight size={18} /></Link></div>
      <State loading={articles.isLoading} error={articles.error} empty={articles.data?.data.length === 0} retry={() => articles.mutate()} />
      {featured && featuredPreview && <div className={styles['recent-grid']}><Link href={`/articles/${featured._id}`} prefetch={false} className={styles['featured-entry']} data-cover={!!featuredPreview.coverUrl}>{featuredPreview.coverUrl && <figure className={styles['featured-cover']}><img src={featuredPreview.coverUrl} alt={featuredPreview.coverAlt || featured.title} /><span>FEATURED / 01</span></figure>}<div className={styles['featured-body']}><div className={styles['entry-meta']}><span>{featured.category}</span><time>{dateLabel(featured.createdAt, locale)}</time>{!featuredPreview.coverUrl && <span>FEATURED / 01</span>}</div><h3>{featured.title}</h3><p>{excerpt(featuredPreview.content, 155)}</p><ArrowUpRight size={30} strokeWidth={1} /></div></Link><div className={styles['entry-list']}>{recent.map((entry, index) => <Link href={`/articles/${entry._id}`} prefetch={false} className={styles['entry-row']} key={entry._id}><span>0{index + 2}</span><div><div className={styles['entry-meta']}><time>{dateLabel(entry.createdAt, locale)}</time><span>{entry.category}</span></div><h3>{entry.title}</h3></div><ArrowUpRight size={19} strokeWidth={1} /></Link>)}</div></div>}
    </section>
    <section className={styles['manifesto']}><div><div className={styles['eyebrow']}>IN WORDS, WE REMAIN.</div><blockquote>Time mends the wounds,<br />love soothes the scars.</blockquote><a href={PROFILE.github} className={styles['text-link']} target="_blank" rel="noreferrer" style={{ marginTop: 25 }}>YOROROICE / GITHUB<ArrowUpRight size={15} /></a></div><div><div className={styles['eyebrow']}>{t('activity')}</div>{github.data ? <><div className={styles['activity']}><div><strong>{github.data.data.reposCount}</strong><small>{t('repositories')}</small></div><div><strong>{github.data.data.monthCommits}</strong><small>{t('commits')}</small></div></div><div className={styles['tags']}>{github.data.data.languages.slice(0, 4).map(language => <span key={language.name}>{language.name} · {Math.round(language.percent)}%</span>)}</div></> : <State loading={github.isLoading} error={github.error} retry={() => github.mutate()} />}</div></section>
    <section className={styles['home-section']}><div className={styles['section-heading']}><div><div className={styles['eyebrow']}>02 / FRAGMENTS OF LIFE</div><h2>{t('moments')}</h2></div><Link href="/moments" className={styles['text-link']}>{t('all')}<ArrowUpRight size={18} /></Link></div><State loading={moments.isLoading} error={moments.error} retry={() => moments.mutate()} /><div className={styles['recent-grid']}><div className={styles['entry-list']}>{moments.data?.data.slice(0, 3).map((entry, index) => <Link href={`/moments/${entry._id}`} key={entry._id} className={styles['entry-row']}><span>0{index + 1}</span><div><div className={styles['entry-meta']}>{dateLabel(entry.createdAt, locale)}</div><h3>{entry.title}</h3></div><ArrowUpRight size={18} /></Link>)}</div><div><div className={styles['eyebrow']}>{t('calendar')} / 12 WEEKS</div><div className={styles['calendar']}>{Array.from({ length: 84 }, (_, index) => { const date = new Date(calendarStart); date.setUTCDate(date.getUTCDate() + index); const day = date.toISOString().slice(0, 10); return <Link key={day} href={`/moments?date=${day}`} data-active={dates.has(day)} title={day} aria-label={`${t('date')} ${day}`} /> })}</div><p className={styles['form-note']} style={{ marginTop: 20 }}>{t('introBody')}</p><Link href="/archive" className={styles['text-link']} style={{ marginTop: 30 }}>{t('archive')}<ArrowUpRight size={16} /></Link></div></div></section>
  </>
}
