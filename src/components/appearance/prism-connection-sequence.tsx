'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Portal from '@/components/Portal'
import type { RainConnection } from './rain-connection-store'
import PrismEclipse, { ECLIPSE_COVER_MS, ECLIPSE_REVEAL_MS } from './prism-eclipse'
import styles from './prism-connection.module.scss'

interface Props extends RainConnection {
  pageReady: boolean
  navigationSlow: boolean
  onCovered: () => void
  onComplete: () => void
}

export default function PrismConnectionSequence({ status, username, error, destination, pageReady, navigationSlow, onCovered, onComplete, onDismiss }: Props) {
  const ref = useRef<HTMLElement>(null)
  const [covered, setCovered] = useState(false)
  const [quick, setQuick] = useState(false)
  const started = useRef(false)
  const failed = status === 'error'
  const revealing = covered && pageReady && !failed
  const phase = failed ? 'error' : revealing ? 'revealing' : covered ? 'covered' : 'opening'
  const skip = useCallback(() => { setQuick(true); setCovered(true) }, [])
  useEffect(() => {
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus({ preventScroll: true })
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const preference = () => { if (motion.matches) skip() }
    const visibility = () => { if (document.hidden) skip() }
    const timer = window.setTimeout(() => {
      setCovered(true)
      if (motion.matches) setQuick(true)
    }, motion.matches ? 0 : ECLIPSE_COVER_MS)
    motion.addEventListener('change', preference)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      clearTimeout(timer)
      motion.removeEventListener('change', preference)
      document.removeEventListener('visibilitychange', visibility)
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [skip])
  useEffect(() => {
    if (!covered || status !== 'success' || started.current) return
    started.current = true
    onCovered()
  }, [covered, status, onCovered])
  useEffect(() => {
    if (!revealing) return
    const timer = window.setTimeout(onComplete, quick ? 0 : ECLIPSE_REVEAL_MS)
    return () => clearTimeout(timer)
  }, [revealing, quick, onComplete])
  const dismissOrSkip = () => status === 'success' ? skip() : onDismiss()
  function key(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { event.preventDefault(); dismissOrSkip() }
    if (event.key !== 'Tab') return
    const controls = [...(ref.current?.querySelectorAll<HTMLElement>('a[href],button') || [])].filter(node => node.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if (!first) { event.preventDefault(); return }
    const atDialog = document.activeElement === ref.current
    if (event.shiftKey && (document.activeElement === first || atDialog)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (document.activeElement === last || atDialog)) { event.preventDefault(); first.focus() }
  }
  return <Portal black={false}>
    <section ref={ref} className={styles.sequence} data-testid="prism-connection" data-phase={phase} data-quick={quick}
      role="dialog" aria-modal="true" aria-label="月之暗面 · 接入" aria-busy={status === 'pending'} tabIndex={-1} onKeyDown={key}>
      <PrismEclipse phase={phase} quick={quick} onUnavailable={skip} />
      <div className={styles['top-line']}><span>YOROROICE / ARK</span><span>ECLIPSE · 月之暗面</span></div>
      <div className={styles.identity}>
        <small>{covered ? 'TOTALITY / 进入另一面' : 'APPROACHING THE DARK SIDE'}</small><strong>{username}</strong>
        <p role="status">{failed ? '连接失败。' : status === 'pending' ? '正在确认身份…' : pageReady ? '连接已建立。' : '正在打开页面…'}</p>
        <div className={styles['contact-marks']} aria-hidden="true"><i /><span>{covered ? '●' : '◐'}</span><i /></div>
      </div>
      {failed ? <div className={styles.failure}><p role="alert">{error || '暂时无法连接，请重试。'}</p><button type="button" onClick={onDismiss}>返回登录 ↗</button></div>
        : !revealing ? <button className={styles.skip} type="button" onClick={dismissOrSkip}>{status === 'success' ? '跳过动画 ↗' : '返回登录 ↗'}</button> : null}
      {navigationSlow && !pageReady && <div className={styles.failure}><p>页面加载较慢，可直接打开目标页或返回重试。</p><a href={destination}>直接打开目标页 ↗</a><button type="button" onClick={onDismiss}>返回</button></div>}
    </section>
  </Portal>
}
