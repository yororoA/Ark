'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'
import styles from './voyage-gallery.module.scss'

type Bounds = { left: number; top: number; width: number; height: number }
export type VoyageMediaOrigin = {
  mediaUrl: string
  bounds: Bounds
  viewport: { width: number; height: number }
}

// The contact sheet keeps each image's natural aspect ratio. Capture the
// rendered image itself, not the larger mat or its surrounding caption.
export function captureVoyageMediaOrigin(image: HTMLImageElement | null, mediaUrl: string): VoyageMediaOrigin | undefined {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return
  const { left, top, width, height } = image.getBoundingClientRect()
  if (width < 1 || height < 1 || left >= innerWidth || top >= innerHeight || left + width <= 0 || top + height <= 0) return
  if (Math.abs(width / height / (image.naturalWidth / image.naturalHeight) - 1) > .025) return
  return { mediaUrl, bounds: { left, top, width, height }, viewport: { width: innerWidth, height: innerHeight } }
}

/** A visual bridge only. The native dialog opens immediately and every input
 * takes over from the flight before the existing pan/zoom handlers run. */
export function useVoyageGalleryTransition({ origin, mediaRef, mediaUrl, isImage }: {
  origin?: VoyageMediaOrigin
  mediaRef: RefObject<HTMLDivElement | null>
  mediaUrl: string
  isImage: boolean
}) {
  const attempted = useRef(false)
  useLayoutEffect(() => {
    if (attempted.current || !origin || !isImage || origin.mediaUrl !== mediaUrl || document.documentElement.dataset.design !== 'voyage') return
    const stage = mediaRef.current
    const target = stage?.querySelector('img')
    const dialog = stage?.closest('dialog')
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    if (!stage || !target || !dialog || motion.matches || document.hidden
      || origin.viewport.width !== innerWidth || origin.viewport.height !== innerHeight) {
      attempted.current = true
      return
    }

    let frame = 0, finished = false, started = false
    let flight: HTMLDivElement | null = null
    let animation: Animation | null = null
    let observedBounds: Bounds | null = null
    const originalVisibility = target.style.visibility
    // This runs before showModal's passive effect, so the full-size image does
    // not flash for a frame before its smaller visual counterpart arrives.
    target.style.visibility = 'hidden'
    dialog.dataset.mediaSpatialEntry = 'pending'

    const cleanup = () => {
      if (finished) return
      finished = true
      cancelAnimationFrame(frame)
      animation?.cancel(); flight?.remove()
      target.style.visibility = originalVisibility
      if (started) dialog.dataset.mediaSpatialEntry = 'complete'
      else delete dialog.dataset.mediaSpatialEntry
      openObserver.disconnect(); resizeObserver.disconnect(); appearanceObserver.disconnect()
      dialog.removeEventListener('pointerdown', finish, true)
      dialog.removeEventListener('wheel', finish, true)
      window.removeEventListener('keydown', finish, true)
      window.removeEventListener('resize', finish)
      window.visualViewport?.removeEventListener('resize', finish)
      window.visualViewport?.removeEventListener('scroll', finish)
      document.removeEventListener('visibilitychange', simplify)
      motion.removeEventListener('change', simplify)
    }
    const finish = () => { attempted.current = true; cleanup() }
    const simplify = () => { if (document.hidden || motion.matches) finish() }
    const start = () => {
      frame = 0
      attempted.current = true
      if (finished || !dialog.open) { finish(); return }
      // A slow or failed image uses the ordinary load feedback. Never wait for
      // decoding to begin an animation long after the user has opened it.
      if (!target.complete || !target.naturalWidth || !target.naturalHeight) { finish(); return }
      const bounds = target.getBoundingClientRect()
      const source = origin.bounds
      if (bounds.width < 1 || bounds.height < 1 || Math.abs(source.width / source.height / (bounds.width / bounds.height) - 1) > .025) { finish(); return }
      const x = source.left - bounds.left, y = source.top - bounds.top
      const sx = source.width / bounds.width, sy = source.height / bounds.height
      observedBounds = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }
      flight = document.createElement('div')
      flight.className = styles.mediaFlight
      flight.setAttribute('aria-hidden', 'true')
      flight.dataset.voyageMediaFlight = ''
      Object.assign(flight.style, {
        left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`,
        backgroundImage: `url(${JSON.stringify(target.currentSrc || target.src)})`,
      })
      // A direct dialog child belongs to its native top layer and escapes the
      // pan canvas's transform and clipping. It never intercepts controls.
      dialog.appendChild(flight)
      started = true
      target.dataset.mediaSpatialEntry = 'complete'
      dialog.dataset.mediaSpatialEntry = 'running'
      animation = flight.animate([
        { transform: `translate(${x}px, ${y}px) scale(${sx}, ${sy})` },
        { transform: 'translate(0, 0) scale(1, 1)' },
      ], { duration: 300, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' })
      void animation.finished.then(finish, () => {})
      resizeObserver.observe(stage)
    }
    const ready = () => {
      if (finished) return
      if (!dialog.open) { if (started) finish(); return }
      if (!frame && !started) frame = requestAnimationFrame(start)
    }
    const openObserver = new MutationObserver(ready)
    const resizeObserver = new ResizeObserver(() => {
      if (!observedBounds) return
      const bounds = target.getBoundingClientRect()
      if (Object.entries(observedBounds).some(([key, value]) => Math.abs(bounds[key as keyof Bounds] - value) > .5)) finish()
    })
    const appearanceObserver = new MutationObserver(() => { if (document.documentElement.dataset.design !== 'voyage') finish() })
    openObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] })
    appearanceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-design'] })
    dialog.addEventListener('pointerdown', finish, true)
    dialog.addEventListener('wheel', finish, { capture: true, passive: true })
    window.addEventListener('keydown', finish, true)
    window.addEventListener('resize', finish)
    window.visualViewport?.addEventListener('resize', finish)
    window.visualViewport?.addEventListener('scroll', finish)
    document.addEventListener('visibilitychange', simplify)
    motion.addEventListener('change', simplify)
    ready()
    // Strict Mode may clean up before the first frame and then set up again.
    // Only an actual start or user interruption consumes the one entrance.
    return cleanup
  }, [origin, mediaRef, mediaUrl, isImage])
}
