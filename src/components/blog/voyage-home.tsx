'use client'
/* eslint-disable @next/next/no-img-element -- Article covers are external Markdown images. */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import VoyageArt from '@/components/appearance/voyage-art'
import { useAppearance } from '@/components/appearance/appearance-store'
import { articlePreview, dateLabel, excerpt, translate, type Entry, type Locale } from '@/lib/blog'
import styles from './voyage-home.module.scss'

const COPY = {
  zh: { title: '夜航', words: ['夜', '航'], subtitle: '不必知道终点。\n先把今天写下来。', intro: '世界很大。\n留下一点自己的航迹。', enter: '翻开日志', scroll: '向下阅读', writings: '航行日志', moments: '途中来信', note: '没有宏大的叙事。\n只是一些不想遗忘的瞬间。', all: '全部文章', pause: '暂停海面', play: '让海面继续', closing: '记录未完。', about: '航行继续', selected: '最近一篇', archive: '过去的航迹', personal: '个人航行记录' },
  en: { title: 'Night Voyage', words: ['Night', 'Voyage'], subtitle: 'No destination required.\nBegin with today.', intro: 'A world wide open.\nA small trace of our own.', enter: 'Open the logbook', scroll: 'Scroll to read', writings: 'The logbook', moments: 'Dispatches', note: 'No grand narrative.\nJust moments worth keeping.', all: 'All writings', pause: 'Pause the sea', play: 'Resume the sea', closing: 'Still writing.', about: 'Still voyaging', selected: 'Latest entry', archive: 'Earlier passages', personal: 'A personal record' },
  ja: { title: '夜航', words: ['夜', '航'], subtitle: '行き先は、まだ決めなくていい。\nまず今日を書き留めよう。', intro: '世界は広い。\n自分だけの航跡を残そう。', enter: '日誌を開く', scroll: '下へ読み進む', writings: '航海日誌', moments: '旅の便り', note: '大きな物語ではなく、\n忘れたくない瞬間の記録。', all: 'すべての日誌', pause: '海を一時停止', play: '海を再開', closing: '記録は続く。', about: '航海は続く', selected: '最新の記録', archive: 'これまでの航跡', personal: '個人の航海記録' },
  de: { title: 'Nachtfahrt', words: ['Nacht', 'fahrt'], subtitle: 'Das Ziel darf offenbleiben.\nBeginne mit heute.', intro: 'Die Welt steht offen.\nEine kleine eigene Spur.', enter: 'Logbuch öffnen', scroll: 'Weiterlesen', writings: 'Das Logbuch', moments: 'Unterwegs', note: 'Keine große Erzählung.\nNur Momente, die bleiben sollen.', all: 'Alle Texte', pause: 'Meer anhalten', play: 'Meer fortsetzen', closing: 'Noch nicht zu Ende.', about: 'Die Reise geht weiter', selected: 'Neuester Eintrag', archive: 'Frühere Fahrten', personal: 'Persönliche Aufzeichnungen' },
}

const ATLAS = {
  zh: { tabs: ['文章', '片刻', '映像', '归档'], heading: '从一段文字，驶向别处。', hint: '选择一个坐标，翻开一段记录。', latest: '最近写下', moment: '最近片刻', gallery: '光落下的地方。', galleryNote: '照片、画面，以及那些比文字先被记住的瞬间。', archive: '沿时间回望。', archiveNote: '以时间为线索，重新走过留下的文字与片刻。', empty: '下一段记录，从这里开始。', previous: '上一个坐标', next: '下一个坐标', route: '阅读航线', open: '打开这一页', journal: '打开航行日志', moments: '翻看途中来信' },
  en: { tabs: ['Writings', 'Moments', 'Images', 'Archive'], heading: 'One page. Somewhere else.', hint: 'Choose a point. Follow a story.', latest: 'Latest writing', moment: 'Latest moment', gallery: 'Where the light falls.', galleryNote: 'Photographs, images, and the moments remembered before words.', archive: 'Back through time.', archiveNote: 'Follow the dates through the words and moments left behind.', empty: 'The next record begins here.', previous: 'Previous point', next: 'Next point', route: 'Reading route', open: 'Open this page', journal: 'Open the logbook', moments: 'Read the dispatches' },
  ja: { tabs: ['日誌', '瞬間', '映像', '記録'], heading: '一つの文章から、まだ見ぬ場所へ。', hint: '座標を選び、記録を開く。', latest: '最新の日誌', moment: '最近の瞬間', gallery: '光の落ちる場所。', galleryNote: '写真、風景、そして言葉よりも先に記憶した瞬間。', archive: '時間をたどって。', archiveNote: '日付を手がかりに、残してきた言葉と瞬間をたどる。', empty: '次の記録は、ここから。', previous: '前の座標', next: '次の座標', route: '読む航路', open: 'このページを開く', journal: '航海日誌を開く', moments: '旅の便りを読む' },
  de: { tabs: ['Texte', 'Momente', 'Bilder', 'Archiv'], heading: 'Eine Seite. Ein anderer Ort.', hint: 'Wähle einen Punkt. Folge einer Geschichte.', latest: 'Neuester Text', moment: 'Neuester Moment', gallery: 'Wo das Licht hinfällt.', galleryNote: 'Fotografien, Bilder und Augenblicke, die vor den Worten bleiben.', archive: 'Zurück durch die Zeit.', archiveNote: 'Folge den Daten durch die hinterlassenen Worte und Momente.', empty: 'Hier beginnt der nächste Eintrag.', previous: 'Vorheriger Punkt', next: 'Nächster Punkt', route: 'Leseroute', open: 'Diese Seite öffnen', journal: 'Logbuch öffnen', moments: 'Unterwegs lesen' },
}

