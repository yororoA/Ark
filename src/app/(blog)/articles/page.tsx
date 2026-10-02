import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ArticleList } from '@/components/blog/articles'
import { legacyDestination, legacySearchParams, type LegacyQuery } from '@/lib/legacy-route'

export const metadata = { title: '文章' }
export default async function Page({ searchParams }: { searchParams: Promise<LegacyQuery> }) {
  const query = legacySearchParams(await searchParams)
  const kid = query.get('kid')
  if (kid && /^[a-f0-9]{24}$/.test(kid)) redirect(legacyDestination('/articles', query)!)
  return <Suspense><ArticleList /></Suspense>
}
