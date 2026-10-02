'use client'

import { useState } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { useBlog } from './blog-provider'
import { PageHeading, styles } from './shared'

export default function Lab() {
  const { t } = useBlog()
  const [open, setOpen] = useState(false)
  return <div className={styles['page']}><PageHeading title="lab" english="Small experiments" number="06" />
    <section className={styles['lab-poster']}><div><div className={styles['eyebrow']}>EXPERIMENT 001 / f(t)</div><h2>{t('labTitle')}</h2><p>{t('labBody')}</p><button className={styles['primary-button']} onClick={() => setOpen(!open)}>{t(open ? 'close' : 'openTool')}{open ? <X size={16} /> : <ArrowUpRight size={16} />}</button></div>
      <svg viewBox="0 0 500 300" fill="none" aria-hidden="true"><path d="M0 150H500M250 0V300" stroke="currentColor" opacity=".2" /><circle cx="250" cy="150" r="120" stroke="currentColor" opacity=".3" /><path d="M0 150C60 -35 100 -35 160 150S260 335 320 150 420 -35 500 150" stroke="currentColor" strokeWidth="2" /><path d="M20 150C70 90 110 90 160 150S270 210 320 150 430 90 480 150" stroke="currentColor" strokeWidth=".5" /><text x="365" y="268" fill="currentColor" fontSize="28" fontFamily="Georgia" fontStyle="italic">f(t) = memory</text></svg>
    </section>
    {open && <iframe className={styles['tool-frame']} src="/lab/function-speed-player.html" title={t('openTool')} sandbox="allow-scripts" allow="autoplay" />}
  </div>
}
