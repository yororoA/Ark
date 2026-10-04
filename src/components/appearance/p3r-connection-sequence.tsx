'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Portal from '@/components/Portal'
import type { RainConnection } from './rain-connection-store'
import P3RWater, { WATER_ENTRY_MS, WATER_REVEAL_MS } from './p3r-water'
import styles from './p3r-connection.module.scss'

interface Props extends RainConnection {
  pageReady: boolean
  navigationSlow: boolean
  onCovered: () => void
  onComplete: () => void
}

export default function P3RConnectionSequence({ status, username, error, destination, pageReady, navigationSlow, onCovered, onComplete, onDismiss }: Props) {
  const ref = useRef<HTMLElement>(null)
  const [covered, setCovered] = useState(false)
  const [quick, setQuick] = useState(false)
  const started = useRef(false)
  const failed = status === 'error'
  const revealing = covered && pageReady && !failed
  const phase = failed ? 'error' : revealing ? 'revealing' : covered ? 'covered' : 'opening'
  const makeQuick = useCallback(() => { setQuick(true); setCovered(true) }, [])

  useEffect(() => {
    const section = ref.current
    const opener = document.activeElement
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    section?.focus({ preventScroll: true })
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const skip = () => { if (media.matches) makeQuick() }
    const timer = window.setTimeout(() => {
      setCovered(true)
      if (media.matches) setQuick(true)
    }, media.matches ? 0 : WATER_ENTRY_MS + 34)
    media.addEventListener('change', skip)
    return () => {
      clearTimeout(timer)
      media.removeEventListener('change', skip)
      document.body.style.overflow = previous
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [makeQuick])

  useEffect(() => {
    if (!covered || status !== 'success' || started.current) return
    started.current = true
    onCovered()
  }, [covered, status, onCovered])

  useEffect(() => {
    if (!revealing) return
    const timer = window.setTimeout(onComplete, quick ? 120 : WATER_REVEAL_MS + 34)
    return () => clearTimeout(timer)
  }, [revealing, quick, onComplete])

  function cancelOrSkip() {
    if (status === 'success') makeQuick()
    else onDismiss()
  }
  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { event.preventDefault(); cancelOrSkip() }
    if (event.key !== 'Tab') return
    const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('a[href], button') || []).filter(node => node.getClientRects().length > 0)
    const first = controls[0], last = controls[controls.length - 1]
    if (!first) { event.preventDefault(); return }
    const atDialog = document.activeElement === ref.current
    if (event.shiftKey && (document.activeElement === first || atDialog)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (document.activeElement === last || atDialog)) { event.preventDefault(); first.focus() }
  }
  return <Portal black={false}>
    <section ref={ref} className={styles.sequence} data-phase={phase} data-quick={quick} data-testid="p3r-connection"
      data-p3r-effect="none"
      role="dialog" aria-modal="true" aria-label="P3R · 接入" aria-busy={status === 'pending'} tabIndex={-1} onKeyDown={keyDown}>
      {/* The previous crossed date-axis sequence is preserved in e2ef28d. */}
      <div className={styles.curtain} aria-hidden="true" />
      <P3RWater phase={phase} quick={quick} onUnavailable={makeQuick} />
      <div className={styles.identity}>
        <small>YOROROICE / ARK</small>
        <strong>{username}</strong>
        <p role="status">{failed ? '连接失败，请重试。' : status === 'pending' ? '正在确认身份…' : pageReady ? '连接已建立。' : '正在打开页面…'}</p>
      </div>
      {failed ? <div className={styles.failure}><p role="alert">{error || '暂时无法连接，请重试。'}</p><button type="button" onClick={onDismiss}>返回登录 ↗</button></div>
        : !revealing ? <button className={styles.skip} type="button" onClick={cancelOrSkip}>{status === 'success' ? '跳过动画 ↗' : '返回登录 ↗'}</button> : null}
      {navigationSlow && !pageReady && <div className={styles.failure}><p>页面加载较慢，可直接打开目标页或返回重试。</p><a href={destination}>直接打开目标页 ↗</a><button type="button" onClick={onDismiss}>返回</button></div>}
    </section>
  </Portal>
}
