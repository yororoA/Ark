'use client'
/* eslint-disable @next/next/no-img-element -- Covers are external article Markdown images. */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import FoldArt from '@/components/appearance/fold-art'
import { useAppearance } from '@/components/appearance/appearance-store'
import { articlePreview, dateLabel, excerpt, translate, type Entry, type Locale } from '@/lib/blog'
import styles from './fold-home.module.scss'

const COPY = {
  zh: { title: '折境', tagline: '在世界的折痕里，留下自己的故事。', first: '悬置', second: '通行', scene: '切换画面', read: '走进文字', down: '向下，翻开这一页', writings: '沿途的文字', fragments: '日常的切片', note: '一些想法，一些远方。\n还有正在发生的生活。', end: '世界很大。\n日常也值得被看见。', about: '关于这座 Ark', chapter: '个人记录 / 第六种风景' },
  en: { title: 'FOLD', tagline: 'Stories held between the folds of the world.', first: 'Suspended', second: 'Passage', scene: 'Choose a scene', read: 'Enter the stories', down: 'Turn the page', writings: 'Words along the way', fragments: 'Slices of everyday life', note: 'Ideas, distant places,\nand a life still unfolding.', end: 'A vast world.\nAn everyday life worth seeing.', about: 'About this Ark', chapter: 'PERSONAL RECORDS / LANDSCAPE 06' },
  ja: { title: '折境', tagline: '世界の折り目に、自分の物語を残す。', first: '宙に浮く', second: '通り道', scene: '風景を選ぶ', read: '物語へ', down: '次のページへ', writings: '道の途中の言葉', fragments: '日常のかけら', note: 'いくつかの思い、遠くの場所。\nそして、続いていく日々。', end: '広い世界。\n小さな日常にも、光を。', about: 'この Ark について', chapter: '個人の記録 / 第六の風景' },
  de: { title: 'FOLD', tagline: 'Geschichten in den Falten der Welt.', first: 'Schwebend', second: 'Durchgang', scene: 'Ansicht wählen', read: 'Geschichten lesen', down: 'Eine Seite weiter', writings: 'Worte am Weg', fragments: 'Stücke des Alltags', note: 'Gedanken, ferne Orte\nund ein Leben, das weitergeht.', end: 'Eine weite Welt.\nEin Alltag, der zählt.', about: 'Über diese Ark', chapter: 'PERSÖNLICHE AUFZEICHNUNGEN / 06' },
}

