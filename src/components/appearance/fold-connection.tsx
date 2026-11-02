'use client'

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import Portal from '@/components/Portal'
import type { RainConnection } from './rain-connection-store'
import { drawFoldConnection } from './fold-connection-drawing'
import { FOLD_TIMING as T } from './fold-connection-timeline'
import { observeFoldPalette, readFoldPalette } from './fold-palette'
import styles from './fold-connection.module.scss'

interface Props extends RainConnection {
  pageReady: boolean
  navigationSlow: boolean
  onCovered: () => void
  onComplete: () => void
}

export default function FoldConnection(props: Props) {
  const { status, error, pageReady, navigationSlow, destination, onDismiss } = props
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef(props)
  const skip = useRef(false)
  const [phase, setPhase] = useState('crease')
  useLayoutEffect(() => { latest.current = props }, [props])

  useEffect(() => {
    const section = sectionRef.current, canvas = canvasRef.current
    if (!section || !canvas) return
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    section.focus({ preventScroll: true })
    const context = canvas.getContext('2d')
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let simplified = motion.matches || !context
    let frame = 0, previous = 0, elapsed = 0, exitTime = -1, reveal = 0
    let width = 0, height = 0, navigating = false, announced = 'crease', disposed = false
    let palette = readFoldPalette()
    const paint = () => { if (context) drawFoldConnection(context, width, height, elapsed, reveal, palette) }
    const resize = () => {
      width = section.clientWidth; height = section.clientHeight
      const ratio = Math.min(devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
      context?.setTransform(ratio, 0, 0, ratio, 0, 0)
      paint()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(section); resize()
    const stopPalette = observeFoldPalette(next => { palette = next; if (!simplified) paint() })
    const reduce = () => { if (motion.matches) simplified = true }
    const contextLost = () => { simplified = true }
    motion.addEventListener('change', reduce)
    canvas.addEventListener('contextlost', contextLost)
    const announce = (next: string) => {
      document.documentElement.dataset.foldConnection = next
      if (announced !== next) { announced = next; setPhase(next) }
    }
    const render = (now: number) => {
      if (disposed) return
      const delta = previous && !document.hidden ? Math.min(now - previous, 64) : 0
      previous = now
      const current = latest.current
      const failed = current.status === 'error'
      const quick = simplified || skip.current
      if (!failed) elapsed = quick ? T.covered : Math.min(T.covered, elapsed + delta)
      const covered = elapsed >= T.covered
      if (covered && current.status === 'success' && !navigating) { navigating = true; current.onCovered() }
      if (covered && current.pageReady && !failed && exitTime < 0) exitTime = 0
      if (exitTime >= 0 && !failed) exitTime += delta
      const duration = simplified ? 0 : quick ? T.quickReveal : T.reveal
      reveal = exitTime < 0 ? 0 : duration === 0 ? 1 : Math.min(1, exitTime / duration)
      if (failed) announce('error')
      else if (exitTime >= 0) announce('revealing')
      else if (covered) announce('covered')
      else if (elapsed >= T.approach) announce('closing')
      else if (elapsed >= T.opening) announce('passage')
      else if (elapsed >= T.crease) announce('opening')
      else announce('crease')
      section.dataset.renderer = simplified ? 'static' : 'canvas'
      section.dataset.revealStarted = reveal > 0 ? 'true' : 'false'
      section.dataset.elapsed = `${Math.round(elapsed)}`
      section.dataset.reveal = reveal.toFixed(3)
      section.style.setProperty('--fallback-opacity', `${1 - reveal}`)
      if (!simplified) paint()
      if (exitTime >= 0 && reveal >= 1) { current.onComplete(); return }
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); stopPalette()
      motion.removeEventListener('change', reduce); canvas.removeEventListener('contextlost', contextLost)
      delete document.documentElement.dataset.foldConnection
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  const cancelOrSkip = () => { if (status === 'success') skip.current = true; else onDismiss() }
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); cancelOrSkip() }
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')].filter(element => element.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if (!first) { event.preventDefault(); event.currentTarget.focus(); return }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) { event.preventDefault(); first.focus() }
  }
  const revealing = phase === 'revealing'
  return <Portal black={false}>
    <section ref={sectionRef} className={styles.sequence} data-testid="fold-connection" data-status={status}
      data-phase={status === 'error' ? 'error' : phase} data-renderer="pending" role="dialog" aria-modal="true"
      aria-label="折境 · 身份确认" tabIndex={-1} onKeyDown={keyboard}>
      <div className={styles.stage} aria-hidden="true"><div className={styles.backdrop} /><div className={styles.static} /><canvas ref={canvasRef} className={styles.canvas} /></div>
      <header className={styles.header}><span>ARK / FOLD</span><span>BEYOND THE FOLD.</span></header>
      <p className={styles.caption} role="status">{status === 'error' ? '连接未完成。' : status === 'pending' ? '正在确认身份…' : pageReady ? '故事，继续。' : '身份已确认，正在进入。'}</p>
      {status === 'error' ? <div className={styles.failure}><span>01 / A MOMENT OF PAUSE</span><h1>稍作停留。</h1><p role="alert">{error || '暂时无法连接，请重试。'}</p><button type="button" onClick={onDismiss}>返回登录 ↗</button></div>
        : !revealing && <button className={styles.skip} type="button" onClick={cancelOrSkip}>{status === 'success' ? '跳过动画 ↗' : '取消 ↗'}</button>}
      {navigationSlow && !pageReady && status !== 'error' && <div className={styles.failure}><span>THE DOOR IS STILL OPEN.</span><h1>正在打开页面。</h1><p>加载时间较长，可直接打开目标页或返回重试。</p><a href={destination}>打开目标页 ↗</a><button type="button" onClick={onDismiss}>返回登录</button></div>}
    </section>
  </Portal>
}
