import Home from '@/components/blog/home'
import { pageMetadata } from '@/lib/seo'
import { getArticlesPage, getHomeMomentSummary } from '@/lib/server/public-content'

export const metadata = pageMetadata({
  title: '首页',
  description: 'YororoIce 的个人博客，记录代码、日常、摄影与偶然闪过的念头。',
  path: '/home',
})

// main@ffc45dd 的空白透视布局保留在 Git 历史中。
export default async function Page() {
  const [articles, moments] = await Promise.allSettled([
    getArticlesPage(1, 4),
    getHomeMomentSummary(),
  ])

  return (
    <Home
      initialArticles={articles.status === 'fulfilled' ? articles.value : undefined}
      initialMoments={moments.status === 'fulfilled' ? moments.value : undefined}
    />
  )
}
