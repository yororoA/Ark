'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Locale } from '@/lib/blog'
import styles from './home-activity.module.scss'

type Props = { days: string[]; active: Set<string>; selected: number; locale: Locale; onSelect: (index: number) => void }
const COPY = {
  zh: { label: '航迹盘，选择日期', hint: '拖动刻度，回到某一天。', keyboard: '方向键逐日调整，上下键跨周，Home 和 End 到首尾。', recorded: '有公开片刻', quiet: '没有公开片刻', start: '起点', today: '今天' },
  en: { label: 'Reading dial, choose a date', hint: 'Turn the scale. Return to a day.', keyboard: 'Arrow keys change the day; Up and Down change the week. Home and End reach either end.', recorded: 'Public moments recorded', quiet: 'No public moments', start: 'Beginning', today: 'Today' },
  ja: { label: '航跡盤、日付を選択', hint: '目盛りを回して、あの日へ。', keyboard: '左右キーで日付、上下キーで週を変更。Home と End で最初と最後へ。', recorded: '公開された瞬間あり', quiet: '公開された瞬間なし', start: 'はじまり', today: '今日' },
  de: { label: 'Zeitkreis, Datum wählen', hint: 'Drehe die Skala. Kehre zu einem Tag zurück.', keyboard: 'Pfeiltasten wechseln den Tag, Auf und Ab die Woche. Pos1 und Ende erreichen Anfang und Ende.', recorded: 'Öffentliche Momente vorhanden', quiet: 'Keine öffentlichen Momente', start: 'Beginn', today: 'Heute' },
}
const LOCALES = { zh: 'zh-CN', en: 'en-GB', ja: 'ja-JP', de: 'de-DE' }

export default function VoyageDial({ days, active, selected, locale, onSelect }: Props) {
  const copy = COPY[locale]
  const descriptionId = useId()
  const control = useRef<SVGCircleElement>(null)
  const frame = useRef(0)
  const drag = useRef<{ pointerId: number; index: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const current = days[selected]
  const week = Math.floor(selected / 7)
  const date = new Date(`${current}T00:00:00Z`)
  const fullDate = new Intl.DateTimeFormat(LOCALES[locale], { dateStyle: 'full', timeZone: 'UTC' }).format(date)
  const weekday = new Intl.DateTimeFormat(LOCALES[locale], { weekday: 'short', timeZone: 'UTC' }).format(date)

  useEffect(() => () => { cancelAnimationFrame(frame.current); drag.current = null }, [])

  useEffect(() => {
    const ring = control.current
    if (!ring) return
    // SVG geometry does not consistently establish a touch-action region. Keep
    // this listener on the ring so gestures in the open centre still scroll.
    const keepDrag = (event: TouchEvent) => {
      if (event.touches.length === 1 && event.cancelable) event.preventDefault()
    }
    ring.addEventListener('touchstart', keepDrag, { passive: false })
    ring.addEventListener('touchmove', keepDrag, { passive: false })
    return () => {
      ring.removeEventListener('touchstart', keepDrag)
      ring.removeEventListener('touchmove', keepDrag)
    }
  }, [])

  function indexAt(event: PointerEvent<SVGCircleElement>) {
    const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - .5
    const y = (event.clientY - bounds.top) / bounds.height - .5
    const angle = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2)
    return Math.round(angle / (Math.PI * 2) * days.length) % days.length
  }
  function begin(event: PointerEvent<SVGCircleElement>) {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    const index = indexAt(event)
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, index }
    setDragging(true)
    onSelect(index)
  }
  function move(event: PointerEvent<SVGCircleElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current.index = indexAt(event)
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      if (drag.current) onSelect(drag.current.index)
    })
  }
  function end(event: PointerEvent<SVGCircleElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    cancelAnimationFrame(frame.current)
    frame.current = 0
    if (event.type === 'pointerup') onSelect(indexAt(event))
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function keys(event: KeyboardEvent<SVGCircleElement>) {
    const next = event.key === 'ArrowRight' ? selected + 1 : event.key === 'ArrowLeft' ? selected - 1
      : event.key === 'ArrowUp' ? selected + 7 : event.key === 'ArrowDown' ? selected - 7
        : event.key === 'Home' ? 0 : event.key === 'End' ? days.length - 1 : null
    if (next === null) return
    event.preventDefault()
    onSelect(Math.max(0, Math.min(days.length - 1, next)))
  }

  return <>
    <span className={styles.chartNumber} aria-hidden="true">84<small>DAYS / RECORDED TIME</small></span>
    <svg viewBox="0 0 520 520" className={styles.dial} data-dragging={dragging} role="group" aria-label={copy.label}>
      <g aria-hidden="true">
        <circle className={styles.orbit} cx="260" cy="260" r="234" />
        <circle className={styles.focusOrbit} cx="260" cy="260" r="246" />
        <circle className={styles.orbit} cx="260" cy="260" r="174" strokeDasharray="1 8" />
        <path className={styles.crosshair} d="M260 10V38M260 482V510M10 260H38M482 260H510" />
        {days.map((day, index) => <g key={day} data-date={day} data-active={active.has(day)} data-week={Math.floor(index / 7) === week} className={styles.tick} transform={`rotate(${index / days.length * 360} 260 260)`}>
          <path d={`M260 ${active.has(day) ? 55 : 72}V${index % 7 === 0 ? 104 : 93}`} />
          {active.has(day) && <circle cx="260" cy="120" r="3" />}
        </g>)}
        <g className={styles.needle} style={{ transform: `rotate(${selected / days.length * 360}deg)` }} data-testid="voyage-dial-needle">
          <path d="M260 49V139" /><circle cx="260" cy="49" r="8" /><circle className={styles.needleCore} cx="260" cy="49" r="3" />
        </g>
      </g>
      <circle ref={control} className={styles.dialControl} cx="260" cy="260" r="195" tabIndex={0}
        role="slider" aria-label={copy.label} aria-describedby={descriptionId}
        aria-valuemin={1} aria-valuemax={days.length} aria-valuenow={selected + 1}
        aria-valuetext={`${fullDate} · ${active.has(current) ? copy.recorded : copy.quiet}`}
        data-testid="voyage-dial-control" onPointerDown={begin} onPointerMove={move}
        onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={keys} />
    </svg>
    <div className={styles.dialDate} aria-hidden="true"><span>{current.slice(0, 7).replace('-', ' / ')}</span><strong>{current.slice(-2)}</strong><span>{weekday}</span><i data-active={active.has(current)} /></div>
    <p className={styles.dialHint} id={descriptionId}>{copy.hint}<span>{copy.keyboard}</span></p>
    <div className={styles.chartEnds} aria-hidden="true"><span>{copy.start}<b>{days[0].slice(5).replace('-', '.')}</b></span><span>{copy.today}<b>{days.at(-1)!.slice(5).replace('-', '.')}</b></span></div>
  </>
}
