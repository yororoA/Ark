'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ArrowUp, ArrowUpRight, Menu, Moon, Sun, X } from 'lucide-react'
import BlogProvider, { request, useBlog } from './blog-provider'
import { Locale, sections } from '@/lib/blog'
import styles from './blog.module.scss'

function Shell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale, theme, setTheme, session, refreshSession, toast, notify } = useBlog()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  async function logout() {
    try { await request('/api/session', { method: 'DELETE' }); refreshSession() } catch (error) { notify((error as Error).message) }
  }
  return (
    <div className={styles['blog-root']} data-theme={theme}>
      <a href="#main-content" className={styles['skip-link']}>{t('read')}</a>
      <header className={styles['site-header']}>
        <Link href="/home" className={styles['brand']} aria-label="YororoIce Ark">
          <span className={styles['brand-symbol']} aria-hidden="true">A</span>
          <span>YOROROICE<small>PERSONAL ARCHIVE</small></span>
        </Link>
        <nav className={styles['desktop-nav']} aria-label={t('menu')}>
          {sections.map(([key]) => <Link href={`/${key}`} key={key} aria-current={pathname.startsWith(`/${key}`) ? 'page' : undefined}>{t(key)}</Link>)}
        </nav>
        <div className={styles['header-tools']}>
          <Link className={styles['chat-link']} href="/chat">{t('chat')}<ArrowUpRight size={14} /></Link>
          <label className={styles['locale-select']}><span className={styles['sr-only']}>{t('language')}</span><select value={locale} onChange={e => setLocale(e.target.value as Locale)}><option value="zh">中</option><option value="en">EN</option><option value="ja">日本語</option><option value="de">DE</option></select></label>
          <button className={styles['icon-button']} aria-label={`${t('theme')}: ${theme === 'dark' ? t('light') : t('dark')}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button className={`${styles['icon-button']} ${styles['menu-button']}`} aria-label={open ? t('close') : t('menu')} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>
      {open && <nav className={styles['mobile-nav']} aria-label={t('menu')}>{sections.map(([key, number]) => <Link href={`/${key}`} key={key} onClick={() => setOpen(false)} aria-current={pathname.startsWith(`/${key}`) ? 'page' : undefined}><span>{number}</span>{t(key)}<ArrowUpRight size={18} /></Link>)}</nav>}
      <main id="main-content" className={styles['main-content']}>{children}</main>
      <footer className={styles['site-footer']}>
        <div><Link href="/home" className={styles['footer-wordmark']}>Ark.</Link><p>TIME MENDS THE WOUNDS,<br />LOVE SOOTHES THE SCARS.</p></div>
        <div className={styles['footer-links']}><Link href="/terms">{t('terms')}</Link><a href="https://github.com/yororoA" target="_blank" rel="noreferrer">GitHub ↗</a><Link href="/about#guestbook">{t('guestbook')}</Link></div>
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
