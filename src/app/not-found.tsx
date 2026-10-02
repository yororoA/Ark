'use client'

import Link from 'next/link'
import BlogShell from '@/components/blog/blog-shell'
import { useBlog } from '@/components/blog/blog-provider'
import { styles } from '@/components/blog/shared'

function Missing() {
  const { t } = useBlog()
  return <div className={styles['page']}><header className={styles['page-heading']}><div><div className={styles['eyebrow']}>PAGE NOT FOUND</div><h1>404<span className={styles['english-title']}>Lost in time</span></h1></div></header><div className={styles['state-box']}><p>{t('notFound')}</p><Link href="/home" className={styles['primary-button']}>{t('home')} ↗</Link></div></div>
}
export default function NotFound() { return <BlogShell><Missing /></BlogShell> }
