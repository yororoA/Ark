'use client'

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ArrowUp, ChevronDown } from 'lucide-react'
import { useAppearance } from '@/components/appearance/appearance-store'
import type { Locale } from '@/lib/blog'
import styles from './voyage-reader.module.scss'

type VoyageReaderProps = { articleId: string; contentKey: string; locale: Locale; children: ReactNode }
type Chapter = { id: string; title: string; depth: number }
type ReadingPosition = { percent: number; chapter: number }
type RestorableTarget = { node: HTMLElement; id: string | null; tabIndex: string | null; assignedId: string }

const COPY = {
  zh: { guide: '阅读航线', reading: '正文进度', position: '当前位置', beginning: '正文起点', end: '已到正文末尾', outline: '本文航线', back: '回到正文开头', untitled: '未命名章节' },
  en: { guide: 'Reading course', reading: 'Reading progress', position: 'You are here', beginning: 'Beginning', end: 'End of the article', outline: 'On this page', back: 'Back to the beginning', untitled: 'Untitled section' },
  ja: { guide: '読書の航路', reading: '本文の進み具合', position: '現在地', beginning: '本文のはじまり', end: '本文の終わり', outline: 'このページの航路', back: '本文の先頭へ', untitled: '無題の節' },
  de: { guide: 'Leseroute', reading: 'Lesefortschritt', position: 'Aktuelle Position', beginning: 'Anfang des Textes', end: 'Ende des Artikels', outline: 'Auf dieser Seite', back: 'Zurück zum Textanfang', untitled: 'Unbenannter Abschnitt' },
} satisfies Record<Locale, Record<string, string>>

const DESKTOP = '(min-width: 981px)'

function decodedHash() {
  const hash = window.location.hash.slice(1)
  try { return decodeURIComponent(hash) } catch { return hash }
}

function headerOffset(body: HTMLElement) {
  const header = body.closest('[data-blog-root]')?.querySelector<HTMLElement>(':scope > header')
  const guide = body.parentElement?.querySelector<HTMLElement>('[data-testid="voyage-reading-guide"]')
  const guideHeight = !matchMedia(DESKTOP).matches ? guide?.getBoundingClientRect().height ?? 0 : 0
  return (header?.getBoundingClientRect().height ?? 86) + guideHeight + 24
}

function viewportBottom(body: HTMLElement) {
  const navigation = body.closest('[data-blog-root]')?.querySelector<HTMLElement>(':scope > nav')
  const rect = navigation?.getBoundingClientRect()
  return rect && rect.height > 0 && getComputedStyle(navigation!).position === 'fixed'
    ? Math.min(window.innerHeight, rect.top)
    : window.innerHeight
}

function scrollToTarget(target: HTMLElement, body: HTMLElement, behavior: ScrollBehavior) {
  const top = target.getBoundingClientRect().top + window.scrollY - headerOffset(body)
  window.scrollTo({ top: Math.max(0, top), behavior })
}

