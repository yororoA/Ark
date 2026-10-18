import type { CSSProperties } from 'react'
import { SPECTRUM } from '@/lib/prism-copy'
import styles from './prism-record.module.scss'

interface Props { title: string; category?: string; coverUrl?: string; coverAlt?: string; id: string; date: string }

export default function PrismRecord({ title, category, coverUrl, coverAlt, id, date }: Props) {
  const seed = [...id + title].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return <figure className={styles.record} style={{ '--record-label': SPECTRUM[seed % SPECTRUM.length] } as CSSProperties} data-testid="prism-record">
    <div className={styles.disc} aria-hidden="true"><div className={styles['disc-label']}><small>YOROROICE</small><strong>SIDE A</strong><i /><span>33⅓ · STEREO</span></div></div>
    <div className={styles.jacket}>
      {coverUrl
        // eslint-disable-next-line @next/next/no-img-element -- Existing article cover, no generated substitute.
        ? <img src={coverUrl} alt={coverAlt || title} loading="lazy" decoding="async" />
        : <svg className={styles['cover-geometry']} viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="220" cy="64" r="87" fill="none" stroke="currentColor" strokeWidth=".5" />
          <path d="M150 72L55 233H245Z" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M-10 230L110 166L188 166L320 125" fill="none" stroke="currentColor" strokeWidth="1" />
          {SPECTRUM.map((color, index) => <path key={color} d={`M${188 + index * 1.8} ${166 + index * 3}L320 ${125 + index * 9}`} stroke={color} strokeWidth="3" />)}
        </svg>}
      <div className={styles['cover-print']} aria-hidden="true"><span>{category || 'PERSONAL RECORDINGS'}</span><strong>{title}</strong><small>YOROROICE / {date.slice(0, 4)}</small></div>
      <span className={styles.spine} aria-hidden="true">ARK · {id.slice(-4).toUpperCase()}</span>
    </div>
    <figcaption aria-hidden="true"><span>LP — {id.slice(-4).toUpperCase()}</span><i /><span>{date.slice(0, 10).replaceAll('-', '.')}</span></figcaption>
  </figure>
}
