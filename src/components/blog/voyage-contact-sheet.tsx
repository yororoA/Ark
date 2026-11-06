'use client'
/* eslint-disable @next/next/no-img-element -- The contact sheet preserves the full frame of arbitrary gallery media. */

import { useState, type MouseEvent } from 'react'
import { ArrowUpRight, ImageOff, Play } from 'lucide-react'
import { dateLabel, translate, type Locale, type Media } from '@/lib/blog'
import styles from './voyage-contact-sheet.module.scss'

const COPY = {
  zh: { sheet: '光的留页', unknown: '日期未记录', frame: '幅', unavailable: '预览暂不可用', open: '打开查看' },
  en: { sheet: 'Contact sheets', unknown: 'Date unrecorded', frame: 'frames', unavailable: 'Preview unavailable', open: 'Open to view' },
  ja: { sheet: '光の記録', unknown: '日付の記録なし', frame: '点', unavailable: 'プレビューを表示できません', open: '開いて見る' },
  de: { sheet: 'Lichtblätter', unknown: 'Datum unbekannt', frame: 'Aufnahmen', unavailable: 'Vorschau nicht verfügbar', open: 'Öffnen' },
}
const LOCALES = { zh: 'zh-CN', en: 'en-GB', ja: 'ja-JP', de: 'de-DE' }
type Selection = (index: number, element: HTMLButtonElement) => void

function Frame({ file, index, locale, onSelect }: { file: Media; index: number; locale: Locale; onSelect: Selection }) {
  const [failed, setFailed] = useState(false)
  const copy = COPY[locale]
  const video = file.mime.startsWith('video')
  const caption = file.desc?.trim() || file.filename
  const dated = !!file.createdAt && !Number.isNaN(Date.parse(file.createdAt))
  const open = (event: MouseEvent<HTMLButtonElement>) => onSelect(index, event.currentTarget)

  return <figure className={styles.frame} data-gallery-index={index} data-media-url={file.url}>
    <button type="button" className={styles.window} onClick={open} aria-label={`${translate(locale, 'preview')} ${caption}`} data-media-kind={video ? 'video' : 'image'} data-failed={failed}>
      {!failed && (video
        ? <video src={file.url} muted playsInline preload="metadata" onError={() => setFailed(true)} />
        : <img src={file.url} alt={caption} loading="lazy" onError={() => setFailed(true)} />)}
      {failed && <span className={styles.unavailable}><ImageOff size={25} strokeWidth={1} /><span>{copy.unavailable}</span><small>{copy.open}</small></span>}
      <span className={styles.corners} aria-hidden="true"><i/><i/><i/><i/></span>
      {video && <span className={styles.play} aria-hidden="true"><Play size={16} fill="currentColor"/>{translate(locale, 'video')}</span>}
      <span className={styles.expand} aria-hidden="true"><ArrowUpRight size={19}/></span>
    </button>
    <figcaption className={styles.caption}>
      <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <div><span className={styles.description}>{caption}</span><div className={styles.meta}>{dated ? <time dateTime={file.createdAt}>{dateLabel(file.createdAt!, locale)}</time> : <span>{copy.unknown}</span>}{file.username && <span>{file.username}</span>}</div></div>
    </figcaption>
  </figure>
}

export default function VoyageContactSheet({ media, locale, onSelect }: { media: Media[]; locale: Locale; onSelect: Selection }) {
  const copy = COPY[locale]
  const groups = new Map<string, { date: Date | null; items: { file: Media; index: number }[] }>()
  media.forEach((file, index) => {
    const value = file.createdAt ? new Date(file.createdAt) : null
    const date = value && !Number.isNaN(value.getTime()) ? value : null
    const key = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'undated'
    if (!groups.has(key)) groups.set(key, { date, items: [] })
    groups.get(key)!.items.push({ file, index })
  })
  if (!media.length) return null

  return <div className={styles.sheet} data-contact-sheet aria-label={copy.sheet}>
    {[...groups].map(([key, { date, items }]) => <section key={key} className={styles.month} data-gallery-month={key} aria-label={date ? new Intl.DateTimeFormat(LOCALES[locale], { year: 'numeric', month: 'long' }).format(date) : copy.unknown}>
      <header className={styles.monthHead}>
        <h2>{date ? <><span>{date.getFullYear()}</span><strong>{String(date.getMonth() + 1).padStart(2, '0')}</strong></> : <span className={styles.undated}>{copy.unknown}</span>}</h2>
        <span className={styles.frameCount}>{String(items.length).padStart(2, '0')}<span>{copy.frame}</span></span>
      </header>
      <div className={styles.photos} data-gallery-grid data-count={items.length}>{items.map(({ file, index }) => <Frame key={file.url} file={file} index={index} locale={locale} onSelect={onSelect} />)}</div>
    </section>)}
  </div>
}
