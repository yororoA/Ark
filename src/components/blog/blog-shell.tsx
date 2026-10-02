'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowUp, ArrowUpRight, Menu, X } from 'lucide-react'
import BlogProvider, { request, useBlog } from './blog-provider'
import { Locale, sections } from '@/lib/blog'
import { legacyDestination } from '@/lib/legacy-route'
import { BlogSelect } from './controls'
import ArchiveLogo from '@/components/brand/archive-logo'
import ThemePicker from '@/components/appearance/theme-picker'
import styles from './blog.module.scss'

function Shell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale, session, refreshSession, toast, notify } = useBlog()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const hash = location.hash.slice(1)
    if (!/^\/(?:town|account)(?:\/|\?|$)/.test(hash)) return
    const old = new URL(hash, location.origin)
    const destination = legacyDestination(old.pathname, old.searchParams)
    if (destination) router.replace(destination)
  }, [pathname, router])
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  async function logout() {
    try { await request('/api/session', { method: 'DELETE' }); refreshSession() } catch (error) { notify((error as Error).message) }
  }
  return (
    <div className={styles['blog-root']} data-blog-root>
      <a href="#main-content" className={styles['skip-link']}>{t('read')}</a>
      <header className={styles['site-header']}>
        <Link href="/home" className={styles['brand']} aria-label="YororoIce Ark">
          <ArchiveLogo priority />
        </Link>
        <nav className={styles['desktop-nav']} aria-label={t('menu')}>
          {sections.map(([key]) => <Link href={`/${key}`} key={key} aria-current={pathname.startsWith(`/${key}`) ? 'page' : undefined}>{t(key)}</Link>)}
        </nav>
        <div className={styles['header-tools']}>
          <Link className={styles['chat-link']} href="/chat">{t('chat')}<ArrowUpRight size={14} /></Link>
          <BlogSelect label={t('language')} value={locale} onChange={value => setLocale(value as Locale)} hideLabel compact displayValue={{ zh: '中', en: 'EN', ja: '日', de: 'DE' }[locale]} options={[
            { value: 'zh', label: '简体中文' }, { value: 'en', label: 'English' },
            { value: 'ja', label: '日本語' }, { value: 'de', label: 'Deutsch' },
          ]} />
          <ThemePicker locale={locale} />
          <button className={`${styles['icon-button']} ${styles['menu-button']}`} aria-label={open ? t('close') : t('menu')} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>
      {open && <nav className={styles['mobile-nav']} aria-label={t('menu')}>{sections.map(([key, number]) => <Link href={`/${key}`} key={key} onClick={() => setOpen(false)} aria-current={pathname.startsWith(`/${key}`) ? 'page' : undefined}><span>{number}</span>{t(key)}<ArrowUpRight size={18} /></Link>)}<Link href="/chat" onClick={() => setOpen(false)} aria-current={pathname.startsWith('/chat') ? 'page' : undefined}><span>07</span>{t('chat')}<ArrowUpRight size={18} /></Link></nav>}
      <main id="main-content" className={styles['main-content']}>{children}</main>
      <footer className={styles['site-footer']}>
        <div className={styles['footer-signatures']}>
          <Image src="/logo_white.png" width={172} height={79} alt="YororoIce" />
          <i aria-hidden="true" />
          <Image src="/sign_white.png" width={130} height={40} alt="山眠包" />
        </div>
        <div className={styles['footer-links']}><Link href="/terms">{t('terms')}</Link><Link href="/notice">{t('notice')}</Link><a href="https://github.com/yororoA" target="_blank" rel="noreferrer">GitHub ↗</a><Link href="/about#guestbook">{t('guestbook')}</Link></div>
        <div className={styles['account-links']}>{session ? <><span>{session.username}</span><Link href="/login">{t('account')}</Link><button onClick={logout}>{t('logout')}</button></> : <Link href="/login">{t('login')} ↗</Link>}<small>© {new Date().getFullYear()} YOROROICE</small></div>
        <button className={styles['icon-button']} aria-label={t('toTop')} onClick={() => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><ArrowUp size={20} /></button>
      </footer>
      {toast && <div className={styles['toast']} role="status">{toast}<button onClick={() => notify('')} aria-label={t('close')}><X size={16} /></button></div>}
    </div>
  )
}
export default function BlogShell({ children }: { children: React.ReactNode }) {
  return <BlogProvider><Shell>{children}</Shell></BlogProvider>
}
