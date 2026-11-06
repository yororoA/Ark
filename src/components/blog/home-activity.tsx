'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import { translate, type Locale } from '@/lib/blog'
import HomeCodeActivity from './home-code-activity'
import VoyageDial from './voyage-dial'
import styles from './home-activity.module.scss'

type ActivityDesign = 'voyage' | 'allotype' | 'fold'
type GithubSummary = { reposCount: number; monthCommits: number; languages: { name: string; percent: number }[] }
type Props = { locale: Locale; design: ActivityDesign; activeDates?: string[]; github?: GithubSummary; calendarState: ReactNode; githubState: ReactNode }

const COPY = {
  zh: { title: '时间，会留下坐标。', note: '写下的日子，都是抵达。', period: '最近 84 天', days: '个有记录的日子', recorded: '这一天，留下了片刻。', quiet: '这一天，没有公开片刻。', open: '翻开当天的片刻', previous: '前一周', next: '后一周', week: '周', hint: '选择日期，回看公开的片刻。', origin: '起点', today: '今天', legend: '有记录', empty: '暂无记录' },
  en: { title: 'Time leaves coordinates.', note: 'Every recorded day, an arrival.', period: 'Last 84 days', days: 'days with entries', recorded: 'A moment was left here.', quiet: 'No public moments on this day.', open: 'Read this day’s moments', previous: 'Previous week', next: 'Next week', week: 'Week', hint: 'Choose a date to revisit public moments.', origin: 'Beginning', today: 'Today', legend: 'Recorded', empty: 'No entries' },
  ja: { title: '時間が、座標になる。', note: '書き留めた日々も、一つの到着。', period: '直近84日', days: '記録のある日', recorded: 'この日に、瞬間が残りました。', quiet: 'この日の公開された瞬間はありません。', open: 'この日の瞬間を読む', previous: '前の週', next: '次の週', week: '週', hint: '日付を選び、公開された瞬間をたどる。', origin: 'はじまり', today: '今日', legend: '記録あり', empty: '記録なし' },
  de: { title: 'Zeit hinterlässt Koordinaten.', note: 'Jeder festgehaltene Tag, eine Ankunft.', period: 'Letzte 84 Tage', days: 'Tage mit Einträgen', recorded: 'Hier blieb ein Moment.', quiet: 'Keine öffentlichen Momente an diesem Tag.', open: 'Momente dieses Tages lesen', previous: 'Vorherige Woche', next: 'Nächste Woche', week: 'Woche', hint: 'Wähle ein Datum für öffentliche Momente.', origin: 'Beginn', today: 'Heute', legend: 'Mit Eintrag', empty: 'Ohne Eintrag' },
}
const LOCALES = { zh: 'zh-CN', en: 'en-GB', ja: 'ja-JP', de: 'de-DE' }
const DAY = 86400000

