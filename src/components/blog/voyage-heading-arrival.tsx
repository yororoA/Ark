'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { usePathname } from 'next/navigation'
import { useAppearance } from '@/components/appearance/appearance-store'
import styles from './voyage-heading-arrival.module.scss'

type HeadingRefs = {
  headingRef: RefObject<HTMLElement | null>
  indexRef: RefObject<HTMLSpanElement | null>
  titleRef: RefObject<HTMLHeadingElement | null>
}

// The travelling ink belongs to the heading's existing rules. Content never
// waits for it, and the route curtain remains the only navigation coordinator.
export default function VoyageHeadingArrival({ headingRef, indexRef, titleRef }: HeadingRefs) {
  const { design } = useAppearance()
  const pathname = usePathname()
  const svgRef = useRef<SVGSVGElement>(null)
  const railRef = useRef<SVGPathElement>(null)
  const trailRef = useRef<SVGPathElement>(null)
  const terminalRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const svg = svgRef.current, heading = headingRef.current, index = indexRef.current, title = titleRef.current
    const rail = railRef.current, trail = trailRef.current, terminal = terminalRef.current
    if (design !== 'voyage' || !svg || !heading || !index || !title || !rail || !trail || !terminal) return

    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let played = false, inView = false, geometry = ''
    let animations: Animation[] = []
    svg.dataset.arrival = 'waiting'
    const stop = () => {
      played = true
      svg.dataset.arrival = 'settled'
      animations.forEach(animation => animation.cancel())
      animations = []
    }
    const start = () => {
      if (played || !geometry || !inView) return
      if (document.hidden || motion.matches) { stop(); return }
      // A mounted destination can spend an arbitrary time under the cover.
      // Observe its actual removal rather than guessing with a route timer.
      if (document.documentElement.dataset.voyageWipe) return
      played = true
      svg.dataset.arrival = 'running'
      const stroke = trail.animate([
        { strokeDashoffset: '.12', opacity: 0, offset: 0 },
        { opacity: 1, offset: .1 },
        { opacity: 1, offset: .78 },
        { strokeDashoffset: '-1', opacity: 0, offset: 1 },
      ], { duration: 620, easing: 'cubic-bezier(.22,.65,.3,1)' })
      const arrival = terminal.animate([
        { opacity: .28, transform: 'scaleY(1)' },
        { opacity: 1, transform: 'scaleY(1.8)', offset: .35 },
        { opacity: .28, transform: 'scaleY(1)' },
      ], { duration: 250, delay: 370, easing: 'ease-out' })
      animations = [stroke, arrival]
      void stroke.finished.then(stop, () => {})
    }
    const measure = () => {
      const bounds = heading.getBoundingClientRect(), viewport = svg.getBoundingClientRect(), mark = index.getBoundingClientRect()
      const word = (title.firstElementChild || title).getBoundingClientRect()
      if (!bounds.width || !bounds.height || !mark.width) return
      const x = mark.left - bounds.left + mark.width / 2
      const y = mark.top - bounds.top + mark.height / 2
      const radius = Math.max(0, mark.width / 2 - .5)
      const bottom = bounds.height - .5
      const end = Math.min(bounds.width - 8, Math.max(x + 72, Math.min(word.right - bounds.left + 40, bounds.width * .62)))
      const next = `${x},${y},${radius},${bottom},${end}`
      if (next !== geometry) {
        if (geometry && svg.dataset.arrival === 'running') stop()
        geometry = next
        // The absolute SVG's viewport excludes the heading's bottom border.
        // Match that viewport so SVG's default aspect fitting cannot offset
        // the route horizontally by half of the missing border's scaled width.
        svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`)
        rail.setAttribute('d', `M ${x} ${y + radius} V ${bottom} H ${end}`)
        trail.setAttribute('d', `M ${x + radius} ${y} A ${radius} ${radius} 0 0 1 ${x} ${y + radius} V ${bottom} H ${end}`)
        terminal.setAttribute('d', `M ${end} ${bottom - 3} V ${bottom + 1}`)
      }
      inView = bounds.bottom > 0 && bounds.top < innerHeight && bounds.right > 0 && bounds.left < innerWidth
      start()
    }
    const curtain = new MutationObserver(() => {
      if (document.documentElement.dataset.voyageWipe) {
        if (svg.dataset.arrival === 'running') stop()
      } else start()
    })
    curtain.observe(document.documentElement, { attributes: true, attributeFilter: ['data-voyage-wipe'] })
    const visibility = new IntersectionObserver(([entry]) => {
      inView = !!entry?.isIntersecting
      if (!inView && svg.dataset.arrival === 'running') stop()
      else start()
    }, { threshold: 0 })
    visibility.observe(heading)
    const resize = new ResizeObserver(measure)
    resize.observe(heading); resize.observe(index); resize.observe(title)
    const simplify = () => { if (document.hidden || motion.matches) stop() }
    document.addEventListener('visibilitychange', simplify)
    motion.addEventListener('change', simplify)
    window.addEventListener('popstate', stop)
    measure()
    simplify()
    return () => {
      curtain.disconnect(); visibility.disconnect(); resize.disconnect()
      document.removeEventListener('visibilitychange', simplify)
      motion.removeEventListener('change', simplify)
      window.removeEventListener('popstate', stop)
      stop()
    }
  }, [design, pathname, headingRef, indexRef, titleRef])

  return design === 'voyage' ? <svg ref={svgRef} className={styles.arrival} aria-hidden="true" focusable="false" data-voyage-heading-arrival data-arrival="waiting">
    <path ref={railRef} className={styles.rail} />
    <path ref={trailRef} className={styles.trail} pathLength="1" />
    <path ref={terminalRef} className={styles.terminal} />
  </svg> : null
}
