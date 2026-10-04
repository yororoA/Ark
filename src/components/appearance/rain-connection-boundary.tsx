'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { QINGJIAN_COPY } from '@/lib/qingjian-copy'
import { useRainConnection, type RainConnection } from './rain-connection-store'
import styles from './rain-connection.module.scss'

function LoadingCurtain({ label }: { label: string }) {
  return <div className={styles['loading-curtain']} role="status">
    <span className={styles['loading-label']}>{label}</span>
  </div>
}

const RainSequence = dynamic(() => import('./rain-connection-sequence'), {
  ssr: false,
  loading: () => <LoadingCurtain label={`${QINGJIAN_COPY.zh.name} · 正在接入`} />,
})
const P3RSequence = dynamic(() => import('./p3r-connection-sequence'), {
  ssr: false,
  loading: () => <LoadingCurtain label="P3R · 正在接入" />,
})

function Transition({ connection }: { connection: RainConnection }) {
  const router = useRouter()
  const pathname = usePathname()
  const [navigating, setNavigating] = useState(false)
  const navigationStarted = useRef(false)
  const completed = useRef(false)
  // A destination may redirect (for example an old bookmark). Its committed
  // non-login route is what the umbrella must uncover.
  const pageReady = navigating && pathname !== '/login'

  const covered = useCallback(() => {
    if (connection.status !== 'success' || navigationStarted.current) return
    navigationStarted.current = true
    setNavigating(true)
    router.replace(connection.destination)
  }, [connection.status, connection.destination, router])

  const complete = useCallback(() => {
    completed.current = true
    useRainConnection.getState().clear(connection.id)
  }, [connection.id])

  useEffect(() => () => {
    // Passive unmount cleanup runs after React removes the curtain and inert.
    // Removing tabindex immediately after focus would send focus back to body.
    if (!completed.current) return
    const main = document.querySelector<HTMLElement>('main')
    if (!main) return
    if (!main.hasAttribute('tabindex')) {
      main.setAttribute('tabindex', '-1')
      main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true })
    }
    main.focus({ preventScroll: true })
  }, [])

  const dismiss = useCallback(() => {
    useRainConnection.getState().clear(connection.id)
    connection.onDismiss()
  }, [connection])

  useEffect(() => {
    if (connection.status === 'success') router.prefetch(connection.destination)
  }, [connection.status, connection.destination, router])

  useEffect(() => {
    if (pathname === '/login' || navigationStarted.current) return
    useRainConnection.getState().clear(connection.id)
    connection.onDismiss()
  }, [pathname, connection])

  // A route that redirects (including a protected destination returning to
  // login) must not leave an undismissable curtain. A slow navigation keeps the
  // umbrella open and exposes a normal destination link after this interval.
  const [navigationSlow, setNavigationSlow] = useState(false)
  useEffect(() => {
    if (!navigating || pageReady) return
    const timer = window.setTimeout(() => setNavigationSlow(true), 12000)
    return () => window.clearTimeout(timer)
  }, [navigating, pageReady])

  const Sequence = connection.design === 'p3r' ? P3RSequence : RainSequence
  return <Sequence
    {...connection}
    pageReady={pageReady}
    navigationSlow={navigationSlow}
    onCovered={covered}
    onComplete={complete}
    onDismiss={dismiss}
  />
}

export default function RainConnectionBoundary({ children }: { children: ReactNode }) {
  const connection = useRainConnection(state => state.connection)
  return <>
    <div className={styles['route-content']} inert={connection !== null}>{children}</div>
    {connection ? <Transition key={connection.id} connection={connection} /> : null}
  </>
}
