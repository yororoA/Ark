'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, X } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import ArchiveLogo from '@/components/brand/archive-logo'
import { isFoldTransitionCovering } from '@/components/appearance/fold-transition'
import { sections, translate, type Locale } from '@/lib/blog'
import styles from './voyage-menu.module.scss'

const destinations = [...sections, ['chat', '07', 'Chat']] as const
const COPY = {
  zh: { title: '从这里，', invitation: '去往另一页。', note: '每一站，都有留下的痕迹。', theme: '更换风景', bearing: '下一站' },
  en: { title: 'From here,', invitation: 'somewhere else.', note: 'The voyage is still being written.', theme: 'Change the view', bearing: 'SELECTED COURSE' },
  ja: { title: 'ここから、', invitation: '次のページへ。', note: '航海も、物語も、まだ続く。', theme: '景色を変える', bearing: '選択した航路' },
  de: { title: 'Von hier', invitation: 'zur nächsten Seite.', note: 'Die Reise wird weitergeschrieben.', theme: 'Ansicht wechseln', bearing: 'GEWÄHLTER KURS' },
}
function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener); window.addEventListener('hashchange', listener)
  return () => { window.removeEventListener('popstate', listener); window.removeEventListener('hashchange', listener) }
}
const locationSnapshot = () => location.pathname + location.search + location.hash

type Station = { x: number; y: number }
type RouteMotion = { select: (index: number) => void; stop: () => void }
function routePath(points: Station[]) {
  return points.map((point, index) => {
    if (!index) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const middle = (previous.y + point.y) / 2
    return `C ${previous.x} ${middle} ${point.x} ${middle} ${point.x} ${point.y}`
  }).join(' ')
}

