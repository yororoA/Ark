import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ArticleList } from '@/components/blog/articles'
import { legacyDestination, legacySearchParams, type LegacyQuery } from '@/lib/legacy-route'
import { pageMetadata } from '@/lib/seo'
import { getArticlesPage } from '@/lib/server/public-content'

const description = '阅读 YororoIce 关于前端开发、编程实践与日常思考的文章。'

export async function generateMetadata({ searchParams }: { searchParams: Promise<LegacyQuery> }): Promise<Metadata> {
  const query = legacySearchParams(await searchParams)
  const metadata = pageMetadata({ title: '文章', description, path: '/articles' })
  const hasFilters = ['keyword', 'category', 'date', 'page'].some(key => query.has(key))
  return hasFilters ? { ...metadata, robots: { index: false, follow: true } } : metadata
}

export default async function Page({ searchParams }: { searchParams: Promise<LegacyQuery> }) {
  const query = legacySearchParams(await searchParams)
  const kid = query.get('kid')
  if (kid && /^[a-f0-9]{24}$/.test(kid)) redirect(legacyDestination('/articles', query)!)

  const keyword = query.get('keyword') || ''
  const category = query.get('category') || ''
  const date = query.get('date') || ''
  const page = Math.max(1, Number(query.get('page')) || 1)
  const initialData = await getArticlesPage(page, 10, keyword, category, date).catch(() => undefined)

  return <Suspense><ArticleList initialData={initialData} /></Suspense>
}
