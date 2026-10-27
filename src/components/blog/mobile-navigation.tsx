'use client'

import { useEffect, useRef } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from '@/components/appearance/p3r-link'
import { sections } from '@/lib/blog'
import { useBlog } from './blog-provider'
import styles from './blog.module.scss'

export default function MobileNavigation({ close }: { close: () => void }) {
  const { t } = useBlog()
  const pathname = usePathname()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    // Safari does not focus tapped buttons. Resolve the actual header toggle
    // before showModal makes it inert, and place its close control in the top layer.
    const opener = dialog?.closest('[data-blog-root]')?.querySelector<HTMLElement>('[data-menu-toggle]') ?? document.activeElement
    const overflow = document.body.style.overflow
    const desktop = matchMedia('(min-width: 1101px)')
    const positionClose = () => {
      if (!(opener instanceof HTMLElement) || !dialog) return
      const box = opener.getBoundingClientRect()
      dialog.style.setProperty('--menu-toggle-left', `${box.left}px`)
      dialog.style.setProperty('--menu-toggle-top', `${box.top}px`)
      dialog.style.setProperty('--menu-toggle-width', `${box.width}px`)
      dialog.style.setProperty('--menu-toggle-height', `${box.height}px`)
    }
    positionClose()
    dialog?.showModal()
    dialog?.querySelector<HTMLAnchorElement>('[aria-current="page"]')?.focus({ preventScroll: true })
    document.body.style.overflow = 'hidden'
    const resize = () => { if (desktop.matches) close(); else positionClose() }
    window.addEventListener('resize', resize)
    desktop.addEventListener('change', resize)
    return () => {
      window.removeEventListener('resize', resize)
      desktop.removeEventListener('change', resize)
      dialog?.close()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [close])
  return <dialog ref={ref} className={styles['mobile-menu-dialog']} aria-label={t('menu')}
    onCancel={event => { event.preventDefault(); close() }}
    onClose={() => { if (!ref.current?.open) close() }}>
    <button type="button" className={`${styles['icon-button']} ${styles['mobile-menu-close']}`} onClick={close} aria-label={t('close')}><X size={20} /></button>
    <nav className={styles['mobile-nav']} aria-label={t('menu')}>
      {/* The duplicate panel X previously competed with the inert header X. */}
      <div className={styles['mobile-menu-heading']}><span>{t('menu')}</span></div>
      {sections.map(([key, number]) => <Link href={`/${key}`} key={key} onNavigate={close} aria-current={pathname.startsWith(`/${key}`) ? 'page' : undefined}><span>{number}</span>{t(key)}<ArrowUpRight size={18} /></Link>)}
      <Link href="/chat" onNavigate={close} aria-current={pathname.startsWith('/chat') ? 'page' : undefined}><span>07</span>{t('chat')}<ArrowUpRight size={18} /></Link>
    </nav>
  </dialog>
}