function ActiveVoyageReader({ articleId, contentKey, locale, children }: VoyageReaderProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const outlineRef = useRef<HTMLDetailsElement>(null)
  const routeMapRef = useRef<HTMLDivElement>(null)
  const routeSvgRef = useRef<SVGSVGElement>(null)
  const routeTrackRef = useRef<SVGLineElement>(null)
  const routeProgressRef = useRef<SVGLineElement>(null)
  const routeBeaconRef = useRef<HTMLSpanElement>(null)
  const refreshRouteRef = useRef<(() => void) | null>(null)
  const navigationFrame = useRef(0)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [position, setPosition] = useState<ReadingPosition>({ percent: 0, chapter: -1 })
  const [startId, setStartId] = useState('')
  const copy = COPY[locale]
  const hasOutline = chapters.length >= 2
  const currentChapter = chapters[position.chapter]
  const currentTitle = currentChapter ? currentChapter.title || copy.untitled : !chapters.length && position.percent === 100 ? copy.end : copy.beginning

  useLayoutEffect(() => {
    const body = bodyRef.current
    const prose = body?.querySelector<HTMLElement>('[data-voyage-prose]')
    if (!body || !prose) return

    const prefix = `voyage-${encodeURIComponent(articleId)}`
    const restored: RestorableTarget[] = []
    const usedIds = new Set<string>()
    const targets = Array.from(prose.querySelectorAll<HTMLElement>('h2, h3, h4'))
    const prepareTarget = (node: HTMLElement, fallback: string) => {
      const previousId = node.getAttribute('id')
      // Keep author-provided anchors whenever they identify this exact node.
      let id = previousId && document.getElementById(previousId) === node && !usedIds.has(previousId) ? previousId : fallback
      let suffix = 2
      while (usedIds.has(id) || (document.getElementById(id) && document.getElementById(id) !== node)) id = `${fallback}-${suffix++}`
      restored.push({ node, id: previousId, tabIndex: node.getAttribute('tabindex'), assignedId: id })
      usedIds.add(id)
      node.id = id
      if (!node.hasAttribute('tabindex')) node.tabIndex = -1
      return id
    }
    const beginningId = prepareTarget(prose, `${prefix}-start`)
    const nextChapters = targets.map((node, index) => ({
      id: prepareTarget(node, `${prefix}-section-${index + 1}`),
      title: node.textContent?.replace(/\s+/g, ' ').trim() || '',
      depth: Number(node.tagName.slice(1)),
    }))

    let frame = 0
    let anchorFrame = 0
    let disposed = false
    let routeLayoutDirty = true
    let passedStations = -1
    let routePoints: { x: number; y: number }[] = []
    const drawRoute = (stops: number[], readingPosition: number, end: number, complete: boolean) => {
      // Closed mobile directories have no visible route to measure or update.
      const map = routeMapRef.current
      const svg = routeSvgRef.current
      const track = routeTrackRef.current
      const progress = routeProgressRef.current
      const beacon = routeBeaconRef.current
      if (!outlineRef.current?.open || !map || !svg || !track || !progress || !beacon) return
      if (routeLayoutDirty || routePoints.length !== stops.length + 1) {
        const rect = map.getBoundingClientRect()
        routePoints = Array.from(map.querySelectorAll<HTMLElement>('[data-route-station], [data-route-end]')).map(node => {
          const point = node.getBoundingClientRect()
          return { x: point.left + point.width / 2 - rect.left - map.clientLeft + map.scrollLeft, y: point.top + point.height / 2 - rect.top - map.clientTop + map.scrollTop }
        })
        if (routePoints.length !== stops.length + 1) return
        const first = routePoints[0], last = routePoints[routePoints.length - 1]
        // Size to the final station, not scrollHeight: an absolute SVG must
        // never enlarge the very scroll range used to measure itself.
        const routeHeight = Math.ceil(last.y + 4)
        svg.setAttribute('viewBox', `0 0 ${map.clientWidth} ${routeHeight}`)
        svg.style.height = `${routeHeight}px`
        for (const line of [track, progress]) {
          line.setAttribute('x1', String(first.x)); line.setAttribute('x2', String(first.x))
          line.setAttribute('y1', String(first.y))
        }
        track.setAttribute('y2', String(last.y))
        routeLayoutDirty = false
      }
      const first = routePoints[0], last = routePoints[routePoints.length - 1]
      const passed = complete ? stops.length : stops.filter(stop => stop < readingPosition).length
      if (passed !== passedStations) {
        map.querySelectorAll<HTMLElement>('a[data-depth]').forEach((link, index) => { link.dataset.passed = String(index < passed) })
        passedStations = passed
      }
      let y = first.y
      const started = readingPosition >= stops[0] || complete
      if (complete) y = last.y
      else if (started) {
        let index = 0
        while (index + 1 < stops.length && stops[index + 1] <= readingPosition) index++
        const nextStop = stops[index + 1] ?? end
        const distance = nextStop - stops[index]
        const travelled = distance > 0 ? Math.max(0, Math.min(1, (readingPosition - stops[index]) / distance)) : 0
        y = routePoints[index].y + (routePoints[index + 1].y - routePoints[index].y) * travelled
      }
      map.dataset.started = String(started)
      progress.setAttribute('y2', String(y))
      beacon.style.transform = `translate3d(${first.x}px, ${y}px, 0) translate(-50%, -50%)`
    }
    const measure = () => {
      frame = 0
      if (disposed || !prose.isConnected) return
      const first = prose.firstElementChild ?? prose
      const last = prose.lastElementChild ?? prose
      const offset = headerOffset(body)
      const start = first.getBoundingClientRect().top + window.scrollY - offset
      const visibleBottom = viewportBottom(body)
      const contentBottom = last.getBoundingClientRect().bottom + window.scrollY
      const end = contentBottom - visibleBottom
      const fraction = end <= start ? (window.scrollY >= end ? 1 : 0) : (window.scrollY - start) / (end - start)
      const percent = Math.floor(Math.max(0, Math.min(1, fraction)) * 100)
      const stops = targets.map(target => target.getBoundingClientRect().top + window.scrollY - offset)
      // During the final viewport of scroll travel, let the reading line move
      // down through the visible text. It reaches the actual final element as
      // progress reaches 100%, including short headings near the bottom.
      const visibleHeight = Math.max(0, visibleBottom - offset)
      const sweepStart = Math.max(start, end - visibleHeight)
      const sweepLength = end - sweepStart
      const sweep = sweepLength > 0 ? Math.max(0, Math.min(1, (window.scrollY - sweepStart) / sweepLength)) : 0
      const routeEnd = contentBottom - offset
      const readingPosition = end <= start && percent === 100 ? routeEnd : window.scrollY + visibleHeight * sweep
      let chapter = -1
      // The current paragraph remains tied to the header reading line, so an
      // anchor never highlights a later short section that is also visible.
      stops.forEach((stop, index) => { if (stop <= window.scrollY + 4) chapter = index })
      if (targets.length >= 2) drawRoute(stops, readingPosition, routeEnd, percent === 100)
      setPosition(previous => previous.percent === percent && previous.chapter === chapter ? previous : { percent, chapter })
    }
    const queueMeasure = () => { if (!disposed && !frame) frame = requestAnimationFrame(measure) }
    const queueLayoutMeasure = () => { routeLayoutDirty = true; queueMeasure() }
    refreshRouteRef.current = queueLayoutMeasure
    const followHash = () => {
      const id = decodedHash()
      const target = restored.find(entry => entry.assignedId === id)?.node
      if (!target) return
      if (!matchMedia(DESKTOP).matches && outlineRef.current) outlineRef.current.open = false
      target.focus({ preventScroll: true })
      scrollToTarget(target, body, 'instant')
      queueMeasure()
    }
    const followHistory = (event: PopStateEvent) => {
      if (window.location.hash) { followHash(); return }
      const previous = event.state?.__arkVoyageReader
      if (previous?.articleId !== articleId || previous.path !== `${window.location.pathname}${window.location.search}` || !Number.isFinite(previous.scrollY)) return
      window.scrollTo({ top: Math.max(0, previous.scrollY), behavior: 'instant' })
      queueMeasure()
    }

    // Assign anchors before the route scroll manager runs; publish the outline
    // on the next frame, then resolve an initial link after mobile layout settles.
    frame = requestAnimationFrame(() => {
      frame = 0
      setChapters(nextChapters)
      setStartId(beginningId)
      measure()
      anchorFrame = requestAnimationFrame(followHash)
    })
    const resize = new ResizeObserver(queueLayoutMeasure)
    resize.observe(prose)
    resize.observe(body)
    const guide = body.parentElement?.querySelector<HTMLElement>('[data-testid="voyage-reading-guide"]')
    if (guide) resize.observe(guide)
    const header = body.closest('[data-blog-root]')?.querySelector<HTMLElement>(':scope > header')
    if (header) resize.observe(header)
    window.addEventListener('scroll', queueMeasure, { passive: true })
    window.addEventListener('resize', queueLayoutMeasure)
    window.addEventListener('hashchange', followHash)
    window.addEventListener('popstate', followHistory)
    window.visualViewport?.addEventListener('resize', queueLayoutMeasure)
    prose.addEventListener('load', queueLayoutMeasure, true)
    document.fonts.addEventListener('loadingdone', queueLayoutMeasure)
    void document.fonts.ready.then(queueLayoutMeasure)

    return () => {
      disposed = true
      refreshRouteRef.current = null
      cancelAnimationFrame(frame)
      cancelAnimationFrame(anchorFrame)
      cancelAnimationFrame(navigationFrame.current)
      resize.disconnect()
      window.removeEventListener('scroll', queueMeasure)
      window.removeEventListener('resize', queueLayoutMeasure)
      window.removeEventListener('hashchange', followHash)
      window.removeEventListener('popstate', followHistory)
      window.visualViewport?.removeEventListener('resize', queueLayoutMeasure)
      prose.removeEventListener('load', queueLayoutMeasure, true)
      document.fonts.removeEventListener('loadingdone', queueLayoutMeasure)
      restored.forEach(({ node, id, tabIndex, assignedId }) => {
        if (node.id === assignedId) {
          if (id === null) node.removeAttribute('id')
          else node.setAttribute('id', id)
        }
        if (tabIndex === null && node.getAttribute('tabindex') === '-1') node.removeAttribute('tabindex')
      })
    }
  }, [articleId, contentKey])

  useEffect(() => {
    const outline = outlineRef.current
    if (!outline) return
    const desktop = matchMedia(DESKTOP)
    const refresh = () => refreshRouteRef.current?.()
    const update = () => { outline.open = desktop.matches; refresh() }
    const resize = new ResizeObserver(refresh)
    if (routeMapRef.current) resize.observe(routeMapRef.current)
    update()
    outline.addEventListener('toggle', refresh)
    desktop.addEventListener('change', update)
    return () => {
      resize.disconnect()
      outline.removeEventListener('toggle', refresh)
      desktop.removeEventListener('change', update)
    }
  }, [hasOutline, locale])

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const body = bodyRef.current
    const id = decodeURIComponent(event.currentTarget.hash.slice(1))
    const target = document.getElementById(id)
    if (!body || !target || !body.contains(target)) return
    event.preventDefault()
    if (window.location.hash !== event.currentTarget.hash) {
      const state = window.history.state
      // Preserve Next's own state while recording only this history entry's
      // origin. Back from a section link should return to where it was opened.
      window.history.replaceState({ ...state, __arkVoyageReader: {
        articleId, path: `${window.location.pathname}${window.location.search}`, scrollY: window.scrollY,
      } }, '', window.location.href)
      window.history.pushState(state, '', event.currentTarget.href)
    }
    if (!matchMedia(DESKTOP).matches && outlineRef.current) outlineRef.current.open = false
    target.focus({ preventScroll: true })
    cancelAnimationFrame(navigationFrame.current)
    navigationFrame.current = requestAnimationFrame(() => {
      if (!target.isConnected || !body.isConnected) return
      scrollToTarget(target, body, matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth')
    })
  }

  return <div className={styles.layout} data-testid="voyage-reader">
    <div ref={bodyRef} className={styles.body}>{children}</div>
    <aside className={styles.guide} aria-label={copy.guide} data-testid="voyage-reading-guide" data-has-outline={hasOutline} data-complete={position.percent === 100}>
      <div className={styles.guideTop}><span className={styles.guideKicker}>{copy.reading}</span><strong className={styles.guideNumber}>{String(position.percent).padStart(2, '0')}<small>%</small></strong></div>
      <div className={styles.progress} role="progressbar" aria-label={copy.reading} aria-valuemin={0} aria-valuemax={100} aria-valuenow={position.percent} data-testid="voyage-reading-progress">
        <div className={styles.progressTrack}><span className={styles.progressFill} style={{ transform: `scaleX(${position.percent / 100})` }} /></div>
      </div>
      <p className={styles.position}><span className={styles.positionLabel}>{copy.position}</span><strong className={styles.positionTitle}>{currentTitle}</strong></p>
      {hasOutline && <details ref={outlineRef} className={styles.outline} data-testid="voyage-reading-outline">
        <summary className={styles.outlineSummary}><span className={styles.outlineLabel}>{copy.outline}</span><span className={styles.outlineCurrent}>{currentTitle}</span><ChevronDown className={styles.outlineChevron} size={16} aria-hidden="true" /></summary>
        <div ref={routeMapRef} className={styles.routeMap} data-testid="voyage-reading-route">
          <svg ref={routeSvgRef} className={styles.routeLine} aria-hidden="true"><line ref={routeTrackRef} className={styles.routeTrack} /><line ref={routeProgressRef} className={styles.routeProgress} data-testid="voyage-reading-route-progress" /></svg>
          <span ref={routeBeaconRef} className={styles.routeBeacon} aria-hidden="true" data-testid="voyage-reading-route-beacon" />
          <ol className={styles.chapterList}>{chapters.map((chapter, index) => <li key={chapter.id}>
            <a className={styles.chapter} href={`#${encodeURIComponent(chapter.id)}`} data-depth={chapter.depth} aria-current={position.chapter === index ? 'location' : undefined} onClick={navigate}>
              <span className={styles.chapterDot} data-route-station aria-hidden="true" /><span className={styles.chapterNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span className={styles.chapterTitle}>{chapter.title || copy.untitled}</span>
            </a>
          </li>)}</ol>
          <div className={styles.routeEnd} aria-hidden="true"><span data-route-end /><span>{copy.end}</span></div>
        </div>
      </details>}
      <div className={styles.guideBottom}><a className={styles.backToStart} href={`#${encodeURIComponent(startId)}`} onClick={navigate}><span>{copy.back}</span><ArrowUp size={15} aria-hidden="true" /></a></div>
    </aside>
  </div>
}

export default function VoyageReader(props: VoyageReaderProps) {
  const { design } = useAppearance()
  return design === 'voyage' ? <ActiveVoyageReader key={props.articleId} {...props} /> : <Fragment>{props.children}</Fragment>
}
