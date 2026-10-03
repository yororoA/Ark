'use client'

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import useSWR, { SWRConfig, useSWRConfig } from 'swr'
import { Locale, Session, TextKey, translate } from '@/lib/blog'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path.startsWith('/api/') ? path : `/api/blog/${path}`, init)
  const data = await response.json().catch(() => null)
  if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('ark:session-invalid'))
  if (!response.ok || data?.success === false) throw new Error(data?.message || `Request failed (${response.status})`)
  return data
}
export function send<T>(path: string, body: unknown, method = 'POST') {
  const multipart = body instanceof FormData
  return request<T>(path, { method, headers: multipart ? undefined : { 'Content-Type': 'application/json' }, body: multipart ? body : JSON.stringify(body) })
}
export function useBlogData<T>(path: string | null, options?: { refreshInterval?: number; revalidateOnFocus?: boolean; revalidateIfStale?: boolean }) {
  return useSWR<T>(path ? `/api/blog/${path}` : null, request, options)
}
type BlogContextValue = {
  locale: Locale; setLocale: (value: Locale) => void; t: (key: TextKey) => string
  session: Session | null; sessionLoading: boolean; refreshSession: () => void
  connection: string; notify: (message: string) => void; toast: string
}
const BlogContext = createContext<BlogContextValue | null>(null)
function subscribePreferences(listener: () => void) {
  window.addEventListener('storage', listener)
  window.addEventListener('ark:preferences', listener)
  return () => { window.removeEventListener('storage', listener); window.removeEventListener('ark:preferences', listener) }
}
function readLocale(): Locale {
  const value = preference('ark.locale', navigator.language.slice(0, 2))
  return (['zh', 'en', 'ja', 'de'].includes(value) ? value : 'en') as Locale
}
function preference(key: string, fallback: string) {
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}
function savePreference(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* Browsing remains available without storage. */ }
  window.dispatchEvent(new Event('ark:preferences'))
}
export function useBlog() {
  const value = useContext(BlogContext)
  if (!value) throw new Error('BlogProvider is required')
  return value
}

function Preferences({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribePreferences, readLocale, () => 'zh' as Locale)
  const [toast, setToast] = useState('')
  const [connection, setConnection] = useState('idle')
  const { mutate } = useSWRConfig()
  const { data, isLoading, mutate: refreshSession } = useSWR<{ data: Session | null }>('/api/session', request, { refreshInterval: 60_000 })
  const session = data?.data ?? null
  useEffect(() => {
    const revalidate = () => { void refreshSession() }
    window.addEventListener('ark:session-invalid', revalidate)
    return () => window.removeEventListener('ark:session-invalid', revalidate)
  }, [refreshSession])
  useEffect(() => { document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale }, [locale])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 5000)
    return () => clearTimeout(timer)
  }, [toast])
  const notify = useCallback((message: string) => setToast(message), [])
  useEffect(() => {
    if (!session?.uid) return
    const source = new EventSource('/api/blog/sse/subscribe')
    source.onopen = () => setConnection('connected')
    source.onerror = () => setConnection('reconnecting')
    const refresh = () => {
      // Detail article GET increments views. Only invalidate collections here.
      void mutate(key => {
        const path = Array.isArray(key) ? key[0] : key
        return typeof path === 'string' && path.startsWith('/api/blog/') && !/^\/api\/blog\/knowledge\/[a-f0-9]{24}$/.test(path)
      })
    }
    for (const event of ['moment', 'comment', 'moment-like', 'comment-like', 'article', 'guestbook']) source.addEventListener(event, refresh)
    source.addEventListener('chat', event => {
      try { window.dispatchEvent(new CustomEvent('ark:chat', { detail: JSON.parse((event as MessageEvent).data) })) } catch { /* Ignore malformed events. */ }
    })
    source.addEventListener('session-refresh', () => { void refreshSession() })
    return () => { source.close() }
  }, [session?.uid, mutate, refreshSession])
  return (
    <BlogContext.Provider value={{
      locale, setLocale(value) { savePreference('ark.locale', value) }, t: key => translate(locale, key),
      session, sessionLoading: isLoading, refreshSession: () => { void refreshSession() }, connection, notify, toast,
    }}>
      {children}
    </BlogContext.Provider>
  )
}

export default function BlogProvider({ children }: { children: React.ReactNode }) {
  // A fresh blog mount after login/account switching must not reuse a previous
  // user's private caches or briefly render their session.
  const [cache] = useState(() => new Map())
  return <SWRConfig value={{ provider: () => cache, fetcher: request, errorRetryCount: 1, dedupingInterval: 5000 }}><Preferences>{children}</Preferences></SWRConfig>
}
