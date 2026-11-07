'use client'
/* eslint-disable @next/next/no-img-element -- Article covers are external Markdown images. */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import { useAppearance } from '@/components/appearance/appearance-store'
import { articlePreview, dateLabel, excerpt, translate, type Entry, type Locale } from '@/lib/blog'
import styles from './voyage-home.module.scss'

const COPY = {
  zh: { title: '夜航', words: ['夜', '航'], heading: '从一段文字，驶向别处。', recent: '最近留下的记录', route: '阅读航线', previous: '上一段记录', next: '下一段记录', open: '打开这一页', continue: '继续阅读', writings: '文章', moments: '片刻', allWritings: '全部文章', allMoments: '全部片刻', empty: '下一段记录，从这里开始。', emptyNote: '文字与片刻，会在这条航线上留下坐标。', closing: '记录未完。', about: '写在这里的人', earlier: '更早的记录', latest: '最新记录' },
  en: { title: 'Night Voyage', words: ['Night', 'Voyage'], heading: 'One page. Somewhere else.', recent: 'Recent records', route: 'Reading route', previous: 'Previous record', next: 'Next record', open: 'Open this page', continue: 'Keep reading', writings: 'Writings', moments: 'Moments', allWritings: 'All writings', allMoments: 'All moments', empty: 'The next record begins here.', emptyNote: 'Words and moments will leave their coordinates along this route.', closing: 'Still writing.', about: 'Behind the words', earlier: 'Earlier records', latest: 'Latest record' },
  ja: { title: '夜航', words: ['夜', '航'], heading: '一つの文章から、まだ見ぬ場所へ。', recent: '最近の記録', route: '読む航路', previous: '前の記録', next: '次の記録', open: 'このページを開く', continue: '続きを読む', writings: '日誌', moments: '瞬間', allWritings: 'すべての日誌', allMoments: 'すべての瞬間', empty: '次の記録は、ここから。', emptyNote: '言葉と瞬間が、この航路に座標を残していく。', closing: '記録は続く。', about: 'ここに書く人', earlier: 'これまでの記録', latest: '最新の記録' },
  de: { title: 'Nachtfahrt', words: ['Nacht', 'fahrt'], heading: 'Eine Seite. Ein anderer Ort.', recent: 'Neueste Aufzeichnungen', route: 'Leseroute', previous: 'Voriger Eintrag', next: 'Nächster Eintrag', open: 'Diese Seite öffnen', continue: 'Weiterlesen', writings: 'Texte', moments: 'Momente', allWritings: 'Alle Texte', allMoments: 'Alle Momente', empty: 'Hier beginnt der nächste Eintrag.', emptyNote: 'Worte und Augenblicke werden entlang dieser Route ihre Spuren hinterlassen.', closing: 'Noch nicht zu Ende.', about: 'Hinter den Worten', earlier: 'Frühere Einträge', latest: 'Neuester Eintrag' },
}

type PreviewPose = Partial<Record<'image' | 'meta' | 'category' | 'title' | 'note' | 'open', CSSProperties>>
type RecordKind = 'article' | 'moment'
type RouteRecord = { key: string; kind: RecordKind; entry: Entry; title: string; note: string; href: string; image?: string; date: string; category?: string }
type RoutePoint = { x: number; y: number }

function collectRecords(articles: Entry[], moments: Entry[], locale: Locale): RouteRecord[] {
  const seen = new Set<string>()
  return ([...articles.map(entry => ({ entry, kind: 'article' as const })), ...moments.map(entry => ({ entry, kind: 'moment' as const }))])
    .filter(({ entry }) => {
      if (seen.has(entry._id)) return false
      seen.add(entry._id)
      return true
    })
    .sort((a, b) => (Date.parse(b.entry.createdAt) || 0) - (Date.parse(a.entry.createdAt) || 0))
    .map(({ entry, kind }) => {
      const preview = articlePreview(entry.content)
      return { key: `${kind}:${entry._id}`, kind, entry, title: entry.title?.trim() || excerpt(preview.content, 60) || translate(locale, kind === 'article' ? 'articles' : 'moments'), note: excerpt(preview.content, 150), href: `/${kind === 'article' ? 'articles' : 'moments'}/${entry._id}`, image: preview.coverUrl, date: entry.createdAt, category: entry.category }
    })
}

