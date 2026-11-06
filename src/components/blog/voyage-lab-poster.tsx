'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type Ref } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import type { Locale } from '@/lib/blog'
import styles from './voyage-lab-poster.module.scss'

const COPY = {
  zh: { title: ['把时间，', '交给一条', '曲线。'], body: '慢下来，或向前赶。用公式与手绘，重新安排一段声音、一个画面的节奏。', sample: '沿时间轴取样', hint: '移动刻度，读出这一刻的播放速度。', ratio: '时长比例', speed: '播放速度', curve: '示例曲线', note: '载入媒体，开始你的实验。' },
  en: { title: ['PLAY', 'WITH TIME.'], body: 'Linger. Then move ahead. Give sound and moving images a different rhythm with a formula or a line of your own.', sample: 'Sample the timeline', hint: 'Move along the scale to read the playback speed.', ratio: 'Time fraction', speed: 'Playback speed', curve: 'Sample curve', note: 'Bring a recording. Make it your experiment.' },
  ja: { title: ['時間を、', 'ひとすじの', '曲線に。'], body: 'ゆっくりと、時には先へ。数式や手描きの線で、音と映像のリズムを組み直す。', sample: '時間軸をたどる', hint: '目盛りを動かして、その瞬間の再生速度を読む。', ratio: '時間の割合', speed: '再生速度', curve: '曲線の例', note: '音や映像を読み込み、実験を始めよう。' },
  de: { title: ['ZEIT IN', 'BEWEGUNG.'], body: 'Verweilen. Weiterziehen. Gib Ton und bewegten Bildern einen neuen Rhythmus – mit einer Formel oder deiner eigenen Linie.', sample: 'Zeitachse abtasten', hint: 'Verschiebe die Marke und lies die Wiedergabegeschwindigkeit ab.', ratio: 'Zeitanteil', speed: 'Wiedergabetempo', curve: 'Beispielkurve', note: 'Lade eine Aufnahme. Beginne dein Experiment.' },
}
const INITIAL = 625
const speedAt = (sample: number) => 2 + Math.sin(sample / 1000 * Math.PI * 4)
const yAt = (sample: number) => (3 - speedAt(sample)) / 2 * 400
const CURVE = Array.from({ length: 501 }, (_, index) => {
  const x = index * 2
  return `${index ? 'L' : 'M'}${x},${yAt(x).toFixed(3)}`
}).join(' ')

/** A time/speed specimen. The slider samples the player's initial function;
 * it never changes the media tool or invents a duration before a file exists. */
