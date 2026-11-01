'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { ArrowLeft, BookOpen, Grid2X2, House, MessageCircle, Sparkles } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import { sections } from '@/lib/blog'
import { safeThemeReturn } from '@/lib/theme-navigation'
import { useBlog } from './blog-provider'
import { prepareListReturn, safeReturnPath } from './list-navigation'
import styles from './blog.module.scss'

const tabs = [
  { path: 'home', icon: House },
  { path: 'articles', icon: BookOpen },
  { path: 'moments', icon: Sparkles },
  { path: 'chat', icon: MessageCircle },
] as const

export function MobilePageContext() {
  const pathname = usePathname()
  const params = useSearchParams()
  const { t, locale } = useBlog()
  if (pathname === '/theme') {
    const returnTo = safeThemeReturn(params.get('returnTo'))
    const title = { zh: '外观', en: 'Appearance', ja: '外観', de: 'Darstellung' }[locale]
    return <div className={styles['mobile-page-context']}>
      <Link href={returnTo} scroll={false} aria-label={t('back')} onNavigate={() => prepareListReturn(returnTo)}><ArrowLeft size={21} /></Link>
      <span>{title}</span>
    </div>
  }
  const [, section, id, action] = pathname.split('/')
  const key = sections.find(([key]) => key === section)?.[0] ?? (section === 'chat' ? 'chat' : null)
  if (!key || key === 'home') return null
  const isList = section === 'articles' || section === 'moments'
  const returnTo = isList && id ? (action === 'edit' ? `/${section}/${id}` : safeReturnPath(params.get('returnTo'), section)) : '/home'
  return <div className={styles['mobile-page-context']}>
    <Link href={returnTo} scroll={false} aria-label={`${t('back')} · ${t(isList && id ? section : 'home')}`} onNavigate={() => prepareListReturn(returnTo)}><ArrowLeft size={21} /></Link>
    <span>{t(key)}</span>
  </div>
}

export default function AppNavigation({ openMenu, menuOpen }: { openMenu: () => void; menuOpen: boolean }) {
  const pathname = usePathname()
  const { t } = useBlog()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>('[data-blog-root]')
    if (!root) return
    const update = () => {
      const target = document.activeElement
      const editing = target instanceof HTMLElement && target.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([type="submit"]), [contenteditable="true"]')
      root.toggleAttribute('data-input-focused', editing)
    }
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    update()
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      root.removeAttribute('data-input-focused')
    }
  }, [pathname])
  const active = pathname.split('/')[1]
  return <nav ref={ref} className={styles['app-navigation']} aria-label={t('primaryNavigation')}>
    {tabs.map(({ path, icon: Icon }) => <Link key={path} href={`/${path}`} aria-current={active === path ? 'page' : undefined}
      onNavigate={event => {
        if (pathname !== `/${path}` || location.search) return
        event.preventDefault()
        window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      }}><span className={styles['app-tab-icon']}><Icon size={21} strokeWidth={1.8} /></span><span>{t(path === 'home' ? 'tabHome' : path)}</span></Link>)}
    <button type="button" aria-label={t('tabMore')} aria-expanded={menuOpen} data-active={!tabs.some(tab => tab.path === active) || undefined}
      onClick={event => { event.currentTarget.focus({ preventScroll: true }); openMenu() }}><span className={styles['app-tab-icon']}><Grid2X2 size={21} strokeWidth={1.8} /></span><span>{t('tabMore')}</span></button>
  </nav>
}
