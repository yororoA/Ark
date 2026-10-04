'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUpRight, X } from 'lucide-react'
import { sections, translate, type Entry, type Locale } from '@/lib/blog'
import { P3R_COPY } from '@/lib/p3r-copy'
import P3RScene from '@/components/appearance/p3r-scene'
import styles from './p3r-navigation.module.scss'

const destinations = [...sections, ['chat', '07', 'Chat']] as const

const readDate = () => new Date().toISOString().slice(0, 10)
const serverDate = () => ''
function subscribeDate(listener: () => void) {
  const timer = window.setInterval(listener, 60000)
  return () => clearInterval(timer)
}

function navigateWithKeys(event: KeyboardEvent<HTMLElement>) {
  const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a[href]'))
  const current = links.indexOf(document.activeElement as HTMLAnchorElement)
  const next = event.key === 'ArrowDown' ? (current + 1) % links.length
    : event.key === 'ArrowUp' ? (current - 1 + links.length) % links.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : null
  if (next === null) return
  event.preventDefault()
  links[next]?.focus()
}

export function P3RDate({ locale }: { locale: Locale }) {
  // A static page can be served on a later date than its build. Hydrate the
  // stable placeholder before reading the visitor's current UTC date.
  const date = useSyncExternalStore(subscribeDate, readDate, serverDate)
  return <time className={styles.date} dateTime={date || undefined}>
    <span>{P3R_COPY[locale].today}<small>UTC</small></span>
    <strong>{date.slice(5, 7) || '--'}<i>/</i>{date.slice(8) || '--'}</strong>
  </time>
}

function DestinationList({ locale, close, home = false }: { locale: Locale; close?: () => void; home?: boolean }) {
  const pathname = usePathname()
  const items = home ? destinations.filter(([key]) => key !== 'home') : destinations
  return <nav className={styles['destination-list']} aria-label={P3R_COPY[locale].menu} onKeyDown={navigateWithKeys}>
    {items.map(([key, number, english], index) => <Link
      key={key} href={`/${key}`} onNavigate={close}
      aria-current={pathname.startsWith(`/${key}`) ? 'page' : undefined}
      style={{ '--item': index } as CSSProperties}
    >
      <span className={styles['destination-number']} aria-hidden="true">{number}</span>
      <span className={styles['destination-name']}>{english}</span>
      <span className={styles['destination-label']}>{translate(locale, key)}</span>
      <ArrowUpRight size={22} />
    </Link>)}
  </nav>
}

export function P3RHome({ locale, featured, status }: { locale: Locale; featured?: Entry; status: 'online' | 'offline' | 'unknown' }) {
  const copy = P3R_COPY[locale]
  return <section className={styles['home-stage']}>
    <P3RScene />
    <div className={styles['stage-top']}><span>YOROROICE / PERSONAL ARCHIVE</span><P3RDate locale={locale} /></div>
    <div className={styles['home-identity']}>
      <span className={styles['identity-kicker']}>YOUR DAYS. YOUR STORY.</span>
      <h1>YORORO<span>ICE. ARK</span></h1>
      <h2>{copy.headline}</h2>
      <p>{translate(locale, 'introBody')}</p>
      <Link href={featured ? `/articles/${featured._id}` : '/articles'} className={styles['continue-link']}>
        <span>{translate(locale, featured ? 'latest' : 'read')}</span>
        <strong>{featured?.title || copy.enter}</strong><ArrowUpRight size={23} />
      </Link>
    </div>
    <div className={styles['home-menu']}><p>{copy.menu}</p><DestinationList locale={locale} home /></div>
    <div className={styles['stage-bottom']}><span><i data-online={status === 'online'} />BINES / {translate(locale, status)}</span><a href="#recent">{translate(locale, 'latest')}<ArrowDown size={16} /></a></div>
  </section>
}

export function P3RMenu({ locale, close }: { locale: Locale; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement
    const previous = document.body.style.overflow
    dialog?.showModal()
    dialog?.querySelector<HTMLAnchorElement>('[aria-current="page"]')?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previous
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  return <dialog ref={ref} className={styles['menu-dialog']} aria-label={P3R_COPY[locale].menu} onCancel={event => { event.preventDefault(); close() }}>
    <P3RScene variant="menu" />
    <div className={styles['menu-top']}><Link href="/home" onNavigate={close}>YOROROICE / ARK</Link><button type="button" onClick={close} aria-label={translate(locale, 'close')}><span>ESC</span><X size={24} /></button></div>
    <div className={styles['menu-body']}>
      <div className={styles['menu-identity']}><P3RDate locale={locale} /><span className={styles['menu-word']} aria-hidden="true">MENU</span><p>{P3R_COPY[locale].note}</p></div>
      <DestinationList locale={locale} close={close} />
    </div>
    <div className={styles['menu-bottom']}><Link href="/login" onNavigate={close}>{translate(locale, 'login')}<ArrowUpRight size={18} /></Link><span>YOROROICE / P3R</span></div>
  </dialog>
}
