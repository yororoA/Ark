'use client'

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import Portal from '@/components/Portal'
import { drawRainConnection, type RainPalette } from './rain-connection-drawing'
import { RAIN_TIMING, smooth } from './rain-connection-timeline'
import type { RainConnection } from './rain-connection-store'
import styles from './rain-connection.module.scss'

interface Props extends RainConnection {
  pageReady: boolean
  navigationSlow: boolean
  onCovered: () => void
  onComplete: () => void
}

export default function RainConnectionSequence(props: Props) {
  const { status, error, destination, pageReady, navigationSlow, onDismiss } = props
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef(props)
  const skip = useRef(false)
  const [phase, setPhase] = useState('umbrellas')

  useLayoutEffect(() => { latest.current = props }, [props])

  useEffect(() => {
    const section = sectionRef.current
    const canvas = canvasRef.current
    if (!section || !canvas) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    section.focus({ preventScroll: true })
    // The falling sheet must expose real DOM through transparent canvas pixels.
    const context = canvas.getContext('2d')
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    let simplified = reducedMotion.matches || !context
    let disposed = false
    let animationFrame = 0
    let previousTime = 0
    let elapsed = 0
    let exitTime = -1
    let navigationStarted = false
    let announcedPhase = 'umbrellas'
    let width = 0
    let height = 0
    const rootStyle = getComputedStyle(document.documentElement)
    const token = (name: string, fallback: string) => rootStyle.getPropertyValue(name).trim() || fallback
    const palette: RainPalette = {
      paper: token('--ark-paper', '#eceeee'),
      sheet: token('--ark-rain-sheet', '#f7f9f9'),
      rain: token('--ark-rain', '#7bd3e2'),
      deep: token('--ark-rain-deep', '#5fa4bd'),
      line: token('--ark-line', '#a4bfc5'),
      font: `${token('--font-noto-serif-loaded', '"Noto Serif SC"')}, serif`,
    }

    const resize = () => {
      const ratio = Math.min(devicePixelRatio || 1, 1.5)
      width = section.clientWidth
      height = section.clientHeight
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context?.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(section)
    resize()

    const announce = (next: string) => {
      if (next === announcedPhase) return
      announcedPhase = next
      setPhase(next)
    }
    const motionChanged = () => {
      if (reducedMotion.matches) simplified = true
    }
    const contextLost = () => { simplified = true }
    reducedMotion.addEventListener('change', motionChanged)
    canvas.addEventListener('contextlost', contextLost)

    const render = (now: number) => {
      if (disposed) return
      const delta = previousTime && !document.hidden ? Math.min(now - previousTime, 64) : 0
      previousTime = now
      const current = latest.current
      const failed = current.status === 'error'
      const quick = simplified || skip.current
      // Hold the sheet over all four corners until the destination commits.
      // Authentication and navigation can both outlast the drawing sequence.
      if (!failed) elapsed = quick ? RAIN_TIMING.covered : Math.min(RAIN_TIMING.covered, elapsed + delta)
      const atCover = elapsed >= RAIN_TIMING.covered
      const canNavigate = atCover && current.status === 'success' && !navigationStarted
      if (canNavigate) {
        navigationStarted = true
        current.onCovered()
      }
      const canExit = current.pageReady && atCover && !failed
      if (canExit && exitTime < 0) exitTime = 0
      if (exitTime >= 0 && !failed) exitTime += delta
      const exitDuration = quick ? RAIN_TIMING.quickReveal : RAIN_TIMING.reveal
      const reveal = exitTime < 0 ? 0 : Math.min(1, exitTime / exitDuration)

      if (failed) announce('error')
      else if (exitTime >= 0) announce('revealing')
      else if (atCover && !current.pageReady) announce('covered')
      else if (elapsed >= RAIN_TIMING.paper) announce('covering')
      else if (elapsed >= RAIN_TIMING.chamber) announce('gathering')
      else if (elapsed >= RAIN_TIMING.flash) announce('flash')
      else announce('umbrellas')

      if (context && !quick) drawRainConnection(context, width, height, elapsed, reveal, palette)
      section.dataset.renderer = quick ? 'static' : 'canvas'
      // A short fade is reserved for reduced motion, skip and Canvas fallback.
      // Normal playback remains fully opaque and reveals by moving the paper.
      section.style.setProperty('--stage-opacity', `${quick ? 1 - smooth(reveal) : 1}`)
      section.dataset.elapsed = `${Math.round(elapsed)}`
      section.dataset.reveal = reveal.toFixed(3)
      if (exitTime >= exitDuration) {
        current.onComplete()
        return
      }
      animationFrame = requestAnimationFrame(render)
    }

    animationFrame = requestAnimationFrame(render)
    return () => {
      disposed = true
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
      reducedMotion.removeEventListener('change', motionChanged)
      canvas.removeEventListener('contextlost', contextLost)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  const failed = status === 'error'
  const revealing = phase === 'revealing'
  const cancelOrSkip = () => {
    if (status === 'success') skip.current = true
    else onDismiss()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); cancelOrSkip() }
    if (event.key !== 'Tab') return
    const controls = Array.from(sectionRef.current?.querySelectorAll<HTMLElement>('button, a[href]') || [])
      .filter(element => element.getClientRects().length > 0)
    if (!controls.length) { event.preventDefault(); return }
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === sectionRef.current)) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === sectionRef.current)) {
      event.preventDefault(); first.focus()
    }
  }

  return <Portal black={false}>
    <section ref={sectionRef} className={styles.sequence} data-testid="rain-connection"
      data-phase={failed ? 'error' : phase}
      role="dialog" aria-modal="true" aria-label="雨声 · 接入" aria-busy={status === 'pending'}
      tabIndex={-1} onKeyDown={onKeyDown}>
      <div className={styles.stage} aria-hidden="true">
        <div className={styles['static-paper']}>
          <svg viewBox="0 0 220 150">
            <path d="M31 92H189C181 116 151 130 110 130S39 116 31 92Z" />
            <path className={styles['umbrella-handle']} d="M110 92V50c0-12 15-15 20-5 3 7-2 13-8 13" />
          </svg>
        </div>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
      <div className={styles.caption} role="status">
        {failed ? '这场雨，稍作停留。' : status === 'pending' ? '正在确认身份…' : pageReady ? '连接已建立。' : '正在打开页面…'}
      </div>
      {failed ? <div className={styles.failure}>
        <p role="alert">{error || '暂时无法连接，请重试。'}</p>
        <button type="button" onClick={onDismiss}>返回登录 ↗</button>
      </div> : !revealing ? <button className={styles.skip} type="button" onClick={cancelOrSkip}>
        {status === 'success' ? '跳过动画 ↗' : '返回登录 ↗'}
      </button> : null}
      {navigationSlow && !pageReady ? <div className={styles.failure}>
        <p>页面仍在路上。</p>
        <a href={destination}>直接打开目标页 ↗</a>
        <button type="button" onClick={onDismiss}>返回</button>
      </div> : null}
    </section>
  </Portal>
}
