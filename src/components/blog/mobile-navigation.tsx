'use client'

import { useEffect, useRef, type KeyboardEvent } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from '@/components/appearance/p3r-link'
import { sections } from '@/lib/blog'
import { useBlog } from './blog-provider'
import styles from './blog.module.scss'

const destinations = [...sections, ['chat', '07', 'Chat']] as const

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

export default function MobileNavigation({ close }: { close: () => void }) {
  const { t, locale } = useBlog()
  const pathname = usePathname()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    // Safari does not focus tapped buttons. Remember the actual header toggle
    // for focus restoration; the full-screen menu owns its own close control.
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : dialog?.closest('[data-blog-root]')?.querySelector<HTMLElement>('[data-menu-toggle]')
    const overflow = document.body.style.overflow
    const desktop = matchMedia('(min-width: 1101px)')
    dialog?.showModal()
    dialog?.querySelector<HTMLAnchorElement>('[aria-current="page"]')?.focus({ preventScroll: true })
    document.body.style.overflow = 'hidden'
    const resize = () => { if (desktop.matches) close() }
    desktop.addEventListener('change', resize)
    return () => {
      desktop.removeEventListener('change', resize)
      dialog?.close()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [close])
  const verticalTitle = locale === 'zh' || locale === 'ja'
  return <dialog ref={ref} className={styles['mobile-menu-dialog']} aria-label={t('contents')} data-vertical-title={verticalTitle ? 'true' : undefined}
    onCancel={event => { event.preventDefault(); close() }}
    onClose={() => { if (!ref.current?.open) close() }}>
    {/* The header-position overlay from 65fc116 is replaced by a standalone
        composition, matching the full-screen ownership of P3R and Dark Side. */}
    <div className={styles['mobile-menu-top']}>
      <Link href="/home" onNavigate={close}>YOROROICE / ARK</Link>
      <button type="button" className={styles['mobile-menu-close']} onClick={close} aria-label={t('close')}><span>{t('close')}</span><X size={22} /></button>
    </div>
    <div className={styles['mobile-menu-body']}>
      <div className={styles['mobile-menu-identity']}><span>YOROROICE / PERSONAL INDEX</span><h2>{t('contents')}</h2><p>{t('intro')}</p></div>
      <nav className={styles['mobile-nav']} aria-label={t('contents')} onKeyDown={navigateWithKeys}>
        {destinations.map(([key, number, english]) => <Link href={`/${key}`} key={key} onNavigate={close} aria-current={pathname.startsWith(`/${key}`) ? 'page' : undefined}>
          <span className={styles['mobile-nav-number']}>{number}</span>
          <span className={styles['mobile-nav-label']}><strong>{t(key)}</strong><small>{english}</small></span>
          <ArrowUpRight size={20} />
        </Link>)}
      </nav>
    </div>
    <div className={styles['mobile-menu-bottom']}><span>00—07 / YOROROICE</span><Link href="/login" onNavigate={close}>{t('login')}<ArrowUpRight size={18} /></Link></div>
  </dialog>
}
