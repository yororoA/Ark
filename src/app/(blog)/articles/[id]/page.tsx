import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticleDetail } from '@/components/blog/articles'
import StructuredData from '@/components/seo/structured-data'
import { articlePreview } from '@/lib/blog'
import { DEFAULT_SOCIAL_IMAGE, NO_INDEX, SITE_AUTHOR, SITE_NAME, absoluteUrl, seoDescription } from '@/lib/seo'
import { getArticle } from '@/lib/server/public-content'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!/^[a-f0-9]{24}$/.test(id)) return { title: '文章不存在', robots: NO_INDEX }

  const article = await getArticle(id)
  if (!article) return { title: '文章不存在', robots: NO_INDEX }

  const preview = articlePreview(article.content)
  const description = seoDescription(preview.content, article.title)
  const canonical = absoluteUrl(`/articles/${id}`)
  const images = preview.coverUrl
    ? [{ url: preview.coverUrl, alt: preview.coverAlt || article.title }]
    : [DEFAULT_SOCIAL_IMAGE]

  return {
    title: article.title,
    description,
    keywords: article.tags,
    authors: [{ name: article.username || SITE_AUTHOR, url: absoluteUrl('/about') }],
    alternates: { canonical },
    openGraph: {
      type: 'article',
      locale: 'zh_CN',
      url: canonical,
      siteName: SITE_NAME,
      title: article.title,
      description,
      publishedTime: article.createdAt,
      modifiedTime: article.updatedAt || article.createdAt,
      authors: [article.username || SITE_AUTHOR],
      tags: article.tags,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      creator: '@yororo_ice',
      title: article.title,
      description,
      images: images.map(image => image.url),
    },
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  if (!/^[a-f0-9]{24}$/.test(id)) notFound()

  const article = await getArticle(id)
  if (!article) notFound()

  const preview = articlePreview(article.content)
  const canonical = absoluteUrl(`/articles/${id}`)
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${canonical}#article`,
    mainEntityOfPage: canonical,
    headline: article.title,
    description: seoDescription(preview.content, article.title),
    image: preview.coverUrl ? [preview.coverUrl] : [DEFAULT_SOCIAL_IMAGE.url],
    datePublished: article.createdAt,
    dateModified: article.updatedAt || article.createdAt,
    articleSection: article.category || '文章',
    keywords: article.tags?.join(', '),
    wordCount: preview.content.length,
    inLanguage: 'zh-CN',
    author: {
      '@type': 'Person',
      name: article.username || SITE_AUTHOR,
      url: absoluteUrl('/about'),
    },
    publisher: {
      '@type': 'Person',
      name: SITE_AUTHOR,
      url: absoluteUrl('/about'),
    },
  }

  return (
    <>
      <StructuredData data={structuredData} />
      <ArticleDetail key={id} id={id} initialArticle={article} />
    </>
  )
}
