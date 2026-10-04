'use client'

import { useEffect, useRef } from 'react'
import styles from './p3r-connection.module.scss'

export const WATER_ENTRY_MS = 1750
export const WATER_REVEAL_MS = 760
type Phase = 'opening' | 'covered' | 'revealing' | 'error'
const clamp = (n: number) => Math.min(1, Math.max(0, n))
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }
const seed = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

interface Ribbon {
  x: number
  top: number
  bottom: number
  width: number
  drift: number
  phase: number
  fill: string
  alpha?: number
  taper?: number
}

function waterRibbon(ctx: CanvasRenderingContext2D, ribbon: Ribbon) {
  if (ribbon.bottom <= ribbon.top) return
  const point = (u: number, side: number) => {
    const y = ribbon.top + (ribbon.bottom - ribbon.top) * u
    const wave = Math.sin(u * 7 + ribbon.phase) * ribbon.drift
      + Math.sin(u * 19 - ribbon.phase * 1.7) * ribbon.drift * .28
    const torn = 1 + Math.sin(u * 17 + ribbon.phase) * .14 + Math.sin(u * 43 - ribbon.phase) * .065
    const half = ribbon.width * (1 - u * (ribbon.taper ?? .42)) * torn
    return [ribbon.x + wave + side * half, y] as const
  }
  ctx.save()
  ctx.globalAlpha = ribbon.alpha ?? 1
  ctx.beginPath()
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 36; i++) {
      const u = side === -1 ? i / 36 : 1 - i / 36
      const [x, y] = point(u, side)
      if (side === -1 && i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  }
  ctx.closePath()
  ctx.fillStyle = ribbon.fill
  ctx.fill()
  ctx.restore()
}

