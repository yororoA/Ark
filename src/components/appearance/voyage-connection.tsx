'use client'

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { RainConnection } from './rain-connection-store'
import styles from './voyage-connection.module.scss'

interface Props extends RainConnection {
  pageReady: boolean
  navigationSlow: boolean
  onCovered: () => void
  onComplete: () => void
}
const COVERED_AT = 3200
const REVEAL_TIME = 850

export default function VoyageConnection(props: Props) {
  const { status, username, error, navigationSlow, pageReady, destination, onDismiss } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const latest = useRef(props)
  const skip = useRef(false)
  const [phase, setPhase] = useState('signal')
  useLayoutEffect(() => { latest.current = props }, [props])
  useLayoutEffect(() => {
    const dialog = dialogRef.current!
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal(); document.body.style.overflow = 'hidden'
    dialog.focus({ preventScroll: true })
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let simple = motion.matches, previous = 0, elapsed = 0, reveal = 0, frame = 0
    if (simple) {
      dialog.dataset.simplified = 'true'
    }
    let navigating = false, finished = false, previousPhase = 'signal', previousDrawing = ''
    const simplify = () => { if (motion.matches || document.hidden) simple = true }
    motion.addEventListener('change', simplify)
    document.addEventListener('visibilitychange', simplify)
    const tick = (now: number) => {
      const delta = previous && !document.hidden ? Math.min(64, now - previous) : 0
      previous = now
      const current = latest.current
      const quick = simple || skip.current
      if (current.status !== 'error') elapsed = quick ? COVERED_AT : Math.min(COVERED_AT, elapsed + delta)
      const covered = elapsed >= COVERED_AT
      if (covered && current.status === 'success' && !navigating) { navigating = true; current.onCovered() }
      if (navigating && current.status === 'success' && current.pageReady) reveal = quick ? 1 : Math.min(1, reveal + delta / REVEAL_TIME)
      const nextPhase = current.status === 'error' ? 'error' : reveal > 0 ? 'revealing' : covered ? 'covered' : elapsed > 2300 ? 'closing' : elapsed > 700 ? 'course' : 'signal'
      if (nextPhase !== previousPhase) { previousPhase = nextPhase; setPhase(nextPhase) }
      const drawing = `${nextPhase}:${elapsed}:${reveal}:${quick}`
      if (drawing !== previousDrawing) {
        previousDrawing = drawing
        dialog.dataset.phase = nextPhase
        dialog.dataset.elapsed = String(Math.round(elapsed))
        dialog.dataset.reveal = reveal.toFixed(3)
        dialog.dataset.simplified = String(quick)
        const course = Math.min(1, Math.max(0, (elapsed - 650) / 1650))
        dialog.style.setProperty('--course', String(course))
        dialog.style.setProperty('--signal', String(Math.min(1, elapsed / 650)))
        dialog.style.setProperty('--reveal-radius', `${reveal * 150}vmax`)
        dialog.dataset.station = course >= .98 ? '3' : course >= .58 ? '2' : course >= .15 ? '1' : '0'
      }
      if (reveal >= 1 && !finished) { finished = true; current.onComplete(); return }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame); motion.removeEventListener('change', simplify); document.removeEventListener('visibilitychange', simplify)
      dialog.close(); document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  const cancelOrSkip = () => { if (status === 'success') skip.current = true; else onDismiss() }
  const keyboard = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')].filter(el => el.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) { event.preventDefault(); first?.focus() }
  }
  return <dialog ref={dialogRef} className={styles.sequence} tabIndex={-1} data-testid="voyage-connection" data-status={status} aria-label="夜航 · 身份确认" onKeyDown={keyboard} onCancel={event => { event.preventDefault(); cancelOrSkip() }}>
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.grid} />
      <svg className={styles.course} viewBox="0 0 1200 800" preserveAspectRatio="none" fill="none">
        <path className={styles.guide} d="M0 570H180C210 570 230 550 230 520V350C230 320 250 300 280 300H690C720 300 740 320 740 350V465C740 495 760 515 790 515H930" />
        <path className={styles.route} d="M0 570H180C210 570 230 550 230 520V350C230 320 250 300 280 300H690C720 300 740 320 740 350V465C740 495 760 515 790 515H930" pathLength="1" />
      </svg>
      <span className={`${styles.station} ${styles.stationOne}`}><i/><small>01 / 身份</small></span>
      <span className={`${styles.station} ${styles.stationTwo}`}><i/><small>02 / 接通</small></span>
      <span className={`${styles.station} ${styles.stationThree}`}><i/><small>03 / 抵达</small></span>
      <span className={styles.departure}>START HERE</span>
    </div>
    <header className={styles.header}><span>ARK / NIGHT VOYAGE</span><span>从此处，继续。</span></header>
    <div className={styles.headline} aria-hidden="true"><span>一条新的航路。</span><strong>THE NEXT<br/><i>CHAPTER.</i></strong></div>
    <div className={styles.identity}>
      <div className={styles.identityLabel}><i/><span>{status === 'error' ? 'CONNECTION ON HOLD' : phase === 'covered' && status === 'success' ? 'YOU ARE HERE' : 'ESTABLISHING A PASSAGE'}</span></div>
      <h1>{status === 'error' ? '暂时停靠' : status === 'success' ? '航路已接通' : '正在确认身份'}</h1>
      <p><span>VOYAGER</span>{username}</p>
    </div>
    <div className={styles.progress} aria-hidden="true"><span>出发</span><div><i/></div><span>继续阅读</span></div>
    <footer className={styles.footer}><p role="status">{status === 'error' ? '连接未完成' : status === 'pending' ? '正在确认身份…' : pageReady ? '航行，继续。' : phase === 'covered' ? '身份已确认，正在打开页面…' : '身份已确认，信号已接通。'}</p><button type="button" onClick={cancelOrSkip}>{status === 'success' ? '跳过动画 ↗' : '返回登录 ↗'}</button></footer>
    {status === 'error' && <div className={styles.notice}><span>ON HOLD / 暂时停靠</span><p role="alert">{error || '暂时无法连接，请稍后重试。'}</p><button type="button" onClick={onDismiss}>返回登录 ↗</button></div>}
    {navigationSlow && !pageReady && status !== 'error' && <div className={styles.notice}><span>STILL ON COURSE</span><p>页面加载较慢，可以直接打开目标页，或返回重试。</p><a href={destination}>打开目标页 ↗</a><button type="button" onClick={onDismiss}>返回登录</button></div>}
  </dialog>
}
