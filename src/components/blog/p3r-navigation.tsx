'use client'

import Link from '@/components/appearance/p3r-link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUpRight, X } from 'lucide-react'
import { sections, translate, type Entry, type Locale } from '@/lib/blog'
import { P3R_COPY } from '@/lib/p3r-copy'
import P3RScene from '@/components/appearance/p3r-scene'
import { fluidCoverRadius, fluidPoints, fluidSeed } from '@/components/appearance/p3r-fluid'
import { isP3RWipeCovering } from '@/components/appearance/p3r-transition'
import styles from './p3r-navigation.module.scss'

const destinations = [...sections, ['chat', '07', 'Chat']] as const
const MENU_OPEN_MS = 420
const MENU_CLOSE_MS = 300
const easeOut = 'cubic-bezier(.22, 1, .36, 1)'
const easeInOut = 'cubic-bezier(.65, 0, .35, 1)'

const readDate = () => new Date().toISOString().slice(0, 10)
const serverDate = () => ''
function subscribeDate(listener: () => void) {
  const timer = window.setInterval(listener, 60000)
  return () => clearInterval(timer)
}

function navigateWithKeys(event: KeyboardEvent<HTMLElement>) {
  const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a[href]'))
  const current = links.indexOf(document.activeElement as HTMLAnchorElement)
  const next = event.key === 'ArrowDown' ? (current + 1) % links.length
    : event.key === 'ArrowUp' ? (current - 1 + links.length) % links.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : null
  if (next === null) return
  event.preventDefault()
  links[next]?.focus()
}

export function P3RDate({ locale }: { locale: Locale }) {
  // A static page can be served on a later date than its build. Hydrate the
  // stable placeholder before reading the visitor's current UTC date.
  const date = useSyncExternalStore(subscribeDate, readDate, serverDate)
  return <time className={styles.date} dateTime={date || undefined}>
    <span>{P3R_COPY[locale].today}<small>UTC</small></span>
    <strong>{date.slice(5, 7) || '--'}<i>/</i>{date.slice(8) || '--'}</strong>
  </time>
}

function DestinationList({ locale, close, home = false }: { locale: Locale; close?: () => void; home?: boolean }) {
  const pathname = usePathname()
  const items = home ? destinations.filter(([key]) => key !== 'home') : destinations
  return <nav className={styles['destination-list']} aria-label={P3R_COPY[locale].menu} onKeyDown={navigateWithKeys}>
    {items.map(([key, number, english], index) => <Link
      key={key} href={`/${key}`} onNavigate={close}
      aria-current={pathname.startsWith(`/${key}`) ? 'page' : undefined}
      style={{ '--item': index } as CSSProperties}
    >
      <span className={styles['destination-number']} aria-hidden="true">{number}</span>
      <span className={styles['destination-name']}>{english}</span>
      <span className={styles['destination-label']}>{translate(locale, key)}</span>
      <ArrowUpRight size={22} />
    </Link>)}
  </nav>
}

export function P3RHome({ locale, featured, status }: { locale: Locale; featured?: Entry; status: 'online' | 'offline' | 'unknown' }) {
  const copy = P3R_COPY[locale]
  return <section className={styles['home-stage']}>
    <P3RScene />
    <div className={styles['stage-top']}><span>YOROROICE / PERSONAL ARCHIVE</span><P3RDate locale={locale} /></div>
    <div className={styles['home-identity']}>
      <span className={styles['identity-kicker']}>YOUR DAYS. YOUR STORY.</span>
      <h1>YORORO<span>ICE. ARK</span></h1>
      <h2>{copy.headline}</h2>
      <p>{translate(locale, 'introBody')}</p>
      <Link href={featured ? `/articles/${featured._id}` : '/articles'} className={styles['continue-link']}>
        <span>{translate(locale, featured ? 'latest' : 'read')}</span>
        <strong>{featured?.title || copy.enter}</strong><ArrowUpRight size={23} />
      </Link>
    </div>
    <div className={styles['home-menu']}><p>{copy.menu}</p><DestinationList locale={locale} home /></div>
    <div className={styles['stage-bottom']}><span><i data-online={status === 'online'} />BINES / {translate(locale, status)}</span><a href="#recent">{translate(locale, 'latest')}<ArrowDown size={16} /></a></div>
  </section>
}

// Liquid outline as CSS shapes. Every keyframe keeps one vertex count so the
// browser interpolates the vertices.
type Point = { x: number; y: number }
const RIM_WIDTH = 7
// Evenly spaced radii; the effect easing alone shapes the speed.
const STEPS = [0, .25, .5, .75, 1]