function Calendar({ locale, design, activeDates }: { locale: Locale; design: ActivityDesign; activeDates: string[] }) {
  const copy = COPY[locale]
  const [days] = useState(() => {
    const now = new Date()
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    return Array.from({ length: 84 }, (_, index) => new Date(end - (83 - index) * DAY).toISOString().slice(0, 10))
  })
  const active = new Set(activeDates)
  const [selected, setSelected] = useState(() => {
    const latest = days.findLastIndex(day => active.has(day))
    return latest === -1 ? 83 : latest
  })
  const controls = useRef<HTMLDivElement>(null)
  const week = Math.floor(selected / 7)
  const current = days[selected]
  const recorded = active.has(current)
  const count = days.filter(day => active.has(day)).length
  const dateFormat = new Intl.DateTimeFormat(LOCALES[locale], { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const weekdayFormat = new Intl.DateTimeFormat(LOCALES[locale], { weekday: 'short', timeZone: 'UTC' })
  const longFormat = new Intl.DateTimeFormat(LOCALES[locale], { dateStyle: 'full', timeZone: 'UTC' })
  useLayoutEffect(() => {
    const strip = controls.current?.querySelector<HTMLElement>(`[data-calendar-days]`)
    if (!strip) return
    const reveal = () => {
      const target = strip.querySelector<HTMLElement>('[aria-pressed="true"]')
      if (!target) return
      const bounds = strip.getBoundingClientRect(), day = target.getBoundingClientRect()
      const distance = day.left < bounds.left ? day.left - bounds.left : day.right > bounds.right ? day.right - bounds.right : 0
      // Reveal the date inside its horizontal strip, without moving the page
      // when a week changes or the viewport becomes narrower.
      if (distance) strip.scrollBy({ left: distance, behavior: 'instant' })
    }
    reveal()
    const observer = new ResizeObserver(reveal)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [selected])
  function selectDay(index: number, focus = false) {
    const next = Math.max(0, Math.min(83, index))
    setSelected(next)
    // Roving focus follows the newly rendered week, including its clipped edge
    // on narrow phones. No scroll is forced when the previous/next week is used.
    if (focus) requestAnimationFrame(() => {
      const target = controls.current?.querySelector<HTMLButtonElement>(`[data-date="${days[next]}"]`)
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    })
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (!target.matches('button[data-date]')) return
    const next = event.key === 'ArrowRight' ? selected + 1 : event.key === 'ArrowLeft' ? selected - 1
      : event.key === 'ArrowDown' ? selected + 7 : event.key === 'ArrowUp' ? selected - 7
        : event.key === 'Home' ? week * 7 : event.key === 'End' ? week * 7 + 6 : null
    if (next === null) return
    event.preventDefault()
    selectDay(next, true)
  }
  return <div className={styles.calendarBody}>
    <div className={styles.instrument} data-testid="calendar-overview" aria-hidden={design !== 'voyage' || undefined}>
      {design === 'voyage' ? <VoyageDial days={days} active={active} selected={selected} locale={locale} onSelect={selectDay}/> : <>
        <div className={styles.printHeading}><span>84 / {copy.period}</span><strong>{String(count).padStart(2, '0')}<small>{copy.days}</small></strong></div>
        <svg className={styles.print} viewBox="0 0 480 280">
          {days.map((day, index) => <g key={day} data-date={day} data-active={active.has(day)} data-week={Math.floor(index / 7) === week} data-selected={index === selected} className={styles.printDay} transform={`translate(${Math.floor(index / 7) * 40 + 20} ${(index % 7) * 40 + 20})`}>
            {design === 'allotype' ? <circle r="12" /> : <path d="M-13-13H13V8L8 13H-13Z" />}
          </g>)}
        </svg>
        <div className={styles.printLegend}><span><i />{copy.legend}</span><span><i />{copy.empty}</span><span>UTC</span></div>
      </>}
    </div>
    <div className={styles.dateControls} ref={controls} onKeyDown={navigate}>
      <div className={styles.calendarLabel}><span>03 / {translate(locale, 'calendar')}</span><span>{copy.period} · UTC</span></div>
      <h2>{design === 'voyage' ? copy.title : translate(locale, 'calendar')}</h2>
      <p className={styles.calendarNote}>{copy.hint}</p>
      <div className={styles.weeks} role="group" aria-label={`${copy.period} / ${copy.week}`}>
        {Array.from({ length: 12 }, (_, index) => <button key={index} type="button" aria-label={`${copy.week} ${index + 1}: ${dateFormat.format(new Date(`${days[index * 7]}T00:00:00Z`))}`} aria-pressed={week === index} onClick={() => selectDay(index * 7 + selected % 7)} style={{ '--active-days': days.slice(index * 7, index * 7 + 7).filter(day => active.has(day)).length } as CSSProperties}><span>{String(index + 1).padStart(2, '0')}</span><i /></button>)}
      </div>
      <div className={styles.weekHeading}>
        <button type="button" data-testid="calendar-previous" aria-label={copy.previous} disabled={week === 0} onClick={() => selectDay(selected - 7)}><ArrowLeft size={18}/></button>
        <span>{dateFormat.format(new Date(`${days[week * 7]}T00:00:00Z`))} — {dateFormat.format(new Date(`${days[week * 7 + 6]}T00:00:00Z`))}</span>
        <button type="button" data-testid="calendar-next" aria-label={copy.next} disabled={week === 11} onClick={() => selectDay(selected + 7)}><ArrowRight size={18}/></button>
      </div>
      <div className={styles.days} data-calendar-days role="group" aria-label={translate(locale, 'calendar')}>
        {days.slice(week * 7, week * 7 + 7).map((day, index) => <button key={day} type="button" data-date={day} data-active={active.has(day)} aria-pressed={current === day} tabIndex={current === day ? 0 : -1} aria-label={`${longFormat.format(new Date(`${day}T00:00:00Z`))} · ${active.has(day) ? copy.legend : copy.empty}`} onClick={() => selectDay(week * 7 + index)}>
          <small>{weekdayFormat.format(new Date(`${day}T00:00:00Z`))}</small><strong>{day.slice(-2)}</strong><i />
        </button>)}
      </div>
      <div className={styles.selectedDay}>
        <time dateTime={current}>{current.replaceAll('-', ' / ')}</time>
        <p>{recorded ? copy.recorded : copy.quiet}</p>
      </div>
      {recorded ? <Link className={styles.openDay} data-testid="calendar-open" href={`/moments?date=${current}`} prefetch={false}>{copy.open}<ArrowUpRight size={22}/></Link> : <div className={styles.quietLine} aria-hidden="true"><span /> <i /> <span /></div>}
      <div className={styles.calendarFoot}><span><b>{count}</b> / 84 {copy.days}</span><span>{copy.note}</span></div>
    </div>
  </div>
}

export default function HomeActivity({ locale, design, activeDates, github, calendarState, githubState }: Props) {
  return <section className={styles.activity} data-design={design} data-testid="home-activity" lang={locale} aria-label={translate(locale, 'activity')}>
    <div className={styles.calendar} data-testid="activity-calendar">
      {activeDates ? <Calendar locale={locale} design={design} activeDates={activeDates}/> : <div className={styles.waiting}><h2>{translate(locale, 'calendar')}</h2></div>}
      {calendarState}
    </div>
    <HomeCodeActivity locale={locale} design={design} summary={github} state={githubState}/>
  </section>
}
