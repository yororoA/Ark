'use client'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, X } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import ArchiveLogo from '@/components/brand/archive-logo'
import { sections, translate, type Locale } from '@/lib/blog'
import styles from './offset-menu.module.scss'

const destinations = [...sections, ['chat', '07', 'Chat']] as const
const COPY = {
  zh: { title: '生活，不必对齐。', note: '把日常，排成自己的版。', theme: '更换主题', selected: '下一版', contents: '目录 / INDEX' },
  en: { title: 'Life, slightly out of register.', note: 'An edition of the everyday.', theme: 'Change theme', selected: 'NEXT EDITION', contents: 'CONTENTS / INDEX' },
  ja: { title: '日々は、少しずれている。', note: '日常を、自分だけの版に。', theme: 'テーマを変える', selected: '次の版へ', contents: '目次 / INDEX' },
  de: { title: 'Das Leben braucht keinen Gleichsatz.', note: 'Der Alltag in deiner eigenen Ausgabe.', theme: 'Thema wechseln', selected: 'NÄCHSTE AUSGABE', contents: 'INHALT / INDEX' },
}

function subscribeLocation(listener: () => void) {
  window.addEventListener('hashchange', listener)
  window.addEventListener('popstate', listener)
  return () => { window.removeEventListener('hashchange', listener); window.removeEventListener('popstate', listener) }
}
const locationSnapshot = () => location.pathname + location.search + location.hash
const openingEase = 'cubic-bezier(.16,.86,.22,1)'

