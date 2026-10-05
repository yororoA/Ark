import type { Metadata } from 'next'

export const SITE_NAME = 'YororoIce Ark'
export const SITE_DESCRIPTION = '代码、日常与偶然闪过的念头。YororoIce 的个人博客。'
export const SITE_AUTHOR = 'YororoIce'

function configuredSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || 'https://yororoice.top'
  return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
}

export const SITE_URL = configuredSiteUrl()

export function absoluteUrl(path = '/') {
  return new URL(path, SITE_URL).toString()
}

export function seoDescription(markdown: string, fallback: string, length = 155) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[-*_]{3,}\s*$/gm, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-+*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return fallback
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text
}

export const DEFAULT_SOCIAL_IMAGE = {
  url: absoluteUrl('/bg.jpg'),
  width: 4096,
  height: 2292,
  alt: SITE_NAME,
}

export const NO_INDEX: Metadata['robots'] = {
  index: false,
  follow: false,
  noarchive: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
}

type PageMetadataOptions = {
  title: string
  description: string
  path: string
  noIndex?: boolean
}

export function pageMetadata({ title, description, path, noIndex = false }: PageMetadataOptions): Metadata {
  const canonical = absoluteUrl(path)
  const socialTitle = `${title} · ${SITE_NAME}`

  return {
    title,
    description,
    alternates: { canonical },
    robots: noIndex ? NO_INDEX : undefined,
    openGraph: {
      type: 'website',
      locale: 'zh_CN',
      url: canonical,
      siteName: SITE_NAME,
      title: socialTitle,
      description,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [DEFAULT_SOCIAL_IMAGE.url],
    },
  }
}