type PreviewPose = Partial<Record<'image' | 'meta' | 'category' | 'title' | 'note' | 'open', CSSProperties>>

type AtlasStop = { title: string; note: string; href: string; image?: string; alt?: string; date?: string; label: string; category: string }

export default function VoyageHome({ locale, articles, moments, articleState, momentState, activity }: {
  locale: Locale; articles: Entry[]; moments: Entry[]; articleState: ReactNode; momentState: ReactNode; activity?: ReactNode
}) {
  const copy = COPY[locale]
  const { design } = useAppearance()
  const routePath = useRef<SVGPathElement>(null)
  const beacon = useRef<HTMLSpanElement>(null)
  const travelled = useRef(0)
  const generation = useRef(0)
  const [direction, setDirection] = useState(1)
  const [outgoing, setOutgoing] = useState<{ stop: AtlasStop; index: number; generation: number; direction: number; pose: PreviewPose } | null>(null)
  const [selected, setSelected] = useState(0)
  const tabs = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number } | null>(null)
  const home = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = home.current
    if (!root) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const sections = [...root.querySelectorAll<HTMLElement>('[data-voyage-enter]')]
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        (entry.target as HTMLElement).dataset.voyageEnter = 'visible'
        observer.unobserve(entry.target)
      }
    }), { threshold: .08 })
    if (!motion.matches) sections.forEach(section => { section.dataset.voyageEnter = 'waiting'; observer.observe(section) })
    const simplify = () => { if (motion.matches) sections.forEach(section => { section.dataset.voyageEnter = 'visible' }) }
    motion.addEventListener('change', simplify)
    return () => { observer.disconnect(); motion.removeEventListener('change', simplify) }
  }, [])
  useEffect(() => {
    if (!outgoing) return
    const timer = window.setTimeout(() => setOutgoing(null), 320)
    return () => clearTimeout(timer)
  }, [outgoing])
  useEffect(() => {
    const path = routePath.current, marker = beacon.current
    if (!path || !marker) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const target = selected / 3, from = travelled.current
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
      const eased = 1 - (1 - progress) ** 3
      paint(from + (target - from) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else marker.dataset.travelling = 'false'
    }
    frame = requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', simplify)
    motion.addEventListener('change', simplify)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', simplify)
      motion.removeEventListener('change', simplify)
    }
  }, [selected, design])
  const featured = articles[0]
  const preview = featured ? articlePreview(featured.content) : null
  const eastAsian = locale === 'zh' || locale === 'ja'
  const atlas = ATLAS[locale]
  const firstMoment = moments[0]
  const momentPreview = firstMoment ? articlePreview(firstMoment.content) : null
  const stops: AtlasStop[] = [
    { title: featured?.title || atlas.journal, note: featured && preview ? excerpt(preview.content, 150) : atlas.empty, href: featured ? `/articles/${featured._id}` : '/articles', image: preview?.coverUrl, alt: preview?.coverAlt, date: featured?.createdAt, label: atlas.latest, category: featured?.category || 'LOGBOOK' },
    { title: firstMoment?.title || atlas.moments, note: firstMoment ? excerpt(momentPreview?.content || firstMoment.content, 150) : atlas.empty, href: firstMoment ? `/moments/${firstMoment._id}` : '/moments', image: momentPreview?.coverUrl, alt: momentPreview?.coverAlt, date: firstMoment?.createdAt, label: atlas.moment, category: 'DISPATCH' },
    { title: atlas.gallery, note: atlas.galleryNote, href: '/gallery', image: undefined, alt: '', date: undefined, label: atlas.tabs[2], category: 'OBSERVATIONS' },
    { title: atlas.archive, note: atlas.archiveNote, href: '/archive', image: undefined, alt: '', date: undefined, label: atlas.tabs[3], category: 'CHRONOLOGY' },
  ]
  const stop = stops[selected]
  const select = (index: number, focus = false) => {
    const next = (index + stops.length) % stops.length
    if (next !== selected) {
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
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
      setOutgoing(previous => reduced ? null : previous || snapshot)
      setSelected(next)
    }
    if (focus) tabs.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
  }
  const routeKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? selected + 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? selected - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? stops.length - 1 : null
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
  const renderPreview = (record: AtlasStop, index: number, ghost = false, key = `current-${index}`, pose: PreviewPose = {}, exitDirection = direction) => <div key={key} className={`${styles.previewInner}${ghost ? ` ${styles.previewGhost}` : ''}`} aria-hidden={ghost || undefined} inert={ghost || undefined} data-preview-layer={ghost ? 'outgoing' : 'current'} style={ghost ? { '--travel-direction': exitDirection } as CSSProperties : undefined}>
    <div className={styles.previewImage} style={pose.image} aria-hidden="true">{record.image ? <img src={record.image} alt="" /> : <VoyageArt animated={false} compact/>}<span className={styles.imageIndex}>0{index + 1}</span></div>
    <div className={styles.previewMeta} style={pose.meta}><span><i/>{record.label}</span>{record.date ? <time dateTime={record.date}>{dateLabel(record.date, locale)}</time> : <span>YOROROICE / {record.category}</span>}</div>
    <div className={styles.previewText}><span className={styles.previewCategory} style={pose.category}>{record.category}</span><h2 style={pose.title}><Link href={record.href}>{record.title}</Link></h2><p style={pose.note}>{record.note}</p><Link style={pose.open} className={styles.openPage} href={record.href}><span>{atlas.open}</span><ArrowUpRight size={25} strokeWidth={1.3}/></Link></div>
    <span className={styles.previewRail} aria-hidden="true">WORDS BECOME PLACES. / 0{index + 1}</span>
  </div>
  return <div ref={home} className={styles.home} data-testid="voyage-home" lang={locale}>
    <section className={styles.hero} aria-labelledby="voyage-title">
      <div className={styles.spine}>
        <div className={styles.topline}><span>YOROROICE / ARK</span><span>VOL. 07</span></div>
        <div className={styles.titleBlock}><h1 id="voyage-title" data-cjk={eastAsian} aria-label={copy.title}><span><b>{copy.words[0]}</b></span><span><b>{copy.words[1]}</b></span></h1><span className={styles.spineEnglish} aria-hidden="true">NIGHT<br/>VOYAGE</span></div>
        <p className={styles.atlasIntro}>{atlas.heading}</p>
        <div className={styles.spineBottom}><span>A PERSONAL<br/>READING ATLAS</span><a href="#voyage-logbook" aria-label={copy.scroll}><ArrowDown size={21}/></a></div>
      </div>
      <div className={styles.atlas} style={{ '--stop': selected, '--course': selected / 3, '--travel-direction': direction } as CSSProperties}>
        <div className={styles.atlasTop}><span>{atlas.hint}</span><span>INDEX / 01—04</span></div>
        <div className={styles.routePicker} ref={tabs} role="tablist" aria-label={atlas.route} onKeyDown={routeKeys}>
          <div className={styles.routeSurface} aria-hidden="true"><svg viewBox="0 0 1000 130" preserveAspectRatio="none"><path d="M0 95H125C220 95 280 25 375 25S530 95 625 95 780 25 875 25H1000"/><path ref={routePath} className={styles.routeProgress} d="M125 95C220 95 280 25 375 25S530 95 625 95 780 25 875 25" pathLength="1"/></svg><span ref={beacon} className={styles.routeBeacon} data-testid="voyage-route-beacon" data-travelling="false"><i/></span></div>
          {stops.map((_, index) => <button key={index} id={`voyage-stop-${index}`} aria-controls="voyage-preview" aria-selected={selected === index} role="tab" tabIndex={selected === index ? 0 : -1} onClick={() => select(index)} data-testid={`voyage-stop-${index}`}><span className={styles.point}><i/></span><small>0{index + 1}</small><span>{atlas.tabs[index]}</span></button>)}
        </div>
        <div id="voyage-preview" className={styles.preview} role="tabpanel" aria-labelledby={`voyage-stop-${selected}`} tabIndex={0} onPointerDown={swipeStart} onPointerUp={swipeEnd} onPointerCancel={() => { gesture.current = null }} data-selected={selected}>
          {outgoing && renderPreview(outgoing.stop, outgoing.index, true, `outgoing-${outgoing.generation}`, outgoing.pose, outgoing.direction)}
          {renderPreview(stop, selected)}
        </div>
        <div className={styles.atlasBottom}><span><b>0{selected + 1}</b> / 04</span><span>{atlas.tabs[selected]}<i/></span><div><button type="button" onClick={() => select(selected - 1)} aria-label={atlas.previous}><ArrowLeft size={20}/></button><button type="button" onClick={() => select(selected + 1)} aria-label={atlas.next}><ArrowRight size={20}/></button></div></div>
      </div>
    </section>
    <div className={styles.prologue} data-voyage-enter><span className={styles.prologueNumber}>CONTINUE / 继续向前</span><p>{copy.intro}</p><span className={styles.prologueSign}>A line of words.<br />A way through.</span></div>
    <section className={styles.writings} id="voyage-logbook" data-voyage-enter>
      <header className={styles.sectionHead}><div><span aria-hidden="true">LOGBOOK<span className={styles.redDot}>.</span></span><h2><small>01 /</small>{copy.writings}</h2></div><Link href="/articles">{copy.all}<ArrowUpRight size={20}/></Link></header>
      {articleState}
      {featured && preview && <div className={styles.logbook} data-single={articles.length === 1}>
        <article className={styles.featured}>
          <Link href={`/articles/${featured._id}`} className={styles.featureImage} aria-label={featured.title}>{preview.coverUrl ? <img src={preview.coverUrl} alt={preview.coverAlt || featured.title} loading="lazy" /> : <VoyageArt animated={false} compact/>}<span>{copy.selected}<b>001</b></span></Link>
          <div className={styles.featureBody}>
            <Link href={`/articles/${featured._id}`} className={styles.featureText}><div className={styles.entryMeta}><span>{featured.category || 'JOURNAL'}</span><time dateTime={featured.createdAt}>{dateLabel(featured.createdAt, locale)}</time></div><h3>{featured.title}</h3><p>{excerpt(preview.content, 130)}</p><span className={styles.read}>{translate(locale, 'read')}<ArrowUpRight size={24}/></span></Link>
            {articles.length === 1 && <Link href="/archive" className={styles.archiveLink}>{copy.archive}<ArrowRight size={20}/></Link>}
          </div>
        </article>
        {articles.length > 1 && <div className={styles.entries}>{articles.slice(1, 4).map((entry, index) => <Link key={entry._id} href={`/articles/${entry._id}`} className={styles.entry}><span className={styles.entryNumber}>0{index + 2}</span><div><time dateTime={entry.createdAt}>{dateLabel(entry.createdAt, locale)}</time><h3>{entry.title}</h3><p>{excerpt(articlePreview(entry.content).content, 70)}</p></div><ArrowUpRight size={20}/></Link>)}<Link href="/archive" className={styles.archiveLink}>{copy.archive}<ArrowRight size={20}/></Link></div>}
      </div>}
    </section>
    <section className={styles.moments} data-voyage-enter>
      <header className={styles.momentIntro}><span>02 / DISPATCHES</span><h2>{copy.moments}</h2><p>{copy.note}</p><Link href="/moments">{translate(locale, 'all')}<ArrowUpRight size={20}/></Link><div className={styles.signalBars} aria-hidden="true">{Array.from({length: 18}, (_, i) => <i key={i} style={{ height: `${12 + ((i * 17 + 9) % 47)}px` }}/>)}</div></header>
      <div className={styles.momentList}>{momentState}{moments.slice(0, 3).map((entry, index) => <Link key={entry._id} href={`/moments/${entry._id}`} className={styles.moment}><div className={styles.momentDate}><span>0{index + 1}</span><time dateTime={entry.createdAt}>{dateLabel(entry.createdAt, locale)}</time><ArrowUpRight size={20}/></div><h3>{entry.title}</h3><p>{excerpt(entry.content, 130)}</p></Link>)}</div>
    </section>
    {activity}
    <aside className={styles.closing} data-voyage-enter><div className={styles.closingArt}><VoyageArt animated={false} compact/></div><span className={styles.closingLabel}>END OF PAGE / NOT THE JOURNEY</span><p>{copy.closing}</p><Link href="/about"><span>{copy.about}</span><ArrowUpRight strokeWidth={1}/></Link><span className={styles.closingEnglish} aria-hidden="true">ONWARD.</span></aside>
  </div>
}
