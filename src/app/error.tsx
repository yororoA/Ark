'use client'

import Link from 'next/link'
import styles from '@/components/blog/blog.module.scss'

export default function ErrorPage({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <div className={styles['blog-root']}><div className={styles['page']}><header className={styles['page-heading']}><div><div className={styles['eyebrow']}>AN INTERRUPTION</div><h1>稍候<span className={styles['english-title']}>A moment, please.</span></h1></div></header><div className={styles['state-box']}><p>页面暂时无法显示，请重试。</p><button className={styles['primary-button']} onClick={unstable_retry}>重试 / Try again</button><Link className={styles['text-link']} href="/home">首页 / Prologue ↗</Link></div></div></div>
}
