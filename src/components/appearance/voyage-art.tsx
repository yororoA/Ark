'use client'

import { useEffect, useRef } from 'react'
import { useAppearance } from './appearance-store'
import styles from './voyage-art.module.scss'

/** A single engraved plate, with light that follows the reader rather than an icon. */
export default function VoyageArt({ animated = true, compact = false, interactive = false }: {
  animated?: boolean
  compact?: boolean
  interactive?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { design } = useAppearance()
  useEffect(() => {
    const art = ref.current
    if (!art || compact || !animated || design !== 'voyage') return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = matchMedia('(pointer: fine)')
    const stage = art.closest('section') || art.parentElement || art
    let visible = false, frame = 0, x = 65, y = 50
    const awake = () => { art.dataset.awake = String(visible && !document.hidden && !motion.matches) }
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting || false; awake() }, { threshold: .02 })
    observer.observe(art)
    const paint = () => {
      frame = 0
      art.style.setProperty('--engraving-x', `${x}%`)
      art.style.setProperty('--engraving-y', `${y}%`)
    }
    const aim = (event: Event) => {
      if (!interactive || !visible || motion.matches || !pointer.matches) return
      const point = event as PointerEvent
      const bounds = art.getBoundingClientRect()
      x = (point.clientX - bounds.left) / bounds.width * 100
      y = (point.clientY - bounds.top) / bounds.height * 100
      art.dataset.aiming = 'true'
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const leave = () => { art.dataset.aiming = 'false' }
    const preference = () => { leave(); awake() }
    stage.addEventListener('pointermove', aim)
    stage.addEventListener('pointerleave', leave)
    document.addEventListener('visibilitychange', preference)
    motion.addEventListener('change', preference)
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame)
      stage.removeEventListener('pointermove', aim); stage.removeEventListener('pointerleave', leave)
      document.removeEventListener('visibilitychange', preference); motion.removeEventListener('change', preference)
      art.dataset.awake = 'false'; art.dataset.aiming = 'false'
    }
  }, [animated, compact, design, interactive])

  return <div ref={ref} className={styles.art} data-animated={animated} data-compact={compact} aria-hidden="true">
    <div className={styles.drift}>
      <div className={styles.plate} />
      {interactive && <div className={`${styles.plate} ${styles.light}`} />}
    </div>
  </div>
}
