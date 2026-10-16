'use client'

import { useBlog } from './blog-provider'
import styles from './blog.module.scss'

export default function BlogRouteLoading() {
  const { t } = useBlog()
  // The P3R wipe briefly keeps this skeleton covered while content streams in.
  return <div className={styles['page']} data-route-loading>
    <div className={styles['state-box']} role="status">
      <span className={styles['loading-line']} />
      {t('loading')}
    </div>
  </div>
}
