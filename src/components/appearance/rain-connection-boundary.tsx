'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useRainConnection, type RainConnection } from './rain-connection-store'
import styles from './rain-connection.module.scss'

const RainSequence = dynamic(() => import('./rain-connection-sequence'), {
  ssr: false,
  loading: () => <div className={styles['loading-curtain']} role="status">雨声 · 正在接入</div>,
})

function Transition({ connection }: { connection: RainConnection }) {
  const router = useRouter()
  const pathname = usePathname()
  const [navigating, setNavigating] = useState(false)
  const navigationStarted = useRef(false)
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
    useRainConnection.getState().clear(connection.id)
    requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>('main')
      if (!main) return
      const previous = main.getAttribute('tabindex')
      main.setAttribute('tabindex', '-1')
      main.focus({ preventScroll: true })
      if (previous === null) main.removeAttribute('tabindex')
      else main.setAttribute('tabindex', previous)
    })
  }, [connection.id])

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

  return <RainSequence
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
