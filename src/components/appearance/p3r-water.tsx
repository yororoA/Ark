'use client'

import { useEffect, useRef } from 'react'
import { clamp, entry, reveal, underwater, WATER_ENTRY_MS, WATER_REVEAL_MS } from './p3r-water-renderer'
import styles from './p3r-connection.module.scss'

export { WATER_ENTRY_MS, WATER_REVEAL_MS } from './p3r-water-renderer'
type Phase = 'opening' | 'covered' | 'revealing' | 'error'

export default function P3RWater({ phase, quick, onUnavailable }: { phase: Phase; quick: boolean; onUnavailable: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || quick) return
    let ctx: CanvasRenderingContext2D | null = null
    try { ctx = canvas.getContext('2d') } catch { /* Static curtain below. */ }
    if (!ctx) { onUnavailable(); return }
    const context = ctx
    let w = 0, h = 0, frame = 0
    const start = performance.now()
    const resize = () => {
      w = innerWidth; h = innerHeight
      const ratio = Math.min(devicePixelRatio || 1, 1.5)
      canvas.width = Math.ceil(w * ratio); canvas.height = Math.ceil(h * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    const draw = (now: number) => {
      if (document.hidden) return
      context.clearRect(0, 0, w, h)
      const duration = phase === 'opening' ? WATER_ENTRY_MS : WATER_REVEAL_MS
      const t = clamp((now - start) / duration)
      // Crop one composition on tall screens instead of stretching its foam
      // into thin vertical stripes. Every phase uses the same scene dimensions.
      const sceneWidth = Math.max(w, h * 1.15)
      context.save()
      context.translate((w - sceneWidth) / 2, 0)
      if (phase === 'opening') entry(context, sceneWidth, h, t)
      else if (phase === 'revealing') reveal(context, sceneWidth, h, t)
      else underwater(context, sceneWidth, h)
      context.restore()
      const moving = phase === 'opening' || phase === 'revealing'
      if (moving && t < 1) frame = requestAnimationFrame(draw)
    }
    const redraw = () => { cancelAnimationFrame(frame); resize(); frame = requestAnimationFrame(draw) }
    redraw()
    window.addEventListener('resize', redraw)
    document.addEventListener('visibilitychange', redraw)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', redraw)
      document.removeEventListener('visibilitychange', redraw)
    }
  }, [phase, quick, onUnavailable])
  return <canvas ref={ref} className={styles.water} aria-hidden="true" />
}
