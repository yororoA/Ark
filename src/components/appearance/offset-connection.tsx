'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { Locale } from '@/lib/blog'
import type { RainConnection } from './rain-connection-store'
import styles from './offset-connection.module.scss'

interface Props extends RainConnection {
  pageReady: boolean
  navigationSlow: boolean
  onCovered: () => void
  onComplete: () => void
}

const COPY = {
  zh: { label: '错版 · 身份确认', title: '落笔之前，先认识你。', pending: '正在确认身份…', success: '身份已确认，正在打开页面…', ready: '从这一页，继续。', failed: '连接未完成', fallback: '暂时无法连接，请稍后重试。', back: '返回登录', skip: '跳过动画', slow: '页面加载较慢，可以直接打开，或返回重试。', open: '打开目标页' },
  en: { label: 'Offset · Identity check', title: 'Every story has a name.', pending: 'Checking your identity…', success: 'Identity confirmed. Opening the page…', ready: 'Continue from this page.', failed: 'Connection incomplete', fallback: 'Unable to connect. Please try again.', back: 'Back to login', skip: 'Skip animation', slow: 'The page is taking longer to load. Open it directly, or go back and try again.', open: 'Open the page' },
  ja: { label: '錯版 · 本人確認', title: '書き始める前に、あなたのことを。', pending: '本人確認中…', success: '本人確認が完了しました。ページを開いています…', ready: 'このページから、続きを。', failed: '接続が完了していません', fallback: '接続できませんでした。もう一度お試しください。', back: 'ログインに戻る', skip: 'アニメーションをスキップ', slow: '読み込みに時間がかかっています。ページを直接開くか、戻ってお試しください。', open: 'ページを開く' },
  de: { label: 'Offset · Identitätsprüfung', title: 'Jede Geschichte hat einen Namen.', pending: 'Identität wird geprüft…', success: 'Identität bestätigt. Die Seite wird geöffnet…', ready: 'Auf dieser Seite geht es weiter.', failed: 'Verbindung unvollständig', fallback: 'Verbindung fehlgeschlagen. Bitte versuche es erneut.', back: 'Zur Anmeldung', skip: 'Animation überspringen', slow: 'Die Seite lädt länger. Öffne sie direkt oder gehe zurück und versuche es erneut.', open: 'Seite öffnen' },
}

function readLocale(): Locale {
  try { const locale = localStorage.getItem('ark.locale'); if (locale === 'en' || locale === 'ja' || locale === 'de') return locale } catch { /* The default remains usable without storage. */ }
  return 'zh'
}

const TYPE_SLICES = Array.from({ length: 5 }, (_, index) => ({
  '--slice': index,
  '--start': `${index * 20}%`,
  '--end': `${Math.min(100, (index + 1) * 20 + .15)}%`,
  '--shift': `${[38, -27, 46, -35, 22][index]}%`,
  '--delay': `${index * 45}ms`,
} as CSSProperties))
const FRAGMENTS = [
  { x: '-185%', y: '-160%', turn: '-24deg', size: '13%', left: '19%', top: '12%' },
  { x: '180%', y: '-140%', turn: '38deg', size: '7%', left: '82%', top: '19%' },
  { x: '-200%', y: '100%', turn: '-16deg', size: '8%', left: '9%', top: '56%' },
  { x: '200%', y: '150%', turn: '28deg', size: '11%', left: '78%', top: '73%' },
  { x: '-120%', y: '180%', turn: '55deg', size: '5%', left: '30%', top: '85%' },
  { x: '130%', y: '-190%', turn: '-45deg', size: '5%', left: '65%', top: '3%' },
] as const
// Success starts a finite composition. The opaque aperture must finish growing
// before navigation; the opening still waits for real destination readiness.
const TIMING = { prepare: 160, register: 580, identity: 1040, impress: 1580, open: 720 } as const
type Step = 'aligning' | 'registering' | 'identity' | 'impressing' | 'waiting'

function TypeBlock() { return <><span>OFF</span><span>SET</span></> }

