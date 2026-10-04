'use client'

import { useEffect, useRef } from 'react'
import styles from './p3r-connection.module.scss'

export const WATER_ENTRY_MS = 1750
export const WATER_REVEAL_MS = 760
type Phase = 'opening' | 'covered' | 'revealing' | 'error'
const clamp = (n: number) => Math.min(1, Math.max(0, n))
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }
const seed = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

function underwater(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0754e4'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#06369e'
  ctx.beginPath()
  ctx.moveTo(w * .28, 0)
  ctx.bezierCurveTo(w * .76, h * .32, w * .24, h * .6, w * .56, h)
  ctx.lineTo(0, h); ctx.lineTo(0, 0); ctx.fill()
  ctx.strokeStyle = '#168dff'
  ctx.lineWidth = 2
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.ellipse(w * .56, -h * .12, w * (.48 + i * .19), h * (.3 + i * .12), -.2, 0, Math.PI)
    ctx.stroke()
  }
}

function entry(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const tip = -65 + (h * 2.5 + 65) * Math.pow(clamp(t / .96), 1.8)
  const mouth = w * 2.2 * Math.pow(clamp((t - .12) / .88), 2) + 12
  const top = -h * .3
  const center = (y: number) => w * .53 + Math.sin(y / h * 1.5) * Math.min(w * .055, 60)
  const edge = (u: number, side: number, scale = 1) => {
    const y = top + (tip - top) * u
    const taper = Math.pow(1 - u, .73)
    const uneven = 1 + Math.sin(u * 23 + t * 6 + side) * .055 + Math.sin(u * 57 - t * 3) * .025
    return [center(y) + side * mouth * taper * uneven * scale, y] as const
  }
  const wake = (scale: number, fill: string, stroke?: string, lineWidth = 0) => {
    ctx.beginPath()
    for (const side of [-1, 1]) {
      for (let i = 0; i <= 64; i++) {
        const u = side === -1 ? i / 64 : 1 - i / 64
        const [x, y] = edge(u, side, scale)
        if (side === -1 && i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
    }
    ctx.closePath()
    ctx.fillStyle = fill; ctx.fill()
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke() }
  }
  if (t > .12) {
    ctx.lineJoin = 'round'
    wake(1, '#0754e4', '#58e5ff', Math.min(w * .04, 30))
    wake(1, '#0754e4', '#f4fbff', Math.min(w * .012, 9))
    wake(.72, '#0640b2')
    wake(.39, '#032369')
    // Broad torn ribbons give the wake volume, with unequal lengths on each
    // side. Their tips stretch into the falling stone's narrow pressure trail.
    for (const side of [-1, 1]) {
      for (const outer of [true, false]) {
        ctx.beginPath()
        for (const bank of [-1, 1]) for (let i = 0; i <= 40; i++) {
          const step = bank === -1 ? i / 40 : 1 - i / 40
          const u = .03 + step * (side === -1 ? .88 : .8)
          const [x, y] = edge(u, side, side === -1 ? .86 : .68)
          const torn = 1 + Math.sin(u * 39 + side + t * 7) * .24 + Math.sin(u * 87) * .12
          const half = Math.min(w * .07, 95, mouth * .22) * Math.pow(1 - step, .65) * torn * (outer ? 1.35 : .8)
          const px = x + bank * half
          if (bank === -1 && i === 0) ctx.moveTo(px, y)
          else ctx.lineTo(px, y)
        }
        ctx.closePath()
        ctx.fillStyle = outer ? '#58e5ff' : '#c8faff'
        ctx.fill()
      }
    }
    // Broken, elongated foam streaks along both edges; not a uniform outline.
    for (let i = 0; i < 30; i++) {
      const side = i % 2 ? 1 : -1
      const u = .1 + seed(i + 7) * .83
      const [x, y] = edge(u, side, 1 + seed(i + 3) * .13)
      const length = (12 + seed(i + 19) * 70) * clamp(t * 2)
      ctx.fillStyle = i % 3 === 0 ? '#58e5ff' : '#c8faff'
      ctx.beginPath()
      ctx.ellipse(x, y, 3 + seed(i + 2) * Math.min(w * .022, 18), length, side * -.14, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // Original silver, faceted pebble: no character or video texture.
  if (tip < h + 60) {
    ctx.save()
    ctx.translate(center(tip), tip)
    ctx.rotate(.3 + t * 4)
    const size = Math.max(13, Math.min(w * .024, 26))
    ctx.scale(size, size)
    ctx.fillStyle = '#e3f3ff'
    ctx.strokeStyle = '#032369'; ctx.lineWidth = .07
    ctx.beginPath()
    ctx.moveTo(-.72, -.4); ctx.lineTo(-.1, -.9); ctx.lineTo(.65, -.62)
    ctx.lineTo(.9, .1); ctx.lineTo(.24, .95); ctx.lineTo(-.6, .58)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#82aaca'
    ctx.beginPath(); ctx.moveTo(-.6, .58); ctx.lineTo(.04, -.12); ctx.lineTo(.9, .1)
    ctx.lineTo(.24, .95); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.moveTo(-.72, -.4); ctx.lineTo(-.1, -.9); ctx.lineTo(.04, -.12)
    ctx.closePath(); ctx.fill()
    ctx.restore()
  }
  for (let i = 0; i < 44; i++) {
    const born = .18 + seed(i + 4) * .56
    const age = (t - born) / .65
    if (age < 0 || age > 1) continue
    const y0 = -65 + (h * 2.5 + 65) * Math.pow(born / .96, 1.8)
    const x = center(y0) + (i % 2 ? 1 : -1) * (18 + age * w * (.15 + seed(i) * .55))
    const y = y0 - age * h * (.16 + seed(i + 1) * .24)
    const radius = (2 + seed(i + 10) * 10) * (1 - age * .55)
    ctx.strokeStyle = `rgba(222,250,255,${1 - age * .8})`
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.ellipse(x, y, radius, radius * 1.6, -.15, 0, Math.PI * 2); ctx.stroke()
  }
  // End on exactly the same opaque frame used by the route handshake.
  const settle = smooth((t - .91) / .09)
  if (settle > 0) { ctx.globalAlpha = settle; underwater(ctx, w, h); ctx.globalAlpha = 1 }
}

function reveal(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  underwater(ctx, w, h)
  const progress = smooth(t)
  const edge = (y: number, side: number) => {
    const shift = Math.sin(y / h * 5 + t * 2) * w * .025 * Math.sin(t * Math.PI)
    return w * .53 + shift + side * w * .8 * Math.pow(progress, .8 + y / h * .35)
  }
  ctx.beginPath()
  for (const side of [-1, 1]) for (let i = 0; i <= 48; i++) {
    const y = (side === -1 ? i / 48 : 1 - i / 48) * h
    const x = edge(y, side)
    if (side === -1 && i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.strokeStyle = '#58e5ff'; ctx.lineWidth = 16 * (1 - progress); ctx.stroke()
  ctx.strokeStyle = '#f4fbff'; ctx.lineWidth = 5 * (1 - progress); ctx.stroke()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}

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
      if (phase === 'opening') entry(context, w, h, t)
      else if (phase === 'revealing') reveal(context, w, h, t)
      else underwater(context, w, h)
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
