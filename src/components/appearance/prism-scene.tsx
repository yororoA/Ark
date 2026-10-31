'use client'

import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { useAppearance } from './appearance-store'
import { SPECTRUM } from '@/lib/prism-copy'
import styles from './prism-scene.module.scss'

export function PrismOptics({ className, animated = true, compact = false, selectedBand }: {
  className?: string; animated?: boolean; compact?: boolean; selectedBand?: number
}) {
  const id = useId().replaceAll(':', '')
  return <svg viewBox={compact ? '340 70 560 450' : '0 0 1200 620'} fill="none" className={className} data-animated={animated}>
    <defs>
      <linearGradient id={`${id}-inside`} x1="508" y1="304" x2="744" y2="323" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--ark-prism-ray)" stopOpacity=".7" />
        <stop offset="1" stopColor="var(--ark-prism-ray)" stopOpacity=".1" />
      </linearGradient>
    </defs>
    <g className={styles['incident-beam']}>
      <path d="M-1600 994L508 304" stroke="var(--ark-prism-ray)" strokeWidth="1.5" />
      <path d="M-1600 998L508 305" stroke="var(--ark-prism-ray)" strokeWidth=".5" opacity=".28" />
    </g>
    <g className={styles['prism-body']}>
      <path d="M620 110L400 490H840Z" fill="var(--ark-prism-ray)" fillOpacity=".018" stroke="var(--ark-prism-edge)" strokeWidth="1.2" />
      <path d="M620 116L405 487H835Z" stroke="var(--ark-prism-edge)" strokeOpacity=".25" strokeWidth=".6" />
      <path className={styles['inside-light']} d="M508 304L732 304L754 342Z" fill={`url(#${id}-inside)`} />
    </g>
    <g className={styles.spectrum} data-selectable={selectedBand !== undefined}>
      {SPECTRUM.map((color, index) => {
        const y1 = 304 + index * 6.33, y2 = y1 + 6.5
        const x1 = 620 + (y1 - 110) * 220 / 380, x2 = 620 + (y2 - 110) * 220 / 380
        const far1 = y1 + (2300 - x1) * (123 + index * 40 - y1) / (1230 - x1)
        const far2 = y2 + (2300 - x2) * (164 + index * 40 - y2) / (1230 - x2)
        return <path key={color} data-lit={selectedBand !== undefined && index === selectedBand % SPECTRUM.length} style={{ '--band': index } as CSSProperties}
          d={`M${x1} ${y1}L2300 ${far1}V${far2}L${x2} ${y2}Z`} fill={color} />
      })}
    </g>
    <path className={styles.glint} d="M620 110L400 490H840Z" stroke="var(--ark-prism-ray)" strokeWidth="1.8" pathLength="1" />
  </svg>
}

// The hero owns pointer parallax; its optical geometry is also shared by the
// appearance preview so the two compositions cannot drift apart.
export default function PrismScene({ variant = 'hero' }: { variant?: 'hero' | 'heading' | 'login' | 'connection' | 'menu' }) {
  const ref = useRef<HTMLDivElement>(null)
  const { design } = useAppearance()
  useEffect(() => {
    const node = ref.current
    if (!node || design !== 'prism' || variant !== 'hero') return
    const media = matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)')
    const parent = node.parentElement
    let frame = 0, x = 0, y = 0
    const reset = () => {
      cancelAnimationFrame(frame)
      node.style.removeProperty('--prism-x')
      node.style.removeProperty('--prism-y')
      node.style.removeProperty('--prism-tilt')
    }
    const move = (event: PointerEvent) => {
      const canMove = media.matches && event.pointerType === 'mouse' && !parent?.closest('[inert]') && !document.querySelector('dialog[open]')
      if (!canMove) return
      const box = parent!.getBoundingClientRect()
      x = (event.clientX - box.left) / box.width - .5
      y = (event.clientY - box.top) / box.height - .5
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        node.style.setProperty('--prism-x', `${x * 14}px`)
        node.style.setProperty('--prism-y', `${y * 10}px`)
        node.style.setProperty('--prism-tilt', `${x * 2.4}deg`)
      })
    }
    parent?.addEventListener('pointermove', move)
    parent?.addEventListener('pointerleave', reset)
    media.addEventListener('change', reset)
    return () => {
      reset()
      parent?.removeEventListener('pointermove', move)
      parent?.removeEventListener('pointerleave', reset)
      media.removeEventListener('change', reset)
    }
  }, [design, variant])

  if (variant === 'heading') return <div className={styles.scene} data-prism-scene="heading" aria-hidden="true">
    <svg className={styles['chapter-optics']} viewBox="0 0 500 240" fill="none">
      <circle cx="330" cy="112" r="78" stroke="var(--ark-prism-edge)" strokeWidth=".75" />
      <path d="M330 34A78 78 0 0 1 330 190A58 78 0 0 0 330 34Z" fill="var(--ark-soft)" />
      <circle cx="330" cy="112" r="87" stroke="var(--ark-line)" strokeWidth=".6" strokeDasharray="1 9" />
      {SPECTRUM.map((color, index) => <path key={color} d={`M10 ${184+index*3}L500 ${108+index*3}`} stroke={color} strokeWidth="1" opacity=".65" />)}
    </svg>
  </div>
  return <div ref={ref} className={styles.scene} data-prism-scene={variant} aria-hidden="true">
    <PrismOptics className={styles.optics} />
  </div>
}
