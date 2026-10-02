import styles from './ark-wordmark.module.scss'

export default function ArkWordmark({ display = false }: { display?: boolean }) {
  return (
    <span className={styles['wordmark']} data-display={display}>
      <span className={styles['wordmark-mark']} aria-hidden="true">Ark.</span>
      <span className={styles['wordmark-copy']}>
        <strong>YOROROICE</strong>
        <small>PERSONAL ARCHIVE</small>
      </span>
    </span>
  )
}
