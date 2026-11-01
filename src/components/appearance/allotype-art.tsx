'use client'

import { useRef, type CSSProperties } from 'react'
import { ALLOTYPES, allotypeMarks } from '@/lib/allotype'
import styles from './allotype-art.module.scss'

const PLATES = ALLOTYPES.map((seed, index) => allotypeMarks(seed.value, index))

export default function AllotypeArt({ index = 0, interactive = false, animated = true }: {
  index?: number
  interactive?: boolean
  animated?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const plate = Number.isInteger(index) && index >= 0 && index < ALLOTYPES.length ? index : 0
  const seed = ALLOTYPES[plate]
  return <div ref={ref} className={styles.art} data-interactive={interactive} data-form={seed.name} data-animated={animated}
    onPointerMove={interactive && animated ? event => {
      if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const box = event.currentTarget.getBoundingClientRect()
      ref.current?.style.setProperty('--finger-x', `${(event.clientX - box.left - box.width / 2) * .035}px`)
      ref.current?.style.setProperty('--finger-y', `${(event.clientY - box.top - box.height / 2) * .035}px`)
    } : undefined}
    onPointerLeave={interactive ? () => {
      ref.current?.style.setProperty('--finger-x', '0px')
      ref.current?.style.setProperty('--finger-y', '0px')
    } : undefined}
    aria-hidden="true">
    <div className={styles['print-plane']} key={plate}>
      <svg className={styles.fingerprint} viewBox="0 0 680 680" fill="none">
        <g className={styles.figure}>
          {PLATES[plate].map((mark, order) => <path key={order} d={mark.d} pathLength="1"
            className={mark.fill ? styles.impression : styles.etching} data-ink={mark.ink}
            strokeWidth={mark.width ?? 1.5} opacity={mark.opacity ?? 1}
            style={{ '--mark-delay': `${Math.min(order * 5, 330)}ms` } as CSSProperties} />)}
        </g>
        <g className={styles.registration} stroke="currentColor" strokeWidth="1">
          <path d="M30 48H66M48 30V66M614 632H650M632 614V650M30 632H66M48 614V650M614 48H650M632 30V66" />
          <path d="M340 28V39M340 641V652M28 340H39M641 340H652" />
        </g>
      </svg>
    </div>
  </div>
}
