'use client'

import type { Design } from '@/lib/appearance'
import { PrismOptics } from './prism-scene'
import AllotypeArt from './allotype-art'
import styles from './theme-preview.module.scss'

// These are miniature compositions, sharing the actual optics and generated
// artwork where a theme has its own renderer. They never run background motion.
export default function ThemePreview({ design }: { design: Design }) {
  return <div className={styles.cover} data-preview={design} aria-hidden="true">
    {design === 'prism' ? <>
      <div className={styles['prism-heading']}>THE DARK SIDE<span>OF THE EVERYDAY.</span></div>
      <PrismOptics className={styles.optics} animated={false} />
      <div className={styles['prism-signature']}>月之暗面<small>YOROROICE / ARK</small></div>
      <div className={styles['prism-stars']}><i /><i /><i /><i /></div>
    </> : design === 'allotype' ? <>
      <div className={styles['allotype-top']}>ALLOTYPE® / PERSONAL IMPRESSIONS</div>
      <div className={styles['allotype-title']}>保持<span>异相</span><i>Never identical.</i></div>
      <div className={styles['allotype-print']}><AllotypeArt animated={false} /></div>
      <div className={styles['allotype-bottom']}>{['#919119', '#c6dc4c', '#e7d47b', '#623b49', '#ff1346'].map(color => <i key={color} style={{ backgroundColor: color }} />)}</div>
    </> : design === 'p3r' ? <>
      <span className={styles['p3r-top']}>YOUR DAYS. YOUR STORY.</span>
      <div className={styles['p3r-slice']} /><div className={styles['p3r-circle']} />
      <div className={styles['p3r-title']}>P3R<small>RELOAD</small></div>
      <div className={styles['p3r-bottom']}><span>01 / EVERY DAY</span><i />MAKE IT YOURS. ↗</div>
    </> : design === 'rain' ? <>
      <div className={styles['rain-columns']}><i /><i /><i /></div>
      <div className={styles['rain-frame']} />
      <div className={styles['rain-caption']}>A QUIET JOURNAL</div>
      <div className={styles['rain-title']}>青笺<span>Qingjian</span></div>
      <div className={styles['rain-note']}>在时间的留白里，写下日常。</div>
      <div className={styles['rain-bottom']}><i /><i /><span>YOROROICE / ARK</span></div>
    </> : <>
      <div className={styles['archive-top']}><span>YOROROICE</span><span>PERSONAL ARCHIVE / 01</span></div>
      <div className={styles['archive-title']}>Ark.<span>A record of being.</span></div>
      <svg className={styles['archive-orbit']} viewBox="0 0 320 320" fill="none">
        <circle cx="160" cy="160" r="125" stroke="currentColor" strokeWidth=".6" />
        <ellipse cx="160" cy="160" rx="142" ry="66" transform="rotate(-46 160 160)" stroke="currentColor" strokeWidth="1.4" />
        <ellipse cx="160" cy="160" rx="135" ry="95" transform="rotate(30 160 160)" stroke="currentColor" strokeWidth=".6" />
        <path d="M160 14V306M14 160H306M106 272V135Q106 83 160 56Q214 83 214 135V272Z" stroke="currentColor" strokeWidth=".7" />
        <circle cx="262" cy="64" r="5" fill="currentColor" /><circle cx="65" cy="258" r="3" fill="currentColor" />
      </svg>
      <div className={styles['archive-bottom']}><span>WORDS<br />MOMENTS<br />& THINGS</span><i /><span>一个人的<br />日常档案。</span></div>
    </>}
  </div>
}
