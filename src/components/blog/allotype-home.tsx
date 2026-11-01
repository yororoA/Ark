'use client'

import { useState, type ReactNode, type CSSProperties } from 'react'
import { ArrowDown, ArrowUpRight, Pause, Play, ArrowRight } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import AllotypeArt from '@/components/appearance/allotype-art'
import { useAppearance } from '@/components/appearance/appearance-store'
import { ALLOTYPES, ALLOTYPE_COPY } from '@/lib/allotype'
import { articlePreview, dateLabel, excerpt, translate, type Entry, type Locale } from '@/lib/blog'
import styles from './allotype-home.module.scss'

export default function AllotypeHome({ locale, articles, moments, articleState, momentState }: {
  locale: Locale; articles: Entry[]; moments: Entry[]; articleState: ReactNode; momentState: ReactNode
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const { design } = useAppearance()
  const copy = ALLOTYPE_COPY[locale]
  const seed = ALLOTYPES[index]
  const names = locale === 'zh' ? ['干涉', '轨迹', '点阵', '折叠', '日蚀'] : locale === 'ja' ? ['干渉', '軌道', '点描', '折層', '日蝕'] : ['INTERFERENCE', 'TRAJECTORY', 'HALFTONE', 'FOLD', 'ECLIPSE']
  const pauseLabel = locale === 'zh' ? (paused ? '播放动画' : '暂停动画') : locale === 'ja' ? (paused ? '動きを再開' : '動きを止める') : (paused ? 'Play motion' : 'Pause motion')
  const nextLabel = locale === 'zh' ? '下一个异相' : locale === 'ja' ? '次の異相' : 'Next impression'
  const edition = { zh: '五种指纹，一种存在。', en: 'FIVE PRINTS. ONE PRESENCE.', ja: '五つの指紋、ひとつの存在。', de: 'FÜNF FORMEN. EINE PRÄSENZ.' }[locale]
  const tagline = { zh: '日常的另一种显影', en: 'ANOTHER EXPOSURE', ja: '日常のもうひとつの姿', de: 'EINE ANDERE BELICHTUNG' }[locale]
  const bytes = seed.value.match(/../g)!.map(value => parseInt(value, 16))
  return <div className={styles.home} data-testid="allotype-home" lang={locale}>
    <section className={styles.poster} aria-labelledby="allotype-title" data-phase={index}>
      <div className={styles['edition-line']}><span>YOROROICE / PERSONAL JOURNAL</span><span>{edition} / 001—005</span></div>
      <div className={styles['poster-copy']}>
        <p className={styles.eyebrow}><span>ALLOTYPE®</span><span>{tagline}</span></p>
        <h1 id="allotype-title"><span>{copy.first}</span><span>{copy.second}</span></h1>
        <div className={styles['copy-bottom']}>
          <span className={styles['serif-note']} aria-hidden="true">Never<br />identical.</span>
          <p className={styles.intro}>{copy.note}</p>
          <Link href="/articles" className={styles['read-link']}>{copy.explore}<ArrowUpRight size={24} /></Link>
        </div>
      </div>
      <div className={styles.specimen}>
        <div className={styles['specimen-caption']}><span>FIG. 0{index + 1} / {seed.name}</span><span>{seed.value.length * 4} BITS</span></div>
        <div className={styles['specimen-art']}>
          {design === 'allotype' ? <AllotypeArt index={index} interactive animated={!paused} /> : <div className={styles['art-reserve']} />}
        </div>
        <span className={styles['specimen-coordinate']} aria-hidden="true">{seed.value.slice(0, 8)}<br />{seed.value.slice(-8)}</span>
        <div className={styles['specimen-bottom']}>
          <div aria-live="polite" aria-atomic="true"><span>{copy.selected}</span><strong key={index}>{names[index]}<i>0{index + 1}</i></strong></div>
          <div className={styles['art-actions']}>
            <button type="button" onClick={() => setPaused(value => !value)} aria-label={pauseLabel} title={pauseLabel}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
            <button type="button" onClick={() => setIndex(value => (value + 1) % ALLOTYPES.length)} aria-label={nextLabel} title={nextLabel}><ArrowRight size={22} /></button>
          </div>
        </div>
      </div>
      <div className={styles['seed-strip']}>
        <div className={styles['seed-label']}><span>{copy.switch}<small>CHOOSE YOUR IMPRESSION</small></span><ArrowUpRight size={20} /></div>
        <div className={styles['seed-options']} role="group" aria-label={copy.switch}>
          {ALLOTYPES.map((item, itemIndex) => <button type="button" key={item.name} onClick={() => setIndex(itemIndex)}
            aria-label={item.name} aria-pressed={index === itemIndex} style={{ '--seed-color': item.color } as CSSProperties}>
            <span className={styles['seed-top']}><i /><small>0{itemIndex + 1}</small></span><span>{item.name}</span><span className={styles['seed-name']} aria-hidden="true">{names[itemIndex]}</span>
          </button>)}
        </div>
      </div>
      <div className={styles['hash-line']}>
        <svg className={styles['byte-print']} viewBox={`0 0 ${bytes.length * 4} 28`} preserveAspectRatio="none" aria-hidden="true">
          {bytes.map((byte, byteIndex) => <rect key={byteIndex} x={byteIndex * 4} y={28 - (5 + byte / 255 * 23)} width={1 + byte % 3} height={5 + byte / 255 * 23} fill="currentColor" />)}
        </svg>
        <code>{seed.value}</code><a href="#allotype-writing" aria-label={translate(locale, 'latest')}><ArrowDown size={19} /></a>
      </div>
    </section>
    <nav className={styles['index-band']} aria-label={translate(locale, 'contents')}>
      {(['articles', 'moments', 'gallery', 'chat', 'lab', 'about'] as const).map((key, itemIndex) =>
        <Link href={`/${key}`} key={key}><small>0{itemIndex + 1}</small><span>{translate(locale, key)}</span><ArrowUpRight size={18} /></Link>)}
    </nav>
    <section className={styles.writing} id="allotype-writing">
      <header className={styles['section-title']}><span>(01—04)</span><h2>{copy.writing}<i>Words in form.</i></h2><Link href="/articles">{translate(locale, 'all')}<ArrowUpRight size={20} /></Link></header>
      {articleState}
      <div className={styles['story-list']}>
        {articles.slice(0, 4).map((entry, itemIndex) => <Link key={entry._id} href={`/articles/${entry._id}`} className={styles.story}>
          <span className={styles['story-number']}>0{itemIndex + 1}</span>
          <div><div className={styles['story-meta']}><time>{dateLabel(entry.createdAt, locale)}</time><span>{entry.category}</span></div><h3>{entry.title}</h3><p>{excerpt(articlePreview(entry.content).content, 110)}</p></div>
          <ArrowUpRight className={styles['story-arrow']} size={32} />
        </Link>)}
      </div>
    </section>
    <section className={styles.fragments}>
      <header className={styles['section-title']}><span>(∞)</span><h2>{copy.moments}<i>Still becoming.</i></h2><Link href="/moments">{translate(locale, 'all')}<ArrowUpRight size={20} /></Link></header>
      {momentState}
      <div className={styles['fragment-grid']}>{moments.slice(0, 3).map((entry, itemIndex) =>
        <Link key={entry._id} href={`/moments/${entry._id}`} className={styles.fragment}>
          <span className={styles['fragment-symbol']} aria-hidden="true">{['✳', '◒', '↗'][itemIndex]}</span>
          <time>{dateLabel(entry.createdAt, locale)}</time><h3>{entry.title}</h3><p>{excerpt(entry.content, 80)}</p><ArrowUpRight size={24} />
        </Link>)}</div>
    </section>
    <div className={styles.colophon}><span>{copy.colophon}</span><strong>ALLOTYPE<span>®</span></strong><div>{ALLOTYPES.map(seed => <i key={seed.name} style={{ background: seed.color }} title={`${seed.name} ${seed.color}`} />)}</div></div>
  </div>
}
