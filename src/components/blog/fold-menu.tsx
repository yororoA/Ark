'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, X } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import ArchiveLogo from '@/components/brand/archive-logo'
import { isFoldTransitionCovering } from '@/components/appearance/fold-transition'
import { sections, translate, type Locale } from '@/lib/blog'
import styles from './fold-menu.module.scss'

function subscribeLocation(listener: () => void) {
  window.addEventListener('hashchange', listener)
  window.addEventListener('popstate', listener)
  return () => {
    window.removeEventListener('hashchange', listener)
    window.removeEventListener('popstate', listener)
  }
}
const readLocation = () => `${window.location.pathname}${window.location.search}${window.location.hash}`

const destinations = [...sections, ['chat', '07', 'Chat']] as const
const COPY = {
  zh: { invitation: '穿过这一页。', note: '文字、片刻，以及尚未抵达的地方。', theme: '切换风景' },
  en: { invitation: 'Through the page.', note: 'Words, moments, and places still to come.', theme: 'Change the view' },
  ja: { invitation: 'このページの向こうへ。', note: '言葉、ひととき、まだ見ぬ場所。', theme: '景色を変える' },
  de: { invitation: 'Hinter dieser Seite.', note: 'Worte, Augenblicke und neue Orte.', theme: 'Ansicht wechseln' },
}

export default function FoldMenu({ locale, close }: { locale: Locale; close: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const animationRef = useRef<Animation | null>(null)
  const closing = useRef(false)
  const closeRef = useRef(close)
  useEffect(() => { closeRef.current = close }, [close])
  const pathname = usePathname()
  const returnTo = useSyncExternalStore(subscribeLocation, readLocation, () => pathname)
  const current = destinations.findIndex(([key]) => pathname.startsWith(`/${key}`))
  const [hovered, setHovered] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const selected = hovered ?? focused ?? Math.max(current, 0)
  const copy = COPY[locale]

  useEffect(() => {
    const dialog = dialogRef.current!
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    const initial = dialog.querySelector<HTMLElement>('nav [aria-current="page"]') ?? dialog.querySelector<HTMLElement>('nav a')
    initial?.focus({ preventScroll: true })
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    if (!motion.matches && dialog.animate) animationRef.current = dialog.animate([
      { clipPath: 'polygon(72% 0,72% 0,28% 100%,28% 100%)' },
      { clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)' },
    ], { duration: 480, easing: 'cubic-bezier(.22,.75,.25,1)' })
    const skip = () => {
      if (!motion.matches) return
      animationRef.current?.cancel()
      if (closing.current) closeRef.current()
    }
    motion.addEventListener('change', skip)
    return () => {
      motion.removeEventListener('change', skip)
      animationRef.current?.cancel()
      dialog.close()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  function dismiss() {
    if (closing.current) return
    const dialog = dialogRef.current
    if (!dialog || isFoldTransitionCovering() || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || !dialog.animate) { close(); return }
    closing.current = true
    const clip = getComputedStyle(dialog).clipPath
    animationRef.current?.cancel()
    dialog.inert = true
    animationRef.current = dialog.animate([
      { clipPath: clip === 'none' ? 'polygon(0 0,100% 0,100% 100%,0 100%)' : clip },
      { clipPath: 'polygon(72% 0,72% 0,28% 100%,28% 100%)' },
    ], { duration: 330, easing: 'cubic-bezier(.55,0,.75,.4)', fill: 'forwards' })
    animationRef.current.finished.then(close, () => {})
  }

  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0)
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  function navigateWithKeys(event: KeyboardEvent<HTMLElement>) {
    const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>('a')]
    const index = links.indexOf(document.activeElement as HTMLAnchorElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % links.length : event.key === 'ArrowUp' ? (index - 1 + links.length) % links.length : event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : null
    if (next === null) return
    event.preventDefault()
    setHovered(null)
    links[next].focus()
  }

  return <dialog ref={dialogRef} className={styles.dialog} aria-label={translate(locale, 'contents')} data-testid="fold-menu"
    onKeyDown={containTab} onCancel={event => { event.preventDefault(); dismiss() }} onClose={() => { if (!dialogRef.current?.open) close() }}>
    <header className={styles.top}>
      <Link href="/home" aria-label="YororoIce Ark" onNavigate={dismiss}><ArchiveLogo /></Link>
      <span className={styles.edition}>FOLD / INDEX</span>
      <button type="button" onClick={dismiss} aria-label={translate(locale, 'close')}><span>{translate(locale, 'close')}</span><X size={22} /></button>
    </header>
    <div className={styles.body}>
      <div className={styles.exhibit} aria-hidden="true" style={{ '--fold-step': selected } as CSSProperties}>
        <span className={styles['exhibit-overline']}>THE PLACES BETWEEN PAGES / 06</span>
        <span className={styles['index-word']}>INDEX</span>
        <div className={styles['plane-back']} /><div className={styles['plane-front']} /><div className={styles['plane-cut']} />
        <div className={styles['selection-window']}><span key={selected} className={styles.number}>{destinations[selected][1]}</span></div>
        <div className={styles['exhibit-label']}><span key={selected}>{destinations[selected][2]}</span><ArrowUpRight size={26} /></div>
        <span className={styles['exhibit-caption']}>ENTER<br />ANOTHER<br />CHAPTER.</span>
      </div>
      <div className={styles.directory}>
        <div className={styles.heading}><span>{translate(locale, 'contents')}</span><span>{copy.invitation}</span></div>
        <nav onKeyDown={navigateWithKeys} aria-label={translate(locale, 'contents')}>
          {destinations.map(([key, number, english], index) => <Link href={`/${key}`} key={key} onNavigate={dismiss}
            aria-current={pathname.startsWith(`/${key}`) ? 'page' : undefined} data-selected={selected === index}
            onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}
            onFocus={() => { setFocused(index); setHovered(null) }} onBlur={() => setFocused(null)}
            style={{ '--order': Math.floor(index / 2) } as CSSProperties}>
            <small>{number}</small><span className={styles['word-window']}><span>{translate(locale, key)}</span></span><em>{english}</em><ArrowUpRight size={22} />
          </Link>)}
        </nav>
      </div>
    </div>
    <footer className={styles.bottom}><span>{copy.note}</span><Link href={`/theme?returnTo=${encodeURIComponent(returnTo)}`} onNavigate={dismiss}>{copy.theme}<ArrowUpRight size={16} /></Link><Link href="/login" onNavigate={dismiss}>{translate(locale, 'login')}<ArrowUpRight size={16} /></Link></footer>
  </dialog>
}
