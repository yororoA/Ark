'use client'

import { useBlog } from './blog-provider'
import styles from './blog.module.scss'

export default function BlogRouteLoading() {
  const { t } = useBlog()
  return <div className={styles['page']}>
    <div className={styles['state-box']} role="status">
      <span className={styles['loading-line']} />
      {t('loading')}
    </div>
  </div>
}
