import 'server-only'

import { cache } from 'react'
import type { ArchiveEntry, Entry, Envelope, HomeMomentSummary, SitemapContent } from '@/lib/blog'
import { backendUrl } from './blog-session'

const CONTENT_REVALIDATE_SECONDS = 300

class PublicContentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function publicEnvelope<T>(path: string): Promise<Envelope<T>> {
  const response = await fetch(backendUrl(`/api/${path}`), {
    next: { revalidate: CONTENT_REVALIDATE_SECONDS, tags: ['public-blog-content'] },
    signal: AbortSignal.timeout(30_000),
  })
  const payload = await response.json().catch(() => null) as (Envelope<T> & { message?: string; success?: boolean }) | null

  if (!response.ok || !payload || payload.success === false) {
    throw new PublicContentError(payload?.message || `博客服务响应异常 (${response.status})`, response.status)
  }

  return payload
}

export const getArticlesPage = cache(async (
  page = 1,
  limit = 10,
  keyword = '',
  category = '',
  date = '',
) => {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (keyword) query.set('keyword', keyword)
  if (category) query.set('category', category)
  if (date) query.set('date', date)
  return publicEnvelope<Entry[]>(`knowledge?${query}`)
})

export const getArticle = cache(async (id: string) => {
  try {
    const result = await publicEnvelope<Entry>(`knowledge/${id}`)
    return result.data
  } catch (error) {
    if (error instanceof PublicContentError && error.status === 404) return null
    throw error
  }
})

export const getPublishedMomentsPage = cache(async (page = 1, limit = 12, date = '') => {
  const query = new URLSearchParams({
    isEditing: 'false',
    page: String(page),
    limit: String(limit),
  })
  if (date) query.set('date', date)
  return publicEnvelope<Entry[]>(`moments/get?${query}`)
})

export const getHomeMomentSummary = cache(async () => (
  publicEnvelope<HomeMomentSummary>('moments/summary?limit=8&days=84')
))

export const getArchivePage = cache(async (
  page = 1,
  limit = 50,
  type: 'all' | 'articles' | 'moments' = 'all',
  year = 'all',
) => {
  const query = new URLSearchParams({ page: String(page), limit: String(limit), type, year })
  return publicEnvelope<ArchiveEntry[]>(`archive/feed?${query}`)
})

export const getArchiveYears = cache(async () => publicEnvelope<string[]>('archive/years'))

export const getSitemapContent = cache(async () => publicEnvelope<SitemapContent>('archive/sitemap'))

export const getMoment = cache(async (id: string) => {
  try {
    const result = await publicEnvelope<Entry>(`moments/${id}`)
    return result.data
  } catch (error) {
    if (error instanceof PublicContentError && error.status === 404) return null
    throw error
  }
})
