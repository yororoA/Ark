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
    let visible = false, frame = 0
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const finePointer = matchMedia('(pointer: fine)')
    // Large scenes lean toward the pointer in depth; heading bands stay still.
    const followsPointer = variant !== 'heading'
    const target = { x: 0, y: 0 }, current = { x: 0, y: 0 }
    const apply = () => {
      node.style.setProperty('--parallax-x', current.x.toFixed(4))
      node.style.setProperty('--parallax-y', current.y.toFixed(4))
    }
    const settle = () => {
      current.x += (target.x - current.x) * .09
      current.y += (target.y - current.y) * .09
      apply()
      const resting = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) < .002
      frame = resting ? 0 : requestAnimationFrame(settle)
    }
    const update = () => {
      const moving = visible && !document.hidden && !media.matches
      node.dataset.moving = String(moving)
      if (!media.matches) return
      cancelAnimationFrame(frame)
      frame = 0
      target.x = target.y = current.x = current.y = 0
      apply()
    }
    // A scene beneath a modal layer, such as the menu or the blurred login
    // overlay, cannot be seen moving; leave it still instead of repainting.
    const beneathModal = () => !!node.closest('[inert]') || (!!document.querySelector('dialog:modal') && !node.closest('dialog:modal'))
    const pointer = (event: PointerEvent) => {
      const tracksPointer = node.dataset.moving === 'true' && finePointer.matches && event.pointerType !== 'touch' && !beneathModal()
      if (!tracksPointer) return
      target.x = event.clientX / innerWidth * 2 - 1
      target.y = event.clientY / innerHeight * 2 - 1
      if (!frame) frame = requestAnimationFrame(settle)
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() })
    observer.observe(node)
    document.addEventListener('visibilitychange', update)
    media.addEventListener('change', update)
    if (followsPointer) window.addEventListener('pointermove', pointer, { passive: true })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', update)
      media.removeEventListener('change', update)
      window.removeEventListener('pointermove', pointer)
      node.dataset.moving = 'false'
    }
  }, [design, variant])
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
