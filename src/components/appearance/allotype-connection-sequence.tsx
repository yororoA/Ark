'use client'

import { useEffect, useRef, useState } from 'react'
import type { RainConnection } from './rain-connection-store'
import AllotypeArt from './allotype-art'
import styles from './allotype-connection.module.scss'

interface Props extends RainConnection {
  pageReady: boolean
  navigationSlow: boolean
  onCovered: () => void
  onComplete: () => void
}

export default function AllotypeConnection({ status, username, error, destination, pageReady, navigationSlow, onCovered, onComplete, onDismiss }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [quick, setQuick] = useState(false)
  const [printed, setPrinted] = useState(false)
  const revealing = status === 'success' && pageReady
  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const finish = () => { setQuick(true); setPrinted(true) }
    const preference = () => { if (motion.matches) finish() }
    const visibility = () => { if (document.hidden) finish() }
    const timer = window.setTimeout(() => { setPrinted(true); if (motion.matches) setQuick(true) }, motion.matches ? 0 : 1000)
    motion.addEventListener('change', preference)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      clearTimeout(timer)
      motion.removeEventListener('change', preference)
      document.removeEventListener('visibilitychange', visibility)
      dialog?.close()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => { if (printed && status === 'success') onCovered() }, [printed, status, onCovered])
  useEffect(() => {
    if (!revealing) return
    const timer = window.setTimeout(onComplete, quick ? 0 : 650)
    return () => clearTimeout(timer)
  }, [revealing, quick, onComplete])
  const skip = () => { setQuick(true); setPrinted(true) }
  return <dialog ref={ref} className={styles.sequence} data-testid="allotype-connection" data-revealing={revealing} data-quick={quick}
    aria-label="异相 · 接入" onCancel={event => { event.preventDefault(); if (status === 'success') skip(); else onDismiss() }}>
    <header><span>YOROROICE / ALLOTYPE</span><span>ANOTHER IMPRESSION</span></header>
    <div className={styles.print}><AllotypeArt index={status === 'success' ? 4 : 0} /></div>
    <div className={styles.identity}><small>YOU ARE HERE.</small><strong>{username}</strong><p role="status">{status === 'error' ? '连接失败' : status === 'pending' ? '正在确认身份…' : '你好，另一个你。'}</p></div>
    {status === 'error' ? <div className={styles.actions}><p role="alert">{error || '暂时无法连接，请重试。'}</p><button onClick={onDismiss}>返回登录 ↗</button></div>
      : <div className={styles.actions}><button onClick={status === 'success' ? skip : onDismiss}>{status === 'success' ? '跳过动画 ↗' : '返回登录 ↗'}</button></div>}
    {navigationSlow && !pageReady ? <div className={styles.actions}><p>页面加载较慢，可直接打开或返回重试。</p><a href={destination}>打开目标页 ↗</a><button onClick={onDismiss}>返回</button></div> : null}
  </dialog>
}