function waterBlob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, alpha: number, id: number, rotation = 0) {
  ctx.save()
  ctx.globalAlpha = alpha
  const points = Array.from({ length: 16 }, (_, i) => {
    const angle = Math.PI * 2 * i / 16
    const radius = .86 + seed(id * 31 + i) * .26
    const dx = Math.cos(angle) * rx * radius
    const dy = Math.sin(angle) * ry * radius
    return [x + dx * Math.cos(rotation) - dy * Math.sin(rotation), y + dx * Math.sin(rotation) + dy * Math.cos(rotation)] as const
  })
  const midpoint = (a: readonly [number, number], b: readonly [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const
  ctx.beginPath()
  const start = midpoint(points.at(-1)!, points[0])
  ctx.moveTo(start[0], start[1])
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const next = points[(i + 1) % points.length]
    const middle = midpoint(point, next)
    ctx.quadraticCurveTo(point[0], point[1], middle[0], middle[1])
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

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
  const scale = Math.min(w, h)
  const fall = clamp(t / .62)
  const tip = -60 + (h * 1.15 + 60) * Math.pow(fall, 1.65)
  const center = (y: number) => w * .52 + Math.sin(y / h * 2.1 + t * 2) * Math.min(w * .018, 22)
  const trail = smooth((t - .06) / .34)
  const splash = smooth((t - .26) / .5)
  const impact = smooth((t - .36) / .28)
  const beforeSettle = 1 - smooth((t - .91) / .05)

  if (trail > 0) {
    const trailWidth = Math.min(w * .055, scale * .09) * (.45 + trail * .55)
    waterRibbon(ctx, {
      x: w * .52, top: -h * .16, bottom: tip + scale * .035, width: trailWidth * 1.65,
      drift: scale * .012, phase: 1.4 + t * 3, fill: '#58e5ff', alpha: .72,
    })
    waterRibbon(ctx, {
      x: w * .515, top: -h * .18, bottom: tip + scale * .025, width: trailWidth,
      drift: scale * .01, phase: 2.3 + t * 3, fill: '#d9fbff', alpha: .94,
    })
    waterRibbon(ctx, {
      x: w * .525, top: -h * .2, bottom: tip, width: trailWidth * .42,
      drift: scale * .008, phase: 3.1 + t * 3, fill: '#0b6cdf', alpha: .8,
    })
  }

  if (splash > 0) {
    const streams = w / h < .7
      ? [
          { x: .08, width: .16, delay: .34, phase: .7, drift: .055, reach: .76 },
          { x: .5, width: .19, delay: .22, phase: 4.1, drift: .072, reach: 1.08 },
          { x: .9, width: .15, delay: .3, phase: 7.4, drift: .062, reach: .82 },
        ]
      : [
          { x: .08, width: .09, delay: .35, phase: .7, drift: .055, reach: .72 },
          { x: .3, width: .105, delay: .28, phase: 2.2, drift: .038, reach: 1.12 },
          { x: .5, width: .13, delay: .22, phase: 4.1, drift: .064, reach: .82 },
          { x: .71, width: .095, delay: .33, phase: 5.8, drift: .046, reach: 1.14 },
          { x: .92, width: .085, delay: .26, phase: 7.4, drift: .058, reach: .76 },
        ]
    ctx.save()
    ctx.shadowColor = '#58e5ff'
    ctx.shadowBlur = Math.min(22, scale * .022) * impact
    streams.forEach((stream, index) => {
      const progress = smooth((t - stream.delay) / (.83 - stream.delay))
      if (progress <= 0) return
      const bottom = -h * .12 + h * 1.22 * progress * stream.reach
      const width = Math.min(w * stream.width, scale * (.12 + seed(index + 20) * .06))
      const x = w * stream.x + Math.sin(t * 5 + stream.phase) * scale * .018
      waterRibbon(ctx, {
        x, top: -h * .24, bottom, width: width * 1.3, drift: scale * stream.drift,
        phase: stream.phase + t * 4, fill: '#0878de', alpha: .5 * beforeSettle, taper: .52,
      })
      waterRibbon(ctx, {
        x: x + (seed(index + 9) - .5) * width * .36, top: -h * .27, bottom: bottom + scale * .025,
        width, drift: scale * stream.drift, phase: stream.phase + .8 + t * 4,
        fill: '#58e5ff', alpha: .82 * beforeSettle, taper: .47,
      })
      const paleX = x + (seed(index + 31) - .5) * width * .55
      if (index === 2) {
        waterRibbon(ctx, {
          x: paleX, top: -h * .3, bottom: bottom - scale * .01,
          width: width * .72, drift: scale * stream.drift * .82,
          phase: stream.phase + 1.7 + t * 4, fill: '#dbfbff', alpha: .88 * beforeSettle, taper: .58,
        })
      } else {
        for (let segment = 0; segment < 3; segment++) {
          const span = bottom + h * .24
          const start = -h * .24 + span * (segment * .29 + seed(index * 8 + segment + 70) * .08)
          const end = Math.min(bottom, start + span * (.18 + seed(index * 8 + segment + 90) * .16))
          waterRibbon(ctx, {
            x: paleX + (seed(index * 7 + segment + 110) - .5) * width * .55,
            top: start, bottom: end, width: width * (.56 + seed(index * 9 + segment + 130) * .3),
            drift: scale * stream.drift * .95, phase: stream.phase + segment * 1.3 + t * 4,
            fill: '#dbfbff', alpha: .94 * beforeSettle, taper: -.08,
          })
          waterBlob(ctx, paleX, end, width * .6, width * .34, '#dffcff', .86 * beforeSettle, index * 10 + segment + 310)
        }
      }
      if (index % 2 === 0) {
        waterRibbon(ctx, {
          x: x + (seed(index + 55) - .5) * width * .7, top: -h * .12, bottom: bottom - scale * .1,
          width: width * .14, drift: scale * stream.drift * .62,
          phase: stream.phase + 2.4 + t * 4, fill: '#148eea', alpha: .5 * beforeSettle, taper: .18,
        })
      }
    })
    ctx.restore()

    const topFoam = smooth((t - .34) / .28) * beforeSettle
    if (topFoam > 0) {
      ctx.save()
      ctx.shadowColor = '#aaf7ff'
      ctx.shadowBlur = Math.min(28, scale * .028)
      for (let i = 0; i < 10; i++) {
        const x = w * (-.03 + i * .12 + (seed(i + 120) - .5) * .055)
        const y = h * (-.035 + seed(i + 130) * .17)
        const rx = scale * (.055 + seed(i + 140) * .09)
        const ry = scale * (.06 + seed(i + 150) * .12)
        waterBlob(ctx, x, y, rx, ry, i % 3 === 0 ? '#baf7ff' : '#e3fcff', topFoam * .92, i + 210)
      }
      ctx.restore()
    }

    // Foam is embedded in the columns and impact front rather than tracing a
    // single outer perimeter.
    for (let i = 0; i < 30; i++) {
      const born = .3 + seed(i + 4) * .28
      const growth = smooth((t - born) / .25)
      if (growth <= 0) continue
      const column = i % streams.length
      const x = w * (streams[column].x + (seed(i + 10) - .5) * .14)
      const y = h * (-.03 + seed(i + 17) * .72) + splash * h * .11
      const rx = scale * (.025 + seed(i + 23) * .065) * growth
      const ry = rx * (.65 + seed(i + 29) * 1.25)
      const color = i % 4 === 0 ? '#58e5ff' : i % 3 === 0 ? '#baf7ff' : '#e1fcff'
      waterBlob(ctx, x, y, rx, ry, color, (.7 + seed(i + 12) * .28) * beforeSettle, i + 80)
    }
    ctx.save()
    ctx.shadowColor = '#8af1ff'
    ctx.shadowBlur = Math.min(24, scale * .024) * impact
    for (let i = 0; i < 16; i++) {
      const born = .41 + seed(i + 180) * .18
      const growth = smooth((t - born) / .24)
      if (growth <= 0) continue
      const side = i % 2 ? 1 : -1
      const x = w * .5 + side * w * (.05 + seed(i + 190) * .43) * impact
      const y = h * (.48 + seed(i + 200) * .44)
      const rx = scale * (.065 + seed(i + 210) * .12) * growth
      const ry = rx * (.32 + seed(i + 220) * .42)
      waterBlob(
        ctx, x, y, rx * 1.45, ry, i % 4 === 0 ? '#58e5ff' : '#dffcff',
        (.74 + seed(i + 230) * .24) * beforeSettle, i + 260, side * (-.55 + seed(i + 240) * .25),
      )
      if (i % 3 !== 0) {
        waterBlob(
          ctx, x - side * rx * .72, y + ry * .32, rx * .78, ry * .82, '#dffcff',
          .84 * beforeSettle, i + 360, side * (-.35 + seed(i + 250) * .2),
        )
      }
    }
    ctx.restore()
  }

  // Original silver, faceted pebble: no character or video texture.
  if (tip < h + 60 && t < .68) {
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
  for (let i = 0; i < 76; i++) {
    const born = .32 + seed(i + 4) * .36
    const age = (t - born) / .48
    if (age < 0 || age > 1) continue
    const side = i % 2 ? 1 : -1
    const spread = w * (.04 + seed(i + 15) * .43) * (impact * .65 + age * .35)
    const x = w * .52 + side * spread + Math.sin(i * 2.1) * scale * .02
    const y = h * (.5 + seed(i + 2) * .48) - age * h * (.04 + seed(i + 1) * .16)
    const radius = scale * (.004 + seed(i + 10) * .018) * (1 - age * .42)
    const alpha = (1 - age * .72) * beforeSettle
    if (i % 6 === 0) {
      waterBlob(ctx, x, y, radius * 1.35, radius, '#dffcff', alpha, i + 160)
    } else {
      ctx.strokeStyle = `rgba(222,250,255,${alpha})`
      ctx.lineWidth = Math.max(1.5, radius * .14)
      ctx.beginPath()
      ctx.ellipse(x, y, radius * (.72 + seed(i + 40) * .55), radius * (1 + seed(i + 41) * .8), -.25 + seed(i) * .5, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Keep the explosive frame translucent until the final beat, then land on
  // the exact opaque frame used by the route handshake.
  const wash = smooth((t - .7) / .24) * beforeSettle
  if (wash > 0) {
    ctx.save()
    ctx.globalAlpha = wash * .2
    ctx.fillStyle = '#0754e4'
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }
  const settle = smooth((t - .94) / .06)
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
