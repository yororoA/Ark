'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useAppearance } from './appearance-store'
import styles from './prism-stars.module.scss'

// Fixed positions keep SSR and hydration identical. Only opacity animates;
// no RAF loop or pointer interception for the ambient background.
const stars = Array.from({ length: 112 }, (_, index) => ({
  x: ((index * 719 + 73) % 1193) + 4,
  y: ((index * index * 37 + index * 229 + 17) % 887) + 4,
  radius: index % 19 === 0 ? 1.5 : index % 4 === 0 ? .9 : .55,
  delay: -(index % 17) * .79,
  duration: 4.8 + (index % 9) * .71,
}))

export default function PrismStars({ local = false }: { local?: boolean }) {
  const { design } = useAppearance()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || design !== 'prism') return
    const visibility = () => { node.dataset.paused = String(document.hidden) }
    visibility()
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [design])
  // Keep the tiny static decoration SSR-visible under the saved theme's CSS.
  return <div ref={ref} className={styles.stars} data-local={local} aria-hidden="true" data-testid="prism-stars">
    <svg viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
      {stars.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.radius}
        style={{ '--star-delay': `${star.delay}s`, '--star-duration': `${star.duration}s` } as CSSProperties} />)}
      <g className={styles['bright-stars']} stroke="currentColor" strokeWidth=".55">
        <path d="M146 142h8m-4-4v8M1006 642h10m-5-5v10M886 96h7m-3.5-3.5v7" />
      </g>
    </svg>
  </div>
}
