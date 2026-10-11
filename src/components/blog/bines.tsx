'use client'

import dynamic from 'next/dynamic'
import useSWR from 'swr'
import { ArrowUpRight } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import { binesText, type BinesPublic } from '@/lib/bines'
import type { Envelope } from '@/lib/blog'
import { request, useBlog } from './blog-provider'
import { PageHeading, State, styles } from './shared'
import local from './bines.module.scss'

const BinesAccess = dynamic(() => import('./bines-admin'), { loading: () => <State loading /> })

export default function Bines() {
  const { t, locale, session } = useBlog()
  const text = binesText(locale)
  const { data, error, isLoading, mutate } = useSWR<Envelope<BinesPublic>>('/api/bines/profile', request, { refreshInterval: 30_000 })
  const profile = data?.data.profile
  const online = data?.data.presence.online
  const status = !data || error ? 'unknown' : online ? 'online' : 'offline'
  return <div className={styles['page']}>
    <PageHeading title="bines" english="Bines" number="08">
      <span className={styles['status']} data-online={!error && online}><i />{t(status)}</span>
    </PageHeading>
    <section className={local['profile-section']}>
      <div className={local['identity-mark']} aria-hidden="true"><span>B</span><small>ARK / BINES</small></div>
      <div className={local['profile-copy']}>
        <div className={styles['eyebrow']}>{text('agent')}</div>
        <h2>{profile?.displayName || text('identity')}</h2>
        <p className={local['bio']}>{profile?.bio || text('intro')}</p>
        <State loading={isLoading} error={error ? new Error(text('requestFailed')) : undefined} retry={() => mutate()} />
        {data && !profile && <p className={local['empty-note']}>{text('unconfigured')}</p>}
        {profile && <p className={local['account-id']}>UID · {profile.uid}</p>}
        <div className={styles['form-actions']}><Link className={styles['text-link']} href="/moments">{t('moments')}<ArrowUpRight size={15} /></Link><Link className={styles['text-link']} href="/chat">{t('chat')}<ArrowUpRight size={15} /></Link></div>
      </div>
    </section>
    {session?.isAdmin && <BinesAccess key={session.uid} uid={session.uid} refreshProfile={mutate} />}
  </div>
}