export default function VoyageLabPoster({ locale, active, open, toggle, buttonRef, actionLabel }: {
  locale: Locale
  active: boolean
  open: boolean
  toggle: () => void
  buttonRef?: Ref<HTMLButtonElement>
  actionLabel: string
}) {
  const copy = COPY[locale]
  const uid = useId().replaceAll(':', '')
  const graph = useRef<HTMLDivElement>(null)
  const stop = useRef(() => {})
  const introduced = useRef(false)
  const [sample, setSample] = useState(INITIAL)
  const [drawing, setDrawing] = useState(false)
  const multiplier = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(speedAt(sample))
  const fraction = new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(sample / 1000)

  useEffect(() => {
    const plot = graph.current
    if (!plot || !active || introduced.current) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, started = false, visible = false, alive = true
    const detach = () => {
      observer?.disconnect(); transition?.disconnect()
      motion.removeEventListener('change', simplify)
      document.removeEventListener('visibilitychange', simplify)
    }
    const settle = (arrive: boolean) => {
      if (introduced.current) return
      cancelAnimationFrame(frame); frame = 0
      introduced.current = true; detach()
      if (alive) { setDrawing(false); if (arrive) setSample(INITIAL) }
    }
    const simplify = () => { if (motion.matches || document.hidden) settle(true) }
    stop.current = () => settle(false)
    if (motion.matches || document.hidden) { introduced.current = true; return }
    const beginWhenVisible = () => {
      const phase = document.documentElement.dataset.voyageWipe
      if (!visible || started || introduced.current || (phase && phase !== 'idle')) return
      started = true; setDrawing(true); setSample(0)
      const begin = performance.now()
      const draw = (now: number) => {
        const progress = Math.min(1, (now - begin) / 1150)
        setSample(Math.round(INITIAL * progress * progress * (3 - 2 * progress) / 5) * 5)
        if (progress < 1) frame = requestAnimationFrame(draw)
        else settle(true)
      }
      frame = requestAnimationFrame(draw)
    }
    const observer = new IntersectionObserver(entries => {
      visible = !!entries[0]?.isIntersecting
      if (!visible && started) settle(true)
      else beginWhenVisible()
    }, { threshold: .12 })
    const transition = new MutationObserver(beginWhenVisible)
    transition.observe(document.documentElement, { attributes: true, attributeFilter: ['data-voyage-wipe'] })
    observer.observe(plot)
    // Wait at the origin while a route sheet or the page fold hides the plot.
    queueMicrotask(() => { if (alive && !started && !introduced.current) setSample(0) })
    motion.addEventListener('change', simplify)
    document.addEventListener('visibilitychange', simplify)
    return () => {
      alive = false; detach(); cancelAnimationFrame(frame)
      stop.current = () => {}
    }
  }, [active])

  return <section className={styles.poster} data-testid="voyage-lab-poster" data-drawing={drawing} aria-labelledby={`${uid}-title`}>
    <header className={styles.masthead} aria-hidden="true"><span>EXPERIMENT / 001</span><span>STUDIES IN TIME</span><span>f(t)</span></header>
    <div className={styles.copy}>
      <span className={styles.kicker}>TIME / RECOMPOSED</span>
      <h2 id={`${uid}-title`} className={styles.title} data-cjk={locale === 'zh' || locale === 'ja'}>{copy.title.map((line, index) => <span key={line} data-final={index === copy.title.length - 1}>{line}</span>)}</h2>
      <p className={styles.body}>{copy.body}</p>
      <button ref={buttonRef} type="button" className={styles.action} onClick={toggle} aria-expanded={active ? open : undefined} aria-controls={active ? 'lab-workspace' : undefined}>{actionLabel}{open ? <X size={19} aria-hidden="true" /> : <ArrowUpRight size={19} aria-hidden="true" />}</button>
    </div>
    <div className={styles.instrument}>
      <div className={styles.instrumentHead}><div><span>01 / {copy.curve}</span><p>{copy.speed}</p></div><output aria-live="off" className={styles.speed} htmlFor={`${uid}-sample`} data-testid="voyage-lab-speed">{multiplier}<small>×</small></output></div>
      <div className={styles.plot} style={{ '--sample': sample / 10, '--sample-y': yAt(sample) / 4 } as CSSProperties}>
        <div className={styles.yAxis} aria-hidden="true"><span>3×</span><span>2×</span><span>1×</span></div>
        <div ref={graph} className={styles.graph}>
          <svg viewBox="0 0 1000 400" preserveAspectRatio="none" fill="none" aria-hidden="true">
            <defs><clipPath id={`${uid}-clip`}><rect x="0" y="-5" width={sample} height="410" /></clipPath></defs>
            <path className={styles.grid} d="M0 0H1000M0 200H1000M0 400H1000M250 0V400M500 0V400M750 0V400" vectorEffect="non-scaling-stroke" />
            <path className={styles.underlay} d={CURVE} vectorEffect="non-scaling-stroke" />
            <g clipPath={`url(#${uid}-clip)`}><path className={styles.area} d={`${CURVE} L1000,400H0Z`} /><path className={styles.trace} d={CURVE} vectorEffect="non-scaling-stroke" /></g>
          </svg>
          <span className={styles.sampleLine} aria-hidden="true" /><span className={styles.point} aria-hidden="true" data-testid="voyage-lab-point" />
          <div className={styles.xAxis} aria-hidden="true">{['0', '¼', '½', '¾', '1'].map(value => <span key={value}>{value}</span>)}</div>
        </div>
      </div>
      <div className={styles.sampling}>
        <label htmlFor={`${uid}-sample`}><span>{copy.sample}</span><span aria-hidden="true">← →</span></label>
        <div className={styles.controlRow}><input id={`${uid}-sample`} className={styles.slider} type="range" min="0" max="1000" step="5" value={sample} aria-describedby={`${uid}-hint`} aria-valuetext={`${copy.ratio} ${fraction} · ${multiplier}×`} onPointerDown={() => stop.current()} onFocus={() => stop.current()} onChange={event => { stop.current(); setSample(Number(event.target.value)) }} /><output aria-live="off" htmlFor={`${uid}-sample`} className={styles.fraction}>{fraction}<small>t/d</small></output></div>
        <p id={`${uid}-hint`}>{copy.hint}</p>
      </div>
    </div>
    <footer className={styles.foot}><span>v(t) = 2 + sin(4π · t/d)</span><p>{copy.note}</p></footer>
  </section>
}
