'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import PrismScene from '@/components/appearance/prism-scene'
import PrismRecord from './prism-record'
import { useAppearance } from '@/components/appearance/appearance-store'
import { PRISM_COPY, SPECTRUM } from '@/lib/prism-copy'
import { translate, dateLabel, articlePreview, excerpt, type Entry, type Locale } from '@/lib/blog'
import styles from './prism-navigation.module.scss'

export function PrismHome({ locale, featured, status, articles, moments, dates, articleState, momentState, activity }: {
  locale: Locale; featured?: Entry; status: 'online' | 'offline' | 'unknown'
  articles: Entry[]; moments: Entry[]; dates: string[]; articleState: ReactNode; momentState: ReactNode; activity: ReactNode
}) {
  const copy = PRISM_COPY[locale]
  const ref = useRef<HTMLDivElement>(null)
  const { design } = useAppearance()
  useEffect(() => {
    const root = ref.current
    if (!root || design !== 'prism' || !('IntersectionObserver' in window)) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    if (media.matches) return
    const nodes = [...root.querySelectorAll<HTMLElement>('[data-record-reveal]')]
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        ;(entry.target as HTMLElement).dataset.recordReveal = 'visible'
        observer.unobserve(entry.target)
      }
    }, { threshold: .1 })
    for (const node of nodes) {
      if (node.getBoundingClientRect().top >= innerHeight) node.dataset.recordReveal = 'waiting'
      observer.observe(node)
    }
    const reset = () => nodes.forEach(node => { node.dataset.recordReveal = 'visible' })
    media.addEventListener('change', reset)
    return () => { observer.disconnect(); reset(); media.removeEventListener('change', reset) }
  }, [design, articles, moments])
  return <div ref={ref} className={styles['prism-home']} data-testid="prism-home">
    <section className={styles['home-stage']}>
      <div className={styles['sleeve-top']}><span>THE DARK SIDE<br /><span>OF THE EVERYDAY.</span></span><small>YOROROICE<br />{copy.side}</small></div>
      <div className={styles['optical-stage']}><PrismScene /></div>
      <div className={styles['home-copy']}>
        <div><p className={styles.kicker}>A COLLECTION IN LIGHT</p><h1>{copy.name}<span>by YororoIce</span></h1></div>
        <div className={styles['home-note']}><p>{copy.headline}</p><Link href={featured ? `/articles/${featured._id}` : '/articles'} className={styles['enter-link']}>{translate(locale, 'read')}<ArrowUpRight size={18} /></Link></div>
      </div>
      <div className={styles['sleeve-bottom']}>
        <span className={styles.status}><i data-online={status === 'online'} />BINES / {translate(locale, status)}</span>
        <span className={styles['record-note']}>WORDS &nbsp; · &nbsp; MOMENTS &nbsp; · &nbsp; ECHOES</span>
        <a href="#prism-records" className={styles['scroll-link']}><span>{translate(locale, 'latest')}</span><ArrowDown size={14} /></a>
      </div>
    </section>
    <section id="prism-records" className={styles['record-collection']}>
      <header className={styles['collection-heading']}><span>A <i /></span><h2>{translate(locale, 'articles')}<small>THE WRITTEN SIDE</small></h2><Link href="/articles">{translate(locale, 'all')}<ArrowUpRight size={16} /></Link></header>
      {articleState}
      <div className={styles['sleeve-grid']}>{articles.slice(0, 4).map((entry, index) => {
        const preview = articlePreview(entry.content)
        return <Link href={`/articles/${entry._id}`} key={entry._id} className={styles['record-sleeve']} data-record-reveal="visible" style={{ '--record-color': SPECTRUM[index % 6] } as CSSProperties}>
          <PrismRecord title={entry.title} category={entry.category} coverUrl={preview.coverUrl} coverAlt={preview.coverAlt} id={entry._id} date={entry.createdAt} />
          <div className={styles['sleeve-details']}><time>{dateLabel(entry.createdAt, locale)}</time><h3>{entry.title}</h3><p>{excerpt(preview.content, 95)}</p><ArrowUpRight size={20} /></div>
        </Link>
      })}</div>
    </section>
    <section className={styles['moment-collection']}>
      <header className={styles['collection-heading']}><span>B <i /></span><h2>{translate(locale, 'moments')}<small>THE PASSING SIDE</small></h2><Link href="/moments">{translate(locale, 'all')}<ArrowUpRight size={16} /></Link></header>
      {momentState}
      <div className={styles['moment-tracks']}>{moments.slice(0, 4).map((entry, index) => <Link key={entry._id} href={`/moments/${entry._id}`} data-record-reveal="visible" style={{ '--record-color': SPECTRUM[(index + 2) % 6] } as CSSProperties}>
        <span className={styles['track-time']}>{entry.createdAt.slice(5, 10).replace('-', '.')}</span><i /><h3>{entry.title}</h3><span className={styles['track-year']}>{entry.createdAt.slice(0, 4)}</span><ArrowUpRight size={17} />
      </Link>)}</div>
      <div className={styles['activity-strip']}><span>{translate(locale, 'calendar')}</span><div>{dates.slice(-24).map(date => <Link href={`/moments?date=${date}`} key={date} title={date} aria-label={`${translate(locale, 'date')} ${date}`}><i /></Link>)}</div><Link href="/archive">{translate(locale, 'archive')}<ArrowUpRight size={15} /></Link></div>
    </section>
    <section className={styles['closing-note']}><div><p>{copy.collection}</p><small>{copy.note}</small></div><div className={styles['activity-details']}>{activity}</div><span className={styles['closing-spectrum']} aria-hidden="true" /></section>
  </div>
}

export { PrismMenu } from './prism-menu'
