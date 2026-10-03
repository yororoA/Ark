'use client'

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import Portal from '@/components/Portal'
import { RAIN_TIMING, smooth } from './rain-connection-timeline'
import type { RainConnection } from './rain-connection-store'
import type { createUmbrellaScene } from './rain-umbrella-scene'
import styles from './rain-connection.module.scss'

interface Props extends RainConnection {
  pageReady: boolean
  navigationSlow: boolean
  onCovered: () => void
  onComplete: () => void
}

function StillUmbrella() {
  return <svg className={styles['still-umbrella']} viewBox="-110 -110 220 220" aria-hidden="true">
    {Array.from({ length: 8 }, (_, i) => <path key={i} transform={`rotate(${i * 45})`}
      d="M0 0L0-100Q34-91 70.71-70.71Z" />)}
    <circle r="3" />
  </svg>
}

export default function RainConnectionSequence(props: Props) {
  const { status, error, destination, pageReady, navigationSlow, onDismiss } = props
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef(props)
  const skip = useRef(false)
  const [phase, setPhase] = useState('opening')
  const [fallback, setFallback] = useState(false)

  useLayoutEffect(() => { latest.current = props }, [props])

  useEffect(() => {
    const section = sectionRef.current
    const canvas = canvasRef.current
    if (!section || !canvas) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    section.focus({ preventScroll: true })
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    let simplified = reducedMotion.matches
    let disposed = false
    let scene: ReturnType<typeof createUmbrellaScene> | undefined
    let frame = 0
    let previousTime = 0
    let elapsed = 0
    let closingTime = -1
    let covered = false
    let announcedPhase = 'opening'
    let rendererReady = false
    const travelDuration = RAIN_TIMING.orbit + RAIN_TIMING.cover

    function announce(next: string) {
      if (next === announcedPhase) return
      announcedPhase = next
      setPhase(next)
    }
    function simplify() {
      simplified = true
      setFallback(true)
      scene?.dispose()
      scene = undefined
      rendererReady = true
    }
    const motionChanged = () => { if (reducedMotion.matches) simplify() }
    const contextLost = (event: Event) => { event.preventDefault(); simplify() }
    reducedMotion.addEventListener('change', motionChanged)
    canvas.addEventListener('webglcontextlost', contextLost)

    const render = (now: number) => {
      if (disposed) return
      // Do not leap through the choreography after a background tab resumes.
      const delta = previousTime ? Math.min(now - previousTime, 64) : 0
      previousTime = now
      const current = latest.current
      const failed = current.status === 'error'
      const quick = simplified || skip.current
      if (rendererReady && !failed) elapsed = Math.min(travelDuration, elapsed + delta)
      if (quick) elapsed = travelDuration

      if (failed) announce('error')
      else if (elapsed >= travelDuration) announce(closingTime < 0 ? 'covered' : 'closing')
      else if (elapsed > RAIN_TIMING.orbit) announce('covering')
      else if (elapsed > 500) announce('orbiting')

      const canNavigate = elapsed >= travelDuration && current.status === 'success'
      if (canNavigate && !covered) {
        covered = true
        current.onCovered()
      }
      if (covered && current.pageReady && closingTime < 0) closingTime = 0
      if (closingTime >= 0 && !failed) closingTime += delta
      const closingDuration = quick ? 200 : RAIN_TIMING.close
      const closure = closingTime < 0 ? 0 : smooth(closingTime / closingDuration)
      // Spatial motion is replaced with a short crossfade for reduced motion,
      // an unavailable renderer, or the explicit skip action.
      const opacity = quick
        ? 1 - closure
        : 1 - smooth((closingTime - closingDuration) / RAIN_TIMING.fade)
      section.style.setProperty('--scene-opacity', `${opacity}`)
      section.style.setProperty('--veil-opacity', `${closingTime >= 0 && !quick ? 0 : opacity}`)
      section.dataset.elapsed = `${Math.round(elapsed)}`
      section.dataset.closure = closure.toFixed(3)
      if (scene) scene.render(elapsed, quick ? 0 : closure)

      if (closingTime >= closingDuration + (quick ? 0 : RAIN_TIMING.fade)) {
        current.onComplete()
        return
      }
      frame = requestAnimationFrame(render)
    }

    if (simplified) simplify()
    else {
      void import('./rain-umbrella-scene').then(({ createUmbrellaScene }) => {
        if (disposed || simplified) return
        try {
          scene = createUmbrellaScene(canvas)
          scene.render(0, 0)
          rendererReady = true
          canvas.dataset.renderer = 'ready'
        } catch {
          simplify()
        }
      }).catch(() => { if (!disposed) simplify() })
    }
    frame = requestAnimationFrame(render)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      scene?.dispose()
      reducedMotion.removeEventListener('change', motionChanged)
      canvas.removeEventListener('webglcontextlost', contextLost)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  const failed = status === 'error'
  const closing = phase === 'closing'
  const canSkip = status === 'success' && !closing
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
      data-phase={failed ? 'error' : phase} data-fallback={fallback}
      role="dialog" aria-modal="true" aria-label="雨声 · 接入" aria-busy={status === 'pending'}
      tabIndex={-1} onKeyDown={onKeyDown}>
      <div className={styles.veil} aria-hidden="true" />
      <div className={styles['scene-lines']} aria-hidden="true"><i /><i /><i /></div>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {fallback ? <StillUmbrella /> : null}
      <div className={styles.signature} aria-hidden="true"><span>雨声</span><small>YOROROICE / ARK</small></div>
      <div className={styles.caption} role="status">
        {failed ? '这场雨，稍作停留。' : status === 'pending' ? '正在确认身份…' : pageReady ? '雨停之后，继续书写。' : '穿过雨声，与你相见。'}
      </div>
      {failed ? <div className={styles.failure}>
        <p role="alert">{error || '暂时无法连接，请重试。'}</p>
        <button type="button" onClick={onDismiss}>返回登录 ↗</button>
      </div> : !closing ? <button className={styles.skip} type="button" onClick={cancelOrSkip}>
        {canSkip ? '跳过动画 ↗' : '返回登录 ↗'}
      </button> : null}
      {navigationSlow && !pageReady ? <div className={styles.failure}>
        <p>页面仍在路上。</p>
        <a href={destination}>直接打开目标页 ↗</a>
        <button type="button" onClick={onDismiss}>返回</button>
      </div> : null}
    </section>
  </Portal>
}
