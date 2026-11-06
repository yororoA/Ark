'use client'

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { RainConnection } from './rain-connection-store'
import { connectionLocale, VOYAGE_CONNECTION_COPY } from './voyage-connection-copy'
import styles from './voyage-connection.module.scss'

interface Props extends RainConnection {
  pageReady: boolean
  navigationSlow: boolean
  onCovered: () => void
  onComplete: () => void
}
const COVERED_AT = 3200
const SIGNAL_TIME = 650
const APPROACH = .94
const ARRIVAL_TIME = 280
const REVEAL_TIME = 570
const COURSE = 'M0 570H180C210 570 230 550 230 520V350C230 320 250 300 280 300H690C720 300 740 320 740 350V465C740 495 760 515 790 515H930'
const STATIONS = [{ x: 230, y: 456 }, { x: 600, y: 300 }, { x: 930, y: 515 }]
const ease = (value: number) => value * value * (3 - 2 * value)

export default function VoyageConnection(props: Props) {
  const { status, username, error, navigationSlow, pageReady, destination, onDismiss } = props
  const [locale] = useState(connectionLocale)
  const copy = VOYAGE_CONNECTION_COPY[locale]
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const beaconRef = useRef<HTMLSpanElement>(null)
  const latest = useRef(props)
  const skip = useRef(false)
  const wake = useRef(() => {})
  const [phase, setPhase] = useState('signal')
  useLayoutEffect(() => { latest.current = props; wake.current() }, [props])
  useLayoutEffect(() => {
    const dialog = dialogRef.current!, path = pathRef.current!, beacon = beaconRef.current!
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal(); document.body.style.overflow = 'hidden'
    dialog.focus({ preventScroll: true })
    const length = path.getTotalLength()
    // Measure stations in the SVG's own coordinates: dash progress and the
    // CSS-sized beacon then share one arc length even under nonuniform scaling.
    const stops = STATIONS.map(station => {
      let nearest = 0, distance = Infinity
      for (let sample = 0; sample <= 2400; sample++) {
        const fraction = sample / 2400, point = path.getPointAtLength(length * fraction)
        const next = Math.hypot(point.x - station.x, point.y - station.y)
        if (next < distance) { nearest = fraction; distance = next }
      }
      return nearest
    })
    const identityAt = SIGNAL_TIME + 1650 * stops[0]
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let simple = motion.matches, previous = 0, elapsed = 0, arrival = 0, reveal = 0, frame = 0
    if (simple) dialog.dataset.simplified = 'true'
    let navigating = false, finished = false, active = true, previousPhase = 'signal', previousDrawing = ''
    let waitingSince: number | null = null, speed = 1
    const measureReveal = () => {
      const station = dialog.querySelector<HTMLElement>('[data-voyage-station="3"]')!
      const bounds = dialog.getBoundingClientRect(), point = station.getBoundingClientRect()
      dialog.style.setProperty('--arrival-x', `${point.x + point.width / 2 - bounds.x}px`)
      dialog.style.setProperty('--arrival-y', `${point.y + point.height / 2 - bounds.y}px`)
    }
    const observer = new ResizeObserver(measureReveal)
    observer.observe(dialog); observer.observe(path.ownerSVGElement!)
    measureReveal()
    const schedule = () => {
      if (!active || finished || frame) return
      previous = 0
      frame = requestAnimationFrame(tick)
    }
    const simplify = () => { if (motion.matches || document.hidden) { simple = true; schedule() } }
    const tick = (now: number) => {
      frame = 0
      const delta = previous && !document.hidden ? Math.min(64, now - previous) : 0
      previous = now
      const current = latest.current, quick = simple || skip.current
      if (current.status !== 'error') {
        if (current.status === 'pending') {
          elapsed = quick ? identityAt : Math.min(identityAt, elapsed + delta)
          if (elapsed >= identityAt && waitingSince === null) waitingSince = now
        } else {
          // A long identity check resumes the remaining passage, never its intro.
          if (waitingSince !== null) { if (now - waitingSince > 250) speed = 2.25; waitingSince = null }
          elapsed = quick ? COVERED_AT : Math.min(COVERED_AT, elapsed + delta * speed)
        }
      }
      const covered = elapsed >= COVERED_AT
      if (covered && current.status === 'success' && !navigating) { navigating = true; current.onCovered() }
      if (navigating && current.status === 'success' && current.pageReady) {
        if (arrival < 1) arrival = quick ? 1 : Math.min(1, arrival + delta / ARRIVAL_TIME)
        else reveal = quick ? 1 : Math.min(1, reveal + delta / REVEAL_TIME)
        if (quick) reveal = 1
      }
      const firstLeg = Math.min(1, Math.max(0, (elapsed - SIGNAL_TIME) / (identityAt - SIGNAL_TIME)))
      const secondLeg = Math.min(1, Math.max(0, (elapsed - identityAt) / (COVERED_AT - identityAt)))
      const course = arrival > 0 ? APPROACH + (1 - APPROACH) * ease(arrival)
        : elapsed <= identityAt ? stops[0] * ease(firstLeg) : stops[0] + (APPROACH - stops[0]) * ease(secondLeg)
      const nextPhase = current.status === 'error' ? 'error' : reveal > 0 ? 'revealing' : covered ? 'covered' : elapsed > 2300 ? 'closing' : elapsed > 700 ? 'course' : 'signal'
      if (nextPhase !== previousPhase) { previousPhase = nextPhase; setPhase(nextPhase) }
      const waiting = current.status === 'pending' && elapsed >= identityAt ? 'identity' : covered && !current.pageReady ? 'content' : ''
      const drawing = `${nextPhase}:${elapsed}:${course}:${reveal}:${quick}:${waiting}`
      if (drawing !== previousDrawing) {
        previousDrawing = drawing
        dialog.dataset.phase = nextPhase
        dialog.dataset.elapsed = String(Math.round(elapsed))
        dialog.dataset.reveal = reveal.toFixed(3)
        dialog.dataset.simplified = String(quick)
        dialog.dataset.waiting = waiting
        dialog.dataset.station = String(stops.filter(stop => course + .00001 >= stop).length)
        dialog.style.setProperty('--course', String(course))
        dialog.style.setProperty('--signal', String(Math.min(1, elapsed / SIGNAL_TIME)))
        dialog.style.setProperty('--reveal-radius', `${reveal * 150}vmax`)
        const point = path.getPointAtLength(length * course)
        beacon.style.left = `${point.x / 1200 * 100}%`
        beacon.style.top = `${(point.y - 250) / 400 * 100}%`
      }
      if (reveal >= 1 && !finished) { finished = true; current.onComplete(); return }
      const moving = current.status !== 'error' && (current.status === 'pending' ? elapsed < identityAt : !covered || current.pageReady)
      if (moving) frame = requestAnimationFrame(tick)
    }
    wake.current = schedule
    motion.addEventListener('change', simplify)
    document.addEventListener('visibilitychange', simplify)
    schedule()
    return () => {
      active = false; wake.current = () => {}; cancelAnimationFrame(frame); observer.disconnect()
      motion.removeEventListener('change', simplify); document.removeEventListener('visibilitychange', simplify)
      dialog.close(); document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  const cancelOrSkip = () => { if (status === 'success') { skip.current = true; wake.current() } else onDismiss() }
  const keyboard = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')].filter(el => el.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) { event.preventDefault(); first?.focus() }
  }
  return <dialog ref={dialogRef} className={styles.sequence} tabIndex={-1} data-testid="voyage-connection" data-status={status} lang={locale} aria-label={copy.dialog} onKeyDown={keyboard} onCancel={event => { event.preventDefault(); cancelOrSkip() }}>
    <div className={styles.grid} aria-hidden="true" />
    <header className={styles.header}><span>ARK / NIGHT VOYAGE</span><span>{copy.continuation}</span></header>
    <div className={styles.composition} data-voyage-content>
      <div className={styles.headline} data-voyage-headline aria-hidden="true"><span>{copy.introduction}</span><strong>THE NEXT<br/><i>CHAPTER.</i></strong></div>
      <div className={styles.scene} aria-hidden="true">
        <svg className={styles.course} viewBox="0 250 1200 400" preserveAspectRatio="none" fill="none">
          <path className={styles.guide} d={COURSE} />
          <path ref={pathRef} className={styles.route} data-voyage-route d={COURSE} pathLength="1" />
        </svg>
        {STATIONS.map((station, index) => <span key={index} className={styles.station} data-voyage-station={index + 1} style={{ left: `${station.x / 12}%`, top: `${(station.y - 250) / 4}%` }}><i/><small>{`0${index + 1} / ${copy.stations[index]}`}</small></span>)}
        <span ref={beaconRef} className={styles.beacon} data-voyage-beacon />
      </div>
      <div className={styles.identity} data-voyage-identity tabIndex={phase === 'signal' || status === 'error' || navigationSlow ? -1 : 0} role="group" aria-label={copy.stations[0]}>
        <div className={styles.identityLabel}><i/><span>{status === 'error' ? 'CONNECTION ON HOLD' : pageReady ? 'YOU ARE HERE' : status === 'pending' ? 'IDENTITY CHECK' : 'PASSAGE CONFIRMED'}</span></div>
        <h1>{status === 'error' ? copy.held : status === 'success' ? copy.confirmed : copy.pending}</h1>
        <p><span>VOYAGER</span>{username}</p>
      </div>
    </div>
    <div className={styles.progress} data-voyage-progress aria-hidden="true"><span>{copy.departure}</span><div><i/></div><span>{copy.reading}</span></div>
    <footer className={styles.footer}><p role="status">{status === 'error' ? copy.errorStatus : status === 'pending' ? copy.pendingStatus : pageReady ? copy.readyStatus : phase === 'covered' ? copy.openingStatus : copy.confirmedStatus}</p><button type="button" onClick={cancelOrSkip}>{status === 'success' ? copy.skip : copy.back}</button></footer>
    {status === 'error' && <div className={styles.notice}><span>ON HOLD</span><p role="alert">{error || copy.fallbackError}</p><button type="button" onClick={onDismiss}>{copy.back}</button></div>}
    {navigationSlow && !pageReady && status !== 'error' && <div className={styles.notice}><span>STILL ON COURSE</span><p>{copy.slow}</p><a href={destination}>{copy.open}</a><button type="button" onClick={onDismiss}>{copy.back}</button></div>}
  </dialog>
}
