import Archive from '@/components/blog/archive'
import { pageMetadata } from '@/lib/seo'
import { getAllArticles, getPublishedMoments } from '@/lib/server/public-content'

export const metadata = pageMetadata({
  title: '归档',
  description: '按时间浏览 YororoIce Ark 的文章与片刻记录。',
  path: '/archive',
})

export default async function Page() {
  const [articles, moments] = await Promise.allSettled([
    getAllArticles(),
    getPublishedMoments(),
  ])

  return (
    <Archive
      initialArticles={articles.status === 'fulfilled' ? articles.value : undefined}
      initialMoments={moments.status === 'fulfilled' ? { data: moments.value } : undefined}
    />
  )
}