// The menu floods out of its opener like the page wipe and drains back into
// it on dismissal. The rim is the band between two outlines of one edge.
// `reach` lets a drain start from an interrupted flood instead of a full cover.
function floodMenu(surface: HTMLElement, rim: HTMLElement, { x, y }: Point, opening: boolean, reach = 1, start?: { surface: string; rim: string }) {
  const { clientWidth: width, clientHeight: height } = surface
  const radius = fluidCoverRadius(x, y, width, height)
  const seed = fluidSeed()
  const duration = opening ? MENU_OPEN_MS : MENU_CLOSE_MS * Math.max(.4, reach)
  const steps = opening ? STEPS : STEPS.map(step => step * reach).reverse()
  const outline = (progress: number, inset = 0) => fluidPoints(x, y, Math.max(0, radius * progress - inset), progress * duration, seed)
  const timing: KeyframeAnimationOptions = { duration, easing: opening ? easeOut : easeInOut, fill: opening ? 'none' : 'forwards' }
  // The 100dvh surface can resize while opening (responsive mode, browser
  // chrome, keyboard). Pixel paths retain the old bounds until fill:none
  // removes the clip. Relative vertices let both layers follow the surface.
  const vertices = (points: [number, number][]) => points
    .map(([px, py]) => `${(px / width * 100).toFixed(3)}% ${(py / height * 100).toFixed(3)}%`).join(',')
  const frames = steps.map(progress => ({ outer: outline(progress), inner: outline(progress, RIM_WIDTH) }))
  return [
    surface.animate(frames.map(({ outer }, index) => ({ clipPath: index === 0 && start ? start.surface : `polygon(${vertices(outer)})` })), timing),
    // Close each ring, then retrace the bridge. Even-odd filling leaves only
    // the band, with a fixed vertex count for interpolation at every step.
    rim.animate(frames.map(({ outer, inner }, index) => ({
      clipPath: index === 0 && start ? start.rim : `polygon(evenodd, ${vertices([...outer, outer[0], ...inner, inner[0], outer[0]])})`,
    })), timing),
  ]
}

const canFlood = (dialog: HTMLDialogElement) => typeof dialog.animate === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches

// Safari does not focus clicked buttons; fall back to the expanded toggle.
function menuOrigin(opener: Element | null): Point {
  const anchor = opener instanceof HTMLElement && opener !== document.body ? opener : document.querySelector<HTMLElement>('button[aria-expanded="true"]')
  const box = anchor?.getBoundingClientRect()
  return box && box.width ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: innerWidth - 40, y: 38 }
}

export function P3RMenu({ locale, close }: { locale: Locale; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const rim = useRef<HTMLSpanElement>(null)
  const origin = useRef<Point>({ x: 0, y: 0 })
  const flooding = useRef<Animation[]>([])
  const closing = useRef<{ animations: Animation[]; timer: number } | null>(null)
  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement
    const previous = document.body.style.overflow
    origin.current = menuOrigin(opener)
    dialog?.showModal()
    dialog?.querySelector<HTMLAnchorElement>('[aria-current="page"]')?.focus({ preventScroll: true })
    document.body.style.overflow = 'hidden'
    flooding.current = dialog && surface.current && rim.current && canFlood(dialog) ? floodMenu(surface.current, rim.current, origin.current, true) : []
    return () => {
      flooding.current.forEach(animation => animation.cancel())
      if (closing.current) {
        clearTimeout(closing.current.timer)
        closing.current.animations.forEach(animation => animation.cancel())
      }
      closing.current = null
      dialog?.close()
      document.body.style.overflow = previous
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  // Esc, the close button and same-page links drain the menu. Under the page
  // wipe it is already hidden, so it leaves at once.
  function dismiss() {
    const dialog = ref.current, panel = surface.current, edge = rim.current
    if (closing.current) return
    const drains = !!dialog && !!panel && !!edge && canFlood(dialog) && !isP3RWipeCovering()
    if (!drains) { close(); return }
    dialog.dataset.closing = 'true'
    dialog.inert = true
    // Radii are evenly spaced keyframes, so the eased progress approximates
    // the flood's current reach and the drain starts from that outline.
    const [flood] = flooding.current
    const reach = flood?.effect?.getComputedTiming().progress ?? 1
    // Preserve the exact visible edge, including a mid-flood viewport resize.
    const start = reach < 1 ? { surface: getComputedStyle(panel).clipPath, rim: getComputedStyle(edge).clipPath } : undefined
    flooding.current.forEach(animation => animation.cancel())
    flooding.current = []
    const done = () => {
      if (!closing.current) return
      clearTimeout(closing.current.timer)
      closing.current = null
      close()
    }
    const animations = floodMenu(panel, edge, origin.current, false, reach, start)
    // A throttled tab may never finish the animation; close anyway.
    closing.current = { animations, timer: window.setTimeout(done, MENU_CLOSE_MS + 200) }
    animations[0].finished.then(done, done)
  }
  return <dialog ref={ref} className={styles['menu-dialog']} aria-label={P3R_COPY[locale].menu}
    onCancel={event => { event.preventDefault(); dismiss() }}
    // Chrome force-closes after repeated Esc without activation; keep state in sync.
    onClose={() => { if (ref.current && !ref.current.open) close() }}>
    {/* Keep the native top layer stationary. Clip a viewport-sized surface,
        with scrolling inside it, so focusing a lower row cannot move the flood. */}
    <div ref={surface} className={styles['menu-surface']}>
      <P3RScene variant="menu" />
      <span ref={rim} className={styles['menu-rim']} aria-hidden="true" />
      <div className={styles['menu-scroll']}>
        <div className={styles['menu-top']}><Link href="/home" onNavigate={dismiss}>YOROROICE / ARK</Link><button type="button" onClick={dismiss} aria-label={translate(locale, 'close')}><span>ESC</span><X size={24} /></button></div>
        <div className={styles['menu-body']}>
          <div className={styles['menu-identity']}><P3RDate locale={locale} /><span className={styles['menu-word']} aria-hidden="true">MENU</span><p>{P3R_COPY[locale].note}</p></div>
          <DestinationList locale={locale} close={dismiss} />
        </div>
        <div className={styles['menu-bottom']}><Link href="/login" onNavigate={dismiss}>{translate(locale, 'login')}<ArrowUpRight size={18} /></Link><span>YOROROICE / P3R</span></div>
      </div>
    </div>
  </dialog>
}