function routeGeometry(count: number) {
  const points = Array.from({ length: count }, (_, index) => ({ x: (index + .5) * 1000 / count, y: count === 1 ? 65 : index % 2 ? 32 : 88 }))
  const first = points[0], last = points.at(-1)
  if (!first || !last) return { points, track: '', progress: '' }
  const segments = points.slice(1).map((point, index) => {
    const previous = points[index], middle = (previous.x + point.x) / 2
    return `C${middle} ${previous.y} ${middle} ${point.y} ${point.x} ${point.y}`
  }).join(' ')
  return { points, track: `M0 ${first.y}H${first.x} ${segments} H1000`, progress: count === 1 ? `M${first.x} ${first.y}h.001` : `M${first.x} ${first.y} ${segments}` }
}

function shortDate(value: string, locale: Locale) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? dateLabel(value, locale) : `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export default function VoyageHome({ locale, articles, moments, articleState, momentState, activity }: {
  locale: Locale; articles: Entry[]; moments: Entry[]; articleState: ReactNode; momentState: ReactNode; activity?: ReactNode
}) {
  const copy = COPY[locale]
  const { design } = useAppearance()
  const records = collectRecords(articles, moments, locale)
  const stops = records.slice(0, 4)
  const remaining = records.slice(4)
  const geometry = routeGeometry(stops.length)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = Math.max(0, stops.findIndex(record => record.key === selectedKey))
  const stop = stops[selected]
  const routePath = useRef<SVGPathElement>(null)
  const beacon = useRef<HTMLSpanElement>(null)
  const travelled = useRef(0)
  const generation = useRef(0)
  const [direction, setDirection] = useState(1)
  const [outgoing, setOutgoing] = useState<{ stop: RouteRecord; index: number; generation: number; direction: number; pose: PreviewPose } | null>(null)
  const tabs = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number } | null>(null)
  const home = useRef<HTMLDivElement>(null)
  const count = stops.length
  useEffect(() => {
    if (!outgoing) return
    const timer = window.setTimeout(() => setOutgoing(null), 320)
    return () => clearTimeout(timer)
  }, [outgoing])
  useEffect(() => {
    const path = routePath.current, marker = beacon.current
    if (!path || !marker) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const target = count > 1 ? selected / (count - 1) : 0, from = travelled.current
    const length = path.getTotalLength()
    let frame = 0
    const paint = (position: number) => {
      travelled.current = position
      const point = path.getPointAtLength(position * length)
      path.style.strokeDashoffset = String(1 - position)
      marker.style.left = `${point.x / 10}%`
      marker.style.top = `${point.y / 1.3}%`
    }
    const finish = () => { cancelAnimationFrame(frame); paint(target); marker.dataset.travelling = 'false' }
    const simplify = () => { if (document.hidden || motion.matches) finish() }
    if (design !== 'voyage' || motion.matches || document.hidden || Math.abs(target - from) < .001) { finish(); return }
    const start = performance.now(), duration = 340 + Math.abs(target - from) * 280
    marker.dataset.travelling = 'true'
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      paint(from + (target - from) * (1 - (1 - progress) ** 3))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else marker.dataset.travelling = 'false'
    }
    frame = requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', simplify)
    motion.addEventListener('change', simplify)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', simplify); motion.removeEventListener('change', simplify) }
  }, [selected, count, design])
  const select = (index: number, focus = false) => {
    if (!count) return
    const next = (index + count) % count
    if (next !== selected && stop) {
      setDirection(Math.sign(index - selected) || 1)
      const pose: PreviewPose = {}
      if (!outgoing) {
        const current = home.current?.querySelector('[data-preview-layer="current"]')
        for (const [part, selector] of Object.entries({ image: `.${styles.previewImage}`, meta: `.${styles.previewMeta}`, category: `.${styles.previewCategory}`, title: 'h2', note: `.${styles.previewText}>p`, open: `.${styles.openPage}` })) {
          const element = current?.querySelector(selector)
          if (!element) continue
          const appearance = getComputedStyle(element)
          pose[part as keyof PreviewPose] = { opacity: appearance.opacity, transform: appearance.transform }
        }
      }
      const snapshot = { stop, index: selected, generation: ++generation.current, direction: Math.sign(index - selected) || 1, pose }
      setOutgoing(previous => matchMedia('(prefers-reduced-motion: reduce)').matches ? null : previous || snapshot)
      setSelectedKey(stops[next].key)
    }
    if (focus) tabs.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
  }
  const routeKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? selected + 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? selected - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null
    if (next !== null) { event.preventDefault(); select(next, true) }
  }
  const swipeStart = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.pointerType === 'mouse' || (event.target as HTMLElement).closest('a,button')) return
    gesture.current = { x: event.clientX, y: event.clientY }
  }
  const swipeEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = gesture.current
    gesture.current = null
    if (!start) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) select(selected + (dx < 0 ? 1 : -1))
  }
  const kindLabel = (kind: RecordKind) => kind === 'article' ? copy.writings : copy.moments
  const renderPreview = (record: RouteRecord, index: number, ghost = false, key = record.key, pose: PreviewPose = {}, exitDirection = direction) => <div key={key} className={`${styles.previewInner}${ghost ? ` ${styles.previewGhost}` : ''}`} aria-hidden={ghost || undefined} inert={ghost || undefined} data-preview-layer={ghost ? 'outgoing' : 'current'} data-cover={!!record.image} data-record-key={record.key} style={ghost ? { '--travel-direction': exitDirection } as CSSProperties : undefined}>
    <div className={styles.previewMeta} style={pose.meta}><span><i/>{kindLabel(record.kind)}{index === 0 && <small>{copy.latest}</small>}</span><time dateTime={record.date}>{dateLabel(record.date, locale)}</time></div>
    <div className={styles.previewText}>{record.category && <span className={styles.previewCategory} style={pose.category}>{record.category}</span>}<h2 style={pose.title}><Link href={record.href}>{record.title}</Link></h2><p style={pose.note}>{record.note}</p><Link style={pose.open} className={styles.openPage} href={record.href}><span>{copy.open}</span><ArrowUpRight size={25} strokeWidth={1.3}/></Link></div>
    {record.image && <div className={styles.previewImage} style={pose.image} aria-hidden="true"><img src={record.image} alt="" /><span className={styles.imageCaption}>{kindLabel(record.kind)} / {shortDate(record.date, locale)}</span></div>}
  </div>
  return <div ref={home} className={styles.home} data-testid="voyage-home" lang={locale}>
    <section className={styles.hero} aria-labelledby="voyage-title">
      <div className={styles.spine}>
        <div className={styles.topline}><span>YOROROICE / ARK</span><span>07</span></div>
        <div className={styles.titleBlock}><h1 id="voyage-title" data-cjk={locale === 'zh' || locale === 'ja'} aria-label={copy.title}><span><b>{copy.words[0]}</b></span><span><b>{copy.words[1]}</b></span></h1><span className={styles.spineEnglish} aria-hidden="true">NIGHT<br/>VOYAGE</span></div>
        <p className={styles.atlasIntro}>{copy.heading}</p>
        <div className={styles.spineBottom}><span>A PERSONAL<br/>READING ATLAS</span><a href="#voyage-logbook" aria-label={copy.continue}><ArrowDown size={21}/></a></div>
      </div>
      <div className={styles.atlas} style={{ '--stop': selected, '--stop-count': Math.max(count, 1), '--course': count > 1 ? selected / (count - 1) : 0, '--travel-direction': direction, '--origin-x': `${(geometry.points[0]?.x || 0) / 10}%`, '--origin-y': `${(geometry.points[0]?.y || 0) / 1.3}%` } as CSSProperties}>
        <div className={styles.atlasTop}><span>{copy.recent}</span><span>{count ? `${String(count).padStart(2, '0')} / RECORD${count === 1 ? '' : 'S'}` : 'READING ATLAS'}</span></div>
        {stop ? <>
          <div className={styles.routePicker} ref={tabs} role="tablist" aria-label={copy.route} onKeyDown={routeKeys} data-count={count}>
            <div className={styles.routeSurface} aria-hidden="true"><svg viewBox="0 0 1000 130" preserveAspectRatio="none"><path d={geometry.track}/><path ref={routePath} className={styles.routeProgress} d={geometry.progress} pathLength="1"/></svg><span ref={beacon} className={styles.routeBeacon} data-testid="voyage-route-beacon" data-travelling="false"><i/></span></div>
            {stops.map((record, index) => <button key={record.key} id={`voyage-stop-${index}`} aria-controls="voyage-preview" aria-selected={selected === index} aria-label={`${dateLabel(record.date, locale)} · ${kindLabel(record.kind)} · ${record.title}`} title={record.title} role="tab" tabIndex={selected === index ? 0 : -1} onClick={() => select(index)} data-testid={`voyage-stop-${index}`} data-record-key={record.key} style={{ '--station-y': (geometry.points[index] as RoutePoint).y / 130 } as CSSProperties}><span className={styles.point}><i/></span><time dateTime={record.date}>{shortDate(record.date, locale)}</time><span>{kindLabel(record.kind)}</span></button>)}
          </div>
          <div id="voyage-preview" className={styles.preview} role="tabpanel" aria-labelledby={`voyage-stop-${selected}`} tabIndex={0} onPointerDown={swipeStart} onPointerUp={swipeEnd} onPointerCancel={() => { gesture.current = null }} data-selected={selected}>
            {outgoing && renderPreview(outgoing.stop, outgoing.index, true, `outgoing-${outgoing.generation}`, outgoing.pose, outgoing.direction)}
            {renderPreview(stop, selected)}
          </div>
          <div className={styles.atlasBottom}><span><b>{String(selected + 1).padStart(2, '0')}</b> / {String(count).padStart(2, '0')}</span><span>{selected === 0 ? copy.latest : copy.earlier}</span>{count > 1 && <div><button type="button" onClick={() => select(selected - 1)} aria-label={copy.previous}><ArrowLeft size={20}/></button><button type="button" onClick={() => select(selected + 1)} aria-label={copy.next}><ArrowRight size={20}/></button></div>}</div>
        </> : <div className={styles.emptyAtlas}><span aria-hidden="true">—</span><h2>{copy.empty}</h2><p>{copy.emptyNote}</p><Link href="/articles">{copy.allWritings}<ArrowUpRight size={22}/></Link></div>}
      </div>
    </section>
    <section className={styles.directory} id="voyage-logbook" data-empty={!remaining.length} aria-labelledby={remaining.length ? 'voyage-continue-title' : undefined} aria-label={remaining.length ? undefined : copy.continue}>
      {remaining.length ? <>
        <header className={styles.directoryHead}><h2 id="voyage-continue-title">{copy.continue}</h2><div><Link href="/gallery">{translate(locale, 'gallery')}<ArrowUpRight size={16}/></Link><Link href="/archive">{translate(locale, 'archive')}<ArrowUpRight size={16}/></Link></div></header>
        <div className={styles.directoryColumns}>{(['article', 'moment'] as const).map(kind => <div key={kind}>
          <header className={styles.columnHead}><h3>{kindLabel(kind)}</h3><Link href={kind === 'article' ? '/articles' : '/moments'}>{kind === 'article' ? copy.allWritings : copy.allMoments}<ArrowUpRight size={17}/></Link></header>
          {kind === 'article' ? articleState : momentState}
          {remaining.filter(record => record.kind === kind).map(record => <Link key={record.key} href={record.href} className={styles.directoryEntry} data-record-key={record.key}><time dateTime={record.date}>{dateLabel(record.date, locale)}</time><h3>{record.title}</h3><ArrowUpRight size={20}/></Link>)}
        </div>)}</div>
      </> : <>
        <div className={styles.browse}>{[['/articles', copy.writings], ['/moments', copy.moments], ['/gallery', translate(locale, 'gallery')], ['/archive', translate(locale, 'archive')]].map(([href, label]) => <Link key={href} href={href}>{label}<ArrowUpRight size={19}/></Link>)}</div>
        <div className={styles.directoryStates}><section aria-label={copy.writings} data-label={copy.writings}>{articleState}</section><section aria-label={copy.moments} data-label={copy.moments}>{momentState}</section></div>
      </>}
    </section>
    {activity}
    <aside className={styles.closing}><p>{copy.closing}</p><Link href="/about"><span>{copy.about}</span><ArrowUpRight size={24} strokeWidth={1.3}/></Link></aside>
  </div>
}
