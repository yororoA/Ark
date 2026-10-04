'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAppearance } from './appearance-store'
import { useRainConnection } from './rain-connection-store'
import { P3R_WIPE_EVENT, type P3RWipeRequest } from './p3r-transition'
import styles from './p3r-effects.module.scss'

const ease = (t: number) => t * t * (3 - 2 * t)

export default function P3REffects() {
  const { design } = useAppearance()
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const committed = useRef<(() => void) | null>(null)
  useEffect(() => { committed.current?.() }, [pathname])

  useEffect(() => {
    const layer = ref.current
    const canvas = canvasRef.current
    if (design !== 'p3r' || !layer || !canvas) return
    let ctx: CanvasRenderingContext2D | null = null
    try { ctx = canvas.getContext('2d') } catch { /* Native navigation fallback. */ }
    if (!ctx) return
    const context = ctx
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, timeout = 0, width = 0, height = 0
    let pending: P3RWipeRequest['navigate']
    let active = false
    const resize = () => {
      width = innerWidth
      height = innerHeight
      const ratio = Math.min(devicePixelRatio || 1, 1.5)
      canvas.width = Math.ceil(width * ratio)
      canvas.height = Math.ceil(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    const clear = () => {
      cancelAnimationFrame(frame)
      clearTimeout(timeout)
      committed.current = null
      pending = undefined
      active = false
      layer.dataset.phase = 'idle'
      context.clearRect(0, 0, width, height)
      if (typeof layer.hidePopover === 'function' && layer.matches(':popover-open')) layer.hidePopover()
    }
    const skip = () => {
      const navigate = pending
      clear()
      navigate?.()
    }
    const start = ({ x, y, navigate }: P3RWipeRequest) => {
      clear()
      resize()
      active = true
      pending = navigate
      layer.dataset.phase = 'expanding'
      // A non-focusable manual popover stays above native menu dialogs.
      if (typeof layer.showPopover === 'function') layer.showPopover()
      const started = performance.now()
      let revealAt = 0, covered = false, ready = !navigate
      const circle = (radius: number, fill: string) => {
        context.beginPath()
        context.arc(x, y, Math.max(0, radius), 0, Math.PI * 2)
        context.fillStyle = fill
        context.fill()
      }
      const draw = (now: number) => {
        const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 8
        context.clearRect(0, 0, width, height)
        const entering = Math.min(1, (now - started) / 380)
        if (entering < 1) {
          const extent = radius * ease(entering)
          circle(extent, '#58e5ff')
          circle(extent - 7, '#f4fbff')
          circle(extent - 10, '#0754e4')
        } else {
          context.fillStyle = '#0754e4'
          context.fillRect(0, 0, width, height)
          if (!covered) {
            covered = true
            layer.dataset.phase = 'covered'
            committed.current = () => { ready = true }
            const handoff = pending
            pending = undefined
            if (handoff && !handoff()) ready = true
            // A failed route must never leave an undismissable visual layer.
            timeout = window.setTimeout(clear, 12000)
          }
          if (ready && now - started >= 440) {
            if (!revealAt) { revealAt = now; layer.dataset.phase = 'revealing' }
            const progress = Math.min(1, (now - revealAt) / 360)
            const extent = radius * ease(progress)
            circle(extent, '#58e5ff')
            context.globalCompositeOperation = 'destination-out'
            circle(extent - 6, '#000')
            context.globalCompositeOperation = 'source-over'
            if (progress === 1) { clear(); return }
          }
        }
        frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
    }
    const request = (event: Event) => {
      if (motion.matches || document.hidden || useRainConnection.getState().connection) return
      event.preventDefault()
      start((event as CustomEvent<P3RWipeRequest>).detail)
    }
    const click = (event: MouseEvent) => {
      const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      if (motion.matches || modified || event.button !== 0 || !(event.target instanceof Element)) return
      const control = event.target.closest<HTMLElement>('a[href], button, summary, label, [role="option"], input[type="radio"], input[type="checkbox"]')
      if (!control || control.matches(':disabled, [aria-disabled="true"], [data-p3r-link]') || control.closest('[data-p3r-effect="none"]')) return
      if (control instanceof HTMLInputElement && control.getBoundingClientRect().width <= 1) return
      if (control instanceof HTMLAnchorElement && (control.download || control.target === '_blank' || control.origin !== location.origin)) return
      const rect = control.getBoundingClientRect()
      const x = event.detail ? event.clientX : rect.left + rect.width / 2
      const y = event.detail ? event.clientY : rect.top + rect.height / 2
      // Let business handlers open their dialogs or begin authentication first.
      queueMicrotask(() => {
        const connecting = useRainConnection.getState().connection !== null
        if (connecting) { clear(); return }
        if (document.documentElement.dataset.design === 'p3r') start({ x, y })
      })
    }
    const key = (event: KeyboardEvent) => { if (active && event.key === 'Escape') skip() }
    const preference = () => { if (motion.matches) skip() }
    const visibility = () => { if (document.hidden) skip() }
    const unsubscribe = useRainConnection.subscribe(({ connection }) => { if (connection) clear() })
    document.addEventListener(P3R_WIPE_EVENT, request)
    document.addEventListener('click', click, { capture: true, passive: true })
    document.addEventListener('keydown', key)
    document.addEventListener('visibilitychange', visibility)
    motion.addEventListener('change', preference)
    window.addEventListener('resize', resize)
    return () => {
      unsubscribe()
      document.removeEventListener(P3R_WIPE_EVENT, request)
      document.removeEventListener('click', click, true)
      document.removeEventListener('keydown', key)
      document.removeEventListener('visibilitychange', visibility)
      motion.removeEventListener('change', preference)
      window.removeEventListener('resize', resize)
      skip()
    }
  }, [design])
  // Previous double-ring / diagonal implementation: commit e2ef28d.
  return design === 'p3r' ? <div ref={ref} className={styles['effect-layer']} popover="manual"
    data-testid="p3r-wipe" data-phase="idle" aria-hidden="true"><canvas ref={canvasRef} /></div> : null
}
