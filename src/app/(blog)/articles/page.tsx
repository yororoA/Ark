import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ArticleList } from '@/components/blog/articles'
import { legacyDestination, legacySearchParams, type LegacyQuery } from '@/lib/legacy-route'
import { pageMetadata } from '@/lib/seo'
import { getAllArticles, getArticlesPage } from '@/lib/server/public-content'

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
  let initialData

  try {
    if (date) {
      const limit = 10
      const articles = await getAllArticles()
      const filtered = articles.filter(entry => (
        entry.createdAt.startsWith(date)
        && (!category || entry.category === category)
        && (!keyword || `${entry.title} ${entry.content}`.toLowerCase().includes(keyword.toLowerCase()))
      ))
      initialData = {
        data: filtered.slice((page - 1) * limit, page * limit),
        pagination: {
          page,
          limit,
          total: filtered.length,
          pages: Math.ceil(filtered.length / limit),
        },
      }
    } else {
      initialData = await getArticlesPage(page, 10, keyword, category)
    }
  } catch {
    initialData = undefined
  }

  return <Suspense><ArticleList initialData={initialData} /></Suspense>
}
