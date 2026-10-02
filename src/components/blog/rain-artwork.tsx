import { useId } from 'react'
import type { Locale } from '@/lib/blog'
import styles from './rain-artwork.module.scss'

const CAPTIONS = {
  zh: ['雨声', '把片刻，写成回声。'],
  en: ['Rain', 'Moments, echoed.'],
  ja: ['雨音', 'ひとときを、こだまに。'],
  de: ['Regen', 'Ein leises Echo.'],
}

// Geometry drawn from the video's umbrella columns, octagonal field and paper
// fragments. No frames or illustrations from the source are shipped.
export default function RainArtwork({ locale }: { locale: Locale }) {
  const id = useId().replaceAll(':', '')
  return <div className={styles['rain-art']} aria-hidden="true">
    <svg className={styles['rain-space']} viewBox="0 0 760 720" fill="none">
      <defs>
        <pattern id={`${id}-octagons`} width="68" height="68" patternUnits="userSpaceOnUse">
          <path d="M21 6H47L62 21V47L47 62H21L6 47V21Z" fill="currentColor" />
        </pattern>
      </defs>
      <circle cx="412" cy="325" r="288" stroke="currentColor" strokeWidth=".6" />
      <path d="M162 116L566 630H47L387 36L691 536H124" stroke="currentColor" strokeWidth=".5" opacity=".6" />
      <path d="M0 580H756M43 592H691M595 34V676" stroke="currentColor" strokeWidth=".6" />
      <path d="M160 538H221V492H267V451H301M535 596H577V566H626" stroke="currentColor" strokeWidth=".8" />
      <path d="M450 80H720V510H450Z" fill={`url(#${id}-octagons)`} opacity=".18" />
      <circle cx="595" cy="580" r="4" fill="currentColor" />
    </svg>
    <div className={styles['rain-columns']}>
      {[0, 1, 2].map(index => <div className={styles['rain-column']} key={index}>
        <svg viewBox="0 0 240 600" preserveAspectRatio="none" fill="none">
          <defs>
            <linearGradient id={`${id}-water-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="var(--ark-rain)" stopOpacity=".65" />
              <stop offset=".67" stopColor="var(--ark-rain)" stopOpacity=".3" />
              <stop offset="1" stopColor="var(--ark-rain)" stopOpacity=".02" />
            </linearGradient>
            <pattern id={`${id}-streak-${index}`} width="19" height="105" patternUnits="userSpaceOnUse">
              <path d="M1 0V65M8 77V103M16 29V91" stroke="var(--ark-rain-sheet)" strokeWidth=".6" opacity=".45" />
            </pattern>
          </defs>
          <path d="M10 95H230V600H10Z" fill={`url(#${id}-water-${index})`} />
          <path d="M10 95H230V600H10Z" fill={`url(#${id}-streak-${index})`} />
          <path d="M10 95C48 51 72 47 120 38C168 47 192 51 230 95Z" fill="var(--ark-rain-deep)" opacity=".84" />
          <path d="M10 95C64 65 96 58 120 38C144 58 176 65 230 95M120 38V24M120 95V259C120 282 96 282 96 261" stroke="var(--ark-rain-deep)" strokeWidth="2" strokeLinecap="round" />
          <path d="M62 94Q84 51 120 38Q156 51 178 94" stroke="var(--ark-rain-sheet)" strokeWidth=".6" opacity=".55" />
        </svg>
      </div>)}
    </div>
    <div className={styles['rain-ripples']}><i /><i /><i /><i /></div>
    <div className={styles['rain-fragments']}>{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
    <div className={styles['rain-caption']}><span>{CAPTIONS[locale][0]}</span><small>{CAPTIONS[locale][1]}</small></div>
    <div className={styles['rain-footnote']}>SOMEWHERE, IT IS RAINING.<span>YOROROICE / ARK</span></div>
  </div>
}
