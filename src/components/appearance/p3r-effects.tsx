'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAppearance } from './appearance-store'
import styles from './p3r-effects.module.scss'

export default function P3REffects() {
  const { design } = useAppearance()
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const layer = ref.current
    if (design !== 'p3r' || !layer) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const effects = new Map<HTMLElement, number>()
    const remove = (node: HTMLElement) => {
      clearTimeout(effects.get(node))
      effects.delete(node)
      node.remove()
    }
    const click = (event: MouseEvent) => {
      if (motion.matches || event.button !== 0 || !(event.target instanceof Element)) return
      const control = event.target.closest<HTMLElement>('a[href], button, summary, label, [role="option"], input[type="radio"], input[type="checkbox"]')
      if (!control || control.matches(':disabled, [aria-disabled="true"]')) return
      // A label's forwarded click can target its visually hidden input.
      if (control instanceof HTMLInputElement && control.getBoundingClientRect().width <= 1) return
      const rect = control.getBoundingClientRect()
      const x = event.detail ? event.clientX : rect.left + rect.width / 2
      const y = event.detail ? event.clientY : rect.top + rect.height / 2
      const pulse = document.createElement('span')
      pulse.className = styles.pulse
      pulse.style.left = `${x}px`
      pulse.style.top = `${y}px`
      if (effects.size >= 4) remove(effects.keys().next().value!)
      layer.append(pulse)
      // A manual popover is a non-focusable visual layer above native dialogs.
      // Older browsers retain the ordinary fixed layer.
      if (typeof layer.showPopover === 'function') {
        if (layer.matches(':popover-open')) layer.hidePopover()
        layer.showPopover()
      }
      effects.set(pulse, window.setTimeout(() => remove(pulse), 560))
    }
    document.addEventListener('click', click, { capture: true, passive: true })
    return () => {
      document.removeEventListener('click', click, true)
      effects.forEach((_, node) => remove(node))
      if (typeof layer.hidePopover === 'function' && layer.matches(':popover-open')) layer.hidePopover()
    }
  }, [design])
  return design === 'p3r' ? <>
    <div ref={ref} className={styles['effect-layer']} popover="manual" aria-hidden="true" />
    {pathname !== '/login' && <div key={pathname} className={styles['route-reveal']} aria-hidden="true"><i /><i /></div>}
  </> : null
}
