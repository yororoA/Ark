import styles from './rain-planes.module.scss'

// Geometric layers from the MV's 00:42 / 02:27 / 03:20 compositions.
// Decorative only: content and focusable controls remain on a stable plane.
export default function RainPlanes({ variant = 'curtain' }: { variant?: 'curtain' | 'calendar' | 'sheets' | 'identity' }) {
  return <div className={styles['rain-planes']} data-variant={variant} aria-hidden="true">
    <div className={styles['curtain']}><i /><i /><i /><i /><i /><i /><i /><i /></div>
    <div className={styles['frames']}><i /><i /><i /></div>
    <div className={styles['fragments']}><i /><i /><i /><i /><i /></div>
    <div className={styles['paired-sheets']}><i /><i /></div>
    <svg className={styles['water-lines']} viewBox="0 0 800 300" preserveAspectRatio="none" fill="none">
      <path d="M0 270L290 210L710 0M90 300L290 210L800 264" stroke="currentColor" />
      <ellipse cx="470" cy="240" rx="255" ry="30" stroke="currentColor" />
      <ellipse cx="470" cy="240" rx="175" ry="16" stroke="currentColor" />
    </svg>
  </div>
}
