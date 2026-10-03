import styles from './rain-planes.module.scss'

// Geometric layers from the MV's 00:42 / 02:27 / 03:20 compositions.
// Decorative only: content and focusable controls remain on a stable plane.
export default function RainPlanes({ variant = 'curtain' }: { variant?: 'curtain' | 'calendar' | 'sheets' | 'identity' }) {
  return <div className={styles['rain-planes']} data-variant={variant} aria-hidden="true">
    <div className={styles['curtain']}><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
    <div className={styles['frames']}><i /><i /><i /><i /></div>
    <div className={styles['fragments']}><i /><i /><i /><i /><i /><i /><i /><i /></div>
    <div className={styles['paired-sheets']}><i /><i /><i /></div>
    <div className={styles['mask-strips']}><i /><i /><i /></div>
    <span className={styles['scale-glyph']} />
    <svg className={styles['water-lines']} viewBox="0 0 800 300" preserveAspectRatio="none" fill="none">
      <path d="M-40 280L290 210L742 -18M82 314L290 210L842 275M58 42H318M560 24V270" stroke="currentColor" />
      <path d="M123 96H460M376 55V252" stroke="currentColor" strokeDasharray="2 9" />
      <path d="M214 242C302 212 612 210 748 244M282 252C364 232 566 231 657 249M355 259C418 247 524 248 579 258" stroke="currentColor" />
    </svg>
  </div>
}
