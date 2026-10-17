'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAppearance } from './appearance-store'
import { useRainConnection } from './rain-connection-store'
import { handOffUnderP3RWipe, P3R_WIPE_EVENT, type P3RWipeRequest } from './p3r-transition'
import styles from './rain-effects.module.scss'

const easeInOut = (t: number) => t < .5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2
// Each slat travels briefly; the stagger outward from the click carries the
// rhythm. With a ready route the wipe lasts about 0.7s, like the P3R wipe.
const DROP_MS = 220
const HOLD_MS = 60
const FALL_MS = 280
const STAGGER_MS = 70
// Fixed offsets keep slats at equal distances from the click out of step,
// like the uneven curtain of the MV's 00:42 shot.
const SLAT_OFFSETS_MS = [12, 0, 22, 6, 16, 2, 24, 8, 14, 0, 20, 10]
const SLAT_COUNT = SLAT_OFFSETS_MS.length
// A streaming loading boundary or a page still waiting for its client chunk
// stays covered briefly instead of opening onto a blank page.
const LOADING_GRACE_MS = 300
const ROUTE_FALLBACK_MS = 8000

// Paper slats drop over the page, the route changes beneath them, and they
// fall away from the same point. Shares the page-wipe contract of
// p3r-transition.ts: links stay theme-agnostic and only the renderer of the
// active design accepts a request.
export default function RainEffects() {
  const { design } = useAppearance()
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)
  const committed = useRef<(() => void) | null>(null)
  useEffect(() => { committed.current?.() }, [pathname])

  useEffect(() => {
    const layer = ref.current
    if (design !== 'rain' || !layer) return
    const slats = [...layer.children] as HTMLElement[]
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, timeout = 0
    let active = false
    let pending: P3RWipeRequest['navigate']
    let pendingFallback: P3RWipeRequest['fallback']
    // Mirrored on <html> so entrances mounted beneath the cover wait for the reveal.
    const setPhase = (phase: 'idle' | 'expanding' | 'covered' | 'revealing') => {
      layer.dataset.phase = phase
      if (phase === 'idle') delete document.documentElement.dataset.rainWipe
      else document.documentElement.dataset.rainWipe = phase
    }
    // Negative offsets hang above the viewport, positive ones below it.
    const place = (offsets: (index: number) => number) => slats.forEach((slat, index) => {
      slat.style.transform = `translate3d(0, ${offsets(index)}%, 0)`
    })
    const clear = () => {
      cancelAnimationFrame(frame)
      clearTimeout(timeout)
      committed.current = null
      pending = pendingFallback = undefined
      active = false
      setPhase('idle')
      for (const slat of slats) slat.style.transform = ''
      if (typeof layer.hidePopover === 'function' && layer.matches(':popover-open')) layer.hidePopover()
    }
    // Esc, a hidden tab or reduced motion end the visuals but keep the route.
    const skip = () => {
      const navigate = pending, fallback = pendingFallback
      clear()
      if (!navigate) return
      try { navigate() } catch { fallback?.() }
    }
    const start = ({ x, navigate, fallback }: P3RWipeRequest) => {
      clear()
      active = true
      pending = navigate
      pendingFallback = fallback
      // Slats wait above the viewport before the layer appears.
      place(() => -100)
      setPhase('expanding')
      // A non-focusable manual popover stays above native dialogs.
      if (typeof layer.showPopover === 'function') layer.showPopover()
      const centers = slats.map(slat => { const box = slat.getBoundingClientRect(); return box.left + box.width / 2 })
      const reach = Math.max(1, ...centers.map(center => Math.abs(center - x)))
      const delays = centers.map((center, index) => Math.abs(center - x) / reach * STAGGER_MS + SLAT_OFFSETS_MS[index])
      const span = Math.max(...delays)
      const started = performance.now()
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
      const progress = (elapsed: number, index: number, duration: number) => easeInOut(Math.min(1, Math.max(0, (elapsed - delays[index]) / duration)))
      const draw = (now: number) => {
        if (!coveredAt) {
          const elapsed = now - started
          place(index => (progress(elapsed, index, DROP_MS) - 1) * 100)
          if (elapsed >= span + DROP_MS) {
            coveredAt = now
            setPhase('covered')
            if (!handoff()) return
          }
        } else {
          if (!revealAt && readyAt && now - coveredAt >= HOLD_MS) {
            const contentPending = !!document.querySelector('[data-route-loading], #main-content:empty')
            if (!contentPending || now - readyAt >= LOADING_GRACE_MS) { revealAt = now; setPhase('revealing') }
          }
          if (revealAt) {
            const elapsed = now - revealAt
            place(index => progress(elapsed, index, FALL_MS) * 100)
            if (elapsed >= span + FALL_MS) { clear(); return }
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
      // A link chosen while the slats fall starts its own wipe from there.
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
    return () => {
      unsubscribe()
      document.removeEventListener(P3R_WIPE_EVENT, request)
      document.removeEventListener('keydown', key)
      document.removeEventListener('visibilitychange', visibility)
      motion.removeEventListener('change', preference)
      skip()
    }
  }, [design])
  return design === 'rain' ? <div ref={ref} className={styles['effect-layer']} popover="manual"
    data-testid="rain-wipe" data-phase="idle" aria-hidden="true">{Array.from({ length: SLAT_COUNT }, (_, index) => <i key={index} />)}</div> : null
}
