'use client'

import { useState } from 'react'
import Link from '@/components/appearance/p3r-link'
import { ArrowUpRight } from 'lucide-react'
import { ArchiveEntry, Envelope } from '@/lib/blog'
import { useBlog, useBlogData } from './blog-provider'
import { PageHeading, Pagination, State, styles } from './shared'
import { BlogSelect } from './controls'

export default function Archive({
  initialData,
  initialYears,
}: {
  initialData?: Envelope<ArchiveEntry[]>
  initialYears?: Envelope<string[]>
}) {
  const { t } = useBlog()
  const [type, setType] = useState<'all' | 'articles' | 'moments'>('all')
  const [year, setYear] = useState('all')
  const [page, setPage] = useState(1)
  const archive = useBlogData<Envelope<ArchiveEntry[]>>(`archive/feed?type=${type}&year=${year}&page=${page}&limit=50`, {
    fallbackData: page === 1 && type === 'all' && year === 'all' ? initialData : undefined,
    revalidateOnMount: !(page === 1 && type === 'all' && year === 'all' && initialData),
  })
  const years = useBlogData<Envelope<string[]>>('archive/years', {
    fallbackData: initialYears,
    revalidateOnMount: !initialYears,
  })
  const entries = archive.data?.data || []
  const groups = Map.groupBy(entries, entry => entry.createdAt.slice(0, 4))
  const changeType = (value: 'all' | 'articles' | 'moments') => { setType(value); setPage(1) }
  const changeYear = (value: string) => { setYear(value); setPage(1) }
  return <div className={styles['page']}>
    <PageHeading title="archive" english="Traces of time" number="04"><span className={styles['form-note']}>{archive.data?.pagination?.total ?? '—'} {t('entries')}</span></PageHeading>
    <div className={styles['toolbar']}><div className={styles['filters']}>{(['all', 'articles', 'moments'] as const).map(value => <button key={value} aria-pressed={value === type} onClick={() => changeType(value)}>{t(value)}</button>)}</div><BlogSelect label={t('year')} value={year} onChange={changeYear} compact options={[{ value: 'all', label: t('all') }, ...(years.data?.data || []).map(value => ({ value, label: value }))]} /></div>
    <State loading={archive.isLoading || years.isLoading} error={archive.error || years.error} empty={!!archive.data && !entries.length} retry={() => { void archive.mutate(); void years.mutate() }} />
    {Array.from(groups, ([year, rows]) => <section className={styles['archive-year']} key={year}><h2>{year}</h2><div>{rows.map(entry => <Link href={`/${entry.kind}/${entry._id}`} prefetch={false} key={`${entry.kind}-${entry._id}`} className={styles['archive-row']}><time dateTime={entry.createdAt}>{entry.createdAt.slice(5, 10).replace('-', '.')}</time><strong>{entry.title}</strong><small>{t(entry.kind)}</small><ArrowUpRight size={16} /></Link>)}</div></section>)}
    <Pagination page={page} pages={archive.data?.pagination?.pages || 1} change={setPage} />
  </div>
}
