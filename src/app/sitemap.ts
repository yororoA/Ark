import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo'
import { getSitemapContent } from '@/lib/server/public-content'

export const revalidate = 3600

const staticRoutes: MetadataRoute.Sitemap = [
  { url: absoluteUrl('/home'), changeFrequency: 'daily', priority: 1 },
  { url: absoluteUrl('/articles'), changeFrequency: 'daily', priority: 0.9 },
  { url: absoluteUrl('/moments'), changeFrequency: 'daily', priority: 0.8 },
  { url: absoluteUrl('/gallery'), changeFrequency: 'weekly', priority: 0.7 },
  { url: absoluteUrl('/archive'), changeFrequency: 'daily', priority: 0.7 },
  { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.6 },
  { url: absoluteUrl('/lab'), changeFrequency: 'monthly', priority: 0.5 },
  { url: absoluteUrl('/notice'), changeFrequency: 'monthly', priority: 0.4 },
  { url: absoluteUrl('/terms'), changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getSitemapContent().catch(() => undefined)
  const articles = content?.data.articles || []
  const moments = content?.data.moments || []

  const articleRoutes: MetadataRoute.Sitemap = articles.map(article => ({
    url: absoluteUrl(`/articles/${article._id}`),
    lastModified: article.updatedAt || article.createdAt,
    changeFrequency: 'monthly',
    priority: 0.8,
    images: article.coverUrl ? [article.coverUrl] : undefined,
  }))
  const momentRoutes: MetadataRoute.Sitemap = moments.map(moment => ({
    url: absoluteUrl(`/moments/${moment._id}`),
    lastModified: moment.updatedAt || moment.createdAt,
    changeFrequency: 'monthly',
    priority: 0.6,
    images: moment.images,
  }))

  return [...staticRoutes, ...articleRoutes, ...momentRoutes]
}
