'use client'

import { useState } from 'react'
import Link from '@/components/appearance/p3r-link'
import { ArrowUpRight } from 'lucide-react'
import { Entry, Envelope } from '@/lib/blog'
import { useBlog, useBlogData } from './blog-provider'
import { useAllArticles } from './content-data'
import { PageHeading, State, styles } from './shared'
import { BlogSelect } from './controls'

export default function Archive() {
  const { t } = useBlog()
  const [type, setType] = useState('all')
  const [year, setYear] = useState('all')
  const articles = useAllArticles()
  const moments = useBlogData<Envelope<Entry[]>>('moments/get?isEditing=false')
  const entries = [
    ...(articles.data || []).map(entry => ({ ...entry, kind: 'articles' as const })),
    ...(moments.data?.data || []).map(entry => ({ ...entry, kind: 'moments' as const })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const years = [...new Set(entries.map(entry => entry.createdAt.slice(0, 4)))]
  const filtered = entries.filter(entry => (type === 'all' || entry.kind === type) && (year === 'all' || entry.createdAt.startsWith(year)))
  const groups = Map.groupBy(filtered, entry => entry.createdAt.slice(0, 4))
  const ready = !!articles.data && !!moments.data
  return <div className={styles['page']}>
    <PageHeading title="archive" english="Traces of time" number="04"><span className={styles['form-note']}>{ready ? entries.length : '—'} {t('entries')}</span></PageHeading>
    <div className={styles['toolbar']}><div className={styles['filters']}>{(['all', 'articles', 'moments'] as const).map(value => <button key={value} aria-pressed={value === type} onClick={() => setType(value)}>{t(value)}</button>)}</div><BlogSelect label={t('year')} value={year} onChange={setYear} compact options={[{ value: 'all', label: t('all') }, ...years.map(value => ({ value, label: value }))]} /></div>
    <State loading={articles.isLoading || moments.isLoading} error={articles.error || moments.error} empty={ready && !filtered.length} retry={() => { void articles.mutate(); void moments.mutate() }} />
    {Array.from(groups, ([year, rows]) => <section className={styles['archive-year']} key={year}><h2>{year}</h2><div>{rows.map(entry => <Link href={`/${entry.kind}/${entry._id}`} prefetch={false} key={`${entry.kind}-${entry._id}`} className={styles['archive-row']}><time dateTime={entry.createdAt}>{entry.createdAt.slice(5, 10).replace('-', '.')}</time><strong>{entry.title}</strong><small>{t(entry.kind)}</small><ArrowUpRight size={16} /></Link>)}</div></section>)}
  </div>
}
