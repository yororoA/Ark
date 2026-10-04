'use client'

import { useEffect, useRef } from 'react'
import { useAppearance } from './appearance-store'
import styles from './p3r-scene.module.scss'

// Original geometry informed by the water, moon and window compositions in the
// reference. No traced frames, character art, video textures or external assets.
export default function P3RScene({ variant = 'hero' }: { variant?: 'hero' | 'menu' | 'login' | 'heading' }) {
  const ref = useRef<HTMLDivElement>(null)
  const { design } = useAppearance()
  useEffect(() => {
    const node = ref.current
    if (!node || design !== 'p3r') return
    let visible = false
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { node.dataset.moving = String(visible && !document.hidden && !media.matches) }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() })
    observer.observe(node)
    document.addEventListener('visibilitychange', update)
    media.addEventListener('change', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
      media.removeEventListener('change', update)
      node.dataset.moving = 'false'
    }
  }, [design])
  return <div ref={ref} className={styles.scene} data-variant={variant} aria-hidden="true">
    <div className={styles['light-field']} />
    <div className={styles.moon}><i /><i /><i /></div>
    <div className={styles['window-plane']}><i /><i /><i /><i /></div>
    <div className={styles.current}>
      <svg viewBox="0 0 1600 750" preserveAspectRatio="none">
        <path d="M-160 235C120 60 220 415 500 260S870 8 1110 134 1480 215 1710 20L1710 800H-160Z" />
        <path d="M-160 357C145 148 221 477 560 312S917 158 1198 229 1485 356 1710 164L1710 800H-160Z" />
        <path d="M-160 509C74 248 306 610 620 439S951 291 1235 366 1445 476 1710 332L1710 800H-160Z" />
        <path d="M-160 656C119 475 316 707 617 541S1006 512 1220 548 1510 602 1710 442L1710 800H-160Z" />
      </svg>
    </div>
    <div className={styles.ripples}><i /><i /><i /></div>
    <div className={styles.shards}><i /><i /><i /><i /><i /></div>
  </div>
}
