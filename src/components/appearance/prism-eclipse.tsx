'use client'

import { useEffect, useRef } from 'react'
import styles from './prism-connection.module.scss'

export const ECLIPSE_COVER_MS = 2100
export const ECLIPSE_REVEAL_MS = 850
type Phase = 'opening' | 'covered' | 'revealing' | 'error'
const ease = (t: number) => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
const clamp = (t: number) => Math.max(0, Math.min(1, t))
const stars = Array.from({ length: 180 }, (_, i) => ({
  x: ((i * 719 + 71) % 1193) / 1193, y: ((i * i * 37 + i * 239 + 31) % 887) / 887,
  r: i % 19 === 0 ? 1.3 : .6, offset: i * 1.7,
}))

// A separate total-eclipse composition; deliberately shares no homepage art.
// The canvas is an opaque waiting field until the route commits, then one
// expanding circular aperture reveals it. Old prism tableau: e365015.
export default function PrismEclipse({ phase, quick, onUnavailable }: { phase: Phase; quick: boolean; onUnavailable: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const state = useRef({ phase, quick })
  useEffect(() => { state.current = { phase, quick } }, [phase, quick])
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let context: CanvasRenderingContext2D | null = null
    try { context = canvas.getContext('2d', { alpha: true }) } catch { /* Static, accessible fallback. */ }
    if (!context) { const frame = requestAnimationFrame(onUnavailable); return () => cancelAnimationFrame(frame) }
    const ctx = context
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, width = 0, height = 0, revealAt = 0, lastPaint = 0
    const began = performance.now()
    const resize = () => {
      width = innerWidth; height = innerHeight
      const dpr = Math.min(devicePixelRatio || 1, 1.5)
      canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const circle = (x: number, y: number, r: number, fill: string | CanvasGradient) => {
      if (r <= 0) return
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill()
    }
    const ring = (x: number, y: number, radius: number, opacity: number, time: number) => {
      const outer = radius * 1.8
      const glow = ctx.createRadialGradient(x, y, Math.max(0, radius - 1), x, y, outer)
      glow.addColorStop(0, `rgba(232,239,240,${opacity * .8})`)
      glow.addColorStop(.025, `rgba(189,212,225,${opacity * .35})`)
      glow.addColorStop(.16, `rgba(124,161,183,${opacity * .1})`)
      glow.addColorStop(1, 'rgba(101,147,170,0)')
      circle(x, y, outer, glow)
      // Thin radial filaments, each with its own falloff; no uniform neon disc.
      ctx.lineWidth = .6
      for (let i = 0; i < 64; i++) {
        const angle = i / 64 * Math.PI * 2
        const reach = radius * (1.12 + .2 * (.5 + .5 * Math.sin(i * 7.3 + time * .0002)))
        const ax = x + Math.cos(angle) * radius, ay = y + Math.sin(angle) * radius
        const bx = x + Math.cos(angle) * reach, by = y + Math.sin(angle) * reach
        const ray = ctx.createLinearGradient(ax, ay, bx, by)
        ray.addColorStop(0, `rgba(211,226,235,${opacity * .24})`); ray.addColorStop(1, 'rgba(211,226,235,0)')
        ctx.strokeStyle = ray; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
      }
    }
    const draw = (now: number) => {
      if (document.hidden) return
      const current = state.current
      if (current.quick || motion.matches) {
        ctx.clearRect(0, 0, width, height)
        return
      }
      const revealing = current.phase === 'revealing'
      const settled = current.phase === 'covered' || current.phase === 'error'
      if (settled && now - lastPaint < 32) { frame = requestAnimationFrame(draw); return }
      lastPaint = now
      if (revealing && !revealAt) revealAt = now
      const elapsed = now - began
      const transit = ease(clamp((elapsed - 240) / 1570))
      const cx = width * .5, cy = height * .41
      const radius = Math.min(width * .22, height * .175, 165)
      const reveal = revealing ? ease(clamp((now - revealAt) / (ECLIPSE_REVEAL_MS - 60))) : 0
      const far = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) + 40
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#070b10'; ctx.fillRect(0, 0, width, height)
      for (const star of stars) {
        const opacity = (.14 + .2 * (.5 + .5 * Math.sin(elapsed * .001 + star.offset))) * (1 - reveal)
        circle(star.x * width, star.y * height, star.r, `rgba(207,223,229,${opacity})`)
      }
      // A faint orbital trace establishes the crossing path before totality.
      ctx.strokeStyle = `rgba(133,160,173,${.15 * (1 - reveal)})`; ctx.lineWidth = .6
      ctx.beginPath(); ctx.ellipse(cx, cy, radius * 2.1, radius * .76, -.23, 0, Math.PI * 2); ctx.stroke()
      ring(cx, cy, radius, (.2 + .8 * transit) * (1 - reveal), elapsed)
      // The illuminated disc appears, then the dark moon moves across it.
      const light = ctx.createRadialGradient(cx + radius * .25, cy - radius * .4, 0, cx, cy, radius)
      light.addColorStop(0, '#d0d9db'); light.addColorStop(.75, '#92a5b0'); light.addColorStop(1, '#596f81')
      ctx.globalAlpha = clamp(elapsed / 350) * (1 - reveal)
      circle(cx, cy, radius, light)
      ctx.save()
      ctx.beginPath(); ctx.arc(cx, cy, radius + .5, 0, Math.PI * 2); ctx.clip()
      circle(cx - (1 - transit) * radius * 1.83, cy + (1 - transit) * radius * .32, radius * 1.004, '#070b10')
      ctx.restore()
      ctx.globalAlpha = 1
      // A small warm bead at the rim completes the eclipse.
      const bead = Math.sin(clamp((transit - .6) / .4) * Math.PI) * .65
      if (bead > 0) {
        const bx = cx + radius * .96, by = cy + radius * .27
        const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 18)
        glow.addColorStop(0, `rgba(252,227,179,${bead})`); glow.addColorStop(1, 'rgba(252,227,179,0)')
        circle(bx, by, 18, glow)
      }
      if (revealing) {
        const aperture = far * reveal
        if (aperture > radius) ring(cx, cy, aperture, .4 * (1 - reveal), elapsed)
        ctx.globalCompositeOperation = 'destination-out'
        circle(cx, cy, aperture, '#000')
        ctx.globalCompositeOperation = 'source-over'
        if (reveal === 1) { ctx.clearRect(0, 0, width, height); return }
      }
      frame = requestAnimationFrame(draw)
    }
    const resume = () => {
      cancelAnimationFrame(frame)
      if (!document.hidden) frame = requestAnimationFrame(draw)
    }
    resize(); frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', resume)
    motion.addEventListener('change', resume)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', resume)
      motion.removeEventListener('change', resume)
    }
  }, [onUnavailable])
  return <canvas ref={ref} className={styles.eclipse} data-testid="prism-eclipse" aria-hidden="true" />
}