export default function OffsetMenu({ locale, close }: { locale: Locale; close: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const animations = useRef<Animation[]>([])
  const closing = useRef(false)
  const disposed = useRef(false)
  const closeRef = useRef(close)
  useEffect(() => { closeRef.current = close }, [close])
  const pathname = usePathname()
  const returnTo = useSyncExternalStore(subscribeLocation, locationSnapshot, () => pathname)
  const current = destinations.findIndex(([key]) => pathname.startsWith(`/${key}`))
  const [pointed, setPointed] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const selected = pointed ?? focused ?? Math.max(0, current)
  const copy = COPY[locale]

  useLayoutEffect(() => {
    const dialog = dialogRef.current!
    disposed.current = false
    closing.current = false
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement : dialog.closest('[data-blog-root]')?.querySelector<HTMLElement>('[data-menu-toggle]')
    const overflow = document.body.style.overflow
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    dialog.showModal()
    document.body.style.overflow = 'hidden'

    if (!motion.matches && !document.hidden) {
      const remember = (element: Element, frames: Keyframe[], duration: number, delay = 0) => {
        animations.current.push(element.animate(frames, { duration, delay, easing: openingEase, fill: 'both' }))
      }
      dialog.querySelectorAll<HTMLElement>('[data-offset-panel]').forEach((panel, index) => {
        remember(panel, [{ transform: `translateX(${index % 2 ? -103 : 103}%)` }, { transform: 'translateX(0%)' }], 680, index * 42)
      })
      dialog.querySelectorAll<HTMLElement>('[data-offset-word]').forEach((word, index) => {
        remember(word, [{ transform: 'translateY(115%)' }, { transform: 'translateY(0%)' }], 620, 160 + index * 42)
      })
      dialog.querySelectorAll<HTMLElement>('[data-offset-surface]').forEach((surface, index) => {
        remember(surface, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], 740, 130 + index * 65)
      })
    }

    const initial = dialog.querySelector<HTMLElement>('nav [aria-current="page"]') ?? dialog.querySelector<HTMLElement>('nav a')
    initial?.focus({ preventScroll: true })
    // A short viewport must reveal the initially focused item inside the dialog.
    if (initial) {
      const bounds = initial.getBoundingClientRect()
      if (bounds.bottom > innerHeight - 24) dialog.scrollTop += bounds.bottom - innerHeight + 24
    }
    const simplify = () => {
      if (!motion.matches && !document.hidden) return
      animations.current.forEach(animation => animation.cancel())
      animations.current = []
      if (closing.current) closeRef.current()
    }
    const historyNavigation = () => { closing.current = true; closeRef.current() }
    motion.addEventListener('change', simplify)
    document.addEventListener('visibilitychange', simplify)
    window.addEventListener('popstate', historyNavigation)
    return () => {
      disposed.current = true
      motion.removeEventListener('change', simplify)
      document.removeEventListener('visibilitychange', simplify)
      window.removeEventListener('popstate', historyNavigation)
      animations.current.forEach(animation => animation.cancel())
      animations.current = []
      dialog.close()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  useLayoutEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>(`[data-destination="${selected}"]`)
    if (!nav || !active) return
    const measure = () => {
      nav.style.setProperty('--register-y', `${active.offsetTop + active.offsetHeight / 2 - 10}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    observer.observe(active)
    return () => observer.disconnect()
  }, [selected])

  function navigate() {
    // The shared wipe calls this only once its plates cover the complete menu.
    closing.current = true
    closeRef.current()
  }

  function dismiss() {
    if (closing.current) return
    closing.current = true
    const dialog = dialogRef.current
    if (!dialog || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) { closeRef.current(); return }
    const panels = [...dialog.querySelectorAll<HTMLElement>('[data-offset-panel]')]
    const words = [...dialog.querySelectorAll<HTMLElement>('[data-offset-word]')]
    const surfaces = [...dialog.querySelectorAll<HTMLElement>('[data-offset-surface]')]
    // Read the in-flight values before cancelling opening animations, so a fast
    // close reverses from what was actually on screen rather than snapping open.
    const panelStarts = panels.map(panel => getComputedStyle(panel).transform)
    const wordStarts = words.map(word => getComputedStyle(word).transform)
    const surfaceStarts = surfaces.map(surface => getComputedStyle(surface).clipPath)
    animations.current.forEach(animation => animation.cancel())
    animations.current = []
    dialog.dataset.phase = 'closing'
    dialog.inert = true
    panels.forEach((panel, index) => animations.current.push(panel.animate([
      { transform: panelStarts[index] }, { transform: `translateX(${index % 2 ? -103 : 103}%)` },
    ], { duration: 440, delay: (4 - index) * 27, easing: 'cubic-bezier(.64,0,.83,.22)', fill: 'both' })))
    words.forEach((word, index) => animations.current.push(word.animate([
      { transform: wordStarts[index] }, { transform: 'translateY(115%)' },
    ], { duration: 220, delay: (words.length - index - 1) * 12, easing: 'cubic-bezier(.64,0,.83,.22)', fill: 'both' })))
    surfaces.forEach((surface, index) => animations.current.push(surface.animate([
      { clipPath: surfaceStarts[index] === 'none' ? 'inset(0 0% 0 0)' : surfaceStarts[index] }, { clipPath: 'inset(0 100% 0 0)' },
    ], { duration: 300, easing: 'cubic-bezier(.64,0,.83,.22)', fill: 'both' })))
    dialog.querySelectorAll<HTMLElement>('[data-offset-control]').forEach(control => animations.current.push(control.animate([
      { transform: 'scaleX(1)' }, { transform: 'scaleX(0)' },
    ], { duration: 180, fill: 'both' })))
    void Promise.allSettled(animations.current.map(animation => animation.finished)).then(() => {
      if (!disposed.current) closeRef.current()
    })
  }

  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (closing.current) { event.preventDefault(); return }
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),[tabindex="0"]')]
      .filter(control => control.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  function arrows(event: KeyboardEvent<HTMLElement>) {
    const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>('a[href]')]
    const index = links.indexOf(document.activeElement as HTMLAnchorElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % links.length : event.key === 'ArrowUp' ? (index - 1 + links.length) % links.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : null
    if (next === null) return
    event.preventDefault()
    setPointed(null)
    links[next]?.focus()
  }

  return <dialog ref={dialogRef} className={styles.dialog} lang={locale} aria-label={translate(locale, 'contents')} data-testid="offset-menu"
    onKeyDown={containTab} onCancel={event => { event.preventDefault(); dismiss() }}
    onClose={() => { if (!disposed.current && !dialogRef.current?.open) closeRef.current() }}>
    <div className={styles.panels} aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} data-offset-panel />)}</div>
    <div className={styles.interior}>
      <header className={styles.top}>
        <Link href="/home" onNavigate={navigate} aria-label="YororoIce Ark" data-offset-surface><ArchiveLogo /></Link>
        <span data-offset-surface>ARK / OFFSET — INDEX № 08</span>
        <button type="button" onClick={dismiss} aria-label={translate(locale, 'close')} data-offset-control><span>{translate(locale, 'close')}</span><X size={23} strokeWidth={1.5} /></button>
      </header>
      <div className={styles.body}>
        <aside className={styles.exhibit} data-offset-surface aria-hidden="true" style={{ '--selected-step': selected } as CSSProperties}>
          <div className={styles.plateTop}><span>OUT OF REGISTER</span><span>00—07</span></div>
          <div className={styles.indexWord}>OFF<br /><span>SET.</span></div>
          <div className={styles.typePlates}><span>INDEX</span><i /><i /><i /></div>
          <div className={styles.readout}><span>{copy.selected}</span><div><strong key={selected}>{destinations[selected][1]}</strong><ArrowUpRight size={45} strokeWidth={1} /></div><p>{translate(locale, destinations[selected][0])}</p></div>
          <div className={styles.cross} /><span className={styles.plateFoot}>YOUR EVERYDAY. YOUR EDITION.</span>
        </aside>
        <div className={styles.contents}>
          <div className={styles.heading} data-offset-surface><h2>{copy.contents}</h2><span>{copy.title}</span></div>
          <nav ref={navRef} className={styles.directory} aria-label={translate(locale, 'contents')} onKeyDown={arrows} data-offset-surface>
            <span className={styles.registerBar} aria-hidden="true"><i /><i /></span>
            {destinations.map(([key, number, english], index) => <Link key={key} href={`/${key}`} onNavigate={navigate}
              aria-current={current === index ? 'page' : undefined} data-destination={index} data-selected={selected === index}
              onMouseEnter={() => setPointed(index)} onMouseLeave={() => setPointed(null)}
              onFocus={() => { setFocused(index); setPointed(null) }} onBlur={() => setFocused(null)}>
              <span className={styles.number}><span>{number}</span></span>
              <span className={styles.wordMask}><span data-offset-word><strong>{translate(locale, key)}</strong><small>{english}</small></span></span>
              <span className={styles.offsetSlot} aria-hidden="true" />
              <ArrowUpRight className={styles.arrow} size={24} strokeWidth={1.4} />
            </Link>)}
          </nav>
        </div>
      </div>
      <footer className={styles.bottom} data-offset-surface><p>{copy.note}</p><Link href={`/theme?returnTo=${encodeURIComponent(returnTo)}`} onNavigate={navigate}>{copy.theme}<ArrowUpRight size={17} /></Link><Link href="/login" onNavigate={navigate}>{translate(locale, 'login')}<ArrowUpRight size={17} /></Link></footer>
    </div>
  </dialog>
}
