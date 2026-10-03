import { useId } from 'react'
import type { Locale } from '@/lib/blog'
import { UMBRELLA_CROWN_HEIGHT, UMBRELLA_RIB_PATH, UMBRELLA_SIDE_PATH, UMBRELLA_TOP_PATH } from '@/components/appearance/rain-umbrella-geometry'
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
          <g transform="translate(34 34) scale(30)">
            <path d={UMBRELLA_TOP_PATH} fill="currentColor" />
            <path d={UMBRELLA_RIB_PATH} stroke="var(--ark-rain-sheet)" strokeWidth=".016" opacity=".7" />
          </g>
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
          <path data-umbrella="side" d={UMBRELLA_SIDE_PATH} transform="translate(120 95) scale(110)" fill="var(--ark-rain-deep)" opacity=".84" />
          <path d={`M120 ${95 - 110 * UMBRELLA_CROWN_HEIGHT}v-11M120 95V259C120 282 96 282 96 261`} stroke="var(--ark-rain-deep)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>)}
    </div>
    <div className={styles['rain-ripples']}><i /><i /><i /><i /></div>
    <div className={styles['rain-fragments']}>{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
    <div className={styles['rain-caption']}><span>{CAPTIONS[locale][0]}</span><small>{CAPTIONS[locale][1]}</small></div>
    <div className={styles['rain-footnote']}>SOMEWHERE, IT IS RAINING.<span>YOROROICE / ARK</span></div>
  </div>
}
