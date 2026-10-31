'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, X } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import { isP3RWipeCovering } from '@/components/appearance/p3r-transition'
import { PrismOptics } from '@/components/appearance/prism-scene'
import { PRISM_COPY, SPECTRUM } from '@/lib/prism-copy'
import { sections, translate, type Locale } from '@/lib/blog'
import styles from './prism-menu.module.scss'

const destinations = [...sections, ['chat', '07', 'Chat']] as const
const closedAperture = 'polygon(0 48%, 0 48%, 0 52%, 0 52%)'
const openAperture = 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'

export function PrismMenu({ locale, close }: { locale: Locale; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const animation = useRef<Animation | null>(null)
  const closing = useRef(false)
  const closeRef = useRef(close)
  const [hovered, setHovered] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const pathname = usePathname()
  const current = destinations.findIndex(([key]) => pathname.startsWith(`/${key}`))
  const selected = hovered ?? focused ?? Math.max(0, current)
  const copy = PRISM_COPY[locale]

  useEffect(() => { closeRef.current = close }, [close])
  useEffect(() => {
    const dialog = ref.current!
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    dialog.showModal()
    const initial = dialog.querySelector<HTMLAnchorElement>('nav [aria-current="page"]') ?? dialog.querySelector<HTMLAnchorElement>('nav a')
    initial?.focus({ preventScroll: true })
    document.body.style.overflow = 'hidden'
    if (!motion.matches && dialog.animate) animation.current = dialog.animate([
      { clipPath: closedAperture }, { clipPath: openAperture },
    ], { duration: 380, easing: 'cubic-bezier(.65,0,.35,1)' })
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
    if (isP3RWipeCovering() || matchMedia('(prefers-reduced-motion: reduce)').matches || !dialog.animate || document.hidden) { close(); return }
    closing.current = true
    const clip = getComputedStyle(dialog).clipPath
    animation.current?.cancel()
    dialog.inert = true
    animation.current = dialog.animate([
      { clipPath: clip === 'none' ? openAperture : clip }, { clipPath: closedAperture },
    ], { duration: 260, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' })
    animation.current.finished.then(close, () => {})
  }

  function navigateWithKeys(event: KeyboardEvent<HTMLElement>) {
    const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>('a')]
    const index = links.indexOf(document.activeElement as HTMLAnchorElement)
    const target = event.key === 'ArrowDown' ? (index + 1) % links.length : event.key === 'ArrowUp' ? (index - 1 + links.length) % links.length : event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : null
    if (target === null) return
    event.preventDefault()
    setHovered(null)
    links[target].focus()
  }

  return <dialog ref={ref} className={styles['menu-dialog']} aria-label={copy.menu} data-testid="prism-menu"
    onCancel={event => { event.preventDefault(); dismiss() }} onClose={() => { if (!ref.current?.open) close() }}>
    <div className={styles['menu-top']}>
      <Link href="/home" onNavigate={dismiss}>YOROROICE / ARK</Link>
      <button type="button" aria-label={translate(locale, 'close')} onClick={dismiss}><span>ESC</span><X size={24} strokeWidth={1.4} /></button>
    </div>
    <div className={styles['menu-body']}>
      <div className={styles['menu-art']} aria-hidden="true">
        <div className={styles['art-heading']}><span>{copy.name}</span><p>{copy.headline}</p></div>
        <PrismOptics className={styles.optics} compact animated={false} selectedBand={selected} />
        <div className={styles['art-rule']} style={{ '--track': SPECTRUM[selected % SPECTRUM.length] } as CSSProperties} />
      </div>
      <nav className={styles['track-list']} onKeyDown={navigateWithKeys} aria-label={copy.menu}>
        {destinations.map(([key, number, english], index) => <Link key={key} href={`/${key}`} onNavigate={dismiss}
          aria-current={pathname.startsWith(`/${key}`) ? 'page' : undefined} data-selected={selected === index}
          onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}
          onFocus={() => { setFocused(index); setHovered(null) }} onBlur={() => setFocused(null)}
          style={{ '--track': SPECTRUM[index % SPECTRUM.length], '--order': index } as CSSProperties}>
          <small>{number}</small><span>{translate(locale, key)}</span><em aria-hidden="true">{english}</em><ArrowUpRight size={20} strokeWidth={1.3} />
        </Link>)}
      </nav>
    </div>
    <div className={styles['menu-bottom']}><span>{copy.headline}</span><Link href="/login" onNavigate={dismiss}>{translate(locale, 'login')}<ArrowUpRight size={17} /></Link></div>
  </dialog>
}
