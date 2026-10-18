'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowDown, ArrowUpRight, X } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import PrismScene from '@/components/appearance/prism-scene'
import PrismStars from '@/components/appearance/prism-stars'
import PrismRecord from './prism-record'
import { useAppearance } from '@/components/appearance/appearance-store'
import { isP3RWipeCovering } from '@/components/appearance/p3r-transition'
import { PRISM_COPY, SPECTRUM } from '@/lib/prism-copy'
import { sections, translate, dateLabel, articlePreview, excerpt, type Entry, type Locale } from '@/lib/blog'
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

const destinations = [...sections, ['chat', '07', 'Chat']] as const
const closedAperture = 'polygon(0 48%, 0 48%, 0 52%, 0 52%)'
const openAperture = 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
// Ellipse endpoints shared by the ray drawing and the actual navigation links.
const stations = [[18, 23], [40, 11], [66, 14], [84, 36], [81, 69], [59, 87], [32, 84], [13, 57]]

export function PrismMenu({ locale, close }: { locale: Locale; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const animation = useRef<Animation | null>(null)
  const closing = useRef(false)
  const [active, setActive] = useState(-1)
  const closeRef = useRef(close)
  useEffect(() => { closeRef.current = close }, [close])
  const pathname = usePathname()
  const current = destinations.findIndex(([key]) => pathname.startsWith(`/${key}`))
  const selected = active < 0 ? Math.max(0, current) : active
  useEffect(() => {
    const dialog = ref.current!
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    dialog.showModal()
    dialog.querySelector<HTMLAnchorElement>('[aria-current="page"]')?.focus({ preventScroll: true })
    document.body.style.overflow = 'hidden'
    if (!motion.matches && dialog.animate) animation.current = dialog.animate([
      { clipPath: closedAperture }, { clipPath: openAperture },
    ], { duration: 460, easing: 'cubic-bezier(.65,0,.35,1)' })
    const skip = () => {
      if (!motion.matches) return
      animation.current?.cancel()
      if (closing.current) closeRef.current()
    }
    motion.addEventListener('change', skip)
    return () => {
      animation.current?.cancel()
      motion.removeEventListener('change', skip)
      dialog.close()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  function dismiss() {
    if (closing.current) return
    const dialog = ref.current!
    const immediate = isP3RWipeCovering() || matchMedia('(prefers-reduced-motion: reduce)').matches || !dialog.animate || document.hidden
    if (immediate) { close(); return }
    closing.current = true
    const clip = getComputedStyle(dialog).clipPath
    animation.current?.cancel()
    dialog.inert = true
    animation.current = dialog.animate([
      { clipPath: clip === 'none' ? openAperture : clip }, { clipPath: closedAperture },
    ], { duration: 300, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' })
    animation.current.finished.then(close, () => {})
  }
  function navigateWithKeys(event: KeyboardEvent<HTMLElement>) {
    const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>('a')]
    const index = links.indexOf(document.activeElement as HTMLAnchorElement)
    const target = event.key === 'ArrowDown' ? (index + 1) % links.length : event.key === 'ArrowUp' ? (index - 1 + links.length) % links.length : event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : null
    if (target === null) return
    event.preventDefault()
    links[target].focus()
  }
  return <dialog ref={ref} className={styles['menu-dialog']} aria-label={PRISM_COPY[locale].menu} data-testid="prism-menu"
    onCancel={event => { event.preventDefault(); dismiss() }} onClose={() => { if (!ref.current?.open) close() }}>
    <PrismStars local />
    <div className={styles['menu-top']}><Link href="/home" onNavigate={dismiss}>YOROROICE / ARK</Link><button type="button" aria-label={translate(locale, 'close')} onClick={dismiss}><span>ESC</span><X size={24} /></button></div>
    <div className={styles['menu-body']}>
      <svg className={styles['menu-rays']} viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
        <ellipse cx="500" cy="325" rx="158" ry="158" fill="none" stroke="currentColor" strokeWidth=".6" />
        <ellipse cx="500" cy="325" rx="173" ry="173" fill="none" stroke="currentColor" strokeDasharray="1 6" />
        {Array.from({ length: 48 }, (_, index) => {
          const angle = index / 48 * Math.PI * 2, inner = index % 4 === 0 ? 180 : 186
          return <line key={index} x1={500 + Math.cos(angle) * inner} y1={325 + Math.sin(angle) * inner} x2={500 + Math.cos(angle) * 192} y2={325 + Math.sin(angle) * 192} stroke="currentColor" strokeWidth=".7" />
        })}
        {stations.map(([x, y], index) => <path key={index} d={`M500 325L${x * 10} ${y * 6.5}`} stroke={SPECTRUM[index % 6]} data-lit={selected === index} style={{ '--order': index } as CSSProperties} />)}
      </svg>
      <div className={styles['menu-core']} aria-hidden="true" style={{ '--selected-color': SPECTRUM[selected % 6] } as CSSProperties}><small>THE DARK SIDE</small><svg viewBox="0 0 160 145" fill="none"><path d="M80 8L7 134H153Z" stroke="currentColor" /><path d="M0 84L40 76L117 72L160 60M40 76L123 82L160 90" stroke="currentColor" opacity=".4" /></svg><span key={selected}>{translate(locale, destinations[selected][0])}</span><small>{destinations[selected][1]} / {destinations[selected][2].toUpperCase()}</small></div>
      <nav onKeyDown={navigateWithKeys} aria-label={PRISM_COPY[locale].menu} className={styles['track-list']}>
        {destinations.map(([key, number, english], index) => <Link key={key} href={`/${key}`} onNavigate={dismiss}
          aria-current={pathname.startsWith(`/${key}`) ? 'page' : undefined}
          data-selected={selected === index}
          onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(-1)} onFocus={() => setActive(index)} onBlur={() => setActive(-1)}
          style={{ '--track': SPECTRUM[index % SPECTRUM.length], '--order': index, '--station-x': `${stations[index][0]}%`, '--station-y': `${stations[index][1]}%` } as CSSProperties}>
          <small>{number}</small><span>{translate(locale, key)}<em>{english}</em></span><ArrowUpRight size={18} />
        </Link>)}
      </nav>
    </div>
    <div className={styles['menu-bottom']}><span>WORDS / MOMENTS / ECHOES</span><Link href="/login" onNavigate={dismiss}>{translate(locale, 'login')}<ArrowUpRight size={16} /></Link></div>
  </dialog>
}
