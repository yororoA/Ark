import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MomentList } from '@/components/blog/moments'
import { legacyDestination, legacySearchParams, type LegacyQuery } from '@/lib/legacy-route'
import { pageMetadata } from '@/lib/seo'
import { getPublishedMoments } from '@/lib/server/public-content'

const description = '浏览 YororoIce 关于生活、摄影与即时灵感的短篇记录。'

export async function generateMetadata({ searchParams }: { searchParams: Promise<LegacyQuery> }): Promise<Metadata> {
  const query = legacySearchParams(await searchParams)
  const metadata = pageMetadata({ title: '片刻', description, path: '/moments' })
  const hasFilters = ['date', 'page'].some(key => query.has(key))
  return hasFilters ? { ...metadata, robots: { index: false, follow: true } } : metadata
}

export default async function Page({ searchParams }: { searchParams: Promise<LegacyQuery> }) {
  const query = legacySearchParams(await searchParams)
  const mid = query.get('mid')
  if (mid && /^[a-f0-9]{24}$/.test(mid)) redirect(legacyDestination('/moments', query)!)

  const moments = await getPublishedMoments().catch(() => undefined)
  return <Suspense><MomentList initialData={moments ? { data: moments } : undefined} /></Suspense>
}