export default function FoldHome({ locale, articles, moments, articleState, momentState, activity }: {
  locale: Locale; articles: Entry[]; moments: Entry[]; articleState: ReactNode; momentState: ReactNode; activity?: ReactNode
}) {
  const { design } = useAppearance()
  const [scene, setScene] = useState<'monument' | 'portal'>('monument')
  const [sceneTurn, setSceneTurn] = useState<'idle' | 'closing' | 'opening'>('idle')
  const homeRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const turnTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => turnTimers.current.forEach(clearTimeout), [])

  useEffect(() => {
    const home = homeRef.current
    const stage = stageRef.current
    if (design !== 'fold' || !home || !stage) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sections = Array.from(home.querySelectorAll<HTMLElement>('[data-fold-reveal]'))
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.revealed = 'true'
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: .12 })
    if (!motion.matches) sections.forEach(section => {
      section.dataset.revealed = 'false'
      observer.observe(section)
    })

    let frame = 0
    let x = 0, y = 0, targetX = 0, targetY = 0
    const settle = () => {
      x += (targetX - x) * .075
      y += (targetY - y) * .075
      stage.style.setProperty('--fold-look-x', `${x.toFixed(2)}px`)
      stage.style.setProperty('--fold-look-y', `${y.toFixed(2)}px`)
      frame = Math.abs(x - targetX) + Math.abs(y - targetY) > .04 ? requestAnimationFrame(settle) : 0
    }
    const move = (event: PointerEvent) => {
      if (motion.matches || !pointer.matches) return
      const bounds = stage.getBoundingClientRect()
      targetX = ((event.clientX - bounds.left) / bounds.width - .5) * 24
      targetY = ((event.clientY - bounds.top) / bounds.height - .5) * 16
      if (!frame) frame = requestAnimationFrame(settle)
    }
    const reset = () => { targetX = 0; targetY = 0; if (!frame) frame = requestAnimationFrame(settle) }
    const simplify = () => {
      if (motion.matches) {
        sections.forEach(section => { section.dataset.revealed = 'true' })
        reset()
      }
    }
    stage.addEventListener('pointermove', move)
    stage.addEventListener('pointerleave', reset)
    motion.addEventListener('change', simplify)
    return () => {
      observer.disconnect()
      sections.forEach(section => { delete section.dataset.revealed })
      stage.removeEventListener('pointermove', move)
      stage.removeEventListener('pointerleave', reset)
      motion.removeEventListener('change', simplify)
      cancelAnimationFrame(frame)
      stage.style.removeProperty('--fold-look-x')
      stage.style.removeProperty('--fold-look-y')
    }
  }, [design])

  function turnScene(next: 'monument' | 'portal') {
    if (next === scene || sceneTurn !== 'idle') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setScene(next); return }
    setSceneTurn('closing')
    turnTimers.current = [setTimeout(() => {
      setScene(next)
      setSceneTurn('opening')
    }, 340), setTimeout(() => setSceneTurn('idle'), 1140)]
  }

  const copy = COPY[locale]
  const featured = articles[0]
  const preview = featured ? articlePreview(featured.content) : null
  const titleLines = locale === 'en' || locale === 'de' ? ['FO', 'LD'] : ['折', '境']
  return <div ref={homeRef} className={styles.home} data-testid="fold-home" lang={locale}>
    <section className={styles.poster} aria-labelledby="fold-title">
      <div className={styles.masthead}><span>YOROROICE / ARK</span><span>{copy.chapter}</span></div>
      <div ref={stageRef} className={styles.stage} data-scene-turn={sceneTurn}>
        <div className={styles.title}><p>BETWEEN<br />THE LINES.</p><h1 id="fold-title" aria-label={copy.title}>{titleLines.map((line, index) => <span key={index} aria-hidden="true">{line}</span>)}</h1><span className={styles.volume}>PAPER LANDSCAPES <b>06</b></span></div>
        <div className={styles.art}>
          {design === 'fold' && <FoldArt key={scene} variant={scene} />}
          <div className={styles.sceneCurtain} aria-hidden="true"><i /><i /><span>0{scene === 'monument' ? 1 : 2} / FOLD</span></div>
        </div>
        <div className={styles.marginNote} aria-hidden="true"><span>THE WORLD IS STILL UNFOLDING</span><i /><span>EST. IN EVERYDAY LIFE</span></div>
        <div className={styles.introduction}><span className={styles.redMark} aria-hidden="true" /><p>{copy.tagline}</p><Link href="/articles">{copy.read}<ArrowUpRight size={22} /></Link></div>
        <div className={styles.scenePicker} role="group" aria-label={copy.scene} aria-busy={sceneTurn !== 'idle'}>
          {(['monument', 'portal'] as const).map((variant, index) => <button type="button" key={variant} aria-pressed={scene === variant} aria-disabled={sceneTurn !== 'idle'} onClick={() => turnScene(variant)}><small>0{index + 1}</small><span>{index ? copy.second : copy.first}</span></button>)}
        </div>
      </div>
      <div className={styles.posterFoot}><span>FOLD / A PERSONAL JOURNAL</span><a href="#fold-writing">{copy.down}<ArrowDown size={16} /></a><span aria-hidden="true">○ &nbsp; ◧ &nbsp; ▰</span></div>
    </section>
    <section className={styles.writing} id="fold-writing" data-fold-reveal>
      <header className={styles.sectionHead}><span className={styles.sectionNumber}>01</span><div><small>WRITINGS / FIELD NOTES</small><h2>{copy.writings}</h2></div><Link href="/articles">{translate(locale, 'all')}<ArrowUpRight size={20} /></Link></header>
      {articleState}
      <div className={styles.editorial}>
        {featured && preview && <Link href={`/articles/${featured._id}`} className={styles.featured}>
          <div className={styles.featuredImage}>{preview.coverUrl ? <img src={preview.coverUrl} alt={preview.coverAlt || ''} loading="lazy" /> : <div className={styles.paperSculpture} aria-hidden="true"><i /><i /><i /></div>}<span>SELECTED / 001</span><ArrowUpRight size={28} /></div>
          <div className={styles.meta}><span>{featured.category || 'JOURNAL'}</span><time>{dateLabel(featured.createdAt, locale)}</time></div><h3>{featured.title}</h3><p>{excerpt(preview.content, 120)}</p>
        </Link>}
        <div className={styles.notes}><p className={styles.editorNote}>{copy.note}</p>{articles.slice(1, 4).map((entry, index) => <Link href={`/articles/${entry._id}`} key={entry._id} className={styles.note}><span className={styles.noteNumber}>0{index + 2}</span><div><time>{dateLabel(entry.createdAt, locale)}</time><h3>{entry.title}</h3><p>{excerpt(articlePreview(entry.content).content, 65)}</p></div><ArrowUpRight size={20} /></Link>)}<Link href="/archive" className={styles.archiveLink}>{translate(locale, 'archive')}<ArrowRight size={20} /></Link></div>
      </div>
    </section>
    <section className={styles.fragments} data-fold-reveal>
      <header className={styles.sectionHead}><span className={styles.sectionNumber}>02</span><div><small>MOMENTS / COLLECTED PIECES</small><h2>{copy.fragments}</h2></div><Link href="/moments">{translate(locale, 'all')}<ArrowUpRight size={20} /></Link></header>
      {momentState}
      <div className={styles.fragmentList}>{moments.slice(0, 3).map((entry, index) => <Link key={entry._id} href={`/moments/${entry._id}`} className={styles.fragment}><div className={styles.fragmentStamp} data-shape={index} aria-hidden="true"><i /><i /></div><time>{dateLabel(entry.createdAt, locale)}</time><h3>{entry.title}</h3><p>{excerpt(entry.content, 100)}</p><span className={styles.fragmentFoot}>FRAGMENT / 0{index + 1}<ArrowUpRight size={20} /></span></Link>)}</div>
    </section>
    {activity}
    <aside className={styles.colophon} data-fold-reveal><span>SMALL STORIES.<br />VAST HORIZONS.</span><p>{copy.end}</p><Link href="/about">{copy.about}<ArrowUpRight size={24} /></Link><i aria-hidden="true" /></aside>
  </div>
}
