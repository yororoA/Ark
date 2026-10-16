'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAppearance } from './appearance-store'
import { useRainConnection } from './rain-connection-store'
import { handOffUnderP3RWipe, P3R_WIPE_EVENT, type P3RWipeRequest } from './p3r-transition'
import { fluidCoverRadius, fluidScale, fluidSeed, type FluidSeed } from './p3r-fluid'
import styles from './p3r-effects.module.scss'

const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeInOut = (t: number) => t < .5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2
// Navigation starts only under the full cover, so the cover stays short.
const COVER_MS = 220
const HOLD_MS = 60
const REVEAL_MS = 340
// A streaming loading boundary or a page still waiting for its client chunk
// stays covered briefly instead of opening onto a blank page.
const LOADING_GRACE_MS = 300
const ROUTE_FALLBACK_MS = 8000
const TAU = Math.PI * 2
const SEGMENTS = 72

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
    const points = new Float64Array(SEGMENTS * 2)
    let frame = 0, timeout = 0, width = 0, height = 0
    let active = false
    let pending: P3RWipeRequest['navigate']
    let pendingFallback: P3RWipeRequest['fallback']
    const resize = () => {
      width = innerWidth
      height = innerHeight
      const ratio = Math.min(devicePixelRatio || 1, 1.5)
      canvas.width = Math.ceil(width * ratio)
      canvas.height = Math.ceil(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    // Mirrored on <html> so entrances mounted beneath the cover wait for the reveal.
    const setPhase = (phase: 'idle' | 'expanding' | 'covered' | 'revealing') => {
      layer.dataset.phase = phase
      if (phase === 'idle') delete document.documentElement.dataset.p3rWipe
      else document.documentElement.dataset.p3rWipe = phase
    }
    // Smooth closed outline through the fluid vertices.
    const blob = (x: number, y: number, radius: number, time: number, seed: FluidSeed, fill: string) => {
      for (let index = 0; index < SEGMENTS; index++) {
        const angle = index / SEGMENTS * TAU
        const extent = Math.max(0, radius * fluidScale(angle, time, seed))
        points[index * 2] = x + Math.cos(angle) * extent
        points[index * 2 + 1] = y + Math.sin(angle) * extent
      }
      const last = (SEGMENTS - 1) * 2
      context.beginPath()
      context.moveTo((points[last] + points[0]) / 2, (points[last + 1] + points[1]) / 2)
      for (let index = 0; index < SEGMENTS; index++) {
        const point = index * 2, next = (index + 1) % SEGMENTS * 2
        context.quadraticCurveTo(points[point], points[point + 1], (points[point] + points[next]) / 2, (points[point + 1] + points[next + 1]) / 2)
      }
      context.fillStyle = fill
      context.fill()
    }
    const clear = () => {
      cancelAnimationFrame(frame)
      clearTimeout(timeout)
      committed.current = null
      pending = pendingFallback = undefined
      active = false
      setPhase('idle')
      context.globalCompositeOperation = 'source-over'
      context.clearRect(0, 0, width, height)
      if (typeof layer.hidePopover === 'function' && layer.matches(':popover-open')) layer.hidePopover()
    }
    // Esc, a hidden tab or reduced motion end the visuals but keep the route.
    const skip = () => {
      const navigate = pending, fallback = pendingFallback
      clear()
      if (!navigate) return
      try { navigate() } catch { fallback?.() }
    }
    const start = ({ x, y, navigate, fallback }: P3RWipeRequest) => {
      clear()
      resize()
      active = true
      pending = navigate
      pendingFallback = fallback
      setPhase('expanding')
      // A non-focusable manual popover stays above native menu dialogs.
      if (typeof layer.showPopover === 'function') layer.showPopover()
      const started = performance.now()
      const [bodySeed, tintSeed, holeSeed] = [fluidSeed(), fluidSeed(), fluidSeed()]
      let coveredAt = 0, readyAt = 0, revealAt = 0
      // The route changes only under the full cover. False means the wipe ended.
      const handoff = () => {
        const route = pending, routeFallback = pendingFallback
        pending = pendingFallback = undefined
        if (!route) { readyAt = performance.now(); return true }
        committed.current = () => { committed.current = null; readyAt = performance.now() }
        try {
          if (!handOffUnderP3RWipe(route)) { committed.current = null; readyAt = performance.now(); return true }
        } catch {
          clear()
          routeFallback?.()
          return false
        }
        // A stalled client route must still reach its destination.
        timeout = window.setTimeout(() => {
          committed.current = null
          if (!routeFallback) { clear(); return }
          try { routeFallback() } catch { clear() }
        }, ROUTE_FALLBACK_MS)
        return true
      }
      const draw = (now: number) => {
        const extent = fluidCoverRadius(x, y, width, height)
        const elapsed = now - started
        context.clearRect(0, 0, width, height)
        if (elapsed < COVER_MS) {
          const progress = elapsed / COVER_MS
          blob(x, y, extent * easeOut(Math.min(1, progress / .8)), elapsed, tintSeed, '#0754e46b')
          const radius = extent * easeOut(progress)
          blob(x, y, radius, elapsed, bodySeed, '#58e5ff')
          blob(x, y, radius - 7, elapsed, bodySeed, '#f4fbff')
          blob(x, y, radius - 10, elapsed, bodySeed, '#0754e4')
        } else {
          context.fillStyle = '#0754e4'
          context.fillRect(0, 0, width, height)
          if (!coveredAt) {
            coveredAt = now
            setPhase('covered')
            if (!handoff()) return
          }
          if (!revealAt && readyAt && now - coveredAt >= HOLD_MS) {
            const contentPending = !!document.querySelector('[data-route-loading], #main-content:empty')
            if (!contentPending || now - readyAt >= LOADING_GRACE_MS) { revealAt = now; setPhase('revealing') }
          }
          if (revealAt) {
            const progress = Math.min(1, (now - revealAt) / REVEAL_MS)
            const radius = extent * easeInOut(progress)
            blob(x, y, radius, now - revealAt, holeSeed, '#58e5ff')
            context.globalCompositeOperation = 'destination-out'
            blob(x, y, radius - 6, now - revealAt, holeSeed, '#000')
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
      const detail = (event as CustomEvent<P3RWipeRequest>).detail
      // A link chosen while the hole opens starts its own wipe from there.
      if (!active || layer.dataset.phase === 'revealing') { start(detail); return }
      // Before the handoff the latest choice wins; blind clicks under the full
      // cover are absorbed.
      const replacesPendingRoute = !!pending && !!detail.navigate
      if (replacesPendingRoute) { pending = detail.navigate; pendingFallback = detail.fallback }
    }
    const key = (event: KeyboardEvent) => { if (active && event.key === 'Escape') skip() }
    const preference = () => { if (motion.matches) skip() }
    const visibility = () => { if (document.hidden) skip() }
    const unsubscribe = useRainConnection.subscribe(({ connection }) => { if (connection) clear() })
    document.addEventListener(P3R_WIPE_EVENT, request)
    document.addEventListener('keydown', key)
    document.addEventListener('visibilitychange', visibility)
    motion.addEventListener('change', preference)
    window.addEventListener('resize', resize)
    return () => {
      unsubscribe()
      document.removeEventListener(P3R_WIPE_EVENT, request)
      document.removeEventListener('keydown', key)
      document.removeEventListener('visibilitychange', visibility)
      motion.removeEventListener('change', preference)
      window.removeEventListener('resize', resize)
      skip()
    }
  }, [design])
  // Previous circular cover with click-time navigation: commit 65630bf.
  // Previous double-ring / diagonal implementation: commit e2ef28d.
  return design === 'p3r' ? <div ref={ref} className={styles['effect-layer']} popover="manual"
    data-testid="p3r-wipe" data-phase="idle" aria-hidden="true"><canvas ref={canvasRef} /></div> : null
}
