import styles from './prism-logo.module.scss'

export default function PrismLogo() {
  return <span className={styles.logo}>
    <svg viewBox="0 0 54 44" fill="none" aria-hidden="true"><path d="M27 3L4 41H50Z" stroke="currentColor" strokeWidth=".8" /><path d="M0 28L16 22L38 22L54 16M38 24L54 21M39 26L54 26" stroke="currentColor" strokeWidth=".6" /></svg>
    <span>YOROROICE<small>LIGHT / SOUND / MEMORY</small></span>
  </span>
}