export default function OffsetConnection({ status, username, error, destination, pageReady, navigationSlow, onCovered, onComplete, onDismiss }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const handedOff = useRef(false)
  const [locale] = useState(readLocale)
  const [quick, setQuick] = useState(false)
  const [prepared, setPrepared] = useState(false)
  const [step, setStep] = useState<Step>('aligning')
  const copy = COPY[locale]
  const assembling = status === 'success' && (prepared || quick)
  const ready = quick || step === 'waiting'
  const revealing = status === 'success' && ready && pageReady
  const phase = status === 'error' ? 'error' : !assembling ? 'pending' : revealing ? 'opening' : ready ? 'waiting' : step
  const coverVisible = phase === 'impressing' || phase === 'waiting' || phase === 'opening'

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    // Settle the small registration frame before an instant auth response
    // unfolds the composition. Authentication itself is never delayed.
    const timer = window.setTimeout(() => setPrepared(true), TIMING.prepare)
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const simplify = () => { if (motion.matches || document.hidden) setQuick(true) }
    simplify()
    motion.addEventListener('change', simplify)
    document.addEventListener('visibilitychange', simplify)
    return () => {
      clearTimeout(timer)
      motion.removeEventListener('change', simplify)
      document.removeEventListener('visibilitychange', simplify)
      dialog?.close()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (!assembling || quick) return
    const timers = [
      window.setTimeout(() => setStep('registering'), TIMING.register),
      window.setTimeout(() => setStep('identity'), TIMING.identity),
      window.setTimeout(() => setStep('impressing'), TIMING.impress),
    ]
    return () => timers.forEach(clearTimeout)
  }, [assembling, quick])

  useEffect(() => {
    if (status !== 'success' || !ready || handedOff.current) return
    handedOff.current = true
    onCovered()
  }, [status, ready, onCovered])
  useEffect(() => {
    if (!revealing) return
    const timer = window.setTimeout(onComplete, quick ? 0 : TIMING.open)
    return () => clearTimeout(timer)
  }, [revealing, quick, onComplete])

  return <dialog ref={dialogRef} className={styles.sequence} lang={locale} aria-label={copy.label} data-testid="offset-connection"
    data-status={status} data-phase={phase} data-assembling={assembling} data-assembled={ready} data-cover={coverVisible} data-revealing={revealing} data-quick={quick} data-page-ready={pageReady} data-navigation-slow={navigationSlow}
    onCancel={event => { event.preventDefault(); if (status === 'success') setQuick(true); else onDismiss() }}>
    <div className={styles.paper} aria-hidden="true" />
    <div className={styles.sheets} data-offset-login-sheets aria-hidden="true" onAnimationEnd={event => {
      // Child glyph/frame animations also bubble here. Only the completed
      // opaque cover can release navigation; a paused cover keeps the gate shut.
      if (event.target === event.currentTarget && status === 'success' && step === 'impressing') setStep('waiting')
    }}>
      {['top', 'right', 'bottom', 'left'].map((side, index) => <div className={styles.sheet} data-side={side} data-offset-login-exit-sheet={index} key={side} />)}
      <div className={styles.gateFrames} data-offset-login-gate><i /><i /><i /></div>
      <div className={styles.gateWord}><strong>IN<span>↗</span></strong></div>
    </div>
    <header className={styles.header}><span>YOROROICE / OFFSET</span><span>08 — PERSONAL ACCESS</span></header>
    <div className={styles.composition}>
      <div className={styles.print} aria-hidden="true">
        <div className={styles.frameField} data-offset-login-frame><i /><i /><i /><i /><span>08</span></div>
        <div className={styles.fragments}>{FRAGMENTS.map((fragment, index) => <i key={index} style={{ '--burst-x': fragment.x, '--burst-y': fragment.y, '--turn': fragment.turn, '--size': fragment.size, '--left': fragment.left, '--top': fragment.top, '--fragment-delay': `${index * 28}ms` } as CSSProperties} />)}</div>
        <div className={styles.registration} data-offset-login-registration><i /><i /><i /><i /></div>
        <div className={styles.typePlate} data-offset-login-plate>
          <div className={styles.outlineType}><TypeBlock /></div>
          <div className={styles.redType}><TypeBlock /></div>
          {TYPE_SLICES.map((style, index) => <div className={styles.typeSlice} data-offset-login-type-slice={index} style={style} key={index}><TypeBlock /></div>)}
        </div>
        <div className={styles.imprint}><i /><b>↗</b></div>
      </div>
      <div className={styles.identity}>
        <span className={styles.marker} aria-hidden="true" />
        <h1>{copy.title}</h1>
        <div className={styles.nameBlock} tabIndex={coverVisible ? -1 : 0}>
          <strong>{username}<span className={styles.nameOverprint} data-offset-login-name aria-hidden="true">{username}</span></strong>
        </div>
        <p role="status">{status === 'error' ? copy.failed : status === 'pending' ? copy.pending : revealing ? copy.ready : copy.success}</p>
      </div>
    </div>
    {status === 'error' && <p className={styles.error} role="alert">{error || copy.fallback}</p>}
    {navigationSlow && !pageReady && <div className={styles.notice}><p>{copy.slow}</p><a href={destination}>{copy.open} ↗</a><button type="button" onClick={onDismiss}>{copy.back} ↗</button></div>}
    <footer className={styles.footer}><span>{status === 'pending' ? '01 / IDENTITY' : status === 'error' ? '01 / RETRY' : pageReady ? '03 / OPEN' : '02 / CONNECTED'}</span><div className={styles.steps} aria-hidden="true"><i /><i /><i /></div><button type="button" onClick={status === 'success' ? () => setQuick(true) : onDismiss}>{status === 'success' ? copy.skip : copy.back} ↗</button></footer>
  </dialog>
}
