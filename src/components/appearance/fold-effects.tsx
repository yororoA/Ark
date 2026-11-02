'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAppearance } from './appearance-store'
import { useRainConnection } from './rain-connection-store'
import { FOLD_TRANSITION_EVENT, handOffUnderFold, type FoldTransitionRequest } from './fold-transition'
import { observeFoldPalette, readFoldPalette } from './fold-palette'
import styles from './fold-effects.module.scss'

const COVER_MS = 440
const REVEAL_MS = 700
const FALLBACK_MS = 9000
const ease = (t: number) => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
const clamp = (n: number) => Math.max(0, Math.min(1, n))

export default function FoldEffects() {
  const { design } = useAppearance()
  const path = usePathname()
  const layerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const committed = useRef<(() => void) | null>(null)
  useEffect(() => { committed.current?.() }, [path])

  useEffect(() => {
    const layer = layerRef.current, canvas = canvasRef.current
    if (design !== 'fold' || !layer || !canvas) return
    const paint = canvas.getContext('2d')
    if (!paint) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, timer = 0, width = 0, height = 0
    let active = false
    let palette = readFoldPalette()
    const stopPalette = observeFoldPalette(next => { palette = next })
    let pending: FoldTransitionRequest | null = null
    const phase = (value: 'idle' | 'closing' | 'covered' | 'opening') => {
      layer.dataset.phase = value
      if (value === 'idle') delete document.documentElement.dataset.foldWipe
      else document.documentElement.dataset.foldWipe = value
    }
    const resize = () => {
      width = innerWidth; height = innerHeight
      const dpr = Math.min(devicePixelRatio || 1, 1.75)
      canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr)
      paint.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const clear = () => {
      cancelAnimationFrame(frame); clearTimeout(timer)
      pending = null; active = false; committed.current = null
      phase('idle')
      paint.clearRect(0, 0, width, height)
      if (layer.hidePopover && layer.matches(':popover-open')) layer.hidePopover()
    }
    const skip = () => {
      const request = pending
      clear()
      try { if (request?.navigate) handOffUnderFold(request.navigate) } catch { request?.fallback?.() }
    }
    const polygon = (points: number[][], color: string) => {
      paint.beginPath()
      points.forEach(([x, y], index) => index ? paint.lineTo(x, y) : paint.moveTo(x, y))
      paint.closePath(); paint.fillStyle = color; paint.fill()
    }

    const start = (detail: FoldTransitionRequest) => {
      clear(); resize()
      active = true; pending = detail; phase('closing')
      try { layer.showPopover?.() } catch { /* Fixed layer remains usable. */ }
      const began = performance.now()
      const direction = detail.x < width * .5 ? 1 : -1
      let coveredAt = 0, ready = false, openedAt = 0

      // The four adjoining sloped panels tile the viewport. One-pixel overlaps
      // prevent antialiasing seams; no navigation occurs until all are closed.
      const drawPanels = (progress: number, opening: boolean) => {
        const colors = [palette.carbon, palette.slate, palette.paper, palette.mist]
        const creases = [palette.slate, palette.mist, palette.line, palette.carbon]
        const skew = width * .16 * direction
        const boundary = (index: number, y: number) => {
          if (index === 0) return -width * .8
          if (index === 4) return width * 1.8
          return width * index / 4 + (y / height - .5) * skew * 2
        }
        const delays = opening ? [.22, .08, 0, .14] : [0, .14, .08, .2]
        for (let index = 0; index < 4; index++) {
          const travel = (opening ? ease(clamp((progress - delays[index]) / (1 - delays[index]))) : 1 - ease(clamp((progress - delays[index]) / (1 - delays[index]))))
          const sign = (index % 2 ? -1 : 1) * direction
          const dx = sign * width * .38 * travel
          const dy = sign * height * 1.4 * travel
          const top = -height * .12, bottom = height * 1.12
          const leftTop = boundary(index, top) - 1, rightTop = boundary(index + 1, top) + 1
          const leftBottom = boundary(index, bottom) - 1, rightBottom = boundary(index + 1, bottom) + 1
          paint.save(); paint.translate(dx, dy)
          polygon([[leftTop, top], [rightTop, top], [rightBottom, bottom], [leftBottom, bottom]], colors[index])
          const ridge = Math.min(width * .035, 54)
          polygon([[rightTop - ridge, top], [rightTop, top], [rightBottom, bottom], [rightBottom - ridge * 2, bottom]], creases[index])
          if (index === 1) {
            polygon([[rightTop - 3, top], [rightTop + 7, top], [rightBottom + 2, bottom], [rightBottom - 9, bottom]], palette.signal)
          }
          // A narrow parallel cut gives the pale panel a visible folded edge.
          if (index === 2) {
            const inset = width * .045
            polygon([[leftTop + inset, top], [leftTop + inset + 2, top], [leftBottom + inset + 2, bottom], [leftBottom + inset, bottom]], palette.line)
          }
          paint.restore()
        }
      }
      const handoff = () => {
        const request = pending
        pending = null
        committed.current = () => { ready = true; committed.current = null }
        try {
          const navigated = request?.navigate ? handOffUnderFold(request.navigate) : false
          if (!navigated) { ready = true; committed.current = null }
          else timer = window.setTimeout(() => {
            if (!request?.fallback) { clear(); return }
            try { request.fallback() } catch { clear() }
          }, FALLBACK_MS)
        } catch { clear(); request?.fallback?.(); return false }
        return true
      }
      const draw = (now: number) => {
        paint.clearRect(0, 0, width, height)
        if (!coveredAt && now - began < COVER_MS) drawPanels((now - began) / COVER_MS, false)
        else {
          if (!coveredAt) {
            drawPanels(1, false)
            coveredAt = now; phase('covered')
            if (!handoff()) return
          }
          const waitingForContent = !!document.querySelector('[data-route-loading], #main-content:empty')
          if (!openedAt && ready && !waitingForContent && now - coveredAt >= 65) {
            openedAt = now; clearTimeout(timer); phase('opening')
          }
          if (openedAt) {
            const progress = Math.min(1, (now - openedAt) / REVEAL_MS)
            drawPanels(progress, true)
            if (progress === 1) { clear(); return }
          } else drawPanels(1, false)
        }
        frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
    }
    const request = (event: Event) => {
      if (motion.matches || document.hidden || useRainConnection.getState().connection) return
      event.preventDefault()
      const detail = (event as CustomEvent<FoldTransitionRequest>).detail
      if (!active || layer.dataset.phase === 'opening') start(detail)
      else if (pending && detail.navigate) pending = detail
    }
    const key = (event: KeyboardEvent) => { if (active && event.key === 'Escape') skip() }
    const preference = () => { if (motion.matches) skip() }
    const visibility = () => { if (document.hidden) skip() }
    const unsubscribe = useRainConnection.subscribe(({ connection }) => { if (connection) clear() })
    document.addEventListener(FOLD_TRANSITION_EVENT, request)
    document.addEventListener('keydown', key)
    document.addEventListener('visibilitychange', visibility)
    motion.addEventListener('change', preference)
    window.addEventListener('resize', resize)
    return () => {
      unsubscribe(); stopPalette(); document.removeEventListener(FOLD_TRANSITION_EVENT, request)
      document.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', visibility)
      motion.removeEventListener('change', preference); window.removeEventListener('resize', resize)
      skip()
    }
  }, [design])

  return design === 'fold' ? <div ref={layerRef} className={styles.layer} popover="manual" data-testid="fold-wipe" data-phase="idle" aria-hidden="true"><canvas ref={canvasRef} /></div> : null
}
