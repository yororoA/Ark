'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAppearance } from './appearance-store'
import { useRainConnection } from './rain-connection-store'
import { P3R_WIPE_EVENT, handOffUnderP3RWipe, type P3RWipeRequest } from './p3r-transition'
import styles from './offset-effects.module.scss'

const COPY = {
  zh: { next: '下一版', skip: '跳过动画', waiting: '页面仍在载入', open: '直接打开' },
  en: { next: 'NEXT EDITION', skip: 'Skip animation', waiting: 'The page is still loading', open: 'Open directly' },
  ja: { next: '次の版へ', skip: 'アニメーションをスキップ', waiting: 'ページを読み込み中', open: '直接開く' },
  de: { next: 'NÄCHSTE AUSGABE', skip: 'Animation überspringen', waiting: 'Die Seite wird noch geladen', open: 'Direkt öffnen' },
}

// This renderer owns only links which explicitly request a wipe. It never
// patches history or the router, and a disabled renderer leaves Next in charge.
export default function OffsetEffects() {
  const { design } = useAppearance()
  const path = usePathname()
  const pathRef = useRef(path)
  const committed = useRef<(() => void) | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  useEffect(() => { pathRef.current = path; committed.current?.() }, [path])

  useEffect(() => {
    const layer = layerRef.current
    if (design !== 'offset' || !layer || !layer.showPopover || !layer.animate) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const plates = [...layer.querySelectorAll<HTMLElement>('[data-offset-plate]')]
    const heading = layer.querySelector<HTMLElement>('[data-offset-destination]')!
    const caption = layer.querySelector<HTMLElement>('[data-offset-caption]')!
    const skipButton = layer.querySelector<HTMLButtonElement>('[data-offset-skip]')!
    const recovery = layer.querySelector<HTMLElement>('[data-offset-recovery]')!
    const direct = layer.querySelector<HTMLAnchorElement>('[data-offset-direct]')!
    const waiting = layer.querySelector<HTMLElement>('[data-offset-waiting]')!
    let active = false, handedOff = false, run = 0
    let request: P3RWipeRequest | null = null
    let animations: Animation[] = []
    let observer: MutationObserver | null = null
    let stableTimer = 0, slowTimer = 0, fallbackTimer = 0
    let opener: HTMLElement | null = null
    let sourcePath = ''

    const phase = (value: 'idle' | 'covering' | 'covered' | 'revealing') => {
      layer.dataset.phase = value
      if (value === 'idle') delete document.documentElement.dataset.offsetWipe
      else document.documentElement.dataset.offsetWipe = value
    }
    const clear = () => {
      run++; active = false; handedOff = false; request = null; committed.current = null
      animations.forEach(animation => animation.cancel()); animations = []
      observer?.disconnect(); observer = null
      clearTimeout(stableTimer); clearTimeout(slowTimer); clearTimeout(fallbackTimer)
      stableTimer = slowTimer = fallbackTimer = 0
      recovery.hidden = true
      phase('idle')
      if (layer.matches(':popover-open')) layer.hidePopover()
    }
    const restoreFocus = (destination: boolean) => {
      const target = destination ? document.querySelector<HTMLElement>('#main-content, main') : opener
      if (!target?.isConnected) return
      const temporary = !target.hasAttribute('tabindex') && !target.matches('a[href],button,input,select,textarea')
      if (temporary) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
      if (temporary) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true })
    }
    const skip = () => {
      if (!active) return
      const pending = handedOff ? null : request
      const arrived = handedOff && pathRef.current !== sourcePath
      clear()
      try {
        if (pending?.navigate) {
          const navigated = handOffUnderP3RWipe(pending.navigate)
          if (!navigated) restoreFocus(false)
        } else restoreFocus(arrived)
      } catch { pending?.fallback?.() }
    }
    const animatePlates = (opening: boolean) => {
      animations.forEach(animation => animation.cancel())
      animations = plates.map((plate, index) => plate.animate(opening ? [
        { transform: 'translateX(0%)' }, { transform: `translateX(${index % 2 ? 103 : -103}%)` },
      ] : [
        { transform: `translateX(${index % 2 ? -103 : 103}%)` }, { transform: 'translateX(0%)' },
      ], { duration: opening ? 590 : 510, delay: (opening ? 2 - index : index) * 74, easing: opening ? 'cubic-bezier(.72,0,.24,1)' : 'cubic-bezier(.16,.82,.18,1)', fill: 'both' }))
      return Promise.allSettled(animations.map(animation => animation.finished))
    }
    const reveal = (arrived: boolean) => {
      if (!active || layer.dataset.phase === 'revealing') return
      observer?.disconnect(); observer = null; committed.current = null
      clearTimeout(stableTimer); clearTimeout(slowTimer); clearTimeout(fallbackTimer)
      recovery.hidden = true
      phase('revealing')
      const generation = run
      void animatePlates(true).then(() => {
        if (!active || generation !== run) return
        clear(); restoreFocus(arrived)
      })
    }
    const readyMain = () => {
      if (!handedOff || pathRef.current === sourcePath || document.querySelector('[data-route-loading]')) return null
      const main = document.querySelector<HTMLElement>('#main-content, main')
      return main?.childElementCount ? main : null
    }
    const maybeReady = () => {
      if (!active || !handedOff || layer.dataset.phase !== 'covered' || stableTimer) return
      const main = readyMain()
      if (!main) return
      // A pathname commit can still display loading.tsx. Require the actual
      // destination main to survive another paint with no loading boundary.
      stableTimer = window.setTimeout(() => {
        stableTimer = 0
        if (readyMain() === main) reveal(true)
        else maybeReady()
      }, 90)
    }
    const localize = (detail: P3RWipeRequest) => {
      let locale = navigator.language.split('-')[0]
      try { locale = localStorage.getItem('ark.locale') || locale } catch { /* Browser locale. */ }
      if (!(locale in COPY)) locale = 'en'
      const copy = COPY[locale as keyof typeof COPY] ?? COPY.zh
      heading.textContent = detail.label || copy.next
      caption.textContent = copy.next
      skipButton.textContent = copy.skip
      waiting.textContent = copy.waiting
      direct.textContent = copy.open
      if (detail.destination) direct.href = detail.destination
      else direct.removeAttribute('href')
      direct.hidden = !detail.destination
      layer.lang = locale
    }
    const handoff = () => {
      const route = request
      handedOff = true
      phase('covered')
      committed.current = maybeReady
      observer = new MutationObserver(maybeReady)
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-route-loading'] })
      let navigated = false
      try { navigated = route?.navigate ? handOffUnderP3RWipe(route.navigate) : false }
      catch { clear(); route?.fallback?.(); return }
      if (!navigated) { reveal(false); return }
      // Next may commit synchronously from its cache. The same gate covers both
      // that case and streamed responses; elapsed time never counts as readiness.
      maybeReady()
      slowTimer = window.setTimeout(() => {
        if (!active || layer.dataset.phase !== 'covered') return
        recovery.hidden = false
        skipButton.focus({ preventScroll: true })
      }, 6500)
      fallbackTimer = window.setTimeout(() => {
        if (!active || layer.dataset.phase !== 'covered') return
        const fallback = request?.fallback
        clear()
        if (fallback) fallback()
        else restoreFocus(false)
      }, 20000)
    }
    const onRequest = (event: Event) => {
      const wipe = event as CustomEvent<P3RWipeRequest>
      if (event.defaultPrevented || motion.matches || document.hidden || useRainConnection.getState().connection) return
      if (!wipe.detail.navigate) return
      // Swallow repeated input while the opaque sheet owns interaction. Before
      // handoff a newer destination can replace the pending one without replay.
      event.preventDefault()
      if (active) {
        if (!handedOff) { request = wipe.detail; localize(wipe.detail) }
        return
      }
      clear()
      active = true; request = wipe.detail; sourcePath = pathRef.current
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
      localize(wipe.detail)
      phase('covering')
      try { layer.showPopover() } catch { skip(); return }
      const generation = run
      void animatePlates(false).then(() => {
        if (active && generation === run) handoff()
      })
    }
    const keydown = (event: KeyboardEvent) => {
      if (!active) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); skip(); return }
      if (event.key !== 'Tab') return
      event.preventDefault(); event.stopImmediatePropagation()
      const controls = recovery.hidden || direct.hidden ? [skipButton] : [skipButton, direct]
      const current = controls.indexOf(document.activeElement as HTMLButtonElement)
      controls[(current + (event.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus({ preventScroll: true })
    }
    const preventScroll = (event: Event) => { if (active) event.preventDefault() }
    const simplify = () => { if (motion.matches || document.hidden) skip() }
    const history = () => { if (active) { clear(); restoreFocus(false) } }
    document.addEventListener(P3R_WIPE_EVENT, onRequest)
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('wheel', preventScroll, { passive: false })
    document.addEventListener('touchmove', preventScroll, { passive: false })
    document.addEventListener('visibilitychange', simplify)
    window.addEventListener('popstate', history)
    motion.addEventListener('change', simplify)
    skipButton.addEventListener('click', skip)
    const unsubscribe = useRainConnection.subscribe(({ connection }) => { if (connection) clear() })
    return () => {
      clear(); unsubscribe()
      document.removeEventListener(P3R_WIPE_EVENT, onRequest)
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('wheel', preventScroll)
      document.removeEventListener('touchmove', preventScroll)
      document.removeEventListener('visibilitychange', simplify)
      window.removeEventListener('popstate', history)
      motion.removeEventListener('change', simplify)
      skipButton.removeEventListener('click', skip)
    }
  }, [design])

  return <div ref={layerRef} popover="manual" className={styles.layer} data-testid="offset-wipe" data-phase="idle" aria-label="OFFSET">
    <div className={styles.plates} aria-hidden="true">
      <div className={styles.plate} data-offset-plate><span className={styles.edition}>ARK / OFFSET<br />PRINT — 08</span><strong>OFF<span>SET</span></strong><i /></div>
      <div className={styles.plate} data-offset-plate><span className={styles.caption} data-offset-caption>下一版</span><strong className={styles.destination} data-offset-destination>OFFSET</strong><span className={styles.cross}>＋</span></div>
      <div className={styles.plate} data-offset-plate><strong>NEXT<span>→</span></strong><span className={styles.registration}>C / M / Y / K<span /><span /><span /></span></div>
    </div>
    <div className={styles.actions}>
      <div className={styles.recovery} data-offset-recovery hidden><span role="status" data-offset-waiting>页面仍在载入</span><a data-offset-direct>直接打开</a></div>
      <button type="button" data-offset-skip>跳过动画</button>
    </div>
  </div>
}
