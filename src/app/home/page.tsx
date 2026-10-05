import Home from '@/components/blog/home'
import { getArticlesPage, getPublishedMoments } from '@/lib/server/public-content'

// main@ffc45dd 的空白透视布局保留在 Git 历史中。
export default async function Page() {
  const [articles, moments] = await Promise.allSettled([
    getArticlesPage(1, 4),
    getPublishedMoments(),
  ])

  return (
    <Home
      initialArticles={articles.status === 'fulfilled' ? articles.value : undefined}
      initialMoments={moments.status === 'fulfilled' ? { data: moments.value } : undefined}
    />
  )
}
