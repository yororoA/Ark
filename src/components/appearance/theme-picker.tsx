'use client'

import { Suspense, useSyncExternalStore } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Palette } from 'lucide-react'
import type { Locale } from '@/lib/blog'
import { safeThemeReturn } from '@/lib/theme-navigation'
import Link from './p3r-link'
import styles from './theme-link.module.scss'

const LOCATION_EVENT = 'ark:appearance-location'
function subscribeLocation(listener: () => void) {
  window.addEventListener('hashchange', listener)
  window.addEventListener('popstate', listener)
  window.addEventListener(LOCATION_EVENT, listener)
  return () => {
    window.removeEventListener('hashchange', listener)
    window.removeEventListener('popstate', listener)
    window.removeEventListener(LOCATION_EVENT, listener)
  }
}
const readHash = () => window.location.hash
const serverHash = () => ''
const refreshLocation = () => window.dispatchEvent(new Event(LOCATION_EVENT))

const TITLES = { zh: '外观', en: 'Appearance', ja: '外観', de: 'Darstellung' }

function AppearanceLink({ locale, href, current = false, onIntent }: { locale: Locale; href: string; current?: boolean; onIntent?: () => void }) {
  return <Link href={href} className={styles['theme-link']} aria-label={TITLES[locale]} title={TITLES[locale]} aria-current={current ? 'page' : undefined}
    onFocus={onIntent} onMouseEnter={onIntent} onPointerDown={onIntent}>
    <Palette size={18} strokeWidth={1.4} aria-hidden="true" />
  </Link>
}

function CurrentAppearanceLink({ locale }: { locale: Locale }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const hash = useSyncExternalStore(subscribeLocation, readHash, serverHash)
  const query = params.toString()
  const current = pathname === '/theme'
  const path = `${pathname}${query ? `?${query}` : ''}${hash}`
  // Intent refresh also covers same-page Next links whose pushState changes
  // the fragment without dispatching a native hashchange event.
  // Keep a real destination for modified clicks and query-only navigations.
  // The current theme page must not become its own nested return destination.
  const href = current ? path : `/theme?${new URLSearchParams({ returnTo: safeThemeReturn(path) })}`
  return <AppearanceLink locale={locale} href={href} current={current} onIntent={refreshLocation} />
}

export default function ThemePicker({ locale = 'zh' }: { locale?: Locale }) {
  // Only this small link depends on search params; headers remain prerenderable.
  return <Suspense fallback={<AppearanceLink locale={locale} href="/theme" />}>
    <CurrentAppearanceLink locale={locale} />
  </Suspense>
}
