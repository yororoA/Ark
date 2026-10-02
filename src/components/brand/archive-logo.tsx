import Image from 'next/image'
import styles from './archive-logo.module.scss'

export default function ArchiveLogo({ priority = false }: { priority?: boolean }) {
  return (
    <span className={styles['archive-logo']}>
      <span className={styles['logo-image']} aria-hidden="true">
        <Image className={styles['logo-light']} src="/logo.png" alt="" fill sizes="132px" priority={priority} />
        <Image className={styles['logo-dark']} src="/logo_white.png" alt="" fill sizes="132px" priority={priority} />
      </span>
      <span className={styles['logo-caption']}>ARK / PERSONAL ARCHIVE</span>
    </span>
  )
}
