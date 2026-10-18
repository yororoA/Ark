'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { SPECTRUM } from '@/lib/prism-copy'
import { useAppearance } from './appearance-store'
import { useRainConnection } from './rain-connection-store'
import { P3R_WIPE_EVENT, handOffUnderP3RWipe, type P3RWipeRequest } from './p3r-transition'
import styles from './prism-effects.module.scss'

const COVER = 320, HOLD = 70, REVEAL = 390, GRACE = 300
const ease = (t: number) => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2

// Reuses the existing link contract; only this theme accepts the request.
// A six-colour leading edge crosses the page, followed by an opaque shutter.
export default function PrismEffects() {
  const { design } = useAppearance()
  const path = usePathname()
  const ref = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const committed = useRef<(() => void) | null>(null)
  useEffect(() => { committed.current?.() }, [path])
  useEffect(() => {
    const layer = ref.current, canvas = canvasRef.current
    if (design !== 'prism' || !layer || !canvas) return
    let ctx: CanvasRenderingContext2D | null = null
    try { ctx = canvas.getContext('2d') } catch { /* Native Link fallback. */ }
    if (!ctx) return
    const paint = ctx
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, timer = 0, width = 0, height = 0
    let pending: P3RWipeRequest | null = null
    let active = false
    const phase = (value: string) => {
      layer.dataset.phase = value
      if (value === 'idle') delete document.documentElement.dataset.prismWipe
      else document.documentElement.dataset.prismWipe = value
    }
    const resize = () => {
      width = innerWidth; height = innerHeight
      const dpr = Math.min(devicePixelRatio || 1, 1.5)
      canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr)
      paint.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const clear = () => {
      cancelAnimationFrame(frame); clearTimeout(timer)
      committed.current = null; pending = null; active = false
      phase('idle')
      paint.clearRect(0, 0, width, height)
      if (layer.hidePopover && layer.matches(':popover-open')) layer.hidePopover()
    }
    const skip = () => {
      const route = pending
      clear()
      try { route?.navigate?.() } catch { route?.fallback?.() }
    }
    const polygon = (points: number[][], color: string) => {
      paint.beginPath()
      points.forEach(([x, y], index) => index ? paint.lineTo(x, y) : paint.moveTo(x, y))
      paint.closePath(); paint.fillStyle = color; paint.fill()
    }
    const start = (detail: P3RWipeRequest) => {
      clear(); resize()
      pending = detail; active = true; phase('expanding')
      try { layer.showPopover?.() } catch { /* Fixed-position fallback. */ }
      const began = performance.now()
      // Vertical origin changes the slope without moving the target content.
      const slope = width * (.13 + .09 * Math.min(1, Math.max(0, detail.y / height)))
      let coveredAt = 0, readyAt = 0, revealAt = 0
      const handoff = () => {
        const request = pending
        pending = null
        committed.current = () => { readyAt = performance.now(); committed.current = null }
        try {
          const navigated = request?.navigate ? handOffUnderP3RWipe(request.navigate) : false
          if (!navigated) { readyAt = performance.now(); committed.current = null }
          else timer = window.setTimeout(() => {
            if (request?.fallback) request.fallback()
            else clear()
          }, 8000)
        } catch { clear(); request?.fallback?.(); return false }
        return true
      }
      const draw = (now: number) => {
        paint.clearRect(0, 0, width, height)
        const elapsed = now - began
        if (!coveredAt && elapsed < COVER) {
          const edge = -slope - 48 + (width + slope * 2 + 48) * ease(elapsed / COVER)
          // Opaque base reaches past every corner before route handoff.
          polygon([[0, 0], [edge + slope, 0], [edge - slope, height], [0, height]], '#0b0d0e')
          SPECTRUM.forEach((color, i) => {
            const a = edge + i * 5, b = a + 5.5
            polygon([[a + slope, 0], [b + slope, 0], [b - slope, height], [a - slope, height]], color)
          })
        } else {
          paint.fillStyle = '#0b0d0e'; paint.fillRect(0, 0, width, height)
          if (!coveredAt) { coveredAt = now; phase('covered'); if (!handoff()) return }
          if (!revealAt && readyAt && now - coveredAt >= HOLD) {
            const loading = !!document.querySelector('[data-route-loading], #main-content:empty')
            if (!loading || now - readyAt >= GRACE) { revealAt = now; phase('revealing') }
          }
          if (revealAt) {
            const progress = Math.min(1, (now - revealAt) / REVEAL)
            const edge = -slope - 40 + (width + slope * 2 + 80) * ease(progress)
            paint.clearRect(0, 0, width, height)
            polygon([[edge + slope, 0], [width, 0], [width, height], [edge - slope, height]], '#0b0d0e')
            SPECTRUM.forEach((color, i) => {
              const a = edge + i * 4, b = a + 4.5
              polygon([[a + slope, 0], [b + slope, 0], [b - slope, height], [a - slope, height]], color)
            })
            if (progress === 1) { clear(); return }
          }
        }
        frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
    }
    const request = (event: Event) => {
      const disabled = motion.matches || document.hidden || !!useRainConnection.getState().connection
      if (disabled) return
      event.preventDefault()
      const detail = (event as CustomEvent<P3RWipeRequest>).detail
      if (!active || layer.dataset.phase === 'revealing') start(detail)
      else if (pending && detail.navigate) pending = detail
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
      unsubscribe(); skip()
      document.removeEventListener(P3R_WIPE_EVENT, request)
      document.removeEventListener('keydown', key)
      document.removeEventListener('visibilitychange', visibility)
      motion.removeEventListener('change', preference)
      window.removeEventListener('resize', resize)
    }
  }, [design])
  return design === 'prism' ? <div ref={ref} className={styles.layer} popover="manual" data-testid="prism-wipe" data-phase="idle" aria-hidden="true"><canvas ref={canvasRef} /></div> : null
}