export default function VoyageMenu({ locale, close }: { locale: Locale; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const directory = useRef<HTMLElement>(null)
  const routeSvg = useRef<SVGSVGElement>(null)
  const routeTrack = useRef<SVGPathElement>(null)
  const routeProgress = useRef<SVGPathElement>(null)
  const routeMeasure = useRef<SVGPathElement>(null)
  const routeMarker = useRef<SVGGElement>(null)
  const routeMotion = useRef<RouteMotion | null>(null)
  const animation = useRef<Animation | null>(null)
  const closing = useRef(false)
  const closeRef = useRef(close)
  useEffect(() => { closeRef.current = close }, [close])
  const pathname = usePathname()
  const returnTo = useSyncExternalStore(subscribe, locationSnapshot, () => pathname)
  const current = destinations.findIndex(([key]) => pathname.startsWith(`/${key}`))
  const [pointed, setPointed] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const selected = pointed ?? focused ?? Math.max(0, current)
  const copy = COPY[locale]
  const selectedRef = useRef(selected)
  useEffect(() => { selectedRef.current = selected; routeMotion.current?.select(selected) }, [selected])
  useEffect(() => {
    const dialog = ref.current!
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal(); document.body.style.overflow = 'hidden'
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    if (!motion.matches && dialog.animate) animation.current = dialog.animate([
      { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' },
    ], { duration: 600, easing: 'cubic-bezier(.2,.75,.2,1)' })
    ;(dialog.querySelector<HTMLElement>('nav [aria-current="page"]') ?? dialog.querySelector<HTMLElement>('nav a'))?.focus({ preventScroll: true })
    const reduce = () => { if (motion.matches) { animation.current?.cancel(); if (closing.current) closeRef.current() } }
    motion.addEventListener('change', reduce)
    return () => {
      motion.removeEventListener('change', reduce); animation.current?.cancel(); dialog.close()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    const nav = directory.current, svg = routeSvg.current, track = routeTrack.current
    const progress = routeProgress.current, measurePath = routeMeasure.current, marker = routeMarker.current
    if (!nav || !svg || !track || !progress || !measurePath || !marker) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, measureFrame = 0, disposed = false, visible = true
    let distance = 0, total = 0, stops: number[] = []
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      svg.dataset.moving = 'false'
    }
    const paint = (position: number) => {
      if (!total) return
      distance = Math.max(0, Math.min(total, position))
      const point = track.getPointAtLength(distance)
      marker.setAttribute('transform', `translate(${point.x} ${point.y})`)
      progress.style.strokeDashoffset = String(1 - distance / total)
    }
    const settle = () => { stop(); paint(stops[selectedRef.current] ?? 0) }
    const select = (index: number) => {
      stop()
      if (!total || closing.current) return
      const target = stops[index] ?? 0
      if (motion.matches || document.hidden || !visible || Math.abs(target - distance) < .5) { paint(target); return }
      // Retarget from the last painted arc length, never from a previous station.
      // The same path controls the marker and illuminated track at every frame.
      const origin = distance, began = performance.now()
      const duration = 240 + 360 * Math.sqrt(Math.abs(target - origin) / total)
      svg.dataset.moving = 'true'
      const draw = (now: number) => {
        if (disposed || closing.current || document.hidden || !visible || motion.matches) { settle(); return }
        const t = Math.min(1, (now - began) / duration)
        paint(origin + (target - origin) * (1 - (1 - t) ** 3))
        if (t < 1) frame = requestAnimationFrame(draw)
        else stop()
      }
      frame = requestAnimationFrame(draw)
    }
    const measure = () => {
      cancelAnimationFrame(measureFrame)
      if (disposed || closing.current || document.hidden) return
      measureFrame = requestAnimationFrame(() => {
        measureFrame = 0
        if (disposed || closing.current) return
        const bounds = nav.getBoundingClientRect()
        if (!bounds.width || !bounds.height) return
        const points = [...nav.querySelectorAll<HTMLElement>('[data-route-station]')].map(station => {
          const box = station.getBoundingClientRect()
          return { x: box.left - bounds.left + box.width / 2, y: box.top - bounds.top + box.height / 2 }
        })
        stop()
        svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`)
        const path = routePath(points)
        track.setAttribute('d', path)
        progress.setAttribute('d', path)
        total = track.getTotalLength()
        stops = points.map((_, index) => {
          if (index === 0) return 0
          measurePath.setAttribute('d', routePath(points.slice(0, index + 1)))
          return measurePath.getTotalLength()
        })
        paint(stops[selectedRef.current] ?? 0)
        svg.dataset.ready = 'true'
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    nav.querySelectorAll('a').forEach(link => observer.observe(link))
    const visibility = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false
      if (!visible) settle()
    })
    visibility.observe(nav)
    const preference = () => { if (motion.matches) settle() }
    const pageVisibility = () => { if (document.hidden) settle(); else measure() }
    const controller = { select, stop: () => { stop(); cancelAnimationFrame(measureFrame) } }
    routeMotion.current = controller
    motion.addEventListener('change', preference)
    document.addEventListener('visibilitychange', pageVisibility)
    void document.fonts.ready.then(() => { if (!disposed) measure() })
    measure()
    return () => {
      disposed = true
      controller.stop(); observer.disconnect(); visibility.disconnect()
      motion.removeEventListener('change', preference)
      document.removeEventListener('visibilitychange', pageVisibility)
      if (routeMotion.current === controller) routeMotion.current = null
    }
  }, [locale])
  const dismiss = () => {
    if (closing.current) return
    routeMotion.current?.stop()
    const dialog = ref.current
    if (!dialog || isFoldTransitionCovering() || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || !dialog.animate) { close(); return }
    closing.current = true
    const start = getComputedStyle(dialog).clipPath
    animation.current?.cancel()
    dialog.inert = true
    animation.current = dialog.animate([{ clipPath: start === 'none' ? 'inset(0 0 0 0)' : start }, { clipPath: 'inset(100% 0 0 0)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' })
    void animation.current.finished.then(close, () => {})
  }
  const keyboard = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')].filter(el => el.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  const arrows = (event: KeyboardEvent<HTMLElement>) => {
    const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>('a')]
    const index = links.indexOf(document.activeElement as HTMLAnchorElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % links.length : event.key === 'ArrowUp' ? (index - 1 + links.length) % links.length : event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : null
    if (next !== null) { event.preventDefault(); setPointed(null); links[next].focus() }
  }
  return <dialog ref={ref} className={styles.dialog} data-testid="voyage-menu" aria-label={translate(locale, 'contents')} onKeyDown={keyboard} onCancel={event => { event.preventDefault(); dismiss() }}>
    <header className={styles.top}><Link href="/home" onNavigate={dismiss} aria-label="YororoIce Ark"><ArchiveLogo /></Link><span>ARK / NIGHT PASSAGE</span><button onClick={dismiss} type="button" aria-label={translate(locale, 'close')}><X size={22} /></button></header>
    <div className={styles.body}>
      <aside className={styles.spine} aria-hidden="true"><span>NIGHT VOYAGE</span><small>ARK / INDEX</small></aside>
      <div className={styles.contents}>
        <div className={styles.invitation}><div><span>THE ROUTE INDEX</span><h2>{copy.title}<em>{copy.invitation}</em></h2></div><span className={styles.readout}><small>{copy.bearing}</small><strong>{destinations[selected][1]} <ArrowUpRight size={17}/></strong></span></div>
        <nav ref={directory} className={styles.directory} aria-label={translate(locale, 'contents')} onKeyDown={arrows}>
          <svg ref={routeSvg} className={styles.route} aria-hidden="true">
            <path ref={routeTrack} className={styles.routeTrack}/>
            <path ref={routeProgress} className={styles.routeProgress} pathLength="1"/>
            <path ref={routeMeasure} className={styles.routeMeasure}/>
            <g ref={routeMarker} className={styles.routeMarker}><circle r="10"/><circle r="3"/></g>
          </svg>
          {destinations.map(([key, number, english], index) => <Link key={key} href={`/${key}`} onNavigate={dismiss} aria-current={current === index ? 'page' : undefined} data-selected={selected === index} style={{ '--order': index } as CSSProperties} onMouseEnter={() => setPointed(index)} onMouseLeave={() => setPointed(null)} onFocus={() => { setFocused(index); setPointed(null) }} onBlur={() => setFocused(null)}>
            <span data-route-station className={styles.station} aria-hidden="true"/>
            <span className={styles.folio}><small>{number}</small><em>{english}</em></span>
            <span className={styles.destination}>{translate(locale, key)}</span><ArrowUpRight className={styles.arrow} size={28} strokeWidth={1.2} />
          </Link>)}
        </nav>
      </div>
    </div>
    <footer className={styles.bottom}><p>{copy.note}</p><Link href={`/theme?returnTo=${encodeURIComponent(returnTo)}`} onNavigate={dismiss}>{copy.theme}<ArrowUpRight size={16} /></Link><Link href="/login" onNavigate={dismiss}>{translate(locale, 'login')}<ArrowUpRight size={16} /></Link></footer>
  </dialog>
}
