import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MomentDetail } from '@/components/blog/moments'
import StructuredData from '@/components/seo/structured-data'
import { mediaFor } from '@/lib/blog'
import { DEFAULT_SOCIAL_IMAGE, NO_INDEX, SITE_AUTHOR, SITE_NAME, absoluteUrl, seoDescription } from '@/lib/seo'
import { getMoment } from '@/lib/server/public-content'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!/^[a-f0-9]{24}$/.test(id)) return { title: '片刻不存在', robots: NO_INDEX }

  const moment = await getMoment(id)
  if (!moment) return { title: '片刻不存在', robots: NO_INDEX }

  const description = seoDescription(moment.content, moment.title)
  const canonical = absoluteUrl(`/moments/${id}`)
  const mediaImages = mediaFor(moment).filter(file => file.mime.startsWith('image')).map(file => ({
    url: file.url,
    alt: file.desc || moment.title,
  }))
  const images = mediaImages.length ? mediaImages : [DEFAULT_SOCIAL_IMAGE]

  return {
    title: moment.title,
    description,
    authors: [{ name: moment.username || SITE_AUTHOR, url: absoluteUrl('/about') }],
    alternates: { canonical },
    openGraph: {
      type: 'article',
      locale: 'zh_CN',
      url: canonical,
      siteName: SITE_NAME,
      title: moment.title,
      description,
      publishedTime: moment.createdAt,
      modifiedTime: moment.updatedAt || moment.createdAt,
      authors: [moment.username || SITE_AUTHOR],
      images,
    },
    twitter: {
      card: 'summary_large_image',
      creator: '@yororo_ice',
      title: moment.title,
      description,
      images: images.map(image => image.url),
    },
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  if (!/^[a-f0-9]{24}$/.test(id)) notFound()

  const moment = await getMoment(id)
  if (!moment) notFound()

  const canonical = absoluteUrl(`/moments/${id}`)
  const images = mediaFor(moment).filter(file => file.mime.startsWith('image')).map(file => file.url)
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    '@id': `${canonical}#posting`,
    mainEntityOfPage: canonical,
    headline: moment.title,
    articleBody: moment.content,
    description: seoDescription(moment.content, moment.title),
    image: images.length ? images : [DEFAULT_SOCIAL_IMAGE.url],
    datePublished: moment.createdAt,
    dateModified: moment.updatedAt || moment.createdAt,
    inLanguage: 'zh-CN',
    author: {
      '@type': 'Person',
      name: moment.username || SITE_AUTHOR,
      url: absoluteUrl('/about'),
    },
  }

  return (
    <>
      <StructuredData data={structuredData} />
      <MomentDetail key={id} id={id} initialEntry={moment} />
    </>
  )
}
